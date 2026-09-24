// One DP-SGD step on a toy batch, and the (ε, δ) bound it earns, computed
// exactly from the chapter's own definitions.
//
// The step is the chapter's: clip each per-example gradient to norm C,
//   ḡ_i = g_i · min(1, C / ‖g_i‖₂),
// sum the clipped gradients, add N(0, σ²C²I), divide by B. The gradients are
// eight seeded 2-D vectors (illustrative); the protected person contributes
// the first k of them.
//
// Adjacency is add/remove of that person. Their clipped gradients shift the
// noisy sum by a vector of norm at most Δ = kC, so the worst case of one step
// is two Gaussians with the same covariance s²I, s = σC, whose means differ by
// Δ. Only the component along that difference carries information, so the
// comparison is one-dimensional: M(D′) ~ N(0, s²), M(D) ~ N(Δ, s²). For the
// chapter's inequality p ≤ e^ε p′ + δ, the set S that needs the largest δ is
// where the privacy loss ln(density of D / density of D′) exceeds ε, the
// half-line y > t with t = s²ε/Δ + Δ/2 (Neyman–Pearson). Its masses are
//   p  = Pr[M(D) ∈ S]  = Φ(Δ/(2s) − εs/Δ)
//   p′ = Pr[M(D′) ∈ S] = Φ(−Δ/(2s) − εs/Δ)
// and the smallest δ for which the step is (ε, δ)-DP is δ(ε) = p − e^ε p′,
// which depends on Δ/s = k/σ only: C cancels. The swapped direction gives the
// same δ by symmetry.
//
// This is one step with every record in the batch (no subsampling). A run
// composes many steps, and a privacy accountant converts the sampling rate,
// noise, and step count into the run's (ε, δ); the figure does not do that.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { normalPdf, normalTail, normalFrom } from "./lib/stats.ts";
import { fixed, sig, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";

const BATCH = 8;
const DELTA_FLOOR = 1e-12;

type P = { sigma: number; clip: number; k: number; eps: number; seed: number };

type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s];
const norm = (a: V) => Math.hypot(a[0], a[1]);

// Φ(z) through the upper tail, which keeps relative precision far out.
const Phi = (z: number) => normalTail(-z);

// The smallest δ at ε for Gaussians whose means differ by r = Δ/s noise SDs.
export function deltaAt(eps: number, r: number): { p: number; pp: number; delta: number } {
  const p = Phi(r / 2 - eps / r);
  const pp = Phi(-r / 2 - eps / r);
  return { p, pp, delta: Math.max(0, p - Math.exp(eps) * pp) };
}

interface Batch { raw: V[]; clipped: V[] }

// Eight illustrative per-example gradients: directions spread around a common
// one, norms from 0.4 to 2.6, the first (the person's first record) the longest.
const batchMemo = new Map<number, V[]>();
function rawBatch(seed: number): V[] {
  const hit = batchMemo.get(seed);
  if (hit) return hit;
  const u = rng(seed * 2654435761 >>> 0);
  const out: V[] = [];
  for (let i = 0; i < BATCH; i++) {
    const ang = (35 + (u() - 0.5) * 110) * (Math.PI / 180);
    const n = i === 0 ? 2.6 : 0.4 + u() * 1.9;
    out.push([n * Math.cos(ang), n * Math.sin(ang)]);
  }
  batchMemo.set(seed, out);
  return out;
}

function batch(p: P): Batch {
  const raw = rawBatch(p.seed);
  const clipped = raw.map((g0) => scale(g0, Math.min(1, p.clip / norm(g0))));
  return { raw, clipped };
}

interface Model {
  b: Batch;
  sum: V; sumOut: V; // Σ ḡ with and without the person's records
  shift: number; // ‖Σ − Σ′‖, at most Δ
  noise: V; release: V; // one seeded noise draw and the released noisy sum
  Delta: number; s: number; r: number;
  t: number; // threshold of S along the difference direction
  p: number; pp: number; delta: number;
}

