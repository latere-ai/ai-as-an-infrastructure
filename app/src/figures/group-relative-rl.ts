// Group-relative RL over training iterations: GRPO on six prompts with a
// binary verifier (r = 1 pass, r = 0 fail).
//
// Every iteration samples a group of G rollouts per prompt from the current
// policy, scores them, and computes the chapter's group-normalized advantage
//
//   r̄ = (1/G) Σ_j r_j,   s_r = sqrt((1/G) Σ_j (r_j − r̄)²),   A_i = (r_i − r̄) / (s_r + ε)
//
// or, with norm = "none", Dr. GRPO's A_i = r_i − r̄ (no division by s_r).
//
// The policy on one prompt is reduced to a single pass probability p = σ(θ):
// a response either passes or fails, so ∂ log π(y_i) / ∂θ is 1 − p for a
// pass and −p for a fail. One gradient step on the GRPO objective at ρ = 1
// (the first step on fresh rollouts, where clipping does not act) and without
// the KL term moves θ by
//
//   Δθ = η · (1/G) Σ_i A_i · ∂ log π(y_i) / ∂θ,
//
// which works out to η · s_r² / (s_r + ε) for GRPO and 2η · s_r² for Dr. GRPO.
// The Dr. GRPO step is doubled so that a group with half its rollouts passing
// (s_r = 1/2) moves its prompt by the same amount under both rules; what the
// rules change is the weight of groups with a lower spread. Real prompts share
// the model's weights; here each prompt has its own θ, which is enough to show
// where the signal comes from and when it vanishes. All values are synthetic.
//
// The plotted quantity is the chapter's P(no signal) = p^G + (1 − p)^G, the
// complement of P(mixed group) = 1 − p^G − (1 − p)^G.
//
// State is a pure function of the parameters and the iteration t: the run is
// simulated once per parameter set (memoized, seeded) and render reads row t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const ITER = 30; // iterations on the timeline, t = 0 .. ITER − 1
const ETA = 0.8; // GRPO step size on θ
const EPS = 1e-4; // ε in the advantage denominator
const MAX_G = 16;
const G_CHOICES = [4, 8, 16] as const;
type GSize = (typeof G_CHOICES)[number];

// Starting pass rates of the six prompts, hardest first.
const STARTS = {
  spread: [0.02, 0.08, 0.25, 0.5, 0.8, 0.96],
  hard: [0.002, 0.01, 0.03, 0.06, 0.12, 0.25],
  easy: [0.4, 0.7, 0.85, 0.93, 0.97, 0.99],
} as const;
type Start = keyof typeof STARTS;
type Norm = "std" | "none";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
export const noSignal = (p: number, G: number) => p ** G + (1 - p) ** G;

export interface Group {
  j: number; // prompt index, 0-based
  p: number; // pass probability the group was sampled at
  next: number; // pass probability after this iteration's update
  pass: boolean[]; // verifier outcome of each rollout
  k: number; // rollouts that pass
  mean: number; // r̄
  sd: number; // s_r
  aPass: number; // advantage of a passing rollout
  aFail: number; // advantage of a failing rollout
  dTheta: number;
  mixed: boolean;
}

export interface Run { groups: Group[][] } // [t][prompt]

type P = { G: GSize; norm: Norm; start: Start; focus: number; seed: number };

