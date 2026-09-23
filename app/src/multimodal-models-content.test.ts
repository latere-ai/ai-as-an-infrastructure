import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/04-multimodal-models.qmd", import.meta.url),
  "utf8",
);

test("video token example reproduces Movie Gen context arithmetic", () => {
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
    "raw spacetime positions: 150,994,944",
    "latent positions:        294,912",
    "transformer tokens:      73,728",
    "position reduction:      2,048x",
  ]);
  expect(cell![1]).toContain("compression = (8, 8, 8)");
  expect(cell![1]).toContain("patch = (1, 2, 2)");
  expect(cell![1]).toContain("raw_positions = frames * height * width");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("random");
});
