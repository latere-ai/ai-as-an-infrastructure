// Roofline: attainable throughput min(P, I·B) against arithmetic intensity
// I = F / Q on log-log axes, for one kernel at the HBM boundary. The same
// bound read as time is T >= max(F / P, Q / B), the first two terms of the
// compute-frontier chapter's vector of bounds; the readout draws both terms.
//
// Hardware presets are dense BF16 matrix peaks and HBM bandwidth from the
// vendor datasheets (NVIDIA A100 SXM4 80 GB and H100 SXM5; AMD Instinct
// MI300X). They are ceilings, not the sustainable rates the equation calls
// for, and the caption says so.
//
// Example operations use BF16 operands (2 bytes) and count every operand
// crossing HBM exactly once (perfect on-chip reuse), so their intensity is
// the best case for the shape.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, textBox, type Box } from "./lib/labels.ts";
import { si, sig, pct, tpl } from "./lib/format.ts";

interface Hardware { name: string; peak: number; bw: number } // FLOP/s, byte/s
const HW = {
  a100: { name: "A100 SXM", peak: 312e12, bw: 2.039e12 },
  h100: { name: "H100 SXM", peak: 989e12, bw: 3.35e12 },
  mi300x: { name: "MI300X", peak: 1307e12, bw: 5.3e12 },
} satisfies Record<string, Hardware>;
type HwKey = keyof typeof HW;

// F (FLOP) and Q (bytes) of each example operation. d is a model width.
const d = 8192;
const OPS = {
  add: { F: 2 ** 28, Q: 6 * 2 ** 28 }, // z = x + y over 2^28 elements: read 2, write 1
  gemv: { F: 2 * d * d, Q: 2 * d * d + 4 * d }, // one d×d weight, one token
  gqa: { F: 4 * 8192 * 128 * 32, Q: 4 * 8192 * 128 * 4 }, // 32 query heads over 4 KV heads, 8,192 cached tokens
  gemm64: { F: 2 * 64 * d * d, Q: 2 * d * d + 4 * 64 * d }, // decode with 64 sequences in the batch
  prefill: { F: 2 * 2048 * d * d, Q: 2 * d * d + 4 * 2048 * d }, // 2,048 prompt tokens
  gemm: { F: 2 * 8192 ** 3, Q: 3 * 2 * 8192 ** 2 }, // square GEMM, n = 8,192
} as const;
type OpKey = keyof typeof OPS;
const intensityOf = (k: OpKey) => OPS[k].F / OPS[k].Q;

const labels = {
  en: {
    title: "Roofline and arithmetic intensity",
    x: "arithmetic intensity I (FLOP per byte)",
    y: "attainable FLOP/s",
    memory: "memory-bound",
    compute: "compute-bound",
    ridge: "ridge I* = P / B = {v}",
    ridgeShort: "ridge I* = {v}",
    others: "dashed: {names}, for comparison",
    bound: "T ≥ max(F / P, Q / B)",
    termF: "F / P",
    termQ: "Q / B",
    bindsMem: "bytes bind: Q / B is {r}× F / P",
    bindsCmp: "arithmetic binds: F / P is {r}× Q / B",
    attain: "attainable min(P, I·B) = {v}, {p} of peak",
    work: "F = {f}, Q = {q}, I = {i} FLOP/B",
    add: "add", gemv: "GEMV, batch 1", gqa: "GQA decode", gemm64: "GEMM, batch 64", prefill: "prefill", gemm: "GEMM 8192³",
    describe: "{hw}, {op}: intensity {i} FLOP per byte is {side} the ridge at {r}, so {what} binds. Attainable {a}, {p} of the {peak} peak. With F = {f} and Q = {q}, F / P = {tf} and Q / B = {tq}.",
    below: "below", above: "above", mem: "memory bandwidth", cmp: "arithmetic",
  },
  zh: {
    title: "屋顶线与算术强度",
    x: "算术强度 I（每字节 FLOP）",
    y: "可达 FLOP/s",
    memory: "带宽受限",
    compute: "算力受限",
    ridge: "拐点 I* = P / B = {v}",
    ridgeShort: "拐点 I* = {v}",
    others: "虚线：{names}，用于对照",
    bound: "T ≥ max(F / P, Q / B)",
    termF: "F / P",
    termQ: "Q / B",
    bindsMem: "字节数主导：Q / B 是 F / P 的 {r} 倍",
    bindsCmp: "算术主导：F / P 是 Q / B 的 {r} 倍",
    attain: "可达吞吐 min(P, I·B) = {v}，为峰值的 {p}",
    work: "F = {f}，Q = {q}，I = {i} FLOP/B",
    add: "加法", gemv: "GEMV，批大小 1", gqa: "GQA 解码", gemm64: "GEMM，批大小 64", prefill: "预填充", gemm: "GEMM 8192³",
    describe: "{hw}，{op}：算术强度为每字节 {i} FLOP，位于拐点 {r} 的{side}，因此受{what}限制。可达吞吐 {a}，为峰值 {peak} 的 {p}。F = {f}、Q = {q} 时，F / P = {tf}，Q / B = {tq}。",
    below: "左侧", above: "右侧", mem: "内存带宽", cmp: "算力",
  },
};

