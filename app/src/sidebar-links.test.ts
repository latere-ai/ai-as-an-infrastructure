import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Reader from "./Reader.tsx";
import type { ChapterData } from "./types.ts";

const chapter: ChapterData = {
  lang: "en",
  partLabel: "",
  partShort: "",
  chapterNum: "",
  isPartIntro: false,
  eyebrow: "",
  crumbChapter: "Preface",
  title: "Preface",
  author: "Changkun Ou",
  updated: "2026-06-22",
  readtime: "~2 min",
  contentHtml: "<p>Preface body.</p>",
  headings: [],
  prev: null,
  next: null,
  langHref: "../zh/",
  prefix: "",
  path: "",
  description: "Preface.",
  toc: [
    {
      id: "p0",
      label: "",
      single: true,
      chapters: [{ n: "", label: "Preface", href: "", active: true }],
    },
  ],
};

test("sidebar shows external about links above preface", () => {
  const html = renderToString(createElement(Reader, { chapter }));

  expect(html).toContain('href="https://changkun.de"');
  expect(html).toContain('href="https://latere.ai"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noreferrer"');

  const author = html.indexOf("About Author");
  const latere = html.indexOf("About Latere AI");
  const preface = html.indexOf(">Preface</a>");
  expect(author).toBeGreaterThan(-1);
  expect(latere).toBeGreaterThan(author);
  expect(preface).toBeGreaterThan(latere);
});
