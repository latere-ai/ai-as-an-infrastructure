// The home page opens with a drawn cover and a title spread. These checks are
// structural: the cover is inline SVG in the server render (so it shows with
// script disabled) in both languages, no raster cover is referenced anywhere,
// the landing stays out of the chapter body, the edition comes from the
// changelog, the cover palette has a dark twin for every token, and the tilt
// attaches nothing under reduced motion.

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
import { COVER_VARIANTS, DEFAULT_COVER, renderCover } from "./cover.ts";
import { coverDataFor, latestRelease, partTitle, renderLanding } from "./landing.ts";
import { MAX_TURN, mountCover, poseAt, REDUCED_MOTION, type CoverEnv } from "./tilt.ts";

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
    const layers = layerNames(renderCover(lang, DEFAULT_COVER, coverData[lang]));
    expect(layers.length).toBeGreaterThanOrEqual(3);
    for (const layer of layers) expect(cover).toContain(`<svg class="cv-l cv-l-${layer}"`);
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

test("the first cover keeps its six layers in both languages", () => {
  const layers = (html: string) => [...html.matchAll(/<svg class="cv-l cv-l-(\w+)"/g)].map((m) => m[1]);
  expect(layers(renderCover("en", "horizon"))).toEqual(LAYERS);
  expect(layers(renderCover("zh", "horizon"))).toEqual(LAYERS);
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
  const block = (sel: string) => { const i = section.indexOf(sel); return section.slice(i, section.indexOf("}", i)); };
  const names = (s: string) => new Set([...s.matchAll(/(--cv-[\w-]+):\s*([^;]+);/g)].filter((m) => !m[2].startsWith("var(")).map((m) => m[1]));
  // The first cover's palette on :root, and the ink covers' shared palette.
  const horizonLight = names(block(":root {"));
  const horizonDark = names(block(':root[data-theme="dark"] {'));
  horizonLight.delete("--cv-song"); // a font stack, not a color
  expect([...horizonLight].filter((n) => !horizonDark.has(n))).toEqual([]);
  const inkLight = names(block('.cv:is([data-cover="stack"]'));
  const inkDark = names(block(':root[data-theme="dark"] :is(.cv:is('));
  expect(inkLight.size).toBeGreaterThan(5);
  expect([...inkLight].filter((n) => !inkDark.has(n))).toEqual([]);
  // A colored accent has a dark twin; the type cover's accent is its ink.
  for (const v of ["stack", "drawing"]) expect(section).toContain(`:root[data-theme="dark"] :is(.cv[data-cover="${v}"]`);
  // Every token the covers and the stylesheet use is defined.
  const defined = new Set([...section.matchAll(/(--cv-[\w-]+):/g)].map((m) => m[1]));
  const markup = COVER_VARIANTS.flatMap((v) => (["en", "zh"] as Lang[]).map((l) => renderCover(l, v, coverData[l]))).join("");
  const used = new Set([...(markup + section).matchAll(/var\(--cv-([\w-]+)\)/g)].map((m) => `--cv-${m[1]}`));
  for (const n of used) expect({ n, defined: defined.has(n) }).toEqual({ n, defined: true });
});

const coverData = { en: coverDataFor(loadBook("en", repoRoot), repoRoot), zh: coverDataFor(loadBook("zh", repoRoot), repoRoot) };
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const layerNames = (html: string) => [...html.matchAll(/<svg class="cv-l cv-l-(\w+)"/g)].map((m) => m[1]);

for (const v of COVER_VARIANTS) {
  test(`cover ${v}: both languages draw the same layers, with type`, () => {
    const en = renderCover("en", v, coverData.en), zh = renderCover("zh", v, coverData.zh);
    expect(en).toContain(`data-cover="${v}"`);
    expect(layerNames(en).length).toBeGreaterThanOrEqual(3);
    expect(layerNames(zh)).toEqual(layerNames(en));
    for (const html of [en, zh]) expect(html.match(/<text\b/g)?.length ?? 0).toBeGreaterThan(5);
  });
}

