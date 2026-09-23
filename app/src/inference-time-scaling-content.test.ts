import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/07-inference-time-scaling.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/inference-time-scaling.bib", import.meta.url),
  "utf8",
);

test("the chapter bibliography owns every citation in the chapter", () => {
  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThan(0);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the runnable demonstrates selector failure", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("selector_bias");

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const nonInteractiveCell = cell![1]
    .split("\n")
    .filter((line) => !line.startsWith("import matplotlib") && !line.startsWith("plt."))
    .join("\n");
  const run = Bun.spawnSync([python!, "-c", nonInteractiveCell], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, MPLBACKEND: "Agg" },
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toMatch(/best selector k: \d+/);
});
