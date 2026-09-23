// Fitting the loss surface on small runs and forecasting a large one, on real
// data: the Chinchilla training runs reconstructed by Besiroglu et al. (2024)
// from Figure 4 of Hoffmann et al. (2022). The reader picks the largest
// IsoFLOP budget whose runs enter the fit; the runs above it are held out.
// The fit is the chapter's surface
//
//   L(N, D) = E + A / N^α + B / D^β,   D = C / (6N),
//
// fitted by the Hoffmann et al. procedure (Huber loss on log L), and the figure
// draws its compute-optimal loss L*(C) = min_N L(N, C / 6N) through the runs
// and beyond them, with a bootstrap band, and the model size N* it prescribes
// at a forecast budget the reader sets. Every fit and band is precomputed by
// tools/figure-data/scaling-fit.py into data/chinchilla-runs.ts; the module
// only evaluates the closed form and interpolates the band.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log, linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, type Box, type LabelRequest } from "./lib/labels.ts";
import { fixed, sig, tpl } from "./lib/format.ts";
import { GOPHER_BUDGET, MODELS, optimum, count, sci, pow10, wrapCJK } from "./data/scaling-laws.ts";
import { BUDGETS, GRID, RUNS, FITS, type CutoffFit } from "./data/chinchilla-runs.ts";

const labels = {
  en: {
    title: "Fitting small runs and forecasting a large one",
    lossPanel: "Final loss of each run, and the fitted optimum L*(C)",
    xC: "training compute C (FLOP)",
    yL: "final training loss",
    fitted: "fitted",
    heldOut: "held out",
    lgFit: "runs in the fit",
    lgHeld: "held-out larger runs",
    lgCurve: "fitted L*(C) and 80% bootstrap band",
    target: "forecast",
    nPanel: "Forecast N*, by fitted range",
    xCut: "largest budget in the fit (FLOP)",
    yN: "N* at {c} FLOP",
    chinchilla: "Chinchilla 70B",
    gopher: "Gopher 280B",
    summary: "Fit on {k} runs up to {c} FLOP; {h} larger runs held out",
    summaryAll: "Fit on all {k} runs up to {c} FLOP; no runs held out",
    errors: "Median error of the fitted surface: {a} on fitted runs, {b} on held-out runs",
    errorsAll: "Median error of the fitted surface on the fitted runs: {a}",
    form: "L = {E} + {A}/N^{alpha} + {B}/D^{beta}",
    forecast: "Forecast at {c} FLOP: L* = {l} ({lo} to {hi}), N* = {n} ({nlo} to {nhi}), D* = {d}",
    source: "Runs: Hoffmann et al. (2022) Figure 4, reconstructed by Besiroglu et al. (2024), loss read to about 0.01; the 5 runs with the fewest tokens per parameter are excluded. Fits: the Hoffmann et al. procedure; intervals: 10th to 90th percentile of 400 bootstrap refits.",
    describe: "Fitted on {k} runs up to {c} FLOP, the surface misses {held} and forecasts N* = {n} parameters (80% bootstrap interval {nlo} to {nhi}) and L* = {l} at {t} FLOP. The fit on all runs up to 3 × 10²¹ FLOP gives N* = {nall}.",
    heldPart: "the {h} held-out runs by a median {e}",
    heldNone: "no held-out runs, since every budget is in the fit,",
  },
  zh: {
    title: "用小规模训练拟合并预测大规模训练",
    lossPanel: "每次训练的最终损失，以及拟合出的最优损失 L*(C)",
    xC: "训练算力 C（FLOP）",
    yL: "最终训练损失",
    fitted: "参与拟合",
    heldOut: "留出",
    lgFit: "参与拟合的训练",
    lgHeld: "留出的更大规模训练",
    lgCurve: "拟合的 L*(C) 与 80% 自助法区间",
    target: "预测点",
    nPanel: "预测的 N* 随拟合范围变化",
    xCut: "参与拟合的最大预算（FLOP）",
    yN: "{c} FLOP 处的 N*",
    chinchilla: "Chinchilla 70B",
    gopher: "Gopher 280B",
    summary: "用预算不超过 {c} FLOP 的 {k} 次训练拟合；留出 {h} 次更大规模的训练",
    summaryAll: "用预算不超过 {c} FLOP 的全部 {k} 次训练拟合；没有留出训练",
    errors: "拟合曲面的中位误差：参与拟合的训练为 {a}，留出训练为 {b}",
    errorsAll: "拟合曲面在参与拟合的训练上的中位误差：{a}",
    form: "L = {E} + {A}/N^{alpha} + {B}/D^{beta}",
    forecast: "{c} FLOP 处的预测：L* = {l}（{lo} 至 {hi}），N* = {n}（{nlo} 至 {nhi}），D* = {d}",
    source: "训练数据：Hoffmann 等人（2022）图 4，由 Besiroglu 等人（2024）重建，损失精度约为 0.01；每个参数对应词元最少的 5 次训练不参与拟合。拟合沿用 Hoffmann 等人的方法；区间为 400 次自助法重新拟合的第 10 至第 90 百分位。",
    describe: "用预算不超过 {c} FLOP 的 {k} 次训练拟合时，曲面{held}，在 {t} FLOP 处预测 N* = {n} 个参数（80% 自助法区间 {nlo} 至 {nhi}），L* = {l}。用 3 × 10²¹ FLOP 以内的全部训练拟合，得到 N* = {nall}。",
    heldPart: "对 {h} 次留出训练的中位误差为 {e}",
    heldNone: "没有留出训练可供检验，因为所有预算都参与了拟合",
  },
};

