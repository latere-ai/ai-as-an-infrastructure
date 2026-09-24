// Build or buy: monthly cost against monthly token demand for a hosted API
// billed per token and for a self-hosted fleet bought in whole replicas, with
// the API price falling over a planning horizon. Every term is one the
// economics chapter defines; the default numbers are illustrative, not quotes.
//
//   API in year k      B_k(V) = F_b + p_k·V,        p_k = p·(1 − δ)^k
//   self-host          S(V)   = F_s + n(V)·R + c_m·V
//                      n(V)   = max(n_min, ⌈V / K⌉)
//                      R = a·r_eff·730 h                 USD per replica-month
//                      K = a·τ·u·3600 s·730 h            tokens per replica-month
//                                                        at planned utilization u
//   linear shortcut    V* = F / (p − c),  F = F_s − F_b,  c = r_eff / (u·τ) + c_m
//                      (capacity treated as divisible: the lower envelope of S,
//                      touching it where each replica is filled to u)
//   horizon totals     C_buy = Σ_t d_t·B_t,  C_self = F_0 + Σ_t d_t·S_t,
//                      d_t = (1 + r)^−t over months t = 1..12T,
//                      p_t = p·(1 − δ)^((t − 1)/12)
//   scenarios          low, base, high demand (base ÷ k, base, base × k) and
//                      E[C_a] = Σ_s π_s·C_{a,s} with π = (¼, ½, ¼)
//
// Self-host costs stay at the committed rate for the whole horizon while the
// API price falls every month. The first demand at which self-hosting is
// cheaper, and the demand above which it stays cheaper, have closed forms
// (crossing()), so the readout reports a break-even beyond the plotted range.
// c = r_eff / (u·τ) is the chapter's accelerator cost per result,
// r_eff·H_billed / N_accept, with realized throughput N / H = u·τ: utilization
// is applied once, to a full-load throughput.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box } from "./lib/labels.ts";
import { wrapCJK, count } from "./lib/notation.ts";
import { int, sig, tpl } from "./lib/format.ts";

const HOURS = 730; // hours in an average month, 8,760 / 12
const WEIGHTS = [0.25, 0.5, 0.25]; // π for low, base, high demand

type P = {
  demand: number; // base demand, billions of tokens per month
  price: number; // API price now, USD per million tokens
  decline: number; // API price decline, percent per year
  accel: number; // r_eff, USD per accelerator-hour
  util: number; // planned utilization u, percent
  fixed: number; // F_s, USD per month
  horizon: number; // T, years
  tput: number; // τ, tokens per second per accelerator at full load
  perReplica: number; // a, accelerators per replica
  minReplicas: number; // n_min
  setup: number; // F_0, USD
  discount: number; // percent per year
  marginal: number; // c_m, USD per million tokens
  buyFixed: number; // F_b, USD per month
  spread: number; // k: low demand = base / k, high = base × k
  vmax: number; // right edge of the demand axis, billions of tokens per month
  ymax: number; // top of the cost axis, USD per month
};

// ---------------------------------------------------------------- model

interface Model {
  R: number; // USD per replica-month
  K: number; // million tokens per replica-month at utilization u
  c: number; // USD per million tokens, divisible capacity
  F: number; // USD per month, F_s − F_b
  priceAt: (years: number) => number;
  S: (V: number) => number; // V in million tokens
  n: (V: number) => number;
}

function model(p: P): Model {
  const R = p.perReplica * p.accel * HOURS;
  const K = (p.perReplica * p.tput * (p.util / 100) * 3600 * HOURS) / 1e6;
  const c = R / K + p.marginal;
  const n = (V: number) => Math.max(p.minReplicas, Math.ceil(V / K - 1e-9));
  return {
    R, K, c, F: p.fixed - p.buyFixed,
    priceAt: (years) => p.price * (1 - p.decline / 100) ** years,
    S: (V) => p.fixed + n(V) * R + p.marginal * V,
    n,
  };
}

