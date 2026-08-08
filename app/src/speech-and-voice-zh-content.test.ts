import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/generative/03-speech-and-voice.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/03-speech-and-voice.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 14 preserves the complete English section architecture", () => {
  for (const heading of [
    "## 把语音视为带时间的流",
    "## 学习语音识别所需的对齐",
    "## 先预训练表示，再做转写",
    "## 把波形转换成编解码器索引",
    "## 选择生成表示与调度",
    "## 在增量状态上构建对话",
    "## 评测每一道边界",
    "## 争议所在",
    "## 下层约束",
    "## 延伸阅读",
  ]) expect(zh).toContain(heading);
  expect((zh.match(/^\$\$$/gm) ?? []).length).toBe((en.match(/^\$\$$/gm) ?? []).length);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe((en.match(/^\|---/gm) ?? []).length);
});

test("the opening treats speech as timed interaction rather than text input", () => {
  for (const phrase of [
    "语音不是接上麦克风的文本",
    "听者会在一句话尚未结束时作出反应",
    "两个人也可能同时说话",
    "流式处理改变了什么才算正确",
    "从音频帧与文本之间未被标注的对齐开始",
    "可用语音对话背后的工程契约",
  ]) expect(zh).toContain(phrase);
});

test("timed workloads define distinct first outputs and failures", () => {
  for (const row of [
    "| 录音转写 | 可以 | 完整转写 | 词错误 |",
    "| 实时字幕 | 只能有限前瞻 | 稳定的局部文本 | 修改次数与延迟 |",
    "| 轮次式语音助手 | 可以等到轮次结束 | 第一段回应音频 | 过晚或错误的轮次终点 |",
    "| 全双工对话 | 没有固定轮次边界 | 对说话、停顿或打断作出反应 | 重叠与状态错误 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("最终转写很好，局部文本却可能变化得太频繁");
  expect(zh).toContain("「实时」必须对应明确指标，不能只作为一个形容词");
});

test("recognition objectives keep alignment and streaming claims distinct", () => {
  for (const formula of [
    String.raw`p_{\mathrm{CTC}}(\mathbf{y}\mid\mathbf{x})`,
    String.raw`\boldsymbol{\pi}\in B^{-1}(\mathbf{y})`,
    String.raw`p(\mathbf{y}\mid\mathbf{x})`,
    String.raw`c_u=\sum_t\alpha_{u,t}h_t`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("前向后向动态规划无需枚举所有路径就能计算这项求和");
  expect(zh).toContain("它没有显式的标签历史模型");
  expect(zh).toContain("RNN-T 本身并不保证流式处理");
  expect(zh).toContain("原始模型使用双向转写网络");
  expect(zh).toContain("Conformer 是编码器架构，不是对齐目标");
  expect(zh).toContain("流式实现必须限制上下文范围");
});

test("representation pretraining separates self-supervision from weak supervision", () => {
  for (const row of [
    "| wav2vec 2.0 | 无转写音频 | 从干扰项中找出被掩码时间步的量化目标 |",
    "| HuBERT | 无转写音频与离线聚类 | 被掩码位置的聚类标签 |",
    "| WavLM | 输入带噪声或重叠，目标来自干净语音 | 主说话人的聚类标签 |",
    "| Whisper | 音频与带噪声的人工或机器文本配对 | 文本、语言、任务与时间戳词元 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain(String.raw`\mathcal{L}_t=-\log`);
  expect(zh).toContain("这些目标对应被掩码的时间步，并不是对未来延续的预测");
  expect(zh).toContain("论文的代表性解码器还使用了 Transformer 语言模型");
  expect(zh).toContain("目标在每个训练阶段内保持固定");
  expect(zh).toContain("在干扰下识别内容，而不是重建干净波形");
  expect(zh).toContain("主要结果是跨留出数据集的广泛零样本迁移，而不是普遍优于针对单一领域调优的系统");
});

test("codec accounting defines RVQ index traffic and nominal bitrate", () => {
  for (const formula of [
    String.raw`r_t^{(0)}=z_t`,
    String.raw`k_t^{(j)}=\arg\min_k`,
    String.raw`\widehat z_t=\sum_{j=1}^{Q}e_{k_t^{(j)}}^{(j)}`,
    String.raw`R_{\mathrm{idx}}=fQ`,
    String.raw`R_{\mathrm{bit}}=f\sum_{j=1}^{Q}\left\lceil\log_2K_j\right\rceil`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("后续码本会继续描述此前码本尚未解释的部分");
  expect(zh).toContain("词元速率不等于比特率");
  expect(zh).toContain("两者都不能单独决定生成模型的解码成本");
});

test("the localized RVQ example is deterministic and accounts for indices and bits", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "深度=1 误差=0.354 索引/秒=50 比特/秒=100",
    "深度=2 误差=0.125 索引/秒=100 比特/秒=200",
    "深度=3 误差=0.000 索引/秒=150 比特/秒=300",
  ]);
  expect(cell![1]).toContain("indices_per_second = frame_hz * depth");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});

test("semantic and acoustic tokens remain roles rather than a false partition", () => {
  expect(zh).toContain("「语义」与「声学」描述的是作用，并不是边界清楚的二分法");
  expect(zh).toContain("编解码器词元要保存足够信息以重建信号，因此也必然携带内容信息");
  expect(zh).toContain("SpeechTokenizer 把第一层 RVQ 蒸馏到接近 HuBERT 单元");
  expect(zh).toContain("低帧率会缩短时间轴，但实际成本仍取决于质量、码本深度与生成调度");
});

test("speech generation keeps representation schedule and streaming separate", () => {
  expect(zh).toContain("@gls-tts，也就是从文本合成语音的任务");
  expect(zh).toContain("自回归阶段生成第一个码本，非自回归阶段再逐层填充残差码本");
  expect(zh).toContain("「达到人类水平」只指论文在 LibriSpeech 与 VCTK 上的偏好测试");
  expect(zh).toContain("推断时仍要用目标时长确定待生成片段");
  for (const row of [
    "| 自回归编解码器词元 | 自然支持可变长度生成 | 串行依赖可能造成重复或漂移 |",
    "| 掩码编解码器词元 | 可以同时更新许多帧位置 | 可能需要多轮精修 |",
    "| 在频谱图上做流或扩散 | 便于全局条件控制与编辑 | 必须选择采样调度与输出长度 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("这些路线本身既不保证流式，也不排斥流式");
  expect(zh).toContain("它只能识别带有该水印的内容，不能证明未带水印的录音一定来自人类");
});

test("conversation latency is decomposed without inventing one universal threshold", () => {
  expect(zh).toContain(String.raw`D_{\mathrm{first}}=D_{\mathrm{endpoint}}+D_{\mathrm{in}}+D_{\mathrm{ASR}}`);
  expect(zh).toContain("真实系统会让多个阶段重叠，因此观测延迟取决于关键路径");
  expect(zh).toContain("首段音频时间必须与轮次终点规则和网络条件一起报告");
  expect(zh).toContain("实时因子用总生成时间除以音频时长，回答的是另一个问题");
  expect(zh).toContain("全双工是一项系统契约");
  expect(zh).toContain("输入捕获与处理在回应音频播放期间仍要继续");
  expect(zh).toContain("回滚用户打断之后产生的文本或工具操作");
});

test("system evidence keeps Moshi human timing and GPT-4o claims bounded", () => {
  expect(zh).toContain("这些数字只描述该系统，并不是通用的对话阈值");
  expect(zh).toContain("人类对话不是一项 200 毫秒服务等级目标");
  expect(zh).toContain("不同语言和回应类型之间仍有很大差异");
  expect(zh).toContain("语音产品应当按自己的任务测量");
  expect(zh).toContain("这项报告本身不能证明系统支持全双工");
  expect(zh).toContain("不同任务与方向的语言覆盖范围并不相同");
});

test("boundary benchmarks diagnose recognition codec TTS conversation and safety", () => {
  for (const boundary of [
    "| 识别 | 词错误率、局部假设稳定性、输出延迟 |",
    "| 编解码器 | 指定比特率下的听感质量、算法延迟、丢包鲁棒性 |",
    "| TTS | 可懂度、说话人相似度、自然度、实时因子、首段音频时间 |",
    "| 对话 | 轮次终点错误、打断响应、重叠处理、回声泄漏、工具取消正确性 |",
    "| 安全 | 说话人同意、冒充测试、水印存活率与误报、语音数据保留 |",
  ]) expect(zh).toContain(boundary);
  expect(zh).toContain(String.raw`\mathrm{WER}=\frac{S+D+I}{N}`);
  expect(zh).toContain("WER 不衡量标点、说话人归属、韵律、自然度，也不说明局部转写是否及时到达");
});

test("contested architecture choices and lower-layer budgets remain measurable", () => {
  expect(zh).toContain("语音与文本之间不存在普遍最优的边界");
  expect(zh).toContain("按实测工作负载需求选择，而不是按架构标签选择");
  expect(zh).toContain("打断目标会约束音频块大小、轮次终点检测、传输、模型调度、合成缓冲与取消机制");
  expect(zh).toContain("先写清交互契约，再为每一道边界分配可测量的预算");
});

test("Chinese Chapter 14 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g));
  expect(uniqueMatches(zh, /\/figures\/([^\s)]+)/g)).toEqual(uniqueMatches(en, /\/figures\/([^\s)]+)/g));
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(uniqueMatches(en, /\/\/\| label: ([^\n]+)/g));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe((en.match(/:::: \{\.runnable\}/g) ?? []).length);
});

test("the rewrite removes stale machine-like and unsupported claims", () => {
  for (const rejected of [
    "前几章把生成从左到右的文本顺序中分离出来",
    "一个实时语音界面的预算只有几百毫秒",
    "这正是一个全神经的转录器成为端侧识别标准的缘故",
    "先自监督预训练，再大规模弱监督扩展",
    "前沿把二者叠在一起",
    "这正是语音模型能否实时运行的差别",
    "它就零样本地克隆那个声音",
    "首个商业实例",
    "那个上限，而非任何准确率目标",
    "@gls-flow-matching",
    "@openai2025gptrealtime",
    "@sec-diffusion",
    "@sec-scaling-laws",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("the localized voice architecture graph fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  expect(zh).toContain("rankdir=TB;");
  expect(zh).not.toContain("rankdir=LR;");
  for (const label of [
    'label="级联"',
    'label="语音到语音"',
    'label="输入音频"',
    'label="文本模型"',
    'label="音频模型"',
    'label="回应音频"',
  ]) expect(zh).toContain(label);
  const graphviz = await loadGraphviz();
  const html = renderDot(graphviz, blocks[0][1], new Map(), "generative/speech-and-voice.html", "");
  const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeGreaterThanOrEqual(200);
  expect(widthPt).toBeLessThanOrEqual(235);
});
