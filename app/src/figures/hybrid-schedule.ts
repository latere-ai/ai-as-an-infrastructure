// A hybrid layer schedule as two independent fields, applied to one stack of
// Jamba v0.1 layer shapes: which layers mix with attention and which with a
// Mamba recurrence, and which FFNs are expert layers. Each field moves its own
// resource: the mixer schedule sets the state one sequence keeps while it
// decodes, the FFN schedule sets stored against evaluated parameters.
//
// Shapes from ai21labs/Jamba-v0.1 config.json: 32 layers, d = 4096, 32 query
// heads over 8 KV heads of width 128, Mamba expand 2 (d_inner = 8192),
// d_state = 16, d_conv = 4, expert FFN width d_f = 14336, 16 experts, top-2;
// Jamba places attention at layer i with i mod 8 = 4 and an expert FFN where
// i mod 2 = 1. Everything is bf16 (b = 2 bytes).
//
//   KV per sequence   = n_attn · 2 · S · H_kv · d_h · b        (the KV-cache equation)
//   recurrent state   = n_rec · d_inner · (n_state + d_conv) · b (M_rec)
//   FFN stored        = n_moe · (E·P_e + E·d) + n_dense · P_e,  P_e = 3·d·d_f
//   FFN evaluated     = n_moe · (k·P_e + E·d) + n_dense · P_e
//
// The published check: Jamba's paper (Table 1) gives a 4 GB KV cache at 256K
// tokens in 16 bit for Jamba and 32\u00a0GB for Mixtral, whose attention layers
// have the same shape; the formula reproduces both (4 and 32 GiB).

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, type Box } from "./lib/labels.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { sig, tpl, compact } from "./lib/format.ts";

const LAYERS = 32, D = 4096, KV_HEADS = 8, HEAD_DIM = 128, D_INNER = 8192, D_STATE = 16, D_CONV = 4, D_FF = 14336, EXPERTS = 16, TOPK = 2, BYTES = 2;
const KV_TOKEN_LAYER = 2 * KV_HEADS * HEAD_DIM * BYTES; // 4 KiB
const REC_LAYER = D_INNER * (D_STATE + D_CONV) * BYTES; // 320 KiB
const P_E = 3 * D * D_FF;

type Ffn = "alt" | "all" | "none";
type P = { attn: number; ffn: Ffn; context: number };

const isAttn = (period: number, i: number) => period > 0 && i % period === Math.floor(period / 2);
const isMoe = (ffn: Ffn, i: number) => ffn === "all" || (ffn === "alt" && i % 2 === 1);

function counts(p: { attn: number; ffn: Ffn }) {
  let nA = 0, nM = 0;
  for (let i = 0; i < LAYERS; i++) { if (isAttn(p.attn, i)) nA++; if (isMoe(p.ffn, i)) nM++; }
  return { nA, nR: LAYERS - nA, nM, nD: LAYERS - nM };
}
const stateBytes = (period: number, S: number) => {
  const { nA, nR } = counts({ attn: period, ffn: "none" });
  return { kv: nA * KV_TOKEN_LAYER * S, rec: nR * REC_LAYER };
};

// Bytes with binary prefixes, as the KV-cache literature reports them.
function bytes(b: number): string {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let k = 0;
  while (k < u.length - 1 && b >= 1024 ** (k + 1) * 0.9995) k++;
  return `${sig(b / 1024 ** k, 3)} ${u[k]}`;
}
const params = (n: number) => `${sig(n / 1e9, 3)}B`;

