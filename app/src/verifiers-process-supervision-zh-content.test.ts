import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/reasoning/04-verifiers-process-supervision.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/reasoning/04-verifiers-process-supervision.qmd", import.meta.url),
  "utf8",
);
const zhFigure = readFileSync(
  new URL("../../zh/figures/verifiers-process-supervision-1.svg", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function normalizedMath(source: string): string[] {
  return matches(source, /\$\$\s*([\s\S]*?)\s*\$\$/g).map((block) =>
    block.replace(/\s+/g, " ").trim(),
  );
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

function definedFigures(source: string): string[] {
  return matches(source, /\{#(fig-[\w-]+)\}$/gm).sort();
}

test("Chapter 27 preserves the complete English verifier contract", () => {
  expect(matches(zh, /^## (.+)$/gm)).toEqual([
    "三个彼此独立的问题",
    "结果监督与过程监督",
    "候选选择需要明确约定",
    "如何评估验证器",
    "生成式验证器",
    "当检查器成为优化目标",
    "生产记录",
    "争议：过程监督是否更好",
    "下层约束",
    "延伸阅读",
  ]);
  expect(definedFigures(zh)).toEqual(definedFigures(en));
  expect(zh.match(/^:::: \{\.runnable\}$/gm) ?? []).toHaveLength(1);
  expect(normalizedMath(zh)).toEqual(normalizedMath(en));
  expect(pythonBlocks(zh)).toEqual(pythonBlocks(en));
});

test("citations and cross-references stay aligned with English", () => {
  const referencePattern = /(@(?:sec|fig|gls)-[A-Za-z0-9_-]+|@[a-z]+[0-9][A-Za-z0-9_-]*)/g;
  expect(matches(zh, referencePattern)).toEqual(matches(en, referencePattern));
});

test("the localized taxonomy figure uses the chapter's verifier terminology", () => {
  expect(zhFigure).toContain("习得模型");
  expect(zhFigure).toContain("人工审查");
  expect(zhFigure).not.toContain("学习模型");
  expect(zhFigure).not.toContain("人工审核");
});

test("the opening defines a verifier without treating it as an oracle", () => {
  for (const phrase of [
    "只有当系统能够识别哪一份解答值得信任",
    "接收问题和候选项",
    "接受、拒绝、排序、修订或奖励",
    "并不是真理预言机",
    "特定规格下的一项特定判断",
    "都不能单独证明被检查对象回答了用户的实际请求",
  ]) expect(zh).toContain(phrase);
});

test("the taxonomy keeps three independent design choices separate", () => {
  for (const phrase of [
    "有些属性彼此不同，却被放在同一条尺度上",
    "有用的分类不是一条阶梯",
    "信号附着在哪里",
    "判断如何产生",
    "返回什么",
    "验证器描述的是系统角色",
    "差别在于能否写出规格",
  ]) expect(zh).toContain(phrase);
});

test("outcome and process supervision define distinct label targets", () => {
  for (const phrase of [
    "终端对象",
    "局部正确性",
    "进展",
    "后续价值",
    "三种目标不能互换",
    "这里的中间对象可以是",
    "聚合规则",
    "结果标签通常更便宜",
    "过程标签提供了更早的干预位置",
  ]) expect(zh).toContain(phrase);
});

test("process-supervision evidence retains its experimental boundaries", () => {
  for (const phrase of [
    "GSM8K",
    "固定生成器的 best-of-$N$ 设置",
    "约 80 万个人工步骤标签",
    "不能证明每一个过程标签都优于每一次终端检查",
    "共识过滤器",
    "3,400 份人工标注的解答",
    "找出最早出现错误的步骤",
    "更难的竞赛题",
  ]) expect(zh).toContain(phrase);
});

test("selection is defined against independent task utility", () => {
  for (const phrase of [
    "生成器决定有哪些候选项可供选择",
    "验证器决定返回哪一个",
    "选择器最大化的是验证器分数，而不是任务效用",
    "样本池里效用最高的候选项",
    "并不表示样本池里有完美答案",
    "这里的 $N$ 是候选项数量",
    "约 400 个候选项时达到峰值，之后反而下降",
  ]) expect(zh).toContain(phrase);
});

test("the runnable reproduces proxy over-optimization", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "N=1: selected='direct partial'; selection regret=0.00",
    "N=2: selected='careful correct'; selection regret=0.00",
    "N=3: selected='concise correct'; selection regret=0.00",
    "N=4: selected='polished wrong'; selection regret=0.75",
  ]);
});

test("verifier evaluation covers deployment errors and optimized tails", () => {
  for (const phrase of [
    "误接收率",
    "误拒绝率",
    "排序和校准是两种不同性质",
    "选择最大分数会改变下游用户面对的分布",
    "按难度、长度和领域分层",
    "部署中的生成器、温度、提示、工具和搜索策略",
    "经过优化的分布尾部",
    "每当生成器、搜索预算、检查器、提示、评分准则或分数提取器改变",
  ]) expect(zh).toContain(phrase);
});

test("generative verifiers expose hypotheses without granting trust", () => {
  for (const phrase of [
    "用额外的测试时算力改善 best-of-$N$ 选择",
    "约 8,000 个过程标签",
    "不能证明写出的论证会让判断正确",
    "一条便于调试的假设",
    "默认不能当作忠实解释",
    "不可信的模型输出",
    "严格的结构约定",
    "绝不能执行评析中的指令",
  ]) expect(zh).toContain(phrase);
});

test("optimization pressure is separated from independent release judgment", () => {
  for (const phrase of [
    "任何系统性盲点都会成为优化目标",
    "经过优化的验证器不能同时充当唯一的发布评判者",
    "把职责分开",
    "保留隐藏检查",
    "发布评估器要独立于被优化的信号",
    "停止增加样本数、搜索深度或强化学习步数",
    "弃答，或转交更强的检查器或人工评审",
    "只有在各层提供不同证据时，分层才有帮助",
  ]) expect(zh).toContain(phrase);
});

test("the production record can reconstruct generation through selection", () => {
  for (const phrase of [
    "生成器、验证器、提示、评分准则和分数提取器",
    "记录所有被考虑过的候选项，而不只是胜出者",
    "生成、验证、提取还是选择环节",
    "按相同总成本比较方案",
    "生成、验证、执行和人工评审成本",
  ]) expect(zh).toContain(phrase);
});

test("the contested boundary and closing preserve the system argument", () => {
  for (const phrase of [
    "过程监督并不天然优于其他监督",
    "这些发现涉及不同的任务、标签、模型和信号用途",
    "给定预算和风险条件下",
    "更高的留出任务效用",
    "额外的生成器算力只会带来更多验证和审计工作",
    "奖励规定的是优化器能够看到什么",
  ]) expect(zh).toContain(phrase);
});

test("the rewrite removes the old ladder and unsupported shortcuts", () => {
  for (const rejected of [
    "## 验证器阶梯",
    "这条阶梯按语义强度排序",
    "这条阶梯也解释了",
    "正确的验证器是一组验证器",
    "最弱的那层往往决定了整体的上限",
    "@sec-rlhf",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
