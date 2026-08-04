import { test, expect } from "bun:test";
import { renderDot, withNodeMargin } from "./diagrams.ts";

// Graphviz's default node margin crowds multi-line labels against rounded/filled
// box borders. withNodeMargin injects a roomier default right after the graph's
// opening brace, so every {dot} diagram gets breathing room from one knob.

test("injects a default node margin after the graph opening brace", () => {
  const out = withNodeMargin('digraph {\n  a -> b;\n}');
  expect(out).toBe('digraph {\n  node [margin="0.2,0.12"];\n  a -> b;\n}');
});

test("handles named, strict, and undirected graph headers", () => {
  for (const header of ["digraph G {", "strict digraph {", "graph {"]) {
    expect(withNodeMargin(`${header}\n}`)).toContain('node [margin="0.2,0.12"];');
    // margin lands inside the graph, immediately after the brace.
    expect(withNodeMargin(`${header}\n}`).indexOf("margin")).toBeGreaterThan(
      header.length - 1,
    );
  }
});

test("leaves non-graph input untouched", () => {
  expect(withNodeMargin("not a graph")).toBe("not a graph");
});

test("Graphviz SVGs expose the figure caption as an accessible name", () => {
  const graphviz = {
    dot: () => '<?xml version="1.0"?><svg width="10pt" height="10pt"><g></g></svg>',
  } as any;
  const code = [
    "//| label: fig-path",
    '//| fig-cap: "Artifact & kernel compatibility."',
    "digraph { A -> B }",
  ].join("\n");
  const html = renderDot(graphviz, code, new Map(), "chapter.html", "../");

  expect(html).toContain('<svg role="img" aria-label="Artifact &amp; kernel compatibility."');
});
