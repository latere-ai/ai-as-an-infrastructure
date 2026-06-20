// Compile one chapter into the ChapterData the shell renders: read the .qmd,
// run the markdown pipeline, and assemble navigation/breadcrumb/opener fields
// from the book model.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

function chapterWord(lang: string, num: string): string {
  return lang === "zh" ? `第 ${num} 章` : `Chapter ${num}`;
}

// "Part I: Foundations…" → "Part I"; "第一部分：基础…" → "第一部分"
function shortPart(label: string): string {
  return label.split(/[:：]/)[0].trim();
}

function eyebrowFor(book: Book, ch: BookChapter): string {
  if (!ch.num) return ch.title;
  return `${shortPart(ch.partLabel)} · ${chapterWord(book.lang, ch.num)}`;
}

// Reading time from the de-tagged body: ~220 wpm (en) / ~400 cpm CJK (zh).
function readingTime(lang: string, html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
  if (lang === "zh") {
    const chars = (text.match(/[㐀-鿿]/g) || []).length;
    return `约 ${Math.max(1, Math.round(chars / 400))} 分钟`;
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  return `~${Math.max(1, Math.round(words / 220))} min`;
}

// Last-modified date from git (stable across builds; only changes with content).
const dateCache = new Map<string, string>();
function gitDate(lang: string, qmdPath: string): string {
  if (dateCache.has(qmdPath)) return dateCache.get(qmdPath)!;
  let iso = "";
  try { iso = execFileSync("git", ["log", "-1", "--format=%cs", "--", qmdPath], { encoding: "utf8" }).trim(); } catch {}
  let out = iso;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    out = lang === "zh" ? `${y} 年 ${m} 月 ${d} 日`
      : new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }
  dateCache.set(qmdPath, out);
  return out;
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
    partShort: ch.partLabel ? shortPart(ch.partLabel) : book.title,
    chapterNum: ch.num,
    eyebrow: eyebrowFor(book, ch),
    crumbChapter: ch.num ? chapterWord(book.lang, ch.num) : ch.title,
    title: ch.title,
    author: book.author,
    updated: gitDate(book.lang, ch.qmdPath),
    readtime: readingTime(book.lang, html),
    contentHtml: html,
    headings,
    prev: prev ? { label: `${prev.num ? prev.num + " · " : ""}${prev.title}`, href: prefix + prev.href } : null,
    next: next ? { label: `${next.num ? next.num + " · " : ""}${next.title}`, href: prefix + next.href } : null,
    langHref: langHrefFor(book.lang, ch.href),
    prefix,
    toc,
  };
}
