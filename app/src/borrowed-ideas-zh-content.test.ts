import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/orientation/03-borrowed-ideas.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/orientation/03-borrowed-ideas.qmd"), "utf8");

test("Chapter 3 distinguishes four strengths of cross-disciplinary transfer", () => {
  expect(en).toContain("| Relationship | What must survive the transfer | Example in this chapter |");
  expect(zh).toContain("| <span style=\"white-space: nowrap\">关系</span> | <span style=\"display: inline-block; min-width: 14em\">跨领域后必须保留什么</span>");
  for (const relationship of ["形式恒等", "计算对应", "数学方法的移植", "启发式类比"]) {
    expect(zh).toContain(`**<span style="white-space: nowrap">${relationship}</span>**`);
  }
  for (const question of ["**映射：**", "**保留：**", "**迁移：**", "**边界：**"]) {
    expect(zh).toContain(question);
  }
  expect(zh).not.toContain("/figures/borrowed-ideas-1.svg");
});

test("prediction loss is presented as an exact coding identity with operational limits", () => {
  expect(zh).toContain("## 形式恒等：预测损失与编码长度");
  expect(zh).toContain("q(x_{1:n})=\\prod_{t=1}^{n}q(x_t\\mid x_{<t})");
  expect(zh).toContain("L_q(x_{1:n})=-\\log_2 q(x_{1:n})");
  expect(zh).toContain("\\lceil-\\log_2 q(x)\\rceil");
  expect(zh).toContain("理想编码长度");
  expect(zh).toContain("不会生成文件，也没有计入传输模型本身的成本");
  expect(zh).toContain("48.0%");
  expect(zh).toContain("21.0%");
  expect(zh).not.toContain("43.4%");
  expect(zh).not.toContain("16.4%");
});

test("MDL and compression claims keep model cost and empirical scope explicit", () => {
  expect(zh).toContain("L(M)+L(D\\mid M)");
  expect(zh).toContain("固定模型族");
  expect(zh).toContain("通常不会计入架构、学习得到的权重或权重精度");
  expect(zh).toContain("Kolmogorov 复杂度");
  expect(zh).toContain("-0.93");
  expect(zh).toContain("相关性");
  expect(zh).not.toContain("-0.95");
  expect(zh).not.toContain("压缩就是智能，即");
});

test("TD error section states the algorithm, evidence, and biological boundary", () => {
  expect(zh).toContain("## 计算对应：TD 误差与多巴胺");
  expect(zh).toContain("\\delta_t=r_{t+1}+\\gamma V_w(s_{t+1})-V_w(s_t)");
  expect(zh).toContain("w_{t+1}=w_t+\\alpha\\delta_t\\nabla_w V_w(s_t)");
  expect(zh).toContain("半梯度更新");
  expect(zh).toContain("意外奖励");
  expect(zh).toContain("预期奖励没有出现");
  expect(zh).toContain("并不能说明多巴胺实现了完整的 TD 算法");
  expect(zh).toContain("多巴胺活动并不均一");
});

test("mathematical imports retain constructions without claiming physical mechanisms", () => {
  expect(zh).toContain("## 只移植数学，不移植物理机制");
  expect(zh).toContain("q(x_t\\mid x_{t-1})");
  expect(zh).toContain("p_\\theta(x_{t-1}\\mid x_t)");
  expect(zh).toContain("并不意味着图像生成器内部存在热量");
  expect(zh).toContain("进化策略");
  expect(zh).toContain("变异与选择");
  expect(zh).toContain("基因、个体或生态竞争");
});

test("emergence section separates benchmark cliffs from phase-transition evidence", () => {
  expect(zh).toContain("## 争议所在：涌现是不是相变？");
  expect(zh).toContain("精确匹配准确率");
  expect(zh).toContain("有序参量");
  expect(zh).toContain("临界点附近应有的标度行为");
  expect(zh).toContain("假设或类比，而不是已经确立的机制");
  expect(zh).not.toContain("所报告的涌现能力里有九成以上");
});

test("heuristic analogies end with an explicit three-row boundary table", () => {
  expect(zh).toContain("## 启发式类比：名称保留了什么");
  expect(zh).toContain("AI 保留了什么</span> | <span");
  for (const term of ["神经元", "注意力", "系统 1 / 系统 2"]) {
    expect(zh).toContain(`**<span style="white-space: nowrap">${term}</span>**`);
  }
  expect(zh).toContain("熟悉感替尚未测量的说法提供证据");
  expect(zh).toContain("恒等关系、科学模型、移植来的工具，还是帮助理解的图景");
});

test("Chinese borrowed-term labels do not collapse to one character per line", () => {
  for (const term of ["关系", "形式恒等", "计算对应", "数学方法的移植", "启发式类比", "借来的术语", "神经元", "注意力", "系统 1 / 系统 2"]) {
    expect(zh).toContain(`<span style="white-space: nowrap">${term}</span>`);
  }
  for (const heading of ["跨领域后必须保留什么", "AI 保留了什么"]) {
    expect(zh).toContain(`<span style="display: inline-block; min-width: 14em">${heading}</span>`);
  }
  for (const heading of ["本章示例", "类比在哪里失效"]) {
    expect(zh).toContain(`<span style="display: inline-block; min-width: 12em">${heading}</span>`);
  }
});
