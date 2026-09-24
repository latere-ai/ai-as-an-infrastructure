// Prefill and decode on the same two GPUs, placed two ways, over one seeded
// request trace.
//
// Cost model (illustrative, one iteration-level scheduler per GPU):
//   an iteration takes  STEP_BASE + STEP_PER_SEQ · (sequences decoding)
//                       + PREFILL_PER_TOKEN · (prompt tokens prefilled in it)
//   KV cache per prompt token: KV_BYTES (an 8B-class GQA model: 32 layers,
//   8 KV heads of dimension 128, keys and values, 16-bit).
//
// - Co-located: two replicas, requests alternate between them. Each iteration
//   decodes one token for every running sequence and prefills the prompts
//   that are waiting (whole prompts, or at most CHUNK tokens with chunked
//   prefill). A prefill therefore stretches the iteration every decoding
//   sequence on that GPU shares; the stretch is drawn as a stall.
// - Split: one prefill GPU runs prefill-only iterations and samples the first
//   token; the KV cache then crosses one link, first come first served, at the
//   chosen bandwidth; the decode GPU admits the sequence at its next
//   iteration and runs decode-only iterations.
//
// TTFT is arrival to first token; TPOT is (finish − first token) / (tokens − 1),
// so in the split placement the transfer lands in TPOT, on the second token.
// A request meets its objective when TTFT <= SLO_TTFT and TPOT <= SLO_TPOT.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { int, sig, tpl } from "./lib/format.ts";
import { rng, exponential, intBetween } from "./lib/random.ts";

// ---------------------------------------------------------------- model

export const STEP_BASE = 12; // ms
export const STEP_PER_SEQ = 0.25; // ms per decoding sequence
export const PREFILL_PER_TOKEN = 0.05; // ms per prompt token (20,000 tokens/s)
export const KV_BYTES = 32 * 8 * 128 * 2 * 2; // 131,072 bytes per token
const CHUNK = 512;
const REQUESTS = 12;
export const SLO_TTFT = 400; // ms
export const SLO_TPOT = 20; // ms

type P = { rate: number; prompt: number; bw: number; chunk: boolean; seed: number };

interface Req { id: number; arrival: number; prompt: number; out: number; gpu: number }

// Phases of one request, as intervals in ms.
export interface Life {
  req: Req;
  prefillStart: number;
  first: number; // first token
  xferStart: number; xferEnd: number; // split only (equal to first when co-located)
  decodeStart: number;
  finish: number;
  stalls: Array<[number, number]>; // co-located: stretch of iterations this sequence waited through
  ttft: number; tpot: number; maxGap: number;
}

export interface Ev { t: number; kind: "stall" | "handoff"; req: number; gpu: number; n: number; ms: number; mb: number }
export interface Placement { lives: Life[]; events: Ev[]; end: number }

function trace(p: P): Req[] {
  const u = rng(p.seed);
  const reqs: Req[] = [];
  let t = 20;
  for (let i = 0; i < REQUESTS; i++) {
    if (i > 0) t += exponential(u(), p.rate / 1000);
    const prompt = Math.round(p.prompt * (0.5 + u()));
    const out = intBetween(u(), 48, 96);
    reqs.push({ id: i + 1, arrival: t, prompt, out, gpu: i % 2 });
  }
  return reqs;
}

interface Seq { life: Life; left: number; done: number; tokens: number[] } // left: prompt tokens still to prefill

function blank(req: Req): Life {
  return { req, prefillStart: -1, first: -1, xferStart: -1, xferEnd: -1, decodeStart: -1, finish: -1, stalls: [], ttft: 0, tpot: 0, maxGap: 0 };
}

function finishStats(l: Life, tokens: number[]) {
  l.ttft = l.first - l.req.arrival;
  l.tpot = (l.finish - l.first) / Math.max(1, l.req.out - 1);
  let gap = 0;
  for (let i = 1; i < tokens.length; i++) gap = Math.max(gap, tokens[i] - tokens[i - 1]);
  l.maxGap = gap;
}

