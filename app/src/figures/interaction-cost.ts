// Where query and document tokens meet, and what that placement costs.
//
// Three scorers from the chapter's table. A dual encoder pools each side into
// one vector and scores s = u·v; a late-interaction scorer keeps one vector per
// token and scores S_LI = sum_i max_j q_i·d_j (MaxSim); a cross-encoder reads
// query and document as one sequence in a single encoder pass. The document
// side of the first two is precomputed and indexed; the third has no
// query-independent document representation.
//
// The cost rows use only the chapter's quantities: the raw index payload
// S_raw = N d b (d coordinates per stored vector, b bytes per coordinate, one
// vector per document or one per document token), the number of encoder
// passes, and the multiply-adds of scoring C candidates (C = N for the whole
// corpus by exact search, or k for reranking). The sizes T_q = 32, T_d = 128,
// d = 768 and 128 coordinates per token vector are illustrative, as are the
// MaxSim similarities drawn in the grid (seeded).

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { compact, fixed, si, sig, tpl } from "./lib/format.ts";

const T_Q = 32; // query tokens
const T_D = 128; // document tokens
const D = 768; // coordinates of one pooled vector
const D_TOK = 128; // coordinates of one token vector

type Role = "corpus" | "rerank";
type P = { corpus: number; role: Role; k: number; bytes: number };
type Arch = "dual" | "late" | "cross";
const ARCHS: Arch[] = ["dual", "late", "cross"];

// Illustrative MaxSim grid: 4 query tokens by 6 document tokens, seeded.
const GQ = 4, GD = 6;
const GRID: number[][] = (() => {
  const u = rng(5);
  return Array.from({ length: GQ }, () => {
    const hot = Math.floor(u() * GD);
    return Array.from({ length: GD }, (_, j) => Math.round((j === hot ? 0.55 + u() * 0.35 : -0.1 + u() * 0.5) * 100) / 100);
  });
})();
const ROW_MAX = GRID.map((r) => Math.max(...r));
const LI_SCORE = ROW_MAX.reduce((a, b) => a + b, 0);

interface Costs { index: number; offline: number; passes: number; macs: number | null }

function costs(a: Arch, p: P): Costs {
  const N = p.corpus;
  const cand = p.role === "corpus" ? N : Math.min(p.k, N);
  if (a === "dual") return { index: N * D * p.bytes, offline: N, passes: 1, macs: cand * D };
  if (a === "late") return { index: N * T_D * D_TOK * p.bytes, offline: N, passes: 1, macs: cand * T_Q * T_D * D_TOK };
  return { index: 0, offline: 0, passes: cand, macs: null };
}

