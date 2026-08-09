import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/04-quantization-kernels.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/04-quantization-kernels.qmd", import.meta.url),
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

test("Chapter 34 preserves the complete English quantization-and-kernels contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "从字节数算起",
    "量化是一份数值契约",
    "格式不等于执行路径",
    "FlashAttention 不再物化中间结果",
    "选择并验证部署方案",
    "争议所在",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "离群值使粒度变得重要",
    "权重、激活与 KV 状态是三类不同目标",
    "GPTQ、AWQ 与 SmoothQuant 解决的问题不同",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(runnable(chapter)).toEqual(runnable(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBeGreaterThanOrEqual(5);
  expect(chapter).toContain("fig-quantization-execution-path");
  expect(chapter).toContain("fig-quantization-kernels-flashattention");
  expect(chapter).toContain('data-viz="outlier-quant" data-lang="zh"');
});

test("the opening separates representation, movement, and service outcome", () => {
  for (const phrase of [
    "上一章减少了每个词元需要的目标模型周期数",
    "本章讨论剩余每个周期的成本",
    "量化减少权重、激活或 KV 缓存的表示字节数",
    "IO 感知内核减少数据在内存层次中搬运的字节数",
    "数值契约、内核实现与服务结果分开",
    "压缩工件需要能够直接读取其确切布局的内核",
    "更小的文件可能节省容量，却不改善延迟",
  ]) expect(flat).toContain(phrase);
});

test("the byte models separate capacity, decode bandwidth, roofline, and attention IO", () => {
  for (const phrase of [
    "FP16 完整存储约需 140 GB",
    "名义上的四位表示只有 35 GB 权重数据",
    "节省容量并不自动等于降低延迟",
    "实测带宽，而不是设备标称峰值",
    "受限于通信",
    "受内存限制的解码是一种常见运行区间，不是一条定律",
    "不会在每个解码步都新建一个完整的 $n\\times n$ 分数矩阵",
    "哪种数值表示能够保持所需质量",
  ]) expect(flat).toContain(phrase);
});

test("the numeric contract defines reconstruction, error, granularity, and real payload", () => {
  for (const phrase of [
    "这些公式中的每个符号都属于存储下来的数值契约",
    "整个张量、单个通道或一小组相邻数值",
    "截断会带来超过该界限的误差",
    "真实存储成本还包括元数据与填充",
    "四位是一组布局，而不是完整的格式说明",
    "4.125 个理想比特",
    "约 3.88 倍，而不是整整四倍",
    "全零的对称量化组需要明确约定",
    "数值误差和硬件可高效执行的路径",
  ]) expect(flat).toContain(phrase);
});

test("outliers and tensor targets are scoped without universal claims", () => {
  for (const phrase of [
    "特意构造的小型合成向量",
    "不是实测的激活分布",
    "权重专用量化",
    "权重与激活量化",
    "KV 缓存量化",
    "三项独立选择，并不是同一个开关由弱到强的三个档位",
    "不会让总接纳批量自动翻倍",
    "缓存格式、缩放因子、模型版本与位置策略必须属于缓存身份",
  ]) expect(flat).toContain(phrase);
});

test("GPTQ, AWQ, and SmoothQuant keep their distinct optimization contracts", () => {
  for (const phrase of [
    "都是训练后量化（PTQ）方法",
    "量化感知训练（QAT）",
    "动态规则的归约与缩放工作也要计入延迟",
    "GPTQ 最小化层输出重建误差",
    "AWQ 并不会把那百分之一的权重存成 FP16",
    "不需要反向传播或逐层重建",
    "SmoothQuant 在激活与权重之间转移缩放",
    "不会让量化变成无损操作",
  ]) expect(flat).toContain(phrase);
});

test("formats are connected to artifact, kernel, and runtime contracts", () => {
  for (const phrase of [
    "INT4 与 INT8",
    "E4M3",
    "E5M2",
    "MXFP4 与 NVFP4",
    "GGUF 是容器，不是数值精度",
    "可部署路径包含三份契约：工件、内核与运行时",
    "功能兼容，并不能证明它会加速",
    "支持不等于快",
    "论文结果不能充当兼容性保证",
  ]) expect(flat).toContain(phrase);
});

test("FlashAttention states exactness, online recurrence, and hardware limits", () => {
  for (const phrase of [
    "在浮点舍入误差范围内计算精确注意力",
    "不是稀疏或近似注意力规则",
    "运行中的最大值",
    "运行中的 softmax 分母",
    "未归一化的输出累加器",
    "朴素分块 softmax 所缺少的步骤",
    "报告的加速只属于所声明的硬件、精度、形状与基线",
    "不是可以迁移的常数",
    "测量实际执行的路径",
  ]) expect(flat).toContain(phrase);
});

test("deployment verification joins path evidence, service metrics, and quality", () => {
  for (const phrase of [
    "从工作负载出发，不要从格式名称出发",
    "记录基线",
    "定位约束",
    "选择张量目标",
    "记录完整数值契约",
    "证明目标路径确实执行",
    "在相同接纳负载下比较",
    "重新运行质量评估",
    "保留回滚路径",
    "加载时必须拒绝不兼容的元数据",
    "未被察觉的回退可能保持正确性，却抹掉预期加速",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion requires systems and capability evidence together", () => {
  for (const phrase of [
    "不存在脱离硬件的统一排名",
    "有些是校准方法，有些是数值格式，还有一个是容器",
    "服务系统必须交付两类结果",
    "系统测量与能力测量",
    "量化降低表示成本",
    "融合与 IO 感知算法减少数据搬运和内核启动开销",
    "工件、内核、运行时、工作负载与质量阈值彼此一致",
    "完整路径才是部署单位",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes old routing claims, synthetic figures, and mutable source paths", () => {
  for (const phrase of [
    "## 内存带宽瓶颈",
    "## 手段一：把每个字节变小",
    "## 手段二：不再搬动矩阵",
    "## 选择路径",
    "## 引擎如何整合这些选择",
    "## 每个手段的代价",
    "## 评估这一关",
    "更粗的更快更小",
    "更低的位宽总会减小占用",
    "可接纳的批翻倍",
    "vllm/entrypoints/llm.py",
    "python/sglang/srt/mem_cache/radix_cache.py",
    "/figures/quantization-kernels-1.svg",
    "/figures/quantization-kernels-2.svg",
    "import numpy",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
