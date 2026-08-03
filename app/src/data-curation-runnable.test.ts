import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/02-data-curation.qmd", import.meta.url),
  "utf8",
);

test("the data-curation MinHash cell runs a shared-permutation estimator", () => {
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
  expect(stdout).toContain("m=  16  estimate=0.562  true=0.600");
  expect(stdout).toContain("m=1024  estimate=0.601  true=0.600");
  expect(cell![1]).toContain("rng.shuffle(order)");
  expect(cell![1]).not.toContain("a * s % universe");
});
