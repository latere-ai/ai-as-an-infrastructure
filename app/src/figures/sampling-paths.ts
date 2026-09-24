// Sampling paths from Gaussian noise to a 2D Gaussian mixture, for the three
// paths of the diffusion and flow-matching chapter, integrated with Euler at a
// step count the reader sets and compared with the exact ODE path.
//
// Nothing is learned. For a mixture whose K components share one variance s²,
// every field below is a posterior average over components with weights
// r_k(x, t) ∝ N(x; a μ_k, var I), in closed form:
//
// - Diffusion: x_t = a_t x1 + σ_t x0 with the chapter's cosine schedule
//   a_t² = f(t) / f(0), f(t) = cos²((t + s)/(1 + s) · π/2), s = 0.008, and
//   σ_t² = 1 − a_t². Its probability-flow ODE f − ½ g² ∇log p_t, with the exact
//   mixture score, reduces to
//     dx/dt = ȧ Σ_k r_k [μ_k − a (1 − s²)(x − a μ_k) / var],  var = 1 − a²(1 − s²),
//   integrated from t = 1 (noise) to t = 0 (data). This form has no 0/0 at
//   either end of the schedule.
// - Flow matching, linear path x_t = (1 − t) x0 + t x1 with independent pairs:
//     v*(x, t) = E[x1 − x0 | x_t = x] = Σ_k r_k [μ_k + (t s² − (1 − t))(x − t μ_k) / var],
//   var = t² s² + (1 − t)², integrated from t = 0 (noise) to t = 1 (data).
// - After one reflow: the pairs are (x0, T(x0)) with T the flow's exact ODE
//   map. When no two chords x0 → T(x0) pass through one point at one time,
//   the reflowed field is the chord velocity T(x0) − x0 itself, so every path
//   is straight and Euler is exact at any step count. That holds when
//   det((1 − t) I + t DT) > 0 for all x0 and t, which
//   tools/figure-data/sampling-paths-check.py verifies for the three mixtures
//   (the check is over a grid of noise points, so it holds for any seed). The
//   same script recomputes this module's readouts in numpy from the same
//   seeded noise.
//
// The exact path is RK4 with 96 steps (within 1e-5 of 1,000 steps); the Euler
// path takes N steps of 1/N in the sampler's own time, one field evaluation
// each. Everything is memoized per (target, seed) and per step count, and the
// state at timeline position t (0 to N) is a pure function of t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { wrap } from "./lib/labels.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export type Sampler = "diffusion" | "flow" | "reflow";
export type TargetKey = "two" | "ring" | "moons";

interface Mixture { K: number; mx: Float64Array; my: Float64Array; s: number }

function mixture(pts: Array<[number, number]>, s: number): Mixture {
  return { K: pts.length, mx: Float64Array.from(pts, (p) => p[0]), my: Float64Array.from(pts, (p) => p[1]), s };
}

// Equal component weights in every target, so r_k needs no log-weight term.
const TARGETS: Record<TargetKey, Mixture> = {
  two: mixture([[-2, 0], [2, 0]], 0.25),
  ring: mixture(Array.from({ length: 8 }, (_, k) => [2.5 * Math.cos((k * Math.PI) / 4), 2.5 * Math.sin((k * Math.PI) / 4)] as [number, number]), 0.2),
  moons: (() => {
    // Two interleaved half circles, 8 components each, centered and scaled.
    const raw: Array<[number, number]> = [];
    for (let k = 0; k < 8; k++) { const th = (k * Math.PI) / 7; raw.push([Math.cos(th), Math.sin(th)]); }
    for (let k = 0; k < 8; k++) { const th = (k * Math.PI) / 7; raw.push([1 - Math.cos(th), 0.5 - Math.sin(th)]); }
    const cx = raw.reduce((a, p) => a + p[0], 0) / raw.length, cy = raw.reduce((a, p) => a + p[1], 0) / raw.length;
    return mixture(raw.map(([x, y]) => [(x - cx) * 1.8, (y - cy) * 1.8]), 0.15);
  })(),
};

const S_OFF = 0.008;
const TH0 = ((S_OFF / (1 + S_OFF)) * Math.PI) / 2;
const COS0 = Math.cos(TH0);
// Cosine schedule: a(t) and da/dt.
function cosA(t: number): [number, number] {
  const th = (((t + S_OFF) / (1 + S_OFF)) * Math.PI) / 2;
  return [Math.cos(th) / COS0, (-Math.sin(th) * (Math.PI / 2)) / (1 + S_OFF) / COS0];
}

const PARTICLES = 200;
const TRAILS = 32; // particles whose paths are drawn
const REF = 96; // RK4 steps of the exact path
const SWEEP = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];
export const MAX_STEPS = 32;

