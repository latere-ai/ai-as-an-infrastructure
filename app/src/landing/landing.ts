// The home page opens like a book: a title spread (the cover beside a title
// page with the edition, a way in, and the language switch), then the
// contents by part, and then the Preface as the first page. The build renders
// the spread and the contents here, from the book manifest and CHANGELOG.md;
// the reader shell places them above the Preface (landing/Landing.tsx).
//
// The markup is kept out of the chapter body on purpose: the page description,
// the reading time and the search index are all derived from the body, and
// none of them should read the title page.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Book } from "../pipeline/book.ts";
import { formatDate } from "../pipeline/dates.ts";
import { esc } from "../figures/lib/svg.ts";
import type { Lang } from "../types.ts";
import { DEFAULT_COVER, renderCover, type CoverData, type CoverVariant, type Release } from "./cover.ts";

// Where "Start reading" lands: the Preface, directly below the landing.
export const START_ID = "preface";
export const CONTENTS_ID = "contents";

export const LICENSE = "CC BY-NC-ND 4.0";
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-nd/4.0/";

interface Strings {
  author: string; // the byline as the language sets it
  start: string;
  contents: string;
  edition: string;
  language: string;
  license: string;
  chapters: (from: string, to: string) => string;
  count: (parts: number, chapters: number) => string;
  alsoIn: string;
  langName: string; // the other language, in its own script
  otherLang: string; // BCP 47 tag of the other language
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    author: "Changkun Ou",
    start: "Start reading",
    contents: "Contents",
    edition: "Edition",
    language: "Language",
    license: "License",
    chapters: (a, b) => (a === b ? `Chapter ${a}` : `Chapters ${a}–${b}`),
    count: (p, c) => `${p} parts, ${c} chapters`,
    alsoIn: "Back matter",
    langName: "中文",
    otherLang: "zh-Hans",
  },
  zh: {
    author: "欧长坤 著",
    start: "开始阅读",
    contents: "目录",
    edition: "版本",
    language: "语言",
    license: "许可",
    chapters: (a, b) => (a === b ? `第 ${a} 章` : `第 ${a}–${b} 章`),
    count: (p, c) => `${p} 个部分，${c} 章`,
    alsoIn: "书末",
    langName: "English",
    otherLang: "en",
  },
};

