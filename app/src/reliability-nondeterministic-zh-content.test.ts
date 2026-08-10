import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/10-reliability-nondeterministic.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/10-reliability-nondeterministic.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/reliability-nondeterministic.bib", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string): string[] {
  const prose = source.replace(/```[\s\S]*?```/g, "");
  return [...prose.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(
    ([, level, text]) => `${level} ${text}`,
  );
}

function references(source: string): string[] {
  return [
    ...source.matchAll(
      /(?<![A-Za-z0-9])@((?:sec|fig|gls)-[A-Za-z0-9-]+|[A-Za-z][A-Za-z0-9]*)/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
}

test("Chinese Chapter 90 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 非确定系统的可靠性 {#sec-reliability}",
    "## 从结果契约出发",
    "## 衡量语义结果，但不要把样本当成流量",
    "### 把估计转化为运维策略",
    "## 下层约束：模型任务可靠性",
    "## 按故障类别重试，而不是碰运气",
    "## 把回退视为经过验证的契约变更",
    "### 冗余只有跨越相关故障域才有效",
    "## 约束依赖与过载",
    "## 构建可复现性，但不要把它等同于可靠性",
    "## 把质量故障作为事件处置",
    "## 可靠性发布记录",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines reliability over user-visible outcomes", () => {
  for (const phrase of [
    "可靠的模型服务",
    "不是每次都返回相同的响应字节",
    "面向用户的结果",
    "可靠性契约",
    "确定性不变量",
    "统计证据",
    "事件、判定条件、证据和恢复路径",
  ]) expect(flat).toContain(phrase);
});

test("the outcome contract keeps dimensions and measurement coverage separate", () => {
  for (const phrase of [
    "合格事件",
    "可用性",
    "延迟",
    "语义质量",
    "策略",
    "时效性",
    "影响正确性",
    "测量覆盖率",
    "流量切片",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("fig-reliability-contract");
});

test("SLI specification remains distinct from implementation", () => {
  for (const phrase of [
    "SLI 规格",
    "SLI 实现",
    "总体",
    "观测窗口",
    "系统发布版本",
    "缺失数据规则",
    "恢复动作",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("@gls-sli，也就是对某项服务属性的量化指标");
});

test("sampled semantic evidence records inclusion and weighting", () => {
  for (const marker of ["Y_i", "\\pi_i", "i \\in S", "1/\\pi_i"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "纳入概率",
    "加权比率估计量",
    "代表性概率样本",
    "诊断样本",
    "便利样本",
    "逆纳入权重",
    "目标总体",
  ]) expect(flat).toContain(phrase);
});

test("missing and delayed labels remain visible", () => {
  for (const phrase of [
    "未知，而不是通过",
    "测量覆盖率",
    "标签截止时间",
    "标签延迟",
    "删失",
    "遥测故障",
    "不能证明服务有所改善",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("C = \\frac");
});

test("display equations stay readable in the mobile column", () => {
  expect(chinese).toContain("\\text{按时已标注样本}");
  expect(chinese).toContain("\\text{已到期样本}");
  expect(chinese).toContain("\\begin{aligned}");
  expect(chinese).toContain("q_k &= P(S_k \\mid H_{k-1})");
  expect(chinese).toContain("H_{k-1} &= (S_1,\\ldots,S_{k-1})");
  expect(chinese).not.toContain("q_k &= P(S_k \\mid S_1,\\ldots,S_{k-1})");
  expect(chinese).not.toContain("\\text{截止时间前已标注的合格样本}");
});

test("judges are versioned audited and recalibrated", () => {
  for (const phrase of [
    "裁判版本",
    "评分量规版本",
    "人工审计",
    "假阳性",
    "假阴性",
    "评测器漂移",
    "重新校准",
  ]) expect(flat).toContain(phrase);
});

test("SLO policy separates sampled evidence from the error budget", () => {
  for (const phrase of [
    "SLO 是目标，不是置信区间",
    "抽样标签是关于合格服务事件的证据",
    "不是错误预算的计量单位",
    "加权总体估计",
    "有效样本量",
    "多窗口告警",
    "燃尽率",
    "低流量服务",
    "发布闸门",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("错误预算于是以窗口内失败的**样本**计");
});

test("task reliability states the chain rule before the iid shortcut", () => {
  for (const marker of [
    "P(S_1,\\ldots,S_n)",
    "P(S_k \\mid H_{k-1})",
    "p^n",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "概率链式法则",
    "任务步数固定",
    "相互独立",
    "每一步失败都会导致任务失败",
    "检查点",
    "丢失的工作量",
    "端到端完成率",
  ]) expect(flat).toContain(phrase);
});

test("the task-reliability visualization and runnable stay honest", () => {
  expect(chinese).toContain('data-family="pow-base"');
  for (const phrase of [
    "所需步数 n",
    "任务成功率 p^n",
    "独立同分布",
    "解释机制",
    "不能替代对未测量智能体的估计",
  ]) expect(flat).toContain(phrase);
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("iid_task_success"));
  expect(code).toBeDefined();
  expect(code).toContain("import math");
  expect(code).toContain("assert");
  expect(code).not.toMatch(/numpy|matplotlib/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("n= 50: 0.6050");
});

test("retry policy follows failure class and one owner", () => {
  for (const phrase of [
    "瞬时传输故障",
    "明确的限流响应",
    "语义故障",
    "策略故障",
    "提交状态未知",
    "一个重试负责人",
    "重试预算",
    "端到端截止时间",
    "指数退避",
    "抖动",
  ]) expect(flat).toContain(phrase);
});

test("idempotency is scoped and never promises exactly once", () => {
  for (const phrase of [
    "幂等键",
    "键的作用域",
    "保留期限",
    "请求负载的身份判定",
    "并发重复请求",
    "响应重放",
    "不等于恰好执行一次",
  ]) expect(flat).toContain(phrase);
});

test("fallback compatibility qualifies every alternate path", () => {
  for (const phrase of [
    "回退兼容性",
    "保留授权与租户边界",
    "调用方能够解释",
    "延迟、时效性、策略和影响限制",
    "更窄但合格的结果",
    "明确的失败模式",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("本身不会答不出来");
  expect(flat).not.toContain("永远留一个末端环");
});

test("degradation and abstention expose the full tradeoff", () => {
  for (const phrase of [
    "优雅降级",
    "预先验证",
    "用户可见",
    "禁止降级",
    "选择性系统",
    "风险与覆盖率契约",
    "交接率",
    "最终解决结果",
    "放弃更多用户",
  ]) expect(flat).toContain(phrase);
});

test("redundancy measures conditional diversity and shared failures", () => {
  for (const phrase of [
    "条件多样性",
    "共同模式故障",
    "共享提供商",
    "共享模型",
    "共享提示词",
    "共享检索索引",
    "共享裁判",
    "故障域矩阵",
    "注入共享故障",
  ]) expect(flat).toContain(phrase);
});

test("dependency controls include overload and qualified circuit recovery", () => {
  for (const phrase of [
    "分布式依赖",
    "舱壁",
    "负载削减",
    "熔断器",
    "最小样本量",
    "探测并发数",
    "恢复条件",
    "快速失败",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("fig-reliability-breaker");
  expect(flat).not.toContain("工具，本身就是一个可靠性面，而它们受那套更老的、确定性的章法管辖，因为它们是确定性服务");
});

test("latency hedging stays separate from quality redundancy", () => {
  for (const phrase of [
    "延迟对冲",
    "质量冗余",
    "只读或幂等请求",
    "取消落败请求",
    "负载放大",
    "最快返回的结果未必最好",
    "绝不能对未受保护的副作用做对冲",
  ]) expect(flat).toContain(phrase);
});

test("reproducibility is a full replay contract", () => {
  for (const phrase of [
    "精确重放契约",
    "模型修订版本与权重",
    "采样配置与种子",
    "检索快照",
    "工具响应",
    "服务运行时",
    "内核实现",
    "硬件",
    "组批条件",
    "无法证明正确性、安全性或可用性",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("必须选边");
  expect(flat).not.toContain("VLLM_BATCH_INVARIANT");
});

test("determinism verification and replay answer different questions", () => {
  for (const phrase of [
    "不是在确定性与验证之间二选一",
    "确定性不变量",
    "Schema、授权、配额、影响身份和来源证明",
    "统计证据",
    "可重放的事件夹具",
    "各自回答不同的问题",
  ]) expect(flat).toContain(phrase);
});

test("quality incidents mark unknown contain harm and preserve evidence", () => {
  for (const phrase of [
    "质量事件",
    "语义状态标记为未知",
    "确认范围",
    "遏制伤害",
    "保留证据",
    "修复并验证恢复",
    "发布指纹",
    "人工干预记录",
  ]) expect(flat).toContain(phrase);
});

test("scenario tests assert outcomes and recovery actions", () => {
  for (const phrase of [
    "场景测试",
    "裁判中断",
    "提供商退化",
    "检索结果过期",
    "重复交付影响",
    "幂等状态过期",
    "相关回退故障",
    "用户可见结果和恢复动作",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle produces a complete reliability release record", () => {
  for (const phrase of [
    "可靠性发布记录",
    "发布指纹和负责人",
    "纳入概率",
    "人工审计结果",
    "重试负责人和预算",
    "回退兼容性",
    "熔断器配置",
    "共同模式分析",
    "恢复证据",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps the reliability claim falsifiable", () => {
  for (const phrase of [
    "不是字节相等",
    "也不是盲信大样本",
    "可追溯的契约",
    "量化不确定性与缺失数据",
    "约束恢复",
    "确定性边界",
    "无法证伪的承诺",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite preserves interfaces and removes obsolete artifacts", () => {
  for (const marker of [
    "#sec-reliability",
    "fig-reliability-nondeterministic-curve",
    "fig-reliability-contract",
    "fig-reliability-fallback",
    "fig-reliability-breaker",
    "@sec-serving-problem",
    "@sec-statistical-reliability",
    "@sec-deployment-lifecycle",
    "::: {#further-reading}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "永远不会两次相同的输出",
    "每一步都可靠的智能体",
    "追求确定性，或者接纳采样并校验",
    "fig-reliability-nondeterministic-1",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese artifact contract matches the current English chapter", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(6);
  expect(chinese.match(/^\|\s*---/gm)?.length).toBe(2);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/<figure id=/g)?.length).toBe(1);
  expect(chinese.match(/data-viz="curve"/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)).toBeNull();
});

test("the chapter bibliography no longer carries the retired Chinese-only source", () => {
  expect(bibliography).not.toContain("Retained for the Chinese chapter");
  expect(bibliography).not.toContain("sglang2025deterministic");
});

test("localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/reliability-nondeterministic.html",
      "",
    );
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/reliability-nondeterministic.html",
    chapterTitle: "非确定系统的可靠性",
    chapterNum: "90",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings: renderedHeadings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("可靠性发布记录");
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
