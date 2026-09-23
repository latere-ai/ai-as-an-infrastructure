// The lifecycle of one request inside a busy server, measured with the
// chapter's definitions: TTFT_i = t_{i,1} - a_i, ITL_{i,j} = t_{i,j} - t_{i,j-1},
// TPOT_i = (t_{i,O_i} - t_{i,1}) / (O_i - 1), E2E_i = TTFT_i + sum_j ITL_{i,j}.
//
// Twelve requests arrive as a seeded Poisson process at the chosen rate and
// share one accelerator through an iteration-level scheduler with four batch
// slots. Every iteration, finished requests leave, waiting requests take free
// slots in arrival order, and one model pass runs: each newly admitted request
// prefills its whole prompt and emits its first token, and each running
// request decodes one token. A request that arrives mid-iteration waits for
// that iteration to end. Output tokens leave the server when their iteration
// ends.
//
// Each iteration lasts the roofline lower bound from the next section of the
// chapter, tau = max(F / P_max, D / B_max), for an 8B-parameter model with the
// shape of Llama 3.1 8B (32 layers, 32 query heads and 8 KV heads of dimension
// 128, 8.03e9 parameters; meta-llama/Llama-3.1-8B config.json and model card)
// in BF16 on the H100 SXM datasheet peaks used by roofline.ts (989 TFLOP/s
// dense BF16, 3.35 TB/s). iterationCost below counts
//   F = 2 N (prompt tokens + decoded sequences) + attention score and value
//       products (4 L d_model per query-key pair, p^2 / 2 pairs for a causal
//       prompt of p tokens, T pairs for a decode step over T cached tokens)
//   D = weight bytes + KV bytes read by the decodes + KV bytes written
// Kernel launch, sampling, and scheduler time are left out and each operand
// is counted crossing HBM once, so real iterations are slower; the shape of
// the result is the point: an iteration that carries a long prefill is
// compute-bound and takes several times longer than a decode-only one, and
// every running request waits for it.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng, exponential, intBetween } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

// Llama 3.1 8B shape, BF16 weights and cache.
export const MODEL = {
  params: 8.03e9,
  layers: 32,
  qHeads: 32,
  kvHeads: 8,
  dHead: 128,
  bytes: 2,
};
export const WEIGHT_BYTES = MODEL.params * MODEL.bytes;
// Logical KV bytes per cached token: 2 L n_kv d_head b_kv.
export const KV_PER_TOKEN = 2 * MODEL.layers * MODEL.kvHeads * MODEL.dHead * MODEL.bytes;
// Accelerator datasheet figures (dense BF16 peak FLOP/s, HBM bandwidth in
// byte/s, and memory capacity), the same values roofline.ts uses.
export interface Hardware { name: string; peak: number; bw: number; memory: number }
export const HW = {
  a100: { name: "A100 SXM", peak: 312e12, bw: 2.039e12, memory: 80e9 },
  h100: { name: "H100 SXM", peak: 989e12, bw: 3.35e12, memory: 80e9 },
  mi300x: { name: "MI300X", peak: 1307e12, bw: 5.3e12, memory: 192e9 },
} satisfies Record<string, Hardware>;
export const H100 = HW.h100;
const D_MODEL = MODEL.qHeads * MODEL.dHead;

// Roofline lower bound of one iteration, in ms, with its two terms: the
// prompts it prefills and the cached lengths of the sequences it decodes.
export function iterationCost(prompts: number[], contexts: number[], hw: Hardware = H100) {
  let tokens = 0, pairs = 0, kvRead = 0;
  for (const p of prompts) { tokens += p; pairs += (p * p) / 2; }
  for (const c of contexts) { tokens += 1; pairs += c; kvRead += c; }
  const F = 2 * MODEL.params * tokens + 4 * MODEL.layers * D_MODEL * pairs;
  const D = WEIGHT_BYTES + KV_PER_TOKEN * (kvRead + tokens);
  const tF = (F / hw.peak) * 1000, tD = (D / hw.bw) * 1000;
  return { F, D, tF, tD, tau: Math.max(tF, tD) };
}

// ---------------------------------------------------------------- simulation

