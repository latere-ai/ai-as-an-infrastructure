// Forward and reverse KL for a student too small to hold every teacher mode.
//
// The teacher q_T is a next-token distribution over V = 40 tokens ordered
// along one axis: two peaks of width WIDTH tokens placed `gap` tokens apart
// around the middle, with a share `share` of the mass on the right peak, and
// a floor that spreads FLOOR of the mass evenly (a softmax never reaches
// zero), which puts 1e-4 on every token:
//
//   q_T(v) = (1 − FLOOR) · mix(v) / Σ mix + FLOOR / V,
//   mix(v) = (1 − share) · exp(−(v − c₁)² / 2 WIDTH²) + share · exp(−(v − c₂)² / 2 WIDTH²).
//
// The student family can form one peak only, a softmax of a quadratic in the
// token index:
//
//   p_S(v) ∝ exp(−(v − μ)² / 2σ²),   0 ≤ μ ≤ 39,   0.3 ≤ σ ≤ 25.
//
// Two students are fitted, one per direction of the chapter's divergence:
// argmin D_KL(q_T‖p_S) and argmin D_KL(p_S‖q_T) over (μ, σ). Each fit is a
// deterministic search: a grid of μ in half-token steps by 49 log-spaced σ,
// then 14 rounds of an 11 × 11 grid that shrinks 2.5× per round around the
// best point, which pins μ and log σ far below the drawing's resolution.
// Reverse KL is not convex in (μ, σ): with separated modes it has one minimum
// per mode, so the search runs on each half of the axis. The lower of the two
// is the fit (ties go to the left mode) and the other, when it is a true
// interior minimum, is reported as the second solution.
//
// Every number is computed from these definitions; the teacher is synthetic.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, esc, r as rd, linePath, type Attrs } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const V = 40;
const MID = (V - 1) / 2;
const WIDTH = 1.5;
const FLOOR = 0.004;
const LOW = 0.001; // "tokens the teacher rarely emits": q_T(v) below 0.1%
const LS0 = Math.log(0.3), LS1 = Math.log(25);

function teacher(gap: number, share: number): Float64Array {
  const c1 = MID - gap / 2, c2 = MID + gap / 2;
  const mix = new Float64Array(V);
  let z = 0;
  for (let v = 0; v < V; v++) {
    mix[v] = (1 - share) * Math.exp(-((v - c1) ** 2) / (2 * WIDTH * WIDTH)) + share * Math.exp(-((v - c2) ** 2) / (2 * WIDTH * WIDTH));
    z += mix[v];
  }
  for (let v = 0; v < V; v++) mix[v] = (1 - FLOOR) * mix[v] / z + FLOOR / V;
  return mix;
}

function student(mu: number, sigma: number, out = new Float64Array(V)): Float64Array {
  let mx = -Infinity;
  for (let v = 0; v < V; v++) { out[v] = -((v - mu) ** 2) / (2 * sigma * sigma); if (out[v] > mx) mx = out[v]; }
  let z = 0;
  for (let v = 0; v < V; v++) { out[v] = Math.exp(out[v] - mx); z += out[v]; }
  for (let v = 0; v < V; v++) out[v] /= z;
  return out;
}

// Per-token terms a(v) log(a(v) / b(v)) of D_KL(a‖b), and their sum.
function terms(a: Float64Array, b: Float64Array): Float64Array {
  const t = new Float64Array(V);
  for (let v = 0; v < V; v++) t[v] = a[v] > 0 ? a[v] * Math.log(a[v] / b[v]) : 0;
  return t;
}
const kl = (a: Float64Array, b: Float64Array) => terms(a, b).reduce((s, x) => s + x, 0);

interface Fit { mu: number; sigma: number; p: Float64Array; fwd: number; rev: number; low: number }

