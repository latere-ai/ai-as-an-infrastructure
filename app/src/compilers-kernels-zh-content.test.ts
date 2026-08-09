import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/infrastructure/03-compilers-kernels.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/03-compilers-kernels.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
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

test("Chapter 64 preserves the complete English compiler-kernel contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "编译器与内核 {#sec-compilers-kernels}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "内核实现一份有边界的契约",
    "屋顶线是上界，不是秒表",
    "融合是合法性与资源决策",
    "分块把工作映射到有限资源",
    "FlashAttention 围绕 IO 改写算法",
    "降级在增加决策的同时保留语义",
    "布局与自动调优都是编译的一部分",
    "可移植性不止一种",
    "生态系统也是目标的一部分",
    "生成内核需要一名挑剔的评估者",
    "运行编译器与内核的边界",
    "下层约束",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "PyTorch 的守卫路径",
    "JAX 与 OpenXLA",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-compilers-kernels-lowering",
    "fig-compilers-kernels-validation",
  ]);
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
});

test("the opening defines compiler and kernel correctness contracts", () => {
  for (const phrase of [
    "框架程序距离可执行的设备代码还有好几层契约",
    "对守卫覆盖的每一种输入保留程序语义",
    "布局、融合边界、分块形状、库调用和目标指令",
    "形状、步幅、dtype、布局、别名、修改、数值和目标设备语义",
    "不是优化，而是另一个程序",
    "从中间表示一路追踪到目标代码",
  ]) expect(flat).toContain(phrase);
});

test("a kernel owns a declared launch and operator domain", () => {
  for (const phrase of [
    "逻辑算子说明结果意味着什么",
    "内核是在声明域上实现该算子的一种方式",
    "线程块网格",
    "流式多处理器",
    "warp 或 wavefront",
    "共享内存与同步",
    "寄存器属于单个线程",
    "全局设备内存对整个网格可见",
    "启动域和内核本体同样重要",
    "相同的逻辑形状却有不同的步幅",
    "运行时守卫这些事实，或保留正确的通用路径",
  ]) expect(flat).toContain(phrase);
});

test("the five lowering responsibilities preserve distinct boundaries", () => {
  for (const phrase of [
    "计算图捕获",
    "张量中间表示（IR）",
    "内核 IR",
    "目标代码",
    "运行时",
    "相同的可观察张量与状态副作用",
    "完整写入、合法访问、顺序与同步",
    "生命周期、依赖关系、失败和回退行为",
    "明确这些边界之后，性能工作才开始",
  ]) expect(flat).toContain(phrase);
});

test("roofline stays a scoped optimistic bound", () => {
  for (const phrase of [
    "$F$ 是为该内核选定的浮点运算计数",
    "$Q$ 是跨越测量边界传输的字节数",
    "$I$ 是每字节浮点运算数表示的算术强度",
    "算力上限与流量上限",
    "$P_{\\text{bound}}$ 是吞吐量的屋顶线上界",
    "$P_{\\max}$ 是相关的算力上限",
    "$B_{\\max}$ 是相关访问模式实际达到的带宽上限",
    "$T$ 是以秒计的执行时间",
    "屋脊强度",
    "分类方法和乐观极限，不是运行时间预测",
    "实际达到的带宽和算力",
  ]) expect(flat).toContain(phrase);
});

test("the fusion traffic example states every assumption", () => {
  for (const phrase of [
    "$y=\\max(ax+b,0)$",
    "未融合版本会写出两个完整中间结果",
    "$a$ 和 $b$ 都是标量",
    "每个实体化向量都完整读写 HBM",
    "没有可利用的跨内核缓存保留",
    "最小算法流量，不是实测设备流量或时间",
  ]) expect(flat).toContain(phrase);
});

