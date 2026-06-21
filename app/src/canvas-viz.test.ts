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

test("the viz runtime registers the infonce-field component", () => {
  expect(rt).toMatch(/R\['infonce-field'\]\s*=\s*function/);
});

test("ch27 embeddings-representation uses infonce-field in both languages", () => {
  expect(src("en/p5-orchestration/27-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
  expect(src("zh/p5-orchestration/27-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
});

test("the viz runtime registers the comparison-explorer component with both datasets", () => {
  expect(rt).toMatch(/R\['comparison-explorer'\]\s*=\s*function/);
  expect(rt).toContain("'agent-frameworks':");
  expect(rt).toContain("'agent-frameworks-zh':");
});

test("ch41 agents-and-sandboxes uses comparison-explorer, localized per language", () => {
  expect(src("en/p10-practical/41-agents-and-sandboxes.qmd")).toContain('data-set="agent-frameworks"');
  expect(src("zh/p10-practical/41-agents-and-sandboxes.qmd")).toContain('data-set="agent-frameworks-zh"');
});

test("the viz runtime registers nested-loops and bandwidth-tiers", () => {
  expect(rt).toMatch(/R\['nested-loops'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['bandwidth-tiers'\]\s*=\s*function/);
});

test("ch01 whole-stack uses nested-loops in both languages", () => {
  expect(src("en/p0-orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
  expect(src("zh/p0-orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
});

test("ch30 accelerators-networking uses bandwidth-tiers in both languages", () => {
  expect(src("en/p7-infrastructure/30-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
  expect(src("zh/p7-infrastructure/30-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
});