const labels = {
  en: {
    title: "Where query and document meet, and the cost envelope it fixes",
    dual: "Dual encoder",
    late: "Late interaction",
    cross: "Cross-encoder",
    dualShort: "dual",
    lateShort: "late",
    crossShort: "cross",
    pre: "precomputed",
    joint: "one joint encoder pass",
    score: "score",
    maxCol: "max",
    sum: "Σ = {v}",
    dualNote: "Index: one pooled vector per document. Per pair: one inner product.",
    lateNote: "Index: one vector per document token. Per pair: T_q × T_d comparisons, then the sum of each query token's best match.",
    crossNote: "Index: nothing query-independent. Per pair: one encoder pass over the query and the document together.",
    envelope: "Cost envelope, N = {n} documents, {mode}",
    modeCorpus: "scoring the whole corpus",
    modeRerank: "reranking k = {k} candidates",
    rIndex: "Index payload S_raw = N·d·b",
    rOffline: "Document encoder passes, before any query",
    rPasses: "Encoder passes per query",
    rMacs: "Scoring multiply-adds per query",
    none: "none",
    noIndex: "no vectors to index",
    inPasses: "inside the encoder passes",
    ratio: "Late interaction stores T_d × 128 / d = {r}× the bytes of one pooled vector per document.",
    crossCorpus: "Over the whole corpus a cross-encoder runs {c} encoder passes for every query, which is why its usual role is reranking.",
    crossRerank: "On k = {k} candidates the cross-encoder runs {k} passes per query; the candidates still come from a first stage over all N documents.",
    describe: "N = {n} documents, {b} bytes per coordinate, {mode}. Index payload: dual encoder {i1}, late interaction {i2}, cross-encoder none. Encoder passes per query: 1, 1, and {p3}.",
  },
  zh: {
    title: "查询与文档在何处交互，以及由此决定的成本边界",
    dual: "双编码器",
    late: "后期交互",
    cross: "交叉编码器",
    dualShort: "双编码",
    lateShort: "后期交互",
    crossShort: "交叉编码",
    pre: "预先计算",
    joint: "一次联合编码",
    score: "分数",
    maxCol: "最大",
    sum: "Σ = {v}",
    dualNote: "索引：每篇文档一个池化向量。每个文本对：一次内积。",
    lateNote: "索引：文档中每个词元一个向量。每个文本对：T_q × T_d 次比较，再把每个查询词元的最佳匹配相加。",
    crossNote: "索引：没有与查询无关的内容可存。每个文本对：把查询和文档放在一起做一次编码。",
    envelope: "成本边界，N = {n} 篇文档，{mode}",
    modeCorpus: "对全部语料评分",
    modeRerank: "重排 k = {k} 个候选",
    rIndex: "索引载荷 S_raw = N·d·b",
    rOffline: "查询到来之前的文档编码次数",
    rPasses: "每个查询的编码次数",
    rMacs: "每个查询的评分乘加次数",
    none: "无",
    noIndex: "没有要索引的向量",
    inPasses: "包含在编码计算中",
    ratio: "后期交互为每篇文档保存 T_d × 128 / d = {r} 倍于单个池化向量的字节数。",
    crossCorpus: "对全部语料评分时，交叉编码器每个查询都要运行 {c} 次编码，所以它通常只用于重排。",
    crossRerank: "对 k = {k} 个候选重排时，交叉编码器每个查询运行 {k} 次编码；这些候选仍来自覆盖全部 N 篇文档的第一阶段。",
    describe: "N = {n} 篇文档，每个坐标 {b} 字节，{mode}。索引载荷：双编码器 {i1}，后期交互 {i2}，交叉编码器无。每个查询的编码次数：1、1 和 {p3}。",
  },
};
type L = typeof labels.en;

function modeText(p: P, Lx: L) {
  return p.role === "corpus" ? Lx.modeCorpus : tpl(Lx.modeRerank, { k: compact(p.k) });
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  return tpl(Lx.describe, {
    n: compact(p.corpus), b: p.bytes, mode: modeText(p, Lx),
    i1: si(costs("dual", p).index, "B"), i2: si(costs("late", p).index, "B"), p3: compact(costs("cross", p).passes),
  });
}

// ---- the three schematics

const TOK = 12; // token square
const tokRow = (x: number, y: number, n: number, fill: string, gap = 3) =>
  Array.from({ length: n }, (_, i) => el("rect", { x: x + i * (TOK + gap), y, width: TOK, height: TOK, rx: 2, fill }));

