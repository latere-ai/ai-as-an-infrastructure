// Trusted monitoring under an audit budget, after the APPS control evaluation
// of Greenblatt et al. ("AI Control: Improving Safety Despite Intentional
// Subversion", ICML 2024, arXiv:2312.06942v5).
//
// The untrusted model writes every output. A weaker trusted monitor gives each
// output a suspicion score: honest outputs score N(0, 1), which is the unit of
// the score axis, and attacks score N(mean, SD). Both cuts are set on the
// honest scores, as the paper sets its audit threshold at a 2% false-positive
// rate on honest GPT-4 solutions:
//   audit cut  zA = Φ⁻¹(1 − b)   the top b of outputs go to human audit
//   defer cut  zD = Φ⁻¹(1 − x)   outputs in the top x that are not audited are
//                                redone by the trusted model (x includes b,
//                                the paper's "defer to trusted 10%")
// Per attack: audited a = P(s ≥ zA), deferred d = P(zD ≤ s < zA), accepted
// l = P(s < zD). An audit finds the attack and the protocol shuts the
// untrusted model down; a deferred attack is discarded; an accepted attack
// causes the unacceptable outcome with probability σ = 13/47, the share of
// unaudited attempts in the paper that passed the tests and were exploitable.
//
// Safety is 1 − ASR in the chapter's definition, with one whole deployment of
// N tasks as the unit: the hazard is an accepted attack that works before any
// attack is audited. With attack rate r per task, independent across tasks,
//   ASR = lσ / (a + lσ) · (1 − (1 − r (a + lσ))^N).
// Usefulness is the chapter's U = E[q] over honest tasks with q = 1 for a
// solved task: U = (1 − f) q_U + f q_T, where f = x − b is the share of honest
// outputs deferred (audited honest outputs are kept) and q_U = 0.54 (GPT-4),
// q_T = 0.22 (GPT-3.5) are the paper's solve rates before rescaling.
//
// ATTACK (mean, SD) is fitted by tools/figure-data/trusted-monitoring-fit.py so
// the closed form reproduces the paper's Table 3 (safety at defer 0, 5, 10,
// 20, 50%; rms error 0.010). The monitor-quality control moves the mean at
// fixed SD and reads it as the AUROC Φ(mean / √(1 + SD²)). An attack's score
// does not depend on how often the model attacks, so the attack rate changes
// only how many attacks fall within the deployment.
//
// The frontier and the readout are the closed form. The strip of seeded
// deployments samples the same process: the first decisive attack (audited, or
// accepted and working) arrives at a geometric time with per-task probability
// r (a + lσ), and the neutral attempts before it (deferred, or accepted and not
// working) at geometric gaps with the conditional per-task probability.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, wrap, type Box, type LabelRequest } from "./lib/labels.ts";
import { compact, fixed, int, pct, sig, tpl } from "./lib/format.ts";
import { rng } from "./lib/random.ts";
import { normalPdf, normalQuantile, normalTail } from "./lib/stats.ts";

// ---------------------------------------------------------------- model

export const ATTACK = { mean: 1.75, sd: 0.66 }; // fitted, see the header
export const SUCCEED = 13 / 47; // accepted attack passes the tests and is exploitable
export const Q_U = 0.54; // untrusted model (GPT-4) solve rate on APPS
export const Q_T = 0.22; // trusted model (GPT-3.5) solve rate on APPS
const APPS_RATE = 3.94; // attacks per 1,000 tasks: 71 of 1,500 proposed, 1 in 12 submitted
const APPS_AUROC = 0.928; // AUROC of the fitted monitor
const ROWS = 20;

