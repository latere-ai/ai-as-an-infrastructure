// The verification gap: a qualitative model of how the stream of candidate
// claims can outgrow the capacity to verify them as claims get more complex,
// and how formal checks and assisted oversight change the split of the
// excess. It ports the book's earlier canvas figure and keeps its curves;
// nothing here is fitted or measured, and the caption says so.
//
// On a unitless complexity scale x in [0, 1] and a relative claim volume:
//
//   claims(x)    = min(1, (0.12 + 0.78 x^1.12) (0.55 + 0.78 g))
//   capacity(x)  = min(0.95, formal(x) + assisted(x) + empirical(x))
//     formal(x)    = 0.08 + 0.78 f e^(-1.55 x)          cheap checks fade with complexity
//     assisted(x)  = 0.52 o (1 - e^(-3 x)) e^(-0.58 x)   oversight helps most at mid complexity
//     empirical(x) = 0.16 (1 - 0.45 x)                    reproduction and replication
//   accepted(x)  = min(claims(x), capacity(x))
//   gap(x)       = claims(x) - accepted(x)
//   unverified   = u · gap,  u = 0.18 + 0.48 (1 - o)(1 - 0.45 f)
//   deferred     = gap - unverified
//   human(x)     = 0.24 - 0.11 x                        review by people alone
//
// with g the generator strength, f the formalized coverage, and o the
// assisted oversight. The readout divides the three parts by claims(x) at the
// chosen complexity, so they are shares of the candidate stream there and sum
// to one. (The canvas readout printed them as absolute heights, which summed
// to claims(x) and left the rest unlabeled.)

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

type P = { gen: number; formal: number; oversight: number; at: number };

const claims = (p: P, x: number) => Math.min(1, (0.12 + 0.78 * x ** 1.12) * (0.55 + 0.78 * p.gen));
const formalCap = (p: P, x: number) => 0.08 + 0.78 * p.formal * Math.exp(-1.55 * x);
const assistedCap = (p: P, x: number) => 0.52 * p.oversight * (1 - Math.exp(-3 * x)) * Math.exp(-0.58 * x);
const empiricalCap = (x: number) => 0.16 * (1 - 0.45 * x);
const capacity = (p: P, x: number) => Math.min(0.95, formalCap(p, x) + assistedCap(p, x) + empiricalCap(x));
const accepted = (p: P, x: number) => Math.min(claims(p, x), capacity(p, x));
const unverifiedShare = (p: P) => 0.18 + 0.48 * (1 - p.oversight) * (1 - 0.45 * p.formal);
const human = (x: number) => 0.24 - 0.11 * x;

// Whole percentages that sum to 100 (largest remainder), so the readout's
// three shares never print as 101 or 99.
function wholePercents(v: number[]): number[] {
  const raw = v.map((x) => x * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; out[i]++; left--; }
  return out;
}

function split(p: P, x: number) {
  const c = claims(p, x), a = accepted(p, x), gap = c - a;
  const u = gap * unverifiedShare(p);
  return { c, a, u, d: gap - u, cap: capacity(p, x), f: formalCap(p, x), o: assistedCap(p, x), e: empiricalCap(x), h: Math.min(c, human(x)) };
}

