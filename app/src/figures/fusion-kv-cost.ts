// The KV cost of the two media-input fusion contracts, drawn as the cache
// itself: layers by positions, so that area is bytes.
//
// Decoder-only fusion inserts every media feature into the language-model
// sequence, so its self-attention cache holds, from the chapter,
//
//   N_in = n_text + n_special + Σ_i n_i,   M_KV = 2 L N_in n_kv d_h b_kv.
//
// Cross-attention fusion keeps text as the self-attention sequence (all L
// layers) and stores media keys and values only at the L_x layers that hold
// cross-attention:
//
//   M = 2 L n_text n_kv d_h b_kv + 2 L_x (Σ_i n_i) n_kv d_h b_kv.
//
// The media term assumes the cross-attention layers use the same KV-head
// count and width as self-attention and are spaced evenly through the stack.
// The model shape is the chapter's running example (L = 32, n_kv = 8,
// d_h = 128, b_kv = 2 bytes); n_special = 0. Features per image follow the
// chapter's examples: a fixed 14-pixel patch grid at 336 or 672 pixels, a
// 2 × 2 merge of the 672-pixel grid, and a 64-query resampler. The decode
// read time is the bandwidth bound bytes / B at the H100 SXM datasheet
// bandwidth used by roofline.ts, 3.35 TB/s.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, si, sig, tpl } from "./lib/format.ts";

const L_LAYERS = 32;
const N_KV = 8;
const D_H = 128;
const B_KV = 2;
const PER_POS_LAYER = 2 * N_KV * D_H * B_KV; // bytes of K and V for one position in one layer
const HBM = 3.35e12; // H100 SXM, bytes per second
const PATCH = 14;

type Policy = "grid336" | "grid672" | "merge672" | "resampler";
const POLICY: Record<Policy, { n: number; side: number; merge: number }> = {
  grid336: { n: 576, side: 336, merge: 1 },
  grid672: { n: 2304, side: 672, merge: 1 },
  merge672: { n: 576, side: 672, merge: 4 },
  resampler: { n: 64, side: 0, merge: 0 },
};

