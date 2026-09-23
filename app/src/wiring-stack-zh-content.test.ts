import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/08-wiring-a-2026-stack.qmd", import.meta.url),
  "utf8",
);

test("the crossover example is dependency free and executes", () => {
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("crossover_utilization"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|matplotlib/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("illustrative crossover = 50%");
});
