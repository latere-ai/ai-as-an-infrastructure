// Refusal threshold on a risk score: the chapter's two error rates as the two
// tails of overlapping score distributions, and the operating curve they trace.
//
// An evaluation set holds harmful requests D_H and benign requests D_B in four
// slices (English plain text, other languages, encoded text, long
// conversations). Each request has a risk score in (0, 1); the system refuses
// when the score reaches the cutoff τ. With an allowed harmful request counted
// as a violation (V = 1) and a refused benign one as a benign refusal (F = 1),
// the chapter's rates are counts over the set:
//
//   UCR = (1 / |D_H|) Σ_{D_H} 1[score < τ],   BRR = (1 / |D_B|) Σ_{D_B} 1[score ≥ τ].
//
// Scores are seeded: each request draws one standard normal z, and its score is
// σ(μ + z) with μ set by its class, slice, and model. The same requests are
// scored by both models, so switching the model moves the same points. The
// safety-tuned model separates English, other languages, and long
// conversations further than the base model, and encoded text not at all,
// which is how an average can improve while one slice does not. Every value
// is illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { normalFrom, sigmoid } from "./lib/stats.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Slice = "en" | "lang" | "enc" | "long";
type Sel = Slice | "all";
type Model = "base" | "tuned";
const SLICES: Slice[] = ["en", "lang", "enc", "long"];
const COUNT: Record<Slice, number> = { en: 280, lang: 60, enc: 30, long: 30 }; // per class
// Mean logit of the risk score, [benign, harmful], by model and slice.
const MU: Record<Model, Record<Slice, [number, number]>> = {
  base: { en: [-1.2, 1.0], lang: [-0.9, 0.4], enc: [-0.8, -0.1], long: [-0.9, 0.3] },
  tuned: { en: [-1.6, 1.6], lang: [-1.1, 1.0], enc: [-0.8, -0.1], long: [-1.0, 0.8] },
};

interface Req { slice: Slice; harmful: boolean; z: number }

const memoReqs = new Map<number, Req[]>();
function requests(seed: number): Req[] {
  let hit = memoReqs.get(seed);
  if (hit) return hit;
  const u = rng(seed);
  hit = [];
  for (const s of SLICES) for (const harmful of [false, true]) for (let i = 0; i < COUNT[s]; i++) hit.push({ slice: s, harmful, z: normalFrom(u(), u()) });
  if (memoReqs.size > 8) memoReqs.clear();
  memoReqs.set(seed, hit);
  return hit;
}

const score = (r: Req, m: Model) => sigmoid(MU[m][r.slice][r.harmful ? 1 : 0] + r.z);

interface Rates { nH: number; nB: number; allowedH: number; refusedB: number; ucr: number; brr: number }
function rates(reqs: Req[], m: Model, sel: Sel, tau: number): Rates {
  let nH = 0, nB = 0, allowedH = 0, refusedB = 0;
  for (const r of reqs) {
    if (sel !== "all" && r.slice !== sel) continue;
    const s = score(r, m);
    if (r.harmful) { nH++; if (s < tau) allowedH++; } else { nB++; if (s >= tau) refusedB++; }
  }
  return { nH, nB, allowedH, refusedB, ucr: allowedH / nH, brr: refusedB / nB };
}

