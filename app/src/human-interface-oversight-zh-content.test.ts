import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/11-human-interface-oversight.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/11-human-interface-oversight.qmd", import.meta.url),
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

test("Chinese Chapter 91 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 人机界面与监督回路 {#sec-human-interface-oversight}",
    "## 从屏幕到控制机制",
    "## 有意安排人的介入位置",
    "## 校准后的依赖取决于人机共同决策",
    "### 展示可核查的信息",
    "## 将批准与提交绑定",
    "### 取消不等于回滚",
    "### 多人复核需要真正的独立性规则",
    "## 把人工审查作为队列运行",
    "### 交接是一项协议",
    "## 修正事件是证据，不是真值",
    "## 衡量整个回路",
    "## 标准与法律界定适用范围，而非通用方案",
    "## 测试监督路径",
    "## 争议所在",
    "## 下层约束",
    "## 界面是运行时的一部分",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines oversight as an enforceable decision boundary", () => {
  for (const phrase of [
    "可执行的决策边界",
    "改变系统可以做什么",
    "呈现、决策、强制执行、外部影响和轨迹",
    "批准的载荷",
    "外部影响",
    "机制",
    "受容量约束",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("本身就是控制面");
});

test("the oversight control contract governs every effect", () => {
  for (const phrase of [
    "监督控制契约",
    "提议身份",
    "主体、范围和载荷",
    "影响类别",
    "证据",
    "权限",
    "审查者资格",
    "决定",
    "超时默认行为",
    "提交条件",
    "恢复",
    "轨迹与结果",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("fig-human-interface-control-plane");
});

test("reviewer eligibility includes perception interpretation and accessibility", () => {
  for (const phrase of [
    "感知相关事实",
    "理解其含义",
    "推断接下来可能发生什么",
    "无障碍",
    "语言",
    "领域知识",
    "无法感知或理解的信息不构成有效监督",
  ]) expect(flat).toContain(phrase);
});

test("human-in-the-loop has explicit placement authority and failure behavior", () => {
  expect(flat).toContain(
    "@gls-human-in-the-loop，是指某个明确的人或角色能够检查相关证据并改变执行路径",
  );
  for (const phrase of [
    "提交之前",
    "执行期间",
    "结果产生之后",
    "时间预算",
    "超时默认行为",
    "接管时间",
    "演练或轮岗",
  ]) expect(flat).toContain(phrase);
});

test("the localized stepper keeps proposal decision commit and outcome distinct", () => {
  for (const marker of [
    'id="fig-human-interface-oversight-stepper"',
    'data-viz="stepper"',
    'data-chip="提议"',
    'data-chip="检查"',
    'data-chip="决定"',
    'data-chip="提交"',
    'data-chip="核验"',
  ]) expect(chinese).toContain(marker);
  expect(flat).not.toContain("幂等的回滚路径");
});

test("calibrated reliance evaluates the joint human-AI outcome", () => {
  expect(flat).toContain(
    "@gls-calibrated-reliance，是指接受正确的帮助，并检查、修改或拒绝错误的帮助",
  );
  expect(flat).toContain(
    "@gls-automation-bias，是指人们过度接受自动化建议的倾向",
  );
  for (const phrase of [
    "AI 正确",
    "AI 错误",
    "人接受",
    "人推翻",
    "共同结果",
    "仅看接受率",
    "独立裁定",
  ]) expect(flat).toContain(phrase);
});

test("review surfaces privilege inspectable evidence over persuasion", () => {
  for (const phrase of [
    "精确的动作差异",
    "来源证明",
    "反面证据",
    "缺失输入",
    "分布外",
    "针对具体任务、总体、发布版本和结果完成校准",
    "不能授予权限",
    "私有思维链",
  ]) expect(flat).toContain(phrase);
});

test("approval binds the exact action and is revalidated at commit", () => {
  for (const phrase of [
    "批准记录",
    "动作哈希",
    "资源版本",
    "前置条件",
    "到期",
    "重新校验",
    "检查时与使用时",
    "不会自行转移问责责任",
  ]) expect(flat).toContain(phrase);
});

test("the policy-driven runnable matches English and executes", () => {
  const chineseCode = chinese.match(/```python\n([\s\S]*?)\n```/)?.[1];
  const englishCode = english.match(/```python\n([\s\S]*?)\n```/)?.[1];
  expect(chineseCode).toBeDefined();
  expect(chineseCode).toBe(englishCode);
  expect(chineseCode).not.toMatch(/numpy|risk\s*>=\s*0\.|confidence\s*<\s*0\./i);
  const run = Bun.spawnSync(["python3", "-c", chineseCode!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("approval binding verified");
});

test("cancellation unknown commit and recovery states stay distinct", () => {
  for (const phrase of [
    "取消请求",
    "执行确认",
    "提交状态未知",
    "对账",
    "回滚",
    "补偿",
    "遏制",
    "幂等性不等于回滚",
    "恢复完成",
  ]) expect(flat).toContain(phrase);
});

test("multiple reviewers require real independence and quorum rules", () => {
  for (const phrase of [
    "职责分离",
    "独立性",
    "法定人数",
    "利益冲突",
    "决定顺序",
    "共享故障",
  ]) expect(flat).toContain(phrase);
});

test("human review is operated as a finite-capacity queue", () => {
  for (const marker of ["\\lambda", "\\mu", "c", "\\rho"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "到达率",
    "服务率",
    "利用率",
    "积压",
    "优先级",
    "过载模式",
    "审查者疲劳",
    "预留容量",
    "默认拒绝危险操作",
  ]) expect(flat).toContain(phrase);
});

test("handoff preserves ownership acknowledgement deadlines and context", () => {
  for (const phrase of [
    "交接负责人",
    "接收方",
    "确认",
    "截止时间",
    "上下文包",
    "升级原因",
    "有界升级图",
    "在队列之间无限往返",
  ]) expect(flat).toContain(phrase);
});

test("correction events retain provenance without becoming truth labels", () => {
  for (const phrase of [
    "反馈事件不是真值标签",
    "修改前工件",
    "修改后工件",
    "原因代码",
    "任务版本",
    "系统发布版本",
    "审查者身份或角色",
    "后续结果",
    "纳入概率",
    "选择偏差",
    "代表性审计样本",
  ]) expect(flat).toContain(phrase);
});

test("metrics cover joint quality measurement coverage and queue health", () => {
  for (const phrase of [
    "错误接受",
    "错误拒绝",
    "裁定质量",
    "测量覆盖率",
    "审查延迟",
    "队列中最久等待时间",
    "放弃",
    "切片",
    "不是因果解释",
    "控制完整性",
    "修正产出",
  ]) expect(flat).toContain(phrase);
});

test("the standards and legal note are scoped to actual applicability", () => {
  for (const phrase of [
    "自愿性框架",
    "第 14 条",
    "高风险 AI 系统",
    "2027 年 12 月 2 日",
    "2028 年 8 月 2 日",
    "2026 年 7 月 27 日",
    "不是普遍适用的产品规则",
    "不构成法律建议",
  ]) expect(flat).toContain(phrase);
});

test("scenario tests exercise the complete oversight boundary", () => {
  for (const phrase of [
    "过期的预览",
    "载荷已变更",
    "批准已过期",
    "重复提交",
    "取消失败",
    "审查者中断",
    "队列过载",
    "轨迹缺失",
    "置信度提示",
    "事件运行手册",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle produces a complete oversight release record", () => {
  for (const phrase of [
    "监督发布记录",
    "控制契约和策略版本",
    "批准绑定",
    "超时默认行为",
    "审查者资格",
    "容量假设",
    "无障碍与语言检查",
    "证据保留",
    "控制、队列、事件响应和定期复核的负责人",
    "“由人批准”不是发布论据",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps oversight bounded and operational", () => {
  for (const phrase of [
    "既不能证明安全，也不能取代自动化",
    "经过专门设计的依赖",
    "故障模式",
    "容量上限",
    "有效的人类决定能够改变执行",
    "核验由此产生的实际影响",
    "不是从一串没有区分的点击开始",
  ]) expect(flat).toContain(phrase);
});

test("lower-layer constraints remain explicit", () => {
  for (const phrase of [
    "如果评测不衡量校准程度",
    "如果运行框架无法暂停、恢复、取消和对账",
    "如果授权没有绑定到提议",
    "如果数据引擎丢失编辑和结果",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite preserves interfaces and removes obsolete claims", () => {
  for (const marker of [
    "#sec-human-interface-oversight",
    "fig-human-interface-control-plane",
    "fig-human-interface-oversight-stepper",
    "@sec-the-harness",
    "@sec-data-engine",
    "::: {#further-reading}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "fig-human-interface-oversight-1",
    "低风险、可逆、高置信的动作可以自动执行",
    "risk >= 0.8",
    "confidence < 0.7",
    "点踩如果不带理由",
    "规则可以说得很短",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese artifact contract matches the current English chapter", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(2);
  expect(chinese.match(/^\|\s*---/gm)?.length).toBe(2);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/<figure id=/g)?.length).toBe(1);
  expect(chinese.match(/data-viz="stepper"/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
});

test("the localized control-plane figure parses and fits mobile", async () => {
  const block = chinese.match(/```\{dot\}\n([\s\S]*?)\n```/);
  expect(block).toBeDefined();
  expect(block![1]).toContain("rankdir=TB");
  const graphviz = await loadGraphviz();
  const svg = renderDot(
    graphviz,
    block![1],
    new Map(),
    "practice/human-interface-oversight.html",
    "",
  );
  expect(svg).not.toContain("graphviz error");
  const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/human-interface-oversight.html",
    chapterTitle: "人机界面与监督回路",
    chapterNum: "91",
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
  expect(html).not.toContain("**");
  expect(html).toContain("监督发布记录");
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
