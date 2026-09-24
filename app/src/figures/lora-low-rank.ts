// LoRA as a rank-r product. A target update ΔW ∈ R^{d_out × d_in} is built
// from seeded draws, its singular value decomposition ΔW = U Σ Vᵀ is computed
// in the page (one-sided Jacobi), and the reader picks the adapter rank r. The
// figure draws the chapter's factorization with s folded into B,
//
//   B = U_r Σ_r^{1/2} ∈ R^{d_out × r},   A = Σ_r^{1/2} V_rᵀ ∈ R^{r × d_in},
//
// which is the best rank-r approximation of ΔW in Frobenius norm
// (Eckart–Young): no adapter of rank r, trained or not, reconstructs this ΔW
// more closely. The readout uses the chapter's count
//
//   N_LoRA = r(d_in + d_out),   ρ = N_LoRA / (d_out d_in),
//
// and the relative residual ‖ΔW − BA‖_F / ‖ΔW‖_F = sqrt(Σ_{k>r} σ_k² / Σ_k σ_k²).
//
// Gaussian entries are sums of twelve uniforms minus six, so building ΔW and
// the decomposition use only +, −, ×, ÷ and √, which IEEE 754 rounds the same
// in every engine: the build and the browser draw the same matrices.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

const D_OUT = 12;
const D_IN = 20;
const MAX_R = Math.min(D_OUT, D_IN);
const FULL = D_OUT * D_IN;
const BREAK_EVEN = FULL / (D_IN + D_OUT); // r at which N_LoRA = d_out d_in

type Target = "few" | "decay" | "flat";
type P = { target: Target; rank: number; seed: number };

// ---------------------------------------------------------------- matrices

type Mat = number[][]; // row-major

function gauss(u: () => number): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += u();
  return s - 6;
}

function unit(u: () => number, n: number): number[] {
  const v = Array.from({ length: n }, () => gauss(u));
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return v.map((x) => x / norm);
}

// Weights of the rank-one terms that make each target.
const TERMS: Record<Exclude<Target, "flat">, number[]> = {
  few: [4, 2.5, 1.5],
  decay: Array.from({ length: MAX_R }).reduce<number[]>((acc) => [...acc, acc.length ? acc[acc.length - 1] * 0.72 : 3], []),
};
const NOISE = 0.05; // entry noise added to "few"

function target(t: Target, seed: number): Mat {
  const u = rng(seed * 31 + (t === "few" ? 1 : t === "decay" ? 2 : 3));
  const W: Mat = Array.from({ length: D_OUT }, () => new Array(D_IN).fill(0));
  if (t === "flat") {
    for (let i = 0; i < D_OUT; i++) for (let j = 0; j < D_IN; j++) W[i][j] = gauss(u) / 4;
    return W;
  }
  for (const a of TERMS[t]) {
    const gv = unit(u, D_OUT), hv = unit(u, D_IN);
    for (let i = 0; i < D_OUT; i++) for (let j = 0; j < D_IN; j++) W[i][j] += a * gv[i] * hv[j];
  }
  if (t === "few") for (let i = 0; i < D_OUT; i++) for (let j = 0; j < D_IN; j++) W[i][j] += NOISE * gauss(u);
  return W;
}

// One-sided Jacobi (Hestenes) on X = ΔWᵀ: rotate pairs of columns until they
// are orthogonal. Then X = V Σ and the accumulated rotations are U. Fixed
// sweep order, so the result is a function of the input alone.
function svd(W: Mat): { s: number[]; U: Mat; V: Mat } {
  const m = D_IN, n = D_OUT;
  const X: Mat = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => W[j][i]));
  const J: Mat = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let a = 0, b = 0, c = 0;
        for (let i = 0; i < m; i++) { a += X[i][p] * X[i][p]; b += X[i][q] * X[i][q]; c += X[i][p] * X[i][q]; }
        if (c === 0 || Math.abs(c) <= 1e-15 * Math.sqrt(a * b)) continue;
        off = Math.max(off, Math.abs(c) / Math.sqrt(a * b));
        const zeta = (b - a) / (2 * c);
        const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
        for (let i = 0; i < m; i++) { const xp = X[i][p], xq = X[i][q]; X[i][p] = cs * xp - sn * xq; X[i][q] = sn * xp + cs * xq; }
        for (let i = 0; i < n; i++) { const jp = J[i][p], jq = J[i][q]; J[i][p] = cs * jp - sn * jq; J[i][q] = sn * jp + cs * jq; }
      }
    }
    if (off < 1e-13) break;
  }
  const sig = Array.from({ length: n }, (_, j) => Math.sqrt(X.reduce((acc, row) => acc + row[j] * row[j], 0)));
  const order = sig.map((_, j) => j).sort((x, y) => sig[y] - sig[x]);
  const s = order.map((j) => sig[j]);
  const U: Mat = Array.from({ length: n }, (_, i) => order.map((j) => J[i][j]));
  const V: Mat = Array.from({ length: m }, (_, i) => order.map((j) => (sig[j] > 0 ? X[i][j] / sig[j] : 0)));
  return { s, U, V };
}

