// The review backlog of one claim class as a queue over intervals, driven by
// the verification-frontier chapter's accounting identity
//
//   B_{t+1} = max{0, B_t + G_t − R_t},
//
// where B_t is the number of claims pending at the start of interval t, G_t
// the claims that arrive during it, and R_t the review decisions completed in
// it. Reviewers can complete up to K_t decisions per interval and take the
// oldest pending claims first, so R_t = min(K_t, B_t + G_t) and the max never
// binds. Each pending claim keeps its arrival interval, which gives the age
// distribution of the backlog and the time to decision the chapter asks a
// generator benchmark to report.
//
// With fixed arrivals and capacity the figure replays the chapter's runnable
// example exactly: G = 40 and K = 20 leave B_12 = 240 after 12 intervals, and
// K = 45 leaves 0. The random setting draws G_t ~ Poisson(λ) and K_t ~
// Poisson(K) from a seeded stream by inverse CDF, one uniform per draw, so the
// same seed gives the same trace and moving a slider moves the trace smoothly.
//
// Tracking off models the failure the chapter calls implicit acceptance: a
// claim still pending after D intervals leaves the queue as if accepted,
// without a decision. The visible backlog then stays short while the claims
// that passed accumulate; they are drawn stacked on top, so the column height
// still shows the work that arrived and was never decided.
//
// All numbers are illustrative; the chapter's example predicts nothing about
// any laboratory or product team.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

export const INTERVALS = 24;
const HORIZON = 12; // the runnable example's horizon

type Variability = "fixed" | "poisson";
type P = { arrivals: number; capacity: number; variability: Variability; tracked: boolean; deadline: number; seed: number };

interface Cohort { a: number; n: number } // arrival interval, claims still pending
interface Step {
  B: number; // pending at the start of the interval
  G: number;
  K: number;
  R: number; // decisions completed
  passed: number; // left without a decision this interval (tracking off)
  next: number; // pending at the end: B_{t+1}
  passedCum: number;
  decidedCum: number;
  ages: number[]; // pending at the end, by age bucket
  oldest: number; // intervals the oldest pending claim has waited, 0 if none
  wait: number; // mean intervals waited by the claims decided this interval
}

// Age buckets by intervals pending (the current interval counts as one).
const BUCKETS: Array<[number, number]> = [[1, 1], [2, 3], [4, 6], [7, Infinity]];
const bucketOf = (w: number) => BUCKETS.findIndex(([lo, hi]) => w >= lo && w <= hi);

// Smallest k with Poisson CDF(k; λ) >= u.
function poissonInv(u: number, lambda: number): number {
  let p = Math.exp(-lambda), cdf = p, k = 0;
  while (cdf < u && k < 1000) { k++; p *= lambda / k; cdf += p; }
  return k;
}

function simulate(p: P, tracked: boolean): Step[] {
  const uG = rng(p.seed * 2 + 1), uK = rng(p.seed * 2 + 2);
  const queue: Cohort[] = [];
  const steps: Step[] = [];
  let passedCum = 0, decidedCum = 0;
  for (let t = 0; t < INTERVALS; t++) {
    const G = p.variability === "fixed" ? p.arrivals : poissonInv(uG(), p.arrivals);
    const K = p.variability === "fixed" ? p.capacity : poissonInv(uK(), p.capacity);
    const B = queue.reduce((s, c) => s + c.n, 0);
    if (G > 0) queue.push({ a: t, n: G });
    // Reviewers decide the oldest claims first.
    let left = K, R = 0, waited = 0;
    while (left > 0 && queue.length) {
      const c = queue[0];
      const k = Math.min(left, c.n);
      c.n -= k; left -= k; R += k; waited += k * (t - c.a + 1);
      if (c.n === 0) queue.shift();
    }
    // Without tracking, a claim pending for the deadline passes undecided.
    let passed = 0;
    if (!tracked) {
      while (queue.length && t - queue[0].a + 1 >= p.deadline) passed += queue.shift()!.n;
    }
    passedCum += passed; decidedCum += R;
    const ages = BUCKETS.map(() => 0);
    for (const c of queue) ages[bucketOf(t - c.a + 1)] += c.n;
    const next = queue.reduce((s, c) => s + c.n, 0);
    steps.push({ B, G, K, R, passed, next, passedCum, decidedCum, ages, oldest: queue.length ? t - queue[0].a + 1 : 0, wait: R ? waited / R : 0 });
  }
  return steps;
}

