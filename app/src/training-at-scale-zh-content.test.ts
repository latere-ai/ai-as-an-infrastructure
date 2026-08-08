import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/foundations/06-training-at-scale.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/foundations/06-training-at-scale.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 10 begins from one reproducible optimizer-step contract", () => {
  expect(zh).toContain("## 从一个逻辑优化器步骤开始");
  expect(zh).toContain(String.raw`B_{\mathrm{global}} = DmB_\mu`);
  expect(zh).toContain(String.raw`g &= \frac{1}{D}\sum_{r=1}^{D}g_r`);
  expect(zh).toContain(String.raw`g_r &= \frac{1}{B_{\mathrm{global}}/D}`);
  expect(zh).toContain("局部批大小不同时，不能对各副本的均值做等权平均");
  expect(zh).toContain("位级一致是更强的要求");
});

test("model-state accounting distinguishes persistent and peak memory", () => {
  expect(zh).toContain("## 核算模型状态显存");
  for (const row of [
    "| DDP | 不切分 | $P_\\theta(b_w+b_g+b_o)$ |",
    "| ZeRO 第 1 阶段 | 优化器状态 | $P_\\theta(b_w+b_g+b_o/D)$ |",
    "| ZeRO 第 2 阶段 | 优化器状态和梯度 | $P_\\theta[b_w+(b_g+b_o)/D]$ |",
    "| ZeRO 第 3 阶段 | 参数、梯度和优化器状态 | $P_\\theta(b_w+b_g+b_o)/D$ |",
  ]) expect(zh).toContain(row);
  for (const formula of [
    String.raw`M_{\mathrm{peak}}`,
    "P_u b_w",
    String.raw`M_{\mathrm{act}}`,
    String.raw`M_{\mathrm{tmp}}`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("持久状态估算，不是峰值显存估算");
  expect(zh).toContain("数据类型是配方选择，并不是 Adam 的常数");
});

test("tensor parallelism defines its layer cut and placement boundary", () => {
  expect(zh).toContain("### 张量并行：切开单层");
  expect(zh).toContain(String.raw`H_r &= \phi(XW_1^{(r)})`);
  expect(zh).toContain(String.raw`Z &= \sum_{r=1}^{T}H_rW_2^{(r)}`);
  expect(zh).toContain("每个 Transformer 层的前向传播需要两次 all-reduce");
  expect(zh).toContain("这是一条放置原则，不是一条定律");
});

test("pipeline parallelism keeps the exact bubble denominator and scope", () => {
  expect(zh).toContain("### 流水线并行：切开层栈");
  expect(zh).toContain(String.raw`f_{\mathrm{bubble}}=\frac{p-1}{m+p-1}`);
  expect(zh).toContain("$(p-1)/m$ 是气泡时间相对于理想计算时间的比值");
  expect(zh).toContain("这个公式适合估算规模，不适合预测实测吞吐");
  expect(zh).toContain("1F1B 调度");
  expect(zh).toContain("异步调度和权重版本");
  expect(zh).toContain("p=32, m=32:");
  expect(zh).not.toContain("matplotlib");
  expect(zh).not.toContain("numpy");
});

test("the Chinese pipeline runnable executes without plotting dependencies", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("p=32, m=32: 49.2%");
});

test("sequence and context parallelism remain distinct mechanisms", () => {
  expect(zh).toContain("### 序列并行与上下文并行：切开词元");
  expect(zh).toContain("序列并行（SP）");
  expect(zh).toContain("通常不会成为设备网格里的另一个乘数");
  expect(zh).toContain("上下文并行（CP）");
  expect(zh).toContain("稠密注意力在全局仍要执行 $O(L^2)$ 算术");
  expect(zh).toContain("最大上下文仍受总显存、通信、设备数和通信计算重叠程度限制");
});

test("expert parallelism states dispatch, return, and imbalance costs", () => {
  expect(zh).toContain("### 专家并行：切开条件参数");
  expect(zh).toContain("前向传播通常包含一次分发交换和一次合并交换");
  expect(zh).toContain("热门专家会制造慢节点");
  expect(zh).toContain("路由局部性、负载均衡、可选的容量填充和无丢弃内核");
});

test("the parallel-axis figure preserves all seven English rows", () => {
  for (const phrase of [
    "DDP｜切分批；模型状态复制",
    "ZeRO-3 / 全分片 FSDP｜切分批和全部持久模型状态",
    "TP｜切分单层内的矩阵乘法",
    "PP｜切分连续的层组",
    "SP｜切分 TP 原本复制的激活区域",
    "CP｜切分注意力中的序列",
    "EP｜切分专家参数和路由词元",
  ]) expect(zh).toContain(phrase);
});

test("the parallel-axis graph isolates collective names from CJK fallback text", () => {
  const block = zh.match(
    /```\{dot\}\n\/\/\| label: fig-training-axes[\s\S]*?```/,
  )?.[0];
  expect(block).toBeDefined();
  expect(block).toMatch(/node \[[^\]]*width=2\.20/);

  const labels = [...block!.matchAll(/label="([^"]+)"/g)].map((match) =>
    match[1].split(String.raw`\n`),
  );
  expect(labels).toHaveLength(7);

  const collectiveLines = labels
    .flat()
    .filter((line) => /(?:all-|reduce-)/.test(line));
  expect(collectiveLines.length).toBeGreaterThan(0);
  for (const line of collectiveLines) {
    expect(line).not.toMatch(/[\u3400-\u9fff]/);
    expect(line.length).toBeLessThanOrEqual(16);
  }
});

