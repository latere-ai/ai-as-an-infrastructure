// Multiwindow, multi-burn-rate alerting on an event SLO, over one day with one
// incident. The operating-contracts chapter's burn rate over a window W is
//
//   β_W = q_W / b,   b = 1 − S*,
//
// with q_W the bad-event fraction in W and S* the objective. The rules are
// the starting configuration the SRE Workbook recommends for a 30-day budget
// (Thurgood, Ewaschuk, Beyer, "Alerting on SLOs", The Site Reliability
// Workbook, O'Reilly 2018, chapter 5, the multiwindow, multi-burn-rate table):
//
//   page    β_1h > 14.4 and β_5m > 14.4    2% of the budget in one hour
//   page    β_6h > 6    and β_30m > 6      5% of the budget in six hours
//   ticket  β_3d > 1    and β_6h > 1       10% of the budget in three days
//
// A rule fires only while both of its windows exceed the threshold, so the
// short window, one twelfth of the long one, clears the alert soon after the
// burn stops. The traffic, background burn, and incident are illustrative.
// Bad events per minute are drawn from a seeded Poisson distribution with the
// minute's expected count (a normal approximation above 50), one fixed
// uniform per minute, so moving a control moves the same draws. The three
// days before the view burn at the background rate, so every window is full
// at hour 0.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { normalQuantile } from "./lib/stats.ts";
import { rng } from "./lib/random.ts";
import { fixed, int, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

const VIEW = 1440; // minutes shown
const START = 240; // incident start, minute
const PRE = 4320; // minutes of background history before the view
const STEP = 5; // minutes per timeline position
const BUDGET_MIN = 30 * 1440; // the SLO window

export interface Rule { key: "fast" | "slow" | "ticket"; long: number; short: number; burn: number; page: boolean }
export const RULES: Rule[] = [
  { key: "fast", long: 60, short: 5, burn: 14.4, page: true },
  { key: "slow", long: 360, short: 30, burn: 6, page: true },
  { key: "ticket", long: 4320, short: 360, burn: 1, page: false },
];
const WINDOWS = [5, 30, 60, 360, 4320];

type P = { slo: number; burn: number; duration: number; background: number; traffic: number; seed: number };

export interface Run {
  b: number;
  burns: Record<number, Float64Array>; // window -> burn rate at the end of each minute of the view
  fire: Record<string, Uint8Array>; // rule -> firing at each minute
  budget: Float64Array; // share of the 30-day budget spent since hour 0
  events: Array<{ t: number; kind: "start" | "end" | "fire" | "clear"; rule?: string }>;
}

const uniMemo = new Map<number, Float64Array>();
function uniforms(seed: number): Float64Array {
  let u = uniMemo.get(seed);
  if (!u) {
    const r = rng(seed);
    u = new Float64Array(PRE + VIEW);
    for (let i = 0; i < PRE + VIEW; i++) u[i] = r();
    uniMemo.set(seed, u);
  }
  return u;
}

// Poisson(λ) by inversion of one uniform, or its normal approximation.
function poisson(lambda: number, u: number): number {
  if (lambda > 50) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normalQuantile(Math.min(1 - 1e-12, Math.max(1e-12, u)))));
  let k = 0, pk = Math.exp(-lambda), cdf = pk;
  while (u > cdf && k < 1000) { k++; pk *= lambda / k; cdf += pk; }
  return k;
}

