import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/generative/05-beyond-text.qmd", import.meta.url),
  "utf8",
);

test("control accounting runnable executes deterministically", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "实际执行的控制步数：500",
    "大模型调用次数：125",
    "预测动作位置数：2,000",
    "模型调用缩减倍数：4.0",
  ]);
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});
