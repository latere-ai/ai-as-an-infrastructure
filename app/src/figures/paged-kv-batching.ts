// Continuous batching over a paged KV-cache pool, against contiguous
// reservation on the same request trace.
//
// One seeded trace of requests (arrival step, prompt length, output length)
// is scheduled twice by an iteration-level scheduler: every model iteration
// the batch is re-formed, finished sequences leave, and waiting requests are
// admitted in arrival order while the batch has a free slot and the pool can
// hold their state.
//
// - Paged: a request holds ceil(stored / B) blocks taken from a free list, so
//   its blocks are scattered and it grows one block at a time. When a decode
//   step needs a block and the pool is empty, the most recently admitted
//   request is preempted: its blocks are freed and it is recomputed from its
//   prompt and generated tokens when it is admitted again (vLLM's default
//   recompute policy).
// - Contiguous: a request reserves a run of adjacent blocks for its declared
//   maximum (prompt + max_new tokens) at admission, first fit. It never grows
//   or preempts, but reserved capacity it never fills is unusable, and free
//   blocks split into holes can leave a request waiting.
//
// State is a pure function of the parameters and the step t: the whole trace
// is simulated once per parameter set (memoized) and render reads step t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng, exponential, intBetween } from "./lib/random.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { pct, fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

export const MAX_NEW = 64; // declared max_tokens of every request
const REQUESTS = 24;
const MAX_BATCH = 8; // scheduler limit on concurrently running sequences

export type Mode = "paged" | "contiguous";

// Per-step phase of one request.
export const Ph = { None: 0, Waiting: 1, Prefill: 2, Decode: 3, Recompute: 4 } as const;

export interface Req {
  id: number; // 1-based, in arrival order
  arrival: number;
  prompt: number;
  out: number; // tokens the request will generate before it stops
}

interface Live {
  req: Req;
  generated: number;
  stored: number; // tokens whose KV is resident
  blocks: number[]; // block table: logical index -> physical block
  reserved: number; // contiguous: blocks reserved at admission
  admittedAt: number;
  preempted: boolean; // has been preempted at least once
}

export type EventKind = "finish" | "preempt" | "blocked";
export interface SimEvent { t: number; kind: EventKind; req: number; blocks: number; free: number }

export interface Snapshot {
  owner: Int16Array; // physical block -> request id (0 = free)
  fill: Uint8Array; // tokens stored in each block
  fresh: Uint8Array; // 1 if allocated during this step
  freed: Uint8Array; // 1 if freed at the end of this step
  tables: Map<number, number[]>; // request id -> block table
  running: number[];
  waiting: number[];
  stored: number; // resident tokens
  allocated: number; // allocated blocks
  finished: number;
  preemptions: number;
  firstTokenWaits: number[]; // steps from arrival to first token, per request that has one
}

export interface Run {
  mode: Mode;
  phases: Uint8Array[]; // [step][request index]
  snaps: Snapshot[];
  events: SimEvent[];
  end: number; // last step with work
}

export interface Trace { reqs: Req[] }

export function trace(rate: number, seed: number): Trace {
  const u = rng(seed);
  const reqs: Req[] = [];
  let t = 0;
  for (let i = 0; i < REQUESTS; i++) {
    const gap = exponential(u(), 1);
    const prompt = intBetween(u(), 12, 56);
    // Output lengths: most short, some long (a mix of chat turns and longer answers).
    const out = u() < 0.7 ? intBetween(u(), 6, 28) : intBetween(u(), 36, MAX_NEW);
    if (i > 0) t += gap / rate;
    reqs.push({ id: i + 1, arrival: Math.floor(t), prompt, out });
  }
  return { reqs };
}

const blocksFor = (tokens: number, B: number) => Math.ceil(tokens / B);

