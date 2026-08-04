import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/07-operational-evaluation.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/operational-evaluation.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines operational evaluation as a decision loop", () => {
  for (const phrase of [
    "ends in an operational decision",
    "the complete system revision",
    "promote, hold, narrow, roll back, or escalate",
    "evidence can change that decision",
    "measurement, deployment, monitoring, and learning",
  ]) expect(flat).toContain(phrase);
});

test("the release gate is a complete versioned contract", () => {
  for (const field of [
    "decision_id",
    "candidate_system_hash",
    "baseline_system_hash",
    "target_population",
    "evaluation_manifest_hash",
    "metric_and_scorer_versions",
    "primary_decision_rule",
    "guardrail_margins",
    "invalid_outcome_policy",
    "stage_plan",
    "rollback_target",
    "decision_authority",
    "override_policy",
    "evidence_expiry",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("written before the confirmation run");
  expect(flat).toContain("a dashboard is evidence; it is not the policy");
});

test("the formal gate defines every decision symbol", () => {
  for (const phrase of [
    "g(v)=",
    "candidate system revision",
    "baseline revision",
    "predeclared slice",
    "lower confidence bound",
    "non-inferiority margin",
    "absolute quality floor",
    "hard operational predicate",
    "evidence-validity predicate",
    "all four conditions must hold",
  ]) expect(flat).toContain(phrase);
});

test("candidate comparisons preserve pairing and uncertainty", () => {
  for (const phrase of [
    "run candidate and baseline on the same independent units",
    "paired difference",
    "exact mcnemar test",
    "paired randomization or bootstrap procedure",
    "effect estimate and interval",
    "unresolved result is not a pass",
    "do not search for a favorable slice after the run",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("fisher's exact test for pass rates");
});

test("progressive gates collect distinct evidence", () => {
  for (const phrase of [
    "offline confirmation",
    "shadow traffic",
    "canary exposure",
    "continuous production monitoring",
    "must not execute user-visible writes",
    "the canary and control run at the same time",
    "automatic stop or rollback",
    "no stage substitutes for another",
  ]) expect(flat).toContain(phrase);
});

test("private suites have an exposure-aware lifecycle", () => {
  for (const phrase of [
    "development suite",
    "locked confirmation suite",
    "diagnostic suite",
    "exposure ledger",
    "de-identification",
    "positive and negative grader cases",
    "an incident is evidence for a candidate case",
    "does not become a blocking test until",
    "retire or relabel",
  ]) expect(flat).toContain(phrase);
});

test("drift diagnosis separates system population and instrument changes", () => {
  for (const phrase of [
    "system change",
    "population change",
    "measurement change",
    "fixed sentinel cases",
    "sampled live traffic",
    "delayed outcome labels",
    "a distribution alarm does not prove a quality regression",
    "route the signal to investigation",
    "replaying the old and new instrument",
  ]) expect(flat).toContain(phrase);
});

test("every decision retains reconstructable provenance", () => {
  for (const field of [
    "system_component_hashes",
    "evaluation_result_ids",
    "rollout_stage",
    "traffic_assignment",
    "stage_results",
    "monitoring_window",
    "override_actor_and_reason",
    "override_expiry",
    "decision_and_timestamp",
    "rollback_target_and_trigger",
    "incident_followup_ids",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("semantic conventions do not identify the whole experiment");
  expect(flat).toContain("development-status genai conventions");
  expect(flat).toContain("store hashes or controlled artifact references");
  expect(flat).toContain("immutable statistical records defined in @sec-statistical-reliability");
  expect(flat).toContain("append-only");
});

test("quality cost latency and risk remain separate before utility", () => {
  for (const phrase of [
    "pareto frontier first",
    "u(m) &= q(m)",
    "weights are policy choices",
    "median and tail latency",
    "metered cost",
    "quality guardrails remain constraints",
    "a scalar cannot authorize a safety trade",
  ]) expect(flat).toContain(phrase);
});

test("the utility equation wraps on a narrow reading surface", () => {
  expect(chapter).toMatch(
    /\\begin\{aligned\}[\s\S]*U\(m\)[\s\S]*\\\\[\s\S]*\\lambda_l L\(m\)[\s\S]*\\end\{aligned\}/,
  );
});

test("governance records authority overrides expiry and learning", () => {
  for (const phrase of [
    "model cards",
    "datasheets for datasets",
    "govern, map, measure, and manage",
    "named owner",
    "override time-bounded",
    "accepted risk",
    "corrective action",
    "regression candidate",
    "close the loop",
  ]) expect(flat).toContain(phrase);
});

test("stable chapter structure and handoffs remain", () => {
  expect(chapter).toContain(
    "# Operational Evaluation and Governance {#sec-operational-evaluation}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-statistical-reliability");
  expect(chapter).toContain("@sec-evaluating-agents");
  expect(chapter).toContain("@sec-eval-practice");
  expect(chapter).toContain("@sec-deployment-lifecycle");
  expect(chapter).toContain("@sec-data-engine");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses authoritative primary or official records", () => {
  for (const marker of [
    "86df7dcfd896fcaf2674f757a2463eba",
    "research.google/pubs/pub46555",
    "846c260d715e5b854ffad5f70a516c88",
    "doi.org/10.6028/nist.ai.100-1",
    "arxiv.org/abs/1810.03993",
    "arxiv.org/abs/1803.09010",
    "github.com/open-telemetry/semantic-conventions-genai",
    "sre.google/workbook/canarying-releases",
    "arxiv.org/abs/2110.06177",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the previous anecdotal and machine-like detours are absent", () => {
  for (const phrase of [
    "five-of-five topic fixation",
    "model drift is also the one kind that arrives on a schedule",
    "watch the model catalog and the harness registry",
    "the provenance list is longer than intuition suggests",
    "one measurement study supplies the cautionary case",
    "generated narrative should stay draft-only behind a lint",
    "a price change can move a model onto or off the frontier",
  ]) expect(flat).not.toContain(phrase);
});

test("the operational gate diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
