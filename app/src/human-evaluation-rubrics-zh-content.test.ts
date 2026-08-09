import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/03-human-evaluation-rubrics.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/03-human-evaluation-rubrics.qmd", import.meta.url),
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

test("Chapter 49 preserves the complete English human-evaluation protocol", () => {
  expect(headings(chapter, 1)).toEqual([
    "把人类评测写成测量协议 {#sec-human-evaluation-rubrics}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "从主张出发，而不是先找标注者",
    "评分准则是一套可执行界面",
    "任务分配与界面会改变观测结果",
    "找对视角，也保护参与评测的人",
    "仲裁之前，先保留原始判断",
    "用一致性诊断评测协议",
    "根据主张选择观测形式",
    "汇总不能抹掉评测设计",
    "把人类证据交给模型评判者时要谨慎",
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
});

test("the opening defines judgment as a protocol-bound observation", () => {
  for (const phrase of [
    "人做出的判断，并不会因此自动成为真值",
    "特定的人",
    "特定的证据",
    "特定的界面",
    "特定的评分准则",
    "标签也可能随之改变",
    "哪些人在什么条件下，对哪个单位作出了什么判断",
  ]) expect(flat).toContain(phrase);
});

test("the claim determines the construct rater population and evidence", () => {
  for (const phrase of [
    "先写明要支持的决策和待测概念",
    "事实正确性、引用支持、无害性、语气是否合适、任务是否完成，以及用户要付出多少精力",
    "目标标注者群体取决于评测主张",
    "具备相关专业知识的临床医生",
    "目标用户或有效的代理人",
    "目标语言社群中的流利使用者",
    "专业能力没有一条适用于所有任务的统一排名",
    "不能把结论推广到这个视角之外",
  ]) expect(flat).toContain(phrase);
});

test("the protocol diagram preserves decision through raw evidence", () => {
  for (const phrase of [
    'C [label="决策与待测概念"]',
    'S [label="抽样案例与系统"]',
    'P [label="评分准则、标注者与界面"]',
    'A [label="随机化任务分配"]',
    'R [label="原始判断记录"]',
    'Q [label="审计；单独仲裁"]',
    'O [label="估计、局限与决策"]',
  ]) expect(chapter).toContain(phrase);
  expect(chapter).toContain("rankdir=TB;");
});

test("HealthBench remains evidence for one bounded protocol", () => {
  for (const phrase of [
    "医生为医疗对话编写了针对每段对话的评分标准",
    "另外将自动评分器与医生判断进行比较",
    "不能证明医生编写的评分准则或模型评分器适用于所有医疗用途",
  ]) expect(flat).toContain(phrase);
});

test("rubrics turn constructs into observable decisions", () => {
  for (const phrase of [
    "单位",
    "适用条件",
    "证据",
    "判断选项",
    "锚定示例",
    "迫使标注者各自发明一套规则",
    "不应靠文风得分抵消事实错误",
    "普通案例、边界案例、对抗案例和无法评分的案例",
    "开发数据，不是新的确认数据",
  ]) expect(flat).toContain(phrase);
});

test("the response set preserves distinct uncertainty states", () => {
  for (const phrase of [
    "强制二选一",
    "两者都失败",
    "无法区分",
    "证据不足",
    "平局、未知、不适用和弃权",
    "在存储和分析中也必须分开",
  ]) expect(flat).toContain(phrase);
});

test("assignment and interface variables are controlled and retained", () => {
  for (const phrase of [
    "隐藏模型和提供商身份",
    "随机安排或平衡候选答案的顺序",
    "记录实际呈现顺序",
    "排版、截断、引用和可用工具",
    "被试内设计",
    "被试间设计",
    "平衡不完全区组",
    "每条判断都要保存界面版本",
  ]) expect(flat).toContain(phrase);
});

test("recruitment qualification and worker protection stay explicit", () => {
  for (const phrase of [
    "通用平台通过率并不能证明",
    "记录明确的筛选测试、训练集和校准轮次",
    "「众包」并不是一个稳定的人群",
    "并不意味着非专家通常无法做出有用评测",
    "公平报酬、合理工时、休息安排",
    "保护他们免受令人不适内容的伤害",
    "适用的伦理或法律审查",
  ]) expect(flat).toContain(phrase);
});

test("quality controls are task-related and auditable", () => {
  for (const phrase of [
    "重复项目可以衡量同一标注者自身的稳定性",
    "客观的标准答案项目",
    "异常快速或答案过于单一",
    "最低用时门槛和隐藏陷阱",
    "保留被排除的记录及理由",
    "排除操作如何改变了估计结果",
  ]) expect(flat).toContain(phrase);
});

test("raw judgments and adjudication remain separate versioned records", () => {
  for (const field of [
    "study_spec_hash",
    "candidate_ids_blinded",
    "candidate_order",
    "rubric_revision",
    "interface_revision",
    "rater_pseudonym",
    "rater_population_and_qualification",
    "assignment_block",
    "raw_dimension_labels",
    "tie_unknown_abstain_state",
    "rationale_and_evidence_refs",
    "quality_flags",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "不可修改的事件",
    "仲裁产生的是派生标签",
    "不能覆盖独立判断",
    "仲裁前的一致性",
    "不能反过来把几个彼此相关的意见算作独立证据",
    "哪些判断影响了哪些工件",
  ]) expect(flat).toContain(phrase);
});

test("agreement diagnoses reliability without claiming validity", () => {
  for (const phrase of [
    "原始一致率",
    "保留各自观测到的标签边际频率",
    "不是普遍适用的所谓偶然一致量",
    "kappa 没有定义",
    "距离函数必须与响应尺度相符",
    "不存在适用于所有评测的安全阈值",
    "一致性衡量可靠性，而不是效度",
    "按准则、项目和标注者群体分析分歧",
  ]) expect(flat).toContain(phrase);
});

test("four observation formats retain their distinct scope", () => {
  for (const phrase of [
    "成对比较",
    "绝对评分或有序评分",
    "准则清单",
    "任务式评测",
    "结果取决于对手集合和呈现情境",
    "不要在没有依据时把有序等级当成等距数值",
    "测到的是整个人机工作流",
    "不是一条由弱到强的等级",
  ]) expect(flat).toContain(phrase);
});

test("aggregation retains units slices uncertainty and disagreement", () => {
  for (const phrase of [
    "独立单位可能是用户、对话、文档、代码仓库或任务",
    "按这个单位对重复判断进行聚类",
    "每项准则的失败率",
    "平局、弃权、缺失和无效率",
    "顺序和界面诊断",
    "却会抹掉少数判断和不确定性",
    "汇总规则和原始证据应当同时保留",
  ]) expect(flat).toContain(phrase);
});

test("human evidence calibrates model judges without becoming ground truth", () => {
  for (const phrase of [
    "这次交接本身也是一次评测",
    "不是把人类标签提升为真值",
    "普通案例、边界案例、对抗案例和弃权案例",
    "按准则和切片衡量模型评判者",
    "顺序偏差、偏爱冗长回答、自我偏好",
    "不要只用仲裁后的共识标签做验证",
    "持续监控新样本上的人机分歧",
  ]) expect(flat).toContain(phrase);
});

test("the operating sequence and boundaries remain explicit", () => {
  for (const phrase of [
    "写明决策、待测概念、单位、目标案例总体和标注者视角",
    "试运行评分准则和界面",
    "预先声明抽样、任务分配、盲测、顺序、排除、仲裁、汇总和分析方法",
    "先收集不可修改的原始判断，再做任何仲裁",
    "分歧有时是测量误差，有时正是待测现象",
    "不能等看到难以处理的分歧后，再决定它究竟算误差还是结果",
    "无法重建配对关系、发现泄漏、估计标注者效应或审计排除项",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete shortcuts and unsupported specifics", () => {
  for (const phrase of [
    "人类标签不是原子事实",
    "协议创造了标签",
    "评分准则是判断的界面",
    "一致性也要被测量",
    "成对、绝对与任务式评测",
    "262 位医生",
    "60 个国家",
    "48,562 条",
    "Fleiss 的",
    "Bradley-Terry",
    "Elo 排名",
    "Fernandes 等人",
    "黄金标准",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
