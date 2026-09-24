// Outcome against process supervision on one seeded problem.
//
// The problem is a five-step calculation, (3 × 12 − 8 + 5) × 2 − 18 = 48, and
// a seeded solver writes eight candidate solutions z_1..z_5 with final answer
// y = the value of z_5. Each step applies the problem's next operation to the
// candidate's own previous value:
// - with the slip rate it writes a wrong result instead (off by 1, 2, or 10);
// - after a slip, each later step either continues validly from the wrong
//   value, or with the jump-back rate writes the value the correct chain has at
//   that step, which that step's own input does not justify.
// A jump back can put a correct final answer at the end of an invalid trace,
// the case outcome labels cannot see.
//
// Two verifiers read every candidate:
// - Outcome: r_out(x, c) = check(x, y), 1 when y = 48.
// - Process: r_t = V_φ(x, z_{1:t}) scores step correctness, whether z_t follows
//   from z_{t−1}. The score is σ(μ s_t + τ ε_t) with s_t = +1 for a valid step
//   and −1 for an invalid one, μ = 3, and ε_t a seeded standard normal draw per
//   step, so at the 0.5 threshold its false-accept and false-reject rates are
//   both Φ(−μ / τ). The reader sets that rate and τ follows.
// The per-step scores become one candidate score by the chapter's aggregation
// rules: the minimum, the product, or the last score.
//
// Every draw is made once per seed and candidate, whatever the rates, so moving
// a slider changes which steps slip rather than redrawing the whole sample.
// The solutions and the verifier's errors are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { normalQuantile } from "./lib/stats.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { mathText, mathWidth } from "./lib/math-text.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export const START = 3;
export const OPS: ReadonlyArray<{ op: "×" | "−" | "+"; k: number }> = [
  { op: "×", k: 12 }, { op: "−", k: 8 }, { op: "+", k: 5 }, { op: "×", k: 2 }, { op: "−", k: 18 },
];
export const T = OPS.length;
export const N = 8;
const MU = 3;
const SLIPS = [-10, -2, -1, 1, 2, 10];

const apply = (v: number, t: number) => {
  const { op, k } = OPS[t];
  return op === "×" ? v * k : op === "−" ? v - k : v + k;
};
export const REFERENCE: number[] = (() => {
  const out: number[] = [];
  let v = START;
  for (let t = 0; t < T; t++) { v = apply(v, t); out.push(v); }
  return out;
})();
export const ANSWER = REFERENCE[T - 1];

export interface Step {
  input: number; // the candidate's previous value (START for step 1)
  claimed: number; // what the step writes
  valid: boolean; // claimed follows from input
  onTrack: boolean; // claimed equals the reference value at this step
  z: number; // verifier noise draw
}
export interface Candidate { steps: Step[]; y: number; pass: boolean; firstError: number } // firstError: 0-based step, -1 if none

