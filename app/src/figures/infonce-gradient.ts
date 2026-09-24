// The InfoNCE loss of one query and the gradient it puts on the query vector,
// on two-dimensional unit vectors.
//
// The query u sits at the top of the unit circle, the positive 20 degrees to
// its right, and 16 negatives at seeded angles; one of them starts 30 degrees
// to the right, beyond the positive, and the rest between 40 and 180 degrees
// on either side.
// Hardness h moves every negative's angle toward the query by the same
// fraction, theta_j = (1 - h) theta_j0. Scores are cosines s_j = u·v_j, and
// with temperature tau
//
//   p_j = softmax_j(s_j / tau),   L = -log p_+,
//   -tau dL/du = (1 - p_+) v_+ - sum_{j != +} p_j v_j
//              = (1 - p_+)(v_+ - u) + sum_{j != +} p_j (u - v_j),
//
// the second line because the negative weights sum to 1 - p_+. So the descent
// direction on u splits exactly into a pull along the chord to the positive,
// weighted 1 - p_+, and a push along the chord away from each negative,
// weighted p_j; the arrows draw those terms at one common scale, without the
// factor 1/tau. With the toggle on, the nearest negative is marked as a
// relevant document that the labels call negative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

type V = [number, number];
type P = { hardness: number; tau: number; falseNeg: boolean; seed: number };

const NEG = 16;
const Q: V = [0, 1]; // the query, at the top of the circle

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];

interface Cand { v: V; s: number; p: number; pos: boolean; fn: boolean; idx: number }

const deg = Math.PI / 180;
const POS_ANGLE = 20; // degrees right of the query
const FN_ANGLE = 30; // the near negative, beyond the positive on the same side
// A candidate at angle theta (degrees, positive to the right) from the query.
const at = (theta: number): V => [Math.sin(theta * deg), Math.cos(theta * deg)];

function baseAngles(seed: number): number[] {
  const u = rng(seed);
  return [FN_ANGLE, ...Array.from({ length: NEG - 1 }, () => (u() < 0.5 ? -1 : 1) * (40 + 140 * u()))];
}

function model(p: P) {
  const base = baseAngles(p.seed);
  const pos = at(POS_ANGLE);
  const vs: Array<{ v: V; pos: boolean; idx: number }> = [{ v: pos, pos: true, idx: -1 }, ...base.map((th, j) => ({ v: at((1 - p.hardness) * th), pos: false, idx: j }))];
  const fnIdx = 0;
  const logits = vs.map((c) => dot(c.v, Q) / p.tau);
  const mx = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - mx));
  const z = e.reduce((a, b) => a + b, 0);
  const cands: Cand[] = vs.map((c, i) => ({ ...c, s: dot(c.v, Q), p: e[i] / z, fn: p.falseNeg && c.idx === fnIdx }));
  const pp = cands[0].p;
  const negs = cands.slice(1);
  const hardest = negs.reduce((a, b) => (b.s > a.s ? b : a));
  // Terms of -tau dL/du: pull, pushes, and their sum.
  const pull: V = [(1 - pp) * (pos[0] - Q[0]), (1 - pp) * (pos[1] - Q[1])];
  const pushes = negs.map((c) => ({ c, v: [c.p * (Q[0] - c.v[0]), c.p * (Q[1] - c.v[1])] as V }));
  const net: V = [pull[0] + pushes.reduce((a, b) => a + b.v[0], 0), pull[1] + pushes.reduce((a, b) => a + b.v[1], 0)];
  const fn = negs.find((c) => c.fn) ?? null;
  return { cands, pp, loss: -Math.log(pp), hardest, pull, pushes, net, fn, negMass: 1 - pp };
}

