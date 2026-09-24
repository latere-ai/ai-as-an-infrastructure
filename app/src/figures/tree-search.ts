// Tree search over partial states guided by a noisy value estimate.
//
// The tree is seeded and binary, depth 5: 63 nodes, 32 leaves. Leaf outcomes
// come from a latent log-odds random walk: the root starts at logit 0.05, each
// child adds a normal step with standard deviation 1.5, and a leaf is a
// solution with the sigmoid of its log-odds. A tree is kept when it has one to
// three solution leaves (the next attempt of the same seed otherwise, capped;
// the cap is never reached for seeds 1 to 400). Solutions are rare and cluster
// under a few branches, as in a task where most partial states lead nowhere.
//
// The value of a state is the structured-search chapter's
//   v^ρ(s) = E[R(s_T) | s, ρ],
// with R = 1 for a solution leaf and ρ the uniform random continuation, so
// v*(s) is the fraction of solution leaves below s. The controller never sees
// v*. It sees
//   v̂(s) = v*(s) + ε(s),   ε(s) = σ z(s),
// with z(s) one standard normal draw per node and seed, so moving σ scales the
// same errors instead of redrawing them.
//
// A budget B counts generated nodes, the root included; every expansion
// generates both children and scores them. At one budget:
// - Beam search runs the widest beam w that fits the budget: level by level it
//   expands every retained state and keeps the w children with the highest v̂.
// - Best-first expands the waiting node with the highest v̂ at any depth until
//   the next expansion would exceed B.
// The final choice is either the generated leaf with the highest v̂, or an
// exact checker G(s) that accepts only solution leaves: best-first then stops
// at the first leaf that passes, and beam returns its highest-scored passing
// leaf. The side chart repeats the same search on seeds 1 to 400 at every
// budget, so the single tree is one draw from the curves beside it.
//
// All values are illustrative: the tree is synthetic and the evaluator's error
// is a normal draw, not a measured scorer.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { mathText } from "./lib/math-text.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- tree

export const BRANCH = 2;
export const DEPTH = 5;
export const NODES = 2 ** (DEPTH + 1) - 1; // 63
export const MIN_BUDGET = 1 + BRANCH * DEPTH; // one chain to a leaf: 11
export const SEEDS = 400;

export interface Tree {
  seed: number;
  depth: Int8Array; // node -> depth; nodes are numbered breadth-first, root 0
  ok: Uint8Array; // 1 for a solution leaf
  v: Float64Array; // v*(s): fraction of solution leaves below s
  z: Float64Array; // standard normal draw per node
  solutions: number;
}

export const parentOf = (i: number) => (i - 1) >> 1;
export const kidsOf = (i: number): [number, number] => [2 * i + 1, 2 * i + 2];
export const isLeaf = (i: number) => i >= NODES >> 1;

