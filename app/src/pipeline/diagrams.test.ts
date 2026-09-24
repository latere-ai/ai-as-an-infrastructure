import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { CATEGORICAL_HEX, colorRole, themeClasses } from "./diagram-color.ts";
import { mirrorVertically, nodeCenters, orderReversed } from "./diagram-geometry.ts";
import { LAYOUT_FONT, prepareDot, wrapLine } from "./diagram-source.ts";
import { layoutDot, loadGraphviz, MIN_TEXT_PX, PHONE_COLUMN_PX, renderDot } from "./diagrams.ts";

const gv = await loadGraphviz();
const svgsOf = (html: string): string[] => html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
const styleOf = (svg: string) => {
  const m = svg.match(/^<svg[^>]*style="max-width:([\d.]+)px;min-width:([\d.]+)px"/);
  return m ? { max: Number(m[1]), min: Number(m[2]) } : null;
};

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
  const svg = gv.dot(out, "svg");
  expect(svg).toMatch(/transform="scale\(1 1\)/);
});

test("Graphviz SVGs expose the figure caption as an accessible name", () => {
  const code = [
    "//| label: fig-path",
    '//| fig-cap: "Artifact & kernel compatibility."',
    "digraph { A -> B }",
  ].join("\n");
  const html = renderDot(gv, code, new Map(), "chapter.html", "../");
  expect(html).toContain('role="img" aria-label="Artifact &amp; kernel compatibility."');
});

test("an SVG may scale down only until its smallest text reaches the minimum size", () => {
  const html = renderDot(gv, "digraph { node [fontsize=9]; a -> b; }", new Map(), "x", "");
  const svg = svgsOf(html)[0] ?? "";
  const s = styleOf(svg)!;
  const width = Number(svg.match(/^<svg[^>]*\swidth="([\d.]+)"/)![1]);
  expect(s.max).toBe(width);
  // 9 pt text is 12 px at natural size.
  expect(s.min).toBeCloseTo(width * (MIN_TEXT_PX / 12), 1);
  expect(svg).not.toMatch(/^<svg[^>]*\swidth="[\d.]+pt"/);
});

test("a diagram that fits the phone column ships one layout", () => {
  const html = renderDot(gv, "digraph { a -> b -> c; }", new Map(), "x", "");
  expect(svgsOf(html)).toHaveLength(1);
  expect(html).not.toContain("rdr-dg-narrow");
});

test("a diagram too wide for the phone column also ships a narrower layout", () => {
  const nodes = Array.from({ length: 5 }, (_, i) => `n${i} [label="a fairly long label number ${i}"]`).join("; ");
  const edges = Array.from({ length: 5 }, (_, i) => `r -> n${i}`).join("; ");
  const html = renderDot(gv, `digraph { ${nodes}; ${edges}; }`, new Map(), "x", "");
  const svgs = svgsOf(html);
  expect(svgs).toHaveLength(2);
  expect(svgs[0]).toContain('class="rdr-dg-wide"');
  expect(svgs[1]).toContain('class="rdr-dg-narrow"');
  const [wide, narrow] = svgs.map((svg) => styleOf(svg)!);
  expect(narrow!.min).toBeLessThanOrEqual(PHONE_COLUMN_PX);
  expect(narrow!.min).toBeLessThan(wide!.min);
});

test("narrow layouts skip record labels, whose wrapped form crashes Graphviz", () => {
  const src = 'digraph { rankdir=TB; Q [label="Hard requirements Q with a long name"]; G [shape=record, label="{confirmed | eligible}|{refuted | ineligible}|{unknown | unresolved}|{another | column}"]; Q -> G; }';
  expect(prepareDot(src, { wrapEm: 9 })).toContain('label="{confirmed | eligible}|{refuted | ineligible}');
  expect(() => layoutDot(gv, src)).not.toThrow();
});

test("wrapped label lines are balanced and never leave a one-character word alone", () => {
  expect(wrapLine("short", 9)).toEqual(["short"]);
  expect(wrapLine("change loss shape", 9)).toEqual(["change", "loss shape"]);
  expect(wrapLine("prompt + preferred + rejected", 9)).toEqual(["prompt +", "preferred +", "rejected"]);
  for (const line of wrapLine("sample response y store rollout", 5.5)) expect(line.trim().length).toBeGreaterThan(1);
  // CJK text breaks between glyphs, not inside a Latin word.
  const zh = wrapLine("学习到的动力学下一状态和奖励", 9);
  expect(zh.join("")).toBe("学习到的动力学下一状态和奖励");
  expect(zh.length).toBe(2);
  expect(wrapLine("预测 KV cache 大小", 4).some((l) => l.includes("KV") && !l.includes("K V"))).toBe(true);
});

test("colors map to theme roles by job, for any color", () => {
  expect(colorRole("#f1ece1", "fill")).toBe("panel");
  expect(colorRole("#ffffff", "fill")).toBe("paper");
  expect(colorRole("white", "fill")).toBe("paper");
  expect(colorRole("#6b7280", "stroke")).toBe("ink3");
  expect(colorRole("#6b7280", "text")).toBe("ink2");
  expect(colorRole("#374151", "text")).toBe("ink2");
  expect(colorRole("#374151", "stroke")).toBe("ink2");
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

test("a flipped layout of separate components is mirrored back into reading order", () => {
  // rankdir=LR stacks separate components bottom to top, so a row that read
  // Q1 Q2 Q3 left to right came out with Q3 on top.
  const src = "digraph { node [shape=box]; q1 -> k1; q2 -> k2; q3 -> k3; }";
  const tb = gv.dot(prepareDot(src), "svg");
  const lr = gv.dot(prepareDot(src, { flip: true, invertLabels: true }), "svg");
  expect(orderReversed(tb, lr)).toBe(true);
  const fixed = nodeCenters(mirrorVertically(lr));
  expect(fixed.get("q1")!.y).toBeLessThan(fixed.get("q2")!.y);
  expect(fixed.get("q2")!.y).toBeLessThan(fixed.get("q3")!.y);
  // Labels move with their boxes.
  const label = mirrorVertically(lr).match(/<g id="node1" class="node">[\s\S]*?<\/g>/)![0];
  const y = Number(label.match(/<text[^>]*\sy="(-?[\d.]+)"/)![1]);
  const box = [...label.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
  expect(y).toBeGreaterThan(Math.min(...box));
  expect(y).toBeLessThan(Math.max(...box));
  // A connected fan keeps its order without mirroring.
  const fan = "digraph { r -> a; r -> b; r -> c; }";
  expect(orderReversed(gv.dot(prepareDot(fan), "svg"), gv.dot(prepareDot(fan, { flip: true }), "svg"))).toBe(false);
});
