// Market concentration as area. The market-structure chapter defines
//
//   HHI(M) = 10,000 · Σ s_i²,   Σ s_i = 1,   N_eff = 10,000 / HHI
//
// and quotes the 2023 U.S. Merger Guidelines presumption: a post-merger HHI
// above 1,800 together with an increase above 100 points. Laying the
// suppliers' shares along the diagonal of a unit square makes each s_i² the
// area of one square, so the index is the covered fraction of the square
// times 10,000. A merger of suppliers a and b replaces two squares by one of
// side s_a + s_b; the area it adds is the two off-diagonal rectangles,
//
//   ΔHHI = 10,000 · ((s_a + s_b)² − s_a² − s_b²) = 10,000 · 2 s_a s_b,
//
// which the figure hatches. Widening the market boundary to take in sales the
// narrow boundary left out (self-supply, adjacent products) scales the named
// shares by (1 − f) and adds the outside sellers, here four of equal size:
//
//   HHI_wide = (1 − f)² · HHI_named + 10,000 · 4 · (f / 4)².
//
// The three share lists are the chapter's own hypothetical markets from its
// runnable example (narrow, broader, equal-five); they are not estimates of
// any AI market.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { int, sig, tpl } from "./lib/format.ts";

const MARKETS = {
  narrow: [45, 30, 15, 10],
  broader: [30, 25, 20, 15, 10],
  equal: [20, 20, 20, 20, 20],
} as const;
type MarketKey = keyof typeof MARKETS;
const NAMES = ["A", "B", "C", "D", "E"];
const OUTSIDE = 4; // equal-sized sellers brought in by widening the boundary
const HHI_LINE = 1800; // 2023 Merger Guidelines: post-merger HHI above this
const DELTA_LINE = 100; // ... together with an increase above this

const PAIRS = ["none", "AB", "AC", "AD", "AE", "BC", "BD", "BE", "CD", "CE", "DE"] as const;
type Pair = (typeof PAIRS)[number];

type P = { market: MarketKey; merge: Pair; widen: number };

interface Firm { name: string; share: number; color: string; outside: boolean }

function model(p: P) {
  const named = MARKETS[p.market];
  const f = p.widen / 100;
  const firms: Firm[] = named.map((s, i) => ({ name: NAMES[i], share: (s / 100) * (1 - f), color: [C.c1, C.c2, C.c3, C.c4, C.c5][i], outside: false }));
  if (f > 0) for (let k = 0; k < OUTSIDE; k++) firms.push({ name: "", share: f / OUTSIDE, color: C.ink3, outside: true });
  const hhi = 10000 * firms.reduce((a, x) => a + x.share * x.share, 0);
  // The merging pair, if both suppliers exist in this market.
  let pair: [number, number] | null = null;
  if (p.merge !== "none") {
    const a = NAMES.indexOf(p.merge[0]), b = NAMES.indexOf(p.merge[1]);
    if (a < named.length && b < named.length) pair = [a, b];
  }
  const delta = pair ? 10000 * 2 * firms[pair[0]].share * firms[pair[1]].share : 0;
  const post = hhi + delta;
  return { firms, hhi, pair, delta, post, f, presumption: pair !== null && post > HHI_LINE && delta > DELTA_LINE };
}

// Order along the diagonal: suppliers in rank order, the second merging
// supplier moved next to the first so their squares touch.
function order(m: ReturnType<typeof model>): number[] {
  const idx = m.firms.map((_, i) => i);
  if (!m.pair) return idx;
  const [a, b] = m.pair;
  const rest = idx.filter((i) => i !== b);
  rest.splice(rest.indexOf(a) + 1, 0, b);
  return rest;
}

