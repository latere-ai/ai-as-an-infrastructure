// A guard's two thresholds applied to one harm category, and what the base
// rate of violations does to the result. The chapter's decision rule is
//
//   D_v(x, k) = allow   if s_k(x) ≤ τ_allow
//               review  if τ_allow < s_k(x) < τ_block
//               block   if s_k(x) ≥ τ_block
//
// Scores come from an illustrative detector: a latent value z is N(0, 1) for
// compliant items and N(d′, 1) for violating ones, and the detector reports
// s = σ(d′ z − d′² / 2), which is exactly P(violating | z) on a balanced
// benchmark (half the items violating). The separation d′ is read from the
// control as the AUROC Φ(d′ / √2). Every rate is computed in closed form:
//
//   per class   P(block | violating) = 1 − Φ(z_b − d′), P(block | compliant) = 1 − Φ(z_b)
//               with z_τ = (logit τ + d′² / 2) / d′, the latent cut of threshold τ
//   per branch  precision = π R / (π R + (1 − π) F), for base rate π,
//               recall R = P(block | violating), false-positive rate F
//   calibration P(violating | s) at base rate π = σ(logit s + logit π),
//               because s is calibrated at π = 1/2 (Bayes' rule on the odds)
//   selective   coverage = share decided automatically, risk = errors among them
//
// The per-class rates do not move with π; precision, the composition of the
// review queue, and what a score means as a probability do. Nothing is sampled.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { logitScale } from "./lib/logit-scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { normalPdf, normalQuantile, normalTail, logit, sigmoid } from "./lib/stats.ts";
import { fixed, int, pct, sig, tpl } from "./lib/format.ts";

const N = 100_000; // items per readout
const S_DOMAIN: [number, number] = [0.0002, 0.9998];

type P = { base: number; allow: number; block: number; auroc: number };

const Phi = (z: number) => 1 - normalTail(z);

interface Model {
  d: number; za: number; zb: number;
  c: { allow: number; review: number; block: number }; // per compliant item
  v: { allow: number; review: number; block: number }; // per violating item
  nv: number; nc: number;
  branch: Record<"allow" | "review" | "block", { n: number; viol: number }>;
  precision: number; benchPrecision: number;
  coverage: number; risk: number;
  calAtBlock: number;
}

