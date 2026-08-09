import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/safety/03-security-authorization.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/03-security-authorization.qmd", import.meta.url),
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

test("Chapter 56 preserves the complete English security-and-authorization contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "安全与授权 {#sec-security-authorization}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "概念验证，而非普遍规律",
    "先定义授权决定，再选择令牌",
    "从请求到实际效果",
    "委派不能扩大权限",
    "MCP 授权只负责更窄的范围",
    "让凭证远离模型，再约束其使用",
    "租户隔离是另一层强制措施",
    "预算也是授权义务",
    "运行契约",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "有效权限是多项授权的交集",
    "把审批绑定到确切效果",
    "令牌属性不能互相替代",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```\{=html\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
  expect(chapter.match(/^<figure /gm)?.length).toBe(2);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(8);
  expect(chapter.match(/^```python$/gm)).toBeNull();
  expect(chapter.match(/^!\[/gm)).toBeNull();
  expect(chapter.match(/\.runnable/g)).toBeNull();
});

test("the opening separates proposal authentication authorization approval and audit", () => {
  for (const phrase of [
    "智能体可以提出动作",
    "受信任的强制执行路径决定这个动作能否产生实际效果",
    "身份验证确认调用方的声明",
    "授权决定特定主体能否在当前上下文中",
    "凭证承载声明或授权，本身并不是策略",
    "审批是授权的输入",
    "审计是决定作出后的证据",
    "藏在不受信任内容中的指令",
    "不能创造强制执行点没有授予的权限",
    "任务完整性与授权是互补控制",
  ]) expect(flat).toContain(phrase);
});

test("the GitHub MCP attack remains a scoped proof of concept", () => {
  for (const phrase of [
    "2025 年 5 月",
    "Claude Desktop、GitHub 官方 MCP 服务器和个人访问令牌",
    "恶意公开议题",
    "读取私有仓库",
    "写入公开拉取请求",
    "攻击成立的前提",
    "没有证明令牌会持续整个会话",
    "并不是 MCP 的普遍性质",
    "纵深防御",
  ]) expect(flat).toContain(phrase);
});

test("the blast-radius scenario is localized and bounded as a toy", () => {
  for (const phrase of [
    'data-viz="blast-radius"',
    'data-lang="zh"',
    "18 个资源",
    "范围数量和有效期都是用户设定的假设",
    "不是测量结果",
    "实际可达范围还取决于动作、资源、网络、审批和运行时策略",
  ]) expect(flat).toContain(phrase);
});

test("the authorization query defines every term and a fail-closed outcome", () => {
  for (const phrase of [
    "主体 $s$、动作 $a$、资源 $r$、上下文 $c$",
    "策略版本 $v$",
    "允许、拒绝或质询",
    "精确的操作",
    "精确的目标",
    "租户、任务、时间、数据分类和预算状态",
    "缺失或未知的输入默认导致拒绝",
  ]) expect(flat).toContain(phrase);
});

test("subject claims preserve every identity and its provenance", () => {
  for (const phrase of [
    "用户身份",
    "智能体或会话版本",
    "执行进程的工作负载身份",
    "租户绑定和委派链",
    "每项已验证声明的来源",
    "不能证明用户意图或权限",
    "不能来自不受信任的请求头",
  ]) expect(flat).toContain(phrase);
});

test("effective authority intersects five independently enforced grants", () => {
  for (const phrase of [
    "同一个动作、资源与上下文元组全集",
    "用户授权",
    "智能体授权",
    "工作负载授权",
    "资源策略",
    "运行时约束",
    "交集只能缩小权限",
    "策略决策点",
    "策略执行点",
    "身份验证和令牌签发只提供可信输入",
  ]) expect(flat).toContain(phrase);
});

test("the request-to-effect path canonicalizes approves executes and records", () => {
  for (const phrase of [
    "完全仲裁",
    "每一项外部效果",
    "策略评估前完成规范化",
    "规范动作",
    "规范资源",
    "目标地址、方法、参数、Unicode、默认值、单位和重定向策略",
    "检查时与使用时",
    "执行点重新计算哈希",
    "高影响路径默认关闭",
  ]) expect(flat).toContain(phrase);
});

test("the localized request-to-effect diagram keeps all trusted stages", () => {
  for (const phrase of [
    'a [label="验证声明"]',
    'n [label="规范化请求"]',
    'd [label="策略决策点作出决定"]',
    'h [label="必要时进行\\n精确审批"]',
    'c [label="附加窄权限凭证"]',
    'e [label="策略执行点执行一次"]',
    'r [label="效果回执"]',
  ]) expect(chapter).toContain(phrase);
});

test("the localized stepper exposes exact approval and enforcement semantics", () => {
  for (const phrase of [
    'data-viz="stepper"',
    'data-lang="zh"',
    'data-chip="声明"',
    'data-chip="请求"',
    'data-chip="决定"',
    'data-chip="审批"',
    'data-chip="执行"',
    "一次性质询",
    "请求哈希、来源、随机数和有效期",
    "没有把智能体的自然语言摘要当作动作本身",
  ]) expect(flat).toContain(phrase);
});

