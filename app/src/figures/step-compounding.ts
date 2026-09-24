// Task success when a task needs n steps to succeed in a row: the reliability
// chapter's idealized model, P(task) = p^n, with p the same per-step success
// probability, a fixed n, independent steps, and no recovery, so any failed
// step ends the task. Half the tasks fail by n½ = ln 0.5 / ln p steps.
//
// The retry curves apply the chapter's attempts_success(p, a) = 1 − (1 − p)^a
// at every step, which holds only when each attempt fails independently. The
// retry table in the same chapter warns that a semantic failure can repeat on
// every attempt, so the figure splits the step failure probability q = 1 − p
// into a systematic share s, which every retry repeats, and a transient share
// 1 − s, which a retry redraws independently:
//
//   step success with a attempts   p_a = 1 − q · (s + (1 − s) · q^(a − 1)),
//   task success                   p_a^n.
//
// s = 0 gives attempts_success; s = 1 gives p, where retrying buys nothing.
// Every value is computed from these formulas; no value is measured.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { textWidth, wrap, placeLabels, drawLabels, lineObstacles, type Box } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { int, sig, tpl } from "./lib/format.ts";

const N_MAX = 1000;

const labels = {
  en: {
    title: "Task success when every required step must succeed",
    plot: "Probability that the task succeeds",
    x: "required steps n (log scale)",
    base: "pⁿ, no retry",
    retry: "{a} attempts per step, share s systematic",
    indep: "{a} attempts per step, all failures transient",
    half: "n½ = {v}",
    atN: "n = {n}",
    rBase: "no retry",
    rRetry: "retry, s = {s}",
    rIndep: "retry, s = 0",
    colStep: "step success",
    colTask: "task success at n = {n}",
    colHalf: "half fail at",
    steps: "{v} steps",
    beyond: "over {v} steps",
    eqBase: "pⁿ = {p}{n} = {v}",
    eqHalf: "n½ = ln 0.5 / ln p = {v}",
    eqRetry: "{pa} = 1 − q(s + (1 − s){qpow}) = 1 − {q} × ({s} + {s1} × {qa}) = {v}",
    noRetry: "One attempt per step: every failed step ends the task.",
    describe: "At per-step success p = {p}, a task of {n} required steps succeeds with probability {v}, and half of all tasks fail by {h} steps. {retry}",
    dRetry: "With {a} attempts per step and a systematic share of {s}, step success rises to {pa} and task success to {va}; with only transient failures it would be {vi}.",
    dNone: "With one attempt per step there is no retry.",
  },
  zh: {
    title: "每个必要步骤都必须成功时的任务成功率",
    plot: "任务成功的概率",
    x: "所需步数 n（对数刻度）",
    base: "pⁿ，不重试",
    retry: "每步尝试 {a} 次，系统性故障占比 s",
    indep: "每步尝试 {a} 次，故障全为暂时性",
    half: "n½ = {v}",
    atN: "n = {n}",
    rBase: "不重试",
    rRetry: "重试，s = {s}",
    rIndep: "重试，s = 0",
    colStep: "单步成功率",
    colTask: "n = {n} 时的任务成功率",
    colHalf: "半数失败所需步数",
    steps: "{v}",
    beyond: "超过 {v}",
    eqBase: "pⁿ = {p}{n} = {v}",
    eqHalf: "n½ = ln 0.5 / ln p = {v}",
    eqRetry: "{pa} = 1 − q(s + (1 − s){qpow}) = 1 − {q} × ({s} + {s1} × {qa}) = {v}",
    noRetry: "每步只尝试一次：任何一步失败都会终止任务。",
    describe: "单步成功率 p = {p} 时，需要 {n} 个步骤的任务成功概率为 {v}，到第 {h} 步时已有一半任务失败。{retry}",
    dRetry: "每步尝试 {a} 次、系统性故障占比为 {s} 时，单步成功率升至 {pa}，任务成功率升至 {va}；若故障全为暂时性，则为 {vi}。",
    dNone: "每步只尝试一次，没有重试。",
  },
};

type P = { p: number; n: number; attempts: number; systematic: number };

function model(p: P) {
  const q = 1 - p.p;
  const a = p.attempts;
  const s = p.systematic;
  const pa = 1 - q * (s + (1 - s) * q ** (a - 1));
  const pi = 1 - q ** a;
  const n = Math.round(p.n);
  const half = (x: number) => (x >= 1 ? Infinity : Math.log(0.5) / Math.log(x));
  return { q, a, s, pa, pi, n, base: p.p ** n, retry: pa ** n, indep: pi ** n, hBase: half(p.p), hRetry: half(pa), hIndep: half(pi) };
}

