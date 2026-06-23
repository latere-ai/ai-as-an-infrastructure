import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderMarkdown, type RenderContext } from "./markdown.ts";

function ctx(xref: RenderContext["xref"]): RenderContext {
  return {
    bib: { entries: new Map(), cited: new Set() },
    xref,
    currentHref: "foundations/scaling-laws.html",
    chapterTitle: "Scaling Laws and Compute Allocation",
    chapterNum: "1",
    prefix: "../",
    graphviz: {} as any,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
}

test("local SVG figures render inline instead of as img replacements", () => {
  const src = [
    "# Scaling Laws",
    "",
    "![Schematic illustration of power-law extrapolation.](/figures/scaling-laws-1.svg){#fig-scaling-laws-1}",
    "",
  ].join("\n");
  const xref: RenderContext["xref"] = new Map([
    ["fig-scaling-laws-1", { kind: "fig", label: "Figure 1.1", href: "foundations/scaling-laws.html#fig-scaling-laws-1" }],
  ]);
  const { html } = renderMarkdown(src, ctx(xref));

  expect(html).toContain('<figure class="rdr-figure" id="fig-scaling-laws-1"><svg');
  expect(html).toContain('class="rdr-inline-svg"');
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Schematic illustration of power-law extrapolation."');
  expect(html).toContain('id="fig-scaling-laws-1-figure_1"');
  expect(html).toContain('xlink:href="#fig-scaling-laws-1-');
  expect(html).toContain('clip-path="url(#fig-scaling-laws-1-');
  expect(html).toContain('<figcaption><span class="rdr-fig-num">Figure 1.1.</span> Schematic illustration of power-law extrapolation.</figcaption>');
  expect(html).not.toContain('<img src="../figures/scaling-laws-1.svg"');
});

test("inline SVG figure text is selectable in the reader CSS", () => {
  const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.rdr-inline-svg \{[^}]*display:\s*block[^}]*user-select:\s*text/);
  expect(css).toMatch(/\.rdr-inline-svg text \{[^}]*user-select:\s*text/);
});
