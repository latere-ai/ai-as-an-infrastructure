// Run latency and total cost of a fan-out task graph as agents are added,
// from the chapter's two equations:
//
//   L(G) >= max_P ( sum_{v in P} l_v + l_coord(P) ),   C_total = C_coord + sum_v C_v.
//
// The graph: a lead plans, dispatches one branch to each of n workers, merges
// their results one at a time, and writes the synthesis. A share f of the
// single-agent work W splits evenly into the n branches; the rest is serial
// (half planning, half synthesis). Dispatching and merging a branch each take
// a/2 of the lead's time, so dispatches and merges queue at the lead. With
// "exchange state", every branch also spends a/2 receiving each of its n - 1
// peers' state. For this schedule the bound holds with equality:
//
//   L(n) = (1 - f) W + f W / n + l_coord(n),
//   l_coord(n) = (n + 1) a / 2          (branches report to the lead)
//              = (n + 1) a / 2 + (n - 1) a / 2 = n a   (branches exchange state)
//   C_coord(n) = n a  [ + n (n - 1) a / 2 ],   sum_v C_v = W.
//
// One agent (n = 1) has no lead and no coordination: L = C = W. W and a are
// illustrative, in minutes of one agent's time.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { sig, tpl } from "./lib/format.ts";

const W = 120; // single-agent work, minutes
const N_MAX = 32;

type Coupling = "lead" | "pairs";
type P = { agents: number; split: number; coord: number; coupling: Coupling };

interface Run { n: number; serial: number; branch: number; exch: number; coordPath: number; L: number; branchWork: number; coordCost: number; C: number }

function run(n: number, p: P): Run {
  const f = p.split / 100, a = p.coord;
  const serial = (1 - f) * W;
  if (n === 1) return { n, serial, branch: f * W, exch: 0, coordPath: 0, L: W, branchWork: f * W, coordCost: 0, C: W };
  const pairs = p.coupling === "pairs";
  const exch = pairs ? ((n - 1) * a) / 2 : 0;
  const branch = (f * W) / n;
  const coordPath = ((n + 1) * a) / 2 + exch;
  const coordCost = n * a + (pairs ? (n * (n - 1) * a) / 2 : 0);
  return { n, serial, branch, exch, coordPath, L: serial + branch + coordPath, branchWork: f * W, coordCost, C: W + coordCost };
}

function curve(p: P): Run[] {
  return Array.from({ length: N_MAX }, (_, i) => run(i + 1, p));
}

function fastest(runs: Run[]): Run {
  return runs.reduce((b, r) => (r.L < b.L - 1e-9 ? r : b), runs[0]);
}

const labels = {
  en: {
    title: "Critical path and total cost as agents are added",
    gantt: "One run with {n:worker/workers}",
    ganttOne: "One run by a single agent",
    lead: "lead",
    one: "agent",
    workers: "workers",
    minutes: "elapsed time (min)",
    oneAgent: "one agent",
    lat: "Run latency L on the critical path (min)",
    cost: "Total cost of the run (agent-min)",
    n: "worker agents n",
    serial: "serial work (plan, synthesis)",
    branch: "branch work",
    coord: "coordination",
    best: "fastest",
    rPath: "Critical path at n = {n}: serial {s} + branch {b} + coordination {c} = {L} min, {x} of one agent's {W} min.",
    rCost: "Total cost: node work {W} + coordination {c} = {C} agent-min, {r}× one agent.",
    rNext: "Worker {n1} would cut the branch by {save} min and add {add} min of coordination to the path.",
    rNextOne: "A second agent adds a lead that dispatches and merges, {add} min of coordination on the path, and halves the branch work.",
    rBest: "Fastest in this range: n = {n}, L = {L} min.",
    describe: "{n:worker agent/worker agents}, {pct} of the work split into branches, {a} min of coordination per branch, {mode}: run latency {L} min against {W} min for one agent, total cost {C} agent-min. The fastest run uses {best:agent/agents}.",
    modeLead: "branches reporting to the lead",
    modePairs: "branches also exchanging state",
  },
  zh: {
    title: "增加智能体时的关键路径与总成本",
    gantt: "一次运行，{n} 个工作者",
    ganttOne: "一次运行，只用一个智能体",
    lead: "主智能体",
    one: "智能体",
    workers: "工作者",
    minutes: "经过时间（分钟）",
    oneAgent: "单个智能体",
    lat: "关键路径上的运行延迟 L（分钟）",
    cost: "整次运行的总成本（智能体·分钟）",
    n: "工作者数量 n",
    serial: "串行工作（规划、综合）",
    branch: "分支工作",
    coord: "协调",
    best: "最快",
    rPath: "n = {n} 时的关键路径：串行 {s} + 分支 {b} + 协调 {c} = {L} 分钟，为单个智能体 {W} 分钟的 {x}。",
    rCost: "总成本：节点工作 {W} + 协调 {c} = {C} 智能体·分钟，是单个智能体的 {r} 倍。",
    rNext: "再加第 {n1} 个工作者，分支缩短 {save} 分钟，路径上的协调增加 {add} 分钟。",
    rNextOne: "第二个智能体会带来一个负责分派与合并的主智能体：路径上多出 {add} 分钟协调，分支工作减半。",
    rBest: "此范围内最快：n = {n}，L = {L} 分钟。",
    describe: "{n} 个工作者，{pct} 的工作拆成分支，每个分支协调 {a} 分钟，{mode}：运行延迟 {L} 分钟，单个智能体为 {W} 分钟，总成本 {C} 智能体·分钟。最快的运行用 {best} 个智能体。",
    modeLead: "分支只向主智能体汇报",
    modePairs: "分支之间还要交换状态",
  },
};
type L = typeof labels.en;

