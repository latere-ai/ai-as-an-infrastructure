import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/03-programs-solvers-symbolic.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the model-executor boundary is specified as an interface", () => {
  for (const phrase of [
    "artifact contract",
    "execution environment",
    "status, value, trace, and resource usage",
    "relative to that environment",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("p \\sim q_\\theta");
  expect(chapter).toContain("r = E_\\Gamma(p)");
});

test("execution success is not confused with task correctness", () => {
  for (const phrase of [
    "well-formedness",
    "execution success",
    "task agreement",
    "a valid execution is not yet a valid answer",
    "wrong formalization",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("A(x,p,r)");
});

test("runtime families state both their guarantee and their boundary", () => {
  for (const phrase of [
    "interpreter or database",
    "computer algebra system",
    "smt solver",
    "proof assistant",
    "retrieval or action tool",
    "what it does not establish",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("faithfulness is split into executable, semantic, and narrative claims", () => {
  for (const phrase of [
    "execution faithfulness",
    "semantic faithfulness",
    "narrative faithfulness",
    "causally upstream",
    "does not expose the model's hidden computation",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the runnable exposes a program that executes for the wrong task", () => {
  expect(chapter).toContain("def execute(artifact):");
  expect(chapter).toContain("def check_task(problem, artifact, result):");
  expect(chapter).toContain("wrong but runnable");
  expect(chapter).toContain("contract rejects");
  expect(chapter).toContain("contract accepts");
});

test("repair remains bounded and grounded in the original request", () => {
  for (const phrase of [
    "immutable request",
    "attempt budget",
    "versioned artifact",
    "failure class",
    "do not feed raw secrets",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("formal-proving results preserve benchmark and compute qualifiers", () => {
  for (const phrase of [
    "combined alphaproof and alphageometry 2 system",
    "three of the five non-geometry problems",
    "multi-day computation",
    "pass@8192",
    "does not measure informal-to-formal translation",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("production controls treat generated artifacts as untrusted input", () => {
  for (const phrase of [
    "untrusted code",
    "network access",
    "filesystem access",
    "cpu, memory, output, and wall-time limits",
    "pin the runtime",
    "provenance",
    "abstain",
  ]) {
    expect(flat).toContain(phrase);
  }
});
