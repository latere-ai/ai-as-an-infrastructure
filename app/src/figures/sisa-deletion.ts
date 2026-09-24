// SISA deletion cost: how much of a sharded, sliced training run a batch of
// deletion requests forces to be redone (Bourtoule et al., "Machine
// Unlearning", bourtoule2019unlearning).
//
// The training set is split into S disjoint shards; each shard's data into R
// slices. A shard's component model trains in R stages: stage j trains on
// slices 1..j and saves a checkpoint. A request that falls in slice r of a
// shard restarts that shard from the checkpoint before slice r and reruns
// stages r..R; several requests in one shard restart from the earliest of
// them. Cost is counted in example passes, with each stage one pass over the
// data accumulated so far (an illustrative cost model; epochs per stage are
// not modeled). With m examples per slice:
//
//   cost of a restart at slice r   m · Σ_{j=r..R} j = m (R(R+1)/2 − (r−1)r/2)
//   full retraining                S · m R(R+1)/2 = n (R+1)/2
//
// For K requests placed uniformly at random over the n examples, the earliest
// affected slice of one shard satisfies P(earliest ≥ r) = (1 − (r−1)/(SR))^K,
// which gives the exact expected cost. One seeded draw of request positions
// is drawn over the grid; its requests are a prefix of one fixed sequence, so
// raising K adds requests without moving the earlier ones.
//
// The aggregation step is repeated after any retrain and is not counted. The
// accuracy cost of training each component on 1/S of the data is not modeled.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { pct, sig, tpl } from "./lib/format.ts";

type P = { shards: number; slices: number; requests: number; seed: number };

const MAX_K = 1000;
const MAX_DOTS = 400;

// Stage-sum cost of restarting one shard at slice r (1-based), in units of m.
const restart = (r: number, R: number) => (R * (R + 1)) / 2 - ((r - 1) * r) / 2;

export function expectedFraction(S: number, R: number, K: number): number {
  const full = (S * R * (R + 1)) / 2;
  let e = 0;
  for (let r = 1; r <= R; r++) {
    const pr = (1 - (r - 1) / (S * R)) ** K - (1 - r / (S * R)) ** K;
    e += pr * restart(r, R);
  }
  return (S * e) / full;
}

interface Req { shard: number; slice: number; fx: number; fy: number }
const seqMemo = new Map<number, Req[]>();
function sequence(seed: number): Req[] {
  const hit = seqMemo.get(seed);
  if (hit) return hit;
  const u = rng((seed * 2246822519) >>> 0);
  // Positions as fractions of the data; shard and slice follow from S and R.
  const out: Req[] = [];
  for (let i = 0; i < MAX_K; i++) out.push({ shard: u(), slice: u(), fx: u(), fy: u() });
  seqMemo.set(seed, out);
  return out;
}

interface Model {
  S: number; R: number; K: number;
  reqs: Array<{ shard: number; slice: number; fx: number; fy: number }>;
  earliest: number[]; // per shard, 0 = untouched, else 1-based earliest slice
  touched: number; expTouched: number;
  frac: number; expFrac: number;
}

function model(p: P): Model {
  const S = p.shards, R = p.slices, K = Math.max(1, Math.round(p.requests));
  const seq = sequence(p.seed).slice(0, K);
  const reqs = seq.map((q) => ({ shard: Math.min(S - 1, Math.floor(q.shard * S)), slice: Math.min(R - 1, Math.floor(q.slice * R)), fx: q.fx, fy: q.fy }));
  const earliest = new Array<number>(S).fill(0);
  for (const q of reqs) {
    const r = q.slice + 1;
    if (!earliest[q.shard] || r < earliest[q.shard]) earliest[q.shard] = r;
  }
  const full = (S * R * (R + 1)) / 2;
  const cost = earliest.reduce((a, r) => a + (r ? restart(r, R) : 0), 0);
  return {
    S, R, K, reqs, earliest,
    touched: earliest.filter(Boolean).length, expTouched: S * (1 - (1 - 1 / S) ** K),
    frac: cost / full, expFrac: expectedFraction(S, R, K),
  };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Deletion cost under SISA sharding and slicing",
    gridHead: "{S:shard/shards} of {R:slice/slices}, {K:deletion request/deletion requests}",
    shard: "shard {i}",
    sliceAxis: "slices, in training order",
    lgKept: "checkpoint kept",
    lgRedo: "stage retrained",
    lgReq: "deletion request",
    curveHead: "Expected retraining work as requests accumulate",
    curveX: "deletion requests K, processed as one batch",
    curveY: "share of full retraining",
    lgNow: "{S} × {R}",
    lgShardOnly: "{S} shards, no slicing",
    lgDraw: "this draw",
    touched: "{t} of {S} shards retrain; |expected S(1 − (1 − 1/S)^K) = {e}",
    work: "work redone: {f} of full retraining in this draw, {e} expected",
    model: "stage j of a shard trains once on its first j slices; full retraining is (R + 1)/2 passes over the data",
    tradeoff: "each component model trains on 1/S = {s} of the data",
    describe: "{S} shards of {R} slices and {K} deletion requests: {t} of {S} shards retrain, and the batch redoes {f} of the full training work ({e} expected over request positions).",
  },
  zh: {
    title: "SISA 分片与切片下的删除成本",
    gridHead: "{S} 个分片，每片 {R} 个切片，{K} 条删除请求",
    shard: "分片 {i}",
    sliceAxis: "切片（按训练顺序）",
    lgKept: "保留的检查点",
    lgRedo: "需重新训练的阶段",
    lgReq: "删除请求",
    curveHead: "请求累积时的期望重新训练工作量",
    curveX: "删除请求数 K（合为一批处理）",
    curveY: "占完整重新训练的比例",
    lgNow: "{S} × {R}",
    lgShardOnly: "{S} 个分片，不切片",
    lgDraw: "本次抽样",
    touched: "{S} 个分片中有 {t} 个需重新训练；|期望值 S(1 − (1 − 1/S)^K) = {e}",
    work: "重做的工作量：本次抽样为完整重新训练的 {f}，期望为 {e}",
    model: "分片的第 j 个阶段在前 j 个切片上训练一遍；完整重新训练相当于把数据过 (R + 1)/2 遍",
    tradeoff: "每个组件模型只用 1/S = {s} 的数据训练",
    describe: "{S} 个分片、每片 {R} 个切片、{K} 条删除请求：{S} 个分片中有 {t} 个需重新训练，这批请求要重做完整训练工作量的 {f}（按请求位置取期望为 {e}）。",
  },
};
type L = typeof labels.en;

