import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(new URL("../../en/adaptation/summary.qmd", import.meta.url), "utf8");
const zh = readFileSync(new URL("../../zh/adaptation/summary.qmd", import.meta.url), "utf8");

function bodyParagraphs(source: string): string[] {
  return source
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Part III summary preserves the missing-interface thesis", () => {
  expect(zh).toContain("从基座模型所缺的行为接口出发");
  expect(zh).toContain("都在界定模型应该保留哪些行为");
  expect(zh).toContain("必须有某种信号告诉模型，什么样的行为算得上更好");
  for (const mechanism of [
    "示范",
    "适配器",
    "行为规格",
    "偏好比较",
    "奖励模型",
    "直接偏好目标",
    "可核查奖励",
    "安全策略",
    "合成数据回路",
  ]) {
    expect(zh).toContain(mechanism);
  }
});

test("alignment remains governance over fragile signals", () => {
  expect(zh).toContain("最脆弱的正是这项信号本身");
  expect(zh).toContain("规格不充分时");
  expect(zh).toContain("把奖励当作博弈目标");
  expect(zh).toContain("实际表现没有改善，内部指标仍可能显得更好");
  expect(zh).toContain("对齐首先是一项治理问题");
  for (const governed of ["信号", "评审者", "过滤器", "验证器", "策略文本"]) {
    expect(zh).toContain(governed);
  }
});

test("the summary carries one evidence test into the inference-time handoff", () => {
  expect(zh).toContain("贯穿全书的检验标准很简单");
  expect(zh).toContain("信号由谁写出，怎样核查，在哪里失效，以及系统何时获准信任自身输出");
  expect(zh).toContain("合成数据、AI 反馈和验证器能把改善推进多远");
  expect(zh).toContain("评判者、过滤器或策略是否会成为新的能力上限");
  expect(zh).toContain("第四部分将问题转向推断时");
  for (const deferred of ["搜索", "核查", "工具调用", "推理轨迹", "额外计算"]) {
    expect(zh).toContain(deferred);
  }
});

test("the Chinese summary preserves the complete English prose contract", () => {
  expect(zh).toContain("# 小结 {#part-adaptation-summary .unnumbered}");
  expect(bodyParagraphs(zh)).toHaveLength(bodyParagraphs(en).length);
  expect(zh.match(/^## /gm) ?? []).toHaveLength(0);
  expect(zh.match(/@(?:sec|fig|gls)-[\w-]+/g) ?? []).toEqual(
    en.match(/@(?:sec|fig|gls)-[\w-]+/g) ?? [],
  );
  expect(zh.match(/@[a-z]+\d[\w-]*/g) ?? []).toEqual(en.match(/@[a-z]+\d[\w-]*/g) ?? []);
});

test("the rewrite removes literal and reader-directed phrasing", () => {
  for (const rejected of [
    "哪一种行为应该留下来",
    "信号可以被利用",
    "奖励就会沦为可钻空子的目标",
    "读者往下读时",
    "才会撞上",
    "—",
  ]) {
    expect(zh).not.toContain(rejected);
  }
});
