import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/05-the-compute-frontier.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/05-the-compute-frontier.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function prose(source: string): string {
  return source.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "");
}

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [
    ...prose(source).matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm")),
  ].map((match) => match[1]);
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
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

function dotLabels(source: string): string[] {
  return [...source.matchAll(/^\/\/\| label: (.+)$/gm)].map((match) => match[1]);
}

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

function runnablePython(source: string): string[] {
  return [...source.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)].map(
    (match) => match[1],
  );
}

test("Chapter 66 preserves the complete English compute-frontier contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "算力前沿：带宽，而非 FLOPs {#sec-compute-frontier}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "前沿是一组约束，不是单一指标",
    "封装改变了内存边界",
    "纵向扩展域可以跨越多个节点",
    "架构选择只会移动约束，不会消除约束",
    "预填充与解码是工作阶段，不是固定的硬件类别",
    "每条破局路径都只改变一个明确的约束项",
    "如何比较前沿系统",
    "约束如何向上传导",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-compute-frontier-bounds",
    "fig-compute-frontier-package",
    "fig-compute-frontier-domain",
    "fig-compute-frontier-escape-map",
  ]);
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-tip\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-important\}$/gm)?.length).toBe(1);
});

test("the opening scopes the bandwidth thesis to a measured workload boundary", () => {
  for (const phrase of [
    "把这些概念变成一套定位系统极限的方法",
    "稀缺资源往往是字节搬运能力，而不是算术能力",
    "必须先说清工作负载、内存边界，以及跨过该边界的实测流量",
    "逐词元推理却可能等待权重、KV 缓存或集合通信",
    "“受带宽限制”是一项诊断结论",
    "移动了一道边界、改变了跨越它的成本",
  ]) expect(flat).toContain(phrase);
});

test("the vector bound names every measured term and its limits", () => {
  for (const phrase of [
    "$F$ 是有效算术工作量",
    "$P_{\\text{eff}}$ 是针对具体工作负载的有效算术速率",
    "$Q_{\\text{HBM}}$ 是处理器与 HBM 之间的流量",
    "$B_{\\text{HBM}}$ 是该边界上的可持续带宽",
    "$Q_{\\text{up}}$ 与 $B_{\\text{up}}$",
    "$Q_{\\text{out}}$ 与 $B_{\\text{out}}$",
    "最大的那一项指出第一个优化目标",
    "不是延迟预测器",
    "独立传输与计算可以完全重叠",
    "无法重叠的阶段可能需要相加，而不是取最大值",
    "规格表峰值不能替代",
  ]) expect(flat).toContain(phrase);
});

test("precision changes help only when they move the binding term", () => {
  for (const phrase of [
    "降低精度并不必然带来加速",
    "减少主导流量，或提高主导算术速率",
    "额外的格式转换、填充、元数据",
    "没有变化的 KV 缓存路径",
  ]) expect(flat).toContain(phrase);
});

test("the package section distinguishes every physical layer", () => {
  for (const phrase of [
    "光刻设备一次曝光的面积受掩模版视场限制",
    "把逻辑拆成多个小芯片可以提高良率与复用率",
    "也会增加裸片间链路、封装工作与新的故障面",
    "中介层为计算小芯片与 HBM 堆栈提供高密度布线",
    "封装基板把整个组件连接到供电与板级信号",
    "这些是不同的物理层，不能混为一谈",
    "把计算小芯片与 HBM 放在同一块硅中介层上",
    "不能据此把供应商路线图外推成未来系统的精确容量",
  ]) expect(flat).toContain(phrase);
});

test("HBM capacity bandwidth traffic and energy remain separate quantities", () => {
  for (const phrase of [
    "内存容量",
    "可持续带宽",
    "流量体积",
    "每比特能耗",
    "2,048 位接口",
    "功能更强的基底裸片",
    "接口宽度本身不能说明实际交付的带宽、容量、良率、功耗或应用吞吐量",
    "有效算术速率增长快于可持续 HBM 带宽",
    "达到计算受限所需的算术强度就会提高",
    "有足够复用的内核仍可受算力限制",
  ]) expect(flat).toContain(phrase);
});

test("scale-up and scale-out remain distinct operational domains", () => {
  for (const phrase of [
    "纵向扩展域",
    "横向扩展网络",
    "改变集合通信延迟、对分带宽、路由、拥塞与故障代价",
    "72 块 GPU 组成的 NVLink 域",
    "协议边界是 NVLink 域，而不是机柜",
    "并不会让 72 块 GPU 变成一台设备",
    "独立内存、进程、地址空间、逻辑拓扑与同步",
    "多节点故障域",
  ]) expect(flat).toContain(phrase);
});

