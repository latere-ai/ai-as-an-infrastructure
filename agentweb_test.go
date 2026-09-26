package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"encoding/xml"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"latere.ai/x/pkg/agentweb"
)

// browserAccept is the Accept header a browser sends for a navigation.
const browserAccept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

// installAgentWeb loads the agent-facing handlers from the built book, as run
// does, for the duration of one test.
func installAgentWeb(t *testing.T) {
	t.Helper()
	requireBook(t)
	docs, pages, err := loadAgentWeb(book)
	if err != nil {
		t.Fatalf("load the agent-facing handlers: %v", err)
	}
	prevDocs, prevPages := agentDocs, agentPages
	t.Cleanup(func() { agentDocs, agentPages = prevDocs, prevPages })
	agentDocs, agentPages = docs, pages
}

// agentServer serves the full handler, negotiation included, and returns its
// URL and a client that does not follow redirects.
func agentServer(t *testing.T) (string, *http.Client) {
	t.Helper()
	installAgentWeb(t)
	srv := httptest.NewServer(newHandler())
	t.Cleanup(srv.Close)
	return srv.URL, &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
}

// fetch sends a GET with the given headers and returns the response with its
// body read, undecoded.
func fetch(t *testing.T, c *http.Client, url string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("request %s: %v", url, err)
	}
	// Set by hand so the client neither asks for nor decodes gzip on its own.
	req.Header.Set("Accept-Encoding", "identity")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	body, err := io.ReadAll(resp.Body)
	if cerr := resp.Body.Close(); cerr != nil {
		t.Errorf("close %s: %v", url, cerr)
	}
	if err != nil {
		t.Fatalf("read %s: %v", url, err)
	}
	return resp, body
}

// headerTokens returns the comma-separated tokens of every value of a header.
func headerTokens(h http.Header, name string) []string {
	var out []string
	for _, v := range h.Values(name) {
		for tok := range strings.SplitSeq(v, ",") {
			out = append(out, strings.TrimSpace(tok))
		}
	}
	return out
}

func hasToken(h http.Header, name, want string) bool {
	for _, tok := range headerTokens(h, name) {
		if strings.EqualFold(tok, want) {
			return true
		}
	}
	return false
}

// builtIndex decodes the built page index with the editions the server reads
// beside it.
func builtIndex(t *testing.T) (*agentweb.Index, map[string]edition) {
	t.Helper()
	raw, err := fs.ReadFile(book, agentIndexFile)
	if err != nil {
		t.Fatal(err)
	}
	idx, err := agentweb.ParseIndex(raw)
	if err != nil {
		t.Fatal(err)
	}
	var ext struct {
		Editions map[string]edition `json:"editions"`
	}
	if err := json.Unmarshal(raw, &ext); err != nil {
		t.Fatal(err)
	}
	return idx, ext.Editions
}

func readBook(t *testing.T, name string) []byte {
	t.Helper()
	b, err := fs.ReadFile(book, name)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// The server writes robots.txt and sitemap.xml from the page index. A copy
// left in the build output would be served in their place whenever the
// handlers are not installed, and would pass the route tests for the wrong
// reason.
func TestBuildLeavesRobotsAndSitemapToServer(t *testing.T) {
	requireBook(t)
	for _, name := range []string{"robots.txt", "sitemap.xml"} {
		if exists(name) {
			t.Errorf("the build wrote %s; the server generates it from %s", name, agentIndexFile)
		}
	}
}

// A missing or invalid index must stop the server at startup rather than
// leave the agent-facing paths answering 404.
func TestLoadAgentWebRefusesBadIndex(t *testing.T) {
	index := func(body string) fstest.MapFS {
		return fstest.MapFS{agentIndexFile: &fstest.MapFile{Data: []byte(body)}}
	}
	cases := map[string]fs.FS{
		"missing": fstest.MapFS{},
		"invalid": index(`{"origin": "not a url", "pages": []}`),
		"no zh edition": index(`{
			"origin": "https://aaai.latere.ai", "title": "T", "summary": "S",
			"editions": {"en": {"title": "T", "summary": "S", "defaultSection": "D"}},
			"pages": [{"path": "/en/", "lang": "en", "title": "T"}]}`),
		"no default section": index(`{
			"origin": "https://aaai.latere.ai", "title": "T", "summary": "S",
			"editions": {"en": {"title": "T", "summary": "S"}, "zh": {"title": "T", "summary": "S", "defaultSection": "D"}},
			"pages": [{"path": "/en/", "lang": "en", "title": "T"}]}`),
	}
	for name, tree := range cases {
		if _, _, err := loadAgentWeb(tree); err == nil {
			t.Errorf("%s index: loadAgentWeb succeeded, want an error", name)
		}
	}
}

func TestRobotsTxt(t *testing.T) {
	base, c := agentServer(t)
	resp, body := fetch(t, c, base+"/robots.txt", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/robots.txt => %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("Content-Type %q, want text/plain", ct)
	}
	if cc := resp.Header.Get("Cache-Control"); cc != agentweb.DefaultCacheControl {
		t.Errorf("Cache-Control %q, want the shared default %q", cc, agentweb.DefaultCacheControl)
	}
	text := string(body)
	// The policy text carries the reservation of rights the refused signal
	// relies on.
	if !strings.HasPrefix(text, agentweb.SignalsPolicy) {
		t.Error("robots.txt does not open with the Content Signals policy text")
	}
	for _, want := range []string{
		"\nUser-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=yes\nAllow: /\n",
		"\nSitemap: https://aaai.latere.ai/sitemap.xml\n",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("robots.txt lacks %q:\n%s", want, text[len(agentweb.SignalsPolicy):])
		}
	}
}

