// How rejection sampling and the row policy reshape a corpus's difficulty mix.
//
// The prompt pool is 40 prompts whose one-sample pass rates p_x have normal
// log-odds (median p, standard deviation `spread`), taken at the 40 quantiles
// so the pool is deterministic. The pipeline draws K independent samples per
// prompt and keeps those that pass, so the number of accepted traces for a
// prompt is K_x ~ Bin(K, p_x). Two ways of turning accepted traces into
// training weight, both from the chapter:
//
// - Every accepted trace is a row. A prompt's expected weight is
//   E[K_x] = K p_x, so its expected share is p_x / Σ p: K cancels, and the
//   mix is the same as drawing one sample per prompt.
// - Equal weight per prompt (one trace per prompt, or weight 1/K_x per
//   trace). A prompt carries weight 1 if any sample passes, with probability
//   1 − (1 − p_x)^K, so its expected share tends to the pool's as K grows.
//
// Shares are shares of expected weight, summed over five pass-rate bands.
// Every number is computed from these definitions; the pool is synthetic.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, pct, tpl } from "./lib/format.ts";
import { logitNormalQuantiles } from "./lib/stats.ts";

// ---------------------------------------------------------------- model

const N = 40;
const EDGES = [0, 0.01, 0.1, 0.5, 0.9, 1];
const BANDS = ["< 1%", "1–10%", "10–50%", "50–90%", "≥ 90%"];

interface Model {
  pool: number[]; // prompts per band (shares)
  prompt: number[]; // expected share under equal weight per prompt
  row: number[]; // expected share when every accepted trace is a row
  missing: number; // expected prompts with no accepted trace
  rows: number; // expected accepted traces
}

const bandOf = (p: number) => {
  for (let i = 0; i < BANDS.length; i++) if (p < EDGES[i + 1]) return i;
  return BANDS.length - 1;
};

function model(p: P): Model {
  const K = Math.round(p.K);
  const ps = logitNormalQuantiles(p.median, p.spread, N);
  const pool = new Array(BANDS.length).fill(0), prompt = new Array(BANDS.length).fill(0), row = new Array(BANDS.length).fill(0);
  let missing = 0, rows = 0;
  for (const x of ps) {
    const b = bandOf(x);
    const none = (1 - x) ** K;
    pool[b] += 1;
    prompt[b] += 1 - none;
    row[b] += K * x;
    missing += none;
    rows += K * x;
  }
  const norm = (a: number[]) => { const s = a.reduce((u, v) => u + v, 0); return a.map((v) => (s > 0 ? v / s : 0)); };
  return { pool: norm(pool), prompt: norm(prompt), row: norm(row), missing, rows };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Difficulty mix of a pool and of the corpus built from it",
    pool: "prompt pool",
    prompt: "equal weight per prompt",
    row: "every passing trace a row",
    y: "share of expected training weight",
    x: "one-sample pass rate p_x of the prompt",
    missing: "Expected prompts with no accepted trace: {m} of 40; they enter neither corpus.",
    rows: "Expected accepted traces: {r} from {n} samples.",
    hard: "Prompts with p_x < 10%: {a} of the pool, {b} with equal weight per prompt, {c} with every trace a row.",
    cancel: "A prompt yields K p_x rows on average, so K cancels from the row shares: at any K they match drawing one sample per prompt.",
    describe: "With K = {K} samples per prompt from a pool with median pass rate {med}, prompts below a 10% pass rate make up {a} of the pool, {b} of the corpus with equal weight per prompt, and {c} when every passing trace is a row; {m} of 40 prompts are expected to contribute nothing.",
  },
  zh: {
    title: "提示池与由它生成的语料库的难度构成",
    pool: "提示池",
    prompt: "每个提示同等权重",
    row: "每条通过的轨迹各占一行",
    y: "期望训练权重的占比",
    x: "提示的单次采样通过率 p_x",
    missing: "预计没有任何轨迹通过的提示：40 个中有 {m} 个，两种语料库都不含它们。",
    rows: "预计通过的轨迹：{n} 次采样中有 {r} 条。",
    hard: "p_x < 10% 的提示：在提示池中占 {a}，每个提示同等权重时占 {b}，每条轨迹各占一行时占 {c}。",
    cancel: "一个提示平均产生 K p_x 行，K 在按行计算的占比中约掉：无论 K 取多少，结果都与每个提示只采样一次相同。",
    describe: "每个提示采样 K = {K} 次，提示池的通过率中位数为 {med}。通过率低于 10% 的提示在提示池中占 {a}，每个提示同等权重时在语料库中占 {b}，每条通过的轨迹各占一行时占 {c}；预计 40 个提示中有 {m} 个没有任何贡献。",
  },
};
type L = typeof labels.en;

type P = { K: number; median: number; spread: number };

const share = (v: number) => pct(v, 0);
const hardShare = (a: number[]) => a[0] + a[1];

// ---------------------------------------------------------------- drawing

