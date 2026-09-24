// Agent RL over wall-clock time: where rollout and learning run (placement)
// and when the learner waits for data (update synchronization), on one seeded
// trace of multi-turn trajectories.
//
// Trajectory i follows the chapter's decomposition
//
//   T_rollout,i = T_reset,i + Σ_t (T_decode,i,t + T_env,i,t) + T_verify,i
//
// with 3 to 7 turns, 2 to 5 s of decoding per turn, 1 to 4 s per tool call,
// and a reader-set share of slow tool calls (25 to 60 s). B = 8 rollout slots
// hold one trajectory each; a decoding slot occupies one of the pool's eight
// GPUs, a slot waiting on its environment occupies none. The learner trains on
// the first B finished trajectories in finish order (T_update = 16 s on eight
// GPUs) and then makes the new weights available to rollout.
//
// Placement:
// - shared: one pool of eight GPUs time-slices the two roles. Rollout pauses
//   decoding while the pool reshards to the training layout, trains, and
//   reshards back (3 s each way, so T_weight sync = 6 s). Tool calls in flight
//   keep running.
// - separate: a rollout pool and a learner pool of eight GPUs each. Weights
//   cross between them in T_weight sync = 5 s.
//
// Synchronization is one rule, a bound on how far rollout may run ahead of
// the learner: trajectory n may start only when n < (k + 1 + η) · B, where k
// is the published policy version. η = 0 is the synchronous barrier (batch
// k + 1 starts only after version k + 1 is published, so every token is
// trained on by the version that sampled it); asynchronous runs use η = 1,
// the staleness bound of AReaL [fu2025areal]. A decoding segment is sampled
// by the version published when it runs, so a trajectory can span versions
// (interruptible generation), and its lag when trained is the learner's
// version minus that version.
//
// Every duration is illustrative, not a measurement. State is a pure function
// of the parameters and the time t: the four combinations are simulated once
// per parameter set on the same trace (memoized) and render reads time t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";
import { rng, intBetween } from "./lib/random.ts";

// ---------------------------------------------------------------- model

export const B = 8; // rollout slots, and trajectories per update
const DT = 0.5; // simulation step, s
export const H = 360; // simulated wall-clock span, s
const GPUS = 8; // GPUs per pool
export const T_UPDATE = 16; // s
export const T_RESHARD = 3; // s, each way (shared pool)
export const T_SEND = 5; // s (separate pools)
const AHEAD = 1; // η for asynchronous runs
const MAXN = 400; // trajectories in the trace, more than any run starts

export type Placement = "shared" | "separate";
export type Sync = "sync" | "async";
type Part = "reset" | "decode" | "tool" | "slow" | "verify";

interface SegSpec { kind: "env" | "decode"; dur: number; part: Part }
interface Spec { segs: SegSpec[] }

const q = (x: number) => Math.max(DT, Math.round(x / DT) * DT);

// The trace. Every tool call draws the same three numbers whatever the slow
// share, so raising the share turns some calls slow and changes nothing else.
function trace(slow: number, seed: number): Spec[] {
  const u = rng(seed);
  const out: Spec[] = [];
  for (let n = 0; n < MAXN; n++) {
    const turns = intBetween(u(), 3, 7);
    const segs: SegSpec[] = [{ kind: "env", dur: q(2 + 2 * u()), part: "reset" }];
    for (let k = 0; k < turns; k++) {
      segs.push({ kind: "decode", dur: q(2 + 3 * u()), part: "decode" });
      if (k < turns - 1) {
        const a = u(), fast = q(1 + 3 * u()), long = q(25 + 35 * u());
        segs.push(a < slow ? { kind: "env", dur: long, part: "slow" } : { kind: "env", dur: fast, part: "tool" });
      }
    }
    segs.push({ kind: "env", dur: q(2 + 3 * u()), part: "verify" });
    out.push({ segs });
  }
  return out;
}

