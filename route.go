package main

import (
	"net/http"
	"path"
	"strings"
)

// unknownRoute names a path serve answers with the fallback redirect to the
// site entrypoint: no page, asset, legacy rule, or API route matches it.
const unknownRoute = "/{unknown}"

// routeOf names the branch of serve a request takes, as the route template
// that becomes the span name and the http.route attribute on spans and request
// metrics.
//
// serve is a hand-written router rather than a ServeMux, so otelhttp has no
// matched pattern to report. Without a template every span is named after its
// raw path: a crawler composing paths out of the home page's relative links
// produced over ten thousand distinct operations a day, and the request
// metrics could only be split by status code.
//
// No chapter, file, or client-chosen segment appears in a template, so the set
// of values is bounded by the shapes below rather than by the URLs clients
// send. The language stays literal: it has two values and splits every series
// by audience.
//
// It mirrors serve's order of dispatch and reads only the request and the
// embedded tree, so it gives the same answer before serve runs (the span name)
// and after (the route attribute and the metric label).
func routeOf(r *http.Request) string {
	// The comments ServeMux sets the pattern it matched, e.g.
	// "PATCH /api/comments/{id}". The method is already its own attribute.
	if r.Pattern != "" {
		if _, route, ok := strings.Cut(r.Pattern, " "); ok {
			return route
		}
		return r.Pattern
	}

	p := r.URL.Path
	lang := langOf(p)
	switch {
	case p == "/":
		return "/"
	case commentsAPI != nil && commentsAPI.Owns(p):
		// Before the mux has run, or when no API route matches.
		if strings.HasPrefix(p, "/api/") {
			return "/api/{endpoint}"
		}
		return p // Owns admits only the four literal OIDC routes.
	}

	for _, rd := range redirects {
		if rd.re.MatchString(p) {
			return lang + "/{legacy}"
		}
	}
	if strings.HasSuffix(p, ".html") {
		return lang + "/{page}.html"
	}
	if assetRe.MatchString(p) {
		return "/{asset}" + strings.ToLower(path.Ext(p))
	}

	if !resolves(strings.TrimPrefix(p, "/")) {
		return unknownRoute
	}
	rest := strings.Trim(strings.TrimPrefix(p, lang), "/")
	switch {
	case rest == "":
		return lang + "/"
	case !strings.Contains(rest, "/") && path.Ext(rest) != "":
		// A build file beside the pages (search.json, sitemap.xml, robots.txt).
		// Only files that exist reach here, so the build bounds the set.
		return lang + "/" + rest
	case !strings.Contains(rest, "/"):
		return lang + "/{page}"
	case strings.Count(rest, "/") == 1:
		return lang + "/{part}/{chapter}"
	}
	return lang + "/{path}"
}

// langOf returns the language prefix of p ("/en" or "/zh"), or "" when p is
// outside both language trees.
func langOf(p string) string {
	for _, l := range []string{"/en", "/zh"} {
		if p == l || strings.HasPrefix(p, l+"/") {
			return l
		}
	}
	return ""
}

// resolves reports whether serveStatic answers name, a path without its
// leading slash, with a page or a canonicalizing redirect instead of the
// fallback to the site entrypoint. It follows serveStatic's lookups: the
// directory form serves its index or points at the page file, the file form
// tries the name, then name.html, then points at the directory index.
func resolves(name string) bool {
	// writeFile never serves a precompressed sibling by its own name.
	if strings.HasSuffix(name, ".gz") {
		return false
	}
	if name == "" || strings.HasSuffix(name, "/") {
		trimmed := strings.TrimSuffix(name, "/")
		return exists(name+"index.html") ||
			(trimmed != "" && (exists(trimmed) || exists(trimmed+".html")))
	}
	return exists(name) || exists(name+".html") || exists(name+"/index.html")
}