const labels = {
  en: {
    title: "KV cache of decoder-only and cross-attention fusion",
    grid: "{s} × {s} px in {p}-px patches: ⌈{s}/{p}⌉ × ⌈{s}/{p}⌉ = {g} × {g} = {n} features per image",
    merge: "{s} × {s} px in {p}-px patches: {g} × {g} = {raw} patches, 2 × 2 merge: {n} features per image",
    resampler: "a resampler maps any encoder grid to {n} features per image",
    nin: "N_in = n_text + q·n_i = {t} + {q} × {n} = {N} positions",
    media: "media positions",
    textPos: "text positions",
    none: "layer without media state",
    dTitle: "Decoder-only fusion: one self-attention cache",
    xTitle: "Cross-attention fusion: text cache plus media memory at {lx} of {l} layers",
    rows: "Rows are the 32 layers, first at the bottom; width is positions, on one scale for both caches.",
    pos: "positions (tokens)",
    memory: "media memory",
    textCache: "text",
    dEq: "M_KV = 2 · {l} · {N} · {kv} · {dh} · {b} B = {m}",
    xEqText: "text: 2 · {l} · {t} · {kv} · {dh} · {b} B = {m}",
    xEqMedia: "media: 2 · {lx} · {qn} · {kv} · {dh} · {b} B = {m}",
    xEqTotal: "total {m}",
    bars: "KV per request",
    decoderOnly: "decoder-only",
    cross: "cross-attention",
    ratio: "Decoder-only holds {r}× the KV of cross-attention for this request.",
    equal: "With cross-attention at every layer the two contracts hold the same KV.",
    read: "Every decode step reads this state: at 3.35 TB/s (H100 SXM) that takes at least {a} per step for decoder-only and {b} for cross-attention.",
    describe: "{q:image/images} of {n} features and {t} text tokens: decoder-only fusion caches {N} positions at all {l} layers, {m1}; cross-attention fusion caches the text at all layers and the media at {lx} layers, {m2}.",
  },
  zh: {
    title: "仅解码器融合与交叉注意力融合的 KV 缓存",
    grid: "{s} × {s} 像素，{p} 像素图块：⌈{s}/{p}⌉ × ⌈{s}/{p}⌉ = {g} × {g} = 每张图 {n} 个特征",
    merge: "{s} × {s} 像素，{p} 像素图块：{g} × {g} = {raw} 个图块，2 × 2 合并后每张图 {n} 个特征",
    resampler: "重采样器把任意编码器网格映射为每张图 {n} 个特征",
    nin: "N_in = n_text + q·n_i = {t} + {q} × {n} = {N} 个位置",
    media: "媒体位置",
    textPos: "文本位置",
    none: "该层不存媒体状态",
    dTitle: "仅解码器融合：一份自注意力缓存",
    xTitle: "交叉注意力融合：文本缓存加上 {l} 层中 {lx} 层的媒体内存",
    rows: "每一行是一层，共 32 层，第 1 层在最下方；宽度是位置数，两份缓存用同一比例。",
    pos: "位置（词元）",
    memory: "媒体内存",
    textCache: "文本",
    dEq: "M_KV = 2 · {l} · {N} · {kv} · {dh} · {b} B = {m}",
    xEqText: "文本：2 · {l} · {t} · {kv} · {dh} · {b} B = {m}",
    xEqMedia: "媒体：2 · {lx} · {qn} · {kv} · {dh} · {b} B = {m}",
    xEqTotal: "合计 {m}",
    bars: "每个请求的 KV",
    decoderOnly: "仅解码器",
    cross: "交叉注意力",
    ratio: "这个请求在仅解码器融合下的 KV 是交叉注意力融合的 {r} 倍。",
    equal: "交叉注意力放在每一层时，两种契约的 KV 相同。",
    read: "每个解码步都要读取这些状态：在 3.35 TB/s（H100 SXM）下，仅解码器融合每步至少需要 {a}，交叉注意力融合至少需要 {b}。",
    describe: "{q} 张图、每张 {n} 个特征，加 {t} 个文本词元：仅解码器融合在全部 {l} 层缓存 {N} 个位置，共 {m1}；交叉注意力融合在全部层缓存文本，只在 {lx} 层缓存媒体，共 {m2}。",
  },
};
type Labels = typeof labels.en;

type P = { media: Policy; images: number; text: number; xlayers: number };

function mib(bytes: number): string {
  const m = bytes / 2 ** 20;
  return `${m >= 100 ? int(m) : fixed(m, 1)} MiB`;
}

function model(p: P) {
  const n = POLICY[p.media].n;
  const qn = p.images * n;
  const N = p.text + qn;
  const dec = { text: L_LAYERS * p.text * PER_POS_LAYER, media: L_LAYERS * qn * PER_POS_LAYER };
  const xat = { text: L_LAYERS * p.text * PER_POS_LAYER, media: p.xlayers * qn * PER_POS_LAYER };
  return { n, qn, N, dec, xat, decTotal: dec.text + dec.media, xatTotal: xat.text + xat.media };
}

// Layers (0-based) that hold cross-attention: L_x of them, evenly spaced, the
// last one at the top of the stack (every fourth layer for L_x = 8).
function crossLayers(lx: number): Set<number> {
  const out = new Set<number>();
  for (let j = 0; j < lx; j++) out.add(Math.round(((j + 1) * L_LAYERS) / lx) - 1);
  return out;
}

