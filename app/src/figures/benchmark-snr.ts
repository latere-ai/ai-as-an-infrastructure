// Signal and noise of a benchmark paired with a metric, after Heineman et al.
// (2025), on simulated scores. The chapter defines
//
//   SNR = σ_models / σ_step,
//
// with σ_models the standard deviation of the final scores s_m across models
// and σ_step the standard deviation of one run's score over its final
// checkpoints. The figure computes both on one illustrative benchmark scored
// two ways, by accuracy and by per-token loss on the reference answer.
//
// Simulation (illustrative, not the paper's data). Six training runs of
// increasing model size, m = 0..5, answer n four-option items. At checkpoint t
// the model's logits for item i are
//
//   reference answer   z_ref = a_m + s_m + c_i + g_mt + ε_0
//   distractor k       z_k   = a_m + d_ik + g_mt + ε_k,     k = 1..3
//
// where a_m is general fluency (it raises every option, so it moves loss and
// not accuracy), s_m is discrimination (it lifts only the reference answer),
// c_i and d_ik are fixed per item (standard normal), g_mt ~ N(0, 0.02²) is a
// shift shared by every option at one checkpoint, and ε ~ N(0, 0.3²) is fresh
// per option, item and checkpoint. Then
//
//   accuracy        = mean_i 1[z_ref > max_k z_k]
//   per-token loss  = mean_i −ln σ(z_ref)        (nats; σ the logistic function)
//
// Small models have fluency rising with size and almost no discrimination, so
// accuracy stays near chance while loss improves; larger models have both.
// Averaging k adjacent checkpoints replaces each score by the mean of the k
// scores ending at it. s_m is a run's (averaged) final checkpoint, σ_step is
// the sample standard deviation over its last K = 10 (averaged) checkpoints,
// pooled over runs as a root mean square.
//
// Each item draws from its own seeded stream, so n items are a prefix of the
// 2,000-item simulation: moving the item count adds or removes items and never
// redraws the others.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, band, niceStep } from "./lib/scale.ts";
import { axis } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { normalFrom } from "./lib/stats.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- simulation

const RUNS = 6;
const K = 10; // final checkpoints shown per run
const K_AVG = 5; // largest averaging window
const RAW = K + K_AVG - 1; // raw checkpoints simulated per run
const N_MAX = 2000;
const SIGMA_EPS = 0.3;
const SIGMA_SHIFT = 0.02;

type Regime = "small" | "large";
const REGIMES: Record<Regime, { a: (m: number) => number; s: (m: number) => number }> = {
  small: { a: (m) => -2.6 + 0.12 * m, s: (m) => 0.015 * m },
  large: { a: (m) => -1.2 + 0.12 * m, s: (m) => 0.9 + 0.25 * m },
};

