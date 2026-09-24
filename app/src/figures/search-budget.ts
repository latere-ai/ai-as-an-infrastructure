// Node growth of a full search tree against a layer-wise beam, from the
// structured-search chapter's counts, on a fixed logarithmic axis.
//
// With branching b, a full tree to depth d holds
//   N_full(d) = Σ_{k=0}^{d} b^k = (b^{d+1} − 1) / (b − 1)   (d + 1 when b = 1).
// A beam of width w generates b children for every retained state and keeps
// the w best, so level k generates b · min(w, b^{k−1}) nodes and
//   N_beam(d) = 1 + Σ_{k=1}^{d} b · min(w, b^{k−1}),
// which equals the chapter's bound 1 + b + (d − 1) w b whenever w ≤ b and is
// below it otherwise. Both assume fixed branching, no duplicate states and no
// early termination. The budget B is a count of generated nodes; the figure
// reports the deepest level each strategy completes within it. Nothing here
// models accuracy: the counts say how much work a strategy does, not whether a
// valid path survives the pruning.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box, type Side } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { compact, int, tpl } from "./lib/format.ts";
import { mathText } from "./lib/math-text.ts";

const D_MAX = 10;
const Y_MAX = 1e8;

type P = { b: number; depth: number; width: number; budget: number };

export function fullCount(b: number, d: number): number {
  let n = 0, level = 1;
  for (let k = 0; k <= d; k++) { n += level; level *= b; }
  return n;
}
export function beamLevel(b: number, w: number, k: number): number {
  return k === 0 ? 1 : b * Math.min(w, b ** (k - 1));
}
export function beamCount(b: number, w: number, d: number): number {
  let n = 0;
  for (let k = 0; k <= d; k++) n += beamLevel(b, w, k);
  return n;
}
// Deepest level whose cumulative count fits the budget (-1: not even the root).
function reach(count: (d: number) => number, D: number, B: number): number {
  let d = -1;
  while (d < D && count(d + 1) <= B) d++;
  return d;
}

const labels = {
  en: {
    title: "Generated nodes of a full tree and a beam by depth",
    x: "depth d",
    y: "generated nodes up to depth d",
    full: "full tree",
    beam: "beam, width {w}",
    budget: "budget B = {B}",
    over: "over budget",
    both: "{n}, both",
    levels: "Children the beam generates at each depth",
    kept: "kept",
    pruned: "pruned",
    levelRow: "d = {d}",
    more: "+{k}",
    eqFull: "N_full = (b^(D+1) − 1) / (b − 1) = {n}",
    eqFullOne: "N_full = D + 1 = {n}",
    eqBeam: "N_beam = {n}, bound 1 + b + (D − 1)wb = {bound}",
    reachFull: "Within B, a full tree completes depth {d} of {D} ({n} nodes).",
    reachFullAll: "Within B, a full tree completes all {D} levels ({n} nodes).",
    reachFullNone: "B does not cover the root and its first children.",
    reachBeam: "The beam completes depth {d} of {D} ({n} nodes).",
    reachBeamAll: "The beam completes all {D} levels ({n} nodes).",
    describe: "Branching {b}, depth {D}, beam width {w}, budget {B} nodes: a full tree generates {nf} nodes and completes depth {df} within the budget; the beam generates {nb} and completes depth {db}.",
  },
  zh: {
    title: "完整树与束搜索按深度累计的生成节点数",
    x: "深度 d",
    y: "到深度 d 为止的生成节点数",
    full: "完整树",
    beam: "束，宽度 {w}",
    budget: "预算 B = {B}",
    over: "超出预算",
    both: "{n}，两者相同",
    levels: "束在每一层生成的子节点",
    kept: "保留",
    pruned: "剪掉",
    levelRow: "d = {d}",
    more: "+{k}",
    eqFull: "N_full = (b^(D+1) − 1) / (b − 1) = {n}",
    eqFullOne: "N_full = D + 1 = {n}",
    eqBeam: "N_beam = {n}，上界 1 + b + (D − 1)wb = {bound}",
    reachFull: "在预算 B 内，完整树只能完成 {D} 层中的前 {d} 层（{n} 个节点）。",
    reachFullAll: "在预算 B 内，完整树能完成全部 {D} 层（{n} 个节点）。",
    reachFullNone: "预算 B 不够生成根节点及其第一层子节点。",
    reachBeam: "束能完成 {D} 层中的前 {d} 层（{n} 个节点）。",
    reachBeamAll: "束能完成全部 {D} 层（{n} 个节点）。",
    describe: "分支数 {b}，深度 {D}，束宽 {w}，预算 {B} 个节点：完整树生成 {nf} 个节点，在预算内完成到深度 {df}；束生成 {nb} 个，完成到深度 {db}。",
  },
};
type L = typeof labels.en;

