// Peak resident memory of an on-device decoder against the memory the feature
// may use, and the batch-one decode ceiling that the same bytes set, from the
// edge chapter's planning equations:
//
//   M_weights ≳ N b_w / 8 + M_metadata,   M_metadata = N · 16 / (8 g)
//   M_KV      = 2 B L n_kv d_h S b_kv / 8,           B = 1
//   M_peak    = M_weights + M_KV + M_other ≤ M_budget
//   R_decode  ≲ BW_eff / D_token,   D_token = M_weights + M_KV(S)
//
// M_metadata counts one 16-bit scale per group of g weights and nothing else
// (GGUF's Q4_0 and Q8_0 blocks store one FP16 scale per 32 weights, 4.5 and
// 8.5 bits per weight); zero points, headers, and alignment would add to it.
// M_other lumps M_workspace + M_runtime + M_app. D_token assumes every weight
// byte and the whole cache cross memory once per generated token, which is
// the bandwidth bound, not a prediction.
//
// Defaults are illustrative planning values for a small on-device model: 3e9
// parameters at 4 bits, L = 28, n_kv = 8, d_h = 128, S = 4,096, an 8-bit
// cache, and 1.1 GB for the rest. The memory budget and effective bandwidth
// are the reader's measured values for a device tier; their defaults are
// illustrative. GB here is 1e9 bytes.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, int, sig, tpl } from "./lib/format.ts";

const GB = 1e9;
const S_MIN = 512, S_MAX = 131072;

type P = {
  params: number; // N, billions
  wbits: number; // b_w, payload bits per weight
  group: number; // g, weights per 16-bit scale
  kvbits: number; // b_kv
  context: number; // S
  budget: number; // M_budget, GB
  bw: number; // BW_eff, GB/s
  other: number; // M_workspace + M_runtime + M_app, GB
  layers: number;
  kvHeads: number;
  headDim: number;
};

function model(p: P) {
  const N = p.params * 1e9;
  const payload = (N * p.wbits) / 8;
  const meta = p.wbits >= 16 ? 0 : (N * 16) / (8 * p.group);
  const weights = payload + meta;
  const kvPerTok = (2 * p.layers * p.kvHeads * p.headDim * p.kvbits) / 8;
  const kvAt = (s: number, bits = p.kvbits) => (2 * p.layers * p.kvHeads * p.headDim * bits * s) / 8;
  const other = p.other * GB;
  const fixedBytes = weights + other;
  const peakAt = (s: number) => fixedBytes + kvAt(s);
  const budget = p.budget * GB;
  const fit = Math.floor((budget - fixedBytes) / kvPerTok); // longest S that fits, may be ≤ 0
  const rateAt = (s: number, bits = p.kvbits) => (p.bw * GB) / (weights + kvAt(s, bits));
  const kv = kvAt(p.context);
  const peak = peakAt(p.context);
  return { payload, meta, weights, kvPerTok, kvAt, other, peakAt, budget, fit, rateAt, kv, peak, fits: peak <= budget, rate: rateAt(p.context) };
}

const gb = (b: number) => fixed(b / GB, 2);
const tokens = (s: number) => (s >= 1024 && s % 1024 === 0 ? `${s / 1024}K` : s >= 10000 ? `${sig(s / 1024, 3)}K` : int(s));

