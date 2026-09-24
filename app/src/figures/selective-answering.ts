// Answer or abstain from calibrated confidence and utilities: the chapter's
// decision rule
//
//   E[U(answer) | x] = q(x) u_correct + (1 − q(x)) u_wrong,
//   answer iff q(x) ≥ τ = (u_abstain − u_wrong) / (u_correct − u_wrong),
//
// applied to a population of queries. u_correct is fixed at 1, u_wrong runs
// from −10 to 0 and u_abstain from 0 to 0.9, so the chapter's ordering
// u_correct > u_abstain ≥ u_wrong holds for every reachable setting; the
// boundary u_abstain = u_wrong = 0 is accuracy-only grading, where τ = 0 and
// every query is answered. The slider marks at u_wrong = −1, −3, −9 are the
// confidence targets t = 0.5, 0.75, 0.9 that Kalai et al. (2025) propose,
// which penalize a wrong answer t / (1 − t) points.
//
// The population is illustrative: 1,000 queries whose confidences are the
// quantiles of a logit-normal distribution (lib/stats.ts), calibrated by
// construction, so a query with confidence q is correct with probability q
// and a histogram bar splits exactly into Σq correct and Σ(1 − q) wrong.
// "Retrieved evidence" moves the distribution toward confident answers and
// spreads it toward both ends; it does not change τ, which only the utilities
// set. Every number is computed exactly; nothing is sampled.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { logitNormalQuantiles } from "./lib/stats.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

const QUERIES = 1000;
const BINS = 20;
const EVIDENCE = {
  closed: { median: 0.55, spread: 1.6 },
  retrieval: { median: 0.8, spread: 2.6 },
} as const;
type Evidence = keyof typeof EVIDENCE;
const POP: Record<Evidence, number[]> = {
  closed: logitNormalQuantiles(EVIDENCE.closed.median, EVIDENCE.closed.spread, QUERIES),
  retrieval: logitNormalQuantiles(EVIDENCE.retrieval.median, EVIDENCE.retrieval.spread, QUERIES),
};
const U_CORRECT = 1;

type P = { wrong: number; abstain: number; evidence: Evidence };

const threshold = (p: P) => (p.abstain - p.wrong) / (U_CORRECT - p.wrong);

interface Outcome { tau: number; coverage: number; accuracy: number; errors: number; correct: number; utility: number }
// The rule "answer when q ≥ tau" on the population, scored with p's utilities.
function outcome(p: P, tau: number): Outcome {
  const qs = POP[p.evidence];
  let answered = 0, correct = 0, u = 0;
  for (const q of qs) {
    if (q >= tau) { answered++; correct += q; u += q * U_CORRECT + (1 - q) * p.wrong; } else u += p.abstain;
  }
  return { tau, coverage: answered / qs.length, accuracy: answered ? correct / answered : 0, errors: (answered - correct) / qs.length, correct: correct / qs.length, utility: u / qs.length };
}