// A drawn stretch of one trajectory: decoding under version v, or time in the
// environment (reset, tool calls, verification).
export interface Seg { kind: "env" | "decode"; t0: number; t1: number; v: number; part: Part }
export interface Traj {
  id: number; slot: number; start: number; end: number; // end = Infinity while running
  segs: Seg[];
  update: number; // the update that trained it, −1 if none yet
  parts: Record<"reset" | "decode" | "env" | "verify", number>; // seconds, for the T_rollout terms
}
export interface Block { kind: "train" | "reshard" | "send"; t0: number; t1: number; k: number }
export interface Gap { row: number; t0: number; t1: number } // row: slot, or −1 for the learner pool
export interface Upd {
  k: number; // learner version while it trains; publishes k + 1
  start: number; publish: number; // publish = Infinity if after the span
  trajs: number[];
  lagMean: number; lagMax: number; off: number; // off: share of decoding sampled by an older version
  slowest: number; maxRollout: number; medRollout: number;
}
export interface Run {
  placement: Placement; sync: Sync;
  trajs: Traj[]; blocks: Block[]; gaps: Gap[]; upds: Upd[];
  useful: Float64Array; // cumulative useful GPU-seconds (decoding plus training) at each step
  gpus: number; // provisioned GPUs
  sync_s: number; // T_weight sync
}

function simulate(sp: Spec[], placement: Placement, sync: Sync): Run {
  const shared = placement === "shared";
  const eta = sync === "sync" ? 0 : AHEAD;
  const steps = Math.round(H / DT);
  const slots: Array<{ tr: Traj; seg: number; left: number } | null> = Array.from({ length: B }, () => null);
  const trajs: Traj[] = [];
  const blocks: Block[] = [];
  const gaps: Gap[] = [];
  const upds: Upd[] = [];
  const buffer: Traj[] = [];
  const useful = new Float64Array(steps + 1);
  const open: Array<number | null> = Array.from({ length: B + 1 }, () => null); // open idle gap per row (B = learner)
  // Shared pool: gen, reshard1, train, reshard2. Separate learner: idle, train, send.
  let phase: "gen" | "reshard1" | "train" | "reshard2" | "idle" | "send" = shared ? "gen" : "idle";
  let phaseEnd = 0;
  let published = 0;
  let started = 0;
  let cur: Upd | null = null;

  const openGap = (row: number, t: number) => { if (open[row] == null) open[row] = t; };
  const closeGap = (row: number, t: number) => {
    const t0 = open[row];
    if (t0 != null) { if (t > t0) gaps.push({ row: row === B ? -1 : row, t0, t1: t }); open[row] = null; }
  };
  const block = (kind: Block["kind"], t0: number, dur: number) => { blocks.push({ kind, t0, t1: t0 + dur, k: published }); phaseEnd = t0 + dur; };

  for (let s = 0; s < steps; s++) {
    const t = s * DT;
    // 1. Phase transitions due at t.
    while (phase !== "gen" && phase !== "idle" && phaseEnd <= t + 1e-9) {
      if (phase === "reshard1") { phase = "train"; block("train", t, T_UPDATE); }
      else if (phase === "train") {
        if (shared) { phase = "reshard2"; block("reshard", t, T_RESHARD); }
        else { phase = "send"; block("send", t, T_SEND); }
      } else {
        phase = shared ? "gen" : "idle";
        published++;
        if (cur) { cur.publish = t; cur = null; }
      }
    }
    // 2. The learner takes the first B finished trajectories.
    if ((phase === "gen" || phase === "idle") && buffer.length >= B) {
      const batch = buffer.splice(0, B);
      const k = published;
      let w = 0, lag = 0, off = 0, mx = 0;
      for (const tr of batch) {
        tr.update = upds.length;
        for (const sg of tr.segs) {
          if (sg.kind !== "decode") continue;
          const d = sg.t1 - sg.t0, l = k - sg.v;
          w += d; lag += d * l; if (l > 0) off += d; mx = Math.max(mx, l);
        }
      }
      const dur = batch.map((tr) => tr.end - tr.start).sort((a, b) => a - b);
      const slowest = batch.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
      cur = {
        k, start: t, publish: Infinity, trajs: batch.map((tr) => tr.id),
        lagMean: w ? lag / w : 0, lagMax: mx, off: w ? off / w : 0,
        slowest: slowest.id, maxRollout: dur[dur.length - 1], medRollout: (dur[B / 2 - 1] + dur[B / 2]) / 2,
      };
      upds.push(cur);
      if (shared) { phase = "reshard1"; block("reshard", t, T_RESHARD); }
      else { phase = "train"; block("train", t, T_UPDATE); }
    }
    // 3. Free slots start the next trajectories the bound admits.
    for (let b = 0; b < B; b++) {
      if (slots[b] || started >= (published + 1 + eta) * B || started >= MAXN) continue;
      const tr: Traj = { id: started, slot: b, start: t, end: Infinity, segs: [], update: -1, parts: { reset: 0, decode: 0, env: 0, verify: 0 } };
      trajs.push(tr);
      slots[b] = { tr, seg: 0, left: sp[started].segs[0].dur };
      started++;
    }
    // 4. Advance every slot one step. Decoding needs the pool in the rollout
    // layout; environment time runs regardless.
    const decodeOn = !shared || phase === "gen";
    let decoding = 0;
    for (let b = 0; b < B; b++) {
      const sl = slots[b];
      const idle = !sl && decodeOn;
      if (idle) openGap(b, t); else closeGap(b, t);
      if (!sl) continue;
      const spec = sp[sl.tr.id].segs[sl.seg];
      if (spec.kind === "decode" && !decodeOn) continue;
      const v = spec.kind === "decode" ? published : -1;
      const last = sl.tr.segs[sl.tr.segs.length - 1];
      if (last && last.kind === spec.kind && last.v === v && last.part === spec.part && Math.abs(last.t1 - t) < 1e-9) last.t1 = t + DT;
      else sl.tr.segs.push({ kind: spec.kind, t0: t, t1: t + DT, v, part: spec.part });
      const key = spec.part === "decode" ? "decode" : spec.part === "reset" ? "reset" : spec.part === "verify" ? "verify" : "env";
      sl.tr.parts[key] += DT;
      if (spec.kind === "decode") decoding++;
      sl.left -= DT;
      if (sl.left <= 1e-9) {
        sl.seg++;
        if (sl.seg >= sp[sl.tr.id].segs.length) { sl.tr.end = t + DT; buffer.push(sl.tr); slots[b] = null; }
        else sl.left = sp[sl.tr.id].segs[sl.seg].dur;
      }
    }
    if (!shared) { if (phase === "idle") openGap(B, t); else closeGap(B, t); }
    useful[s + 1] = useful[s] + decoding * (GPUS / B) * DT + (phase === "train" ? GPUS * DT : 0);
  }
  for (let r = 0; r <= B; r++) closeGap(r, H);
  return { placement, sync, trajs, blocks, gaps, upds, useful, gpus: shared ? GPUS : 2 * GPUS, sync_s: shared ? 2 * T_RESHARD : T_SEND };
}

