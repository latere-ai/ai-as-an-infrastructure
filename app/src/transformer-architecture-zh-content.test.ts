import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/foundations/04-transformer-architecture.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/foundations/04-transformer-architecture.qmd", import.meta.url),
  "utf8",
);

test("Chapter 8 scopes an explicit causal-decoder contract", () => {
  expect(en).toContain("## Scope: a causal decoder");
  expect(zh).toContain("## 范围：因果解码器");
  for (const contract of [
    "T\\in\\{0,\\ldots,V-1\\}^{B\\times S}",
    "X_0\\in\\mathbb{R}^{B\\times S\\times d}",
    "W_U\\in\\mathbb{R}^{d\\times V}",
    "p(t_{i+1}=v\\mid t_{\\le i})",
    "编码器模型使用双向掩码",
    "权重绑定",
  ]) expect(zh).toContain(contract);
});

test("one residual stream receives two shape-preserving updates", () => {
  expect(zh).toContain("## 一个块会更新同一条残差流两次");
  expect(zh).toContain("A_\\ell &= \\operatorname{Attn}_\\ell");
  expect(zh).toContain("U_\\ell &= X_\\ell+A_\\ell");
  expect(zh).toContain("F_\\ell &= \\operatorname{FFN}_\\ell");
  expect(zh).toContain("X_{\\ell+1} &= U_\\ell+F_\\ell");
  expect(zh).toContain("不是独立的记忆模块");
  expect(zh).toContain("原始 Transformer 则在每次残差相加后做归一化");
  expect(zh).toContain("记录准确的块方程");
});

test("normalization and FFN sections define operations, shapes, and costs", () => {
  expect(zh).toContain("## 归一化控制尺度");
  expect(zh).toContain("\\operatorname{RMSNorm}(x)");
  expect(zh).toContain("累加精度，以及是否包含可学习偏置");
  expect(zh).toContain("QK 归一化解决的问题不同于残差流归一化");
  expect(zh).toContain("## 前馈网络提供逐位置容量");
  expect(zh).toContain("\\operatorname{SwiGLU}(x)");
  expect(zh).toContain("3dd_f");
  expect(zh).toContain("两矩阵前馈网络有 $2dd_f$ 个参数");
  expect(zh).toContain("三分之二");
  expect(zh).toContain("不是张量不变量");
});

test("causal attention states tensor shapes, masks, and head accounting", () => {
  expect(zh).toContain("## 带显式形状的因果自注意力");
  expect(zh).toContain("Q &\\in \\mathbb{R}^{S\\times H_q\\times d_h}");
  expect(zh).toContain("K,V &\\in \\mathbb{R}^{S\\times H_{kv}\\times d_h}");
  expect(zh).toContain("M_{ij}=-\\infty");
  expect(zh).toContain("填充、打包文档、滑动窗口和前缀语言模型需要不同的掩码");
  expect(zh).toContain("标准 MHA 因此使用 $4d^2$ 个投影参数");
  expect(zh).toContain("因果掩码把未来位置设为负无穷");
  expect(zh).toContain("掩码是注意力运算的一部分");
  expect(zh).toContain("这些数值不是从训练模型中测得的");
});

test("position handling defines RoPE and ALiBi without overclaiming", () => {
  expect(zh).toContain("## 位置信息通过查询和键进入注意力");
  expect(zh).toContain("\\omega_r &= \\theta^{-2r/d_R}");
  expect(zh).toContain("q_i'{}^\\top k_j' &= q_i^\\top R_{j-i}k_j");
  expect(zh).toContain("并不意味着完整注意力分数只由距离决定");
  expect(zh).toContain("更改它们属于适配实验，而不是元数据修改");
  expect(zh).toContain("ALiBi 不引入可学习的位置向量");
});

test("prefill and decode define cache state, work, and limits", () => {
  expect(zh).toContain("## 预填充创建缓存，解码复用缓存");
  expect(zh).toContain("第一遍就是 **@gls-prefill** 阶段：它一次读完整个提示词");
  expect(zh).toContain("第二阶段是 **@gls-decode**");
  expect(zh).toContain("M_{\\mathrm{KV}}");
  expect(zh).toContain("b\\sum_{r=1}^{B}S_r");
  expect(zh).toContain("稠密张量的有效载荷，不是进程总内存");
  expect(zh).toContain("TP+T^2");
  expect(zh).toContain("不会让长解码变成常数时间");
  expect(zh).toContain("不能把某一个交叉点说成 Transformer 的普遍属性");
  expect(zh).toContain("def kv_payload_bytes(sequence_length, kv_heads):");
});

