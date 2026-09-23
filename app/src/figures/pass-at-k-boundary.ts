// pass@k on a synthetic benchmark, before and after RL, computed from the
// per-problem success rates rather than drawn as free curves.
//
// Each of 100 problems has a per-sample success rate p_i under the base model:
// ten are never solved (p_i = 0) and ninety follow logistic quantiles with a
// median of σ(−2.5) ≈ 0.08, so many problems are solved only rarely. For an
// independent sampler the chapter's pass@k = 1 − (1 − p)^k holds per problem,
// and the benchmark score is its mean:
//
//   pass@k = (1/N) Σ_i [1 − (1 − p_i)^k].
//
// The RL model is illustrative. Training with groups of G rollouts reinforces
// a problem only when its group is mixed, with probability
// m_i = 1 − p_i^G − (1 − p_i)^G (the group-relative signal of the previous
// section), and a problem whose group holds no success, with probability
// (1 − p_i)^G, loses ground as updates elsewhere concentrate probability on
// paths the sampler already favors. At training progress s ∈ [0, 1]:
//
//   logit p_i' = logit p_i + s · (4 · m_i − 1.5 · (1 − p_i)^G).
//
// Two options change the picture. `reach` lets RL solve half of the
// never-solved problems, p' = σ(−7 + 4s), standing in for coverage expansion.
// `strict` grades the reasoning path as CoT-pass@k does: a success counts only
// if its chain is valid, and a share g_i = 0.6 · (1 − p_i)^8 of the correct
// answers on problem i (computed from the base rate, the same for both models)
// is assumed to come from invalid reasoning, larger where the base model
// rarely succeeds. Every number here is synthetic.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const N_NEVER = 10;
const N_SOLVED = 90;
const N = N_NEVER + N_SOLVED;
const K_MAX = 1024;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

const BASE: number[] = [
  ...Array.from({ length: N_NEVER }, () => 0),
  ...Array.from({ length: N_SOLVED }, (_, i) => { const q = (i + 0.5) / N_SOLVED; return sigmoid(-2.5 + 1.8 * Math.log(q / (1 - q))); }),
];

const lucky = (pBase: number) => 0.6 * (1 - pBase) ** 8;

type P = { train: number; G: 4 | 8 | 16 | 64; reach: boolean; strict: boolean; k: number };

function rates(p: P) {
  const s = p.train / 100;
  const rl = BASE.map((b, i) => {
    if (b === 0) return p.reach && i % 2 === 0 ? sigmoid(-7 + 4 * s) : 0;
    const m = 1 - b ** p.G - (1 - b) ** p.G;
    const none = (1 - b) ** p.G;
    return sigmoid(logit(b) + s * (4 * m - 1.5 * none));
  });
  const grade = (ps: number[]) => (p.strict ? ps.map((v, i) => v * (1 - lucky(BASE[i]))) : ps);
  return { base: grade(BASE), rl: grade(rl), baseAnswer: BASE, rlAnswer: rl };
}

const passAt = (ps: number[], k: number) => ps.reduce((a, v) => a + 1 - (1 - v) ** k, 0) / ps.length;