const CUTS = ["3e19", "6e19", "1e20", "3e20", "6e20", "1e21", "3e21"] as const;
type Cut = (typeof CUTS)[number];
type P = { fitTo: Cut; target: number };

const C_DOMAIN: [number, number] = [1e18, 1e25];
const L_DOMAIN: [number, number] = [1.8, 3.6];
const FIT = C.c1, HELD = C.c2;

const fitOf = (cut: Cut): CutoffFit => FITS.find((f) => f.budget === Number(cut))!;
const budgetIndex = (cut: Cut) => BUDGETS.findIndex((b) => b === Number(cut));

// The forecast budget; the slider's 23.76 is the Gopher budget itself.
const targetOf = (t: number) => (Math.abs(t - Math.log10(GOPHER_BUDGET)) < 0.006 ? GOPHER_BUDGET : 10 ** t);

// Linear interpolation in log10 C of a banded quantity on GRID; N in log space.
function interp(arr: readonly number[], lc: number, logSpace = false): number {
  const i = Math.max(0, Math.min(GRID.length - 2, Math.floor((lc - GRID[0]) / (GRID[1] - GRID[0]))));
  const u = (lc - GRID[i]) / (GRID[i + 1] - GRID[i]);
  if (logSpace) return 10 ** (Math.log10(arr[i]) * (1 - u) + Math.log10(arr[i + 1]) * u);
  return arr[i] * (1 - u) + arr[i + 1] * u;
}

