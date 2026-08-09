import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/05-structured-long-context.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/05-structured-long-context.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
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

test("Chapter 35 preserves the complete English structured-and-long-context contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "约束解码会改变词元分布",
    "控制语法执行成本",
    "长上下文有四项彼此独立的限制",
    "三类策略，三种失效方式",
    "缓存状态必须始终自洽",
    "验证完整服务路径",
    "争议所在",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "解析器处理词元字节，而不是词元标签",
    "保证覆盖什么",
    "强制跨度需要一次扩展计算",
    "注意力汇与近期窗口",
    "按注意力历史驱逐与提示词压缩",
    "查询感知的页面选择",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(runnable(chapter)).toEqual(runnable(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBeGreaterThanOrEqual(6);
  expect(chapter).toContain("fig-slc-structured-loop");
  expect(chapter).toContain("fig-slc-jumpforward");
  expect(chapter).toContain('data-viz="attention-heatmap"');
  expect(chapter).toContain('data-lang="zh"');
  expect(chapter).toContain('data-tokens="t1,t2,t3,t4,t5,t6,t7,t8"');
});

test("the opening separates syntax guarantees from approximate cache policies", () => {
  for (const phrase of [
    "两种不改模型权重的服务时干预",
    "结构化生成限制下一个词元的可选范围",
    "长上下文策略限制注意力保留或读取哪些已经计算好的键值状态",
    "提供的保证却不同",
    "语法可以保证输出属于实现的形式语言",
    "缓存驱逐与稀疏读取是对完整注意力的近似",
    "可解析的 JSON 仍可能填错值",
    "都不能当作普遍的正确性保证",
  ]) expect(flat).toContain(phrase);
});

test("constrained decoding defines reachability, termination, and explicit failure", () => {
  for (const phrase of [
    "至少仍有一个可接受的完整结果可达",
    "结束序列词元只有在解析器处于接受配置时才合法",
    "允许集合为空",
    "必须明确失败",
    "不能退回原始分布继续采样",
    "局部合法的词元可能把解析器带入死路",
    "最大词元数停止、取消或引擎故障",
  ]) expect(flat).toContain(phrase);
});

test("token bytes, parser state, and the implemented guarantee stay connected", () => {
  for (const phrase of [
    "分词器产生的完整字节串",
    "一个词元可能跨过多次语法转移",
    "一个字符的字节序列也可能拆到多个词元中",
    "上下文无关文法还需要解析器栈",
    "语法有效不等于取值正确",
    "所请求 schema、后端语法覆盖、分词器集成与终止行为的交集",
    "不能取代应用验证器或授权层",
    "内容准确率与解析成功率都要比较",
  ]) expect(flat).toContain(phrase);
});

test("compiled masks and forced spans retain their real execution costs", () => {
  for (const phrase of [
    "编译缓存键必须包含规范化语法、分词器版本、特殊词元策略、字节编码与后端版本",
    "预计算不会让整个操作变成固定成本",
    "掩码应用仍要访问选中的 logits 或词表大小的掩码",
    "不是普遍成立的上界",
    "强制跨度仍必须写入模型状态",
    "重新对边界分词",
    "以类似预填充的扩展计算一次处理确定词元",
    "预留、提交与回滚",
    "不能让解析器状态领先于模型状态",
  ]) expect(flat).toContain(phrase);
});

test("long context separates capability, capacity, traffic, and retention", () => {
  for (const phrase of [
    "模型支持的上下文长度",
    "KV 容量",
    "注意力流量",
    "信息保留",
    "驱逐 KV 项并不会扩展模型学到的能力",
    "流畅生成不能证明模型保留了长距离信息",
    "提示词预填充的峰值内存与计算",
  ]) expect(flat).toContain(phrase);
});

test("cache policies state what they store, read, and can lose", () => {
  for (const phrase of [
    "按存储什么、读取什么来比较",
    "驱逐不可逆",
    "保留完整缓存",
    "下一次查询可以改选其他页面",
    "支持持续生成，不等于支持无限回忆",
    "历史注意力不一定能预测未来重要性",
    "提示词压缩，不是持续更新的重击者缓存",
    "永久删除变成了单次查询遗漏",
    "训练原生稀疏注意力",
  ]) expect(flat).toContain(phrase);
});

test("cache state includes position, ownership, metadata, and physical constraints", () => {
  for (const phrase of [
    "逻辑位置、层与头的身份、数值格式和所有权状态",
    "把有缺口的保留词元重新连续编号会改变注意力几何",
    "分页分配并不会让任意逐词元或逐头驱逐变得免费",
    "共享前缀缓存",
    "引用计数、预留、提交、回滚、取消与前缀缓存身份",
    "策略元数据同样占用内存和带宽",
    "容量改善了，延迟仍可能变差",
  ]) expect(flat).toContain(phrase);
});

test("verification covers structured correctness, task quality, and serving behavior", () => {
  for (const phrase of [
    "schema 有效率、语法覆盖率、字段级正确率与下游拒绝率",
    "语法编译延迟、编译缓存命中率与内存",
    "混合语法批次",
    "逐词元扩展",
    "在模型支持的上下文长度内与完整 KV 基线比较",
    "按证据位置报告检索准确率",
    "困惑度本身不够",
    "同等接纳负载",
    "压实或选择失败后的回滚",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion preserves the separate production boundaries", () => {
  for (const phrase of [
    "不存在脱离工作负载的最佳缓存策略",
    "每项质量或速度声明",
    "调度器必须容纳语法编译与异构掩码",
    "投机解码必须把同一语法应用于目标分布",
    "无法让取值变成事实",
    "无法让已经丢弃的证据重新可用",
    "保证、任务质量与服务结果一起衡量",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete lineage narrative and false shortcuts", () => {
  for (const phrase of [
    "/figures/structured-long-context-1.svg",
    "fig-slc-mask",
    "fig-slc-sink",
    "fig-slc-lineage",
    "fig-structured-long-context-curve",
    "data-family=\"diminishing\"",
    "让固定模型服从约束的两种方式",
    "线索一",
    "线索二",
    "两条线索的交汇",
    "接受它们的首字符（或整个拼写）",
    "直接输出，不调用模型",
    "大致常数",
    "多数键都在占用显存",
    "import numpy",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
