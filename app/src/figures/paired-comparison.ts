// Paired comparison of two systems scored on the same G binary items.
//
// One illustrative evaluation, with counts set by the controls rather than
// drawn at random: A answers pA = 70% of the items correctly and B answers
// pA + gain. The per-item correlation ρ (the phi coefficient of the two
// outcome indicators) fixes how many items both get right,
//
//   n11 = round(G · (pA·pB + ρ·√(pA(1 − pA)·pB(1 − pB)))),
//
// and the rest of the chapter's disagreement table follows from the two
// accuracies: n10 = nA − n11, n01 = nB − n11, n00 = G − n11 − n10 − n01.
// Changing ρ moves items between the diagonal and the off-diagonal cells while
// both row and column totals, and so both accuracies, stay fixed.
//
// Everything drawn is computed from that table with the chapter's formulas:
//
//   separate intervals   p ± 1.96 √(p(1 − p) / G)             (h_Wald)
//   d_g = y_gB − y_gA,   Δ̂ = (n01 − n10) / G
//   Var(d) = (n10 + n01) / G − Δ̂² = Var(A) + Var(B) − 2 Cov(A, B)
//   paired interval      Δ̂ ± 1.96 √(Var(d) / G)
//   unpaired interval    Δ̂ ± 1.96 √((Var(A) + Var(B)) / G)
//   McNemar              χ² = (n10 − n01)² / (n10 + n01)
//
// Items needed for 80% power at a two-sided α = 0.05 use Miller (2024),
// "Adding Error Bars to Evals", eq. 9 with no answer resampling:
// G = (z_{α/2} + z_β)² ω² / δ², with ω² = Var(d) for the paired analysis and
// Var(A) + Var(B) when the pairing is ignored, and δ the gain on screen.
// Variances are the plug-in (divide by G) forms, as in h_Wald.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const ACC_A = 0.7; // A's accuracy, illustrative
const Z = 1.96; // two-sided 95%, the chapter's multiplier
const Z_BETA = 0.8416; // one-sided 80% power

type P = { items: number; gain: number; rho: number };

interface Interval { lo: number; hi: number; mid: number }
const iv = (mid: number, half: number): Interval => ({ lo: mid - half, hi: mid + half, mid });

