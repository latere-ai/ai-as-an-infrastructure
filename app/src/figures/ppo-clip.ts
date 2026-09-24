// PPO's clipped surrogate for one sampled token, from the chapter's equation
//
//   L = min( ρ Â, clip(ρ, 1 − ε, 1 + ε) Â ),   ρ = π_θ(a|s) / π_old(a|s)
//
// drawn against ρ for Â = +1 and Â = −1 (the objective is linear in Â, so the
// magnitude only rescales the vertical axis). Where the clipped branch is the
// minimum, L is flat in ρ and the token contributes no gradient that moves ρ
// further; the flat side is ρ > 1 + ε for a positive advantage and ρ < 1 − ε
// for a negative one.
//
// The lower panel follows one token across rollout batches. Each batch takes a
// new snapshot π_old, so the window re-centers: if every batch moved the token
// to the edge of its window, the log-ratio to the fixed reference would reach
// k ln(1 + ε) or k ln(1 − ε) after k batches. That is the incentive limit only
// (clipping is not a hard trust region), and it has no ceiling in k.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { wrap as wrapText } from "./lib/labels.ts";
import { fixed, sig, tpl } from "./lib/format.ts";

type P = { eps: number; ratio: number; batches: number };

const labels = {
  en: {
    title: "PPO clipped surrogate and drift across batches",
    pos: "Â = +1: the token did better than expected",
    neg: "Â = −1: the token did worse than expected",
    x: "ratio ρ = π_θ / π_old",
    y: "objective L",
    flat: "flat: no gradient on ρ",
    unclipped: "ρÂ",
    clipped: "clip(ρ)Â",
    minimum: "L = min(ρÂ, clip(ρ, 1 − ε, 1 + ε)Â)",
    rowPos: "Â = +1",
    rowNeg: "Â = −1",
    terms: "ρÂ = {u}, clip(ρ)Â = {c}, L = {l}",
    gradZero: "dL/dρ = 0, clipped",
    gradOn: "dL/dρ = {g}, pushes ρ {dir}",
    up: "up",
    down: "down",
    driftTitle: "One token over rollout batches: log-ratio to the reference",
    driftX: "rollout batch k",
    driftY: "ln π_θ / π_ref",
    driftUp: "k ln(1 + ε) = {v}",
    driftDown: "k ln(1 − ε) = {v}",
    driftAfter: "after k = {k} batches: {up}, {down}",
    driftNote: "Each batch re-centers the window on a new π_old; the incentive limit on the drift from π_ref grows by ln(1 ± ε) per batch.",
    describe: "With ε = {e} and ρ = {r}: for a positive advantage the objective is {lp} and {gp}; for a negative advantage it is {ln} and {gn}. After {k} batches the incentive limit on a token's log-ratio to the reference is {up} to {down} nats.",
    dPos: "clipped with no gradient",
    dNeg: "unclipped with gradient {g}",
  },
  zh: {
    title: "PPO 裁剪替代目标与跨批次的累积偏移",
    pos: "Â = +1：该词元的结果好于预期",
    neg: "Â = −1：该词元的结果差于预期",
    x: "比率 ρ = π_θ / π_old",
    y: "目标 L",
    flat: "平坦区：ρ 上没有梯度",
    unclipped: "ρÂ",
    clipped: "clip(ρ)Â",
    minimum: "L = min(ρÂ, clip(ρ, 1 − ε, 1 + ε)Â)",
    rowPos: "Â = +1",
    rowNeg: "Â = −1",
    terms: "ρÂ = {u}，clip(ρ)Â = {c}，L = {l}",
    gradZero: "dL/dρ = 0，已被裁剪",
    gradOn: "dL/dρ = {g}，推动 ρ {dir}",
    up: "增大",
    down: "减小",
    driftTitle: "一个词元跨采样批次的变化：相对参考模型的对数比",
    driftX: "采样批次 k",
    driftY: "ln π_θ / π_ref",
    driftUp: "k ln(1 + ε) = {v}",
    driftDown: "k ln(1 − ε) = {v}",
    driftAfter: "k = {k} 个批次后：{up}，{down}",
    driftNote: "每个批次都以新的 π_old 为中心重新设定裁剪区间；相对 π_ref 的偏移，其激励上限每批增加 ln(1 ± ε)。",
    describe: "ε = {e}，ρ = {r} 时：优势为正时目标为 {lp}，{gp}；优势为负时目标为 {ln}，{gn}。经过 {k} 个批次后，一个词元相对参考模型的对数比，其激励上限为 {down} 到 {up} nats。",
    dPos: "已被裁剪，没有梯度",
    dNeg: "未被裁剪，梯度为 {g}",
  },
};

