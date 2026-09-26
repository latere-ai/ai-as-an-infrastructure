package main

import (
	"bytes"
	"compress/gzip"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

// newServer starts the handler on a test server. A separate non-following
// client lets us inspect a single hop's status and Location header.
// bookBuilt reports whether the embedded tree carries a real site. The
// directory is committed with only a .gitkeep so the go:embed directive
// resolves without a bun build, so its presence proves nothing and the
// English home page is the file that does.
func bookBuilt() bool {
	_, err := fs.Stat(book, "en/index.html")
	return err == nil
}

// requireBook skips a test that serves real pages.
//
// Stated rather than assumed: without it these tests passed in CI, where an
// earlier step runs `make build`, and failed in a clean clone for a reason
// that looked like a routing bug and was not.
func requireBook(t *testing.T) {
	t.Helper()
	if !bookBuilt() {
		t.Skip("site not built; run `make build` to cover the served pages")
	}
}

func newServer(t *testing.T) (string, *http.Client, *http.Client) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(serve))
	t.Cleanup(srv.Close)
	noFollow := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	return srv.URL, noFollow, srv.Client() // srv.Client() follows redirects (cap 10)
}

func get(t *testing.T, c *http.Client, base, path string, cookie string) *http.Response {
	t.Helper()
	req, err := http.NewRequest("GET", base+path, nil)
	if err != nil {
		t.Fatalf("request %s: %v", path, err)
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	return resp
}

// code asserts a single-hop status.
func code(t *testing.T, c *http.Client, base, path string, want int) {
	t.Helper()
	resp := get(t, c, base, path, "")
	resp.Body.Close()
	if resp.StatusCode != want {
		t.Errorf("%s => %d, want %d", path, resp.StatusCode, want)
	}
}

// loc asserts the single-hop Location header.
func loc(t *testing.T, c *http.Client, base, path, want, cookie string) {
	t.Helper()
	resp := get(t, c, base, path, cookie)
	resp.Body.Close()
	if got := resp.Header.Get("Location"); got != want {
		t.Errorf("%s location => %q, want %q", path, got, want)
	}
}

// noloop asserts the redirect chain terminates at a 200 (no infinite loop).
func noloop(t *testing.T, c *http.Client, base, path string) {
	t.Helper()
	resp := get(t, c, base, path, "")
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("%s redirect chain => %d, want 200 (loop?)", path, resp.StatusCode)
	}
}

