// Compile one chapter into the ChapterData the shell renders: read the .qmd,
// run the markdown pipeline, and assemble navigation/breadcrumb/opener fields
// from the book model.

import { readFileSync } from "node:fs";
import type { Book, BookChapter } from "./book.ts";
import { navFor, prevNext } from "./book.ts";
import { renderMarkdown } from "./markdown.ts";
import { stripCjkSoftBreaks } from "./cjk.ts";
import { renderBibliography, type Bibliography } from "./citations.ts";
import type { CrossrefMap } from "./crossref.ts";
import type { GraphvizInstance } from "./diagrams.ts";
import type { ChapterData, Lang } from "../types.ts";

export interface CompileContext {
  bib: Bibliography;
  xref: CrossrefMap;
  graphviz: GraphvizInstance;
}

// Depth of a chapter's output file relative to the language root, for building
// the cross-language href (e.g. p1-foundations/06-x.html → ../zh/p1-.../06-x.html).
function langHrefFor(lang: Lang, href: string): string {
  const other = lang === "en" ? "zh" : "en";
  const up = "../".repeat(href.split("/").length); // climb out of lang dir
  return `${up}${other}/${href}`;
}

function eyebrowFor(book: Book, ch: BookChapter): string {
  if (!ch.num) return ch.title;
  // "Part 1 · Chapter 6" (en) / "第一部分 · 第 6 章" (zh) — derive part ordinal
  const partIdx = book.parts.filter((p) => !p.single).findIndex((p) => p.label === ch.partLabel);
  if (book.lang === "zh") {
    return `${ch.partLabel} · 第 ${ch.num} 章`;
  }
  return `${ch.partLabel} · Chapter ${ch.num}`;
}

export function compileChapter(book: Book, ch: BookChapter, ctx: CompileContext): ChapterData {
  let src = readFileSync(ch.qmdPath, "utf8");
  if (book.lang === "zh") src = stripCjkSoftBreaks(src);
  const prefix = "../".repeat(ch.href.split("/").length - 1); // page depth → "../"*
  let { html, headings } = renderMarkdown(src, { bib: ctx.bib, xref: ctx.xref, currentHref: ch.href, prefix, graphviz: ctx.graphviz });
  // References page: fill the ::: {#refs} slot with the cited-only bibliography.
  if (ch.href === "references.html") {
    html = html.replace(/(<div class="rdr-block"[^>]*id="refs"[^>]*>)([\s\S]*?)(<\/div>)/, `$1${renderBibliography(ctx.bib)}$3`);
  }
  const { prev, next } = prevNext(book, ch.href);
  // nav hrefs are lang-root-relative; make them relative to this page.
  const toc = navFor(book, ch.href).map((p) => ({ ...p, chapters: p.chapters.map((c) => ({ ...c, href: prefix + c.href })) }));
  return {
    lang: book.lang,
    partLabel: ch.partLabel || book.title,
    chapterNum: ch.num,
    eyebrow: eyebrowFor(book, ch),
    title: ch.title,
    contentHtml: html,
    headings,
    prev: prev ? { label: `${prev.num ? prev.num + " · " : ""}${prev.title}`, href: prefix + prev.href } : null,
    next: next ? { label: `${next.num ? next.num + " · " : ""}${next.title}`, href: prefix + next.href } : null,
    langHref: langHrefFor(book.lang, ch.href),
    prefix,
    toc,
  };
}