// The operating curve: (BRR, UCR) as τ sweeps from 0 to 1.
function curve(reqs: Req[], m: Model, sel: Sel): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 200; i++) { const r = rates(reqs, m, sel, i / 200); pts.push([r.brr, r.ucr]); }
  return pts;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Refusal cutoff, unsafe compliance, and benign refusal",
    all: "all requests",
    en: "English, plain text",
    lang: "other languages",
    enc: "encoded text",
    long: "long conversations",
    histTitle: "Risk scores, {sel}",
    benign: "benign: refused at or above τ, counted in BRR",
    harmful: "harmful: allowed below τ, counted in UCR",
    xScore: "risk score (refuse when score ≥ τ)",
    yCount: "requests",
    cutoff: "τ = {t}",
    curveTitle: "Operating curve as τ sweeps",
    xCurve: "benign-refusal rate BRR",
    yCurve: "unsafe-compliance rate UCR",
    atCutoff: "at τ",
    ucr: "UCR = (1/|D_H|) Σ 1[V = 1] = {a} / {n} = {r}",
    brr: "BRR = (1/|D_B|) Σ 1[F = 1] = {a} / {n} = {r}",
    table: "Each slice at τ = {t}",
    colSlice: "slice",
    colUcr: "UCR",
    colBrr: "BRR",
    worst: "The highest UCR at this cutoff is {s} at {r}, against {a} for all requests.",
    describe: "{model}, cutoff {t}, {sel}: UCR {u} ({ua} of {un} harmful requests allowed) and BRR {b} ({ba} of {bn} benign requests refused). Across slices at the same cutoff, UCR runs from {lo} to {hi}.",
    modelBase: "Base model",
    modelTuned: "Safety-tuned model",
  },
  zh: {
    title: "拒绝阈值、不安全服从与无害拒绝",
    all: "全部请求",
    en: "英语纯文本",
    lang: "其他语言",
    enc: "编码文本",
    long: "长对话",
    histTitle: "风险分数：{sel}",
    benign: "无害请求：分数 ≥ τ 时被拒绝，计入 BRR",
    harmful: "有害请求：分数 < τ 时被放行，计入 UCR",
    xScore: "风险分数（分数 ≥ τ 时拒绝）",
    yCount: "请求数",
    cutoff: "τ = {t}",
    curveTitle: "τ 变化时的工作曲线",
    xCurve: "无害拒绝率 BRR",
    yCurve: "不安全服从率 UCR",
    atCutoff: "τ 处",
    ucr: "UCR = (1/|D_H|) Σ 1[V = 1] = {a} / {n} = {r}",
    brr: "BRR = (1/|D_B|) Σ 1[F = 1] = {a} / {n} = {r}",
    table: "τ = {t} 时的各切片",
    colSlice: "切片",
    colUcr: "UCR",
    colBrr: "BRR",
    worst: "在这个阈值下，UCR 最高的是{s}，为 {r}；全部请求的 UCR 为 {a}。",
    describe: "{model}，阈值 {t}，{sel}：UCR 为 {u}（{un} 个有害请求中放行 {ua} 个），BRR 为 {b}（{bn} 个无害请求中拒绝 {ba} 个）。同一阈值下，各切片的 UCR 从 {lo} 到 {hi}。",
    modelBase: "基座模型",
    modelTuned: "经过安全调优的模型",
  },
};

type L = typeof labels.en;
type P = { cutoff: number; model: Model; slice: Sel; seed: number };

function lines(s: string, size: number, width: number, lang: Lang): string[] {
  if (lang !== "zh") return wrap(s, size, width);
  const ls = wrapCjk(s, size, width);
  return ls.some((l) => textWidth(l, size) > width) ? wrapCjk(s, size, width - size) : ls;
}
const sliceName = (L: L, s: Sel) => L[s];
const pc = (v: number) => pct(v, 1);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const reqs = requests(p.seed);
  const r = rates(reqs, p.model, p.slice, p.cutoff);
  const per = SLICES.map((s) => rates(reqs, p.model, s, p.cutoff).ucr);
  return tpl(L.describe, {
    model: p.model === "base" ? L.modelBase : L.modelTuned, t: fixed(p.cutoff, 2), sel: sliceName(L, p.slice),
    u: pc(r.ucr), ua: r.allowedH, un: r.nH, b: pc(r.brr), ba: r.refusedB, bn: r.nB,
    lo: pc(Math.min(...per)), hi: pc(Math.max(...per)),
  });
}

// ---------------------------------------------------------------- render

const SLICE_COLOR: Record<Slice, string> = { en: C.c3, lang: C.c4, enc: C.c5, long: C.c6 };
const BINS = 20;

interface Block { svg: string; h: number }

