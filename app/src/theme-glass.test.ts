import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "theme.css"), "utf8");

// The full-float overlays (search modal, drawers, settings) sit centered over
// the article. We composite blur only — no lensing — so a translucent fill let
// headings read straight through the search box. The overlay tier must be
// near-opaque to occlude; the edge chrome stays a touch lighter.
const opacityAfter = (anchor: string): number => {
  const start = css.indexOf(anchor);
  const rule = css.slice(start, start + 220);
  const m = rule.match(/background:\s*color-mix\(in srgb,\s*var\(--bg-surface\)\s*(\d+)%/);
  expect(m).not.toBeNull();
  return Number(m![1]);
};

// Anchor on the line-start selector so we hit the dedicated rules, not the
// combined `.rdr-glass, .rdr-glass-edge {` block (which carries no background).
test(".rdr-glass overlay tier is near-opaque so it occludes the article", () => {
  expect(opacityAfter("\n.rdr-glass {")).toBeGreaterThanOrEqual(90);
});

test(".rdr-glass-edge chrome is opaque enough to keep glyphs from bleeding", () => {
  expect(opacityAfter("\n.rdr-glass-edge {")).toBeGreaterThanOrEqual(85);
});