const f3 = (v: number) => (v > 0.99995 && v < 1 ? "> 0.9999" : v >= 0.9995 && v < 1 ? v.toFixed(4) : v < 0.001 ? sig(v, 2) : v.toFixed(3));
const fStep = (v: number) => {
  // Enough decimals to show how far the step success is from 1.
  if (v >= 1) return "1";
  const d = Math.min(12, Math.max(3, Math.ceil(-Math.log10(1 - v)) + 2));
  return v.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
};
// Superscript and subscript digits, so the readout prints 0.99⁵⁰ and p₂.
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);
const fHalf = (v: number) => (Number.isFinite(v) ? int(v) : "∞");
const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const retry = m.a > 1
    ? tpl(L.dRetry, { a: m.a, s: sig(m.s, 2), pa: fStep(m.pa), va: f3(m.retry), vi: f3(m.indep) })
    : L.dNone;
  return tpl(L.describe, { p: sig(st.p.p, 4), n: m.n, v: f3(m.base), h: fHalf(m.hBase), retry });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const size = TYPE.body;
  const parts: string[] = [];
  let y = 0;
  parts.push(text(0, y + 14, L.plot, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 24;
  const items: LegendItem[] = [{ label: L.base, swatch: { kind: "line", stroke: C.c1 } }];
  if (m.a > 1) {
    items.push({ label: tpl(L.retry, { a: m.a }), swatch: { kind: "line", stroke: C.c2 } });
    if (m.s > 0) items.push({ label: tpl(L.indep, { a: m.a }), swatch: { kind: "line", stroke: C.c3, dash: "5 3" } });
  }
  const lg = legend(items, 0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 16;

  const left = 40, right = w - 12;
  const top = y;
  const plotH = narrow ? 200 : 230;
  const bottom = top + plotH;
  const x = log([1, N_MAX], [left, right]);
  const yy = linear([0, 1], [bottom, top]);
  parts.push(axis({ scale: yy, orient: "left", at: left, grid: [left, right], ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => String(v), size }));
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], minor: true, title: L.x, format: (v) => String(v), size }));
  // The 50 percent line the n½ markers read against.
  parts.push(el("line", { x1: left, x2: right, y1: yy(0.5), y2: yy(0.5), stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));

  const curve = (step: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 160; i++) { const n = 10 ** ((3 * i) / 160); pts.push([x(n), yy(step ** n)]); }
    return pts;
  };
  const obstacles: Box[] = [];
  const series: Array<{ step: number; col: string; dash?: string; v: number; h: number; key: string }> = [{ step: p.p, col: C.c1, v: m.base, h: m.hBase, key: "base" }];
  // With s = 0 the retry curve is the independent-attempt curve, so it is drawn once.
  if (m.a > 1) {
    if (m.s > 0) series.push({ step: m.pi, col: C.c3, dash: "5 3", v: m.indep, h: m.hIndep, key: "indep" });
    series.push({ step: m.pa, col: C.c2, v: m.retry, h: m.hRetry, key: "retry" });
  }
  for (const s of series) {
    const pts = curve(s.step);
    obstacles.push(...lineObstacles(pts));
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: s.col, "stroke-width": s.key === "base" ? 2.5 : 2, "stroke-dasharray": s.dash }));
  }
  // n½ of each curve: a tick on the 50 percent line, labeled when it fits.
  const reqs = [];
  for (const s of series) {
    if (!Number.isFinite(s.h) || s.h > N_MAX) continue;
    const hx = x(s.h), hy = yy(0.5);
    parts.push(el("line", { x1: hx, x2: hx, y1: hy - 5, y2: hy + 5, stroke: s.col, "stroke-width": 2 }));
    if (s.key !== "indep") reqs.push({ x: hx, y: hy, text: tpl(L.half, { v: fHalf(s.h) }), size, sides: ["below-right", "below-left", "above-right", "above-left", "below", "above", "right", "left"] as const, gap: 6, priority: s.key === "base" ? 3 : 2, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  // The chosen n: a vertical guide and a point on each curve.
  const nx = x(Math.max(1, m.n));
  parts.push(el("line", { x1: nx, x2: nx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1 }));
  const nLabel = tpl(L.atN, { n: m.n });
  const nlw = textWidth(nLabel, size);
  const nlx = Math.min(Math.max(nx, left + nlw / 2), right - nlw / 2);
  parts.push(text(nlx, top - 6, nLabel, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  const shown: number[] = [];
  for (const s of series) {
    const cy = yy(s.v);
    // Coinciding curves (s = 1 makes the retry curve the no-retry curve) get one label.
    if (shown.some((v) => Math.abs(v - s.v) < 0.0005)) continue;
    shown.push(s.v);
    parts.push(el("circle", { cx: nx, cy, r: 4.5, fill: s.col, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: nx - 6, y0: cy - 6, x1: nx + 6, y1: cy + 6 });
    reqs.push({ x: nx, y: cy, text: f3(s.v), size, sides: ["right", "left", "above-right", "below-right", "above-left", "below-left"] as const, gap: 8, priority: 4, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  obstacles.push(...lineObstacles([[nx, top], [nx, bottom]]));
  const placed = placeLabels(reqs.map((r) => ({ ...r, sides: [...r.sides] })), { x0: left + 2, y0: top + 2, x1: right - 2, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  y = bottom + axisHeight(true, size) + 16;

  // ---- readout: the three cases as rows, then the equations with the terms filled in
  const rows: Array<{ name: string; step: number; v: number; h: number; col: string; dash?: string }> = [{ name: L.rBase, step: p.p, v: m.base, h: m.hBase, col: C.c1 }];
  if (m.a > 1) {
    rows.push({ name: tpl(L.rRetry, { s: sig(m.s, 2) }), step: m.pa, v: m.retry, h: m.hRetry, col: C.c2 });
    if (m.s > 0) rows.push({ name: L.rIndep, step: m.pi, v: m.indep, h: m.hIndep, col: C.c3, dash: "5 3" });
  }
  const halfText = (h: number) => (h > N_MAX ? tpl(L.beyond, { v: int(N_MAX) }) : tpl(L.steps, { v: fHalf(h) }));
  const nameW = Math.max(...rows.map((r) => textWidth(r.name, size))) + 30;
  if (narrow) {
    // Phone: one block per case, name on its own line and the values under it.
    for (const r of rows) {
      parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
      parts.push(el("line", { x1: 0, x2: 16, y1: y + 11, y2: y + 11, stroke: r.col, "stroke-width": 2.5, "stroke-dasharray": r.dash }));
      parts.push(text(22, y + 15, r.name, { "font-size": size, class: "fig-t-strong" }));
      const colon = lang === "zh" ? "：" : ": ";
      const vals = [`${L.colStep}${colon}${fStep(r.step)}`, `${tpl(L.colTask, { n: m.n })}${colon}${f3(r.v)}`, `${L.colHalf}${colon}${halfText(r.h)}`];
      vals.forEach((v, i) => parts.push(text(22, y + 33 + i * 17, v, { "font-size": size, class: "fig-t-num" })));
      y += 33 + vals.length * 17;
    }
  } else {
    const c1 = nameW + 110, c2 = c1 + 150, c3 = w;
    const head = [L.colStep, tpl(L.colTask, { n: m.n }), L.colHalf];
    [c1, c2, c3].forEach((cx, i) => parts.push(text(cx, y + 14, head[i], { "font-size": size, "text-anchor": "end", class: "fig-t-muted" })));
    y += 22;
    for (const r of rows) {
      parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
      parts.push(el("line", { x1: 0, x2: 16, y1: y + 10, y2: y + 10, stroke: r.col, "stroke-width": 2.5, "stroke-dasharray": r.dash }));
      parts.push(text(22, y + 15, r.name, { "font-size": size }));
      parts.push(text(c1, y + 15, fStep(r.step), { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
      parts.push(text(c2, y + 15, f3(r.v), { "font-size": size, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
      parts.push(text(c3, y + 15, halfText(r.h), { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
      y += 21;
    }
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 8;
  const eqs = [
    tpl(L.eqBase, { p: sig(p.p, 4), n: sup(m.n), v: f3(m.base) }),
    tpl(L.eqHalf, { v: fHalf(m.hBase) }),
    m.a > 1
      ? tpl(L.eqRetry, { pa: `p${SUB[m.a]}`, qpow: m.a === 2 ? "q" : `q${sup(m.a - 1)}`, q: sig(m.q, 3), s: sig(m.s, 2), s1: sig(1 - m.s, 2), qa: sig(m.q ** (m.a - 1), 3), v: fStep(m.pa) })
      : L.noRetry,
  ];
  for (const e of eqs) for (const ln of lines(e, size, w, lang)) { parts.push(text(0, y + 13, ln, { "font-size": size, class: "fig-t-muted fig-t-num" })); y += 17; }
  return svg(w, y + 6, describe(st, lang), g({ class: "fig-steps" }, ...parts));
}

export default defineFigure({
  name: "step-compounding",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    p: {
      kind: "range", label: { en: "Per-step success p", zh: "单步成功率 p" }, min: 0.9, max: 0.999, step: 0.001, default: 0.99,
      marks: [{ value: 0.99, label: { en: "0.99", zh: "0.99" } }],
    },
    n: {
      kind: "range", label: { en: "Required steps n", zh: "所需步数 n" }, min: 1, max: 500, step: 1, default: 50,
      marks: [{ value: 50, label: { en: "50", zh: "50" } }],
    },
    attempts: {
      kind: "choice", label: { en: "Attempts per step a", zh: "每步尝试次数 a" }, default: 2,
      options: [
        { value: 1, label: { en: "1, no retry", zh: "1，不重试" } },
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 3, label: { en: "3", zh: "3" } },
      ],
    },
    systematic: {
      kind: "range", label: { en: "Systematic share of failures s", zh: "系统性故障占比 s" }, min: 0, max: 1, step: 0.05, default: 0.5,
    },
  },
  render,
  describe,
});
