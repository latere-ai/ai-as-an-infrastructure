import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/06-serving-multimodal.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/06-serving-multimodal.qmd", import.meta.url),
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

function runnables(source: string): string[] {
  return [...source.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)].map(
    (match) => match[1],
  );
}

test("Chapter 36 preserves the complete English multimodal-serving contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "从融合契约算起",
    "从预处理后的输入核算成本",
    "根据实际策略推导视觉长度",
    "下层约束",
    "调度资源向量，而不是提示词长度",
    "缓存真正想跳过的阶段",
    "端到端验证媒体输入服务",
    "媒体生成是另一条服务路径",
    "争议所在",
    "运行准则",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(runnables(chapter)).toEqual(runnables(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBeGreaterThanOrEqual(9);
  expect(chapter).toContain("fig-mm-input-contracts");
  expect(chapter).toContain('IMG [label="媒体字节"]');
});

test("the opening separates media input from media generation", () => {
  for (const phrase of [
    "文本服务器接收词元 ID",
    "获取、解码、缩放、采样、编码和投影",
    "语言模型预填充开始之前",
    "提示词长度不足以完成接纳控制",
    "媒体输入服务",
    "编码器向语言模型提供证据",
    "媒体生成服务",
    "需要另一套成本模型与调度器",
  ]) expect(flat).toContain(phrase);
});

test("fusion contracts determine language state and media cost", () => {
  for (const phrase of [
    "架构决定媒体特征存放在哪里，以及由哪类缓存承担成本",
    "仅解码器融合",
    "交叉注意力融合",
    "连续嵌入，不是分词器生成的词表 ID",
    "文本自注意力 KV 与媒体交叉注意力状态彼此独立",
    "离散图像或音频编码",
    "容量核算取决于架构",
  ]) expect(flat).toContain(phrase);
});

test("input accounting exposes every deployment variable and stage", () => {
  for (const phrase of [
    "每个符号都是部署参数",
    "只计算原始图块数",
    "不足以预测语言模型看到的序列",
    "投影前缀契约",
    "交叉注意力模型需要单独计算媒体键值状态",
    "每个 $T$ 都是对应阶段的实际耗时",
    "上层核算模型",
    "稠密自注意力则包含合并序列长度的二次项",
    "每个新文本查询仍要读取保留的媒体状态",
  ]) expect(flat).toContain(phrase);
});

test("visual length follows preprocessing and trained model policy", () => {
  for (const phrase of [
    "缩放、裁剪或填充之后",
    "576 个投影图像位置",
    "模型特定的结果",
    "固定网格",
    "切片",
    "动态分辨率",
    "空间合并",
    "固定预算重采样器",
    "词元剪枝",
    "只有后续层才会变便宜",
    "小号文字和小物体",
    "视频和音频还增加了时间这一长度轴",
  ]) expect(flat).toContain(phrase);
});

test("admission and placement schedule heterogeneous resource stages", () => {
  for (const phrase of [
    "资源向量",
    "媒体字节、解码像素、图像数量、视频帧数或音频时长",
    "预计编码器工作量、投影词元数、文本词元数、输出词元上限",
    "形状分桶",
    "填充浪费",
    "语言侧按总预填充与 KV 需求组批",
    "队首阻塞",
    "长尾并带有突发性",
    "编码、预填充与解码分离",
    "不是对其他模型、工作负载或网络的容量承诺",
  ]) expect(flat).toContain(phrase);
});

test("three cache layers keep distinct identities and security boundaries", () => {
  for (const phrase of [
    "处理器缓存",
    "编码器输出缓存",
    "KV 前缀缓存",
    "预处理器版本",
    "编码器版本、投影器版本、精度与布局",
    "精确的前缀顺序和位置",
    "编码器输出命中并不意味着 KV 前缀缓存命中",
    "租户范围、授权决定、防碰撞比较、保留策略与按版本失效",
    "不能泄露另一租户曾提交过同一份私有媒体",
  ]) expect(flat).toContain(phrase);
});

test("media-input verification joins latency, capacity, goodput, and quality", () => {
  for (const phrase of [
    "保留模态组合、媒体项数量、分辨率、时长、文本长度、输出长度与到达突发",
    "p50、p95 与 p99",
    "首词元时间与词元间延迟",
    "峰值编码器内存、峰值 KV 内存",
    "编码器缓存命中率与 KV 前缀缓存命中率",
    "同等负载下的有效吞吐量与尾延迟",
    "OCR、图表、小物体、多图、视频与音频任务",
    "完整细节基线",
  ]) expect(flat).toContain(phrase);
});

test("media-generation serving states its own work and progress contract", () => {
  for (const phrase of [
    "文本编码器、迭代去噪器或流模型，以及潜变量解码器",
    "求解器步数或神经函数求值次数",
    "引导分支",
    "减少步数为何有帮助，却没有声称步数是唯一成本",
    "不是 FLOPs 估算",
    "新的质量与延迟取舍点，不是免费的运行时开关",
    "队首阻塞或类似填充的浪费",
    "在迭代之间支持取消",
    "不是通用的 KV 缓存行为",
    "预览频率会增加解码器工作",
    "因果媒体生成可以提供流式契约",
  ]) expect(flat).toContain(phrase);
});

test("the contested choices and operating rule remain workload specific", () => {
  for (const phrase of [
    "固定还是可变的媒体预算",
    "同机部署还是拆分部署",
    "在看到提示词之前还是之后压缩",
    "一套服务引擎还是两套",
    "把媒体策略当作服务契约的一部分",
    "接受的格式、字节与尺寸限制、图像和帧数量、时长",
    "调度器执行的契约必须与容量测试使用的契约相同",
    "可以测试的工程选择，而不是口号",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete diagrams, claims, and synthetic arithmetic", () => {
  for (const phrase of [
    "/figures/serving-multimodal-1.svg",
    "fig-mm-pipeline",
    "不是分词器产生的 token",
    "同处一条序列的三道工序",
    "决定数量的三个参数",
    "把数量压回去",
    "编码器跑在哪里",
    "服务生成：轮到模型产出像素",
    "分辨率也是服务决策",
    "这张网格就决定了成本的全部",
    "从那一刻起便与文本 token 再无分别",
    "对答案几无影响",
    "对像素做哈希",
    "几乎总是扩散模型",
    "所以没有什么可流式输出",
    "tflops_per_step = 2 * P * TOK",
    "import numpy",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
