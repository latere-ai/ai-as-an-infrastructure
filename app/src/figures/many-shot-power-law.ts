// The published scaling shape of a many-shot attack and what a defense does to
// it, after Anil et al., "Many-shot Jailbreaking" (NeurIPS 2024).
//
// The paper reports that the negative log-likelihood the target model assigns
// to the response it is being steered toward falls with the number of in-context
// demonstrations n as a power law (the paper's Equation 1):
//
//     NLL(n) = C * n^(-alpha) + K
//
// Lower NLL means the attack has made the response more likely, so a smaller
// NLL is a more effective attack. On log-log axes with K = 0 the relation is a
// straight line of slope -alpha. The intercept C sets the height of the line,
// alpha its slope, and K a floor the curve approaches at large n.
//
// The paper's mitigation result: supervised fine-tuning and reinforcement
// learning raise the intercept but leave the exponent essentially unchanged
// (Figures 4 and 5). A higher intercept shifts the whole line up, so more
// demonstrations are needed for the same effect, but the slope is the same, so
// a long enough context reaches it anyway. The paper states that a lasting fix
// has to reduce the exponent, which flattens the line. This figure draws that
// contrast; the intercept, exponent, and floor are illustrative, not fitted
// values, and no harm categories or measured rates are shown.
//
// The context window bounds n: the paper's 205-shot attacks are about 70,000
// tokens, near 340 tokens per shot, so a window of W tokens holds about
// W / 340 demonstrations. The wall marks that cap for the chosen window.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, textBox, type Box, type LabelRequest } from "./lib/labels.ts";
import { sig, tpl } from "./lib/format.ts";
import { wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";

// ---------------------------------------------------------------- model

const TOKENS_PER_SHOT = 340; // ~70,000 tokens at 205 shots (paper, Section 3.1)
const C0 = 8;   // illustrative intercept of the undefended line
const K0 = 0.05; // illustrative floor
const FT_SHIFT = 4; // alignment fine-tuning multiplies the intercept (raises the line)
const EXP_DROP = 0.35; // an exponent-reducing defense multiplies the exponent

type Defense = "none" | "finetune" | "exponent";
type Win = "w4k" | "w8k" | "w128k" | "w1m";
const WINDOWS: Record<Win, number> = { w4k: 4096, w8k: 8192, w128k: 131072, w1m: 1048576 };
const capOf = (win: Win) => Math.max(1, Math.floor(WINDOWS[win] / TOKENS_PER_SHOT));

type P = { exponent: number; defense: Defense; window: Win };

// The two lines: the base attack, and the same attack under the chosen defense.
function lines(p: P) {
  const base = { Cc: C0, alpha: p.exponent, K: K0 };
  const def = p.defense === "finetune" ? { Cc: C0 * FT_SHIFT, alpha: p.exponent, K: K0 }
    : p.defense === "exponent" ? { Cc: C0, alpha: p.exponent * EXP_DROP, K: K0 }
      : { Cc: C0, alpha: p.exponent, K: K0 };
  return { base, def };
}
const nll = (l: { Cc: number; alpha: number; K: number }, n: number) => l.Cc * n ** (-l.alpha) + l.K;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "The scaling shape of a many-shot attack, and what a defense does to it",
    x: "in-context demonstrations n (log scale)",
    y: "NLL of the target response (lower is more effective)",
    eqn: "NLL(n) = C n^(-α) + K",
    base: "base attack",
    defLine: "under the defense",
    wall: "{w} window: n ≤ {cap}",
    none: "No defense",
    finetune: "Alignment fine-tuning",
    exponent: "Exponent-reducing defense",
    w4k: "4K", w8k: "8K", w128k: "128K", w1m: "1M",
    terms: "C = {c}, α = {a}, K = {k}",
    noteFT: "Fine-tuning raises the intercept and keeps the exponent, so the line shifts up but keeps its slope: a larger window reaches the same effect further along.",
    noteExp: "Reducing the exponent flattens the line, so more demonstrations stop buying much: the window matters less.",
    noteNone: "With no defense the intercept is C and the slope is −α; each decade of demonstrations lowers the NLL by α decades.",
    illustrative: "intercept, exponent, and floor are illustrative",
    describe: "A power law NLL(n) = C n^(-α) + K on log-log axes, exponent {a}. {def} The {w} window holds about {cap} demonstrations; the base line reaches NLL {vb} there, the defended line {vd}.",
    dNone: "No defense.",
    dFT: "Alignment fine-tuning raises the intercept from {c0} to {c1} and keeps the exponent, so the defended line is shifted up but parallel.",
    dExp: "The exponent-reducing defense lowers the slope, so the defended line is flatter.",
  },
  zh: {
    title: "多示例攻击的规模形态，以及防御对它的作用",
    x: "上下文中的示例数量 n（对数刻度）",
    y: "目标回答的 NLL（越低攻击越有效）",
    eqn: "NLL(n) = C n^(-α) + K",
    base: "基础攻击",
    defLine: "施加防御后",
    wall: "{w} 窗口：n ≤ {cap}",
    none: "无防御",
    finetune: "对齐微调",
    exponent: "降低指数的防御",
    w4k: "4K", w8k: "8K", w128k: "128K", w1m: "1M",
    terms: "C = {c}，α = {a}，K = {k}",
    noteFT: "微调抬高截距而保持指数不变，因此整条线上移但斜率不变：更大的窗口只是在同一条线更靠后处达到相同效果。",
    noteExp: "降低指数会使线变平，于是增加示例带来的收益变小，窗口的影响也随之减弱。",
    noteNone: "没有防御时，截距是 C，斜率是 −α；示例数量每增加一个数量级，NLL 就下降 α 个数量级。",
    illustrative: "截距、指数和下限均为示意值",
    describe: "对数-对数坐标上的幂律 NLL(n) = C n^(-α) + K，指数为 {a}。{def} {w} 窗口约可容纳 {cap} 个示例；基础线在此处达到 NLL {vb}，防御后的线为 {vd}。",
    dNone: "无防御。",
    dFT: "对齐微调把截距从 {c0} 抬到 {c1}，指数保持不变，因此防御后的线上移但与原线平行。",
    dExp: "降低指数的防御减小斜率，因此防御后的线更平。",
  },
};
type L = typeof labels.en;
const winName = (L: L, w: Win) => L[w] as string;

