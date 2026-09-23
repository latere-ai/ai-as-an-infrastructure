// KV state as an admission constraint: how many requests of one context
// length a single accelerator can hold, from the chapter's two equations
//
//   m_i = 2 L n_kv d_head b_kv T_i
//   M_used = M_weights + M_KV + M_workspace + M_reserve <= M_device
//
// The model is the 8B shape used across this chapter's figures (Llama 3.1 8B:
// L = 32, d_head = 128, 8 KV heads, 8.03e9 parameters, BF16 weights; see
// serving-lifecycle.ts). The KV-head choice redraws the same shape as
// multi-head (32 KV heads, one per query head), grouped-query (8), or
// multi-query (1) attention. The device is the H100 SXM datasheet capacity,
// 80 GB. Workspace and reserve are one illustrative term, 10 percent of the
// device. Every request is assumed to hold T tokens, and no prefix is shared.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { wrap } from "./lib/labels.ts";
import { si, sig, tpl } from "./lib/format.ts";
import { MODEL, WEIGHT_BYTES, H100 } from "./serving-lifecycle.ts";

const RESERVE = 0.1 * H100.memory;
const BUDGET = H100.memory - WEIGHT_BYTES - RESERVE; // bytes available for KV state
const HEADS = [32, 8, 1] as const;
const CONTEXTS = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

type P = { context: number; kvHeads: 32 | 8 | 1; bytes: 2 | 1 };

function perRequest(kvHeads: number, bytes: number, T: number): number {
  return 2 * MODEL.layers * kvHeads * MODEL.dHead * bytes * T;
}

function model(p: P) {
  const m = perRequest(p.kvHeads, p.bytes, p.context);
  const fit = Math.max(0, Math.floor(BUDGET / m));
  const kv = fit * m;
  const free = BUDGET - kv;
  const perToken = perRequest(p.kvHeads, p.bytes, 1);
  return {
    m, fit, kv, free, perToken,
    crossWeights: WEIGHT_BYTES / perToken, // T at which one request's cache equals the weights
    crossBudget: BUDGET / perToken, // T at which one request fills the KV budget
  };
}

const gb = (v: number) => (v >= 10e9 ? (v / 1e9).toFixed(1) : v >= 1e9 ? (v / 1e9).toFixed(2) : sig(v / 1e9, 2));
const tokens = (v: number) => Math.round(v).toLocaleString("en-US");

const labels = {
  en: {
    title: "KV state as an admission constraint",
    device: "H100 SXM, 80 GB of device memory",
    weights: "weights, 8B parameters in BF16",
    reserve: "workspace and reserve",
    kv: "KV state, {n:request/requests} × {m} GB",
    free: "free",
    reject: "the next request needs {m} GB and {f} GB is free, so it waits or is rejected",
    rejectNone: "one request needs {m} GB, more than the {b} GB left for KV state, so none can be admitted",
    fit: "{n:request/requests} of {t} tokens fit",
    chart: "KV bytes of one request against its context length",
    x: "context length T (tokens)",
    y: "bytes per request",
    lineW: "weights {v} GB",
    lineB: "KV budget {v} GB",
    mha: "MHA, n_kv = 32",
    gqa: "GQA, n_kv = 8",
    mqa: "MQA, n_kv = 1",
    eqM: "m = 2 · L · n_kv · d_head · b_kv · T = 2 · 32 · {h} · 128 · {b} · {t} = {v} GB",
    eqU: "M_used = {w} + {n} × {m} + {r} = {u} GB ≤ 80 GB",
    cross: "one request's cache equals the weights at T = {a} tokens and fills the KV budget alone at T = {c}",
    describe: "With {h} KV heads, {b}-byte cache elements, and {t}-token requests, each request needs {m} GB of KV state, so {n} fit beside {w} GB of weights and {r} GB of workspace and reserve on an 80 GB H100.",
  },
  zh: {
    title: "KV 状态让内存成为接纳约束",
    device: "H100 SXM，80 GB 设备内存",
    weights: "权重，8B 参数，BF16",
    reserve: "工作区与预留",
    kv: "KV 状态，{n} 个请求 × {m} GB",
    free: "空闲",
    reject: "下一个请求需要 {m} GB，只剩 {f} GB 空闲，只能排队或被拒绝",
    rejectNone: "一个请求就需要 {m} GB，超过留给 KV 状态的 {b} GB，一个也接纳不了",
    fit: "能容纳 {n} 个 {t} 词元的请求",
    chart: "单个请求的 KV 字节数与上下文长度",
    x: "上下文长度 T（词元）",
    y: "每个请求的字节数",
    lineW: "权重 {v} GB",
    lineB: "KV 预算 {v} GB",
    mha: "MHA，n_kv = 32",
    gqa: "GQA，n_kv = 8",
    mqa: "MQA，n_kv = 1",
    eqM: "m = 2 · L · n_kv · d_head · b_kv · T = 2 · 32 · {h} · 128 · {b} · {t} = {v} GB",
    eqU: "M_used = {w} + {n} × {m} + {r} = {u} GB ≤ 80 GB",
    cross: "上下文达到 {a} 个词元时，单个请求的缓存与权重一样大；达到 {c} 个词元时，一个请求就占满 KV 预算",
    describe: "KV 头数为 {h}、每个缓存元素 {b} 字节、每个请求 {t} 个词元时，每个请求需要 {m} GB 的 KV 状态；80 GB 的 H100 放下 {w} GB 权重和 {r} GB 工作区与预留之后，能容纳 {n} 个请求。",
  },
};

