// Guard the bespoke 2D-canvas viz components and their homes.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

test("the viz runtime registers the superposition component", () => {
  expect(rt).toMatch(/R\['superposition'\]\s*=\s*function/);
});

test("viz theme reads palette vars from .reader, not body's default-black color", () => {
  // getComputedStyle(document.body).color defaults to black, invisible on the
  // dark canvas. The theme must read --fg-1/--bg-surface off .reader instead.
  const theme = rt.slice(rt.indexOf("function theme()"), rt.indexOf("function el("));
  expect(theme).toContain("querySelector('.reader')");
  expect(theme).toContain("getPropertyValue('--fg-1')");
  expect(theme).toContain("getPropertyValue('--bg-surface')");
  expect(theme).not.toContain("getComputedStyle(document.body)");
});

test("ch32 mechanistic-interpretability uses superposition in both languages", () => {
  expect(src("en/safety/01-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
  expect(src("zh/safety/01-mechanistic-interpretability.qmd")).toContain('data-viz="superposition"');
});

test("the viz runtime registers the paged-attention component", () => {
  expect(rt).toMatch(/R\['paged-attention'\]\s*=\s*function/);
});

test("ch17 memory-scheduling uses paged-attention in both languages", () => {
  expect(src("en/inference/02-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
  expect(src("zh/inference/02-memory-scheduling.qmd")).toContain('data-viz="paged-attention"');
});

test("the viz runtime registers the moe-routing component", () => {
  expect(rt).toMatch(/R\['moe-routing'\]\s*=\s*function/);
});

test("ch07 moe-ssm-hybrids uses moe-routing in both languages", () => {
  expect(src("en/foundations/05-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
  expect(src("zh/foundations/05-moe-ssm-hybrids.qmd")).toContain('data-viz="moe-routing"');
});

test("the viz runtime registers the tree-of-thoughts component", () => {
  expect(rt).toMatch(/R\['tree-of-thoughts'\]\s*=\s*function/);
});

test("ch13 eliciting-reasoning uses tree-of-thoughts in both languages", () => {
  expect(src("en/reasoning/01-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
  expect(src("zh/reasoning/01-eliciting-reasoning.qmd")).toContain('data-viz="tree-of-thoughts"');
});

test("the viz runtime registers the infonce-field component", () => {
  expect(rt).toMatch(/R\['infonce-field'\]\s*=\s*function/);
});

test("ch27 embeddings-representation uses infonce-field in both languages", () => {
  expect(src("en/orchestration/07-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
  expect(src("zh/orchestration/07-embeddings-representation.qmd")).toContain('data-viz="infonce-field"');
});

test("the viz runtime registers the comparison-explorer component with both datasets", () => {
  expect(rt).toMatch(/R\['comparison-explorer'\]\s*=\s*function/);
  expect(rt).toContain("'agent-frameworks':");
  expect(rt).toContain("'agent-frameworks-zh':");
});

test("ch41 agents-and-sandboxes uses comparison-explorer, localized per language", () => {
  expect(src("en/practice/05-agents-and-sandboxes.qmd")).toContain('data-set="agent-frameworks"');
  expect(src("zh/practice/05-agents-and-sandboxes.qmd")).toContain('data-set="agent-frameworks-zh"');
});

test("the viz runtime registers nested-loops and bandwidth-tiers", () => {
  expect(rt).toMatch(/R\['nested-loops'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['bandwidth-tiers'\]\s*=\s*function/);
});

test("ch01 whole-stack uses nested-loops in both languages", () => {
  expect(src("en/orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain('data-viz="nested-loops"');
});

test("ch30 accelerators-networking uses bandwidth-tiers in both languages", () => {
  expect(src("en/infrastructure/01-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
  expect(src("zh/infrastructure/01-accelerators-networking.qmd")).toContain('data-viz="bandwidth-tiers"');
});

// Wave 2: steppers + curve reuses authored on existing components, both langs.
test("ch48 machine-that-breaks adds a prefill/decode stepper in both languages", () => {
  expect(src("en/infrastructure/06-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
  expect(src("zh/infrastructure/06-the-machine-that-breaks.qmd")).toContain('data-chip="PREFILL"');
});

test("human-interface oversight adds an approval stepper in both languages", () => {
  expect(src("en/practice/11-human-interface-oversight.qmd")).toContain('data-viz="stepper"');
  expect(src("en/practice/11-human-interface-oversight.qmd")).toContain('data-chip="APPROVE"');
  expect(src("zh/practice/11-human-interface-oversight.qmd")).toContain('data-viz="stepper"');
  expect(src("zh/practice/11-human-interface-oversight.qmd")).toContain('data-chip="批准"');
});

test("ch03 scaling-laws adds a u-shape compute-optimal curve in both languages", () => {
  expect(src("en/foundations/01-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
  expect(src("zh/foundations/01-scaling-laws.qmd")).toContain('data-viz="curve" data-family="u-shape"');
});

test("ch36 adversarial-robustness adds swiss-cheese stepper + many-shot power-law, both languages", () => {
  for (const lang of ["en", "zh"]) {
    const t = src(`${lang}/safety/05-adversarial-robustness.qmd`);
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
    ["practice/07-evaluation-and-observability", "judge-kappa"],
    ["inference/04-quantization-kernels", "outlier-quant"],
    ["foundations/02-data-curation", "minhash-buckets"],
    ["safety/03-security-authorization", "blast-radius"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

// Wave 4: ch09 LoRA low-rank reconstruction + task arithmetic.
test("the viz runtime registers lora-lowrank and task-arithmetic", () => {
  expect(rt).toMatch(/R\['lora-lowrank'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['task-arithmetic'\]\s*=\s*function/);
});

test("ch09 sft-peft uses lora-lowrank and task-arithmetic in both languages", () => {
  for (const lang of ["en", "zh"]) {
    const t = src(`${lang}/adaptation/01-sft-peft.qmd`);
    expect(t).toContain('data-viz="lora-lowrank"');
    expect(t).toContain('data-viz="task-arithmetic"');
  }
});

// Wave 5: the deep-catalog tail of bespoke components.
test("the viz runtime registers the wave-5 components", () => {
  for (const name of ["grpo-advantage", "ssm-vs-attention", "rl-timeline", "rrf-fusion", "decision-tree", "float-bits", "pipeline-bubble"]) {
    expect(rt).toMatch(new RegExp("R\\['" + name + "'\\]\\s*=\\s*function"));
  }
});

test("wave-5 components are used in their chapters, both languages", () => {
  const uses: [string, string][] = [
    ["reasoning/02-training-to-reason", "grpo-advantage"],
    ["foundations/05-moe-ssm-hybrids", "ssm-vs-attention"],
    ["orchestration/01-training-agents-to-act", "rl-timeline"],
    ["orchestration/06-rag-retrieval", "rrf-fusion"],
    ["practice/01-choosing-a-model", "decision-tree"],
    ["foundations/06-training-at-scale", "float-bits"],
    ["foundations/06-training-at-scale", "pipeline-bubble"],
  ];
  for (const [path, viz] of uses) {
    for (const lang of ["en", "zh"]) {
      expect(src(`${lang}/${path}.qmd`)).toContain(`data-viz="${viz}"`);
    }
  }
});

test("the viz runtime registers the ROI balance component", () => {
  expect(rt).toMatch(/R\['roi-balance'\]\s*=\s*function/);
});

test("adoption-productivity uses ROI balance in both languages", () => {
  expect(src("en/ecosystem/05-adoption-productivity.qmd")).toContain('data-viz="roi-balance"');
  expect(src("zh/ecosystem/05-adoption-productivity.qmd")).toContain('data-viz="roi-balance"');
  expect(src("zh/ecosystem/05-adoption-productivity.qmd")).toContain('data-lang="zh"');
});

test("the viz runtime registers evaluation power and frontier components", () => {
  expect(rt).toMatch(/R\['eval-power'\]\s*=\s*function/);
  expect(rt).toMatch(/R\['eval-frontier'\]\s*=\s*function/);
});

test("expanded evaluation chapters use the new interactive visualizations in both languages", () => {
  for (const lang of ["en", "zh"]) {
    expect(src(`${lang}/evaluation/02-statistical-reliability.qmd`)).toContain('data-viz="eval-power"');
    expect(src(`${lang}/evaluation/07-operational-evaluation.qmd`)).toContain('data-viz="eval-frontier"');
  }
});
