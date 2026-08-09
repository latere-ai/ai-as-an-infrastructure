import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/04-dpo-variants.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/04-dpo-variants.qmd", import.meta.url),
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

test("Chapter 20 starts from DPO's actual simplification and remaining assumptions", () => {
  expect(zh).toContain("DPO 不显式训练奖励模型，而是直接拟合偏好分类器");
  expect(zh).toContain("把奖励建模与策略优化归结为静态数据集上的分类损失");
  expect(zh).toContain("并没有把对齐变成普通的监督微调");
  expect(zh).toContain("仍然需要成对判断、冻结的参考策略、关于偏好如何产生的建模假设，以及训练样本对之外的评测");
});

test("DPO removes three loop components but keeps the reference data and pairwise constraint", () => {
  expect(zh).toContain("## DPO 去掉了什么，又保留了什么");
  for (const phrase of [
    "不再单独训练标量奖励模型",
    "偏好训练阶段不再从持续变化的策略采样回答",
    "不再需要评论家或策略梯度优化器",
    "参考策略定义了怎样的变化才算偏移",
    "数据只覆盖采集时出现过的候选回答",
    "不能脱离参考模型单独充当通用评判者",
  ]) expect(zh).toContain(phrase);
});

test("the reduction diagram preserves the RLHF and DPO data paths", () => {
  expect(zh).toContain("label: fig-dpo-variants-reduction");
  for (const label of [
    "偏好样本对",
    "拟合奖励模型",
    "采样策略回答",
    "用 PPO 与评论家",
    "策略/参考模型\\n对数比",
    "成对 log-sigmoid 损失",
  ]) expect(zh).toContain(label);
});

test("the derivation states the distributional objective and its support assumptions", () => {
  expect(zh).toContain("## 推导过程及其假设");
  for (const expression of [
    String.raw`\max_{\pi}`,
    String.raw`\mathrm{KL}`,
    String.raw`\pi^*(y\mid x)`,
    String.raw`Z(x)=\sum_y`,
  ]) expect(zh).toContain(expression);
  expect(zh).toContain("奖励为有限值、归一化常数存在，而且策略只在参考策略的支持集上分配概率");
  expect(zh).toContain("这个闭式解针对的是概率分布，而不是神经网络参数");
  expect(zh).toContain("并没有直接解出 $\\theta$");
});

test("the implicit reward is one equivalence-class representative rather than recovered utility", () => {
  expect(zh).toContain(String.raw`r(x,y)=\beta\log\frac{\pi^*(y\mid x)}`);
  expect(zh).toContain("奖励只能确定到一个仅依赖提示的常数");
  expect(zh).toContain("只是这一等价类中的一种表示");
  expect(zh).toContain("并不是唯一恢复出来的人类效用");
});

test("the Bradley-Terry assumption and DPO loss retain their limits", () => {
  for (const expression of [
    String.raw`p(y_w\succ y_l\mid x)`,
    String.raw`\mathcal{L}_{\mathrm{DPO}}(\theta)`,
    String.raw`A_\theta=`,
  ]) expect(zh).toContain(expression);
  expect(zh).toContain("不能直接表示平局、循环偏好、不同标注者群体");
  expect(zh).toContain("精确等价于理想化 RLHF 解");
  expect(zh).toContain("偏好模型设定正确、数据覆盖充分、参考策略与行为策略的支持集兼容，而且优化成功");
  expect(zh).toContain("并不对任意神经网络、设定错误的偏好模型或有限的支持集外数据严格等价");
});

