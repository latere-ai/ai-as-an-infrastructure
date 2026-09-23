// Pipeline-parallel schedules for one synchronous optimizer step: GPipe,
// 1F1B, and interleaved 1F1B, on p balanced stages with m micro-batches and
// no communication time.
//
// Each device runs a fixed order of forward (F) and backward (B) passes, the
// order Megatron-LM uses (megatron/core/pipeline_parallel/schedules.py):
//
// - GPipe: all m forwards, then all m backwards.
// - 1F1B (PipeDream-Flush): device d runs min(p - d - 1, m) warm-up forwards,
//   then alternates one forward and one backward, then drains the remaining
//   backwards.
// - Interleaved 1F1B: each device holds v model chunks (virtual stage
//   c·p + d lives on device d), micro-batches advance in groups of p, and
//   device d runs min(2(p - d - 1) + (v - 1)p, m·v) warm-up chunk forwards.
//   The schedule needs m to be a multiple of p.
//
// An operation starts when its device is free and its dependency has
// finished: F(mb, s) after F(mb, s - 1), B(mb, s) after B(mb, s + 1), and the
// last stage's B after its own F. Durations are 1/v for a chunk forward and
// R/v for a chunk backward, in units of one full stage's forward pass t_F.
// R = 2 is illustrative (backward costs about twice the forward FLOPs); it
// does not change the idle share, the peak activations, or the message count.
//
// The idle share the figure reports is summed from the idle gaps of the
// simulated schedule, not taken from the formula. For every p in 2..8 and m
// in 1..16 (interleaved: m a multiple of p, v = 2 and 4) the simulated share
// equals the chapter's (p - 1)/(m + p - 1), and (p - 1)/(v·m + p - 1) for the
// interleaved schedule, the bubble Narayanan et al. (2021) derive.
//
// Activations: a micro-batch's activations for a chunk are counted from the
// start of its forward to the end of its backward, weighted 1/v, so the unit
// is one micro-batch's activations for one stage's layers.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- schedule

const R = 2; // backward time / forward time

type SchedKey = "gpipe" | "1f1b" | "int2" | "int4";
type Kind = "gpipe" | "1f1b" | "int";
const SCHED: Record<SchedKey, { kind: Kind; v: number }> = {
  gpipe: { kind: "gpipe", v: 1 },
  "1f1b": { kind: "1f1b", v: 1 },
  int2: { kind: "int", v: 2 },
  int4: { kind: "int", v: 4 },
};
const KEYS: SchedKey[] = ["gpipe", "1f1b", "int2", "int4"];

interface Op { fwd: boolean; mb: number; chunk: number; dev: number; start: number; end: number }

interface Run {
  key: SchedKey;
  p: number;
  m: number; // micro-batches actually scheduled (interleaved: a multiple of p)
  v: number;
  ops: Op[][]; // per device, in start order
  T: number; // step time: the last backward's end
  busy: number; // sum of operation time over all devices
  idle: number; // p·T − busy
  held: Array<Array<[number, number]>>; // per device: (time, activations held from this time on)
  peak: number[]; // per device
  peakAt: number[]; // per device: first time the peak is reached
  messages: number; // stage-boundary transfers per step, both directions
}

// Interleaving needs m to be a multiple of p: use the nearest one, at least p.
export function effectiveM(key: SchedKey, p: number, m: number): number {
  if (SCHED[key].kind !== "int") return m;
  return Math.max(1, Math.round(m / p)) * p;
}

