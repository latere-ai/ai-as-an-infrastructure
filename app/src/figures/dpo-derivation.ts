// The DPO derivation on one prompt with five candidate responses, computed
// from the chapter's equations:
//
//   π*(y|x) = π_ref(y|x) exp(r(x,y)/β) / Z(x),   Z(x) = Σ_y π_ref(y|x) exp(r(x,y)/β)
//   r(x,y) = β log(π*(y|x)/π_ref(y|x)) + β log Z(x)
//   p(y_w ≻ y_l | x) = σ(r(x,y_w) − r(x,y_l))
//   L_DPO = −log σ(βA),  A = log(π_θ(y_w)/π_ref(y_w)) − log(π_θ(y_l)/π_ref(y_l))
//
// The reference probabilities and rewards are illustrative. The reader sets β
// and a prompt-only constant c(x) added to every reward. β reshapes π* and Z
// while r_w − r_l stays fixed; c changes Z and β log Z by exactly c and leaves
// π* and every pairwise difference unchanged. That is the cancellation the
// derivation relies on, shown with numbers. At π_θ = π*, βA equals r_w − r_l,
// so the DPO loss equals the Bradley-Terry negative log-likelihood of the
// label; at π_θ = π_ref, A = 0 and the loss is log 2.
//
// The readout also checks the optimum: at π*, E[r] − β·KL(π*‖π_ref) = β log Z.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { sigmoid } from "./lib/stats.ts";
import { fixed, sig, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";

// ---------------------------------------------------------------- model

const REF = [0.4, 0.25, 0.15, 0.12, 0.08]; // π_ref(y|x), illustrative
const R = [0, 0.8, -0.5, 1.5, -1]; // r(x,y), illustrative
const NAMES = ["y₁", "y₂", "y₃", "y₄", "y₅"];
const PAIRS = { "2-1": [1, 0], "4-2": [3, 1], "3-1": [2, 0] } as const;
type PairKey = keyof typeof PAIRS;

type P = { beta: number; shift: number; pair: PairKey };

function model(p: P) {
  const r = R.map((v) => v + p.shift);
  // Z via a max shift so small β does not overflow.
  const m = Math.max(...r.map((v) => v / p.beta));
  const terms = REF.map((q, i) => q * Math.exp(r[i] / p.beta - m));
  const s = terms.reduce((a, b) => a + b, 0);
  const logZ = Math.log(s) + m;
  const opt = terms.map((t) => t / s);
  const implicit = opt.map((q, i) => p.beta * Math.log(q / REF[i])); // = r − β log Z
  const er = opt.reduce((a, q, i) => a + q * r[i], 0);
  const kl = opt.reduce((a, q, i) => a + (q > 0 ? q * Math.log(q / REF[i]) : 0), 0);
  const [w, l] = PAIRS[p.pair];
  const diff = r[w] - r[l];
  return { r, logZ, bLogZ: p.beta * logZ, opt, implicit, er, kl, w, l, diff, prob: sigmoid(diff), loss: -Math.log(sigmoid(diff)) };
}

// ---------------------------------------------------------------- math text

// A formula as SVG text: "_x" or "_{...}" is a subscript, set as a tspan
// shifted off the baseline and never smaller than the 12 px floor.
interface MRun { s: string; sub: boolean }
function parseMath(src: string): MRun[] {
  const out: MRun[] = [];
  const ch = [...src];
  let buf = "";
  const flush = () => { if (buf) { out.push({ s: buf, sub: false }); buf = ""; } };
  for (let i = 0; i < ch.length;) {
    if (ch[i] === "_" && i + 1 < ch.length) {
      flush();
      if (ch[i + 1] === "{") {
        const j = ch.indexOf("}", i + 2);
        out.push({ s: ch.slice(i + 2, j).join(""), sub: true });
        i = j + 1;
      } else { out.push({ s: ch[i + 1], sub: true }); i += 2; }
    } else { buf += ch[i]; i++; }
  }
  flush();
  return out;
}
const subSize = (size: number) => Math.max(TYPE.body, Math.round(size * 0.8));
function mathWidth(src: string, size: number): number {
  return parseMath(src).reduce((a, r) => a + textWidth(r.s, r.sub ? subSize(size) : size), 0);
}
function mtext(x: number, y: number, src: string, size: number, attrs: Record<string, string | number | undefined> = {}): string {
  let cur = 0, inner = "";
  for (const r of parseMath(src)) {
    const off = r.sub ? size * 0.3 : 0;
    const dy = off - cur;
    cur = off;
    inner += `<tspan${dy ? ` dy="${Math.round(dy * 10) / 10}"` : ""}${r.sub ? ` font-size="${subSize(size)}"` : ""}>${esc(r.s)}</tspan>`;
  }
  return el("text", { x, y, "font-size": size, ...attrs }, inner);
}

// A line of formula segments set as one text element, so the browser spaces
// it; a struck segment is drawn muted with a line through it.
interface Seg { s: string; strike?: boolean; strong?: boolean }
function segLine(x: number, y: number, segs: Seg[], size: number): string {
  let inner = "";
  for (const sg of segs) {
    let cur = 0;
    for (const r of parseMath(sg.s)) {
      const off = r.sub ? size * 0.3 : 0;
      const dy = off - cur;
      cur = off;
      inner += el("tspan", {
        dy: dy ? Math.round(dy * 10) / 10 : undefined,
        "font-size": r.sub ? subSize(size) : undefined,
        "text-decoration": sg.strike ? "line-through" : undefined,
        class: sg.strike ? "fig-t-muted" : sg.strong ? "fig-t-strong" : undefined,
      }, esc(r.s));
    }
    if (cur) inner += el("tspan", { dy: -cur }, "");
  }
  return el("text", { x, y, "font-size": size, class: "fig-t-num", "xml:space": "preserve" }, inner);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "The DPO derivation on one prompt",
    s1: "1  Optimal policy of the KL-regularized objective",
    eq1: "π*(y|x) = π_{ref}(y|x) exp(r(x,y)/β) / Z(x)",
    as1: "Holds over all distributions on the reference's support; a finite network may not reach π*.",
    ref: "π_{ref}",
    opt: "π* at β = {b}",
    prob: "probability",
    z: "Z(x) = {z},  β log Z(x) = {bz}",
    objective: "At π*: E[r] = {er}, KL(π*‖π_{ref}) = {kl}",
    objective2: "E[r] − β·KL = {j} = β log Z(x)",
    s2: "2  Invert: the implicit reward",
    eq2: "β log(π*/π_{ref}) = r(x,y) − β log Z(x)",
    as2: "Every bar sits the same β log Z(x) below its reward, so reward is identified only up to a prompt-only constant.",
    reward: "reward r",
    implicit: "β log(π*/π_{ref})",
    rewardAxis: "reward units",
    gap: "β log Z(x) = {bz}",
    s3: "3  Bradley-Terry on the pair: β log Z(x) cancels",
    as3: "Assumes one scalar score per response: no ties, cycles, or rater groups.",
    lhs: "r(y_w) − r(y_l) = ",
    prob3: "p(y_w ≻ y_l) = σ({d}) = {p}",
    s4: "4  DPO puts the trained policy π_θ in place of π*",
    startHead: "At the start, π_θ = π_{ref}:",
    startEq: "βA = 0, −log σ(βA) = log 2 = 0.69",
    optHead: "At π_θ = π*:",
    optEq: "βA = r(y_w) − r(y_l) = {d}, −log σ(βA) = −log p = {l}",
    chosen: "y_w",
    rejected: "y_l",
    describe: "At β = {b} and c(x) = {c}, π* puts {top} on {name} against {ref} under the reference; Z(x) = {z} and β log Z(x) = {bz}. For the pair {pw} over {pl}, r_w − r_l = {d} with or without the β log Z(x) terms, so p = {p}.",
  },
  zh: {
    title: "在一个提示上推导 DPO",
    s1: "1  KL 正则化目标的最优策略",
    eq1: "π*(y|x) = π_{ref}(y|x) exp(r(x,y)/β) / Z(x)",
    as1: "结论针对参考策略支持集上的所有分布；有限容量的网络未必能达到 π*。",
    ref: "π_{ref}",
    opt: "π*，β = {b}",
    prob: "概率",
    z: "Z(x) = {z}，β log Z(x) = {bz}",
    objective: "在 π* 处：E[r] = {er}，KL(π*‖π_{ref}) = {kl}",
    objective2: "E[r] − β·KL = {j} = β log Z(x)",
    s2: "2  反解：隐式奖励",
    eq2: "β log(π*/π_{ref}) = r(x,y) − β log Z(x)",
    as2: "每根柱子都比对应的奖励低同一个 β log Z(x)，所以奖励只能确定到一个仅依赖提示的常数。",
    reward: "奖励 r",
    implicit: "β log(π*/π_{ref})",
    rewardAxis: "奖励单位",
    gap: "β log Z(x) = {bz}",
    s3: "3  对样本对套用 Bradley-Terry：β log Z(x) 相消",
    as3: "假设每个回答只用一个标量分数表示，不能表示平局、循环偏好或不同标注者群体。",
    lhs: "r(y_w) − r(y_l) = ",
    prob3: "p(y_w ≻ y_l) = σ({d}) = {p}",
    s4: "4  DPO 用训练中的策略 π_θ 代替 π*",
    startHead: "训练开始时，π_θ = π_{ref}：",
    startEq: "βA = 0，−log σ(βA) = log 2 = 0.69",
    optHead: "π_θ = π* 时：",
    optEq: "βA = r(y_w) − r(y_l) = {d}，−log σ(βA) = −log p = {l}",
    chosen: "y_w",
    rejected: "y_l",
    describe: "β = {b}、c(x) = {c} 时，π* 给 {name} 的概率是 {top}，参考策略给的是 {ref}；Z(x) = {z}，β log Z(x) = {bz}。样本对 {pw} 优于 {pl}：无论是否带上 β log Z(x) 项，r_w − r_l 都等于 {d}，因此 p = {p}。",
  },
};