const pc = (v: number) => pct(v, v < 0.1 ? 1 : 0);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, { S: m.S, R: m.R, K: m.K, t: m.touched, f: pc(m.frac), e: pc(m.expFrac) });
}

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

function head(parts: string[], s: string, x0: number, y: number, w: number, lang: Lang): number {
  for (const ln of lines(s, TYPE.label, w, lang, true)) {
    parts.push(text(x0, y + TYPE.label, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += TYPE.label + 5;
  }
  return y;
}

// ---------------------------------------------------------------- panels

function gridPanel(m: Model, L: L, lang: Lang, uid: string, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, tpl(L.gridHead, { S: m.S, R: m.R, K: m.K }), x0, y0, w, lang) + 8;
  const labelW = textWidth(tpl(L.shard, { i: m.S }), size) + 8;
  const gx = x0 + labelW, gw = w - labelW;
  const gap = m.R > 4 ? 2 : 3;
  const cw = (gw - gap * (m.R - 1)) / m.R;
  const rowH = Math.max(11, Math.min(34, Math.floor((narrow ? 200 : 230) / m.S)));
  const rgap = rowH > 16 ? 3 : 1.5;
  const labelEvery = rowH >= size + 2 ? 1 : Math.ceil((size + 4) / rowH);
  for (let i = 0; i < m.S; i++) {
    const ry = y + i * rowH;
    const e = m.earliest[i];
    for (let j = 0; j < m.R; j++) {
      const redo = e > 0 && j + 1 >= e;
      parts.push(el("rect", { x: gx + j * (cw + gap), y: ry, width: cw, height: rowH - rgap, rx: 2, fill: redo ? C.c2 : C.panel, "fill-opacity": redo ? 0.55 : undefined, stroke: redo ? undefined : C.rule, "stroke-width": redo ? undefined : 0.8 }));
    }
    if (i % labelEvery === 0) {
      parts.push(text(gx - 6, ry + (rowH - rgap) / 2 + size * 0.35, tpl(L.shard, { i: i + 1 }), { "font-size": size, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    }
  }
  // Requests, jittered inside their cell; beyond MAX_DOTS the shading carries it.
  const r = rowH > 16 ? 2.6 : 2;
  for (const q of m.reqs.slice(0, MAX_DOTS)) {
    const cx = gx + q.slice * (cw + gap) + r + 1 + q.fx * Math.max(0, cw - 2 * r - 2);
    const cy = y + q.shard * rowH + r + 0.5 + q.fy * Math.max(0, rowH - rgap - 2 * r - 1);
    parts.push(el("circle", { cx, cy, r, fill: C.ink, stroke: C.paper, "stroke-width": 0.8 }));
  }
  y += m.S * rowH + 4;
  parts.push(el("line", { x1: gx, x2: gx + gw, y1: y + 2, y2: y + 2, stroke: C.rule, "stroke-width": 1 }));
  parts.push(el("path", { d: `M${gx + gw},${y + 2}l-6,-3.5v7z`, fill: C.rule }));
  parts.push(text(gx + gw / 2, y + 6 + size, L.sliceAxis, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
  y += size + 14;
  const lg = legend([
    { label: L.lgKept, swatch: { kind: "rect", fill: C.panel, stroke: C.rule } },
    { label: L.lgRedo, swatch: { kind: "rect", fill: C.c2, opacity: 0.55 } },
    { label: L.lgReq, swatch: { kind: "dot", fill: C.ink } },
  ], x0, y, w, size);
  parts.push(lg.svg);
  return { svg: g({}, ...parts), h: y + lg.height - y0 };
}

function curvePanel(m: Model, L: L, lang: Lang, x0: number, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = head(parts, L.curveHead, x0, y0, w, lang) + 26;
  const left = x0 + 40, right = x0 + w - 18;
  const plotH = narrow ? 150 : 170;
  const top = y, base = top + plotH;
  const xs = log([1, MAX_K], [left, right]);
  const ys = linear([0, 1], [base, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: base, grid: [top, base], ticks: [1, 10, 100, 1000], title: L.curveX, size, format: (v) => sig(v, 4) }));
  parts.push(axis({ scale: ys, orient: "left", at: left, grid: [left, right], ticks: [0, 0.25, 0.5, 0.75, 1], title: L.curveY, size, format: (v) => pct(v) }));
  const curve = (S: number, R: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 90; i++) {
      const K = MAX_K ** (i / 90);
      pts.push([xs(K), ys(expectedFraction(S, R, K))]);
    }
    return pts;
  };
  const items = [];
  if (m.R > 1) {
    parts.push(el("path", { d: linePath(curve(m.S, 1)), fill: "none", stroke: C.ink3, "stroke-width": 1.4, "stroke-dasharray": "4 3" }));
    items.push({ label: tpl(L.lgShardOnly, { S: m.S }), swatch: { kind: "line" as const, stroke: C.ink3, dash: "4 3" } });
  }
  parts.push(el("path", { d: linePath(curve(m.S, m.R)), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  items.unshift({ label: tpl(L.lgNow, { S: m.S, R: m.R }), swatch: { kind: "line" as const, stroke: C.ink } });
  const mx = xs(m.K);
  parts.push(el("line", { x1: mx, x2: mx, y1: top, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  parts.push(el("circle", { cx: mx, cy: ys(m.frac), r: 4.5, fill: C.paper, stroke: C.c2, "stroke-width": 2 }));
  parts.push(el("circle", { cx: mx, cy: ys(m.expFrac), r: 4.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  items.push({ label: L.lgDraw, swatch: { kind: "rect" as const, fill: C.paper, stroke: C.c2 } });
  y = base + axisHeight(true, size);
  const lg = legend(items, x0, y, w, size);
  parts.push(lg.svg);
  return { svg: g({}, ...parts), h: y + lg.height - y0 };
}

function readout(m: Model, L: L, lang: Lang, y0: number, w: number, narrow: boolean) {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = y0;
  // Break only between "|"-separated terms; a term wider than the line wraps.
  const put = (s: string, cls: string, sz = size) => {
    const max = w * (cls.includes("strong") ? 0.86 : 0.93);
    const out: string[] = [];
    let cur = "";
    for (const seg of s.split("|")) {
      if (cur && textWidth((cur + seg).trimEnd(), sz) > max) { out.push(cur.trimEnd()); cur = seg; } else cur += seg;
    }
    if (cur) out.push(cur.trimEnd());
    for (const ln0 of out) {
      for (const ln of textWidth(ln0, sz) > max ? lines(ln0, sz, w, lang, cls.includes("strong")) : [ln0]) {
        parts.push(text(0, y + sz, ln, { "font-size": sz, class: cls }));
        y += sz + 5;
      }
    }
    y += 2;
  };
  put(tpl(L.work, { f: pc(m.frac), e: pc(m.expFrac) }), "fig-t-strong fig-t-num", TYPE.body);
  put(tpl(L.touched, { t: m.touched, S: m.S, e: sig(m.expTouched, 3) }), "fig-t-num");
  put(L.model, "fig-t-muted");
  put(tpl(L.tradeoff, { s: pc(1 / m.S) }), "fig-t-muted fig-t-num");
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p);
  const parts: string[] = [];
  let y = 0;
  if (narrow) {
    const a = gridPanel(m, L, lang, st.uid, 0, y, w, true);
    parts.push(a.svg); y += a.h + 18;
    const b = curvePanel(m, L, lang, 0, y, w, true);
    parts.push(b.svg); y += b.h + 16;
  } else {
    const lw = Math.floor(w * 0.52);
    const a = gridPanel(m, L, lang, st.uid, 0, y, lw, false);
    const b = curvePanel(m, L, lang, lw + 26, y, w - lw - 26, false);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 16;
  }
  const ro = readout(m, L, lang, y, w, narrow);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "sisa-deletion",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    shards: {
      kind: "choice", control: "buttons", label: { en: "Shards S", zh: "分片数 S" }, default: 10,
      options: [1, 2, 5, 10, 20].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    slices: {
      kind: "choice", label: { en: "Slices per shard R", zh: "每个分片的切片数 R" }, default: 4,
      options: [1, 2, 4, 8].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    requests: {
      kind: "range", scale: "log", label: { en: "Deletion requests K", zh: "删除请求数 K" }, min: 1, max: MAX_K, default: 5,
    },
    seed: { kind: "range", label: { en: "Request seed", zh: "请求位置种子" }, min: 1, max: 999, step: 1, default: 1, control: false },
  },
  render,
  describe,
});
