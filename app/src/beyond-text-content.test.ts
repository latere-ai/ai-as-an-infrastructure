import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/05-beyond-text.qmd", import.meta.url),
  "utf8",
);

test("beyond-text chapter separates observation prediction from embodied control", () => {
  const flat = chapter.replace(/\s+/g, " ");
  const required = [
    "Predicting plausible observations is not the same as predicting what changes under an action",
    "Give a world model an action interface",
    "Visual realism is not an intervention test",
    "A shared backbone is not yet a world model",
    "There is no sound conversion from language tokens to robot trajectories",
    "Offline action prediction is a development metric, not a deployment result",
    "The useful flywheel is therefore not “generate unlimited robot data.”",
    "rankdir=TB;",
    "Lower-layer constraint",
  ];
  for (const phrase of required) expect(flat).toContain(phrase);

  const rejected = [
    "Text has a data wall",
    "The early evidence leans toward the latter",
    "carried more by free data",
    "Constraint arrow",
    "the field has split into three",
    "three architectural answers",
    "render anyway",
    "abandon pixels",
    "geometry is the model",
    "A flagship video app",
    "became mainstream",
    "displacing the adapter-bridged stack",
    "quality cliff",
    "Robotics has no internet",
    "one two-hundred-thousandth",
    "Four ways to manufacture a flywheel",
    "Nobody can grade it yet",
    "evidence favors the skeptics",
    "the same wall stands",
    "The final chapter turns",
    "rankdir=LR;",
  ];
  for (const phrase of rejected) expect(chapter).not.toContain(phrase);
});

test("control-loop example distinguishes commands, model calls, and predictions", () => {
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
    "executed control ticks: 500",
    "large-model calls:      125",
    "predicted positions:    2000",
    "model-call reduction:   4.0x",
  ]);
  expect(cell![1]).toContain("control_ticks = ceil(duration_s * control_hz)");
  expect(cell![1]).toContain("model_calls = ceil(control_ticks / replan_every)");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("random");
});
