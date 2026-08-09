import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/09-embeddings-representation.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/09-embeddings-representation.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
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

test("Chapter 45 preserves the complete English embedding contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "从评分契约开始",
    "池化决定一个向量包含什么",
    "对比学习塑造排序",
    "交互发生的位置决定成本边界",
    "训练数据定义何为相关",
    "一个模型可以提供多套契约",
    "索引把兼容性约束落实到运行中",
    "评估必须匹配用途",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(fenceCount(chapter, "```text")).toBe(1);
  expect(fenceCount(chapter, "```python")).toBe(1);
  expect(fenceCount(chapter, "```\\{dot\\}")).toBe(1);
  expect(chapter.match(/<figure id=/g)?.length).toBe(1);
  expect(chapter.match(/\.runnable/g)?.length).toBe(1);
});

test("the opening defines an embedding as one bounded scoring interface", () => {
  for (const phrase of [
    "带版本的评分接口",
    "定长向量",
    "训练过程判定为相关",
    "距离近本身并不意味着",
    "同义",
    "事实正确",
    "获得同一位用户的授权",
    "一份排序契约",
    "不是去发现一套通用的意义几何",
  ]) expect(flat).toContain(phrase);
});

test("the embedding spec records every compatibility choice", () => {
  for (const phrase of [
    "索引模式的一部分",
    "兼容的查询侧规格",
    "不同的前缀",
    "不同的编码器权重",
    "另一套评分函数",
  ]) expect(flat).toContain(phrase);
  for (const field of [
    "EmbeddingSpec",
    "EmbeddingRecord",
    "model_revision",
    "tokenizer_revision",
    "query_role",
    "document_role",
    "instruction_version",
    "truncation_policy",
    "normalization",
    "similarity",
    "quantization",
    "embedding_spec_hash",
    "index_generation",
  ]) expect(chapter).toContain(field);
});

test("similarity normalization and pooling state their exact contracts", () => {
  for (const phrase of [
    "内积",
    "单位长度向量",
    "平方欧氏距离",
    "向量长度会影响内积",
    "必须与训练和索引保持一致",
    "带掩码的平均池化",
    "排除填充词元",
    "特殊词元池化",
    "各坐标取最大值",
    "学习得到的注意力",
    "池化后是否归一化",
  ]) expect(flat).toContain(phrase);
});

test("language-model geometry remains a bounded diagnostic", () => {
  for (const phrase of [
    "未经适配的语言模型状态",
    "并不会天然构成检索度量",
    "各向异性",
    "几何上的警示",
    "不能证明各向异性会导致所有池化失败",
    "纠正各向异性本身",
    "仍要以目标查询和语料分布上的排序质量为准",
  ]) expect(flat).toContain(phrase);
});

test("contrastive learning keeps its batch and sampling assumptions explicit", () => {
  for (const phrase of [
    "一个批次由 $B$ 个带标签的样本对",
    "候选负样本",
    "训练时实际提供的那组负样本",
    "互信息下界",
    "上限随 $\\log B$ 增长",
    "挖掘分布",
    "可能使标准的互信息解释失效",
    "并不能保证下界更紧或检索器更好",
  ]) expect(flat).toContain(phrase);
});

test("geometry and temperature claims retain their limits", () => {
  for (const phrase of [
    "对称采样模型",
    "诊断类比，而不是适用于所有双编码器的定理",
    "放大被误标的负样本",
    "破坏有用的局部邻域",
    "不存在与任务无关的最佳温度",
    "分数尺度发生变化",
  ]) expect(flat).toContain(phrase);
});

test("interaction placement states what can be indexed and what it costs", () => {
  for (const phrase of [
    "决定哪些工作可以预先计算",
    "双编码器",
    "后期交互",
    "交叉编码器",
    "可以建立什么索引",
    "有界的候选集合",
    "每个查询词元",
    "索引需要为每篇文档保存多个向量",
    "并不是与单向量索引相比",
  ]) expect(flat).toContain(phrase);
});

test("training rows define relevance and preserve uncertainty", () => {
  for (const phrase of [
    "正样本对策略",
    "表达的是不同的关系",
    "来源和许可证",
    "标签来源与置信度",
    "去重组",
    "已知正样本和重复组",
    "未经过判断，并不等于已知不相关",
    "错误负样本",
    "交给人工判断",
  ]) expect(flat).toContain(phrase);
});

