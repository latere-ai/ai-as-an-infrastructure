import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/orchestration/05-the-harness.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/05-the-harness.qmd", import.meta.url),
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

test("Chapter 41 preserves the complete English harness contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "运行时契约",
    "运行是状态机，不是递归函数",
    "固定定义版本，明确适配协议",
    "控制动词各有含义",
    "持久工作、重复交付与外部影响",
    "工具是有类型、受授权的外部操作边界",
    "有状态工具：区分三类状态",
    "上下文是视图，不是记录",
    "沙箱由多道独立边界构成",
    "预算与准入控制必须协同",
    "把运行框架作为整体评估",
    "下层约束的传导",
    "争议所在",
    "运行契约核对表",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(textFences(chapter)).toEqual(textFences(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(35);
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("```python");
  expect(chapter).toContain("fig-harness-state-machine");
});

test("the opening states user value and keeps authority outside the harness", () => {
  for (const phrase of [
    "把建议变成有边界、可观察的工作",
    "整理模型输入、记录进度、分发工具、等待审批、执行限制",
    "可靠地暂停或停止一次运行",
    "模型负责提出建议，运行框架负责排序并记录",
    "策略与身份系统决定权限",
    "工具和外部系统承载实际影响",
    "不会授予权限",
    "无法保证外部影响恰好发生一次",
  ]) expect(flat).toContain(phrase);
});

test("the runtime contract defines durable state transitions and invariants", () => {
  for (const phrase of [
    "哪位用户、哪个租户、哪份智能体定义",
    "已持久接收",
    "外部操作已经提交、拒绝、重复执行，还是结果未知",
    "可重放哪些工作",
    "已接收事件",
    "持久历史的头部",
    "尚未完成的工作、尝试、租约和未解决影响",
    "归约器带有版本",
    "终态运行不会发出新命令",
    "预算只能通过明确授权的追加而增加",
    "迟到或重复的结果",
    "检查点只是优化手段，不是第二份真相",
  ]) expect(flat).toContain(phrase);
});

test("run states expose waits cancellation and reconciliation", () => {
  for (const phrase of [
    "`waiting_model`",
    "`waiting_tool`",
    "`waiting_approval`",
    "`paused`",
    "`cancelling`",
    "`needs_reconciliation`",
    "可见状态",
    "转换日志必须先于命令交付完成提交",
    "外部系统可能已经提交写入",
    "恢复逻辑必须理解外部影响",
  ]) expect(flat).toContain(phrase);
});

test("definition and protocol versions remain reproducible", () => {
  for (const phrase of [
    "实例生命周期与定义版本是两个独立选择",
    "智能体定义版本",
    "指令、模型路由、工具模式、策略引用和运行框架归约器版本",
    "金丝雀版本或稳定版本",
    "功能矩阵",
    "工具调用、结构化输出、流式传输、取消、用量数据、续接标识和错误语义",
    "明确失败或声明降级",
    "适配器和提供商版本",
  ]) expect(flat).toContain(phrase);
});

test("control verbs and approvals have precise state semantics", () => {
  for (const phrase of [
    "暂停、恢复、引导、取消、强制终止和分叉",
    "不是同一种中断由弱到强的不同档位",
    "已确认",
    "静止",
    "无法撤销已经提交的外部影响",
    "唯一调用 ID 和不可变载荷哈希",
    "有范围、会过期且只能使用一次",
    "再次执行授权与输入防护",
    "不能取代执行授权",
  ]) expect(flat).toContain(phrase);
});

test("durable execution distinguishes ownership delivery and effect safety", () => {
  for (const phrase of [
    "持久历史独立于提示词上下文",
    "有界租约",
    "单调递增的栅栏令牌",
    "稳定步骤 ID 和尝试次数",
    "调度标识",
    "仍可能重复交付和重复执行",
    "幂等键",
    "输入指纹",
    "结果未知",
    "资源级并发控制",
    "工作树只隔离本地文件",
  ]) expect(flat).toContain(phrase);
});

test("tool contracts separate admission exposure authorization and results", () => {
  for (const phrase of [
    "名称和 JSON 输入模式还不够",
    "目录准入",
    "逐轮暴露",
    "执行授权",
    "结果处理",
    "检索可以改善选择，不能授予权限",
    "不可信的模型输入",
    "任意令牌",
    "绑定到目标资源",
    "不存在一条通用的工具数量阈值",
  ]) expect(flat).toContain(phrase);
});

test("stateful tools and context keep distinct sources of truth", () => {
  for (const phrase of [
    "连接状态",
    "持久资源状态",
    "模型可见状态",
    "重新发现能力",
    "固定协议版本",
    "规范声明的保证",
    "权威历史记录",
    "工作上下文是这份历史的有损投影",
    "压实工作上下文不会删除权威证据",
    "活动约束、待处理审批、未完成计划、影响回执、失败",
    "选择必须由具体任务的实证决定",
  ]) expect(flat).toContain(phrase);
});

test("sandbox budget and admission contracts compose across the run tree", () => {
  for (const phrase of [
    "“在容器里运行”并不是隔离契约",
    "进程",
    "文件系统",
    "网络",
    "凭据",
    "资源限制",
    "生命周期",
    "工作树不是安全边界",
    "短期、范围狭窄并绑定受众和资源的凭据",
    "限制是一套账本，不是警告计数器",
    "预留其允许的最坏消耗",
    "子运行从父运行获得子预算",
    "原子地预留配额或容量",
    "断路器解决的是另一个问题",
  ]) expect(flat).toContain(phrase);
});

test("evaluation measures the whole harness and injects boundary failures", () => {
  for (const phrase of [
    "运行框架变更本身就是实验处理",
    "固定模型、任务集、工具实现、策略、采样配置和资源范围",
    "工具选择精确率和召回率",
    "审批绕过率和未授权影响率",
    "取消确认延迟和静止延迟",
    "取消后的影响数量和重复影响率",
    "恢复偏差和未解决影响率",
    "上下文关键内容丢失率",
    "隔离逃逸率",
    "新增延迟和新增成本",
    "外部提交与日志回执之间崩溃",
    "干净的正常路径轨迹无法检验这份契约",
  ]) expect(flat).toContain(phrase);
});

test("lower layers contested choices and the operational handoff remain explicit", () => {
  for (const phrase of [
    "模型、运行框架、工具和环境的共同性质",
    "固定运行框架版本",
    "实际序列化的请求和观察到的响应",
    "没有任何上下文投影策略能可靠预知",
    "无法凭空制造提供商能力",
    "哪一个不可变定义和归约器版本",
    "何时确认取消",
    "父预算和子预算",
    "运行框架让智能体具备可运维性，而不只是能运行",
    "图形界面会带来更长的动作链",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete diagrams thresholds and anecdotes", () => {
  for (const phrase of [
    "/figures/the-harness-1.svg",
    "一个不肯保持简单的循环",
    "fig-harness-loop",
    "实例从哪里来",
    "取消如何抵达工作",
    "fig-harness-cancel-cascade",
    "谁被允许运行",
    "fig-harness-lock-altitude",
    "模型如何得知一个工具的存在",
    "fig-harness-tool-ladder",
    "obeys",
    "30 到 50",
    "数千个工具",
    "16.7 亿",
    "47,000",
    "一句关于级联中每一跳的断言",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the localized state machine fits the reading column", async () => {
  const dot = chapter.match(
    /```\{dot\}\n([\s\S]*?label: fig-harness-state-machine[\s\S]*?)\n```/,
  )?.[1];
  expect(dot).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(dot!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(234);
});
