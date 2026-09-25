// The home page opens with a drawn book and a title spread. These checks are
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
import { renderCover } from "./cover.ts";
import { coverDataFor, latestRelease, partTitle } from "./landing.ts";
import { MAX_TURN, mountCover, poseAt, REDUCED_MOTION, type CoverEnv } from "./tilt.ts";

const repoRoot = join(import.meta.dir, "../../..");
const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));
const FRONT = ["strata", "thread", "type"];
const BACK = ["sheet", "drawing", "dims", "detail"];

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
    for (const layer of [...FRONT, ...BACK]) expect(cover).toContain(`<svg class="cv-l cv-l-${layer}"`);
    // The front comes first and the back is marked as turned away.
    expect(cover.indexOf('class="cv-face cv-front"')).toBeLessThan(cover.indexOf('class="cv-face cv-back"'));
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
  const names = (s: string) => new Set([...s.matchAll(/(--cv-[\w-]+):/g)].map((m) => m[1]));
  const light = names(block(":root {"));
  const dark = names(block(':root[data-theme="dark"] {'));
  light.delete("--cv-song"); // a font stack, not a color
  expect(light.size).toBeGreaterThan(5);
  expect([...light].filter((n) => !dark.has(n))).toEqual([]);
  // Every token the book and the stylesheet use is defined.
  const markup = renderCover("en", coverData.en) + renderCover("zh", coverData.zh);
  const used = new Set([...(markup + section).matchAll(/var\(--cv-([\w-]+)\)/g)].map((m) => `--cv-${m[1]}`));
  for (const n of used) expect({ n, defined: light.has(n) || n === "--cv-song" }).toEqual({ n, defined: true });
});

test("without script the front shows and the back faces away", () => {
  const css = readFileSync(join(repoRoot, "app/src/theme.css"), "utf8");
  const rule = (sel: string) => { const i = css.indexOf(`\n${sel} {`); return css.slice(i, css.indexOf("}", i)); };
  expect(rule(".cv")).toMatch(/--turn:\s*0;/);
  expect(rule(".cv-face")).toContain("backface-visibility: hidden");
  expect(rule(".cv-back")).toContain("rotateY(180deg)");
});

const coverData = { en: coverDataFor(loadBook("en", repoRoot), repoRoot), zh: coverDataFor(loadBook("zh", repoRoot), repoRoot) };
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const layerNames = (html: string) => [...html.matchAll(/<svg class="cv-l cv-l-(\w+)"/g)].map((m) => m[1]);

test("both faces draw the same layers in both languages, flat and in ink", () => {
  const en = renderCover("en", coverData.en), zh = renderCover("zh", coverData.zh);
  expect(layerNames(en)).toEqual([...FRONT, ...BACK]);
  expect(layerNames(zh)).toEqual(layerNames(en));
  for (const html of [en, zh]) {
    expect(html.match(/<text\b/g)?.length ?? 0).toBeGreaterThan(20);
    expect(html).not.toMatch(/<linearGradient|<radialGradient|<filter/);
  }
});

test("the front lists every part of the manifest", () => {
  for (const l of ["en", "zh"] as Lang[]) {
    expect(coverData[l].parts.length).toBe(loadBook(l, repoRoot).parts.filter((p) => !p.single).length);
    const front = plain(renderCover(l, coverData[l]).split('class="cv-face cv-back"')[0]);
    for (const p of coverData[l].parts) expect({ l, part: p.title, found: front.includes(` ${p.title} `) }).toEqual({ l, part: p.title, found: true });
  }
});

test("the back cover's title block carries the edition as its revision", () => {
  const release = { version: "1.2.3", date: "2026-01-02" };
  expect(renderCover("en", { parts: [], release })).toContain(">v1.2.3<");
  expect(renderCover("en", { parts: [], release: null })).toContain(">DRAFT<");
});

