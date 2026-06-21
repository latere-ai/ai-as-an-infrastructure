// Regression guard for the fixed-height app shell: only <main> may scroll, so
// the document must be locked. Without this, a 100vh-shell-vs-100%-body delta
// (e.g. always-visible OS scrollbars) or scroll-chaining off <main>'s end drags
// the whole shell (sticky header included) off-screen, leaving blank gaps and a
// page that can't scroll back to the top. See deep-link reports on long chapters.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
const reader = readFileSync(new URL("../Reader.tsx", import.meta.url), "utf8");

test("the document viewport is locked so the app shell cannot scroll", () => {
  // html, body must hide overflow; the shell is 100vh and only <main> scrolls.
  expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*hidden/);
});

test("<main> contains its overscroll so it does not chain to the document", () => {
  expect(reader).toMatch(/overscrollBehavior:\s*"contain"/);
});

test("the mermaid tooltip is pinned out of flow so it adds no scrollable height", () => {
  // mermaid.run() appends a <div.mermaidTooltip> to <body>, positioned absolute
  // inline at the bottom; without this it adds a few px of document overflow.
  expect(css).toMatch(/\.mermaidTooltip\s*\{[^}]*position:\s*fixed\s*!important/);
});