function normal(u: () => number): number {
  const a = Math.max(1e-12, u()), b = u();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

const treeMemo = new Map<number, Tree>();
export function tree(seed: number): Tree {
  const hit = treeMemo.get(seed);
  if (hit) return hit;
  const depth = new Int8Array(NODES);
  for (let i = 1; i < NODES; i++) depth[i] = depth[parentOf(i)] + 1;
  let ok = new Uint8Array(NODES);
  let solutions = 0;
  for (let attempt = 0; attempt < 64; attempt++) {
    const u = rng(seed * 7919 + attempt * 104729 + 1);
    const logit = new Float64Array(NODES);
    logit[0] = Math.log(0.05 / 0.95);
    for (let i = 1; i < NODES; i++) logit[i] = logit[parentOf(i)] + 1.5 * normal(u);
    ok = new Uint8Array(NODES);
    solutions = 0;
    for (let i = NODES >> 1; i < NODES; i++) if (u() < 1 / (1 + Math.exp(-logit[i]))) { ok[i] = 1; solutions++; }
    if (solutions >= 1 && solutions <= 3) break;
  }
  const v = new Float64Array(NODES);
  for (let i = NODES - 1; i >= 0; i--) {
    if (isLeaf(i)) v[i] = ok[i];
    else { const [a, b] = kidsOf(i); v[i] = (v[a] + v[b]) / 2; }
  }
  const uz = rng(seed * 31337 + 17);
  const z = new Float64Array(NODES);
  for (let i = 0; i < NODES; i++) z[i] = normal(uz);
  const t: Tree = { seed, depth, ok, v, z, solutions };
  if (treeMemo.size > 512) treeMemo.clear();
  treeMemo.set(seed, t);
  return t;
}

// ---------------------------------------------------------------- search

export type Policy = "beam" | "best";
export type Choice = "score" | "check";

// Generated nodes of a beam of width w run to full depth.
export function beamWork(w: number): number {
  let n = 1;
  for (let d = 1; d <= DEPTH; d++) n += BRANCH * Math.min(w, BRANCH ** (d - 1));
  return n;
}

// The widest beam whose full run fits the budget.
export function beamWidth(budget: number): number {
  let w = 1;
  while (w < 2 ** (DEPTH - 1) && beamWork(w + 1) <= budget) w++;
  return w;
}

export interface Decision {
  kind: "level" | "frontier" | "final";
  depth: number; // depth of the ranked candidates (level), or of the chosen node
  ranked: number[]; // candidates by v̂, highest first
  keep: number; // how many of ranked are kept or chosen
}

export interface Step {
  node: number; // expanded node (-1 for the final choice)
  decision: Decision | null; // the ranking this step acts on or ends with
}

export interface Run {
  policy: Policy;
  choice: Choice;
  width: number; // beam width at this budget (0 for best-first)
  steps: Step[]; // expansions, then the final choice
  generated: number;
  leaves: number[]; // generated leaves, in generation order
  returned: number; // chosen leaf, -1 if none
  coverage: boolean; // a solution leaf was generated
  lostAt: number; // step whose pruning removed the last branch holding a solution (-1: never)
  firstSolutionAt: number; // step that generated the first solution leaf (-1: never)
  status: Uint8Array[]; // status per node after step k (index 0 = before any step)
}

export const St = { None: 0, Waiting: 1, Expanded: 2, Pruned: 3, Leaf: 4 } as const;

const score = (t: Tree, sigma: number, i: number) => t.v[i] + sigma * t.z[i];
const byScore = (t: Tree, sigma: number) => (a: number, b: number) => score(t, sigma, b) - score(t, sigma, a) || a - b;

export function search(t: Tree, policy: Policy, budget: number, sigma: number, choice: Choice, snapshots = true): Run {
  const status: Uint8Array[] = [];
  const cur = new Uint8Array(NODES);
  cur[0] = St.Waiting;
  status.push(cur.slice());
  const steps: Step[] = [];
  const leaves: number[] = [];
  let generated = 1, lostAt = -1, firstSolutionAt = -1;
  const cmp = byScore(t, sigma);
  const holds = (i: number) => t.v[i] > 0;
  const generate = (node: number) => {
    for (const k of kidsOf(node)) {
      generated++;
      if (isLeaf(k)) {
        cur[k] = St.Leaf;
        leaves.push(k);
        if (t.ok[k] && firstSolutionAt < 0) firstSolutionAt = steps.length;
      } else cur[k] = St.Waiting;
    }
    cur[node] = St.Expanded;
  };
  let width = 0;
  if (policy === "beam") {
    width = beamWidth(budget);
    let frontier = [0];
    for (let d = 1; d <= DEPTH; d++) {
      const children: number[] = [];
      frontier.forEach((f, j) => {
        generate(f);
        children.push(...kidsOf(f));
        let decision: Decision | null = null;
        if (j === frontier.length - 1 && d < DEPTH) {
          const ranked = [...children].sort(cmp);
          const kept = ranked.slice(0, width);
          for (const r of ranked.slice(width)) cur[r] = St.Pruned;
          const before = frontier.some(holds);
          if (before && !kept.some(holds) && lostAt < 0) lostAt = steps.length;
          decision = { kind: "level", depth: d, ranked, keep: kept.length };
          frontier = kept;
        }
        steps.push({ node: f, decision });
        if (snapshots) status.push(cur.slice());
      });
    }
  } else {
    const waiting = [0];
    while (waiting.length && generated + BRANCH <= budget) {
      if (choice === "check" && firstSolutionAt >= 0) break;
      const ranked = [...waiting].sort(cmp);
      const node = ranked[0];
      waiting.splice(waiting.indexOf(node), 1);
      generate(node);
      for (const k of kidsOf(node)) if (!isLeaf(k)) waiting.push(k);
      steps.push({ node, decision: { kind: "frontier", depth: t.depth[node], ranked, keep: 1 } });
      if (snapshots) status.push(cur.slice());
    }
  }
  // Final choice among the generated leaves.
  const pool = choice === "check" ? leaves.filter((l) => t.ok[l]) : leaves;
  const ranked = [...pool].sort(cmp);
  const returned = ranked.length ? ranked[0] : -1;
  steps.push({ node: -1, decision: { kind: "final", depth: DEPTH, ranked: [...leaves].sort(cmp), keep: returned >= 0 ? 1 : 0 } });
  status.push(cur.slice());
  return {
    policy, choice, width, steps, generated, leaves, returned,
    coverage: firstSolutionAt >= 0, lostAt, firstSolutionAt, status,
  };
}

const runMemo = new Map<string, Run>();
export function runFor(p: { seed: number; policy: Policy; budget: number; noise: number; choice: Choice }): Run {
  const key = `${p.seed}|${p.policy}|${p.budget}|${p.noise}|${p.choice}`;
  let hit = runMemo.get(key);
  if (!hit) {
    hit = search(tree(p.seed), p.policy, p.budget, p.noise, p.choice);
    if (runMemo.size > 64) runMemo.clear();
    runMemo.set(key, hit);
  }
  return hit;
}

export const BUDGETS = Array.from({ length: (NODES - MIN_BUDGET) / 2 + 1 }, (_, i) => MIN_BUDGET + 2 * i);

// Share of seeds 1..SEEDS for which, at each budget, a solution leaf was
// generated (what an exact checker returns) and for which the top-scored leaf
// is a solution. A lean replay of search() for the "score" choice: beam once
// per distinct width, best-first once per tree to the full budget, recording
// the state after every expansion (the expansion order does not depend on the
// budget, only where it stops).
export interface Curves { budgets: number[]; coverage: number[]; scored: number[] }
const curveMemo = new Map<string, Curves>();
export function curves(policy: Policy, sigma: number): Curves {
  const key = `${policy}|${sigma}`;
  const hit = curveMemo.get(key);
  if (hit) return hit;
  const coverage = BUDGETS.map(() => 0), scored = BUDGETS.map(() => 0);
  const sc = new Float64Array(NODES);
  const widths = [...new Set(BUDGETS.map(beamWidth))];
  const leafCut = NODES >> 1;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t = tree(seed);
    for (let i = 0; i < NODES; i++) sc[i] = t.v[i] + sigma * t.z[i];
    const desc = (a: number, b: number) => sc[b] - sc[a] || a - b;
    if (policy === "beam") {
      const byWidth = new Map<number, [boolean, boolean]>();
      for (const w of widths) {
        let frontier = [0];
        for (let d = 1; d < DEPTH; d++) {
          const ch: number[] = [];
          for (const f of frontier) ch.push(2 * f + 1, 2 * f + 2);
          frontier = ch.sort(desc).slice(0, w);
        }
        let cov = false, top = -1;
        for (const f of frontier) for (const l of [2 * f + 1, 2 * f + 2]) {
          if (t.ok[l]) cov = true;
          if (top < 0 || desc(l, top) < 0) top = l;
        }
        byWidth.set(w, [cov, t.ok[top] === 1]);
      }
      BUDGETS.forEach((B, i) => { const [c, o] = byWidth.get(beamWidth(B))!; if (c) coverage[i]++; if (o) scored[i]++; });
    } else {
      // State after k expansions: whether a solution leaf exists and whether
      // the top-scored generated leaf is one.
      const cov: boolean[] = [false], ok: boolean[] = [false];
      const waiting = [0];
      let c = false, top = -1;
      while (waiting.length) {
        let bi = 0;
        for (let j = 1; j < waiting.length; j++) if (desc(waiting[j], waiting[bi]) < 0) bi = j;
        const node = waiting[bi];
        waiting[bi] = waiting[waiting.length - 1];
        waiting.pop();
        for (const k of [2 * node + 1, 2 * node + 2]) {
          if (k >= leafCut) { if (t.ok[k]) c = true; if (top < 0 || desc(k, top) < 0) top = k; }
          else waiting.push(k);
        }
        cov.push(c);
        ok.push(top >= 0 && t.ok[top] === 1);
      }
      BUDGETS.forEach((B, i) => { const k = Math.min((B - 1) / BRANCH, cov.length - 1); if (cov[k]) coverage[i]++; if (ok[k]) scored[i]++; });
    }
  }
  const out = { budgets: BUDGETS, coverage: coverage.map((c) => c / SEEDS), scored: scored.map((c) => c / SEEDS) };
  if (curveMemo.size > 32) curveMemo.clear();
  curveMemo.set(key, out);
  return out;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Tree search with a noisy value estimate",
    status: "{head}: {g} of 63 nodes generated, {c} of {n} solution leaves among them",
    statusStart: "{head}: only the root is generated",
    headBeam: "Beam width {w}",
    headBest: "Best-first",
    width: "beam width {w}",
    expanded: "expanded or scored",
    waiting: "waiting",
    pruned: "pruned",
    solutionPath: "path to a solution leaf (hidden from the search)",
    returned: "returned",
    decisionLevel: "Depth {d}: {m} children ranked by v̂, the top {k} kept",
    decisionFrontier: "{m} waiting nodes ranked by v̂, the top one expanded",
    decisionFinal: "Final choice: {m} leaves ranked by v̂",
    decisionCheck: "Final choice: the exact checker passes {k} of {m} leaves",
    decisionNone: "No decision yet: the root is expanded first",
    decisionEmpty: "No leaf was generated within the budget",
    cut: "keep {k}",
    cutTop: "expand the top one",
    trueValue: "true value v*",
    observed: "observed v̂ = v* + ε",
    holds: "holds a solution",
    more: "{k} more not shown",
    axisV: "value",
    eqTop: "rank 1",
    eqBest: "best holding a solution, rank {r}",
    eqNone: "no candidate here holds a solution",
    chartTitle: "Same search on 400 seeded trees at σ = {s}",
    chartX: "budget B (generated nodes)",
    chartY: "share of trees",
    coverage: "solution generated (exact checker)",
    scored: "top-scored leaf is a solution",
    gap: "higher-scored mistake returned",
    here: "This tree at B = {B}: the search {out}.",
    outSolution: "returns a solution leaf, score {a}",
    outMistakeCovered: "returns a mistake scored {a}, above the generated solution's {b}",
    outMistake: "returns a mistake scored {a}; no solution leaf was generated",
    outAbstain: "abstains: no generated leaf passes the checker",
    outNoLeaf: "reaches no leaf within the budget",
    kfLevel: "Depth {d}: keeps {k} of {m}",
    kfLost: "Depth {d}: the last branch holding a solution scores {a} and is pruned",
    kfFirstLeaf: "The first leaf is generated",
    kfSolution: "A solution leaf is generated",
    beam: "Beam search",
    best: "Best-first search",
    describe: "{policy} at budget {B}{width}, evaluator error σ = {s}. Step {t} of {d}: {g} of 63 nodes generated, {c} of {n} solution leaves among them. {out}",
    sentence: "The search {out}.",
    describeLost: "At depth {d} the last branch holding a solution was pruned.",
  },
  zh: {
    title: "带噪声价值估计的树搜索",
    status: "{head}：已生成 63 个节点中的 {g} 个，{n} 个解叶节点中有 {c} 个在内",
    statusStart: "{head}：只生成了根节点",
    headBeam: "束宽 {w}",
    headBest: "最佳优先",
    width: "束宽 {w}",
    expanded: "已扩展或已评分",
    waiting: "等待扩展",
    pruned: "已剪枝",
    solutionPath: "通向解叶节点的路径（搜索看不到）",
    returned: "返回",
    decisionLevel: "深度 {d}：{m} 个子节点按 v̂ 排序，保留前 {k} 个",
    decisionFrontier: "{m} 个等待节点按 v̂ 排序，扩展最高的一个",
    decisionFinal: "最终选择：{m} 个叶节点按 v̂ 排序",
    decisionCheck: "最终选择：精确检查器通过 {m} 个叶节点中的 {k} 个",
    decisionNone: "尚无决策：先扩展根节点",
    decisionEmpty: "预算内没有生成任何叶节点",
    cut: "保留 {k}",
    cutTop: "扩展第一个",
    trueValue: "真实价值 v*",
    observed: "观测值 v̂ = v* + ε",
    holds: "下方有解",
    more: "另有 {k} 个未显示",
    axisV: "价值",
    eqTop: "排第 1",
    eqBest: "下方有解的最佳候选，排第 {r}",
    eqNone: "这里没有候选的下方有解",
    chartTitle: "同一搜索在 400 棵种子树上的结果，σ = {s}",
    chartX: "预算 B（生成节点数）",
    chartY: "树的比例",
    coverage: "生成了解（精确检查器）",
    scored: "得分最高的叶节点是解",
    gap: "返回了得分更高的错误",
    here: "这棵树在 B = {B} 时：搜索{out}。",
    outSolution: "返回一个解叶节点，得分 {a}",
    outMistakeCovered: "返回一个得分 {a} 的错误，高于已生成的解的 {b}",
    outMistake: "返回一个得分 {a} 的错误；没有生成任何解叶节点",
    outAbstain: "弃答：没有已生成的叶节点通过检查器",
    outNoLeaf: "在预算内没有到达任何叶节点",
    kfLevel: "深度 {d}：{m} 个中保留 {k} 个",
    kfLost: "深度 {d}：最后一个下方有解的分支得分 {a}，被剪掉",
    kfFirstLeaf: "生成第一个叶节点",
    kfSolution: "生成一个解叶节点",
    beam: "束搜索",
    best: "最佳优先搜索",
    describe: "{policy}，预算 {B}{width}，评估器误差 σ = {s}。第 {t} 步（共 {d} 步）：已生成 63 个节点中的 {g} 个，{n} 个解叶节点中有 {c} 个在内。{out}",
    sentence: "搜索{out}。",
    describeLost: "在深度 {d}，最后一个下方有解的分支被剪掉。",
  },
};

