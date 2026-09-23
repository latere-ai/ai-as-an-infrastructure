// Speculative sampling as a seeded accept-and-reject process, cycle by cycle.
//
// The vocabulary has six tokens, and every position uses the same target
// distribution p and the same draft distribution q. q is a mixture of p and a
// fixed distribution u that the draft errs toward,
//
//   q = (1 − λ) p + λ u,   λ = (1 − α) / TV(p, u),
//
// which makes Σ_v min(p(v), q(v)) = 1 − λ·TV(p, u) = α exactly. The
// conditional acceptance probability is therefore α at every position and
// independent of the prefix, the assumption under which the chapter's
// E[Y] = (1 − α^(γ+1)) / (1 − α) holds, and the rejection probability is
// Z = Σ[p − q]+ = 1 − α.
//
// A cycle drafts γ tokens x_k ~ q, then walks them left to right: x_k is
// accepted when u_k < a(x_k) = min(1, p(x_k) / q(x_k)). The first rejection
// emits a correction drawn from r = [p − q]+ / Z and discards the rest; if all
// γ are accepted, a bonus token is drawn from p. Every cycle consumes 2γ + 1
// seeded uniforms in a fixed order (γ draft draws, γ acceptance draws, one
// resolve draw), so a cycle's draws do not depend on earlier outcomes and the
// same parameters replay the same run.
//
// The timeline walks the first cycles one operation at a time (propose, score,
// check each position, resolve, commit), then shows whole cycles at growing
// strides so the histogram of Y and the emitted-token frequencies can be seen
// approaching E[Y] and p. State is a pure function of the parameters and the
// frame index; the whole run is simulated once per parameter set (memoized).

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export const TOKENS = ["A", "B", "C", "D", "E", "F"];
// Illustrative target distribution and the direction the draft errs toward:
// the draft overweights the tail (D, E, F) and underweights the head.
export const P = [0.38, 0.27, 0.17, 0.09, 0.06, 0.03];
const U = [0.02, 0.03, 0.05, 0.30, 0.25, 0.35];
const TV_PU = P.reduce((s, p, i) => s + Math.max(0, p - U[i]), 0); // 0.72
export const ALPHA_MIN = 0.3; // above 1 − TV(p, u)
export const CYCLES = 1000;
const WALK = 3; // cycles shown one operation at a time

export interface Dists { alpha: number; q: number[]; a: number[]; r: number[]; Z: number }

export function dists(alpha: number): Dists {
  const lam = (1 - alpha) / TV_PU;
  const q = P.map((p, i) => (1 - lam) * p + lam * U[i]);
  const a = P.map((p, i) => Math.min(1, p / q[i]));
  const pos = P.map((p, i) => Math.max(0, p - q[i]));
  const Z = pos.reduce((s, v) => s + v, 0);
  const r = Z > 1e-12 ? pos.map((v) => v / Z) : pos.map(() => 0);
  return { alpha, q, a, r, Z };
}

function sample(dist: number[], u: number): number {
  let acc = 0;
  let last = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] <= 0) continue;
    last = i;
    acc += dist[i];
    if (u < acc) return i;
  }
  return last;
}

export interface Cycle {
  x: number[]; // drafted tokens, positions 0..γ−1
  u: number[]; // acceptance draws
  kept: number; // accepted drafts (0..γ); position `kept` is the first rejection when kept < γ
  y: number; // correction (kept < γ) or bonus (kept = γ)
}

export type Phase = "propose" | "score" | "check" | "resolve" | "commit" | "full";
export interface Frame { c: number; ph: Phase; k: number }

export interface Run {
  d: Dists;
  gamma: number;
  cycles: Cycle[];
  // Cumulative counts: row i holds the totals over cycles 0..i−1.
  yCount: Int32Array; // (CYCLES + 1) × (γ + 1): cycles that emitted j + 1 tokens
  src: Int32Array; // (CYCLES + 1) × 3 × 6: emitted tokens by source (accepted, correction, bonus) and token
  frames: Frame[];
}

export function simulate(alpha: number, gamma: number, seed: number): Run {
  const d = dists(alpha);
  const u = rng(seed);
  const cycles: Cycle[] = [];
  const nY = gamma + 1;
  const V = TOKENS.length;
  const yCount = new Int32Array((CYCLES + 1) * nY);
  const src = new Int32Array((CYCLES + 1) * 3 * V);
  for (let c = 0; c < CYCLES; c++) {
    const x = Array.from({ length: gamma }, () => sample(d.q, u()));
    const ua = Array.from({ length: gamma }, () => u());
    const ur = u();
    let kept = 0;
    while (kept < gamma && ua[kept] < d.a[x[kept]]) kept++;
    const y = kept < gamma ? sample(d.r, ur) : sample(P, ur);
    cycles.push({ x, u: ua, kept, y });
    yCount.set(yCount.subarray(c * nY, (c + 1) * nY), (c + 1) * nY);
    src.set(src.subarray(c * 3 * V, (c + 1) * 3 * V), (c + 1) * 3 * V);
    yCount[(c + 1) * nY + kept]++;
    for (let k = 0; k < kept; k++) src[(c + 1) * 3 * V + x[k]]++;
    src[(c + 1) * 3 * V + (kept < gamma ? 1 : 2) * V + y]++;
  }
  const frames: Frame[] = [];
  for (let c = 0; c < WALK; c++) {
    frames.push({ c, ph: "propose", k: -1 }, { c, ph: "score", k: -1 });
    const last = Math.min(cycles[c].kept, gamma - 1);
    for (let k = 0; k <= last; k++) frames.push({ c, ph: "check", k });
    frames.push({ c, ph: "resolve", k: -1 }, { c, ph: "commit", k: -1 });
  }
  for (const [from, to, step] of STRIDES) for (let n = from; n <= to; n += step) frames.push({ c: n - 1, ph: "full", k: -1 });
  return { d, gamma, cycles, yCount, src, frames };
}