// Pull full-width punctuation that would open a line back onto the line before.
function wrap(s: string, size: number, width: number): string[] {
  const out = wrapText(s, size, width);
  for (let i = 1; i < out.length; i++) {
    const m = out[i].match(/^[，。；：、）]+/);
    if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length).trimStart(); }
  }
  return out.filter((ln) => ln.length > 0);
}

const clip = (r: number, e: number) => Math.min(Math.max(r, 1 - e), 1 + e);
// Objective and its slope in ρ for advantage A.
function surrogate(r: number, e: number, A: number) {
  const u = r * A, c = clip(r, e) * A;
  const l = Math.min(u, c);
  // Flat where the clipped branch is strictly the lower one: ρ > 1 + ε for a
  // positive advantage, ρ < 1 − ε for a negative one.
  const flat = c < u;
  return { u, c, l, grad: flat ? 0 : A };
}

const R0 = 0.4, R1 = 1.6;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const a = surrogate(p.ratio, p.eps, 1), b = surrogate(p.ratio, p.eps, -1);
  const gtxt = (s: { grad: number }) => (s.grad === 0 ? L.dPos : tpl(L.dNeg, { g: sig(s.grad, 2) }));
  return tpl(L.describe, {
    e: sig(p.eps, 2), r: fixed(p.ratio, 2), lp: fixed(a.l, 2), gp: gtxt(a), ln: fixed(b.l, 2), gn: gtxt(b),
    k: p.batches, up: fixed(p.batches * Math.log(1 + p.eps), 2), down: fixed(p.batches * Math.log(1 - p.eps), 2),
  });
}