const labels = {
  en: {
    title: "Answer or abstain from calibrated confidence",
    histTitle: "Queries by calibrated confidence q(x)",
    correct: "correct, share q",
    wrong: "wrong, share 1 − q",
    abstainZone: "abstain",
    answerZone: "answer",
    x: "calibrated confidence q(x)",
    euTitle: "Score per query against the threshold",
    euRule: "expected utility, this rule",
    euBinary: "accuracy-only score",
    threshold: "τ = {t}",
    head: "Threshold from the utilities",
    eqNum: "u_abstain − u_wrong",
    eqDen: "u_correct − u_wrong",
    sub: "= ({a} − {w}) / (1 − {w}) = {t}",
    target: "Kalai et al.'s target t = {t}: a wrong answer costs {k} points",
    binaryNote: "Accuracy-only grading: a wrong answer and an abstention both score 0",
    colRule: "τ = {t}",
    colBinary: "answer all",
    rCoverage: "coverage (answered)",
    rAccuracy: "accuracy of answers",
    rErrors: "wrong answers per 100 queries",
    rUtility: "expected utility per query",
    describe: "With u_wrong = {w} and u_abstain = {a}, the threshold is τ = {t}. {ev}: the system answers {c} of queries, {acc} of its answers are correct, and it gives {e} wrong answers per 100 queries, for an expected utility of {u} per query. Answering everything, as accuracy-only grading rewards, would give {e0} wrong answers per 100 and a utility of {u0} under the same utilities.",
    closed: "Closed-book",
    retrieval: "With retrieved evidence",
  },
  zh: {
    title: "根据校准后的置信度决定回答还是弃答",
    histTitle: "按校准置信度 q(x) 分布的问题",
    correct: "答对，占比 q",
    wrong: "答错，占比 1 − q",
    abstainZone: "弃答",
    answerZone: "回答",
    x: "校准置信度 q(x)",
    euTitle: "每个问题的得分随阈值变化",
    euRule: "当前规则下的期望效用",
    euBinary: "只看准确率的得分",
    threshold: "τ = {t}",
    head: "由效用算出的阈值",
    eqNum: "u_abstain − u_wrong",
    eqDen: "u_correct − u_wrong",
    sub: "= ({a} − {w}) / (1 − {w}) = {t}",
    target: "对应 Kalai 等人的目标 t = {t}：答错一次扣 {k} 分",
    binaryNote: "只看准确率的评分：答错与弃答都得 0 分",
    colRule: "τ = {t}",
    colBinary: "全部作答",
    rCoverage: "覆盖率（作答比例）",
    rAccuracy: "作答准确率",
    rErrors: "每 100 个问题中的错误回答",
    rUtility: "每个问题的期望效用",
    describe: "u_wrong = {w}、u_abstain = {a} 时，阈值 τ = {t}。{ev}：系统回答 {c} 的问题，其中 {acc} 答对，每 100 个问题给出 {e} 个错误回答，每个问题的期望效用为 {u}。如果像只看准确率的评分所鼓励的那样全部作答，在同样的效用下每 100 个问题会有 {e0} 个错误回答，期望效用为 {u0}。",
    closed: "闭卷",
    retrieval: "检索到证据",
  },
};
type L = typeof labels.en;

const num = (v: number) => sig(v, 3);
const u2 = (v: number) => fixed(v, 2);

// Kalai et al.'s confidence targets, when the utilities match one exactly.
function kalaiTarget(p: P): { t: number; k: number } | null {
  if (p.abstain !== 0 || p.wrong >= 0) return null;
  for (const t of [0.5, 0.75, 0.9]) if (Math.abs(-p.wrong - t / (1 - t)) < 1e-9) return { t, k: t / (1 - t) };
  return null;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const tau = threshold(p);
  const o = outcome(p, tau), o0 = outcome(p, 0);
  return tpl(L.describe, {
    w: num(p.wrong), a: num(p.abstain), t: u2(tau), ev: L[p.evidence],
    c: pct(o.coverage), acc: pct(o.accuracy), e: fixed(o.errors * 100, 1), u: u2(o.utility), e0: fixed(o0.errors * 100, 1), u0: u2(o0.utility),
  });
}

function bins(p: P) {
  const out = Array.from({ length: BINS }, () => ({ n: 0, correct: 0 }));
  for (const q of POP[p.evidence]) {
    const b = Math.min(BINS - 1, Math.floor(q * BINS));
    out[b].n++;
    out[b].correct += q;
  }
  return out.map((b) => ({ share: b.n / QUERIES, correct: b.correct / QUERIES, wrong: (b.n - b.correct) / QUERIES }));
}

