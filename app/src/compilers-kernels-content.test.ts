import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/infrastructure/03-compilers-kernels.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/03-compilers-kernels.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/compilers-kernels.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter opens with the compiler and kernel contract", () => {
  expect(chapter).toMatch(/^# Compilers and Kernels \{#sec-compilers-kernels\}/);
  for (const phrase of [
    "preserve the program's meaning",
    "shape",
    "stride",
    "dtype",
    "layout",
    "aliasing",
    "device target",
  ]) expect(flat).toContain(phrase);
});

test("the roofline model is formal, scoped, and fully defined", () => {
  for (const expression of [
    "I=F/Q",
    "P_{\\text{bound}}=\\min",
    "P_{\\max}",
    "B_{\\max}I",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "algorithmic lower bound",
    "achieved bandwidth",
    "launch overhead",
    "dependency latency",
    "not a runtime prediction",
  ]) expect(flat).toContain(phrase);
});

test("the fusion runnable uses explicit traffic assumptions", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  const output = run.stdout.toString();
  expect(output).toContain("traffic reduction: 3.0x");
  expect(output).toContain("same arithmetic: 50331648 operations");
  expect(cell![1]).not.toContain("H100");
});

test("fusion is presented as a legality and resource decision", () => {
  for (const phrase of [
    "producer-consumer",
    "mutation",
    "alias",
    "random-number",
    "reduction order",
    "register pressure",
    "spill",
    "occupancy",
    "over-fusion",
  ]) expect(flat).toContain(phrase);
});

test("tiling connects memory access to finite device resources", () => {
  for (const phrase of [
    "coalesced",
    "shared memory",
    "registers",
    "tile shape",
    "thread block",
    "synchronization",
    "autotuning",
  ]) expect(flat).toContain(phrase);
});

test("FlashAttention is derived from a defined online recurrence", () => {
  expect(chapter).toContain("S=QK^\\mathsf{T}/\\sqrt{d}");
  for (const expression of [
    /m_t\s*&=\s*\\max/,
    /\\ell_t\s*&=/,
    /o_t\s*&=/,
    /O_i=o_T\/\\ell_T/,
  ]) expect(chapter).toMatch(expression);
  for (const phrase of [
    "query row",
    "key-value block",
    "running maximum",
    "running normalizer",
    "floating-point evaluation order",
    "recompute",
  ]) expect(flat).toContain(phrase);
});

test("the lowering pipeline branches by target instead of universalizing PTX", () => {
  for (const phrase of [
    "captured graph",
    "tensor ir",
    "decomposition",
    "fusion",
    "layout",
    "buffer planning",
    "kernel ir",
    "library call",
    "nvidia target",
    "ptx / cubin",
    "amd target",
    "llvm / hsaco",
    "tpu target",
    "backend executable",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("two lanes converging on one vendor's floor");
});

test("framework compiler examples retain their distinct contracts", () => {
  for (const phrase of [
    "torchdynamo",
    "aotautograd",
    "torchinductor",
    "triton",
    "jaxpr",
    "stablehlo",
    "xla",
    "guard",
    "compile cache",
  ]) expect(flat).toContain(phrase);
});

test("portability is split into independent claims", () => {
  for (const phrase of [
    "source portability",
    "semantic portability",
    "artifact portability",
    "performance portability",
    "target-specific schedule",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("ptx is an nvidia virtual instruction set");
});

test("ecosystem costs are explained without market-scoreboard rhetoric", () => {
  for (const phrase of [
    "driver and runtime",
    "math and communication libraries",
    "profiler",
    "debugger",
    "framework integration",
    "switching cost",
  ]) expect(flat).toContain(phrase);
  for (const claim of [
    "cuda moat still alive",
    "six million cuda developers",
    "as of mid-2026",
    "hobby status",
    "mi355x",
    "blackwell ultra",
  ]) expect(flat).not.toContain(claim);
});

test("generated kernels are evaluated with a hostile correctness harness", () => {
  for (const phrase of [
    "fresh random inputs",
    "boundary shapes",
    "noncontiguous strides",
    "nan and infinity",
    "aliasing",
    "out-of-bounds",
    "race",
    "warm-up",
    "device synchronization",
    "compile time",
    "median",
    "production baseline",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract separates correctness, compilation, and speed", () => {
  for (const phrase of [
    "semantic gate",
    "compiler gate",
    "performance gate",
    "fallback",
    "toolchain version",
    "workload distribution",
    "cold-start",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-frameworks-autodiff",
    "@sec-accelerators-networking",
    "@sec-quantization-kernels",
    "@sec-orchestration-data-infra",
    "@sec-verifiers-process-supervision",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-compilers-kernels-lowering",
    "fig-compilers-kernels-validation",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography uses primary papers and official compiler contracts", () => {
  for (const marker of [
    "10.1145/1498765.1498785",
    "proceedings.neurips.cc/paper/2022/hash/67d57c32e20fd0a7a302cb81d36e40d5",
    "proceedings.mlr.press/v267/ouyang25a.html",
    "openxla.org/stablehlo/compatibility",
    "docs.nvidia.com/cuda/cuda-compiler-driver-nvcc",
    "triton-lang.org/main/programming-guide",
  ]) expect(bibliography).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
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
