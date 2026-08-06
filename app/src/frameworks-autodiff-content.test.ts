import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/infrastructure/02-frameworks-autodiff.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/02-frameworks-autodiff.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/frameworks-autodiff.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter starts from the framework execution contract", () => {
  for (const phrase of [
    "tensor values",
    "operator semantics",
    "derivative rules",
    "device placement",
    "distributed layout",
    "execution mode",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("between typing a loss function and the hardware floor");
});

test("automatic differentiation is separated from symbolic and numerical differentiation", () => {
  for (const phrase of [
    "finite differences",
    "round-off",
    "symbolic differentiation",
    "executed numerical program",
    "local derivative rule",
    "machine precision",
  ]) expect(flat).toContain(phrase);
});

test("JVP and VJP notation defines dimensions and mode choice", () => {
  for (const expression of [
    "f:\\mathbb{R}^n\\to\\mathbb{R}^m",
    "J_f(x)v",
    "J_f(x)^\\mathsf{T}u",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "jacobian-vector product",
    "vector-jacobian product",
    "one column",
    "one jacobian row",
    "scalar loss",
  ]) expect(flat).toContain(phrase);
});

test("reverse accumulation gives the DAG recurrence and seed", () => {
  expect(chapter).toContain("\\bar v_i=\\sum_{j\\in\\operatorname{succ}(i)}");
  for (const phrase of [
    "successors",
    "reverse topological order",
    "output adjoint",
    "accumulates",
  ]) expect(flat).toContain(phrase);
});

test("the runnable implements a topological reverse pass and checks it numerically", () => {
  for (const code of [
    "def topo(",
    "for node in reversed(order):",
    "finite_difference",
    "analytic",
  ]) expect(chapter).toContain(code);
  expect(flat).not.toContain("complete reverse-mode engine in about fifteen lines");
});

test("the runnable is correct when a non-leaf subgraph is reused", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  const output = run.stdout.toString();
  expect(output).toContain("shared analytic 8.0 expected 8.0");
  expect(output).toContain("finite difference");
});

test("gradient semantics include failure modes and validation", () => {
  for (const phrase of [
    "nondifferentiable",
    "subgradient",
    "stop-gradient",
    "in-place mutation",
    "custom derivative",
    "gradient check",
    "double precision",
    "nan",
  ]) expect(flat).toContain(phrase);
});

test("activation storage and recomputation state their real contract", () => {
  for (const phrase of [
    "saved tensors",
    "activation checkpointing",
    "recompute",
    "random-number-generator state",
    "side effect",
    "silent",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the theorem casting a shadow upward");
});

test("eager, traced, and compiled execution are compared without a winner myth", () => {
  for (const phrase of [
    "eager execution",
    "tracing",
    "graph capture",
    "guard",
    "graph break",
    "recompilation",
    "compile latency",
    "cached executable",
  ]) expect(flat).toContain(phrase);
  for (const myth of [
    "the tape had won",
    "the graph camp conceded",
    "research voted with its feet",
  ]) expect(flat).not.toContain(myth);
});

test("modern framework layers and distributed layouts are explicit", () => {
  for (const phrase of [
    "operator schema",
    "dispatcher",
    "autodiff transform",
    "compiler",
    "device runtime",
    "memory allocator",
    "device mesh",
    "shard",
    "replicate",
    "partial",
    "all-gather",
    "all-reduce",
    "reduce-scatter",
  ]) expect(flat).toContain(phrase);
});

test("the operating checklist covers correctness before speed", () => {
  for (const phrase of [
    "eager and compiled outputs",
    "directional finite difference",
    "shape, dtype, device",
    "cold compile",
    "warm execution",
    "graph-break",
    "peak memory",
    "communication volume",
  ]) expect(flat).toContain(phrase);
});

test("volatile company and release claims are removed", () => {
  for (const claim of [
    "pytorch 2.12",
    "jax 0.10",
    "anthropic has never published",
    "xai's released grok code",
    "meta and openai train",
    "as of mid-2026",
  ]) expect(flat).not.toContain(claim);
});

test("handoffs and reader-facing structural promises remain intact", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-accelerators-networking",
    "@sec-training-at-scale",
    "@sec-compilers-kernels",
    "@sec-serving-problem",
  ]) expect(chapter).toContain(ref);
});

test("the bibliography owns primary papers and official framework contracts", () => {
  for (const marker of [
    "jmlr.org/papers/v18/17-468",
    "10.1145/355586.364791",
    "arxiv.org/abs/1604.06174",
    "arxiv.org/abs/1912.01703",
    "docs.pytorch.org/docs/stable/notes/autograd",
    "docs.jax.dev/en/latest/notebooks/autodiff_cookbook",
    "tensorflow.org/guide/function",
    "arxiv.org/abs/2105.04663",
  ]) expect(bibliography).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(8);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the shared bibliography keeps citations used by the untranslated chapter", () => {
  const citeKeys = new Set(
    [...chineseChapter.matchAll(/@([a-z][a-z0-9]*)/gi)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  for (const key of citeKeys) {
    expect(bibliography, `${key} should remain available to the Chinese chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});
