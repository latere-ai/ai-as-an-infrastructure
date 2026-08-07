import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const summary = readFileSync(
  new URL("../../en/practice/summary.qmd", import.meta.url),
  "utf8",
);
const flat = summary.replace(/\s+/g, " ").toLowerCase();

function bodyParagraphs(): string[] {
  return summary
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Practice Summary preserves its stable final-part interface", () => {
  expect(summary).toStartWith("# Summary {#part-practice-summary .unnumbered}\n");
  expect(summary).not.toContain("Part XIII");
  expect(summary).not.toMatch(/^## /m);
});

test("the summary follows one operating sequence instead of cataloging topics", () => {
  const markers = [
    "user promise",
    "versioned served system",
    "system fingerprint",
    "boundary contract",
    "controlled state transition",
    "user-visible outcome",
    "operating contract",
  ];
  for (const marker of markers) expect(flat).toContain(marker);
  const positions = markers.map((marker) => flat.indexOf(marker));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test("selection and deployment choices are tied to complete releases", () => {
  for (const phrase of [
    "workload contract",
    "hard constraints",
    "cloud",
    "device",
    "weights",
    "versioned serving contract",
    "device deployment",
    "adaptation release",
    "agent release",
    "retrieval release",
    "qualified fallback",
  ]) expect(flat).toContain(phrase);
});

test("composition and rollout preserve identity authority failure and recovery", () => {
  for (const phrase of [
    "immutable identity",
    "authorization",
    "deadline",
    "retry",
    "idempotency",
    "backpressure",
    "shadow",
    "canary",
    "rollback",
    "observed state",
  ]) expect(flat).toContain(phrase);
});

test("operation keeps measurement authority and production evidence distinct", () => {
  for (const phrase of [
    "semantic quality",
    "probability sample",
    "approval",
    "exact effect",
    "product event",
    "not automatically a label",
    "declared purpose",
    "data product",
  ]) expect(flat).toContain(phrase);
});

test("the closing contract connects promises to enforceable decisions", () => {
  for (const phrase of [
    "sli",
    "slo",
    "cost per accepted task",
    "reserve",
    "reconcile",
    "tenant",
    "incident",
    "unknown",
    "owner",
    "release record",
  ]) expect(flat).toContain(phrase);
});

test("the final substantive part closes on maintained responsibility", () => {
  expect(flat).toContain("dependable infrastructure");
  expect(flat).toContain("after the system changes");
  expect(flat).toContain("after it fails");
});

test("the rewrite removes catalog prose and canned summary framing", () => {
  for (const phrase of [
    "the practice part changed the book's posture",
    "model choice, serving gateways, edge deployment",
    "the recurring failure mode is the join",
    "the final takeaway",
    "a pile of tools",
    "what stays open is",
  ]) expect(flat).not.toContain(phrase);
});

test("the complete summary is substantial, readable prose", () => {
  const paragraphs = bodyParagraphs();
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean);
  expect(paragraphs.length).toBeGreaterThanOrEqual(5);
  expect(paragraphs.length).toBeLessThanOrEqual(7);
  expect(words.length).toBeGreaterThanOrEqual(450);
  expect(words.length).toBeLessThanOrEqual(700);
  expect(summary).not.toContain("—");
  expect(summary).not.toMatch(/\S-\n\S/);
});
