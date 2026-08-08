import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/index.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/index.qmd"), "utf8");

test("the Chinese Preface preserves the English opening without added examples", () => {
  expect(en).toContain("model capability, training compute, accelerator supply");
  expect(zh).toContain("模型能力、训练算力、加速器供给、推断流量、数据中心电力和公众预期");
  expect(zh).toContain("搜索框、IDE、呼叫中心、课堂和政务流程");
  expect(zh).toContain("劳动、教育、媒体和监管");
  expect(zh).not.toContain("软件采用速度");
  expect(zh).not.toContain("实验记录");
});

test("the Chinese Preface states the cross-layer argument in native prose", () => {
  for (const phrase of [
    "局部决策就不再只影响局部",
    "本书关注的，正是这些层彼此衔接的地方",
    "从原始算力和语料构建开始",
    "既要讲清「怎么运行」，也要同样清楚地回答「为什么要这样设计」",
  ]) expect(zh).toContain(phrase);

  for (const calque of [
    "基准的移动",
    "最深操作手册",
    "那些纵深",
    "回应这个问题的设计",
    "本书按持续版本写作",
    "把它们粉饰过去",
  ]) expect(zh).not.toContain(calque);
});

test("the Chinese roadmap covers every English part with matching scope", () => {
  expect(zh.match(/^- \*\*第[^*]+部分[，,]/gm)?.length).toBe(13);
  for (const phrase of [
    "扩展律、数据、分词、模型架构、大规模训练",
    "非自回归与扩散语言模型",
    "行为规格、偏好数据、RLHF、直接偏好优化",
    "推理能力的引出、结构化搜索、程序与求解器、验证器",
    "训练智能体去行动、智能体架构、记忆、个性化",
    "模型制品与供应链",
    "SLO、成本治理、事故和多租户",
  ]) expect(zh).toContain(phrase);
});

test("the audience, living-draft note, and disclosure remain complete", () => {
  expect(zh).toContain("本书写给构建和运营 AI 系统的工程师");
  expect(zh).toContain("也写给想了解理论如何进入生产环境的研究者");
  expect(zh).toContain("本书是一部持续更新、按版本演进的草稿");
  expect(zh).toContain("并不意味着它们优于其他方案");
  expect(zh).toContain("@sec-tooling-ecosystem");
  expect(zh.match(/::: \{\.callout-note\}/g)?.length).toBe(2);
});
