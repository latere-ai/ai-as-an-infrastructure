// Qualifying a model judge against human labels: the confusion matrix, raw
// agreement, Cohen's kappa, and the judge's two error rates, with the judge's
// behavior held fixed while the share of cases humans label good changes.
//
// Labels are 0 = bad and 1 = good; rows are the human label a, columns the
// judge label b, as in the chapter's runnable example. The judge passes a
// share fp of the cases humans label bad (false pass) and fails a share ff of
// the cases humans label good (false fail). For n cases of which a share π
// are good, the table holds the rounded counts
//
//   n₀· = round(n(1 − π)),  n₀₁ = round(n₀· fp),  n₀₀ = n₀· − n₀₁
//   n₁· = n − n₀·,          n₁₀ = round(n₁· ff),  n₁₁ = n₁· − n₁₀
//
// and the chapter's formulas give p_o = (n₀₀ + n₁₁) / n,
// p_e = (n₀· n·₀ + n₁· n·₁) / n², κ = (p_o − p_e) / (1 − p_e). At the defaults
// (n = 200, π = 0.9, fp = 0.2, ff = 0.1) the table is the runnable's
// [[16, 4], [18, 162]], with p_o = 0.89 and κ = 0.53.
//
// The curves are the same quantities from expected counts as functions of π:
// p_o = π(1 − ff) + (1 − π)(1 − fp) and, with q = π(1 − ff) + (1 − π) fp the
// share the judge labels good, p_e = (1 − π)(1 − q) + π q. The shaded bands
// are 95% Wilson intervals for each error rate, estimated from the expected
// number of human-bad (false pass) or human-good (false fail) cases at that π.
// The error rates are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const Z = 1.96;
const PI_MIN = 0.5, PI_MAX = 0.99;

type P = { good: number; falsePass: number; falseFail: number; n: number };

