// Reward over-optimization against distance from the reference policy, on the
// synthetic gold-reward setup of Gao, Schulman and Hilton (2022). A 6B "gold"
// reward model labels comparisons that train a smaller proxy reward model; a
// 1.2B policy is optimized against the proxy, and the gold model scores the
// result. The figure draws, against KL(π‖π_init) on the paper's square-root
// axis:
//
//   the measured proxy and gold scores of one run (traced from the paper's
//   figures), and the paper's fitted law for the gold score, with d = √KL,
//     best-of-n  R(d) = d (a − b d)
//     RL (PPO)   R(d) = d (a − b ln d)
//   where a and b are the paper's α and β (renamed because β is the KL
//   coefficient in this chapter), taken per reward-model size from Figure 3;
//   the RL a is one constant across sizes, recovered by the data script.
//
// The timeline is the optimization itself: PPO steps for RL, with KL per
// step as measured in each run, and n for best-of-n, with KL = ln n − (n−1)/n.
// A KL coefficient β > 0 exists only for the 1.2B reward model (the paper's
// Figure 9 runs); choosing one selects that reward model. All values come from
// data/reward-overoptimization.ts, which tools/figure-data/
// reward-overoptimization-gao2022.py regenerates from the paper's PDF.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, wrap as wrapText, type Box, type LabelRequest } from "./lib/labels.ts";
import { legend } from "./lib/legend.ts";
import { fixed, int, sig, tpl } from "./lib/format.ts";
import { ALPHA_RL, BON, COEF, RL, type Trace } from "./data/reward-overoptimization.ts";

type Method = "rl" | "bon";
type Size = "12M" | "1.2B" | "3B";
type Beta = "0" | "0.01" | "0.05" | "0.1" | "0.5";
type P = { method: Method; rm: Size; beta: Beta };

const SIZES = Object.keys(COEF); // 3M .. 3B, the nine sizes of Figure 3
const BETAS: Beta[] = ["0", "0.01", "0.05", "0.1", "0.5"];
const STEP = 0.05; // million PPO steps per timeline position (the data grid)
const BON_POSITIONS = 60;
const BON_NMAX = 40000; // KL 9.6, inside every traced best-of-n curve
const KL_TICKS = { rl: [0, 1, 5, 10, 20, 40, 60, 80, 100], bon: [0, 0.1, 0.5, 1, 2, 4, 6, 8, 10] };
const SCORE = { rl: { max: 2, ticks: [0, 0.5, 1, 1.5, 2] }, bon: { max: 1.6, ticks: [0, 0.4, 0.8, 1.2, 1.6] } };