function histogram(p: P, lang: Lang, x0: number, y0: number, pw: number): Block {
  const L = labels[lang];
  const fs = TYPE.body;
  const reqs = requests(p.seed).filter((r) => p.slice === "all" || r.slice === p.slice);
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(L.histTitle, { sel: sliceName(L, p.slice) }), TYPE.label, pw, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  // Key for the upper histogram.
  const key = (s: string, col: string, yy: number) => {
    const ls = lines(s, fs, pw - 20, lang);
    parts.push(el("rect", { x: x0, y: yy - 10, width: 12, height: 10, rx: 2, fill: col }));
    ls.forEach((ln, k) => parts.push(text(x0 + 18, yy + k * 15, ln, { "font-size": fs, class: "fig-t-muted" })));
    return ls.length * 15;
  };
  y += 10;
  y += key(L.benign, C.c1, y + 12) + 4;
  const left = 36, right = 6;
  const halfH = pw < 300 ? 78 : 88;
  const top = y + 30; // room for the axis title and the cutoff label
  const mid = top + halfH;
  const x = linear([0, 1], [x0 + left, x0 + pw - right]);
  // Counts per bin, split by the side of τ each request falls on.
  const up = Array.from({ length: BINS }, () => [0, 0]); // benign: [below τ, at or above τ]
  const dn = Array.from({ length: BINS }, () => [0, 0]); // harmful: [below τ, at or above τ]
  for (const r of reqs) {
    const s = score(r, p.model);
    const b = Math.min(BINS - 1, Math.floor(s * BINS));
    (r.harmful ? dn : up)[b][s >= p.cutoff ? 1 : 0]++;
  }
  const maxC = Math.max(1, ...up.map(([a, b]) => a + b), ...dn.map(([a, b]) => a + b));
  const step = maxC > 60 ? 20 : maxC > 30 ? 10 : 5;
  const cmax = Math.ceil(maxC / step) * step;
  const ys = linear([-cmax, cmax], [mid + halfH, mid - halfH]);
  const ticks: number[] = [];
  for (let v = -cmax; v <= cmax; v += step) ticks.push(v);
  parts.push(axis({ scale: ys, orient: "left", at: x0 + left, grid: [x0 + left, x0 + pw - right], ticks, format: (v) => String(Math.abs(v)), title: L.yCount, size: fs }));
  const bw = (x(1) - x(0)) / BINS;
  for (let b = 0; b < BINS; b++) {
    const bx = x(b / BINS) + 0.5, w = bw - 1;
    const [ub, ua] = up[b], [hb, ha] = dn[b];
    // Benign above the axis: refused (≥ τ) solid, next to the axis.
    let yy = mid;
    if (ua) { parts.push(el("rect", { x: bx, y: ys(ua), width: w, height: mid - ys(ua), fill: C.c1 })); yy = ys(ua); }
    if (ub) parts.push(el("rect", { x: bx, y: yy - (mid - ys(ub)), width: w, height: mid - ys(ub), fill: C.c1, "fill-opacity": 0.28 }));
    // Harmful below the axis: allowed (< τ) solid, next to the axis.
    yy = mid;
    if (hb) { parts.push(el("rect", { x: bx, y: mid, width: w, height: ys(-hb) - mid, fill: C.c2 })); yy = ys(-hb); }
    if (ha) parts.push(el("rect", { x: bx, y: yy, width: w, height: ys(-ha) - mid, fill: C.c2, "fill-opacity": 0.28 }));
  }
  parts.push(el("line", { x1: x0 + left, x2: x0 + pw - right, y1: mid, y2: mid, stroke: C.rule, "stroke-width": 1 }));
  // The cutoff.
  const xt = x(p.cutoff);
  parts.push(el("line", { x1: xt, x2: xt, y1: top - 4, y2: mid + halfH, stroke: C.ink, "stroke-width": 1.75 }));
  const lt = tpl(L.cutoff, { t: fixed(p.cutoff, 2) });
  const ltw = textWidth(lt, fs);
  const lx = Math.min(Math.max(xt, x0 + left + ltw / 2 + 2), x0 + pw - right - ltw / 2);
  parts.push(text(lx, top - 8, lt, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  // Click anywhere in the plot to move the cutoff there.
  for (let i = 0; i <= 100; i++) {
    const cx = x(i / 100);
    parts.push(el("rect", { x: cx - bw / 10, y: top, width: bw / 5, height: 2 * halfH, fill: "transparent", "data-fig-set": `cutoff=${(i / 100).toFixed(2)}`, class: "fig-hit" }));
  }
  const xa = axis({ scale: x, orient: "bottom", at: mid + halfH, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => fixed(v, 1), title: L.xScore, size: fs });
  parts.push(xa);
  y = mid + halfH + axisHeight(true, fs) + 14;
  y += key(L.harmful, C.c2, y);
  return { svg: g({ class: "fig-hist" }, ...parts), h: y - y0 };
}

function operating(p: P, lang: Lang, x0: number, y0: number, pw: number): Block {
  const L = labels[lang];
  const fs = TYPE.body;
  const reqs = requests(p.seed);
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(L.curveTitle, TYPE.label, pw, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  const left = 40, right = 8;
  const top = y + 30;
  const side = Math.min(pw - left - 22, 240); // room for the last tick label
  const x = linear([0, 1], [x0 + left, x0 + left + side]);
  const ys = linear([0, 1], [top + side, top]);
  const tk = [0, 0.2, 0.4, 0.6, 0.8, 1];
  parts.push(axis({ scale: x, orient: "bottom", at: top + side, grid: [top, top + side], ticks: tk, format: (v) => `${Math.round(v * 100)}%`, title: L.xCurve, size: fs }));
  parts.push(axis({ scale: ys, orient: "left", at: x0 + left, grid: [x0 + left, x0 + left + side], ticks: tk, format: (v) => `${Math.round(v * 100)}%`, title: L.yCurve, size: fs }));
  const sets: Sel[] = [...SLICES, "all"];
  for (const s of sets) {
    const pts = curve(reqs, p.model, s).map(([a, b]) => [x(a), ys(b)] as [number, number]);
    const on = s === p.slice;
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: s === "all" ? C.ink : SLICE_COLOR[s], "stroke-width": on ? 2.75 : s === "all" ? 2 : 1.4, "stroke-linejoin": "round", opacity: on || s === "all" ? 1 : 0.85 }));
  }
  // Every set at the current cutoff; the chosen one larger.
  for (const s of sets) {
    const r = rates(reqs, p.model, s, p.cutoff);
    const on = s === p.slice;
    parts.push(el("circle", { cx: x(r.brr), cy: ys(r.ucr), r: on ? 6 : 4, fill: s === "all" ? C.ink : SLICE_COLOR[s], stroke: C.paper, "stroke-width": 1.5 }));
  }
  y = top + side + axisHeight(true, fs);
  return { svg: g({ class: "fig-curve" }, ...parts), h: y - y0 };
}

