// The load-latency knee of one served model: an open-loop load sweep over a
// simulated continuous-batching server, drawn as TTFT and TPOT percentiles,
// the fate of offered requests, and the largest load that passes the joint
// latency gate Pr(TTFT <= F, TPOT <= D | admitted) >= alpha.
//
// The server is one NVIDIA H100 SXM running a dense model with the shape of
// Llama 3 8B (Grattafiori et al. 2024, arXiv:2407.21783): 8.03e9 parameters,
// L = 32 layers, n_kv = 8 key-value heads of d_head = 128, 32 query heads, BF16
// weights and cache. Hardware rates are the dense BF16 datasheet peaks
// (989 TFLOP/s, 3.35 TB/s, 80 GB), as in roofline.ts: ceilings, not sustained
// rates, so every latency here is a lower bound for this shape.
//
// Each model iteration takes the roofline bound of the serving-problem
// chapter, tau = max(F / P, D / B), where F counts 2 FLOP per parameter per
// processed token plus attention over the cached context, and D counts the
// weights once plus every cached key and value read and written. A request
// holds 2·L·n_kv·d_head·b_kv = 131,072 bytes of KV state per token, and the
// pool is what remains of 80 GB after the weights and 12 GB of workspace and
// reserve (about 396k tokens).
//
// Scheduling is iteration-level (continuous batching), first come first
// served: an iteration admits waiting requests while fewer than `cap` are
// running, the pool can hold their prompts, and the admitted prompt tokens
// stay within an 8,192-token prefill budget; admitted prompts are prefilled
// whole in the same iteration as one decode token for every running request.
// When decode growth would overflow the pool, the most recently admitted
// request is preempted and later recomputed. A request still waiting 10 s
// after arrival times out.
//
// The trace is illustrative and seeded: Poisson arrivals, short prompts
// log-normal around 600 tokens, long prompts around 6,000, outputs around 180.
// The same unit-rate trace is replayed at every offered load (common random
// numbers), so the curves move with the load rather than with sampling noise.
// Statistics use the requests from 10% to 90% of the trace.
//
// Decode-only stretches between events are summed in closed form (the
// iterations are memory-bound for every cap offered, and their time grows
// linearly with the cached context), which gives the same result as stepping
// one iteration at a time and keeps a 96-point sweep to a few milliseconds.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng, exponential } from "./lib/random.ts";
import { normalFrom } from "./lib/stats.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap, placeLabels, drawLabels, lineObstacles, type Box } from "./lib/labels.ts";
import { sig, fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const PARAMS = 8.03e9;
const WEIGHT_BYTES = 2 * PARAMS;
const LAYERS = 32, N_KV = 8, D_HEAD = 128, B_KV = 2, Q_WIDTH = 32 * 128;
const KV_BYTES_PER_TOKEN = 2 * LAYERS * N_KV * D_HEAD * B_KV; // 131,072
const ATTN_FLOP = 4 * LAYERS * Q_WIDTH; // per new token per cached position (q·k and weights·v)
const PEAK_FLOPS = 989e12;
const PEAK_BW = 3.35e12;
const DEVICE_BYTES = 80e9;
const OTHER_BYTES = 12e9; // workspace and safety reserve
const KV_POOL = Math.floor((DEVICE_BYTES - WEIGHT_BYTES - OTHER_BYTES) / KV_BYTES_PER_TOKEN);
const PREFILL_BUDGET = 8192;
const TIMEOUT = 10; // seconds a request may wait before it is dropped
const REQUESTS = 2000;
const ALPHA = 0.99;
const LOAD_STEP = 0.5;
const LOAD_MAX = 48;
const GRID = Array.from({ length: LOAD_MAX / LOAD_STEP }, (_, i) => (i + 1) * LOAD_STEP);
export const CAPS = [8, 16, 32, 64, 128, 256] as const;

interface Trace { gap: Float64Array; cls: Float64Array; zp: Float64Array; zo: Float64Array }
interface Lengths { prompt: Int32Array; out: Int32Array }

const traces = new Map<number, Trace>();
function traceFor(seed: number): Trace {
  let tr = traces.get(seed);
  if (!tr) {
    const u = rng(seed);
    const n = REQUESTS;
    tr = { gap: new Float64Array(n), cls: new Float64Array(n), zp: new Float64Array(n), zo: new Float64Array(n) };
    for (let i = 0; i < n; i++) {
      tr.gap[i] = exponential(u(), 1);
      tr.cls[i] = u();
      tr.zp[i] = normalFrom(u(), u());
      tr.zo[i] = normalFrom(u(), u());
    }
    if (traces.size > 8) traces.clear();
    traces.set(seed, tr);
  }
  return tr;
}

// Prompt and output lengths for a long-prompt share; the same draws at every
// share, so raising the share turns short requests into long ones in place.
function lengthsFor(tr: Trace, longShare: number): Lengths {
  const n = tr.gap.length;
  const prompt = new Int32Array(n), out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const long = tr.cls[i] < longShare;
    const p = long ? 6000 * Math.exp(0.35 * tr.zp[i]) : 600 * Math.exp(0.8 * tr.zp[i]);
    prompt[i] = Math.round(Math.min(long ? 16000 : 4096, Math.max(16, p)));
    out[i] = Math.round(Math.min(1024, Math.max(2, 180 * Math.exp(0.8 * tr.zo[i]))));
  }
  return { prompt, out };
}