function model(p: P): Model {
  const b = batch(p);
  const sum = b.clipped.reduce<V>((a, v) => add(a, v), [0, 0]);
  const sumOut = b.clipped.slice(p.k).reduce<V>((a, v) => add(a, v), [0, 0]);
  const shift = norm([sum[0] - sumOut[0], sum[1] - sumOut[1]]);
  const u = rng((p.seed * 40503 + 17) >>> 0);
  const s = p.sigma * p.clip;
  const noise: V = [normalFrom(u(), u()) * s, normalFrom(u(), u()) * s];
  const Delta = p.k * p.clip;
  const r = Delta / s;
  const { p: pm, pp, delta } = deltaAt(p.eps, r);
  return { b, sum, sumOut, shift, noise, release: add(sum, noise), Delta, s, r, t: (s * s * p.eps) / Delta + Delta / 2, p: pm, pp, delta };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "One DP-SGD step and its (ε, δ) bound",
    stepHead: "One step on a batch of B = 8",
    rawG: "gradient g_i",
    clippedG: "clipped ḡ_i",
    person: "the person's records",
    clipCircle: "‖ḡ‖ ≤ C",
    sumD: "Σ ḡ, with the person",
    sumOut: "Σ′, without",
    noiseRing: "noise, 1 and 2 SD",
    release: "one release",
    stepEq: "g̃ = (Σ ḡ_i + N(0, σ²C²I)) / B",
    shift: "the person shifts the sum by {v}, at most Δ = kC = {d}",
    lossHead: "Along the shift: the two outputs",
    lossAxis: "noisy sum along the shift direction",
    curveOut: "M(D′), without",
    curveIn: "M(D), with",
    setS: "S: privacy loss > ε",
    tMark: "t",
    profHead: "Smallest δ for each ε, one step",
    profX: "ε",
    profY: "δ",
    profK1: "k = 1",
    profNow: "k = {k}",
    below: "δ < 10⁻¹²",
    eqDelta: "Δ = kC = {d}, s = σC = {s}, Δ/s = k/σ = {r}; C cancels",
    eqS: "S = {y : ln p(y)/p′(y) > ε} = {y > s²ε/Δ + Δ/2 = {t}}",
    eqP: "p = Pr[M(D) ∈ S] = {p}, p′ = Pr[M(D′) ∈ S] = {pp}",
    eqBound: "p ≤ e^ε p′ + δ with δ = p − e^ε p′ = {p} − {e} × {pp} = {delta}",
    eqClaim: "this step is ({eps}, {delta})-DP for a person with {k:record/records} in the batch",
    describe: "Noise multiplier σ = {sigma}, clipping norm C = {c}, {k:record/records} per person: one step shifts the noisy sum by at most Δ = {d} against noise of standard deviation {s}, so at ε = {eps} the smallest δ is {delta}. In the set S where the privacy loss exceeds ε, p = {p} and p′ = {pp}.",
  },
  zh: {
    title: "DP-SGD 的一步及其 (ε, δ) 界",
    stepHead: "批大小 B = 8 上的一步",
    rawG: "梯度 g_i",
    clippedG: "裁剪后 ḡ_i",
    person: "这个人的记录",
    clipCircle: "‖ḡ‖ ≤ C",
    sumD: "Σ ḡ，含此人",
    sumOut: "Σ′，不含此人",
    noiseRing: "噪声 1 倍和 2 倍标准差",
    release: "一次发布",
    stepEq: "g̃ = (Σ ḡ_i + N(0, σ²C²I)) / B",
    shift: "此人使梯度和移动 {v}，至多 Δ = kC = {d}",
    lossHead: "沿移动方向看两种输出",
    lossAxis: "带噪梯度和在移动方向上的分量",
    curveOut: "M(D′)，不含此人",
    curveIn: "M(D)，含此人",
    setS: "S：隐私损失 > ε",
    tMark: "t",
    profHead: "单步下每个 ε 对应的最小 δ",
    profX: "ε",
    profY: "δ",
    profK1: "k = 1",
    profNow: "k = {k}",
    below: "δ < 10⁻¹²",
    eqDelta: "Δ = kC = {d}，s = σC = {s}，Δ/s = k/σ = {r}；C 被约去",
    eqS: "S = {y : ln p(y)/p′(y) > ε} = {y > s²ε/Δ + Δ/2 = {t}}",
    eqP: "p = Pr[M(D) ∈ S] = {p}，p′ = Pr[M(D′) ∈ S] = {pp}",
    eqBound: "p ≤ e^ε p′ + δ，其中 δ = p − e^ε p′ = {p} − {e} × {pp} = {delta}",
    eqClaim: "对批内有 {k} 条记录的人，这一步满足 ({eps}, {delta}) 差分隐私",
    describe: "噪声乘数 σ = {sigma}，裁剪范数 C = {c}，每人 {k} 条记录：一步最多让带噪梯度和移动 Δ = {d}，噪声标准差为 {s}，因此在 ε = {eps} 时最小的 δ 为 {delta}。在隐私损失超过 ε 的集合 S 上，p = {p}，p′ = {pp}。",
  },
};
type L = typeof labels.en;

// δ and the S masses span many decades: significant figures, or scientific
// notation below 0.001, with the floor marked.
const small = (v: number) => (v <= 0 ? "0" : v < 1e-3 ? sci(v, 2) : sig(v, 2));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    sigma: sig(p.sigma, 3), c: sig(p.clip, 3), k: p.k, d: sig(m.Delta, 3), s: sig(m.s, 3),
    eps: sig(p.eps, 3), delta: m.delta < DELTA_FLOOR ? L.below : small(m.delta), p: small(m.p), pp: small(m.pp),
  });
}

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

function render(st: State<P>, lang: Lang): string {
  return svg(st.w, 40, describe(st, lang));
}

export default defineFigure({
  name: "dp-sgd-step",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    sigma: {
      kind: "range", scale: "log", label: { en: "Noise multiplier σ", zh: "噪声乘数 σ" }, min: 0.3, max: 10, default: 2,
    },
    clip: {
      kind: "range", scale: "log", label: { en: "Clipping norm C", zh: "裁剪范数 C" }, min: 0.25, max: 4, default: 1,
    },
    k: {
      kind: "choice", label: { en: "Records per person in the batch", zh: "此人在批内的记录数" }, default: 1,
      options: [
        { value: 1, label: { en: "1, record-level", zh: "1，记录级" } },
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 4, label: { en: "4", zh: "4" } },
      ],
    },
    eps: {
      kind: "range", scale: "log", label: { en: "Privacy loss bound ε", zh: "隐私损失上界 ε" }, min: 0.05, max: 10, default: 1,
    },
    seed: { kind: "range", label: { en: "Gradient seed", zh: "梯度种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  render,
  describe,
});
