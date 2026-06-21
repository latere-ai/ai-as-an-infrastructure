// Markdown → HTML for chapter bodies. markdown-it core + attributes ({#id} on
// headings/images) + KaTeX math + inline refs/citations + fenced divs (callouts,
// runnable) + diagrams (dot inline SVG, mermaid client-side) + numbered figures.
// Raw {=html} viz blocks pass through verbatim (html:true).

import MarkdownIt from "markdown-it";
import attrs from "markdown-it-attrs";
import { katex } from "@mdit/plugin-katex";
import type { Heading } from "../types.ts";
import { inlineRefs } from "./inline-refs.ts";
import type { Bibliography } from "./citations.ts";
import type { CrossrefMap } from "./crossref.ts";
import { resolveXrefsInText } from "./crossref.ts";
import { renderDot, renderMermaid, type GraphvizInstance } from "./diagrams.ts";
import { expandDivs } from "./divs.ts";
import { highlightCode } from "./highlight.ts";
import type { Glossary } from "./glossary.ts";
import type { Lang } from "../types.ts";

export interface RenderContext {
  bib: Bibliography;
  xref: CrossrefMap;
  currentHref: string;
  prefix: string; // "../" * depth for page-relative hrefs
  graphviz: GraphvizInstance;
  lang: Lang;
  glossary: Glossary;
  glossarySeen: Set<string>; // keys already expanded in THIS chapter (per-chapter first-use)
  glossaryUsed: Set<string>; // keys used anywhere in the book (accumulates; feeds the glossary page)
}

export interface RenderedChapter {
  titleLine: string;
  html: string;
  headings: Heading[];
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w一-鿿\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

// Relative path from a chapter's output file to "<lang>/figures/".
function figPrefix(currentHref: string): string {
  const depth = currentHref.split("/").length - 1;
  return "../".repeat(depth) + "figures/";
}

function createMd(ctx: RenderContext): MarkdownIt {
  // `highlight` colors static code fences (Python) at build time; the default
  // fence renderer (defFence below) invokes it and adds the <pre><code> wrapper.
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false, breaks: false, highlight: highlightCode });
  md.use(attrs, { allowedAttributes: ["id", "class", /^data-/] });
  md.use(katex);
  md.use(inlineRefs, { bib: ctx.bib, xref: ctx.xref, currentHref: ctx.currentHref, prefix: ctx.prefix, lang: ctx.lang, glossary: ctx.glossary, glossarySeen: ctx.glossarySeen, glossaryUsed: ctx.glossaryUsed });

  // Diagram fences: ```{dot}``` and ```{mermaid}```.
  const defFence = md.renderer.rules.fence!.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const info = tokens[idx].info.trim();
    // Fences are renamed to bare tokens before parsing (markdown-it-attrs strips
    // {dot}/{mermaid}/{=html} curly infos), so match the renamed forms.
    if (info === "rdrhtml") return tokens[idx].content; // Pandoc raw HTML block
    if (info === "rdrdot" || info === "dot") return renderDot(ctx.graphviz, tokens[idx].content, ctx.xref, ctx.currentHref, ctx.prefix);
    if (info === "rdrmermaid" || info === "mermaid") return renderMermaid(tokens[idx].content, ctx.xref, ctx.currentHref, ctx.prefix);
    return defFence(tokens, idx, options, env, self);
  };
  return md;
}

function splitTitle(src: string): { titleLine: string; body: string } {
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("# ")) {
      const titleLine = lines[i];
      lines.splice(i, 1);
      return { titleLine, body: lines.join("\n") };
    }
  }
  return { titleLine: "", body: src };
}

function collectHeadings(md: MarkdownIt, body: string): { headings: Heading[]; tokens: ReturnType<MarkdownIt["parse"]> } {
  const tokens = md.parse(body, {});
  const headings: Heading[] = [];
  let inCallout = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // skip headings that live inside a callout/runnable wrapper (html_block divs)
    if (tok.type === "html_block" && /class="[^"]*rdr-callout/.test(tok.content)) inCallout++;
    if (tok.type !== "heading_open") continue;
    const level = Number(tok.tag.slice(1));
    if (level !== 2 && level !== 3) continue;
    const text = tokens[i + 1]?.content ?? "";
    let id = tok.attrGet("id");
    if (!id) { id = slugify(text); tok.attrSet("id", id); }
    headings.push({ id, text: text.replace(/\[@[^\]]+\]/g, "").replace(/@[a-z]+-[a-z0-9-]+/g, "").trim(), level });
  }
  return { headings, tokens };
}

// Wrap standalone figure images in <figure> with a numbered caption, and rewrite
// /figures/ and figures/ paths to the chapter-relative prefix.
function postProcess(html: string, ctx: RenderContext): string {
  const prefix = figPrefix(ctx.currentHref);
  html = html.replace(/src="\/?figures\//g, `src="${prefix}`);
  // <p>…<img … id="fig-x" … alt="cap" …>…</p>  →  <figure>…<figcaption>
  return html.replace(/<p>\s*(<img\b[^>]*\bid="(fig-[^"]+)"[^>]*>)\s*<\/p>/g, (_m, img: string, id: string) => {
    const alt = img.match(/\balt="([^"]*)"/)?.[1] ?? "";
    const num = ctx.xref.get(id)?.label ?? "";
    const numPart = num ? `<span class="rdr-fig-num">${num}.</span> ` : "";
    const altHtml = alt ? resolveXrefsInText(alt, ctx.xref, ctx.currentHref, ctx.prefix) : "";
    const caption = alt || num ? `<figcaption>${numPart}${altHtml}</figcaption>` : "";
    return `<figure class="rdr-figure" id="${id}">${img}${caption}</figure>`;
  });
}

export function renderMarkdown(src: string, ctx: RenderContext): RenderedChapter {
  const md = createMd(ctx);
  const { titleLine, body } = splitTitle(src);
  // Rename curly diagram fences to bare language tokens so markdown-it-attrs
  // leaves the info intact for our fence renderer.
  const normalized = body.replace(/^(`{3,})\{(dot|mermaid)\}[ \t]*$/gm, (_m, ticks, kind) => `${ticks}rdr${kind}`);
  const expanded = expandDivs(normalized);
  const { headings, tokens } = collectHeadings(md, expanded);
  const html = postProcess(md.renderer.render(tokens, (md as any).options, {}), ctx);
  return { titleLine, html, headings };
}