// Min-heap of (key, id): finishing iterations of running requests.
class Heap {
  k: number[] = [];
  v: number[] = [];
  push(key: number, id: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(id);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = id;
  }
  pop() {
    const k = this.k, v = this.v;
    const lk = k.pop()!, lv = v.pop()!;
    if (!k.length) return;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= k.length) break;
      if (c + 1 < k.length && k[c + 1] < k[c]) c++;
      if (k[c] >= lk) break;
      k[i] = k[c]; v[i] = v[c]; i = c;
    }
    k[i] = lk; v[i] = lv;
  }
}

interface Sim { arr: Float64Array; start: Float64Array; first: Float64Array; fin: Float64Array; batch: number; mu: number }

// One open-loop run at offered load `lam` (requests per second). With
// `saturate`, every request is waiting at t = 0 and none times out; the
// completions while requests are still waiting give the service rate mu.
function simulate(lens: Lengths, gap: Float64Array, lam: number, cap: number, saturate = false): Sim {
  const { prompt, out } = lens;
  const n = prompt.length;
  const deadline = saturate ? Infinity : TIMEOUT;
  const arr = new Float64Array(n);
  for (let i = 1, a = 0; i < n; i++) { a += gap[i] / lam; arr[i] = saturate ? 0 : a; }
  const start = new Float64Array(n).fill(-1), first = new Float64Array(n).fill(-1), fin = new Float64Array(n).fill(-1);
  // A running request's context and output count grow by one per iteration,
  // so both are stored as values at a base iteration.
  const genB = new Int32Array(n), ctxB = new Int32Array(n), itB = new Float64Array(n);
  const running = new Uint8Array(n);
  const queue = new Int32Array(n); // FCFS; preempted requests return to the head
  let qh = 0, qt = 0;
  const stack: number[] = []; // running requests in admission order (lazy deletion)
  const heap = new Heap();
  let nRun = 0, kv = 0, ctxSum = 0, t = 0, next = 0, it = 0, batchSum = 0, muDone = 0, muT = 0;
  const ctxOf = (r: number) => ctxB[r] + (it - itB[r]);
  const adm: number[] = [];

  for (;;) {
    while (next < n && arr[next] <= t) queue[qt++] = next++;
    if (nRun === 0 && qh >= qt) { if (next >= n) break; t = arr[next]; continue; }
    // Decode stores one more token per running request: preempt the newest until it fits.
    while (nRun && kv + nRun > KV_POOL) {
      let v = stack.pop()!;
      while (!running[v]) v = stack.pop()!;
      const c = ctxOf(v);
      genB[v] += it - itB[v];
      kv -= c; ctxSum -= c; running[v] = 0; nRun--;
      queue[--qh] = v;
    }
    const nDec = nRun;
    let pre = 0, preAttn = 0;
    adm.length = 0;
    while (qh < qt && nDec + adm.length < cap) {
      const r = queue[qh];
      if (first[r] < 0 && t - arr[r] > deadline) { qh++; continue; }
      const need = prompt[r] + genB[r];
      if (kv + need + nDec > KV_POOL) break;
      if (pre > 0 && pre + need > PREFILL_BUDGET) break;
      qh++; adm.push(r); pre += need; preAttn += (need * (need + 1)) / 2; kv += need;
    }
    if (!adm.length && !nDec) continue; // only timed-out requests were waiting
    if (adm.length) {
      // One mixed iteration: whole-prompt prefill plus one decode token per running request.
      const F = 2 * PARAMS * (pre + nDec) + ATTN_FLOP * (preAttn + ctxSum);
      const D = WEIGHT_BYTES + KV_BYTES_PER_TOKEN * (ctxSum + pre + nDec);
      for (const r of adm) if (start[r] < 0) start[r] = t;
      t += Math.max(F / PEAK_FLOPS, D / PEAK_BW);
      it++; batchSum += nDec + adm.length;
      kv += nDec; ctxSum += nDec;
      for (const r of adm) {
        if (first[r] < 0) first[r] = t;
        const need = prompt[r] + genB[r];
        ctxB[r] = need; genB[r] += 1; itB[r] = it; running[r] = 1; nRun++; ctxSum += need; stack.push(r);
        heap.push(it + out[r] - genB[r], r);
      }
    } else {
      // Decode-only stretch of k iterations. Iteration j reads ctxSum + j·nDec
      // cached tokens, so its time is A + Bk·j while it stays memory-bound.
      const A = (WEIGHT_BYTES + KV_BYTES_PER_TOKEN * (ctxSum + nDec)) / PEAK_BW;
      const Bk = (KV_BYTES_PER_TOKEN * nDec) / PEAK_BW;
      const S = (k: number) => k * A + (Bk * k * (k - 1)) / 2;
      // Smallest k with S(k) >= d (strict: S(k) > d).
      const reach = (d: number, strict: boolean) => {
        let k = Math.max(1, Math.ceil((-(A - Bk / 2) + Math.sqrt((A - Bk / 2) ** 2 + 2 * Bk * d)) / Bk));
        const ok = (x: number) => (strict ? S(x) > d : S(x) >= d);
        while (k > 1 && ok(k - 1)) k--;
        while (!ok(k)) k++;
        return k;
      };
      let k = Math.max(1, Math.min(heap.k[0] - it, Math.floor((KV_POOL - kv) / nDec)));
      // An arrival matters only when a slot is free and nobody is waiting.
      if (next < n && nDec < cap && qh >= qt) k = Math.min(k, reach(arr[next] - t, false));
      // A waiting head that times out can unblock the requests behind it.
      if (qh < qt && nDec < cap && first[queue[qh]] < 0 && deadline < Infinity) k = Math.min(k, reach(arr[queue[qh]] + deadline - t, true));
      const fAt = (j: number) => (2 * PARAMS * nDec + ATTN_FLOP * (ctxSum + j * nDec)) / PEAK_FLOPS;
      if (fAt(0) > A || fAt(k - 1) > A + Bk * (k - 1)) k = 1;
      t += k === 1 ? Math.max(fAt(0), A) : S(k);
      it += k; batchSum += k * nDec; kv += k * nDec; ctxSum += k * nDec;
    }
    // Completions leave the batch and free their cache.
    while (heap.k.length && heap.k[0] <= it) {
      const r = heap.v[0], key = heap.k[0];
      heap.pop();
      if (!running[r] || itB[r] + out[r] - genB[r] !== key) continue; // preempted since
      const c = ctxOf(r);
      kv -= c; ctxSum -= c; running[r] = 0; nRun--; fin[r] = t;
      if (qh < qt) { muDone++; muT = t; }
    }
  }
  return { arr, start, first, fin, batch: it ? batchSum / it : 0, mu: muT > 0 ? muDone / muT : 0 };
}

