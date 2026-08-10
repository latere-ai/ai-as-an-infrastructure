import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/08-wiring-a-2026-stack.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/08-wiring-a-2026-stack.qmd", import.meta.url),
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

test("Chinese Chapter 88 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 集成技术栈 {#sec-wiring-stack}",
    "## 固定集成发布",
    "## 分离三个平面",
    "## 明确兼容性",
    "## 参考架构",
    "## 定义模型操作状态机",
    "## 规范错误而不掩盖原因",
    "## 限制重试与过载",
    "## 分离身份、凭据与操作",
    "### 工具与 MCP",
    "### 检索与证据",
    "## 把遥测当作证据，而不是权限",
    "## 核算整个合格任务",
    "## 测试系统接缝，而不只是正常路径",
    "## 把切换视为协议",
    "## 发布生命周期",
    "## 约束如何传导",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines one integration release", () => {
  for (const phrase of [
    "兼容的产品还不等于一个系统",
    "集成发布",
    "系统指纹",
    "边界契约",
    "负责人",
    "验收证据",
    "回滚触发条件",
    "模型名称本身无法标识生成某个答案的系统",
  ]) expect(flat).toContain(phrase);
});

test("the system fingerprint covers every behavior-bearing component", () => {
  for (const phrase of [
    "模型修订版本",
    "提示词修订版本",
    "检索快照",
    "工具 Schema",
    "策略修订版本",
    "路由配置",
    "遥测 Schema",
    "可执行制品摘要",
  ]) expect(flat).toContain(phrase);
});

test("the manifest and every boundary have complete contracts", () => {
  for (const phrase of [
    "系统清单",
    "生产方",
    "消费方",
    "协议版本",
    "数据类别",
    "权限",
    "截止时间",
    "重试负责人",
    "幂等范围",
    "错误映射",
    "迁移状态",
    "回滚修订版本",
  ]) expect(flat).toContain(phrase);
});

test("data control and management planes remain separate", () => {
  for (const phrase of ["数据平面", "控制平面", "管理平面", "不是通用枢纽"])
    expect(flat).toContain(phrase);
  expect(flat).toContain("契约和权限仍然必须彼此分离");
});

test("capability translation exposes every semantic loss", () => {
  for (const phrase of [
    "能力说明",
    "原生支持",
    "由适配器模拟",
    "有损",
    "不支持",
    "明确接受",
    "准入阶段拒绝",
    "保留、明确降级或拒绝",
  ]) expect(flat).toContain(phrase);
});

test("routing applies hard constraints before ranking", () => {
  for (const phrase of [
    "先按硬性约束筛选",
    "数据驻留",
    "不可变的提供商",
    "适配器修订版本",
    "路由策略修订版本",
    "粘性分配",
  ]) expect(flat).toContain(phrase);
});

test("the reference architecture separates model tools retrieval and evidence", () => {
  for (const phrase of [
    "应用是调用方",
    "策略层决定是否接纳请求",
    "适配器",
    "工具操作",
    "先完成授权，再交给执行器",
    "检索服务返回带标识的证据",
    "遥测观察每项决策，但不授予任何权限",
  ]) expect(flat).toContain(phrase);
});

test("streaming operations follow an explicit finite state machine", () => {
  for (const phrase of [
    "逻辑操作",
    "实际尝试",
    "带类型事件流",
    "累积流式工具参数片段",
    "完整参数",
    "验证",
    "授权",
    "只执行一次",
    "不完整的工具参数绝不能执行",
    "有限次尝试",
    "有限的截止时间",
  ]) expect(flat).toContain(phrase);
});

test("structured output and errors keep distinct machine semantics", () => {
  for (const phrase of [
    "完整文档",
    "最终验证",
    "无效结果",
    "RFC 9457",
    "application/problem+json",
    "问题类型",
    "上游请求 ID",
    "尝试次数",
    "是否可重试",
    "不得解析面向人的详细说明来决定是否重试",
  ]) expect(flat).toContain(phrase);
});

test("retry amplification has one owner and bounded resources", () => {
  for (const marker of ["A_{\\max}", "\\prod_{\\ell=1}^{L}", "r_\\ell"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "重试放大",
    "一个重试负责人",
    "总尝试次数上限",
    "剩余截止时间",
    "有界队列",
    "背压",
    "重试风暴",
  ]) expect(flat).toContain(phrase);
});

test("idempotency fallback and side effects remain explicit", () => {
  for (const phrase of [
    "幂等键是一项应用契约",
    "不能保证恰好执行一次",
    "操作级幂等键",
    "操作回执",
    "回退会改变系统身份",
    "预先验证",
    "兼容类别",
    "已经向调用方输出内容",
    "副作用结果仍不明确",
  ]) expect(flat).toContain(phrase);
});

test("identity credentials and authority are not conflated", () => {
  for (const phrase of [
    "工作负载身份",
    "委托用户令牌",
    "下游提供商密钥",
    "短期工作负载身份",
    "OAuth 令牌交换",
    "受众",
    "作用域",
    "租户",
    "有效期",
    "虚拟密钥只是",
    "原始提供商密钥",
  ]) expect(flat).toContain(phrase);
});

