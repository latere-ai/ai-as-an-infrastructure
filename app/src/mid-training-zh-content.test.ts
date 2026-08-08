import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/foundations/07-mid-training.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/foundations/07-mid-training.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 11 defines an ordered run and names every phase field", () => {
  expect(zh).toContain("## 按作用命名训练阶段");
  expect(zh).toContain(String.raw`\mathcal R=(\mathcal P_0,\ldots,\mathcal P_K)`);
  expect(zh).toContain(String.raw`\mathcal P_i=(\mathcal O_i,\mathcal D_i,\eta_i,B_i,L_i)`);
  for (const phrase of [
    "$\\mathcal O_i$ 是训练目标",
    "$\\mathcal D_i$ 是数据分布",
    "$\\eta_i$ 是学习率调度",
    "$B_i$ 是词元预算",
    "$L_i$ 是训练采用的最大序列长度",
  ]) expect(zh).toContain(phrase);
  for (const row of [
    "| 宽泛预训练 | 大规模异构语料；自监督词元预测 | 形成通用基座能力 |",
    "| 中段训练 | 经过筛选或重新加权的语料，有时使用更长序列；通常沿用自监督目标 | 让基座检查点更接近后续目标 |",
    "| 后训练 | 示范、偏好、奖励、策略与安全数据 | 塑造行为接口 |",
  ]) expect(zh).toContain(row);
});

test("phase boundaries depend on role and supervision rather than one label", () => {
  expect(zh).toContain("训练流水线中的位置、数据与监督方式，以及它要改变的模型属性");
  expect(zh).toContain("继续预训练是一种方法");
  expect(zh).toContain("中段训练可以采用继续预训练");
  expect(zh).toContain("必须明确写出混合比例，不能从名称反推");
  expect(zh).toContain("更窄也更可靠的说法是：选得合适的桥接阶段，可以缩小后训练需要跨越的分布差距");
});

test("the boundary figure preserves the English operational handoff", () => {
  for (const phrase of [
    "宽泛预训练\\n异构数据\\n基座目标",
    "中段训练\\n筛选后的混合、调度\\n或训练长度",
    "后训练\\n示范、偏好、\\n奖励与策略",
    "服务中的模型\\n质量、延迟与策略",
    "能力桥接",
    "适配行为",
    "部署并评测",
  ]) expect(zh).toContain(phrase);
});

test("the distributional bridge accounts for cumulative specialist dose", () => {
  expect(zh).toContain("## 量化分布桥接");
  expect(zh).toContain(String.raw`\mathcal D_t=(1-\alpha_t)P+\alpha_t Q`);
  expect(zh).toContain(String.raw`\bar\alpha=\frac{1}{T}\sum_{t=1}^{T}\alpha_t`);
  expect(zh).toContain(String.raw`\bar\alpha=\frac{a(1-s)}{2}`);
  expect(zh).toContain("最终混合权重并不能说明专门数据的累计剂量");
  expect(zh).toContain("这个线性斜坡只用于核算，并不表示它是最佳调度");
  expect(zh).toContain("不能把「越早越好」当成普遍规律");
});

test("the Chinese mixture runnable executes exact token accounting", () => {
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
  expect(stdout).toContain("全程专门数据占比：6.0%");
  expect(stdout).toContain("专门数据词元：6.0B");
  expect(stdout).toContain("宽泛数据词元：94.0B");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("numpy");
});

test("data annealing and learning-rate decay remain separate interventions", () => {
  expect(zh).toContain("## 把数据调度与学习率调度分开");
  expect(zh).toContain(String.raw`\eta(t)=`);
  for (const phrase of [
    "$T_w$ 是预热结束的步骤",
    "$T_s$ 是开始衰减的步骤",
    "$T_e$ 是这条分支结束的步骤",
    "数据在训练末段发生变化，与学习率在训练末段衰减，是两项不同的干预",
    "来源检查点、优化器与调度器状态、新的数据清单、学习率路径、词元数和随机种子",
  ]) expect(zh).toContain(phrase);
});

test("quality annealing is a documented recipe rather than a universal law", () => {
  expect(zh).toContain("### 质量退火");
  expect(zh).toContain("前一阶段约占训练 FLOPs 的 90% 至 95%");
  expect(zh).toContain("最后 5% 至 10%");
  expect(zh).toContain("这证明了一套有记录的配方，并不等于「越干净的数据越应该放到最后」");
  for (const phrase of [
    "来源谱系",
    "过滤阈值",
    "文档与语言构成",
    "去重策略",
    "合成数据占比",
    "污染检查结果",
  ]) expect(zh).toContain(phrase);
});

test("domain mid-training reports lineage without assigning unsupported causality", () => {
  expect(zh).toContain("### 领域中段训练");
  expect(zh).toContain("约 3000 亿词元的仓库级长上下文训练");
  expect(zh).toContain("预衰减的 DeepSeek-Coder-Base-v1.5 7B 检查点");
  expect(zh).toContain("两者都没有单独测出混合中每一项数据的因果贡献");
  expect(zh).toContain("代理模型上的收益仍须迁移到目标模型和目标评测");
});