const labels = {
  en: {
    title: "The contrastive loss and its gradient on the query",
    circle: "Unit vectors, scores s = u·v",
    query: "query u",
    positive: "positive v₊",
    relevant: "relevant, labeled negative",
    negatives: "negatives, area ∝ p_j",
    pull: "pull toward the positive, weight 1 − p₊",
    push: "push away from each negative, weight p_j",
    pushFn: "push away from the relevant candidate",
    net: "sum: the descent direction on u",
    bars: "Softmax weight p_j of each candidate",
    barsX: "candidates, highest score first",
    barsY: "p_j",
    rLoss: "L = −log p₊ = −log {pp} = {L}",
    rScores: "Positive: s = {sp}, p = {pp}. Hardest negative: s = {sh}, p = {ph}.",
    rShare: "The negatives hold 1 − p₊ = {m} of the weight, {share} of it on the hardest one.",
    rFn: "The marked candidate is relevant but labeled negative, and holds {share} of the negative weight: its push moves u away from a correct answer.",
    ledger: "Movement of u along the circle",
    ledgerNote: "tangential part of each term; right is toward the positive",
    lPull: "pull",
    lFn: "push, relevant",
    lOthers: "push, other negatives",
    lNegs: "push, negatives",
    lNet: "net",
    describe: "Hardness {h}, temperature {tau}: loss {L}, positive weight {pp}, hardest negative weight {ph}, {share} of all negative weight. The query's movement along the circle is {net}, where positive values point toward the positive.{fn}",
    fnDescribe: " The relevant candidate labeled negative holds {share} of the negative weight and pushes the query {fnt}.",
  },
  zh: {
    title: "对比损失及其作用在查询上的梯度",
    circle: "单位向量，得分 s = u·v",
    query: "查询 u",
    positive: "正样本 v₊",
    relevant: "相关，却标为负样本",
    negatives: "负样本，面积 ∝ p_j",
    pull: "拉向正样本，权重 1 − p₊",
    push: "推离每个负样本，权重 p_j",
    pushFn: "推离那个相关候选",
    net: "合力：u 的下降方向",
    bars: "每个候选的 softmax 权重 p_j",
    barsX: "候选，按得分从高到低",
    barsY: "p_j",
    rLoss: "L = −log p₊ = −log {pp} = {L}",
    rScores: "正样本：s = {sp}，p = {pp}。最难的负样本：s = {sh}，p = {ph}。",
    rShare: "负样本合计占权重 1 − p₊ = {m}，其中 {share} 落在最难的那一个上。",
    rFn: "被标记的候选其实相关，却被标为负样本，占负样本权重的 {share}：它的推力把 u 推离一个正确答案。",
    ledger: "u 沿圆周的移动",
    ledgerNote: "各项的切向分量；向右即朝向正样本",
    lPull: "拉力",
    lFn: "推力，相关候选",
    lOthers: "推力，其余负样本",
    lNegs: "推力，负样本",
    lNet: "合计",
    describe: "难度 {h}，温度 {tau}：损失 {L}，正样本权重 {pp}，最难负样本权重 {ph}，占全部负样本权重的 {share}。查询沿圆周的移动为 {net}，正值表示朝向正样本。{fn}",
    fnDescribe: "被标为负样本的相关候选占负样本权重的 {share}，把查询推动 {fnt}。",
  },
};
type L = typeof labels.en;

const f2 = (v: number) => fixed(v, 2);
const pctp = (v: number) => (v < 0.001 ? "<0.1%" : pct(v, v < 0.1 ? 1 : 0));

function pushShare(m: ReturnType<typeof model>, c: Cand | null): number {
  return c && m.negMass > 0 ? c.p / m.negMass : 0;
}

// Tangential components at the query (the tangent there is +x): what survives
// renormalizing u. Positive values move u toward the positive.
function tangential(m: ReturnType<typeof model>) {
  const fnPush = m.pushes.find((e) => e.c.fn);
  const others = m.pushes.filter((e) => !e.c.fn).reduce((a, e) => a + e.v[0], 0);
  return { pull: m.pull[0], fn: fnPush ? fnPush.v[0] : 0, others, net: m.net[0] };
}
const signed = (v: number) => (v >= 0 ? "+" : "−") + fixed(Math.abs(v), 3);

