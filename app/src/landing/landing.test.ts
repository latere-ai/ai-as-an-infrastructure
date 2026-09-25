// The home page opens with a drawn cover and a title spread. These checks are
// structural: the cover is inline SVG in the server render (so it shows with
// script disabled) in both languages, no raster cover is referenced anywhere,
// the landing stays out of the chapter body, the edition comes from the
// changelog, and the cover palette has a dark twin for every token.

import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "../Reader.tsx";
import { loadBook } from "../pipeline/book.ts";
import { compileChapter } from "../pipeline/compile.ts";
import { loadBibliographyDir } from "../pipeline/citations.ts";
import { buildCrossref } from "../pipeline/crossref.ts";
import { loadGraphviz } from "../pipeline/diagrams.ts";
import { loadGlossary } from "../pipeline/glossary.ts";
import type { ChapterData, Lang } from "../types.ts";
import { renderCover } from "./cover.ts";
import { latestRelease, partTitle } from "./landing.ts";

const repoRoot = join(import.meta.dir, "../../..");
const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));
const LAYERS = ["sky", "orbits", "planet", "land", "figure", "type"];

function home(lang: Lang): ChapterData {
  const book = loadBook(lang, repoRoot);
  const ctx = {
    bib: loadBibliographyDir(join(repoRoot, "refs")), xref: buildCrossref(book), graphviz,
    refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map(),
  };
  return compileChapter(book, book.chapters.find((c) => c.href === "index")!, ctx);
}

const pages = { en: home("en"), zh: home("zh") };

for (const lang of ["en", "zh"] as Lang[]) {
  test(`${lang}: the server render carries the whole cover as inline SVG`, () => {
    const html = renderToString(createElement(Reader, { chapter: pages[lang] }));
    const cover = html.slice(html.indexOf("data-cover"));
    expect(cover.length).toBeGreaterThan(0);
    for (const layer of LAYERS) expect(cover).toContain(`<svg class="cv-l cv-l-${layer}"`);
    // The type layer draws text, so the cover reads without script or images.
    expect(cover.match(/<text\b/g)?.length ?? 0).toBeGreaterThan(10);
    expect(html.slice(html.indexOf('class="lp"'), html.indexOf('class="rdr-kicker"'))).not.toContain("<img");
  });

  test(`${lang}: the landing sits outside the chapter body`, () => {
    const data = pages[lang];
    expect(data.landingHtml).toContain("data-cover");
    expect(data.contentHtml).not.toContain("data-cover");
    expect(data.contentHtml).not.toContain("book-cover");
    // Every part of the manifest is listed, each linking to a page of the book.
    const book = loadBook(lang, repoRoot);
    const parts = book.parts.filter((p) => !p.single);
    const rows = [...data.landingHtml!.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]);
    expect(rows.length).toBe(parts.length);
    const hrefs = new Set(book.chapters.map((c) => c.href));
    for (const href of rows) expect(hrefs.has(href)).toBe(true);
  });
}

test("only the home page carries a landing", () => {
  expect(pages.en.landingHtml).toBeTruthy();
  const book = loadBook("en", repoRoot);
  const other = compileChapter(book, book.chapters.find((c) => c.href !== "index" && !c.num)!, {
    bib: loadBibliographyDir(join(repoRoot, "refs")), xref: buildCrossref(book), graphviz,
    refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map(),
  });
  expect(other.landingHtml).toBeUndefined();
});

test("the en and zh covers share one layer structure", () => {
  const layers = (html: string) => [...html.matchAll(/<svg class="cv-l cv-l-(\w+)"/g)].map((m) => m[1]);
  expect(layers(renderCover("en"))).toEqual(LAYERS);
  expect(layers(renderCover("zh"))).toEqual(LAYERS);
});

test("no raster cover is referenced or shipped", () => {
  const png = new RegExp("cover-(light|dark)" + "\\.png");
  const files = [
    join(repoRoot, "en/index.qmd"), join(repoRoot, "zh/index.qmd"), join(repoRoot, "README.md"),
    join(repoRoot, "main.go"), join(repoRoot, "main_test.go"),
    ...readdirSync(join(repoRoot, "app/src"), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(ts|tsx|css)$/.test(f)).map((f) => join(repoRoot, "app/src", f)),
  ];
  for (const f of files) expect({ f, hit: png.test(readFileSync(f, "utf8")) }).toEqual({ f, hit: false });
  for (const lang of ["en", "zh"]) {
    for (const theme of ["light", "dark"]) expect(existsSync(join(repoRoot, lang, "figures", `cover-${theme}.png`))).toBe(false);
  }
});

test("the edition is the newest released version in CHANGELOG.md", () => {
  const log = "# Changelog\n\n## Unreleased\n\n- next\n\n## v1.2.3 - 2026-01-02\n\n## v1.2.2 - 2025-12-30\n";
  expect(latestRelease(log)).toEqual({ version: "1.2.3", date: "2026-01-02" });
  expect(latestRelease("# Changelog\n\n## Unreleased\n")).toBeNull();
  const real = latestRelease(readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8"));
  expect(real).not.toBeNull();
  expect(pages.en.landingHtml).toContain(`v${real!.version}`);
  expect(pages.zh.landingHtml).toContain(`v${real!.version}`);
});

test("part titles drop the part number in both manifests", () => {
  expect(partTitle("Part I: Base Model Formation")).toBe("Base Model Formation");
  expect(partTitle("Part III: Post-Training: Adaptation")).toBe("Post-Training: Adaptation");
  expect(partTitle("第一部分 · 基座模型的形成")).toBe("基座模型的形成");
});

test("every cover color token has a dark value", () => {
  const css = readFileSync(join(repoRoot, "app/src/theme.css"), "utf8");
  const section = css.slice(css.indexOf("Home page (app/src/landing)"));
  const block = (sel: string) => section.slice(section.indexOf(sel + " {"), section.indexOf("}", section.indexOf(sel + " {")));
  const names = (s: string) => new Set([...s.matchAll(/(--cv-[\w-]+):/g)].map((m) => m[1]));
  const light = names(block(":root"));
  const dark = names(block(':root[data-theme="dark"]'));
  light.delete("--cv-song"); // a font stack, not a color
  expect([...light].filter((n) => !dark.has(n))).toEqual([]);
  // Every token the cover and the stylesheet use is defined.
  const used = new Set([...(renderCover("en") + renderCover("zh") + section).matchAll(/var\(--cv-([\w-]+)\)|stop-color:var\(--cv-([\w-]+)\)/g)].map((m) => `--cv-${m[1] ?? m[2]}`));
  for (const n of used) expect({ n, defined: light.has(n) || n === "--cv-song" }).toEqual({ n, defined: true });
});