const labels = {
  en: {
    title: "Layer schedule of a hybrid stack",
    strip: "32 layers with Jamba's shapes",
    mixer: "mixer",
    ffn: "FFN",
    lAttn: "attention",
    lRec: "Mamba",
    lMoe: "expert FFN, 16 experts, top-2",
    lDense: "dense FFN",
    layer: "layer {i}",
    chart: "Decode state of one sequence",
    x: "context length S (tokens)",
    now: "S = {s}",
    paperBoth: "Jamba paper, Table 1: 4\u00a0GB of KV cache at 256K tokens for Jamba, 32\u00a0GB for Mixtral (attention in every layer)",
    paperOne: "Jamba paper, Table 1: 32\u00a0GB of KV cache at 256K tokens for Mixtral (attention in every layer)",
    endAll: "attention in every layer",
    endNone: "no attention",
    rState: "At S = {s} tokens, one sequence keeps",
    rKv: "KV: {n} × 2·S·H_kv·d_h·b",
    rRec: "Mamba: {n} × d_inner·(n_state + d_conv)·b",
    rTotal: "decode state",
    rVs: "with attention in every layer",
    rFfn: "FFN weights, P_e = 3·d·d_f",
    rStored: "stored: {m} × (E·P_e + E·d) + {d} × P_e",
    rEval: "evaluated per token: {m} × (k·P_e + E·d) + {d} × P_e",
    sched1: "every layer", sched2: "1 in 2", sched4: "1 in 4", sched8: "1 in 8", sched0: "none",
    describe: "Attention in {a} of 32 layers, expert FFNs in {m}. At {s} tokens one sequence keeps {kv} of KV and {rec} of recurrent state, {t} in all; attention in every layer would keep {all}. FFN weights: {st} stored, {ev} evaluated per token.",
  },
  zh: {
    title: "混合堆叠的层级排布",
    strip: "32 层，采用 Jamba 的层形状",
    mixer: "混合器",
    ffn: "FFN",
    lAttn: "注意力",
    lRec: "Mamba",
    lMoe: "专家 FFN，16 个专家，top-2",
    lDense: "稠密 FFN",
    layer: "第 {i} 层",
    chart: "一条序列的解码状态",
    x: "上下文长度 S（词元）",
    now: "S = {s}",
    paperBoth: "Jamba 论文表 1：256K 词元时 KV 缓存，Jamba 为 4\u00a0GB，Mixtral（每层注意力）为 32\u00a0GB",
    paperOne: "Jamba 论文表 1：256K 词元时 Mixtral（每层注意力）的 KV 缓存为 32\u00a0GB",
    endAll: "每层都用注意力",
    endNone: "不用注意力",
    rState: "S = {s} 个词元时，一条序列保留的状态",
    rKv: "KV：{n} × 2·S·H_kv·d_h·b",
    rRec: "Mamba：{n} × d_inner·(n_state + d_conv)·b",
    rTotal: "解码状态合计",
    rVs: "每层都用注意力时",
    rFfn: "FFN 权重，P_e = 3·d·d_f",
    rStored: "存储：{m} × (E·P_e + E·d) + {d} × P_e",
    rEval: "每词元执行：{m} × (k·P_e + E·d) + {d} × P_e",
    sched1: "每层", sched2: "2 层 1 个", sched4: "4 层 1 个", sched8: "8 层 1 个", sched0: "不用",
    describe: "32 层中 {a} 层用注意力，{m} 层用专家 FFN。{s} 个词元时，一条序列保留 {kv} 的 KV 和 {rec} 的递归状态，合计 {t}；每层都用注意力则为 {all}。FFN 权重：存储 {st}，每词元执行 {ev}。",
  },
};
type L = typeof labels.en;

const schedName = (period: number, L: L) => L[`sched${period}` as "sched1"];

function ffnParams(ffn: Ffn) {
  const { nM, nD } = counts({ attn: 0, ffn });
  return {
    nM, nD,
    stored: nM * (EXPERTS * P_E + EXPERTS * D) + nD * P_E,
    evaluated: nM * (TOPK * P_E + EXPERTS * D) + nD * P_E,
  };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const { nA, nM } = counts(p);
  const b = stateBytes(p.attn, p.context);
  const f = ffnParams(p.ffn);
  return tpl(L.describe, {
    a: nA, m: nM, s: compact(p.context), kv: bytes(b.kv), rec: bytes(b.rec), t: bytes(b.kv + b.rec),
    all: bytes(stateBytes(1, p.context).kv), st: params(f.stored), ev: params(f.evaluated),
  });
}

