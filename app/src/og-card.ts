// The social-share card template (Open Graph / Twitter "summary_large_image"):
// one self-contained 1200 x 630 HTML page per card, which og.ts screenshots
// with headless Chrome. The page inlines the reader's stylesheet under the
// default ink palette, so the card takes its colors, fonts and the drawn cover
// (landing/cover.ts) from the site itself.
//
// Link previews show the image two ways. X and LinkedIn show all of it at
// 1.91:1; Slack shows a thumbnail cropped to the center 630 x 630 square. So
// what identifies the page sits in that square (the cover on the home card,
// the part, chapter number and title on a chapter card), and the rest (title
// page, author, address) sits in the margins either side, which only the full
// previews show.

import type { Lang } from "./types.ts";
import { BASE, OG_W, OG_H } from "./site.ts";
import { partTitle, titleLines } from "./landing/landing.ts";

const SITE_HOST = new URL(BASE).host;

// The center square Slack keeps, and the widest a chapter title is set in it.
const SQUARE_X = (OG_W - OG_H) / 2;
const TITLE_W = 560;

export interface HomeCard {
  kind: "home";
  title: string; // "AI as an Infrastructure"
  subtitle: string;
  author: string;
}

export interface ChapterCard {
  kind: "chapter";
  label: string; // "Part IX · Chapter 67"; the book's title for back matter
  title: string;
  author: string;
}

export type Card = HomeCard | ChapterCard;

// The chapter fields a card reads, as the book manifest gives them.
export interface CardChapter {
  partLabel: string;
  num: string;
  title: string;
  role: "chapter" | "part";
}

const LABEL: Record<Lang, { part: (label: string) => string; chapter: (n: string) => string; summary: string }> = {
  en: {
    part: (label) => label.split(":")[0].trim(), // "Part IX: Infrastructure and Compute" → "Part IX"
    chapter: (n) => `Chapter ${n}`,
    summary: "Summary",
  },
  zh: {
    part: (label) => label.split(" · ")[0].trim(), // "第九部分 · 基础设施与算力" → "第九部分"
    chapter: (n) => `第 ${n} 章`,
    summary: "小结",
  },
};

