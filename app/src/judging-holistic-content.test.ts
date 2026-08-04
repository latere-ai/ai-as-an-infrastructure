import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/04-judging-holistic.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/judging-holistic.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening scopes a model judge as a second measurement instrument", () => {
  for (const phrase of [
    "can turn a written rubric into thousands of repeatable judgments",
    "cannot turn an underspecified idea of quality into truth",
    "for which decision, criterion, cases, and failure costs",
    "a second instrument calibrated against those observations",
    "not a replacement source of ground truth",
  ]) expect(flat).toContain(phrase);
});

test("grader choice follows the property and available evidence", () => {
  for (const phrase of [
    "use the narrowest grader that fits",
    "open-ended output is not uniformly uncheckable",
    "deterministic validator",
    "evidence-bound checker",
    "observed task outcome",
    "the necessary evidence fits in its input",
  ]) expect(flat).toContain(phrase);
});

test("holistic evaluation preserves coverage instead of one score", () => {
  for (const phrase of [
    "broad, standardized coverage across scenarios and metrics",
    "does not mean that one judge should compress every property into one score",
    "scenario-by-metric matrix",
    "an undocumented average is not holistic",
  ]) expect(flat).toContain(phrase);
});

test("the complete judge and verdict contracts are versioned", () => {
  for (const field of [
    "judge_model_and_revision",
    "rubric_revision",
    "prompt_template_hash",
    "evidence_policy",
    "candidate_order_policy",
    "sampling_parameters",
    "parser_and_repair_revision",
    "judge_spec_hash",
    "raw_model_output",
    "tie_or_abstention_state",
    "latency_cost_and_attempts",
  ]) expect(flat).toContain(field);
  for (const phrase of [
    "creates a new judge revision",
    "does not overwrite history",
    "keep dimensions separate",
  ]) expect(flat).toContain(phrase);
});

test("uncertainty states are not forced into preference labels", () => {
  for (const phrase of [
    "tie,” “both fail,” “insufficient evidence,” “criterion not applicable,” and “judge failure”",
    "are not interchangeable",
    "preserve the raw response even when parsing fails",
    "route cases covered by the escalation rule",
  ]) expect(flat).toContain(phrase);
});

test("validation is locked, criterion-specific, and reference-specific", () => {
  for (const phrase of [
    "freeze the `judgespec`",
    "a locked set that did not influence those choices",
    "false-pass and false-fail rates",
    "criterion, language, domain, difficulty, candidate family, and output style",
    "the result establishes performance for those tested protocols",
    "agreement is not validity",
    "a numeric score is not automatically a probability",
  ]) expect(flat).toContain(phrase);
});

test("bias and attack controls measure residual dependence", () => {
  for (const phrase of [
    "be unbiased” is not a control",
    "reversal and inconsistent-pair rates",
    "residual preference shift",
    "family-conditioned error",
    "false certainty and abstention behavior",
    "verdict distribution and retry policy",
    "attack success, parser safety, and human escalation",
  ]) expect(flat).toContain(phrase);
});

test("bias mitigations retain their task-specific limits", () => {
  for (const phrase of [
    "swapping order reveals the problem but does not guarantee its removal",
    "length control is likewise an estimand",
    "report which one serves the decision",
    "neither proves neutrality",
    "candidate text is untrusted input",
    "avoid making a model judge the sole gate",
  ]) expect(flat).toContain(phrase);
});

test("the Bradley-Terry formulation defines every quantity", () => {
  for (const phrase of [
    "\\pr(y_k=1)",
    "\\beta_i-\\beta_j",
    "\\boldsymbol{\\gamma}^{\\mathsf t}\\mathbf{x}_k",
    "candidate system $i$ beats system $j$",
    "a recorded covariate vector",
    "contains the corresponding coefficients",
    "denotes transpose",
    "is the logistic function",
    "\\sum_i\\beta_i=0",
  ]) expect(flat).toContain(phrase);
});

test("ranking assumptions, ties, and separation remain visible", () => {
  for (const phrase of [
    "scalar strengths on the sampled comparison population",
    "explain transitive preferences",
    "directed win graph strongly connected",
    "unregularized maximum-likelihood ratings diverge",
    "heterogeneous or cyclic",
    "binary bradley-terry does not model tie probability",
    "repeated votes from one user, prompt, or conversation",
  ]) expect(flat).toContain(phrase);
});

test("arena rankings are conditional estimates with design-aware uncertainty", () => {
  for (const phrase of [
    "not an intrinsic capability constant",
    "resample the independent prompt or user cluster",
    "rating intervals, rank probabilities or sets",
    "sensitivity to weighting and eligibility rules",
    "human-vote and model-judge rankings should remain distinguishable",
  ]) expect(flat).toContain(phrase);
});

test("private confirmation is an information boundary rather than a purity claim", () => {
  for (const phrase of [
    "reduces direct exposure and repeated tuning",
    "does not prove that no semantically equivalent case appeared in pretraining",
    "treat such audits as evidence with error, not certificates",
    "adaptive reuse is a statistical problem",
    "limit repeated queries",
    "prevent confirmation outputs and human corrections from silently entering training data",
    "a secret set sampled from the wrong users or tasks remains invalid",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract preserves validation and training handoffs", () => {
  for (const phrase of [
    "what exact `judgespec` and evidence policy",
    "which locked reference set validated that revision",
    "which model, judge, rubric, or domain changes require revalidation",
    "a reward model is not literally the same object as a prompted model judge",
    "another learned scoring instrument",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer links remain", () => {
  expect(chapter).toContain(
    "# Model Judges and Preference Rankings {#sec-judging-holistic}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-human-evaluation-rubrics");
  expect(chapter).toContain("@sec-rlhf");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography points to verified archival records", () => {
  for (const marker of [
    "91f18a1287b398d378ef22505bf41832",
    "10.18653/v1/2023.emnlp-main.153",
    "10.18653/v1/2024.acl-long.511",
    "openreview.net/forum?id=cybbmzwbx0",
    "7f1f0218e45f5414c79c0679633e47bc",
    "10.18653/v1/2024.emnlp-main.427",
    "proceedings.mlr.press/v235/chiang24b.html",
    "openreview.net/forum?id=io4lzibeqw",
    "e32ad85fa27be4a9868d55703f01323e",
    "10.1093/biomet/39.3-4.324",
    "10.1080/00029890.1957.11989117",
    "10.1080/01621459.1970.10481082",
    "10.1126/science.aaa9375",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the previous categorical and logically incorrect claims are absent", () => {
  for (const phrase of [
    "human preference as the ground truth",
    "a reward model is a frozen model-as-judge",
    "pairwise comparison is more reliable",
    "private test set is worth more than any public leaderboard",
    "never appeared in any training mixture",
    "a rating with no interval is folklore",
    "two models inside each other's intervals are not separated",
    "twenty to fifty tasks",
    "agreement decays exactly on distribution shift",
    "the grader is the thing it grades",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("/figures/judging-holistic-1.svg");
  expect(chapter).not.toContain("/figures/judging-holistic-2.svg");
});

test("the judge-contract diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