const n2 = (v: number) => fixed(v, 2);
// Z(x) grows as exp(max r / β) at small β; large values in scientific notation.
const zText = (logZ: number) => (logZ > Math.log(1e4) ? sci(Math.exp(logZ), 3) : sig(Math.exp(logZ), 3));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const top = m.opt.indexOf(Math.max(...m.opt));
  return tpl(L.describe, {
    b: sig(st.p.beta, 3), c: fixed(st.p.shift, 1), top: n2(m.opt[top]), name: NAMES[top], ref: n2(REF[top]),
    z: zText(m.logZ), bz: n2(m.bLogZ), pw: NAMES[m.w], pl: NAMES[m.l], d: n2(m.diff), p: n2(m.prob),
  });
}

// ---------------------------------------------------------------- render

function wrapFor(lang: Lang, s: string, size: number, width: number): string[] {
  return lang === "zh" ? wrapCjk(s, size, width) : wrap(s, size, width);
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const m = model(p);
  const parts: string[] = [];
  let y = 0;

  const heading = (s: string) => { y += TYPE.label + 4; parts.push(mtext(0, y, s, TYPE.label, { class: "fig-t-strong" })); };
  const formula = (s: string) => { y += TYPE.label + 8; parts.push(mtext(0, y, s, TYPE.label)); };
  const note = (s: string, cls = "fig-t-muted") => {
    for (const line of wrapFor(lang, s, size, w)) { y += size + 5; parts.push(mtext(0, y, line, size, { class: cls })); }
  };

  // Response columns shared by both charts.
  const left = 40, right = 4;
  const cols = band(REF.length, [left, w - right], narrow ? 8 : 18);
  const colX = (i: number) => cols.at(i);
  const barW = Math.min(28, (cols.size - 6) / 2);
  const tags = (yy: number, withReward: boolean) => {
    if (withReward) parts.push(text(left - 8, yy + size + 4, "r", { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
    for (let i = 0; i < REF.length; i++) {
      const cx = colX(i) + cols.size / 2;
      const inPair = i === m.w || i === m.l;
      parts.push(text(cx, yy, NAMES[i], { "font-size": size, "text-anchor": "middle", class: inPair ? "fig-t-strong" : "fig-t-muted" }));
      if (withReward) parts.push(text(cx, yy + size + 4, n2(m.r[i]), { "font-size": size, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
      if (inPair) parts.push(mtext(cx - mathWidth(i === m.w ? L.chosen : L.rejected, size) / 2, yy + (withReward ? 2 : 1) * (size + 4), i === m.w ? L.chosen : L.rejected, size, { class: "fig-t-strong" }));
    }
  };
  const legend = (items: Array<{ swatch: string; label: string }>) => {
    y += 8;
    let lx = 0;
    const ly = y + size;
    for (const it of items) {
      parts.push(it.swatch.replace(/__X__/g, String(lx)).replace(/__Y__/g, String(ly - size + 2)));
      parts.push(mtext(lx + 20, ly, it.label, size, { class: "fig-t-muted" }));
      lx += 20 + mathWidth(it.label, size) + 18;
    }
    y = ly;
  };
  const rectSwatch = (fill: string, stroke?: string) => `<rect x="__X__" y="__Y__" width="14" height="10" rx="2" style="fill:${fill};${stroke ? `stroke:${stroke};stroke-width:1.2;` : ""}"/>`;

  // ---- 1: π* against π_ref
  heading(L.s1);
  formula(L.eq1);
  note(L.as1);
  legend([
    { swatch: rectSwatch(C.panel, C.ink3), label: L.ref },
    { swatch: rectSwatch(C.c1), label: tpl(L.opt, { b: sig(p.beta, 3) }) },
  ]);
  const h1 = narrow ? 110 : 130;
  const top1 = y + 32;
  const y1 = linear([0, 1], [top1 + h1, top1]);
  parts.push(axis({ scale: y1, orient: "left", at: left, grid: [left, w - right], ticks: [0, 0.25, 0.5, 0.75, 1], title: L.prob, size }));
  for (let i = 0; i < REF.length; i++) {
    const x0 = colX(i) + cols.size / 2 - barW - 1;
    parts.push(el("rect", { x: x0, y: y1(REF[i]), width: barW, height: y1(0) - y1(REF[i]), fill: C.panel, stroke: C.ink3, "stroke-width": 1.2 }));
    const hOpt = Math.max(0.5, y1(0) - y1(m.opt[i]));
    parts.push(el("rect", { x: x0 + barW + 2, y: y1(0) - hOpt, width: barW, height: hOpt, fill: C.c1 }));
    parts.push(text(x0 + barW * 1.5 + 2, y1(0) - hOpt - 4, n2(m.opt[i]), { "font-size": size, "text-anchor": "middle", class: "fig-t-num fig-t-halo fig-t-soft" }));
  }
  parts.push(el("line", { x1: left, x2: w - right, y1: y1(0), y2: y1(0), stroke: C.rule, "stroke-width": 1 }));
  y = top1 + h1 + size + 6;
  tags(y, true);
  y += 2 * (size + 4) + 6;
  y += 6;
  parts.push(mtext(0, (y += size + 4), tpl(L.z, { z: zText(m.logZ), bz: n2(m.bLogZ) }), size, { class: "fig-t-num" }));
  note(tpl(L.objective, { er: n2(m.er), kl: n2(m.kl) }), "fig-t-num");
  note(tpl(L.objective2, { j: n2(m.er - p.beta * m.kl) }), "fig-t-num");

  // ---- 2: implicit reward against reward
  y += 18;
  heading(L.s2);
  formula(L.eq2);
  note(L.as2);
  legend([
    { swatch: `<rect x="__X__" y="__Y__" width="14" height="3" transform="translate(0 4)" style="fill:${C.c2};"/>`, label: L.reward },
    { swatch: rectSwatch(C.c1), label: L.implicit },
  ]);
  const h2 = narrow ? 130 : 150;
  const top2 = y + 32;
  const y2 = linear([-3, 3.5], [top2 + h2, top2]);
  parts.push(axis({ scale: y2, orient: "left", at: left, grid: [left, w - right], ticks: [-3, -2, -1, 0, 1, 2, 3], title: L.rewardAxis, size }));
  parts.push(el("line", { x1: left, x2: w - right, y1: y2(0), y2: y2(0), stroke: C.ink3, "stroke-width": 1 }));
  const bw2 = Math.min(34, cols.size * 0.5);
  for (let i = 0; i < REF.length; i++) {
    const cx = colX(i) + cols.size / 2;
    const v = m.implicit[i];
    const yTop = Math.min(y2(v), y2(0)), hh = Math.max(0.5, Math.abs(y2(v) - y2(0)));
    parts.push(el("rect", { x: cx - bw2 / 2, y: yTop, width: bw2, height: hh, fill: C.c1, "fill-opacity": i === m.w || i === m.l ? 1 : 0.55 }));
    // The gap from the bar's end to the reward is β log Z(x), the same for every response.
    const yr = y2(Math.min(Math.max(m.r[i], -3), 3.5));
    parts.push(el("line", { x1: cx + bw2 / 2 + 3, x2: cx + bw2 / 2 + 3, y1: y2(v), y2: yr, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
    parts.push(el("line", { x1: cx - bw2 / 2 - 3, x2: cx + bw2 / 2 + 6, y1: yr, y2: yr, stroke: C.c2, "stroke-width": 3, "stroke-linecap": "round" }));
  }
  // Name the gap once, on the axis-title line above the plot, where no bar or tick reaches.
  {
    const gl = tpl(L.gap, { bz: n2(m.bLogZ) });
    const tw = mathWidth(gl, size);
    const yLab = top2 - 10;
    const xLab = Math.max(left + 4, w - right - tw - 2);
    parts.push(mtext(xLab, yLab, gl, size, { class: "fig-t-halo fig-t-soft" }));
  }
  y = top2 + h2 + size + 6;
  tags(y, false);
  y += size + 4 + 8;

  // ---- 3: Bradley-Terry on the chosen pair
  y += 18;
  heading(L.s3);
  note(L.as3);
  const iw = m.implicit[m.w], il = m.implicit[m.l], bz = n2(m.bLogZ);
  const sgn = (v: number) => (v < 0 ? `(${n2(v)})` : n2(v));
  const lineA: Seg[] = [{ s: `${L.lhs}(${n2(iw)} ` }, { s: `+ ${bz}`, strike: true }, { s: `) − (${n2(il)} ` }, { s: `+ ${bz}`, strike: true }, { s: ")" }];
  const lineB: Seg[] = [{ s: `= ${n2(iw)} − ${sgn(il)} = ` }, { s: n2(m.diff), strong: true }];
  y += TYPE.label + 10;
  if (!narrow) {
    parts.push(segLine(0, y, [...lineA, { s: " " }, ...lineB], TYPE.label));
  } else {
    parts.push(segLine(0, y, lineA, TYPE.label));
    y += TYPE.label + 8;
    parts.push(segLine(0, y, lineB, TYPE.label));
  }
  y += TYPE.label + 8;
  parts.push(mtext(0, y, tpl(L.prob3, { d: n2(m.diff), p: n2(m.prob) }), TYPE.label, { class: "fig-t-num" }));

  // ---- 4: the DPO loss at the two ends of training
  y += 18;
  heading(L.s4);
  const lossLine = (head: string, eq: string) => {
    y += TYPE.label + 8;
    if (narrow) {
      parts.push(mtext(0, y, head, TYPE.label));
      y += TYPE.label + 6;
      // Break the equation at its comma so each piece fits the phone column.
      const pieces = mathWidth(eq, TYPE.label) > w ? eq.split(lang === "zh" ? "，" : ", ") : [eq];
      pieces.forEach((piece, k) => {
        if (k) y += TYPE.label + 6;
        parts.push(mtext(0, y, piece + (k < pieces.length - 1 ? (lang === "zh" ? "，" : ",") : ""), TYPE.label, { class: "fig-t-num" }));
      });
    } else {
      parts.push(segLine(0, y, [{ s: `${head}${lang === "zh" ? "" : " "}` }, { s: eq }], TYPE.label));
    }
  };
  lossLine(L.startHead, L.startEq);
  lossLine(L.optHead, tpl(L.optEq, { d: n2(m.diff), l: n2(m.loss) }));
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "dpo-derivation",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    beta: {
      kind: "range", scale: "log", label: { en: "β (KL coefficient)", zh: "β（KL 系数）" }, min: 0.1, max: 10, default: 0.5,
    },
    shift: {
      kind: "range", label: { en: "Add c(x) to rewards", zh: "奖励加上 c(x)" }, min: -2, max: 2, step: 0.1, default: 0,
    },
    pair: {
      kind: "choice", label: { en: "Labeled pair", zh: "标注的样本对" }, default: "2-1",
      options: [
        { value: "2-1", label: { en: "y₂ ≻ y₁", zh: "y₂ ≻ y₁" } },
        { value: "4-2", label: { en: "y₄ ≻ y₂", zh: "y₄ ≻ y₂" } },
        { value: "3-1", label: { en: "y₃ ≻ y₁", zh: "y₃ ≻ y₁" } },
      ],
    },
  },
  render,
  describe,
});