// First k (on a fine log grid) where the base curve rises above the RL curve.
function crossing(base: number[], rl: number[]): number | null {
  if (passAt(base, 1) >= passAt(rl, 1)) return null;
  let prev = 1;
  for (let e = 0; e <= 1; e += 1 / 400) {
    const k = K_MAX ** e;
    if (passAt(base, k) > passAt(rl, k)) {
      // Bisect between the last RL-leading k and this one.
      let lo = prev, hi = k;
      for (let i = 0; i < 30; i++) { const mid = Math.sqrt(lo * hi); if (passAt(base, mid) > passAt(rl, mid)) hi = mid; else lo = mid; }
      return hi;
    }
    prev = k;
  }
  return null;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "pass@k before and after RL, from per-problem success rates",
    hist: "100 problems by success rate p",
    base: "base model",
    rl: "after RL",
    never: "never",
    histX: "success rate per sample p (log scale)",
    oneOverK: "p = 1/k",
    curves: "pass@k = mean of 1 − (1 − p_i)^k",
    curvesStrict: "CoT-pass@k: valid reasoning only",
    curveX: "samples per problem k",
    answerOnly: "answer-only pass@k",
    cross: "cross at k ≈ {k}",
    atK: "At k = {k}: base {b}, after RL {r}",
    at1: "pass@1, the mean of p_i: base {b}, after RL {r}",
    crossLine: "The curves cross at k ≈ {k}: below it RL leads, above it the base model leads.",
    noCross: "The RL curve stays at or above the base curve up to k = 1024.",
    wins: "At k = {k}, RL leads on {r} problems and the base model on {b}; the base model's lead comes from problems it solves with p ≤ {p}.",
    winsNone: "At k = {k}, RL leads on {r} problems and the base model on none.",
    never10: "Never solved: 10 of 100 problems before RL, {n} after.",
    describe: "{mode} after {s}% of RL training with {G} rollouts per prompt: pass@1 rises from {b1} to {r1}; at k = {k} the base model scores {bk} and the RL model {rk}. {cross}",
    modeAnswer: "Answer-only pass@k",
    modeStrict: "CoT-pass@k",
  },
  zh: {
    title: "强化学习前后的 pass@k：由每道题的成功率算出",
    hist: "100 道题按成功率 p 分布",
    base: "基座模型",
    rl: "强化学习后",
    never: "从未",
    histX: "单次采样成功率 p（对数刻度）",
    oneOverK: "p = 1/k",
    curves: "pass@k = 1 − (1 − p_i)^k 的平均",
    curvesStrict: "CoT-pass@k：只计推理有效的成功",
    curveX: "每题采样数 k",
    answerOnly: "只看答案的 pass@k",
    cross: "在 k ≈ {k} 处相交",
    atK: "k = {k} 时：基座 {b}，强化学习后 {r}",
    at1: "pass@1，即 p_i 的平均：基座 {b}，强化学习后 {r}",
    crossLine: "两条曲线在 k ≈ {k} 处相交：此前强化学习领先，此后基座模型领先。",
    noCross: "直到 k = 1024，强化学习曲线都不低于基座曲线。",
    wins: "k = {k} 时，强化学习在 {r} 道题上领先，基座模型在 {b} 道题上领先；基座的领先来自它成功率不超过 {p} 的题。",
    winsNone: "k = {k} 时，强化学习在 {r} 道题上领先，基座模型没有领先的题。",
    never10: "从未解出的题：强化学习前 10 道，之后 {n} 道。",
    describe: "{mode}，强化学习训练进度 {s}%，每个提示 {G} 条采样：pass@1 从 {b1} 升到 {r1}；k = {k} 时基座模型得 {bk}，强化学习模型得 {rk}。{cross}",
    modeAnswer: "只看答案的 pass@k",
    modeStrict: "CoT-pass@k",
  },
};
type L = typeof labels.en;

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", ".": "·" };
const pow10 = (e: number) => (e === 0 ? "1" : `10${String(e).split("").map((c) => SUP[c]).join("")}`);
const kText = (k: number) => String(Math.round(k));
const score = (v: number) => fixed(v, 2);

// Half-decade bins from 10⁻⁵ to 1; rates below 10⁻⁵ fall in the first bin.
const LO = -5;
const BIN = 0.5;
const NBIN = (0 - LO) / BIN;
function histogram(ps: number[]): { never: number; bins: number[] } {
  const bins = new Array(NBIN).fill(0);
  let never = 0;
  for (const v of ps) {
    if (v <= 0) { never++; continue; }
    const i = Math.min(NBIN - 1, Math.max(0, Math.floor((Math.log10(v) - LO) / BIN)));
    bins[i]++;
  }
  return { never, bins };
}

// ---------------------------------------------------------------- drawing