const OP_OPTIONS = [
  { value: "add", label: { en: "Elementwise add (2²⁸ elements)", zh: "逐元素加法（2²⁸ 个元素）" } },
  { value: "gemv", label: { en: "Decode matmul, batch 1 (8192 × 8192 weight)", zh: "解码矩阵乘，批大小 1（8192 × 8192 权重）" } },
  { value: "gqa", label: { en: "Attention decode, GQA with 8 query heads per KV head", zh: "注意力解码，GQA，每个 KV 头对应 8 个查询头" } },
  { value: "gemm64", label: { en: "Decode matmul, batch 64", zh: "解码矩阵乘，批大小 64" } },
  { value: "prefill", label: { en: "Prefill matmul, 2,048 tokens", zh: "预填充矩阵乘，2,048 个词元" } },
  { value: "gemm", label: { en: "Square GEMM, n = 8192", zh: "方阵 GEMM，n = 8192" } },
] as const;

type P = { hw: HwKey; op: OpKey; intensity: number };

function model(p: P) {
  const hw = HW[p.hw];
  const op = OPS[p.op];
  const I = p.intensity;
  const ridge = hw.peak / hw.bw;
  const attain = Math.min(hw.peak, I * hw.bw);
  const F = op.F;
  const Q = F / I; // the operation's work at the chosen intensity
  const tF = F / hw.peak, tQ = Q / hw.bw;
  return { hw, I, ridge, attain, F, Q, tF, tQ, memBound: tQ >= tF };
}