const memo = new Map<string, { run: Step[]; ymax: number }>();
function runs(p: P) {
  const key = `${p.arrivals}|${p.capacity}|${p.variability}|${p.tracked}|${p.deadline}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const run = simulate(p, p.tracked);
    const other = simulate(p, !p.tracked);
    // One vertical scale for both tracking settings, so the toggle does not rescale.
    const ymax = Math.max(10, ...[...run, ...other].map((s) => s.next + s.passedCum));
    hit = { run, ymax };
    if (memo.size > 64) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- labels

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const sub = (n: number) => String(n).split("").map((c) => SUB[c]).join("");

const labels = {
  en: {
    title: "Review backlog of one claim class over intervals",
    chart: "Claims pending review at the end of each interval",
    y: "claims",
    x: "interval t",
    age1: "pending 1 interval",
    age2: "2 to 3",
    age3: "4 to 6",
    age4: "7 or more",
    passed: "passed without a decision (running total)",
    cursor: "t = {t}",
    eqTitle: "Interval t = {t}",
    eqNote: "pending at the start + new claims − decisions = pending at the end",
    eqNoteUntracked: "pending at the start + new claims − decisions − passed undecided = pending at the end",
    ageTitle: "Age of the claims still pending",
    oldest: "Oldest pending claim: {n:interval/intervals}",
    none: "No claim is pending",
    wait: "Claims decided in this interval waited {n} intervals on average",
    noWait: "No claim was decided in this interval",
    totals: "Decided so far: {d}. Passed without a decision: {p}.",
    kfHorizon: "After {h} intervals the backlog B{s} is {b}",
    kfStart: "Interval {t}: decisions fall {d} short of new claims",
    kfOld: "Interval {t}: the oldest pending claim has waited {n} intervals",
    kfPass: "Interval {t}: {n} claims pass without a decision",
    kfEnd: "After {h} intervals: {b} pending, {p} passed without a decision",
    describe: "Interval {t}: {b} claims were pending, {g} arrived, and {r} were decided, leaving {n} pending; the oldest has waited {o} intervals.",
    describePassed: " {p} claims have passed without a decision.",
  },
  zh: {
    title: "一个主张类别的待审积压随区间变化",
    chart: "每个区间结束时待审的主张",
    y: "主张数",
    x: "区间 t",
    age1: "已待审 1 个区间",
    age2: "2 至 3 个",
    age3: "4 至 6 个",
    age4: "7 个及以上",
    passed: "未经决定即放行（累计）",
    cursor: "t = {t}",
    eqTitle: "区间 t = {t}",
    eqNote: "期初待审 + 新主张 − 已完成决定 = 期末待审",
    eqNoteUntracked: "期初待审 + 新主张 − 已完成决定 − 未经决定放行 = 期末待审",
    ageTitle: "仍在待审的主张已等待多久",
    oldest: "等待最久的主张：{n} 个区间",
    none: "没有待审的主张",
    wait: "本区间作出决定的主张平均等待了 {n} 个区间",
    noWait: "本区间没有作出任何决定",
    totals: "累计已决定 {d} 项，未经决定放行 {p} 项。",
    kfHorizon: "{h} 个区间之后，积压 B{s} 为 {b}",
    kfStart: "区间 {t}：已完成决定比新主张少 {d} 项",
    kfOld: "区间 {t}：等待最久的主张已等了 {n} 个区间",
    kfPass: "区间 {t}：{n} 项主张未经决定即被放行",
    kfEnd: "{h} 个区间之后：待审 {b} 项，未经决定放行 {p} 项",
    describe: "区间 {t}：期初待审 {b} 项，新到 {g} 项，完成决定 {r} 项，期末待审 {n} 项；等待最久的主张已等了 {o} 个区间。",
    describePassed: "累计已有 {p} 项主张未经决定即被放行。",
  },
};
type L = typeof labels.en;

const AGE_OPACITY = [0.4, 0.6, 0.8, 1];

function keyframes(p: P, lang: Lang) {
  const L = labels[lang];
  const run = runs(p).run;
  const out: Array<{ t: number; label: string }> = [];
  const start = run.findIndex((s) => s.next > 0);
  if (start >= 0 && start < HORIZON - 1) out.push({ t: start, label: tpl(L.kfStart, { t: start, d: run[start].next - run[start].B }) });
  const old = run.findIndex((s) => s.oldest >= 4);
  if (old >= 0 && old !== HORIZON - 1) out.push({ t: old, label: tpl(L.kfOld, { t: old, n: run[old].oldest }) });
  const pass = run.findIndex((s) => s.passed > 0);
  if (pass >= 0 && pass !== HORIZON - 1) out.push({ t: pass, label: tpl(L.kfPass, { t: pass, n: run[pass].passed }) });
  out.push({ t: HORIZON - 1, label: tpl(L.kfHorizon, { h: HORIZON, s: sub(HORIZON), b: run[HORIZON - 1].next }) });
  const last = run[INTERVALS - 1];
  out.push({ t: INTERVALS - 1, label: tpl(L.kfEnd, { h: INTERVALS, b: last.next, p: last.passedCum }) });
  return out.sort((a, b) => a.t - b.t);
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const t = Math.max(0, Math.min(INTERVALS - 1, Math.round(st.t)));
  const s = runs(st.p).run[t];
  let out = tpl(L.describe, { t, b: s.B, g: s.G, r: s.R, n: s.next, o: s.oldest });
  if (!st.p.tracked) out += tpl(L.describePassed, { p: s.passedCum });
  return out;
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const t = Math.max(0, Math.min(INTERVALS - 1, Math.round(st.t)));
  const { run, ymax } = runs(p);
  const s = run[t];
  const passId = `${st.uid}-pass`;
  const parts: string[] = [el("defs", {}, hatch(passId, C.bad, 5, 1.4))];

  // ---- chart
  parts.push(text(0, 14, L.chart, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const items: LegendItem[] = [L.age1, L.age2, L.age3, L.age4].map((label, b) => ({ label, swatch: { kind: "rect", fill: C.c1, opacity: AGE_OPACITY[b] } }));
  if (!p.tracked) items.push({ label: L.passed, swatch: { kind: "rect", fill: C.bad, stroke: C.bad, pattern: passId } });
  const lg = legend(items, 0, 22, w, size);
  parts.push(lg.svg);
  const left = narrow ? 34 : 40;
  const top = 22 + lg.height + 22;
  const plotH = narrow ? 170 : 190;
  const y = linear([0, ymax * 1.06], [top + plotH, top]);
  const xb = band(INTERVALS, [left, w - 2], narrow ? 2 : 3);
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - 2], title: L.y, size }));
  const xt = linear([0, INTERVALS - 1], [left + xb.size / 2, left + xb.at(INTERVALS - 1) - left + xb.size / 2]);
  const ticks = narrow ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23];
  parts.push(axis({ scale: xt, orient: "bottom", at: top + plotH, ticks, title: L.x, size, format: (v) => String(v) }));
  for (let k = 0; k <= t; k++) {
    const r = run[k];
    const x = xb.at(k);
    let acc = 0;
    for (let b = 0; b < BUCKETS.length; b++) {
      const n = r.ages[b];
      if (!n) continue;
      parts.push(el("rect", { x, y: y(acc + n), width: xb.size, height: y(acc) - y(acc + n), fill: C.c1, "fill-opacity": AGE_OPACITY[b] }));
      acc += n;
    }
    if (r.passedCum > 0) {
      parts.push(el("rect", { x, y: y(acc + r.passedCum), width: xb.size, height: y(acc) - y(acc + r.passedCum), fill: `url(#${passId})`, stroke: C.bad, "stroke-width": 0.8 }));
    }
  }
  // Cursor over the current interval.
  const cx = xb.at(t) + xb.size / 2;
  parts.push(el("rect", { x: xb.at(t) - 1.5, y: top - 2, width: xb.size + 3, height: plotH + 2, fill: "none", stroke: C.ink, "stroke-width": 1.2, rx: 2 }));
  const cl = tpl(L.cursor, { t });
  const clw = textWidth(cl, size);
  parts.push(text(Math.min(Math.max(cx, left + clw / 2), w - clw / 2 - 1), top - 7, cl, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  let yy = top + plotH + 12 + size + size * 1.6 + 4 + 22;

  // ---- the identity at this interval, symbols over numbers
  parts.push(text(0, yy, tpl(L.eqTitle, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  yy += 10;
  const cols: Array<[string, string, boolean]> = [
    [`B${sub(t)}`, String(s.B), true], ["+", "+", false], [`G${sub(t)}`, String(s.G), true], ["−", "−", false], [`R${sub(t)}`, String(s.R), true],
  ];
  if (!p.tracked) cols.push(["−", "−", false], [`P${sub(t)}`, String(s.passed), true]);
  cols.push(["=", "=", false], [`B${sub(t + 1)}`, String(s.next), true]);
  const termW = narrow ? 40 : 58, opW = narrow ? 14 : 22;
  let cxEq = 0;
  const eqSize = narrow ? TYPE.body : TYPE.label;
  for (const [sym, num, term] of cols) {
    const cw = term ? termW : opW;
    const mid = cxEq + cw / 2;
    parts.push(text(mid, yy + 16, sym, { "font-size": eqSize, "text-anchor": "middle", class: "fig-t-muted" }));
    parts.push(text(mid, yy + 38, num, { "font-size": eqSize + 2, "text-anchor": "middle", class: term ? "fig-t-strong fig-t-num" : "fig-t-muted" }));
    cxEq += cw;
  }
  yy += 50;
  for (const ln of wrapCjk(p.tracked ? L.eqNote : L.eqNoteUntracked, size, w)) {
    parts.push(text(0, yy + 12, ln, { "font-size": size, class: "fig-t-muted" }));
    yy += size + 5;
  }
  yy += 30;

  // ---- ages of the pending claims, and time to decision
  parts.push(text(0, yy, L.ageTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  yy += 8;
  const nameW = Math.max(...[L.age1, L.age2, L.age3, L.age4].map((n) => textWidth(n, size))) + 10;
  const numW = 40;
  const barW = Math.max(60, w - nameW - numW);
  const amax = Math.max(1, ...run.map((r) => Math.max(...r.ages)));
  [L.age1, L.age2, L.age3, L.age4].forEach((name, b) => {
    parts.push(text(0, yy + 13, name, { "font-size": size }));
    parts.push(el("rect", { x: nameW, y: yy + 3, width: barW, height: 12, rx: 2, fill: C.panel }));
    if (s.ages[b] > 0) parts.push(el("rect", { x: nameW, y: yy + 3, width: Math.max(2, (s.ages[b] / amax) * barW), height: 12, rx: 2, fill: C.c1, "fill-opacity": AGE_OPACITY[b] }));
    parts.push(text(w, yy + 13, String(s.ages[b]), { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
    yy += 19;
  });
  yy += 6;
  const facts = [
    s.oldest ? tpl(L.oldest, { n: s.oldest }) : L.none,
    s.R ? tpl(L.wait, { n: s.wait.toFixed(1) }) : L.noWait,
    tpl(L.totals, { d: s.decidedCum, p: s.passedCum }),
  ];
  for (const f of facts) {
    for (const ln of wrapCjk(f, size, w)) { parts.push(text(0, yy + 12, ln, { "font-size": size, class: "fig-t-num" })); yy += size + 5; }
  }
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "review-backlog",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    arrivals: { kind: "range", label: { en: "New claims G", zh: "新主张 G" }, unit: { en: "per interval", zh: "项/区间" }, min: 5, max: 80, step: 1, default: 40 },
    capacity: {
      kind: "range", label: { en: "Review capacity K", zh: "审查能力 K" }, unit: { en: "decisions per interval", zh: "项决定/区间" }, min: 5, max: 80, step: 1, default: 20,
      marks: [
        { value: 20, label: { en: "fixed", zh: "固定" } },
        { value: 45, label: { en: "scaled", zh: "扩容" } },
      ],
    },
    variability: {
      kind: "choice", label: { en: "Arrivals and reviews", zh: "到达与审查" }, default: "fixed",
      options: [
        { value: "fixed", label: { en: "Fixed, as in the example", zh: "固定，与上例相同" } },
        { value: "poisson", label: { en: "Random (Poisson)", zh: "随机（泊松）" } },
      ],
    },
    tracked: { kind: "toggle", label: { en: "Unresolved claims stay tracked", zh: "未决主张保留在队列中" }, default: true },
    deadline: { kind: "range", label: { en: "Intervals before an undecided claim passes", zh: "未决主张放行前的区间数" }, min: 1, max: 12, step: 1, default: 3, control: false },
    seed: { kind: "range", label: { en: "Seed", zh: "种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  timeline: {
    rate: 3,
    discrete: true,
    duration: () => INTERVALS - 1,
    keyframes: (p, lang) => keyframes(p as P, lang),
    poster: () => HORIZON - 1,
  },
  render,
  describe,
});