const memo = new Map<string, Run>();
export function simulate(p: P): Run {
  const key = `${p.slo}|${p.burn}|${p.duration}|${p.background}|${p.traffic}|${p.seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const b = 1 - p.slo / 100;
  const u = uniforms(p.seed);
  const end = START + Math.round(p.duration);
  // Bad events per minute over the history and the view.
  const bad = new Float64Array(PRE + VIEW);
  for (let i = 0; i < PRE + VIEW; i++) {
    const m = i - PRE;
    const rate = m >= START && m < end ? Math.max(p.burn, p.background) : p.background;
    bad[i] = poisson(p.traffic * b * rate, u[i]);
  }
  const cum = new Float64Array(PRE + VIEW + 1);
  for (let i = 0; i < bad.length; i++) cum[i + 1] = cum[i] + bad[i];
  const burns: Record<number, Float64Array> = {};
  for (const W of WINDOWS) {
    const a = new Float64Array(VIEW);
    for (let m = 0; m < VIEW; m++) { const hi = PRE + m + 1; a[m] = (cum[hi] - cum[hi - W]) / (W * p.traffic) / b; }
    burns[W] = a;
  }
  const fire: Record<string, Uint8Array> = {};
  const events: Run["events"] = [{ t: START, kind: "start" }];
  if (end < VIEW) events.push({ t: end, kind: "end" });
  for (const r of RULES) {
    const f = new Uint8Array(VIEW);
    for (let m = 0; m < VIEW; m++) f[m] = burns[r.long][m] > r.burn && burns[r.short][m] > r.burn ? 1 : 0;
    for (let m = 0; m < VIEW; m++) {
      if (f[m] && (m === 0 || !f[m - 1])) events.push({ t: m, kind: "fire", rule: r.key });
      if (!f[m] && m > 0 && f[m - 1]) events.push({ t: m, kind: "clear", rule: r.key });
    }
    fire[r.key] = f;
  }
  events.sort((x, y) => x.t - y.t);
  const budget = new Float64Array(VIEW);
  const total = BUDGET_MIN * p.traffic * b;
  for (let m = 0; m < VIEW; m++) budget[m] = (cum[PRE + m + 1] - cum[PRE]) / total;
  const run = { b, burns, fire, budget, events };
  if (memo.size > 48) memo.clear();
  memo.set(key, run);
  return run;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Multiwindow burn-rate alerts during one incident",
    burnPanel: "Burn rate β_W = q_W / b over each alert window",
    w5: "5 min", w30: "30 min", w60: "1 h", w360: "6 h", w4320: "3 d",
    incident: "incident",
    x: "hour of the day",
    y: "β, log scale",
    alerts: "Alerts: a rule fires while both of its windows exceed its threshold",
    fast: "page: 1 h and 5 min above 14.4",
    slow: "page: 6 h and 30 min above 6",
    ticket: "ticket: 3 d and 6 h above 1",
    fastShort: "the 1 h page", slowShort: "the 6 h page", ticketShort: "the 3 d ticket",
    budget: "30-day error budget spent since hour 0",
    at: "At {time}: β_5m {a}, β_1h {b}, β_30m {c}, β_6h {d}, β_3d {e}; {state}",
    firing: "firing: {list}",
    quiet: "no rule fires",
    q: "Incident: β = {burn} means q = {q} of events are bad against b = {b} for S* = {s}",
    first: "First page at {time}, {m} min after the incident began, with {used} of the budget spent",
    noPage: "No page: the incident never held both windows of a rule above its threshold",
    cleared: "Last page cleared at {time}, {m} min after the incident ended",
    stillOn: "A page is still firing at the end of the day",
    total: "Spent by hour 24: {used} of the 30-day budget",
    describe: "{slo} objective, incident at burn rate {burn} for {dur} min from hour 4. {first} At {time}, {state}, and {used} of the 30-day budget is spent.",
    dFirst: "The first page fires {m} min after it starts.",
    dNone: "No page fires.",
    evStart: "{time}: the incident starts",
    evEnd: "{time}: the incident ends",
    evFire: "{time}: {rule} fires",
    evClear: "{time}: {rule} clears",
  },
  zh: {
    title: "一次事故期间的多窗口燃烧率告警",
    burnPanel: "各告警窗口上的燃烧率 β_W = q_W / b",
    w5: "5 分钟", w30: "30 分钟", w60: "1 小时", w360: "6 小时", w4320: "3 天",
    incident: "事故",
    x: "一天中的小时",
    y: "β，对数刻度",
    alerts: "告警：规则的两个窗口都超过阈值时才触发",
    fast: "呼叫：1 小时与 5 分钟都高于 14.4",
    slow: "呼叫：6 小时与 30 分钟都高于 6",
    ticket: "工单：3 天与 6 小时都高于 1",
    fastShort: "1 小时呼叫", slowShort: "6 小时呼叫", ticketShort: "3 天工单",
    budget: "自第 0 小时起消耗的 30 天错误预算",
    at: "{time}：β_5m {a}，β_1h {b}，β_30m {c}，β_6h {d}，β_3d {e}；{state}",
    firing: "正在触发：{list}",
    quiet: "没有规则触发",
    q: "事故期间 β = {burn}，即 {q} 的事件为坏事件；S* = {s} 时 b = {b}",
    first: "首次呼叫在 {time}，事故开始后 {m} 分钟，此时已消耗 {used} 的预算",
    noPage: "没有呼叫：事故始终没有让任何规则的两个窗口同时超过阈值",
    cleared: "最后一次呼叫在 {time} 解除，事故结束后 {m} 分钟",
    stillOn: "到当天结束时仍有呼叫在触发",
    total: "到第 24 小时共消耗 30 天预算的 {used}",
    describe: "目标为 {slo}，事故从第 4 小时开始，以燃烧率 {burn} 持续 {dur} 分钟。{first}{time} 时{state}，已消耗 30 天预算的 {used}。",
    dFirst: "事故开始 {m} 分钟后首次呼叫。",
    dNone: "没有触发呼叫。",
    evStart: "{time}：事故开始",
    evEnd: "{time}：事故结束",
    evFire: "{time}：{rule}触发",
    evClear: "{time}：{rule}解除",
  },
};

type Lbl = typeof labels.en;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const fb = (v: number) => (v >= 10 ? fixed(v, 1) : v >= 1 ? fixed(v, 2) : sig(v, 2));
const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));
const minuteAt = (t: number) => Math.min(VIEW - 1, Math.max(0, Math.round(t) * STEP - 1));
const ruleName = (k: string, L: Lbl) => (k === "fast" ? L.fastShort : k === "slow" ? L.slowShort : L.ticketShort);

function summary(p: P, r: Run) {
  const end = START + Math.round(p.duration);
  const pages = r.events.filter((e) => e.kind === "fire" && e.rule !== "ticket" && e.t >= START);
  const first = pages[0];
  const pageOn = (m: number) => r.fire.fast[m] || r.fire.slow[m];
  let lastClear = -1;
  for (const e of r.events) if (e.kind === "clear" && e.rule !== "ticket" && !pageOn(e.t)) lastClear = e.t;
  return { end, first, lastClear, stillOn: !!pageOn(VIEW - 1) };
}

function stateText(r: Run, m: number, L: Lbl, lang: Lang): string {
  const on = RULES.filter((q) => r.fire[q.key][m]).map((q) => ruleName(q.key, L));
  return on.length ? tpl(L.firing, { list: on.join(lang === "zh" ? "；" : "; ") }) : L.quiet;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = simulate(p);
  const s = summary(p, r);
  const m = minuteAt(st.t);
  return tpl(L.describe, {
    slo: `${p.slo}%`, burn: sig(p.burn, 3), dur: int(p.duration),
    first: s.first ? tpl(L.dFirst, { m: int(s.first.t - START) }) : L.dNone,
    time: clock(m + 1), state: stateText(r, m, L, lang), used: pct(r.budget[m], 2),
  }).replace(/ {2,}/g, " ");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const r = simulate(p);
  const s = summary(p, r);
  const m = minuteAt(st.t);
  const parts: string[] = [];
  let y = 0;
  const heading = (t: string) => { for (const ln of lines(t, TYPE.label, w - 4, lang)) { parts.push(text(0, y + 14, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 19; } };

  const left = narrow ? 36 : 42, right = w - (narrow ? 38 : 46);
  const x = linear([0, VIEW], [left, right]);
  const xt = [0, 4, 8, 12, 16, 20, 24].filter((h) => !narrow || h % 8 === 0 || h === 4).map((h) => h * 60);
  const incX0 = x(START), incX1 = x(Math.min(VIEW, s.end));

  // ---- burn rates
  heading(L.burnPanel);
  const series = [
    { W: 5, col: C.c1, dash: "3 2", width: 1, label: L.w5 },
    { W: 60, col: C.c1, dash: undefined, width: 2.2, label: L.w60 },
    { W: 30, col: C.c2, dash: "3 2", width: 1, label: L.w30 },
    { W: 360, col: C.c2, dash: undefined, width: 2.2, label: L.w360 },
    { W: 4320, col: C.c3, dash: undefined, width: 2.2, label: L.w4320 },
  ];
  const lg = legend([
    ...series.map((q) => ({ label: q.label, swatch: { kind: "line" as const, stroke: q.col, dash: q.dash } })),
    { label: L.incident, swatch: { kind: "rect" as const, fill: C.panel } },
  ], 0, y + 2, w, size);
  parts.push(lg.svg);
  y += lg.height + 16;
  const top = y, plotH = narrow ? 170 : 190, bottom = top + plotH;
  const yl = log([0.1, 200], [bottom, top]);
  parts.push(el("rect", { x: incX0, y: top, width: Math.max(1, incX1 - incX0), height: plotH, fill: C.panel }));
  parts.push(axis({ scale: yl, orient: "left", at: left, grid: [left, right], ticks: [0.1, 1, 10, 100], format: (v) => sig(v, 2), size }));
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: xt, format: (v) => String(v / 60), size }));
  for (const q of RULES) {
    const col = q.key === "fast" ? C.c1 : q.key === "slow" ? C.c2 : C.c3;
    const yy = yl(q.burn);
    parts.push(el("line", { x1: left, x2: right, y1: yy, y2: yy, stroke: col, "stroke-width": 1, "stroke-dasharray": "1 3" }));
    parts.push(text(right + 4, yy + 4, sig(q.burn, 3), { "font-size": size, class: "fig-t-num" }));
  }
  const upto = m + 1;
  for (const q of series) {
    const a = r.burns[q.W];
    const pts: Array<[number, number]> = [];
    const stride = narrow ? 3 : 2;
    for (let i = 0; i < upto; i += stride) pts.push([x(i + 1), yl(yl.clamp(Math.max(0.1, a[i])))]);
    pts.push([x(upto), yl(yl.clamp(Math.max(0.1, a[upto - 1])))]);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: q.col, "stroke-width": q.width, "stroke-dasharray": q.dash, "stroke-linejoin": "round" }));
  }
  const cx = x(upto);
  const cursorSegs: Array<[number, number]> = [[top, bottom]];
  y = bottom + axisHeight(false, size) + 14;

  // ---- alert rows
  heading(L.alerts);
  y += 2;
  const rowH = 20;
  RULES.forEach((q, i) => {
    // The rule's name above its bar, so the bar keeps the shared time axis.
    const ry = y + i * (rowH + 20);
    parts.push(text(left, ry + 12, L[q.key], { "font-size": size }));
    const by = ry + 18;
    cursorSegs.push([by - 2, by + rowH - 2]);
    const bx0 = left, bx1 = right;
    parts.push(el("rect", { x: bx0, y: by, width: bx1 - bx0, height: rowH - 4, rx: 3, fill: C.panel }));
    const f = r.fire[q.key];
    let i0 = -1;
    for (let k = 0; k <= upto; k++) {
      const on = k < upto && f[k];
      if (on && i0 < 0) i0 = k;
      if (!on && i0 >= 0) { parts.push(el("rect", { x: x(i0), y: by, width: Math.max(1.5, x(k) - x(i0)), height: rowH - 4, rx: 2, fill: q.page ? C.bad : C.warn })); i0 = -1; }
    }
  });
  y += RULES.length * (rowH + 20) + 6;

  // ---- budget
  heading(L.budget);
  y += 8;
  const bTop = y, bH = narrow ? 80 : 90, bBottom = bTop + bH;
  const maxB = Math.max(0.01, r.budget[VIEW - 1]) * 1.1;
  const yb = linear([0, maxB], [bBottom, bTop]);
  parts.push(el("rect", { x: incX0, y: bTop, width: Math.max(1, incX1 - incX0), height: bH, fill: C.panel }));
  parts.push(axis({ scale: yb, orient: "left", at: left, grid: [left, right], ticks: yb.ticks(3), format: (v) => pct(v, maxB < 0.03 ? 1 : 0), size }));
  parts.push(axis({ scale: x, orient: "bottom", at: bBottom, ticks: xt, title: L.x, format: (v) => String(v / 60), size }));
  const bp: Array<[number, number]> = [[x(0), yb(0)]];
  for (let i = 0; i < upto; i += 3) bp.push([x(i + 1), yb(r.budget[i])]);
  bp.push([x(upto), yb(r.budget[upto - 1])]);
  parts.push(el("path", { d: linePath(bp), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  if (s.first && s.first.t < upto) {
    const fx = x(s.first.t + 1), fy = yb(r.budget[s.first.t]);
    parts.push(el("circle", { cx: fx, cy: fy, r: 4.5, fill: C.bad, stroke: C.paper, "stroke-width": 1.5 }));
  }
  const by2 = bBottom + axisHeight(true, size);
  // Cursor through all three panels.
  cursorSegs.push([bTop, bBottom]);
  for (const [y1, y2] of cursorSegs) parts.push(el("line", { x1: cx, x2: cx, y1, y2, stroke: C.ink, "stroke-width": 1.2, opacity: 0.7 }));
  y = by2 + 14;

  // ---- readout
  const a = (W: number) => fb(r.burns[W][m]);
  const rows = [
    tpl(L.at, { time: clock(m + 1), a: a(5), b: a(60), c: a(30), d: a(360), e: a(4320), state: stateText(r, m, L, lang) }),
    tpl(L.q, { burn: sig(p.burn, 3), q: pct(p.burn * r.b, p.burn * r.b < 0.01 ? 2 : 1), b: pct(r.b, r.b < 0.01 ? 2 : 0), s: `${p.slo}%` }),
    s.first ? tpl(L.first, { time: clock(s.first.t + 1), m: int(s.first.t - START), used: pct(r.budget[s.first.t], 2) }) : L.noPage,
  ];
  if (s.first) rows.push(s.stillOn ? L.stillOn : s.lastClear >= 0 ? tpl(L.cleared, { time: clock(s.lastClear), m: int(Math.max(0, s.lastClear - s.end)) }) : L.stillOn);
  rows.push(tpl(L.total, { used: pct(r.budget[VIEW - 1], 2) }));
  rows.forEach((row, i) => {
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    // Bold text runs wider than the measured regular width, so the first row wraps earlier.
    for (const ln of lines(row, size, w - (i === 0 ? 24 : 4), lang)) { parts.push(text(0, y + 15, ln, { "font-size": size, class: i === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" })); y += 16; }
    y += 6;
  });
  return svg(w, y + 4, describe(st, lang), g({ class: "fig-burn" }, ...parts));
}

export default defineFigure({
  name: "burn-rate-alerts",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    slo: {
      kind: "choice", label: { en: "Objective S*", zh: "目标 S*" }, default: 99.9,
      options: [
        { value: 99, label: { en: "99%", zh: "99%" } },
        { value: 99.9, label: { en: "99.9%", zh: "99.9%" } },
        { value: 99.99, label: { en: "99.99%", zh: "99.99%" } },
      ],
    },
    burn: {
      kind: "range", scale: "log", label: { en: "Incident burn rate β", zh: "事故期间的燃烧率 β" }, min: 1, max: 200, default: 20,
      marks: [{ value: 14.4, label: { en: "14.4", zh: "14.4" } }, { value: 6, label: { en: "6", zh: "6" } }],
    },
    duration: { kind: "range", scale: "log", label: { en: "Incident duration", zh: "事故持续时间" }, unit: { en: "min", zh: "分钟" }, min: 5, max: 1200, default: 90 },
    background: { kind: "range", label: { en: "Background burn rate", zh: "平时的燃烧率" }, min: 0, max: 2, step: 0.05, default: 0.3 },
    traffic: { kind: "range", scale: "log", label: { en: "Traffic", zh: "流量" }, unit: { en: "events per minute", zh: "个事件/分钟" }, min: 1, max: 100000, default: 20000 },
    seed: { kind: "range", label: { en: "Seed", zh: "随机种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  timeline: {
    rate: 24,
    discrete: true,
    duration: () => VIEW / STEP,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const r = simulate(p);
      return r.events.filter((e) => e.t > 0).map((e) => {
        const time = clock(e.t);
        const label = e.kind === "start" ? tpl(L.evStart, { time }) : e.kind === "end" ? tpl(L.evEnd, { time })
          : tpl(e.kind === "fire" ? L.evFire : L.evClear, { time, rule: ruleName(e.rule!, L) });
        return { t: Math.min(VIEW / STEP, Math.ceil((e.t + 1) / STEP)), label };
      });
    },
    // The whole day: every window's path, every alert interval, and the budget.
    poster: () => VIEW / STEP,
  },
  render,
  describe,
});
