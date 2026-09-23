import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/generative/02-nar-diffusion-lms.qmd", import.meta.url),
  "utf8",
);

test("the block-diffusion runnable executes its accounting", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("自回归：依赖评估=128，位置预测=128");
  expect(stdout).toContain("完整掩码：依赖评估=8，位置预测=1024");
  expect(stdout).toContain("块扩散：依赖评估=64，位置预测=1024");
  expect(cell![1]).toContain("ceil(length / block_size) * rounds");
  expect(cell![1]).not.toContain("numpy");
});
