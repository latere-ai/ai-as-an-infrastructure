// Residual vector quantization of one two-dimensional frame, with the three
// four-entry codebooks of the speech chapter's runnable (frame rate 50 per
// second). At depth j the quantizer picks the entry of codebook j nearest the
// residual and passes on what it did not explain:
//
//   k^(j) = argmin_k ‖r^(j−1) − e_k^(j)‖²,   r^(j) = r^(j−1) − e_{k^(j)}^(j),
//   ẑ = Σ_{j ≤ Q} e_{k^(j)}^(j),   r^(0) = z,
//
// and the codec sends R_idx = f·Q indices and R_bit = f·Σ⌈log₂K_j⌉ bits per
// second. The first frame is the runnable's (1.0, −0.5), so the readout repeats
// its printed errors 0.354, 0.125, 0.000. Each stage is drawn in its own
// residual coordinates, at the scale of its codebook, so the finer later
// codebooks stay visible. Everything is exact arithmetic; nothing is learned.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrapCJK } from "./lib/notation.ts";
import { linear } from "./lib/scale.ts";
import { textWidth, placeLabels, drawLabels, type Box, type LabelRequest } from "./lib/labels.ts";
import { fixed, int, tpl } from "./lib/format.ts";

type V = [number, number];

// The runnable's codebooks, entry order as printed there (index k = position).
const CODEBOOKS: V[][] = [
  [[0, 0], [0.75, -0.25], [-0.75, 0.25], [1, 0]],
  [[0, 0], [0.25, -0.125], [-0.25, 0.125], [0, 0.25]],
  [[0, 0], [0, -0.125], [0, 0.125], [0.125, 0]],
];
const FRAME_HZ = 50;
const BITS = CODEBOOKS.map((cb) => Math.ceil(Math.log2(cb.length)));

const FRAMES = {
  a: [1, -0.5],
  b: [0.3, 0.2],
  c: [0.5, 0.9],
  d: [-0.4, -0.6],
} satisfies Record<string, V>;
type FrameKey = keyof typeof FRAMES;

const norm = (v: V) => Math.hypot(v[0], v[1]);
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];

interface Stage { k: number; entry: V; recon: V; residual: V; error: number }

// Greedy RVQ of z through the first `depth` codebooks. Ties go to the lower
// index, as Python's min() does in the runnable.
export function quantize(z: V, depth: number): Stage[] {
  const out: Stage[] = [];
  let r = z;
  let recon: V = [0, 0];
  for (let j = 0; j < depth; j++) {
    const cb = CODEBOOKS[j];
    let best = 0;
    for (let k = 1; k < cb.length; k++) if (norm(sub(r, cb[k])) < norm(sub(r, cb[best])) - 1e-12) best = k;
    r = sub(r, cb[best]);
    recon = add(recon, cb[best]);
    out.push({ k: best, entry: cb[best], recon, residual: r, error: norm(r) });
  }
  return out;
}

const residualAt = (z: V, depth: number) => (depth ? quantize(z, depth)[depth - 1].error : norm(z));

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Residual vector quantization of one frame",
    stage: "Codebook {j}",
    unsent: "Codebook {j}: not sent at Q = {q}",
    scale: "axes ±{s}",
    resid: "r",
    pick: "sends k = {k}, {b} bits",
    move: "r: {a} → {c}",
    err: "‖r‖: {a} → {c}",
    none: "Q = 0: nothing is sent, ẑ = (0, 0) and the error is ‖z‖ = {e}",
    recon: "ẑ = {terms} = {z}, error ‖z − ẑ‖ = {e}",
    rates: "R_idx = f·Q = {f} · {q} = {ri} indices/s",
    bitrate: "R_bit = f·Σ⌈log₂K_j⌉ = {f} · {sum} = {rb} bits/s",
    kEntry: "entry, index k",
    kChosen: "nearest entry",
    kResid: "residual r to explain",
    kNew: "new residual",
    describe: "Frame {z} quantized with {q:codebook/codebooks}: reconstruction {r}, remaining error {e}. At {f} frames per second the codec sends {ri} indices and {rb} bits per second.",
  },
  zh: {
    title: "单个帧的残差向量量化",
    stage: "码本 {j}",
    unsent: "码本 {j}：Q = {q} 时不发送",
    scale: "坐标范围 ±{s}",
    resid: "r",
    pick: "发送 k = {k}，{b} 比特",
    move: "r：{a} → {c}",
    err: "‖r‖：{a} → {c}",
    none: "Q = 0：不发送任何索引，ẑ = (0, 0)，误差为 ‖z‖ = {e}",
    recon: "ẑ = {terms} = {z}，误差 ‖z − ẑ‖ = {e}",
    rates: "R_idx = f·Q = {f} · {q} = {ri} 个索引/秒",
    bitrate: "R_bit = f·Σ⌈log₂K_j⌉ = {f} · {sum} = {rb} 比特/秒",
    kEntry: "码本条目及索引 k",
    kChosen: "最近的条目",
    kResid: "待解释的残差 r",
    kNew: "新的残差",
    describe: "帧 {z} 用 {q} 个码本量化：重建为 {r}，剩余误差 {e}。帧率为每秒 {f} 帧时，编解码器每秒发送 {ri} 个索引、{rb} 比特。",
  },
};