test("weak supervision and distillation retain provenance and limits", () => {
  for (const phrase of [
    "弱监督扩大正样本覆盖范围",
    "生成器的事实错误、写作风格和任务假设",
    "生成提示、生成器版本、过滤规则和来源权利",
    "先按来源和时间划分数据",
    "蒸馏会继承教师模型的偏差",
    "教师模型见到的候选集合",
    "挖掘过程从未呈现过",
  ]) expect(flat).toContain(phrase);
});

test("instructions and Matryoshka dimensions are versioned interfaces", () => {
  for (const phrase of [
    "并不意味着它会把任意自然语言理解为策略",
    "指令大多当作额外关键词",
    "确切的指令模板",
    "否定、排除条件和相互冲突的约束",
    "独立归一化",
    "只有训练过的维度才有性能承诺",
    "多个训练损失并非没有成本",
    "每一种对外提供的维度",
  ]) expect(flat).toContain(phrase);
});

test("index generations make compatibility migration and deletion operational", () => {
  for (const phrase of [
    "原始向量载荷",
    "不包括文档元数据",
    "创建新的索引代次",
    "不要比较一个模型的查询向量与另一个模型的文档向量",
    "在现有索引旁边构建替代索引",
    "先比较精确向量排序",
    "避免把表示漂移与 ANN 损失混为一谈",
    "保留回滚窗口",
    "每个仍在服务的索引代次",
  ]) expect(flat).toContain(phrase);
});

test("derived embeddings inherit source security and data policy", () => {
  for (const phrase of [
    "派生内容，不是匿名化内容",
    "租户、授权、保留期限、数据驻留和删除策略",
    "授权不变量的路径",
    "规格哈希、输入内容哈希、角色、指令版本",
    "供应商日志和批处理路径",
  ]) expect(flat).toContain(phrase);
});

test("evaluation separates representation approximation operations and answers", () => {
  for (const phrase of [
    "只能用于初步筛选",
    "不能复现私有语料",
    "精确搜索的 recall@k 和 nDCG@k",
    "ANN 相对精确近邻的召回率",
    "表现最差且影响显著的切片",
    "查询编码延迟",
    "迁移持续时间",
    "端到端",
    "配对的逐查询比较",
    "自助法置信区间",
    "撤销访问权限",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary and handoff preserve the systems argument", () => {
  for (const phrase of [
    "能否服务所有任务仍无定论",
    "没有任何一种方法在所有任务上占优",
    "取决于实际测量的任务组合、语言、语料和成本边界",
    "维度会成倍放大原始索引载荷",
    "后期交互会增加需要保存的向量数量",
    "带版本的评分结果",
    "授权、时效、融合和不作答",
    "有界的工作上下文",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("@sec-context-engineering");
});

test("the rewrite removes obsolete certainty and historical leaderboard narrative", () => {
  for (const phrase of [
    "生成器的隐藏状态不适合作为度量空间",
    "负样本的选择是核心训练变量",
    "正样本是给定的",
    "直接抬升检索质量",
    "常在 $0.05$ 到 $0.1$ 附近",
    "且不增加任何训练成本",
    "在那个尺寸上原生训练出来的一样准确",
    "登上了 MTEB 之巅",
    "到 2026 年，多语言榜首",
    "这一领域的形状",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the contract diagram and InfoNCE visualization are localized", () => {
  for (const phrase of [
    'query [label="查询 + 角色"]',
    'source [label="分块 + 来源版本"]',
    'qenc [label="查询转换"]',
    'index [label="带版本的向量索引"]',
    'score [label="兼容的评分器"]',
    'ranked [label="已排序的候选项"]',
    'data-viz="infonce-field" data-lang="zh"',
    "困难错误负样本会朝错误方向提供很强的信号",
  ]) expect(chapter).toContain(phrase);
  expect(chapter).not.toContain("encoder-interaction");
  expect(chapter).not.toContain("embed-lineage");
});

test("wide scoring and Matryoshka equations use mobile-safe rows", () => {
  for (const pattern of [
    /\\begin\{aligned\}\s*u &= E_q\(x\),\\\\\s*v &= E_d\(y\),/,
    /\\widehat\{u\}&=\\frac\{u\}\{\\lVert u\\rVert_2\},\\qquad\s*\\widehat\{v\}&=/,
    /\\begin\{aligned\}\s*z\^\{\(m\)\}&=/,
  ]) expect(chapter).toMatch(pattern);
});
