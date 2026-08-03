import { test, expect } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Reader from "./Reader.tsx";
import type { ChapterData } from "./types.ts";

const chapter: ChapterData = {
  lang: "zh",
  partLabel: "第一部分 · 基座模型的形成",
  partShort: "第一部分 · 基座模型的形成",
  chapterNum: "",
  isPartIntro: true,
  eyebrow: "第一部分 · 基座模型的形成",
  crumbChapter: "第一部分",
  title: "第一部分 · 基座模型的形成",
  author: "Changkun Ou",
  updated: "",
  readtime: "约 1 分钟",
  contentHtml: "<p>Part intro.</p>",
  headings: [],
  prev: null,
  next: null,
  langHref: "../../en/foundations/",
  prefix: "../",
  path: "foundations",
  sourcePath: "zh/foundations/index.qmd",
  description: "Part intro.",
  toc: [],
};

test("chapter opener meta renders label and value on one line", () => {
  const html = renderToString(createElement(Reader, { chapter }));

  expect(html).toContain('class="rdr-meta-row"');
  expect(html).toContain('class="rdr-meta-item" style="display:flex;align-items:baseline');
  expect(html).toContain('<span class="rdr-meta-label"');
  expect(html).toContain('<span class="rdr-meta-value"');
  expect(html).toContain(">作者</span><span");
  expect(html).toContain(">Changkun Ou</span>");
  expect(html).toContain(">阅读时长</span><span");
  expect(html).toContain(">约 1 分钟</span>");
  expect(html).not.toContain("margin-bottom:3px");
});