const fmtI = (v: number) => sig(v, v < 10 ? 2 : 3);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, {
    hw: m.hw.name, op: L[st.p.op], i: fmtI(m.I), side: m.memBound ? L.below : L.above, r: sig(m.ridge, 3),
    what: m.memBound ? L.mem : L.cmp, a: si(m.attain, "FLOP/s"), p: pct(m.attain / m.hw.peak, 1), peak: si(m.hw.peak, "FLOP/s"),
    f: si(m.F, "FLOP"), q: si(m.Q, "B"), tf: si(m.tF, "s"), tq: si(m.tQ, "s"),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];

  // ---- plot
  const left = narrow ? 44 : 52;
  const right = narrow ? 8 : 16;
  const top = 22;
  const plotH = narrow ? 230 : 290;
  const x = log([0.05, 20000], [left, w - right]);
  const y = log([2e10, 1e16], [top + plotH, top]);
  const roofPts = (hw: Hardware): Array<[number, number]> => {
    const r = hw.peak / hw.bw;
    return [[x(0.05), y(0.05 * hw.bw)], [x(r), y(hw.peak)], [x(20000), y(hw.peak)]];
  };
  const roof = (hw: Hardware) => linePath(roofPts(hw));

  // Regions either side of the ridge, under the chosen roof.
  const xr = x(m.ridge);
  parts.push(el("rect", { x: left, y: top, width: xr - left, height: plotH, fill: C.c1, "fill-opacity": 0.06 }));
  parts.push(el("rect", { x: xr, y: top, width: w - right - xr, height: plotH, fill: C.c2, "fill-opacity": 0.06 }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], minor: true, title: L.x }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], minor: true, title: L.y, format: (v) => si(v, "").replace(/\s+/g, "") }));

  // The other presets as faint roofs (named in the note under the plot), the
  // chosen one solid and named on its flat roof.
  const obstacles: Box[] = [];
  const others = (Object.keys(HW) as HwKey[]).filter((k) => k !== p.hw);
  for (const k of others) {
    parts.push(el("path", { d: roof(HW[k]), fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  }
  parts.push(el("path", { d: roof(m.hw), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));
  for (const k of Object.keys(HW) as HwKey[]) obstacles.push(...lineObstacles(roofPts(HW[k])));
  const chipY = y(m.hw.peak) - 6;
  parts.push(text(w - right - 4, chipY, m.hw.name, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-strong" }));
  obstacles.push(textBox(w - right - 4, chipY, m.hw.name, TYPE.small, "end"));

  // Ridge.
  parts.push(el("line", { x1: xr, x2: xr, y1: y(m.hw.peak), y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  obstacles.push(...lineObstacles([[xr, y(m.hw.peak)], [xr, top + plotH]]));
  // The ridge label joins the label placement below, near the foot of the line.
  const ridgeReq = { x: xr, y: top + plotH - 12, text: tpl(narrow ? L.ridgeShort : L.ridge, { v: sig(m.ridge, 3) }), size: TYPE.small, sides: ["right" as const, "left" as const], gap: 5, priority: 4, attrs: { class: "fig-t-muted" } };
  // Region names in the upper corners.
  parts.push(text(left + 6, top + 14, L.memory, { "font-size": TYPE.small, class: "fig-t-muted" }));
  obstacles.push(textBox(left + 6, top + 14, L.memory, TYPE.small));
  parts.push(text(w - right - 6, top + 14, L.compute, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
  obstacles.push(textBox(w - right - 6, top + 14, L.compute, TYPE.small, "end"));

  // Example operations on the chosen roof, labeled without collisions.
  const reqs = (Object.keys(OPS) as OpKey[]).map((k) => {
    const I = intensityOf(k);
    const px = x(I), py = y(Math.min(m.hw.peak, I * m.hw.bw));
    parts.push(el("circle", { cx: px, cy: py, r: 4, fill: k === p.op ? C.ink : C.paper, stroke: C.ink2, "stroke-width": 1.5, "data-fig-set": `op=${k}`, class: "fig-hit" }));
    obstacles.push({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
    return { x: px, y: py, text: L[k], size: TYPE.small, sides: ["below-right", "right", "below", "above-left", "left", "above", "below-left", "above-right"] as const, gap: 8, priority: k === p.op ? 2 : 1, attrs: { class: k === p.op ? "fig-t-halo" : "fig-t-halo fig-t-soft" } };
  });

  // Operating point, colored by the term that binds.
  const ox = x(m.I), oy = y(m.attain);
  const col = m.memBound ? C.c1 : C.c2;
  parts.push(el("line", { x1: ox, x2: ox, y1: oy, y2: top + plotH, stroke: col, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("line", { x1: left, x2: ox, y1: oy, y2: oy, stroke: col, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  const placed = placeLabels(
    [ridgeReq, { x: ox, y: oy, text: si(m.attain, "FLOP/s"), size: TYPE.body, sides: ["above-left", "above", "above-right", "left", "right"], gap: 10, priority: 3, attrs: { class: "fig-t-strong fig-t-num" } },
      ...reqs.map((r) => ({ ...r, sides: [...r.sides] }))],
    { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: top + plotH - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  parts.push(el("circle", { cx: ox, cy: oy, r: 7, fill: col, stroke: C.paper, "stroke-width": 2 }));

  // ---- readout: the bound as time, and the attainable rate
  let yy = top + plotH + axisHeight(true) + 14;
  const rp: string[] = [];
  const note = tpl(L.others, { names: others.map((k) => HW[k].name).join(lang === "zh" ? "、" : ", ") });
  rp.push(el("line", { x1: 0, x2: 18, y1: yy - 4, y2: yy - 4, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  rp.push(text(24, yy, note, { "font-size": TYPE.small, class: "fig-t-muted" }));
  yy += 26;
  rp.push(text(0, yy, L.bound, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const binds = m.memBound ? tpl(L.bindsMem, { r: sig(m.tQ / m.tF, 3) }) : tpl(L.bindsCmp, { r: sig(m.tF / m.tQ, 3) });
  if (!narrow) rp.push(text(w, yy, binds, { "font-size": TYPE.body, "text-anchor": "end" }));
  yy += narrow ? 18 : 10;
  if (narrow) { rp.push(text(0, yy, binds, { "font-size": TYPE.body })); yy += 8; }
  const nameW = 44, valW = narrow ? 64 : 76;
  const barX = nameW, barW = w - nameW - valW - 8;
  const tmax = Math.max(m.tF, m.tQ);
  for (const [name, t, c] of [[L.termF, m.tF, C.c2], [L.termQ, m.tQ, C.c1]] as const) {
    yy += 8;
    const bw = Math.max(2, (t / tmax) * barW);
    rp.push(text(0, yy + 12, name, { "font-size": TYPE.body, class: "fig-t-num" }));
    rp.push(el("rect", { x: barX, y: yy, width: barW, height: 16, rx: 3, fill: C.panel }));
    rp.push(el("rect", { x: barX, y: yy, width: bw, height: 16, rx: 3, fill: c }));
    rp.push(text(w, yy + 12, si(t, "s"), { "font-size": TYPE.body, "text-anchor": "end", class: (t === tmax ? "fig-t-strong " : "") + "fig-t-num" }));
    yy += 16;
  }
  yy += 22;
  rp.push(text(0, yy, tpl(L.attain, { v: si(m.attain, "FLOP/s"), p: pct(m.attain / m.hw.peak, 1) }), { "font-size": TYPE.body }));
  yy += 18;
  rp.push(text(0, yy, tpl(L.work, { f: si(m.F, "FLOP"), q: si(m.Q, "B"), i: fmtI(m.I) }), { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "roofline",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    hw: {
      kind: "choice", label: { en: "Accelerator", zh: "加速器" }, default: "h100",
      options: [
        { value: "a100", label: { en: "A100 SXM", zh: "A100 SXM" } },
        { value: "h100", label: { en: "H100 SXM", zh: "H100 SXM" } },
        { value: "mi300x", label: { en: "MI300X", zh: "MI300X" } },
      ],
    },
    op: { kind: "choice", label: { en: "Operation", zh: "运算" }, default: "gemv", options: OP_OPTIONS },
    intensity: {
      kind: "range", scale: "log", label: { en: "Intensity I", zh: "算术强度 I" }, unit: { en: "FLOP/B", zh: "FLOP/B" },
      min: 0.05, max: 20000, default: Number(intensityOf("gemv").toPrecision(3)),
    },
  },
  // Choosing an operation moves the intensity to that operation's value; the
  // slider then explores the same work with more or less traffic.
  update(p, key) {
    if (key === "op") return { ...p, intensity: Number(intensityOf(p.op as OpKey).toPrecision(3)) };
    return p;
  },
  render,
  describe,
});