export function simulate(p: Pick<P, "G" | "norm" | "start" | "seed">): Run {
  const u = rng(p.seed);
  const G = p.G;
  const theta: number[] = STARTS[p.start].map(logit);
  const groups: Group[][] = [];
  for (let t = 0; t < ITER; t++) {
    const row: Group[] = [];
    for (let j = 0; j < theta.length; j++) {
      const pj = sigmoid(theta[j]);
      // Draw MAX_G uniforms whatever G is, so the random stream lines up
      // across group sizes and a larger group extends a smaller one.
      const draws = Array.from({ length: MAX_G }, () => u());
      const pass = draws.slice(0, G).map((d) => d < pj);
      const r: number[] = pass.map((b) => (b ? 1 : 0));
      const mean = r.reduce((a, b) => a + b, 0) / G;
      const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / G);
      const adv = (ri: number) => (p.norm === "std" ? (ri - mean) / (sd + EPS) : ri - mean);
      const eta = p.norm === "std" ? ETA : 2 * ETA;
      let grad = 0;
      for (let i = 0; i < G; i++) grad += adv(r[i]) * (pass[i] ? 1 - pj : -pj);
      const dTheta = (eta * grad) / G;
      theta[j] += dTheta;
      const k = r.reduce((a, b) => a + b, 0);
      row.push({ j, p: pj, next: sigmoid(theta[j]), pass, k, mean, sd, aPass: adv(1), aFail: adv(0), dTheta, mixed: k > 0 && k < G });
    }
    groups.push(row);
  }
  return { groups };
}