// Per-mode velocities V_k = c0 μ_k + c1 (x − a μ_k) in sampling progress τ
// (0 = noise, 1 = data), and the shared variance of the components at τ.
function coeffs(kind: "diffusion" | "flow", m: Mixture, tau: number) {
  const s2 = m.s * m.s;
  if (kind === "diffusion") {
    const [a, da] = cosA(1 - tau);
    const v = 1 - a * a * (1 - s2);
    // dx/dτ = −dx/dt, since t = 1 − τ.
    return { a, v, c0: -da, c1: (da * a * (1 - s2)) / v };
  }
  const a = tau, sg = 1 - tau;
  const v = a * a * s2 + sg * sg;
  return { a, v, c0: 1, c1: (a * s2 - sg) / v };
}

const scratch = new Float64Array(32);

// The field at (x, y, τ); writes the velocity into out[0..1]. With `modes`,
// also writes the posterior weights and the per-mode velocities.
function field(kind: "diffusion" | "flow", m: Mixture, x: number, y: number, tau: number, out: Float64Array, modes?: { r: Float64Array; ux: Float64Array; uy: Float64Array }) {
  const { a, v, c0, c1 } = coeffs(kind, m, tau);
  let best = -Infinity;
  for (let k = 0; k < m.K; k++) {
    const dx = x - a * m.mx[k], dy = y - a * m.my[k];
    const e = -(dx * dx + dy * dy) / (2 * v);
    scratch[k] = e;
    if (e > best) best = e;
  }
  let z = 0;
  for (let k = 0; k < m.K; k++) { scratch[k] = Math.exp(scratch[k] - best); z += scratch[k]; }
  let vx = 0, vy = 0;
  for (let k = 0; k < m.K; k++) {
    const r = scratch[k] / z;
    const ux = c0 * m.mx[k] + c1 * (x - a * m.mx[k]);
    const uy = c0 * m.my[k] + c1 * (y - a * m.my[k]);
    vx += r * ux; vy += r * uy;
    if (modes) { modes.r[k] = r; modes.ux[k] = ux; modes.uy[k] = uy; }
  }
  out[0] = vx; out[1] = vy;
}

