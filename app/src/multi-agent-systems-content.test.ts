import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/orchestration/07-multi-agent-systems.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/multi-agent-systems.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter starts from user value and a single-agent baseline", () => {
  for (const phrase of [
    "single-agent baseline",
    "measurable marginal value",
    "coordination cost",
    "does not create authority",
    "independent checks",
  ]) expect(flat).toContain(phrase);
});

test("five distinct multi-agent patterns are not collapsed into consensus", () => {
  for (const phrase of [
    "independent sampling and aggregation",
    "critique and adjudication",
    "staged pipeline",
    "task-graph delegation",
    "shared-environment collaboration",
  ]) expect(flat).toContain(phrase);
});

test("the task graph gives every node an executable contract", () => {
  for (const phrase of [
    "g = (v,e)",
    "predecessors",
    "precondition",
    "postcondition",
    "assigned role",
    "output schema",
    "authority",
    "budget",
    "every symbol",
  ]) expect(flat).toContain(phrase);
});

test("message and result envelopes preserve identity, causality, and evidence", () => {
  for (const phrase of [
    "agentmessage",
    "taskresult",
    "run_id",
    "task_id",
    "parent_task_id",
    "schema_version",
    "causal_parent",
    "idempotency_key",
    "evidence_ref",
    "outcome_unknown",
    "needs_reconciliation",
  ]) expect(flat).toContain(phrase);
});

test("delegation preserves authority, budgets, ownership, and effect safety", () => {
  for (const phrase of [
    "child authority is a subset",
    "reserve",
    "one writer",
    "version check",
    "fencing token",
    "messages are untrusted data, not authority",
    "blind retry",
    "cancellation acknowledgement",
    "quiescence",
  ]) expect(flat).toContain(phrase);
});

test("aggregation is presented as a conditional estimator rather than proof", () => {
  for (const phrase of [
    "independent bernoulli special case",
    "majority is wrong",
    "agreement is not proof",
    "pairwise joint error",
    "measure diversity",
  ]) expect(flat).toContain(phrase);
});

test("the majority-error equation is split for a narrow reading column", () => {
  const majority = chapter.match(/\\begin\{gathered\}[\s\S]*?\\end\{gathered\}/)?.[0];
  expect(majority).toBeDefined();
  expect(majority!.split("\n").length).toBeGreaterThan(4);
  expect(majority).toContain("{}\\times \\epsilon^j");
  expect(majority).toContain("{}\\times (1-\\epsilon)^{N-j}");
});

test("critique keeps addressable objections until evidence resolves them", () => {
  for (const phrase of [
    "concrete witness",
    "unresolved objections persist",
    "reject both",
    "judge error",
    "failing test",
    "missing citation",
  ]) expect(flat).toContain(phrase);
});

test("safety and liveness use their distributed-systems meanings", () => {
  for (const phrase of [
    "nothing bad happens",
    "something good eventually happens",
    "stated assumptions",
    "wrong answer is not automatically a safety violation",
    "progress failure",
  ]) expect(flat).toContain(phrase);
});

test("cost and latency expose coordination overhead and the critical path", () => {
  for (const phrase of [
    "c_{\\text{total}}",
    "c_{\\text{coord}}",
    "l(g)",
    "critical path",
    "longest dependency path",
    "concurrency limit",
  ]) expect(flat).toContain(phrase);
});

test("security contains delegation and treats protocols as transport", () => {
  for (const phrase of [
    "least privilege",
    "confused deputy",
    "transitive delegation",
    "fan-out",
    "tenant",
    "prompt injection",
    "a2a provides interoperability, not trust",
    "majority is not authorization",
    "point of effect",
  ]) expect(flat).toContain(phrase);
});

test("evaluation compares mechanisms on matched budgets and injected faults", () => {
  for (const phrase of [
    "matched model",
    "matched budget",
    "success per dollar",
    "coordination overhead",
    "redundant-work ratio",
    "duplicate-effect rate",
    "post-cancel effect count",
    "malformed output",
    "reordered message",
    "parent crash",
    "compromised child",
    "bootstrap confidence interval",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses archival papers and official specifications", () => {
  for (const marker of [
    "lamport.azurewebsites.net/pubs/the-byz-generals.pdf",
    "usenix.org/conference/osdi-99/presentation/practical-byzantine-fault-tolerance",
    "usenix.org/conference/osdi-04/mapreduce-simplified-data-processing-large-clusters",
    "proceedings.mlr.press/v235/du24e.html",
    "proceedings.mlr.press/v267/kim25e.html",
    "openai.github.io/openai-agents-python/multi_agent",
    "github.com/a2aproject/a2a/blob/main/docs/specification.md",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the rewrite removes unsupported absolutes and invented probes", () => {
  for (const phrase of [
    "none of those assumptions survive",
    "co-hallucinate",
    "single competent honest critic is sufficient",
    "adversarial verification dominate",
    "one production converged on",
    "agents-verification",
    "cheap judge: contention score",
    "consensus becomes an authorization gate",
  ]) expect(flat).not.toContain(phrase);
});

test("stable structure and the retrieval handoff remain", () => {
  expect(chapter).toContain(
    "# Multi-Agent Systems {#sec-multi-agent-systems}",
  );
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*(constraint arrow|lower-layer constraint)/i);
  expect(chapter).toContain("@sec-rag-retrieval");
  expect(chapter).toContain("::: {#further-reading}");
});

test("inline coordination diagrams fit the narrow reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(345);
  }
});