test("approval is bound to the authoritative effect rather than a preview", () => {
  for (const phrase of [
    "精确的动作、资源和规范参数",
    "目标地址和敏感数据流向",
    "一次性质询",
    "不能用于参数变化、新的重定向或后续操作",
    "误导性的预览",
    "独立的强制执行路径",
  ]) expect(flat).toContain(phrase);
});

test("delegation attenuates inherited authority without forwarding service authority", () => {
  for (const phrase of [
    "子授权应当是父授权的子集",
    "只适用于继承而来的委派权限",
    "受众、租户、用途、有效期、审批和数据流约束",
    "服务自身的独立权限",
    "不能冒充用户委派的权限继续转发",
    "保留行动方和主体",
    "令牌交换本身不会保留用户策略",
  ]) expect(flat).toContain(phrase);
});

test("the token table keeps six controls and their non-equivalent guarantees", () => {
  for (const phrase of [
    "窄范围",
    "资源指示符",
    "发送方约束令牌",
    "短有效期",
    "令牌内省或引用令牌",
    "撤销列表或推送状态",
    "持有者令牌",
    "持有证明",
    "不能立即撤销",
    "最坏情况下的撤销延迟",
  ]) expect(flat).toContain(phrase);
});

test("MCP authorization remains optional scoped and separate from tool policy", () => {
  for (const phrase of [
    "MCP 实现可以不支持授权",
    "基于 HTTP 的受保护服务器",
    "OAuth 受保护资源元数据",
    "规范服务器 URI",
    "必须验证令牌确实签发给自己",
    "无法阻止提示注入",
    "不能判断某项工具动作是否合适",
    "策略执行点",
  ]) expect(flat).toContain(phrase);
});

test("credential custody remains separate from API-level authorization", () => {
  for (const phrase of [
    "可复用密钥不应出现在模型上下文、生成代码、日志或沙箱环境中",
    "凭证代理",
    "不透明句柄",
    "目标地址允许列表",
    "主机限制不等于 API 级授权",
    "静态密钥",
    "TLS 终止",
    "不能证明获准请求就是良性的",
  ]) expect(flat).toContain(phrase);
});

test("tenant isolation is defense in depth with explicit negative tests", () => {
  for (const phrase of [
    "租户是已验证主体和资源的一部分",
    "行级策略",
    "命名空间隔离",
    "物理隔离",
    "纵深防御",
    "不能取代授权",
    "跨租户反向测试",
    "伪造租户请求头",
  ]) expect(flat).toContain(phrase);
});

test("budget enforcement reserves one shared upper bound before spending", () => {
  for (const phrase of [
    "提供商收费后的警告只是证据，不是强制措施",
    "原子地预留",
    "保守成本上界",
    "已结算用量",
    "尚未结算的预留",
    "同一主体、周期、货币或单位",
    "并行调用必须争用同一份预留状态",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract links request decision enforcement and effect", () => {
  for (const field of [
    "authorization_request_id",
    "subject_claims_and_provenance",
    "agent_model_tool_revisions",
    "delegation_chain",
    "action_resource_and_canonical_parameters",
    "tenant_and_data_classification",
    "policy_bundle_revision",
    "decision_obligations_and_reason",
    "approval_challenge_and_binding",
    "credential_audience_scope_sender_and_expiry",
    "enforcement_point_and_result",
    "budget_reservation_and_reconciliation",
    "effect_idempotency_key",
    "revocation_and_failure_mode",
    "audit_evidence_and_retention",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "决定记录不能证明外部效果已经发生",
    "预写意图",
    "智能体无权写入的位置",
    "效果回执",
    "成功、失败或未知",
    "超时后无法确定外部操作是否完成",
    "不仅要测试正常路径，还要测试拒绝路径",
  ]) expect(flat).toContain(phrase);
});

test("contested boundaries and the runtime handoff remain explicit", () => {
  for (const phrase of [
    "集中式策略决策点",
    "本地决策",
    "独立的生命周期、策略和归因",
    "反复审批或不透明预览",
    "完全仲裁和可测试的失效行为",
    "强制执行路径能够看到真实请求，而且无法绕过",
    "隔离生成代码",
    "保护凭证代理中的凭证和审计记录",
    "授权给出必须执行的精确边界",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete architecture and synthetic evidence", () => {
  for (const phrase of [
    "带着某人的授权在世界里行动",
    "等于一次入侵",
    "那次入侵如何界定问题",
    "约束授权的两个底座",
    "三重身份，而非一个层级",
    "声明与执行",
    "从宽泛走向短暂",
    "它在哪里付出代价",
    "回答那个动词的组件",
    "隔离层级",
    "闭合回路",
    ":::: {.runnable}",
    "```python",
    "/figures/security-authorization-1.svg",
    "@fig-security-ambient-fanout",
    "@fig-security-three-identities",
    "@fig-security-declares-enforces",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
