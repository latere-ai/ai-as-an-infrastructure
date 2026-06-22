// Guard the runnable-cell matplotlib rendering contract (src/runtime/live.ts).
// The figure must be a transparent vector SVG with text flattened to paths, so
// it stays crisp on Retina and blends into the themed (light/dark) result panel.
// Regression target: a blurry, opaque, white-background raster PNG.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const rt = readFileSync(new URL("./runtime/live.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

test("matplotlib output is a transparent SVG (vector, theme-fitting), not a PNG", () => {
  expect(rt).toMatch(/format="svg",\s*bbox_inches="tight",\s*transparent=True/);
  expect(rt).not.toMatch(/format="png"/);
});

test("SVG text is flattened to paths so it renders identically inside the <img>", () => {
  expect(rt).toMatch(/"svg\.fonttype":\s*"path"/);
});

test("CJK code triggers loading and registering a CJK font (no tofu boxes)", () => {
  // DejaVu Sans (matplotlib's default) has no CJK glyphs, so zh labels render
  // as tofu. The runtime must detect CJK, fetch a CJK font, register it with
  // the font manager, and select it in rcParams.
  expect(rt).toMatch(/CJK_RE\s*=\s*\/\[/);
  expect(rt).toMatch(/CJK_RE\.test\(code\)/);
  expect(rt).toContain("fontManager.addfont");
  expect(rt).toMatch(/"font\.sans-serif"\]\s*=\s*\["' \+ CJK_FONT_NAME/);
  // The CJK font lacks the Unicode minus glyph, so it must be disabled.
  expect(rt).toContain('"axes.unicode_minus"] = False');
  // The font is only fetched when matplotlib is actually used.
  expect(rt).toMatch(/usesMpl && CJK_RE\.test\(code\)/);
});

test("the figure canvas is transparent (no baked-in background color)", () => {
  expect(rt).toMatch(/"figure\.facecolor":\s*"none",\s*"axes\.facecolor":\s*"none"/);
});

test("the result panel is displayed from an svg+xml data URI", () => {
  expect(rt).toContain("data:image/svg+xml;base64,");
});

test("the result panel shares the cell surface, not the near-white --bg-surface", () => {
  // --bg-surface is near-white in light mode; using it made the result half a
  // white block lighter than the editor. The panel must be transparent so it
  // inherits the cell's --bg-code (and the transparent figure blends in).
  const rule = css.match(/\.live-result \{[^}]*\}/)?.[0] ?? "";
  expect(rule).toContain("background: transparent");
  expect(rule).not.toContain("--bg-surface");
});