// Cycle numbers (1-based) shown as whole cycles after the walkthrough.
const STRIDES: Array<[number, number, number]> = [[WALK + 1, 20, 1], [25, 100, 5], [125, CYCLES, 25]];

const memo = new Map<string, Run>();
export function run(p: { alpha: number; gamma: number; seed: number }): Run {
  const alpha = Math.round(p.alpha * 100) / 100;
  const key = `${alpha}|${p.gamma}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(alpha, p.gamma, p.seed);
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// Cycles whose outcomes the histogram and the token panel include at a frame.
const doneAt = (f: Frame) => (f.ph === "commit" || f.ph === "full" ? f.c + 1 : f.c);

export function stats(R: Run, n: number) {
  const nY = R.gamma + 1;
  const V = TOKENS.length;
  const ys = Array.from(R.yCount.subarray(n * nY, (n + 1) * nY));
  const row = R.src.subarray(n * 3 * V, (n + 1) * 3 * V);
  const acc = Array.from(row.subarray(0, V));
  const cor = Array.from(row.subarray(V, 2 * V));
  const bon = Array.from(row.subarray(2 * V, 3 * V));
  const tokens = [...acc, ...cor, ...bon].reduce((s, v) => s + v, 0);
  const mean = n ? ys.reduce((s, v, j) => s + v * (j + 1), 0) / n : 0;
  const emp = P.map((_, v) => (tokens ? (acc[v] + cor[v] + bon[v]) / tokens : 0));
  const tv = tokens ? 0.5 * P.reduce((s, p, v) => s + Math.abs(emp[v] - p), 0) : 0;
  return { n, ys, acc, cor, bon, tokens, mean, tv };
}

// Expected share of cycles that emit j + 1 tokens, and E[Y].
export function expected(alpha: number, gamma: number) {
  const shares = Array.from({ length: gamma + 1 }, (_, j) => (j < gamma ? alpha ** j * (1 - alpha) : alpha ** gamma));
  const EY = alpha >= 1 ? gamma + 1 : (1 - alpha ** (gamma + 1)) / (1 - alpha);
  return { shares, EY };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Speculative sampling, one cycle at a time",
    cycle: "Cycle {c} of {n}",
    stPropose: "the draft proposes {g:token/tokens} in sequence",
    stScore: "one target pass gives p at every position",
    stCheck: "checking position {k}",
    stReject: "position {k} rejected, the rest discarded",
    stResolveC: "correction drawn from r",
    stResolveB: "all accepted, bonus drawn from p",
    stDone: "{k:accepted draft/accepted drafts}, {y:token/tokens} emitted",
    accDraft: "accepted draft",
    correction: "correction from r",
    bonus: "bonus from p",
    rowPos: "position",
    rowDraft: "draft x ~ q",
    rowDraft2: "in sequence",
    rowQ: "q(x)",
    rowP: "target p(x)",
    rowP2: "one pass",
    rowTest: "accept if u < a",
    rowTest2: "a = min(1, p/q)",
    rowResult: "result",
    rowOut: "emitted",
    bonusCol: "bonus",
    pAll: "p(·)",
    accept: "accept",
    reject: "reject",
    discard: "discarded",
    unused: "unused",
    colDraft: "draft",
    colQP: "q, p",
    colOut: "out",
    note: "Draft: {g:token/tokens}, one after another. Target: one pass scores all {n} positions.",
    kv: "Commit: target KV kept for {k:position/positions}, {d:position/positions} reclaimed; {t} is the next cycle's input.",
    kvWait: "Commit happens after the walk: KV is kept only for the accepted prefix.",
    hTitle: "Tokens emitted per cycle, Y",
    hObserved: "observed",
    hExpected: "expected",
    hX: "Y",
    hY: "share of cycles",
    hMean: "mean Y = {m} over {n:cycle/cycles}",
    hNone: "no cycle finished yet",
    hFormula: "E[Y] = (1 − α^(γ+1)) / (1 − α)",
    hTerms: "= (1 − {a}{g1}) / {z} = {e}",
    hOne: "α = 1: every draft is accepted, E[Y] = γ + 1 = {e}",
    tTitle: "Emitted tokens against p",
    tP: "p, target",
    tQ: "q, draft",
    tY: "share of emitted tokens",
    tZ: "Z = Σ[p − q]+ = 1 − α = {z}",
    tTv: "emitted vs p: TV = {tv} over {n:token/tokens}",
    tTvNone: "emitted vs p: no tokens yet",
    tQv: "draft tokens alone: TV(q, p) = {z}",
    kfPropose: "Cycle {c}: the draft proposes {g:token/tokens}, one after another, keeping q(x) for each",
    kfScore: "Cycle {c}: one target pass gives p at all {g} draft positions and the bonus position",
    kfAccept: "Cycle {c}, position {k}: u = {u} < a = {a}, accepted",
    kfReject: "Cycle {c}, position {k}: u = {u} ≥ a = {a}, rejected; later drafts are discarded",
    kfCorrect: "Cycle {c}: correction {t} drawn from the residual r",
    kfBonus: "Cycle {c}: all {g} accepted, bonus {t} drawn from p",
    kfCommit: "Cycle {c}: {y:token/tokens} emitted; target KV kept for {k}, {d} reclaimed",
    kfStride: "Cycles {a} to {b}: {s:cycle/cycles} per step",
    kfEnd: "Cycle {n}: mean Y = {m}, against E[Y] = {e}",
    describe: "Cycle {c} of {n}, α = {a}, γ = {g}: {state}. After {done:cycle/cycles} the mean is {m} tokens per cycle against E[Y] = {e}, and the emitted tokens differ from p by TV {tv}.",
  },
  zh: {
    title: "推测采样的逐轮过程",
    cycle: "第 {c} 轮（共 {n} 轮）",
    stPropose: "草稿模型逐个提出 {g} 个候选",
    stScore: "目标模型一次前向传播给出每个位置的 p",
    stCheck: "核验第 {k} 个位置",
    stReject: "第 {k} 个位置被拒绝，其后候选全部丢弃",
    stResolveC: "从 r 中采样修正词元",
    stResolveB: "全部接受，从 p 中采样奖励词元",
    stDone: "接受 {k} 个候选，输出 {y} 个词元",
    accDraft: "被接受的候选",
    correction: "修正词元（来自 r）",
    bonus: "奖励词元（来自 p）",
    rowPos: "位置",
    rowDraft: "候选 x ~ q",
    rowDraft2: "逐个生成",
    rowQ: "q(x)",
    rowP: "目标 p(x)",
    rowP2: "一次传播",
    rowTest: "u < a 即接受",
    rowTest2: "a = min(1, p/q)",
    rowResult: "结果",
    rowOut: "输出",
    bonusCol: "奖励",
    pAll: "p(·)",
    accept: "接受",
    reject: "拒绝",
    discard: "丢弃",
    unused: "未用",
    colDraft: "候选",
    colQP: "q, p",
    colOut: "输出",
    note: "草稿模型逐个生成 {g} 个候选；目标模型一次前向传播为全部 {n} 个位置打分。",
    kv: "提交：保留 {k} 个位置的目标 KV，回收 {d} 个；{t} 作为下一轮的输入。",
    kvWait: "核验结束后才提交：只保留已接受前缀的 KV。",
    hTitle: "每轮输出的词元数 Y",
    hObserved: "实测",
    hExpected: "期望",
    hX: "Y",
    hY: "轮数占比",
    hMean: "{n} 轮平均 Y = {m}",
    hNone: "还没有完成的轮次",
    hFormula: "E[Y] = (1 − α^(γ+1)) / (1 − α)",
    hTerms: "= (1 − {a}{g1}) / {z} = {e}",
    hOne: "α = 1：候选全部接受，E[Y] = γ + 1 = {e}",
    tTitle: "输出词元与目标分布 p 的对照",
    tP: "p，目标",
    tQ: "q，草稿",
    tY: "输出词元占比",
    tZ: "Z = Σ[p − q]+ = 1 − α = {z}",
    tTv: "输出与 p 的差距：TV = {tv}（{n} 个词元）",
    tTvNone: "输出与 p 的差距：尚无输出",
    tQv: "只用候选词元：TV(q, p) = {z}",
    kfPropose: "第 {c} 轮：草稿模型逐个提出 {g} 个候选，并记下每个的 q(x)",
    kfScore: "第 {c} 轮：目标模型一次前向传播，给出 {g} 个候选位置和奖励位置的 p",
    kfAccept: "第 {c} 轮第 {k} 个位置：u = {u} < a = {a}，接受",
    kfReject: "第 {c} 轮第 {k} 个位置：u = {u} ≥ a = {a}，拒绝，其后的候选全部丢弃",
    kfCorrect: "第 {c} 轮：从残差分布 r 中采样修正词元 {t}",
    kfBonus: "第 {c} 轮：{g} 个候选全部接受，从 p 中采样奖励词元 {t}",
    kfCommit: "第 {c} 轮：输出 {y} 个词元；保留 {k} 个位置的目标 KV，回收 {d} 个",
    kfStride: "第 {a} 到 {b} 轮：每步 {s} 轮",
    kfEnd: "第 {n} 轮：平均 Y = {m}，E[Y] = {e}",
    describe: "第 {c} 轮（共 {n} 轮），α = {a}，γ = {g}：{state}。{done} 轮的平均值为每轮 {m} 个词元，E[Y] = {e}；输出词元与 p 的 TV 距离为 {tv}。",
  },
};
type L = typeof labels.en;

type Params = { alpha: number; gamma: number; seed: number };

const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const f2 = (v: number) => fixed(v, 2);

// What the strip shows at a frame.
function view(f: Frame, cy: Cycle, gamma: number) {
  const scored = f.ph !== "propose";
  // Positions whose check is visible, and whether the tail is already discarded.
  const walked = f.ph === "check" ? f.k : f.ph === "propose" || f.ph === "score" ? -1 : Math.min(cy.kept, gamma - 1);
  const resolved = f.ph === "resolve" || f.ph === "commit" || f.ph === "full";
  const committed = f.ph === "commit" || f.ph === "full";
  return { scored, walked, resolved, committed };
}

function status(f: Frame, cy: Cycle, gamma: number, L: L): string {
  switch (f.ph) {
    case "propose": return tpl(L.stPropose, { g: gamma });
    case "score": return L.stScore;
    case "check": return f.k === cy.kept ? tpl(L.stReject, { k: f.k + 1 }) : tpl(L.stCheck, { k: f.k + 1 });
    case "resolve": return cy.kept < gamma ? L.stResolveC : L.stResolveB;
    default: return tpl(L.stDone, { k: cy.kept, y: cy.kept + 1 });
  }
}

// ---------------------------------------------------------------- drawing

const SOURCE_LEGEND = (L: L) => [
  { label: L.accDraft, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.8 } },
  { label: L.correction, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.8 } },
  { label: L.bonus, swatch: { kind: "rect" as const, fill: C.c3, opacity: 0.8 } },
];

type BoxKind = "plain" | "accept" | "reject" | "discard" | "src0" | "src1" | "src2" | "empty";
const SRC_COLOR = [C.c1, C.c2, C.c3];

function tokenBox(cx: number, cy: number, s: number, tok: string, kind: BoxKind): string {
  const x = cx - s / 2, y = cy - s / 2;
  const base = { x, y, width: s, height: s, rx: 4 };
  let box: string;
  let cls = "fig-t-strong";
  switch (kind) {
    case "plain": box = el("rect", { ...base, fill: C.paper, stroke: C.ink2, "stroke-width": 1.2 }); break;
    case "accept": box = el("rect", { ...base, fill: C.paper, stroke: C.good, "stroke-width": 2 }); break;
    case "reject": box = el("rect", { ...base, fill: C.paper, stroke: C.bad, "stroke-width": 2 }); break;
    case "discard": box = el("rect", { ...base, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 2" }); cls = "fig-t-faint"; break;
    case "empty": return el("rect", { ...base, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 2" });
    default: {
      const col = SRC_COLOR[Number(kind.slice(3))];
      box = el("rect", { ...base, fill: C.paper, stroke: col, "stroke-width": 2 }) + el("rect", { ...base, fill: col, "fill-opacity": 0.28 });
    }
  }
  return box + text(cx, cy + TYPE.label * 0.36, tok, { "font-size": TYPE.label, "text-anchor": "middle", class: cls });
}

// Acceptance test drawn as a unit track: the shaded part is [0, a), the tick is u.
function meter(x: number, y: number, w: number, a: number, u: number | null): string {
  const parts = [
    el("rect", { x, y, width: w, height: 10, rx: 2, fill: C.panel, stroke: C.rule, "stroke-width": 0.8 }),
    el("rect", { x, y, width: Math.max(0.5, a * w), height: 10, rx: 2, fill: C.c1, "fill-opacity": 0.35 }),
  ];
  if (u != null) {
    const ux = x + u * w;
    parts.push(el("line", { x1: ux, x2: ux, y1: y - 3, y2: y + 13, stroke: C.ink, "stroke-width": 2 }));
  }
  return parts.join("");
}

function statusMark(x: number, y: number, ok: boolean, label: string, anchor: "middle" | "start" = "middle"): string {
  const tw = textWidth(label, TYPE.body);
  const x0 = anchor === "middle" ? x - (tw + 12) / 2 : x;
  return el("circle", { cx: x0 + 4, cy: y - 4, r: 4, fill: ok ? C.good : C.bad })
    + text(x0 + 12, y, label, { "font-size": TYPE.body, class: "fig-t-strong" });
}

// The cycle strip in the desktop layout: one column per draft position plus
// the bonus position, one row per operation.
function stripWide(R: Run, f: Frame, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const gamma = R.gamma;
  const cy = R.cycles[f.c];
  const v = view(f, cy, gamma);
  const gut = 112;
  const n = gamma + 1;
  const cw = Math.min(92, (w - gut) / n);
  const cx = (k: number) => x0 + gut + cw * (k + 0.5);
  const parts: string[] = [];
  const bs = Math.min(30, cw - 12);
  const rows = { pos: y0 + 12, draft: y0 + 38, q: y0 + 74, p: y0 + 100, test: y0 + 124, result: y0 + 172, out: y0 + 204 };
  const gl = (y: number, a: string, b?: string) => {
    parts.push(text(x0, b ? y - 2 : y + 4, a, { "font-size": TYPE.body, class: "fig-t-muted" }));
    if (b) parts.push(text(x0, y + 12, b, { "font-size": TYPE.body, class: "fig-t-faint" }));
  };
  gl(rows.pos - 4, L.rowPos);
  gl(rows.draft, L.rowDraft, L.rowDraft2);
  gl(rows.q - 4, L.rowQ);
  gl(rows.p - 2, L.rowP, L.rowP2);
  gl(rows.test + 8, L.rowTest, L.rowTest2);
  gl(rows.result - 4, L.rowResult);
  gl(rows.out, L.rowOut);

  // The target pass: one band across every position, bonus included.
  if (v.scored) parts.push(el("rect", { x: cx(0) - cw / 2 + 2, y: rows.p - 13, width: cw * n - 4, height: 20, rx: 4, fill: C.panel }));
  for (let k = 0; k < n; k++) {
    const bonusCol = k === gamma;
    parts.push(text(cx(k), rows.pos, bonusCol ? L.bonusCol : String(k + 1), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
    if (bonusCol) {
      parts.push(tokenBox(cx(k), rows.draft, bs, "", "empty"));
      if (v.scored) parts.push(text(cx(k), rows.p + 2, L.pAll, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
      continue;
    }
    const x = cy.x[k];
    const checked = k <= v.walked;
    const discarded = v.walked >= 0 && v.walked >= cy.kept && k > cy.kept;
    const kind: BoxKind = discarded ? "discard" : !checked ? "plain" : k < cy.kept ? "accept" : "reject";
    parts.push(tokenBox(cx(k), rows.draft, bs, TOKENS[x], kind));
    if (k > 0) {
      const ax0 = cx(k - 1) + bs / 2 + 2, ax1 = cx(k) - bs / 2 - 2;
      if (ax1 - ax0 > 6) parts.push(el("line", { x1: ax0, x2: ax1 - 3, y1: rows.draft, y2: rows.draft, stroke: C.ink3, "stroke-width": 1.2 }),
        el("path", { d: `M${ax1},${rows.draft} l-5,-3.5 v7 z`, fill: C.ink3 }));
    }
    const faint = discarded ? "fig-t-faint fig-t-num" : "fig-t-num";
    parts.push(text(cx(k), rows.q, f2(R.d.q[x]), { "font-size": TYPE.body, "text-anchor": "middle", class: faint }));
    if (v.scored) parts.push(text(cx(k), rows.p + 2, f2(P[x]), { "font-size": TYPE.body, "text-anchor": "middle", class: faint }));
    if (v.scored && !discarded) {
      const mw = cw - 14;
      parts.push(meter(cx(k) - mw / 2, rows.test - 6, mw, R.d.a[x], checked ? cy.u[k] : null));
      parts.push(text(cx(k), rows.test + 20, `a ${f2(R.d.a[x])}`, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
      if (checked) parts.push(text(cx(k), rows.test + 34, `u ${f2(cy.u[k])}`, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num fig-t-strong" }));
    }
    if (checked && !discarded) parts.push(statusMark(cx(k), rows.result, k < cy.kept, k < cy.kept ? L.accept : L.reject));
  }
  // One label across the discarded tail, so narrow columns never overprint it.
  if (v.walked >= 0 && v.walked >= cy.kept && cy.kept < gamma - 1) {
    const xa = cx(cy.kept + 1) - cw / 2 + 6, xb = cx(gamma - 1) + cw / 2 - 6;
    const lw = textWidth(L.discard, TYPE.body);
    const mid = (xa + xb) / 2;
    if (xb - xa > lw + 24) {
      parts.push(el("line", { x1: xa, x2: mid - lw / 2 - 6, y1: rows.result - 4, y2: rows.result - 4, stroke: C.ink3, "stroke-width": 1 }),
        el("line", { x1: mid + lw / 2 + 6, x2: xb, y1: rows.result - 4, y2: rows.result - 4, stroke: C.ink3, "stroke-width": 1 }));
    }
    parts.push(text(mid, rows.result, L.discard, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-faint" }));
  }
  // Emitted tokens, aligned with the positions they occupy.
  if (v.resolved) {
    for (let k = 0; k < cy.kept; k++) parts.push(tokenBox(cx(k), rows.out, bs, TOKENS[cy.x[k]], "src0"));
    const at = cy.kept < gamma ? cy.kept : gamma;
    parts.push(tokenBox(cx(at), rows.out, bs, TOKENS[cy.y], cy.kept < gamma ? "src1" : "src2"));
    if (cy.kept < gamma) parts.push(text(cx(gamma), rows.result, L.unused, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-faint" }));
  }
  let y = rows.out + bs / 2 + 20;
  const line = v.committed
    ? tpl(L.kv, { k: cy.kept, d: gamma - cy.kept, t: TOKENS[cy.y] })
    : L.kvWait;
  for (const ln of wrap(line, TYPE.body, w)) {
    parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: v.committed ? "" : "fig-t-faint" }));
    y += 16;
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: y - y0 };
}

// The cycle strip in the phone layout: one row per position.
function stripNarrow(R: Run, f: Frame, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const gamma = R.gamma;
  const cy = R.cycles[f.c];
  const v = view(f, cy, gamma);
  const parts: string[] = [];
  let y = y0;
  for (const ln of wrap(tpl(L.note, { g: gamma, n: gamma + 1 }), TYPE.body, w)) {
    parts.push(text(x0, y + 12, ln, { "font-size": TYPE.body, class: "fig-t-muted" }));
    y += 16;
  }
  y += 8;
  // Columns: position, draft token, q and p, the acceptance test, result, emitted token.
  const col = { k: x0 + 12, box: x0 + 33, qp: x0 + 54, m: x0 + 108, mw: 0, res: x0 + w - 92, out: x0 + w - 14 };
  col.mw = col.res - 10 - col.m;
  parts.push(text(col.k, y + 10, "k", { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(col.box, y + 10, L.colDraft, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(col.qp, y + 10, L.colQP, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(col.m, y + 10, L.rowTest, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(col.out, y + 10, L.colOut, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  y += 18;
  const rowH = 38;
  const bs = 26;
  // Target pass: one band down the p column, bonus row included.
  if (v.scored) parts.push(el("rect", { x: col.qp - 4, y: y + 1, width: 50, height: rowH * (gamma + 1) - 2, rx: 4, fill: C.panel }));
  for (let k = 0; k <= gamma; k++) {
    const mid = y + rowH / 2;
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    if (k === gamma) {
      parts.push(text(col.k, mid + 4, "+1", { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
      parts.push(tokenBox(col.box, mid, bs, "", "empty"));
      if (v.scored) parts.push(text(col.qp, mid + 4, L.pAll, { "font-size": TYPE.body, class: "fig-t-num" }));
      if (v.resolved) {
        if (cy.kept === gamma) {
          parts.push(text(col.res, mid + 4, L.bonusCol, { "font-size": TYPE.body, class: "fig-t-strong" }));
          parts.push(tokenBox(col.out, mid, bs, TOKENS[cy.y], "src2"));
        } else parts.push(text(col.res, mid + 4, L.unused, { "font-size": TYPE.body, class: "fig-t-faint" }));
      }
      y += rowH;
      continue;
    }
    const x = cy.x[k];
    const checked = k <= v.walked;
    const discarded = v.walked >= 0 && v.walked >= cy.kept && k > cy.kept;
    const kind: BoxKind = discarded ? "discard" : !checked ? "plain" : k < cy.kept ? "accept" : "reject";
    parts.push(text(col.k, mid + 4, String(k + 1), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    parts.push(tokenBox(col.box, mid, bs, TOKENS[x], kind));
    const faint = discarded ? "fig-t-faint fig-t-num" : "fig-t-num";
    parts.push(text(col.qp, mid - 3, `q ${f2(R.d.q[x])}`, { "font-size": TYPE.body, class: faint }));
    if (v.scored) parts.push(text(col.qp, mid + 12, `p ${f2(P[x])}`, { "font-size": TYPE.body, class: faint }));
    if (v.scored && !discarded) {
      parts.push(meter(col.m, mid - 11, col.mw, R.d.a[x], checked ? cy.u[k] : null));
      parts.push(text(col.m, mid + 14, `a ${f2(R.d.a[x])}`, { "font-size": TYPE.body, class: "fig-t-num" }));
      if (checked) parts.push(text(col.m + col.mw, mid + 14, `u ${f2(cy.u[k])}`, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
    }
    if (checked && !discarded) parts.push(statusMark(col.res, mid + 4, k < cy.kept, k < cy.kept ? L.accept : L.reject, "start"));
    if (discarded) parts.push(text(col.res, mid + 4, L.discard, { "font-size": TYPE.body, class: "fig-t-faint" }));
    if (v.resolved && k < cy.kept) parts.push(tokenBox(col.out, mid, bs, TOKENS[x], "src0"));
    if (v.resolved && k === cy.kept) parts.push(tokenBox(col.out, mid, bs, TOKENS[cy.y], "src1"));
    y += rowH;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 18;
  const line = v.committed ? tpl(L.kv, { k: cy.kept, d: gamma - cy.kept, t: TOKENS[cy.y] }) : L.kvWait;
  for (const ln of wrap(line, TYPE.body, w)) {
    parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: v.committed ? "" : "fig-t-faint" }));
    y += 16;
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: y - y0 };
}

function pctTick(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function histogram(R: Run, n: number, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const gamma = R.gamma;
  const s = stats(R, n);
  const ex = expected(R.d.alpha, gamma);
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, L.hTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.hObserved, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.hExpected, swatch: { kind: "line", stroke: C.ink } },
  ], x0, y0 + 22, w, TYPE.body);
  parts.push(lg.svg);
  const top = y0 + 30 + lg.height + 14;
  const plotH = 116;
  const left = x0 + 40;
  const obs = s.ys.map((c) => (n ? c / n : 0));
  const ymax = Math.max(0.1, ...ex.shares, ...obs) * 1.08;
  const yS = linear([0, ymax], [top + plotH, top]);
  const nb = gamma + 1;
  const bw = (x0 + w - left) / nb;
  const ticks = yS.ticks(4);
  parts.push(axis({ scale: yS, orient: "left", at: left, ticks, grid: [left, x0 + w], format: pctTick, size: TYPE.body }));
  for (let j = 0; j < nb; j++) {
    const bx = left + j * bw + bw * 0.18;
    const bwid = bw * 0.64;
    if (obs[j] > 0) parts.push(el("rect", { x: bx, y: yS(obs[j]), width: bwid, height: top + plotH - yS(obs[j]), fill: C.c1, "fill-opacity": 0.8 }));
    parts.push(el("line", { x1: bx - 3, x2: bx + bwid + 3, y1: yS(ex.shares[j]), y2: yS(ex.shares[j]), stroke: C.ink, "stroke-width": 2 }));
    parts.push(text(left + (j + 0.5) * bw, top + plotH + 16, j + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(el("line", { x1: left, x2: x0 + w, y1: top + plotH, y2: top + plotH, stroke: C.rule, "stroke-width": 1 }));
  parts.push(text(left + (x0 + w - left) / 2, top + plotH + 32, L.hX, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  let y = top + plotH + 54;
  const lines: Array<[string, string]> = [];
  lines.push([n ? tpl(L.hMean, { m: f2(s.mean), n: int(n) }) : L.hNone, "fig-t-strong fig-t-num"]);
  if (R.d.alpha >= 1) lines.push([tpl(L.hOne, { e: gamma + 1 }), "fig-t-num"]);
  else {
    lines.push([L.hFormula, "fig-t-num"]);
    lines.push([tpl(L.hTerms, { a: f2(R.d.alpha), g1: SUP[gamma + 1], z: f2(1 - R.d.alpha), e: f2(ex.EY) }), "fig-t-num"]);
  }
  for (const [ln, cls] of lines) {
    for (const part of wrap(ln, TYPE.body, w)) {
      parts.push(text(x0, y, part, { "font-size": TYPE.body, class: cls }));
      y += 17;
    }
  }
  return { svg: g({ class: "fig-hist" }, ...parts), h: y - y0 - 4 };
}

// Emitted-token frequencies by source against p and q. The source colors are
// in the figure's legend; the phone layout repeats them, because the panel
// sits far below it.
function tokenPanel(R: Run, n: number, x0: number, y0: number, w: number, L: L, sources: boolean): { svg: string; h: number } {
  const s = stats(R, n);
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, L.tTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.tP, swatch: { kind: "line", stroke: C.ink } },
    { label: L.tQ, swatch: { kind: "line", stroke: C.ink2, dash: "3 2" } },
    ...(sources ? SOURCE_LEGEND(L) : []),
  ], x0, y0 + 22, w, TYPE.body);
  parts.push(lg.svg);
  const top = y0 + 30 + lg.height + 14;
  const plotH = 116;
  const left = x0 + 40;
  const shares = P.map((_, t) => (s.tokens ? (s.acc[t] + s.cor[t] + s.bon[t]) / s.tokens : 0));
  const ymax = Math.min(1, Math.max(...P, ...R.d.q, ...shares) * 1.12);
  const yS = linear([0, ymax], [top + plotH, top]);
  parts.push(axis({ scale: yS, orient: "left", at: left, ticks: yS.ticks(4), grid: [left, x0 + w], format: pctTick, size: TYPE.body }));
  const V = TOKENS.length;
  const bw = (x0 + w - left) / V;
  for (let t = 0; t < V; t++) {
    const bx = left + t * bw + bw * 0.2;
    const bwid = bw * 0.6;
    let acc = 0;
    for (const [i, cnt] of [s.acc[t], s.cor[t], s.bon[t]].entries()) {
      if (!s.tokens || !cnt) continue;
      const h0 = acc / s.tokens, h1 = (acc + cnt) / s.tokens;
      parts.push(el("rect", { x: bx, y: yS(h1), width: bwid, height: yS(h0) - yS(h1), fill: SRC_COLOR[i], "fill-opacity": 0.8 }));
      acc += cnt;
    }
    parts.push(el("line", { x1: bx - 3, x2: bx + bwid + 3, y1: yS(P[t]), y2: yS(P[t]), stroke: C.ink, "stroke-width": 2 }));
    parts.push(el("line", { x1: bx - 3, x2: bx + bwid + 3, y1: yS(R.d.q[t]), y2: yS(R.d.q[t]), stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
    parts.push(text(left + (t + 0.5) * bw, top + plotH + 16, TOKENS[t], { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  }
  parts.push(el("line", { x1: left, x2: x0 + w, y1: top + plotH, y2: top + plotH, stroke: C.rule, "stroke-width": 1 }));
  let y = top + plotH + 38;
  const z = f2(R.d.Z);
  const lines: Array<[string, string]> = [
    [s.tokens ? tpl(L.tTv, { tv: fixed(s.tv, 3), n: int(s.tokens) }) : L.tTvNone, "fig-t-strong fig-t-num"],
    [tpl(L.tZ, { z }), "fig-t-num"],
    [tpl(L.tQv, { z }), "fig-t-num"],
  ];
  for (const [ln, cls] of lines) {
    for (const part of wrap(ln, TYPE.body, w)) {
      parts.push(text(x0, y, part, { "font-size": TYPE.body, class: cls }));
      y += 17;
    }
  }
  return { svg: g({ class: "fig-tokens" }, ...parts), h: y - y0 - 4 };
}

// ---------------------------------------------------------------- figure

function frameAt(R: Run, t: number): Frame {
  return R.frames[Math.max(0, Math.min(R.frames.length - 1, Math.round(t)))];
}

function describe(st: State<Params>, lang: Lang): string {
  const L = labels[lang];
  const R = run(st.p);
  const f = frameAt(R, st.t);
  const cy = R.cycles[f.c];
  const n = doneAt(f);
  const s = stats(R, n);
  const ex = expected(R.d.alpha, R.gamma);
  return tpl(L.describe, {
    c: f.c + 1, n: int(CYCLES), a: f2(R.d.alpha), g: R.gamma, state: status(f, cy, R.gamma, L),
    done: n, m: f2(s.mean), e: f2(ex.EY), tv: fixed(s.tv, 3),
  });
}

function render(st: State<Params>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const R = run(st.p);
  const f = frameAt(R, st.t);
  const cy = R.cycles[f.c];
  const n = doneAt(f);
  const parts: string[] = [];

  // Header: which cycle, which operation.
  const head = tpl(L.cycle, { c: int(f.c + 1), n: int(CYCLES) });
  parts.push(text(0, 15, head, { "font-size": TYPE.title, class: "fig-t-strong fig-t-num" }));
  const st1 = status(f, cy, R.gamma, L);
  let y = 15;
  if (!narrow && textWidth(head, TYPE.title) + 16 + textWidth(st1, TYPE.body) <= w) {
    parts.push(text(textWidth(head, TYPE.title) + 16, 15, st1, { "font-size": TYPE.body, class: "fig-t-num" }));
  } else {
    for (const ln of wrap(st1, TYPE.body, w)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); }
  }
  const lg = legend(SOURCE_LEGEND(L), 0, y + 10, w, TYPE.body);
  parts.push(lg.svg);
  y += 10 + lg.height + 14;

  if (narrow) {
    const sp = stripNarrow(R, f, 0, y, w, L);
    parts.push(sp.svg); y += sp.h + 18;
    const h = histogram(R, n, 0, y, w, L);
    parts.push(h.svg); y += h.h + 22;
    const tk = tokenPanel(R, n, 0, y, w, L, true);
    parts.push(tk.svg); y += tk.h;
  } else {
    const sp = stripWide(R, f, 0, y, w, L);
    parts.push(sp.svg); y += sp.h + 20;
    const half = Math.floor((w - 28) / 2);
    const h = histogram(R, n, 0, y, half, L);
    const tk = tokenPanel(R, n, half + 28, y, w - half - 28, L, false);
    parts.push(h.svg, tk.svg);
    y += Math.max(h.h, tk.h);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

function keyframes(p: Params, lang: Lang) {
  const L = labels[lang];
  const R = run(p);
  const out: Array<{ t: number; label: string }> = [];
  R.frames.forEach((f, t) => {
    const cy = R.cycles[f.c];
    const c = f.c + 1;
    const g = R.gamma;
    switch (f.ph) {
      case "propose": out.push({ t, label: tpl(L.kfPropose, { c, g }) }); break;
      case "score": out.push({ t, label: tpl(L.kfScore, { c, g }) }); break;
      case "check": {
        const x = cy.x[f.k];
        const vars = { c, k: f.k + 1, u: f2(cy.u[f.k]), a: f2(R.d.a[x]) };
        out.push({ t, label: tpl(f.k < cy.kept ? L.kfAccept : L.kfReject, vars) });
        break;
      }
      case "resolve": out.push({ t, label: tpl(cy.kept < g ? L.kfCorrect : L.kfBonus, { c, g, t: TOKENS[cy.y] }) }); break;
      case "commit": out.push({ t, label: tpl(L.kfCommit, { c, y: cy.kept + 1, k: cy.kept, d: g - cy.kept }) }); break;
      default: {
        const stride = STRIDES.find(([a]) => a === c);
        if (stride) out.push({ t, label: tpl(L.kfStride, { a: int(stride[0]), b: int(stride[1]), s: stride[2] }) });
      }
    }
  });
  const last = R.frames.length - 1;
  out.push({ t: last, label: tpl(L.kfEnd, { n: int(CYCLES), m: f2(stats(R, CYCLES).mean), e: f2(expected(R.d.alpha, R.gamma).EY) }) });
  return out;
}

// Open on a whole cycle late in the run, where the histogram has converged,
// and on one that shows a rejection after at least one accepted draft.
function poster(p: Params): number {
  const R = run(p);
  let fallback = -1;
  for (let t = 0; t < R.frames.length; t++) {
    const f = R.frames[t];
    if (f.ph !== "full" || f.c + 1 < 300) continue;
    if (fallback < 0) fallback = t;
    const k = R.cycles[f.c].kept;
    if (k >= 1 && k < R.gamma) return t;
  }
  return fallback >= 0 ? fallback : R.frames.length - 1;
}

export default defineFigure({
  name: "speculative-sampling",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    alpha: {
      kind: "range", label: { en: "Acceptance rate α", zh: "接受率 α" }, min: ALPHA_MIN, max: 1, step: 0.05, default: 0.7,
      marks: [{ value: 1, label: { en: "q = p", zh: "q = p" } }],
    },
    gamma: { kind: "range", label: { en: "Draft length γ", zh: "候选长度 γ" }, unit: { en: "tokens", zh: "个词元" }, min: 1, max: 8, step: 1, default: 4 },
    seed: { kind: "range", label: { en: "Random seed", zh: "随机种子" }, min: 1, max: 999, step: 1, default: 18, control: false },
  },
  timeline: {
    rate: 2.5,
    discrete: true,
    duration: (p) => run(p).frames.length - 1,
    keyframes,
    poster,
  },
  render,
  describe,
});