// One legend for both panels: each series is a histogram color and a curve
// style, so the swatch shows both.
function renderLegend(p: P, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const items: Array<{ label: string; fill?: string; stroke: string; dash?: string }> = [
    { label: Lx.base, fill: C.c1, stroke: C.c1, dash: "5 3" },
    { label: Lx.rl, fill: C.c2, stroke: C.c2 },
  ];
  if (p.strict) items.push({ label: Lx.answerOnly, stroke: C.ink3, dash: "1 3" });
  const parts: string[] = [];
  let x = x0, y = y0 + 12;
  for (const it of items) {
    const sw = it.fill ? 40 : 22;
    const iw = sw + 6 + textWidth(it.label, TYPE.body);
    if (x > x0 && x + iw > x0 + w) { x = x0; y += 20; }
    if (it.fill) parts.push(el("rect", { x, y: y - 10, width: 12, height: 11, rx: 2, fill: it.fill }));
    const lx = it.fill ? x + 16 : x;
    parts.push(el("line", { x1: lx, x2: lx + 22, y1: y - 4, y2: y - 4, stroke: it.stroke, "stroke-width": 2, "stroke-dasharray": it.dash }));
    parts.push(text(x + sw + 6, y, it.label, { "font-size": TYPE.body }));
    x += iw + 18;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: y - y0 + 8 };
}

