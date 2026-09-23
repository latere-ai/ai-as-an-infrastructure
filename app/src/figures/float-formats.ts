// Six training number formats: what each stores for one value, and why.
//
// The reader picks a value x and a power-of-two scale factor 2ᵏ (loss
// scaling, or a per-tensor FP8 scale). Every format rounds x·2ᵏ to its
// nearest representable value, round-to-nearest-even, and the figure divides
// the stored value by 2ᵏ again, so each row shows what survives of x. The
// scale is a power of two, so it moves x between binades without rounding.
//
// Formats, as bit fields (sign, exponent, mantissa) and bias 2^(e-1) - 1:
// - FP32 (binary32) and FP16 (binary16): IEEE 754-2019. The all-ones exponent
//   holds Inf and NaN; max = (2 - 2^-m)·2^(2^e - 2 - bias).
// - BF16: FP32's 8-bit exponent with a 7-bit mantissa, IEEE-style specials.
// - FP8 E5M2: IEEE-style, max 57344, min normal 2^-14, min subnormal 2^-16.
// - FP8 E4M3: no Inf; the all-ones exponent is usable except mantissa 111
//   (NaN), so max = 1.75·2^8 = 448, min normal 2^-6, min subnormal 2^-9.
//   Both FP8 layouts follow Micikevicius et al. (2022), "FP8 Formats for Deep
//   Learning", the chapter's FP8 source.
// - FP4 E2M1: no Inf or NaN; the codes are 0, 0.5, 1, 1.5, 2, 3, 4, 6 (OCP
//   Microscaling Formats v1.0), the element format of NVFP4.
// Every range, spacing, and stored value here is computed from these fields;
// none is measured. The k = 16 mark is the initial loss scale of PyTorch's
// dynamic scaler (torch.amp.GradScaler, init_scale = 2**16).

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { legend } from "./lib/legend.ts";
import { sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- formats

type FmtKey = "fp32" | "fp16" | "bf16" | "e5m2" | "e4m3" | "e2m1";
interface Fmt { name: string; e: number; m: number; ieee: boolean; max: number; bias: number; minNormal: number; minSub: number }

function fmt(name: string, e: number, m: number, ieee: boolean, maxOverride?: number): Fmt {
  const bias = 2 ** (e - 1) - 1;
  const max = maxOverride ?? (2 - 2 ** -m) * 2 ** (2 ** e - 2 - bias);
  return { name, e, m, ieee, max, bias, minNormal: 2 ** (1 - bias), minSub: 2 ** (1 - bias - m) };
}

const FMT: Record<FmtKey, Fmt> = {
  fp32: fmt("FP32", 8, 23, true),
  bf16: fmt("BF16", 8, 7, true),
  fp16: fmt("FP16", 5, 10, true),
  e5m2: fmt("FP8 E5M2", 5, 2, true),
  e4m3: fmt("FP8 E4M3", 4, 3, false, 448),
  e2m1: fmt("FP4 E2M1", 2, 1, false, 6),
};
const ORDER: FmtKey[] = ["fp32", "bf16", "fp16", "e5m2", "e4m3", "e2m1"];

type Kind = "zero" | "sub" | "normal" | "over";
interface Q { kind: Kind; v: number; expField: number; mantField: number; E: number }

const roundEven = (a: number) => {
  const f = Math.floor(a), d = a - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
};

// Round a positive value to the format, round-to-nearest-even.
export function quantize(a: number, f: Fmt): Q {
  const emin = 1 - f.bias;
  let E = Math.floor(Math.log2(a));
  if (2 ** E > a) E--; // guard log2 rounding at exact powers
  if (2 ** (E + 1) <= a) E++;
  if (E < emin) {
    const q = 2 ** (emin - f.m);
    const n = roundEven(a / q);
    if (n === 0) return { kind: "zero", v: 0, expField: 0, mantField: 0, E: emin };
    if (n >= 2 ** f.m) return { kind: "normal", v: n * q, expField: 1, mantField: 0, E: emin };
    return { kind: "sub", v: n * q, expField: 0, mantField: n, E: emin };
  }
  const q = 2 ** (E - f.m);
  let n = roundEven(a / q);
  if (n >= 2 ** (f.m + 1)) { E++; n = 2 ** f.m; }
  const v = n * 2 ** (E - f.m);
  if (v > f.max) return { kind: "over", v: Infinity, expField: 2 ** f.e - 1, mantField: 0, E };
  return { kind: "normal", v, expField: E + f.bias, mantField: n - 2 ** f.m, E };
}

// ---------------------------------------------------------------- figure

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).replace(/./g, (c) => SUP[c] ?? c);
const pow10 = (v: number) => `10${sup(Math.round(Math.log10(v)))}`;
const pow2 = (n: number) => `2${sup(n)}`;

