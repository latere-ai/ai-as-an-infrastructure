import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/05-factuality-grounding.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/05-factuality-grounding.qmd", import.meta.url),
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

test("Chapter 51 preserves the complete English evidence-evaluation contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "事实性、有据性与证据 {#sec-factuality-grounding}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "指标之前，先定义主张",
    "冻结证据契约",
    "拆解，但不能丢掉覆盖度",
    "先验证评测器，再评模型",
    "把弃答当作决策策略",
    "逐段诊断有据生成流水线",
    "把引用评成主张与来源之间的连接",
    "弱信号只用来分诊",
    "证据评测的运行契约",
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
  expect(chapter).not.toContain(".runnable");
});

test("the opening separates truth grounding and citation support", () => {
  for (const phrase of [
    "回答可能真实，却没有依据",
    "忠实于一份错误来源，因而并不真实",
    "引用也可能只是装饰",
    "把这些问题一概称为「幻觉」",
    "主张连同它的证据边界、状态和来源",
    "以哪个世界状态或哪类来源为准",
  ]) expect(flat).toContain(phrase);
});

test("the target axes remain distinct and reference-bound", () => {
  for (const phrase of [
    "基准接受的答案和目标人群",
    "世界状态或参照政策",
    "给定上下文，即使上下文本身不完整或有错",
    "标注政策下附着的来源片段",
    "事实性范围更广，必须指定权威来源和时间",
    "注明来源并不能证明内容为真",
    "「无支持」只表示评测器没有在声明的证据边界内找到充分支持",
    "「证据不足」必须与前两者分开",
  ]) expect(flat).toContain(phrase);
});

test("the factuality instrument freezes every evidence boundary", () => {
  for (const field of [
    "failure_costs",
    "case_population",
    "as_of_time",
    "closed_book",
    "supplied_context",
    "bounded_search",
    "corpus_snapshot",
    "access_and_source_policy",
    "claim_policy_and_revision",
    "retrieval_and_span_policy",
    "verdict_policy_and_judge",
    "citation_mapping_policy",
    "abstention_policy",
    "aggregation_policy",
    "candidate_evidence_spans",
    "cited_evidence_spans",
    "extractor_revision",
    "retriever_revision",
    "judge_revision",
    "raw_verdict",
    "adjudication",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "三种模式的结果不能互换",
    "重新评分时要追加新的裁定",
    "不能抹掉产生旧裁定的证据和评测器版本",
  ]) expect(flat).toContain(phrase);
});

test("the evidence-contract diagram retains complete localized provenance", () => {
  for (const phrase of [
    'D [label="决策与错误代价"]',
    'B [label="权威来源与证据边界"]',
    'T [label="检索与生成轨迹"]',
    'C [label="消解后的原子主张"]',
    'E [label="有版本的证据片段"]',
    'V [label="主张与引用裁定"]',
    'O [label="指标、局限与发布政策"]',
  ]) expect(chapter).toContain(phrase);
  expect(chapter).toContain("rankdir=TB;");
});

test("claim scoring is conditional on decomposition and knowledge source", () => {
  for (const phrase of [
    "针对一份固定的 Wikipedia 快照",
    "最后一种标签并不表示主张为假",
    "相对于知识来源衡量事实精确率",
    "协议必须把证据检索与支持标签分开记录",
    "$m=0$ 时，这个分数没有定义",
    "没有可核查内容的回答",
  ]) expect(flat).toContain(phrase);
});

test("atomicity preserves context and remains auditable", () => {
  for (const phrase of [
    "只表达一项可以独立核查的信息",
    "原子性是协议选择，不是唯一正确的语言学事实",
    "代词、日期、单位和局部上下文",
    "把一个并列句拆成几个容易得分的主张",
    "保留原始片段和父子关系",
    "在人类标出的样本上测量抽取召回率",
    "合理的重新拆分是否会实质改变结果",
  ]) expect(flat).toContain(phrase);
});

test("long-form precision cannot hide omissions", () => {
  for (const phrase of [
    "只报告事实精确率会奖励少说话",
    "需要核查的主张数量与权重、用户要求内容的覆盖度、矛盾率和回答资格",
    "16,011 个已经由人类拆解的事实",
    "能够使用更广泛网络资料的研究人员",
    "2024 年的模型与搜索价格",
    "不能验证端到端的主张抽取",
  ]) expect(flat).toContain(phrase);
});