function preBox(x: number, y: number, w: number, h: number, Lx: L): string {
  return el("rect", { x, y, width: w, height: h, rx: 4, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "4 3" })
    + text(x + w - 4, y + h + 14, Lx.pre, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" });
}

function panelDual(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.dual, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const qx = x0 + 6, qy = y0 + 28;
  parts.push(...tokRow(qx, qy, 4, C.c1));
  const ux = qx + (4 * (TOK + 3) - 3) / 2, uy = qy + 42;
  for (let i = 0; i < 4; i++) parts.push(el("line", { x1: qx + i * 15 + TOK / 2, y1: qy + TOK, x2: ux, y2: uy - 9, stroke: C.c1, "stroke-width": 1.2 }));
  const dy = y0 + 124, dx = x0 + 6;
  const vx = dx + (6 * (TOK + 3) - 3) / 2, vy = dy - 30;
  for (let i = 0; i < 6; i++) parts.push(el("line", { x1: dx + i * 15 + TOK / 2, y1: dy, x2: vx, y2: vy + 9, stroke: C.c2, "stroke-width": 1.2 }));
  parts.push(...tokRow(dx, dy, 6, C.c2));
  parts.push(preBox(dx - 4, vy - 13, 6 * 15 + 5, dy + TOK + 4 - (vy - 13), Lx));
  for (const [cx, cy, s, c] of [[ux, uy, "u", C.c1], [vx, vy, "v", C.c2]] as const) {
    parts.push(el("circle", { cx, cy, r: 9, fill: C.paper, stroke: c, "stroke-width": 2 }));
    parts.push(text(cx, cy + 4, s, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  }
  // The single meeting point.
  const mx = Math.min(x0 + w - 30, dx + 6 * 15 + 44), my = (uy + vy) / 2;
  parts.push(el("path", { d: `M${ux + 9},${uy}L${mx - 16},${my - 3}M${vx + 9},${vy}L${mx - 16},${my + 3}`, fill: "none", stroke: C.ink2, "stroke-width": 1.2 }));
  parts.push(el("rect", { x: mx - 16, y: my - 11, width: 34, height: 22, rx: 4, fill: C.panel, stroke: C.ink2 }));
  parts.push(text(mx + 1, my + 4, "u·v", { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  return { svg: g({}, ...parts), h: dy + TOK + 18 - y0 };
}

function panelLate(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.late, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const cell = 16;
  const rowY = y0 + 44; // document token vectors, below the "precomputed" label
  const gx = x0 + 6 + TOK + 6, gy = rowY + TOK + 8;
  // Document token vectors across the top (precomputed), query token vectors down the side.
  for (let j = 0; j < GD; j++) parts.push(el("rect", { x: gx + j * cell + 2, y: rowY, width: TOK, height: TOK, rx: 2, fill: C.c2 }));
  parts.push(el("rect", { x: gx - 2, y: rowY - 4, width: GD * cell + 2, height: TOK + 8, rx: 4, fill: "none", stroke: C.ink3, "stroke-dasharray": "4 3" }));
  for (let i = 0; i < GQ; i++) {
    parts.push(el("rect", { x: x0 + 6, y: gy + i * cell + 2, width: TOK, height: TOK, rx: 2, fill: C.c1 }));
    const best = GRID[i].indexOf(ROW_MAX[i]);
    for (let j = 0; j < GD; j++) {
      const v = GRID[i][j];
      parts.push(el("rect", { x: gx + j * cell + 1, y: gy + i * cell + 1, width: cell - 2, height: cell - 2, rx: 2, fill: C.panel }));
      if (v > 0) parts.push(el("rect", { x: gx + j * cell + 1, y: gy + i * cell + 1, width: cell - 2, height: cell - 2, rx: 2, fill: C.ink2, "fill-opacity": (0.1 + 0.9 * v).toFixed(2) }));
      if (j === best) parts.push(el("rect", { x: gx + j * cell + 0.5, y: gy + i * cell + 0.5, width: cell - 1, height: cell - 1, rx: 2, fill: "none", stroke: C.ink, "stroke-width": 1.8 }));
    }
    parts.push(text(gx + GD * cell + 30, gy + i * cell + 12, fixed(ROW_MAX[i], 2), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  }
  parts.push(text(gx + GD * cell + 30, gy - 4, Lx.maxCol, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  const sy = gy + GQ * cell;
  parts.push(el("line", { x1: gx + GD * cell + 4, x2: gx + GD * cell + 30, y1: sy + 2, y2: sy + 2, stroke: C.ink2 }));
  parts.push(text(gx + GD * cell + 30, sy + 17, tpl(Lx.sum, { v: fixed(LI_SCORE, 2) }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  parts.push(text(gx - 2, rowY - 9, Lx.pre, { "font-size": TYPE.body, class: "fig-t-muted" }));
  return { svg: g({}, ...parts), h: sy + 24 - y0 };
}

function panelCross(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [text(x0, y0 + 14, Lx.cross, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const n = 10, gap = 3;
  const rowW = n * (TOK + gap) - gap;
  const tx = x0 + 6, ty = y0 + 124;
  const bx = tx - 2, by = y0 + 66, bw = Math.max(rowW + 4, textWidth(Lx.joint, TYPE.body) + 16), bh = 30;
  for (let i = 0; i < n; i++) {
    const cx = tx + i * (TOK + gap) + TOK / 2;
    parts.push(el("line", { x1: cx, x2: cx, y1: ty, y2: by + bh, stroke: i < 4 ? C.c1 : C.c2, "stroke-width": 1.2 }));
  }
  parts.push(...tokRow(tx, ty, 4, C.c1, gap));
  parts.push(...tokRow(tx + 4 * (TOK + gap), ty, 6, C.c2, gap));
  parts.push(el("rect", { x: bx, y: by, width: bw, height: bh, rx: 5, fill: C.panel, stroke: C.ink2 }));
  parts.push(text(bx + bw / 2, by + bh / 2 + 4, Lx.joint, { "font-size": TYPE.body, "text-anchor": "middle" }));
  const sx = bx + bw / 2;
  parts.push(el("line", { x1: sx, x2: sx, y1: by, y2: y0 + 46, stroke: C.ink2, "stroke-width": 1.2 }));
  const sw = textWidth(Lx.score, TYPE.body) + 14;
  parts.push(el("rect", { x: sx - sw / 2, y: y0 + 26, width: sw, height: 20, rx: 4, fill: C.panel, stroke: C.ink2 }));
  parts.push(text(sx, y0 + 40, Lx.score, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  return { svg: g({}, ...parts), h: ty + TOK + 18 - y0 };
}

// ---- the cost rows

function costRows(p: P, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const part of wrap(tpl(Lx.envelope, { n: compact(p.corpus), mode: modeText(p, Lx) }), TYPE.label, w)) {
    parts.push(text(x0, y + 14, part, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18;
  }
  y += 6;
  const names = { dual: Lx.dualShort, late: Lx.lateShort, cross: Lx.crossShort };
  const nameW = Math.max(...ARCHS.map((a) => textWidth(names[a], TYPE.body))) + 10;
  const valW = 64;
  const all = ARCHS.map((a) => costs(a, p));
  const rows: Array<{ title: string; vals: Array<number | null>; fmt: (v: number) => string; zero: string; nul: string }> = [
    { title: Lx.rIndex, vals: all.map((c) => c.index), fmt: (v) => si(v, "B"), zero: Lx.noIndex, nul: "" },
    { title: Lx.rOffline, vals: all.map((c) => c.offline), fmt: compact, zero: Lx.none, nul: "" },
    { title: Lx.rPasses, vals: all.map((c) => c.passes), fmt: compact, zero: Lx.none, nul: "" },
    { title: Lx.rMacs, vals: all.map((c) => c.macs), fmt: compact, zero: Lx.none, nul: Lx.inPasses },
  ];
  for (const row of rows) {
    parts.push(text(x0, y + 13, row.title, { "font-size": TYPE.body, class: "fig-t-strong" }));
    y += 20;
    // Linear within the row, so the bars compare the three scorers directly.
    const hi = Math.max(1, ...row.vals.map((v) => v ?? 0));
    const x = (v: number) => x0 + nameW + (v / hi) * (w - valW - nameW);
    ARCHS.forEach((a, i) => {
      const v = row.vals[i];
      parts.push(text(x0, y + 12, names[a], { "font-size": TYPE.body, class: "fig-t-muted" }));
      parts.push(el("rect", { x: x0 + nameW, y: y + 2, width: x0 + w - valW - (x0 + nameW), height: 12, rx: 2, fill: C.panel }));
      if (v == null || v === 0) {
        parts.push(text(x0 + nameW + 4, y + 12, v == null ? row.nul : row.zero, { "font-size": TYPE.body, class: "fig-t-faint" }));
      } else {
        const bw = Math.max(2, x(v) - x(0));
        parts.push(el("rect", { x: x0 + nameW, y: y + 2, width: bw, height: 12, rx: 2, fill: C.ink2, "fill-opacity": 0.75 }));
        parts.push(text(x0 + w, y + 12, row.fmt(v), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
      }
      y += 17;
    });
    y += 8;
  }
  return { svg: g({ class: "fig-costs" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [];
  const panels = [panelDual, panelLate, panelCross];
  const notes = [Lx.dualNote, Lx.lateNote, Lx.crossNote];
  let y = 0;
  if (narrow) {
    panels.forEach((f, i) => {
      const pnl = f(0, y, w, Lx);
      parts.push(pnl.svg);
      y += pnl.h + 4;
      for (const ln of wrap(notes[i], TYPE.body, w)) { parts.push(text(0, y + 12, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 16; }
      y += 16;
    });
  } else {
    const gap = 18;
    const pw = Math.floor((w - 2 * gap) / 3);
    let bottom = 0;
    const drawn = panels.map((f, i) => f(i * (pw + gap), 0, pw, Lx));
    const top = Math.max(...drawn.map((d) => d.h));
    drawn.forEach((d, i) => {
      parts.push(d.svg);
      let yy = top + 4;
      for (const ln of wrap(notes[i], TYPE.body, pw)) { parts.push(text(i * (pw + gap), yy + 12, ln, { "font-size": TYPE.body, class: "fig-t-muted" })); yy += 16; }
      bottom = Math.max(bottom, yy);
    });
    y = bottom + 22;
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y - 10, y2: y - 10, stroke: C.grid }));
  const cr = costRows(p, 0, y, w, Lx);
  parts.push(cr.svg);
  y += cr.h + 4;
  const late = costs("late", p), dual = costs("dual", p), cross = costs("cross", p);
  const lines = [
    tpl(Lx.ratio, { r: sig(late.index / dual.index, 3) }),
    p.role === "corpus" ? tpl(Lx.crossCorpus, { c: compact(cross.passes) }) : tpl(Lx.crossRerank, { k: compact(Math.min(p.k, p.corpus)) }),
  ];
  for (const ln of lines) {
    for (const part of wrap(ln, TYPE.body, w)) { parts.push(text(0, y + 12, part, { "font-size": TYPE.body, class: "fig-t-num" })); y += 17; }
    y += 2;
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "interaction-cost",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    corpus: { kind: "range", scale: "log", label: { en: "Corpus size N", zh: "语料规模 N" }, unit: { en: "documents", zh: "篇文档" }, min: 1e4, max: 1e9, default: 1e7 },
    role: {
      kind: "choice", label: { en: "Scored at query time", zh: "查询时评分的范围" }, default: "corpus",
      options: [
        { value: "corpus", label: { en: "Whole corpus", zh: "全部语料" } },
        { value: "rerank", label: { en: "k candidates", zh: "k 个候选" } },
      ],
    },
    k: { kind: "range", scale: "log", label: { en: "Reranked candidates k", zh: "重排候选数 k" }, min: 10, max: 10000, default: 100 },
    bytes: {
      kind: "choice", label: { en: "Bytes per coordinate b", zh: "每个坐标的字节数 b" }, default: 2,
      options: [
        { value: 4, label: { en: "4 (FP32)", zh: "4（FP32）" } },
        { value: 2, label: { en: "2 (FP16)", zh: "2（FP16）" } },
        { value: 1, label: { en: "1 (INT8)", zh: "1（INT8）" } },
      ],
    },
  },
  // Moving the candidate count means reranking that many candidates.
  update(p, key) {
    if (key === "k") return { ...p, role: "rerank" };
    return p;
  },
  render,
  describe,
});
