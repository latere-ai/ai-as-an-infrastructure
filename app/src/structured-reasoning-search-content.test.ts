import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/02-structured-reasoning-search.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("search is specified as a controller around fixed model calls", () => {
  for (const phrase of [
    "state representation",
    "expansion function",
    "frontier policy",
    "partial-state evaluator",
    "terminal test",
    "final selector",
    "stopping rule",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).toContain("the model still generates tokens");
});

test("the formal objective distinguishes oracle quality from observable scores", () => {
  for (const phrase of [
    "unknown task quality",
    "observable terminal checker",
    "learned or prompted estimate",
    "does not make the oracle objective executable",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("v is often a vote");
});

test("tree growth and bounded frontiers have explicit budget consequences", () => {
  expect(chapter).toContain("N_{\\text{full}}");
  expect(chapter).toContain("\\sum_{d=0}^{D} b^d");
  for (const phrase of [
    "branching factor",
    "maximum depth",
    "beam width",
    "generated nodes",
    "does not guarantee",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("frontier policies are compared rather than collapsed into tree search", () => {
  for (const phrase of [
    "breadth-first",
    "depth-first",
    "beam search",
    "best-first",
    "monte carlo tree search",
    "exploration bonus",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the chapter explains evaluator selection pressure", () => {
  expect(chapter).toContain("\\widehat v(s)=v^*(s)+\\varepsilon(s)");
  for (const phrase of [
    "selection bias",
    "highest observed score",
    "out-of-distribution",
    "false pruning",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("graph reuse requires a defensible state identity", () => {
  for (const phrase of [
    "transposition",
    "canonical state key",
    "same text",
    "different hidden state",
    "cycle detection",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the runnable demonstrates irreversible pruning under a bad heuristic", () => {
  expect(chapter).toContain("def beam_search(width):");
  expect(chapter).toContain("width=1:");
  expect(chapter).toContain("width=2:");
  expect(flat).toContain("a pruned branch cannot recover later");
});

test("production guidance requires matched budgets and operational controls", () => {
  for (const phrase of [
    "matched-budget",
    "wall-clock deadline",
    "deduplication rate",
    "evaluator version",
    "fallback",
    "abstain",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("empirical examples remain scoped to their actual systems", () => {
  for (const phrase of [
    "game of 24, creative writing, and mini crosswords",
    "sorting benchmark",
    "trained policy, value, and outcome-reward components",
    "not evidence that language tree search is generally superior",
    "react is not itself a search algorithm",
  ]) {
    expect(flat).toContain(phrase);
  }
});