function wilson(x: number, n: number): [number, number] {
  if (n <= 0) return [0, 1];
  const q = x / n, z2 = Z * Z;
  const c = (q + z2 / (2 * n)) / (1 + z2 / n);
  const h = (Z / (1 + z2 / n)) * Math.sqrt((q * (1 - q)) / n + z2 / (4 * n * n));
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

function model(p: P) {
  const n = p.n;
  const bad = Math.round(n * (1 - p.good));
  const goodN = n - bad;
  const n01 = Math.round(bad * p.falsePass), n00 = bad - n01;
  const n10 = Math.round(goodN * p.falseFail), n11 = goodN - n10;
  const col0 = n00 + n10, col1 = n01 + n11;
  const po = (n00 + n11) / n;
  const pe = (bad * col0 + goodN * col1) / (n * n);
  const defined = pe < 1 - 1e-12;
  const kappa = defined ? (po - pe) / (1 - pe) : NaN;
  const fp = bad ? n01 / bad : NaN, ff = goodN ? n10 / goodN : NaN;
  return { n, bad, goodN, n00, n01, n10, n11, col0, col1, po, pe, kappa, defined, fp, ff, fpCI: wilson(n01, bad), ffCI: wilson(n10, goodN) };
}
type M = ReturnType<typeof model>;

// Expected-count curves as functions of the good share π.
function expected(pi: number, fp: number, ff: number) {
  const po = pi * (1 - ff) + (1 - pi) * (1 - fp);
  const q = pi * (1 - ff) + (1 - pi) * fp;
  const pe = (1 - pi) * (1 - q) + pi * q;
  return { po, pe, kappa: pe < 1 - 1e-12 ? (po - pe) / (1 - pe) : NaN };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Qualifying a judge against human labels",
    table: "{n} qualification cases, {g} labeled good by humans",
    human: "Human label",
    judge: "Judge label",
    bad: "bad (0)",
    good: "good (1)",
    total: "total",
    agree: "agree",
    fpass: "false pass",
    ffail: "false fail",
    chart: "Judge error rates fixed, share of good cases varied",
    xTitle: "share of cases humans label good (%)",
    po: "raw agreement p_o",
    kappa: "κ",
    fpLine: "false-pass rate",
    ffLine: "false-fail rate",
    band: "shaded: 95% Wilson interval with {n} cases in total",
    terms: "From the table",
    fPo: "p_o = (n₀₀ + n₁₁) / n",
    vPo: "({a} + {b}) / {n} = {v}",
    fPe: "p_e = (n₀· n·₀ + n₁· n·₁) / n²",
    vPe: "({a} · {b} + {c} · {d}) / {n}² = {v}",
    fK: "κ = (p_o − p_e) / (1 − p_e)",
    vK: "({po} − {pe}) / {den} = {v}",
    fFp: "false pass = n₀₁ / n₀·",
    fFf: "false fail = n₁₀ / n₁·",
    vRate: "{x} / {k} = {v}, 95% interval {lo} to {hi}",
    noCases: "no cases with this human label",
    undefined: "undefined",
    describe: "{n} cases, {g} labeled good by humans; the judge passes {fp} of the bad cases and fails {ff} of the good ones. Raw agreement {po}, κ {k}. The false-pass rate rests on {b:bad case/bad cases}, 95% interval {lo} to {hi}.",
  },
  zh: {
    title: "用人工标签验证模型裁判",
    table: "{n} 个验证用例，人工把其中 {g} 标为好",
    human: "人工标签",
    judge: "裁判标签",
    bad: "不好（0）",
    good: "好（1）",
    total: "合计",
    agree: "一致",
    fpass: "假通过",
    ffail: "假不通过",
    chart: "裁判错误率不变，好用例的比例变化",
    xTitle: "人工标为好的用例比例（%）",
    po: "原始一致率 p_o",
    kappa: "κ",
    fpLine: "假通过率",
    ffLine: "假不通过率",
    band: "阴影：共 {n} 个用例时的 95% Wilson 区间",
    terms: "由表中计数得到",
    fPo: "p_o = (n₀₀ + n₁₁) / n",
    vPo: "({a} + {b}) / {n} = {v}",
    fPe: "p_e = (n₀· n·₀ + n₁· n·₁) / n²",
    vPe: "({a} · {b} + {c} · {d}) / {n}² = {v}",
    fK: "κ = (p_o − p_e) / (1 − p_e)",
    vK: "({po} − {pe}) / {den} = {v}",
    fFp: "假通过率 = n₀₁ / n₀·",
    fFf: "假不通过率 = n₁₀ / n₁·",
    vRate: "{x} / {k} = {v}，95% 区间 {lo} 到 {hi}",
    noCases: "没有这种人工标签的用例",
    undefined: "没有定义",
    describe: "{n} 个用例，人工把其中 {g} 标为好；裁判把 {fp} 的不好用例判为通过，把 {ff} 的好用例判为不通过。原始一致率 {po}，κ 为 {k}。假通过率只基于 {b} 个不好用例，95% 区间为 {lo} 到 {hi}。",
  },
};
type L = typeof labels.en;

const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const f2 = (v: number) => fixed(v, 2);
const f3 = (v: number) => fixed(v, 3);

// ---------------------------------------------------------------- render

