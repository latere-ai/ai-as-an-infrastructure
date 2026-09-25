// Cover concept "The drawing": the cover as an engineering drawing sheet.
// A front elevation of a row of racks (compute, network, storage) on a raised
// floor under a cable tray, a plan of the row with its aisles, a detail of an
// accelerator board, dimension lines, and a title block in the corner that
// holds the title, the author, and the edition as the revision. Line art in
// ink; the accent color marks what a drafter marks: dimensions and callouts.

import type { Lang } from "../../types.ts";
import { esc, r } from "../../figures/lib/svg.ts";
import { layer, T, type CoverData } from "./lib.ts";

const TEXT: Record<Lang, {
  title: string; subtitle: string; author: string; elevation: string; plan: string; detail: string;
  cold: string; hot: string; notes: string[]; cells: Record<"title" | "subtitle" | "author" | "rev" | "date" | "publisher" | "sheet" | "lang", string>;
  lang: string;
}> = {
  en: {
    title: "AI as an Infrastructure",
    subtitle: "From Systems to Agents: History, Design Decisions, and Foundations",
    author: "Changkun Ou",
    elevation: "ELEVATION A–A", plan: "PLAN", detail: "DETAIL B",
    cold: "COLD AISLE", hot: "HOT AISLE",
    notes: ["NOTES", "1. DIMENSIONS IN MILLIMETERS.", "2. ONE RACK UNIT (U) IS 44.45 MM."],
    cells: { title: "TITLE", subtitle: "SUBTITLE", author: "AUTHOR", rev: "REV", date: "DATE", publisher: "PUBLISHER", sheet: "SHEET", lang: "LANGUAGE" },
    lang: "EN",
  },
  zh: {
    title: "AI 基建",
    subtitle: "从系统到智能体：历史、设计与基石",
    author: "欧长坤 著",
    elevation: "立面图 A–A", plan: "平面图", detail: "详图 B",
    cold: "冷通道", hot: "热通道",
    notes: ["说明", "1. 尺寸单位为毫米。", "2. 一个机架单位（U）为 44.45 毫米。"],
    cells: { title: "书名", subtitle: "副标题", author: "作者", rev: "版本", date: "日期", publisher: "出版", sheet: "图幅", lang: "语言" },
    lang: "中文",
  },
};

// Elevation geometry, at 0.18 units per millimeter.
const FLOOR = 640, RACK_TOP = 280, RACK_W = 108;
const RACKS = [150, 258, 366];
const U = (630 - 290) / 42;
const TRAY = { x0: 110, x1: 540, top: 232, bottom: 244 };

type Unit = [kind: "gpu" | "sw" | "patch" | "spine" | "storage" | "blank" | "pdu", height: number];
const g = (n: number): Unit[] => Array.from({ length: n }, () => ["gpu", 4] as Unit);
const st = (n: number): Unit[] => Array.from({ length: n }, () => ["storage", 2] as Unit);
// Rack contents from the top, in rack units; each rack fills 42 U.
const LOADS: Unit[][] = [
  [["sw", 1], ["sw", 1], ...g(7), ["blank", 2], ...st(3), ["blank", 2], ["pdu", 2]],
  [["sw", 1], ["sw", 1], ["patch", 1], ["sw", 1], ["sw", 1], ["patch", 1], ["spine", 2], ["spine", 2], ["blank", 2], ...g(5), ["blank", 4], ...st(2), ["pdu", 2]],
  [["sw", 1], ["blank", 1], ...st(10), ...g(3), ["blank", 4], ...st(1), ["pdu", 2]],
];

