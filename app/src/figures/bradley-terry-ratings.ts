// Pairwise votes turned into Bradley-Terry ratings, shown on a chosen Elo
// display scale. The chapter's model without covariates:
//
//   Pr(i beats j) = σ(β_i − β_j) = 1 / (1 + 10^(−(R_i − R_j) / S)),
//   R_i = 1000 + S · β_i / ln 10,   Σ_i β_i = 0,
//
// with σ the logistic function and S the display scale (points per tenfold
// change in the odds; S = 400 is the common Elo display). The fit is the
// maximum-likelihood β from the minorize-maximize iteration of Hunter (2004):
//
//   π_i ← W_i / Σ_{j≠i} n_ij / (π_i + π_j),   β_i = ln π_i, then centered,
//
// where W_i is i's wins (plus half of its ties when ties count as half-wins)
// and n_ij the decisive comparisons between i and j (plus their ties in that
// case). A maximum exists only when the directed win graph is strongly
// connected (Ford 1957); the figure checks that before fitting and shows a
// system with no loss as having no finite rating, fitting the rest among
// themselves.
//
// Votes (illustrative, simulated). Five systems A to E with log-odds strengths
// 0.9, 0.35, 0.1, −0.35, −1.0 meet in an unbalanced schedule of 236
// comparisons. Each comparison is an independent vote on its own prompt, drawn
// from the Davidson (1970) tie model with ν = 0.4:
//
//   Pr(i wins) = π_i / D,  Pr(tie) = ν √(π_i π_j) / D,  D = π_i + π_j + ν √(π_i π_j).
//
// Because votes are independent here, the bootstrap resamples votes: 400
// resamples of the whole log with replacement, refit each, and report the
// 2.5th and 97.5th percentiles of each rating and of each rank. The "no loss"
// log replaces A's schedule with 14 votes against D and E, all won by A, as a
// newly added system might have.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- votes

export const SYSTEMS = ["A", "B", "C", "D", "E"] as const;
const K = SYSTEMS.length;
const TRUE_BETA = [0.9, 0.35, 0.1, -0.35, -1.0];
const NU = 0.4;
const BOOT = 400;

// Comparisons per pair, [i, j, count]; the connected log.
const SCHEDULE: Array<[number, number, number]> = [
  [0, 1, 40], [0, 2, 30], [0, 3, 12], [0, 4, 8],
  [1, 2, 36], [1, 3, 24], [1, 4, 10],
  [2, 3, 30], [2, 4, 20],
  [3, 4, 26],
];
// A newly added system with only a few votes, all against weak opponents.
const SCHEDULE_NEW: Array<[number, number, number]> = [
  [0, 3, 6], [0, 4, 8],
  ...SCHEDULE.filter(([i]) => i !== 0),
];

export type Outcome = 1 | 0 | 0.5; // 1: i wins, 0: j wins, 0.5: tie
export interface Vote { i: number; j: number; o: Outcome }

type Log = "connected" | "unbeaten";
type Ties = "drop" | "half";

function draw(log: Log, seed: number): Vote[] {
  const u = rng(seed);
  const out: Vote[] = [];
  // The connected schedule is drawn first so the two logs share every vote
  // that does not involve A.
  const drawn = new Map<string, Outcome[]>();
  for (const [i, j, n] of SCHEDULE) {
    const pi = Math.exp(TRUE_BETA[i]), pj = Math.exp(TRUE_BETA[j]);
    const tie = NU * Math.sqrt(pi * pj);
    const D = pi + pj + tie;
    const os: Outcome[] = [];
    for (let k = 0; k < n; k++) {
      const x = u() * D;
      os.push(x < pi ? 1 : x < pi + tie ? 0.5 : 0);
    }
    drawn.set(`${i}-${j}`, os);
  }
  const sched = log === "connected" ? SCHEDULE : SCHEDULE_NEW;
  for (const [i, j, n] of sched) {
    const os = log === "unbeaten" && i === 0 ? Array.from({ length: n }, () => 1 as Outcome) : drawn.get(`${i}-${j}`)!;
    for (let k = 0; k < n; k++) out.push({ i, j, o: os[k] });
  }
  return out;
}

// ---------------------------------------------------------------- fit

interface Tally { wins: number[][]; ties: number[][] } // wins[i][j]: i beat j

function tally(votes: Vote[]): Tally {
  const wins = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  const ties = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  for (const v of votes) {
    if (v.o === 1) wins[v.i][v.j]++;
    else if (v.o === 0) wins[v.j][v.i]++;
    else { ties[v.i][v.j]++; ties[v.j][v.i]++; }
  }
  return { wins, ties };
}

