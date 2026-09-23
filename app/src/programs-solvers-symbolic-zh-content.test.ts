import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/reasoning/03-programs-solvers-symbolic.qmd", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

test("the task-agreement runnable executes both artifacts and rejects the wrong translation", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "wrong but runnable: executes to 8; contract rejects: fraction mismatch",
    "correct artifact: executes to 12; contract accepts",
  ]);
});