// TestRouting exercises the redirect/serve contract the retired nginx config
// guaranteed: apex language redirect, the 2026 reorg 301s, canonicalization,
// extensionless serving, and the missing-page fallback.
func TestRouting(t *testing.T) {
	requireBook(t)
	base, nf, follow := newServer(t)

	// Apex resolves to a language home and never loops.
	noloop(t, follow, base, "/")
	noloop(t, follow, base, "/en/")
	noloop(t, follow, base, "/zh/")

	// Cookie-based apex language selection, via relative (absolute-path) Location.
	loc(t, nf, base, "/", "/en/", "")        // no cookie -> English
	loc(t, nf, base, "/", "/zh/", "lang=zh") // saved zh
	loc(t, nf, base, "/", "/en/", "lang=en")

	// Language homes and a number-free final chapter URL serve.
	code(t, nf, base, "/en/", 200)
	code(t, nf, base, "/zh/", 200)
	code(t, nf, base, "/zh/reasoning/inference-time-scaling", 200)

	// One page, one URL: the other spelling redirects to it rather than serving
	// the same file twice. A directory index keeps the trailing slash, a page
	// file drops it.
	loc(t, nf, base, "/en", "/en/", "")
	loc(t, nf, base, "/zh", "/zh/", "")
	code(t, nf, base, "/en", 301)
	loc(t, nf, base, "/en/foundations/", "/en/foundations", "")
	loc(t, nf, base, "/zh/reasoning/inference-time-scaling/", "/zh/reasoning/inference-time-scaling", "")
	code(t, nf, base, "/en/foundations", 200)
	noloop(t, follow, base, "/en")
	noloop(t, follow, base, "/en/foundations/")

	// A legacy path with a trailing slash still lands on the new URL in one hop:
	// the reorg patterns absorb the slash, so slash canonicalization never runs.
	loc(t, nf, base, "/en/p3-reasoning/inference-time-scaling/", "/en/reasoning/inference-time-scaling", "")
	noloop(t, follow, base, "/en/p3-reasoning/inference-time-scaling/")
	noloop(t, follow, base, "/zh/infrastructure/verification-frontier/")

	// Missing content paths answer 404, including the paths a crawler composes.
	code(t, nf, base, "/zh/nope", 404)
	code(t, nf, base, "/safety/safety/reasoning/foundations/practice/agents-and-sandboxes", 404)

	// Canonicalization: .html and /index.html collapse to the clean URL.
	loc(t, nf, base, "/en/index.html", "/en/", "")
	loc(t, nf, base, "/zh/reasoning/inference-time-scaling.html", "/zh/reasoning/inference-time-scaling", "")

	// Reorg 2026-06: numbered AND de-numbered old paths 301 to the final part.
	loc(t, nf, base, "/zh/p3-reasoning/15-inference-time-scaling", "/zh/reasoning/inference-time-scaling", "")
	loc(t, nf, base, "/zh/p3-reasoning/inference-time-scaling", "/zh/reasoning/inference-time-scaling", "")
	loc(t, nf, base, "/en/p4-inference/16-serving-problem.html", "/en/inference/serving-problem", "")
	noloop(t, follow, base, "/zh/p3-reasoning/15-inference-time-scaling")

	// Cross-part moves: agents -> orchestration, generative out of frontiers,
	// frontiers -> infrastructure, operations -> practice.
	loc(t, nf, base, "/en/p3-reasoning/16-training-agents-to-act", "/en/orchestration/training-agents-to-act", "")
	loc(t, nf, base, "/en/p3-reasoning/training-agents-to-act", "/en/orchestration/training-agents-to-act", "")
	loc(t, nf, base, "/en/p11-frontiers/52-diffusion-flow-matching", "/en/generative/diffusion-flow-matching", "")
	loc(t, nf, base, "/zh/p11-frontiers/58-multimodal-models", "/zh/generative/multimodal-models", "")
	loc(t, nf, base, "/en/p11-frontiers/45-the-compute-frontier", "/en/infrastructure/the-compute-frontier", "")
	loc(t, nf, base, "/zh/p13-operations/deployment-lifecycle", "/zh/practice/deployment-lifecycle", "")
	loc(t, nf, base, "/en/p10-practical/38-choosing-a-model", "/en/practice/choosing-a-model", "")
	// The application stack chapter left its dated slug; the former practice path
	// and the legacy part dir both reach the new slug in one hop.
	loc(t, nf, base, "/en/practice/wiring-a-2026-stack", "/en/practice/wiring-the-application-stack", "")
	loc(t, nf, base, "/zh/practice/wiring-a-2026-stack/", "/zh/practice/wiring-the-application-stack", "")
	loc(t, nf, base, "/en/practice/wiring-a-2026-stack.html", "/en/practice/wiring-the-application-stack", "")
	loc(t, nf, base, "/en/p10-practical/44-wiring-a-2026-stack", "/en/practice/wiring-the-application-stack", "")
	loc(t, nf, base, "/zh/p10-practical/wiring-a-2026-stack.html", "/zh/practice/wiring-the-application-stack", "")
	loc(t, nf, base, "/zh/p10-practical/44-wiring-a-2026-stack/", "/zh/practice/wiring-the-application-stack", "")
	noloop(t, follow, base, "/en/p10-practical/44-wiring-a-2026-stack")
	// The Part IX split: three chapters moved infrastructure -> frontiers, and the
	// two legacy part dirs reach the new home in one hop.
	loc(t, nf, base, "/en/infrastructure/verification-frontier", "/en/frontiers/verification-frontier", "")
	loc(t, nf, base, "/zh/infrastructure/the-capability-horizon", "/zh/frontiers/the-capability-horizon", "")
	loc(t, nf, base, "/en/p7-infrastructure/47-where-learning-hits-limits", "/en/frontiers/where-learning-hits-limits", "")
	loc(t, nf, base, "/zh/p11-frontiers/where-learning-hits-limits.html", "/zh/frontiers/where-learning-hits-limits", "")
	noloop(t, follow, base, "/en/infrastructure/verification-frontier")
	noloop(t, follow, base, "/en/p7-infrastructure/47-where-learning-hits-limits")
	noloop(t, follow, base, "/zh/p11-frontiers/where-learning-hits-limits.html")
	noloop(t, follow, base, "/en/p3-reasoning/16-training-agents-to-act")
	noloop(t, follow, base, "/en/p11-frontiers/45-the-compute-frontier")
	noloop(t, follow, base, "/zh/p13-operations/52-deployment-lifecycle")

	// Health probes.
	code(t, nf, base, "/healthz", 200)
	code(t, nf, base, "/readyz", 200)
}

