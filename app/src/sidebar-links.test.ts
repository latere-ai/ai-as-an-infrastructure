import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Reader, { navInitialScrollTop } from "./Reader.tsx";
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

test("the source repository is reachable from the sidebar and the header", () => {
  const html = renderToString(createElement(Reader, { chapter }));
  const repo = 'href="https://github.com/latere-ai/ai-as-an-infrastructure"';

  // Once in the sidebar's about block, once as the header icon button.
  expect(html.split(repo).length - 1).toBe(2);
  expect(html).toContain("Source on GitHub");

  const latere = html.indexOf("About Latere AI");
  const source = html.indexOf(">Source on GitHub");
  const preface = html.indexOf(">Preface</a>");
  expect(source).toBeGreaterThan(latere);
  expect(preface).toBeGreaterThan(source);
});

test("nav stays at the top when the active part starts above the fold", () => {
  // The preface sits ~80px down, just under the About links: scrolling it to
  // the top of an 800px nav would hide those links for no gain.
  expect(navInitialScrollTop(80, 800)).toBe(0);
  // A part that opens halfway down is already half-cut; pull it up.
  expect(navInitialScrollTop(400, 800)).toBe(400);
  expect(navInitialScrollTop(3200, 800)).toBe(3200);
  // A short nav (the mobile drawer) still scrolls to a part below its middle.
  expect(navInitialScrollTop(80, 120)).toBe(80);
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
  expect(text).toContain(">GitHub 源码仓库 ↗</a>");
  expect(text).not.toContain(">About Author ↗</a>");
  expect(text).not.toContain(">About Latere AI ↗</a>");
});
