import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/safety/01-mechanistic-interpretability.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/01-mechanistic-interpretability.qmd", import.meta.url),
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

test("Chapter 54 preserves the complete English mechanistic-interpretability contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "机械可解释性 {#sec-interpretability}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "从解释性主张出发",
    "把特征与叠加视为假说",
    "用稀疏自编码器学习候选特征",
    "通过干预检验因果相关性",
    "把特征重新组合成电路假说",
    "测量方法遗漏了什么",
    "让研究可复现",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(chapter.match(/^!\[/gm)?.length).toBe(1);
  expect(chapter.match(/^<figure /gm)?.length).toBe(1);
  expect(chapter.match(/^```python$/gm)).toBeNull();
  expect(chapter.match(/\.runnable/g)).toBeNull();
  expect(chapter.match(/^\|.+\|$/gm)).toBeNull();
});

test("the opening defines a bounded explanatory claim", () => {
  for (const phrase of [
    "解释固定模型如何产生某项明确行为",
    "针对模型的内部计算提出人类可读的假说",
    "模型版本、输入群体、行为或输出，以及所研究的内部位置",
    "不是隐藏思维的逐字记录",
    "本身也不是安全保证",
    "描述、预测、干预和中介",
    "不能取代行为证据或明确的安全论证",
  ]) expect(flat).toContain(phrase);
});

test("the evidence ladder keeps labels prediction intervention and mediation separate", () => {
  for (const phrase of [
    "为内部单元或方向赋予可读模式",
    "连贯的标签不等于因果解释",
    "在留出输入上预测激活或行为",
    "只能证明所述干预下的必要性或充分性",
    "模型自然计算中的相关干预效应",
    "最薄弱的证据环节",
    "远超模型的正常激活范围",
  ]) expect(flat).toContain(phrase);
});

test("the localized evidence diagram preserves all validation levels", () => {
  for (const phrase of [
    'scope [label="明确行为与\\n内部位置"]',
    'describe [label="描述一个\\n候选模式"]',
    'predict [label="在留出输入上\\n检验预测"]',
    'intervene [label="干预一个\\n内部变量"]',
    'mediate [label="检验自然计算的\\n中介作用"]',
    'claim [label="陈述有边界的主张\\n与已知失效"',
  ]) expect(chapter).toContain(phrase);
});

test("features and superposition remain evidence-backed hypotheses", () => {
  for (const phrase of [
    "实现单元，不保证就是意义单元",
    "分析者提出的变量",
    "证据决定它是否成立",
    "表示的特征数多于维度数",
    "激活向量",
    "候选特征方向",
    "特征系数",
    "未解释残差",
    "稀疏性假设",
    "玩具模型证明这种压缩可以实现",
    "不能证明每个 Transformer 激活",
    "模型自身的本体结构",
  ]) expect(flat).toContain(phrase);
});

test("the superposition visualization is localized and bounded", () => {
  for (const phrase of [
    'data-viz="superposition"',
    'data-lang="zh"',
    "特征方向共享低维空间",
    "只用于说明叠加假说",
    "不是训练语言模型的实测证据",
  ]) expect(flat).toContain(phrase);
});

test("the TopK SAE formulation defines every tensor and selection rule", () => {
  for (const phrase of [
    "过完备字典",
    "目标稀疏度 $k$",
    "编码器矩阵",
    "解码器矩阵",
    "编码器偏置",
    "解码器偏置和中心化项",
    "至多有 $k$ 个非零元素",
    "最大的正预激活值",
    "经过非线性变换后的最大值",
    "必须说明采用哪条规则",
  ]) expect(flat).toContain(phrase);
});

test("the SAE objective exposes normalization and scale degeneracy", () => {
  for (const phrase of [
    "均方重构误差",
    "单位范数",
    "尺度退化",
    "潜变量大小和稀疏惩罚难以比较",
    "TopK 直接控制活跃潜变量数量",
    "死潜变量比例和优化质量",
  ]) expect(flat).toContain(phrase);
});

test("SAE quality is assessed on independent validity axes", () => {
  for (const phrase of [
    "重构保真度",
    "下游保真度",
    "激活稀疏度",
    "死潜变量",
    "跨随机种子的稳定性",
    "语义有效性",
    "因果效用",
    "没有任何单项指标可以认证一部字典",
    "字典宽度不能保证",
  ]) expect(flat).toContain(phrase);
});

test("activation patching declares its counterfactual design", () => {
  for (const phrase of [
    "干净运行和受扰运行",
    "从干净运行中取出一个内部组件",
    "补入受扰运行",
    "恢复了多少",
    "$h_j(x_s)$ 是来源激活",
    "对这一组对照具有因果相关性",
    "不能识别唯一机制",
    "扰动方法、输出指标、补丁位置与粒度",
    "必要性检验、充分性检验、路径补丁和消融",
  ]) expect(flat).toContain(phrase);
});

test("feature steering retains the boundary of its intervention evidence", () => {
  for (const phrase of [
    "金门大桥潜变量",
    "在这项干预下影响行为",
    "不能仅凭这一结果证明该方向唯一、标准",
    "与桥梁相关行为的完整自然中介变量",
  ]) expect(flat).toContain(phrase);
});

test("circuit hypotheses stay local causal abstractions", () => {
  for (const phrase of [
    "相对于某项行为和输入分布定义的因果子图",
    "预测覆盖率和干预保真度",
    "归纳头",
    "归纳机制的证据",
    "不能证明归纳头解释了所有上下文学习",
    "替代模型",
    "固定注意力模式",
    "一次计算的局部假说",
    "不是原模型的完整轨迹",
    "大边权不自动等于",
  ]) expect(flat).toContain(phrase);
});

test("the failure inventory bounds every interpretation", () => {
  for (const phrase of [
    "重构误差",
    "特征分裂",
    "特征吸收",
    "不可辨识性",
    "监督式神经元探针",
    "普通主成分方向",
    "分布迁移",
    "标签错误",
    "覆盖范围有限",
    "局部解释",
    "不能在没有下游检验和干预检验时称其无害",
  ]) expect(flat).toContain(phrase);
});

test("the retained study record makes the work reproducible", () => {
  for (const field of [
    "study_id",
    "model_and_tokenizer_hashes",
    "behavior_and_output_metric",
    "input_population_and_splits",
    "activation_sites",
    "method_and_code_revision",
    "dictionary_width_and_sparsity",
    "training_data_and_seeds",
    "baselines_and_validity_metrics",
    "intervention_protocol",
    "retained_artifacts",
    "claim_scope_and_known_failures",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "不是一张孤立的特征截图",
    "重新运行特征提取",
    "支持主张和不支持主张的案例",
    "不能单独授权安全决策",
  ]) expect(flat).toContain(phrase);
});

test("the contested scope compares methods without granting full understanding", () => {
  for (const phrase of [
    "这些方向意味着什么",
    "强而简单的基线",
    "悄无声息的召回失败",
    "标准单元",
    "替代架构",
    "留出预测、重构与下游保真度、干预效用、稳定性和人工审计成本",
    "数千万个非零参数",
    "没有任何现有方法足以证明模型已被完全理解",
  ]) expect(flat).toContain(phrase);
});

test("the lower-layer boundary and oversight handoff remain explicit", () => {
  for (const phrase of [
    "张量限制了能够测量和干预的对象",
    "不能决定正确的解释单元",
    "同一计算的不同抽象",
    "行为、输入分布和证据等级",
    "内部机制是否存在、是否活跃、是否具有因果相关性",
    "确保解释不完整或错误时，控制仍然有效",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete narrative and extra artifacts", () => {
  for (const phrase of [
    "一个训练好的 Transformer 是几千亿个数字",
    "一个神经元为什么很少只意味一件事",
    "处理多义性的两个想法",
    "从特征到电路",
    "从手工电路到因果图",
    "稀疏自编码器正在接受检验",
    "字典留下了什么",
    "反编译",
    "生产级模型",
    "任何直接读神经元的方法都行不通",
    "一个无法用来操控的特征",
    ":::: {.runnable}",
    "```python",
    "—",
  ]) expect(chapter).not.toContain(phrase);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
});