// TestApexRedirectIsRelative guards the smoke-test regression: the apex Location
// must be a relative path, never the internal :8080 origin.
func TestApexRedirectIsRelative(t *testing.T) {
	base, nf, _ := newServer(t)
	resp := get(t, nf, base, "/", "")
	resp.Body.Close()
	got := resp.Header.Get("Location")
	if got == "" || got[0] != '/' {
		t.Fatalf("apex Location %q is not a relative path", got)
	}
}

// TestCacheHeaders checks the asset-vs-content cache policy and ETag 304 path.
func TestCacheHeaders(t *testing.T) {
	requireBook(t)
	base, nf, _ := newServer(t)

	// HTML is no-cache with an ETag.
	resp := get(t, nf, base, "/en/", "")
	resp.Body.Close()
	if cc := resp.Header.Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("/en/ Cache-Control => %q, want no-cache", cc)
	}
	etag := resp.Header.Get("ETag")
	if etag == "" {
		t.Fatalf("/en/ has no ETag")
	}

	// A matching If-None-Match yields a cheap 304.
	req, _ := http.NewRequest("GET", base+"/en/", nil)
	req.Header.Set("If-None-Match", etag)
	resp2, err := nf.Do(req)
	if err != nil {
		t.Fatalf("conditional GET: %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusNotModified {
		t.Errorf("conditional /en/ => %d, want 304", resp2.StatusCode)
	}

	// A content-addressed asset caches for a year. favicon.svg always exists.
	resp3 := get(t, nf, base, "/favicon.svg", "")
	resp3.Body.Close()
	if cc := resp3.Header.Get("Cache-Control"); cc != "public, max-age=31536000" {
		t.Errorf("/favicon.svg Cache-Control => %q, want immutable", cc)
	}

	// A missing asset 404s; it must not fall back to the site entrypoint.
	code(t, nf, base, "/en/figures/does-not-exist.png", 404)
}

// TestPrecompressed: text is served from its build-time .gz sibling to clients
// that accept gzip and as the plain file otherwise, with distinct validators.
// Before, every such response was compressed per request from a full in-memory
// copy, and concurrent requests for the large search index ran the pod out of
// memory.
func TestPrecompressed(t *testing.T) {
	requireBook(t)
	base, nf, _ := newServer(t)
	if !exists("en/search.json.gz") {
		t.Fatalf("en/search.json.gz is missing: the build did not precompress")
	}
	plain, err := fs.ReadFile(book, "en/search.json")
	if err != nil {
		t.Fatal(err)
	}

	req, _ := http.NewRequest("GET", base+"/en/search.json", nil)
	req.Header.Set("Accept-Encoding", "gzip") // set by hand, so the client does not decode
	resp, err := nf.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.Header.Get("Content-Encoding") != "gzip" {
		t.Fatalf("Content-Encoding => %q, want gzip", resp.Header.Get("Content-Encoding"))
	}
	zr, err := gzip.NewReader(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, plain) {
		t.Errorf("decoded body differs from en/search.json (%d vs %d bytes)", len(got), len(plain))
	}
	gzTag := resp.Header.Get("ETag")

	req2, _ := http.NewRequest("GET", base+"/en/search.json", nil)
	req2.Header.Set("Accept-Encoding", "identity")
	resp2, err := nf.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	body2, err := io.ReadAll(resp2.Body)
	resp2.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if resp2.Header.Get("Content-Encoding") != "" || !bytes.Equal(body2, plain) {
		t.Errorf("identity request => encoding %q, %d bytes; want plain %d bytes", resp2.Header.Get("Content-Encoding"), len(body2), len(plain))
	}
	if gzTag == "" || gzTag == resp2.Header.Get("ETag") {
		t.Errorf("gzip ETag %q must exist and differ from the plain one %q", gzTag, resp2.Header.Get("ETag"))
	}

	// The variant revalidates with its own validator.
	req3, _ := http.NewRequest("GET", base+"/en/search.json", nil)
	req3.Header.Set("Accept-Encoding", "gzip")
	req3.Header.Set("If-None-Match", gzTag)
	resp3, err := nf.Do(req3)
	if err != nil {
		t.Fatal(err)
	}
	resp3.Body.Close()
	if resp3.StatusCode != http.StatusNotModified {
		t.Errorf("conditional gzip GET => %d, want 304", resp3.StatusCode)
	}

	// The sibling itself is not a public path: like any unknown content URL it
	// answers with the not-found page.
	code(t, nf, base, "/en/search.json.gz", http.StatusNotFound)
}

