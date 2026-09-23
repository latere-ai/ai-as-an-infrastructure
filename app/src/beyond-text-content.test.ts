import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/05-beyond-text.qmd", import.meta.url),
  "utf8",
);

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
