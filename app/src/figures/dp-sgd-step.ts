// One DP-SGD step on a toy batch, and the (ε, δ) bound it earns, computed
// exactly from the chapter's own definitions.
//
// The step is the chapter's: clip each per-example gradient to norm C,
//   ḡ_i = g_i · min(1, C / ‖g_i‖₂),
// sum the clipped gradients, add N(0, σ²C²I), divide by B. The gradients are
// eight seeded 2-D vectors (illustrative); the protected person contributes
// the first k of them.
//
// Adjacency is add/remove of that person. Their clipped gradients shift the
// noisy sum by a vector of norm at most Δ = kC, so the worst case of one step
// is two Gaussians with the same covariance s²I, s = σC, whose means differ by
// Δ. Only the component along that difference carries information, so the
// comparison is one-dimensional: M(D′) ~ N(0, s²), M(D) ~ N(Δ, s²). For the
// chapter's inequality p ≤ e^ε p′ + δ, the set S that needs the largest δ is
// where the privacy loss ln(density of D / density of D′) exceeds ε, the
// half-line y > t with t = s²ε/Δ + Δ/2 (Neyman–Pearson). Its masses are
//   p  = Pr[M(D) ∈ S]  = Φ(Δ/(2s) − εs/Δ)
//   p′ = Pr[M(D′) ∈ S] = Φ(−Δ/(2s) − εs/Δ)
// and the smallest δ for which the step is (ε, δ)-DP is δ(ε) = p − e^ε p′,
// which depends on Δ/s = k/σ only: C cancels. The swapped direction gives the
// same δ by symmetry.
//
// This is one step with every record in the batch (no subsampling). A run
// composes many steps, and a privacy accountant converts the sampling rate,
// noise, and step count into the run's (ε, δ); the figure does not do that.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap, placeLabels, drawLabels } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { normalPdf, normalTail, normalFrom } from "./lib/stats.ts";
import { sig, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";

const BATCH = 8;
const DELTA_FLOOR = 1e-12;

type P = { sigma: number; clip: number; k: number; eps: number; seed: number };

type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s];
const norm = (a: V) => Math.hypot(a[0], a[1]);

// Φ(z) through the upper tail, which keeps relative precision far out.
const Phi = (z: number) => normalTail(-z);

// The smallest δ at ε for Gaussians whose means differ by r = Δ/s noise SDs.
export function deltaAt(eps: number, r: number): { p: number; pp: number; delta: number } {
  const p = Phi(r / 2 - eps / r);
  const pp = Phi(-r / 2 - eps / r);
  return { p, pp, delta: Math.max(0, p - Math.exp(eps) * pp) };
}

interface Batch { raw: V[]; clipped: V[] }

// Eight illustrative per-example gradients: directions spread around a common
// one, norms from 0.4 to 2.6, the first (the person's first record) the longest.
const batchMemo = new Map<number, V[]>();
function rawBatch(seed: number): V[] {
  const hit = batchMemo.get(seed);
  if (hit) return hit;
  const u = rng(seed * 2654435761 >>> 0);
  const out: V[] = [];
  for (let i = 0; i < BATCH; i++) {
    const ang = (35 + (u() - 0.5) * 110) * (Math.PI / 180);
    const n = i === 0 ? 2.6 : 0.4 + u() * 1.9;
    out.push([n * Math.cos(ang), n * Math.sin(ang)]);
  }
  batchMemo.set(seed, out);
  return out;
}

function batch(p: P): Batch {
  const raw = rawBatch(p.seed);
  const clipped = raw.map((g0) => scale(g0, Math.min(1, p.clip / norm(g0))));
  return { raw, clipped };
}

interface Model {
  b: Batch;
  sum: V; sumOut: V; // Σ ḡ with and without the person's records
  shift: number; // ‖Σ − Σ′‖, at most Δ
  noise: V; release: V; // one seeded noise draw and the released noisy sum
  Delta: number; s: number; r: number;
  t: number; // threshold of S along the difference direction
  p: number; pp: number; delta: number;
}

