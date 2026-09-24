// When dataset demand reaches the stock of public text, under the chapter's
// sensitivity model
//
//   D(t) = D₀ g^(t − t₀),   t* = t₀ + ln(S / D₀) / ln g,   t₀ = 2024,
//
// with the reader setting the growth factor g, the stock S, and the starting
// demand D₀. The figure draws the model's own answer and, separately labeled,
// the published forecast it does not reproduce, so the two estimates the
// chapter reports (late 2027 from this equation, median 2028 from the paper's
// Monte Carlo model) are never confused.
//
// Numbers from Villalobos et al. (ICML 2024), as the chapter reports them:
// raw indexed-web stock, median 510T tokens with a 95 percent interval of 130T
// to 2,100T; effective stock at the modeled crossing, about 400T; historical
// dataset growth, about 2.4× per year; crossing window 2026 to 2032, median
// 2028. The 15T starting demand in 2024 is the chapter's illustrative input.
// The defaults reproduce the chapter's runnable block: g = 2.4, 1.8, and 3.0
// give 2027.75, 2029.59, and 2026.99.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, overlaps, textBox, textWidth, type Box, type LabelRequest } from "./lib/labels.ts";
import { legend } from "./lib/legend.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, sig, tpl } from "./lib/format.ts";

const T0 = 2024;
const RAW = { median: 510, lo: 130, hi: 2100 }; // trillion tokens
const PAPER = { lo: 2026, hi: 2032, median: 2028 };
const YEARS: [number, number] = [2024, 2040];
const TOK: [number, number] = [1, 10000]; // trillion tokens
const G_RANGE: [number, number] = [1.5, 3.5];

const labels = {
  en: {
    title: "When dataset demand reaches the stock of public text",
    x: "year",
    y: "tokens (log scale)",
    demand: "demand D(t)",
    stock: "stock S = {s}",
    raw: "raw web stock, 95% interval",
    cross: "t* = {t}",
    beyond: "t* = {t}, past 2040",
    paper: "published forecast: 2026 to 2032, median 2028",
    paperShort: "published: 2026 to 2032",
    head: "Crossing year of this model",
    eq: "t* = t₀ + ln(S / D₀) / ln g",
    sub1: "= {t0} + ln({s} / {d}) / ln {g}",
    sub2: "= {t0} + {a} / {b} = {t}",
    double: "Doubling S moves t* by ln 2 / ln g = {v} years",
    growth: "Growth from {g1}× to {g2}× per year moves t* from {t1} to {t2}",
    compare: "The published median, 2028, comes from the paper's Monte Carlo model, which this equation does not reproduce.",
    sensTitle: "Crossing year against growth g",
    sensX: "growth factor g (× per year)",
    sensAt: "S = {s}",
    sensLo: "S = 130T",
    sensHi: "S = 2,100T",
    describe: "With demand {d} in 2024 growing {g}× per year and a stock of {s}, the model crosses at {t}: ln({s} / {d}) = {a} divided by ln {g} = {b} gives {y} years after 2024. Doubling the stock adds {v} years. The published forecast is 2026 to 2032 with a median of 2028.",
  },
  zh: {
    title: "数据集需求何时达到公开文本存量",
    x: "年份",
    y: "词元数（对数刻度）",
    demand: "需求 D(t)",
    stock: "存量 S = {s}",
    raw: "网络原始存量 95% 区间",
    cross: "t* = {t}",
    beyond: "t* = {t}，晚于 2040",
    paper: "论文预测：2026 至 2032 年，中位数 2028 年",
    paperShort: "论文预测：2026 至 2032",
    head: "本模型的交点年份",
    eq: "t* = t₀ + ln(S / D₀) / ln g",
    sub1: "= {t0} + ln({s} / {d}) / ln {g}",
    sub2: "= {t0} + {a} / {b} = {t}",
    double: "存量 S 翻倍，t* 推迟 ln 2 / ln g = {v} 年",
    growth: "年增长从 {g1} 倍降到 {g2} 倍，t* 从 {t1} 移到 {t2}",
    compare: "2028 年这个中位数来自论文的蒙特卡洛模型，本式并不复现它。",
    sensTitle: "交点年份随增长因子 g 变化",
    sensX: "增长因子 g（倍/年）",
    sensAt: "S = {s}",
    sensLo: "S = 130T",
    sensHi: "S = 2,100T",
    describe: "2024 年需求为 {d}、每年增长 {g} 倍、存量为 {s} 时，模型交点在 {t}：ln({s} / {d}) = {a}，除以 ln {g} = {b}，得到 2024 年之后 {y} 年。存量翻倍会让交点推迟 {v} 年。论文给出的预测区间是 2026 至 2032 年，中位数 2028 年。",
  },
};
type L = typeof labels.en;
type P = { growth: number; stock: number; start: number };

