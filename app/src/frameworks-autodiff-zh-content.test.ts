import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/02-frameworks-autodiff.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/02-frameworks-autodiff.qmd", import.meta.url),
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

test("Chapter 63 preserves the complete English framework contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "框架与自动微分 {#sec-frameworks-autodiff}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "获取导数的三种方法",
    "线性化是核心接口",
    "反向累积如何工作",
    "可微性是算子契约的一部分",
    "反向模式以时间换内存",
    "即时执行、追踪与编译是不同维度",
    "框架必须明确什么",
    "分布式布局属于张量语义",
    "运行检查清单",
    "下层约束",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-frameworks-autodiff-tape",
    "fig-frameworks-autodiff-contract",
  ]);
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
});

test("the opening defines the executable framework contract", () => {
  for (const phrase of [
    "机器学习框架定义模型代码与硬件之间的可执行契约",
    "张量值、算子语义、导数规则、设备放置、分布式布局和执行模式",
    "数学上成立",
    "未定义、不受支持，或被另一个后端作出不同解释",
    "从一个标量损失一路追踪到设备实际执行的工作",
    "捕获、编译、分派和分布式执行",
  ]) expect(flat).toContain(phrase);
});

test("finite differences expose truncation rounding and scaling costs", () => {
  for (const phrase of [
    "有限差分通过扰动输入来估计导数",
    "$x\\in\\mathbb{R}^n$ 是输入",
    "$e_i$ 是第 $i$ 个分量为一的基向量",
    "$h$ 是非零步长",
    "截断误差",
    "与尺度有关的浮点舍入和抵消误差",
    "减小步长会降低一种误差，却可能放大另一种误差",
    "为十亿参数的训练生成梯度",
    "方向有限差分仍然很适合检查梯度",
  ]) expect(flat).toContain(phrase);
});

test("symbolic and automatic differentiation remain distinct", () => {
  for (const phrase of [
    "符号微分把一个数学表达式变换成另一个表达式",
    "重复共享子表达式",
    "表达式膨胀",
    "@gls-autodiff 采用另一条路径",
    "对实际执行的数值程序中每个原语组合局部导数规则",
    "即时磁带、追踪计算图、变换中间表示，或改写源代码",
    "机器精度",
    "不会对离散的分支选择本身求导",
    "不可微点",
  ]) expect(flat).toContain(phrase);
});

test("JVP and VJP define dimensions geometry and mode choice", () => {
  for (const phrase of [
    "$n$ 是输入维度，$m$ 是输出维度",
    "雅可比矩阵",
    "框架很少需要把整块矩阵实体化",
    "雅可比向量积（JVP）",
    "输入切向量",
    "返回雅可比矩阵的一列",
    "向量雅可比积（VJP）",
    "输出余切向量",
    "返回雅可比矩阵的一行的转置",
    "一次反向扫描中得到完整梯度",
    "神经网络训练有许多输入和一个标量损失",
    "Hessian 向量积",
  ]) expect(flat).toContain(phrase);
});

test("the cheap-gradient result keeps its arithmetic-model boundary", () => {
  for (const phrase of [
    "廉价梯度结论属于算术模型，不是墙钟时间的服务级目标",
    "有理直线程序",
    "特定的操作计数约定",
    "反向算术成本为 $O(C_f)$",
    "不包括已保存张量的流量、内核启动、通信、同步",
    "实际反向传播时间不必是前向传播时间的固定倍数",
  ]) expect(flat).toContain(phrase);
});

test("reverse accumulation defines the DAG recurrence and schedule", () => {
  for (const phrase of [
    "有向无环图（DAG）",
    "把传入的输出伴随量映射为各父节点的贡献",
    "$\\bar v_i=\\partial L/\\partial v_i$ 是损失对节点 $v_i$ 的敏感度",
    "$\\operatorname{succ}(i)$ 表示它的直接后继",
    "从每一次使用中收集一项贡献",
    "标量输出的伴随量以一为种子",
    "反向拓扑顺序",
    "对 $x$ 的两项贡献必须相加",
  ]) expect(flat).toContain(phrase);
  for (const phrase of [
    "前向：",
    "执行每个原语，并记录其父节点和局部 VJP 规则",
    "反向：",
    "每个节点只按反向拓扑顺序访问一次",
  ]) expect(flat).toContain(phrase);
});

test("the runnable explains shared subgraphs and persistent gradient buffers", () => {
  for (const phrase of [
    "刻意复用一个非叶子节点",
    "每条路径",
    "拓扑调度只处理每个节点一次",
    "真实引擎保存的是向量 VJP 函数",
    "只保存这些函数需要的张量",
    "扇出产生的贡献在同一张反向图内相加",
    "参数 `.grad` 缓冲区往往跨多次反向调用保留",
  ]) expect(flat).toContain(phrase);
});

test("operator differentiability covers explicit failure modes", () => {
  for (const phrase of [
    "自动微分是否正确，取决于它组合的原语规则是否正确",
    "文档明确的次梯度",
    "传播 `NaN`",
    "detach 或 stop-gradient",
    "原地修改",
    "别名声明",
    "自定义导数",
    "反向规则、JVP、批处理、自动混合精度、追踪和高阶行为",
    "损失缩放",
    "裁剪或检查梯度之前先取消缩放",
  ]) expect(flat).toContain(phrase);
});

