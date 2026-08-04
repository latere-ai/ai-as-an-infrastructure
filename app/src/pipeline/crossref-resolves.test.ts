// Guard: every @sec-/@fig- cross-ref written in a content .qmd must resolve to a
// label that actually exists, in BOTH languages. An unresolved ref does not fail
// the build; it silently renders as the "?@sec-..." missing marker in the page
// (see resolveXrefsInText), so only a test like this catches a typo such as
// @sec-powering-it where the label is {#sec-powering-ai}.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Lang } from "../types.ts";
import { loadBook } from "./book.ts";
import { buildCrossref } from "./crossref.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

// Mirror the resolver's token shape (crossref.ts / inline-refs.ts): @sec-x or
// @fig-x, not preceded by an alphanumeric (so emails / citation keys don't fire).
const REF_RE = /(?:^|[^A-Za-z0-9])@((?:sec|fig)-[a-z0-9-]+)/g;

for (const lang of ["en", "zh"] as Lang[]) {
  test(`${lang}: all @sec/@fig cross-refs resolve`, () => {
    const book = loadBook(lang, repoRoot);
    const xref = buildCrossref(book);
    const broken: string[] = [];
    for (const ch of book.chapters) {
      const text = readFileSync(ch.qmdPath, "utf8");
      for (const m of text.matchAll(REF_RE)) {
        const key = m[1];
        if (!xref.has(key)) broken.push(`${ch.qmdPath}: @${key}`);
      }
    }
    expect(broken).toEqual([]);
  });
}
