// What an attention layer and a recurrent layer keep of the tokens they have
// read, token by token.
//
// Attention: every token appends one key-value record, which stays in the
// cache unchanged, so the cache grows by 2·H_kv·d_h·b bytes per token.
//
// Recurrence: one channel and one state dimension of the chapter's selective
// recurrence, h_t = Ā_t·h_(t−1) + B̄_t·x_t with Ā_t = exp(Δ_t A) and the
// zero-order-hold input map B̄_t = (exp(Δ_t A) − 1) A⁻¹ B, for A = −1, B = 1.
// Unrolled, token j's input enters h_t with weight
//
//   w_{t,j} = B̄_j · Π_{i=j+1..t} Ā_i
//
// which the figure draws for every j ≤ t. With a fixed Δ (the time-invariant
// case) the weight depends only on the distance t − j; with a selective Δ_t it
// depends on what the later tokens were. The Δ_t values are illustrative: one
// value on content tokens and a small one on filler, the pattern the selective
// copying task calls for, not values from a trained model.
//
// Byte counts use the Jamba v0.1 layer shapes (config.json of
// ai21labs/Jamba-v0.1: 8 KV heads of width 128; Mamba d_inner = 2 · 4096,
// d_state = 16, d_conv = 4) in bf16, with the chapter's equation
// M_rec = d_inner (n_state + d_conv) b for one layer and one sequence.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, sig, tpl, int } from "./lib/format.ts";

// ---------------------------------------------------------------- model

// Content digits at fixed positions among filler tokens (1-based positions).
const SEQ: string[] = "· 7 · · · · · 3 · · · · · · 9 · · · · 4 · · · ·".split(" ");
export const N = SEQ.length; // 24
const isContent = (j: number) => SEQ[j] !== "·";
const A = -1;
const FILLER_DELTA = 0.02;

// Jamba v0.1 layer shapes, bf16.
const KV_HEADS = 8, HEAD_DIM = 128, D_INNER = 8192, D_STATE = 16, D_CONV = 4, BYTES = 2;
const KV_PER_TOKEN = 2 * KV_HEADS * HEAD_DIM * BYTES; // 4,096 B
const REC_STATE = D_INNER * (D_STATE + D_CONV) * BYTES; // 327,680 B
const CROSSOVER = REC_STATE / KV_PER_TOKEN; // tokens

type Mode = "fixed" | "selective";
type P = { mode: Mode; delta: number; probe: number };

function deltas(p: P): number[] {
  return SEQ.map((_, j) => (p.mode === "fixed" || isContent(j) ? p.delta : FILLER_DELTA));
}

// Weight of token j's input in the state after token t (0-based, j <= t).
function weights(p: P, t: number) {
  const d = deltas(p);
  const aBar = d.map((v) => Math.exp(v * A));
  const bBar = d.map((v) => (Math.exp(v * A) - 1) / A);
  const w = new Array<number>(N).fill(0);
  let prod = 1;
  for (let j = t; j >= 0; j--) {
    w[j] = bBar[j] * prod;
    prod *= aBar[j];
  }
  return { d, aBar, bBar, w };
}