test("gradient checks state direction precision and edge coverage", () => {
  for (const phrase of [
    "双精度下的中心有限差分",
    "避开不连续点",
    "$r$ 是测试方向，$h$ 是有限差分步长",
    "沿一个方向检查完整梯度",
    "零尺寸、广播、非连续和极端输入",
    "二阶梯度检查",
  ]) expect(flat).toContain(phrase);
});

test("activation checkpointing keeps the real time-memory contract", () => {
  for (const phrase of [
    "前向传播会保存后续 VJP 规则所需的张量",
    "参数、梯度、优化器状态、临时工作区、通信缓冲区和分配器预留",
    "激活检查点",
    "$M(k)$ 是保存状态数量的峰值",
    "$n$ 是链的长度，$k$ 是分段长度",
    "任意 DAG、不等大小的激活值、跳跃连接或通信密集型计算图",
    "重计算必须复现原始前向传播的数值",
    "随机数生成器状态、可变全局量、设备迁移或其他副作用",
    "无声的梯度错误",
  ]) expect(flat).toContain(phrase);
});

test("execution modes remain separate axes rather than a winner myth", () => {
  for (const phrase of [
    "Theano 构建符号计算图",
    "TensorFlow 1 通过 session 执行静态数据流图",
    "Chainer 和 PyTorch",
    "普通 Python 控制流",
    "JAX 采用另一条路径",
    "这段历史并不是一场赢家通吃的框架战争",
    "即时执行",
    "追踪或分阶段执行",
    "带守卫的计算图捕获",
    "提前导出",
    "主要失败模式",
  ]) expect(flat).toContain(phrase);
});

test("PyTorch JAX and TensorFlow describe capture and cache boundaries", () => {
  for (const phrase of [
    "每次被记录的前向传播都会重新构建一张 `Function` DAG",
    "TorchDynamo 提取 FX 区域",
    "类型、形状、dtype、设备和步幅",
    "计算图中断",
    "守卫失败",
    "触发重新编译",
    "JAX 的 `grad` 和 `vmap` 是程序变换",
    "运行时数据决定的分支",
    "TensorFlow 2 默认即时执行",
    "XLA 编译是额外选择",
    "不是 `tf.function` 的同义词",
    "冷编译成本是否由热执行摊销",
  ]) expect(flat).toContain(phrase);
});

test("the seven framework contracts remain explicit", () => {
  for (const phrase of [
    "张量表示",
    "算子模式",
    "分派器",
    "自动微分变换",
    "编译器",
    "设备运行时",
    "分布式张量系统",
    "形状、dtype、设备、布局、步幅、别名、梯度状态",
    "广播、dtype 提升、输出元数据、修改和别名",
    "流、事件、同步和内存分配器",
    "逻辑布局附着到设备网格",
  ]) expect(flat).toContain(phrase);
});

test("custom operators expose every missing framework contract", () => {
  for (const phrase of [
    "自定义算子会让遗漏暴露出来",
    "后端内核",
    "供追踪使用的 fake 或 meta 实现",
    "批处理规则、自动混合精度策略和分布式分区规则",
    "注册检查器",
    "无法证明自定义导数在数学上正确",
    "即时执行与编译执行的代表性对照测试",
  ]) expect(flat).toContain(phrase);
});

test("distributed placement is tensor semantics with communication costs", () => {
  for (const phrase of [
    "一个分布式张量在设备网格上表示一个逻辑值",
    "Shard",
    "Replicate",
    "Partial",
    "Partial 并不是完整的逻辑结果",
    "Shard 转为 Replicate 通常需要全收集",
    "Partial 转为 Replicate 需要全归约",
    "Partial 转为 Shard 可以使用归约散布",
    "改变分片维度可能需要全交换",
    "无法让传输的字节凭空消失",
    "单程序多数据执行",
    "集合通信顺序不一致可能让所有 rank 挂起",
  ]) expect(flat).toContain(phrase);
});

test("the operating checklist verifies correctness before speed", () => {
  for (const phrase of [
    "正确性先于任何加速结论",
    "比较即时执行与编译执行的输出、梯度、状态更新和随机数消耗",
    "方向有限差分",
    "形状、dtype、设备、布局、非连续视图、广播、零尺寸张量、别名和修改",
    "分别测量冷编译和热执行",
    "计算图中断位置、守卫失败和重新编译次数",
    "内核时间、主机空隙、已保存张量的字节数、峰值内存、分配器预留和通信量",
    "更快的内核仍可能让整个训练步变慢",
    "容差内一致、统计等价、重启等价，或在固定平台上逐位一致",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion preserves lower-layer and portability limits", () => {
  for (const phrase of [
    "框架无法抹去它下面的机器",
    "支持的 dtype、内存布局、分块形状、集合通信带宽和编译器覆盖范围",
    "缺少正确的导数、降级或分布式规则",
    "持久的抽象边界应该放在哪里",
    "调试自由度、编译范围、自定义内核控制和后端可移植性",
    "都不能免除明确导数、副作用、布局和失败行为的责任",
    "目标系统上真正可用的实现",
  ]) expect(flat).toContain(phrase);
});

test("legacy framework-war rhetoric and retired artifacts are absent", () => {
  for (const phrase of [
    "支撑整个技术栈的一行代码",
    "框架之战",
    "运行即定义阵营赢了",
    "先定义后运行阵营",
    "这场战争",
    "Pytorch 几乎横扫了研究界",
    "fig-frameworks-autodiff-familytree",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});

test("the framework-contract diagram fits the mobile reading column", async () => {
  const block = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((dot) => dot.includes("fig-frameworks-autodiff-contract"));
  expect(block).toBeDefined();

  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(block!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(212);
});