// A stand-in for the cover root and the window, recording what the runtime does.
function fakes(reduce: boolean) {
  const listeners = new Map<string, (e: unknown) => void>();
  const attrs = new Map<string, string>([["role", "img"], ["aria-label", "Cover"], ["data-turn-label", "Turn the book over"]]);
  const writes = new Map<string, string>();
  let frames = 0;
  const root = {
    addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
    removeEventListener: () => {},
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 140 }),
    style: { setProperty: (k: string, v: string) => writes.set(k, v), removeProperty: () => {} },
    classList: { add: () => {}, remove: () => {} },
  } as unknown as HTMLElement;
  const env: CoverEnv = {
    matchMedia: (q: string) => ({ matches: reduce && q === REDUCED_MOTION }),
    requestAnimationFrame: () => ++frames,
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: (n: string) => (n === "--ry" ? "18" : "0") }),
  };
  return { root, env, listeners, attrs, writes, frames: () => frames };
}

test("the book becomes a labeled toggle button that turns over", () => {
  const f = fakes(false);
  mountCover(f.root, f.env);
  expect(f.attrs.get("role")).toBe("button");
  expect(f.attrs.get("tabindex")).toBe("0");
  expect(f.attrs.get("aria-label")).toBe("Turn the book over");
  expect(f.attrs.get("aria-pressed")).toBe("false");
  f.listeners.get("click")!({});
  expect(f.attrs.get("aria-pressed")).toBe("true");
  expect(f.frames()).toBeGreaterThan(0); // the turn is animated
  let prevented = false;
  f.listeners.get("keydown")!({ key: " ", preventDefault: () => { prevented = true; } });
  expect(prevented).toBe(true);
  expect(f.attrs.get("aria-pressed")).toBe("false");
});

test("under reduced motion the tilt is not attached and the faces swap without a rotation", () => {
  const f = fakes(true);
  mountCover(f.root, f.env);
  expect([...f.listeners.keys()].sort()).toEqual(["click", "keydown"]);
  f.listeners.get("click")!({});
  expect(f.writes.get("--turn")).toBe("180");
  expect(f.frames()).toBe(0);
  expect([...f.writes.keys()]).toEqual(["--turn"]);
});

test("with motion allowed the tilt follows the pointer", () => {
  const f = fakes(false);
  mountCover(f.root, f.env);
  expect([...f.listeners.keys()].sort()).toEqual(["click", "keydown", "pointerleave", "pointermove"]);
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

// The floating "On this page" card covered the top right corner of the title
// spread, so on the home page it starts closed; other pages keep the saved
// choice, which is open by default.
test("on the home page the on-this-page card starts closed", () => {
  const html = (c: ChapterData) => renderToString(createElement(Reader, { chapter: c }));
  expect(html(pages.en)).not.toContain('class="rdr-toc"');
  const book = loadBook("en", repoRoot);
  const chapter = compileChapter(book, book.chapters.find((c) => c.num === "1")!, {
    bib: loadBibliographyDir(join(repoRoot, "refs")), xref: buildCrossref(book), graphviz,
    refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map(),
  });
  expect(html(chapter)).toContain('class="rdr-toc"');
});

// Stacked on a phone, the title page repeated the cover's title, subtitle and
// author in large type directly under the cover.
test("the stacked landing does not repeat what the cover shows", () => {
  const css = readFileSync(join(repoRoot, "app/src/theme.css"), "utf8");
  const narrow = css.slice(css.indexOf("@container lp (max-width: 680px)"));
  const block = narrow.slice(0, narrow.indexOf("\n}\n"));
  expect(block).toContain(".lp-imprint, .lp-subtitle, .lp-author { display: none; }");
  // The title is hidden visually only; it remains the page's h1.
  expect(block).toMatch(/\.lp-title \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\)/);
  expect(block).not.toMatch(/\.lp-title[^{]*\{[^}]*display: none/);
});

// Tilted in 3D, the book's layers showed jagged edges: the compositor draws a
// layer boundary without anti-aliasing unless the edge lies inside the texture.
test("the book's tilted layers carry a transparent outline against jagged edges", () => {
  const css = readFileSync(join(repoRoot, "app/src/theme.css"), "utf8");
  expect(css).toContain(".cv-face, .cv-spine, .cv-pages { outline: 1px solid transparent; }");
});
