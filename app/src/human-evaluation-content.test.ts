import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/03-human-evaluation-rubrics.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/human-evaluation-rubrics.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening treats human evaluation as a measurement protocol", () => {
  for (const phrase of [
    "a human judgment is not ground truth merely because",
    "an observation made under a protocol",
    "which people made which judgment",
    "what claim can those observations support",
  ]) expect(flat).toContain(phrase);
});

test("the claim determines the construct and rater perspective", () => {
  for (const phrase of [
    "begin with the claim, not the crowd",
    "the decision and the construct to be measured",
    "the target rater population follows from the claim",
    "the perspective it samples",
    "avoid generalizing beyond it",
  ]) expect(flat).toContain(phrase);
});

test("rubrics define observable decisions and uncertainty states", () => {
  for (const phrase of [
    "unit:",
    "condition:",
    "evidence:",
    "response set:",
    "anchor:",
    "tie, unknown, not-applicable, and abstain are different states",
    "pilot labels used to tune the rubric are development data",
  ]) expect(flat).toContain(phrase);
});

test("assignment controls identity, order, carryover, and exposure", () => {
  for (const phrase of [
    "blind model and provider identity",
    "randomize or counterbalance candidate order",
    "record the order actually shown",
    "within-rater designs",
    "between-rater designs",
    "balanced incomplete blocks",
    "store the interface revision with every judgment",
  ]) expect(flat).toContain(phrase);
});

test("recruitment claims are bounded and raters are protected", () => {
  for (const phrase of [
    "a documented screener, training set, and calibration round",
    "crowd” is not a stable population",
    "these results limit those protocols",
    "fair compensation",
    "protection from disturbing content",
    "minimize retention of platform identifiers",
    "predeclare the checks",
    "preserve excluded records and reasons",
  ]) expect(flat).toContain(phrase);
});

test("raw judgments remain immutable through adjudication and reuse", () => {
  for (const field of [
    "study_spec_hash",
    "candidate_ids_blinded",
    "candidate_order",
    "rubric_revision",
    "interface_revision",
    "rater_population_and_qualification",
    "tie_unknown_abstain_state",
    "quality_flags",
  ]) expect(flat).toContain(field);
  for (const phrase of [
    "adjudication creates a derived label",
    "must not overwrite the independent observations",
    "report agreement before adjudication",
    "no longer an untouched release check",
  ]) expect(flat).toContain(phrase);
});

test("kappa is defined from observed marginals without the unanimity error", () => {
  for (const phrase of [
    "keeping their observed marginal label frequencies",
    "the adjustment is model-based",
    "p_o=p_e=1",
    "kappa is undefined",
    "raw agreement is 100%",
    "imbalanced labels",
  ]) expect(flat).toContain(phrase);
});

test("agreement analysis matches the design and is not validity", () => {
  for (const phrase of [
    "the distance function must match the response scale",
    "no coefficient has a universal “safe” cutoff",
    "compute it on independent raw judgments under one rubric revision",
    "agreement is reliability, not validity",
    "perspective-conditioned result",
  ]) expect(flat).toContain(phrase);
});

test("observation formats retain their interpretation limits", () => {
  for (const phrase of [
    "relative to the opponent set and presentation context",
    "does not produce an absolute quality level",
    "do not treat ordinal levels as equally spaced",
    "the estimate covers the entire human-system workflow",
    "the choice is not a hierarchy",
  ]) expect(flat).toContain(phrase);
});

test("aggregation preserves independent units and design structure", () => {
  for (const phrase of [
    "the independent unit may be a user, conversation, document, repository, or task",
    "cluster repeated judgments at that unit",
    "tie, abstention, missing, and invalid rates",
    "rater and item effects",
    "majority vote",
    "erases minority judgments and uncertainty",
  ]) expect(flat).toContain(phrase);
});

test("model judges receive a locked and continuously monitored handoff", () => {
  for (const phrase of [
    "a locked human-labeled set",
    "ordinary cases, boundary cases, adversarial cases, and abstentions",
    "do not validate only against adjudicated consensus",
    "monitor judge-human disagreement on fresh samples",
    "provenance-changing event",
  ]) expect(flat).toContain(phrase);
});

test("stable chapter structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain(
    "# Human Evaluation as a Measurement Protocol {#sec-human-evaluation-rubrics}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-statistical-reliability");
  expect(chapter).toContain("@sec-judging-holistic");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses verified archival records", () => {
  for (const marker of [
    "10.18653/v1/w19-8643",
    "aclanthology.org/j08-4004",
    "10.18653/v1/2021.naacl-main.295",
    "10.1177/001316446002000104",
    "10.1080/19312450709336664",
    "10.18653/v1/2022.emnlp-main.787",
    "10.18653/v1/2021.emnlp-main.97",
    "10.18653/v1/2021.acl-long.565",
    "arxiv:2505.08775",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the previous logical shortcuts are absent", () => {
  for (const phrase of [
    "raw agreement is 95%",
    "a κ near zero says",
    "strongest raters",
    "mandatory, not optional",
    "a low agreement score means",
  ]) expect(flat).not.toContain(phrase);
});

test("the measurement-protocol diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
