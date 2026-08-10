import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/changelog.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/changelog.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const expectedWeeks = [
  "2026 年 8 月 4 日至 8 日",
  "2026 年 7 月 27 日至 8 月 3 日",
  "2026 年 7 月 20 日至 26 日",
  "2026 年 7 月 6 日至 12 日",
  "2026 年 6 月 29 日至 7 月 5 日",
  "2026 年 6 月 22 日至 28 日",
  "2026 年 6 月 19 日至 21 日",
];

function weekSections(source: string): string[] {
  return source.split(/^## /gm).slice(1);
}

test("the Chinese update log preserves the complete English chronology", () => {
  expect(chinese).toStartWith("# 更新记录 {.unnumbered}\n");
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual(
    expectedWeeks,
  );
  expect(weekSections(chinese).length).toBe(weekSections(english).length);
});

test("the introduction tells returning readers how to use the record", () => {
  for (const phrase of [
    "记录读者能够看到的改动",
    "是否需要重读某一章",
    "原来的问题是什么",
    "改成了什么",
    "没有读者可见改动的周不会列出",
  ]) expect(flat).toContain(phrase);
});

test("the current entry records the verified English rewrite", () => {
  const current = weekSections(chinese)[0];
  for (const phrase of [
    "英文版重写已经推进到尾声",
    "每次只处理一个完整单元",
    "适用范围、证据、失败行为和运营交接",
    "章节专属的回归测试",
    "桌面端和移动端",
  ]) expect(current).toContain(phrase);
});

test("every dated entry remains a scannable categorized record", () => {
  const englishSections = weekSections(english);
  for (const [index, section] of weekSections(chinese).entries()) {
    const categories = [...section.matchAll(/^\*\*(新增|调整|更正)\*\*$/gm)];
    expect(categories.length).toBeGreaterThanOrEqual(2);
    expect(section).toMatch(/^- /m);
    expect(section.match(/^- /gm)?.length).toBe(
      englishSections[index].match(/^- /gm)?.length,
    );
  }
});

test("release tags stay attached to their publication weeks", () => {
  const sections = weekSections(chinese);
  expect(sections[2]).toContain("v0.2.0");
  expect(sections[3]).toContain("v0.1.0");
  expect(sections[6]).toContain("v0.0.1");
});

test("historical additions and structural changes remain discoverable", () => {
  for (const phrase of [
    "规范网址",
    "51 项经过核实的更正",
    "出口替换",
    "新增八章",
    "新增十八章",
    "121 个术语",
    "二十六个交互图",
  ]) expect(flat).toContain(phrase);
});

test("important corrections retain both the defect and replacement", () => {
  for (const phrase of [
    "一个词平均会被切分成多少个词元",
    "单步成本都是线性的",
    "85% 至 90%",
    "八个百分点",
    "232 个参考文献字段",
    "`budget_tokens`",
    "只有 DAPO 去掉了这项惩罚",
    "`-α'_t/(1-α_t)`",
    "二十倍",
    "Irving、Christiano 和 Amodei",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the old promotional and speculative wording", () => {
  for (const phrase of [
    "前沿模型能不能部署，最终卡在这道闸门上",
    "流水线漏掉的一环",
    "一级一级讲下来",
    "每个符号第一次吃劲的地方",
    "硅片上沉积的十九年软件",
    "这个判断没能站住",
    "一场活着的争论",
    "补上主干的缺口",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toMatch(/\S-\n\S/);
});

test("the complete Chinese record is substantial and renders", async () => {
  expect(chinese.length).toBeGreaterThanOrEqual(6500);
  expect(chinese.length).toBeLessThanOrEqual(14000);

  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "changelog.html",
    chapterTitle: "更新记录",
    chapterNum: "",
    prefix: "",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("katex-error");
  expect(html).not.toContain("**");
  expect(html).toContain("英文版重写已经推进到尾声");
  expect(headings.map((heading) => heading.text)).toEqual(expectedWeeks);
});