const PATTERNS = `<pattern id="cv-dr-vent" width="3" height="3" patternUnits="userSpaceOnUse"><circle class="cv-f1" cx="1.5" cy="1.5" r=".42"/></pattern>`
  + `<pattern id="cv-dr-port" width="4.4" height="4" patternUnits="userSpaceOnUse"><rect class="cv-s1" stroke-width=".35" x=".6" y=".9" width="3.2" height="2.2"/></pattern>`
  + `<pattern id="cv-dr-slot" width="5" height="16.2" patternUnits="userSpaceOnUse"><rect class="cv-s1" stroke-width=".35" x="1" y="2" width="3" height="12.2"/></pattern>`
  + `<pattern id="cv-dr-outlet" width="7" height="5" patternUnits="userSpaceOnUse"><rect class="cv-s1" stroke-width=".35" x="1.5" y="1" width="4" height="3"/></pattern>`
  + `<pattern id="cv-dr-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="cv-hatch" d="M0 0V3.2"/></pattern>`
  + `<pattern id="cv-dr-conc" width="7" height="7" patternUnits="userSpaceOnUse"><path class="cv-hatch" d="M1 2l1.6 -1.2M4.5 5.5l1.4 .9"/><circle class="cv-hatch-dot" cx="5" cy="2" r=".45"/><circle class="cv-hatch-dot" cx="2" cy="5.5" r=".45"/></pattern>`
  + `<pattern id="cv-dr-rung" width="9" height="12" patternUnits="userSpaceOnUse"><path class="cv-s1" stroke-width=".5" d="M4.5 0V12"/></pattern>`;

const box = (x: number, y: number, w: number, h: number, sw = 0.6, fill = "") =>
  `<rect class="cv-s1${fill}" stroke-width="${sw}" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`;

function unit(kind: Unit[0], x: number, y: number, h: number): string {
  const w = 90;
  let s = box(x, y, w, h, 0.55);
  if (kind === "gpu") {
    s += `<rect x="${r(x + 6)}" y="${r(y + 3)}" width="58" height="${r(h - 6)}" fill="url(#cv-dr-vent)"/>`
      + box(x + 68, y + 4, 16, h - 8, 0.45) + box(x + 1.5, y + 3, 2, h - 6, 0.4) + box(x + w - 3.5, y + 3, 2, h - 6, 0.4)
      + `<circle class="cv-f1" cx="${r(x + 76)}" cy="${r(y + h - 7)}" r=".9"/>`;
  } else if (kind === "sw" || kind === "patch") {
    s += `<rect x="${r(x + (kind === "sw" ? 8 : 3))}" y="${r(y + 2)}" width="${kind === "sw" ? 66 : 84}" height="4" fill="url(#cv-dr-port)"/>`;
    if (kind === "sw") s += `<circle class="cv-f1" cx="${r(x + 82)}" cy="${r(y + h / 2)}" r=".8"/>`;
  } else if (kind === "spine") {
    s += `<rect x="${r(x + 6)}" y="${r(y + 3)}" width="70.4" height="4" fill="url(#cv-dr-port)"/><rect x="${r(x + 6)}" y="${r(y + 8.5)}" width="70.4" height="4" fill="url(#cv-dr-port)"/>`;
  } else if (kind === "storage") {
    s += `<rect x="${r(x + 3)}" y="${r(y)}" width="80" height="${r(h)}" fill="url(#cv-dr-slot)"/>`;
  } else if (kind === "pdu") {
    s += `<rect x="${r(x + 4)}" y="${r(y + 3)}" width="70" height="10" fill="url(#cv-dr-outlet)"/>`;
  } else {
    s += `<circle class="cv-f1" cx="${r(x + 3)}" cy="${r(y + h / 2)}" r=".7"/><circle class="cv-f1" cx="${r(x + w - 3)}" cy="${r(y + h / 2)}" r=".7"/>`;
  }
  return s;
}

function rack(x: number, load: Unit[]): string {
  let s = box(x, RACK_TOP, RACK_W, FLOOR - 10 - RACK_TOP, 1.1, " cv-fp")
    + `<path class="cv-s1" stroke-width=".5" d="M${x} 290H${x + RACK_W}M${x + 7} 290V630M${x + RACK_W - 7} 290V630"/>`
    + box(x + 6, 632, 10, 8, 0.6) + box(x + RACK_W - 16, 632, 10, 8, 0.6);
  let y = 290;
  for (const [kind, h] of load) { s += unit(kind, x + 9, y, h * U); y += h * U; }
  return s;
}