function orders(kind: Kind, p: number, m: number, v: number) {
  const out: Array<Array<{ fwd: boolean; mb: number; chunk: number }>> = [];
  for (let d = 0; d < p; d++) {
    const list: Array<{ fwd: boolean; mb: number; chunk: number }> = [];
    const F = (mb: number, chunk = 0) => list.push({ fwd: true, mb, chunk });
    const B = (mb: number, chunk = 0) => list.push({ fwd: false, mb, chunk });
    if (kind === "gpipe") {
      for (let i = 0; i < m; i++) F(i);
      for (let i = 0; i < m; i++) B(i);
    } else if (kind === "1f1b") {
      const w = Math.min(p - d - 1, m);
      for (let i = 0; i < w; i++) F(i);
      for (let i = 0; i < m - w; i++) { F(w + i); B(i); }
      for (let i = m - w; i < m; i++) B(i);
    } else {
      const total = m * v;
      const w = Math.min((p - d - 1) * 2 + (v - 1) * p, total);
      const mbOf = (k: number) => Math.floor(k / (p * v)) * p + (k % p);
      const chunkOf = (k: number) => Math.floor((k % (p * v)) / p);
      for (let k = 0; k < w; k++) F(mbOf(k), chunkOf(k));
      for (let i = 0; i < total - w; i++) { F(mbOf(w + i), chunkOf(w + i)); B(mbOf(i), v - 1 - chunkOf(i)); }
      for (let k = total - w; k < total; k++) B(mbOf(k), v - 1 - chunkOf(k));
    }
    out.push(list);
  }
  return out;
}

function simulate(key: SchedKey, p: number, mIn: number): Run {
  const { kind, v } = SCHED[key];
  const m = effectiveM(key, p, mIn);
  const ord = orders(kind, p, m, v);
  const S = p * v;
  const fEnd = Array.from({ length: m }, () => new Array<number>(S).fill(NaN));
  const bEnd = Array.from({ length: m }, () => new Array<number>(S).fill(NaN));
  const ptr = new Array<number>(p).fill(0);
  const free = new Array<number>(p).fill(0);
  const ops: Op[][] = Array.from({ length: p }, () => []);
  for (let progress = true; progress;) {
    progress = false;
    for (let d = 0; d < p; d++) {
      while (ptr[d] < ord[d].length) {
        const o = ord[d][ptr[d]];
        const s = o.chunk * p + d;
        const dep = o.fwd ? (s === 0 ? 0 : fEnd[o.mb][s - 1]) : (s === S - 1 ? fEnd[o.mb][s] : bEnd[o.mb][s + 1]);
        if (Number.isNaN(dep)) break;
        const start = Math.max(free[d], dep);
        const end = start + (o.fwd ? 1 : R) / v;
        free[d] = end;
        (o.fwd ? fEnd : bEnd)[o.mb][s] = end;
        ops[d].push({ ...o, dev: d, start, end });
        ptr[d]++;
        progress = true;
      }
    }
  }
  if (ptr.some((x, d) => x !== ord[d].length)) throw new Error(`pipeline-schedule: ${key} p=${p} m=${m} deadlocks`);
  const T = Math.max(...free);
  let busy = 0;
  for (const list of ops) for (const o of list) busy += o.end - o.start;
  const held: Run["held"] = [], peak: number[] = [], peakAt: number[] = [];
  for (let d = 0; d < p; d++) {
    const ev: Array<[number, number]> = [];
    for (const o of ops[d]) ev.push(o.fwd ? [o.start, 1 / v] : [o.end, -1 / v]);
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const steps: Array<[number, number]> = [[0, 0]];
    let c = 0, pk = 0, at = 0;
    for (const [t, dc] of ev) {
      c = Math.round((c + dc) * 1e9) / 1e9;
      if (steps[steps.length - 1][0] === t) steps[steps.length - 1][1] = c; else steps.push([t, c]);
      if (c > pk + 1e-9) { pk = c; at = t; }
    }
    held.push(steps);
    peak.push(pk);
    peakAt.push(at);
  }
  return { key, p, m, v, ops, T, busy, idle: p * T - busy, held, peak, peakAt, messages: 2 * m * (p * v - 1) };
}