function normal(u: () => number): number {
  const a = Math.max(1e-12, u()), b = u();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

// The draws for one seed: per candidate and step, the slip draw, the slip
// size, the jump-back draw, and the verifier noise.
const drawMemo = new Map<number, Array<Array<[number, number, number, number]>>>();
function draws(seed: number) {
  let hit = drawMemo.get(seed);
  if (!hit) {
    const u = rng(seed * 2654435761 + 97);
    hit = Array.from({ length: N }, () => Array.from({ length: T }, () => [u(), u(), u(), normal(u)] as [number, number, number, number]));
    if (drawMemo.size > 64) drawMemo.clear();
    drawMemo.set(seed, hit);
  }
  return hit;
}

export function sample(seed: number, slip: number, jump: number): Candidate[] {
  return draws(seed).map((row) => {
    const steps: Step[] = [];
    let v = START, derailed = false;
    row.forEach(([us, ud, uj, z], t) => {
      const right = apply(v, t);
      let claimed = right;
      if (derailed && uj < jump) claimed = REFERENCE[t];
      else if (us < slip) claimed = right + SLIPS[Math.floor(ud * SLIPS.length)];
      const valid = claimed === right;
      const onTrack = claimed === REFERENCE[t];
      steps.push({ input: v, claimed, valid, onTrack, z });
      derailed = !onTrack;
      v = claimed;
    });
    const y = steps[T - 1].claimed;
    return { steps, y, pass: y === ANSWER, firstError: steps.findIndex((s) => !s.valid) };
  });
}

export type Agg = "min" | "product" | "last";

export function noiseFor(rate: number): number {
  return rate <= 0 ? 0 : MU / normalQuantile(1 - rate);
}
export function stepScore(s: Step, tau: number): number {
  return 1 / (1 + Math.exp(-(MU * (s.valid ? 1 : -1) + tau * s.z)));
}
export function aggregate(r: number[], agg: Agg): number {
  if (agg === "min") return Math.min(...r);
  if (agg === "last") return r[r.length - 1];
  return r.reduce((a, b) => a * b, 1);
}

type P = { slip: number; jump: number; verr: number; agg: Agg; focus: number; seed: number };

export function model(p: P) {
  const cands = sample(p.seed, p.slip, p.jump);
  const tau = noiseFor(p.verr);
  const scores = cands.map((c) => c.steps.map((s) => stepScore(s, tau)));
  const agg = scores.map((r) => aggregate(r, p.agg));
  let best = 0;
  for (let i = 1; i < N; i++) if (agg[i] > agg[best]) best = i;
  const passing = cands.map((c, i) => (c.pass ? i : -1)).filter((i) => i >= 0);
  const flawedPassing = passing.filter((i) => cands[i].firstError >= 0);
  // Default focus: a candidate the outcome check accepts that holds an invalid
  // step (the earliest such error first), else any candidate with an error.
  let auto = -1;
  for (const i of flawedPassing) if (auto < 0 || cands[i].firstError < cands[auto].firstError) auto = i;
  if (auto < 0) auto = Math.max(0, cands.findIndex((c) => c.firstError >= 0));
  const focus = p.focus > 0 ? p.focus - 1 : auto;
  return { cands, tau, scores, agg, best, passing, flawedPassing, focus };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Outcome and process supervision on sampled solutions",
    problem: "Problem x: (3 × 12 − 8 + 5) × 2 − 18, answer 48. Eight sampled solutions of five steps each:",
    step: "z_{t}",
    y: "y",
    check: "check",
    agg: "{rule} r_t",
    min: "min",
    product: "product",
    last: "last",
    invalid: "invalid step (true label)",
    score: "step score r_t",
    pass: "pass",
    fail: "fail",
    picked: "top aggregated score",
    cand: "#{i}",
    detail: "Solution #{i}: y = {y}, so r_out = check(x, y) = {r}",
    valid: "follows",
    wrong: "{a} {op} {k} is {v}",
    firstTrue: "First invalid step: z_{t}. First step scored below 0.5: {f}.",
    firstNone: "Every step is valid. First step scored below 0.5: {f}.",
    none: "none",
    stepName: "z_{t}",
    aggRow: "min {a}, product {b}, last {c}",
    sumOutcome: "The outcome check passes {k} of 8; {f} of those hold an invalid step.",
    sumOutcomeNone: "The outcome check passes {k} of 8, all with valid steps.",
    sumProcess: "Ranked by {phrase}, #{i} comes first: {what}.",
    phraseMin: "the minimum of r_t",
    phraseProduct: "the product of r_t",
    phraseLast: "the last step's r_t",
    dMin: "the minimum step score",
    dProduct: "the product of step scores",
    dLast: "the last step's score",
    sound: "every step valid",
    flawed: "invalid from step {t}, answer {ok}",
    right: "right",
    wrongAns: "wrong",
    rates: "Step verifier at threshold 0.5: FAR = FRR = {r}. On these 40 steps it scores {a} of {m} invalid steps above 0.5 and {b} of {n} valid steps below it.",
    describe: "{k} of 8 solutions pass the outcome check and {f} of those hold an invalid step. Ranked by {phrase}, solution {i} comes first ({what}). Solution {j}: first invalid step {e}, first step scored below 0.5 {s}.",
  },
  zh: {
    title: "采样解答上的结果监督与过程监督",
    problem: "问题 x：(3 × 12 − 8 + 5) × 2 − 18，答案 48。采样得到 8 份解答，每份五步：",
    step: "z_{t}",
    y: "y",
    check: "检查",
    agg: "r_t {rule}",
    min: "最小值",
    product: "乘积",
    last: "最后一步",
    invalid: "无效步骤（真实标签）",
    score: "步骤分数 r_t",
    pass: "通过",
    fail: "不通过",
    picked: "聚合分数最高",
    cand: "#{i}",
    detail: "解答 #{i}：y = {y}，所以 r_out = check(x, y) = {r}",
    valid: "成立",
    wrong: "{a} {op} {k} 应为 {v}",
    firstTrue: "最早的无效步骤：z_{t}。最早得分低于 0.5 的步骤：{f}。",
    firstNone: "每一步都有效。最早得分低于 0.5 的步骤：{f}。",
    none: "无",
    stepName: "z_{t}",
    aggRow: "最小值 {a}，乘积 {b}，最后一步 {c}",
    sumOutcome: "结果检查通过 8 份中的 {k} 份，其中 {f} 份含有无效步骤。",
    sumOutcomeNone: "结果检查通过 8 份中的 {k} 份，这些解答的步骤全部有效。",
    sumProcess: "按{phrase}排序，#{i} 排第一：{what}。",
    phraseMin: " r_t 的最小值",
    phraseProduct: " r_t 的乘积",
    phraseLast: "最后一步的 r_t ",
    dMin: "最低的步骤分数",
    dProduct: "步骤分数的乘积",
    dLast: "最后一步的分数",
    sound: "每一步都有效",
    flawed: "从第 {t} 步开始无效，答案{ok}",
    right: "正确",
    wrongAns: "错误",
    rates: "步骤验证器取阈值 0.5 时：FAR = FRR = {r}。在这 40 个步骤上，它把 {m} 个无效步骤中的 {a} 个打到 0.5 以上，把 {n} 个有效步骤中的 {b} 个打到 0.5 以下。",
    describe: "8 份解答中有 {k} 份通过结果检查，其中 {f} 份含有无效步骤。按{phrase}排序，解答 {i} 排第一（{what}）。解答 {j}：最早的无效步骤为 {e}，最早得分低于 0.5 的步骤为 {s}。",
  },
};
type L = typeof labels.en;

