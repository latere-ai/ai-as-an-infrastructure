// Compiled chapter HTML to Markdown, for the Markdown twin of every page. The
// input is the article body the reader renders (ChapterData.contentHtml), after
// cross-references, citations and glossary links are resolved, so the twin says
// what the page says without re-reading the .qmd source. The output is plain
// GFM an agent can read out of context: math as TeX, figures as their numbered
// caption linked to the live page, callouts as alert blockquotes, and every
// link absolute. Widgets, inline SVG and reader chrome are dropped.
//
// The input comes from the book's own pipeline (markdown-it, KaTeX, the figure
// and diagram renderers), so a small tolerant parser covers it; an element the
// converter does not know is unwrapped and reported once, so new markup shows
// up in the build log instead of leaking into the twin.

import type { Lang } from "../types.ts";

export interface HtmlElement {
  tag: string; // lowercased
  attrs: Record<string, string>;
  children: HtmlNode[];
}

export type HtmlNode = HtmlElement | string; // a string is decoded text

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", middot: "\u00b7", times: "\u00d7",
};

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e] ?? m;
  });
}

const START_TAG = /<([A-Za-z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const END_TAG = /<\/([A-Za-z][\w:-]*)\s*>/y;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of src.matchAll(ATTR)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

// Index just past the </svg> that closes an <svg> opened before `from`,
// counting nested <svg> elements. Inline SVG is never converted, so its
// content is skipped rather than parsed.
function skipSvg(html: string, from: number): number {
  const re = /<(\/?)svg\b[^>]*?(\/?)>/gi;
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) depth--;
    else if (!m[2]) depth++;
    if (depth === 0) return re.lastIndex;
  }
  return html.length;
}

// Parse an HTML fragment into a tree. Tolerant: an end tag with no open match
// is ignored, one that closes an outer element closes the inner ones too, and
// a "<" that starts no tag is text.
export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { tag: "#root", attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const top = () => stack[stack.length - 1];
  const text = (s: string) => { if (s) top().children.push(decodeEntities(s)); };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) { text(html.slice(i)); break; }
    text(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    END_TAG.lastIndex = lt;
    const end = END_TAG.exec(html);
    if (end) {
      const tag = end[1].toLowerCase();
      const at = stack.findLastIndex((e) => e.tag === tag);
      if (at > 0) stack.length = at;
      i = END_TAG.lastIndex;
      continue;
    }
    START_TAG.lastIndex = lt;
    const start = START_TAG.exec(html);
    if (!start) { text("<"); i = lt + 1; continue; }
    const el: HtmlElement = { tag: start[1].toLowerCase(), attrs: parseAttrs(start[2]), children: [] };
    top().children.push(el);
    i = START_TAG.lastIndex;
    if (start[3] || VOID.has(el.tag)) continue;
    if (el.tag === "svg") { i = skipSvg(html, i); continue; }
    if (RAW_TEXT.has(el.tag)) {
      const close = html.toLowerCase().indexOf(`</${el.tag}`, i);
      const stop = close < 0 ? html.length : close;
      el.children.push(html.slice(i, stop));
      i = close < 0 ? html.length : html.indexOf(">", close) + 1 || html.length;
      continue;
    }
    stack.push(el);
  }
  return root.children;
}

// ---------------------------------------------------------------------------
// Tree helpers

const isEl = (n: HtmlNode): n is HtmlElement => typeof n !== "string";
const hasClass = (el: HtmlElement, cls: string) => (el.attrs.class ?? "").split(/\s+/).includes(cls);

export function textContent(n: HtmlNode): string {
  return typeof n === "string" ? n : n.children.map(textContent).join("");
}

function find(n: HtmlNode, pred: (el: HtmlElement) => boolean): HtmlElement | null {
  if (!isEl(n)) return null;
  if (pred(n)) return n;
  for (const c of n.children) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return null;
}

// The TeX source KaTeX keeps in its MathML annotation.
function texOf(el: HtmlElement): string | null {
  const ann = find(el, (e) => e.tag === "annotation" && e.attrs.encoding === "application/x-tex");
  return ann ? textContent(ann).trim() : null;
}

// ---------------------------------------------------------------------------
// Conversion

export interface MarkdownOptions {
  pageUrl: string; // absolute URL of the page the HTML belongs to
  origin: string; // site origin that root-relative links hang off
  lang: Lang;
  headingShift?: number; // added to every heading level
}

interface Ctx {
  opts: MarkdownOptions;
  inLink: boolean; // link text cannot hold another link
  inTable: boolean; // cell text cannot hold a pipe or a line break
}

