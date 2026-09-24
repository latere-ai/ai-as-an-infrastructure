// Superposition in the toy model of Elhage et al. (2022), "Toy Models of
// Superposition": m = 5 sparse features written into d = 2 hidden dimensions.
// In the chapter's notation the hidden vector is the sparse linear model
//
//   h = V a = Σ_i a_i v_i,   â = ReLU(Vᵀ h + b),
//
// where a_i is 0 with probability S and uniform on [0, 1] otherwise, the
// columns v_i of V are the feature directions, and training minimizes
// E[Σ_i I_i (a_i − â_i)²] with importance I_i = r^(i−1).
//
// GRID holds, for 1 − S on a 1/10-decade grid from 1 to 0.01 and r in
// {0.9, 0.8, 0.7}, the lowest-loss solution of 17 seeded runs (Adam, 6000
// steps): 16 random starts and one start from the next denser grid point's
// solution. It is rotated so v_1 lies on +x and reflected so v_2 has y >= 0
// (the loss is invariant to both). `loss` is the held-out loss divided by the loss of
// reading back 0 for every feature. tools/figure-data/superposition-toy.py
// regenerates GRID (numpy 2.3.2). The page computes the readback table and the
// arrangement from V and b.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, CATEGORICAL, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, wrap, type Box, type LabelRequest, type Side } from "./lib/labels.ts";
import { fixed as fixedRaw, sig, tpl } from "./lib/format.ts";

// Two decimals without a negative zero.
const fixed = (v: number, d: number) => fixedRaw(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v, d);

const M = 5; // features
const STORED = 0.5; // a feature counts as stored when ‖v_i‖ exceeds this
const RATIOS = ["0.9", "0.8", "0.7"] as const;
type Ratio = (typeof RATIOS)[number];
interface Solution { dens: number; vx: number[]; vy: number[]; b: number[]; loss: number }

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => String(n).split("").map((c) => SUB[Number(c)]).join("");
const vName = (i: number) => `v${sub(i + 1)}`;

type Arrangement = "none" | "one" | "orth" | "anti" | "penta" | "other";
interface Model {
  s: Solution;
  norms: number[];
  stored: number[]; // indices of stored features
  arr: Arrangement;
  dot(i: number, j: number): number;
}