// One GPU running iterations that mix decode and prefill.
function colocatedGpu(reqs: Req[], chunk: boolean, events: Ev[], gpu: number): Life[] {
  const lives: Life[] = [];
  const waiting: Seq[] = [];
  const running: Seq[] = []; // decoding
  let next = 0, t = 0;
  while (next < reqs.length || waiting.length || running.length) {
    if (!waiting.length && !running.length) t = Math.max(t, reqs[next].arrival);
    while (next < reqs.length && reqs[next].arrival <= t) {
      const life = blank(reqs[next]);
      lives.push(life);
      waiting.push({ life, left: reqs[next].prompt, done: 0, tokens: [] });
      next++;
    }
    // Prefill work in this iteration, first come first served.
    let budget = chunk ? CHUNK : Infinity;
    const pre: Array<[Seq, number]> = [];
    for (const s of waiting) {
      if (budget <= 0) break;
      const k = Math.min(s.left, budget);
      pre.push([s, k]); budget -= k;
      if (s.life.prefillStart < 0) s.life.prefillStart = t;
    }
    const tokens = pre.reduce((a, [, k]) => a + k, 0);
    const pure = STEP_BASE + STEP_PER_SEQ * running.length;
    const dur = pure + PREFILL_PER_TOKEN * tokens;
    const end = t + dur;
    // Decoding sequences get their token at the end of the (stretched) iteration.
    for (const s of running) {
      if (tokens > 0) s.life.stalls.push([t + pure, end]);
      s.tokens.push(end); s.done++;
    }
    if (tokens > 0 && running.length) {
      events.push({ t: end, kind: "stall", req: pre[0][0].life.req.id, gpu, n: running.length, ms: dur - pure, mb: 0 });
    }
    for (let i = running.length - 1; i >= 0; i--) {
      const s = running[i];
      if (s.done >= s.life.req.out) { s.life.finish = end; finishStats(s.life, s.tokens); running.splice(i, 1); }
    }
    for (const [s, k] of pre) {
      s.left -= k;
      if (s.left === 0) {
        waiting.splice(waiting.indexOf(s), 1);
        s.life.first = end; s.life.xferStart = s.life.xferEnd = s.life.decodeStart = end;
        s.tokens.push(end); s.done = 1;
        running.push(s);
      }
    }
    t = end;
  }
  return lives;
}

function colocated(reqs: Req[], chunk: boolean): Placement {
  const events: Ev[] = [];
  const lives = [0, 1].flatMap((gpu) => colocatedGpu(reqs.filter((r) => r.gpu === gpu), chunk, events, gpu));
  lives.sort((a, b) => a.req.id - b.req.id);
  events.sort((a, b) => a.t - b.t);
  return { lives, events, end: Math.max(...lives.map((l) => l.finish)) };
}

function split(reqs: Req[], bwGBs: number): Placement {
  const events: Ev[] = [];
  const lives = reqs.map(blank);
  const byId = new Map(lives.map((l) => [l.req.id, l]));
  // Prefill GPU: prefill-only iterations over every waiting prompt.
  let t = 0, next = 0;
  const waiting: Req[] = [];
  const ready: Life[] = [];
  while (next < reqs.length || waiting.length) {
    if (!waiting.length) t = Math.max(t, reqs[next].arrival);
    while (next < reqs.length && reqs[next].arrival <= t) waiting.push(reqs[next++]);
    const tokens = waiting.reduce((a, r) => a + r.prompt, 0);
    const end = t + STEP_BASE + PREFILL_PER_TOKEN * tokens;
    for (const r of waiting) { const l = byId.get(r.id)!; l.prefillStart = t; l.first = end; ready.push(l); }
    waiting.length = 0;
    t = end;
  }
  // The link, first come first served.
  let link = 0;
  for (const l of ready.sort((a, b) => a.first - b.first || a.req.id - b.req.id)) {
    l.xferStart = Math.max(l.first, link);
    const ms = (l.req.prompt * KV_BYTES) / (bwGBs * 1e9) * 1000;
    l.xferEnd = l.xferStart + ms;
    link = l.xferEnd;
    events.push({ t: l.xferEnd, kind: "handoff", req: l.req.id, gpu: 1, n: 0, ms, mb: (l.req.prompt * KV_BYTES) / 1e6 });
  }
  // Decode GPU: decode-only iterations; a sequence joins at the next one.
  const arrivals = [...ready].sort((a, b) => a.xferEnd - b.xferEnd);
  const running: Seq[] = [];
  let i = 0;
  t = 0;
  while (i < arrivals.length || running.length) {
    if (!running.length) t = Math.max(t, arrivals[i].xferEnd);
    while (i < arrivals.length && arrivals[i].xferEnd <= t) {
      const l = arrivals[i++];
      l.decodeStart = t;
      running.push({ life: l, left: 0, done: 1, tokens: [l.first] });
    }
    const end = t + STEP_BASE + STEP_PER_SEQ * running.length;
    for (let k = running.length - 1; k >= 0; k--) {
      const s = running[k];
      s.tokens.push(end); s.done++;
      if (s.done >= s.life.req.out) { s.life.finish = end; finishStats(s.life, s.tokens); running.splice(k, 1); }
    }
    t = end;
  }
  events.sort((a, b) => a.t - b.t);
  return { lives, events, end: Math.max(...lives.map((l) => l.finish)) };
}

