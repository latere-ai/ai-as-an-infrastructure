import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const contribute = readFileSync(
  new URL("../../en/contribute.qmd", import.meta.url),
  "utf8",
);
const flat = contribute.replace(/\s+/g, " ").toLowerCase();

test("the Contribute page preserves its stable title and existing anchors", () => {
  expect(contribute).toStartWith("# Contribute {.unnumbered}\n");
  expect(
    [...contribute.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
  ).toEqual(["What helps most", "Sending a change", "License and contribution scope"]);
});

test("the opening gives a reader the two shortest contribution paths", () => {
  for (const phrase of [
    "report an issue",
    "edit this page",
    "affected chapter",
    "source `.qmd` file",
    "pull request",
  ]) expect(flat).toContain(phrase);
});

test("useful reports identify the location claim problem and evidence", () => {
  for (const phrase of [
    "page title and section heading",
    "exact sentence",
    "what is wrong or unclear",
    "what should replace it",
    "primary source",
    "publication or release date",
  ]) expect(flat).toContain(phrase);
});

test("the page welcomes content presentation and implementation defects", () => {
  for (const phrase of [
    "factual correction",
    "stale number",
    "unclear passage",
    "broken link",
    "math",
    "diagram",
    "reader, build, or tooling",
  ]) expect(flat).toContain(phrase);
});

test("bilingual parity means shared claims rather than literal translation", () => {
  for (const phrase of [
    "update both language trees",
    "same technical claim",
    "same chapter structure",
    "not sentence-for-sentence copies",
    "reports are welcome in english or chinese",
  ]) expect(flat).toContain(phrase);
});

test("pull request guidance matches the repository and CI", () => {
  for (const phrase of [
    "contributing guide",
    "stable headings",
    "cross-references",
    "lint",
    "builds both language editions",
    "bun content and reader tests",
    "go routing tests",
  ]) expect(flat).toContain(phrase);
  expect(contribute).toContain(
    "https://github.com/latere-ai/ai-as-an-infrastructure/blob/main/CONTRIBUTING.md",
  );
});

test("the license boundary is stated as project policy without legal overreach", () => {
  for (const phrase of [
    "cc by-nc-nd 4.0",
    "repository policy",
    "corrections, clarifications, and repairs",
    "does not accept unsolicited rewrites",
    "copyright holder",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes vague and machine-like contribution language", () => {
  for (const phrase of [
    "goes out of date in public",
    "readers are the ones who notice",
    "carries the argument further",
    "a defect worth reporting",
    "meant to say the same thing",
    "two of them matter more than the rest",
    "the build is the test",
    "for its own sake",
  ]) expect(flat).not.toContain(phrase);
});

test("the complete page remains concise and readable", () => {
  const words = contribute.split(/\s+/).filter(Boolean);
  expect(words.length).toBeGreaterThanOrEqual(600);
  expect(words.length).toBeLessThanOrEqual(1000);
  expect(contribute).not.toContain("—");
  expect(contribute).not.toMatch(/\S-\n\S/);
});
