import { test, expect } from "bun:test";
import { LAYOUT_FONT, prepareDot } from "./diagram-source.ts";
import { loadGraphviz, renderDot } from "./diagrams.ts";

const gv = await loadGraphviz();

test("injects the layout font, a transparent background, and a node margin after the graph brace", () => {
  const out = prepareDot("digraph {\n  a -> b;\n}");
  expect(out.startsWith("digraph {")).toBe(true);
  expect(out).toContain(`graph [fontname="${LAYOUT_FONT}", bgcolor="transparent"];`);
  expect(out).toContain(`node [fontname="${LAYOUT_FONT}", margin="0.2,0.12"];`);
  expect(out.indexOf("fontname")).toBeLessThan(out.indexOf("a -> b"));
});

test("handles named, strict, undirected, and commented graph headers", () => {
  for (const header of ["digraph G {", "strict digraph {", "graph {", "// a note\ndigraph {"]) {
    const out = prepareDot(`${header}\n}`);
    expect(out.indexOf(`fontname="${LAYOUT_FONT}"`)).toBeGreaterThan(header.length - 1);
  }
  expect(prepareDot("not a graph")).toBe("not a graph");
});

test("every font is laid out with the layout font, not the one the source names", () => {
  // Graphviz sized boxes with Helvetica metrics while the page draws Inter,
  // which is wider, so labels crowded or crossed their box edges.
  const src = 'digraph { node [fontname="Helvetica"]; subgraph cluster_x { label="cluster"; a [label="node", fontname="PingFang SC"]; } a -> b [label="edge"]; }';
  const html = renderDot(gv, src, new Map(), "x", "");
  const fonts = [...html.matchAll(/<text\b[^>]*font-family="([^"]*)"/g)].map((m) => m[1]);
  expect(fonts.length).toBeGreaterThanOrEqual(4);
  for (const f of fonts) expect(f.startsWith(LAYOUT_FONT)).toBe(true);
});

test("attribute rewrites leave label text alone", () => {
  const out = prepareDot('digraph { a [label="size=3, fontname=x", fontname=Helvetica]; }');
  expect(out).toContain('label="size=3, fontname=x"');
  expect(out).toContain(`fontname="${LAYOUT_FONT}"];`);
});

test("Graphviz SVGs expose the figure caption as an accessible name", () => {
  const code = [
    "//| label: fig-path",
    '//| fig-cap: "Artifact & kernel compatibility."',
    "digraph { A -> B }",
  ].join("\n");
  const html = renderDot(gv, code, new Map(), "chapter.html", "../");
  expect(html).toContain('<svg role="img" aria-label="Artifact &amp; kernel compatibility."');
});
