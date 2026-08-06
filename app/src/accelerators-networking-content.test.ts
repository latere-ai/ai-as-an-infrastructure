import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/infrastructure/01-accelerators-networking.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/accelerators-networking.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("performance is a workload and system claim, not a chip-spec claim", () => {
  for (const phrase of [
    "does not predict application performance",
    "workload",
    "tensor shape",
    "precision",
    "software stack",
    "topology",
    "measurement method",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a training run lives or dies on bandwidth");
});

test("the accelerator model separates control, general-purpose lanes, and matrix engines", () => {
  for (const phrase of [
    "host",
    "simt",
    "matrix engine",
    "systolic array",
    "accumulation precision",
    "structured sparsity",
    "kernel",
  ]) expect(flat).toContain(phrase);
});

test("the roofline bound defines arithmetic intensity and its ridge point", () => {
  for (const expression of [
    "P_{\\mathrm{achieved}} \\le",
    "I=\\frac{F}{Q}",
    "I^*=\\frac{P_{\\mathrm{peak}}}{B_{\\mathrm{mem}}}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of ["floating-point operations", "bytes transferred", "ridge point"]) {
    expect(flat).toContain(phrase);
  }
});

test("memory analysis distinguishes capacity, bandwidth, latency, and traffic level", () => {
  for (const phrase of [
    "registers",
    "shared memory",
    "cache",
    "high-bandwidth memory",
    "capacity",
    "bandwidth",
    "latency",
    "traffic is counted",
  ]) expect(flat).toContain(phrase);
});

test("the interconnect stack separates topology, transport, and collective software", () => {
  for (const phrase of [
    "physical topology",
    "transport",
    "collective library",
    "oversubscription",
    "bisection bandwidth",
    "pcie",
    "nvlink",
    "infiniband",
    "roce",
    "memory registration",
  ]) expect(flat).toContain(phrase);
});

test("collective semantics and ring cost are explicit", () => {
  for (const phrase of [
    "broadcast",
    "all-reduce",
    "all-gather",
    "reduce-scatter",
    "all-to-all",
    "semantics do not choose the algorithm",
  ]) expect(flat).toContain(phrase);
  for (const expression of [
    "T_{\\mathrm{msg}}(n)=\\alpha+n\\beta",
    "2(p-1)\\alpha",
    "\\frac{2(p-1)}{p}n\\beta",
  ]) expect(chapter).toContain(expression);
});

test("communication overlap and parallelism placement remain conditional", () => {
  for (const phrase of [
    "dependency graph",
    "bucket size",
    "concurrent traffic",
    "communication graph",
    "tensor parallelism",
    "sequence parallelism",
    "context parallelism",
    "expert parallelism",
    "fully sharded data parallelism",
    "pipeline parallelism",
  ]) expect(flat).toContain(phrase);
  for (const shortcut of [
    "collective vanishes entirely",
    "is pinned to the nvlink tier",
    "one gradient all-reduce per step",
    "one activation hand-off per stage",
  ]) expect(flat).not.toContain(shortcut);
});

test("TPU topology claims are generation-scoped", () => {
  for (const phrase of [
    "tpu v4",
    "optical circuit switch",
    "three-dimensional torus",
    "generation-specific",
    "gspmd",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the tpu detour: a torus instead of a switch");
});

test("MFU and HFU disclose conventions and limitations", () => {
  for (const expression of [
    "\\mathrm{MFU}=",
    "F_{\\mathrm{model}}",
    "N_{\\mathrm{device}}",
    "P_{\\mathrm{peak}}",
    "t_{\\mathrm{step}}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "flop-count convention",
    "advertised precision",
    "rematerialization",
    "not a diagnosis",
    "hardware flops utilization",
  ]) expect(flat).toContain(phrase);
});

test("the benchmark contract is reproducible and operational", () => {
  for (const phrase of [
    "driver and firmware",
    "collective-library version",
    "tensor dimensions",
    "message size",
    "rank placement",
    "warm-up",
    "p50",
    "p99",
    "concurrent flows",
    "power and temperature",
    "operating record",
  ]) expect(flat).toContain(phrase);
});

test("regression scenarios cover performance and failure modes", () => {
  for (const phrase of [
    "small-message latency",
    "large-message bandwidth",
    "oversubscribed uplink",
    "degraded link",
    "rank-placement change",
    "collective timeout",
    "silent data corruption",
    "thermal throttling",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite keeps stable handoffs and removes unsupported artifacts", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="bandwidth-tiers"');
  expect(chapter).toContain('data-viz="stepper"');
  for (const ref of [
    "@sec-training-at-scale",
    "@sec-orchestration-data-infra",
    "@sec-memory-scheduling",
    "@sec-quantization-kernels",
    "@sec-serving-problem",
    "@sec-moe-ssm-hybrids",
    "@sec-powering-ai",
    "@sec-machine-breaks",
  ]) expect(chapter).toContain(ref);
  for (const artifact of [
    "/figures/accelerators-networking-1.svg",
    "/figures/accelerators-networking-2.svg",
    "nvlink_size = 8",
    "slowdown = 10.0",
  ]) expect(flat).not.toContain(artifact);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography is primary, official, and chapter-owned", () => {
  for (const marker of [
    "10.1145/1498765.1498785",
    "research.google/pubs/in-datacenter-performance-analysis",
    "10.1016/j.jpdc.2008.09.002",
    "docs.nvidia.com/deeplearning/nccl",
    "docs.nvidia.com/cuda/gpudirect-rdma",
    "arxiv.org/abs/2304.01433",
    "jmlr.org/papers/volume24/22-1144",
  ]) expect(bibliography).toContain(marker);

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