// argmin over μ in [lo, hi] and σ in [0.3, 25] of D_KL(q‖p_S) (dir "fwd") or
// D_KL(p_S‖q) (dir "rev").
function search(q: Float64Array, dir: "fwd" | "rev", lo: number, hi: number): { mu: number; ls: number; loss: number } {
  const scratch = new Float64Array(V);
  const loss = (mu: number, ls: number) => {
    const p = student(mu, Math.exp(ls), scratch);
    let s = 0;
    for (let v = 0; v < V; v++) s += dir === "fwd" ? q[v] * Math.log(q[v] / p[v]) : (p[v] > 0 ? p[v] * Math.log(p[v] / q[v]) : 0);
    return s;
  };
  let best = { mu: lo, ls: LS0, loss: Infinity };
  for (let mu = lo; mu <= hi + 1e-9; mu += 0.5) {
    for (let k = 0; k <= 48; k++) {
      const ls = LS0 + ((LS1 - LS0) * k) / 48;
      const l = loss(mu, ls);
      if (l < best.loss) best = { mu, ls, loss: l };
    }
  }
  let hm = 0.5, hl = (LS1 - LS0) / 48;
  for (let round = 0; round < 14; round++) {
    const c = best;
    for (let a = -5; a <= 5; a++) {
      for (let b = -5; b <= 5; b++) {
        const mu = Math.min(hi, Math.max(lo, c.mu + (a * hm) / 5));
        const ls = Math.min(LS1, Math.max(LS0, c.ls + (b * hl) / 5));
        const l = loss(mu, ls);
        if (l < best.loss) best = { mu, ls, loss: l };
      }
    }
    hm /= 2.5;
    hl /= 2.5;
  }
  return best;
}

function toFit(q: Float64Array, s: { mu: number; ls: number }): Fit {
  const p = student(s.mu, Math.exp(s.ls));
  let low = 0;
  for (let v = 0; v < V; v++) if (q[v] < LOW) low += p[v];
  return { mu: s.mu, sigma: Math.exp(s.ls), p, fwd: kl(q, p), rev: kl(p, q), low };
}

interface Model {
  q: Float64Array;
  massL: number; // teacher mass left and right of the middle
  massR: number;
  fwd: Fit;
  rev: Fit;
  other: Fit | null; // the reverse-KL minimum on the other mode, if there is one
}

const memo = new Map<string, Model>();

