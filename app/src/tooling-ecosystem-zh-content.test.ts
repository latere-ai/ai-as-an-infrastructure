import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/03-tooling-ecosystem.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/03-tooling-ecosystem.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 75 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 工具生态 \{#sec-tooling-ecosystem\}/);
  expect(headings(chinese)).toEqual([
    ["##", "先分平面，再看产品"],
    ["##", "让兼容性成为可审查的主张"],
    ["##", "生态围绕不同边界逐步形成"],
    ["##", "训练与服务暴露出可移植性的边界"],
    ["##", "智能体主机不是协议"],
    ["###", "MCP：从应用主机到能力服务器"],
    ["###", "A2A：从客户端到独立智能体"],
    ["##", "安全属于完整的组合路径"],
    ["##", "约束如何向上传导"],
    ["##", "建立跨越各条边的证据平面"],
    ["##", "先验证可移植性，再依赖它"],
    ["##", "经过隔离与准入采用新工具"],
    ["##", "争议所在"],
    ["##", "从工具走向经济"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the opening defines a toolchain as versioned contracts across three planes", () => {
  for (const phrase of [
    "工具栈是一组带版本的契约，不是框架清单",
    "经过验证的模型制品包",
    "训练器",
    "转换工具",
    "服务运行时",
    "模型网关",
    "智能体主机",
    "能力服务器",
    "沙箱",
    "策略引擎",
    "遥测",
    "显式兼容性",
    "故障隔离",
    "可替换性",
    "实际运行产生的证据",
    "执行平面",
    "控制平面",
    "证据平面",
  ]) expect(flat).toContain(phrase);
});

test("the layer table preserves every boundary state and characteristic failure", () => {
  for (const phrase of [
    "| 训练框架 |",
    "| 服务运行时 |",
    "| 模型网关 |",
    "| 智能体主机 |",
    "| 能力服务器 |",
    "| 对等智能体 |",
    "边界契约",
    "必须保留的状态",
    "典型故障",
    "重复或未获授权的副作用",
    "丢失取消请求",
    "重复交付",
  ]) expect(flat).toContain(phrase);
});

test("component and edge contracts make compatibility reviewable", () => {
  for (const marker of [
    "C_i",
    "V_i",
    "I_i",
    "O_i",
    "A_i",
    "S_i",
    "F_i",
    "E_i",
    "E_T",
    "\\operatorname{accept}(T,w)",
    "\\operatorname{compatible}(C_i,C_j,w)",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "支持的版本与扩展集合",
    "接受的输入",
    "输出及其语义",
    "身份、同意与预算",
    "持久化、重试与取消",
    "故障语义、超时与恢复行为",
    "日志、追踪、指标与回执",
    "边兼容性",
    "容器摘要很有用，却不完整",
  ]) expect(flat).toContain(phrase);
});

test("training and serving history stays scoped to the evaluated boundaries", () => {
  for (const phrase of [
    "Megatron-LM",
    "张量并行训练",
    "ZeRO",
    "普通数据并行会复制的状态",
    "SOSP 2023",
    "PagedAttention",
    "完整的受评测系统",
    "ReAct",
    "模型、动作与观察",
    "MCP",
    "A2A",
    "并不构成一条成熟度阶梯",
  ]) expect(flat).toContain(phrase);
});

test("training and serving portability distinguishes formats from behavior", () => {
  for (const phrase of [
    "加载时重新分片",
    "不保证状态字典在不同 PyTorch 版本之间向后兼容",
    "经过测试的恢复流程",
    "CUDA 计算能力",
    "ONNX Runtime",
    "TorchScript",
    "KServe V2 推理协议",
    "锁定的语料库",
    "尾延迟",
    "有用吞吐量",
    "工作负载相关",
  ]) expect(flat).toContain(phrase);
});

test("the agent host tool server and peer agent remain different roles", () => {
  for (const phrase of [
    "智能体主机",
    "工具服务器",
    "有边界的操作",
    "对等智能体",
    "独立的任务状态",
    "委托",
    "问责边界",
    "MCP 客户端",
    "A2A 客户端",
    "发现与消息交换并不提供信任或授权",
  ]) expect(flat).toContain(phrase);
});

test("MCP retains its pinned protocol and security boundaries", () => {
  for (const phrase of [
    "主机、客户端与服务器协议",
    "2026-07-28",
    "JSON-RPC",
    "无状态",
    "逐请求协商能力",
    "工具、资源与提示",
    "JSON Schema 2020-12",
    "自报元数据",
    "规范描述符摘要",
    "发现工具不等于授予权限",
    "最小权限",
    "明确同意",
    "不可信",
  ]) expect(flat).toContain(phrase);
});

test("A2A v1.0 retains task lifecycle delivery and trust limits", () => {
  for (const phrase of [
    "A2A v1.0",
    "Agent Card",
    "Message",
    "Task",
    "Artifacts",
    "A2A-Version",
    "终态",
    "completed",
    "failed",
    "canceled",
    "rejected",
    "不能证明远端智能体正确、安全、诚实",
    "至少一次推送交付",
    "去重",
  ]) expect(flat).toContain(phrase);
});

test("security controls and adversarial evidence remain scoped at every hop", () => {
  for (const phrase of [
    "发现不等于授权",
    "受众绑定的短期凭据",
    "禁止令牌透传",
    "模型可见的上下文",
    "允许列表控制出站目的地",
    "精确的工具身份与描述符摘要",
    "执行时重新检查策略",
    "1,348 个恶意描述符案例",
    "353 个真实工具",
    "45 组真实 MCP 服务器工具集",
    "20 种智能体设置",
    "并不能证明 45 台已部署服务器遭到入侵",
    "AgentDojo",
    "间接提示注入",
  ]) expect(flat).toContain(phrase);
});

test("the evidence plane records reconstructable cross-layer facts", () => {
  for (const phrase of [
    "一个追踪标识",
    "traceparent",
    "tracestate",
    "不是身份凭据",
    "行为者与主体身份",
    "已解析的模型制品包",
    "协议版本",
    "模式摘要",
    "授权决定",
    "幂等键",
    "取消请求与确认",
    "返回制品摘要",
    "不能把「已经启用日志」等同于完整审计轨迹",
  ]) expect(flat).toContain(phrase);
});

test("portability covers four layers and an exact compatibility matrix", () => {
  for (const phrase of [
    "线协议兼容性",
    "语义兼容性",
    "运行兼容性",
    "治理兼容性",
    "一致性测试通常只能证明第一层的一部分",
    "负向授权测试",
    "故障注入",
    "静默回退",
    "退出测试",
    "切换成本",
  ]) expect(flat).toContain(phrase);
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(enCell).not.toBeNull();
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);
  for (const output of [
    "candidate-a: compatible (6 contracts)",
    "candidate-schema-drift: rejected (tool.schema: expected calendar.v3, got calendar.v4)",
    "candidate-no-cancel: rejected (task.cancel: expected required, got missing)",
  ]) expect(chinese).toContain(output);
});

test("the eight-step adoption procedure fails closed before promotion", () => {
  for (const phrase of [
    "盘点受影响的边",
    "固定候选项",
    "建立兼容性矩阵",
    "更新威胁模型",
    "执行一致性测试与契约测试",
    "执行工作负载评测与对抗评测",
    "演练退出与回滚",
    "准入已锁定的系统元组",
    "渐进式部署",
    "出现偏差时撤销或回滚",
  ]) expect(flat).toContain(phrase);
  const adoption = chinese.match(
    /## 经过隔离与准入采用新工具\n([\s\S]*?)\n```\{dot\}/,
  );
  expect(adoption).not.toBeNull();
  expect(adoption![1].match(/^\d+\. /gm)?.length).toBe(8);
});

test("the contested boundary and economics handoff preserve the systems argument", () => {
  for (const phrase of [
    "集成式工具栈",
    "模块化工具栈",
    "协议兼容并不意味着语义兼容",
    "一个供应商也不意味着只有一个一致的故障域",
    "兼容性矩阵",
    "退出测试",
    "切换成本",
    "工程人力",
    "托管服务",
    "加速器",
    "存储",
    "网络路径",
    "只有测试与策略才能让组合系统获得准入",
  ]) expect(flat).toContain(phrase);
  for (const ref of [
    "@sec-model-artifacts",
    "@sec-security-authorization",
    "@sec-eval-practice",
    "@sec-economics",
    "@sec-wiring-stack",
    "@sec-deployment-lifecycle",
  ]) expect(chinese).toContain(ref);
});

test("the Chinese chapter uses only current artifacts and removes the legacy product pitch", () => {
  for (const figure of [
    "fig-tooling-planes",
    "fig-tooling-protocols",
    "fig-tooling-adoption",
  ]) expect(chinese).toContain(figure);
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(4);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toMatch(/!\[[^\]]*\]\([^)]*\)/);
  expect(chinese).not.toContain("```{=html}");
  for (const stale of [
    "fig-tooling-control-shift",
    "fig-tooling-orchestration-pipeline",
    "fig-tooling-composition",
    "fig-tooling-ecosystem-1",
    "fig-tooling-ecosystem-2",
    "Latere Lux",
    "Latere Cella",
    "Latere Topos",
    "Latere Wallfacer",
    "80% 改进已有",
    "调用方变成智能体后",
  ]) expect(chinese).not.toContain(stale);
  expect(chinese).not.toContain("—");
});

test("every localized Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese chapter renders through the economics handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/tooling-ecosystem.html",
    chapterTitle: "工具生态",
    chapterNum: "75",
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
  expect(html).toContain("只有测试与策略才能让组合系统获得准入");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
