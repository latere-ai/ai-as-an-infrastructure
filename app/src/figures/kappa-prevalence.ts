// Cohen's kappa for two raters and two nominal labels (pass, fail), as the
// chapter defines it:
//
//   κ = (p_o − p_e) / (1 − p_e),   p_e = π₁π₂ + (1 − π₁)(1 − π₂)
//
// with p_o the share of units on which the raters agree and π₁, π₂ the share
// each rater labels pass. One illustrative table of N = 200 units, with counts
// set by the controls rather than drawn: both raters label the same share π
// pass, and d units fall in each disagreement cell, so
//
//   n₁₀ = n₀₁ = d = round(N (1 − p_o) / 2),  n₁₁ = Nπ − d,  n₀₀ = N(1 − π) − d.
//
// The margins force p_o ≥ |2π − 1|: with Nπ pass labels from each rater, at
// least N(2π − 1) units are pass for both. The controls keep p_o above that
// bound. Every number drawn is computed from the integer table. The curves on
// the right are the same formulas as functions of π at the chosen p_o. At
// π = 1 every unit is pass for both raters, p_o = p_e = 1, and κ is 0 / 0.
//
// The sensitivity row is the derivative dκ / dp_o = 1 / (1 − p_e) at fixed
// margins, per point of raw agreement: the closer p_e is to 1, the more one
// agreement or disagreement moves κ.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const N = 200;

type Example = "balanced" | "rare" | "single";
const EXAMPLES: Record<Example, { pass: number; agree: number }> = {
  balanced: { pass: 0.5, agree: 0.9 },
  rare: { pass: 0.94, agree: 0.9 },
  single: { pass: 1, agree: 1 },
};

type P = { example: Example; pass: number; agree: number };

// The smallest raw agreement the margins allow.
const floorAgree = (pass: number) => Math.abs(2 * pass - 1);

function model(p: P) {
  const A = Math.round(N * Math.min(1, Math.max(0, p.pass))); // pass labels per rater
  const dMax = Math.min(A, N - A);
  const d = Math.min(dMax, Math.max(0, Math.round((N * (1 - p.agree)) / 2)));
  const n11 = A - d, n10 = d, n01 = d, n00 = N - A - d;
  const pi1 = (n11 + n10) / N, pi2 = (n11 + n01) / N;
  const po = (n11 + n00) / N;
  const pe = pi1 * pi2 + (1 - pi1) * (1 - pi2);
  const defined = pe < 1 - 1e-12;
  const kappa = defined ? (po - pe) / (1 - pe) : NaN;
  return { A, d, n11, n10, n01, n00, pi1, pi2, po, pe, kappa, defined, perPoint: defined ? 0.01 / (1 - pe) : NaN };
}
type M = ReturnType<typeof model>;

