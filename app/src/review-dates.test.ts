// Per-chapter review dates. Every page of both manifests has an entry in
// app/src/data/review-dates.json, the file names no page that has gone, and the
// date reaches the chapter opener in both languages. A new or renamed chapter
// fails here until its manifest path is added to the file.

import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { join } from "node:path";
import Reader from "./Reader.tsx";
import { loadBook } from "./pipeline/book.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { compileChapter, reviewedLabel } from "./pipeline/compile.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { formatDate, formatMonth, loadReviewDates, reviewKey } from "./pipeline/dates.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import type { Lang } from "./types.ts";

const repoRoot = join(import.meta.dir, "../..");
const dates = loadReviewDates();
const langs: Lang[] = ["en", "zh"];
const books = Object.fromEntries(langs.map((l) => [l, loadBook(l, repoRoot)])) as Record<Lang, ReturnType<typeof loadBook>>;

test("every page in both manifests has a review date", () => {
  const missing = langs.flatMap((l) => books[l].chapters.filter((ch) => !reviewedLabel(l, ch.srcRel)).map((ch) => ch.srcRel));
  expect(books.en.chapters.length).toBeGreaterThan(0);
  expect(books.zh.chapters.length).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});

test("every review date names a page in a manifest", () => {
  const pages = new Set(langs.flatMap((l) => books[l].chapters.map((ch) => reviewKey(ch.srcRel))));
  expect([...dates.keys()].filter((k) => !pages.has(k))).toEqual([]);
});

test("dates are labeled day-first in English and in 年月日 form in Chinese", () => {
  expect(formatDate("2026-09-23", "en")).toBe("23 September 2026");
  expect(formatDate("2026-09-23", "zh")).toBe("2026 年 9 月 23 日");
  expect(formatMonth("2026-09", "en")).toBe("September 2026");
  expect(formatMonth("2026-09", "zh")).toBe("2026 年 9 月");
  expect(formatDate("2026-13-01", "en")).toBe("");
});

const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

for (const lang of langs) {
  test(`${lang}: the review date renders under the chapter title`, () => {
    const book = books[lang];
    const ch = book.chapters.find((c) => c.role === "part")!; // a part opener: small to compile
    const ctx = {
      bib: loadBibliographyDir(join(repoRoot, "refs")),
      xref: buildCrossref(book),
      graphviz,
      refsDir: join(repoRoot, "refs"),
      glossary,
      glossaryUsed: new Set<string>(),
      glossaryFirstUses: new Map(),
    };
    const data = compileChapter(book, ch, ctx);
    const expected = formatDate(dates.get(reviewKey(ch.srcRel))!, lang);
    expect(expected).not.toBe("");
    expect(data.reviewed).toBe(expected);

    const html = renderToString(createElement(Reader, { chapter: data }));
    const opener = html.slice(html.indexOf("</h1>"));
    const label = lang === "zh" ? "审阅于" : "Reviewed";
    expect(opener).toContain(`>${label}</span><span class="rdr-meta-value"`);
    expect(opener).toContain(`>${expected}</span>`);
    expect(opener.indexOf(`>${label}</span>`)).toBeLessThan(opener.indexOf(`>${expected}</span>`));
  });
}
