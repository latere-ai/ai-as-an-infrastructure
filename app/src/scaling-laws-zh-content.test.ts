import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/foundations/01-scaling-laws.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/foundations/01-scaling-laws.qmd"), "utf8");

test("Chapter 5 defines the forecast, evaluation loss, and both token counts", () => {
  expect(en).toContain("For a fixed model family and training setup");
  expect(zh).toContain("对于固定的模型族和训练设置，扩展律估计留出损失怎样随模型规模、数据量和算力变化");
  expect(zh).toContain("它不会代为选择数据，也不能保证下游能力");
  expect(zh).toContain("## 预测值衡量什么");
  expect(zh).toContain("\\ell_t&=-\\log p_\\theta(x_t\\mid x_{<t})");
  expect(zh).toContain("L_{\\mathrm{eval}}(\\theta)&=\\frac{1}{T}\\sum_{t=1}^{T}\\ell_t");
  expect(zh).toContain("$T$ 是参与评估的词元位置数");
  expect(zh).toContain("只有在分词器、留出数据和损失口径保持不变时");
  expect(zh).toContain("词元类型");
  expect(zh).toContain("词元实例");
  expect(zh).toContain("$D=RU$");
});

test("the loss surface describes excess loss and scopes theoretical explanations", () => {
  expect(zh).toContain("## 从小规模训练到损失曲面");
  expect(zh).toContain("L(N,D)=E+\\frac{A}{N^\\alpha}+\\frac{B}{D^\\beta}");
  expect(zh).toContain("$E$ 是针对所选分词器和数据分布拟合出的渐近值");
  expect(zh).toContain("幂律描述的是高于拟合下界的可降低损失，而不是总损失");
  expect(zh).toContain("模型规模、数据规模和算力分别对应不同的一维切片或前沿");
  expect(zh).toContain("## 曲线为何可能如此平滑");
  expect(zh).toContain("都是特定假设下的可能解释");
  expect(zh).not.toContain("斜率是数据的属性，而非架构的属性");
});

test("fixed-compute allocation includes the approximation, substitution, and closed-form optimum", () => {
  expect(zh).toContain("## 把算力预算换算成模型和数据规模");
  expect(zh).toContain("C_{\\mathrm{train}}\\approx \\kappa ND");
  expect(zh).toContain("\\kappa\\approx 6");
  expect(zh).toContain("这是规划用的近似值，不是账单");
  expect(zh).toContain("\\widehat L_C(N)");
  expect(zh).toContain("\\left(\\frac{\\alpha A}{\\beta B}\\right)");
  expect(zh).toContain("\\left(\\frac{\\beta B}{\\alpha A}\\right)");
  expect(zh).toContain("只有在 $\\alpha=\\beta$ 时才会得到恒定的词元参数比");
  expect(zh).toContain('data-xlabel="参数量 N（训练算力固定）"');
  expect(zh).not.toContain("最低点就是计算最优处，约为每个参数二十个词元");
});

test("Kaplan and Chinchilla evidence keeps accounting and replication uncertainty explicit", () => {
  expect(zh).toContain("## Kaplan 与 Chinchilla 估计的是不同前沿");
  expect(zh).toContain("$N_\\star\\propto C_{\\mathrm{train}}^{0.73}$");
  expect(zh).toContain("$D_\\star\\propto C_{\\mathrm{train}}^{0.27}$");
  expect(zh).toContain("700 亿参数");
  expect(zh).toContain("1.4 万亿个词元");
  expect(zh).toContain("是一条实用经验，不是物理常数");
  expect(zh).toContain("Kaplan 统计的是不含嵌入层的参数");
  expect(zh).toContain("超过 60 万次训练");
  expect(zh).toContain("可能不到 500 次");
  expect(zh).toContain("## 争议所在");
  expect(zh).not.toContain("fig-scaling-allocation");
});

test("deployment replaces the training-only objective with lifetime cost", () => {
  expect(zh).toContain("## 部署会改变目标");
  expect(zh).toContain("C_{\\mathrm{life}}(N,D,Q)");
  expect(zh).toContain("Q\\,c_{\\mathrm{serve}}(N)");
  expect(zh).toContain("$Q$ 是模型在整个生命周期内预计服务的词元量");
  expect(zh).toContain("47 个模型");
  expect(zh).toContain("约十亿次请求");
  expect(zh).toContain("不是在同一笔固定训练预算下提出第三种分配方式");
  expect(zh).toContain("固定训练 FLOPs 下损失最低");
  expect(zh).toContain("固定质量与需求下生命周期成本最低");
  expect(zh).toContain("相关量是目标质量、预期需求、延迟和硬件");
});

