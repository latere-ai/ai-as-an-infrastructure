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

test("sidebar external about links are localized on zh pages", () => {
  const html = renderToString(createElement(Reader, {
    chapter: {
      ...chapter,
      lang: "zh",
      langHref: "../en/",
      crumbChapter: "前言",
      title: "前言",
      toc: [
        {
          id: "p0",
          label: "",
          single: true,
          chapters: [{ n: "", label: "前言", href: "", active: true }],
        },
      ],
    },
  }));

  // The shell appends an external-link arrow to each label, and React's SSR
  // splits the two text children with a `<!-- -->` marker. Strip the marker so
  // the assertions still pin the full anchor text, arrow included.
  const text = html.replace(/<!-- -->/g, "");
  expect(text).toContain(">关于作者 ↗</a>");
  expect(text).toContain(">关于 Latere AI ↗</a>");
  expect(text).not.toContain(">About Author ↗</a>");
  expect(text).not.toContain(">About Latere AI ↗</a>");
});
