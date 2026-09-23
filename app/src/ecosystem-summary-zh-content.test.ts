import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/summary.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/summary.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function paragraphs(source: string) {
  return source
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Chinese ecosystem summary preserves the complete English shape", () => {
  expect(chinese).toMatch(/^# 小结 \{#part-ecosystem-summary \.unnumbered\}/);
  expect(paragraphs(english).length).toBe(3);
  expect(paragraphs(chinese).length).toBe(3);
  expect(chinese).not.toMatch(/^## /m);
  expect(chinese).not.toMatch(/^[-*] /m);
  expect(chinese).not.toMatch(/```|\$\$|::: \{/);
});

test("the recap explains how the ecosystem shapes what teams can operate", () => {
  for (const phrase of [
    "技术栈在什么条件下被提供和使用",
    "API、开放权重还是受限许可证",
    "开发团队能够部署和运营哪些系统",
    "工具标准、网关、沙箱和可观测性",
    "影响着哪些做法能够普及",
    "训练与服务的成本",
    "按每个合格结果计算",
    "哪些设计能够长期维持",
  ]) expect(flat).toContain(phrase);
});

test("nontechnical conditions remain architectural constraints", () => {
  for (const phrase of [
    "非技术条件可能转化为技术约束",
    "定价、供应集中度、许可证条款、合规义务和权利主张",
    "对架构的影响可能不亚于基准成绩或内核性能",
    "基准成绩、获取条件、服务成本",
    "彼此独立变化",
    "在另一项上仍可能达不到",
  ]) expect(flat).toContain(phrase);
});

test("the handoff turns market constraints into operating contracts", () => {
  for (const phrase of [
    "生态系统是其中的一种机制",
    "能力如何转化为使用机会、供应商锁定、利润空间和运营风险",
    "越来越容易按需租用",
    "芯片供应商、云服务商、模型提供商、应用公司、劳动者和数据权利人",
    "如何分配价值",
    "第十二部分",
    "把这些市场约束落实为运营契约",
    "无论采购还是自行托管能力",
    "管理发布、预算、租户边界、事故和人工审批",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese summary removes literal and machine-generated phrasing", () => {
  for (const phrase of [
    "当作技术栈形状的一部分来读",
    "哪些实践变成常识",
    "最值得担心的",
    "可取得性",
    "运行发布",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the rewritten ecosystem summary renders through its Part XII handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/summary.html",
    chapterTitle: "小结",
    chapterNum: "",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chinese, ctx);
  expect(html).toContain("生态系统是其中的一种机制");
  expect(html).toContain("第十二部分");
  expect(html).not.toContain("katex-error");
  expect(headings.length).toBe(0);
});
