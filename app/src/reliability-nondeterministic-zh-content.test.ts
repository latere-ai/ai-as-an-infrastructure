import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/10-reliability-nondeterministic.qmd", import.meta.url),
  "utf8",
);

test("the task-reliability runnable executes without third-party packages", () => {
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("iid_task_success"));
  expect(code).toBeDefined();
  expect(code).toContain("import math");
  expect(code).toContain("assert");
  expect(code).not.toMatch(/numpy|matplotlib/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("n= 50: 0.6050");
});