test("MCP discovery and sandboxing do not grant authority", () => {
  for (const phrase of [
    "发现不等于授权",
    "工具注解是不受信任的元数据",
    "逐次调用授权",
    "影响类别",
    "意图记录",
    "最小权限凭据",
    "模糊超时",
    "取消不等于回滚",
    "沙箱不是授权机制",
    "出站白名单",
    "资源白名单",
    "每一次重定向",
  ]) expect(flat).toContain(phrase);
});

test("retrieval and telemetry preserve evidence boundaries", () => {
  for (const phrase of [
    "先授权，再检索",
    "证据 ID",
    "语料修订版本",
    "索引修订版本",
    "租户边界",
    "W3C Trace Context",
    "不是权限",
    "Baggage",
    "缺失遥测数据",
    "部分证据",
  ]) expect(flat).toContain(phrase);
});

test("accepted-task accounting is complete and self-contained", () => {
  for (const marker of [
    "C_q",
    "\\mathcal{A}_q",
    "\\mathcal{M}_a",
    "u_{a,m}",
    "C_{\\mathrm{infra}}",
    "C_{\\mathrm{human}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "整个合格任务",
    "每次实际尝试",
    "检索",
    "工具执行",
    "裁判",
    "人工复核",
    "不能把并行子任务的耗时相加",
    "互不重叠的计费项",
  ]) expect(flat).toContain(phrase);
});

test("the accepted-task identity uses mobile-safe display rows", () => {
  expect(chinese).toContain(
    "u_{a,m}\\\\\n&\\quad {}\\times p_m(v_a,\\rho_a,t_a,k_a)\\\\",
  );
});

test("the cost crossover remains editable runnable and bounded", () => {
  expect(chinese).toContain('<div class="viz" data-viz="cost-crossover"');
  for (const phrase of [
    "每月使用的 GPU 小时",
    "月成本（美元）",
    "按量付费",
    "固定月费",
    "示例，不是建议",
    "当前报价",
  ]) expect(flat).toContain(phrase);
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("crossover_utilization"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|matplotlib/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("illustrative crossover = 50%");
});

test("conformance fixtures exercise every seam", () => {
  for (const phrase of [
    "单次请求",
    "流中断",
    "工具参数",
    "结构化输出",
    "Retry-After",
    "过载",
    "回退",
    "租户隔离",
    "恶意工具输出",
    "DNS 重绑定",
    "文件系统逃逸",
  ]) expect(flat).toContain(phrase);
});

test("the supply chain and cutover remain reversible", () => {
  for (const phrase of [
    "软件物料清单",
    "构建来源证明",
    "摘要值",
    "完整路由表",
    "经过签名的系统清单",
    "契约测试",
    "影子模式",
    "不产生副作用",
    "粘性金丝雀",
    "以原子方式发布",
    "上一已知正常版本",
    "先测试回滚",
  ]) expect(flat).toContain(phrase);
});

test("the failure matrix and lifecycle end in an integration release record", () => {
  for (const phrase of [
    "能力悄然丢失",
    "重试风暴",
    "凭据泄漏",
    "跨租户访问",
    "工具只执行了一部分",
    "配置漂移",
    "遥测缺失",
    "集成发布记录",
    "已接受的降级",
    "重新验证触发条件",
  ]) expect(flat).toContain(phrase);
});

test("constraints and contested topology stay explicit", () => {
  for (const phrase of [
    "上层无法恢复下层边界悄然删除的语义",
    "提供商的限制会约束适配器",
    "组装后的系统指纹",
    "一种特定的产品拓扑",
    "明确呈现语义损失",
    "最小权限",
    "有界故障",
    "端到端证据",
    "经过测试的回滚",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the dated product catalog and universal defaults", () => {
  for (const phrase of [
    "截至 2026 年年中",
    "主旨：三份契约与一条纪律",
    "网关：集中控制点",
    "选一套参考栈",
    "LiteLLM",
    "OpenRouter",
    "Portkey",
    "agentgateway",
    "Cloudflare AI Gateway",
    "Bifrost",
    "明智的默认",
    "虚拟密钥托管",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(4);
  expect(chinese.match(/^\| ---/gm)?.length).toBe(3);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/<figure id=/g)?.length).toBe(1);
  expect(chinese.match(/data-viz="cost-crossover"/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
});

test("all localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const [index, block] of blocks.entries()) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/wiring-a-2026-stack.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
    if (index === 0) expect(widthPt).toBeGreaterThanOrEqual(120);
  }
  for (const label of ["调用方", "策略", "适配器", "提供商"])
    expect(svgs[1], `reference architecture should show ${label}`).toContain(`>${label}<`);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/wiring-a-2026-stack.html",
    chapterTitle: "集成技术栈",
    chapterNum: "88",
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
  expect(html).toContain("最终产物是一份集成发布记录");
  expect(renderedHeadings.some(({ text }) => text.includes("A_{"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