test("the evaluator is validated stage by stage", () => {
  for (const phrase of [
    "在锁定且经过独立仲裁的案例上逐段验证",
    "支持、矛盾、证据不足和不可核查",
    "只能使用声明过的证据",
    "候选答案要求评测器忽略评分准则",
    "不能只凭最终标签推断根因",
    "评测器假阴性",
    "根因判断需要完整轨迹",
  ]) expect(flat).toContain(phrase);
});

test("short-form evaluation preserves benchmark and grader limits", () => {
  for (const phrase of [
    "预期只有一个无争议答案",
    "「未作答」描述的是观测到的回答",
    "人工检查了随机抽取的 300 份回答",
    "没有报告正式的评分器研究",
    "一组通过对抗方式收集的闭卷问题",
    "经过筛选的 1,000 题衍生版本",
    "没有原地修补原始数据集",
  ]) expect(flat).toContain(phrase);
});

test("selective prediction defines coverage risk and empty coverage", () => {
  for (const phrase of [
    "Chow 在 1970 年形式化了错误与拒答之间的取舍",
    "选择性风险是已发布答案中的错误率",
    "系统一个答案也不发布时没有定义",
    "整体答对率",
    "拒答全部案例也不会显得表现很好",
    "不能替它们编造置信度",
  ]) expect(flat).toContain(phrase);
});

test("calibration remains separate from release policy", () => {
  for (const phrase of [
    "展示整个覆盖度范围内的风险",
    "部署阈值属于成本政策",
    "校准与选择彼此相关，但并不相同",
    "应用弃答阈值之前",
    "只在已发布答案上校准会描述一个经过筛选的子集",
  ]) expect(flat).toContain(phrase);
});

test("grounding diagnosis follows retained pipeline artifacts", () => {
  for (const phrase of [
    "检索增强生成会增加失效面",
    "只说明上下文暴露情况，不能证明生成器使用了证据",
    "提供预先确认正确的证据，并保留准确的提示",
    "用户可见质量，不能自动给出因果诊断",
    "不能把模型评判的相关性分数称为检索召回率",
    "不能证明生成器在因果上使用了这段材料",
  ]) expect(flat).toContain(phrase);
});

test("RAG metrics retain their published scope", () => {
  for (const phrase of [
    "忠实度、答案相关性和上下文相关性",
    "正式论文没有定义上下文召回率",
    "引用召回率和引用精确率",
    "本身也是 NLI 模型的估计",
    "2025 年最初发布的 FACTS Grounding 基准",
    "把这套设计当作有版本的基准契约",
    "不能把裁定变成真值",
  ]) expect(flat).toContain(phrase);
});

test("citation completeness and correctness have different denominators", () => {
  for (const phrase of [
    "引用完整度和引用正确性回答的是不同问题",
    "表示引用完整度",
    "表示链接正确性",
    "引用链接的数量",
    "相应指标不适用",
    "链接正确性很高，完整度却很低",
  ]) expect(flat).toContain(phrase);
});

test("weak signals are triage rather than truth", () => {
  for (const phrase of [
    "可以安排复核优先级，却不能证明内容为真",
    "把句子层面的不一致当作预警信号",
    "多次采样可能反复给出同一个常见错误",
    "引用数量、网址是否有效、词汇重合度、评判者置信度",
    "都不能证明事实获得了支持",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract preserves downstream traces", () => {
  for (const phrase of [
    "哪些主张必须有证据",
    "哪些指标能够展示事实精确率",
    "哪些失败会触发人工复核、确定性检查、检索修复或拒答",
    "哪些数据、模型、提示、语料库、政策或评判者变化需要重新验证",
    "的是完整轨迹，而不只是分数",
    "只追加、不修改的回归案例",
  ]) expect(flat).toContain(phrase);
});

test("contested scope and lower-layer limits remain explicit", () => {
  for (const phrase of [
    "不存在普遍适用的事实性指标",
    "给定上下文的忠实度可能奖励对错误来源的忠实复述",
    "这些主张得到这些状态",
    "正确片段从未进入打包后的上下文",
    "区分生成失败与引用附着失败",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete shortcuts and unmatched artifacts", () => {
  for (const phrase of [
    "事实性、Grounding 与引用支持",
    "四个词不能混成一个",
    "从回答到 claim",
    "短答案与弃答",
    "检索系统里的 grounding",
    "弱信号及其边界",
    "它在栈中的位置",
    "如果模型知道某个事实，多次采样应当一致",
    "32k 词元",
    "—",
  ]) expect(chapter).not.toContain(phrase);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
});
