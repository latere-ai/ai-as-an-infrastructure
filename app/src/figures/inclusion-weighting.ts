// A pass rate estimated from a sample whose inclusion depends on the model's
// confidence, with and without the inclusion probabilities the data engine
// records. The data-engine chapter's Horvitz-Thompson estimate
//
//   μ̂_HT = (1/N) Σ_{i∈s} y_i / π_i
//
// is set against the unweighted sample pass rate, the "raw pass rate" the
// chapter says cannot describe the served population, and against the ratio
// form Σ(y_i/π_i) / Σ(1/π_i) that the reliability chapter uses (the Hájek
// estimator).
//
// The population is illustrative: N = 2,000 eligible events whose model
// confidences are the quantiles of a logit-normal distribution (median 0.8,
// log-odds spread 1.3), each passing the rubric with probability equal to its
// confidence (a calibrated model), drawn once from a fixed seed; μ is the
// pass rate of all 2,000. The design includes an event with probability
// π_low below the confidence threshold τ and π_high at or above it, by
// independent (Poisson) sampling. The same design is drawn 400 times from
// fixed seeds, so the spread of each estimator is its sampling distribution,
// and every control moves the same draws.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { logitNormalQuantiles } from "./lib/stats.ts";
import { rng } from "./lib/random.ts";
import { int, pct, sig, tpl } from "./lib/format.ts";

const N = 2000;
const DRAWS = 400;
const BINS = 20;

// ---------------------------------------------------------------- population and draws

const CONF = logitNormalQuantiles(0.8, 1.3, N);
const PASS: Uint8Array = (() => {
  const u = rng(11);
  const y = new Uint8Array(N);
  for (let i = 0; i < N; i++) y[i] = u() < CONF[i] ? 1 : 0;
  return y;
})();
const MU = PASS.reduce((a, b) => a + b, 0) / N;

// One uniform per event per draw, shared by every parameter setting.
const UNIF: Float32Array[] = Array.from({ length: DRAWS }, (_, r) => {
  const u = rng(1000 + r);
  const a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = u();
  return a;
});

type P = { design: string; tau: number; piLow: number; piHigh: number; draw: number };

interface Draw { nL: number; kL: number; nH: number; kH: number; naive: number; ht: number; ratio: number }
interface Result { NL: number; PL: number; NH: number; PH: number; draws: Draw[] }