// The label and title a chapter's card sets. A part's opening page carries the
// part's name as its title, so the label holds only the part number; a part
// summary is labeled as one and titled with the part it closes, since
// "Summary" alone says nothing in a feed. Pages outside the parts (the
// Epilogue, the Glossary) are labeled with the book.
export function chapterCard(ch: CardChapter, lang: Lang, book: string, author: string): ChapterCard {
  const t = LABEL[lang];
  if (!ch.partLabel) return { kind: "chapter", label: book, title: ch.title, author };
  const part = t.part(ch.partLabel);
  if (ch.role === "part") return { kind: "chapter", label: part, title: partTitle(ch.partLabel), author };
  if (ch.num) return { kind: "chapter", label: `${part} · ${t.chapter(ch.num)}`, title: ch.title, author };
  if (ch.title === t.summary) return { kind: "chapter", label: `${part} · ${t.summary}`, title: partTitle(ch.partLabel), author };
  return { kind: "chapter", label: part, title: ch.title, author };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">`;

const CARD_CSS = `
html { scrollbar-gutter: auto; }
html, body { width: ${OG_W}px; height: ${OG_H}px; overflow: hidden; background: var(--bg); }
body { position: relative; font-family: var(--font-ui); color: var(--fg-1); }
/* The book in the pose the home page rests it in, without the cast shadow,
   the sheen and the hinge shading, which are gradients. */
.og .cv-shadow, .og .cv-sheen, .og .cv-face::after { display: none; }
.og-imprint { font: 600 13px/1 var(--font-ui); letter-spacing: .34em; color: var(--cv-acc); }
.og-meta { font: 500 19px/1.4 var(--font-ui); color: var(--fg-2); }
.og-meta b { display: block; font-weight: 600; color: var(--fg-1); }

/* Home: the book fills the height of the center square; the title page
   stands to its left and the address to its right, on the author's line,
   both clear of the square so its crop shows no cut-off type. */
.og-home .og-book { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.og-home .og-book .cv { width: 384px; }
.og-home .og-row { position: absolute; left: 56px; right: 64px; top: 50%; transform: translateY(-50%); display: flex; justify-content: space-between; align-items: flex-end; }
.og-home .og-left { width: ${SQUARE_X - 56 - 16}px; }
.og-home .og-title { margin-top: 22px; font: 400 46px/.98 var(--font-serif); letter-spacing: -.012em; color: var(--fg-1); }
.og-home .og-title > span { display: block; }
.og-home .og-sub { margin-top: 16px; font: 400 19px/1.3 var(--font-serif); color: var(--fg-2); }
.og-home .og-author { margin-top: 24px; font: 500 19px/1.4 var(--font-ui); color: var(--fg-1); }
.og-home .og-author::before { content: ""; display: block; width: 36px; height: 2px; margin-bottom: 14px; background: var(--cv-acc); }
:lang(zh) .og-home .og-title { font-family: var(--font-serif), var(--cv-song); font-weight: 600; font-synthesis-weight: none; font-size: 60px; line-height: 1.02; letter-spacing: .01em; }
:lang(zh) .og-home .og-sub { font-family: var(--cv-song); font-size: 17px; line-height: 1.6; letter-spacing: .08em; }

/* Chapter: label and title centered in the square; the book and the byline
   in the margins. */
.og-chapter .og-center { position: absolute; left: ${SQUARE_X}px; width: ${OG_H}px; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.og-chapter .og-label { font: 600 16px/1.2 var(--font-ui); letter-spacing: .2em; text-transform: uppercase; color: var(--cv-acc); margin-bottom: 30px; }
:lang(zh) .og-chapter .og-label { letter-spacing: .16em; }
.og-chapter .og-title { max-width: ${TITLE_W}px; font: 400 100px/1.04 var(--font-serif); letter-spacing: -.01em; color: var(--fg-1); text-wrap: balance; }
:lang(zh) .og-chapter .og-title { font-family: var(--font-serif), var(--cv-song); font-weight: 600; font-synthesis-weight: none; line-height: 1.22; letter-spacing: .04em; line-break: strict; }
.og-chapter .og-book { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); }
.og-chapter .og-book .cv { width: 150px; }
/* At this size the strata hatching is finer than a pixel and rasterizes into
   moire bands; the thumbnail keeps the strata lines and the red path. */
.og-chapter .cv-l-strata path[fill^="url("] { display: none; }
.og-chapter .og-right { position: absolute; right: 64px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; text-align: right; }
`;

// Shrinks a chapter title from its largest size until it sits within four
// lines of the square and its longest word fits the measure (words are never
// broken), so a short title reads from a thumbnail and a long one still fits.
const FIT = `<script>
document.fonts.ready.then(() => {
  const el = document.querySelector(".og-chapter .og-title");
  if (!el) return;
  const line = parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize);
  for (let px = 100; px >= 40; px -= 2) {
    el.style.fontSize = px + "px";
    if (el.scrollWidth <= ${TITLE_W} && el.offsetHeight <= Math.min(4 * px * line + 1, 360)) break;
  }
});
</script>`;

// One card as a standalone page. `css` is the reader stylesheet (theme.css)
// and `cover` the book as landing/cover.ts draws it for `lang`.
export function cardHtml(card: Card, lang: Lang, css: string, cover: string): string {
  const body = card.kind === "home"
    ? `<main class="og og-home">`
      + `<div class="og-book">${cover}</div>`
      + `<div class="og-row"><div class="og-left"><p class="og-imprint">LATERE.AI</p>`
      + `<h1 class="og-title">${titleLines(card.title, lang)}</h1>`
      + `<p class="og-sub">${esc(card.subtitle)}</p>`
      + `<p class="og-author">${esc(card.author)}</p></div>`
      + `<p class="og-meta">${SITE_HOST}</p></div>`
      + `</main>`
    : `<main class="og og-chapter">`
      + `<div class="og-book">${cover}</div>`
      + `<div class="og-center"><p class="og-label">${esc(card.label)}</p>`
      + `<h1 class="og-title">${esc(card.title)}</h1></div>`
      + `<div class="og-right og-meta"><b>${esc(card.author)}</b>${SITE_HOST}</div>`
      + `</main>${FIT}`;
  return `<!DOCTYPE html><html lang="${lang === "zh" ? "zh-Hans" : "en"}" data-theme="light" data-palette="ink"><head><meta charset="utf-8">
${FONTS}
<style>${css}</style><style>${CARD_CSS}</style></head>
<body>${body}</body></html>`;
}
