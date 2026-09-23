// A fixed sample budget spread over a batch of prompts of different
// difficulty, allocated uniformly or by difficulty, and the accuracy each
// allocation buys.
//
// The batch is 24 prompts whose one-sample success probabilities p_i have
// normal log-odds (median p, standard deviation `spread`), taken at the 24
// quantiles. Every prompt draws its k_i samples in one parallel round and an
// exact checker judges them, so a prompt is solved when any sample passes and
// the batch accuracy is the mean of the chapter's coverage, 1 − (1 − p_i)^k_i.
// The budget is Σ k_i = 24 B, and every prompt keeps at least one sample.
//
// - Uniform: k_i = B.
// - True difficulty: each further sample goes to the prompt with the largest
//   marginal gain p_i (1 − p_i)^k_i. The gains fall with k_i, so this greedy
//   allocation maximizes accuracy for every budget (and the allocation at one
//   budget extends the allocation at the one below).
// - Estimate as is: the router sees l̂_i = logit p_i + τ ε_i, with ε_i seeded
//   standard normal draws, and runs the same greedy on sigmoid(l̂_i).
// - Estimate, shrunk: the router knows its error τ and the batch's
//   distribution of log-odds, N(logit p, spread²). Its posterior for logit p_i
//   is normal with variance v = 1 / (1/spread² + 1/τ²) and mean
//   v (logit p / spread² + l̂_i / τ²), and it runs the greedy on the expected
//   gain E[p (1 − p)^k] under that posterior (a 41-point normal quadrature).
//
// Accuracy is always evaluated with the true p_i. The cost of producing the
// estimate is not charged to the budget.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log, band } from "./lib/scale.ts";
import { logitScale } from "./lib/logit-scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { textBox, textWidth, overlaps, wrap, lineObstacles, type Box } from "./lib/labels.ts";
import { fixed, int, sig, tpl } from "./lib/format.ts";
import { rng } from "./lib/random.ts";
import { logit, sigmoid, normalFrom, logitNormalQuantiles } from "./lib/stats.ts";

// ---------------------------------------------------------------- model

export const PROMPTS = 24;
const BMAX = 64;
const KAXIS = 2000; // top of the fixed samples axis

type Policy = "uniform" | "oracle" | "plugin" | "shrunk";
type P = { policy: Policy; budget: number; noise: number; spread: number; p: number; seed: number };

const QZ: number[] = [], QW: number[] = [];
{
  let s = 0;
  for (let i = 0; i <= 40; i++) { const z = -5 + i * 0.25; const w = Math.exp(-0.5 * z * z); QZ.push(z); QW.push(w); s += w; }
  for (let i = 0; i < QW.length; i++) QW[i] /= s;
}

interface Run {
  order: Int16Array; // prompt chosen for each sample beyond the first per prompt
  acc: Float64Array; // batch accuracy at total T = PROMPTS .. PROMPTS * BMAX
}

// Greedy allocation up to the largest budget, recording each choice and the
// true accuracy after it.
function greedy(gain: (i: number, k: number) => number, ps: number[]): Run {
  const n = ps.length, total = n * BMAX;
  const k = new Array(n).fill(1);
  const gv = k.map((kk, i) => gain(i, kk));
  const order = new Int16Array(total - n);
  const acc = new Float64Array(total + 1);
  let solved = ps.reduce((s, q) => s + q, 0);
  acc[n] = solved / n;
  for (let t = n + 1; t <= total; t++) {
    let bi = 0;
    for (let i = 1; i < n; i++) if (gv[i] > gv[bi]) bi = i;
    solved += ps[bi] * Math.pow(1 - ps[bi], k[bi]);
    k[bi]++;
    gv[bi] = gain(bi, k[bi]);
    order[t - n - 1] = bi;
    acc[t] = solved / n;
  }
  return { order, acc };
}

function allocation(run: Run, budget: number): number[] {
  const k = new Array(PROMPTS).fill(1);
  for (let t = 0; t < PROMPTS * (budget - 1); t++) k[run.order[t]]++;
  return k;
}