// Win credit of i over j: wins, plus half of the ties when ties count.
const credit = (t: Tally, ties: Ties, i: number, j: number) => t.wins[i][j] + (ties === "half" ? t.ties[i][j] / 2 : 0);

// Systems that can reach every other through the win graph and be reached
// from it, i.e. the members of the strongly connected set used for the fit.
// A system with no win credit against anyone outside its own set, or that
// nobody outside has beaten, is left out (its MLE is at ±∞).
function strongSet(t: Tally, ties: Ties): number[] {
  const reach = (from: number, fwd: boolean): Set<number> => {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const a = stack.pop()!;
      for (let b = 0; b < K; b++) {
        if (seen.has(b)) continue;
        const c = fwd ? credit(t, ties, a, b) : credit(t, ties, b, a);
        if (c > 0) { seen.add(b); stack.push(b); }
      }
    }
    return seen;
  };
  // The largest strongly connected component.
  let best: number[] = [];
  for (let s = 0; s < K; s++) {
    const f = reach(s, true), r = reach(s, false);
    const comp = [...f].filter((x) => r.has(x)).sort((a, b) => a - b);
    if (comp.length > best.length) best = comp;
  }
  return best;
}

// MLE of β over the given systems (sum zero over them); others are NaN.
function fitBeta(t: Tally, ties: Ties, members: number[]): number[] {
  const p = new Array<number>(K).fill(1);
  const inSet = new Set(members);
  for (let it = 0; it < 5000; it++) {
    let delta = 0;
    for (const i of members) {
      let W = 0, den = 0;
      for (const j of members) {
        if (j === i) continue;
        const n = credit(t, ties, i, j) + credit(t, ties, j, i);
        if (n === 0) continue;
        W += credit(t, ties, i, j);
        den += n / (p[i] + p[j]);
      }
      const next = den > 0 ? W / den : p[i];
      delta = Math.max(delta, Math.abs(Math.log(next) - Math.log(p[i])));
      p[i] = next;
    }
    // Keep the geometric mean at 1 so the iteration stays well scaled.
    const lg = members.reduce((a, i) => a + Math.log(p[i]), 0) / members.length;
    for (const i of members) p[i] /= Math.exp(lg);
    if (delta < 1e-12) break;
  }
  return p.map((v, i) => (inSet.has(i) ? Math.log(v) : NaN));
}

export interface Fit {
  votes: Vote[];
  t: Tally;
  members: number[]; // systems with a finite rating
  beta: number[]; // NaN outside members
  lo: number[]; hi: number[]; // 95% bootstrap interval of β
  rankLo: number[]; rankHi: number[]; // 95% bootstrap range of the rank (1 = best)
  boots: number; // resamples that kept the same systems strongly connected
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const x = (sorted.length - 1) * q;
  const a = Math.floor(x), b = Math.ceil(x);
  return sorted[a] + (sorted[b] - sorted[a]) * (x - a);
}

// Rank of each system among the systems with a finite rating, 1 = highest β.
// A system outside the strongly connected set has no rank.
function ranks(beta: number[], members: number[]): number[] {
  const r = new Array<number>(K).fill(NaN);
  const order = [...members].sort((a, b) => beta[b] - beta[a]);
  order.forEach((i, k) => { r[i] = k + 1; });
  return r;
}

const fitMemo = new Map<string, Fit>();
export function fit(log: Log, ties: Ties, seed: number): Fit {
  const key = `${log}|${ties}|${seed}`;
  const hit = fitMemo.get(key);
  if (hit) return hit;
  const votes = draw(log, seed);
  const t = tally(votes);
  const members = strongSet(t, ties);
  const beta = fitBeta(t, ties, members);
  const u = rng(seed ^ 0x5bd1e995);
  const bs: number[][] = members.map(() => []);
  const rs: number[][] = members.map(() => []);
  let boots = 0;
  for (let b = 0; b < BOOT; b++) {
    const sample: Vote[] = [];
    for (let k = 0; k < votes.length; k++) sample.push(votes[Math.floor(u() * votes.length)]);
    const tb = tally(sample);
    const mb = strongSet(tb, ties);
    if (mb.length !== members.length || mb.some((x, k) => x !== members[k])) continue;
    const bb = fitBeta(tb, ties, members);
    const rb = ranks(bb, members);
    members.forEach((i, k) => { bs[k].push(bb[i]); rs[k].push(rb[i]); });
    boots++;
  }
  const lo = new Array<number>(K).fill(NaN), hi = new Array<number>(K).fill(NaN);
  const rankLo = new Array<number>(K).fill(NaN), rankHi = new Array<number>(K).fill(NaN);
  members.forEach((i, k) => {
    const s = [...bs[k]].sort((a, b) => a - b);
    const r = [...rs[k]].sort((a, b) => a - b);
    lo[i] = quantile(s, 0.025); hi[i] = quantile(s, 0.975);
    rankLo[i] = Math.round(quantile(r, 0.025)); rankHi[i] = Math.round(quantile(r, 0.975));
  });
  const out = { votes, t, members, beta, lo, hi, rankLo, rankHi, boots };
  if (fitMemo.size > 16) fitMemo.clear();
  fitMemo.set(key, out);
  return out;
}

