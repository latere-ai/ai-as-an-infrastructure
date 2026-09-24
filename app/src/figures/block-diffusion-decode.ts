// Three decoders on one round clock, for the non-autoregressive chapter's
// dependency table and its runnable (L = 128, K = 8, B = 16):
//
// - Autoregression reveals one position per round and reads every earlier
//   position from the causal KV cache: L dependent rounds, L positions scored.
// - Block diffusion appends a block of B masks, denoises it in K rounds with
//   bidirectional attention inside the block, then commits it; committed
//   blocks are a stable prefix whose KV is cached. K·⌈L/B⌉ dependent rounds,
//   and every round scores its whole block, so L·K positions in all.
// - Full masked diffusion is one block of L: a fixed canvas of L masks,
//   every position scored in each of K rounds, nothing cached across rounds.
//
// All three are one function, lane(B, k): autoregression is B = 1, k = 1 and
// the full canvas is B = L. A round is counted only when it reveals at least
// one position (a round that changes nothing needs no new network
// evaluation), so a block uses k = min(K, B) rounds; this is what makes a
// one-position block ordinary autoregression.
//
// Which positions a round reveals follows a seeded permutation of each block,
// an equal share per round. Real samplers follow their noise schedule or a
// confidence rule; the order is illustrative, the counts are exact.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { wrap } from "./lib/labels.ts";
import { int, tpl } from "./lib/format.ts";

export const L = 128;

// ---------------------------------------------------------------- model

interface Lane {
  B: number; // block size
  k: number; // rounds per block actually used
  blocks: number;
  rounds: number; // dependent rounds R = k·⌈L/B⌉
  revealAt: Int16Array; // position -> round that reveals it (1-based)
  scored: number; // positions scored over the whole decode
}