function readout(p: P, lang: Lang, y0: number, w: number): Block {
  const L = labels[lang];
  const fs = TYPE.body;
  const reqs = requests(p.seed);
  const parts: string[] = [];
  let y = y0;
  const r = rates(reqs, p.model, p.slice, p.cutoff);
  for (const s of [tpl(L.ucr, { a: r.allowedH, n: r.nH, r: pc(r.ucr) }), tpl(L.brr, { a: r.refusedB, n: r.nB, r: pc(r.brr) })]) {
    for (const ln of wrap(s, fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-num fig-t-strong" })); }
  }
  y += 24;
  parts.push(text(0, y, tpl(L.table, { t: fixed(p.cutoff, 2) }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 20;
  const colW = 70;
  const xB = Math.min(w, 360), xU = xB - colW;
  parts.push(text(0, y, L.colSlice, { "font-size": fs, class: "fig-t-muted" }));
  parts.push(text(xU, y, L.colUcr, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(xB, y, L.colBrr, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  y += 6;
  let worst: Slice = "en", worstU = -1;
  for (const s of ["all", ...SLICES] as Sel[]) {
    const rr = rates(reqs, p.model, s, p.cutoff);
    if (s !== "all" && rr.ucr > worstU) { worstU = rr.ucr; worst = s; }
    const on = s === p.slice;
    parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const base = y + 16;
    parts.push(el("line", { x1: 0, x2: 16, y1: base - 4, y2: base - 4, stroke: s === "all" ? C.ink : SLICE_COLOR[s], "stroke-width": s === "all" ? 2.5 : 2 }));
    parts.push(text(24, base, sliceName(L, s), { "font-size": fs, class: on ? "fig-t-strong" : undefined }));
    parts.push(text(xU, base, pc(rr.ucr), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${on ? " fig-t-strong" : ""}` }));
    parts.push(text(xB, base, pc(rr.brr), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${on ? " fig-t-strong" : ""}` }));
    parts.push(el("rect", { x: 0, y, width: xB, height: 22, fill: "transparent", "data-fig-set": `slice=${s}`, class: "fig-hit" }));
    y += 22;
  }
  parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 20;
  const all = rates(reqs, p.model, "all", p.cutoff);
  for (const ln of lines(tpl(L.worst, { s: sliceName(L, worst), r: pc(worstU), a: pc(all.ucr) }), fs, w, lang)) { parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); y += 16; }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    const h = histogram(p, lang, 0, y, w);
    parts.push(h.svg); y += h.h + 16;
    const c = operating(p, lang, 0, y, w);
    parts.push(c.svg); y += c.h + 8;
  } else {
    const hw = Math.floor(w * 0.54);
    const h = histogram(p, lang, 0, y, hw);
    const c = operating(p, lang, hw + 24, y, w - hw - 24);
    parts.push(h.svg, c.svg);
    y += Math.max(h.h, c.h) + 8;
  }
  const r = readout(p, lang, y, w);
  parts.push(r.svg);
  y += r.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "refusal-threshold",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    cutoff: { kind: "range", label: { en: "Risk-score cutoff τ", zh: "风险分数阈值 τ" }, min: 0, max: 1, step: 0.01, default: 0.5 },
    model: {
      kind: "choice", label: { en: "Model", zh: "模型" }, default: "tuned",
      options: [
        { value: "base", label: { en: "Base", zh: "基座模型" } },
        { value: "tuned", label: { en: "Safety-tuned", zh: "安全调优后" } },
      ],
    },
    slice: {
      kind: "choice", control: "buttons", label: { en: "Requests shown", zh: "显示的请求" }, default: "all",
      options: [
        { value: "all", label: { en: "All", zh: "全部" } },
        { value: "en", label: { en: "English, plain text", zh: "英语纯文本" } },
        { value: "lang", label: { en: "Other languages", zh: "其他语言" } },
        { value: "enc", label: { en: "Encoded text", zh: "编码文本" } },
        { value: "long", label: { en: "Long conversations", zh: "长对话" } },
      ],
    },
    seed: { kind: "range", label: { en: "Sample seed", zh: "样本种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
