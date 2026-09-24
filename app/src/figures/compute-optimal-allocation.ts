// Compute-optimal allocation on published fits of the Chinchilla loss surface
//
//   L_C(N) = E + A / N^α + B (κ N / C)^β,   D = C / (κ N),   κ = 6,
//
// the chapter's fixed-budget loss. The left panel draws one IsoFLOP basin per
// decade of training compute, the basin at the reader's budget C in bold with
// its two excess terms (capacity A / N^α, data B / D^β), the closed-form
// optimum N* on it, and a second model size N the reader places on the same
// basin. The right panel draws the tokens per parameter D* / N* that each fit
// prescribes as C grows, against the Kaplan et al. (2020) allocation and the
// Chinchilla and Gopher models. When C sits on one of the nine IsoFLOP budgets
// of Hoffmann et al. (2022), the reconstructed runs at that budget are drawn on
// the basin, so the fit can be read against its data.
//
// Coefficients and their sources are in data/scaling-laws.ts; the runs are in
// data/chinchilla-runs.ts.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log, linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box, type LabelRequest, type Side } from "./lib/labels.ts";
import { fixed, sig, tpl } from "./lib/format.ts";
import { count, sci, pow10, wrapCJK } from "./lib/notation.ts";
import { PUBLISHED, KAPPA, GOPHER_BUDGET, MODELS, loss, terms, optimum, kaplan, type FitKey, type LossFit } from "./data/scaling-laws.ts";
import { BUDGETS, RUNS } from "./data/chinchilla-runs.ts";