type Key = `${Placement}-${Sync}`;
const COMBOS: Array<[Placement, Sync]> = [["shared", "sync"], ["shared", "async"], ["separate", "sync"], ["separate", "async"]];
const memo = new Map<string, Record<Key, Run>>();
export function runs(p: { slow: number; seed: number }): Record<Key, Run> {
  const key = `${p.slow}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const sp = trace(p.slow / 100, p.seed);
    hit = Object.fromEntries(COMBOS.map(([a, b]) => [`${a}-${b}`, simulate(sp, a, b)])) as Record<Key, Run>;
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// Counters at time t: published updates, the share of provisioned GPU time
// spent decoding or training, and the policy lag of the decoding trained so
// far (weighted by decoding time, a proxy for tokens).
export function metrics(r: Run, t: number) {
  const s = Math.max(0, Math.min(r.useful.length - 1, Math.round(t / DT)));
  const updates = r.upds.filter((u) => u.publish <= t + 1e-9).length;
  const busy = t > 0 ? r.useful[s] / (r.gpus * t) : 0;
  let w = 0, lag = 0, mx = 0, off = 0;
  const trained = r.upds.filter((u) => u.start <= t + 1e-9);
  for (const u of trained) {
    for (const id of u.trajs) {
      for (const sg of r.trajs[id].segs) {
        if (sg.kind !== "decode") continue;
        const d = sg.t1 - sg.t0, l = u.k - sg.v;
        w += d; lag += d * l; if (l > 0) off += d; mx = Math.max(mx, l);
      }
    }
  }
  return { updates, busy, lag: w ? lag / w : 0, lagMax: mx, off: w ? off / w : 0, trained: trained.length };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Rollout and learning over wall-clock time",
    sharedTitle: "Shared pool, 8 GPUs: rollout slots and the learner take turns",
    rolloutTitle: "Rollout pool, 8 GPUs: one row per rollout slot",
    learnerTitle: "Learner pool, 8 GPUs",
    lgLag0: "decoding, lag 0",
    lgLag1: "lag 1",
    lgLag2: "lag 2 or more",
    lgPending: "decoding, not yet trained",
    lgEnv: "reset, tool call, verifier",
    lgIdle: "idle, nothing to run",
    lgTrain: "update",
    lgSync: "reshard or send weights",
    x: "wall-clock time (s)",
    cursor: "{t} s",
    version: "v{k}",
    gridTitle: "At {t} s, all four combinations on the same trajectories",
    colSync: "synchronous",
    colAsync: "asynchronous",
    rowShared: "shared pool",
    rowSharedG: "8 GPUs",
    rowSep: "separate pools",
    rowSepG: "8 + 8 GPUs",
    cellUpd: "{n:update/updates}",
    cellBusy: "GPUs busy {p}",
    cellLag: "mean lag {l}",
    eqSync: "Update {n}: slowest rollout {max} s (median {med} s) + update {u} s + weight sync {s} s = {it} s for the iteration.",
    eqSlow: "Slowest rollout: reset {r} s + decoding {d} s + tools {e} s + verifier {v} s = {tot} s.",
    eqAsync: "Update {n} trains the first 8 finished trajectories: mean lag {lag} versions, {off} of their decoding sampled by an older version.",
    eqAsyncGap: "Rollout does not wait at a barrier; {gap} s between the last two published versions.",
    eqNone: "No update has started by {t} s: the first batch is still rolling out.",
    evSync: "Update {n} starts: its slowest rollout took {max} s, the median {med} s",
    evAsync: "Update {n} starts on the first 8 finished trajectories, mean lag {lag}",
    shared: "Shared pool",
    separate: "Separate pools",
    sync: "synchronous",
    async: "asynchronous",
    describe: "{cfg}, {mode}, at {t} s: {u} policy updates published, GPUs busy {b} of provisioned time, mean policy lag {l} versions. Updates by the same time: shared pool {a} synchronous and {b2} asynchronous, separate pools {c} and {d}.",
  },
  zh: {
    title: "按墙钟时间展开的 rollout 与学习",
    sharedTitle: "共享池，8 块 GPU：rollout 槽位与学习器轮流使用",
    rolloutTitle: "rollout 池，8 块 GPU：每行一个 rollout 槽位",
    learnerTitle: "学习器池，8 块 GPU",
    lgLag0: "解码，延迟 0",
    lgLag1: "延迟 1",
    lgLag2: "延迟 2 及以上",
    lgPending: "解码，尚未训练",
    lgEnv: "重置、工具调用、验证器",
    lgIdle: "空闲，无任务可运行",
    lgTrain: "更新",
    lgSync: "重新分片或传送权重",
    x: "墙钟时间（秒）",
    cursor: "{t} 秒",
    version: "v{k}",
    gridTitle: "{t} 秒时，同一批轨迹上的四种组合",
    colSync: "同步",
    colAsync: "异步",
    rowShared: "共享池",
    rowSharedG: "8 块 GPU",
    rowSep: "独立池",
    rowSepG: "8 + 8 块 GPU",
    cellUpd: "{n} 次更新",
    cellBusy: "GPU 忙碌 {p}",
    cellLag: "平均延迟 {l}",
    eqSync: "第 {n} 次更新：最慢 rollout {max} 秒（中位数 {med} 秒）+ 更新 {u} 秒 + 权重同步 {s} 秒 = 本轮迭代 {it} 秒。",
    eqSlow: "最慢的 rollout：重置 {r} 秒 + 解码 {d} 秒 + 工具 {e} 秒 + 验证器 {v} 秒 = {tot} 秒。",
    eqAsync: "第 {n} 次更新训练最先完成的 8 条轨迹：平均延迟 {lag} 个版本，其中 {off} 的解码由旧版本采样。",
    eqAsyncGap: "rollout 不在屏障前等待；最近两个版本相隔 {gap} 秒发布。",
    eqNone: "到 {t} 秒还没有开始更新：第一批轨迹仍在 rollout。",
    evSync: "第 {n} 次更新开始：最慢的 rollout 用了 {max} 秒，中位数 {med} 秒",
    evAsync: "第 {n} 次更新开始，训练最先完成的 8 条轨迹，平均延迟 {lag}",
    shared: "共享池",
    separate: "独立池",
    sync: "同步",
    async: "异步",
    describe: "{cfg}、{mode}更新，{t} 秒时：已发布 {u} 次策略更新，GPU 忙碌时间占已配置时间的 {b}，平均策略延迟 {l} 个版本。同一时刻的更新次数：共享池同步 {a} 次、异步 {b2} 次，独立池同步 {c} 次、异步 {d} 次。",
  },
};
type L = typeof labels.en;

type P = { placement: Placement; sync: Sync; slow: number; seed: number };

const LAG = [C.c1, C.c2, C.c5];
const lagColor = (l: number) => LAG[Math.min(2, Math.max(0, l))];
const secs = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? int(v) : fixed(v, 1));

function current(p: P): Run { return runs(p)[`${p.placement}-${p.sync}`]; }

// The last update that has started by t, if any.
function lastUpd(r: Run, t: number): Upd | null {
  let u: Upd | null = null;
  for (const x of r.upds) if (x.start <= t + 1e-9) u = x;
  return u;
}

function legendBlock(L: L, w: number, y0: number, uid: string): { svg: string; h: number } {
  const size = TYPE.body;
  const items: Array<[string, (x: number, y: number) => string]> = [
    [L.lgLag0, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: LAG[0] })],
    [L.lgLag1, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: LAG[1] })],
    [L.lgLag2, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: LAG[2] })],
    [L.lgPending, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: C.ink3, "fill-opacity": 0.55 })],
    [L.lgEnv, (x, y) => el("line", { x1: x, x2: x + 14, y1: y, y2: y, stroke: C.ink3, "stroke-width": 1.5 })],
    [L.lgIdle, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: `url(#${uid}-idle)` })],
    [L.lgTrain, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: C.c3 })],
    [L.lgSync, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: C.c4 })],
  ];
  const parts: string[] = [];
  let lx = 0, ly = y0 + 12;
  for (const [name, sw] of items) {
    const iw = 20 + textWidth(name, size);
    if (lx > 0 && lx + iw > w) { lx = 0; ly += 19; }
    parts.push(sw(lx, ly - 4), text(lx + 20, ly, name, { "font-size": size }));
    lx += iw + 14;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: ly - y0 + 8 };
}