function model(p: P) {
  const G = Math.max(10, Math.round(p.items));
  const nA = Math.round(ACC_A * G);
  const nB = Math.min(G, Math.round((ACC_A + p.gain / 100) * G));
  const a = nA / G, b = nB / G;
  const varA = a * (1 - a), varB = b * (1 - b);
  const sAB = Math.sqrt(varA * varB);
  // Feasible n11 given the margins; ρ above the largest feasible value is capped.
  const lo = Math.max(0, nA + nB - G), hi = Math.min(nA, nB);
  const rhoMax = sAB > 0 ? (hi / G - a * b) / sAB : 0;
  const rho = Math.min(p.rho, rhoMax);
  const n11 = Math.min(hi, Math.max(lo, Math.round((a * b + rho * sAB) * G)));
  const n10 = nA - n11, n01 = nB - n11, n00 = G - n11 - n10 - n01;
  const cov = n11 / G - a * b;
  const r = sAB > 0 ? cov / sAB : 0;
  const delta = (n01 - n10) / G;
  const varD = (n10 + n01) / G - delta * delta;
  const seP = Math.sqrt(varD / G), seU = Math.sqrt((varA + varB) / G);
  const k = (Z + Z_BETA) ** 2;
  const disc = n10 + n01;
  return {
    G, nA, nB, a, b, n11, n10, n01, n00, varA, varB, cov, r, delta, varD, seP, seU,
    capped: p.rho > rhoMax + 1e-9,
    A: iv(a, Z * Math.sqrt(varA / G)),
    B: iv(b, Z * Math.sqrt(varB / G)),
    paired: iv(delta, Z * seP),
    unpaired: iv(delta, Z * seU),
    chi2: disc > 0 ? (n10 - n01) ** 2 / disc : 0,
    needP: delta > 0 ? Math.ceil((k * varD) / (delta * delta)) : Infinity,
    needU: delta > 0 ? Math.ceil((k * (varA + varB)) / (delta * delta)) : Infinity,
  };
}
type M = ReturnType<typeof model>;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Paired comparison of two systems on the same items",
    alone: "Each system alone: 95% interval of accuracy (%)",
    diff: "B − A: 95% interval of the difference (pp)",
    rowA: "A",
    rowB: "B",
    unpaired: "ignoring pairs",
    paired: "paired, from d_g",
    overlap: "overlap {v} pp",
    gap: "gap {v} pp",
    table: "Items by outcome, G = {g}",
    bRight: "B right",
    bWrong: "B wrong",
    aRight: "A right",
    aWrong: "A wrong",
    total: "total",
    dg: "d_g is +1 on {p} items, −1 on {m}, 0 on {z}",
    corr: "sample correlation r = {r}",
    capped: "ρ capped at {r}: every item A gets right, B also gets right",
    terms: "From the table",
    ppUnit: "{v} pp",
    nDelta: "mean d_g", fDelta: "(n₀₁ − n₁₀) / G",
    nVarA: "Var(A)", fVarA: "p_A(1 − p_A)",
    nVarB: "Var(B)", fVarB: "p_B(1 − p_B)",
    nCov: "Cov(A, B)", fCov: "n₁₁ / G − p_A p_B",
    nVarD: "Var(d)", fVarD: "Var(A) + Var(B) − 2 Cov",
    nSeP: "SE paired", fSeP: "√(Var(d) / G)",
    nSeU: "SE ignoring pairs", fSeU: "√((Var(A) + Var(B)) / G)",
    nChi: "McNemar χ²", fChi: "(n₁₀ − n₀₁)² / (n₁₀ + n₀₁)",
    fNeedP: "items for 80% power, paired",
    fNeedU: "items for 80% power, ignoring pairs",
    chiNote: "χ² above 3.84: incompatible with zero difference at the 5% level",
    needNote: "items = (1.96 + 0.84)² · Var / δ², δ the gain, with Var(d) paired and Var(A) + Var(B) ignoring pairs",
    describe: "{g} items, A {a}, B {b}, per-item correlation {r}: the separate 95% intervals of A and B {ov}. The interval for B − A runs from {u0} to {u1} pp ignoring the pairs and from {p0} to {p1} pp from the paired differences, which {px} zero. Detecting this gain with 80% power needs {np} items paired and {nu} ignoring the pairs.",
    ovYes: "overlap by {v} pp",
    ovNo: "are {v} pp apart",
    dExcl: "excludes",
    dIncl: "includes",
  },
  zh: {
    title: "同一批项目上的两个系统的配对比较",
    alone: "各自单独计算：准确率的 95% 区间（%）",
    diff: "B − A：差值的 95% 区间（百分点）",
    rowA: "A",
    rowB: "B",
    unpaired: "忽略配对",
    paired: "配对，由 d_g 计算",
    overlap: "重叠 {v} 个百分点",
    gap: "相距 {v} 个百分点",
    table: "按结果统计的项目，G = {g}",
    bRight: "B 对",
    bWrong: "B 错",
    aRight: "A 对",
    aWrong: "A 错",
    total: "合计",
    dg: "d_g 为 +1 的项目 {p} 个，−1 的 {m} 个，0 的 {z} 个",
    corr: "样本相关系数 r = {r}",
    capped: "ρ 最多为 {r}：A 答对的项目 B 全部答对",
    terms: "由表中计数得到",
    ppUnit: "{v} 个百分点",
    nDelta: "d_g 的均值", fDelta: "(n₀₁ − n₁₀) / G",
    nVarA: "Var(A)", fVarA: "p_A(1 − p_A)",
    nVarB: "Var(B)", fVarB: "p_B(1 − p_B)",
    nCov: "Cov(A, B)", fCov: "n₁₁ / G − p_A p_B",
    nVarD: "Var(d)", fVarD: "Var(A) + Var(B) − 2 Cov",
    nSeP: "配对标准误", fSeP: "√(Var(d) / G)",
    nSeU: "忽略配对的标准误", fSeU: "√((Var(A) + Var(B)) / G)",
    nChi: "McNemar χ²", fChi: "(n₁₀ − n₀₁)² / (n₁₀ + n₀₁)",
    fNeedP: "80% 功效所需项目数，配对",
    fNeedU: "80% 功效所需项目数，忽略配对",
    chiNote: "χ² 超过 3.84：在 5% 水平上与零差异不相容",
    needNote: "项目数 = (1.96 + 0.84)² · Var / δ²，δ 为提升幅度；配对时 Var 取 Var(d)，忽略配对时取 Var(A) + Var(B)",
    describe: "{g} 个项目，A 的准确率 {a}，B 为 {b}，逐项相关系数 {r}：A 和 B 各自的 95% 区间{ov}。B − A 的区间忽略配对时为 {u0} 到 {u1} 个百分点，由配对差值计算时为 {p0} 到 {p1} 个百分点，{px} 0。要以 80% 功效检出这个提升，配对需要 {np} 个项目，忽略配对需要 {nu} 个。",
    ovYes: "重叠 {v} 个百分点",
    ovNo: "相距 {v} 个百分点",
    dExcl: "不含",
    dIncl: "包含",
  },
};
type L = typeof labels.en;

