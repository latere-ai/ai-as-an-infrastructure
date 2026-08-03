import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/03-speech-and-voice.qmd", import.meta.url),
  "utf8",
);

test("speech chapter separates alignment, token accounting, and duplex behavior", () => {
  const flat = chapter.replace(/\s+/g, " ");
  const required = [
    "Streaming changes what counts as correct",
    "p_{\\mathrm{CTC}}",
    "RNN-T by itself does not guarantee streaming",
    "Conformer is an encoder architecture, not an alignment objective",
    "Self-supervision and weak supervision solve different data problems",
    "R_{\\mathrm{idx}}=fQ",
    "Token rate is not bitrate",
    "Semantic” and “acoustic” are roles, not a clean partition",
    "proactive rather than a universal detector",
    "Full duplex is a systems contract",
    "Human conversation is not a 200 ms service-level objective",
    "rankdir=TB;",
  ];
  for (const phrase of required) expect(flat).toContain(phrase);

  const rejected = [
    "only a few hundred milliseconds before the reply feels late",
    "the field's three answers",
    "became the standard",
    "The frontier folds",
    "reached reported human parity",
    "first commercial instance",
    "forces streaming",
    "rankdir=LR;",
  ];
  for (const phrase of rejected) expect(chapter).not.toContain(phrase);
});

test("the RVQ example is deterministic and accounts for indices and bits", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();

  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "depth=1 error=0.354 indices/s=50 bits/s=100",
    "depth=2 error=0.125 indices/s=100 bits/s=200",
    "depth=3 error=0.000 indices/s=150 bits/s=300",
  ]);
  expect(cell![1]).toContain("indices_per_second = frame_hz * depth");
  expect(cell![1]).toContain("bits_per_second = indices_per_second");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});
