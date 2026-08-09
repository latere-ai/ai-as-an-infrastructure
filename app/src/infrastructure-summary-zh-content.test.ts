import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/summary.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/infrastructure/summary.qmd", import.meta.url),
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

test("the Chinese infrastructure summary preserves the complete English shape", () => {
  expect(chinese).toMatch(/^# 小结 \{#part-infrastructure-summary \.unnumbered\}/);
  expect(paragraphs(english).length).toBe(3);
  expect(paragraphs(chinese).length).toBe(3);
  expect(chinese).not.toMatch(/^## /m);
  expect(chinese).not.toMatch(/^[-*] /m);
});

test("the recap follows the stack from bandwidth to failure", () => {
  for (const phrase of [
    "加速器带宽",
    "自动微分",
    "训练框架",
    "编译器与内核",
    "数据搬运量，而不是 FLOPs",
    "软件生态",
    "长期积累",
    "集群编排",
    "数据基础设施",
    "芯片制造",
    "供电",
    "规模化系统中的故障",
  ]) expect(flat).toContain(phrase);
});

test("the summary names the operating limits hidden by a model card", () => {
  for (const phrase of [
    "模型卡上",
    "HBM",
    "网络层级",
    "电力接入",
    "出口管制",
    "检查点系统",
    "故障分布",
    "不断变化的物理条件与运行约束",
    "最终无法运行",
  ]) expect(flat).toContain(phrase);
});

test("the handoff separates supply limits from limits above the machine", () => {
  for (const phrase of [
    "先进封装、HBM 和并网接入",
    "训练路线图",
    "出口管制",
    "晶圆厂产能",
    "等待期以年计算的电网接入队列",
    "无法凭空增加训练数据",
    "无法衡量最终模型的能力",
    "无法降低核验系统产出结论的成本",
    "第十部分",
    "位于机器之上",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese summary removes literal and machine-generated phrasing", () => {
  for (const phrase of [
    "夹在中间的软件基座",
    "做过的 FLOPs",
    "软件沉积",
    "行业最深的护城河",
    "反复落回同一点",
    "一条故障分布",
    "一条按年计算的并网排队",
    "这套底座都供不出",
    "一个已经产出的主张",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the rewritten infrastructure summary renders through its handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "infrastructure/summary.html",
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
  expect(html).toContain("第十部分");
  expect(html).toContain("位于机器之上");
  expect(html).not.toContain("katex-error");
});
