import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/03-rlhf-reward-modeling.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/03-rlhf-reward-modeling.qmd", import.meta.url),
  "utf8",
);
const overoptimizationFigure = readFileSync(
  new URL("../../zh/figures/rlhf-reward-modeling-1.svg", import.meta.url),
  "utf8",
);

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function citations(source: string): string[] {
  return [...new Set([...source.matchAll(/@([a-z]+\d[\w-]*)/g)].map(([, key]) => key))].sort();
}

function crossRefs(source: string): string[] {
  return [...source.matchAll(/@(?:sec|fig|gls)-[\w-]+/g)].map(([ref]) => ref).sort();
}

test("Chapter 19 keeps measurement estimator and optimization separate", () => {
  expect(zh).toContain("偏好记录是一项测量结果，奖励模型是根据这些测量结果拟合出的估计器，而策略目标决定要多大力度地使用这项估计");
  expect(zh).toContain("奖励模型估计标注流程会偏好哪些回答");
  expect(zh).toContain("策略则被更新为获得更高的估计奖励");
  expect(zh).toContain("KL 约束和 PPO 都不能让这个代理自动变得正确");
});

test("the classic pipeline distinguishes its three stages and failures", () => {
  expect(zh).toContain("## RLHF 先学会评判，再训练策略");
  for (const phrase of [
    "**监督微调。**",
    "**奖励建模。**",
    "**策略优化。**",
    "只有第三阶段属于强化学习",
    "标签可能表达了错误的标准",
    "奖励模型可能无法泛化",
    "策略也可能利用奖励模型的错误",
  ]) expect(zh).toContain(phrase);
});

test("the reward-model dataset and Bradley-Terry loss define every symbol", () => {
  expect(zh).toContain("## 从比较数据训练评分器");
  for (const expression of [
    String.raw`\mathcal{D}=\{(x_i,y_i^+,y_i^-)\}_{i=1}^N`,
    String.raw`\Delta_i`,
    String.raw`p_i=\sigma(\Delta_i)`,
    String.raw`\mathcal{L}_{\mathrm{RM}}(\phi)`,
  ]) expect(zh).toContain(expression);
  expect(zh).toContain("模型从未被告知任一回答应当获得 7 这样的绝对奖励");
});

test("soft labels retain vote splits without inventing reasons", () => {
  expect(zh).toContain(String.raw`q_i=n_i^+/m_i`);
  expect(zh).toContain(String.raw`-q_i\log p_i-(1-q_i)\log(1-p_i)`);
  expect(zh).toContain("可以表示票数恰好对半，也可以表示明确的平局");
  expect(zh).toContain("却没有说明标注者为何意见不同");
});

test("rankings do not manufacture independent evidence", () => {
  expect(zh).toContain("四到九个回答");
  expect(zh).toContain(String.raw`K(K-1)/2`);
  expect(zh).toContain("却不等于得到了同样多份相互独立的观测");
  expect(zh).toContain("把同一次排序产生的所有配对放进同一个训练批次");
});

test("reward-model validation includes calibration and structured slices", () => {
  for (const phrase of [
    "留出集对数损失、成对准确率和校准曲线",
    "准确率会把 0.51 和 0.99 视为同样的预测",
    "提示来源、任务、回答长度、候选策略、安全类别和标注者群体",
    "对话、推理和安全比较",
  ]) expect(zh).toContain(phrase);
});

test("pairwise training identifies differences rather than absolute quality", () => {
  expect(zh).toContain("## 成对训练确定的是分数差，而非绝对质量");
  expect(zh).toContain(String.raw`r'_\phi(x,y)=r_\phi(x,y)+c(x)`);
  expect(zh).toContain("原始奖励值没有自然的零点，也不应跨提示比较");
  expect(zh).toContain(String.raw`\Delta=\log[p/(1-p)]`);
  expect(zh).toContain(String.raw`\Delta=\log 3\approx1.10`);
});

test("centering scaling and scalar assumptions stay distinct", () => {
  expect(zh).toContain("把奖励模型的偏置平移到标注者示范的平均奖励为零");
  expect(zh).toContain("缩放则不同");
  expect(zh).toContain("必须把奖励尺度与 $\\beta$ 一起记录");
  expect(zh).toContain("循环偏好、随情境变化的标准，以及标注者之间稳定的差异");
});

test("the policy objective defines reward and reference regularization", () => {
  expect(zh).toContain("## 策略目标包含两项");
  for (const expression of [
    String.raw`J(\theta)`,
    String.raw`x\sim\mathcal{D}_x`,
    String.raw`y\sim\pi_\theta(\cdot\mid x)`,
    String.raw`\pi_{\mathrm{ref}}(y\mid x)`,
  ]) expect(zh).toContain(expression);
  expect(zh).toContain("第一项奖励习得评判者偏好的回答");
  expect(zh).toContain("第二项则让策略相对参考模型显著提高某个回答的概率时付出代价");
});

