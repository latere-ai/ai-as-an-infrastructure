// Causal self-attention over a real sentence. The scores are real: pre-softmax
// q·k/√d_h for three heads of Qwen/Qwen2.5-0.5B (revision 060db64, d_h = 64),
// captured from one float32 forward pass over one English and one Chinese
// sentence (tools/figure-data/causal-attention-scores.py regenerates SCORES). The
// figure recomputes each row in the page:
//
//   α_ij = softmax_j( s_ij · √d_h / c + M_ij ),   s_ij = q_i·k_j / √d_h
//
// where c is the divisor the reader sets (c = √d_h = 8 is the model) and M is
// the causal mask (0 for j <= i, -inf for j > i) or no mask. The unmasked
// upper triangle uses the same q and k; the model itself never computes it.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

const D_HEAD_SQRT = 8; // √64

type HeadKey = "L5H5" | "L8H7" | "L11H7";
interface Sentence { text: string; tokens: string[]; L5H5: number[][]; L8H7: number[][]; L11H7: number[][] }

const labels = {
  en: {
    title: "Causal attention over a sentence",
    heat: "Attention weights α, one row per query",
    keys: "keys j",
    queries: "queries i",
    masked: "masked, M = −∞",
    row: "Query “{q}” at position {i}",
    colKey: "key",
    colScore: "q·k / c",
    colMask: "+ M",
    colWeight: "α = softmax",
    norm: "softmax over {n} keys ({range}); the row sums to 1",
    rangeCausal: "positions 0 to {i}",
    rangeAll: "all 11 positions",
    mix: "output z = {terms}",
    other: "…",
    source: "Scores: Qwen2.5-0.5B, {head}, from one forward pass",
    headName: "layer {l}, head {h}",
    describe: "{head} of Qwen2.5-0.5B, query “{q}” at position {i}, {mask}, q·k divided by {c}: over {n} keys the weights put {top}.",
    causal: "causal mask",
    none: "no mask",
    on: "{p} on “{k}”",
  },
  zh: {
    title: "一个句子上的因果注意力",
    heat: "注意力权重 α，每行对应一个查询",
    keys: "键 j",
    queries: "查询 i",
    masked: "被掩码，M = −∞",
    row: "查询“{q}”，位置 {i}",
    colKey: "键",
    colScore: "q·k / c",
    colMask: "+ M",
    colWeight: "α = softmax",
    norm: "在 {n} 个键（{range}）上做 softmax，整行之和为 1",
    rangeCausal: "位置 0 到 {i}",
    rangeAll: "全部 11 个位置",
    mix: "输出 z = {terms}",
    other: "…",
    source: "分数来源：Qwen2.5-0.5B，{head}，一次前向计算",
    headName: "第 {l} 层第 {h} 个头",
    describe: "Qwen2.5-0.5B 的{head}，查询“{q}”位于位置 {i}，{mask}，q·k 除以 {c}：在 {n} 个键上，权重{top}。",
    causal: "因果掩码",
    none: "不加掩码",
    on: "{p} 落在“{k}”",
  },
};

type P = { head: HeadKey; query: number; mask: "causal" | "none"; divisor: number };

const shown = (tok: string) => tok.trim() || tok;

// Softmax of one query row under the chosen mask and divisor.
function row(p: P, lang: Lang) {
  const S = SCORES[lang];
  const s = S[p.head][p.query];
  const n = s.length;
  const logits = s.map((v) => (v * D_HEAD_SQRT) / p.divisor);
  const allowed = logits.map((_, j) => p.mask === "none" || j <= p.query);
  const mx = Math.max(...logits.filter((_, j) => allowed[j]));
  const e = logits.map((v, j) => (allowed[j] ? Math.exp(v - mx) : 0));
  const z = e.reduce((a, b) => a + b, 0);
  return { n, logits, allowed, alpha: e.map((v) => v / z), tokens: S.tokens.map(shown) };
}

// The full weight matrix, for the heatmap.
function matrix(p: P, lang: Lang): number[][] {
  const n = SCORES[lang].tokens.length;
  return Array.from({ length: n }, (_, i) => row({ ...p, query: i }, lang).alpha);
}