const memo = new Map<string, Run>();
function run(p: P): Run {
  const key = `${p.G}|${p.norm}|${p.start}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(p);
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

const atT = (st: State<P>) => Math.max(0, Math.min(ITER - 1, Math.round(st.t)));

// The prompt whose equation the readout expands: the chosen one, or by
// default the mixed group with the most uneven outcome at this iteration.
function focusOf(p: P, row: Group[]): Group {
  if (p.focus > 0) return row[p.focus - 1];
  let best: Group | undefined;
  for (const gr of row) {
    if (!gr.mixed) continue;
    if (!best || Math.min(gr.k, p.G - gr.k) < Math.min(best.k, p.G - best.k)) best = gr;
  }
  return best ?? row[0];
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Group-relative RL: rollouts, advantages, and the update",
    head: "Iteration {t}: {m} of 6 groups carry a signal",
    pass: "pass, r = 1",
    fail: "fail, r = 0",
    up: "A > 0: made more likely",
    down: "A < 0: made less likely",
    colRollouts: "{G} rollouts per prompt: A above, r below",
    prompt: "P{j}",
    allPass: "all pass: s_r = 0, A = 0",
    allFail: "all fail: s_r = 0, A = 0",
    mean: "r̄ = {v}",
    sd: "s_r = {v}",
    step: "p {a} → {b}",
    plotTitle: "P(no signal): all {G} rollouts score the same",
    plotX: "pass rate p",
    plotY: "p^G + (1 − p)^G, G = {G}",
    others: "dashed: G = {list}, for comparison",
    curve: "G = {G}",
    dotSignal: "this group mixed",
    dotNone: "no signal",
    ring: "start",
    mixed: "{m} of 6 groups mixed; expected Σ(1 − p^G − (1 − p)^G) = {e}",
    wasted: "rollouts in groups with no signal: {now} of {all} now, {cum} since iteration 0",
    eqHead: "P{j} at iteration {t}: {k} of {G} rollouts pass at p = {p}",
    eqStats: "r̄ = {k}/{G} = {m}, s_r = {s}, ε = 0.0001",
    eqPassStd: "pass: A = (1 − {m}) / ({s} + ε) = {a}",
    eqFailStd: "fail: A = (0 − {m}) / ({s} + ε) = {a}",
    eqPassNone: "pass: A = 1 − {m} = {a}",
    eqFailNone: "fail: A = 0 − {m} = {a}",
    eqZeroStd: "every r_i = {r}, so r̄ = {r}, s_r = 0, and A_i = 0 / (0 + ε) = 0 for all {G}: the prompt adds nothing to the update",
    eqZeroNone: "every r_i = {r}, so r̄ = {r} and A_i = r_i − r̄ = 0 for all {G}: the prompt adds nothing to the update",
    eqUpdate: "update: p {a} → {b}",
    eqNone: "P(no signal) = {p}^{G} + {q}^{G} = {x} + {y} = {z}",
    describe: "Iteration {t} of {d}, {rule}, G = {G}: {m} of 6 groups mixed. {focus}",
    descMixed: "P{j} has {k} of {G} passing, r̄ {m}, s_r {s}, so passing rollouts get A = {a} and failing ones {b}; its pass rate moves from {p} to {q}, and P(no signal) at p = {p} is {z}.",
    descNone: "P{j}'s rollouts all {what}, so s_r = 0, every advantage is 0, and its pass rate stays at {p}; P(no signal) there is {z}.",
    passed: "pass",
    failed: "fail",
    ruleStd: "GRPO advantages",
    ruleNone: "Dr. GRPO advantages",
    kfStart: "the first groups come from the starting policy, and {m} of 6 are mixed",
    kfFirst: "P{j} gets its first mixed group, {k} of {G} passing, and each passing rollout gets A = {a}",
    kfNinety: "P{j} passes 90% of rollouts, where P(no signal) = {z}",
    kfDry: "no group carries a signal",
  },
  zh: {
    title: "组内相对强化学习：采样、优势值与更新",
    head: "第 {t} 次迭代：6 组中有 {m} 组带来信号",
    pass: "通过，r = 1",
    fail: "未通过，r = 0",
    up: "A > 0：提高该回答的概率",
    down: "A < 0：降低其概率",
    colRollouts: "每个提示 {G} 条采样：上为 A，下为 r",
    prompt: "P{j}",
    allPass: "全部通过：s_r = 0，A = 0",
    allFail: "全部未通过：s_r = 0，A = 0",
    mean: "r̄ = {v}",
    sd: "s_r = {v}",
    step: "p {a} → {b}",
    plotTitle: "P(无信号)：{G} 条采样得分全部相同的概率",
    plotX: "通过率 p",
    plotY: "p^G + (1 − p)^G，G = {G}",
    others: "虚线：G = {list}，用于对照",
    curve: "G = {G}",
    dotSignal: "本组有成有败",
    dotNone: "无信号",
    ring: "起点",
    mixed: "6 组中有 {m} 组有成有败；期望值 Σ(1 − p^G − (1 − p)^G) = {e}",
    wasted: "落在无信号组里的采样：本次 {now} / {all}，自第 0 次迭代累计 {cum}",
    eqHead: "P{j}，第 {t} 次迭代：p = {p}，{G} 条采样中 {k} 条通过",
    eqStats: "r̄ = {k}/{G} = {m}，s_r = {s}，ε = 0.0001",
    eqPassStd: "通过：A = (1 − {m}) / ({s} + ε) = {a}",
    eqFailStd: "未通过：A = (0 − {m}) / ({s} + ε) = {a}",
    eqPassNone: "通过：A = 1 − {m} = {a}",
    eqFailNone: "未通过：A = 0 − {m} = {a}",
    eqZeroStd: "每条 r_i 都是 {r}，所以 r̄ = {r}、s_r = 0，{G} 条采样的 A_i = 0 / (0 + ε) = 0：这个提示对更新没有贡献",
    eqZeroNone: "每条 r_i 都是 {r}，所以 r̄ = {r}，{G} 条采样的 A_i = r_i − r̄ = 0：这个提示对更新没有贡献",
    eqUpdate: "更新：p {a} → {b}",
    eqNone: "P(无信号) = {p}^{G} + {q}^{G} = {x} + {y} = {z}",
    describe: "第 {t} 次迭代（共 {d} 次），{rule}，G = {G}：6 组中有 {m} 组有成有败。{focus}",
    descMixed: "P{j} 的 {G} 条采样中 {k} 条通过，r̄ 为 {m}，s_r 为 {s}，通过的采样得到 A = {a}，未通过的得到 {b}；它的通过率从 {p} 变为 {q}，p = {p} 时 P(无信号) 为 {z}。",
    descNone: "P{j} 的采样全部{what}，s_r = 0，优势值全为 0，通过率停在 {p}；此时 P(无信号) 为 {z}。",
    passed: "通过",
    failed: "未通过",
    ruleStd: "GRPO 优势值",
    ruleNone: "Dr. GRPO 优势值",
    kfStart: "第一批采样组来自起始策略，6 组中有 {m} 组有成有败",
    kfFirst: "P{j} 第一次出现有成有败的组，{G} 条中 {k} 条通过，每条通过的采样得到 A = {a}",
    kfNinety: "P{j} 的通过率达到 90%，此时 P(无信号) = {z}",
    kfDry: "所有组都没有信号",
  },
};

type L = typeof labels.en;

const signed = (v: number) => (v > 0 ? `+${fixed(v, 2)}` : fixed(v, 2));
const p2 = (v: number) => fixed(v, 2);

function events(p: P, lang: Lang) {
  const Lx = labels[lang];
  const { groups } = run(p);
  const out: Array<{ t: number; label: string }> = [];
  const m0 = groups[0].filter((gr) => gr.mixed).length;
  out.push({ t: 0, label: tpl(Lx.kfStart, { m: m0 }) });
  const n = groups[0].length;
  for (let j = 0; j < n; j++) {
    const first = groups.findIndex((row) => row[j].mixed);
    if (first > 0) {
      const gr = groups[first][j];
      out.push({ t: first, label: tpl(Lx.kfFirst, { j: j + 1, k: gr.k, G: p.G, a: signed(gr.aPass) }) });
    }
    if (groups[0][j].p < 0.9) {
      const at = groups.findIndex((row) => row[j].p >= 0.9);
      if (at > 0) out.push({ t: at, label: tpl(Lx.kfNinety, { j: j + 1, z: tiny(noSignal(groups[at][j].p, p.G)) }) });
    }
  }
  const dry = groups.findIndex((row) => row.every((gr) => !gr.mixed));
  if (dry >= 0) out.push({ t: dry, label: Lx.kfDry });
  return out.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------- drawing

// One group: an advantage lane (bars up for A > 0, down for A < 0 around a
// zero rule) above a row of G reward cells.
const BAR = 16;
const LANE = 2 * BAR;
const CELL_H = 12;
const STRIP_H = LANE + 4 + CELL_H;
const LABEL_W = 28;
const A_W = 44; // room for the advantage values right of the strip
const STATS_W = 92;

function pitchFor(G: number, narrow: boolean, avail: number): number {
  const want = G <= 4 ? 28 : G <= 8 ? 23 : 15;
  return Math.max(12, Math.min(want, Math.floor(avail / G)));
}

function strip(gr: Group, G: number, x0: number, y0: number, pitch: number, amax: number): string {
  const parts: string[] = [];
  const cw = pitch - 3;
  const bw = Math.max(4, Math.round(cw * 0.6));
  const zero = y0 + BAR;
  if (gr.mixed) parts.push(el("line", { x1: x0 - 2, x2: x0 + G * pitch - 1, y1: zero, y2: zero, stroke: C.rule, "stroke-width": 1 }));
  const cy = y0 + LANE + 4;
  for (let i = 0; i < G; i++) {
    const x = x0 + i * pitch;
    const ok = gr.pass[i];
    parts.push(ok
      ? el("rect", { x, y: cy, width: cw, height: CELL_H, rx: 2, fill: C.c1 })
      : el("rect", { x: x + 0.6, y: cy + 0.6, width: cw - 1.2, height: CELL_H - 1.2, rx: 2, fill: C.paper, stroke: C.c2, "stroke-width": 1.2 }));
    const a = ok ? gr.aPass : gr.aFail;
    const h = Math.min(BAR - 1, (Math.abs(a) / amax) * (BAR - 1));
    if (gr.mixed && h >= 0.5) {
      const bx = x + (cw - bw) / 2;
      parts.push(a > 0
        ? el("rect", { x: bx, y: zero - h, width: bw, height: h, fill: C.c1 })
        : el("rect", { x: bx, y: zero, width: bw, height: h, fill: C.c2 }));
    }
  }
  return parts.join("");
}

// Width of the rows block for group size G on a desktop layout.
function rowsWidth(G: number): number {
  return LABEL_W + G * pitchFor(G, false, 1e9) + A_W + STATS_W;
}

function renderRows(p: P, row: Group[], focus: Group, x0: number, y0: number, w: number, narrow: boolean, Lx: L): { svg: string; h: number } {
  const parts: string[] = [];
  const G = p.G;
  // One bar scale for both rules at a given G: the largest GRPO advantage,
  // √(G − 1) for a lone pass or fail, fills the lane. Switching to Dr. GRPO
  // then shows how much the division by s_r had enlarged uneven groups.
  const amax = Math.sqrt(G - 1);
  const pitch = pitchFor(G, narrow, w - LABEL_W - A_W - (narrow ? 0 : STATS_W));
  const stripW = G * pitch - 3;
  parts.push(text(x0 + LABEL_W, y0 + 13, tpl(Lx.colRollouts, { G }), { "font-size": TYPE.body, class: "fig-t-muted" }));
  let y = y0 + 26;
  const lineH = narrow ? 20 : 0;
  const pitchY = lineH + STRIP_H + (narrow ? 14 : 12);
  for (const gr of row) {
    const on = gr.j === focus.j;
    if (on) parts.push(el("rect", { x: x0 - 4, y: y - 5, width: w + 8, height: pitchY - 2, rx: 4, fill: C.panel }));
    const sy = y + lineH;
    const cls = on ? "fig-t-strong fig-t-num" : "fig-t-num";
    parts.push(text(x0, narrow ? y + 12 : sy + LANE + 2, tpl(Lx.prompt, { j: gr.j + 1 }), { "font-size": TYPE.label, class: on ? "fig-t-strong" : "fig-t-muted" }));
    parts.push(strip(gr, G, x0 + LABEL_W, sy, pitch, amax));
    const ax = x0 + LABEL_W + stripW + 6;
    if (gr.mixed) {
      parts.push(text(ax, sy + 12, signed(gr.aPass), { "font-size": TYPE.body, class: cls }));
      parts.push(text(ax, sy + LANE, signed(gr.aFail), { "font-size": TYPE.body, class: cls }));
    } else {
      // No bars: say why on the empty lane.
      parts.push(text(x0 + LABEL_W, sy + BAR + 4, gr.k === G ? Lx.allPass : Lx.allFail, { "font-size": TYPE.body, class: "fig-t-muted" }));
    }
    const step = tpl(Lx.step, { a: p2(gr.p), b: p2(gr.next) });
    if (narrow) {
      parts.push(text(x0 + LABEL_W, y + 12, `${tpl(Lx.mean, { v: p2(gr.mean) })} · ${tpl(Lx.sd, { v: p2(gr.sd) })}`, { "font-size": TYPE.body, class: cls }));
      parts.push(text(x0 + w, y + 12, step, { "font-size": TYPE.body, "text-anchor": "end", class: cls }));
    } else {
      const sx = x0 + w - STATS_W;
      parts.push(text(sx, sy + 12, tpl(Lx.mean, { v: p2(gr.mean) }), { "font-size": TYPE.body, class: cls }));
      parts.push(text(sx, sy + 28, tpl(Lx.sd, { v: p2(gr.sd) }), { "font-size": TYPE.body, class: cls }));
      parts.push(text(sx, sy + 44, step, { "font-size": TYPE.body, class: cls }));
    }
    // Hit target: expand this prompt's equation in the readout.
    parts.push(el("rect", { x: x0 - 4, y: y - 5, width: w + 8, height: pitchY - 2, fill: "transparent", "data-fig-set": `focus=${gr.j + 1}`, class: "fig-hit" }));
    y += pitchY;
  }
  return { svg: g({ class: "fig-rows" }, ...parts), h: y - y0 - 8 };
}

function renderPlot(p: P, row: Group[], start: Group[], x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const title = wrap(tpl(Lx.plotTitle, { G: p.G }), TYPE.label, w);
  title.forEach((ln, i) => parts.push(text(x0, y0 + 13 + i * 17, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  const left = x0 + 34;
  const right = x0 + w - 10;
  const top = y0 + 27 + title.length * 17;
  const plotH = Math.round(Math.min(220, Math.max(160, (right - left) * 0.8)));
  const bottom = top + plotH;
  const x = linear([0, 1], [left, right]);
  const y = linear([0, 1], [bottom, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [top, bottom], title: Lx.plotX, size: TYPE.body, format: (v) => sig(v, 2) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, right], title: tpl(Lx.plotY, { G: p.G }), size: TYPE.body, format: (v) => sig(v, 2) }));
  const curve = (G: number, a = 0, b = 1, n = 120) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) { const v = a + ((b - a) * i) / n; pts.push([x(v), y(noSignal(v, G))]); }
    return pts;
  };
  const others = G_CHOICES.filter((G) => G !== p.G);
  for (const G of others) parts.push(el("path", { d: linePath(curve(G)), fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: linePath(curve(p.G)), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  // Each prompt's path along the curve from where training started to now.
  for (let j = 0; j < row.length; j++) {
    const a = Math.min(start[j].p, row[j].p), b = Math.max(start[j].p, row[j].p);
    if (b - a > 0.004) parts.push(el("path", { d: linePath(curve(p.G, a, b, 24)), fill: "none", stroke: C.c1, "stroke-width": 5, "stroke-opacity": 0.35, "stroke-linecap": "round" }));
  }
  for (let j = 0; j < row.length; j++) {
    parts.push(el("circle", { cx: x(start[j].p), cy: y(noSignal(start[j].p, p.G)), r: 3.5, fill: C.paper, stroke: C.ink2, "stroke-width": 1.2 }));
  }
  // Prompts as numbered dots, hardest drawn last so it stays on top where
  // saturated prompts pile up near p = 1.
  for (const gr of [...row].reverse()) {
    const cx = x(gr.p), cy = y(noSignal(gr.p, p.G));
    parts.push(g({ "data-fig-set": `focus=${gr.j + 1}`, class: "fig-hit" },
      el("circle", { cx, cy, r: 8, fill: gr.mixed ? C.ink : C.ink3, stroke: C.paper, "stroke-width": 1.5 }),
      el("text", { x: cx, y: cy + 4.2, "font-size": TYPE.body, "text-anchor": "middle", style: "fill:var(--fig-paper);font-weight:600" }, String(gr.j + 1))));
  }
  // Legend: dot kinds, the start ring, and the comparison curves.
  let yy = bottom + axisHeight(true, TYPE.body) + 8;
  const items: Array<[string, string]> = [
    [el("circle", { cx: 6, cy: -4, r: 6, fill: C.ink }), Lx.dotSignal],
    [el("circle", { cx: 6, cy: -4, r: 6, fill: C.ink3 }), Lx.dotNone],
    [el("circle", { cx: 6, cy: -4, r: 3.5, fill: C.paper, stroke: C.ink2, "stroke-width": 1.2 }), Lx.ring],
  ];
  let lx = x0;
  for (const [mark, label] of items) {
    const wItem = 18 + textWidth(label, TYPE.body);
    if (lx > x0 && lx + wItem > x0 + w) { lx = x0; yy += 20; }
    parts.push(g({ transform: `translate(${lx} ${yy})` }, mark), text(lx + 18, yy, label, { "font-size": TYPE.body }));
    lx += wItem + 16;
  }
  yy += 20;
  parts.push(el("line", { x1: x0, x2: x0 + 14, y1: yy - 4, y2: yy - 4, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  const note = tpl(Lx.others, { list: others.join(lang === "zh" ? "、" : " and ") });
  for (const ln of wrap(note, TYPE.body, w - 20)) { parts.push(text(x0 + 20, yy, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); yy += 16; }
  return { svg: g({ class: "fig-plot" }, ...parts), h: yy - y0 - 10 };
}

// Tiny probabilities as a × 10⁻ⁿ rather than e-notation.
const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
function tiny(v: number): string {
  if (v === 0) return "0";
  if (v >= 0.001) return v >= 0.01 ? fixed(v, 2) : sig(v, 2);
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${m.toFixed(1)}×10${String(e).split("").map((c) => SUP[c]).join("")}`;
}

