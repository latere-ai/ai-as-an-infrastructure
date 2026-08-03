import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/05-verifiable-rewards-reasoning.qmd", import.meta.url),
  "utf8",
);
const visualizations = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");

test("the chapter defines the verifier as an implemented specification", () => {
  const flat = chapter.replace(/\s+/g, " ").toLowerCase();
  for (const phrase of [
    "the checker is the specification the optimizer sees",
    "false positive",
    "false negative",
    "a unit test is executable, not a complete specification",
    "separate train and evaluation checkers",
  ]) {
    expect(flat).toContain(phrase);
  }

  for (const rejected of [
    "A unit test or exact answer checker is harder to flatter",
    "If the model never stumbles into a correct answer, no gradient can teach it where to go",
    "Tülu 3 coined the name RLVR",
    "a third option",
    "{#eq-",
  ]) {
    expect(chapter).not.toContain(rejected);
  }
});

test("selection, rejection sampling, and RLVR remain distinct", () => {
  const flat = chapter.replace(/\s+/g, " ").toLowerCase();
  for (const phrase of [
    "selection is not training",
    "1-(1-p)^n",
    "cannot create coverage",
    "rejection-sampling fine-tuning",
    "on-policy completions",
    "an informative group needs reward variation",
    "1-p^g-(1-p)^g",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("reward timing is separated from reward provenance", () => {
  const flat = chapter.replace(/\s+/g, " ").toLowerCase();
  for (const phrase of [
    "outcome and process are one axis; executable and learned are another",
    "outcome rewards",
    "process rewards",
    "process reward model",
    "rule-based outcome checker",
    "learned outcome reward model",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the operational guidance measures optimization and generalization", () => {
  const flat = chapter.replace(/\s+/g, " ").toLowerCase();
  for (const phrase of [
    "reward rate by prompt",
    "reward variance",
    "response length",
    "held-out pass rate",
    "out-of-domain quality",
    "@shao2025spurious",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the sampling visualization distinguishes an ideal oracle from a learned selector", () => {
  expect(visualizations).toContain("ideal: 'ideal oracle'");
  expect(visualizations).toContain("ideal: '理想核查器'");
  expect(visualizations).not.toContain("reliable checker");
  expect(visualizations).not.toContain("可靠检查器");
});
