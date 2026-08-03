import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/05-moe-ssm-hybrids.qmd", import.meta.url),
  "utf8",
);

test("the MoE cell accounts for SwiGLU experts and every router score", () => {
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
  expect(stdout).toContain(
    "E= 8, k=2: stored=1.409B, evaluated/token=0.352B, ratio=4.00x",
  );
  expect(stdout).toContain(
    "E=32, k=2: stored=5.637B, evaluated/token=0.352B, ratio=15.99x",
  );
  expect(stdout).toContain(
    "E=64, k=2: stored=11.275B, evaluated/token=0.353B, ratio=31.98x",
  );
  expect(cell![1]).toContain("per_expert = 3 * model_width * expert_width");
  expect(cell![1]).toContain("router = experts * model_width");
  expect(cell![1]).toContain("1 <= selected_experts <= experts");
});