test("the localized derivation stepper preserves all six necessary steps", () => {
  expect(zh).toContain('id="fig-dpo-variants-stepper"');
  for (const phrase of [
    'data-chip="目标" data-title="1 · 从 KL 正则化奖励出发"',
    'data-chip="分布" data-title="2 · 在分布空间求解"',
    'data-chip="对数比" data-title="3 · 反解奖励关系"',
    'data-chip="偏好" data-title="4 · 选择比较模型"',
    'data-chip="相消" data-title="5 · 消去未知归一化项"',
    'data-chip="拟合" data-title="6 · 直接优化策略"',
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("DPO 是代数化简与建模假设共同得到的结果");
});

test("relative movement is not confused with absolute response probability", () => {
  expect(zh).toContain("## 如何理解相对变化");
  expect(zh).toContain("并不只是要求选中回答的概率高于被拒回答");
  expect(zh).toContain("正的 DPO 间隔并不能保证");
  expect(zh).toContain(String.raw`\pi_\theta(y_w\mid x)>\pi_\theta(y_l\mid x)`);
  expect(zh).toContain("相对比较中胜出，却仍然拥有很低的绝对概率");
});

test("the gradient and token sum explain what must be measured", () => {
  expect(zh).toContain(String.raw`\nabla_\theta\mathcal{L}_{\mathrm{DPO}}`);
  expect(zh).toContain("间隔为负或较小时，样本对获得的权重最大");
  expect(zh).toContain("不能保证选中回答的对数概率在每个检查点都单调上升");
  expect(zh).toContain(String.raw`\log\pi_\theta(y\mid x)=`);
  expect(zh).toContain("DPO 奖励并不在数学上保证随回答长度增长");
});

test("beta's theoretical and implemented roles stay separate", () => {
  expect(zh).toContain("$\\beta$ 的作用也分为两层");
  expect(zh).toContain("理论上对参考策略施加更强的正则约束");
  expect(zh).toContain("同时决定对数几率的温度，并缩放梯度");
  expect(zh).toContain("不能保证 $\\beta$ 与测得的策略偏移之间呈单调关系");
});

test("the variant map treats methods as alternatives for different constraints", () => {
  expect(zh).toContain("## 四种变体解决的是不同约束");
  expect(zh).toContain("不是同一种算法依次升级后的版本");
  for (const edge of [
    'dpo -> ipo [label="损失形状"]',
    'dpo -> kto [label="标签格式"]',
    'dpo -> orpo [label="合并 SFT"]',
    'dpo -> simpo [label="回答分数"]',
  ]) expect(zh).toContain(edge);
});

test("IPO has a finite theory-derived target without broad empirical overclaim", () => {
  expect(zh).toContain("### IPO：保留样本对与参考模型，改变损失形状");
  expect(zh).toContain("损失本身的下界是零，趋向无穷的是可分样本上的最优间隔");
  expect(zh).toContain(String.raw`h_\theta(x,y_w,y_l)`);
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{IPO}}(\theta)`);
  expect(zh).toContain(String.raw`\frac{1}{2\beta}`);
  expect(zh).toContain("目标由理论固定为 $1/(2\\beta)$，并不是独立选择的超参数");
  expect(zh).toContain("不能据此断言 IPO 在语言模型任务上普遍更好");
});

test("the runnable demonstrates loss geometry rather than model quality", () => {
  expect(zh).toContain("只优化一个标量间隔，而不是语言模型");
  expect(zh).toContain("beta = 0.2");
  expect(zh).toContain("ipo_target = 1.0 / (2.0 * beta)");
  expect(zh).toContain("DPO 间隔（100 步后）");
  expect(zh).toContain("IPO 目标");
});

test("KTO keeps pointwise labels reference baseline estimation and bounded psychology claims", () => {
  expect(zh).toContain("### KTO：用合意与不合意样本取代成对比较");
  expect(zh).toContain("**@gls-kto改从好/坏标签学习，去掉成对数据要求。**");
  expect(zh).toContain("同一提示不必同时提供一个正例和一个负例");
  expect(zh).toContain(String.raw`z_0(x)=\mathrm{KL}`);
  expect(zh).toContain(String.raw`\lambda_D`);
  expect(zh).toContain(String.raw`\lambda_U`);
  expect(zh).toContain("停止梯度且有偏的微批次估计");
  expect(zh).toContain("并不能证明这个公式忠实刻画了人们如何评价文本");
});

test("ORPO combines chosen SFT and odds separation without a frozen reference", () => {
  expect(zh).toContain("### ORPO：把选中回答的 SFT 与偏好惩罚合并");
  expect(zh).toContain("移除冻结参考模型，也不再设置单独的偏好训练阶段");
  expect(zh).toContain(String.raw`P_\theta(y\mid x)=`);
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{ORPO}}`);
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{OR}}`);
  expect(zh).toContain("单阶段并不等于只把数据训练一遍");
  expect(zh).toContain("无法像分阶段的 SFT 后接 DPO 那样独立调节和审计");
});

test("SimPO uses an average score and margin without treating beta as KL", () => {
  expect(zh).toContain("### SimPO：使用平均对数概率与目标间隔");
  expect(zh).toContain(String.raw`r_{\mathrm{SimPO}}(x,y)`);
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{SimPO}}(\theta)`);
  expect(zh).toContain("$\\beta$ 在这里不是 KL 系数");
  expect(zh).toContain("降低回答长度带来的敏感性");
  expect(zh).toContain("并不能消除所有长度偏差");
  expect(zh).toContain("无参考模型并不等于没有正则约束");
});

