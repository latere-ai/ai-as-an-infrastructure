// Precision and coverage of a 95% interval for one accuracy measured on n
// independent binary items.
//
// The first panel is the chapter's planning sketch, the Wald half-width
//
//   h = 1.96 √(p(1 − p) / n),
//
// on log axes, where it is a line of slope −1/2: four times the items halve
// the width. Solving for n gives the items a target half-width h* needs,
// n* = 1.96² p(1 − p) / h*². The Wilson half-width, (U − L) / 2 with
//
//   center = (p + z²/2n) / (1 + z²/n),
//   half   = z / (1 + z²/n) · √(p(1 − p)/n + z²/4n²),
//
// is drawn beside it for the same observed proportion.
//
// The second panel is the exact coverage of each method at this n: for a true
// proportion p, the probability that the interval computed from X ~ Bin(n, p)
// contains p, Σ_x P(X = x) · [L(x) ≤ p ≤ U(x)], summed over the binomial
// pmf. This is the calculation behind the coverage plots in Brown, Cai and
// DasGupta (2001), which the chapter cites; no value is simulated.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textBox, textWidth, overlaps, lineObstacles, wrap, type Box } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { binomPmf } from "./lib/stats.ts";
import { compact, fixed, int, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const Z = 1.96;
const N_MIN = 10, N_MAX = 10000;

type Method = "wald" | "wilson";
type P = { n: number; p: number; target: number };

function waldInterval(x: number, n: number): [number, number] {
  const q = x / n, h = Z * Math.sqrt((q * (1 - q)) / n);
  return [q - h, q + h];
}
function wilsonInterval(x: number, n: number): [number, number] {
  const q = x / n, z2 = Z * Z;
  const c = (q + z2 / (2 * n)) / (1 + z2 / n);
  const h = (Z / (1 + z2 / n)) * Math.sqrt((q * (1 - q)) / n + z2 / (4 * n * n));
  return [c - h, c + h];
}
const INTERVAL = { wald: waldInterval, wilson: wilsonInterval };

const waldHalf = (p: number, n: number) => Z * Math.sqrt((p * (1 - p)) / n);
const wilsonHalf = (p: number, n: number) => { const [a, b] = wilsonInterval(p * n, n); return (b - a) / 2; };

// Exact coverage at true proportion p: sum the pmf over the x whose interval
// contains p. Terms beyond 9 standard deviations are below 1e-18 and skipped.
function coverage(method: Method, n: number, p: number, ends: Array<[number, number]>): number {
  const mu = n * p, sd = Math.sqrt(n * p * (1 - p));
  const x0 = Math.max(0, Math.floor(mu - 9 * sd - 2)), x1 = Math.min(n, Math.ceil(mu + 9 * sd + 2));
  let c = 0;
  for (let x = x0; x <= x1; x++) {
    const [lo, hi] = ends[x];
    if (lo <= p && p <= hi) c += binomPmf(n, x, p);
  }
  return c;
}

// Coverage curves over p for one n, memoized: the curve depends on n only.
const P_GRID = Array.from({ length: 393 }, (_, i) => 0.01 + i * 0.0025);
const memo = new Map<number, Record<Method, number[]>>();
function curves(n: number): Record<Method, number[]> {
  let hit = memo.get(n);
  if (!hit) {
    const out = {} as Record<Method, number[]>;
    for (const m of ["wald", "wilson"] as const) {
      const ends = Array.from({ length: n + 1 }, (_, x) => INTERVAL[m](x, n));
      out[m] = P_GRID.map((p) => coverage(m, n, p, ends));
    }
    hit = out;
    if (memo.size > 24) memo.clear();
    memo.set(n, hit);
  }
  return hit;
}

function model(pr: P) {
  const n = Math.min(N_MAX, Math.max(N_MIN, Math.round(pr.n)));
  const p = pr.p;
  const h = waldHalf(p, n);
  const hStar = pr.target / 100;
  const nStar = Math.ceil((Z * Z * p * (1 - p)) / (hStar * hStar));
  const at = (m: Method) => coverage(m, n, p, Array.from({ length: n + 1 }, (_, x) => INTERVAL[m](x, n)));
  return { n, p, h, hW: wilsonHalf(p, n), hStar, nStar, covWald: at("wald"), covWilson: at("wilson") };
}
type M = ReturnType<typeof model>;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Precision and coverage of a 95% interval for one accuracy",
    wald: "Wald",
    wilson: "Wilson",
    precision: "95% half-width against items n",
    precX: "independent items n (log scale)",
    precY: "half-width (pp, log scale)",
    step: "4 × n: half the width",
    needed: "need h ≤ {h} pp",
    nStar: "n = {n}",
    cover: "Coverage of a nominal 95% interval, n = {n}",
    covX: "true proportion p",
    covY: "coverage (%)",
    rH: "h = 1.96 · √(p(1 − p) / n) = 1.96 · √({p} · {q} / {n}) = {h} pp",
    rWilson: "Wilson half-width at the same n and p: {h} pp",
    rStar: "items for h ≤ {t} pp: 1.96² · p(1 − p) / h² = {n}",
    rCov: "exact coverage at p = {p}, n = {n}: Wald {w}, Wilson {s}",
    describe: "At p = {p} and n = {n}, the Wald half-width is {h} pp; {s} items bring it to {t} pp. The exact coverage of the nominal 95% interval at this p and n is {w} for Wald and {v} for Wilson.",
  },
  zh: {
    title: "单个准确率 95% 区间的精度与覆盖率",
    wald: "Wald",
    wilson: "Wilson",
    precision: "95% 半宽随项目数 n 的变化",
    precX: "独立项目数 n（对数刻度）",
    precY: "半宽（百分点，对数刻度）",
    step: "项目数 ×4：半宽减半",
    needed: "要求 h ≤ {h} 个百分点",
    nStar: "n = {n}",
    cover: "名义 95% 区间的覆盖率，n = {n}",
    covX: "真实比例 p",
    covY: "覆盖率（%）",
    rH: "h = 1.96 · √(p(1 − p) / n) = 1.96 · √({p} · {q} / {n}) = {h} 个百分点",
    rWilson: "同样的 n 和 p 下，Wilson 半宽为 {h} 个百分点",
    rStar: "使 h ≤ {t} 个百分点所需项目数：1.96² · p(1 − p) / h² = {n}",
    rCov: "p = {p}、n = {n} 时的精确覆盖率：Wald {w}，Wilson {s}",
    describe: "p = {p}、n = {n} 时，Wald 半宽为 {h} 个百分点；要降到 {t} 个百分点需要 {s} 个项目。在这个 p 和 n 下，名义 95% 区间的精确覆盖率 Wald 为 {w}，Wilson 为 {v}。",
  },
};
type L = typeof labels.en;

