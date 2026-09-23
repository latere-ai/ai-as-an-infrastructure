import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/03-speech-and-voice.qmd", import.meta.url),
  "utf8",
);

test("the RVQ example is deterministic and accounts for indices and bits", () => {
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
    "depth=1 error=0.354 indices/s=50 bits/s=100",
    "depth=2 error=0.125 indices/s=100 bits/s=200",
    "depth=3 error=0.000 indices/s=150 bits/s=300",
  ]);
  expect(cell![1]).toContain("indices_per_second = frame_hz * depth");
  expect(cell![1]).toContain("bits_per_second = indices_per_second");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
});
