// Separately launched runs that share one writable surface form one channel.
//
// R runs start at staggered times on shared infrastructure. No run is given
// another's address and none has a network path to another; each can write
// entries to one shared surface (a cache, a scratch store, an index) and
// read what is there. A run that reads an entry another run wrote has
// received a message from it, so the surface is a message bus. Whether an
// entry is still there when a later run looks depends on retention:
//
// - kept until something clears it: entries outlive the run that wrote them,
//   and a run started after the writer ended still reads them;
// - cleared when the writing run ends: only runs alive at the same time connect;
// - one namespace per run: a run reads only its own entries, and no channel forms.
//
// The matrix records, for each ordered pair (writer, reader), whether the
// reader ever read the writer's entries, and whether every such read came after
// the writer had ended (state that re-entered a later run). The schedule is
// seeded and illustrative; state is a pure function of the parameters and t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, CATEGORICAL, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

type Retention = "kept" | "writer" | "namespace";
type P = { runs: number; retention: Retention; outside: boolean; seed: number };

interface Run { id: number; start: number; end: number; writes: number[]; reads: number[] }
interface Entry { writer: number; at: number; until: number; slot: number }
interface Read { reader: number; at: number; entries: number[] } // indices into entries, other writers only

interface World { runs: Run[]; entries: Entry[]; reads: Read[]; T: number }

const R_MAX = 8;
const round1 = (v: number) => Math.round(v * 10) / 10;

// The launch schedule depends only on the run count and the seed, so changing
// retention replays the same runs.
function schedule(n: number, seed: number): { runs: Run[]; T: number } {
  const u = rng(seed);
  const runs: Run[] = [];
  const spacing = 20 / n;
  for (let i = 0; i < n; i++) {
    const start = round1(i * spacing + u() * spacing * 0.6);
    const dur = round1(3.5 + u() * 4.5);
    const end = round1(start + dur);
    const writes = [round1(start + dur * (0.15 + u() * 0.3)), round1(start + dur * (0.55 + u() * 0.35))];
    const reads = [round1(start + 0.3), round1(start + dur * (0.35 + u() * 0.2)), round1(start + dur * (0.8 + u() * 0.15))];
    runs.push({ id: i + 1, start, end, writes, reads });
  }
  const T = Math.ceil(Math.max(...runs.map((r) => r.end)) + 1);
  return { runs, T };
}

const worlds = new Map<string, World>();
function world(p: P): World {
  const key = `${p.runs}|${p.retention}|${p.seed}`;
  const hit = worlds.get(key);
  if (hit) return hit;
  const { runs, T } = schedule(p.runs, p.seed);
  const raw = runs.flatMap((r) => r.writes.map((at) => ({ writer: r.id, at, until: p.retention === "writer" ? r.end : T })));
  raw.sort((a, b) => a.at - b.at);
  // Slots: each entry takes the lowest row free at its write time.
  const slotFree: number[] = [];
  const entries: Entry[] = raw.map((e) => {
    let slot = slotFree.findIndex((f) => f <= e.at);
    if (slot < 0) { slot = slotFree.length; slotFree.push(0); }
    slotFree[slot] = e.until;
    return { ...e, slot };
  });
  const reads: Read[] = [];
  for (const r of runs) {
    for (const at of r.reads) {
      const seen = p.retention === "namespace" ? [] : entries.map((e, i) => (e.writer !== r.id && e.at < at && e.until > at ? i : -1)).filter((i) => i >= 0);
      reads.push({ reader: r.id, at, entries: seen });
    }
  }
  reads.sort((a, b) => a.at - b.at);
  const w: World = { runs, entries, reads, T };
  if (worlds.size > 24) worlds.clear();
  worlds.set(key, w);
  return w;
}

// Channel state at time t: 0 none, 1 read while the writer ran, 2 read only after the writer ended.
function channels(w: World, t: number): number[][] {
  const n = w.runs.length;
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const rd of w.reads) {
    if (rd.at > t) break;
    for (const i of rd.entries) {
      const e = w.entries[i];
      const alive = w.runs[e.writer - 1].end > rd.at;
      const cur = m[e.writer - 1][rd.reader - 1];
      m[e.writer - 1][rd.reader - 1] = alive ? 1 : cur === 1 ? 1 : 2;
    }
  }
  return m;
}

function counts(m: number[][]) {
  let any = 0, after = 0;
  for (const row of m) for (const v of row) { if (v) any++; if (v === 2) after++; }
  return { any, after };
}