// A 32-bit mix of several integers, to seed one stream per item and run.
function mix(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h = Math.imul(h ^ (x >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

interface Sim {
  correct: Uint8Array[]; // [run * RAW + t][item]: 1 if the reference answer wins
  loss: Float64Array[]; // [run * RAW + t][item]: −ln σ(z_ref)
}

const simMemo = new Map<string, Sim>();
function simulate(regime: Regime, seed: number): Sim {
  const key = `${regime}|${seed}`;
  const hit = simMemo.get(key);
  if (hit) return hit;
  const R = REGIMES[regime];
  const correct = Array.from({ length: RUNS * RAW }, () => new Uint8Array(N_MAX));
  const loss = Array.from({ length: RUNS * RAW }, () => new Float64Array(N_MAX));
  // Checkpoint shifts, one stream per run.
  const shift: number[] = [];
  for (let m = 0; m < RUNS; m++) {
    const u = rng(mix(seed, 0xa11, m));
    for (let t = 0; t < RAW; t++) shift.push(SIGMA_SHIFT * normalFrom(u(), u()));
  }
  for (let i = 0; i < N_MAX; i++) {
    const ui = rng(mix(seed, 0x17e, i));
    const c = normalFrom(ui(), ui());
    const d = [normalFrom(ui(), ui()), normalFrom(ui(), ui()), normalFrom(ui(), ui())];
    for (let m = 0; m < RUNS; m++) {
      const u = rng(mix(seed, i, m, 0xc4e));
      const a = R.a(m), s = R.s(m);
      for (let t = 0; t < RAW; t++) {
        const gm = shift[m * RAW + t];
        const zr = a + s + c + gm + SIGMA_EPS * normalFrom(u(), u());
        let best = -Infinity;
        for (let k = 0; k < 3; k++) best = Math.max(best, a + d[k] + gm + SIGMA_EPS * normalFrom(u(), u()));
        correct[m * RAW + t][i] = zr > best ? 1 : 0;
        loss[m * RAW + t][i] = zr > 30 ? Math.exp(-zr) : Math.log1p(Math.exp(-zr));
      }
    }
  }
  const out = { correct, loss };
  if (simMemo.size > 8) simMemo.clear();
  simMemo.set(key, out);
  return out;
}

type Metric = "acc" | "loss";

interface MetricStats {
  series: number[][]; // [run][K]: averaged scores at the last K checkpoints
  final: number[]; // s_m
  sdModels: number;
  sdStep: number;
  snr: number;
  ordered: number; // run pairs whose final scores follow model size
}

function sd(xs: number[]): number {
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1));
}

// Raw per-checkpoint scores of one metric over the first n items.
function raw(sim: Sim, metric: Metric, n: number): number[][] {
  const out: number[][] = [];
  for (let m = 0; m < RUNS; m++) {
    const row: number[] = [];
    for (let t = 0; t < RAW; t++) {
      let sum = 0;
      if (metric === "acc") { const a = sim.correct[m * RAW + t]; for (let i = 0; i < n; i++) sum += a[i]; }
      else { const a = sim.loss[m * RAW + t]; for (let i = 0; i < n; i++) sum += a[i]; }
      row.push(sum / n);
    }
    out.push(row);
  }
  return out;
}

function stats(rawRows: number[][], k: number, metric: Metric): MetricStats {
  const series = rawRows.map((row) => {
    const out: number[] = [];
    for (let t = RAW - K; t < RAW; t++) {
      let s = 0;
      for (let j = 0; j < k; j++) s += row[t - j];
      out.push(s / k);
    }
    return out;
  });
  const final = series.map((r) => r[K - 1]);
  const sdModels = sd(final);
  const sdStep = Math.sqrt(series.reduce((a, r) => a + sd(r) ** 2, 0) / RUNS);
  let ordered = 0;
  for (let i = 0; i < RUNS; i++) {
    for (let j = i + 1; j < RUNS; j++) {
      if (metric === "acc" ? final[j] > final[i] : final[j] < final[i]) ordered++;
    }
  }
  return { series, final, sdModels, sdStep, snr: sdStep > 0 ? sdModels / sdStep : Infinity, ordered };
}

type P = { regime: Regime; items: number; avg: number; seed: number };

const modelMemo = new Map<string, { acc: MetricStats; loss: MetricStats; domain: Record<Metric, [number, number]> }>();
function model(p: P) {
  const n = Math.max(10, Math.min(N_MAX, Math.round(p.items)));
  const k = Math.max(1, Math.min(K_AVG, Math.round(p.avg)));
  const key = `${p.regime}|${n}|${k}|${p.seed}`;
  const hit = modelMemo.get(key);
  if (hit) return { ...hit, n, k };
  const sim = simulate(p.regime, p.seed);
  const out = {
    acc: stats(raw(sim, "acc", n), k, "acc"),
    loss: stats(raw(sim, "loss", n), k, "loss"),
    domain: { acc: domainOf(sim, "acc", p.regime, p.seed), loss: domainOf(sim, "loss", p.regime, p.seed) },
  };
  if (modelMemo.size > 64) modelMemo.clear();
  modelMemo.set(key, out);
  return { ...out, n, k };
}

// The y range of a panel: the envelope of the unaveraged scores at the
// smallest and the largest item count, snapped outward to tick steps, so the
// axis stays put while the reader moves the controls.
const domainMemo = new Map<string, [number, number]>();
function domainOf(sim: Sim, metric: Metric, regime: Regime, seed: number): [number, number] {
  const key = `${metric}|${regime}|${seed}`;
  const hit = domainMemo.get(key);
  if (hit) return hit;
  const vals = [...raw(sim, metric, 50).flat(), ...raw(sim, metric, N_MAX).flat()];
  if (metric === "acc") vals.push(0.25);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06;
  lo -= pad; hi += pad;
  const step = niceStep(hi - lo, 4);
  const out: [number, number] = [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  domainMemo.set(key, out);
  return out;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Signal and noise of a benchmark metric",
    accTitle: "Accuracy (%), higher is better",
    lossTitle: "Per-token loss on the reference answer (nats), lower is better",
    xTitle: "training run, smallest model on the left",
    accName: "accuracy",
    lossName: "per-token loss",
    between: "between runs, σ_models",
    within: "within a run, σ_step",
    snr: "SNR {v}",
    pairs: "run pairs ranked by size",
    pairsV: "{k} of 15",
    pp: "{v} pp",
    nats: "{v}",
    eq: "SNR = σ_models / σ_step",
    note: "s_m is each run's final checkpoint (the larger dot). σ_models is the standard deviation of the six s_m; σ_step is the standard deviation over one run's last 10 checkpoints, pooled over the runs.",
    small: "Small models, accuracy near chance",
    large: "Larger models, accuracy above chance",
    avgNone: "no checkpoint averaging",
    avgK: "{k} adjacent checkpoints averaged",
    legendLine: "checkpoints in training order",
    legendFinal: "final checkpoint, s_m",
    legendChance: "chance accuracy, 1 in 4",
    describe: "{regime}, {n} items, {avg}. Accuracy: σ_models {am}, σ_step {as}, SNR {asnr}, {ap} of 15 run pairs ranked by model size. Per-token loss: σ_models {lm}, σ_step {ls}, SNR {lsnr}, {lp} of 15 pairs ranked.",
  },
  zh: {
    title: "基准指标的信号与噪声",
    accTitle: "准确率（%），越高越好",
    lossTitle: "参考答案的逐词元损失（nat），越低越好",
    xTitle: "训练运行，最左侧模型最小",
    accName: "准确率",
    lossName: "逐词元损失",
    between: "运行之间，σ_models",
    within: "单次运行内，σ_step",
    snr: "SNR {v}",
    pairs: "按模型规模排对的运行对",
    pairsV: "15 对中 {k} 对",
    pp: "{v} 个百分点",
    nats: "{v}",
    eq: "SNR = σ_models / σ_step",
    note: "s_m 是每次运行的最终检查点（较大的点）。σ_models 是六个 s_m 的标准差；σ_step 是单次运行最后 10 个检查点上的标准差，在各运行之间合并。",
    small: "小模型，准确率接近随机水平",
    large: "较大模型，准确率高于随机水平",
    avgNone: "不对检查点取平均",
    avgK: "对相邻 {k} 个检查点取平均",
    legendLine: "按训练顺序连接的检查点",
    legendFinal: "最终检查点 s_m",
    legendChance: "随机猜测的准确率，四选一",
    describe: "{regime}，{n} 个项目，{avg}。准确率：σ_models {am}，σ_step {as}，SNR {asnr}，15 对运行中有 {ap} 对按模型规模排对。逐词元损失：σ_models {lm}，σ_step {ls}，SNR {lsnr}，{lp} 对排对。",
  },
};
type L = typeof labels.en;

// ---------------------------------------------------------------- render

type Model = ReturnType<typeof model>;
const COLOR: Record<Metric, string> = { acc: C.c1, loss: C.c2 };

function lines(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w);
}

