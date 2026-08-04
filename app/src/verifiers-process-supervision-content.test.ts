import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/04-verifiers-process-supervision.qmd", import.meta.url),
  "utf8",
);
const figure = readFileSync(
  new URL("../../figures-src/verifiers-process-supervision-1.py", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("verifier taxonomy keeps independent design choices separate", () => {
  for (const phrase of [
    "three independent questions",
    "where is the signal attached?",
    "how is judgment produced?",
    "what does it return?",
    "not a ladder",
  ]) {
    expect(flat).toContain(phrase);
  }

  expect(figure).toContain("AXES = [");
  expect(figure).not.toContain("formal checker\", 0.16, 0.90");
});

test("outcome and process supervision define the object being labeled", () => {
  for (const phrase of [
    "terminal object",
    "step correctness",
    "progress",
    "value to go",
    "not interchangeable targets",
    "aggregation rule",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("selection is defined against hidden task utility", () => {
  for (const expression of [
    "c_i \\sim q_\\theta",
    "s_i = V_\\phi",
    "\\hat c = \\arg\\max",
    "\\operatorname{Regret}",
  ]) {
    expect(chapter).toContain(expression);
  }
  expect(flat).toContain("maximizes the verifier, not task utility");
});

test("verifier evaluation covers errors, calibration, and distribution shift", () => {
  for (const phrase of [
    "false-accept rate",
    "false-reject rate",
    "calibration",
    "deployed generator",
    "difficulty, length, and domain",
    "selection regret",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the runnable reproduces proxy over-optimization", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("true_utility");
  expect(cell![1]).toContain("proxy_score");

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toContain("selection regret");
});

test("production guidance versions and audits the complete verification path", () => {
  for (const phrase of [
    "version the generator, verifier, prompt, rubric, and score extractor",
    "log every candidate",
    "hidden checks",
    "abstain or route",
    "matched total cost",
    "untrusted model output",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes the misleading ladder and unsupported shortcuts", () => {
  for (const phrase of [
    "## the verifier ladder",
    "the ladder is ordered by semantics",
    "the ladder also explains",
    "the bundle's weakest layer often sets the ceiling",
    "some errors are too subtle for a shallow classifier",
  ]) {
    expect(flat).not.toContain(phrase);
  }
});