const pctCov = (v: number) => `${fixed(v * 100, 1)}%`;
const ppH = (v: number) => fixed(v * 100, 2);
const nText = (n: number) => int(n);
const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));

function heading(s: string, x0: number, y0: number, w: number, lang: Lang, parts: string[]): number {
  const ls = lines(s, TYPE.label, w, lang);
  ls.forEach((ln, i) => parts.push(text(x0, y0 + 14 + i * 17, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  return ls.length * 17;
}

// ---------------------------------------------------------------- panels

const Y_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];

function renderPrecision(m: M, x0: number, y0: number, w: number, titleH: number, Lx: L, lang: Lang, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  heading(Lx.precision, x0, y0, w, lang, parts);
  const left = x0 + 34, right = x0 + w - 8;
  const top = y0 + titleH + 12, plotH = 200, bottom = top + plotH;
  const x = log([N_MIN, N_MAX], [left, right]);
  const y = log([0.1, 50], [bottom, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: [10, 100, 1000, 10000], grid: [top, bottom], minor: true, title: Lx.precX, size: TYPE.body, format: compact }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: Y_TICKS, grid: [left, right], size: TYPE.body, format: (v) => sig(v, 2) }));
  const clip = `${uid}-prec`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: right - left, height: plotH }))));
  const obstacles: Box[] = [];
  const pts = (f: (n: number) => number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) { const n = N_MIN * (N_MAX / N_MIN) ** (i / 120); out.push([x(n), y(Math.max(0.05, f(n) * 100))]); }
    return out;
  };
  const marks: string[] = [];
  // Target half-width and the n that reaches it.
  const yt = y(m.hStar * 100);
  marks.push(el("line", { x1: left, x2: right, y1: yt, y2: yt, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 4" }));
  if (m.nStar >= N_MIN && m.nStar <= N_MAX) {
    const xs = x(m.nStar);
    marks.push(el("line", { x1: xs, x2: xs, y1: yt, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
    marks.push(el("circle", { cx: xs, cy: yt, r: 3.5, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  }
  const wilsonPts = pts((n) => wilsonHalf(m.p, n)), waldPts = pts((n) => waldHalf(m.p, n));
  obstacles.push(...lineObstacles(wilsonPts), ...lineObstacles(waldPts));
  marks.push(el("path", { d: linePath(wilsonPts), fill: "none", stroke: C.c2, "stroke-width": 2, "stroke-dasharray": "6 3" }));
  marks.push(el("path", { d: linePath(waldPts), fill: "none", stroke: C.c1, "stroke-width": 2 }));
  // Four times the items: the step from (n, h) to (4n, h/2).
  const xn = x(m.n), yn = y(m.h * 100);
  let stepAt: [number, number] | null = null;
  if (4 * m.n <= N_MAX) {
    const x4 = x(4 * m.n), y4 = y((m.h / 2) * 100);
    const step: Array<[number, number]> = [[xn, yn], [x4, yn], [x4, y4]];
    obstacles.push(...lineObstacles(step));
    marks.push(el("path", { d: linePath(step), fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
    marks.push(el("circle", { cx: x4, cy: y4, r: 3.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
    stepAt = [x4, (yn + y4) / 2];
  }
  marks.push(el("circle", { cx: xn, cy: yn, r: 5, fill: C.c1, stroke: C.paper, "stroke-width": 2 }));
  parts.push(g({ "clip-path": `url(#${clip})` }, ...marks));
  // Labels, each at the first candidate position that is inside the plot and
  // clear of the curves, the step, the target line, and labels already placed.
  obstacles.push(...lineObstacles([[left, yt], [right, yt]]));
  const inside = (b: Box) => b.x0 >= left + 2 && b.x1 <= right - 2 && b.y0 >= top + 2 && b.y1 <= bottom - 2;
  const place = (s: string, cands: Array<[number, number, "start" | "end" | "middle"]>, cls: string) => {
    for (const [cx, cy, anchor] of cands) {
      const b = textBox(cx, cy, s, TYPE.body, anchor);
      if (!inside(b) || obstacles.some((o) => overlaps(o, b))) continue;
      obstacles.push(b);
      parts.push(text(cx, cy, s, { "font-size": TYPE.body, "text-anchor": anchor, class: cls }));
      return;
    }
  };
  if (m.nStar >= N_MIN && m.nStar <= N_MAX) {
    const s = tpl(Lx.nStar, { n: nText(m.nStar) });
    const xs = x(m.nStar);
    place(s, [[xs + 5, bottom - 7, "start"], [xs - 5, bottom - 7, "end"]], "fig-t-halo fig-t-num");
  }
  const need = tpl(Lx.needed, { h: sig(m.hStar * 100, 3) });
  place(need, [[right - 4, yt - 6, "end"], [right - 4, yt + 16, "end"], [left + 6, yt + 16, "start"], [left + 6, yt - 6, "start"]], "fig-t-halo fig-t-soft");
  if (stepAt) {
    const [sx, sy] = stepAt;
    place(Lx.step, [[sx + 7, sy + 4, "start"], [sx + 7, sy + 22, "start"], [sx - 7, sy + 22, "end"], [sx + 7, sy - 14, "start"], [left + 6, bottom - 26, "start"]], "fig-t-halo fig-t-soft");
  }
  parts.push(text(left, top - 4, Lx.precY, { "font-size": TYPE.body, class: "fig-t-muted" }));
  return { svg: g({ class: "fig-precision" }, ...parts), h: bottom + axisHeight(true, TYPE.body) - y0 };
}

function renderCoverage(m: M, x0: number, y0: number, w: number, titleH: number, Lx: L, lang: Lang, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  heading(tpl(Lx.cover, { n: nText(m.n) }), x0, y0, w, lang, parts);
  const left = x0 + 34, right = x0 + w - 8;
  const top = y0 + titleH + 12, plotH = 200, bottom = top + plotH;
  const x = linear([0, 1], [left, right]);
  const y = linear([0.5, 1], [bottom, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [top, bottom], title: Lx.covX, size: TYPE.body, format: (v) => String(v) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1], grid: [left, right], size: TYPE.body, format: (v) => fixed(v * 100, 0) }));
  const clip = `${uid}-cov`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top - 2, width: right - left, height: plotH + 2 }))));
  const cv = curves(m.n);
  const y95 = y(0.95);
  const marks: string[] = [];
  marks.push(el("line", { x1: left, x2: right, y1: y95, y2: y95, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 4" }));
  const path = (vals: number[]) => linePath(P_GRID.map((p, i) => [x(p), y(Math.max(0.4, vals[i]))] as [number, number]));
  marks.push(el("path", { d: path(cv.wilson), fill: "none", stroke: C.c2, "stroke-width": 1.4, "stroke-linejoin": "round" }));
  marks.push(el("path", { d: path(cv.wald), fill: "none", stroke: C.c1, "stroke-width": 1.4, "stroke-linejoin": "round" }));
  const xp = x(m.p);
  marks.push(el("line", { x1: xp, x2: xp, y1: top, y2: bottom, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  for (const [v, c] of [[m.covWilson, C.c2], [m.covWald, C.c1]] as const) {
    if (v >= 0.5) marks.push(el("circle", { cx: xp, cy: y(v), r: 4, fill: c, stroke: C.paper, "stroke-width": 1.5 }));
  }
  parts.push(g({ "clip-path": `url(#${clip})` }, ...marks));
  parts.push(text(left, top - 4, Lx.covY, { "font-size": TYPE.body, class: "fig-t-muted" }));
  return { svg: g({ class: "fig-coverage" }, ...parts), h: bottom + axisHeight(true, TYPE.body) - y0 };
}

function renderLegend(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const items: Array<[string, string, string | undefined]> = [[Lx.wald, C.c1, undefined], [Lx.wilson, C.c2, "6 3"]];
  const parts: string[] = [];
  let x = x0;
  for (const [label, c, dash] of items) {
    parts.push(el("line", { x1: x, x2: x + 24, y1: y0 + 8, y2: y0 + 8, stroke: c, "stroke-width": 2.4, "stroke-dasharray": dash }));
    parts.push(text(x + 30, y0 + 12, label, { "font-size": TYPE.body }));
    x += 30 + textWidth(label, TYPE.body) + 20;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: 20 };
}

function renderReadout(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const rows: Array<[string, string]> = [
    [tpl(Lx.rH, { p: fixed(m.p, 2), q: fixed(1 - m.p, 2), n: nText(m.n), h: ppH(m.h) }), "fig-t-strong fig-t-num"],
    [tpl(Lx.rWilson, { h: ppH(m.hW) }), "fig-t-num"],
    [tpl(Lx.rStar, { t: sig(m.hStar * 100, 3), n: nText(m.nStar) }), "fig-t-num"],
    [tpl(Lx.rCov, { p: fixed(m.p, 2), n: nText(m.n), w: pctCov(m.covWald), s: pctCov(m.covWilson) }), "fig-t-num"],
  ];
  const parts: string[] = [];
  let y = y0;
  for (const [s, cls] of rows) {
    for (const ln of lines(s, TYPE.body, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: cls })); }
    y += 3;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 2 };
}

// ---------------------------------------------------------------- figure

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, {
    p: fixed(m.p, 2), n: nText(m.n), h: ppH(m.h), s: nText(m.nStar), t: sig(m.hStar * 100, 3),
    w: pctCov(m.covWald), v: pctCov(m.covWilson),
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  const lg = renderLegend(0, 0, w, Lx);
  parts.push(lg.svg);
  let y = lg.h + 12;
  if (narrow) {
    const th = (s: string) => lines(s, TYPE.label, w, lang).length * 17 + 14;
    const a = renderPrecision(m, 0, y, w, th(Lx.precision), Lx, lang, st.uid);
    parts.push(a.svg); y += a.h + 18;
    const b = renderCoverage(m, 0, y, w, th(tpl(Lx.cover, { n: nText(m.n) })), Lx, lang, st.uid);
    parts.push(b.svg); y += b.h + 10;
  } else {
    const gap = 28;
    const pw = Math.floor((w - gap) / 2);
    const titleH = Math.max(lines(Lx.precision, TYPE.label, pw, lang).length, lines(tpl(Lx.cover, { n: nText(m.n) }), TYPE.label, pw, lang).length) * 17 + 14;
    const a = renderPrecision(m, 0, y, pw, titleH, Lx, lang, st.uid);
    const b = renderCoverage(m, pw + gap, y, w - pw - gap, titleH, Lx, lang, st.uid);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 10;
  }
  const ro = renderReadout(m, 0, y, w, Lx, lang);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "binomial-interval",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    n: { kind: "range", scale: "log", label: { en: "Items n", zh: "项目数 n" }, min: N_MIN, max: N_MAX, default: 100 },
    p: { kind: "range", label: { en: "Accuracy p", zh: "准确率 p" }, min: 0.02, max: 0.98, step: 0.01, default: 0.95 },
    target: { kind: "range", label: { en: "Half-width you need", zh: "所需半宽" }, unit: { en: "pp", zh: "个百分点" }, min: 0.5, max: 10, step: 0.5, default: 1 },
  },
  render,
  describe,
});
