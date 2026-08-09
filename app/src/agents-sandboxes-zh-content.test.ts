import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/05-agents-and-sandboxes.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/05-agents-and-sandboxes.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string): string[] {
  return [...source.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(
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

test("Chinese Chapter 85 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 智能体、框架与沙箱 {#sec-agents-practice}",
    "## 固定智能体执行契约",
    "## 明确控制循环",
    "### 区分不同类型的状态",
    "### 按预先声明的原因停止",
    "## 先选择控制语义，再选择框架",
    "## 让外部操作可安全恢复",
    "### 使用类型化信封委派任务",
    "## 把每个工具都当作外部操作契约",
    "### 把审批绑定到实际执行的操作",
    "## 把 MCP 当作传输协议，而不是信任标记",
    "## 从威胁模型出发定义沙箱",
    "### 按调用路径比较隔离机制",
    "### 定义完整的沙箱边界",
    "### 把凭据留在工作负载之外",
    "### 把工作区状态视为受治理的制品",
    "### 为浏览器智能体设置两道边界",
    "## 通过受治理的边界连接运行时",
    "## 记录能够支持恢复和审计的证据",
    "## 授权前先验证失败行为",
    "## 运营智能体生命周期",
    "## 下层约束",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines an agent release rather than a larger prompt", () => {
  for (const phrase of [
    "智能体不等于给模型配上一段目标更宏大的系统提示词",
    "模型只是这个系统中的一个组件",
    "不是调度器、授权服务、持久化存储或安全边界",
    "智能体发布",
    "智能体执行契约",
    "可逆的部署",
  ]) expect(flat).toContain(phrase);
});

test("the execution contract bounds authority effects and recovery", () => {
  for (const phrase of [
    "任务边界",
    "成功证据",
    "允许的外部操作",
    "权限",
    "数据边界",
    "预算",
    "人工控制",
    "终止条件",
    "恢复",
    "回滚",
    "起草退款申请和实际退款是两种不同的能力",
    "完整的服务系统",
  ]) expect(flat).toContain(phrase);
});

test("the control loop separates proposals validation authorization and effects", () => {
  for (const marker of [
    "u_t &\\sim \\pi_{\\theta}",
    "a_t &= V(u_t)",
    "d_t &= A(p_t,a_t,r_t)",
    "s_{t+1} &= \\delta",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "当前的持久化运行状态",
    "上下文投影",
    "模型分布",
    "经过验证的候选操作",
    "外部授权函数",
    "工具返回的观察结果",
    "确定性的状态转移函数",
    "随机过程到模型提出方案为止",
  ]) expect(flat).toContain(phrase);
});

test("state classes and terminal reasons remain operationally distinct", () => {
  for (const phrase of [
    "对话历史",
    "工作状态",
    "持久化执行状态",
    "外部状态",
    "长期记忆",
    "消息会话不是工作流检查点",
    "步骤预算",
    "词元预算",
    "成本预算",
    "墙钟时间期限",
    "无进展",
    "budget_exhausted",
    "新的租约",
  ]) expect(flat).toContain(phrase);
});

test("framework selection follows required control semantics", () => {
  for (const phrase of [
    "线性循环",
    "状态图",
    "持久化工作流",
    "文件系统运行框架",
    "监督者与工作进程",
    "能力矩阵",
    "检查点语义",
    "并发",
    "提供商可移植性",
    "同一套验证工作流",
  ]) expect(flat).toContain(phrase);
});

test("recovery is explicit about duplicate and ambiguous effects", () => {
  for (const phrase of [
    "至少一次交付",
    "幂等键",
    "意图记录",
    "外部操作回执",
    "结果不明确",
    "补偿或升级处理",
    "继续执行",
    "工作流重放",
    "已记录输出的测试重放",
    "实时重新评估",
    "不能用新语义重新解释旧审批",
  ]) expect(flat).toContain(phrase);
});

test("delegation narrows authority through a typed envelope", () => {
  for (const phrase of [
    "子智能体的权限范围必须窄于父智能体",
    "delegation:",
    "permitted_tools",
    "authority_scope",
    "result_schema",
    "父智能体负责验证结果",
    "取消会沿所有权树向下传播",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/```yaml/g)?.length).toBe(2);
});

test("tool contracts cover effects authorization and hostile results", () => {
  for (const phrase of [
    "输入 Schema",
    "输出 Schema",
    "前置条件",
    "后置条件",
    "外部操作类别",
    "幂等性",
    "错误分类",
    "数据分类",
    "凭据范围",
    "完整中介",
    "间接提示注入",
    "带来源信息的受污染数据",
  ]) expect(flat).toContain(phrase);
});

test("approval is bound to the exact effect and checked again", () => {
  for (const phrase of [
    "审批的是具体操作，而不是模型给出的摘要",
    "规范化参数",
    "目标资源",
    "策略版本",
    "有效期",
    "执行前",
    "重新授权",
    "不能作为可重复使用的不记名权限凭证",
  ]) expect(flat).toContain(phrase);
});

test("MCP interoperability stays separate from trust and authorization", () => {
  for (const phrase of [
    "传输协议",
    "版本协商",
    "能力协商",
    "不能授予信任",
    "工具发现只是清单，不是背书",
    "业务幂等键",
    "令牌透传",
    "混淆代理",
    "本地 stdio 服务器是子进程",
    "通过 MCP 调用子进程并不会隔离它",
  ]) expect(flat).toContain(phrase);
});

test("the sandbox guarantee is derived from a threat model", () => {
  for (const marker of [
    "G ={}& K \\land P \\land F \\land N",
    "\\land I \\land R \\land T \\land C",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "主机逃逸",
    "跨租户",
    "数据外泄",
    "拒绝服务",
    "供应链",
    "非预期持久化",
    "受信任操作人员",
    "沙箱保证由多项条件共同构成，缺一不可",
  ]) expect(flat).toContain(phrase);
});

test("isolation mechanisms are compared by their real call paths", () => {
  for (const phrase of [
    "加固容器",
    "Linux namespace",
    "共享主机内核",
    "用户态内核",
    "微虚拟机",
    "来宾内核",
    "语言隔离环境",
    "浏览器进程",
    "纵深防御",
    "不存在适用于所有场景的唯一答案",
  ]) expect(flat).toContain(phrase);
});

test("the complete sandbox envelope pins every enforcement point", () => {
  for (const phrase of [
    "image_digest",
    "read_only",
    "network_egress",
    "default: deny",
    "memory_bytes",
    "process_count",
    "disk_bytes",
    "wall_clock",
    "workspace_lifetime",
    "运行时在工作负载之外执行文件系统挂载",
    "限制必须覆盖所有后代进程",
  ]) expect(flat).toContain(phrase);
});

test("credentials workspace state and browser control keep separate boundaries", () => {
  for (const phrase of [
    "不受信任的执行环境不能获得可重复使用的环境权限",
    "原始提供商密钥不会进入沙箱",
    "短期令牌",
    "出站替换",
    "默认拒绝",
    "干净基线",
    "工作区快照",
    "输入摘要",
    "输出摘要",
    "制品来源",
    "隔离区",
    "全新的浏览器配置文件",
    "WebDriver 是高权限远程控制接口",
  ]) expect(flat).toContain(phrase);
});

test("the runtime separates enforcement seams and evidence stores", () => {
  for (const phrase of [
    "控制器使用各项服务，但不充当信任中心",
    "模型网关",
    "工具代理",
    "沙箱监督器",
    "持久化状态",
    "任何一份网关日志都不足以证明四条路径的完整行为",
    "事件日志用于恢复状态",
    "审计记录",
    "可观测性追踪",
  ]) expect(flat).toContain(phrase);
});

test("verification exercises deployed failure and containment boundaries", () => {
  for (const phrase of [
    "恶意工具输出",
    "错误租户",
    "过期令牌",
    "陈旧审批",
    "重复交付",
    "工作进程崩溃",
    "派生进程停止",
    "进程炸弹",
    "文件系统逃逸",
    "原始 IP",
    "清理控制器故障",
    "影子执行",
    "金丝雀租户",
    "上一已知正常路由",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle closes every release handoff", () => {
  for (const phrase of [
    "固定契约",
    "构建最小的显式循环",
    "定义每个工具",
    "选择控制语义",
    "选择并测试隔离机制",
    "演练恢复",
    "封存发布",
    "评估并进行影子运行",
    "以最小权限进行金丝雀发布",
    "监控并重新验证",
    "重新验证触发条件",
    "智能体发布记录",
  ]) expect(flat).toContain(phrase);
});

test("lower-layer and contested claims preserve distinct boundaries", () => {
  for (const phrase of [
    "控制器无法恢复外部 API 无法识别的操作",
    "隔离限制代码在哪里运行",
    "授权限制经过验证的主体可以做什么",
    "不存在适用于所有智能体的最佳框架",
    "只授予经实测足够完成任务的最小权限",
    "同时通过任务测试和隔离测试",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete catalog and unsupported defaults", () => {
  for (const phrase of [
    "截至 2026 年年中",
    "选手对比",
    "一个稳妥的默认",
    "选 **E2B**",
    "升级到 LangGraph",
    "低于 200ms",
    "低于 90ms",
    "空闲零计费",
    "data-set=\"agent-frameworks-zh\"",
    "一个突发型智能体",
  ]) expect(chinese).not.toContain(phrase);
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(4);
  expect(chinese.match(/^\|---/gm)?.length).toBe(7);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toContain(":::: {.runnable}");
  expect(chinese).not.toContain("<figure");
  expect(chinese).not.toContain(".svg)");
  expect(chinese).not.toContain("—");
});

test("display equations use mobile-safe rows", () => {
  expect(chinese).toContain("\\bot, & \\text{otherwise},");
  expect(chinese).toContain("G ={}& K \\land P \\land F \\land N \\\\");
  for (const block of chinese.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)) {
    for (const line of block[1].split("\n")) expect(line.length).toBeLessThanOrEqual(68);
  }
});

test("all localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/agents-and-sandboxes.html",
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
    currentHref: "practice/agents-and-sandboxes.html",
    chapterTitle: "智能体、框架与沙箱",
    chapterNum: "85",
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
  expect(html).toContain("最终产物是一份智能体发布记录");
  expect(renderedHeadings.some(({ text }) => text.includes("\\pi_"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