const labels = {
  en: {
    title: "Proxy and gold reward as the policy moves from the reference",
    x: "KL from the reference policy (nats), square-root scale",
    y: "reward-model score (gold units)",
    proxy: "proxy, measured",
    gold: "gold, measured",
    fit: "gold, fitted law",
    peaks: "fitted peak per RM size, 3M to 3B",
    peak: "fitted peak",
    gap: "gap {v}",
    stop: "KL settles near {k}",
    rising: "KL {k} at the end of the run, still rising",
    stepsTitle: "KL during PPO; every run clips at ε = 0.2",
    stepsTitleBon: "Best-of-n: KL = ln n − (n − 1)/n",
    steps: "PPO step (millions)",
    klAxis: "KL (nats)",
    nAxis: "n (log scale)",
    others: "black: β = {b}; grey: the other β runs of the 1.2B RM",
    single: "β = 0: this run has no KL penalty",
    rBeta: "β",
    betaVal: "{b}, {s}",
    rStep: "PPO step",
    rN: "n",
    rKl: "KL",
    rProxy: "proxy",
    rGold: "gold",
    rGap: "gap",
    klVal: "{k} nats, d = √KL = {d}",
    measured: "measured",
    fitRl: "fitted gold R(d) = d (a − b ln d)",
    fitBon: "fitted gold R(d) = d (a − b d)",
    terms: "= {d} × ({a} − {b} × {l}) = {r}",
    peakAt: "fitted peak: KL {k}, R = {r}",
    peakAtBon: "fitted peak: KL {k} (n ≈ {n}), R = {r}",
    peakBeyond: "fitted peak: KL {k}, R = {r}, beyond this run",
    source: "Gao, Schulman and Hilton (2022), traced from the paper's figures; 1.2B policy",
    kfPeak: "Fitted gold peaks at KL {k}",
    kfSettle: "β = {b} holds KL near {k}",
    kfEnd: "Run ends after {s}M PPO steps, KL {k}",
    kfEndBon: "n = {n}, KL {k}",
    methodRl: "RL (PPO)",
    methodBon: "Best-of-n",
    describe: "{method} against the {rm} proxy reward model{beta}, at {pos}: KL {k} nats, proxy score {px}, gold score {gd}, a gap of {gap}. The fitted gold score peaks at KL {pk}.",
    betaPart: " with KL coefficient {b}",
    posStep: "PPO step {s}M",
    posN: "n = {n}",
  },
  zh: {
    title: "策略偏离参考模型时的代理分数与金标准分数",
    x: "相对参考策略的 KL（nats，平方根刻度）",
    y: "奖励模型分数（金标准单位）",
    proxy: "代理分数，实测",
    gold: "金标准分数，实测",
    fit: "金标准分数，拟合规律",
    peaks: "各规模奖励模型的拟合峰值，3M 至 3B",
    peak: "拟合峰值",
    gap: "差距 {v}",
    stop: "KL 稳定在 {k} 附近",
    rising: "运行结束时 KL 为 {k}，仍在上升",
    stepsTitle: "PPO 训练中的 KL；所有运行的裁剪宽度均为 ε = 0.2",
    stepsTitleBon: "best-of-n：KL = ln n − (n − 1)/n",
    steps: "PPO 步数（百万）",
    klAxis: "KL（nats）",
    nAxis: "n（对数刻度）",
    others: "黑线：β = {b}；灰线：1.2B 奖励模型的其他 β 运行",
    single: "β = 0：这次运行没有 KL 惩罚",
    rBeta: "β",
    betaVal: "{b}，{s}",
    rStep: "PPO 步数",
    rN: "n",
    rKl: "KL",
    rProxy: "代理",
    rGold: "金标准",
    rGap: "差距",
    klVal: "{k} nats，d = √KL = {d}",
    measured: "实测",
    fitRl: "金标准拟合 R(d) = d (a − b ln d)",
    fitBon: "金标准拟合 R(d) = d (a − b d)",
    terms: "= {d} × ({a} − {b} × {l}) = {r}",
    peakAt: "拟合峰值：KL {k}，R = {r}",
    peakAtBon: "拟合峰值：KL {k}（n ≈ {n}），R = {r}",
    peakBeyond: "拟合峰值：KL {k}，R = {r}，本次运行未达到",
    source: "Gao、Schulman 与 Hilton（2022），据论文图表描点；策略模型 1.2B",
    kfPeak: "金标准拟合在 KL {k} 处达到峰值",
    kfSettle: "β = {b} 把 KL 限制在 {k} 附近",
    kfEnd: "运行在 PPO {s}M 步时结束，KL 为 {k}",
    kfEndBon: "n = {n}，KL 为 {k}",
    methodRl: "强化学习（PPO）",
    methodBon: "best-of-n",
    describe: "{method}针对 {rm} 代理奖励模型进行优化{beta}，位于{pos}：KL 为 {k} nats，代理分数 {px}，金标准分数 {gd}，差距 {gap}。金标准拟合分数在 KL {pk} 处达到峰值。",
    betaPart: "，KL 系数为 {b}",
    posStep: "第 {s}M 步",
    posN: "n = {n}",
  },
};

// ---- model

