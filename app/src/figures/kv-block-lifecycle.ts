// The life of KV blocks under the reserve, execute, and commit protocol, with
// reference counts on a shared prefix.
//
// A small pool of fixed-size blocks serves five illustrative requests. R1, R2
// and R3 begin with the same 8-token system prompt (two full blocks); R4 and
// R5 do not. Each model iteration runs the protocol of the chapter:
//
// 1. Plan. Running requests decode one position; waiting requests are
//    admitted in arrival order. Request i needs
//      Δq_i = ⌈(T_i + s_i) / B⌉ − ⌈T_i / B⌉
//    new blocks, and the plan is feasible while Σ Δq_i ≤ q_free. A request
//    that does not fit is deferred. When the running decodes alone do not
//    fit, the pressure policy first evicts cached prefix blocks that no live
//    request holds, then preempts the most recently admitted request (its
//    references are dropped and it is recomputed when admitted again).
// 2. Reserve. The plan's new blocks move from free to reserved in one step.
//    A request whose prompt starts with the cached system prompt takes a
//    reference on the two cached blocks instead of reserving its own.
// 3. Execute, then commit or roll back. On success every reserved block is
//    committed with one reference, held by its request. The first commit of
//    the system prompt also registers its two blocks in the prefix index,
//    which holds a reference of its own. An injected execution failure rolls
//    back the whole plan: reserved blocks return to free and references taken
//    by the plan are dropped. An injected cancellation rolls back one
//    request's part of the plan before the rest commits.
// 4. Release. A finished request drops its references; a block whose count
//    reaches zero returns to the free list.
//
// Every timeline position is one of these transitions, so the conservation
// check q_free + q_reserved + q_committed = q_capacity can be read before and
// after each one. The free list is FIFO, so reused blocks are scattered.
// State is a pure function of the parameters and the position: the run is
// simulated once per parameter set (memoized) and render reads position t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export const B = 4; // tokens per block, small so that decode crosses block boundaries within a few iterations
const SYS = 8; // shared system prompt, two full blocks
const SYS_BLOCKS = SYS / B;
const INDEX = 6; // holder id of the prefix index (requests are 1..5)

export type Fault = "none" | "fail" | "cancel";
export type Order = "r1" | "r2";

interface ReqSpec { id: number; arrival: number; sys: boolean; prompt: number; out: number }

// Illustrative workload. `order` swaps the output lengths of R1 and R2, so the
// two holders of the shared prefix finish in either order.
export function workload(order: Order): ReqSpec[] {
  return [
    { id: 1, arrival: 1, sys: true, prompt: SYS + 3, out: order === "r1" ? 3 : 8 },
    { id: 2, arrival: 2, sys: true, prompt: SYS + 6, out: order === "r1" ? 6 : 2 },
    { id: 3, arrival: 3, sys: true, prompt: SYS + 1, out: 5 },
    { id: 4, arrival: 4, sys: false, prompt: 10, out: 6 },
    { id: 5, arrival: 9, sys: false, prompt: 26, out: 4 },
  ];
}
const REQUESTS = 5;
const FAIL_AT = 2; // iteration whose execution fails when fault = "fail"
const CANCEL = 3; // request cancelled between reserve and commit when fault = "cancel"

export const St = { Free: 0, Reserved: 1, Committed: 2 } as const;
export const RS = { Future: 0, Waiting: 1, Running: 2, Finished: 3, Cancelled: 4 } as const;

export type Kind = "reserve" | "commit" | "rollback" | "cancel" | "release" | "evict" | "preempt";

// One fragment of a transition's description, formatted per language.
export type Msg =
  | { k: "reserve"; n: number; need: number; free: number }
  | { k: "hit"; reqs: number[]; blocks: number[]; r: number }
  | { k: "defer"; req: number; need: number; free: number }
  | { k: "commit"; n: number }
  | { k: "commitNone" }
  | { k: "register"; blocks: number[]; r: number }
  | { k: "fail"; n: number; refs: number }
  | { k: "cancel"; req: number; n: number; refs: number }
  | { k: "finish"; req: number; freed: number[]; kept: number[] }
  | { k: "evict"; blocks: number[]; need: number }
  | { k: "preempt"; req: number; freed: number[]; kept: number[] };

export interface ReqView {
  status: number;
  T: number; // retained tokens with committed KV
  table: number[]; // committed block table: logical j -> physical block
  s: number; // positions scheduled in the current plan (0 if not in it)
  dq: number; // Δq_i of the current plan
  inPlan: boolean;
  admitted: boolean; // admitted by the plan in flight, not yet committed
  preempted: boolean;
}

export interface Frame {
  it: number; // model iteration
  kind: Kind;
  state: Uint8Array; // per block: St
  holders: Uint8Array; // per block: bit (id − 1) for request id, bit 5 for the prefix index
  resv: Uint8Array; // per block: request id holding a reservation, 0 if none
  fill: Uint8Array; // per block: tokens of KV a committed block holds
  changed: Uint8Array; // per block: 1 if this transition changed its state or count
  reqs: ReqView[];
  free: number;
  reserved: number;
  committed: number;
  d: [number, number, number]; // change of free, reserved, committed in this transition
  planNeed: number; // Σ Δq_i of the current plan
  planFree: number; // q_free when the plan was checked
  msgs: Msg[];
}

export interface Run { frames: Frame[]; N: number }

