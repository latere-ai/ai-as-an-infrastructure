// The HTML-to-Markdown converter behind every page's Markdown twin. Each case
// feeds a fragment shaped like the pipeline's own output (KaTeX, figure
// modules, callouts, runnable cells, tables) and checks the Markdown structure
// that comes back: TeX delimiters, alert blockquotes, GFM tables, fenced code,
// absolute links. The fragments are fixtures, not book prose.

import { test, expect } from "bun:test";
import { htmlToMarkdown, parseHtml, textContent, type HtmlElement } from "./html-markdown.ts";

const PAGE = "https://aaai.latere.ai/en/part/chapter";
const md = (html: string, lang: "en" | "zh" = "en") => htmlToMarkdown(html, { pageUrl: PAGE, origin: "https://aaai.latere.ai", lang });

const katex = (tex: string, display = false) =>
  `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"${display ? ' display="block"' : ""}>` +
  `<semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>` +
  `<span class="katex-html" aria-hidden="true"><span class="base"><span class="mord mathnormal">x</span></span></span></span>`;

test("the parser nests elements, reads single-quoted attributes, and decodes entities", () => {
  const [p] = parseHtml(`<p class='katex-block' id="a">x &lt; y &amp;&amp; &ldquo;z&rdquo; &#x27;w&#39;<br>tail</p>`) as HtmlElement[];
  expect(p.tag).toBe("p");
  expect(p.attrs).toEqual({ class: "katex-block", id: "a" });
  expect(textContent(p)).toBe("x < y && \u201cz\u201d 'w'tail");
  expect((p.children[1] as HtmlElement).tag).toBe("br");
});

test("inline SVG is skipped whole, nested SVG included", () => {
  const nodes = parseHtml(`<div><svg><svg><text>inner</text></svg><text>outer</text></svg><p>after</p></div>`);
  expect(textContent(nodes[0])).toBe("after");
});

test("inline and display math come back as TeX from the KaTeX annotation", () => {
  const out = md(`<p>Given ${katex("x_{&lt;t}")}, the loss is</p>\n<p class='katex-block'><span class="katex-display">${katex("a&amp;=b\\\\\nc&amp;=d\n", true)}</span></p>`);
  expect(out).toContain("Given $x_{<t}$, the loss is");
  expect(out).toContain("$$\na&=b\\\\\nc&=d\n$$");
  expect(out).not.toContain("katex");
  // A source line break inside inline math stays inside the paragraph.
  expect(md(`<p>rate ${katex("a =\n  0.05")} here</p>`)).toBe("rate $a = 0.05$ here\n");
});

test("a figure becomes its numbered caption linked to the figure on the page", () => {
  const out = md(`<figure class="rdr-figure rdr-fig" id="fig-a"><div class="fig" data-figure="f"><div class="fig-static"><svg viewBox="0 0 1 1"><text>tick</text></svg></div></div>` +
    `<figcaption><span class="rdr-fig-num">Figure 3.2.</span> Loss ${katex("L")} against compute (<a href="/en/references#ref-k" class="rdr-cite">Kaplan et al. 2020</a>).</figcaption></figure>`);
  // A link cannot hold a link, so the citation inside the caption keeps its text.
  expect(out).toBe(`[Figure 3.2: Loss $L$ against compute (Kaplan et al. 2020).](${PAGE}#fig-a)\n`);
});

test("a Chinese figure caption joins its number with a full-width colon", () => {
  const out = md(`<figure class="rdr-figure" id="fig-b"><div class="rdr-diagram"><svg></svg></div><figcaption><span class="rdr-fig-num">图 3.2.</span> 说明</figcaption></figure>`, "zh");
  expect(out).toBe(`[图 3.2：说明](${PAGE}#fig-b)\n`);
});

test("a callout becomes an alert blockquote carrying its kind and title", () => {
  const out = md(`<div class="rdr-block rdr-callout rdr-callout-tip">\n<div class="rdr-callout-title" data-label="Tip">Title</div>\n<p>Body one.</p>\n<p>Body two.</p>\n</div>`);
  expect(out).toBe("> [!TIP]\n> **Title**\n>\n> Body one.\n>\n> Body two.\n");
});

test("tables become GFM tables with pipes escaped and alignment kept", () => {
  const out = md(`<table><thead><tr><th>A</th><th style="text-align:right">B</th></tr></thead><tbody><tr><td>a | b</td><td><code>x|y</code></td></tr></tbody></table>`);
  expect(out).toBe("| A | B |\n| --- | ---: |\n| a \\| b | `x\\|y` |\n");
});

test("code blocks keep their language, and a runnable cell is a fenced block", () => {
  const out = md(`<div class="rdr-block rdr-runnable runnable">\n<pre><code class="language-python"><span class="lt-kw">print</span>(<span class="lt-str">"a&lt;b"</span>)\n</code></pre>\n</div>`);
  expect(out).toBe('```python\nprint("a<b")\n```\n');
});

test("a code block holding backtick fences gets a longer fence", () => {
  const out = md("<pre><code>```\nx\n```\n</code></pre>");
  expect(out).toBe("````\n```\nx\n```\n````\n");
});

test("every link becomes absolute", () => {
  const out = md(`<p><a href="/en/other#sec-x" class="rdr-xref">Chapter 2</a> <a href="#fig-a">Figure 1</a> <a href="https://example.org/a_(b)">ext</a> <a href="mailto:a@b.c">mail</a></p>`);
  expect(out).toContain("[Chapter 2](https://aaai.latere.ai/en/other#sec-x)");
  expect(out).toContain(`[Figure 1](${PAGE}#fig-a)`);
  expect(out).toContain("[ext](https://example.org/a_%28b%29)");
  expect(out).toContain("[mail](mailto:a@b.c)");
});

test("headings keep their anchor id and drop the permalink icon", () => {
  const out = md(`<h2 id="a-b">Section <code>x</code><a class="rdr-anchor" href="#a-b" aria-label="Link"><svg></svg></a></h2>`);
  expect(out).toBe("## Section `x` {#a-b}\n");
});

test("lists nest under their items; a block inside an item makes the list loose", () => {
  expect(md(`<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>`)).toBe("- a\n  - b\n- c\n");
  expect(md(`<ol start="3"><li><p>a</p><div>more</div></li><li>b</li></ol>`)).toBe("3. a\n\n   more\n\n4. b\n");
});

test("interactive widgets, controls and inline SVG leave nothing behind", () => {
  const out = md(`<div class="viz" data-viz="x"></div><button>Run</button><svg><path d="M0"/></svg><span aria-hidden="true">icon</span><p>After.</p>`);
  expect(out).toBe("After.\n");
});

test("prose that reads as Markdown syntax is escaped", () => {
  const out = md(`<p>1. costs $5, *not* [x](y), a_b and _c_ &lt;div&gt;</p>`);
  expect(out).toBe("1\\. costs \\$5, \\*not\\* \\[x\\](y), a_b and \\_c\\_ \\<div>\n");
});
