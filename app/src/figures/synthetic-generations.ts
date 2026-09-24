// Recursive training on synthetic data: each generation fits a model to data
// that includes samples from the previous generation's model, under three
// protocols for what happens to the human data.
//
// The learner is exact. A model is a probability table over 31 integer values
// x = −15..15, and fitting a model to a dataset sets each probability to the
// value's share of the dataset (the maximum-likelihood fit of a categorical
// distribution). The only error in the loop is therefore finite sampling, the
// case Shumailov et al. analyze first ("discrete distributions with exact
// approximation"): a value that draws no sample in one generation has
// probability 0 in the next, and under replacement it never returns.
//
// The human data H has the frequencies of an illustrative heavy-tailed
// distribution, P(x) ∝ (1 + |x| / 2.5)^−3, exactly, so generation 0 carries
// the whole tail and the only loss is the loop's. Generation n is fitted on:
//
//   replacement      D_n = G_{n−1}                       (N synthetic samples)
//   fixed anchor     q_n = α·P + (1 − α)·p̂(G_{n−1})      (adaptation/07's form)
//   accumulation     A_n = H ∪ G_0 ∪ … ∪ G_{n−1}         (every sample weighted
//                                                          equally; H counts as N)
//
// where G_i is N samples drawn from generation i's model, optionally through a
// top-p decoder that keeps only the most likely values covering a fraction p
// of the probability. Under replacement without truncation the fitted
// variance is the biased sample variance of N draws, so exactly
// E[σ²_n] = (1 − 1/N)^n σ²_H; the readout prints it beside the realized value.
//
// One seeded run per protocol is drawn in full (the histogram and the bold
// line); the bands are the 10th to 90th percentile over RUNS seeded runs, so
// the caption holds for the ensemble and not for one lucky seed. All three
// protocols in a run share one uniform stream, so generation 0's synthetic
// sample G_0 is the same draw under each protocol. The default seed was chosen
// so that its run tracks the 400-run median of all three protocols at the
// default parameters (replacement's tail reaches 0 at generation 20 against a
// median of 22), so the bold line is a typical run, not a dramatic one.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log, band } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, int, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export const XMAX = 15;
export const VALUES = Array.from({ length: 2 * XMAX + 1 }, (_, i) => i - XMAX);
const K = VALUES.length;
export const TAIL = 6; // the tail is |x| >= TAIL
const RUNS = 50;

function normalize(v: number[]): number[] {
  const z = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / z);
}
export const P = normalize(VALUES.map((x) => (1 + Math.abs(x) / 2.5) ** -3));

export type Regime = "replace" | "anchor" | "accumulate";
export const REGIMES: Regime[] = ["replace", "anchor", "accumulate"];

interface Moments { variance: number; tail: number; support: number }
function moments(p: ArrayLike<number>): Moments {
  let m = 0, tail = 0, support = 0;
  for (let i = 0; i < K; i++) {
    m += p[i] * VALUES[i];
    if (Math.abs(VALUES[i]) >= TAIL) tail += p[i];
    if (p[i] > 0) support++;
  }
  let v = 0;
  for (let i = 0; i < K; i++) v += p[i] * (VALUES[i] - m) ** 2;
  return { variance: v, tail, support };
}
const BASE = moments(P);

// The decoder: keep the most likely values until they cover topP of the
// probability (ties broken toward the center), renormalized.
function decode(p: Float64Array, topP: number): Float64Array {
  if (topP >= 1) return p;
  const order = Array.from({ length: K }, (_, i) => i).sort((a, b) => p[b] - p[a] || Math.abs(VALUES[a]) - Math.abs(VALUES[b]) || a - b);
  const q = new Float64Array(K);
  let c = 0;
  for (const i of order) {
    if (c >= topP - 1e-12 || p[i] <= 0) break;
    q[i] = p[i];
    c += p[i];
  }
  for (let i = 0; i < K; i++) q[i] /= c;
  return q;
}

// N draws from q, as counts per value.
function draw(q: Float64Array, N: number, u: () => number): Float64Array {
  const cdf = new Float64Array(K);
  let c = 0;
  for (let i = 0; i < K; i++) { c += q[i]; cdf[i] = c; }
  const counts = new Float64Array(K);
  for (let k = 0; k < N; k++) {
    const r = u() * c;
    let lo = 0, hi = K - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
    while (q[lo] === 0 && lo < K - 1) lo++; // never land on a value the decoder removed
    counts[lo]++;
  }
  return counts;
}

