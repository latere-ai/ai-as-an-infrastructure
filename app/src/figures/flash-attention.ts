// FlashAttention's forward pass over a small sequence: query tiles stay in
// on-chip memory while key-value blocks stream past, and each row keeps the
// running statistics of the online softmax (compilers-kernels chapter):
//
//   b_t = max_{j∈B_t} S_ij,   m_t = max(m_{t−1}, b_t),   α_t = exp(m_{t−1} − m_t),
//   ℓ_t = α_t ℓ_{t−1} + Σ_{j∈B_t} exp(S_ij − m_t),
//   o_t = α_t o_{t−1} + Σ_{j∈B_t} exp(S_ij − m_t) v_j,     O_i = o_T / ℓ_T,
//
// with m_0 = −∞, ℓ_0 = 0, o_0 = 0 and S = QKᵀ/√d + C.
//
// Q, K, V are illustrative: seeded draws (Irwin–Hall, so only integer and
// float arithmetic touch the seed and every engine produces the same values),
// generated for 32 tokens and truncated to N, so changing N keeps the first
// rows. Both the recurrence and the reference softmax run in FP32 (every
// operation rounded with Math.fround), so the check compares two evaluation
// orders of one function, as the chapter describes.
//
// The schedule is FlashAttention-2's order: the outer loop takes one query
// tile (rows stay on chip), the inner loop streams the key-value blocks. Under
// the causal mask, blocks whose keys all lie after the tile's last row are
// skipped. Query tiles are drawn one after another; on a GPU they run in
// parallel on different multiprocessors.
//
// HBM traffic is minimum algorithmic traffic in the two-level model: every
// element loaded or stored counts once, with perfect reuse inside each kernel.
// The naive baseline is separate kernels that write the N×N score matrix S and
// probability matrix P to HBM and read each back (Q, K, V read once, O written
// once, plus 4N² for S and P). The tiled kernel reads Q once, reads K and V
// once per query tile, and writes O once. With d_v = d the ratio of the two
// approaches 2·B_r/d for large N; B_r is bounded by on-chip memory, which is
// the chapter's H = Θ(N²d²/M).

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, hatch, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export const NMAX = 32;
const SIGMA = 1.25; // scale of q and k entries: S has a standard deviation near σ² ≈ 1.6
const f = Math.fround;
export const U32 = 2 ** -24; // FP32 unit roundoff
const TOL_FACTOR = 2; // tolerance = 2 · N · u · max|v_j|

export type Mask = "none" | "causal";
export interface Model { n: number; qtile: number; kvblock: number; mask: Mask; rescale: boolean; d: number; seed: number }

// Standard-normal-like draws from the sum of four uniforms: mean 0, variance 1.
function normalish(u: () => number): number {
  return (u() + u() + u() + u() - 2) * Math.sqrt(3);
}

export interface Inputs { q: number[][]; k: number[][]; v: number[][] }
export function inputs(seed: number, d: number): Inputs {
  const u = rng(seed);
  const q: number[][] = [], k: number[][] = [], v: number[][] = [];
  for (let i = 0; i < NMAX; i++) {
    q.push(Array.from({ length: d }, () => f(SIGMA * normalish(u))));
    k.push(Array.from({ length: d }, () => f(SIGMA * normalish(u))));
    v.push(Array.from({ length: d }, () => f(normalish(u))));
  }
  return { q, k, v };
}

// S = QKᵀ/√d + C in FP32; C is 0 or −∞ above the diagonal under the causal mask.
export function scores(inp: Inputs, n: number, d: number, mask: Mask): number[][] {
  const scale = f(1 / Math.sqrt(d));
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (mask === "causal" && j > i) return -Infinity;
    let s = 0;
    for (let c = 0; c < d; c++) s = f(s + f(inp.q[i][c] * inp.k[j][c]));
    return f(s * scale);
  }));
}

// Ordinary softmax attention for one row over keys [0, upTo), in FP32: the
// maximum first, then the exponentials, their sum, and the weighted values.
function direct(S: number[], v: number[][], upTo: number, d: number): number[] {
  let m = -Infinity;
  for (let j = 0; j < upTo; j++) m = Math.max(m, S[j]);
  let l = 0;
  const o = new Array(d).fill(0);
  for (let j = 0; j < upTo; j++) {
    if (S[j] === -Infinity) continue;
    const p = f(Math.exp(f(S[j] - m)));
    l = f(l + p);
    for (let c = 0; c < d; c++) o[c] = f(o[c] + f(p * v[j][c]));
  }
  return o.map((x) => f(x / l));
}

export type StepKind = "load" | "block" | "write";
export interface Step { kind: StepKind; tile: number; t: number; r0: number; r1: number; c0: number; c1: number }

// One row's state after key-value block t.
export interface RowStep {
  t: number; c0: number; c1: number;
  b: number; mPrev: number; m: number; alpha: number;
  lPrev: number; add: number; l: number;
  oPrev: number[]; o: number[];
  err: number; // max over components of |o_t/ℓ_t − softmax over the keys seen so far|
}

export interface Run {
  S: number[][];
  v: number[][];
  steps: Step[];
  rows: RowStep[][]; // per row, per block
  load: number[]; // per row: step index of its tile's load
  write: number[]; // per row: step index of its tile's write
  out: number[][]; // O rows
  ref: number[][]; // softmax(S_i)V computed directly
  err: number[]; // per row, max |O_i − ref_i|
  reads: number[]; // cumulative elements read from HBM after each step
  writes: number[]; // cumulative elements written after each step
  vmax: number;
}

