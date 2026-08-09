import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/07-multi-agent-systems.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/07-multi-agent-systems.qmd", import.meta.url),
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
    .replace(/\\qquad|&|\{\}/g, "")
    .replace(/\s+/g, "");
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function textFences(source: string): string[] {
  return [...source.matchAll(/```text\n([\s\S]*?)\n```/g)].map(
    (match) => match[1],
  );
}

test("Chapter 43 preserves the complete English multi-agent contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "使用另一个智能体的五种不同理由",
    "分布式系统带来的启示",
    "让任务图可以执行",
    "协调不变量",
    "聚合是一种有条件的估计",
    "批评需要证据和裁决",
    "安全性、活性与语义质量",
    "并行执行有一条关键路径",
    "权限必须在每次委派时收紧",
    "恢复也是协调的一部分",
    "评估机制，而不是标签",
    "争议所在",
    "下层约束",
    "一条用于生产的选择规则",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(textFences(chapter)).toEqual(textFences(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("```python");
});

test("the critical-path equation is split for a narrow reading column", () => {
  const criticalPath = displayMath(chapter)[2];
  expect(criticalPath).toContain("\\begin{gathered}");
  expect(criticalPath).toContain("\\\\");
  expect(criticalPath).toContain("\\ell_{\\text{coord}}(P)");
});

test("the opening starts from measurable value and a single-agent baseline", () => {
  for (const phrase of [
    "并行完成工作",
    "真正不同的能力",
    "独立检查",
    "单智能体基线",
    "可衡量的边际价值",
    "协调成本",
    "不会凭空带来权限、真相或容错能力",
    "运行时契约",
  ]) expect(flat).toContain(phrase);
});

test("five mechanisms remain distinct instead of collapsing into consensus", () => {
  for (const phrase of [
    "独立采样与聚合",
    "批评与裁决",
    "分阶段流水线",
    "任务图委派",
    "共享环境协作",
    "先选择机制，再决定智能体数量",
    "管理者把专家当作工具调用",
    "专家接手控制权",
  ]) expect(flat).toContain(phrase);
});

test("distributed systems contribute bounded agreement and runtime duties", () => {
  for (const phrase of [
    "拜占庭将军问题",
    "$N \\ge 3f+1$",
    "不是关于答案真伪的定理",
    "故障参与者可以串通",
    "MapReduce",
    "分解、调度、中间数据、故障处理和归约",
    "先明确工作及其不变量",
  ]) expect(flat).toContain(phrase);
});

test("the task graph makes nodes messages and results executable", () => {
  for (const phrase of [
    "有向无环图 $G = (V,E)$",
    "持久化运行时状态",
    "前置条件",
    "后置条件",
    "根任务只有在所有必要的汇点条件都通过后才算成功",
    "带类型的结构化消息",
    "身份、因果关系、来源和去重信息",
    "不能取代验证工件所需的证据、版本或工具回执",
  ]) expect(flat).toContain(phrase);
});

test("coordination invariants bound authority ownership retries and cancellation", () => {
  for (const phrase of [
    "有界委派",
    "子任务的权限",
    "单一所有权",
    "围栏令牌",
    "消息是不可信数据，不是权限",
    "经过验证的完成",
    "根据外部影响决定是否重试",
    "不能盲目重试",
    "真正的取消",
    "静止状态",
    "工作树能减少文件冲突，但它不是事务，也不是租户边界",
  ]) expect(flat).toContain(phrase);
});

test("aggregation is a conditional estimator rather than proof", () => {
  for (const phrase of [
    "独立伯努利特殊情况",
    "多数票出错的概率",
    "不同错误率、弃权、平票",
    "两两联合错误率",
    "在留出样本上测量多样性",
    "一致不等于证明",
    "开放式补丁、报告或外部操作",
  ]) expect(flat).toContain(phrase);
});

test("critique keeps addressable objections until evidence resolves them", () => {
  for (const phrase of [
    "具体证据",
    "失败的测试、反例、被违反的不变量",
    "每项反对意见都要指明",
    "未解决的反对意见会一直保留",
    "裁决者本身也是一个故障点",
    "同时否决提案和批评",
    "有界争议",
    "并不证明普通的 LLM 批评者能发现每一个缺陷",
  ]) expect(flat).toContain(phrase);
});

test("safety liveness and semantic quality remain separate", () => {
  for (const phrase of [
    "安全性属性表示坏事不会发生",
    "活性属性表示好事最终会发生",
    "错误答案不一定构成安全性违规",
    "可观察的活性症状",
    "检测到的语义失败",
    "未检测到的语义失败",
    "协议或策略层面的安全性违规",
    "更好的独立验证器",
  ]) expect(flat).toContain(phrase);
});

test("cost and latency expose coordination overhead and the critical path", () => {
  for (const phrase of [
    "协调开销",
    "模型、工具、沙箱和重试成本",
    "最长依赖路径",
    "最慢的必要路径",
    "并发限制、供应商速率限制、共享资源或耗尽的预算",
    "增加工作者无法缩短串行依赖",
    "与单智能体等算力的基线",
    "不能视为普遍的扩展定律",
  ]) expect(flat).toContain(phrase);
});

test("security narrows delegation and keeps transport outside trust", () => {
  for (const phrase of [
    "最小权限",
    "短期凭证",
    "绝不能转发父任务可重复使用的持有者凭证",
    "困惑代理",
    "多数票不是授权",
    "在外部影响发生时",
    "上下文分离有用，但它不等于隔离",
    "A2A 提供互操作性，不提供信任",
    "智能体卡是一项能力声明，不是证明",
  ]) expect(flat).toContain(phrase);
});

test("recovery and evaluation cover the deployed mechanism", () => {
  for (const phrase of [
    "持久日志",
    "过期租约",
    "影响语义允许重试",
    "外部影响发生之后、结果记录之前崩溃",
    "不要把 `outcome_unknown` 归入 `failed`",
    "匹配的模型、预算、工具、任务集、验证器、挂钟时间限额和运行框架",
    "自助法置信区间",
    "重复工作率",
    "取消后的外部影响次数",
    "拓扑、任务图、提示、模型快照",
  ]) expect(flat).toContain(phrase);
});

test("the production rule selects mechanisms and hands off to retrieval", () => {
  for (const phrase of [
    "工作成本低、耦合紧密、按顺序执行",
    "答案空间受约束",
    "主张能够由具体证据检验",
    "阶段边界和输入输出约定稳定",
    "独立分支主导关键路径",
    "所有权和合并语义明确",
    "完整系统在用户价值上优于匹配基线",
    "协调无法修复缺失、陈旧或被污染的证据",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("@sec-rag-retrieval");
});

test("the rewrite removes obsolete certainty score theater and synthetic probes", () => {
  for (const phrase of [
    "默认做法：加更多智能体，取共识",
    "没有一个还站得住",
    "一起幻觉",
    "单一的准确率",
    "异构是值得付的成本",
    "唯一能恢复出",
    "这里没有已知的捷径",
    "Claude proposer 配上 Codex 批评者",
    "agents-verification",
    "已发布的协议",
    "Latere 的对抗式评审能力",
    "便宜的评判者",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the task graph diagram is localized and preserves its acceptance flow", () => {
  for (const phrase of [
    'P [label="规划"]',
    'R [label="调研"]',
    'D [label="数据检查"]',
    'W [label="起草"]',
    'V [label="验证"]',
    'O [label="发布"]',
    'R -> W [label="已接受"]',
    'V -> O [label="通过"]',
  ]) expect(chapter).toContain(phrase);
});
