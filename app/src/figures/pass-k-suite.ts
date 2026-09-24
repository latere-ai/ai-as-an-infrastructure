// Capability and reliability of an agent suite whose tasks differ in success
// probability: the evaluating-agents chapter's per-task quantities
//
//   pass@k_i = 1 − (1 − p_i)^k,        pass^k_i = p_i^k,
//
// averaged over the tasks, against the shortcut the chapter warns about,
// which raises the pooled single-attempt accuracy p̄ = mean_i p_i to the kth
// power. Because x^k is convex and 1 − (1 − x)^k concave, the shortcut
// understates pass^k and overstates pass@k whenever the p_i differ (Jensen's
// inequality); the gap grows with k and with the spread of the p_i.
//
// The suite is illustrative: 60 tasks in a short-task and a long-task slice.
// Within a slice the p_i are the quantiles of a logit-normal distribution
// around the slice median (lib/stats.ts), so every curve is exact.
//
// The estimate markers apply the chapter's finite-sample estimators to one
// seeded draw of c_i ~ Binomial(n, p_i) successes per task:
//
//   est pass@k_i = 1 − C(n − c_i, k) / C(n, k),   est pass^k_i = C(c_i, k) / C(n, k),  k ≤ n,
//
// averaged over the tasks; they exist only up to k = n.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, placeLabels, drawLabels, lineObstacles, type Box, type Side } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { wrap } from "./lib/labels.ts";
import { logitNormalQuantiles } from "./lib/stats.ts";
import { rng } from "./lib/random.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

const TASKS = 60;
const K_MAX = 16;

type P = { k: number; long: number; pLong: number; pShort: number; spread: number; n: number; seed: number };

interface Suite { p: number[]; slice: Array<"short" | "long">; counts: number[] }