test("long-context mid-training separates position, data, and systems", () => {
  expect(zh).toContain("### 长上下文中段训练");
  expect(zh).toContain("并不是 Liu 等人的中段训练实验所覆盖的内容");
  expect(zh).toContain("位置方法、在新长度上包含依赖关系的数据，以及承担更长注意力的训练系统");
  expect(zh).toContain(String.raw`s=\frac{L_{\mathrm{ext}}}{L_{\mathrm{train}}}`);
  expect(zh).toContain(String.raw`m'=\frac{m}{s}`);
  expect(zh).toContain("YaRN 并不只是同一套线性映射");
  expect(zh).toContain("允许输入的长度，不等于训练长度或有效长度");
  for (const row of [
    "| 训练长度 | 梯度更新中实际出现过的最大序列长度 |",
    "| 接受长度 | 运行时允许输入的最大长度 |",
    "| 有效长度 | 在指定任务上达到既定质量阈值的最长输入 |",
    "| 可部署长度 | 在生产环境中同时满足显存和延迟要求的最长输入 |",
  ]) expect(zh).toContain(row);
});

test("long-context accounting preserves the exact dense-attention cost", () => {
  expect(zh).toContain(String.raw`N_{\mathrm{pairs}}`);
  expect(zh).toContain(String.raw`H\sum_i\frac{L_i(L_i+1)}{2}`);
  expect(zh).toContain("固定词元预算下，用少量长序列替换大量短序列");
  expect(zh).toContain("FlashAttention 不再物化完整分数矩阵，但不会消除这些稠密注意力计算");
});

test("the phase is designed as a controlled transfer experiment", () => {
  expect(zh).toContain("## 把中段训练设计成迁移实验");
  for (const branch of [
    "按相同词元预算继续使用宽泛数据",
    "完全切换到专门数据",
    "一种或多种混合调度",
    "直接进入后训练",
  ]) expect(zh).toContain(branch);
  for (const gate of [
    "**目标迁移：**",
    "**通用能力保留：**",
    "**后训练兼容性：**",
    "**长上下文利用：**",
    "**数据完整性：**",
  ]) expect(zh).toContain(gate);
  expect(zh).toContain("不能只用针尖检索题");
  expect(zh).toContain(String.raw`\Delta_P=J_P(\theta_{\mathrm{after}})-J_P(\theta_{\mathrm{before}})`);
  expect(zh).toContain("正的 $\\Delta_P$ 表示宽泛留出集上的损失变差");
});

test("the handoff contract records checkpoint lineage and evaluation evidence", () => {
  expect(zh).toContain("## 记录交接契约");
  for (const item of [
    "来源检查点与架构哈希",
    "优化器、调度器与精度状态",
    "按顺序排列的数据清单、权重、过滤器和采样调度",
    "按来源、语言、格式和序列长度桶统计的已训练词元数",
    "分词器版本、打包掩码、文档边界与位置编号策略",
    "训练长度以及所有 RoPE 或注意力参数",
    "污染报告与固定评测随时间的结果",
    "用于比较迁移效果的后训练配方版本",
  ]) expect(zh).toContain(item);
});

test("contested naming and lower-layer constraints remain bounded", () => {
  expect(zh).toContain("## 争议所在");
  expect(zh).toContain("是一个实用的工作术语，而不是已经稳定下来的科学边界");
  expect(zh).toContain("来源检查点、目标、混合分布、调度、词元预算、训练长度和预期交接对象");
  expect(zh).toContain("## 下层约束");
  expect(zh).toContain("能力桥接如果违反其中任何一项约束，就不会得到可部署的模型");
});

test("the diagnosis table routes symptoms to the correct layer", () => {
  expect(zh).toContain("## 先诊断问题所在的层，再投入训练");
  for (const row of [
    "| 专门文本上的留出损失很高 | 固定的专门与宽泛损失 | 领域阶段或混合阶段 |",
    "| 基座似然已经足够，但回复格式不对 | 示范数据与行为评测 | 后训练 |",
    "| 可以接收长输入，但证据越深，利用效果越差 | 长度与证据深度交叉的任务矩阵 | 长数据或位置训练，而不只是放大运行时上限 |",
    "| 质量保持不变，但长提示超出显存或延迟预算 | 显存与预填充分析 | 服务系统或注意力系统调整 |",
    "| 专门能力提升，同时宽泛能力退化 | 固定保留评测与累计混合剂量 | 降低专门数据占比、增加回放或更换来源检查点 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("把中段训练当成所有模型缺口的默认答案");
});

test("Chinese Chapter 11 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(
    uniqueMatches(en, /\/\/\| label: ([^\n]+)/g),
  );
  expect(uniqueMatches(zh, /data-viz="([^"]+)"/g)).toEqual(
    uniqueMatches(en, /data-viz="([^"]+)"/g),
  );
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe(
    (en.match(/:::: \{\.runnable\}/g) ?? []).length,
  );
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(
    uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g),
  );
});

test("the rewrite removes stale framing and unsupported causal claims", () => {
  for (const rejected of [
    "中段训练通常保留一部分通用数据",
    "引入时机比精确混合权重更重要",
    "学习率太低的后期高质量阶段，主要是在装点评测",
    "后训练无法可靠添加基座模型从未提供的能力",
    "最后一次用大词元预算重塑基座的机会",
    "@gls-next-token-prediction",
    "@gls-warmup-stable-decay",
    "@sec-inference-time-scaling",
    "@sec-sft-peft",
    "@sec-structured-long-context",
    "@sec-training-practice",
    "@sec-verifiable-rewards",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("the Chapter 11 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  const html = renderDot(
    graphviz,
    blocks[0][1],
    new Map(),
    "foundations/mid-training.html",
    "",
  );
  const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
