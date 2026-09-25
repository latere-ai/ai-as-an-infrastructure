// Coverage against realized accuracy as the number of samples per problem k
// grows, for three ways of choosing one answer from the k samples.
//
// A benchmark is 40 problems whose one-sample success probabilities p_i have
// normal log-odds (median p, standard deviation `spread`), taken at the 40
// quantiles so the population is deterministic; spread 0 is one prompt. Each
// sample is correct with probability p_i, independently.
//
// - Coverage, the chapter's C_k = 1 − (1 − p_i)^k averaged over problems. An
//   exact checker returns a correct sample whenever one is present, so its
//   realized accuracy equals coverage.
// - Majority vote. A wrong sample gives one shared distractor answer with
//   probability d and otherwise a wrong answer no other sample repeats. The
//   largest answer group wins and ties break uniformly. With counts c
//   (correct), e (distractor) and n = c + e ~ Bin(k, p + (1 − p) d),
//   c | n ~ Bin(n, ρ), ρ = p / (p + (1 − p) d):
//     A = P(c ≥ 2, c > e) + ½ P(c ≥ 2, c = e) + (1/k) P(c = 1, e ≤ 1),
//   summed over n with P(Bin(n, ρ) > n / 2) advanced by a one-step recurrence.
//   As k grows, A tends to 1 on problems with p > (1 − p) d and to 0 below.
// - Learned verifier, a constructed failure model: a sample's score has mean
//   1.0 if correct, 1.5 if it is one of the wrong samples the verifier
//   overrates (probability β among wrong samples), 0.0 otherwise, plus
//   Gaussian noise σ; the highest score is returned. With F the CDF of one
//   sample's score and φ the density of a correct sample's score,
//     A = k p ∫ φ(s) F(s)^(k − 1) ds,
//   integrated with Simpson's rule over ±7σ around the correct mean.
//
// Every curve is exact for the model; nothing is simulated.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { logitScale } from "./lib/logit-scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textBox, textWidth, overlaps, wrap, type Box } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, pct, sig, tpl } from "./lib/format.ts";
import { binomPmf, normalPdf, normalTail, logitNormalQuantiles } from "./lib/stats.ts";

// ---------------------------------------------------------------- model

const PROBLEMS = 40;
const MEAN = { correct: 1.0, overrated: 1.5, wrong: 0.0 }; // mean score by sample kind

// P(X > n / 2) for X ~ Bin(n, r), summed over the window that carries the mass.
function aboveHalf(n: number, r: number): number {
  if (n === 0) return 0;
  const mean = n * r, sd = Math.sqrt(n * r * (1 - r));
  const lo = Math.max(Math.floor(n / 2) + 1, Math.floor(mean - 12 * sd - 2));
  const hi = Math.min(n, Math.ceil(mean + 12 * sd + 2));
  let s = 0;
  for (let j = lo; j <= hi; j++) s += binomPmf(n, j, r);
  return Math.min(1, s);
}

export function voteAccuracy(p: number, d: number, k: number): number {
  const a = p, b = (1 - p) * d, s = (1 - p) * (1 - d), q = a + b;
  const rho = q > 0 ? a / q : 0;
  const mean = k * q, sd = Math.sqrt(k * q * (1 - q));
  const n0 = Math.max(0, Math.floor(mean - 12 * sd - 2)), n1 = Math.min(k, Math.ceil(mean + 12 * sd + 2));
  let above = aboveHalf(n0, rho);
  let win = 0, tie = 0;
  for (let n = n0; n <= n1; n++) {
    if (n > n0) {
      const m = n - 1;
      above += m % 2 === 0 ? rho * binomPmf(m, m / 2, rho) : -(1 - rho) * binomPmf(m, (m + 1) / 2, rho);
    }
    const pn = binomPmf(k, n, q);
    if (pn === 0) continue;
    if (n >= 2) win += pn * above;
    if (n >= 4 && n % 2 === 0) tie += pn * binomPmf(n, n / 2, rho);
  }
  // One correct sample and every group of size one: a uniform pick among k.
  const single = a * Math.pow(s, k - 1) + (k >= 2 ? (k - 1) * a * b * Math.pow(s, k - 2) : 0);
  return Math.min(1, Math.max(0, win + 0.5 * tie + single));
}