const labels = {
  en: {
    title: "Market concentration as area",
    square: "Side = share sᵢ, area = sᵢ²",
    covered: "covered area = HHI / 10,000 = {v}",
    formula: "HHI = 10,000 · Σ sᵢ²",
    outside: "{n} outside sellers",
    each: "{p}% each",
    sum: "HHI = {h}",
    neff: "10,000 / HHI = {n} equal suppliers",
    noMerge: "No merger selected",
    mergeHead: "Merger {a} + {b}",
    delta: "ΔHHI = 2 · 10,000 · {sa} · {sb} = {d}",
    post: "post-merger HHI = {h}",
    presume: "Structural presumption",
    presumeWhy: "post-merger HHI above 1,800 and an increase above 100",
    noPresume: "No presumption",
    belowDelta: "the increase is 100 or less",
    belowLevel: "the post-merger HHI is 1,800 or less",
    missing: "Supplier {x} is not in this market",
    scale: "HHI {pre} → {post} on the 0 to 10,000 scale",
    scalePre: "HHI {pre} on the 0 to 10,000 scale",
    line: "1,800",
    added: "added by the merger",
    describe: "{market} market{wide}: {shares}. HHI is {h}, as concentrated as {n} equal suppliers. {merger}",
    wideNote: " with the boundary widened to put {f}% of sales with outside sellers",
    mergerYes: "Merging {a} and {b} adds 2 · {sa} · {sb} · 10,000 = {d} points, to {post}; {verdict}.",
    mergerNo: "No merger is selected.",
    vPresume: "the post-merger index is above 1,800 and rose more than 100, the 2023 guidelines' structural presumption",
    vNo: "that does not meet both thresholds of the 2023 guidelines",
    narrow: "Narrow", broader: "Broader", equal: "Equal-five",
  },
  zh: {
    title: "用面积表示市场集中度",
    square: "边长 = 份额 sᵢ，面积 = sᵢ²",
    covered: "覆盖面积 = HHI / 10,000 = {v}",
    formula: "HHI = 10,000 · Σ sᵢ²",
    outside: "{n} 家边界外卖方",
    each: "各占 {p}%",
    sum: "HHI = {h}",
    neff: "10,000 / HHI = {n} 家等规模供应商",
    noMerge: "未选择合并",
    mergeHead: "合并 {a} + {b}",
    delta: "ΔHHI = 2 · 10,000 · {sa} · {sb} = {d}",
    post: "合并后 HHI = {h}",
    presume: "构成结构性推定",
    presumeWhy: "合并后 HHI 高于 1,800，且增幅超过 100",
    noPresume: "不构成推定",
    belowDelta: "增幅不超过 100",
    belowLevel: "合并后 HHI 不超过 1,800",
    missing: "这个市场里没有供应商 {x}",
    scale: "HHI {pre} → {post}，取值 0 到 10,000",
    scalePre: "HHI {pre}，取值 0 到 10,000",
    line: "1,800",
    added: "合并新增的部分",
    describe: "{market}市场{wide}：{shares}。HHI 为 {h}，相当于 {n} 家同等规模供应商的集中度。{merger}",
    wideNote: "，边界放宽后有 {f}% 的销售额属于边界外卖方",
    mergerYes: "{a} 与 {b} 合并增加 2 · {sa} · {sb} · 10,000 = {d} 点，达到 {post}；{verdict}。",
    mergerNo: "未选择合并。",
    vPresume: "合并后指数高于 1,800 且增幅超过 100，构成 2023 年指南中的结构性推定",
    vNo: "没有同时达到 2023 年指南的两个门槛",
    narrow: "窄口径", broader: "宽口径", equal: "五家均分",
  },
};
type L = typeof labels.en;

const pctOf = (s: number) => sig(s * 100, 3);
const dec = (s: number) => sig(s, 3);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const sep = lang === "zh" ? "，" : ", ";
  const shares = m.firms.filter((x) => !x.outside).map((x) => `${x.name} ${pctOf(x.share)}%`).join(sep)
    + (m.f > 0 ? sep + tpl(L.outside, { n: OUTSIDE }) + (lang === "zh" ? "" : " ") + tpl(L.each, { p: pctOf(m.f / OUTSIDE) }) : "");
  const absent = st.p.merge.split("").find((c) => NAMES.indexOf(c) >= MARKETS[st.p.market].length);
  const merger = st.p.merge !== "none" && !m.pair
    ? tpl(L.missing, { x: absent ?? "" }) + (lang === "zh" ? "。" : ".")
    : m.pair
    ? tpl(L.mergerYes, { a: NAMES[m.pair[0]], b: NAMES[m.pair[1]], sa: dec(m.firms[m.pair[0]].share), sb: dec(m.firms[m.pair[1]].share), d: int(m.delta), post: int(m.post), verdict: m.presumption ? L.vPresume : L.vNo })
    : L.mergerNo;
  return tpl(L.describe, {
    market: L[st.p.market], wide: m.f > 0 ? tpl(L.wideNote, { f: st.p.widen }) : "", shares,
    h: int(m.hhi), n: sig(10000 / m.hhi, 3), merger,
  });
}

