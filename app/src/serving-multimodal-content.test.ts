import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/inference/06-serving-multimodal.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/serving-multimodal.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter owns its sources and includes a multimodal serving study", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(keys.size).toBeGreaterThanOrEqual(10);
  for (const key of keys) {
    expect(bibliography, `${key} should be owned by this chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
  expect(bibliography).toContain("ModServe: Modality- and Stage-Aware Resource Disaggregation");
  expect(bibliography).toContain("https://arxiv.org/abs/2502.00937");
});

test("input serving defines sequence length and KV memory without hiding symbols", () => {
  for (const expression of [
    "N_{\\mathrm{in}}",
    "M_{\\mathrm{KV}}",
    "n_{\\mathrm{kv}}",
    "d_h",
    "b_{\\mathrm{kv}}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "every symbol",
    "decoder-only fusion",
    "cross-attention fusion",
    "architecture-dependent",
    "quadratic attention term",
  ]) expect(flat).toContain(phrase);
});

test("the visual-token runnable reproduces fixed-grid and GQA cache arithmetic", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  expect(cells.length).toBe(2);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[0][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "336x336:  576 visual tokens,  72.0 MiB KV",
    "672x672: 2304 visual tokens, 288.0 MiB KV",
  ]);
  expect(cells[0][1]).toContain("n_kv_heads=8");
  expect(cells[0][1]).toContain("head_dim=128");
  expect(cells[0][1]).not.toContain("hidden // gqa");
});

test("token reduction states when savings begin and what can be lost", () => {
  for (const phrase of [
    "fixed grid",
    "tiling",
    "dynamic resolution",
    "spatial merge",
    "fixed-budget resampler",
    "token pruning",
    "only later layers become cheaper",
    "small text",
    "small objects",
  ]) expect(flat).toContain(phrase);
});

test("scheduling accounts for heterogeneous stages and request sizes", () => {
  for (const phrase of [
    "resource vector",
    "encoder queue",
    "projected token count",
    "output-token limit",
    "shape buckets",
    "padding waste",
    "tail latency",
    "admission control",
  ]) expect(flat).toContain(phrase);
});

test("cache layers have distinct keys, savings, and isolation rules", () => {
  for (const phrase of [
    "processor cache",
    "encoder-output cache",
    "kv prefix cache",
    "preprocessor revision",
    "encoder revision",
    "projector revision",
    "tenant scope",
    "exact prefix",
  ]) expect(flat).toContain(phrase);
});

test("generative-media serving uses a pipeline and an honest work proxy", () => {
  for (const phrase of [
    "text encoder",
    "iterative denoiser",
    "latent decoder",
    "neural-function evaluations",
    "guidance branches",
    "not a flops estimate",
    "preview",
    "head-of-line blocking",
  ]) expect(flat).toContain(phrase);

  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[1][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "latent tokens: 4096",
    "50-step proxy: 409600 token-passes",
    " 4-step proxy: 32768 token-passes",
    "denoiser-only ratio: 12.5x",
  ]);
});

test("deployment verification covers cost, latency, quality, and workload shape", () => {
  for (const phrase of [
    "time to first token",
    "inter-token latency",
    "encoder cache hit rate",
    "kv prefix-cache hit rate",
    "accelerator-seconds per output",
    "quality at each step count",
    "modality mix",
    "p50, p95, and p99",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes synthetic evidence and false universal claims", () => {
  for (const phrase of [
    "/figures/serving-multimodal-1.svg",
    "indistinguishable from text tokens",
    "hash the pixels",
    "almost always a diffusion model",
    "so there is nothing to stream",
    "tflops_per_step = 2 * p * tok",
    "attention to image tokens collapses",
  ]) expect(flat).not.toContain(phrase);
});

test("the architecture diagram fits a narrow reading column without scrolling", async () => {
  const dot = chapter.match(
    /```\{dot\}\n([\s\S]*?label: fig-mm-input-contracts[\s\S]*?)\n```/,
  )?.[1];
  expect(dot).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(dot!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(234);
});