// The curves: p_e and κ as functions of π at a fixed p_o, over the π the
// margins allow (π ≤ (1 + p_o) / 2 on the plotted half, π ≥ 0.5).
const peOf = (pi: number) => pi * pi + (1 - pi) * (1 - pi);
const kappaOf = (po: number, pi: number) => (po - peOf(pi)) / (1 - peOf(pi));

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Raw agreement and Cohen's kappa",
    table: "Two raters label {n} units",
    rater1: "Rater 1",
    rater2: "Rater 2",
    pass: "pass",
    fail: "fail",
    total: "total",
    expected: "expected {v}",
    expNote: "expected: the count if the raters labeled independently with these margins, N·π₁·π₂ for pass and pass",
    chart: "At p_o = {po}, as the pass share π changes",
    xTitle: "share of units each rater labels pass, π (%)",
    impossible: "p_o is below |2π − 1| here",
    po: "p_o",
    pe: "p_e",
    kappa: "κ",
    terms: "From the table",
    fPo: "p_o = (n₁₁ + n₀₀) / N",
    fPe: "p_e = π₁π₂ + (1 − π₁)(1 − π₂)",
    fK: "κ = (p_o − p_e) / (1 − p_e)",
    fS: "κ per point of p_o = 0.01 / (1 − p_e)",
    vPo: "({a} + {b}) / {n} = {v}",
    vPe: "{p1} · {p2} + {q1} · {q2} = {v}",
    vK: "({po} − {pe}) / {den} = {v}",
    undefined: "0 / 0, undefined",
    none: "undefined",
    describe: "{n} units, each rater labels {pi} pass, raw agreement p_o = {po}. Under independence with these margins p_e = {pe}, so κ = {k}. At this prevalence one point of raw agreement moves κ by {s}.",
    describeNone: "{n} units, all labeled pass by both raters: p_o = p_e = 1, so κ is 0 / 0 and undefined although raw agreement is 100%.",
  },
  zh: {
    title: "原始一致率与 Cohen 的 kappa",
    table: "两位标注者标注 {n} 个单位",
    rater1: "标注者 1",
    rater2: "标注者 2",
    pass: "通过",
    fail: "不通过",
    total: "合计",
    expected: "期望 {v}",
    expNote: "期望：两位标注者保持这些边际频率、彼此独立作答时的计数，两人都判通过的一格为 N·π₁·π₂",
    chart: "p_o = {po} 时，随通过比例 π 变化",
    xTitle: "每位标注者判为通过的单位比例 π（%）",
    impossible: "此处 p_o 低于 |2π − 1|，无法出现",
    po: "p_o",
    pe: "p_e",
    kappa: "κ",
    terms: "由表中计数得到",
    fPo: "p_o = (n₁₁ + n₀₀) / N",
    fPe: "p_e = π₁π₂ + (1 − π₁)(1 − π₂)",
    fK: "κ = (p_o − p_e) / (1 − p_e)",
    fS: "p_o 每变 1 个百分点，κ 变化 0.01 / (1 − p_e)",
    vPo: "({a} + {b}) / {n} = {v}",
    vPe: "{p1} · {p2} + {q1} · {q2} = {v}",
    vK: "({po} − {pe}) / {den} = {v}",
    undefined: "0 / 0，没有定义",
    none: "没有定义",
    describe: "{n} 个单位，每位标注者把 {pi} 判为通过，原始一致率 p_o = {po}。在这些边际频率下假设独立作答，p_e = {pe}，因此 κ = {k}。在这个比例下，原始一致率每变 1 个百分点，κ 变化 {s}。",
    describeNone: "{n} 个单位全部被两人判为通过：p_o = p_e = 1，κ 成了 0 / 0，没有定义，尽管原始一致率是 100%。",
  },
};
type L = typeof labels.en;

// ---------------------------------------------------------------- render

function lines(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w);
}

const f3 = (v: number) => fixed(v, 3);
const f4 = (v: number) => fixed(v, 4);
const f2 = (v: number) => fixed(v, 2);

