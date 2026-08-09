import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/07-synthetic-data-self-improvement.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/07-synthetic-data-self-improvement.qmd", import.meta.url),
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

test("Chapter 23 starts from evidence for admission rather than cheap generation", () => {
  expect(zh).toContain("合成数据有用，是因为生成成本低");
  expect(zh).toContain("危险也来自同一个原因");
  expect(zh).toContain("什么证据足以让一条生成记录安全地进入训练");
  expect(zh).toContain("自我改进也需要同样谨慎地定义");
  expect(zh).toContain("后续模型在独立评测上取得改善");
});

test("synthetic data is provenance rather than a training algorithm", () => {
  expect(zh).toContain("## 合成数据描述来源，不描述算法");
  expect(zh).toContain("说明的是记录从哪里来，而不是它将怎样使用");
  for (const use of ["SFT 目标", "偏好对的一侧", "强化学习的 rollout", "评测候选"]) {
    expect(zh).toContain(use);
  }
  expect(zh).toContain("彼此相关，却不是同一条历史阶梯上的不同阶段");
  expect(zh).toContain("LIMA 并没有测试自训练回路");
});

test("the six-axis design review keeps provenance, signal, objective, and schedule separate", () => {
  for (const row of [
    "| 提示来源 |",
    "| 回答生成器 |",
    "| 传递的信号 |",
    "| 接纳信号 |",
    "| 更新规则 |",
    "| 迭代安排 |",
  ]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("这些列中的选择可以自由组合");
  expect(zh).toContain("掩盖了真正决定系统行为的区别");
});

test("the audit-loop diagram separates validation from data selection", () => {
  for (const label of [
    "任务与数据来源",
    "生成候选",
    "接纳流水线",
    "经筛选的训练混合",
    "更新模型",
    "独立于筛选的\\n验证门槛",
    "发布、修订、停止，\\n或开始下一轮",
  ]) {
    expect(zh).toContain(label);
  }
  expect(zh).toContain("decision -> generate [style=dashed]");
});

test("sampling creates candidate coverage rather than correctness", () => {
  expect(zh).toContain("## 采样创造机会，不创造正确性");
  expect(zh).toContain(String.raw`p_x = \Pr_{y \sim q_\theta(\cdot \mid x)}[z(x,y)=1]`);
  expect(zh).toContain(String.raw`C_n(x) = 1 - (1 - p_x)^n`);
  expect(zh).toContain("候选覆盖率");
  expect(zh).toContain("描述的是独立采样假设下出现可接受回答的机会");
  expect(zh).toContain("并不表示实际选择器一定能找到它");
});

test("the runnable localizes oracle coverage without changing the calculation", () => {
  expect(zh).toContain('plt.xlabel("独立候选数 n")');
  expect(zh).toContain('plt.ylabel("候选覆盖率 C_n")');
  expect(zh).toContain('plt.title("独立采样下的理想覆盖率")');
  expect(zh).toContain("当 p=0.10、n=20 时，候选覆盖率为");
});

test("selection precision exposes both false acceptance and false rejection", () => {
  expect(zh).toContain("实际过滤器");
  expect(zh).toContain("选择精确率");
  expect(zh).toContain(String.raw`\frac{\alpha_x p_x}{\alpha_x p_x + \beta_x(1-p_x)}`);
  expect(zh).toContain("即使 $\\beta_x$ 很小");
  expect(zh).toContain("假阴性会造成相反的问题");
  expect(zh).toContain("筛选只是重新加权生成器，并不会凭空创造正确性");
  expect(zh).toContain(String.raw`\widetilde q_\theta(y \mid x)`);
  expect(zh).toContain(String.raw`Z_\theta(x)=\mathbb{E}`);
});

test("the five generated-data patterns preserve their distinct supervision contracts", () => {
  expect(zh).toContain("## 五种生成数据的用法并不相同");
  for (const heading of [
    "### 教师蒸馏",
    "### 合成任务与示范",
    "### 经过筛选的自训练",
    "### AI 反馈",
    "### 验证器引导的学习与自我博弈",
  ]) {
    expect(zh).toContain(heading);
  }
});

test("teacher distillation states both sequence loss and the bounded teacher limitation", () => {
  expect(zh).toContain("软化后的词元分布");
  expect(zh).toContain("完整文本");
  expect(zh).toContain("丢掉了教师表达的大部分不确定性");
  expect(zh).toContain("学生在某些蒸馏环境中超过教师");
  expect(zh).toContain("教师从未产生某类有用输出");
});

test("task synthesis and filtered self-training retain provenance and policy timing", () => {
  expect(zh).toContain("行数增加了，覆盖范围却没有扩大");
  expect(zh).toContain("提示生成与回答生成也应分别记录来源");
  expect(zh).toContain("best-of-$n$ 推断在选出回答后便结束");
  expect(zh).toContain("只有当前学习器生成候选时");
  expect(zh).toContain("任何保存下来的筛选数据都会随着学习器变化而过时");
  expect(zh).toContain("并不是偏好对");
});

test("AI feedback remains a learned proxy with human choices still present", () => {
  expect(zh).toContain("监督阶段生成批判与修订");
  expect(zh).toContain("RLAIF 阶段生成 AI 偏好");
  expect(zh).toContain("没有移除人类编写的原则、提示");
  expect(zh).toContain("位置偏差、冗长偏差、自我偏好与领域偏差");
  expect(zh).toContain("独立指标反而下降");
  expect(zh).toContain("不能证明训练后的模型真的改善了");
});

test("verifier-guided learning separates exact checks, learned process rewards, RLVR, and self-play", () => {
  expect(zh).toContain(String.raw`V(x,y)=1 \Longrightarrow C(x,y)=1`);
  expect(zh).toContain(String.raw`C(x,y)=1 \Longrightarrow V(x,y)=1`);
  expect(zh).toContain("可靠性防止错误回答被接纳，完备性防止有效回答被丢弃");
  expect(zh).toContain("学习得到的过程奖励模型仍是代理");
  expect(zh).toContain("并没有用强化学习训练生成器");
  expect(zh).toContain("RLVR 是另一种更新方式");
  expect(zh).toContain("不等于没有预训练数据或没有人工设计");
  expect(zh).toContain("两套系统不能只因都会生成课程就被视为同一种方法");
});

test("iteration distinguishes replacement, fixed-anchor, and accumulation regimes", () => {
  expect(zh).toContain("## 迭代会改变数据分布");
  for (const row of ["| 替换模式 |", "| 固定锚点模式 |", "| 累积模式 |"]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain(String.raw`q_{r+1}=\alpha p_R+(1-\alpha)p_{S_r}`);
  expect(zh).toContain("集合并集并不能决定每种来源的采样频率");
  expect(zh).toContain("不能缩写成「合成数据会导致崩溃」");
  expect(zh).toContain("取决于训练模式的结果，不是普适的安全混合比例");
});

test("recursive failure checks cover acceptance, diversity, contamination, curriculum, and lineage", () => {
  for (const row of [
    "| 错误接纳 |",
    "| 错误拒绝 |",
    "| 多样性损失 |",
    "| 基准污染 |",
    "| 课程漂移 |",
    "| 递归依赖 |",
  ]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("记录父记录 ID 与递归深度");
});

test("the auditable loop versions every round and isolates its holdout", () => {
  expect(zh).toContain("## 建立可审计的回路");
  expect(zh).toContain("生产中的基本单位不是「合成数据集」");
  expect(zh).toContain("输入：冻结的任务规格、来源混合 R、生成器 M_r、接纳流水线 A_r");
  for (const step of [
    "排除私有评测材料",
    "记录模型、模板、检索、解码与随机种子版本",
    "先去重并去污染",
    "分开执行确定性检查、习得评判者与策略规则",
    "估计假阳性率与假阴性率",
    "保留经过刻意设计的真实数据锚点",
    "从未向生成器和选择器开放的验证门槛",
    "只有能力、安全、多样性与污染门槛全部通过时才发布",
    "停止回路并隔离该轮数据",
  ]) {
    expect(zh).toContain(step);
  }
});

test("round-level provenance and promotion metrics remain operational", () => {
  for (const field of [
    "来源与许可证",
    "生成器检查点",
    "检索语料库",
    "父记录",
    "递归深度",
    "评判者或验证器版本",
    "去污染结果",
    "接纳原因",
  ]) {
    expect(zh).toContain(field);
  }
  expect(zh).toContain("必须位于数据构造之外");
  expect(zh).toContain("选择和认证都使用同一个评判者，只能测到自洽性");
  for (const row of ["| 数据构成 |", "| 过滤器行为 |", "| 覆盖范围 |", "| 外部结果 |"]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("预先声明停止与回滚阈值");
});

test("self-improvement claims remain bounded by independent evidence", () => {
  expect(zh).toContain("## 自我改进能证明什么，不能证明什么");
  expect(zh).toContain("都不能证明自主改进可以无限延续");
  expect(zh).toContain("必须在独立留出集上跨轮次取得改善");
  expect(zh).toContain("上层训练方法无法让下层证据变得比它本身更强");
  expect(zh).toContain("只是自动重复自己");
});

test("Chinese Chapter 23 preserves the complete English artifact contract", () => {
  expect(count(zh, /^## /gm)).toBe(count(en, /^## /gm));
  expect(count(zh, /^### /gm)).toBe(count(en, /^### /gm));
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^```\{=html\}$/gm)).toBe(count(en, /^```\{=html\}$/gm));
  expect(count(zh, /^```text$/gm)).toBe(count(en, /^```text$/gm));
  expect(count(zh, /^```python$/gm)).toBe(count(en, /^```python$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(count(zh, /^!\[/gm)).toBe(count(en, /^!\[/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("the Chapter 23 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the rewrite removes stale lineages and unsupported absolutes", () => {
  for (const rejected of [
    "同一个回路的四条路线",
    "答案一：借一个教师",
    "答案二：过滤模型自己的输出",
    "答案三：替换标注者",
    "答案四：根据检查器改进",
    "人工标注者逐步退出",
    "判断是真值，而不是代理",
    "一个不会接受错误答案的过滤器",
    "全程不用任何外部数据",
    "从零外部数据开始共同演化",
    "自我改进究竟能不能创造出真正全新的能力",
    "关键在 `judge` 这一行",
    "—",
  ]) {
    expect(zh).not.toContain(rejected);
  }
});
