// Head and tail sampling of traces, and what each does to an error-rate
// estimate. One seeded population of N = 2,000 traces, of which round(p·N)
// are errors (the traces with the smallest error draws, so the population
// rate is p up to rounding and a higher p adds errors without moving others).
// Head sampling keeps every trace with probability h, decided before the
// outcome is known. The tail rule sees the outcome and also keeps
// a share t of the error traces. The inclusion probabilities are
//
//   π_e = 1 − (1 − h)(1 − t)   for an error trace
//   π_s = h                    for a success
//
// A dashboard over the kept traces reports k_e / (k_e + k_s), whose expected
// value p·π_e / (p·π_e + (1 − p)·h) exceeds p whenever t > 0. The
// design-weighted estimate weights each kept trace by 1 / π, the chapter's
// inverse inclusion probability:
//
//   p̂ = (k_e / π_e) / (k_e / π_e + k_s / π_s),
//
// which recovers the population rate up to sampling noise.
//
// Each trace draws its three uniforms once from the seed, so moving a control
// keeps the same traces and the same draws: raising h keeps a superset. The
// population and rates are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, wrap, type Box } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { rng } from "./lib/random.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const N = 2000;
const COLS = 50;

type P = { errorRate: number; head: number; tail: number; seed: number };

// Per seed: three uniforms per trace, and each trace's rank by its first
// uniform, which orders the traces for error assignment.
const draws = new Map<number, { u: Float64Array; rank: Uint16Array }>();
function uniforms(seed: number): { u: Float64Array; rank: Uint16Array } {
  let hit = draws.get(seed);
  if (!hit) {
    const r = rng(seed);
    const u = new Float64Array(3 * N);
    for (let i = 0; i < u.length; i++) u[i] = r();
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => u[3 * a] - u[3 * b]);
    const rank = new Uint16Array(N);
    order.forEach((i, k) => { rank[i] = k; });
    hit = { u, rank };
    if (draws.size > 8) draws.clear();
    draws.set(seed, hit);
  }
  return hit;
}

// Trace state: 0 dropped success, 1 kept success, 2 dropped error, 3 kept error.
function model(p: P) {
  const pe = p.errorRate / 100, h = p.head / 100, t = p.tail / 100;
  const { u, rank } = uniforms(p.seed);
  const errors = Math.round(pe * N);
  const state = new Uint8Array(N);
  let ne = 0, ke = 0, ks = 0;
  for (let i = 0; i < N; i++) {
    const err = rank[i] < errors;
    const kept = u[3 * i + 1] < h || (err && u[3 * i + 2] < t);
    if (err) ne++;
    if (kept && err) ke++;
    if (kept && !err) ks++;
    state[i] = (err ? 2 : 0) + (kept ? 1 : 0);
  }
  const piE = 1 - (1 - h) * (1 - t), piS = h;
  const naive = ke + ks ? ke / (ke + ks) : 0;
  const we = ke / piE, ws = ks / piS;
  const weighted = we + ws ? we / (we + ws) : 0;
  return { pe, h, t, state, ne, ns: N - ne, ke, ks, piE, piS, naive, we, ws, weighted, truth: ne / N };
}
type M = ReturnType<typeof model>;

