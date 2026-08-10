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
const source = readFileSync(join(repoRoot, "zh/references.qmd"), "utf8");
const summaryOverlay = readFileSync(join(repoRoot, "refs/00-references-summaries-zh.bib"), "utf8");
const graphviz = await loadGraphviz();
const wholeBookTimeout = 240_000;

test("the Chinese References page explains its order, labels, notes, and links", () => {
  const prose = source.replace(/\s+/g, " ");
  expect(prose).toContain("先按第一作者的姓氏排序，再按出版年份排序");
  expect(prose).toContain("正文中使用的引用标记");
  expect(prose).toContain("说明该资料为本书提供了什么");
  expect(prose).toContain("点击正文中的引用标记，即可跳转到这里的对应条目");
});

test("the Chinese References summary overlay contains prose only", () => {
  const overlay = parseBib(summaryOverlay, { errorHandler: () => {} });
  expect(overlay.entries.length).toBeGreaterThan(280);

  for (const entry of overlay.entries) {
    const fields = entry.fields as Record<string, unknown>;
    expect(Object.keys(fields), entry.key).toEqual(["tldr-zh"]);
    expect(String(fields["tldr-zh"]), entry.key).toEndWith("。");
    expect(String(fields["tldr-zh"]), entry.key).not.toContain("—");
  }
});

test("every source cited in the Chinese book has a Chinese reader note", () => {
  const book = loadBook("zh", repoRoot);
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
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
  const missingFragments = [...bib.cited]
    .filter((key) => !html.includes(`id="ref-${key}"`))
    .sort();
  expect(missingFragments).toEqual([]);

  const missingChineseNotes = [...bib.cited]
    .filter((key) => !bib.entries.get(key)?.tldrZh?.trim())
    .sort();
  expect(missingChineseNotes).toEqual([]);

  for (const key of bib.cited) {
    const note = bib.entries.get(key)!.tldrZh!.trim();
    expect(note, key).toEndWith("。");
    expect(note, key).not.toContain("—");
  }
}, wholeBookTimeout);