// Per offered load: the admitted requests' TTFT and TPOT (for the gate at
// any limits), their percentiles, the timed-out share, and the mean terms of
// the chapter's critical-path decomposition.
interface Point {
  lam: number;
  ttft: Float32Array;
  tpot: Float32Array;
  offered: number; // requests in the measurement window
  timedOut: number;
  p50ttft: number; p99ttft: number; p50tpot: number; p99tpot: number;
  queue: number; prefill: number; decode: number; // mean seconds per admitted request
  batch: number;
}
interface Sweep { points: Point[]; mu: number }

function quantile(sorted: Float32Array, q: number): number {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN;
}

function measure(s: Sim, lens: Lengths, lam: number): Point {
  const n = lens.out.length, w0 = Math.floor(n * 0.1), w1 = Math.floor(n * 0.9);
  const tt: number[] = [], tp: number[] = [];
  let q = 0, pf = 0, dc = 0, to = 0;
  for (let i = w0; i < w1; i++) {
    if (s.first[i] < 0) { to++; continue; }
    tt.push(s.first[i] - s.arr[i]);
    tp.push((s.fin[i] - s.first[i]) / (lens.out[i] - 1));
    q += s.start[i] - s.arr[i]; pf += s.first[i] - s.start[i]; dc += s.fin[i] - s.first[i];
  }
  const ttft = Float32Array.from(tt), tpot = Float32Array.from(tp);
  const st = Float32Array.from(tt).sort(), sp = Float32Array.from(tp).sort();
  const m = Math.max(1, tt.length);
  return {
    lam, ttft, tpot, offered: w1 - w0, timedOut: to,
    p50ttft: quantile(st, 0.5), p99ttft: quantile(st, 0.99), p50tpot: quantile(sp, 0.5), p99tpot: quantile(sp, 0.99),
    queue: q / m, prefill: pf / m, decode: dc / m, batch: s.batch,
  };
}

// Sweeps are computed lazily and memoized per (cap, share, seed): the curves
// of the chosen cap read every grid point, the other caps only the few points
// a bisection for λ* visits, so a change of mix stays cheap.
interface Cache { lens: Lengths; gap: Float64Array; points: Array<Point | undefined>; mu: number }
const caches = new Map<string, Cache>();
function cache(cap: number, longPct: number, seed: number): Cache {
  const key = `${cap}|${longPct}|${seed}`;
  let hit = caches.get(key);
  if (!hit) {
    const tr = traceFor(seed);
    const lens = lengthsFor(tr, longPct / 100);
    hit = { lens, gap: tr.gap, points: new Array(GRID.length), mu: simulate(lens, tr.gap, 1, cap, true).mu };
    if (caches.size >= 18) caches.delete(caches.keys().next().value!);
    caches.set(key, hit);
  }
  return hit;
}
function pointAt(c: Cache, cap: number, i: number): Point {
  let pt = c.points[i];
  if (!pt) { pt = measure(simulate(c.lens, c.gap, GRID[i], cap), c.lens, GRID[i]); c.points[i] = pt; }
  return pt;
}
function sweep(cap: number, longPct: number, seed: number): Sweep {
  const c = cache(cap, longPct, seed);
  return { points: GRID.map((_, i) => pointAt(c, cap, i)), mu: c.mu };
}

// Share of admitted requests inside both limits.
function attainment(pt: Point, F: number, D: number): number {
  let ok = 0;
  for (let i = 0; i < pt.ttft.length; i++) if (pt.ttft[i] <= F && pt.tpot[i] <= D) ok++;
  return pt.ttft.length ? ok / pt.ttft.length : 0;
}