test("sampled token log ratios are not mislabeled as KL", () => {
  expect(zh).toContain("采样得到的对数比本身并不是 KL 散度");
  expect(zh).toContain("单个贡献甚至可以为负");
  expect(zh).toContain("KL 是对策略所采样词元取期望后的结果");
  expect(zh).toContain("应把实际达到的 KL 写入运行记录");
});

test("KL regularization and PPO clipping constrain different moves", () => {
  expect(zh).toContain("## KL 正则与 PPO 裁剪约束的是两种不同变化");
  expect(zh).toContain("采样策略 $\\pi_{\\mathrm{old}}$ 是生成当前批次时使用的策略快照");
  expect(zh).toContain("参考策略 $\\pi_{\\mathrm{ref}}$ 则是跨越许多批次使用的 SFT 锚点");
  expect(zh).toContain(String.raw`\rho_t(\theta)`);
  expect(zh).toContain(String.raw`L_{\mathrm{clip}}(\theta)`);
  expect(zh).toContain("裁剪并不会形成硬性的信赖域");
});

test("the localized stepper preserves all six PPO checks", () => {
  expect(zh).toContain('id="fig-rlhf-reward-modeling-stepper"');
  for (const phrase of [
    'data-chip="采样" data-title="1 · 冻结采样快照"',
    'data-chip="评分" data-title="2 · 使用习得评判者"',
    'data-chip="塑形" data-title="3 · 与参考模型比较"',
    'data-chip="基线" data-title="4 · 估计期望回报"',
    'data-chip="更新" data-title="5 · 复用采样批次"',
    'data-chip="检查" data-title="6 · 在奖励之外检验"',
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("更高的习得奖励不能单独作为发布标准");
});

test("four logical roles are not four full policy replicas", () => {
  expect(zh).toContain("## 回路中有四种参数角色");
  for (const row of [
    "| 策略 $\\pi_\\theta$ | 是 |",
    "| 参考模型 $\\pi_{\\mathrm{ref}}$ | 否 |",
    "| 奖励模型 $r_\\phi$ | 否 |",
    "| 评论家 $V_\\psi$ | 是 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("6B 奖励模型和 6B 价值模型来训练 175B 策略");
  expect(zh).toContain("不能把「四种角色」理解成「四份策略模型副本」");
});

test("the pipeline diagram preserves update and frozen semantics", () => {
  expect(zh).toContain("label: fig-rlhf-pipeline");
  for (const phrase of [
    "比较记录\\n提示 + 偏好回答 + 未选回答",
    "策略 π_θ\\n更新",
    "奖励 r_φ\\n冻结",
    "参考模型 π_ref\\n冻结",
    "评论家 V_ψ\\n更新",
    "塑形回报 + 优势\\n裁剪 PPO 更新",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("rank=same");
  expect(zh).toContain("constraint=false");
});

test("the pipeline diagram fits the mobile reading column", async () => {
  const dot = zh.match(
    /```\{dot\}\n([\s\S]*?label: fig-rlhf-pipeline[\s\S]*?)\n```/,
  )?.[1];
  expect(dot).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(dot!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the history keeps evidence bounded to measured distributions", () => {
  expect(zh).toContain("## 从轨迹偏好到指令遵循");
  expect(zh).toContain("Atari 和模拟运动控制任务");
  expect(zh).toContain("风格续写和摘要");
  expect(zh).toContain("1.3B 的 PPO-ptx 模型");
  expect(zh).toContain("并不说明较小模型拥有更强的通用能力");
});

test("RLAIF and policy-gradient alternatives retain their actual scope", () => {
  expect(zh).toContain("从无害性阶段移除的是人工无害性标签，而不是人的规范选择或评测");
  expect(zh).toContain("使用人类反馈，并不意味着一定要用 PPO");
  expect(zh).toContain("RLOO 使用其他样本的平均回报");
  expect(zh).toContain("GRPO 则在同一提示的样本组内对奖励做标准化");
  expect(zh).toContain("不能据此声称某一种优化器适用于所有后训练技术栈");
});

test("proxy optimization is tested outside the reward-model distribution", () => {
  expect(zh).toContain("## 优化会在训练分布之外检验代理");
  expect(zh).toContain("预测奖励继续改善，标注者偏好却开始下降");
  expect(zh).toContain("固定的金标准奖励模型代替人工判断");
  expect(zh).toContain("并没有测出一条普适的真实人类质量曲线");
  expect(zh).toContain("curvature = 0.016  # 示意值，并非 Gao 等人的估计结果");
});

test("the localized proxy chart uses the chapter's gold-model terminology", () => {
  expect(overoptimizationFigure).toContain("独立金标准模型分数");
  expect(overoptimizationFigure).toContain("金标准模型峰值");
  expect(overoptimizationFigure).not.toContain("黄金模型");
});

test("reward hacking tampering and sycophancy remain separate", () => {
  expect(zh).toContain("奖励投机是这种泛化缺口在行为上的后果");
  expect(zh).toContain("这只是谄媚的一条成因，并不表示 RLHF 是唯一原因");
  expect(zh).toContain("奖励篡改是智能体改变评分过程本身");
  expect(zh).toContain("与利用固定但设定有误的分数属于不同问题");
});

test("controls state both their reach and their limits", () => {
  expect(zh).toContain("## 各项控制能做什么，又不能证明什么");
  for (const control of [
    "更好的评分准则、专家标签、平局与理由",
    "留出集上的奖励模型对数损失、准确率和分切片校准",
    "新的同策略比较与奖励模型刷新",
    "参考模型 KL 与调好的 $\\beta$",
    "基于独立评测的早停",
    "多样化的奖励模型集成",
    "混入预训练数据",
  ]) expect(zh).toContain(control);
  expect(zh).toContain("共享训练数据与共享评分准则仍可能造成共同盲点");
});

test("alignment tax and over-refusal are not treated as universal laws", () => {
  expect(zh).toContain("「对齐税」同样是一项经验性回退，并不是安全必然削弱能力的普适定律");
  expect(zh).toContain("只提高 KL 系数并没有恢复同一批任务");
  expect(zh).toContain("过度拒绝则是另一种失效：它表示安全边界校准不当");
});

test("contested claims avoid a universal Goodhart theorem", () => {
  expect(zh).toContain("## 争议所在");
  expect(zh).toContain("古德哈特定律是一个有用的警示");
  expect(zh).toContain("却不是说每个有限奖励模型都会在某个固定 KL 值上失效的定理");
  expect(zh).toContain("直接偏好目标删去了一部分 RLHF 机制，却没有消除这个测量问题");
});

test("external judgment governs the stopping procedure", () => {
  expect(zh).toContain("## 由外部判断决定何时停止");
  for (const phrase of [
    "训练奖励模型前，先按来源和近重复内容族拆分提示",
    "关键切片未通过时，不要开始强化学习",
    "冻结选定的奖励模型版本、参考模型版本、分词器、对话模板和奖励归一化方式",
    "测量策略相对参考模型实际达到的 KL",
    "策略进入奖励模型未覆盖的回答区域时，加入经过审计的同策略比较",
    "应发布新版奖励模型并重新训练，而不是在运行途中静默替换它",
    "即使习得奖励仍在上升，只要外部质量趋于平稳或开始下降，就停止或回滚",
  ]) expect(zh).toContain(phrase);
});

test("the dashboard separates proxy evidence from external evidence", () => {
  for (const signal of [
    "| 奖励模型训练与验证损失 |",
    "| 分切片的成对准确率与校准 |",
    "| 平均奖励与奖励分布 |",
    "| 实际序列级与词元级 KL |",
    "| 独立偏好胜率或任务指标 |",
    "| 能力与安全回退 |",
  ]) expect(zh).toContain(signal);
  expect(zh).toContain("停止规则应由表中代表外部证据的几项指标决定");
});

test("the lower-layer constraint uses logical rather than universal model counts", () => {
  expect(zh).toContain("## 下层约束");
  expect(zh).toContain("四种逻辑角色");
  expect(zh).toContain("峰值驻留量取决于分片、共享、适配器、卸载");
  expect(zh).toContain("「从四个模型减到三个」并不是普适的核算规则");
});

test("Chinese Chapter 19 preserves the complete English artifact contract", () => {
  expect(count(zh, /^## /gm)).toBe(count(en, /^## /gm));
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^:::: \{\.runnable\}$/gm)).toBe(count(en, /^:::: \{\.runnable\}$/gm));
  expect(count(zh, /^```python$/gm)).toBe(count(en, /^```python$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(count(zh, /^!\[/gm)).toBe(count(en, /^!\[/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("the rewrite removes stale overclaims and extra artifacts", () => {
  for (const rejected of [
    "标注者之间的分歧就是噪声下限",
    "KL 项是 RLHF 为何稳定的主要缘由",
    "逐词元差距就是 KL",
    "这说明瓶颈不在能力",
    "人类标签设定上限，AI 标签设定体量",
    "流水线是一组平衡，每一处都有一个转折点",
    "如今公开的前沿与开放后训练栈大多跑的正是",
    "fig-rlhf-overoptimization",
    "rankdir=LR;",
    "@sec-benchmarks",
    "@sec-verifiable-rewards",
    "@gls-reward-hacking",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
