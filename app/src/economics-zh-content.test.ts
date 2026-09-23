import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);

const chinese = readFileSync(
  new URL("../../zh/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);

test("the runnable is identical to English and exposes four reversals", () => {
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
    "base: buy=$3.20M self=$3.05M -> self-host\n" +
      "api-price-down: buy=$2.08M self=$3.05M -> API\n" +
      "demand-down: buy=$1.60M self=$2.85M -> API\n" +
      "peak-capacity-up: buy=$3.20M self=$3.65M -> API\n",
  );
});
