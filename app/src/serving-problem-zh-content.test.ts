import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/01-serving-problem.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/01-serving-problem.qmd", import.meta.url),
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

test("Chapter 31 preserves the complete English serving contract", () => {
  expect(headings(chapter)).toEqual([
    "测量请求的完整生命周期",
    "预填充与解码处于不同运行区间",
    "KV 状态让内存成为接纳约束",
    "迭代调度消除静态批处理的空闲时间",
    "调度器必须保证什么",
    "五种机制分别消除不同的浪费",
    "争议所在",
    "在负载下评估服务策略",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chapter).toContain("fig-serving-request-lifecycle");
  expect(chapter).toContain('data-viz="kv-cache" data-lang="zh"');
});

test("the opening defines serving as online resource allocation", () => {
  for (const phrase of [
    "模型检查点不会决定请求何时运行",
    "提示词长度、输出长度和截止时间各不相同",
    "创建模型状态，并在生成词元的间隙保留这些状态",
    "何时继续接纳任务会让已有请求逾期",
    "仅讨论解码器式自回归 Transformer",
    "在线资源分配问题",
    "任何一个阶段都不存在普遍适用的瓶颈",
    "满足明确延迟约定的已完成请求",
    "接纳率和成本",
  ]) expect(flat).toContain(phrase);
});

test("request timing keeps server boundaries and tail behavior explicit", () => {
  for (const phrase of [
    "端点确定之后，延迟数值才有意义",
    "只输出一个词元时，TPOT 没有定义",
    "ITL 的分布能暴露平均值掩盖的停顿",
    "客户端测得的延迟还包括网络传输和客户端缓冲",
    "TTFT 并不等于“预填充时间”",
    "按请求类别分别报告百分位数",
    "请求吞吐量",
    "词元吞吐量",
    "拒绝难处理的请求",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("\\operatorname{ITL}_{i,j}");
  expect(chapter).toContain("G_{\\Delta}");
});

test("phase regimes and batching remain conditional", () => {
  for (const phrase of [
    "通常具有更高的算术强度",
    "常常受到内存带宽限制",
    "roofline 模型描述的是判断条件，而不是一句口号",
    "模型形状、序列长度、批的组成、量化、内核、并行方式和硬件",
    "常见运行区间，而不是自然定律",
    "仍能维持目标延迟分布的最大可行批",
  ]) expect(flat).toContain(phrase);
});

test("KV accounting separates logical bytes from physical policy", () => {
  for (const phrase of [
    "逻辑 KV 内存",
    "模型权重、常驻 KV 状态、内核与通信的临时工作区，以及安全预留空间",
    "共享物理前缀块时，每个唯一块只计算一次",
    "每台设备上的内存占用还取决于并行布局",
    "通常是接纳约束，但不一定总是最先触顶的约束",
    "并非基准测试结果",
    "可能改变准确率或内核行为",
  ]) expect(flat).toContain(phrase);
});

test("the runnable preserves the static-versus-continuous accounting example", () => {
  expect(runnable(chapter)).toEqual(runnable(english));
  for (const phrase of [
    "四个请求都在零时刻就绪",
    "记账示例，而不是性能模型",
    "并不会减少生成这些词元所需的模型计算",
    "调度策略属于服务约定的一部分",
  ]) expect(flat).toContain(phrase);
});

test("scheduler ordering protects memory, ownership, and progress", () => {
  for (const phrase of [
    "清理已完成或已取消的请求",
    "启动模型计算之前预留全部所需的 KV 块",
    "已分配的内存绝不超过内存池容量",
    "正在运行的请求所引用的块绝不会被释放或重新分配",
    "尚未预留下一状态的请求不得执行",
    "无声重试会把接纳失败变成没有上限的排队",
  ]) expect(flat).toContain(phrase);
});

test("five mechanisms keep distinct resources, costs, and limits", () => {
  for (const phrase of [
    "连续批处理",
    "@gls-pagedattention",
    "前缀复用",
    "分块预填充",
    "预填充与解码分离",
    "并不会减少每个独有词元所需的逻辑字节数",
    "模型版本、适配器、缓存格式、位置处理方式和租户策略",
    "解码池必须等到 KV 状态传到之后才能开始",
    "不存在普遍适用的优劣排序",
  ]) expect(flat).toContain(phrase);
});

test("load evaluation reports the complete operating curve", () => {
  for (const phrase of [
    "记录到达时序、提示词长度、请求的输出上限、实际输出长度",
    "调优之前定义测量边界",
    "报告整条曲线，而不是某个有利的运行点",
    "使用相同的模型、缓存精度、加速器型号与数量",
    "接纳率和拒绝率",
    "按原因检查长尾",
    "跨租户的数据泄露或时序侧信道风险",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion distinguishes a kernel result from a useful service", () => {
  for (const phrase of [
    "服务性能不能靠“计算量”到“速度”的简单换算来解释",
    "每种机制消除的浪费来源不同",
    "都不能取代接纳控制和针对具体负载的测量",
    "同时报告尾延迟、有效吞吐量、拒绝情况和成本",
    "快速内核演示与并发用户到来时仍然有用的服务之间的分界线",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete shortcuts and unsupported claims", () => {
  for (const phrase of [
    "训练好的模型是一个文件",
    "预填充是计算受限的",
    "TTFT 本质上就是",
    "解码受限于内存带宽",
    "TPOT 本质上就是",
    "KV 缓存是主要约束",
    "缓存的大小由架构固定，而非由服务层固定",
    "争论已大体收场",
    "前沿规模",
    "vllm/v1/engine/core.py",
    "/figures/serving-problem-1.svg",
    "/figures/serving-problem-2.svg",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
