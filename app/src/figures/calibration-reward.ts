// Expected reward against stated confidence, for the chapter's three rewards
// on an answer that is correct with probability p (C ~ Bernoulli(p)) when the
// policy states confidence c:
//
//   binary  r_ver = C                                 E = p
//   Brier   r_cal = C − (c − C)²                      E = p − [p(1 − c)² + (1 − p)c²]
//   log     r_log = C + C ln c + (1 − C) ln(1 − c)    E = p + p ln c + (1 − p) ln(1 − c)
//
// Both scoring rules are proper, so each is maximized at c = p. At that
// optimum the best expected reward is p² under Brier, which rises with p, and
// p − H(p) under the log score (H the binary entropy in nats), whose
// derivative 1 + ln(p / (1 − p)) is negative below p = 1 / (1 + e): there a
// less likely answer earns more, which is the chapter's reason the
// calibration term must be bounded. Every value is computed from these
// expressions; nothing is measured.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Rule = "bin" | "brier" | "log";
const RULES: Rule[] = ["bin", "brier", "log"];
const COLOR: Record<Rule, string> = { bin: C.c1, brier: C.c2, log: C.c3 };
const P_TURN = 1 / (1 + Math.E); // where p − H(p) stops falling

function expected(rule: Rule, p: number, c: number): number {
  if (rule === "bin") return p;
  if (rule === "brier") return p - (p * (1 - c) ** 2 + (1 - p) * c ** 2);
  const lc = c <= 0 ? -Infinity : Math.log(c), l1 = c >= 1 ? -Infinity : Math.log(1 - c);
  return p + (p > 0 ? p * lc : 0) + (p < 1 ? (1 - p) * l1 : 0);
}
const entropy = (p: number) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log(p) + (1 - p) * Math.log(1 - p)));
function best(rule: Rule, p: number): number {
  return rule === "bin" ? p : rule === "brier" ? p * p : p - entropy(p);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Expected reward and stated confidence",
    bin: "binary: r_ver = C",
    brier: "Brier: r_cal = C − (c − C)²",
    log: "log score: C + C ln c + (1 − C) ln(1 − c)",
    binShort: "binary",
    brierShort: "Brier",
    logShort: "log score",
    panelA: "Expected reward at p = {p}, by stated confidence",
    panelB: "Best expected reward, at c = p, by chance of being correct",
    xA: "stated confidence c",
    xB: "chance the answer is correct p",
    yA: "expected reward",
    yB: "best expected reward",
    cursor: "c = {c}",
    optimum: "c = p",
    turn: "p = 1/(1 + e)",
    rowHead: "at c = {c}",
    rowBest: "best c",
    rowBestE: "best E[r]",
    any: "any",
    expand: "E[r_cal] = p − [p(1 − c)² + (1 − p)c²] = {p} − [{p}·{a} + {q}·{b}] = {e}",
    flat: "The binary reward pays p at every c, so the stated confidence receives no training signal.",
    fallsLow: "At p = {p} the log score's best expected reward is {e}, but an answer with p = 0.01 earns {e0}: below p ≈ 0.27, a less likely answer earns more.",
    risesHigh: "Above p ≈ 0.27 all three best rewards rise with p. Below it p − H(p) falls as p rises, so under the log score a less likely answer earns more.",
    describe: "An answer correct with probability {p}, stated at confidence {c}: expected reward {eb} under the binary reward, {er} under Brier (best {br} at c = p) and {el} under the log score (best {bl} at c = p).",
  },
  zh: {
    title: "期望奖励与报出的置信度",
    bin: "二元奖励：r_ver = C",
    brier: "Brier：r_cal = C − (c − C)²",
    log: "对数评分：C + C ln c + (1 − C) ln(1 − c)",
    binShort: "二元",
    brierShort: "Brier",
    logShort: "对数评分",
    panelA: "p = {p} 时，期望奖励随报出置信度的变化",
    panelB: "c = p 时的最佳期望奖励，随正确概率的变化",
    xA: "报出的置信度 c",
    xB: "答案正确的概率 p",
    yA: "期望奖励",
    yB: "最佳期望奖励",
    cursor: "c = {c}",
    optimum: "c = p",
    turn: "p = 1/(1 + e)",
    rowHead: "c = {c} 时",
    rowBest: "最佳 c",
    rowBestE: "最佳 E[r]",
    any: "任意",
    expand: "E[r_cal] = p − [p(1 − c)² + (1 − p)c²] = {p} − [{p}·{a} + {q}·{b}] = {e}",
    flat: "二元奖励在任何 c 下都付 p，报出的置信度得不到任何训练信号。",
    fallsLow: "p = {p} 时，对数评分的最佳期望奖励为 {e}，而 p = 0.01 的答案能得到 {e0}：p 低于约 0.27 时，正确可能性更低的答案反而得分更高。",
    risesHigh: "p 高于约 0.27 时，三种最佳奖励都随 p 上升。低于这个值时，p − H(p) 随 p 增大而下降，所以在对数评分下，正确可能性更低的答案反而得分更高。",
    describe: "正确概率为 {p} 的答案、报出置信度为 {c} 时：二元奖励的期望为 {eb}，Brier 为 {er}（c = p 时最佳 {br}），对数评分为 {el}（c = p 时最佳 {bl}）。",
  },
};

