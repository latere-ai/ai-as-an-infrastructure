import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/reasoning/01-eliciting-reasoning.qmd", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

test("the self-consistency runnable executes deterministically without external packages", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = result.stdout.toString().trim().split("\n");

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(output).toHaveLength(3);
  expect(output[0]).toStartWith("rho=0.00: 0.550, ");
  expect(output[1]).toStartWith("rho=0.25: 0.550, ");
  expect(output[2]).toStartWith("rho=0.75: 0.550, ");
});