// One pool's slot rows up to time t: environment time as a thin line,
// decoding as a bar colored by its lag once trained, idle slots hatched.
function slotRows(r: Run, x: (v: number) => number, t: number, y0: number, rowH: number, uid: string): string {
  const parts: string[] = [];
  const barH = rowH - 3;
  const clip = (a: number, b: number) => [Math.min(a, t), Math.min(b, t)] as const;
  for (const gp of r.gaps) {
    if (gp.row < 0) continue;
    const [a, b] = clip(gp.t0, gp.t1);
    if (b > a) parts.push(el("rect", { x: x(a), y: y0 + gp.row * rowH + 1, width: x(b) - x(a), height: barH, fill: `url(#${uid}-idle)` }));
  }
  for (const tr of r.trajs) {
    if (tr.start > t) continue;
    const yy = y0 + tr.slot * rowH + 1;
    const u = tr.update >= 0 ? r.upds[tr.update] : null;
    const trained = u && u.start <= t + 1e-9;
    for (const sg of tr.segs) {
      const [a, b] = clip(sg.t0, sg.t1);
      if (b <= a) continue;
      if (sg.kind === "env") {
        parts.push(el("line", { x1: x(a), x2: x(b), y1: yy + barH / 2, y2: yy + barH / 2, stroke: C.ink3, "stroke-width": 1.25 }));
      } else if (trained) {
        parts.push(el("rect", { x: x(a), y: yy, width: Math.max(0.8, x(b) - x(a) - 0.3), height: barH, fill: lagColor(u!.k - sg.v) }));
      } else {
        parts.push(el("rect", { x: x(a), y: yy, width: Math.max(0.8, x(b) - x(a) - 0.3), height: barH, fill: C.ink3, "fill-opacity": 0.55 }));
      }
    }
    // A tick where each trajectory starts, so back-to-back trajectories read apart.
    parts.push(el("line", { x1: x(tr.start), x2: x(tr.start), y1: yy - 0.5, y2: yy + barH + 0.5, stroke: C.ink2, "stroke-width": 1 }));
  }
  return g({ class: "fig-slots" }, ...parts);
}

