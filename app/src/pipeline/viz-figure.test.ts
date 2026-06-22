// Interactive viz are authored as raw {=html} <figure id="fig-x"> blocks. They
// must read as numbered, cross-referenceable figures like images and diagrams:
// the crossref scan counts them, and the render pass adds the rdr-figure class
// and the "Figure C.N." caption number.

import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCrossref } from "./crossref.ts";
import { renderMarkdown, type RenderContext } from "./markdown.ts";

const VIZ = [
  "# Demo Chapter {#sec-demo}",
  "",
  "```{=html}",
  '<figure id="fig-demo-viz">',
  '<div class="viz" data-viz="curve"></div>',
  "<figcaption>A demo caption.</figcaption>",
  "</figure>",
  "```",
  "",
].join("\n");

function ctx(xref: RenderContext["xref"]): RenderContext {
  return {
    bib: { entries: new Map(), cited: new Set() },
    xref,
    currentHref: "orientation/demo.html",
    chapterTitle: "Demo Chapter",
    chapterNum: "2",
    prefix: "../",
    graphviz: {} as any,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
}

test("crossref counts a raw <figure id=fig-x> viz block in document order", () => {
  const dir = mkdtempSync(join(tmpdir(), "viz-fig-"));
  const qmdPath = join(dir, "demo.qmd");
  writeFileSync(qmdPath, VIZ);
  const book = {
    lang: "en" as const,
    chapters: [{ num: "2", title: "Demo", href: "orientation/demo.html", qmdPath }],
  };
  const map = buildCrossref(book as any);
  expect(map.get("fig-demo-viz")?.label).toBe("Figure 2.1");
});

test("render adds rdr-figure class and the Figure number to a viz <figure>", () => {
  const xref: RenderContext["xref"] = new Map([
    ["fig-demo-viz", { kind: "fig", label: "Figure 2.1", href: "orientation/demo.html#fig-demo-viz" }],
  ]);
  const { html } = renderMarkdown(VIZ, ctx(xref));
  expect(html).toMatch(/<figure[^>]*\bclass="rdr-figure"[^>]*\bid="fig-demo-viz"|<figure[^>]*\bid="fig-demo-viz"[^>]*\bclass="rdr-figure"/);
  expect(html).toContain('<span class="rdr-fig-num">Figure 2.1.</span>');
  expect(html).toContain('class="viz"');
});

test("a viz <figure> without an id is left untouched (no number, no crash)", () => {
  const noId = VIZ.replace(' id="fig-demo-viz"', "");
  const { html } = renderMarkdown(noId, ctx(new Map()));
  expect(html).not.toContain("rdr-fig-num");
  expect(html).toContain("A demo caption.");
});