function sub(x: number, y: number, s: string, size: number, cls: string, anchor = "start"): string {
  // "p_x" with a subscript x.
  const parts = s.split("p_x");
  let inner = "";
  parts.forEach((piece, i) => {
    if (i > 0) inner += `p<tspan dy="${Math.round(size * 0.3)}" font-size="${Math.round(size * 0.75)}">x</tspan><tspan dy="${-Math.round(size * 0.3)}">${piece.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`;
    else inner += piece.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  });
  return el("text", { x, y, "font-size": size, class: cls, "text-anchor": anchor }, inner);
}

function renderLegend(w: number, Lx: L): { svg: string; h: number } {
  const items: Array<[string, string, number]> = [[Lx.pool, C.ink3, 0.7], [Lx.prompt, C.c1, 1], [Lx.row, C.c2, 1]];
  const parts: string[] = [];
  let x = 0, y = 13;
  for (const [label, color, op] of items) {
    const iw = 18 + textWidth(label, TYPE.body);
    if (x > 0 && x + iw > w) { x = 0; y += 20; }
    parts.push(el("rect", { x, y: y - 10, width: 12, height: 11, rx: 1, fill: color, "fill-opacity": op }));
    parts.push(text(x + 18, y, label, { "font-size": TYPE.body }));
    x += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: y + 8 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  const lg = renderLegend(w, Lx);
  parts.push(lg.svg);

  const left = narrow ? 40 : 46;
  const right = w - 4;
  const top = lg.h + 34;
  const plotH = narrow ? 170 : 200;
  const bottom = top + plotH;
  let ymax = 0;
  for (const a of [m.pool, m.prompt, m.row]) for (const v of a) ymax = Math.max(ymax, v);
  const y = linear([0, Math.max(0.2, Math.ceil(ymax * 10) / 10)], [bottom, top]);
  parts.push(text(0, top - 14, Lx.y, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: y.ticks(4), grid: [left, right], size: TYPE.body, format: (v) => pct(v, 0) }));
  const groups = band(BANDS.length, [left + 6, right - 2], narrow ? 10 : 18);
  const barGap = 2;
  const bw = (groups.size - 2 * barGap) / 3;
  const series: Array<[number[], string, number]> = [[m.pool, C.ink3, 0.7], [m.prompt, C.c1, 1], [m.row, C.c2, 1]];
  for (let i = 0; i < BANDS.length; i++) {
    const gx = groups.at(i);
    series.forEach(([a, color, op], s) => {
      const x = gx + s * (bw + barGap);
      const top0 = y(a[i]);
      if (bottom - top0 > 0.3) parts.push(el("rect", { x, y: top0, width: bw, height: bottom - top0, fill: color, "fill-opacity": op }));
      // Values over the bars where a bar is wide enough to carry one.
      if (!narrow) parts.push(text(x + bw / 2, top0 - 4, share(a[i]), { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
    });
    parts.push(text(gx + groups.size / 2, bottom + 17, BANDS[i], { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(el("line", { x1: left, x2: right, y1: bottom, y2: bottom, stroke: C.rule, "stroke-width": 1 }));
  parts.push(sub((left + right) / 2, bottom + 36, Lx.x, TYPE.body, "fig-t-muted", "middle"));

  // ---- readout
  let yy = bottom + 48;
  const K = Math.round(p.K);
  const lines: Array<[string, string]> = [
    [tpl(Lx.hard, { a: share(hardShare(m.pool)), b: share(hardShare(m.prompt)), c: share(hardShare(m.row)) }), "fig-t-strong fig-t-num"],
    [tpl(Lx.missing, { m: fixed(m.missing, 1) }), "fig-t-num"],
    [tpl(Lx.rows, { r: fixed(m.rows, 1), n: N * K }), "fig-t-num"],
    [Lx.cancel, "fig-t-muted"],
  ];
  const ro: string[] = [];
  for (const [ln, cls] of lines) {
    // Bold runs are about 8% wider than the regular widths wrap() measures.
    for (const part of wrap(ln, TYPE.body, cls.includes("strong") ? w * 0.9 : w - 13)) { yy += 17; ro.push(sub(0, yy, part, TYPE.body, cls)); }
    yy += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, yy + 4, describe(st, lang), ...parts);
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, {
    K: Math.round(st.p.K), med: pct(st.p.median, 0),
    a: share(hardShare(m.pool)), b: share(hardShare(m.prompt)), c: share(hardShare(m.row)), m: fixed(m.missing, 1),
  });
}

export default defineFigure({
  name: "acceptance-weighting",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    K: {
      kind: "range", scale: "log", label: { en: "Samples per prompt K", zh: "每个提示的采样数 K" }, min: 1, max: 256, default: 8,
    },
    median: {
      kind: "range", scale: "log", label: { en: "Median pass rate of the pool", zh: "提示池通过率的中位数" }, min: 0.02, max: 0.8, default: 0.2,
    },
    spread: {
      kind: "range", label: { en: "Spread of difficulty (s.d. of log-odds)", zh: "难度离散度（对数几率的标准差）" }, min: 0, max: 3, step: 0.25, default: 2,
    },
  },
  render,
  describe,
});
