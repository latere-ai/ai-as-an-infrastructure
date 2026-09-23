import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/safety/02-scalable-oversight-control.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/scalable-oversight-control.bib", import.meta.url),
  "utf8",
);

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliography).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});