func TestSitemap(t *testing.T) {
	base, c := agentServer(t)
	idx, _ := builtIndex(t)
	resp, body := fetch(t, c, base+"/sitemap.xml", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/sitemap.xml => %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/xml") {
		t.Errorf("Content-Type %q, want application/xml", ct)
	}
	var doc struct {
		URLs []struct {
			Loc   string `xml:"loc"`
			Links []struct {
				HrefLang string `xml:"hreflang,attr"`
				Href     string `xml:"href,attr"`
			} `xml:"http://www.w3.org/1999/xhtml link"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(body, &doc); err != nil {
		t.Fatalf("parse sitemap: %v", err)
	}
	if len(doc.URLs) != len(idx.Pages) {
		t.Errorf("sitemap lists %d URLs, the index %d pages", len(doc.URLs), len(idx.Pages))
	}
	locs := map[string]map[string]string{}
	for _, u := range doc.URLs {
		alts := map[string]string{}
		for _, l := range u.Links {
			alts[l.HrefLang] = l.Href
		}
		locs[u.Loc] = alts
	}
	for _, p := range idx.Pages {
		if _, ok := locs[idx.URL(p.Path)]; !ok {
			t.Errorf("sitemap lacks %s", p.Path)
		}
	}
	// Both languages of one chapter carry the same alternates, with Chinese
	// written as zh-Hans and English as the x-default.
	en, zh := idx.URL("/en/foundations/scaling-laws"), idx.URL("/zh/foundations/scaling-laws")
	want := map[string]string{"en": en, "zh-Hans": zh, "x-default": en}
	for _, loc := range []string{en, zh} {
		got := locs[loc]
		if len(got) != len(want) {
			t.Errorf("%s alternates %v, want %v", loc, got, want)
			continue
		}
		for k, v := range want {
			if got[k] != v {
				t.Errorf("%s alternate %s = %q, want %q", loc, k, got[k], v)
			}
		}
	}
}

// Each language's llms.txt is titled in that language, heads the pages
// outside any part in that language, and lists that language's Markdown
// twins, every one of them and no other.
func TestLLMsTxt(t *testing.T) {
	base, c := agentServer(t)
	idx, editions := builtIndex(t)
	for _, root := range llmsRoots {
		resp, body := fetch(t, c, base+root.prefix+"/llms.txt", nil)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s/llms.txt => %d", root.prefix, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
			t.Errorf("%s/llms.txt Content-Type %q", root.prefix, ct)
		}
		text := string(body)
		if first, _, _ := strings.Cut(text, "\n"); first != "# "+editions[root.lang].Title {
			t.Errorf("%s/llms.txt opens with %q, want the %s edition's title", root.prefix, first, root.lang)
		}
		if !strings.Contains(text, "\n## "+editions[root.lang].DefaultSection+"\n") {
			t.Errorf("%s/llms.txt has no %s heading for the pages outside any part", root.prefix, root.lang)
		}
		links := 0
		for _, p := range idx.Pages {
			listed := strings.Contains(text, "]("+idx.URL(p.Markdown)+")")
			if listed != (p.Lang == root.lang) {
				t.Errorf("%s/llms.txt: %s listed=%v", root.prefix, p.Markdown, listed)
			}
			if listed {
				links++
			}
		}
		if links == 0 {
			t.Errorf("%s/llms.txt lists no twin", root.prefix)
		}

		resp, body = fetch(t, c, base+root.prefix+"/llms-full.txt", nil)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s/llms-full.txt => %d", root.prefix, resp.StatusCode)
		}
		sources := 0
		for line := range strings.SplitSeq(string(body), "\n") {
			if src, ok := strings.CutPrefix(line, "Source: "); ok {
				sources++
				if !strings.HasPrefix(src, idx.URL("/"+root.lang+"/")) {
					t.Errorf("%s/llms-full.txt holds %s", root.prefix, src)
				}
			}
		}
		if sources != links {
			t.Errorf("%s/llms-full.txt holds %d pages, llms.txt lists %d", root.prefix, sources, links)
		}
	}
}

// An agent that asks for Markdown at a page's address gets the page's twin,
// with the headers that keep the two representations apart in a cache.
func TestNegotiateMarkdown(t *testing.T) {
	base, c := agentServer(t)
	for _, tc := range []struct{ page, twin, describedBy string }{
		{"/en/foundations/scaling-laws", "/en/foundations/scaling-laws.md", "/llms.txt"},
		{"/en/", "/en/index.md", "/llms.txt"},
		{"/zh/", "/zh/index.md", "/zh/llms.txt"},
	} {
		resp, body := fetch(t, c, base+tc.page, map[string]string{"Accept": "text/markdown"})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s as Markdown => %d", tc.page, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); ct != "text/markdown; charset=utf-8" {
			t.Errorf("%s: Content-Type %q, want text/markdown", tc.page, ct)
		}
		if !hasToken(resp.Header, "Vary", "Accept") {
			t.Errorf("%s: Vary %v lacks Accept", tc.page, resp.Header.Values("Vary"))
		}
		if cl := resp.Header.Get("Content-Location"); cl != tc.twin {
			t.Errorf("%s: Content-Location %q, want %q", tc.page, cl, tc.twin)
		}
		if !hasToken(resp.Header, "Link", "<"+tc.describedBy+">; rel=\"describedby\"") {
			t.Errorf("%s: Link %v lacks the describedby %s", tc.page, resp.Header.Values("Link"), tc.describedBy)
		}
		if !bytes.Equal(body, readBook(t, strings.TrimPrefix(tc.twin, "/"))) {
			t.Errorf("%s: body is not the twin %s", tc.page, tc.twin)
		}
	}
}

// A browser at the same address gets the HTML page, told where the twin is.
func TestNegotiateBrowser(t *testing.T) {
	base, c := agentServer(t)
	for _, accept := range []string{browserAccept, ""} {
		h := map[string]string{}
		if accept != "" {
			h["Accept"] = accept
		}
		resp, body := fetch(t, c, base+"/en/foundations/scaling-laws", h)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Accept %q => %d", accept, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Errorf("Accept %q: Content-Type %q, want text/html", accept, ct)
		}
		if !bytes.Equal(body, readBook(t, "en/foundations/scaling-laws.html")) {
			t.Errorf("Accept %q: body is not the HTML page", accept)
		}
		for _, v := range []string{"Accept", "Accept-Encoding"} {
			if !hasToken(resp.Header, "Vary", v) {
				t.Errorf("Accept %q: Vary %v lacks %s", accept, resp.Header.Values("Vary"), v)
			}
		}
		for _, link := range []string{
			`</en/foundations/scaling-laws.md>; rel="alternate"; type="text/markdown"`,
			`</llms.txt>; rel="describedby"`,
		} {
			if !hasToken(resp.Header, "Link", link) {
				t.Errorf("Accept %q: Link %v lacks %s", accept, resp.Header.Values("Link"), link)
			}
		}
		if resp.Header.Get("Content-Location") != "" {
			t.Errorf("Accept %q: Content-Location set on the HTML response", accept)
		}
	}
}

// A twin requested by its own address is Markdown, compressed for a client
// that accepts gzip, and points search engines at the page.
func TestMarkdownTwinDirect(t *testing.T) {
	base, c := agentServer(t)
	want := readBook(t, "en/foundations/scaling-laws.md")
	for _, gz := range []bool{true, false} {
		enc := "identity"
		if gz {
			enc = "gzip"
		}
		resp, body := fetch(t, c, base+"/en/foundations/scaling-laws.md", map[string]string{"Accept-Encoding": enc})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("gzip=%v => %d", gz, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); ct != "text/markdown; charset=utf-8" {
			t.Errorf("gzip=%v: Content-Type %q, want text/markdown", gz, ct)
		}
		if got := resp.Header.Get("Content-Encoding"); (got == "gzip") != gz {
			t.Errorf("gzip=%v: Content-Encoding %q", gz, got)
		}
		if gz {
			zr, err := gzip.NewReader(bytes.NewReader(body))
			if err != nil {
				t.Fatalf("gzip body: %v", err)
			}
			if body, err = io.ReadAll(zr); err != nil {
				t.Fatalf("gzip body: %v", err)
			}
		}
		if !bytes.Equal(body, want) {
			t.Errorf("gzip=%v: body differs from the twin (%d vs %d bytes)", gz, len(body), len(want))
		}
		if !hasToken(resp.Header, "Link", `<https://aaai.latere.ai/en/foundations/scaling-laws>; rel="canonical"`) {
			t.Errorf("gzip=%v: Link %v lacks the canonical page", gz, resp.Header.Values("Link"))
		}
	}
}