const memo = new Map<string, Result>();
export function simulate(p: P): Result {
  const key = `${p.tau}|${p.piLow}|${p.piHigh}`;
  let hit = memo.get(key);
  if (hit) return hit;
  let NL = 0, PL = 0;
  const low = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (CONF[i] < p.tau) { low[i] = 1; NL++; PL += PASS[i]; }
  const draws: Draw[] = [];
  for (let r = 0; r < DRAWS; r++) {
    const u = UNIF[r];
    let nL = 0, kL = 0, nH = 0, kH = 0;
    for (let i = 0; i < N; i++) {
      if (low[i]) { if (u[i] < p.piLow) { nL++; kL += PASS[i]; } }
      else if (u[i] < p.piHigh) { nH++; kH += PASS[i]; }
    }
    const n = nL + nH;
    const wSum = nL / p.piLow + nH / p.piHigh;
    const yw = kL / p.piLow + kH / p.piHigh;
    draws.push({ nL, kL, nH, kH, naive: n ? (kL + kH) / n : NaN, ht: yw / N, ratio: wSum ? yw / wSum : NaN });
  }
  hit = { NL, PL, NH: N - NL, PH: MU * N - PL, draws };
  if (memo.size > 64) memo.clear();
  memo.set(key, hit);
  return hit;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Inclusion probabilities and the pass-rate estimate",
    conf: "Eligible events by model confidence, and the chance each is labeled",
    pass: "passes the rubric",
    fail: "fails",
    tau: "τ = {t}",
    piL: "π = {p}",
    piH: "π = {p}",
    mosaic: "Composition: width is the share of events, filled height the pass rate",
    rowPop: "all {n} eligible events: pass rate μ = {m}",
    rowSample: "the labeled sample, {n} events: raw pass rate {m}",
    rowWeighted: "the same sample, each event weighted by 1/π: {m}",
    below: "below τ",
    above: "at or above τ",
    spread: "The same design drawn {d} times: middle 90% of draws, mean, and draw {k}",
    x: "estimated pass rate",
    naive: "raw pass rate",
    ht: "Horvitz-Thompson",
    ratio: "ratio form",
    truth: "μ = {m}",
    stat: "mean {m}, 90% of draws {a} to {b}",
    eqNaive: "raw = ({kL} + {kH}) / ({nL} + {nH}) = {v}",
    eqHt: "μ̂_HT = (1/N)(k_low/π_low + k_high/π_high) = ({kL}/{pL} + {kH}/{pH}) / {N} = {v}",
    eqRatio: "ratio = ({kL}/{pL} + {kH}/{pH}) / ({nL}/{pL} + {nH}/{pH}) = {v}",
    drawNote: "draw {k}: {nL} of {NL} events below τ and {nH} of {NH} at or above τ are labeled",
    describe: "With τ = {t}, π = {pl} below τ and {ph} above, the raw pass rate of the labeled sample averages {nv} over {d} draws, the Horvitz-Thompson estimate {ht}, and the ratio form {rt}, against a population pass rate of {mu}.",
  },
  zh: {
    title: "纳入概率与通过率估计",
    conf: "按模型置信度排列的合格事件，以及每个事件被标注的概率",
    pass: "符合评分量规",
    fail: "不符合",
    tau: "τ = {t}",
    piL: "π = {p}",
    piH: "π = {p}",
    mosaic: "构成：宽度是事件占比，填充高度是通过率",
    rowPop: "全部 {n} 个合格事件：通过率 μ = {m}",
    rowSample: "已标注样本，共 {n} 个事件：原始通过率 {m}",
    rowWeighted: "同一样本，每个事件按 1/π 加权：{m}",
    below: "低于 τ",
    above: "不低于 τ",
    spread: "同一抽样设计抽取 {d} 次：中间 90% 的结果、均值，以及第 {k} 次抽样",
    x: "通过率估计值",
    naive: "原始通过率",
    ht: "Horvitz-Thompson",
    ratio: "比值形式",
    truth: "μ = {m}",
    stat: "均值 {m}，90% 的抽样落在 {a} 到 {b}",
    eqNaive: "原始通过率 = ({kL} + {kH}) / ({nL} + {nH}) = {v}",
    eqHt: "μ̂_HT = (1/N)(k_low/π_low + k_high/π_high) = ({kL}/{pL} + {kH}/{pH}) / {N} = {v}",
    eqRatio: "比值形式 = ({kL}/{pL} + {kH}/{pH}) / ({nL}/{pL} + {nH}/{pH}) = {v}",
    drawNote: "第 {k} 次抽样：低于 τ 的 {NL} 个事件中标注了 {nL} 个，不低于 τ 的 {NH} 个事件中标注了 {nH} 个",
    describe: "τ = {t}，低于 τ 时 π = {pl}，不低于 τ 时 π = {ph}：{d} 次抽样中，已标注样本的原始通过率平均为 {nv}，Horvitz-Thompson 估计平均为 {ht}，比值形式平均为 {rt}，总体通过率为 {mu}。",
  },
};

type Lbl = typeof labels.en;
const f3 = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "–");
const fp = (v: number) => sig(v, 2);
const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
function quantile(v: number[], q: number): number {
  const s = [...v].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = simulate(p);
  const ok = (k: keyof Draw) => r.draws.map((d) => d[k]).filter(Number.isFinite);
  return tpl(L.describe, {
    t: sig(p.tau, 2), pl: fp(p.piLow), ph: fp(p.piHigh), d: DRAWS,
    nv: f3(mean(ok("naive"))), ht: f3(mean(ok("ht"))), rt: f3(mean(ok("ratio"))), mu: f3(MU),
  });
}

