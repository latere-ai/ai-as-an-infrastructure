import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const changelog = readFileSync(
  new URL("../../en/changelog.qmd", import.meta.url),
  "utf8",
);
const flat = changelog.replace(/\s+/g, " ").toLowerCase();

const expectedWeeks = [
  "August 24 to 29, 2026",
  "August 4 to 8, 2026",
  "July 27 to August 3, 2026",
  "July 20 to 26, 2026",
  "July 6 to 12, 2026",
  "June 29 to July 5, 2026",
  "June 22 to 28, 2026",
  "June 19 to 21, 2026",
];

function weekSections(): string[] {
  return changelog.split(/^## /gm).slice(1);
}

test("the Changelog preserves its stable page interface and reverse chronology", () => {
  expect(changelog).toStartWith("# Changelog {.unnumbered}\n");
  expect(
    [...changelog.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
  ).toEqual(expectedWeeks);
});

test("the introduction tells returning readers how to use the record", () => {
  for (const phrase of [
    "reader-visible changes",
    "return to a chapter",
    "what was wrong",
    "what replaced it",
    "weeks without a reader-visible change are omitted",
  ]) expect(flat).toContain(phrase);
});

test("the current entry records the chapters that gained material", () => {
  const current = weekSections()[0].toLowerCase();
  for (const phrase of [
    "on-policy distillation",
    "where training environments come from",
    "the reasoning trace as a second monitoring surface",
    "a benchmark's signal and its noise",
    "how far the tuned model has moved from the base model",
  ]) expect(current).toContain(phrase);
});

test("the preceding entry still records the verified English rewrite", () => {
  const previous = weekSections()[1].toLowerCase();
  for (const phrase of [
    "english rewrite reached the epilogue",
    "one complete unit at a time",
    "scope, evidence, failure behavior, and operating handoff",
    "chapter-specific regression tests",
    "desktop and mobile",
  ]) expect(previous).toContain(phrase);
});

test("every dated entry remains a scannable categorized record", () => {
  for (const section of weekSections()) {
    const categories = [...section.matchAll(/^\*\*(New|Changed|Corrected)\*\*$/gm)];
    expect(categories.length).toBeGreaterThanOrEqual(2);
    expect(section).toMatch(/^- /m);
  }
});

test("release tags stay attached to the weeks in which they were published", () => {
  const sections = weekSections();
  expect(sections[3]).toContain("v0.2.0");
  expect(sections[4]).toContain("v0.1.0");
  expect(sections[7]).toContain("v0.0.1");
});

test("the historical additions and structural changes remain discoverable", () => {
  for (const phrase of [
    "canonical url",
    "51 verified corrections",
    "egress substitution",
    "eight new chapters",
    "eighteen new chapters",
    "121 terms",
    "twenty-six interactive figures",
  ]) expect(flat).toContain(phrase);
});

test("important corrections retain both the old defect and the replacement", () => {
  for (const phrase of [
    "average number of tokens into which a word is split",
    "per-step cost are linear",
    "85 to 90 percent",
    "eight percentage points",
    "232 bibliography fields",
    "`budget_tokens`",
    "only dapo removes it",
    "`-α'_t/(1-α_t)`",
    "twenty times",
    "irving, christiano, and amodei",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes awkward and promotional changelog phrasing", () => {
  for (const phrase of [
    "where they fall",
    "wrong spelling of its address",
    "the stage the funnel leaves out",
    "the framework the developer writes for itself",
    "quietly shortens",
    "where the spine had a hole",
    "what nineteen years of accumulated software mean",
    "what a won comparison is worth",
  ]) expect(flat).not.toContain(phrase);
});

test("the complete record remains substantial without becoming a prose wall", () => {
  const words = changelog.split(/\s+/).filter(Boolean);
  expect(words.length).toBeGreaterThanOrEqual(2800);
  expect(words.length).toBeLessThanOrEqual(4200);
  expect(changelog).not.toContain("—");
  expect(changelog).not.toMatch(/\S-\n\S/);

  const bullets = changelog
    .split(/^\*\*(?:New|Changed|Corrected)\*\*$/gm)
    .flatMap((block) => block.split(/\n(?=- )/))
    .filter((block) => block.startsWith("- "));
  for (const bullet of bullets) {
    expect(bullet.split(/\s+/).length).toBeLessThanOrEqual(190);
  }
});
