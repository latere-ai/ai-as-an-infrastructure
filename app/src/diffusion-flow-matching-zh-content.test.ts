import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/generative/01-diffusion-flow-matching.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/01-diffusion-flow-matching.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 12 preserves the complete English section architecture", () => {
  for (const heading of [
    "## 选择因子分解，而不是选阵营",
    "## 构造离散扩散过程",
    "## 把调度与预测目标分开",
    "## 把去噪连接到分数、SDE 与 ODE",
    "## 物理学解释止于何处",
    "## 把模型与采样器分开",
    "## 流匹配直接学习传输",
    "## 拉直或压缩采样路径",
    "## 评测完整的生成契约",
    "## 把连续状态交给离散文本",
    "## 争议所在",
    "## 下层约束",
    "## 延伸阅读",
  ]) expect(zh).toContain(heading);
  expect((zh.match(/^\$\$$/gm) ?? []).length).toBe((en.match(/^\$\$$/gm) ?? []).length);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe((en.match(/^\|---/gm) ?? []).length);
});

test("the opening keeps sequential dependence and cost accounting bounded", () => {
  for (const phrase of [
    "先在数据与已知参考分布之间规定一条简单的扰动或传输路径，再学习如何沿这条路径返回数据",
    "两类方法在数学上有所重叠，但谁都不能普遍取代另一方，也不能普遍取代自回归",
    "自回归模型必须等待前一个输出位置",
    "每次网络评估仍要承担表示大小与模型架构带来的全部成本",
    "只有同时考察质量和单步成本，减少采样步数才有意义",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("图中几何形状仅作说明，不能据此推断所需的网络评估次数");
});

test("factorization compares operational interfaces rather than declaring media boundaries", () => {
  expect(zh).toContain(String.raw`p(x)=\prod_{i=1}^{n}p(x_i\mid x_{<i})`);
  expect(zh).toContain("图像和音频同样可以序列化为词元");
  expect(zh).toContain("不存在一种序列化方式，始终都是空间或时间结构的最佳归纳偏置");
  for (const row of [
    "| 串行轴 | 输出位置 | 去噪步骤或求解器步骤 |",
    "| 每个串行步骤的工作量 | 通常利用缓存历史生成一个新词元 | 对完整状态做一次网络评估 |",
    "| 长度 | 持续生成，直到满足停止条件 | 在路径开始前或路径之外确定 |",
    "| 修改方式 | 较早的输出通常保持不变 | 当前状态中的所有位置都可以改变 |",
    "| 常见优势 | 流式输出、可变长度、词元似然 | 固定形状生成、编辑、内容填补 |",
  ]) expect(zh).toContain(row);
});

test("the discrete process defines forward marginals reverse transitions and loss", () => {
  for (const formula of [
    String.raw`q(x_t\mid x_{t-1})`,
    String.raw`\alpha_t=1-\beta_t`,
    String.raw`\bar\alpha_t=\prod_{s=1}^{t}\alpha_s`,
    String.raw`q(x_t\mid x_0)`,
    String.raw`p_\theta(x_{t-1}\mid x_t)`,
    String.raw`\mu_\theta(x_t,t)`,
    String.raw`\mathcal L_{\mathrm{simple}}`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("调度含有超参数，但没有可学习参数");
  expect(zh).toContain("对任意有限调度，它都不一定严格等于标准正态分布");
  expect(zh).toContain("逆向方差仍是另一项独立的设计选择");
});

test("the Chinese analytic reverse runnable recovers the target distribution", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("终点信号比例：0.000040");
  expect(stdout).toContain("目标均值=3.00，方差=1.00");
  expect(stdout).toContain("恢复均值=2.98，方差=1.01");
  expect(cell![1]).toContain("reverse_variance = previous_variance - gain**2 * current_variance");
  expect(cell![1]).not.toContain("matplotlib");
});

test("noise schedules and prediction targets remain separate choices", () => {
  expect(zh).toContain(String.raw`\bar\alpha_t=\frac{f(t)}{f(0)}`);
  expect(zh).toContain("这是一种有实验记录的调度，而不是普遍最优设置");
  expect(zh).toContain(String.raw`v_t=a_t\epsilon-\sigma_t x_0`);
  expect(zh).toContain("从 $" + String.raw`\epsilon` + "$ 预测恢复 $x_0$ 需要除以 $a_t$，在高噪声处会出现病态条件");
  expect(zh).toContain("从 $x_0$ 预测恢复 $" + String.raw`\epsilon` + "$ 需要除以 $" + String.raw`\sigma_t` + "$，在低噪声处会出现病态条件");
  expect(zh).toContain("若不进行时间变量转换，它并不是后文流匹配所用的速度");
});

test("score SDE and ODE relations state their exact scope", () => {
  for (const formula of [
    String.raw`s_t(x)=\nabla_x\log p_t(x)`,
    String.raw`\epsilon^*(x_t,t)=\mathbb E[\epsilon\mid x_t]`,
    String.raw`s_t(x_t)=-\frac{\epsilon^*(x_t,t)}{\sigma_t}`,
    String.raw`dx=f(x,t)\,dt+g(t)\,dW_t`,
    String.raw`g(t)\,d\bar W_t`,
    String.raw`\frac{dx}{dt}=f(x,t)-\frac{1}{2}g(t)^2\nabla_x\log p_t(x)`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("噪声预测与分数预测只在总体最优解处完全一致");
  expect(zh).toContain("一般的分数匹配是一种训练原理，本身并不是这两种离散化之一");
  expect(zh).toContain("二者并不共享单条随机轨迹或转移规律");
  expect(zh).toContain("物理学是方法谱系的一部分，却不能完整推导后来的每一种方法");
});

test("the deployment stack separates representation backbone target conditioning path and sampler", () => {
  for (const row of [
    "| 表示 | 像素、波形、自编码器潜张量 | 状态大小与信息瓶颈 |",
    "| 骨干网络 | U-Net、Transformer | 每次评估的成本与感受野 |",
    "| 训练目标 | $\\epsilon$、$x_0$、扩散 $v$、分数 | 数值条件与损失加权 |",
    "| 条件机制 | 类别标签、文本交叉注意力、引导 | 实际采样的条件分布 |",
    "| 路径与调度 | $\\beta_t$、$\\bar\\alpha_t$、连续 $\\sigma$ | 训练和采样工作分配到何处 |",
    "| 采样器 | 祖先采样、DDIM、ODE/SDE 求解器、蒸馏模型 | 网络评估次数、随机性与误差 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("自编码器的重建误差也必须进入评测契约");
  expect(zh).toContain("这是同一模型族内部的受控证据，并不是普遍扩展律");
});

test("guidance sampler accounting and EDM settings remain explicit", () => {
  expect(zh).toContain(String.raw`\hat\epsilon_{\mathrm{cfg}}(x_t,c)`);
  expect(zh).toContain("通常仍需在每个采样步骤计算有条件与无条件两次网络预测");
  expect(zh).toContain("采样器步数与网络函数评估次数（NFE）并不是同一个量");
  expect(zh).toContain("有限步的粗粒度 DDIM 更新并不等同于在通常时间坐标上直接使用 Euler 法");
  expect(zh).toContain("这些数字不能自动迁移到其他模型、分辨率或引导设置");
  expect(zh).toContain(String.raw`\sigma_i=\left(`);
  expect(zh).toContain("论文报告的 35 NFE 结果同样只属于其指定的基准配置");
});

test("flow matching distinguishes conditional targets from marginal velocity", () => {
  for (const formula of [
    String.raw`\frac{dx}{dt}=v_t(x)`,
    String.raw`\partial_t p_t(x)+\nabla_x\!\cdot\!\left(p_t(x)v_t(x)\right)=0`,
    String.raw`\mathcal L_{\mathrm{CFM}}(\theta)`,
    String.raw`x_t=(1-t)x_0+t x_1`,
    String.raw`u_t=x_1-x_0`,
    String.raw`v^*(x,t)=\mathbb E[x_1-x_0\mid x_t=x]`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("CFM 目标与无法直接计算的边缘目标对 $" + String.raw`\theta` + "$ 的梯度相同，但标量损失本身不必相等");
  expect(zh).toContain("即使每条条件插值都是直线，边缘轨迹仍可能弯曲");
  expect(zh).toContain("训练不依赖轨迹仿真；采样时仍要积分学习到的 ODE");
  expect(zh).toContain("耦合、路径与求解器是三项彼此独立的选择");
});

test("few-step routes preserve guarantees and non-equivalences", () => {
  expect(zh).toContain("重新配对并重训往往能拉直模型诱导的耦合");
  expect(zh).toContain("只有学到的轨迹严格保持常速度时，一个 Euler 步才是精确的");
  expect(zh).toContain(String.raw`X_t=I(t,X_0,X_1)+\gamma(t)Z`);
  expect(zh).toContain("「统一」并不意味着每种算法都可以互换");
  for (const row of [
    "| 改进积分 | 保留训练好的模型；降低每次 NFE 的数值误差 | DDIM、DPM-Solver、EDM Heun 采样器 |",
    "| 教师蒸馏 | 依据多步模型训练新学生 | 渐进式蒸馏、LCM、DMD、ADD |",
    "| 直接优化少步目标 | 训练支持大步跳跃的一致性或区间目标 | 一致性训练、MeanFlow |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("这些方法的目标与失效模式不能相互替代");
  expect(zh).toContain("这并不是说平均速度与瞬时速度相等");
});

test("the relation map is localized and keeps claims non-genealogical", () => {
  expect(zh).toContain("关系图，而不是严格的论文谱系");
  for (const label of [
    "DDPM\\n去噪",
    "NCSN\\n分数学习",
    "Score SDE\\n逆向 SDE + PF-ODE",
    "DDIM / DPM-Solver / EDM\\n确定性采样",
    "一致性模型\\n一步或少步",
    "条件流匹配\\n学习速度",
    "线性条件路径\\n成对速度目标",
    "Rectified Flow\\n重流拉直",
  ]) expect(zh).toContain(label);
  expect(zh).toContain("rankdir=TB;");
  expect(zh).not.toContain("rankdir=LR;");
});

test("evaluation covers quality correctness representation efficiency and stability", () => {
  for (const item of [
    "**分布质量与覆盖：**",
    "**条件正确性：**",
    "**表示损失：**",
    "**效率：**",
    "**稳定性：**",
  ]) expect(zh).toContain(item);
  expect(zh).toContain("检查点只是可复现记录的一部分");
  for (const row of [
    "| 增加 NFE 后样本改善 | 用细粒度参考对比粗粒度求解器 | 采样器或路径曲率 |",
    "| 增加很多步骤后仍缺少细节 | 比较潜表示重建与输入 | 自编码器瓶颈 |",
    "| 只有高引导强度才能对齐提示词，同时多样性坍缩 | 固定随机种子扫描引导强度 | 条件机制或 CFG |",
    "| 训练损失下降，但样本仍然很差 | 固定评测套件并检查目标转换 | 目标加权或参数化 |",
    "| 一步模型很清晰，却遗漏部分模式 | 对照教师评估精度与覆盖 | 蒸馏或对抗目标 |",
    "| 报告步数很少，但延迟仍很高 | 分析 NFE 与每次评估成本 | 骨干网络、引导或运行时 |",
  ]) expect(zh).toContain(row);
});

test("the text handoff keeps discrete diffusion claims bounded", () => {
  expect(zh).toContain("文本改变了状态空间");
  expect(zh).toContain("普通的固定掩码率语言模型并不会自动成为完整的扩散生成器");
  expect(zh).toContain("在论文所采用的评测设置中，与 GPT-2 规模的自回归模型相比具有竞争力");
  expect(zh).toContain("它与外部自回归模型在数据和评测上存在重要差异");
  expect(zh).toContain("输出长度控制、似然界、缓存复用和迭代解掩码由 @sec-nar-lm 继续展开");
});

test("contested claims and the lower-layer contract remain measurable", () => {
  expect(zh).toContain("扩散与流匹配并不是两个边界分明的对立阵营");
  expect(zh).toContain("直线条件路径不能保证学到的边缘轨迹也是直线");
  expect(zh).toContain("陈述结论时必须同时说明路径、目标、采样器、NFE 与评测设置");
  expect(zh).toContain("服务成本大致等于网络评估次数乘以单次评估成本，再加上自编码器与后处理开销");
  expect(zh).toContain("四步模型并不自动构成延迟结论");
});

test("Chinese Chapter 12 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g));
  expect(uniqueMatches(zh, /\/figures\/([^\s)]+)/g)).toEqual(uniqueMatches(en, /\/figures\/([^\s)]+)/g));
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(uniqueMatches(en, /\/\/\| label: ([^\n]+)/g));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe((en.match(/:::: \{\.runnable\}/g) ?? []).length);
});

test("the rewrite removes stale and unsupported claims", () => {
  for (const rejected of [
    "几乎所有非文本媒体背后的生成原理",
    "EDM 与流匹配，都是为了让这条路径条件更好、步数更少",
    "原始的线性 $\\beta_t$ 在高分辨率下毁掉信息太快",
    "在整个范围里都保持平衡",
    "同一个网络也可以被读作去噪器、分数或速度",
    "一条直线轨迹被一个 Euler 步精确积分",
    "流匹配，是同一个构造的不同重述",
    "商业的扩散语言模型此后也已出现",
    "每一个前沿模型",
    "用作用于",
    "@dhariwal2021",
    "@gls-score",
    "@sec-scaling-laws",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("the Chapter 12 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  const html = renderDot(graphviz, blocks[0][1], new Map(), "generative/diffusion-flow-matching.html", "");
  const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
