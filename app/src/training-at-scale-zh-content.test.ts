import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const zh = readFileSync(
  new URL("../../zh/foundations/06-training-at-scale.qmd", import.meta.url),
  "utf8",
);

test("the Chinese pipeline runnable executes without plotting dependencies", () => {
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
  expect(stdout).toContain("p=32, m=32: 49.2%");
});

test("the parallel-axis graph isolates collective names from CJK fallback text", () => {
  const block = zh.match(
    /```\{dot\}\n\/\/\| label: fig-training-axes[\s\S]*?```/,
  )?.[0];
  expect(block).toBeDefined();

  const labels = [...block!.matchAll(/label="([^"]+)"/g)].map((match) =>
    match[1].split(String.raw`\n`),
  );
  const collectiveLines = labels
    .flat()
    .filter((line) => /(?:all-|reduce-)/.test(line));
  expect(collectiveLines.length).toBeGreaterThan(0);
  for (const line of collectiveLines) {
    expect(line).not.toMatch(/[\u3400-\u9fff]/);
    expect(line.length).toBeLessThanOrEqual(16);
  }
});