// The newest released version in CHANGELOG.md: the first "## vX.Y.Z - date"
// heading. Unreleased notes sit above it under their own heading and are
// skipped, so the page names the edition a reader is actually looking at.
export function latestRelease(changelog: string): Release | null {
  const m = changelog.match(/^## v(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})[ \t]*$/m);
  return m ? { version: m[1], date: m[2] } : null;
}

function readRelease(repoRoot: string): Release | null {
  const path = join(repoRoot, "CHANGELOG.md");
  return existsSync(path) ? latestRelease(readFileSync(path, "utf8")) : null;
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

// "Part I: Base Model Formation" → "Base Model Formation";
// "第一部分 · 基座模型的形成" → "基座模型的形成".
export function partTitle(label: string): string {
  const zh = label.split(" · ");
  if (zh.length > 1) return zh.slice(1).join(" · ").trim();
  const i = label.indexOf(": ");
  return i >= 0 ? label.slice(i + 2).trim() : label;
}

// The title set on two lines the way the cover sets it: the last word of a
// Latin title on its own line ("AI as an / Infrastructure").
function titleLines(title: string, lang: Lang): string {
  if (lang === "zh" || !title.includes(" ")) return esc(title);
  const i = title.lastIndexOf(" ");
  return `<span>${esc(title.slice(0, i))}</span> <span>${esc(title.slice(i + 1))}</span>`;
}

const ARROW = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;

// What a cover draws from the book: its parts in manifest order, numbered as
// the contents number them, and the edition.
export function coverDataFor(book: Book, repoRoot: string): CoverData {
  const parts = book.parts.filter((p) => !p.single);
  return { parts: parts.map((p, i) => ({ num: ROMAN[i] ?? String(i), title: partTitle(p.label) })), release: readRelease(repoRoot) };
}

export function renderLanding(book: Book, repoRoot: string, cover: CoverVariant = DEFAULT_COVER): string {
  const lang = book.lang;
  const s = STRINGS[lang];
  const release = readRelease(repoRoot);
  const other = lang === "en" ? "zh" : "en";

  const parts = book.parts.filter((p) => !p.single);
  const numbered = parts.flatMap((p) => p.chapters.filter((c) => c.num));
  const back = book.parts.filter((p) => p.single).flatMap((p) => p.chapters).filter((c) => c.href !== "index");

  const edition = release
    ? `<a href="changelog">v${esc(release.version)}</a><span class="lp-sep">${lang === "zh" ? "，" : ", "}</span>${esc(formatDate(release.date, lang))}`
    : "";
  const colophon = [
    edition && `<div><dt>${s.edition}</dt><dd>${edition}</dd></div>`,
    `<div><dt>${s.language}</dt><dd><span class="lp-lang-here">${lang === "en" ? "English" : "中文"}</span><span class="lp-sep" aria-hidden="true"> / </span>`
      + `<a href="../${other}/" hreflang="${s.otherLang}" lang="${s.otherLang}">${s.langName}</a></dd></div>`,
    `<div><dt>${s.license}</dt><dd><a href="${LICENSE_URL}" rel="license noreferrer" target="_blank">${LICENSE}</a></dd></div>`,
  ].filter(Boolean).join("");

  const recto = `<div class="lp-recto">`
    + `<p class="lp-imprint">LATERE.AI</p>`
    + `<div class="lp-titleblock">`
    + `<h1 class="lp-title">${titleLines(book.title, lang)}</h1>`
    + (book.subtitle ? `<p class="lp-subtitle">${esc(book.subtitle)}</p>` : "")
    + `<p class="lp-author">${esc(s.author)}</p>`
    + `<div class="lp-actions"><a class="lp-start" href="#${START_ID}">${s.start}${ARROW}</a>`
    + `<a class="lp-toc-link" href="#${CONTENTS_ID}">${s.contents}</a></div>`
    + `</div>`
    + `<dl class="lp-colophon">${colophon}</dl>`
    + `</div>`;

  const rows = parts.map((p, i) => {
    const nums = p.chapters.filter((c) => c.num).map((c) => c.num);
    const range = nums.length ? s.chapters(nums[0], nums[nums.length - 1]) : "";
    const href = p.intro?.href ?? p.chapters[0]?.href ?? "";
    return `<li><a href="${esc(href)}"><span class="lp-num">${ROMAN[i] ?? i}</span>`
      + `<span class="lp-part"><span class="lp-part-title">${esc(partTitle(p.label))}</span>`
      + (range ? `<span class="lp-part-range">${range}</span>` : "")
      + `</span></a></li>`;
  }).join("");
  const backLinks = back.map((c) => `<a href="${esc(c.href)}">${esc(c.title)}</a>`).join(`<span class="lp-sep" aria-hidden="true"> · </span>`);

  const contents = `<nav class="lp-contents" id="${CONTENTS_ID}" aria-labelledby="lp-contents-h">`
    + `<div class="lp-contents-head"><h2 id="lp-contents-h">${s.contents}</h2><span>${s.count(parts.length, numbered.length)}</span></div>`
    + `<ol class="lp-parts">${rows}</ol>`
    + (backLinks ? `<p class="lp-back"><span>${s.alsoIn}</span> ${backLinks}</p>` : "")
    + `</nav>`;

  return `<div class="lp-spread"><div class="lp-verso">${renderCover(lang, cover, coverDataFor(book, repoRoot))}</div>${recto}</div>`
    + contents
    + `<div class="lp-start-anchor" id="${START_ID}"></div>`;
}
