// Command aaai-web serves the compiled book. The whole _book/ tree is embedded
// into the binary at build time (`bun run build` produces it), so deployment is
// one self-contained static binary: no vendored HTML in git, no separate web
// server. It reproduces the routing contract the old nginx config provided:
//
//   - cookie-based apex language redirect (/ -> /en/ or /zh/, 302 + Vary: Cookie)
//   - the 2026 URL-reorg 301s (number-free, 11-part restructure), first-match-wins
//   - .html and /index.html canonicalization to clean URLs
//   - extensionless serving (clean URL -> the on-disk .html)
//   - immutable caching for content-addressed assets, no-cache + ETag for HTML
//   - gzip for text assets (the ~1.2MB search.json especially)
//   - /healthz and /readyz for the Kubernetes probes
//   - unknown content URLs fall back to the site entrypoint (302 /)
//
// Behind the TLS-terminating ingress the server speaks http on :8080; all
// redirects use relative (absolute-path) Locations so the browser keeps https.
package main

import (
	"cmp"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"latere.ai/x/pkg/oidc"
	"latere.ai/x/pkg/otel"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/api"
	"github.com/latere-ai/ai-as-an-infrastructure/internal/authn"
	"github.com/latere-ai/ai-as-an-infrastructure/internal/config"
	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// commentsAPI is the reader-comments handler, set in main() only when a database
// is configured. Nil means the comments feature is off and the server behaves
// exactly like the static-only book (so the routing tests, which call serve
// directly, are unaffected).
var commentsAPI *api.Handler

// dbPing, when set (comments enabled), gates /readyz on database reachability.
var dbPing func(context.Context) error

//go:embed all:_book
var embedded embed.FS

// book is the embedded _book/ tree, rooted so lookups read like "en/index.html".
var book fs.FS

// etags maps an embedded file path to its content ETag. Precomputed once so a
// conditional request for the 1.2MB search.json is a cheap map lookup, not a
// re-hash. Only the no-cache responses (HTML, JSON) use it.
var etags = map[string]string{}

func init() {
	sub, err := fs.Sub(embedded, "_book")
	if err != nil {
		panic(err)
	}
	book = sub
	// The ETag table is best-effort: an entry that cannot be read simply has
	// no ETag, and the callback never returns an error, so WalkDir's own is
	// always nil.
	_ = fs.WalkDir(book, ".", func(p string, d fs.DirEntry, err error) error {
		//nolint:nilerr // an unreadable entry is skipped, not fatal
		if err != nil || d.IsDir() {
			return nil
		}
		if b, e := fs.ReadFile(book, p); e == nil {
			sum := sha256.Sum256(b)
			etags[p] = `"` + hex.EncodeToString(sum[:16]) + `"`
		}
		return nil
	})
}

// redirect is one reorg rule: an anchored pattern and a $-template target.
type redirect struct {
	re   *regexp.Regexp
	repl string
}

// redirects are evaluated in order, first match wins. The two cross-part
// exceptions sit above their old part's bulk rule. "(?:\d+-)?" absorbs the old
// chapter number; "(?:\.html)?" and "/?" absorb the legacy .html and trailing
// slash. Mirrors the location blocks in the retired deploy/nginx.conf.
var redirects = []redirect{
	// Exception: "Training Agents to Act" moved Reasoning -> Orchestration.
	{regexp.MustCompile(`^/(en|zh)/p3-reasoning/(?:\d+-)?training-agents-to-act(?:\.html)?/?$`),
		`/${1}/orchestration/training-agents-to-act`},
	// Exception: the three frontier chapters moved Infrastructure -> Frontiers when
	// Part IX was split. This rule covers both the current /infrastructure/ paths
	// and the two legacy part dirs, so an old link takes one hop, not two.
	{regexp.MustCompile(`^/(en|zh)/(?:infrastructure|p7-infrastructure|p11-frontiers)/(?:\d+-)?(where-learning-hits-limits|the-capability-horizon|verification-frontier)(?:\.html)?/?$`),
		`/${1}/frontiers/${2}`},
	// Exception: the generative/multimodal chapters (once in p11-frontiers) -> generative.
	{regexp.MustCompile(`^/(en|zh)/p11-frontiers/(?:\d+-)?(beyond-text|diffusion-flow-matching|speech-and-voice|nar-diffusion-lms|multimodal-models)(?:\.html)?/?$`),
		`/${1}/generative/${2}`},
	// Bulk per-old-part-dir renames (strip optional NN-, remap the part slug).
	{regexp.MustCompile(`^/(en|zh)/p0-orientation/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/orientation/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p1-foundations/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/foundations/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p2-adaptation/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/adaptation/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p3-reasoning/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/reasoning/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p4-inference/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/inference/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p5-orchestration/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/orchestration/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p6-evaluation/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/evaluation/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p7-infrastructure/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/infrastructure/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p8-safety/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/safety/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p9-ecosystem/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/ecosystem/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p10-practical/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/practice/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p11-frontiers/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/infrastructure/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p12-generative/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/generative/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p12-operations/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/practice/${2}`},
	{regexp.MustCompile(`^/(en|zh)/p13-operations/(?:\d+-)?([a-z0-9-]+?)(?:\.html)?/?$`), `/${1}/practice/${2}`},
}

// assetRe matches content-addressed assets: hashed reader.js and content-stable
// figures/fonts/icons. These cache hard and never fall back on a miss.
var assetRe = regexp.MustCompile(`(?i)\.(js|svg|png|jpe?g|webp|woff2?|ico)$`)

func serve(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path

	switch p {
	case "/healthz":
		w.Header().Set("Cache-Control", "no-store")
		_, _ = io.WriteString(w, "ok\n")
		return
	case "/readyz":
		w.Header().Set("Cache-Control", "no-store")
		if dbPing != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := dbPing(ctx); err != nil {
				http.Error(w, "db unavailable", http.StatusServiceUnavailable)
				return
			}
		}
		_, _ = io.WriteString(w, "ok\n")
		return
	}

	// Dynamic routes (comments API, plus the OIDC login flow added in M3). Matched
	// before the reorg/canonicalization rules so they are never rewritten or
	// swallowed by the static try_files fallback. Skipped entirely when comments
	// are disabled, leaving the static contract untouched.
	if commentsAPI != nil && commentsAPI.Owns(p) {
		commentsAPI.ServeHTTP(w, r)
		return
	}

	switch p {
	case "/":
		// Apex -> reader's saved language, else English. 302 (not 301) + Vary:
		// Cookie so the per-language choice is never frozen in a cache.
		w.Header().Set("Vary", "Cookie")
		http.Redirect(w, r, apexTarget(r), http.StatusFound)
		return
	}

	// Reorg 301s (first match wins).
	for _, rd := range redirects {
		if rd.re.MatchString(p) {
			http.Redirect(w, r, rd.re.ReplaceAllString(p, rd.repl), http.StatusMovedPermanently)
			return
		}
	}

	// Canonicalize the legacy .html and redundant /index.html forms to the clean
	// URL. index.html first so "/x/index.html" -> "/x/" (not "/x/index").
	if before, ok := strings.CutSuffix(p, "/index.html"); ok {
		http.Redirect(w, r, before+"/", http.StatusMovedPermanently)
		return
	}
	if before, ok := strings.CutSuffix(p, ".html"); ok {
		http.Redirect(w, r, before, http.StatusMovedPermanently)
		return
	}

	serveStatic(w, r, p)
}

func apexTarget(r *http.Request) string {
	if c, err := r.Cookie("lang"); err == nil && c.Value == "zh" {
		return "/zh/"
	}
	return "/en/"
}

func serveStatic(w http.ResponseWriter, r *http.Request, p string) {
	name := strings.TrimPrefix(p, "/")

	// Content-addressed assets: serve the exact file or 404. A missing asset must
	// fail as an asset, never fall back to the site entrypoint.
	if assetRe.MatchString(p) {
		if !writeFile(w, r, name, true) {
			http.NotFound(w, r)
		}
		return
	}

	// Content router: resolve the clean URL to the on-disk file, mirroring
	// nginx's `try_files $uri $uri.html $uri/`.
	//
	// One page must not be reachable under two spellings. A page's own links and
	// images are relative, and the browser resolves them against the directory
	// of the URL it is on, so "/en" and "/en/" are not interchangeable: at "/en"
	// the cover image "figures/cover-dark.png" resolves to "/figures/..." and
	// 404s. Each form therefore serves only if it is the canonical one, and 301s
	// to the other when it is not: a directory index takes the trailing slash, a
	// page file does not.
	if name == "" || strings.HasSuffix(name, "/") {
		if writeFile(w, r, name+"index.html", false) {
			return
		}
		if trimmed := strings.TrimSuffix(name, "/"); trimmed != "" &&
			(exists(trimmed) || exists(trimmed+".html")) {
			http.Redirect(w, r, "/"+trimmed, http.StatusMovedPermanently)
			return
		}
	} else {
		for _, c := range []string{name, name + ".html"} {
			if writeFile(w, r, c, false) {
				return
			}
		}
		if exists(name + "/index.html") {
			http.Redirect(w, r, "/"+name+"/", http.StatusMovedPermanently)
			return
		}
	}

	// Unknown content URL -> back to the site entrypoint (which 302s to a
	// language home) instead of exposing a bare 404 page.
	http.Redirect(w, r, "/", http.StatusFound)
}

// exists reports whether name is an embedded file (not a directory).
func exists(name string) bool {
	info, err := fs.Stat(book, name)
	return err == nil && !info.IsDir()
}

// writeFile serves the embedded file at name, returning false (without writing)
// if it is absent or a directory. immutable assets cache for a year; everything
// else is no-cache with an ETag so revalidation is a cheap 304.
func writeFile(w http.ResponseWriter, r *http.Request, name string, immutable bool) bool {
	info, err := fs.Stat(book, name)
	if err != nil || info.IsDir() {
		return false
	}
	body, err := fs.ReadFile(book, name)
	if err != nil {
		return false
	}

	h := w.Header()
	ctype := contentType(name)
	if ctype != "" {
		h.Set("Content-Type", ctype)
	}
	if immutable {
		h.Set("Cache-Control", "public, max-age=31536000")
	} else {
		h.Set("Cache-Control", "no-cache")
		if tag := etags[name]; tag != "" {
			h.Set("ETag", tag)
			if r.Header.Get("If-None-Match") == tag {
				w.WriteHeader(http.StatusNotModified)
				return true
			}
		}
	}

	if compressible(ctype) && len(body) >= 1024 && acceptsGzip(r) {
		h.Set("Content-Encoding", "gzip")
		h.Add("Vary", "Accept-Encoding")
		w.WriteHeader(http.StatusOK)
		gw := gzip.NewWriter(w)
		// The status line is already sent, so a write or flush failure cannot
		// become an error response. Closing is still checked rather than
		// dropped: an unflushed gzip stream is a truncated page, and this is
		// the call that would report it.
		_, writeErr := gw.Write(body)
		closeErr := gw.Close()
		if writeErr != nil || closeErr != nil {
			log.Printf("serving %s: gzip response truncated: write=%v close=%v", r.URL.Path, writeErr, closeErr)
		}
		return true
	}
	h.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(body); err != nil {
		log.Printf("serving %s: %v", r.URL.Path, err)
	}
	return true
}

func contentType(name string) string {
	switch {
	case strings.HasSuffix(name, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(name, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(name, ".js"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(name, ".json"):
		return "application/json; charset=utf-8"
	case strings.HasSuffix(name, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(name, ".png"):
		return "image/png"
	case strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(name, ".webp"):
		return "image/webp"
	case strings.HasSuffix(name, ".woff2"):
		return "font/woff2"
	case strings.HasSuffix(name, ".woff"):
		return "font/woff"
	case strings.HasSuffix(name, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(name, ".xml"):
		return "application/xml"
	case strings.HasSuffix(name, ".txt"):
		return "text/plain; charset=utf-8"
	}
	return ""
}

// compressible mirrors the nginx gzip_types: text and the search-index JSON.
func compressible(ctype string) bool {
	for _, prefix := range []string{
		"text/html", "text/css", "text/javascript", "application/javascript",
		"application/json", "image/svg+xml", "text/plain", "application/xml",
	} {
		if strings.HasPrefix(ctype, prefix) {
			return true
		}
	}
	return false
}

func acceptsGzip(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
}

// isProbe reports whether path is one of the Kubernetes probe endpoints.
func isProbe(path string) bool {
	return path == "/healthz" || path == "/readyz"
}

// newHandler wraps the routing contract in OpenTelemetry tracing and metrics.
// The probes are excluded: Kubernetes polls them every few seconds and they
// would otherwise be the bulk of the recorded spans.
func newHandler() http.Handler {
	return otel.Handler(http.HandlerFunc(serve), "aaai",
		otel.WithSkip(func(r *http.Request) bool { return isProbe(r.URL.Path) }),
	)
}

func main() {
	if err := run(); err != nil {
		slog.Error("aaai-web stopped", "err", err)
		os.Exit(1)
	}
}

// run owns the process lifecycle. It is separate from main so the telemetry
// flush and the database pool close deferred here still run on a startup or
// serving failure; os.Exit in main would skip them.
func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Bootstrap wires logs, traces, and metrics and sets the slog default.
	// Export stays a noop until OTEL_EXPORTER_OTLP_ENDPOINT is set, so a local
	// run keeps writing plain structured logs to stderr.
	logger, otelShutdown, logsErr := otel.Bootstrap(ctx, otel.Config{ServiceName: "aaai"})
	if logsErr != nil {
		logger.Warn("otlp logs init failed; continuing with local logging", "err", logsErr)
	}
	defer func() {
		// ctx is cancelled by the signal that stopped the server, so the flush
		// needs a context that outlives it.
		if err := otelShutdown(context.WithoutCancel(ctx)); err != nil {
			logger.Error("otel shutdown", "err", err)
		}
	}()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	if cfg.DatabaseURL != "" {
		pool, err := store.NewPool(context.Background(), cfg.DatabaseURL)
		if err != nil {
			return fmt.Errorf("database: %w", err)
		}
		defer pool.Close()
		dbPing = pool.Ping

		// OIDC login is optional: with no AUTH_CLIENT_ID, oidc.New returns nil
		// and comments stay public-read-only (anonymous identity rejects writes).
		var id api.Identity = api.Anonymous{}
		var routes *api.AuthRoutes
		if client := oidc.New(oidc.LoadConfig()); client != nil {
			secure := os.Getenv("AUTH_INSECURE_COOKIES") != "true"
			id = authn.New(client, secure)
			routes = &api.AuthRoutes{
				Login:        client.HandleLogin,
				Callback:     client.HandleCallback,
				Logout:       client.HandleLogout,
				LogoutNotify: client.HandleLogoutNotify,
			}
			logger.Info("comments enabled with OIDC login")
		} else {
			logger.Info("comments enabled (read-only: OIDC not configured)")
		}
		commentsAPI = api.New(store.New(pool), id, routes)
	}

	addr := cfg.ListenAddr
	if addr == "" {
		addr = ":" + cmp.Or(os.Getenv("PORT"), "8080")
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           newHandler(),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	logger.Info("aaai-web serving embedded _book", "addr", addr)
	// preShutdown is nil: the pool must outlive srv.Shutdown so in-flight
	// requests can finish draining, which the deferred pool.Close honours.
	return otel.RunServer(ctx, srv, 10*time.Second, nil)
}
