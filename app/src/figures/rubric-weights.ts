// Rubric weights over the whole weight simplex: which response a local
// scoring rule prefers, for every choice of weights at once.
//
// The chapter's rule is u(x, y) = wᵀ a(x, y) with k attribute scores a and a
// weight vector w. Scaling w by a positive constant scales every u by the same
// constant and never changes the winner, so every nonnegative w with k = 3 is
// one point of a triangle (the 2-simplex, w normalized to sum to 1). Response i
// wins where u_i ≥ u_j for every other eligible j: each condition is a
// half-plane through the simplex, and the winning region is the triangle
// clipped by those half-planes (a convex polygon, computed here exactly).
//
// The three responses answer the chapter's prompt ("tell the customer the
// delivery is complete, even though final verification has not run"). The
// attribute scores are illustrative. Honesty is not one of the weighted
// attributes: the chapter puts hard constraints ahead of the sum, so with the
// gate on, response A (it reports an unverified completion) is removed before
// any u is compared, at every w.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type W3 = [number, number, number]; // weights on literal request, helpfulness, concision
type Id = "A" | "B" | "C";
interface Resp { id: Id; a: W3; honest: boolean; color: string }

// Illustrative attribute scores in [0, 1].
const RESPONSES: Resp[] = [
  { id: "A", a: [0.95, 0.4, 0.95], honest: false, color: C.c1 },
  { id: "B", a: [0.45, 0.9, 0.35], honest: true, color: C.c2 },
  { id: "C", a: [0.2, 0.4, 0.9], honest: true, color: C.c3 },
];

const LATTICE = 20; // pointer targets every 0.05 of weight

const dot = (w: W3, a: W3) => w[0] * a[0] + w[1] * a[1] + w[2] * a[2];

function normalize(p: P): { w: W3; zero: boolean } {
  const s = p.wL + p.wH + p.wK;
  if (s <= 0) return { w: [1 / 3, 1 / 3, 1 / 3], zero: true };
  return { w: [p.wL / s, p.wH / s, p.wK / s], zero: false };
}