function defSentence(p: P, L: L): string {
  if (p.defense === "finetune") return tpl(L.dFT, { c0: sig(C0, 2), c1: sig(C0 * FT_SHIFT, 2) });
  if (p.defense === "exponent") return L.dExp;
  return L.dNone;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const { base, def } = lines(p);
  const cap = capOf(p.window);
  return tpl(L.describe, {
    a: sig(p.exponent, 2), def: defSentence(p, L), w: winName(L, p.window), cap,
    vb: sig(nll(base, cap), 2), vd: sig(nll(def, cap), 2),
  });
}

// ---------------------------------------------------------------- render

const wrapAt = (lang: Lang) => (s: string, size: number, w: number) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));

// Sample a line across the x domain in log steps for a smooth curve.
function curve(l: { Cc: number; alpha: number; K: number }, x: ReturnType<typeof log>, xd: [number, number], y: ReturnType<typeof log>): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const [lo, hi] = xd.map((v) => Math.log10(v));
  for (let i = 0; i <= 80; i++) {
    const n = 10 ** (lo + (hi - lo) * (i / 80));
    pts.push([x(n), y(nll(l, n))]);
  }
  return pts;
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const W = wrapAt(lang);
  const { base, def } = lines(p);
  const parts: string[] = [];

  const left = narrow ? 44 : 52;
  const right = narrow ? 10 : 16;
  const top = 18;
  const plotH = narrow ? 240 : 280;
  const xd: [number, number] = [1, 4000];
  const yd: [number, number] = [0.02, 40];
  const x = log(xd, [left, w - right]);
  const y = log(yd, [top + plotH, top]);
  const bottom = top + plotH;

  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], minor: true, title: L.x, size: narrow ? TYPE.small : TYPE.small, format: (v) => (v >= 1000 ? `${v / 1000}k` : String(v)) }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], minor: true, size: TYPE.small, format: (v) => sig(v, 2) }));
  // y title, rotated along the axis.
  parts.push(text(0, 0, L.y, { "font-size": TYPE.small, class: "fig-t-muted", transform: `translate(${12} ${top + plotH / 2}) rotate(-90)`, "text-anchor": "middle" }));

  const obstacles: Box[] = [];

  // Context-window wall.
  const cap = capOf(p.window);
  if (cap >= xd[0] && cap <= xd[1]) {
    const wx = x(cap);
    parts.push(el("line", { x1: wx, x2: wx, y1: top, y2: bottom, stroke: C.ink3, "stroke-width": 1.4, "stroke-dasharray": "5 3" }));
    parts.push(el("rect", { x: wx, y: top, width: (w - right) - wx, height: plotH, fill: C.ink3, "fill-opacity": 0.06 }));
    obstacles.push(...lineObstacles([[wx, top], [wx, bottom]]));
  }

  // Base line (dashed) and defended line (solid), when they differ.
  const same = p.defense === "none";
  const basePts = curve(base, x, xd, y);
  parts.push(el("path", { d: linePath(basePts), fill: "none", stroke: same ? C.c1 : C.ink3, "stroke-width": same ? 2.2 : 1.6, "stroke-dasharray": same ? undefined : "5 3" }));
  obstacles.push(...lineObstacles(basePts));
  if (!same) {
    const defPts = curve(def, x, xd, y);
    parts.push(el("path", { d: linePath(defPts), fill: "none", stroke: C.c1, "stroke-width": 2.2 }));
    obstacles.push(...lineObstacles(defPts));
  }

  // Direct labels on the lines and the wall.
  const reqs: LabelRequest[] = [];
  const midN = 30;
  reqs.push({ x: x(midN), y: y(nll(base, midN)), text: L.base, size: TYPE.small, sides: ["above-right", "above", "below-right"], gap: 6, priority: 1, attrs: { class: "fig-t-halo fig-t-soft" } });
  if (!same) reqs.push({ x: x(midN * 3), y: y(nll(def, midN * 3)), text: L.defLine, size: TYPE.small, sides: ["above-right", "above", "right"], gap: 6, priority: 2, attrs: { class: "fig-t-halo" } });
  if (cap >= xd[0] && cap <= xd[1]) reqs.push({ x: x(cap), y: top + 12, text: tpl(L.wall, { w: winName(L, p.window), cap }), size: TYPE.small, sides: ["left", "right"], gap: 5, priority: 3, attrs: { class: "fig-t-muted fig-t-num" } });
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  // Readout.
  let yy = bottom + axisHeight(true, TYPE.small) + 16;
  parts.push(text(0, yy, L.eqn, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const terms = tpl(L.terms, { c: sig(def.Cc, 2), a: sig(def.alpha, 2), k: sig(def.K, 2) });
  if (!narrow) parts.push(text(w, yy, terms, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  yy += narrow ? 18 : 8;
  if (narrow) { parts.push(text(0, yy, terms, { "font-size": TYPE.body, class: "fig-t-num" })); yy += 12; }
  yy += 8;
  const note = p.defense === "finetune" ? L.noteFT : p.defense === "exponent" ? L.noteExp : L.noteNone;
  for (const ln of W(note, TYPE.body, w)) { parts.push(text(0, yy, ln, { "font-size": TYPE.body })); yy += TYPE.body + 5; }
  yy += 2;
  for (const ln of W(L.illustrative, TYPE.small, w)) { parts.push(text(0, yy, ln, { "font-size": TYPE.small, class: "fig-t-faint" })); yy += TYPE.small + 4; }

  return svg(w, yy + 2, describe(st, lang), g({ class: "fig-many-shot" }, ...parts));
}

export default defineFigure({
  name: "many-shot-power-law",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    defense: {
      kind: "choice", label: { en: "Defense", zh: "防御" }, default: "finetune", control: "buttons",
      options: [
        { value: "none", label: { en: labels.en.none, zh: labels.zh.none } },
        { value: "finetune", label: { en: labels.en.finetune, zh: labels.zh.finetune } },
        { value: "exponent", label: { en: labels.en.exponent, zh: labels.zh.exponent } },
      ],
    },
    exponent: {
      kind: "range", label: { en: "Exponent α", zh: "指数 α" }, min: 0.2, max: 1.2, step: 0.05, default: 0.6,
      marks: [{ value: 0.6, label: { en: "base", zh: "基础" } }],
    },
    window: {
      kind: "choice", label: { en: "Context window", zh: "上下文窗口" }, default: "w128k",
      options: (Object.keys(WINDOWS) as Win[]).map((k) => ({ value: k, label: { en: labels.en[k], zh: labels.zh[k] } })),
    },
  },
  render,
  describe,
});