const fmtSd = (metric: Metric, v: number, Lx: L) => (metric === "acc" ? tpl(Lx.pp, { v: fixed(v * 100, 1) }) : tpl(Lx.nats, { v: fixed(v, 3) }));
const fmtSnr = (v: number) => (!Number.isFinite(v) ? "∞" : v >= 100 ? int(v) : fixed(v, 1));

// The legend row: a sparkline swatch, the final-checkpoint dot, and the chance line.
function renderLegend(x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const size = TYPE.body;
  const items: Array<{ w: number; draw: (x: number, y: number) => string }> = [
    {
      w: 30 + textWidth(Lx.legendLine, size),
      draw: (x, y) => el("path", { d: linePath([[x, y - 3], [x + 8, y - 7], [x + 16, y - 2], [x + 22, y - 5]]), fill: "none", stroke: C.ink2, "stroke-width": 1.3 })
        + [[x, y - 3], [x + 8, y - 7], [x + 16, y - 2]].map(([cx, cy]) => el("circle", { cx, cy, r: 2, fill: C.ink2 })).join("")
        + el("circle", { cx: x + 22, cy: y - 5, r: 4, fill: C.ink2, stroke: C.paper, "stroke-width": 1.5 })
        + text(x + 30, y, Lx.legendLine, { "font-size": size, class: "fig-t-muted" }),
    },
    {
      w: 16 + textWidth(Lx.legendFinal, size),
      draw: (x, y) => el("circle", { cx: x + 5, cy: y - 4, r: 4.5, fill: C.ink2, stroke: C.paper, "stroke-width": 1.5 })
        + text(x + 16, y, Lx.legendFinal, { "font-size": size, class: "fig-t-muted" }),
    },
    {
      w: 28 + textWidth(Lx.legendChance, size),
      draw: (x, y) => el("line", { x1: x, x2: x + 20, y1: y - 4, y2: y - 4, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" })
        + text(x + 28, y, Lx.legendChance, { "font-size": size, class: "fig-t-muted" }),
    },
  ];
  const parts: string[] = [];
  let x = x0, row = 0;
  for (const it of items) {
    if (x > x0 && x + it.w > x0 + w) { row++; x = x0; }
    parts.push(it.draw(x, y0 + 14 + row * 20));
    x += it.w + 18;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: 20 + row * 20 };
}

// One metric: the title, a column per run with its checkpoint sparkline, and
// the axes. titleLines is shared by both panels so their plots line up.
function renderPanel(m: Model, metric: Metric, x0: number, y0: number, w: number, titleLines: number, narrow: boolean, Lx: L, lang: Lang): { svg: string; h: number } {
  const st = m[metric];
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(metric === "acc" ? Lx.accTitle : Lx.lossTitle, TYPE.label, w, lang)) {
    y += 17;
    parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
  }
  y = y0 + titleLines * 17 + 16;
  const left = x0 + 34;
  const right = x0 + w;
  const ph = narrow ? 170 : 196;
  const top = y, bottom = y + ph;
  const ys = linear(m.domain[metric], [bottom, top]);
  const ticks = ys.ticks(4);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const fmt = metric === "acc" ? (v: number) => String(Math.round(v * 100)) : (v: number) => fixed(v, step < 0.1 ? 2 : 1);
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks, grid: [left, right], format: fmt, size: TYPE.body }));
  if (metric === "acc") {
    const cy = ys(0.25);
    parts.push(el("line", { x1: left, x2: right, y1: cy, y2: cy, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  }
  const cols = band(RUNS, [left + 8, right - 2], narrow ? 6 : 10);
  for (let r = 0; r < RUNS; r++) {
    const cx0 = cols.at(r) + 3, cx1 = cols.at(r) + cols.size - 5;
    const pts: Array<[number, number]> = st.series[r].map((v, t) => [cx0 + ((cx1 - cx0) * t) / (K - 1), ys(ys.clamp(v))]);
    parts.push(el("rect", { x: cols.at(r), y: top, width: cols.size, height: ph, fill: C.panel, "fill-opacity": 0.5 }));
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: COLOR[metric], "stroke-width": 1.3, "stroke-linejoin": "round" }));
    for (const [px, py] of pts.slice(0, -1)) parts.push(el("circle", { cx: px, cy: py, r: 2, fill: COLOR[metric] }));
    const [fx, fy] = pts[pts.length - 1];
    parts.push(el("circle", { cx: fx, cy: fy, r: 4.5, fill: COLOR[metric], stroke: C.paper, "stroke-width": 1.5 }));
    parts.push(text(cols.at(r) + cols.size / 2, bottom + 18, r + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(el("line", { x1: left, x2: right, y1: bottom, y2: bottom, stroke: C.rule, "stroke-width": 1 }));
  y = bottom + 18;
  for (const ln of lines(Lx.xTitle, TYPE.body, w - 34, lang)) {
    y += 17;
    parts.push(text((left + right) / 2, y, ln, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  }
  return { svg: g({ class: "fig-panel" }, ...parts), h: y - y0 + 4 };
}

// The two spreads of one metric as bars in its own units, the ratio, and how
// many of the 15 run pairs the final scores put in model-size order.
function renderReadout(m: Model, metric: Metric, x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const st = m[metric];
  const parts: string[] = [];
  let y = y0 + 16;
  parts.push(text(x0, y, metric === "acc" ? Lx.accName : Lx.lossName, { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(text(x0 + w, y, tpl(Lx.snr, { v: fmtSnr(st.snr) }), { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
  y += 8;
  const labelW = Math.max(textWidth(Lx.between, TYPE.body), textWidth(Lx.within, TYPE.body)) + 10;
  const valW = Math.max(textWidth(fmtSd(metric, 0.123, Lx), TYPE.body), textWidth(fmtSd(metric, st.sdModels, Lx), TYPE.body)) + 8;
  const barX = x0 + labelW;
  const barW = Math.max(30, w - labelW - valW);
  const top = Math.max(st.sdModels, st.sdStep) || 1;
  for (const [name, v, op] of [[Lx.between, st.sdModels, 1], [Lx.within, st.sdStep, 0.45]] as const) {
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, y + 15, name, { "font-size": TYPE.body }));
    parts.push(el("rect", { x: barX, y: y + 5, width: barW, height: 12, rx: 3, fill: C.panel }));
    parts.push(el("rect", { x: barX, y: y + 5, width: Math.max(1.5, (v / top) * barW), height: 12, rx: 3, fill: COLOR[metric], "fill-opacity": op }));
    parts.push(text(x0 + w, y + 15, fmtSd(metric, v, Lx), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += 22;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  parts.push(text(x0, y + 15, Lx.pairs, { "font-size": TYPE.body }));
  parts.push(text(x0 + w, y + 15, tpl(Lx.pairsV, { k: st.ordered }), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
  y += 22;
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 2 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, {
    regime: st.p.regime === "small" ? Lx.small : Lx.large, n: int(m.n),
    avg: m.k === 1 ? Lx.avgNone : tpl(Lx.avgK, { k: m.k }),
    am: fmtSd("acc", m.acc.sdModels, Lx), as: fmtSd("acc", m.acc.sdStep, Lx), asnr: fmtSnr(m.acc.snr), ap: m.acc.ordered,
    lm: fmtSd("loss", m.loss.sdModels, Lx), ls: fmtSd("loss", m.loss.sdStep, Lx), lsnr: fmtSnr(m.loss.snr), lp: m.loss.ordered,
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  const lg = renderLegend(0, 0, w, Lx);
  parts.push(lg.svg);
  let y = lg.h + 10;
  if (narrow) {
    for (const metric of ["acc", "loss"] as const) {
      const tl = lines(metric === "acc" ? Lx.accTitle : Lx.lossTitle, TYPE.label, w, lang).length;
      const pn = renderPanel(m, metric, 0, y, w, tl, true, Lx, lang);
      parts.push(pn.svg); y += pn.h + 6;
      const ro = renderReadout(m, metric, 0, y, w, Lx);
      parts.push(ro.svg); y += ro.h + 18;
    }
  } else {
    const gap = 28;
    const pw = (w - gap) / 2;
    const tl = Math.max(...[Lx.accTitle, Lx.lossTitle].map((s) => lines(s, TYPE.label, pw, lang).length));
    let h = 0;
    (["acc", "loss"] as const).forEach((metric, k) => {
      const x0 = k * (pw + gap);
      const pn = renderPanel(m, metric, x0, y, pw, tl, false, Lx, lang);
      const ro = renderReadout(m, metric, x0, y + pn.h + 6, pw, Lx);
      parts.push(pn.svg, ro.svg);
      h = Math.max(h, pn.h + 6 + ro.h);
    });
    y += h + 18;
  }
  parts.push(text(0, y, Lx.eq, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 4;
  for (const ln of lines(Lx.note, TYPE.body, w, lang)) {
    y += 17;
    parts.push(text(0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" }));
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "benchmark-snr",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    regime: {
      kind: "choice", label: { en: "Models compared", zh: "参与比较的模型" }, default: "small",
      options: [
        { value: "small", label: { en: "Small, near chance", zh: "小模型，接近随机水平" } },
        { value: "large", label: { en: "Larger, above chance", zh: "较大模型，高于随机水平" } },
      ],
    },
    items: {
      kind: "range", scale: "log", label: { en: "Items in the benchmark", zh: "基准中的项目数" }, min: 50, max: 2000, default: 500,
    },
    avg: {
      kind: "range", label: { en: "Adjacent checkpoints averaged", zh: "取平均的相邻检查点数" }, min: 1, max: 5, step: 1, default: 1,
      marks: [{ value: 1, label: { en: "none", zh: "不平均" } }],
    },
    seed: { kind: "range", label: { en: "Simulation seed", zh: "模拟种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