const labels = {
  en: {
    title: "On-device memory budget and the decode bandwidth ceiling",
    x: "cached tokens per sequence S (log scale)",
    yMem: "peak resident memory M_peak (GB)",
    yRate: "decode ceiling BW_eff / D_token (tokens/s)",
    lgPayload: "weights N·b_w/8",
    lgMeta: "scales M_metadata",
    lgKV: "KV cache M_KV",
    lgOther: "runtime, app, workspace",
    budget: "M_budget {b} GB",
    fit: "fits to S = {s}",
    fitShort: "S ≤ {s}",
    fitNone: "weights and runtime alone exceed M_budget",
    over: "over budget",
    cur: "{b}-bit cache",
    ref: "16-bit cache",
    atS: "S = {s}",
    rW: "M_weights ≳ {n}e9 × {bw}/8 + {n}e9 × 16/{g}/8 = {p} + {m} = {w} GB",
    rW16: "M_weights ≳ {n}e9 × 16/8 = {w} GB, no scales",
    rKV: "M_KV = 2 × {L} × {h} × {d} × {s} × {kb}/8 = {kv} GB",
    rPeak: "M_peak = {w} + {kv} + {o} = {pk} GB {cmp} M_budget = {b} GB: {verdict}",
    fitsV: "fits with {h} GB to spare",
    overV: "over by {h} GB",
    rDec: "R_decode ≲ {bwe} GB/s ÷ {d} GB per token = {r} tokens/s at S = {s}",
    rFit: "Longest context within M_budget: S = {s} tokens",
    describe: "{n} billion parameters at {bw} bits, a {kb}-bit cache, and S = {s}: peak {pk} GB against a {b} GB budget, {verdict}; {fitText}. Decode is bounded by {r} tokens per second at {bwe} GB/s.",
    fitText: "the longest context that fits is {s} tokens",
  },
  zh: {
    title: "端侧内存预算与解码带宽上限",
    x: "每个序列缓存的词元数 S（对数刻度）",
    yMem: "峰值常驻内存 M_peak（GB）",
    yRate: "解码上限 BW_eff / D_token（词元/秒）",
    lgPayload: "权重 N·b_w/8",
    lgMeta: "缩放因子 M_metadata",
    lgKV: "KV 缓存 M_KV",
    lgOther: "运行时、应用、工作区",
    budget: "M_budget {b} GB",
    fit: "S ≤ {s} 时装得下",
    fitShort: "S ≤ {s}",
    fitNone: "仅权重和运行时就超出 M_budget",
    over: "超出预算",
    cur: "{b} 比特缓存",
    ref: "16 比特缓存",
    atS: "S = {s}",
    rW: "M_weights ≳ {n}e9 × {bw}/8 + {n}e9 × 16/{g}/8 = {p} + {m} = {w} GB",
    rW16: "M_weights ≳ {n}e9 × 16/8 = {w} GB，无缩放因子",
    rKV: "M_KV = 2 × {L} × {h} × {d} × {s} × {kb}/8 = {kv} GB",
    rPeak: "M_peak = {w} + {kv} + {o} = {pk} GB {cmp} M_budget = {b} GB：{verdict}",
    fitsV: "装得下，余量 {h} GB",
    overV: "超出 {h} GB",
    rDec: "R_decode ≲ {bwe} GB/s ÷ 每词元 {d} GB = {r} 词元/秒（S = {s}）",
    rFit: "M_budget 内能容纳的最长上下文：S = {s} 个词元",
    describe: "{n} 亿参数、{bw} 比特权重、{kb} 比特缓存、S = {s}：峰值 {pk} GB，预算 {b} GB，{verdict}；{fitText}。在 {bwe} GB/s 下，解码速度上限为每秒 {r} 个词元。",
    fitText: "能装下的最长上下文为 {s} 个词元",
  },
};
type L = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const verdict = m.fits ? tpl(L.fitsV, { h: gb(m.budget - m.peak) }) : tpl(L.overV, { h: gb(m.peak - m.budget) });
  return tpl(L.describe, {
    n: lang === "zh" ? sig(p.params * 10, 3) : sig(p.params, 3), bw: p.wbits, kb: p.kvbits, s: int(p.context),
    pk: gb(m.peak), b: sig(p.budget, 3), verdict,
    fitText: m.fit >= 1 ? tpl(L.fitText, { s: int(m.fit) }) : L.fitNone,
    r: sig(m.rate, 3), bwe: sig(p.bw, 3),
  });
}

// ---------------------------------------------------------------- render

const S_TICKS = [512, 2048, 8192, 32768, 131072];

