import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/13-operating-contracts.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/13-operating-contracts.qmd", import.meta.url),
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

test("Chinese Chapter 93 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 运营契约：SLO、成本、事故与多租户 {#sec-operating-contracts}",
    "## 把契约写成可执行 Schema",
    "## 下层约束",
    "## 区分 SLI、SLO 与 SLA",
    "### 语义质量需要单独的测量契约",
    "## 有计划地使用错误预算",
    "## 在执行之前控制成本",
    "## 逐个边界落实租户隔离",
    "## 把事故作为受控状态转换来处理",
    "## 发布契约变更",
    "## 把治理编译成有界控制",
    "## 发布前测试失败路径",
    "## 争议所在",
    "## 基础设施是一项持续维护的承诺",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines a versioned contract that changes operating decisions", () => {
  for (const phrase of [
    "带版本的运营契约",
    "用户承诺",
    "测量、执行、决策权限和证据",
    "准入、路由、发布、事故处置或审查行为",
    "可执行策略",
    "运营契约发布记录",
  ]) expect(flat).toContain(phrase);
});

test("the executable schema covers ownership scope measurement and lifecycle", () => {
  for (const phrase of [
    "契约身份",
    "生效时间",
    "失效时间",
    "负责人",
    "批准人",
    "任务类别",
    "合格流量",
    "测量来源",
    "缺失数据",
    "例外策略",
    "回滚计划",
  ]) expect(flat).toContain(phrase);
});

test("unknown contract values produce owned runtime states", () => {
  for (const phrase of [
    "未知值是一种状态，不是空白单元格",
    "拒绝",
    "隔离",
    "合格的安全模式",
    "升级处理",
    "在事故期间临时拼出的",
    "需要负责人",
  ]) expect(flat).toContain(phrase);
});

test("the control plane publishes policy without telemetry rewriting it", () => {
  for (const phrase of [
    "不可变的契约版本",
    "最少必要声明",
    "逐个边界执行",
    "保留带版本的证据",
    "不会直接改写线上策略",
    "经过审查的下一版本",
  ]) expect(flat).toContain(phrase);
});

test("request context is minimized and reauthorized at every boundary", () => {
  for (const phrase of [
    "不透明的租户标识符",
    "预留标识符",
    "服务类别",
    "策略版本",
    "轨迹标识符",
    "用户内容、凭据或宽泛授权",
    "重新授权",
    "轨迹上下文不能授权操作",
  ]) expect(flat).toContain(phrase);
});

test("upper-layer promises constrain lower controls without granting authority", () => {
  for (const phrase of [
    "端到端延迟目标",
    "执行之前的准入与预算预留",
    "租户隔离配置",
    "质量目标约束抽样与评测设计",
    "反向约束止于权限边界",
    "不能赋予下层边界原本没有的权限",
  ]) expect(flat).toContain(phrase);
});

test("SLI SLO and SLA remain distinct", () => {
  for (const phrase of [
    "服务水平指标（SLI）",
    "服务水平目标（SLO）",
    "服务水平协议（SLA）",
    "不能混为一谈",
    "对外承诺",
    "补救措施",
    "内部仪表板本身不会形成 SLA",
  ]) expect(flat).toContain(phrase);
});

test("the event SLI defines its population predicate and denominator", () => {
  for (const marker of [
    "\\operatorname{SLI}_W",
    "e \\in E_W",
    "\\mathbf{1}",
    "G(e)",
    "|E_W|",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "先定义以下符号",
    "测量窗口",
    "合格事件集合",
    "达标事件判定条件",
    "取消、超时、重复、重试、缺失和未知结果",
    "只统计成功响应的延迟",
  ]) expect(flat).toContain(phrase);
});

test("semantic quality has a delayed sampled measurement contract", () => {
  for (const phrase of [
    "概率样本",
    "纳入概率",
    "带版本的评分规则",
    "裁判版本",
    "人工校准",
    "标签延迟",
    "置信区间",
    "测量覆盖率",
    "无法立即触发单次请求告警",
    "最大标签延迟",
  ]) expect(flat).toContain(phrase);
});

test("error-budget burn rate is fully defined", () => {
  for (const marker of ["b = 1 - S^*", "\\beta_W", "q_W"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "其中，$b$ 表示允许的不达标事件比例",
    "错误预算比例",
    "燃烧率",
    "恰好按计划速度消耗预算",
    "更早耗尽预算",
  ]) expect(flat).toContain(phrase);
});

