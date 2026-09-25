// The book cover, drawn as code. The build renders it into the home page as
// static markup, so the whole cover shows without script; landing/tilt.ts
// then makes it follow the pointer like a book held in the hand.
//
// The face is a stack of SVG layers that share one 700 x 990 viewBox (the
// A-series ratio of the printed cover): sky, orbits, planet, land and road,
// the figure, and the type. Each layer is its own element so the tilt can
// move it on the compositor with a transform alone; the stylesheet gives each
// one a depth, and a layer shifts by its depth as the book turns, which is
// the parallax. Layers that could expose an edge while shifting draw past
// the viewBox, and the face clips them.
//
// Every color is a --cv-* custom property from the landing section of
// theme.css, redefined for the dark theme, so the static cover follows the
// reader's theme with no script. Gradient stops take their color through a
// style attribute because a stop-color attribute does not resolve var().
//
// Around the face sit the spine, the page edges and a cast shadow, so the
// thickness of the book shows when it turns.

import type { Lang } from "../types.ts";
import { esc, r } from "../figures/lib/svg.ts";

export const COVER_W = 700;
export const COVER_H = 990;

// Scene geometry. The road runs from the vanishing point on the horizon, where
// the figure stands, toward the viewer; the planet rises above it.
const HORIZON = 829;
const VP = 527.5;
const PLANET = { x: 527.5, y: 647, r: 118 };
const ORBITS = [
  { r: 247, cls: "cv-orbit" },
  { r: 214, cls: "cv-orbit cv-orbit-dot" },
  { r: 184, cls: "cv-orbit" },
  { r: 150, cls: "cv-orbit cv-orbit-faint" },
];
const ROAD_BOTTOM = 1010; // below the viewBox, so a shifted layer shows no edge
const ROAD_LEFT = -0.972; // dx/dy of the left road edge from the vanishing point
const ROAD_RIGHT = 1.463;

interface CoverText {
  label: string; // accessible name of the cover
  side: { head: string; lines: string[] };
  features: Array<{ label: string; sub?: string }>;
  spine: string;
}

const TEXT: Record<Lang, CoverText> = {
  en: {
    label: "Cover of AI as an Infrastructure, From Systems to Agents: History, Design Decisions, and Foundations, by Changkun Ou",
    side: { head: "INFRASTRUCTURE", lines: ["THE OPERATING", "SYSTEM FOR THE", "AGE OF INTELLIGENCE"] },
    features: [{ label: "History" }, { label: "Design Decisions" }, { label: "Foundations" }],
    spine: "AI as an Infrastructure",
  },
  zh: {
    label: "《AI 基建：从系统到智能体：历史、设计与基石》封面，欧长坤 著",
    side: { head: "基础设施", lines: ["智能时代的", "底层操作系统"] },
    features: [{ label: "历史", sub: "HISTORY" }, { label: "设计", sub: "DESIGN" }, { label: "基石", sub: "FOUNDATIONS" }],
    spine: "AI 基建",
  },
};

const stop = (offset: number, token: string, opacity?: number) =>
  `<stop offset="${offset}" style="stop-color:var(--cv-${token})${opacity != null ? `;stop-opacity:${opacity}` : ""}"/>`;

