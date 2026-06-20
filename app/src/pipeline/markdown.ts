// Markdown → HTML for chapter bodies. markdown-it core + attributes ({#sec-id}
// on headings/images) + KaTeX math. Quarto-specific constructs (callouts,
// mermaid/dot, citations, cross-refs, runnable/viz) are handled by dedicated
// pipeline passes layered on top in later phases; here we cover core prose,
// tables, code, links, images, headings, and math.

import MarkdownIt from "markdown-it";
import attrs from "markdown-it-attrs";
import { katex } from "@mdit/plugin-katex";
import type { Heading } from "../types.ts";

export interface RenderedChapter {
  titleLine: string; // raw H1 line (for title/label extraction upstream)
  html: string;
  headings: Heading[];
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w一-鿿\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createMd(): MarkdownIt {
  const md = new MarkdownIt({
    html: true, // chapters embed raw HTML (viz, cover); kept verbatim
    linkify: false,
    typographer: false, // never auto-convert -- to dashes (house style bans em dashes)
    breaks: false,
  });
  md.use(attrs, { allowedAttributes: ["id", "class", "data-viz", "data-family", "data-xlabel", "data-ylabel", "data-plabel", "data-pmin", "data-pmax", "data-p", "data-logy"] });
  md.use(katex);
  return md;
}

// Split off the first H1 (chapter title, rendered by the opener) from the body.
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

// Collect h2/h3 headings (with their resolved ids) for the on-this-page TOC,
// assigning slugged ids to any heading without an explicit {#id}.
function collectHeadings(md: MarkdownIt, body: string): { headings: Heading[]; tokens: ReturnType<MarkdownIt["parse"]> } {
  const env = {};
  const tokens = md.parse(body, env);
  const headings: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== "heading_open") continue;
    const level = Number(tok.tag.slice(1));
    if (level !== 2 && level !== 3) continue;
    const inline = tokens[i + 1];
    const text = inline?.content ?? "";
    let id = tok.attrGet("id");
    if (!id) { id = slugify(text); tok.attrSet("id", id); }
    headings.push({ id, text: text.replace(/\[@[^\]]+\]/g, "").trim(), level });
  }
  return { headings, tokens };
}

export function renderMarkdown(src: string): RenderedChapter {
  const md = createMd();
  const { titleLine, body } = splitTitle(src);
  const { headings, tokens } = collectHeadings(md, body);
  const html = md.renderer.render(tokens, (md as any).options, {});
  return { titleLine, html, headings };
}
