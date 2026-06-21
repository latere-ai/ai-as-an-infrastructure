// Guard the curve-family reuses and the convention that zh curve labels are
// allowed to localize visible axis/slider text alongside the figcaption.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("../../viz-runtime.html", import.meta.url), "utf8");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

test("the curve runtime registers the pow-base, u-shape, and elo families", () => {
  expect(rt).toContain("'pow-base'");
  expect(rt).toContain("'u-shape'");
  expect(rt).toMatch(/elo:\s*function/);
});

const homes: [string, string][] = [
  ["en/practice/10-reliability-nondeterministic.qmd", "pow-base"],
  ["en/infrastructure/08-the-capability-horizon.qmd", "logistic"],
  ["en/orchestration/08-context-engineering.qmd", "u-shape"],
  ["en/evaluation/02-judging-holistic.qmd", "elo"],
];

test("each curve-reuse home uses its family in both languages", () => {
  for (const [en, fam] of homes) {
    const zh = en.replace(/^en\//, "zh/");
    for (const p of [en, zh]) expect(src(p)).toContain(`data-family="${fam}"`);
  }
});

test("zh viz blocks localize visible data-*label attributes", () => {
  // These attributes are rendered as visible axis and slider labels by the viz
  // runtime, so zh pages should be able to translate them. Sample a localized
  // orientation curve.
  const zh = src("zh/orientation/02-field-map.qmd");
  expect(zh).toContain('data-xlabel="训练算力（FLOPs）"');
  expect(zh).toContain('data-ylabel="损失"');
  expect(zh).toContain('data-plabel="指数"');
});
