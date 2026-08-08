import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/generative/index.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/index.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("the Part II epigraph preserves the source and natural Chinese", () => {
  expect(zh).toContain("直接从描述图像的原始文本中学习，是一种很有前景的替代方案");
  expect(zh).toContain("Alec Radford 等");
  expect(zh).toContain("Learning Transferable Visual Models From Natural Language Supervision");
  expect(zh).toContain("https://arxiv.org/abs/2103.00020");
});

test("the opening frames non-sequential generation as a parallel track", () => {
  for (const phrase of [
    "第一部分构建了让模型处理词元的整套机制",
    "沿着一条并行路线展开",
    "生成对象本身并不是一串天然从左到右排列的字符串",
    "模型必须生成连贯的结果",
    "生成对象未必存在唯一的自然顺序",
  ]) expect(zh).toContain(phrase);
});

test("the autoregressive lifecycle resumes in Part III without a succession claim", () => {
  expect(zh).toContain("自回归语言模型的生命周期将在第三部分继续");
  expect(zh).toContain("与它并行发展的其他架构，而不是取代它的后继者");
});

test("the chapter route preserves each English mechanism and tradeoff", () => {
  expect(zh).toContain("模型学习的不再是序列中的下一个词元，而是一条从噪声通往结构的路径");
  expect(zh).toContain("放弃自回归模型的缓存能力与简洁清晰的服务方式后，得到了什么，又失去了什么");
  expect(zh).toContain("语音识别、语音生成、视觉与语言融合、图像生成和视频");
  expect(zh).toContain("持续、可靠且扎根现实的经验数据流");
});

test("the closing identifies invented order with architecture", () => {
  expect(zh).toContain("本部分不是媒体格式的导览，而是研究顺序如何被构造");
  expect(zh).toContain("系统为模型构造了怎样的序列，训练、缓存、采样和评测才得以进行");
  expect(zh).toContain("架构正是这套人为构造的顺序");
});

test("the Chinese intro preserves the English cross-reference and link contract", () => {
  expect(uniqueMatches(zh, /(@sec-[A-Za-z0-9_-]+)/g)).toEqual(
    uniqueMatches(en, /(@sec-[A-Za-z0-9_-]+)/g),
  );
  expect(uniqueMatches(zh, /\]\((https?:\/\/[^)]+)\)/g)).toEqual(
    uniqueMatches(en, /\]\((https?:\/\/[^)]+)\)/g),
  );
});

test("the rewrite removes unsupported and literal framing", () => {
  for (const rejected of [
    "搭好了处理词元的模型机制",
    "学习怎样从条件走向结果",
    "这里的架构是它的旁支",
    "为什么有吸引力",
    "被压缩成模型可以共同处理的表示",
    "这一部分表面上在讲多种模态",
    "又为这套顺序付出了什么",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