test("the ink covers are flat: no gradients, glow or filters", () => {
  for (const v of COVER_VARIANTS.filter((c) => c !== "horizon")) {
    for (const l of ["en", "zh"] as Lang[]) expect(renderCover(l, v, coverData[l])).not.toMatch(/<linearGradient|<radialGradient|<filter/);
  }
});

test("the stack and type covers list every part of the manifest", () => {
  for (const l of ["en", "zh"] as Lang[]) {
    expect(coverData[l].parts.length).toBe(loadBook(l, repoRoot).parts.filter((p) => !p.single).length);
    for (const v of ["stack", "type"] as const) {
      const text = plain(renderCover(l, v, coverData[l]));
      for (const p of coverData[l].parts) expect({ v, l, part: p.title, found: text.includes(` ${p.title} `) }).toEqual({ v, l, part: p.title, found: true });
    }
  }
});

test("the drawing's title block carries the edition as its revision", () => {
  const release = { version: "1.2.3", date: "2026-01-02" };
  expect(renderCover("en", "drawing", { parts: [], release })).toContain(">v1.2.3<");
  expect(renderCover("en", "drawing", { parts: [], release: null })).toContain(">DRAFT<");
});

test("the landing draws the cover it is given, and a build can preview one", () => {
  const book = loadBook("en", repoRoot);
  for (const v of COVER_VARIANTS) expect(renderLanding(book, repoRoot, v)).toContain(`data-cover="${v}"`);
  expect(pages.en.landingHtml).toContain(`data-cover="${DEFAULT_COVER}"`);
  const prev = process.env.AAAI_COVER;
  process.env.AAAI_COVER = "no-such-cover";
  try { expect(() => home("en")).toThrow(/AAAI_COVER/); } finally { if (prev === undefined) delete process.env.AAAI_COVER; else process.env.AAAI_COVER = prev; }
});

// A stand-in for the cover root and the window, recording what the tilt does.
function fakes(reduce: boolean) {
  const listeners: string[] = [];
  const writes: string[] = [];
  let frames = 0;
  const root = {
    addEventListener: (type: string) => listeners.push(type),
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 140 }),
    style: { setProperty: (k: string) => writes.push(k), removeProperty: () => {} },
    classList: { add: (c: string) => writes.push(c), remove: () => {} },
  } as unknown as HTMLElement;
  const env: CoverEnv = {
    matchMedia: (q: string) => ({ matches: reduce && q === REDUCED_MOTION }),
    requestAnimationFrame: () => ++frames,
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: (n: string) => (n === "--ry" ? "18" : "0") }),
    setTimeout: () => 1,
    clearTimeout: () => {},
  };
  return { root, env, listeners, writes, frames: () => frames };
}

test("under reduced motion the tilt attaches nothing and writes nothing", () => {
  const f = fakes(true);
  const detach = mountCover(f.root, f.env);
  expect(f.listeners).toEqual([]);
  expect(f.writes).toEqual([]);
  expect(f.frames()).toBe(0);
  detach();
});

test("with motion allowed the tilt follows the pointer", () => {
  const f = fakes(false);
  mountCover(f.root, f.env);
  expect(f.listeners.sort()).toEqual(["pointerdown", "pointerleave", "pointermove"]);
  expect(poseAt(1, 0).ry).toBe(MAX_TURN.y);
  expect(poseAt(0, -1).rx).toBe(MAX_TURN.x);
  expect(poseAt(5, 5)).toEqual(poseAt(1, 1)); // clamped to the cover
});

// The title spread and the Preface opener each rendered an <h1>, so the home
// page had two top-level headings.
for (const lang of ["en", "zh"] as Lang[]) {
  test(`${lang}: the home page has exactly one h1, the book title`, () => {
    const html = renderToString(createElement(Reader, { chapter: pages[lang] }));
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf('class="rdr-title"'));
  });
}
