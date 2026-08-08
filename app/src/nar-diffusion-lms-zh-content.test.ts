import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/generative/02-nar-diffusion-lms.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/02-nar-diffusion-lms.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 13 preserves the complete English section architecture", () => {
  for (const heading of [
    "## 把概率分解与执行方案分开",
    "## 为什么独立草稿会混合有效译法",
    "## 迭代精修早于扩散语言模型",
    "## 在类别状态上定义扩散",
    "## 推导掩码扩散的训练损失",
    "## 区分具体分数的输出缓存与 KV 缓存",
    "## 分块同时恢复变长生成与前缀缓存",
    "## 限定规模化结果的证据范围",
    "## 评测部署后的生成器，而不是方法标签",
    "## 争议所在",
    "## 下层约束",
    "## 延伸阅读",
  ]) expect(zh).toContain(heading);
  expect((zh.match(/^\$\$$/gm) ?? []).length).toBe((en.match(/^\$\$$/gm) ?? []).length);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe((en.match(/^\|---/gm) ?? []).length);
});

test("the opening separates non-autoregression diffusion and serving cost", () => {
  for (const phrase of [
    "两种思路有所重叠，却不是同义词",
    "单次翻译模型可以是非自回归模型，却不是扩散模型",
    "块扩散模型则可以在块与块之间保持自回归",
    "这并不意味着计算量会缩小为原来的",
    "依赖深度、模型总工作量、输出长度处理方式，以及统一服务条件下的质量",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("这里比较的是算法依赖深度，不是实测延迟或总计算量");
});

test("factorization and refinement expose their execution contracts", () => {
  for (const formula of [
    String.raw`p_\theta(y\mid c)`,
    String.raw`p_\theta(y\mid c,L,z)`,
    String.raw`p_\theta\!\left(y^{(k-1)}\mid y^{(k)},c\right)`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("因果 @gls-kv-cache");
  expect(zh).toContain("一旦选定 $L$ 和 $z$，所有位置就可以在一次模型评估中同时打分");
  for (const row of [
    "| 因果自回归 | $L$ | 利用缓存前缀处理一个新位置 | 停止词元 |",
    "| 单次非自回归 | $1$ | 所有 $L$ 个位置 | 预测长度或潜在长度 |",
    "| 迭代精修 | $K$ | 通常处理许多或全部位置 | 固定、预测、插入或折叠 |",
    "| 块扩散 | $K\\lceil L/B\\rceil$ | 一个最多含 $B$ 个位置的块 | 持续追加块，直到满足停止条件 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("这张表计算的是依赖深度，不是 FLOPs 或实际耗时");
});

test("translation ambiguity and distillation claims remain bounded", () => {
  expect(zh).toContain("每个位置的边缘分布都可能合理，联合起来的句子却不合理");
  expect(zh).toContain("根本问题是条件独立假设，并不是所有非自回归模型必然失败");
  expect(zh).toContain("序列级知识蒸馏会把一组人工参考译文替换成分布更窄的教师输出");
  expect(zh).toContain("这是一项经验代理指标和容量趋势，并不是关于真实序列熵的一般定理");
  expect(zh).toContain("蒸馏曾是经典非自回归翻译的核心做法，却并不是所有并行生成方法在数学上的必要条件");
  expect(zh).toContain("教师模型、教师的解码方法，以及评测使用人工参考还是教师输出");
});

test("pre-diffusion refinement methods keep their distinct operations", () => {
  for (const row of [
    "| Mask-Predict | 掩掉低置信度位置，再次预测 | 精修前先预测长度 | 固定次数的精修轮 |",
    "| Levenshtein Transformer | 交替执行删除、占位符插入与词元填充 | 让序列增长或缩短 | 编辑迭代 |",
    "| 基于 CTC 的解码 | 发出空白和重复标签，再折叠单调对齐 | 对所有兼容对齐求和 | 通常一轮或少数几轮模型评估 |",
    "| Glancing Transformer | 训练时展示一部分参考词元 | 推断时预测长度 | 单次形式在推断时无需迭代 |",
    "| SUNDAE | 在展开的去噪步骤上训练，并反复修复词元序列 | 通常固定输出画布 | 去噪迭代 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("草拟、掩码、插入、删除、折叠与精修");
  expect(zh).toContain("不会因为使用掩码就自动继承扩散模型的似然下界");
});

test("categorical diffusion defines its state transition and endpoints", () => {
  for (const formula of [
    String.raw`q(x_t\mid x_{t-1})`,
    String.raw`\operatorname{Cat}(x_t;Q_t x_{t-1})`,
    String.raw`\bar Q_t&=Q_tQ_{t-1}\cdots Q_1`,
    String.raw`q(x_t\mid x_0)`,
    String.raw`\pi_t(x)=\alpha_t x+(1-\alpha_t)m`,
    String.raw`\alpha_0=1`,
    String.raw`\alpha_1=0`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("前向过程通常独立扰动每个词元位置，逆向模型却会读取整个受扰序列");
  expect(zh).toContain("连续嵌入扩散是另一条路线");
  expect(zh).toContain("两条路线的结果不能合并成同一个质量结论");
});

test("the masked diffusion loss explains every term and its scope", () => {
  for (const formula of [
    String.raw`\ell_\theta(x,z_t)`,
    String.raw`\mathcal L_{\mathrm{MDLM}}`,
    String.raw`\frac{-\alpha_t'}{1-\alpha_t}`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("$i$ 只遍历当前等于掩码 $m$ 的位置");
  expect(zh).toContain("训练会采样时间与掩码模式，而不是精确计算这个积分");
  expect(zh).toContain("干净端点处看似存在的奇点要按极限理解");
  expect(zh).toContain("一组按扰动程度加权的掩码语言模型损失");
  expect(zh).toContain("现有掩码语言模型并不会自动变成完整的生成器");
});

test("generation defines reveal carry-over and length handling", () => {
  expect(zh).toContain("生成从一张含有 $L$ 个掩码的输出画布开始");
  expect(zh).toContain("吸收态逆向参数化会把已经确定的词元原样带到下一步");
  expect(zh).toContain("祖先采样器不必重新掩掉已经确定的词元");
  expect(zh).toContain("最后一步必须消除所有剩余掩码");
  expect(zh).toContain("长度 $L$ 仍要预先选择、另行预测，或交给分块扩展处理");
});

test("SEDD and RADD distinguish model-output caching from a causal KV cache", () => {
  for (const formula of [
    String.raw`s_t(x)_y=\frac{p_t(y)}{p_t(x)}`,
    String.raw`\frac{p_t\!\left(x_t^{i\leftarrow y}\right)}{p_t(x_t)}`,
    String.raw`p_0\!\left(X_i=y\mid X_U=x_{t,U}\right)`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("一次完整序列的扩散评估与一次使用缓存的自回归词元步骤成本并不相等");
  expect(zh).toContain("模型输出可以在下一个时间点复用");
  expect(zh).toContain("这是状态不变时的模型输出缓存，与因果 KV 缓存不同");
  expect(zh).toContain("表示上的等价并不意味着执行方案等价");
});

test("block diffusion restores stable-prefix caching and executable accounting", () => {
  expect(zh).toContain("已完成的块形成稳定前缀，因此可以缓存其 KV 状态");
  expect(zh).toContain("生成也可以持续追加任意数量的块");
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("自回归：依赖评估=128，位置预测=128");
  expect(stdout).toContain("完整掩码：依赖评估=8，位置预测=1024");
  expect(stdout).toContain("块扩散：依赖评估=64，位置预测=1024");
  expect(cell![1]).toContain("ceil(length / block_size) * rounds");
  expect(cell![1]).not.toContain("numpy");
});

test("scale demonstrations remain scoped by construction", () => {
  for (const row of [
    "| LLaDA 8B | 可以从头预训练掩码扩散模型，并进行指令微调 | 在数据与计算匹配时，与外部训练的 8B 自回归模型持平 |",
    "| Dream 7B | 可以用自回归权重初始化扩散模型 | 仅靠扩散预训练也能得到同样结果 |",
    "| LLaDA-MoE | 可以用约 20T 词元训练总参数 7B、激活参数 1.4B 的稀疏扩散模型 | 与匹配的稀疏自回归训练成本或质量相同 |",
    "| LLaDA 2.0 | 转换后的自回归 MoE 权重可以产生总参数最多 100B 的扩散模型 | 从头训练了一个 100B 扩散模型 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("它们并没有形成一项只改变概率分解方式的受控比较");
  expect(zh).toContain("这些是关于训练路线、激活计算量和模型总容量的不同结论");
  expect(zh).toContain("并不是可以迁移到整个模型类别上的速度倍数");
});

test("evaluation fixes one complete decoding contract", () => {
  for (const dimension of [
    "| 质量 |",
    "| 依赖结构 |",
    "| 工作量 |",
    "| 延迟 |",
    "| 吞吐量 |",
    "| 硬件 |",
    "| 输出策略 |",
  ]) expect(zh).toContain(dimension);
  expect(zh).toContain("分词器不同时，困惑度不能直接比较");
  expect(zh).toContain("字符或字节吞吐量可以作为补充");
  expect(zh).toContain("没有稳定前缀的系统，与首词元时间较低的流式自回归系统仍会带来不同体验");
  for (const workload of [
    "开放式流式对话",
    "定长内容填补或受约束编辑",
    "有严格延迟目标的翻译",
    "批量代码补全",
    "任意顺序补全",
  ]) expect(zh).toContain(workload);
});

test("contested claims and lower-layer constraints remain measurable", () => {
  expect(zh).toContain("在控制质量、硬件、输出长度和服务软件之后，扩散语言模型能否胜过自回归仍无定论");
  expect(zh).toContain("参数量与作者自行报告的吞吐量都不能证明前沿质量或成本匹配下的持平");
  expect(zh).toContain("现有证据只说明可选设计更多，并不能确定谁会成为继任者");
  expect(zh).toContain("决定性指标是网络评估次数、重新计算的位置数量、缓存字节数、内存带宽、批大小和内核");
  expect(zh).toContain("「八轮」只是算法描述，并不是服务结果");
});

test("Chinese Chapter 13 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g));
  expect(uniqueMatches(zh, /\/figures\/([^\s)]+)/g)).toEqual(uniqueMatches(en, /\/figures\/([^\s)]+)/g));
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(uniqueMatches(en, /\/\/\| label: ([^\n]+)/g));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe((en.match(/:::: \{\.runnable\}/g) ?? []).length);
});

test("the rewrite removes stale machine-like and unsupported claims", () => {
  for (const rejected of [
    "这一章继续讨论这条线索",
    "它们的优势在延迟和双向上下文",
    "这之所以是必需、而非仅仅有益",
    "Mask-Predict 是一个还没把自己叫作扩散的离散扩散采样器",
    "这个领域最深的结果",
    "一个掩码扩散语言模型就是一个掩码语言模型",
    "这个非自回归模型，归根到底，是去掉固定顺序约束后的自回归",
    "这条路线也已经进入商业系统",
    "每一个前沿模型仍是自回归的",
    "到 2026 年",
    "@geminidiffusion2025",
    "@gls-fertility",
    "@sec-memory-scheduling",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("the localized relation graph fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  expect(zh).toContain("rankdir=TB;");
  expect(zh).not.toContain("rankdir=LR;");
  for (const label of [
    "自回归\\n每步一个词元\\n缓存因果前缀",
    "块扩散\\n块间保持因果\\n块内并行去噪",
    "完整掩码扩散\\n固定画布\\n多轮并行精修",
  ]) expect(zh).toContain(label);
  const graphviz = await loadGraphviz();
  const html = renderDot(graphviz, blocks[0][1], new Map(), "generative/nar-diffusion-lms.html", "");
  const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