function nearest(r: Ratio, dens: number): Solution {
  let best = GRID[r][0], bd = Infinity;
  for (const s of GRID[r]) {
    const d = Math.abs(Math.log10(s.dens) - Math.log10(dens));
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function analyze(s: Solution): Model {
  const norms = s.vx.map((x, i) => Math.hypot(x, s.vy[i]));
  const stored = norms.map((n, i) => (n > STORED ? i : -1)).filter((i) => i >= 0);
  const dot = (i: number, j: number) => s.vx[i] * s.vx[j] + s.vy[i] * s.vy[j];
  const cos = (i: number, j: number) => dot(i, j) / (norms[i] * norms[j]);
  const n = stored.length;
  let arr: Arrangement = n === 0 ? "none" : n === 1 ? "one" : "other";
  if (n === 2 && Math.abs(cos(stored[0], stored[1])) < 0.1) arr = "orth";
  if (n === 4 && stored.every((i) => stored.some((j) => j !== i && cos(i, j) < -0.95))) arr = "anti";
  if (n === 5) {
    const ang = stored.map((i) => Math.atan2(s.vy[i], s.vx[i])).sort((a, b) => a - b);
    const gaps = ang.map((a, k) => (k + 1 < ang.length ? ang[k + 1] - a : ang[0] + 2 * Math.PI - a));
    if (gaps.every((gp) => Math.abs(gp - (2 * Math.PI) / 5) < 0.3)) arr = "penta";
  }
  return { s, norms, stored, arr, dot };
}

const models = new Map<Solution, Model>();
function modelOf(s: Solution): Model {
  let m = models.get(s);
  if (!m) { m = analyze(s); models.set(s, m); }
  return m;
}

// Readback of every feature when feature p alone is active at a_p = 1: h = v_p.
function readback(md: Model, p: number) {
  return Array.from({ length: M }, (_, j) => {
    const vh = md.dot(j, p);
    const pre = vh + md.s.b[j];
    return { vh, b: md.s.b[j], pre, out: Math.max(0, pre) };
  });
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Superposition in a toy model",
    plane: "Feature directions vᵢ in the hidden plane h ∈ ℝ²",
    planeShort: "Feature directions vᵢ, h ∈ ℝ²",
    unit: "dashed circle: ‖v‖ = 1",
    probe: "Only feature {p} active: a{ps} = 1, so h = v{ps}",
    colFeature: "feature",
    colI: "I",
    colVh: "v·h",
    colB: "+ b",
    colOut: "readback â = ReLU(v·h + b)",
    colOutShort: "â = ReLU(v·h + b)",
    target: "target",
    clipped: "below 0, zeroed by ReLU",
    none: "no feature stored",
    one: "a single direction",
    orth: "two orthogonal directions",
    anti: "two antipodal pairs",
    penta: "a pentagon",
    other: "{n} directions in no regular pattern",
    stored: "{n} of 5 features stored in 2 dimensions: {arr}",
    notStored: "not stored (‖vᵢ‖ < 0.5): {list}",
    model: "h = Σ aᵢvᵢ,  â = ReLU(Vᵀh + b),  Iᵢ = rⁱ⁻¹",
    loss: "loss Σ Iᵢ(aᵢ − âᵢ)² = {l} (1 = reading back 0 for every feature)",
    strip: "Features stored at each sparsity, r = {r}",
    stripX: "1 − S, chance a feature is active (log scale)",
    stripY: "features stored",
    dims: "d = 2",
    others: "dashed: r = {list}",
    describe: "Toy model with 5 features in 2 dimensions, each active with probability {d}, importance ratio {r}: the lowest-loss solution stores {n} of 5 features as {arr}. With feature {p} alone active, its readback is {self} and the largest readback of another feature is {leak}.",
  },
  zh: {
    title: "玩具模型中的叠加",
    plane: "隐藏平面 h ∈ ℝ² 中的特征方向 vᵢ",
    planeShort: "特征方向 vᵢ，h ∈ ℝ²",
    unit: "虚线圆：‖v‖ = 1",
    probe: "只激活特征 {p}：a{ps} = 1，此时 h = v{ps}",
    colFeature: "特征",
    colI: "I",
    colVh: "v·h",
    colB: "+ b",
    colOut: "读出 â = ReLU(v·h + b)",
    colOutShort: "â = ReLU(v·h + b)",
    target: "目标",
    clipped: "小于 0，被 ReLU 置零",
    none: "没有存下任何特征",
    one: "一个方向",
    orth: "两个正交方向",
    anti: "两对反向方向",
    penta: "正五边形",
    other: "{n} 个方向，没有规则形状",
    stored: "2 个维度存下 5 个特征中的 {n} 个：{arr}",
    notStored: "未存下（‖vᵢ‖ < 0.5）：{list}",
    model: "h = Σ aᵢvᵢ，â = ReLU(Vᵀh + b)，Iᵢ = rⁱ⁻¹",
    loss: "损失 Σ Iᵢ(aᵢ − âᵢ)² = {l}（以全部读出 0 时的损失为 1）",
    strip: "不同稀疏度下存下的特征数，r = {r}",
    stripX: "1 − S，特征处于活跃状态的概率（对数刻度）",
    stripY: "存下的特征数",
    dims: "d = 2",
    others: "虚线：r = {list}",
    describe: "玩具模型，2 个维度、5 个特征，每个特征活跃的概率为 {d}，重要性衰减比 r = {r}：损失最低的解存下 5 个特征中的 {n} 个：{arr}。只激活特征 {p} 时，它的读出为 {self}，其他特征的读出最大为 {leak}。",
  },
};

type P = { density: number; ratio: Ratio; probe: number };

function arrangementText(md: Model, L: typeof labels.en): string {
  return md.arr === "other" ? tpl(L.other, { n: md.stored.length }) : L[md.arr];
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const md = modelOf(nearest(p.ratio, p.density));
  const probe = p.probe - 1;
  const rb = readback(md, probe);
  const leak = Math.max(...rb.filter((_, j) => j !== probe).map((x) => x.out));
  return tpl(L.describe, {
    d: sig(md.s.dens, 2), r: p.ratio, n: md.stored.length, arr: arrangementText(md, L),
    p: p.probe, self: fixed(rb[probe].out, 2), leak: fixed(leak, 2),
  });
}

// ---------------------------------------------------------------- render

const BAR_MIN = -1.3, BAR_MAX = 1.3; // bars past this range are clipped at the edge

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const md = modelOf(nearest(p.ratio, p.density));
  const s = md.s;
  const probe = p.probe - 1;
  const rb = readback(md, probe);
  const hatchId = `${st.uid}-relu`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 4, 1))];

  // ---- the hidden plane
  const PW = narrow ? Math.min(w, 300) : Math.min(290, Math.floor(w * 0.46));
  const px0 = narrow ? (w - PW) / 2 : 0;
  parts.push(text(narrow ? 0 : px0, 14, narrow ? L.planeShort : L.plane, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const cx = px0 + PW / 2, cy = 30 + PW / 2;
  const unit = (PW / 2 - 26) / 1.2;
  parts.push(el("line", { x1: px0 + 6, x2: px0 + PW - 6, y1: cy, y2: cy, stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("line", { x1: cx, x2: cx, y1: cy - PW / 2 + 6, y2: cy + PW / 2 - 6, stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("circle", { cx, cy, r: unit, fill: "none", stroke: C.rule, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const obstacles: Box[] = [];
  const reqs: LabelRequest[] = [];
  const arrows: string[] = [];
  for (let i = 0; i < M; i++) {
    if (md.norms[i] < 0.08) continue;
    const tx = cx + s.vx[i] * unit, ty = cy - s.vy[i] * unit;
    const sel = i === probe;
    arrows.push(el("line", { x1: cx, y1: cy, x2: tx, y2: ty, stroke: CATEGORICAL[i], "stroke-width": sel ? 3.5 : 2.5, "stroke-linecap": "round" }));
    if (sel) arrows.push(el("circle", { cx: tx, cy: ty, r: 8.5, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    arrows.push(el("circle", { cx: tx, cy: ty, r: 4.5, fill: CATEGORICAL[i], stroke: C.paper, "stroke-width": 1 }));
    arrows.push(el("line", { x1: cx, y1: cy, x2: tx, y2: ty, stroke: "transparent", "stroke-width": 16, "data-fig-set": `probe=${i + 1}`, class: "fig-hit" }));
    obstacles.push(...lineObstacles([[cx, cy], [tx, ty]], 6, 2), { x0: tx - 7, y0: ty - 7, x1: tx + 7, y1: ty + 7 });
    const ux = s.vx[i] / md.norms[i], uy = -s.vy[i] / md.norms[i];
    const sides: Side[] = Math.abs(ux) > Math.abs(uy)
      ? (ux > 0 ? ["right", uy < 0 ? "above-right" : "below-right", "above", "below"] : ["left", uy < 0 ? "above-left" : "below-left", "above", "below"])
      : (uy < 0 ? ["above", ux > 0 ? "above-right" : "above-left", "right", "left"] : ["below", ux > 0 ? "below-right" : "below-left", "right", "left"]);
    reqs.push({ x: tx, y: ty, text: vName(i), size: fs, sides, gap: sel ? 15 : 9, priority: sel ? 3 : 2 - md.norms[i] / 10, attrs: { class: sel ? "fig-t-halo" : "fig-t-halo fig-t-soft" } });
  }
  parts.push(g({}, ...arrows));
  const placed = placeLabels(reqs, { x0: px0, y0: 20, x1: px0 + PW, y1: cy + PW / 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  const unitY = cy + PW / 2 + 12;
  parts.push(text(px0 + (narrow ? PW / 2 : 0), unitY, L.unit, { "font-size": fs, class: "fig-t-muted", "text-anchor": narrow ? "middle" : "start" }));
  const planeBottom = unitY + 4;

  // ---- readback table for one active feature
  const tx0 = narrow ? 0 : PW + 28;
  const tw = w - tx0;
  let ty = narrow ? planeBottom + 30 : 14;
  const tp: string[] = [];
  for (const line of wrap(tpl(L.probe, { p: p.probe, ps: sub(p.probe) }), TYPE.label, tw)) {
    tp.push(text(tx0, ty, line, { "font-size": TYPE.label, class: "fig-t-strong" }));
    ty += 18;
  }
  ty += 6;
  const cName = tx0, cI = tx0 + (narrow ? 72 : 84), cVh = cI + 46, cB = cVh + 44;
  const cOut = tx0 + tw;
  const barX0 = cB + 12, barX1 = cOut - 40;
  const xb = linear([BAR_MIN, BAR_MAX], [barX0, barX1]);
  const head = narrow || textWidth(L.colOut, fs) > barX1 - barX0 + 40 ? L.colOutShort : L.colOut;
  tp.push(text(cName, ty, L.colFeature, { "font-size": fs, class: "fig-t-muted" }));
  tp.push(text(cI, ty, L.colI, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  tp.push(text(cVh, ty, L.colVh, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  tp.push(text(cB, ty, L.colB, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  tp.push(text(cOut, ty, head, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  ty += 8;
  const rowH = 26;
  const I = (i: number) => Number(p.ratio) ** i;
  const rowsTop = ty;
  for (let j = 0; j < M; j++) {
    const yy = rowsTop + j * rowH;
    const r = rb[j];
    const sel = j === probe;
    tp.push(el("line", { x1: tx0, x2: cOut, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    if (sel) tp.push(el("rect", { x: tx0, y: yy + 1, width: tw, height: rowH - 2, rx: 3, fill: C.panel }));
    tp.push(el("rect", { x: cName, y: yy + 8, width: 10, height: 10, rx: 2, fill: CATEGORICAL[j] }));
    const faint = md.norms[j] < STORED;
    tp.push(text(cName + 16, yy + 17, vName(j), { "font-size": fs, class: sel ? "fig-t-strong" : faint ? "fig-t-faint" : undefined }));
    tp.push(text(cI, yy + 17, sig(I(j), 3), { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    tp.push(text(cVh, yy + 17, fixed(r.vh, 2), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
    tp.push(text(cB, yy + 17, fixed(r.b, 2), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
    // Pre-activation v·h + b from zero; the part below zero is what ReLU removes.
    const x0 = xb(0), xPre = xb(Math.max(BAR_MIN, Math.min(BAR_MAX, r.pre)));
    const by = yy + 7, bh = rowH - 14;
    if (r.pre < 0) tp.push(el("rect", { x: xPre, y: by, width: Math.max(0, x0 - xPre), height: bh, fill: `url(#${hatchId})`, stroke: C.ink3, "stroke-width": 0.75 }));
    else if (xPre - x0 >= 0.5) tp.push(el("rect", { x: x0, y: by, width: xPre - x0, height: bh, fill: CATEGORICAL[j] }));
    if (sel) tp.push(el("line", { x1: xb(1), x2: xb(1), y1: yy + 3, y2: yy + rowH - 3, stroke: C.ink, "stroke-width": 2 }));
    tp.push(text(cOut, yy + 17, fixed(r.out, 2), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${sel ? " fig-t-strong" : ""}` }));
    tp.push(el("rect", { x: tx0, y: yy, width: tw, height: rowH, fill: "transparent", "data-fig-set": `probe=${j + 1}`, class: "fig-hit" }));
  }
  const rowsBottom = rowsTop + M * rowH;
  tp.push(el("line", { x1: xb(0), x2: xb(0), y1: rowsTop, y2: rowsBottom, stroke: C.rule, "stroke-width": 1 }));
  tp.push(el("line", { x1: tx0, x2: cOut, y1: rowsBottom, y2: rowsBottom, stroke: C.grid, "stroke-width": 1 }));
  ty = rowsBottom + 12;
  tp.push(text(xb(0), ty + 4, "0", { "font-size": fs, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  tp.push(text(xb(1), ty + 4, "1", { "font-size": fs, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  ty += 22;
  // Key: the hatch and the target tick.
  tp.push(el("rect", { x: tx0, y: ty - 10, width: 14, height: 11, fill: `url(#${hatchId})`, stroke: C.ink3, "stroke-width": 0.75 }));
  tp.push(text(tx0 + 20, ty, L.clipped, { "font-size": fs, class: "fig-t-muted" }));
  ty += 18;
  tp.push(el("line", { x1: tx0 + 7, x2: tx0 + 7, y1: ty - 11, y2: ty + 2, stroke: C.ink, "stroke-width": 2 }));
  tp.push(text(tx0 + 20, ty, L.target, { "font-size": fs, class: "fig-t-muted" }));
  parts.push(g({ class: "fig-readback" }, ...tp));
  const tableBottom = ty + 4;

  // ---- summary of the solution
  let yy = Math.max(planeBottom, tableBottom) + 28;
  const notStored = [...Array(M).keys()].filter((i) => md.norms[i] < STORED);
  const lines: Array<[string, string, number]> = [
    [tpl(L.stored, { n: md.stored.length, arr: arrangementText(md, L) }), "fig-t-strong", TYPE.label],
  ];
  if (notStored.length) lines.push([tpl(L.notStored, { list: notStored.map(vName).join(lang === "zh" ? "、" : ", ") }), "fig-t-muted", fs]);
  lines.push([L.model, "fig-t-muted fig-t-num", fs]);
  lines.push([tpl(L.loss, { l: fixed(s.loss, 3) }), "fig-t-num", fs]);
  for (const [line, cls, size] of lines) {
    for (const part of wrap(line, size, w)) {
      parts.push(text(0, yy, part, { "font-size": size, class: cls }));
      yy += size + 6;
    }
    yy += 2;
  }

  // ---- features stored across sparsity
  yy += 16;
  parts.push(text(0, yy, tpl(L.strip, { r: p.ratio }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const others = RATIOS.filter((r) => r !== p.ratio);
  const note = tpl(L.others, { list: others.join(lang === "zh" ? "、" : ", ") });
  // The key for the dashed lines: beside the title on a wide column, under it on a phone.
  const noteX = narrow ? 0 : w - textWidth(note, fs) - 24;
  if (narrow) yy += 20;
  parts.push(el("line", { x1: noteX, x2: noteX + 18, y1: yy - 4, y2: yy - 4, stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  parts.push(text(noteX + 24, yy, note, { "font-size": fs, class: "fig-t-muted" }));
  yy += 24;
  const left = 30, right = 10;
  const sh = narrow ? 104 : 120;
  const top = yy + 10;
  const xs = log([0.01, 1], [left, w - right]);
  const ys = linear([0, 5.9], [top + sh, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: top + sh, ticks: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1], format: (v) => sig(v, 2), title: L.stripX, size: fs }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: [0, 1, 2, 3, 4, 5], grid: [left, w - right], format: (v) => String(v), title: L.stripY, size: fs }));
  const stripObstacles: Box[] = [];
  const stepPts = (r: Ratio): Array<[number, number]> => {
    const sols = [...GRID[r]].sort((a, b) => a.dens - b.dens);
    const pts: Array<[number, number]> = [];
    sols.forEach((sol, k) => {
      const lo = k === 0 ? Math.log10(sol.dens) : (Math.log10(sols[k - 1].dens) + Math.log10(sol.dens)) / 2;
      const hi = k === sols.length - 1 ? Math.log10(sol.dens) : (Math.log10(sols[k + 1].dens) + Math.log10(sol.dens)) / 2;
      const y = ys(modelOf(sol).stored.length);
      pts.push([xs(10 ** lo), y], [xs(10 ** hi), y]);
    });
    return pts;
  };
  // d = 2: the line above which features outnumber dimensions.
  parts.push(el("line", { x1: left, x2: w - right, y1: ys(2), y2: ys(2), stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  stripObstacles.push(...lineObstacles([[left, ys(2)], [w - right, ys(2)]]));
  for (const r of others) {
    const pts = stepPts(r);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink3, "stroke-width": 1.25, "stroke-dasharray": "4 3" }));
    stripObstacles.push(...lineObstacles(pts));
  }
  const selPts = stepPts(p.ratio);
  parts.push(el("path", { d: linePath(selPts), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));
  stripObstacles.push(...lineObstacles(selPts));
  const mx = xs(s.dens), my = ys(md.stored.length);
  parts.push(el("line", { x1: mx, x2: mx, y1: top, y2: top + sh, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  stripObstacles.push({ x0: mx - 3, y0: top, x1: mx + 3, y1: top + sh });
  // Name each plateau of the chosen ratio by its arrangement.
  const sols = [...GRID[p.ratio]].sort((a, b) => a.dens - b.dens);
  const runs: Array<{ arr: Arrangement; n: number; lo: number; hi: number }> = [];
  for (const sol of sols) {
    const m2 = modelOf(sol);
    const last = runs[runs.length - 1];
    if (last && last.arr === m2.arr && last.n === m2.stored.length) last.hi = sol.dens;
    else runs.push({ arr: m2.arr, n: m2.stored.length, lo: sol.dens, hi: sol.dens });
  }
  const plateauReqs: LabelRequest[] = runs
    .filter((r) => r.arr === "orth" || r.arr === "anti" || r.arr === "penta")
    .map((r) => ({ x: xs(Math.sqrt(r.lo * r.hi)), y: ys(r.n), text: L[r.arr as "orth" | "anti" | "penta"], size: fs, sides: ["above", "above-left", "above-right", "below", "below-left", "below-right"] as Side[], gap: 7, priority: 1, attrs: { class: "fig-t-halo fig-t-soft" } }));
  parts.push(el("circle", { cx: mx, cy: my, r: 5.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  stripObstacles.push({ x0: mx - 7, y0: my - 7, x1: mx + 7, y1: my + 7 });
  const dimsReq: LabelRequest = { x: left + 6, y: ys(2), text: L.dims, size: fs, sides: ["above-right", "below-right"], gap: 6, priority: 2, attrs: { class: "fig-t-halo fig-t-soft" } };
  const sp = placeLabels([dimsReq, ...plateauReqs], { x0: left + 2, y0: top - 4, x1: w - right, y1: top + sh - 2 }, stripObstacles);
  parts.push(drawLabels(sp.placed));
  const h = top + sh + axisHeight(true, fs) + 4;
  return svg(w, h, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "superposition-toy",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    density: {
      kind: "range", scale: "log", label: { en: "Chance a feature is active, 1 − S", zh: "特征活跃的概率 1 − S" },
      min: 0.01, max: 1, default: 0.1,
    },
    ratio: {
      kind: "choice", label: { en: "Importance Iᵢ = rⁱ⁻¹", zh: "重要性 Iᵢ = rⁱ⁻¹" }, default: "0.9",
      options: RATIOS.map((r) => ({ value: r, label: { en: `r = ${r}`, zh: `r = ${r}` } })),
    },
    probe: {
      kind: "choice", control: "buttons", label: { en: "Feature active alone", zh: "单独激活的特征" }, default: 1,
      options: Array.from({ length: M }, (_, i) => ({ value: i + 1, label: { en: vName(i), zh: vName(i) } })),
    },
  },
  // The solutions exist on a grid: snap the slider to the grid point drawn.
  update(p, key) {
    if (key === "density") return { ...p, density: nearest(p.ratio, p.density).dens };
    return p;
  },
  render,
  describe,
});

// ---------------------------------------------------------------- data

const GRID: Record<Ratio, Solution[]> = {
  "0.9": [
    { dens: 1, vx: [1, -0.003, -0.007, -0.009, -0.004], vy: [0, 0.997, -0.027, -0.018, -0.003], b: [0.012, 0.027, 0.511, 0.525, 0.504], loss: 0.1333 }, // 17 of 17 runs tie
    { dens: 0.794328, vx: [1.002, 0.003, -0.013, -0.001, -0.004], vy: [0, 1.003, 0.122, -0.009, -0.004], b: [0.004, -0.053, 0.349, 0.4, 0.396], loss: 0.2158 }, // 17 of 17 runs tie
    { dens: 0.630957, vx: [0.991, -0.257, -0.366, -0.017, -0.003], vy: [0, 0.902, -0.658, -0.006, 0.007], b: [0.171, 0.235, 0.378, 0.319, 0.319], loss: 0.276 }, // 6 of 17 runs tie, kept the warm start
    { dens: 0.501187, vx: [1.006, 0.002, 0.001, -0.908, 0.001], vy: [0, 0.98, -0.953, 0.004, 0.003], b: [0.071, 0.097, 0.114, 0.132, 0.254], loss: 0.2907 }, // 5 of 17 runs tie
    { dens: 0.398107, vx: [1.025, 0, 0.001, -0.97, -0.006], vy: [0, 1.014, -0.989, -0.006, -0.004], b: [0.035, 0.037, 0.049, 0.05, 0.202], loss: 0.2721 }, // 7 of 17 runs tie
    { dens: 0.316228, vx: [1.021, -0.003, -0.998, -0.001, -0.009], vy: [0, 1.021, 0.001, -0.995, 0], b: [0.021, 0.017, 0.028, 0.022, 0.161], loss: 0.2507 }, // 4 of 17 runs tie
    { dens: 0.251189, vx: [1.017, -0.001, -1.006, -0.001, -0.006], vy: [0, 1.013, 0, -1.009, -0.003], b: [0.013, 0.011, 0.013, 0.01, 0.128], loss: 0.2336 }, // 3 of 17 runs tie, kept the warm start
    { dens: 0.199526, vx: [1.014, -0.001, -1.004, -0.003, -0.007], vy: [0, 1.013, 0.003, -1.006, 0.001], b: [0.004, 0.005, 0.008, 0.007, 0.101], loss: 0.2195 }, // 6 of 17 runs tie
    { dens: 0.158489, vx: [1.08, -0.855, -0.86, 0.308, 0.31], vy: [0, 0.643, -0.622, -1.001, 0.975], b: [-0.172, -0.175, -0.16, -0.161, -0.139], loss: 0.2054 }, // 2 of 17 runs tie
    { dens: 0.125893, vx: [1.101, -0.863, -0.889, 0.308, 0.331], vy: [0, 0.665, -0.624, -1.03, 0.999], b: [-0.197, -0.196, -0.194, -0.184, -0.182], loss: 0.1789 }, // 2 of 17 runs tie, kept the warm start
    { dens: 0.1, vx: [1.107, -0.884, -0.887, 0.328, 0.341], vy: [0, 0.662, -0.65, -1.039, 1.027], b: [-0.217, -0.21, -0.213, -0.201, -0.2], loss: 0.1558 }, // 3 of 17 runs tie, kept the warm start
    { dens: 0.079433, vx: [1.126, -0.896, -0.898, 0.327, 0.348], vy: [0, 0.667, -0.651, -1.048, 1.045], b: [-0.228, -0.225, -0.228, -0.211, -0.215], loss: 0.1362 }, // 8 of 17 runs tie
    { dens: 0.063096, vx: [1.137, -0.906, -0.916, 0.33, 0.341], vy: [0, 0.67, -0.65, -1.064, 1.056], b: [-0.239, -0.237, -0.235, -0.226, -0.219], loss: 0.1195 }, // 6 of 17 runs tie
    { dens: 0.050119, vx: [1.146, -0.921, -0.918, 0.337, 0.348], vy: [0, 0.676, -0.662, -1.071, 1.07], b: [-0.255, -0.252, -0.253, -0.241, -0.239], loss: 0.1057 }, // 11 of 17 runs tie, kept the warm start
    { dens: 0.039811, vx: [1.152, -0.921, -0.922, 0.343, 0.349], vy: [0, 0.679, -0.67, -1.081, 1.078], b: [-0.253, -0.256, -0.25, -0.249, -0.244], loss: 0.0943 }, // 14 of 17 runs tie
    { dens: 0.031623, vx: [1.158, -0.93, -0.923, 0.346, 0.348], vy: [0, 0.684, -0.672, -1.086, 1.077], b: [-0.263, -0.269, -0.257, -0.255, -0.246], loss: 0.085 }, // 13 of 17 runs tie, kept the warm start
    { dens: 0.025119, vx: [1.159, -0.932, -0.927, 0.348, 0.348], vy: [0, 0.684, -0.677, -1.092, 1.085], b: [-0.266, -0.271, -0.263, -0.263, -0.257], loss: 0.0774 }, // 17 of 17 runs tie, kept the warm start
    { dens: 0.019953, vx: [1.163, -0.94, -0.934, 0.353, 0.347], vy: [0, 0.676, -0.683, -1.097, 1.089], b: [-0.269, -0.273, -0.27, -0.261, -0.257], loss: 0.0714 }, // 17 of 17 runs tie
    { dens: 0.015849, vx: [1.168, -0.938, -0.948, 0.348, 0.357], vy: [0, 0.693, -0.679, -1.097, 1.092], b: [-0.275, -0.274, -0.269, -0.26, -0.264], loss: 0.0665 }, // 17 of 17 runs tie, kept the warm start
    { dens: 0.012589, vx: [1.165, -0.945, -0.937, 0.353, 0.349], vy: [0, 0.687, -0.683, -1.108, 1.095], b: [-0.276, -0.281, -0.278, -0.27, -0.265], loss: 0.0625 }, // 16 of 17 runs tie
    { dens: 0.01, vx: [1.167, -0.94, -0.941, 0.352, 0.351], vy: [0, 0.686, -0.686, -1.1, 1.096], b: [-0.275, -0.281, -0.276, -0.273, -0.266], loss: 0.0593 }, // 17 of 17 runs tie, kept the warm start
  ],
  "0.8": [
    { dens: 1, vx: [1, -0.002, -0.005, -0.005, -0.001], vy: [0, 0.998, -0.013, -0.009, 0.003], b: [0.007, 0.012, 0.505, 0.518, 0.5], loss: 0.1155 }, // 17 of 17 runs tie
    { dens: 0.794328, vx: [1.001, 0, -0.004, -0.002, -0.004], vy: [0, 1.001, 0.008, -0.011, 0.001], b: [0.003, -0.001, 0.396, 0.402, 0.394], loss: 0.187 }, // 17 of 17 runs tie
    { dens: 0.630957, vx: [1.001, 0.001, 0, -0.008, 0], vy: [0, 1.008, 0.098, 0.004, 0.009], b: [0.001, -0.051, 0.289, 0.316, 0.316], loss: 0.2435 }, // 17 of 17 runs tie
    { dens: 0.501187, vx: [1.002, 0.003, 0.003, 0.001, 0.005], vy: [0, 0.998, -0.925, -0.003, 0.003], b: [-0.005, 0.089, 0.124, 0.251, 0.254], loss: 0.2676 }, // 4 of 17 runs tie
    { dens: 0.398107, vx: [1.028, 0.002, -0.957, -0.003, -0.004], vy: [0, 1.028, 0.002, -0.95, -0.008], b: [0.034, 0.03, 0.063, 0.062, 0.202], loss: 0.25 }, // 2 of 17 runs tie
    { dens: 0.316228, vx: [1.031, -0.003, -0.977, -0.001, -0.007], vy: [0, 1.028, 0.001, -0.977, -0.001], b: [0.019, 0.016, 0.034, 0.028, 0.161], loss: 0.2271 }, // 3 of 17 runs tie
    { dens: 0.251189, vx: [1.02, -0.001, -0.998, 0, -0.003], vy: [0, 1.02, 0, -0.998, -0.003], b: [0.012, 0.01, 0.016, 0.012, 0.128], loss: 0.207 }, // 5 of 17 runs tie
    { dens: 0.199526, vx: [1.017, -0.001, -0.999, -0.002, -0.005], vy: [0, 1.016, 0.001, -0.998, 0.001], b: [0.004, 0.005, 0.009, 0.008, 0.101], loss: 0.1906 }, // 9 of 17 runs tie, kept the warm start
    { dens: 0.158489, vx: [1.013, -0.001, -0.999, 0.001, -0.002], vy: [0, 1.012, -0.001, -1.004, 0.002], b: [0.002, 0.003, 0.002, 0.006, 0.083], loss: 0.1774 }, // 11 of 17 runs tie
    { dens: 0.125893, vx: [1.008, 0, -1.004, 0.001, 0.001], vy: [0, 1.012, 0, -1.002, -0.004], b: [0.001, 0.001, 0.003, 0.002, 0.061], loss: 0.1667 }, // 7 of 17 runs tie, kept the warm start
    { dens: 0.1, vx: [1.111, 0.248, -0.971, 0.276, -0.758], vy: [0, 1.073, 0.51, -1.031, -0.645], b: [-0.184, -0.175, -0.2, -0.188, -0.179], loss: 0.1547 }, // 5 of 17 runs tie
    { dens: 0.079433, vx: [1.125, -0.957, 0.295, 0.3, -0.809], vy: [0, 0.579, 1.07, -1.042, -0.669], b: [-0.209, -0.219, -0.197, -0.209, -0.205], loss: 0.1342 }, // 5 of 17 runs tie
    { dens: 0.063096, vx: [1.133, -0.953, 0.299, 0.308, -0.844], vy: [0, 0.606, 1.076, -1.057, -0.664], b: [-0.217, -0.232, -0.206, -0.225, -0.212], loss: 0.118 }, // 5 of 17 runs tie, kept the warm start
    { dens: 0.050119, vx: [1.14, -0.959, 0.311, 0.318, -0.866], vy: [0, 0.622, 1.078, -1.071, -0.676], b: [-0.237, -0.25, -0.225, -0.242, -0.239], loss: 0.1044 }, // 7 of 17 runs tie
    { dens: 0.039811, vx: [1.147, -0.963, 0.311, 0.325, -0.874], vy: [0, 0.62, 1.086, -1.081, -0.688], b: [-0.234, -0.254, -0.226, -0.251, -0.246], loss: 0.0932 }, // 11 of 17 runs tie
    { dens: 0.031623, vx: [1.149, -0.97, 0.312, 0.333, -0.88], vy: [0, 0.629, 1.085, -1.089, -0.688], b: [-0.249, -0.267, -0.233, -0.254, -0.249], loss: 0.084 }, // 15 of 17 runs tie
    { dens: 0.025119, vx: [1.153, -0.969, 0.314, 0.333, -0.887], vy: [0, 0.634, 1.093, -1.091, -0.691], b: [-0.25, -0.271, -0.243, -0.265, -0.259], loss: 0.0765 }, // 16 of 17 runs tie
    { dens: 0.019953, vx: [1.159, -0.964, 0.324, 0.338, -0.897], vy: [0, 0.645, 1.099, -1.098, -0.692], b: [-0.25, -0.273, -0.244, -0.269, -0.264], loss: 0.0705 }, // 16 of 17 runs tie
    { dens: 0.015849, vx: [1.164, -0.969, 0.326, 0.333, -0.909], vy: [0, 0.653, 1.104, -1.098, -0.693], b: [-0.257, -0.275, -0.246, -0.267, -0.271], loss: 0.0657 }, // 17 of 17 runs tie, kept the warm start
    { dens: 0.012589, vx: [1.161, -0.974, 0.321, 0.342, -0.906], vy: [0, 0.65, 1.1, -1.108, -0.698], b: [-0.26, -0.281, -0.255, -0.274, -0.273], loss: 0.0617 }, // 17 of 17 runs tie, kept the warm start
    { dens: 0.01, vx: [1.162, -0.97, 0.325, 0.339, -0.908], vy: [0, 0.648, 1.105, -1.102, -0.7], b: [-0.262, -0.282, -0.256, -0.276, -0.273], loss: 0.0585 }, // 16 of 17 runs tie
  ],
  "0.7": [
    { dens: 1, vx: [1, -0.002, -0.003, -0.003, 0.001], vy: [0, 0.998, -0.007, -0.003, 0.005], b: [0.004, 0.006, 0.502, 0.515, 0.497], loss: 0.0962 }, // 17 of 17 runs tie
    { dens: 0.794328, vx: [1, 0, 0.003, -0.006, -0.004], vy: [0, 1, 0.007, -0.005, 0], b: [0.003, -0.002, 0.394, 0.401, 0.394], loss: 0.1558 }, // 17 of 17 runs tie
    { dens: 0.630957, vx: [1.001, 0, 0.008, -0.004, -0.003], vy: [0, 1.002, 0.014, -0.003, 0.008], b: [-0.001, -0.009, 0.316, 0.317, 0.317], loss: 0.2028 }, // 17 of 17 runs tie
    { dens: 0.501187, vx: [1.001, 0.002, 0, -0.002, 0.003], vy: [0, 1.012, -0.885, -0.004, 0.004], b: [-0.002, 0.081, 0.143, 0.252, 0.254], loss: 0.2274 }, // 16 of 17 runs tie
    { dens: 0.398107, vx: [1.002, -0.002, 0.003, -0.014, -0.005], vy: [0, 1.027, -0.959, -0.002, 0], b: [0, 0.03, 0.064, 0.196, 0.204], loss: 0.2282 }, // 3 of 17 runs tie, kept the warm start
    { dens: 0.316228, vx: [1.038, 0.001, -0.003, -0.888, -0.004], vy: [0, 1.021, -0.992, 0.003, -0.002], b: [0.014, 0.017, 0.026, 0.056, 0.161], loss: 0.2051 }, // 11 of 17 runs tie
    { dens: 0.251189, vx: [1.024, -0.002, -0.982, 0.001, 0.001], vy: [0, 1.024, -0.002, -0.983, -0.002], b: [0.01, 0.01, 0.021, 0.016, 0.128], loss: 0.1823 }, // 7 of 17 runs tie
    { dens: 0.199526, vx: [1.019, -0.002, -0.991, -0.001, -0.005], vy: [0, 1.02, -0.001, -0.988, 0.001], b: [0.003, 0.005, 0.011, 0.01, 0.101], loss: 0.1639 }, // 7 of 17 runs tie
    { dens: 0.158489, vx: [1.015, -0.002, -0.994, 0.001, -0.003], vy: [0, 1.015, -0.003, -0.996, 0.002], b: [0.002, 0.004, 0.003, 0.007, 0.083], loss: 0.1489 }, // 6 of 17 runs tie, kept the warm start
    { dens: 0.125893, vx: [1.01, 0, -0.999, 0.002, 0], vy: [0, 1.014, -0.002, -0.995, -0.003], b: [0.001, 0.001, 0.004, 0.003, 0.061], loss: 0.1367 }, // 7 of 17 runs tie, kept the warm start
    { dens: 0.1, vx: [1.01, 0.001, -0.998, -0.001, 0.002], vy: [0, 1.009, 0, -1.001, 0.002], b: [0, 0.001, 0.001, 0.002, 0.051], loss: 0.127 }, // 6 of 17 runs tie
    { dens: 0.079433, vx: [1.008, 0, -0.997, 0, -0.006], vy: [0, 1.007, 0, -1.001, -0.001], b: [0.001, 0.001, 0.002, 0.001, 0.039], loss: 0.1193 }, // 9 of 17 runs tie, kept the warm start
    { dens: 0.063096, vx: [1.005, 0, -1, 0, -0.002], vy: [0, 1.004, 0, -1.002, -0.002], b: [0, 0, 0.001, 0, 0.032], loss: 0.1132 }, // 7 of 17 runs tie
    { dens: 0.050119, vx: [1.129, 0.254, -0.985, -0.818, 0.295], vy: [0, 1.09, 0.537, -0.738, -0.989], b: [-0.205, -0.198, -0.234, -0.249, -0.193], loss: 0.1017 }, // 8 of 17 runs tie
    { dens: 0.039811, vx: [1.135, 0.264, -0.989, -0.838, 0.298], vy: [0, 1.094, 0.55, -0.738, -1.019], b: [-0.206, -0.209, -0.235, -0.265, -0.207], loss: 0.0908 }, // 9 of 17 runs tie
    { dens: 0.031623, vx: [1.14, 0.273, -0.983, -0.862, 0.305], vy: [0, 1.099, 0.568, -0.736, -1.029], b: [-0.22, -0.223, -0.246, -0.275, -0.217], loss: 0.0818 }, // 8 of 17 runs tie
    { dens: 0.025119, vx: [1.145, 0.278, -0.988, -0.87, 0.305], vy: [0, 1.102, 0.576, -0.736, -1.041], b: [-0.223, -0.228, -0.256, -0.283, -0.23], loss: 0.0745 }, // 9 of 17 runs tie, kept the warm start
    { dens: 0.019953, vx: [1.145, 0.285, -0.99, -0.889, 0.301], vy: [0, 1.105, 0.59, -0.728, -1.056], b: [-0.225, -0.226, -0.263, -0.294, -0.234], loss: 0.0686 }, // 8 of 17 runs tie, kept the warm start
    { dens: 0.015849, vx: [1.152, 0.289, -0.996, -0.887, 0.319], vy: [0, 1.108, 0.598, -0.736, -1.06], b: [-0.237, -0.228, -0.263, -0.292, -0.245], loss: 0.0639 }, // 13 of 17 runs tie
    { dens: 0.012589, vx: [1.147, 0.289, -0.991, -0.903, 0.31], vy: [0, 1.112, 0.596, -0.736, -1.067], b: [-0.233, -0.238, -0.274, -0.297, -0.247], loss: 0.0599 }, // 13 of 17 runs tie, kept the warm start
    { dens: 0.01, vx: [1.15, 0.29, -0.996, -0.898, 0.313], vy: [0, 1.109, 0.6, -0.731, -1.073], b: [-0.236, -0.241, -0.273, -0.304, -0.247], loss: 0.0567 }, // 11 of 17 runs tie, kept the warm start
  ],
};