// Per-problem quadrature table for the verifier: weight·φ and ln F on a grid.
interface VerTable { wphi: Float64Array; lnF: Float64Array }
const GRID = 240; // Simpson intervals
function verifierTable(p: number, beta: number, sigma: number): VerTable {
  const lo = MEAN.correct - 7 * sigma, h = (14 * sigma) / GRID;
  const wphi = new Float64Array(GRID + 1), lnF = new Float64Array(GRID + 1);
  for (let j = 0; j <= GRID; j++) {
    const x = lo + j * h;
    const wS = j === 0 || j === GRID ? 1 : j % 2 ? 4 : 2;
    wphi[j] = ((wS * h) / 3) * p * (normalPdf((x - MEAN.correct) / sigma) / sigma);
    const tail = p * normalTail((x - MEAN.correct) / sigma)
      + (1 - p) * beta * normalTail((x - MEAN.overrated) / sigma)
      + (1 - p) * (1 - beta) * normalTail((x - MEAN.wrong) / sigma);
    lnF[j] = Math.log1p(-Math.min(tail, 1 - 1e-16));
  }
  return { wphi, lnF };
}
function verifierAt(t: VerTable, k: number): number {
  let s = 0;
  for (let j = 0; j <= GRID; j++) s += t.wphi[j] * Math.exp((k - 1) * t.lnF[j]);
  return Math.min(1, Math.max(0, k * s));
}
export function verifierAccuracy(p: number, beta: number, sigma: number, k: number): number {
  return verifierAt(verifierTable(p, beta, sigma), k);
}

// Probability that one wrong sample outscores one correct sample.
function pairError(beta: number, sigma: number): number {
  const s2 = sigma * Math.SQRT2;
  return beta * (1 - normalTail((MEAN.overrated - MEAN.correct) / s2)) + (1 - beta) * normalTail((MEAN.correct - MEAN.wrong) / s2);
}

const coverage = (p: number, k: number) => 1 - Math.pow(1 - p, k);

// Samples per problem at which the curves are drawn: integers, 16 per decade.
function kGrid(kmax: number): number[] {
  const out = new Set<number>();
  for (let e = 0; e <= Math.log10(kmax) * 16 + 1e-9; e++) out.add(Math.min(kmax, Math.round(10 ** (e / 16))));
  out.add(kmax);
  return [...out].sort((a, b) => a - b);
}

type Sel = "oracle" | "vote" | "verifier";
type P = { selector: Sel; k: number; p: number; spread: number; share: number; fp: number; noise: number; kmax: number; showVote: boolean; showVerifier: boolean };

interface Curves {
  ps: number[];
  tables: VerTable[];
  ks: number[];
  cov: number[];
  vote: number[];
  ver: number[];
  best: { k: number; a: number };
  plateau: number; // limit of the vote curve
}

const mean = (xs: number[], f: (x: number, i: number) => number) => xs.reduce((s, x, i) => s + f(x, i), 0) / xs.length;