function model(p: P) {
  const { b, depth: D, width: w, budget: B } = p;
  const nf = fullCount(b, D);
  const nb = beamCount(b, w, D);
  const df = reach((d) => fullCount(b, d), D, B);
  const db = reach((d) => beamCount(b, w, d), D, B);
  return { b, D, w, B, nf, nb, df, db, bound: D >= 1 ? 1 + b + (D - 1) * w * b : 1 };
}

function describe(st: State<P>, lang: Lang): string {
  const m = model(st.p);
  return tpl(labels[lang].describe, { b: m.b, D: m.D, w: m.w, B: int(m.B), nf: int(m.nf), nb: int(m.nb), df: Math.max(0, m.df), db: Math.max(0, m.db) });
}

function lines(s: string, size: number, w: number): string[] {
  return wrapCjk(s, size, w);
}

function render(st: State<P>, lang: Lang): string {
  const L: L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const size = TYPE.body;
  const parts: string[] = [];

  // ---- chart
  let y = 0;
  const lg = legend([
    { label: L.full, swatch: { kind: "line", stroke: C.c2, dash: "5 3" } },
    { label: tpl(L.beam, { w: m.w }), swatch: { kind: "line", stroke: C.c1 } },
    { label: L.over, swatch: { kind: "rect", fill: C.bad, opacity: 0.12 } },
  ], 0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 22;
  const left = narrow ? 40 : 46;
  const right = narrow ? 8 : 12;
  const plotH = narrow ? 210 : 240;
  const top = y;
  const xs = linear([0, D_MAX], [left, w - right]);
  const ys = log([1, Y_MAX], [top + plotH, top]);
  const yb = ys(m.B);
  parts.push(el("rect", { x: left, y: top, width: w - right - left, height: Math.max(0, yb - top), fill: C.bad, "fill-opacity": 0.07 }));
  parts.push(axis({ scale: xs, orient: "bottom", at: top + plotH, ticks: Array.from({ length: D_MAX + 1 }, (_, i) => i), title: L.x, size }));
  parts.push(axis({ scale: ys, orient: "left", at: left, grid: [left, w - right], title: L.y, size, format: compact }));
  const ptsF: Array<[number, number]> = [], ptsB: Array<[number, number]> = [];
  for (let d = 0; d <= m.D; d++) {
    ptsF.push([xs(d), ys(fullCount(m.b, d))]);
    ptsB.push([xs(d), ys(beamCount(m.b, m.w, d))]);
  }
  const obstacles: Box[] = [...lineObstacles(ptsF), ...lineObstacles(ptsB)];
  // Budget line.
  parts.push(el("line", { x1: left, x2: w - right, y1: yb, y2: yb, stroke: C.ink, "stroke-width": 1.4, "stroke-dasharray": "6 3" }));
  obstacles.push(...lineObstacles([[left, yb], [w - right, yb]]));
  // The beam solid and the full tree dashed on top, so both stay visible over
  // the depths where the beam keeps every child and the counts coincide.
  parts.push(el("path", { d: linePath(ptsB), fill: "none", stroke: C.c1, "stroke-width": 2.2, "stroke-linejoin": "round" }));
  parts.push(el("path", { d: linePath(ptsF), fill: "none", stroke: C.c2, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-dasharray": "5 3" }));
  for (let d = 0; d <= m.D; d++) {
    const over = (n: number) => n > m.B;
    const nF = fullCount(m.b, d), nB = beamCount(m.b, m.w, d);
    parts.push(el("circle", { cx: ptsF[d][0], cy: ptsF[d][1], r: 3.5, fill: over(nF) ? C.paper : C.c2, stroke: C.c2, "stroke-width": 1.5 }));
    parts.push(el("circle", { cx: ptsB[d][0], cy: ptsB[d][1], r: 3.5, fill: over(nB) ? C.paper : C.c1, stroke: C.c1, "stroke-width": 1.5 }));
    obstacles.push({ x0: ptsF[d][0] - 5, y0: ptsF[d][1] - 5, x1: ptsF[d][0] + 5, y1: ptsF[d][1] + 5 });
    obstacles.push({ x0: ptsB[d][0] - 5, y0: ptsB[d][1] - 5, x1: ptsB[d][0] + 5, y1: ptsB[d][1] + 5 });
  }
  const same = m.nf === m.nb;
  const placed = placeLabels([
    { x: ptsF[m.D][0], y: ptsF[m.D][1], text: same ? tpl(L.both, { n: int(m.nf) }) : int(m.nf), size, sides: ["right", "above", "above-left", "left", "below-right"], gap: 8, priority: 3, attrs: { class: "fig-t-halo fig-t-num" } },
    ...(same ? [] : [{ x: ptsB[m.D][0], y: ptsB[m.D][1], text: int(m.nb), size, sides: ["right", "below", "below-left", "above-right", "left"] as Side[], gap: 8, priority: 2, attrs: { class: "fig-t-halo fig-t-num" } }]),
    { x: w - right - 4, y: yb, text: tpl(L.budget, { B: int(m.B) }), size, sides: ["above-left", "below-left"], gap: 6, priority: 4, attrs: { class: "fig-t-halo" } },
  ], { x0: left + 2, y0: top + 2, x1: w - right, y1: top + plotH - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  y = top + plotH + axisHeight(true, size) + 10;

  // ---- equations and what fits the budget
  const full = m.b === 1 ? tpl(L.eqFullOne, { n: int(m.nf) }) : tpl(L.eqFull, { n: int(m.nf) });
  const beam = tpl(L.eqBeam, { n: int(m.nb), bound: int(m.bound) });
  const rf = m.df < 0 ? L.reachFullNone : m.df >= m.D ? tpl(L.reachFullAll, { D: m.D, n: int(m.nf) }) : tpl(L.reachFull, { d: m.df, D: m.D, n: int(fullCount(m.b, m.df)) });
  const rb = m.db >= m.D ? tpl(L.reachBeamAll, { D: m.D, n: int(m.nb) }) : m.db < 0 ? "" : tpl(L.reachBeam, { d: m.db, D: m.D, n: int(beamCount(m.b, m.w, m.db)) });
  for (const [s, cls] of [[full, "fig-t-num"], [beam, "fig-t-num"], [rf, "fig-t-strong"], [rb, "fig-t-strong"]] as const) {
    if (!s) continue;
    for (const ln of lines(s, size, w)) { y += size + 5; parts.push(mathText(0, y, ln, { "font-size": size, class: cls })); }
  }
  y += 18;

  // ---- per level: the beam's generated children, kept and pruned
  parts.push(text(0, y + TYPE.label, L.levels, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += TYPE.label + 8;
  const lg2 = legend([
    { label: L.kept, swatch: { kind: "dot", fill: C.c1 } },
    { label: L.pruned, swatch: { kind: "dot", fill: C.ink3 } },
  ], 0, y, w, size);
  parts.push(lg2.svg);
  y += lg2.height + 4;
  const rowLabelW = textWidth("d = 10", size) + 10;
  const fullW = Math.max(textWidth(L.full, size), textWidth(int(m.b ** m.D), size)) + 12;
  const pitch = narrow ? 7 : 8;
  const maxGen = Math.max(...Array.from({ length: m.D }, (_, i) => beamLevel(m.b, m.w, i + 1)));
  const moreW = textWidth(tpl(L.more, { k: int(maxGen) }), size) + 10;
  const cap = Math.max(4, Math.floor((w - rowLabelW - fullW - moreW) / pitch));
  const rowH = 15;
  // Column head for the full tree's count at each depth.
  parts.push(text(w, y + size, L.full, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  y += size + 4;
  for (let d = 1; d <= m.D; d++) {
    const gen = beamLevel(m.b, m.w, d);
    const kept = d === m.D ? gen : Math.min(m.w, gen);
    const cy = y + rowH / 2 + 2;
    parts.push(text(rowLabelW - 10, cy + 4, tpl(L.levelRow, { d }), { "font-size": size, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    const shown = Math.min(gen, cap);
    for (let i = 0; i < shown; i++) {
      const cx = rowLabelW + i * pitch + 3;
      parts.push(el("circle", { cx, cy, r: narrow ? 2.6 : 3, fill: i < kept ? C.c1 : C.ink3, "fill-opacity": i < kept ? 1 : 0.55 }));
    }
    if (gen > shown) parts.push(text(rowLabelW + shown * pitch + 4, cy + 4, tpl(L.more, { k: int(gen - shown) }), { "font-size": size, class: "fig-t-muted fig-t-num" }));
    parts.push(text(w, cy + 4, int(b0(m.b, d)), { "font-size": size, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    y += rowH;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

// Nodes at depth d of the full tree.
function b0(b: number, d: number): number {
  return b ** d;
}

export default defineFigure({
  name: "search-budget",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    b: { kind: "range", label: { en: "Branching b", zh: "分支数 b" }, min: 1, max: 6, step: 1, default: 4 },
    depth: { kind: "range", label: { en: "Depth D", zh: "深度 D" }, min: 1, max: D_MAX, step: 1, default: 8 },
    width: { kind: "range", label: { en: "Beam width w", zh: "束宽 w" }, min: 1, max: 16, step: 1, default: 5 },
    budget: {
      kind: "range", scale: "log", label: { en: "Budget B", zh: "预算 B" }, unit: { en: "generated nodes", zh: "个生成节点" },
      min: 10, max: 1e7, default: 1000,
    },
  },
  render,
  describe,
});
