// Guard the cost-crossover interactive figure: the component stays registered in
// the viz runtime, and the four economics/practical homes keep using it.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const homes = [
  "en/ecosystem/04-economics.qmd",
  "en/practice/01-choosing-a-model.qmd",
  "en/practice/04-training-finetuning-practice.qmd",
  "en/practice/08-wiring-a-2026-stack.qmd",
];

test("the viz runtime registers the cost-crossover component", () => {
  expect(rt).toMatch(/R\['cost-crossover'\]\s*=\s*function/);
});

test("the cost crossover can localize its crossover label", () => {
  const start = rt.indexOf("R['cost-crossover']");
  const end = rt.indexOf("R['roi-balance']", start);
  const component = rt.slice(start, end);

  expect(component).toContain("data-crossover-label");
  const zh = readFileSync(
    new URL("../../zh/practice/08-wiring-a-2026-stack.qmd", import.meta.url),
    "utf8",
  );
  expect(zh).toContain('data-crossover-label="交叉点"');
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
