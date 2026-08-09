import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/04-judging-holistic.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/04-judging-holistic.qmd", import.meta.url),
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

test("Chapter 50 preserves the complete English judge-evaluation contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "模型评判者与偏好排名 {#sec-judging-holistic}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "选择刚好够用的最窄评分器",
    "把评判者冻结为有版本的测量工具",
    "先验证，再扩大规模",
    "测量残余偏差，而不是要求模型保持中立",
    "把成对投票变成有条件的排名",
    "整体评测要保留结果向量",
    "把确认集守成一道信息边界",
    "模型评判式评测的运行契约",
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
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
  expect(chapter.match(/^```\{=html\}$/gm)?.length).toBe(1);
  expect(chapter).not.toContain(".runnable");
});

test("the opening defines a model judge as a second measurement instrument", () => {
  for (const phrase of [
    "把一份成文的评分准则变成成千上万次可重复的判断",
    "却不能把含糊的质量概念变成真值",
    "哪些决策、准则、案例和错误代价",
    "第二件测量工具",
    "不能取代真值来源",
  ]) expect(flat).toContain(phrase);
});

test("grader choice follows the property and available evidence", () => {
  for (const phrase of [
    "开放式输出并非全都无法核验",
    "确定性验证器",
    "受证据约束的检查器",
    "实际观测到的任务结果",
    "必要证据能够放进它的输入",
    "不具备的权限",
    "只证明这套协议在受测任务上的表现",
  ]) expect(flat).toContain(phrase);
});

test("holistic evaluation preserves coverage rather than one score", () => {
  for (const phrase of [
    "跨场景和指标的广泛、标准化覆盖",
    "并不是让一个评判者把所有性质压成一个分数",
    "场景与指标组成的矩阵",
    "没有写明规则的平均值并不整体",
  ]) expect(flat).toContain(phrase);
});

test("the complete judge and verdict contracts are versioned", () => {
  for (const field of [
    "judge_model_and_revision",
    "rubric_revision",
    "prompt_template_hash",
    "evidence_policy",
    "candidate_order_policy",
    "sampling_parameters",
    "parser_and_repair_revision",
    "judge_spec_hash",
    "raw_model_output",
    "tie_or_abstention_state",
    "latency_cost_and_attempts",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "产生新的评判者版本",
    "不能覆盖历史记录",
    "错误和后果不同的维度必须分开",
    "权重、否决条件和缺失数据处理方式",
  ]) expect(flat).toContain(phrase);
});

test("uncertainty states remain distinct and auditable", () => {
  for (const phrase of [
    "平局」「双方都失败」「证据不足」「准则不适用」和「评判者失败」",
    "不能混为一谈",
    "会把信息缺失和解析错误变成偏好数据",
    "解析失败也要保留原始回答",
    "交给合格的人或确定性检查器",
  ]) expect(flat).toContain(phrase);
});

test("validation is locked criterion-specific and reference-specific", () => {
  for (const phrase of [
    "没有参与这些选择的锁定数据集",
    "验证必须按准则和切片分别进行",
    "假通过率和假失败率",
    "准则、语言、领域、难度、候选模型家族和输出风格",
    "只证明它在这些受测协议中的表现",
    "一致不等于有效",
    "数值分数也不会自动成为概率",
  ]) expect(flat).toContain(phrase);
});

test("bias and attack controls measure residual dependence", () => {
  for (const phrase of [
    "要求模型「不要有偏差」并不是控制措施",
    "反转率和同一对答案前后不一致的比率",
    "残余偏好变化",
    "按模型家族统计的错误",
    "证据不足时仍下确定结论的比率",
    "裁定分布和重试策略",
    "攻击成功率、解析安全和人工升级处理",
  ]) expect(flat).toContain(phrase);
});

test("bias mitigations retain their measured limits", () => {
  for (const phrase of [
    "交换顺序可以暴露问题，却不能保证消除问题",
    "长度控制同样是在定义一个估计目标",
    "说明哪一种结果服务于当前决策",
    "都不能证明中立",
    "候选文本是不可信输入",
    "高影响决策的唯一关卡",
  ]) expect(flat).toContain(phrase);
});

test("the Bradley-Terry formulation defines every quantity", () => {
  for (const phrase of [
    "候选系统 $i$ 在第 $k$ 次比较中胜过系统 $j$",
    "记录下来的协变量向量",
    "相应的系数",
    "表示转置",
    "逻辑函数",
    "给所有评分加上同一个常数并不会改变任何概率",
    "400 分差距对应约 91% 的胜率",
  ]) expect(flat).toContain(phrase);
});

test("ranking assumptions ties and separation remain visible", () => {
  for (const phrase of [
    "在抽样比较总体上具有一个标量强度",
    "解释可传递的偏好",
    "有向胜负图是否强连通",
    "无正则化的极大似然评分发散",
    "偏好是否存在异质性或循环",
    "二元 Bradley-Terry 模型不描述平局概率",
    "同一位用户、同一个提示或同一段对话",
  ]) expect(flat).toContain(phrase);
});

test("arena rankings are conditional estimates with design-aware uncertainty", () => {
  for (const phrase of [
    "不是内在能力常数",
    "对独立的提示或用户聚类重采样",
    "评分区间、排名概率或排名集合",
    "对加权规则和参评资格规则的敏感性",
    "人工投票排名与模型评判排名仍应分开标识",
  ]) expect(flat).toContain(phrase);
});

test("confirmation is an information boundary rather than a purity claim", () => {
  for (const phrase of [
    "减少直接暴露和反复调参",
    "不能证明预训练中从未出现语义等价的案例",
    "把这类审计当作带误差的证据，而不是证书",
    "自适应复用仍是统计问题",
    "限制重复查询",
    "确认结果和人工纠错悄悄流入训练数据",
    "从错误用户或任务中抽取的秘密数据集仍然无效",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract preserves validation and training handoffs", () => {
  for (const phrase of [
    "哪一份锁定参考集验证了这个版本",
    "哪些模型、评判者、评分准则或领域变化需要重新验证",
    "奖励模型并不等同于通过提示调用的模型评判者",
    "另一件学习得到的评分工具",
    "自己的数据、目标函数和验证契约",
  ]) expect(flat).toContain(phrase);
});

test("the diagram and ranking visualization are localized", () => {
  for (const phrase of [
    'D [label="决策与待测概念"]',
    'H [label="人类或可执行参照"]',
    'J [label="冻结的 JudgeSpec"]',
    'V [label="锁定验证集"]',
    'T [label="偏差与攻击压力测试"]',
    'R [label="生产环境原始裁定"]',
    'O [label="估计、局限与升级处理"]',
    'data-xlabel="评分差"',
    'data-ylabel="胜率"',
    'data-plabel="评分尺度"',
    "改变显示尺度只会改变以评分点数表示的曲线斜率",
  ]) expect(chapter).toContain(phrase);
});

test("contested scope and lower-layer provenance remain explicit", () => {
  for (const phrase of [
    "这份冻结的评判者在这个案例总体上",
    "更广的主张需要新的证据",
    "把候选内容当作数据，而不是权限来源",
    "解析或仲裁之前保留原始输出",
    "无法区分模型进步与评判者漂移",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete shortcuts and unmatched artifacts", () => {
  for (const phrase of [
    "人类偏好当真值",
    "评分器即被评分之物",
    "四种偏差及其对策",
    "从单次裁定到一个排名",
    "私有留出集的价值",
    "几组取舍",
    "搭建评判者",
    "The Leaderboard Illusion",
    "27 个私有变体",
    "二十到五十个任务",
    "一个奖励模型本身就是一个被冻结的模型作为评判者",
    "—",
  ]) expect(chapter).not.toContain(phrase);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
});
