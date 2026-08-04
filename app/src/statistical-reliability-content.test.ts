import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/evaluation/02-statistical-reliability.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/statistical-reliability.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening scopes reliability to a decision contract", () => {
  for (const phrase of [
    "a benchmark score is an estimate only when",
    "names a target population",
    "is b better than a by enough to matter",
    "defines how strongly the observed data support a decision",
  ]) expect(flat).toContain(phrase);
});

test("the estimand names item, run, and scorer variation", () => {
  for (const phrase of [
    "\\theta_s",
    "u \\sim p",
    "r \\sim q",
    "j \\sim h",
    "target population",
    "run configuration",
    "scoring protocol",
  ]) expect(flat).toContain(phrase);
});

test("fixed-suite description is not mislabeled as sampling inference", () => {
  for (const phrase of [
    "complete descriptive result",
    "there is no item-sampling error to estimate",
    "an item bootstrap adds a hypothetical population assumption",
    "run or scorer uncertainty may still remain",
  ]) expect(flat).toContain(phrase);
});

test("independence and clustering are explicit", () => {
  for (const phrase of [
    "the row count is not automatically the sample size",
    "twenty attempts on one repository",
    "correlated rows as independent",
    "resample or model the cluster",
    "repeats nested within the task",
  ]) expect(flat).toContain(phrase);
});

test("the Wald interval is only a planning sketch", () => {
  for (const phrase of [
    "h_{\\mathrm{wald}}",
    "useful planning sketch",
    "not a universal production interval",
    "wilson interval",
    "not a power analysis, a paired comparison, or a release rule",
  ]) expect(flat).toContain(phrase);
});

test("bootstrap guidance preserves the sampling design", () => {
  for (const phrase of [
    "recompute the whole estimator",
    "does not discover the correct unit",
    "row-wise bootstrap over correlated rows",
    "apply the same declared weights in every resample",
  ]) expect(flat).toContain(phrase);
});

test("confidence interval interpretation remains procedural", () => {
  for (const phrase of [
    "interval-producing procedure covers the fixed target",
    "not a statement that this realized frequentist interval has a 95% probability",
    "name the model and prior",
  ]) expect(flat).toContain(phrase);
});

test("model comparison uses paired differences", () => {
  for (const phrase of [
    "d_g = y_{gb} - y_{ga}",
    "\\widehat{\\delta}",
    "resample paired clusters",
    "separate intervals around a and b throw away their covariance",
    "exact paired-binomial form",
  ]) expect(flat).toContain(phrase);
});

test("decision margins distinguish superiority, non-inferiority, and equivalence", () => {
  for (const phrase of [
    "smallest effect of interest",
    "superiority by a meaningful amount",
    "non-inferiority",
    "practical equivalence",
    "failing to reject an exact zero is not evidence of equivalence",
    "guardrails need their own one-sided margins",
  ]) expect(flat).toContain(phrase);
});

test("power is prospective and design-specific", () => {
  for (const phrase of [
    "power is the probability that a specified procedure",
    "effect or margin, error rate, desired power",
    "use 1,000 examples\” is not a power analysis",
    "invalid or missing outcomes",
  ]) expect(flat).toContain(phrase);
});

test("sequential, multiplicity, and adaptive reuse policies are separate", () => {
  for (const phrase of [
    "stopping on the first favorable interval",
    "confidence sequence",
    "family-wise error-rate control",
    "expected false-discovery proportion",
    "repeated model and prompt selection",
    "confirmation set inaccessible during development",
  ]) expect(flat).toContain(phrase);
});

test("p-values, precision, bias, and calibration are not conflated", () => {
  for (const phrase of [
    "not the probability that the null is true",
    "a precise estimate can be precisely wrong",
    "confidence intervals do not cover contamination",
    "calibration is a related but separate estimand",
    "accuracy alone cannot establish calibration",
  ]) expect(flat).toContain(phrase);
});

test("the result schema preserves the complete analysis contract", () => {
  for (const field of [
    "target_population",
    "estimand",
    "independent_unit",
    "cluster_keys",
    "effect_margin",
    "interval_method",
    "sequential_rule",
    "multiplicity_family",
    "selection_history",
    "confirmation_set_version",
    "invalid_outcome_counts",
  ]) expect(flat).toContain(field);
});

test("the operating procedure and handoff remain explicit", () => {
  for (const phrase of [
    "plan sample size from the design",
    "run a and b on the same units",
    "if the result is unresolved, say so",
    "no row silently changes the sampling unit",
    "@sec-human-evaluation-rubrics",
    "::: {#further-reading}",
  ]) expect(flat).toContain(phrase);
});

test("the bibliography contains verified primary records", () => {
  for (const marker of [
    "10.1214/ss/1009213286",
    "10.1177/2515245918770963",
    "aclanthology.org/2020.emnlp-main.745",
    "10.1214/20-aos1991",
    "10.1080/00031305.2016.1154108",
    "pubmed.ncbi.nlm.nih.gov/26250683",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("unsupported reliability shortcuts are absent", () => {
  for (const phrase of [
    "overlap enough that the apparent gap should trigger",
    "caps the fraction of claimed wins",
    "discards real effects",
    "a result without one asks the reader",
    "decision-grade",
    "investigate only",
  ]) expect(flat).not.toContain(phrase);
});
