// The book cover, drawn as code. The build renders it into the home page as
// static markup, so the whole cover shows without script; landing/tilt.ts
// then makes it follow the pointer like a book held in the hand.
//
// The face is one of several drawings (landing/covers/), each a stack of SVG
// layers over one viewBox. Each layer is its own element so the tilt can move
// it on the compositor with a transform alone, shifting it by its depth as the
// book turns. Layers that could expose an edge while shifting draw past the
// viewBox, and the face clips them.
//
// Every color is a --cv-* custom property from the landing section of
// theme.css, redefined for the dark theme, so the static cover follows the
// reader's theme with no script. Around the face sit the spine, the page edges
// and a cast shadow, so the thickness of the book shows when it turns.

import type { Lang } from "../types.ts";
import { esc } from "../figures/lib/svg.ts";
import type { CoverData } from "./covers/lib.ts";
import { horizon } from "./covers/horizon.ts";

export { W as COVER_W, H as COVER_H } from "./covers/lib.ts";
export type { CoverData, CoverPart, Release } from "./covers/lib.ts";

// The drawings, by name: "horizon" is the first cover (planet, orbits, road).
// The name is the one switch: renderCover(lang, "stack") draws that cover, and the stylesheet keys
// its palette and the landing's accent off data-cover.
const COVERS = {
  horizon: (lang: Lang, _data: CoverData) => horizon(lang),
} satisfies Record<string, (lang: Lang, data: CoverData) => string>;

export type CoverVariant = keyof typeof COVERS;
export const COVER_VARIANTS = Object.keys(COVERS) as CoverVariant[];
export const DEFAULT_COVER: CoverVariant = "horizon";

export function isCoverVariant(v: string): v is CoverVariant {
  return v in COVERS;
}

const LABEL: Record<Lang, string> = {
  en: "Cover of AI as an Infrastructure, From Systems to Agents: History, Design Decisions, and Foundations, by Changkun Ou",
  zh: "《AI 基建：从系统到智能体：历史、设计与基石》封面，欧长坤 著",
};
const SPINE: Record<Lang, string> = { en: "AI as an Infrastructure", zh: "AI 基建" };

// The whole cover: the stage (the hover and tilt target), the cast shadow, and
// the book with its face, spine and page edges. data-cover names the drawing
// and marks the cover for the tilt runtime.
export function renderCover(lang: Lang, variant: CoverVariant = DEFAULT_COVER, data: CoverData = { parts: [], release: null }): string {
  const face = COVERS[variant](lang, data);
  return `<div class="cv" data-cover="${variant}" role="img" aria-label="${esc(LABEL[lang])}">`
    + `<div class="cv-shadow" aria-hidden="true"></div>`
    + `<div class="cv-book">`
    + `<div class="cv-spine" aria-hidden="true"><span>${esc(SPINE[lang])}</span></div>`
    + `<div class="cv-pages cv-pages-r" aria-hidden="true"></div><div class="cv-pages cv-pages-t" aria-hidden="true"></div><div class="cv-pages cv-pages-b" aria-hidden="true"></div>`
    + `<div class="cv-face">${face}<div class="cv-sheen" aria-hidden="true"></div></div>`
    + `</div></div>`;
}