const vgrad = (id: string, stops: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;

function layer(name: string, body: string, defs = ""): string {
  return `<svg class="cv-l cv-l-${name}" viewBox="0 0 ${COVER_W} ${COVER_H}" aria-hidden="true" focusable="false">`
    + (defs ? `<defs>${defs}</defs>` : "") + body + `</svg>`;
}

function txt(x: number, y: number, s: string, cls: string, extra = ""): string {
  return `<text class="${cls}" x="${r(x)}" y="${r(y)}"${extra}>${esc(s)}</text>`;
}

// Dust in the sky, as (x, y, radius).
const SPECKS: Array<[number, number, number]> = [
  [120, 480, 1.2], [210, 540, 0.9], [90, 600, 1], [260, 410, 0.8], [640, 420, 1.1], [612, 560, 0.9],
  [680, 610, 1.3], [300, 640, 0.7], [440, 380, 0.9], [470, 560, 1], [60, 520, 0.8], [400, 470, 0.7],
  [160, 330, 0.8], [345, 300, 0.7], [655, 330, 0.9], [22, 420, 0.7],
];

function sky(): string {
  const specks = SPECKS.map(([x, y, rad]) => `<circle cx="${x}" cy="${y}" r="${rad}"/>`).join("");
  return layer("sky", `<g class="cv-speck">${specks}</g>`);
}

// Point on an orbit at an angle in degrees, clockwise from the positive x axis.
function onOrbit(rad: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [r(PLANET.x + rad * Math.cos(a)), r(PLANET.y + rad * Math.sin(a))];
}

function orbits(): string {
  const rings = ORBITS.map((o) => `<circle class="${o.cls}" cx="${PLANET.x}" cy="${PLANET.y}" r="${o.r}"/>`).join("");
  // Markers ride the orbits on the side facing the type, as on the printed cover.
  const dot = (rad: number, deg: number, size: number) => { const [x, y] = onOrbit(rad, deg); return `<circle class="cv-mark" cx="${x}" cy="${y}" r="${size}"/>`; };
  const ring = (rad: number, deg: number, size: number) => { const [x, y] = onOrbit(rad, deg); return `<circle class="cv-ring" cx="${x}" cy="${y}" r="${size}"/>`; };
  const [hx, hy] = onOrbit(247, 218.5);
  const [sx, sy] = onOrbit(184, 316);
  const marks = [
    dot(247, 229.6, 3.6),
    `<circle class="cv-mark" cx="${hx}" cy="${hy}" r="7"/><circle class="cv-ring cv-ring-halo" cx="${hx}" cy="${hy}" r="13.5"/>`,
    dot(184, 195.3, 5), ring(214, 166.3, 3.8), dot(214, 156.2, 2.6), ring(150, 156.8, 4.2), ring(150, 171.7, 3),
    dot(184, 290, 1.8), ring(150, 16, 3),
    // a small probe on the outer orbit
    `<g class="cv-probe"><circle cx="${sx}" cy="${sy}" r="2.6"/><path d="M${r(sx - 7)} ${r(sy - 4)}l14 8"/></g>`,
  ].join("");
  return layer("orbits", rings + marks);
}

function planet(): string {
  const defs = vgrad("cv-pl", stop(0, "pl-1") + stop(0.55, "pl-2") + stop(1, "pl-3"))
    + `<radialGradient id="cv-halo">${stop(0.6, "halo", 0.7)}${stop(0.72, "halo", 0.35)}${stop(1, "halo", 0)}</radialGradient>`
    + `<radialGradient id="cv-hi" cx=".36" cy=".3" r=".7">${stop(0, "pl-hi", 0.55)}${stop(1, "pl-hi", 0)}</radialGradient>`
    + `<filter id="cv-grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7"/>`
    + `<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .38 -.1"/><feComposite in2="SourceGraphic" operator="in"/>`
    + `<feBlend in2="SourceGraphic" mode="multiply"/></filter>`;
  const { x, y, r: rad } = PLANET;
  // The line from the feature list down to the planet, with a tick where it
  // crosses each inner orbit.
  const ticks = ORBITS.filter((o) => o.r < 200).map((o) => `<circle cx="531" cy="${r(y - Math.sqrt(o.r * o.r - 3.5 * 3.5))}" r="1.5"/>`).join("");
  const body = `<circle cx="${x}" cy="${y}" r="${rad * 1.6}" fill="url(#cv-halo)"/>`
    + `<circle cx="${x}" cy="${y}" r="${rad}" fill="url(#cv-pl)" filter="url(#cv-grain)"/>`
    + `<circle cx="${x}" cy="${y}" r="${rad}" fill="url(#cv-hi)"/>`
    + `<path class="cv-stem" d="M531 211V${r(y - rad)}"/><g class="cv-mark">${ticks}<circle cx="531" cy="211" r="3.4"/></g>`;
  return layer("planet", body, defs);
}

// A ridge as a polyline, closed down to the horizon for the fill.
function ridge(pts: Array<[number, number]>, fillId: string): string {
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join("");
  const last = pts[pts.length - 1];
  return `<path d="${line}L${last[0]} ${HORIZON}L${pts[0][0]} ${HORIZON}Z" fill="url(#${fillId})"/><path class="cv-ridge" d="${line}"/>`;
}

function land(): string {
  const defs = vgrad("cv-hill", stop(0, "hill-1") + stop(1, "hill-2"))
    + vgrad("cv-ground", stop(0, "ground-1") + stop(1, "ground-2"))
    + vgrad("cv-road", stop(0, "road-1") + stop(1, "road-2"))
    + `<radialGradient id="cv-glow">${stop(0, "glow", 0.95)}${stop(0.3, "glow", 0.5)}${stop(1, "glow", 0)}</radialGradient>`;
  const hills = ridge([[-30, 716], [10, 708], [48, 712], [80, 704], [112, 716], [150, 726], [190, 738], [232, 750], [270, 760], [312, 772], [352, 786], [392, 800], [432, 811], [472, 820], [512, 827], [527, 829]], "cv-hill")
    + ridge([[-30, 770], [30, 764], [78, 772], [128, 786], [182, 796], [240, 806], [300, 815], [360, 822], [420, 827], [470, 829]], "cv-hill")
    + ridge([[545, 829], [585, 824], [622, 816], [650, 806], [672, 797], [694, 794], [730, 800], [730, 829]], "cv-hill");
  const xl = (y: number) => r(VP + ROAD_LEFT * (y - HORIZON));
  const xr = (y: number) => r(VP + ROAD_RIGHT * (y - HORIZON));
  const depth = ROAD_BOTTOM - HORIZON;
  // Cross lines of the road at equal steps in depth: y = horizon + d / z.
  const planks = [1.3, 1.7, 2.2, 2.9, 3.8, 5, 6.6, 8.8, 12, 16].map((z) => {
    const y = r(HORIZON + depth / z);
    return `M${xl(y)} ${y}H${xr(y)}`;
  }).join("");
  const fan = [[-60, 890], [-60, 950], [60, ROAD_BOTTOM], [200, ROAD_BOTTOM], [760, 880], [760, 940]]
    .map(([fx, fy]) => `M${VP} ${HORIZON}L${fx} ${fy}`).join("");
  const body = `<rect x="-30" y="${HORIZON}" width="760" height="${ROAD_BOTTOM - HORIZON + 10}" fill="url(#cv-ground)"/>`
    + hills
    + `<path class="cv-fan" d="${fan}"/>`
    + `<path d="M${VP - 1.5} ${HORIZON}H${VP + 1.5}L${xr(ROAD_BOTTOM)} ${ROAD_BOTTOM}H${xl(ROAD_BOTTOM)}Z" fill="url(#cv-road)"/>`
    + `<path class="cv-plank" d="${planks}"/>`
    + `<path class="cv-lane" d="M${VP} ${HORIZON}L470 ${ROAD_BOTTOM}M${VP} ${HORIZON}L650 ${ROAD_BOTTOM}"/>`
    + `<path class="cv-road-edge" d="M${VP - 1.5} ${HORIZON}L${xl(ROAD_BOTTOM)} ${ROAD_BOTTOM}M${VP + 1.5} ${HORIZON}L${xr(ROAD_BOTTOM)} ${ROAD_BOTTOM}"/>`
    + `<path class="cv-horizon" d="M-30 ${HORIZON}H730"/>`
    + `<ellipse cx="${VP}" cy="${HORIZON}" rx="330" ry="92" fill="url(#cv-glow)"/>`
    + `<ellipse cx="${VP}" cy="${HORIZON}" rx="64" ry="12" fill="url(#cv-glow)"/>`;
  return layer("land", body, defs);
}

// The lone figure on the road, seen from behind, feet on the horizon, and its
// reflection on the polished road.
const FIGURE = `<ellipse cx="${VP}" cy="794.6" rx="2.9" ry="3.4"/>`
  + `<path d="M523.4 800.2Q527.5 797.6 531.6 800.2L532.7 813L531.5 813.2L530.9 805.5L530.8 814.5L530.4 829H528.2L527.5 816L526.8 829H524.6L524.2 814.5L524.1 805.5L523.5 813.2L522.3 813Z"/>`;

function figure(): string {
  return layer("figure", `<g class="cv-fig">${FIGURE}<g class="cv-fig-mirror" transform="matrix(1 0 0 -.55 0 ${r(HORIZON * 1.55)})">${FIGURE}</g></g>`);
}

// Letterspaced small caps and serif text, with sizes chosen from the reader's
// fonts (Inter, Instrument Serif). The title lines carry a textLength so the
// composition holds if a fallback font is wider.
function type(lang: Lang): string {
  const t = TEXT[lang];
  const zh = lang === "zh";
  const defs = `<linearGradient id="cv-tg" gradientUnits="userSpaceOnUse" x1="48" y1="190" x2="500" y2="${zh ? 380 : 390}">`
    + stop(0, "t1") + stop(0.55, "t2") + stop(1, "t3") + `</linearGradient>`;
  const out: string[] = [];
  // Imprint and motto, top left.
  out.push(txt(63, 77.6, "LATERE.AI", "cv-sans cv-acc cv-imprint"), `<path class="cv-rule" d="M63 103h25"/>`);
  out.push(txt(63, 137, "HUMAN INTELLIGENCE", "cv-sans cv-ink2 cv-caps"), txt(63, 156, "IN THE LOOP", "cv-sans cv-ink2 cv-caps"));
  // Side label, top right: a hairline with a star, a head and three lines.
  out.push(`<path class="cv-hair" d="M533 43V145"/><circle class="cv-star-glow" cx="533" cy="64" r="5"/>`
    + `<path class="cv-star" d="M533 56.5l1.2 6.3 6.3 1.2-6.3 1.2-1.2 6.3-1.2-6.3-6.3-1.2 6.3-1.2z"/>`);
  if (zh) {
    out.push(txt(554, 74, t.side.head, "cv-cjk cv-ink cv-side-head-zh"));
    t.side.lines.forEach((l, i) => out.push(txt(554, 98 + i * 19, l, "cv-cjk cv-ink2 cv-side-zh")));
    out.push(`<path class="cv-rule" d="M554 ${98 + t.side.lines.length * 19 - 2}h20"/>`);
  } else {
    out.push(txt(554, 73, t.side.head, "cv-sans cv-ink cv-side-head"));
    t.side.lines.forEach((l, i) => out.push(txt(554, 97.5 + i * 17.5, l, "cv-sans cv-ink2 cv-side")));
    out.push(`<path class="cv-rule" d="M554 147h20"/>`);
  }
  // Feature list along the line to the planet.
  const icons = [
    `<path d="M557.5 248l3-8.5 3 9.5 3.5-12 3 11 2.5-5 2 3"/>`,
    `<path d="M566 295l7 4v8l-7 4-7-4v-8zM559 299l7 4 7-4M566 303v8"/>`,
    `<g class="cv-grid">${[0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].map((j) => `<circle cx="${r(561.2 + i * 3.2)}" cy="${r(357.2 + j * 3.2)}" r=".85"/>`)).join("")}</g>`,
  ];
  t.features.forEach((f, i) => {
    const cy = 244 + i * 59;
    out.push(`<circle class="cv-badge" cx="566" cy="${cy}" r="16.5"/><g class="cv-icon">${icons[i]}</g>`);
    if (f.sub) out.push(txt(592, cy - 1, f.label, "cv-cjk cv-ink cv-feat-zh"), txt(592, cy + 11.5, f.sub, "cv-sans cv-ink2 cv-feat-sub"));
    else out.push(txt(592, cy + 4, f.label, "cv-sans cv-ink cv-feat"));
  });
  // Title, rule, subtitle, byline, tagline.
  if (zh) {
    out.push(`<text class="cv-serif" fill="url(#cv-tg)" x="48" y="356" font-size="156" textLength="421" lengthAdjust="spacingAndGlyphs">AI<tspan class="cv-cjk-title">基建</tspan></text>`);
    out.push(`<path class="cv-rule cv-rule-bold" d="M50 386h45"/>`);
    out.push(txt(52, 441, "从系统到智能体：", "cv-cjk cv-ink cv-sub-zh"), txt(52, 478, "历史、设计与基石", "cv-cjk cv-ink cv-sub-zh"));
    out.push(txt(53, 582, "欧长坤", "cv-cjk cv-ink cv-by-zh"), `<path class="cv-hair" d="M134 575h44"/>`, txt(188, 582, "著", "cv-cjk cv-ink cv-by-mark"));
    ["探索智能的底层结构、", "设计原则与关键基石，", "构建面向未来的", "智能基础设施。"]
      .forEach((l, i) => out.push(txt(58, 805 + i * 20, l, "cv-cjk cv-ink cv-tag-zh")));
    out.push(`<path class="cv-rule" d="M58 889h27"/>`);
  } else {
    out.push(`<text class="cv-serif" fill="url(#cv-tg)" x="46" y="290" font-size="122" textLength="319" lengthAdjust="spacingAndGlyphs">AI as an</text>`);
    out.push(`<text class="cv-serif" fill="url(#cv-tg)" x="45" y="372" font-size="95" textLength="450" lengthAdjust="spacingAndGlyphs">Infrastructure</text>`);
    out.push(`<path class="cv-rule cv-rule-bold" d="M50 402h45"/>`);
    ["From Systems to Agents:", "History, Design Decisions,", "and Foundations"]
      .forEach((l, i) => out.push(txt(50, 452 + i * 36, l, "cv-serif cv-ink cv-sub")));
    out.push(`<text class="cv-serif cv-ink cv-by" x="50" y="592"><tspan font-style="italic">by</tspan> Changkun Ou</text>`, `<path class="cv-hair" d="M222 583h40"/>`);
    ["Exploring the underlying", "structure of intelligence,", "the principles of design, and", "the foundations for building", "the infrastructure of future", "intelligent systems."]
      .forEach((l, i) => out.push(txt(50, 652 + i * 20, l, "cv-serif cv-ink2 cv-tag")));
  }
  // Foot line.
  out.push(txt(53, 959, "LATERE.AI", "cv-sans cv-ink cv-foot-mark"), `<path class="cv-hair" d="M178 955.5H370"/><circle class="cv-dot" cx="178" cy="955.5" r="2"/>`);
  out.push(txt(388, 958.5, "HUMAN INTELLIGENCE IN THE LOOP", "cv-sans cv-ink2 cv-foot"));
  return layer("type", out.join(""), defs);
}

// The whole cover: the stage (the hover and tilt target), the cast shadow, and
// the book with its face, spine and page edges. data-cover marks it for the
// tilt runtime.
export function renderCover(lang: Lang): string {
  const t = TEXT[lang];
  const face = sky() + orbits() + planet() + land() + figure() + type(lang);
  return `<div class="cv" data-cover role="img" aria-label="${esc(t.label)}">`
    + `<div class="cv-shadow" aria-hidden="true"></div>`
    + `<div class="cv-book">`
    + `<div class="cv-spine" aria-hidden="true"><span>${esc(t.spine)}</span></div>`
    + `<div class="cv-pages cv-pages-r" aria-hidden="true"></div><div class="cv-pages cv-pages-t" aria-hidden="true"></div><div class="cv-pages cv-pages-b" aria-hidden="true"></div>`
    + `<div class="cv-face">${face}<div class="cv-sheen" aria-hidden="true"></div></div>`
    + `</div></div>`;
}
