// Two fits of the compute-only scaling law on the same measured points, and
// how far their forecasts separate outside the measured range. The law is the
// field-map chapter's
//
//   L(C) = L∞ + A C^(−α),
//
// fitted twice: with L∞ = 0 (the pure power law of Kaplan et al. 2020) and
// with the floor L∞ fitted. The points are the compute frontier of the
// Chinchilla runs reconstructed by Besiroglu et al. (2024) from Figure 4 of
// Hoffmann et al. (2022): at each of nine IsoFLOP budgets, the lowest loss of a
// parabola in log N through the runs at that budget. The reader picks the
// largest budget in the fit (the larger ones are held out) and a forecast
// budget. Every fit and band is precomputed by
// tools/figure-data/compute-law-fit.py into data/compute-law-frontier.ts; the
// module evaluates the closed form and interpolates the band.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box, type LabelRequest } from "./lib/labels.ts";
import { fixed, sig, tpl } from "./lib/format.ts";
import { sci, pow10 } from "./lib/notation.ts";
import { wrapLines } from "./lib/wrap-lines.ts";
import { GOPHER_BUDGET } from "./data/scaling-laws.ts";
import { GRID, POINTS, FITS, type CutoffFit, type FormFit } from "./data/compute-law-frontier.ts";

const labels = {
  en: {
    title: "Two fits of the compute law, inside and outside the measured range",
    panel: "Lowest loss at each compute budget, and two fits of L(C)",
    xC: "training compute C (FLOP)",
    yL: "loss L (log scale)",
    fitted: "fitted budgets",
    heldOut: "held out",
    pure: "pure power law, L∞ = 0",
    floor: "fitted floor L∞",
    lgFit: "frontier point in the fit",
    lgHeld: "held-out point",
    lgBand: "80% bootstrap band",
    floorLine: "L∞ = {v}",
    summary: "Fit on the {k} budgets up to {c} FLOP; {h:larger budget/larger budgets} held out",
    summaryAll: "Fit on all {k} budgets up to {c} FLOP; nothing held out",
    coefPure: "A = {A}, α = {a}",
    coefFloor: "L∞ = {Li}, A = {A}, α = {a}",
    atPure: "at {c} FLOP: L = A C^−α = {v}",
    atFloor: "at {c} FLOP: L = L∞ + A C^−α = {Li} + {r} = {v}",
    held: "80% band {lo} to {hi}; median error on the held-out budgets {e}",
    heldNone: "80% band {lo} to {hi}; no held-out budgets to check",
    gap: "The two fits differ by at most {a} over the fitted budgets and by {b} at {c} FLOP.",
    source: "Points: the lowest loss of a parabola through the runs at each IsoFLOP budget, from Hoffmann et al. (2022) Figure 4 as reconstructed by Besiroglu et al. (2024), loss read to about 0.01. Bands: 10th to 90th percentile over 1,000 bootstrap resamples of the runs.",
    describe: "Fitted on the {k} budgets up to {c} FLOP, the pure power law forecasts L = {vp} at {t} FLOP and the fit with a floor L∞ = {li} forecasts {vf}, a gap of {b}; over the fitted budgets they differ by at most {a}. {held}",
    heldDesc: "On the {h:held-out budget/held-out budgets} the median error is {ep} for the pure law and {ef} with the floor.",
    heldDescNone: "No budgets are held out.",
  },
  zh: {
    title: "算力扩展律的两种拟合：测量范围之内与之外",
    panel: "各算力预算下的最低损失，以及 L(C) 的两种拟合",
    xC: "训练算力 C（FLOP）",
    yL: "损失 L（对数坐标）",
    fitted: "参与拟合的预算",
    heldOut: "留出",
    pure: "纯幂律，L∞ = 0",
    floor: "拟合下限 L∞",
    lgFit: "参与拟合的前沿点",
    lgHeld: "留出的前沿点",
    lgBand: "80% 自助法区间",
    floorLine: "L∞ = {v}",
    summary: "用不超过 {c} FLOP 的 {k} 个预算拟合；留出 {h} 个更大的预算",
    summaryAll: "用不超过 {c} FLOP 的全部 {k} 个预算拟合；没有留出预算",
    coefPure: "A = {A}，α = {a}",
    coefFloor: "L∞ = {Li}，A = {A}，α = {a}",
    atPure: "{c} FLOP 处：L = A C^−α = {v}",
    atFloor: "{c} FLOP 处：L = L∞ + A C^−α = {Li} + {r} = {v}",
    held: "80% 区间 {lo} 至 {hi}；留出预算上的中位误差 {e}",
    heldNone: "80% 区间 {lo} 至 {hi}；没有留出预算可供检验",
    gap: "在参与拟合的预算上，两种拟合最多相差 {a}；在 {c} FLOP 处相差 {b}。",
    source: "数据点：每个等算力预算下，用抛物线拟合该预算的各次训练，取其最低损失；训练数据来自 Hoffmann 等人（2022）图 4，由 Besiroglu 等人（2024）重建，损失精度约为 0.01。区间：对训练结果做 1,000 次自助法重采样，取第 10 至第 90 百分位。",
    describe: "用不超过 {c} FLOP 的 {k} 个预算拟合时，纯幂律在 {t} FLOP 处预测 L = {vp}，带下限 L∞ = {li} 的拟合预测 {vf}，两者相差 {b}；在参与拟合的预算上最多相差 {a}。{held}",
    heldDesc: "在 {h} 个留出预算上，纯幂律的中位误差为 {ep}，带下限的拟合为 {ef}。",
    heldDescNone: "没有留出预算。",
  },
};

