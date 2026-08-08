import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/foundations/05-moe-ssm-hybrids.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/foundations/05-moe-ssm-hybrids.qmd", import.meta.url),
  "utf8",
);

test("Chapter 9 separates expert activation from sequence mixing", () => {
  expect(zh).toContain("## 两条相互独立的架构轴");
  expect(zh).toContain("| FFN 参数激活 | 同一个稠密 FFN | 每个词元只路由到少数专家 | 存储参数与专家路径算术量的比例 |");
  expect(zh).toContain("MoE 改变参数激活方式，并不会让注意力变稀疏");
  expect(zh).toContain("状态空间层或线性递归层改变序列混合方式");
  expect(zh).toContain("存储参数、单个词元实际执行的算术量，以及一条序列需要保留的状态");
});

test("MoE routing is defined as a reproducible mathematical contract", () => {
  expect(zh).toContain("## MoE 让词元有条件地通过不同 FFN");
  expect(zh).toContain("### 路由是一项定义明确的数学运算");
  for (const formula of [
    "z_t &= W_rh_t",
    "\\mathcal{S}_t &= \\operatorname{TopK}(z_t,k)",
    "g_{t,e}=",
    "m_t=\\sum_{e=1}^{E}g_{t,e}F_e(h_t)",
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("有些系统在选择前做 softmax，有些在选择后做");
  expect(zh).toContain("这些选择会改变梯度和检查点语义");
});

test("the top-2 routing figure distinguishes routed and shared experts", () => {
  expect(zh).toContain('//| label: fig-moe-routing');
  expect(zh).toContain('label="top-2 选择"');
  expect(zh).toContain('label="其他专家\\n不执行"');
  expect(zh).toContain('label="可选的共享专家\\n（始终执行）"');
  expect(zh).toContain("共享专家不经过路由门控");
});

test("stored, selected, and evaluated parameters remain distinct", () => {
  expect(zh).toContain("### 存储参数、选中权重与运行时间不是一回事");
  for (const formula of [
    "P_e=3dd_f",
    "P_{\\mathrm{stored}} &= EP_e+Ed",
    "P_{\\mathrm{evaluated}}(t) &= kP_e+Ed",
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("活跃参数");
  expect(zh).toContain("不能直接当作实际运行时间");
  expect(zh).toContain("def moe_parameter_counts(experts):");
});

test("dispatch, capacity, and dropless execution are explicit", () => {
  expect(zh).toContain("### 路由会产生分发问题");
  expect(zh).toContain("一次用于分发，另一次用于返回");
  expect(zh).toContain("all-to-all 并不是 MoE 的固有要求");
  expect(zh).toContain("C_e=\\left\\lceil c\\frac{kT}{E}\\right\\rceil");
  expect(zh).toContain("跳过、改路由或延后");
  expect(zh).toContain("无丢弃的非齐整或块稀疏执行");
  expect(zh).toContain("这些指标都不能由“活跃参数”单独推出");
});

test("balancing and z-loss equations state their optimization tradeoffs", () => {
  expect(zh).toContain("### 均衡损失改变优化过程，而不只是利用率");
  for (const formula of [
    "\\mathcal{L}_{\\mathrm{bal}}",
    "f_e &= \\frac{1}{T}\\sum_{t=1}^{T}",
    "q_e &= \\frac{1}{T}\\sum_{t=1}^{T}p_{t,e}",
    "\\mathcal{L}_{z}",
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("偏置影响专家选择，不影响组合专家输出时使用的门控权重");
  expect(zh).toContain("不能据此说模型完全移除了所有均衡损失");
  expect(zh).toContain("这些是有实验依据的稳定手段");
});

test("routing refinements remain alternatives with bounded evidence", () => {
  expect(zh).toContain("### 不同改进解决不同的路由问题");
  for (const term of [
    "**Top-1 与 top-$k$。**",
    "**专家选择与均衡指派。**",
    "**细粒度专家与共享专家。**",
    "**稀疏升级改造。**",
  ]) expect(zh).toContain(term);
  expect(zh).toContain("“共享”这个名称并不能保证网络只学到了通用知识");
  expect(zh).toContain("不能据此确定普遍最优的专家数、$k$、容量系数或路由损失");
});

test("SSM exposition covers continuous, discrete, and convolution views", () => {
  expect(zh).toContain("## 状态空间层用递归替代不断增长的历史记录");
  expect(zh).toContain("### 从连续系统到离散层");
  expect(zh).toContain("\\frac{dh(t)}{dt} &= Ah(t)+Bx(t)");
  expect(zh).toContain("h_t &= \\bar A h_{t-1}+\\bar Bx_t");
  expect(zh).toContain("离散化后的转移矩阵和输入矩阵");
  expect(zh).toContain("### 固定系数使递归与卷积等价");
  expect(zh).toContain("K_i &= C\\bar A^{i}\\bar B");
  expect(zh).toContain("不能笼统地把所有 SSM 实现都说成简单的 $O(S)$");
});

test("Mamba selectivity is defined without making speed universal", () => {
  expect(zh).toContain("### Mamba 让递归具有选择性");
  for (const formula of [
    "(\\Delta_t,B_t,C_t) &= s_\\theta(x_t)",
    "\\bar A_t &= \\exp(\\Delta_tA)",
    "\\bar B_t &=",
    "h_t &= \\bar A_th_{t-1}+\\bar B_tx_t",
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("$\\Delta_t$、$B_t$ 和 $C_t$ 随输入变化，连续转移矩阵 $A$ 不随输入变化");
  expect(zh).toContain("不是与架构无关的速度比例");
});

test("linear attention and recurrent decode state have explicit boundaries", () => {
  expect(zh).toContain("### 线性注意力也是一条固定状态路线");
  expect(zh).toContain("S_t &= \\lambda_tS_{t-1}+\\phi(k_t)v_t^{\\top}");
  expect(zh).toContain("结合律分解，而不只是去掉 softmax");
  expect(zh).toContain("### 线性序列扩展不等于自动提速");
  expect(zh).toContain("它不是 FLOPs 或实测运行时间曲线");
  expect(zh).toContain("M_{\\mathrm{rec}}");
  expect(zh).toContain("不会随已缓存的上下文长度增长");
  expect(zh).toContain("两种机制都不保证召回");
});

test("hybrids specify schedules and scope model evidence", () => {
  expect(zh).toContain("## 混合架构选择层级排布");
  expect(zh).toContain('//| label: fig-moe-hybrid-stack');
  for (const model of ["| Jamba |", "| MiniMax-01 |", "| Qwen3-Next-80B-A3B |", "| Nemotron-H |"]) {
    expect(zh).toContain(model);
  }
  expect(zh).toContain("这些例子证明各部件能够在大规模下训练和实现");
  expect(zh).toContain("是一个团队的第一方证据，并不是反对递归或混合模型的普遍结论");
  expect(zh).toContain("不存在固定比例");
});

test("the contested boundary and lower-layer constraint match English", () => {
  expect(zh).toContain("## 争议所在");
  expect(zh).toContain("问题不在于次二次复杂度的混合器能否运行");
  expect(zh).toContain("需要在数据、词元数、参数量、训练算力、内核、硬件、上下文长度和服务功能上做匹配");
  expect(zh).toContain("## 下层约束");
  expect(zh).toContain("专家放置、分发流量和设备拓扑上的负载不均衡");
  expect(zh).toContain("只有分布式实现和服务实现真正兑现了节省，渐近优势才有意义");
});

test("the architecture contract and eight validation gates close the chapter", () => {
  expect(zh).toContain("## 把稀疏与递归架构记录成一份契约");
  for (const field of [
    "哪些层使用注意力、SSM、线性注意力或其他混合器",
    "路由打分、归一化、top-$k$ 平局处理",
    "专家放置、专家并行组、分发集合通信",
  ]) expect(zh).toContain(field);
  expect(zh).toContain("## 在扩大规模前分别验证两条轴");
  for (const gate of [
    "**核对参数量。**",
    "**精确测试路由。**",
    "**测量负载分布。**",
    "**测量通信。**",
    "**比较扫描与递归。**",
    "**测试状态边界。**",
    "**压力测试检索与状态跟踪。**",
    "**对完整工作负载做基准测试。**",
  ]) expect(zh).toContain(gate);
});

test("Chinese Chapter 9 preserves the English artifact and citation contract", () => {
  const dots = (source: string) => [...source.matchAll(/```\{dot\}/g)].length;
  const viz = (source: string) => [...source.matchAll(/data-viz="([^"]+)"/g)].map((m) => m[1]).sort();
  const figures = (source: string) => [...source.matchAll(/\/figures\/(moe-ssm-hybrids-[^)]+\.svg)/g)].map((m) => m[1]).sort();
  const citations = (source: string) => [...new Set(source.match(/@[A-Za-z0-9_-]+/g) ?? [])].sort();
  expect(dots(zh)).toBe(dots(en));
  expect(viz(zh)).toEqual(viz(en));
  expect(figures(zh)).toEqual(figures(en));
  expect(citations(zh)).toEqual(citations(en));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe(1);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe(2);
});

test("the rewrite removes categorical and machine-like legacy claims", () => {
  for (const rejected of [
    "容量和每词元计算量绑定在一起，想增加容量，就只能增加计算",
    "这个微小的映射是唯一真正新增的组件",
    "如今这一对已是大型开放 MoE 模型的常见默认配置",
    "直接把辅助损失去掉",
    "$k=2$ 是常见的最佳折中",
    "同规模下，MoE 的损失曲线比稠密曲线更容易出现尖峰",
    "迄今每个强劲的长上下文系统都保留一些全注意力层",
    "@fig-moe-lineage",
    "fig-moe-lineage",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("every Chinese Chapter 9 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const html = renderDot(graphviz, block[1], new Map(), "foundations/moe-ssm-hybrids.html", "");
    const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
