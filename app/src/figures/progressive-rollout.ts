// A staged rollout of one candidate release, gated by the deployment chapter's
// non-inferiority condition L ≥ −δ on Δ = E[Y(1) − Y(0)], the candidate's task
// success rate minus a concurrent control's.
//
// Stages widen exposure 1% (first cell), 5% (sticky canary), 25% (wave 1),
// 50% (wave 2), 100% (full release). Up to wave 2 the candidate cohort runs
// against a concurrent control of the same size; each stage tests its own
// cohort, so its evidence starts empty when the stage begins. Every 15 minutes
// the gate recomputes an interval [L, U] for Δ from the outcomes that have
// arrived, which is the outcomes of tasks run at least one outcome delay D
// earlier, and decides:
//
//   U < −δ                                roll back: the candidate is worse than
//                                         the tolerated loss
//   dwell ≥ minimum and L ≥ −δ            promote to the next stage
//   otherwise                             hold, and keep collecting
//
// Because the gate looks every 15 minutes, a fixed-horizon interval would lose
// its error rate (the chapter's warning), so the interval is always valid: the
// normal-mixture confidence sequence of the mixture sequential probability
// ratio test (Johari, Koomen, Pekelis, and Walsh, "Always Valid Inference",
// Operations Research 70(3), 2022), with V the variance of the difference of
// the two sample means, mixing variance τ² and α = 0.05:
//
//   h = √( V (V + τ²) / τ² · ( 2 ln(1/α) + ln((V + τ²) / V) ) ),
//
// intersected with the previous interval of the same stage, so the interval
// only narrows. The full stage has no concurrent control and no gate.
//
// Everything here is illustrative: a 90% baseline success rate, the stage
// shares and minimum dwells, and per-arm outcome counts drawn from a seeded
// normal approximation of the binomial. The noise is drawn once per seed and
// reused for every parameter setting, so moving a control moves the paths
// smoothly instead of redrawing them. Harm is the expected number of tasks
// that failed because of the candidate, Σ n₁ · max(0, −Δ_true).

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { normalFrom } from "./lib/stats.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

export const STEP_H = 0.25; // hours per gate check
const HORIZON = 384; // steps: 96 hours
const P0 = 0.9; // baseline task success rate
const ALPHA = 0.05;
const TAU2 = 0.01 ** 2; // mixing variance: a 1 percentage-point scale
const OBSERVE_STEPS = 16; // how long the figure follows a full release
const AFTER_ROLLBACK = 8; // steps shown after a rollback

export type StageKey = "cell" | "canary" | "wave1" | "wave2" | "full";
export interface Stage { key: StageKey; share: number; dwell: number } // dwell in steps
export const STAGES: Stage[] = [
  { key: "cell", share: 0.01, dwell: 16 },
  { key: "canary", share: 0.05, dwell: 24 },
  { key: "wave1", share: 0.25, dwell: 48 },
  { key: "wave2", share: 0.5, dwell: 48 },
  { key: "full", share: 1, dwell: 0 },
];
const ONSET: Record<string, number> = { cell: 0, wave1: 2, wave2: 3 };

export type Decision = "wait" | "hold" | "promote" | "rollback" | "none";
export interface Step {
  stage: number; // index into STAGES, or -1 after a rollback
  share: number;
  trueDelta: number; // Δ of the tasks run in this step
  n: number; // tasks per arm run in this step
  est: number; // Δ̂ at the end of the step (NaN before any outcome of this stage has arrived)
  lo: number; // L
  hi: number; // U
  h: number; // raw half-width at this step
  arrived: number; // outcomes per arm that the gate has for this stage
  inStage: number; // steps since the stage began, including this one
  decision: Decision;
  served: number; // tasks the candidate has served so far
  harm: number; // expected tasks failed because of the candidate so far
}
export type EventKind = "enter" | "rollback" | "hold" | "horizon";
export interface RolloutEvent { t: number; kind: EventKind; stage: number }
export interface Run { steps: Step[]; events: RolloutEvent[]; end: number; outcome: "full" | "rollback" | "held" }

