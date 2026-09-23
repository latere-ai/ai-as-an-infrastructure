import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/safety/08-law-regulation-policy.qmd", import.meta.url),
  "utf8",
);

const bibliographyCorpus = readdirSync(new URL("../../refs/", import.meta.url))
  .filter((name) => name.endsWith(".bib"))
  .map((name) => readFileSync(new URL(`../../refs/${name}`, import.meta.url), "utf8"))
  .join("\n");

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliographyCorpus).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});
