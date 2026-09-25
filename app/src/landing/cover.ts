// The book, drawn as code. The build renders it into the home page as static
// markup, so the front cover shows without script; landing/tilt.ts then makes
// it follow the pointer like a book held in the hand, and turns it over to
// the back cover on a click, a tap, Enter or Space.
//
// The front is "the stack" (covers/stack.ts), a cross-section of the book's
// parts; the back is "the drawing" (covers/drawing.ts), an engineering sheet
// whose title block carries the author, publisher, edition and date. Each
// face is a stack of SVG layers over one viewBox, each layer its own element
// so the tilt can move it on the compositor with a transform alone, shifting
// it by its depth as the book turns. Layers that could expose an edge while
// shifting draw past the viewBox, and the face clips them.
//
// Every color is a --cv-* custom property from the landing section of
// theme.css, redefined for the dark theme, so the static cover follows the
// reader's theme with no script. Around the faces sit the spine, the page
// edges and a cast shadow, so the thickness of the book shows when it turns.

import type { Lang } from "../types.ts";
import { esc } from "../figures/lib/svg.ts";
import type { CoverData } from "./covers/lib.ts";
import { stack } from "./covers/stack.ts";
import { drawingCover } from "./covers/drawing.ts";

export { W as COVER_W, H as COVER_H } from "./covers/lib.ts";
export type { CoverData, CoverPart, Release } from "./covers/lib.ts";

const TEXT: Record<Lang, { label: string; turn: string; spine: string }> = {
  en: {
    label: "Cover of AI as an Infrastructure, From Systems to Agents: History, Design Decisions, and Foundations, by Changkun Ou",
    turn: "Turn the book over",
    spine: "AI as an Infrastructure",
  },
  zh: {
    label: "《AI 基建：从系统到智能体：历史、设计与基石》封面，欧长坤 著",
    turn: "翻到封底",
    spine: "AI 基建",
  },
};

// The whole book: the stage (the hover, tilt and turn target), the cast
// shadow, and the book with its two faces, spine and page edges. data-cover
// marks it for the runtime, which makes it a button labeled data-turn-label.
export function renderCover(lang: Lang, data: CoverData = { parts: [], release: null }): string {
  const t = TEXT[lang];
  const sheen = `<div class="cv-sheen" aria-hidden="true"></div>`;
  return `<div class="cv" data-cover role="img" aria-label="${esc(t.label)}" data-turn-label="${esc(t.turn)}">`
    + `<div class="cv-shadow" aria-hidden="true"></div>`
    + `<div class="cv-book">`
    + `<div class="cv-spine" aria-hidden="true"><span>${esc(t.spine)}</span></div>`
    + `<div class="cv-pages cv-pages-r" aria-hidden="true"></div><div class="cv-pages cv-pages-t" aria-hidden="true"></div><div class="cv-pages cv-pages-b" aria-hidden="true"></div>`
    + `<div class="cv-face cv-front">${stack(lang, data)}${sheen}</div>`
    + `<div class="cv-face cv-back" aria-hidden="true">${drawingCover(lang, data)}${sheen}</div>`
    + `</div></div>`;
}