type L = typeof labels.en;
type P = { policy: Policy; budget: number; noise: number; choice: Choice; seed: number };

const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const val = (v: number) => fixed(v, 2);

function wrapText(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w) : wrapLatin(s, size, w);
}
function wrapLatin(s: string, size: number, w: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > w) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// The decision shown at timeline position t: the ranking the latest step acted
// on (beam steps inside a level show the ranking that retained their node).
function decisionAt(run: Run, t: number): Decision | null {
  for (let k = Math.min(t, run.steps.length) - 1; k >= 0; k--) if (run.steps[k].decision) return run.steps[k].decision;
  return null;
}

function counts(run: Run, tr: Tree, t: number) {
  const s = run.status[Math.min(t, run.status.length - 1)];
  let g = 0, c = 0;
  for (let i = 0; i < NODES; i++) if (s[i] !== St.None) { g++; if (tr.ok[i]) c++; }
  return { g, c };
}

function outcome(run: Run, tr: Tree, sigma: number, L: L): string {
  if (run.returned < 0) return run.choice === "check" && run.leaves.length ? L.outAbstain : L.outNoLeaf;
  const a = val(score(tr, sigma, run.returned));
  if (tr.ok[run.returned]) return tpl(L.outSolution, { a });
  if (run.coverage) {
    const best = run.leaves.filter((l) => tr.ok[l]).sort(byScore(tr, sigma))[0];
    return tpl(L.outMistakeCovered, { a, b: val(score(tr, sigma, best)) });
  }
  return tpl(L.outMistake, { a });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const run = runFor(p);
  const tr = tree(p.seed);
  const t = Math.round(st.t);
  const d = run.steps.length;
  const { g, c } = counts(run, tr, t);
  let out = t >= d ? tpl(L.sentence, { out: outcome(run, tr, p.noise, L) }) : "";
  if (run.lostAt >= 0 && t > run.lostAt) out = `${tpl(L.describeLost, { d: run.steps[run.lostAt].decision!.depth })} ${out}`.trim();
  return tpl(L.describe, {
    policy: p.policy === "beam" ? L.beam : L.best, B: p.budget,
    width: p.policy === "beam" ? (lang === "zh" ? `，${tpl(L.width, { w: run.width })}` : ` (${tpl(L.width, { w: run.width })})`) : "",
    s: fixed(p.noise, 2), t, d, g, c, n: tr.solutions, out,
  }).trim();
}