const crossing = (S: number, D0: number, gr: number) => T0 + Math.log(S / D0) / Math.log(gr);
const tok = (v: number) => `${v >= 1000 ? Math.round(v).toLocaleString("en-US") : sig(v, 3)}T`;
const yr = (t: number) => fixed(t, 2);

function terms(p: P) {
  const a = Math.log(p.stock / p.start), b = Math.log(p.growth);
  return { a, b, t: T0 + a / b };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = terms(p);
  return tpl(L.describe, {
    d: tok(p.start), g: sig(p.growth, 3), s: tok(p.stock), t: yr(m.t), a: fixed(m.a, 2), b: fixed(m.b, 3), y: fixed(m.a / m.b, 2), v: fixed(Math.LN2 / m.b, 2),
  });
}

function mainPlot(p: P, x0: number, y0: number, w: number, L: L, fs: number, uid: string, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  const left = x0 + (narrow ? 50 : 58), right = x0 + w - 14;
  const top = y0 + 22, plotH = narrow ? 230 : 260;
  const x = linear(YEARS, [left, right]);
  const y = log(TOK, [top + plotH, top]);
  const m = terms(p);
  const clip = `${uid}-plot`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: right - left, height: plotH }))));
  parts.push(text(x0, y0 + 10, L.y, { "font-size": fs, class: "fig-t-muted" }));

  // Raw-stock interval, its median, and the axes.
  parts.push(el("rect", { x: left, y: y(RAW.hi), width: right - left, height: y(RAW.lo) - y(RAW.hi), fill: C.c2, "fill-opacity": 0.1 }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], ticks: narrow ? [2024, 2028, 2032, 2036, 2040] : x.ticks(8), title: L.x, format: (v) => String(v), size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], minor: true, format: tok, size: fs }));
  parts.push(el("line", { x1: left, x2: right, y1: y(RAW.median), y2: y(RAW.median), stroke: C.c2, "stroke-width": 1, "stroke-dasharray": "2 3" }));

  // The chosen stock and the demand line.
  const ys = y(p.stock);
  parts.push(el("line", { x1: left, x2: right, y1: ys, y2: ys, stroke: C.c2, "stroke-width": 2 }));
  const dpts: Array<[number, number]> = [];
  for (let t = YEARS[0]; t <= YEARS[1] + 1e-9; t += 0.25) dpts.push([x(t), y(p.start * p.growth ** (t - T0))]);
  parts.push(g({ "clip-path": `url(#${clip})` }, el("path", { d: linePath(dpts), fill: "none", stroke: C.c1, "stroke-width": 2.2 })));

  // Published forecast: a bracket near the foot of the plot.
  const by = top + plotH - (narrow ? 16 : 18);
  const bx0 = x(PAPER.lo), bx1 = x(PAPER.hi), bm = x(PAPER.median);
  parts.push(el("line", { x1: bx0, x2: bx1, y1: by, y2: by, stroke: C.ink2, "stroke-width": 2 }));
  for (const bx of [bx0, bx1]) parts.push(el("line", { x1: bx, x2: bx, y1: by - 4, y2: by + 4, stroke: C.ink2, "stroke-width": 1.5 }));
  parts.push(el("path", { d: `M${bm},${by - 5}L${bm + 5},${by}L${bm},${by + 5}L${bm - 5},${by}Z`, fill: C.ink2 }));
  const paperText = narrow ? L.paperShort : L.paper;
  parts.push(text(bx0, by - 9, paperText, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));

  // Crossing marker (or an arrow at the edge when it falls past the axis).
  const obstacles: Box[] = [...lineObstacles(dpts.filter(([, py]) => py >= top && py <= top + plotH)), ...lineObstacles([[left, ys], [right, ys]])];
  obstacles.push(textBox(bx0, by - 9, paperText, fs), { x0: bx0 - 2, y0: by - 6, x1: bx1 + 2, y1: by + 6 });
  const reqs: LabelRequest[] = [];
  if (m.t <= YEARS[1]) {
    const cx = x(Math.max(m.t, YEARS[0]));
    // The drop line stops above the published bracket's label, so the two
    // estimates read against each other without a line through the text.
    const foot = cx >= bx0 - 4 && cx <= bx0 + textWidth(paperText, fs) + 4 ? by - 9 - fs - 3 : top + plotH;
    parts.push(el("line", { x1: cx, x2: cx, y1: ys, y2: foot, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    parts.push(el("circle", { cx, cy: ys, r: 5.5, fill: C.ink, stroke: C.paper, "stroke-width": 2 }));
    obstacles.push({ x0: cx - 7, y0: ys - 7, x1: cx + 7, y1: ys + 7 }, ...lineObstacles([[cx, ys], [cx, foot]]));
    reqs.push({ x: cx, y: ys, text: tpl(L.cross, { t: yr(m.t) }), size: TYPE.label, sides: ["above-left", "above-right", "below-right", "left", "right"], gap: 10, priority: 5, attrs: { class: "fig-t-halo fig-t-num" } });
  } else {
    reqs.push({ x: right - 4, y: ys, text: tpl(L.beyond, { t: yr(m.t) }), size: fs, sides: ["above-left", "below-left"], gap: 6, priority: 5, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  reqs.push({ x: right, y: ys, text: tpl(L.stock, { s: tok(p.stock) }), size: fs, sides: ["above-left", "below-left"], gap: 5, priority: 4, attrs: { class: "fig-t-halo" } });
  // Demand label beside the line where it leaves the top of the plot (or at
  // its right end), away from the crossing and the stock lines.
  const inside = dpts.filter(([, py]) => py >= top + 4);
  const dAt = inside[inside.length - 1] ?? dpts[dpts.length - 1];
  reqs.push({ x: dAt[0], y: Math.max(dAt[1], top + 8), text: L.demand, size: fs, sides: ["left", "below-left", "right", "below-right"], gap: 8, priority: 2, attrs: { class: "fig-t-halo" } });
  const bounds = { x0: left + 2, y0: top + 2, x1: right - 2, y1: top + plotH - 2 };
  obstacles.push(...lineObstacles([[left, y(RAW.median)], [right, y(RAW.median)]]));
  const placed = placeLabels(reqs, bounds, obstacles);
  // A stock label crowded out at the right end moves to the left end of its line.
  const lost = placed.dropped.find((q) => q.text === tpl(L.stock, { s: tok(p.stock) }));
  if (lost) {
    const retry = placeLabels([{ ...lost, x: left + 4, sides: ["below-right", "above-right"] }], bounds, [...obstacles, ...placed.placed.map((q) => q.box)]);
    placed.placed.push(...retry.placed);
  }
  parts.push(drawLabels(placed.placed));
  // The band's name goes in the first corner of the band that the lines and
  // the labels above leave clear.
  const taken = [...obstacles, ...placed.placed.map((q) => q.box)];
  const rawTop = y(RAW.hi) + fs + 3, rawBottom = y(RAW.lo) - 5;
  const corners: Array<[number, number, "start" | "end"]> = [[right - 5, rawTop, "end"], [left + 5, rawTop, "start"], [right - 5, rawBottom, "end"], [left + 5, rawBottom, "start"]];
  const spot = corners.find(([cx, cy, a]) => !taken.some((o) => overlaps(o, textBox(cx, cy, L.raw, fs, a)))) ?? corners[0];
  parts.push(text(spot[0], spot[1], L.raw, { "font-size": fs, "text-anchor": spot[2], class: "fig-t-halo fig-t-soft" }));
  return { svg: g({ class: "fig-main" }, ...parts), h: top - y0 + plotH + axisHeight(true, fs) };
}

function readout(p: P, x0: number, y0: number, w: number, L: L, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const m = terms(p);
  let y = y0 + 13;
  parts.push(text(x0, y, L.head, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 24;
  parts.push(text(x0, y, L.eq, { "font-size": TYPE.label, class: "fig-t-num" }));
  y += 20;
  parts.push(text(x0 + 10, y, tpl(L.sub1, { t0: T0, s: tok(p.stock), d: tok(p.start), g: sig(p.growth, 3) }), { "font-size": fs + 1, class: "fig-t-num" }));
  y += 20;
  parts.push(text(x0 + 10, y, tpl(L.sub2, { t0: T0, a: fixed(m.a, 2), b: fixed(m.b, 3), t: yr(m.t) }), { "font-size": fs + 1, class: "fig-t-strong fig-t-num" }));
  y += 10;
  const lines: Array<[string, string]> = [
    [tpl(L.double, { v: fixed(Math.LN2 / m.b, 2) }), "fig-t-num"],
    [tpl(L.growth, { g1: "2.4", g2: "1.8", t1: yr(crossing(p.stock, p.start, 2.4)), t2: yr(crossing(p.stock, p.start, 1.8)) }), "fig-t-num"],
    [L.compare, "fig-t-muted"],
  ];
  for (const [s, cls] of lines) {
    y += 8;
    for (const ln of wrapCJK(s, fs, w)) { y += fs + 5; parts.push(text(x0, y, ln, { "font-size": fs, class: cls })); }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function sensitivity(p: P, x0: number, y0: number, w: number, L: L, fs: number, uid: string, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, L.sensTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  // An end of the raw interval that coincides with the chosen stock is drawn once.
  const showLo = Math.abs(Math.log(p.stock / RAW.lo)) > 0.03, showHi = Math.abs(Math.log(p.stock / RAW.hi)) > 0.03;
  const lg = legend([
    { label: tpl(L.sensAt, { s: tok(p.stock) }), swatch: { kind: "line", stroke: C.ink } },
    ...(showHi ? [{ label: L.sensHi, swatch: { kind: "line" as const, stroke: C.c2, dash: "7 3" } }] : []),
    ...(showLo ? [{ label: L.sensLo, swatch: { kind: "line" as const, stroke: C.c2, dash: "1.5 3" } }] : []),
    { label: L.paperShort, swatch: { kind: "rect", fill: C.ink3, opacity: 0.3 } },
  ], x0, y0 + 20, w, fs);
  parts.push(lg.svg);
  const left = x0 + 40, right = x0 + w - 12;
  const top = y0 + 30 + lg.height + 6, plotH = 150;
  const x = linear(G_RANGE, [left, right]);
  const y = linear(YEARS, [top + plotH, top]);
  const clip = `${uid}-sens`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: right - left, height: plotH }))));
  parts.push(el("rect", { x: left, y: y(PAPER.hi), width: right - left, height: y(PAPER.lo) - y(PAPER.hi), fill: C.ink3, "fill-opacity": 0.14 }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], ticks: [1.5, 2, 2.5, 3, 3.5], title: L.sensX, format: (v) => String(v), size: fs }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [2024, 2028, 2032, 2036, 2040], format: (v) => String(v), size: fs }));
  const curve = (S: number) => {
    const pts: Array<[number, number]> = [];
    for (let gr = G_RANGE[0]; gr <= G_RANGE[1] + 1e-9; gr += 0.05) pts.push([x(gr), y(crossing(S, p.start, gr))]);
    return pts;
  };
  const lo = curve(RAW.lo), hi = curve(RAW.hi), cur = curve(p.stock);
  parts.push(g({ "clip-path": `url(#${clip})` },
    showLo && el("path", { d: linePath(lo), fill: "none", stroke: C.c2, "stroke-width": 1.6, "stroke-dasharray": "1.5 3", "stroke-linecap": "round" }),
    showHi && el("path", { d: linePath(hi), fill: "none", stroke: C.c2, "stroke-width": 1.4, "stroke-dasharray": "7 3" }),
    el("path", { d: linePath(cur), fill: "none", stroke: C.ink, "stroke-width": 2 })));
  const t = crossing(p.stock, p.start, p.growth);
  const cx = x(p.growth), cy = y(Math.min(t, YEARS[1]));
  parts.push(el("circle", { cx, cy, r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 2 }));
  return { svg: g({ class: "fig-sens" }, ...parts), h: top - y0 + plotH + axisHeight(true, fs) };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const main = mainPlot(p, 0, 0, w, L, fs, st.uid, narrow);
  parts.push(main.svg);
  let y = main.h + 18;
  if (narrow) {
    const r = readout(p, 0, y, w, L, fs);
    parts.push(r.svg); y += r.h + 18;
    const s = sensitivity(p, 0, y, w, L, fs, st.uid, narrow);
    parts.push(s.svg); y += s.h;
  } else {
    const rw = Math.floor(w * 0.48);
    const r = readout(p, 0, y, rw, L, fs);
    const s = sensitivity(p, rw + 28, y, w - rw - 28, L, fs, st.uid, narrow);
    parts.push(r.svg, s.svg);
    y += Math.max(r.h, s.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "data-crossing",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    growth: {
      kind: "range", label: { en: "Annual growth g", zh: "年增长因子 g" }, unit: { en: "× per year", zh: "倍/年" }, min: 1.5, max: 3.5, step: 0.05, default: 2.4,
      marks: [
        { value: 1.8, label: { en: "1.8×", zh: "1.8 倍" } },
        { value: 2.4, label: { en: "2.4×, the historical trend", zh: "2.4 倍，历史趋势" } },
        { value: 3, label: { en: "3.0×", zh: "3.0 倍" } },
      ],
    },
    stock: {
      kind: "range", scale: "log", label: { en: "Usable stock S", zh: "可用存量 S" }, unit: { en: "trillion tokens", zh: "万亿词元" }, min: 100, max: 3000, default: 400,
      marks: [
        { value: 130, label: { en: "raw, 95% low", zh: "原始存量 95% 下限" } },
        { value: 400, label: { en: "effective at the crossing", zh: "交点处有效存量" } },
        { value: 510, label: { en: "raw median", zh: "原始存量中位数" } },
        { value: 2100, label: { en: "raw, 95% high", zh: "原始存量 95% 上限" } },
      ],
    },
    start: {
      kind: "range", scale: "log", label: { en: "Demand D₀ in 2024", zh: "2024 年需求 D₀" }, unit: { en: "trillion tokens", zh: "万亿词元" }, min: 5, max: 50, default: 15,
      marks: [{ value: 15, label: { en: "15T, the chapter's input", zh: "15T，正文的输入" } }],
    },
  },
  render,
  describe,
});