test("the device mesh distinguishes logical groups from physical placement", () => {
  expect(zh).toContain("## 把各条切分轴映射到网络");
  expect(zh).toContain("N = D T p C");
  expect(zh).toContain("SP 通常复用 $T$ 组");
  expect(zh).toContain("盲目再乘一个专家并行度会重复计算设备");
  for (const phrase of [
    "all-reduce 会归约数值，并把结果交给每个 rank",
    "reduce-scatter 会归约数值，但每个 rank 只保留一个分片",
    "all-gather 会在每个 rank 上拼接所有分片",
    "all-to-all 会向每个对端发送不同的分片",
    "只有暴露在关键路径上的部分才会延长步骤时间",
  ]) expect(zh).toContain(phrase);
});

test("the lower-layer constraint remains topology-dependent", () => {
  expect(zh).toContain("## 下层约束");
  expect(zh).toContain("物理网络限制着逻辑网格");
  expect(zh).toContain("在一个集群上调好的网格，并不会自动适用于另一个集群");
});

test("numerical formats are selected per operation with bounded evidence", () => {
  expect(zh).toContain("## 按操作选择数值格式");
  expect(zh).toContain("混合精度不是一种全局 dtype");
  expect(zh).toContain("通常无需 FP16 那样的损失缩放");
  expect(zh).toContain("E4M3 把更多位用于精度，E5M2 把更多位用于范围");
  expect(zh).toContain("缩放粒度也是配方的一部分");
  expect(zh).toContain("这些都是经过实测的具体配方，不能证明所有模型或操作都能安全降到相同精度");
});

test("the update order and contested precision boundary are explicit", () => {
  expect(zh).toContain("稳健的更新必须明确规定顺序");
  for (const step of [
    "累积完所有微批",
    "解除 FP16 梯度缩放",
    "跨所有 rank 检查数值是否有限",
    "计算全局梯度范数",
    "按配置裁剪",
    "让所有分片一起更新或一起跳过更新",
  ]) expect(zh).toContain(step);
  expect(zh).toContain("最低的可靠训练精度取决于具体配方");
  expect(zh).toContain("不能据此确定普遍适用的精度下限");
});

test("MFU, HFU, and end-to-end goodput are not conflated", () => {
  expect(zh).toContain("## 吞吐测量必须写清假设");
  expect(zh).toContain(String.raw`\mathrm{MFU}=`);
  expect(zh).toContain(String.raw`r_{\mathrm{tok}}F_{\mathrm{model,tok}}`);
  expect(zh).toContain(String.raw`N P_{\mathrm{peak}}`);
  expect(zh).toContain("HFU 还会计入激活重算等实际执行的 FLOPs");
  expect(zh).toContain("两个指标都不能证明训练质量或可靠性");
  expect(zh).toContain("端到端有效吞吐还应计入失败步骤、检查点、评测暂停和输入停顿");
});

test("restart is a tested correctness property", () => {
  expect(zh).toContain("## 把正确重启纳入正确性要求");
  expect(zh).toContain("可恢复的检查点是一个原子集合，不只是一份参数文件");
  expect(zh).toContain("确定性重放");
  expect(zh).toContain("覆盖等价恢复");
  expect(zh).toContain(String.raw`W(\tau)`);
  expect(zh).toContain(String.raw`\tau^\star&\approx\sqrt{2CM}`);
  expect(zh).toContain("异步检查点会降低暴露的 $C$，但仍会消耗设备链路、主机内存、网络和存储带宽");
});

test("six validation gates close with bounded FlashAttention accounting", () => {
  expect(zh).toContain("## 长跑前验证布局");
  for (const gate of [
    "**更新等价性：**",
    "**显存核算：**",
    "**通信核算：**",
    "**数值稳定性：**",
    "**重启正确性：**",
    "**有效吞吐：**",
  ]) expect(zh).toContain(gate);
  expect(zh).toContain(String.raw`M_{\mathrm{score}} = BHL^2b`);
  expect(zh).toContain("不会消除稠密注意力的算术量，也不会取消对超长上下文做切分的需要");
});

test("Chinese Chapter 10 preserves the English artifact and citation contract", () => {
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(
    uniqueMatches(en, /\/\/\| label: ([^\n]+)/g),
  );
  expect(uniqueMatches(zh, /data-viz="([^"]+)"/g)).toEqual(
    uniqueMatches(en, /data-viz="([^"]+)"/g),
  );
  expect(uniqueMatches(zh, /\]\((\/figures\/[^)]+)\)/g)).toEqual(
    uniqueMatches(en, /\]\((\/figures\/[^)]+)\)/g),
  );
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe(
    (en.match(/:::: \{\.runnable\}/g) ?? []).length,
  );
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(
    uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g),
  );
});

test("the rewrite removes unsupported legacy claims and stale detours", () => {
  for (const rejected of [
    "上下文于是几乎可以无界地增长",
    "bf16 是保守的默认值",
    "fp8 成了主力",
    "fp32 主权重对优化器来说没有商量余地",
    "TP 通常限制在节点内",
    "理想情况下落到备用容量上，不必整体重启",
    "@hu2025fp4",
    "@xu2021gspmd",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("every Chapter 10 Graphviz figure fits the mobile reading column in production", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const html = renderDot(graphviz, block[1], new Map(), "foundations/training-at-scale.html", "");
    const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