function permutation(n: number, seed: number): number[] {
  const u = rng(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(u() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const memo = new Map<string, Lane>();
export function lane(B: number, K: number, seed: number): Lane {
  const k = Math.min(K, B);
  const key = `${B}|${k}|${seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const blocks = Math.ceil(L / B);
  const revealAt = new Int16Array(L);
  let scored = 0;
  for (let j = 0; j < blocks; j++) {
    const start = j * B;
    const n = Math.min(B, L - start);
    const kk = Math.min(k, n);
    const order = n === 1 ? [0] : permutation(n, seed * 7919 + j * 104729 + n);
    for (let q = 0; q < kk; q++) {
      for (let s = Math.floor((q * n) / kk); s < Math.floor(((q + 1) * n) / kk); s++) {
        revealAt[start + order[s]] = j * k + q + 1;
      }
    }
    scored += n * kk;
  }
  const out = { B, k, blocks, rounds: (blocks - 1) * k + Math.min(k, L - (blocks - 1) * B), revealAt, scored };
  if (memo.size > 64) memo.clear();
  memo.set(key, out);
  return out;
}

// State of one lane after round t (t = 0: before the first evaluation).
interface LaneAt {
  done: boolean;
  block: number; // index of the block the last round worked on, or -1
  scoredNow: [number, number] | null; // position span scored in round t
  cached: number; // prefix length read from the KV cache in round t (or available, once done)
  appended: number; // positions that exist on the canvas
  revealed: number;
  scoredSoFar: number;
}

function at(ln: Lane, t: number): LaneAt {
  let revealed = 0;
  for (let i = 0; i < L; i++) if (ln.revealAt[i] > 0 && ln.revealAt[i] <= t) revealed++;
  if (t >= ln.rounds) {
    return { done: true, block: -1, scoredNow: t === ln.rounds ? span(ln, ln.blocks - 1) : null, cached: t === ln.rounds ? (ln.blocks - 1) * ln.B : L, appended: L, revealed, scoredSoFar: ln.scored };
  }
  // Before the first round a diffusion lane has appended its first block of
  // masks; autoregression has produced nothing yet.
  if (t === 0) return { done: false, block: -1, scoredNow: null, cached: 0, appended: ln.B > 1 ? Math.min(ln.B, L) : 0, revealed: 0, scoredSoFar: 0 };
  const j = Math.floor((t - 1) / ln.k);
  const sp = span(ln, j);
  // Positions scored before this block, plus this block's rounds so far.
  const scoredSoFar = j * ln.B * ln.k + (t - j * ln.k) * (sp[1] - sp[0]);
  return { done: false, block: j, scoredNow: sp, cached: sp[0], appended: sp[1], revealed, scoredSoFar };
}

function span(ln: Lane, j: number): [number, number] {
  return [j * ln.B, Math.min(L, (j + 1) * ln.B)];
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Autoregression, block diffusion and full masked diffusion on one round clock",
    ar: "Autoregression, B = 1",
    bd: "Block diffusion, B = {b}, K = {k}",
    bdAr: "Block diffusion, B = 1: the same as autoregression",
    bdFull: "Block diffusion, B = {b}: the same as the full canvas",
    full: "Full masked diffusion, one canvas of {l}, K = {k}",
    plan: "{r} dependent rounds, {s} positions to score",
    running: "round {t} of {r}: {n} scored, {c} read from cache; {so} of {s} positions scored so far",
    doneAt: "done after {r} rounds, {s} positions scored",
    revealed: "revealed",
    now: "revealed this round",
    mask: "mask",
    scored: "scored this round",
    cache: "read from KV cache",
    rows: "{l} output positions, {n} per row",
    eqR: "Block diffusion: R = K·⌈L/B⌉ = {k} · ⌈{l}/{b}⌉ = {r} dependent rounds (autoregression: L = {l})",
    eqS: "Positions scored: L·K = {l} · {k} = {s} (autoregression: L = {l})",
    clamp: "K = min({K}, B) = {k}: each round reveals at least one position.",
    kfFull: "Full canvas done: {k} rounds, {s} positions scored",
    kfBlock: "Block {j} of {n} committed; its {b} positions join the cached prefix",
    kfBdDone: "Block diffusion done: {r} rounds",
    kfAr: "Autoregression done: {l} rounds, {l} positions scored",
    kfStart: "The full canvas starts as {l} masks",
    describe: "Round {t}. Autoregression has revealed {a} of {l} positions and reads {ac} from its cache. Block diffusion with B = {b} and K = {k} has revealed {bv} and needs {br} rounds in all. The full canvas {fs}, scoring {fsc} positions.",
    fullRunning: "has revealed {fv} after {t} of {fr} rounds",
    fullDone: "finished at round {fr}",
  },
  zh: {
    title: "同一轮次时钟下的自回归、块扩散与完整掩码扩散",
    ar: "自回归，B = 1",
    bd: "块扩散，B = {b}，K = {k}",
    bdAr: "块扩散，B = 1：与自回归相同",
    bdFull: "块扩散，B = {b}：与完整画布相同",
    full: "完整掩码扩散，一张 {l} 位画布，K = {k}",
    plan: "{r} 个相互依赖的轮次，需为 {s} 个位置打分",
    running: "第 {t} 轮（共 {r} 轮）：打分 {n} 个，从缓存读取 {c} 个；累计打分 {so} 个，共 {s} 个",
    doneAt: "{r} 轮后完成，共为 {s} 个位置打分",
    revealed: "已确定",
    now: "本轮确定",
    mask: "掩码",
    scored: "本轮打分",
    cache: "从 KV 缓存读取",
    rows: "{l} 个输出位置，每行 {n} 个",
    eqR: "块扩散：R = K·⌈L/B⌉ = {k} · ⌈{l}/{b}⌉ = {r} 个相互依赖的轮次（自回归：L = {l}）",
    eqS: "打分位置数：L·K = {l} · {k} = {s}（自回归：L = {l}）",
    clamp: "K = min({K}, B) = {k}：每轮至少确定一个位置。",
    kfFull: "完整画布完成：{k} 轮，共为 {s} 个位置打分",
    kfBlock: "第 {j} 块（共 {n} 块）提交，{b} 个位置并入缓存前缀",
    kfBdDone: "块扩散完成：{r} 轮",
    kfAr: "自回归完成：{l} 轮，共为 {l} 个位置打分",
    kfStart: "完整画布从 {l} 个掩码开始",
    describe: "第 {t} 轮。自回归已确定 {l} 个位置中的 {a} 个，从缓存读取 {ac} 个。B = {b}、K = {k} 的块扩散已确定 {bv} 个，共需 {br} 轮。完整画布{fs}，共为 {fsc} 个位置打分。",
    fullRunning: "已进行 {t} 轮（共 {fr} 轮），确定了 {fv} 个",
    fullDone: "在第 {fr} 轮完成",
  },
};

type Lb = typeof labels.en;
type P = { block: number; rounds: number; seed: number };

function lanes(p: P) {
  return {
    ar: lane(1, 1, p.seed),
    bd: lane(p.block, p.rounds, p.seed),
    full: lane(L, p.rounds, p.seed),
  };
}

function bdTitle(p: P, Lb: Lb): string {
  if (p.block === 1) return Lb.bdAr;
  if (p.block === L) return tpl(Lb.bdFull, { b: p.block });
  return tpl(Lb.bd, { b: p.block, k: Math.min(p.rounds, p.block) });
}

// One lane: a title, a status line with the lane's counts, then the canvas
// wrapped into rows of `per` cells, with the span scored this round outlined
// and the prefix read from the KV cache underlined.
function renderLane(ln: Lane, t: number, title: string, w: number, y0: number, per: number, gutter: number, Lx: Lb, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  const s = at(ln, t);
  const size = narrow ? TYPE.body : TYPE.label;
  parts.push(text(0, y0 + size, title, { "font-size": size, class: "fig-t-strong" }));
  const status = t === 0 ? tpl(Lx.plan, { r: int(ln.rounds), s: int(ln.scored) })
    : s.done && !s.scoredNow ? tpl(Lx.doneAt, { r: int(ln.rounds), s: int(ln.scored) })
    : tpl(Lx.running, { t, r: int(ln.rounds), so: int(s.scoredSoFar), s: int(ln.scored), n: int(s.scoredNow![1] - s.scoredNow![0]), c: int(s.cached) });
  const statusSize = narrow ? TYPE.body : TYPE.small;
  let y = y0 + size;
  for (const line of wrap(status, statusSize, w)) {
    y += statusSize + 5;
    parts.push(text(0, y, line, { "font-size": statusSize, class: "fig-t-muted fig-t-num" }));
  }
  const top = y + 8;
  const pitch = (w - gutter) / per;
  const cell = pitch - 1.6;
  const rowH = cell + 6;
  const rows = Math.ceil(L / per);
  const x = (i: number) => gutter + (i % per) * pitch;
  const yAt = (i: number) => top + Math.floor(i / per) * rowH;
  for (let r = 0; r < rows; r++) {
    parts.push(text(gutter - 5, top + r * rowH + cell - 1, r * per + 1, { "font-size": narrow ? TYPE.body : TYPE.small, "text-anchor": "end", class: "fig-t-faint fig-t-num" }));
  }
  for (let i = 0; i < L; i++) {
    const ra = ln.revealAt[i];
    const xx = x(i), yy = yAt(i);
    if (i >= s.appended) {
      parts.push(el("rect", { x: xx + 0.5, y: yy + 0.5, width: cell - 1, height: cell - 1, rx: 1.5, fill: "none", stroke: C.grid, "stroke-width": 1 }));
    } else if (ra > 0 && ra <= t) {
      parts.push(el("rect", { x: xx, y: yy, width: cell, height: cell, rx: 1.5, fill: ra === t ? C.c2 : C.c1 }));
    } else {
      parts.push(el("rect", { x: xx, y: yy, width: cell, height: cell, rx: 1.5, fill: C.ink3, "fill-opacity": 0.45 }));
    }
  }
  // One mark per row segment of a span of positions.
  const segments = (a: number, b: number, draw: (x0: number, x1: number, yy: number) => string) => {
    for (let i = a; i < b;) {
      const rowEnd = Math.min(b, (Math.floor(i / per) + 1) * per);
      parts.push(draw(x(i), x(rowEnd - 1) + cell, yAt(i)));
      i = rowEnd;
    }
  };
  if (s.scoredNow && s.cached > 0) {
    segments(0, s.cached, (x0, x1, yy) => el("rect", { x: x0, y: yy + cell + 1.5, width: x1 - x0, height: 3, rx: 1, fill: C.c3 }));
  }
  if (s.scoredNow) {
    segments(s.scoredNow[0], s.scoredNow[1], (x0, x1, yy) => el("rect", { x: x0 - 1.5, y: yy - 1.5, width: x1 - x0 + 3, height: cell + 3, rx: 2.5, fill: "none", stroke: C.ink, "stroke-width": 1.4 }));
  }
  return { svg: g({ class: "fig-lane" }, ...parts), h: top - y0 + rows * rowH };
}

// The chapter's two equations for the block lane, with their terms.
function renderEquations(p: P, w: number, y0: number, Lx: Lb): { svg: string; h: number } {
  const ls = lanes(p);
  const k = Math.min(p.rounds, p.block);
  const eqs = [
    tpl(Lx.eqR, { k, l: L, b: p.block, r: ls.bd.rounds }),
    tpl(Lx.eqS, { l: L, k, s: int(ls.bd.scored) }),
  ];
  if (k < p.rounds) eqs.push(tpl(Lx.clamp, { K: p.rounds, k }));
  const parts: string[] = [el("line", { x1: 0, x2: w, y1: y0, y2: y0, stroke: C.grid, "stroke-width": 1 })];
  let y = y0 + 2;
  for (const e of eqs) {
    for (const ln of wrap(e, TYPE.body, w)) {
      y += 17;
      parts.push(text(0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" }));
    }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const t = Math.round(st.t);
  const ls = lanes(p);
  const a = at(ls.ar, t), b = at(ls.bd, t), f = at(ls.full, t);
  return tpl(Lx.describe, {
    t, l: L, a: a.revealed, ac: a.scoredNow ? a.cached : 0,
    b: p.block, k: Math.min(p.rounds, p.block), bv: b.revealed, br: ls.bd.rounds,
    fs: f.done ? tpl(Lx.fullDone, { fr: ls.full.rounds }) : tpl(Lx.fullRunning, { fv: f.revealed, t, fr: ls.full.rounds }),
    fsc: int(f.scoredSoFar),
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = Math.round(st.t);
  const ls = lanes(p);
  const per = narrow ? 32 : 64;
  const gutter = narrow ? 24 : 26;
  const parts: string[] = [];
  const lg = legend([
    { label: Lx.revealed, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.now, swatch: { kind: "rect", fill: C.c2 } },
    { label: Lx.mask, swatch: { kind: "rect", fill: C.ink3, opacity: 0.45 } },
    { label: Lx.scored, swatch: { kind: "rect", fill: "none", stroke: C.ink } },
    { label: Lx.cache, swatch: { kind: "line", stroke: C.c3 } },
  ], 0, 0, w, narrow ? TYPE.body : TYPE.small);
  parts.push(lg.svg);
  let y = lg.height + 4;
  parts.push(text(0, y + 12, tpl(Lx.rows, { l: L, n: per }), { "font-size": narrow ? TYPE.body : TYPE.small, class: "fig-t-faint" }));
  y += 22;
  for (const [ln, title] of [
    [ls.ar, Lx.ar],
    [ls.bd, bdTitle(p, Lx)],
    [ls.full, tpl(Lx.full, { l: L, k: p.rounds })],
  ] as Array<[Lane, string]>) {
    const r = renderLane(ln, t, title, w, y, per, gutter, Lx, narrow);
    parts.push(r.svg);
    y += r.h + (narrow ? 14 : 12);
  }
  const eq = renderEquations(p, w, y, Lx);
  parts.push(eq.svg);
  y += eq.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

function keyframes(p: P, lang: Lang) {
  const Lx = labels[lang];
  const ls = lanes(p);
  const out = new Map<number, string[]>();
  const add = (t: number, s: string) => { const a = out.get(t) ?? []; a.push(s); out.set(t, a); };
  add(0, tpl(Lx.kfStart, { l: L }));
  add(ls.full.rounds, tpl(Lx.kfFull, { k: ls.full.rounds, s: int(ls.full.scored) }));
  const bd = ls.bd;
  if (p.block > 1 && p.block < L) {
    const every = Math.max(1, Math.ceil(bd.blocks / 8));
    for (let j = 1; j < bd.blocks; j++) {
      if (j % every) continue;
      add(j * bd.k, tpl(Lx.kfBlock, { j, n: bd.blocks, b: Math.min(bd.B, L - (j - 1) * bd.B) }));
    }
    add(bd.rounds, tpl(Lx.kfBdDone, { r: bd.rounds }));
  }
  add(L, tpl(Lx.kfAr, { l: L }));
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([t, s]) => ({ t, label: s.join(lang === "zh" ? "；" : "; ") }));
}

export default defineFigure({
  name: "block-diffusion-decode",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    block: {
      kind: "choice", control: "buttons", label: { en: "Block size B", zh: "块大小 B" }, default: 16,
      options: [1, 2, 4, 8, 16, 32, 64, 128].map((b) => ({ value: b, label: { en: String(b), zh: String(b) } })),
    },
    rounds: { kind: "range", label: { en: "Denoising rounds per block K", zh: "每块去噪轮数 K" }, min: 1, max: 16, step: 1, default: 8 },
    seed: { kind: "range", label: { en: "Reveal-order seed", zh: "确定顺序种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  timeline: {
    rate: 8,
    discrete: true,
    duration: () => L,
    keyframes,
    // The full canvas has finished, block diffusion has committed a few
    // blocks, and autoregression is still early.
    poster: (p) => {
      const k = Math.min(p.rounds, p.block);
      return Math.min(L - 1, Math.max(p.rounds + 1, 3 * k));
    },
  },
  render,
  describe,
});