function headName(p: P, L: typeof labels.en) {
  const m = p.head.match(/L(\d+)H(\d+)/)!;
  return tpl(L.headName, { l: m[1], h: m[2] });
}

function topTerms(alpha: number[], tokens: string[], k: number) {
  return alpha.map((a, j) => ({ a, j })).sort((x, y) => y.a - x.a).slice(0, k).filter((t) => t.a > 0).map((t) => ({ ...t, tok: tokens[t.j] }));
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = row(p, lang);
  const top = topTerms(r.alpha, r.tokens, 3).map((t) => tpl(L.on, { p: pct(t.a), k: t.tok })).join(lang === "zh" ? "，" : ", ");
  return tpl(L.describe, {
    head: headName(p, L), q: r.tokens[p.query], i: p.query, mask: p.mask === "causal" ? L.causal : L.none,
    c: sig(p.divisor, 3), n: r.allowed.filter(Boolean).length, top,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = row(p, lang);
  const W = matrix(p, lang);
  const n = r.n;
  const hatchId = `${st.uid}-mask`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 5, 1))];

  // ---- heatmap
  const rowLabelW = Math.max(...r.tokens.map((t) => textWidth(t, TYPE.small))) + 10;
  const heatW = narrow ? w : Math.min(360, Math.floor(w * 0.56));
  const cell = Math.max(16, Math.min(28, Math.floor((heatW - rowLabelW) / n) - 2));
  const pitch = cell + 2;
  const colLabelH = Math.max(...r.tokens.map((t) => textWidth(t, TYPE.small))) * 0.72 + 14;
  const x0 = rowLabelW;
  const y0 = 22 + colLabelH;
  parts.push(text(0, 14, L.heat, { "font-size": TYPE.label, class: "fig-t-strong" }));
  for (let j = 0; j < n; j++) {
    const cx = x0 + j * pitch + cell / 2;
    const cy = y0 - 6;
    parts.push(text(cx, cy, r.tokens[j], { "font-size": TYPE.small, transform: `rotate(-45 ${cx} ${cy})`, class: j <= p.query || p.mask === "none" ? "fig-t-muted" : "fig-t-muted fig-t-faint" }));
  }
  for (let i = 0; i < n; i++) {
    const yy = y0 + i * pitch;
    const sel = i === p.query;
    parts.push(text(rowLabelW - 8, yy + cell / 2 + 4, r.tokens[i], { "font-size": TYPE.small, "text-anchor": "end", class: sel ? "fig-t-strong" : "fig-t-muted" }));
    for (let j = 0; j < n; j++) {
      const xx = x0 + j * pitch;
      const masked = p.mask === "causal" && j > i;
      if (masked) {
        parts.push(el("rect", { x: xx, y: yy, width: cell, height: cell, rx: 3, fill: `url(#${hatchId})` }));
      } else {
        parts.push(el("rect", { x: xx, y: yy, width: cell, height: cell, rx: 3, fill: C.panel }));
        if (W[i][j] > 0.004) parts.push(el("rect", { x: xx, y: yy, width: cell, height: cell, rx: 3, fill: C.c1, "fill-opacity": Math.min(1, W[i][j]).toFixed(3) }));
        // In the unmasked view, outline the cells the causal mask would remove.
        if (p.mask === "none" && j > i) parts.push(el("rect", { x: xx + 0.5, y: yy + 0.5, width: cell - 1, height: cell - 1, rx: 3, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 2" }));
      }
    }
    parts.push(el("rect", { x: 0, y: yy - 1, width: x0 + n * pitch, height: pitch, fill: "transparent", "data-fig-set": `query=${i}`, class: "fig-hit" }));
  }
  // The selected row's outline goes on top of every cell.
  parts.push(el("rect", { x: x0 - 3, y: y0 + p.query * pitch - 3, width: n * pitch + 4, height: cell + 6, rx: 5, fill: "none", stroke: C.ink, "stroke-width": 1.5, "pointer-events": "none" }));
  const heatBottom = y0 + n * pitch;
  // Legend: weight ramp and the mask texture.
  let ly = heatBottom + 16;
  const ramp = [0.1, 0.3, 0.6, 1].map((a, k) => el("rect", { x: x0 + k * 14, y: ly - 9, width: 12, height: 10, rx: 2, fill: C.c1, "fill-opacity": a })).join("");
  parts.push(ramp, text(x0 + 60, ly, "α 0 → 1", { "font-size": TYPE.small, class: "fig-t-muted" }));
  if (p.mask === "causal") {
    const mx = x0 + 60 + textWidth("α 0 → 1", TYPE.small) + 16;
    parts.push(el("rect", { x: mx, y: ly - 9, width: 12, height: 10, rx: 2, fill: `url(#${hatchId})` }), text(mx + 18, ly, L.masked, { "font-size": TYPE.small, class: "fig-t-muted" }));
  }

  // ---- the selected row, stage by stage: score, mask, softmax
  const px = narrow ? 0 : heatW + 24;
  const pw = narrow ? w : w - px;
  let py = narrow ? ly + 30 : 0;
  const rp: string[] = [];
  rp.push(text(px, py + 14, tpl(L.row, { q: r.tokens[p.query], i: p.query }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  py += 36;
  const keyW = rowLabelW;
  const cScore = px + keyW + 46; // right edge of the score column
  const cMask = cScore + 30; // center of the mask column
  const barX = cMask + 22;
  const pctW = 34;
  const barW = Math.max(40, px + pw - pctW - barX - 6);
  rp.push(text(px, py, L.colKey, { "font-size": TYPE.small, class: "fig-t-muted" }));
  rp.push(text(cScore, py, L.colScore, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
  rp.push(text(cMask, py, L.colMask, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  rp.push(text(barX, py, L.colWeight, { "font-size": TYPE.small, class: "fig-t-muted" }));
  py += 8;
  const rowH = narrow ? 20 : Math.max(18, Math.min(22, pitch - 4));
  const best = r.alpha.indexOf(Math.max(...r.alpha));
  for (let j = 0; j < n; j++) {
    const yy = py + j * rowH;
    const on = r.allowed[j];
    rp.push(el("line", { x1: px, x2: px + pw, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    const cls = j === best ? "fig-t-strong" : on ? "" : "fig-t-faint";
    rp.push(text(px, yy + 14, r.tokens[j], { "font-size": TYPE.body, class: cls || undefined }));
    rp.push(text(cScore, yy + 14, fixed(r.logits[j], 1), { "font-size": TYPE.body, "text-anchor": "end", class: `fig-t-num ${on ? "" : "fig-t-faint"}` }));
    rp.push(text(cMask, yy + 14, on ? "0" : "−∞", { "font-size": TYPE.body, "text-anchor": "middle", class: `fig-t-num ${on ? "fig-t-muted" : "fig-t-strong"}` }));
    rp.push(el("rect", { x: barX, y: yy + 4, width: barW, height: rowH - 8, rx: 3, fill: C.panel }));
    if (r.alpha[j] * barW >= 0.75) rp.push(el("rect", { x: barX, y: yy + 4, width: r.alpha[j] * barW, height: rowH - 8, rx: 3, fill: C.c1 }));
    rp.push(text(px + pw, yy + 14, on ? pct(r.alpha[j]) : "0", { "font-size": TYPE.body, "text-anchor": "end", class: `fig-t-num ${j === best ? "fig-t-strong" : on ? "" : "fig-t-faint"}` }));
  }
  py += n * rowH + 20;
  const nAllowed = r.allowed.filter(Boolean).length;
  const range = p.mask === "causal" ? tpl(L.rangeCausal, { i: p.query }) : L.rangeAll;
  const terms = topTerms(r.alpha, r.tokens, 3).map((t) => `${t.a.toFixed(2)} v(${t.tok})`).join(" + ") + (nAllowed > 3 ? ` + ${L.other}` : "");
  const notes: Array<[string, string]> = [
    [tpl(L.norm, { n: nAllowed, range }), "fig-t-muted"],
    [tpl(L.mix, { terms }), "fig-t-muted fig-t-num"],
    [tpl(L.source, { head: headName(p, L) }), "fig-t-muted"],
  ];
  for (const [line, cls] of notes) {
    for (const part of wrap(line, TYPE.small, pw)) {
      rp.push(text(px, py, part, { "font-size": TYPE.small, class: cls }));
      py += 15;
    }
    py += 3;
  }
  parts.push(g({ class: "fig-row" }, ...rp));
  const h = Math.max(ly + 8, py + 6);
  return svg(w, h, describe(st, lang), ...parts);
}

// Pre-softmax scores q·k/√d_h, rows = queries, columns = keys, full square
// (the upper triangle is what the causal mask removes). Two decimals.
const SCORES: Record<Lang, Sentence> = {
  en: {
    text: "The cat sat on the mat because it was tired.",
    tokens: ["The", " cat", " sat", " on", " the", " mat", " because", " it", " was", " tired", "."],
    L5H5: [
      [0.74, 0.37, -2.72, -2.34, -3.04, -1.91, -1.69, -1.74, -3.64, -4.71, -1.06],
      [0.81, -0.3, -2.76, -3.24, -4.67, -3.41, -3.21, -4.52, -5.75, -7.48, -2.37],
      [0.79, 4.99, 0.64, -0.34, -2.63, -0.83, -1.82, -2.15, -4.16, -4.14, -1.94],
      [0.85, 2.4, -0.1, -0.51, -2.42, -1.79, -2.33, -3.05, -4.87, -4.25, -2.37],
      [0.83, 1.44, -0.87, -0.99, -3.06, -2.2, -2.62, -3.29, -4.41, -4.04, -2.53],
      [0.96, 0.18, -2.31, -2.28, -4.21, -1.58, -3.5, -3.84, -5.12, -5.05, -3.52],
      [0.75, 1.29, 0.6, -0.2, -2.39, -1.7, -1.39, -2.34, -3.57, -3.7, -1.63],
      [0.79, 4.88, 2.47, 1.93, -0.41, 1.13, -0.31, -0.2, -1.98, -3.06, -0.39],
      [0.83, 1.98, 1.86, 1.35, -0.31, 1.16, -0.02, -0.77, -1.66, -2.29, -1.13],
      [0.82, 3.17, 0.35, -0.01, -1.92, 0.18, -1.64, -0.85, -2.5, -2.48, -2.41],
      [0.73, -0.38, -0.82, -2.36, -4, -2.84, -1.31, -3.77, -4.99, -5.48, 0.05]
    ],
    L8H7: [
      [11.53, 4.31, -0.42, -0.42, 6.36, 8.83, 5.65, -2.49, -5.03, -3.49, 6.14],
      [13.8, 10.85, 1.48, -6.37, -1.96, 1.78, 6.57, 0.5, -4.76, -10.65, 1.98],
      [15.01, 19.27, 13.49, 1.48, -2.37, -1.92, 4.65, 6.4, 2.04, -6.85, 1.66],
      [15.14, 16.1, 19.76, 14.02, 4.99, -2.14, 1.64, 5.55, 7.01, 3.78, 7.38],
      [15.78, 9.31, 18.39, 20.79, 14.39, 4.01, 0.23, 0.41, 4.61, 7.41, 13.24],
      [14.18, 1.37, 8.1, 14.89, 16.28, 12.58, 5.61, -1.23, -0.19, 2.87, 12.17],
      [13.98, -0.22, 0.92, 5.95, 13.29, 15.56, 12.21, 2.32, -2.23, -3.63, 8.65],
      [15.7, 7.87, 3.07, 0.73, 8.18, 17.11, 21.46, 13.81, 4.89, -3.69, 7.95],
      [15.3, 13.3, 9.09, 1.02, 0.75, 7.47, 18.41, 19.76, 13.41, 2.63, 6.9],
      [14, 10.44, 12.24, 6.91, 0.76, 0.71, 9.03, 15.42, 16.07, 12.16, 10.42],
      [12.86, 1.2, 7.51, 7.84, 2.32, -3.79, 1.12, 6.12, 12.23, 14.71, 11.62]
    ],
    L11H7: [
      [4.37, -8.85, -17.44, -16.69, -19.11, -16.75, -17.12, -22.06, -14.9, -12.87, -14.95],
      [4.99, -11.33, -9.09, -18.82, -14.42, -8.5, -10.75, -25.19, -17.16, -17.72, -18.04],
      [5.32, -9.84, -12.74, -9.39, -15.39, -14.06, -11.88, -24.95, -19.08, -16.12, -13.6],
      [5.54, -10.36, -26.15, -17.46, -10.76, -12.15, -22.13, -24.17, -17.76, -18.01, -17.53],
      [5.55, -8.74, -20.12, -18.46, -9.43, -5.82, -20.43, -23.3, -13.28, -16.71, -16.57],
      [5.67, -10.08, -11.48, -16.43, -17.66, -12.4, -4.39, -27.99, -23.25, -22.88, -23.1],
      [4.8, -8.82, -21.42, -20.27, -23.23, -19.32, -24.09, -10.98, -10.29, -10.24, -13.27],
      [4.84, -10.72, -20.87, -17.48, -20.31, -15.74, -23.76, -24.85, -9.81, -7.6, -6.93],
      [4.78, -9.99, -19.82, -16.91, -23.68, -19.68, -18.89, -23.49, -14.7, -7.47, -7.32],
      [5.43, -11.02, -24.83, -15.39, -22.17, -19.48, -19.53, -31.88, -23.01, -14.86, -5.91],
      [4.03, -9.4, -22.16, -22.36, -28.56, -24.99, -24.46, -24.95, -16.64, -11.16, -16.47]
    ],
  },
  zh: {
    text: "小猫坐在垫子上，它很累。",
    tokens: ["小", "猫", "坐在", "垫", "子", "上", "，", "它", "很", "累", "。"],
    L5H5: [
      [0.75, 0.09, -1.68, -2.78, -3.59, -3.02, -0.66, -0.12, -3.24, -3.04, -1.18],
      [0.82, -0.76, -2.55, -7.1, -6.54, -5.21, -1.56, -2.9, -4.62, -5.01, -2.48],
      [0.87, 1.98, 0.37, -1.9, -2.69, -1.76, -1.13, -1.01, -2.6, -2.12, -1.92],
      [0.89, -0.96, -1.76, -1.07, -2.23, -3.09, -3.1, -3.3, -4.47, -3.93, -4.13],
      [0.93, -0.62, -2.22, -1.37, -2.53, -2.53, -3, -2.34, -3.95, -3.4, -3.45],
      [0.86, 1.34, 0.75, -0.28, -0.09, -0.57, -1.97, -0.44, -3.12, -2.86, -2.51],
      [0.69, 0.65, 0.12, -4.18, -4.06, -3.19, -0.25, -0.28, -3.5, -3.69, -1.07],
      [0.8, 3.43, 1.69, -1.64, -1.76, -1.44, -0.07, 1.4, -1.33, -1.5, -0.86],
      [0.8, 0.57, -0.07, -2.6, -3.24, -1.74, -1.08, 0.43, -1.49, -1.38, -1.46],
      [0.87, 1.05, 0.48, -2.95, -2.28, -1.75, -2.12, 0.11, -1.44, -1.51, -2.88],
      [0.73, 0.27, -0.57, -3.65, -4.61, -3.55, 0.85, -0.02, -2.72, -2.61, 0.05]
    ],
    L8H7: [
      [11.51, 5.7, -0.45, -2.07, 5.93, 7.14, 8.51, -0.38, -5.99, -2.97, 6.45],
      [13.48, 12.44, 2.62, -8.47, -1.67, 3.41, 10.67, 3.22, -4.51, -9.62, 2.1],
      [13.77, 16.23, 12.48, 0.48, -1.59, 0.13, 8.41, 6.07, 2.84, -3.8, 2.4],
      [14.01, 13.76, 16.94, 11.85, 4.2, 0.16, 5.77, 5.44, 7.71, 4.7, 6.54],
      [13.45, 6.69, 14.04, 17.7, 12.31, 5.46, 5.38, 3.59, 5.8, 9.37, 11.07],
      [15.35, 2.09, 8.42, 17.61, 19.27, 13.27, 9.74, 2.32, -0.28, 6.54, 14.51],
      [13.37, 2.16, 1.34, 5.56, 14.37, 15.65, 12.59, 4.6, -4.29, -2.45, 8.2],
      [15.26, 7.49, 1.09, -2.63, 7.8, 16.65, 18.69, 14.24, 2.12, -4.17, 6.29],
      [14.93, 12, 8.39, -1.25, 0.73, 8.67, 16.35, 19.2, 14.2, 4.29, 7.18],
      [14.04, 9.1, 11.5, 5.12, -0.36, 1.24, 9.41, 15.1, 16.97, 12.39, 9.66],
      [12.95, 1.78, 7.57, 8.69, 2.07, -2.39, 3.26, 6.79, 12.47, 15.12, 11.9]
    ],
    L11H7: [
      [4.37, -10.54, -13.63, -14.11, -17.71, -19.08, -19.78, -15.76, -13.56, -13.28, -16.16],
      [5.27, -9.52, -5.74, -15.55, -18.32, -15.48, -16.38, -18.37, -16.85, -16.88, -15.65],
      [4.78, -10.31, -9.92, -6.96, -16.94, -15.94, -10.2, -9.94, -11.7, -10.53, -7.18],
      [5.35, -13.88, -14.76, -12.98, -10.68, -10.62, -8.2, -7.89, -17.62, -17.28, -18.71],
      [5.37, -16.07, -16.61, -15.49, -15.29, -10.55, -10.88, -11.83, -20.69, -19.51, -20.94],
      [5.51, -13.72, -15.24, -16.59, -14.37, -12.64, -6.97, -8.83, -17.81, -13.68, -17.32],
      [4.67, -12.54, -14.73, -13.66, -17.26, -16.7, -13.03, -7.94, -10.56, -12.32, -15.72],
      [4.75, -10.26, -14.38, -13.14, -20.64, -22.81, -21.01, -15.01, -6.01, -16.87, -15.6],
      [4.82, -12.05, -17.2, -20.8, -21.82, -25.74, -21.65, -20.67, -21.53, -10.8, -17.23],
      [5.18, -10.96, -12.91, -14.82, -22.73, -26.08, -18.01, -20.95, -14.69, -10.65, -5.89],
      [4.2, -13.54, -18.25, -23.67, -27.99, -28.18, -28.76, -21.89, -16.97, -14.23, -18.47]
    ],
  },
};
const SCORES_TOKENS = { en: SCORES.en.tokens, zh: SCORES.zh.tokens };

export default defineFigure({
  name: "causal-attention",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    query: {
      kind: "choice", control: "buttons", label: { en: "Query token", zh: "查询词元" }, default: 7,
      options: Array.from({ length: 11 }, (_, i) => ({ value: i, label: { en: shown(SCORES_TOKENS.en[i]), zh: shown(SCORES_TOKENS.zh[i]) } })),
    },
    head: {
      kind: "choice", control: "select", label: { en: "Head", zh: "注意力头" }, default: "L5H5",
      options: [
        { value: "L5H5", label: { en: "Layer 5, head 5: weight on the subject", zh: "第 5 层第 5 个头：权重落在主语" } },
        { value: "L8H7", label: { en: "Layer 8, head 7: the previous token", zh: "第 8 层第 7 个头：前一个词元" } },
        { value: "L11H7", label: { en: "Layer 11, head 7: the first token", zh: "第 11 层第 7 个头：第一个词元" } },
      ],
    },
    mask: {
      kind: "choice", label: { en: "Mask", zh: "掩码" }, default: "causal",
      options: [
        { value: "causal", label: { en: "Causal", zh: "因果" } },
        { value: "none", label: { en: "None", zh: "无" } },
      ],
    },
    divisor: {
      kind: "range", scale: "log", label: { en: "Divide q·k by c", zh: "q·k 除以 c" }, min: 1, max: 64, default: 8,
      marks: [{ value: 8, label: { en: "√d_h = 8", zh: "√d_h = 8" } }],
    },
  },
  render,
  describe,
});
