// Cover concept "The stack": a geological cross-section of thirteen strata,
// one per part of the book, from compute at the bottom to governed behavior
// at the top, each labeled with its part number. One line in the accent
// color threads up through them: the path a capability takes. The strata are
// told apart by hatching alone, in the reader's ink.

import type { Lang } from "../../types.ts";
import { esc, r } from "../../figures/lib/svg.ts";
import { layer, smooth, T, txt, wrap, type CoverData, type CoverPart } from "./lib.ts";

// The parts in the order the stack builds up, by part number. The orientation
// part is the bedrock the rest sits on, the infrastructure that came before;
// the capability's path starts in compute and ends in governed behavior.
const STACK_ORDER = ["0", "IX", "I", "II", "III", "IV", "V", "VI", "VII", "X", "XII", "XI", "VIII"];
const THICKNESS = [58, 50, 40, 47, 36, 44, 50, 38, 45, 34, 42, 40, 48];

const X0 = 48, X1 = 404, TOP = 340, BOTTOM = 912;
const SAMPLE_X = [X0, 137, 226, 315, X1];

const TEXT: Record<Lang, { section: string; axis: string; path: string; author: string; subtitle: string }> = {
  en: {
    section: "SECTION A–A",
    axis: "FROM COMPUTE TO GOVERNED BEHAVIOR",
    path: "A capability’s path",
    author: "Changkun Ou",
    subtitle: "From Systems to Agents: History, Design Decisions, and Foundations",
  },
  zh: {
    section: "剖面 A–A",
    axis: "从算力到受治理的行为",
    path: "一项能力的路径",
    author: "欧长坤 著",
    subtitle: "从系统到智能体：历史、设计与基石",
  },
};

// Hatches, bottom stratum first: [width, height, rotation, content]. Lines use
// .cv-hatch and dots .cv-hatch-dot, both in the ink color.
const HATCH: Array<[number, number, number, string]> = [
  [5, 5, 45, `<path d="M0 0V5M0 0H5"/>`],
  [3, 3, 45, `<path d="M0 0V3"/>`],
  [5, 5, 0, `<circle class="cv-hatch-dot" cx="2.5" cy="2.5" r=".7"/>`],
  [4.5, 4.5, 0, `<path d="M0 .5H4.5"/>`],
  [18, 10, 0, `<path d="M0 .5H18M0 5.5H18M4.5 .5V5.5M13.5 5.5V10.5"/>`],
  [6, 6, -45, `<path d="M0 0V6"/>`],
  [12, 6, 0, `<path d="M1 1.5h5M7 4.5h5"/>`],
  [8, 8, 0, `<circle cx="2" cy="2" r="1.3"/><circle cx="6" cy="6" r="1.3"/>`],
  [7, 7, 45, `<path d="M0 0V7"/>`],
  [5, 5, 0, `<path d="M.5 0V5"/>`],
  [12, 6, 0, `<path d="M0 3Q3 .6 6 3T12 3"/>`],
  [9, 9, 0, `<circle class="cv-hatch-dot" cx="4.5" cy="4.5" r=".7"/>`],
  [0, 0, 0, ""], // the top stratum is left as paper
];

// The parts in stack order; a part the order does not name goes on top.
function stackParts(parts: CoverPart[]): CoverPart[] {
  const rank = (p: CoverPart) => { const i = STACK_ORDER.indexOf(p.num); return i < 0 ? STACK_ORDER.length : i; };
  return [...parts].sort((a, b) => rank(a) - rank(b));
}

// The boundary under stratum k (k = 0 is the flat base of the section), as
// points across the section. Inner boundaries undulate a little, as strata do.
function boundaries(n: number): Array<Array<[number, number]>> {
  const total = THICKNESS.slice(0, n).reduce((a, b) => a + b, 0);
  const scale = (BOTTOM - TOP) / total;
  const out: Array<Array<[number, number]>> = [];
  let y = BOTTOM;
  for (let k = 0; k <= n; k++) {
    const amp = k === 0 ? 0 : 1.6 + ((k * 37) % 5) * 0.6;
    out.push(SAMPLE_X.map((x, j) => [x, r(y + amp * Math.sin(j * 1.3 + k * 2.1))]));
    if (k < n) y -= THICKNESS[k % THICKNESS.length] * scale;
  }
  return out;
}

// Height of a boundary at x, by straight interpolation between its points.
function yAt(b: Array<[number, number]>, x: number): number {
  for (let i = 0; i < b.length - 1; i++) {
    if (x <= b[i + 1][0]) return b[i][1] + ((x - b[i][0]) / (b[i + 1][0] - b[i][0])) * (b[i + 1][1] - b[i][1]);
  }
  return b[b.length - 1][1];
}

