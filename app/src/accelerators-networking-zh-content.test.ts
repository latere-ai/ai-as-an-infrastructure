import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/infrastructure/01-accelerators-networking.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/01-accelerators-networking.qmd", import.meta.url),
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

function htmlFigureIds(source: string): string[] {
  return [...source.matchAll(/^<figure id="([^"]+)">$/gm)].map(
    (match) => match[1],
  );
}

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

test("Chapter 62 preserves the complete English accelerator contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "加速器与网络 {#sec-accelerators-networking}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "加速器究竟加速什么",
    "屋顶线是上界，不是诊断",
    "容量、带宽、延迟与流量",
    "互连是一套分层协议栈",
    "集合通信既有语义，也有算法",
    "要放置的是通信图，不是缩写",
    "TPU v4：一个边界明确的案例",
    "精度与可移植性是两份不同的契约",
    "MFU 是一个核算比率",
    "从组件一直测到完整运行",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual(["回归场景"]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(htmlFigureIds(chapter)).toEqual(htmlFigureIds(english));
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(chapter).not.toContain("```{dot}");
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("/figures/accelerators-networking-");
});

test("the opening makes performance a workload-and-system claim", () => {
  for (const phrase of [
    "加速器规格不能预测应用性能",
    "峰值算力、内存容量和链路速率",
    "特定约定下特定操作的上限",
    "工作负载、张量形状、精度、软件栈、拓扑和测量方法",
    "任何一项发生变化，瓶颈都可能转移",
    "从一块加速器内部出发",
    "最后说明如何测量完整系统",
  ]) expect(flat).toContain(phrase);
});

test("the accelerator model separates host lanes memory and matrix engines", () => {
  for (const phrase of [
    "加速器并不是一个巨大的算术单元",
    "主机 CPU 启动程序",
    "通用并行执行单元、内存控制器、缓存和专用矩阵引擎",
    "单指令多线程",
    "不能把 SIMT 当成通用的加速器指令集",
    "分块矩阵乘加",
    "接受的输入格式、累加精度和指令语义",
    "脉动阵列",
  ]) expect(flat).toContain(phrase);
});

test("kernel performance keeps shape memory branching and sparsity conditions", () => {
  for (const phrase of [
    "内核是把硬件变成实际工作的可执行单元",
    "张量维度是否适合可用的分块形状",
    "内存访问是否合并",
    "分支是否发散",
    "精度转换、缩放、非矩阵运算和数值保护",
    "结构化稀疏峰值",
    "稠密峰值与稀疏峰值不能互换",
  ]) expect(flat).toContain(phrase);
});

test("the roofline section defines its boundary and limitations", () => {
  for (const phrase of [
    "$F$ 表示内核执行的浮点运算次数",
    "$Q$ 表示跨越该边界传输的字节数",
    "算术强度",
    "$P_{\\mathrm{peak}}$ 表示所选指令和精度下的峰值算术吞吐量",
    "$B_{\\mathrm{mem}}$ 表示同一边界上的可持续带宽",
    "屋脊点",
    "并不意味着运行时吞吐量就等于这个上界",
    "HBM 流量、主机与设备之间的流量，还是网络流量",
    "实测的可持续带宽",
  ]) expect(flat).toContain(phrase);
});

test("memory analysis distinguishes capacity bandwidth latency and traffic", () => {
  for (const phrase of [
    "寄存器、由软件管理的共享内存、缓存和设备内存",
    "封装在加速器旁的 @gls-hbm",
    "容量决定",
    "带宽限制",
    "延迟是",
    "流量是程序实际导致移动的字节数",
    "容量不等于带宽，二者也都不等于利用率",
    "明确流量在哪一层计数",
    "概念层级，并非实测比例",
  ]) expect(flat).toContain(phrase);
});

test("the interconnect stack separates topology transport and collectives", () => {
  for (const phrase of [
    "物理拓扑",
    "跳数、路径多样性、故障域、端点注入、对分带宽和超额订阅",
    "传输层",
    "PCIe 和 NVLink",
    "InfiniBand 或采用 RoCE 的以太网",
    "集合通信库",
    "NCCL",
    "无法凭空创造对分带宽",
    "scale-up 和 scale-out 是有用的描述",
    "却不是“节点内”和“节点外”的固定同义词",
  ]) expect(flat).toContain(phrase);
});

test("RDMA and GPU-direct claims keep control-path qualifications", () => {
  for (const phrase of [
    "@gls-rdma",
    "网络适配器直接在已注册的内存区域之间传输数据",
    "不让主机 CPU 进入数据路径",
    "RoCE 在以太网上提供 RDMA 语义",
    "内存注册、PCIe 布局、驱动程序和同步仍然重要",
    "“绕过 CPU”描述的是数据路径",
    "并不表示系统无需 CPU 完成设置或控制工作",
  ]) expect(flat).toContain(phrase);
});

test("collectives separate semantics from algorithms", () => {
  for (const phrase of [
    "广播（broadcast）",
    "全归约（all-reduce）",
    "全收集（all-gather）",
    "归约散布（reduce-scatter）",
    "全交换（all-to-all）",
    "这些语义并不决定算法",
    "环、树、分层组合",
    "归约散布后接全收集",
    "每条消息的启动延迟",
    "有效带宽的倒数",
    "对于大消息，环算法具有较高的带宽效率",
    "小消息的启动成本很高",
  ]) expect(flat).toContain(phrase);
});

test("communication overlap remains an observed scheduling property", () => {
  for (const phrase of [
    "只有依赖图暴露出独立工作",
    "运行时成功地并发调度两者",
    "分桶大小、内核持续时间、流优先级、内存压力和并发流量",
    "$T_{\\mathrm{comp}}$ 表示独立测得的计算时间",
    "$T_{\\mathrm{comm}}$ 表示独立测得的通信时间",
    "$T_{\\mathrm{overlap}}$ 表示两者重叠的时间",
    "一个模型形状中完全隐藏",
    "批次大小、放置方式或软件改变后暴露出来",
  ]) expect(flat).toContain(phrase);
});

test("the parallelism table preserves seven distinct communication graphs", () => {
  for (const phrase of [
    "张量并行",
    "序列并行",
    "上下文并行",
    "专家并行",
    "数据并行",
    "完全分片数据并行",
    "流水线并行",
    "常见流量",
    "放置问题",
    "频繁的激活流量",
    "因果负载均衡",
    "突发的对分带宽需求",
    "参数全收集与梯度归约散布",
    "流水线气泡",
  ]) expect(flat).toContain(phrase);
});

test("placement is measured rather than derived from an acronym", () => {
  for (const phrase of [
    "Megatron 最初的张量并行布局是一个重要案例，不是普遍规律",
    "每一层的前向传播使用两次全归约",
    "后续组合会改变操作与重叠调度",
    "流水线流量会随微批次重复出现",
    "测量或估算每条边的字节数、频率、延迟敏感度、节省的内存和可用重叠窗口",
    "TP 放在内部、DP 放在外部",
    "只是一条常用的起始经验",
  ]) expect(flat).toContain(phrase);
});

test("TPU v4 remains a generation-scoped case study", () => {
  for (const phrase of [
    "@gls-tpu pod，也就是由 Google 张量处理单元组成的集群",
    "@gls-ici，也就是连接 TPU 芯片的芯片间互连",
    "光路交换机",
    "三维环面切片",
    "扭转环面",
    "只适用于 TPU v4",
    "GSPMD 是一套编译器分区系统",
    "逻辑设备网格",
    "不会自行让物理拓扑变快",
    "@gls-gpu 集群，也就是使用图形处理器作为加速器的集群",
    "必须把加速器架构、逻辑分片和物理拓扑放在一起理解",
  ]) expect(flat).toContain(phrase);
});

test("precision and portability retain separate compatibility dimensions", () => {
  for (const phrase of [
    "输入存储、乘法、累加精度、输出格式、缩放策略和归约精度",
    "E4M3 和 E5M2",
    "哪些张量采用这些格式",
    "同一种稠密或结构化稀疏约定",
    "源码兼容、数值正确、功能可用和性能可移植",
    "把模型与分片意图放在厂商适配层之上",
    "隔离自定义内核",
    "每个目标上重复同一套正确性与性能矩阵",
  ]) expect(flat).toContain(phrase);
});

test("MFU and HFU disclose every accounting convention", () => {
  for (const phrase of [
    "模型 FLOPs 利用率",
    "有用模型工作的解析估算值",
    "所选硬件峰值",
    "全局批次与序列形状",
    "稠密峰值",
    "结构化稀疏峰值",
    "活跃参数和路由词元的明确约定",
    "硬件 FLOPs 利用率",
    "重物化，也称为激活重计算",
    "重物化会让 HFU 高于 MFU",
    "二者都不是硬件计数器",
    "MFU 也不是诊断结果",
  ]) expect(flat).toContain(phrase);
});

test("the evidence ladder connects health components model and soak", () => {
  for (const phrase of [
    'data-chip="健康" data-title="1 · 确认系统健康"',
    'data-chip="内存" data-title="2 · 测量本地数据移动"',
    'data-chip="集合通信" data-title="3 · 扫描通信性能"',
    'data-chip="内核" data-title="4 · 分析算子"',
    'data-chip="模型" data-title="5 · 运行端到端负载"',
    'data-chip="长测" data-title="6 · 检验长期运行"',
    "把组件上限与端到端行为和长期运行连接起来",
  ]) expect(chapter).toContain(phrase);
});

test("the benchmark and operating record are reproducible", () => {
  for (const phrase of [
    "硬件 SKU 与修订版本",
    "驱动程序与固件",
    "编译器、框架和集合通信库版本",
    "精度与稀疏模式",
    "物理拓扑与超额订阅",
    "算法与协议",
    "预热轮次和测量轮次",
    "单向还是双向口径",
    "p50、p95 和 p99",
    "并发流",
    "功耗与温度",
    "单节点微基准不能证明集群扩展能力",
  ]) expect(flat).toContain(phrase);
  for (const field of [
    "hardware:",
    "software:",
    "workload:",
    "topology:",
    "measurements:",
    "health:",
  ]) expect(chapter).toContain(field);
});

test("operational diagnosis correlates all infrastructure identifiers", () => {
  for (const phrase of [
    "作业、rank、节点、加速器、NIC、交换机、机架供电和冷却域标识符",
    "集合通信超时可能源于软件排序错误、rank 失效、链路降级或拥塞",
    "单一利用率计数器无法区分这些原因",
    "可靠性和静默故障",
    "设施供电与冷却约束",
  ]) expect(flat).toContain(phrase);
});

test("regression scenarios cover performance failure and capacity edges", () => {
  for (const phrase of [
    "小消息延迟",
    "大消息带宽",
    "超额订阅上行链路",
    "链路降级",
    "rank 放置变化",
    "集合通信超时",
    "静默数据损坏",
    "热降频",
    "软件变更",
    "容量边界",
    "确定性的准入或失败行为",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion preserves moving boundaries and a vector of constraints", () => {
  for (const phrase of [
    "scale-up 边界正在变化",
    "不存在张量并行必须在某个固定设备数停止的永恒规则",
    "工作负载与实际部署系统的实测属性",
    "硬件确实会限制上层算法，但它通过一组约束共同限制",
    "可用内存、可持续本地流量、集合通信延迟、对分带宽、拓扑、功耗和故障域",
    "纸面上的并行方案只是一项假设",
    "指明边界、定义口径、测量真实形状，并保留上下文",
  ]) expect(flat).toContain(phrase);
});

test("legacy categorical shortcuts and invented artifacts are absent", () => {
  for (const phrase of [
    "一次训练运行的成败取决于带宽，而非峰值 FLOPs",
    "每往外走一步就相差一个数量级以上",
    "集合通信就完全消失在计算之下",
    "每层要用两次 all-reduce",
    "DP 每步只做一次梯度归约",
    "PP 每个阶段边界只做一次激活交接",
    "带宽鸿沟的必然后果",
    "TPU 的岔路：环面而非交换机",
    "nvlink_size = 8",
    "slowdown = 10.0",
  ]) expect(flat).not.toContain(phrase);
});