// The largest load that passes the gate: the grid step where attainment
// falls below alpha (found by bisection, attainment falls with load),
// interpolated between its two points, and never past mu. A finite trace
// loaded just past mu has not yet grown the queue it would grow without
// bound, so the stability condition lambda < mu is applied as the chapter
// states it.
function maxLoad(cap: number, longPct: number, seed: number, F: number, D: number): number {
  const c = cache(cap, longPct, seed);
  const att = (i: number) => attainment(pointAt(c, cap, i), F, D);
  if (att(0) < ALPHA) return 0;
  let lo = 0, hi = GRID.length - 1;
  if (att(hi) >= ALPHA) return Math.min(c.mu, LOAD_MAX);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (att(m) >= ALPHA) lo = m; else hi = m; }
  const a0 = att(lo), a1 = att(hi);
  return Math.min(c.mu, GRID[lo] + ((a0 - ALPHA) / (a0 - a1)) * LOAD_STEP);
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Offered load against latency for one served model",
    p99: "p99",
    p50: "p50",
    ttftPanel: "TTFT of admitted requests (s)",
    tpotPanel: "TPOT of admitted requests (ms)",
    fatePanel: "Offered requests by outcome (per second)",
    capPanel: "Largest load inside the SLO, by batch cap",
    x: "offered load λ (requests per second)",
    ttftLimit: "TTFT limit F = {v}",
    tpotLimit: "TPOT limit D = {v} ms",
    timeout: "timeout {v} s",
    good: "meets both limits",
    late: "admitted, misses a limit",
    dropped: "timed out in the queue",
    star: "λ* {v}",
    mu: "μ {v}",
    cursor: "λ {v}",
    rowNone: "no load passes",
    rowVal: "λ* {s}, μ {m}",
    cap: "cap {c}",
    at: "At λ = {l} req/s: ρ = λ / μ = {r}, mean batch {b} of {c}",
    e2e: "mean E2E = T_queue + T_prefill + Σ T_decode",
    e2eVals: "{e} s = {q} + {p} + {d} s  (T_tools = 0 here)",
    queue: "queue",
    prefill: "prefill",
    decode: "decode",
    gate: "Pr(TTFT ≤ {f}, TPOT ≤ {d} ms | admitted) = {a}",
    pass: "meets α = 99%",
    fail: "misses α = 99%",
    fates: "timed out {o} of offered, goodput {g} req/s",
    starLine: "λ* = {s} req/s passes the gate, ρ = λ* / μ = {r}",
    starMu: "The gate holds up to λ* = μ = {s} req/s; past μ the queue grows without bound",
    unstable: "λ > μ: queue unstable",
    starNone: "No offered load passes the gate at these limits",
    describe: "Batch cap {c}, {long}% long prompts, TTFT limit {f} and TPOT limit {d} ms: the largest load where 99% of admitted requests meet both is {s} requests per second, against a service rate μ of {m}. At {l} requests per second, {a} of admitted requests meet both limits and {o} of offered requests time out.",
    describeNone: "Batch cap {c}, {long}% long prompts, TTFT limit {f} and TPOT limit {d} ms: no load meets the 99% gate. At {l} requests per second, {a} of admitted requests meet both limits and {o} of offered requests time out.",
  },
  zh: {
    title: "单个线上模型的输入负载与延迟",
    p99: "p99",
    p50: "p50",
    ttftPanel: "已准入请求的 TTFT（秒）",
    tpotPanel: "已准入请求的 TPOT（毫秒）",
    fatePanel: "输入请求的去向（每秒）",
    capPanel: "各批上限下满足 SLO 的最大负载",
    x: "输入负载 λ（每秒请求数）",
    ttftLimit: "TTFT 上限 F = {v}",
    tpotLimit: "TPOT 上限 D = {v} ms",
    timeout: "超时 {v} s",
    good: "两项上限都满足",
    late: "已准入，超出上限",
    dropped: "排队超时",
    star: "λ* {v}",
    mu: "μ {v}",
    cursor: "λ {v}",
    rowNone: "没有负载能通过",
    rowVal: "λ* {s}，μ {m}",
    cap: "上限 {c}",
    at: "λ = {l} 个/秒时：ρ = λ / μ = {r}，平均批大小 {b}（上限 {c}）",
    e2e: "平均 E2E = T_queue + T_prefill + Σ T_decode",
    e2eVals: "{e} s = {q} + {p} + {d} s（此处 T_tools = 0）",
    queue: "排队",
    prefill: "预填充",
    decode: "解码",
    gate: "Pr(TTFT ≤ {f}, TPOT ≤ {d} ms | admitted) = {a}",
    pass: "达到 α = 99%",
    fail: "未达到 α = 99%",
    fates: "超时占输入的 {o}，有效吞吐 {g} 个/秒",
    starLine: "λ* = {s} 个/秒可通过门槛，ρ = λ* / μ = {r}",
    starMu: "门槛一直成立到 λ* = μ = {s} 个/秒；超过 μ，队列会无限增长",
    unstable: "λ > μ：队列不稳定",
    starNone: "在这组上限下，任何输入负载都无法通过门槛",
    describe: "批上限 {c}，长提示词占 {long}%，TTFT 上限 {f}，TPOT 上限 {d} ms：99% 的已准入请求同时满足两项上限的最大负载为每秒 {s} 个请求，服务率 μ 为 {m}。每秒 {l} 个请求时，{a} 的已准入请求满足两项上限，{o} 的输入请求排队超时。",
    describeNone: "批上限 {c}，长提示词占 {long}%，TTFT 上限 {f}，TPOT 上限 {d} ms：没有任何负载能通过 99% 的门槛。每秒 {l} 个请求时，{a} 的已准入请求满足两项上限，{o} 的输入请求排队超时。",
  },
};

type P = { load: number; cap: number; long: number; tpot: number; ttft: number; seed: number };

