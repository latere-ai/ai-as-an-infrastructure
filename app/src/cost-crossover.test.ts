// Guard the cost-crossover interactive figure: the component stays registered in
// the viz runtime, and the four economics/practical homes keep using it.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("../../viz-runtime.html", import.meta.url), "utf8");
const homes = [
  "en/p9-ecosystem/37-economics.qmd",
  "en/p10-practical/38-choosing-a-model.qmd",
  "en/p10-practical/40-training-finetuning-practice.qmd",
  "en/p10-practical/44-wiring-a-2026-stack.qmd",
];

test("the viz runtime registers the cost-crossover component", () => {
  expect(rt).toMatch(/R\['cost-crossover'\]\s*=\s*function/);
});

test("each economics/practical home uses cost-crossover in both languages", () => {
  for (const en of homes) {
    const zh = en.replace(/^en\//, "zh/");
    for (const p of [en, zh]) {
      const src = readFileSync(new URL("../../" + p, import.meta.url), "utf8");
      expect(src).toContain('data-viz="cost-crossover"');
    }
  }
});