const memo = new Map<string, Suite>();
export function suite(q: P): Suite {
  const key = `${q.long}|${q.pLong}|${q.pShort}|${q.spread}|${q.n}|${q.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const nLong = Math.round(TASKS * q.long);
    const short = logitNormalQuantiles(q.pShort, q.spread, TASKS - nLong);
    const long = logitNormalQuantiles(q.pLong, q.spread, nLong);
    const p = [...short, ...long];
    const slice = [...short.map(() => "short" as const), ...long.map(() => "long" as const)];
    const u = rng(q.seed);
    const counts = p.map((pi) => { let c = 0; for (let j = 0; j < q.n; j++) if (u() < pi) c++; return c; });
    hit = { p, slice, counts };
    if (memo.size > 64) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
// C(a, k) / C(n, k) as a product, 0 when a < k.
function ratio(a: number, n: number, k: number): number {
  if (a < k) return 0;
  let r = 1;
  for (let j = 0; j < k; j++) r *= (a - j) / (n - j);
  return r;
}

export function curves(q: P, k: number) {
  const s = suite(q);
  const pbar = mean(s.p);
  const at = s.p.map((p) => 1 - (1 - p) ** k);
  const all = s.p.map((p) => p ** k);
  const bySlice = (sl: "short" | "long") => mean(all.filter((_, i) => s.slice[i] === sl));
  const est = k <= q.n
    ? { at: mean(s.counts.map((c) => 1 - ratio(q.n - c, q.n, k))), all: mean(s.counts.map((c) => ratio(c, q.n, k))) }
    : null;
  return {
    pbar, at: mean(at), all: mean(all), pooledAt: 1 - (1 - pbar) ** k, pooledAll: pbar ** k,
    short: bySlice("short"), long: bySlice("long"), est,
  };
}

const labels = {
  en: {
    title: "pass@k and pass^k over a suite of tasks",
    plot: "Suite score after k attempts per task",
    x: "attempts per task, k",
    y: "probability",
    atTask: "pass@k, mean over tasks",
    allTask: "pass^k, mean over tasks",
    atPool: "pass@k from pooled p̄",
    allPool: "pass^k from pooled p̄",
    est: "estimate from n attempts",
    strip: "Each task at k = {k}: single attempt p_i (faint) and all k attempts p_i^k (solid)",
    short: "short tasks",
    long: "long tasks",
    meanLine: "mean p_i^k = {v}",
    poolLine: "p̄^k = {v}",
    pbar: "pooled single-attempt accuracy p̄ = mean p_i = {v}",
    rowAt: "pass@k",
    rowAll: "pass^k",
    colTask: "per task",
    colPool: "pooled p̄",
    colEst: "estimated",
    slices: "pass^k by slice: short tasks {s}, long tasks {l}",
    runs: "{t} tasks × n = {n} attempts = {r} runs",
    estOk: "estimates exist for k ≤ n",
    noEst: "no estimate for k > n",
    describe: "{t} tasks, {share} of them long; at k = {k}, pass@k is {at} against {pat} from the pooled accuracy {pbar}, and pass^k is {all} against {pall}. Long tasks alone reach pass^k {l}.",
  },
  zh: {
    title: "测试套件上的 pass@k 与 pass^k",
    plot: "每项任务尝试 k 次后的套件得分",
    x: "每项任务的尝试次数 k",
    y: "概率",
    atTask: "pass@k，逐任务取平均",
    allTask: "pass^k，逐任务取平均",
    atPool: "用汇总 p̄ 算的 pass@k",
    allPool: "用汇总 p̄ 算的 pass^k",
    est: "由 n 次尝试估计",
    strip: "k = {k} 时的每项任务：单次成功率 p_i（淡色）与 k 次全部成功的概率 p_i^k（实色）",
    short: "短任务",
    long: "长任务",
    meanLine: "p_i^k 均值 = {v}",
    poolLine: "p̄^k = {v}",
    pbar: "汇总的单次准确率 p̄ = p_i 均值 = {v}",
    rowAt: "pass@k",
    rowAll: "pass^k",
    colTask: "逐任务",
    colPool: "汇总 p̄",
    colEst: "估计值",
    slices: "按切片的 pass^k：短任务 {s}，长任务 {l}",
    runs: "{t} 项任务 × n = {n} 次尝试 = {r} 次运行",
    estOk: "k ≤ n 时才有估计值",
    noEst: "k > n，无法估计",
    describe: "共 {t} 项任务，其中 {share} 为长任务；k = {k} 时，pass@k 为 {at}，用汇总准确率 {pbar} 算出的是 {pat}；pass^k 为 {all}，汇总算法给出 {pall}。仅看长任务，pass^k 为 {l}。",
  },
};
type L = typeof labels.en;

// Write p_i and ^k with Unicode sub- and superscripts, as the chapter's
// notation reads (pass^k → passᵏ, p_i^k → pᵢᵏ).
const sup = (s: string) => s.replace(/p_i\^k/g, "pᵢᵏ").replace(/p_i/g, "pᵢ").replace(/\^k/g, "ᵏ");

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const q = st.p;
  const c = curves(q, q.k);
  return sup(tpl(L.describe, {
    t: TASKS, share: pct(Math.round(TASKS * q.long) / TASKS), k: q.k, at: fixed(c.at, 2), pat: fixed(c.pooledAt, 2), pbar: fixed(c.pbar, 2),
    all: fixed(c.all, 2), pall: fixed(c.pooledAll, 2), l: Number.isFinite(c.long) ? fixed(c.long, 2) : "–",
  }));
}

const wrapL = (lang: Lang, s: string, size: number, w: number) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));

function renderPlot(q: P, w: number, y0: number, L: L, lang: Lang, uid: string): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = TYPE.body;
  const parts: string[] = [text(0, y0 + 14, L.plot, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const lg = legend([
    { label: sup(L.atTask), swatch: { kind: "line", stroke: C.c1 } },
    { label: sup(L.allTask), swatch: { kind: "line", stroke: C.c2 } },
    { label: sup(L.atPool), swatch: { kind: "line", stroke: C.c1, dash: "5 3" } },
    { label: sup(L.allPool), swatch: { kind: "line", stroke: C.c2, dash: "5 3" } },
  ], 0, y0 + 24, w, fs);
  parts.push(lg.svg);
  // The estimate markers get their own legend row, with the marker's shape.
  const ey = y0 + 24 + lg.height + fs - 1;
  parts.push(el("circle", { cx: 7, cy: ey - 4, r: 3.5, fill: C.paper, stroke: C.c1, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx: 17, cy: ey - 4, r: 3.5, fill: C.paper, stroke: C.c2, "stroke-width": 1.5 }));
  parts.push(text(28, ey, L.est, { "font-size": fs, fill: C.ink2 }));
  const top = y0 + 24 + lg.height + fs + 8 + 22;
  const left = 38, right = narrow ? 10 : 14;
  const plotH = narrow ? 190 : 220;
  const x = linear([1, K_MAX], [left, w - right]);
  const y = linear([0, 1], [top + plotH, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, ticks: [1, 4, 8, 12, 16], grid: [top, top + plotH], title: L.x, size: fs, format: (v) => String(v) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, w - right], title: L.y, size: fs, format: (v) => fixed(v, 2) }));

  const ks = Array.from({ length: K_MAX }, (_, i) => i + 1);
  const cs = ks.map((k) => curves(q, k));
  const pts = (f: (c: ReturnType<typeof curves>) => number) => ks.map((k, i) => [x(k), y(f(cs[i]))] as [number, number]);
  const at = pts((c) => c.at), all = pts((c) => c.all), pAt = pts((c) => c.pooledAt), pAll = pts((c) => c.pooledAll);
  // The shortcut's error: the band between each exact curve and its pooled version.
  const band = (a: Array<[number, number]>, b: Array<[number, number]>, fill: string) =>
    el("path", { d: linePath([...a, ...[...b].reverse()]) + "Z", fill, "fill-opacity": 0.14 });
  parts.push(band(at, pAt, C.c1), band(all, pAll, C.c2));
  parts.push(el("path", { d: linePath(pAt), fill: "none", stroke: C.c1, "stroke-width": 1.8, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(pAll), fill: "none", stroke: C.c2, "stroke-width": 1.8, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(at), fill: "none", stroke: C.c1, "stroke-width": 2.4 }));
  parts.push(el("path", { d: linePath(all), fill: "none", stroke: C.c2, "stroke-width": 2.4 }));
  // Finite-sample estimates, only where k ≤ n.
  cs.forEach((c, i) => {
    if (!c.est) return;
    parts.push(el("circle", { cx: x(ks[i]), cy: y(c.est.at), r: 3.2, fill: C.paper, stroke: C.c1, "stroke-width": 1.5 }));
    parts.push(el("circle", { cx: x(ks[i]), cy: y(c.est.all), r: 3.2, fill: C.paper, stroke: C.c2, "stroke-width": 1.5 }));
  });
  // Cursor at the chosen k with the four values.
  const c = curves(q, q.k);
  const cx = x(q.k);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: top + plotH, stroke: C.ink, "stroke-width": 1.2 }));
  const kl = `k = ${q.k}`;
  // Clear of the y-axis title, which sits above the plot's left edge.
  const klx = Math.min(Math.max(cx, left + textWidth(L.y, fs) + 12 + textWidth(kl, fs) / 2), w - right - textWidth(kl, fs) / 2);
  parts.push(text(klx, top - 6, kl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  // Values at the cursor, placed clear of the curves and the estimate
  // markers; a value with no free spot is still in the readout below.
  const obstacles: Box[] = [at, all, pAt, pAll].flatMap((pl) => lineObstacles(pl, 5, 1.5));
  cs.forEach((cc, i) => {
    if (!cc.est) return;
    for (const v of [cc.est.at, cc.est.all]) obstacles.push({ x0: x(ks[i]) - 4.5, y0: y(v) - 4.5, x1: x(ks[i]) + 4.5, y1: y(v) + 4.5 });
  });
  obstacles.push(...lineObstacles([[cx, top], [cx, top + plotH]], 5, 1.5));
  const vals = [
    { v: c.pooledAt, col: C.c1, dash: true }, { v: c.at, col: C.c1, dash: false },
    { v: c.all, col: C.c2, dash: false }, { v: c.pooledAll, col: C.c2, dash: true },
  ];
  for (const d of vals) obstacles.push({ x0: cx - 5, y0: y(d.v) - 5, x1: cx + 5, y1: y(d.v) + 5 });
  const placed = placeLabels(vals.map((d) => ({
    x: cx, y: y(d.v), text: fixed(d.v, 2), size: fs, gap: 8, priority: d.dash ? 1 : 2,
    sides: ["right", "left", "above-right", "below-right", "above-left", "below-left"] as Side[],
    attrs: { class: `fig-t-halo fig-t-num${d.dash ? " fig-t-soft" : ""}` },
  })), { x0: left + 2, y0: top + 1, x1: w - right, y1: top + plotH - 1 }, obstacles);
  parts.push(drawLabels(placed.placed));
  for (const d of vals) parts.push(el("circle", { cx, cy: y(d.v), r: d.dash ? 3 : 4, fill: d.dash ? C.paper : d.col, stroke: d.col, "stroke-width": 1.5 }));
  return { svg: g({ class: "fig-plot" }, ...parts), h: top + plotH + axisHeight(true, fs) - y0 };
}

function renderStrip(q: P, w: number, y0: number, L: L, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const s = suite(q);
  const c = curves(q, q.k);
  const parts: string[] = [];
  let y = y0;
  for (const ln of wrapL(lang, sup(tpl(L.strip, { k: q.k })), fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-strong" })); }
  const c0 = curves(q, q.k);
  const lg = legend([
    { label: sup(tpl(L.meanLine, { v: fixed(c0.all, 2) })), swatch: { kind: "line", stroke: C.ink } },
    { label: sup(tpl(L.poolLine, { v: fixed(c0.pooledAll, 2) })), swatch: { kind: "line", stroke: C.ink, dash: "5 3" } },
  ], 0, y + 6, w, fs);
  parts.push(lg.svg);
  y += 6 + lg.height;
  const top = y + 12, h = 96;
  const left = 38;
  const col = (w - left) / TASKS;
  const bw = Math.max(1.5, col - (col > 5 ? 1.5 : 0.8));
  const yy = linear([0, 1], [top + h, top]);
  parts.push(axis({ scale: yy, orient: "left", at: left, ticks: [0, 0.5, 1], grid: [left, w], size: fs, format: (v) => fixed(v, 1) }));
  s.p.forEach((p, i) => {
    const x = left + i * col + (col - bw) / 2;
    parts.push(el("rect", { x, y: yy(p), width: bw, height: top + h - yy(p), fill: C.c2, "fill-opacity": 0.28 }));
    const pk = p ** q.k;
    if (top + h - yy(pk) > 0.4) parts.push(el("rect", { x, y: yy(pk), width: bw, height: top + h - yy(pk), fill: C.c2 }));
  });
  // Mean of the dark bars against the pooled shortcut, named in the legend above.
  for (const [v, dash] of [[c.all, undefined], [c.pooledAll, "5 3"]] as const) {
    parts.push(el("line", { x1: left, x2: w, y1: yy(v), y2: yy(v), stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": dash }));
  }
  // Slice brackets.
  const nShort = s.slice.filter((x) => x === "short").length;
  const by = top + h + 8;
  for (const [a, b, name] of [[0, nShort, L.short], [nShort, TASKS, L.long]] as const) {
    if (b <= a) continue;
    const x0 = left + a * col + 1, x1 = left + b * col - 1;
    parts.push(el("path", { d: `M${x0},${by}V${by + 5}H${x1}V${by}`, fill: "none", stroke: C.ink3, "stroke-width": 1 }));
    const tw = textWidth(name, fs);
    if (x1 - x0 >= tw) parts.push(text((x0 + x1) / 2, by + 19, name, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: by + 24 - y0 };
}

function renderReadout(q: P, w: number, y0: number, L: L, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const c = curves(q, q.k);
  const parts: string[] = [];
  const colW = Math.max(...[L.colTask, L.colPool, L.colEst].map((s) => textWidth(s, fs))) + 16;
  const xs = [w - 2 * colW, w - colW, w];
  let y = y0 + 14;
  [L.colTask, L.colPool, L.colEst].forEach((s, i) => parts.push(text(xs[i], y, s, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" })));
  y += 6;
  const rows: Array<[string, number, number, number | null]> = [
    [sup(L.rowAt), c.at, c.pooledAt, c.est ? c.est.at : null],
    [sup(L.rowAll), c.all, c.pooledAll, c.est ? c.est.all : null],
  ];
  for (const [name, a, b, e] of rows) {
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    y += 17;
    parts.push(text(0, y, name, { "font-size": TYPE.label, class: "fig-t-strong" }));
    parts.push(text(xs[0], y, fixed(a, 2), { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    parts.push(text(xs[1], y, fixed(b, 2), { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(xs[2], y, e == null ? "–" : fixed(e, 2), { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    y += 7;
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 4;
  const notes = [
    sup(tpl(L.pbar, { v: fixed(c.pbar, 2) })),
    sup(tpl(L.slices, { s: Number.isFinite(c.short) ? fixed(c.short, 2) : "–", l: Number.isFinite(c.long) ? fixed(c.long, 2) : "–" })),
    tpl(L.runs, { t: TASKS, n: q.n, r: int(TASKS * q.n) }) + (lang === "zh" ? "；" : "; ") + (c.est ? L.estOk : L.noEst),
  ];
  for (const s of notes) for (const ln of wrapL(lang, s, fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted fig-t-num" })); }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const q = st.p;
  const w = st.w;
  const plot = renderPlot(q, w, 0, L, lang, st.uid);
  let y = plot.h + 18;
  const strip = renderStrip(q, w, y, L, lang);
  y += strip.h + 16;
  const ro = renderReadout(q, w, y, L, lang);
  y += ro.h;
  return svg(w, y + 6, describe(st, lang), plot.svg, strip.svg, ro.svg);
}

export default defineFigure({
  name: "pass-k-suite",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    k: { kind: "range", label: { en: "Attempts per task k", zh: "每项任务尝试次数 k" }, min: 1, max: K_MAX, step: 1, default: 4 },
    long: { kind: "range", label: { en: "Share of long tasks", zh: "长任务占比" }, min: 0, max: 1, step: 0.05, default: 0.3 },
    pLong: {
      kind: "range", label: { en: "Long-task median success", zh: "长任务成功率中位数" }, min: 0.05, max: 0.95, step: 0.05, default: 0.35,
    },
    pShort: { kind: "range", label: { en: "Short-task median success", zh: "短任务成功率中位数" }, min: 0.5, max: 0.99, step: 0.01, default: 0.92, control: false },
    spread: { kind: "range", label: { en: "Spread within a slice (log-odds)", zh: "切片内的离散度（对数几率）" }, min: 0, max: 2, step: 0.1, default: 1, control: false },
    n: {
      kind: "choice", label: { en: "Attempts run per task n", zh: "每项任务实际运行次数 n" }, default: 8,
      options: [4, 8, 16].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    seed: { kind: "range", label: { en: "Seed", zh: "随机种子" }, min: 1, max: 9999, step: 1, default: 1, control: false },
  },
  render,
  describe,
});