// Expected dashboard rate at tail share t.
function expectedNaive(pe: number, h: number, t: number): number {
  const piE = 1 - (1 - h) * (1 - t);
  return (pe * piE) / (pe * piE + (1 - pe) * h);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Head and tail sampling and the error-rate estimate",
    grid: "{n} traces, one square each",
    keptOk: "kept, success",
    keptErr: "kept, error",
    dropErr: "dropped, error",
    dropOk: "dropped, success",
    chart: "Error rate estimated from the kept traces",
    xTitle: "share of error traces the tail rule keeps, t (%)",
    naive: "dashboard, kept traces only",
    weighted: "design-weighted, 1 / π",
    truth: "population rate",
    sample: "dots: this sample",
    kept: "kept: {ke} of {ne} error traces and {ks} of {ns} successes",
    inclusion: "inclusion: π_e = 1 − (1 − h)(1 − t) = 1 − (1 − {h})(1 − {t}) = {pie}, π_s = h = {h}",
    naiveLine: "dashboard: k_e / (k_e + k_s) = {ke} / {k} = {v}",
    weightedLine: "weighted: (k_e / π_e) / (k_e / π_e + k_s / π_s) = {a} / {b} = {v}",
    truthLine: "population: {ne} / {n} = {v}",
    describe: "Of {n} traces with a {p} error rate, head sampling keeps {h} and the tail rule keeps {t} of error traces. The dashboard over kept traces shows {naive}, the design-weighted estimate {w}, and the population rate is {truth}.",
  },
  zh: {
    title: "头部采样、尾部采样与错误率估计",
    grid: "{n} 条追踪，每格一条",
    keptOk: "保留，成功",
    keptErr: "保留，错误",
    dropErr: "丢弃，错误",
    dropOk: "丢弃，成功",
    chart: "由保留追踪估计的错误率",
    xTitle: "尾部规则保留的错误追踪比例 t（%）",
    naive: "仪表盘，只看保留的追踪",
    weighted: "设计加权，权重 1 / π",
    truth: "总体错误率",
    sample: "圆点：本次样本",
    kept: "保留：{ne} 条错误追踪中的 {ke} 条，{ns} 条成功追踪中的 {ks} 条",
    inclusion: "纳入概率：π_e = 1 − (1 − h)(1 − t) = 1 − (1 − {h})(1 − {t}) = {pie}，π_s = h = {h}",
    naiveLine: "仪表盘：k_e / (k_e + k_s) = {ke} / {k} = {v}",
    weightedLine: "加权：(k_e / π_e) / (k_e / π_e + k_s / π_s) = {a} / {b} = {v}",
    truthLine: "总体：{ne} / {n} = {v}",
    describe: "{n} 条追踪的错误率为 {p}，头部采样保留 {h}，尾部规则保留 {t} 的错误追踪。只看保留追踪的仪表盘显示 {naive}，设计加权估计为 {w}，总体错误率为 {truth}。",
  },
};
type L = typeof labels.en;

const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const rate = (v: number) => pct(v, 1);
const prob = (v: number) => fixed(v, v >= 0.1 || v === 0 ? 2 : 3);

// ---------------------------------------------------------------- render