export interface SimParams { effect: number; margin: number; onset: string; traffic: number; delay: number; seed: number }

// Standard normal noise for the candidate and control arms, one draw per step.
const noiseMemo = new Map<number, { z1: Float64Array; z0: Float64Array }>();
function noise(seed: number) {
  let hit = noiseMemo.get(seed);
  if (!hit) {
    const u = rng(seed);
    const z1 = new Float64Array(HORIZON), z0 = new Float64Array(HORIZON);
    for (let i = 0; i < HORIZON; i++) { z1[i] = normalFrom(u(), u()); z0[i] = normalFrom(u(), u()); }
    hit = { z1, z0 };
    if (noiseMemo.size > 16) noiseMemo.clear();
    noiseMemo.set(seed, hit);
  }
  return hit;
}

// Successes among n tasks at rate p: the normal approximation of Bin(n, p).
function successes(n: number, p: number, z: number): number {
  return Math.min(n, Math.max(0, n * p + Math.sqrt(n * p * (1 - p)) * z));
}

export function halfWidth(V: number): number {
  return Math.sqrt((V * (V + TAU2)) / TAU2 * (2 * Math.log(1 / ALPHA) + Math.log((V + TAU2) / V)));
}

export function simulate(p: SimParams): Run {
  const { z1, z0 } = noise(p.seed);
  const delta = p.effect / 100, margin = p.margin / 100;
  const lag = Math.round(p.delay / STEP_H);
  const onset = ONSET[p.onset] ?? 0;
  const steps: Step[] = [];
  const events: RolloutEvent[] = [{ t: 0, kind: "enter", stage: 0 }];
  // Per-step records of the current stage, for delayed arrival.
  let stage = 0, begin = 0;
  let lo = -Infinity, hi = Infinity;
  let served = 0, harm = 0;
  let stopAt = -1;
  let outcome: Run["outcome"] = "held";
  let held = false;
  const k1: number[] = [], k0: number[] = [], nn: number[] = [];
  for (let t = 0; t < HORIZON; t++) {
    const rolled = stage < 0;
    const st = rolled ? null : STAGES[stage];
    const share = st ? st.share : 0;
    const trueDelta = st && stage >= onset ? delta : 0;
    const n = share * p.traffic * STEP_H;
    served += n;
    harm += n * Math.max(0, -trueDelta);
    let decision: Decision = "none";
    let est = NaN, h = NaN, arrived = 0;
    if (st && st.key !== "full") {
      const p1 = P0 + trueDelta;
      k1.push(successes(n, p1, z1[t]));
      k0.push(successes(n, P0, z0[t]));
      nn.push(n);
      const upto = t - begin - lag; // last index of this stage whose outcomes have arrived
      decision = "wait";
      if (upto >= 0) {
        let s1 = 0, s0 = 0, N = 0;
        for (let i = 0; i <= upto; i++) { s1 += k1[i]; s0 += k0[i]; N += nn[i]; }
        const a = Math.min(0.999, Math.max(0.001, s1 / N)), b = Math.min(0.999, Math.max(0.001, s0 / N));
        const V = (a * (1 - a) + b * (1 - b)) / N;
        est = s1 / N - s0 / N;
        h = halfWidth(V);
        const nl = Math.max(lo, est - h), nh = Math.min(hi, est + h);
        if (nl <= nh) { lo = nl; hi = nh; }
        arrived = N;
        const inStage = t - begin + 1;
        if (hi < -margin) decision = "rollback";
        else if (inStage >= st.dwell && lo >= -margin) decision = "promote";
        else decision = inStage >= st.dwell ? "hold" : "wait";
      }
    }
    steps.push({
      stage, share, trueDelta, n, est, lo: Number.isFinite(est) ? lo : NaN, hi: Number.isFinite(est) ? hi : NaN, h, arrived,
      inStage: t - begin + 1, decision, served, harm,
    });
    if (decision === "hold" && !held) { held = true; events.push({ t: t + 1, kind: "hold", stage }); }
    if (decision === "rollback") {
      events.push({ t: t + 1, kind: "rollback", stage });
      outcome = "rollback";
      stage = -1;
      stopAt = t + AFTER_ROLLBACK;
    } else if (decision === "promote") {
      stage++;
      begin = t + 1;
      lo = -Infinity; hi = Infinity; held = false;
      k1.length = 0; k0.length = 0; nn.length = 0;
      events.push({ t: t + 1, kind: "enter", stage });
      if (STAGES[stage].key === "full") { outcome = "full"; stopAt = t + OBSERVE_STEPS; }
    }
    if (stopAt >= 0 && t >= stopAt) break;
  }
  const end = steps.length - 1;
  if (outcome === "held") events.push({ t: end, kind: "horizon", stage: steps[end].stage });
  return { steps, events, end, outcome };
}

