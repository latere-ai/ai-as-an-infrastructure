import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/orchestration/05-the-harness.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/the-harness.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the harness begins with user value and a bounded responsibility", () => {
  for (const phrase of [
    "bounded, observable work",
    "model proposes",
    "harness sequences",
    "does not grant authority",
    "does not make external effects exactly once",
  ]) expect(flat).toContain(phrase);
});

test("a versioned transition model names durable run state and invariants", () => {
  for (const phrase of [
    "(s_{t+1}, c_t)",
    "accepted event",
    "versioned",
    "history head",
    "outstanding work",
    "terminal run",
    "budgets never increase",
  ]) expect(flat).toContain(phrase);
});

test("the run lifecycle covers waits, interruption, and reconciliation", () => {
  for (const phrase of [
    "waiting for model",
    "waiting for tool",
    "waiting for approval",
    "paused",
    "cancelling",
    "needs reconciliation",
    "pause",
    "resume",
    "steer",
    "cancel",
    "kill",
    "fork",
  ]) expect(flat).toContain(phrase);
});

test("cancellation distinguishes acknowledgement from stopped effects", () => {
  for (const phrase of [
    "acknowledged",
    "quiescent",
    "cannot undo",
    "committed external effect",
    "reconcile",
  ]) expect(flat).toContain(phrase);
});

test("durable execution separates scheduling from effect safety", () => {
  for (const phrase of [
    "durable history",
    "queue",
    "lease",
    "fencing token",
    "stable step id",
    "attempt number",
    "idempotency key",
    "input fingerprint",
    "resource-level concurrency",
  ]) expect(flat).toContain(phrase);
});

test("tool contracts separate discovery, permission, execution, and results", () => {
  for (const phrase of [
    "toolspec",
    "toolresult",
    "side_effect_class",
    "auth_scopes",
    "approval_rule",
    "max_output_bytes",
    "catalog admission",
    "per-turn exposure",
    "execution authorization",
    "untrusted",
  ]) expect(flat).toContain(phrase);
});

test("working context is a lossy projection rather than durable truth", () => {
  for (const phrase of [
    "canonical history",
    "working context",
    "lossy projection",
    "compaction",
    "masking",
    "artifact",
    "does not delete",
  ]) expect(flat).toContain(phrase);
});

test("sandboxing names independent containment dimensions", () => {
  for (const phrase of [
    "process",
    "filesystem",
    "network",
    "credentials",
    "resource limits",
    "lifetime",
    "worktree is not a security boundary",
  ]) expect(flat).toContain(phrase);
});

test("budgets are reserved and reconciled across parent and child runs", () => {
  for (const phrase of [
    "reserve",
    "reconcile",
    "parent",
    "child",
    "wall-clock",
    "model calls",
    "tool calls",
    "bytes",
    "concurrent",
  ]) expect(flat).toContain(phrase);
});

test("evaluation holds the task and model fixed and measures mechanisms", () => {
  for (const phrase of [
    "fixed model",
    "cancellation acknowledgement latency",
    "quiescence latency",
    "post-cancel effect count",
    "duplicate-effect rate",
    "recovery divergence",
    "approval-bypass rate",
    "tool-selection precision",
    "context-critical-loss rate",
    "isolation escape",
    "added latency",
    "added cost",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses primary specifications and official guidance", () => {
  for (const marker of [
    "grpc.io/docs/guides/cancellation",
    "docs.temporal.io/develop/python/workflows/cancellation",
    "kubernetes.io/docs/concepts/workloads/controllers/job",
    "modelcontextprotocol.io/specification/2025-11-25/server/tools",
    "openai.github.io/openai-agents-python/human_in_the_loop",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the rewrite removes invented thresholds and sensational anecdotes", () => {
  for (const phrase of [
    "one or two agent types",
    "three or four",
    "30 to 50",
    "scales to thousands",
    "almost exclusively",
    "1.67 billion",
    "$47,000",
    "every replica fires every tick",
    "the usual fix",
    "obeys =",
    "full grace period",
  ]) expect(flat).not.toContain(phrase);
});

test("stable references, contested questions, and the handoff remain intact", () => {
  expect(chapter).toContain("# The Harness {#sec-the-harness}");
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*(constraint arrow|lower-layer constraint)/i);
  expect(chapter).toContain("@sec-computer-use");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the state machine fits the reading column without horizontal scrolling", async () => {
  const dot = chapter.match(
    /```\{dot\}\n([\s\S]*?label: fig-harness-state-machine[\s\S]*?)\n```/,
  )?.[1];
  expect(dot).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(dot!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(345);
});