const pp = (v: number) => fixed(v * 100, 1);
const pctS = (v: number) => `${fixed(v * 100, 1)}%`;
const range = (i: Interval) => `[${pp(i.lo)}, ${pp(i.hi)}]`;
const signed = (v: number) => (v > 0 ? `+${fixed(v, 0)}` : fixed(v, 0));

// Overlap of the separate intervals (negative: the gap between them), from
// the endpoints as printed so the note agrees with them.
function overlap(m: M): { lo: number; hi: number; v: number } {
  const r1 = (v: number) => Math.round(v * 1000) / 1000;
  const lo = Math.max(r1(m.A.lo), r1(m.B.lo)), hi = Math.min(r1(m.A.hi), r1(m.B.hi));
  return { lo, hi, v: hi - lo };
}

// Lines of wrapped text, with CJK line-start rules for zh.
function lines(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w);
}

// ---------------------------------------------------------------- intervals

// Span (in percentage points) both interval axes share, so one point of
// accuracy and one point of difference are the same length on screen. Snapped
// to a few sizes so the axes do not jitter as the item count changes.
const SPANS = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80];
function sharedSpan(m: M): number {
  const acc = (m.B.hi - m.A.lo) * 100;
  const dif = (Math.max(0, m.unpaired.hi) - Math.min(0, m.unpaired.lo)) * 100;
  const need = Math.max(acc, dif) * 1.12;
  return SPANS.find((s) => s >= need) ?? need;
}

