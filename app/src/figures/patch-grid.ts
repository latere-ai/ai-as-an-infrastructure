// How many visual positions an image becomes, for the multimodal chapter's
//
//   N_vis = ⌈H/P⌉ · ⌈W/P⌉
//
// on a square image of edge E = H = W, and the two variants the chapter names:
//
// - Tiling in the manner of LLaVA-NeXT: 336-pixel tiles, each encoded as its
//   own grid, plus one global view resized to 336 pixels, so
//   N = (t² + 1) · ⌈336/P⌉² with t = ⌈E/336⌉ tiles per side. LLaVA-NeXT
//   itself caps the tile grid; the figure does not, so large edges show what
//   uncapped tiling would cost.
// - Native resolution with each 2 × 2 group of patch features merged into one
//   position, as Qwen2-VL does: N = ⌈E/2P⌉².
//
// The grid on the left is the actual grid at the chosen edge (padding to a
// whole number of patches hatched); the curve on the right is N over the whole
// edge range, so the ceilings show as steps and the square law as curvature.
// Everything is exact arithmetic; LLaVA-1.5's 336-pixel, 14-pixel-patch case
// (576 positions) is marked for reference.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { wrapCJK } from "./lib/notation.ts";
import { placeLabels, drawLabels, lineObstacles, type Box, type LabelRequest } from "./lib/labels.ts";
import { int, sig, tpl } from "./lib/format.ts";

const TILE = 336;
const EDGE_MIN = 112, EDGE_MAX = 1344;
const LLAVA15 = { edge: 336, n: 576 };

type Mode = "single" | "tiles" | "native";
type P = { edge: number; patch: number; mode: Mode };

export function count(p: P): { n: number; side: number; tiles: number; perTile: number } {
  const P = p.patch;
  if (p.mode === "tiles") {
    const t = Math.ceil(p.edge / TILE);
    const perTile = Math.ceil(TILE / P) ** 2;
    return { n: (t * t + 1) * perTile, side: Math.ceil(TILE / P), tiles: t, perTile };
  }
  if (p.mode === "native") {
    const side = Math.ceil(p.edge / (2 * P));
    return { n: side * side, side, tiles: 0, perTile: 0 };
  }
  const side = Math.ceil(p.edge / P);
  return { n: side * side, side, tiles: 0, perTile: 0 };
}

const labels = {
  en: {
    title: "Visual positions from image edge and patch size",
    image: "{e} × {e} image, {p}-pixel patches",
    pad: "padding",
    global: "global view",
    chart: "visual positions N_vis",
    x: "image edge E = H = W (pixels)",
    ref: "LLaVA-1.5",
    eqSingle: "N_vis = ⌈{e}/{p}⌉ · ⌈{e}/{p}⌉ = {s} · {s} = {n}",
    eqTiles: "N_vis = ({t}² + 1) · ⌈336/{p}⌉² = {k} · {q} = {n}",
    eqNative: "N_vis = ⌈{e}/(2 · {p})⌉² = {s}² = {n}",
    tilesNote: "{t} × {t} tiles of 336 pixels plus one global view, each a {s} × {s} grid",
    nativeNote: "{g} × {g} patches, merged 2 × 2 into {s} × {s} positions",
    ratio: "{r} times LLaVA-1.5's 576 positions",
    describe: "A {e}-pixel square image with {p}-pixel patches, {mode}, becomes {n} visual positions, {r} times the 576 of LLaVA-1.5.",
    mSingle: "as one crop",
    mTiles: "tiled into 336-pixel tiles with a global view",
    mNative: "at native resolution with 2 × 2 merging",
  },
  zh: {
    title: "图像边长、图块大小与视觉位置数",
    image: "{e} × {e} 像素图像，图块边长 {p} 像素",
    pad: "填充",
    global: "全局视图",
    chart: "视觉位置数 N_vis",
    x: "图像边长 E = H = W（像素）",
    ref: "LLaVA-1.5",
    eqSingle: "N_vis = ⌈{e}/{p}⌉ · ⌈{e}/{p}⌉ = {s} · {s} = {n}",
    eqTiles: "N_vis = ({t}² + 1) · ⌈336/{p}⌉² = {k} · {q} = {n}",
    eqNative: "N_vis = ⌈{e}/(2 · {p})⌉² = {s}² = {n}",
    tilesNote: "{t} × {t} 个 336 像素分块加一个全局视图，每个都是 {s} × {s} 的网格",
    nativeNote: "{g} × {g} 个图块，按 2 × 2 合并为 {s} × {s} 个位置",
    ratio: "是 LLaVA-1.5 的 576 个位置的 {r} 倍",
    describe: "边长 {e} 像素的正方形图像，图块边长 {p} 像素，{mode}，得到 {n} 个视觉位置，是 LLaVA-1.5 的 576 个的 {r} 倍。",
    mSingle: "单次裁剪",
    mTiles: "切成 336 像素分块并加全局视图",
    mNative: "按原生分辨率并做 2 × 2 合并",
  },
};