test("paging uses multiwindow burn rules and treats low traffic explicitly", () => {
  for (const phrase of [
    "多窗口、多燃烧率规则",
    "快速告警",
    "较慢的工单",
    "低流量服务",
    "合成探针",
    "阈值和窗口是服务决策",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("Wilson 置信下界");
});

test("the error-budget policy changes reversible operating behavior", () => {
  for (const phrase of [
    "预算健康、受到威胁或已经耗尽",
    "放慢发布",
    "提高审查强度",
    "关闭可选功能",
    "要求例外批准",
    "可逆",
    "不合格模型或不安全回退",
  ]) expect(flat).toContain(phrase);
});

test("runtime cost follows estimate reserve admit meter and reconcile", () => {
  for (const phrase of [
    "估算、预留、准入、计量和对账",
    "预算层级",
    "任务、请求、租户、产品、环境和账期",
    "同一笔剩余预算",
  ]) expect(flat).toContain(phrase);
});

test("task cost includes every attempt and cost source", () => {
  for (const marker of [
    "C_t",
    "A_t",
    "C^{\\mathrm{retrieval}}_a",
    "C^{\\mathrm{judge}}_a",
    "C^{\\mathrm{human}}_t",
    "C^{\\mathrm{storage}}_t",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "原始尝试和每次重试或回退",
    "价格版本和币种",
    "延迟入账",
    "不会改写历史价格上下文",
  ]) expect(flat).toContain(phrase);
});

test("cost per accepted task keeps the denominator visible", () => {
  expect(chinese).toContain("\\mathbf{1}[\\operatorname{accepted}(t)]");
  for (const phrase of [
    "每个已接受任务的单位成本",
    "带版本的接受判定式",
    "给出分母和拒绝原因",
    "靠让更多任务失败显得高效",
  ]) expect(flat).toContain(phrase);
});

test("the runtime ledger matches English and executes idempotently", () => {
  const chineseCode = chinese.match(/```python\n([\s\S]*?)\n```/)?.[1];
  const englishCode = english.match(/```python\n([\s\S]*?)\n```/)?.[1];
  expect(chineseCode).toBeDefined();
  expect(chineseCode).toBe(englishCode);
  expect(chineseCode).not.toMatch(/numpy|pandas|requests/);
  const run = Bun.spawnSync(["python3", "-c", chineseCode!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stdout)).toContain("spent=25 available=75");
});

test("billing normalization is not runtime enforcement", () => {
  for (const phrase of [
    "跨职能运营框架",
    "供应商中立的账单数据 Schema",
    "不是实时准入控制器",
    "FOCUS 1.4",
    "2026 年 6 月 4 日",
    "供应商采用程度和数据送达延迟",
    "不会等到这些数据到达后才控制当前请求",
  ]) expect(flat).toContain(phrase);
});

test("tenancy is enforced across independent boundaries", () => {
  for (const phrase of [
    "不是从请求头复制出来的字符串",
    "控制平面与数据平面隔离",
    "仅靠命名空间不能实现隔离",
    "准入与调度器",
    "模型与 KV 缓存",
    "检索与存储",
    "工具与出站访问",
    "证据与审查",
    "计费与限额",
  ]) expect(flat).toContain(phrase);
});

test("fairness and noisy-neighbor behavior are tested under contention", () => {
  for (const phrase of [
    "公平性不能只靠限流",
    "配额、预留、并发、优先级、队列纪律、背压和负载削减",
    "噪声邻居测试",
    "租户 A",
    "租户 B",
    "有竞争和无竞争",
    "静默的优先级反转",
  ]) expect(flat).toContain(phrase);
});

test("isolation is treated as a vector tied to the threat model", () => {
  for (const phrase of [
    "隔离是一个向量",
    "专用节点",
    "控制平面、模型端点、索引、密钥、证据系统或人员",
    "沙箱不能隔离检索",
    "独立索引也不能限制出站访问",
    "威胁模型和所需影响范围",
  ]) expect(flat).toContain(phrase);
});

test("incident response defines harm roles and separate clocks", () => {
  for (const phrase of [
    "重大服务影响或 AI 安全、信息安全、隐私、成本与租户伤害",
    "事故指挥官",
    "运营负责人",
    "沟通负责人",
    "证据负责人",
    "检测时间、确认时间、遏制时间、恢复时间和最终核验",
    "单一的“解决时间”",
  ]) expect(flat).toContain(phrase);
});

test("incident state transitions preserve evidence and unknown commits", () => {
  for (const phrase of [
    "检测并核验",
    "声明事故并分配严重级别",
    "不可变证据快照",
    "遏制影响",
    "恢复合格服务",
    "核对提交状态未知的操作",
    "从事故声明到恢复",
    "执行确认",
  ]) expect(flat).toContain(phrase);
});

test("incident learning records either verified action or justified no change", () => {
  for (const phrase of [
    "根本原因与促成条件",
    "负责人、截止时间和核验方法",
    "纠正措施",
    "已接受风险",
    "有充分理由地决定不作变更",
    "带版本且可以审查",
  ]) expect(flat).toContain(phrase);
});

test("contract changes use a controlled release lifecycle", () => {
  for (const phrase of [
    "草拟、校验、影子运行、金丝雀发布、激活、监控、回滚和废弃",
    "经过测试的先前版本",
    "紧急例外",
    "最大影响范围",
    "自动失效",
    "正常审查流程",
  ]) expect(flat).toContain(phrase);
});

test("every contract consumer reports its active version", () => {
  for (const phrase of [
    "网关、调度器、模型路由器、检索器、工具策略、沙箱、评测、事故自动化、计费和报告",
    "无法报告当前生效版本",
    "不具备协同发布条件",
  ]) expect(flat).toContain(phrase);
});

test("governance sources stay bounded and do not replace specialist review", () => {
  for (const phrase of [
    "自愿采用",
    "不是认证标准",
    "不能替代法律分析、信息安全工程、隐私治理、雇佣义务或协商形成的 SLA",
    "由特定供应商提供的实现参考",
    "不是普遍要求",
  ]) expect(flat).toContain(phrase);
});

test("decision rights name each policy owner", () => {
  for (const phrase of [
    "服务负责人提出承诺",
    "测量负责人定义可复现指标",
    "产品和业务批准人",
    "信息安全和隐私负责人",
    "具名授权人接受剩余风险",
    "永久策略批准人",
  ]) expect(flat).toContain(phrase);
});

test("negative-path scenarios cover the complete operating surface", () => {
  for (const phrase of [
    "租户声明缺失",
    "契约版本未知",
    "指标流水线中断",
    "标签延迟",
    "重复预留",
    "重试绕过预算",
    "延迟成本",
    "合格回退不可用",
    "跨租户缓存命中",
    "跨租户检索结果",
    "证据存储故障",
    "影子运行与金丝雀决策",
  ]) expect(flat).toContain(phrase);
});

test("the release record carries every promise control and open risk", () => {
  for (const phrase of [
    "运营契约发布记录",
    "契约身份、版本、状态、生效时间、失效时间、负责人、批准人、范围、依赖和回滚目标",
    "合格总体",
    "错误预算与告警策略",
    "预算层级",
    "隔离配置",
    "不可变证据位置",
    "浏览器可见证据",
    "剩余风险和下次审查日期",
  ]) expect(flat).toContain(phrase);
});

test("operational reporting follows the declared contract", () => {
  for (const phrase of [
    "按已声明服务类别",
    "每个已接受任务的成本",
    "预留误差",
    "未归属成本",
    "事故时钟",
    "纠正措施核验",
    "噪声邻居影响",
    "例外持续时间",
    "保护低流量租户的隐私",
    "测量覆盖率不足",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion defines infrastructure as a maintained promise", () => {
  for (const phrase of [
    "并不能保证系统可靠、成本可控、安全或公平",
    "具体到可以测试",
    "具体到可以作出决定",
    "已声明的服务",
    "有边界的权限",
    "租户专属的隔离措施",
    "可见、可测试的流程",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite preserves interfaces and removes obsolete mechanisms", () => {
  for (const marker of [
    "#sec-operating-contracts",
    "fig-operating-contracts-control-plane",
    "fig-operating-incident-loop",
    "@sec-wiring-stack",
    "@sec-reliability",
    "@sec-human-interface-oversight",
    "@sec-data-engine",
    "::: {#further-reading}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "fig-operating-contracts-1",
    "fig-operating-contracts-risk",
    "wilson_lower",
    "data-family=\"exp-decay\"",
    "难点更多是组织性的，而不是数学性的",
    "它就只是文字",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese artifact contract matches the current English chapter", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(8);
  expect(chinese.match(/^\|\s*---/gm)?.length).toBe(3);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
});

test("both localized Graphviz figures parse and fit mobile", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(2);
  const graphviz = await loadGraphviz();
  for (const [, block] of blocks) {
    expect(block).toContain("rankdir=TB");
    const svg = renderDot(
      graphviz,
      block,
      new Map(),
      "practice/operating-contracts.html",
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
    currentHref: "practice/operating-contracts.html",
    chapterTitle: "运营契约：SLO、成本、事故与多租户",
    chapterNum: "93",
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
  expect(html).toContain("运营契约发布记录");
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