// The unit square with the diagonal staircase of share squares.
function square(m: ReturnType<typeof model>, x0: number, y0: number, side: number, uid: string, L: L): string {
  const parts: string[] = [];
  parts.push(el("rect", { x: x0, y: y0, width: side, height: side, fill: C.panel, stroke: C.rule, "stroke-width": 1 }));
  for (let k = 1; k < 10; k++) {
    const d = (side * k) / 10;
    parts.push(el("line", { x1: x0 + d, x2: x0 + d, y1: y0, y2: y0 + side, stroke: C.grid, "stroke-width": 1 }));
    parts.push(el("line", { x1: x0, x2: x0 + side, y1: y0 + d, y2: y0 + d, stroke: C.grid, "stroke-width": 1 }));
  }
  const ord = order(m);
  const at = new Map<number, number>(); // firm index -> offset along the diagonal
  let off = 0;
  for (const i of ord) { at.set(i, off); off += m.firms[i].share * side; }

  // The merged square and the two rectangles the merger adds.
  if (m.pair) {
    const [a, b] = m.pair;
    const oa = at.get(a)!, sa = m.firms[a].share * side, sb = m.firms[b].share * side;
    parts.push(el("rect", { x: x0 + oa + sa, y: y0 + oa, width: sb, height: sa, fill: `url(#${uid}-d)` }));
    parts.push(el("rect", { x: x0 + oa, y: y0 + oa + sa, width: sa, height: sb, fill: `url(#${uid}-d)` }));
  }
  for (const i of ord) {
    const fm = m.firms[i];
    const o = at.get(i)!, s = fm.share * side;
    parts.push(el("rect", { x: x0 + o, y: y0 + o, width: s, height: s, fill: fm.color, "fill-opacity": fm.outside ? 0.22 : 0.38, stroke: fm.color, "stroke-width": 1.5 }));
    if (!fm.outside && s >= 26) {
      const lines = s >= 60 ? [`${fm.name} ${pctOf(fm.share)}%`] : [fm.name, `${pctOf(fm.share)}%`];
      const fits = lines.every((ln) => textWidth(ln, TYPE.body) <= s - 6);
      const draw = fits ? lines : [fm.name];
      const cy = y0 + o + s / 2 - ((draw.length - 1) * 14) / 2 + 4;
      draw.forEach((ln, k) => parts.push(text(x0 + o + s / 2, cy + k * 14, ln, { "font-size": TYPE.body, "text-anchor": "middle", class: k === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" })));
    }
  }
  if (m.pair) {
    const [a, b] = m.pair;
    const oa = at.get(a)!, s = (m.firms[a].share + m.firms[b].share) * side;
    parts.push(el("rect", { x: x0 + oa, y: y0 + oa, width: s, height: s, fill: "none", stroke: C.ink, "stroke-width": 2 }));
  }
  // The outside sellers are named once, beside their run of squares.
  if (m.f > 0) {
    const first = at.get(m.firms.length - OUTSIDE)!;
    const lbl = tpl(L.outside, { n: OUTSIDE });
    const tx = x0 + first - 6, ty = y0 + first + (m.f * side) / 2 + 4;
    parts.push(text(tx, ty, lbl, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-halo fig-t-soft" }));
  }
  return g({ class: "fig-square" }, ...parts);
}

// The share strip above the square: each supplier's share as a segment, so a
// column of the square is visibly one supplier's side.
function strip(m: ReturnType<typeof model>, x0: number, y0: number, side: number): string {
  const parts: string[] = [];
  let off = 0;
  for (const i of order(m)) {
    const fm = m.firms[i];
    const s = fm.share * side;
    parts.push(el("rect", { x: x0 + off + 0.5, y: y0, width: Math.max(0.5, s - 1), height: 14, fill: fm.color, "fill-opacity": fm.outside ? 0.35 : 0.8 }));
    off += s;
  }
  return g({ class: "fig-strip" }, ...parts);
}

// A horizontal HHI scale with the 1,800 line and the before and after marks.
function gauge(m: ReturnType<typeof model>, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const title = m.pair ? tpl(L.scale, { pre: int(m.hhi), post: int(m.post) }) : tpl(L.scalePre, { pre: int(m.hhi) });
  parts.push(text(x0, y0 + 12, title, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
  const top = y0 + 22;
  const X = (v: number) => x0 + (v / 10000) * w;
  parts.push(el("rect", { x: x0, y: top, width: w, height: 12, rx: 2, fill: C.panel }));
  parts.push(el("rect", { x: x0, y: top, width: X(m.hhi) - x0, height: 12, rx: 2, fill: C.ink3, "fill-opacity": 0.55 }));
  if (m.pair) parts.push(el("rect", { x: X(m.hhi), y: top, width: Math.max(1, X(m.post) - X(m.hhi)), height: 12, fill: C.ink2, "fill-opacity": 0.35 }));
  parts.push(el("line", { x1: X(HHI_LINE), x2: X(HHI_LINE), y1: top - 4, y2: top + 16, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
  parts.push(text(X(HHI_LINE), top + 30, L.line, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  parts.push(text(x0, top + 30, "0", { "font-size": TYPE.small, class: "fig-t-num fig-t-muted" }));
  parts.push(text(x0 + w, top + 30, "10,000", { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  return { svg: g({ class: "fig-gauge" }, ...parts), h: top + 34 - y0 };
}

// The readout: the index as a sum of its terms, then the merger arithmetic.
function readout(m: ReturnType<typeof model>, p: P, x0: number, y0: number, w: number, L: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0 + 13;
  parts.push(text(x0, y, L.formula, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 10;
  const rowH = 19;
  const named = m.firms.filter((x) => !x.outside);
  const rows: Array<{ name: string; color: string; share: string; term: string }> = named.map((x) => ({
    name: x.name, color: x.color, share: `${pctOf(x.share)}%`, term: int(10000 * x.share * x.share),
  }));
  if (m.f > 0) {
    const s = m.f / OUTSIDE;
    rows.push({ name: tpl(L.outside, { n: OUTSIDE }), color: C.ink3, share: `${OUTSIDE} × ${pctOf(s)}%`, term: int(10000 * OUTSIDE * s * s) });
  }
  const xTerm = x0 + w, xShare = x0 + w - 64;
  for (const r of rows) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(el("rect", { x: x0, y: y + 5, width: 10, height: 10, rx: 2, fill: r.color, "fill-opacity": 0.8 }));
    parts.push(text(x0 + 16, y + 14, r.name, { "font-size": TYPE.body }));
    parts.push(text(xShare, y + 14, r.share, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    parts.push(text(xTerm, y + 14, r.term, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += rowH;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  y += 16;
  const sumT = tpl(L.sum, { h: int(m.hhi) }), neffT = tpl(L.neff, { n: sig(10000 / m.hhi, 3) });
  parts.push(text(x0, y, sumT, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  // The equal-size count shares the line when both fit with a clear gap.
  if (textWidth(sumT, TYPE.body) + textWidth(neffT, TYPE.body) + 20 > w) y += 17;
  parts.push(text(x0 + w, y, neffT, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  y += 26;

  if (p.merge === "none") {
    parts.push(text(x0, y, L.noMerge, { "font-size": TYPE.body, class: "fig-t-muted" }));
    y += 8;
  } else if (!m.pair) {
    const x = p.merge.split("").find((c) => NAMES.indexOf(c) >= MARKETS[p.market].length) ?? p.merge[1];
    parts.push(text(x0, y, tpl(L.missing, { x }), { "font-size": TYPE.body, class: "fig-t-muted" }));
    y += 8;
  } else {
    const [a, b] = m.pair;
    parts.push(text(x0, y, tpl(L.mergeHead, { a: NAMES[a], b: NAMES[b] }), { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 20;
    const dl = tpl(L.delta, { sa: dec(m.firms[a].share), sb: dec(m.firms[b].share), d: int(m.delta) });
    for (const ln of wrapCJK(dl, TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); y += 16; }
    parts.push(text(x0, y, tpl(L.post, { h: int(m.post) }), { "font-size": TYPE.body, class: "fig-t-num" }));
    y += 22;
    const why = m.presumption ? L.presumeWhy : m.delta <= DELTA_LINE ? L.belowDelta : L.belowLevel;
    const col = m.presumption ? C.warn : C.good;
    parts.push(el("circle", { cx: x0 + 5, cy: y - 4, r: 5, fill: col }));
    parts.push(text(x0 + 16, y, m.presumption ? L.presume : L.noPresume, { "font-size": TYPE.body, class: "fig-t-strong" }));
    const lines = wrapCJK(why, TYPE.body, w - 16);
    lines.forEach((ln, k) => parts.push(text(x0 + 16, y + 16 + k * 16, ln, { "font-size": TYPE.body, class: "fig-t-muted" })));
    y += lines.length * 16 + 8;
  }
  void lang;
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-d`, C.ink2, 4, 1.2))];

  const side = narrow ? Math.min(w - 4, 300) : Math.min(300, Math.floor(w * 0.5));
  const sx = narrow ? Math.floor((w - side) / 2) : 0;
  let y = 0;
  parts.push(text(sx, y + 13, L.square, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 24;
  parts.push(strip(m, sx, y, side));
  y += 20;
  parts.push(square(m, sx, y, side, st.uid, L));
  y += side + 18;
  const covered = tpl(L.covered, { v: sig(m.hhi / 10000, 3) });
  parts.push(text(sx, y, covered, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
  if (m.pair) {
    const lx = sx + textWidth(covered, TYPE.small) + 14;
    const lbl = L.added;
    if (lx + 14 + textWidth(lbl, TYPE.small) <= sx + side) {
      parts.push(el("rect", { x: lx, y: y - 10, width: 12, height: 12, fill: `url(#${st.uid}-d)`, stroke: C.ink2, "stroke-width": 0.8 }));
      parts.push(text(lx + 17, y, lbl, { "font-size": TYPE.small, class: "fig-t-muted" }));
    } else {
      y += 18;
      parts.push(el("rect", { x: sx, y: y - 10, width: 12, height: 12, fill: `url(#${st.uid}-d)`, stroke: C.ink2, "stroke-width": 0.8 }));
      parts.push(text(sx + 17, y, lbl, { "font-size": TYPE.small, class: "fig-t-muted" }));
    }
  }
  y += 10;
  const leftH = y;

  if (narrow) {
    y += 14;
    const ro = readout(m, p, 0, y, w, L, lang);
    parts.push(ro.svg); y += ro.h + 18;
    const gz = gauge(m, 0, y, w, L);
    parts.push(gz.svg); y += gz.h;
  } else {
    const rx = side + 32, rw = w - rx;
    const ro = readout(m, p, rx, 0, rw, L, lang);
    parts.push(ro.svg);
    const gz = gauge(m, rx, ro.h + 18, rw, L);
    parts.push(gz.svg);
    y = Math.max(leftH, ro.h + 18 + gz.h);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "market-concentration",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    market: {
      kind: "choice", label: { en: "Hypothetical market", zh: "假设市场" }, default: "narrow",
      options: [
        { value: "narrow", label: { en: "Narrow: 45, 30, 15, 10", zh: "窄口径：45、30、15、10" } },
        { value: "broader", label: { en: "Broader: 30, 25, 20, 15, 10", zh: "宽口径：30、25、20、15、10" } },
        { value: "equal", label: { en: "Equal-five: 5 × 20", zh: "五家均分：5 × 20" } },
      ],
    },
    merge: {
      kind: "choice", label: { en: "Merger", zh: "合并" }, default: "CD", control: "select",
      options: PAIRS.map((v) => ({ value: v, label: v === "none" ? { en: "none", zh: "不合并" } : { en: `${v[0]} + ${v[1]}`, zh: `${v[0]} + ${v[1]}` } })),
    },
    widen: {
      kind: "range", label: { en: "Sales outside the narrow boundary", zh: "窄口径之外的销售额" }, unit: { en: "% of the wider market", zh: "% 占放宽后市场" },
      min: 0, max: 60, step: 5, default: 0,
    },
  },
  render,
  describe,
});
