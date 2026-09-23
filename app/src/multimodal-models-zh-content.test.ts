import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/generative/04-multimodal-models.qmd", import.meta.url),
  "utf8",
);

test("the video-token runnable reproduces the English Movie Gen example", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "原始时空位置：150,994,944",
    "潜空间位置：294,912",
    "Transformer 词元：73,728",
    "位置数缩减：2,048 倍",
  ]);
  expect(cell![1]).toContain("compression = (8, 8, 8)");
  expect(cell![1]).toContain("patch = (1, 2, 2)");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});
