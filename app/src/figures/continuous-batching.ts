// Static batching against iteration-level scheduling on one request trace.
//
// The model is the chapter's accounting example extended with arrivals: time
// advances in model iterations (steps), every iteration costs one step
// whatever it contains, and a running request emits one token per step. A
// request admitted at step s emits its first token at the end of step s (its
// prefill and first sample share that iteration) and its last at the end of
// step s + O - 1. Prefill cost, KV memory, and kernel cost are left out, so
// the only resource is the number of batch slots.
//
// - Static: when the batch is empty, a cohort forms from whatever is waiting
//   (up to the slot count, first come first served) and holds its slots until
//   its longest request finishes. A request that finishes early keeps its
//   slot idle; a request that arrives during a cohort waits for it to end.
// - Iteration-level: after every iteration, finished requests leave and
//   waiting requests take any free slot at the next step (Orca's scheduling;
//   continuous batching).
//
// Metrics follow the chapter's definitions in steps: TTFT_i = t_{i,1} - a_i
// counted inclusively (a request admitted on arrival has TTFT 1), E2E_i ends
// at the last token, and slot utilization is emitted tokens over slots times
// elapsed steps. The "example" workload is the four requests the chapter's
// runnable checks, so the figure reproduces the step counts it asserts (15
// static, 12 iteration-level). Percentiles are nearest-rank.
//
// State is a pure function of the parameters and the step t: both runs are
// simulated once per parameter set (memoized) and render reads step t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng, exponential } from "./lib/random.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { pct, fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

const REQUESTS = 32;
const MEAN_OUT = 16; // mean output length in steps (tokens) of the arrival trace
const MAX_OUT = 96;
const EXAMPLE = [2, 8, 3, 7]; // the chapter's runnable: output lengths, all at step 0

export type Policy = "static" | "iteration";

export interface Req { id: number; arrival: number; out: number }

export interface Run {
  policy: Policy;
  start: number[]; // admission step per request (index = id - 1)
  slot: number[];
  finish: number[]; // step of the last token
  waiting: number[]; // requests waiting after admission, per step
  cohorts: Array<{ t: number; end: number; members: number[]; left: number }>; // static only
  end: number; // last step with work
}

