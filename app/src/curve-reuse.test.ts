// Guard the curve-family reuses and the convention that viz data-*labels stay
// English in zh (only the figcaption is translated, matching every existing
// curve block).

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

test("zh viz blocks keep English data-*label attributes (translate only the caption)", () => {
  // The zh curve <div> is byte-identical to en; a Chinese label would break the
  // book-wide convention. Sample the reliability home.
  const zh = src("zh/practice/10-reliability-nondeterministic.qmd");
  expect(zh).toContain('data-plabel="per-step reliability p"');
});
