// Aggregate back-matter pages (glossary, references) collect their body from
// whole-book state (glossaryUsed, bib.cited) that fills only as chapters compile.
// compilePage must run a full in-order book pass for those pages; compiling the
// page alone leaves the slot empty (the bug the dev server hit, rendering nothing).

import { test, expect } from "bun:test";
import { join } from "node:path";
import { compileChapter, compilePage, fillSlot, type CompileContext } from "./compile.ts";
import { loadBook } from "./book.ts";
import { loadBibliographyDir } from "./citations.ts";
import { buildCrossref } from "./crossref.ts";
import { loadGraphviz } from "./diagrams.ts";
import { loadGlossary } from "./glossary.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const graphviz = await loadGraphviz();
const wholeBookTimeout = 90_000;

function ctxFor(): CompileContext {
  return {
    bib: loadBibliographyDir(join(repoRoot, "refs")),
    xref: buildCrossref(loadBook("en", repoRoot)),
    graphviz,
    refsDir: join(repoRoot, "refs"),
    glossary: loadGlossary(join(repoRoot, "glossary.yml")),
    glossaryUsed: new Set<string>(),
    glossaryFirstUses: new Map(),
  };
}

test("compilePage fills the glossary page from a whole-book pass", () => {
  const book = loadBook("en", repoRoot);
  const glossary = book.chapters.find((c) => c.href === "glossary")!;

  // Bug: compiling only the glossary chapter sees an empty glossaryUsed set, so
  // the ::: {#glossary} slot stays empty and nothing renders.
  const alone = compileChapter(book, glossary, ctxFor());
  expect(alone.contentHtml).not.toContain("rdr-gls-entry");

  // Fix: compilePage runs the in-order book pass first, so terms are collected.
  const page = compilePage(book, "glossary", ctxFor());
  expect(page).not.toBeNull();
  expect(page!.contentHtml).toContain('class="rdr-gls-list"');
  expect(page!.contentHtml).toContain("rdr-gls-entry");
}, wholeBookTimeout);

test("compilePage fills the references page from a whole-book pass", () => {
  const book = loadBook("en", repoRoot);
  const refs = book.chapters.find((c) => c.href === "references")!;

  const alone = compileChapter(book, refs, ctxFor());
  expect(alone.contentHtml).not.toContain('id="ref-');

  const page = compilePage(book, "references", ctxFor());
  expect(page).not.toBeNull();
  expect(page!.contentHtml).toContain('id="ref-');
}, wholeBookTimeout);

test("a '$'-bearing title survives slot filling (no replacement-pattern splicing)", () => {
  // Bug: the ::: {#refs} slot was filled with a string replacement, so "$6" in
  // a reference title was read as a regex
  // backreference, splicing the slot's own <div> into the title text.
  const html = '<div class="rdr-block" id="refs">old</div>';
  const filled = fillSlot(html, "refs", () => "A $60 million title and a $& URL");
  expect(filled).toContain("A $60 million title and a $& URL");
  // the slot wrapper must appear exactly once, not duplicated inside an entry
  expect(filled.match(/id="refs"/g)?.length ?? 0).toBe(1);
});

test("compilePage returns null for an unknown href", () => {
  const book = loadBook("en", repoRoot);
  expect(compilePage(book, "no-such-page", {} as CompileContext)).toBeNull();
});
