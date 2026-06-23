// Markdown → HTML for chapter bodies. markdown-it core + attributes ({#id} on
// headings/images) + KaTeX math + inline refs/citations + fenced divs (callouts,
// runnable) + diagrams (dot inline SVG, mermaid client-side) + numbered figures.
// Raw {=html} viz blocks pass through verbatim (html:true).

import MarkdownIt from "markdown-it";
import attrs from "markdown-it-attrs";
import { katex } from "@mdit/plugin-katex";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Heading } from "../types.ts";
import { inlineRefs } from "./inline-refs.ts";
import type { Bibliography } from "./citations.ts";
import type { CrossrefMap } from "./crossref.ts";
import { resolveXrefsInText } from "./crossref.ts";
import { renderDot, renderMermaid, type GraphvizInstance } from "./diagrams.ts";
import { expandDivs } from "./divs.ts";
import { highlightCode } from "./highlight.ts";
import type { Glossary, GlossFirstUseMap } from "./glossary.ts";
import type { Lang } from "../types.ts";

export interface RenderContext {
  bib: Bibliography;
  xref: CrossrefMap;
  currentHref: string;
  chapterTitle: string;
  chapterNum: string;
  prefix: string; // "../" * depth for page-relative hrefs
  graphviz: GraphvizInstance;
  lang: Lang;
  glossary: Glossary;
  glossarySeen: Set<string>; // keys already expanded in THIS chapter (per-chapter first-use)
  glossaryUsed: Set<string>; // keys used anywhere in the book (accumulates; feeds the glossary page)
  glossaryFirstUses: GlossFirstUseMap; // first book occurrence for each used key
}

export interface RenderedChapter {
  titleLine: string;
  html: string;
  headings: Heading[];
}

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w一-鿿\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

// Relative path from a chapter's output file to "<lang>/figures/".
function figPrefix(currentHref: string): string {
  const depth = currentHref.split("/").length - 1;
  return "../".repeat(depth) + "figures/";
}

function attrValue(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localFigureSvgPath(src: string, ctx: RenderContext): string | null {
  if (!/\.svg(?:[?#][^"]*)?$/i.test(src)) return null;
  const cleanSrc = src.split(/[?#]/, 1)[0];
  const match = cleanSrc.match(/(?:^|\/)figures\/([^/]+\.svg)$/i);
  if (!match) return null;
  return join(repoRoot, ctx.lang, "figures", basename(match[1]));
}

function stripSvgPreamble(svg: string): string {
  const withoutXml = svg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  return withoutXml.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "").trim();
}

function namespaceSvgIds(svg: string, prefix: string): string {
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const id of ids) {
    const next = `${prefix}${id}`;
    const escaped = escapeRegExp(id);
    svg = svg
      .replace(new RegExp(`\\bid="${escaped}"`, "g"), `id="${next}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${next})`)
      .replace(new RegExp(`(href|xlink:href)="#${escaped}"`, "g"), `$1="#${next}"`);
  }
  return svg;
}

function addInlineSvgAttrs(svg: string, alt: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let next = attrs.replace(/\s+id="[^"]*"/, "");
    next = /\bclass="/.test(next)
      ? next.replace(/\bclass="([^"]*)"/, `class="rdr-inline-svg $1"`)
      : `${next} class="rdr-inline-svg"`;
    if (!/\brole=/.test(next)) next += ' role="img"';
    if (alt && !/\baria-label=/.test(next) && !/\baria-labelledby=/.test(next)) next += ` aria-label="${alt}"`;
    if (!/\bfocusable=/.test(next)) next += ' focusable="false"';
    return `<svg${next}>`;
  });
}

function inlineLocalSvgFigure(img: string, id: string, alt: string, ctx: RenderContext): string | null {
  const src = attrValue(img, "src");
  if (!src) return null;
  const svgPath = localFigureSvgPath(src, ctx);
  if (!svgPath || !existsSync(svgPath)) return null;
  const svg = stripSvgPreamble(readFileSync(svgPath, "utf8"));
  return addInlineSvgAttrs(namespaceSvgIds(svg, `${id}-`), alt);
}

function createMd(ctx: RenderContext): MarkdownIt {
  // `highlight` colors static code fences (Python) at build time; the default
  // fence renderer (defFence below) invokes it and adds the <pre><code> wrapper.
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false, breaks: false, highlight: highlightCode });
  md.use(attrs, { allowedAttributes: ["id", "class", /^data-/] });
  md.use(katex);
  md.use(inlineRefs, {
    bib: ctx.bib,
    xref: ctx.xref,
    currentHref: ctx.currentHref,
    chapterTitle: ctx.chapterTitle,
    chapterNum: ctx.chapterNum,
    prefix: ctx.prefix,
    lang: ctx.lang,
    glossary: ctx.glossary,
    glossarySeen: ctx.glossarySeen,
    glossaryUsed: ctx.glossaryUsed,
    glossaryFirstUses: ctx.glossaryFirstUses,
  });

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
  html = html.replace(/<p>\s*(<img\b[^>]*\bid="(fig-[^"]+)"[^>]*>)\s*<\/p>/g, (_m, img: string, id: string) => {
    const alt = img.match(/\balt="([^"]*)"/)?.[1] ?? "";
    const num = ctx.xref.get(id)?.label ?? "";
    const numPart = num ? `<span class="rdr-fig-num">${num}.</span> ` : "";
    const altHtml = alt ? resolveXrefsInText(alt, ctx.xref, ctx.currentHref, ctx.prefix) : "";
    const caption = alt || num ? `<figcaption>${numPart}${altHtml}</figcaption>` : "";
    const media = inlineLocalSvgFigure(img, id, alt, ctx) ?? img;
    return `<figure class="rdr-figure" id="${id}">${media}${caption}</figure>`;
  });
  // Raw {=html} viz figures: <figure id="fig-x">…<figcaption>…  →  add the
  // rdr-figure class and prepend the "Figure C.N." number, so interactive viz
  // read as numbered, cross-referenceable figures like images and diagrams.
  html = html.replace(/<figure(?![^>]*\brdr-figure\b)([^>]*\bid="(fig-[^"]+)"[^>]*)>([\s\S]*?)<\/figure>/g,
    (_m, attrs: string, id: string, inner: string) => {
      const num = ctx.xref.get(id)?.label ?? "";
      const cls = attrs.match(/\bclass="([^"]*)"/);
      const newAttrs = cls
        ? attrs.replace(/\bclass="([^"]*)"/, `class="rdr-figure $1"`)
        : `${attrs} class="rdr-figure"`;
      if (num) {
        const numPart = `<span class="rdr-fig-num">${num}.</span> `;
        inner = inner.replace(/<figcaption>/, `<figcaption>${numPart}`);
      }
      return `<figure${newAttrs}>${inner}</figure>`;
    });
  return html;
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