function noise(seed: number, n: number): Float64Array {
  const u = rng(seed);
  const out = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const u1 = 1 - u(), u2 = u();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[2 * i] = r * Math.cos(2 * Math.PI * u2);
    out[2 * i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

// Paths are stored per particle as (steps + 1) points: path[(i * (n + 1) + j) * 2].
function rk4(kind: "diffusion" | "flow", m: Mixture, x0: Float64Array, n: number): Float64Array {
  const P = x0.length / 2;
  const out = new Float64Array(P * (n + 1) * 2);
  const k1 = new Float64Array(2), k2 = new Float64Array(2), k3 = new Float64Array(2), k4 = new Float64Array(2);
  const h = 1 / n;
  for (let i = 0; i < P; i++) {
    let x = x0[2 * i], y = x0[2 * i + 1];
    const base = i * (n + 1) * 2;
    out[base] = x; out[base + 1] = y;
    for (let j = 0; j < n; j++) {
      const t = j * h;
      field(kind, m, x, y, t, k1);
      field(kind, m, x + (h / 2) * k1[0], y + (h / 2) * k1[1], t + h / 2, k2);
      field(kind, m, x + (h / 2) * k2[0], y + (h / 2) * k2[1], t + h / 2, k3);
      field(kind, m, x + h * k3[0], y + h * k3[1], t + h, k4);
      x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      out[base + 2 * (j + 1)] = x; out[base + 2 * (j + 1) + 1] = y;
    }
  }
  return out;
}

function euler(kind: "diffusion" | "flow", m: Mixture, x0: Float64Array, n: number): Float64Array {
  const P = x0.length / 2;
  const out = new Float64Array(P * (n + 1) * 2);
  const v = new Float64Array(2);
  for (let i = 0; i < P; i++) {
    let x = x0[2 * i], y = x0[2 * i + 1];
    const base = i * (n + 1) * 2;
    out[base] = x; out[base + 1] = y;
    for (let j = 0; j < n; j++) {
      field(kind, m, x, y, j / n, v);
      x += v[0] / n; y += v[1] / n;
      out[base + 2 * (j + 1)] = x; out[base + 2 * (j + 1) + 1] = y;
    }
  }
  return out;
}

// Straight chords x0 → T(x0), sampled at n + 1 points: the reflowed paths.
function chords(x0: Float64Array, flowRef: Float64Array, n: number): Float64Array {
  const P = x0.length / 2;
  const out = new Float64Array(P * (n + 1) * 2);
  for (let i = 0; i < P; i++) {
    const e = (i * (REF + 1) + REF) * 2;
    const ex = flowRef[e], ey = flowRef[e + 1];
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      out[(i * (n + 1) + j) * 2] = x0[2 * i] + f * (ex - x0[2 * i]);
      out[(i * (n + 1) + j) * 2 + 1] = x0[2 * i + 1] + f * (ey - x0[2 * i + 1]);
    }
  }
  return out;
}

// Position of particle i at progress τ on a path with n steps (linear inside a
// step, which is what an Euler step is and within 1e-5 for the RK4 grid).
function at(path: Float64Array, n: number, i: number, tau: number): [number, number] {
  const f = Math.min(n, Math.max(0, tau * n));
  const j = Math.min(n - 1, Math.floor(f));
  const w = f - j;
  const b = (i * (n + 1) + j) * 2;
  return [path[b] + w * (path[b + 2] - path[b]), path[b + 1] + w * (path[b + 3] - path[b + 1])];
}

function meanGap(a: Float64Array, na: number, b: Float64Array, nb: number, tau: number): number {
  let s = 0;
  for (let i = 0; i < PARTICLES; i++) {
    const [x1, y1] = at(a, na, i, tau), [x2, y2] = at(b, nb, i, tau);
    s += Math.hypot(x1 - x2, y1 - y2);
  }
  return s / PARTICLES;
}

// Total length of the exact paths over the total length of their chords, minus 1.
function bend(path: Float64Array, n: number): number {
  let len = 0, chord = 0;
  for (let i = 0; i < PARTICLES; i++) {
    const b = i * (n + 1) * 2;
    for (let j = 0; j < n; j++) len += Math.hypot(path[b + 2 * j + 2] - path[b + 2 * j], path[b + 2 * j + 3] - path[b + 2 * j + 1]);
    chord += Math.hypot(path[b + 2 * n] - path[b], path[b + 2 * n + 1] - path[b + 1]);
  }
  return len / chord - 1;
}

interface Base {
  m: Mixture;
  x0: Float64Array;
  ref: Record<Sampler, Float64Array>; // exact paths, REF steps
  bend: Record<Sampler, number>;
  sweep: Record<"diffusion" | "flow", number[]>; // mean endpoint gap at each SWEEP count
  auto: number; // default tracked particle
  pairs: { x0: Float64Array; x1: Float64Array }; // independent training pairs for the overlay
}

const baseMemo = new Map<string, Base>();
const eulerMemo = new Map<string, Float64Array>();

function base(target: TargetKey, seed: number): Base {
  const key = `${target}|${seed}`;
  let hit = baseMemo.get(key);
  if (hit) return hit;
  const m = TARGETS[target];
  const x0 = noise(seed, PARTICLES);
  const diffusion = rk4("diffusion", m, x0, REF);
  const flow = rk4("flow", m, x0, REF);
  const reflow = chords(x0, flow, REF);
  const sweep = { diffusion: [] as number[], flow: [] as number[] };
  for (const kind of ["diffusion", "flow"] as const) {
    const exact = kind === "diffusion" ? diffusion : flow;
    for (const n of SWEEP) sweep[kind].push(meanGap(eulerPath(target, seed, kind, n, m, x0), n, exact, REF, 1));
  }
  // Default tracked particle: the largest detour of the flow path among the
  // drawn ones whose chord is long enough for the step arrows to read.
  let auto = 0, detour = -1;
  for (const minChord of [1.6, 0]) {
    for (let i = 0; i < TRAILS; i++) {
      const b = i * (REF + 1) * 2;
      let len = 0;
      for (let j = 0; j < REF; j++) len += Math.hypot(flow[b + 2 * j + 2] - flow[b + 2 * j], flow[b + 2 * j + 3] - flow[b + 2 * j + 1]);
      const chord = Math.hypot(flow[b + 2 * REF] - flow[b], flow[b + 2 * REF + 1] - flow[b + 1]);
      if (chord >= minChord && len - chord > detour) { detour = len - chord; auto = i; }
    }
    if (detour >= 0) break;
  }
  // Training pairs: fresh noise and fresh data draws, independent of each other.
  const PAIRS = 14;
  const pn = noise(seed + 101, PAIRS);
  const u = rng(seed + 202);
  const z = noise(seed + 303, PAIRS);
  const px1 = new Float64Array(2 * PAIRS);
  for (let i = 0; i < PAIRS; i++) {
    const k = Math.min(m.K - 1, Math.floor(u() * m.K));
    px1[2 * i] = m.mx[k] + m.s * z[2 * i];
    px1[2 * i + 1] = m.my[k] + m.s * z[2 * i + 1];
  }
  hit = {
    m, x0, ref: { diffusion, flow, reflow },
    bend: { diffusion: bend(diffusion, REF), flow: bend(flow, REF), reflow: 0 },
    sweep, auto, pairs: { x0: pn, x1: px1 },
  };
  if (baseMemo.size > 12) baseMemo.clear();
  baseMemo.set(key, hit);
  return hit;
}

function eulerPath(target: TargetKey, seed: number, kind: "diffusion" | "flow", n: number, m: Mixture, x0: Float64Array): Float64Array {
  const key = `${target}|${seed}|${kind}|${n}`;
  let hit = eulerMemo.get(key);
  if (!hit) {
    hit = euler(kind, m, x0, n);
    if (eulerMemo.size > 80) eulerMemo.clear();
    eulerMemo.set(key, hit);
  }
  return hit;
}

// The Euler path the reader sees for one sampler at n steps.
function sampled(p: P, sampler: Sampler, b: Base): Float64Array {
  if (sampler === "reflow") return chords(b.x0, b.ref.flow, p.steps);
  return eulerPath(p.target, p.seed, sampler, p.steps, b.m, b.x0);
}

function gaps(p: P, sampler: Sampler, b: Base, tau: number) {
  if (sampler === "reflow") return { now: 0, end: 0 };
  const path = sampled(p, sampler, b);
  return { now: meanGap(path, p.steps, b.ref[sampler], REF, tau), end: meanGap(path, p.steps, b.ref[sampler], REF, 1) };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Sampling paths from noise to a Gaussian mixture",
    diffusion: "Diffusion probability-flow ODE, cosine schedule",
    flow: "Flow matching, linear path, independent pairs",
    reflow: "After one reflow: pairs (x₀, T(x₀))",
    diffusionShort: "diffusion ODE",
    flowShort: "flow matching",
    reflowShort: "after reflow",
    runsDown: "t runs from 1 (noise) to 0 (data)",
    runsUp: "t runs from 0 (noise) to 1 (data)",
    tNow: "time t",
    gapNow: "mean gap to the exact path now",
    gapEnd: "mean gap after {n:step/steps}",
    bend: "exact path length over its chord",
    tracked: "Tracked sample, step {j} of {n}",
    weights: "posterior weights over modes: {w}",
    oneTarget: "one target: the chord to T(x₀)",
    averaged: "step = h × weighted average of the per-mode velocities",
    lgEuler: "Euler steps, one evaluation each",
    lgExact: "exact ODE path",
    lgModes: "mixture modes, radius 3 standard deviations",
    lgPull: "per-mode velocity × h",
    lgStep: "step taken",
    lgPairs: "training pairs",
    lgPairsReflow: "training pairs: the paths themselves",
    lgBefore: "flow path before reflow",
    unit: "1 unit",
    chart: "Mean gap to the exact endpoint after N steps",
    chartX: "Euler steps N (network evaluations)",
    kfStart: "start from reference noise",
    kfStep: "mean gap to the exact paths {g}",
    kfEnd: "samples after {n:step/steps}, mean gap {g}",
    describe: "{name}, data {target}, {n:Euler step/Euler steps}. At t = {t} the samples sit a mean {g} from their exact ODE paths, and {e} after the last step (diffusion ODE {gd}, flow matching {gf}, after reflow 0). The exact paths are {b} longer than their straight chords.",
    two: "two modes", ring: "eight modes on a ring", moons: "two moons",
  },
  zh: {
    title: "从噪声到高斯混合分布的采样路径",
    diffusion: "扩散概率流 ODE，余弦调度",
    flow: "流匹配，线性路径，独立配对",
    reflow: "重流一次之后：配对 (x₀, T(x₀))",
    diffusionShort: "扩散 ODE",
    flowShort: "流匹配",
    reflowShort: "重流之后",
    runsDown: "t 从 1（噪声）走到 0（数据）",
    runsUp: "t 从 0（噪声）走到 1（数据）",
    tNow: "时间 t",
    gapNow: "当前与精确路径的平均偏差",
    gapEnd: "{n} 步之后的平均偏差",
    bend: "精确路径比直线弦多出的长度",
    tracked: "跟踪样本，第 {j} 步（共 {n} 步）",
    weights: "各模式的后验权重：{w}",
    oneTarget: "只有一个目标：指向 T(x₀) 的弦",
    averaged: "这一步 = h × 各模式速度的加权平均",
    lgEuler: "Euler 步，每步评估一次网络",
    lgExact: "精确 ODE 路径",
    lgModes: "混合分布的各个模式，半径 3 个标准差",
    lgPull: "单个模式的速度 × h",
    lgStep: "实际走出的一步",
    lgPairs: "训练配对",
    lgPairsReflow: "训练配对：就是路径本身",
    lgBefore: "重流之前的流路径",
    unit: "1 个单位",
    chart: "N 步之后与精确终点的平均偏差",
    chartX: "Euler 步数 N（网络评估次数）",
    kfStart: "从参考噪声出发",
    kfStep: "与精确路径的平均偏差 {g}",
    kfEnd: "{n} 步之后的样本，平均偏差 {g}",
    describe: "{name}，数据为{target}，{n} 个 Euler 步。t = {t} 时，样本与各自精确 ODE 路径的平均偏差为 {g}，最后一步之后为 {e}（扩散 ODE {gd}，流匹配 {gf}，重流之后为 0）。精确路径的总长度比起点到终点的直线弦多出 {b}。",
    two: "两个模式", ring: "环上八个模式", moons: "双月形",
  },
};
type L = typeof labels.en;