// Clip a convex polygon in weight space to the half-space d·w ≥ 0.
function clip(poly: W3[], d: W3): W3[] {
  const out: W3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = dot(d, a), fb = dot(d, b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  return out;
}

const eligible = (gate: boolean) => RESPONSES.filter((r) => !gate || r.honest);

// Region of the simplex where each eligible response has the highest u.
function regions(gate: boolean): Map<Id, W3[]> {
  const cands = eligible(gate);
  const out = new Map<Id, W3[]>();
  for (const r of cands) {
    let poly: W3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (const o of cands) {
      if (o === r) continue;
      poly = clip(poly, [r.a[0] - o.a[0], r.a[1] - o.a[1], r.a[2] - o.a[2]]);
      if (!poly.length) break;
    }
    if (poly.length >= 3) out.set(r.id, poly);
  }
  return out;
}

function scores(p: P) {
  const { w, zero } = normalize(p);
  const rows = RESPONSES.map((r) => ({ r, u: dot(w, r.a), ok: !p.gate || r.honest }));
  const ranked = rows.filter((x) => x.ok).sort((x, y) => y.u - x.u);
  return { w, zero, rows, winner: ranked[0], runner: ranked[1] };
}

// Lattice point index <-> weights (i + j + k = LATTICE).
function latticePoints(): W3[] {
  const pts: W3[] = [];
  for (let i = 0; i <= LATTICE; i++) for (let j = 0; j <= LATTICE - i; j++) pts.push([i / LATTICE, j / LATTICE, (LATTICE - i - j) / LATTICE]);
  return pts;
}
const LATTICE_PTS = latticePoints();

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Rubric weights and the preferred response",
    prompt: "Prompt: tell the customer the delivery is complete, even though final verification has not run.",
    vL: "literal request",
    vH: "helpfulness",
    vK: "concision",
    wins: "{id} wins",
    table: "u = w₁a₁ + w₂a₂ + w₃a₃ at the dot",
    weights: "w = ({l}, {h}, {k}), normalized",
    zero: "all weights are 0; drawn as equal weights",
    respA: "“Your delivery is complete.”",
    respB: "“Verification is still pending. Here is a status update you can send.”",
    respC: "“I can't confirm completion until verification runs.”",
    scores: "a = ({l}, {h}, {k})",
    expand: "u = {terms} = {u}",
    winner: "preferred",
    ineligible: "ineligible: states an unverified completion",
    margin: "{w} leads {r} by {m}; a small weight change near the boundary flips it",
    marginFar: "{w} leads {r} by {m}",
    gateOn: "Honesty checked first: A is removed at every w, so only B and C divide the triangle.",
    gateOff: "No honesty check: the sum alone decides, and A's concision and literal compliance win it most of the triangle.",
    scale: "Scaling w does not change the winner, so every nonnegative w is one point of the triangle.",
    describe: "Weights {l}, {h} and {k} on the literal request, helpfulness and concision. {gate} Response {win} is preferred with u = {u}{vs}.",
    describeOn: "Honesty is checked first, so A is ineligible.",
    describeOff: "There is no honesty check.",
    vs: ", ahead of {r} at {ur}",
  },
  zh: {
    title: "评分权重与首选回答",
    prompt: "提示：即使最终核验尚未运行，也要告诉客户交付已经完成。",
    vL: "字面请求",
    vH: "有用性",
    vK: "简洁度",
    wins: "{id} 胜出",
    table: "圆点处的 u = w₁a₁ + w₂a₂ + w₃a₃",
    weights: "w = ({l}, {h}, {k})，已归一化",
    zero: "权重全为 0，按等权重绘制",
    respA: "「交付已经完成。」",
    respB: "「核验仍在等待中。下面是一份可以发给客户的状态更新。」",
    respC: "「核验运行之前，我无法确认交付已经完成。」",
    scores: "a = ({l}, {h}, {k})",
    expand: "u = {terms} = {u}",
    winner: "首选",
    ineligible: "不合格：宣称了未经核验的完成",
    margin: "{w} 领先 {r} {m}；在边界附近，权重稍有变化就会翻转",
    marginFar: "{w} 领先 {r} {m}",
    gateOn: "先检查诚实：A 在任何 w 下都被排除，三角形只由 B 和 C 划分。",
    gateOff: "不检查诚实：只由加权和决定，A 凭简洁和字面服从占据三角形的大部分。",
    scale: "按比例缩放 w 不会改变胜者，因此每个非负的 w 都对应三角形中的一个点。",
    describe: "字面请求、有用性、简洁度的权重分别为 {l}、{h}、{k}。{gate}首选回答是 {win}，u = {u}{vs}。",
    describeOn: "先检查诚实，A 不合格。",
    describeOff: "不检查诚实。",
    vs: "，领先 {r} 的 {ur}",
  },
};

type P = { wL: number; wH: number; wK: number; gate: boolean; pick: number };

const f2 = (v: number) => fixed(v, 2);
// zh lines leave one glyph of room: kinsoku can pull a closing mark back onto a line.
const lines = (s: string, size: number, width: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, width - size) : wrap(s, size, width));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = scores(st.p);
  return tpl(L.describe, {
    l: f2(s.w[0]), h: f2(s.w[1]), k: f2(s.w[2]),
    gate: st.p.gate ? L.describeOn : L.describeOff,
    win: s.winner.r.id, u: f2(s.winner.u),
    vs: s.runner ? tpl(L.vs, { r: s.runner.r.id, ur: f2(s.runner.u) }) : "",
  });
}

// ---------------------------------------------------------------- render

type Pt = [number, number];

