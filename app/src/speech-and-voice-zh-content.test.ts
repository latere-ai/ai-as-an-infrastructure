import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/generative/03-speech-and-voice.qmd", import.meta.url),
  "utf8",
);

test("the localized RVQ example is deterministic and accounts for indices and bits", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "深度=1 误差=0.354 索引/秒=50 比特/秒=100",
    "深度=2 误差=0.125 索引/秒=100 比特/秒=200",
    "深度=3 误差=0.000 索引/秒=150 比特/秒=300",
  ]);
  expect(cell![1]).toContain("indices_per_second = frame_hz * depth");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});
