import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/reasoning/04-verifiers-process-supervision.qmd", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

test("the runnable reproduces proxy over-optimization", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "N=1: selected='direct partial'; selection regret=0.00",
    "N=2: selected='careful correct'; selection regret=0.00",
    "N=3: selected='concise correct'; selection regret=0.00",
    "N=4: selected='polished wrong'; selection regret=0.75",
  ]);
});