type P = { sampler: Sampler; steps: number; target: TargetKey; pairs: boolean; seed: number; track: number };

const COLOR: Record<Sampler, string> = { diffusion: C.c1, flow: C.c2, reflow: C.c3 };
const SHORT = { diffusion: "diffusionShort", flow: "flowShort", reflow: "reflowShort" } as const;

// The sampler's own time at progress τ.
const ownT = (sampler: Sampler, tau: number) => (sampler === "diffusion" ? 1 - tau : tau);
const g2 = (v: number) => (v < 0.005 ? "0" : fixed(v, 2));

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const b = base(p.target, p.seed);
  const tau = Math.min(1, Math.max(0, st.t / p.steps));
  const cur = gaps(p, p.sampler, b, tau);
  return tpl(Lx.describe, {
    name: Lx[p.sampler], target: Lx[p.target], n: p.steps, t: fixed(ownT(p.sampler, tau), 2),
    g: g2(cur.now), e: g2(cur.end), gd: g2(gaps(p, "diffusion", b, 1).end), gf: g2(gaps(p, "flow", b, 1).end),
    b: pct(b.bend[p.sampler]),
  });
}

function arrow(x1: number, y1: number, x2: number, y2: number, color: string, width: number, opacity = 1): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return "";
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const hl = Math.min(7, len * 0.5) * (width > 1.5 ? 1 : 0.8), hw = hl * 0.55;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  return g({ opacity: opacity < 1 ? opacity : undefined },
    el("line", { x1, y1, x2: bx, y2: by, stroke: color, "stroke-width": width, "stroke-linecap": "round" }),
    el("path", { d: `M${x2},${y2}L${bx - uy * hw},${by + ux * hw}L${bx + uy * hw},${by - ux * hw}Z`, fill: color }));
}

