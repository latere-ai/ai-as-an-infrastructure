import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "../..");
const glossarySource = readFileSync(join(repoRoot, "en/glossary.qmd"), "utf8");
const glossary = parse(readFileSync(join(repoRoot, "glossary.yml"), "utf8")) as Record<
  string,
  { def?: { en?: string } }
>;

test("the English glossary tells readers how to use the generated entries", () => {
  const prose = glossarySource.replace(/\s+/g, " ");
  expect(prose).toContain("its Chinese translation, a concise definition, and a link to its first appearance");
  expect(prose).toContain("Each entry is also linked from its first use in every chapter.");
});

test("English glossary definitions are direct sentences rather than compressed notes", () => {
  const definitions = Object.entries(glossary).map(([key, entry]) => [key, entry.def?.en ?? ""] as const);

  expect(definitions.length).toBeGreaterThan(150);
  expect(definitions.filter(([, definition]) => !definition)).toEqual([]);
  expect(definitions.filter(([, definition]) => definition.includes(";"))).toEqual([]);

  const fragmentOpening = /^(?!(?:Operating expenses)\b)(?:[A-Z][a-z]+ing|PyTorch's implementation|Stacked DRAM|Up-front spending|Recurring costs|LoRA applied|RLHF where|Data excluded|Models trained|Fast memory|Dense memory|Hardware errors that)\b/;
  expect(definitions.filter(([, definition]) => fragmentOpening.test(definition))).toEqual([]);

  const directOpening = /^(?:A|An|The|Capital expenses|Operating expenses|SRAM|DRAM|Silent data corruption|Sleeper agents)\b/;
  expect(definitions.filter(([, definition]) => !directOpening.test(definition))).toEqual([]);

  const editorialClaim = /\b(the (central|default|dominant|foundational|hardest|strong|workhorse|headline)|staple|basis of|arms race|machine-produced|and the like)\b/i;
  expect(definitions.filter(([, definition]) => editorialClaim.test(definition))).toEqual([]);
});
