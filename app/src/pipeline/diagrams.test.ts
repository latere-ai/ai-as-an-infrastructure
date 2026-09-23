import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { CATEGORICAL_HEX, colorRole, themeClasses } from "./diagram-color.ts";
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

test("size and ratio are dropped, so text is never scaled below the reader's minimum", () => {
  // size="3.2,8.0" shrank some diagrams to 0.39x, about 4.7 px text.
  const src = 'digraph { size="1,1"; ratio=compress; a [label="a long label that is wide"]; a -> b; }';
  const out = prepareDot(src);
  expect(out).not.toMatch(/(?<![\w])size\s*=/);
  expect(out).not.toMatch(/\bratio\s*=/);
  expect(gv.dot(out, "svg")).toMatch(/transform="scale\(1 1\)/);
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

test("colors map to theme roles by job, for any color", () => {
  expect(colorRole("#f1ece1", "fill")).toBe("panel");
  expect(colorRole("#ffffff", "fill")).toBe("paper");
  expect(colorRole("white", "fill")).toBe("paper");
  expect(colorRole("#6b7280", "stroke")).toBe("ink3");
  expect(colorRole("#6b7280", "text")).toBe("ink2");
  expect(colorRole("black", "text")).toBe("ink");
  expect(colorRole("#3b82f6", "stroke")).toBe("c1");
  expect(colorRole("#dbeafe", "fill")).toBe("c1t");
  expect(colorRole("#bfe3c0", "fill")).toBe("c6t");
  expect(colorRole("#f2c2c2", "fill")).toBe("c8t");
  expect(colorRole("#8b5cf6", "text")).toBe("c7");
  expect(colorRole("lightblue", "fill")).toBe("c1t");
  expect(colorRole("none", "fill")).toBeNull();
  expect(colorRole("transparent", "stroke")).toBeNull();
});

test("the categorical hues match the figure tokens in theme.css", () => {
  const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
  const root = css.match(/:root \{\s*--fig-ink:[\s\S]*?\}/)?.[0] ?? "";
  CATEGORICAL_HEX.forEach((hex, i) => expect(root).toContain(`--fig-c${i + 1}: ${hex};`));
});

test("every painted shape and text run gets a theme class", () => {
  const svg = gv.dot('digraph { a [style=filled, fillcolor="#ffe9b3", color="#123456"]; b [fontcolor="#e0936b"]; a -> b [color=gray, label="x"]; }', "svg");
  const out = themeClasses(svg);
  for (const m of out.matchAll(/<(polygon|path|ellipse|text)\b[^>]*>/g)) {
    const tag = m[0];
    const painted = /\s(fill|stroke)="(?!none|transparent)[^"]+"/.test(tag) || m[1] === "text";
    if (painted) expect(tag).toMatch(/class="[^"]*dg-[fs]-/);
  }
  expect(out).toContain("dg-f-c4t");
  expect(out).toContain("dg-f-c2");
});