type Lb = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const c = count(p);
  return tpl(Lx.describe, {
    e: p.edge, p: p.patch, mode: { single: Lx.mSingle, tiles: Lx.mTiles, native: Lx.mNative }[p.mode],
    n: int(c.n), r: sig(c.n / LLAVA15.n, 3),
  });
}

// Grid lines as one path: `n` cells of `step` pixels from (x0, y0).
function gridPath(x0: number, y0: number, n: number, step: number): string {
  let d = "";
  const L = n * step;
  for (let i = 0; i <= n; i++) {
    const o = i * step;
    d += `M${(x0 + o).toFixed(1)},${y0.toFixed(1)}V${(y0 + L).toFixed(1)}M${x0.toFixed(1)},${(y0 + o).toFixed(1)}H${(x0 + L).toFixed(1)}`;
  }
  return d;
}

function renderImage(p: P, x0: number, y0: number, S: number, uid: string, Lx: Lb, size: number): { svg: string; h: number } {
  const parts: string[] = [];
  const c = count(p);
  const hatchId = `${uid}-pad`;
  parts.push(el("defs", {}, hatch(hatchId, C.ink3, 4, 1)));
  // The canvas the encoder sees: the image plus padding to whole cells.
  const canvasPx = p.mode === "tiles" ? c.tiles * TILE : p.mode === "native" ? c.side * 2 * p.patch : c.side * p.patch;
  const k = S / canvasPx;
  const img = p.edge * k;
  parts.push(el("rect", { x: x0, y: y0, width: S, height: S, fill: `url(#${hatchId})` }));
  parts.push(el("rect", { x: x0, y: y0, width: img, height: img, fill: C.panel }));
  const thin = { fill: "none", stroke: C.ink3, "stroke-width": 0.6 };
  if (p.mode === "single") {
    parts.push(el("path", { d: gridPath(x0, y0, c.side, p.patch * k), ...thin }));
  } else if (p.mode === "native") {
    parts.push(el("path", { d: gridPath(x0, y0, c.side * 2, p.patch * k), ...thin, "stroke-opacity": 0.6 }));
    parts.push(el("path", { d: gridPath(x0, y0, c.side, 2 * p.patch * k), fill: "none", stroke: C.c1, "stroke-width": 1 }));
  } else {
    const tilePx = TILE * k;
    for (let a = 0; a < c.tiles; a++) {
      for (let b = 0; b < c.tiles; b++) parts.push(el("path", { d: gridPath(x0 + a * tilePx, y0 + b * tilePx, c.side, tilePx / c.side), ...thin }));
    }
    parts.push(el("path", { d: gridPath(x0, y0, c.tiles, tilePx), fill: "none", stroke: C.c1, "stroke-width": 1.6 }));
  }
  parts.push(el("rect", { x: x0, y: y0, width: S, height: S, fill: "none", stroke: C.rule, "stroke-width": 1 }));
  let h = S;
  if (S - img >= 12) {
    parts.push(text(x0 + S - 3, y0 + S - 4, Lx.pad, { "font-size": size, "text-anchor": "end", class: "fig-t-halo fig-t-soft" }));
  }
  if (p.mode === "tiles") {
    // The global view: the whole image resized to one tile.
    const gS = Math.min(S * 0.42, 110);
    const gy = y0 + S + 12;
    parts.push(el("rect", { x: x0, y: gy, width: gS, height: gS, fill: C.panel }));
    parts.push(el("path", { d: gridPath(x0, gy, c.side, gS / c.side), ...thin }));
    parts.push(el("rect", { x: x0, y: gy, width: gS, height: gS, fill: "none", stroke: C.c1, "stroke-width": 1.6 }));
    parts.push(text(x0 + gS + 8, gy + size + 2, Lx.global, { "font-size": size, class: "fig-t-muted" }));
    h = gy + gS - y0;
  }
  return { svg: g({ class: "fig-image" }, ...parts), h };
}

