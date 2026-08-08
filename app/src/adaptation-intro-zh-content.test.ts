import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/adaptation/index.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/index.qmd", import.meta.url),
  "utf8",
);

function bodyParagraphs(source: string): string[] {
  const quoteEnd = source.indexOf("\n\n", source.indexOf("https://"));
  return source
    .slice(quoteEnd + 2)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function crossReferences(source: string): string[] {
  return [...source.matchAll(/@sec-[\w-]+/g)].map(([reference]) => reference);
}

test("the Part III opener preserves the English quotation and three-part argument", () => {
  expect(bodyParagraphs(en)).toHaveLength(3);
  expect(bodyParagraphs(zh)).toHaveLength(3);
  expect(zh).toContain("把语言模型做得更大，并不会自动让它更善于遵循用户意图");
  expect(zh).toContain("所谓后训练，就是预训练完成后继续调整模型的阶段");
  expect(zh).toContain("随着讨论推进，本部分会逐步收窄「对齐」一词的含义");
});

test("post-training closes the behavioral gap left by pre-training", () => {
  for (const phrase of [
    "预训练从原始数据中学习文本的结构与规律",
    "让这个基座模型表现出产品实际需要的行为",
    "产品希望它采取什么行为",
    "策略要求它拒绝哪些请求",
    "不同来源的要求发生冲突时，它该以哪一方为准",
    "人会偏好哪一个",
  ]) expect(zh).toContain(phrase);
});

test("capability is distinguished from a usable product interface", () => {
  expect(zh).toContain("权重中已经包含大量能力，但能力本身并不是可用的接口");
  expect(zh).toContain("引导和约束模型，对输出排序并加以检验");
  expect(zh).toContain("教它偏好一种回答而非另一种");
});

test("the Chinese route retains every English chapter cross-reference", () => {
  expect(crossReferences(zh)).toEqual(crossReferences(en));
  expect(crossReferences(zh)).toEqual([
    "@sec-sft-peft",
    "@sec-behavior-specs",
    "@sec-rlhf",
    "@sec-dpo-variants",
    "@sec-verifiable-rewards",
    "@sec-training-to-reason",
    "@sec-safety-tuning",
    "@sec-synthetic-data",
  ]);
});

test("demonstrations and preference specifications remain upstream of optimization", () => {
  expect(zh).toContain("用示范改变模型行为，通常只训练小型适配器");
  expect(zh).toContain("偏好信号究竟表示什么");
  expect(zh).toContain("行为规格、宪章、标注规范和多属性偏好数据");
  expect(zh).toContain("优化器接触数据之前");
});

test("reward modeling, direct preference objectives, and checkable rewards stay distinct", () => {
  expect(zh).toContain("系统不再依赖唯一正确答案，而是从回答间的比较中学习");
  expect(zh).toContain("奖励代理替人评分；这个代理本身也是一个习得模型");
  expect(zh).toContain("把这条回路化简为直接偏好目标");
  expect(zh).toContain("各类变体的差别不在口号，而在它们如何权衡不同目标");
  expect(zh).toContain("将习得奖励与可核查奖励分开");
});

test("safety tuning and synthetic data close the route without stronger claims", () => {
  expect(zh).toContain("拒绝、指令层级，以及模型如何依据成文策略作出判断");
  expect(zh).toContain("当数据不再直接来自人类标注者时");
  expect(zh).toContain("模型自己参与生成、筛选、评判并改进数据");
});

test("alignment is scoped to signals, proxy failures, and oversight", () => {
  expect(zh).toContain("把模型行为塑造成有帮助且安全，而不仅仅是准确");
  expect(zh).toContain("并不是一个在所有意义上都「好」的模型");
  expect(zh).toContain("选择什么训练信号、愿意承受哪些代理失效");
  expect(zh).toContain("决定监督机制应在回路的哪个位置介入");
  expect(zh).toContain("需要付出的不只是算力，还有对训练信号的信任，因为正是它告诉模型何为「更好」");
});

test("the Chinese opener avoids unsupported additions and translated phrasing", () => {
  for (const rejected of [
    "并不自然意味着",
    "文本和世界痕迹的形状",
    "什么时候该解释",
    "人或自动系统给出比较",
    "替代标注者",
    "根据检查器的反馈改进自己",
    "适配的关键不是口号里的对齐",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
