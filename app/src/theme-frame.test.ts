import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The reading frame is flat: regions are separated by 1 px rules, layout
// containers carry no radius or shadow, and overlays (popovers, drawers, the
// search dialog) are solid surfaces that occlude the article. A translucent,
// blurred overlay let headings read straight through the search box, and a
// live backdrop blur over scrolling text is the costly case for the compositor.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "theme.css"), "utf8");
const tsx = ["Reader.tsx", "comments.tsx", "account.tsx"].map((f) => readFileSync(resolve(here, f), "utf8")).join("\n");

const rule = (selector: string): string => {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

test("the reading view has no backdrop blur and no glass materials", () => {
  expect(css).not.toMatch(/backdrop-filter\s*:/);
  expect(tsx).not.toMatch(/backdropFilter/);
  expect(tsx).not.toMatch(/glass-|lq-/);
});

test("overlays are solid surfaces", () => {
  for (const sel of [".rdr-pop", ".rdr-drawer", ".rdr-dialog"]) {
    expect(rule(sel)).toContain("background: var(--bg-surface)");
  }
});

test("layout regions carry no radius; controls and the floating card stay at 4 to 6 px", () => {
  for (const sel of [".rdr-header", ".rdr-nav", ".rdr-main", ".rdr-drawer"]) {
    expect(rule(sel)).not.toContain("border-radius");
    expect(rule(sel)).not.toContain("box-shadow");
  }
  // "On this page" is a card sized to its list, not a full-height region.
  expect(rule(".rdr-toc")).not.toContain("box-shadow");
  for (const sel of [".rdr-btn", ".rdr-search", ".rdr-primary", ".rdr-pop", ".rdr-dialog", ".rdr-toc"]) {
    expect(rule(sel)).toMatch(/border-radius: var\(--radius-(sm|md)\)/);
  }
  expect(tsx).not.toMatch(/borderRadius: (999|1[0-9]|2[0-9])\b/);
});

// A solid button's label takes the surface color: the ink palette's dark
// accent is near-white, so a fixed white label vanished on the comment button.
test("solid accent buttons label in the surface color, not fixed white", () => {
  expect(tsx).not.toMatch(/background: primary \? "var\(--accent\)"[^}]*color: primary \? "#fff"/);
  expect(tsx).toMatch(/background: primary \? "var\(--accent\)" : "transparent",\s*color: primary \? "var\(--bg-surface\)"/);
});

// Both side columns are resizable from the rule they share with the article.
// The handle is a child of the fixed panel, not of the panel's scroller,
// which would clip it at the rule and scroll it away with the list.
test("both side columns keep a resize handle outside their scroller", () => {
  const reader = readFileSync(resolve(here, "Reader.tsx"), "utf8");
  expect(reader.match(/className="rdr-resize"/g)?.length).toBe(2);
  expect(reader).toMatch(/<aside className="rdr-toc"[^>]*>\s*\{onStartDrag && <div[^>]*className="rdr-resize"/);
  expect(reader).toMatch(/<aside className="rdr-nav"[^>]*>\s*\{list\}\s*\{onStartDrag && <div[^>]*className="rdr-resize"/);
  expect(rule(".rdr-toc")).not.toContain("overflow");
  expect(rule(".rdr-nav")).not.toContain("overflow");
});

// The reading-progress count sat in a box narrower than "100%", so the header
// items left of it, the search field among them, moved when it reached 100.
test("the progress count keeps one width from 0% to 100%", () => {
  const reader = readFileSync(resolve(here, "Reader.tsx"), "utf8");
  expect(reader).toContain('<span className="rdr-pct-label">{progressLabel}</span>');
  const w = rule(".rdr-pct-label").match(/width: ([\d.]+)ch/);
  expect(w).toBeTruthy();
  // "100%" is three tabular digits and a percent sign, under 4.5 ch.
  expect(parseFloat(w![1])).toBeGreaterThanOrEqual(4.5);
  expect(rule(".rdr-pct")).toContain("font-variant-numeric: tabular-nums");
});

// Lists were indented with a left margin, which the column's centering rule
// (margin-inline: auto on top-level blocks) replaced, so bullets hung outside
// the text and even left of the section heading.
test("lists indent with padding, which the column centering does not override", () => {
  const list = rule(".rdr-article ul, .rdr-article ol");
  expect(list).toContain("padding-left: 1.4em");
  expect(list).not.toMatch(/margin: [^;]* [^0 ;][^;]*em;/);
  expect(css).toContain(".reader .rdr-col .rdr-article > * { max-width: var(--measure); margin-left: auto; margin-right: auto; }");
});

// Callouts were tinted boxes with a colored left bar. They are ruled like a
// printed sidebar instead: rules above and below, nothing else.
test("callouts are ruled, without a fill, a side bar or a radius", () => {
  const box = rule(".rdr-callout");
  expect(box).toContain("border-top: 1px solid");
  expect(box).toContain("border-bottom: 1px solid");
  expect(box).not.toMatch(/border-left|background|border-radius|box-shadow/);
  expect(css).not.toMatch(/\.rdr-callout[\w-]* \{[^}]*border-left/);
});