// Demand ranges (million tokens) where the self-host bill is below the API
// bill at price `price`, within [0, vmax], each with the replicas at its
// start. Inside one replica step both bills are linear in V, so each step
// contributes at most one interval.
function cheaper(p: P, m: Model, price: number, vmax: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const s = price - p.marginal;
  const last = Math.min(p.minReplicas + 200000, Math.max(p.minReplicas, Math.ceil(vmax / m.K)));
  for (let k = p.minReplicas; k <= last; k++) {
    const lo = k === p.minReplicas ? 0 : (k - 1) * m.K;
    if (lo >= vmax) break;
    const hi = Math.min(k * m.K, vmax);
    const a = p.buyFixed - p.fixed - k * m.R; // API − self at V = 0, this step
    let seg: [number, number] | null = null;
    if (s > 0) { const v0 = -a / s; if (v0 < hi) seg = [Math.max(lo, v0), hi]; }
    else if (s === 0) { if (a > 0) seg = [lo, hi]; }
    else { const v0 = -a / s; if (v0 > lo) seg = [lo, Math.min(hi, v0)]; }
    if (seg && seg[1] > seg[0]) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(prev[1] - seg[0]) < 1e-9) prev[1] = seg[1]; else out.push([seg[0], seg[1], k]);
    }
  }
  return out;
}

// First demand at which self-hosting is cheaper, the demand above which it
// stays cheaper, and the replicas at the first one. Closed forms when the
// API margin over a full replica, K·(p − c_m) − R, is positive:
//   n* = max(n_min, ⌈F / (K·s − R)⌉),        first = (F + n*·R) / s
//   a later step starts with the API cheaper while (F + n·R) / s > (n − 1)·K,
//   that is while n < (F + K·s) / (K·s − R), so the last such step bounds
//   the sustained break-even.
interface Crossing { first: number | null; steady: number | null; replicas: number }
function crossing(p: P, m: Model, price: number): Crossing {
  const s = price - p.marginal;
  const margin = m.K * s - m.R;
  if (s > 0 && margin > 0) {
    const nStar = Math.max(p.minReplicas, Math.ceil(m.F / margin - 1e-9));
    const first = Math.max(0, (m.F + nStar * m.R) / s);
    const nSteady = Math.max(nStar, Math.ceil((m.F + m.K * s) / margin - 1 - 1e-9));
    const steady = Math.max(0, (m.F + nSteady * m.R) / s);
    return { first, steady, replicas: nStar };
  }
  // The API is cheaper per token at scale; self-hosting can win only on a
  // bounded range at low demand (a large F_b), found by scanning the steps.
  const iv = cheaper(p, m, price, Math.max(p.vmax * 1000, 1));
  return iv.length ? { first: iv[0][0], steady: null, replicas: iv[0][2] } : { first: null, steady: null, replicas: 0 };
}

