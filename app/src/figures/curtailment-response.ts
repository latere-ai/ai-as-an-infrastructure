// A curtailment event at one site, modeled from the terms the powering-it
// chapter lists for flexibility: curtailment quantity, notice, duration,
// recovery, checkpoint cost, safe ramp limits, the rebound peak, and storage.
//
// The grid operator asks a site running at P0 to hold its draw at P0 − ΔP for
// the window [0, H] minutes, with N minutes of notice. The site model:
//
// - Work must be checkpointed before load is shed, which takes K minutes from
//   the notice; the site then ramps down at no more than r MW per minute,
//   starting early enough to meet the window if the checkpoint allows.
// - After the window it ramps back at r. The work deferred during the event
//   (the energy below P0) is repaid by running up to its spare capacity S_p
//   above P0, which is the rebound; with no spare capacity it stays deferred.
// - On-site storage of power rating S_b covers any gap between the site's
//   load and the requested level during the window, and recharges after the
//   rebound at up to S_b. Its energy is assumed sufficient for the event.
//
// Delivered flexibility is the reduction below P0 within the window, capped at
// ΔP at every instant. Every value is an illustrative setting; the model
// integrates in steps of a quarter minute and is a pure function of the
// parameters.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

const DT = 0.25; // minutes per integration step

const labels = {
  en: {
    title: "A curtailment request and the site's response",
    y: "grid draw (MW)",
    x: "minutes from the start of the curtailment window",
    lgRequest: "requested reduction",
    lgDelivered: "delivered",
    lgStorage: "storage discharge",
    lgRecharge: "storage recharge",
    lgRebound: "rebound above baseline",
    lgGrid: "draw from the grid",
    lgLoad: "site load",
    notice: "notice",
    start: "window",
    end: "end",
    base: "baseline {p} MW",
    req: "Requested: {d} MW for {h} min = {e} MWh. Delivered in the window: {v} MWh ({p}).",
    reach: "The checkpoint ends at −{n} + {k} = {c} min; ramping at {r} MW/min, the site reaches the requested level {when}.",
    reachAt: "at {t} min",
    reachStart: "by the window start",
    reachNever: "never within the window",
    rebound: "After the window, {e} MWh of deferred work returns as up to +{s} MW above baseline for {m} min.",
    lost: "With no spare capacity, {e} MWh of deferred work is not repaid within the plot.",
    storage: "Storage supplies {e} MWh in the window and recharges it afterward.",
    illustrative: "Illustrative site and settings, not measurements.",
    describe: "With {n} min of notice, a {k} min checkpoint, and a ramp limit of {r} MW/min, the site delivers {p} of the requested {e} MWh; the rebound reaches {peak} MW above baseline.",
  },
  zh: {
    title: "一次限电请求与厂址的响应",
    y: "电网取电功率（MW）",
    x: "距限电窗口开始的分钟数",
    lgRequest: "要求削减的部分",
    lgDelivered: "实际兑现",
    lgStorage: "储能放电",
    lgRecharge: "储能充电",
    lgRebound: "高于基线的反弹",
    lgGrid: "电网取电",
    lgLoad: "厂址负荷",
    notice: "通知",
    start: "窗口",
    end: "结束",
    base: "基线 {p} MW",
    req: "要求：削减 {d} MW，持续 {h} 分钟，共 {e} MWh。窗口内实际兑现 {v} MWh（{p}）。",
    reach: "检查点在 −{n} + {k} = {c} 分钟完成；按 {r} MW/分钟爬坡，厂址{when}达到要求的水平。",
    reachAt: "在第 {t} 分钟",
    reachStart: "在窗口开始前",
    reachNever: "在窗口内始终没有",
    rebound: "窗口结束后，{e} MWh 被推迟的工作以最多高出基线 {s} MW 的功率补回，持续 {m} 分钟。",
    lost: "没有富余容量，{e} MWh 被推迟的工作在图示时段内无法补回。",
    storage: "储能在窗口内提供 {e} MWh，事后再充回。",
    illustrative: "厂址与各项设置均为示例，不是实测。",
    describe: "通知提前 {n} 分钟、检查点耗时 {k} 分钟、爬坡上限 {r} MW/分钟时，厂址兑现了所要求 {e} MWh 中的 {p}；反弹最高超出基线 {peak} MW。",
  },
};

type P = { notice: number; ckpt: number; ramp: number; spare: number; storage: number; base: number; cut: number; hold: number };

interface Run {
  t: number[]; load: number[]; grid: number[];
  t0: number; tEnd: number; ckptEnd: number; reach: number | null;
  requested: number; delivered: number; deferred: number; repaid: boolean; reboundMin: number; reboundPeak: number; stored: number;
}