const labels = {
  en: {
    title: "Candidate claims against verification capacity",
    y: "claims per interval (relative)",
    x: "claim complexity (illustrative scale)",
    claims: "candidate claims",
    accepted: "verified and accepted",
    deferred: "deferred",
    unverified: "acted on unverified",
    human: "human review alone",
    read: "read here",
    head: "At complexity {x}",
    stream: "Candidate claims {c}; verification capacity {cap} = formal checks {f} + assisted oversight {o} + empirical review {e}",
    bar: "Shares of the candidate claims at this complexity",
    humanNote: "Human review alone would verify {h} of them.",
    describe: "At complexity {x}, of the candidate claims {a} are verified and accepted, {d} are deferred, and {u} are acted on unverified; capacity is {cap} against {c} candidate claims.",
  },
  zh: {
    title: "候选主张与验证能力",
    y: "每个区间的主张量（相对值）",
    x: "主张复杂度（示意刻度）",
    claims: "候选主张",
    accepted: "经验证后接受",
    deferred: "暂缓",
    unverified: "未经验证即采用",
    human: "只靠人工审查",
    read: "读数位置",
    head: "复杂度 {x} 处",
    stream: "候选主张 {c}；验证能力 {cap} = 形式检查 {f} + 辅助监督 {o} + 经验审查 {e}",
    bar: "在该复杂度上占候选主张的比例",
    humanNote: "只靠人工审查，能验证其中的 {h}。",
    describe: "复杂度 {x} 处，候选主张中 {a} 经验证后接受，{d} 暂缓，{u} 未经验证即被采用；验证能力为 {cap}，候选主张为 {c}。",
  },
};

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = split(st.p, st.p.at);
  const [a, d, u] = wholePercents([s.a / s.c, s.d / s.c, s.u / s.c]);
  return tpl(L.describe, { x: fixed(st.p.at, 2), a: `${a}%`, d: `${d}%`, u: `${u}%`, cap: fixed(s.cap, 2), c: fixed(s.c, 2) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const hid = `${st.uid}-unv`;
  const parts: string[] = [el("defs", {}, hatch(hid, C.bad, 5, 1.3))];

  const lg = legend([
    { label: L.claims, swatch: { kind: "line", stroke: C.ink } },
    { label: L.accepted, swatch: { kind: "rect", fill: C.good, opacity: 0.35 } },
    { label: L.deferred, swatch: { kind: "rect", fill: C.warn, opacity: 0.45 } },
    { label: L.unverified, swatch: { kind: "rect", fill: C.bad, pattern: hid, stroke: C.bad } },
    { label: L.human, swatch: { kind: "line", stroke: C.ink2, dash: "5 4" } },
  ], 0, 0, w, size);
  parts.push(lg.svg);
  const left = narrow ? 34 : 40;
  const top = lg.height + 46; // two rows above the plot: the read label, then the y title
  const plotH = narrow ? 200 : 240;
  const right = w - 14; // room for the last tick label
  const x = linear([0, 1], [left, right]);
  const y = linear([0, 1], [top + plotH, top]);
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: [0, 0.25, 0.5, 0.75, 1], title: L.y, size, format: (v) => fixed(v, 2) }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, ticks: [0, 0.25, 0.5, 0.75, 1], title: L.x, size, format: (v) => fixed(v, 2) }));

  const N = 120;
  const xs = Array.from({ length: N + 1 }, (_, i) => i / N);
  const pts = (f: (v: number) => number) => xs.map((v) => [x(v), y(f(v))] as [number, number]);
  const area = (lo: (v: number) => number, hi: (v: number) => number) =>
    linePath([...pts(hi), ...pts(lo).reverse()]) + "Z";
  const uf = unverifiedShare(p);
  const splitAt = (v: number) => claims(p, v) - uf * (claims(p, v) - accepted(p, v));
  parts.push(el("path", { d: area(() => 0, (v) => accepted(p, v)), fill: C.good, "fill-opacity": 0.22 }));
  parts.push(el("path", { d: area((v) => accepted(p, v), splitAt), fill: C.warn, "fill-opacity": 0.4 }));
  parts.push(el("path", { d: area(splitAt, (v) => claims(p, v)), fill: `url(#${hid})` }));
  parts.push(el("path", { d: area(splitAt, (v) => claims(p, v)), fill: C.bad, "fill-opacity": 0.12 }));
  parts.push(el("path", { d: linePath(pts((v) => accepted(p, v))), fill: "none", stroke: C.good, "stroke-width": 2 }));
  parts.push(el("path", { d: linePath(pts(human)), fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
  parts.push(el("path", { d: linePath(pts((v) => claims(p, v))), fill: "none", stroke: C.ink, "stroke-width": 2 }));

  // The read line at the chosen complexity.
  const s = split(p, p.at);
  const rx = x(p.at);
  parts.push(el("line", { x1: rx, x2: rx, y1: top - 20, y2: top + plotH, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "2 3" }));
  for (const v of [s.c, s.a]) parts.push(el("circle", { cx: rx, cy: y(v), r: 3.5, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  const rl = L.read;
  const rlw = textWidth(rl, size);
  parts.push(text(Math.min(Math.max(rx, left + rlw / 2), w - rlw / 2 - 2), top - 25, rl, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));

  // ---- readout
  let yy = top + plotH + axisHeight(true, size) + 18;
  parts.push(text(0, yy, tpl(L.head, { x: fixed(p.at, 2) }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  yy += 6;
  const stream = tpl(L.stream, { c: fixed(s.c, 2), cap: fixed(s.cap, 2), f: fixed(s.f, 2), o: fixed(s.o, 2), e: fixed(s.e, 2) })
    .replace(/ (\d\.\d\d)/g, "\u00a0$1"); // keep each term with its value when wrapping
  for (const ln of wrapCjk(stream, size, w)) { parts.push(text(0, yy + 13, ln, { "font-size": size, class: "fig-t-num" })); yy += size + 5; }
  yy += 12;
  parts.push(text(0, yy + 2, L.bar, { "font-size": size, class: "fig-t-muted" }));
  yy += 10;
  const shares: Array<[string, number, string, string | undefined]> = [
    [L.accepted, s.a / s.c, C.good, undefined],
    [L.deferred, s.d / s.c, C.warn, undefined],
    [L.unverified, s.u / s.c, C.bad, hid],
  ];
  const whole = wholePercents(shares.map((q) => q[1]));
  let bx = 0;
  const barH = 18;
  for (const [, v, col, pat] of shares) {
    const bw = v * w;
    if (bw > 0.2) {
      if (pat) parts.push(el("rect", { x: bx, y: yy, width: bw, height: barH, fill: `url(#${pat})` }));
      parts.push(el("rect", { x: bx, y: yy, width: bw, height: barH, fill: col, "fill-opacity": pat ? 0.18 : col === C.good ? 0.45 : 0.55 }));
    }
    bx += bw;
  }
  parts.push(el("rect", { x: 0, y: yy, width: w, height: barH, fill: "none", stroke: C.rule }));
  yy += barH + 6;
  // Values under the bar, one row per part so none can collide.
  for (const [k, [name, , col, pat]] of shares.entries()) {
    parts.push(el("rect", { x: 0, y: yy + 3, width: size, height: size - 2, rx: 2, fill: pat ? `url(#${pat})` : col, "fill-opacity": pat ? undefined : 0.55, stroke: pat ? C.bad : undefined }));
    parts.push(text(size + 6, yy + size, name, { "font-size": size }));
    parts.push(text(w, yy + size, `${whole[k]}%`, { "font-size": size, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    yy += size + 8;
  }
  yy += 4;
  for (const ln of wrapCjk(tpl(L.humanNote, { h: pct(s.h / s.c) }), size, w)) { parts.push(text(0, yy + 12, ln, { "font-size": size, class: "fig-t-muted" })); yy += size + 5; }
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "verification-gap",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    gen: { kind: "range", label: { en: "Generator strength", zh: "生成能力" }, min: 0.2, max: 1, step: 0.01, default: 0.72 },
    formal: { kind: "range", label: { en: "Formalized coverage", zh: "形式化覆盖率" }, min: 0.05, max: 0.8, step: 0.01, default: 0.34 },
    oversight: { kind: "range", label: { en: "Assisted oversight", zh: "辅助监督" }, min: 0.05, max: 0.85, step: 0.01, default: 0.46 },
    at: { kind: "range", label: { en: "Read at complexity", zh: "读数位置的复杂度" }, min: 0.05, max: 0.95, step: 0.01, default: 0.78 },
  },
  render,
  describe,
});
