package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"

	"latere.ai/x/pkg/agentweb"
)

// agentIndexFile is the page index the build writes at the root of the book:
// every page in reading order, with its Markdown twin and its other-language
// version. Every agent-facing document is generated from it.
const agentIndexFile = "agentweb.json"

// agentDocs serves the documents generated from the page index, keyed by
// their literal paths: robots.txt, sitemap.xml, and each language's llms.txt
// and llms-full.txt. Set in run(). Nil, as in the routing tests that call
// serve directly, leaves those paths to the static tree, where no such file
// exists.
var agentDocs map[string]http.Handler

// agentPages is serve wrapped in Markdown negotiation, set in run(): a page
// requested with Accept: text/markdown is answered with its twin, and every
// page response names the twin in a Link header. Nil serves pages as HTML
// only.
var agentPages http.Handler

// edition is one language edition's title, summary, and the heading over the
// pages outside any part. The build writes them into the page index beside
// the fields the agentweb package decodes, which ignores them, so the Chinese
// llms.txt is written in Chinese throughout.
type edition struct {
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	DefaultSection string `json:"defaultSection"`
}

// llmsRoots are the language trees, each with an llms.txt and llms-full.txt
// at its root. An llms.txt covers the pages under the path it is served from,
// so English, the default language, is at the site root and Chinese under
// /zh/.
var llmsRoots = []struct{ lang, prefix string }{
	{"en", ""},
	{"zh", "/zh"},
}

// loadAgentWeb reads the page index from tree and builds the agent-facing
// handlers: the generated documents, and serve wrapped in Markdown
// negotiation. Every document is rendered and every twin read here, so a
// missing or invalid index, or a twin the index names but the build did not
// write, fails at startup rather than on the first crawl.
func loadAgentWeb(tree fs.FS) (map[string]http.Handler, http.Handler, error) {
	raw, err := fs.ReadFile(tree, agentIndexFile)
	if err != nil {
		return nil, nil, fmt.Errorf("read the page index: %w", err)
	}
	idx, err := agentweb.ParseIndex(raw)
	if err != nil {
		return nil, nil, err
	}
	var ext struct {
		Editions map[string]edition `json:"editions"`
	}
	if err := json.Unmarshal(raw, &ext); err != nil {
		return nil, nil, fmt.Errorf("decode the editions in the page index: %w", err)
	}

	docs := map[string]http.Handler{}

	// Search and answering from the book are welcome; training is refused.
	// The policy text states what each signal means and makes the refusal a
	// reservation of rights under Article 4 of EU Directive 2019/790.
	robots, err := agentweb.RobotsHandler(agentweb.Robots{
		Policy: true,
		Groups: []agentweb.Group{{
			UserAgents: []string{"*"},
			Signals:    agentweb.Signals{Search: agentweb.Yes, AIInput: agentweb.Yes, AITrain: agentweb.No},
			Allow:      []string{"/"},
		}},
		Sitemaps: []string{idx.URL("/sitemap.xml")},
	})
	if err != nil {
		return nil, nil, err
	}
	docs["/robots.txt"] = robots

	// The Chinese pages declare zh-Hans in their HTML, and the sitemap names
	// them the same way. English is the version for readers of any other
	// language.
	sitemap, err := agentweb.SitemapHandler(idx, agentweb.SitemapOptions{
		HrefLang: map[string]string{"zh": "zh-Hans"},
		XDefault: "en",
	})
	if err != nil {
		return nil, nil, err
	}
	docs["/sitemap.xml"] = sitemap

	describedBy := map[string]string{}
	for _, root := range llmsRoots {
		ed := ext.Editions[root.lang]
		if ed.Title == "" || ed.Summary == "" || ed.DefaultSection == "" {
			return nil, nil, fmt.Errorf("the page index lacks the title, summary, or default section of the %s edition", root.lang)
		}
		opts := agentweb.LLMsOptions{Lang: root.lang, Title: ed.Title, Summary: ed.Summary, DefaultSection: ed.DefaultSection}
		llms, err := agentweb.LLMsTxtHandler(idx, opts)
		if err != nil {
			return nil, nil, fmt.Errorf("%s llms.txt: %w", root.lang, err)
		}
		full, err := agentweb.LLMsFullHandler(idx, agentweb.FSOpener(tree), opts)
		if err != nil {
			return nil, nil, fmt.Errorf("%s llms-full.txt: %w", root.lang, err)
		}
		docs[root.prefix+"/llms.txt"] = llms
		docs[root.prefix+"/llms-full.txt"] = full
		describedBy[root.lang] = root.prefix + "/llms.txt"
	}

	// The handlers send agentweb.DefaultCacheControl (five minutes, then a
	// 304 against the ETag), which lets Cloudflare answer repeated fetches of
	// the multi-megabyte llms-full.txt without reaching the pod.

	pages, err := agentweb.Negotiate(http.HandlerFunc(serve), idx, agentweb.NegotiateOptions{
		DescribedBy: func(p agentweb.Page) string { return describedBy[p.Lang] },
	})
	if err != nil {
		return nil, nil, err
	}
	return docs, pages, nil
}