const DOMAIN = 3.8;

// The step whose decomposition is drawn at the tracked particle: the step just
// taken at an integer position (the arrow ends at the particle), the step in
// progress between two, and the first step at the start.
const trackedStep = (tau: number, n: number) => Math.min(n - 1, Math.max(0, Math.ceil(tau * n - 1e-9) - 1));

function renderPlane(p: P, tau: number, b: Base, size: number, x0: number, y0: number, uid: string, Lx: L): string {
  const X = linear([-DOMAIN, DOMAIN], [x0, x0 + size]);
  const Y = linear([-DOMAIN, DOMAIN], [y0 + size, y0]);
  const n = p.steps;
  const col = COLOR[p.sampler];
  const path = sampled(p, p.sampler, b);
  const exact = b.ref[p.sampler];
  const parts: string[] = [];
  const clip = `${uid}-plane`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: x0, y: y0, width: size, height: size }))));
  const inner: string[] = [];

  // Mixture modes: 3 standard deviations, one flat tint so overlaps do not darken.
  inner.push(g({ opacity: 0.16, fill: C.ink3 }, ...Array.from({ length: b.m.K }, (_, k) =>
    el("circle", { cx: X(b.m.mx[k]), cy: Y(b.m.my[k]), r: X(3 * b.m.s) - X(0) }))));

  // Training pairs.
  if (p.pairs) {
    const lines: string[] = [];
    const np = b.pairs.x0.length / 2;
    for (let i = 0; i < np; i++) {
      let pts: Array<[number, number]>;
      if (p.sampler === "reflow") {
        const e = (i * (REF + 1) + REF) * 2;
        pts = [[X(b.x0[2 * i]), Y(b.x0[2 * i + 1])], [X(b.ref.flow[e]), Y(b.ref.flow[e + 1])]];
      } else {
        const ax = b.pairs.x0[2 * i], ay = b.pairs.x0[2 * i + 1], cx = b.pairs.x1[2 * i], cy = b.pairs.x1[2 * i + 1];
        if (p.sampler === "flow") pts = [[X(ax), Y(ay)], [X(cx), Y(cy)]];
        else pts = Array.from({ length: 25 }, (_, j) => { const [a] = cosA(1 - j / 24); const sg = Math.sqrt(Math.max(0, 1 - a * a)); return [X(a * cx + sg * ax), Y(a * cy + sg * ay)] as [number, number]; });
      }
      lines.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "4 3" }));
      const [ex, ey] = pts[pts.length - 1];
      lines.push(el("circle", { cx: ex, cy: ey, r: 2.2, fill: C.ink2 }));
    }
    inner.push(g({ class: "fig-pairs" }, ...lines));
  }

  const track = p.track > 0 ? p.track - 1 : b.auto;
  const pts = (arr: Float64Array, steps: number, i: number, upto: number, stride = 1): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    const last = Math.floor(upto * steps + 1e-9);
    for (let j = 0; j <= last; j += stride) out.push([X(arr[(i * (steps + 1) + j) * 2]), Y(arr[(i * (steps + 1) + j) * 2 + 1])]);
    if (last % stride) out.push([X(arr[(i * (steps + 1) + last) * 2]), Y(arr[(i * (steps + 1) + last) * 2 + 1])]);
    if (upto * steps > last + 1e-9) { const [x, y] = at(arr, steps, i, upto); out.push([X(x), Y(y)]); }
    return out;
  };

  // Exact paths of the drawn particles, whole, faint.
  inner.push(g({ fill: "none", stroke: C.ink3, "stroke-width": 0.9, "stroke-opacity": 0.8 },
    ...Array.from({ length: TRAILS }, (_, i) => (i === track ? "" : el("path", { d: linePath(pts(exact, REF, i, 1, p.sampler === "reflow" ? REF : 4)) })))));
  // Euler paths up to now, and their step vertices.
  const stepDots: string[] = [];
  const trails: string[] = [];
  const doneSteps = Math.floor(tau * n + 1e-9);
  for (let i = 0; i < TRAILS; i++) {
    if (i === track) continue;
    trails.push(el("path", { d: linePath(pts(path, n, i, tau)) }));
    if (p.sampler !== "reflow" || n <= 8) for (let j = 1; j <= doneSteps; j++) stepDots.push(el("circle", { cx: X(path[(i * (n + 1) + j) * 2]), cy: Y(path[(i * (n + 1) + j) * 2 + 1]), r: 1.5 }));
  }
  inner.push(g({ fill: "none", stroke: col, "stroke-width": 1.1, "stroke-opacity": 0.75 }, ...trails));
  inner.push(g({ fill: col }, ...stepDots));
  // Every particle now.
  const dots: string[] = [];
  for (let i = 0; i < PARTICLES; i++) { const [x, y] = at(path, n, i, tau); dots.push(el("circle", { cx: X(x), cy: Y(y), r: 2 })); }
  inner.push(g({ fill: col, "fill-opacity": 0.9 }, ...dots));
  // Hit targets: choose the tracked particle.
  inner.push(g({}, ...Array.from({ length: TRAILS }, (_, i) =>
    el("path", { d: linePath(pts(exact, REF, i, 1, 12)), fill: "none", stroke: "transparent", "stroke-width": 8, "data-fig-set": `track=${i + 1}`, class: "fig-hit" }))));

  // The tracked particle: its exact path, Euler path, the step decomposition.
  if (p.sampler === "reflow") {
    inner.push(el("path", { d: linePath(pts(b.ref.flow, REF, track, 1, 2)), fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "1 3", "stroke-linecap": "round" }));
  }
  inner.push(el("path", { d: linePath(pts(exact, REF, track, 1, 1)), fill: "none", stroke: C.ink, "stroke-width": 1.3 }));
  inner.push(el("path", { d: linePath(pts(path, n, track, tau)), fill: "none", stroke: col, "stroke-width": 2.4, "stroke-linejoin": "round" }));
  for (let j = 1; j <= doneSteps; j++) inner.push(el("circle", { cx: X(path[(track * (n + 1) + j) * 2]), cy: Y(path[(track * (n + 1) + j) * 2 + 1]), r: 2.6, fill: col }));
  const j = trackedStep(tau, n);
  const sx = path[(track * (n + 1) + j) * 2], sy = path[(track * (n + 1) + j) * 2 + 1];
  const nx = path[(track * (n + 1) + j + 1) * 2], ny = path[(track * (n + 1) + j + 1) * 2 + 1];
  if (p.sampler !== "reflow") {
    const modes = { r: new Float64Array(b.m.K), ux: new Float64Array(b.m.K), uy: new Float64Array(b.m.K) };
    field(p.sampler, b.m, sx, sy, j / n, new Float64Array(2), modes);
    for (let k = 0; k < b.m.K; k++) {
      if (modes.r[k] < 0.02) continue;
      inner.push(arrow(X(sx), Y(sy), X(sx + modes.ux[k] / n), Y(sy + modes.uy[k] / n), C.ink2, 1.2, 0.25 + 0.75 * modes.r[k]));
    }
  }
  inner.push(arrow(X(sx), Y(sy), X(nx), Y(ny), C.ink, 2.2));
  const [ex, ey] = at(exact, REF, track, tau);
  const [cx, cy] = at(path, n, track, tau);
  inner.push(el("line", { x1: X(cx), y1: Y(cy), x2: X(ex), y2: Y(ey), stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  inner.push(el("circle", { cx: X(ex), cy: Y(ey), r: 5, fill: "none", stroke: C.ink, "stroke-width": 1.4 }));
  inner.push(el("circle", { cx: X(cx), cy: Y(cy), r: 4.5, fill: col, stroke: C.paper, "stroke-width": 1.5 }));

  parts.push(g({ "clip-path": `url(#${clip})` }, ...inner));
  parts.push(el("rect", { x: x0 + 0.5, y: y0 + 0.5, width: size - 1, height: size - 1, fill: "none", stroke: C.rule, "stroke-width": 1 }));
  // Scale bar.
  const u1 = X(1) - X(0);
  const by = y0 + size - 12;
  parts.push(el("line", { x1: x0 + 10, x2: x0 + 10 + u1, y1: by, y2: by, stroke: C.ink2, "stroke-width": 1.5 }));
  parts.push(el("line", { x1: x0 + 10, x2: x0 + 10, y1: by - 3, y2: by + 3, stroke: C.ink2, "stroke-width": 1.5 }));
  parts.push(el("line", { x1: x0 + 10 + u1, x2: x0 + 10 + u1, y1: by - 3, y2: by + 3, stroke: C.ink2, "stroke-width": 1.5 }));
  parts.push(text(x0 + 14 + u1, by + 4, Lx.unit, { "font-size": TYPE.body, class: "fig-t-halo fig-t-soft" }));
  return g({ class: "fig-plane" }, ...parts);
}

function renderReadout(p: P, tau: number, b: Base, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const line of wrap(Lx[p.sampler], TYPE.label, w)) { y += 15; parts.push(text(x0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 17;
  parts.push(text(x0, y, p.sampler === "diffusion" ? Lx.runsDown : Lx.runsUp, { "font-size": TYPE.body, class: "fig-t-muted" }));
  y += 8;
  const cur = gaps(p, p.sampler, b, tau);
  const rows: Array<[string, string]> = [
    [Lx.tNow, fixed(ownT(p.sampler, tau), 2)],
    [Lx.gapNow, g2(cur.now)],
    [tpl(Lx.gapEnd, { n: p.steps }), g2(cur.end)],
    [Lx.bend, b.bend[p.sampler] > 0.005 ? `+${pct(b.bend[p.sampler])}` : "0%"],
  ];
  for (const [k, v] of rows) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, y + 15, k, { "font-size": TYPE.body }));
    parts.push(text(x0 + w, y + 15, v, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    y += 21;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  // The tracked particle's step.
  const n = p.steps;
  const j = trackedStep(tau, n);
  y += 20;
  parts.push(text(x0, y, tpl(Lx.tracked, { j: j + 1, n }), { "font-size": TYPE.body, class: "fig-t-strong" }));
  const note: string[] = [];
  if (p.sampler === "reflow") note.push(Lx.oneTarget);
  else {
    const track = p.track > 0 ? p.track - 1 : b.auto;
    const path = sampled(p, p.sampler, b);
    const sx = path[(track * (n + 1) + j) * 2], sy = path[(track * (n + 1) + j) * 2 + 1];
    const modes = { r: new Float64Array(b.m.K), ux: new Float64Array(b.m.K), uy: new Float64Array(b.m.K) };
    field(p.sampler, b.m, sx, sy, j / n, new Float64Array(2), modes);
    const top = [...modes.r].sort((a1, a2) => a2 - a1).filter((r) => r >= 0.01).slice(0, 4).map((r) => pct(r));
    const rest = [...modes.r].filter((r) => r >= 0.01).length - top.length;
    note.push(tpl(Lx.weights, { w: top.join(lang === "zh" ? "、" : ", ") + (rest > 0 ? (lang === "zh" ? " 等" : ", …") : "") }));
    note.push(Lx.averaged);
  }
  for (const line of note) for (const part of wrap(line, TYPE.body, w)) { y += 17; parts.push(text(x0, y, part, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function renderChart(p: P, tau: number, b: Base, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [];
  const titleLines = wrap(Lx.chart, TYPE.label, w);
  titleLines.forEach((line, i) => parts.push(text(x0, y0 + 14 + i * 17, line, { "font-size": TYPE.label, class: "fig-t-strong" })));
  const left = x0 + 34, right = x0 + w - 6;
  const top = y0 + 30 + (titleLines.length - 1) * 17, plotH = 120;
  const ymax = Math.ceil(Math.max(...b.sweep.diffusion, ...b.sweep.flow) * 2) / 2;
  const X = log([1, MAX_STEPS], [left, right]);
  const Y = linear([0, ymax], [top + plotH, top]);
  parts.push(axis({ scale: Y, orient: "left", at: left, grid: [left, right], ticks: Y.ticks(4), format: (v) => fixed(v, v % 1 ? 1 : 0), size: TYPE.body }));
  parts.push(axis({ scale: X, orient: "bottom", at: top + plotH, ticks: [1, 2, 4, 8, 16, 32], format: (v) => String(v), title: Lx.chartX, size: TYPE.body }));
  const cur: Record<Sampler, number> = { diffusion: gaps(p, "diffusion", b, 1).end, flow: gaps(p, "flow", b, 1).end, reflow: 0 };
  parts.push(el("line", { x1: X(p.steps), x2: X(p.steps), y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  for (const s of ["diffusion", "flow", "reflow"] as const) {
    const on = s === p.sampler;
    const ys = s === "reflow" ? SWEEP.map(() => 0) : b.sweep[s];
    const line: Array<[number, number]> = SWEEP.map((nn, i) => [X(nn), Y(ys[i])]);
    parts.push(el("path", { d: linePath(line), fill: "none", stroke: COLOR[s], "stroke-width": on ? 2.6 : 1.4, "stroke-opacity": on ? 1 : 0.7, "stroke-linejoin": "round" }));
    parts.push(g({ fill: COLOR[s], "fill-opacity": on ? 1 : 0.7 }, ...line.map(([x, y]) => el("circle", { cx: x, cy: y, r: on ? 2.6 : 1.8 }))));
    parts.push(el("circle", { cx: X(p.steps), cy: Y(cur[s]), r: on ? 5 : 3.6, fill: COLOR[s], stroke: C.paper, "stroke-width": 1.5 }));
    parts.push(el("path", { d: linePath(line), fill: "none", stroke: "transparent", "stroke-width": 10, "data-fig-set": `sampler=${s}`, class: "fig-hit" }));
  }
  let y = top + plotH + axisHeight(true, TYPE.body) + 4;
  const lg = legend((["diffusion", "flow", "reflow"] as const).map((s) => ({
    label: `${Lx[SHORT[s]]} ${g2(cur[s])}`, swatch: { kind: "line" as const, stroke: COLOR[s] },
  })), x0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height;
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const b = base(p.target, p.seed);
  const tau = Math.min(1, Math.max(0, st.t / p.steps));
  const parts: string[] = [];
  const size = narrow ? w : Math.min(360, Math.floor(w * 0.56));
  parts.push(renderPlane(p, tau, b, size, 0, 0, st.uid, Lx));
  const items: LegendItem[] = [
    { label: Lx.lgEuler, swatch: { kind: "line", stroke: COLOR[p.sampler] } },
    { label: Lx.lgExact, swatch: { kind: "line", stroke: C.ink3 } },
    { label: Lx.lgModes, swatch: { kind: "rect", fill: C.ink3, opacity: 0.2 } },
    ...(p.sampler !== "reflow" ? [{ label: Lx.lgPull, swatch: { kind: "line" as const, stroke: C.ink2 } }] : []),
    { label: Lx.lgStep, swatch: { kind: "line", stroke: C.ink } },
    ...(p.sampler === "reflow" ? [{ label: Lx.lgBefore, swatch: { kind: "line" as const, stroke: C.ink2, dash: "1 3" } }] : []),
    ...(p.pairs ? [{ label: p.sampler === "reflow" ? Lx.lgPairsReflow : Lx.lgPairs, swatch: { kind: "line" as const, stroke: C.ink2, dash: "4 3" } }] : []),
  ];
  const lg = legend(items, 0, size + 10, size, TYPE.body);
  parts.push(lg.svg);
  let h: number;
  if (narrow) {
    let y = size + 10 + lg.height + 12;
    const ro = renderReadout(p, tau, b, 0, y, w, Lx, lang);
    parts.push(ro.svg); y += ro.h + 18;
    const ch = renderChart(p, tau, b, 0, y, w, Lx);
    parts.push(ch.svg); y += ch.h;
    h = y;
  } else {
    const rx = size + 24, rw = w - rx;
    const ro = renderReadout(p, tau, b, rx, 0, rw, Lx, lang);
    const ch = renderChart(p, tau, b, rx, ro.h + 16, rw, Lx);
    parts.push(ro.svg, ch.svg);
    h = Math.max(size + 10 + lg.height, ro.h + 16 + ch.h);
  }
  return svg(w, h + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "sampling-paths",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    sampler: {
      kind: "choice", label: { en: "Path", zh: "路径" }, default: "flow",
      options: [
        { value: "diffusion", label: { en: "Diffusion ODE", zh: "扩散 ODE" } },
        { value: "flow", label: { en: "Flow matching", zh: "流匹配" } },
        { value: "reflow", label: { en: "After reflow", zh: "重流之后" } },
      ],
    },
    steps: { kind: "range", label: { en: "Euler steps", zh: "Euler 步数" }, unit: { en: "NFE", zh: "次网络评估" }, min: 1, max: MAX_STEPS, step: 1, default: 4 },
    target: {
      kind: "choice", label: { en: "Data", zh: "数据" }, default: "ring",
      options: [
        { value: "two", label: { en: "Two modes", zh: "两个模式" } },
        { value: "ring", label: { en: "Ring of eight", zh: "环上八个模式" } },
        { value: "moons", label: { en: "Two moons", zh: "双月形" } },
      ],
    },
    pairs: { kind: "toggle", label: { en: "Show training pairs", zh: "显示训练配对" }, default: false },
    seed: { kind: "range", label: { en: "Noise seed", zh: "噪声种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
    track: { kind: "range", label: { en: "Tracked sample", zh: "跟踪样本" }, min: 0, max: TRAILS, step: 1, default: 0, control: false },
  },
  timeline: {
    rate: 2,
    discrete: false,
    duration: (p) => p.steps,
    keyframes: (p, lang) => {
      const Lx = labels[lang];
      const b = base(p.target, p.seed);
      const out = [{ t: 0, label: Lx.kfStart }];
      for (let k = 1; k <= p.steps; k++) {
        const tau = k / p.steps;
        const gp = g2(gaps(p, p.sampler, b, tau).now);
        out.push({ t: k, label: k === p.steps ? tpl(Lx.kfEnd, { n: p.steps, g: gp }) : tpl(Lx.kfStep, { g: gp }) });
      }
      return out;
    },
    poster: (p) => p.steps,
  },
  render,
  describe,
});
