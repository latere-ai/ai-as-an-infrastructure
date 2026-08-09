import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/practice/index.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/practice/index.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function blocks(source: string) {
  return source
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("the Chinese Part XII introduction preserves the complete English shape", () => {
  expect(chinese).toMatch(/^# 第十二部分 · 实践与运营 \{#part-practice \.unnumbered\}/);
  expect(blocks(chinese).length).toBe(blocks(english).length);
  expect(blocks(chinese).length).toBe(4);
  expect(refs(chinese)).toEqual(refs(english));
  expect(chinese).not.toMatch(/^## /m);
  expect(chinese).not.toMatch(/^[-*] /m);
  expect(chinese).not.toMatch(/```|\$\$|::: \{/);
});

test("the epigraph is complete and idiomatic", () => {
  expect(flat).toContain("能够正常工作的复杂系统，必然是从能够正常工作的简单系统演化而来");
  expect(chinese).toContain('John Gall，["Systemantics"](https://en.wikipedia.org/wiki/Systemantics)');
});

test("the opening turns the prior three parts into operating constraints", () => {
  for (const phrase of [
    "进入本书最后一个主体部分，关注重点也随之改变",
    "第九部分揭示技术栈之下的物理底座",
    "第十部分讨论这套底座能转化出哪些能力及其边界",
    "第十一部分说明这些边界如何形成市场结构、开放策略、采用模式和数据权利安排",
    "团队如何组合整套技术栈",
    "让它在生产环境中持续运行",
    "不再只是追踪机制",
    "交付期限、预算、许可证、可靠性目标、不断更新的模型版本和生产事故",
    "作出取舍",
  ]) expect(flat).toContain(phrase);
});

test("the chapter map preserves every practical decision and long-tail concern", () => {
  for (const phrase of [
    "第一个实际选择",
    "租用前沿模型、运行开放模型，还是同时保留两种方案",
    "推理服务引擎、网关、算力、端侧部署和微调方案",
    "框架、沙箱、MCP、文档解析、检索和抽取",
    "评测、可观测性和预算",
    "面向 2026 年技术栈的参考架构",
    "版本晋级与回滚",
    "非确定性系统的可靠性",
    "人工审查界面",
    "审批关口",
    "生产数据、SLO、成本治理、事故响应和多租户隔离",
    "把故障转化为更好测试的闭环",
  ]) expect(flat).toContain(phrase);
});

test("the operating-contract framing preserves every invariant", () => {
  for (const phrase of [
    "不是一份照抄一次就结束的操作手册",
    "生产级 AI 系统",
    "必须始终成立的运营契约",
    "运行不变量",
    "模型版本必须固定",
    "预算限制必须执行",
    "数据必须经过明确信任判断",
    "沙箱必须约束执行",
    "租户边界必须隔离",
    "涉及外部影响的操作必须经过人工批准",
    "评测必须能够阻止不合格版本发布",
    "事故记录必须推动系统变更",
    "故障必须沉淀为训练信号",
    "契约明确且可验证",
    "不再只是工具的堆叠",
    "团队能够持续运营的系统",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes literal and unsupported formulations", () => {
  for (const phrase of [
    "实践视角",
    "把这套栈接起来",
    "第一个岔路",
    "保留两条路",
    "人机审查表面",
    "批准门",
    "副作用",
    "数据回路",
    "降级",
    "回退",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the rewritten introduction renders through its operating-contract close", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/index.html",
    chapterTitle: "第十二部分 · 实践与运营",
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
  expect(html).toContain("进入本书最后一个主体部分，关注重点也随之改变");
  expect(html).toContain("团队能够持续运营的系统");
  expect(html).not.toContain("katex-error");
  expect(headings.length).toBe(0);
});
