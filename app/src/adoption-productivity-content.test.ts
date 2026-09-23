import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);

const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/adoption-productivity.bib", import.meta.url),
  "utf8",
);

const vizRuntime = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");

test("the ROI explorer does not add raw time and quality percentages", () => {
  expect(vizRuntime).not.toContain("base * (time / 100 + quality / 100)");
  expect(vizRuntime).not.toContain("time: 'time saved (%)'");
});

test("the ROI explorer keeps row labels outside its diverging bars", () => {
  expect(vizRuntime).not.toContain("fillText(r.label, zero");
  for (const marker of ["var rowH = 42", "var barY = y + 18", "ctx.textAlign = 'left'", "ctx.textAlign = 'right'"])
    expect(vizRuntime).toContain(marker);
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