// The 2×2 table with category labels on both raters, margins, and the count
// each cell would hold under independence.
function renderTable(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(Lx.table, { n: N }), TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 12;
  const rowW = Math.max(...[Lx.rater1, Lx.pass, Lx.fail, Lx.total].map((s) => textWidth(s, TYPE.body))) + 12;
  const totW = Math.max(textWidth(Lx.total, TYPE.body), textWidth("200", TYPE.body)) + 8;
  const cw = Math.min(112, Math.floor((w - rowW - totW - 10) / 2));
  const ch = 50;
  const cx = [x0 + rowW, x0 + rowW + cw + 4];
  const tx = cx[1] + cw + 6 + totW; // right edge of the totals column
  // Rater 2 over the columns, rater 1 over the row labels.
  parts.push(text(cx[0] + cw + 2, y + 12, Lx.rater2, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  parts.push(el("line", { x1: cx[0], x2: cx[1] + cw, y1: y + 18, y2: y + 18, stroke: C.rule, "stroke-width": 1 }));
  y += 22;
  parts.push(text(x0, y + 13, Lx.rater1, { "font-size": TYPE.body, class: "fig-t-strong" }));
  parts.push(text(cx[0] + cw / 2, y + 13, Lx.pass, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(cx[1] + cw / 2, y + 13, Lx.fail, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(tx, y + 13, Lx.total, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 20;
  const cells: Array<[string, number, number]> = [
    ["n₁₁", m.n11, N * m.pi1 * m.pi2], ["n₁₀", m.n10, N * m.pi1 * (1 - m.pi2)],
    ["n₀₁", m.n01, N * (1 - m.pi1) * m.pi2], ["n₀₀", m.n00, N * (1 - m.pi1) * (1 - m.pi2)],
  ];
  for (let r = 0; r < 2; r++) {
    const ry = y + r * (ch + 4);
    parts.push(text(x0, ry + ch / 2 + 4, r === 0 ? Lx.pass : Lx.fail, { "font-size": TYPE.body, class: "fig-t-muted" }));
    for (let c = 0; c < 2; c++) {
      const [name, n, e] = cells[r * 2 + c];
      const agree = r === c;
      parts.push(el("rect", { x: cx[c], y: ry, width: cw, height: ch, rx: 4, fill: agree ? C.c1 : C.c2, "fill-opacity": 0.16, stroke: agree ? C.c1 : C.c2, "stroke-width": 1 }));
      parts.push(text(cx[c] + 7, ry + 20, `${name} ${int(n)}`, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
      parts.push(text(cx[c] + 7, ry + 39, tpl(Lx.expected, { v: fixed(e, 1) }), { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
    }
    parts.push(text(tx, ry + ch / 2 + 4, int(r === 0 ? m.n11 + m.n10 : m.n01 + m.n00), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  }
  y += 2 * (ch + 4) + 16;
  parts.push(text(x0, y, Lx.total, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(cx[0] + cw / 2, y, int(m.n11 + m.n01), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(text(cx[1] + cw / 2, y, int(m.n10 + m.n00), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(text(tx, y, int(N), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  y += 6;
  for (const ln of lines(Lx.expNote, TYPE.body, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 + 4 };
}

// p_o, p_e and κ against the pass share π at the table's p_o, with the
// current π marked and the π the margins rule out hatched.
function renderChart(m: M, pass: number, x0: number, y0: number, w: number, narrow: boolean, uid: string, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [el("defs", {}, hatch(`${uid}-imp`, C.ink3, 5, 1))];
  let y = y0;
  for (const ln of lines(tpl(Lx.chart, { po: f3(m.po) }), TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 14;
  const left = x0 + 38, right = x0 + w - 12;
  const top = y, ph = narrow ? 190 : 206, bottom = top + ph;
  const xs = linear([0.5, 1], [left, right]);
  const ys = linear([-1, 1], [bottom, top]);
  const bound = Math.min(1, (1 + m.po) / 2); // largest π the margins allow at this p_o
  if (bound < 1) parts.push(el("rect", { x: xs(bound), y: top, width: right - xs(bound), height: ph, fill: `url(#${uid}-imp)` }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [-1, -0.5, 0, 0.5, 1], grid: [left, right], format: (v) => fixed(v, v === Math.round(v) ? 0 : 1).replace("−0", "−0"), size: TYPE.body }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1], format: (v) => String(Math.round(v * 100)), title: Lx.xTitle, size: TYPE.body }));
  parts.push(el("line", { x1: left, x2: right, y1: ys(0), y2: ys(0), stroke: C.rule, "stroke-width": 1 }));
  // Curves, sampled finely; κ stops where p_e reaches 1.
  const samp = (f: (pi: number) => number, hi: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    const steps = 120;
    for (let k = 0; k <= steps; k++) {
      const pi = 0.5 + ((hi - 0.5) * k) / steps;
      const v = f(pi);
      if (Number.isFinite(v)) pts.push([xs(pi), ys(Math.max(-1, Math.min(1, v)))]);
    }
    return pts;
  };
  const kHi = m.po >= 1 ? 0.995 : bound;
  const curves: Array<{ pts: Array<[number, number]>; color: string }> = [
    { pts: samp(() => m.po, bound), color: C.c3 },
    { pts: samp(peOf, 1), color: C.c2 },
    { pts: samp((pi) => kappaOf(m.po, pi), kHi), color: C.c1 },
  ];
  for (const c of curves) {
    parts.push(el("path", { d: linePath(c.pts), fill: "none", stroke: c.color, "stroke-width": 2, "stroke-linejoin": "round" }));
  }
  // The current π.
  const cx = xs(Math.min(1, Math.max(0.5, pass)));
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const marks: Array<{ v: number; color: string }> = [{ v: m.po, color: C.c3 }, { v: m.pe, color: C.c2 }];
  if (m.defined) marks.push({ v: m.kappa, color: C.c1 });
  for (const mk of marks) parts.push(el("circle", { cx, cy: ys(Math.max(-1, Math.min(1, mk.v))), r: 4.5, fill: mk.color, stroke: C.paper, "stroke-width": 1.5 }));
  y = bottom + axisHeight(true, TYPE.body) + 8;
  // Legend: the three quantities and the ruled-out region.
  const items: Array<{ w: number; draw: (x: number, yy: number) => string } | null> = [
    ...([[`${Lx.po} ${f3(m.po)}`, C.c3], [`${Lx.pe} ${f4(m.pe)}`, C.c2], [`${Lx.kappa} ${m.defined ? f3(m.kappa) : Lx.none}`, C.c1]] as const).map(([name, color]) => ({
      w: 30 + textWidth(name, TYPE.body),
      draw: (x: number, yy: number) => el("line", { x1: x, x2: x + 22, y1: yy - 4, y2: yy - 4, stroke: color, "stroke-width": 2 }) + el("circle", { cx: x + 11, cy: yy - 4, r: 3.5, fill: color, stroke: C.paper, "stroke-width": 1 }) + text(x + 30, yy, name, { "font-size": TYPE.body, class: "fig-t-num" }),
    })),
    bound >= 1 ? null : {
      w: 22 + textWidth(Lx.impossible, TYPE.body),
      draw: (x: number, yy: number) => el("rect", { x, y: yy - 11, width: 14, height: 12, rx: 2, fill: `url(#${uid}-imp)`, stroke: C.ink3, "stroke-width": 0.8 }) + text(x + 22, yy, Lx.impossible, { "font-size": TYPE.body, class: "fig-t-muted" }),
    },
  ];
  let lx = x0, row = 0;
  for (const it of items) {
    if (!it) continue;
    if (lx > x0 && lx + it.w > x0 + w) { row++; lx = x0; }
    parts.push(it.draw(lx, y + 12 + row * 20));
    lx += it.w + 16;
  }
  y += 20 + row * 20;
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 };
}

// The equation's terms with the table's numbers substituted.
function renderReadout(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.terms, TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const rows: Array<[string, string, boolean]> = [
    [Lx.fPo, tpl(Lx.vPo, { a: int(m.n11), b: int(m.n00), n: N, v: f3(m.po) }), false],
    [Lx.fPe, tpl(Lx.vPe, { p1: f2(m.pi1), p2: f2(m.pi2), q1: f2(1 - m.pi1), q2: f2(1 - m.pi2), v: f4(m.pe) }), false],
    [Lx.fK, m.defined ? tpl(Lx.vK, { po: f3(m.po), pe: f4(m.pe), den: f4(1 - m.pe), v: f3(m.kappa) }) : Lx.undefined, true],
    [Lx.fS, m.defined ? f3(m.perPoint) : Lx.none, false],
  ];
  for (const [f, v, strong] of rows) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const oneLine = textWidth(f, TYPE.body) + textWidth(v, TYPE.body) + 24 <= w;
    const fl = lines(f, TYPE.body, w, lang);
    fl.forEach((ln, i) => parts.push(text(x0, y + 15 + i * 16, ln, { "font-size": TYPE.body, class: "fig-t-num" })));
    const vy = oneLine ? y + 15 : y + 15 + fl.length * 16;
    parts.push(text(x0 + w, vy, v, { "font-size": TYPE.body, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    y = vy + 7;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  if (!m.defined) return tpl(Lx.describeNone, { n: N });
  return tpl(Lx.describe, { n: N, pi: `${fixed(m.pi1 * 100, 0)}%`, po: f3(m.po), pe: f4(m.pe), k: f3(m.kappa), s: f3(m.perPoint) });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    const tb = renderTable(m, 0, y, w, Lx, lang);
    parts.push(tb.svg); y += tb.h + 18;
    const ch = renderChart(m, st.p.pass, 0, y, w, true, st.uid, Lx, lang);
    parts.push(ch.svg); y += ch.h + 16;
  } else {
    const gap = 28;
    const tw = Math.floor((w - gap) * 0.53);
    const tb = renderTable(m, 0, y, tw, Lx, lang);
    const ch = renderChart(m, st.p.pass, tw + gap, y, w - tw - gap, false, st.uid, Lx, lang);
    parts.push(tb.svg, ch.svg);
    y += Math.max(tb.h, ch.h) + 16;
  }
  const ro = renderReadout(m, 0, y, w, Lx, lang);
  parts.push(ro.svg); y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "kappa-prevalence",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    example: {
      kind: "choice", label: { en: "Example", zh: "示例" }, default: "rare",
      options: [
        { value: "balanced", label: { en: "Balanced labels", zh: "标签均衡" } },
        { value: "rare", label: { en: "Rare failures", zh: "很少不通过" } },
        { value: "single", label: { en: "One label only", zh: "只有一种标签" } },
      ],
    },
    pass: {
      kind: "range", label: { en: "Share labeled pass, each rater", zh: "两人判为通过的比例" }, min: 0.5, max: 1, step: 0.01, default: 0.94,
    },
    agree: {
      kind: "range", label: { en: "Raw agreement p_o", zh: "原始一致率 p_o" }, min: 0, max: 1, step: 0.01, default: 0.9,
    },
  },
  // An example sets both sliders; moving the pass share raises p_o to the
  // smallest agreement its margins allow, and p_o cannot be set below it.
  update(p, key) {
    if (key === "example") return { ...p, ...EXAMPLES[p.example as Example] };
    const lo = Math.round(floorAgree(p.pass) * 100) / 100;
    if (p.agree < lo) return { ...p, agree: lo };
    return p;
  },
  render,
  describe,
});