function drawing(lang: Lang): string {
  const t = TEXT[lang];
  const out: string[] = [];
  // Raised floor: tiles, pedestals, slab.
  out.push(`<rect x="70" y="${FLOOR}" width="490" height="8" fill="url(#cv-dr-hatch)"/>`, `<path class="cv-s1" stroke-width="1.2" d="M70 ${FLOOR}H560M70 648H560"/>`);
  for (let x = 90; x <= 550; x += 60) out.push(`<path class="cv-s1" stroke-width=".6" d="M${x} 648V672M${x - 4} 649.5h8M${x - 5} 670.5h10"/>`);
  out.push(`<rect x="70" y="672" width="490" height="10" fill="url(#cv-dr-conc)"/>`, `<path class="cv-s1" stroke-width="1" d="M70 672H560M70 682H560"/>`);
  RACKS.forEach((x, i) => out.push(rack(x, LOADS[i])));
  // Cable tray on posts over the row, and the runs down into each rack.
  out.push(`<rect x="${TRAY.x0}" y="${TRAY.top}" width="${TRAY.x1 - TRAY.x0}" height="${TRAY.bottom - TRAY.top}" fill="url(#cv-dr-rung)"/>`,
    `<path class="cv-s1" stroke-width=".9" d="M${TRAY.x0} ${TRAY.top}H${TRAY.x1}M${TRAY.x0} ${TRAY.bottom}H${TRAY.x1}M${TRAY.x0} ${TRAY.top}V${TRAY.bottom}M${TRAY.x1} ${TRAY.top}V${TRAY.bottom}"/>`,
    box(154, TRAY.bottom, 3, RACK_TOP - TRAY.bottom, 0.6), box(467, TRAY.bottom, 3, RACK_TOP - TRAY.bottom, 0.6));
  const runs = [[168, 178], [190, 192], [214, 206], [280, 286], [300, 300], [322, 314], [386, 394], [404, 408], [428, 422]];
  out.push(`<path class="cv-s1" stroke-width=".7" d="${runs.map(([a, b]) => `M${a} ${TRAY.bottom}C${a} 264 ${b} 258 ${b} ${RACK_TOP}`).join("")}"/>`);
  // Plan of the row: hot aisle behind, racks, perforated tiles in the cold aisle.
  const px = [438, 474, 510];
  px.forEach((x) => out.push(box(x, 104, 36, 48, 1, " cv-fp"), `<path class="cv-s1" stroke-width=".4" d="M${x + 4} 108h28M${x + 4} 148h28"/>`));
  for (let i = 0; i < 4; i++) out.push(`<rect x="${438 + i * 27}" y="160" width="27" height="27" fill="url(#cv-dr-vent)"/>`, box(438 + i * 27, 160, 27, 27, 0.4));
  const arrow = (x: number, y0: number, y1: number) => `<path class="cv-s2" stroke-width=".7" d="M${x} ${y0}V${y1 + 3}"/><path class="cv-f2" d="M${x} ${y1}l-2 4h4z"/>`;
  px.forEach((x) => out.push(arrow(x + 18, 172, 156), arrow(x + 18, 100, 76)));
  const aisle = (y: number, s: string) => T(428, y, s, { class: lang === "zh" ? "cv-cjk cv-f3" : "cv-f3", "font-size": 6.5, "letter-spacing": 1, "text-anchor": "end" });
  out.push(aisle(176, t.cold), aisle(90, t.hot));
  return layer("drawing", -0.5, out.join(""), PATTERNS);
}

// Dimension lines: arrowheads onto extension lines, the value above the line.
const head = (x: number, y: number, dir: "l" | "r" | "u" | "d") => {
  const p = { l: `l6 -1.6v3.2z`, r: `l-6 -1.6v3.2z`, u: `l-1.6 6h3.2z`, d: `l-1.6 -6h3.2z` }[dir];
  return `<path class="cv-fa" d="M${r(x)} ${r(y)}${p}"/>`;
};
function dimH(x1: number, x2: number, y: number, label: string): string {
  return `<path class="cv-sa" stroke-width=".6" d="M${x1} ${y}H${x2}"/>` + head(x1, y, "l") + head(x2, y, "r")
    + T((x1 + x2) / 2, y - 3.5, label, { class: "cv-fa", "font-size": 8, "text-anchor": "middle" });
}
function dimV(x: number, y1: number, y2: number, label: string): string {
  const cy = (y1 + y2) / 2;
  return `<path class="cv-sa" stroke-width=".6" d="M${x} ${y1}V${y2}"/>` + head(x, y1, "u") + head(x, y2, "d")
    + `<text class="cv-fa" transform="rotate(-90 ${x - 4} ${r(cy)})" x="${x - 4}" y="${r(cy)}" font-size="8" text-anchor="middle">${esc(label)}</text>`;
}
const ext = (d: string) => `<path class="cv-sa" stroke-width=".45" d="${d}"/>`;

