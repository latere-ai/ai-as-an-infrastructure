// Token accounting for a specialist-data schedule inside one training phase.
// The chapter's mixture is D_t = (1 − α_t) P + α_t Q, and its illustrative
// schedule over normalized progress u ∈ [0, 1] is a linear ramp
//
//   α(u) = 0 for u < s,   α(u) = a (u − s) / (1 − s) for s ≤ u ≤ 1,
//
// whose whole-phase specialist fraction at a constant token rate is
// ᾱ = ∫ α(u) du = a (1 − s) / 2. The second shape is a fixed weight a after
// the introduction point, α(u) = a for u ≥ s, the form Liu et al. (2025)
// varied, with ᾱ = a (1 − s). Both are exact integrals; nothing here is
// measured. Token counts use the runnable cell's 100B-token phase.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

const TOTAL_B = 100; // billions of tokens in the phase, as in the runnable cell

type Shape = "ramp" | "step";
type P = { start: number; final: number; shape: Shape };

const dose = (s: number, a: number, shape: Shape) => (shape === "step" ? a * (1 - s) : (a * (1 - s)) / 2);

const labels = {
  en: {
    title: "Specialist-token dose of a mixture schedule",
    x: "normalized training progress u",
    y: "share of tokens",
    broad: "broad data P",
    special: "specialist data Q, area = ᾱ",
    other: "other shape, same s and a",
    s: "s = {s}",
    a: "a = {a}",
    eqRamp: "ᾱ = a(1 − s) / 2 = {a} × {q} / 2 = {v}",
    eqStep: "ᾱ = a(1 − s) = {a} × {q} = {v}",
    otherRamp: "a linear ramp to the same a: ᾱ = {v}, half the dose",
    otherStep: "a fixed weight a after s: ᾱ = {v}, twice the dose",
    same: "the same dose as a fixed weight of {w} after s",
    sameRamp: "the same dose as a linear ramp to {w} from s",
    sameNone: "no ramp from s reaches this dose (it would need a > 1)",
    split: "Of {t}B phase tokens: {q}B specialist, {p}B broad",
    describe: "Specialist data from u = {s} with {shape} to {a}: the phase draws ᾱ = {v} of its tokens from Q, {q}B of {t}B. The other shape with the same s and a would draw {v2}.",
    ramp: "a linear ramp",
    step: "a fixed weight",
  },
  zh: {
    title: "混合调度中的专门数据剂量",
    x: "归一化训练进度 u",
    y: "词元占比",
    broad: "宽泛数据 P",
    special: "专门数据 Q，面积 = ᾱ",
    other: "另一种形状，s 与 a 相同",
    s: "s = {s}",
    a: "a = {a}",
    eqRamp: "ᾱ = a(1 − s) / 2 = {a} × {q} / 2 = {v}",
    eqStep: "ᾱ = a(1 − s) = {a} × {q} = {v}",
    otherRamp: "线性升到同样的 a：ᾱ = {v}，剂量减半",
    otherStep: "在 s 之后固定为 a：ᾱ = {v}，剂量翻倍",
    same: "与 s 之后固定权重 {w} 的剂量相同",
    sameRamp: "与从 s 线性升到 {w} 的剂量相同",
    sameNone: "从 s 开始的线性斜坡达不到这个剂量（需要 a > 1）",
    split: "这一阶段共 {t}B 词元：专门数据 {q}B，宽泛数据 {p}B",
    describe: "专门数据从 u = {s} 开始，以{shape}到 {a}：这一阶段有 ᾱ = {v} 的词元来自 Q，即 {t}B 中的 {q}B。s 与 a 相同的另一种形状会得到 {v2}。",
    ramp: "线性斜坡升",
    step: "固定权重保持",
  },
};