// The chapter's two forms of the same win probability.
export const pLogistic = (d: number) => 1 / (1 + Math.exp(-d));
export const pElo = (gap: number, S: number) => 1 / (1 + 10 ** (-gap / S));
export const toPoints = (beta: number, S: number) => 1000 + (S * beta) / Math.LN10;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Bradley-Terry ratings from pairwise votes",
    table: "Votes: wins of the row over the column",
    ties: "ties {t}",
    noVotes: "–",
    tally: "{n} votes, {t} ties; {rule}",
    ruleDrop: "ties dropped from the fit",
    ruleHalf: "each tie counts as half a win for both",
    strip: "Fitted ratings with 95% bootstrap intervals",
    betaAxis: "the same positions in fitted β (log-odds, Σβ = 0)",
    ratingAxis: "displayed rating R = 1000 + S·β / ln 10, S = {S}",
    interval: "bars: 95% intervals from 400 resamples of the votes",
    unrated: "{s}: no loss, no finite rating",
    curve: "Pr(i beats j) against the rating gap, S = {S}",
    gapAxis: "rating gap R_i − R_j (points)",
    ref: "dashed: S = 400",
    atS: "at a gap of S points",
    atS2: "Pr = 1 / (1 + 10⁻¹)",
    atS3: "= 0.909",
    fitted: "fit",
    observed: "share of the votes",
    pair: "{i} vs {j}",
    votes: "votes: {i} won {w}, {j} won {l}, {t} ties",
    share: "{i}'s share of the votes counted: {v}",
    dBeta: "β_{i} − β_{j}",
    dR: "R_{i} − R_{j} = S · Δβ / ln 10",
    pElo: "1 / (1 + 10^(−ΔR / S))",
    pLog: "σ(Δβ) = 1 / (1 + e^(−Δβ))",
    pts: "{v} points",
    noLoss: "{i} has no loss: Δβ is unbounded and Pr → 1",
    ratings: "Ratings at S = {S}",
    colBeta: "β",
    colR: "R",
    colCI: "95% interval",
    colRank: "rank",
    none: "none",
    boots: "{b} of 400 resamples kept every rated system connected",
    describe: "{pair}: {i} won {w}, {j} won {l}, with {t} ties. {fit} Ratings at S = {S}: {list}.",
    fitFinite: "The fitted gap of {d} log-odds is {g} points at this scale, and both forms give Pr({i} beats {j}) = {p}.",
    fitInf: "{u} has no recorded loss, so its rating has no finite maximum-likelihood value.",
  },
  zh: {
    title: "由成对投票拟合 Bradley-Terry 评分",
    table: "投票：行系统胜过列系统的次数",
    ties: "平 {t}",
    noVotes: "–",
    tally: "共 {n} 票，平局 {t} 票；{rule}",
    ruleDrop: "平局不参与拟合",
    ruleHalf: "每次平局双方各计半胜",
    strip: "拟合评分与 95% 自助法区间",
    betaAxis: "同样的位置对应的拟合 β（对数几率，Σβ = 0）",
    ratingAxis: "显示评分 R = 1000 + S·β / ln 10，S = {S}",
    interval: "横条：对投票做 400 次重采样得到的 95% 区间",
    unrated: "{s}：没有输过，评分无有限值",
    curve: "Pr(i 胜 j) 随评分差变化，S = {S}",
    gapAxis: "评分差 R_i − R_j（分）",
    ref: "虚线：S = 400",
    atS: "评分差为 S 分时",
    atS2: "Pr = 1 / (1 + 10⁻¹)",
    atS3: "= 0.909",
    fitted: "拟合",
    observed: "投票中的实际比例",
    pair: "{i} 对 {j}",
    votes: "投票：{i} 胜 {w} 次，{j} 胜 {l} 次，平局 {t} 次",
    share: "{i} 在计入的投票中所占比例：{v}",
    dBeta: "β_{i} − β_{j}",
    dR: "R_{i} − R_{j} = S · Δβ / ln 10",
    pElo: "1 / (1 + 10^(−ΔR / S))",
    pLog: "σ(Δβ) = 1 / (1 + e^(−Δβ))",
    pts: "{v} 分",
    noLoss: "{i} 没有输过：Δβ 没有上界，Pr → 1",
    ratings: "S = {S} 时的评分",
    colBeta: "β",
    colR: "R",
    colCI: "95% 区间",
    colRank: "名次",
    none: "无",
    boots: "400 次重采样中，有 {b} 次所有参评系统仍然连通",
    describe: "{pair}：{i} 胜 {w} 次，{j} 胜 {l} 次，平局 {t} 次。{fit}S = {S} 时的评分：{list}。",
    fitFinite: "拟合的差为 {d} 个对数几率单位，在这个尺度上是 {g} 分，两种写法都给出 Pr({i} 胜 {j}) = {p}。",
    fitInf: "{u} 没有输过的记录，它的评分没有有限的极大似然值。",
  },
};
type L = typeof labels.en;