const BLOCK = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "pre", "blockquote", "table",
  "thead", "tbody", "tfoot", "tr", "figure", "figcaption", "hr", "dl", "dt", "dd", "section",
  "article", "aside", "nav", "header", "footer", "main", "details", "summary",
]);

// Interactive or decorative elements with no text worth carrying.
const DROP = new Set([
  "svg", "script", "style", "button", "input", "select", "textarea", "canvas", "iframe", "form",
  "noscript", "template", "video", "audio", "object", "embed", "math",
]);

// Inline elements whose content passes through without markup.
const PASS = new Set(["span", "sup", "sub", "small", "abbr", "cite", "q", "u", "mark", "kbd", "var", "samp", "dfn", "time", "label"]);

const CALLOUT_KINDS = ["note", "tip", "important", "warning", "caution"];

const warned = new Set<string>();
function warnOnce(tag: string) {
  if (warned.has(tag)) return;
  warned.add(tag);
  console.warn(`  markdown twin: no rule for <${tag}>, kept its text`);
}

function dropped(el: HtmlElement): boolean {
  return DROP.has(el.tag) || el.attrs["aria-hidden"] === "true";
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

// Escape prose text so Markdown reads it literally. Code and math never pass
// through here. Intraword underscores stay bare (GFM ignores them).
function escapeText(s: string, ctx: Ctx): string {
  let out = s
    .replace(/[\\`*[\]$]/g, "\\$&")
    .replace(/<(?=[A-Za-z/!?])/g, "\\<")
    .replace(/_/g, (_m, off: number, str: string) => (isWordChar(str[off - 1]) && isWordChar(str[off + 1]) ? "_" : "\\_"));
  if (ctx.inTable) out = out.replace(/\|/g, "\\|");
  return out;
}

// Escape a plain string for use as Markdown inline text.
export function markdownText(s: string): string {
  return escapeText(s, { opts: { pageUrl: "", origin: "", lang: "en" }, inLink: false, inTable: false });
}

// A paragraph whose first characters would start a heading, quote, list or
// rule gets that character escaped.
function escapeLineStart(s: string): string {
  return s
    .replace(/^(#{1,6})(?=\s|$)/, "\\$1")
    .replace(/^([>+=-])/, "\\$1")
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, "$1\\$2");
}

function absoluteUrl(href: string, opts: MarkdownOptions): string {
  let url: string;
  if (/^(https?:|mailto:)/i.test(href)) url = href;
  else if (href.startsWith("#")) url = opts.pageUrl.replace(/#.*$/, "") + href;
  else if (href.startsWith("//")) url = "https:" + href;
  else if (href.startsWith("/")) url = opts.origin + href;
  else url = new URL(href, opts.pageUrl).href;
  return url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/</g, "%3C").replace(/>/g, "%3E");
}

function codeSpan(text: string, ctx: Ctx): string {
  let body = text.replace(/\s*\n\s*/g, " ");
  if (ctx.inTable) body = body.replace(/\|/g, "\\|");
  let n = 1;
  const runs = new Set((body.match(/`+/g) ?? []).map((r) => r.length));
  while (runs.has(n)) n++;
  const fence = "`".repeat(n);
  const pad = body.startsWith("`") || body.endsWith("`") || (/^ .*\S.* $/.test(body)) ? " " : "";
  return fence + pad + body + pad + fence;
}

// Wrap inline text in an emphasis marker, keeping edge whitespace outside it.
function emphasize(mark: string, inner: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
}

function inline(nodes: HtmlNode[], ctx: Ctx): string {
  return nodes.map((n) => inlineNode(n, ctx)).join("");
}

function inlineNode(n: HtmlNode, ctx: Ctx): string {
  if (typeof n === "string") return escapeText(n.replace(/[ \t\r\n\f]+/g, " "), ctx);
  if (dropped(n)) return "";
  // Inline TeX keeps to one line: a source line break inside $...$ would
  // otherwise split the paragraph.
  if (n.tag === "span" && hasClass(n, "katex-display")) {
    const tex = texOf(n);
    return tex === null ? "" : `$$${tex.replace(/\s*\n\s*/g, " ")}$$`;
  }
  if (n.tag === "span" && hasClass(n, "katex")) {
    const tex = texOf(n);
    return tex === null ? "" : `$${tex.replace(/\s*\n\s*/g, " ")}$`;
  }
  switch (n.tag) {
    case "a": return link(n, ctx);
    case "strong": case "b": return emphasize("**", inline(n.children, ctx));
    case "em": case "i": return emphasize("*", inline(n.children, ctx));
    case "del": case "s": case "strike": return emphasize("~~", inline(n.children, ctx));
    case "code": return codeSpan(textContent(n), ctx);
    case "br": return ctx.inTable ? " " : "\\\n";
    case "img": return image(n, ctx);
  }
  if (n.tag === "span" && (hasClass(n, "rdr-ref-key") || hasClass(n, "rdr-gls-term"))) return emphasize("**", inline(n.children, ctx));
  if (n.tag === "span" && hasClass(n, "rdr-gls-alt")) {
    const alt = inline(n.children, ctx).trim();
    return alt ? `(${alt})` : "";
  }
  if (!PASS.has(n.tag) && !BLOCK.has(n.tag)) warnOnce(n.tag);
  return inline(n.children, ctx);
}