function model(p: P): Model {
  const b = batch(p);
  const sum = b.clipped.reduce<V>((a, v) => add(a, v), [0, 0]);
  const sumOut = b.clipped.slice(p.k).reduce<V>((a, v) => add(a, v), [0, 0]);
  const shift = norm([sum[0] - sumOut[0], sum[1] - sumOut[1]]);
  const u = rng((p.seed * 40503 + 17) >>> 0);
  const s = p.sigma * p.clip;
  const noise: V = [normalFrom(u(), u()) * s, normalFrom(u(), u()) * s];
  const Delta = p.k * p.clip;
  const r = Delta / s;
  const { p: pm, pp, delta } = deltaAt(p.eps, r);
  return { b, sum, sumOut, shift, noise, release: add(sum, noise), Delta, s, r, t: (s * s * p.eps) / Delta + Delta / 2, p: pm, pp, delta };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "One DP-SGD step and its (ε, δ) bound",
    clipHead: "Clip each gradient to norm C",
    clipNote: "gradients longer than C = {c}, scaled back: {n} of {b}",
    sumHead: "Sum, then add N(0, σ²C²I)",
    ringIn: "noise around Σ ḡ, 1 and 2 SD",
    ringOut: "the same around Σ′",
    rawG: "gradient g_i",
    clippedG: "clipped ḡ_i",
    person: "the person's records",
    clipCircle: "‖ḡ‖ ≤ C",
    release: "one release",
    stepEq: "g̃ = (Σ ḡ_i + N(0, σ²C²I)) / B",
    shift: "the person shifts the sum by {v}, at most Δ = kC = {d}",
    lossHead: "Along the shift: the two outputs",
    lossAxis: "noisy sum along the shift direction",
    curveOut: "M(D′), without",
    curveIn: "M(D), with",
    setS: "S: privacy loss > ε",
    tMark: "t",
    profHead: "Smallest δ for each ε, one step",
    profX: "ε",
    profY: "δ",
    profK1: "k = 1",
    profNow: "k = {k}",
    below: "δ < 10⁻¹²",
    eqDelta: "Δ = kC = {d}, |s = σC = {s}, |Δ/s = k/σ = {r}; |C cancels",
    eqS: "S = {y : ln p(y)/p′(y) > ε} |= {y > s²ε/Δ + Δ/2 = {t}}",
    eqP: "p = Pr[M(D) ∈ S] = {p}, |p′ = Pr[M(D′) ∈ S] = {pp}",
    eqBound: "p ≤ e^ε p′ + δ with |δ = p − e^ε p′ |= {p} − {e} × {pp} |= {delta}",
    eqClaim: "this step is ({eps}, {delta})-DP for a person with {k:record/records} in the batch",
    describe: "Noise multiplier σ = {sigma}, clipping norm C = {c}, {k:record/records} per person: one step shifts the noisy sum by at most Δ = {d} against noise of standard deviation {s}, so at ε = {eps} the smallest δ is {delta}. In the set S where the privacy loss exceeds ε, p = {p} and p′ = {pp}.",
  },
  zh: {
    title: "DP-SGD 的一步及其 (ε, δ) 界",
    clipHead: "把每个梯度裁剪到范数 C",
    clipNote: "{b} 个梯度中有 {n} 个长于 C = {c}，被缩回",
    sumHead: "求和，再加 N(0, σ²C²I)",
    ringIn: "Σ ḡ 周围的噪声，1 倍和 2 倍标准差",
    ringOut: "Σ′ 周围的同样范围",
    rawG: "梯度 g_i",
    clippedG: "裁剪后 ḡ_i",
    person: "这个人的记录",
    clipCircle: "‖ḡ‖ ≤ C",
    release: "一次发布",
    stepEq: "g̃ = (Σ ḡ_i + N(0, σ²C²I)) / B",
    shift: "此人使梯度和移动 {v}，至多 Δ = kC = {d}",
    lossHead: "沿移动方向看两种输出",
    lossAxis: "带噪梯度和在移动方向上的分量",
    curveOut: "M(D′)，不含此人",
    curveIn: "M(D)，含此人",
    setS: "S：隐私损失 > ε",
    tMark: "t",
    profHead: "单步下每个 ε 对应的最小 δ",
    profX: "ε",
    profY: "δ",
    profK1: "k = 1",
    profNow: "k = {k}",
    below: "δ < 10⁻¹²",
    eqDelta: "Δ = kC = {d}，|s = σC = {s}，|Δ/s = k/σ = {r}；|C 被约去",
    eqS: "S = {y : ln p(y)/p′(y) > ε} |= {y > s²ε/Δ + Δ/2 = {t}}",
    eqP: "p = Pr[M(D) ∈ S] = {p}，|p′ = Pr[M(D′) ∈ S] = {pp}",
    eqBound: "p ≤ e^ε p′ + δ，其中 |δ = p − e^ε p′ |= {p} − {e} × {pp} |= {delta}",
    eqClaim: "对批内有 {k} 条记录的人，这一步满足 ({eps}, {delta}) 差分隐私",
    describe: "噪声乘数 σ = {sigma}，裁剪范数 C = {c}，每人 {k} 条记录：一步最多让带噪梯度和移动 Δ = {d}，噪声标准差为 {s}，因此在 ε = {eps} 时最小的 δ 为 {delta}。在隐私损失超过 ε 的集合 S 上，p = {p}，p′ = {pp}。",
  },
};
type L = typeof labels.en;

