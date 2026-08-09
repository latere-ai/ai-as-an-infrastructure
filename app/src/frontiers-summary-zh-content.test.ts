import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/frontiers/summary.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/frontiers/summary.qmd", import.meta.url),
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

test("the Chinese frontiers summary preserves the complete English shape", () => {
  expect(chinese).toMatch(/^# 小结 \{#part-frontiers-summary \.unnumbered\}/);
  expect(paragraphs(english).length).toBe(3);
  expect(paragraphs(chinese).length).toBe(3);
  expect(chinese).not.toMatch(/^## /m);
  expect(chinese).not.toMatch(/^[-*] /m);
});

test("the recap preserves all three limits and their qualifications", () => {
  for (const phrase of [
    "单靠增加算力无法跨越的三类边界",
    "有限的人类文本存量",
    "合成数据",
    "从可检查的环境获得奖励",
    "在推断阶段投入更多算力",
    "部署后持续学习",
    "50% 的成功率",
    "可处理的任务时长会缩短数倍",
    "生成主张的成本很低，核实主张却不便宜",
  ]) expect(flat).toContain(phrase);
});

test("the synthesis explains why acceptance capacity becomes scarce", () => {
  for (const phrase of [
    "真正紧缺的资源已经从生成能力转向验收能力",
    "候选答案、程序、证明、设计和假设",
    "使结果足以被采信的证据与制度基础",
    "可检查的证明对象",
    "独立复现或复制",
    "对抗性审查",
    "背书者经得起审计的履责记录",
  ]) expect(flat).toContain(phrase);
});

test("the handoff keeps the technical and market sides of verification", () => {
  for (const phrase of [
    "可采信的知识",
    "由谁承担验证成本",
    "谁的验证获得承认",
    "由市场而不是实验室决定",
    "第十一部分",
    "能力的成本",
    "发布条件",
    "行业结构",
    "架构的一部分",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese summary removes literal and machine-generated phrasing", () => {
  for (const phrase of [
    "算力抬不起来",
    "每一条出路都只是改变了问题的形状",
    "测量比这更难对付",
    "任务时长这把尺子",
    "被引用的那个数字",
    "同一次转移",
    "约束从生产端挪到了接受端",
    "相信这个结果的依据",
    "卖能力的这个行业",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the rewritten frontiers summary renders through its handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/summary.html",
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
  const { html } = renderMarkdown(chinese, ctx);
  expect(html).toContain("第十一部分");
  expect(html).toContain("可采信的知识");
  expect(html).not.toContain("katex-error");
});