const labels = {
  en: {
    title: "Compute-optimal allocation on the Chinchilla loss surface",
    basins: "Loss above the fitted floor E, at fixed compute C",
    yLoss: "L − E, capacity term + data term",
    xN: "parameters N",
    ratio: "Tokens per parameter at the optimum",
    yRatio: "D* / N*",
    xC: "compute budget C (FLOP)",
    frontier: "optimum at each C",
    decade: "C = {c}",
    lgBasin: "basin at the chosen C",
    lgOthers: "other budgets, one per decade",
    lgRuns: "runs at this budget",
    capCurve: "A/N^α",
    dataCurve: "B/D^β",
    optimum: "N* = {n}",
    marked: "N = {n}",
    runs: "dots: {k} runs at {c} FLOP, reconstructed from Hoffmann et al. Figure 4",
    budget: "C = {c} FLOP, so a model with N parameters trains on D = C / (6N) tokens",
    optLine: "Optimum: N* = {n}, D* = {d}, {r} tokens per parameter",
    markLine: "Marked: N = {n}, D = {d}, {r} tokens per parameter",
    optEq: "L = {e} + {cap} + {data} = {l}",
    markEq: "L = {e} + {cap} + {data} = {l}, {gap} above the optimum",
    markEqBelow: "L = {e} + {cap} + {data} = {l}, at the optimum",
    capName: "capacity A/N^α",
    dataName: "data B/D^β",
    form: "L = E + A/N^α + B/D^β with E = {E}, A = {A}, α = {alpha}, B = {B}, β = {beta}",
    exps: "N* ∝ C^a and D* ∝ C^b with a = β/(α+β) = {a}, b = {b}, so D*/N* ∝ C^{s}: flat only when α = β",
    src_refit: "Coefficients: Besiroglu et al. (2024), refit of Hoffmann et al. (2022) Approach 3",
    src_unrounded: "Coefficients: Hoffmann et al. (2022) Approach 3, unrounded values from the arXiv source",
    src_printed: "Coefficients: Hoffmann et al. (2022) Approach 3, eq. 10 as printed",
    srcKaplan: "Kaplan et al. (2020): Table 6 allocation, non-embedding parameters",
    lg_refit: "Besiroglu refit",
    lg_unrounded: "Hoffmann unrounded",
    lg_printed: "Hoffmann printed",
    lgKaplan: "Kaplan et al. 2020",
    chinchilla: "Chinchilla",
    gopher: "Gopher",
    describe: "{fit}: at C = {c} FLOP the predicted loss is lowest at N* = {n} parameters trained on D* = {d} tokens ({r} per parameter), L = {l}. A {m} model on the same budget trains on {dm} tokens and reaches {lm}.",
  },
  zh: {
    title: "Chinchilla 损失曲面上的算力最优分配",
    basins: "固定算力 C 下高于拟合下限 E 的损失",
    yLoss: "L − E，容量项 + 数据项",
    xN: "参数量 N",
    ratio: "最优点上每个参数对应的词元数",
    yRatio: "D* / N*",
    xC: "算力预算 C（FLOP）",
    frontier: "各预算的最优点",
    decade: "C = {c}",
    lgBasin: "所选预算 C 的损失曲线",
    lgOthers: "其他预算，每十倍一条",
    lgRuns: "该预算下的训练",
    capCurve: "A/N^α",
    dataCurve: "B/D^β",
    optimum: "N* = {n}",
    marked: "N = {n}",
    runs: "圆点：{c} FLOP 下的 {k} 次训练，由 Hoffmann 等人图 4 重建",
    budget: "C = {c} FLOP，参数量为 N 的模型可训练 D = C / (6N) 个词元",
    optLine: "最优点：N* = {n}，D* = {d}，每个参数 {r} 个词元",
    markLine: "标记模型：N = {n}，D = {d}，每个参数 {r} 个词元",
    optEq: "L = {e} + {cap} + {data} = {l}",
    markEq: "L = {e} + {cap} + {data} = {l}，比最优点高 {gap}",
    markEqBelow: "L = {e} + {cap} + {data} = {l}，位于最优点",
    capName: "容量项 A/N^α",
    dataName: "数据项 B/D^β",
    form: "L = E + A/N^α + B/D^β，其中 E = {E}，A = {A}，α = {alpha}，B = {B}，β = {beta}",
    exps: "N* ∝ C^a，D* ∝ C^b，a = β/(α+β) = {a}，b = {b}，因此 D*/N* ∝ C^{s}：只有 α = β 时才保持不变",
    src_refit: "系数来源：Besiroglu 等人（2024）对 Hoffmann 等人（2022）方法三的重新拟合",
    src_unrounded: "系数来源：Hoffmann 等人（2022）方法三，取自 arXiv 源文件的未取整值",
    src_printed: "系数来源：Hoffmann 等人（2022）方法三，正文式 (10) 的取整值",
    srcKaplan: "Kaplan 等人（2020）：表 6 的分配关系，参数量不含嵌入层",
    lg_refit: "Besiroglu 重新拟合",
    lg_unrounded: "Hoffmann 未取整",
    lg_printed: "Hoffmann 取整后",
    lgKaplan: "Kaplan 等人 2020",
    chinchilla: "Chinchilla",
    gopher: "Gopher",
    describe: "{fit}：C = {c} FLOP 时，预测损失在 N* = {n} 个参数、D* = {d} 个训练词元处最低（每个参数 {r} 个词元），L = {l}。同一预算下，{m} 参数的模型训练 {dm} 个词元，损失为 {lm}。",
  },
};

type P = { fit: FitKey; logC: number; model: number };

const FIT_KEYS: FitKey[] = ["refit", "unrounded", "printed"];
const FIT_COLOR: Record<FitKey, string> = { refit: C.c1, unrounded: C.c2, printed: C.c3 };
const CAP = C.c5, DATA = C.c7;

const N_DOMAIN: [number, number] = [1e7, 1e13];
const C_DOMAIN: [number, number] = [1e18, 1e26];
const R_DOMAIN: [number, number] = [0.01, 1000];
const EX_DOMAIN: [number, number] = [0.02, 4];
const EX_TICKS = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
const DECADES = [18, 19, 20, 21, 22, 23, 24, 25, 26];

const ratio = (f: LossFit, c: number) => { const o = optimum(f, c); return o.D / o.N; };