// 3 significant figures; scientific notation outside [0.001, 10000).
function num(v: number): string {
  if (v === 0) return "0";
  if (!Number.isFinite(v)) return "∞";
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e4) return sig(v, 3);
  const [m, e] = v.toExponential(2).split("e");
  return `${Number(m)}×10${sup(Number(e))}`;
}

function errText(err: number): string {
  if (err === 0) return "0%";
  const p = err * 100;
  if (Math.abs(p) < 0.001) return "<0.001%";
  return `${p < 0 ? "−" : "+"}${sig(Math.abs(p), 2)}%`;
}

const labels = {
  en: {
    title: "Floating-point formats: range, spacing, and stored value",
    input: "x = {x}, scale 2ᵏ = {s}: the formats round x·2ᵏ = {xs}",
    colStored: "stored ÷ 2ᵏ",
    colErr: "error",
    zero: "flushed to 0",
    over: "overflow",
    overIeee: "overflow → Inf",
    sub: "subnormal",
    normal: "normal range",
    subRange: "subnormal range",
    marker: "x·2ᵏ",
    axis: "magnitude (log scale)",
    beyond: "Past both ends of the axis: FP32 spans {a} to {b}, BF16 {c} to {d}.",
    storedDot: "stored value",
    bits: "{name} bits of x·2ᵏ",
    sign: "sign",
    exponent: "exponent (range)",
    mantissa: "mantissa (precision)",
    expLine: "exponent {bits} = {f}; minus bias {b}: {e}",
    expSub: "exponent {bits} = 0: subnormal, scale fixed at {e}",
    mantLine: "mantissa {bits} = {n}: significand {lead} + {n}/{d} = {sig}",
    value: "stored {v}; ÷ 2ᵏ gives {back}, error {err}",
    zeroLine: "x·2ᵏ = {xs} is below half the smallest subnormal {min}: the format stores 0 and x is lost",
    overLineIeee: "x·2ᵏ = {xs} is above the largest finite value {max}: the result is Inf",
    overLine: "x·2ᵏ = {xs} is above the largest finite value {max}, and {name} has no Inf code: casts saturate to {max} or return NaN",
    props: "range {sub} (smallest subnormal) to {max}; in the normal range, neighboring values differ by at most {m} = {step} of the value",
    describe: "x = {x} scaled by {k}: {rows}. {name} stores x·2ᵏ as {detail}.",
    rowD: "{name} {v}",
    rowZero: "{name} flushed to 0",
    rowOver: "{name} overflows",
    dZero: "0",
    dOver: "an overflow",
  },
  zh: {
    title: "浮点格式：范围、间距与存储值",
    input: "x = {x}，缩放因子 2ᵏ = {s}：各格式对 x·2ᵏ = {xs} 舍入",
    colStored: "存储值 ÷ 2ᵏ",
    colErr: "误差",
    zero: "下溢为 0",
    over: "上溢",
    overIeee: "上溢为 Inf",
    sub: "次正规数",
    normal: "正规数范围",
    subRange: "次正规数范围",
    marker: "x·2ᵏ",
    axis: "数值大小（对数刻度）",
    beyond: "超出坐标轴两端：FP32 的范围是 {a} 到 {b}，BF16 是 {c} 到 {d}。",
    storedDot: "存储值",
    bits: "x·2ᵏ 的 {name} 位模式",
    sign: "符号",
    exponent: "指数（范围）",
    mantissa: "尾数（精度）",
    expLine: "指数 {bits} = {f}，减去偏置 {b}：{e}",
    expSub: "指数 {bits} = 0：次正规数，缩放固定为 {e}",
    mantLine: "尾数 {bits} = {n}：有效数 {lead} + {n}/{d} = {sig}",
    value: "存储值 {v}；除以 2ᵏ 得 {back}，误差 {err}",
    zeroLine: "x·2ᵏ = {xs} 小于最小次正规数 {min} 的一半：格式存成 0，x 丢失",
    overLineIeee: "x·2ᵏ = {xs} 超过最大有限值 {max}：结果为 Inf",
    overLine: "x·2ᵏ = {xs} 超过最大有限值 {max}，而 {name} 没有 Inf 编码：类型转换会饱和到 {max} 或返回 NaN",
    props: "范围从最小次正规数 {sub} 到 {max}；在正规数范围内，相邻可表示值之差至多为数值的 {m} = {step}",
    describe: "x = {x}，乘以 {k}：{rows}。{name} 把 x·2ᵏ 存为 {detail}。",
    rowD: "{name} 为 {v}",
    rowZero: "{name} 下溢为 0",
    rowOver: "{name} 上溢",
    dZero: "0",
    dOver: "上溢",
  },
};