// Discounted horizon totals at a constant monthly demand V (million tokens).
function totals(p: P, m: Model, V: number): { buy: number; self: number } {
  const rm = (1 + p.discount / 100) ** (1 / 12) - 1;
  const months = Math.round(p.horizon * 12);
  const S = m.S(V);
  let buy = 0, self = p.setup;
  for (let t = 1; t <= months; t++) {
    const d = (1 + rm) ** -t;
    buy += d * (p.buyFixed + m.priceAt((t - 1) / 12) * V);
    self += d * S;
  }
  return { buy, self };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Build or buy with capacity steps and falling prices",
    lgNow: "API price now",
    lgEnd: "API price in {T} yr",
    lgYears: "API price after each year",
    lgSelf: "self-host, whole replicas",
    lgShort: "linear shortcut",
    lgDemand: "demand, low to high",
    x: "demand (tokens per month)",
    y: "monthly cost (USD)",
    range: "break-even over {T} yr",
    rangeBeyond: "break-even over {T} yr, {v} at the end",
    rangeNone: "break-even over {T} yr, none at the end",
    strip: "Cheaper each month",
    api: "API",
    self: "self-host",
    rowNow: "now",
    rowYr: "{k} yr",
    costHead: "Self-host cost per token,| replicas of {a:accelerator/accelerators}, at least {n}",
    cost: "c = r_eff / (u·τ)| = {r} per hour / ({u} × {tau} tokens/s)| = {c} per M tokens",
    costM: "c = r_eff / (u·τ) + c_m| = {r} per hour / ({u} × {tau} tokens/s) + {m}| = {c} per M tokens",
    head: "Break-even demand, tokens per month",
    whenNow: "Now",
    whenEnd: "In {T} yr",
    halfLife: " (half-life {h} yr)",
    shortcut: "{when}, p = {p}{hl}:| linear shortcut V* = F / (p − c)| = {F} / ({p} − {c}) = {v}",
    shortcutNone: "{when}, p = {p}{hl}:| p ≤ c, so the linear shortcut has no break-even",
    steps: "whole replicas: {what}",
    stepAt: "{v} with {k} replicas",
    stepAlt: "{v} with {k} replicas,| and above {s} at every demand",
    stepNone: "none at any demand",
    totals: "Discounted totals over {T} yr at {r}% per year:| C_buy = Σ d_t B_t,| C_self = F₀ + Σ d_t S_t, F₀ = {f0}",
    low: "low {v}",
    base: "base {v}",
    high: "high {v}",
    expected: "expected, π = ¼, ½, ¼",
    describe: "At {d} tokens per month the API bill is {b0} a month now and {bT} in {T} yr, against {s} for self-hosting on {k} replicas. The break-even demand is {v0} now and {vT} in {T} yr; discounted over the horizon the API totals {cb} and self-hosting {cs}.",
    never: "none",
  },
  zh: {
    title: "容量台阶与价格下降下的自建或购买",
    lgNow: "当前 API 价格",
    lgEnd: "{T} 年后的 API 价格",
    lgYears: "每年末的 API 价格",
    lgSelf: "自托管，按整副本扩容",
    lgShort: "线性近似",
    lgDemand: "需求区间，低到高",
    x: "需求（每月词元数）",
    y: "月成本（美元）",
    range: "{T} 年内的盈亏平衡点",
    rangeBeyond: "{T} 年内的盈亏平衡点，期末为 {v}",
    rangeNone: "{T} 年内的盈亏平衡点，期末已不存在",
    strip: "每个月更便宜的方案",
    api: "API",
    self: "自托管",
    rowNow: "当前",
    rowYr: "{k} 年后",
    costHead: "自托管每词元成本|（每个副本 {a} 个加速器，至少 {n} 个副本）",
    cost: "c = r_eff / (u·τ)| = 每小时 {r} / ({u} × {tau} 词元/秒)| = 每百万词元 {c}",
    costM: "c = r_eff / (u·τ) + c_m| = 每小时 {r} / ({u} × {tau} 词元/秒) + {m}| = 每百万词元 {c}",
    head: "盈亏平衡需求，按每月词元数计",
    whenNow: "当前",
    whenEnd: "{T} 年后",
    halfLife: "（半衰期 {h} 年）",
    shortcut: "{when}，p = {p}{hl}：|线性近似 V* = F / (p − c)| = {F} / ({p} − {c}) = {v}",
    shortcutNone: "{when}，p = {p}{hl}：|p ≤ c，线性近似不存在盈亏平衡点",
    steps: "按整副本计算：{what}",
    stepAt: "{v}，需 {k} 个副本",
    stepAlt: "{v}，需 {k} 个副本；|超过 {s} 后在任何需求下都更便宜",
    stepNone: "任何需求下都不存在",
    totals: "{T} 年折现总成本，年折现率 {r}%：|C_buy = Σ d_t B_t，|C_self = F₀ + Σ d_t S_t，F₀ = {f0}",
    low: "低 {v}",
    base: "基准 {v}",
    high: "高 {v}",
    expected: "期望，π = ¼、½、¼",
    describe: "每月需求为 {d} 词元时，API 当前每月 {b0}，{T} 年后每月 {bT}；自托管用 {k} 个副本，每月 {s}。盈亏平衡需求当前为 {v0}，{T} 年后为 {vT}；按整个规划期折现，API 共 {cb}，自托管共 {cs}。",
    never: "不存在",
  },
};

type Labels = typeof labels.en;

