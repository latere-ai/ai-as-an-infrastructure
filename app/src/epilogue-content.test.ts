import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const epilogue = readFileSync(
  new URL("../../en/summary.qmd", import.meta.url),
  "utf8",
);
const flat = epilogue.replace(/\s+/g, " ").toLowerCase();

function bodyParagraphs(): string[] {
  return epilogue
    .replace(/^# .+\n+/, "")
    .replace(/^## .+$/gm, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Epilogue preserves its stable book interface", () => {
  expect(epilogue).toStartWith("# Epilogue {.unnumbered}\n");
  expect(
    [...epilogue.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
  ).toEqual(["Where to go next"]);
});

test("dependency rather than model novelty defines infrastructure", () => {
  for (const phrase of [
    "becomes infrastructure when",
    "depend on it",
    "complete deployed system",
    "model is one component",
    "maintained",
    "recovered",
  ]) expect(flat).toContain(phrase);
});

test("the three loops remain distinct and connected", () => {
  const markers = ["training loop", "inference loop", "agent loop"];
  for (const marker of markers) expect(flat).toContain(marker);
  const positions = markers.map((marker) => flat.indexOf(marker));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(flat).toContain("different state");
});

test("constraint arrows explain why local choices have non-local effects", () => {
  for (const phrase of [
    "constraint arrows",
    "local choice",
    "tokenizer",
    "context window",
    "benchmark",
    "sandbox",
    "downstream obligation",
  ]) expect(flat).toContain(phrase);
});

test("capability efficiency and trust are evaluated as a complete-system vector", () => {
  for (const phrase of [
    "capability",
    "efficiency",
    "trust",
    "not a ranking",
    "user-visible task",
    "accepted result",
    "authority",
    "evidence",
  ]) expect(flat).toContain(phrase);
});

test("production evidence is not silently promoted into truth or training data", () => {
  for (const phrase of [
    "production event",
    "observation",
    "not automatically a label",
    "declared purpose",
    "sampling",
    "evaluation",
    "training",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("production traffic becomes the next model's data");
});

test("future claims describe conditional pressures rather than destiny", () => {
  for (const phrase of [
    "can move the bottleneck",
    "cheaper inference can",
    "longer context can",
    "stronger model judges can",
    "synthetic data can",
    "verification",
    "provenance",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("some curves will keep compounding");
  expect(flat).not.toContain("will force");
});

test("the infrastructure commitment names distribution and failure", () => {
  for (const phrase of [
    "who benefits",
    "who pays",
    "who is excluded",
    "who has authority",
    "what happens when it fails",
    "not neutral",
  ]) expect(flat).toContain(phrase);
});

test("the next step is a concrete operating record rather than a slogan", () => {
  for (const phrase of [
    "versioned system identity",
    "user promise",
    "measurement",
    "budget",
    "tenant",
    "rollback",
    "incident",
    "owner",
    "release record",
  ]) expect(flat).toContain(phrase);
});

test("the closing keeps responsibility with people", () => {
  expect(flat).toContain("responsibility does not end when the system acts");
  expect(flat).toContain("who remains responsible");
});

test("the rewrite removes catalog prose and familiar closing templates", () => {
  for (const phrase of [
    "the book followed one capability through that stack",
    "we began with base-model formation",
    "that journey should leave one habit behind",
    "the future will not follow a single line on a chart",
    "the old public question was whether machines can think",
    "this is why the infrastructure lens matters",
    "keep the map alive",
    "stay with the contested parts",
    "finally, keep the human position in view",
    "calling apis and hoping the boundaries hold",
  ]) expect(flat).not.toContain(phrase);
});

test("the complete Epilogue remains substantial readable prose", () => {
  const paragraphs = bodyParagraphs();
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean);
  expect(paragraphs.length).toBeGreaterThanOrEqual(10);
  expect(paragraphs.length).toBeLessThanOrEqual(14);
  expect(words.length).toBeGreaterThanOrEqual(1000);
  expect(words.length).toBeLessThanOrEqual(1500);
  expect(epilogue).not.toContain("—");
  expect(epilogue).not.toMatch(/\S-\n\S/);
});
