import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/orientation/index.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/orientation/index.qmd"), "utf8");
const enFlat = en.replace(/\s+/g, " ");

test("the Chinese Part 0 opening preserves the English entry points and causal claim", () => {
  expect(enFlat).toContain("a model release, a benchmark jump, a GPU bill, a latency incident");
  expect(zh).toContain("模型发布、基准成绩跃升、GPU 账单、延迟故障");
  expect(zh).toContain("问题看似出在局部，原因却很少止于局部");
  expect(zh).toContain("一项建模思路之所以可行");
  expect(zh).not.toContain("前言已经给出全书的主线");
  expect(zh).not.toContain("长上下文为什么让服务变慢");
});

test("the whole-stack tour keeps every layer and its limited purpose", () => {
  expect(enFlat).toContain("cross data, tokenization");
  for (const phrase of [
    "数据、分词（把文本切成整数片段）、基座模型形成（训练原始模型）",
    "适配（调整训练后模型的行为）、服务、检索和智能体运行时",
    "把文本切成整数片段",
    "训练原始模型",
    "调整训练后模型的行为",
    "暂时不必深入掌握这些层",
    "同一条路径上的不同成本与选择",
  ]) expect(zh).toContain(phrase);
});

test("the field map, borrowed language, and boundary match the English scope", () => {
  expect(zh).toContain("推理能力的提升、可解释性、智能体架构和评测");
  expect(zh).toContain("借来的机制与借来的图景");
  expect(zh).toContain("不应把这些词误当成事物本身");
  expect(zh).toContain("信息流、搜索排序和广告竞价");
  expect(zh).toContain("继承了什么、哪些无法复用，又在哪里逐渐汇合");
  expect(zh).not.toContain("强化学习、热力学等领域");
});

test("the closing orientation and reading guidance remain complete", () => {
  for (const phrase of [
    "走完整条技术栈的路线已经清楚",
    "哪些主张仍有争议，哪些已经成为稳定结论",
    "从任何一个实际问题切入",
    "首次出现时都会写出中文全称和英文原文",
    "指向这个概念第一次得到完整解释的位置",
    "Transformer 如何把词元变成预测",
    "注意力、键值（KV）缓存、预填充和解码阶段",
  ]) expect(zh).toContain(phrase);
});
