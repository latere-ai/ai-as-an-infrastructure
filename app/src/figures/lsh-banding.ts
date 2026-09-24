// LSH banding over MinHash signatures, on a seeded population of document
// pairs. The chapter's candidate probability for a pair with Jaccard
// similarity s, under b bands of r rows (signature length m = b·r), is
//
//   P_candidate(s) = 1 − (1 − s^r)^b.
//
// The curve is that equation. The dots are 300 illustrative pairs whose true
// similarity is drawn uniformly on [0, 1] from a fixed seed. For each pair the
// figure simulates the signature rows the equation idealizes: row j agrees
// (h_j(S(a)) = h_j(S(b))) with probability s, independently across rows, from
// a seeded hash of (seed, pair, row). A band matches when all r of its rows
// agree; a pair becomes a candidate when any band matches. Rows are indexed
// across the whole signature, so changing r regroups the same rows into
// different bands and the realized outcomes move consistently with the curve.
//
// Presets are published settings, written in the chapter's notation (b bands,
// r rows per band). Lee et al. (2022, §4.2 and App. A) write the same formula
// with the letters swapped: b = 20 hashes per bucket and r = 450 buckets,
// k = 9,000, verified candidates with Jaccard ≥ 0.8 and edit similarity ≥ 0.8;
// their stricter alternative is 40 buckets of 20 (k = 800) at 0.9. RefinedWeb
// (Penedo et al. 2023, App. G.3.1) uses Lee et al.'s parameters; its §3.3 prose
// says "20 buckets of 450 hashes", but its own equation and FineWeb's App. E.1
// read 450 buckets of 20, and only that reading collides at 0.8 with high
// probability. FineWeb (Penedo et al. 2024, App. E.1) uses 112 hashes in 14
// buckets of 8, targeting 75% similarity, and reports P = 56%, 77%, 92% and
// 98.8% at s = 0.7, 0.75, 0.8 and 0.85, which this function reproduces.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, sig, tpl } from "./lib/format.ts";
import { rng } from "./lib/random.ts";

// ---------------------------------------------------------------- model

const N_PAIRS = 300;

export const pCandidate = (s: number, b: number, r: number) => 1 - (1 - s ** r) ** b;

