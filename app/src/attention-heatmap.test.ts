// Guard the attention-heatmap interactive figure: the component must stay
// registered in the viz runtime, and the ch06 (transformer) figure that uses it
// must exist in both languages with the same data-viz name.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("../../viz-runtime.html", import.meta.url), "utf8");
const en = readFileSync(new URL("../../en/p1-foundations/06-transformer-architecture.qmd", import.meta.url), "utf8");
const zh = readFileSync(new URL("../../zh/p1-foundations/06-transformer-architecture.qmd", import.meta.url), "utf8");

test("the viz runtime registers the attention-heatmap component and its styles", () => {
  expect(rt).toMatch(/R\['attention-heatmap'\]\s*=\s*function/);
  expect(rt).toContain(".viz-attn");
});

test("ch06 uses the attention-heatmap figure in both languages", () => {
  expect(en).toContain('data-viz="attention-heatmap"');
  expect(zh).toContain('data-viz="attention-heatmap"');
});

test("the heatmap figcaption uses unicode, not $..$ math (raw HTML blocks bypass KaTeX)", () => {
  // A <figure> is a verbatim HTML block, so $QK^\\top$ / $\\sqrt{d}$ would render
  // as literal text. Captions must use unicode (QKᵀ, √d).
  for (const src of [en, zh]) {
    const cap = src.match(/data-viz="attention-heatmap"[\s\S]*?<\/figcaption>/)?.[0] ?? "";
    expect(cap).not.toMatch(/\$[^$]*\\(top|sqrt|frac|text)[^$]*\$/);
  }
});