function renderGrid(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(Lx.grid, { n: int(N) }), TYPE.label, w - 12, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  const lg = legend([
    { label: Lx.keptOk, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.keptErr, swatch: { kind: "rect", fill: C.c2 } },
    { label: Lx.dropErr, swatch: { kind: "rect", fill: C.c2, opacity: 0.3 } },
    { label: Lx.dropOk, swatch: { kind: "rect", fill: C.panel, stroke: C.rule } },
  ], x0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 8;
  const pitch = w / COLS;
  const size = Math.max(2, pitch - 1);
  // One path per trace state keeps 2,000 squares compact.
  const d: string[][] = [[], [], [], []];
  for (let i = 0; i < N; i++) {
    const cx = x0 + (i % COLS) * pitch, cy = y + Math.floor(i / COLS) * pitch;
    d[m.state[i]].push(`M${cx.toFixed(1)},${cy.toFixed(1)}h${size.toFixed(1)}v${size.toFixed(1)}h-${size.toFixed(1)}z`);
  }
  const style: Array<[string, number]> = [[C.panel, 1], [C.c1, 1], [C.c2, 0.3], [C.c2, 1]];
  d.forEach((ds, k) => { if (ds.length) parts.push(el("path", { d: ds.join(""), fill: style[k][0], "fill-opacity": style[k][1] < 1 ? style[k][1] : undefined })); });
  const rows = Math.ceil(N / COLS);
  return { svg: g({ class: "fig-grid" }, ...parts), h: y + rows * pitch - y0 };
}

function renderChart(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.chart, TYPE.label, w - 12, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 14;
  const left = x0 + 42, right = x0 + w - 10;
  const top = y, ph = 190, bottom = top + ph;
  const xs = linear([0, 100], [left, right]);
  const hi = Math.max(expectedNaive(m.truth, m.h, 1), m.naive, m.weighted, m.truth) * 1.12;
  const step = niceStep(hi, 4);
  const yMax = Math.ceil(hi / step) * step;
  const ys = linear([0, yMax], [bottom, top]);
  const yt: number[] = [];
  for (let v = 0; v <= yMax + step / 2; v += step) yt.push(Number(v.toPrecision(10)));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: yt, grid: [left, right], size: fs, format: (v) => pct(v, step < 0.01 ? 1 : 0) }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0, 25, 50, 75, 100], title: Lx.xTitle, size: fs, format: (v) => String(v) }));

  const naivePts: Array<[number, number]> = [];
  for (let k = 0; k <= 100; k++) naivePts.push([xs(k), ys(expectedNaive(m.truth, m.h, k / 100))]);
  const truthPts: Array<[number, number]> = [[left, ys(m.truth)], [right, ys(m.truth)]];
  parts.push(el("path", { d: linePath(truthPts), fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
  parts.push(el("path", { d: linePath(naivePts), fill: "none", stroke: C.c2, "stroke-width": 2, "stroke-linejoin": "round" }));

  const cx = xs(m.t * 100);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const dots: Array<[number, string, string]> = [[m.naive, C.c2, rate(m.naive)], [m.weighted, C.c1, rate(m.weighted)]];
  const obstacles: Box[] = [...lineObstacles(naivePts), ...lineObstacles(truthPts)];
  for (const [v, color] of dots) {
    const cy = ys(v);
    parts.push(el("circle", { cx, cy, r: 5, fill: color, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 });
  }
  const placed = placeLabels(dots.map(([v, , s], i) => ({
    x: cx, y: ys(v), text: s, size: TYPE.body, gap: 8, priority: 2 - i,
    sides: ["left", "right", "above-left", "below-left", "above-right", "below-right", "above", "below"],
    attrs: { class: "fig-t-halo fig-t-strong fig-t-num" },
  })), { x0: left + 2, y0: top - 2, x1: right, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  y = bottom + axisHeight(true, fs) + 6;
  const lg = legend([
    { label: Lx.naive, swatch: { kind: "line", stroke: C.c2 } },
    { label: Lx.weighted, swatch: { kind: "dot", fill: C.c1 } },
    { label: Lx.truth, swatch: { kind: "line", stroke: C.ink2, dash: "5 4" } },
  ], x0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height + 2;
  y += fs + 2;
  parts.push(text(x0, y, Lx.sample, { "font-size": fs, class: "fig-t-muted" }));
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 + 4 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, { n: int(N), p: pct(m.pe, 1), h: pct(m.h, 0), t: pct(m.t, 0), naive: rate(m.naive), w: rate(m.weighted), truth: rate(m.truth) });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const m = model(st.p);
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    const gr = renderGrid(m, 0, y, w, Lx, lang, fs);
    parts.push(gr.svg); y += gr.h + 20;
    const ch = renderChart(m, 0, y, w, Lx, lang, fs);
    parts.push(ch.svg); y += ch.h + 12;
  } else {
    const gap = 26;
    const gw = Math.floor((w - gap) * 0.44);
    const gr = renderGrid(m, 0, y, gw, Lx, lang, fs);
    const ch = renderChart(m, gw + gap, y, w - gw - gap, Lx, lang, fs);
    parts.push(gr.svg, ch.svg);
    y += Math.max(gr.h, ch.h) + 14;
  }
  // Readout: the estimators with this sample's counts.
  const rows: Array<[string, string]> = [
    [tpl(Lx.kept, { ke: int(m.ke), ne: int(m.ne), ks: int(m.ks), ns: int(m.ns) }), ""],
    [tpl(Lx.inclusion, { h: prob(m.h), t: prob(m.t), pie: prob(m.piE) }), "fig-t-num"],
    [tpl(Lx.naiveLine, { ke: int(m.ke), k: int(m.ke + m.ks), v: rate(m.naive) }), "fig-t-num fig-t-strong"],
    [tpl(Lx.weightedLine, { a: int(m.we), b: int(m.we + m.ws), v: rate(m.weighted) }), "fig-t-num fig-t-strong"],
    [tpl(Lx.truthLine, { ne: int(m.ne), n: int(N), v: rate(m.truth) }), "fig-t-num"],
  ];
  const ro: string[] = [];
  for (const [line, cls] of rows) {
    for (const part of lines(line, TYPE.body, w, lang)) { y += 17; ro.push(text(0, y, part, { "font-size": TYPE.body, class: cls || undefined })); }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "trace-sampling",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    errorRate: { kind: "range", scale: "log", label: { en: "Population error rate p", zh: "总体错误率 p" }, unit: { en: "%", zh: "%" }, min: 0.5, max: 20, default: 2 },
    head: {
      kind: "range", scale: "log", label: { en: "Head sampling keeps h", zh: "头部采样保留比例 h" }, unit: { en: "%", zh: "%" }, min: 1, max: 100, default: 5,
      marks: [{ value: 10, label: { en: "10%", zh: "10%" } }],
    },
    tail: { kind: "range", label: { en: "Tail rule keeps errors, t", zh: "尾部规则保留错误的比例 t" }, unit: { en: "%", zh: "%" }, min: 0, max: 100, step: 5, default: 100 },
    seed: { kind: "range", label: { en: "Population seed", zh: "总体种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