function ledgerPanel(m: ReturnType<typeof model>, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.ledger, { "font-size": TYPE.label, class: "fig-t-strong" })];
  let y = y0 + 20;
  for (const ln of wrap(Lx.ledgerNote, TYPE.body, w)) { parts.push(text(x0, y + 12, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 16; }
  y += 6;
  const t = tangential(m);
  const rows: Array<[string, number, string]> = [[Lx.lPull, t.pull, C.c1]];
  if (m.fn) rows.push([Lx.lFn, t.fn, C.bad], [Lx.lOthers, t.others, C.c2]);
  else rows.push([Lx.lNegs, t.others, C.c2]);
  rows.push([Lx.lNet, t.net, C.ink]);
  const nameW = Math.max(...rows.map((r) => textWidth(r[0], TYPE.body))) + 10;
  const valW = 48;
  const x1 = x0 + nameW, x2 = x0 + w - valW;
  const mid = (x1 + x2) / 2;
  const span = Math.max(1e-6, ...rows.map((r) => Math.abs(r[1])));
  const scale = (x2 - x1) / 2 / span;
  const top = y;
  rows.forEach(([name, v, col], i) => {
    if (i === rows.length - 1) { parts.push(el("line", { x1, x2, y1: y - 2, y2: y - 2, stroke: C.grid })); y += 4; }
    parts.push(text(x0, y + 12, name, { "font-size": TYPE.body, class: i === rows.length - 1 ? "fig-t-strong" : undefined }));
    const bx = v >= 0 ? mid : mid + v * scale;
    parts.push(el("rect", { x: bx, y: y + 2, width: Math.max(1, Math.abs(v) * scale), height: 12, rx: 2, fill: col }));
    parts.push(text(x0 + w, y + 12, signed(v), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += 18;
  });
  parts.push(el("line", { x1: mid, x2: mid, y1: top - 2, y2: y, stroke: C.rule }));
  return { svg: g({ class: "fig-ledger" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const m = model(p);
  const t = tangential(m);
  return tpl(Lx.describe, {
    h: f2(p.hardness), tau: fixed(p.tau, 3), L: f2(m.loss), pp: pctp(m.pp), ph: pctp(m.hardest.p), share: pctp(pushShare(m, m.hardest)),
    net: signed(t.net),
    fn: m.fn ? tpl(Lx.fnDescribe, { share: pctp(pushShare(m, m.fn)), fnt: signed(t.fn) }) : "",
  });
}

function arrow(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number, opacity = 1): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1.5) return "";
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const hs = Math.min(7, 3 + width * 1.6, len * 0.6);
  const bx = x2 - ux * hs, by = y2 - uy * hs;
  return el("line", { x1, y1, x2: bx, y2: by, stroke, "stroke-width": width, "stroke-opacity": opacity, "stroke-linecap": "round" })
    + el("path", { d: `M${x2},${y2}L${bx - uy * hs * 0.55},${by + ux * hs * 0.55}L${bx + uy * hs * 0.55},${by - ux * hs * 0.55}Z`, fill: stroke, "fill-opacity": opacity });
}

const ARROW = 2.4; // arrow pixels per unit of the gradient terms, in circle radii

function circlePanel(p: P, m: ReturnType<typeof model>, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.circle, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const R = Math.min(112, (w - 24) / 2);
  const cx = x0 + w / 2, cy = y0 + 40 + R * 0.35 + R; // headroom above the query for the pushes
  const X = (v: V) => cx + v[0] * R, Y = (v: V) => cy - v[1] * R;
  parts.push(el("circle", { cx, cy, r: R, fill: "none", stroke: C.rule, "stroke-width": 1 }));
  parts.push(el("circle", { cx, cy, r: 2, fill: C.ink3 }));
  // Candidates: marker area follows the softmax weight.
  const maxNeg = Math.max(...m.cands.slice(1).map((c) => c.p));
  const rOf = (c: Cand) => 2.5 + 6.5 * Math.sqrt(c.p / Math.max(maxNeg, 1e-12));
  for (const c of [...m.cands.slice(1)].sort((a, b) => a.p - b.p)) {
    parts.push(el("circle", { cx: X(c.v), cy: Y(c.v), r: rOf(c), fill: c.fn ? C.bad : C.c2, "fill-opacity": 0.9, stroke: C.paper, "stroke-width": 1 }));
  }
  const pos = m.cands[0];
  parts.push(el("circle", { cx: X(pos.v), cy: Y(pos.v), r: 6.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
  // Arrows at the query.
  const qx = X(Q), qy = Y(Q);
  const tip = (v: V): [number, number] => [qx + v[0] * R * ARROW, qy - v[1] * R * ARROW];
  for (const { c, v } of m.pushes) {
    if (c.fn) continue;
    const [tx, ty] = tip(v);
    parts.push(arrow(qx, qy, tx, ty, C.c2, 1.6, 0.35 + 0.65 * (c.p / Math.max(maxNeg, 1e-12))));
  }
  const fnPush = m.pushes.find((e) => e.c.fn);
  if (fnPush) { const [tx, ty] = tip(fnPush.v); parts.push(arrow(qx, qy, tx, ty, C.bad, 2.4)); }
  { const [tx, ty] = tip(m.pull); parts.push(arrow(qx, qy, tx, ty, C.c1, 2.4)); }
  { const [tx, ty] = tip(m.net); parts.push(arrow(qx, qy, tx, ty, C.ink, 2.6)); }
  parts.push(el("circle", { cx: qx, cy: qy, r: 5.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  let y = cy + R + 24;
  // Legend: the markers, then the arrow terms.
  const marks: Array<[string, string, number]> = [[Lx.query, C.ink, 5.5], [Lx.positive, C.c1, 6.5], [Lx.negatives, C.c2, 5]];
  if (m.fn) marks.push([Lx.relevant, C.bad, 5]);
  let lx = x0;
  for (const [s, col, r] of marks) {
    const iw = 16 + textWidth(s, TYPE.body);
    if (lx > x0 && lx + iw > x0 + w) { lx = x0; y += 18; }
    parts.push(el("circle", { cx: lx + 6, cy: y - 4, r, fill: col }));
    parts.push(text(lx + 16, y, s, { "font-size": TYPE.body }));
    lx += iw + 14;
  }
  y += 22;
  const items: Array<[string, string, number]> = [[Lx.pull, C.c1, 2.4], [Lx.push, C.c2, 1.6]];
  if (m.fn) items.push([Lx.pushFn, C.bad, 2.4]);
  items.push([Lx.net, C.ink, 2.6]);
  for (const [s, col, sw] of items) {
    parts.push(arrow(x0, y - 4, x0 + 22, y - 4, col, sw));
    const lines = wrap(s, TYPE.body, w - 30);
    lines.forEach((ln, i) => parts.push(text(x0 + 30, y + i * 16, ln, { "font-size": TYPE.body })));
    y += 16 * lines.length + 4;
  }
  return { svg: g({ class: "fig-circle" }, ...parts), h: y - y0 };
}

function barPanel(p: P, m: ReturnType<typeof model>, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.bars, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const sorted = [...m.cands].sort((a, b) => b.s - a.s);
  const left = x0 + 36, right = x0 + w - 4, top = y0 + 28, h = 120;
  const y = linear([0, 1], [top + h, top]);
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [0, 0.5, 1], size: TYPE.body }));
  const bw = (right - left) / sorted.length;
  sorted.forEach((c, i) => {
    const bx = left + i * bw + 1;
    const fill = c.pos ? C.c1 : c.fn ? C.bad : C.c2;
    const bh = Math.max(c.p > 0.0005 ? 1 : 0, (top + h) - y(c.p));
    parts.push(el("rect", { x: bx, y: top + h - bh, width: Math.max(1, bw - 2), height: bh, fill }));
  });
  parts.push(el("line", { x1: left, x2: right, y1: top + h, y2: top + h, stroke: C.rule }));
  parts.push(text((left + right) / 2, top + h + 18, Lx.barsX, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  return { svg: g({ class: "fig-bars" }, ...parts), h: h + 28 + 24 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  let leftH = 0;
  let rx = 0, rw = w, ry: number;
  if (narrow) {
    const c = circlePanel(p, m, 0, 0, w, Lx);
    parts.push(c.svg);
    const b = barPanel(p, m, 0, c.h + 12, w, Lx);
    const l = ledgerPanel(m, 0, c.h + 12 + b.h + 6, w, Lx);
    parts.push(b.svg, l.svg);
    ry = c.h + 12 + b.h + 6 + l.h + 12;
  } else {
    const cw = Math.floor(w * 0.5);
    const c = circlePanel(p, m, 0, 0, cw, Lx);
    rx = cw + 24; rw = w - rx;
    const b = barPanel(p, m, rx, 0, rw, Lx);
    const l = ledgerPanel(m, rx, b.h + 6, rw, Lx);
    parts.push(c.svg, b.svg, l.svg);
    ry = b.h + 6 + l.h + 12;
    leftH = c.h;
  }
  // Readout: the equation's terms.
  const lines = [
    tpl(Lx.rLoss, { pp: f2(m.pp), L: f2(m.loss) }),
    tpl(Lx.rScores, { sp: f2(m.cands[0].s), pp: pctp(m.pp), sh: f2(m.hardest.s), ph: pctp(m.hardest.p) }),
    tpl(Lx.rShare, { share: pctp(pushShare(m, m.hardest)), m: f2(m.negMass) }),
  ];
  if (m.fn) lines.push(tpl(Lx.rFn, { share: pctp(pushShare(m, m.fn)) }));
  let yy = ry;
  lines.forEach((ln, i) => {
    for (const part of wrap(ln, TYPE.body, rw)) {
      parts.push(text(rx, yy + 12, part, { "font-size": TYPE.body, class: i === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
      yy += 17;
    }
    yy += 4;
  });
  const h = Math.max(yy, leftH) + 4;
  return svg(w, h, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "infonce-gradient",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    hardness: { kind: "range", label: { en: "Negative hardness h", zh: "负样本难度 h" }, min: 0, max: 0.9, step: 0.05, default: 0.6 },
    tau: { kind: "range", scale: "log", label: { en: "Temperature τ", zh: "温度 τ" }, min: 0.02, max: 1, default: 0.08,
      marks: [{ value: 0.08, label: { en: "code cell", zh: "代码单元" } }] },
    falseNeg: { kind: "toggle", label: { en: "One near negative is actually relevant", zh: "有一个近处的负样本其实相关" }, default: true },
    seed: { kind: "range", label: { en: "Sample seed", zh: "采样种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  render,
  describe,
});