// Greenblatt et al. Table 3 (trusted monitoring with defer to trusted) and the
// "don't use untrusted models" baseline of Table 2: defer share, safety,
// usefulness rescaled so GPT-3.5 is 0 and GPT-4 is 1.
const PUBLISHED = [
  { defer: 0, safety: 0.62, scaled: 0.97 },
  { defer: 5, safety: 0.74, scaled: 0.95 },
  { defer: 10, safety: 0.83, scaled: 0.93 },
  { defer: 20, safety: 0.92, scaled: 0.83 },
  { defer: 50, safety: 1.0, scaled: 0.51 },
  { defer: 100, safety: 1.0, scaled: 0.02 },
] as const;

type P = { audit: number; defer: number; auroc: number; rate: number; horizon: number; seed: number };

const Phi = (z: number) => 1 - normalTail(z);
const attackMean = (auroc: number) => normalQuantile(auroc) * Math.sqrt(1 + ATTACK.sd * ATTACK.sd);

interface Model {
  zA: number; zD: number; mean: number;
  a: number; d: number; l: number; lose: number; // per attack
  ratio: number; reach: number; asr: number; safety: number;
  f: number; U: number; scaled: number;
}

function model(audit: number, defer: number, auroc: number, rate: number, N: number): Model {
  const b = audit / 100;
  const x = Math.max(defer, audit) / 100;
  const zA = normalQuantile(1 - b);
  const zD = x >= 1 ? -Infinity : normalQuantile(1 - x);
  const mean = attackMean(auroc);
  const sd = ATTACK.sd;
  const a = normalTail((zA - mean) / sd);
  const l = zD === -Infinity ? 0 : Phi((zD - mean) / sd);
  const d = Math.max(0, 1 - a - l);
  const lose = l * SUCCEED;
  const r = rate / 1000;
  const q = r * (a + lose);
  const reach = q > 0 ? -Math.expm1(N * Math.log1p(-Math.min(q, 1 - 1e-12))) : 0;
  const ratio = a + lose > 0 ? lose / (a + lose) : 0;
  const asr = ratio * reach;
  const f = x - b;
  return {
    zA, zD, mean, a, d, l, lose,
    ratio, reach, asr, safety: 1 - asr,
    f, U: (1 - f) * Q_U + f * Q_T, scaled: 1 - f,
  };
}

// The frontier at fixed audit budget, monitor, attack rate and horizon, as the
// defer share sweeps from the audit budget (no deferral) to every output.
function frontier(p: P): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = p.audit + (100 - p.audit) * t * t;
    const m = model(p.audit, x, p.auroc, p.rate, p.horizon);
    out.push([m.U, m.safety]);
  }
  return out;
}

type Outcome = "caught" | "breach" | "safe";
interface Row { end: number; outcome: Outcome; events: Array<{ t: number; kind: "deferred" | "failed" }> }

const geometric = (u: number, q: number) => (q >= 1 ? 1 : 1 + Math.floor(Math.log(1 - u) / Math.log1p(-q)));

