import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/13-operating-contracts.qmd", import.meta.url),
  "utf8",
);

const english = readFileSync(
  new URL("../../en/practice/13-operating-contracts.qmd", import.meta.url),
  "utf8",
);

test("the runtime ledger matches English and executes idempotently", () => {
  const chineseCode = chinese.match(/```python\n([\s\S]*?)\n```/)?.[1];
  const englishCode = english.match(/```python\n([\s\S]*?)\n```/)?.[1];
  expect(chineseCode).toBeDefined();
  expect(chineseCode).toBe(englishCode);
  expect(chineseCode).not.toMatch(/numpy|pandas|requests/);
  const run = Bun.spawnSync(["python3", "-c", chineseCode!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stdout)).toContain("spent=25 available=75");
});
