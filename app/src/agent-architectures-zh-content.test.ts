import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/02-agent-architectures.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/02-agent-architectures.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map((match) => match[0]);
}

function textFences(source: string): string[] {
  return [...source.matchAll(/```text\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

test("Chapter 38 preserves the complete English agent-architecture contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "一轮交互就是一次状态转移",
    "架构是一组契约",
    "根据任务选择控制模式",
    "规划不是开关，而是一种节奏",
    "选择动作表示方式",
    "让每一个分支都明确",
    "区分自主性与权限",
    "下层约束：上下文是一笔共享预算",
    "争议所在",
    "把架构当作完整系统来验证",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(textFences(chapter)).toEqual(textFences(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(31);
  expect(chapter.match(/<figure /g)?.length).toBe(1);
  expect(chapter).toContain("fig-agent-architectures-stepper");
  expect(chapter).toContain("fig-agent-architectures-react-loop");
  expect(chapter).toContain('S [label="持久状态"]');
  expect(chapter).toContain('X [label="携带已记录结果退出"');
});

test("the opening defines an agent by a bounded closed decision loop", () => {
  for (const phrase of [
    "每一步和每个分支都能在执行前写明",
    "下一项操作取决于尚未出现的信息",
    "封闭的决策循环",
    "把观测转化为下一个有边界的动作",
    "控制器、整理后的上下文、动作接口、环境、状态转移和终止规则",
    "工具调用只是动作接口的一种",
    "规划和记忆是循环中的设计选择",
    "并不定义唯一正确的智能体架构",
  ]) expect(flat).toContain(phrase);
});

test("one turn exposes typed decisions, state boundaries, and every stop path", () => {
  for (const phrase of [
    "每个符号都对应一项可以记录和测试的运行时对象",
    "解析后的决定必须有明确类型",
    "向用户提问",
    "请求执行动作",
    "提交最终回答",
    "结构化终止原因",
    "工具结果、执行错误或策略拒绝",
    "完成条件通过后才能离开循环",
    "成功、终局失败、取消、预算耗尽",
    "状态 $s_t$ 与模型上下文 $x_t$ 不是同一个对象",
    "经过选择和格式化的状态视图",
  ]) expect(flat).toContain(phrase);
});

test("the controlled turn keeps reasoning optional and decisions observable", () => {
  for (const phrase of [
    "整理本轮输入",
    "提出一个带类型的决定",
    "执行前验证",
    "执行并取得观测",
    "把结果归并到状态",
    "检查结果",
    "自适应控制不要求展示推理轨迹",
    "决定记录",
    "动作参数、观测来源、审批结果、已消耗预算和完成证据",
  ]) expect(flat).toContain(phrase);
});

test("architecture roles are explicit runtime contracts", () => {
  for (const phrase of [
    "控制器",
    "上下文整理器",
    "状态存储与更新器",
    "动作目录",
    "引用监视器",
    "分发器与环境",
    "完成检查器",
    "终止策略",
    "架构与运行框架的实现分开",
    "队列、租约、重试、检查点和崩溃恢复",
  ]) expect(flat).toContain(phrase);
});

test("control patterns are selected by task and feedback cadence", () => {
  for (const phrase of [
    "固定工作流",
    "反应式下一步动作",
    "滚动时域规划",
    "先规划后执行",
    "分层规划器与执行器",
    "评估器与改进器",
    "分支搜索",
    "工作流能够表达任务时，通常应优先使用工作流",
    "只能在设计时尚不可见的观测出现后才能选择动作",
  ]) expect(flat).toContain(phrase);
});

test("planning is state with explicit replan triggers, not authority", () => {
  for (const phrase of [
    "何时制定计划、计划覆盖多远，以及什么情况触发修改",
    "不同的规划节奏",
    "写下来的计划属于状态，不代表权限",
    "前置条件失败",
    "用户约束发生变化",
    "动作被拒绝",
    "剩余预算达到阈值",
    "稳定的产物",
    "不构成通用的正确性保证",
  ]) expect(flat).toContain(phrase);
});

test("action representations retain distinct composition and safety boundaries", () => {
  for (const phrase of [
    "结构化函数调用",
    "可执行代码",
    "环境原生动作",
    "完成语法检查后还要验证语义",
    "在沙箱中运行",
    "限制 CPU、内存、网络和时间",
    "结果仅适用于这些模型、接口和基准",
    "动作名称、参数形状、观测格式和反馈延迟",
    "稳定的幂等键",
    "长期运行的工作需要持久句柄",
    "依赖关系和副作用互不冲突",
  ]) expect(flat).toContain(phrase);
});

test("every branch, denial, retry, and completion outcome is explicit", () => {
  for (const phrase of [
    "不是“不断调用模型，直到它不再输出工具调用”",
    "澄清问题、拒绝、格式错误或模型故障",
    "解析错误、授权拒绝、超时和工具故障",
    "带类型的观测",
    "成功、失败、取消和预算耗尽",
    "必须保留这些结果",
  ]) expect(flat).toContain(phrase);
});

test("autonomy and authority remain independent review axes", () => {
  for (const phrase of [
    "自主性描述由谁选择下一项操作",
    "权限描述系统可以执行哪些操作",
    "两条彼此独立的轴",
    "增加自主性，却不改变权限",
    "即使控制循环不变，也会扩大权限",
    "影响范围取决于权限、可达范围与可逆性",
    "不能由“智能体化”这样的模糊标签决定",
  ]) expect(flat).toContain(phrase);
});

test("context accounting replaces invented tool-count thresholds", () => {
  for (const phrase of [
    "上下文窗口必须同时容纳指令、任务数据、工作状态、动作规范",
    "每一项都是第 $t$ 轮的实际词元预算",
    "等式只是记账",
    "再挂载一个动作会产生确定的词元成本",
    "不是一条普遍成立的指数曲线",
    "不存在固定的工具数量阈值",
    "扁平目录、分阶段挂载、检索或显式发现",
    "加入无关工具和相似规范",
    "没有动作适用时能否弃权",
    "动态选择规范时报告检索召回率",
  ]) expect(flat).toContain(phrase);
});

test("contested choices stay scoped and system verification holds the envelope fixed", () => {
  for (const phrase of [
    "显式规划与隐式规划之间没有普遍胜者",
    "相同的运行边界",
    "相同的模型检查点、任务分布、工具实现、权限和预算",
    "任务结果",
    "控制质量",
    "安全与权限",
    "状态质量",
    "成本与服务",
    "按状态转移检查失败",
    "不同的契约，需要不同的修复",
    "下一章讨论",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete taxonomies, figures, and synthetic claims", () => {
  for (const phrase of [
    "/figures/agent-architectures-1.svg",
    "计划遇到真实环境",
    "弥合模型与世界之间的缺口",
    "循环的解剖",
    "这些部件如何成熟",
    "循环分发的是什么",
    "fig-agent-architectures-four-parts",
    "fig-agent-architectures-tool-classes",
    "fig-agent-architectures-curve",
    "data-family=\"exp-decay\"",
    "import numpy",
    "p ** n",
    "真正撑得起「智能体」这个名号",
    "工具使用是唯一",
    "大约到三五十个工具就到头了",
    "准确率随目录变大而下滑",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
