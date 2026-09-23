import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);

const chinese = readFileSync(
  new URL("../../zh/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);

test("the HHI runnable is identical to English and produces the expected sensitivity", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(enCell).not.toBeNull();
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", zhCell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "narrow: suppliers=4 hhi=3250 effective-firms=3.08\n" +
      "broader: suppliers=5 hhi=2250 effective-firms=4.44\n" +
      "equal-five: suppliers=5 hhi=2000 effective-firms=5.00\n",
  );
});