function panel(p: P, A: 1 | -1, x0: number, y0: number, w: number, lang: Lang, uid: string) {
  const L = labels[lang];
  const narrow = w < 300;
  const parts: string[] = [];
  for (const [i, ln] of wrap(A > 0 ? L.pos : L.neg, TYPE.body, w).entries()) parts.push(text(x0, y0 + 13 + i * 16, ln, { "font-size": TYPE.body, class: "fig-t-strong" }));
  const titleH = wrap(A > 0 ? L.pos : L.neg, TYPE.body, w).length * 16;
  const top = y0 + titleH + 26;
  const left = x0 + (narrow ? 34 : 38);
  const right = x0 + w - 6;
  const plotH = 150;
  const bottom = top + plotH;
  const xs = linear([R0, R1], [left, right]);
  const [lo, hi] = A > 0 ? [0.4, 1.6] : [-1.6, -0.4];
  const ys = linear([lo, hi], [bottom, top]);
  const e = p.eps;

  // Window and the flat region.
  parts.push(el("rect", { x: xs(1 - e), y: top, width: xs(1 + e) - xs(1 - e), height: plotH, fill: C.c1, "fill-opacity": 0.08 }));
  const [f0, f1] = A > 0 ? [1 + e, R1] : [R0, 1 - e];
  parts.push(el("rect", { x: xs(Math.max(R0, f0)), y: top, width: Math.max(0, xs(Math.min(R1, f1)) - xs(Math.max(R0, f0))), height: plotH, fill: `url(#${uid}-flat)` }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0.5, 1 - e, 1, 1 + e, 1.5].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b), format: (v) => sig(v, 3), grid: [top, bottom], title: L.x }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: A > 0 ? [0.5, 1, 1.5] : [-1.5, -1, -0.5], format: (v) => sig(v, 2), grid: [left, right], title: L.y }));

  // The two branches, thin, and their minimum, bold.
  const N = 120;
  const pts = (f: (r: number) => number) => Array.from({ length: N + 1 }, (_, i) => { const r = R0 + ((R1 - R0) * i) / N; return [xs(r), ys(Math.max(lo, Math.min(hi, f(r))))] as [number, number]; });
  parts.push(el("path", { d: linePath(pts((r) => r * A)), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "5 3" }));
  parts.push(el("path", { d: linePath(pts((r) => clip(r, e) * A)), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "1.5 3", "stroke-linecap": "round" }));
  parts.push(el("path", { d: linePath(pts((r) => surrogate(r, e, A).l)), fill: "none", stroke: C.c1, "stroke-width": 2.4, "stroke-linejoin": "round" }));

  // Branch names inside the flat range, where the two branches separate: the
  // unclipped line above its dashed segment, the clipped one under the flat
  // part of L, and the flat label along the bottom of the hatched band.
  const flatLo = A > 0 ? 1 + e : R0, flatHi = A > 0 ? R1 : 1 - e;
  const rl = A > 0 ? flatLo + 0.55 * (flatHi - flatLo) : flatHi - 0.55 * (flatHi - flatLo);
  const anchor = A > 0 ? "end" : "start";
  const edgeX = A > 0 ? right - 3 : left + 4;
  if (flatHi - flatLo > 0.25) {
    parts.push(text(xs(rl) + (A > 0 ? -4 : 4), ys(Math.min(hi, rl * A)) - 3, L.unclipped, { "font-size": TYPE.small, "text-anchor": anchor, class: "fig-t-halo fig-t-soft" }));
    parts.push(text(edgeX, ys(clip(A > 0 ? R1 : R0, e) * A) + 16, L.clipped, { "font-size": TYPE.small, "text-anchor": anchor, class: "fig-t-halo fig-t-soft" }));
  }
  parts.push(text(edgeX, bottom - 7, L.flat, { "font-size": TYPE.small, "text-anchor": anchor, class: "fig-t-halo fig-t-soft" }));

  // The chosen ratio.
  const s = surrogate(p.ratio, e, A);
  const mx = xs(p.ratio), my = ys(s.l);
  parts.push(el("line", { x1: mx, x2: mx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  parts.push(el("circle", { cx: mx, cy: my, r: 5, fill: s.grad === 0 ? C.paper : C.c1, stroke: C.c1, "stroke-width": 2 }));
  return { svg: g({}, ...parts), h: bottom + axisHeight(true) - y0 };
}

function drift(p: P, x0: number, y0: number, w: number, lang: Lang) {
  const L = labels[lang];
  const parts: string[] = [];
  const tl = wrap(L.driftTitle, TYPE.body, w);
  tl.forEach((ln, i) => parts.push(text(x0, y0 + 13 + i * 16, ln, { "font-size": TYPE.body, class: "fig-t-strong" })));
  const top = y0 + tl.length * 16 + 26;
  const left = x0 + 38, right = x0 + w - 6;
  const plotH = 140, bottom = top + plotH;
  const K = 30;
  // The vertical range is the fan after K batches at the chosen ε.
  const up = Math.log(1 + p.eps), dn = Math.log(1 - p.eps);
  const xs = linear([0, K], [left, right]);
  const ys = linear([K * dn, K * up], [bottom, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0, 5, 10, 15, 20, 25, 30], grid: [top, bottom], title: L.driftX }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: ys.ticks(5), format: (v) => sig(v, 2), grid: [left, right], title: L.driftY }));
  parts.push(el("line", { x1: left, x2: right, y1: ys(0), y2: ys(0), stroke: C.ink2, "stroke-width": 1.2 }));
  const lu = Math.log(1 + p.eps), ld = Math.log(1 - p.eps);
  // One window per batch, re-centered on the upper and lower paths.
  for (let k = 0; k < p.batches; k++) {
    for (const base of [k * lu, k * ld]) {
      parts.push(el("rect", { x: xs(k) + 1, y: ys(base + lu), width: Math.max(1, xs(k + 1) - xs(k) - 2), height: Math.max(1, ys(base + ld) - ys(base + lu)), fill: C.c1, "fill-opacity": 0.1 }));
    }
  }
  const stair = (step: number) => {
    const pts: Array<[number, number]> = [[xs(0), ys(0)]];
    for (let k = 1; k <= p.batches; k++) pts.push([xs(k), ys((k - 1) * step)], [xs(k), ys(k * step)]);
    return pts;
  };
  parts.push(el("path", { d: linePath(stair(lu)), fill: "none", stroke: C.c1, "stroke-width": 2 }));
  parts.push(el("path", { d: linePath(stair(ld)), fill: "none", stroke: C.c1, "stroke-width": 2 }));
  const ex = xs(p.batches);
  const upT = tpl(L.driftUp, { v: fixed(p.batches * lu, 2) }), dnT = tpl(L.driftDown, { v: fixed(p.batches * ld, 2) });
  // End labels beside the path ends while there is room; the same values are
  // always printed under the plot.
  if (p.batches < K * 0.6) {
    let yu = ys(p.batches * lu) + 4, yd = ys(p.batches * ld) + 4;
    if (yd - yu < 15) { const mid = (yu + yd) / 2; yu = mid - 7.5; yd = mid + 7.5; }
    parts.push(text(ex + 6, yu, upT, { "font-size": TYPE.small, class: "fig-t-halo fig-t-num" }));
    parts.push(text(ex + 6, yd, dnT, { "font-size": TYPE.small, class: "fig-t-halo fig-t-num" }));
  }
  parts.push(text(right - 2, ys(0) - 5, "π_ref", { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-halo fig-t-soft" }));
  let y = bottom + axisHeight(true) + 8;
  for (const ln of wrap(tpl(L.driftAfter, { k: p.batches, up: upT, down: dnT }), TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); y += 16; }
  y += 2;
  for (const ln of wrap(L.driftNote, TYPE.small, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.small, class: "fig-t-muted" })); y += 15; }
  return { svg: g({ class: "fig-drift" }, ...parts), h: y - y0 };
}

