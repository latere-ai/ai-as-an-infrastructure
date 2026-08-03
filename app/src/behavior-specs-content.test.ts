import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/02-behavior-specs-preference-data.qmd", import.meta.url),
  "utf8",
);

test("behavior specification chapter carries policy through collection and audit", () => {
  const flat = chapter.replace(/\s+/g, " ");
  const required = [
    "A preference label is a measurement, not a fact",
    "Write the behavioral contract before the rubric",
    "Turn policy language into a decision procedure",
    "Sample comparisons that expose a boundary",
    "A pairwise label preserves one bit of the judgment",
    "Separate mistakes, ambiguity, and legitimate disagreement",
    "AI feedback changes who applies the rubric",
    "Ship the dataset with its measurement context",
    "Lower-layer constraint",
    "rankdir=TB;",
    "constraint=false",
  ];
  for (const phrase of required) expect(flat).toContain(phrase);

  const rejected = [
    "The formal object is a utility, even when nobody writes one down",
    "The disagreement rate is the noise floor",
    "AI judges are cheap, consistent, multilingual",
    "The practical answer is hybrid supervision",
    "A reward model is a frozen copy of that instrument",
    "Constraint Arrow",
    "rankdir=LR;",
  ];
  for (const phrase of rejected) expect(chapter).not.toContain(phrase);
});

test("pairwise preference model defines every symbol and preserves uncertainty", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "p(y_i \\succ y_j \\mid x)",
    "r_\\phi(x,y_i)",
    "ties, preference strength, and individual votes",
    "randomize which response appears first",
    "sampling policy and decoding settings",
  ]) {
    expect(flat).toContain(phrase);
  }
});
