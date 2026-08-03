import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/07-mid-training.qmd", import.meta.url),
  "utf8",
);

test("the mixture cell executes exact cumulative token accounting", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();

  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("whole-run specialist share: 6.0%");
  expect(stdout).toContain("specialist tokens: 6.0B");
  expect(stdout).toContain("broad tokens: 94.0B");
  expect(cell![1]).toContain("0.5 * final_share * (1 - start)");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("numpy");
});
