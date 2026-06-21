// Guard the bespoke 2D-canvas viz components and their homes.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("../../viz-runtime.html", import.meta.url), "utf8");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

test("the viz runtime registers the superposition component", () => {
  expect(rt).toMatch(/R\['superposition'\]\s*=\s*function/);
});

test("ch32 mechanistic-interpretability uses superposition in both languages", () => {
  expect(src("en/p8-safety/32-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
  expect(src("zh/p8-safety/32-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
});