test("fusion balances legality effects and finite resources", () => {
  for (const phrase of [
    "生产者与消费者操作",
    "依赖关系和可观察副作用",
    "修改与别名关系",
    "随机数状态、宿主回调、集合通信、原子操作和异常",
    "归约顺序",
    "数学等价并不意味着逐位一致",
    "寄存器压力或共享内存需求",
    "溢出到本地或全局内存",
    "降低占用率",
    "过度融合",
    "对不确定的选择进行剖析",
  ]) expect(flat).toContain(phrase);
});

test("tiling maps reuse and occupancy onto finite resources", () => {
  for (const phrase of [
    "分块从更大的计算中选取一小块工作",
    "把 $A$ 与 $B$ 的块从全局内存载入共享内存",
    "合并的全局内存访问",
    "更大的块能产生更多复用",
    "最大占用率本身并不是目标",
    "bank 冲突、同步频率、尾部掩码、张量单元对齐和流水线阶段数",
    "启发式方法缩小候选范围",
    "自动调优实测有限的一组调度方案",
    "缓存键必须包含选择所依赖的每一项事实",
  ]) expect(flat).toContain(phrase);
});

test("FlashAttention derives exact attention from online statistics", () => {
  for (const phrase of [
    "$Q,K\\in\\mathbb{R}^{N\\times d}$ 是查询矩阵与键矩阵",
    "$V\\in\\mathbb{R}^{N\\times d_v}$ 是值矩阵",
    "$C\\in(\\mathbb{R}\\cup\\{-\\infty\\})^{N\\times N}$ 是加性偏置或掩码",
    "每个查询行至少有一个允许访问的键",
    "完整的 $N\\times N$ 分数矩阵和概率矩阵",
    "查询块依次处理多个键值块",
    "运行最大值",
    "运行归一化因子",
    "先前贡献重新缩放",
    "与完整 softmax 相同的分子和分母",
  ]) expect(flat).toContain(phrase);
});

test("FlashAttention keeps IO bounds and generation-specific claims scoped", () => {
  for (const phrase of [
    "“精确注意力”指的是同一个数学函数，不是逐位一致",
    "仍然执行二次复杂度的注意力算术",
    "不会在 HBM 中实体化完整的二次中间结果",
    "慢速内存中的标量字传输次数",
    "IO 结论，不是 FLOP 数或字节数",
    "不能声称原始算法对所有可能的 SRAM 容量都最优",
    "FlashAttention-2",
    "FlashAttention-3",
    "算法层面的 IO 节省可以跨目标迁移",
    "最佳调度通常仍与目标有关",
  ]) expect(flat).toContain(phrase);
});

test("lowering adds explicit target decisions without universalizing one backend", () => {
  for (const phrase of [
    "没有单一层级适合做出所有决策",
    "高层张量 IR",
    "低层内核 IR",
    "算法与调度分离",
    "可移植张量语义逐步收窄为目标特定的调度与产物",
    "NVIDIA 目标",
    "PTX / cubin",
    "AMD 目标",
    "LLVM / HSACO",
    "TPU 目标",
    "后端可执行程序",
    "保留为库调用，而不是生成内核",
  ]) expect(flat).toContain(phrase);
});

test("PyTorch and JAX retain distinct capture and cache contracts", () => {
  for (const phrase of [
    "TorchDynamo 从 Python 执行中捕获带守卫的 FX 计算图片段",
    "AOTAutograd",
    "TorchInductor",
    "Triton GPU 内核、C++ CPU 内核、模板内核",
    "计算图中断会把不受支持的工作交还即时执行",
    "动态形状并不会消除特化",
    "编译延迟、守卫失败、计算图中断和缓存增长",
    "JAX 把特化的 Python 函数追踪为 jaxpr",
    "StableHLO",
    "XLA",
    "为可移植产物规定兼容窗口",
    "不会固定物理布局、调度、每个消费者上的数值精度或性能",
  ]) expect(flat).toContain(phrase);
});

test("layout and autotuning remain conditional compilation artifacts", () => {
  for (const phrase of [
    "逻辑形状并不能决定物理布局",
    "选择哪个维度连续",
    "填充或分块",
    "有些转置只改元数据，另一些会移动整个张量",
    "在两种原本都合法的布局之间转换，可能抵消快速内核带来的收益",
    "从标量线程提升为分块程序",
    "网格、掩码、块大小、warp 数或阶段数",
    "不会让某一种调度普遍最优",
  ]) expect(flat).toContain(phrase);
});