// urlAttr captures every href and src value in a page.
var urlAttr = regexp.MustCompile(`(?i)\b(?:href|src)="([^"]*)"`)

// urlScheme matches a URL that names its scheme (https:, http:, mailto:, data:).
var urlScheme = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]*:`)

// relativeURLs returns the href and src values the browser would resolve
// against the requested address: anything not root-relative, not carrying a
// scheme, and not a fragment.
func relativeURLs(html []byte) []string {
	var rel []string
	for _, m := range urlAttr.FindAllSubmatch(html, -1) {
		v := string(m[1])
		if !strings.HasPrefix(v, "/") && !strings.HasPrefix(v, "#") && !urlScheme.MatchString(v) {
			rel = append(rel, v)
		}
	}
	return rel
}

// The not-found page is served at whatever address was requested, so it must
// hold no relative URL: resolved against an invented path, one would hand a
// crawler the next invented path. It is also never a page of its own.
func TestNotFoundPage(t *testing.T) {
	requireBook(t)
	base, nf, _ := newServer(t)

	for _, gz := range []bool{false, true} {
		req, err := http.NewRequest("GET", base+"/orchestration/reasoning/infrastructure/memory-systems", nil)
		if err != nil {
			t.Fatal(err)
		}
		if gz {
			req.Header.Set("Accept-Encoding", "gzip")
		} else {
			req.Header.Set("Accept-Encoding", "identity")
		}
		resp, err := nf.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var body io.Reader = resp.Body
		if resp.Header.Get("Content-Encoding") == "gzip" {
			zr, err := gzip.NewReader(resp.Body)
			if err != nil {
				t.Fatalf("gzip body: %v", err)
			}
			body = zr
		} else if gz {
			t.Error("gzip accepted, but the not-found page came back uncompressed")
		}
		html, err := io.ReadAll(body)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("gzip=%v: status %d, want 404", gz, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Errorf("gzip=%v: Content-Type %q, want text/html", gz, ct)
		}
		if resp.Header.Get("X-Robots-Tag") != "noindex" {
			t.Errorf("gzip=%v: X-Robots-Tag %q, want noindex", gz, resp.Header.Get("X-Robots-Tag"))
		}
		if rel := relativeURLs(html); len(rel) > 0 {
			t.Errorf("gzip=%v: relative URLs in the not-found page: %q", gz, rel)
		}
		for _, home := range []string{`href="/en/"`, `href="/zh/"`} {
			if !bytes.Contains(html, []byte(home)) {
				t.Errorf("gzip=%v: not-found page has no %s link", gz, home)
			}
		}
	}

	code(t, nf, base, "/404", http.StatusNotFound)
	loc(t, nf, base, "/404.html", "/404", "")
}

// Every page is fetched at its own address and, by some crawlers, resolved
// against another one: the address they asked for before a redirect, or one
// they invented. A page-relative link then names a different page for each
// base, which is how one crawler composed new addresses at about twenty
// requests a second. Every href and src in the built book must resolve to the
// same URL from any base.
func TestPagesHoldNoRelativeURLs(t *testing.T) {
	requireBook(t)
	pages := 0
	err := fs.WalkDir(book, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(p, ".html") {
			return nil
		}
		html, err := fs.ReadFile(book, p)
		if err != nil {
			return err
		}
		if rel := relativeURLs(html); len(rel) > 0 {
			t.Errorf("%s: %d page-relative URLs, e.g. %q", p, len(rel), rel[:min(len(rel), 3)])
		}
		pages++
		return nil
	})
	if err != nil {
		t.Fatalf("walk the book: %v", err)
	}
	// Both languages hold over a hundred pages; far fewer means the walk
	// looked in the wrong place and proved nothing.
	if pages < 200 {
		t.Fatalf("checked %d pages, want the whole book", pages)
	}
}
