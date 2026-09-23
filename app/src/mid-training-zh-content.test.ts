import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/foundations/07-mid-training.qmd", import.meta.url),
  "utf8",
);

test("the Chinese mixture runnable executes exact token accounting", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
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
  expect(stdout).toContain("全程专门数据占比：6.0%");
  expect(stdout).toContain("专门数据词元：6.0B");
  expect(stdout).toContain("宽泛数据词元：94.0B");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("numpy");
});
