import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const summary = readFileSync(
  new URL("../../en/evaluation/summary.qmd", import.meta.url),
  "utf8",
);
const flat = summary.replace(/\s+/g, " ").toLowerCase();
const paragraphs = summary
  .replace(/^# .+\n+/, "")
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean);

test("the summary states the evaluation contract before discussing scores", () => {
  for (const phrase of [
    "evaluation begins with a decision",
    "complete system",
    "target population",
    "measurement instrument",
    "evidence would change the decision",
  ]) expect(flat).toContain(phrase);
});

test("the summary preserves the measured object and analysis design", () => {
  for (const phrase of [
    "model, harness, task manifest, scorer, and aggregation rule",
    "preserves paired cases",
    "decision-relevant effect",
    "uncertainty does not repair bias",
  ]) expect(flat).toContain(phrase);
});

test("human judges factuality and agents remain distinct instruments", () => {
  for (const phrase of [
    "human label is an observation made under a protocol",
    "model judge is a versioned instrument",
    "truth, grounding, attribution, and citation quality",
    "state the system changed",
  ]) expect(flat).toContain(phrase);
});

test("the synthesis carries evidence into an operational release decision", () => {
  for (const phrase of [
    "development, locked confirmation, and diagnostic suites",
    "offline, shadow, canary, and production evidence",
    "promote, hold, narrow, roll back, or escalate",
    "evidence expires",
  ]) expect(flat).toContain(phrase);
});

test("the Part VIII handoff connects evidence authority and enforcement", () => {
  expect(summary).toContain("Part VIII starts from that dependency on evidence");
  for (const phrase of [
    "what must be constrained",
    "who has authority",
    "where the control is enforced",
  ]) expect(flat).toContain(phrase);
});

test("the summary is concise narrative prose without the old framing", () => {
  expect(paragraphs.length).toBeGreaterThanOrEqual(4);
  expect(paragraphs.length).toBeLessThanOrEqual(5);
  expect(summary).not.toMatch(/^[-*] /m);
  for (const phrase of [
    "looked like an external score only until",
    "a number should therefore carry an authority level",
    "suspicion is warranted; cynicism is not",
    "decorative leaderboard",
  ]) expect(flat).not.toContain(phrase);
});
