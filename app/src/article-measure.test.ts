// The article column's reading measure. It is a CSS cascade rather than an inline
// React style so a persisted layout can be applied before first paint, which
// means a missing or mis-ordered override is silent: the column just renders at
// the wrong width. These tests resolve the cascade the way a browser would and
// assert the width every (language, layout) pair actually lands on.

import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./types.ts";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const reader = readFileSync(new URL("./Reader.tsx", import.meta.url), "utf8");
const html = readFileSync(new URL("./html.ts", import.meta.url), "utf8");

type Rule = { selector: string; value: string };

const rules: Rule[] = [...css.matchAll(/([^{}]+)\{[^{}]*--article-max:\s*([^;}]+)[;}]/g)]
  .map((m) => ({ selector: m[1].trim().split("\n").pop()!.trim(), value: m[2].trim() }));

// Resolve --article-max for an <html> carrying this lang + data-layout, using
// attribute-selector count as specificity and source order to break ties.
function measure(lang: "en" | "zh", layout: string): string {
  const attrs = { lang: lang === "zh" ? "zh-Hans" : "en", "data-layout": layout };
  let best: { rank: number; value: string } | undefined;
  rules.forEach(({ selector, value }, i) => {
    const wanted = [...selector.matchAll(/\[([a-z-]+)(?:\^?=)?"?([^\]"]*)"?\]/g)];
    const hit = wanted.every(([, name, val]) => {
      const actual = attrs[name as keyof typeof attrs] ?? "";
      return selector.includes(`${name}^=`) ? actual.startsWith(val) : actual === val;
    });
    if (!hit) return;
    const rank = wanted.length * 1000 + i;
    if (!best || rank >= best.rank) best = { rank, value };
  });
  return best?.value ?? "";
}

// Resolve a cap to px at the default 18 px text size, with the 640 px floor
// the column applies (max(640px, var(--article-max))).
const px = (v: string) => (v.endsWith("em") ? Math.max(640, parseFloat(v) * 18) : NaN);

test("the column takes its cap from the cascade, not an inline width", () => {
  expect(css).toContain("--measure: max(640px, var(--article-max));");
  expect(css).toContain("max-width: max(640px, var(--article-max), var(--wide-max));");
  expect(reader).not.toContain("maxWidth: articleMaxWidth");
  expect(reader).toContain('className="rdr-col"');
});

test("caps are in em, so the measure holds its character count at any text size", () => {
  for (const lang of ["en", "zh"] as const) {
    for (const layout of ["manuscript", "codex"]) expect(measure(lang, layout)).toMatch(/^\d+(\.\d+)?em$/);
  }
});

test("the default measure reads about 90 to 100 Latin characters, zh narrower", () => {
  expect(DEFAULT_SETTINGS.layout).toBe("codex");
  // Inter at 18 px advances about 0.48 em per character of running English.
  const chars = (parseFloat(measure("en", "codex")) / 0.48);
  expect(chars).toBeGreaterThanOrEqual(90);
  expect(chars).toBeLessThanOrEqual(100);
  // A CJK glyph is ~2x the advance width of a Latin one, so the zh caps must
  // stay the narrower pair.
  for (const layout of ["manuscript", "codex"]) {
    expect(parseFloat(measure("zh", layout))).toBeLessThan(parseFloat(measure("en", layout)));
  }
  expect(parseFloat(measure("en", "manuscript"))).toBeLessThan(parseFloat(measure("en", "codex")));
});

test("no layout drops the column below the 640 px figure modules need", () => {
  for (const lang of ["en", "zh"] as const) {
    for (const layout of ["manuscript", "codex"]) expect(px(measure(lang, layout))).toBeGreaterThanOrEqual(640);
  }
});

// Both caps once resolved below the 640 px floor at 18 px text, so manuscript
// and codex rendered the same column until the reader enlarged the text.
test("manuscript and codex are distinct widths at the default text size", () => {
  for (const lang of ["en", "zh"] as const) {
    expect(px(measure(lang, "manuscript"))).toBeGreaterThan(640);
    expect(px(measure(lang, "manuscript"))).toBeLessThan(px(measure(lang, "codex")));
  }
});

// Running text keeps the measure; code cells, code blocks, tables and display
// math may use the whole column, which is wider than the measure.
test("wide content breaks out of the measure, running text does not", () => {
  const rule = (sel: string) => css.split("\n").find((l) => l.includes(sel) && l.includes("{")) ?? "";
  expect(rule(".rdr-article > * {")).toContain("max-width: var(--measure)");
  expect(rule(".rdr-article > .rdr-runnable")).toContain("max-width: none");
  expect(rule(".rdr-article > .rdr-runnable")).toContain(".katex-block");
  expect(css).toMatch(/\.rdr-article > pre, [^{]*\.rdr-article > table,\s*[^{]*\.rdr-article > \.table-scroll \{ width: max-content; min-width: min\(var\(--measure\), 100%\); max-width: 100%; \}/);
  expect(parseFloat(css.match(/--wide-max: ([\d.]+)em/)![1])).toBeGreaterThan(parseFloat(measure("en", "codex")));
  // The measure is a registered length, so em resolves on the column and a
  // heading does not get a wider measure than its paragraph.
  expect(css).toContain('@property --measure { syntax: "<length-percentage>"; inherits: true;');
});

test("atlas is uncapped in both languages, so the column fills the row", () => {
  expect(measure("en", "atlas")).toBe("100%");
  expect(measure("zh", "atlas")).toBe("100%");
});

test("a saved layout is applied before first paint, so the width does not jump", () => {
  expect(html).toContain('if(s.layout)d.setAttribute("data-layout",s.layout);');
  expect(html).toContain('data-layout="${DEFAULT_SETTINGS.layout}"');
  expect(reader).toContain('if (patch.layout) document.documentElement.dataset.layout = patch.layout;');
  expect(reader).toContain("if (saved.layout) document.documentElement.dataset.layout = saved.layout;");
});

test("the layout control is reachable and named in both languages", () => {
  expect(reader).toContain('layout: "Layout"');
  expect(reader).toContain('layout: "版式"');
  expect(reader).toContain("set({ layout: o.v })");
  for (const key of ["manuscript", "codex", "atlas"]) {
    expect(reader).toContain(`v: "${key}", l: t.${key}`);
  }
});

// The server render assumes a desktop, so the side columns must be hidden by
// the stylesheet on narrow viewports, or a reader without script gets the
// article squeezed between them.
test("narrow viewports hide the side columns before hydration", () => {
  expect(css).toMatch(/@media \(max-width: 991\.98px\) \{[^}]*\.rdr-desktop-aside[^{]*\{ display: none !important; \}/);
  expect(css).toMatch(/@media \(max-width: 1199\.98px\) \{ \.rdr-toc-wrap \{ display: none; \} \}/);
  expect(reader).toContain("const TOC_MIN_VW = 1200;");
  expect(reader).toContain("const MAIN_MIN = 640 + 2 * 32;");
});

// "On this page" floats over the page: opening it must not take width from
// the article, and when shown its list is always visible (the header button
// is the toggle; nothing hides the list behind a hover).
test("the on-this-page card overlays the article and always shows its list", () => {
  expect(reader).not.toMatch(/tocRoom/);
  expect(css).not.toMatch(/\.rdr-toc[^{]*:hover[^{]*\.rdr-toc-list/);
  expect(css).not.toMatch(/is-compact/);
  expect(reader).toMatch(/aria-pressed=\{tocDocked \? !s\.tocCollapsed : tocDrawer\}/);
});