const memo = new Map<string, { co: Placement; sp: Placement; end: number }>();
export function sim(p: P) {
  const key = `${p.rate}|${p.prompt}|${p.bw}|${p.chunk}|${p.seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const reqs = trace(p);
    const co = colocated(reqs, p.chunk);
    const sp = split(reqs, p.bw);
    hit = { co, sp, end: Math.max(co.end, sp.end) };
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Prefill and decode placement",
    coTitle: "Co-located: each GPU runs prefill and decode",
    spTitle: "Split: one prefill GPU, one link, one decode GPU",
    gpu: "GPU {g}",
    lgQueue: "waiting",
    lgPrefill: "prefill",
    lgXfer: "KV transfer",
    lgDecode: "decode",
    lgStall: "decode waits on a prefill",
    lgMet: "met both objectives",
    lgMiss: "missed one",
    x: "time since the first arrival (s)",
    cursor: "{t} s",
    readout: "At {t} s, over finished requests",
    colCo: "co-located",
    colSp: "split",
    mDone: "finished",
    mTtft: "TTFT, median / worst",
    mTpot: "TPOT, median / worst",
    mGap: "longest wait between tokens",
    mMet: "met both objectives",
    slo: "Objectives: TTFT ≤ {a} ms and TPOT ≤ {b} ms. Cost model and trace are illustrative.",
    none: "–",
    evStall: "GPU {g}: prefilling R{i} stretches one iteration by {ms} ms, and {n:decoding request waits/decoding requests wait} that long for the next token",
    evHandoff: "Split: R{i}'s KV cache, {mb} MB, reaches the decode GPU after {ms} ms on the link",
    describe: "At {t} s. Co-located: {c1} of {n} requests finished, {c2} met both objectives, longest wait between tokens {c3} ms. Split: {s1} finished, {s2} met both, longest wait {s3} ms.",
  },
  zh: {
    title: "预填充与解码的放置",
    coTitle: "同地部署：每块 GPU 同时做预填充和解码",
    spTitle: "拆分部署：预填充 GPU、传输链路、解码 GPU",
    gpu: "GPU {g}",
    lgQueue: "等待",
    lgPrefill: "预填充",
    lgXfer: "KV 传输",
    lgDecode: "解码",
    lgStall: "解码等待预填充",
    lgMet: "两项目标都达到",
    lgMiss: "有一项未达到",
    x: "自第一个请求到达起的时间（秒）",
    cursor: "{t} 秒",
    readout: "{t} 秒时，已完成请求的统计",
    colCo: "同地",
    colSp: "拆分",
    mDone: "已完成",
    mTtft: "TTFT，中位数 / 最差",
    mTpot: "TPOT，中位数 / 最差",
    mGap: "词元之间的最长等待",
    mMet: "两项目标都达到",
    slo: "目标：TTFT ≤ {a} ms，TPOT ≤ {b} ms。成本模型与请求序列均为示意。",
    none: "–",
    evStall: "GPU {g}：为 R{i} 做预填充让一次迭代延长 {ms} ms，{n} 个正在解码的请求都要多等这么久才拿到下一个词元",
    evHandoff: "拆分部署：R{i} 的 KV 缓存共 {mb} MB，在链路上传输 {ms} ms 后到达解码 GPU",
    describe: "{t} 秒时。同地部署：{n} 个请求中完成 {c1} 个，其中 {c2} 个两项目标都达到，词元之间最长等待 {c3} ms。拆分部署：完成 {s1} 个，{s2} 个达标，最长等待 {s3} ms。",
  },
};
type L = typeof labels.en;

const secs = (ms: number) => (ms / 1000).toFixed(2);
const msf = (ms: number) => (ms >= 100 ? int(ms) : sig(ms, 3));

function met(l: Life): boolean { return l.ttft <= SLO_TTFT && l.tpot <= SLO_TPOT; }

function stats(pl: Placement, t: number) {
  const done = pl.lives.filter((l) => l.finish <= t);
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : NaN);
  return {
    done: done.length,
    ttft: [med(done.map((l) => l.ttft)), max(done.map((l) => l.ttft))],
    tpot: [med(done.map((l) => l.tpot)), max(done.map((l) => l.tpot))],
    gap: max(done.map((l) => l.maxGap)),
    met: done.filter(met).length,
  };
}

function eventLabel(e: Ev, L: L): string {
  return e.kind === "stall"
    ? tpl(L.evStall, { g: e.gpu + 1, i: e.req, ms: msf(e.ms), n: e.n })
    : tpl(L.evHandoff, { i: e.req, mb: int(e.mb), ms: sig(e.ms, 3) });
}

const COL = { prefill: C.c1, xfer: C.c3, stall: C.c2 };

function lanes(pl: Placement, groups: Array<{ name: string | null; ids: number[] }>, x: (v: number) => number, t: number, y0: number, w: number, labelW: number): { svg: string; h: number } {
  const parts: string[] = [];
  const rowH = 13, barH = 9;
  let y = y0;
  const byId = new Map(pl.lives.map((l) => [l.req.id, l]));
  const clip = (a: number, b: number) => [Math.min(a, t), Math.min(b, t)] as const;
  const bar = (a: number, b: number, yy: number, fill: string, op?: number) => {
    const [c0, c1] = clip(a, b);
    if (c1 > c0) parts.push(el("rect", { x: x(c0), y: yy, width: Math.max(0.8, x(c1) - x(c0)), height: barH, fill, "fill-opacity": op }));
  };
  const wait = (a: number, b: number, yy: number) => {
    const [c0, c1] = clip(a, b);
    if (c1 > c0) parts.push(el("line", { x1: x(c0), x2: x(c1), y1: yy + barH / 2, y2: yy + barH / 2, stroke: C.ink3, "stroke-width": 1.25 }));
  };
  for (const grp of groups) {
    if (grp.name) { parts.push(text(0, y + 11, grp.name, { "font-size": TYPE.body, class: "fig-t-muted" })); y += 16; }
    for (const id of grp.ids) {
      const l = byId.get(id)!;
      const yy = y + (rowH - barH) / 2;
      parts.push(text(labelW - 6, y + rowH - 2, `R${id}`, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
      if (l.req.arrival <= t) {
        parts.push(el("line", { x1: x(l.req.arrival), x2: x(l.req.arrival), y1: yy - 1, y2: yy + barH + 1, stroke: C.ink2, "stroke-width": 1 }));
        wait(l.req.arrival, l.prefillStart, yy);
        bar(l.prefillStart, l.first, yy, COL.prefill);
        wait(l.first, l.xferStart, yy);
        bar(l.xferStart, l.xferEnd, yy, COL.xfer);
        wait(l.xferEnd, l.decodeStart, yy);
        bar(l.decodeStart, l.finish, yy, COL.prefill, 0.3);
        for (const [a, b] of l.stalls) bar(a, b, yy, COL.stall);
        if (l.finish <= t) {
          const ok = met(l);
          parts.push(el("circle", { cx: x(l.finish) + 5, cy: yy + barH / 2, r: 3.5, fill: ok ? C.good : C.paper, stroke: ok ? C.good : C.bad, "stroke-width": ok ? 0 : 1.75 }));
        }
      }
      y += rowH;
    }
    y += 4;
  }
  void w;
  return { svg: g({ class: "fig-lanes" }, ...parts), h: y - y0 };
}

function legendRow(L: L, w: number, y0: number): { svg: string; h: number } {
  const items: Array<[string, (x: number, y: number) => string]> = [
    [L.lgQueue, (x, y) => el("line", { x1: x, x2: x + 14, y1: y, y2: y, stroke: C.ink3, "stroke-width": 1.5 })],
    [L.lgPrefill, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: COL.prefill })],
    [L.lgXfer, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: COL.xfer })],
    [L.lgDecode, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: COL.prefill, "fill-opacity": 0.3 })],
    [L.lgStall, (x, y) => el("rect", { x, y: y - 5, width: 14, height: 9, fill: COL.stall })],
    [L.lgMet, (x, y) => el("circle", { cx: x + 5, cy: y, r: 3.5, fill: C.good })],
    [L.lgMiss, (x, y) => el("circle", { cx: x + 5, cy: y, r: 3.5, fill: C.paper, stroke: C.bad, "stroke-width": 1.75 })],
  ];
  const parts: string[] = [];
  let lx = 0, ly = y0 + 12;
  for (const [name, sw] of items) {
    const iw = 20 + textWidth(name, TYPE.body);
    if (lx > 0 && lx + iw > w) { lx = 0; ly += 20; }
    parts.push(sw(lx, ly - 4), text(lx + 20, ly, name, { "font-size": TYPE.body }));
    lx += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: ly - y0 + 10 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const r = sim(st.p);
  const t = st.t;
  const a = stats(r.co, t), b = stats(r.sp, t);
  const gap = (v: number) => (Number.isFinite(v) ? msf(v) : L.none);
  return tpl(L.describe, { t: secs(t), n: REQUESTS, c1: a.done, c2: a.met, c3: gap(a.gap), s1: b.done, s2: b.met, s3: gap(b.gap) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = sim(p);
  const t = Math.min(st.t, r.end);
  const labelW = 34;
  const x = linear([0, r.end * 1.04], [labelW, w - 8]);
  const parts: string[] = [];
  const lg = legendRow(L, w, 0);
  parts.push(lg.svg);
  let y = lg.h + 8;
  const cursorY = y + 12; // the cursor's time is named on its own line above the panels
  y += 20;

  const ids = (gpu: number | null) => r.co.lives.filter((l) => gpu == null || l.req.gpu === gpu).map((l) => l.req.id);
  const panelSpan: Array<[number, number]> = [];
  const title = (s0: string) => {
    for (const ln of wrap(s0, TYPE.label, w)) { parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
    y += 4;
  };
  title(L.coTitle);
  const co = lanes(r.co, [{ name: tpl(L.gpu, { g: 1 }), ids: ids(0) }, { name: tpl(L.gpu, { g: 2 }), ids: ids(1) }], x, t, y, w, labelW);
  parts.push(co.svg); panelSpan.push([y, y + co.h - 4]); y += co.h + 10;
  title(L.spTitle);
  const sp = lanes(r.sp, [{ name: null, ids: ids(null) }], x, t, y, w, labelW);
  parts.push(sp.svg); panelSpan.push([y - 2, y + sp.h]); y += sp.h;

  // Cursor through both panels, and the shared time axis.
  const cx = x(t);
  for (const [a, b] of panelSpan) parts.push(el("line", { x1: cx, x2: cx, y1: a, y2: b, stroke: C.ink, "stroke-width": 1.25 }));
  const ticks = x.ticks(narrow ? 4 : 8).filter((v) => v <= r.end * 1.04);
  parts.push(axis({ scale: x, orient: "bottom", at: y + 2, ticks, format: (v) => secs(v), title: L.x, size: TYPE.body }));
  const cl = tpl(L.cursor, { t: secs(t) });
  const clw = textWidth(cl, TYPE.body);
  parts.push(text(Math.min(Math.max(cx, labelW + clw / 2), w - clw / 2), cursorY, cl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));

  y += 2 + axisHeight(true, TYPE.body) + 12;

  // Readout: the two placements side by side at the cursor.
  const a = stats(r.co, t), b = stats(r.sp, t);
  const f = (v: number) => (Number.isFinite(v) ? msf(v) : L.none);
  const rows: Array<[string, string, string]> = [
    [L.mDone, `${a.done} / ${REQUESTS}`, `${b.done} / ${REQUESTS}`],
    [L.mTtft, `${f(a.ttft[0])} / ${f(a.ttft[1])} ms`, `${f(b.ttft[0])} / ${f(b.ttft[1])} ms`],
    [L.mTpot, `${f(a.tpot[0])} / ${f(a.tpot[1])} ms`, `${f(b.tpot[0])} / ${f(b.tpot[1])} ms`],
    [L.mGap, `${f(a.gap)} ms`, `${f(b.gap)} ms`],
    [L.mMet, `${a.met} / ${a.done}`, `${b.met} / ${b.done}`],
  ];
  const colW = Math.max(textWidth("888 / 8,888 ms", TYPE.body), textWidth(L.colCo, TYPE.body)) + 12;
  const xB = w, xA = w - colW;
  const head = tpl(L.readout, { t: secs(t) });
  if (textWidth(head, TYPE.body) + 12 > xA - colW) {
    // No room beside the column heads: the title takes its own line.
    parts.push(text(0, y + 13, head, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
    y += 20;
  } else parts.push(text(0, y + 13, head, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  parts.push(text(xA, y + 13, L.colCo, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(xB, y + 13, L.colSp, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 20;
  for (const [name, va, vb] of rows) {
    parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(0, y + 14, name, { "font-size": TYPE.body }));
    parts.push(text(xA, y + 14, va, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(xB, y + 14, vb, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += 20;
  }
  parts.push(el("line", { x1: 0, x2: xB, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 17;
  for (const ln of wrap(tpl(L.slo, { a: SLO_TTFT, b: SLO_TPOT }), TYPE.body, w)) {
    parts.push(text(0, y, ln, { "font-size": TYPE.body, class: "fig-t-muted" }));
    y += 17;
  }
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "pd-placement",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    rate: { kind: "range", label: { en: "Arrival rate", zh: "到达率" }, unit: { en: "req/s", zh: "个/秒" }, min: 1, max: 16, step: 0.5, default: 6 },
    prompt: { kind: "range", scale: "log", label: { en: "Mean prompt", zh: "平均提示长度" }, unit: { en: "tokens", zh: "个词元" }, min: 256, max: 8192, default: 2000 },
    bw: { kind: "range", scale: "log", label: { en: "KV link bandwidth", zh: "KV 传输带宽" }, unit: { en: "GB/s", zh: "GB/s" }, min: 0.5, max: 100, default: 25 },
    chunk: { kind: "toggle", label: { en: "Chunked prefill when co-located", zh: "同地部署使用分块预填充" }, default: false },
    seed: { kind: "range", label: { en: "Trace seed", zh: "请求序列种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  timeline: {
    rate: 400, // simulated ms per second of playback
    // Positions are milliseconds; the readout uses the cursor's seconds.
    unit: { symbol: { en: "s", zh: "秒" }, value: (t) => secs(t) },
    duration: (p) => Math.ceil(sim(p).end),
    keyframes: (p, lang) => {
      const L = labels[lang];
      const r = sim(p);
      const dur = Math.ceil(r.end);
      return [...r.co.events, ...r.sp.events].sort((a, b) => a.t - b.t).map((e) => ({ t: Math.min(dur, Math.ceil(e.t)), label: eventLabel(e, L) }));
    },
    // The end: the lanes are cumulative, so every stall and handoff is drawn
    // and the readout covers all requests.
    poster: (p) => Math.ceil(sim(p).end),
  },
  render,
  describe,
});