const memo = new Map<string, Run>();
function simulate(p: P): Run {
  const key = JSON.stringify(p);
  const hit = memo.get(key);
  if (hit) return hit;
  const { base: P0, cut: dP, hold: H, ramp: r, spare, storage: Sb } = p;
  const t0 = -p.notice - 5;
  const ckptEnd = -p.notice + p.ckpt;
  const tStart = Math.max(ckptEnd, -dP / r);
  const t: number[] = [], load: number[] = [], grid: number[] = [];
  let L = P0, deficit = 0, charged = 0, soc = 0; // soc: energy owed back to storage, MW·min
  let delivered = 0, reach: number | null = null, reboundMin = 0, reboundPeak = 0, lastActive = H, descending = false;
  const horizon = H + 600;
  for (let k = 0; ; k++) {
    const tt = t0 + k * DT;
    if (tt > horizon) break;
    // The level the site steers toward, then one ramp-limited step.
    let target = P0;
    if (tt >= tStart && tt < H) target = P0 - dP;
    else if (tt >= H && spare > 0 && deficit > 0 && !descending) {
      // Keep catching up while the remaining deficit exceeds what the ramp
      // back down to P0 will repay; once the descent starts it continues.
      const over = Math.max(0, L - P0);
      if (tt > H && deficit <= (over * over) / (2 * r) + 1e-9) descending = true;
      else target = P0 + spare;
    }
    L += Math.max(-r * DT, Math.min(r * DT, target - L));
    if (Math.abs(L - target) < 1e-9) L = target;
    deficit += (P0 - L) * DT;
    const reboundDone = tt >= H && L <= P0 + 1e-9 && (spare === 0 || deficit <= 1e-9 || descending);
    // Storage: discharge to the requested level in the window, recharge after
    // the rebound has ended.
    let s = 0;
    if (tt >= 0 && tt < H) s = Math.max(0, Math.min(Sb, L - (P0 - dP)));
    else if (reboundDone && soc > 1e-9) s = -Math.min(Sb, soc / DT);
    soc += s * DT;
    if (s > 0) charged += s * DT;
    const G = L - s;
    t.push(tt); load.push(L); grid.push(G);
    if (tt >= 0 && tt < H) {
      delivered += Math.min(dP, Math.max(0, P0 - G)) * DT;
      if (reach === null && G <= P0 - dP + 1e-6) reach = tt;
    } else if (tt < 0 && reach === null && G <= P0 - dP + 1e-6) reach = tt;
    if (tt >= H) {
      if (G > P0 + 1e-6) { reboundMin += DT; reboundPeak = Math.max(reboundPeak, G - P0); }
      if (Math.abs(G - P0) > 1e-6 || Math.abs(L - P0) > 1e-6) lastActive = tt;
    }
    if (reboundDone && Math.abs(L - P0) < 1e-9 && Math.abs(G - P0) < 1e-9 && soc <= 1e-9 && tt > lastActive + 20) break;
  }
  const tEnd = Math.min(horizon, Math.max(H + 30, lastActive + 15));
  const run: Run = {
    t, load, grid, t0, tEnd, ckptEnd, reach,
    requested: dP * H, delivered, deferred: Math.max(0, deficit), repaid: deficit <= 1e-6,
    reboundMin, reboundPeak, stored: charged,
  };
  // The deferred energy reported is what the event took below baseline.
  let below = 0;
  for (let i = 0; i < t.length; i++) below += Math.max(0, p.base - load[i]) * DT;
  run.deferred = below;
  if (memo.size > 64) memo.clear();
  memo.set(key, run);
  return run;
}