function plots(p: P, x0: number, y0: number, w: number, L: L, fs: number, uid: string, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  const tau = threshold(p);
  const left = x0 + 42, right = x0 + w - 10;
  const x = linear([0, 1], [left, right]);

  // ---- histogram
  parts.push(text(x0, y0 + 13, L.histTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.correct, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.wrong, swatch: { kind: "rect", fill: C.c2 } },
  ], x0, y0 + 22, w, fs);
  parts.push(lg.svg);
  const top = y0 + 30 + lg.height + 14, hH = narrow ? 130 : 140;
  const bs = bins(p);
  const yMax = Math.max(0.1, Math.ceil(Math.max(...bs.map((b) => b.share)) * 20) / 20);
  const y = linear([0, yMax], [top + hH, top]);
  const xt = x(tau);
  parts.push(el("rect", { x: left, y: top, width: Math.max(0, xt - left), height: hH, fill: C.panel }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: y.ticks(4), format: (v) => pct(v), size: fs }));
  const bw = band(BINS, [left, right], narrow ? 1 : 2);
  bs.forEach((b, i) => {
    const bx = bw.at(i);
    const answered = (i + 0.5) / BINS >= tau;
    const op = answered ? 1 : 0.35;
    const yc = y(b.correct), yw = y(b.correct + b.wrong);
    parts.push(el("rect", { x: bx, y: yc, width: bw.size, height: top + hH - yc, fill: C.c1, "fill-opacity": op }));
    parts.push(el("rect", { x: bx, y: yw, width: bw.size, height: yc - yw, fill: C.c2, "fill-opacity": op }));
  });
  parts.push(axis({ scale: x, orient: "bottom", at: top + hH, ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => String(v), size: fs }));
  // Zone names above the plot, on each side of the threshold.
  const zy = top - 5;
  if (xt - left > textWidth(L.abstainZone, fs) + 8) parts.push(text((left + xt) / 2, zy, L.abstainZone, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  if (right - xt > textWidth(L.answerZone, fs) + 8) parts.push(text((xt + right) / 2, zy, L.answerZone, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));

  // ---- expected score against the threshold, on the same x scale
  const eTop = top + hH + axisHeight(false, fs) + 34;
  parts.push(text(x0, eTop - 12, L.euTitle, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg2 = legend([
    { label: L.euRule, swatch: { kind: "line", stroke: C.ink } },
    { label: L.euBinary, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
  ], x0, eTop - 4, w, fs);
  parts.push(lg2.svg);
  const pTop = eTop + lg2.height + 6, eH = narrow ? 120 : 120;
  const ey = linear([-1, 1], [pTop + eH, pTop]);
  const clip = `${uid}-eu`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: pTop, width: right - left, height: eH }))));
  parts.push(axis({ scale: ey, orient: "left", at: left, grid: [left, right], ticks: [-1, -0.5, 0, 0.5, 1], format: (v) => (v < 0 ? `−${Math.abs(v)}` : String(v)), size: fs }));
  const ts = Array.from({ length: 201 }, (_, i) => i / 200);
  const eu = ts.map((t) => [x(t), ey(outcome(p, t).utility)] as [number, number]);
  const acc = ts.map((t) => [x(t), ey(outcome(p, t).correct)] as [number, number]);
  parts.push(g({ "clip-path": `url(#${clip})` },
    el("path", { d: linePath(acc), fill: "none", stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }),
    el("path", { d: linePath(eu), fill: "none", stroke: C.ink, "stroke-width": 2 })));
  const o = outcome(p, tau);
  parts.push(el("circle", { cx: xt, cy: ey(o.utility), r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 2 }));
  parts.push(axis({ scale: x, orient: "bottom", at: pTop + eH, ticks: [0, 0.25, 0.5, 0.75, 1], title: L.x, format: (v) => String(v), size: fs }));

  // The threshold runs through both plots.
  for (const [a, b] of [[top - 2, top + hH], [pTop, pTop + eH]]) parts.push(el("line", { x1: xt, x2: xt, y1: a, y2: b, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "5 3" }));
  const tl = tpl(L.threshold, { t: u2(tau) });
  const tw = textWidth(tl, TYPE.label);
  const tx = Math.min(Math.max(xt + 6, left + 2), right - tw);
  parts.push(text(xt + 6 + tw > right ? xt - 6 : tx, top + 14, tl, { "font-size": TYPE.label, "text-anchor": xt + 6 + tw > right ? "end" : "start", class: "fig-t-halo fig-t-num" }));
  return { svg: g({ class: "fig-plots" }, ...parts), h: pTop + eH + axisHeight(true, fs) - y0 };
}