const popcount = (x: number) => { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
const bit = (id: number) => 1 << (id - 1);
const blocksFor = (tokens: number) => Math.ceil(tokens / B);

interface Live {
  spec: ReqSpec;
  status: number;
  T: number;
  generated: number;
  table: number[]; // committed blocks
  pending: number[]; // reserved blocks, in logical order after `table`
  hit: boolean; // took prefix references in the current plan
  s: number;
  dq: number;
  inPlan: boolean;
  admittedAt: number;
  preempted: boolean;
}

export function simulate(fault: Fault, order: Order, N: number): Run {
  const specs = workload(order);
  const state = new Uint8Array(N);
  const holders = new Uint8Array(N);
  const resv = new Uint8Array(N);
  const fill = new Uint8Array(N);
  const free: number[] = [];
  for (let i = 0; i < N; i++) free.push(i);
  const lives: Live[] = specs.map((spec) => ({ spec, status: RS.Future, T: 0, generated: 0, table: [], pending: [], hit: false, s: 0, dq: 0, inPlan: false, admittedAt: -1, preempted: false }));
  const waiting: Live[] = [];
  const running: Live[] = [];
  let prefix: number[] = []; // the index's blocks for the system prompt, empty if not cached
  const frames: Frame[] = [];
  let failed = false;
  let planNeed = 0, planFree = 0;
  let last = [N, 0, 0];

  const counts = () => {
    let f = 0, r = 0, c = 0;
    for (let i = 0; i < N; i++) { if (state[i] === St.Free) f++; else if (state[i] === St.Reserved) r++; else c++; }
    return [f, r, c];
  };
  const snapshot = (it: number, kind: Kind, changed: Uint8Array, msgs: Msg[]) => {
    const [f, r, c] = counts();
    frames.push({
      it, kind, state: state.slice(), holders: holders.slice(), resv: resv.slice(), fill: fill.slice(), changed,
      reqs: lives.map((l) => ({ status: l.status, T: l.T, table: [...l.table], s: l.s, dq: l.dq, inPlan: l.inPlan, admitted: l.inPlan && l.status === RS.Waiting && kind !== "rollback", preempted: l.preempted })),
      free: f, reserved: r, committed: c, d: [f - last[0], r - last[1], c - last[2]],
      planNeed, planFree, msgs,
    });
    last = [f, r, c];
  };
  // Drop one holder's reference on block b; a block with no holder returns to the free list.
  const drop = (b: number, holder: number, changed: Uint8Array): boolean => {
    holders[b] &= ~bit(holder);
    changed[b] = 1;
    if (holders[b] === 0) { state[b] = St.Free; fill[b] = 0; free.push(b); return true; }
    return false;
  };
  const releaseAll = (l: Live, changed: Uint8Array) => {
    const freed: number[] = [], kept: number[] = [];
    for (const b of l.table) (drop(b, l.spec.id, changed) ? freed : kept).push(b);
    l.table = [];
    l.T = 0;
    return { freed, kept };
  };
  // The cached prefix can be evicted when the index holds its only references
  // and no request in the plan being built is about to reuse it.
  const evictable = (planned: Live[]) => prefix.length > 0 && prefix.every((b) => holders[b] === bit(INDEX)) && !planned.some((l) => l.hit);
  const evictPrefix = (it: number, need: number) => {
    planNeed = need;
    planFree = free.length;
    const changed = new Uint8Array(N);
    const blocks = [...prefix];
    for (const b of blocks) drop(b, INDEX, changed);
    prefix = [];
    snapshot(it, "evict", changed, [{ k: "evict", blocks, need }]);
  };
  const fillFor = (l: Live) => {
    const all = [...l.table, ...l.pending];
    all.forEach((b, j) => {
      if (l.spec.sys && j < SYS_BLOCKS && l.table.includes(b) && prefix.includes(b)) return; // shared, already full
      fill[b] = Math.min(B, Math.max(0, l.T - j * B));
    });
  };

  for (let it = 1; it <= 60; it++) {
    for (const l of lives) if (l.status === RS.Future && l.spec.arrival <= it) { l.status = RS.Waiting; waiting.push(l); }
    if (!running.length && !waiting.length) {
      if (lives.every((l) => l.status === RS.Finished || l.status === RS.Cancelled)) break;
      continue;
    }
    for (const l of lives) { l.s = 0; l.dq = 0; l.inPlan = false; l.hit = false; }

    // 1. Plan the running decodes; apply the pressure policy while they do not fit.
    for (;;) {
      for (const l of running) { l.s = 1; l.dq = blocksFor(l.T + 1) - blocksFor(l.T); l.inPlan = true; }
      const need = running.reduce((a, l) => a + l.dq, 0);
      if (need <= free.length) break;
      if (evictable([])) { evictPrefix(it, need); continue; }
      planNeed = need;
      planFree = free.length;
      const victim = running.pop()!;
      const changed = new Uint8Array(N);
      const { freed, kept } = releaseAll(victim, changed);
      victim.status = RS.Waiting; victim.preempted = true; victim.s = 0; victim.dq = 0; victim.inPlan = false;
      const at = waiting.findIndex((w) => w.spec.arrival > victim.spec.arrival);
      waiting.splice(at < 0 ? waiting.length : at, 0, victim);
      snapshot(it, "preempt", changed, [{ k: "preempt", req: victim.spec.id, freed, kept }]);
    }
    let need = running.reduce((a, l) => a + l.dq, 0);

    // Admission in arrival order while the plan still fits.
    const msgs: Msg[] = [];
    const admitted: Live[] = [];
    while (waiting.length) {
      const l = waiting[0];
      const hit = l.spec.sys && prefix.length === SYS_BLOCKS;
      const T0 = hit ? SYS : 0;
      const target = l.spec.prompt + l.generated; // recompute includes generated tokens
      const dq = blocksFor(target) - blocksFor(T0);
      if (need + dq > free.length) {
        // Cached prefix state with no live owner is evicted before a request is deferred,
        // unless this request would reuse it.
        if (!l.spec.sys && evictable(admitted) && need + dq <= free.length + prefix.length) {
          evictPrefix(it, need + dq);
          continue;
        }
        msgs.push({ k: "defer", req: l.spec.id, need: dq, free: free.length - need });
        break;
      }
      waiting.shift();
      l.hit = hit; l.T = T0; l.s = target - T0; l.dq = dq; l.inPlan = true;
      if (hit) l.table = [...prefix];
      need += dq;
      admitted.push(l);
    }
    planNeed = need;
    planFree = free.length;

    // 2. Reserve.
    const inPlan = [...running, ...admitted];
    const hits = admitted.filter((l) => l.hit);
    if (need > 0 || hits.length) {
      const changed = new Uint8Array(N);
      for (const l of inPlan) {
        for (let k = 0; k < l.dq; k++) {
          const b = free.shift()!;
          state[b] = St.Reserved; resv[b] = l.spec.id; changed[b] = 1;
          l.pending.push(b);
        }
      }
      for (const l of hits) for (const b of prefix) { holders[b] |= bit(l.spec.id); changed[b] = 1; }
      const m: Msg[] = [{ k: "reserve", n: need, need, free: planFree }];
      if (hits.length) m.push({ k: "hit", reqs: hits.map((l) => l.spec.id), blocks: [...prefix], r: popcount(holders[prefix[0]]) });
      snapshot(it, "reserve", changed, [...m, ...msgs]);
      msgs.length = 0;
    }

    // 3. Execute: roll back on an injected failure, otherwise commit.
    if (fault === "fail" && it === FAIL_AT && !failed && (need > 0 || hits.length)) {
      failed = true;
      const changed = new Uint8Array(N);
      let refs = 0;
      for (const l of inPlan) {
        for (const b of l.pending) { state[b] = St.Free; resv[b] = 0; fill[b] = 0; free.push(b); changed[b] = 1; }
        l.pending = [];
        if (l.hit) { for (const b of prefix) { holders[b] &= ~bit(l.spec.id); changed[b] = 1; refs++; } l.table = []; l.T = 0; }
      }
      // Admitted requests return to the head of the queue; running ones keep their state.
      for (const l of [...admitted].reverse()) waiting.unshift(l);
      snapshot(it, "rollback", changed, [{ k: "fail", n: need, refs }]);
      continue;
    }
    if (fault === "cancel") {
      const l = admitted.find((a) => a.spec.id === CANCEL);
      if (l) {
        const changed = new Uint8Array(N);
        const n = l.pending.length;
        for (const b of l.pending) { state[b] = St.Free; resv[b] = 0; fill[b] = 0; free.push(b); changed[b] = 1; }
        l.pending = [];
        let refs = 0;
        if (l.hit) { for (const b of prefix) { holders[b] &= ~bit(l.spec.id); changed[b] = 1; refs++; } }
        l.table = []; l.T = 0; l.s = 0; l.dq = 0; l.inPlan = false; l.status = RS.Cancelled;
        admitted.splice(admitted.indexOf(l), 1);
        inPlan.splice(inPlan.indexOf(l), 1);
        snapshot(it, "cancel", changed, [{ k: "cancel", req: CANCEL, n, refs }]);
      }
    }
    {
      const changed = new Uint8Array(N);
      let n = 0;
      for (const l of inPlan) {
        for (const b of l.pending) { state[b] = St.Committed; resv[b] = 0; holders[b] = bit(l.spec.id); changed[b] = 1; n++; }
        l.table = [...l.table, ...l.pending];
        l.pending = [];
        l.T += l.s;
        l.generated++;
        fillFor(l);
      }
      for (const l of admitted) { l.status = RS.Running; l.admittedAt = it; running.push(l); }
      const m: Msg[] = [n ? { k: "commit", n } : { k: "commitNone" }];
      // The first committed copy of the system prompt enters the prefix index.
      if (!prefix.length) {
        const owner = inPlan.find((l) => l.spec.sys && l.T >= SYS);
        if (owner) {
          prefix = owner.table.slice(0, SYS_BLOCKS);
          for (const b of prefix) { holders[b] |= bit(INDEX); changed[b] = 1; }
          m.push({ k: "register", blocks: [...prefix], r: popcount(holders[prefix[0]]) });
        }
      }
      snapshot(it, "commit", changed, [...m, ...msgs]);
    }

    // 4. Release finished requests.
    const done = running.filter((l) => l.generated >= l.spec.out);
    if (done.length) {
      const changed = new Uint8Array(N);
      const m: Msg[] = [];
      for (const l of done) {
        const { freed, kept } = releaseAll(l, changed);
        l.status = RS.Finished; l.inPlan = false;
        running.splice(running.indexOf(l), 1);
        m.push({ k: "finish", req: l.spec.id, freed, kept });
      }
      snapshot(it, "release", changed, m);
    }
  }
  return { frames, N };
}

const memo = new Map<string, Run>();
export function run(p: { fault: Fault; order: Order; capacity: number }): Run {
  const key = `${p.fault}|${p.order}|${p.capacity}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(p.fault, p.order, p.capacity);
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "KV block lifecycle and reference counts",
    iteration: "Iteration {it}",
    chipPressure: "pressure policy",
    chipReserve: "reserve",
    chipExecute: "execute",
    chipCommit: "commit",
    chipRollback: "roll back",
    chipRelease: "release",
    pool: "KV block pool: {n} blocks of {b} tokens",
    free: "free",
    reserved: "reserved",
    held: "committed: KV held",
    slots: "committed: empty slots",
    changed: "changed in this step",
    rowBlock: "block",
    rowState: "state",
    rowIndex: "index",
    rowRefs: "refs",
    colStatus: "status",
    stFuture: "not arrived",
    stWaiting: "waiting",
    stAdmitted: "admitted",
    stRequeued: "requeued",
    stRunning: "running",
    stFinished: "finished",
    stCancelled: "cancelled",
    accounting: "Pool accounting",
    conserve: "free {f} + reserved {r} + committed {c} = {n} blocks",
    delta: "This step: {parts}",
    noDelta: "This step: no block changes state",
    dFree: "free {v}",
    dReserved: "reserved {v}",
    dCommitted: "committed {v}",
    plan: "Plan: Σ Δq_[i] = {need} {op} q_[free] = {free}",
    share: "Resident requests: Σ q_[i] = {e} table entries on q_[live] = |∪\u00a0B_[i]| = {u} blocks",
    mReserve: "iteration {it}: the plan needs Σ Δq = {need} of {free} free blocks, so {need:block moves/blocks move} to reserved",
    mReserveNone: "iteration {it}: the plan needs no new blocks",
    mHitOne: "{reqs} reuses the cached prefix and references blocks {bl} (r = {r})",
    mHitMany: "{reqs} reuse the cached prefix and reference blocks {bl} (r = {r})",
    mDefer: "R{i} waits: it needs {need:block/blocks} and {free} would remain",
    mCommit: "iteration {it} succeeds: {n:reserved block is/reserved blocks are} committed",
    mCommitNone: "iteration {it} succeeds: each decode step fits in a block already held, so nothing was reserved",
    mRegister: "the prefix index registers blocks {bl} (r = {r})",
    mFail: "iteration {it} fails: {n:reserved block returns/reserved blocks return} to free and committed blocks stay as they were",
    mFailRefs: "iteration {it} fails: {n:reserved block returns/reserved blocks return} to free, {refs} prefix references are dropped, and committed blocks stay as they were",
    mCancel: "R{i} is cancelled before commit: its {n:reserved block returns/reserved blocks return} to free",
    mCancelRefs: "R{i} is cancelled before commit: its {n:reserved block returns/reserved blocks return} to free and its {refs} prefix references are dropped",
    mFinish: "R{i} finishes: blocks {freed} reach r = 0 and return to free",
    mFinishKept: "R{i} finishes: blocks {freed} reach r = 0 and return to free, blocks {kept} stay committed (r = {r})",
    mEvict: "iteration {it}: {need} blocks needed, {free} free; no live request holds the cached prefix, so the index drops blocks {bl} and they return to free",
    mPreempt: "iteration {it}: the running decodes need {need} blocks, {free} free; R{i} is preempted for later recompute and blocks {freed} return to free",
    mPreemptKept: "iteration {it}: the running decodes need {need} blocks, {free} free; R{i} is preempted for later recompute, blocks {freed} return to free, blocks {kept} stay committed (r = {r})",
    and: " and ",
    sep: "; ",
    describe: "Iteration {it}, {phase}: free {f} + reserved {r} + committed {c} = {n} blocks. {what}.",
  },
  zh: {
    title: "KV 块的生命周期与引用计数",
    iteration: "第 {it} 轮迭代",
    chipPressure: "压力策略",
    chipReserve: "预留",
    chipExecute: "执行",
    chipCommit: "提交",
    chipRollback: "回滚",
    chipRelease: "释放",
    pool: "KV 块池：{n} 个块，每块 {b} 个词元",
    free: "空闲",
    reserved: "已预留",
    held: "已提交：存有 KV",
    slots: "已提交：空槽位",
    changed: "本步有变化",
    rowBlock: "块",
    rowState: "状态",
    rowIndex: "索引",
    rowRefs: "引用数",
    colStatus: "状态",
    stFuture: "未到达",
    stWaiting: "排队",
    stAdmitted: "已准入",
    stRequeued: "重新排队",
    stRunning: "运行",
    stFinished: "完成",
    stCancelled: "已取消",
    accounting: "块池记账",
    conserve: "空闲 {f} + 预留 {r} + 已提交 {c} = {n} 个块",
    delta: "本步变化：{parts}",
    noDelta: "本步没有块改变状态",
    dFree: "空闲 {v}",
    dReserved: "预留 {v}",
    dCommitted: "已提交 {v}",
    plan: "计划：Σ Δq_[i] = {need} {op} q_[free] = {free}",
    share: "常驻请求：Σ q_[i] = {e} 个块表项，q_[live] = |∪\u00a0B_[i]| = {u} 个块",
    mReserve: "第 {it} 轮计划共需 Σ Δq = {need} 个块，空闲 {free} 个，这 {need} 个块转为预留",
    mReserveNone: "第 {it} 轮计划不需要新块",
    mHitOne: "{reqs} 命中缓存前缀，引用块 {bl}（r = {r}）",
    mHitMany: "{reqs} 命中缓存前缀，引用块 {bl}（r = {r}）",
    mDefer: "R{i} 继续排队：它需要 {need} 个块，计划之外只剩 {free} 个",
    mCommit: "第 {it} 轮执行成功，{n} 个预留块转为已提交",
    mCommitNone: "第 {it} 轮执行成功，各解码步都落在已持有的块内，无需预留",
    mRegister: "前缀索引登记块 {bl}（r = {r}）",
    mFail: "第 {it} 轮执行失败，{n} 个预留块回到空闲，已提交的块保持不变",
    mFailRefs: "第 {it} 轮执行失败，{n} 个预留块回到空闲，撤销 {refs} 个前缀引用，已提交的块保持不变",
    mCancel: "R{i} 在提交前被取消，它预留的 {n} 个块回到空闲",
    mCancelRefs: "R{i} 在提交前被取消，它预留的 {n} 个块回到空闲，{refs} 个前缀引用随之撤销",
    mFinish: "R{i} 完成，块 {freed} 的引用数降为 0，回到空闲",
    mFinishKept: "R{i} 完成，块 {freed} 的引用数降为 0，回到空闲；块 {kept} 仍是已提交（r = {r}）",
    mEvict: "第 {it} 轮需要 {need} 个块，空闲 {free} 个；缓存前缀已没有活跃请求持有，索引释放块 {bl}，它们回到空闲",
    mPreempt: "第 {it} 轮运行中的解码需要 {need} 个块，空闲 {free} 个；R{i} 被抢占，稍后重算，块 {freed} 回到空闲",
    mPreemptKept: "第 {it} 轮运行中的解码需要 {need} 个块，空闲 {free} 个；R{i} 被抢占，稍后重算，块 {freed} 回到空闲，块 {kept} 仍是已提交（r = {r}）",
    and: "和",
    sep: "；",
    describe: "第 {it} 轮迭代，{phase}：空闲 {f} + 预留 {r} + 已提交 {c} = {n} 个块。{what}。",
  },
};
type L = typeof labels.en;

type P = { fault: Fault; order: Order; capacity: number };

const list = (xs: number[], lang: Lang) => xs.join(lang === "zh" ? "、" : ", ");

// Text with the chapter's notation: a Latin letter before _[sub] is set in
// italic with a lowered subscript (q_[free], B_[i]); everything else is plain.
// Square brackets keep the marker clear of tpl's {name} placeholders.
function mathText(x: number, y: number, s: string, a: Record<string, string | number>): string {
  const size = Number(a["font-size"] ?? TYPE.body);
  const sub = Math.max(TYPE.small, Math.round(size * 0.8));
  const drop = Math.round(size * 0.28);
  const chunks: Array<{ t: string; it?: boolean; sub?: boolean }> = [];
  let last = 0;
  for (const m of s.matchAll(/([A-Za-z])_\[([^\]]*)\]/g)) {
    if (m.index! > last) chunks.push({ t: s.slice(last, m.index) });
    chunks.push({ t: m[1], it: true });
    chunks.push({ t: m[2], sub: true });
    last = m.index! + m[0].length;
  }
  if (last < s.length) chunks.push({ t: s.slice(last) });
  let shift = 0;
  const inner = chunks.map((c) => {
    const target = c.sub ? drop : 0;
    const dy = target - shift;
    shift = target;
    return el("tspan", { dy: dy || undefined, "font-style": c.it ? "italic" : undefined, "font-size": c.sub ? sub : undefined }, esc(c.t));
  }).join("");
  return el("text", { x, y, ...a }, inner);
}
const plain = (s: string) => s.replace(/_\[([^\]]*)\]/g, "$1");

function msgText(m: Msg, f: Frame, L: L, lang: Lang): string {
  const it = f.it;
  const rOf = (bs: number[]) => (bs.length ? popcount(f.holders[bs[0]]) : 0);
  switch (m.k) {
    case "reserve": return tpl(m.need ? L.mReserve : L.mReserveNone, { it, need: m.need, free: m.free });
    case "hit": {
      const names = m.reqs.map((i) => `R${i}`);
      const reqs = names.length > 1 ? names.slice(0, -1).join(lang === "zh" ? "、" : ", ") + L.and + names[names.length - 1] : names[0];
      return tpl(m.reqs.length > 1 ? L.mHitMany : L.mHitOne, { reqs, bl: list(m.blocks, lang), r: m.r });
    }
    case "defer": return tpl(L.mDefer, { i: m.req, need: m.need, free: m.free });
    case "commit": return tpl(L.mCommit, { it, n: m.n });
    case "commitNone": return tpl(L.mCommitNone, { it });
    case "register": return tpl(L.mRegister, { bl: list(m.blocks, lang), r: m.r });
    case "fail": return tpl(m.refs ? L.mFailRefs : L.mFail, { it, n: m.n, refs: m.refs });
    case "cancel": return tpl(m.refs ? L.mCancelRefs : L.mCancel, { i: m.req, n: m.n, refs: m.refs });
    case "finish":
      if (!m.kept.length) return tpl(L.mFinish, { i: m.req, freed: list(m.freed, lang) });
      return tpl(L.mFinishKept, { i: m.req, freed: list(m.freed, lang), kept: list(m.kept, lang), r: rOf(m.kept) });
    case "evict": return tpl(L.mEvict, { it, need: m.need, free: f.planFree, bl: list(m.blocks, lang) });
    case "preempt":
      if (!m.kept.length) return tpl(L.mPreempt, { it, i: m.req, need: f.planNeed, free: f.planFree, freed: list(m.freed, lang) });
      return tpl(L.mPreemptKept, { it, i: m.req, need: f.planNeed, free: f.planFree, freed: list(m.freed, lang), kept: list(m.kept, lang), r: rOf(m.kept) });
  }
}

function frameText(f: Frame, lang: Lang): string {
  const L = labels[lang];
  const s = f.msgs.map((m) => msgText(m, f, L, lang)).join(L.sep);
  return lang === "en" ? s.replace(/^./, (c) => c.toUpperCase()) : s;
}

// Which protocol stage a transition belongs to: 0 pressure, 1 reserve,
// 2 execute, 3 commit or roll back, 4 release.
function stages(f: Frame): number[] {
  switch (f.kind) {
    case "evict": case "preempt": return [0];
    case "reserve": return [1];
    case "commit": case "rollback": return [2, 3];
    case "cancel": return [3];
    case "release": return [4];
  }
}

function phaseName(f: Frame, L: L): string {
  if (f.kind === "rollback" || f.kind === "cancel") return L.chipRollback;
  return [L.chipPressure, L.chipReserve, L.chipExecute, L.chipCommit, L.chipRelease][stages(f).at(-1)!];
}

function renderHeader(f: Frame, w: number, L: L): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  const title = tpl(L.iteration, { it: f.it });
  parts.push(text(0, 15, title, { "font-size": TYPE.title, class: "fig-t-strong" }));
  const rolled = f.kind === "rollback" || f.kind === "cancel";
  const names = [L.chipPressure, L.chipReserve, L.chipExecute, rolled ? L.chipRollback : L.chipCommit, L.chipRelease];
  const on = new Set(stages(f));
  const fs = TYPE.body;
  const chipH = 22, arrow = 16, pad = 8;
  let x = narrow ? 0 : textWidth(title, TYPE.title) + 18;
  const x0 = x;
  let y = narrow ? 26 : 0;
  names.forEach((name, i) => {
    const cw = textWidth(name, fs) + 2 * pad;
    if (i > 0) {
      if (x + arrow + cw > w) { x = x0; y += chipH + 6; } else {
        parts.push(el("path", { d: `M${x + 3},${y + chipH / 2}H${x + arrow - 4}M${x + arrow - 8},${y + chipH / 2 - 3.5}L${x + arrow - 4},${y + chipH / 2}L${x + arrow - 8},${y + chipH / 2 + 3.5}`, fill: "none", stroke: C.ink3, "stroke-width": 1.2 }));
        x += arrow;
      }
    }
    const active = on.has(i);
    const tone = !active ? C.grid : i === 0 ? C.warn : i === 3 ? (rolled ? C.bad : C.good) : C.ink;
    parts.push(el("rect", { x: x + 0.75, y: y + 0.75, width: cw - 1.5, height: chipH - 1.5, rx: 11, fill: active ? C.panel : "none", stroke: tone, "stroke-width": active ? 2 : 1 }));
    parts.push(text(x + cw / 2, y + 15, name, { "font-size": fs, "text-anchor": "middle", class: active ? "fig-t-strong" : "fig-t-faint" }));
    x += cw;
  });
  return { svg: g({ class: "fig-phase" }, ...parts), h: y + chipH };
}

interface Rows { label: string; y: number; h: number }

function renderPool(f: Frame, x0: number, y0: number, w: number, L: L, uid: string, narrow: boolean): { svg: string; h: number; rows: Rows[]; header: number } {
  const N = f.state.length;
  const parts: string[] = [];
  parts.push(text(x0, y0 + 14, tpl(L.pool, { n: N, b: B }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const fs = narrow ? TYPE.body : TYPE.small;
  const lg = legend([
    { label: L.free, swatch: { kind: "rect", fill: C.panel } },
    { label: L.reserved, swatch: { kind: "rect", fill: C.c2, pattern: `${uid}-hatch` } },
    { label: L.held, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.slots, swatch: { kind: "rect", fill: C.c1, opacity: 0.28 } },
    { label: L.changed, swatch: { kind: "rect", fill: "none", stroke: C.ink } },
  ], x0, y0 + 24, w, fs);
  parts.push(lg.svg);
  const rowNames = [L.rowBlock, L.rowState, "R1", "R2", "R3", "R4", "R5", L.rowIndex, L.rowRefs];
  const labelW = Math.max(...rowNames.map((s) => textWidth(s, fs))) + 8;
  const cw = Math.min(34, Math.floor((w - labelW) / N));
  const top = y0 + 32 + lg.height;
  const hdrH = 16, stateH = 26, rowH = narrow ? 19 : 18, refH = 20;
  const rows: Rows[] = [];
  let y = top;
  rows.push({ label: L.rowBlock, y, h: hdrH }); y += hdrH + 2;
  rows.push({ label: L.rowState, y, h: stateH }); y += stateH + 4;
  for (let i = 1; i <= REQUESTS; i++) { rows.push({ label: `R${i}`, y, h: rowH }); y += rowH; }
  rows.push({ label: L.rowIndex, y, h: rowH }); y += rowH + 2;
  rows.push({ label: L.rowRefs, y, h: refH }); y += refH;
  const colX = (b: number) => x0 + labelW + b * cw;

  // Row labels and faint row rules for the holder rows.
  rows.forEach((r, k) => {
    const cls = k >= 2 && k <= 1 + REQUESTS ? "fig-t-strong fig-t-num" : "fig-t-muted";
    parts.push(text(x0, r.y + r.h / 2 + 4, r.label, { "font-size": fs, class: cls }));
    if (k >= 2 && k <= 2 + REQUESTS) parts.push(el("line", { x1: x0 + labelW, x2: colX(N), y1: r.y + r.h, y2: r.y + r.h, stroke: C.grid, "stroke-width": 1 }));
  });

  const hdr = rows[0], st = rows[1], refs = rows[3 + REQUESTS];
  const mark = Math.max(8, Math.min(cw - 8, rowH - 6));
  for (let b = 0; b < N; b++) {
    const cx = colX(b);
    parts.push(text(cx + cw / 2, hdr.y + 12, b, { "font-size": fs, "text-anchor": "middle", class: "fig-t-faint fig-t-num" }));
    const cellW = cw - 4, x = cx + 2;
    // State cell.
    if (f.state[b] === St.Free) {
      parts.push(el("rect", { x, y: st.y, width: cellW, height: stateH, rx: 3, fill: C.panel }));
    } else if (f.state[b] === St.Reserved) {
      parts.push(el("rect", { x, y: st.y, width: cellW, height: stateH, rx: 3, fill: `url(#${uid}-hatch)` }));
      parts.push(el("rect", { x: x + 0.6, y: st.y + 0.6, width: cellW - 1.2, height: stateH - 1.2, rx: 3, fill: "none", stroke: C.c2, "stroke-width": 1.2 }));
    } else {
      const k = f.fill[b] / B;
      parts.push(el("rect", { x, y: st.y, width: cellW, height: stateH, rx: 3, fill: C.c1, "fill-opacity": 0.28 }));
      if (k > 0) parts.push(el("rect", { x, y: st.y + stateH * (1 - k), width: cellW, height: stateH * k, rx: k > 0.9 ? 3 : 0, fill: C.c1 }));
    }
    // Holder marks: a committed reference is a solid square, a reservation a hatched one.
    const mx = cx + (cw - mark) / 2;
    for (let i = 1; i <= REQUESTS + 1; i++) {
      const r = rows[1 + i];
      const my = r.y + (r.h - mark) / 2;
      const id = i === REQUESTS + 1 ? INDEX : i;
      if (f.state[b] === St.Committed && f.holders[b] & bit(id)) {
        parts.push(el("rect", { x: mx, y: my, width: mark, height: mark, rx: 2, fill: C.c1 }));
      } else if (f.state[b] === St.Reserved && f.resv[b] === id) {
        parts.push(el("rect", { x: mx, y: my, width: mark, height: mark, rx: 2, fill: `url(#${uid}-hatch)` }));
        parts.push(el("rect", { x: mx + 0.5, y: my + 0.5, width: mark - 1, height: mark - 1, rx: 2, fill: "none", stroke: C.c2, "stroke-width": 1 }));
      }
    }
    // Reference count.
    const rc = popcount(f.holders[b]);
    if (f.state[b] === St.Committed) parts.push(text(cx + cw / 2, refs.y + 14, rc, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    else if (f.changed[b] && f.state[b] === St.Free) parts.push(text(cx + cw / 2, refs.y + 14, 0, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-faint fig-t-num" }));
    // Outline the whole column when this transition changed the block.
    if (f.changed[b]) parts.push(el("rect", { x: cx + 0.75, y: st.y - 2, width: cw - 1.5, height: refs.y + refH - st.y + 2, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
  }
  return { svg: g({ class: "fig-pool" }, ...parts), h: y - y0, rows, header: hdr.y };
}

function statusText(q: ReqView, L: L): string {
  switch (q.status) {
    case RS.Future: return L.stFuture;
    case RS.Waiting: return q.admitted ? L.stAdmitted : q.preempted ? L.stRequeued : L.stWaiting;
    case RS.Running: return L.stRunning;
    case RS.Finished: return L.stFinished;
    default: return L.stCancelled;
  }
}

// Per-request numbers of the chapter's equations: retained tokens T_i, block
// count q_i, and this iteration's scheduled positions s_i and new blocks Δq_i.
function renderTable(f: Frame, x0: number, w: number, rowYs: Array<{ y: number; h: number }>, headerY: number, L: L, narrow: boolean): string {
  const fs = TYPE.body;
  const parts: string[] = [];
  const statusW = Math.max(...[L.stFuture, L.stWaiting, L.stAdmitted, L.stRequeued, L.stRunning, L.stFinished, L.stCancelled, L.colStatus].map((s) => textWidth(s, fs))) + 10;
  const numW = Math.max(28, Math.floor((w - statusW - (narrow ? 26 : 0)) / 4));
  const lead = narrow ? 26 : 0; // request labels repeated when the table is not beside the pool
  const cols = ["T_[i]", "q_[i]", "s_[i]", "Δq_[i]"];
  parts.push(text(x0 + lead, headerY + 12, L.colStatus, { "font-size": fs, class: "fig-t-muted" }));
  cols.forEach((c, k) => parts.push(mathText(x0 + lead + statusW + (k + 1) * numW - 4, headerY + 12, c, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" })));
  f.reqs.forEach((q, i) => {
    const r = rowYs[i];
    const yy = r.y + r.h / 2 + 4;
    const resident = q.status === RS.Running || q.table.length > 0;
    if (narrow) parts.push(text(x0, yy, `R${i + 1}`, { "font-size": fs, class: "fig-t-strong fig-t-num" }));
    parts.push(text(x0 + lead, yy, statusText(q, L), { "font-size": fs, class: resident || q.inPlan ? "" : "fig-t-faint" }));
    const vals = [resident ? q.T : "", resident ? q.table.length : "", q.inPlan ? `+${q.s}` : "", q.inPlan ? (q.dq ? `+${q.dq}` : "0") : ""];
    vals.forEach((v, k) => { if (v !== "") parts.push(text(x0 + lead + statusW + (k + 1) * numW - 4, yy, v, { "font-size": fs, "text-anchor": "end", class: k === 3 && q.dq > 0 ? "fig-t-strong fig-t-num" : "fig-t-num" })); });
  });
  return g({ class: "fig-requests" }, ...parts);
}

function tableHeight(): number { return 18 + REQUESTS * 19; }

function renderAccounting(f: Frame, x0: number, y0: number, w: number, L: L, uid: string): { svg: string; h: number } {
  const N = f.state.length;
  const parts: string[] = [];
  const fs = TYPE.body;
  parts.push(text(x0, y0 + 14, L.accounting, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const by = y0 + 24, bh = 16;
  const unit = w / N;
  let x = x0;
  const seg = (n: number, a: Record<string, string | number>) => { if (n > 0) parts.push(el("rect", { x: x + 0.5, y: by, width: n * unit - 1, height: bh, rx: 2, ...a })); x += n * unit; };
  seg(f.committed, { fill: C.c1 });
  seg(f.reserved, { fill: `url(#${uid}-hatch)`, stroke: C.c2, "stroke-width": 1 });
  seg(f.free, { fill: C.panel });
  for (let b = 1; b < N; b++) parts.push(el("line", { x1: x0 + b * unit, x2: x0 + b * unit, y1: by, y2: by + bh, stroke: C.paper, "stroke-width": 1 }));
  let y = by + bh + 18;
  parts.push(text(x0, y, tpl(L.conserve, { f: f.free, r: f.reserved, c: f.committed, n: N }), { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  const sign = (v: number) => (v > 0 ? `+${v}` : `−${-v}`);
  const d: string[] = [];
  if (f.d[0]) d.push(tpl(L.dFree, { v: sign(f.d[0]) }));
  if (f.d[1]) d.push(tpl(L.dReserved, { v: sign(f.d[1]) }));
  if (f.d[2]) d.push(tpl(L.dCommitted, { v: sign(f.d[2]) }));
  const lines: string[] = [];
  lines.push(d.length ? tpl(L.delta, { parts: d.join(", ") }) : L.noDelta);
  lines.push(tpl(L.plan, { need: f.planNeed, op: f.planNeed <= f.planFree ? "≤" : ">", free: f.planFree }));
  // Live blocks against block-table entries of the resident requests: a shared block is counted once.
  const live = new Set<number>();
  let entries = 0;
  f.reqs.forEach((q) => { if (q.status === RS.Running || q.table.length) { entries += q.table.length; for (const b of q.table) if (f.state[b] === St.Committed) live.add(b); } });
  lines.push(tpl(L.share, { e: entries, u: live.size }));
  for (const ln of lines) {
    // Wrap on the plain text, then set each line with its notation.
    const words = ln.split(" ");
    let cur = "";
    const out: string[] = [];
    for (const wd of words) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (cur && textWidth(plain(next), fs) > w) { out.push(cur); cur = wd; } else cur = next;
    }
    if (cur) out.push(cur);
    const rows = out.flatMap((o) => (textWidth(plain(o), fs) > w ? wrap(o, fs, w) : [o]));
    for (const part of rows) { y += 18; parts.push(mathText(x0, y, part, { "font-size": fs, class: "fig-t-num" })); }
  }
  return { svg: g({ class: "fig-accounting" }, ...parts), h: y - y0 + 4 };
}

function frameAt(p: P, t: number): Frame {
  const r = run(p);
  return r.frames[Math.max(0, Math.min(r.frames.length - 1, Math.round(t)))];
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const f = frameAt(st.p, st.t);
  return tpl(L.describe, { it: f.it, phase: phaseName(f, L), f: f.free, r: f.reserved, c: f.committed, n: f.state.length, what: frameText(f, lang) });
}

export default defineFigure({
  name: "kv-block-lifecycle",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    fault: {
      kind: "choice", label: { en: "Injected event", zh: "注入事件" }, default: "fail",
      options: [
        { value: "none", label: { en: "None", zh: "无" } },
        { value: "fail", label: { en: "Execution failure", zh: "执行失败" } },
        { value: "cancel", label: { en: "Cancellation", zh: "请求取消" } },
      ],
    },
    order: {
      kind: "choice", label: { en: "Finish order", zh: "完成顺序" }, default: "r1",
      options: [
        { value: "r1", label: { en: "R1 before R2", zh: "R1 先于 R2" } },
        { value: "r2", label: { en: "R2 before R1", zh: "R2 先于 R1" } },
      ],
    },
    capacity: { kind: "range", label: { en: "Pool capacity", zh: "块池容量" }, unit: { en: "blocks", zh: "个块" }, min: 8, max: 14, step: 1, default: 12 },
  },
  timeline: {
    rate: 1,
    discrete: true,
    duration: (p) => run(p).frames.length - 1,
    keyframes: (p, lang) => run(p).frames.map((f, t) => ({ t, label: frameText(f, lang) })),
    // Open on the injected event; without one, on the first release that
    // leaves a shared block committed, where the reference count is the point.
    poster: (p) => {
      const fr = run(p).frames;
      const find = (ok: (f: Frame) => boolean) => fr.findIndex(ok);
      if (p.fault === "fail") return Math.max(0, find((f) => f.kind === "rollback"));
      if (p.fault === "cancel") return Math.max(0, find((f) => f.kind === "cancel"));
      const kept = find((f) => f.kind === "release" && f.msgs.some((m) => m.k === "finish" && m.kept.length > 0));
      return kept >= 0 ? kept : Math.max(0, find((f) => f.kind === "evict" || f.kind === "preempt"));
    },
  },
  render(st, lang) {
    const L = labels[lang];
    const p = st.p as P;
    const w = st.w;
    const narrow = w < 480;
    const f = frameAt(p, st.t);
    const parts: string[] = [el("defs", {}, hatch(`${st.uid}-hatch`, C.c2, 4, 1.3))];
    const head = renderHeader(f, w, L);
    parts.push(head.svg);
    let y = head.h + 16;
    if (narrow) {
      const pool = renderPool(f, 0, y, w, L, st.uid, true);
      parts.push(pool.svg);
      y += pool.h + 16;
      const rowYs = Array.from({ length: REQUESTS }, (_, i) => ({ y: y + 18 + i * 19, h: 19 }));
      parts.push(renderTable(f, 0, w, rowYs, y, L, true));
      y += tableHeight() + 16;
      const acc = renderAccounting(f, 0, y, w, L, st.uid);
      parts.push(acc.svg);
      y += acc.h;
    } else {
      const tableW = 214;
      const poolW = w - tableW - 20;
      const pool = renderPool(f, 0, y, poolW, L, st.uid, false);
      parts.push(pool.svg);
      parts.push(renderTable(f, poolW + 20, tableW, pool.rows.slice(2, 2 + REQUESTS), pool.header, L, false));
      y += pool.h + 18;
      const acc = renderAccounting(f, 0, y, w, L, st.uid);
      parts.push(acc.svg);
      y += acc.h;
    }
    return svg(w, y + 4, describe(st, lang), ...parts);
  },
  describe,
});
