import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/generative/summary.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/summary.qmd", import.meta.url),
  "utf8",
);

function paragraphs(source: string): string[] {
  return source
    .split(/\n\s*\n/)
    .slice(1)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Part II summary preserves the English three-part argument", () => {
  expect(paragraphs(en)).toHaveLength(3);
  expect(paragraphs(zh)).toHaveLength(3);
  expect(zh).toContain("并非天然按词元排列的生成对象");
  expect(zh).toContain("构造顺序必然有代价");
  expect(zh).toContain("多模态架构的核心，是为原本没有明确顺序的对象构造顺序");
});

test("the recap retains every generation regime named in English", () => {
  for (const phrase of [
    "扩散与流匹配",
    "非自回归语言模型",
    "语音",
    "图像",
    "视频",
    "世界模型",
    "机器人系统",
  ]) expect(zh).toContain(phrase);

  expect(zh).toContain("据此学习、采样、缓存并评测结果");
});

test("the constructed-order trade-offs remain explicit", () => {
  expect(zh).toContain("有些表示方式便于训练，却会增加服务难度");
  expect(zh).toContain("提高采样保真度，往往意味着延迟成倍增加");
  expect(zh).toContain("多模态融合还可能让证据来源变得模糊");
  expect(zh).toContain("关键不在于覆盖了多少种模态");
  expect(zh).toContain("现实世界的物体或感知信号转换成模型可以处理的表示时，需要付出什么代价");
});

test("the open question moves the bottleneck from models to physical-world data", () => {
  expect(zh).toContain("能否表现出接近文本数据的扩展规律");
  expect(zh).toContain("瓶颈就会从模型设计转移到物理世界数据的采集、复用和验证");
});

test("the handoff to Part III asks which behaviors to shape", () => {
  expect(zh).toContain("第三部分会回到行为本身");
  expect(zh).toContain("模型能够依照这些顺序完成生成之后");
  expect(zh).toContain("哪些行为该鼓励、哪些该拒绝，又该如何排序或纠正");
});

test("the Chinese summary avoids literal and vague framing", () => {
  for (const rejected of [
    "文本主线",
    "顺序从不免费",
    "表面上讲模态",
    "具身经验、机器人数据和世界模型训练",
    "数据的收集、继承和验证",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