// Uniform in [0, 1) from three integers: a murmur3-style finalizer over a
// mixed key, so every (seed, pair, row) has its own reproducible draw.
function h01(a: number, b: number, c: number): number {
  let x = (Math.imul(a + 0x2545f491, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca77) ^ Math.imul(c + 0x165667b1, 0xc2b2ae3d)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

interface Pair { i: number; s: number; jitter: number }

const pairMemo = new Map<number, Pair[]>();
function pairs(seed: number): Pair[] {
  let hit = pairMemo.get(seed);
  if (!hit) {
    const u = rng(seed);
    hit = Array.from({ length: N_PAIRS }, (_, i) => ({ i, s: Math.round(u() * 1000) / 1000, jitter: u() }));
    pairMemo.set(seed, hit);
  }
  return hit;
}

const agrees = (seed: number, p: Pair, row: number) => h01(seed, p.i, row) < p.s;

// Does band k of pair p match (all r rows agree)?
function bandMatches(seed: number, p: Pair, k: number, r: number): boolean {
  for (let j = k * r; j < (k + 1) * r; j++) if (!agrees(seed, p, j)) return false;
  return true;
}

// Candidate status of every pair for one (b, r), memoized: render runs on
// every slider move, the simulation only when b, r or the seed changes.
const outMemo = new Map<string, Uint8Array>();
function outcomes(b: number, r: number, seed: number): Uint8Array {
  const key = `${b}|${r}|${seed}`;
  let hit = outMemo.get(key);
  if (!hit) {
    hit = new Uint8Array(N_PAIRS);
    for (const p of pairs(seed)) {
      for (let k = 0; k < b; k++) if (bandMatches(seed, p, k, r)) { hit[p.i] = 1; break; }
    }
    if (outMemo.size > 48) outMemo.clear();
    outMemo.set(key, hit);
  }
  return hit;
}

type PresetKey = "fineweb" | "lee" | "lee90" | "custom";
const PRESETS: Record<Exclude<PresetKey, "custom">, { b: number; r: number; tau: number }> = {
  fineweb: { b: 14, r: 8, tau: 0.75 },
  lee: { b: 450, r: 20, tau: 0.8 },
  lee90: { b: 40, r: 20, tau: 0.9 },
};

type P = { preset: PresetKey; bands: number; rows: number; tau: number; probe: number; seed: number };

function model(p: P) {
  const b = Math.max(1, Math.round(p.bands));
  const r = Math.max(1, Math.round(p.rows));
  const tau = p.tau;
  const all = pairs(p.seed);
  const out = outcomes(b, r, p.seed);
  let dup = 0, tp = 0, distinct = 0, fp = 0, eFN = 0, eFP = 0;
  for (const q of all) {
    const P1 = pCandidate(q.s, b, r);
    if (q.s >= tau) { dup++; if (out[q.i]) tp++; eFN += 1 - P1; }
    else { distinct++; if (out[q.i]) fp++; eFP += P1; }
  }
  // P = 0.5 exactly: s = (1 − 0.5^(1/b))^(1/r); the usual rule of thumb is (1/b)^(1/r).
  const s50 = (1 - 0.5 ** (1 / b)) ** (1 / r);
  // The pair nearest the probe similarity, and its bands.
  let sel = all[0];
  for (const q of all) if (Math.abs(q.s - p.probe) < Math.abs(sel.s - p.probe)) sel = q;
  let matched = 0, first = -1;
  for (let k = 0; k < b; k++) if (bandMatches(p.seed, sel, k, r)) { matched++; if (first < 0) first = k; }
  return { seed: p.seed, b, r, m: b * r, tau, all, out, dup, tp, fn: dup - tp, distinct, fp, eFN, eFP, s50, sel, selP: pCandidate(sel.s, b, r), matched, first };
}
type M = ReturnType<typeof model>;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "LSH banding on MinHash signatures",
    x: "true Jaccard similarity s",
    y: "P(candidate)",
    top: "a band matched: candidate pair ({n})",
    bottom: "no band matched: never compared ({n})",
    dup: "s ≥ τ, duplicate",
    distinct: "s < τ, distinct",
    fpArea: "expected false positives",
    fnArea: "expected false negatives",
    tau: "τ = {t}",
    half: "P = 0.5 at s = {s}",
    grid: "Signature of the pair at s = {s}",
    gridSub: "{b:band/bands} of {r:row/rows}; a filled cell is a row where both MinHash values agree",
    match: "match",
    more: "⋮ {k:more band/more bands}",
    moreMatch: "⋮ {k:more band/more bands}, {j} of them matching",
    eq: "P = 1 − (1 − sʳ)ᵇ",
    t1: "sʳ = {s}{r} = {v}",
    t1n: "one band matches",
    t2: "(1 − sʳ)ᵇ = {q}{b} = {v}",
    t2n: "no band matches",
    t3: "P = {v}",
    realized: "this pair: {k} of {b} bands matched, {verdict}",
    cand: "a candidate",
    notCand: "not a candidate",
    m: "m = b · r = {m} MinHash values per document",
    rowDup: "{n} duplicates: {c} caught, {f} missed (expected {e})",
    rowDistinct: "{n} distinct: {f} became candidates (expected {e})",
    noteFineweb: "FineWeb treats a match in any bucket as a duplicate, so a false positive removes a document below the 75% target.",
    noteLee: "Lee et al. verify each candidate (Jaccard ≥ 0.8, then edit similarity ≥ 0.8), so a false positive costs one comparison.",
    noteLee90: "The same verification at 0.9, with 800 MinHash values instead of 9,000.",
    noteCustom: "The common rule of thumb (1/b)^(1/r) = {t} approximates the exact P = 0.5 point.",
    describe: "{b} bands of {r} rows: P(candidate) crosses 0.5 at s = {s50}. Of {dup} pairs with s ≥ {tau}, {tp} became candidates and {fn} were missed; {fp} of {distinct} distinct pairs became candidates. The selected pair at s = {s} matched {k} of {b} bands.",
  },
  zh: {
    title: "MinHash 签名上的 LSH 分带",
    x: "真实 Jaccard 相似度 s",
    y: "P(候选)",
    top: "有分带匹配：成为候选对（{n}）",
    bottom: "没有分带匹配：不会被比较（{n}）",
    dup: "s ≥ τ，重复",
    distinct: "s < τ，不重复",
    fpArea: "假阳性期望",
    fnArea: "假阴性期望",
    tau: "τ = {t}",
    half: "s = {s} 时 P = 0.5",
    grid: "s = {s} 这一对文档的签名",
    gridSub: "{b} 个分带，每带 {r} 行；实心格表示这一行两篇文档的 MinHash 值相同",
    match: "匹配",
    more: "⋮ 另有 {k} 个分带",
    moreMatch: "⋮ 另有 {k} 个分带，其中 {j} 个匹配",
    eq: "P = 1 − (1 − sʳ)ᵇ",
    t1: "sʳ = {s}{r} = {v}",
    t1n: "单个分带匹配",
    t2: "(1 − sʳ)ᵇ = {q}{b} = {v}",
    t2n: "所有分带都不匹配",
    t3: "P = {v}",
    realized: "这一对：{b} 个分带中有 {k} 个匹配，{verdict}",
    cand: "成为候选对",
    notCand: "未成为候选对",
    m: "m = b · r = {m}，即每篇文档 {m} 个 MinHash 值",
    rowDup: "{n} 对重复：找出 {c} 对，漏掉 {f} 对（期望 {e}）",
    rowDistinct: "{n} 对不重复：{f} 对成为候选（期望 {e}）",
    noteFineweb: "FineWeb 把任一桶内匹配直接当作重复，因此一个假阳性就会删掉一篇相似度不到 75% 的文档。",
    noteLee: "Lee 等人会核验每个候选对（Jaccard ≥ 0.8，再看编辑相似度 ≥ 0.8），假阳性只多花一次比较。",
    noteLee90: "同样的核验，阈值改为 0.9，签名从 9,000 个 MinHash 值减到 800 个。",
    noteCustom: "常用的经验估计 (1/b)^(1/r) = {t}，近似于 P = 0.5 的精确位置。",
    describe: "{b} 个分带、每带 {r} 行：s = {s50} 时候选概率为 0.5。s ≥ {tau} 的 {dup} 对中，{tp} 对成为候选，{fn} 对被漏掉；{distinct} 对不重复的文档中有 {fp} 对成为候选。选中的一对 s = {s}，{b} 个分带中有 {k} 个匹配。",
  },
};

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, {
    b: m.b, r: m.r, s50: fixed(m.s50, 2), dup: m.dup, tau: sig(m.tau, 2), tp: m.tp, fn: m.fn, fp: m.fp, distinct: m.distinct,
    s: fixed(m.sel.s, 2), k: m.matched,
  });
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");
// Small probabilities keep three significant figures; others three decimals.
const prob = (v: number) => (v === 0 ? "0" : v < 0.001 ? sig(v, 2) : v > 0.9995 && v < 1 ? "0.999…" : fixed(v, 3));

