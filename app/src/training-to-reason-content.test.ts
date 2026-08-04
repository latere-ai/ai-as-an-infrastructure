import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/05-training-to-reason.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/training-to-reason.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter remains plain UTF-8 text with local citation ownership", () => {
  expect(chapter).not.toContain("\0");

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThan(10);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
  expect(bibliography).toMatch(/@misc\{deepmind2025imogold,[\s\S]*?further\s*=\s*\{no\}/);
});

test("RLVR begins with a scoped reward contract", () => {
  for (const phrase of [
    "an independently computed rule",
    "prompt paired with an executable acceptance rule",
    "specification gap",
    "implementation gap",
    "coverage gap",
    "only for the criterion it actually implements",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("group-relative learning defines the signal and the policy update", () => {
  for (const expression of [
    "y_i \\sim \\pi_{\\mathrm{old}}",
    "A_i = \\frac{r_i-\\bar r}{s_r+\\varepsilon}",
    "\\rho_{i,t}(\\theta)",
    "J_{\\mathrm{GRPO}}(\\theta)",
    "P(\\text{mixed group}) = 1-p^G-(1-p)^G",
  ]) {
    expect(chapter).toContain(expression);
  }
  expect(flat).toContain("all tokens in an outcome-scored response share this one advantage");
  expect(flat).toContain("the kl term limits accumulated drift");
});

test("the runnable reproduces group advantages and sparse signal", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("mixed_group_probability");

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toContain("all equal: [0.0, 0.0, 0.0, 0.0]");
  expect(run.stdout.toString()).toContain("p=0.50, mixed group=0.992");
});

test("interactive figures retain their runtime contracts and synthetic labels", () => {
  expect(chapter).toContain('data-viz="grpo-advantage"');
  expect(chapter).toContain('data-viz="rlvr-boundary"');
  expect(flat).toContain("this is an illustration, not measured training data");
  expect(flat).toContain("all curves are synthetic");
});

test("reward source is separated from optimizer choice", () => {
  for (const phrase of [
    "rlvr describes where the reward comes from",
    "treats each whole response as one sampled action",
    "does not use ppo's clipped token ratios",
    "the verifier reward remains absolute",
    "the advantage used for the update does not",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("R1-Zero evidence is separated from the released R1 pipeline", () => {
  for (const phrase of [
    "rl can work without a preceding sft stage or step-level labels",
    "the cold start was therefore more than cosmetic",
    "the final model was not the result of pure rlvr",
    "rejection sampling",
    "a second rl stage",
    "cannot be attributed to one stage alone",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the capability debate states measurement conditions", () => {
  for (const phrase of [
    "two useful meanings of \"new capability\"",
    "neither finite experiment proves what has zero probability",
    "prompt template, temperature, token budget, answer extractor, and base checkpoint",
    "model family, training recipe, benchmark, sampling policy, and definition of success",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("optimizer refinements retain their distinct mechanisms", () => {
  for (const phrase of [
    "fixed normalization shared across the batch",
    "raised the upper clipping range separately",
    "resampled until batches contained prompts with mixed outcomes",
    "softened penalties near the maximum response length",
    "length-normalized sequence ratio",
    "those mechanisms do different jobs",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the operating guidance uses held-out evidence and matched baselines", () => {
  for (const phrase of [
    "training prompt pool",
    "held-out task set",
    "adversarial verifier set",
    "verifier false accepts and false rejects",
    "useful updates per accelerator-hour",
    "compare against cheaper uses of the same compute",
    "match total generated tokens, verification cost, and inference budget",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes the unsupported shortcuts", () => {
  for (const phrase of [
    "it beats a reward model because it removes the learned proxy gap",
    "the optimizer is the ppo machinery of @sec-rlhf reused without change",
    "the cold start is a cosmetic and stabilizing prefix",
    "with a verifier there is no learned proxy to drift into",
    "grpo shipped the reasoning models",
  ]) {
    expect(flat).not.toContain(phrase);
  }
});