function model(p: P) {
  const s = Math.min(0.95, Math.max(0, p.start));
  const a = Math.min(1, Math.max(0, p.final));
  const other: Shape = p.shape === "ramp" ? "step" : "ramp";
  const v = dose(s, a, p.shape);
  return { s, a, other, v, v2: dose(s, a, other), q: v * TOTAL_B };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, { s: fixed(m.s, 2), shape: st.p.shape === "ramp" ? L.ramp : L.step, a: fixed(m.a, 2), v: fixed(m.v, 3), q: sig(m.q, 3), t: TOTAL_B, v2: fixed(m.v2, 3) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const wr = lang === "zh" ? wrapCjk : wrap;
  const parts: string[] = [];

  const lg = legend([
    { label: L.broad, swatch: { kind: "rect", fill: C.c1, opacity: 0.22 } },
    { label: L.special, swatch: { kind: "rect", fill: C.c2, opacity: 0.8 } },
    { label: L.other, swatch: { kind: "line", stroke: C.ink2, dash: "4 3" } },
  ], 0, 0, w, fs);
  parts.push(lg.svg);

  const left = narrow ? 36 : 42, right = narrow ? 10 : 14;
  const top = lg.height + 22;
  const plotH = narrow ? 170 : 200;
  const x = linear([0, 1], [left, w - right]);
  const y = linear([0, 1], [top + plotH, top]);
  // Broad share fills the plot; the specialist share is drawn over it.
  parts.push(el("rect", { x: left, y: top, width: w - right - left, height: plotH, fill: C.c1, "fill-opacity": 0.22 }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], grid: [top, top + plotH], title: L.x, size: fs, format: (v) => sig(v, 2) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, w - right], title: L.y, size: fs, format: (v) => pct(v) }));

  const curve = (shape: Shape): Array<[number, number]> => shape === "step"
    ? [[x(0), y(0)], [x(m.s), y(0)], [x(m.s), y(m.a)], [x(1), y(m.a)]]
    : [[x(0), y(0)], [x(m.s), y(0)], [x(1), y(m.a)]];
  const mine = curve(p.shape);
  parts.push(el("path", { d: linePath([...mine, [x(1), y(0)]]) + "Z", fill: C.c2, "fill-opacity": 0.8 }));
  parts.push(el("path", { d: linePath(mine), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));
  // The other shape shares the zero segment before s; draw it from s on.
  parts.push(el("path", { d: linePath(curve(m.other).slice(1)), fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));

  // Introduction point s and final share a.
  const xs = x(m.s);
  parts.push(el("line", { x1: xs, x2: xs, y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  const sText = tpl(L.s, { s: fixed(m.s, 2) });
  const sw = textWidth(sText, fs);
  // At the top of the line, right of it unless that runs off the plot or the
  // flat top of a step (solid or dashed) passes through the text; then left.
  const stepTop = y(m.a) < top + fs + 10;
  const right1 = xs + 5 + sw < w - right - 4 && !stepTop;
  const left1 = xs - 5 - sw > left + 4;
  const [sx, sy] = right1 ? [xs + 5, top + fs + 4] : left1 ? [xs - 5 - sw, top + fs + 4] : [xs + 5, y(m.a) + fs + 8];
  parts.push(text(sx, sy, sText, { "font-size": fs, class: "fig-t-halo fig-t-num" }));
  const aText = tpl(L.a, { a: fixed(m.a, 2) });
  const ay = y(m.a);
  // Above the end of the line, or above the plot when the line is near its
  // top (clear of the s label, which sits inside the plot).
  const aY = ay - 8 > top + 2 * fs + 10 ? ay - 8 : top - 6;
  parts.push(text(w - right, aY, aText, { "font-size": fs, "text-anchor": "end", class: "fig-t-halo fig-t-num" }));
  parts.push(el("circle", { cx: x(1), cy: ay, r: 3.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  // The area's value, inside it when it has room.
  const vText = `ᾱ = ${fixed(m.v, 3)}`;
  const areaH = y(0) - y(m.a);
  const vw = textWidth(vText, TYPE.body);
  if (p.shape === "step" && areaH >= 20 && x(1) - xs > vw + 16) {
    // Lower right of the rectangle, below the dashed ramp that crosses its center.
    parts.push(text(xs + (x(1) - xs) * 0.72, y(0) - areaH * 0.22 + 4, vText, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
  } else if (p.shape === "ramp") {
    // Bottom right of the triangle, only where the ramp clears the text's top.
    const xl = x(1) - 8 - vw;
    if (xl > xs && ((xl - xs) / (x(1) - xs)) * areaH >= 19) {
      parts.push(text(x(1) - 8, y(0) - 5, vText, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-halo fig-t-num" }));
    }
  }

  // Readout: the integral's terms, the other shape, and the token split.
  let yy = top + plotH + axisHeight(true, fs) + 18;
  const eq = tpl(p.shape === "ramp" ? L.eqRamp : L.eqStep, { a: fixed(m.a, 2), q: fixed(1 - m.s, 2), v: fixed(m.v, 3) });
  parts.push(text(0, yy, eq, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  const lines: Array<[string, string]> = [];
  lines.push([tpl(p.shape === "ramp" ? L.otherStep : L.otherRamp, { v: fixed(m.v2, 3) }), "fig-t-muted"]);
  if (p.shape === "ramp") lines.push([tpl(L.same, { w: fixed(m.a / 2, 3) }), "fig-t-muted"]);
  else lines.push([2 * m.a <= 1 ? tpl(L.sameRamp, { w: fixed(2 * m.a, 2) }) : L.sameNone, "fig-t-muted"]);
  for (const [ln, cls] of lines) for (const part of wr(ln, fs, w)) { yy += fs + 6; parts.push(text(0, yy, part, { "font-size": fs, class: cls })); }

  // Whole-phase token split as one bar.
  yy += 16;
  const barW = w;
  parts.push(el("rect", { x: 0, y: yy, width: barW, height: 14, rx: 3, fill: C.c1, "fill-opacity": 0.22 }));
  if (m.v > 0) parts.push(el("rect", { x: 0, y: yy, width: Math.max(1.5, barW * m.v), height: 14, rx: 3, fill: C.c2, "fill-opacity": 0.8 }));
  yy += 14;
  const split = tpl(L.split, { t: TOTAL_B, q: fixed(m.q, 1), p: fixed(TOTAL_B - m.q, 1) });
  for (const part of wr(split, fs, w)) { yy += fs + 6; parts.push(text(0, yy, part, { "font-size": fs, class: "fig-t-num" })); }
  return svg(w, yy + 6, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "mixture-ramp",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    shape: {
      kind: "choice", label: { en: "Schedule", zh: "调度形状" }, default: "ramp",
      options: [
        { value: "ramp", label: { en: "Linear ramp (chapter)", zh: "线性斜坡（本章）" } },
        { value: "step", label: { en: "Fixed weight after s", zh: "s 之后固定权重" } },
      ],
    },
    start: {
      kind: "range", label: { en: "Introduction point s", zh: "引入时点 s" }, min: 0, max: 0.95, step: 0.01, default: 0.6,
      marks: [{ value: 0.6, label: { en: "runnable cell", zh: "可运行示例" } }],
    },
    final: {
      kind: "range", label: { en: "Final specialist share a", zh: "最终专门数据占比 a" }, min: 0, max: 1, step: 0.01, default: 0.3,
      marks: [{ value: 0.3, label: { en: "runnable cell", zh: "可运行示例" } }],
    },
  },
  render,
  describe,
});