const memo = new Map<string, Run>();
function run(key: SchedKey, p: number, m: number): Run {
  const k = `${key}|${p}|${m}`;
  let hit = memo.get(k);
  if (!hit) {
    hit = simulate(key, p, m);
    if (memo.size > 64) memo.clear();
    memo.set(k, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Pipeline schedules: idle slots and held activations",
    head: "{name}: p = {p} stages, m = {m} micro-batches",
    headInt: "{name}: p = {p} devices with v = {v} chunks each, m = {m} micro-batches",
    gpipe: "GPipe",
    "1f1b": "1F1B",
    int2: "Interleaved 1F1B, v = 2",
    int4: "Interleaved 1F1B, v = 4",
    stage: "stage {i}",
    device: "device {i}",
    forward: "forward",
    backward: "backward (2 × forward)",
    idle: "idle (bubble)",
    held: "activations held",
    later: "striped: a later chunk on the same device",
    heldTitle: "Activations held per stage, in micro-batches",
    heldTitleInt: "Activations held per device (one chunk counts 1/v of a micro-batch)",
    peak: "peak",
    time: "time, in forward passes of one stage (t_F)",
    cursor: "t = {t}",
    formula: "Idle share f = (p − 1) / (m + p − 1) = {a} / ({m} + {a}) = {f}",
    formulaInt: "Idle share f = (p − 1) / (v·m + p − 1) = {a} / ({v}·{m} + {a}) = {f}",
    drawn: "Hatched idle area: {i} of {c} stage-time units = {f}",
    drawnSoFar: "Hatched idle area so far: {i} stage-time units; the full step idles {f}",
    compare: "Same p and m under each schedule",
    interleaved: "interleaved",
    colV: "v = {v}",
    rowIdle: "idle share",
    rowTime: "step time (t_F)",
    rowPeak: "peak held, first device",
    rowMsg: "boundary messages",
    note: "Interleaved columns use m = {m}, the nearest multiple of p: the schedule needs m divisible by p.",
    kFull: "All {p} stages are busy: the pipeline is full",
    kNeverFull: "The last stage starts; with m < p the pipeline never fills",
    kFirstB: "Stage {i} starts the first backward pass",
    kWait: "Stage 1 goes idle, waiting for a backward pass to return",
    kPeak: "Stage 1 reaches its peak of {k} micro-batches of activations",
    kDone: "Stage {i} has finished; it idles while earlier stages drain",
    kEnd: "Step ends: every micro-batch has drained and the optimizer can run",
    describe: "{name} on {p} stages with {m} micro-batches, at t = {t} of {d} t_F. The finished step leaves {f} of stage time idle, as (p − 1) / ({vm} + p − 1) predicts; stage 1 holds up to {k} micro-batches of activations; {n} messages cross stage boundaries.",
  },
  zh: {
    title: "流水线调度：空闲时隙与保存的激活",
    head: "{name}：p = {p} 个阶段，m = {m} 个微批",
    headInt: "{name}：p = {p} 台设备，每台 v = {v} 个模型块，m = {m} 个微批",
    gpipe: "GPipe",
    "1f1b": "1F1B",
    int2: "交错 1F1B，v = 2",
    int4: "交错 1F1B，v = 4",
    stage: "阶段 {i}",
    device: "设备 {i}",
    forward: "前向",
    backward: "反向（耗时为前向的 2 倍）",
    idle: "空闲（气泡）",
    held: "保存的激活",
    later: "条纹：同一设备上靠后的模型块",
    heldTitle: "各阶段保存的激活，以微批计",
    heldTitleInt: "各设备保存的激活（一个模型块按 1/v 个微批计）",
    peak: "峰值",
    time: "时间，以一个阶段的一次前向为单位（t_F）",
    cursor: "t = {t}",
    formula: "空闲占比 f = (p − 1) / (m + p − 1) = {a} / ({m} + {a}) = {f}",
    formulaInt: "空闲占比 f = (p − 1) / (v·m + p − 1) = {a} / ({v}·{m} + {a}) = {f}",
    drawn: "阴影空闲面积：{c} 个阶段时间单位中占 {i} 个，即 {f}",
    drawnSoFar: "目前的阴影空闲面积：{i} 个阶段时间单位；整个步骤空闲 {f}",
    compare: "同样的 p 和 m，各调度的对比",
    interleaved: "交错",
    colV: "v = {v}",
    rowIdle: "空闲占比",
    rowTime: "步骤耗时（t_F）",
    rowPeak: "首台设备的激活峰值",
    rowMsg: "跨阶段消息数",
    note: "交错调度要求 m 能被 p 整除，因此交错两列取最接近的倍数 m = {m}。",
    kFull: "{p} 个阶段全部开工，流水线已填满",
    kNeverFull: "最后一个阶段开工；m < p 时流水线始终填不满",
    kFirstB: "阶段 {i} 开始第一次反向传播",
    kWait: "阶段 1 进入空闲，等待反向传播传回",
    kPeak: "阶段 1 保存的激活达到峰值：{k} 个微批",
    kDone: "阶段 {i} 已完成，在前面的阶段排空期间空闲",
    kEnd: "步骤结束：所有微批都已排空，优化器可以更新",
    describe: "{name}，{p} 个阶段，{m} 个微批，当前 t = {t}，共 {d} 个 t_F。完整步骤中空闲的阶段时间占 {f}，与 (p − 1) / ({vm} + p − 1) 的预测一致；阶段 1 最多保存 {k} 个微批的激活；共有 {n} 条消息跨越阶段边界。",
  },
};

type P = { schedule: SchedKey; p: number; m: number };
type Lbl = typeof labels.en;

const num = (v: number) => sig(v, 3);

function keyframes(r: Run, L: Lbl) {
  const out: Array<{ t: number; label: string }> = [];
  const firstStart = r.ops.map((l) => l[0].start);
  const tFull = Math.max(...firstStart);
  const busyAt = (d: number, t: number) => r.ops[d].some((o) => o.start <= t + 1e-9 && o.end > t + 1e-9);
  const full = r.ops.every((_, d) => busyAt(d, tFull));
  out.push({ t: tFull, label: full ? tpl(L.kFull, { p: r.p }) : L.kNeverFull });
  let fb: Op | undefined;
  for (const l of r.ops) for (const o of l) if (!o.fwd && (!fb || o.start < fb.start)) fb = o;
  if (fb) out.push({ t: fb.start, label: tpl(L.kFirstB, { i: fb.dev + 1 }) });
  const d0 = r.ops[0];
  for (let i = 1; i < d0.length; i++) {
    if (d0[i].start > d0[i - 1].end + 1e-9) { out.push({ t: d0[i - 1].end, label: L.kWait }); break; }
  }
  out.push({ t: r.peakAt[0], label: tpl(L.kPeak, { k: num(r.peak[0]) }) });
  const last = r.ops[r.p - 1];
  const lastEnd = last[last.length - 1].end;
  if (lastEnd < r.T - 1e-9) out.push({ t: lastEnd, label: tpl(L.kDone, { i: r.p }) });
  out.push({ t: r.T, label: L.kEnd });
  return out.map((k) => ({ t: Math.round(k.t * 1000) / 1000, label: k.label })).sort((a, b) => a.t - b.t);
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = run(p.schedule, p.p, p.m);
  return tpl(L.describe, {
    name: L[p.schedule], p: p.p, m: r.m, t: num(Math.min(st.t, r.T)), d: num(r.T),
    f: pct(r.idle / (r.p * r.T), 1), vm: r.v === 1 ? "m" : "v·m", k: num(r.peak[0]), n: r.messages,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = run(p.schedule, p.p, p.m);
  const ref = run("gpipe", p.p, r.m); // the flush schedule fixes the time axis, so schedules compare by length
  const t = Math.max(0, Math.min(st.t, r.T));
  const fs = TYPE.body;
  const inCell = narrow ? TYPE.body : TYPE.small;
  const hatchId = `${st.uid}-idle`;
  // Later interleaved chunks: the pass color under paper-colored stripes, so
  // they read as distinct in both themes.
  const stripe = (id: string, fill: string) => el("pattern", { id, width: 4, height: 4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
    el("rect", { x: 0, y: 0, width: 4, height: 4, fill }), el("line", { x1: 0, y1: 0, x2: 0, y2: 4, stroke: C.paper, "stroke-width": 1.6 }));
  const laterF = `${st.uid}-lf`, laterB = `${st.uid}-lb`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 5, 1), stripe(laterF, C.c1), stripe(laterB, C.c2))];

  // ---- heading and legend
  let y = 0;
  const head = tpl(r.v > 1 ? L.headInt : L.head, { name: L[p.schedule], p: r.p, m: r.m, v: r.v });
  for (const ln of wrap(head, TYPE.label, w)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  const items: LegendItem[] = [
    { label: L.forward, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.backward, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.idle, swatch: { kind: "rect", fill: C.panel, pattern: hatchId } },
    { label: L.held, swatch: { kind: "rect", fill: C.c3, opacity: 0.45 } },
  ];
  if (r.v > 1) items.push({ label: L.later, swatch: { kind: "rect", fill: C.c1, pattern: laterF } });
  const lg = legend(items, 0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 22; // room for the cursor label

  // ---- time axis shared by both panels
  const rowWord = r.v > 1 ? L.device : L.stage;
  const labelW = Math.ceil(textWidth(tpl(rowWord, { i: 8 }), fs)) + 10;
  const peakW = Math.ceil(Math.max(textWidth(L.peak, fs), textWidth("16", fs))) + 10;
  const x0 = labelW, x1 = w - peakW;
  const x = linear([0, ref.T], [x0, x1]);

  // ---- schedule panel
  const rowH = narrow ? Math.max(14, Math.min(22, Math.floor(132 / r.p))) : Math.max(16, Math.min(26, Math.floor(168 / r.p)));
  const gTop = y;
  for (let d = 0; d < r.p; d++) {
    const yy = gTop + d * (rowH + 3);
    parts.push(text(labelW - 8, yy + rowH / 2 + fs * 0.35, tpl(rowWord, { i: d + 1 }), { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(el("rect", { x: x(0), y: yy, width: x(r.T) - x(0), height: rowH, fill: C.panel }));
    let prevEnd = 0;
    for (const o of r.ops[d]) {
      // Idle gap before this operation, drawn up to the cursor.
      if (o.start > prevEnd + 1e-9 && prevEnd < t) {
        const gEnd = Math.min(o.start, t);
        parts.push(el("rect", { x: x(prevEnd), y: yy, width: x(gEnd) - x(prevEnd), height: rowH, fill: `url(#${hatchId})` }));
      }
      prevEnd = o.end;
      if (o.start >= t) continue;
      const cEnd = Math.min(o.end, t);
      const cw = x(cEnd) - x(o.start);
      parts.push(el("rect", {
        x: x(o.start) + 0.5, y: yy, width: Math.max(0.6, cw - 1), height: rowH, rx: cw > 6 ? 2 : 0,
        fill: o.chunk > 0 ? `url(#${o.fwd ? laterF : laterB})` : o.fwd ? C.c1 : C.c2,
      }));
      const lbl = String(o.mb + 1);
      if (cEnd === o.end && cw >= textWidth(lbl, inCell) + 8 && rowH >= inCell + 2) {
        parts.push(text(x(o.start) + cw / 2, yy + rowH / 2 + inCell * 0.36, lbl, { "font-size": inCell, "text-anchor": "middle", "font-weight": 600, fill: C.paper, class: "fig-t-num" }));
      }
    }
    if (prevEnd < r.T - 1e-9 && prevEnd < t) {
      parts.push(el("rect", { x: x(prevEnd), y: yy, width: x(Math.min(r.T, t)) - x(prevEnd), height: rowH, fill: `url(#${hatchId})` }));
    }
  }
  const gBottom = gTop + r.p * (rowH + 3) - 3;

  // ---- held activations panel
  let hy = gBottom + 6;
  const hLines = wrap(r.v > 1 ? L.heldTitleInt : L.heldTitle, fs, w - peakW - 6);
  for (const ln of hLines) { hy += 16; parts.push(text(0, hy, ln, { "font-size": fs, class: "fig-t-strong" })); }
  parts.push(text(w, hy, L.peak, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  hy += 8;
  const stripH = narrow ? Math.max(14, Math.min(24, Math.floor(112 / r.p))) : Math.max(14, Math.min(26, Math.floor(140 / r.p)));
  const yMax = Math.max(1, r.m);
  const hTop = hy;
  for (let d = 0; d < r.p; d++) {
    const yy = hTop + d * (stripH + 4);
    const yv = (v: number) => yy + stripH - (v / yMax) * stripH;
    parts.push(text(labelW - 8, yy + stripH / 2 + fs * 0.35, tpl(rowWord, { i: d + 1 }), { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(el("line", { x1: x(0), x2: x(ref.T), y1: yy + stripH, y2: yy + stripH, stroke: C.rule, "stroke-width": 1 }));
    const steps = r.held[d];
    let dPath = `M${x(0)},${yv(0)}`;
    let top = `M${x(0)},${yv(0)}`;
    let cur = 0, so = 0;
    for (const [tt, v] of steps) {
      if (tt > t) break;
      dPath += `L${x(tt)},${yv(cur)}L${x(tt)},${yv(v)}`;
      top += `L${x(tt)},${yv(cur)}L${x(tt)},${yv(v)}`;
      cur = v;
      so = Math.max(so, v);
    }
    dPath += `L${x(t)},${yv(cur)}L${x(t)},${yv(0)}Z`;
    top += `L${x(t)},${yv(cur)}`;
    parts.push(el("path", { d: dPath, fill: C.c3, "fill-opacity": 0.35 }));
    parts.push(el("path", { d: top, fill: "none", stroke: C.c3, "stroke-width": 1.5, "stroke-linejoin": "round" }));
    parts.push(text(w, yy + stripH / 2 + fs * 0.35, num(so), { "font-size": fs, "text-anchor": "end", class: d === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
  }
  const hBottom = hTop + r.p * (stripH + 4) - 4;

  // ---- gridlines, cursor, axis
  const ticks = x.ticks(narrow ? 4 : 8).filter((v) => v <= ref.T + 1e-9);
  const grid = ticks.map((v) => el("line", { x1: x(v), x2: x(v), y1: gTop, y2: gBottom, stroke: C.grid, "stroke-width": 1 })
    + el("line", { x1: x(v), x2: x(v), y1: hTop, y2: hBottom, stroke: C.grid, "stroke-width": 1 })).join("");
  parts.splice(1, 0, grid);
  const cx = x(t);
  // The cursor crosses both panels but not the title between them.
  parts.push(el("line", { x1: cx, x2: cx, y1: gTop - 4, y2: gBottom + 2, stroke: C.ink, "stroke-width": 1.5 }));
  parts.push(el("line", { x1: cx, x2: cx, y1: hTop - 2, y2: hBottom + 2, stroke: C.ink, "stroke-width": 1.5 }));
  const cl = tpl(L.cursor, { t: num(t) });
  const clw = textWidth(cl, fs);
  const clx = Math.min(Math.max(cx, x0 + clw / 2), w - clw / 2);
  parts.push(text(clx, gTop - 8, cl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  parts.push(axis({ scale: x, orient: "bottom", at: hBottom + 4, ticks, size: fs, format: (v) => String(v) }));
  y = hBottom + 4 + axisHeight(false, fs);
  for (const ln of wrap(L.time, fs, w)) { y += 15; parts.push(text(narrow ? 0 : (x0 + x1) / 2, y, ln, { "font-size": fs, "text-anchor": narrow ? "start" : "middle", class: "fig-t-muted" })); }

  // ---- readout: the formula with its terms, the hatched area it predicts
  y += 14;
  const rp: string[] = [];
  const f = (r.p - 1) / (r.v * r.m + r.p - 1);
  const formula = tpl(r.v > 1 ? L.formulaInt : L.formula, { a: r.p - 1, m: r.m, v: r.v, f: pct(f, 1) });
  for (const ln of wrap(formula, TYPE.label, w)) { y += 18; rp.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" })); }
  let idleSoFar = 0;
  for (let d = 0; d < r.p; d++) {
    let prev = 0;
    for (const o of r.ops[d]) { if (o.start > prev) idleSoFar += Math.max(0, Math.min(o.start, t) - Math.min(prev, t)); prev = o.end; }
    if (prev < r.T) idleSoFar += Math.max(0, Math.min(r.T, t) - Math.min(prev, t));
  }
  const done = t >= r.T - 1e-9;
  const drawn = done
    ? tpl(L.drawn, { i: num(r.idle), c: num(r.p * r.T), f: pct(r.idle / (r.p * r.T), 1) })
    : tpl(L.drawnSoFar, { i: num(idleSoFar), f: pct(r.idle / (r.p * r.T), 1) });
  for (const ln of wrap(drawn, fs, w)) { y += 17; rp.push(text(0, y, ln, { "font-size": fs, class: "fig-t-num" })); }

  // ---- the four schedules at the same p and m
  y += 26;
  rp.push(text(0, y, L.compare, { "font-size": fs, class: "fig-t-strong" }));
  const rowsL = [L.rowIdle, L.rowTime, L.rowPeak, L.rowMsg];
  const nameW = Math.ceil(Math.max(...rowsL.map((s) => textWidth(s, fs)))) + 10;
  const colW = (w - nameW) / 4;
  const colX = (i: number) => nameW + colW * (i + 1); // right edge of column i
  const all = KEYS.map((k) => run(k, p.p, p.m));
  y += 10;
  // Two-level header: "interleaved" spans the v = 2 and v = 4 columns.
  const intMid = (colX(2) - colW + colX(3)) / 2;
  rp.push(text(intMid, y + fs, L.interleaved, { "font-size": fs, "text-anchor": "middle", class: p.schedule === "int2" || p.schedule === "int4" ? "fig-t-strong" : "fig-t-muted" }));
  rp.push(el("line", { x1: colX(2) - colW + 6, x2: colX(3), y1: y + fs + 5, y2: y + fs + 5, stroke: C.rule, "stroke-width": 1 }));
  y += fs + 8;
  const heads = [L.gpipe, L["1f1b"], tpl(L.colV, { v: 2 }), tpl(L.colV, { v: 4 })];
  heads.forEach((hd, i) => {
    const on = KEYS[i] === p.schedule;
    rp.push(text(colX(i), y + fs + 4, hd, { "font-size": fs, "text-anchor": "end", class: on ? "fig-t-strong" : "fig-t-muted" }));
    rp.push(el("rect", { x: colX(i) - colW, y: y - (i >= 2 ? fs + 8 : 0), width: colW, height: fs + 10 + (i >= 2 ? fs + 8 : 0), fill: "transparent", "data-fig-set": `schedule=${KEYS[i]}`, class: "fig-hit" }));
  });
  y += fs + 10;
  const rowH2 = 20;
  const vals = (a: Run) => [pct(a.idle / (a.p * a.T), 1), num(a.T), num(a.peak[0]), String(a.messages)];
  rowsL.forEach((name, j) => {
    rp.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    rp.push(text(0, y + 14, name, { "font-size": fs }));
    all.forEach((a, i) => {
      const on = KEYS[i] === p.schedule;
      rp.push(text(colX(i), y + 14, vals(a)[j], { "font-size": fs, "text-anchor": "end", class: on ? "fig-t-strong fig-t-num" : "fig-t-num fig-t-muted" }));
    });
    y += rowH2;
  });
  rp.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  const mInt = effectiveM("int2", p.p, p.m);
  if (mInt !== p.m) {
    y += 4;
    for (const ln of wrap(tpl(L.note, { m: mInt }), fs, w)) { y += 15; rp.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "pipeline-schedule",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    schedule: {
      kind: "choice", label: { en: "Schedule", zh: "调度" }, default: "gpipe",
      options: [
        { value: "gpipe", label: { en: "GPipe", zh: "GPipe" } },
        { value: "1f1b", label: { en: "1F1B", zh: "1F1B" } },
        { value: "int2", label: { en: "Interleaved, v = 2", zh: "交错，v = 2" } },
        { value: "int4", label: { en: "Interleaved, v = 4", zh: "交错，v = 4" } },
      ],
    },
    p: { kind: "range", label: { en: "Pipeline stages p", zh: "流水线阶段数 p" }, min: 2, max: 8, step: 1, default: 4 },
    m: { kind: "range", label: { en: "Micro-batches m", zh: "微批数 m" }, min: 1, max: 16, step: 1, default: 8 },
  },
  timeline: {
    rate: 4,
    discrete: false,
    duration: (p) => run(p.schedule, p.p, p.m).T,
    keyframes: (p, lang) => keyframes(run(p.schedule, p.p, p.m), labels[lang]),
    // The finished step: every idle slot is hatched, so the drawn area can be
    // read against the formula, and every stage's activation peak is drawn.
    poster: (p) => run(p.schedule, p.p, p.m).T,
  },
  render,
  describe,
});