// Learner work (update, reshard, weight transfer) as blocks over [y0, y0 + h],
// labeled with the version an update produces when it fits.
function learnerBlocks(r: Run, x: (v: number) => number, t: number, y0: number, h: number, L: L): string {
  const parts: string[] = [];
  for (const b of r.blocks) {
    if (b.t0 >= t) continue;
    const t1 = Math.min(b.t1, t);
    const fill = b.kind === "train" ? C.c3 : C.c4;
    parts.push(el("rect", { x: x(b.t0), y: y0, width: Math.max(0.8, x(t1) - x(b.t0)), height: h, fill }));
    if (b.kind === "train" && b.t1 <= t) {
      const lb = tpl(L.version, { k: b.k + 1 });
      if (textWidth(lb, TYPE.body) + 4 <= x(t1) - x(b.t0)) parts.push(text((x(b.t0) + x(t1)) / 2, y0 + h / 2 + 4, lb, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    }
  }
  return g({ class: "fig-learner" }, ...parts);
}

function grid(p: P, t: number, w: number, y0: number, L: L, lang: Lang): { svg: string; h: number } {
  const all = runs(p);
  const size = TYPE.body;
  const parts: string[] = [];
  const title = tpl(L.gridTitle, { t: secs(t) });
  let y = y0;
  for (const ln of wrap(title, TYPE.label, w)) { parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  y += 4;
  // Phone: each row's header takes its own line above the two cells.
  const narrow = w < 480;
  const headW = narrow ? 0 : Math.max(textWidth(L.rowShared, size), textWidth(L.rowSep, size), textWidth(L.rowSepG, size)) + 12;
  const cellW = (w - headW - 6) / 2;
  const xs = [headW, headW + cellW + 6];
  const cols: Array<[Sync, string]> = [["sync", L.colSync], ["async", L.colAsync]];
  cols.forEach(([s, name], i) => {
    const on = s === p.sync;
    parts.push(el("rect", { x: xs[i], y, width: cellW, height: 20, fill: "transparent", "data-fig-set": `sync=${s}`, class: "fig-hit" }));
    parts.push(text(xs[i] + 8, y + 14, name, { "font-size": size, class: on ? "fig-t-strong" : "fig-t-muted" }));
  });
  y += 22;
  const cellH = 3 * 17 + 10;
  const rows: Array<[Placement, string, string]> = [["shared", L.rowShared, L.rowSharedG], ["separate", L.rowSep, L.rowSepG]];
  for (const [pl, name, gpus] of rows) {
    const on = pl === p.placement;
    if (narrow) {
      parts.push(el("rect", { x: 0, y, width: w, height: 20, fill: "transparent", "data-fig-set": `placement=${pl}`, class: "fig-hit" }));
      parts.push(text(0, y + 14, name, { "font-size": size, class: on ? "fig-t-strong" : "fig-t-muted" }));
      parts.push(text(textWidth(name, size) + 8, y + 14, gpus, { "font-size": size, class: "fig-t-muted fig-t-num" }));
      y += 21;
    } else {
      parts.push(el("rect", { x: 0, y, width: headW - 4, height: cellH, fill: "transparent", "data-fig-set": `placement=${pl}`, class: "fig-hit" }));
      parts.push(text(0, y + 17, name, { "font-size": size, class: on ? "fig-t-strong" : "fig-t-muted" }));
      parts.push(text(0, y + 34, gpus, { "font-size": size, class: "fig-t-muted fig-t-num" }));
    }
    cols.forEach(([s], i) => {
      const m = metrics(all[`${pl}-${s}`], t);
      const sel = on && s === p.sync;
      parts.push(el("rect", { x: xs[i], y, width: cellW, height: cellH, rx: 4, fill: C.panel, stroke: sel ? C.ink : undefined, "stroke-width": sel ? 1.5 : undefined }));
      const lines = [
        tpl(L.cellUpd, { n: m.updates }),
        tpl(L.cellBusy, { p: pct(m.busy) }),
        tpl(L.cellLag, { l: fixed(m.lag, 2) }),
      ];
      lines.forEach((ln, k) => parts.push(text(xs[i] + 8, y + 17 + k * 17, ln, { "font-size": size, class: `fig-t-num${sel ? " fig-t-strong" : ""}` })));
    });
    y += cellH + 6;
  }
  void lang;
  return { svg: g({ class: "fig-grid" }, ...parts), h: y - y0 };
}

function equation(p: P, t: number, w: number, y0: number, L: L): { svg: string; h: number } {
  const r = current(p);
  const u = lastUpd(r, t);
  const lines: string[] = [];
  if (!u) lines.push(tpl(L.eqNone, { t: secs(t) }));
  else if (p.sync === "sync") {
    const tr = r.trajs[u.slowest];
    lines.push(tpl(L.eqSync, { n: u.k + 1, max: secs(u.maxRollout), med: secs(u.medRollout), u: T_UPDATE, s: r.sync_s, it: secs(u.maxRollout + T_UPDATE + r.sync_s) }));
    lines.push(tpl(L.eqSlow, { r: secs(tr.parts.reset), d: secs(tr.parts.decode), e: secs(tr.parts.env), v: secs(tr.parts.verify), tot: secs(tr.end - tr.start) }));
  } else {
    lines.push(tpl(L.eqAsync, { n: u.k + 1, lag: fixed(u.lagMean, 2), off: pct(u.off) }));
    const pubs = r.upds.filter((x) => x.publish <= t + 1e-9).map((x) => x.publish);
    if (pubs.length >= 2) lines.push(tpl(L.eqAsyncGap, { gap: secs(pubs[pubs.length - 1] - pubs[pubs.length - 2]) }));
  }
  const parts: string[] = [];
  let y = y0;
  for (const s of lines) for (const ln of wrap(s, TYPE.body, w - 6)) { parts.push(text(0, y + 13, ln, { "font-size": TYPE.body, class: "fig-t-num" })); y += 17; }
  return { svg: g({ class: "fig-equation" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const all = runs(p);
  const t = Math.min(st.t, H);
  const m = metrics(all[`${p.placement}-${p.sync}`], t);
  const n = (k: Key) => metrics(all[k], t).updates;
  return tpl(L.describe, {
    cfg: p.placement === "shared" ? L.shared : L.separate, mode: p.sync === "sync" ? L.sync : L.async, t: secs(t),
    u: m.updates, b: pct(m.busy), l: fixed(m.lag, 2),
    a: n("shared-sync"), b2: n("shared-async"), c: n("separate-sync"), d: n("separate-async"),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = current(p);
  const t = Math.min(st.t, H);
  const x = linear([0, H], [0, w - 2]);
  const rowH = narrow ? 11 : 12;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-idle`, C.ink3, 4, 1))];
  const lg = legendBlock(L, w, 0, st.uid);
  parts.push(lg.svg);
  let y = lg.h + 10;
  const cursorY = y + 12;
  y += 20;
  const spans: Array<[number, number]> = [];
  const title = (s: string) => {
    for (const ln of wrap(s, TYPE.body, w)) { parts.push(text(0, y + 12, ln, { "font-size": TYPE.body, class: "fig-t-strong" })); y += 17; }
    y += 3;
  };
  if (p.placement === "shared") {
    title(L.sharedTitle);
    const top = y;
    parts.push(slotRows(r, x, t, top, rowH, st.uid));
    parts.push(learnerBlocks(r, x, t, top, B * rowH - 2, L));
    spans.push([top - 2, top + B * rowH]);
    y = top + B * rowH + 8;
  } else {
    title(L.rolloutTitle);
    const top = y;
    parts.push(slotRows(r, x, t, top, rowH, st.uid));
    spans.push([top - 2, top + B * rowH]);
    y = top + B * rowH + 10;
    title(L.learnerTitle);
    const lt = y;
    const lh = narrow ? 16 : 18;
    for (const gp of r.gaps) {
      if (gp.row >= 0) continue;
      const a = Math.min(gp.t0, t), b = Math.min(gp.t1, t);
      if (b > a) parts.push(el("rect", { x: x(a), y: lt, width: x(b) - x(a), height: lh, fill: `url(#${st.uid}-idle)` }));
    }
    parts.push(learnerBlocks(r, x, t, lt, lh, L));
    spans.push([lt - 2, lt + lh + 2]);
    y = lt + lh + 8;
  }
  // Cursor through the pools, and the shared time axis.
  const cx = x(t);
  for (const [a, b] of spans) parts.push(el("line", { x1: cx, x2: cx, y1: a, y2: b, stroke: C.ink, "stroke-width": 1.25 }));
  const cl = tpl(L.cursor, { t: secs(t) });
  const clw = textWidth(cl, TYPE.body);
  parts.push(text(Math.min(Math.max(cx, clw / 2), w - clw / 2), cursorY, cl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  parts.push(axis({ scale: x, orient: "bottom", at: y, ticks: x.ticks(narrow ? 4 : 7), format: (v) => String(v), title: L.x, size: TYPE.body }));
  y += axisHeight(true, TYPE.body) + 14;
  const gr = grid(p, t, w, y, L, lang);
  parts.push(gr.svg);
  y += gr.h + 6;
  const eq = equation(p, t, w, y, L);
  parts.push(eq.svg);
  y += eq.h + 4;
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "rl-rollout-schedule",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    placement: {
      kind: "choice", label: { en: "Placement", zh: "资源布局" }, default: "separate",
      options: [
        { value: "shared", label: { en: "Shared pool", zh: "共享池" } },
        { value: "separate", label: { en: "Separate pools", zh: "独立池" } },
      ],
    },
    sync: {
      kind: "choice", label: { en: "Updates", zh: "更新方式" }, default: "sync",
      options: [
        { value: "sync", label: { en: "Synchronous", zh: "同步" } },
        { value: "async", label: { en: "Asynchronous", zh: "异步" } },
      ],
    },
    slow: { kind: "range", label: { en: "Share of slow tool calls", zh: "慢工具调用占比" }, unit: { en: "%", zh: "%" }, min: 0, max: 30, step: 5, default: 10 },
    seed: { kind: "range", label: { en: "Trace seed", zh: "轨迹种子" }, min: 1, max: 999, step: 1, default: 1, control: false },
  },
  timeline: {
    rate: 30, // simulated seconds per second of playback
    discrete: true,
    duration: () => H,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const r = current(p);
      return r.upds.map((u) => ({
        t: Math.min(H, Math.ceil(u.start)),
        label: p.sync === "sync"
          ? tpl(L.evSync, { n: u.k + 1, max: secs(u.maxRollout), med: secs(u.medRollout) })
          : tpl(L.evAsync, { n: u.k + 1, lag: fixed(u.lagMean, 2) }),
      }));
    },
    // The end of the span: the rows are cumulative, so every barrier, update,
    // and lag color is drawn and the grid covers the whole run.
    poster: () => H,
  },
  render,
  describe,
});