const m1 = (v: number) => sig(v, v >= 100 ? 3 : 2);
const pctOf = (v: number) => `${Math.round(v * 100)}%`;

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const r = run(p.agents, p);
  const best = fastest(curve(p));
  return tpl(Lx.describe, {
    n: p.agents, pct: `${p.split}%`, a: sig(p.coord, 3), mode: p.coupling === "pairs" ? Lx.modePairs : Lx.modeLead,
    L: m1(r.L), W, C: m1(r.C), best: best.n,
  });
}

// One run drawn as lanes: the lead (or the single agent) and each worker.
function gantt(p: P, r: Run, x0: number, y0: number, w: number, narrow: boolean, Lx: L): { svg: string; h: number } {
  const parts: string[] = [];
  const n = r.n;
  const a = p.coord;
  parts.push(text(x0, y0 + 14, n === 1 ? Lx.ganttOne : tpl(Lx.gantt, { n }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const labelW = narrow ? 0 : Math.max(textWidth(Lx.lead, TYPE.body), textWidth(Lx.workers, TYPE.body), textWidth(Lx.one, TYPE.body)) + 12;
  const tMax = Math.max(W, r.L);
  const x = linear([0, tMax], [x0 + labelW, x0 + w - 4]);
  let y = y0 + 26;
  const leadH = 16;
  const leadY = y + (narrow ? 16 : 0);
  if (narrow) parts.push(text(x0, y + 12, n === 1 ? Lx.one : Lx.lead, { "font-size": TYPE.body, class: "fig-t-muted" }));
  else parts.push(text(x0, leadY + 12, n === 1 ? Lx.one : Lx.lead, { "font-size": TYPE.body, class: "fig-t-muted" }));
  const bar = (yy: number, h: number, t0: number, t1: number, fill: string, op = 1) => {
    if (t1 - t0 <= 0) return;
    parts.push(el("rect", { x: x(t0), y: yy, width: Math.max(0.8, x(t1) - x(t0) - (h > 5 ? 0.6 : 0)), height: h, rx: h > 6 ? 2 : 0, fill, "fill-opacity": op }));
  };
  parts.push(el("rect", { x: x(0), y: leadY, width: x(tMax) - x(0), height: leadH, rx: 2, fill: C.panel }));
  const half = r.serial / 2;
  bar(leadY, leadH, 0, half, C.c3);
  let workersBottom = leadY + leadH;
  if (n === 1) {
    bar(leadY, leadH, half, half + r.branch, C.c1);
    bar(leadY, leadH, half + r.branch, W, C.c3);
  } else {
    // Dispatches queue at the lead, each branch runs, merges queue at the lead.
    const band = Math.min(n * 12, narrow ? 84 : 96);
    const laneH = band / n;
    const top = leadY + leadH + (narrow ? 20 : 6);
    if (narrow) parts.push(text(x0, top - 6, Lx.workers, { "font-size": TYPE.body, class: "fig-t-muted" }));
    else parts.push(text(x0, top + Math.min(band, 16) / 2 + 4, Lx.workers, { "font-size": TYPE.body, class: "fig-t-muted" }));
    parts.push(el("rect", { x: x(0), y: top, width: x(tMax) - x(0), height: band, rx: 2, fill: C.panel }));
    const bh = Math.max(1, laneH - (laneH > 5 ? 1.5 : laneH > 2.5 ? 0.6 : 0));
    let lastEnd = 0;
    for (let i = 1; i <= n; i++) {
      const s = half + (i * a) / 2;
      const e = s + r.branch + r.exch;
      bar(leadY, leadH, s - a / 2, s, C.c2); // dispatch i
      const yy = top + (i - 1) * laneH;
      bar(yy, bh, s, s + r.branch, C.c1);
      bar(yy, bh, s + r.branch, e, C.c2); // exchanging state with peers
      bar(leadY, leadH, e, e + a / 2, C.c2); // merge i
      lastEnd = e + a / 2;
    }
    bar(leadY, leadH, lastEnd, lastEnd + half, C.c3);
    workersBottom = top + band;
  }
  // One agent's time, for reference.
  if (n > 1) {
    const xw = x(W);
    parts.push(el("line", { x1: xw, x2: xw, y1: leadY - 4, y2: workersBottom + 3, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "4 3" }));
    const lw = textWidth(Lx.oneAgent, TYPE.body);
    parts.push(text(xw + 4 + lw <= x0 + w ? xw + 4 : xw - 4, y0 + 14, Lx.oneAgent, { "font-size": TYPE.body, "text-anchor": xw + 4 + lw <= x0 + w ? "start" : "end", class: "fig-t-muted" }));
  }
  const at = workersBottom + 6;
  parts.push(axis({ scale: x, orient: "bottom", at, ticks: x.ticks(narrow ? 4 : 6), title: Lx.minutes, size: TYPE.body }));
  return { svg: g({ class: "fig-gantt" }, ...parts), h: at - y0 + axisHeight(true, TYPE.body) };
}

// Stacked bars over n = 1..N_MAX.
function bars(p: P, runs: Run[], kind: "lat" | "cost", x0: number, y0: number, w: number, Lx: L): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 14, kind === "lat" ? Lx.lat : Lx.cost, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const left = x0 + 40, right = x0 + w - 4;
  const top = y0 + 28, plotH = 150;
  const vals = runs.map((r) => (kind === "lat" ? r.L : r.C));
  const ymax = Math.max(...vals) * 1.08;
  const y = linear([0, ymax], [top + plotH, top]);
  const x = linear([0.5, N_MAX + 0.5], [left, right]);
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], ticks: y.ticks(4), size: TYPE.body }));
  const bw = Math.max(1.5, (right - left) / N_MAX - 1.5);
  const best = fastest(runs);
  for (const r of runs) {
    const cx = x(r.n);
    const segs: Array<[number, string]> = kind === "lat"
      ? [[r.serial, C.c3], [r.branch, C.c1], [r.coordPath, C.c2]]
      : [[r.serial, C.c3], [r.branchWork, C.c1], [r.coordCost, C.c2]];
    const on = r.n === p.agents;
    let base = 0;
    for (const [v, fill] of segs) {
      if (v <= 0) continue;
      parts.push(el("rect", { x: cx - bw / 2, y: y(base + v), width: bw, height: Math.max(0, y(base) - y(base + v)), fill, "fill-opacity": on ? 1 : 0.42 }));
      base += v;
    }
    parts.push(el("rect", { x: cx - bw / 2 - 0.75, y: top, width: bw + 1.5, height: plotH, fill: "transparent", "data-fig-set": `agents=${r.n}`, class: "fig-hit" }));
  }
  // The chosen n, outlined; the fastest n, marked on the latency plot.
  const sel = runs[p.agents - 1];
  const selTop = y(kind === "lat" ? sel.L : sel.C);
  parts.push(el("rect", { x: x(sel.n) - bw / 2 - 1.5, y: selTop - 1.5, width: bw + 3, height: top + plotH - selTop + 1.5, fill: "none", stroke: C.ink, "stroke-width": 1.5, "pointer-events": "none" }));
  if (kind === "lat") {
    const bx = x(best.n), by = y(best.L) - 6;
    parts.push(el("path", { d: `M${bx - 4},${by - 6}L${bx + 4},${by - 6}L${bx},${by}Z`, fill: C.ink }));
    const lw = textWidth(Lx.best, TYPE.body);
    const lx = Math.min(Math.max(bx, left + lw / 2), right - lw / 2);
    parts.push(text(lx, by - 10, Lx.best, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-halo" }));
  }
  const ticks = [1, 4, 8, 12, 16, 20, 24, 28, 32].filter((v) => w > 400 || v % 8 === 0 || v === 1);
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, ticks, title: Lx.n, size: TYPE.body }));
  return { svg: g({ class: "fig-bars" }, ...parts), h: top + plotH - y0 + axisHeight(true, TYPE.body) };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const runs = curve(p);
  const r = runs[p.agents - 1];
  const parts: string[] = [];

  const gt = gantt(p, r, 0, 0, w, narrow, Lx);
  parts.push(gt.svg);
  let y = gt.h + 14;
  const lg = legend([
    { label: Lx.serial, swatch: { kind: "rect", fill: C.c3 } },
    { label: Lx.branch, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.coord, swatch: { kind: "rect", fill: C.c2 } },
  ], 0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height + 10;

  if (narrow) {
    const a = bars(p, runs, "lat", 0, y, w, Lx);
    parts.push(a.svg); y += a.h + 16;
    const b = bars(p, runs, "cost", 0, y, w, Lx);
    parts.push(b.svg); y += b.h + 18;
  } else {
    const half = Math.floor((w - 28) / 2);
    const a = bars(p, runs, "lat", 0, y, half, Lx);
    const b = bars(p, runs, "cost", half + 28, y, w - half - 28, Lx);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 18;
  }

  // Readout: the equation's terms at the chosen n.
  const best = fastest(runs);
  const lines = [
    tpl(Lx.rPath, { n: r.n, s: m1(r.serial), b: m1(r.branch), c: m1(r.coordPath), L: m1(r.L), x: pctOf(r.L / W), W }),
    tpl(Lx.rCost, { W, c: m1(r.coordCost), C: m1(r.C), r: sig(r.C / W, 3) }),
  ];
  if (r.n < N_MAX) {
    const nx = runs[r.n];
    lines.push(r.n === 1
      ? tpl(Lx.rNextOne, { add: m1(nx.coordPath) })
      : tpl(Lx.rNext, { n1: r.n + 1, save: m1(r.branch - nx.branch), add: m1(nx.coordPath - r.coordPath) }));
  }
  lines.push(tpl(Lx.rBest, { n: best.n, L: m1(best.L) }));
  lines.forEach((ln, i) => {
    for (const part of wrap(ln, TYPE.body, w)) {
      parts.push(text(0, y, part, { "font-size": TYPE.body, class: i === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
      y += 17;
    }
    y += 3;
  });
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "agent-critical-path",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    agents: { kind: "range", label: { en: "Worker agents n", zh: "工作者数量 n" }, min: 1, max: N_MAX, step: 1, default: 6 },
    split: { kind: "range", label: { en: "Work that splits into branches", zh: "可拆成分支的工作" }, unit: { en: "%", zh: "%" }, min: 0, max: 100, step: 5, default: 80 },
    coord: { kind: "range", label: { en: "Coordination per branch a", zh: "每个分支的协调时间 a" }, unit: { en: "min", zh: "分钟" }, min: 0.25, max: 8, step: 0.25, default: 2 },
    coupling: {
      kind: "choice", label: { en: "Branches", zh: "分支" }, default: "lead",
      options: [
        { value: "lead", label: { en: "Report to the lead", zh: "只向主智能体汇报" } },
        { value: "pairs", label: { en: "Also exchange state", zh: "彼此还要交换状态" } },
      ],
    },
  },
  render,
  describe,
});
