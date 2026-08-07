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
import { renderFurtherReading } from "./further-reading.ts";
import type { CrossrefMap } from "./crossref.ts";
import type { GraphvizInstance } from "./diagrams.ts";
import { renderGlossaryPage, type Glossary, type GlossFirstUseMap } from "./glossary.ts";
import type { ChapterData, Lang } from "../types.ts";

export interface CompileContext {
  bib: Bibliography;
  xref: CrossrefMap;
  graphviz: GraphvizInstance;
  refsDir: string; // path to refs/, the per-chapter literature store
  glossary: Glossary; // term definitions (glossary.yml)
  glossaryUsed: Set<string>; // keys referenced anywhere in the book; feeds the glossary page
  glossaryFirstUses: GlossFirstUseMap; // first book occurrence for each glossary key
}

// A chapter href as a clickable link relative to the current page. The index
// (home) chapter is canonically the lang root, so it links to the directory
// (prefix, or "./" at depth 0), never "/en/index".
function linkHref(href: string, prefix: string): string {
  return href === "index" ? (prefix || "./") : prefix + href;
}

// Depth of a chapter's output file relative to the language root, for building
// the cross-language href (e.g. p1-foundations/06-x → ../zh/p1-.../06-x). The
// home chapter maps to the other lang's root directory.
function langHrefFor(lang: Lang, href: string): string {
  const other = lang === "en" ? "zh" : "en";
  const up = "../".repeat(href.split("/").length); // climb out of lang dir
  return href === "index" ? `${up}${other}/` : `${up}${other}/${href}`;
}

function chapterWord(lang: string, num: string): string {
  return lang === "zh" ? `第 ${num} 章` : `Chapter ${num}`;
}

// Insert generated HTML with a replacement function so dollar sequences in
// bibliography titles and URLs cannot be interpreted as replace patterns.
export function fillSlot(html: string, id: string, body: () => string): string {
  return html.replace(
    new RegExp(`(<div class="rdr-block"[^>]*id="${id}"[^>]*>)([\\s\\S]*?)(</div>)`),
    (_m, open: string, _cur: string, close: string) => open + body() + close,
  );
}

// "Part I: Base Model Formation" → "Part I"; "第一部分 · 基座模型的形成" → "第一部分"
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
  let { html, headings } = renderMarkdown(src, {
    bib: ctx.bib,
    xref: ctx.xref,
    currentHref: ch.href,
    chapterTitle: ch.title,
    chapterNum: ch.num,
    prefix,
    graphviz: ctx.graphviz,
    lang: book.lang,
    glossary: ctx.glossary,
    glossarySeen: new Set(),
    glossaryUsed: ctx.glossaryUsed,
    glossaryFirstUses: ctx.glossaryFirstUses,
  });
  // Fill an aggregate ::: slot's body with generated HTML. Uses a replacement
  // FUNCTION, not a string: the generated content can contain "$" sequences (a
  // "$1 billion" in a title, a "$&" in a URL) that String.replace would
  // otherwise interpret as backreferences and splice the wrong text in.
  // References page: fill the ::: {#refs} slot with the cited-only bibliography.
  if (ch.href === "references") {
    html = fillSlot(html, "refs", () => renderBibliography(ctx.bib, book.lang));
  }
  // Glossary page: fill the ::: {#glossary} slot with every term used in the book.
  // book order ends with the back matter, so glossaryUsed is complete by here.
  if (ch.href === "glossary") {
    html = fillSlot(html, "glossary", () => renderGlossaryPage(ctx.glossary, ctx.glossaryUsed, ctx.glossaryFirstUses, book.lang));
  }
  // Chapter "Further reading": fill the ::: {#further-reading} slot from
  // refs/<slug>.bib (the per-chapter literature store).
  if (html.includes('id="further-reading"')) {
    const slug = ch.href.split("/").pop()!.replace(/\.html$/, "");
    html = fillSlot(html, "further-reading", () => renderFurtherReading(ctx.refsDir, slug, book.lang, ctx.xref, ch.href, prefix));
  }
  const { prev, next } = prevNext(book, ch.href);
  const isPartIntro = ch.role === "part";
  // nav hrefs are lang-root-relative; make them relative to this page.
  const toc = navFor(book, ch.href).map((p) => ({
    ...p,
    href: p.href ? linkHref(p.href, prefix) : undefined,
    chapters: p.chapters.map((c) => ({ ...c, href: linkHref(c.href, prefix) })),
  }));
  return {
    lang: book.lang,
    partLabel: ch.partLabel || book.title,
    partShort: ch.partLabel ? shortPart(ch.partLabel) : book.title,
    chapterNum: ch.num,
    isPartIntro,
    eyebrow: isPartIntro ? shortPart(ch.partLabel) : eyebrowFor(book, ch),
    crumbChapter: isPartIntro ? (book.lang === "zh" ? "概览" : "Overview") : ch.num ? chapterWord(book.lang, ch.num) : ch.title,
    title: ch.title,
    author: book.author,
    updated: gitDate(book.lang, ch.qmdPath),
    readtime: readingTime(book.lang, html),
    contentHtml: html,
    headings,
    prev: prev ? { label: `${prev.num ? prev.num + " · " : ""}${prev.title}`, href: linkHref(prev.href, prefix) } : null,
    next: next ? { label: `${next.num ? next.num + " · " : ""}${next.title}`, href: linkHref(next.href, prefix) } : null,
    langHref: langHrefFor(book.lang, ch.href),
    prefix,
    path: ch.href === "index" ? "" : ch.href, // home is the lang root
    sourcePath: ch.srcRel,
    description: metaDescription(html),
    toc,
  };
}

// Back-matter pages whose body aggregates state collected from the whole book:
// the glossary needs every used term (glossaryUsed/glossaryFirstUses), the
// references list needs every cited key (bib.cited). Both are filled only as
// chapters compile, so the aggregate slot is complete only after the whole book
// has run in order (book order ends with this back matter). See compilePage.
const AGGREGATE_HREFS = new Set(["glossary", "references"]);

// Compile a single page, doing a full in-order book pass first when the target
// is an aggregate back-matter page so its slot is populated. The static build
// gets this for free by compiling every chapter into one shared ctx; the
// on-demand dev server must funnel through here to render those pages correctly.
export function compilePage(book: Book, href: string, ctx: CompileContext): ChapterData | null {
  const target = book.chapters.find((c) => c.href === href);
  if (!target) return null;
  if (!AGGREGATE_HREFS.has(href)) return compileChapter(book, target, ctx);
  // ctx may be reused across calls (dev server), so reset the cited set before
  // recomputing it from this pass; glossary sets come fresh in the dev ctx.
  ctx.bib.cited.clear();
  let data: ChapterData | null = null;
  for (const c of book.chapters) {
    const d = compileChapter(book, c, ctx);
    if (c.href === href) data = d;
  }
  return data;
}

// First real paragraph of the body, de-tagged and truncated, for <meta
// description> / SERP snippets. Skips callout/figure chrome by taking the first
// reasonably long <p>.
function metaDescription(html: string): string {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim());
  const text = paras.find((p) => p.length >= 60) ?? paras[0] ?? "";
  return text.length > 155 ? text.slice(0, 152).replace(/\s+\S*$/, "") + "…" : text;
}