type P = { p: number; c: number };
const f2 = (v: number) => (Number.isFinite(v) ? fixed(v, 2) : "−∞");
function lines(s: string, size: number, width: number, lang: Lang): string[] {
  if (lang !== "zh") return wrap(s, size, width);
  const ls = wrapCjk(s, size, width);
  return ls.some((l) => textWidth(l, size) > width) ? wrapCjk(s, size, width - size) : ls;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const { p, c } = st.p;
  return tpl(L.describe, {
    p: f2(p), c: f2(c),
    eb: f2(expected("bin", p, c)), er: f2(expected("brier", p, c)), el: f2(expected("log", p, c)),
    br: f2(best("brier", p)), bl: f2(best("log", p)),
  });
}

// ---------------------------------------------------------------- render

interface Panel { svg: string; h: number }

function panel(kind: "A" | "B", p: P, lang: Lang, x0: number, y0: number, pw: number, uid: string): Panel {
  const L = labels[lang];
  const fs = TYPE.body;
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(kind === "A" ? tpl(L.panelA, { p: f2(p.p) }) : L.panelB, TYPE.label, pw, lang)) {
    y += 16;
    parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
  }
  const left = 40, right = 8;
  const top = y + 30;
  const ph = pw < 300 ? 180 : 200;
  const x = linear([0, 1], [x0 + left, x0 + pw - right]);
  const yd: [number, number] = kind === "A" ? [-1.5, 1] : [-0.4, 1];
  const ys = linear(yd, [top + ph, top]);
  const ticks = kind === "A" ? [-1.5, -1, -0.5, 0, 0.5, 1] : [-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1];
  // The range where p − H(p) falls, on the right panel.
  if (kind === "B") parts.push(el("rect", { x: x(0), y: top, width: x(P_TURN) - x(0), height: ph, fill: C.c3, "fill-opacity": 0.08 }));
  parts.push(axis({ scale: x, orient: "bottom", at: top + ph, grid: [top, top + ph], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => fixed(v, 1), title: kind === "A" ? L.xA : L.xB, size: fs }));
  parts.push(axis({ scale: ys, orient: "left", at: x0 + left, grid: [x0 + left, x0 + pw - right], ticks: kind === "A" ? ticks : ticks.filter((_, i) => i % 1 === 0), format: (v) => fixed(v, 1), title: kind === "A" ? L.yA : L.yB, size: fs }));
  parts.push(el("line", { x1: x0 + left, x2: x0 + pw - right, y1: ys(0), y2: ys(0), stroke: C.rule, "stroke-width": 1 }));
  const clipId = `${uid}-clip${kind}`;
  parts.push(el("defs", {}, el("clipPath", { id: clipId }, el("rect", { x: x0 + left, y: top, width: pw - left - right, height: ph }))));
  const curves: string[] = [];
  const n = 240;
  for (const rule of RULES) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const v = kind === "A" ? 0.0005 + (0.999 * i) / n : i / n;
      const e = kind === "A" ? expected(rule, p.p, v) : best(rule, v);
      pts.push([x(v), ys(Math.max(yd[0] - 1, e))]);
    }
    curves.push(el("path", { d: linePath(pts), fill: "none", stroke: COLOR[rule], "stroke-width": 2.25, "stroke-linejoin": "round" }));
  }
  parts.push(g({ "clip-path": `url(#${clipId})` }, ...curves));
  if (kind === "A") {
    // The optimum of both scoring rules, c = p.
    const xo = x(p.p);
    parts.push(el("line", { x1: xo, x2: xo, y1: top, y2: top + ph, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
    // The chosen c.
    const xc = x(p.c);
    parts.push(el("line", { x1: xc, x2: xc, y1: top, y2: top + ph, stroke: C.ink2, "stroke-width": 1.25, "stroke-dasharray": "5 3" }));
    // Labels along the foot of the plot, clear of the axis title above it,
    // with a halo where a curve passes; the cursor and the optimum kept apart.
    const lc = tpl(L.cursor, { c: f2(p.c) }), lo = L.optimum;
    const wc = textWidth(lc, fs), wo = textWidth(lo, fs);
    const clampX = (v: number, ww: number) => Math.min(Math.max(v, x0 + left + ww / 2), x0 + pw - right - ww / 2);
    let cxL = clampX(xc, wc), oxL = clampX(xo, wo);
    if (Math.abs(cxL - oxL) < (wc + wo) / 2 + 6) {
      if (cxL <= oxL) oxL = clampX(cxL + (wc + wo) / 2 + 6, wo); else oxL = clampX(cxL - (wc + wo) / 2 - 6, wo);
      if (Math.abs(cxL - oxL) < (wc + wo) / 2 + 6) cxL = clampX(oxL + (cxL <= oxL ? -1 : 1) * ((wc + wo) / 2 + 6), wc);
    }
    const ly = top + ph - 7;
    parts.push(text(cxL, ly, lc, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
    parts.push(text(oxL, ly, lo, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-soft" }));
    for (const rule of RULES) {
      const eo = expected(rule, p.p, p.p), ec = expected(rule, p.p, p.c);
      if (rule !== "bin") parts.push(el("circle", { cx: xo, cy: ys(Math.max(yd[0], eo)), r: 4.5, fill: C.paper, stroke: COLOR[rule], "stroke-width": 2 }));
      const off = ec < yd[0];
      parts.push(el("circle", { cx: xc, cy: ys(Math.max(yd[0], ec)), r: 5, fill: off ? C.paper : COLOR[rule], stroke: off ? COLOR[rule] : C.paper, "stroke-width": off ? 2 : 1.5 }));
    }
  } else {
    const xt = x(P_TURN);
    parts.push(el("line", { x1: xt, x2: xt, y1: top, y2: top + ph, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
    parts.push(text(xt + 5, top + 15, L.turn, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));
    const xp = x(p.p);
    parts.push(el("line", { x1: xp, x2: xp, y1: top, y2: top + ph, stroke: C.ink2, "stroke-width": 1.25, "stroke-dasharray": "5 3" }));
    for (const rule of RULES) parts.push(el("circle", { cx: xp, cy: ys(best(rule, p.p)), r: 5, fill: COLOR[rule], stroke: C.paper, "stroke-width": 1.5 }));
  }
  return { svg: g({ class: `fig-panel-${kind}` }, ...parts), h: top + ph + axisHeight(true, fs) - y0 };
}

function readout(p: P, lang: Lang, y0: number, w: number): Panel {
  const L = labels[lang];
  const fs = TYPE.body;
  const parts: string[] = [];
  const narrow = w < 480;
  const nameW = Math.max(...RULES.map((r) => textWidth(L[`${r}Short` as const], fs))) + 30;
  const colW = narrow ? Math.floor((w - nameW) / 3) : 110;
  const cols = [tpl(L.rowHead, { c: f2(p.c) }), L.rowBest, L.rowBestE];
  let y = y0 + 14;
  cols.forEach((h, j) => parts.push(text(nameW + (j + 1) * colW, y, h, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" })));
  y += 6;
  for (const rule of RULES) {
    parts.push(el("line", { x1: 0, x2: nameW + 3 * colW, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    y += 17;
    parts.push(el("line", { x1: 0, x2: 16, y1: y - 4, y2: y - 4, stroke: COLOR[rule], "stroke-width": 2.5 }));
    parts.push(text(24, y, L[`${rule}Short` as const], { "font-size": fs }));
    const vals = [f2(expected(rule, p.p, p.c)), rule === "bin" ? L.any : f2(p.p), f2(best(rule, p.p))];
    vals.forEach((v, j) => parts.push(text(nameW + (j + 1) * colW, y, v, { "font-size": fs, "text-anchor": "end", class: "fig-t-num" })));
    y += 6;
  }
  parts.push(el("line", { x1: 0, x2: nameW + 3 * colW, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 22;
  const a = (1 - p.c) ** 2, b = p.c ** 2;
  const notes: Array<[string, string]> = [
    [tpl(L.expand, { p: f2(p.p), q: f2(1 - p.p), a: f2(a), b: f2(b), e: f2(expected("brier", p.p, p.c)) }), "fig-t-num"],
    [L.flat, "fig-t-muted"],
    [p.p < P_TURN ? tpl(L.fallsLow, { p: f2(p.p), e: f2(best("log", p.p)), e0: f2(best("log", 0.01)) }) : L.risesHigh, "fig-t-muted"],
  ];
  for (const [n, cls] of notes) {
    for (const ln of lines(n, fs, w, lang)) { parts.push(text(0, y, ln, { "font-size": fs, class: cls })); y += 16; }
    y += 4;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [];
  const lg = legend(RULES.map((r) => ({ label: L[r], swatch: { kind: "line" as const, stroke: COLOR[r] } })), 0, 0, w, TYPE.body);
  parts.push(lg.svg);
  let y = lg.height + 6;
  if (narrow) {
    const a = panel("A", p, lang, 0, y, w, st.uid);
    parts.push(a.svg); y += a.h + 12;
    const b = panel("B", p, lang, 0, y, w, st.uid);
    parts.push(b.svg); y += b.h + 12;
  } else {
    const pw = Math.floor((w - 24) / 2);
    const a = panel("A", p, lang, 0, y, pw, st.uid);
    const b = panel("B", p, lang, pw + 24, y, w - pw - 24, st.uid);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 12;
  }
  const r = readout(p, lang, y, w);
  parts.push(r.svg);
  y += r.h;
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "calibration-reward",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    p: { kind: "range", label: { en: "Chance the answer is correct, p", zh: "答案正确的概率 p" }, min: 0.01, max: 0.99, step: 0.01, default: 0.6 },
    c: { kind: "range", label: { en: "Stated confidence c", zh: "报出的置信度 c" }, min: 0, max: 1, step: 0.01, default: 0.9 },
  },
  render,
  describe,
});