function renderIntervals(m: M, x0: number, y0: number, w: number, narrow: boolean, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const labelW = narrow ? 0 : Math.max(...[Lx.unpaired, Lx.paired, Lx.rowA].map((s) => textWidth(s, TYPE.body))) + 14;
  const valueW = narrow ? 0 : textWidth("[−10.0, 10.0]", TYPE.body) + 10;
  const px0 = x0 + labelW + (narrow ? 6 : 0);
  const px1 = x0 + w - valueW - (narrow ? 6 : 8);
  const span = sharedSpan(m);
  const step = niceStep(span, narrow ? 4 : 7);
  const rowGap = narrow ? 40 : 26;
  const barH = 12;
  let y = y0;

  // One block: a heading, rows of intervals, the axis.
  const block = (heading: string, domain: [number, number], rows: Array<{ label: string; i: Interval; fill: string; dash?: boolean }>, shade: [number, number] | null, shadeLabel: string, zero: boolean) => {
    const x = linear(domain, [px0, px1]);
    for (const ln of lines(heading, TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
    y += 8;
    const top = y;
    const bottom = top + 18 + rows.length * rowGap;
    // Gridlines and tick values.
    const ticks: number[] = [];
    for (let v = Math.ceil(domain[0] / step) * step; v <= domain[1] + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    // Vertical lines. In the phone layout each row's label line sits inside
    // the plot, so vertical lines break around it instead of crossing the text.
    const gaps: Array<[number, number]> = narrow
      ? rows.map((_, k) => { const cy = top + 18 + k * rowGap + rowGap / 2 + 6; return [cy - barH / 2 - 21, cy - barH / 2 - 2] as [number, number]; })
      : [];
    const vline = (xv: number, a: Record<string, string | number>) => {
      let y0 = top;
      for (const [g0, g1] of gaps) { if (g0 > y0) parts.push(el("line", { x1: xv, x2: xv, y1: y0, y2: g0, ...a })); y0 = g1; }
      parts.push(el("line", { x1: xv, x2: xv, y1: y0, y2: bottom, ...a }));
    };
    for (const v of ticks) vline(x(v), { stroke: C.grid, "stroke-width": 1 });
    if (shade && shade[1] > shade[0]) {
      parts.push(el("rect", { x: x(shade[0]), y: top, width: x(shade[1]) - x(shade[0]), height: bottom - top, fill: C.ink, "fill-opacity": 0.07 }));
    }
    if (zero) vline(x(0), { stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" });
    // The note over the plot: overlap or gap of the separate intervals.
    if (shadeLabel) {
      const cx = shade ? (x(shade[0]) + x(shade[1])) / 2 : (px0 + px1) / 2;
      const tw = textWidth(shadeLabel, TYPE.body);
      const tx = Math.min(Math.max(cx - tw / 2, px0), px1 - tw);
      parts.push(text(tx, top + 13, shadeLabel, { "font-size": TYPE.body, class: "fig-t-halo fig-t-soft fig-t-num" }));
    }
    let ry = top + 18;
    for (const r of rows) {
      const cy = ry + rowGap / 2 + (narrow ? 6 : 0);
      if (narrow) {
        parts.push(text(x0, cy - barH / 2 - 6, r.label, { "font-size": TYPE.body, class: "fig-t-halo fig-t-soft" }));
        parts.push(text(x0 + w, cy - barH / 2 - 6, range(r.i), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-halo fig-t-soft fig-t-num" }));
      } else {
        parts.push(text(x0, cy + 4, r.label, { "font-size": TYPE.body }));
        parts.push(text(x0 + w, cy + 4, range(r.i), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
      }
      const bx0 = x(r.i.lo * 100), bx1 = x(r.i.hi * 100);
      parts.push(el("rect", { x: bx0, y: cy - barH / 2, width: Math.max(1, bx1 - bx0), height: barH, rx: 3,
        fill: r.dash ? C.panel : r.fill, "fill-opacity": r.dash ? undefined : 0.85,
        stroke: r.dash ? C.ink2 : undefined, "stroke-width": r.dash ? 1.2 : undefined, "stroke-dasharray": r.dash ? "4 3" : undefined }));
      parts.push(el("line", { x1: x(r.i.mid * 100), x2: x(r.i.mid * 100), y1: cy - barH / 2 - 3, y2: cy + barH / 2 + 3, stroke: C.ink, "stroke-width": 2 }));
      ry += rowGap;
    }
    // Axis baseline, ticks, and values.
    parts.push(el("line", { x1: px0, x2: px1, y1: bottom, y2: bottom, stroke: C.rule, "stroke-width": 1 }));
    let lastEdge = -Infinity;
    for (const v of ticks) {
      parts.push(el("line", { x1: x(v), x2: x(v), y1: bottom, y2: bottom + 5, stroke: C.rule, "stroke-width": 1 }));
      const s = zero ? signed(v) : fixed(v, 0);
      const tw = textWidth(s, TYPE.body);
      if (x(v) - tw / 2 < lastEdge + 6) continue;
      lastEdge = x(v) + tw / 2;
      parts.push(text(x(v), bottom + 19, s, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
    }
    y = bottom + 24;
  };

  const accMid = ((m.A.lo + m.B.hi) / 2) * 100;
  const { lo, hi, v: ov } = overlap(m);
  block(Lx.alone, [accMid - span / 2, accMid + span / 2], [
    { label: Lx.rowA, i: m.A, fill: C.c1 },
    { label: Lx.rowB, i: m.B, fill: C.c2 },
  ], ov > 0 ? [lo * 100, hi * 100] : null, tpl(ov > 0 ? Lx.overlap : Lx.gap, { v: pp(Math.abs(ov)) }), false);
  y += 14;
  const dLo = Math.min(0, m.unpaired.lo) * 100, dHi = Math.max(0, m.unpaired.hi) * 100;
  const dMid = (dLo + dHi) / 2;
  block(Lx.diff, [dMid - span / 2, dMid + span / 2], [
    { label: Lx.unpaired, i: m.unpaired, fill: C.panel, dash: true },
    { label: Lx.paired, i: m.paired, fill: C.c3 },
  ], null, "", true);
  return { svg: g({ class: "fig-intervals" }, ...parts), h: y - y0 };
}

// ---------------------------------------------------------------- table

function renderTable(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(Lx.table, { g: int(m.G) }), TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 10;
  const lw = Math.max(textWidth(Lx.aRight, TYPE.body), textWidth(Lx.aWrong, TYPE.body), textWidth(Lx.total, TYPE.body)) + 10;
  const totW = Math.max(textWidth(Lx.total, TYPE.body), textWidth("5,000", TYPE.body)) + 8;
  const cw = Math.min(92, Math.floor((w - lw - totW - 4) / 2));
  const ch = 66;
  const cx = [x0 + lw, x0 + lw + cw + 4];
  const tx = x0 + lw + 2 * cw + 8;
  // Column headers.
  parts.push(text(cx[0] + cw / 2, y + 12, Lx.bRight, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(cx[1] + cw / 2, y + 12, Lx.bWrong, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(tx + totW, y + 12, Lx.total, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 20;
  const cells: Array<[string, number, string]> = [
    ["n₁₁", m.n11, C.ink3], ["n₁₀", m.n10, C.c1],
    ["n₀₁", m.n01, C.c2], ["n₀₀", m.n00, C.ink3],
  ];
  const smax = Math.min(cw, ch) - 22;
  for (let r = 0; r < 2; r++) {
    const ry = y + r * (ch + 4);
    parts.push(text(x0, ry + ch / 2 + 4, r === 0 ? Lx.aRight : Lx.aWrong, { "font-size": TYPE.body, class: "fig-t-muted" }));
    for (let c = 0; c < 2; c++) {
      const [name, n, fill] = cells[r * 2 + c];
      const off = r !== c;
      parts.push(el("rect", { x: cx[c], y: ry, width: cw, height: ch, rx: 4, fill: C.panel, stroke: off ? C.ink3 : undefined, "stroke-width": off ? 1 : undefined }));
      const s = Math.sqrt(n / m.G) * smax;
      if (s >= 0.8) parts.push(el("rect", { x: cx[c] + (cw - s) / 2, y: ry + ch - 4 - s, width: s, height: s, rx: Math.min(2, s / 4), fill, "fill-opacity": off ? 0.9 : 0.45 }));
      parts.push(text(cx[c] + 6, ry + 15, `${name} ${int(n)}`, { "font-size": TYPE.body, class: off ? "fig-t-strong fig-t-num fig-t-halo" : "fig-t-num fig-t-halo fig-t-soft" }));
    }
    parts.push(text(tx + totW, ry + ch / 2 + 4, int(r === 0 ? m.nA : m.G - m.nA), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  }
  y += 2 * (ch + 4) + 14;
  parts.push(text(x0, y, Lx.total, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(cx[0] + cw / 2, y, int(m.nB), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  parts.push(text(cx[1] + cw / 2, y, int(m.G - m.nB), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  parts.push(text(tx + totW, y, int(m.G), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  y += 8;
  const notes = [tpl(Lx.dg, { p: int(m.n01), m: int(m.n10), z: int(m.n11 + m.n00) }), tpl(Lx.corr, { r: fixed(m.r, 2) })];
  if (m.capped) notes.push(tpl(Lx.capped, { r: fixed(m.r, 2) }));
  for (const note of notes) {
    for (const ln of lines(note, TYPE.body, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); }
  }
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 + 4 };
}

// ---------------------------------------------------------------- readout

function renderReadout(m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.terms, TYPE.label, w, lang)) { y += 17; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const need = (n: number) => (Number.isFinite(n) ? int(n) : "∞");
  const rows: Array<[string, string, string, boolean]> = [
    [Lx.nDelta, Lx.fDelta, tpl(Lx.ppUnit, { v: pp(m.delta) }), false],
    [Lx.nVarA, Lx.fVarA, fixed(m.varA, 4), false],
    [Lx.nVarB, Lx.fVarB, fixed(m.varB, 4), false],
    [Lx.nCov, Lx.fCov, fixed(m.cov, 4), false],
    [Lx.nVarD, Lx.fVarD, fixed(m.varD, 4), true],
    [Lx.nSeP, Lx.fSeP, tpl(Lx.ppUnit, { v: fixed(m.seP * 100, 2) }), true],
    [Lx.nSeU, Lx.fSeU, tpl(Lx.ppUnit, { v: fixed(m.seU * 100, 2) }), false],
    [Lx.nChi, Lx.fChi, fixed(m.chi2, 2), false],
    [Lx.fNeedP, "", need(m.needP), true],
    [Lx.fNeedU, "", need(m.needU), false],
  ];
  for (const [n, f, v, strong] of rows) {
    const valW = textWidth(v, TYPE.body) + 10;
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    // "name = formula" on one line when it fits, else the formula on its own line.
    const one = f ? `${n} = ${f}` : n;
    const fl = textWidth(one, TYPE.body) <= w - valW ? [one] : [n, `= ${f}`];
    fl.forEach((ln, i) => parts.push(text(x0 + (i ? 10 : 0), y + 14 + i * 15, ln, { "font-size": TYPE.body, class: "fig-t-num" })));
    parts.push(text(x0 + w, y + 14, v, { "font-size": TYPE.body, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    y += 5 + fl.length * 15;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 2;
  for (const note of [Lx.chiNote, Lx.needNote]) {
    for (const ln of lines(note, TYPE.body, w, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

// ---------------------------------------------------------------- figure

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  const ov = overlap(m).v;
  const excl = m.paired.lo > 0 || m.paired.hi < 0;
  return tpl(Lx.describe, {
    g: int(m.G), a: pctS(m.a), b: pctS(m.b), r: fixed(m.r, 2),
    ov: tpl(ov > 0 ? Lx.ovYes : Lx.ovNo, { v: pp(Math.abs(ov)) }),
    u0: pp(m.unpaired.lo), u1: pp(m.unpaired.hi), p0: pp(m.paired.lo), p1: pp(m.paired.hi),
    px: excl ? Lx.dExcl : Lx.dIncl, np: Number.isFinite(m.needP) ? int(m.needP) : "∞", nu: Number.isFinite(m.needU) ? int(m.needU) : "∞",
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  const ivs = renderIntervals(m, 0, 0, w, narrow, Lx, lang);
  parts.push(ivs.svg);
  let y = ivs.h + 18;
  if (narrow) {
    const tb = renderTable(m, 0, y, w, Lx, lang);
    parts.push(tb.svg); y += tb.h + 16;
    const ro = renderReadout(m, 0, y, w, Lx, lang);
    parts.push(ro.svg); y += ro.h;
  } else {
    const gap = 28;
    const tw = Math.floor((w - gap) * 0.42);
    const tb = renderTable(m, 0, y, tw, Lx, lang);
    const ro = renderReadout(m, tw + gap, y, w - tw - gap, Lx, lang);
    parts.push(tb.svg, ro.svg);
    y += Math.max(tb.h, ro.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "paired-comparison",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    rho: {
      kind: "range", label: { en: "Per-item correlation ρ", zh: "逐项相关系数 ρ" }, min: 0, max: 0.85, step: 0.05, default: 0.6,
      marks: [{ value: 0, label: { en: "independent", zh: "不相关" } }],
    },
    gain: {
      kind: "range", label: { en: "B's gain over A", zh: "B 比 A 高出" }, unit: { en: "pp", zh: "个百分点" }, min: 1, max: 6, step: 0.5, default: 4,
    },
    items: {
      kind: "range", scale: "log", label: { en: "Items G", zh: "项目数 G" }, min: 50, max: 5000, default: 500,
    },
  },
  render,
  describe,
});
