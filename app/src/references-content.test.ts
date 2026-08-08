import { expect, test } from "bun:test";
import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBook } from "./pipeline/book.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { compilePage, type CompileContext } from "./pipeline/compile.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";

const repoRoot = join(import.meta.dir, "../..");
const source = readFileSync(join(repoRoot, "en/references.qmd"), "utf8");
const summaryOverlay = readFileSync(join(repoRoot, "refs/00-references-summaries.bib"), "utf8");
const graphviz = await loadGraphviz();
const wholeBookTimeout = 90_000;

test("the English References page explains its order, labels, notes, and links", () => {
  const prose = source.replace(/\s+/g, " ");
  expect(prose).toContain("ordered by the first author's surname and then by year");
  expect(prose).toContain("the citation label used in the chapters");
  expect(prose).toContain("a short note explaining what the source contributes");
  expect(prose).toContain("Select a citation in any chapter to jump to its entry here.");
});

test("the References summary overlay contains prose only", () => {
  const overlay = parseBib(summaryOverlay, { errorHandler: () => {} });
  expect(overlay.entries.length).toBeGreaterThan(100);

  for (const entry of overlay.entries) {
    const fields = entry.fields as Record<string, unknown>;
    expect(Object.keys(fields), entry.key).toEqual(["tldr"]);
    expect(String(fields.tldr), entry.key).toEndWith(".");
    expect(String(fields.tldr), entry.key).not.toContain("—");
  }
});

test("every source cited in the English book has a reader-facing summary", () => {
  const book = loadBook("en", repoRoot);
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
  const overlay = parseBib(summaryOverlay, { errorHandler: () => {} });
  const missingCanonicalMetadata = overlay.entries
    .filter((entry: { key: string }) => {
      const canonical = bib.entries.get(entry.key);
      return !canonical?.authors.length || !canonical.title.trim();
    })
    .map((entry: { key: string }) => entry.key)
    .sort();
  expect(missingCanonicalMetadata).toEqual([]);

  const ctx: CompileContext = {
    bib,
    xref: buildCrossref(book),
    graphviz,
    refsDir: join(repoRoot, "refs"),
    glossary: loadGlossary(join(repoRoot, "glossary.yml")),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };

  const page = compilePage(book, "references", ctx);
  expect(page).not.toBeNull();
  expect(bib.cited.size).toBeGreaterThan(1_000);

  const html = page!.contentHtml;
  const sourceUrls = [...html.matchAll(/<a href="([^"]+)" rel="noopener">/g)]
    .map((match) => match[1].replace(/\/+$/, ""));
  expect(new Set(sourceUrls).size).toBe(sourceUrls.length);

  const missingFragments = [...bib.cited]
    .filter((key) => !html.includes(`id="ref-${key}"`))
    .sort();
  expect(missingFragments).toEqual([]);

  const missing = [...bib.cited]
    .filter((key) => !bib.entries.get(key)?.tldr?.trim())
    .sort();
  expect(missing).toEqual([]);
}, wholeBookTimeout);