function forecast(f: CutoffFit, c: number) {
  const o = optimum(f, c);
  const lc = Math.log10(c);
  return { ...o, lo: interp(f.lossLo, lc), hi: interp(f.lossHi, lc), nlo: interp(f.nLo, lc, true), nhi: interp(f.nHi, lc, true) };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const f = fitOf(st.p.fitTo);
  const c = targetOf(st.p.target);
  const fc = forecast(f, c);
  const all = optimum(FITS[FITS.length - 1], c);
  return tpl(L.describe, {
    k: f.fitRuns, c: sci(f.budget), t: sci(c),
    held: f.errHeld == null ? L.heldNone : tpl(L.heldPart, { h: f.heldRuns, e: fixed(f.errHeld, 3) }),
    n: count(fc.N), nlo: count(fc.nlo), nhi: count(fc.nhi), l: fixed(fc.L, 3), nall: count(all.N),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const f = fitOf(p.fitTo);
  const k = budgetIndex(p.fitTo);
  const c = targetOf(p.target);
  const fc = forecast(f, c);
  const parts: string[] = [];
  const clip = `${st.uid}-clip`;

  // ---- geometry
  const gap = 26;
  const wA = narrow ? w : Math.round(w * 0.6);
  const xA0 = 36, xA1 = wA - 6;
  const topA = 44, hA = narrow ? 210 : 230, botA = topA + hA;
  const bx = narrow ? 0 : wA + gap;
  const xB0 = bx + 40, xB1 = w - 8;

  // ---- panel A: runs, the fitted optimum, and the band
  const x = log(C_DOMAIN, [xA0, xA1]);
  const y = linear(L_DOMAIN, [botA, topA]);
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: xA0, y: topA, width: xA1 - xA0, height: hA }))));
  parts.push(text(0, 14, L.lossPanel, { "font-size": TYPE.label, class: "fig-t-strong" }));
  // The fitted range: up to halfway (in log C) to the next budget.
  const edge = k < BUDGETS.length - 1 ? Math.sqrt(BUDGETS[k] * BUDGETS[k + 1]) : Math.max(...RUNS.map((r) => r[1])) * 1.2;
  const ex = x(edge);
  parts.push(el("rect", { x: xA0, y: topA, width: ex - xA0, height: hA, fill: C.panel }));
  parts.push(axis({ scale: x, orient: "bottom", at: botA, grid: [topA, botA], minor: true, title: L.xC, format: pow10, size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: xA0, grid: [xA0, xA1], ticks: y.ticks(6), title: L.yL, format: (v) => fixed(v, 1), size: fs }));
  const obstacles: Box[] = [];
  const clipped: string[] = [];
  // Band.
  const lo = GRID.map((lc, i) => [x(10 ** lc), y(f.lossLo[i])] as [number, number]).filter(([px]) => px <= xA1 + 1);
  const hi = GRID.map((lc, i) => [x(10 ** lc), y(f.lossHi[i])] as [number, number]).filter(([px]) => px <= xA1 + 1);
  clipped.push(el("path", { d: linePath([...lo, ...hi.reverse()]) + "Z", fill: FIT, "fill-opacity": 0.2 }));
  // The point-estimate optimum: solid over the fitted range, dashed beyond it.
  const curve = (c0: number, c1: number) => {
    const out: Array<[number, number]> = [];
    for (let lc = Math.log10(c0); lc <= Math.log10(c1) + 1e-9; lc += 0.05) out.push([x(10 ** lc), y(optimum(f, 10 ** lc).L)]);
    return out;
  };
  const inside = curve(C_DOMAIN[0], Math.min(edge, C_DOMAIN[1]));
  const beyond = curve(Math.min(edge, C_DOMAIN[1]), C_DOMAIN[1]);
  clipped.push(el("path", { d: linePath(inside), fill: "none", stroke: FIT, "stroke-width": 2.4 }));
  clipped.push(el("path", { d: linePath(beyond), fill: "none", stroke: FIT, "stroke-width": 2.4, "stroke-dasharray": "6 4" }));
  parts.push(g({ "clip-path": `url(#${clip})` }, ...clipped));
  obstacles.push(...lineObstacles([...inside, ...beyond]));
  // Runs: filled if fitted, hollow if held out; the five excluded runs are not drawn.
  for (const r of RUNS) {
    if (r[4]) continue;
    const px = x(r[1]), py = y(r[2]);
    if (py < topA || py > botA) continue;
    const held = r[3] > k;
    parts.push(held
      ? el("circle", { cx: px, cy: py, r: 2.4, fill: C.paper, stroke: HELD, "stroke-width": 1.3 })
      : el("circle", { cx: px, cy: py, r: 2.2, fill: FIT, "fill-opacity": 0.75 }));
    obstacles.push({ x0: px - 3, y0: py - 3, x1: px + 3, y1: py + 3 });
  }
  // Forecast: a vertical guide, the point estimate, and its interval.
  const tx = x(c);
  parts.push(el("line", { x1: tx, x2: tx, y1: topA, y2: botA, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  obstacles.push(...lineObstacles([[tx, topA], [tx, botA]]));
  const ty = y(fc.L), tlo = y(fc.lo), thi = y(fc.hi);
  parts.push(el("line", { x1: tx, x2: tx, y1: tlo, y2: thi, stroke: C.ink, "stroke-width": 2 }));
  for (const yy of [tlo, thi]) parts.push(el("line", { x1: tx - 5, x2: tx + 5, y1: yy, y2: yy, stroke: C.ink, "stroke-width": 2 }));
  parts.push(el("circle", { cx: tx, cy: ty, r: 5, fill: FIT, stroke: C.paper, "stroke-width": 2 }));
  obstacles.push({ x0: tx - 7, y0: Math.min(thi, ty - 6), x1: tx + 7, y1: Math.max(tlo, ty + 6) });
  const reqs: LabelRequest[] = [
    { x: tx, y: ty, text: `L* = ${fixed(fc.L, 3)}`, size: fs, sides: ["above-left", "above", "left", "above-right"], gap: 14, priority: 5, attrs: { class: "fig-t-halo fig-t-num" } },
  ];
  // Region names at the top of the plot.
  const regionY = topA + 14;
  if (ex - xA0 > 60) reqs.push({ x: xA0 + 6, y: regionY - fs * 0.35, text: L.fitted, size: fs, sides: ["right"], gap: 0, priority: 4, attrs: { class: "fig-t-muted" } });
  if (k < BUDGETS.length - 1 && xA1 - ex > 60) reqs.push({ x: ex + 6, y: regionY - fs * 0.35, text: L.heldOut, size: fs, sides: ["right"], gap: 0, priority: 4, attrs: { class: "fig-t-muted" } });
  const placed = placeLabels(reqs, { x0: xA0 + 2, y0: topA + 2, x1: xA1 - 2, y1: botA - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  const lgA = legend([
    { label: L.lgFit, swatch: { kind: "dot", fill: FIT } },
    { label: L.lgHeld, swatch: { kind: "rect", fill: C.paper, stroke: HELD } },
    { label: L.lgCurve, swatch: { kind: "rect", fill: FIT, opacity: 0.35 } },
  ], 0, botA + axisHeight(true, fs) + 6, wA, fs);
  parts.push(lgA.svg);
  const botLgA = botA + axisHeight(true, fs) + 6 + lgA.height;

  // ---- panel B: the forecast N* at the target from each fitted range
  const topB = narrow ? botLgA + 44 : topA;
  const hB = narrow ? 170 : hA;
  const botB = topB + hB;
  const all = FITS.map((ff) => forecast(ff, c));
  const lcTarget = Math.log10(c);
  const showModels = Math.abs(lcTarget - Math.log10(GOPHER_BUDGET)) < 0.1;
  const vals = [...all.flatMap((a) => [a.nlo, a.nhi, a.N]), ...(showModels ? [MODELS.chinchilla.N, MODELS.gopher.N] : [])];
  const nLo = 10 ** Math.floor(Math.log10(Math.min(...vals)) - 0.05);
  const nHi = 10 ** Math.ceil(Math.log10(Math.max(...vals)) + 0.05);
  const xb = log([BUDGETS[2] / 1.6, BUDGETS[8] * 1.6], [xB0, xB1]);
  const yb = log([nLo, nHi], [botB, topB]);
  const nTicks: number[] = [];
  for (let e = Math.log10(nLo); e <= Math.log10(nHi) + 1e-9; e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= nLo && v <= nHi) nTicks.push(v); }
  parts.push(text(bx, topB - 30, L.nPanel, { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(axis({ scale: xb, orient: "bottom", at: botB, grid: [topB, botB], ticks: [...BUDGETS.slice(2)], title: L.xCut, format: (v) => sci(v, 1), size: fs }));
  parts.push(axis({ scale: yb, orient: "left", at: xB0, grid: [xB0, xB1], ticks: nTicks, title: tpl(L.yN, { c: sci(c) }), format: count, size: fs }));
  const bObs: Box[] = [];
  const bReqs: LabelRequest[] = [];
  if (showModels) {
    for (const key of ["chinchilla", "gopher"] as const) {
      const yy = yb(MODELS[key].N);
      parts.push(el("line", { x1: xB0, x2: xB1, y1: yy, y2: yy, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "5 3" }));
      bObs.push(...lineObstacles([[xB0, yy], [xB1, yy]]));
      // Gopher's line runs above the points, Chinchilla's below them.
      const right = key === "gopher";
      bReqs.push({ x: right ? xB1 - 2 : xB0 + 2, y: yy, text: L[key], size: fs, sides: right ? ["above-left", "below-left"] : ["below-right", "above-right"], gap: 4, priority: 1, attrs: { class: "fig-t-halo fig-t-soft" } });
    }
  }
  // Point estimates joined in order, so the drift reads as one path.
  const pts = FITS.map((ff, i) => [xb(ff.budget), yb(all[i].N)] as [number, number]);
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink3, "stroke-width": 1 }));
  FITS.forEach((ff, i) => {
    const px = xb(ff.budget);
    const sel = ff.budget === f.budget;
    const colr = sel ? FIT : C.ink2;
    parts.push(el("line", { x1: px, x2: px, y1: yb(all[i].nlo), y2: yb(all[i].nhi), stroke: colr, "stroke-width": sel ? 2.5 : 1.5 }));
    for (const v of [all[i].nlo, all[i].nhi]) parts.push(el("line", { x1: px - 4, x2: px + 4, y1: yb(v), y2: yb(v), stroke: colr, "stroke-width": sel ? 2.5 : 1.5 }));
    parts.push(el("circle", { cx: px, cy: pts[i][1], r: sel ? 5.5 : 3.5, fill: sel ? FIT : C.paper, stroke: sel ? C.paper : C.ink2, "stroke-width": sel ? 2 : 1.5 }));
    parts.push(el("rect", { x: px - 12, y: topB, width: 24, height: hB, fill: "transparent", "data-fig-set": `fitTo=${CUTS[i]}`, class: "fig-hit" }));
    bObs.push({ x0: px - 6, y0: yb(all[i].nhi) - 2, x1: px + 6, y1: yb(all[i].nlo) + 2 });
  });
  const si = FITS.findIndex((ff) => ff.budget === f.budget);
  bReqs.push({ x: pts[si][0], y: pts[si][1], text: count(fc.N), size: fs, sides: ["right", "left", "above-right", "below-right"], gap: 9, priority: 3, attrs: { class: "fig-t-halo fig-t-num" } });
  const bPlaced = placeLabels(bReqs, { x0: xB0 + 2, y0: topB + 2, x1: xB1 - 2, y1: botB - 2 }, bObs);
  parts.push(drawLabels(bPlaced.placed));

  // ---- readout
  const leftBottom = narrow ? 0 : botLgA;
  let yy = Math.max(botB + axisHeight(true, fs), leftBottom) + 26;
  const rp: string[] = [];
  const line = (s: string, cls: string, size: number, after: number) => {
    for (const part of wrapCJK(s, size, w)) { rp.push(text(0, yy, part, { "font-size": size, class: cls })); yy += size + 5; }
    yy += after - size - 5;
  };
  const allRuns = f.heldRuns === 0;
  line(tpl(allRuns ? L.summaryAll : L.summary, { k: f.fitRuns, c: sci(f.budget), h: f.heldRuns }), "fig-t-strong", TYPE.body, 20);
  line(allRuns ? tpl(L.errorsAll, { a: fixed(f.errFit, 3) }) : tpl(L.errors, { a: fixed(f.errFit, 3), b: fixed(f.errHeld ?? 0, 3) }), "", TYPE.body, 20);
  line(tpl(L.forecast, { c: sci(c), l: fixed(fc.L, 3), lo: fixed(fc.lo, 3), hi: fixed(fc.hi, 3), n: count(fc.N), nlo: count(fc.nlo), nhi: count(fc.nhi), d: count(fc.D) }), "fig-t-num", TYPE.body, 20);
  line(tpl(L.form, { E: fixed(f.E, 3), A: sig(f.A, 4), alpha: fixed(f.alpha, 3), B: sig(f.B, 4), beta: fixed(f.beta, 3) }), "fig-t-muted fig-t-num", fs, fs + 9);
  line(L.source, "fig-t-muted", fs, 0);
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "scaling-fit-extrapolation",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    fitTo: {
      kind: "choice", control: "buttons", label: { en: "Fit on runs up to", zh: "拟合所用训练的最大预算" }, default: "1e20",
      options: CUTS.map((cut) => ({ value: cut, label: { en: sci(Number(cut), 1), zh: sci(Number(cut), 1) } })),
    },
    target: {
      kind: "range", label: { en: "Forecast budget, log₁₀ FLOP", zh: "预测预算，log₁₀ FLOP" }, min: 21.5, max: 25, step: 0.01, default: 23.76,
      marks: [{ value: 23.76, label: { en: "Chinchilla and Gopher", zh: "Chinchilla 与 Gopher" } }],
    },
  },
  render,
  describe,
});
