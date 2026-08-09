import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/safety/05-adversarial-robustness.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/05-adversarial-robustness.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

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

function htmlFigureIds(source: string): string[] {
  return [...source.matchAll(/^<figure id="([^"]+)">$/gm)].map(
    (match) => match[1],
  );
}

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

test("Chapter 58 preserves the complete English adversarial-evaluation contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "对抗鲁棒性与红队 {#sec-adversarial-robustness}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "从失效出发，而不是从提示词出发",
    "先写威胁模型，再运行攻击",
    "不同攻击方法暴露不同攻击面",
    "度量攻击尝试，而不是轶事",
    "构建红队计划，而不是只跑一次基准",
    "按失效阶段匹配防御",
    "把结果写成发布规则",
    "保留可复现的评估记录",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "验证裁判",
    "报告不确定性与依赖关系",
    "保留效用并核算成本",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(2);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
  expect(htmlFigureIds(chapter)).toEqual(htmlFigureIds(english));
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(chapter.match(/^!\[/gm)).toBeNull();
});

test("the opening separates related failure classes and limits the claim", () => {
  for (const phrase of [
    "对抗鲁棒性考察的是",
    "有人刻意寻找失效方式时",
    "越狱试图让模型输出违反策略的内容",
    "提示注入试图让不受信任的文字控制应用",
    "要产生有害副作用，还要求应用授权并执行模型的提议",
    "这些失效彼此相关，却不能混为一谈",
    "红队测试会在明确的威胁模型下寻找这些失效",
    "不能证明它们不存在",
    "不是模型家族永恒不变的属性",
    "属于整个已部署系统",
  ]) expect(flat).toContain(phrase);
});

test("the outcome table begins from observable failures", () => {
  for (const phrase of [
    "拒绝语句可以观察，却不是安全目标",
    "不说“不”也可能没有提供任何有害帮助",
    "先给出警告，随后仍提供被禁止的操作细节",
    "不安全文本仍不同于外部效果",
    "越狱成功",
    "回答提供策略禁止且确实有用的内容",
    "没有出现拒绝措辞",
    "提示注入成功",
    "攻击者控制的文字改变与控制相关的行为",
    "模型只是复述注入文字",
    "未授权效果",
    "提议通过授权，而且效果实际发生",
    "模型输出里出现工具调用",
    "秘密泄露",
    "受保护信息到达未获授权的目的地",
  ]) expect(flat).toContain(phrase);
});

test("the threat model fixes every attacker and evaluator degree of freedom", () => {
  for (const phrase of [
    "攻击者能力没有固定下来之前，攻击成功率无法解释",
    "目标系统",
    "策略版本",
    "攻击者目标",
    "攻击者知识",
    "攻击者访问能力",
    "攻击预算",
    "允许的变换",
    "成功标准",
    "防御者知识",
    "适应性",
    "白盒、灰盒还是黑盒",
    "多少次查询、多少词元、多少次重启、多少个账户和多少实际用时",
    "不同策略、预算、采样设置或裁判",
    "记录实际观察到的模型版本和日期",
  ]) expect(flat).toContain(phrase);
});

test("the localized attack-surface diagram preserves the evidence path", () => {
  for (const phrase of [
    'attacker [label="攻击者"]',
    'methods [label="攻击方法\\n人工 · 优化\\n多示例 · 多轮\\n间接注入"]',
    'target [label="带版本的\\n目标系统"]',
    'evidence [label="策略感知的\\n结果证据"]',
    "attacker -> methods",
    "methods -> target",
    "target -> evidence",
  ]) expect(chapter).toContain(phrase);
});

test("localized DOT figures reserve readable caption width without exceeding mobile", () => {
  expect(chapter).toContain(
    'node [shape=box, style="rounded,filled", fontname="PingFang SC", fontsize=9.5, width=2.2,',
  );
  expect(chapter).toContain(
    'node [shape=box, style="rounded,filled", fontname="PingFang SC", fontsize=9.5, width=1.8,',
  );
});

test("attack families keep distinct access models and bounded claims", () => {
  for (const phrase of [
    "人工与语义攻击",
    "角色扮演、重构问题、翻译、间接表达",
    "在既定预算内产生违反策略且确实有用的输出",
    "基于优化的攻击",
    "白盒源模型",
    "某些优化提示可以跨越模型边界",
    "不代表每个后缀都能迁移到每个模型",
    "多示例攻击",
    "近似按幂律增长",
    "不是普遍定律",
    "多轮攻击",
    "只检查最新消息的守卫",
    "间接提示注入",
    "改变应用的控制流、数据流或工具使用",
    "只有外部强制执行点才能决定最终效果是否获准",
  ]) expect(flat).toContain(phrase);
});

test("the many-shot visualization stays explicitly illustrative", () => {
  for (const phrase of [
    'data-xlabel="被评估提示中的示例数量"',
    'data-ylabel="相对攻击成功率"',
    'data-plabel="示意指数"',
    "幂律增长示意图，不是对实测数值的复现",
    "必须测量自己的模型、策略、上下文上限和裁判",
  ]) expect(chapter).toContain(phrase);
});

test("ASR is defined over attempts and never presented as safety probability", () => {
  for (const phrase of [
    "分析单位必须明确",
    "$b$ 表示待测行为",
    "$a$ 表示攻击流程",
    "$r$ 表示生成种子或试验编号",
    "$J_v$ 表示版本为 $v$ 的策略感知裁判",
    "真命题映射为一，假命题映射为零",
    "评估三元组的数量",
    "观察到的攻击成功率",
    "不是系统安全的概率",
    "逐次尝试 ASR",
    "任一成功 ASR",
    "重启预算增加",
    "按风险类别报告",
    "严重程度和可操作性",
  ]) expect(flat).toContain(phrase);
});

test("judge validation requires policy-trained human evidence", () => {
  for (const phrase of [
    "绕过拒绝还不够",
    "空洞或语无伦次的回答",
    "有害有用性",
    "分层抽取人工复核样本",
    "成功、失败、高严重度类别和边界分数",
    "报告裁判一致率",
    "假阳性率和假阴性率",
    "接受过策略培训的复核人员",
    "裁判版本在一次比较中保持不变",
    "重新为两个候选系统评分",
  ]) expect(flat).toContain(phrase);
});

test("uncertainty preserves behavior-level dependence", () => {
  for (const phrase of [
    "随机解码",
    "样本量和置信区间",
    "同一行为上的多种攻击与多次重启并非独立证据",
    "按行为重采样",
    "聚类自助法",
    "保留每个行为内部的重复尝试",
    "零次观察成功并不证明风险为零",
    "依赖样本的上界",
  ]) expect(flat).toContain(phrase);
});

test("utility and attacker cost remain part of the result", () => {
  for (const phrase of [
    "大多数无害请求",
    "为有害行为配上与其共享词汇和上下文的无害对照",
    "无害请求拒绝率、普通任务质量和安全回答的有用性",
    "查询、词元、实际用时、重启次数",
    "延迟、词元用量、加速器时间和金钱成本",
    "从一次查询提高到一千次查询",
    "限流与身份模型",
  ]) expect(flat).toContain(phrase);
});

test("a durable red-team program separates four evidence suites", () => {
  for (const phrase of [
    "开发套件",
    "留出套件",
    "攻击家族留出集",
    "不要在发布套件上调参",
    "自适应套件",
    "了解防御的攻击者",
    "人工红队",
    "产品特定的工作流、社会情境和新组合",
    "留出套件的一部分应保持私有并定期轮换",
    "跟踪数据谱系",
    "污染不会让案例失去回归价值",
    "削弱关于泛化能力的主张",
    "每个已确认失效都应回放到开发套件",
  ]) expect(flat).toContain(phrase);
});

test("the localized red-team loop preserves failure-driven iteration", () => {
  for (const phrase of [
    'threat [label="威胁模型"]',
    'attack [label="生成并运行\\n带版本的攻击"]',
    'judge [label="裁判、抽样\\n并验证"]',
    'decide [label="发布闸门"]',
    'fix [label="修复并加入\\n回归案例"]',
    'fresh [label="新的留出与\\n自适应套件"]',
    'decide -> fix [label="未通过"]',
    "fix -> fresh -> attack",
  ]) expect(chapter).toContain(phrase);
});

test("defenses are matched to failure stages without overstating them", () => {
  for (const phrase of [
    "安全调优与对抗训练",
    "泛化能力取决于训练分布、策略、模型和攻击预算",
    "指令层级",
    "学习得到的防御",
    "不是授权决定",
    "输入与输出分类器",
    "运行上彼此独立，不代表统计上自动独立",
    "测量残余错误之间的相关性",
    "无法撤回已经流出的文字或已经提交的副作用",
    "表征重路由",
    "在其评估的攻击和模型类型上降低了 ASR",
    "不是存在唯一有害回路的证明",
    "确定性效果控制",
    "不会让模型输出本身变得安全",
    "为可信代码检查的狭窄性质建立安全边界",
  ]) expect(flat).toContain(phrase);
});

test("the defense stepper distinguishes empirical layers from enforcement", () => {
  for (const phrase of [
    'data-chip="攻击" data-title="1 · 对抗输入到达"',
    'data-chip="训练" data-title="2 · 学习得到的模型防御"',
    'data-chip="分类器" data-title="3 · 运行时检测"',
    'data-chip="断路器" data-title="4 · 表征级干预"',
    'data-chip="效果闸门" data-title="5 · 确定性强制执行"',
    "学习得到的防御和检测器降低实测失效率",
    "确定性效果控制在上游失效时落实狭窄的系统不变量",
  ]) expect(chapter).toContain(phrase);
});

test("release rules bind safety utility and predeclared thresholds", () => {
  for (const phrase of [
    "发布闸门应在运行评估之前写好",
    "风险类别 $c$",
    "攻击成功率的置信上界",
    "记录在案的发布阈值",
    "严重度更高的类别可以使用更严格的阈值和更大的样本量",
    "该指标的置信下界",
    "无害效用下限",
    "靠拒绝所有请求换来的低 ASR",
    "阈值是产品与风险决策",
    "不是基准提供的常数",
    "缩小部署范围",
    "有负责人和到期时间的授权例外",
    "不要丢弃不利结果",
    "看到结果后更换裁判",
  ]) expect(flat).toContain(phrase);
});

test("the reproducibility record connects every input to the release decision", () => {
  for (const field of [
    "evaluation_id",
    "system_revision",
    "policy_revision",
    "defense_revision",
    "behavior_set_revision",
    "attack_revision",
    "threat_model_and_budget",
    "generation_parameters_and_seeds",
    "judge_revision",
    "human_validation_sample",
    "per_behavior_outcomes",
    "benign_utility_outcomes",
    "query_token_latency_costs",
    "confidence_interval_method",
    "release_decision_and_exception",
    "regression_case_ids",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "攻击材料应按与滥用风险相称的访问控制保存",
    "无需公开每一条高风险提示",
    "授权评估人员复现主张",
  ]) expect(flat).toContain(phrase);
});

test("regressions cover mechanisms and lifecycle changes, not one string", () => {
  for (const phrase of [
    "拒绝措辞陷阱",
    "留出攻击家族",
    "多轮延续",
    "间接注入",
    "自适应再攻击",
    "无害对照",
    "裁判分歧",
    "模型版本",
    "策略版本",
    "防御超时",
    "完整轨迹，而不只是最后一轮",
    "不受信任的检索文字不能悄悄授权特权效果",
    "完整发布套件重新运行",
    "记录在案的失效方式得到实际演练",
  ]) expect(flat).toContain(phrase);
});

test("contested questions keep empirical and disclosure limits explicit", () => {
  for (const phrase of [
    "越狱鲁棒性能否做到完备",
    "有限测试可以发现失效并给出条件上界",
    "不能枚举自然语言，也不能证明不存在成功输入",
    "基准应当标准化到什么程度",
    "成熟的计划两者都需要",
    "表征级防御是否比表层防御泛化得更好",
    "必须注明攻击家族和预算",
    "应披露多少攻击细节",
    "可复现性倾向公开材料，滥用风险倾向受控访问",
  ]) expect(flat).toContain(phrase);
});

test("the lower-layer constraint and conclusion define a versioned claim", () => {
  for (const phrase of [
    "基础设施限制一次成功攻击能够做什么",
    "不能取代权限范围、秘密隔离、有类型的工具闸门、接收方检查、沙箱或出网策略",
    "模型可以提出动作，可信代码必须决定并强制执行",
    "对抗鲁棒性不是附着在单个模型上的一个分数",
    "定义失效、说明攻击者能力、运行代表性与自适应攻击",
    "验证裁判、量化不确定性和效用、执行发布规则",
    "把每个已确认失效保存为回归证据",
    "不是证书",
    "带版本、可审计的主张",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete chapter structure and unsupported absolutes", () => {
  for (const phrase of [
    "问题：拒绝是一道软边界",
    "红队是度量，不是审计",
    "防御，以及每一种为何都是局部的",
    "鲁棒性的代价",
    "fig-adversarial-robustness-1",
    "fig-adv-taxonomy",
    "fig-adv-defense-layers",
    "四个攻击家族已经稳定下来",
    "常常能越狱它从未见过的闭源模型",
    "一个对齐得更好的模型，会提高第一个家族的成本，却几乎触碰不到第四个",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
