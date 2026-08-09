import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/safety/04-runtime-safety.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/04-runtime-safety.qmd", import.meta.url),
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

test("Chapter 57 preserves the complete English runtime-safety contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "运行时安全：护栏与内容审核 {#sec-runtime-safety}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "五项工作，不是一个守卫模型",
    "从检测器分数到策略决定",
    "提示注入改变了威胁模型",
    "在每项实际效果前设置确定性闸门",
    "流式传输形成两道发布边界",
    "下层约束",
    "运行时安全的运行契约",
    "争议所在",
    "运行时安全作为外部控制",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```python$/gm)).toBeNull();
  expect(chapter.match(/^!\[/gm)).toBeNull();
  expect(chapter.match(/\.runnable/g)).toBeNull();
  expect(chapter.match(/^<figure /gm)).toBeNull();
  expect(chapter.match(/^\|.+\|$/gm)).toBeNull();
});

test("the opening defines a request-time enforcement contract", () => {
  for (const phrase of [
    "训练可以降低有害行为出现的概率",
    "已对齐模型自身的拒绝既有必要，却并不充分",
    "输入和输出必须分别筛查",
    "筛查只是答案的一部分",
    "策略条件分类器可以检测有害证据",
    "不能授权付款、隔离进程，也不能证明外部 API 做了什么",
    "运行时安全是请求处理时的契约",
    "检测证据、交由策略决定、让强制执行点落实决定",
    "遏制仍然发生的问题，并记录实际经过",
    "模型可以提出动作，只有可信代码可以授权并提交",
  ]) expect(flat).toContain(phrase);
});

test("five runtime jobs remain distinct", () => {
  for (const phrase of [
    "检测器提取信号",
    "策略决定结合这些信号",
    "策略执行点允许、阻止、改写、质询或延迟确切操作",
    "遏制措施在检测与策略同时漏过问题时限制损害",
    "证据把请求、决定、尝试产生的效果和观察结果关联起来",
    "分数不是决定",
    "决定不是强制执行",
    "请求被阻止并不能证明没有发生副作用",
  ]) expect(flat).toContain(phrase);
});

test("the localized control-path diagram preserves every enforcement stage", () => {
  for (const phrase of [
    'request [label="请求 + 来源"]',
    'detect [label="检测器\\n（分数与发现）"',
    'decide [label="带版本的策略\\n允许 / 审查 / 阻止"]',
    'model [label="模型提出\\n文本或工具调用"]',
    'enforce [label="可信强制执行\\n验证 / 授权 / 提交"',
    'result [label="显示或产生效果"]',
    'contain [label="遏制措施\\n沙箱 / 配额 / 出网"]',
    'receipt [label="决定 + 效果回执"]',
  ]) expect(chapter).toContain(phrase);
});

test("the localized control-path diagram reserves space for Chinese labels", () => {
  expect(chapter).toContain('nodesep=0.2');
  expect(chapter).toContain('fontname="PingFang SC"');
  expect(chapter).toContain('margin="0.08,0.06"');
  expect(chapter).toContain('width=1.4');
});

test("input and output checks keep their placement limits", () => {
  for (const phrase of [
    "输入审核可以在生成前阻止不允许的请求",
    "输出审核覆盖只有生成后才可见的情况",
    "两者都看不到所有相关事实",
    "检索文档可能在输入筛查后改变模型行为",
    "工具也可能在输出筛查后把看似无害的字符串变成不可逆效果",
    "检查的位置和范围与分类器本身同样重要",
  ]) expect(flat).toContain(phrase);
});

test("policy-conditioned moderation is configurable but bounded", () => {
  for (const phrase of [
    "学习危害类别，而不只是匹配关键词",
    "有用的配置能力，不是任意可编程性",
    "策略文字不能让不受支持的类别变得可靠",
    "带版本的策略包",
    "声明明确的模式、受支持类别、阈值和失效行为",
    "模式验证",
    "上线前离线评估",
    "分阶段发布和回滚",
    "策略提示在验证前是不受信任的配置",
  ]) expect(flat).toContain(phrase);
});

test("the moderation rule defines allow review block and abstention", () => {
  for (const phrase of [
    "内容 $x$",
    "$k$ 表示危害类别",
    "$s_k(x)$ 是检测器对该类别的分数",
    "策略版本 $v$",
    "较低阈值 $\\tau_{\\mathrm{allow},k}$",
    "较高阈值 $\\tau_{\\mathrm{block},k}$",
    "允许、审查或阻止",
    "明确的弃权路径",
    "不能把不确定案例藏进“允许”",
  ]) expect(flat).toContain(phrase);
});

test("calibration and error rates remain deployment-specific", () => {
  for (const phrase of [
    "估计分数并不会自动成为概率",
    "代表部署环境的流量",
    "假阴性会放行违规内容",
    "假阳性会阻止合规内容",
    "精确率取决于基准率",
    "按类别、语言和重要用户群体报告",
    "分布偏移、混淆和自适应攻击",
    "私有对抗测试集",
    "阈值变化也是策略变化",
  ]) expect(flat).toContain(phrase);
});

test("failure behavior is proportional and privileged effects fail closed", () => {
  for (const phrase of [
    "失效方式取决于实际效果",
    "低风险文本",
    "有界拒绝或降级响应",
    "特权工具产生效果之前",
    "所有必要检查返回有效决定之前，不得提交任何外部动作",
  ]) expect(flat).toContain(phrase);
});

test("prompt injection is decomposed into influence proposal and enforcement", () => {
  for (const phrase of [
    "直接提示注入",
    "间接提示注入",
    "可信指令与不受信任数据放进同一个上下文",
    "不受信任数据可以影响特权决定",
    "注入成功还不等于利用成功",
    "改变模型提出的动作",
    "请求有害操作",
    "被强制执行点接受",
    "多个彼此独立的位置切断攻击链",
  ]) expect(flat).toContain(phrase);
});

test("learned defenses and structural controls make different claims", () => {
  for (const phrase of [
    "指令层级",
    "聚光标记",
    "学习得到的防御",
    "不能建立安全边界",
    "控制流和数据流",
    "先规划后执行",
    "固定集合中选择动作",
    "上下文最小化",
    "双模型设计",
    "最小权限",
    "人工确认，而且确认必须绑定到不可逆动作的确切参数",
  ]) expect(flat).toContain(phrase);
});

test("every tool effect crosses six deterministic gates", () => {
  for (const phrase of [
    "带版本且有类型的工具模式",
    "拒绝未知字段、无效编码、含义不明的数字和越界值",
    "动作、资源和规范参数的规范化",
    "同一种表示用于授权、审批、执行和审计",
    "模型绝不能提供可信身份或策略事实",
    "验证每一个重定向目标",
    "只连接允许的地址范围",
    "主机名允许列表本身无法阻止重定向和 DNS 重绑定",
    "凭证代理",
    "不透明句柄",
    "预写意图",
    "幂等键",
    "效果回执",
  ]) expect(flat).toContain(phrase);
});

test("sandboxing and egress controls retain bounded guarantees", () => {
  for (const phrase of [
    "命名空间",
    "cgroups",
    "seccomp",
    "seccomp 过滤本身并不是沙箱",
    "容器不是虚拟机",
    "不带主机密钥",
    "不挂载可写的主机目录",
    "默认禁用网络出站",
    "沙箱限制后果，却不决定动作是否合适",
    "把监控、访问控制、事件处理和测试视为互补的风险处置手段",
  ]) expect(flat).toContain(phrase);
});

test("streaming keeps disclosure separate from executable commit", () => {
  for (const phrase of [
    "已经发送给客户端的文字就已经披露",
    "分块大小只是在延迟与未检查前缀上限之间取舍",
    "显示文本",
    "可执行输出",
    "工具调用、URL 获取、代码执行请求或交易",
    "完整结构化值经过缓冲、解析和授权",
    "正文可以流式传输，可执行输出必须缓冲",
    "两个明确的提交点",
  ]) expect(flat).toContain(phrase);
});

test("the operating record preserves every decision and effect field", () => {
  for (const field of [
    "request_id",
    "policy_revision",
    "input_provenance",
    "detector_revision_and_scores",
    "decision_and_thresholds",
    "tool_schema_revision",
    "authorization_decision_id",
    "canonical_action_and_parameters",
    "sandbox_profile",
    "egress_decision",
    "approval_binding",
    "effect_idempotency_key",
    "effect_receipt",
    "failure_mode",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "不存储原始凭证",
    "避免无谓保留敏感内容",
    "模式带版本",
    "一个相互关联的记录",
  ]) expect(flat).toContain(phrase);
});

test("the release suite exercises moderation and effect boundaries", () => {
  for (const phrase of [
    "守卫超时",
    "策略回滚",
    "拆分编码",
    "未知工具字段",
    "重定向到被阻止的主机",
    "DNS 重绑定",
    "审批重放",
    "重复投递同一效果",
    "跨租户资源引用",
    "沙箱逃逸探测",
    "不完整的工具调用绝不能执行",
    "红队结果补充这些契约，但不能取代它们",
  ]) expect(flat).toContain(phrase);
});

test("contested choices preserve learned-guard autonomy and availability limits", () => {
  for (const phrase of [
    "学习得到的守卫应当决定多少",
    "校准漂移、对抗样本和不透明错误",
    "通用智能体能否在不失去有用自主性的前提下抵抗间接注入",
    "产品特定的权衡",
    "安全失效是否总应关闭系统",
    "金钱转移、秘密访问和外部写入",
    "低风险对话",
    "失效方式必须写进带版本的策略和威胁模型",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps detector policy enforcement containment and evidence separate", () => {
  for (const phrase of [
    "不要求相信某一个守卫模型牢不可破",
    "检测器负责估计",
    "策略负责决定",
    "强制执行仲裁每一项实际效果",
    "遏制措施限制漏检的后果",
    "回执让结果可以测试",
    "训练塑造模型倾向于提出什么",
    "运行时架构决定这些动作获准披露或执行什么",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete narrative artifacts and unsupported claims", () => {
  for (const phrase of [
    "一个已对齐的模型为何仍不够",
    "一道护栏的形状",
    "演化：从黑名单到把策略作为输入",
    "被注入的智能体",
    "经得起越狱的分类器",
    "/figures/runtime-safety-1.svg",
    "```python",
    "@gls-jailbreak",
    "@gls-lethal-trifecta",
    "77% 的任务",
    "86% 压到 4.4%",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