const memo = new Map<string, { W: Mat; s: number[]; U: Mat; V: Mat; vmax: number }>();
function decomposed(t: Target, seed: number) {
  const key = `${t}|${seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const W = target(t, seed);
    hit = { W, ...svd(W), vmax: Math.max(...W.flat().map(Math.abs)) };
    memo.set(key, hit);
  }
  return hit;
}

function model(p: P) {
  const d = decomposed(p.target, p.seed);
  const r = p.rank;
  const root = d.s.slice(0, r).map(Math.sqrt);
  const B: Mat = d.U.map((row) => root.map((q, k) => row[k] * q));
  const A: Mat = root.map((q, k) => d.V.map((row) => row[k] * q));
  const BA: Mat = Array.from({ length: D_OUT }, (_, i) => Array.from({ length: D_IN }, (_, j) => {
    let v = 0;
    for (let k = 0; k < r; k++) v += B[i][k] * A[k][j];
    return v;
  }));
  const R: Mat = d.W.map((row, i) => row.map((v, j) => v - BA[i][j]));
  const total = d.s.reduce((a, x) => a + x * x, 0);
  const kept = d.s.slice(0, r).reduce((a, x) => a + x * x, 0);
  const n = r * (D_IN + D_OUT);
  return { ...d, r, B, A, BA, R, kept: kept / total, resid: Math.sqrt(Math.max(0, total - kept) / total), n, rho: n / FULL };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "LoRA as the best rank-r product",
    B: "B", A: "A", BA: "BA, rank {r}", W: "ΔW, target", R: "ΔW − BA",
    shapeB: "{d} × {r}", shapeA: "{r} × {d}",
    approx: "≈",
    spec: "singular values σ_k of ΔW",
    k: "index k",
    cut: "r = {r}",
    keptKey: "in BA", droppedKey: "left in ΔW − BA",
    params: "trainable numbers",
    full: "full update d_out·d_in = {n}",
    lora: "B and A: r(d_in + d_out) = {n}",
    even: "r* = {v}",
    eqN: "N_LoRA = r(d_in + d_out) = {r} × ({din} + {dout}) = {n}",
    eqRho: "ρ = N_LoRA / (d_out·d_in) = {n} / {full} = {rho}",
    eqKeep: "BA keeps {k} of Σ σ_k²",
    eqResid: "‖ΔW − BA‖_F / ‖ΔW‖_F = {e}",
    over: "above r* = d_out·d_in / (d_in + d_out) = {v}, B and A hold more numbers than ΔW",
    pos: "positive", neg: "negative",
    describe: "{t}: the best rank-{r} product BA keeps {k} of the squared singular values and leaves a relative residual of {e}; B and A hold {n} numbers against {full} in ΔW, ρ = {rho}.",
    few: "Rank 3 plus noise", decay: "Decaying spectrum", flat: "Random Gaussian",
  },
  zh: {
    title: "LoRA：最优的秩 r 乘积",
    B: "B", A: "A", BA: "BA，秩 {r}", W: "ΔW，目标", R: "ΔW − BA",
    shapeB: "{d} × {r}", shapeA: "{r} × {d}",
    approx: "≈",
    spec: "ΔW 的奇异值 σ_k",
    k: "序号 k",
    cut: "r = {r}",
    keptKey: "进入 BA", droppedKey: "留在 ΔW − BA 中",
    params: "可训练的数值个数",
    full: "完整更新 d_out·d_in = {n}",
    lora: "B 与 A：r(d_in + d_out) = {n}",
    even: "r* = {v}",
    eqN: "N_LoRA = r(d_in + d_out) = {r} × ({din} + {dout}) = {n}",
    eqRho: "ρ = N_LoRA / (d_out·d_in) = {n} / {full} = {rho}",
    eqKeep: "BA 保留了 Σ σ_k² 的 {k}",
    eqResid: "‖ΔW − BA‖_F / ‖ΔW‖_F = {e}",
    over: "当 r 超过 r* = d_out·d_in / (d_in + d_out) = {v} 时，B 与 A 的数值个数比 ΔW 本身还多",
    pos: "正值", neg: "负值",
    describe: "{t}：最优的秩 {r} 乘积 BA 保留了奇异值平方和的 {k}，相对残差为 {e}；B 与 A 共有 {n} 个数值，ΔW 有 {full} 个，ρ = {rho}。",
    few: "秩 3 加噪声", decay: "奇异值逐步衰减", flat: "随机高斯矩阵",
  },
};
type L = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, { t: L[st.p.target], r: m.r, k: pct(m.kept, 1), e: fixed(m.resid, 2), n: m.n, full: FULL, rho: fixed(m.rho, 2) });
}

// ---------------------------------------------------------------- drawing

// A signed heatmap: blue for positive entries, orange for negative, opacity by
// magnitude against vmax.
function heat(M: Mat, x0: number, y0: number, c: number, vmax: number): string {
  const parts: string[] = [el("rect", { x: x0 - 0.5, y: y0 - 0.5, width: (M[0]?.length ?? 0) * c + 1, height: M.length * c + 1, fill: C.panel })];
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      const v = M[i][j] / vmax;
      const a = Math.min(1, Math.abs(v));
      if (a < 0.02) continue;
      parts.push(el("rect", { x: x0 + j * c, y: y0 + i * c, width: c - 0.6, height: c - 0.6, fill: v > 0 ? C.c1 : C.c2, "fill-opacity": (0.08 + 0.92 * a).toFixed(2) }));
    }
  }
  return parts.join("");
}

const maxAbs = (M: Mat) => Math.max(1e-12, ...M.flat().map(Math.abs));

function matrices(m: ReturnType<typeof model>, w: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const G = 24; // gap between matrices
  const c = narrow ? Math.min(9, (w - G) / (2 * D_IN)) : Math.min(9, (w - 3 * G) / (MAX_R + 3 * D_IN));
  const colB = MAX_R * c; // reserved width of B, so BA stays in place as r changes
  const top = 4;
  const rowA = top + Math.max(m.r * c, 16); // bottom of the A band, which grows with r
  const yM = rowA + 3; // top of the d_out-row matrices
  const hM = D_OUT * c;
  const xBA = colB + 3;
  const r = m.r;
  const sub = (s: string, x: number, y: number, anchor: "start" | "middle" | "end", cls = "fig-t-muted", size: number = TYPE.small) =>
    text(x, y, s, { "font-size": size, "text-anchor": anchor, class: cls });

  // Factor block: B to the left of BA, A above it, drawn to the same cell size,
  // so their areas are the r(d_in + d_out) numbers an adapter stores.
  parts.push(heat(m.A, xBA, rowA - r * c, c, maxAbs(m.A)));
  parts.push(heat(m.B, xBA - 3 - r * c, yM, c, maxAbs(m.B)));
  parts.push(heat(m.BA, xBA, yM, c, m.vmax));
  const aLabelY = rowA - (r * c) / 2 + 4;
  parts.push(sub(`${L.A}  ${tpl(L.shapeA, { r, d: D_IN })}`, xBA - 8, aLabelY, "end", "fig-t-strong", TYPE.body));
  const below = yM + hM + 16;
  parts.push(sub(L.B, xBA - 3, below, "end", "fig-t-strong", TYPE.body));
  parts.push(sub(tpl(L.shapeB, { d: D_OUT, r }), xBA - 3, below + 15, "end"));
  parts.push(sub(tpl(L.BA, { r }), xBA + (D_IN * c) / 2, below, "middle", "fig-t-strong", TYPE.body));
  let h = below + 22;

  // Target and residual: same scale as BA, so the residual fades as r grows.
  let xW: number, yW: number;
  if (narrow) {
    xW = 0;
    yW = h + 12;
  } else {
    xW = xBA + D_IN * c + G;
    yW = yM;
    parts.push(sub(L.approx, xW - G / 2, yM + hM / 2 + 5, "middle", "fig-t-strong", TYPE.title));
  }
  const xR = xW + D_IN * c + G;
  parts.push(heat(m.W, xW, yW, c, m.vmax));
  parts.push(heat(m.R, xR, yW, c, m.vmax));
  parts.push(sub(L.W, xW + (D_IN * c) / 2, yW + hM + 16, "middle", "fig-t-strong", TYPE.body));
  parts.push(sub(L.R, xR + (D_IN * c) / 2, yW + hM + 16, "middle", "fig-t-strong", TYPE.body));
  h = Math.max(h, yW + hM + 22);

  // Sign key.
  const ky = h + 10;
  const key = [[C.c1, L.pos], [C.c2, L.neg]] as const;
  let kx = 0;
  for (const [col, name] of key) {
    parts.push(el("rect", { x: kx, y: ky - 9, width: 10, height: 10, rx: 2, fill: col }));
    parts.push(sub(name, kx + 15, ky, "start"));
    kx += 15 + textWidth(name, TYPE.small) + 16;
  }
  return { svg: g({ class: "fig-matrices" }, ...parts), h: ky + 6 };
}

function spectrum(m: ReturnType<typeof model>, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 12, L.spec, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const left = x0 + 34;
  const top = y0 + 44;
  const ph = 120;
  const xb = band(MAX_R, [left, x0 + w], 3);
  const y = linear([0, m.s[0] * 1.08], [top + ph, top]);
  parts.push(axis({ scale: y, orient: "left", at: left - 4, grid: [left, x0 + w], format: (v) => sig(v, 2) }));
  for (let k = 0; k < MAX_R; k++) {
    const bx = xb.at(k);
    const kept = k < m.r;
    const by = y(m.s[k]);
    parts.push(el("rect", { x: bx, y: by, width: xb.size, height: Math.max(0.5, top + ph - by), fill: C.c1, "fill-opacity": kept ? 1 : 0.22 }));
    if (!kept) parts.push(el("rect", { x: bx + 0.5, y: by + 0.5, width: xb.size - 1, height: Math.max(0.5, top + ph - by - 1), fill: "none", stroke: C.c1, "stroke-width": 1, "stroke-dasharray": "2 2" }));
    parts.push(text(bx + xb.size / 2, top + ph + 15, k + 1, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(text((left + x0 + w) / 2, top + ph + 32, L.k, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  // The rank cut, between bar r and bar r + 1.
  if (m.r < MAX_R) {
    const cx = xb.at(m.r) - 1.5;
    parts.push(el("line", { x1: cx, x2: cx, y1: top - 8, y2: top + ph, stroke: C.ink, "stroke-width": 1.5 }));
    const lab = tpl(L.cut, { r: m.r });
    const lw = textWidth(lab, TYPE.small);
    const lx = cx + 5 + lw > x0 + w ? cx - 5 : cx + 5;
    parts.push(text(lx, top - 1, lab, { "font-size": TYPE.small, "text-anchor": lx < cx ? "end" : "start", class: "fig-t-strong fig-t-num" }));
  }
  // Key for kept and dropped bars.
  const ky = y0 + 30;
  parts.push(el("rect", { x: x0, y: ky - 9, width: 10, height: 10, rx: 2, fill: C.c1 }));
  parts.push(text(x0 + 15, ky, L.keptKey, { "font-size": TYPE.small, class: "fig-t-muted" }));
  const k2 = x0 + 15 + textWidth(L.keptKey, TYPE.small) + 16;
  parts.push(el("rect", { x: k2 + 0.5, y: ky - 8.5, width: 9, height: 9, rx: 2, fill: C.c1, "fill-opacity": 0.22, stroke: C.c1, "stroke-dasharray": "2 2" }));
  parts.push(text(k2 + 15, ky, L.droppedKey, { "font-size": TYPE.small, class: "fig-t-muted" }));
  return { svg: g({ class: "fig-spectrum" }, ...parts), h: top + ph + 36 - y0 };
}

function paramBars(m: ReturnType<typeof model>, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 12, L.params, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const maxN = MAX_R * (D_IN + D_OUT);
  const x = linear([0, maxN], [x0, x0 + w]);
  let y = y0 + 24;
  for (const [name, n, col, op] of [[tpl(L.full, { n: FULL }), FULL, C.ink3, 0.5], [tpl(L.lora, { n: m.n }), m.n, C.c1, 1]] as const) {
    parts.push(text(x0, y + 12, name, { "font-size": TYPE.body, class: "fig-t-num" }));
    y += 18;
    parts.push(el("rect", { x: x0, y, width: w, height: 12, rx: 2, fill: C.panel }));
    parts.push(el("rect", { x: x0, y, width: Math.max(1, x(n) - x0), height: 12, rx: 2, fill: col, "fill-opacity": op }));
    y += 20;
  }
  // Break-even: where the factors hold as many numbers as the matrix.
  const ex = x(FULL);
  parts.push(el("line", { x1: ex, x2: ex, y1: y0 + 38, y2: y - 6, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "3 2" }));
  const lab = tpl(L.even, { v: sig(BREAK_EVEN, 2) });
  parts.push(text(ex, y + 8, lab, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
  return { svg: g({ class: "fig-params" }, ...parts), h: y + 12 - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  const mats = matrices(m, w, narrow, L);
  parts.push(mats.svg);
  let y = mats.h + 16;
  let readX = 0, readW = w;
  if (narrow) {
    const sp = spectrum(m, 0, y, w, L);
    parts.push(sp.svg);
    y += sp.h + 14;
    const pb = paramBars(m, 0, y, w, L);
    parts.push(pb.svg);
    y += pb.h + 8;
  } else {
    const sw = Math.floor(w * 0.5);
    const sp = spectrum(m, 0, y, sw, L);
    const pb = paramBars(m, sw + 28, y, w - sw - 28, L);
    parts.push(sp.svg, pb.svg);
    readX = sw + 28;
    readW = w - readX;
    let ry = y + pb.h + 10;
    const rp = readout(m, readX, ry, readW, L, lang);
    parts.push(rp.svg);
    ry += rp.h;
    y = Math.max(y + sp.h, ry) + 4;
    return svg(w, y, describe(st, lang), ...parts);
  }
  const rp = readout(m, readX, y, readW, L, lang);
  parts.push(rp.svg);
  return svg(w, y + rp.h + 4, describe(st, lang), ...parts);
}

function readout(m: ReturnType<typeof model>, x0: number, y0: number, w: number, L: L, lang: Lang): { svg: string; h: number } {
  const lines: Array<[string, string]> = [
    [tpl(L.eqN, { r: m.r, din: D_IN, dout: D_OUT, n: m.n }), "fig-t-num"],
    [tpl(L.eqRho, { n: m.n, full: FULL, rho: fixed(m.rho, 2) }), "fig-t-num"],
    [tpl(L.eqKeep, { k: pct(m.kept, 1) }), "fig-t-num"],
    [tpl(L.eqResid, { e: fixed(m.resid, 2) }), "fig-t-num"],
  ];
  if (m.r > BREAK_EVEN) lines.push([tpl(L.over, { v: sig(BREAK_EVEN, 2) }), "fig-t-strong"]);
  const parts: string[] = [];
  let y = y0;
  for (const [s, cls] of lines) {
    for (const part of (lang === "zh" ? wrapCjk : wrap)(s, TYPE.body, w - 8)) {
      y += 17;
      parts.push(text(x0, y, part, { "font-size": TYPE.body, class: cls }));
    }
    y += 4;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

export default defineFigure({
  name: "lora-low-rank",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    target: {
      kind: "choice", label: { en: "Target update ΔW", zh: "目标更新 ΔW" }, default: "few",
      options: [
        { value: "few", label: { en: labels.en.few, zh: labels.zh.few } },
        { value: "decay", label: { en: labels.en.decay, zh: labels.zh.decay } },
        { value: "flat", label: { en: labels.en.flat, zh: labels.zh.flat } },
      ],
    },
    rank: {
      kind: "range", label: { en: "Adapter rank r", zh: "适配器秩 r" }, min: 1, max: MAX_R, step: 1, default: 2,
      marks: [{ value: BREAK_EVEN, label: { en: "r* = 7.5", zh: "r* = 7.5" } }],
    },
    seed: { kind: "range", label: { en: "Matrix seed", zh: "矩阵种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  render,
  describe,
});
