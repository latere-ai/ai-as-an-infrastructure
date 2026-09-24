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
