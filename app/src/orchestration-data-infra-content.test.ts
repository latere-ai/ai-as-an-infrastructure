import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/infrastructure/04-orchestration-data-infra.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/04-orchestration-data-infra.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/orchestration-data-infra.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines the operational contract before naming mechanisms", () => {
  expect(chapter).toMatch(/^# Orchestration and Data Infrastructure \{#sec-orchestration-data-infra\}/);
  for (const phrase of [
    "desired run",
    "observed run",
    "control plane",
    "data plane",
    "recovery point",
    "recovery time",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("failure is the steady state");
});

test("orchestration is a durable reconciliation protocol", () => {
  for (const phrase of [
    "immutable run specification",
    "durable run record",
    "reconcile",
    "lease",
    "fencing token",
    "idempotent",
    "terminal state",
  ]) expect(flat).toContain(phrase);
  for (const state of [
    "pending",
    "starting",
    "running",
    "checkpointing",
    "recovering",
    "succeeded",
    "failed",
    "cancelled",
  ]) expect(flat).toContain(state);
});

test("scheduler claims distinguish fixed membership from elastic restart", () => {
  for (const phrase of [
    "gang scheduling",
    "fixed world size",
    "membership change",
    "rendezvous",
    "restart the worker group",
    "rank is not a stable identity",
    "placement constraint",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("resumes the survivors from the last checkpoint");
});

test("a checkpoint is a complete consistent state transition", () => {
  for (const phrase of [
    "model parameters",
    "optimizer state",
    "learning-rate",
    "gradient scaler",
    "random-number",
    "data cursor",
    "sharding metadata",
    "global step",
    "step boundary",
  ]) expect(flat).toContain(phrase);
});

test("distributed checkpoint publication is atomic and verifiable", () => {
  for (const phrase of [
    "temporary shard",
    "checksum",
    "manifest",
    "commit record",
    "published last",
    "all expected shards",
    "incomplete checkpoint",
  ]) expect(flat).toContain(phrase);
});

test("checkpoint cadence states its model and asynchronous limits", () => {
  expect(chapter).toContain("W(T)=");
  expect(chapter).toContain("T_{\\text{Young}}=\\sqrt{2CM}");
  for (const phrase of [
    "first-order",
    "independent failures",
    "exponential",
    "uniformly distributed",
    "blocking checkpoint",
    "durability lag",
    "writer backlog",
    "correlated failure",
  ]) expect(flat).toContain(phrase);
});

test("the cadence runnable is dependency-free and reproduces the model", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("Young interval: 18.97 minutes");
});

test("recovery handles crash, omission, slowdown, corruption, and scope", () => {
  for (const phrase of [
    "fail-stop",
    "hang",
    "straggler",
    "silent data corruption",
    "correlated",
    "known-good checkpoint",
    "end-to-end integrity",
    "rollback window",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("unrecoverable from any checkpoint");
});

test("the data plane has an immutable identity and throughput contract", () => {
  for (const phrase of [
    "dataset manifest",
    "sample identifier",
    "tokenizer version",
    "mixture policy",
    "access policy",
    "tokens per second",
    "backpressure",
    "cache hit",
  ]) expect(flat).toContain(phrase);
});

test("resume semantics distinguish exact replay from distributional continuity", () => {
  for (const phrase of [
    "exact replay",
    "distributional resume",
    "committed cursor",
    "prefetched",
    "discarded",
    "duplicate",
    "skipped",
    "world-size change",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("must continue the exact data order");
});

test("observability localizes faults instead of treating loss as a detector", () => {
  for (const phrase of [
    "per-rank",
    "step-time distribution",
    "input wait",
    "collective wait",
    "checkpoint queue",
    "hardware error",
    "data identity",
    "trace",
    "runbook",
  ]) expect(flat).toContain(phrase);
});

test("storage tiers are selected by explicit recovery objectives", () => {
  for (const phrase of [
    "recovery point objective",
    "recovery time objective",
    "failure domain",
    "local memory",
    "remote durable",
    "restore drill",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the two checkpoint camps");
});

test("the operating procedure verifies recovery before expensive execution", () => {
  for (const phrase of [
    "preflight",
    "canary",
    "fault injection",
    "restore drill",
    "cancel",
    "garbage collection",
    "post-run manifest",
  ]) expect(flat).toContain(phrase);
});

test("stable chapter structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-data-curation",
    "@sec-training-at-scale",
    "@sec-accelerators-networking",
    "@sec-compilers-kernels",
    "@sec-compute-frontier",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-orchestration-control-loop",
    "fig-orchestration-checkpoint-commit",
    "fig-orchestration-data-resume",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography uses primary papers and official runtime contracts", () => {
  for (const marker of [
    "10.1145/361147.361115",
    "10.1016/j.future.2004.11.016",
    "usenix.org/conference/fast21/presentation/mohan",
    "docs.pytorch.org/docs/stable/distributed.elastic.html",
    "docs.pytorch.org/docs/stable/distributed.checkpoint.html",
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