const mwh = (mwMin: number) => fixed(mwMin / 60, 1);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = simulate(p);
  return tpl(L.describe, { n: p.notice, k: p.ckpt, r: p.ramp, p: pct(m.delivered / m.requested), e: mwh(m.requested), peak: fixed(m.reboundPeak, 0) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const m = simulate(p);
  const hatchId = `${st.uid}-charge`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.c3, 4, 1.4))];

  const items = [
    { label: L.lgRequest, swatch: { kind: "rect" as const, fill: "none", stroke: C.ink2, dash: "3 2" } },
    { label: L.lgDelivered, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.45 } },
    ...(p.storage > 0 ? [
      { label: L.lgStorage, swatch: { kind: "rect" as const, fill: C.c3, opacity: 0.6 } },
      { label: L.lgRecharge, swatch: { kind: "rect" as const, fill: C.c3, pattern: hatchId } },
    ] : []),
    ...(m.reboundPeak > 0 ? [{ label: L.lgRebound, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.45 } }] : []),
    { label: L.lgGrid, swatch: { kind: "line" as const, stroke: C.ink } },
    { label: tpl(L.base, { p: p.base }), swatch: { kind: "line" as const, stroke: C.ink3, dash: "5 3" } },
    ...(p.storage > 0 ? [{ label: L.lgLoad, swatch: { kind: "line" as const, stroke: C.ink2, dash: "4 3" } }] : []),
  ];
  const lg = legend(items, 0, 0, w, fs);
  parts.push(lg.svg);

  const left = narrow ? 40 : 46, right = narrow ? 6 : 12;
  const x = linear([m.t0, m.tEnd], [left, w - right]);
  // Event markers are labeled above the plot; a label that would touch one
  // already placed moves up a row. The y title holds the right end of row 0.
  const rowStep = fs + 4;
  const marks: Array<[number, string]> = [[-p.notice, L.notice], [0, L.start], [p.hold, L.end]];
  const placed: Array<{ x0: number; x1: number; row: number; xx: number; name: string }> = [
    { x0: w - right - textWidth(L.y, fs), x1: w - right, row: 0, xx: NaN, name: "" },
  ];
  for (const [tt, name] of marks) {
    const xx = x(tt);
    const tw = textWidth(name, fs);
    const lx = Math.max(0, xx - tw / 2);
    let row = 0;
    while (row < 2 && placed.some((q) => q.row === row && lx < q.x1 + 6 && lx + tw > q.x0 - 6)) row++;
    placed.push({ x0: lx, x1: lx + tw, row, xx, name });
  }
  const rows = Math.max(...placed.map((q) => q.row)) + 1;
  const top = lg.height + 18 + rows * rowStep;
  const plotH = narrow ? 200 : 240;
  const peak = Math.max(...m.grid, ...m.load);
  const y = linear([Math.max(0, p.base - p.cut - 60), Math.max(p.base + 60, peak + 20)], [top + plotH, top]);
  const bottom = top + plotH;
  // The y title sits at the right end above the plot, clear of the event
  // markers, which are near the start of the time axis.
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], size: fs, format: (v) => int(v) }));
  parts.push(text(w - right, top - 8, L.y, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: x.ticks(narrow ? 4 : 8), title: L.x, size: fs, format: (v) => String(v).replace(/^-/, "−") }));

  const n = m.t.length;
  const idx = (tt: number) => Math.max(0, Math.min(n - 1, Math.round((tt - m.t0) / DT)));
  const within = (a: number, b: number) => { const out: number[] = []; for (let i = idx(a); i <= idx(b); i++) if (m.t[i] <= m.tEnd) out.push(i); return out; };
  const area = (ids: number[], hi: (i: number) => number, lo: (i: number) => number) => {
    if (!ids.length) return "";
    const upper = ids.map((i) => [x(m.t[i]), y(hi(i))] as [number, number]);
    const lower = [...ids].reverse().map((i) => [x(m.t[i]), y(lo(i))] as [number, number]);
    return linePath([...upper, ...lower]) + "Z";
  };

  // Requested reduction: the band between baseline and the requested level
  // over the window.
  const req = { x: x(0), y: y(p.base), w: x(p.hold) - x(0), h: y(p.base - p.cut) - y(p.base) };
  parts.push(el("rect", { x: req.x, y: req.y, width: req.w, height: req.h, fill: C.panel }));
  // Delivered: the reduction below baseline within the window, capped at ΔP.
  const win = within(0, p.hold - DT);
  parts.push(el("path", { d: area(win, () => p.base, (i) => Math.max(p.base - p.cut, Math.min(p.base, m.grid[i]))), fill: C.c1, "fill-opacity": 0.45 }));
  // Storage discharge and recharge: between site load and grid draw.
  const all = within(m.t0, m.tEnd);
  if (p.storage > 0) {
    const dis = all.filter((i) => m.load[i] > m.grid[i] + 1e-6);
    const chg = all.filter((i) => m.grid[i] > m.load[i] + 1e-6);
    for (const run of runsOf(dis)) parts.push(el("path", { d: area(run, (i) => m.load[i], (i) => m.grid[i]), fill: C.c3, "fill-opacity": 0.6 }));
    for (const run of runsOf(chg)) parts.push(el("path", { d: area(run, (i) => m.grid[i], (i) => m.load[i]), fill: `url(#${hatchId})` }));
  }
  // Rebound above baseline after the window.
  const after = all.filter((i) => m.t[i] >= p.hold && m.grid[i] > p.base + 1e-6);
  for (const run of runsOf(after)) parts.push(el("path", { d: area(run, (i) => m.grid[i], () => p.base), fill: C.c2, "fill-opacity": 0.45 }));
  parts.push(el("rect", { x: req.x + 0.5, y: req.y + 0.5, width: req.w - 1, height: req.h - 1, fill: "none", stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));

  // Baseline, event markers, and the two lines.
  parts.push(el("line", { x1: left, x2: w - right, y1: y(p.base), y2: y(p.base), stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "5 3" }));
  for (const q of placed.slice(1)) {
    const ly = top - 8 - q.row * rowStep;
    parts.push(el("line", { x1: q.xx, x2: q.xx, y1: q.row === 0 ? ly + 3 : top, y2: bottom, stroke: C.ink3, "stroke-width": 1 }));
    parts.push(text(q.x0, ly, q.name, { "font-size": fs, class: "fig-t-halo fig-t-soft" }));
  }
  if (p.storage > 0) parts.push(el("path", { d: linePath(all.map((i) => [x(m.t[i]), y(m.load[i])])), fill: "none", stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: linePath(all.map((i) => [x(m.t[i]), y(m.grid[i])])), fill: "none", stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }));

  // Readout.
  let yy = bottom + axisHeight(true, fs) + 18;
  const wrapL = (s: string, mw: number) => (lang === "zh" ? wrapCjk(s, fs, mw) : wrap(s, fs, mw));
  const when = m.reach === null ? L.reachNever : m.reach <= 0 ? L.reachStart : tpl(L.reachAt, { t: fixed(m.reach, 0) });
  const lines: Array<[string, string]> = [
    [tpl(L.req, { d: p.cut, h: p.hold, e: mwh(m.requested), v: mwh(m.delivered), p: pct(m.delivered / m.requested) }), "fig-t-strong"],
    [tpl(L.reach, { n: p.notice, k: p.ckpt, c: String(m.ckptEnd).replace(/^-/, "−"), r: p.ramp, when }), ""],
    [p.spare > 0 ? tpl(L.rebound, { e: mwh(m.deferred), s: p.spare, m: fixed(m.reboundMin, 0) }) : tpl(L.lost, { e: mwh(m.deferred) }), ""],
    ...(p.storage > 0 ? [[tpl(L.storage, { e: mwh(m.stored) }), ""] as [string, string]] : []),
    [L.illustrative, "fig-t-muted"],
  ];
  const ro: string[] = [];
  for (const [s, cls] of lines) {
    for (const ln of wrapL(s, cls.includes("strong") ? w / 1.1 : w)) { ro.push(text(0, yy, ln, { "font-size": fs, class: cls || undefined })); yy += fs + 6; }
    yy += 4;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, yy, describe(st, lang), ...parts);
}