const memo = new Map<string, Run>();
export function run(p: SimParams): Run {
  const key = `${p.effect}|${p.margin}|${p.onset}|${p.traffic}|${p.delay}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(p);
    if (memo.size > 48) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}


// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "A staged rollout gated on L ≥ −δ",
    exposure: "Share of traffic on the candidate",
    evidence: "Gate evidence for the current stage: the estimate of Δ and its always-valid 95% interval",
    x: "hours since the first user exposure",
    cell: "first cell", canary: "canary", wave1: "wave 1", wave2: "wave 2", full: "full",
    zero: "0%",
    rolled: "rolled back",
    band: "interval [L, U]",
    est: "estimate of Δ",
    truth: "true Δ (the simulation's input)",
    yUnit: "Δ, pp",
    dwellMark: "minimum dwell ends, stage holds",
    ladder: "stage of the candidate",
    marginLine: "−δ",
    hour: "Hour {h}: {state}",
    atStage: "{stage}, {share} of traffic",
    atRolled: "rolled back, 0% of traffic",
    atFull: "full release, with no concurrent control and no gate",
    rEvidence: "evidence",
    rGate: "gate",
    rDwell: "dwell",
    rServed: "candidate",
    rDirect: "all at once",
    waiting: "no outcomes yet for this stage: they arrive {d} h after a task runs",
    interval: "estimate {e} pp, interval [{l}, {u}] pp, from {n} outcomes per arm",
    need: "promotion needs L ≥ −δ = {m} pp",
    passes: "L = {l} ≥ {m}: promote",
    passesWait: "L = {l} ≥ {m}, but the minimum dwell is not reached",
    holds: "L = {l} < {m}: hold",
    rollsBack: "U = {u} < {m}: roll back",
    noGate: "none at full release",
    gateStopped: "stopped: the candidate serves no traffic",
    lastInterval: "last in {stage}: estimate {e} pp, interval [{l}, {u}] pp, from {n} outcomes per arm",
    rolledAt: "U = {u} < {m}: rolled back at hour {h}",
    dwell: "{a} h in this stage, minimum {b} h",
    served: "{s} tasks served, about {f} failed because of it",
    noHarm: "{s} tasks served, none failed because of it",
    direct: "at least {f} failed tasks before the first outcome arrives",
    directNone: "no failed tasks: the candidate is not worse",
    describe: "Hour {h}: {state}. {gate} So far the candidate served {s} tasks and about {f} failed because of it.",
    describeNone: "Hour {h}: {state}. {gate} So far the candidate served {s} tasks and none failed because of it.",
    dGate: "The gate's interval for Δ is [{l}, {u}] percentage points against −δ = {m}.",
    dNoGate: "The gate has no outcomes for this stage.",
    evAt: "Hour {h}, {what}",
    evEnter: "{stage}: {share} of traffic",
    evHold: "{stage}: minimum dwell reached, L below −δ, holding",
    evRollback: "rolled back from {stage}: U fell below −δ",
    evHorizon: "no decision: the interval never cleared −δ",
  },
  zh: {
    title: "以 L ≥ −δ 为闸门的分阶段发布",
    exposure: "候选版本承接的流量份额",
    evidence: "当前阶段的闸门证据：Δ 的估计值及其始终有效的 95% 区间",
    x: "自首次向用户暴露起的小时数",
    cell: "首个单元", canary: "金丝雀", wave1: "波次 1", wave2: "波次 2", full: "全量",
    zero: "0%",
    rolled: "已回滚",
    band: "区间 [L, U]",
    est: "Δ 的估计值",
    truth: "真实 Δ（模拟的输入）",
    yUnit: "Δ，pp",
    dwellMark: "最低驻留时间结束，阶段暂停",
    ladder: "候选版本所处阶段",
    marginLine: "−δ",
    hour: "第 {h} 小时：{state}",
    atStage: "{stage}，承接 {share} 的流量",
    atRolled: "已回滚，流量份额为 0%",
    atFull: "全量发布，没有同期对照组，也没有闸门",
    rEvidence: "证据",
    rGate: "闸门",
    rDwell: "驻留",
    rServed: "候选版本",
    rDirect: "一次性全量",
    waiting: "本阶段尚无结果：任务运行 {d} 小时后结果才到达",
    interval: "估计值 {e} pp，区间 [{l}, {u}] pp，每组 {n} 个结果",
    need: "提升要求 L ≥ −δ = {m} pp",
    passes: "L = {l} ≥ {m}：提升",
    passesWait: "L = {l} ≥ {m}，但尚未达到最低驻留时间",
    holds: "L = {l} < {m}：暂停",
    rollsBack: "U = {u} < {m}：回滚",
    noGate: "全量发布阶段没有闸门",
    gateStopped: "已停止：候选版本不再承接流量",
    lastInterval: "{stage}的最后结果：估计值 {e} pp，区间 [{l}, {u}] pp，每组 {n} 个结果",
    rolledAt: "U = {u} < {m}：第 {h} 小时回滚",
    dwell: "本阶段已 {a} 小时，最低 {b} 小时",
    served: "已处理 {s} 个任务，其中约 {f} 个因它失败",
    noHarm: "已处理 {s} 个任务，没有任务因它失败",
    direct: "第一批结果到达之前，至少已有 {f} 个任务失败",
    directNone: "没有任务失败：候选版本并不更差",
    describe: "第 {h} 小时：{state}。{gate}到目前为止，候选版本处理了 {s} 个任务，其中约 {f} 个因它失败。",
    describeNone: "第 {h} 小时：{state}。{gate}到目前为止，候选版本处理了 {s} 个任务，没有任务因它失败。",
    dGate: "闸门给出的 Δ 区间为 [{l}, {u}] 个百分点，对照 −δ = {m}。",
    dNoGate: "本阶段闸门还没有结果。",
    evAt: "第 {h} 小时，{what}",
    evEnter: "{stage}：承接 {share} 的流量",
    evHold: "{stage}：已达最低驻留时间，L 仍低于 −δ，暂停",
    evRollback: "从{stage}回滚：U 已低于 −δ",
    evHorizon: "仍无结论：区间始终没有越过 −δ",
  },
};

type P = { effect: number; margin: number; onset: string; traffic: number; delay: number; seed: number };
type Lbl = typeof labels.en;

const hours = (t: number) => t * STEP_H;
const fmtH = (h: number) => String(Number(h.toFixed(2)));
// Percentage points with two decimals, so a bound just past −δ never reads as equal to it.
const pp = (v: number) => (v > 0 ? "+" : "") + fixed(v * 100, 2);
const stageName = (i: number, L: Lbl) => (i < 0 ? L.rolled : L[STAGES[i].key]);
// A space between a Latin letter or digit and an adjacent Chinese character,
// for zh strings assembled from parts ("波次 1" + "的最后结果").
const cjkSpace = (s: string) => s.replace(/([0-9A-Za-z])([\u4e00-\u9fff])/g, "$1 $2").replace(/([\u4e00-\u9fff])([0-9A-Za-z])/g, "$1 $2");
const zhFix = (s: string, lang: Lang) => (lang === "zh" ? cjkSpace(s) : s);
const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCjk(cjkSpace(s), size, w) : wrap(s, size, w));

function stateLine(s: Step, L: Lbl): string {
  if (s.stage < 0) return L.atRolled;
  if (STAGES[s.stage].key === "full") return L.atFull;
  return tpl(L.atStage, { stage: stageName(s.stage, L), share: pct(s.share) });
}

// The gate's decision at this step, in the reader's terms.
function gateLine(s: Step, p: P, L: Lbl): string {
  const m = fixed(-p.margin, 2);
  if (s.stage < 0) return L.gateStopped;
  if (STAGES[s.stage].key === "full") return L.noGate;
  if (!Number.isFinite(s.est)) return tpl(L.need, { m });
  if (s.hi < -p.margin / 100) return tpl(L.rollsBack, { u: pp(s.hi), m });
  if (s.lo >= -p.margin / 100) return tpl(s.decision === "promote" ? L.passes : L.passesWait, { l: pp(s.lo), m });
  return tpl(L.holds, { l: pp(s.lo), m });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = run(p);
  const t = Math.min(Math.round(st.t), r.end);
  const s = r.steps[t];
  const gate = Number.isFinite(s.est) ? tpl(L.dGate, { l: pp(s.lo), u: pp(s.hi), m: fixed(-p.margin, 2) }) : L.dNoGate;
  return zhFix(tpl(s.harm > 0.5 ? L.describe : L.describeNone, { h: fmtH(hours(t + 1)), state: stateLine(s, L), gate, s: int(s.served), f: int(s.harm) }), lang);
}

// Step path through (hour, value) cells: each step holds its value for STEP_H.
function stepPts(ts: number[], v: (t: number) => number, x: (h: number) => number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const t of ts) { const y = v(t); pts.push([x(hours(t)), y], [x(hours(t + 1)), y]); }
  return pts;
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = run(p);
  const T = Math.min(Math.round(st.t), r.end);
  const s = r.steps[T];
  const size = TYPE.body;
  const parts: string[] = [];
  const durH = hours(r.end + 1);

  // ---- exposure ladder: one row per stage share, 0% at the bottom
  const rowName = (k: number) => `${L[STAGES[k].key]} · ${pct(STAGES[k].share)}`;
  const left = Math.ceil(Math.max(...STAGES.map((_, k) => textWidth(rowName(k), size)))) + 14;
  const right = w - 10;
  const x = linear([0, durH], [left, right]);
  let y = 0;
  parts.push(text(0, y + 14, L.exposure, { "font-size": TYPE.label, class: "fig-t-strong" }));
  // Key for the dwell marks and the ladder line, drawn as they appear below.
  parts.push(el("line", { x1: 0, x2: 16, y1: y + 32, y2: y + 32, stroke: C.c1, "stroke-width": 2.5 }));
  parts.push(text(22, y + 36, L.ladder, { "font-size": size, fill: C.ink2 }));
  const kx = 22 + textWidth(L.ladder, size) + 18;
  const keyWraps = kx + 12 + textWidth(L.dwellMark, size) > w;
  const ky = keyWraps ? y + 52 : y + 32;
  const kx0 = keyWraps ? 0 : kx;
  parts.push(el("rect", { x: kx0 + 6, y: ky - 7, width: 3, height: 14, rx: 1, fill: C.ink2 }));
  parts.push(text(kx0 + 16, ky + 4, L.dwellMark, { "font-size": size, fill: C.ink2 }));
  const top = ky + 26;
  const rowGap = narrow ? 24 : 26;
  const floor = top + rowGap * STAGES.length;
  const rowY = (k: number) => floor - rowGap * (k + 1); // k = -1 is the 0% row
  const cur = s.stage;
  STAGES.forEach((_, k) => {
    const yy = rowY(k);
    parts.push(el("line", { x1: left, x2: right, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(left - 8, yy + 4, rowName(k), { "font-size": size, "text-anchor": "end", class: k === cur ? "fig-t-strong" : "fig-t-muted" }));
  });
  parts.push(el("line", { x1: left, x2: right, y1: floor, y2: floor, stroke: C.rule, "stroke-width": 1 }));
  parts.push(text(left - 8, floor + 4, L.zero, { "font-size": size, "text-anchor": "end", class: cur < 0 ? "fig-t-strong" : "fig-t-muted" }));
  const upto = Array.from({ length: T + 1 }, (_, i) => i);
  const stair = stepPts(upto, (t) => rowY(r.steps[t].stage), x);
  parts.push(el("path", { d: linePath(stair), fill: "none", stroke: C.c1, "stroke-width": 2.5, "stroke-linejoin": "round" }));
  // Where each stage's minimum dwell ends: before it the gate can only roll
  // back; after it, a stage still on its row is holding.
  const enters = r.events.filter((e) => e.kind === "enter" && e.t <= T);
  for (const e of enters) {
    const stg = STAGES[e.stage];
    if (!stg.dwell) continue;
    const td = e.t + stg.dwell;
    const stillThere = td <= T && r.steps[td].stage === e.stage;
    if (!stillThere) continue;
    const dx = x(hours(td)), dy = rowY(e.stage);
    parts.push(el("rect", { x: dx - 1.5, y: dy - 7, width: 3, height: 14, rx: 1, fill: C.ink2 }));
  }
  const rb = r.events.find((e) => e.kind === "rollback");
  if (rb && rb.t <= T) {
    const rx = x(hours(rb.t));
    parts.push(el("circle", { cx: rx, cy: floor, r: 4.5, fill: C.bad, stroke: C.paper, "stroke-width": 1.5 }));
    const lw = textWidth(L.rolled, size);
    const lx = rx + 8 + lw <= right ? rx + 8 : rx - 8;
    parts.push(text(lx, floor - 7, L.rolled, { "font-size": size, "text-anchor": lx > rx ? "start" : "end", class: "fig-t-strong fig-t-halo" }));
  }
  y = floor + 26;

  // ---- evidence for the current stage
  for (const ln of lines(L.evidence, TYPE.label, w - 8, lang)) { parts.push(text(0, y + 14, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  const lg = legend([
    { label: L.band, swatch: { kind: "rect", fill: C.c1, opacity: 0.28 } },
    { label: L.est, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.truth, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
    { label: `${L.marginLine} = ${fixed(-p.margin, 2)} pp`, swatch: { kind: "line", stroke: C.c2, dash: "6 3" } },
  ], 0, y + 4, w, size);
  parts.push(lg.svg);
  const etop = y + lg.height + 26;
  const eH = narrow ? 140 : 150;
  const dlo = Math.floor(Math.min(-p.margin, p.effect) - 2), dhi = Math.ceil(Math.max(0, p.effect) + 2);
  const ey = linear([dlo / 100, dhi / 100], [etop + eH, etop]);
  const cl = (v: number) => ey(ey.clamp(v));
  parts.push(axis({ scale: ey, orient: "left", at: left, grid: [left, right], ticks: ey.ticks(narrow ? 4 : 6), format: (v) => (Math.abs(v) < 1e-9 ? "0" : (v > 0 ? "+" : "") + fixed(v * 100, Number.isInteger(Math.round(v * 1e6) / 1e4) ? 0 : 1)), size }));
  parts.push(text(left - 8, etop - 12, L.yUnit, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  const xt = x.ticks(narrow ? 4 : 8).filter((v) => v <= durH);
  parts.push(axis({ scale: x, orient: "bottom", at: etop + eH, ticks: xt, title: L.x, format: (v) => String(v), size }));
  parts.push(el("line", { x1: left, x2: right, y1: ey(0), y2: ey(0), stroke: C.ink3, "stroke-width": 1 }));
  // Stage boundaries.
  for (const e of r.events) if (e.kind === "enter" && e.t > 0 && e.t <= T) {
    const ex = x(hours(e.t));
    for (const [y1, y2] of [[top, floor], [etop, etop + eH]]) parts.push(el("line", { x1: ex, x2: ex, y1, y2, stroke: C.rule, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  }
  // The tolerated loss and the true effect of the tasks each step ran.
  parts.push(el("line", { x1: left, x2: right, y1: ey(-p.margin / 100), y2: ey(-p.margin / 100), stroke: C.c2, "stroke-width": 1.5, "stroke-dasharray": "6 3" }));
  const gated = upto.filter((t) => r.steps[t].stage >= 0 && STAGES[r.steps[t].stage].key !== "full");
  if (gated.length) parts.push(el("path", { d: linePath(stepPts(gated, (t) => cl(r.steps[t].trueDelta), x)), fill: "none", stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  // Interval band and estimate, one segment per stage.
  const segs: number[][] = [];
  for (const t of upto) {
    const q = r.steps[t];
    if (!Number.isFinite(q.est)) continue;
    const last = segs[segs.length - 1];
    if (last && r.steps[last[last.length - 1]].stage === q.stage && last[last.length - 1] === t - 1) last.push(t);
    else segs.push([t]);
  }
  for (const sg of segs) {
    const up = stepPts(sg, (t) => cl(r.steps[t].hi), x);
    const dn = stepPts(sg, (t) => cl(r.steps[t].lo), x).reverse();
    parts.push(el("path", { d: linePath([...up, ...dn]) + "Z", fill: C.c1, "fill-opacity": 0.28, stroke: "none" }));
    parts.push(el("path", { d: linePath(stepPts(sg, (t) => cl(r.steps[t].est), x)), fill: "none", stroke: C.c1, "stroke-width": 1.8 }));
  }
  if (rb && rb.t <= T) {
    const q = r.steps[rb.t - 1];
    parts.push(el("circle", { cx: x(hours(rb.t)), cy: cl(q.hi), r: 4.5, fill: C.bad, stroke: C.paper, "stroke-width": 1.5 }));
  }
  // Cursor across both panels.
  const cx = x(hours(T + 1));
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 6, y2: etop + eH, stroke: C.ink, "stroke-width": 1.2 }));
  y = etop + eH + axisHeight(true, size) + 16;

  // ---- readout at the cursor
  const rows: Array<[string, string]> = [];
  rows.push(["", tpl(L.hour, { h: fmtH(hours(T + 1)), state: stateLine(s, L) })]);
  const gatedNow = s.stage >= 0 && STAGES[s.stage].key !== "full";
  if (s.stage < 0 && rb) {
    const q = r.steps[rb.t - 1];
    rows.push([L.rEvidence, tpl(L.lastInterval, { stage: stageName(q.stage, L), e: pp(q.est), l: pp(q.lo), u: pp(q.hi), n: int(q.arrived) })]);
    rows.push([L.rGate, tpl(L.rolledAt, { u: pp(q.hi), m: fixed(-p.margin, 2), h: fmtH(hours(rb.t)) })]);
  } else if (gatedNow) {
    rows.push([L.rEvidence, Number.isFinite(s.est)
      ? tpl(L.interval, { e: pp(s.est), l: pp(s.lo), u: pp(s.hi), n: int(s.arrived) })
      : tpl(L.waiting, { d: fmtH(p.delay) })]);
    rows.push([L.rGate, gateLine(s, p, L)]);
    rows.push([L.rDwell, tpl(L.dwell, { a: fmtH(hours(s.inStage)), b: fmtH(hours(STAGES[s.stage].dwell)) })]);
  } else if (s.stage >= 0) {
    rows.push([L.rGate, gateLine(s, p, L)]);
  }
  rows.push([L.rServed, tpl(s.harm > 0.5 ? L.served : L.noHarm, { s: int(s.served), f: int(s.harm) })]);
  rows.push([L.rDirect, p.effect < 0 ? tpl(L.direct, { f: int(p.traffic * (-p.effect / 100) * (p.delay + STEP_H)) }) : L.directNone]);
  const labW = Math.max(...rows.map(([k]) => (k ? textWidth(k, size) : 0))) + 12;
  const valW = w - labW - 4;
  rows.forEach(([k, v], i) => {
    const vl = i === 0 ? lines(v, TYPE.label, w - 8, lang) : lines(v, size, valW, lang);
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    if (k) parts.push(text(0, y + 15, k, { "font-size": size, class: "fig-t-muted" }));
    vl.forEach((ln, j) => parts.push(text(i === 0 ? 0 : labW, y + 15 + j * 16, ln, { "font-size": i === 0 ? TYPE.label : size, class: i === 0 ? "fig-t-strong" : "fig-t-num" })));
    y += 8 + vl.length * 16;
  });
  return svg(w, y + 6, describe(st, lang), g({ class: "fig-rollout" }, ...parts));
}

export default defineFigure({
  name: "progressive-rollout",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    effect: {
      kind: "range", label: { en: "Candidate effect on task success Δ", zh: "候选版本对任务成功率的影响 Δ" }, unit: { en: "pp", zh: "pp" },
      min: -4, max: 1, step: 0.25, default: -2,
      marks: [{ value: 0, label: { en: "none", zh: "无影响" } }],
    },
    margin: { kind: "range", label: { en: "Tolerated loss δ", zh: "可容忍损失 δ" }, unit: { en: "pp", zh: "pp" }, min: 0.25, max: 2, step: 0.25, default: 1 },
    onset: {
      kind: "choice", label: { en: "Regression first appears in", zh: "退化首次出现于" }, default: "wave1",
      options: [
        { value: "cell", label: { en: "First cell", zh: "首个单元" } },
        { value: "wave1", label: { en: "Wave 1", zh: "波次 1" } },
        { value: "wave2", label: { en: "Wave 2", zh: "波次 2" } },
      ],
    },
    traffic: {
      kind: "range", scale: "log", label: { en: "Traffic", zh: "流量" }, unit: { en: "tasks per hour", zh: "个任务/小时" },
      min: 20000, max: 2000000, default: 200000,
    },
    delay: { kind: "range", label: { en: "Outcome delay D", zh: "结果延迟 D" }, unit: { en: "h", zh: "小时" }, min: 0, max: 6, step: 0.25, default: 1 },
    seed: { kind: "range", label: { en: "Outcome draw", zh: "结果抽样种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  timeline: {
    rate: 8,
    discrete: true,
    duration: (p) => run(p).end,
    keyframes: (p, lang) => {
      const L = labels[lang];
      return run(p).events.map((e) => {
        const name = stageName(e.stage, L);
        const label = e.kind === "enter" ? tpl(L.evEnter, { stage: name, share: pct(STAGES[e.stage].share) })
          : e.kind === "hold" ? tpl(L.evHold, { stage: name })
          : e.kind === "rollback" ? tpl(L.evRollback, { stage: name })
          : L.evHorizon;
        const at = tpl(L.evAt, { h: fmtH(hours(e.t)), what: label });
        return { t: Math.min(e.t, run(p).end), label: zhFix(at, lang) };
      });
    },
    // The end of the run: the whole staircase, the evidence of every stage,
    // and the decision that ended it.
    poster: (p) => run(p).end,
  },
  render,
  describe,
});
