// Regression test: stripCjkSoftBreaks joins wrapped CJK prose lines, but a
// heading line is a complete block and must not absorb the line after it.
// A callout whose "## Title" is immediately followed by a CJK body line (no
// author blank line) would otherwise fold the body into the pulled callout
// title, so inline cross-refs in that body never render. See the lower-layer
// constraint callouts in zh/p8-safety/*.qmd.

import { test, expect } from "bun:test";
import { stripCjkSoftBreaks } from "./cjk.ts";
import { renderMarkdown } from "./markdown.ts";
import type { Lang } from "../types.ts";

test("a heading line is not joined with the following CJK body line", () => {
  const src = ["## 下层约束", "一个已部署模型的暴露面，由 @sec-scaling-laws 设定。"].join("\n");
  const out = stripCjkSoftBreaks(src).split("\n");
  expect(out[0]).toBe("## 下层约束");
  expect(out[0]).not.toContain("一个已部署");
});

test("wrapped CJK prose lines are still joined (no stray gap)", () => {
  const src = ["一个已部署模型的隐私暴露面", "在服务开始之前就已固定。"].join("\n");
  const out = stripCjkSoftBreaks(src).split("\n");
  expect(out[0]).toBe("一个已部署模型的隐私暴露面在服务开始之前就已固定。");
});

// Emphasis next to CJK text. CommonMark's flanking rules do not close a `**`
// run that sits between full-width punctuation and a CJK letter, as in
// "**标签：**正文", so the markers leaked into zh pages as literal text. The
// cjkEmphasis plugin applies the CJK-friendly flanking rules; English text,
// which has no CJK neighbor, renders exactly as CommonMark specifies.

function render(src: string, lang: Lang): string {
  return renderMarkdown(src, {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "foundations/scaling-laws.html",
    chapterTitle: "",
    chapterNum: "1",
    prefix: "../",
    graphviz: {} as any,
    lang,
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  }).html;
}

test("bold closes after full-width punctuation followed by a CJK letter", () => {
  expect(render("**标签：**正文", "zh")).toContain("<strong>标签：</strong>正文");
  expect(render("**固定比较条件。**保持分词器一致。", "zh")).toContain("<strong>固定比较条件。</strong>保持分词器一致。");
  expect(render("*提示：*正文", "zh")).toContain("<em>提示：</em>正文");
});

test("bold followed by full-width punctuation still renders", () => {
  expect(render("**标签**：正文", "zh")).toContain("<strong>标签</strong>：正文");
});

test("bold inside a zh sentence opens and closes next to punctuation", () => {
  const cases: [string, string][] = [
    ["训练前先**固定比较条件；**再建立规模阶梯。", "训练前先<strong>固定比较条件；</strong>再建立规模阶梯。"],
    ["规模定律把**“更大的模型”**变成可预测的曲线。", "规模定律把<strong>“更大的模型”</strong>变成可预测的曲线。"],
    ["至少要区分**（任务能力差距）**和信息差距。", "至少要区分<strong>（任务能力差距）</strong>和信息差距。"],
  ];
  for (const [src, want] of cases) {
    const html = render(src, "zh");
    expect(html).toContain(want);
    expect(html).not.toContain("**");
  }
});

test("English emphasis follows CommonMark unchanged", () => {
  expect(render("**Label:** body text.", "en")).toContain("<strong>Label:</strong> body text.");
  expect(render("A **bold** word and *emphasis*.", "en")).toContain("A <strong>bold</strong> word and <em>emphasis</em>.");
  // Punctuation before the closing run and a letter after it: not right-flanking.
  expect(render("**Label:**body", "en")).toContain("**Label:**body");
  // Intraword underscores stay literal; intraword asterisks emphasize.
  expect(render("snake_case_name and a*b*c", "en")).toContain("snake_case_name and a<em>b</em>c");
});