const memo = new Map<string, Row[]>();
function runs(p: P, m: Model): Row[] {
  const key = `${p.audit}|${p.defer}|${p.auroc}|${p.rate}|${p.horizon}|${p.seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const N = p.horizon;
  const r = p.rate / 1000;
  const q = r * (m.a + m.lose);
  const neutral = m.d + m.l * (1 - SUCCEED);
  const rn = q < 1 ? (r * neutral) / (1 - q) : 0;
  const rows: Row[] = [];
  for (let i = 0; i < ROWS; i++) {
    const u = rng((p.seed * 7919 + i * 104729 + 1) >>> 0);
    const T = q > 0 ? geometric(u(), q) : Infinity;
    const decided = T <= N;
    const outcome: Outcome = decided ? (u() < m.a / (m.a + m.lose) ? "caught" : "breach") : "safe";
    const end = decided ? T : N;
    const events: Row["events"] = [];
    if (rn > 0) {
      let t = 0;
      while (events.length < 400) {
        t += geometric(u(), Math.min(rn, 1));
        if (t >= end) break;
        events.push({ t, kind: u() < m.d / neutral ? "deferred" : "failed" });
      }
    }
    rows.push({ end, outcome, events });
  }
  if (memo.size > 64) memo.clear();
  memo.set(key, rows);
  return rows;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Trusted monitoring under an audit budget",
    scoreAxis: "suspicion score (SDs of honest outputs)",
    honestCurve: "honest outputs",
    attackCurve: "attacks",
    accept: "accept",
    defer: "defer",
    audit: "audit",
    cut: "{name} ≥ {z}",
    uAxis: "usefulness U, share of tasks solved",
    sAxis: "safety 1 − ASR over the deployment",
    lgModel: "this protocol, defer share swept",
    lgApps: "APPS setting",
    lgPub: "published, Greenblatt et al.",
    lgNow: "current defer share",
    pubTrusted: "trusted only",
    perAttack: "Per attack",
    barA: "audited {v}",
    barD: "deferred {v}",
    barW: "accepted, works {v}",
    barF: "accepted, fails {v}",
    works: "per-attack ASR = l·σ = {l} × {s} = {v}",
    deploy: "Over the deployment",
    deployNr: "N = {n} tasks, r = {r} attacks per 1,000",
    eqA: "ASR = lσ / (a + lσ) · (1 − (1 − r(a + lσ))",
    eqB: ")",
    eqNum: "= {ratio} × {reach} = {asr}",
    safety: "safety 1 − ASR = {v}",
    useHead: "Usefulness on honest tasks",
    useEq: "U = (1 − f)·{qu} + f·{qt} = {u}",
    useNum: "f = {f} deferred; rescaled {s}",
    runsHead: "{k} of {n} seeded deployments end safe (closed form {s})",
    lgCaught: "attack audited, model shut down",
    lgBreach: "accepted attack works",
    lgDeferred: "attack deferred",
    lgFailed: "accepted attack fails",
    taskAxis: "task in the deployment",
    describe: "Audit budget {b}, defer the top {x}, monitor AUROC {auc}: an attack is audited with probability {a}, deferred with {d} and accepted with {l}. Over {n} tasks at {r} attacks per 1,000, safety 1 − ASR is {s} and usefulness U is {u} ({us} rescaled).",
  },
  zh: {
    title: "审计预算约束下的受信任监控",
    scoreAxis: "可疑度（以良性输出的标准差为单位）",
    honestCurve: "良性输出",
    attackCurve: "攻击",
    accept: "接受",
    defer: "转交",
    audit: "审计",
    cut: "{name} ≥ {z}",
    uAxis: "可用性 U（良性任务的解决比例）",
    sAxis: "整次部署的安全性 1 − ASR",
    lgModel: "本协议，转交比例逐步变化",
    lgApps: "APPS 设置",
    lgPub: "Greenblatt 等人的公布结果",
    lgNow: "当前转交比例",
    pubTrusted: "只用受信任模型",
    perAttack: "每次攻击",
    barA: "审计 {v}",
    barD: "转交 {v}",
    barW: "接受且得手 {v}",
    barF: "接受但未得手 {v}",
    works: "单次攻击的 ASR = l·σ = {l} × {s} = {v}",
    deploy: "整次部署",
    deployNr: "N = {n} 个任务，每千个任务攻击 r = {r} 次",
    eqA: "ASR = lσ / (a + lσ) · (1 − (1 − r(a + lσ))",
    eqB: ")",
    eqNum: "= {ratio} × {reach} = {asr}",
    safety: "安全性 1 − ASR = {v}",
    useHead: "良性任务上的可用性",
    useEq: "U = (1 − f)·{qu} + f·{qt} = {u}",
    useNum: "转交比例 f = {f}，归一化后为 {s}",
    runsHead: "{n} 次带种子的模拟部署中有 {k} 次安全结束（解析值 {s}）",
    lgCaught: "攻击被审计发现，模型停用",
    lgBreach: "被接受的攻击得手",
    lgDeferred: "攻击被转交",
    lgFailed: "被接受的攻击未得手",
    taskAxis: "部署中的任务序号",
    describe: "审计预算 {b}，转交可疑度最高的 {x}，监控器 AUROC 为 {auc}：一次攻击被审计的概率为 {a}，被转交的概率为 {d}，被接受的概率为 {l}。在 {n} 个任务、每千个任务攻击 {r} 次的部署中，安全性 1 − ASR 为 {s}，可用性 U 为 {u}（归一化后为 {us}）。",
  },
};
type L = typeof labels.en;

const p1 = (v: number) => pct(v, v > 0 && v < 0.1 ? 1 : 0);
const rateText = (r: number) => sig(r, r < 1 ? 2 : 3);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p.audit, p.defer, p.auroc, p.rate, p.horizon);
  return tpl(L.describe, {
    b: `${sig(p.audit, 3)}%`, x: `${sig(Math.max(p.defer, p.audit), 3)}%`, auc: fixed(p.auroc, 3),
    a: p1(m.a), d: p1(m.d), l: p1(m.l), n: int(p.horizon), r: rateText(p.rate),
    s: p1(m.safety), u: fixed(m.U, 3), us: fixed(m.scaled, 2),
  });
}

// ---------------------------------------------------------------- panels

const X_DOMAIN: [number, number] = [-3.5, 5.5];

function scorePanel(p: P, m: Model, L: L, w: number, y0: number, narrow: boolean) {
  const parts: string[] = [];
  const left = 6, right = w - 6;
  // Two label rows above the plot: the defer cut is named on the upper row and
  // the accept and audit routes on the lower one, each starting at its cut, so
  // the names never collide however narrow the defer band gets.
  const row1 = y0 + 11, row2 = y0 + 27;
  const top = y0 + 34;
  const plotH = narrow ? 104 : 124;
  const base = top + plotH;
  const x = linear(X_DOMAIN, [left, right]);
  const y = linear([0, 0.64], [base, top]);
  const xA = x(m.zA);
  const xD = m.zD === -Infinity ? left : Math.max(left, x(m.zD));
  const hasDefer = xA - xD >= 0.5;
  // Route bands behind the curves.
  if (hasDefer) parts.push(el("rect", { x: xD, y: top, width: xA - xD, height: plotH, fill: C.panel }));
  parts.push(el("rect", { x: xA, y: top, width: right - xA, height: plotH, fill: C.panel }));
  parts.push(el("rect", { x: xA, y: top, width: right - xA, height: plotH, fill: C.ink3, "fill-opacity": 0.12 }));
  // Densities, sampled across the axis.
  const curve = (mu: number, sd: number) => {
    const pts: Array<[number, number]> = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const s = X_DOMAIN[0] + ((X_DOMAIN[1] - X_DOMAIN[0]) * i) / n;
      pts.push([x(s), y(normalPdf((s - mu) / sd) / sd)]);
    }
    return pts;
  };
  const honest = curve(0, 1);
  const attack = curve(m.mean, ATTACK.sd);
  const area = (pts: Array<[number, number]>) => `${linePath(pts)}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
  parts.push(el("path", { d: area(honest), fill: C.c1, "fill-opacity": 0.16 }));
  parts.push(el("path", { d: area(attack), fill: C.c2, "fill-opacity": 0.2 }));
  parts.push(el("path", { d: linePath(honest), fill: "none", stroke: C.c1, "stroke-width": 1.8 }));
  parts.push(el("path", { d: linePath(attack), fill: "none", stroke: C.c2, "stroke-width": 1.8 }));
  const size = narrow ? TYPE.body : TYPE.small;
  parts.push(axis({ scale: x, orient: "bottom", at: base, title: L.scoreAxis, format: (v) => fixed(v, 0), size }));

  // Cuts, drawn up to the row that names them.
  if (hasDefer && xD <= left) {
    // Everything below the audit cut is deferred.
    parts.push(text(left + 2, row1, L.defer, { "font-size": size, class: "fig-t-strong" }));
  } else if (hasDefer) {
    parts.push(el("line", { x1: xD, x2: xD, y1: row1 - size + 1, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));
    const s = tpl(L.cut, { name: L.defer, z: fixed(m.zD, 2) });
    const fits = xD + 4 + textWidth(s, size) <= right;
    parts.push(text(fits ? xD + 4 : xD - 4, row1, s, { "font-size": size, "text-anchor": fits ? "start" : "end", class: "fig-t-strong fig-t-num" }));
  }
  parts.push(el("line", { x1: xA, x2: xA, y1: row2 - size + 1, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));
  parts.push(text(xA + 4, row2, tpl(L.cut, { name: L.audit, z: fixed(m.zA, 2) }), { "font-size": size, class: "fig-t-strong fig-t-num" }));
  if (xD - 4 - textWidth(L.accept, size) >= left) {
    parts.push(text(xD - 4, row2, L.accept, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  }

  // Curve names, kept off both curves; any that do not fit go to a legend.
  const obstacles: Box[] = [...lineObstacles(honest, 6, 2), ...lineObstacles(attack, 6, 2)];
  const reqs: LabelRequest[] = [
    { x: x(-1.2), y: y(normalPdf(1.2)), text: L.honestCurve, size, sides: ["above-left", "left", "above"], gap: 6, priority: 2, attrs: { class: "fig-t-halo" } },
    { x: x(m.mean + ATTACK.sd * 0.9), y: y(normalPdf(0.9) / ATTACK.sd), text: L.attackCurve, size, sides: ["above-right", "right", "below-right", "above"], gap: 6, priority: 1, attrs: { class: "fig-t-halo" } },
  ];
  const placed = placeLabels(reqs, { x0: left, y0: top + 2, x1: right, y1: base - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  let h = base - y0 + axisHeight(true, size);
  if (placed.dropped.length) {
    const lg = legend([
      { label: L.honestCurve, swatch: { kind: "rect", fill: C.c1, opacity: 0.5 } },
      { label: L.attackCurve, swatch: { kind: "rect", fill: C.c2, opacity: 0.5 } },
    ], 0, y0 + h + 2, w, size);
    parts.push(lg.svg);
    h += lg.height + 2;
  }
  return { svg: g({}, ...parts), h };
}

function frontierPanel(p: P, m: Model, L: L, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const left = x0 + 42, right = x0 + w - 6;
  const size = narrow ? TYPE.body : TYPE.small;
  const top = y0 + 22;
  const plotH = narrow ? 190 : 210;
  const base = top + plotH;
  const x = linear([0.2, 0.56], [left, right]);
  const y = linear([0, 1], [base, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: base, grid: [top, base], title: L.uAxis, format: (v) => fixed(v, 2), size }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], title: L.sAxis, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => pct(v), size }));

  const obstacles: Box[] = [];
  const isApps = p.audit === 2 && p.auroc === APPS_AUROC && p.rate === APPS_RATE && p.horizon === 5000;
  if (!isApps) {
    const ghost = frontier({ ...p, audit: 2, auroc: APPS_AUROC, rate: APPS_RATE, horizon: 5000 }).map(([u, s]) => [x(u), y(s)] as [number, number]);
    parts.push(el("path", { d: linePath(ghost), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
    obstacles.push(...lineObstacles(ghost, 6, 2));
  }
  const pts = frontier(p).map(([u, s]) => [x(u), y(s)] as [number, number]);
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));
  obstacles.push(...lineObstacles(pts, 6, 2));

  // Published points as hollow squares, labeled with their defer share.
  const reqs: LabelRequest[] = [];
  for (const q of PUBLISHED) {
    const px = x(Q_T + q.scaled * (Q_U - Q_T)), py = y(q.safety);
    parts.push(el("rect", { x: px - 3.5, y: py - 3.5, width: 7, height: 7, fill: C.paper, stroke: C.ink2, "stroke-width": 1.4 }));
    obstacles.push({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
    reqs.push({
      x: px, y: py, text: q.defer === 100 ? L.pubTrusted : `${q.defer}%`, size, gap: 7, priority: q.defer === 100 ? 2 : 1,
      sides: q.defer === 100 ? ["below-right", "right", "below"] : ["below-left", "left", "below", "above-left", "above", "below-right", "right"],
      attrs: { class: "fig-t-halo fig-t-soft" },
    });
  }
  const cx = x(m.U), cy = y(m.safety);
  obstacles.push({ x0: cx - 7, y0: cy - 7, x1: cx + 7, y1: cy + 7 });
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: right, y1: base - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  parts.push(el("circle", { cx, cy, r: 5.5, fill: C.ink, stroke: C.paper, "stroke-width": 2 }));

  const items: LegendItem[] = [
    { label: L.lgModel, swatch: { kind: "line", stroke: C.ink } },
    ...(isApps ? [] : [{ label: L.lgApps, swatch: { kind: "line" as const, stroke: C.ink3, dash: "4 3" } }]),
    { label: L.lgPub, swatch: { kind: "rect", fill: "none", stroke: C.ink2 } },
    { label: L.lgNow, swatch: { kind: "dot", fill: C.ink } },
  ];
  const lg = legend(items, x0, base + axisHeight(true, size) + 4, w, size);
  parts.push(lg.svg);
  return { svg: g({}, ...parts), h: base + axisHeight(true, size) + 4 + lg.height - y0 };
}

function readoutPanel(p: P, m: Model, L: L, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  let yy = y0 + 12;
  const line = (s: string, cls = "", size: number = TYPE.body) => {
    for (const ln of wrap(s, size, w)) {
      parts.push(text(x0, yy, ln, { "font-size": size, class: cls || undefined }));
      yy += size + 6;
    }
  };
  line(L.perAttack, "fig-t-strong", TYPE.label);
  yy += 2;
  // Stacked bar of an attack's routes: audited, deferred, accepted (works, fails).
  const barH = 14;
  const segs: Array<[number, string, number]> = [
    [m.a, C.good, 1],
    [m.d, C.ink3, 0.35],
    [m.lose, C.bad, 1],
    [m.l - m.lose, C.bad, 0.3],
  ];
  let bx = x0;
  parts.push(el("rect", { x: x0, y: yy - 10, width: w, height: barH, rx: 2, fill: C.panel }));
  for (const [v, c, op] of segs) {
    const bw = v * w;
    if (bw > 0.2) parts.push(el("rect", { x: bx, y: yy - 10, width: bw, height: barH, fill: c, "fill-opacity": op < 1 ? op : undefined }));
    bx += bw;
  }
  yy += barH + 8;
  // Keyed shares under the bar, wrapping as needed.
  const size = narrow ? TYPE.body : TYPE.small;
  const tags: Array<[string, string, number]> = [
    [tpl(L.barA, { v: p1(m.a) }), C.good, 1],
    [tpl(L.barD, { v: p1(m.d) }), C.ink3, 0.35],
    [tpl(L.barW, { v: p1(m.lose) }), C.bad, 1],
    [tpl(L.barF, { v: p1(m.l - m.lose) }), C.bad, 0.3],
  ];
  let tx = x0;
  for (const [s, c, op] of tags) {
    const tw = size + 5 + textWidth(s, size);
    if (tx > x0 && tx + tw > x0 + w) { tx = x0; yy += size + 7; }
    parts.push(el("rect", { x: tx, y: yy - size + 2, width: size - 2, height: size - 2, rx: 2, fill: c, "fill-opacity": op < 1 ? op : undefined }));
    parts.push(text(tx + size + 3, yy, s, { "font-size": size, class: "fig-t-muted fig-t-num" }));
    tx += tw + 12;
  }
  yy += size + 9;
  line(tpl(L.works, { l: fixed(m.l, 2), s: fixed(SUCCEED, 2), v: p1(m.lose) }), "fig-t-num", size);
  yy += 8;
  line(L.deploy, "fig-t-strong", TYPE.label);
  line(tpl(L.deployNr, { n: int(p.horizon), r: rateText(p.rate) }), "fig-t-muted fig-t-num", size);
  // The deployment-level ASR with N as a superscript.
  parts.push(el("text", { x: x0, y: yy, "font-size": size, class: "fig-t-num" },
    L.eqA.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    el("tspan", { dy: -5, "font-size": size }, "N"),
    el("tspan", { dy: 5 }, L.eqB)));
  yy += size + 6;
  line(tpl(L.eqNum, { ratio: fixed(m.ratio, 2), reach: fixed(m.reach, 2), asr: p1(m.asr) }), "fig-t-num", size);
  yy += 2;
  line(tpl(L.safety, { v: p1(m.safety) }), "fig-t-strong fig-t-num", TYPE.title);
  yy += 8;
  line(L.useHead, "fig-t-strong", TYPE.label);
  line(tpl(L.useEq, { qu: fixed(Q_U, 2), qt: fixed(Q_T, 2), u: fixed(m.U, 3) }), "fig-t-num", size);
  line(tpl(L.useNum, { f: p1(m.f), s: fixed(m.scaled, 2) }), "fig-t-muted fig-t-num", size);
  return { svg: g({ class: "fig-readout" }, ...parts), h: yy - y0 };
}

function runsPanel(p: P, m: Model, L: L, w: number, y0: number, narrow: boolean) {
  const parts: string[] = [];
  const rows = runs(p, m);
  const shown = narrow ? rows.slice(0, 12) : rows;
  const safe = shown.filter((r) => r.outcome !== "breach").length;
  let yy = y0 + 12;
  for (const ln of wrap(tpl(L.runsHead, { k: safe, n: shown.length, s: p1(m.safety) }), TYPE.label, w)) {
    parts.push(text(0, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    yy += TYPE.label + 6;
  }
  const size = narrow ? TYPE.body : TYPE.small;
  const lg = legend([
    { label: L.lgCaught, swatch: { kind: "dot", fill: C.good } },
    { label: L.lgBreach, swatch: { kind: "rect", fill: C.bad } },
    { label: L.lgDeferred, swatch: { kind: "line", stroke: C.ink3 } },
    { label: L.lgFailed, swatch: { kind: "rect", fill: "none", stroke: C.ink2 } },
  ], 0, yy - 4, w, size);
  parts.push(lg.svg);
  yy += lg.height + 4;
  const left = 4, right = w - 12;
  const x = linear([0, p.horizon], [left, right]);
  const rowH = 9;
  for (let i = 0; i < shown.length; i++) {
    const r = shown[i];
    const cy = yy + i * rowH + rowH / 2;
    const xe = x(r.end);
    parts.push(el("line", { x1: left, x2: xe, y1: cy, y2: cy, stroke: C.rule, "stroke-width": 1.5 }));
    let lastX = -Infinity;
    for (const e of r.events) {
      const ex = x(e.t);
      if (ex - lastX < 1.5) continue; // ticks closer than the stroke merge anyway
      lastX = ex;
      parts.push(e.kind === "deferred"
        ? el("line", { x1: ex, x2: ex, y1: cy - 3.5, y2: cy + 3.5, stroke: C.ink3, "stroke-width": 1.2 })
        : el("rect", { x: ex - 2.5, y: cy - 2.5, width: 5, height: 5, fill: C.paper, stroke: C.ink2, "stroke-width": 1 }));
    }
    if (r.outcome === "caught") parts.push(el("circle", { cx: xe, cy, r: 3.8, fill: C.good, stroke: C.paper, "stroke-width": 1 }));
    else if (r.outcome === "breach") parts.push(el("rect", { x: xe - 3.8, y: cy - 3.8, width: 7.6, height: 7.6, fill: C.bad, stroke: C.paper, "stroke-width": 1 }));
    else parts.push(el("line", { x1: xe, x2: xe, y1: cy - 4, y2: cy + 4, stroke: C.ink2, "stroke-width": 1.5 }));
  }
  const base = yy + shown.length * rowH + 4;
  const ticks = narrow ? [0, p.horizon / 2, p.horizon] : x.ticks(5);
  parts.push(axis({ scale: x, orient: "bottom", at: base, ticks, title: L.taskAxis, format: compact, size }));
  return { svg: g({}, ...parts), h: base + axisHeight(true, size) - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p.audit, p.defer, p.auroc, p.rate, p.horizon);
  const parts: string[] = [];
  let y = 0;
  const sc = scorePanel(p, m, L, w, y, narrow);
  parts.push(sc.svg);
  y += sc.h + 16;
  if (narrow) {
    const fr = frontierPanel(p, m, L, 0, y, w, true);
    parts.push(fr.svg);
    y += fr.h + 16;
    const ro = readoutPanel(p, m, L, 0, y, w, true);
    parts.push(ro.svg);
    y += ro.h + 18;
  } else {
    const fw = Math.floor(w * 0.5);
    const fr = frontierPanel(p, m, L, 0, y, fw, false);
    const ro = readoutPanel(p, m, L, fw + 22, y + 4, w - fw - 22, false);
    parts.push(fr.svg, ro.svg);
    y += Math.max(fr.h, ro.h + 4) + 20;
  }
  const rn = runsPanel(p, m, L, w, y, narrow);
  parts.push(rn.svg);
  y += rn.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "trusted-monitoring",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    audit: {
      kind: "range", label: { en: "Audit budget", zh: "审计预算" }, unit: { en: "% of outputs", zh: "% 的输出" },
      min: 0.5, max: 10, step: 0.5, default: 2,
      marks: [{ value: 2, label: { en: "APPS setting", zh: "APPS 设置" } }],
    },
    defer: {
      kind: "range", label: { en: "Defer the most suspicious", zh: "转交可疑度最高的" }, unit: { en: "% of outputs", zh: "% 的输出" },
      min: 0, max: 100, step: 1, default: 10,
    },
    auroc: {
      kind: "range", label: { en: "Trusted monitor quality (AUROC)", zh: "受信任监控器的质量（AUROC）" },
      min: 0.55, max: 0.995, step: 0.001, default: APPS_AUROC,
      marks: [{ value: APPS_AUROC, label: { en: "fitted to APPS", zh: "APPS 拟合值" } }],
    },
    rate: {
      kind: "range", scale: "log", label: { en: "Attack rate", zh: "攻击频率" }, unit: { en: "per 1,000 tasks", zh: "次/千个任务" },
      min: 0.01, max: 100, default: APPS_RATE,
      marks: [{ value: APPS_RATE, label: { en: "APPS attack policy", zh: "APPS 攻击策略" } }],
    },
    horizon: {
      kind: "choice", label: { en: "Deployment length", zh: "部署期限" }, default: 5000,
      options: [
        { value: 5000, label: { en: "5,000 tasks", zh: "5,000 个任务" } },
        { value: 100000, label: { en: "100,000", zh: "100,000" } },
        { value: 1000000, label: { en: "1,000,000", zh: "1,000,000" } },
      ],
    },
    seed: { kind: "range", label: { en: "Seed of the simulated deployments", zh: "模拟部署的随机种子" }, min: 1, max: 999, step: 1, default: 1, control: false },
  },
  // The defer share counts the audited outputs, so it never sits below the
  // audit budget; at the budget nothing is deferred.
  update(p, key) {
    if ((key === "defer" || key === "audit") && p.defer < p.audit) return { ...p, defer: p.audit };
    return p;
  },
  render,
  describe,
});