// The curve, its error areas, the threshold, and the two strips of pairs.
function renderPlot(st: State<P>, m: M, L: typeof labels.en, fs: number): { svg: string; h: number } {
  const w = st.w;
  const narrow = w < 480;
  const left = narrow ? 34 : 40, right = narrow ? 6 : 10;
  const x = linear([0, 1], [left, w - right]);
  const parts: string[] = [];
  const lg = legend([
    { label: L.dup, swatch: { kind: "dot", fill: C.c1 } },
    { label: L.distinct, swatch: { kind: "dot", fill: C.c2 } },
    { label: L.fnArea, swatch: { kind: "rect", fill: C.c1, opacity: 0.2 } },
    { label: L.fpArea, swatch: { kind: "rect", fill: C.c2, opacity: 0.28 } },
  ], 0, 0, w, fs);
  parts.push(lg.svg);
  const stripH = narrow ? 24 : 26;
  const topLabelY = lg.height + 14;
  const topStrip = topLabelY + 6;
  const plotTop = topStrip + stripH + 10;
  const plotH = narrow ? 150 : 176;
  const plotBottom = plotTop + plotH;
  const y = linear([0, 1], [plotBottom, plotTop]);
  const bottomLabelY = plotBottom + 22;
  const bottomStrip = bottomLabelY + 6;
  const axisY = bottomStrip + stripH + 4;

  // Strip panels behind the dots.
  parts.push(el("rect", { x: left, y: topStrip, width: w - right - left, height: stripH, rx: 3, fill: C.panel }));
  parts.push(el("rect", { x: left, y: bottomStrip, width: w - right - left, height: stripH, rx: 3, fill: C.panel }));
  parts.push(axis({ scale: x, orient: "bottom", at: axisY, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], grid: [topStrip, bottomStrip + stripH], title: L.x, size: fs, format: (v) => sig(v, 2) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, w - right], size: fs, format: (v) => sig(v, 2) }));

  // Expected-error areas: under the curve below τ (distinct pairs that become
  // candidates) and above it at or past τ (duplicates that never do).
  const b = m.b, r = m.r, tau = m.tau;
  const pts = (s0: number, s1: number): Array<[number, number]> => {
    const n = Math.max(2, Math.ceil((s1 - s0) * 240));
    return Array.from({ length: n + 1 }, (_, k) => { const s = s0 + ((s1 - s0) * k) / n; return [x(s), y(pCandidate(s, b, r))] as [number, number]; });
  };
  const below = pts(0, tau), above = pts(tau, 1);
  parts.push(el("path", { d: linePath([[x(0), y(0)], ...below, [x(tau), y(0)]]) + "Z", fill: C.c2, "fill-opacity": 0.28 }));
  parts.push(el("path", { d: linePath([...above, [x(1), y(1)], [x(tau), y(1)]]) + "Z", fill: C.c1, "fill-opacity": 0.2 }));
  parts.push(el("path", { d: linePath([...below, ...above.slice(1)]), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));

  // Threshold τ through the strips and the plot, broken at the strip labels.
  const xt = x(tau);
  for (const [a, z] of [[topStrip - 2, topStrip + stripH + 2], [plotTop, plotBottom], [bottomStrip - 2, bottomStrip + stripH + 2]]) {
    parts.push(el("line", { x1: xt, x2: xt, y1: a, y2: z, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  }
  // τ label: the first corner beside the line that the curve does not cross.
  const tauText = tpl(L.tau, { t: sig(tau, 2) });
  const tw = textWidth(tauText, fs) + 10;
  const span = (s0: number, s1: number) => {
    let lo = 1, hi = 0;
    for (let k = 0; k <= 12; k++) { const v = pCandidate(Math.min(1, Math.max(0, s0 + ((s1 - s0) * k) / 12)), b, r); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return { lo, hi };
  };
  const dS = x.invert(x(0) + tw) - x.invert(x(0));
  const spots = [
    { side: 1, at: "bottom" as const }, { side: 1, at: "top" as const }, { side: -1, at: "bottom" as const }, { side: -1, at: "top" as const },
  ].filter((c) => (c.side > 0 ? xt + tw < w - right : xt - tw > left + 60));
  const pick = spots.find((c) => {
    const sp = c.side > 0 ? span(tau, tau + dS) : span(tau - dS, tau);
    return c.at === "bottom" ? sp.lo > 0.16 : sp.hi < 0.84;
  });
  if (pick) {
    parts.push(text(pick.side > 0 ? xt + 5 : xt - 5, pick.at === "bottom" ? plotBottom - 7 : plotTop + 14, tauText, { "font-size": fs, "text-anchor": pick.side > 0 ? "start" : "end", class: "fig-t-halo" }));
  } else {
    // The curve crosses every corner: label the line in the strip-label row
    // above the plot, clear of that row's own label.
    const topText = tpl(L.top, { n: N_PAIRS });
    const cx = Math.min(Math.max(xt, left + textWidth(topText, fs) + 12 + tw / 2), w - right - tw / 2);
    parts.push(text(cx, topLabelY, tauText, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo" }));
  }
  parts.push(text(left + 6, plotTop + 14, L.y, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));

  // P = 0.5 point, labeled on the side with room (above the curve on the left).
  const hx = x(m.s50), hy = y(0.5);
  const half = tpl(L.half, { s: fixed(m.s50, 2) });
  const hw = textWidth(half, fs);
  parts.push(el("circle", { cx: hx, cy: hy, r: 3.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  if (hx - left > hw + 14) parts.push(text(hx - 9, hy - 4, half, { "font-size": fs, "text-anchor": "end", class: "fig-t-halo" }));
  else parts.push(text(hx + 9, hy + fs + 2, half, { "font-size": fs, class: "fig-t-halo" }));

  // Strip labels and dots.
  let nTop = 0;
  for (const q of m.all) if (m.out[q.i]) nTop++;
  parts.push(text(left, topLabelY, tpl(L.top, { n: nTop }), { "font-size": fs, class: "fig-t-halo" }));
  parts.push(text(left, bottomLabelY, tpl(L.bottom, { n: N_PAIRS - nTop }), { "font-size": fs, class: "fig-t-halo" }));
  const rad = narrow ? 2.3 : 2.7;
  const dots: string[] = [];
  for (const q of m.all) {
    const cand = m.out[q.i] === 1;
    const top = cand ? topStrip : bottomStrip;
    const cy = top + rad + 2 + q.jitter * (stripH - 2 * rad - 4);
    const col = q.s >= tau ? C.c1 : C.c2;
    dots.push(el("circle", { cx: x(q.s), cy, r: rad, fill: cand ? col : C.paper, stroke: col, "stroke-width": 1.2, "data-fig-set": `probe=${q.s.toFixed(2)}`, class: "fig-hit" }));
  }
  parts.push(g({}, ...dots));
  // The selected pair: ring in its strip and a guide to its point on the curve.
  const sc = m.out[m.sel.i] === 1;
  const sy = (sc ? topStrip : bottomStrip) + rad + 2 + m.sel.jitter * (stripH - 2 * rad - 4);
  const sx = x(m.sel.s), py = y(m.selP);
  parts.push(el("line", { x1: sx, x2: sx, y1: sc ? sy + rad + 3 : py, y2: sc ? py : sy - rad - 3, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx: sx, cy: py, r: 3, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx: sx, cy: sy, r: rad + 3, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
  return { svg: g({ class: "fig-plot" }, ...parts), h: axisY + axisHeight(true, fs) };
}

// The selected pair's signature, band by band.
function renderGrid(m: M, L: typeof labels.en, x0: number, y0: number, w: number, fs: number, narrow: boolean, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0 + 14;
  parts.push(text(x0, y, tpl(L.grid, { s: fixed(m.sel.s, 3) }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const sub = (lang === "zh" ? wrapCjk : wrap)(tpl(L.gridSub, { b: m.b, r: m.r }), fs, w);
  for (const ln of sub) { y += fs + 4; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  y += 10;
  const labelW = textWidth(String(m.b), fs) + 10;
  const matchW = textWidth(L.match, fs) + 10;
  const cell = Math.max(4, Math.min(14, Math.floor((w - labelW - matchW) / m.r) - 2));
  const gap = cell >= 8 ? 2 : 1;
  const K = narrow ? 10 : 16;
  const shown: number[] = [];
  const all = m.b <= K + 1;
  for (let k = 0; k < (all ? m.b : K); k++) shown.push(k);
  // Beyond the rows shown, surface the first band that matched, if any.
  let hiddenMatch = -1, hiddenMatches = 0;
  if (!all) for (let k = K; k < m.b; k++) if (bandMatches(m.seed, m.sel, k, m.r)) { hiddenMatches++; if (hiddenMatch < 0) hiddenMatch = k; }
  const extraFirst = hiddenMatch >= 0;
  const row = (k: number) => {
    const match = bandMatches(m.seed, m.sel, k, m.r);
    parts.push(text(x0 + labelW - 6, y + cell - 1, k + 1, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    for (let j = 0; j < m.r; j++) {
      const on = agrees(m.seed, m.sel, k * m.r + j);
      parts.push(el("rect", { x: x0 + labelW + j * (cell + gap), y, width: cell, height: cell, rx: cell >= 8 ? 2 : 1, fill: match ? C.c1 : on ? C.ink3 : C.panel }));
    }
    if (match) {
      const ex = x0 + labelW + m.r * (cell + gap) + 4;
      parts.push(text(ex, y + cell - 1, L.match, { "font-size": fs, class: "fig-t-strong" }));
    }
    y += cell + gap + (cell < 8 ? 2 : 0);
  };
  for (const k of shown) row(k);
  if (extraFirst) {
    parts.push(text(x0 + labelW, y + fs, "⋮", { "font-size": fs, class: "fig-t-muted" }));
    y += fs + 4;
    row(hiddenMatch);
  }
  const hidden = m.b - shown.length - (extraFirst ? 1 : 0);
  if (hidden > 0) {
    y += 4;
    const more = tpl(hiddenMatches > 1 ? L.moreMatch : L.more, { k: hidden, j: hiddenMatches - 1 });
    parts.push(text(x0 + labelW, y + fs, more, { "font-size": fs, class: "fig-t-muted" }));
    y += fs + 4;
  }
  return { svg: g({ class: "fig-grid" }, ...parts), h: y - y0 };
}

// The equation's terms for the selected pair, then the population counts.
function renderReadout(m: M, p: P, L: typeof labels.en, x0: number, y0: number, w: number, fs: number, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const wr = lang === "zh" ? wrapCjk : wrap;
  let y = y0 + 14;
  const s = fixed(m.sel.s, 3);
  const sr = m.sel.s ** m.r;
  const none = (1 - sr) ** m.b;
  parts.push(text(x0, y, L.eq, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const terms: Array<[string, string]> = [
    [tpl(L.t1, { s, r: sup(m.r), v: prob(sr) }), L.t1n],
    [tpl(L.t2, { q: fixed(1 - sr, 3), b: sup(m.b), v: prob(none) }), L.t2n],
  ];
  for (const [t, note] of terms) {
    y += 20;
    parts.push(text(x0, y, t, { "font-size": TYPE.body, class: "fig-t-num" }));
    y += fs + 3;
    parts.push(text(x0 + 10, y, note, { "font-size": fs, class: "fig-t-muted" }));
  }
  y += 20;
  parts.push(text(x0, y, tpl(L.t3, { v: prob(m.selP) }), { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  const verdict = m.matched > 0 ? L.cand : L.notCand;
  for (const ln of wr(tpl(L.realized, { k: m.matched, b: m.b, verdict }), fs, w)) { y += fs + 5; parts.push(text(x0, y, ln, { "font-size": fs })); }
  y += 12;
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 4;
  const rows: Array<[string, string | null]> = [
    [tpl(L.m, { m: int(m.m) }), null],
    [tpl(L.rowDup, { n: m.dup, c: m.tp, f: m.fn, e: fixed(m.eFN, 1) }), C.c1],
    [tpl(L.rowDistinct, { n: m.distinct, f: m.fp, e: fixed(m.eFP, 1) }), C.c2],
  ];
  for (const [line, col] of rows) {
    const ind = col ? 12 : 0;
    const lines = wr(line, fs, w - ind);
    lines.forEach((ln, i) => {
      y += fs + 5;
      if (i === 0 && col) parts.push(el("circle", { cx: x0 + 4, cy: y - fs * 0.35, r: 3.5, fill: col }));
      parts.push(text(x0 + ind, y, ln, { "font-size": fs, class: "fig-t-num" }));
    });
    y += 3;
  }
  const note = tpl({ fineweb: L.noteFineweb, lee: L.noteLee, lee90: L.noteLee90, custom: L.noteCustom }[p.preset], { t: fixed((1 / m.b) ** (1 / m.r), 2) });
  if (note) {
    y += 4;
    for (const ln of wr(note, fs, w)) { y += fs + 4; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const m = model(st.p);
  const plot = renderPlot(st, m, L, fs);
  let y = plot.h + 18;
  const parts = [plot.svg];
  if (narrow) {
    const gr = renderGrid(m, L, 0, y, w, fs, narrow, lang);
    parts.push(gr.svg); y += gr.h + 18;
    const ro = renderReadout(m, st.p, L, 0, y, w, fs, lang);
    parts.push(ro.svg); y += ro.h;
  } else {
    const colW = Math.floor((w - 28) / 2);
    const gr = renderGrid(m, L, 0, y, colW, fs, narrow, lang);
    const ro = renderReadout(m, st.p, L, colW + 28, y, w - colW - 28, fs, lang);
    parts.push(gr.svg, ro.svg);
    y += Math.max(gr.h, ro.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "lsh-banding",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    preset: {
      kind: "choice", label: { en: "Published setting", zh: "公开配置" }, default: "fineweb",
      options: [
        { value: "fineweb", label: { en: "FineWeb 14 × 8", zh: "FineWeb 14 × 8" } },
        { value: "lee", label: { en: "Lee et al. 450 × 20", zh: "Lee 等人 450 × 20" } },
        { value: "lee90", label: { en: "Lee et al. 40 × 20", zh: "Lee 等人 40 × 20" } },
        { value: "custom", label: { en: "Custom", zh: "自定义" } },
      ],
    },
    bands: { kind: "range", scale: "log", label: { en: "Bands b", zh: "分带数 b" }, min: 1, max: 500, default: 14 },
    rows: { kind: "range", label: { en: "Rows per band r", zh: "每带行数 r" }, min: 1, max: 24, step: 1, default: 8 },
    tau: { kind: "range", label: { en: "Duplicate threshold τ", zh: "重复阈值 τ" }, min: 0.5, max: 0.95, step: 0.05, default: 0.75 },
    probe: { kind: "range", label: { en: "Inspect the pair nearest s", zh: "查看最接近 s 的一对" }, min: 0, max: 1, step: 0.01, default: 0.72 },
    seed: { kind: "range", label: { en: "Pair seed", zh: "文档对种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  // A preset sets b, r and τ; moving any of them by hand leaves the preset.
  update(p, key) {
    if (key === "preset" && p.preset !== "custom") return { ...p, ...{ bands: PRESETS[p.preset].b, rows: PRESETS[p.preset].r, tau: PRESETS[p.preset].tau } };
    if (key === "bands" || key === "rows" || key === "tau") {
      const q = { ...p, bands: Math.max(1, Math.round(p.bands)) };
      const hit = (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).find((k) => PRESETS[k].b === q.bands && PRESETS[k].r === q.rows && Math.abs(PRESETS[k].tau - q.tau) < 1e-9);
      return { ...q, preset: hit ?? "custom" };
    }
    return p;
  },
  render,
  describe,
});