test("portability is separated into five independent claims", () => {
  for (const phrase of [
    "源码可移植性",
    "语义可移植性",
    "产物可移植性",
    "性能可移植性",
    "运行可移植性",
    "PTX 是 NVIDIA 的虚拟指令集，不是通用 GPU IR",
    "目标特定的 cubin",
    "包含多种镜像的 fat binary",
    "最终调度或二进制文件",
    "目标特定的调度",
  ]) expect(flat).toContain(phrase);
});

test("the ecosystem contract explains switching and research costs", () => {
  for (const phrase of [
    "驱动程序与运行时",
    "编译器与产物格式",
    "数学库与通信库",
    "性能分析器与调试器",
    "框架集成",
    "切换成本",
    "支持的 dtype 与布局、工作区限制、算法选择、确定性、流语义",
    "源代码翻译可以减少工作量，却不能免除验证",
    "硬件彩票",
    "内核可用性会影响哪些模型设计能够得到可信评估",
  ]) expect(flat).toContain(phrase);
});

test("generated kernels face a hostile semantic and performance evaluator", () => {
  for (const phrase of [
    "250 个 PyTorch 工作负载",
    "同时要求正确性与速度",
    "$\\mathcal{D}$ 是基准任务集",
    "$k_i$ 是任务 $i$ 的生成内核，$b_i$ 是其基线",
    "$p>0$ 是要求达到的加速阈值",
    "并不能证明生成内核普遍可靠",
    "只写入输出的一部分",
    "调用参考路径",
    "更广的隐藏分布与更严格的基线可能逆转表面上的胜利",
    "异步硬件和可变内存",
  ]) expect(flat).toContain(phrase);
});

test("the evaluator covers six independent attack surfaces", () => {
  for (const phrase of [
    "契约表面",
    "隐藏语义",
    "内存与并发",
    "评测框架完整性",
    "测量",
    "代表性比较",
    "新鲜的随机输入与输出",
    "边界形状、零尺寸与奇数尺寸、广播情况、非连续步幅",
    "越界访问、未初始化数据、不完整写入、数据竞争",
    "禁止调用参考实现、monkey-patching、隐藏回退、网络或文件访问",
    "预热、设备同步、随机配对顺序、多次重复与中位数",
    "生产基线，而不只是即时执行参考实现",
  ]) expect(flat).toContain(phrase);
});

test("the operating boundary separates semantic compiler and performance gates", () => {
  for (const phrase of [
    "生成产物与它的假设视为一个整体",
    "算子模式、守卫、副作用与别名模型、数值容差和回退",
    "固定目标架构、驱动程序、运行时、数学库、编译器、工具链版本",
    "语义门",
    "编译器门",
    "性能门",
    "冷启动编译与自动调优",
    "自动回滚到已知回退路径",
    "工作负载分布发生变化",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps graph service and portability boundaries", () => {
  for (const phrase of [
    "编译器无法恢复框架丢弃的信息",
    "局部很快的内核仍可能输掉端到端性能",
    "布局迫使系统转置",
    "动态形状让编译缓存碎片化",
    "必须在消费它们的计算图和服务中测量",
    "多少目标特定信息可以藏在可移植接口之后",
    "评估者、基线、形状分布、硬件和搜索预算",
    "把编译与运行成本计入之后",
  ]) expect(flat).toContain(phrase);
});

test("legacy moat rhetoric and synthetic shortcuts are absent", () => {
  for (const phrase of [
    "编译器、内核与 CUDA 护城河",
    "数字节，别数 FLOPs",
    "经典一课：FlashAttention",
    "下沉流水线",
    "护城河",
    "模型写的内核",
    "两条道汇合到同一家厂商的地板上",
    "无论硬件具体是什么",
    "唯一真正通用",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});
