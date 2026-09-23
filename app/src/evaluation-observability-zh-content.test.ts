import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/07-evaluation-and-observability.qmd", import.meta.url),
  "utf8",
);

test("judge agreement remains runnable without third-party packages", () => {
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("cohen_kappa"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|sklearn/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("agreement=0.89, kappa=0.53");
});