function title(s: string, x0: number, y0: number, w: number, parts: string[]): number {
  const lines = wrap(s, TYPE.label, w);
  lines.forEach((ln, i) => parts.push(text(x0, y0 + 14 + i * 17, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  return lines.length * 17;
}

const HALF = 70;
const MAX_COUNT = 60; // the tallest bin any setting reaches is 59

function renderHist(p: P, r: ReturnType<typeof rates>, x0: number, y0: number, w: number, Lx: L, titleH: number): { svg: string; h: number } {
  const parts: string[] = [];
  title(Lx.hist, x0, y0, w, parts);
  const top = y0 + titleH + 26;
  const mid = top + HALF;
  const neverW = 30;
  const gx0 = x0 + neverW + 12;
  const x = linear([LO, 0], [gx0, x0 + w - 4]);
  const hb = histogram(r.base);
  const hr = histogram(r.rl);
  const hy = (n: number) => (Math.min(n, MAX_COUNT) / MAX_COUNT) * (HALF - 16);
  // Rates unlikely to be seen within k samples: left of p = 1/k.
  const xc = x(Math.max(LO, Math.log10(1 / p.k)));
  parts.push(el("rect", { x: gx0, y: top, width: Math.max(0, xc - gx0), height: 2 * HALF, fill: C.ink, "fill-opacity": 0.06 }));
  const bw = x(LO + BIN) - x(LO) - 2;
  const col = (cx: number, width: number, up: number, down: number) => {
    if (up) {
      parts.push(el("rect", { x: cx, y: mid - hy(up), width, height: hy(up), fill: C.c1 }));
      parts.push(text(cx + width / 2, mid - hy(up) - 4, up, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
    }
    if (down) {
      parts.push(el("rect", { x: cx, y: mid, width, height: hy(down), fill: C.c2 }));
      parts.push(text(cx + width / 2, mid + hy(down) + 13, down, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
    }
  };
  for (let i = 0; i < NBIN; i++) col(x(LO + i * BIN) + 1, bw, hb.bins[i], hr.bins[i]);
  // The never-solved column sits apart from the log axis.
  col(x0 + 2, neverW - 4, hb.never, hr.never);
  if (!hr.never) parts.push(text(x0 + neverW / 2, mid + 13, 0, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: mid, y2: mid, stroke: C.rule, "stroke-width": 1 }));
  parts.push(el("line", { x1: xc, x2: xc, y1: top - 16, y2: top + 2 * HALF, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const lbl = Lx.oneOverK;
  const lw = textWidth(lbl, TYPE.body);
  const lx = xc + 4 + lw > x0 + w ? xc - 4 - lw : xc + 4;
  parts.push(text(lx, top - 6, lbl, { "font-size": TYPE.body, class: "fig-t-muted" }));
  // Axis: decades as powers of ten, and the never-solved column's name.
  const ay = top + 2 * HALF + 2;
  parts.push(el("line", { x1: gx0, x2: x0 + w - 4, y1: ay, y2: ay, stroke: C.rule, "stroke-width": 1 }));
  const sparse = w < 300;
  for (const e of [-5, -4, -3, -2, -1, 0]) {
    parts.push(el("line", { x1: x(e), x2: x(e), y1: ay, y2: ay + 5, stroke: C.rule, "stroke-width": 1 }));
    if (sparse && (e === -5 || e === -3 || e === -1)) continue;
    parts.push(text(x(e), ay + 19, pow10(e), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(text(x0 + neverW / 2, ay + 19, Lx.never, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text((gx0 + x0 + w) / 2, ay + 38, Lx.histX, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  return { svg: g({ class: "fig-hist" }, ...parts), h: ay + 44 - y0 };
}

function renderCurves(p: P, r: ReturnType<typeof rates>, x0: number, y0: number, w: number, Lx: L, titleH: number): { svg: string; h: number } {
  const parts: string[] = [];
  title(p.strict ? Lx.curvesStrict : Lx.curves, x0, y0, w, parts);
  const left = x0 + 36;
  const right = x0 + w - 10;
  const top = y0 + titleH + 12;
  const plotH = 2 * HALF + 14;
  const bottom = top + plotH;
  const x = log([1, K_MAX], [left, right]);
  const y = linear([0, 1], [bottom, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: [1, 4, 16, 64, 256, 1024], grid: [top, bottom], title: Lx.curveX, size: TYPE.body, format: kText }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, right], size: TYPE.body, format: (v) => String(v) }));
  const series = (ps: number[]) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) { const k = K_MAX ** (i / 120); pts.push([x(k), y(passAt(ps, k))]); }
    return pts;
  };
  if (p.strict) {
    for (const ps of [r.baseAnswer, r.rlAnswer]) parts.push(el("path", { d: linePath(series(ps)), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "1 3" }));
  }
  parts.push(el("path", { d: linePath(series(r.base)), fill: "none", stroke: C.c1, "stroke-width": 2, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(series(r.rl)), fill: "none", stroke: C.c2, "stroke-width": 2 }));
  // Selected k.
  const xk = x(p.k);
  parts.push(el("line", { x1: xk, x2: xk, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  for (const [ps, c] of [[r.base, C.c1], [r.rl, C.c2]] as const) {
    parts.push(el("circle", { cx: xk, cy: y(passAt(ps, p.k)), r: 4, fill: c, stroke: C.paper, "stroke-width": 1.5 }));
  }
  const kc = crossing(r.base, r.rl);
  if (kc) {
    const cx = x(kc), cy = y(passAt(r.rl, kc));
    parts.push(el("circle", { cx, cy, r: 5, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    const lbl = tpl(Lx.cross, { k: kText(kc) });
    const lw = textWidth(lbl, TYPE.body);
    // Well below the crossing: both curves rise to the right, so the space
    // under them stays clear.
    const tx = Math.min(Math.max(cx - lw / 2, left + 4), right - lw);
    const ty = Math.min(cy + 36, bottom - 8);
    parts.push(el("line", { x1: cx, x2: cx, y1: cy + 6, y2: ty - 13, stroke: C.ink3, "stroke-width": 1 }));
    parts.push(text(tx, ty, lbl, { "font-size": TYPE.body, class: "fig-t-halo" }));
  }
  return { svg: g({ class: "fig-curves" }, ...parts), h: bottom + axisHeight(true, TYPE.body) - y0 };
}

function stats(p: P, r: ReturnType<typeof rates>) {
  const k = p.k;
  let rlWins = 0, baseWins = 0, maxP = 0;
  for (let i = 0; i < N; i++) {
    const b = 1 - (1 - r.base[i]) ** k, q = 1 - (1 - r.rl[i]) ** k;
    if (q > b + 0.005) rlWins++;
    else if (b > q + 0.005) { baseWins++; maxP = Math.max(maxP, r.base[i]); }
  }
  const never = r.rl.filter((v) => v === 0).length;
  return { rlWins, baseWins, maxP, never, kc: crossing(r.base, r.rl) };
}

function renderReadout(p: P, r: ReturnType<typeof rates>, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const s = stats(p, r);
  const k = kText(p.k);
  const lines: Array<[string, string]> = [
    [tpl(Lx.atK, { k, b: score(passAt(r.base, p.k)), r: score(passAt(r.rl, p.k)) }), "fig-t-strong fig-t-num"],
    [tpl(Lx.at1, { b: score(passAt(r.base, 1)), r: score(passAt(r.rl, 1)) }), "fig-t-num"],
    [s.kc ? tpl(Lx.crossLine, { k: kText(s.kc) }) : Lx.noCross, "fig-t-num"],
    [s.baseWins ? tpl(Lx.wins, { k, r: s.rlWins, b: s.baseWins, p: s.maxP >= 0.01 ? fixed(s.maxP, 2) : sig(s.maxP, 2) }) : tpl(Lx.winsNone, { k, r: s.rlWins }), "fig-t-num"],
    [tpl(Lx.never10, { n: s.never }), "fig-t-num"],
  ];
  const parts: string[] = [];
  let y = y0;
  for (const [ln, cls] of lines) {
    for (const part of wrap(ln, TYPE.body, w)) { y += 17; parts.push(text(x0, y, part, { "font-size": TYPE.body, class: cls })); }
    y += 2;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

// k as the integer the readout prints; the log slider snaps to three
// significant figures, which can leave a fraction.
const withK = (p: P): P => ({ ...p, k: Math.max(1, Math.round(p.k)) });

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = withK(st.p);
  const r = rates(p);
  const s = stats(p, r);
  return tpl(Lx.describe, {
    mode: p.strict ? Lx.modeStrict : Lx.modeAnswer, s: Math.round(p.train), G: p.G,
    b1: score(passAt(r.base, 1)), r1: score(passAt(r.rl, 1)), k: kText(p.k), bk: score(passAt(r.base, p.k)), rk: score(passAt(r.rl, p.k)),
    cross: s.kc ? tpl(Lx.crossLine, { k: kText(s.kc) }) : Lx.noCross,
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = withK(st.p);
  const w = st.w;
  const narrow = w < 480;
  const r = rates(p);
  const parts: string[] = [];
  const lg = renderLegend(p, 0, 0, w, Lx);
  parts.push(lg.svg);
  let y = lg.h + 10;
  if (narrow) {
    const th = (s: string) => wrap(s, TYPE.label, w).length * 17;
    const h = renderHist(p, r, 0, y, w, Lx, th(Lx.hist)); parts.push(h.svg); y += h.h + 18;
    const c = renderCurves(p, r, 0, y, w, Lx, th(p.strict ? Lx.curvesStrict : Lx.curves)); parts.push(c.svg); y += c.h + 8;
  } else {
    const gap = 28;
    const hw = Math.floor((w - gap) * 0.47);
    const cw = w - hw - gap;
    // Both panels start their plots at the same height.
    const titleH = Math.max(wrap(Lx.hist, TYPE.label, hw).length, wrap(p.strict ? Lx.curvesStrict : Lx.curves, TYPE.label, cw).length) * 17;
    const h = renderHist(p, r, 0, y, hw, Lx, titleH);
    const c = renderCurves(p, r, hw + gap, y, cw, Lx, titleH);
    parts.push(h.svg, c.svg);
    y += Math.max(h.h, c.h) + 8;
  }
  const ro = renderReadout(p, r, 0, y, w, Lx);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "pass-at-k-boundary",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    train: {
      kind: "range", label: { en: "RL training", zh: "强化学习训练进度" }, unit: { en: "% of the run", zh: "%" }, min: 0, max: 100, step: 5, default: 100,
      marks: [{ value: 0, label: { en: "base model", zh: "基座模型" } }],
    },
    G: {
      kind: "choice", label: { en: "Rollouts per prompt in training", zh: "训练时每个提示的采样数" }, default: 8,
      options: [4, 8, 16, 64].map((v) => ({ value: v as 4 | 8 | 16 | 64, label: { en: String(v), zh: String(v) } })),
    },
    k: {
      kind: "range", scale: "log", label: { en: "Samples per problem k", zh: "每题采样数 k" }, min: 1, max: 1024, default: 256,
    },
    reach: { kind: "toggle", label: { en: "RL also solves some never-solved problems", zh: "强化学习也解出部分从未解出的题" }, default: false },
    strict: { kind: "toggle", label: { en: "Grade the reasoning path too (CoT-pass@k)", zh: "同时评判推理路径（CoT-pass@k）" }, default: false },
  },
  render,
  describe,
});