// Within 0.05 decade of a named budget (the Gopher budget or one of the nine
// IsoFLOP budgets) the slider snaps to it, so the basin can be read against
// that budget's runs and 23.76 reads as 5.76 × 10²³ rather than 5.75 × 10²³.
const NAMED = [GOPHER_BUDGET, ...BUDGETS];
function budgetOf(logC: number): number {
  const hit = NAMED.find((b) => Math.abs(Math.log10(b) - logC) < 0.05);
  return hit ?? 10 ** logC;
}

function state(p: P) {
  const f = PUBLISHED[p.fit];
  const c = budgetOf(p.logC);
  const opt = optimum(f, c);
  const mN = p.model * 1e9;
  const mD = c / (KAPPA * mN);
  return { f, c, opt, optT: terms(f, opt.N, opt.D), mN, mD, mL: loss(f, mN, mD), mT: terms(f, mN, mD) };
}

// Runs of the IsoFLOP budget C, if C is one.
function runsAt(c: number) {
  const k = BUDGETS.findIndex((b) => b === c);
  if (k < 0) return null;
  return { budget: BUDGETS[k], runs: RUNS.filter((r) => r[3] === k) };
}

const fitLabel = (k: FitKey, L: typeof labels.en) => L[`lg_${k}` as const];
const n3 = (v: number) => fixed(v, 3);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = state(st.p);
  return tpl(L.describe, {
    fit: fitLabel(st.p.fit, L), c: sci(s.c), n: count(s.opt.N), d: count(s.opt.D), r: sig(s.opt.D / s.opt.N, 3),
    l: n3(s.opt.L), m: count(s.mN), dm: count(s.mD), lm: n3(s.mL),
  });
}