export interface Run { p: Float64Array[]; m: Moments[] } // per generation 0..G

export function simulate(regime: Regime, N: number, G: number, alpha: number, topP: number, seed: number): Run {
  const u = rng(seed);
  const p0 = Float64Array.from(P);
  const ps: Float64Array[] = [p0];
  const acc = Float64Array.from(P, (v) => v * N);
  let total = N;
  let cur = p0;
  for (let n = 1; n <= G; n++) {
    const counts = draw(decode(cur, topP), N, u);
    const next = new Float64Array(K);
    if (regime === "replace") for (let i = 0; i < K; i++) next[i] = counts[i] / N;
    else if (regime === "anchor") for (let i = 0; i < K; i++) next[i] = alpha * P[i] + (1 - alpha) * counts[i] / N;
    else {
      total += N;
      for (let i = 0; i < K; i++) { acc[i] += counts[i]; next[i] = acc[i] / total; }
    }
    ps.push(next);
    cur = next;
  }
  return { p: ps, m: ps.map(moments) };
}

interface Band { lo: number[]; hi: number[] }
export interface Series { run: Run; v: Band; t: Band }

type SimParams = { alpha: number; samples: number; topP: number; generations: number; seed: number };

function quantile(sorted: number[], f: number): number {
  const at = f * (sorted.length - 1);
  const i = Math.floor(at), frac = at - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - frac) + sorted[i + 1] * frac : sorted[i];
}