function readout(p: P, x0: number, y0: number, w: number, lang: Lang) {
  const L = labels[lang];
  const parts: string[] = [];
  let y = y0 + 13;
  for (const ln of wrap(L.minimum, TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" })); y += 17; }
  y += 2;
  for (const A of [1, -1] as const) {
    const s = surrogate(p.ratio, p.eps, A);
    const nameW = 52;
    parts.push(text(x0, y, A > 0 ? L.rowPos : L.rowNeg, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
    const lines = [
      ...wrap(tpl(L.terms, { u: fixed(s.u, 2), c: fixed(s.c, 2), l: fixed(s.l, 2) }), TYPE.body, w - nameW),
      ...wrap(s.grad === 0 ? L.gradZero : tpl(L.gradOn, { g: sig(s.grad, 2), dir: s.grad > 0 ? L.up : L.down }), TYPE.body, w - nameW),
    ];
    lines.forEach((ln, i) => parts.push(text(x0 + nameW, y + i * 16, ln, { "font-size": TYPE.body, class: "fig-t-num" + (i === lines.length - 1 && s.grad === 0 ? " fig-t-strong" : "") })));
    y += lines.length * 16 + 6;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-flat`, C.ink3, 6, 1))];
  let y = 0;
  if (narrow) {
    const a = panel(p, 1, 0, y, w, lang, st.uid); parts.push(a.svg); y += a.h + 12;
    const b = panel(p, -1, 0, y, w, lang, st.uid); parts.push(b.svg); y += b.h + 12;
  } else {
    const pw = Math.floor((w - 24) / 2);
    const a = panel(p, 1, 0, y, pw, lang, st.uid);
    const b = panel(p, -1, pw + 24, y, pw, lang, st.uid);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 12;
  }
  const ro = readout(p, 0, y, w, lang);
  parts.push(ro.svg); y += ro.h + 14;
  parts.push(el("line", { x1: 0, x2: w, y1: y - 8, y2: y - 8, stroke: C.grid, "stroke-width": 1 }));
  const dr = drift(p, 0, y, w, lang);
  parts.push(dr.svg); y += dr.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "ppo-clip",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    eps: {
      kind: "range", label: { en: "Clipping width ε", zh: "裁剪宽度 ε" }, min: 0.05, max: 0.5, step: 0.01, default: 0.2,
      marks: [{ value: 0.2, label: { en: "0.2", zh: "0.2" } }],
    },
    ratio: {
      kind: "range", label: { en: "Ratio ρ", zh: "比率 ρ" }, min: 0.5, max: 1.5, step: 0.01, default: 1.3,
      marks: [{ value: 1, label: { en: "π_θ = π_old", zh: "π_θ = π_old" } }],
    },
    batches: { kind: "range", label: { en: "Rollout batches k", zh: "采样批次 k" }, min: 1, max: 30, step: 1, default: 12 },
  },
  render,
  describe,
});