test("finite-data evidence separates fresh tokens, repetition, and overfitting", () => {
  expect(zh).toContain("## 有限数据会再次改变选择");
  expect(zh).toContain("最多约四轮");
  expect(zh).toContain("并不意味着每到第四轮都没有代价");
  expect(zh).toContain("10 亿参数和 16 轮训练");
  expect(zh).toContain("约 70% 的重复惩罚");
  expect(zh).toContain("单轮训练的前沿反而变差");
  for (const question of [
    "训练 FLOPs 固定且有足够新数据",
    "目标覆盖整个部署生命周期",
    "独特数据量固定",
  ]) expect(zh).toContain(question);
});

test("the six-step scaling study carries uncertainty and limits muP transfer", () => {
  expect(zh).toContain("## 如何开展扩展研究");
  for (const step of [
    "固定比较条件",
    "建立规模阶梯",
    "使用完整且可比较的训练",
    "留出部分训练不参与拟合",
    "拟合多种合理形式",
    "把不确定性带入分配决策",
  ]) expect(zh).toContain(`**${step}。**`);
  expect(zh).toContain("不能保证跨深度、架构、数据、优化器或批量变化仍能迁移");
  expect(zh).toContain("目标配置仍然需要验证训练");
});

test("the runnable reproduces the refit rather than presenting toy defaults", () => {
  expect(zh).toContain("## 检验分配方案");
  expect(zh).toContain("只用于复现这个例子，不能直接作为其他训练项目的默认值");
  expect(zh).toContain("E, A, B = 1.8172, 482.01, 2085.43");
  expect(zh).toContain("alpha, beta = 0.3478, 0.3658");
  expect(zh).toContain("N = np.logspace(7.5, 11, 400)");
  expect(zh).toContain("D = C / (kappa * N)");
  expect(zh).toContain("best_index = np.argmin(L)");
  expect(zh).not.toContain("loss = lambda N, D");
});

test("optimizer, schedule, and batch claims remain workload-specific", () => {
  expect(zh).toContain("## 扩展拟合不会调节什么");
  expect(zh).toContain("Muon 会对矩阵形隐藏层权重的动量更新做正交化");
  expect(zh).toContain("它不是曲率方法，也不是二阶方法");
  expect(zh).toContain("约为 AdamW 的两倍");
  expect(zh).toContain("嵌入、归一化参数和输出头仍使用 AdamW");
  expect(zh).toContain("并不能证明某一种优化器适合所有架构或数据混合");
  expect(zh).toContain("不同预算的训练必须在学习率调度中可比较的位置接受评估");
  expect(zh).toContain("临界批量大小附近的拐点");
  expect(zh).not.toContain("二阶和带预条件的优化器，Shampoo 以及更新的 Muon");
});

test("stability controls and the final decision record preserve operational boundaries", () => {
  expect(zh).toContain("## 让长时间训练保持稳定");
  expect(zh).toContain("不同的稳定性控制针对不同信号，并不构成一套通用恢复方案");
  expect(zh).toContain("裁剪可能掩盖正在恶化的训练，而不是修复原因");
  expect(zh).toContain("优化器状态、数据位置和调度位置");
  expect(zh).toContain("没有无法恢复的损失尖峰，也没有回滚");
  expect(zh).toContain("加入 QK-clip 后没有出现损失尖峰");
  expect(zh).toContain("不是同样控制措施可以原样迁移的保证");
  expect(zh).not.toContain("fig-loss-spike-recovery");
  expect(zh).toContain("## 在启动训练之前");
  for (const item of [
    "留出数据分布、分词器和准确的损失定义",
    "模型族、参数统计口径和训练词元数",
    "实测的规模阶梯，以及哪些训练被留出而未参与拟合",
    "拟合形式、系数不确定性和外推距离",
    "独特数据预算和预计重复轮数",
    "优化器、调度、批量策略和稳定性门槛",
  ]) expect(zh).toContain(item);
  expect(zh).toContain("可审计的分配决策");
  expect(zh).toContain("让预测可以被证伪");
});
