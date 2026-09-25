package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/api"
)

type routeCase struct {
	path, want string
}

// checkRoutes asserts routeOf for each path, and that it names the not-found
// page exactly when serve answers with it. routeOf restates serve's dispatch;
// the second assertion is what catches the two drifting apart.
func checkRoutes(t *testing.T, cases []routeCase) {
	t.Helper()
	for _, c := range cases {
		r := httptest.NewRequest(http.MethodGet, c.path, nil)
		if got := routeOf(r); got != c.want {
			t.Errorf("routeOf(%s) = %q, want %q", c.path, got, c.want)
		}
		w := httptest.NewRecorder()
		serve(w, r)
		// A missing asset is a plain 404 too; the not-found page is the one
		// that is HTML.
		notFound := w.Code == http.StatusNotFound &&
			strings.HasPrefix(w.Header().Get("Content-Type"), "text/html")
		if notFound != (c.want == unknownRoute) {
			t.Errorf("%s: served %d %q, but routeOf says %q",
				c.path, w.Code, w.Header().Get("Content-Type"), c.want)
		}
	}
}

// Shapes decided by the path alone: they route the same with or without a
// built book.
func TestRouteOfPathShapes(t *testing.T) {
	checkRoutes(t, []routeCase{
		{"/", "/"},
		{"/en/p3-reasoning/15-inference-time-scaling", "/en/{legacy}"},
		{"/zh/p11-frontiers/58-multimodal-models/", "/zh/{legacy}"},
		{"/en/index.html", "/en/{page}.html"},
		{"/zh/reasoning/inference-time-scaling.html", "/zh/{page}.html"},
		{"/en/chunk-02mxrq9m.js", "/{asset}.js"},
		{"/og/cover.PNG", "/{asset}.png"},
		// With the relay unset (a bare test run), its path is unknown content.
		{"/v1/telemetry/v1/traces", unknownRoute},
		// With comments off, the API paths are ordinary unknown content.
		{"/api/me", unknownRoute},
		{"/login", unknownRoute},
	})
}

// Shapes that depend on what the build contains.
func TestRouteOfServedPages(t *testing.T) {
	requireBook(t)
	checkRoutes(t, []routeCase{
		{"/en/", "/en/"},
		{"/en", "/en/"},
		{"/zh/", "/zh/"},
		{"/en/foundations", "/en/{page}"},
		{"/en/foundations/", "/en/{page}"},
		{"/zh/reasoning/inference-time-scaling", "/zh/{part}/{chapter}"},
		{"/zh/reasoning/inference-time-scaling/", "/zh/{part}/{chapter}"},
		{"/en/search.json", "/en/search.json"},
		{"/robots.txt", "/robots.txt"},
		{"/sitemap.xml", "/sitemap.xml"},
		// The shape a crawler composes from relative links resolved against
		// the wrong base, and paths that look like pages but are not.
		{"/safety/safety/reasoning/foundations/practice/agents-and-sandboxes", unknownRoute},
		{"/zh/nope", unknownRoute},
		{"/en/foundations/nope/deeper", unknownRoute},
		// Neither a precompressed sibling nor the not-found page is served
		// under its own name.
		{"/en/search.json.gz", unknownRoute},
		{"/404", unknownRoute},
		{"/404/", unknownRoute},
	})
}

// With comments on, API paths take the matched ServeMux pattern and the OIDC
// routes keep their literal path.
func TestRouteOfAPI(t *testing.T) {
	prev := commentsAPI
	t.Cleanup(func() { commentsAPI = prev })
	commentsAPI = api.New(nil, api.Anonymous{}, &api.AuthRoutes{
		Login: http.NotFound, Callback: http.NotFound, Logout: http.NotFound, LogoutNotify: http.NotFound,
	})

	for _, c := range []struct{ path, pattern, want string }{
		{"/api/comments/42", "", "/api/{endpoint}"},
		{"/api/comments/42", "PATCH /api/comments/{id}", "/api/comments/{id}"},
		{"/api/nope", "", "/api/{endpoint}"},
		{"/login", "", "/login"},
		{"/logout/notify", "GET /logout/notify", "/logout/notify"},
	} {
		r := httptest.NewRequest(http.MethodGet, c.path, nil)
		r.Pattern = c.pattern
		if got := routeOf(r); got != c.want {
			t.Errorf("routeOf(%s, pattern %q) = %q, want %q", c.path, c.pattern, got, c.want)
		}
	}
}
