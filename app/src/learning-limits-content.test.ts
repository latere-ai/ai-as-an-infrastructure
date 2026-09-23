import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);

const chineseChapter = readFileSync(
  new URL("../../zh/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/where-learning-hits-limits.bib", import.meta.url),
  "utf8",
);

test("the worked data forecast is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("2.4x/year crossing: 2027.75");
  expect(run.stdout.toString()).toContain("1.8x/year crossing: 2029.59");
});

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

test("the chapter bibliography owns every citation in the Chinese chapter", () => {
  const citeKeys = new Set(
    [...chineseChapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/gi)].map(
      (match) => match[1],
    ),
  );
  for (const key of citeKeys) {
    expect(bibliography, `${key} should remain available to the Chinese chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});