export function simulate(p: Model): Run {
  const { n, d } = p;
  const inp = inputs(p.seed, d);
  const S = scores(inp, n, d, p.mask);
  const v = inp.v.slice(0, n);
  const qt = Math.min(p.qtile, n), kv = Math.min(p.kvblock, n);
  const Tr = Math.ceil(n / qt), Tc = Math.ceil(n / kv);
  const steps: Step[] = [];
  const rows: RowStep[][] = Array.from({ length: n }, () => []);
  const load: number[] = new Array(n).fill(0), write: number[] = new Array(n).fill(0);
  const out: number[][] = new Array(n), ref: number[][] = new Array(n), err: number[] = new Array(n).fill(0);
  const reads: number[] = [], writes: number[] = [];
  let R = 0, W = 0;
  for (let tile = 0; tile < Tr; tile++) {
    const r0 = tile * qt, r1 = Math.min(n, r0 + qt);
    steps.push({ kind: "load", tile, t: 0, r0, r1, c0: 0, c1: 0 });
    R += (r1 - r0) * d;
    reads.push(R); writes.push(W);
    const m = new Array(r1 - r0).fill(-Infinity);
    const l = new Array(r1 - r0).fill(0);
    const o = Array.from({ length: r1 - r0 }, () => new Array(d).fill(0));
    for (let i = r0; i < r1; i++) load[i] = steps.length - 1;
    for (let kb = 0; kb < Tc; kb++) {
      const c0 = kb * kv, c1 = Math.min(n, c0 + kv);
      if (p.mask === "causal" && c0 > r1 - 1) break; // every key in the block is after every row: skipped
      const t = kb + 1;
      steps.push({ kind: "block", tile, t, r0, r1, c0, c1 });
      R += (c1 - c0) * 2 * d;
      reads.push(R); writes.push(W);
      for (let i = r0; i < r1; i++) {
        const k = i - r0;
        let b = -Infinity;
        for (let j = c0; j < c1; j++) b = Math.max(b, S[i][j]);
        const mPrev = m[k];
        const mNew = Math.max(mPrev, b);
        // α_1 = exp(−∞ − m_1) = 0. A row whose keys in this block are all
        // masked keeps its maximum, so α = exp(0) = 1.
        let alpha: number;
        if (mNew === -Infinity) alpha = 1;
        else if (mPrev === -Infinity) alpha = 0;
        else alpha = p.rescale ? f(Math.exp(f(mPrev - mNew))) : 1;
        let add = 0;
        const pv = new Array(d).fill(0);
        for (let j = c0; j < c1; j++) {
          if (S[i][j] === -Infinity) continue;
          const e = f(Math.exp(f(S[i][j] - mNew)));
          add = f(add + e);
          for (let c = 0; c < d; c++) pv[c] = f(pv[c] + f(e * v[j][c]));
        }
        const lPrev = l[k], oPrev = o[k];
        const lNew = f(f(alpha * lPrev) + add);
        const oNew = oPrev.map((x, c) => f(f(alpha * x) + pv[c]));
        const seen = direct(S[i], v, c1, d);
        const e2 = lNew > 0 ? Math.max(...oNew.map((x, c) => Math.abs(f(x / lNew) - seen[c]))) : 0;
        rows[i].push({ t, c0, c1, b, mPrev, m: mNew, alpha, lPrev, add, l: lNew, oPrev, o: oNew, err: e2 });
        m[k] = mNew; l[k] = lNew; o[k] = oNew;
      }
    }
    steps.push({ kind: "write", tile, t: 0, r0, r1, c0: 0, c1: 0 });
    W += (r1 - r0) * d;
    reads.push(R); writes.push(W);
    for (let i = r0; i < r1; i++) {
      const k = i - r0;
      write[i] = steps.length - 1;
      out[i] = o[k].map((x) => f(x / l[k]));
      ref[i] = direct(S[i], v, n, d);
      err[i] = Math.max(...out[i].map((x, c) => Math.abs(x - ref[i][c])));
    }
  }
  let vmax = 0;
  for (const row of v) for (const x of row) vmax = Math.max(vmax, Math.abs(x));
  return { S, v, steps, rows, load, write, out, ref, err, reads, writes, vmax };
}

// Totals in elements for the tiled kernel and the naive baseline.
export function traffic(p: Model, run: Run) {
  const { n, d } = p;
  const last = run.steps.length - 1;
  const tiledRead = run.reads[last], tiledWrite = run.writes[last];
  const once = 4 * n * d; // Q, K, V read once and O written once
  return {
    once,
    reread: tiledRead + tiledWrite - once, // K and V read again, once per extra query tile
    tiledRead, tiledWrite,
    naiveRead: 3 * n * d + 2 * n * n,
    naiveWrite: 2 * n * n + n * d,
    sp: 4 * n * n, // S and P written and read back
  };
}