// Split sorted indices into runs of consecutive steps.
function runsOf(ids: number[]): number[][] {
  const out: number[][] = [];
  for (const i of ids) {
    const last = out[out.length - 1];
    if (last && i === last[last.length - 1] + 1) last.push(i); else out.push([i]);
  }
  return out;
}

export default defineFigure({
  name: "curtailment-response",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    notice: { kind: "range", label: { en: "Notice before the window", zh: "窗口前的通知时间" }, unit: { en: "min", zh: "分钟" }, min: 0, max: 60, step: 1, default: 10 },
    ckpt: { kind: "range", label: { en: "Checkpoint before shedding load", zh: "减负荷前的检查点耗时" }, unit: { en: "min", zh: "分钟" }, min: 0, max: 30, step: 1, default: 15 },
    ramp: { kind: "range", label: { en: "Safe ramp limit", zh: "安全爬坡上限" }, unit: { en: "MW/min", zh: "MW/分钟" }, min: 2, max: 50, step: 1, default: 10 },
    spare: { kind: "range", label: { en: "Spare capacity for deferred work", zh: "补回推迟工作的富余容量" }, unit: { en: "MW", zh: "MW" }, min: 0, max: 100, step: 5, default: 30 },
    storage: { kind: "range", label: { en: "On-site storage power", zh: "现场储能功率" }, unit: { en: "MW", zh: "MW" }, min: 0, max: 100, step: 5, default: 0 },
    base: { kind: "range", label: { en: "Baseline draw", zh: "基线用电" }, unit: { en: "MW", zh: "MW" }, min: 50, max: 1000, step: 10, default: 300, control: false },
    cut: { kind: "range", label: { en: "Requested reduction", zh: "要求削减量" }, unit: { en: "MW", zh: "MW" }, min: 10, max: 300, step: 10, default: 100, control: false },
    hold: { kind: "range", label: { en: "Window length", zh: "窗口时长" }, unit: { en: "min", zh: "分钟" }, min: 15, max: 240, step: 5, default: 60, control: false },
  },
  render,
  describe,
});