type Lb = typeof labels.en;
type P = { depth: number; frame: FrameKey };

// A non-breaking space inside a vector keeps it on one line when text wraps.
const vec = (v: V) => `(${fmt(v[0])},\u00a0${fmt(v[1])})`;
function fmt(x: number): string {
  const s = String(Number(x.toFixed(3)));
  return s.replace(/^-/, "−");
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const z = FRAMES[st.p.frame] as V;
  const q = st.p.depth;
  const s = quantize(z, q);
  const recon: V = q ? s[q - 1].recon : [0, 0];
  const rb = FRAME_HZ * BITS.slice(0, q).reduce((a, b) => a + b, 0);
  return tpl(Lx.describe, {
    z: vec(z), q, r: vec(recon), e: fixed(residualAt(z, q), 3),
    ri: FRAME_HZ * q, rb, f: FRAME_HZ,
  });
}

// Arrowhead path at the end of a segment.
function arrowHead(x0: number, y0: number, x1: number, y1: number, size = 7): string {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const p = (d: number) => `${x1 - size * Math.cos(a + d)},${y1 - size * Math.sin(a + d)}`;
  return `M${x1},${y1}L${p(0.42)}L${p(-0.42)}Z`;
}

const cross = (x: number, y: number, r = 5) => `M${x - r},${y - r}L${x + r},${y + r}M${x - r},${y + r}L${x + r},${y - r}`;

// The smallest readable half-width that holds every entry and the residual.
const SCALES = [0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5];
function halfWidth(pts: V[]): number {
  const m = Math.max(...pts.flatMap((v) => [Math.abs(v[0]), Math.abs(v[1])])) * 1.15;
  return SCALES.find((s) => s >= m) ?? SCALES[SCALES.length - 1];
}

