import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/06-safety-tuning-instruction-hierarchy.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();
const visualizations = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");

test("safety policy and instruction authority remain separate decisions", () => {
  for (const phrase of [
    "two different decisions",
    "what behavior is allowed",
    "which instructions control the response",
    "post-training changes the model's behavior, not its permissions",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("refusal calibration measures both sides of the boundary", () => {
  for (const phrase of [
    "unsafe-compliance rate",
    "benign-refusal rate",
    "an average can hide",
    "safe completion",
    "the safety of the output",
    "dual-use",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("A refusal is a classifier decision expressed in natural language");
});

test("instruction hierarchy separates authority from untrusted data", () => {
  for (const phrase of [
    "do not confuse role with trust",
    "root > system > developer > user > guideline",
    "quoted or retrieved text",
    "aligned and conflicting cases",
    "valid lower-authority instruction",
    "@zhang2025iheval",
    "@guo2026ihchallenge",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("This is the same pairwise machinery");
  expect(chapter).not.toContain("{#eq-");
});

test("the hierarchy diagram keeps its resolver compact on narrow screens", () => {
  expect(chapter).toContain('resolve [label="Resolve applicable,\\nnon-conflicting candidates"]');
  expect(chapter).not.toContain("resolve [shape=diamond");
});

test("written-policy training and runtime enforcement have explicit limits", () => {
  for (const phrase of [
    "self-critique and revision",
    "reinforcement learning from ai feedback",
    "policy recall",
    "policy application",
    "authorization",
    "secret handling",
    "adaptive attacks",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the safety frontier names its adjustable quantity precisely", () => {
  expect(visualizations).toContain("th: 'risk-score cutoff'");
  expect(visualizations).toContain("th: '风险分数阈值'");
  expect(visualizations).not.toContain("th: 'refusal threshold'");
});
