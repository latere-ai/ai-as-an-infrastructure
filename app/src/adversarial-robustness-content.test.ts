import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/safety/05-adversarial-robustness.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/adversarial-robustness.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines adversarial robustness without conflating failures", () => {
  for (const phrase of [
    "adversarial robustness asks how a deployed system behaves when someone deliberately searches for a failure",
    "a jailbreak attempts to elicit policy-violating model output",
    "prompt injection attempts to make untrusted text control an application",
    "a harmful side effect",
    "authorize and execute",
    "these failures are related, but they are not interchangeable",
    "red teaming searches for them under a stated threat model",
    "does not certify their absence",
  ]) expect(flat).toContain(phrase);
});

test("the threat model fixes the system, attacker, budget, and success condition", () => {
  for (const phrase of [
    "target system",
    "policy revision",
    "attacker's goal",
    "attacker knowledge",
    "attacker access",
    "attack budget",
    "allowed transformations",
    "success criterion",
    "defender knowledge",
    "adaptive",
    "one system revision",
  ]) expect(flat).toContain(phrase);
});

test("attack mechanisms are useful axes rather than a closed four-family taxonomy", () => {
  for (const phrase of [
    "not an exhaustive taxonomy",
    "manual and semantic",
    "optimization-based",
    "many-shot",
    "multi-turn",
    "indirect prompt injection",
    "white-box",
    "black-box",
    "transfer",
    "attacker can combine",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("four families of attack have stabilized");
});

test("attack success is formally defined at the behavior-attempt level", () => {
  for (const phrase of [
    "behavior under test",
    "attack procedure",
    "generation seed",
    "policy-aware judge",
    "binary outcome",
    "attack success rate",
    "evaluation set",
    "point estimate",
    "not a probability that the system is safe",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/Y_\{b,a,r\}\s*=/);
  expect(chapter).toMatch(/\\widehat\{\\operatorname\{ASR\}\}/);
});

test("uncertainty and dependence are reported honestly", () => {
  for (const phrase of [
    "confidence interval",
    "resample by behavior",
    "repeated samples",
    "not independent",
    "stochastic decoding",
    "sample size",
    "zero observed successes does not prove zero risk",
  ]) expect(flat).toContain(phrase);
});

test("the judge scores harmful usefulness rather than refusal wording", () => {
  for (const phrase of [
    "bypassing a refusal is not sufficient",
    "harmful usefulness",
    "empty or incoherent answer",
    "human review",
    "judge agreement",
    "false positive",
    "false negative",
    "strongreject",
  ]) expect(flat).toContain(phrase);
});

test("robustness reporting preserves benign utility and attack cost", () => {
  for (const phrase of [
    "benign refusal",
    "ordinary task quality",
    "queries",
    "tokens",
    "wall-clock time",
    "latency",
    "defense overhead",
    "severity",
    "actionability",
    "a lower attack success rate is not enough",
  ]) expect(flat).toContain(phrase);
});

test("red-team evidence separates development, held-out, and adaptive suites", () => {
  for (const phrase of [
    "development suite",
    "held-out suite",
    "adaptive suite",
    "do not tune on the release suite",
    "attack-family holdout",
    "private",
    "contamination",
    "replay every confirmed failure",
    "human red team",
  ]) expect(flat).toContain(phrase);
});

test("defenses are scoped by intervention point and supported claim", () => {
  for (const phrase of [
    "safety tuning and adversarial training",
    "instruction hierarchy",
    "input and output classifiers",
    "representation rerouting",
    "deterministic effect controls",
    "learned defense",
    "security boundary",
    "adaptive attacker",
    "authority scoping",
    "defense in depth",
  ]) expect(flat).toContain(phrase);
});

test("defense claims do not depend on a clipped three-column mobile table", () => {
  const start = chapter.indexOf("## Match the defense to the failure stage");
  const end = chapter.indexOf("<figure id=\"fig-adversarial-robustness-stepper\">", start);
  const section = chapter.slice(start, end);
  expect(section).not.toContain("| Intervention | Supported claim |");
});

test("the release rule uses uncertainty and a benign-utility floor", () => {
  for (const phrase of [
    "upper confidence bound",
    "release threshold",
    "benign-utility floor",
    "lower confidence bound",
    "per risk category",
    "release gate",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\operatorname\{UCB\}/);
  expect(chapter).toMatch(/\\operatorname\{LCB\}/);
});

test("the evaluation record is versioned and reproducible", () => {
  for (const field of [
    "evaluation_id",
    "system_revision",
    "policy_revision",
    "defense_revision",
    "behavior_set_revision",
    "attack_revision",
    "threat_model_and_budget",
    "generation_parameters_and_seeds",
    "judge_revision",
    "human_validation_sample",
    "per_behavior_outcomes",
    "benign_utility_outcomes",
    "query_token_latency_costs",
    "confidence_interval_method",
    "release_decision_and_exception",
    "regression_case_ids",
  ]) expect(flat).toContain(field);
});

test("regression scenarios cover judge, attack, defense, and system drift", () => {
  for (const phrase of [
    "refusal-string trap",
    "held-out attack family",
    "multi-turn carryover",
    "indirect injection",
    "adaptive re-attack",
    "benign contrast",
    "judge disagreement",
    "model revision",
    "policy revision",
    "defense timeout",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Adversarial Robustness and Red-Teaming {#sec-adversarial-robustness}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="stepper"');
  expect(chapter).toContain('data-viz="curve" data-family="power-grow"');
  for (const ref of [
    "@sec-safety-tuning",
    "@sec-runtime-safety",
    "@sec-security-authorization",
    "@sec-judging-holistic",
    "@sec-operational-evaluation",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography includes primary research and official red-team guidance", () => {
  for (const marker of [
    "arxiv.org/abs/2307.15043",
    "proceedings.mlr.press/v235/mazeika24a.html",
    "papers.nips.cc/paper_files/paper/2024/hash/e2e06adf560b0706d3b1ddfca9f29756",
    "arxiv.org/abs/2404.01318",
    "10.6028/nist.ai.600-1",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliography).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});

test("categorical and machine-like legacy claims are absent", () => {
  expect(chapter).not.toContain("/figures/adversarial-robustness-1.svg");
  for (const phrase of [
    "now has a stable shape",
    "four families of @gls-jailbreak",
    "four families of attack have stabilized",
    "the unsettling discovery of the period",
    "is the wrong instrument",
    "the frontier of the field",
    "the one fix",
    "human red teams remain the source of genuinely novel attack classes",
    "they are independent of the target's alignment",
    "derails the generation into incoherence",
    "the realistic posture",
    "a number that says how far the deployed boundary can be pushed",
  ]) expect(flat).not.toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("math uses delimiters supported by the book renderer", () => {
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"]) {
    expect(chapter).not.toContain(delimiter);
  }
});

test("every Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