function link(el: HtmlElement, ctx: Ctx): string {
  if (hasClass(el, "rdr-anchor")) return ""; // the heading's own permalink icon
  const text = inline(el.children, { ...ctx, inLink: true }).trim();
  const href = el.attrs.href;
  if (ctx.inLink || !href || !text) return text;
  return `[${text}](${absoluteUrl(href, ctx.opts)})`;
}

function image(el: HtmlElement, ctx: Ctx): string {
  const src = el.attrs.src;
  if (!src) return "";
  const alt = escapeText(el.attrs.alt ?? "", ctx);
  return ctx.inLink ? alt : `![${alt}](${absoluteUrl(src, ctx.opts)})`;
}

// Collapse the inline run of a paragraph to one line of Markdown.
function paragraph(nodes: HtmlNode[], ctx: Ctx): string {
  const s = inline(nodes, ctx)
    .replace(/ {2,}/g, " ")
    .replace(/ *\\\n */g, "\\\n")
    .replace(/^(?:\s|\\\n)+|(?:\s|\\\n)+$/g, "");
  return s ? escapeLineStart(s) : "";
}

// Render a sequence of nodes as Markdown blocks. Runs of inline nodes between
// block elements become paragraphs.
function blocks(nodes: HtmlNode[], ctx: Ctx): string[] {
  const out: string[] = [];
  let run: HtmlNode[] = [];
  const flush = () => {
    const p = paragraph(run, ctx);
    if (p) out.push(p);
    run = [];
  };
  for (const n of nodes) {
    if (isEl(n) && BLOCK.has(n.tag) && !dropped(n)) {
      flush();
      const b = block(n, ctx);
      if (b.trim()) out.push(b);
    } else {
      run.push(n);
    }
  }
  flush();
  return out;
}

function block(el: HtmlElement, ctx: Ctx): string {
  const tag = el.tag;
  if (/^h[1-6]$/.test(tag)) return heading(el, ctx);
  switch (tag) {
    case "p": return hasClass(el, "katex-block") ? displayMath(el) : paragraph(el.children, ctx);
    case "pre": return codeBlock(el);
    case "ul": return list(el, false, ctx);
    case "ol": return list(el, true, ctx);
    case "blockquote": return quote(blocks(el.children, ctx).join("\n\n"));
    case "table": return table(el, ctx);
    case "figure": return figure(el, ctx);
    case "hr": return "* * *";
    case "dt": case "summary": return emphasize("**", paragraph(el.children, ctx));
  }
  if (tag === "div" && hasClass(el, "rdr-callout")) return callout(el, ctx);
  if (tag === "div" && hasClass(el, "rdr-refs")) return itemList(el.children.filter(isEl), "-", ctx);
  return blocks(el.children, ctx).join("\n\n");
}

function heading(el: HtmlElement, ctx: Ctx): string {
  const level = Math.min(6, Number(el.tag[1]) + (ctx.opts.headingShift ?? 0));
  const text = paragraph(el.children, ctx).replace(/\\\n/g, " ");
  if (!text) return "";
  const id = el.attrs.id ? ` {#${el.attrs.id}}` : "";
  return `${"#".repeat(level)} ${text}${id}`;
}

function displayMath(el: HtmlElement): string {
  const tex = texOf(el);
  return tex === null ? "" : `$$\n${tex}\n$$`;
}