const fmtS = (v: number) => (v >= 1 ? `${sig(v, 2)} s` : `${sig(v * 1000, 2)} ms`);
const fmtLam = (v: number) => fixed(v, 1);

function state(p: P) {
  const sw = sweep(p.cap, p.long, p.seed);
  const F = p.ttft, D = p.tpot / 1000;
  const star = maxLoad(p.cap, p.long, p.seed, F, D);
  const idx = Math.min(GRID.length - 1, Math.max(0, Math.round(p.load / LOAD_STEP) - 1));
  const pt = sw.points[idx];
  const att = attainment(pt, F, D);
  let good = 0;
  for (let i = 0; i < pt.ttft.length; i++) if (pt.ttft[i] <= F && pt.tpot[i] <= D) good++;
  return { sw, F, D, star, pt, att, goodShare: good / pt.offered, toShare: pt.timedOut / pt.offered };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const s = state(p);
  return tpl(s.star > 0 ? L.describe : L.describeNone, {
    c: p.cap, long: p.long, f: fmtS(p.ttft), d: p.tpot, s: fmtLam(s.star), m: fmtLam(s.sw.mu),
    l: fmtLam(p.load), a: pct(s.att, 1), o: pct(s.toShare, 1),
  });
}

// Spread labels along one row so none overlap: each wants to sit centered on
// its x; overlapping neighbors are pushed apart and kept inside [x0, x1].
function dodge(items: Array<{ x: number; w: number }>, x0: number, x1: number, gap = 6): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].x - items[b].x);
  const pos = items.map((it) => Math.min(Math.max(it.x - it.w / 2, x0), x1 - it.w));
  for (let pass = 0; pass < 4; pass++) {
    for (let k = 1; k < order.length; k++) {
      const a = order[k - 1], b = order[k];
      const need = pos[a] + items[a].w + gap;
      if (pos[b] < need) pos[b] = need;
    }
    for (let k = order.length - 1; k >= 0; k--) {
      const b = order[k];
      if (pos[b] + items[b].w > x1) pos[b] = x1 - items[b].w;
      if (k > 0) { const a = order[k - 1]; if (pos[a] + items[a].w + gap > pos[b]) pos[a] = pos[b] - gap - items[a].w; }
    }
    for (const i of order) pos[i] = Math.max(pos[i], x0);
  }
  return pos;
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  // Phone text is set a step larger so it stays at 12 px or more once the
  // 320-unit layout is scaled to a 312 px column.
  const SM = narrow ? 12.5 : TYPE.small, BD = narrow ? 13 : TYPE.body;
  const s = state(p);
  const { sw, F, D } = s;
  const pts = sw.points;
  const parts: string[] = [];

  const left = narrow ? 40 : 48;
  const right = w - (narrow ? 6 : 10);
  const x = linear([0, LOAD_MAX], [left, right]);
  const xTicks = x.ticks(narrow ? 5 : 8);
  const hTtft = narrow ? 132 : 150, hTpot = narrow ? 92 : 100, hFate = narrow ? 92 : 100;
  const rowH = narrow ? 17 : 14;

  // Legend: line styles for the percentiles, then the outcome bands.
  const lg = legend([
    { label: L.p99, swatch: { kind: "line", stroke: C.ink } },
    { label: L.p50, swatch: { kind: "line", stroke: C.ink, dash: "4 3" } },
    { label: L.good, swatch: { kind: "rect", fill: C.good, opacity: 0.55 } },
    { label: L.late, swatch: { kind: "rect", fill: C.warn, opacity: 0.6 } },
    { label: L.dropped, swatch: { kind: "rect", fill: C.bad, opacity: 0.55 } },
    { label: L.unstable, swatch: { kind: "rect", fill: C.ink3, pattern: `${st.uid}-unstable` } },
  ], 0, 0, w, SM);
  parts.push(el("defs", {}, hatch(`${st.uid}-unstable`, C.ink3, 6, 1)));
  parts.push(lg.svg);

  // Marker labels above the first panel: λ*, μ, and the reader's λ.
  // Panel 1's title sits above the marker labels, so leader lines from the
  // labels down to the plot never cross it.
  const titleY = lg.height + 22;
  const bandY = titleY + 22;
  const top1 = bandY + 12;
  const bottom1 = top1 + hTtft;
  const top2 = bottom1 + 34;
  const bottom2 = top2 + hTpot;
  const top3 = bottom2 + 34;
  const bottom3 = top3 + hFate;
  const top4 = bottom3 + 34;
  const bottom4 = top4 + CAPS.length * rowH;

  const panels: Array<[number, number]> = [[top1, bottom1], [top2, bottom2], [top3, bottom3]];
  for (const [t0, t1] of panels) {
    for (const v of xTicks) parts.push(el("line", { x1: x(v), x2: x(v), y1: t0, y2: t1, stroke: C.grid, "stroke-width": 1 }));
    parts.push(el("line", { x1: left, x2: right, y1: t1, y2: t1, stroke: C.rule, "stroke-width": 1 }));
  }
  for (const v of xTicks) parts.push(el("line", { x1: x(v), x2: x(v), y1: top4, y2: bottom4, stroke: C.grid, "stroke-width": 1 }));

  // Vertical markers: λ*, μ, and the reader's λ.
  const marks: Array<{ x: number; text: string; cls: string; line: Record<string, string | number> }> = [];
  if (s.star > 0) marks.push({ x: x(s.star), text: tpl(L.star, { v: fmtLam(s.star) }), cls: "fig-t-strong fig-t-num", line: { stroke: C.ink, "stroke-width": 1.4 } });
  if (sw.mu <= LOAD_MAX) marks.push({ x: x(sw.mu), text: tpl(L.mu, { v: fmtLam(sw.mu) }), cls: "fig-t-muted fig-t-num", line: { stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" } });
  marks.push({ x: x(p.load), text: tpl(L.cursor, { v: fmtLam(p.load) }), cls: "fig-t-num", line: { stroke: C.c7, "stroke-width": 1.4 } });
  const markObs = (t0: number, t1: number) => marks.flatMap((m) => lineObstacles([[m.x, t0], [m.x, t1]], 6, 3));
  // A label for a horizontal line, tried at anchors from the right end to the
  // left, above or below the line. Curves are hard obstacles; the marker lines
  // are soft (a haloed label may cross one) and are dropped on a second pass.
  const onLine = (txt: string, yl: number, cls: string, bounds: Box, hard: Box[], soft: Box[]) => {
    const xs: number[] = [];
    for (let ax = right - 2; ax > left + 4; ax -= 24) xs.push(ax);
    xs.push(left + 4);
    for (const obstacles of [[...hard, ...soft], hard]) {
      for (const ax of xs) {
        const sides = ax > (left + right) / 2 ? (["above-left", "below-left"] as const) : (["above-right", "below-right"] as const);
        const r = placeLabels([{ x: ax, y: yl, text: txt, size: SM, sides: [...sides], gap: 4, attrs: { class: cls } }], bounds, obstacles);
        if (r.placed.length) return r.placed;
      }
    }
    return placeLabels([{ x: right - 2, y: yl, text: txt, size: SM, sides: ["above-left"], gap: 4, attrs: { class: cls } }], bounds, []).placed;
  };

  const curve = (vals: number[], y: (v: number) => number): Array<[number, number]> =>
    pts.map((pt, i) => [x(pt.lam), y(vals[i])] as [number, number]).filter(([, yy]) => Number.isFinite(yy));

  // Past μ the queue grows without bound in steady state; a finite trace
  // only shows the start of that growth, so the region is marked.
  const unstable = (t0: number, t1: number, opacity: number) => (sw.mu < LOAD_MAX
    ? el("rect", { x: x(sw.mu), y: t0, width: right - x(sw.mu), height: t1 - t0, fill: `url(#${st.uid}-unstable)`, opacity })
    : "");

  // ---- panel 1: TTFT, log scale
  const yT = log([0.005, 20], [bottom1, top1]);
  parts.push(text(left, titleY, L.ttftPanel, { "font-size": SM, class: "fig-t-muted" }));
  parts.push(axis({ scale: yT, orient: "left", at: left, grid: [left, right], ticks: [0.01, 0.1, 1, 10], format: (v) => (v >= 1 ? sig(v, 2) : sig(v, 1)), size: SM }));
  const clampT = (v: number) => yT(Math.min(20, Math.max(0.005, v)));
  const t99 = curve(pts.map((pt) => pt.p99ttft), clampT);
  const t50 = curve(pts.map((pt) => pt.p50ttft), clampT);
  const obs1: Box[] = [...lineObstacles(t99), ...lineObstacles(t50)];
  // Timeout and TTFT limit lines.
  parts.push(unstable(top1, bottom1, 0.5));
  parts.push(el("line", { x1: left, x2: right, y1: yT(TIMEOUT), y2: yT(TIMEOUT), stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "1 3" }));
  parts.push(el("line", { x1: left, x2: right, y1: yT(F), y2: yT(F), stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(t50), fill: "none", stroke: C.c1, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: linePath(t99), fill: "none", stroke: C.c1, "stroke-width": 2.2, "stroke-linejoin": "round" }));
  const b1 = { x0: left + 2, y0: top1 - 2, x1: right, y1: bottom1 - 2 };
  const limF = onLine(tpl(L.ttftLimit, { v: fmtS(F) }), yT(F), "fig-t-halo", b1, obs1, markObs(top1, bottom1));
  const limT = onLine(tpl(L.timeout, { v: TIMEOUT }), yT(TIMEOUT), "fig-t-halo fig-t-soft", b1, [...obs1, ...limF.map((q) => q.box)], markObs(top1, bottom1));
  parts.push(drawLabels([...limF, ...limT]));

  // ---- panel 2: TPOT, linear in ms
  const yP = linear([0, 70], [bottom2, top2]);
  parts.push(axis({ scale: yP, orient: "left", at: left, grid: [left, right], title: L.tpotPanel, ticks: [0, 20, 40, 60], format: (v) => String(v), size: SM }));
  const clampP = (v: number) => yP(Math.min(70, v * 1000));
  const p99 = curve(pts.map((pt) => pt.p99tpot), clampP);
  const p50 = curve(pts.map((pt) => pt.p50tpot), clampP);
  parts.push(unstable(top2, bottom2, 0.5));
  parts.push(el("line", { x1: left, x2: right, y1: yP(p.tpot), y2: yP(p.tpot), stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(p50), fill: "none", stroke: C.c2, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: linePath(p99), fill: "none", stroke: C.c2, "stroke-width": 2.2, "stroke-linejoin": "round" }));
  const obs2 = [...lineObstacles(p99), ...lineObstacles(p50)];
  const b2 = { x0: left + 2, y0: top2 - 2, x1: right, y1: bottom2 - 2 };
  parts.push(drawLabels(onLine(tpl(L.tpotLimit, { v: p.tpot }), yP(p.tpot), "fig-t-halo", b2, obs2, markObs(top2, bottom2))));

  // ---- panel 3: offered requests by outcome, stacked to the diagonal y = λ
  const yF = linear([0, LOAD_MAX], [bottom3, top3]);
  parts.push(axis({ scale: yF, orient: "left", at: left, grid: [left, right], title: L.fatePanel, ticks: [0, 20, 40], format: (v) => String(v), size: SM }));
  const goodR: number[] = [], admR: number[] = [];
  for (const pt of pts) {
    let ok = 0;
    for (let i = 0; i < pt.ttft.length; i++) if (pt.ttft[i] <= F && pt.tpot[i] <= D) ok++;
    goodR.push((pt.lam * ok) / pt.offered);
    admR.push((pt.lam * pt.ttft.length) / pt.offered);
  }
  const band = (lo: number[], hi: number[]) => {
    const up = pts.map((pt, i) => [x(pt.lam), yF(hi[i])] as [number, number]);
    const dn = pts.map((pt, i) => [x(pt.lam), yF(lo[i])] as [number, number]).reverse();
    return `M${x(0)},${yF(0)}` + linePath(up).replace(/^M/, "L") + linePath(dn).replace(/^M/, "L") + "Z";
  };
  const zeros = pts.map(() => 0), lams = pts.map((pt) => pt.lam);
  parts.push(el("path", { d: band(zeros, goodR), fill: C.good, "fill-opacity": 0.55 }));
  parts.push(el("path", { d: band(goodR, admR), fill: C.warn, "fill-opacity": 0.6 }));
  parts.push(el("path", { d: band(admR, lams), fill: C.bad, "fill-opacity": 0.55 }));
  parts.push(unstable(top3, bottom3, 0.6));
  parts.push(el("path", { d: linePath([[x(0), yF(0)], ...pts.map((pt) => [x(pt.lam), yF(pt.lam)] as [number, number])]), fill: "none", stroke: C.ink2, "stroke-width": 1 }));

  // ---- panel 4: λ* and μ for every batch cap on the same load axis
  parts.push(text(left, top4 - 10, L.capPanel, { "font-size": SM, class: "fig-t-muted" }));
  CAPS.forEach((c, i) => {
    const muc = cache(c, p.long, p.seed).mu;
    const sc = maxLoad(c, p.long, p.seed, F, D);
    const y0 = top4 + i * rowH;
    const on = c === p.cap;
    if (on) parts.push(el("rect", { x: 0, y: y0, width: w, height: rowH, fill: C.panel }));
    parts.push(text(left - 8, y0 + rowH / 2 + SM * 0.36, c, { "font-size": SM, "text-anchor": "end", class: on ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    if (sc > 0) parts.push(el("rect", { x: left, y: y0 + 3, width: Math.max(1, x(sc) - left), height: rowH - 6, rx: 1.5, fill: on ? C.c1 : C.ink3, "fill-opacity": on ? 0.85 : 0.45 }));
    const xm = x(Math.min(LOAD_MAX, muc));
    parts.push(el("line", { x1: xm, x2: xm, y1: y0 + 1, y2: y0 + rowH - 1, stroke: C.ink, "stroke-width": 2 }));
    const lbl = sc > 0 ? tpl(L.rowVal, { s: fmtLam(sc), m: fmtLam(muc) }) : L.rowNone;
    const lw = textWidth(lbl, SM);
    const fitsRight = xm + 6 + lw <= right;
    parts.push(text(fitsRight ? xm + 6 : Math.max(left + 4, Math.min(x(Math.max(sc, 0)), xm) - 7), y0 + rowH / 2 + SM * 0.36, lbl,
      { "font-size": SM, "text-anchor": fitsRight ? "start" : "end", class: `fig-t-num fig-t-halo${on ? " fig-t-strong" : " fig-t-muted"}` }));
    parts.push(el("rect", { x: 0, y: y0, width: w, height: rowH, fill: "transparent", "data-fig-set": `cap=${c}`, class: "fig-hit" }));
  });

  // ---- x axis under the rows
  parts.push(axis({ scale: x, orient: "bottom", at: bottom4 + 2, ticks: xTicks, title: L.x, format: (v) => String(v), size: SM }));

  // ---- vertical markers across the panels: λ*, μ, and the reader's λ
  const markTop = top1;
  // Lines run inside each panel only, so the panel titles stay clear.
  for (const m of marks) {
    for (const [t0, t1] of panels) parts.push(el("line", { x1: m.x, x2: m.x, y1: t0, y2: t1, ...m.line }));
  }
  // Bold digits run wider than the estimate; pad before spreading.
  const widths = marks.map((m) => textWidth(m.text, SM) * 1.1);
  const pos = dodge(marks.map((m, i) => ({ x: m.x, w: widths[i] })), 0, w, 10);
  marks.forEach((m, i) => {
    const cx = pos[i] + widths[i] / 2;
    parts.push(text(pos[i], bandY, m.text, { "font-size": SM, class: m.cls }));
    parts.push(el("line", { x1: cx, x2: m.x, y1: bandY + 4, y2: markTop, stroke: C.ink3, "stroke-width": 1 }));
  });
  // Operating point on the p99 curves.
  const cur = s.pt;
  parts.push(el("circle", { cx: x(cur.lam), cy: clampT(cur.p99ttft), r: 4, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx: x(cur.lam), cy: clampP(cur.p99tpot), r: 4, fill: C.c2, stroke: C.paper, "stroke-width": 1.5 }));

  // Click a column of the panels to move λ there.
  const colW = x(LOAD_STEP) - x(0);
  for (const lam of GRID) {
    parts.push(el("rect", { x: x(lam) - colW / 2, y: top1, width: colW, height: bottom3 - top1, fill: "transparent", "data-fig-set": `load=${lam}`, class: "fig-hit" }));
  }

  // ---- readout: the operating point in the chapter's terms
  let y = bottom4 + 2 + axisHeight(true, SM) + 16;
  const rp: string[] = [];
  const line = (str: string, cls = "", size: number = BD) => {
    for (const ln of wrap(str, size, cls.includes("strong") ? w / 1.08 : w)) { rp.push(text(0, y, ln, { "font-size": size, class: cls })); y += size + 6; }
  };
  line(tpl(L.at, { l: fmtLam(p.load), r: fixed(p.load / sw.mu, 2), b: Math.round(cur.batch), c: p.cap }), "fig-t-strong");
  y += 2;
  line(L.e2e, "fig-t-muted", SM);
  // Stacked bar of the mean terms.
  const e2e = cur.queue + cur.prefill + cur.decode;
  const segs: Array<[string, number, string]> = [[L.queue, cur.queue, C.c3], [L.prefill, cur.prefill, C.c1], [L.decode, cur.decode, C.c2]];
  let bx = 0;
  const barH = 16;
  rp.push(el("rect", { x: 0, y: y - 2, width: w, height: barH, rx: 3, fill: C.panel }));
  for (const [name, v, col] of segs) {
    const sw2 = e2e > 0 ? (v / e2e) * w : 0;
    if (sw2 > 0.5) rp.push(el("rect", { x: bx, y: y - 2, width: sw2, height: barH, fill: col, "fill-opacity": 0.85 }));
    if (sw2 >= textWidth(name, SM) + 8) rp.push(text(bx + 4, y + 10, name, { "font-size": SM, class: "fig-t-halo" }));
    bx += sw2;
  }
  y += barH + 14;
  line(tpl(L.e2eVals, { e: sig(e2e, 3), q: sig(cur.queue, 2), p: sig(cur.prefill, 2), d: sig(cur.decode, 3) }), "fig-t-num", SM);
  y += 4;
  // The gate, with its status.
  const pass = s.att >= ALPHA;
  const gateText = tpl(L.gate, { f: fmtS(F), d: p.tpot, a: pct(s.att, 1) });
  const status = pass ? L.pass : L.fail;
  const gw = textWidth(gateText, BD) * 1.04, stw = textWidth(status, SM) * 1.1 + 16;
  const chip = (cx0: number, cy: number) => {
    rp.push(el("rect", { x: cx0, y: cy - 12, width: stw, height: 17, rx: 8.5, fill: pass ? C.good : C.bad, "fill-opacity": 0.2, stroke: pass ? C.good : C.bad, "stroke-width": 1 }));
    rp.push(text(cx0 + 8, cy + 1, status, { "font-size": SM, class: "fig-t-strong" }));
  };
  if (gw + 10 + stw <= w) {
    rp.push(text(0, y, gateText, { "font-size": BD, class: "fig-t-num" }));
    chip(gw + 10, y);
    y += BD + 10;
  } else {
    line(gateText, "fig-t-num");
    chip(0, y + 2);
    y += 26;
  }
  line(tpl(L.fates, { o: pct(s.toShare, 1), g: sig(p.load * s.goodShare, 3) }), "fig-t-num");
  const atMu = s.star > 0 && s.star >= sw.mu - 1e-9;
  line(s.star <= 0 ? L.starNone : atMu ? tpl(L.starMu, { s: fmtLam(s.star) }) : tpl(L.starLine, { s: fmtLam(s.star), r: fixed(s.star / sw.mu, 2) }), "fig-t-muted", SM);
  parts.push(g({ class: "fig-readout" }, ...rp));

  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "load-latency-knee",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    load: {
      kind: "range", label: { en: "Offered load λ", zh: "输入负载 λ" }, unit: { en: "req/s", zh: "个/秒" },
      min: LOAD_STEP, max: LOAD_MAX, step: LOAD_STEP, default: 19,
    },
    cap: {
      kind: "choice", control: "buttons", label: { en: "Batch cap (requests decoding together)", zh: "批上限（同时解码的请求数）" }, default: 64,
      options: CAPS.map((c) => ({ value: c, label: { en: String(c), zh: String(c) } })),
    },
    long: {
      kind: "range", label: { en: "Share of long prompts (about 6k tokens)", zh: "长提示词占比（约 6k 词元）" }, unit: { en: "%", zh: "%" },
      min: 0, max: 40, step: 10, default: 10,
    },
    tpot: {
      kind: "range", label: { en: "TPOT limit D", zh: "TPOT 上限 D" }, unit: { en: "ms", zh: "ms" },
      min: 10, max: 60, step: 5, default: 30,
    },
    ttft: {
      kind: "range", scale: "log", label: { en: "TTFT limit F", zh: "TTFT 上限 F" }, unit: { en: "s", zh: "s" },
      min: 0.2, max: 5, default: 1, control: false,
    },
    seed: { kind: "range", label: { en: "Trace seed", zh: "轨迹种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
