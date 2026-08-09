import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/02-statistical-reliability.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/02-statistical-reliability.qmd", import.meta.url),
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

function tableRows(source: string): string[] {
  return [...source.matchAll(/^\|.+\|$/gm)].map((match) => match[0]);
}

test("Chapter 48 preserves the complete English reliability contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "把统计可靠性写成决策契约 {#sec-statistical-reliability}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "先明确估计目标，再讨论区间",
    "让估计方法服从评测设计",
    "在同一批独立单位上比较系统",
    "预先说明什么结果会改变决策",
    "反复查看和多重主张都会消耗证据",
    "精确无法弥补偏差",
    "结果应当是一份可复现的决策记录",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(tableRows(chapter).length).toBe(tableRows(english).length);
  expect(chapter.match(/^!\[/gm)?.length).toBe(1);
  expect(chapter.match(/^```\{=html\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
});

test("the opening scopes reliability to a decision contract", () => {
  for (const phrase of [
    "只有评测设计说明了它在估计什么，基准分数才是估计值",
    "目标总体、抽样过程",
    "优势是否大到值得行动",
    "没有违反任何护栏",
    "观测数据能在多大程度上支持一项决策",
  ]) expect(flat).toContain(phrase);
});

test("the estimand names item run scorer and time variation", () => {
  for (const phrase of [
    "估计目标",
    "独立抽样单位",
    "目标总体 $P$",
    "生产分布 $Q$",
    "评分协议 $H$",
    "项目",
    "运行",
    "评分者",
    "时间",
  ]) expect(flat).toContain(phrase);
});

test("fixed-manifest description is not mislabeled as inference", () => {
  for (const phrase of [
    "完整的描述性结果",
    "没有需要估计的项目抽样误差",
    "引入了一个假想总体",
    "运行或评分者带来的不确定性仍可能存在",
  ]) expect(flat).toContain(phrase);
});

test("independence clustering and nested repeats stay explicit", () => {
  for (const phrase of [
    "表格有多少行，并不自动等于样本量有多大",
    "在同一个代码仓库上尝试二十次",
    "把相关的行当成彼此独立",
    "重采样或建模的单位应当是整个聚类",
    "把重复运行嵌套在任务之内",
  ]) expect(flat).toContain(phrase);
});

test("the Wald interval remains a bounded planning approximation", () => {
  for (const phrase of [
    "规划阶段的粗略估算",
    "不是通用于生产评测的区间方法",
    "Wilson 区间",
    "不是功效分析、配对比较或发布规则",
    "约需四倍的独立项目",
  ]) expect(flat).toContain(phrase);
});

test("bootstrap guidance preserves the evaluation design", () => {
  for (const phrase of [
    "重新计算完整的估计量",
    "不会替你找出正确的独立单位",
    "对相关行逐行做 bootstrap",
    "每次重采样都使用同一套预先声明的权重",
  ]) expect(flat).toContain(phrase);
});

test("confidence interval interpretation stays procedural", () => {
  for (const phrase of [
    "生成区间的程序会按其名义覆盖率覆盖那个固定目标",
    "这个已经算出的频率学派区间有 95% 的概率包含目标",
    "说明所用模型和先验",
  ]) expect(flat).toContain(phrase);
});

test("system comparison preserves paired differences", () => {
  for (const phrase of [
    "根据 $d_g$ 构造区间",
    "对成对聚类进行重采样",
    "会丢掉二者的协方差",
    "精确的配对二项方法",
    "任务 ID、双方原始输出、运行 ID、评分器版本",
  ]) expect(flat).toContain(phrase);
});

test("decision margins separate four distinct claims", () => {
  for (const phrase of [
    "最小关注效应",
    "具有实际意义的优势",
    "非劣效",
    "实际等效",
    "未解决",
    "没有拒绝精确的零效应，并不等于证明二者等效",
    "护栏需要各自的单侧界限",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("最小关注效应 $\\delta$");
  expect(chapter).toContain("$\\Delta = \\theta_B-\\theta_A$");
  expect(chapter).not.toContain("$delta$");
  expect(chapter).not.toContain("$Delta$");
});

test("power and invalid outcomes are planned before the decisive run", () => {
  for (const phrase of [
    "功效是指在给定假设下",
    "效应或界限、错误率、目标功效",
    "「使用 1,000 个样本」并不构成功效分析",
    "超时、解析失败、拒答和评分器错误",
  ]) expect(flat).toContain(phrase);
});

test("sequential multiplicity and adaptive reuse policies remain separate", () => {
  for (const phrase of [
    "第一次看到有利区间就停下来",
    "置信序列",
    "主要主张",
    "确认性次要主张",
    "探索性发现",
    "错误发现率",
    "开发期间无法访问的确认集",
  ]) expect(flat).toContain(phrase);
});

test("p-values precision bias and calibration are not conflated", () => {
  for (const phrase of [
    "不是零假设为真的概率",
    "精确的估计也可能精确地错",
    "置信区间并不涵盖污染",
    "校准是一个相关但不同的估计目标",
    "只看准确率无法证明模型已经校准",
  ]) expect(flat).toContain(phrase);
});

test("the result schema preserves the full analysis contract", () => {
  for (const field of [
    "target_population",
    "estimand",
    "independent_unit",
    "cluster_keys",
    "effect_margin",
    "interval_method",
    "sequential_rule",
    "multiplicity_family",
    "selection_history",
    "confirmation_set_version",
    "invalid_outcome_counts",
  ]) expect(chapter).toContain(field);
});

test("the procedure invariants contested boundary and handoff remain", () => {
  for (const phrase of [
    "根据评测设计和最小关注效应规划样本量",
    "让 A 和 B 在同一批单位上运行",
    "结果仍未解决，就如实说明",
    "任何一行都不能悄悄改变抽样单位",
    "方法再复杂，也无法弥补总体定义不清或评分器有偏",
    "可观测性保存的不只是调试轨迹，还包括实验设计",
    "@sec-human-evaluation-rubrics",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete shortcuts and unsupported claims", () => {
  for (const phrase of [
    "一个基准分数是估计值，不是事实",
    "准确率、胜率、评分准则分数和生产率都要当成随机变量来读",
    "误差棒藏起来的论断",
    "聚类标准误的三倍以上",
    "Bonferroni 校正",
    "Dror 等人",
    "较温和的立场",
    "bootstrap 正是在这里有用",
    "主主张",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
