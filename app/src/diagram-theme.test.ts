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

test("graphviz diagrams scale with the column instead of keeping their natural width", () => {
  // `flex: none; max-width: none` showed every SVG at its natural width inside
  // a horizontal scroller, so 34 diagrams scrolled sideways at 390 px. The SVG
  // now takes the column width, bounded by the inline max-width (natural size)
  // and min-width (smallest text at 11 px) the build writes on it.
  const diagramRule = css.match(/\.rdr-diagram \{[^}]*\}/)?.[0] ?? "";
  const graphvizSvgRule = css.match(/\.rdr-diagram svg \{[^}]*\}/)?.[0] ?? "";
  expect(diagramRule).toContain("overflow-x: auto");
  expect(graphvizSvgRule).toContain("width: 100%");
  expect(graphvizSvgRule).not.toContain("max-width: none");
  expect(css).not.toMatch(/\.rdr-diagram svg \{[^}]*flex:\s*none/);
});

test("graphviz captions take the column width, not the diagram's", () => {
  // A shrink-to-fit figure wrapped a narrow diagram's caption to two or three
  // words per line.
  for (const rule of css.matchAll(/([^{}]*)\{[^}]*width:\s*(?:fit-content|0)\b[^}]*\}/g)) {
    expect(rule[1]).not.toContain(".rdr-diagram");
  }
});

test("graphviz colors come from theme tokens by class, not a list of hex values", () => {
  // Dark mode remapped about ten literal fills; any other color stayed light.
  expect(css).not.toMatch(/\.rdr-diagram[^{]*\[(?:fill|stroke)="#/);
  const roles = ["paper", "panel", "ink", "ink2", "ink3", ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [`c${i}`, `c${i}t`])];
  for (const role of roles) {
    expect(css).toMatch(new RegExp(`\\.rdr-diagram svg \\.dg-f-${role} \\{ fill: var\\(--(?:fig|dg)-`));
    expect(css).toMatch(new RegExp(`\\.rdr-diagram svg \\.dg-s-${role} \\{ stroke: var\\(--(?:fig|dg)-`));
  }
  for (let i = 1; i <= 8; i++) expect(css).toContain(`--dg-c${i}t: color-mix(in srgb, var(--fig-c${i}) 18%, var(--fig-paper));`);
});

test("graphviz edge labels carry a paper halo so the shaft does not run through them", () => {
  expect(css).toMatch(/\.rdr-diagram svg g\.edge text \{[^}]*paint-order:\s*stroke;[^}]*stroke:\s*var\(--fig-paper\)/);
});