const ruleName = (agg: Agg, L: L) => (agg === "min" ? L.min : agg === "product" ? L.product : L.last);
const phraseOf = (agg: Agg, L: L) => (agg === "min" ? L.phraseMin : agg === "product" ? L.phraseProduct : L.phraseLast);
const firstLow = (r: number[]) => r.findIndex((v) => v < 0.5);

function what(c: Candidate, L: L): string {
  return c.firstError < 0 ? L.sound : tpl(L.flawed, { t: c.firstError + 1, ok: c.pass ? L.right : L.wrongAns });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const c = m.cands[m.focus];
  const e = c.firstError >= 0 ? `z${c.firstError + 1}` : L.none;
  const lo = firstLow(m.scores[m.focus]);
  return tpl(L.describe, {
    k: m.passing.length, f: m.flawedPassing.length, phrase: st.p.agg === "min" ? L.dMin : st.p.agg === "product" ? L.dProduct : L.dLast, i: m.best + 1,
    what: what(m.cands[m.best], L), j: m.focus + 1, e, s: lo >= 0 ? `z${lo + 1}` : L.none,
  });
}

// Step verdicts at the 0.5 threshold on this sample: invalid steps scored
// above it (false accepts) and valid steps scored below it (false rejects).
function confusion(m: ReturnType<typeof model>) {
  let a = 0, mm = 0, b = 0, n = 0;
  m.cands.forEach((c, i) => c.steps.forEach((s, t) => {
    if (s.valid) { n++; if (m.scores[i][t] < 0.5) b++; } else { mm++; if (m.scores[i][t] >= 0.5) a++; }
  }));
  return { a, m: mm, b, n };
}

