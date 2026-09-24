// Guard the curve families against the chapters that embed them, and the
// convention that zh curve labels are allowed to localize visible axis/slider
// text alongside the figcaption.

import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const repoRoot = join(import.meta.dir, "..", "..");
function src(p: string) { return readFileSync(new URL("../../" + p, import.meta.url), "utf8"); }

const fnsBlock = rt.match(/var fns = \{([\s\S]*?)\n\s*\};/)?.[1] ?? "";
const registered = new Set([...fnsBlock.matchAll(/^\s*'?([a-z0-9-]+)'?\s*:\s*function/gm)].map((m) => m[1]));

// The runtime falls back to powerlaw for an unknown family, so an embed of an
// unregistered family would draw the wrong curve without an error.
const embedded = new Set<string>();
for (const lang of ["en", "zh"]) {
  const files = readdirSync(join(repoRoot, lang), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".qmd"))
    .map((e) => join(e.parentPath, e.name));
  for (const file of files) {
    for (const [tag] of readFileSync(file, "utf8").matchAll(/<[a-z]+\b[^>]*\bdata-viz="curve"[^>]*>/g)) {
      embedded.add(tag.match(/\bdata-family="([^"]+)"/)?.[1] ?? "powerlaw");
    }
  }
}

test("every curve family a chapter embeds is registered, and every registered family is embedded", () => {
  expect(registered.size).toBeGreaterThan(0);
  expect([...embedded].filter((name) => !registered.has(name))).toEqual([]);
  expect([...registered].filter((name) => !embedded.has(name))).toEqual([]);
});

test("zh viz blocks localize visible data-*label attributes", () => {
  // These attributes are rendered as visible axis and slider labels by the viz
  // runtime, so zh pages should be able to translate them. Sample the
  // reliability curve, whose axis and slider labels are written in Chinese.
  const zh = src("zh/practice/10-reliability-nondeterministic.qmd");
  for (const attr of ["data-xlabel", "data-ylabel", "data-plabel"]) {
    expect(zh).toMatch(new RegExp(`${attr}="[^"]*[\u4e00-\u9fff][^"]*"`));
  }
});