function renderReadout(p: P, t: number, row: Group[], focus: Group, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const G = p.G;
  const { groups } = run(p);
  const m = row.filter((gr) => gr.mixed).length;
  const expected = row.reduce((a, gr) => a + 1 - noSignal(gr.p, G), 0);
  let cumWaste = 0, cumAll = 0;
  for (let s = 0; s <= t; s++) for (const gr of groups[s]) { cumAll += G; if (!gr.mixed) cumWaste += G; }
  const lines: Array<[string, string]> = [];
  const f = focus;
  lines.push([tpl(Lx.eqHead, { j: f.j + 1, t, k: f.k, G, p: p2(f.p) }), "fig-t-strong"]);
  if (f.mixed) {
    const std = p.norm === "std";
    lines.push([tpl(Lx.eqStats, { k: f.k, G, m: fixed(f.mean, 3), s: fixed(f.sd, 3) }), "fig-t-num"]);
    lines.push([tpl(std ? Lx.eqPassStd : Lx.eqPassNone, { m: fixed(f.mean, 3), s: fixed(f.sd, 3), a: signed(f.aPass) }), "fig-t-num"]);
    lines.push([tpl(std ? Lx.eqFailStd : Lx.eqFailNone, { m: fixed(f.mean, 3), s: fixed(f.sd, 3), a: signed(f.aFail) }), "fig-t-num"]);
  } else {
    lines.push([tpl(p.norm === "std" ? Lx.eqZeroStd : Lx.eqZeroNone, { r: f.k === G ? 1 : 0, G }), "fig-t-num"]);
  }
  lines.push([tpl(Lx.eqUpdate, { a: fixed(f.p, 3), b: fixed(f.next, 3) }), "fig-t-num"]);
  const a = f.p ** G, b = (1 - f.p) ** G;
  lines.push([tpl(Lx.eqNone, { p: p2(f.p), q: p2(1 - f.p), G, x: tiny(a), y: tiny(b), z: tiny(a + b) }), "fig-t-num"]);
  lines.push(["", ""]);
  lines.push([tpl(Lx.mixed, { m, e: fixed(expected, 1) }), "fig-t-num"]);
  lines.push([tpl(Lx.wasted, { now: (row.length - m) * G, all: row.length * G, cum: pct(cumWaste / cumAll) }), "fig-t-num"]);
  const parts: string[] = [];
  let y = y0;
  for (const [s, cls] of lines) {
    if (!s) { y += 6; continue; }
    for (const ln of wrap(s, TYPE.body, w)) {
      y += 17;
      parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: cls || undefined }));
    }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const t = atT(st);
  const row = run(p).groups[t];
  const f = focusOf(p, row);
  const m = row.filter((gr) => gr.mixed).length;
  const z = tiny(noSignal(f.p, p.G));
  const focus = f.mixed
    ? tpl(Lx.descMixed, { j: f.j + 1, k: f.k, G: p.G, m: p2(f.mean), s: p2(f.sd), a: signed(f.aPass), b: signed(f.aFail), p: p2(f.p), q: p2(f.next), z })
    : tpl(Lx.descNone, { j: f.j + 1, what: f.k === p.G ? Lx.passed : Lx.failed, p: p2(f.p), z });
  return tpl(Lx.describe, { t, d: ITER - 1, rule: p.norm === "std" ? Lx.ruleStd : Lx.ruleNone, G: p.G, m, focus });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = atT(st);
  const { groups } = run(p);
  const row = groups[t];
  const focus = focusOf(p, row);
  const m = row.filter((gr) => gr.mixed).length;
  const parts: string[] = [];
  parts.push(text(0, 14, tpl(Lx.head, { t, m }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: Lx.pass, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.fail, swatch: { kind: "rect", fill: "none", stroke: C.c2 } },
    { label: Lx.up, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.down, swatch: { kind: "rect", fill: C.c2 } },
  ], 0, 24, w, TYPE.body);
  parts.push(lg.svg);
  let y = 34 + lg.height;
  if (narrow) {
    const rows = renderRows(p, row, focus, 4, y, w - 8, true, Lx);
    parts.push(rows.svg); y += rows.h + 22;
    const plot = renderPlot(p, row, groups[0], 0, y, w, Lx, lang);
    parts.push(plot.svg); y += plot.h + 14;
    const ro = renderReadout(p, t, row, focus, 0, y, w, Lx);
    parts.push(ro.svg); y += ro.h;
  } else {
    const gap = 26;
    const rowsW = Math.min(rowsWidth(p.G), w - gap - 200);
    const rows = renderRows(p, row, focus, 4, y, rowsW - 8, false, Lx);
    const plot = renderPlot(p, row, groups[0], rowsW + gap, y - 4, w - rowsW - gap, Lx, lang);
    parts.push(rows.svg, plot.svg);
    y += Math.max(rows.h, plot.h - 4) + 14;
    const ro = renderReadout(p, t, row, focus, 0, y, w, Lx);
    parts.push(ro.svg); y += ro.h;
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "group-relative-rl",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    G: {
      kind: "choice", label: { en: "Group size G", zh: "组大小 G" }, default: 8,
      options: G_CHOICES.map((v) => ({ value: v, label: { en: `${v} rollouts`, zh: `${v} 条采样` } })),
    },
    norm: {
      kind: "choice", label: { en: "Advantage", zh: "优势值" }, default: "std",
      options: [
        { value: "std", label: { en: "GRPO: ÷ (s_r + ε)", zh: "GRPO：除以 s_r + ε" } },
        { value: "none", label: { en: "Dr. GRPO: r − r̄ only", zh: "Dr. GRPO：只减去 r̄" } },
      ],
    },
    start: {
      kind: "choice", label: { en: "Starting pass rates", zh: "起始通过率" }, default: "spread",
      options: [
        { value: "spread", label: { en: "Spread out", zh: "高低分散" } },
        { value: "hard", label: { en: "Mostly unsolved", zh: "多数解不出" } },
        { value: "easy", label: { en: "Mostly solved", zh: "多数能解出" } },
      ],
    },
    focus: {
      kind: "choice", control: "select", label: { en: "Expand the equation for", zh: "展开算式" }, default: 0,
      options: [
        { value: 0, label: { en: "the most uneven mixed group", zh: "成败最悬殊的混合组" } },
        ...Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: { en: `P${i + 1}`, zh: `P${i + 1}` } })),
      ],
    },
    seed: { kind: "range", label: { en: "Sampling seed", zh: "采样种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  timeline: {
    rate: 2,
    discrete: true,
    duration: () => ITER - 1,
    keyframes: (p, lang) => events(p, lang),
    // Open on an iteration that shows every case at once: a mixed group with
    // one rare outcome (the largest advantage), a balanced one, and groups
    // that give no signal because they all passed or all failed.
    poster: (p) => {
      const { groups } = run(p);
      let best = 0, score = -Infinity;
      for (let t = 4; t < ITER; t++) {
        const row = groups[t];
        const rare = row.some((gr) => gr.mixed && (gr.k === 1 || gr.k === p.G - 1));
        const mixed = row.filter((gr) => gr.mixed).length;
        const allPass = row.some((gr) => gr.k === p.G);
        const allFail = row.some((gr) => gr.k === 0);
        const sc = (rare ? 4 : 0) + Math.min(mixed, 3) + (allPass ? 1 : 0) + (allFail ? 1 : 0) - t * 0.02;
        if (sc > score) { score = sc; best = t; }
      }
      return best;
    },
  },
  render,
  describe,
});
