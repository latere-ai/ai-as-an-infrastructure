import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/11-human-interface-oversight.qmd", import.meta.url),
  "utf8",
);

const english = readFileSync(
  new URL("../../en/practice/11-human-interface-oversight.qmd", import.meta.url),
  "utf8",
);

test("the policy-driven runnable matches English and executes", () => {
  const chineseCode = chinese.match(/```python\n([\s\S]*?)\n```/)?.[1];
  const englishCode = english.match(/```python\n([\s\S]*?)\n```/)?.[1];
  expect(chineseCode).toBeDefined();
  expect(chineseCode).toBe(englishCode);
  expect(chineseCode).not.toMatch(/numpy|risk\s*>=\s*0\.|confidence\s*<\s*0\./i);
  const run = Bun.spawnSync(["python3", "-c", chineseCode!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("approval binding verified");
});