// One protocol for one parameter set, memoized: render runs every frame while
// playing, the simulation only when a parameter changes. The anchor share
// enters the key only for the anchor protocol, so dragging it re-simulates one
// protocol.
const memo = new Map<string, Series>();
export function series(regime: Regime, p: SimParams): Series {
  const key = `${regime}|${p.samples}|${p.generations}|${p.topP}|${p.seed}|${regime === "anchor" ? p.alpha : ""}`;
  let hit = memo.get(key);
  if (!hit) {
    const runs = Array.from({ length: RUNS }, (_, r) => simulate(regime, p.samples, p.generations, p.alpha, p.topP, p.seed + 7919 * r));
    const v: Band = { lo: [], hi: [] }, t: Band = { lo: [], hi: [] };
    for (let n = 0; n <= p.generations; n++) {
      const vs = runs.map((r) => r.m[n].variance / BASE.variance).sort((a, b) => a - b);
      const ts = runs.map((r) => r.m[n].tail / BASE.tail).sort((a, b) => a - b);
      v.lo.push(quantile(vs, 0.1)); v.hi.push(quantile(vs, 0.9));
      t.lo.push(quantile(ts, 0.1)); t.hi.push(quantile(ts, 0.9));
    }
    hit = { run: runs[0], v, t };
    if (memo.size > 48) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- events

type EventKind = "lost" | "tailHalf" | "tailGone" | "varHalf" | "point";
interface Ev { t: number; kind: EventKind; x: number }

function events(run: Run): Ev[] {
  const out: Ev[] = [];
  const first = (f: (n: number) => boolean) => { for (let n = 1; n < run.m.length; n++) if (f(n)) return n; return -1; };
  const lost = first((n) => run.m[n].support < K);
  if (lost > 0) {
    const i = Array.from({ length: K }, (_, k) => k).filter((k) => run.p[lost][k] === 0).sort((a, b) => Math.abs(VALUES[b]) - Math.abs(VALUES[a]))[0];
    out.push({ t: lost, kind: "lost", x: Math.abs(VALUES[i]) });
  }
  const half = first((n) => run.m[n].tail < 0.5 * BASE.tail);
  if (half > 0) out.push({ t: half, kind: "tailHalf", x: 0 });
  const gone = first((n) => run.m[n].tail === 0);
  if (gone > 0) out.push({ t: gone, kind: "tailGone", x: 0 });
  const vh = first((n) => run.m[n].variance < 0.5 * BASE.variance);
  if (vh > 0) out.push({ t: vh, kind: "varHalf", x: 0 });
  const pt = first((n) => run.m[n].support === 1);
  if (pt > 0) out.push({ t: pt, kind: "point", x: VALUES[run.p[pt].findIndex((v) => v > 0)] });
  return out.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Recursive training: replacement, fixed anchor, and accumulation",
    replace: "replacement",
    anchor: "fixed anchor",
    accumulate: "accumulation",
    histTitle: "Generation {n}, {regime}",
    human: "human data H",
    lostKey: "value lost (probability 0)",
    tail: "tail |x| ≥ {k}",
    xTitle: "value x",
    yTitle: "probability (log scale)",
    vTitle: "Variance, relative to H",
    tTitle: "Tail mass P(|x| ≥ {k}), relative to H",
    gen: "generation",
    bandKey: "10th to 90th percentile of {r} runs",
    runKey: "this run",
    fitOn: "Generation {n} is fitted on",
    termsZero: "the human data H, exactly",
    termsReplace: "{N} synthetic samples, no human data",
    termsAnchor: "{a} human, {b} synthetic",
    termsAccumulate: "{N} human + {n} × {N} synthetic = {tot} samples; human share {h}",
    rVar: "variance σ²ₙ / σ²₀",
    rExp: "expected over runs, (1 − 1/N)ⁿ",
    rLost: "lost at this generation",
    rLostNone: "none",
    sep: ", ",
    rTail: "tail mass |x| ≥ {k}",
    rTailH: "{v} (H: {h})",
    rSupport: "values with probability > 0",
    rSupportV: "{s} of {k}",
    evLost: "First value lost: x = ±{x} draws no sample and drops to probability 0",
    evTailHalf: "Tail mass falls below half of the human data's",
    evTailGone: "No probability left in the tail |x| ≥ {k}",
    evVarHalf: "Variance falls below half of the human data's",
    evPoint: "Point distribution: only x = {x} remains",
    evStart: "Generation 0 fits the human data H",
    evEnd: "Generation {n}: {s} of {k} values remain",
    describe: "Generation {n} of {g} under {regime}: the variance is {v} of the human data's, the tail |x| ≥ {k} holds {t} of the probability (human data {th}), and {s} of {kk} values remain. At the same generation, {o1} has variance {v1} and tail {t1}; {o2} has variance {v2} and tail {t2}.",
  },
  zh: {
    title: "递归训练：替换、固定锚点与累积",
    replace: "替换",
    anchor: "固定锚点",
    accumulate: "累积",
    histTitle: "第 {n} 代，{regime}",
    human: "人类数据 H",
    lostKey: "已丢失的取值（概率为 0）",
    tail: "尾部 |x| ≥ {k}",
    xTitle: "取值 x",
    yTitle: "概率（对数刻度）",
    vTitle: "方差，相对于 H",
    tTitle: "尾部概率 P(|x| ≥ {k})，相对于 H",
    gen: "代次",
    bandKey: "{r} 次运行的第 10 至第 90 百分位",
    runKey: "本次运行",
    fitOn: "第 {n} 代的拟合数据",
    termsZero: "人类数据 H 本身",
    termsReplace: "{N} 个合成样本，不含人类数据",
    termsAnchor: "人类数据 {a}，合成数据 {b}",
    termsAccumulate: "{N} 个人类样本 + {n} × {N} 个合成样本 = {tot} 个样本；人类数据占 {h}",
    rVar: "方差 σ²ₙ / σ²₀",
    rExp: "多次运行的期望 (1 − 1/N)ⁿ",
    rLost: "本代新丢失的取值",
    rLostNone: "无",
    sep: "、",
    rTail: "尾部概率 |x| ≥ {k}",
    rTailH: "{v}（H：{h}）",
    rSupport: "概率大于 0 的取值",
    rSupportV: "{k} 个中剩 {s} 个",
    evLost: "首次丢失取值：x = ±{x} 一个样本也没抽到，概率降为 0",
    evTailHalf: "尾部概率降到人类数据的一半以下",
    evTailGone: "尾部 |x| ≥ {k} 的概率全部消失",
    evVarHalf: "方差降到人类数据的一半以下",
    evPoint: "退化为点分布：只剩 x = {x}",
    evStart: "第 0 代拟合人类数据 H",
    evEnd: "第 {n} 代：{k} 个取值中剩 {s} 个",
    describe: "{regime}下的第 {n} 代（共 {g} 代）：方差为人类数据的 {v}，尾部 |x| ≥ {k} 的概率为 {t}（人类数据为 {th}），{kk} 个取值中剩 {s} 个。同一代的{o1}方差为 {v1}，尾部概率 {t1}；{o2}方差为 {v2}，尾部概率 {t2}。",
  },
};
type L = typeof labels.en;

type P = { protocol: Regime; alpha: number; samples: number; topP: number; generations: number; seed: number };

const COLOR: Record<Regime, string> = { replace: C.c1, anchor: C.c2, accumulate: C.c3 };

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋" };
const sub = (n: number) => String(n).split("").map((c) => SUB[c] ?? c).join("");

// The chapter's equation for the protocol at generation n, with indices filled in.
function formula(regime: Regime, n: number): string {
  if (n === 0) return "A₀ = H";
  if (regime === "replace") return `D${sub(n)} = G${sub(n - 1)}`;
  if (regime === "anchor") return `q${sub(n)} = α·H + (1 − α)·G${sub(n - 1)}`;
  return n === 1 ? "A₁ = H ∪ G₀" : n === 2 ? "A₂ = H ∪ G₀ ∪ G₁" : `A${sub(n)} = H ∪ G₀ ∪ … ∪ G${sub(n - 1)}`;
}

function terms(regime: Regime, n: number, p: P, L: L): string {
  if (n === 0) return L.termsZero;
  if (regime === "replace") return tpl(L.termsReplace, { N: p.samples });
  if (regime === "anchor") return tpl(L.termsAnchor, { a: pct(p.alpha), b: pct(1 - p.alpha) });
  return tpl(L.termsAccumulate, { N: int(p.samples), n, tot: int(p.samples * (n + 1)), h: pct(1 / (n + 1), 1) });
}

function eventLabel(e: Ev, L: L): string {
  switch (e.kind) {
    case "lost": return tpl(L.evLost, { x: e.x });
    case "tailHalf": return L.evTailHalf;
    case "tailGone": return tpl(L.evTailGone, { k: TAIL });
    case "varHalf": return L.evVarHalf;
    case "point": return tpl(L.evPoint, { x: e.x });
  }
}

// Values that had probability at generation n − 1 and have none at n.
function lostAt(run: Run, n: number, L: L): string {
  if (n === 0) return L.rLostNone;
  const xs = VALUES.filter((_, i) => run.p[n - 1][i] > 0 && run.p[n][i] === 0).map((x) => String(x).replace("-", "−"));
  if (!xs.length) return L.rLostNone;
  const shown = xs.length > 4 ? [...xs.slice(0, 3), "…"] : xs;
  return "x = " + shown.join(L.sep);
}

const ratio = (v: number) => (v >= 10 ? sig(v, 3) : fixed(v, 2));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const n = Math.min(Math.round(st.t), p.generations);
  const at = (r: Regime) => series(r, p).run.m[n];
  const m = at(p.protocol);
  const others = REGIMES.filter((r) => r !== p.protocol);
  const [a, b] = others.map(at);
  return tpl(L.describe, {
    n, g: p.generations, regime: L[p.protocol], v: ratio(m.variance / BASE.variance), k: TAIL, t: pct(m.tail, 1), th: pct(BASE.tail, 1), s: m.support, kk: K,
    o1: L[others[0]], v1: ratio(a.variance / BASE.variance), t1: pct(a.tail, 1),
    o2: L[others[1]], v2: ratio(b.variance / BASE.variance), t2: pct(b.tail, 1),
  }).replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------- drawing

const Y_MIN = 1e-4;
const yTick = (v: number) => (v >= 0.01 ? String(v) : `10${v === 1e-3 ? "⁻³" : "⁻⁴"}`);

function histogram(p: P, n: number, run: Run, x0: number, y0: number, w: number, L: L, fs: number, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  const pn = run.p[n];
  parts.push(text(x0, y0 + 13, tpl(L.histTitle, { n, regime: L[p.protocol] }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L[p.protocol], swatch: { kind: "rect", fill: COLOR[p.protocol] } },
    { label: L.human, swatch: { kind: "line", stroke: C.ink } },
    { label: L.lostKey, swatch: { kind: "dot", fill: C.bad } },
  ], x0, y0 + 22, w, fs);
  parts.push(lg.svg);
  const left = x0 + (narrow ? 36 : 40);
  const top = y0 + 30 + lg.height + 8;
  const plotH = narrow ? 150 : 170;
  const right = x0 + w - 2;
  const bx = band(K, [left + 2, right], narrow ? 1 : 2);
  const y = log([Y_MIN, 1], [top + plotH, top]);
  const cx = (i: number) => bx.at(i) + bx.size / 2;

  // Tail bands behind the bars, with their label above the plot area.
  const tailL = VALUES.findIndex((v) => v > -TAIL); // first non-tail index
  const tailR = VALUES.findIndex((v) => v >= TAIL);
  const tl = bx.at(0) - 1, tlw = bx.at(tailL) - 1 - tl;
  const tr = bx.at(tailR) - 1, trw = right - tr;
  parts.push(el("rect", { x: tl, y: top, width: tlw, height: plotH, fill: C.panel }));
  parts.push(el("rect", { x: tr, y: top, width: trw, height: plotH, fill: C.panel }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [1e-4, 1e-3, 0.01, 0.1, 1], format: yTick, size: fs }));
  const tailLabel = tpl(L.tail, { k: TAIL });
  parts.push(text(tr + trw - 4, top + fs + 2, tailLabel, { "font-size": fs, "text-anchor": "end", class: "fig-t-halo fig-t-soft" }));
  if (!narrow) parts.push(text(tl + 4, top + fs + 2, tailLabel, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));

  // Bars of generation n; values below the floor get a stub so "small" never
  // reads as "lost".
  for (let i = 0; i < K; i++) {
    const v = pn[i];
    if (v <= 0) continue;
    const yy = v >= Y_MIN ? y(v) : top + plotH - 2;
    parts.push(el("rect", { x: bx.at(i), y: yy, width: bx.size, height: top + plotH - yy, fill: COLOR[p.protocol] }));
  }
  // The human data as a step outline over the bars.
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < K; i++) {
    const yy = y(P[i]);
    const xa = i === 0 ? bx.at(0) : bx.at(i) - (bx.at(i) - bx.at(i - 1) - bx.size) / 2;
    const xb = i === K - 1 ? bx.at(i) + bx.size : bx.at(i) + bx.size + (bx.at(i + 1) - bx.at(i) - bx.size) / 2;
    pts.push([xa, yy], [xb, yy]);
  }
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink, "stroke-width": 1.4, "stroke-linejoin": "round" }));
  // Lost values: a dot under the baseline.
  for (let i = 0; i < K; i++) if (pn[i] <= 0) parts.push(el("circle", { cx: cx(i), cy: top + plotH + 6, r: Math.min(3.2, bx.size / 2), fill: C.bad }));

  // Value axis: ticks at multiples of 5.
  const xs = linear([-XMAX, XMAX], [cx(0), cx(K - 1)]);
  const ax = axis({ scale: xs, orient: "bottom", at: top + plotH + 12, ticks: [-15, -10, -5, 0, 5, 10, 15], title: L.xTitle, format: (v) => String(v).replace("-", "−"), size: fs });
  parts.push(ax);
  parts.push(text(left - (narrow ? 34 : 38), top - 8, L.yTitle, { "font-size": fs, class: "fig-t-muted" }));
  return { svg: g({ class: "fig-hist" }, ...parts), h: top - y0 + plotH + 12 + axisHeight(true, fs) };
}

