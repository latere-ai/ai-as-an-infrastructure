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
  expect(css).toMatch(/\.rdr-toc \{[^}]*position: sticky; top: var\(--hdr-h\);/);
});

test("anchors are native and land below the sticky header", () => {
  // No script pins the document or scrolls a container to the fragment.
  expect(reader).not.toMatch(/scrollingElement;\s*if \(se\) se\.scrollTop = 0/);
  expect(reader).not.toMatch(/addEventListener\("hashchange"/);
  expect(css).toMatch(/html \{[^}]*scroll-padding-top: calc\(var\(--hdr-h\) \+ 12px\)/);
});

test("reading progress and the active heading follow the window's scroll", () => {
  expect(reader).toMatch(/window\.addEventListener\("scroll", onScroll/);
  expect(reader).toMatch(/document\.scrollingElement/);
});

test("an open drawer or the search dialog holds the page still", () => {
  expect(reader).toContain("const overlayOpen = drawer || tocDrawer || searchOpen;");
  expect(reader).toContain('document.body.style.overflow = "hidden";');
});