export function simulate(tr: Trace, mode: Mode, B: number, poolTokens: number, horizon = 400): Run {
  const N = Math.floor(poolTokens / B);
  const owner = new Int16Array(N);
  const free: number[] = []; // paged free list (FIFO)
  for (let i = 0; i < N; i++) free.push(i);
  const waiting: Live[] = [];
  const running: Live[] = [];
  const reqs = tr.reqs;
  const lives = new Map<number, Live>();
  const phases: Uint8Array[] = [];
  const snaps: Snapshot[] = [];
  const events: SimEvent[] = [];
  const waits: number[] = [];
  let finished = 0, preemptions = 0, next = 0, end: number;
  const blockedOnce = new Set<number>();

  const release = (l: Live, freedMark: Uint8Array) => {
    for (const b of l.blocks) { owner[b] = 0; freedMark[b] = 1; if (mode === "paged") free.push(b); }
    l.blocks = [];
  };
  const firstFit = (k: number): number => {
    let run = 0;
    for (let i = 0; i < N; i++) {
      run = owner[i] === 0 ? run + 1 : 0;
      if (run === k) return i - k + 1;
    }
    return -1;
  };
  const freeCount = () => { let n = 0; for (let i = 0; i < N; i++) if (owner[i] === 0) n++; return n; };

  for (let t = 0; t < horizon; t++) {
    const phase = new Uint8Array(reqs.length);
    const fresh = new Uint8Array(N);
    const freed = new Uint8Array(N);
    while (next < reqs.length && reqs[next].arrival <= t) {
      const l: Live = { req: reqs[next], generated: 0, stored: 0, blocks: [], reserved: 0, admittedAt: -1, preempted: false };
      lives.set(l.req.id, l);
      waiting.push(l);
      next++;
    }

    // 1. Decode growth: every running sequence stores one more token this step.
    if (mode === "paged") {
      for (let i = 0; i < running.length; i++) {
        const l = running[i];
        if (blocksFor(l.stored + 1, B) <= l.blocks.length) continue;
        while (free.length === 0) {
          // Preempt the most recently admitted sequence (possibly l itself).
          const victim = running[running.length - 1];
          running.pop();
          const n = victim.blocks.length;
          release(victim, freed);
          victim.stored = 0;
          victim.preempted = true;
          preemptions++;
          events.push({ t, kind: "preempt", req: victim.req.id, blocks: n, free: free.length });
          // Back to the head of the queue, in arrival order among the preempted.
          const at = waiting.findIndex((w) => w.req.arrival > victim.req.arrival);
          waiting.splice(at < 0 ? waiting.length : at, 0, victim);
          if (victim === l) break;
        }
        if (!running.includes(l)) { i--; continue; }
        const b = free.shift()!;
        owner[b] = l.req.id; fresh[b] = 1; l.blocks.push(b);
      }
    }

    // 2. Admission, first come first served, while there is a slot and room.
    const admitted = new Set<Live>();
    while (waiting.length && running.length < MAX_BATCH) {
      const l = waiting[0];
      const need = mode === "paged"
        ? blocksFor(l.req.prompt + l.generated, B)
        : blocksFor(l.req.prompt + MAX_NEW, B);
      let got: number[] | null = null;
      if (mode === "paged") {
        if (free.length >= need) got = free.splice(0, need);
      } else {
        const at = firstFit(need);
        if (at >= 0) got = Array.from({ length: need }, (_, k) => at + k);
      }
      if (!got) {
        if (!blockedOnce.has(l.req.id)) {
          blockedOnce.add(l.req.id);
          events.push({ t, kind: "blocked", req: l.req.id, blocks: need, free: mode === "paged" ? free.length : freeCount() });
        }
        break;
      }
      waiting.shift();
      for (const b of got) { owner[b] = l.req.id; fresh[b] = 1; }
      l.blocks = got;
      l.reserved = got.length;
      l.admittedAt = t;
      running.push(l);
      admitted.add(l);
    }

    // 3. Execute the iteration.
    for (const l of running) {
      if (admitted.has(l)) {
        phase[l.req.id - 1] = l.preempted ? Ph.Recompute : Ph.Prefill;
        l.stored = l.req.prompt + l.generated;
        if (l.generated === 0) waits.push(t - l.req.arrival + 1);
        l.generated++;
      } else {
        phase[l.req.id - 1] = Ph.Decode;
        l.stored++;
        l.generated++;
      }
    }
    for (const l of waiting) phase[l.req.id - 1] = Ph.Waiting;

    // Block fill levels and tables for this step, before completions free them.
    const fill = new Uint8Array(N);
    const tables = new Map<number, number[]>();
    let stored = 0;
    for (const l of running) {
      tables.set(l.req.id, [...l.blocks]);
      stored += l.stored;
      let left = l.stored;
      for (const b of l.blocks) { const k = Math.min(B, Math.max(0, left)); fill[b] = k; left -= k; }
    }
    const allocated = N - freeCount();
    const ownerNow = owner.slice();

    // 4. Completions leave the batch; their blocks return to the pool.
    for (let i = running.length - 1; i >= 0; i--) {
      const l = running[i];
      if (l.generated < l.req.out) continue;
      events.push({ t, kind: "finish", req: l.req.id, blocks: l.blocks.length, free: 0 });
      release(l, freed);
      running.splice(i, 1);
      finished++;
    }

    phases.push(phase);
    snaps.push({
      owner: ownerNow, fill, fresh, freed, tables,
      running: [...tables.keys()],
      waiting: waiting.map((l) => l.req.id), stored, allocated, finished, preemptions, firstTokenWaits: [...waits],
    });
    if (!running.length && !waiting.length && next >= reqs.length) break;
  }
  end = snaps.length - 1;
  return { mode, phases, snaps, events, end };
}