function readout(p: P, n: number, all: Record<Regime, Series>, x0: number, y0: number, w: number, L: L, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const m = all[p.protocol].run.m[n];
  let y = y0 + 13;
  parts.push(text(x0, y, tpl(L.fitOn, { n }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 22;
  parts.push(text(x0, y, formula(p.protocol, n), { "font-size": TYPE.label, class: "fig-t-num" }));
  y += 6;
  for (const ln of wrapCJK(terms(p.protocol, n, p, L), fs, w)) { y += fs + 5; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted fig-t-num" })); }
  y += 12;
  const rows: Array<[string, string, boolean]> = [
    [L.rVar, ratio(m.variance / BASE.variance), true],
  ];
  if (p.protocol === "replace" && p.topP >= 1 && n > 0) rows.push([L.rExp, fixed((1 - 1 / p.samples) ** n, 2), false]);
  rows.push([tpl(L.rTail, { k: TAIL }), tpl(L.rTailH, { v: pct(m.tail, 1), h: pct(BASE.tail, 1) }), true]);
  rows.push([L.rSupport, tpl(L.rSupportV, { s: m.support, k: K }), true]);
  rows.push([L.rLost, lostAt(all[p.protocol].run, n, L), false]);
  const rowH = fs + 9;
  for (const [name, val, strong] of rows) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const vw = textWidth(val, fs);
    const nameLines = wrapCJK(name, fs, w - vw - 10);
    nameLines.forEach((ln, i) => parts.push(text(x0, y + fs + 4 + i * (fs + 3), ln, { "font-size": fs, class: strong ? undefined : "fig-t-muted" })));
    parts.push(text(x0 + w, y + fs + 4, val, { "font-size": fs, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    y += rowH + (nameLines.length - 1) * (fs + 3);
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 2 };
}

const Y_MAX = 1.5;

function panel(kind: "v" | "t", p: P, n: number, all: Record<Regime, Series>, x0: number, y0: number, w: number, L: L, fs: number, uid: string, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  const title = kind === "v" ? L.vTitle : tpl(L.tTitle, { k: TAIL });
  parts.push(text(x0, y0 + 13, title, { "font-size": fs + 1, class: "fig-t-strong" }));
  const left = x0 + 30, right = x0 + w - 4;
  const top = y0 + 26, plotH = narrow ? 110 : 120;
  const G = p.generations;
  const x = linear([0, G], [left, right]);
  const y = linear([0, Y_MAX], [top + plotH, top]);
  const clip = `${uid}-clip-${kind}`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top - 1, width: right - left, height: plotH + 2 }))));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [0, 0.5, 1, 1.5], format: (v) => String(v), size: fs }));
  parts.push(el("line", { x1: left, x2: right, y1: y(1), y2: y(1), stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  const val = (s: Series, i: number) => (kind === "v" ? s.run.m[i].variance / BASE.variance : s.run.m[i].tail / BASE.tail);
  const bandOf = (s: Series) => (kind === "v" ? s.v : s.t);
  const sel = all[p.protocol];
  const b = bandOf(sel);
  const upto = Array.from({ length: n + 1 }, (_, i) => i);
  if (n > 0) {
    const poly = [...upto.map((i) => [x(i), y(Math.min(b.hi[i], Y_MAX + 0.2))] as [number, number]), ...upto.reverse().map((i) => [x(i), y(b.lo[i])] as [number, number])];
    parts.push(g({ "clip-path": `url(#${clip})` }, el("path", { d: linePath(poly) + "Z", fill: COLOR[p.protocol], "fill-opacity": 0.2 })));
  }
  const lines: string[] = [];
  for (const r of REGIMES) {
    const s = all[r];
    const pts = Array.from({ length: n + 1 }, (_, i) => [x(i), y(Math.min(val(s, i), Y_MAX + 0.2))] as [number, number]);
    const on = r === p.protocol;
    const path = el("path", { d: linePath(pts), fill: "none", stroke: COLOR[r], "stroke-width": on ? 2.2 : 1.4, "stroke-dasharray": on ? undefined : "5 3", "stroke-linejoin": "round" });
    if (on) lines.push(path); else lines.unshift(path);
  }
  parts.push(g({ "clip-path": `url(#${clip})` }, ...lines));
  // Cursor at generation n.
  parts.push(el("line", { x1: x(n), x2: x(n), y1: top, y2: top + plotH, stroke: C.ink, "stroke-width": 1 }));
  const ticks = narrow ? [0, G / 2, G] : x.ticks(4).filter((v) => v <= G);
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, ticks, title: L.gen, format: (v) => String(v), size: fs }));
  return { svg: g({ class: "fig-panel" }, ...parts), h: top - y0 + plotH + axisHeight(true, fs) };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const n = Math.min(Math.round(st.t), p.generations);
  const all = { replace: series("replace", p), anchor: series("anchor", p), accumulate: series("accumulate", p) } as Record<Regime, Series>;
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    const h = histogram(p, n, all[p.protocol].run, 0, y, w, L, fs, narrow);
    parts.push(h.svg); y += h.h + 14;
    const r = readout(p, n, all, 0, y, w, L, fs);
    parts.push(r.svg); y += r.h + 18;
  } else {
    const hw = Math.floor(w * 0.6);
    const h = histogram(p, n, all[p.protocol].run, 0, y, hw, L, fs, narrow);
    const r = readout(p, n, all, hw + 24, y, w - hw - 24, L, fs);
    parts.push(h.svg, r.svg);
    y += Math.max(h.h, r.h) + 18;
  }
  // Shared legend for the two trajectory panels.
  const lg = legend([
    ...REGIMES.map((r) => ({ label: L[r] + (r === p.protocol ? ` (${L.runKey})` : ""), swatch: { kind: "line" as const, stroke: COLOR[r], dash: r === p.protocol ? undefined : "5 3" } })),
    { label: tpl(L.bandKey, { r: RUNS }), swatch: { kind: "rect", fill: COLOR[p.protocol], opacity: 0.2 } },
  ], 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height + 8;
  if (narrow) {
    const a = panel("v", p, n, all, 0, y, w, L, fs, st.uid, narrow);
    parts.push(a.svg); y += a.h + 12;
    const b = panel("t", p, n, all, 0, y, w, L, fs, st.uid, narrow);
    parts.push(b.svg); y += b.h;
  } else {
    const pw = (w - 24) / 2;
    const a = panel("v", p, n, all, 0, y, pw, L, fs, st.uid, narrow);
    const b = panel("t", p, n, all, pw + 24, y, pw, L, fs, st.uid, narrow);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "synthetic-generations",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    protocol: {
      kind: "choice", label: { en: "Protocol", zh: "训练协议" }, default: "replace",
      options: [
        { value: "replace", label: { en: "Replacement", zh: "替换" } },
        { value: "anchor", label: { en: "Fixed anchor", zh: "固定锚点" } },
        { value: "accumulate", label: { en: "Accumulation", zh: "累积" } },
      ],
    },
    alpha: {
      kind: "range", label: { en: "Human share α (fixed anchor)", zh: "人类数据占比 α（固定锚点）" }, min: 0.02, max: 0.5, step: 0.01, default: 0.1,
      marks: [{ value: 0.1, label: { en: "10%, as in Shumailov et al.", zh: "10%，同 Shumailov 等人" } }],
    },
    samples: {
      kind: "choice", label: { en: "Samples per generation N", zh: "每代样本数 N" }, default: 100,
      options: [
        { value: 50, label: { en: "50", zh: "50" } },
        { value: 100, label: { en: "100", zh: "100" } },
        { value: 200, label: { en: "200", zh: "200" } },
        { value: 500, label: { en: "500", zh: "500" } },
      ],
    },
    topP: {
      kind: "choice", label: { en: "Decoding (top-p)", zh: "解码（top-p）" }, default: 1,
      options: [
        { value: 1, label: { en: "full, p = 1", zh: "完整，p = 1" } },
        { value: 0.99, label: { en: "p = 0.99", zh: "p = 0.99" } },
        { value: 0.95, label: { en: "p = 0.95", zh: "p = 0.95" } },
        { value: 0.9, label: { en: "p = 0.9", zh: "p = 0.9" } },
      ],
    },
    generations: { kind: "range", label: { en: "Generations", zh: "代数" }, min: 20, max: 200, step: 10, default: 60, control: false },
    seed: { kind: "range", label: { en: "Seed", zh: "随机种子" }, min: 1, max: 9999, step: 1, default: 2823, control: false },
  },
  // Moving the anchor share is a request to see the anchor protocol.
  update(p, key) {
    if (key === "alpha") return { ...p, protocol: "anchor" };
    return p;
  },
  timeline: {
    rate: 6,
    discrete: true,
    duration: (p) => p.generations,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const run = series(p.protocol, p).run;
      const ev = events(run);
      const byT = new Map<number, string[]>();
      byT.set(0, [L.evStart]);
      for (const e of ev) byT.set(e.t, [...(byT.get(e.t) ?? []), eventLabel(e, L)]);
      const end = run.m[p.generations];
      byT.set(p.generations, [...(byT.get(p.generations) ?? []), tpl(L.evEnd, { n: p.generations, s: end.support, k: K })]);
      return [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, ls]) => ({ t, label: ls.join(lang === "zh" ? "；" : "; ") }));
    },
    // Open where the chosen protocol's tail has lost most of its mass, the
    // moment the histogram shows "tails first"; otherwise at the end.
    poster: (p) => {
      const run = series(p.protocol, p).run;
      for (let n = 1; n <= p.generations; n++) if (run.m[n].tail < 0.25 * BASE.tail) return n;
      return p.generations;
    },
  },
  render,
  describe,
});