const CUTS = ["1e20", "3e20", "6e20", "1e21", "3e21"] as const;
type Cut = (typeof CUTS)[number];
type P = { fitTo: Cut; target: number };
type Form = "pure" | "floor";

const C_DOMAIN: [number, number] = [1e18, 1e25];
const L_DOMAIN: [number, number] = [1.2, 3.4];
const L_TICKS = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2];
const COLOR: Record<Form, string> = { pure: C.c1, floor: C.c2 };

const fitOf = (cut: Cut): CutoffFit => FITS.find((f) => f.budget === Number(cut))!;

// The forecast budget; the slider's 23.76 is the Chinchilla and Gopher budget.
const targetOf = (t: number) => (Math.abs(t - Math.log10(GOPHER_BUDGET)) < 0.006 ? GOPHER_BUDGET : 10 ** t);

const lawAt = (f: FormFit, c: number) => f.Linf + f.A * c ** -f.alpha;

// Linear interpolation in log10 C of a band on GRID.
function band(arr: readonly number[], lc: number): number {
  const step = GRID[1] - GRID[0];
  const i = Math.max(0, Math.min(GRID.length - 2, Math.floor((lc - GRID[0]) / step)));
  const u = (lc - GRID[i]) / step;
  return arr[i] * (1 - u) + arr[i + 1] * u;
}

function forecast(f: FormFit, c: number) {
  const lc = Math.log10(c);
  return { v: lawAt(f, c), red: f.A * c ** -f.alpha, lo: band(f.lo, lc), hi: band(f.hi, lc) };
}

// Largest difference between the two fits over the fitted budgets.
function gapInside(fit: CutoffFit): number {
  let mx = 0;
  const l0 = Math.log10(POINTS[0].C), l1 = Math.log10(fit.budget);
  for (let lc = l0; lc <= l1 + 1e-9; lc += 0.02) mx = Math.max(mx, Math.abs(lawAt(fit.pure, 10 ** lc) - lawAt(fit.floor, 10 ** lc)));
  return mx;
}

