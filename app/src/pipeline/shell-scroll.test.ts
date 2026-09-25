// Guard for the reader's scroll model: the document is the scroll container.
// The window scrolls the article, so elastic overscroll, scroll restoration,
// #fragment links and find-in-page are the browser's own; the header and the
// side columns are sticky. An earlier fixed-height shell scrolled an inner
// <main> and locked the document, which lost all four and needed a script to
// re-implement anchor scrolling.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
const reader = readFileSync(new URL("../Reader.tsx", import.meta.url), "utf8");
const tsx = reader + readFileSync(new URL("../comments.tsx", import.meta.url), "utf8");

test("the document is not locked, so the window scrolls the page", () => {
  expect(css).not.toMatch(/html,\s*body\s*\{[^}]*overflow:\s*hidden/);
  expect(css).not.toMatch(/html,\s*body\s*\{[^}]*height:\s*100%/);
  expect(css).not.toMatch(/overscroll-behavior:\s*none/);
  expect(reader).not.toMatch(/overscrollBehavior:\s*"none"/);
  expect(reader).not.toMatch(/overflowY:\s*"auto"[^}]*borderRadius: 28/);
});

test("the header and side columns are sticky; only the nav scrolls within itself", () => {
  expect(css).toMatch(/\.rdr-header \{[^}]*position: sticky; top: 0;/);
  expect(css).toMatch(/\.rdr-nav \{[^}]*position: sticky; top: var\(--hdr-h\);[^}]*height: calc\(100vh - var\(--hdr-h\)\)/);
  expect(css).toMatch(/\.rdr-nav-scroll \{[^}]*overflow-y: auto; overscroll-behavior: contain;/);
  expect(css).toMatch(/\.rdr-toc \{[^}]*position: sticky; top: calc\(var\(--hdr-h\) \+ var\(--toc-gap\)\);[^}]*max-height: calc\(100vh - var\(--hdr-h\) - 2 \* var\(--toc-gap\)\)/);
});

test("anchors are native and land below the sticky header", () => {
  // No script pins the document or scrolls a container to the fragment.
  expect(reader).not.toMatch(/scrollingElement;\s*if \(se\) se\.scrollTop = 0/);
  expect(reader).not.toMatch(/addEventListener\("hashchange"/);
  expect(css).toMatch(/html \{[^}]*scroll-padding-top: calc\(var\(--hdr-h\) \+ 12px\)/);
  // The root's scroll-padding is the one offset. A target's scroll-margin adds
  // to it, so a heading with both lands twice as far below the header.
  expect(css).not.toMatch(/scroll-margin-top/);
  expect(tsx).not.toMatch(/scrollMarginTop/);
});

// With the document as the scroller, anything wider than the viewport pans the
// whole page sideways. KaTeX keeps an absolutely positioned MathML copy next to
// each formula; inside a table that scrolls sideways, it escapes the scroller
// unless the scroller is positioned, and widened phone pages by ~30 px.
test("sideways scrollers contain absolutely positioned descendants", () => {
  expect(css).toMatch(/\n\.table-scroll \{ position: relative; overflow-x: auto;/);
  expect(css).toMatch(/\.katex-display \{ position: relative; overflow-x: auto;/);
});

test("reading progress and the active heading follow the window's scroll", () => {
  expect(reader).toMatch(/window\.addEventListener\("scroll", onScroll/);
  expect(reader).toMatch(/document\.scrollingElement/);
});

test("an open drawer or the search dialog holds the page still", () => {
  expect(reader).toContain("const overlayOpen = drawer || tocDrawer || searchOpen;");
  expect(reader).toContain('document.body.style.overflow = "hidden";');
});

// Screenshot clips are in page coordinates. With the document as the scroller
// a figure's viewport position is off by the scroll offset, and the figure
// shots came out blank until the script added it.
test("figure shots clip in page coordinates", () => {
  const shots = readFileSync(new URL("../../scripts/figure-shots.ts", import.meta.url), "utf8");
  expect(shots).toMatch(/x: r\.left \+ scrollX, y: r\.top \+ scrollY/);
});