function dimensions(): string {
  const xs = [...RACKS, RACKS[2] + RACK_W];
  const out = [
    ext(xs.map((x) => `M${x} 686V${x === xs[0] || x === xs[3] ? 726 : 704}`).join("")),
    dimH(150, 258, 700, "600"), dimH(258, 366, 700, "600"), dimH(366, 474, 700, "600"), dimH(150, 474, 722, "1800"),
    ext(`M478 ${RACK_TOP}H500M478 ${FLOOR}H500`), dimV(496, RACK_TOP, FLOOR, "2000"),
    ext(`M544 ${TRAY.bottom}H570M564 ${FLOOR}H570`), dimV(566, TRAY.bottom, FLOOR, "2200"),
    ext(`M146 290H124M146 630H124`), dimV(128, 290, 630, "42U"),
    // Centerline of the middle rack.
    `<path class="cv-s3" stroke-width=".5" stroke-dasharray="12 3 2 3" d="M312 268V652"/>`,
    // The cutting plane of the elevation, drawn on the plan.
    `<path class="cv-sa" stroke-width=".8" stroke-dasharray="12 3 2 3" d="M418 194H566"/>`,
    `<path class="cv-sa" stroke-width="1.4" d="M418 194V186M566 194V186"/>`, head(418, 180, "u"), head(566, 180, "u"),
    T(410, 198, "A", { class: "cv-fa", "font-size": 9, "font-weight": 600 }), T(570, 198, "A", { class: "cv-fa", "font-size": 9, "font-weight": 600 }),
  ];
  return layer("dims", -0.2, out.join(""));
}

// Detail B: an accelerator board seen from above, eight packages around the
// switch chips that join them, in a clipped bubble with a leader to the server
// it comes from.
function detail(): string {
  const cx = 140, cy = 132, rad = 70;
  const out: string[] = [];
  out.push(box(92, 96, 112, 86, 0.9, " cv-fp"));
  out.push(`<path class="cv-s1" stroke-width=".6" d="M96 140H200"/>`);
  for (let i = 0; i < 4; i++) {
    const x = 98 + i * 26;
    for (const y of [102, 158]) out.push(box(x, y, 20, 20, 0.8), `<rect class="cv-f3" x="${x + 5}" y="${y + 5}" width="10" height="10" opacity=".45"/>`);
    out.push(box(x + 4, 134, 12, 12, 0.7, " cv-fp"), `<path class="cv-s1" stroke-width=".6" d="M${x + 10} 122V134M${x + 10} 146V158"/>`);
  }
  for (let x = 100; x < 200; x += 5) out.push(`<path class="cv-s1" stroke-width=".4" d="M${x} 182v4"/>`);
  return layer("detail", 0.35,
    `<circle class="cv-fp" cx="${cx}" cy="${cy}" r="${rad}"/><g clip-path="url(#cv-dr-clip)">${out.join("")}</g>`
    + `<circle class="cv-s1" stroke-width="1" cx="${cx}" cy="${cy}" r="${rad}"/>`
    + `<circle class="cv-sa" stroke-width=".9" cx="204" cy="322" r="20"/><path class="cv-sa" stroke-width=".7" d="M192 306L176 196"/>`
    + T(226, 306, "B", { class: "cv-fa", "font-size": 9, "font-weight": 600 }),
    `<clipPath id="cv-dr-clip"><circle cx="${cx}" cy="${cy}" r="${rad - 0.5}"/></clipPath>`);
}