function renderStrip(p: P, x0: number, y0: number, w: number, L: L, sm: number): { svg: string; h: number } {
  const parts: string[] = [];
  const narrow = w < 480;
  parts.push(text(x0, y0 + 13, L.strip, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.lAttn, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lRec, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lMoe, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.lDense, swatch: { kind: "rect", fill: C.panel, stroke: C.ink3 } },
  ], x0, y0 + 20, w, sm);
  parts.push(lg.svg);
  let y = y0 + 30 + lg.height;
  // Four blocks of eight layers: one row on a wide column, two on a phone.
  const perRow = narrow ? 16 : 32;
  const labelW = Math.max(textWidth(L.mixer, sm), textWidth(L.ffn, sm)) + 8;
  const blockGap = 8, gap = 2;
  const blocksPerRow = perRow / 8;
  const cw = (w - labelW - blockGap * (blocksPerRow - 1) - gap * (perRow - blocksPerRow)) / perRow;
  const cellH = 18;
  for (let r = 0; r < LAYERS / perRow; r++) {
    parts.push(text(x0 + labelW - 8, y + 13, L.mixer, { "font-size": sm, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(x0 + labelW - 8, y + cellH + 3 + 13, L.ffn, { "font-size": sm, "text-anchor": "end", class: "fig-t-muted" }));
    for (let c = 0; c < perRow; c++) {
      const i = r * perRow + c;
      const x = x0 + labelW + c * (cw + gap) + Math.floor(c / 8) * (blockGap - gap);
      parts.push(el("rect", { x, y, width: cw, height: cellH, rx: 2, fill: isAttn(p.attn, i) ? C.c1 : C.c2 }));
      const moe = isMoe(p.ffn, i);
      parts.push(el("rect", { x: x + (moe ? 0 : 0.5), y: y + cellH + 3 + (moe ? 0 : 0.5), width: cw - (moe ? 0 : 1), height: cellH - (moe ? 0 : 1), rx: 2, fill: moe ? C.c3 : C.panel, stroke: moe ? undefined : C.ink3, "stroke-width": moe ? undefined : 0.8 }));
      if (c % 8 === 0) parts.push(text(x, y + 2 * cellH + 3 + 15, i + 1, { "font-size": sm, class: "fig-t-faint fig-t-num" }));
    }
    y += 2 * cellH + 3 + 22;
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: y - y0 - 4 };
}

function renderChart(p: P, x0: number, y0: number, w: number, L: L, sm: number): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, L.chart, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const top = y0 + 30, ph = w < 480 ? 190 : 220;
  const left = x0 + 58, right = x0 + w - 8;
  const x = log([64, 1048576], [left, right]);
  const y = log([2 ** 20, 2 ** 38], [top + ph, top]); // 1 MiB to 256 GiB
  parts.push(axis({ scale: x, orient: "bottom", at: top + ph, grid: [top, top + ph], ticks: [100, 1000, 10000, 100000, 1000000], title: L.x, format: (v) => compact(v), size: sm }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [2 ** 20, 2 ** 24, 2 ** 27, 2 ** 30, 2 ** 34, 2 ** 37], format: (v) => bytes(v), size: sm }));
  const obstacles: Box[] = [];
  const pts = (period: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let e = 6; e <= 20 + 1e-9; e += 0.25) {
      const b = stateBytes(period, 2 ** e);
      out.push([x(2 ** e), y(b.kv + b.rec)]);
    }
    return out;
  };
  // The chosen schedule against the two ends: attention in every layer, and none.
  const reqs = [];
  const lines = [...new Set([1, 0, p.attn])];
  for (const period of lines) {
    const on = period === p.attn;
    const line = pts(period);
    parts.push(el("path", { d: linePath(line), fill: "none", stroke: on ? C.ink : C.ink3, "stroke-width": on ? 2.2 : 1.2, "stroke-dasharray": on ? undefined : "4 3" }));
    obstacles.push(...lineObstacles(line));
    // Anchors spread along x so the three names never compete for one spot:
    // the every-layer line early (it is highest), the flat line late, the chosen
    // schedule in between, each on the side away from the others.
    const frac = period === 1 ? 0.6 : period === 0 ? 0.62 : 0.45;
    const at = line[Math.round((line.length - 1) * frac)];
    const sides = period === 1 ? ["above-left" as const, "left" as const]
      : period === 0 ? ["below" as const, "below-right" as const, "below-left" as const]
        : ["below-right" as const, "right" as const, "below" as const];
    reqs.push({ x: at[0], y: at[1], text: period === 1 ? L.endAll : period === 0 ? L.endNone : schedName(period, L), size: sm, sides, gap: 6, priority: on ? 3 : 1, attrs: { class: on ? "fig-t-halo" : "fig-t-halo fig-t-soft" } });
  }
  // Cursor at the chosen context.
  const cx = x(p.context);
  const b = stateBytes(p.attn, p.context);
  const cy = y(b.kv + b.rec);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: top + ph, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx, cy, r: 4.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  obstacles.push({ x0: cx - 8, y0: cy - 8, x1: cx + 8, y1: cy + 8 });
  reqs.push({ x: cx, y: cy, text: bytes(b.kv + b.rec), size: TYPE.body, sides: ["above-left" as const, "left" as const, "below-right" as const, "right" as const], gap: 9, priority: 4, attrs: { class: "fig-t-halo fig-t-num" } });
  // Published values at 256K tokens (Jamba paper, Table 1), as rings on the
  // lines they check; the note under the chart names them.
  for (const period of [8, 1]) {
    if (!lines.includes(period)) continue;
    const b0 = stateBytes(period, 262144);
    const px = x(262144), py = y(b0.kv + b0.rec);
    parts.push(el("circle", { cx: px, cy: py, r: 7, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
    obstacles.push({ x0: px - 8, y0: py - 8, x1: px + 8, y1: py + 8 });
  }
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: right, y1: top + ph - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  let ny = top + ph + axisHeight(true, sm) + 12;
  const note = lines.includes(8) ? L.paperBoth : L.paperOne;
  parts.push(el("circle", { cx: x0 + 6, cy: ny - 4, r: 5, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
  for (const ln of wrap(note, sm, w - 18)) { parts.push(text(x0 + 18, ny, ln, { "font-size": sm, class: "fig-t-muted" })); ny += 15; }
  return { svg: g({ class: "fig-chart" }, ...parts), h: ny - y0 - 8 };
}

function renderReadout(p: P, x0: number, y0: number, w: number, L: L, sm: number): { svg: string; h: number } {
  const parts: string[] = [];
  const { nA, nR } = counts(p);
  const b = stateBytes(p.attn, p.context);
  const f = ffnParams(p.ffn);
  let y = y0;
  const block = (title: string, rows: Array<[string, string, boolean?]>) => {
    parts.push(text(x0, y + 13, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 22;
    for (const [name, v, strong] of rows) {
      parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
      const vw = textWidth(v, TYPE.body);
      const ls = wrap(name, TYPE.body, w - vw - 12);
      ls.forEach((ln, j) => parts.push(text(x0, y + 14 + j * 15, ln, { "font-size": TYPE.body, class: strong ? "fig-t-strong" : "fig-t-num" })));
      parts.push(text(x0 + w, y + 14, v, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
      y += 4 + ls.length * 15;
    }
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  };
  block(tpl(L.rState, { s: p.context.toLocaleString("en-US") }), [
    [tpl(L.rKv, { n: nA }), bytes(b.kv)],
    [tpl(L.rRec, { n: nR }), bytes(b.rec)],
    [L.rTotal, bytes(b.kv + b.rec), true],
    [L.rVs, bytes(stateBytes(1, p.context).kv)],
  ]);
  y += 14;
  block(L.rFfn, [
    [tpl(L.rStored, { m: f.nM, d: f.nD }), params(f.stored)],
    [tpl(L.rEval, { m: f.nM, d: f.nD }), params(f.evaluated)],
  ]);
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const sm = narrow ? TYPE.body : TYPE.small; // small text, 12 px on a phone column
  const strip = renderStrip(p, 0, 0, w, L, sm);
  let y = strip.h + 18;
  const parts = [strip.svg];
  if (narrow) {
    const ch = renderChart(p, 0, y, w, L, sm);
    parts.push(ch.svg); y += ch.h + 18;
    const ro = renderReadout(p, 0, y, w, L, sm);
    parts.push(ro.svg); y += ro.h;
  } else {
    const lw = Math.floor(w * 0.5);
    const ch = renderChart(p, 0, y, lw, L, sm);
    const ro = renderReadout(p, lw + 24, y, w - lw - 24, L, sm);
    parts.push(ch.svg, ro.svg);
    y += Math.max(ch.h, ro.h);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "hybrid-schedule",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    attn: {
      kind: "choice", label: { en: "Attention layers", zh: "注意力层" }, default: 8,
      options: [
        { value: 1, label: { en: "Every layer", zh: "每层" } },
        { value: 2, label: { en: "1 in 2", zh: "2 层 1 个" } },
        { value: 4, label: { en: "1 in 4", zh: "4 层 1 个" } },
        { value: 8, label: { en: "1 in 8 (Jamba)", zh: "8 层 1 个（Jamba）" } },
        { value: 0, label: { en: "None", zh: "不用" } },
      ],
      control: "buttons",
    },
    ffn: {
      kind: "choice", label: { en: "Expert FFNs", zh: "专家 FFN" }, default: "alt",
      options: [
        { value: "all", label: { en: "Every layer", zh: "每层" } },
        { value: "alt", label: { en: "Every other layer (Jamba)", zh: "隔层（Jamba）" } },
        { value: "none", label: { en: "None, all dense", zh: "不用，全部稠密" } },
      ],
    },
    context: {
      kind: "range", scale: "log", label: { en: "Context length", zh: "上下文长度" }, unit: { en: "tokens", zh: "个词元" }, min: 64, max: 1048576, default: 262144,
      marks: [{ value: 262144, label: { en: "256K, Jamba's context", zh: "256K，Jamba 的上下文" } }],
    },
  },
  render,
  describe,
});
