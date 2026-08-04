import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/safety/02-scalable-oversight-control.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/scalable-oversight-control.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines two scoped and non-interchangeable claims", () => {
  for (const phrase of [
    "scalable oversight asks whether a weaker overseer can produce a reliable training or evaluation signal for a more capable system",
    "ai control asks whether a deployment protocol can prevent a defined unacceptable outcome even when an untrusted model tries to cause it",
    "the two claims are not interchangeable",
    "model revision",
    "input distribution",
    "available information",
    "oversight decision",
    "not by itself a deployment authorization",
  ]) expect(flat).toContain(phrase);
});

test("capability gaps are task-specific and separated from other supervision gaps", () => {
  for (const phrase of [
    "capability is task-specific",
    "task-capability gap",
    "information gap",
    "verification gap",
    "resource gap",
    "adversarial gap",
    "no single scalar gap predicts oversight",
    "frozen task distribution",
    "uncertainty interval",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\Delta_\{\\mathrm\{task\}\}\s*=\s*S_\{\\mathrm\{model\}\}\(\\mathcal\{D\}\)\s*-\s*S_\{\\mathrm\{overseer\}\}\(\\mathcal\{D\}\)/);
});

test("training signals, evaluation evidence, and deployment control remain distinct", () => {
  for (const phrase of [
    "training-time elicitation",
    "assisted evaluation",
    "deployment control",
    "an improved supervision signal is not a release decision",
    "a control result is not evidence that the model is aligned",
    "these methods can be combined",
  ]) expect(flat).toContain(phrase);
});

test("weak-to-strong evidence includes a defined recovery fraction and its scope", () => {
  for (const phrase of [
    "@gls-weak-to-strong generalization asks whether weak labels can elicit stronger latent capability",
    "weak-supervisor score",
    "weak-label student score",
    "strong-model ceiling",
    "positive denominator",
    "empirical proxy",
    "natural-language tasks, chess, and reward modeling",
    "not a demonstration of superhuman alignment",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/R\s*=\s*\\frac\{S_\{\\mathrm\{ws\}\}-S_\{\\mathrm\{w\}\}\}\s*\{S_\{\\mathrm\{s\}\}-S_\{\\mathrm\{w\}\}\}/);
});

test("amplification and debate state their experimental status and assumptions", () => {
  for (const phrase of [
    "iterated amplification is a proposal",
    "information asymmetry",
    "quality",
    "the truthful side can surface decisive evidence",
    "the opponent can challenge unsupported claims",
    "the judge can recognize valid evidence",
    "does not establish that debate works across arbitrary domains or capability gaps",
  ]) expect(flat).toContain(phrase);
});

test("the control section declares actors, threat model, and adversarial protocol", () => {
  for (const phrase of [
    "untrusted policy",
    "trusted monitor",
    "audit budget",
    "unacceptable outcome",
    "blue team",
    "red team",
    "commits the protocol",
    "attacker knowledge",
    "adaptive attacks",
    "collusion",
  ]) expect(flat).toContain(phrase);
});

test("control metrics separate usefulness, attack success, errors, and resources", () => {
  for (const phrase of [
    "attack success rate",
    "false-accept rate",
    "false-reject rate",
    "audit rate",
    "cost and latency",
    "deployment horizon",
    "one minus asr",
    "only under the declared hazard detector and attack distribution",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/U\(\\pi\)\s*=\s*\\mathbb\{E\}_\{x\\sim\\mathcal\{D\}_b\}/);
  expect(chapter).toMatch(/\\operatorname\{ASR\}\(\\pi,a\)\s*=\s*\\Pr_\{x\\sim\\mathcal\{D\}_a\}/);
});

test("deception-related evidence is bounded to the constructed experiments", () => {
  for (const phrase of [
    "the answer is @gls-deceptive-alignment: the possibility that a model can appear aligned under training",
    "proof-of-concept",
    "deliberately trained backdoor",
    "does not estimate how often such behavior arises naturally",
    "explicit situational information",
    "model-generated scratchpad",
    "not privileged access to intent",
    "not proof of subjective intent",
  ]) expect(flat).toContain(phrase);
});

test("agent-control evidence remains tied to its benchmark", () => {
  for (const phrase of [
    "bashbench",
    "257",
    "58 percent to 7 percent",
    "5 percent usefulness cost",
    "hidden side objectives",
    "transcript monitor",
    "benchmark-bound",
  ]) expect(flat).toContain(phrase);
});

test("capability-gap scaling is presented as a fitted framework, not a universal law", () => {
  for (const phrase of [
    "role-specific domain elo",
    "chatbot arena elo as a proxy",
    "four simplified games",
    "piecewise-linear",
    "model-based estimates",
    "not a general estimate of deployment risk",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("s=150");
  expect(chapter).not.toContain("s=600");
  expect(chapter).not.toContain('data-family="exp-decay"');
});

test("the operating contract makes an oversight evaluation reproducible", () => {
  for (const field of [
    "evaluation_id",
    "model_and_overseer_revisions",
    "task_distribution_and_splits",
    "ground_truth_provenance",
    "role_access_tools_and_budgets",
    "gap_metric_and_pair_scores",
    "protocol_and_code_revision",
    "baselines_and_ablations",
    "monitor_calibration_and_thresholds",
    "adversary_knowledge_and_budget",
    "audit_capacity_and_escalation",
    "safety_usefulness_cost_metrics",
    "deployment_horizon_and_dependence",
    "shift_adaptation_and_collusion_tests",
    "retained_artifacts",
    "claim_scope_stop_rules_and_failures",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("cannot authorize deployment on its own");
});

test("stable structure, visuals, and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Scalable Oversight and Control {#sec-oversight-control}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  for (const ref of [
    "@sec-rlhf",
    "@sec-scaling-laws",
    "@sec-interpretability",
    "@sec-security-authorization",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain('data-viz="stepper"');
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses authoritative and accessible records", () => {
  for (const marker of [
    "arxiv.org/abs/2211.03540",
    "proceedings.mlr.press/v235/burns24b.html",
    "arxiv.org/abs/1810.08575",
    "arxiv.org/abs/1805.00899",
    "proceedings.mlr.press/v235/khan24a.html",
    "899511e37a8e01e1bd6f6f1d377cc250",
    "proceedings.mlr.press/v235/greenblatt24a.html",
    "arxiv.org/abs/2401.05566",
    "arxiv.org/abs/2504.18530",
    "arxiv.org/abs/2412.14093",
    "arxiv.org/abs/2501.17315",
    "arxiv.org/abs/2504.10374",
    "arxiv.org/abs/2506.15740",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
  expect(bibliography).toContain("Kantamneni, Subhash");
});

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliography).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});

test("synthetic evidence and machine-like framing are absent", () => {
  expect(chapter).not.toContain(":::: {.runnable}");
  expect(chapter).not.toContain("/figures/scalable-oversight-control-1.svg");
  for (const phrase of [
    "human judgment has an expiry date",
    "the moment the model overtakes the human, it fails",
    "two philosophies for one problem",
    "the trust camp",
    "the containment camp",
    "the existence proof that makes containment necessary",
    "why the field is tilting toward control",
    "a claim you can ship",
    "the gap is the wall",
    "deception-shaped behavior arose from context alone",
  ]) expect(flat).not.toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
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