const labels = {
  en: {
    title: "Runs that share a writable surface",
    runs: "Separately launched runs",
    run: "run {i}",
    surface: "Shared writable surface",
    outside: "outside the cluster",
    axis: "time (h)",
    now: "t = {t} h",
    write: "writes an entry",
    read: "reads the surface",
    live: "read while the writer runs",
    left: "read after the writer ended",
    matrix: "Who read whom",
    axes: "rows write, columns read",
    mLive: "while the writer ran",
    mLeft: "only after the writer ended",
    rPairs: "{a} of {n} ordered pairs of runs have a channel through the surface; {b} of them only through entries whose writer had already ended.",
    rNone: "Each run reads only its own namespace, so no two runs connect.",
    rOut: "The surface also reaches outside the cluster: it is a message bus and an egress path.",
    rIn: "The surface has no outside reach: it is a message bus only.",
    kStart: "Run {i} starts",
    kFirst: "Run {r} reads an entry from run {w}: the surface now carries messages",
    kLeft: "Run {r} reads an entry left by run {w}, which has ended",
    kEnd: "The last run ends; {k:entry remains/entries remain} on the surface",
    describe: "At {t} h, {s} of {n} runs have started. {pairs}{out}",
  },
  zh: {
    title: "共用一块可写面的多次运行",
    runs: "各自独立启动的运行",
    run: "运行 {i}",
    surface: "共享的可写面",
    outside: "集群之外",
    axis: "时间（小时）",
    now: "t = {t} 小时",
    write: "写入一条记录",
    read: "读取共享面",
    live: "写入者仍在运行时读取",
    left: "写入者结束后读取",
    matrix: "谁读到了谁",
    axes: "行为写入者，列为读取者",
    mLive: "写入者运行期间",
    mLeft: "仅在写入者结束之后",
    rPairs: "{n} 个有序运行对中，有 {a} 对经由共享面形成了通道；其中 {b} 对只经由写入者已经结束的记录相连。",
    rNone: "每次运行只读自己的命名空间，任何两次运行之间都没有连通。",
    rOut: "这块面还能连到集群之外：它既是消息总线，也是外发通路。",
    rIn: "这块面连不到外部：它只是消息总线。",
    kStart: "运行 {i} 启动",
    kFirst: "运行 {r} 读到运行 {w} 写下的记录：共享面开始传递消息",
    kLeft: "运行 {r} 读到已经结束的运行 {w} 留下的记录",
    kEnd: "最后一次运行结束，共享面上还留着 {k} 条记录",
    describe: "{t} 小时时，{n} 次运行中已有 {s} 次启动。{pairs}{out}",
  },
};
type L = typeof labels.en;

function keyframes(p: P, lang: Lang) {
  const Lx = labels[lang];
  const w = world(p);
  const ks: Array<{ t: number; label: string }> = w.runs.map((r) => ({ t: r.start, label: tpl(Lx.kStart, { i: r.id }) }));
  let first = false, left = false;
  for (const rd of w.reads) {
    for (const i of rd.entries) {
      const e = w.entries[i];
      const ended = w.runs[e.writer - 1].end <= rd.at;
      if (!first) { first = true; ks.push({ t: rd.at, label: tpl(Lx.kFirst, { r: rd.reader, w: e.writer }) }); }
      if (ended && !left) { left = true; ks.push({ t: rd.at, label: tpl(Lx.kLeft, { r: rd.reader, w: e.writer }) }); }
    }
  }
  const end = Math.max(...w.runs.map((r) => r.end));
  ks.push({ t: end, label: tpl(Lx.kEnd, { k: w.entries.filter((e) => e.until > end).length }) });
  ks.sort((a, b) => a.t - b.t);
  return ks.filter((k, i) => i === 0 || k.t > ks[i - 1].t);
}

// Open on the read that picks up the most entries left by runs that had
// ended; without retention, on the read that sees the most entries at all.
function poster(p: P): number {
  const w = world(p);
  let best = -1, at = w.T;
  for (const rd of w.reads) {
    const left = rd.entries.filter((i) => w.runs[w.entries[i].writer - 1].end <= rd.at).length;
    const score = left * 100 + rd.entries.length;
    if (rd.entries.length && score > best) { best = score; at = rd.at; }
  }
  return at;
}

