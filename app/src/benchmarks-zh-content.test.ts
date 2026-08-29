import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/01-benchmarks.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/01-benchmarks.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map(
    (match) => match[1],
  );
}

function canonicalMath(source: string): string {
  return source
    .replace(/\\(?:begin|end)\{(?:aligned|gathered)\}/g, "")
    .replace(/\\\\/g, "")
    .replace(/\\quad|\\qquad|&|\{\}/g, "")
    .replace(/\s+/g, "");
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function fenceCount(source: string, opening: string): number {
  return [...source.matchAll(new RegExp(`^${opening}$`, "gm"))].length;
}

test("Chapter 47 preserves the complete English benchmark contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "基准是一份测量契约 {#sec-benchmarks}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "从决策出发，而不是从数据集出发",
    "决策同时决定了要测什么量",
    "明确评测对象",
    "留出数据究竟要避开哪些环节",
    "审计测量工具",
    "运行框架也是受测系统的一部分",
    "争议所在",
    "基准会衰退",
    "运行、保留与报告",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(fenceCount(chapter, "```text")).toBe(1);
  expect(fenceCount(chapter, "```\\{dot\\}")).toBe(1);
  expect(fenceCount(chapter, "```python")).toBe(0);
  expect(chapter.match(/\.runnable/g)?.length ?? 0).toBe(0);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(
    english.match(/^\|.+\|$/gm)?.length,
  );
  expect(chapter.match(/^!\[/gm)?.length).toBe(1);
});

test("the opening defines a score as the output of a versioned system", () => {
  for (const phrase of [
    "并不只是模型权重的属性",
    "一个模型版本",
    "一套运行框架",
    "一个测试集版本",
    "一套评分器和汇总规则",
    "从评测要支持的主张写起",
    "让别人能够重建这项主张",
  ]) expect(flat).toContain(phrase);
});

test("benchmark selection begins with a bounded decision claim", () => {
  for (const phrase of [
    "回答谁的问题",
    "在什么条件下",
    "付出多少成本",
    "支持哪项决策",
    "总体、系统边界、比较对象和约束条件",
    "没有任何单一公开基准能够独自决定",
    "产品主张需要由贴近实际产品分布的样本来支持",
  ]) expect(flat).toContain(phrase);
});

test("benchmark forms state both observable evidence and limits", () => {
  for (const phrase of [
    "封闭答案题",
    "可执行任务",
    "合成探针",
    "人工偏好比较",
    "交互式环境",
    "不是同一种能力的可互换度量",
    "看板变得更大，却让含义更模糊",
  ]) expect(flat).toContain(phrase);
});

test("evaluation artifacts preserve data system scorer and per-case evidence", () => {
  for (const field of [
    "EvaluationSpec",
    "EvaluationCase",
    "EvaluationRecord",
    "benchmark_revision",
    "item_manifest_hash",
    "model_revision",
    "tokenizer_revision",
    "prompt_template_revision",
    "tool_environment_revision",
    "scorer_revision",
    "contamination_audit_revision",
    "raw_output_hash",
    "scorer_trace",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "汇总分数可以由这些案例级记录重新计算",
    "记录一旦丢弃，汇总分数无法把它们还原",
    "等权重并不等于没有假设",
    "同一批案例上的比较",
    "同一个代码仓库尝试二十次，并不等于二十个相互独立的仓库",
  ]) expect(flat).toContain(phrase);
});

test("held-out status covers the complete adaptive pipeline", () => {
  for (const phrase of [
    "刻意排除在所有训练阶段之外的数据",
    "流水线契约，不是文件自身能够证明的属性",
    "暴露情况未知",
    "训练泄漏",
    "间接泄漏",
    "开发泄漏",
    "报告泄漏",
    "自适应过拟合",
    "最后一道独立检查",
    "访问历史和以往决策",
  ]) expect(flat).toContain(phrase);
});

test("contamination audits retain scope instead of certifying absence", () => {
  for (const phrase of [
    "审计只能提供是否暴露的证据，不能证明从未暴露",
    "精确哈希和 n-gram 匹配",
    "金丝雀字符串",
    "成员推断测试，会在无法查看语料时，通过模型权重推测某个具体样本是否用于训练",
    "阴性结果不能证明样本从未出现",
    "known_overlap",
    "suspected_overlap",
    "no_overlap_found_under_audit_X",
    "not_auditable",
    "「新鲜」与「有效」回答的是两个不同问题",
  ]) expect(flat).toContain(phrase);
});

test("the instrument audit checks cases baselines revisions and rights", () => {
  for (const phrase of [
    "即使测试确实从未出现过，也仍可能出错",
    "一种站得住脚的解释",
    "其他有效答案能否通过归一化和解析",
    "许可证与访问条款",
    "裁定日志",
    "修正一个项目就会产生新的基准版本",
    "简单基线",
    "输给简单启发式方法",
  ]) expect(flat).toContain(phrase);
});

test("model and best-system comparisons answer different questions", () => {
  for (const phrase of [
    "受控模型比较",
    "最佳系统比较",
    "不要把后者称为权重比较",
    "说明实际运行的是哪一种实验",
    "保留解析前的原始输出",
    "invalid",
    "unknown",
    "timeout",
    "scorer_error",
    "自动评分不等于没有解释空间",
  ]) expect(flat).toContain(phrase);
});

test("benchmark decay has independent causes and a maintenance response", () => {
  for (const phrase of [
    "暴露",
    "自适应复用",
    "饱和",
    "总体漂移",
    "评分器漂移",
    "不要不加判断地堆入更难的问题",
    "像维护生产依赖一样维护基准",
    "稳定的锚点集合",
  ]) expect(flat).toContain(phrase);
});

test("the operating procedure retains evidence and four audit invariants", () => {
  for (const phrase of [
    "冻结模型、运行框架、评分器、项目清单",
    "保存每次尝试的原始输出、解析结果、评分轨迹、成本和失败状态",
    "在正确的抽样单位上汇总",
    "任何评测案例都不能进入训练或调优流程",
    "任何项目都不能悄无声息地消失",
    "原始输出不可修改",
    "每个报告数字都能追溯到规格哈希和案例级记录",
    "从带限定条件的主张开始",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary lower layers and statistical handoff stay precise", () => {
  for (const phrase of [
    "固定运行框架有利于归因和复现",
    "针对模型定制的运行框架",
    "两种数字回答的是不同问题",
    "留出完整性由评测层之下决定",
    "无法重建下层没有保留的来源链路",
    "即使分数非常精确，仍然可能无法解释",
    "不要把精确度误当成效度",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("@sec-statistical-reliability");
});

test("the rewrite removes obsolete certainty catalogs and runnable examples", () => {
  for (const phrase of [
    "一个错误数字的解剖",
    "唯一的办法",
    "瑞士奶酪模型",
    "前沿模型如今已接近天花板",
    "前沿模型聚集在 90% 以上",
    "公开基准应当假定",
    "私有留出集是可信的",
    "动态评估",
    "能抵抗操弄",
    "rng = np.random.default_rng",
    "fig-benchmarks-contamination",
    "fig-benchmarks-harness",
    "fig-benchmarks-2",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the measurement-contract diagram is localized", () => {
  for (const phrase of [
    'C [label="预期主张"]',
    'S [label="带版本的规格"]',
    'I [label="案例清单"]',
    'R [label="案例级记录"]',
    'A [label="汇总 + 切片"]',
    'D [label="决策"]',
  ]) expect(chapter).toContain(phrase);
});
