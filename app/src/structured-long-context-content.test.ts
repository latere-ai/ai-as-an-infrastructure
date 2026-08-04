import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/05-structured-long-context.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/structured-long-context.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter remains plain UTF-8 with locally owned citations", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(keys.size).toBeGreaterThanOrEqual(7);
  for (const key of keys) {
    expect(bibliography, `${key} should be owned by this chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("structured decoding defines the conditional distribution and completion rule", () => {
  for (const expression of [
    "A(s_t)",
    "p_G(v\\mid x_{<t},s_t)",
    "\\mathbf 1[v\\in A(s_t)]",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "keeps at least one accepting completion reachable",
    "end-of-sequence token is legal only",
    "empty allowed set",
  ]) expect(flat).toContain(phrase);
});

test("the constrained-softmax runnable is deterministic and rejects a dead state", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toContain("numpy");
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const script = `${cell![1]}\ntry:\n    constrained_softmax(logits, set())\nexcept ValueError as error:\n    print(type(error).__name__ + ": " + str(error))`;
  const run = Bun.spawnSync([python!, "-c", script], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain('     "  1.000');
  expect(run.stdout.toString()).toContain("legal mass: 1.0");
  expect(run.stdout.toString()).toContain("illegal mass: 0.0");
  expect(run.stdout.toString()).toContain("ValueError: empty allowed set");
});

test("the guarantee stops at syntax and implemented schema semantics", () => {
  for (const phrase of [
    "syntactic validity is not value correctness",
    "supported subset of json schema",
    "consumer validates the finished object again",
    "grammar coverage",
  ]) expect(flat).toContain(phrase);
});

test("tokenization and grammar state are connected without character shortcuts", () => {
  for (const phrase of [
    "bytes produced by the tokenizer",
    "consume the token's complete byte string",
    "regular languages",
    "context-free grammar",
    "parser stack",
  ]) expect(flat).toContain(phrase);
});

test("compiled masks and forced spans retain their runtime costs", () => {
  for (const phrase of [
    "compile cache key",
    "tokenizer revision",
    "mask application still touches",
    "forced span must still enter the model state",
    "prefill-style pass",
  ]) expect(flat).toContain(phrase);
});

test("long-context inference separates four different limits", () => {
  for (const phrase of [
    "model's supported context length",
    "kv capacity",
    "attention traffic",
    "information retention",
  ]) expect(flat).toContain(phrase);
});

test("cache policies have explicit state and failure semantics", () => {
  for (const phrase of [
    "eviction is irreversible",
    "prompt compression",
    "query-aware page selection",
    "keeps the full cache",
    "position metadata",
    "selected pages can change at the next query",
  ]) expect(flat).toContain(phrase);
});

test("deployment verification measures guarantees, quality, and service behavior", () => {
  for (const phrase of [
    "schema-valid rate",
    "field-level correctness",
    "grammar compilation latency",
    "time per output token",
    "retrieval accuracy by evidence position",
    "peak kv memory",
    "matched load",
  ]) expect(flat).toContain(phrase);
});

test("bibliography prefers archival records and curates further reading", () => {
  for (const url of [
    "https://proceedings.iclr.cc/paper_files/paper/2024/hash/5e5fd18f863cbe6d8ae392a93fd271c9-Abstract-Conference.html",
    "https://proceedings.neurips.cc/paper_files/paper/2023/hash/6ceefa7b15572587b78ecfcebb2827f8-Abstract-Conference.html",
    "https://proceedings.mlr.press/v235/tang24l.html",
  ]) expect(bibliography).toContain(url);
});

test("the rewrite removes synthetic evidence and false shortcuts", () => {
  for (const phrase of [
    "/figures/structured-long-context-1.svg",
    "data-family=\"diminishing\"",
    "whose first character",
    "emitted, no model call",
    "every step removes a cost",
    "bends a fixed model",
    "most keys are dead weight",
  ]) expect(flat).not.toContain(phrase);
});
