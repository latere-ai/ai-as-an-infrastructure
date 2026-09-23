import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/practice/06-retrieval-and-documents.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/retrieval-and-documents.bib", import.meta.url),
  "utf8",
);

test("the authorization predicate is split into mobile-safe rows", () => {
  const equation = [...chapter.matchAll(/\$\$\n([\s\S]*?)\n\$\$/g)]
    .map((match) => match[1])
    .find((body) => body.includes("U(q,s,t,g)"));
  expect(equation).toBeDefined();
  expect(equation).toContain("\\begin{gathered}");
  expect(equation!.match(/\\\\/g)?.length).toBeGreaterThanOrEqual(4);
});

test("the chapter bibliography owns every citation in the chapter", () => {
  const citeKeys = new Set(
    [...chapter.matchAll(/(?<![A-Za-z0-9])@([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  expect(citeKeys.size).toBeGreaterThan(0);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});