function renderTable(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(Lx.table, { n: int(m.n), g: pct(m.goodN / m.n) }), TYPE.label, w - 12, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 12;
  const rowW = Math.max(...[Lx.human, Lx.bad, Lx.good, Lx.total].map((s) => textWidth(s, TYPE.body))) + 12;
  const totW = Math.max(textWidth(Lx.total, TYPE.body), textWidth(int(m.n), TYPE.body)) + 8;
  const cw = Math.min(116, Math.floor((w - rowW - totW - 10) / 2));
  const ch = 50;
  const cx = [x0 + rowW, x0 + rowW + cw + 4];
  const tx = cx[1] + cw + 6 + totW;
  parts.push(text(cx[0] + cw + 2, y + 12, Lx.judge, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  parts.push(el("line", { x1: cx[0], x2: cx[1] + cw, y1: y + 18, y2: y + 18, stroke: C.rule, "stroke-width": 1 }));
  y += 22;
  parts.push(text(x0, y + 13, Lx.human, { "font-size": TYPE.body, class: "fig-t-strong" }));
  parts.push(text(cx[0] + cw / 2, y + 13, Lx.bad, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(cx[1] + cw / 2, y + 13, Lx.good, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(tx, y + 13, Lx.total, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 20;
  // Cell tints match the chart: agreement in the p_o color, the two error
  // cells in the colors of their rate lines.
  const cells: Array<[string, number, string, string]> = [
    ["n₀₀", m.n00, Lx.agree, C.c1], ["n₀₁", m.n01, Lx.fpass, C.c3],
    ["n₁₀", m.n10, Lx.ffail, C.c4], ["n₁₁", m.n11, Lx.agree, C.c1],
  ];
  for (let r = 0; r < 2; r++) {
    const ry = y + r * (ch + 4);
    parts.push(text(x0, ry + ch / 2 + 4, r === 0 ? Lx.bad : Lx.good, { "font-size": TYPE.body, class: "fig-t-muted" }));
    for (let c = 0; c < 2; c++) {
      const [name, n, tag, color] = cells[r * 2 + c];
      parts.push(el("rect", { x: cx[c], y: ry, width: cw, height: ch, rx: 4, fill: color, "fill-opacity": 0.16, stroke: color, "stroke-width": 1 }));
      parts.push(text(cx[c] + 7, ry + 20, `${name} ${int(n)}`, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
      parts.push(text(cx[c] + 7, ry + 39, tag, { "font-size": TYPE.body, class: "fig-t-muted" }));
    }
    parts.push(text(tx, ry + ch / 2 + 4, int(r === 0 ? m.bad : m.goodN), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  }
  y += 2 * (ch + 4) + 16;
  parts.push(text(x0, y, Lx.total, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(cx[0] + cw / 2, y, int(m.col0), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(text(cx[1] + cw / 2, y, int(m.col1), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(text(tx, y, int(m.n), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 + 6 };
}

function renderChart(m: M, p: P, x0: number, y0: number, w: number, narrow: boolean, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const fs = narrow ? TYPE.body : TYPE.small;
  let y = y0;
  for (const ln of lines(Lx.chart, TYPE.label, w - 12, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 14;
  const left = x0 + 36, right = x0 + w - 10;
  const top = y, ph = narrow ? 190 : 200, bottom = top + ph;
  const xs = linear([PI_MIN, 1], [left, right]);
  const ys = linear([0, 1], [bottom, top]);
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, right], format: (v) => (v === 0 || v === 1 ? String(v) : f2(v)), size: fs }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1], format: (v) => String(Math.round(v * 100)), title: Lx.xTitle, size: fs }));

  const steps = 98;
  const grid = Array.from({ length: steps + 1 }, (_, k) => PI_MIN + ((PI_MAX - PI_MIN) * k) / steps);
  // Wilson bands for the two error rates at the expected class counts.
  const band = (rate: number, count: (pi: number) => number, color: string, opacity: number) => {
    const upper: Array<[number, number]> = [], lower: Array<[number, number]> = [];
    for (const pi of grid) {
      const k = count(pi);
      const [lo, hi] = wilson(rate * k, k);
      upper.push([xs(pi), ys(hi)]);
      lower.push([xs(pi), ys(lo)]);
    }
    parts.push(el("path", { d: linePath([...upper, ...lower.reverse()]) + "Z", fill: color, "fill-opacity": opacity, stroke: "none" }));
  };
  band(p.falseFail, (pi) => p.n * pi, C.c4, 0.22);
  band(p.falsePass, (pi) => p.n * (1 - pi), C.c3, 0.18);
  const curve = (f: (pi: number) => number, color: string, dash?: string) => {
    const pts = grid.map((pi) => [pi, f(pi)] as const).filter(([, v]) => Number.isFinite(v)).map(([pi, v]) => [xs(pi), ys(Math.max(0, Math.min(1, v)))] as [number, number]);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: color, "stroke-width": 2, "stroke-dasharray": dash, "stroke-linejoin": "round" }));
  };
  curve(() => p.falseFail, C.c4);
  curve(() => p.falsePass, C.c3);
  curve((pi) => expected(pi, p.falsePass, p.falseFail).po, C.c1);
  curve((pi) => expected(pi, p.falsePass, p.falseFail).kappa, C.c2);

  // The current share, with the table's values on it.
  const cx = xs(Math.min(PI_MAX, Math.max(PI_MIN, p.good)));
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const dots: Array<[number, string]> = [[m.po, C.c1], [m.fp, C.c3], [m.ff, C.c4]];
  if (m.defined) dots.push([m.kappa, C.c2]);
  for (const [v, color] of dots) if (Number.isFinite(v)) parts.push(el("circle", { cx, cy: ys(Math.max(0, Math.min(1, v))), r: 4.5, fill: color, stroke: C.paper, "stroke-width": 1.5 }));

  y = bottom + axisHeight(true, fs) + 6;
  const lg = legend([
    { label: `${Lx.po} ${f2(m.po)}`, swatch: { kind: "line", stroke: C.c1 } },
    { label: `${Lx.kappa} ${m.defined ? f2(m.kappa) : Lx.undefined}`, swatch: { kind: "line", stroke: C.c2 } },
    { label: `${Lx.fpLine} ${Number.isFinite(m.fp) ? f2(m.fp) : "–"}`, swatch: { kind: "line", stroke: C.c3 } },
    { label: `${Lx.ffLine} ${Number.isFinite(m.ff) ? f2(m.ff) : "–"}`, swatch: { kind: "line", stroke: C.c4 } },
  ], x0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height + 4;
  for (const ln of lines(tpl(Lx.band, { n: int(p.n) }), fs, w, lang)) { y += fs + 4; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 + 4 };
}

function renderReadout(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.terms, TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const rate = (x: number, k: number, ci: [number, number]) => (k ? tpl(Lx.vRate, { x: int(x), k: int(k), v: f2(x / k), lo: f2(ci[0]), hi: f2(ci[1]) }) : Lx.noCases);
  const rows: Array<[string, string, boolean]> = [
    [Lx.fPo, tpl(Lx.vPo, { a: int(m.n00), b: int(m.n11), n: int(m.n), v: f3(m.po) }), false],
    [Lx.fPe, tpl(Lx.vPe, { a: int(m.bad), b: int(m.col0), c: int(m.goodN), d: int(m.col1), n: int(m.n), v: f3(m.pe) }), false],
    [Lx.fK, m.defined ? tpl(Lx.vK, { po: f3(m.po), pe: f3(m.pe), den: f3(1 - m.pe), v: f3(m.kappa) }) : Lx.undefined, true],
    [Lx.fFp, rate(m.n01, m.bad, m.fpCI), true],
    [Lx.fFf, rate(m.n10, m.goodN, m.ffCI), false],
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
  return tpl(Lx.describe, {
    n: int(m.n), g: pct(m.goodN / m.n), fp: pct(st.p.falsePass), ff: pct(st.p.falseFail),
    po: f2(m.po), k: m.defined ? f2(m.kappa) : Lx.undefined, b: m.bad, lo: f2(m.fpCI[0]), hi: f2(m.fpCI[1]),
  });
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
    const ch = renderChart(m, st.p, 0, y, w, true, Lx, lang);
    parts.push(ch.svg); y += ch.h + 14;
  } else {
    const gap = 26;
    const tw = Math.floor((w - gap) * 0.47);
    const tb = renderTable(m, 0, y, tw, Lx, lang);
    const ch = renderChart(m, st.p, tw + gap, y, w - tw - gap, false, Lx, lang);
    parts.push(tb.svg, ch.svg);
    y += Math.max(tb.h, ch.h) + 14;
  }
  const ro = renderReadout(m, 0, y, w, Lx, lang);
  parts.push(ro.svg); y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "judge-qualification",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    good: {
      kind: "range", label: { en: "Share of cases humans label good", zh: "人工标为好的比例" }, min: PI_MIN, max: PI_MAX, step: 0.01, default: 0.9,
      marks: [{ value: 0.9, label: { en: "example", zh: "示例" } }],
    },
    falsePass: { kind: "range", label: { en: "Judge passes this share of bad cases", zh: "裁判把不好用例判为通过的比例" }, min: 0, max: 0.5, step: 0.01, default: 0.2 },
    falseFail: { kind: "range", label: { en: "Judge fails this share of good cases", zh: "裁判把好用例判为不通过的比例" }, min: 0, max: 0.5, step: 0.01, default: 0.1 },
    n: {
      kind: "choice", label: { en: "Qualification cases", zh: "验证用例数" }, default: 200,
      options: [
        { value: 200, label: { en: "200", zh: "200" } },
        { value: 1000, label: { en: "1,000", zh: "1,000" } },
        { value: 5000, label: { en: "5,000", zh: "5,000" } },
      ],
    },
  },
  render,
  describe,
});