// A coefficient as the readout writes it: 42, 1,460, 1.33 × 10⁴.
const coef = (v: number) => (v >= 1e4 ? sci(v, 3) : sig(v, 3));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const fit = fitOf(st.p.fitTo);
  const c = targetOf(st.p.target);
  const held = POINTS.length - fit.points;
  return tpl(L.describe, {
    k: fit.points, c: sci(fit.budget), t: sci(c),
    vp: fixed(lawAt(fit.pure, c), 2), vf: fixed(lawAt(fit.floor, c), 2), li: fixed(fit.floor.Linf, 2),
    b: fixed(Math.abs(lawAt(fit.floor, c) - lawAt(fit.pure, c)), 2), a: fixed(gapInside(fit), 3),
    held: held
      ? tpl(L.heldDesc, { h: held, ep: fixed(fit.pure.errHeld ?? 0, 3), ef: fixed(fit.floor.errHeld ?? 0, 3) })
      : L.heldDescNone,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const fit = fitOf(p.fitTo);
  const k = fit.points - 1; // index of the largest fitted budget
  const c = targetOf(p.target);
  const clip = `${st.uid}-clip`;
  const parts: string[] = [];

  // ---- plot
  const x0 = narrow ? 38 : 42, x1 = w - 8;
  const head = wrapLines(L.panel, TYPE.label, w - 6);
  const top = 44 + (head.length - 1) * 18;
  const h = narrow ? 230 : 270, bot = top + h;
  const x = log(C_DOMAIN, [x0, x1]);
  const y = log(L_DOMAIN, [bot, top]);
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: x0, y: top, width: x1 - x0, height: h }))));
  head.forEach((ln, i) => parts.push(text(0, 14 + i * 18, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));

  // The fitted range runs to halfway (in log C) to the first held-out budget.
  const edge = k < POINTS.length - 1 ? Math.sqrt(POINTS[k].C * POINTS[k + 1].C) : POINTS[k].C * 1.4;
  const ex = x(edge);
  parts.push(el("rect", { x: x0, y: top, width: ex - x0, height: h, fill: C.panel }));
  parts.push(axis({ scale: x, orient: "bottom", at: bot, grid: [top, bot], minor: true, title: L.xC, format: pow10, size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: x0, grid: [x0, x1], ticks: narrow ? L_TICKS.filter((_, i) => i % 2 === 0) : L_TICKS, title: L.yL, format: (v) => fixed(v, 1), size: fs }));

  const obstacles: Box[] = [];
  const clipped: string[] = [];
  // The fitted floor, as a horizontal reference.
  const fy = y(fit.floor.Linf);
  clipped.push(el("line", { x1: x0, x2: x1, y1: fy, y2: fy, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "5 4" }));
  obstacles.push(...lineObstacles([[x0, fy], [x1, fy]]));
  // Bands, then curves: solid over the fitted budgets, dashed beyond them.
  const forms: Form[] = ["pure", "floor"];
  for (const form of forms) {
    const f = fit[form];
    const lo = GRID.map((lc, i) => [x(10 ** lc), y(f.lo[i])] as [number, number]);
    const hi = GRID.map((lc, i) => [x(10 ** lc), y(f.hi[i])] as [number, number]);
    clipped.push(el("path", { d: linePath([...lo, ...hi.reverse()]) + "Z", fill: COLOR[form], "fill-opacity": 0.22 }));
  }
  const curve = (f: FormFit, c0: number, c1: number) => {
    const out: Array<[number, number]> = [];
    for (let lc = Math.log10(c0); lc <= Math.log10(c1) + 1e-9; lc += 0.05) out.push([x(10 ** lc), y(lawAt(f, 10 ** lc))]);
    return out;
  };
  for (const form of forms) {
    const inside = curve(fit[form], C_DOMAIN[0], edge);
    const beyond = curve(fit[form], edge, C_DOMAIN[1]);
    clipped.push(el("path", { d: linePath(inside), fill: "none", stroke: COLOR[form], "stroke-width": 2.2 }));
    clipped.push(el("path", { d: linePath(beyond), fill: "none", stroke: COLOR[form], "stroke-width": 2.2, "stroke-dasharray": "6 4" }));
    obstacles.push(...lineObstacles([...inside, ...beyond].filter(([, py]) => py >= top && py <= bot)));
  }
  parts.push(g({ "clip-path": `url(#${clip})` }, ...clipped));

  // Frontier points: filled in the fit, hollow when held out. A click on a
  // point makes it the largest fitted budget.
  POINTS.forEach((pt, i) => {
    const px = x(pt.C), py = y(pt.L);
    const held = i > k;
    parts.push(held
      ? el("circle", { cx: px, cy: py, r: 3.6, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 })
      : el("circle", { cx: px, cy: py, r: 3.6, fill: C.ink }));
    const cut = CUTS.find((cc) => Number(cc) === pt.C);
    if (cut) parts.push(el("circle", { cx: px, cy: py, r: 10, fill: "transparent", "data-fig-set": `fitTo=${cut}`, class: "fig-hit" }));
    obstacles.push({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
  });

  // Forecast: a vertical guide, then each fit's value and band at the target.
  const tx = x(c);
  parts.push(el("line", { x1: tx, x2: tx, y1: top, y2: bot, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  obstacles.push(...lineObstacles([[tx, top], [tx, bot]]));
  const reqs: LabelRequest[] = [];
  const fc = { pure: forecast(fit.pure, c), floor: forecast(fit.floor, c) };
  for (const form of forms) {
    const v = fc[form];
    const ty = y(v.v), tlo = y(v.lo), thi = y(v.hi);
    parts.push(el("line", { x1: tx, x2: tx, y1: tlo, y2: thi, stroke: C.ink, "stroke-width": 2 }));
    for (const yy of [tlo, thi]) parts.push(el("line", { x1: tx - 4, x2: tx + 4, y1: yy, y2: yy, stroke: C.ink, "stroke-width": 2 }));
    parts.push(el("circle", { cx: tx, cy: ty, r: 5, fill: COLOR[form], stroke: C.paper, "stroke-width": 2 }));
    obstacles.push({ x0: tx - 7, y0: Math.min(thi, ty - 6), x1: tx + 7, y1: Math.max(tlo, ty + 6) });
    reqs.push({ x: tx, y: ty, text: fixed(v.v, 2), size: fs, sides: ["right", "left", "above-right", "below-right", "above-left", "below-left"], gap: 10, priority: 5, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  // The floor is named at its left end, where the curves are still far above it.
  reqs.push({ x: x0 + 4, y: fy, text: tpl(L.floorLine, { v: fixed(fit.floor.Linf, 2) }), size: fs, sides: ["above-right", "below-right"], gap: 6, priority: 3, attrs: { class: "fig-t-halo fig-t-soft fig-t-num" } });
  // Region names along the bottom of the plot, below the curves.
  const regionY = bot - 8;
  if (ex - x0 > textWidth(L.fitted, fs) + 12) reqs.push({ x: x0 + 6, y: regionY - fs * 0.35, text: L.fitted, size: fs, sides: ["right"], gap: 0, priority: 4, attrs: { class: "fig-t-muted" } });
  if (k < POINTS.length - 1) reqs.push({ x: ex + 6, y: regionY - fs * 0.35, text: L.heldOut, size: fs, sides: ["right"], gap: 0, priority: 4, attrs: { class: "fig-t-muted" } });
  const placed = placeLabels(reqs, { x0: x0 + 2, y0: top + 2, x1: x1 - 2, y1: bot - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  // Legend under the axis.
  const lg = legend([
    { label: L.pure, swatch: { kind: "line", stroke: COLOR.pure } },
    { label: L.floor, swatch: { kind: "line", stroke: COLOR.floor } },
    { label: L.lgFit, swatch: { kind: "dot", fill: C.ink } },
    { label: L.lgHeld, swatch: { kind: "rect", fill: C.paper, stroke: C.ink } },
    { label: L.lgBand, swatch: { kind: "rect", fill: C.ink3, opacity: 0.35 } },
  ], 0, bot + axisHeight(true, fs) + 6, w, fs);
  parts.push(lg.svg);

  // ---- readout: each fit's terms and its forecast, then the gap
  let yy = bot + axisHeight(true, fs) + 6 + lg.height + 22;
  const rp: string[] = [];
  const line = (s: string, cls: string, size: number, x = 0, after = 0) => {
    for (const part of wrapLines(s, size, w - x)) { rp.push(text(x, yy, part, { "font-size": size, class: cls || undefined })); yy += size + 5; }
    yy += after;
  };
  const held = POINTS.length - fit.points;
  line(held ? tpl(L.summary, { k: fit.points, c: sci(fit.budget), h: held }) : tpl(L.summaryAll, { k: fit.points, c: sci(fit.budget) }), "fig-t-strong", TYPE.body, 0, 8);
  const ind = 26;
  for (const form of forms) {
    const f = fit[form];
    const v = fc[form];
    rp.push(el("line", { x1: 0, x2: 18, y1: yy - 4, y2: yy - 4, stroke: COLOR[form], "stroke-width": 2.5, "stroke-linecap": "round" }));
    const law = form === "pure"
      ? tpl(L.coefPure, { A: coef(f.A), a: sig(f.alpha, 3) })
      : tpl(L.coefFloor, { Li: fixed(f.Linf, 3), A: coef(f.A), a: sig(f.alpha, 3) });
    if (narrow) {
      line(L[form], "fig-t-strong", TYPE.body, ind);
      line(law, "fig-t-num", TYPE.body, ind);
    } else {
      rp.push(text(ind, yy, L[form], { "font-size": TYPE.body, class: "fig-t-strong" }));
      rp.push(text(ind + 190, yy, law, { "font-size": TYPE.body, class: "fig-t-num" }));
      yy += TYPE.body + 5;
    }
    const at = form === "pure"
      ? tpl(L.atPure, { c: sci(c), v: fixed(v.v, 3) })
      : tpl(L.atFloor, { c: sci(c), Li: fixed(f.Linf, 3), r: fixed(v.red, 3), v: fixed(v.v, 3) });
    line(at, "fig-t-num", TYPE.body, ind);
    const bandVars = { lo: fixed(v.lo, 3), hi: fixed(v.hi, 3) };
    line(f.errHeld == null ? tpl(L.heldNone, bandVars) : tpl(L.held, { ...bandVars, e: fixed(f.errHeld, 3) }), "fig-t-muted fig-t-num", fs, ind, 10);
  }
  line(tpl(L.gap, { a: fixed(gapInside(fit), 3), b: fixed(Math.abs(fc.floor.v - fc.pure.v), 2), c: sci(c) }), "", TYPE.body, 0, 8);
  line(L.source, "fig-t-muted", fs, 0);
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "compute-law-fit",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    fitTo: {
      kind: "choice", control: "buttons", label: { en: "Fit on budgets up to", zh: "拟合所用的最大预算" }, default: "1e20",
      options: CUTS.map((cut) => ({ value: cut, label: { en: `${sci(Number(cut), 1)} FLOP`, zh: `${sci(Number(cut), 1)} FLOP` } })),
    },
    target: {
      kind: "range", label: { en: "Forecast budget, log₁₀ FLOP", zh: "预测预算，log₁₀ FLOP" }, min: 19, max: 25, step: 0.01, default: 23.76,
      marks: [{ value: 23.76, label: { en: "Chinchilla 70B", zh: "Chinchilla 70B" } }],
    },
  },
  render,
  describe,
});
