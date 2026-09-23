import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../zh/reasoning/07-inference-time-scaling.qmd", import.meta.url),
  "utf8",
);

test("the runnable demonstrates selector failure", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("selector_bias");

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const nonInteractiveCell = cell![1]
    .split("\n")
    .filter((line) => !line.startsWith("import matplotlib") && !line.startsWith("plt."))
    .join("\n");
  const run = Bun.spawnSync([python!, "-c", nonInteractiveCell], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, MPLBACKEND: "Agg" },
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toMatch(/选择器的最佳 k: \d+/);
});
