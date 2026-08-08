import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/generative/04-multimodal-models.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/04-multimodal-models.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 15 preserves the complete English section architecture", () => {
  for (const heading of [
    "## 分开考虑各项设计选择",
    "## 学习图像与文本的配对几何",
    "## 把视觉接入语言模型",
    "### 计算视觉序列长度",
    "## 引导图像生成器",
    "## 选择图像表示与训练目标",
    "## 压缩视频的空间与时间",
    "## 分开考虑系统集成与表示方式",
    "## 评测实际准备交付的能力边界",
    "## 争议所在",
    "## 下层约束",
    "## 延伸阅读",
  ]) expect(zh).toContain(heading);
  expect((zh.match(/^\$\$$/gm) ?? []).length).toBe((en.match(/^\$\$$/gm) ?? []).length);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe((en.match(/^\|---/gm) ?? []).length);
});

test("the opening separates multimodal interfaces from architecture labels", () => {
  for (const phrase of [
    "多模态带来的是接口，不是某一种架构",
    "图像以网格形式进入系统，文本是序列，音频是带时间的帧",
    "这些决定彼此相关，却不能相互替代",
    "所谓「统一多模态模型」其实隐藏着几项彼此独立的选择",
  ]) expect(zh).toContain(phrase);
});

test("the design table keeps representation fusion objective and composition distinct", () => {
  for (const row of [
    "| <span style=\"white-space: nowrap\">输入表示</span> | 模型的输入是什么？ | 像素、编码器特征、离散码、连续潜变量 |",
    "| <span style=\"white-space: nowrap\">融合</span> | 不同模态在哪里交换信息？ | 输入投影、交叉注意力、早期融合 |",
    "| <span style=\"white-space: nowrap\">输出模型</span> | 用什么目标生成该模态？ | 下一词元预测、扩散、流匹配 |",
    "| <span style=\"white-space: nowrap\">系统组合</span> | 哪些组件共享权重和部署？ | 专用工具、相连的双塔模型、单一主干 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("连续图像潜变量不等于离散图像词元");
  expect(zh).toContain("早期融合也不等于端到端产品集成");
});

test("the mobile design table keeps short Chinese row labels intact", () => {
  for (const label of ["决策", "输入表示", "融合", "输出模型", "系统组合"]) {
    expect(zh).toContain(`<span style="white-space: nowrap">${label}</span>`);
  }
});

test("paired geometry preserves CLIP SigLIP and modality-gap boundaries", () => {
  for (const formula of [
    String.raw`s_{ij}=\frac{v_i^\top t_j}{\tau}`,
    String.raw`\mathcal{L}_{\mathrm{CLIP}}`,
    String.raw`\log\frac{\exp(s_{ii})}{\sum_{j=1}^{B}\exp(s_{ij})}`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("@gls-clip，也就是让图像与文本成对学习的训练方法");
  expect(zh).toContain("批内其他样本都作为负例，但非对角图文对仍可能在语义上匹配");
  expect(zh).toContain("提示词的措辞和预训练分布仍然是分类器的一部分");
  expect(zh).toContain("SigLIP 改变的是批次目标，并不是嵌入的含义");
  expect(zh).toContain("CLIP 对齐的是配对样本，并不强制两种模态具有相同分布");
  expect(zh).toContain("这种几何间隙不同于连接器的接口不匹配");
});

test("vision connectors preserve depth bottleneck and training-stage differences", () => {
  for (const row of [
    "| Flamingo 交叉注意力 | 语言模型多个层中的重采样视觉记忆 | 可反复读取丰富信息，但需插入更多层 |",
    "| BLIP-2 Q-Former | 由 32 个查询生成的固定长度摘要 | 成本可预测，但存在固定瓶颈 |",
    "| LLaVA 投影 | 输入端的投影图块序列 | 桥接简单，成本随图块数增长 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("门控参数初始化为零，因此新增路径起初不会改变语言模型");
  expect(zh).toContain("固定的查询数让接口成本可以预测，也造成了明确的信息瓶颈");
  expect(zh).toContain("连接器的名称本身不能说明哪些权重参与训练");
});

test("visual sequence accounting reaches prefill cache and instruction tuning", () => {
  expect(zh).toContain("单次裁剪的 @gls-vit 大约会输出");
  expect(zh).toContain(String.raw`N_{\mathrm{vis}}`);
  expect(zh).toContain(String.raw`\left\lceil\frac{H}{P}\right\rceil`);
  expect(zh).toContain(
    "336×336 像素的图像配合边长 14 像素的图块，会产生 $" +
      String.raw`24\times24=576` +
      "$ 个图块位置",
  );
  expect(zh).toContain("视觉词元数是一项服务决策，不只是编码器细节");
  expect(zh).toContain("配对预训练学习对应关系，连接器训练学习接口，指令微调则教模型如何回答");
});

test("classifier-free guidance states its convention cost and limitations", () => {
  expect(zh).toContain("理解图像与生成图像面对的是不同的输出问题");
  expect(zh).toContain(String.raw`\widehat{\epsilon}_\theta(z_t,c)`);
  expect(zh).toContain(String.raw`\epsilon_\theta(z_t,\varnothing)`);
  expect(zh).toContain("在这种约定下，$s=0$ 给出无条件预测，$s=1$ 给出普通条件预测");
  expect(zh).toContain("只有连同公式，引导尺度才有明确含义");
  expect(zh).toContain("引导尺度不是置信度");
});

test("image routes separate representation objective data and sampling claims", () => {
  for (const row of [
    "| 像素 | 级联扩散 | 无需学习压缩，但空间成本高 |",
    "| 连续自编码器潜变量 | 潜空间扩散或修正流 | 成本较低，但受重建上限约束 |",
    "| 离散码本索引 | 自回归或掩码词元模型 | 可使用语言模型目标，但受量化上限约束 |",
    "| 语义图像嵌入 | unCLIP 先验加解码器 | 把语义选择与渲染分开 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("这只说明在该设置中改善了监督，不代表合成标签总是更好");
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{RF}}`);
  expect(zh).toContain("直线训练路径并不保证一步采样");
  expect(zh).toContain("流匹配改变的是目标；速度仍由采样器、函数求值次数、自编码器和硬件共同决定");
  expect(zh).toContain("潜变量不会因为被模型处理就自动变成词元");
});

test("video accounting and runnable reproduce the English Movie Gen example", () => {
  expect(zh).toContain(String.raw`N_{\mathrm{video}}`);
  expect(zh).toContain(String.raw`\left\lceil\frac{T}{d_t p_t}\right\rceil`);
  expect(zh).toContain("这个公式只用于核算，不是质量估计");
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "原始时空位置：150,994,944",
    "潜空间位置：294,912",
    "Transformer 词元：73,728",
    "位置数缩减：2,048 倍",
  ]);
  expect(cell![1]).toContain("compression = (8, 8, 8)");
  expect(cell![1]).toContain("patch = (1, 2, 2)");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});

test("video evidence separates compression synchronization and understanding", () => {
  expect(zh).toContain("早期视频扩散设计用时空分解的 3D UNet 扩展图像模型");
  expect(zh).toContain("Sora 的 2024 年技术报告介绍了作用于时空潜块且支持可变视频形状的扩散 Transformer，但公开信息不足以复现该系统");
  expect(zh).toContain("同步输出并不意味着画面和音频来自同一个联合采样器");
  expect(zh).toContain("压缩改变的是表示成本，不是语义理解能力");
});

test("integration remains independent from representation and loss", () => {
  expect(zh).toContain("模块化程度与表示方式是两项不同的选择");
  expect(zh).toContain("这些结果不能证明每个统一模型都需要同样的训练配方");
  expect(zh).toContain("这个结论仅在该实验设置下反映表示方式的差异");
  expect(zh).toContain("统一模型仍然可以使用不同损失");
  expect(zh).toContain("同一种损失也可以作用于模态专用的分词器");
  expect(zh).toContain("这项公开说明无法回答离散表示与连续表示孰优的问题");
});

test("boundary benchmarks cover representation understanding generation video and serving", () => {
  expect(zh).toContain("「多模态质量」范围太宽，无法成为有用的单一指标");
  for (const row of [
    "| 图文表示 | 双向检索、零样本分类、子群与提示词敏感性 |",
    "| 视觉理解 | OCR、图表、空间定位、回答正确率、校准、证据定位 |",
    "| 图像生成 | 提示遵循、计数与绑定、文字渲染、多样性、人类偏好、安全 |",
    "| 视频生成 | 时间一致性、运动、身份保持、物理行为、音视频同步 |",
    "| 服务 | 视觉序列长度、预填充时间、缓存内存、首个输出延迟、加速器成本 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("任何基准分数都必须注明模型版本、提示协议和工具使用情况");
  expect(zh).toContain("这些自动评判器是有用的诊断工具，但不是对审美、多样性、排版、记忆或有害输出的完整衡量");
});

test("contested choices and lower-layer constraints remain independently measurable", () => {
  expect(zh).toContain("未解决的问题有两个彼此独立的层次");
  expect(zh).toContain("一项选择的证据不能决定另一项");
  expect(zh).toContain("表示长度会直接传导到服务层");
  expect(zh).toContain("先写清输入与输出契约，再计算序列长度");
});

test("Chinese Chapter 15 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g));
  expect(uniqueMatches(zh, /\/figures\/([^\s)]+)/g)).toEqual(uniqueMatches(en, /\/figures\/([^\s)]+)/g));
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(uniqueMatches(en, /\/\/\| label: ([^\n]+)/g));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe((en.match(/:::: \{\.runnable\}/g) ?? []).length);
});

test("the rewrite removes stale machine-like and unsupported claims", () => {
  for (const rejected of [
    "图像嵌入与文本嵌入分处两个被撑开的狭窄锥体里",
    "这一几何在初始化时就已成形",
    "它是三者中最轻的连接器",
    "一个视觉语言模型把主要推断预算花在图像词元上",
    "现代的文生图系统用修正流、而非噪声预测来训练",
    "如今占主导地位",
    "系统层面的定论",
    "2025 年的系统把融合边界移进了生成器内部",
    "最深的开放问题",
    "统一路线的商业实例",
    "到 2026 年，前沿模型",
    "# 为什么视频生成需要潜空间自编码器",
    "@chen2024internvl",
    "@deepmind2025veo3",
    "@dhariwal2021",
    "@openai2025imagegen",
    "@openai2025sora2",
    "@sec-diffusion",
    "@sec-nar-lm",
    "@sec-serving-multimodal",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("the localized connector graph is readable inside the mobile column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  expect(zh).toContain("rankdir=TB;");
  expect(zh).not.toContain("rankdir=LR;");
  for (const label of [
    'label="图像"',
    'label="视觉编码器"',
    'label="Flamingo\\nPerceiver 重采样器\\n+ 门控交叉注意力"',
    'label="BLIP-2\\nQ-Former\\n32 个学习查询"',
    'label="LLaVA\\n线性层或 MLP\\n输入投影"',
    'label="语言模型"',
  ]) expect(zh).toContain(label);
  const graphviz = await loadGraphviz();
  const html = renderDot(graphviz, blocks[0][1], new Map(), "generative/multimodal-models.html", "");
  const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeGreaterThanOrEqual(200);
  expect(widthPt).toBeLessThanOrEqual(235);
});