const uniformAcc = (ps: number[], b: number) => ps.reduce((s, q) => s + 1 - Math.pow(1 - q, b), 0) / ps.length;

// Samples per prompt a uniform allocation needs to reach accuracy a.
function uniformMatch(ps: number[], a: number): number {
  let lo = 0, hi = 6;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (uniformAcc(ps, 10 ** m) < a) lo = m; else hi = m; }
  return 10 ** hi;
}

interface Model {
  ps: number[]; // true success, easiest first
  est: number[]; // the router's point estimate as is
  post: number[]; // the shrunk estimate's posterior mean, as a probability
  runs: Record<Exclude<Policy, "uniform">, Run>;
}

const memo = new Map<string, Model>();
function model(p: P): Model {
  const key = `${p.noise}|${p.spread}|${p.p}|${p.seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const ps = logitNormalQuantiles(p.p, p.spread, PROMPTS).reverse();
  const r = rng(p.seed);
  const eps = ps.map(() => normalFrom(r(), r()));
  const lhat = ps.map((q, i) => logit(q) + p.noise * eps[i]);
  const mu = logit(p.p);
  const s2 = p.spread * p.spread, t2 = p.noise * p.noise;
  const v = s2 === 0 || t2 === 0 ? 0 : 1 / (1 / s2 + 1 / t2);
  const m = lhat.map((l) => (s2 === 0 ? mu : t2 === 0 ? l : v * (mu / s2 + l / t2)));
  const sd = Math.sqrt(v);
  const est = lhat.map(sigmoid);
  const nodes = m.map((mi) => QZ.map((z) => sigmoid(mi + sd * z)));
  const runs = {
    oracle: greedy((i, k) => ps[i] * Math.pow(1 - ps[i], k), ps),
    plugin: greedy((i, k) => est[i] * Math.pow(1 - est[i], k), ps),
    shrunk: greedy((i, k) => { let e = 0; for (let j = 0; j < QZ.length; j++) { const q = nodes[i][j]; e += QW[j] * q * Math.pow(1 - q, k); } return e; }, ps),
  };
  const out = { ps, est, post: m.map(sigmoid), runs };
  if (memo.size > 24) memo.clear();
  memo.set(key, out);
  return out;
}

function accuracies(md: Model, b: number) {
  const T = PROMPTS * b;
  return { uniform: uniformAcc(md.ps, b), oracle: md.runs.oracle.acc[T], plugin: md.runs.plugin.acc[T], shrunk: md.runs.shrunk.acc[T] };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Allocating a sample budget by difficulty",
    uniform: "uniform",
    oracle: "true difficulty",
    plugin: "estimate as is",
    shrunk: "estimate, shrunk",
    truth: "true p",
    estimate: "estimate the router uses",
    oracleTick: "allocation with true difficulty",
    yDiff: "one-sample success p",
    yK: "samples kᵢ given to the prompt",
    prompts: "{n} prompts, easiest to hardest",
    each: "uniform: {b} each",
    panelB: "Batch accuracy against the budget",
    xB: "mean samples per prompt B (log scale)",
    yB: "prompts solved",
    budgetLine: "Σ kᵢ = {n} × {b} = {t} samples; accuracy = mean of 1 − (1 − pᵢ)ᵏ with k = kᵢ",
    match: "uniform needs {r}×",
    noteUniform: "Every prompt gets {b} samples. The easiest is solved by its first sample with probability {e}, while all {b} give the hardest a chance of only {h}.",
    noteOracle: "Each extra sample goes to the prompt with the largest gain pᵢ(1 − pᵢ)ᵏ at its current k, the best allocation for this budget. The easiest prompt gets {e}, the hardest {h}, and the most, {m}, goes to a prompt with p = {pm}.",
    notePlugin: "The router trusts an estimate that is off by {tau} in log-odds. Prompts it wrongly thinks easy or hopeless lose samples; here it is {r}× as efficient as uniform.",
    noteShrunk: "The router knows its error and pulls each estimate toward the batch average before allocating by expected gain, so noise moves the allocation less; here it is {r}× as efficient as uniform.",
    noteExact: "With an exact estimate (error 0) both estimate policies equal the allocation by true difficulty.",
    describe: "With {b} samples per prompt, uniform allocation solves {u} of the prompts, allocation by true difficulty {o}, by the estimate as is {pl}, and by the shrunk estimate {s}; the estimate error is {tau} in log-odds.",
  },
  zh: {
    title: "按难度分配采样预算",
    uniform: "均匀分配",
    oracle: "按真实难度",
    plugin: "按估计值",
    shrunk: "按收缩后的估计",
    truth: "真实 p",
    estimate: "路由器采用的估计",
    oracleTick: "按真实难度的分配",
    yDiff: "单次成功率 p",
    yK: "分给该提示的样本数 kᵢ",
    prompts: "{n} 个提示，从易到难",
    each: "均匀：每个 {b}",
    panelB: "整批准确率随预算的变化",
    xB: "每个提示的平均样本数 B（对数刻度）",
    yB: "解出的提示比例",
    budgetLine: "Σ kᵢ = {n} × {b} = {t} 个样本；准确率 = 1 − (1 − pᵢ)ᵏ 的平均，k 取各提示的 kᵢ",
    match: "均匀需 {r} 倍",
    noteUniform: "每个提示都分到 {b} 个样本。最简单的提示第一个样本就有 {e} 的概率解出，最难的提示用上全部 {b} 个样本，解出的概率也只有 {h}。",
    noteOracle: "每个追加样本都给当前 k 下边际收益 pᵢ(1 − pᵢ)ᵏ 最大的提示，这是该预算下的最优分配。最简单的提示分到 {e} 个，最难的分到 {h} 个，分得最多的是 p = {pm} 的提示，共 {m} 个。",
    notePlugin: "路由器直接采信误差为 {tau}（对数几率）的估计。被误判为简单或无望的提示分不到样本；此时效率是均匀分配的 {r} 倍。",
    noteShrunk: "路由器知道自己的误差，先把每个估计向整批平均收缩，再按期望收益分配，噪声对分配的影响因此变小；此时效率是均匀分配的 {r} 倍。",
    noteExact: "估计误差为 0 时，两种按估计的分配都与按真实难度的分配相同。",
    describe: "平均每个提示 {b} 个样本时，均匀分配解出 {u} 的提示，按真实难度分配解出 {o}，按估计值分配解出 {pl}，按收缩后的估计分配解出 {s}；估计误差为 {tau}（对数几率）。",
  },
};

const f3 = (v: number) => fixed(v, 3);
const POLICIES: Policy[] = ["uniform", "oracle", "plugin", "shrunk"];
const COLOR: Record<Policy, string> = { uniform: C.ink2, oracle: C.c1, plugin: C.c2, shrunk: C.c3 };

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const b = Math.round(st.p.budget);
  const a = accuracies(model(st.p), b);
  return tpl(L.describe, { b, u: f3(a.uniform), o: f3(a.oracle), pl: f3(a.plugin), s: f3(a.shrunk), tau: sig(st.p.noise, 2) });
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const b = Math.min(BMAX, Math.max(1, Math.round(p.budget)));
  const md = model(p);
  const pol = p.policy;
  const kSel = pol === "uniform" ? new Array(PROMPTS).fill(b) : allocation(md.runs[pol], b);
  const kOpt = allocation(md.runs.oracle, b);
  const usesEstimate = pol === "plugin" || pol === "shrunk";
  const shown = pol === "plugin" ? md.est : md.post;
  const parts: string[] = [];

  // ---- legend
  const items: LegendItem[] = [{ label: L.truth, swatch: { kind: "dot", fill: C.ink } }];
  if (usesEstimate) {
    items.push({ label: L.estimate, swatch: { kind: "rect", fill: C.paper, stroke: COLOR[pol] } });
    items.push({ label: L.oracleTick, swatch: { kind: "line", stroke: C.ink } });
  }
  const lg = legend(items, 0, 0, w, fs);
  parts.push(lg.svg);

  const left = narrow ? 40 : 46, right = narrow ? 6 : 12;
  const cols = band(PROMPTS, [left + 2, w - right - 2], narrow ? 2 : 3);
  const colX = (i: number) => cols.at(i) + cols.size / 2;

  // ---- row 1: difficulty of each prompt, true and estimated
  const top1 = lg.height + 26;
  const h1 = narrow ? 104 : 116;
  const yd = logitScale([0.0003, 0.997], [top1 + h1, top1]);
  parts.push(axis({ scale: yd, orient: "left", at: left, grid: [left, w - right], ticks: [0.001, 0.01, 0.1, 0.5, 0.9, 0.99], title: L.yDiff, size: fs }));
  for (let i = 0; i < PROMPTS; i++) {
    const cx = colX(i), yt = yd(yd.clamp(md.ps[i]));
    if (usesEstimate) {
      const ye = yd(yd.clamp(shown[i]));
      parts.push(el("line", { x1: cx, x2: cx, y1: yt, y2: ye, stroke: COLOR[pol], "stroke-width": 1.5 }));
      parts.push(el("circle", { cx, cy: ye, r: narrow ? 3 : 3.5, fill: C.paper, stroke: COLOR[pol], "stroke-width": 1.5 }));
    }
    parts.push(el("circle", { cx, cy: yt, r: narrow ? 2.5 : 3, fill: C.ink }));
  }

  // ---- row 2: samples per prompt on a fixed log axis
  const top2 = top1 + h1 + 34;
  const h2 = narrow ? 140 : 160;
  const yk = log([0.6, KAXIS], [top2 + h2, top2]);
  parts.push(axis({ scale: yk, orient: "left", at: left, grid: [left, w - right], ticks: [1, 10, 100, 1000], title: L.yK, size: fs, format: (v) => int(v) }));
  const base = top2 + h2;
  for (let i = 0; i < PROMPTS; i++) {
    const x0 = cols.at(i), kk = Math.min(KAXIS, kSel[i]);
    const yTop = yk(kk);
    parts.push(el("rect", { x: x0, y: yTop, width: cols.size, height: Math.max(1.5, base - yTop), fill: COLOR[pol], "fill-opacity": pol === "uniform" ? 0.45 : 0.85 }));
    if (usesEstimate) {
      const yo = yk(Math.min(KAXIS, kOpt[i]));
      parts.push(el("line", { x1: x0 - 1, x2: x0 + cols.size + 1, y1: yo, y2: yo, stroke: C.ink, "stroke-width": 2 }));
    }
  }
  // The uniform level, labeled where it does not sit on a bar.
  const yu = yk(b);
  parts.push(el("line", { x1: left, x2: w - right, y1: yu, y2: yu, stroke: C.ink2, "stroke-width": 1.25, "stroke-dasharray": "5 3" }));
  {
    const lab = tpl(L.each, { b });
    const bars: Box[] = kSel.map((kk, i) => ({ x0: cols.at(i) - 1, y0: yk(Math.min(KAXIS, Math.max(kk, usesEstimate ? Math.max(kk, kOpt[i]) : kk))) - 2, x1: cols.at(i) + cols.size + 1, y1: base }));
    const tries: Array<[number, number, "start" | "end"]> = [[w - right - 2, yu - 7, "end"], [w - right - 2, yu + fs + 4, "end"], [left + 4, yu - 7, "start"], [left + 4, yu + fs + 4, "start"]];
    for (const [tx, ty, a] of tries) {
      const bx = textBox(tx, ty, lab, fs, a);
      if (bx.y0 < top2 || bx.y1 > base) continue;
      if (!bars.some((o) => overlaps(o, bx))) { parts.push(text(tx, ty, lab, { "font-size": fs, "text-anchor": a, class: "fig-t-halo fig-t-muted" })); break; }
    }
  }
  parts.push(el("line", { x1: left, x2: w - right, y1: base, y2: base, stroke: C.rule, "stroke-width": 1 }));
  parts.push(text((left + w - right) / 2, base + fs + 8, tpl(L.prompts, { n: PROMPTS }), { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));

  // ---- panel B: batch accuracy against the budget
  let yy = base + fs + 44;
  parts.push(text(0, yy, L.panelB, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lgB = legend(POLICIES.map((q) => ({ label: L[q], swatch: { kind: "line", stroke: COLOR[q], dash: q === "uniform" ? "6 3" : undefined } })), 0, yy + 8, w, fs);
  parts.push(lgB.svg);
  const topB = yy + 8 + lgB.height + 26;
  const hB = narrow ? 180 : 210;
  const xb = log([1, BMAX], [left, w - right]);
  const yb = linear([0, 1], [topB + hB, topB]);
  parts.push(axis({ scale: xb, orient: "bottom", at: topB + hB, grid: [topB, topB + hB], minor: true, title: L.xB, size: fs }));
  parts.push(axis({ scale: yb, orient: "left", at: left, grid: [left, w - right], ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => `${Math.round(v * 100)}%`, title: L.yB, size: fs }));
  const bs = Array.from({ length: BMAX }, (_, i) => i + 1);
  const acc = (q: Policy, bb: number) => (q === "uniform" ? uniformAcc(md.ps, bb) : md.runs[q].acc[PROMPTS * bb]);
  const obstacles: Box[] = [];
  for (const q of POLICIES) {
    const pts = bs.map((bb) => [xb(bb), yb(acc(q, bb))] as [number, number]);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: COLOR[q], "stroke-width": q === pol ? 2.75 : 1.75, "stroke-dasharray": q === "uniform" ? "6 3" : undefined, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(pts, 6, 3));
  }
  const now = accuracies(md, b);
  const xNow = xb(b);
  parts.push(el("line", { x1: xNow, x2: xNow, y1: topB, y2: topB + hB, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  // The uniform budget that matches the chosen policy, as a horizontal run.
  if (pol !== "uniform") {
    const bm = uniformMatch(md.ps, now[pol]);
    const xm = xb(Math.min(BMAX * 4, bm));
    const ym = yb(now[pol]);
    const xEnd = Math.min(w - right, xm);
    parts.push(el("line", { x1: xNow, x2: xEnd, y1: ym, y2: ym, stroke: COLOR[pol], "stroke-width": 1.5, "stroke-dasharray": "2 2" }));
    if (xm <= w - right) parts.push(el("circle", { cx: xm, cy: ym, r: 3.5, fill: C.paper, stroke: C.ink2, "stroke-width": 1.5 }));
  }
  for (const q of POLICIES) parts.push(el("circle", { cx: xNow, cy: yb(now[q]), r: q === pol ? 5 : 3.5, fill: COLOR[q], stroke: C.paper, "stroke-width": 1.5 }));

  // ---- legend of the policies, then the readout
  yy = topB + hB + axisHeight(true, fs) + 16;
  const rp: string[] = [];
  for (const ln of wrap(tpl(L.budgetLine, { n: PROMPTS, b, t: int(PROMPTS * b) }), fs, w)) { rp.push(text(0, yy, ln, { "font-size": fs, class: "fig-t-num" })); yy += 17; }
  yy += 12;
  const vals = POLICIES.map((q) => (q === "uniform" ? f3(now[q]) : `${f3(now[q])}   ${tpl(L.match, { r: sig(uniformMatch(md.ps, now[q]) / b, 2) })}`));
  const nameW = narrow ? 0 : Math.max(...POLICIES.map((q) => textWidth(L[q], fs))) + 16;
  const valW = narrow ? 0 : Math.max(...vals.map((v) => textWidth(v, fs))) + 16;
  const barX = nameW, barW = narrow ? w : w - nameW - valW;
  for (const [qi, q] of POLICIES.entries()) {
    const cls = q === pol ? "fig-t-strong" : "";
    const val = vals[qi];
    if (narrow) {
      rp.push(text(0, yy, L[q], { "font-size": fs, class: cls }));
      rp.push(text(w, yy, val, { "font-size": fs, "text-anchor": "end", class: `${cls} fig-t-num` }));
      yy += 6;
    }
    const by = narrow ? yy : yy - 11;
    rp.push(el("rect", { x: barX, y: by, width: barW, height: 12, rx: 2, fill: C.panel }));
    rp.push(el("rect", { x: barX, y: by, width: Math.max(1.5, now[q] * barW), height: 12, rx: 2, fill: COLOR[q], "fill-opacity": q === "uniform" ? 0.6 : 1 }));
    if (!narrow) {
      rp.push(text(0, yy, L[q], { "font-size": fs, class: cls }));
      rp.push(text(w, yy, val, { "font-size": fs, "text-anchor": "end", class: `${cls} fig-t-num` }));
    }
    yy += narrow ? 32 : 24;
  }
  yy += 4;
  const ratioOf = (q: Policy) => sig(uniformMatch(md.ps, now[q]) / b, 2);
  const note = pol === "uniform" ? tpl(L.noteUniform, { b, e: f3(md.ps[0]), h: f3(1 - Math.pow(1 - md.ps[PROMPTS - 1], b)) })
    : pol === "oracle" ? (() => {
      const im = kOpt.indexOf(Math.max(...kOpt));
      return tpl(L.noteOracle, { e: kOpt[0], h: kOpt[PROMPTS - 1], m: int(kOpt[im]), pm: sig(md.ps[im], 2) });
    })()
      : p.noise === 0 ? L.noteExact
        : tpl(pol === "plugin" ? L.notePlugin : L.noteShrunk, { tau: sig(p.noise, 2), r: ratioOf(pol) });
  for (const ln of wrap(note, fs, w)) { rp.push(text(0, yy, ln, { "font-size": fs, class: "fig-t-muted" })); yy += 17; }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "difficulty-budget",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    policy: {
      kind: "choice", label: { en: "Allocation shown", zh: "显示的分配方式" }, default: "oracle",
      options: [
        { value: "uniform", label: { en: "Uniform", zh: "均匀分配" } },
        { value: "oracle", label: { en: "True difficulty", zh: "按真实难度" } },
        { value: "plugin", label: { en: "Estimate as is", zh: "按估计值" } },
        { value: "shrunk", label: { en: "Estimate, shrunk", zh: "按收缩后的估计" } },
      ],
    },
    budget: {
      kind: "range", scale: "log", label: { en: "Mean samples per prompt B", zh: "每个提示的平均样本数 B" },
      min: 1, max: BMAX, default: 32,
    },
    noise: {
      kind: "range", label: { en: "Difficulty estimate error τ (log-odds SD)", zh: "难度估计误差 τ（对数几率标准差）" },
      min: 0, max: 3, step: 0.1, default: 1.5,
      marks: [{ value: 0, label: { en: "exact", zh: "精确" } }],
    },
    spread: {
      kind: "range", label: { en: "Difficulty spread across prompts (log-odds SD)", zh: "提示难度的离散程度（对数几率标准差）" },
      min: 0, max: 3, step: 0.1, default: 2,
    },
    p: {
      kind: "range", scale: "log", label: { en: "One-sample success p (median prompt)", zh: "单次采样成功率 p（中位提示）" },
      min: 0.001, max: 0.9, default: 0.1, control: false,
    },
    seed: { kind: "range", label: { en: "Seed of the estimate errors", zh: "估计误差的随机种子" }, min: 1, max: 1000, step: 1, default: 1, control: false },
  },
  // Budgets are whole samples per prompt.
  update(p, key) {
    if (key === "budget") return { ...p, budget: Math.min(BMAX, Math.max(1, Math.round(p.budget))) };
    return p;
  },
  render,
  describe,
});
