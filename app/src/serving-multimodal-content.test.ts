import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/06-serving-multimodal.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/serving-multimodal.bib", import.meta.url),
  "utf8",
);

test("the chapter bibliography owns every citation in the chapter", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(keys.size).toBeGreaterThan(0);
  for (const key of keys) {
    expect(bibliography, `${key} should be owned by this chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the visual-token runnable reproduces fixed-grid and GQA cache arithmetic", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  expect(cells.length).toBe(2);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[0][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "336x336:  576 visual tokens,  72.0 MiB KV",
    "672x672: 2304 visual tokens, 288.0 MiB KV",
  ]);
  expect(cells[0][1]).toContain("n_kv_heads=8");
  expect(cells[0][1]).toContain("head_dim=128");
  expect(cells[0][1]).not.toContain("hidden // gqa");
});

test("the generative-media runnable reproduces the work proxy", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[1][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "latent tokens: 4096",
    "50-step proxy: 409600 token-passes",
    " 4-step proxy: 32768 token-passes",
    "denoiser-only ratio: 12.5x",
  ]);
});
