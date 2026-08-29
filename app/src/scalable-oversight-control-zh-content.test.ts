import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/safety/02-scalable-oversight-control.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/02-scalable-oversight-control.qmd", import.meta.url),
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

test("Chapter 55 preserves the complete English oversight-and-control contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "可扩展监督与控制 {#sec-oversight-control}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "衡量真实存在的差距",
    "三种任务，三类证据",
    "训练阶段的能力引出：弱到强",
    "辅助评估：放大与辩论",
    "部署控制：假设模型会蓄意颠覆",
    "欺骗行为为何会改变评估方式",
    "从单次输出到智能体轨迹",
    "推理轨迹是第二个可监控面",
    "监督能否跨越更大的差距",
    "争议所在",
    "监督证据的运行契约",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```\{=html\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(chapter.match(/^<figure /gm)?.length).toBe(1);
  expect(chapter.match(/^```python$/gm)).toBeNull();
  expect(chapter.match(/^```text$/gm)).toBeNull();
  expect(chapter.match(/^!\[/gm)).toBeNull();
  expect(chapter.match(/\.runnable/g)).toBeNull();
});

test("the opening separates bounded oversight evidence from control evidence", () => {
  for (const phrase of [
    "能力较弱的监督者能否为能力更强的系统提供可靠的训练或评估信号",
    "即使不受信任的模型试图造成某项明确界定的不可接受结果",
    "两类结论不能互相替代",
    "更好的监督不能证明模型可以安全部署",
    "成功的控制评估也不能证明模型已经对齐",
    "模型版本、输入分布、可用信息、工具、资源限制",
    "不再适用的条件",
    "本身不足以授权部署",
  ]) expect(flat).toContain(phrase);
});

test("five distinct gaps replace one vague capability gap", () => {
  for (const phrase of [
    "能力取决于具体任务",
    "冻结的任务分布",
    "任务能力差距",
    "信息差距",
    "验证差距",
    "资源差距",
    "对抗差距",
    "没有任何一个标量足以预测监督效果",
    "同时报告两项得分及其不确定区间",
    "夹心式评估",
  ]) expect(flat).toContain(phrase);
});

test("training evaluation and deployment remain three different jobs", () => {
  for (const phrase of [
    "训练阶段的能力引出",
    "辅助评估",
    "部署控制",
    "改进后的监督信号不等于发布决定",
    "控制结果也不能证明模型已经对齐",
    "可以组合使用",
  ]) expect(flat).toContain(phrase);
});

test("the localized evidence diagram preserves the three claims and decision boundary", () => {
  for (const phrase of [
    'train [label="训练信号\\n弱标注能否训练学生模型？"]',
    'eval [label="评估证据\\n辅助能否改善判断？"]',
    'control [label="控制证据\\n协议能否抵御攻击？"]',
    'decision [label="独立的部署决定\\n范围、风险与授权"]',
    'train -> eval [label="测量"]',
    'eval -> control [label="提供信息"]',
    'control -> decision [label="支持"]',
  ]) expect(chapter).toContain(phrase);
});

test("weak-to-strong evidence defines recovery without claiming superhuman alignment", () => {
  for (const phrase of [
    "弱标注能否引出更强的潜在能力",
    "自然语言任务、国际象棋和奖励建模",
    "恢复程度并不完整，而且高度依赖任务",
    "弱监督者得分",
    "弱标注学生模型得分",
    "强模型上限",
    "分母为正",
    "经验代理",
    "并未证明超人模型能够实现对齐",
  ]) expect(flat).toContain(phrase);
});

test("amplification and debate preserve their assumptions and measured scope", () => {
  for (const phrase of [
    "迭代放大是一项提案",
    "任务分解由研究者手工设计",
    "真实一方能够提出决定性证据",
    "对手能够质疑缺乏依据的主张",
    "评判者能够识别有效证据",
    "信息不对称",
    "76%",
    "88%",
    "说服力更强本身并不是一项安全属性",
    "不能证明辩论适用于任意领域或能力差距",
  ]) expect(flat).toContain(phrase);
});

test("deployment control declares the threat model before measuring it", () => {
  for (const phrase of [
    "不受信任策略、受信任监控器",
    "不可接受的结果",
    "审计预算、升级路径、部署期限",
    "攻击者掌握的信息、攻击预算和允许的攻击类别",
    "蓝队在评估前固定协议",
    "红队随后尝试",
    "自适应攻击",
    "串谋与分布迁移",
    "5000 个问题",
    "2% 的提交",
  ]) expect(flat).toContain(phrase);
});

test("control metrics separate usefulness attack success errors and cost", () => {
  for (const phrase of [
    "攻击成功率",
    "误放率",
    "误拒率",
    "审计率",
    "成本与延迟",
    "部署期限",
    "只有在已声明的危害检测器和攻击分布下",
    "并不是部署安全的全局概率",
    "不能自动外推到长期部署",
    "不能单独授权部署",
  ]) expect(flat).toContain(phrase);
});

test("the control stepper is fully localized and keeps the evidence boundary", () => {
  for (const phrase of [
    'data-viz="stepper"',
    'data-lang="zh"',
    'data-chip="输出"',
    'data-chip="监控"',
    'data-chip="接受"',
    'data-chip="转交"',
    'data-chip="审计"',
    "固定的校准方法和阈值",
    "误放率",
    "稀缺的审计能力",
    "证据来自声明攻击策略下的实测行为",
  ]) expect(flat).toContain(phrase);
});

test("deception evidence remains bounded to constructed experiments", () => {
  for (const phrase of [
    "模型可能在训练中表现得已经对齐",
    "概念验证",
    "刻意训练的后门",
    "不能估计这种行为自然出现的频率",
    "明确的情境信息",
    "有害服从率约为 14%",
    "78%",
    "模型生成的草稿区",
    "不是获取意图的特权通道",
    "不能证明主观意图",
  ]) expect(flat).toContain(phrase);
});

test("agent control evidence stays attached to tasks attacks monitors and budgets", () => {
  for (const phrase of [
    "记忆、延迟效应",
    "BashBench 的 257 项系统管理任务",
    "从 58% 降至 7%",
    "牺牲 5% 的可用性",
    "回退到轨迹中的较早状态",
    "不只是要求模型再给一份独立答案",
    "隐藏的次要目标",
    "记录监控器",
    "并不是一项完整的控制评估",
  ]) expect(flat).toContain(phrase);
});

test("larger-gap estimates remain a fitted experimental framework", () => {
  for (const phrase of [
    "按角色划分的领域 Elo",
    "以 Chatbot Arena Elo 作为代理变量",
    "分段线性函数",
    "四个简化博弈",
    "基于模型的估计",
    "不是对部署风险的一般估计",
    "不能凭空创造一条普适的衰减曲线",
    "任意任务或任意差距",
  ]) expect(flat).toContain(phrase);
});

test("the operating record makes every oversight claim reproducible", () => {
  for (const field of [
    "evaluation_id",
    "model_and_overseer_revisions",
    "task_distribution_and_splits",
    "ground_truth_provenance",
    "role_access_tools_and_budgets",
    "gap_metric_and_pair_scores",
    "protocol_and_code_revision",
    "baselines_and_ablations",
    "monitor_calibration_and_thresholds",
    "adversary_knowledge_and_budget",
    "audit_capacity_and_escalation",
    "safety_usefulness_cost_metrics",
    "deployment_horizon_and_dependence",
    "shift_adaptation_and_collusion_tests",
    "retained_artifacts",
    "claim_scope_stop_rules_and_failures",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "带版本的评估工件",
    "冻结受评估的版本",
    "发布失败案例",
    "不能自行授权部署",
  ]) expect(flat).toContain(phrase);
});

test("the lower-layer boundary and authorization handoff remain explicit", () => {
  for (const phrase of [
    "并不意味着所有监督差距都会单调增大",
    "每次模型或协议发生实质性修订后，都要重新测量",
    "冻结条件不再符合拟议部署",
    "证据最终必须转化为可强制执行的边界",
    "身份、策略、能力与审计机制",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete framing and synthetic artifacts", () => {
  for (const phrase of [
    "人类判断之上的对齐有一个有效期限",
    "当评分者被超越",
    "两条不同的回应",
    "信任路径",
    "遏制阵营",
    "让遏制成为必要的存在性证明",
    "该领域为何正向控制倾斜",
    "近看一个控制协议",
    "把监督建模为一个 Elo 博弈",
    "拖动脆弱度参数",
    ":::: {.runnable}",
    "```python",
    "```text",
    "/figures/scalable-oversight-control-1.svg",
    'data-family="exp-decay"',
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