function model(p: P): Model {
  const d = Math.SQRT2 * normalQuantile(p.auroc);
  const cut = (tau: number) => (logit(tau) + (d * d) / 2) / d;
  const za = cut(p.allow), zb = cut(Math.max(p.block, p.allow));
  const c = { allow: Phi(za), block: normalTail(zb), review: 0 };
  c.review = Math.max(0, 1 - c.allow - c.block);
  const v = { allow: Phi(za - d), block: normalTail(zb - d), review: 0 };
  v.review = Math.max(0, 1 - v.allow - v.block);
  const nv = p.base * N, nc = N - nv;
  const branch = {
    allow: { n: nv * v.allow + nc * c.allow, viol: nv * v.allow },
    review: { n: nv * v.review + nc * c.review, viol: nv * v.review },
    block: { n: nv * v.block + nc * c.block, viol: nv * v.block },
  };
  const prec = (pi: number) => (pi * v.block + (1 - pi) * c.block > 0 ? (pi * v.block) / (pi * v.block + (1 - pi) * c.block) : 0);
  const decided = branch.allow.n + branch.block.n;
  const errors = branch.allow.viol + (branch.block.n - branch.block.viol);
  return {
    d, za, zb, c, v, nv, nc, branch,
    precision: prec(p.base), benchPrecision: prec(0.5),
    coverage: decided / N, risk: decided > 0 ? errors / decided : 0,
    calAtBlock: sigmoid(logit(p.block) + logit(p.base)),
  };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Two guard thresholds and the base rate",
    dist: "Detector score of each class (each curve has area 1)",
    scoreAxis: "detector score s for this category",
    allow: "allow",
    review: "review",
    block: "block",
    tauA: "τ_allow = {v}",
    tauB: "τ_block = {v}",
    comp: "What each branch holds, per 100,000 items at base rate {pi}",
    compRow: "{name} {n}",
    compShare: "{v} violating",
    lgC: "compliant",
    lgV: "violating",
    cal: "What a score means at this base rate",
    calX: "detector score s",
    calY: "share of items that violate",
    calBench: "balanced benchmark",
    calHere: "base rate {pi}",
    calMark: "s = {s}: {p} violate",
    ruleHead: "D_v = ",
    ruleA: "allow if s ≤ {a}",
    ruleR: "review if {a} < s < {b}",
    ruleB: "block if s ≥ {b}",
    ruleSep: ", ",
    perClass: "Per class, the same at any base rate:",
    recall: "recall R = P(block | violating) = {r}",
    fpr: "false-positive rate F = P(block | compliant) = {f}",
    fnr: "missed violations P(allow | violating) = {fn}",
    precEq: "precision = πR / (πR + (1 − π)F) = {pi}·{r} / ({pi}·{r} + {q}·{f}) = {p}",
    precBench: "the same thresholds at a 50% base rate: precision {p}",
    queue: "review queue: {n} items, {s} of traffic, {v} of them violating",
    sel: "coverage {c} decided automatically, risk {k} of those decisions wrong",
    describe: "Base rate {pi}, thresholds {a} and {b}, detector AUROC {auc}: {pa} of items are allowed, {pr} go to review and {pb} are blocked. Recall {r} and false-positive rate {f} do not depend on the base rate, but {p} of blocked items and {qv} of the review queue violate the policy.",
  },
  zh: {
    title: "守卫的两道阈值与基准率",
    dist: "两类内容的检测器分数分布（每条曲线下的面积为 1）",
    scoreAxis: "该类别的检测器分数 s",
    allow: "允许",
    review: "审查",
    block: "阻止",
    tauA: "τ_allow = {v}",
    tauB: "τ_block = {v}",
    comp: "各分支的构成：基准率 {pi} 下每 100,000 条内容",
    compRow: "{name} {n}",
    compShare: "违规占 {v}",
    lgC: "合规",
    lgV: "违规",
    cal: "在这一基准率下，分数意味着什么",
    calX: "检测器分数 s",
    calY: "实际违规的比例",
    calBench: "平衡基准",
    calHere: "基准率 {pi}",
    calMark: "s = {s}：{p} 违规",
    ruleHead: "D_v：",
    ruleA: "s ≤ {a} 允许",
    ruleR: "{a} < s < {b} 审查",
    ruleB: "s ≥ {b} 阻止",
    ruleSep: "，",
    perClass: "按类别计算，与基准率无关：",
    recall: "召回率 R = P(阻止 | 违规) = {r}",
    fpr: "假阳性率 F = P(阻止 | 合规) = {f}",
    fnr: "漏检 P(允许 | 违规) = {fn}",
    precEq: "精确率 = πR / (πR + (1 − π)F) = {pi}·{r} / ({pi}·{r} + {q}·{f}) = {p}",
    precBench: "同样的阈值放到 50% 的基准率下：精确率 {p}",
    queue: "审查队列：{n} 条，占流量 {s}，其中违规 {v}",
    sel: "覆盖率 {c}（自动判定的比例），风险 {k}（自动判定中的错误率）",
    describe: "基准率 {pi}，阈值 {a} 和 {b}，检测器 AUROC {auc}：{pa} 的内容被允许，{pr} 进入审查，{pb} 被阻止。召回率 {r} 和假阳性率 {f} 与基准率无关，但被阻止的内容只有 {p} 违规，审查队列中违规的只占 {qv}。",
  },
};
type L = typeof labels.en;

// Percent with enough decimals to show small shares.
const pc = (v: number) => (v > 0 && v < 0.0001 ? "<0.01%" : pct(v, v > 0 && v < 0.001 ? 2 : v < 0.1 ? 1 : 0));
const tau = (v: number) => fixed(v, 2);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    pi: pc(p.base), a: tau(p.allow), b: tau(p.block), auc: fixed(p.auroc, 3),
    pa: pc(m.branch.allow.n / N), pr: pc(m.branch.review.n / N), pb: pc(m.branch.block.n / N),
    r: pc(m.v.block), f: pc(m.c.block), p: pc(m.precision),
    qv: pc(m.branch.review.n > 0 ? m.branch.review.viol / m.branch.review.n : 0),
  });
}

