import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/02-memory-scheduling.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/02-memory-scheduling.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string): string[] {
  return [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map((match) => match[0]);
}

function runnable(source: string): string | undefined {
  return source.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/)?.[1];
}

test("Chapter 32 preserves the complete English memory-and-scheduling contract", () => {
  expect(headings(chapter)).toEqual([
    "从保留词元到物理块",
    "块表消除连续内存要求",
    "分配是词元计划的一部分",
    "共享前缀会改变块的所有权",
    "内存压力需要明确策略",
    "分块预填充共享每轮预算",
    "只有数据路径划算时才移动 KV 状态",
    "争议所在",
    "同时验证分配器与调度器",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(runnable(chapter)).toEqual(runnable(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBeGreaterThanOrEqual(14);
  expect(chapter).toContain("fig-memory-block-lifecycle");
  expect(chapter).toContain('data-viz="paged-attention" data-lang="zh"');
});

test("the opening carries reservation down to physical blocks without inventing a sequence", () => {
  for (const phrase of [
    "执行词元计划之前，先为它预留所需状态",
    "把这条规则一直落实到物理 KV 缓存块",
    "不断增长的序列、共享前缀、请求取消和内存压力",
    "延迟、公平性和进度",
    "这些机制可以组合使用",
    "并不是一套必须按历史顺序采用的步骤",
  ]) expect(flat).toContain(phrase);
});

test("block accounting separates logical payload, capacity, and three waste classes", () => {
  for (const phrase of [
    "每个保留词元对应的逻辑 KV 载荷",
    "切分、对齐、元数据或分配器开销之前",
    "末块浪费少于每条非共享序列的一个块",
    "过度预留",
    "外部碎片",
    "末块浪费",
    "精确的离散记账",
    "不会把块表条目虚构成运行时成本",
    "都不是完整的性能模型",
  ]) expect(flat).toContain(phrase);
});

test("block tables explain indirection, analogy limits, and scoped evidence", () => {
  for (const phrase of [
    "逻辑 KV 序列存进大小固定、物理位置无需相邻的块",
    "逻辑块索引 $j$ 映射到物理块",
    "并不是硬件页表",
    "不一定涉及按需缺页、地址转换后备缓冲器（TLB）或操作系统换页",
    "完整的 vLLM 系统",
    "不能把它视为分块分配本身能够带来、且与硬件无关的固定倍数",
  ]) expect(flat).toContain(phrase);
});

test("token planning preserves capacity through reservation, commit, and rollback", () => {
  for (const phrase of [
    "某个请求也可能因为优先级、容量或公平性策略而不执行任何任务",
    "内存可行性",
    "内存可行性与调度器的词元预算或计算预算是两项独立约束",
    "预留、执行、提交",
    "以原子方式预留全部新块",
    "取消或失败会回滚尚未提交的预留",
    "任何仍被引用的块都不得重新分配",
    "每次状态转换都必须保持等式成立",
  ]) expect(flat).toContain(phrase);
});

test("prefix sharing defines identity, ownership, value, and reclamation", () => {
  for (const phrase of [
    "可见文本相同还不够",
    "词元 ID、模型权重或版本、启用的适配器",
    "租户与隔离策略",
    "共享块只计算一次",
    "只有相关引用全部移除且 $r_p=0$ 后",
    "写时复制或等价规则",
    "身份",
    "所有权",
    "价值",
    "逐出",
    "还应报告匹配的前缀词元数或字节数",
  ]) expect(flat).toContain(phrase);
});

test("pressure and chunking policies state actions, fairness, and limits", () => {
  for (const phrase of [
    "逐出可复用的前缀状态",
    "推迟接纳",
    "抢占并重新计算",
    "卸载后再载入",
    "明确拒绝或报错",
    "这些操作不能互换",
    "选择被抢占的受害请求时，还必须考虑等待时间或公平性约束",
    "不是允许调度器无限重试",
    "并不能消除预填充与解码之间的全部干扰",
    "只保护解码的策略可能让新预填充长期得不到执行",
  ]) expect(flat).toContain(phrase);
});

test("state movement accounts for transfer, load, and routing uncertainty", () => {
  for (const phrase of [
    "实测带宽，而不是链路标称带宽",
    "源端和目的端的队列、争用、重试和背压",
    "清晰的就绪与所有权协议",
    "并不能证明阶段分离或分层存储普遍更优",
    "缓存感知的路由还必须同时考虑局部性和负载",
    "容量、公平性、故障域、预测误差和租户隔离",
  ]) expect(flat).toContain(phrase);
});

test("verification covers failure paths, conservation, and service results", () => {
  for (const phrase of [
    "在预留与提交之间取消一个请求",
    "最后一个引用消失之后",
    "注入执行与传输故障",
    "耗尽内存池",
    "改变模型版本、适配器、位置处理、模态或租户命名空间",
    "内存池状态",
    "复用与回收",
    "调度",
    "服务结果",
    "核对从接纳到释放期间的每个已调度词元和每个物理块",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps allocator and scheduler responsibilities separate", () => {
  for (const phrase of [
    "分块分配为调度器提供了精确的可行性检验",
    "引用计数保证前缀共享安全",
    "内存压力策略明确哪些任务可以丢弃、移动、延迟或拒绝",
    "分配器负责维护内存与所有权不变量",
    "调度器则要依据负载的延迟、公平性、接纳率和成本约定",
    "第一次请求取消、缓存未命中、流量突发或块池耗尽时",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete claims, figures, and mutable source paths", () => {
  for (const phrase of [
    "构成一条依赖链",
    "同一个问题的两面",
    "预填充是计算受限的",
    "解码是显存带宽受限的",
    "唯一的内部浪费",
    "重置了开放服务的吞吐基线",
    "分离已成常态",
    "前沿机队",
    "vllm/v1/engine/core.py",
    "/figures/memory-scheduling-1.svg",
    "/figures/memory-scheduling-2.svg",
    "np.sqrt",
    "w_indir",
    "b_formula",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
