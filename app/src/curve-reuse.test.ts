// Guard the curve-family reuses and the convention that zh curve labels are
// allowed to localize visible axis/slider text alongside the figcaption.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

test("the curve runtime registers the u-shape family", () => {
  expect(rt).toContain("'u-shape'");
});

test("zh viz blocks localize visible data-*label attributes", () => {
  // These attributes are rendered as visible axis and slider labels by the viz
  // runtime, so zh pages should be able to translate them. Sample a localized
  // orientation curve.
  const zh = src("zh/orientation/02-field-map.qmd");
  expect(zh).toContain('data-xlabel="归一化训练算力"');
  expect(zh).toContain('data-ylabel="归一化可约损失"');
  expect(zh).toContain('data-plabel="指数"');
});
