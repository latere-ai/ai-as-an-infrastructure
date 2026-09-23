import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/generative/01-diffusion-flow-matching.qmd", import.meta.url),
  "utf8",
);

test("the Chinese analytic reverse runnable recovers the target distribution", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("终点信号比例：0.000040");
  expect(stdout).toContain("目标均值=3.00，方差=1.00");
  expect(stdout).toContain("恢复均值=2.98，方差=1.01");
  expect(cell![1]).toContain("reverse_variance = previous_variance - gain**2 * current_variance");
  expect(cell![1]).not.toContain("matplotlib");
});