const kib = (b: number) => (b === 0 ? "0 KiB" : b >= 1024 ** 3 ? `${sig(b / 1024 ** 3, 3)} GiB` : b >= 1024 ** 2 ? `${sig(b / 1024 ** 2, 3)} MiB` : `${sig(b / 1024, 3)} KiB`);

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Attention records and a recurrent state",
    step: "After token {t} of {n}",
    before: "Before the first token",
    lProbe: "followed token",
    deltaFixed: "step Δ = {d} on every token",
    deltaSel: "step Δ_t chosen per token: {d} on content, {f} on filler",
    fresh: "no later token has acted on it yet",
    input: "input tokens: content digits among filler",
    attn: "Attention layer: {n:KV record/KV records}, each kept unchanged",
    rec: "Recurrent layer: weight of each token's input still in h_t",
    lRecord: "KV record",
    lWeight: "weight in h_t",
    lNow: "current token",
    probe: "Token {j} (“{x}”) in h_{t}",
    probeFuture: "Token {j} (“{x}”) is not read until step {j}",
    written: "written with Δ = {d}: B̄ = 1 − exp(−Δ) = {b}",
    decayed: "then multiplied by Ā = exp(−Δ_i) at {n:later token/later tokens}: Π = {a}",
    share: "w = {w}; its KV record is still whole",
    eq: "h_t = Ā_t·h_(t−1) + B̄_t·x_t,  Ā_t = exp(Δ_t A),  A = −1",
    bytes: "One Jamba layer per sequence, bf16",
    bAttn: "attention KV, 2·H_kv·d_h·b × {t}",
    bRec: "Mamba state, d_inner·(n_state + d_conv)·b",
    bCross: "The KV cache passes the fixed state at {c} tokens; at 256K tokens it is {big}.",
    modeFixed: "fixed Δ = {d} on every token",
    modeSel: "selective Δ_t: {d} on content, {f} on filler",
    describe: "After token {t} of {n}, {mode}. The attention layer holds {t} records. In the recurrent state the four content tokens keep weights {ws}. Token {j} keeps {w}.",
  },
  zh: {
    title: "注意力记录与递归状态",
    step: "读到第 {t} 个词元，共 {n} 个",
    before: "尚未读入词元",
    lProbe: "跟踪的词元",
    deltaFixed: "每个词元的步长都是 Δ = {d}",
    deltaSel: "逐词元选择步长 Δ_t：内容词元 {d}，填充词元 {f}",
    fresh: "之后还没有词元作用于它",
    input: "输入词元：内容数字夹在填充词元之间",
    attn: "注意力层：{n} 条 KV 记录，每条原样保留",
    rec: "递归层：各词元的输入在 h_t 中剩下的权重",
    lRecord: "KV 记录",
    lWeight: "在 h_t 中的权重",
    lNow: "当前词元",
    probe: "词元 {j}（“{x}”）在 h_{t} 中",
    probeFuture: "词元 {j}（“{x}”）要到第 {j} 步才读入",
    written: "写入时 Δ = {d}：B̄ = 1 − exp(−Δ) = {b}",
    decayed: "之后经过 {n} 个词元，每步乘以 Ā = exp(−Δ_i)：Π = {a}",
    share: "w = {w}；它的 KV 记录仍然完整",
    eq: "h_t = Ā_t·h_(t−1) + B̄_t·x_t，Ā_t = exp(Δ_t A)，A = −1",
    bytes: "Jamba 的一层，每条序列，bf16",
    bAttn: "注意力 KV，2·H_kv·d_h·b × {t}",
    bRec: "Mamba 状态，d_inner·(n_state + d_conv)·b",
    bCross: "KV 缓存在 {c} 个词元处超过固定状态；到 256K 词元时为 {big}。",
    modeFixed: "每个词元固定 Δ = {d}",
    modeSel: "选择性 Δ_t：内容词元 {d}，填充词元 {f}",
    describe: "读到第 {t} 个词元（共 {n} 个），{mode}。注意力层保存 {t} 条记录。递归状态中，四个内容词元的权重为 {ws}。词元 {j} 的权重为 {w}。",
  },
};
type L = typeof labels.en;

// The token whose path through the state is spelled out: the chosen one, else
// the latest content token read so far (the first one before any is read).
function probeOf(p: P, t: number): number {
  if (p.probe > 0) return p.probe - 1;
  let j = -1;
  for (let i = 0; i <= t; i++) if (isContent(i)) j = i;
  return j >= 0 ? j : SEQ.findIndex((_, i) => isContent(i));
}

// Wrapped lines with CJK closing punctuation kept off the start of a line.
function lines(s: string, size: number, width: number): string[] {
  const out = wrap(s, size, width);
  for (let i = 1; i < out.length; i++) {
    const m = out[i].match(/^[，。；：、）」]+/);
    if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length).trimStart(); }
  }
  return out.filter((ln) => ln.length);
}

