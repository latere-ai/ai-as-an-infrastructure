// Regression test: stripCjkSoftBreaks joins wrapped CJK prose lines, but a
// heading line is a complete block and must not absorb the line after it.
// A callout whose "## Title" is immediately followed by a CJK body line (no
// author blank line) would otherwise fold the body into the pulled callout
// title, so inline cross-refs in that body never render. See the constraint
// arrow callouts in zh/p8-safety/*.qmd.

import { test, expect } from "bun:test";
import { stripCjkSoftBreaks } from "./cjk.ts";

test("a heading line is not joined with the following CJK body line", () => {
  const src = ["## 约束箭头", "一个已部署模型的暴露面，由 @sec-scaling-laws 设定。"].join("\n");
  const out = stripCjkSoftBreaks(src).split("\n");
  expect(out[0]).toBe("## 约束箭头");
  expect(out[0]).not.toContain("一个已部署");
});

test("wrapped CJK prose lines are still joined (no stray gap)", () => {
  const src = ["一个已部署模型的隐私暴露面", "在服务开始之前就已固定。"].join("\n");
  const out = stripCjkSoftBreaks(src).split("\n");
  expect(out[0]).toBe("一个已部署模型的隐私暴露面在服务开始之前就已固定。");
});