const usd = (v: number) => `$${count(v, 3)}`;
const usdP = (v: number) => `$${v >= 10 ? sig(v, 3) : v.toFixed(2)}`;
const tok = (Vm: number) => count(Vm * 1e6, 2); // million tokens → "8.2B"

// ---------------------------------------------------------------- render

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const V = p.demand * 1000;
  const c0 = crossing(p, m, m.priceAt(0));
  const cT = crossing(p, m, m.priceAt(p.horizon));
  const t = totals(p, m, V);
  const at = (c: Crossing) => (c.first == null ? L.never : tok(c.first));
  return tpl(L.describe, {
    d: tok(V), b0: usd(p.buyFixed + m.priceAt(0) * V), bT: usd(p.buyFixed + m.priceAt(p.horizon) * V), T: p.horizon,
    s: usd(m.S(V)), k: m.n(V), v0: at(c0), vT: at(cT), cb: usd(t.buy), cs: usd(t.self),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L: Labels = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small; // smallest text
  const fb = TYPE.body;
  const m = model(p);
  const T = p.horizon;
  const V = p.demand * 1000;
  // Axes span the chapter's ranges and grow only when the demand band or the
  // smallest fleet would leave them, so every state keeps both bills on screen.
  const niceCeil = (v: number) => { const st = niceStep(v, 5); return Math.ceil(v / st - 1e-9) * st; };
  const vmaxM = Math.max(p.vmax * 1000, V * p.spread > p.vmax * 1000 ? niceCeil(V * p.spread * 1.1) : 0);
  const yTop = Math.max(p.ymax, m.S(0) > 0.8 * p.ymax ? niceCeil(m.S(0) * 1.4) : 0);
  const parts: string[] = [];
  const clip = `${st.uid}-plot`;

  // ---- legend
  const items = [
    { label: L.lgNow, swatch: { kind: "line" as const, stroke: C.c1 } },
    ...(T > 1 ? [{ label: L.lgYears, swatch: { kind: "line" as const, stroke: C.c1, dash: "1 3" } }] : []),
    { label: tpl(L.lgEnd, { T }), swatch: { kind: "line" as const, stroke: C.c1, dash: "6 3" } },
    { label: L.lgSelf, swatch: { kind: "line" as const, stroke: C.c2 } },
    { label: L.lgShort, swatch: { kind: "line" as const, stroke: C.ink3, dash: "4 3" } },
    { label: L.lgDemand, swatch: { kind: "rect" as const, fill: C.c3, opacity: 0.22 } },
  ];
  const lg = legend(items, 0, 0, w, fs);
  parts.push(lg.svg);

  // ---- plot: monthly cost against monthly demand
  const left = narrow ? 40 : 48;
  const right = w - (narrow ? 4 : 10);
  const top = lg.height + 22;
  const plotH = narrow ? 210 : 250;
  const bottom = top + plotH;
  const x = linear([0, vmaxM], [left, right]);
  const y = linear([0, yTop], [bottom, top]);
  const X = (Vm: number) => x(Math.min(Vm, vmaxM));
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: right - left, height: plotH }))));

  const lo = V / p.spread, hi = V * p.spread;
  if (lo < vmaxM) parts.push(el("rect", { x: X(lo), y: top, width: Math.max(1, X(hi) - X(lo)), height: plotH, fill: C.c3, "fill-opacity": 0.14 }));
  const xTicks = x.ticks(narrow ? 3 : 6);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], ticks: xTicks, title: L.x, size: fs, format: (v) => (v === 0 ? "0" : tok(v)) }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: y.ticks(narrow ? 4 : 5), title: L.y, size: fs, format: (v) => (v === 0 ? "0" : count(v, 3)) }));
  if (V <= vmaxM) parts.push(el("line", { x1: X(V), x2: X(V), y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));

  const plot: string[] = [];
  const obstacles: Box[] = [];
  // API lines: now, the end of each intermediate year, and the horizon.
  const apiPts = (k: number): Array<[number, number]> => [[x(0), y(p.buyFixed)], [x(vmaxM), y(p.buyFixed + m.priceAt(k) * vmaxM)]];
  for (let k = 1; k < T; k++) plot.push(el("path", { d: linePath(apiPts(k)), fill: "none", stroke: C.c1, "stroke-width": 1.2, "stroke-dasharray": "1 3", "stroke-linecap": "round" }));
  plot.push(el("path", { d: linePath(apiPts(T)), fill: "none", stroke: C.c1, "stroke-width": 1.8, "stroke-dasharray": "6 3" }));
  plot.push(el("path", { d: linePath(apiPts(0)), fill: "none", stroke: C.c1, "stroke-width": 2.2 }));
  for (const k of [0, T]) obstacles.push(...lineObstacles(apiPts(k)));

  // The linear shortcut: F_s + c·V, the lower envelope of the steps.
  const shortPts: Array<[number, number]> = [[x(0), y(p.fixed)], [x(vmaxM), y(p.fixed + m.c * vmaxM)]];
  plot.push(el("path", { d: linePath(shortPts), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  obstacles.push(...lineObstacles(shortPts));

  // The self-host staircase, exact while steps are wider than a pixel.
  const steps = Math.ceil(vmaxM / m.K);
  const stair: Array<[number, number]> = [];
  if (steps <= (right - left) / 2) {
    // Step k covers demand up to k·K; the minimum fleet covers everything
    // below n_min·K.
    let k = p.minReplicas;
    stair.push([x(0), y(p.fixed + k * m.R)]);
    for (;;) {
      const edge = Math.min(k * m.K, vmaxM);
      stair.push([x(edge), y(p.fixed + k * m.R + p.marginal * edge)]);
      if (edge >= vmaxM) break;
      k++;
      stair.push([x(edge), y(p.fixed + k * m.R + p.marginal * edge)]);
    }
  } else {
    for (let px = left; px <= right; px += 1) { const vv = x.invert(px); stair.push([px, y(m.S(vv))]); }
  }
  plot.push(el("path", { d: linePath(stair), fill: "none", stroke: C.c2, "stroke-width": 2.2, "stroke-linejoin": "miter" }));
  obstacles.push(...lineObstacles(stair, 8));
  parts.push(g({ "clip-path": `url(#${clip})` }, ...plot));

  // Break-even markers, now and at the horizon.
  const c0 = crossing(p, m, m.priceAt(0));
  const cT = crossing(p, m, m.priceAt(T));
  const reqs = [];
  const marks: string[] = [];
  for (const [c, k, solid] of [[c0, 0, true], [cT, T, false]] as const) {
    if (c.first == null || c.first > vmaxM) continue;
    const cy = y(p.buyFixed + m.priceAt(k) * c.first);
    if (cy < top) continue;
    const cx = x(c.first);
    marks.push(el("circle", { cx, cy, r: 5, fill: solid ? C.c2 : C.paper, stroke: solid ? C.paper : C.c2, "stroke-width": solid ? 1.5 : 2 }));
    obstacles.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 });
    reqs.push({ x: cx, y: cy, text: tok(c.first), size: fs, sides: ["above-left", "left", "below-right", "right", "above", "below"] as const, gap: 9, priority: solid ? 3 : 2, attrs: { class: "fig-t-halo fig-t-num" } });
  }

  // Break-even range over the horizon, as a bracket above the axis.
  const rb = bottom - 12;
  const a0 = c0.first, aT = cT.first;
  if (a0 != null && a0 < vmaxM && (aT == null || aT > a0 * 1.001)) {
    const x0 = x(a0), x1 = aT == null ? right : X(aT);
    const open = aT == null || aT > vmaxM;
    marks.push(el("line", { x1: x0, x2: x1, y1: rb, y2: rb, stroke: C.ink, "stroke-width": 2 }));
    marks.push(el("line", { x1: x0, x2: x0, y1: rb - 4, y2: rb + 4, stroke: C.ink, "stroke-width": 1.5 }));
    if (!open) marks.push(el("line", { x1: x1, x2: x1, y1: rb - 4, y2: rb + 4, stroke: C.ink, "stroke-width": 1.5 }));
    else marks.push(el("path", { d: `M${x1 - 6},${rb - 4}L${x1},${rb}L${x1 - 6},${rb + 4}`, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    const lbl = tpl(aT == null ? L.rangeNone : open ? L.rangeBeyond : L.range, { T, v: aT == null ? "" : tok(aT) });
    const lw = textWidth(lbl, fs);
    const lx = Math.min(Math.max((x0 + x1) / 2, left + lw / 2 + 2), right - lw / 2 - 2);
    marks.push(text(lx, rb - 7, lbl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo" }));
    obstacles.push({ x0: lx - lw / 2, y0: rb - 7 - fs, x1: lx + lw / 2, y1: rb + 5 });
  }
  const placed = placeLabels(reqs.map((r) => ({ ...r, sides: [...r.sides] })), { x0: left + 2, y0: top + 2, x1: right - 2, y1: bottom - 2 }, obstacles);
  parts.push(g({}, ...marks), drawLabels(placed.placed));

  // Pointer shortcut: a click in the plot moves the base demand there (the
  // demand slider is the keyboard path).
  const cols = narrow ? 24 : 48;
  const cw = (right - left) / cols;
  for (let i = 0; i < cols; i++) {
    const v = Number(Math.min(100, Math.max(0.5, x.invert(left + (i + 0.5) * cw) / 1000)).toPrecision(2));
    parts.push(el("rect", { x: left + i * cw, y: top, width: cw, height: plotH, fill: "transparent", "data-fig-set": `demand=${v}`, class: "fig-hit" }));
  }

  // ---- strip: which monthly bill is lower, by year of the horizon
  let yy = bottom + axisHeight(true, fs) + 16;
  const sw = 10;
  parts.push(text(0, yy, L.strip, { "font-size": fb, class: "fig-t-strong" }));
  let lx = textWidth(L.strip, fb) + 14;
  for (const [name, fill, op] of [[L.api, C.c1, 0.3], [L.self, C.c2, 0.9]] as const) {
    const need = sw + 5 + textWidth(name, fs);
    if (lx + need > w) break;
    parts.push(el("rect", { x: lx, y: yy - sw + 1, width: sw, height: sw - 1, rx: 2, fill, "fill-opacity": op }));
    parts.push(text(lx + sw + 5, yy, name, { "font-size": fs, fill: C.ink2 }));
    lx += need + 14;
  }
  yy += 8;
  const rowH = narrow ? 12 : 11;
  for (let k = 0; k <= T; k++) {
    const ry = yy + k * (rowH + 3);
    parts.push(text(left - 6, ry + rowH - 2, k === 0 ? L.rowNow : tpl(L.rowYr, { k }), { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(el("rect", { x: left, y: ry, width: right - left, height: rowH, fill: C.c1, "fill-opacity": 0.3 }));
    for (const [a, b] of cheaper(p, m, m.priceAt(k), vmaxM)) {
      parts.push(el("rect", { x: x(a), y: ry, width: Math.max(0.8, x(b) - x(a)), height: rowH, fill: C.c2, "fill-opacity": 0.9 }));
    }
  }
  const stripBottom = yy + (T + 1) * (rowH + 3) - 3;
  if (V <= vmaxM) parts.push(el("line", { x1: X(V), x2: X(V), y1: yy - 2, y2: stripBottom + 2, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
  yy = stripBottom + 22;

  // ---- readout: the equations' terms. A "|" in a label marks where a line
  // may break, so an equation wraps between its terms rather than inside one.
  const out: string[] = [];
  const line = (s: string, cls = "", size: number = fb, indent = 0) => {
    const room = w - indent;
    const lines: string[] = [];
    let cur = "";
    for (const seg of s.split("|")) {
      if (cur && textWidth(cur + seg, size) > room) { lines.push(cur); cur = seg.trimStart(); } else cur += seg;
    }
    if (cur) lines.push(cur);
    for (const ln of lines) for (const sub of wrapCJK(ln, size, room)) {
      out.push(text(indent, yy, sub, { "font-size": size, class: cls || undefined }));
      yy += size + 4;
    }
  };
  const cStr = usdP(m.c);
  line(tpl(L.costHead, { a: p.perReplica, n: p.minReplicas }), "fig-t-strong");
  line(tpl(p.marginal > 0 ? L.costM : L.cost, { r: usdP(p.accel), u: `${sig(p.util, 3)}%`, tau: int(p.tput), c: cStr, m: usdP(p.marginal) }), "fig-t-num");
  yy += 8;
  line(L.head, "fig-t-strong");
  const endpoint = (when: string, k: number, c: Crossing, hl = "") => {
    const price = m.priceAt(k);
    const vs = m.F > 0 && price > m.c ? m.F / (price - m.c) : null;
    line(vs == null
      ? tpl(L.shortcutNone, { when, hl, p: usdP(price) })
      : tpl(L.shortcut, { when, hl, p: usdP(price), F: usd(m.F), c: cStr, v: tok(vs) }), "fig-t-num");
    const what = c.first == null ? L.stepNone
      : c.steady != null && c.steady > c.first * 1.001 ? tpl(L.stepAlt, { v: tok(c.first), k: c.replicas, s: tok(c.steady) })
      : tpl(L.stepAt, { v: tok(c.first), k: c.replicas });
    line(tpl(L.steps, { what }), "fig-t-muted fig-t-num", fb, 12);
    yy += 4;
  };
  endpoint(L.whenNow, 0, c0);
  endpoint(tpl(L.whenEnd, { T }), T, cT, p.decline > 0 ? tpl(L.halfLife, { h: sig(Math.LN2 / -Math.log(1 - p.decline / 100), 3) }) : "");
  yy += 6;
  line(tpl(L.totals, { T, r: sig(p.discount, 3), f0: usd(p.setup) }), "fig-t-strong");
  const blg = legend([{ label: L.api, swatch: { kind: "rect", fill: C.c1 } }, { label: L.self, swatch: { kind: "rect", fill: C.c2 } }], 0, yy - fs + 2, w, fs);
  out.push(blg.svg);
  yy += blg.height - 2;

  // Paired bars: API and self-host discounted totals per demand scenario.
  const scen = [V / p.spread, V, V * p.spread].map((v) => totals(p, m, v));
  const exp = { buy: 0, self: 0 };
  scen.forEach((t, i) => { exp.buy += WEIGHTS[i] * t.buy; exp.self += WEIGHTS[i] * t.self; });
  const rows = [
    { name: tpl(L.low, { v: tok(V / p.spread) }), t: scen[0] },
    { name: tpl(L.base, { v: tok(V) }), t: scen[1] },
    { name: tpl(L.high, { v: tok(V * p.spread) }), t: scen[2] },
    { name: L.expected, t: exp },
  ];
  const nameW = narrow ? 0 : Math.max(...rows.map((r) => textWidth(r.name, fb))) + 24;
  const valW = textWidth("$0000k", fb) + 8;
  const barX = nameW, barW = Math.max(40, w - nameW - valW);
  const vmaxT = Math.max(...rows.flatMap((r) => [r.t.buy, r.t.self]));
  for (const r of rows) {
    if (narrow) { out.push(text(0, yy + fb - 2, r.name, { "font-size": fb })); yy += fb + 4; }
    else out.push(text(0, yy + 15, r.name, { "font-size": fb }));
    const cheaperSelf = r.t.self < r.t.buy;
    for (const [v, fill, win] of [[r.t.buy, C.c1, !cheaperSelf], [r.t.self, C.c2, cheaperSelf]] as const) {
      out.push(el("rect", { x: barX, y: yy, width: barW, height: 9, rx: 2, fill: C.panel }));
      out.push(el("rect", { x: barX, y: yy, width: Math.max(2, (v / vmaxT) * barW), height: 9, rx: 2, fill }));
      out.push(text(w, yy + 9, usd(v), { "font-size": fs, "text-anchor": "end", class: win ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
      yy += 12;
    }
    yy += 7;
  }
  parts.push(g({ class: "fig-readout" }, ...out));
  return svg(w, yy, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "build-or-buy",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    demand: {
      kind: "range", scale: "log", label: { en: "Base demand", zh: "基准需求" }, unit: { en: "B tokens/month", zh: "B 词元/月" },
      min: 0.5, max: 100, default: 12,
    },
    price: {
      kind: "range", scale: "log", label: { en: "API price now", zh: "当前 API 价格" }, unit: { en: "USD per M tokens", zh: "美元/百万词元" },
      min: 0.1, max: 20, default: 2,
    },
    decline: {
      kind: "range", label: { en: "API price decline", zh: "API 价格年降幅" }, unit: { en: "% per year", zh: "%/年" },
      min: 0, max: 60, step: 1, default: 20,
      // Half-lives of listed prices by model tier [@du2026tiered]: δ = 1 − 2^(−1/h).
      marks: [
        { value: 36, label: { en: "mid tier, half-life 1.55 yr", zh: "中档，半衰期 1.55 年" } },
        { value: 47, label: { en: "economy tier, half-life 1.10 yr", zh: "经济档，半衰期 1.10 年" } },
      ],
    },
    accel: {
      kind: "range", scale: "log", label: { en: "Accelerator price r_eff", zh: "加速器价格 r_eff" }, unit: { en: "USD per hour", zh: "美元/小时" },
      min: 0.5, max: 10, default: 3,
    },
    util: {
      kind: "range", label: { en: "Planned utilization u", zh: "计划利用率 u" }, unit: { en: "%", zh: "%" },
      min: 10, max: 100, step: 1, default: 50,
    },
    fixed: {
      kind: "range", label: { en: "Fixed self-host cost F_s", zh: "自托管固定成本 F_s" }, unit: { en: "USD per month", zh: "美元/月" },
      min: 0, max: 60000, step: 500, default: 12000,
    },
    horizon: {
      kind: "choice", label: { en: "Planning horizon", zh: "规划期" }, default: 3,
      options: [
        { value: 1, label: { en: "1 yr", zh: "1 年" } },
        { value: 2, label: { en: "2 yr", zh: "2 年" } },
        { value: 3, label: { en: "3 yr", zh: "3 年" } },
        { value: 5, label: { en: "5 yr", zh: "5 年" } },
      ],
    },
    tput: {
      kind: "range", label: { en: "Throughput per accelerator at full load τ", zh: "单个加速器满载吞吐 τ" }, unit: { en: "tokens/s", zh: "词元/秒" },
      min: 100, max: 50000, step: 100, default: 3800, control: false,
    },
    perReplica: { kind: "range", label: { en: "Accelerators per replica", zh: "每个副本的加速器数" }, min: 1, max: 16, step: 1, default: 1, control: false },
    minReplicas: { kind: "range", label: { en: "Minimum replicas", zh: "最少副本数" }, min: 1, max: 8, step: 1, default: 2, control: false },
    setup: { kind: "range", label: { en: "Initial self-host cost F₀", zh: "自托管初始成本 F₀" }, min: 0, max: 5000000, step: 1000, default: 60000, control: false },
    discount: { kind: "range", label: { en: "Discount rate", zh: "折现率" }, unit: { en: "% per year", zh: "%/年" }, min: 0, max: 30, step: 0.5, default: 8, control: false },
    marginal: { kind: "range", label: { en: "Self-host marginal cost c_m", zh: "自托管边际成本 c_m" }, min: 0, max: 5, step: 0.01, default: 0, control: false },
    buyFixed: { kind: "range", label: { en: "API fixed cost F_b", zh: "API 固定成本 F_b" }, min: 0, max: 1000000, step: 100, default: 0, control: false },
    spread: { kind: "range", label: { en: "Demand range factor", zh: "需求区间倍数" }, min: 1, max: 4, step: 0.1, default: 1.5, control: false },
    vmax: { kind: "range", label: { en: "Demand axis maximum", zh: "需求轴上限" }, min: 1, max: 1000, step: 1, default: 30, control: false },
    ymax: { kind: "range", label: { en: "Cost axis maximum", zh: "成本轴上限" }, min: 1000, max: 10000000, step: 1000, default: 40000, control: false },
  },
  render,
  describe,
});
