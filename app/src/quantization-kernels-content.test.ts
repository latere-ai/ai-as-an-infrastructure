import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/04-quantization-kernels.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/quantization-kernels.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter remains plain UTF-8 with locally owned citations", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");
  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(9);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the cost model separates capacity, decode bandwidth, and attention IO", () => {
  for (const expression of [
    "M_{\\mathrm{weights}}",
    "P\\frac{b_w}{8}+M_{\\mathrm{meta}}",
    "t_{\\mathrm{decode}}\\gtrsim\\frac{R_{\\mathrm{step}}}{B_{\\mathrm{HBM}}}",
    "S\\in\\mathbb R^{n_q\\times n_k}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "a capacity saving is not automatically a latency saving",
    "prefill or training",
    "one new query attends to the retained keys",
    "does not create a new full $n\\times n$ score matrix at every decode step",
  ]) expect(flat).toContain(phrase);
});

test("quantization defines clipping, reconstruction, granularity, and error", () => {
  for (const expression of [
    "q_i=\\operatorname{clip}",
    "\\hat{x}_i=s_g(q_i-z_g)",
    "|x_i-\\hat{x}_i|\\le\\frac{s_g}{2}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "every symbol in these equations",
    "the whole tensor, one channel, or a small group",
    "metadata and padding",
    "clipping adds error beyond this bound",
  ]) expect(flat).toContain(phrase);
});

test("the INT4 runnable is deterministic and handles an all-zero group", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toContain("numpy");
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const script = `${cell![1]}\nprint("all-zero", quantize([0.0, 0.0]))`;
  const run = Bun.spawnSync([python!, "-c", script], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "no outlier   scale=0.129  bulk mean abs error=0.031",
    "one outlier  scale=1.000  bulk mean abs error=0.323",
    "all-zero ([0.0, 0.0], 1.0)",
  ]);
});

test("methods and tensor roles remain separate decisions", () => {
  for (const phrase of [
    "w4a16",
    "w8a8",
    "kv-cache quantization",
    "gptq minimizes layer-output reconstruction error",
    "awq does not store that one percent in fp16",
    "smoothquant leaves the full-precision layer algebraically unchanged",
    "calibration data",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("\\mathbf X\\mathbf W");
  expect(chapter).toContain("\\mathbf X\\operatorname{diag}(\\mathbf s)^{-1}");
});

test("compression is connected to an executable kernel path", () => {
  for (const phrase of [
    "artifact, kernel, and runtime",
    "gguf is a container, not a numeric precision",
    "dequantizes after loading compressed blocks",
    "native low-precision matrix multiplication",
    "supported does not mean fast",
  ]) expect(flat).toContain(phrase);
});

test("online softmax defines the complete recurrence and result", () => {
  for (const expression of [
    "m_j=\\max",
    "\\ell_j=e^{m_{j-1}-m_j}\\ell_{j-1}",
    "\\mathbf o_j=e^{m_{j-1}-m_j}\\mathbf o_{j-1}",
    "\\mathbf O=\\mathbf o_J/\\ell_J",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "the running maximum",
    "the running softmax denominator",
    "the unnormalized output accumulator",
    "exact attention up to floating-point rounding",
  ]) expect(flat).toContain(phrase);
});

test("deployment guidance measures quality and service behavior together", () => {
  for (const phrase of [
    "start from the workload, not the format name",
    "record the complete numeric contract",
    "compare at matched admitted load",
    "time to first token",
    "time per output token",
    "peak device memory",
    "task-specific quality",
    "fall back to the measured baseline",
  ]) expect(flat).toContain(phrase);
});

test("bibliography uses archival records and curates further reading", () => {
  for (const url of [
    "https://openreview.net/forum?id=tcbBPnfwxS",
    "https://proceedings.mlsys.org/paper_files/paper/2024/hash/42a452cbafa9dd64e9ba4aa95cc1ef21-Abstract-Conference.html",
    "https://proceedings.mlr.press/v202/xiao23c.html",
    "https://proceedings.neurips.cc/paper/2022/hash/67d57c32e20fd0a7a302cb81d36e40d5-Abstract-Conference.html",
    "https://proceedings.iclr.cc/paper_files/paper/2024/hash/98ed250b203d1ac6b24bbcf263e3d4a7-Abstract-Conference.html",
  ]) expect(bibliography).toContain(url);
  for (const key of ["nvidia2023tensorrtllm", "llamacpp2023gguf", "nvidia2025nvfp4"]) {
    const start = bibliography.indexOf(`{${key},`);
    const end = bibliography.indexOf("\n@", start);
    expect(bibliography.slice(start, end < 0 ? undefined : end)).toContain("further");
    expect(bibliography.slice(start, end < 0 ? undefined : end)).toContain("{no}");
  }
});

test("the rewrite removes unsupported shortcuts and synthetic evidence", () => {
  for (const phrase of [
    "already exceeds one accelerator",
    "every serious method is a different answer",
    "coarser is faster and smaller",
    "lower bitwidth always reduces footprint",
    "one layer up quietly prices",
    "vllm/entrypoints/llm.py",
    "python/sglang/srt/mem_cache/radix_cache.py",
    "/figures/quantization-kernels-1.svg",
    "/figures/quantization-kernels-2.svg",
  ]) expect(flat).not.toContain(phrase);
});