// Linear interpolation in the first coordinate; holds the end values outside.
function at(tr: Trace, x: number, f: (v: number) => number = (v) => v): number {
  const u = f(x);
  if (u <= f(tr[0][0])) return tr[0][1];
  for (let i = 1; i < tr.length; i++) {
    const u0 = f(tr[i - 1][0]), u1 = f(tr[i][0]);
    if (u <= u1) return tr[i - 1][1] + ((tr[i][1] - tr[i - 1][1]) * (u - u0)) / (u1 - u0 || 1);
  }
  return tr[tr.length - 1][1];
}
const end = (tr: Trace) => tr[tr.length - 1][0];

// The gold fit for one size and method, and where it peaks.
function coef(method: Method, size: string) {
  const c = COEF[size];
  return method === "rl" ? { a: ALPHA_RL, b: c.betaRl } : { a: c.alphaBon, b: c.betaBon };
}
function fitAt(method: Method, size: string, kl: number): number {
  const { a, b } = coef(method, size);
  const d = Math.sqrt(kl);
  if (d === 0) return 0; // R(0) = 0 by definition; d ln d → 0
  return method === "rl" ? d * (a - b * Math.log(d)) : d * (a - b * d);
}
function fitPeak(method: Method, size: string): { kl: number; r: number } {
  const { a, b } = coef(method, size);
  const d = method === "rl" ? Math.exp(a / b - 1) : a / (2 * b);
  return { kl: d * d, r: method === "rl" ? b * d : (a * a) / (4 * b) };
}
const bonKl = (n: number) => Math.log(n) - (n - 1) / n;
const bonN = (t: number) => Math.max(1, Math.round(BON_NMAX ** (t / BON_POSITIONS)));
// n at which best-of-n reaches a given KL (bisection on ln n).
function nForKl(kl: number): number {
  let lo = 0, hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bonKl(Math.exp(mid)) < kl) lo = mid; else hi = mid;
  }
  return Math.exp(hi);
}

// Wrap, then pull full-width punctuation that would open a line back onto the
// line before it (the shared wrap breaks between any two CJK glyphs).
function wrap(s: string, size: number, width: number): string[] {
  const out = wrapText(s, size, width);
  for (let i = 1; i < out.length; i++) {
    const m = out[i].match(/^[，。；：、）]+/);
    if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length).trimStart(); }
  }
  return out.filter((ln) => ln.length > 0);
}

// A run has settled when its KL grew by less than 12% over its last million
// steps (Figure 14: β = 0.05, 0.1 and 0.5 flatten; β = 0.01 is still rising).
function settled(steps: Trace): boolean {
  const last = end(steps);
  return at(steps, last) < 1.12 * at(steps, Math.max(0, last - 1));
}

function runOf(p: P) {
  const beta: Beta = p.rm === "1.2B" ? p.beta : "0";
  const r = RL[p.rm][beta] ?? RL[p.rm]["0"];
  return { beta, ...r };
}

function duration(p: P): number {
  return p.method === "bon" ? BON_POSITIONS : Math.round(end(runOf(p).steps) / STEP);
}

// The state of the run at timeline position t.
function stateAt(p: P, t: number) {
  const sq = Math.sqrt;
  if (p.method === "bon") {
    const n = bonN(t);
    const kl = bonKl(n);
    const tr = BON[p.rm];
    return { n, step: 0, kl, proxy: at(tr.proxy, kl, sq), gold: at(tr.gold, kl, sq), fit: fitAt("bon", p.rm, kl) };
  }
  const run = runOf(p);
  const step = Math.min(t * STEP, end(run.steps));
  // The traced score curves can end a little before the KL-per-step curve.
  const kl = Math.min(at(run.steps, step), end(run.proxy), end(run.gold));
  return { n: 0, step, kl, proxy: at(run.proxy, kl, sq), gold: at(run.gold, kl, sq), fit: fitAt("rl", p.rm, kl) };
}