function readout(p: P, x0: number, y0: number, w: number, L: L, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const tau = threshold(p);
  const o = outcome(p, tau), o0 = outcome(p, 0);
  let y = y0 + 13;
  parts.push(text(x0, y, L.head, { "font-size": TYPE.label, class: "fig-t-strong" }));
  // The threshold as a stacked fraction, so it never wraps mid-term.
  const ef = fs + 1;
  const lead = "τ = ";
  const lw = textWidth(lead, ef);
  const fw = Math.max(textWidth(L.eqNum, ef), textWidth(L.eqDen, ef));
  const cx = x0 + lw + fw / 2;
  const yNum = y + 12 + ef + 4, yBar = yNum + 5, yDen = yBar + ef + 5;
  parts.push(text(x0, yBar + ef * 0.35, lead, { "font-size": ef, class: "fig-t-num" }));
  parts.push(text(cx, yNum, L.eqNum, { "font-size": ef, "text-anchor": "middle", class: "fig-t-num" }));
  parts.push(el("line", { x1: x0 + lw, x2: x0 + lw + fw, y1: yBar, y2: yBar, stroke: C.ink, "stroke-width": 1 }));
  parts.push(text(cx, yDen, L.eqDen, { "font-size": ef, "text-anchor": "middle", class: "fig-t-num" }));
  y = yDen + fs + 10;
  parts.push(text(x0 + 8, y, tpl(L.sub, { a: num(p.abstain), w: p.wrong < 0 ? `(${num(p.wrong)})` : num(p.wrong), t: u2(tau) }), { "font-size": fs + 1, class: "fig-t-strong fig-t-num" }));
  const k = kalaiTarget(p);
  const note = k ? tpl(L.target, { t: String(k.t), k: num(k.k) }) : p.wrong === 0 && p.abstain === 0 ? L.binaryNote : "";
  if (note) for (const ln of wrapCJK(note, fs, w)) { y += fs + 5; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  y += 24;
  // This rule against answering everything, both scored with the same utilities.
  const colW = Math.max(textWidth(tpl(L.colRule, { t: "0.00" }), fs), textWidth(L.colBinary, fs), textWidth("100%", fs)) + 12;
  const xb = x0 + w, xa = xb - colW;
  parts.push(text(xa, y, tpl(L.colRule, { t: u2(tau) }), { "font-size": fs, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  parts.push(text(xb, y, L.colBinary, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
  y += 6;
  const rows: Array<[string, string, string]> = [
    [L.rCoverage, pct(o.coverage), pct(o0.coverage)],
    [L.rAccuracy, pct(o.accuracy), pct(o0.accuracy)],
    [L.rErrors, fixed(o.errors * 100, 1), fixed(o0.errors * 100, 1)],
    [L.rUtility, u2(o.utility).replace("-", "−"), u2(o0.utility).replace("-", "−")],
  ];
  for (const [name, a, b] of rows) {
    parts.push(el("line", { x1: x0, x2: xb, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const lines = wrapCJK(name, fs, xa - colW - x0 - 4);
    lines.forEach((ln, i) => parts.push(text(x0, y + fs + 5 + i * (fs + 3), ln, { "font-size": fs })));
    parts.push(text(xa, y + fs + 5, a, { "font-size": fs, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    parts.push(text(xb, y + fs + 5, b, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    y += fs + 11 + (lines.length - 1) * (fs + 3);
  }
  parts.push(el("line", { x1: x0, x2: xb, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 2 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  let h: number;
  if (narrow) {
    const a = plots(st.p, 0, 0, w, L, fs, st.uid, narrow);
    const b = readout(st.p, 0, a.h + 18, w, L, fs);
    parts.push(a.svg, b.svg);
    h = a.h + 18 + b.h;
  } else {
    const pw = Math.floor(w * 0.58);
    const a = plots(st.p, 0, 0, pw, L, fs, st.uid, narrow);
    const b = readout(st.p, pw + 26, 0, w - pw - 26, L, fs);
    parts.push(a.svg, b.svg);
    h = Math.max(a.h, b.h);
  }
  return svg(w, h + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "selective-answering",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    wrong: {
      kind: "range", label: { en: "Utility of a wrong answer, u_wrong", zh: "答错的效用 u_wrong" }, min: -10, max: 0, step: 0.25, default: -3,
      marks: [
        { value: 0, label: { en: "accuracy-only grading", zh: "只看准确率" } },
        { value: -1, label: { en: "t = 0.5", zh: "t = 0.5" } },
        { value: -3, label: { en: "t = 0.75", zh: "t = 0.75" } },
        { value: -9, label: { en: "t = 0.9", zh: "t = 0.9" } },
      ],
    },
    abstain: { kind: "range", label: { en: "Utility of abstaining, u_abstain", zh: "弃答的效用 u_abstain" }, min: 0, max: 0.9, step: 0.05, default: 0 },
    evidence: {
      kind: "choice", label: { en: "Evidence", zh: "证据" }, default: "closed",
      options: [
        { value: "closed", label: { en: "Closed-book", zh: "闭卷" } },
        { value: "retrieval", label: { en: "With retrieved evidence", zh: "检索到证据" } },
      ],
    },
  },
  render,
  describe,
});
