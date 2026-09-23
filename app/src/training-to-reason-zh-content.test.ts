import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/reasoning/05-training-to-reason.qmd", import.meta.url),
  "utf8",
);

const chapter = readFileSync(
  new URL("../../zh/reasoning/05-training-to-reason.qmd", import.meta.url),
  "utf8",
);

test("the runnable reproduces advantages and mixed-group probability", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", zhCell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toBe(
    "GRPO: [1.0, -1.0, 1.0, -1.0]\n" +
      "RLOO: [0.67, -0.67, 0.67, -0.67]\n" +
      "all equal: [0.0, 0.0, 0.0, 0.0]\n" +
      "p=0.01, mixed group=0.077\n" +
      "p=0.10, mixed group=0.570\n" +
      "p=0.50, mixed group=0.992\n",
  );
});