function keyframes(p: P, lang: Lang) {
  const L = labels[lang];
  const T = duration(p);
  const out: Array<{ t: number; label: string }> = [];
  const pk = fitPeak(p.method, p.rm);
  const first = (pred: (t: number) => boolean) => { for (let t = 0; t <= T; t++) if (pred(t)) return t; return -1; };
  const tp = first((t) => stateAt(p, t).kl >= pk.kl);
  if (tp > 0) out.push({ t: tp, label: tpl(L.kfPeak, { k: sig(pk.kl, 2) }) });
  if (p.method === "rl") {
    const run = runOf(p);
    const final = at(run.steps, end(run.steps));
    if (run.beta !== "0" && settled(run.steps)) {
      const ts = first((t) => stateAt(p, t).kl >= 0.9 * final);
      if (ts > 0 && ts < T) out.push({ t: ts, label: tpl(L.kfSettle, { b: run.beta, k: sig(final, 3) }) });
    }
    out.push({ t: T, label: tpl(L.kfEnd, { s: fixed(end(run.steps), 2), k: sig(stateAt(p, T).kl, 3) }) });
  } else {
    out.push({ t: T, label: tpl(L.kfEndBon, { n: int(bonN(T)), k: fixed(stateAt(p, T).kl, 1) }) });
  }
  return out.sort((a, b) => a.t - b.t);
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const s = stateAt(p, Math.round(st.t));
  const beta = p.method === "rl" ? runOf(p).beta : "0";
  return tpl(L.describe, {
    method: p.method === "rl" ? L.methodRl : L.methodBon, rm: p.rm,
    beta: beta !== "0" ? tpl(L.betaPart, { b: beta }) : "",
    pos: p.method === "rl" ? tpl(L.posStep, { s: fixed(s.step, 2) }) : tpl(L.posN, { n: int(s.n) }),
    k: sig(s.kl, 3), px: fixed(s.proxy, 2), gd: fixed(s.gold, 2), gap: fixed(s.proxy - s.gold, 2),
    pk: sig(fitPeak(p.method, p.rm).kl, 2),
  });
}

// ---- drawing

// Polyline of a trace in plot coordinates, split at the current KL into the
// part the run has covered and the part still ahead.
function tracePts(tr: Trace, x: (kl: number) => number, y: (v: number) => number): Array<[number, number]> {
  return tr.map(([k, v]) => [x(k), y(v)] as [number, number]);
}
function splitAt(pts: Array<[number, number]>, px: number): [Array<[number, number]>, Array<[number, number]>] {
  const done: Array<[number, number]> = [], ahead: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const [xx, yy] = pts[i];
    if (xx <= px) done.push([xx, yy]);
    else {
      if (i > 0 && pts[i - 1][0] < px) {
        const [x0, y0] = pts[i - 1];
        const cut: [number, number] = [px, y0 + ((yy - y0) * (px - x0)) / (xx - x0)];
        done.push(cut);
        ahead.push(cut);
      }
      ahead.push([xx, yy]);
    }
  }
  return [done, ahead];
}