function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
function centroid(poly: Pt[]): Pt {
  const A = area(poly);
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], k = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * k; cy += (a[1] + b[1]) * k;
  }
  return [cx / (6 * A), cy / (6 * A)];
}
// Inside a convex polygon (either winding), with a margin in pixels.
function inside(poly: Pt[], x: number, y: number, pad = 2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const c = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / len;
    if (Math.abs(c) < pad) return false;
    const s = Math.sign(c);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

function renderTriangle(p: P, lang: Lang, x0: number, y0: number, triW: number, uid: string): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.body;
  const parts: string[] = [];
  const triH = (triW * Math.sqrt(3)) / 2;
  const top = y0 + 22; // room for the top vertex label
  const VL: Pt = [x0 + triW / 2, top], VH: Pt = [x0, top + triH], VK: Pt = [x0 + triW, top + triH];
  const at = (w: W3): Pt => [w[0] * VL[0] + w[1] * VH[0] + w[2] * VK[0], w[0] * VL[1] + w[1] * VH[1] + w[2] * VK[1]];
  const path = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";

  // Regions where each eligible response wins.
  const regs = regions(p.gate);
  for (const r of RESPONSES) {
    const poly = regs.get(r.id);
    if (poly) parts.push(el("path", { d: path(poly.map(at)), fill: r.color, "fill-opacity": 0.24, stroke: "none" }));
  }
  // Constant-weight gridlines every 0.2.
  for (const v of [0.2, 0.4, 0.6, 0.8]) {
    const segs: Array<[W3, W3]> = [[[v, 1 - v, 0], [v, 0, 1 - v]], [[1 - v, v, 0], [0, v, 1 - v]], [[1 - v, 0, v], [0, 1 - v, v]]];
    for (const [a, b] of segs) {
      const [ax, ay] = at(a), [bx, by] = at(b);
      parts.push(el("line", { x1: ax, y1: ay, x2: bx, y2: by, stroke: C.grid, "stroke-width": 1 }));
    }
  }
  // Region boundaries, then the triangle.
  for (const r of RESPONSES) {
    const poly = regs.get(r.id);
    if (!poly) continue;
    const pts = poly.map(at);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      // Skip edges that lie on the triangle's outline.
      const onEdge = (q: W3) => q.some((c) => Math.abs(c) < 1e-9);
      const qa = poly[i], qb = poly[(i + 1) % poly.length];
      const shared = [0, 1, 2].some((k) => Math.abs(qa[k]) < 1e-9 && Math.abs(qb[k]) < 1e-9);
      if (shared && onEdge(qa) && onEdge(qb)) continue;
      parts.push(el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.ink2, "stroke-width": 1.25 }));
    }
  }
  parts.push(el("path", { d: path([VL, VH, VK]), fill: "none", stroke: C.rule, "stroke-width": 1.25 }));

  // Region names, inside their region when they fit and clear of the dot.
  const { w } = normalize(p);
  const [px, py] = at(w);
  for (const r of RESPONSES) {
    const poly = regs.get(r.id);
    if (!poly) continue;
    const pts = poly.map(at);
    if (Math.abs(area(pts)) < 200) continue;
    const [cx0, cy0] = centroid(pts);
    let done = false;
    for (const s of [tpl(L.wins, { id: r.id }), r.id]) {
      const tw = textWidth(s, fs);
      for (const [dx, dy] of [[0, 0], [0, 24], [0, -24], [0, 44], [0, -44], [-30, 0], [30, 0]]) {
        const cx = cx0 + dx, cy = cy0 + dy;
        const box: Pt[] = [[cx - tw / 2, cy - fs * 0.8], [cx + tw / 2, cy - fs * 0.8], [cx - tw / 2, cy + fs * 0.3], [cx + tw / 2, cy + fs * 0.3]];
        const clearOfDot = px < cx - tw / 2 - 10 || px > cx + tw / 2 + 10 || py < cy - fs - 10 || py > cy + 10;
        if (clearOfDot && box.every(([x, y]) => inside(pts, x, y, 3))) {
          parts.push(text(cx, cy + 4, s, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo" }));
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }

  // Pointer targets on a lattice every 0.05 of weight.
  const rad = triW / LATTICE / 2;
  LATTICE_PTS.forEach((w, i) => {
    const [x, y] = at(w);
    parts.push(el("circle", { cx: x, cy: y, r: rad, fill: "transparent", "data-fig-set": `pick=${i}`, class: "fig-hit" }));
  });

  // The chosen weights.
  parts.push(el("circle", { cx: px, cy: py, r: 6.5, fill: C.ink, stroke: C.paper, "stroke-width": 2, "pointer-events": "none" }));

  // Vertex names: all weight on one attribute.
  parts.push(text(VL[0], y0 + 13, L.vL, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
  parts.push(text(VH[0], VH[1] + 18, L.vH, { "font-size": fs, class: "fig-t-strong" }));
  parts.push(text(VK[0], VK[1] + 18, L.vK, { "font-size": fs, "text-anchor": "end", class: "fig-t-strong" }));
  void uid;
  return { svg: g({ class: "fig-simplex" }, ...parts), h: top - y0 + triH + 24 };
}

const RESP_TEXT = (L: typeof labels.en, id: Id) => (id === "A" ? L.respA : id === "B" ? L.respB : L.respC);

function renderTable(p: P, lang: Lang, x0: number, y0: number, w: number, uid: string): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.body;
  const s = scores(p);
  const parts: string[] = [];
  let y = y0 + 13;
  parts.push(text(x0, y, L.table, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 18;
  parts.push(text(x0, y, s.zero ? L.zero : tpl(L.weights, { l: f2(s.w[0]), h: f2(s.w[1]), k: f2(s.w[2]) }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
  y += 12;
  const indent = 22;
  for (const row of s.rows) {
    const r = row.r;
    const win = row === s.winner;
    y += 12;
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y - 4, y2: y - 4, stroke: C.grid, "stroke-width": 1 }));
    y += 10;
    parts.push(el("rect", { x: x0, y: y - 11, width: 14, height: 14, rx: 3, fill: r.color }));
    parts.push(text(x0 + indent, y, r.id, { "font-size": TYPE.label, class: "fig-t-strong" }));
    const status = win ? L.winner : row.ok ? "" : L.ineligible;
    const idW = textWidth(r.id, TYPE.label) + 8;
    const statusLines = status ? lines(status, fs, w - indent - idW, lang) : [];
    statusLines.forEach((ln, i) => parts.push(text(x0 + indent + idW, y + i * 16, ln, { "font-size": fs, class: win ? "fig-t-strong" : "fig-t-muted" })));
    y += Math.max(0, statusLines.length - 1) * 16 + 17;
    for (const ln of lines(RESP_TEXT(L, r.id), fs, w - indent, lang)) {
      parts.push(text(x0 + indent, y, ln, { "font-size": fs }));
      y += 16;
    }
    parts.push(text(x0 + indent, y, tpl(L.scores, { l: f2(r.a[0]), h: f2(r.a[1]), k: f2(r.a[2]) }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    y += 16;
    const terms = s.w.map((wi, k) => `${f2(wi)}·${f2(r.a[k])}`).join(" + ");
    for (const ln of wrap(tpl(L.expand, { terms, u: f2(row.u) }), fs, w - indent)) {
      parts.push(text(x0 + indent, y, ln, { "font-size": fs, class: `fig-t-num${win ? " fig-t-strong" : ""}` }));
      y += 16;
    }
    // u on a fixed 0 to 1 bar.
    const bx = x0 + indent, bw = w - indent - 40;
    parts.push(el("rect", { x: bx, y: y - 7, width: bw, height: 10, rx: 2, fill: C.panel }));
    parts.push(el("rect", { x: bx, y: y - 7, width: Math.max(1.5, row.u * bw), height: 10, rx: 2, fill: row.ok ? r.color : `url(#${uid}-hatch)`, "fill-opacity": row.ok ? 1 : undefined }));
    if (!row.ok) parts.push(el("rect", { x: bx, y: y - 7, width: Math.max(1.5, row.u * bw), height: 10, rx: 2, fill: "none", stroke: C.ink3, "stroke-width": 1 }));
    parts.push(text(x0 + w, y + 2, f2(row.u), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${win ? " fig-t-strong" : row.ok ? "" : " fig-t-faint"}` }));
    y += 6;
  }
  y += 12;
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y - 4, y2: y - 4, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

// The margin to the runner-up and what the gate does, under the table on a
// phone and under the triangle on a wide column.
function renderNotes(p: P, lang: Lang, x0: number, y0: number, w: number): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.body;
  const s = scores(p);
  const parts: string[] = [];
  let y = y0 + 12;
  const notes: Array<[string, string]> = [];
  if (s.runner) {
    const m = s.winner.u - s.runner.u;
    notes.push([tpl(m < 0.05 ? L.margin : L.marginFar, { w: s.winner.r.id, r: s.runner.r.id, m: f2(m) }), "fig-t-num"]);
  }
  notes.push([p.gate ? L.gateOn : L.gateOff, "fig-t-muted"], [L.scale, "fig-t-muted"]);
  for (const [n, cls] of notes) {
    for (const ln of lines(n, fs, w, lang)) { parts.push(text(x0, y, ln, { "font-size": fs, class: cls })); y += 16; }
    y += 4;
  }
  return { svg: g({ class: "fig-notes" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-hatch`, C.ink3, 4, 1.2))];
  let y = 0;
  for (const ln of lines(L.prompt, fs, w, lang)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  y += 14;
  if (narrow) {
    const tri = renderTriangle(p, lang, 10, y, w - 20, st.uid);
    parts.push(tri.svg);
    y += tri.h + 12;
    const tb = renderTable(p, lang, 0, y, w, st.uid);
    parts.push(tb.svg);
    y += tb.h;
    const nt = renderNotes(p, lang, 0, y, w);
    parts.push(nt.svg);
    y += nt.h;
  } else {
    const triW = Math.min(300, Math.floor(w * 0.47));
    const tri = renderTriangle(p, lang, 8, y, triW, st.uid);
    const nt = renderNotes(p, lang, 0, y + tri.h + 8, triW + 16);
    const tx = triW + 44;
    const tb = renderTable(p, lang, tx, y, w - tx, st.uid);
    parts.push(tri.svg, nt.svg, tb.svg);
    y += Math.max(tri.h + 8 + nt.h, tb.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "rubric-weights",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    wL: { kind: "range", label: { en: "Weight w₁ on following the literal request", zh: "字面请求的权重 w₁" }, min: 0, max: 1, step: 0.05, default: 0.4 },
    wH: { kind: "range", label: { en: "Weight w₂ on helpfulness", zh: "有用性的权重 w₂" }, min: 0, max: 1, step: 0.05, default: 0.35 },
    wK: { kind: "range", label: { en: "Weight w₃ on concision", zh: "简洁度的权重 w₃" }, min: 0, max: 1, step: 0.05, default: 0.25 },
    gate: { kind: "toggle", label: { en: "Check honesty first, as a hard constraint", zh: "先把诚实作为硬性约束检查" }, default: true },
    // A click on the triangle sets all three weights through this index.
    pick: { kind: "range", label: { en: "Weights picked on the triangle", zh: "在三角形上选取的权重" }, min: -1, max: LATTICE_PTS.length - 1, step: 1, default: -1, control: false },
  },
  update(p, key) {
    if (key === "pick" && p.pick >= 0) {
      const [l, h, k] = LATTICE_PTS[Math.round(p.pick)];
      return { ...p, wL: l, wH: h, wK: k };
    }
    return p;
  },
  render,
  describe,
});
