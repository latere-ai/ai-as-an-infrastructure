import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(new URL("../../en/reasoning/index.qmd", import.meta.url), "utf8");
const zh = readFileSync(new URL("../../zh/reasoning/index.qmd", import.meta.url), "utf8");

function bodyParagraphs(source: string): string[] {
  const quoteEnd = source.indexOf("\n\n", source.indexOf("https://"));
  return source
    .slice(quoteEnd + 2)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("the Part IV epigraph preserves the source in natural Chinese", () => {
  expect(zh).toContain("生成思维链");
  expect(zh).toContain("能显著提升大型语言模型完成复杂推理任务的能力");
  expect(zh).toContain("Jason Wei 等");
  expect(zh).toContain("Chain-of-Thought Prompting Elicits Reasoning in Large Language Models");
  expect(zh).toContain("https://arxiv.org/abs/2201.11903");
});

test("the opening defines reasoning by when and how computation is spent", () => {
  for (const phrase of [
    "把推理看成网络内部新增的某个专门模块",
    "推理是在答案确定之前投入计算的一种方式",
    "额外计算发生在模型作答期间，而不是训练期间",
    "这就是标题中的「测试时算力」",
    "由提示引导",
    "组织为搜索",
    "交给程序、求解器或证明检查器",
    "在训练中让模型习得推理",
    "按问题难度选择处理路线",
  ]) expect(zh).toContain(phrase);
});

test("the first four chapters preserve their distinct control and verification roles", () => {
  expect(zh).toContain("给模型留出展开推理的空间，同时不把单次采样当作可靠答案");
  expect(zh).toContain("链只走一条路径，树保留多个备选分支，图则复用已经完成的局部工作");
  expect(zh).toContain("模型负责写出程序、查询、符号推导或证明脚本");
  expect(zh).toContain("再由外部运行环境执行或核查");
  expect(zh).toContain("从单元测试和答案检查器，到过程奖励模型与生成式验证器");
});

test("training, reasoning data, and test-time scaling remain separate routes", () => {
  expect(zh).toContain("把这项成本前移到训练阶段");
  expect(zh).toContain("可核查奖励（奖励来自可以自动核查的答案）");
  expect(zh).toContain("让有效的推理方式成为稳定习惯，而不必每次临时组织");
  expect(zh).toContain("推理轨迹本身成为训练数据");
  expect(zh).toContain("自生成的推理过程");
  expect(zh).toContain("从长推理到短推理的迁移");
  expect(zh).toContain("把测试时计算作为一种需要分配的预算");
  expect(zh).toContain("生产系统中的过度推理问题");
});

test("the closing preserves the complete engineering test", () => {
  expect(zh).toContain("额外工作的成本由哪一层承担，由谁核查，又由什么数据记录");
  expect(zh).toContain("增加计算究竟扩大了候选覆盖面、改善了选择，还是两者兼有");
  expect(zh).toContain("经过推理训练的模型和测试时扩展系统");
  expect(zh).toContain("不再显得神秘，而成为可以比较和取舍的工程选择");
});

test("the Chinese opener preserves the complete English structure and links", () => {
  expect(bodyParagraphs(en)).toHaveLength(4);
  expect(bodyParagraphs(zh)).toHaveLength(4);
  expect(uniqueMatches(zh, /(@sec-[A-Za-z0-9_-]+)/g)).toEqual(
    uniqueMatches(en, /(@sec-[A-Za-z0-9_-]+)/g),
  );
  expect(uniqueMatches(zh, /\]\((https?:\/\/[^)]+)\)/g)).toEqual(
    uniqueMatches(en, /\]\((https?:\/\/[^)]+)\)/g),
  );
});

test("the rewrite removes mixed-language and translated phrasing", () => {
  for (const rejected of [
    "某个专门机制",
    "这份计算可以放在提示里",
    "不再把单次采样当作最终答案",
    "自生成 rationale",
    "long-to-short 迁移",
    "这样一来",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