test("parallel placement follows measured traffic rather than acronyms", () => {
  for (const phrase of [
    "张量并行组通常频繁执行全归约",
    "专家并行组交换按路由分发的词元数据",
    "流水线并行阶段发送激活值",
    "数据并行副本同步梯度或参数",
    "消息大小、频率、重叠程度、集合通信算法、模型形状与争用",
    "测量每条边",
    "映射到逻辑拓扑",
    "验证端到端时间",
  ]) expect(flat).toContain(phrase);
});

test("network claims separate specifications implementations and optical choices", () => {
  for (const phrase of [
    "开放规范不等于已经可用的实现",
    "每通道 200 Gb/s",
    "最多 1,024 个加速器",
    "不能证明规范描述的交换机、线缆、软件栈或大规模部署都已可用",
    "共封装光学改变的是电光转换发生的位置",
    "可靠性、激光器位置、测试、维修与可维护性",
    "光路交换是另一种思路",
    "TPU v4",
    "Opus",
    "都不会让通信变成零成本",
  ]) expect(flat).toContain(phrase);
});

test("architecture comparisons move bounds and carry evidence status", () => {
  for (const phrase of [
    "改变上面下界中的哪一项，又把什么成本暴露到别处",
    "传统 HBM 加速器",
    "定制加速器",
    "晶圆级集成选择了另一种局部性位置",
    "“没有 HBM”只移除了一道明确的边界",
    "可用系统",
    "已发布产品",
    "研究原型",
    "开放规范",
    "截至 2026 年 8 月 7 日",
    "这些标签会变化，引用的证据也应随之更新",
  ]) expect(flat).toContain(phrase);
});

test("prefill and decode stay conditional phases with a transfer boundary", () => {
  for (const phrase of [
    "预填充会沿提示词序列并行处理",
    "解码通常一次推进一个或少数几个位置",
    "批次大小、序列长度、模型架构、量化、张量形状、内核融合、缓存布局与并行放置",
    "都可能让任一阶段跨越不同约束边界",
    "把两个阶段拆到不同设备池",
    "KV 缓存状态必须传输或允许远程访问",
    "节省的计算或内存时间超过传输、排队与利用不足的成本",
  ]) expect(flat).toContain(phrase);
});

test("escape routes name the term they change and the cost they create", () => {
  for (const phrase of [
    "不存在一条统一的成熟度阶梯",
    "减少流量",
    "提高局部性",
    "提高可持续带宽",
    "分布状态",
    "改变物理链路",
    "数值质量、元数据、格式转换开销与内核支持",
    "封装面积、功耗、信号传输距离、良率与成本",
    "重新测量步骤时间、质量、功耗与成本",
  ]) expect(flat).toContain(phrase);
});

test("frontier comparisons start from a reproducible operating contract", () => {
  for (const phrase of [
    "从运行契约开始，而不是比较两个峰值数字",
    "模型与操作",
    "张量形状、批次大小与序列长度",
    "输入、权重、累积、通信与存储状态所用的精度",
    "软件版本、编译器选项、内核与通信库",
    "流量体积与各相关边界上的持续带宽",
    "预热后的延迟与吞吐量分布",
    "功耗边界",
    "可用性、故障行为、维修假设与恢复时间",
    "成本范围、币种、利用率与时间跨度",
    "分三轮测量",
    "解释下界与观测时间之间的差距",
  ]) expect(flat).toContain(phrase);
});

test("the constraint arrow and conclusion keep the argument conditional", () => {
  for (const phrase of [
    "不断抬高的算术强度门槛会把压力向上层传导",
    "封装决定多少内存能靠近计算",
    "拓扑决定哪些并行组共享高速域",
    "服务方式决定状态是复用还是搬运",
    "先指出边界、测量流量、改变一个约束项，再重新测量",
    "不是一个 FLOPs 数字与一个带宽数字之间的竞赛",
    "找出当前生效的边界",
    "区分可持续速率与峰值",
  ]) expect(flat).toContain(phrase);
});

test("the contested section preserves four workload-dependent questions", () => {
  for (const phrase of [
    "纵向扩展域应该多大",
    "纵向扩展是否必须使用专有网络",
    "光学器件应该在什么时候进入封装",
    "专用或晶圆级设计会不会取代通用加速器",
    "工作负载流量，而不是 GPU 数量本身",
    "相同的消息大小、拓扑、软件成熟度与可用性",
    "机队可靠性与可维护性证据",
    "答案取决于工作负载与部署环境",
  ]) expect(flat).toContain(phrase);
});

test("obsolete roadmap rhetoric and unsourced product races are absent", () => {
  for (const phrase of [
    "规格表突出峰值算力，但稀缺在别处",
    "芯片：一块装不下自己内存的裸片",
    "机架：移动了的 scale-up 边界",
    "加速器路线如何处理带宽",
    "几条缓解路径，按成熟度排",
    "FLOPs 之上的稀缺资源",
    "九掩模版",
    "Huawei CloudMatrix",
    "Atlas 950",
    "Rubin NVL72",
    "已经出货的东西和仍停在承诺里的东西",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});

test("every translated Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