const REQUESTS = 12;
const SLOTS = 4;

interface Req { id: number; arrival: number; prompt: number; out: number }
interface Iter { t0: number; t1: number; prefill: number[]; decode: number[]; prefillTokens: number }
interface Life { start: number; iterStart: number; tokens: number[]; stretched: boolean[] }
interface Sim { reqs: Req[]; iters: Iter[]; lives: Life[]; end: number }

function trace(rate: number, seed: number): Req[] {
  const u = rng(seed);
  const reqs: Req[] = [];
  let t = 0;
  for (let i = 0; i < REQUESTS; i++) {
    const gap = exponential(u(), 1);
    const pu = u(), ou = u();
    if (i > 0) t += (gap / rate) * 1000;
    // Prompts log-uniform from 64 to 4,096 tokens; outputs 16 to 64 tokens.
    reqs.push({ id: i + 1, arrival: t, prompt: Math.round(64 * 64 ** pu), out: intBetween(ou, 16, 64) });
  }
  return reqs;
}

function simulate(reqs: Req[]): Sim {
  const n = reqs.length;
  const lives: Life[] = reqs.map(() => ({ start: -1, iterStart: -1, tokens: [], stretched: [] }));
  const iters: Iter[] = [];
  const queue: number[] = [];
  let running: number[] = [];
  let now = 0, next = 0;
  for (let guard = 0; guard < 100000; guard++) {
    while (next < n && reqs[next].arrival <= now) queue.push(next++);
    if (!running.length && !queue.length) {
      if (next >= n) break;
      now = reqs[next].arrival; // idle until the next arrival
      continue;
    }
    const prefill: number[] = [];
    while (queue.length && running.length + prefill.length < SLOTS) prefill.push(queue.shift()!);
    const prompts = prefill.map((i) => reqs[i].prompt);
    const contexts = running.map((i) => reqs[i].prompt + lives[i].tokens.length);
    const prefillTokens = prompts.reduce((a, b) => a + b, 0);
    const t0 = now;
    now += iterationCost(prompts, contexts).tau;
    iters.push({ t0, t1: now, prefill, decode: [...running], prefillTokens });
    for (const i of prefill) { lives[i].start = t0; lives[i].iterStart = iters.length - 1; }
    for (const i of running) lives[i].stretched.push(prefill.length > 0);
    for (const i of [...running, ...prefill]) lives[i].tokens.push(now);
    running = [...running, ...prefill].filter((i) => lives[i].tokens.length < reqs[i].out);
  }
  return { reqs, iters, lives, end: now };
}