function model(p: P): Model {
  const key = `${p.gap}|${p.share}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const q = teacher(p.gap, p.share);
  let massL = 0;
  for (let v = 0; v < V; v++) if (v < MID) massL += q[v];
  const fwd = toFit(q, search(q, "fwd", 0, V - 1));
  const left = search(q, "rev", 0, MID);
  const right = search(q, "rev", MID, V - 1);
  const rightWins = right.loss < left.loss - 1e-9;
  const win = rightWins ? right : left, lose = rightWins ? left : right;
  // A half's minimum is a separate solution only if it is interior (not
  // pressed against the middle, where the other half's search continues).
  const interior = (s: { mu: number }) => Math.abs(s.mu - MID) > 0.05;
  const other = interior(win) && interior(lose) && Math.abs(win.mu - lose.mu) > 1 ? toFit(q, lose) : null;
  const out: Model = { q, massL, massR: 1 - massL, fwd, rev: toFit(q, win), other };
  if (memo.size > 48) memo.clear();
  memo.set(key, out);
  return out;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Forward and reverse KL for a student with one peak",
    teacher: "teacher q_T",
    fwdFit: "forward-KL fit",
    revFit: "reverse-KL fit",
    lowKey: "q_T(v) < 0.1%",
    dists: "Next-token distributions over 40 ordered tokens",
    distsSub: "Percentages below the axis: the teacher's mass in each mode.",
    distsSubMerged: "The teacher's two modes overlap.",
    y: "probability",
    x: "token index v",
    termsFwd: "Per-token terms of D_KL(q_T‖p_S)",
    termsRev: "Per-token terms of D_KL(p_S‖q_T)",
    termsFwdSub: "q_T(v) log(q_T(v) / p_S(v)): each log ratio weighted by the teacher",
    termsRevSub: "p_S(v) log(p_S(v) / q_T(v)): each log ratio weighted by the student",
    nats: "nats",
    colF: "D_KL(q_T‖p_S)",
    colR: "D_KL(p_S‖q_T)",
    colLow: "mass on q_T < 0.1%",
    fit: "μ = {mu}, σ = {s}",
    rowNarrow: "D_KL(q_T‖p_S) = {f}, D_KL(p_S‖q_T) = {r}",
    lowNarrow: "{m} of its mass on tokens with q_T < 0.1%",
    boldNote: "Bold: the divergence each fit minimizes over the one-peak family.",
    other: "Reverse KL has a second minimum on the {side} mode, at μ = {mu} with D_KL(p_S‖q_T) = {r}.",
    left: "left", right: "right",
    describe: "Teacher modes {gap} tokens apart with {share} of the mass on the right one. The forward-KL student peaks at token {fmu} with width {fs} and puts {flow} of its mass on tokens the teacher gives under 0.1%; the reverse-KL student peaks at token {rmu} with width {rs} and puts {rlow} there. Forward KL: {ff} against {rf}. Reverse KL: {fr} against {rr}.",
  },
  zh: {
    title: "单峰学生的正向 KL 与反向 KL",
    teacher: "教师 q_T",
    fwdFit: "正向 KL 拟合",
    revFit: "反向 KL 拟合",
    lowKey: "q_T(v) < 0.1%",
    dists: "40 个有序词元上的下一词元分布",
    distsSub: "横轴下方的百分数：教师在各峰上的概率质量。",
    distsSubMerged: "教师的两个峰相互重叠。",
    y: "概率",
    x: "词元序号 v",
    termsFwd: "D_KL(q_T‖p_S) 的逐词元项",
    termsRev: "D_KL(p_S‖q_T) 的逐词元项",
    termsFwdSub: "q_T(v) log(q_T(v) / p_S(v))：对数比按教师概率加权",
    termsRevSub: "p_S(v) log(p_S(v) / q_T(v))：对数比按学生概率加权",
    nats: "奈特",
    colF: "D_KL(q_T‖p_S)",
    colR: "D_KL(p_S‖q_T)",
    colLow: "落在 q_T < 0.1% 的质量",
    fit: "μ = {mu}，σ = {s}",
    rowNarrow: "D_KL(q_T‖p_S) = {f}，D_KL(p_S‖q_T) = {r}",
    lowNarrow: "{m} 的概率质量落在 q_T < 0.1% 的词元上",
    boldNote: "粗体：各拟合在单峰分布族中最小化的那个散度。",
    other: "反向 KL 在{side}峰上还有一个极小值：μ = {mu}，D_KL(p_S‖q_T) = {r}。",
    left: "左", right: "右",
    describe: "教师的两个峰相距 {gap} 个词元，右峰占 {share} 的概率质量。正向 KL 学生的峰位于词元 {fmu}，宽度 {fs}，有 {flow} 的质量落在教师概率低于 0.1% 的词元上；反向 KL 学生的峰位于词元 {rmu}，宽度 {rs}，落在那里的质量为 {rlow}。正向 KL：{ff} 对 {rf}。反向 KL：{fr} 对 {rr}。",
  },
};
type L = typeof labels.en;

type P = { gap: number; share: number; terms: "fwd" | "rev" };

const nat = (v: number) => (v >= 10 ? fixed(v, 1) : fixed(v, 2));
const pos = (v: number) => fixed(v, 1);

// ---------------------------------------------------------------- drawing

// Text with _X subscripts set as tspans ("D_KL(q_T‖p_S)"). The shift back to
// the baseline rides on the next run of normal text.
function mtext(x: number, y: number, s: string, a: Attrs): string {
  const size = Number(a["font-size"] ?? TYPE.body);
  const shift = rd(size * 0.3);
  const small = rd(size * 0.75);
  const pieces = s.split(/_([A-Za-z]+)/);
  let inner = "";
  let down = false;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece) continue;
    if (i % 2 === 1) {
      inner += `<tspan dy="${down ? 0 : shift}" font-size="${small}">${esc(piece)}</tspan>`;
      down = true;
    } else {
      inner += down ? `<tspan dy="${-shift}">${esc(piece)}</tspan>` : esc(piece);
      down = false;
    }
  }
  return el("text", { x, y, ...a }, inner);
}
const mwidth = (s: string, size: number) => textWidth(s.replace(/_([A-Za-z]+)/g, "$1"), size) - 0.1 * size * (s.match(/_[A-Za-z]+/g)?.join("").length ?? 0);

// A panel title and a muted line under it; returns the height used.
function title(s: string, sub: string, x0: number, y0: number, w: number, parts: string[]): number {
  let y = y0;
  for (const ln of wrap(s, TYPE.label, w)) { y += 18; parts.push(mtext(x0, y - 4, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  for (const ln of wrap(sub, TYPE.body, w)) { y += 17; parts.push(mtext(x0, y - 3, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  return y - y0;
}

function renderLegend(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const items: Array<{ label: string; kind: "bar" | "line" | "shade"; color: string; dash?: string }> = [
    { label: Lx.teacher, kind: "bar", color: C.ink3 },
    { label: Lx.fwdFit, kind: "line", color: C.c1 },
    { label: Lx.revFit, kind: "line", color: C.c2, dash: "5 3" },
    { label: Lx.lowKey, kind: "shade", color: C.panel },
  ];
  const parts: string[] = [];
  let x = x0, y = y0 + 13;
  for (const it of items) {
    const sw = it.kind === "line" ? 24 : 12;
    const iw = sw + 6 + mwidth(it.label, TYPE.body);
    if (x > x0 && x + iw > x0 + w) { x = x0; y += 20; }
    if (it.kind === "bar") parts.push(el("rect", { x, y: y - 10, width: 12, height: 11, rx: 1, fill: it.color, "fill-opacity": 0.7 }));
    if (it.kind === "shade") parts.push(el("rect", { x, y: y - 10, width: 12, height: 11, rx: 1, fill: it.color, stroke: C.grid, "stroke-width": 1 }));
    if (it.kind === "line") {
      parts.push(el("line", { x1: x, x2: x + 24, y1: y - 4, y2: y - 4, stroke: it.color, "stroke-width": 2, "stroke-dasharray": it.dash }));
      parts.push(el("circle", { cx: x + 12, cy: y - 4, r: 2.5, fill: it.color }));
    }
    parts.push(mtext(x + sw + 6, y, it.label, { "font-size": TYPE.body }));
    x += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: y - y0 + 8 };
}

// Token-aligned horizontal layout shared by both panels.
function tokenAxis(left: number, right: number) {
  const b = band(V, [left, right], right - left > 400 ? 2 : 1);
  const cx = (v: number) => b.at(v) + b.size / 2;
  return { b, cx };
}

function xTicks(cx: (v: number) => number, at: number, labelled: boolean, Lx: L | null, left: number, right: number): string {
  const parts: string[] = [el("line", { x1: left, x2: right, y1: at, y2: at, stroke: C.rule, "stroke-width": 1 })];
  for (const v of [0, 10, 20, 30, 39]) {
    parts.push(el("line", { x1: cx(v), x2: cx(v), y1: at, y2: at + 4, stroke: C.rule, "stroke-width": 1 }));
    if (labelled) parts.push(text(cx(v), at + 17, v, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  }
  if (labelled && Lx) parts.push(text((left + right) / 2, at + 35, Lx.x, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  return g({ class: "fig-axis" }, ...parts);
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];

  const lg = renderLegend(0, 0, w, Lx);
  parts.push(lg.svg);
  let y = lg.h + 8;

  const left = narrow ? 40 : 46;
  const right = w - 4;
  const { b, cx } = tokenAxis(left, right);

  // ---- distributions
  const apart = p.gap >= 6;
  y += title(Lx.dists, apart ? Lx.distsSub : Lx.distsSubMerged, 0, y, w, parts) + 26;
  const topA = y;
  const hA = narrow ? 150 : 180;
  const botA = topA + hA;
  let ymax = 0;
  for (const arr of [m.q, m.fwd.p, m.rev.p]) for (const v of arr) ymax = Math.max(ymax, v);
  const yA = linear([0, ymax * 1.08], [botA, topA]);
  // Tokens the teacher rarely emits, shaded behind everything.
  const step = V > 1 ? b.at(1) - b.at(0) : b.size;
  const gapPx = step - b.size;
  for (let v = 0; v < V; v++) {
    if (m.q[v] >= LOW) continue;
    let e = v;
    while (e + 1 < V && m.q[e + 1] < LOW) e++;
    const x0 = v === 0 ? left : b.at(v) - gapPx / 2;
    const x1 = e === V - 1 ? right : b.at(e) + b.size + gapPx / 2;
    parts.push(el("rect", { x: x0, y: topA, width: x1 - x0, height: hA, fill: C.panel }));
    v = e;
  }
  parts.push(axis({ scale: yA, orient: "left", at: left, ticks: yA.ticks(4), grid: [left, right], size: TYPE.body, format: (v) => pct(v, 0) }));
  parts.push(text(0, topA - 10, Lx.y, { "font-size": TYPE.body, class: "fig-t-muted" }));
  for (let v = 0; v < V; v++) {
    const h = botA - yA(m.q[v]);
    if (h > 0.2) parts.push(el("rect", { x: b.at(v), y: yA(m.q[v]), width: b.size, height: h, fill: C.ink3, "fill-opacity": 0.7 }));
  }
  const curve = (arr: Float64Array, color: string, dash?: string) => {
    const pts: Array<[number, number]> = [];
    for (let v = 0; v < V; v++) pts.push([cx(v), yA(arr[v])]);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: color, "stroke-width": 2, "stroke-dasharray": dash, "stroke-linejoin": "round" }));
    for (const [px, py] of pts) parts.push(el("circle", { cx: px, cy: py, r: narrow ? 1.8 : 2.2, fill: color }));
  };
  curve(m.fwd.p, C.c1);
  curve(m.rev.p, C.c2, "5 3");
  parts.push(xTicks(cx, botA, false, null, left, right));
  // Teacher mass in each mode, under the axis where no curve can cross it.
  if (apart) {
    for (const [c, mass] of [[MID - p.gap / 2, m.massL], [MID + p.gap / 2, m.massR]] as const) {
      parts.push(text(cx(0) + c * step, botA + 17, pct(mass, 0), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
    }
  }
  y = botA + 30;

  // ---- per-token terms of the selected divergence, for both fits
  const fwdSel = p.terms === "fwd";
  y += title(fwdSel ? Lx.termsFwd : Lx.termsRev, fwdSel ? Lx.termsFwdSub : Lx.termsRevSub, 0, y, w, parts) + 26;
  const tf = fwdSel ? terms(m.q, m.fwd.p) : terms(m.fwd.p, m.q);
  const tr = fwdSel ? terms(m.q, m.rev.p) : terms(m.rev.p, m.q);
  let lo = 0, hi = 0;
  for (const arr of [tf, tr]) for (const v of arr) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  hi = Math.max(hi, 0.01);
  const topB = y;
  const hB = narrow ? 96 : 110;
  const botB = topB + hB;
  const yB = linear([lo - (hi - lo) * 0.04, hi * 1.05], [botB, topB]);
  parts.push(axis({ scale: yB, orient: "left", at: left, ticks: yB.ticks(3), grid: [left, right], size: TYPE.body, format: (v) => sig(v, 2) }));
  parts.push(text(0, topB - 10, Lx.nats, { "font-size": TYPE.body, class: "fig-t-muted" }));
  const half = b.size / 2;
  for (let v = 0; v < V; v++) {
    for (const [val, x, color] of [[tf[v], b.at(v), C.c1], [tr[v], b.at(v) + half, C.c2]] as const) {
      const y0 = yB(Math.max(0, val)), y1 = yB(Math.min(0, val));
      if (y1 - y0 > 0.2) parts.push(el("rect", { x, y: y0, width: Math.max(1, half - (narrow ? 0 : 0.5)), height: y1 - y0, fill: color }));
    }
  }
  parts.push(el("line", { x1: left, x2: right, y1: yB(0), y2: yB(0), stroke: C.rule, "stroke-width": 1 }));
  parts.push(xTicks(cx, botB, true, Lx, left, right));
  y = botB + 66;

  // ---- readout: both divergences for both fits
  const rows: Array<[string, Fit, string]> = [[Lx.fwdFit, m.fwd, C.c1], [Lx.revFit, m.rev, C.c2]];
  const ro: string[] = [];
  const swatch = (x: number, yy: number, color: string, dash?: string) =>
    el("line", { x1: x, x2: x + 18, y1: yy - 4, y2: yy - 4, stroke: color, "stroke-width": 2, "stroke-dasharray": dash });
  if (!narrow) {
    const cF = w * 0.56, cR = w * 0.76, cL = w;
    ro.push(mtext(cF, y, Lx.colF, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
    ro.push(mtext(cR, y, Lx.colR, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
    ro.push(mtext(cL, y, Lx.colLow, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
    y += 6;
    ro.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
    rows.forEach(([name, f, color], i) => {
      y += 20;
      ro.push(swatch(0, y, color, i ? "5 3" : undefined));
      ro.push(text(24, y, name, { "font-size": TYPE.body }));
      ro.push(text(24 + textWidth(name, TYPE.body) + 8, y, tpl(Lx.fit, { mu: pos(f.mu), s: pos(f.sigma) }), { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
      ro.push(text(cF, y, nat(f.fwd), { "font-size": TYPE.body, "text-anchor": "end", class: (i === 0 ? "fig-t-strong " : "") + "fig-t-num" }));
      ro.push(text(cR, y, nat(f.rev), { "font-size": TYPE.body, "text-anchor": "end", class: (i === 1 ? "fig-t-strong " : "") + "fig-t-num" }));
      ro.push(text(cL, y, pct(f.low, 1), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    });
  } else {
    rows.forEach(([name, f, color], i) => {
      y += i ? 26 : 0;
      ro.push(swatch(0, y, color, i ? "5 3" : undefined));
      ro.push(text(24, y, `${name}, ${tpl(Lx.fit, { mu: pos(f.mu), s: pos(f.sigma) })}`, { "font-size": TYPE.body, class: "fig-t-strong" }));
      for (const ln of wrap(tpl(Lx.rowNarrow, { f: nat(f.fwd), r: nat(f.rev) }), TYPE.body, w)) { y += 17; ro.push(mtext(0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); }
      for (const ln of wrap(tpl(Lx.lowNarrow, { m: pct(f.low, 1) }), TYPE.body, w)) { y += 17; ro.push(mtext(0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); }
    });
  }
  const notes = [narrow ? null : Lx.boldNote];
  if (m.other) {
    notes.push(tpl(Lx.other, { side: m.other.mu < MID ? Lx.left : Lx.right, mu: pos(m.other.mu), r: nat(m.other.rev) }));
  }
  y += 8;
  for (const note of notes) {
    if (!note) continue;
    for (const ln of wrap(note, TYPE.body, w)) { y += 17; ro.push(mtext(0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 6, describe(st, lang), ...parts);
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, {
    gap: st.p.gap, share: pct(m.massR, 0),
    fmu: pos(m.fwd.mu), fs: pos(m.fwd.sigma), flow: pct(m.fwd.low, 1),
    rmu: pos(m.rev.mu), rs: pos(m.rev.sigma), rlow: pct(m.rev.low, 1),
    ff: nat(m.fwd.fwd), rf: nat(m.rev.fwd), fr: nat(m.fwd.rev), rr: nat(m.rev.rev),
  });
}

export default defineFigure({
  name: "divergence-direction",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    gap: {
      kind: "range", label: { en: "Distance between teacher modes", zh: "教师两峰的间距" }, unit: { en: "tokens", zh: "个词元" },
      min: 0, max: 20, step: 1, default: 16,
      marks: [{ value: 0, label: { en: "one mode", zh: "单峰" } }],
    },
    share: {
      kind: "range", label: { en: "Teacher mass on the right mode", zh: "右峰的概率质量" },
      min: 0.05, max: 0.95, step: 0.05, default: 0.3,
    },
    terms: {
      kind: "choice", label: { en: "Per-token terms of", zh: "逐词元项" }, default: "fwd",
      options: [
        { value: "fwd", label: { en: "forward KL", zh: "正向 KL" } },
        { value: "rev", label: { en: "reverse KL", zh: "反向 KL" } },
      ],
    },
  },
  render,
  describe,
});
