import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/01-eliciting-reasoning.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("elicitation is defined as a fixed-weight inference procedure", () => {
  for (const phrase of [
    "weights stay fixed",
    "prompt or task representation",
    "candidate generator",
    "answer extractor",
    "selector or verifier",
    "budget and stopping rule",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("fixed, equal slice of compute on every token");
});

test("chain-of-thought evidence is scoped to what the studies establish", () => {
  for (const phrase of [
    "sufficiently large models",
    "two-stage prompt",
    "does not prove that the capability was latent",
    "task and model dependent",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("the ability was latent");
});

test("self-consistency states the assumptions behind voting gains", () => {
  for (const phrase of [
    "answer mode",
    "conditionally independent",
    "correlated errors",
    "p > 1/2",
    "answer extraction",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("\\binom{n}{k}");
  expect(flat).not.toContain("wrong paths scatter");
});

test("reasoning search exposes all task-specific controller choices", () => {
  for (const phrase of [
    "thought unit",
    "expansion rule",
    "state evaluator",
    "frontier policy",
    "stopping rule",
    "amplify evaluator error",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("selection separates candidate coverage from evaluator reliability", () => {
  for (const phrase of [
    "candidate coverage",
    "deterministic checker",
    "learned scorer",
    "false acceptance",
    "false rejection",
    "selection regret",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("a score rewards correctness");
  expect(flat).not.toContain("verifier quality is the ceiling");
});

test("the chapter treats visible reasoning as an artifact and gives operating controls", () => {
  for (const phrase of [
    "work artifact, not a proof",
    "faithfulness",
    "latency budget",
    "parallel",
    "fallback",
    "telemetry",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the opening inference pipeline stays compact on narrow screens", () => {
  expect(chapter).toContain('budget [label="Token · sample · scorer\\nlatency budget"');
  expect(chapter).toContain(
    "request -> prepare -> budget -> generate -> extract -> select -> response;",
  );
  expect(chapter).not.toContain("budget -> select");
});

test("the agreement-versus-checking diagram uses narrow labels", () => {
  expect(chapter).toContain('mode [label="Answer mode\\nagreement"]');
  expect(chapter).toContain('check [label="Exact task checker\\nencoded condition"]');
});
