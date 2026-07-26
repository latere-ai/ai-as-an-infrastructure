// The article panel's reading measure. It is a CSS cascade rather than an inline
// React style so a persisted layout can be applied before first paint, which
// means a missing or mis-ordered override is silent: the panel just renders at
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

test("the panel takes its cap from the cascade, not an inline width", () => {
  expect(css).toContain(".lq-article-panel { max-width: var(--article-max); }");
  expect(reader).not.toContain("maxWidth: 940");
  expect(reader).not.toContain("maxWidth: articleMaxWidth");
});

test("every layout resolves to its own cap, and zh reads narrower than en", () => {
  expect(measure("en", "manuscript")).toBe("900px");
  expect(measure("en", "codex")).toBe("1360px");
  expect(measure("en", "atlas")).toBe("none");
  expect(measure("zh", "manuscript")).toBe("780px");
  expect(measure("zh", "codex")).toBe("1180px");
  // A CJK glyph is ~2x the advance width of a Latin one, so the same pixel
  // measure holds ~2x the characters; the zh caps must stay the narrower pair.
  for (const layout of ["manuscript", "codex"]) {
    expect(parseInt(measure("zh", layout), 10)).toBeLessThan(parseInt(measure("en", layout), 10));
  }
});

test("atlas is uncapped in both languages, so the panel fills the row", () => {
  expect(measure("en", "atlas")).toBe("none");
  expect(measure("zh", "atlas")).toBe("none");
});

test("the default layout is codex and it is wider than the old fixed 940", () => {
  expect(DEFAULT_SETTINGS.layout).toBe("codex");
  expect(parseInt(measure("en", "codex"), 10)).toBeGreaterThan(940);
  expect(parseInt(measure("zh", "codex"), 10)).toBeGreaterThan(940);
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