function wrapText(s: string, size: number, w: number): string[] {
  return wrapCjk(s, size, w);
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const size = TYPE.body;
  const parts: string[] = [];
  let y = 0;
  for (const ln of wrapText(L.problem, TYPE.label, w)) { y += TYPE.label + 4; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 10;

  // ---- matrix: candidates by steps, then y, the outcome check, and the aggregate
  const labelW = narrow ? 26 : 34;
  const yW = narrow ? 30 : 40;
  const checkW = narrow ? 44 : 56;
  const aggW = narrow ? 44 : 118;
  const gap = narrow ? 3 : 4;
  const cellW = Math.floor((w - labelW - yW - checkW - aggW - gap * (T + 2)) / T);
  const rowH = narrow ? 24 : 26;
  const xStep = (t: number) => labelW + t * (cellW + gap);
  const xY = labelW + T * (cellW + gap);
  const xCheck = xY + yW + gap;
  const xAgg = xCheck + checkW + gap;
  // Header.
  const hy = y + size;
  for (let t = 0; t < T; t++) parts.push(mathText(xStep(t) + cellW / 2, hy, tpl(L.step, { t: t + 1 }), { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(xY + yW / 2, hy, L.y, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(text(xCheck + checkW / 2, hy, L.check, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
  parts.push(mathText(narrow ? xAgg + aggW : xAgg, hy, narrow ? ruleName(p.agg, L) : tpl(L.agg, { rule: ruleName(p.agg, L) }), { "font-size": size, "text-anchor": narrow ? "end" : "start", class: "fig-t-muted" }));
  y = hy + 8;
  const aggMax = Math.max(...m.agg, 1e-9);
  for (let i = 0; i < N; i++) {
    const c = m.cands[i];
    const r = m.scores[i];
    const top = y + i * (rowH + 2);
    const mid = top + rowH / 2;
    const sel = i === m.focus;
    if (sel) parts.push(el("rect", { x: -2, y: top - 1, width: w + 2, height: rowH + 2, rx: 4, fill: C.panel }));
    parts.push(text(labelW - 6, mid + 4, tpl(L.cand, { i: i + 1 }), { "font-size": size, "text-anchor": "end", class: sel ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    for (let t = 0; t < T; t++) {
      const s = c.steps[t];
      const x = xStep(t);
      parts.push(el("rect", { x, y: top, width: cellW, height: rowH, rx: 3, fill: C.paper, stroke: C.grid, "stroke-width": 1 }));
      parts.push(el("rect", { x, y: top, width: cellW, height: rowH, rx: 3, fill: C.c1, "fill-opacity": (0.08 + 0.5 * r[t]).toFixed(3) }));
      if (!s.valid) {
        parts.push(el("rect", { x: x + 1, y: top + 1, width: cellW - 2, height: rowH - 2, rx: 3, fill: "none", stroke: C.bad, "stroke-width": 2 }));
        parts.push(el("path", { d: `M${x + cellW - 9},${top + 1}L${x + cellW - 1},${top + 1}L${x + cellW - 1},${top + 9}Z`, fill: C.bad }));
      }
      if (cellW >= 30) parts.push(text(x + cellW / 2, mid + 4, fixed(r[t], 2), { "font-size": size, "text-anchor": "middle", class: r[t] < 0.5 ? "fig-t-num fig-t-strong" : "fig-t-num" }));
    }
    parts.push(text(xY + yW / 2, mid + 4, c.y, { "font-size": size, "text-anchor": "middle", class: "fig-t-num" }));
    parts.push(el("rect", { x: xCheck, y: top + 3, width: checkW, height: rowH - 6, rx: rowH / 2 - 3, fill: c.pass ? C.good : C.bad, "fill-opacity": 0.18 }));
    parts.push(text(xCheck + checkW / 2, mid + 4, c.pass ? L.pass : L.fail, { "font-size": size, "text-anchor": "middle", class: c.pass ? "fig-t-strong" : "fig-t-muted" }));
    const v = m.agg[i];
    if (narrow) {
      parts.push(text(xAgg + aggW, mid + 4, fixed(v, 2), { "font-size": size, "text-anchor": "end", class: i === m.best ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    } else {
      const bw = aggW - 40;
      parts.push(el("rect", { x: xAgg, y: top + 7, width: bw, height: rowH - 14, rx: 2, fill: C.panel }));
      parts.push(el("rect", { x: xAgg, y: top + 7, width: Math.max(1, (v / aggMax) * bw), height: rowH - 14, rx: 2, fill: C.c1 }));
      parts.push(text(xAgg + aggW, mid + 4, fixed(v, 2), { "font-size": size, "text-anchor": "end", class: i === m.best ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    }
    if (i === m.best) parts.push(el("rect", { x: xAgg - 3, y: top - 1, width: aggW + 6, height: rowH + 2, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    parts.push(el("rect", { x: 0, y: top, width: w, height: rowH, fill: "transparent", "data-fig-set": `focus=${i + 1}`, class: "fig-hit" }));
  }
  y += N * (rowH + 2) + 10;

  // Legend.
  const items: Array<[string, (x: number, yy: number) => string]> = [
    [L.invalid, (x, yy) => el("rect", { x, y: yy - 10, width: 16, height: 12, rx: 2, fill: "none", stroke: C.bad, "stroke-width": 2 })],
    [L.score, (x, yy) => el("rect", { x, y: yy - 10, width: 16, height: 12, rx: 2, fill: C.c1, "fill-opacity": 0.5 })],
    [L.picked, (x, yy) => el("rect", { x, y: yy - 10, width: 16, height: 12, rx: 2, fill: "none", stroke: C.ink, "stroke-width": 1.5 })],
  ];
  let lx = 0, ly = y + size;
  for (const [lab, sw] of items) {
    const iw = 22 + mathWidth(lab, size);
    if (lx > 0 && lx + iw > w) { lx = 0; ly += size + 8; }
    parts.push(sw(lx, ly), mathText(lx + 22, ly, lab, { "font-size": size, fill: C.ink2 }));
    lx += iw + 16;
  }
  y = ly + 18;

  // ---- the focused solution, step by step
  const c = m.cands[m.focus];
  const r = m.scores[m.focus];
  for (const ln of wrapText(tpl(L.detail, { i: m.focus + 1, y: c.y, r: c.pass ? 1 : 0 }), TYPE.label, w)) { y += TYPE.label + 4; parts.push(mathText(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 6;
  const eqW = narrow ? 104 : 118;
  const scoreW = narrow ? 88 : 150;
  for (let t = 0; t < T; t++) {
    const s = c.steps[t];
    const { op, k } = OPS[t];
    const lineY = y + size + 4;
    const eq = `${s.input} ${op} ${k} = ${s.claimed}`;
    parts.push(mathText(0, lineY, tpl(L.stepName, { t: t + 1 }), { "font-size": size, class: "fig-t-muted" }));
    parts.push(text(26, lineY, eq, { "font-size": size, class: s.valid ? "fig-t-num" : "fig-t-num fig-t-strong" }));
    if (!s.valid) parts.push(el("rect", { x: 22, y: lineY - size, width: textWidth(eq, size) + 14, height: size + 6, rx: 3, fill: "none", stroke: C.bad, "stroke-width": 1.5 }));
    const note = s.valid ? L.valid : tpl(L.wrong, { a: s.input, op, k, v: apply(s.input, t) });
    const noteX = 26 + eqW;
    const noteW = w - noteX - scoreW - 8;
    parts.push(text(noteX, lineY, wrapText(note, size, noteW)[0], { "font-size": size, class: s.valid ? "fig-t-muted" : "" }));
    const bx = w - scoreW;
    const bw = scoreW - 50;
    parts.push(el("rect", { x: bx, y: lineY - 10, width: bw, height: 11, rx: 2, fill: C.panel }));
    parts.push(el("rect", { x: bx, y: lineY - 10, width: Math.max(1, r[t] * bw), height: 11, rx: 2, fill: C.c1 }));
    parts.push(el("line", { x1: bx + bw / 2, x2: bx + bw / 2, y1: lineY - 13, y2: lineY + 4, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
    parts.push(mathText(w, lineY, `r_${t + 1} ${fixed(r[t], 2)}`, { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
    y = lineY + 8;
  }
  y += 4;
  const lo = firstLow(r);
  const tail = [
    [c.firstError >= 0 ? tpl(L.firstTrue, { t: c.firstError + 1, f: lo >= 0 ? `z_${lo + 1}` : L.none }) : tpl(L.firstNone, { f: lo >= 0 ? `z_${lo + 1}` : L.none }), ""],
    [tpl(L.aggRow, { a: fixed(aggregate(r, "min"), 2), b: fixed(aggregate(r, "product"), 2), c: fixed(aggregate(r, "last"), 2) }), "fig-t-num fig-t-muted"],
  ] as const;
  for (const [s, cls] of tail) for (const ln of wrapText(s, size, w)) { y += size + 5; parts.push(mathText(0, y, ln, { "font-size": size, class: cls || undefined })); }
  y += 14;

  // ---- what each supervision signal sees across the eight solutions
  const sum = [
    m.flawedPassing.length ? tpl(L.sumOutcome, { k: m.passing.length, f: m.flawedPassing.length }) : tpl(L.sumOutcomeNone, { k: m.passing.length }),
    tpl(L.sumProcess, { phrase: phraseOf(p.agg, L), i: m.best + 1, what: what(m.cands[m.best], L) }),
    tpl(L.rates, { r: fixed(p.verr, 2), ...confusion(m) }),
  ];
  sum.forEach((s, k) => {
    for (const ln of wrapText(s, size, w)) { y += size + 5; parts.push(mathText(0, y, ln, { "font-size": size, class: k < 2 ? "fig-t-strong" : "fig-t-muted" })); }
  });
  return svg(w, y + 6, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "process-supervision",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    slip: { kind: "range", label: { en: "Solver slip rate per step", zh: "解题器每步出错率" }, min: 0, max: 0.3, step: 0.01, default: 0.12 },
    jump: { kind: "range", label: { en: "Jump back to the right value after a slip", zh: "出错后跳回正确值的概率" }, min: 0, max: 0.8, step: 0.05, default: 0.3 },
    verr: {
      kind: "range", label: { en: "Step verifier FAR = FRR", zh: "步骤验证器 FAR = FRR" }, min: 0, max: 0.3, step: 0.01, default: 0.08,
      marks: [{ value: 0, label: { en: "exact step check", zh: "精确的步骤检查" } }],
    },
    agg: {
      kind: "choice", label: { en: "Aggregate step scores by", zh: "步骤分数的聚合方式" }, default: "min",
      options: [
        { value: "min", label: { en: "Minimum", zh: "最小值" } },
        { value: "product", label: { en: "Product", zh: "乘积" } },
        { value: "last", label: { en: "Last step", zh: "最后一步" } },
      ],
    },
    focus: {
      kind: "choice", control: "buttons", label: { en: "Solution", zh: "解答" }, default: 0,
      options: [
        { value: 0, label: { en: "auto", zh: "自动" } },
        ...Array.from({ length: N }, (_, i) => ({ value: i + 1, label: { en: `#${i + 1}`, zh: `#${i + 1}` } })),
      ],
    },
    seed: { kind: "range", label: { en: "Sample seed", zh: "采样种子" }, min: 1, max: 999, step: 1, default: 236, control: false },
  },
  render,
  describe,
});
