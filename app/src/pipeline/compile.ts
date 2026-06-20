// Compile one chapter into the ChapterData the shell renders: read the .qmd,
// run the markdown pipeline, and assemble navigation/breadcrumb/opener fields
// from the book model.

import { readFileSync } from "node:fs";
import type { Book, BookChapter } from "./book.ts";
import { navFor, prevNext } from "./book.ts";
import { renderMarkdown } from "./markdown.ts";
import type { ChapterData, Lang } from "../types.ts";

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

export function compileChapter(book: Book, ch: BookChapter): ChapterData {
  const src = readFileSync(ch.qmdPath, "utf8");
  const { html, headings } = renderMarkdown(src);
  const { prev, next } = prevNext(book, ch.href);
  return {
    lang: book.lang,
    partLabel: ch.partLabel || book.title,
    chapterNum: ch.num,
    eyebrow: eyebrowFor(book, ch),
    title: ch.title,
    contentHtml: html,
    headings,
    prev: prev ? { label: `${prev.num ? prev.num + " · " : ""}${prev.title}`, href: prev.href } : null,
    next: next ? { label: `${next.num ? next.num + " · " : ""}${next.title}`, href: next.href } : null,
    langHref: langHrefFor(book.lang, ch.href),
    toc: navFor(book, ch.href),
  };
}
