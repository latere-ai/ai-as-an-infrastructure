import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/02-nar-diffusion-lms.qmd", import.meta.url),
  "utf8",
);

test("the decode accounting distinguishes dependency depth from position work", () => {
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
  expect(stdout).toMatch(/autoregressive\s+dependent=128, positions=\s*128/);
  expect(stdout).toMatch(/full masked\s+dependent=\s*8, positions=1024/);
  expect(stdout).toMatch(/block diffusion\s+dependent=\s*64, positions=1024/);
  expect(cell![1]).toContain("ceil(length / block_size) * rounds");
  expect(cell![1]).toContain('"position_predictions": length * rounds');
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("matplotlib");
});