// One composition bar: two segments whose widths are the given shares and
// whose filled heights are the pass rates.
function mosaic(x0: number, y0: number, w: number, h: number, parts: Array<{ share: number; rate: number }>): string {
  const out: string[] = [];
  let x = x0;
  parts.forEach((pt, i) => {
    const sw = pt.share * w;
    if (sw <= 0) return;
    const gap = i > 0 ? 1.5 : 0;
    out.push(el("rect", { x: x + gap, y: y0, width: Math.max(0, sw - gap), height: h, fill: C.c2, "fill-opacity": 0.35 }));
    const ph = Math.max(0, Math.min(1, pt.rate)) * h;
    out.push(el("rect", { x: x + gap, y: y0 + h - ph, width: Math.max(0, sw - gap), height: ph, fill: C.c1 }));
    x += sw;
  });
  return out.join("");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const r = simulate(p);
  const k = Math.min(DRAWS, Math.max(1, Math.round(p.draw)));
  const d = r.draws[k - 1];
  const parts: string[] = [];
  let y = 0;
  const heading = (s: string) => { for (const ln of lines(s, TYPE.label, w - 4, lang)) { parts.push(text(0, y + 14, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 19; } };

  // ---- confidence histogram with the design's inclusion probability
  heading(L.conf);
  const lg = legend([
    { label: L.pass, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.fail, swatch: { kind: "rect", fill: C.c2, opacity: 0.35 } },
  ], 0, y + 2, w, size);
  parts.push(lg.svg);
  y += lg.height + 40;
  const left = 4, right = w - 4;
  const x = linear([0, 1], [left, right]);
  const counts = Array.from({ length: BINS }, () => ({ n: 0, k: 0 }));
  for (let i = 0; i < N; i++) { const b = Math.min(BINS - 1, Math.floor(CONF[i] * BINS)); counts[b].n++; counts[b].k += PASS[i]; }
  const maxN = Math.max(...counts.map((c) => c.n));
  const hH = narrow ? 70 : 80;
  const base = y + hH;
  const bw = (right - left) / BINS;
  counts.forEach((c, b) => {
    const bh = (c.n / maxN) * hH, kh = (c.k / maxN) * hH;
    parts.push(el("rect", { x: left + b * bw + 0.75, y: base - bh, width: bw - 1.5, height: bh, fill: C.c2, "fill-opacity": 0.35 }));
    parts.push(el("rect", { x: left + b * bw + 0.75, y: base - kh, width: bw - 1.5, height: kh, fill: C.c1 }));
  });
  parts.push(axis({ scale: x, orient: "bottom", at: base, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], title: undefined, format: (v) => String(v), size }));
  const tx = x(p.tau);
  parts.push(el("line", { x1: tx, x2: tx, y1: y - 18, y2: base + 4, stroke: C.ink, "stroke-width": 1.5 }));
  const tl = tpl(L.tau, { t: sig(p.tau, 2) });
  const tlw = textWidth(tl, size);
  parts.push(text(Math.min(Math.max(tx, left + tlw / 2), right - tlw / 2), y - 22, tl, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  const pl = tpl(L.piL, { p: fp(p.piLow) }), ph = tpl(L.piH, { p: fp(p.piHigh) });
  // The inclusion probability on each side of τ, kept inside the plot.
  const plx = Math.max(tx - 8, left + textWidth(pl, size)), phx = Math.min(tx + 8, right - textWidth(ph, size));
  parts.push(text(plx, y + 2, pl, { "font-size": size, "text-anchor": "end", class: "fig-t-halo fig-t-num" }));
  parts.push(text(phx, y + 2, ph, { "font-size": size, "text-anchor": "start", class: "fig-t-halo fig-t-num" }));
  y = base + axisHeight(false, size) + 14;

  // ---- composition bars
  heading(L.mosaic);
  y += 4;
  const barH = narrow ? 26 : 30;
  const n = d.nL + d.nH;
  const wL = d.nL / p.piLow, wH = d.nH / p.piHigh;
  const rows: Array<{ label: string; parts: Array<{ share: number; rate: number }> }> = [
    { label: tpl(L.rowPop, { n: int(N), m: f3(MU) }), parts: [{ share: r.NL / N, rate: r.NL ? r.PL / r.NL : 0 }, { share: r.NH / N, rate: r.NH ? r.PH / r.NH : 0 }] },
    { label: tpl(L.rowSample, { n: int(n), m: f3(d.naive) }), parts: [{ share: n ? d.nL / n : 0, rate: d.nL ? d.kL / d.nL : 0 }, { share: n ? d.nH / n : 0, rate: d.nH ? d.kH / d.nH : 0 }] },
    { label: tpl(L.rowWeighted, { m: f3(d.ratio) }), parts: [{ share: wL / (wL + wH || 1), rate: d.nL ? d.kL / d.nL : 0 }, { share: wH / (wL + wH || 1), rate: d.nH ? d.kH / d.nH : 0 }] },
  ];
  rows.forEach((row, i) => {
    for (const ln of lines(row.label, size, w, lang)) { parts.push(text(0, y + 13, ln, { "font-size": size, class: i === 0 ? "fig-t-strong" : undefined })); y += 16; }
    y += 3;
    parts.push(mosaic(left, y, right - left, barH, row.parts));
    // Name the two segments on the population bar.
    if (i === 0) {
      const sL = row.parts[0].share * (right - left);
      if (sL > textWidth(L.below, size) + 12) parts.push(text(left + 6, y + barH / 2 + 4, L.below, { "font-size": size, class: "fig-t-halo" }));
      if ((right - left) - sL > textWidth(L.above, size) + 12) parts.push(text(right - 6, y + barH / 2 + 4, L.above, { "font-size": size, "text-anchor": "end", class: "fig-t-halo" }));
    }
    y += barH + 12;
  });

  // ---- sampling distributions
  y += 4;
  heading(tpl(L.spread, { d: DRAWS, k }));
  const est: Array<{ key: "naive" | "ht" | "ratio"; name: string; col: string }> = [
    { key: "naive", name: L.naive, col: C.c2 },
    { key: "ht", name: L.ht, col: C.c1 },
    { key: "ratio", name: L.ratio, col: C.c3 },
  ];
  const stats = est.map((e) => {
    const v = r.draws.map((q) => q[e.key]).filter(Number.isFinite);
    return { ...e, m: mean(v), a: quantile(v, 0.05), b: quantile(v, 0.95), cur: d[e.key] };
  });
  const lo = Math.min(MU, ...stats.map((s) => s.a)), hi = Math.max(MU, ...stats.map((s) => s.b));
  const pad = (hi - lo) * 0.08 + 0.01;
  const xs = linear([Math.max(0, lo - pad), Math.min(1.5, hi + pad)], [left + 4, right - 4]);
  const nameW = narrow ? 0 : Math.max(...est.map((e) => textWidth(e.name, size))) + 16;
  const sx = linear(xs.domain as [number, number], [left + nameW + 4, right - 4]);
  y += 32;
  const top = y;
  const rowGap = narrow ? 44 : 34;
  stats.forEach((s, i) => {
    const ry = top + i * rowGap + (narrow ? 16 : 0);
    if (narrow) parts.push(text(left, ry - 11, s.name, { "font-size": size }));
    else parts.push(text(left, ry + 4, s.name, { "font-size": size }));
    parts.push(el("rect", { x: sx(s.a), y: ry - 6, width: Math.max(2, sx(s.b) - sx(s.a)), height: 12, rx: 3, fill: s.col, "fill-opacity": 0.3 }));
    parts.push(el("line", { x1: sx(s.m), x2: sx(s.m), y1: ry - 8, y2: ry + 8, stroke: s.col, "stroke-width": 2.5 }));
    if (Number.isFinite(s.cur)) parts.push(el("circle", { cx: sx(Math.min(sx.domain[1], Math.max(sx.domain[0], s.cur))), cy: ry, r: 4, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  });
  const bottom = top + (stats.length - 1) * rowGap + (narrow ? 16 : 0) + 14;
  const mx = sx(MU);
  parts.push(el("line", { x1: mx, x2: mx, y1: top - 16, y2: bottom, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  parts.push(text(mx, top - 20, tpl(L.truth, { m: f3(MU) }), { "font-size": size, "text-anchor": "middle", class: "fig-t-strong fig-t-num fig-t-halo" }));
  parts.push(axis({ scale: sx, orient: "bottom", at: bottom, ticks: sx.ticks(narrow ? 4 : 6), title: L.x, format: (v) => sig(v, 3), size }));
  y = bottom + axisHeight(true, size) + 14;
  stats.forEach((s) => {
    for (const ln of lines(`${s.name}: ${tpl(L.stat, { m: f3(s.m), a: f3(s.a), b: f3(s.b) })}`, size, w - 4, lang)) { parts.push(text(left, y + 13, ln, { "font-size": size, class: "fig-t-num" })); y += 16; }
    y += 2;
  });
  y += 6;

  // ---- the current draw, term by term
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 6;
  const vals = { kL: d.kL, kH: d.kH, nL: d.nL, nH: d.nH, pL: fp(p.piLow), pH: fp(p.piHigh), N: int(N) };
  const eqs = [
    tpl(L.drawNote, { k, nL: int(d.nL), NL: int(r.NL), nH: int(d.nH), NH: int(r.NH) }),
    tpl(L.eqNaive, { ...vals, v: f3(d.naive) }),
    tpl(L.eqHt, { ...vals, v: f3(d.ht) }),
    tpl(L.eqRatio, { ...vals, v: f3(d.ratio) }),
  ];
  eqs.forEach((e, i) => { for (const ln of lines(e, size, w - 4, lang)) { parts.push(text(0, y + 13, ln, { "font-size": size, class: i ? "fig-t-num" : "fig-t-muted" })); y += 16; } y += 3; });
  return svg(w, y + 6, describe(st, lang), g({ class: "fig-inclusion" }, ...parts));
}

const DESIGNS: Record<string, { tau: number; piLow: number; piHigh: number }> = {
  representative: { tau: 0.6, piLow: 0.1, piHigh: 0.1 },
  diagnostic: { tau: 0.6, piLow: 0.5, piHigh: 0.05 },
  exposure: { tau: 0.6, piLow: 0.05, piHigh: 1 },
};

export default defineFigure({
  name: "inclusion-weighting",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    design: {
      kind: "choice", label: { en: "Sampling design", zh: "抽样设计" }, default: "diagnostic",
      options: [
        { value: "representative", label: { en: "Representative", zh: "代表性抽样" } },
        { value: "diagnostic", label: { en: "Diagnostic queue", zh: "诊断队列" } },
        { value: "exposure", label: { en: "Logged exposure", zh: "曝光日志" } },
      ],
    },
    tau: { kind: "range", label: { en: "Confidence threshold τ", zh: "置信度阈值 τ" }, min: 0.3, max: 0.9, step: 0.05, default: 0.6 },
    piLow: { kind: "range", scale: "log", label: { en: "π below τ", zh: "低于 τ 时的 π" }, min: 0.01, max: 1, default: 0.5 },
    piHigh: { kind: "range", scale: "log", label: { en: "π at or above τ", zh: "不低于 τ 时的 π" }, min: 0.01, max: 1, default: 0.05 },
    draw: { kind: "range", label: { en: "Sample draw", zh: "第几次抽样" }, min: 1, max: DRAWS, step: 1, default: 1 },
  },
  update(p, key) {
    if (key === "design") return { ...p, ...DESIGNS[p.design] };
    return p;
  },
  render,
  describe,
});
