import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/adaptation/01-sft-peft.qmd", import.meta.url),
  "utf8",
);

const vizRuntime = readFileSync(
  new URL("./runtime/viz.ts", import.meta.url),
  "utf8",
);

test("the localized LoRA runnable is exact and dependency-free", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
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
    "基座矩阵参数量：16,777,216",
    "秩  4： 32,768 个参数（ 0.195%）",
    "秩  8： 65,536 个参数（ 0.391%）",
    "秩 16：131,072 个参数（ 0.781%）",
    "秩 32：262,144 个参数（ 1.562%）",
    "秩 64：524,288 个参数（ 3.125%）",
  ]);
  expect(cell![1]).toContain("adapter = rank * (d_in + d_out)");
  expect(cell![1]).not.toMatch(/numpy|matplotlib|random/);
});

test("task arithmetic keeps geometry separate from localized labels", () => {
  const component = vizRuntime.slice(
    vizRuntime.indexOf("R['task-arithmetic']"),
    vizRuntime.indexOf("R['grpo-advantage']"),
  );
  expect(component).toContain("vectorLength = Math.min(W, H) * 0.3");
  expect(component).toContain("/ vectorLength");
});