// Standard normal from two uniforms (Box-Muller).
function normal(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

// Poisson arrivals and lognormal output lengths with mean MEAN_OUT and
// coefficient of variation `spread`. Every request draws the same uniforms
// whatever the parameters, so moving a slider changes each request's arrival
// or length smoothly instead of reshuffling the trace.
export function trace(workload: "arrivals" | "example", rate: number, spread: number, seed: number): Req[] {
  if (workload === "example") return EXAMPLE.map((out, i) => ({ id: i + 1, arrival: 0, out }));
  const u = rng(seed);
  const s2 = Math.log(1 + spread * spread);
  const s = Math.sqrt(s2);
  const reqs: Req[] = [];
  let t = 0;
  for (let i = 0; i < REQUESTS; i++) {
    const gap = exponential(u(), 1);
    const z = normal(u(), u());
    if (i > 0) t += gap / rate;
    const out = Math.min(MAX_OUT, Math.max(1, Math.round(MEAN_OUT * Math.exp(s * z - s2 / 2))));
    reqs.push({ id: i + 1, arrival: Math.floor(t), out });
  }
  return reqs;
}

export function simulate(reqs: Req[], policy: Policy, slots: number, horizon = 4000): Run {
  const n = reqs.length;
  const start = new Array<number>(n).fill(-1);
  const slot = new Array<number>(n).fill(-1);
  const finish = new Array<number>(n).fill(-1);
  const waitingAt: number[] = [];
  const cohorts: Run["cohorts"] = [];
  const queue: number[] = [];
  const occupant = new Array<number>(slots).fill(-1);
  let next = 0, done = 0, cohortEnd = -1, t = 0;
  for (t = 0; t < horizon; t++) {
    while (next < n && reqs[next].arrival <= t) queue.push(next++);
    if (policy === "static") {
      if (t > cohortEnd && queue.length) {
        const members = queue.splice(0, Math.min(slots, queue.length));
        let longest = 0;
        members.forEach((i, j) => { start[i] = t; slot[i] = j; finish[i] = t + reqs[i].out - 1; longest = Math.max(longest, reqs[i].out); });
        cohortEnd = t + longest - 1;
        cohorts.push({ t, end: cohortEnd, members, left: queue.length });
      }
    } else {
      for (let j = 0; j < slots; j++) if (occupant[j] >= 0 && finish[occupant[j]] < t) occupant[j] = -1;
      for (let j = 0; j < slots && queue.length; j++) {
        if (occupant[j] >= 0) continue;
        const i = queue.shift()!;
        occupant[j] = i; start[i] = t; slot[i] = j; finish[i] = t + reqs[i].out - 1;
      }
    }
    waitingAt.push(queue.length);
    for (let i = 0; i < n; i++) if (finish[i] === t) done++;
    if (done === n) break;
  }
  return { policy, start, slot, finish, waiting: waitingAt, cohorts, end: t };
}

type Sim = { reqs: Req[]; static: Run; iteration: Run; duration: number };
const memo = new Map<string, Sim>();
export function runs(p: { workload: "arrivals" | "example"; rate: number; spread: number; slots: number; seed: number }): Sim {
  const key = `${p.workload}|${p.rate}|${p.spread}|${p.slots}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const reqs = trace(p.workload, p.rate, p.spread, p.seed);
    const a = simulate(reqs, "static", p.slots);
    const b = simulate(reqs, "iteration", p.slots);
    hit = { reqs, static: a, iteration: b, duration: Math.max(a.end, b.end) };
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// Nearest-rank percentile of values that may be lower bounds (a request
// still waiting counts its wait so far); reports whether the chosen value is one.
function percentile(vals: Array<{ v: number; open: boolean }>, q: number): { v: number; open: boolean } | null {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a.v - b.v);
  return s[Math.max(0, Math.ceil(q * s.length) - 1)];
}

export function metrics(reqs: Req[], run: Run, t: number, slots: number) {
  const T = Math.min(t, run.end);
  let tokens = 0, finished = 0, slowest = 0;
  const ttft: Array<{ v: number; open: boolean }> = [];
  reqs.forEach((r, i) => {
    const s = run.start[i];
    if (s >= 0 && s <= t) tokens += Math.min(t, run.finish[i]) - s + 1;
    if (run.finish[i] >= 0 && run.finish[i] <= t) { finished++; slowest = Math.max(slowest, run.finish[i] - r.arrival + 1); }
    if (r.arrival <= t) ttft.push(s >= 0 && s <= t ? { v: s - r.arrival + 1, open: false } : { v: t - r.arrival + 1, open: true });
  });
  const elapsed = T + 1;
  return {
    finished,
    waiting: t <= run.end ? run.waiting[t] : 0,
    tps: tokens / elapsed,
    util: tokens / (slots * elapsed),
    p50: percentile(ttft, 0.5),
    p90: percentile(ttft, 0.9),
    slowest,
  };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Static batching against iteration-level scheduling",
    head: "Batch slots over time",
    static: "Static batching",
    iteration: "Iteration-level scheduling",
    slotsRow: "{n} slots",
    titleSlots: "{name}, {n} slots",
    queueRow: "waiting",
    peak: "peak {n}",
    prefill: "prefill and first token",
    decode: "decode",
    held: "slot idle until the cohort ends",
    queue: "requests waiting",
    step: "model iteration (step)",
    cursor: "step {t}",
    readout: "At step {t}",
    colStatic: "static",
    colIter: "iteration-level",
    mFinished: "requests finished",
    mWaiting: "requests waiting",
    mTps: "output tokens per step",
    mUtil: "slot utilization",
    mP50: "TTFT p50 (steps)",
    mP90: "TTFT p90 (steps)",
    mSlow: "slowest finished E2E (steps)",
    ofN: "{f} of {n}",
    atLeast: "≥ {v}",
    exampleNote: "The runnable's four requests at step 0; arrival rate and spread do not apply.",
    evCohort: "Static batching starts a cohort of {k:request/requests}, {w} left waiting",
    evHeld: "R{i} finishes under static batching, but its slot stays idle until step {e} while {w} wait",
    evRefill: "Under iteration-level scheduling, R{j} takes the slot R{i} freed",
    evDone: "{policy} finishes all {n} requests in {s} steps",
    describe: "Step {t} of {d}. Static batching: {f} of {n} requests finished, {w} waiting, slot utilization {u}. Iteration-level scheduling: {f2} finished, {w2} waiting, slot utilization {u2}.",
  },
  zh: {
    title: "静态批处理与迭代级调度",
    head: "批内槽位随时间的占用",
    static: "静态批处理",
    iteration: "迭代级调度",
    slotsRow: "{n} 个槽位",
    titleSlots: "{name}，{n} 个槽位",
    queueRow: "排队",
    peak: "峰值 {n}",
    prefill: "预填充与首个词元",
    decode: "解码",
    held: "槽位空闲，要等这一批结束",
    queue: "排队请求数",
    step: "模型迭代（步）",
    cursor: "第 {t} 步",
    readout: "第 {t} 步",
    colStatic: "静态",
    colIter: "迭代级",
    mFinished: "已完成请求",
    mWaiting: "排队请求",
    mTps: "每步输出词元",
    mUtil: "槽位利用率",
    mP50: "TTFT p50（步）",
    mP90: "TTFT p90（步）",
    mSlow: "已完成请求中最长的 E2E（步）",
    ofN: "{f} / {n}",
    atLeast: "≥ {v}",
    exampleNote: "可运行示例中的四个请求，都在第 0 步到达；到达率和长度离散度在此不起作用。",
    evCohort: "静态批处理让 {k} 个请求组成一批开始运行，{w} 个继续排队",
    evHeld: "静态批处理下 R{i} 已结束，它的槽位却要空到第 {e} 步，同时有 {w} 个请求在排队",
    evRefill: "迭代级调度下，R{j} 接过 R{i} 空出的槽位",
    evDone: "{policy}用 {s} 步完成全部 {n} 个请求",
    describe: "第 {t} 步（共 {d} 步）。静态批处理：{n} 个请求中完成 {f} 个，排队 {w} 个，槽位利用率 {u}。迭代级调度：完成 {f2} 个，排队 {w2} 个，槽位利用率 {u2}。",
  },
};

type P = { workload: "arrivals" | "example"; rate: number; spread: number; slots: number; seed: number };
type L = typeof labels.en;

function events(p: P, lang: Lang): Array<{ t: number; label: string }> {
  const L = labels[lang];
  const all = runs(p);
  const out: Array<{ t: number; label: string }> = [];
  const a = all.static;
  for (const c of a.cohorts) {
    out.push({ t: c.t, label: tpl(L.evCohort, { k: c.members.length, w: c.left }) });
    // The first member to finish while the cohort still runs and work waits.
    const early = c.members
      .filter((i) => a.finish[i] < c.end && a.waiting[a.finish[i] + 1] > 0)
      .sort((x, y) => a.finish[x] - a.finish[y])[0];
    if (early != null) out.push({ t: a.finish[early] + 1, label: tpl(L.evHeld, { i: early + 1, e: c.end + 1, w: a.waiting[a.finish[early] + 1] }) });
  }
  // The first time the iteration-level scheduler hands a freed slot to a waiting request.
  const b = all.iteration;
  let refill: { t: number; label: string } | undefined;
  for (let j = 0; j < all.reqs.length; j++) {
    const s = b.start[j];
    const prev = all.reqs.findIndex((_, i) => i !== j && b.slot[i] === b.slot[j] && b.finish[i] === s - 1);
    if (prev >= 0 && b.waiting[s - 1] > 0 && (!refill || s < refill.t)) refill = { t: s, label: tpl(L.evRefill, { i: prev + 1, j: j + 1 }) };
  }
  if (refill) out.push(refill);
  const n = all.reqs.length;
  out.push({ t: b.end, label: tpl(L.evDone, { policy: L.iteration, n, s: b.end + 1 }) });
  out.push({ t: a.end, label: tpl(L.evDone, { policy: L.static, n, s: a.end + 1 }) });
  return out.sort((x, y) => x.t - y.t);
}

function panel(p: P, run: Run, reqs: Req[], t: number, title: string, x: (v: number) => number, x0: number, x1: number, y0: number, narrow: boolean, maxQ: number, uid: string, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const S = p.slots;
  const rowH = Math.max(narrow ? 8 : 9, Math.min(22, Math.floor((narrow ? 88 : 104) / S)));
  const labelW = x0;
  parts.push(text(0, y0 + 13, narrow ? tpl(L.titleSlots, { name: title, n: S }) : title, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const top = y0 + 22;
  const slotsH = S * rowH;
  // Slot tracks.
  for (let j = 0; j < S; j++) parts.push(el("rect", { x: x0, y: top + j * rowH + 1, width: x1 - x0, height: rowH - 2, fill: C.panel }));
  if (!narrow) parts.push(text(labelW - 8, top + slotsH / 2 + 4, tpl(L.slotsRow, { n: S }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  const xt = x(t + 1);
  // Static cohort boundaries, and every slot the cohort locks while it is not
  // producing a token: after its request finished, or never filled.
  if (run.policy === "static") {
    for (const c of run.cohorts) {
      if (c.t > t) break;
      parts.push(el("line", { x1: x(c.t), x2: x(c.t), y1: top - 3, y2: top + slotsH + 3, stroke: C.ink3, "stroke-width": 1 }));
      for (let j = 0; j < S; j++) {
        const i = c.members[j];
        const h0 = i != null ? run.finish[i] + 1 : c.t, h1 = Math.min(c.end + 1, t + 1);
        if (h1 <= h0) continue;
        parts.push(el("rect", { x: x(h0), y: top + j * rowH + 1, width: x(h1) - x(h0), height: rowH - 2, fill: `url(#${uid}-held)` }));
      }
    }
  }
  // Request segments, drawn up to the cursor.
  reqs.forEach((r, i) => {
    const s = run.start[i];
    if (s < 0 || s > t) return;
    const e = Math.min(run.finish[i], t) + 1;
    const yy = top + run.slot[i] * rowH + 1;
    const hh = rowH - 2;
    const gap = Math.min(0.8, (x(1) - x(0)) * 0.3);
    parts.push(el("rect", { x: x(s), y: yy, width: Math.max(0.6, x(e) - x(s) - gap), height: hh, fill: C.c1, "fill-opacity": 0.4 }));
    parts.push(el("rect", { x: x(s), y: yy, width: Math.max(0.6, x(s + 1) - x(s) - gap), height: hh, fill: C.c1 }));
    const label = `R${r.id}`;
    const tw = textWidth(label, TYPE.small);
    const room = x(e) - x(s + 1) - 4;
    if (rowH >= 13 && room >= tw + 2) parts.push(text(x(s + 1) + 3, yy + hh / 2 + 4, label, { "font-size": TYPE.small, class: "fig-t-num" }));
  });
  // Queue strip: requests waiting after admission, per step, up to the cursor.
  const T = Math.min(t, run.end);
  let peak = 0;
  for (let k = 0; k <= T; k++) peak = Math.max(peak, run.waiting[k]);
  const qLabel = `${L.queueRow}, ${tpl(L.peak, { n: peak })}`;
  if (narrow) parts.push(text(0, top + slotsH + 16, qLabel, { "font-size": TYPE.body, class: "fig-t-muted" }));
  const qTop = top + slotsH + (narrow ? 22 : 6);
  const qH = narrow ? 24 : 28;
  const qy = (v: number) => qTop + qH - (maxQ ? (v / maxQ) * qH : 0);
  parts.push(el("line", { x1: x0, x2: x1, y1: qTop + qH, y2: qTop + qH, stroke: C.rule, "stroke-width": 1 }));
  if (maxQ) parts.push(el("line", { x1: x0, x2: x1, y1: qTop, y2: qTop, stroke: C.grid, "stroke-width": 1 }));
  const pts: Array<[number, number]> = [[x(0), qy(0)]];
  for (let k = 0; k <= T; k++) { const v = run.waiting[k]; pts.push([x(k), qy(v)], [x(k + 1), qy(v)]); }
  pts.push([x(T + 1), qy(0)]);
  parts.push(el("path", { d: linePath(pts) + "Z", fill: C.ink3, "fill-opacity": 0.35, stroke: C.ink2, "stroke-width": 1, "stroke-linejoin": "round" }));
  if (!narrow) {
    parts.push(text(labelW - 8, qTop + 11, L.queueRow, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(labelW - 8, qTop + 26, tpl(L.peak, { n: peak }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-faint fig-t-num" }));
  }
  // Cursor across the panel.
  parts.push(el("line", { x1: xt, x2: xt, y1: top - 4, y2: qTop + qH, stroke: C.ink, "stroke-width": 1.5 }));
  return { svg: g({ class: "fig-panel" }, ...parts), h: qTop + qH - y0 };
}

function readout(p: P, all: Sim, t: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const a = metrics(all.reqs, all.static, t, p.slots);
  const b = metrics(all.reqs, all.iteration, t, p.slots);
  const n = all.reqs.length;
  const pc = (m: { v: number; open: boolean } | null) => (m ? (m.open ? tpl(L.atLeast, { v: m.v }) : String(m.v)) : "–");
  const rows: Array<[string, string, string]> = [
    [L.mFinished, tpl(L.ofN, { f: a.finished, n }), tpl(L.ofN, { f: b.finished, n })],
    [L.mWaiting, String(a.waiting), String(b.waiting)],
    [L.mTps, fixed(a.tps, 2), fixed(b.tps, 2)],
    [L.mUtil, pct(a.util, 1), pct(b.util, 1)],
    [L.mP50, pc(a.p50), pc(b.p50)],
    [L.mP90, pc(a.p90), pc(b.p90)],
    [L.mSlow, a.slowest ? String(a.slowest) : "–", b.slowest ? String(b.slowest) : "–"],
  ];
  const colW = Math.max(textWidth(L.colIter, TYPE.body), textWidth("100.0%", TYPE.body), textWidth("32 of 32", TYPE.body)) + 16;
  const xB = w;
  const xA = xB - colW;
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, tpl(L.readout, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(text(xA, y0 + 13, L.colStatic, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  parts.push(text(xB, y0 + 13, L.colIter, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  let y = y0 + 22;
  const rowH = 20;
  for (const [name, va, vb] of rows) {
    parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(0, y + 14, name, { "font-size": TYPE.body }));
    parts.push(text(xA, y + 14, va, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(xB, y + 14, vb, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += rowH;
  }
  parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p as P;
  const all = runs(p);
  const t = Math.round(st.t);
  const a = metrics(all.reqs, all.static, t, p.slots);
  const b = metrics(all.reqs, all.iteration, t, p.slots);
  return tpl(L.describe, {
    t, d: all.duration, n: all.reqs.length,
    f: a.finished, w: a.waiting, u: pct(a.util),
    f2: b.finished, w2: b.waiting, u2: pct(b.util),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p as P;
  const w = st.w;
  const narrow = w < 480;
  const all = runs(p);
  const t = Math.round(st.t);
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-held`, C.c2, 4, 1.3))];
  parts.push(text(0, 14, L.head, { "font-size": TYPE.title, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.prefill, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.decode, swatch: { kind: "rect", fill: C.c1, opacity: 0.4 } },
    { label: L.held, swatch: { kind: "rect", fill: C.c2, pattern: `${st.uid}-held` } },
    { label: L.queue, swatch: { kind: "rect", fill: C.ink3, opacity: 0.35, stroke: C.ink2 } },
  ], 0, 24, w, TYPE.body);
  parts.push(lg.svg);
  let y = 24 + lg.height + 6;
  if (p.workload === "example") {
    for (const ln of wrap(L.exampleNote, TYPE.body, w - 6)) { parts.push(text(0, y + 12, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 17; }
    y += 5;
  }
  const labelW = narrow ? 0 : Math.max(textWidth(tpl(L.slotsRow, { n: p.slots }), TYPE.body), textWidth(L.queueRow, TYPE.body), textWidth(tpl(L.peak, { n: 99 }), TYPE.body)) + 14;
  const x1 = w - 4;
  const x = linear([0, all.duration + 1], [labelW, x1]);
  // The cursor label rides above the first panel, at the cursor.
  const maxQ = Math.max(...all.static.waiting, ...all.iteration.waiting, 0);
  const cl = tpl(L.cursor, { t });
  const clw = textWidth(cl, TYPE.body);
  const cx = x(Math.min(t, all.duration) + 1);
  const pA = panel(p, all.static, all.reqs, t, L.static, x, labelW, x1, y, narrow, maxQ, st.uid, L);
  const titleW = textWidth(narrow ? tpl(L.titleSlots, { name: L.static, n: p.slots }) : L.static, TYPE.label) + 12;
  const clx = Math.min(cx, w - clw / 2 - 2);
  parts.push(pA.svg);
  // Only where it clears the panel title; the readout below names the step too.
  if (clx - clw / 2 >= titleW) parts.push(text(clx, y + 13, cl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  y += pA.h + 16;
  const pB = panel(p, all.iteration, all.reqs, t, L.iteration, x, labelW, x1, y, narrow, maxQ, st.uid, L);
  parts.push(pB.svg);
  y += pB.h + 3;
  const ticks = x.ticks(narrow ? 4 : 8).filter((v) => v <= all.duration + 1 && Number.isInteger(v));
  parts.push(axis({ scale: x, orient: "bottom", at: y, ticks, title: L.step, format: (v) => String(v), size: narrow ? TYPE.body : TYPE.small }));
  y += axisHeight(true, narrow ? TYPE.body : TYPE.small) + 14;
  const ro = readout(p, all, t, y, w, L);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "continuous-batching",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    workload: {
      kind: "choice", label: { en: "Workload", zh: "负载" }, default: "arrivals",
      options: [
        { value: "arrivals", label: { en: "Arrivals, 32 requests", zh: "陆续到达，32 个请求" } },
        { value: "example", label: { en: "Runnable example", zh: "可运行示例" } },
      ],
    },
    rate: { kind: "range", label: { en: "Arrival rate", zh: "到达率" }, unit: { en: "per step", zh: "个/步" }, min: 0.05, max: 0.6, step: 0.01, default: 0.4 },
    spread: {
      kind: "range", label: { en: "Output-length spread (CV)", zh: "输出长度离散度（CV）" }, min: 0, max: 1.5, step: 0.05, default: 1,
      marks: [{ value: 0, label: { en: "equal lengths", zh: "长度相同" } }],
    },
    slots: {
      kind: "choice", label: { en: "Batch slots", zh: "批内槽位" }, default: 8,
      options: [
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 4, label: { en: "4", zh: "4" } },
        { value: 8, label: { en: "8", zh: "8" } },
      ],
    },
    seed: { kind: "range", label: { en: "Trace seed", zh: "请求序列种子" }, min: 1, max: 999, step: 1, default: 1, control: false },
  },
  // The runnable example has two slots; the arrival trace opens on eight.
  update(p, key) {
    if (key === "workload") return { ...p, slots: p.workload === "example" ? 2 : 8 };
    return p;
  },
  timeline: {
    rate: 10,
    discrete: true,
    duration: (p) => runs(p as P).duration,
    keyframes: (p, lang) => events(p as P, lang),
    // Open where the iteration-level run has finished everything and the
    // static run is still working through its queue.
    poster: (p) => {
      const all = runs(p as P);
      return all.iteration.end < all.static.end ? all.iteration.end : Math.floor(all.duration / 2);
    },
  },
  render,
  describe,
});