type P = { x: number; k: number; format: FmtKey };

function rows(p: P) {
  const s = 2 ** p.k;
  const xs = p.x * s;
  return ORDER.map((key) => {
    const f = FMT[key];
    const q = quantize(xs, f);
    const back = q.kind === "over" ? Infinity : q.v / s;
    const err = q.kind === "over" ? Infinity : (back - p.x) / p.x;
    return { key, f, q, back, err };
  });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const rs = rows(p);
  const cell = (r: (typeof rs)[number]) => r.q.kind === "zero" ? tpl(L.rowZero, { name: r.f.name })
    : r.q.kind === "over" ? tpl(L.rowOver, { name: r.f.name })
    : tpl(L.rowD, { name: r.f.name, v: `${num(r.back)} (${errText(r.err)})` });
  const sel = rs.find((r) => r.key === p.format)!;
  return tpl(L.describe, {
    x: num(p.x), k: pow2(p.k), rows: rs.map(cell).join(lang === "zh" ? "，" : ", "),
    name: sel.f.name, detail: sel.q.kind === "zero" ? L.dZero : sel.q.kind === "over" ? L.dOver : num(sel.q.v),
  });
}

function bitString(v: number, n: number): string {
  return n === 0 ? "" : v.toString(2).padStart(n, "0");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const s = 2 ** p.k;
  const xs = p.x * s;
  const rs = rows(p);
  const subId = `${st.uid}-sub`;
  const parts: string[] = [el("defs", {}, hatch(subId, C.c1, 4, 1.2))];

  // ---- input line
  let y = 0;
  const head = tpl(L.input, { x: num(p.x), s: pow2(p.k), xs: num(xs) });
  for (const ln of wrap(head, TYPE.label, w)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" })); }

  // ---- range chart: one row per format on a log magnitude axis
  const nameW = Math.ceil(Math.max(...ORDER.map((k) => textWidth(FMT[k].name, fs)))) + 12;
  const storedW = narrow ? 0 : 84;
  const errW = narrow ? 0 : Math.ceil(Math.max(textWidth(L.overIeee, fs), textWidth(L.zero, fs), textWidth(L.colErr, fs), textWidth("−0.0078%", fs))) + 8;
  const markSegs: Array<[number, number]> = [];
  const x0 = nameW, x1 = w - storedW - errW - (narrow ? 4 : 12);
  const X = log([1e-10, 1e12], [x0, x1]);
  y += 16;
  if (!narrow) {
    parts.push(text(w - errW, y + fs, L.colStored, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(w, y + fs, L.colErr, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  }
  y += fs + 8;
  const rowH = narrow ? 40 : 28;
  const barH = 12;
  const top = y;
  rs.forEach((r, i) => {
    const yy = top + i * rowH;
    const on = r.key === p.format;
    const by = yy + (narrow ? 4 : (rowH - barH) / 2);
    if (on) parts.push(el("rect", { x: -2, y: yy, width: w + 4, height: rowH - 2, rx: 4, fill: C.panel }));
    parts.push(text(0, by + barH / 2 + fs * 0.35, r.f.name, { "font-size": fs, class: on ? "fig-t-strong" : undefined }));
    // Subnormal and normal ranges, clipped to the axis, with the clipped end named.
    const cl = (v: number) => Math.min(Math.max(X(v), x0), x1);
    parts.push(el("rect", { x: cl(r.f.minSub), y: by, width: cl(r.f.minNormal) - cl(r.f.minSub), height: barH, fill: `url(#${subId})` }));
    parts.push(el("rect", { x: cl(r.f.minNormal), y: by, width: cl(r.f.max) - cl(r.f.minNormal), height: barH, fill: C.c1, "fill-opacity": 0.55 }));
    // Stored value, or the range end it fell off.
    const bad = r.q.kind === "zero" || r.q.kind === "over";
    if (bad) {
      parts.push(el("circle", { cx: r.q.kind === "zero" ? cl(r.f.minSub) : cl(r.f.max), cy: by + barH / 2, r: 3.5, fill: C.bad }));
    } else {
      parts.push(el("circle", { cx: X(r.q.v), cy: by + barH / 2, r: 4, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
    }
    const status = r.q.kind === "zero" ? L.zero : r.q.kind === "over" ? (r.f.ieee ? L.overIeee : L.over) : "";
    const storedTxt = r.q.kind === "zero" ? "0" : r.q.kind === "over" ? (r.f.ieee ? "Inf" : "–") : num(r.back);
    const errTxt = bad ? status : errText(r.err) + (r.q.kind === "sub" && narrow ? `, ${L.sub}` : "");
    const cls = `fig-t-num${on || bad ? " fig-t-strong" : ""}`;
    if (narrow) {
      parts.push(text(x0, by + barH + 15, bad ? status : `${storedTxt}   ${errTxt}`, { "font-size": fs, class: cls }));
    } else {
      parts.push(text(w - errW, by + barH / 2 + fs * 0.35, storedTxt, { "font-size": fs, "text-anchor": "end", class: `fig-t-num${on ? " fig-t-strong" : ""}` }));
      parts.push(text(w, by + barH / 2 + fs * 0.35, errTxt, { "font-size": fs, "text-anchor": "end", class: cls }));
      if (r.q.kind === "sub") {
        const tx = X(r.q.v) + 8;
        if (tx + textWidth(L.sub, fs) <= x1) parts.push(text(tx, by + barH / 2 + fs * 0.35, L.sub, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));
      }
    }
    markSegs.push([by - 3, by + barH + 3]);
    parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH - 2, fill: "transparent", "data-fig-set": `format=${r.key}`, class: "fig-hit" }));
  });
  const bottom = top + rs.length * rowH;
  // Input marker across all rows.
  const mx = Math.min(Math.max(X(xs), x0), x1);
  // Drawn over the bars only, so it never runs through row text.
  for (const [a, b] of markSegs) parts.push(el("line", { x1: mx, x2: mx, y1: a, y2: b, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
  const ml = L.marker;
  const mlw = textWidth(ml, fs);
  parts.push(text(Math.min(Math.max(mx, x0 + mlw / 2), x1 - mlw / 2), top - 9, ml, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
  // Axis: decades every 2 (desktop) or 4 (phone), gridlines through the rows.
  const ticks: number[] = [];
  for (let e = -8; e <= 12; e += 4) ticks.push(10 ** e);
  const gridAt: number[] = [];
  for (let e = -10; e <= 12; e += 2) gridAt.push(10 ** e);
  parts.splice(1, 0, ...gridAt.map((v) => el("line", { x1: X(v), x2: X(v), y1: top - 2, y2: bottom, stroke: C.grid, "stroke-width": 1 })));
  parts.push(axis({ scale: X, orient: "bottom", at: bottom + 2, ticks, size: fs, format: pow10 }));
  y = bottom + 2 + 12 + fs + 14;
  parts.push(text(narrow ? 0 : (x0 + x1) / 2, y, L.axis, { "font-size": fs, "text-anchor": narrow ? "start" : "middle", class: "fig-t-muted" }));
  // Key, and how far FP32 and BF16 run past the axis.
  const lg = legend([
    { label: L.normal, swatch: { kind: "rect", fill: C.c1, opacity: 0.55 } },
    { label: L.subRange, swatch: { kind: "rect", fill: C.c1, pattern: subId } },
    { label: L.storedDot, swatch: { kind: "dot", fill: C.ink } },
    { label: L.marker, swatch: { kind: "line", stroke: C.ink, dash: "3 2" } },
  ], 0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 8;
  const beyond = tpl(L.beyond, { a: num(FMT.fp32.minSub), b: num(FMT.fp32.max), c: num(FMT.bf16.minSub), d: num(FMT.bf16.max) });
  for (const ln of wrap(beyond, fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted fig-t-num" })); }

  // ---- bits of the selected format
  const sel = rs.find((r) => r.key === p.format)!;
  const f = sel.f, q = sel.q;
  y += 28;
  parts.push(text(0, y, tpl(L.bits, { name: f.name }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 10;
  const nbits = 1 + f.e + f.m;
  const pitch = Math.min(24, Math.floor((w + 2) / nbits));
  const cw = pitch - 2;
  const bits = q.kind === "over" && !f.ieee ? null : "0" + bitString(q.expField, f.e) + bitString(q.mantField, f.m);
  for (let i = 0; i < nbits; i++) {
    const field = i === 0 ? "s" : i <= f.e ? "e" : "m";
    const fill = field === "s" ? C.ink3 : field === "e" ? C.c1 : C.c2;
    parts.push(el("rect", { x: i * pitch, y, width: cw, height: 22, rx: 3, fill: bits ? fill : C.panel, "fill-opacity": bits ? 1 : undefined }));
    if (bits && cw >= 11) parts.push(text(i * pitch + cw / 2, y + 15.5, bits[i], { "font-size": fs, "text-anchor": "middle", "font-weight": 600, fill: C.paper, class: "fig-t-num" }));
  }
  y += 22;
  // Field legend under the cells.
  y += 18;
  let lx = 0;
  for (const [lab, col] of [[L.sign, C.ink3], [L.exponent, C.c1], [L.mantissa, C.c2]] as const) {
    const wItem = 18 + textWidth(lab, fs) + 16;
    if (lx > 0 && lx + wItem > w) { lx = 0; y += 18; }
    parts.push(el("rect", { x: lx, y: y - 9, width: 12, height: 10, rx: 2, fill: col }));
    parts.push(text(lx + 18, y, lab, { "font-size": fs, class: "fig-t-muted" }));
    lx += wItem;
  }
  // Decode.
  const lines: Array<[string, string]> = [];
  if (q.kind === "zero") {
    lines.push([tpl(L.zeroLine, { xs: num(xs), min: num(f.minSub) }), "fig-t-strong"]);
  } else if (q.kind === "over") {
    lines.push([tpl(f.ieee ? L.overLineIeee : L.overLine, { xs: num(xs), max: num(f.max), name: f.name }), "fig-t-strong"]);
  } else {
    const d = 2 ** f.m;
    const signif = (q.kind === "sub" ? 0 : 1) + q.mantField / d;
    lines.push([q.kind === "sub"
      ? tpl(L.expSub, { bits: bitString(0, f.e), e: pow2(1 - f.bias) })
      : tpl(L.expLine, { bits: bitString(q.expField, f.e), f: q.expField, b: f.bias, e: pow2(q.E) }), ""]);
    lines.push([tpl(L.mantLine, { bits: bitString(q.mantField, f.m), n: q.mantField, d, lead: q.kind === "sub" ? 0 : 1, sig: sig(signif, 7) }), ""]);
    lines.push([tpl(L.value, { v: num(q.v), back: num(sel.back), err: errText(sel.err) }), "fig-t-strong"]);
  }
  lines.push([tpl(L.props, { sub: num(f.minSub), max: num(f.max), m: pow2(-f.m), step: `${sig(100 * 2 ** -f.m, 2)}%` }), "fig-t-muted"]);
  y += 8;
  for (const [ln, cls] of lines) {
    for (const part of wrap(ln, fs, w)) { y += 17; parts.push(text(0, y, part, { "font-size": fs, class: `fig-t-num ${cls}`.trim() })); }
    y += 2;
  }
  return svg(w, y + 6, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "float-formats",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    x: {
      kind: "range", scale: "log", label: { en: "Value x", zh: "数值 x" }, min: 1e-10, max: 1e4, default: 1e-6,
      marks: [{ value: 1, label: { en: "1", zh: "1" } }],
    },
    k: {
      kind: "range", label: { en: "Scale exponent k", zh: "缩放指数 k" }, min: 0, max: 24, step: 1, default: 0,
      marks: [{ value: 16, label: { en: "2¹⁶, a common initial loss scale", zh: "2¹⁶，常见的初始损失缩放" } }],
    },
    format: {
      kind: "choice", control: "select", label: { en: "Bits of", zh: "查看位模式" }, default: "bf16",
      options: ORDER.map((k) => ({ value: k, label: { en: FMT[k].name, zh: FMT[k].name } })),
    },
  },
  render,
  describe,
});
