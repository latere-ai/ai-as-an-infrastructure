import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/orientation/02-field-map.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/orientation/02-field-map.qmd"), "utf8");
const enFlat = en.replace(/\s+/g, " ");

test("Chapter 2 separates two processes from cross-cutting concerns", () => {
  expect(enFlat).toContain("Two processes and several cross-cutting concerns");
  for (const phrase of [
    "## 两个过程与若干贯穿全书的议题",
    "**模型开发过程**",
    "**请求执行过程**",
    "依赖关系",
    "反馈关系",
    "都不决定相关章节的阅读顺序",
  ]) expect(zh).toContain(phrase);
  expect(zh).not.toContain("/figures/field-map-1.svg");
});

test("the map presents selected dependencies and states every part's role", () => {
  expect(en).toContain("The layout is not a reading sequence");
  expect(zh).toContain("只画出第一至第十二部分之间的一部分依赖关系");
  expect(zh).toContain("实线箭头表示技术依赖，虚线箭头表示有代表性的反馈或贯穿性约束");
  expect(zh).toContain("并不表示阅读顺序");
  expect(zh).toContain("| 部分 | 核心问题 | 在本书中的作用 |");
  for (const part of ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII.", "IX.", "X.", "XI.", "XII."]) {
    expect(zh).toContain(`| ${part}`);
  }
});

test("dependencies and feedback preserve their direction and limits", () => {
  for (const phrase of [
    "全书编号只是编辑顺序",
    "运行时需求会反过来影响模型开发决策",
    "不是把小模型延长训练当作普遍准则",
    "重新训练模型无法修复运行时授权错误",
    "需要哪种属性",
    "哪个组件提供它",
  ]) expect(zh).toContain(phrase);
});

test("claim strength distinguishes mechanisms, evidence, and open questions", () => {
  expect(en).toContain("## How strong is a claim?");
  expect(zh).toContain("## 说法有多可靠？");
  expect(zh).toContain("| 说法类型 | 依据 | 阅读方式 |");
  expect(zh).toContain("| 定义明确的机制 |");
  expect(zh).toContain("| 经验规律 |");
  expect(zh).toContain("| 尚无定论的解释或设计问题 |");
  expect(zh).toContain("L(C) \\approx L_\\infty + A C^{-\\alpha}");
  expect(zh).toContain("特定数据分布、架构族和训练流程");
  expect(zh).toContain('data-xlabel="归一化训练算力"');
  expect(zh).toContain('data-ylabel="归一化可约损失"');
  expect(zh).not.toContain("都已不再有争议，是每个实验室共用的底座");
});

test("contested questions match the English reasoning, interpretability, and agent examples", () => {
  for (const phrase of [
    "**推理训练。**",
    "是否创造了新的任务相关能力",
    "**机械可解释性。**",
    "因果上忠实、稳定而且足够完整",
    "**智能体设计。**",
    "任务、失败成本、延迟预算和可用评测",
  ]) expect(zh).toContain(phrase);
});

test("scope, chapter questions, and evaluation dimensions follow the English structure", () => {
  expect(zh).toContain("## 本书范围与互补资料");
  expect(zh).toContain("| 目标 | 互补资料 |");
  expect(zh).toContain("本书关注的是这些专业领域之间的联系");
  expect(zh).toContain("各章并不套用同一套固定标题");
  expect(zh).toContain("1. 这个组件要解决什么问题或约束？");
  expect(zh).toContain("能力、效率和信任是三个评测问题，不是一笔固定预算");
});

test("reading routes replace the stale runnable and three-loop appendix", () => {
  expect(zh).toContain("## 选择阅读路线");
  expect(zh).toContain("| 如果目标是…… | 建议路线 |");
  expect(zh).toContain("建立完整的概念框架");
  expect(zh).toContain("开发应用或智能体");
  expect(zh).toContain("研究极限或有争议的能力主张");
  expect(zh).not.toContain("fig-field-map-three-loops");
  expect(zh).not.toContain("big_N, big_D");
  expect(zh).not.toContain("每个实质章节都走同一条结构");
});
