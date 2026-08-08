import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/foundations/summary.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/foundations/summary.qmd", import.meta.url),
  "utf8",
);

function paragraphs(source: string): string[] {
  return source
    .split(/\n\s*\n/)
    .slice(1)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Part I summary preserves the English three-part argument", () => {
  expect(paragraphs(en)).toHaveLength(3);
  expect(paragraphs(zh)).toHaveLength(3);
  expect(zh).toContain("第一部分讨论的是基座模型在成为产品之前如何形成");
  expect(zh).toContain("贯穿这一部分的主线，是这些选择往往难以逆转");
  expect(zh).toContain("基座模型的形成本身就是基础设施，而非背景知识");
});

test("the formation recap names every inherited design choice", () => {
  for (const phrase of [
    "规模与算力预算",
    "筛选数据",
    "把字节转换成词元",
    "Transformer 变体",
    "在整个集群上稳定跑完",
    "质量、领域混合、专门化程度和上下文长度",
  ]) expect(zh).toContain(phrase);
});

test("irreversibility remains bounded rather than absolute", () => {
  for (const phrase of [
    "数据混合、词表、架构、数值精度、并行方案，以及继续训练时的数据安排",
    "都会成为后续系统继承的约束",
    "可以补偿其中一部分影响，却无法随意改写这些选择",
  ]) expect(zh).toContain(phrase);
});

test("the scaling question remains open and testable", () => {
  expect(zh).toContain("自然语料日渐稀缺、硬件成本约束不断收紧");
  expect(zh).toContain("继续扩大规模还有多少空间");
  expect(zh).toContain("有待检验的可能性，而不是可以预设的承诺");
});

test("the handoff to Part II explains constructed order", () => {
  expect(zh).toContain("本书没有紧接着讨论后训练，而是先在第二部分转向另一类生成问题");
  expect(zh).toContain("系统必须为这些对象构造一种顺序，训练、采样、缓存和评测才有可操作的基础");
  expect(zh).toContain("不是在文本之后罗列更多媒体格式");
  expect(zh).toContain("不天然以字符串形式出现的对象");
});

test("the Chinese summary avoids literal and unsupported framing", () => {
  for (const rejected of [
    "跟随基座模型在成为产品之前怎样形成",
    "自然语料变薄",
    "硬件经济性变紧",
    "第一笔基础设施投资",
    "制造可训练、可采样、可评估的顺序",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