const memo = new Map<string, Sim>();
function sim(p: { rate: number; seed: number }): Sim {
  const key = `${p.rate}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(trace(p.rate, p.seed));
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

function lifecycle(s: Sim, id: number) {
  const r = s.reqs[id - 1];
  const l = s.lives[id - 1];
  const t1 = l.tokens[0], tO = l.tokens[l.tokens.length - 1];
  const itl = l.tokens.slice(1).map((t, j) => t - l.tokens[j]);
  const O = l.tokens.length;
  return {
    r, l, t1, tO, itl, O,
    queue: l.start - r.arrival,
    prefill: t1 - l.start,
    ttft: t1 - r.arrival,
    tpot: O > 1 ? (tO - t1) / (O - 1) : 0,
    e2e: tO - r.arrival,
    sumItl: tO - t1,
    stretched: l.stretched.filter(Boolean).length,
    maxItl: itl.length ? Math.max(...itl) : 0,
    minItl: itl.length ? Math.min(...itl) : 0,
  };
}

// ---------------------------------------------------------------- figure

const ms = (v: number) => (v >= 100 ? sig(v, 3) : v.toFixed(1));

const labels = {
  en: {
    title: "One request's time inside a busy server",
    lanes: "Twelve requests sharing four batch slots",
    waiting: "waiting",
    prefill: "prefill iteration",
    decode: "decode",
    band: "iteration that carries a prefill",
    time: "time since the first arrival (ms)",
    zoom: "R{i}: {p}-token prompt, {o} output tokens",
    since: "time since R{i} arrived (ms)",
    ttft: "TTFT",
    tpotBr: "{g} gaps, mean TPOT {v} ms",
    e2e: "E2E",
    itlAxis: "ITL (ms)",
    gap: "gap of a decode-only iteration",
    gapLong: "gap stretched by another request's prefill",
    eqTtft: "TTFT = t₁ − a = {q} ms queueing + {p} ms prefill iteration = {v} ms",
    eqTpot: "TPOT = (t_O − t₁) / (O − 1) = {s} ms / {g} = {v} ms",
    eqItl: "ITL from {lo} to {hi} ms; {k:gap is/gaps are} stretched by another prefill",
    eqE2e: "E2E = TTFT + Σ ITL = {t} + {s} = {v} ms",
    describe: "At {rate} requests per second, R{i} waits {q} ms before its prefill and its first token leaves {ttft} ms after arrival. Its {g} later gaps average {tpot} ms and reach {hi} ms when another request's prefill shares the iteration; E2E is {e2e} ms.",
  },
  zh: {
    title: "一个请求在繁忙服务器中的时间构成",
    lanes: "十二个请求共用四个批内槽位",
    waiting: "排队",
    prefill: "预填充迭代",
    decode: "解码",
    band: "带有预填充的迭代",
    time: "距第一个请求到达的时间（ms）",
    zoom: "R{i}：提示词 {p} 个词元，输出 {o} 个词元",
    since: "距 R{i} 到达的时间（ms）",
    ttft: "TTFT",
    tpotBr: "{g} 个间隔，平均 TPOT {v} ms",
    e2e: "E2E",
    itlAxis: "ITL（ms）",
    gap: "只做解码的迭代造成的间隔",
    gapLong: "被其他请求的预填充拉长的间隔",
    eqTtft: "TTFT = t₁ − a = 排队 {q} ms + 预填充迭代 {p} ms = {v} ms",
    eqTpot: "TPOT = (t_O − t₁) / (O − 1) = {s} ms / {g} = {v} ms",
    eqItl: "ITL 在 {lo} 到 {hi} ms 之间，其中 {k} 个间隔被其他请求的预填充拉长",
    eqE2e: "E2E = TTFT + Σ ITL = {t} + {s} = {v} ms",
    describe: "到达率为每秒 {rate} 个请求时，R{i} 在预填充前排队 {q} ms，首个词元在到达后 {ttft} ms 发出。之后的 {g} 个间隔平均 {tpot} ms，其他请求的预填充与它同处一轮迭代时，间隔达到 {hi} ms；E2E 为 {e2e} ms。",
  },
};

type P = { rate: number; focus: number; seed: number };
type L = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = sim(st.p);
  const f = lifecycle(s, st.p.focus);
  return tpl(L.describe, {
    rate: st.p.rate, i: st.p.focus, q: ms(f.queue), ttft: ms(f.ttft), g: f.O - 1,
    tpot: ms(f.tpot), hi: ms(f.maxItl), e2e: ms(f.e2e),
  });
}

// Horizontal bracket with a centered label, or the label beside it when the
// bracket is too short to hold it.
function bracket(x0: number, x1: number, y: number, label: string, w: number): string {
  const parts: string[] = [
    el("path", { d: `M${x0},${y + 5}V${y}H${x1}V${y + 5}`, fill: "none", stroke: C.ink2, "stroke-width": 1 }),
  ];
  const tw = textWidth(label, TYPE.body);
  const mid = (x0 + x1) / 2;
  if (tw + 8 <= x1 - x0) parts.push(text(mid, y - 4, label, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
  else if (x1 + 6 + tw <= w) parts.push(text(x1 + 6, y + 4, label, { "font-size": TYPE.body, class: "fig-t-strong" }));
  else parts.push(text(x0 - 6, y + 4, label, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  return parts.join("");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const s = sim(p);
  const f = lifecycle(s, p.focus);
  const tick = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];

  // ---- all requests on one time axis
  parts.push(text(0, 14, L.lanes, { "font-size": TYPE.title, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.waiting, swatch: { kind: "line", stroke: C.ink3 } },
    { label: L.prefill, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.decode, swatch: { kind: "rect", fill: C.c1, opacity: 0.4 } },
    { label: L.band, swatch: { kind: "rect", fill: C.c2, opacity: 0.18 } },
  ], 0, 24, w, TYPE.body);
  parts.push(lg.svg);
  const labelW = 34;
  const top = 24 + lg.height + 10;
  const rowH = narrow ? 13 : 14;
  const plotH = s.reqs.length * rowH;
  const x = linear([0, s.end], [labelW, w - 6]);
  // Iterations that carry a prefill, as bands behind every lane.
  for (const it of s.iters) {
    if (!it.prefill.length) continue;
    parts.push(el("rect", { x: x(it.t0), y: top - 2, width: Math.max(0.8, x(it.t1) - x(it.t0)), height: plotH + 4, fill: C.c2, "fill-opacity": 0.18 }));
  }
  s.reqs.forEach((r, i) => {
    const l = s.lives[i];
    const yy = top + i * rowH;
    const sel = r.id === p.focus;
    if (sel) parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH, fill: C.panel }));
    const mid = yy + rowH / 2;
    parts.push(el("line", { x1: x(r.arrival), x2: x(l.start), y1: mid, y2: mid, stroke: C.ink3, "stroke-width": 1.2 }));
    parts.push(el("line", { x1: x(r.arrival), x2: x(r.arrival), y1: yy + 3, y2: yy + rowH - 3, stroke: C.ink3, "stroke-width": 1.2 }));
    const t1 = l.tokens[0], tO = l.tokens[l.tokens.length - 1];
    parts.push(el("rect", { x: x(t1), y: yy + 2, width: Math.max(0.8, x(tO) - x(t1)), height: rowH - 4, fill: C.c1, "fill-opacity": 0.4 }));
    parts.push(el("rect", { x: x(l.start), y: yy + 2, width: Math.max(1.2, x(t1) - x(l.start)), height: rowH - 4, fill: C.c1 }));
    parts.push(text(labelW - 6, mid + 4, `R${r.id}`, { "font-size": TYPE.body, "text-anchor": "end", class: sel ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH, fill: "transparent", "data-fig-set": `focus=${r.id}`, class: "fig-hit" }));
  });
  const axY = top + plotH + 4;
  parts.push(axis({ scale: x, orient: "bottom", at: axY, ticks: x.ticks(narrow ? 4 : 7), title: L.time, format: (v) => sig(v, 4), size: tick }));
  let y = axY + axisHeight(true, tick) + 18;

  // ---- the focused request, zoomed to its own lifetime
  parts.push(text(0, y + 13, tpl(L.zoom, { i: p.focus, p: f.r.prompt.toLocaleString("en-US"), o: f.O }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 26;
  const zx = linear([0, f.e2e], [narrow ? 36 : 44, w - (narrow ? 8 : 12)]);
  const at = (t: number) => zx(t - f.r.arrival);
  const bracketTop = y + 18;
  // Brackets: TTFT and the decode gaps, then E2E.
  parts.push(bracket(at(f.r.arrival), at(f.t1), bracketTop, L.ttft, w));
  parts.push(bracket(at(f.t1), at(f.tO), bracketTop, tpl(L.tpotBr, { g: f.O - 1, v: ms(f.tpot) }), w));
  parts.push(bracket(at(f.r.arrival), at(f.tO), bracketTop + 22, L.e2e, w));
  // The request's own track: waiting, prefill iteration, tokens as ticks.
  const trackY = bracketTop + 34;
  const trackH = 14;
  parts.push(el("line", { x1: at(f.r.arrival), x2: at(f.l.start), y1: trackY + trackH / 2, y2: trackY + trackH / 2, stroke: C.ink3, "stroke-width": 1.5 }));
  parts.push(el("rect", { x: at(f.t1), y: trackY, width: Math.max(1, at(f.tO) - at(f.t1)), height: trackH, fill: C.c1, "fill-opacity": 0.25 }));
  parts.push(el("rect", { x: at(f.l.start), y: trackY, width: Math.max(1.5, at(f.t1) - at(f.l.start)), height: trackH, fill: C.c1 }));
  for (const t of f.l.tokens) parts.push(el("line", { x1: at(t), x2: at(t), y1: trackY - 2, y2: trackY + trackH + 2, stroke: C.ink2, "stroke-width": 1 }));
  // ITL per token, bars spanning each gap; stretched gaps in the second color.
  const barTop = trackY + trackH + 26;
  const barH = narrow ? 70 : 80;
  const maxItl = Math.max(f.maxItl, 1);
  const yv = linear([0, maxItl * 1.1], [barTop + barH, barTop]);
  parts.push(axis({ scale: yv, orient: "left", at: zx(0), ticks: yv.ticks(3), grid: [zx(0), zx(f.e2e)], format: (v) => sig(v, 3), size: tick }));
  parts.push(text(0, barTop - 8, L.itlAxis, { "font-size": tick, class: "fig-t-muted" }));
  f.itl.forEach((v, j) => {
    const a = f.l.tokens[j], b = f.l.tokens[j + 1];
    const long = f.l.stretched[j];
    parts.push(el("rect", { x: at(a) + 0.3, y: yv(v), width: Math.max(0.6, at(b) - at(a) - 0.6), height: yv(0) - yv(v), fill: long ? C.c2 : C.c1, "fill-opacity": long ? 0.9 : 0.55 }));
  });
  // Mean gap (TPOT).
  if (f.O > 1) parts.push(el("line", { x1: at(f.t1), x2: at(f.tO), y1: yv(f.tpot), y2: yv(f.tpot), stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  parts.push(axis({ scale: zx, orient: "bottom", at: barTop + barH, ticks: zx.ticks(narrow ? 4 : 6), title: tpl(L.since, { i: p.focus }), format: (v) => sig(v, 4), size: tick }));
  y = barTop + barH + axisHeight(true, tick) + 6;
  const lg2 = legend([
    { label: L.gap, swatch: { kind: "rect", fill: C.c1, opacity: 0.55 } },
    { label: L.gapLong, swatch: { kind: "rect", fill: C.c2, opacity: 0.9 } },
    { label: "TPOT", swatch: { kind: "line", stroke: C.ink, dash: "4 3" } },
  ], 0, y, w, TYPE.body);
  parts.push(lg2.svg);
  y += lg2.height + 12;

  // ---- readout: the section's equations with this request's terms
  const lines = [
    tpl(L.eqTtft, { q: ms(f.queue), p: ms(f.prefill), v: ms(f.ttft) }),
    tpl(L.eqTpot, { s: ms(f.sumItl), g: f.O - 1, v: ms(f.tpot) }),
    tpl(L.eqItl, { lo: ms(f.minItl), hi: ms(f.maxItl), k: f.stretched }),
    tpl(L.eqE2e, { t: ms(f.ttft), s: ms(f.sumItl), v: ms(f.e2e) }),
  ];
  const ro: string[] = [];
  for (const ln of lines) {
    for (const part of wrapEq(ln, w)) { ro.push(text(0, y + 12, part, { "font-size": TYPE.body, class: "fig-t-num" })); y += 17; }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 2, describe(st, lang), ...parts);
}

// Break a readout line at " = " or ", " boundaries when it does not fit.
function wrapEq(s: string, w: number): string[] {
  if (textWidth(s, TYPE.body) <= w) return [s];
  const out: string[] = [];
  let line = "";
  for (const tok of s.split(/(?<= = |; |，|；)/)) {
    if (line && textWidth(line + tok, TYPE.body) > w) { out.push(line.trimEnd()); line = "  " + tok; } else line += tok;
  }
  if (line) out.push(line.trimEnd());
  return out;
}

export default defineFigure({
  name: "serving-lifecycle",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    rate: { kind: "range", label: { en: "Arrival rate", zh: "到达率" }, unit: { en: "requests/s", zh: "个请求/秒" }, min: 5, max: 60, step: 1, default: 30 },
    focus: {
      kind: "choice", label: { en: "Request", zh: "请求" }, default: 5,
      options: Array.from({ length: REQUESTS }, (_, i) => ({ value: i + 1, label: { en: `R${i + 1}`, zh: `R${i + 1}` } })),
    },
    seed: { kind: "range", label: { en: "Trace seed", zh: "请求序列种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  render,
  describe,
});
