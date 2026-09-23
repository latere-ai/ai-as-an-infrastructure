import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/generative/04-multimodal-models.qmd", import.meta.url),
  "utf8",
);

test("multimodal chapter separates interfaces, representations, and objectives", () => {
  const flat = chapter.replace(/\s+/g, " ");
  const required = [
    "Multimodality is a problem of interfaces between modalities",
    "Neither objective requires image and text embeddings to share one distribution",
    "Visual token count is a serving decision, since it sets both prefill work and cache size",
    "Guidance scale is not a confidence score",
    "A latent is not automatically a token",
    "Compression determines representation cost",
    "Modularity and representation are separate decisions",
    "A unified model can still use different losses",
    "Benchmark the boundary that ships",
    "rankdir=TB;",
    "Lower-layer constraint",
  ];
  for (const phrase of required) expect(flat).toContain(phrase);

  const rejected = [
    "The previous chapters separated the engines",
    "continuous representation fight",
    "dominant open-weights",
    "widely written off",
    "system-level settling",
    "The 2025 systems moved",
    "The deepest open question",
    "The commercial instance",
    "by 2026 frontier models",
    "the same lab ran both",
    "Constraint arrow",
    "rankdir=LR;",
  ];
  for (const phrase of rejected) expect(chapter).not.toContain(phrase);
});

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