// Both runs for one parameter set, memoized: render is called every frame
// while playing, the simulation only when a parameter changes.
const memo = new Map<string, { tr: Trace; paged: Run; contiguous: Run; duration: number }>();
export function runs(p: { rate: number; block: number; pool: number; seed: number }) {
  const key = `${p.rate}|${p.block}|${p.pool}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const tr = trace(p.rate, p.seed);
    const paged = simulate(tr, "paged", p.block, p.pool);
    const contiguous = simulate(tr, "contiguous", p.block, p.pool);
    hit = { tr, paged, contiguous, duration: Math.max(paged.end, contiguous.end) };
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// A snapshot past the end of a run: everything finished, the pool empty.
function snapAt(run: Run, t: number, blocks: number): Snapshot {
  if (t <= run.end) return run.snaps[Math.max(0, t)];
  const last = run.snaps[run.end];
  return {
    owner: new Int16Array(blocks), fill: new Uint8Array(blocks), fresh: new Uint8Array(blocks), freed: new Uint8Array(blocks),
    tables: new Map(), running: [], waiting: [], stored: 0, allocated: 0,
    finished: last.finished + last.running.length, preemptions: last.preemptions, firstTokenWaits: last.firstTokenWaits,
  };
}

// ---------------------------------------------------------------- figure


const labels = {
  en: {
    title: "Continuous batching over a paged KV-cache pool",
    lanes: "Requests over time",
    prefill: "prefill",
    decode: "decode",
    recompute: "recompute after preemption",
    waiting: "waiting",
    step: "model iteration (step)",
    request: "request",
    cursor: "step {t}",
    pool: "KV block pool: {n} blocks of {b} tokens",
    holds: "holds KV",
    empty: "allocated, empty",
    fresh: "allocated this step",
    freed: "returned this step",
    free: "free",
    table: "Block table of R{i}",
    tableNone: "R{i} holds no blocks at this step",
    logical: "logical j",
    physical: "physical π(j)",
    conserve: "free {f} + reserved {r} + committed {c} = {n} blocks",
    readout: "At step {t}",
    paged: "paged",
    contiguous: "contiguous",
    mBatch: "requests in the batch",
    mWaiting: "waiting",
    mHolds: "pool holding KV",
    mEmpty: "allocated, empty",
    mFree: "free blocks",
    mRun: "largest free run",
    mFinished: "finished",
    mPreempt: "preemptions",
    mWait: "mean steps to first token",
    evFinish: "R{i} finishes; {k} blocks return to the pool",
    evPreempt: "The pool is full: R{i} is preempted and its {k} blocks are freed",
    evFrag: "R{i} waits: {f} blocks are free, but no {k} are adjacent",
    evFull: "R{i} waits: it needs {k} blocks and {f} are free",
    describe: "Step {t} of {d}, {mode}: {b} requests in the batch, {w} waiting; {h} of the pool holds KV and {e} is allocated but empty. {other} at the same step: {b2} in the batch, {w2} waiting, {h2} holds KV, {e2} allocated but empty.",
    modePaged: "paged blocks",
    modeContig: "contiguous reservation",
  },
  zh: {
    title: "分页 KV 缓存池上的连续批处理",
    lanes: "请求随时间推进",
    prefill: "预填充",
    decode: "解码",
    recompute: "抢占后重算",
    waiting: "排队",
    step: "模型迭代（步）",
    request: "请求",
    cursor: "第 {t} 步",
    pool: "KV 块池：{n} 个块，每块 {b} 个词元",
    holds: "存有 KV",
    empty: "已分配但空置",
    fresh: "本步新分配",
    freed: "本步归还",
    free: "空闲",
    table: "R{i} 的块表",
    tableNone: "R{i} 在这一步不持有块",
    logical: "逻辑块 j",
    physical: "物理块 π(j)",
    conserve: "空闲 {f} + 预留 {r} + 已提交 {c} = {n} 个块",
    readout: "第 {t} 步",
    paged: "分页",
    contiguous: "连续预留",
    mBatch: "批内请求",
    mWaiting: "排队请求",
    mHolds: "存有 KV 的容量",
    mEmpty: "已分配但空置",
    mFree: "空闲块",
    mRun: "最长连续空闲段",
    mFinished: "已完成",
    mPreempt: "抢占次数",
    mWait: "首个词元平均等待步数",
    evFinish: "R{i} 完成，{k} 个块回到块池",
    evPreempt: "块池已满：R{i} 被抢占，释放 {k} 个块",
    evFrag: "R{i} 排队：有 {f} 个空闲块，但凑不出 {k} 个相邻的块",
    evFull: "R{i} 排队：需要 {k} 个块，只有 {f} 个空闲",
    describe: "第 {t} 步（共 {d} 步），{mode}：批内 {b} 个请求，{w} 个排队；块池 {h} 的容量存有 KV，{e} 已分配但空置。同一步的{other}：批内 {b2} 个，排队 {w2} 个，{h2} 存有 KV，{e2} 已分配但空置。",
    modePaged: "分页块",
    modeContig: "连续预留",
  },
};

type P = { mode: Mode; rate: number; block: number; pool: number; seed: number; focus: number };

function largestRun(owner: Int16Array): number {
  let best = 0, run = 0;
  for (let i = 0; i < owner.length; i++) { run = owner[i] === 0 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

function eventLabel(e: SimEvent, mode: Mode, L: typeof labels.en): string {
  if (e.kind === "finish") return tpl(L.evFinish, { i: e.req, k: e.blocks });
  if (e.kind === "preempt") return tpl(L.evPreempt, { i: e.req, k: e.blocks });
  return tpl(mode === "contiguous" && e.free >= e.blocks ? L.evFrag : L.evFull, { i: e.req, k: e.blocks, f: e.free });
}

// The request whose block table is shown: the chosen one, or by default the
// running request with the most blocks at this step.
function focused(p: P, s: Snapshot): number {
  if (p.focus > 0) return p.focus;
  let best = 0, n = -1;
  for (const [id, tbl] of s.tables) if (tbl.length > n) { best = id; n = tbl.length; }
  return best;
}

function metrics(run: Run, t: number, p: P) {
  const N = Math.floor(p.pool / p.block);
  const s = snapAt(run, t, N);
  const cap = N * p.block;
  const waits = s.firstTokenWaits;
  return {
    s, N,
    batch: s.running.length,
    waiting: s.waiting.length,
    holds: s.stored / cap,
    empty: (s.allocated * p.block - s.stored) / cap,
    free: N - s.allocated,
    run: largestRun(s.owner),
    finished: s.finished,
    preempt: s.preemptions,
    wait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
  };
}

function renderLanes(p: P, t: number, w: number, run: Run, duration: number, L: typeof labels.en, focus: number, uid: string, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, L.lanes, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.prefill, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.decode, swatch: { kind: "rect", fill: C.c1, opacity: 0.4 } },
    { label: L.recompute, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.waiting, swatch: { kind: "line", stroke: C.ink3 } },
  ], 0, y0 + 22, w);
  parts.push(lg.svg);
  const top = y0 + 40 + lg.height;
  const labelW = 26;
  const n = run.phases[0]?.length ?? 0;
  const rowH = narrow ? 8 : 9;
  const x = linear([0, duration + 1], [labelW, w - 4]);
  const plotH = n * rowH;
  const T = Math.min(t, run.end);

  // Row bands: the focused request, then the phase runs of every request up to t.
  const fRow = focus - 1;
  if (fRow >= 0) parts.push(el("rect", { x: 0, y: top + fRow * rowH - 0.5, width: w, height: rowH + 1, fill: C.panel }));
  for (let r = 0; r < n; r++) {
    const yy = top + r * rowH;
    let s0 = 0;
    while (s0 <= T) {
      const ph = run.phases[s0][r];
      let s1 = s0;
      while (s1 + 1 <= T && run.phases[s1 + 1][r] === ph) s1++;
      if (ph === Ph.Waiting) {
        parts.push(el("line", { x1: x(s0), x2: x(s1 + 1), y1: yy + rowH / 2, y2: yy + rowH / 2, stroke: C.ink3, "stroke-width": 1 }));
      } else if (ph !== Ph.None) {
        const fill = ph === Ph.Recompute ? C.c2 : C.c1;
        parts.push(el("rect", { x: x(s0), y: yy + 1, width: Math.max(1, x(s1 + 1) - x(s0) - 0.4), height: rowH - 2, fill, "fill-opacity": ph === Ph.Decode ? 0.4 : 1 }));
      }
      s0 = s1 + 1;
    }
    // Hit target: choose this request for the block table.
    parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH, fill: "transparent", "data-fig-set": `focus=${r + 1}`, class: "fig-hit" }));
  }
  // Request labels every fifth row, plus the focused one.
  for (let r = 0; r < n; r++) {
    const id = r + 1;
    if (id !== 1 && id % 5 !== 0 && id !== focus) continue;
    if (id !== focus && Math.abs(id - focus) < 2 && focus > 0) continue;
    parts.push(text(labelW - 6, top + r * rowH + rowH / 2 + 4, `R${id}`, { "font-size": TYPE.small, "text-anchor": "end", class: id === focus ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
  }
  // Cursor.
  const cx = x(Math.min(t, duration) + 1);
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 4, y2: top + plotH + 2, stroke: C.ink, "stroke-width": 1.5 }));
  const cl = tpl(L.cursor, { t });
  const clw = textWidth(cl, TYPE.small);
  const clx = Math.min(Math.max(cx, labelW + clw / 2), w - clw / 2 - 2);
  parts.push(text(clx, top - 8, cl, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  const ax = axis({ scale: x, orient: "bottom", at: top + plotH + 3, ticks: x.ticks(narrow ? 4 : 8).filter((v) => v <= duration), title: L.step, format: (v) => String(v) });
  parts.push(ax);
  return { svg: g({ class: "fig-lanes" }, ...parts), h: top - y0 + plotH + 3 + axisHeight(true) };
}

function renderPool(p: P, s: Snapshot, x0: number, y0: number, w: number, L: typeof labels.en, focus: number, uid: string): { svg: string; h: number } {
  const N = s.owner.length;
  const B = p.block;
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, tpl(L.pool, { n: N, b: B }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.holds, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.empty, swatch: { kind: "rect", fill: C.c2, pattern: `${uid}-hatch` } },
    { label: L.fresh, swatch: { kind: "rect", fill: "none", stroke: C.ink } },
    { label: L.freed, swatch: { kind: "rect", fill: "none", stroke: C.ink3, dash: "2 2" } },
    { label: L.free, swatch: { kind: "rect", fill: C.panel } },
  ], x0, y0 + 22, w);
  parts.push(lg.svg);
  const top = y0 + 28 + lg.height;
  const cols = N <= 20 ? 10 : N <= 40 ? 10 : N <= 64 ? 16 : 20;
  const colsFit = Math.max(8, Math.min(cols, Math.floor((w + 3) / 22)));
  const bx = band(colsFit, [x0, x0 + w], 3);
  const cell = Math.min(bx.size, 40);
  const rows = Math.ceil(N / colsFit);
  for (let i = 0; i < N; i++) {
    const cxp = x0 + (i % colsFit) * (cell + 3);
    const cyp = top + Math.floor(i / colsFit) * (cell + 3);
    const own = s.owner[i];
    const dim = focus > 0 && own > 0 && own !== focus ? 0.35 : 1;
    const cellParts: string[] = [];
    if (own === 0) {
      cellParts.push(el("rect", { x: cxp, y: cyp, width: cell, height: cell, rx: 3, fill: C.panel }));
    } else {
      const k = s.fill[i] / B;
      cellParts.push(el("rect", { x: cxp, y: cyp, width: cell, height: cell, rx: 3, fill: `url(#${uid}-hatch)` }));
      if (k > 0) cellParts.push(el("rect", { x: cxp, y: cyp + cell * (1 - k), width: cell, height: cell * k, rx: k > 0.9 ? 3 : 0, fill: C.c1 }));
      if (cell >= 18) cellParts.push(text(cxp + cell / 2, cyp + Math.min(cell / 2 + 4, 14), own, { "font-size": cell >= 26 ? TYPE.small : 9, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
    }
    if (s.fresh[i] && own > 0) cellParts.push(el("rect", { x: cxp + 0.75, y: cyp + 0.75, width: cell - 1.5, height: cell - 1.5, rx: 3, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    if (s.freed[i]) cellParts.push(el("rect", { x: cxp + 0.75, y: cyp + 0.75, width: cell - 1.5, height: cell - 1.5, rx: 3, fill: "none", stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
    parts.push(g({ opacity: dim < 1 ? dim : undefined, "data-fig-set": own > 0 ? `focus=${own}` : undefined, class: own > 0 ? "fig-hit" : undefined }, ...cellParts));
  }
  return { svg: g({ class: "fig-pool" }, ...parts), h: top - y0 + rows * (cell + 3) };
}

function renderTable(s: Snapshot, focus: number, x0: number, y0: number, w: number, L: typeof labels.en, N: number): { svg: string; h: number } {
  const parts: string[] = [];
  const tbl = s.tables.get(focus);
  if (!focus) return { svg: "", h: 0 };
  if (!tbl) {
    parts.push(text(x0, y0 + 13, tpl(L.tableNone, { i: focus }), { "font-size": TYPE.body, class: "fig-t-muted" }));
    return { svg: g({}, ...parts), h: 22 };
  }
  parts.push(text(x0, y0 + 13, tpl(L.table, { i: focus }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lblW = Math.max(textWidth(L.logical, TYPE.small), textWidth(L.physical, TYPE.small)) + 10;
  const cw = 26;
  const perRow = Math.max(4, Math.floor((w - lblW) / (cw + 2)));
  const rowsNeeded = Math.ceil(tbl.length / perRow);
  let y = y0 + 22;
  for (let rr = 0; rr < rowsNeeded; rr++) {
    parts.push(text(x0, y + 13, L.logical, { "font-size": TYPE.small, class: "fig-t-muted" }));
    parts.push(text(x0, y + 13 + 20, L.physical, { "font-size": TYPE.small, class: "fig-t-muted" }));
    for (let k = 0; k < perRow; k++) {
      const j = rr * perRow + k;
      if (j >= tbl.length) break;
      const cx0 = x0 + lblW + k * (cw + 2);
      parts.push(el("rect", { x: cx0, y, width: cw, height: 18, rx: 2, fill: C.panel }));
      parts.push(text(cx0 + cw / 2, y + 13, j, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
      parts.push(el("rect", { x: cx0, y: y + 20, width: cw, height: 18, rx: 2, fill: C.c1, "fill-opacity": 0.16 }));
      parts.push(text(cx0 + cw / 2, y + 33, tbl[j], { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num fig-t-strong" }));
    }
    y += 46;
  }
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 };
}

function renderReadout(p: P, t: number, runsFor: ReturnType<typeof runs>, x0: number, y0: number, w: number, L: typeof labels.en): { svg: string; h: number } {
  const a = metrics(runsFor.paged, t, p);
  const b = metrics(runsFor.contiguous, t, p);
  const rows: Array<[string, string, string]> = [
    [L.mBatch, String(a.batch), String(b.batch)],
    [L.mWaiting, String(a.waiting), String(b.waiting)],
    [L.mHolds, pct(a.holds), pct(b.holds)],
    [L.mEmpty, pct(a.empty), pct(b.empty)],
    [L.mFree, String(a.free), String(b.free)],
    [L.mRun, String(a.run), String(b.run)],
    [L.mFinished, String(a.finished), String(b.finished)],
    [L.mPreempt, String(a.preempt), "–"],
    [L.mWait, fixed(a.wait), fixed(b.wait)],
  ];
  // Column width from the widest header or value, so headers never touch.
  const colW = Math.max(...[L.paged, L.contiguous].map((s) => textWidth(s, TYPE.small)), textWidth("100%", TYPE.body)) + 14;
  const xB = x0 + w;
  const xA = xB - colW;
  const parts: string[] = [];
  const pagedOn = p.mode === "paged";
  parts.push(text(x0, y0 + 13, tpl(L.readout, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(text(xA, y0 + 13, L.paged, { "font-size": TYPE.small, "text-anchor": "end", class: pagedOn ? "fig-t-strong" : "fig-t-muted" }));
  parts.push(text(xB, y0 + 13, L.contiguous, { "font-size": TYPE.small, "text-anchor": "end", class: pagedOn ? "fig-t-muted" : "fig-t-strong" }));
  let y = y0 + 22;
  const rowH = 19;
  for (const [name, va, vb] of rows) {
    parts.push(el("line", { x1: x0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, y + 14, name, { "font-size": TYPE.body }));
    parts.push(text(xA, y + 14, va, { "font-size": TYPE.body, "text-anchor": "end", class: pagedOn ? "fig-t-strong fig-t-num" : "fig-t-num fig-t-muted" }));
    parts.push(text(xB, y + 14, vb, { "font-size": TYPE.body, "text-anchor": "end", class: pagedOn ? "fig-t-num fig-t-muted" : "fig-t-strong fig-t-num" }));
    y += rowH;
  }
  // The chapter's conservation check for the mode on screen.
  const m = pagedOn ? a : b;
  let fresh = 0;
  for (let i = 0; i < m.N; i++) if (m.s.fresh[i] && m.s.owner[i] > 0) fresh++;
  const conserve = tpl(L.conserve, { f: m.free, r: fresh, c: m.s.allocated - fresh, n: m.N });
  parts.push(el("line", { x1: x0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  const lines = wrap(conserve, TYPE.small, w);
  lines.forEach((ln, i) => parts.push(text(x0, y + 16 + i * 15, ln, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" })));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 8 + lines.length * 15 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p as P;
  const all = runs(p);
  const t = Math.round(st.t);
  const a = metrics(all[p.mode], t, p);
  const other: Mode = p.mode === "paged" ? "contiguous" : "paged";
  const b = metrics(all[other], t, p);
  return tpl(L.describe, {
    t, d: all.duration, mode: p.mode === "paged" ? L.modePaged : L.modeContig,
    b: a.batch, w: a.waiting, h: pct(a.holds), e: pct(a.empty),
    other: other === "paged" ? L.modePaged : L.modeContig,
    b2: b.batch, w2: b.waiting, h2: pct(b.holds), e2: pct(b.empty),
  }).replace(/^./, (c) => c.toUpperCase());
}

export default defineFigure({
  name: "paged-kv-batching",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    mode: {
      kind: "choice", label: { en: "Allocation", zh: "分配方式" }, default: "paged",
      options: [
        { value: "paged", label: { en: "Paged", zh: "分页" } },
        { value: "contiguous", label: { en: "Contiguous", zh: "连续预留" } },
      ],
    },
    rate: { kind: "range", label: { en: "Arrival rate", zh: "到达率" }, unit: { en: "per step", zh: "个/步" }, min: 0.1, max: 0.6, step: 0.05, default: 0.35 },
    block: {
      kind: "choice", label: { en: "Block size B", zh: "块大小 B" }, default: 16,
      options: [
        { value: 8, label: { en: "8 tokens", zh: "8 个词元" } },
        { value: 16, label: { en: "16 tokens", zh: "16 个词元" } },
        { value: 32, label: { en: "32 tokens", zh: "32 个词元" } },
      ],
    },
    pool: { kind: "range", label: { en: "Pool capacity", zh: "块池容量" }, unit: { en: "tokens", zh: "个词元" }, min: 256, max: 1024, step: 64, default: 640, control: false },
    seed: { kind: "range", label: { en: "Trace seed", zh: "请求序列种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
    focus: {
      kind: "choice", label: { en: "Block table of", zh: "显示块表" }, default: 0,
      options: [
        { value: 0, label: { en: "most blocks", zh: "持有块最多的请求" } },
        ...Array.from({ length: REQUESTS }, (_, i) => ({ value: i + 1, label: { en: `R${i + 1}`, zh: `R${i + 1}` } })),
      ],
    },
  },
  timeline: {
    rate: 5,
    discrete: true,
    duration: (p) => runs(p).duration,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const r = runs(p)[p.mode];
      return r.events.map((e) => ({ t: e.t, label: eventLabel(e, p.mode, L) }));
    },
    poster: (p) => {
      const all = runs(p);
      const pre = all.paged.events.find((e) => e.kind === "preempt");
      if (pre) return pre.t;
      let best = 0, score = -Infinity;
      for (let t = 10; t <= Math.floor(all.duration * 0.6); t++) {
        const a = snapAt(all.paged, t, 1), b = snapAt(all.contiguous, t, 1);
        const sc = a.running.length - b.running.length + 0.25 * b.waiting.length;
        if (sc > score) { score = sc; best = t; }
      }
      return best;
    },
  },
  render(st, lang) {
    const L = labels[lang];
    const p = st.p as P;
    const w = st.w;
    const narrow = w < 480;
    const all = runs(p);
    const run = all[p.mode];
    const t = Math.round(st.t);
    const N = Math.floor(p.pool / p.block);
    const s = snapAt(run, t, N);
    const focus = focused(p, s) || p.focus;
    const lanes = renderLanes(p, t, w, run, all.duration, L, focus, st.uid, 0);
    let y = lanes.h + 18;
    const parts: string[] = [el("defs", {}, hatch(`${st.uid}-hatch`, C.c2, 4, 1.3)), lanes.svg];
    if (narrow) {
      const pool = renderPool(p, s, 0, y, w, L, focus, st.uid);
      parts.push(pool.svg); y += pool.h + 16;
      const tb = renderTable(s, focus, 0, y, w, L, N);
      parts.push(tb.svg); y += tb.h + (tb.h ? 14 : 0);
      const ro = renderReadout(p, t, all, 0, y, w, L);
      parts.push(ro.svg); y += ro.h;
    } else {
      const leftW = Math.floor(w * 0.52);
      const pool = renderPool(p, s, 0, y, leftW, L, focus, st.uid);
      const tb = renderTable(s, focus, 0, y + pool.h + 16, leftW, L, N);
      const ro = renderReadout(p, t, all, leftW + 28, y, w - leftW - 28, L);
      parts.push(pool.svg, tb.svg, ro.svg);
      y += Math.max(pool.h + 16 + tb.h, ro.h);
    }
    return svg(w, y + 4, describe(st, lang), ...parts);
  },
  describe,
});

