import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);

const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/market-structure.bib", import.meta.url),
  "utf8",
);

test("the runnable demonstrates market-definition sensitivity without dependencies", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  expect(cells.length).toBe(1);
  expect(cells[0][1]).not.toMatch(/numpy|torch|requests|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[0][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "narrow: suppliers=4 hhi=3250 effective-firms=3.08\n" +
      "broader: suppliers=5 hhi=2250 effective-firms=4.44\n" +
      "equal-five: suppliers=5 hhi=2000 effective-firms=5.00\n",
  );
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
    [...chineseChapter.matchAll(/@([a-z][a-z0-9]*)/gi)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  for (const key of citeKeys) {
    expect(bibliography, `${key} should remain available to the Chinese chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});