function strata(lang: Lang, parts: CoverPart[]): string {
  const bs = boundaries(parts.length);
  const defs = parts.map((_, k) => {
    const [w, h, rot, body] = HATCH[k % HATCH.length];
    if (!body) return "";
    return `<pattern id="cv-st${k}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${rot ? ` patternTransform="rotate(${rot})"` : ""}><g class="cv-hatch">${body}</g></pattern>`;
  }).join("");
  const out: string[] = [];
  parts.forEach((p, k) => {
    const lower = bs[k], upper = bs[k + 1];
    const d = smooth(lower) + smooth([...upper].reverse()).replace(/^M/, "L") + "Z";
    if (HATCH[k % HATCH.length][3]) out.push(`<path d="${d}" fill="url(#cv-st${k})"/>`);
    // Label at the right edge: leader, part number, title.
    const m = (lower[lower.length - 1][1] + upper[upper.length - 1][1]) / 2;
    const lines = lang === "zh" ? [p.title] : wrap(p.title, 30);
    out.push(`<path class="cv-s3" stroke-width=".6" d="M${X1 + 4} ${r(m)}H426"/>`);
    out.push(txt(432, m + 4.5, p.num, "cv-serif cv-f1", ` font-size="14"`));
    lines.forEach((l, i) => out.push(T(462, m + 3.2 + (i - (lines.length - 1) / 2) * 11, l, { class: "cv-f2", "font-size": 8.8 })));
  });
  // Boundaries over the hatching, then the cut edges of the section.
  bs.slice(1, -1).forEach((b) => out.push(`<path class="cv-s1" stroke-width=".8" d="${smooth(b)}"/>`));
  const top = bs[bs.length - 1];
  out.push(`<path class="cv-s1" stroke-width="1.3" d="${smooth(top)}L${X1} ${BOTTOM}H${X0}Z"/>`);
  return layer("strata", -0.35, out.join(""), defs);
}

// The capability's path: from a square in compute up through every stratum to
// an open circle above the section, a dot where it crosses each stratum.
const PATH_X = [120, 156, 140, 182, 214, 204, 240, 232, 262, 254, 284, 292];

function thread(n: number): string {
  const bs = boundaries(n);
  const pts: Array<[number, number]> = [];
  for (let k = 1; k < n; k++) {
    const x = PATH_X[(k - 1) % PATH_X.length];
    pts.push([x, r((yAt(bs[k], x) + yAt(bs[k + 1], x)) / 2)]);
  }
  const end: [number, number] = [300, TOP - 16];
  const d = smooth([...pts, end]);
  const [sx, sy] = pts[0];
  return layer("thread", 0.3,
    `<path class="cv-halo" stroke-width="7" d="${d}"/><path class="cv-sa" stroke-width="2.2" stroke-linecap="round" d="${d}"/>`
    + `<g class="cv-fa">${pts.slice(1).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8"/>`).join("")}</g>`
    + `<rect class="cv-fa" x="${sx - 4}" y="${sy - 4}" width="8" height="8"/>`
    + `<circle class="cv-sa cv-fp" stroke-width="2" cx="${end[0]}" cy="${end[1]}" r="5.5"/>`);
}

function lettering(lang: Lang): string {
  const t = TEXT[lang];
  const out: string[] = [];
  out.push(T(48, 66, "LATERE.AI", { class: "cv-fa", "font-size": 11, "font-weight": 600, "letter-spacing": 3.3 }));
  out.push(T(652, 66, t.section, { class: "cv-f2", "font-size": 8.5, "font-weight": 500, "letter-spacing": 2, "text-anchor": "end" }));
  out.push(`<path class="cv-s1" stroke-width=".6" d="M48 82H652"/>`);
  if (lang === "zh") {
    out.push(`<text class="cv-serif cv-f1" x="44" y="246" font-size="150">AI<tspan class="cv-cjk-title"> 基建</tspan></text>`);
    out.push(T(50, 300, t.subtitle, { class: "cv-cjk cv-f2", "font-size": 17, "letter-spacing": 2 }));
  } else {
    out.push(T(44, 184, "AI as an", { class: "cv-serif cv-f1", "font-size": 100 }));
    out.push(T(44, 268, "Infrastructure", { class: "cv-serif cv-f1", "font-size": 100 }));
    out.push(T(49, 302, t.subtitle, { class: "cv-f2", "font-size": 12.5 }));
  }
  // The direction of the section, read up the left margin.
  out.push(`<text class="cv-f3" transform="rotate(-90 30 ${(TOP + BOTTOM) / 2})" x="30" y="${(TOP + BOTTOM) / 2}" text-anchor="middle" font-size="7.5" letter-spacing="2">${esc(t.axis)}</text>`);
  out.push(T(48, 956, t.author, { class: lang === "zh" ? "cv-cjk cv-f1" : "cv-f1", "font-size": 14, "font-weight": 500, "letter-spacing": lang === "zh" ? 2 : undefined }));
  // Legend for the thread.
  out.push(`<path class="cv-sa" stroke-width="2.2" stroke-linecap="round" d="M518 952.5h26"/>`, T(552, 956, t.path, { class: "cv-f2", "font-size": 9 }));
  return layer("type", 0.55, out.join(""));
}

export function stack(lang: Lang, data: CoverData): string {
  const parts = stackParts(data.parts);
  return strata(lang, parts) + thread(parts.length) + lettering(lang);
}