function mainPlot(p: P, t: number, w: number, lang: Lang, y0: number) {
  const L = labels[lang];
  const narrow = w < 480;
  const m = p.method;
  const s = stateAt(p, t);
  const parts: string[] = [];

  const lg = legend([
    { label: L.proxy, swatch: { kind: "line", stroke: C.c2, dash: "5 3" } },
    { label: L.gold, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.fit, swatch: { kind: "line", stroke: C.c1, dash: "1.5 3" } },
    { label: L.peaks, swatch: { kind: "dot", fill: C.ink3 } },
  ], 0, y0, w, TYPE.small);
  parts.push(lg.svg);

  const left = narrow ? 34 : 40;
  const right = narrow ? 6 : 10;
  const top = y0 + lg.height + 22;
  const plotH = narrow ? 200 : 236;
  const bottom = top + plotH;
  const dMax = Math.sqrt(KL_TICKS[m][KL_TICKS[m].length - 1]);
  const xd = linear([0, dMax], [left, w - right]);
  const x = (kl: number) => xd(Math.sqrt(Math.max(0, kl)));
  const y = linear([0, SCORE[m].max], [bottom, top]);

  parts.push(axis({ scale: xd, orient: "bottom", at: bottom, ticks: KL_TICKS[m].map(Math.sqrt), format: (v) => sig(v * v, 2), grid: [top, bottom], title: L.x }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: SCORE[m].ticks, format: (v) => sig(v, 2), grid: [left, w - right], title: L.y }));

  const obstacles: Box[] = [];
  const cx = x(s.kl);

  // Fitted law for the chosen size, over the whole axis.
  const fitPts: Array<[number, number]> = [];
  for (let i = 0; i <= 80; i++) {
    const kl = (dMax * i / 80) ** 2;
    const v = fitAt(m, p.rm, kl);
    if (v < -0.05) break;
    fitPts.push([x(kl), y(Math.max(0, v))]);
  }
  parts.push(el("path", { d: linePath(fitPts), fill: "none", stroke: C.c1, "stroke-width": 1.4, "stroke-dasharray": "1.5 3", "stroke-linecap": "round" }));
  obstacles.push(...lineObstacles(fitPts));

  // Fitted peaks of all nine sizes, the chosen one filled.
  const locus = SIZES.map((sz) => ({ sz, ...fitPeak(m, sz) })).filter((q) => q.kl <= dMax * dMax);
  const locusPts = locus.map((q) => [x(q.kl), y(q.r)] as [number, number]);
  if (locusPts.length > 1) {
    parts.push(el("path", { d: linePath(locusPts), fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-opacity": 0.6 }));
    obstacles.push(...lineObstacles(locusPts));
  }
  for (const q of locus) {
    const on = q.sz === p.rm;
    parts.push(el("circle", { cx: x(q.kl), cy: y(q.r), r: on ? 4.5 : 3, fill: on ? C.c1 : C.ink3, stroke: C.paper, "stroke-width": on ? 1.5 : 1 }));
    obstacles.push({ x0: x(q.kl) - 4, y0: y(q.r) - 4, x1: x(q.kl) + 4, y1: y(q.r) + 4 });
  }

  // The run: proxy dashed, gold solid; covered part opaque, the rest faint.
  const tr = m === "bon" ? BON[p.rm] : runOf(p);
  for (const [series, color, dash] of [[tr.gold, C.c1, undefined], [tr.proxy, C.c2, "5 3"]] as const) {
    const pts = tracePts(series, x, y);
    const [done, ahead] = splitAt(pts, cx);
    if (ahead.length > 1) parts.push(el("path", { d: linePath(ahead), fill: "none", stroke: color, "stroke-width": 2, "stroke-opacity": 0.28, "stroke-dasharray": dash }));
    if (done.length > 1) parts.push(el("path", { d: linePath(done), fill: "none", stroke: color, "stroke-width": 2.2, "stroke-dasharray": dash, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(pts));
  }

  // Where a β > 0 run settles.
  const reqs: LabelRequest[] = [];
  if (m === "rl" && runOf(p).beta !== "0") {
    const run = runOf(p);
    const final = at(run.steps, end(run.steps));
    const sx = x(final);
    parts.push(el("line", { x1: sx, x2: sx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
    obstacles.push(...lineObstacles([[sx, top], [sx, bottom]]));
    reqs.push({ x: sx, y: top + 8, text: `β = ${run.beta}`, size: TYPE.small, sides: ["right", "left"], gap: 6, priority: 5, attrs: { class: "fig-t-halo fig-t-num" } });
  }

  // Current position: a rule, the two scores, and the gap between them.
  const py = y(s.proxy), gy = y(s.gold);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  const bx = cx + (cx > w - right - 60 ? -9 : 9);
  parts.push(el("path", { d: `M${bx - 3},${py}H${bx}V${gy}H${bx - 3}`, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
  obstacles.push({ x0: Math.min(bx, cx) - 5, y0: Math.min(py, gy) - 5, x1: Math.max(bx, cx) + 5, y1: Math.max(py, gy) + 5 });
  const gapReq: LabelRequest = { x: bx, y: (py + gy) / 2, text: tpl(L.gap, { v: fixed(s.proxy - s.gold, 2) }), size: TYPE.body, sides: bx < cx ? ["left", "right"] : ["right", "left"], gap: 5, priority: 6, attrs: { class: "fig-t-halo fig-t-num" } };
  reqs.push(gapReq);
  const pk = fitPeak(m, p.rm);
  if (pk.kl <= dMax * dMax) reqs.push({ x: x(pk.kl), y: y(pk.r), text: L.peak, size: TYPE.small, sides: ["above", "above-left", "above-right", "below"], gap: 9, priority: 3, attrs: { class: "fig-t-halo fig-t-soft" } });
  const bounds = { x0: left + 2, y0: top + 1, x1: w - right, y1: bottom - 2 };
  const placed = placeLabels(reqs, bounds, obstacles);
  parts.push(drawLabels(placed.placed));
  // The gap label is the point of the figure: if every clear spot is taken,
  // place it against the bracket and the two markers only (it has a halo).
  if (placed.dropped.includes(gapReq)) {
    const again = placeLabels([{ ...gapReq, sides: ["right", "left", "above-right", "below-right", "above-left", "below-left"] }], bounds,
      [...placed.placed.map((q) => q.box), { x0: Math.min(bx, cx) - 5, y0: Math.min(py, gy) - 5, x1: Math.max(bx, cx) + 5, y1: Math.max(py, gy) + 5 }]);
    parts.push(drawLabels(again.placed));
  }
  parts.push(el("circle", { cx, cy: gy, r: 4.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx, cy: py, r: 4.5, fill: C.c2, stroke: C.paper, "stroke-width": 1.5 }));

  return { svg: g({ class: "fig-main" }, ...parts), h: bottom + axisHeight(true) - y0 };
}

function stepsPlot(p: P, t: number, x0: number, y0: number, w: number, lang: Lang) {
  const L = labels[lang];
  const narrow = w < 360;
  const parts: string[] = [];
  const s = stateAt(p, t);
  const lines = wrap(p.method === "rl" ? L.stepsTitle : L.stepsTitleBon, TYPE.body, w);
  lines.forEach((ln, i) => parts.push(text(x0, y0 + 13 + i * 16, ln, { "font-size": TYPE.body, class: "fig-t-strong" })));
  const top = y0 + lines.length * 16 + 30; // room for the y-axis title above the plot
  const left = x0 + (narrow ? 30 : 34);
  const right = x0 + w - 8;
  const plotH = 118;
  const bottom = top + plotH;

  if (p.method === "rl") {
    const xs = linear([0, 3], [left, right]);
    const ys = linear([0, 110], [bottom, top]);
    parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], format: (v) => sig(v, 2), grid: [top, bottom], title: L.steps }));
    parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 25, 50, 75, 100], grid: [left, right], title: L.klAxis }));
    const run = runOf(p);
    const shown: Beta[] = p.rm === "1.2B" ? BETAS : ["0"];
    for (const b of shown) {
      if (b === run.beta) continue;
      const pts = RL[p.rm][b].steps.map(([st, k]) => [xs(st), ys(k)] as [number, number]);
      parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink3, "stroke-width": 1.2 }));
      // A wide invisible stroke makes the grey run selectable by pointer; the
      // β control is the keyboard path.
      parts.push(el("path", { d: linePath(pts), fill: "none", stroke: "transparent", "stroke-width": 10, "data-fig-set": `beta=${b}`, class: "fig-hit" }));
    }
    const pts = run.steps.map(([st, k]) => [xs(st), ys(k)] as [number, number]);
    const [done, ahead] = splitAt(pts, xs(s.step));
    if (ahead.length > 1) parts.push(el("path", { d: linePath(ahead), fill: "none", stroke: C.ink, "stroke-width": 1.6, "stroke-opacity": 0.35 }));
    parts.push(el("path", { d: linePath(done), fill: "none", stroke: C.ink, "stroke-width": 2 }));
    parts.push(el("circle", { cx: xs(s.step), cy: ys(at(run.steps, s.step)), r: 4, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
    let yy = bottom + axisHeight(true) + 10;
    const note = p.rm === "1.2B" ? tpl(L.others, { b: run.beta }) : L.single;
    for (const ln of wrap(note, TYPE.small, w)) {
      parts.push(text(x0, yy, ln, { "font-size": TYPE.small, class: "fig-t-muted" }));
      yy += 15;
    }
    return { svg: g({ class: "fig-steps" }, ...parts), h: yy - y0 };
  }

  const xs = log([1, BON_NMAX], [left, right]);
  const ys = linear([0, 10], [bottom, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [1, 10, 100, 1000, 10000], grid: [top, bottom], title: L.nAxis, minor: true }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 2.5, 5, 7.5, 10], format: (v) => sig(v, 2), grid: [left, right], title: L.klAxis }));
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 80; i++) {
    const n = BON_NMAX ** (i / 80);
    pts.push([xs(n), ys(bonKl(n))]);
  }
  const [done, ahead] = splitAt(pts, xs(s.n));
  if (ahead.length > 1) parts.push(el("path", { d: linePath(ahead), fill: "none", stroke: C.ink, "stroke-width": 1.6, "stroke-opacity": 0.35 }));
  if (done.length > 1) parts.push(el("path", { d: linePath(done), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  parts.push(el("circle", { cx: xs(s.n), cy: ys(s.kl), r: 4, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  return { svg: g({ class: "fig-steps" }, ...parts), h: bottom + axisHeight(true) - y0 };
}

function readout(p: P, t: number, x0: number, y0: number, w: number, lang: Lang) {
  const L = labels[lang];
  const s = stateAt(p, t);
  const m = p.method;
  const { a, b } = coef(m, p.rm);
  const d = Math.sqrt(s.kl);
  const parts: string[] = [];
  const valX = x0 + Math.min(92, Math.max(64, w * 0.3));
  let y = y0 + 13;
  const row = (name: string, value: string, cls = "fig-t-num") => {
    parts.push(text(x0, y, name, { "font-size": TYPE.body, class: "fig-t-muted" }));
    for (const [i, ln] of wrap(value, TYPE.body, x0 + w - valX).entries()) parts.push(text(valX, y + i * 16, ln, { "font-size": TYPE.body, class: cls }));
    y += 16 * wrap(value, TYPE.body, x0 + w - valX).length + 3;
  };
  if (m === "rl") {
    const run = runOf(p);
    const final = at(run.steps, end(run.steps));
    row(L.rBeta, run.beta === "0" ? "0" : tpl(L.betaVal, { b: run.beta, s: tpl(settled(run.steps) ? L.stop : L.rising, { k: sig(final, 3) }) }));
    row(L.rStep, `${fixed(s.step, 2)}M`);
  }
  else row(L.rN, int(s.n));
  row(L.rKl, tpl(L.klVal, { k: sig(s.kl, 3), d: fixed(d, 2) }));
  row(L.rProxy, `${fixed(s.proxy, 2)}  (${L.measured})`);
  row(L.rGold, `${fixed(s.gold, 2)}  (${L.measured})`);
  row(L.rGap, fixed(s.proxy - s.gold, 2), "fig-t-strong fig-t-num");
  y += 6;
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y - 10, y2: y - 10, stroke: C.grid, "stroke-width": 1 }));
  y += 4;
  const lnTerm = m === "rl" ? fixed(Math.log(Math.max(d, 1e-9)), 2) : fixed(d, 2);
  const lines = [
    [m === "rl" ? L.fitRl : L.fitBon, "fig-t-muted"],
    [tpl(L.terms, { d: fixed(d, 2), a: fixed(a, 3), b: fixed(b, 3), l: lnTerm, r: fixed(s.fit, 2) }), "fig-t-num"],
  ] as const;
  for (const [ln, cls] of lines) {
    for (const part of wrap(ln, TYPE.body, w)) { parts.push(text(x0, y, part, { "font-size": TYPE.body, class: cls })); y += 16; }
  }
  const pk = fitPeak(m, p.rm);
  const reached = m === "rl" ? at(runOf(p).steps, end(runOf(p).steps)) >= pk.kl : pk.kl <= bonKl(BON_NMAX);
  const peakTpl = !reached ? L.peakBeyond : m === "bon" ? L.peakAtBon : L.peakAt;
  const n = m === "bon" && reached ? int(Number(sig(nForKl(pk.kl), 2).replace(/,/g, ""))) : "";
  for (const part of wrap(tpl(peakTpl, { k: sig(pk.kl, 2), r: fixed(pk.r, 2), n }), TYPE.body, w)) {
    parts.push(text(x0, y, part, { "font-size": TYPE.body, class: "fig-t-num" })); y += 16;
  }
  y += 4;
  for (const part of wrap(L.source, TYPE.small, w)) { parts.push(text(x0, y, part, { "font-size": TYPE.small, class: "fig-t-faint" })); y += 14; }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = Math.round(st.t);
  const main = mainPlot(p, t, w, lang, 0);
  let y = main.h + 16;
  const parts = [main.svg];
  if (narrow) {
    const sp = stepsPlot(p, t, 0, y, w, lang);
    parts.push(sp.svg); y += sp.h + 14;
    const ro = readout(p, t, 0, y, w, lang);
    parts.push(ro.svg); y += ro.h;
  } else {
    const lw = Math.floor(w * 0.52);
    const sp = stepsPlot(p, t, 0, y, lw, lang);
    const ro = readout(p, t, lw + 24, y, w - lw - 24, lang);
    parts.push(sp.svg, ro.svg);
    y += Math.max(sp.h, ro.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "reward-overoptimization",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    method: {
      kind: "choice", label: { en: "Optimizer", zh: "优化方式" }, default: "rl",
      options: [
        { value: "rl", label: { en: "RL (PPO)", zh: "强化学习（PPO）" } },
        { value: "bon", label: { en: "Best-of-n", zh: "best-of-n" } },
      ],
    },
    rm: {
      kind: "choice", label: { en: "Proxy reward model", zh: "代理奖励模型" }, default: "12M",
      options: [
        { value: "12M", label: { en: "12M parameters", zh: "12M 参数" } },
        { value: "1.2B", label: { en: "1.2B parameters", zh: "1.2B 参数" } },
        { value: "3B", label: { en: "3B parameters", zh: "3B 参数" } },
      ],
    },
    beta: {
      kind: "choice", control: "buttons", label: { en: "KL coefficient β (1.2B RM runs)", zh: "KL 系数 β（1.2B 奖励模型的运行）" }, default: "0",
      options: BETAS.map((b) => ({ value: b, label: { en: b, zh: b } })),
    },
  },
  // β > 0 runs exist only for the 1.2B reward model under RL; the controls
  // move together so every reachable state is a measured run.
  update(p, key) {
    if (key === "beta" && p.beta !== "0") return { ...p, method: "rl", rm: "1.2B" };
    if (key === "rm" && p.rm !== "1.2B") return { ...p, beta: "0" };
    if (key === "method" && p.method === "bon") return { ...p, beta: "0" };
    return p;
  },
  timeline: {
    rate: 12,
    discrete: true,
    duration,
    keyframes,
    // The end of the run: the whole proxy and gold path is drawn and the gap
    // is at its widest (or, with β > 0, the run has settled).
    poster: (p) => duration(p),
  },
  render,
  describe,
});
