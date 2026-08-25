import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/03-edge-on-device.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/edge-on-device.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter starts from a measurable device support envelope", () => {
  expect(chapter).toMatch(
    /^# Edge and On-Device Deployment \{#sec-edge\}/,
  );
  for (const phrase of [
    "device support envelope",
    "task class",
    "data boundary",
    "quality threshold",
    "minimum os",
    "device tier",
    "offline behavior",
    "fallback policy",
    "acceptance matrix",
  ]) expect(flat).toContain(phrase);
});

test("memory feasibility accounts for the complete process", () => {
  for (const marker of [
    "M_{\\mathrm{peak}}",
    "M_{\\mathrm{weights}}",
    "M_{\\mathrm{KV}}",
    "M_{\\mathrm{workspace}}",
    "M_{\\mathrm{runtime}}",
    "M_{\\mathrm{app}}",
    "M_{\\mathrm{budget}}",
    "N_{\\mathrm{params}}",
    "b_w",
    "n_{\\mathrm{kv}}",
    "d_h",
    "b_{\\mathrm{kv}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "quantization metadata",
    "tensor alignment",
    "peak resident memory",
    "memory pressure",
    "measure the exported artifact",
  ]) expect(flat).toContain(phrase);
});

test("performance is qualified under sustained device conditions", () => {
  for (const phrase of [
    "cold start",
    "warm start",
    "time to first token",
    "time per output token",
    "end-to-end latency",
    "p50",
    "p95",
    "energy per accepted task",
    "thermal steady state",
    "battery state",
    "background load",
    "sustained run",
    "frequency throttling",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("bandwidth ceiling");
  expect(flat).toContain("measurement, not a promise");
});

test("compression choices remain artifact- and backend-specific", () => {
  for (const phrase of [
    "post-training quantization",
    "calibration set",
    "quantization-aware training",
    "low-bit pretraining",
    "weight format",
    "activation format",
    "kv-cache format",
    "operator coverage",
    "dequantization",
    "exact artifact",
    "exact backend",
    "task-specific evaluation",
    "smaller does not automatically mean faster",
  ]) expect(flat).toContain(phrase);
});

test("the deployment fingerprint crosses export, packaging, and runtime", () => {
  for (const phrase of [
    "deployment fingerprint",
    "source checkpoint",
    "tokenizer",
    "prompt template",
    "export graph",
    "quantization configuration",
    "compiled artifact",
    "runtime version",
    "backend delegate",
    "os build",
    "device class",
    "capability probe",
    "cpu fallback",
  ]) expect(flat).toContain(phrase);
});

test("local execution does not overclaim privacy", () => {
  for (const phrase of [
    "not, by itself, a privacy guarantee",
    "temporary files",
    "crash reports",
    "telemetry",
    "cloud fallback",
    "explicit consent",
    "content-free metrics",
    "prompt or completion content",
    "app sandbox",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the data never leaves the phone");
  expect(flat).not.toContain("the privacy gap is closed");
});

test("hybrid routing fails safely and exposes execution provenance", () => {
  for (const phrase of [
    "route before execution",
    "local-only",
    "cloud-eligible",
    "never upload",
    "no silent fallback",
    "remaining deadline",
    "model unavailable",
    "execution provenance",
    "partial output",
  ]) expect(flat).toContain(phrase);
});

test("model delivery is versioned, verifiable, and reversible", () => {
  for (const phrase of [
    "cryptographic digest",
    "signature",
    "compatibility manifest",
    "staged download",
    "atomic activation",
    "last-known-good",
    "rollback",
    "disk quota",
    "garbage collection",
  ]) expect(flat).toContain(phrase);
});

test("the operating procedure includes failures and requalification", () => {
  for (const phrase of [
    "freeze the envelope",
    "representative device tiers",
    "qualify the complete artifact",
    "low storage",
    "thermal throttling",
    "corrupt download",
    "backend rejection",
    "staged rollout",
    "requalification trigger",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite is durable and retains stable interfaces", () => {
  for (const phrase of [
    "mid-2026",
    "nano v3",
    "nano 4",
    "gemma 4",
    "qwen3.5",
    "privacy is the decisive one",
    "this is why every model in this tier is over-trained",
    "the frontier is one bit",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-edge-on-device-1",
    "fig-edge-tier",
    "@sec-quantization-kernels",
    "@sec-choosing-model",
    "@sec-serving-stack",
    "@sec-eval-practice",
    "@sec-deployment-lifecycle",
    "@sec-security-authorization",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography uses primary papers and official specifications", () => {
  for (const value of [
    "MobileLLM",
    "Activation-aware Weight Quantization",
    "SmoothQuant",
    "KIVI",
    "MLPerf Mobile Inference Benchmark",
    "ExecuTorch",
    "Core ML",
    "Mobile Application Security Verification Standard",
    "The Update Framework",
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

test("the complete chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/edge-on-device.html",
    chapterTitle: "Edge and On-Device Deployment",
    chapterNum: "83",
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
  expect(html).toContain("The output is a deployment decision record");
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
