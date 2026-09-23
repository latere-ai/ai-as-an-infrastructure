import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/01-sft-peft.qmd", import.meta.url),
  "utf8",
);

test("LoRA runnable reports exact per-matrix parameter counts", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();

  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "base matrix parameters: 16,777,216",
    "rank  4:  32,768 parameters ( 0.195%)",
    "rank  8:  65,536 parameters ( 0.391%)",
    "rank 16: 131,072 parameters ( 0.781%)",
    "rank 32: 262,144 parameters ( 1.562%)",
    "rank 64: 524,288 parameters ( 3.125%)",
  ]);
  expect(cell![1]).toContain("adapter = rank * (d_in + d_out)");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("random");
});