// Stage j in its own residual coordinates: the residual it must explain, the
// codebook's entries, the nearest one (all others lie outside the dashed
// circle), and the new residual it passes on.
function renderStage(z: V, j: number, x0: number, y0: number, size: number, uid: string): { svg: string; hs: number } {
  const all = quantize(z, CODEBOOKS.length);
  const rIn: V = j ? all[j - 1].residual : z;
  const st = all[j];
  const cb = CODEBOOKS[j];
  const hs = halfWidth([...cb, rIn]);
  const sx = linear([-hs, hs], [x0, x0 + size]);
  const sy = linear([-hs, hs], [y0 + size, y0]);
  const parts: string[] = [];
  const clip = `${uid}-s${j}`;
  parts.push(el("clipPath", { id: clip }, el("rect", { x: x0, y: y0, width: size, height: size })));
  parts.push(el("rect", { x: x0, y: y0, width: size, height: size, fill: C.panel, "fill-opacity": 0.5, stroke: C.rule, "stroke-width": 1 }));
  parts.push(el("line", { x1: sx(0), x2: sx(0), y1: y0, y2: y0 + size, stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("line", { x1: x0, x2: x0 + size, y1: sy(0), y2: sy(0), stroke: C.grid, "stroke-width": 1 }));
  const rx = sx(rIn[0]), ry = sy(rIn[1]);
  const ex = sx(st.entry[0]), ey = sy(st.entry[1]);
  const rad = Math.hypot(rx - ex, ry - ey);
  const marks: string[] = [];
  if (rad > 1) marks.push(el("circle", { cx: rx, cy: ry, r: rad, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  parts.push(g({ "clip-path": `url(#${clip})` }, ...marks));
  // New residual: the vector from the chosen entry to r.
  if (rad > 9) {
    parts.push(el("line", { x1: ex, y1: ey, x2: rx, y2: ry, stroke: C.c1, "stroke-width": 2, "stroke-linecap": "round" }));
    parts.push(el("path", { d: arrowHead(ex, ey, rx, ry, 6), fill: C.c1 }));
  }
  const obstacles: Box[] = [{ x0: rx - 6, y0: ry - 6, x1: rx + 6, y1: ry + 6 }];
  cb.forEach((e, k) => {
    const cx = sx(e[0]), cy = sy(e[1]);
    parts.push(el("circle", { cx, cy, r: 4.5, fill: k === st.k ? C.c2 : C.paper, stroke: C.c2, "stroke-width": 1.6 }));
    obstacles.push({ x0: cx - 5, y0: cy - 5, x1: cx + 5, y1: cy + 5 });
  });
  parts.push(el("path", { d: cross(rx, ry), stroke: C.ink, "stroke-width": 2 }));
  const reqs: LabelRequest[] = cb.map((e, k) => ({
    x: sx(e[0]), y: sy(e[1]), text: String(k), size: TYPE.body, gap: 7, priority: k === st.k ? 2 : 1,
    sides: ["above-right", "below-right", "above-left", "below-left", "right", "left", "above", "below"],
    attrs: { class: k === st.k ? "fig-t-halo fig-t-num" : "fig-t-halo fig-t-soft fig-t-num" },
  }));
  const placed = placeLabels(reqs, { x0: x0 + 2, y0: y0 + 2, x1: x0 + size - 2, y1: y0 + size - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  return { svg: g({ class: "fig-stage" }, ...parts), hs };
}

function stageText(z: V, j: number, q: number, w: number, x: number, y: number, Lx: Lb, hs: number): { svg: string; h: number } {
  const all = quantize(z, CODEBOOKS.length);
  const rIn: V = j ? all[j - 1].residual : z;
  const st = all[j];
  const on = j < q;
  const parts: string[] = [];
  const size = TYPE.body;
  let yy = y;
  const put = (s: string, cls: string) => {
    for (const ln of wrapCJK(s, size, w * 0.92)) {
      yy += 16;
      parts.push(text(x, yy, ln, { "font-size": size, class: cls }));
    }
  };
  put(on ? tpl(Lx.stage, { j: j + 1 }) : tpl(Lx.unsent, { j: j + 1, q }), on ? "fig-t-strong" : "fig-t-faint");
  const cls = on ? "fig-t-num" : "fig-t-num fig-t-faint";
  put(tpl(Lx.pick, { k: st.k, b: BITS[j] }), cls);
  put(tpl(Lx.move, { a: vec(rIn), c: vec(st.residual) }), cls);
  put(tpl(Lx.err, { a: fixed(norm(rIn), 3), c: fixed(st.error, 3) }), cls);
  put(tpl(Lx.scale, { s: fmt(hs) }), "fig-t-faint fig-t-num");
  return { svg: g({}, ...parts), h: yy - y };
}

function renderKey(x: number, y: number, w: number, Lx: Lb, size: number): { svg: string; h: number } {
  const items: Array<[string, (cx: number, cy: number) => string]> = [
    [Lx.kEntry, (cx, cy) => el("circle", { cx, cy, r: 4.5, fill: C.paper, stroke: C.c2, "stroke-width": 1.6 })],
    [Lx.kChosen, (cx, cy) => el("circle", { cx, cy, r: 4.5, fill: C.c2, stroke: C.c2, "stroke-width": 1.6 })],
    [Lx.kResid, (cx, cy) => el("path", { d: cross(cx, cy, 4.5), stroke: C.ink, "stroke-width": 2 })],
    [Lx.kNew, (cx, cy) => el("line", { x1: cx - 7, x2: cx + 5, y1: cy, y2: cy, stroke: C.c1, "stroke-width": 2 }) + el("path", { d: arrowHead(cx - 7, cy, cx + 7, cy, 6), fill: C.c1 })],
  ];
  const parts: string[] = [];
  let cx = x, row = 0;
  for (const [label, sw] of items) {
    const iw = 18 + textWidth(label, size);
    if (cx > x && cx + iw > x + w) { cx = x; row++; }
    const cy = y + row * (size + 8) + size / 2 + 1;
    parts.push(sw(cx + 6, cy), text(cx + 18, cy + size * 0.35, label, { "font-size": size, class: "fig-t-muted" }));
    cx += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: (row + 1) * (size + 8) };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const z = FRAMES[p.frame] as V;
  const q = p.depth;
  const parts: string[] = [];
  const key = renderKey(0, 0, w, Lx, narrow ? TYPE.body : TYPE.small);
  parts.push(key.svg);
  let y = key.h + 8;
  const n = CODEBOOKS.length;
  if (narrow) {
    // One row per stage: the panel, then its numbers beside it.
    const size = 128;
    for (let j = 0; j < n; j++) {
      const s = renderStage(z, j, 0, y, size, st.uid);
      const t = stageText(z, j, q, w - size - 12, size + 12, y - 4, Lx, s.hs);
      parts.push(g({ opacity: j < q ? undefined : 0.4 }, s.svg), t.svg);
      y += Math.max(size, t.h) + 14;
    }
  } else {
    const gap = 16;
    const size = (w - gap * (n - 1)) / n;
    let th = 0;
    for (let j = 0; j < n; j++) {
      const x = j * (size + gap);
      const s = renderStage(z, j, x, y, size, st.uid);
      const t = stageText(z, j, q, size, x, y + size + 2, Lx, s.hs);
      parts.push(g({ opacity: j < q ? undefined : 0.4 }, s.svg), t.svg);
      th = Math.max(th, t.h);
    }
    y += size + th + 14;
  }
  // The chapter's equations at the chosen depth, with their terms.
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  const stages = quantize(z, q);
  const recon: V = q ? stages[q - 1].recon : [0, 0];
  const bits = BITS.slice(0, q);
  const lines = q
    ? [
      tpl(Lx.recon, { terms: stages.map((s) => vec(s.entry)).join(" + "), z: vec(recon), e: fixed(residualAt(z, q), 3) }),
      tpl(Lx.rates, { f: FRAME_HZ, q, ri: int(FRAME_HZ * q) }),
      tpl(Lx.bitrate, { f: FRAME_HZ, sum: `(${bits.join(" + ")})`, rb: int(FRAME_HZ * bits.reduce((a, b) => a + b, 0)) }),
    ]
    : [tpl(Lx.none, { e: fixed(norm(z), 3) })];
  for (const line of lines) {
    for (const part of wrapCJK(line, TYPE.body, w * 0.92)) {
      y += 17;
      parts.push(text(0, y, part, { "font-size": TYPE.body, class: "fig-t-num" }));
    }
    y += 3;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "residual-vq",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    depth: {
      kind: "range", label: { en: "Active codebooks Q", zh: "启用码本数 Q" }, min: 0, max: 3, step: 1, default: 2,
    },
    frame: {
      kind: "choice", control: "buttons", label: { en: "Frame z", zh: "帧 z" }, default: "a",
      options: [
        { value: "a", label: { en: "(1, −0.5), the runnable's", zh: "(1, −0.5)，即可运行示例" } },
        { value: "b", label: { en: "(0.3, 0.2)", zh: "(0.3, 0.2)" } },
        { value: "c", label: { en: "(0.5, 0.9)", zh: "(0.5, 0.9)" } },
        { value: "d", label: { en: "(−0.4, −0.6)", zh: "(−0.4, −0.6)" } },
      ],
    },
  },
  render,
  describe,
});