function renderMemory(p: P, m: ReturnType<typeof model>, w: number, L: L, uid: string, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const left = narrow ? 36 : 44, right = 10, top = y0 + 22;
  const plotH = narrow ? 170 : 190;
  const bottom = top + plotH;
  const x = log([S_MIN, S_MAX], [left, w - right]);
  const topGB = Math.max(p.budget * 1.35, m.peak / GB * 1.15, (m.weights + m.other) / GB * 1.2);
  const step = niceStep(topGB, 4);
  const ymax = Math.ceil(topGB / step) * step;
  const y = linear([0, ymax], [bottom, top]);
  const parts: string[] = [];
  const clip = `${uid}-mem`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: w - right - left, height: plotH })), hatch(`${uid}-over`, C.bad, 5, 1)));

  // Contexts past the fit point do not fit on this device.
  const fitX = m.fit >= S_MIN ? x(Math.min(m.fit, S_MAX)) : left;
  if (m.fit < S_MAX) parts.push(el("rect", { x: fitX, y: top, width: w - right - fitX, height: plotH, fill: `url(#${uid}-over)`, opacity: 0.35 }));

  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], ticks: S_TICKS, title: L.x, size: fs, format: tokens }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], title: L.yMem, size: fs, ticks: y.ticks(4), format: (v) => sig(v, 3) }));

  // Stacked terms: constant bands, then the cache that grows with S.
  const xs: number[] = [];
  for (let i = 0; i <= 80; i++) xs.push(S_MIN * (S_MAX / S_MIN) ** (i / 80));
  const band = (lo: (s: number) => number, hi: (s: number) => number, fill: string) => {
    const upper = xs.map((s) => [x(s), y(hi(s) / GB)] as [number, number]);
    const lower = xs.map((s) => [x(s), y(lo(s) / GB)] as [number, number]).reverse();
    return el("path", { d: linePath([...upper, ...lower]) + "Z", fill, "fill-opacity": 0.85 });
  };
  const b0 = () => 0, b1 = () => m.payload, b2 = () => m.weights, b3 = () => m.weights + m.other;
  const b4 = (s: number) => m.weights + m.other + m.kvAt(s);
  parts.push(g({ "clip-path": `url(#${clip})` },
    band(b0, b1, C.c1), band(b1, b2, C.c2), band(b2, b3, C.c4), band(b3, b4, C.c3)));

  // Budget line and the fit point.
  const by = y(p.budget);
  parts.push(el("line", { x1: left, x2: w - right, y1: by, y2: by, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "6 4" }));
  const obstacles: Box[] = [...lineObstacles([[left, by], [w - right, by]], 8, 2)];
  const peakPts = xs.map((s) => [x(s), y(Math.min(ymax, b4(s) / GB))] as [number, number]);
  obstacles.push(...lineObstacles(peakPts));
  const reqs = [
    { x: left + 6, y: by, text: tpl(L.budget, { b: sig(p.budget, 3) }), size: fs, gap: 8, priority: 5, sides: ["above-right" as const, "below-right" as const], attrs: { class: "fig-t-halo" } },
  ];
  if (m.fit >= S_MIN && m.fit <= S_MAX) {
    parts.push(el("line", { x1: fitX, x2: fitX, y1: by, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
    obstacles.push({ x0: fitX - 2, y0: by, x1: fitX + 2, y1: bottom });
    parts.push(el("circle", { cx: fitX, cy: by, r: 4, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
    reqs.push({ x: fitX, y: by, text: tpl(narrow ? L.fitShort : L.fit, { s: int(m.fit) }), size: fs, gap: 8, priority: 2, sides: ["above-left", "above-right", "below-right", "below-left", "left", "right"] as never, attrs: { class: "fig-t-halo" } });
  }

  // The chosen context.
  const cx = x(p.context), cy = y(Math.min(ymax, m.peak / GB));
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink, "stroke-width": 1 }));
  parts.push(el("circle", { cx, cy, r: 5, fill: m.fits ? C.ink : C.bad, stroke: C.paper, "stroke-width": 1.5 }));
  obstacles.push({ x0: cx - 2, y0: top, x1: cx + 2, y1: bottom }, { x0: cx - 7, y0: cy - 7, x1: cx + 7, y1: cy + 7 });
  reqs.push({ x: cx, y: cy, text: `${gb(m.peak)} GB`, size: TYPE.body, gap: 9, priority: 4, sides: ["above-left", "above-right", "left", "right"] as never, attrs: { class: "fig-t-halo fig-t-num" } });
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  let yy = bottom + axisHeight(true, fs) + 2;
  const lg = legend([
    { label: L.lgPayload, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lgMeta, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lgOther, swatch: { kind: "rect", fill: C.c4 } },
    { label: L.lgKV, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.over, swatch: { kind: "rect", fill: C.bad, pattern: `${uid}-over` } },
  ], 0, yy, w, fs);
  parts.push(lg.svg);
  yy += lg.height;
  return { svg: g({ class: "fig-memory" }, ...parts), h: yy - y0 };
}

function renderRate(p: P, m: ReturnType<typeof model>, w: number, L: L, uid: string, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const left = narrow ? 36 : 44, right = 10, top = y0 + 22;
  const plotH = narrow ? 130 : 140;
  const bottom = top + plotH;
  const x = log([S_MIN, S_MAX], [left, w - right]);
  const rTop = m.rateAt(S_MIN) * 1.1;
  const step = niceStep(rTop, 4);
  const y = linear([0, Math.ceil(rTop / step) * step], [bottom, top]);
  const parts: string[] = [];
  const fitX = m.fit >= S_MIN ? x(Math.min(m.fit, S_MAX)) : left;
  if (m.fit < S_MAX) parts.push(el("rect", { x: fitX, y: top, width: w - right - fitX, height: plotH, fill: `url(#${uid}-over)`, opacity: 0.35 }));
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], ticks: S_TICKS, title: L.x, size: fs, format: tokens }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], title: L.yRate, size: fs, ticks: y.ticks(4), format: (v) => sig(v, 3) }));
  const xs: number[] = [];
  for (let i = 0; i <= 80; i++) xs.push(S_MIN * (S_MAX / S_MIN) ** (i / 80));
  const obstacles: Box[] = [];
  const reqs = [];
  if (p.kvbits < 16) {
    const ref = xs.map((s) => [x(s), y(m.rateAt(s, 16))] as [number, number]);
    parts.push(el("path", { d: linePath(ref), fill: "none", stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    obstacles.push(...lineObstacles(ref));
    const s0 = 32768;
    reqs.push({ x: x(s0), y: y(m.rateAt(s0, 16)), text: L.ref, size: fs, gap: 6, priority: 1, sides: ["below-left", "below", "below-right"] as never, attrs: { class: "fig-t-halo fig-t-soft" } });
  }
  const cur = xs.map((s) => [x(s), y(m.rateAt(s))] as [number, number]);
  parts.push(el("path", { d: linePath(cur), fill: "none", stroke: C.c3, "stroke-width": 2.2 }));
  obstacles.push(...lineObstacles(cur));
  const s1 = 1024;
  reqs.push({ x: x(s1), y: y(m.rateAt(s1)), text: tpl(L.cur, { b: p.kvbits }), size: fs, gap: 6, priority: 2, sides: ["above-right", "above", "below-left"] as never, attrs: { class: "fig-t-halo" } });
  const cx = x(p.context), cy = y(m.rate);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink, "stroke-width": 1 }));
  parts.push(el("circle", { cx, cy, r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  obstacles.push({ x0: cx - 2, y0: top, x1: cx + 2, y1: bottom }, { x0: cx - 7, y0: cy - 7, x1: cx + 7, y1: cy + 7 });
  reqs.push({ x: cx, y: cy, text: `${sig(m.rate, 3)}/s`, size: TYPE.body, gap: 9, priority: 4, sides: ["above-right", "above-left", "right", "left"] as never, attrs: { class: "fig-t-halo fig-t-num" } });
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  return { svg: g({ class: "fig-rate" }, ...parts), h: bottom + axisHeight(true, fs) - y0 };
}

function renderReadout(p: P, m: ReturnType<typeof model>, w: number, L: L, y0: number): { svg: string; h: number } {
  const fs = TYPE.body;
  const n = sig(p.params, 3);
  const lines = [
    p.wbits >= 16
      ? tpl(L.rW16, { n, w: gb(m.weights) })
      : tpl(L.rW, { n, bw: p.wbits, g: p.group, p: gb(m.payload), m: gb(m.meta), w: gb(m.weights) }),
    tpl(L.rKV, { L: p.layers, h: p.kvHeads, d: p.headDim, s: int(p.context), kb: p.kvbits, kv: gb(m.kv) }),
    tpl(L.rPeak, {
      w: gb(m.weights), kv: gb(m.kv), o: gb(m.other), pk: gb(m.peak), cmp: m.fits ? "≤" : ">", b: sig(p.budget, 3),
      verdict: m.fits ? tpl(L.fitsV, { h: gb(m.budget - m.peak) }) : tpl(L.overV, { h: gb(m.peak - m.budget) }),
    }),
    m.fit >= 1 ? tpl(L.rFit, { s: int(m.fit) }) : L.fitNone,
    tpl(L.rDec, { bwe: sig(p.bw, 3), d: gb(m.weights + m.kv), r: sig(m.rate, 3), s: int(p.context) }),
  ];
  const parts: string[] = [];
  let y = y0;
  lines.forEach((ln, i) => {
    for (const piece of wrap(ln, fs, w - fs)) {
      y += fs + 5;
      parts.push(text(0, y, piece, { "font-size": fs, class: i === 2 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    }
    y += 3;
  });
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const m = model(p);
  const mem = renderMemory(p, m, w, L, st.uid, 0);
  let y = mem.h + 12;
  const rate = renderRate(p, m, w, L, st.uid, y);
  y += rate.h + 6;
  const ro = renderReadout(p, m, w, L, y);
  y += ro.h;
  void textWidth;
  return svg(w, y, describe(st, lang), mem.svg, rate.svg, ro.svg);
}

const bitsOption = (v: number) => ({ value: v, label: { en: `${v} bits`, zh: `${v} 比特` } });

export default defineFigure({
  name: "device-memory-budget",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    params: { kind: "range", label: { en: "Parameters N", zh: "参数量 N" }, unit: { en: "billion", zh: "× 10⁹" }, min: 0.5, max: 8, step: 0.1, default: 3 },
    wbits: { kind: "choice", label: { en: "Weight bits b_w", zh: "权重位数 b_w" }, default: 4, options: [2, 3, 4, 8, 16].map(bitsOption) },
    group: {
      kind: "choice", label: { en: "Weights per 16-bit scale g", zh: "每个 16 比特缩放因子覆盖的权重数 g" }, default: 32,
      options: [16, 32, 64, 128].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    kvbits: { kind: "choice", label: { en: "Cache bits b_kv", zh: "缓存位数 b_kv" }, default: 8, options: [16, 8, 4, 2].map(bitsOption) },
    context: {
      kind: "choice", label: { en: "Cached tokens S", zh: "缓存词元数 S" }, default: 4096, control: "buttons",
      options: [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072].map((v) => ({ value: v, label: { en: tokens(v), zh: tokens(v) } })),
    },
    budget: { kind: "range", label: { en: "Memory budget M_budget", zh: "内存预算 M_budget" }, unit: { en: "GB", zh: "GB" }, min: 1, max: 16, step: 0.25, default: 4 },
    bw: { kind: "range", scale: "log", label: { en: "Effective bandwidth BW_eff", zh: "有效带宽 BW_eff" }, unit: { en: "GB/s", zh: "GB/s" }, min: 10, max: 400, default: 60 },
    other: { kind: "range", label: { en: "Runtime, app, workspace", zh: "运行时、应用、工作区" }, unit: { en: "GB", zh: "GB" }, min: 0, max: 4, step: 0.05, default: 1.1, control: false },
    layers: { kind: "range", label: { en: "Layers L", zh: "层数 L" }, min: 1, max: 128, step: 1, default: 28, control: false },
    kvHeads: { kind: "range", label: { en: "KV heads n_kv", zh: "KV 头数 n_kv" }, min: 1, max: 64, step: 1, default: 8, control: false },
    headDim: { kind: "range", label: { en: "Head dimension d_h", zh: "头维度 d_h" }, min: 32, max: 256, step: 32, default: 128, control: false },
  },
  render,
  describe,
});
