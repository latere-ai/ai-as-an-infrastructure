import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/01-diffusion-flow-matching.qmd", import.meta.url),
  "utf8",
);

test("the analytic Gaussian reverse process recovers its data distribution", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();

  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("terminal signal fraction: 0.000040");
  expect(stdout).toContain("target mean=3.00, variance=1.00");
  expect(stdout).toContain("recovered mean=2.98, variance=1.01");
  expect(cell![1]).toContain("gain = np.sqrt(alpha[t]) * previous_variance / current_variance");
  expect(cell![1]).toContain("reverse_variance = previous_variance - gain**2 * current_variance");
  expect(cell![1]).toContain("x = reverse_mean + np.sqrt(max(reverse_variance, 0.0))");
  expect(cell![1]).not.toContain("if t > 0:\n        x = reverse_mean");
  expect(cell![1]).not.toContain("matplotlib");
});
