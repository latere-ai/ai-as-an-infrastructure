import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/02-serving-and-compute.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/serving-and-compute.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines serving as a versioned operating contract", () => {
  expect(chapter).toMatch(
    /^# Serving, Gateways, and Compute \{#sec-serving-stack\}/,
  );
  for (const phrase of [
    "versioned serving contract",
    "request semantics",
    "deadline and cancellation",
    "streaming and error behavior",
    "data classification and region",
    "side-effect class",
    "adapter conformance",
  ]) expect(flat).toContain(phrase);
});

test("latency and capacity are measured on the complete served system", () => {
  for (const marker of [
    "T_{\\mathrm{e2e}}",
    "T_{\\mathrm{queue}}",
    "T_{\\mathrm{prefill}}",
    "T_{\\mathrm{decode},k}",
    "T_{\\mathrm{tools}}",
    "\\lambda < \\mu_g",
    "g_{\\min}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "time to first token",
    "time per output token",
    "production-shaped",
    "offered load",
    "saturation",
    "p50",
    "p95",
    "p99",
    "cost per accepted task",
  ]) expect(flat).toContain(phrase);
});

test("engine mechanisms state their limits instead of promising defaults", () => {
  for (const phrase of [
    "iteration-level scheduling",
    "pagedattention",
    "exact tokenized prefix",
    "syntax, not semantic correctness",
    "kv transfer",
    "quantization",
    "exact artifact",
    "exact hardware",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("table stakes by 2026");
  expect(flat).not.toContain("the dominant win for agents and rag");
  expect(flat).not.toContain("sensible default");
});

test("gateway routing preserves policy and action safety", () => {
  for (const phrase of [
    "design option",
    "common transport subset",
    "allowed candidate set",
    "reserve the budget atomically",
    "remaining deadline",
    "idempotency key",
    "ambiguous outcome",
    "policy-compatible fallback",
    "fail closed",
    "trace context",
    "translation loss",
    "before the first byte",
    "partial-stream failure",
    "retry owner",
    "logical request ledger",
    "invoice reconciliation",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("self-hosted and hosted models become interchangeable");
  expect(flat).not.toContain("swapping models or adding a fallback is configuration");
  expect(flat).not.toContain("hard spend caps");
  expect(flat).not.toContain("single most cited reason");
});

test("compute procurement is evaluated without a magic utilization threshold", () => {
  for (const phrase of [
    "first-party api",
    "managed endpoint",
    "self-managed",
    "billing quantum",
    "capacity guarantee",
    "cold-start",
    "interruption",
    "egress",
    "low, base, and high demand",
    "capacity steps",
    "redundancy",
    "headroom",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toMatch(/40\s*(?:to|–|-)\s*50 percent/);
  expect(flat).not.toContain("serverless is cheaper");
});

test("orchestration follows workload requirements", () => {
  for (const phrase of [
    "long-lived service",
    "rolling deployment",
    "readiness",
    "gang scheduling",
    "checkpoint",
    "preemption",
    "quota",
    "topology",
    "application execution framework",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("momentum is toward standardizing on kubernetes");
});

test("the operating procedure covers rollout, failures, and rollback", () => {
  for (const phrase of [
    "freeze the contract",
    "load test",
    "failure injection",
    "429",
    "worker loss",
    "ambiguous tool action",
    "shadow",
    "canary",
    "rollback",
    "re-evaluation trigger",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite is product-neutral and retains stable interfaces", () => {
  for (const phrase of [
    "pick vllm",
    "pick sglang",
    "pick openrouter",
    "pick litellm",
    "agentgateway / lux",
    "mid-2026 snapshot",
    "one openai-compatible interface",
    "same api",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-serving-and-compute-1",
    "fig-serving-stack",
    "fig-serving-wiring",
    "@sec-serving-problem",
    "@sec-memory-scheduling",
    "@sec-choosing-model",
    "@sec-eval-practice",
    "@sec-wiring-stack",
    "@sec-security-authorization",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography uses archival and standards sources", () => {
  for (const value of [
    "Orca: A Distributed Serving System",
    "Efficient Memory Management for Large Language Model Serving",
    "DistServe: Disaggregating Prefill and Decoding",
    "Taming {Throughput-Latency} Tradeoff",
    "HTTP Semantics",
    "Trace Context",
    "OpenTelemetry",
    "Slurm Workload Manager",
    "Kueue",
  ]) expect(bibliography).toContain(value);
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("every inline citation is owned by the chapter bibliography", () => {
  const citeKeys = new Set(
    [...chapter.matchAll(/(?<![A-Za-z0-9])@([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the complete chapter renders through its final operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/serving-and-compute.html",
    chapterTitle: "Serving, Gateways, and Compute",
    chapterNum: "82",
    prefix: "../",
    graphviz,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chapter, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("The method here is the acceptance test for it");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