function policyLine(p: P, L: Labels): string {
  const pol = POLICY[p.media];
  if (p.media === "resampler") return tpl(L.resampler, { n: pol.n });
  const g0 = Math.ceil(pol.side / PATCH);
  if (pol.merge > 1) return tpl(L.merge, { s: pol.side, p: PATCH, g: g0, raw: int(g0 * g0), n: int(pol.n) });
  return tpl(L.grid, { s: pol.side, p: PATCH, g: g0, n: int(pol.n) });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, { q: p.images, n: int(m.n), t: int(p.text), N: int(m.N), l: L_LAYERS, m1: mib(m.decTotal), lx: p.xlayers, m2: mib(m.xatTotal) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const wr = (s: string, width: number, size: number = fs) => (lang === "zh" ? wrapCjk(s, size, width) : wrap(s, size, width));
  const m = model(p);
  const parts: string[] = [];
  let y = 0;
  const lines = (s: string, cls?: string, size = fs) => {
    for (const ln of wr(s, w, size)) { y += size + 4; parts.push(text(0, y, ln, { "font-size": size, class: cls })); }
  };

  // ---- media policy and sequence length
  lines(policyLine(p, L), "fig-t-muted");
  lines(tpl(L.nin, { t: int(p.text), q: p.images, n: int(m.n), N: int(m.N) }), "fig-t-num");
  y += 8;
  const lg = legend([
    { label: L.media, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.textPos, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.none, swatch: { kind: "rect", fill: C.panel } },
  ], 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height - 4;
  lines(L.rows, "fig-t-muted");
  y += 8;

  // ---- the two caches, layers by positions, on one scale
  const gut = 34;
  const x = linear([0, Math.max(1, m.N)], [gut, w - 2]);
  const pitch = narrow ? 4 : 5;
  const rowH = pitch - 1;
  const gridH = L_LAYERS * pitch;
  const xl = crossLayers(p.xlayers);
  const xMedia0 = x(0), xMedia1 = x(m.qn), xText1 = x(m.N);
  const panel = (title: string, mediaRows: (layer: number) => boolean, split: boolean) => {
    for (const ln of wr(title, w, TYPE.label)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
    y += 8;
    // Block labels when the block is wide enough to hold them.
    if (split) {
      const mw = xMedia1 - xMedia0, tw = xText1 - xMedia1;
      if (mw > textWidth(L.memory, fs) + 6) parts.push(text(xMedia0, y + 10, L.memory, { "font-size": fs, class: "fig-t-muted" }));
      if (tw > textWidth(L.textCache, fs) + 6) parts.push(text(xMedia1 + 4, y + 10, L.textCache, { "font-size": fs, class: "fig-t-muted" }));
      y += 16;
    }
    const top = y;
    for (let k = 0; k < L_LAYERS; k++) {
      const layer = L_LAYERS - 1 - k; // top row is the last layer
      const yy = top + k * pitch;
      if (m.qn > 0) parts.push(el("rect", { x: xMedia0, y: yy, width: Math.max(0.5, xMedia1 - xMedia0), height: rowH, fill: mediaRows(layer) ? C.c2 : C.panel }));
      if (p.text > 0) parts.push(el("rect", { x: xMedia1 + (split ? 1.5 : 0), y: yy, width: Math.max(0.5, xText1 - xMedia1 - (split ? 1.5 : 0)), height: rowH, fill: C.c1 }));
    }
    if (split && p.text > 0) parts.push(el("line", { x1: xMedia1 + 0.75, x2: xMedia1 + 0.75, y1: top - 3, y2: top + gridH + 2, stroke: C.ink, "stroke-width": 1 }));
    // Layer axis.
    for (const layer of [1, 16, 32]) {
      const yy = top + (L_LAYERS - layer) * pitch + rowH / 2 + 4;
      parts.push(text(gut - 6, yy, String(layer), { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    }
    y = top + gridH;
  };
  panel(L.dTitle, () => true, false);
  y += 6;
  const eqD = tpl(L.dEq, { l: L_LAYERS, N: int(m.N), kv: N_KV, dh: D_H, b: B_KV, m: mib(m.decTotal) });
  lines(eqD, "fig-t-num");
  y += 12;
  panel(tpl(L.xTitle, { lx: p.xlayers, l: L_LAYERS }), (layer) => xl.has(layer), true);
  parts.push(axis({ scale: x, orient: "bottom", at: y + 3, ticks: x.ticks(narrow ? 3 : 6).filter((v) => v <= m.N), format: (v) => int(v), title: L.pos, size: fs }));
  y += 3 + axisHeight(true, fs);
  lines(tpl(L.xEqText, { l: L_LAYERS, t: int(p.text), kv: N_KV, dh: D_H, b: B_KV, m: mib(m.xat.text) }), "fig-t-num");
  lines(tpl(L.xEqMedia, { lx: p.xlayers, qn: int(m.qn), kv: N_KV, dh: D_H, b: B_KV, m: mib(m.xat.media) }), "fig-t-num");
  lines(tpl(L.xEqTotal, { m: mib(m.xatTotal) }), "fig-t-num fig-t-strong");
  y += 16;

  // ---- totals on one axis
  parts.push(text(0, y + 13, L.bars, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 22;
  const nameW = Math.max(textWidth(L.decoderOnly, fs), textWidth(L.cross, fs)) + 10;
  const valW = textWidth("8,888 MiB", fs) + 14;
  const bx = linear([0, Math.max(m.decTotal, m.xatTotal)], [nameW, w - valW]);
  for (const [name, part, total] of [[L.decoderOnly, m.dec, m.decTotal], [L.cross, m.xat, m.xatTotal]] as const) {
    parts.push(text(0, y + 13, name, { "font-size": fs }));
    parts.push(el("rect", { x: nameW, y: y + 2, width: Math.max(0, bx(part.media) - nameW), height: 14, fill: C.c2 }));
    parts.push(el("rect", { x: bx(part.media), y: y + 2, width: Math.max(0, bx(part.media + part.text) - bx(part.media)), height: 14, fill: C.c1 }));
    parts.push(text(w, y + 13, mib(total), { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
    y += 22;
  }
  y += 4;
  const r = m.decTotal / Math.max(1, m.xatTotal);
  lines(Math.abs(r - 1) < 1e-9 ? L.equal : tpl(L.ratio, { r: sig(r, 3) }));
  lines(tpl(L.read, { a: si(m.decTotal / HBM, "s"), b: si(m.xatTotal / HBM, "s") }), "fig-t-muted");
  return svg(w, y + 8, describe(st, lang), g({ class: "fig-fusion-kv" }, ...parts));
}

export default defineFigure({
  name: "fusion-kv-cost",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    media: {
      kind: "choice", control: "buttons", label: { en: "Features per image n_i", zh: "每张图的特征数 n_i" }, default: "grid336",
      options: [
        { value: "grid336", label: { en: "336 px: 576", zh: "336 像素：576" } },
        { value: "grid672", label: { en: "672 px: 2,304", zh: "672 像素：2,304" } },
        { value: "merge672", label: { en: "672 px merged: 576", zh: "672 像素合并：576" } },
        { value: "resampler", label: { en: "resampler: 64", zh: "重采样：64" } },
      ],
    },
    images: { kind: "range", label: { en: "Images per request q", zh: "每个请求的图像数 q" }, min: 1, max: 8, step: 1, default: 1 },
    text: { kind: "range", label: { en: "Text tokens n_text", zh: "文本词元数 n_text" }, min: 0, max: 4000, step: 100, default: 500 },
    xlayers: {
      kind: "range", label: { en: "Cross-attention layers L_x", zh: "交叉注意力层数 L_x" }, min: 1, max: 32, step: 1, default: 8,
      marks: [{ value: 8, label: { en: "every 4th", zh: "每 4 层" } }, { value: 32, label: { en: "every layer", zh: "每一层" } }],
    },
  },
  render,
  describe,
});