// ---------------------------------------------------------------- panels

// Wrap with a margin: the width estimate runs a little short for tabular
// digits and for semibold text.
function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

function distPanel(p: P, m: Model, L: L, lang: Lang, w: number, y0: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let ty = y0 + 13;
  for (const ln of lines(L.dist, TYPE.label, w, lang, true)) {
    parts.push(text(0, ty, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    ty += TYPE.label + 5;
  }
  // Branch names above the plot, each centered in its band; threshold values on
  // a second row at their cut, so the two rows never collide.
  const row1 = ty + 16, row2 = ty + 32;
  const top = ty + 40;
  const plotH = narrow ? 96 : 110;
  const base = top + plotH;
  const left = 4, right = w - 4;
  const x = logitScale(S_DOMAIN, [left, right]);
  const xa = x(p.allow), xb = x(Math.max(p.block, p.allow));
  parts.push(el("rect", { x: xa, y: top, width: Math.max(0, xb - xa), height: plotH, fill: C.panel }));
  parts.push(el("rect", { x: xb, y: top, width: right - xb, height: plotH, fill: C.ink3, "fill-opacity": 0.12 }));
  // Densities in logit(s): compliant N(−d²/2, d²), violating N(d²/2, d²).
  const mu = (m.d * m.d) / 2, sd = m.d;
  const l0 = logit(S_DOMAIN[0]), l1 = logit(S_DOMAIN[1]);
  const peak = normalPdf(0) / sd;
  const y = linear([0, peak * 1.08], [base, top]);
  const curve = (c: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 160; i++) {
      const l = l0 + ((l1 - l0) * i) / 160;
      pts.push([x(sigmoid(l)), y(normalPdf((l - c) / sd) / sd)]);
    }
    return pts;
  };
  const area = (pts: Array<[number, number]>) => `${linePath(pts)}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
  const cc = curve(-mu), cv = curve(mu);
  parts.push(el("path", { d: area(cc), fill: C.c1, "fill-opacity": 0.16 }), el("path", { d: linePath(cc), fill: "none", stroke: C.c1, "stroke-width": 1.8 }));
  parts.push(el("path", { d: area(cv), fill: C.c2, "fill-opacity": 0.2 }), el("path", { d: linePath(cv), fill: "none", stroke: C.c2, "stroke-width": 1.8 }));
  // Cuts.
  for (const [xx, label, anchorLeft] of [[xa, tpl(L.tauA, { v: tau(p.allow) }), true], [xb, tpl(L.tauB, { v: tau(p.block) }), false]] as const) {
    parts.push(el("line", { x1: xx, x2: xx, y1: row2 + 4, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));
    const tw = textWidth(label, size);
    // τ_allow reads leftward from its cut, τ_block rightward, unless the edge is too close.
    let anchor: "start" | "end" = anchorLeft ? "end" : "start";
    let tx = anchorLeft ? xx - 3 : xx + 3;
    if (anchor === "end" && tx - tw < left) { anchor = "start"; tx = xx + 3; }
    if (anchor === "start" && tx + tw > right) { anchor = "end"; tx = xx - 3; }
    parts.push(text(tx, row2, label, { "font-size": size, "text-anchor": anchor, class: "fig-t-num" }));
  }
  // Branch names centered in their bands where they fit.
  const bands: Array<[number, number, string]> = [[left, xa, L.allow], [xa, xb, L.review], [xb, right, L.block]];
  for (const [a, b, name] of bands) {
    const tw = textWidth(name, size);
    if (b - a < tw + 4) continue;
    parts.push(text((a + b) / 2, row1, name, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong" }));
  }
  // Each curve named inside its own fill, under its peak.
  const ly = base - plotH * 0.3;
  for (const [c, name] of [[-mu, L.lgC], [mu, L.lgV]] as const) {
    const cx = x(sigmoid(c));
    const tw = textWidth(name, size) * 1.12;
    const tx = Math.min(Math.max(cx, left + tw / 2 + 2), right - tw / 2 - 2);
    parts.push(text(tx, ly, name, { "font-size": size, "text-anchor": "middle", class: "fig-t-halo" }));
  }
  parts.push(axis({ scale: x, orient: "bottom", at: base, title: L.scoreAxis, size, format: (v) => sig(v, 4) }));
  const h = base - y0 + axisHeight(true, size);
  return { svg: g({}, ...parts), h };
}

function compPanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let yy = y0 + 13;
  for (const ln of lines(tpl(L.comp, { pi: pc(p.base) }), TYPE.label, w, lang, true)) {
    parts.push(text(x0, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    yy += TYPE.label + 5;
  }
  yy += 4;
  for (const k of ["allow", "review", "block"] as const) {
    const b = m.branch[k];
    const share = b.n > 0 ? b.viol / b.n : 0;
    yy += size;
    parts.push(text(x0, yy, tpl(L.compRow, { name: L[k], n: int(b.n) }), { "font-size": size, class: "fig-t-num" }));
    parts.push(text(x0 + w, yy, tpl(L.compShare, { v: pc(share) }), { "font-size": size, "text-anchor": "end", class: k === "block" ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    yy += 5;
    parts.push(el("rect", { x: x0, y: yy, width: w, height: 12, rx: 2, fill: C.c1, "fill-opacity": 0.5 }));
    const vw = share * w;
    if (vw > 0.3) parts.push(el("rect", { x: x0 + w - vw, y: yy, width: vw, height: 12, rx: vw > 3 ? 2 : 0, fill: C.c2 }));
    yy += 12 + 8;
  }
  const lg = legend([
    { label: L.lgC, swatch: { kind: "rect", fill: C.c1, opacity: 0.5 } },
    { label: L.lgV, swatch: { kind: "rect", fill: C.c2 } },
  ], x0, yy - 2, w, size);
  parts.push(lg.svg);
  yy += lg.height - 2;
  return { svg: g({}, ...parts), h: yy - y0 };
}

function calPanel(p: P, m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let yy = y0 + 13;
  for (const ln of lines(L.cal, TYPE.label, w, lang, true)) {
    parts.push(text(x0, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    yy += TYPE.label + 5;
  }
  const left = x0 + 44, right = x0 + w - 6;
  const top = yy + 16;
  const plotH = narrow ? 130 : 128;
  const base = top + plotH;
  const x = linear([0, 1], [left, right]);
  const y = linear([0, 1], [base, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: base, grid: [top, base], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], title: L.calX, size, format: (v) => fixed(v, 1) }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [0, 0.5, 1], title: L.calY, size, format: (v) => pct(v) }));
  parts.push(el("line", { x1: x(0), y1: y(0), x2: x(1), y2: y(1), stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 120; i++) {
    const s = 0.0005 + (0.999 * i) / 120;
    pts.push([x(s), y(sigmoid(logit(s) + logit(p.base)))]);
  }
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  // Marker at the block threshold.
  const mx = x(p.block), my = y(m.calAtBlock);
  parts.push(el("line", { x1: mx, x2: mx, y1: my, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx: mx, cy: my, r: 4.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  const ml = tpl(L.calMark, { s: tau(p.block), p: pc(m.calAtBlock) });
  const mw = textWidth(ml, size) * 1.15; // semibold halo text runs wider than the estimate
  const above = my - 8 > top + size;
  const mxText = Math.min(Math.max(mx - mw / 2, left + 2), right - mw);
  parts.push(text(mxText, above ? my - 8 : my + size + 6, ml, { "font-size": size, class: "fig-t-halo fig-t-num" }));
  yy = base + axisHeight(true, size);
  const lg = legend([
    { label: L.calBench, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
    { label: tpl(L.calHere, { pi: pc(p.base) }), swatch: { kind: "line", stroke: C.ink } },
  ], x0, yy, w, size);
  parts.push(lg.svg);
  yy += lg.height;
  return { svg: g({}, ...parts), h: yy - y0 };
}

function readout(p: P, m: Model, L: L, lang: Lang, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let yy = y0 + 12;
  const put = (s: string, cls: string, sz: number = size, gap = 3) => {
    for (const ln of lines(s, sz, w, lang, cls.includes("strong"))) {
      parts.push(text(0, yy, ln, { "font-size": sz, class: cls }));
      yy += sz + 5;
    }
    yy += gap;
  };
  // The decision rule: one line on desktop, one branch per line on a phone.
  const tv = { a: tau(p.allow), b: tau(p.block) };
  const items = [tpl(L.ruleA, tv), tpl(L.ruleR, tv), tpl(L.ruleB, tv)];
  const ruleLines = narrow
    ? [L.ruleHead + items[0] + L.ruleSep.trimEnd(), items[1] + L.ruleSep.trimEnd(), items[2]]
    : [L.ruleHead + items.join(L.ruleSep)];
  for (const ln of ruleLines) {
    parts.push(text(0, yy, ln, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
    yy += TYPE.body + 5;
  }
  yy += 3;
  put(L.perClass, "fig-t-muted", size, 0);
  put(tpl(L.recall, { r: pc(m.v.block) }), "fig-t-num", size, 0);
  put(tpl(L.fpr, { f: pc(m.c.block) }), "fig-t-num", size, 0);
  put(tpl(L.fnr, { fn: pc(m.v.allow) }), "fig-t-num");
  put(tpl(L.precEq, { pi: sig(p.base, 3), r: sig(m.v.block, 3), q: sig(1 - p.base, 3), f: sig(m.c.block, 3), p: pc(m.precision) }), "fig-t-strong fig-t-num");
  put(tpl(L.precBench, { p: pc(m.benchPrecision) }), "fig-t-muted fig-t-num");
  const q = m.branch.review;
  put(tpl(L.queue, { n: int(q.n), s: pc(q.n / N), v: pc(q.n > 0 ? q.viol / q.n : 0) }), "fig-t-num");
  put(tpl(L.sel, { c: pc(m.coverage), k: pc(m.risk) }), "fig-t-muted fig-t-num");
  return { svg: g({ class: "fig-readout" }, ...parts), h: yy - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  let y = 0;
  const dp = distPanel(p, m, L, lang, w, y, narrow);
  parts.push(dp.svg);
  y += dp.h + 14;
  if (narrow) {
    const cp = compPanel(p, m, L, lang, 0, y, w, true);
    parts.push(cp.svg);
    y += cp.h + 16;
    const kp = calPanel(p, m, L, lang, 0, y, w, true);
    parts.push(kp.svg);
    y += kp.h + 12;
  } else {
    const lw = Math.floor(w * 0.5);
    const cp = compPanel(p, m, L, lang, 0, y, lw, false);
    const kp = calPanel(p, m, L, lang, lw + 28, y, w - lw - 28, false);
    parts.push(cp.svg, kp.svg);
    y += Math.max(cp.h, kp.h) + 12;
  }
  const ro = readout(p, m, L, lang, y, w, narrow);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "guard-thresholds",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    base: {
      kind: "range", scale: "log", label: { en: "Violation base rate π", zh: "违规基准率 π" },
      min: 0.001, max: 0.5, default: 0.01,
      marks: [{ value: 0.5, label: { en: "balanced benchmark", zh: "平衡基准" } }],
    },
    allow: { kind: "range", label: { en: "Allow at or below τ_allow", zh: "不高于 τ_allow 时允许" }, min: 0.01, max: 0.99, step: 0.01, default: 0.2 },
    block: { kind: "range", label: { en: "Block at or above τ_block", zh: "不低于 τ_block 时阻止" }, min: 0.01, max: 0.99, step: 0.01, default: 0.8 },
    auroc: {
      kind: "range", label: { en: "Detector quality (AUROC)", zh: "检测器质量（AUROC）" }, min: 0.7, max: 0.995, step: 0.005, default: 0.98,
    },
  },
  // The lower threshold never exceeds the upper one: moving either past the
  // other carries the other along.
  update(p, key) {
    if (key === "allow" && p.allow > p.block) return { ...p, block: p.allow };
    if (key === "block" && p.block < p.allow) return { ...p, allow: p.block };
    return p;
  },
  render,
  describe,
});
