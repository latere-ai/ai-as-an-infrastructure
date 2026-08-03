import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/04-dpo-variants.qmd", import.meta.url),
  "utf8",
);

test("DPO chapter explains the reduction without hiding its assumptions", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "DPO fits a preference classifier without an explicit reward model",
    "What DPO removes, and what it keeps",
    "The derivation and its assumptions",
    "The closed form is over distributions, not neural-network parameters",
    "Interpreting relative movement",
    "prompt-only constant",
    "Bradley-Terry assumption",
    "support of the reference policy",
  ]) {
    expect(flat).toContain(phrase);
  }

  for (const rejected of [
    "This objective has one optimal policy",
    "halves the alignment-stage memory",
    "The one hyperparameter that matters across the family",
    "dividing by length removes that lever",
    "{#eq-",
  ]) {
    expect(chapter).not.toContain(rejected);
  }
});

test("variant objectives state their data and reference requirements", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "IPO: keep pairs and the reference, change the loss shape",
    "KTO: replace pairs with desirable and undesirable examples",
    "ORPO: combine chosen-response SFT with a preference penalty",
    "SimPO: use average log-probability and a target margin",
    "\\frac{1}{2\\beta}",
    "\\mathcal{L}_{\\mathrm{ORPO}}",
    "\\mathcal{L}_{\\mathrm{SimPO}}",
    "does not prove that DPO is universally best",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("practical guidance covers failure modes and evaluation", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "Choose from data and pipeline constraints",
    "A practical DPO run",
    "Failure modes and checks",
    "chosen-response log-probability",
    "held-out preference accuracy",
    "response length",
    "held-out task quality",
    "@li2026posttraining",
  ]) {
    expect(flat).toContain(phrase);
  }
});