// A wrapping legend with circle swatches, hollow for the true value.
function dotLegend(items: Array<{ label: string; hollow: boolean; fill: string }>, x0: number, y0: number, w: number, size: number): { svg: string; height: number } {
  const parts: string[] = [];
  const rowH = size + 8;
  let x = x0, row = 0;
  for (const it of items) {
    const iw = 14 + textWidth(it.label, size);
    if (x > x0 && x + iw > x0 + w) { row++; x = x0; }
    const cy = y0 + row * rowH + size / 2 + 1;
    parts.push(it.hollow
      ? el("circle", { cx: x + 4.5, cy, r: 4, fill: C.paper, stroke: it.fill, "stroke-width": 1.3 })
      : el("circle", { cx: x + 4.5, cy, r: 4.5, fill: it.fill }));
    parts.push(mathText(x + 14, y0 + row * rowH + size, it.label, { "font-size": size, fill: C.ink2 }));
    x += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), height: (row + 1) * rowH };
}

// ---- tree panel

function renderTree(p: P, run: Run, tr: Tree, t: number, x0: number, y0: number, w: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const s = run.status[Math.min(t, run.status.length - 1)];
  const levelH = narrow ? 30 : 34;
  const rI = narrow ? 4.2 : 6;
  const rL = narrow ? 3.3 : 5;
  const top = y0 + rI + 2;
  const leafW = w / 2 ** DEPTH;
  const X = new Float64Array(NODES), Y = new Float64Array(NODES);
  for (let i = NODES - 1; i >= 0; i--) {
    Y[i] = top + tr.depth[i] * levelH;
    if (isLeaf(i)) X[i] = x0 + (i - (NODES >> 1) + 0.5) * leafW;
    else { const [a, b] = kidsOf(i); X[i] = (X[a] + X[b]) / 2; }
  }
  const final = t >= run.steps.length;
  const dec = decisionAt(run, t);
  const inDecision = new Set(dec ? dec.ranked : []);
  const current = t > 0 && t <= run.steps.length ? run.steps[t - 1].node : -1;

  // Paths to solution leaves, under everything: the truth the search cannot see.
  for (let i = 1; i < NODES; i++) {
    if (tr.v[i] <= 0) continue;
    parts.push(el("line", { x1: X[parentOf(i)], y1: Y[parentOf(i)], x2: X[i], y2: Y[i], stroke: C.good, "stroke-width": narrow ? 4.5 : 6, "stroke-opacity": 0.42, "stroke-linecap": "round" }));
  }
  // Edges: the full tree faint, generated edges on top.
  for (let i = 1; i < NODES; i++) {
    const q = parentOf(i);
    const gen = s[i] !== St.None;
    const kept = gen && s[i] !== St.Pruned;
    parts.push(el("line", {
      x1: X[q], y1: Y[q], x2: X[i], y2: Y[i],
      stroke: gen ? (kept ? C.c1 : C.ink3) : C.grid,
      "stroke-width": gen ? (kept ? 1.5 : 1) : 0.8,
      "stroke-dasharray": gen && !kept ? "3 2" : undefined,
    }));
  }
  // Nodes.
  for (let i = 0; i < NODES; i++) {
    const r = isLeaf(i) ? rL : rI;
    const st = s[i];
    if (st === St.None) { parts.push(el("circle", { cx: X[i], cy: Y[i], r: narrow ? 1.6 : 2, fill: C.ink3, "fill-opacity": 0.5 })); continue; }
    if (inDecision.has(i) && !final) parts.push(el("circle", { cx: X[i], cy: Y[i], r: r + 2.5, fill: "none", stroke: C.ink2, "stroke-width": 1 }));
    if (st === St.Expanded || st === St.Leaf) parts.push(el("circle", { cx: X[i], cy: Y[i], r, fill: C.c1 }));
    else if (st === St.Waiting) parts.push(el("circle", { cx: X[i], cy: Y[i], r: r - 0.6, fill: C.paper, stroke: C.c1, "stroke-width": 1.6 }));
    else parts.push(el("circle", { cx: X[i], cy: Y[i], r: r - 0.6, fill: C.paper, stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "2 1.5" }));
    if (i === current) parts.push(el("circle", { cx: X[i], cy: Y[i], r: r + 2.5, fill: "none", stroke: C.ink, "stroke-width": 2 }));
  }
  // Solution leaves, marked below the leaf row.
  const leafY = top + DEPTH * levelH;
  const markY = leafY + rL + (narrow ? 4 : 5);
  for (let i = NODES >> 1; i < NODES; i++) {
    if (!tr.ok[i]) continue;
    const m = narrow ? 3.6 : 4.5;
    parts.push(el("path", { d: `M${X[i]},${markY}L${X[i] + m},${markY + m * 1.5}L${X[i] - m},${markY + m * 1.5}Z`, fill: C.good }));
  }
  let h = markY + (narrow ? 6 : 7) - y0;
  // The returned leaf.
  if (final && run.returned >= 0) {
    const i = run.returned;
    parts.push(el("circle", { cx: X[i], cy: Y[i], r: rL + 4, fill: "none", stroke: C.ink, "stroke-width": 2 }));
    const label = L.returned;
    const size = TYPE.body;
    const lw = textWidth(label, size);
    const lx = Math.min(Math.max(X[i], x0 + lw / 2), x0 + w - lw / 2);
    parts.push(text(lx, markY + (narrow ? 6 : 7) + size + 2, label, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong" }));
    h += size + 6;
  }
  return { svg: g({ class: "fig-tree" }, ...parts), h };
}

// ---- decision strip: the ranking the latest step acted on, with v* and v̂

function renderDecision(p: P, run: Run, tr: Tree, t: number, x0: number, y0: number, w: number, narrow: boolean, lang: Lang, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const dec = decisionAt(run, t);
  const final = t >= run.steps.length;
  let y = y0;
  let title: string;
  if (!dec) title = L.decisionNone;
  else if (dec.kind === "level") title = tpl(L.decisionLevel, { d: dec.depth, m: dec.ranked.length, k: dec.keep });
  else if (dec.kind === "frontier") title = tpl(L.decisionFrontier, { m: dec.ranked.length });
  else if (!dec.ranked.length) title = L.decisionEmpty;
  else if (p.choice === "check") title = tpl(L.decisionCheck, { k: dec.ranked.filter((l) => tr.ok[l]).length, m: dec.ranked.length });
  else title = tpl(L.decisionFinal, { m: dec.ranked.length });
  for (const line of wrapText(title, TYPE.label, w, lang)) { y += TYPE.label + 3; parts.push(mathText(x0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const lg = dotLegend([
    { label: L.trueValue, hollow: true, fill: C.ink2 },
    { label: L.observed, hollow: false, fill: C.ink3 },
    { label: L.holds, hollow: false, fill: C.good },
  ], x0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 4;
  if (!dec || !dec.ranked.length) return { svg: g({ class: "fig-decision" }, ...parts), h: y - y0 };

  // Rows: the top of the ranking, and the best candidate holding a solution
  // if it ranks below the shown rows.
  const cap = narrow ? 7 : 8;
  const ranked = dec.ranked;
  const holdsIdx = ranked.findIndex((i) => tr.v[i] > 0);
  let shown = ranked.slice(0, Math.min(cap, ranked.length)).map((node, rank) => ({ node, rank }));
  const hidden = holdsIdx >= cap;
  if (hidden) shown = [...shown.slice(0, cap - 1), { node: ranked[holdsIdx], rank: holdsIdx }];
  const rankW = narrow ? 22 : 26;
  const x = linear([-1, 2], [x0 + rankW + 6, x0 + w - 6]);
  const rowH = 17;
  const plotTop = y + 4;
  const plotH = shown.length * rowH + (hidden ? 10 : 0);
  // Gridlines at 0 and 1 (v* bounds) and the axis below the rows.
  parts.push(axis({ scale: x, orient: "bottom", at: plotTop + plotH + 4, ticks: [-1, -0.5, 0, 0.5, 1, 1.5, 2], grid: [plotTop - 2, plotTop + plotH + 4], title: L.axisV, size, format: (v) => (v < 0 ? "−" : "") + String(Math.abs(v)) }));
  const keep = dec.kind === "final" ? (p.choice === "check" ? 0 : 1) : dec.keep;
  shown.forEach((row, j) => {
    const yy = plotTop + j * rowH + rowH / 2 + (hidden && j === shown.length - 1 ? 10 : 0);
    const i = row.node;
    const vs = tr.v[i], vh = score(tr, p.noise, i);
    const cx = (v: number) => x(Math.min(2, Math.max(-1, v)));
    const kept = dec.kind === "final" ? (p.choice === "check" ? tr.ok[i] === 1 && i === run.returned : row.rank === 0) : row.rank < keep;
    parts.push(text(x0 + rankW, yy + 4, String(row.rank + 1), { "font-size": size, "text-anchor": "end", class: kept ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    parts.push(el("line", { x1: cx(vs), x2: cx(vh), y1: yy, y2: yy, stroke: C.ink3, "stroke-width": 1.2 }));
    parts.push(el("circle", { cx: cx(vs), cy: yy, r: 4, fill: C.paper, stroke: C.ink2, "stroke-width": 1.3 }));
    parts.push(el("circle", { cx: cx(vh), cy: yy, r: 4.5, fill: vs > 0 ? C.good : C.ink3 }));
    if (kept) parts.push(el("circle", { cx: cx(vh), cy: yy, r: 7, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
  });
  // The cut between kept and pruned rows (beam levels and the frontier).
  if (dec.kind !== "final" && keep < shown.length) {
    const yc = plotTop + keep * rowH;
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: yc, y2: yc, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "5 3" }));
    const cl = dec.kind === "frontier" ? L.cutTop : tpl(L.cut, { k: keep });
    parts.push(text(x0 + w, yc - 3, cl, { "font-size": size, "text-anchor": "end", class: "fig-t-halo fig-t-muted" }));
  }
  if (hidden) {
    const yg = plotTop + (shown.length - 1) * rowH + 5;
    parts.push(text(x0 + rankW, yg + 2, "⋮", { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  }
  y = plotTop + plotH + 4 + axisHeight(true, size) + 6;
  // The chapter's v̂ = v* + ε for the top candidate and for the best candidate
  // holding a solution, in three right-aligned columns.
  const colW = narrow ? 50 : 46;
  const cE = x0 + w, cS = cE - colW - 12, cH = cS - colW - 12;
  const rows: Array<[string, number]> = [[L.eqTop, ranked[0]]];
  if (holdsIdx > 0) rows.push([tpl(L.eqBest, { r: holdsIdx + 1 }), ranked[holdsIdx]]);
  y += size + 6;
  parts.push(mathText(cH, y, "v̂", { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(cH + 6, y, "=", { "font-size": size, class: "fig-t-muted" }));
  parts.push(text(cS, y, "v*", { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(cS + 6, y, "+", { "font-size": size, class: "fig-t-muted" }));
  parts.push(text(cE, y, "ε", { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  const labelW = cH - colW - x0 - 8;
  for (const [name, i] of rows) {
    const lines = narrow ? [name] : wrapText(name, size, labelW, lang);
    if (narrow) { y += size + 6; parts.push(text(x0, y, name, { "font-size": size })); }
    y += size + 6;
    if (!narrow) lines.forEach((ln, k) => parts.push(text(x0, y + k * (size + 3), ln, { "font-size": size })));
    parts.push(text(cH, y, val(score(tr, p.noise, i)), { "font-size": size, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
    parts.push(text(cS, y, val(tr.v[i]), { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(cE, y, signed(p.noise * tr.z[i]), { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
    y += (lines.length - 1) * (size + 3);
  }
  if (holdsIdx < 0) { y += size + 8; parts.push(text(x0, y, L.eqNone, { "font-size": size, class: "fig-t-muted" })); }
  void final;
  return { svg: g({ class: "fig-decision" }, ...parts), h: y - y0 + 4 };
}

// ---- aggregate chart

function renderChart(p: P, run: Run, tr: Tree, x0: number, y0: number, w: number, narrow: boolean, lang: Lang, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const cv = curves(p.policy, p.noise);
  let y = y0;
  for (const line of wrapText(tpl(L.chartTitle, { s: fixed(p.noise, 2) }), TYPE.label, w, lang)) { y += TYPE.label + 3; parts.push(text(x0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const lg = legend([
    { label: L.coverage, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.scored, swatch: { kind: "line", stroke: C.c2 } },
    { label: L.gap, swatch: { kind: "rect", fill: C.c2, opacity: 0.22 } },
  ], x0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 26;
  const left = x0 + (narrow ? 38 : 40);
  const plotH = narrow ? 150 : 160;
  const xs = linear([MIN_BUDGET, NODES], [left, x0 + w - 8]);
  const ys = linear([0, 1], [y + plotH, y]);
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, x0 + w - 8], title: L.chartY, size, format: (v) => pct(v) }));
  parts.push(axis({ scale: xs, orient: "bottom", at: y + plotH, ticks: [11, 19, 31, 47, 63], title: L.chartX, size, format: (v) => String(v) }));
  const pc = cv.budgets.map((B, i) => [xs(B), ys(cv.coverage[i])] as [number, number]);
  const ps = cv.budgets.map((B, i) => [xs(B), ys(cv.scored[i])] as [number, number]);
  parts.push(el("path", { d: linePath([...pc, ...[...ps].reverse()]) + "Z", fill: C.c2, "fill-opacity": 0.22 }));
  parts.push(el("path", { d: linePath(pc), fill: "none", stroke: C.c1, "stroke-width": 2, "stroke-linejoin": "round" }));
  parts.push(el("path", { d: linePath(ps), fill: "none", stroke: C.c2, "stroke-width": 2, "stroke-linejoin": "round" }));
  // The reader's budget and the curve of the chosen final choice.
  const bi = cv.budgets.indexOf(p.budget);
  const xb = xs(p.budget);
  parts.push(el("line", { x1: xb, x2: xb, y1: y, y2: y + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const vy = p.choice === "check" ? cv.coverage[bi] : cv.scored[bi];
  parts.push(el("circle", { cx: xb, cy: ys(vy), r: 5, fill: p.choice === "check" ? C.c1 : C.c2, stroke: C.paper, "stroke-width": 2 }));
  const lab = `${pct(vy)}`;
  const lx = xb + 8 + textWidth(lab, size) > x0 + w - 8 ? xb - 8 : xb + 8;
  parts.push(text(lx, ys(vy) + (vy > 0.85 ? 16 : -8), lab, { "font-size": size, "text-anchor": lx < xb ? "end" : "start", class: "fig-t-strong fig-t-num fig-t-halo" }));
  y += plotH + axisHeight(true, size);
  // This tree's outcome at the same budget.
  const out = tpl(L.here, { B: p.budget, out: outcome(run, tr, p.noise, L) });
  for (const line of wrapText(out, size, w, lang)) { y += size + 4; parts.push(text(x0, y, line, { "font-size": size, class: "fig-t-muted" })); }
  void tr;
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const run = runFor(p);
  const tr = tree(p.seed);
  const t = Math.round(st.t);
  const d = run.steps.length;
  const parts: string[] = [];
  const size = TYPE.body;
  let y = 0;
  const { g: gen, c } = counts(run, tr, t);
  const hd = p.policy === "beam" ? tpl(L.headBeam, { w: run.width }) : L.headBest;
  const head = t === 0 ? tpl(L.statusStart, { head: hd }) : tpl(L.status, { head: hd, g: gen, c, n: tr.solutions });
  for (const line of wrapText(head, TYPE.label, w, lang)) { y += TYPE.label + 3; parts.push(text(0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const lg = legend([
    { label: L.expanded, swatch: { kind: "dot", fill: C.c1 } },
    { label: L.waiting, swatch: { kind: "rect", fill: C.paper, stroke: C.c1 } },
    { label: L.pruned, swatch: { kind: "rect", fill: C.paper, stroke: C.ink3, dash: "2 1.5" } },
    { label: L.solutionPath, swatch: { kind: "line", stroke: C.good } },
  ], 0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 8;
  const tp = renderTree(p, run, tr, t, 0, y, w, narrow, L);
  parts.push(tp.svg);
  y += tp.h + 18;
  if (narrow) {
    const dp = renderDecision(p, run, tr, t, 0, y, w, narrow, lang, L);
    parts.push(dp.svg); y += dp.h + 20;
    const cp = renderChart(p, run, tr, 0, y, w, narrow, lang, L);
    parts.push(cp.svg); y += cp.h;
  } else {
    const colW = Math.floor((w - 32) / 2);
    const dp = renderDecision(p, run, tr, t, 0, y, colW, narrow, lang, L);
    const cp = renderChart(p, run, tr, colW + 32, y, w - colW - 32, narrow, lang, L);
    parts.push(dp.svg, cp.svg);
    y += Math.max(dp.h, cp.h);
  }
  void size;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "tree-search",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    policy: {
      kind: "choice", label: { en: "Frontier policy", zh: "前沿策略" }, default: "beam",
      options: [
        { value: "beam", label: { en: "Beam search", zh: "束搜索" } },
        { value: "best", label: { en: "Best-first", zh: "最佳优先" } },
      ],
    },
    budget: {
      kind: "range", label: { en: "Budget B", zh: "预算 B" }, unit: { en: "generated nodes", zh: "个生成节点" },
      min: MIN_BUDGET, max: NODES, step: 2, default: 19,
      marks: [{ value: MIN_BUDGET, label: { en: "one chain", zh: "单链" } }, { value: NODES, label: { en: "full tree", zh: "完整树" } }],
    },
    noise: {
      kind: "range", label: { en: "Evaluator error σ", zh: "评估器误差 σ" }, min: 0, max: 0.6, step: 0.05, default: 0.4,
      marks: [{ value: 0, label: { en: "exact value", zh: "精确价值" } }],
    },
    choice: {
      kind: "choice", label: { en: "Final choice", zh: "最终选择" }, default: "score",
      options: [
        { value: "score", label: { en: "Top evaluator score", zh: "评估器最高分" } },
        { value: "check", label: { en: "Exact checker", zh: "精确检查器" } },
      ],
    },
    seed: { kind: "range", label: { en: "Tree seed", zh: "树的种子" }, min: 1, max: SEEDS, step: 1, default: 92, control: false },
  },
  timeline: {
    rate: 2,
    discrete: true,
    duration: (p) => runFor(p).steps.length,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const run = runFor(p);
      const tr = tree(p.seed);
      const out: Array<{ t: number; label: string }> = [];
      const firstLeaf = run.steps.findIndex((s) => s.node >= 0 && isLeaf(kidsOf(s.node)[0]));
      run.steps.forEach((s, k) => {
        const dec = s.decision;
        if (dec && dec.kind === "level") {
          if (k === run.lostAt) {
            const best = dec.ranked.find((i) => tr.v[i] > 0)!;
            out.push({ t: k + 1, label: tpl(L.kfLost, { d: dec.depth, a: val(score(tr, p.noise, best)) }) });
          } else out.push({ t: k + 1, label: tpl(L.kfLevel, { d: dec.depth, k: dec.keep, m: dec.ranked.length }) });
        } else if (k === run.firstSolutionAt) out.push({ t: k + 1, label: L.kfSolution });
        else if (k === firstLeaf && p.policy === "best") out.push({ t: k + 1, label: L.kfFirstLeaf });
      });
      out.push({ t: run.steps.length, label: tpl(L.sentence, { out: outcome(run, tr, p.noise, L) }) });
      return out;
    },
    poster: (p) => {
      const run = runFor(p);
      return run.lostAt >= 0 ? run.lostAt + 1 : run.steps.length;
    },
  },
  render,
  describe,
});