const memo = new Map<string, Run>();
export function runFor(p: Model): Run {
  const key = `${p.n}|${p.qtile}|${p.kvblock}|${p.mask}|${p.rescale}|${p.d}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(p);
    if (memo.size > 48) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

export function tolerance(p: Model, run: Run): number {
  return TOL_FACTOR * p.n * U32 * run.vmax;
}

// ---------------------------------------------------------------- math text

// A formula as SVG text: "_x" or "_{...}" is a subscript and "^x" or "^{...}"
// a superscript, set as tspans shifted off the baseline. Subscripts keep the
// 12 px floor, so the base size is larger than the subscript size.
interface MRun { s: string; level: number }
function parseMath(src: string, level = 0, out: MRun[] = []): MRun[] {
  const ch = [...src];
  let buf = "";
  const flush = () => { if (buf) { out.push({ s: buf, level }); buf = ""; } };
  for (let i = 0; i < ch.length;) {
    const c = ch[i];
    if ((c === "_" || c === "^") && i + 1 < ch.length) {
      flush();
      const lv = c === "_" ? level + 1 : -1;
      if (ch[i + 1] === "{") {
        let depth = 1, j = i + 2;
        while (j < ch.length && depth) { if (ch[j] === "{") depth++; else if (ch[j] === "}") depth--; j++; }
        parseMath(ch.slice(i + 2, j - 1).join(""), lv, out);
        i = j;
      } else { out.push({ s: ch[i + 1], level: lv }); i += 2; }
    } else { buf += c; i++; }
  }
  flush();
  return out;
}
const subSize = (size: number) => Math.max(TYPE.body, Math.round(size * 0.8));
function mathWidth(src: string, size: number): number {
  return parseMath(src).reduce((a, r) => a + textWidth(r.s, r.level === 0 ? size : subSize(size)), 0);
}
function mtext(x: number, y: number, src: string, size: number, attrs: Record<string, string | number | undefined> = {}): string {
  let cur = 0, inner = "";
  for (const r of parseMath(src)) {
    const off = r.level === 0 ? 0 : r.level < 0 ? -size * 0.38 : size * (r.level === 1 ? 0.3 : 0.48);
    const dy = off - cur;
    cur = off;
    const fs = r.level === 0 ? undefined : subSize(size);
    inner += `<tspan${dy ? ` dy="${Math.round(dy * 10) / 10}"` : ""}${fs ? ` font-size="${fs}"` : ""}>${esc(r.s)}</tspan>`;
  }
  return el("text", { x, y, "font-size": size, ...attrs }, inner);
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "FlashAttention: tiled attention with an online softmax",
    hLoad: "Query tile {k} of {T} loads onto the chip",
    hBlock: "Query tile {k} of {T} on chip, key-value block t = {t} streaming in",
    hWrite: "Query tile {k} of {T} writes its rows of O",
    onChip: "on chip now",
    inHbm: "in HBM",
    written: "O written to HBM",
    computed: "S tile computed, not stored",
    masked: "masked, C = −∞",
    blockAxis: "t",
    focus: "i = {i}",
    keys: "key j",
    cur: "current block",
    prev: "earlier blocks",
    ghostOn: "height before this rescale",
    ghostOff: "height if rescaled",
    runmax: "running maximum",
    unseen: "not loaded yet",
    rBlock: "Row i = {i}, block t = {t} of {T}",
    rInit: "Row i = {i}: tile loaded, nothing seen yet",
    rPending: "Row i = {i} waits for its query tile",
    rPendingNote: "Its tile loads at step {a} and writes at step {b}.",
    rDone: "Row i = {i}: done after T = {T} blocks",
    aOff: "α_t = 1: rescaling off",
    ref: "softmax(S_i) V, direct",
    check: "o_t / ℓ_t against softmax over the {k} keys seen:",
    checkDone: "O_i against softmax(S_i) V:",
    delta: "max |Δ| = {e}, tolerance {tol}",
    match: "matches to FP32 rounding",
    mismatch: "does not match",
    tTitle: "HBM traffic, {b}-byte elements",
    tNaive: "naive: S and P through HBM",
    tTiled: "tiled: this kernel",
    tOnce: "Q, K, V read and O written once",
    tReread: "K, V read again, once per extra query tile",
    tSP: "S and P written and read back",
    tRW: "read {r}, written {w}",
    tSoFar: "moved so far: {v}",
    tRatio: "The naive kernel moves {x}× the bytes.",
    cTitle: "On chip at once, in words",
    cQ: "Q tile",
    cKV: "K, V block",
    cS: "S tile",
    cStats: "m, ℓ, o",
    cTotal: "total",
    cNote: "A taller query tile needs more fast memory and rereads K and V less often.",
    xRows: "{k} of {n} rows of O written",
    kLoad: "Query tile {k} of {T} loads: rows {a} to {b} stay on chip with m = −∞, ℓ = 0, o = 0",
    kLoadAll: "One query tile holds all {n} rows, so K and V cross HBM once",
    kRescale: "Block {t} raises row {i}'s maximum to {m}: α = {a} rescales ℓ and o",
    kRescaleOff: "Block {t} raises row {i}'s maximum, and ℓ and o are not rescaled",
    kRowDone: "Row {i} is complete: o / ℓ is written to O",
    kEnd: "All {n} rows written: {v} of HBM traffic, against {nv} for the naive kernel",
    dLive: "{h}. Row {i} after block {t}: m = {m}, α = {a}, ℓ = {l}; o / ℓ differs from softmax over the keys seen so far by {e}.",
    dInit: "{h}. Row {i} starts at m = −∞, ℓ = 0, o = 0.",
    dPending: "{h}. Row {i} has not started.",
    dDone: "{h}. Row {i} is done and differs from softmax(S)V by {e}.",
    dTraffic: " HBM so far: {r} read, {w} written; in all the tiled kernel moves {tv} and the naive kernel {nv}.",
  },
  zh: {
    title: "FlashAttention：分块注意力与在线 softmax",
    hLoad: "第 {k} 个查询块（共 {T} 个）载入片上",
    hBlock: "第 {k} 个查询块（共 {T} 个）在片上，键值块 t = {t} 流入",
    hWrite: "第 {k} 个查询块（共 {T} 个）写回它的 O 行",
    onChip: "当前在片上",
    inHbm: "在 HBM 中",
    written: "O 已写回 HBM",
    computed: "算过的 S 块，未保存",
    masked: "被掩码，C = −∞",
    blockAxis: "t",
    focus: "i = {i}",
    keys: "键 j",
    cur: "当前块",
    prev: "此前的块",
    ghostOn: "本次缩放前的高度",
    ghostOff: "缩放后应有的高度",
    runmax: "运行最大值",
    unseen: "尚未载入",
    rBlock: "第 i = {i} 行，第 t = {t} 个块（共 {T} 个）",
    rInit: "第 i = {i} 行：查询块已载入，尚未看到任何键",
    rPending: "第 i = {i} 行在等它的查询块",
    rPendingNote: "该查询块在第 {a} 步载入，第 {b} 步写回。",
    rDone: "第 i = {i} 行：处理完 T = {T} 个块",
    aOff: "α_t = 1：不做缩放",
    ref: "直接计算 softmax(S_i) V",
    check: "o_t / ℓ_t 与已见 {k} 个键上的 softmax 对照：",
    checkDone: "O_i 与 softmax(S_i) V 对照：",
    delta: "max |Δ| = {e}，容差 {tol}",
    match: "在 FP32 舍入范围内一致",
    mismatch: "不一致",
    tTitle: "HBM 流量，每个元素 {b} 字节",
    tNaive: "朴素实现：S 与 P 经过 HBM",
    tTiled: "分块实现：本内核",
    tOnce: "Q、K、V 各读一次，O 写一次",
    tReread: "每多一个查询块，K、V 重读一遍",
    tSP: "S 与 P 写入后再读回",
    tRW: "读 {r}，写 {w}",
    tSoFar: "目前已传输：{v}",
    tRatio: "朴素实现传输的字节数是它的 {x} 倍。",
    cTitle: "片上同时驻留的数据（字）",
    cQ: "Q 块",
    cKV: "K、V 块",
    cS: "S 块",
    cStats: "m、ℓ、o",
    cTotal: "合计",
    cNote: "查询块越高，占用的高速内存越多，K 和 V 的重读次数越少。",
    xRows: "已写回 O 的 {k}/{n} 行",
    kLoad: "载入第 {k} 个查询块（共 {T} 个）：第 {a} 至 {b} 行留在片上，m = −∞，ℓ = 0，o = 0",
    kLoadAll: "一个查询块容纳全部 {n} 行，K 和 V 只经过 HBM 一次",
    kRescale: "第 {t} 个块把第 {i} 行的最大值抬到 {m}：α = {a}，ℓ 与 o 随之缩放",
    kRescaleOff: "第 {t} 个块抬高了第 {i} 行的最大值，但 ℓ 与 o 没有缩放",
    kRowDone: "第 {i} 行完成：o / ℓ 写入 O",
    kEnd: "全部 {n} 行写回：HBM 流量 {v}，朴素实现为 {nv}",
    dLive: "{h}。第 {i} 行处理完第 {t} 个块：m = {m}，α = {a}，ℓ = {l}；o / ℓ 与已见键上的 softmax 相差 {e}。",
    dInit: "{h}。第 {i} 行从 m = −∞、ℓ = 0、o = 0 开始。",
    dPending: "{h}。第 {i} 行尚未开始。",
    dDone: "{h}。第 {i} 行已完成，与 softmax(S)V 相差 {e}。",
    dTraffic: "目前 HBM 读 {r}、写 {w}；全程分块实现传输 {tv}，朴素实现 {nv}。",
  },
};
type Labels = typeof labels.en;

// Formulas are the same in both languages.
const F = {
  b: "b_t = max_{j∈ℬ_t} S_{ij}",
  m: "m_t = max(m_{t−1}, b_t)",
  a: "α_t = exp(m_{t−1} − m_t)",
  l: ["ℓ_t = α_t ℓ_{t−1}", "+ Σ_{j∈ℬ_t} exp(S_{ij} − m_t)"],
  o: ["o_t = α_t o_{t−1}", "+ Σ_{j∈ℬ_t} exp(S_{ij} − m_t) v_j"],
  init: "m_0 = −∞,  ℓ_0 = 0,  o_0 = 0",
  out: "O_i = o_T / ℓ_T",
  sTitle: "S_{ij}",
  wTitle: "exp(S_{ij} − m_t)",
};

type P = Model & { focus: number; bytes: number };

function norm(p: P): P {
  return { ...p, focus: Math.max(1, Math.min(p.n, p.focus)) };
}

// Wrap without leaving closing CJK punctuation alone on the last line.
function wrapLines(s: string, size: number, W: number): string[] {
  let out = wrap(s, size, W);
  if (out.length > 1 && /^[，。；：！？、）」]+$/.test(out[out.length - 1])) out = wrap(s, size, W - size * 1.2);
  return out;
}

const num = (v: number, dec = 2) => (v === -Infinity ? "−∞" : fixed(v, dec));
function sci(v: number): string {
  if (v === 0) return "0";
  if (v >= 0.01) return fixed(v, 2);
  const [m, e] = v.toExponential(1).split("e");
  return `${m}e${e.replace("-", "−").replace("+", "")}`;
}
const vec = (o: number[]) => `(${o.map((x) => fixed(x, 2)).join(", ")})`;
const bytes = (elems: number, b: number) => `${int(elems * b)} B`;

type RowPhase = "pending" | "init" | "live" | "done";
function rowPhase(run: Run, i: number, s: number): { phase: RowPhase; k: number } {
  if (s < run.load[i]) return { phase: "pending", k: 0 };
  if (s === run.load[i]) return { phase: "init", k: 0 };
  if (s < run.write[i]) return { phase: "live", k: s - run.load[i] };
  return { phase: "done", k: run.rows[i].length };
}

function header(p: P, run: Run, s: number, L: Labels): string {
  const st = run.steps[s];
  const T = Math.ceil(p.n / Math.min(p.qtile, p.n));
  const k = st.tile + 1;
  return st.kind === "load" ? tpl(L.hLoad, { k, T }) : st.kind === "write" ? tpl(L.hWrite, { k, T }) : tpl(L.hBlock, { k, T, t: st.t });
}

// ---- the matrices, with the focused row's strips aligned under the S columns

function renderMatrices(p: P, run: Run, s: number, x0: number, y0: number, W: number, L: Labels, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  const { n, d } = p;
  const qt = Math.min(p.qtile, n), kv = Math.min(p.kvblock, n);
  const Tc = Math.ceil(n / kv), Tr = Math.ceil(n / qt);
  const st = run.steps[s];
  const fi = p.focus - 1;
  const hatchId = `${uid}-mask`;

  const lgItems: LegendItem[] = [
    { label: L.onChip, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.inHbm, swatch: { kind: "rect", fill: C.panel } },
    { label: L.written, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.computed, swatch: { kind: "rect", fill: "none", stroke: C.ink3, dash: "2 2" } },
  ];
  if (p.mask === "causal") lgItems.push({ label: L.masked, swatch: { kind: "rect", fill: C.ink3, pattern: hatchId } });
  const lg = legend(lgItems, x0, y0, W, TYPE.body);
  parts.push(lg.svg);

  // Geometry: Q | S | O across, Kᵀ / S / Vᵀ down, with a wider gap between tiles.
  const LM = 44, G = 8;
  const gx = Tc > 8 ? 2 : 3, gy = Tr > 8 ? 2 : 3;
  const pitch = Math.max(5, Math.min(16, Math.floor((W - LM - 2 * G - (Tc - 1) * gx) / (2 * d + n))));
  const cell = pitch >= 8 ? pitch - 1 : pitch - 0.6;
  const xQ0 = x0 + LM, xS0 = xQ0 + d * pitch + G;
  const xS = (j: number) => xS0 + j * pitch + Math.floor(j / kv) * gx;
  const xSend = xS(n - 1) + pitch;
  const xO0 = xSend + G;
  const top = y0 + lg.height + 22; // block numbers sit in the band above Kᵀ
  const yK0 = top, yS0 = yK0 + d * pitch + G;
  const yS = (i: number) => yS0 + i * pitch + Math.floor(i / qt) * gy;
  const ySend = yS(n - 1) + pitch;
  const yV0 = ySend + G, yVend = yV0 + d * pitch;

  const active = (i: number) => i >= st.r0 && i < st.r1;
  const inBlock = (j: number) => st.kind === "block" && j >= st.c0 && j < st.c1;
  const allowed = (tile: number, kb: number) => p.mask === "none" || kb * kv <= Math.min(n, (tile + 1) * qt) - 1;
  const rect = (x: number, y: number, fill: string, op?: number) => el("rect", { x, y, width: cell, height: cell, rx: pitch >= 10 ? 1.5 : 0.5, fill, "fill-opacity": op });

  // Block numbers t above Kᵀ, thinned when blocks are narrow.
  const blockW = kv * pitch + gx;
  const every = Math.max(1, Math.ceil(24 / blockW));
  parts.push(text(xS0 - 6, top - 7, L.blockAxis, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  const curKb = st.kind === "block" ? st.t - 1 : -1;
  const bxc = (kb: number) => (xS(kb * kv) + xS(Math.min(n, kb * kv + kv) - 1) + pitch) / 2;
  const halfW = (kb: number) => textWidth(String(kb + 1), TYPE.body) / 2;
  for (let kb = 0; kb < Tc; kb++) {
    const cur = kb === curKb;
    if (!cur && kb % every !== 0) continue;
    // A thinned label gives way to the current block's label.
    if (!cur && curKb >= 0 && Math.abs(bxc(kb) - bxc(curKb)) < halfW(kb) + halfW(curKb) + 9) continue;
    parts.push(text(bxc(kb), top - 7, kb + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: cur ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
  }

  // Q, Kᵀ, Vᵀ, O.
  for (let i = 0; i < n; i++) for (let c = 0; c < d; c++) {
    parts.push(active(i) ? rect(xQ0 + c * pitch, yS(i), C.c1, 0.85) : rect(xQ0 + c * pitch, yS(i), C.panel));
    const x = xO0 + c * pitch;
    if (s >= run.write[i]) parts.push(rect(x, yS(i), C.c3));
    else if (active(i)) parts.push(rect(x, yS(i), C.c1, 0.4));
    else parts.push(rect(x, yS(i), C.panel));
  }
  for (let j = 0; j < n; j++) for (let c = 0; c < d; c++) {
    const on = inBlock(j);
    parts.push(on ? rect(xS(j), yK0 + c * pitch, C.c1, 0.85) : rect(xS(j), yK0 + c * pitch, C.panel));
    parts.push(on ? rect(xS(j), yV0 + c * pitch, C.c1, 0.85) : rect(xS(j), yV0 + c * pitch, C.panel));
  }

  // S: only the current tile holds values (the weights exp(S_ij − m_t) under
  // each row's current maximum); computed tiles are outlined, never stored.
  for (let i = 0; i < n; i++) {
    const rs = st.kind === "block" && active(i) ? run.rows[i][st.t - 1] : null;
    for (let j = 0; j < n; j++) {
      const x = xS(j), y = yS(i);
      if (run.S[i][j] === -Infinity) { parts.push(rect(x, y, `url(#${hatchId})`)); continue; }
      if (rs && inBlock(j)) {
        const wgt = Math.exp(run.S[i][j] - rs.m);
        parts.push(rect(x, y, C.panel), rect(x, y, C.c1, Math.max(0.06, wgt)));
      } else {
        parts.push(el("rect", { x: x + 0.5, y: y + 0.5, width: cell - 1, height: cell - 1, rx: 0.5, fill: "none", stroke: C.grid, "stroke-width": 1 }));
      }
    }
  }
  for (let tile = 0; tile < Tr; tile++) {
    const r0 = tile * qt, r1 = Math.min(n, r0 + qt);
    for (let kb = 0; kb < Tc; kb++) {
      if (!allowed(tile, kb)) continue;
      const c0 = kb * kv, c1 = Math.min(n, c0 + kv);
      const done = tile < st.tile || (tile === st.tile && (st.kind === "write" || (st.kind === "block" && kb + 1 < st.t)));
      const cur = tile === st.tile && st.kind === "block" && kb + 1 === st.t;
      if (!done && !cur) continue;
      const bx = xS(c0) - 1, by = yS(r0) - 1, bw = xS(c1 - 1) + cell - xS(c0) + 2, bh = yS(r1 - 1) + cell - yS(r0) + 2;
      parts.push(el("rect", { x: bx, y: by, width: bw, height: bh, rx: 1.5, fill: "none", stroke: cur ? C.ink : C.ink3, "stroke-width": cur ? 1.6 : 1, "stroke-dasharray": cur ? undefined : "2 2" }));
    }
  }

  // Matrix names in the empty corners.
  // When the corners are too small for two names, every name moves into the
  // left margin beside its band: Q beside a row away from the focused row.
  const nm = (x: number, y: number, s2: string, anchor: string) => mtext(x, y, s2, TYPE.title, { "text-anchor": anchor, class: "fig-t-strong" });
  if (d * pitch >= 36) {
    parts.push(nm(xQ0 + (d * pitch) / 2, yS0 - 5, "Q", "middle"));
    parts.push(nm(xS0 - 6, yK0 + (d * pitch) / 2 + 5, "K^T", "end"));
    parts.push(nm(xS0 - 6, yV0 + (d * pitch) / 2 + 5, "V^T", "end"));
  } else {
    const qRow = fi >= 3 ? 0 : n - 1;
    parts.push(nm(xQ0 - 5, yS(qRow) + (qRow ? cell : 10), "Q", "end"));
    parts.push(nm(xQ0 - 5, yK0 + (d * pitch) / 2 + 5, "K^T", "end"));
    parts.push(nm(xQ0 - 5, yV0 + (d * pitch) / 2 + 5, "V^T", "end"));
  }
  parts.push(nm(xO0 + (d * pitch) / 2, yS0 - 5, "O", "middle"));
  parts.push(nm(xSend + 5, ySend + 14, "S", "start"));

  // The focused row: outline and label; every row is a click target.
  parts.push(el("rect", { x: xQ0 - 2, y: yS(fi) - 2, width: xO0 + d * pitch - xQ0 + 4, height: cell + 4, rx: 2, fill: "none", stroke: C.ink, "stroke-width": 1.2, "pointer-events": "none" }));
  parts.push(text(xQ0 - 6, yS(fi) + cell / 2 + 4.5, tpl(L.focus, { i: p.focus }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  for (let i = 0; i < n; i++) {
    parts.push(el("rect", { x: x0, y: yS(i), width: xO0 + d * pitch - x0, height: pitch, fill: "transparent", "data-fig-set": `focus=${i + 1}`, class: "fig-hit" }));
  }

  // ---- strips for row i, on the S column positions
  const ph = rowPhase(run, fi, s);
  const hist = run.rows[fi];
  const seenBlocks = hist.slice(0, ph.k);
  const seenTo = seenBlocks.length ? seenBlocks[seenBlocks.length - 1].c1 : 0;
  const cx = (j: number) => xS(j) + cell / 2;
  let y = yVend + 22;
  const Srow = run.S[fi];
  const finite = Srow.filter((v) => v !== -Infinity);
  const lo = Math.floor(Math.min(...finite) - 0.3), hi = Math.ceil(Math.max(...finite) + 0.3);
  parts.push(mtext(xS0, y, F.sTitle, TYPE.label, { class: "fig-t-muted" }));
  y += 10;
  const sH = 88;
  const sy = linear([lo, hi], [y + sH, y + 14]); // headroom above the top tick for the b_t label
  // Alternate block bands so the partition ℬ_1 … ℬ_T is visible.
  for (let kb = 0; kb < Tc; kb += 2) {
    const c0 = kb * kv, c1 = Math.min(n, c0 + kv);
    parts.push(el("rect", { x: xS(c0) - 1, y, width: xS(c1 - 1) + cell - xS(c0) + 2, height: sH, fill: C.panel, "fill-opacity": 0.55 }));
  }
  const ticks = sy.ticks(3);
  for (const v of ticks) {
    parts.push(el("line", { x1: xS0 - 3, x2: xSend, y1: sy(v), y2: sy(v), stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(xS0 - 7, sy(v) + 4, fixed(v, 0), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  }
  // Running maximum as a staircase over the processed blocks.
  const stair: string[] = [];
  seenBlocks.forEach((b, k) => {
    const xa = xS(b.c0) - 1, xb = xS(b.c1 - 1) + cell + 1;
    stair.push(`${k ? "L" : "M"}${Math.round(xa * 10) / 10},${Math.round(sy(b.m) * 10) / 10}L${Math.round(xb * 10) / 10},${Math.round(sy(b.m) * 10) / 10}`);
  });
  let mBox: { x0: number; x1: number; y0: number; y1: number } | null = null;
  if (stair.length) {
    parts.push(el("path", { d: stair.join(""), fill: "none", stroke: C.ink, "stroke-width": 1.6 }));
    const lastB = seenBlocks[seenBlocks.length - 1];
    const mx = xS(lastB.c1 - 1) + cell + 5, my = sy(lastB.m) + 4;
    const ms = ph.phase === "live" ? "m_t" : "m_T";
    parts.push(mtext(mx, my, ms, TYPE.label, { class: "fig-t-strong" }));
    mBox = { x0: mx, x1: mx + mathWidth(ms, TYPE.label), y0: my - 12, y1: my + 4 };
  }
  const r = Math.max(2, Math.min(4, cell / 2 - 0.5));
  const curBlock = ph.phase === "live" ? seenBlocks[seenBlocks.length - 1] : null;
  for (let j = 0; j < n; j++) {
    if (Srow[j] === -Infinity) continue;
    const seen = j < seenTo;
    const isCur = !!curBlock && j >= curBlock.c0 && j < curBlock.c1;
    parts.push(el("circle", { cx: cx(j), cy: sy(Srow[j]), r, fill: seen ? (isCur ? C.c2 : C.c1) : C.paper, stroke: seen ? C.paper : C.ink3, "stroke-width": 1 }));
  }
  if (curBlock) {
    let jb = curBlock.c0;
    for (let j = curBlock.c0; j < curBlock.c1; j++) if (Srow[j] > Srow[jb]) jb = j;
    if (Srow[jb] !== -Infinity) {
      parts.push(el("circle", { cx: cx(jb), cy: sy(Srow[jb]), r: r + 3, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
      // Above the ring, or below it when that would run into the m_t label.
      const bwd = mathWidth("b_t", TYPE.label) / 2;
      let byy = sy(Srow[jb]) - r - 6;
      if (mBox && cx(jb) + bwd + 6 > mBox.x0 && cx(jb) - bwd - 6 < mBox.x1 && byy + 4 > mBox.y0 && byy - 16 < mBox.y1) byy = sy(Srow[jb]) + r + 16;
      parts.push(mtext(cx(jb), byy, "b_t", TYPE.label, { "text-anchor": "middle", class: "fig-t-halo" }));
    }
  }
  y += sH + 26;

  // Weights exp(S_ij − m_t) of the keys seen so far, in the frame the kernel holds.
  parts.push(mtext(xS0, y, ph.phase === "done" ? "exp(S_{ij} − m_T)" : F.wTitle, TYPE.label, { class: "fig-t-muted" }));
  y += 8;
  const wH = 52;
  const wy = linear([0, 1], [y + wH, y]);
  for (const v of [0, 1]) {
    parts.push(el("line", { x1: xS0 - 3, x2: xSend, y1: wy(v), y2: wy(v), stroke: v ? C.grid : C.rule, "stroke-width": 1 }));
    parts.push(text(xS0 - 7, wy(v) + 4, v, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  }
  const mNow = seenBlocks.length ? seenBlocks[seenBlocks.length - 1].m : -Infinity;
  const mBefore = ph.phase === "live" && seenBlocks.length >= 2 ? seenBlocks[seenBlocks.length - 2].m : mNow;
  const bw = Math.max(1.5, cell - (pitch >= 8 ? 2 : 1));
  for (let j = 0; j < seenTo; j++) {
    if (Srow[j] === -Infinity) continue;
    const tj = Math.floor(j / kv); // 0-based block of key j
    const own = hist[tj].m;
    const isCur = !!curBlock && tj === seenBlocks.length - 1;
    const hgt = p.rescale ? Math.exp(Srow[j] - mNow) : Math.exp(Srow[j] - own);
    const bx = cx(j) - bw / 2;
    parts.push(el("rect", { x: bx, y: wy(hgt), width: bw, height: wy(0) - wy(hgt), fill: isCur ? C.c2 : C.c1 }));
    // Ghost: with rescaling, the height before this block lowered it; without,
    // the height the bar should have in the current frame.
    const ghost = p.rescale ? (ph.phase === "live" && !isCur && mBefore < mNow ? Math.exp(Srow[j] - mBefore) : null)
      : (own < mNow ? Math.exp(Srow[j] - mNow) : null);
    if (ghost != null) parts.push(el("rect", { x: bx - 0.5, y: wy(ghost), width: bw + 1, height: wy(0) - wy(ghost), fill: "none", stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "2 1.5" }));
  }
  y += wH + 4;
  // Key positions at block starts, every k-th block so the labels stay apart.
  const kEvery = Math.max(1, Math.ceil((textWidth(String(n), TYPE.body) + 8) / blockW));
  for (let kb = 0; kb < Tc; kb += kEvery) {
    const j = kb * kv;
    parts.push(text(cx(j), y + 12, j + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  }
  parts.push(text(xS0 - 7, y + 12, L.keys, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 22;
  const slg = legend([
    { label: L.prev, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.cur, swatch: { kind: "rect", fill: C.c2 } },
    { label: p.rescale ? L.ghostOn : L.ghostOff, swatch: { kind: "rect", fill: "none", stroke: C.ink, dash: "2 1.5" } },
    { label: L.runmax, swatch: { kind: "line", stroke: C.ink } },
    { label: L.unseen, swatch: { kind: "dot", fill: C.ink3 } },
  ], x0, y, W, TYPE.body);
  parts.push(slg.svg);
  y += slg.height;
  return { svg: g({ class: "fig-matrices" }, ...parts), h: y - y0 };
}

// ---- the recurrence for the focused row, term by term

interface Line { sym: string[]; val?: string; cls?: string }
function renderReadout(p: P, run: Run, s: number, x0: number, y0: number, W: number, L: Labels, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const fi = p.focus - 1;
  const ph = rowPhase(run, fi, s);
  const hist = run.rows[fi];
  const T = hist.length;
  const tol = tolerance(p, run);
  const size = TYPE.title;
  let title = "";
  const lines: Line[] = [];
  let status: { ok: boolean; text: string; delta: string } | null = null;
  if (ph.phase === "pending") {
    title = tpl(L.rPending, { i: p.focus });
    lines.push({ sym: [tpl(L.rPendingNote, { a: run.load[fi], b: run.write[fi] })], cls: "plain" });
    lines.push({ sym: [F.init] });
  } else if (ph.phase === "init") {
    title = tpl(L.rInit, { i: p.focus });
    lines.push({ sym: [F.init] });
  } else if (ph.phase === "live") {
    const b = hist[ph.k - 1];
    title = tpl(L.rBlock, { i: p.focus, t: b.t, T });
    lines.push({ sym: [F.b], val: `= ${num(b.b)}` });
    lines.push({ sym: [F.m], val: `= max(${num(b.mPrev)}, ${num(b.b)}) = ${num(b.m)}` });
    if (!p.rescale && b.mPrev !== -Infinity) lines.push({ sym: [L.aOff] });
    else lines.push({ sym: [F.a], val: b.mPrev === -Infinity ? "= exp(−∞) = 0" : `= exp(${num(b.mPrev)} − ${num(b.m)}) = ${num(b.alpha)}` });
    lines.push({ sym: F.l, val: `= ${num(b.alpha)} × ${num(b.lPrev)} + ${num(b.add)} = ${num(b.l)}` });
    lines.push({ sym: F.o, val: `= ${vec(b.o)}` });
    status = { ok: b.err <= tol, text: tpl(L.check, { k: run.S[fi].slice(0, b.c1).filter((v) => v !== -Infinity).length }), delta: tpl(L.delta, { e: sci(b.err), tol: sci(tol) }) };
  } else {
    title = tpl(L.rDone, { i: p.focus, T });
    lines.push({ sym: [F.out], val: `= ${vec(run.out[fi])}` });
    lines.push({ sym: [L.ref], val: `= ${vec(run.ref[fi])}` });
    status = { ok: run.err[fi] <= tol, text: L.checkDone, delta: tpl(L.delta, { e: sci(run.err[fi]), tol: sci(tol) }) };
  }
  let y = y0 + 14;
  for (const ln of wrapLines(title, TYPE.label, W)) { parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  y += 6;
  const lineH = 21;
  for (const ln of lines) {
    if (ln.cls === "plain") {
      for (const part of wrapLines(ln.sym[0], TYPE.body, W)) { parts.push(text(x0, y, part, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 17; }
      y += 4;
      continue;
    }
    // Pack the symbolic pieces, then the numbers, breaking where they do not fit.
    const pieces = [...ln.sym, ...(ln.val ? [ln.val] : [])];
    let x = x0;
    let first = true;
    for (const piece of pieces) {
      const wdt = mathWidth(piece, size);
      if (!first && x + 4 + wdt > x0 + W) { y += lineH; x = x0 + 18; }
      else if (!first) x += 4;
      // A value too wide for one line (a long vector) wraps at its commas.
      if (x + wdt > x0 + W && piece.startsWith("= (")) {
        const chunks = wrap(piece, size, x0 + W - x);
        chunks.forEach((c, k) => { if (k) { y += lineH; x = x0 + 18; } parts.push(mtext(x, y, c, size, { class: "fig-t-num" })); x += mathWidth(c, size); });
      } else {
        parts.push(mtext(x, y, piece, size, { class: piece.startsWith("=") ? "fig-t-num" : undefined }));
        x += wdt;
      }
      first = false;
    }
    y += lineH + 3;
  }
  if (status) {
    y += 2;
    for (const part of wrapLines(status.text, TYPE.body, W)) { parts.push(mtext(x0, y, part, TYPE.body, { class: "fig-t-muted" })); y += 17; }
    parts.push(el("circle", { cx: x0 + 5, cy: y - 4, r: 5, fill: status.ok ? C.good : C.bad }));
    const dl = `${status.delta}${lang === "zh" ? "，" : ", "}${status.ok ? L.match : L.mismatch}`;
    const dLines = wrapLines(dl, TYPE.body, W - 30); // bold runs wider than the estimate
    dLines.forEach((part, k) => { parts.push(text(x0 + 16, y, part, { "font-size": TYPE.body, class: k === 0 ? "fig-t-strong fig-t-num" : "fig-t-strong" })); y += 17; });
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

// ---- HBM traffic of the two kernels for the same sizes

function renderTraffic(p: P, run: Run, s: number, x0: number, y0: number, W: number, L: Labels, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const tr = traffic(p, run);
  const B = p.bytes;
  const naive = tr.naiveRead + tr.naiveWrite, tiled = tr.tiledRead + tr.tiledWrite;
  const scale = W / Math.max(naive, tiled);
  let y = y0 + 14;
  parts.push(text(x0, y, tpl(L.tTitle, { b: B }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 12;
  const bar = (segs: Array<[number, string]>, yy: number) => {
    let x = x0;
    for (const [v, c] of segs) {
      if (v <= 0) continue;
      parts.push(el("rect", { x, y: yy, width: Math.max(1, v * scale - 1), height: 12, fill: c }));
      x += v * scale;
    }
  };
  const row = (name: string, total: number, segs: Array<[number, string]>, rw: string) => {
    y += 14;
    parts.push(text(x0, y, name, { "font-size": TYPE.body }));
    parts.push(text(x0 + W, y, bytes(total, B), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    y += 5;
    bar(segs, y);
    y += 12 + 15;
    parts.push(text(x0, y, rw, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
  };
  row(L.tNaive, naive, [[tr.once, C.ink3], [tr.sp, C.c2]], tpl(L.tRW, { r: bytes(tr.naiveRead, B), w: bytes(tr.naiveWrite, B) }));
  y += 6;
  row(L.tTiled, tiled, [[tr.once, C.ink3], [tr.reread, C.c1]], tpl(L.tRW, { r: bytes(tr.tiledRead, B), w: bytes(tr.tiledWrite, B) }));
  // Progress of the tiled kernel: bytes moved up to this step.
  const moved = run.reads[s] + run.writes[s];
  y += 8;
  parts.push(el("rect", { x: x0, y, width: W, height: 4, rx: 2, fill: C.panel }));
  parts.push(el("rect", { x: x0, y, width: Math.max(2, moved * scale), height: 4, rx: 2, fill: C.ink }));
  y += 19;
  parts.push(text(x0, y, tpl(L.tSoFar, { v: bytes(moved, B) }), { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
  y += 10;
  const lg = legend([
    { label: L.tOnce, swatch: { kind: "rect", fill: C.ink3 } },
    { label: L.tReread, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.tSP, swatch: { kind: "rect", fill: C.c2 } },
  ], x0, y, W, TYPE.body);
  parts.push(lg.svg);
  y += lg.height + 12;
  for (const ln of wrapLines(tpl(L.tRatio, { x: fixed(naive / tiled, 1) }), TYPE.body, W)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body })); y += 17; }
  void lang;
  return { svg: g({ class: "fig-traffic" }, ...parts), h: y - y0 - 4 };
}

// ---- on-chip footprint of one step, in scalar words

function renderChip(p: P, x0: number, y0: number, W: number, L: Labels): { svg: string; h: number } {
  const parts: string[] = [];
  const { n, d } = p;
  const qt = Math.min(p.qtile, n), kv = Math.min(p.kvblock, n);
  const rows: Array<[string, string, number]> = [
    [L.cQ, `${qt} × ${d}`, qt * d],
    [L.cKV, `2 × ${kv} × ${d}`, 2 * kv * d],
    [L.cS, `${qt} × ${kv}`, qt * kv],
    [L.cStats, `${qt} × (2 + ${d})`, qt * (2 + d)],
  ];
  const total = rows.reduce((a, r) => a + r[2], 0);
  let y = y0 + 14;
  parts.push(text(x0, y, L.cTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 6;
  const xv = x0 + W;
  const xe = xv - 40;
  for (const [name, expr, v] of rows) {
    y += 17;
    parts.push(text(x0, y, name, { "font-size": TYPE.body }));
    parts.push(text(xe, y, expr, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    parts.push(text(xv, y, v, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  }
  y += 5;
  parts.push(el("line", { x1: x0, x2: xv, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  y += 15;
  parts.push(text(x0, y, L.cTotal, { "font-size": TYPE.body, class: "fig-t-strong" }));
  parts.push(text(xv, y, total, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  y += 20;
  for (const ln of wrapLines(L.cNote, TYPE.body, W)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 17; }
  return { svg: g({ class: "fig-chip" }, ...parts), h: y - y0 - 4 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = norm(st.p);
  const run = runFor(p);
  const s = Math.max(0, Math.min(run.steps.length - 1, Math.round(st.t)));
  const fi = p.focus - 1;
  const ph = rowPhase(run, fi, s);
  const h = header(p, run, s, L);
  const tr = traffic(p, run);
  let out: string;
  if (ph.phase === "live") {
    const b = run.rows[fi][ph.k - 1];
    out = tpl(L.dLive, { h, i: p.focus, t: b.t, m: num(b.m), a: num(b.alpha), l: num(b.l), e: sci(b.err) });
  } else if (ph.phase === "init") out = tpl(L.dInit, { h, i: p.focus });
  else if (ph.phase === "pending") out = tpl(L.dPending, { h, i: p.focus });
  else out = tpl(L.dDone, { h, i: p.focus, e: sci(run.err[fi]) });
  return out + tpl(L.dTraffic, {
    r: bytes(run.reads[s], p.bytes), w: bytes(run.writes[s], p.bytes),
    tv: bytes(tr.tiledRead + tr.tiledWrite, p.bytes), nv: bytes(tr.naiveRead + tr.naiveWrite, p.bytes),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = norm(st.p);
  const run = runFor(p);
  const s = Math.max(0, Math.min(run.steps.length - 1, Math.round(st.t)));
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-mask`, C.ink3, 4, 1))];
  let y = 0;
  for (const ln of wrapLines(header(p, run, s, L), TYPE.label, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 12;
  if (narrow) {
    const mat = renderMatrices(p, run, s, 0, y, w, L, st.uid);
    parts.push(mat.svg); y += mat.h + 18;
    const ro = renderReadout(p, run, s, 0, y, w, L, lang);
    parts.push(ro.svg); y += ro.h + 18;
    const tr = renderTraffic(p, run, s, 0, y, w, L, lang);
    parts.push(tr.svg); y += tr.h + 18;
    const ch = renderChip(p, 0, y, w, L);
    parts.push(ch.svg); y += ch.h;
  } else {
    const Lw = Math.round(w * 0.54);
    const rx = Lw + 24, rw = w - rx;
    const mat = renderMatrices(p, run, s, 0, y, Lw, L, st.uid);
    const ro = renderReadout(p, run, s, rx, y, rw, L, lang);
    const tr = renderTraffic(p, run, s, rx, y + ro.h + 20, rw, L, lang);
    const ch = renderChip(p, rx, y + ro.h + 20 + tr.h + 20, rw, L);
    parts.push(mat.svg, ro.svg, tr.svg, ch.svg);
    y += Math.max(mat.h, ro.h + 20 + tr.h + 20 + ch.h);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

function keyframes(pp: P, lang: Lang) {
  const L = labels[lang];
  const p = norm(pp);
  const run = runFor(p);
  const tr = traffic(p, run);
  const fi = p.focus - 1;
  const last = run.steps.length - 1;
  const T = Math.ceil(p.n / Math.min(p.qtile, p.n));
  const out = new Map<number, string>();
  run.steps.forEach((st, s) => {
    if (st.kind === "load") out.set(s, T === 1 ? tpl(L.kLoadAll, { n: p.n }) : tpl(L.kLoad, { k: st.tile + 1, T, a: st.r0 + 1, b: st.r1 }));
  });
  run.rows[fi].forEach((b, k) => {
    if (k === 0 || !(b.m > b.mPrev)) return;
    const s = run.load[fi] + b.t;
    out.set(s, p.rescale ? tpl(L.kRescale, { t: b.t, i: p.focus, m: num(b.m), a: num(b.alpha) }) : tpl(L.kRescaleOff, { t: b.t, i: p.focus }));
  });
  if (run.write[fi] !== last) out.set(run.write[fi], tpl(L.kRowDone, { i: p.focus }));
  out.set(last, tpl(L.kEnd, { n: p.n, v: bytes(tr.tiledRead + tr.tiledWrite, p.bytes), nv: bytes(tr.naiveRead + tr.naiveWrite, p.bytes) }));
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([t, label]) => ({ t, label }));
}

// Opens where the focused row's maximum first rises after block 1, so the
// rescaling is on screen; otherwise on the row's last block.
function poster(pp: P): number {
  const p = norm(pp);
  const run = runFor(p);
  const fi = p.focus - 1;
  const ev = run.rows[fi].find((b, k) => k > 0 && b.m > b.mPrev);
  return ev ? run.load[fi] + ev.t : run.write[fi] - 1;
}

export default defineFigure({
  name: "flash-attention",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    n: { kind: "range", label: { en: "Sequence length N", zh: "序列长度 N" }, unit: { en: "tokens", zh: "个词元" }, min: 8, max: NMAX, step: 4, default: 16 },
    qtile: {
      kind: "choice", label: { en: "Query tile", zh: "查询块" }, default: 4,
      options: [2, 4, 8, 16].map((v) => ({ value: v, label: { en: `${v} rows`, zh: `${v} 行` } })),
    },
    kvblock: {
      kind: "choice", label: { en: "Key-value block", zh: "键值块" }, default: 4,
      options: [2, 4, 8].map((v) => ({ value: v, label: { en: `${v} keys`, zh: `${v} 个键` } })),
    },
    mask: {
      kind: "choice", label: { en: "Mask C", zh: "掩码 C" }, default: "none",
      options: [
        { value: "none", label: { en: "None", zh: "无" } },
        { value: "causal", label: { en: "Causal", zh: "因果" } },
      ],
    },
    rescale: { kind: "toggle", label: { en: "Rescale earlier blocks by α", zh: "用 α 缩放此前的块" }, default: true },
    focus: {
      kind: "choice", control: "select", label: { en: "Query row i", zh: "查询行 i" }, default: 11,
      options: Array.from({ length: NMAX }, (_, i) => ({ value: i + 1, label: { en: `row ${i + 1}`, zh: `第 ${i + 1} 行` } })),
    },
    d: { kind: "range", label: { en: "Head width d", zh: "头宽度 d" }, min: 2, max: 8, step: 2, default: 4, control: false },
    seed: { kind: "range", label: { en: "Data seed", zh: "数据种子" }, min: 1, max: 999, step: 1, default: 88, control: false },
    bytes: {
      kind: "choice", label: { en: "Bytes per element", zh: "每个元素的字节数" }, default: 2, control: false,
      options: [
        { value: 2, label: { en: "2 (FP16, BF16)", zh: "2（FP16、BF16）" } },
        { value: 4, label: { en: "4 (FP32)", zh: "4（FP32）" } },
      ],
    },
  },
  update(p, key) {
    if ((key === "n" || key === "focus") && p.focus > p.n) return { ...p, focus: p.n };
    return p;
  },
  timeline: {
    rate: 1.5,
    discrete: true,
    duration: (p) => runFor(norm(p)).steps.length - 1,
    keyframes,
    poster,
  },
  render,
  describe,
});