const memo = new Map<string, Curves>();
function curves(p: P): Curves {
  const key = `${p.p}|${p.spread}|${p.share}|${p.fp}|${p.noise}|${p.kmax}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const ps = logitNormalQuantiles(p.p, p.spread, PROBLEMS);
  const tables = ps.map((q) => verifierTable(q, p.fp, p.noise));
  const ks = kGrid(p.kmax);
  const verK = (k: number) => mean(ps, (_q, i) => verifierAt(tables[i], k));
  const cov = ks.map((k) => mean(ps, (q) => coverage(q, k)));
  const vote = ks.map((k) => mean(ps, (q) => voteAccuracy(q, p.share, k)));
  const ver = ks.map(verK);
  // Best k for the verifier: the grid maximum, refined to an integer by a
  // ternary search between its neighbors (the curve is unimodal there).
  let bi = 0;
  for (let i = 1; i < ver.length; i++) if (ver[i] > ver[bi]) bi = i;
  let lo = ks[Math.max(0, bi - 1)], hi = ks[Math.min(ks.length - 1, bi + 1)];
  while (hi - lo > 2) {
    const m1 = Math.floor(lo + (hi - lo) / 3), m2 = Math.ceil(hi - (hi - lo) / 3);
    if (verK(m1) < verK(m2)) lo = m1; else hi = m2;
  }
  let best = { k: lo, a: verK(lo) };
  for (let k = lo + 1; k <= hi; k++) { const a = verK(k); if (a > best.a) best = { k, a }; }
  const plateau = mean(ps, (q) => { const b = (1 - q) * p.share; return q > b ? 1 : q === b ? 0.5 : 0; });
  const out = { ps, tables, ks, cov, vote, ver, best, plateau };
  if (memo.size > 24) memo.clear();
  memo.set(key, out);
  return out;
}

function atK(p: P, c: Curves, k: number) {
  return {
    cov: mean(c.ps, (q) => coverage(q, k)),
    vote: mean(c.ps, (q) => voteAccuracy(q, p.share, k)),
    ver: mean(c.ps, (_q, i) => verifierAt(c.tables[i], k)),
  };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Coverage and the accuracy of three selectors",
    cov: "coverage Cₖ (exact checker)",
    covShort: "coverage Cₖ",
    vote: "majority vote",
    ver: "learned verifier",
    gapKey: "coverage the selector misses",
    x: "samples per problem k (log scale)",
    y: "problems answered correctly",
    cursor: "k = {k}",
    best: "best k = {k}",
    panelB: "At k = {k}, each problem by its one-sample success p",
    panelBShort: "Each problem at k = {k}, by its success p",
    xB: "one-sample success p of a problem (log-odds scale)",
    xBShort: "one-sample success p (log-odds scale)",
    yB: "chance of a correct answer",
    rug: "ticks: the {n} problems",
    rugOne: "tick: the one prompt",
    threshold: "vote flips at p = (1 − p) d",
    rowCov: "coverage Cₖ",
    rowVote: "majority vote Aₖ",
    rowVer: "learned verifier Aₖ",
    gap: "gap {g}",
    covMany: "Cₖ = mean over {n} problems of 1 − (1 − pᵢ)ᵏ = {v}",
    covOne: "Cₖ = 1 − (1 − {p}){ks} = {v}",
    noteOracle: "An exact checker returns a correct sample whenever one is present, so Aₖ = Cₖ.",
    noteVote: "As k grows, voting converges to {v}, the share of problems where the correct answer is more common than the distractor: pᵢ > (1 − pᵢ) d with d = {d}.",
    relMore: "more common than the distractor",
    relLess: "less common than the distractor",
    relSame: "as common as the distractor",
    noteVoteOne: "As k grows, voting on this prompt tends to {v}: the correct answer is {rel}, since p {cmp} (1 − p) d with d = {d}.",
    noteVoteNone: "With d = 0 no wrong answer repeats, so voting converges to 1 on every problem, slowly where p is small.",
    noteVer: "Best at k = {k} ({a}). A wrong sample outscores a correct one with probability {e}; with β = {b} the overrated samples multiply with k and Aₖ falls toward 0.",
    noteVerZero: "Best on this axis at k = {k} ({a}). A wrong sample outscores a correct one with probability {e}; with β = 0 the correct samples win eventually, so Aₖ keeps rising.",
    describe: "At k = {k} samples per problem, coverage is {c}.",
    describeVote: " Majority vote answers {v} of problems correctly.",
    describeVer: " The learned verifier answers {r}, and is best at k = {bk} ({ba}).",
  },
  zh: {
    title: "覆盖率与三种选择器的准确率",
    cov: "覆盖率 Cₖ（精确核查器）",
    covShort: "覆盖率 Cₖ",
    vote: "多数投票",
    ver: "学习得到的验证器",
    gapKey: "选择器错过的覆盖率",
    x: "每道题的样本数 k（对数刻度）",
    y: "答对的题目比例",
    cursor: "k = {k}",
    best: "最佳 k = {k}",
    panelB: "k = {k} 时，按单次成功率 p 看每道题",
    panelBShort: "k = {k} 时，按成功率 p 看每道题",
    xB: "题目的单次成功率 p（对数几率刻度）",
    xBShort: "单次成功率 p（对数几率刻度）",
    yB: "答对的概率",
    rug: "刻线：{n} 道题",
    rugOne: "刻线：唯一的提示",
    threshold: "投票分界 p = (1 − p) d",
    rowCov: "覆盖率 Cₖ",
    rowVote: "多数投票 Aₖ",
    rowVer: "学习得到的验证器 Aₖ",
    gap: "差距 {g}",
    covMany: "Cₖ = {n} 道题上 1 − (1 − pᵢ)ᵏ 的平均 = {v}",
    covOne: "Cₖ = 1 − (1 − {p}){ks} = {v}",
    noteOracle: "只要候选中有正确样本，精确核查器就能把它选出来，因此 Aₖ = Cₖ。",
    noteVote: "k 增大时，投票准确率收敛到 {v}，即正确答案比干扰答案更常见的题目所占比例：pᵢ > (1 − pᵢ) d，其中 d = {d}。",
    relMore: "比干扰答案更常见",
    relLess: "不如干扰答案常见",
    relSame: "与干扰答案一样常见",
    noteVoteOne: "k 增大时，这个提示上的投票准确率趋向 {v}：由于 p {cmp} (1 − p) d（d = {d}），正确答案{rel}。",
    noteVoteNone: "d = 0 时错误答案互不重复，投票在每道题上最终都会收敛到 1，只是 p 小的题收敛得慢。",
    noteVer: "k = {k} 时最好（{a}）。错误样本得分高于正确样本的概率为 {e}；β = {b} 时，被高估的错误样本随 k 增多，Aₖ 趋向 0。",
    noteVerZero: "在本坐标范围内 k = {k} 时最好（{a}）。错误样本得分高于正确样本的概率为 {e}；β = 0 时正确样本终会胜出，Aₖ 持续上升。",
    describe: "每道题采样 k = {k} 次时，覆盖率为 {c}。",
    describeVote: "多数投票答对 {v} 的题目。",
    describeVer: "学习得到的验证器答对 {r}，在 k = {bk} 时最好（{ba}）。",
  },
};

const f3 = (v: number) => fixed(v, 3);
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).replace(/[0-9]/g, (ch) => SUP[Number(ch)]);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const c = curves(p);
  const k = Math.min(p.kmax, Math.max(1, Math.round(p.k)));
  const v = atK(p, c, k);
  const vars = { k: int(k), c: f3(v.cov), v: f3(v.vote), r: f3(v.ver), bk: int(c.best.k), ba: f3(c.best.a) };
  return tpl(L.describe, vars) + (p.showVote ? tpl(L.describeVote, vars) : "") + (p.showVerifier ? tpl(L.describeVer, vars) : "");
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const c = curves(p);
  const k = Math.min(p.kmax, Math.max(1, Math.round(p.k)));
  const now = atK(p, c, k);
  const sel: Sel = (p.selector === "vote" && !p.showVote) || (p.selector === "verifier" && !p.showVerifier) ? "oracle" : p.selector;
  const series = [
    { id: "oracle" as const, name: L.cov, color: C.c1, ys: c.cov, at: now.cov, on: true },
    { id: "vote" as const, name: L.vote, color: C.c2, ys: c.vote, at: now.vote, on: p.showVote },
    { id: "verifier" as const, name: L.ver, color: C.c3, ys: c.ver, at: now.ver, on: p.showVerifier },
  ].filter((s) => s.on);
  const selected = series.find((s) => s.id === sel)!;
  const parts: string[] = [];

  // ---- legend
  const items: LegendItem[] = series.map((s) => ({ label: s.name, swatch: { kind: "line", stroke: s.color } }));
  if (sel !== "oracle") items.push({ label: L.gapKey, swatch: { kind: "rect", fill: selected.color, opacity: 0.24 } });
  const lg = legend(items, 0, 0, w, fs);
  parts.push(lg.svg);

  // ---- panel A: accuracy against k
  const left = narrow ? 38 : 44, right = narrow ? 6 : 12;
  const top = lg.height + 26;
  const plotH = narrow ? 210 : 250;
  const x = log([1, p.kmax], [left, w - right]);
  const y = linear([0, 1], [top + plotH, top]);
  const yFmt = (v: number) => `${Math.round(v * 100)}%`;
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], minor: true, title: L.x, size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], title: L.y, format: yFmt, ticks: [0, 0.25, 0.5, 0.75, 1], size: fs }));

  const ptsOf = (ys: number[]) => c.ks.map((kk, i) => [x(kk), y(ys[i])] as [number, number]);
  if (sel !== "oracle") {
    const upper = ptsOf(c.cov), lower = ptsOf(selected.ys).reverse();
    parts.push(el("path", { d: linePath([...upper, ...lower]) + "Z", fill: selected.color, "fill-opacity": 0.18, stroke: "none" }));
  }
  const obstacles: Box[] = [];
  for (const s of series) {
    const pts = ptsOf(s.ys);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: s.color, "stroke-width": s.id === sel ? 2.75 : 1.75, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(pts, 6, 3));
  }

  // Cursor at k with a dot on each curve.
  const xk = x(k);
  parts.push(el("line", { x1: xk, x2: xk, y1: top, y2: top + plotH, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  obstacles.push(...lineObstacles([[xk, top], [xk, top + plotH]], 6, 2));
  // The cursor's value goes above the plot, beside the axis title, or inside
  // the plot's foot when the title is in the way.
  const cursorLabel = tpl(L.cursor, { k: int(k) });
  const cursorAnchor = xk > w - right - 60 ? "end" : "start";
  const cx = cursorAnchor === "end" ? xk - 5 : xk + 5;
  const titleBox = textBox(left, top - 10, L.y, fs);
  const aboveBox = textBox(cx, top - 10, cursorLabel, fs, cursorAnchor);
  const cy = overlaps(aboveBox, titleBox, 6) ? top + plotH - 8 : top - 10;
  parts.push(text(cx, cy, cursorLabel, { "font-size": fs, "text-anchor": cursorAnchor, class: "fig-t-strong fig-t-num fig-t-halo" }));
  obstacles.push(textBox(cx, cy, cursorLabel, fs, cursorAnchor));
  for (const s of series) {
    parts.push(el("circle", { cx: xk, cy: y(s.at), r: s.id === sel ? 5 : 4, fill: s.color, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: xk - 5, y0: y(s.at) - 5, x1: xk + 5, y1: y(s.at) + 5 });
  }

  // The verifier's best k.
  const reqs = [];
  if (p.showVerifier) {
    const bx = x(c.best.k), by = y(c.best.a);
    parts.push(el("circle", { cx: bx, cy: by, r: 4.5, fill: C.paper, stroke: C.c3, "stroke-width": 2 }));
    obstacles.push({ x0: bx - 5, y0: by - 5, x1: bx + 5, y1: by + 5 });
    reqs.push({ x: bx, y: by, text: tpl(L.best, { k: int(c.best.k) }), size: fs, sides: ["above", "above-right", "above-left", "right", "below-right", "below", "below-left", "left"] as const, gap: 9, priority: 2, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  const placed = placeLabels(reqs.map((r) => ({ ...r, sides: [...r.sides] })), { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: top + plotH - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  // ---- panel B: each problem at this k, by its one-sample success
  let yy = top + plotH + axisHeight(true, fs) + 22;
  for (const ln of wrap(tpl(narrow ? L.panelBShort : L.panelB, { k: int(k) }), TYPE.label, w)) {
    parts.push(text(0, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    yy += 18;
  }
  const topB = yy + 18;
  const plotHB = narrow ? 150 : 170;
  const xb = logitScale([0.0005, 0.9995], [left, w - right]);
  const yb = linear([0, 1], [topB + plotHB, topB]);
  parts.push(axis({ scale: xb, orient: "bottom", at: topB + plotHB, grid: [topB, topB + plotHB], title: narrow ? L.xBShort : L.xB, size: fs }));
  parts.push(axis({ scale: yb, orient: "left", at: left, grid: [left, w - right], format: yFmt, ticks: [0, 0.5, 1], title: L.yB, size: fs }));
  // Curves over p: 1 − (1 − p)^k, the vote, the verifier.
  const pGrid: number[] = [];
  for (let i = 0; i <= 90; i++) pGrid.push(xb.invert(left + ((w - right - left) * i) / 90));
  const curvesB = series.map((s) => {
    const f = s.id === "oracle" ? (q: number) => coverage(q, k)
      : s.id === "vote" ? (q: number) => voteAccuracy(q, p.share, k)
        : (q: number) => verifierAccuracy(q, p.fp, p.noise, k);
    const pts = pGrid.map((q) => [xb(q), yb(f(q))] as [number, number]);
    return { s, pts };
  });
  // Rug of the benchmark's problems along the baseline.
  // Problems beyond the axis range sit at its edge.
  for (const q of c.ps) parts.push(el("line", { x1: xb(xb.clamp(q)), x2: xb(xb.clamp(q)), y1: topB + plotHB, y2: topB + plotHB - 7, stroke: C.ink2, "stroke-width": 1 }));
  // Where voting flips: the correct answer is as common as the distractor.
  if (p.showVote && p.share > 0) {
    const pStar = p.share / (1 + p.share);
    if (pStar > 0.0005 && pStar < 0.9995) {
      const xs = xb(pStar);
      parts.push(el("line", { x1: xs, x2: xs, y1: topB, y2: topB + plotHB, stroke: C.c2, "stroke-width": 1, "stroke-dasharray": "4 3" }));
    }
  }
  for (const { s, pts } of curvesB) {
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: s.color, "stroke-width": s.id === sel ? 2.75 : 1.75, "stroke-linejoin": "round" }));
  }
  yy = topB + plotHB + axisHeight(true, fs) + 14;
  parts.push(text(0, yy, p.spread > 0 ? tpl(L.rug, { n: PROBLEMS }) : L.rugOne, { "font-size": fs, class: "fig-t-muted" }));
  if (p.showVote && p.share > 0) {
    const th = legend([{ label: L.threshold, swatch: { kind: "line", stroke: C.c2, dash: "4 3" } }], 0, yy + 6, w, fs);
    parts.push(th.svg);
    yy += th.height + 2;
  }

  // ---- readout: the value of each selector at k, on a fixed 0 to 1 bar
  yy += 26;
  const rows = [
    { id: "oracle" as Sel, name: L.rowCov, v: now.cov, color: C.c1, on: true },
    { id: "vote" as Sel, name: L.rowVote, v: now.vote, color: C.c2, on: p.showVote },
    { id: "verifier" as Sel, name: L.rowVer, v: now.ver, color: C.c3, on: p.showVerifier },
  ].filter((r) => r.on);
  const rp: string[] = [];
  const vals = rows.map((r) => (r.id === "oracle" ? f3(r.v) : `${f3(r.v)}   ${tpl(L.gap, { g: f3(now.cov - r.v) })}`));
  const nameW = narrow ? 0 : Math.max(...rows.map((r) => textWidth(r.name, fs))) + 16;
  const valW = narrow ? 0 : Math.max(...vals.map((v) => textWidth(v, fs))) + 16;
  const barX = nameW, barW = narrow ? w : w - nameW - valW;
  for (const [ri, r] of rows.entries()) {
    const cls = r.id === sel ? "fig-t-strong" : "";
    const val = vals[ri];
    if (narrow) {
      rp.push(text(0, yy, r.name, { "font-size": fs, class: cls }));
      rp.push(text(w, yy, val, { "font-size": fs, "text-anchor": "end", class: `${cls} fig-t-num` }));
      yy += 6;
    }
    const by = narrow ? yy : yy - 11;
    rp.push(el("rect", { x: barX, y: by, width: barW, height: 12, rx: 2, fill: C.panel }));
    rp.push(el("rect", { x: barX, y: by, width: Math.max(1.5, r.v * barW), height: 12, rx: 2, fill: r.color }));
    if (r.id !== "oracle") rp.push(el("line", { x1: barX + now.cov * barW, x2: barX + now.cov * barW, y1: by - 3, y2: by + 15, stroke: C.ink, "stroke-width": 1.5 }));
    if (!narrow) {
      rp.push(text(0, yy, r.name, { "font-size": fs, class: cls }));
      rp.push(text(w, yy, val, { "font-size": fs, "text-anchor": "end", class: `${cls} fig-t-num` }));
    }
    yy += narrow ? 32 : 24;
  }
  yy += 4;
  const covLine = p.spread > 0
    ? tpl(L.covMany, { n: PROBLEMS, v: f3(now.cov) })
    : tpl(L.covOne, { p: sig(c.ps[0], 3), ks: sup(k), v: f3(now.cov) });
  const e = pct(pairError(p.fp, p.noise), 1);
  const note = sel === "oracle" ? L.noteOracle
    : sel === "vote" ? (p.share === 0 ? L.noteVoteNone
      : p.spread > 0 ? tpl(L.noteVote, { v: f3(c.plateau), d: sig(p.share, 2) })
        : (() => {
          const q = c.ps[0], b = (1 - q) * p.share;
          const cmp = q > b ? ">" : q < b ? "<" : "=";
          const rel = q > b ? L.relMore : q < b ? L.relLess : L.relSame;
          return tpl(L.noteVoteOne, { v: sig(c.plateau, 2), rel, cmp, d: sig(p.share, 2) });
        })())
      : tpl(p.fp > 0 ? L.noteVer : L.noteVerZero, { k: int(c.best.k), a: f3(c.best.a), e, b: sig(p.fp, 2) });
  // Chinese lines keep closing punctuation off the line start; the helper may
  // move one mark back past the width, so it wraps one glyph narrower.
  const wrapRead = (s: string) => (lang === "zh" ? wrapCjk(s, fs, w - fs) : wrap(s, fs, w));
  for (const ln of wrapRead(covLine)) { rp.push(text(0, yy, ln, { "font-size": fs, class: "fig-t-num" })); yy += 17; }
  yy += 2;
  for (const ln of wrapRead(note)) { rp.push(text(0, yy, ln, { "font-size": fs, class: "fig-t-muted" })); yy += 17; }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "coverage-selection",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    selector: {
      kind: "choice", label: { en: "Selector", zh: "选择器" }, default: "verifier",
      options: [
        { value: "oracle", label: { en: "Exact checker", zh: "精确核查器" } },
        { value: "vote", label: { en: "Majority vote", zh: "多数投票" } },
        { value: "verifier", label: { en: "Learned verifier", zh: "学习得到的验证器" } },
      ],
    },
    k: {
      kind: "range", scale: "log", label: { en: "Samples per problem k", zh: "每道题的样本数 k" },
      min: 1, max: 10000, default: 100,
    },
    p: {
      kind: "range", scale: "log", label: { en: "One-sample success p (median problem)", zh: "单次采样成功率 p（中位题目）" },
      min: 0.001, max: 0.9, default: 0.3,
    },
    spread: {
      kind: "range", label: { en: "Difficulty spread across problems (log-odds SD)", zh: "题目难度的离散程度（对数几率标准差）" },
      min: 0, max: 3, step: 0.1, default: 2,
      marks: [{ value: 0, label: { en: "one prompt", zh: "单个提示" } }],
    },
    share: {
      kind: "range", label: { en: "Wrong samples giving one shared wrong answer, d", zh: "给出同一错误答案的错误样本比例 d" },
      min: 0, max: 1, step: 0.05, default: 0.25,
    },
    fp: {
      kind: "range", label: { en: "Wrong samples the verifier overrates, β", zh: "被验证器高估的错误样本比例 β" },
      min: 0, max: 0.3, step: 0.005, default: 0.05,
    },
    noise: {
      kind: "range", label: { en: "Verifier score noise σ", zh: "验证器评分噪声 σ" },
      min: 0.1, max: 1, step: 0.05, default: 0.4,
    },
    kmax: {
      kind: "choice", label: { en: "Largest k on the axis", zh: "坐标轴上的最大 k" }, default: 10000, control: false,
      options: [
        { value: 1000, label: { en: "1,000", zh: "1,000" } },
        { value: 10000, label: { en: "10,000", zh: "10,000" } },
      ],
    },
    showVote: { kind: "toggle", label: { en: "Show majority vote", zh: "显示多数投票" }, default: true, control: false },
    showVerifier: { kind: "toggle", label: { en: "Show learned verifier", zh: "显示学习得到的验证器" }, default: true, control: false },
  },
  // Samples are whole: round the log slider's value, and keep k on the axis.
  update(p, key) {
    if (key === "k" || key === "kmax") return { ...p, k: Math.min(p.kmax, Math.max(1, Math.round(p.k))) };
    return p;
  },
  render,
  describe,
});
