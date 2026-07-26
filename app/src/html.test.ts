// The page <head> must carry Open Graph + Twitter Card tags so links unfurl as
// rich cards on Slack/LinkedIn/Twitter/Substack, and the card must be English
// even on zh pages (the user-facing requirement). These assert the contract the
// social scrapers read: declared image dimensions match the generated PNG, text
// is HTML-escaped, and zh pages emit the English share text, not their own.

import { test, expect } from "bun:test";
import { page } from "./html.ts";
import { OG_W, OG_H, SITE_DESCRIPTION, SITE_NAME } from "./site.ts";
import type { ChapterData } from "./types.ts";

const base: ChapterData = {
  lang: "en", partLabel: "Part I: Base Model Formation", partShort: "Part I", chapterNum: "3",
  isPartIntro: false, eyebrow: "Part I · Chapter 3", crumbChapter: "Chapter 3",
  title: "Scaling Laws & Compute", author: "Changkun Ou", updated: "2026-06-01",
  readtime: "~14 min", contentHtml: "<p>body</p>", headings: [], prev: null, next: null,
  langHref: "../zh/p1/03", prefix: "../", path: "p1-foundations/03-scaling-laws",
  description: "First paragraph snippet.", toc: [],
};
const render = (ch: ChapterData, share?: Parameters<typeof page>[0]["share"]) =>
  page({ chapter: ch, bodyHtml: "<main></main>", css: "", clientHref: "reader.js", share });

test("emits Open Graph + Twitter Card tags with matching declared dimensions", () => {
  const html = render(base, { title: base.title, description: base.description, imageUrl: "https://aaai.latere.ai/og/p1-foundations/03-scaling-laws.png" });
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html).toContain('<meta property="og:type" content="article">');
  expect(html).toContain('<meta property="og:image" content="https://aaai.latere.ai/og/p1-foundations/03-scaling-laws.png">');
  expect(html).toContain(`<meta property="og:image:width" content="${OG_W}">`);
  expect(html).toContain(`<meta property="og:image:height" content="${OG_H}">`);
  expect(html).toContain('<meta name="twitter:image" content="https://aaai.latere.ai/og/p1-foundations/03-scaling-laws.png">');
});

test("escapes ampersands in the card title so the meta tag stays valid", () => {
  const html = render(base, { title: base.title, description: base.description, imageUrl: "x" });
  expect(html).toContain('<meta property="og:title" content="Scaling Laws &amp; Compute">');
  expect(html).not.toContain('content="Scaling Laws & Compute"');
});

test("a zh page unfurls the English card text, not its own", () => {
  const zh: ChapterData = { ...base, lang: "zh", title: "缩放定律", description: "中文摘要。" };
  const html = render(zh, { title: "Scaling Laws & Compute", description: "First paragraph snippet.", imageUrl: "https://aaai.latere.ai/og/p1-foundations/03-scaling-laws.png" });
  expect(html).toContain('<meta property="og:title" content="Scaling Laws &amp; Compute">');
  expect(html).toContain('<meta property="og:description" content="First paragraph snippet.">');
  expect(html).toContain('<meta property="og:locale" content="en_US">');
  // the page's own <title>/lang stay Chinese for the browser + SEO
  expect(html).toContain('<html lang="zh-Hans" data-theme="light" data-palette="ink" data-layout="codex">');
  expect(html).toContain("<title>缩放定律 · AI as an Infrastructure</title>");
  // but the card never shows the Chinese title
  expect(html).not.toContain('property="og:title" content="缩放定律"');
});

test("applies the saved theme on <html> via a blocking head script before the body, so a reloaded dark reader does not flash light", () => {
  const html = render(base);
  // the no-flash script reads the persisted settings key and sets the attributes
  // the CSS now keys off (<html data-theme/data-palette>), not React state.
  expect(html).toContain('localStorage.getItem("aaai-reader-settings")');
  expect(html).toContain('d.setAttribute("data-theme",s.theme)');
  expect(html).toContain('d.setAttribute("data-palette",s.palette)');
  // it must run before the body paints: the <script> sits inside <head>, ahead of
  // the <div id="root"> shell the browser would otherwise paint in the default theme.
  const scriptAt = html.indexOf("aaai-reader-settings");
  const headEnd = html.indexOf("</head>");
  const rootAt = html.indexOf('<div id="root">');
  expect(scriptAt).toBeGreaterThan(-1);
  expect(scriptAt).toBeLessThan(headEnd);
  expect(headEnd).toBeLessThan(rootAt);
});

test("the home page is og:type website and points at /og/index.png", () => {
  const home: ChapterData = { ...base, title: "AI as an Infrastructure", path: "", chapterNum: "" };
  const html = render(home); // no share → falls back to derived index image
  expect(html).toContain('<meta property="og:type" content="website">');
  expect(html).toContain('<meta property="og:image" content="https://aaai.latere.ai/og/index.png">');
});

test("the home page shares as the book, not as Preface", () => {
  const home: ChapterData = { ...base, title: "Preface", path: "", chapterNum: "" };
  const html = render(home, { title: "Preface", description: "Preface excerpt.", imageUrl: "https://aaai.latere.ai/og/index.png" });
  expect(html).toContain(`<title>${SITE_NAME}</title>`);
  expect(html).toContain(`<meta property="og:title" content="${SITE_NAME}">`);
  expect(html).toContain(`<meta property="og:description" content="${SITE_DESCRIPTION}">`);
  expect(html).not.toContain('property="og:title" content="Preface"');
});