function readoutLines(p: P, m: number[][], Lx: L): string[] {
  const n = p.runs;
  const c = counts(m);
  return [
    p.retention === "namespace" ? Lx.rNone : tpl(Lx.rPairs, { a: c.any, n: n * (n - 1), b: c.after }),
    p.outside ? Lx.rOut : Lx.rIn,
  ];
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = world(p);
  const t = Math.min(st.t, w.T);
  const m = channels(w, t);
  const [pairs, out] = readoutLines(p, m, Lx);
  return tpl(Lx.describe, { t: fixed(t, 1), s: w.runs.filter((r) => r.start <= t).length, n: p.runs, pairs: lang === "zh" ? pairs : pairs + " ", out });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const width = st.w;
  const narrow = width < 480;
  const w = world(p);
  const t = Math.min(st.t, w.T);
  const n = p.runs;
  const hatchId = `${st.uid}-left`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.warn, 4, 1.4))];

  // ---- lanes and the surface, on one time axis
  const laneW = narrow ? width : Math.floor(width * 0.64);
  const labelW = Math.max(...w.runs.map((r) => textWidth(tpl(Lx.run, { i: r.id }), TYPE.body))) + 10;
  const x = linear([0, w.T], [labelW, laneW - 6]);
  const cl = tpl(Lx.now, { t: fixed(t, 1) });
  parts.push(text(0, 14, Lx.runs, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const laneH = 17;
  const top = 40; // title row, then the cursor label row
  const col = (id: number) => CATEGORICAL[(id - 1) % CATEGORICAL.length];
  w.runs.forEach((r, k) => {
    const y = top + k * laneH;
    parts.push(text(0, y + 12, tpl(Lx.run, { i: r.id }), { "font-size": TYPE.body, class: r.start <= t ? "fig-t-muted" : "fig-t-faint" }));
    parts.push(el("rect", { x: x(0), y: y + 3, width: x(w.T) - x(0), height: 11, rx: 2, fill: C.panel }));
    if (t >= r.start) parts.push(el("rect", { x: x(r.start), y: y + 3, width: Math.max(1, x(Math.min(t, r.end)) - x(r.start)), height: 11, rx: 2, fill: col(r.id), "fill-opacity": 0.5 }));
    for (const at of r.writes) if (at <= t) parts.push(el("path", { d: `M${x(at) - 4},${y + 9}L${x(at) + 4},${y + 9}L${x(at)},${y + 16}Z`, fill: C.ink }));
    for (const at of r.reads) if (at <= t) parts.push(el("circle", { cx: x(at), cy: y + 8.5, r: 3, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  });
  const lanesBottom = top + n * laneH;

  // The surface: one thin row per entry slot, from its write to its removal.
  const sTop = lanesBottom + 30;
  parts.push(text(0, sTop - 10, Lx.surface, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const slots = Math.max(1, ...w.entries.map((e) => e.slot + 1));
  const slotH = Math.max(4, Math.min(7, 70 / slots));
  const sH = slots * slotH + 6;
  parts.push(el("rect", { x: x(0), y: sTop, width: x(w.T) - x(0), height: sH, rx: 3, fill: C.panel }));
  const slotY = (s: number) => sTop + 3 + s * slotH;
  w.entries.forEach((e) => {
    if (e.at > t) return;
    parts.push(el("rect", { x: x(e.at), y: slotY(e.slot) + 0.5, width: Math.max(1, x(Math.min(t, e.until)) - x(e.at)), height: slotH - 1.5, rx: 1, fill: col(e.writer) }));
  });
  if (p.outside) {
    const ax = x(w.T) - 2;
    const ay = sTop + sH + 8;
    parts.push(el("path", { d: `M${ax - 50},${sTop + sH}L${ax - 50},${ay}L${ax},${ay}`, fill: "none", stroke: C.ink2, "stroke-width": 1.5 }));
    parts.push(el("path", { d: `M${ax},${ay}L${ax - 6},${ay - 4}L${ax - 6},${ay + 4}Z`, fill: C.ink2 }));
    parts.push(text(ax - 56, ay + 8, Lx.outside, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  }

  // The latest read at or before t: connectors from each entry it saw to the reader.
  const recent = [...w.reads].reverse().find((rd) => rd.at <= t && t - rd.at <= 1.2 && rd.entries.length);
  if (recent) {
    const rx = x(recent.at);
    const ry = top + (recent.reader - 1) * laneH + 8.5;
    for (const i of recent.entries) {
      const e = w.entries[i];
      const ended = w.runs[e.writer - 1].end <= recent.at;
      parts.push(el("line", { x1: rx, x2: rx, y1: slotY(e.slot) + slotH / 2, y2: ry + 3, stroke: ended ? C.warn : C.ink, "stroke-width": 1.5, "stroke-dasharray": ended ? "3 2" : undefined }));
      parts.push(el("circle", { cx: rx, cy: slotY(e.slot) + slotH / 2, r: 2.2, fill: ended ? C.warn : C.ink }));
    }
  }

  // Cursor and axis.
  const cx = x(t);
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 2, y2: sTop + sH + 2, stroke: C.ink3, "stroke-width": 1 }));
  const clw = textWidth(cl, TYPE.body);
  parts.push(text(Math.min(Math.max(cx, labelW + clw / 2), laneW - clw / 2 - 2), 33, cl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  const axisAt = sTop + sH + (p.outside ? 30 : 6);
  parts.push(axis({ scale: x, orient: "bottom", at: axisAt, ticks: x.ticks(narrow ? 4 : 6), title: Lx.axis, size: TYPE.body }));
  let yLeft = axisAt + axisHeight(true, TYPE.body) + 10;
  // Legend with the lane glyphs themselves, wrapping to the lane width.
  {
    const items: Array<[string, string]> = [
      [Lx.write, `M0,-9L8,-9L4,-2Z`],
      [Lx.read, ""],
      [Lx.left, "dash"],
    ];
    let lx = 0, ly = yLeft + 12;
    for (const [label, glyph] of items) {
      const iw = 18 + textWidth(label, TYPE.body);
      if (lx > 0 && lx + iw > laneW) { lx = 0; ly += 20; }
      if (glyph === "") parts.push(el("circle", { cx: lx + 4, cy: ly - 5, r: 3, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
      else if (glyph === "dash") parts.push(el("line", { x1: lx, x2: lx + 10, y1: ly - 5, y2: ly - 5, stroke: C.warn, "stroke-width": 2, "stroke-dasharray": "3 2" }));
      else parts.push(el("path", { d: glyph, transform: `translate(${lx},${ly})`, fill: C.ink }));
      parts.push(text(lx + 16, ly, label, { "font-size": TYPE.body }));
      lx += iw + 16;
    }
    yLeft = ly + 8;
  }

  // ---- the matrix of channels so far
  const m = channels(w, t);
  const mx0 = narrow ? 0 : laneW + 26;
  let my = narrow ? yLeft + 14 : 0;
  parts.push(text(mx0, my + 14, Lx.matrix, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const cell = narrow ? Math.min(24, Math.floor((width - 70) / n)) : Math.min(24, Math.floor((width - mx0 - 34) / n));
  const gx = mx0 + 22, gy = my + 56;
  parts.push(text(mx0, my + 33, Lx.axes, { "font-size": TYPE.body, class: "fig-t-muted" }));
  for (let i = 0; i < n; i++) {
    parts.push(text(gx - 8, gy + i * cell + cell / 2 + 4, i + 1, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    parts.push(text(gx + i * cell + cell / 2, gy - 4, i + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
    for (let j = 0; j < n; j++) {
      const cxp = gx + j * cell, cyp = gy + i * cell;
      if (i === j) { parts.push(el("rect", { x: cxp + 1, y: cyp + 1, width: cell - 2, height: cell - 2, rx: 2, fill: "none", stroke: C.grid })); continue; }
      const v = m[i][j];
      parts.push(el("rect", { x: cxp + 1, y: cyp + 1, width: cell - 2, height: cell - 2, rx: 2, fill: v === 1 ? C.ink2 : C.panel }));
      if (v === 2) parts.push(el("rect", { x: cxp + 1, y: cyp + 1, width: cell - 2, height: cell - 2, rx: 2, fill: `url(#${hatchId})`, stroke: C.warn, "stroke-width": 1.5 }));
    }
  }
  my = gy + n * cell + 10;
  const ml = legend([
    { label: Lx.mLive, swatch: { kind: "rect", fill: C.ink2 } },
    { label: Lx.mLeft, swatch: { kind: "rect", fill: C.warn, pattern: hatchId, stroke: C.warn } },
  ], mx0, my, narrow ? width : width - mx0, TYPE.body);
  parts.push(ml.svg);
  my += ml.height;

  // ---- readout
  let y = Math.max(narrow ? 0 : yLeft, my) + 12;
  for (const line of readoutLines(p, m, Lx)) {
    for (const part of wrap(line, TYPE.body, width)) { parts.push(text(0, y, part, { "font-size": TYPE.body, class: "fig-t-num" })); y += 17; }
    y += 2;
  }
  return svg(width, y, describe(st, lang), g({ class: "fig-surface" }, ...parts));
}

export default defineFigure({
  name: "shared-surface-channel",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    retention: {
      kind: "choice", label: { en: "Entries on the surface", zh: "共享面上的记录" }, default: "kept",
      options: [
        { value: "kept", label: { en: "Kept", zh: "一直保留" } },
        { value: "writer", label: { en: "Cleared when writer ends", zh: "写入者结束即清除" } },
        { value: "namespace", label: { en: "Per-run namespace", zh: "按运行分命名空间" } },
      ],
    },
    outside: { kind: "toggle", label: { en: "Surface reaches outside the cluster", zh: "共享面能连到集群之外" }, default: false },
    runs: { kind: "range", label: { en: "Runs", zh: "运行次数" }, min: 3, max: R_MAX, step: 1, default: 8 },
    seed: { kind: "range", label: { en: "Schedule seed", zh: "调度种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  timeline: {
    rate: 2,
    discrete: false, // continuous time in hours
    unit: { symbol: { en: "h", zh: "小时" }, value: (t) => fixed(t, 1) },
    duration: (p) => world(p).T,
    keyframes,
    poster,
  },
  render,
  describe,
});