function renderChart(p: P, x0: number, y0: number, w: number, h: number, Lx: Lb, size: number): string {
  const parts: string[] = [];
  const edges: number[] = [];
  for (let e = EDGE_MIN; e <= EDGE_MAX; e += 8) edges.push(e);
  const ns = edges.map((e) => count({ ...p, edge: e }).n);
  const top = Math.max(...ns, LLAVA15.n);
  const left = x0 + 40;
  const x = linear([EDGE_MIN, EDGE_MAX], [left, x0 + w - 18]);
  const yTop = y0 + 20;
  const y = linear([0, top * 1.08], [y0 + h, yTop]);
  parts.push(text(x0, y0 + size, Lx.chart, { "font-size": size, class: "fig-t-muted" }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, x0 + w - 18], ticks: y.ticks(4), format: (v) => int(v) }));
  parts.push(axis({ scale: x, orient: "bottom", at: y0 + h, ticks: [224, 448, 672, 896, 1120, 1344], title: Lx.x, format: (v) => int(v) }));
  // The step curve: N is constant between ceilings.
  const pts: Array<[number, number]> = [[x(edges[0]), y(ns[0])]];
  for (let i = 1; i < edges.length; i++) {
    pts.push([x(edges[i]), y(ns[i - 1])], [x(edges[i]), y(ns[i])]);
  }
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.c1, "stroke-width": 1.8, "stroke-linejoin": "round" }));
  // LLaVA-1.5 reference and the current point.
  const c = count(p);
  const cx = x(p.edge), cy = y(c.n);
  const rx = x(LLAVA15.edge), ry = y(LLAVA15.n);
  const same = Math.hypot(cx - rx, cy - ry) < 4;
  parts.push(el("circle", { cx: rx, cy: ry, r: 5.5, fill: "none", stroke: C.ink, "stroke-width": 1.4 }));
  parts.push(el("line", { x1: cx, x2: cx, y1: cy, y2: y0 + h, stroke: C.c2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx, cy, r: 4.5, fill: C.c2, stroke: C.paper, "stroke-width": 1.5 }));
  // Labels kept off the curve and each other.
  const obstacles: Box[] = [...lineObstacles(pts, 5, 2), { x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 }, { x0: rx - 7, y0: ry - 7, x1: rx + 7, y1: ry + 7 }];
  const reqs: LabelRequest[] = [{ x: cx, y: cy, text: same ? `${Lx.ref}: ${int(c.n)}` : int(c.n), size, gap: 9, priority: 2, sides: ["above-left", "left", "above", "above-right", "right", "below-right"], attrs: { class: "fig-t-halo fig-t-num" } }];
  if (!same) reqs.push({ x: rx, y: ry, text: Lx.ref, size, gap: 9, priority: 1, sides: ["above-left", "above", "left", "below-right", "right"], attrs: { class: "fig-t-halo fig-t-soft" } });
  const placed = placeLabels(reqs, { x0: left + 2, y0: yTop - 4, x1: x0 + w, y1: y0 + h - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  return g({ class: "fig-chart" }, ...parts);
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const c = count(p);
  const parts: string[] = [];
  parts.push(text(0, size, tpl(Lx.image, { e: p.edge, p: p.patch }), { "font-size": size, class: "fig-t-strong" }));
  let y = size + 10;
  let bottom: number;
  if (narrow) {
    const S = Math.min(w, 280);
    const im = renderImage(p, 0, y, S, st.uid, Lx, size);
    parts.push(im.svg);
    y += im.h + 22;
    const ch = 190;
    parts.push(renderChart(p, 0, y, w, ch, Lx, size));
    bottom = y + ch + axisHeight(true);
  } else {
    const S = 250;
    const im = renderImage(p, 0, y, S, st.uid, Lx, size);
    parts.push(im.svg);
    const ch = 250;
    parts.push(renderChart(p, S + 28, y - 2, w - S - 28, ch - 2, Lx, size));
    bottom = y + Math.max(im.h, ch + axisHeight(true) - 2);
  }
  y = bottom + 10;
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  const lines: Array<[string, string]> = [];
  if (p.mode === "single") lines.push([tpl(Lx.eqSingle, { e: p.edge, p: p.patch, s: c.side, n: int(c.n) }), "fig-t-num"]);
  if (p.mode === "tiles") {
    lines.push([tpl(Lx.eqTiles, { t: c.tiles, p: p.patch, k: c.tiles * c.tiles + 1, q: int(c.perTile), n: int(c.n) }), "fig-t-num"]);
    lines.push([tpl(Lx.tilesNote, { t: c.tiles, s: c.side }), "fig-t-muted fig-t-num"]);
  }
  if (p.mode === "native") {
    lines.push([tpl(Lx.eqNative, { e: p.edge, p: p.patch, s: c.side, n: int(c.n) }), "fig-t-num"]);
    lines.push([tpl(Lx.nativeNote, { g: c.side * 2, s: c.side }), "fig-t-muted fig-t-num"]);
  }
  lines.push([tpl(Lx.ratio, { r: sig(c.n / LLAVA15.n, 3) }), "fig-t-muted fig-t-num"]);
  for (const [line, cls] of lines) {
    for (const part of wrapCJK(line, size, w * 0.92)) {
      y += 17;
      parts.push(text(0, y, part, { "font-size": size, class: cls }));
    }
    y += 3;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "patch-grid",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    edge: {
      kind: "range", label: { en: "Image edge", zh: "图像边长" }, unit: { en: "px", zh: "像素" }, min: EDGE_MIN, max: EDGE_MAX, step: 8, default: 336,
      marks: [{ value: 336, label: { en: "336", zh: "336" } }, { value: 672, label: { en: "672", zh: "672" } }],
    },
    patch: {
      kind: "choice", label: { en: "Patch edge P", zh: "图块边长 P" }, default: 14,
      options: [{ value: 14, label: { en: "14 px", zh: "14 像素" } }, { value: 16, label: { en: "16 px", zh: "16 像素" } }],
    },
    mode: {
      kind: "choice", label: { en: "Encoding", zh: "编码方式" }, default: "single",
      options: [
        { value: "single", label: { en: "One crop", zh: "单次裁剪" } },
        { value: "tiles", label: { en: "336-px tiles + global view", zh: "336 像素分块 + 全局视图" } },
        { value: "native", label: { en: "Native, 2 × 2 merge", zh: "原生分辨率，2 × 2 合并" } },
      ],
    },
  },
  render,
  describe,
});
