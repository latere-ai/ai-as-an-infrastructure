// Further reading renders a one-sentence TL;DR ("what this paper is about")
// under each entry, language-picked with a zh→en fallback, sourced from the
// tldr / tldr-zh bib fields.

import { test, expect } from "bun:test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderFurtherReading } from "./further-reading.ts";
import type { CrossrefMap } from "./crossref.ts";
import type { Bibliography } from "./citations.ts";

const xref: CrossrefMap = new Map();

function refsDirWith(slug: string, bib: string): string {
  const dir = mkdtempSync(join(tmpdir(), "fr-"));
  writeFileSync(join(dir, `${slug}.bib`), bib);
  return dir;
}

test("renders the tldr sentence under a paper entry", () => {
  const dir = refsDirWith("ch", `@article{kaplan2020,
  author = {Kaplan, Jared},
  title  = {Scaling Laws for Neural Language Models},
  year   = {2020},
  tldr   = {Establishes that loss follows a smooth power law in compute.},
}\n`);
  const html = renderFurtherReading(dir, "ch", "en", xref, "foundations/scaling", "../");
  expect(html).toContain('<div class="rdr-fr-tldr">Establishes that loss follows a smooth power law in compute.</div>');
});

test("zh falls back to the en tldr until translated", () => {
  const dir = refsDirWith("ch", `@article{a2020,
  author = {Author, A},
  title  = {T},
  year   = {2020},
  tldr   = {English summary only.},
}\n`);
  expect(renderFurtherReading(dir, "ch", "zh", xref, "x", "")).toContain("English summary only.");
});

test("zh uses the merged translation overlay before falling back to English", () => {
  const dir = refsDirWith("ch", `@article{a2020,
  author = {Author, A},
  title  = {T},
  year   = {2020},
  tldr   = {English summary only.},
}\n`);
  const summaries = {
    entries: new Map([["a2020", { tldrZh: "中文摘要。" }]]),
    cited: new Set(),
  } as unknown as Bibliography;

  const html = renderFurtherReading(dir, "ch", "zh", xref, "x", "", summaries);
  expect(html).toContain("中文摘要。");
  expect(html).not.toContain("English summary only.");
});

test("an entry without a tldr renders no tldr block", () => {
  const dir = refsDirWith("ch", `@article{a2020, author = {Author, A}, title = {T}, year = {2020}}\n`);
  expect(renderFurtherReading(dir, "ch", "en", xref, "x", "")).not.toContain("rdr-fr-tldr");
});
