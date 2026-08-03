import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Reader from "./Reader.tsx";
import { editUrl, issueUrl, REPO_URL } from "./repo.ts";
import type { ChapterData } from "./types.ts";

const chapter: ChapterData = {
  lang: "en",
  partLabel: "Part I: Base Model Formation",
  partShort: "Part I",
  chapterNum: "5",
  isPartIntro: false,
  eyebrow: "Part I · Chapter 5",
  crumbChapter: "Chapter 5",
  title: "Scaling Laws and Compute Allocation",
  author: "Changkun Ou",
  updated: "2026-07-26",
  readtime: "~14 min",
  contentHtml: "<p>Body.</p>",
  headings: [],
  prev: null,
  next: null,
  langHref: "../../zh/foundations/scaling-laws",
  prefix: "../../",
  path: "foundations/scaling-laws",
  sourcePath: "en/foundations/01-scaling-laws.qmd",
  description: "Scaling laws.",
  toc: [],
};

test("the edit link opens GitHub's editor on the chapter's own source file", () => {
  expect(editUrl("en/foundations/01-scaling-laws.qmd"))
    .toBe(`${REPO_URL}/edit/main/en/foundations/01-scaling-laws.qmd`);
});

test("the issue link carries the chapter title and the page it came from", () => {
  const url = new URL(issueUrl("Tokenization", "https://aaai.latere.ai/en/foundations/tokenization"));
  expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
  expect(url.searchParams.get("title")).toBe("Tokenization");
  expect(url.searchParams.get("body")).toContain("https://aaai.latere.ai/en/foundations/tokenization");
});

test("every chapter ends with a way to report or fix what it says", () => {
  const html = renderToString(createElement(Reader, { chapter }));

  expect(html).toContain("Report an issue");
  expect(html).toContain("Edit this page");
  // The edit link points at this chapter's source, not the repository root.
  expect(html).toContain("/edit/main/en/foundations/01-scaling-laws.qmd");
  // The issue link carries the chapter and its canonical address.
  expect(html).toContain("title=Scaling+Laws+and+Compute+Allocation");
  expect(html).toContain("aaai.latere.ai%2Fen%2Ffoundations%2Fscaling-laws");
});

test("the contribute strip is localized on zh pages", () => {
  const html = renderToString(createElement(Reader, {
    chapter: { ...chapter, lang: "zh", sourcePath: "zh/foundations/01-scaling-laws.qmd" },
  }));

  expect(html).toContain("提交问题");
  expect(html).toContain("编辑本页");
  expect(html).toContain("/edit/main/zh/foundations/01-scaling-laws.qmd");
  expect(html).not.toContain("Report an issue");
});