test("empirical comparisons remain conditional rather than becoming a leaderboard", () => {
  expect(zh).toContain("## 现有比较能说明什么");
  expect(zh).toContain("并不构成一场采用统一条件的竞赛");
  expect(zh).toContain("## 争议所在");
  expect(zh).toContain("20 种 DPO 变体");
  expect(zh).toContain("Bonferroni 校正");
  expect(zh).toContain("SimPO 在 7B 规模上领先 DPO");
  expect(zh).toContain("并不能证明 DPO 在所有场景下都最好");
  expect(zh).toContain("目前没有得到公认的普适胜者");
});

test("the choice table states each method's actual data and model requirements", () => {
  expect(zh).toContain("## 根据数据与流水线约束选择");
  for (const row of [
    "| DPO | 成对比较 | 是 | 否 |",
    "| IPO | 成对比较 | 是 | 否 |",
    "| KTO | 合意/不合意 | 是 | 否 |",
    "| ORPO | 成对比较 | 否 | 是 |",
    "| SimPO | 成对比较 | 否 | 否 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("把这张表当作筛选条件，而不是排行榜");
  expect(zh).toContain("无参考方法省去的是参考模型推理与存储开销，并不一定让峰值内存减半");
});

test("the lower-layer constraint accounts for precomputation and refresh", () => {
  expect(zh).toContain("## 下层约束");
  expect(zh).toContain("如果能预先计算参考分数，DPO 训练时就不必让额外模型常驻内存");
  expect(zh).toContain("重新生成样本对后，缓存分数会过期");
  expect(zh).toContain("决定数据刷新周期、存储格式、分片方案与精度策略");
});

test("the practical DPO run covers data score sweep and checkpoint gates", () => {
  expect(zh).toContain("## 一次实际的 DPO 训练");
  for (const phrase of [
    "固定起点",
    "验证每个三元组",
    "检查偏好信号",
    "正确计算序列分数",
    "进行小规模参数扫描",
    "评测每个检查点，而不只看最后一步",
    "被截断后变得完全相同",
    "只对回答词元求和",
  ]) expect(zh).toContain(phrase);
});

test("the minimal batch computation names both movement diagnostics", () => {
  expect(zh).toContain(String.raw`\ell_w &= \log\pi_\theta`);
  expect(zh).toContain(String.raw`\ell_l &= \log\pi_\theta`);
  expect(zh).toContain(String.raw`\mathcal{L}_{\mathrm{batch}}`);
  expect(zh).toContain("分别记录这两个诊断量");
});

test("failure checks cover offline support shortcuts and external quality", () => {
  expect(zh).toContain("## 失效方式与检查项");
  expect(zh).toContain("任何损失变体都无法从缺失的数据中推断未被记录的行为要求");
  for (const phrase of [
    "留出集偏好准确率与间隔",
    "选中回答与被拒回答的对数概率",
    "策略与参考模型的偏差",
    "回答长度与格式合规性",
    "留出任务质量",
    "分组结果",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("切换目标函数之前不先诊断这些原因，只会把同一种失效搬到另一个损失上");
});

test("the closing names the static-data limit and online coverage tradeoff", () => {
  expect(zh).toContain("模型在发生变化时从不请求新的比较");
  expect(zh).toContain("迭代式或在线方法会用当前策略刷新候选回答");
  expect(zh).toContain("代价是重新把采样与反馈基础设施带回训练回路");
  expect(zh).toContain("@sec-rlhf");
});

test("Chinese Chapter 20 preserves the complete English artifact contract", () => {
  expect(count(zh, /^## /gm)).toBe(count(en, /^## /gm));
  expect(count(zh, /^### /gm)).toBe(count(en, /^### /gm));
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^:::: \{\.runnable\}$/gm)).toBe(count(en, /^:::: \{\.runnable\}$/gm));
  expect(count(zh, /^```python$/gm)).toBe(count(en, /^```python$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(count(zh, /^!\[/gm)).toBe(count(en, /^!\[/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("every Chapter 20 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the rewrite removes stale overclaims and extra artifacts", () => {
  for (const rejected of [
    "PPO 要同时驻留四个模型",
    "唯一的闭式最优策略",
    "语言模型隐式地就是一个奖励模型",
    "后来的每个方法都是对它的一次改动",
    "没有哪个变体能可靠地胜过它们共同继承的基础 DPO 损失",
    "把对齐阶段的内存减半",
    "除以长度便移除了这一路径",
    "整个家族中唯一要紧的超参数",
    "fig-dpo-variants-2",
    "arXiv:2603.19335",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
