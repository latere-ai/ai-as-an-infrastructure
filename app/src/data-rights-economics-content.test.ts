import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);

const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/data-rights-economics.bib", import.meta.url),
  "utf8",
);

test("the net-benefit equation uses mobile-safe rows", () => {
  const equation = chapter.match(/NB_H\(D\)[\s\S]*?\\end\{aligned\}/)?.[0] ?? "";
  const rows = equation.split(/\\\\\s*\n/);
  expect(rows.length).toBeGreaterThanOrEqual(7);
  for (const row of rows) expect(row.replace(/\s+/g, " ").length).toBeLessThanOrEqual(52);
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
