import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/01-serving-problem.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/serving-problem.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the serving chapter remains plain UTF-8 with locally owned citations", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");
  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(7);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("request timing distinguishes phase work from user-visible latency", () => {
  for (const expression of [
    "\\operatorname{TTFT}_i=t_{i,1}-a_i",
    "\\operatorname{TPOT}_i=",
    "\\operatorname{ITL}_{i,j}=t_{i,j}-t_{i,j-1}",
    "\\operatorname{E2E}_i",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "tpOT is undefined".toLowerCase(),
    "admission delay, queueing",
    "network and client buffering",
    "offered load, admission rate, and rejection rate",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("fig-serving-request-lifecycle");
  expect(chapter).toContain("flowchart TD");
});

test("phase bottlenecks are conditional rather than universal", () => {
  for (const expression of ["\\frac{F}{P_{\\max}}", "\\frac{D}{B_{\\max}}", "I=\\frac{F}{D}"]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "neither has a universal bottleneck",
    "common regimes, not laws of nature",
    "model shape, sequence length, batch composition",
    "largest feasible batch that still preserves",
  ]) expect(flat).toContain(phrase);
});

test("KV capacity separates logical state from physical policy", () => {
  for (const expression of [
    "2L\\,n_{\\mathrm{kv}}\\,d_{\\mathrm{head}}\\,b_{\\mathrm{kv}}\\,T_i",
    "M_{\\mathrm{KV}}=\\sum_{i\\in\\mathcal R}m_i",
    "M_{\\mathrm{weights}}",
    "M_{\\mathrm{device}}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "count each unique block once",
    "cache precision, admitted sequences, block allocation",
    "often an admission constraint, not always",
    "synthetic kv-capacity calculator",
    "they are not benchmark measurements",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain('data-viz="kv-cache" data-lang="en"');
});

test("the runnable reproduces static-batch idle time", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "static steps: 15",
    "continuous steps: 12",
    "static slot utilization: 66.7%",
    "continuous slot utilization: 83.3%",
  ]);
});

test("scheduler sequencing states the memory and progress invariants", () => {
  for (const phrase of [
    "retire completed or cancelled requests",
    "reserve every required kv block before launching",
    "allocated memory never exceeds the pool",
    "a block referenced by a running request is never freed",
    "silent retry loops turn an admission failure into unbounded queueing",
  ]) expect(flat).toContain(phrase);
});

test("five serving mechanisms are differentiated and scoped", () => {
  for (const mechanism of [
    "continuous batching",
    "pagedattention",
    "prefix reuse",
    "chunked prefill",
    "prefill-decode disaggregation",
  ]) expect(flat).toContain(mechanism);
  for (const phrase of [
    "not to paging in isolation",
    "exactly the same token prefix",
    "does not make the phases independent",
    "do not have a universal ordering",
  ]) expect(flat).toContain(phrase);
});

test("evaluation follows the load curve and reports policy costs", () => {
  for (const phrase of [
    "sweep offered load",
    "report the whole curve",
    "admission and rejection rates",
    "inspect tails by cause",
    "creating cross-tenant data or timing risks",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the old shortcuts and unsupported figures", () => {
  for (const phrase of [
    "ttft is essentially",
    "tpot is essentially",
    "the cache is the constraint",
    "size is fixed by architecture, not by serving layer",
    "both obvious candidates lie",
    "not useful work",
    "argument has largely resolved",
    "at frontier scale",
    "two principled ways",
    "goodput is the function that prices",
    "through the lens this book carries",
    "vllm/v1/engine/core.py",
    "/figures/serving-problem-1.svg",
    "/figures/serving-problem-2.svg",
  ]) expect(flat).not.toContain(phrase);
});
