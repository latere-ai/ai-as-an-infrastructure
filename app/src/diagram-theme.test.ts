import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

test("mermaid diagrams inherit the reader theme instead of Mermaid's light fills", () => {
  expect(css).toMatch(/\.mermaid svg \.node rect,[\s\S]*fill:\s*var\(--bg-surface\)\s*!important/);
  expect(css).toMatch(/\.mermaid svg text,[\s\S]*fill:\s*var\(--fg-1\)\s*!important/);
  expect(css).toMatch(/\.mermaid svg \.edgePath \.path,[\s\S]*stroke:\s*var\(--fg-3\)\s*!important/);
});

test("dark mode keeps classDef-highlighted mermaid labels dark on their pastel fill", () => {
  // Mermaid writes classDef fills inline with !important, so a highlighted node
  // keeps its light pastel fill in dark mode; its label must not inherit the
  // light --fg-1 (which would vanish against the pastel). The fix targets such
  // nodes by the inline fill on their rect and forces the label dark.
  expect(css).toMatch(
    /:root\[data-theme="dark"\] \.mermaid svg \.node:has\(rect\[style\*="fill"\]\)[\s\S]*?color:\s*#1f2937\s*!important/,
  );
});

test("diagram labels are transparent-backed, never a solid box", () => {
  // A label foreignObject painted with var(--bg) drew a darker box that did not
  // match the content surface, on both node labels (inside the lighter node
  // fill) and edge labels (the reported regressions). Both must be transparent,
  // including the edge-label background rect mermaid inserts.
  const labelRule = css.match(/\.mermaid svg foreignObject,[\s\S]*?\}/)?.[0] ?? "";
  expect(labelRule).toContain(".edgeLabel p");
  expect(labelRule).toMatch(/background-color:\s*transparent\s*!important/);
  expect(labelRule).not.toMatch(/background-color:\s*var\(--bg\)/);
  expect(css).toMatch(/\.mermaid svg \.edgeLabel rect \{[^}]*fill:\s*transparent\s*!important/);
});

test("bare <figure> viz blocks get the same framing and muted caption as numbered figures", () => {
  // Interactive viz are authored as raw {=html} <figure> blocks, not the
  // pipeline's .rdr-figure; they must still read as proper figures.
  expect(css).toMatch(/\.rdr-article figure \{[^}]*text-align:\s*center/);
  expect(css).toMatch(/\.rdr-article figure figcaption \{[^}]*color:\s*var\(--fg-3\)/);
});

test("part-opening blockquotes render as pinned quote panels", () => {
  // Anchor to column zero: the glass layer adds a `.lq-reader .rdr-article
  // blockquote` radius override earlier in the file, and the mobile overrides
  // are indented inside a media query. Both would otherwise be matched first.
  const blockquoteRule = css.match(/^\.rdr-article blockquote \{[\s\S]*?\}/m)?.[0] ?? "";
  const quoteTextRule = css.match(/^\.rdr-article blockquote p:first-child \{[\s\S]*?\}/m)?.[0] ?? "";
  const quoteAttributionRule = css.match(/^\.rdr-article blockquote p:last-child \{[\s\S]*?\}/m)?.[0] ?? "";
  expect(blockquoteRule).toContain("position: relative");
  expect(blockquoteRule).toContain("border-left: 4px solid");
  expect(blockquoteRule).toContain("background: color-mix");
  expect(css).toMatch(/^\.rdr-article blockquote::after \{[\s\S]*?-webkit-mask:\s*url/m);
  expect(quoteTextRule).toContain("font-family: var(--font-serif)");
  expect(quoteTextRule).toContain("font-size: 1.55rem");
  expect(quoteAttributionRule).toContain("font-size: 1.2rem");
  expect(css).toMatch(/\.rdr-article blockquote p:last-child::before \{ content:\s*"-- "\s*; \}/);
});

test("graphviz diagram text uses the UI font so cluster labels are not serif", () => {
  // Graphviz renders cluster/graph labels in its Times default; force the UI
  // font on all diagram text so labels match the surrounding prose.
  expect(css).toMatch(/\.rdr-diagram svg text \{[^}]*font-family:\s*var\(--font-ui\)\s*!important/);
});

test("graphviz diagrams keep their intrinsic width inside horizontal scroll", () => {
  // Wide DOT figures were made unreadable on narrow screens because the global
  // responsive SVG rule shrank them before the .rdr-diagram scroller could work.
  const diagramRule = css.match(/\.rdr-diagram \{[^}]*\}/)?.[0] ?? "";
  const graphvizSvgRule = css.match(/\.rdr-diagram svg \{[^}]*\}/)?.[0] ?? "";
  expect(diagramRule).toContain("overflow-x: auto");
  expect(graphvizSvgRule).toContain("flex: none");
  expect(graphvizSvgRule).toContain("max-width: none");
  expect(graphvizSvgRule).not.toContain("max-width: 100%");
});

test("dark mode remaps Graphviz inline SVG light fills and muted strokes", () => {
  expect(css).toContain(':root[data-theme="dark"] .rdr-diagram svg [fill="#f1ece1"]');
  expect(css).toContain(':root[data-theme="dark"] .rdr-diagram svg [fill="#ffffff"]');
  expect(css).toMatch(/\[fill="#f1ece1"\][\s\S]*fill:\s*var\(--bg-surface\)\s*!important/);
  expect(css).toMatch(/\[stroke="#6b7280"\][\s\S]*stroke:\s*var\(--fg-3\)\s*!important/);
});
