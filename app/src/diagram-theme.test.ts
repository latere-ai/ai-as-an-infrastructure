import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

test("mermaid diagrams inherit the reader theme instead of Mermaid's light fills", () => {
  expect(css).toMatch(/\.mermaid svg \.node rect,[\s\S]*fill:\s*var\(--bg-surface\)\s*!important/);
  expect(css).toMatch(/\.mermaid svg text,[\s\S]*fill:\s*var\(--fg-1\)\s*!important/);
  expect(css).toMatch(/\.mermaid svg foreignObject p \{[\s\S]*background-color:\s*var\(--bg\)\s*!important/);
  expect(css).toMatch(/\.mermaid svg \.edgePath \.path,[\s\S]*stroke:\s*var\(--fg-3\)\s*!important/);
});

test("dark mode remaps Graphviz inline SVG light fills and muted strokes", () => {
  expect(css).toContain(':root[data-theme="dark"] .rdr-diagram svg [fill="#f1ece1"]');
  expect(css).toContain(':root[data-theme="dark"] .rdr-diagram svg [fill="#ffffff"]');
  expect(css).toMatch(/\[fill="#f1ece1"\][\s\S]*fill:\s*var\(--bg-surface\)\s*!important/);
  expect(css).toMatch(/\[stroke="#6b7280"\][\s\S]*stroke:\s*var\(--fg-3\)\s*!important/);
});
