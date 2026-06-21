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

test("the viz runtime registers the paged-attention component", () => {
  expect(rt).toMatch(/R\['paged-attention'\]\s*=\s*function/);
});

test("ch17 memory-scheduling uses paged-attention in both languages", () => {
  expect(src("en/p4-inference/17-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
  expect(src("zh/p4-inference/17-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
});

test("the viz runtime registers the moe-routing component", () => {
  expect(rt).toMatch(/R\['moe-routing'\]\s*=\s*function/);
});

test("ch07 moe-ssm-hybrids uses moe-routing in both languages", () => {
  expect(src("en/p1-foundations/07-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
  expect(src("zh/p1-foundations/07-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
});

test("the viz runtime registers the tree-of-thoughts component", () => {
  expect(rt).toMatch(/R\['tree-of-thoughts'\]\s*=\s*function/);
});

test("ch13 eliciting-reasoning uses tree-of-thoughts in both languages", () => {
  expect(src("en/p3-reasoning/13-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
  expect(src("zh/p3-reasoning/13-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
});
