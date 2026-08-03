import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/07-synthetic-data-self-improvement.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("synthetic-data methods are composable design choices, not a chronology", () => {
  for (const phrase of [
    "methods compose",
    "prompt source",
    "response generator",
    "acceptance signal",
    "update rule",
    "iteration schedule",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("form a single lineage: a steady retreat");
});

test("sampling coverage is separated from selection quality", () => {
  for (const phrase of [
    "candidate coverage",
    "selection precision",
    "false-positive rate",
    "retained distribution",
    "independent draws",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("1 - (1 - p_x)^n");
  expect(flat).not.toContain("the filter cannot be manipulated");
});

test("major examples state what supervision they actually remove", () => {
  for (const phrase of [
    "lima did not test a self-training loop",
    "curated training questions",
    "no supervised reasoning demonstrations",
    "zero task data",
    "not zero pretraining data",
    "learned process reward model remains a proxy",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).not.toContain("from no external data at all");
  expect(flat).not.toContain("lima is the clean evidence");
});

test("recursive training has explicit controls and stop conditions", () => {
  for (const phrase of [
    "replacement regime",
    "accumulation regime",
    "real-data anchor",
    "independent holdout",
    "provenance",
    "decontamination",
    "stop the loop",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the chapter removes absolute claims about teachers and judges", () => {
  for (const phrase of [
    "frontier model is often already better than the median labeler",
    "ground truth, not a proxy",
    "trust you can place in the result is entirely a property of `judge`",
  ]) {
    expect(flat).not.toContain(phrase);
  }
});

test("the audit-loop diagram wraps wide labels for narrow screens", () => {
  expect(chapter).toContain('fontsize=8.5');
  expect(chapter).toContain('human · teacher · model\\nenvironment');
  expect(chapter).toContain('Promote, revise, stop,\\nor start the next round');
  expect(chapter).toContain('decision -> generate [style=dashed];');
});