// Sample a curve y(N) over the N domain on log spacing.
function curve(fn: (n: number) => number, n = 120): Array<[number, number]> {
  const [a, b] = [Math.log10(N_DOMAIN[0]), Math.log10(N_DOMAIN[1])];
  return Array.from({ length: n + 1 }, (_, i) => { const v = 10 ** (a + ((b - a) * i) / n); return [v, fn(v)] as [number, number]; });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small; // text floor: 12 px on a phone
  const s = state(p);
  const col = FIT_COLOR[p.fit];
  const parts: string[] = [];
  const clipA = `${st.uid}-clip-a`, clipB = `${st.uid}-clip-b`;

  // ---- geometry: side by side on a desktop column, stacked on a phone
  const gap = 24;
  const wA = narrow ? w : Math.round(w * 0.57);
  const xA0 = narrow ? 40 : 38, xA1 = wA - 6;
  const topA = 44, hA = narrow ? 200 : 214;
  const botA = topA + hA;
  const bx = narrow ? 0 : wA + gap; // panel B left edge
  const xB0 = bx + 40, xB1 = w - 6;
  // Panel A's key sits under its axis; on a phone panel B starts below it.
  const at = runsAt(s.c);
  const lgA = legend([
    { label: L.lgBasin, swatch: { kind: "line", stroke: col } },
    { label: L.lgOthers, swatch: { kind: "line", stroke: C.ink3 } },
    { label: L.frontier, swatch: { kind: "line", stroke: C.ink2, dash: "4 3" } },
    ...(at ? [{ label: L.lgRuns, swatch: { kind: "rect" as const, fill: C.paper, stroke: C.ink } }] : []),
  ], 0, botA + axisHeight(true, fs) + 6, wA, fs);
  const botLgA = botA + axisHeight(true, fs) + 6 + lgA.height;
  const topB = narrow ? botLgA + 56 : topA;
  const hB = narrow ? 160 : hA;
  const botB = topB + hB;

  // ---- panel A: IsoFLOP basins as excess loss above the fitted floor E, so
  // each term is a straight line on log-log axes: capacity A/N^α falls with
  // slope −α and is the same for every budget, data B/D^β = B (6N/C)^β rises
  // with slope β and moves right as C grows. A basin is their sum.
  const x = log(N_DOMAIN, [xA0, xA1]);
  const y = log(EX_DOMAIN, [botA, topA]);
  parts.push(el("defs", {},
    el("clipPath", { id: clipA }, el("rect", { x: xA0, y: topA, width: xA1 - xA0, height: hA })),
    el("clipPath", { id: clipB }, el("rect", { x: xB0, y: topB, width: xB1 - xB0, height: hB }))));
  parts.push(text(0, 14, L.basins, { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(axis({ scale: x, orient: "bottom", at: botA, grid: [topA, botA], minor: true, title: L.xN, format: count, size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: xA0, grid: [xA0, xA1], ticks: EX_TICKS, title: L.yLoss, format: (v) => sig(v, 2), size: fs }));

  const f = s.f;
  const excess = (n: number, c: number) => f.A / n ** f.alpha + f.B / (c / (KAPPA * n)) ** f.beta;
  const toPx = (pts: Array<[number, number]>) => pts.map(([n, v]) => [x(n), y(v)] as [number, number]);
  const inA = (pt: [number, number]) => pt[0] >= xA0 - 0.5 && pt[0] <= xA1 + 0.5 && pt[1] >= topA - 0.5 && pt[1] <= botA + 0.5;
  const clipped: string[] = [];
  const obstacles: Box[] = [];
  const reqs: LabelRequest[] = [];
  // One faint basin per decade of compute. They are furniture, like gridlines,
  // so labels may cross them; the first and last are named at their minima.
  for (const e of DECADES) {
    const pts = toPx(curve((n) => excess(n, 10 ** e)));
    clipped.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-opacity": 0.6 }));
    if (e !== DECADES[0] && e !== DECADES[DECADES.length - 1]) continue;
    const o = optimum(f, 10 ** e);
    const px = x(o.N), py = y(o.L - f.E);
    if (inA([px, py])) reqs.push({ x: px, y: py, text: tpl(L.decade, { c: pow10(10 ** e) }), size: fs, sides: e === DECADES[0] ? ["above", "above-right", "right"] : ["below", "below-left", "left", "below-right"], gap: 5, priority: 1, attrs: { class: "fig-t-muted" } });
  }
  // The locus of optima across budgets.
  const locus: Array<[number, number]> = [];
  for (let lc = 18; lc <= 26.001; lc += 0.1) { const o = optimum(f, 10 ** lc); locus.push([x(o.N), y(o.L - f.E)]); }
  clipped.push(el("path", { d: linePath(locus), fill: "none", stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  // The chosen budget: the two terms and the basin they sum to.
  const capPts = toPx(curve((n) => f.A / n ** f.alpha));
  const dataPts = toPx(curve((n) => f.B / (s.c / (KAPPA * n)) ** f.beta));
  const selPts = toPx(curve((n) => excess(n, s.c)));
  clipped.push(el("path", { d: linePath(capPts), fill: "none", stroke: CAP, "stroke-width": 1.6, "stroke-dasharray": "6 3" }));
  clipped.push(el("path", { d: linePath(dataPts), fill: "none", stroke: DATA, "stroke-width": 1.6, "stroke-dasharray": "6 3" }));
  clipped.push(el("path", { d: linePath(selPts), fill: "none", stroke: col, "stroke-width": 2.6, "stroke-linejoin": "round" }));
  for (const pts of [locus, capPts, dataPts, selPts]) obstacles.push(...lineObstacles(pts.filter(inA)));
  parts.push(g({ "clip-path": `url(#${clipA})` }, ...clipped));

  // Reconstructed runs at this budget, when C is one of the nine, against this fit's floor.
  if (at) {
    for (const r of at.runs) {
      const px = x(r[0]), py = y(r[2] - f.E);
      if (!inA([px, py])) continue;
      parts.push(el("circle", { cx: px, cy: py, r: 2.6, fill: C.paper, stroke: C.ink, "stroke-width": 1.2 }));
      obstacles.push({ x0: px - 3, y0: py - 3, x1: px + 3, y1: py + 3 });
    }
  }

  // Markers: the optimum and the model the reader placed on the same basin.
  const ox = x(s.opt.N), oy = y(s.opt.L - f.E);
  const mx = x(s.mN), my = y(s.mL - f.E);
  const mVisible = inA([mx, my]);
  obstacles.push({ x0: ox - 7, y0: oy - 7, x1: ox + 7, y1: oy + 7 });
  if (mVisible) obstacles.push({ x0: mx - 6, y0: my - 6, x1: mx + 6, y1: my + 6 });
  reqs.push({ x: ox, y: oy, text: tpl(L.optimum, { n: count(s.opt.N) }), size: fs, sides: ["below", "below-right", "below-left", "right", "left"], gap: 12, priority: 6, attrs: { class: "fig-t-halo" } });
  if (mVisible) reqs.push({ x: mx, y: my, text: tpl(L.marked, { n: count(s.mN) }), size: fs, sides: ["above", "above-right", "above-left", "right", "left", "below"], gap: 10, priority: 5, attrs: { class: "fig-t-halo" } });
  // Term names near the left end of the capacity line and the right end of the data line.
  const capVis = capPts.filter(inA);
  if (capVis.length) { const [px, py] = capVis[Math.min(capVis.length - 1, Math.round(capVis.length * 0.12))]; reqs.push({ x: px, y: py, text: L.capCurve, size: fs, sides: ["below-left", "below", "left"], gap: 8, priority: 4, attrs: { class: "fig-t-halo fig-t-soft" } }); }
  const dataVis = dataPts.filter(inA);
  if (dataVis.length) { const [px, py] = dataVis[Math.max(0, Math.round(dataVis.length * 0.2))]; reqs.push({ x: px, y: py, text: L.dataCurve, size: fs, sides: ["below-right", "below", "right"], gap: 8, priority: 4, attrs: { class: "fig-t-halo fig-t-soft" } }); }
  const placed = placeLabels(reqs, { x0: xA0 + 2, y0: topA + 2, x1: xA1 - 2, y1: botA - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  if (mVisible) parts.push(el("circle", { cx: mx, cy: my, r: 5.5, fill: C.paper, stroke: C.ink, "stroke-width": 2 }));
  parts.push(el("circle", { cx: ox, cy: oy, r: 6.5, fill: col, stroke: C.paper, "stroke-width": 2 }));

  // ---- panel B: tokens per parameter along each frontier
  const xc = log(C_DOMAIN, [xB0, xB1]);
  const yr = log(R_DOMAIN, [botB, topB]);
  parts.push(text(bx, topB - 30, L.ratio, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const cTicks = narrow || w < 700 ? [1e18, 1e20, 1e22, 1e24, 1e26] : DECADES.map((e) => 10 ** e);
  parts.push(axis({ scale: xc, orient: "bottom", at: botB, grid: [topB, botB], ticks: cTicks, title: L.xC, format: pow10, size: fs }));
  parts.push(axis({ scale: yr, orient: "left", at: xB0, grid: [xB0, xB1], title: L.yRatio, format: (v) => sig(v, 2), size: fs }));
  const cSamples = (fn: (c: number) => number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let lc = 18; lc <= 26.001; lc += 0.1) out.push([xc(10 ** lc), yr(fn(10 ** lc))]);
    return out;
  };
  const bParts: string[] = [];
  const bObs: Box[] = [];
  const kPts = cSamples((c) => { const k = kaplan(c); return k.D / k.N; });
  bParts.push(el("path", { d: linePath(kPts), fill: "none", stroke: C.c4, "stroke-width": 2, "stroke-dasharray": "6 3" }));
  bObs.push(...lineObstacles(kPts));
  for (const k of FIT_KEYS) {
    if (k === p.fit) continue;
    const pts = cSamples((c) => ratio(PUBLISHED[k], c));
    bParts.push(el("path", { d: linePath(pts), fill: "none", stroke: FIT_COLOR[k], "stroke-width": 1.4 }));
    bObs.push(...lineObstacles(pts));
  }
  const selR = cSamples((c) => ratio(s.f, c));
  bParts.push(el("path", { d: linePath(selR), fill: "none", stroke: col, "stroke-width": 2.6 }));
  bObs.push(...lineObstacles(selR));
  parts.push(g({ "clip-path": `url(#${clipB})` }, ...bParts));
  // Wide invisible strokes select a fit by pointer; the control is the keyboard path.
  for (const k of FIT_KEYS) {
    parts.push(el("path", { d: linePath(cSamples((c) => ratio(PUBLISHED[k], c))), fill: "none", stroke: "transparent", "stroke-width": 10, "data-fig-set": `fit=${k}`, class: "fig-hit" }));
  }
  // The chosen budget, and the two models trained at the Gopher budget.
  const cx = xc(s.c);
  parts.push(el("line", { x1: cx, x2: cx, y1: topB, y2: botB, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  bObs.push(...lineObstacles([[cx, topB], [cx, botB]]));
  // The chosen fit's ratio at C, under the two models trained at the Gopher budget.
  const rNow = s.opt.D / s.opt.N;
  const rx = cx, ry = yr(rNow);
  parts.push(el("circle", { cx: rx, cy: ry, r: 6, fill: C.paper, stroke: col, "stroke-width": 2.5 }));
  bObs.push({ x0: rx - 6, y0: ry - 6, x1: rx + 6, y1: ry + 6 });
  const bReqs: LabelRequest[] = [];
  for (const k of ["chinchilla", "gopher"] as const) {
    const m = MODELS[k];
    const px = xc(GOPHER_BUDGET), py = yr(m.D / m.N);
    parts.push(el("rect", { x: px - 3.5, y: py - 3.5, width: 7, height: 7, fill: C.ink, stroke: C.paper, "stroke-width": 1.2, transform: `rotate(45 ${px} ${py})` }));
    bObs.push({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
    // Anchored a little below the mark so the label clears the ring of the chosen fit.
    bReqs.push({ x: px - 4, y: py + 8, text: L[k], size: fs, sides: ["below-left", "right", "left", "above-left", "below"], gap: 6, priority: 2, attrs: { class: "fig-t-halo" } });
  }
  const bPlaced = placeLabels(bReqs, { x0: xB0 + 2, y0: topB + 2, x1: xB1 - 2, y1: botB - 2 }, bObs);
  parts.push(drawLabels(bPlaced.placed));
  const lgY = botB + axisHeight(true, fs) + 6;
  const lg = legend([
    ...FIT_KEYS.map((k) => ({ label: fitLabel(k, L), swatch: { kind: "line" as const, stroke: FIT_COLOR[k] } })),
    { label: L.lgKaplan, swatch: { kind: "line" as const, stroke: C.c4, dash: "6 3" } },
  ], bx, lgY, w - bx, fs);
  parts.push(lg.svg);

  // ---- readout: the equation's terms at the optimum and at the marked model
  parts.push(lgA.svg);
  const leftBottom = narrow ? 0 : botLgA;
  let yy = Math.max(lgY + lg.height, leftBottom) + 22;
  const rp: string[] = [];
  const line = (s2: string, cls: string, size: number = TYPE.body, gapAfter = 18) => {
    for (const part of wrapCJK(s2, size, w)) { rp.push(text(0, yy, part, { "font-size": size, class: cls })); yy += size + 5; }
    yy += gapAfter - size - 5;
  };
  line(tpl(L.budget, { c: sci(s.c) }), "fig-t-strong", TYPE.body, 24);
  const maxEx = Math.max(s.optT.cap + s.optT.data, s.mT.cap + s.mT.data);
  const barW = Math.min(w, 420);
  const bar = (t: { cap: number; data: number }) => {
    const k = barW / maxEx;
    const w1 = Math.max(1, t.cap * k), w2 = Math.max(1, t.data * k);
    rp.push(el("rect", { x: 0, y: yy - 10, width: barW, height: 10, rx: 2, fill: C.panel }));
    rp.push(el("rect", { x: 0, y: yy - 10, width: w1, height: 10, fill: CAP }));
    rp.push(el("rect", { x: w1, y: yy - 10, width: w2, height: 10, fill: DATA }));
    yy += 18;
  };
  const E = n3(s.f.E);
  line(tpl(L.optLine, { n: count(s.opt.N), d: count(s.opt.D), r: sig(rNow, 3) }), "", TYPE.body, 18);
  bar(s.optT);
  line(tpl(L.optEq, { e: E, cap: n3(s.optT.cap), data: n3(s.optT.data), l: n3(s.opt.L) }), "fig-t-num", TYPE.body, 26);
  line(tpl(L.markLine, { n: count(s.mN), d: count(s.mD), r: sig(s.mD / s.mN, 3) }), "", TYPE.body, 18);
  bar(s.mT);
  const gapL = s.mL - s.opt.L;
  line(tpl(gapL < 0.0005 ? L.markEqBelow : L.markEq, { e: E, cap: n3(s.mT.cap), data: n3(s.mT.data), l: n3(s.mL), gap: n3(gapL) }), "fig-t-num", TYPE.body, 22);
  // Bar key.
  const kx0 = 0;
  rp.push(el("rect", { x: kx0, y: yy - 9, width: 10, height: 10, rx: 2, fill: CAP }));
  rp.push(text(kx0 + 14, yy, L.capName, { "font-size": fs, class: "fig-t-muted" }));
  const kx1 = kx0 + 14 + textWidth(L.capName, fs) + 16;
  rp.push(el("rect", { x: kx1, y: yy - 9, width: 10, height: 10, rx: 2, fill: DATA }));
  rp.push(text(kx1 + 14, yy, L.dataName, { "font-size": fs, class: "fig-t-muted" }));
  yy += 22;
  line(tpl(L.form, { E: n3(f.E), A: sig(f.A, 4), alpha: fixed(f.alpha, 3), B: sig(f.B, 4), beta: fixed(f.beta, 3) }), "fig-t-muted fig-t-num", fs, fs + 7);
  const slope = s.opt.b - s.opt.a;
  line(tpl(L.exps, { a: fixed(s.opt.a, 3), b: fixed(s.opt.b, 3), s: (slope < 0 ? "−" : "") + fixed(Math.abs(slope), 3) }), "fig-t-muted fig-t-num", fs, fs + 7);
  if (at) line(tpl(L.runs, { k: at.runs.length, c: sci(at.budget) }), "fig-t-muted", fs, fs + 7);
  line(L[`src_${p.fit}` as const], "fig-t-muted", fs, fs + 5);
  line(L.srcKaplan, "fig-t-muted", fs, 0);
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "compute-optimal-allocation",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    fit: {
      kind: "choice", label: { en: "Coefficients", zh: "系数" }, default: "refit",
      options: [
        { value: "refit", label: { en: "Besiroglu refit", zh: "Besiroglu 重新拟合" } },
        { value: "unrounded", label: { en: "Hoffmann unrounded", zh: "Hoffmann 未取整" } },
        { value: "printed", label: { en: "Hoffmann printed", zh: "Hoffmann 取整后" } },
      ],
    },
    logC: {
      kind: "range", label: { en: "Compute budget C, log₁₀ FLOP", zh: "算力预算 C，log₁₀ FLOP" }, min: 18, max: 26, step: 0.01, default: 23.76,
      marks: [
        { value: 21.48, label: { en: "largest IsoFLOP runs", zh: "最大的等算力训练" } },
        { value: 23.76, label: { en: "Chinchilla and Gopher", zh: "Chinchilla 与 Gopher" } },
      ],
    },
    model: {
      kind: "range", scale: "log", label: { en: "Marked model size N", zh: "标记模型的参数量 N" }, unit: { en: "B params", zh: "B 参数" },
      min: 0.01, max: 10000, default: 280,
      marks: [
        { value: 70, label: { en: "Chinchilla", zh: "Chinchilla" } },
        { value: 280, label: { en: "Gopher", zh: "Gopher" } },
      ],
    },
  },
  render,
  describe,
});