// The sheet: frame with zones, view labels, notes, and the title block.
function sheet(lang: Lang, data: CoverData): string {
  const t = TEXT[lang];
  const zh = lang === "zh";
  const cjk = (cls: string) => (zh ? `cv-cjk ${cls}` : cls);
  const out: string[] = [];
  out.push(`<rect class="cv-s1" stroke-width="1.4" x="28" y="28" width="644" height="934"/><rect class="cv-s1" stroke-width=".6" x="40" y="40" width="620" height="910"/>`);
  const zx = [1, 2, 3].map((i) => 40 + (620 / 4) * i);
  const zy = [1, 2, 3, 4, 5].map((i) => 40 + (910 / 6) * i);
  out.push(`<path class="cv-s1" stroke-width=".6" d="${zx.map((x) => `M${r(x)} 28V40M${r(x)} 950V962`).join("")}${zy.map((y) => `M28 ${r(y)}H40M660 ${r(y)}H672`).join("")}"/>`);
  [0, 1, 2, 3].forEach((i) => {
    const x = 40 + (620 / 4) * (i + 0.5);
    out.push(T(x, 36.3, String(i + 1), { class: "cv-f3", "font-size": 6, "text-anchor": "middle" }), T(x, 958.3, String(i + 1), { class: "cv-f3", "font-size": 6, "text-anchor": "middle" }));
  });
  "ABCDEF".split("").forEach((c, i) => {
    const y = 40 + (910 / 6) * (i + 0.5) + 2.2;
    out.push(T(34, y, c, { class: "cv-f3", "font-size": 6, "text-anchor": "middle" }), T(666, y, c, { class: "cv-f3", "font-size": 6, "text-anchor": "middle" }));
  });
  // View labels, underlined.
  const label = (x: number, y: number, s: string, w: number) =>
    T(x, y, s, { class: cjk("cv-f1"), "font-size": 8.5, "font-weight": 600, "letter-spacing": 1.6, "text-anchor": "middle" })
    + `<path class="cv-s1" stroke-width=".7" d="M${r(x - w / 2)} ${y + 4}h${w}"/>`;
  out.push(label(312, 758, t.elevation, zh ? 74 : 100), label(520, 214, t.plan, zh ? 34 : 30), label(140, 222, t.detail, zh ? 42 : 58));
  // Notes.
  t.notes.forEach((n, i) => out.push(T(52, 812 + i * 14, n, { class: cjk(i ? "cv-f2" : "cv-f1"), "font-size": i ? 7 : 7.5, "font-weight": i ? undefined : 600, "letter-spacing": 1 })));
  // Title block.
  const X0 = 344, X1 = 660, Y = [788, 852, 878, 914, 950];
  out.push(`<rect class="cv-s1 cv-fp" stroke-width="1.2" x="${X0}" y="${Y[0]}" width="${X1 - X0}" height="${Y[4] - Y[0]}"/>`,
    `<path class="cv-s1" stroke-width=".6" d="M${X0} ${Y[1]}H${X1}M${X0} ${Y[2]}H${X1}M${X0} ${Y[3]}H${X1}M520 ${Y[2]}V${Y[4]}M590 ${Y[2]}V${Y[4]}"/>`);
  const cell = (x: number, y: number, s: string) => T(x + 5, y + 8.5, s, { class: cjk("cv-f3"), "font-size": 5.8, "letter-spacing": 1 });
  out.push(cell(X0, Y[0], t.cells.title), cell(X0, Y[1], t.cells.subtitle), cell(X0, Y[2], t.cells.author), cell(520, Y[2], t.cells.rev),
    cell(590, Y[2], t.cells.date), cell(X0, Y[3], t.cells.publisher), cell(520, Y[3], t.cells.sheet), cell(590, Y[3], t.cells.lang));
  out.push(zh
    ? `<text class="cv-serif cv-f1" x="350" y="842" font-size="36">AI<tspan class="cv-cjk-title"> 基建</tspan></text>`
    : T(350, 840, t.title, { class: "cv-serif cv-f1", "font-size": 32 }));
  out.push(T(350, 872.5, t.subtitle, { class: cjk("cv-f1"), "font-size": zh ? 9 : 7.6, "letter-spacing": zh ? 1.5 : undefined }));
  out.push(T(350, 907, t.author, { class: cjk("cv-f1"), "font-size": 11, "font-weight": 500 }));
  out.push(T(525, 907, data.release ? `v${data.release.version}` : "DRAFT", { class: "cv-fa", "font-size": 10, "font-weight": 600 }));
  if (data.release) out.push(T(595, 907, data.release.date, { class: "cv-f1", "font-size": 8.5 }));
  out.push(T(350, 943, "LATERE.AI", { class: "cv-f1", "font-size": 9.5, "font-weight": 600, "letter-spacing": 2.2 }),
    T(525, 943, "1 / 1", { class: "cv-f1", "font-size": 9 }), T(595, 943, t.lang, { class: cjk("cv-f1"), "font-size": 9 }));
  return layer("sheet", 0, out.join(""));
}

export function drawingCover(lang: Lang, data: CoverData): string {
  return sheet(lang, data) + drawing(lang) + dimensions() + detail();
}
