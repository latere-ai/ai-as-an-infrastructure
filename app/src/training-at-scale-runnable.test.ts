import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/06-training-at-scale.qmd", import.meta.url),
  "utf8",
);

test("the pipeline cell executes the scoped GPipe bubble calculation", () => {
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
  expect(stdout).toContain("p=32, m=32: 49.2%");
  expect(cell![1]).toContain("(stages - 1) / (microbatches + stages - 1)");
  expect(cell![1]).toContain("communication is ignored");
  expect(cell![1]).not.toContain("matplotlib");
  expect(cell![1]).not.toContain("numpy");
});

test("the attention figure counts named tensors in bytes", () => {
  const figure = readFileSync(
    new URL("../../figures-src/training-at-scale-2.py", import.meta.url),
    "utf8",
  );

  expect(figure).toContain("batch * heads * L**2 * bytes_per_element / gib");
  expect(figure).toContain("batch * L * hidden * bytes_per_element / gib");
  expect(figure).toContain("token-state tensor");
  expect(figure).not.toContain("arbitrary units");
});

test("the precision inspector includes FP4 without overclaiming BF16", () => {
  const runtime = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");

  expect(runtime).toContain("{ n: 'fp4 E2M1', e: 2, m: 1 }");
  expect(runtime).toContain("usually avoids FP16 loss scaling");
  expect(runtime).not.toContain("it never needed fp16's loss scaling");
});
