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

// Wave 2: steppers + curve reuses authored on existing components, both langs.
test("ch48 machine-that-breaks adds a prefill/decode stepper in both languages", () => {
  expect(src("en/p11-frontiers/48-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
  expect(src("zh/p11-frontiers/48-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
});

test("ch03 scaling-laws adds a u-shape compute-optimal curve in both languages", () => {
  expect(src("en/p1-foundations/03-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
  expect(src("zh/p1-foundations/03-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
});

test("ch36 adversarial-robustness adds swiss-cheese stepper + many-shot power-law, both languages", () => {
  for (const lang of ["en", "zh"]) {
    const t = src(`${lang}/p8-safety/36-adversarial-robustness.qmd`);
    expect(t).toContain('data-chip="CIRCUIT BREAKERS"');
    expect(t).toContain('data-viz="curve" data-family="power-grow"');
  }
});

// Wave 3: bespoke canvas components for the remaining catalog spots.
test("the viz runtime registers judge-kappa, outlier-quant, minhash-buckets, blast-radius", () => {
  for (const name of ["judge-kappa", "outlier-quant", "minhash-buckets", "blast-radius"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("wave-3 components are used in their chapters, both languages", () => {
  const uses: [string, string][] = [
    ["p10-practical/43-evaluation-and-observability", "judge-kappa"],
    ["p4-inference/19-quantization-kernels", "outlier-quant"],
    ["p1-foundations/04-data-curation", "minhash-buckets"],
    ["p8-safety/34-security-authorization", "blast-radius"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});