function codeBlock(pre: HtmlElement): string {
  const code = pre.children.find((c): c is HtmlElement => isEl(c) && c.tag === "code") ?? pre;
  const lang = /(?:^|\s)language-([\w+#.-]+)/.exec(code.attrs.class ?? "")?.[1] ?? "";
  const text = textContent(code).replace(/\n+$/, "");
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${text}\n${fence}`;
}

function indent(s: string, pad: string): string {
  return s.split("\n").map((line, i) => (i === 0 || !line ? line : pad + line)).join("\n");
}

function quote(s: string): string {
  return s.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
}

// A list item's blocks: a nested list follows its lead line directly, other
// blocks are separated by a blank line.
function itemBody(nodes: HtmlNode[], ctx: Ctx): string {
  const parts = blocks(nodes, ctx);
  return parts.reduce((acc, b, i) => (i === 0 ? b : acc + (/^(-|\d+\.) /.test(b) ? "\n" : "\n\n") + b), "");
}

function itemList(items: HtmlElement[], marker: string | number, ctx: Ctx): string {
  const rendered: string[] = [];
  let n = typeof marker === "number" ? marker : 0;
  for (const item of items) {
    const body = itemBody(item.children, ctx);
    if (!body) continue;
    const m = typeof marker === "number" ? `${n++}.` : marker;
    rendered.push(`${m} ${indent(body, " ".repeat(m.length + 1))}`);
  }
  const loose = rendered.some((r) => r.includes("\n\n"));
  return rendered.join(loose ? "\n\n" : "\n");
}

function list(el: HtmlElement, ordered: boolean, ctx: Ctx): string {
  const items = el.children.filter((c): c is HtmlElement => isEl(c) && c.tag === "li");
  const start = Number.parseInt(el.attrs.start ?? "1", 10);
  return itemList(items, ordered ? (Number.isFinite(start) ? start : 1) : "-", ctx);
}

function table(el: HtmlElement, ctx: Ctx): string {
  const rows: HtmlElement[] = [];
  const collect = (n: HtmlElement) => {
    for (const c of n.children) {
      if (!isEl(c)) continue;
      if (c.tag === "tr") rows.push(c);
      else if (c.tag === "thead" || c.tag === "tbody" || c.tag === "tfoot") collect(c);
    }
  };
  collect(el);
  if (!rows.length) return "";
  const cellCtx = { ...ctx, inTable: true };
  const cellsOf = (tr: HtmlElement) => tr.children.filter((c): c is HtmlElement => isEl(c) && (c.tag === "td" || c.tag === "th"));
  const render = (cell: HtmlElement) => blocks(cell.children, cellCtx).join(" ").replace(/\\?\n+/g, " ").trim();
  const width = Math.max(...rows.map((r) => cellsOf(r).length));
  const line = (cells: string[]) => `| ${[...cells, ...Array(width - cells.length).fill("")].join(" | ")} |`;
  const head = cellsOf(rows[0]);
  const align = Array.from({ length: width }, (_, k) => {
    const a = /text-align:\s*(left|right|center)/.exec(head[k]?.attrs.style ?? "")?.[1];
    return a === "right" ? "---:" : a === "center" ? ":---:" : a === "left" ? ":---" : "---";
  });
  return [line(head.map(render)), `| ${align.join(" | ")} |`, ...rows.slice(1).map((r) => line(cellsOf(r).map(render)))].join("\n");
}

// A figure becomes its numbered caption, linked to the figure on the live
// page: the SVG, diagram or widget itself does not survive as text. Links in
// the caption keep their text only, since link text cannot hold a link.
function figure(el: HtmlElement, ctx: Ctx): string {
  const cap = find(el, (e) => e.tag === "figcaption");
  let num = "", caption = "";
  if (cap) {
    const numEl = cap.children.find((c): c is HtmlElement => isEl(c) && hasClass(c, "rdr-fig-num"));
    num = numEl ? textContent(numEl).trim().replace(/[.:。：]$/, "") : "";
    caption = paragraph(cap.children.filter((c) => c !== numEl), { ...ctx, inLink: true }).replace(/\\\n/g, " ");
  }
  const sep = ctx.opts.lang === "zh" ? "：" : ": ";
  const label = num && caption ? `${num}${sep}${caption}` : num || caption;
  if (!label) return "";
  const id = el.attrs.id;
  if (!id || ctx.inLink) return emphasize("*", label);
  return `[${label}](${absoluteUrl(`#${id}`, ctx.opts)})`;
}

// A callout becomes a GitHub alert blockquote: the kind marker, the callout's
// title in bold, then its body.
function callout(el: HtmlElement, ctx: Ctx): string {
  const cls = (el.attrs.class ?? "").split(/\s+/);
  const kind = CALLOUT_KINDS.find((k) => cls.includes(`rdr-callout-${k}`)) ?? "note";
  const titleEl = el.children.find((c): c is HtmlElement => isEl(c) && hasClass(c, "rdr-callout-title"));
  const title = titleEl ? paragraph(titleEl.children, ctx) : "";
  const body = blocks(el.children.filter((c) => c !== titleEl), ctx).join("\n\n");
  const head = [`[!${kind.toUpperCase()}]`, ...(title ? [emphasize("**", title)] : [])].join("\n");
  return quote(body ? `${head}\n\n${body}` : head);
}

export function htmlToMarkdown(html: string, opts: MarkdownOptions): string {
  const ctx: Ctx = { opts, inLink: false, inTable: false };
  return blocks(parseHtml(html), ctx).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