type L = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const k = model(p);
  return tpl(L.describe, { h: p.kvHeads, b: p.bytes, t: tokens(p.context), m: gb(k.m), n: k.fit, w: gb(WEIGHT_BYTES), r: gb(RESERVE) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const k = model(p);
  const tick = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-res`, C.ink3, 4, 1))];

  // ---- the device bar
  parts.push(text(0, 14, L.device, { "font-size": TYPE.title, class: "fig-t-strong" }));
  const barY = 40, barH = narrow ? 30 : 36;
  // The bar ends short of the column so the next request can be drawn
  // crossing the end of memory.
  const barW = w - (narrow ? 40 : 56);
  const bx = (bytes: number) => (bytes / H100.memory) * barW;
  let at = 0;
  const seg = (bytes: number, attrs: Record<string, string | number>) => {
    const x0 = bx(at), x1 = bx(at + bytes);
    at += bytes;
    return el("rect", { x: x0, y: barY, width: Math.max(0, x1 - x0), height: barH, ...attrs });
  };
  parts.push(el("rect", { x: 0, y: barY, width: barW, height: barH, rx: 3, fill: C.panel }));
  parts.push(seg(WEIGHT_BYTES, { fill: C.c2 }));
  parts.push(seg(RESERVE, { fill: `url(#${st.uid}-res)` }));
  const kv0 = at;
  const slabW = bx(k.m);
  if (k.fit > 0) {
    parts.push(el("rect", { x: bx(kv0), y: barY, width: bx(k.kv), height: barH, fill: C.c1, "fill-opacity": 0.85 }));
    // One slab per request while they are wide enough to tell apart.
    if (slabW >= 3) for (let i = 1; i < k.fit; i++) parts.push(el("line", { x1: bx(kv0) + i * slabW, x2: bx(kv0) + i * slabW, y1: barY, y2: barY + barH, stroke: C.paper, "stroke-width": slabW >= 8 ? 1.5 : 0.8 }));
  }
  parts.push(el("rect", { x: 0.5, y: barY + 0.5, width: barW - 1, height: barH - 1, rx: 3, fill: "none", stroke: C.rule, "stroke-width": 1 }));
  // The end of device memory, and the next request placed where it would go:
  // it starts in the free space and runs past the end.
  parts.push(el("line", { x1: barW, x2: barW, y1: barY - 12, y2: barY + barH + 22, stroke: C.ink, "stroke-width": 1.5 }));
  parts.push(text(barW, barY - 16, "80 GB", { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  const nextY = barY + barH + 6;
  const nx0 = bx(kv0 + k.kv);
  const nx1 = Math.min(w - 2, nx0 + slabW);
  parts.push(el("rect", { x: nx0 + 0.75, y: nextY, width: Math.max(2, nx1 - nx0 - 1.5), height: 14, rx: 2, fill: C.bad, "fill-opacity": 0.12, stroke: C.bad, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
  if (nx0 + slabW > w - 2) parts.push(el("path", { d: `M${w - 8},${nextY + 1}l6,6l-6,6`, fill: "none", stroke: C.bad, "stroke-width": 1.5 }));
  let y = nextY + 14 + 22;
  const rej = k.fit > 0 ? tpl(L.reject, { m: gb(k.m), f: gb(k.free) }) : tpl(L.rejectNone, { m: gb(k.m), b: gb(BUDGET) });
  for (const ln of wrap(rej, TYPE.body, w)) { parts.push(text(0, y, ln, { "font-size": TYPE.body })); y += 16; }
  y += 6;

  // Key with values, one row each.
  const rows: Array<[string, string, Record<string, string | number>]> = [
    [L.weights, `${gb(WEIGHT_BYTES)} GB`, { fill: C.c2 }],
    [L.reserve, `${gb(RESERVE)} GB`, { fill: `url(#${st.uid}-res)` }],
    [tpl(L.kv, { n: k.fit, m: gb(k.m) }), `${gb(k.kv)} GB`, { fill: C.c1, "fill-opacity": 0.85 }],
    [L.free, `${gb(k.free)} GB`, { fill: C.panel, stroke: C.rule, "stroke-width": 1 }],
  ];
  for (const [name, val, attrs] of rows) {
    parts.push(el("rect", { x: 0, y: y - 10, width: 12, height: 12, rx: 2, ...attrs }));
    parts.push(text(20, y, name, { "font-size": TYPE.body }));
    parts.push(text(w, y, val, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += 19;
  }
  y += 8;
  parts.push(text(0, y + 4, tpl(L.fit, { n: k.fit, t: tokens(p.context) }), { "font-size": TYPE.title, class: "fig-t-strong" }));
  y += 28;

  // ---- per-request KV bytes against context length, log-log
  parts.push(text(0, y, L.chart, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 34;
  const left = narrow ? 50 : 56;
  const right = w - 8;
  const plotH = narrow ? 190 : 220;
  const x = log([128, 1048576], [left, right]);
  const yy = log([1e6, 1e12], [y + plotH, y]);
  parts.push(axis({ scale: x, orient: "bottom", at: y + plotH, grid: [y, y + plotH], minor: true, title: L.x, size: tick, ticks: narrow ? [1e3, 1e4, 1e5, 1e6] : undefined }));
  parts.push(axis({ scale: yy, orient: "left", at: left, grid: [left, right], minor: true, title: L.y, size: tick, format: (v) => si(v, "B").replace(/\s+/g, "") }));
  // Reference lines: the weights and the KV budget.
  for (const [v, lab, col, dash] of [[WEIGHT_BYTES, tpl(L.lineW, { v: gb(WEIGHT_BYTES) }), C.c2, ""], [BUDGET, tpl(L.lineB, { v: gb(BUDGET) }), C.ink2, "5 3"]] as const) {
    parts.push(el("line", { x1: left, x2: right, y1: yy(v), y2: yy(v), stroke: col, "stroke-width": 1.5, "stroke-dasharray": dash || undefined }));
    // The budget is the higher line: its name goes above it, the weights'
    // below. Near the left edge every sloped line is far below both.
    parts.push(text(left + 6, v === BUDGET ? yy(v) - 6 : yy(v) + 16, lab, { "font-size": TYPE.body, class: "fig-t-halo fig-t-soft" }));
  }
  // One line per KV-head count at the chosen precision, the chosen one solid.
  const names: Record<number, string> = { 32: L.mha, 8: L.gqa, 1: L.mqa };
  for (const h of HEADS) {
    const pts: Array<[number, number]> = [];
    for (const T of [128, 1048576]) pts.push([x(T), yy(perRequest(h, p.bytes, T))]);
    const on = h === p.kvHeads;
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: on ? C.c1 : C.ink3, "stroke-width": on ? 2.5 : 1.2, "stroke-dasharray": on ? undefined : "4 3" }));
    // Name along the line near its left end, where every line sits below the
    // two horizontal ones; rotated to the line's slope.
    const [x0, y0] = pts[0], [x1, y1] = pts[1];
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const lx = x(200), ly = yy(perRequest(h, p.bytes, 200)) - 5;
    parts.push(text(lx, ly, names[h], { "font-size": TYPE.body, transform: `rotate(${ang.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})`, class: on ? "fig-t-halo" : "fig-t-halo fig-t-soft" }));
  }
  // Current request.
  const cx = x(p.context), cy = yy(k.m);
  parts.push(el("line", { x1: cx, x2: cx, y1: y, y2: y + plotH, stroke: C.c1, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx, cy, r: 5.5, fill: C.c1, stroke: C.paper, "stroke-width": 2 }));
  y += plotH + axisHeight(true, tick) + 14;

  // ---- readout: the equations with this configuration's terms
  const used = WEIGHT_BYTES + k.kv + RESERVE;
  const lines = [
    tpl(L.eqM, { h: p.kvHeads, b: p.bytes, t: tokens(p.context), v: gb(k.m) }),
    tpl(L.eqU, { w: gb(WEIGHT_BYTES), n: k.fit, m: gb(k.m), r: gb(RESERVE), u: gb(used) }),
    tpl(L.cross, { a: tokens(k.crossWeights), c: tokens(k.crossBudget) }),
  ];
  const ro: string[] = [];
  lines.forEach((ln, i) => {
    for (const part of wrap(ln, TYPE.body, w)) { ro.push(text(0, y + 12, part, { "font-size": TYPE.body, class: i < 2 ? "fig-t-num" : "fig-t-muted fig-t-num" })); y += 17; }
    y += 4;
  });
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "kv-admission",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    context: {
      kind: "choice", label: { en: "Context per request (tokens)", zh: "每个请求的上下文（词元）" }, default: 32768, control: "buttons",
      options: CONTEXTS.map((v) => ({ value: v, label: { en: `${v / 1024}K`, zh: `${v / 1024}K` } })),
    },
    kvHeads: {
      kind: "choice", label: { en: "KV heads n_kv", zh: "KV 头数 n_kv" }, default: 8,
      options: [
        { value: 32, label: { en: "32 (MHA)", zh: "32（MHA）" } },
        { value: 8, label: { en: "8 (GQA)", zh: "8（GQA）" } },
        { value: 1, label: { en: "1 (MQA)", zh: "1（MQA）" } },
      ],
    },
    bytes: {
      kind: "choice", label: { en: "Cache precision b_kv", zh: "缓存精度 b_kv" }, default: 2,
      options: [
        { value: 2, label: { en: "BF16, 2 bytes", zh: "BF16，2 字节" } },
        { value: 1, label: { en: "FP8, 1 byte", zh: "FP8，1 字节" } },
      ],
    },
  },
  render,
  describe,
});
