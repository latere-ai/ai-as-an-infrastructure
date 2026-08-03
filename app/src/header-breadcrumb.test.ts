import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Reader from "./Reader.tsx";
import type { ChapterData } from "./types.ts";

const baseChapter: ChapterData = {
  lang: "en",
  partLabel: "Part I: Base Model Formation",
  partShort: "Part I",
  chapterNum: "5",
  isPartIntro: false,
  eyebrow: "Part I · Chapter 5",
  crumbChapter: "Chapter 5",
  title: "Data Curation and Quality",
  author: "Changkun Ou",
  updated: "2026-06-22",
  readtime: "~16 min",
  contentHtml: "<p>Body.</p>",
  headings: [],
  prev: null,
  next: null,
  langHref: "../zh/foundations/data-curation",
  prefix: "../",
  path: "foundations/data-curation",
  sourcePath: "en/foundations/02-data-curation.qmd",
  description: "Body.",
  toc: [],
};

function breadcrumbHtml(chapter: ChapterData): string {
  const html = renderToString(createElement(Reader, { chapter }));
  const start = html.indexOf('aria-label="breadcrumb"');
  const end = html.indexOf("</nav>", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

test("desktop breadcrumb includes the numbered chapter title", () => {
  const crumb = breadcrumbHtml(baseChapter);
  const part = crumb.indexOf("Part I");
  const chapter = crumb.indexOf("Chapter 5");
  const title = crumb.indexOf("Data Curation and Quality");

  expect(part).toBeGreaterThan(-1);
  expect(chapter).toBeGreaterThan(part);
  expect(title).toBeGreaterThan(chapter);
});

test("part intro breadcrumb stays compact", () => {
  const crumb = breadcrumbHtml({
    ...baseChapter,
    chapterNum: "",
    isPartIntro: true,
    crumbChapter: "Overview",
    title: "Part I: Base Model Formation",
  });

  expect(crumb).toContain("Part I");
  expect(crumb).toContain("Overview");
  expect(crumb).not.toContain("Part I: Base Model Formation");
});