type Pair = "0-1" | "0-2" | "0-3" | "0-4" | "1-2" | "1-3" | "1-4" | "2-3" | "2-4" | "3-4";
type P = { pair: Pair; scale: number; ties: Ties; log: Log; seed: number };

function pairOf(p: P): [number, number] {
  const [a, b] = p.pair.split("-").map(Number);
  return [a, b];
}

function lines(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w);
}

function heading(s: string, x0: number, y: number, w: number, lang: Lang, parts: string[]): number {
  for (const ln of lines(s, TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  return y;
}

// Observed counts for the pair i, j.
function pairCounts(f: Fit, i: number, j: number) {
  const w = f.t.wins[i][j], l = f.t.wins[j][i], t = f.t.ties[i][j];
  return { w, l, t };
}

// ---------------------------------------------------------------- render: votes

function renderTable(f: Fit, p: P, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = heading(Lx.table, x0, y0, w, lang, parts) + 8;
  const [pi, pj] = pairOf(p);
  const rowW = 22;
  const cw = Math.min(64, Math.floor((w - rowW) / K) - 3);
  const ch = 40;
  for (let c = 0; c < K; c++) parts.push(text(x0 + rowW + c * (cw + 3) + cw / 2, y + 12, SYSTEMS[c], { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  y += 18;
  for (let r = 0; r < K; r++) {
    const ry = y + r * (ch + 3);
    parts.push(text(x0, ry + ch / 2 + 4, SYSTEMS[r], { "font-size": TYPE.body, class: "fig-t-strong" }));
    for (let c = 0; c < K; c++) {
      const cx = x0 + rowW + c * (cw + 3);
      if (r === c) {
        parts.push(el("rect", { x: cx, y: ry, width: cw, height: ch, rx: 3, fill: C.panel, "fill-opacity": 0.4 }));
        continue;
      }
      const wins = f.t.wins[r][c], ties = f.t.ties[r][c];
      const n = wins + f.t.wins[c][r] + ties;
      const sel = (r === pi && c === pj) || (r === pj && c === pi);
      const lo = Math.min(r, c), hi = Math.max(r, c);
      parts.push(g({ "data-fig-set": `pair=${lo}-${hi}`, class: "fig-hit" },
        el("rect", { x: cx, y: ry, width: cw, height: ch, rx: 3, fill: C.panel, stroke: sel ? C.ink : undefined, "stroke-width": sel ? 1.5 : undefined }),
        n === 0
          ? text(cx + cw / 2, ry + ch / 2 + 4, Lx.noVotes, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-faint" })
          : text(cx + cw / 2, ry + 17, int(wins), { "font-size": TYPE.label, "text-anchor": "middle", class: sel ? "fig-t-strong fig-t-num" : "fig-t-num" })
            + text(cx + cw / 2, ry + 33, tpl(Lx.ties, { t: ties }), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }),
      ));
    }
  }
  y += K * (ch + 3) + 4;
  let nTies = 0;
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) nTies += f.t.ties[a][b];
  const note = tpl(Lx.tally, { n: f.votes.length, t: nTies, rule: p.ties === "drop" ? Lx.ruleDrop : Lx.ruleHalf });
  for (const ln of lines(note, TYPE.body, w, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-votes" }, ...parts), h: y - y0 + 4 };
}

// ---------------------------------------------------------------- render: ratings plot

// One row per system on a fixed axis of displayed points, so changing S moves
// every rating and its interval. The ruler above marks the fitted β at the
// same positions, so it stretches or compresses with S while β stays put.
function renderPlot(f: Fit, p: P, x0: number, y0: number, w: number, narrow: boolean, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = heading(Lx.strip, x0, y0, w, lang, parts);
  const left = x0 + 22, right = x0 + w - 12;
  const xr = linear([400, 1600], [left, right]);
  const [pi, pj] = pairOf(p);
  const rated = (i: number) => Number.isFinite(f.beta[i]);
  const colorOf = (i: number) => (i === pi ? C.c1 : i === pj ? C.c2 : C.ink2);
  // The β ruler.
  y += 20;
  parts.push(text(left, y, Lx.betaAxis, { "font-size": TYPE.body, class: "fig-t-muted" }));
  y += 22;
  const rulerY = y;
  parts.push(el("line", { x1: left, x2: right, y1: rulerY, y2: rulerY, stroke: C.rule, "stroke-width": 1 }));
  // Label every 0.5 of β when the labels have room, else every 1 or 2.
  const perBeta = xr(toPoints(1, p.scale)) - xr(toPoints(0, p.scale));
  const labelStep = perBeta * 0.5 >= 36 ? 0.5 : perBeta >= 36 ? 1 : 2;
  for (let k = -12; k <= 12; k++) {
    const b = k * 0.25;
    const px = xr(toPoints(b, p.scale));
    if (px < left - 0.5 || px > right + 0.5) continue;
    const labeled = Math.abs(b / labelStep - Math.round(b / labelStep)) < 1e-9;
    parts.push(el("line", { x1: px, x2: px, y1: rulerY - (labeled ? 5 : 3), y2: rulerY, stroke: C.rule, "stroke-width": 1 }));
    if (!labeled) continue;
    const lab = fixed(b, b === Math.round(b) ? 0 : 1);
    if (px + textWidth(lab, TYPE.body) / 2 > x0 + w) continue;
    parts.push(text(px, rulerY - 9, lab, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  }
  // Rows, highest β first; a system with no finite rating goes on top.
  const order = [...Array(K).keys()].sort((a2, b2) => (rated(b2) ? f.beta[b2] : Infinity) - (rated(a2) ? f.beta[a2] : Infinity));
  const rowH = 24;
  const top = rulerY + 10;
  const bottom = top + K * rowH;
  for (const v of [400, 600, 800, 1000, 1200, 1400, 1600]) parts.push(el("line", { x1: xr(v), x2: xr(v), y1: top, y2: bottom, stroke: C.grid, "stroke-width": 1 }));
  order.forEach((i, r) => {
    const cy = top + r * rowH + rowH / 2;
    parts.push(text(x0, cy + 4, SYSTEMS[i], { "font-size": TYPE.body, class: i === pi || i === pj ? "fig-t-strong" : "fig-t-muted" }));
    if (!rated(i)) {
      parts.push(el("path", { d: `M${right - 18},${cy}L${right},${cy}M${right - 6},${cy - 5}L${right},${cy}L${right - 6},${cy + 5}`, fill: "none", stroke: colorOf(i), "stroke-width": 2 }));
      parts.push(text(right - 24, cy + 4, tpl(Lx.unrated, { s: SYSTEMS[i] }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-halo" }));
      return;
    }
    const x1 = xr(xr.clamp(toPoints(f.lo[i], p.scale))), x2 = xr(xr.clamp(toPoints(f.hi[i], p.scale)));
    parts.push(el("line", { x1, x2, y1: cy, y2: cy, stroke: colorOf(i), "stroke-width": 4, "stroke-opacity": 0.4, "stroke-linecap": "round" }));
    parts.push(el("circle", { cx: xr(toPoints(f.beta[i], p.scale)), cy, r: 5, fill: colorOf(i), stroke: C.paper, "stroke-width": 1.5 }));
  });
  parts.push(axis({ scale: xr, orient: "bottom", at: bottom, ticks: narrow ? [400, 800, 1200, 1600] : [400, 600, 800, 1000, 1200, 1400, 1600], format: (v) => int(v), size: TYPE.body }));
  y = bottom + axisHeight(false, TYPE.body);
  for (const ln of lines(tpl(Lx.ratingAxis, { S: p.scale }), TYPE.body, w, lang)) { y += 16; parts.push(text(x0 + w / 2, y, ln, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" })); }
  for (const ln of lines(Lx.interval, TYPE.body, w, lang)) { y += 16; parts.push(text(x0 + w / 2, y, ln, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-plot" }, ...parts), h: y - y0 + 4 };
}

// ---------------------------------------------------------------- render: curve

// The win probability against the displayed gap for the chosen S, with the
// S = 400 curve for reference, the chosen pair's fitted point, and its share
// of the votes at the same gap.
function renderCurve(f: Fit, p: P, x0: number, y0: number, w: number, narrow: boolean, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = heading(tpl(Lx.curve, { S: p.scale }), x0, y0, w, lang, parts) + 12;
  const left = x0 + 34, right = x0 + w - 8;
  const top = y, ph = narrow ? 170 : 190, bottom = top + ph;
  const xs = linear([-800, 800], [left, right]);
  const ys = linear([0, 1], [bottom, top]);
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, right], format: (v) => String(v), size: TYPE.body }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [-800, -400, 0, 400, 800], format: (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0"), title: Lx.gapAxis, size: TYPE.body }));
  const curve = (S: number) => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 160; k++) { const gap = -800 + k * 10; pts.push([xs(gap), ys(pElo(gap, S))]); }
    return pts;
  };
  if (p.scale !== 400) parts.push(el("path", { d: linePath(curve(400)), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: linePath(curve(p.scale)), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  // gap = S gives 1 / (1 + 10^−1) = 0.909 on every scale.
  const sx = xs(p.scale), sy = ys(pElo(p.scale, p.scale));
  parts.push(el("path", { d: `M${sx},${sy - 5}L${sx + 5},${sy}L${sx},${sy + 5}L${sx - 5},${sy}Z`, fill: C.paper, stroke: C.ink, "stroke-width": 1.2 }));
  // Its label sits in the lower right, which the curve never enters (gap > 0 means Pr > 0.5).
  const ax = right - 4, ay = ys(0.42);
  const note = [Lx.atS, Lx.atS2, Lx.atS3];
  const aw = Math.max(...note.map((t) => textWidth(t, TYPE.body)));
  // The leader runs below the curve (the curve rises to the right of the
  // diamond), straight down when the diamond is above the note.
  parts.push(el("line", { x1: sx, y1: sy + 6, x2: Math.max(ax - aw, Math.min(ax, sx)), y2: ay - 14, stroke: C.ink3, "stroke-width": 1 }));
  note.forEach((t, k) => parts.push(text(ax, ay + k * 16, t, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" })));
  // The pair.
  const [i, j] = pairOf(p);
  const c = pairCounts(f, i, j);
  const counted = p.ties === "half" ? c.w + c.l + c.t : c.w + c.l;
  const share = counted > 0 ? (c.w + (p.ties === "half" ? c.t / 2 : 0)) / counted : NaN;
  const finite = Number.isFinite(f.beta[i]) && Number.isFinite(f.beta[j]);
  if (finite) {
    const gap = toPoints(f.beta[i], p.scale) - toPoints(f.beta[j], p.scale);
    const gx = xs(Math.max(-800, Math.min(800, gap)));
    const py = ys(pElo(gap, p.scale));
    parts.push(el("line", { x1: left, x2: gx, y1: py, y2: py, stroke: C.c1, "stroke-width": 1, "stroke-dasharray": "2 2" }));
    if (Number.isFinite(share)) parts.push(el("circle", { cx: gx, cy: ys(share), r: 4.5, fill: C.paper, stroke: C.c2, "stroke-width": 2 }));
    parts.push(el("circle", { cx: gx, cy: py, r: 5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
  }
  y = bottom + axisHeight(true, TYPE.body) + 6;
  // Legend.
  const lg: string[] = [];
  let lx = x0;
  const add = (wd: number, draw: (x: number) => string) => { if (lx > x0 && lx + wd > x0 + w) { y += 20; lx = x0; } lg.push(draw(lx)); lx += wd + 16; };
  const yy = () => y + 12;
  if (finite) add(20 + textWidth(tpl(Lx.pair, { i: SYSTEMS[i], j: SYSTEMS[j] }) + " " + Lx.fitted, TYPE.body), (x) => el("circle", { cx: x + 6, cy: yy() - 4, r: 5, fill: C.c1 }) + text(x + 18, yy(), `${tpl(Lx.pair, { i: SYSTEMS[i], j: SYSTEMS[j] })} ${Lx.fitted}`, { "font-size": TYPE.body, class: "fig-t-muted" }));
  if (finite && Number.isFinite(share)) add(20 + textWidth(Lx.observed, TYPE.body), (x) => el("circle", { cx: x + 6, cy: yy() - 4, r: 4, fill: C.paper, stroke: C.c2, "stroke-width": 2 }) + text(x + 18, yy(), Lx.observed, { "font-size": TYPE.body, class: "fig-t-muted" }));
  if (p.scale !== 400) add(textWidth(Lx.ref, TYPE.body), (x) => text(x, yy(), Lx.ref, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(...lg);
  y += 20;
  return { svg: g({ class: "fig-curve" }, ...parts), h: y - y0 };
}

// ---------------------------------------------------------------- render: readouts

function renderPair(f: Fit, p: P, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const [i, j] = pairOf(p);
  const si = SYSTEMS[i], sj = SYSTEMS[j];
  let y = heading(tpl(Lx.pair, { i: si, j: sj }), x0, y0, w, lang, parts) + 4;
  const c = pairCounts(f, i, j);
  const counted = p.ties === "half" ? c.w + c.l + c.t : c.w + c.l;
  const share = counted > 0 ? (c.w + (p.ties === "half" ? c.t / 2 : 0)) / counted : NaN;
  const notes = [tpl(Lx.votes, { i: si, j: sj, w: c.w, l: c.l, t: c.t })];
  if (Number.isFinite(share)) notes.push(tpl(Lx.share, { i: si, v: fixed(share, 3) }));
  for (const nt of notes) for (const ln of lines(nt, TYPE.body, w, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); }
  y += 8;
  const finite = Number.isFinite(f.beta[i]) && Number.isFinite(f.beta[j]);
  const rows: Array<[string, string, boolean]> = [];
  if (finite) {
    const d = f.beta[i] - f.beta[j];
    const gap = (p.scale * d) / Math.LN10;
    rows.push([tpl(Lx.dBeta, { i: si, j: sj }), fixed(d, 3), false]);
    rows.push([tpl(Lx.dR, { i: si, j: sj }), tpl(Lx.pts, { v: fixed(gap, 1) }), false]);
    rows.push([Lx.pElo, fixed(pElo(gap, p.scale), 3), true]);
    rows.push([Lx.pLog, fixed(pLogistic(d), 3), true]);
  } else {
    const u = Number.isFinite(f.beta[i]) ? sj : si;
    for (const ln of lines(tpl(Lx.noLoss, { i: u }), TYPE.body, w, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-strong" })); }
    y += 6;
  }
  for (const [name, v, strong] of rows) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, y + 15, name, { "font-size": TYPE.body, class: "fig-t-num" }));
    parts.push(text(x0 + w, y + 15, v, { "font-size": TYPE.body, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    y += 22;
  }
  if (rows.length) parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-pair" }, ...parts), h: y - y0 + 4 };
}

function renderRatings(f: Fit, p: P, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = heading(tpl(Lx.ratings, { S: p.scale }), x0, y0, w, lang, parts) + 6;
  // Columns right-aligned at fractions of the width.
  const cols = [x0 + 18, x0 + w * 0.32, x0 + w * 0.5, x0 + w * 0.84, x0 + w];
  const head = ["", Lx.colBeta, Lx.colR, Lx.colCI, Lx.colRank];
  head.forEach((h, k) => { if (h) parts.push(text(cols[k], y + 12, h, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" })); });
  y += 18;
  const [pi, pj] = pairOf(p);
  const order = [...Array(K).keys()].sort((a, b) => (Number.isFinite(f.beta[b]) ? f.beta[b] : Infinity) - (Number.isFinite(f.beta[a]) ? f.beta[a] : Infinity));
  for (const i of order) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const rated = Number.isFinite(f.beta[i]);
    const cls = i === pi || i === pj ? "fig-t-strong fig-t-num" : "fig-t-num";
    const pts = (b: number) => int(toPoints(b, p.scale));
    const rank = rated ? (f.rankLo[i] === f.rankHi[i] ? String(f.rankLo[i]) : `${f.rankLo[i]}–${f.rankHi[i]}`) : Lx.none;
    const cells = [SYSTEMS[i], rated ? fixed(f.beta[i], 2) : "∞", rated ? pts(f.beta[i]) : "∞", rated ? `${pts(f.lo[i])}–${pts(f.hi[i])}` : Lx.none, rank];
    cells.forEach((v, k) => parts.push(text(cols[k], y + 15, v, { "font-size": TYPE.body, "text-anchor": "end", class: k === 0 ? "fig-t-strong" : cls })));
    y += 21;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  for (const ln of lines(tpl(Lx.boots, { b: f.boots }), TYPE.body, w, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-ratings" }, ...parts), h: y - y0 + 4 };
}

// ---------------------------------------------------------------- figure

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const f = fit(p.log, p.ties, p.seed);
  const [i, j] = pairOf(p);
  const c = pairCounts(f, i, j);
  const finite = Number.isFinite(f.beta[i]) && Number.isFinite(f.beta[j]);
  const d = f.beta[i] - f.beta[j];
  const gap = (p.scale * d) / Math.LN10;
  const unrated = [...Array(K).keys()].filter((k) => !Number.isFinite(f.beta[k])).map((k) => SYSTEMS[k]).join(", ");
  const fitS = finite
    ? tpl(Lx.fitFinite, { d: fixed(d, 3), g: fixed(gap, 1), i: SYSTEMS[i], j: SYSTEMS[j], p: fixed(pLogistic(d), 3) })
    : tpl(Lx.fitInf, { u: unrated });
  const list = [...Array(K).keys()].map((k) => `${SYSTEMS[k]} ${Number.isFinite(f.beta[k]) ? int(toPoints(f.beta[k], p.scale)) : "∞"}`).join(lang === "zh" ? "，" : ", ");
  return tpl(Lx.describe, { pair: tpl(Lx.pair, { i: SYSTEMS[i], j: SYSTEMS[j] }), i: SYSTEMS[i], j: SYSTEMS[j], w: c.w, l: c.l, t: c.t, fit: fitS, S: p.scale, list });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const f = fit(p.log, p.ties, p.seed);
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    for (const block of [
      () => renderTable(f, p, 0, y, w, Lx, lang),
      () => renderPlot(f, p, 0, y, w, true, Lx, lang),
      () => renderCurve(f, p, 0, y, w, true, Lx, lang),
      () => renderPair(f, p, 0, y, w, Lx, lang),
      () => renderRatings(f, p, 0, y, w, Lx, lang),
    ]) {
      const b = block();
      parts.push(b.svg); y += b.h + 18;
    }
  } else {
    const gap = 28;
    const lw = Math.floor((w - gap) * 0.47);
    const tb = renderTable(f, p, 0, y, lw, Lx, lang);
    const cv = renderCurve(f, p, lw + gap, y, w - lw - gap, false, Lx, lang);
    parts.push(tb.svg, cv.svg);
    y += Math.max(tb.h, cv.h) + 18;
    const sp = renderPlot(f, p, 0, y, w, false, Lx, lang);
    parts.push(sp.svg); y += sp.h + 18;
    const pr = renderPair(f, p, 0, y, lw, Lx, lang);
    const rt = renderRatings(f, p, lw + gap, y, w - lw - gap, Lx, lang);
    parts.push(pr.svg, rt.svg);
    y += Math.max(pr.h, rt.h) + 4;
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

const PAIRS: Pair[] = ["0-1", "0-2", "0-3", "0-4", "1-2", "1-3", "1-4", "2-3", "2-4", "3-4"];

export default defineFigure({
  name: "bradley-terry-ratings",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    scale: {
      kind: "range", label: { en: "Display scale S", zh: "显示尺度 S" }, unit: { en: "points per tenfold odds", zh: "分／十倍几率" }, min: 200, max: 800, step: 10, default: 400,
      marks: [{ value: 400, label: { en: "common Elo display", zh: "常用 Elo 显示" } }],
    },
    pair: {
      kind: "choice", control: "select", label: { en: "Pair", zh: "比较对" }, default: "0-1",
      options: PAIRS.map((pp) => {
        const [a, b] = pp.split("-").map(Number);
        return { value: pp, label: { en: `${SYSTEMS[a]} vs ${SYSTEMS[b]}`, zh: `${SYSTEMS[a]} 对 ${SYSTEMS[b]}` } };
      }),
    },
    ties: {
      kind: "choice", label: { en: "Ties", zh: "平局" }, default: "drop",
      options: [
        { value: "drop", label: { en: "Dropped", zh: "不计入" } },
        { value: "half", label: { en: "Half a win each", zh: "各计半胜" } },
      ],
    },
    log: {
      kind: "choice", label: { en: "Vote log", zh: "投票记录" }, default: "connected",
      options: [
        { value: "connected", label: { en: "Every system has lost", zh: "每个系统都输过" } },
        { value: "unbeaten", label: { en: "A has never lost", zh: "A 从未输过" } },
      ],
    },
    seed: { kind: "range", label: { en: "Vote seed", zh: "投票种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  render,
  describe,
});