// Text with B̄ drawn as B under an overline: the combining macron has no
// precomposed form and sits off the letter in the UI font.
function mtext(x: number, y: number, s: string, a: Record<string, string | number | undefined>): string {
  if (!s.includes("B̄")) return text(x, y, s, a);
  const inner = s.split("B̄").map((part) => esc(part)).join('<tspan style="text-decoration:overline">B</tspan>');
  const attrs = Object.entries({ x, y, ...a }).filter(([, v]) => v != null).map(([k, v]) => ` ${k}="${esc(String(v))}"`).join("");
  return `<text${attrs}>${inner}</text>`;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const t = Math.round(st.t) - 1;
  const { w } = weights(p, t);
  const ws = SEQ.map((_, j) => j).filter((j) => isContent(j)).map((j) => (j <= t ? fixed(w[j], 2) : "–")).join(lang === "zh" ? "、" : ", ");
  const j = probeOf(p, t);
  return tpl(L.describe, {
    t: Math.max(0, t + 1), n: N, mode: p.mode === "fixed" ? tpl(L.modeFixed, { d: sig(p.delta, 2) }) : tpl(L.modeSel, { d: sig(p.delta, 2), f: FILLER_DELTA }),
    ws, j: j + 1, w: j <= t ? sig(w[j], 2) : "–",
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const sm = narrow ? TYPE.body : TYPE.small; // small text, 12 px on a phone column
  const t = Math.round(st.t) - 1; // 0-based current token; −1 before the first
  const m = weights(p, t);
  const probe = probeOf(p, t);
  const parts: string[] = [];
  const titles: string[] = []; // row titles, drawn after the marks
  const gap = narrow ? 1.5 : 3;
  const gut = narrow ? 20 : 26; // left gutter for the weight scale
  const cw = (w - gut - gap * (N - 1)) / N;
  const cx = (j: number) => gut + j * (cw + gap);
  let y = 0;

  parts.push(text(0, y + 14, t >= 0 ? tpl(L.step, { t: t + 1, n: N }) : L.before, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  const lg = legend([
    { label: L.lRecord, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lWeight, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lNow, swatch: { kind: "rect", fill: "none", stroke: C.ink } },
    { label: L.lProbe, swatch: { kind: "rect", fill: "none", stroke: C.ink2, dash: "3 2" } },
  ], 0, y + 22, w, sm);
  parts.push(lg.svg);
  y += 30 + lg.height;
  const bandTop = y;
  const bands: Array<[number, number]> = []; // vertical extent of each row's marks, for the column outlines
  const title = (s: string) => { titles.push(text(0, y + 12, s, { "font-size": sm, class: "fig-t-muted" })); y += 18; };

  // ---- input tokens
  title(L.input);
  const tokH = 22;
  bands.push([y, y + tokH]);
  for (let j = 0; j < N; j++) {
    const content = isContent(j);
    const read = j <= t;
    if (content) parts.push(el("rect", { x: cx(j), y, width: cw, height: tokH, rx: 3, fill: C.panel, stroke: C.ink3, "stroke-width": 0.8 }));
    parts.push(text(cx(j) + cw / 2, y + 15, SEQ[j], { "font-size": content ? TYPE.label : TYPE.body, "text-anchor": "middle", class: read ? (content ? "fig-t-strong" : "fig-t-muted") : "fig-t-faint" }));
  }
  y += tokH + 12;

  // ---- attention records
  title(tpl(L.attn, { n: Math.max(0, t + 1) }));
  const recH = 16;
  bands.push([y, y + recH]);
  for (let j = 0; j < N; j++) parts.push(el("rect", { x: cx(j), y, width: cw, height: recH, rx: 2, fill: j <= t ? C.c1 : C.panel }));
  y += recH + 12;

  // ---- step Δ_t, on a log scale from 0.01 to 3
  title(p.mode === "fixed" ? tpl(L.deltaFixed, { d: sig(p.delta, 2) }) : tpl(L.deltaSel, { d: sig(p.delta, 2), f: FILLER_DELTA }));
  const dH = 20;
  bands.push([y, y + dH]);
  for (let j = 0; j < N; j++) {
    const hh = Math.max(1, (Math.log10(m.d[j] / 0.01) / Math.log10(3 / 0.01)) * dH);
    parts.push(el("rect", { x: cx(j) + cw * 0.2, y: y + dH - hh, width: cw * 0.6, height: hh, rx: 1, fill: C.ink3, "fill-opacity": j <= t ? 0.9 : 0.3 }));
  }
  parts.push(el("line", { x1: gut, x2: w, y1: y + dH, y2: y + dH, stroke: C.rule, "stroke-width": 1 }));
  y += dH + 12;

  // ---- weights in the recurrent state
  title(L.rec);
  y += 6;
  const wH = narrow ? 72 : 88;
  const wy = (v: number) => y + wH * (1 - v);
  bands.push([y, y + wH]);
  for (const v of [0.25, 0.5, 0.75, 1]) parts.push(el("line", { x1: gut, x2: w, y1: wy(v), y2: wy(v), stroke: C.grid, "stroke-width": 1 }));
  for (const v of [0, 0.5, 1]) parts.push(text(gut - 5, wy(v) + 4, v, { "font-size": sm, "text-anchor": "end", class: "fig-t-faint fig-t-num" }));
  for (let j = 0; j <= t; j++) {
    const hh = m.w[j] * wH;
    if (hh >= 0.6) parts.push(el("rect", { x: cx(j), y: wy(m.w[j]), width: cw, height: hh, rx: 1.5, fill: C.c2 }));
    if (isContent(j) && !narrow) parts.push(text(cx(j) + cw / 2, Math.max(y + 11, wy(m.w[j]) - 4), fixed(m.w[j], 2), { "font-size": sm, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
  }
  parts.push(el("line", { x1: gut, x2: w, y1: y + wH, y2: y + wH, stroke: C.rule, "stroke-width": 1 }));
  y += wH;
  const bandBottom = y + 2;

  // Current-token and followed-token columns, and hit targets for following.
  const col = (j: number, attrs: Record<string, string | number>) => bands.map(([a, b]) => el("rect", { x: cx(j) - 1.5, y: a - 3, width: cw + 3, height: b - a + 6, rx: 3, fill: "none", ...attrs })).join("");
  if (probe !== t) parts.push(col(probe, { stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));
  if (t >= 0) parts.push(col(t, { stroke: C.ink, "stroke-width": 1.2 }));
  parts.push(...titles);
  for (let j = 0; j < N; j++) parts.push(el("rect", { x: cx(j) - gap / 2, y: bandTop, width: cw + gap, height: bandBottom - bandTop, fill: "transparent", "data-fig-set": `probe=${j + 1}`, class: "fig-hit" }));
  y += 14;

  // ---- readouts: the followed token's path, then bytes
  const lw = narrow ? w : Math.floor(w * 0.52);
  const rx = narrow ? 0 : lw + 24;
  const rw = narrow ? w : w - rx;
  let ly = y + 12;
  const put = (s: string, x: number, width: number, cls: string, size: number = TYPE.body) => {
    for (const ln of lines(s, size, width)) { parts.push(mtext(x, ly, ln, { "font-size": size, class: cls })); ly += size + 5; }
  };
  if (probe <= t) {
    const later = t - probe;
    const prod = m.w[probe] / m.bBar[probe];
    put(tpl(L.probe, { j: probe + 1, x: SEQ[probe], t: t + 1 }), 0, lw, "fig-t-strong", TYPE.label);
    put(tpl(L.written, { d: sig(m.d[probe], 2), b: fixed(m.bBar[probe], 3) }), 0, lw, "fig-t-num");
    put(later ? tpl(L.decayed, { n: later, a: sig(prod, 2) }) : L.fresh, 0, lw, "fig-t-num");
    put(tpl(L.share, { w: sig(m.w[probe], 2) }), 0, lw, "fig-t-num fig-t-strong");
  } else {
    put(tpl(L.probeFuture, { j: probe + 1, x: SEQ[probe] }), 0, lw, "fig-t-strong", TYPE.label);
  }
  ly += 2;
  put(L.eq, 0, lw, "fig-t-muted fig-t-num", sm);
  const leftEnd = ly;

  ly = narrow ? ly + 16 : y + 12;
  put(L.bytes, rx, rw, "fig-t-strong", TYPE.label);
  const n = Math.max(0, t + 1);
  const rows: Array<[string, number, string]> = [
    [tpl(L.bAttn, { t: n }), KV_PER_TOKEN * n, C.c1],
    [L.bRec, REC_STATE, C.c2],
  ];
  const valW = textWidth("320 KiB", TYPE.body) + 10;
  for (const [name, b, color] of rows) {
    put(name, rx, rw, "fig-t-num", sm);
    ly -= 4;
    const barW = rw - valW;
    parts.push(el("rect", { x: rx, y: ly, width: barW, height: 12, rx: 2, fill: C.panel }));
    if (b > 0) parts.push(el("rect", { x: rx, y: ly, width: Math.max(1.5, (b / (REC_STATE * 1.05)) * barW), height: 12, rx: 2, fill: color }));
    parts.push(text(rx + rw, ly + 11, kib(b), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    ly += 26;
  }
  put(tpl(L.bCross, { c: int(CROSSOVER), big: kib(KV_PER_TOKEN * 262144) }), rx, rw, "fig-t-muted", sm);
  return svg(w, Math.max(leftEnd, ly) + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "recurrent-state",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    mode: {
      kind: "choice", label: { en: "Recurrence", zh: "递归方式" }, default: "selective",
      options: [
        { value: "fixed", label: { en: "Fixed Δ", zh: "固定 Δ" } },
        { value: "selective", label: { en: "Selective Δ_t", zh: "选择性 Δ_t" } },
      ],
    },
    delta: {
      kind: "range", scale: "log", label: { en: "Δ on content tokens", zh: "内容词元的 Δ" }, min: 0.05, max: 3, default: 1,
    },
    probe: {
      kind: "choice", control: "select", label: { en: "Follow token", zh: "跟踪词元" }, default: 0,
      options: [
        { value: 0, label: { en: "latest content token", zh: "最近读入的内容词元" } },
        ...SEQ.map((x, j) => ({ value: j + 1, label: { en: `${j + 1}: ${x}`, zh: `${j + 1}：${x}` } })),
      ],
    },
  },
  timeline: {
    rate: 3,
    discrete: true,
    duration: () => N,
    keyframes: (p, lang) => SEQ.map((x, j) => ({ j, x })).filter(({ j }) => isContent(j)).map(({ j, x }) => ({
      t: j + 1,
      label: lang === "zh" ? `第 ${j + 1} 个词元写入 ${x}` : `Token ${j + 1} writes ${x}`,
    })),
    poster: () => N,
  },
  render,
  describe,
});
