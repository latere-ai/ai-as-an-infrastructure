package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// newServer starts the handler on a test server. A separate non-following
// client lets us inspect a single hop's status and Location header.
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

	// Missing content paths return to the site entrypoint.
	code(t, nf, base, "/zh/nope", 302)
	loc(t, nf, base, "/zh/nope", "/", "")
	noloop(t, follow, base, "/zh/nope")

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