test("MHA, GQA, and MQA alter KV sharing without universal quality claims", () => {
  expect(zh).toContain("## MHA、GQA 与 MQA 改变 KV 头的共享方式");
  expect(zh).toContain("$H_{kv}=H_q$");
  expect(zh).toContain("$H_{kv}=1$");
  expect(zh).toContain("$1<H_{kv}<H_q$");
  expect(zh).toContain("这些是精确的存储比例，不是质量结论");
  expect(zh).toContain("使用原始预训练算力的 5% 续训");
  expect(zh).toContain("不能证明某个 KV 头数适合所有模型和上下文长度");
});

test("MLA defines its cached representation and comparison boundary", () => {
  expect(zh).toContain("## MLA 改变缓存表示");
  expect(zh).toContain("c_i^{KV}\\in\\mathbb{R}^{d_c}");
  expect(zh).toContain("M_{\\mathrm{MLA}}=LBS(d_c+d_h^R)b");
  expect(zh).toContain("MLA 并非普遍比 MQA 更小");
  expect(zh).toContain("无需显式重建完整的逐头 K 和 V");
  expect(zh).toContain("不是潜在注意力支配 GQA 的普遍定理");
});

test("efficiency methods separate arithmetic, temporary memory, and state", () => {
  expect(zh).toContain("## 区分算术量、临时内存与持久状态");
  for (const row of ["| FlashAttention |", "| MQA / GQA |", "| MLA |", "| 训练式稀疏注意力 |"]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("不会自行改变解码时保留的历史键值元素数量");
  expect(zh).toContain("索引器仍以较小维度计算所有查询与键的分数");
  expect(zh).toContain("稀疏选择不会自动删除完整缓存");
  expect(zh).toContain("不存在脱离工作负载的单一效率前沿");
});

test("the architecture manifest and eight validation gates close the chapter", () => {
  expect(zh).toContain("## 把架构记录为一份契约");
  for (const field of [
    "词表规模、嵌入宽度、输出投影形状和权重绑定方式",
    "查询头数、KV 头数、头宽度，以及查询到 KV 的映射",
    "缓存表示、元素类型、量化尺度粒度，以及每词元有效载荷字节数",
  ]) expect(zh).toContain(field);
  expect(zh).toContain("## 在完整训练前完成验证");
  for (const gate of [
    "**核对形状与参数量。**",
    "**测试因果性。**",
    "**比较参考注意力实现。**",
    "**测试缓存等价性。**",
    "**测量缓存字节数。**",
    "**覆盖位置边界。**",
    "**消融架构选择。**",
    "**做端到端基准测试。**",
  ]) expect(zh).toContain(gate);
});

test("the rewrite removes stale certainty and the obsolete cache-frontier figure", () => {
  for (const rejected of [
    "已经定型的三项选择",
    "那唯一不肯定型的成本",
    "模型的大部分知识主要存放在这里",
    "如今成了默认",
    "现代的赢家",
    "RoPE 成了稠密模型的默认",
    "大多数现代大模型都让两者不绑定",
    "fig-cache-frontier",
  ]) expect(zh).not.toContain(rejected);
});

test("every Chapter 8 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("long Chapter 8 equations are decomposed for a mobile reading column", () => {
  for (const mobileBreak of [
    "r(x)=\\frac{x}{\\sqrt{\\frac{1}{d}\\sum_{j=1}^{d}x_j^2+\\varepsilon}}",
    "G(x)=\\operatorname{SiLU}(xW_g)",
    "\\alpha_{ij}^{(a)} &=\\operatorname{softmax}_{j}\\bigl(s_{ij}^{(a)}\\bigr)",
    "s_{ij}^{(a)} &=\\frac{q_i^{(a)\\top}k_j^{(a)}}{\\sqrt{d_h}} \\\\",
    "C_\\ell &= H_{kv,\\ell}(d_{k,\\ell}+d_{v,\\ell})",
  ]) expect(zh).toContain(mobileBreak);
});