// δ and the S masses span many decades: significant figures, or scientific
// notation below 0.001, with the floor marked.
const small = (v: number) => (v <= 0 ? "0" : v < 1e-3 ? sci(v, 2) : sig(v, 2));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    sigma: sig(p.sigma, 3), c: sig(p.clip, 3), k: p.k, d: sig(m.Delta, 3), s: sig(m.s, 3),
    eps: sig(p.eps, 3), delta: m.delta < DELTA_FLOOR ? L.below : small(m.delta), p: small(m.p), pp: small(m.pp),
  });
}

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

// ---------------------------------------------------------------- panels

function head(parts: string[], s: string, x0: number, y: number, w: number, lang: Lang): number {
  for (const ln of lines(s, TYPE.label, w, lang, true)) {
    parts.push(text(x0, y + TYPE.label, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += TYPE.label + 5;
  }
  return y;
}

function arrow(a: [number, number], b: [number, number], color: string, width: number, dash?: string): string {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return el("circle", { cx: a[0], cy: a[1], r: width, fill: color });
  const ux = dx / len, uy = dy / len;
  const hl = Math.min(8, len * 0.45), hw = hl * 0.45 + width * 0.4;
  const bx = b[0] - ux * hl, by = b[1] - uy * hl;
  return el("line", { x1: a[0], y1: a[1], x2: bx, y2: by, stroke: color, "stroke-width": width, "stroke-dasharray": dash, "stroke-linecap": "round" })
    + el("path", { d: `M${b[0]},${b[1]}L${bx - uy * hw},${by + ux * hw}L${bx + uy * hw},${by - ux * hw}Z`, fill: color });
}

// A square plot of the 2-D gradient space centered on a given box of points.
function square(pts: V[], rings: Array<[V, number]>, x0: number, y0: number, side: number) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  const grow = (q: V, r = 0) => { for (const i of [0, 1]) { lo[i] = Math.min(lo[i], q[i] - r); hi[i] = Math.max(hi[i], q[i] + r); } };
  for (const q of pts) grow(q);
  for (const [c, r] of rings) grow(c, r);
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 1.1;
  const c0 = (lo[0] + hi[0]) / 2, c1 = (lo[1] + hi[1]) / 2;
  const px = linear([c0 - span / 2, c0 + span / 2], [x0, x0 + side]);
  const py = linear([c1 - span / 2, c1 + span / 2], [y0 + side, y0]);
  return { P: (q: V): [number, number] => [px(q[0]), py(q[1])], k: side / span };
}

function frame(parts: string[], x0: number, y: number, side: number, o: [number, number]) {
  parts.push(el("rect", { x: x0, y, width: side, height: side, rx: 4, fill: C.panel, "fill-opacity": 0.5 }));
  if (o[1] > y && o[1] < y + side) parts.push(el("line", { x1: x0, x2: x0 + side, y1: o[1], y2: o[1], stroke: C.grid, "stroke-width": 1 }));
  if (o[0] > x0 && o[0] < x0 + side) parts.push(el("line", { x1: o[0], x2: o[0], y1: y, y2: y + side, stroke: C.grid, "stroke-width": 1 }));
}

function notes(parts: string[], items: string[], cls: string, x0: number, y: number, w: number, size: number, lang: Lang): number {
  for (const s of items) {
    for (const ln of lines(s, size, w, lang)) { parts.push(text(x0, y + size, ln, { "font-size": size, class: cls })); y += size + 5; }
  }
  return y;
}

// Panel 1a: clipping, zoomed on the per-example gradients.
function clipPanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, L.clipHead, x0, y0, w, lang) + 6;
  const side = narrow ? Math.min(w, 230) : w;
  const sx0 = x0 + (w - side) / 2;
  const { P, k } = square([[0, 0], ...m.b.raw], [[[0, 0], p.clip]], sx0, y, side);
  const o = P([0, 0]);
  frame(parts, sx0, y, side, o);
  parts.push(el("circle", { cx: o[0], cy: o[1], r: p.clip * k, fill: C.paper, "fill-opacity": 0.6, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  m.b.raw.forEach((g0, i) => {
    const mine = i < p.k;
    const tip = P(g0);
    parts.push(el("line", { x1: o[0], y1: o[1], x2: tip[0], y2: tip[1], stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
    parts.push(el("circle", { cx: tip[0], cy: tip[1], r: 2.2, fill: C.ink3 }));
  });
  m.b.clipped.forEach((g0, i) => { if (i >= p.k) parts.push(arrow(o, P(g0), C.c1, 1.8)); });
  m.b.clipped.forEach((g0, i) => { if (i < p.k) parts.push(arrow(o, P(g0), C.c2, 2.4)); });
  // Name the circle at its lowest point, below the gradients, which point up.
  const cyl = Math.min(o[1] + p.clip * k + size + 3, y + side - 4);
  parts.push(text(o[0], cyl, L.clipCircle, { "font-size": size, "text-anchor": "middle", class: "fig-t-halo fig-t-soft" }));
  y += side + 8;
  const lg = legend([
    { label: L.rawG, swatch: { kind: "line", stroke: C.ink3, dash: "3 2" } },
    { label: L.clippedG, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.person, swatch: { kind: "line", stroke: C.c2 } },
  ], x0, y, w, size);
  parts.push(lg.svg);
  y += lg.height;
  const clippedN = m.b.raw.filter((g0) => norm(g0) > p.clip).length;
  y = notes(parts, [tpl(L.clipNote, { n: clippedN, b: BATCH, c: sig(p.clip, 3) })], "fig-t-muted fig-t-num", x0, y, w, size, lang);
  return { svg: g({}, ...parts), h: y - y0 };
}

// Panel 1b: the clipped gradients chained into the sum, the noise, one release.
function sumPanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, L.sumHead, x0, y0, w, lang) + 6;
  const side = w;
  // Chain: the other records first, from the origin to Σ′, then the person's.
  const chain: V[] = [[0, 0]];
  const order = [...m.b.clipped.slice(p.k), ...m.b.clipped.slice(0, p.k)];
  for (const v of order) chain.push(add(chain[chain.length - 1], v));
  const { P, k } = square([...chain, m.release], [[m.sum, 2 * m.s], [m.sumOut, 2 * m.s]], x0, y, side);
  const o = P([0, 0]);
  frame(parts, x0, y, side, o);
  const [sx, sy] = P(m.sum), [ox, oy] = P(m.sumOut);
  parts.push(el("circle", { cx: ox, cy: oy, r: 2 * m.s * k, fill: "none", stroke: C.c1, "stroke-width": 1, "stroke-dasharray": "3 3", "stroke-opacity": 0.7 }));
  parts.push(el("circle", { cx: ox, cy: oy, r: m.s * k, fill: "none", stroke: C.c1, "stroke-width": 1.2, "stroke-dasharray": "3 3" }));
  parts.push(el("circle", { cx: sx, cy: sy, r: 2 * m.s * k, fill: C.c2, "fill-opacity": 0.07, stroke: C.c2, "stroke-width": 1, "stroke-opacity": 0.6 }));
  parts.push(el("circle", { cx: sx, cy: sy, r: m.s * k, fill: C.c2, "fill-opacity": 0.1, stroke: C.c2, "stroke-width": 1.2 }));
  for (let i = 0; i < order.length; i++) {
    const mine = i >= order.length - p.k;
    parts.push(arrow(P(chain[i]), P(chain[i + 1]), mine ? C.c2 : C.c1, mine ? 2.4 : 1.6));
  }
  const [rx, ry] = P(m.release);
  parts.push(el("line", { x1: sx, y1: sy, x2: rx, y2: ry, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx: sx, cy: sy, r: 3, fill: C.ink }));
  parts.push(el("circle", { cx: ox, cy: oy, r: 3, fill: C.ink2 }));
  parts.push(el("circle", { cx: rx, cy: ry, r: 4.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  const boxes = [{ x0: rx - 6, y0: ry - 6, x1: rx + 6, y1: ry + 6 }, { x0: sx - 4, y0: sy - 4, x1: sx + 4, y1: sy + 4 }, { x0: ox - 4, y0: oy - 4, x1: ox + 4, y1: oy + 4 }];
  const placed = placeLabels([
    { x: sx, y: sy, text: "Σ ḡ", size, sides: ["above-right", "right", "above", "below-right", "above-left"], gap: 7, priority: 3, attrs: { class: "fig-t-halo" } },
    { x: ox, y: oy, text: "Σ′", size, sides: ["left", "above-left", "below-left", "below", "above"], gap: 7, priority: 2, attrs: { class: "fig-t-halo" } },
    { x: rx, y: ry, text: L.release, size, sides: ["right", "below-right", "above-right", "left", "below", "above"], gap: 8, priority: 1, attrs: { class: "fig-t-halo fig-t-soft" } },
  ], { x0: x0 + 2, y0: y + 2, x1: x0 + side - 2, y1: y + side - 2 }, boxes);
  parts.push(drawLabels(placed.placed));
  y += side + 8;
  const lg = legend([
    { label: L.ringIn, swatch: { kind: "rect", fill: C.c2, opacity: 0.3, stroke: C.c2 } },
    { label: L.ringOut, swatch: { kind: "rect", fill: "none", stroke: C.c1, dash: "3 3" } },
    { label: L.release, swatch: { kind: "dot", fill: C.ink } },
  ], x0, y, w, size);
  parts.push(lg.svg);
  y += lg.height;
  y = notes(parts, [L.stepEq, tpl(L.shift, { v: sig(m.shift, 3), d: sig(m.Delta, 3) })], "fig-t-muted fig-t-num", x0, y, w, size, lang);
  return { svg: g({}, ...parts), h: y - y0 };
}

// Panel 2: the two output distributions along the shift, and the set S.
function lossPanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, L.lossHead, x0, y0, w, lang);
  const labelRow = y + size + 4;
  const top = labelRow + 8;
  const plotH = narrow ? 104 : 96;
  const base = top + plotH;
  const d0 = -3.5 * m.s, d1 = m.Delta + 3.5 * m.s;
  const x = linear([d0, d1], [x0 + 2, x0 + w - 2]);
  const yv = linear([0, normalPdf(0) / m.s * 1.08], [base, top]);
  const curve = (mu: number, from = d0) => {
    const out: Array<[number, number]> = [];
    const n = 140;
    for (let i = 0; i <= n; i++) {
      const v = from + ((d1 - from) * i) / n;
      out.push([x(v), yv(normalPdf((v - mu) / m.s) / m.s)]);
    }
    return out;
  };
  const area = (pts: Array<[number, number]>) => `${linePath(pts)}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
  const tIn = m.t < d1;
  const tx = tIn ? x(Math.max(m.t, d0)) : x0 + w - 2;
  // S shaded under both curves.
  if (tIn) {
    parts.push(el("rect", { x: tx, y: top, width: x0 + w - 2 - tx, height: plotH, fill: C.ink3, "fill-opacity": 0.1 }));
    parts.push(el("path", { d: area(curve(0, Math.max(m.t, d0))), fill: C.c1, "fill-opacity": 0.45 }));
    parts.push(el("path", { d: area(curve(m.Delta, Math.max(m.t, d0))), fill: C.c2, "fill-opacity": 0.45 }));
  }
  const cOut = curve(0), cIn = curve(m.Delta);
  parts.push(el("path", { d: linePath(cOut), fill: "none", stroke: C.c1, "stroke-width": 1.8 }));
  parts.push(el("path", { d: linePath(cIn), fill: "none", stroke: C.c2, "stroke-width": 1.8 }));
  parts.push(el("line", { x1: tx, x2: tx, y1: labelRow + 2, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));
  const sl = tIn ? `${L.setS} (t = ${sig(m.t, 3)})` : `${L.setS}: t = ${sig(m.t, 3)} →`;
  const sw = textWidth(sl, size) * 1.05;
  const slx = tIn && tx + 4 + sw <= x0 + w ? tx + 4 : Math.max(x0, tx - 4 - sw);
  parts.push(text(slx, labelRow, sl, { "font-size": size, class: "fig-t-num" }));
  parts.push(axis({ scale: x, orient: "bottom", at: base, title: L.lossAxis, size, ticks: x.ticks(narrow ? 4 : 5), format: (v) => sig(v, 3) }));
  y = base + axisHeight(true, size);
  const lg = legend([
    { label: L.curveOut, swatch: { kind: "rect", fill: C.c1, opacity: 0.6 } },
    { label: L.curveIn, swatch: { kind: "rect", fill: C.c2, opacity: 0.6 } },
  ], x0, y, w, size);
  parts.push(lg.svg);
  return { svg: g({}, ...parts), h: y + lg.height - y0 };
}

// Panel 3: the privacy profile δ(ε) of one step.
function profilePanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, L.profHead, x0, y0, w, lang) + 24;
  const left = x0 + 40, right = x0 + w - 6;
  const plotH = narrow ? 118 : 104;
  const top = y, base = top + plotH;
  const xs = log([0.05, 10], [left, right]);
  const ys = log([DELTA_FLOOR, 1], [base, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: base, grid: [top, base], ticks: [0.05, 0.1, 0.5, 1, 5, 10], title: L.profX, size, format: (v) => sig(v, 2) }));
  parts.push(axis({ scale: ys, orient: "left", at: left, grid: [left, right], ticks: [1e-12, 1e-9, 1e-6, 1e-3, 1], title: L.profY, size, format: (v) => (v === 1 ? "1" : sci(v)) }));
  const curve = (r: number) => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const e = 0.05 * (10 / 0.05) ** (i / 120);
      const d = deltaAt(e, r).delta;
      out.push([xs(e), ys(Math.max(d, DELTA_FLOOR))]);
      if (d < DELTA_FLOOR) break;
    }
    return out;
  };
  const items = [];
  if (p.k > 1) {
    parts.push(el("path", { d: linePath(curve(1 / p.sigma)), fill: "none", stroke: C.ink3, "stroke-width": 1.4, "stroke-dasharray": "4 3" }));
    items.push({ label: L.profK1, swatch: { kind: "line" as const, stroke: C.ink3, dash: "4 3" } });
  }
  parts.push(el("path", { d: linePath(curve(m.r)), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  items.push({ label: tpl(L.profNow, { k: p.k }), swatch: { kind: "line" as const, stroke: C.ink } });
  const mx = xs(p.eps), my = ys(Math.max(m.delta, DELTA_FLOOR));
  parts.push(el("circle", { cx: mx, cy: my, r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  if (m.delta < DELTA_FLOOR) parts.push(text(Math.min(mx + 8, right - textWidth(L.below, size)), my - 8, L.below, { "font-size": size, class: "fig-t-halo fig-t-soft" }));
  y = base + axisHeight(true, size);
  const lg = legend(items, x0, y, w, size);
  parts.push(lg.svg);
  return { svg: g({}, ...parts), h: y + lg.height - y0 };
}

function readout(p: P, m: Model, L: L, lang: Lang, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = y0;
  // Equations break only between their "|"-separated terms; a term wider than
  // the line falls back to ordinary wrapping.
  const put = (s: string, cls: string, sz = size) => {
    const max = w * (cls.includes("strong") ? 0.86 : 0.93);
    const out: string[] = [];
    let cur = "";
    for (const seg of s.split("|")) {
      if (cur && textWidth((cur + seg).trimEnd(), sz) > max) { out.push(cur.trimEnd()); cur = seg; } else cur += seg;
    }
    if (cur) out.push(cur.trimEnd());
    for (const ln0 of out) {
      for (const ln of textWidth(ln0, sz) > max ? lines(ln0, sz, w, lang, cls.includes("strong")) : [ln0]) {
        parts.push(text(0, y + sz, ln, { "font-size": sz, class: cls }));
        y += sz + 5;
      }
    }
    y += 2;
  };
  const dl = m.delta < DELTA_FLOOR ? L.below.replace("δ ", "") : small(m.delta);
  put(tpl(L.eqDelta, { d: sig(m.Delta, 3), s: sig(m.s, 3), r: sig(m.r, 3) }), "fig-t-num");
  put(tpl(L.eqS, { t: sig(m.t, 3) }), "fig-t-num");
  put(tpl(L.eqP, { p: small(m.p), pp: small(m.pp) }), "fig-t-num");
  put(tpl(L.eqBound, { p: small(m.p), e: sig(Math.exp(p.eps), 3), pp: small(m.pp), delta: dl }), "fig-t-num");
  put(tpl(L.eqClaim, { eps: sig(p.eps, 3), delta: dl, k: p.k }), "fig-t-strong fig-t-num", TYPE.body);
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    for (const f of [clipPanel, sumPanel, lossPanel, profilePanel]) {
      const r = f(p, m, L, lang, 0, y, w, true);
      parts.push(r.svg); y += r.h + 18;
    }
  } else {
    const cw = Math.floor((w - 28) / 2), rx = cw + 28, rw = w - rx;
    const a = clipPanel(p, m, L, lang, 0, y, cw, false);
    const b = sumPanel(p, m, L, lang, rx, y, rw, false);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 20;
    const c = lossPanel(p, m, L, lang, 0, y, cw, false);
    const d = profilePanel(p, m, L, lang, rx, y, rw, false);
    parts.push(c.svg, d.svg);
    y += Math.max(c.h, d.h) + 16;
  }
  const ro = readout(p, m, L, lang, y, w, narrow);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "dp-sgd-step",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    sigma: {
      kind: "range", scale: "log", label: { en: "Noise multiplier σ", zh: "噪声乘数 σ" }, min: 0.3, max: 10, default: 2,
    },
    clip: {
      kind: "range", scale: "log", label: { en: "Clipping norm C", zh: "裁剪范数 C" }, min: 0.25, max: 4, default: 1,
    },
    k: {
      kind: "choice", label: { en: "Records per person in the batch", zh: "此人在批内的记录数" }, default: 1,
      options: [
        { value: 1, label: { en: "1, record-level", zh: "1，记录级" } },
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 4, label: { en: "4", zh: "4" } },
      ],
    },
    eps: {
      kind: "range", scale: "log", label: { en: "Privacy loss bound ε", zh: "隐私损失上界 ε" }, min: 0.05, max: 10, default: 1,
    },
    seed: { kind: "range", label: { en: "Gradient seed", zh: "梯度种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  render,
  describe,
});
