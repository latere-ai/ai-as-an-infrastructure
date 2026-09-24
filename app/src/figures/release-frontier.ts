// Choosing an operating point: the operational-evaluation chapter's order of
// operations on a set of complete system options.
//
//   1. Pareto frontier over the measured axes, quality Q up, cost C and p95
//      latency L down: m is dominated when another option is no worse on all
//      three and better on at least one.
//   2. Hard limits: a quality floor and a latency budget exclude options.
//   3. Among the rest, the declared utility
//        U(m) = Q(m) − λ_c C(m) − λ_l L(m)
//      picks the option with the largest U (the chapter's λ_r R(m) term is
//      held equal across options and left out).
//
// The utility is drawn in the quality-cost plane: each eligible option drops
// by its latency penalty λ_l L(m) to an effective quality Q − λ_l L, and the
// curve Q_eff = U* + λ_c C holds the utility at the chosen option's value U*,
// so every other eligible option's dropped point lies on or below it. On the
// log cost axis that line of slope λ_c is a curve.
//
// The eight options and their numbers are illustrative, not measurements.
// They are chosen so that two options are dominated (each by a different
// option), one option is behind another on cost but stays on the frontier
// because it is faster, the cheapest option is on the frontier and below the
// default floor, and the highest-quality option is over the default budget.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log, linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, overlaps, textBox, textWidth, wrap, type Box, type Side } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, tpl } from "./lib/format.ts";

export interface Option { id: string; name: { en: string; zh: string }; q: number; c: number; l: number }
// q: share of tasks passed (%), c: metered cost per task (US cents), l: p95 latency (s).
export const OPTIONS: Option[] = [
  { id: "small", name: { en: "small", zh: "小模型" }, q: 60, c: 0.1, l: 0.8 },
  { id: "rag", name: { en: "small + retrieval", zh: "小模型+检索" }, q: 74, c: 0.3, l: 1.8 },
  { id: "fast", name: { en: "fast mid", zh: "快速中型" }, q: 78, c: 1.5, l: 1.4 },
  { id: "tuned", name: { en: "tuned mid", zh: "调优中型" }, q: 77, c: 1.2, l: 3.0 },
  { id: "routed", name: { en: "routed", zh: "路由" }, q: 81, c: 0.9, l: 2.6 },
  { id: "large", name: { en: "large", zh: "大模型" }, q: 86, c: 3.0, l: 4.5 },
  { id: "older", name: { en: "older large", zh: "旧版大模型" }, q: 84, c: 6.0, l: 9.0 },
  { id: "reason", name: { en: "large + reasoning", zh: "大模型+推理" }, q: 90, c: 9.0, l: 16 },
];

const dominates = (a: Option, b: Option) =>
  a.q >= b.q && a.c <= b.c && a.l <= b.l && (a.q > b.q || a.c < b.c || a.l < b.l);

// The first option that dominates o, preferring the one best on quality.
export function dominator(o: Option): Option | undefined {
  return OPTIONS.filter((a) => dominates(a, o)).sort((a, b) => b.q - a.q)[0];
}

type P = { lc: number; ll: number; budget: number; floor: number };
export type Status = "chosen" | "eligible" | "dominated" | "floor" | "budget";

export const utility = (o: Option, p: P) => o.q - p.lc * o.c - p.ll * o.l;

export function evaluate(p: P) {
  const rows = OPTIONS.map((o) => {
    const dom = dominator(o);
    const status: Status = dom ? "dominated" : o.q < p.floor ? "floor" : o.l > p.budget ? "budget" : "eligible";
    return { o, dom, status: status as Status, u: utility(o, p) };
  });
  const eligible = rows.filter((r) => r.status === "eligible").sort((a, b) => b.u - a.u || b.o.q - a.o.q);
  if (eligible.length) eligible[0].status = "chosen";
  const chosen = eligible[0];
  const best = [...OPTIONS].sort((a, b) => b.q - a.q)[0];
  return { rows, eligible, chosen, best };
}

const labels = {
  en: {
    title: "Operating frontier and the chosen point",
    costPanel: "Quality against cost",
    latPanel: "Quality against p95 latency",
    xCost: "metered cost per task (US cents)",
    xLat: "p95 latency (s)",
    yQ: "tasks passed (%)",
    floor: "floor {v}%",
    budget: "budget {v} s",
    iso: "equal U = {u}",
    lgChosen: "chosen",
    lgEligible: "eligible",
    lgDominated: "dominated, joined to its dominator",
    lgExcluded: "fails a hard limit",
    lgDrop: "drop by the latency penalty",
    formula: "U({m}) = {q} − {lc} × {c} − {ll} × {l} = {u}",
    none: "No option meets the floor and the budget: keep the baseline.",
    best: "Highest quality: {m} at {q}%, {s}",
    bestChosen: "chosen",
    colName: "option",
    colQ: "Q %",
    colC: "C ¢",
    colL: "L s",
    colU: "U, or why it is out",
    rDom: "dominated by {m}",
    rFloor: "below the {v}% floor",
    rBudget: "over the {v} s budget",
    rUtil: "U = {u}",
    nums: "Q {q}%  ·  C {c}¢  ·  L {l} s",
    describe: "Floor {f}%, budget {b} s, cost weight {lc}, latency weight {ll}: {pick}. Out: {out}.",
    pick: "{m} is chosen with U = {u}",
    pickNone: "no option meets the hard limits",
  },
  zh: {
    title: "运营前沿与选中的运营点",
    costPanel: "质量与成本",
    latPanel: "质量与 p95 延迟",
    xCost: "每项任务的计量成本（美分）",
    xLat: "p95 延迟（秒）",
    yQ: "任务通过率（%）",
    floor: "下限 {v}%",
    budget: "预算 {v} 秒",
    iso: "等效用 U = {u}",
    lgChosen: "选中",
    lgEligible: "可选",
    lgDominated: "被支配，连向支配它的选项",
    lgExcluded: "未通过硬性约束",
    lgDrop: "按延迟惩罚下移",
    formula: "U（{m}）= {q} − {lc} × {c} − {ll} × {l} = {u}",
    none: "没有选项同时满足下限和预算：保留基线版本。",
    best: "质量最高：{m}，{q}%，{s}",
    bestChosen: "已选中",
    colName: "选项",
    colQ: "Q %",
    colC: "C 美分",
    colL: "L 秒",
    colU: "U，或被排除的原因",
    rDom: "被{m}支配",
    rFloor: "低于 {v}% 的下限",
    rBudget: "超出 {v} 秒的预算",
    rUtil: "U = {u}",
    nums: "Q {q}%  ·  C {c} 美分  ·  L {l} 秒",
    describe: "质量下限 {f}%，延迟预算 {b} 秒，成本权重 {lc}，延迟权重 {ll}：{pick}。被排除的选项：{out}。",
    pick: "选中{m}，U = {u}",
    pickNone: "没有选项满足硬性约束",
  },
};
type L = typeof labels.en;

const SEP: Record<Lang, string> = { en: "; ", zh: "；" };
const wrapL = (lang: Lang, s: string, size: number, w: number) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const n1 = (v: number) => fixed(v, 1);
const trim = (v: number) => String(Number(v.toFixed(2)));

function reason(r: ReturnType<typeof evaluate>["rows"][number], p: P, L: L, lang: Lang): string {
  if (r.status === "dominated") return tpl(L.rDom, { m: r.dom!.name[lang] });
  if (r.status === "floor") return tpl(L.rFloor, { v: p.floor });
  if (r.status === "budget") return tpl(L.rBudget, { v: trim(p.budget) });
  return tpl(L.rUtil, { u: n1(r.u) });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const e = evaluate(p);
  const out = e.rows.filter((r) => r.status !== "eligible" && r.status !== "chosen").map((r) => (lang === "zh" ? `${r.o.name[lang]}（${reason(r, p, L, lang)}）` : `${r.o.name[lang]} (${reason(r, p, L, lang)})`));
  return tpl(L.describe, {
    f: p.floor, b: trim(p.budget), lc: trim(p.lc), ll: trim(p.ll),
    pick: e.chosen ? tpl(L.pick, { m: e.chosen.o.name[lang], u: n1(e.chosen.u) }) : L.pickNone,
    out: out.join(SEP[lang]),
  });
}

// ---------------------------------------------------------------- render

const Q_DOMAIN: [number, number] = [55, 95];
const AXES = {
  cost: { domain: [0.05, 20] as [number, number], ticks: [0.1, 0.3, 1, 3, 10], get: (o: Option) => o.c },
  lat: { domain: [0.5, 30] as [number, number], ticks: [0.5, 1, 2, 5, 10, 20], get: (o: Option) => o.l },
};
type Kind = keyof typeof AXES;

const STYLE: Record<Status, { fill: string; stroke: string; r: number }> = {
  chosen: { fill: C.c1, stroke: C.paper, r: 6.5 },
  eligible: { fill: C.ink, stroke: C.paper, r: 4.5 },
  dominated: { fill: C.paper, stroke: C.ink2, r: 4.5 },
  floor: { fill: C.ink3, stroke: C.paper, r: 4.5 },
  budget: { fill: C.ink3, stroke: C.paper, r: 4.5 },
};

function panel(kind: Kind, p: P, x0: number, y0: number, pw: number, L: L, lang: Lang, uid: string): { svg: string; h: number } {
  const fs = TYPE.body;
  const narrow = pw < 360;
  const e = evaluate(p);
  const A = AXES[kind];
  const parts: string[] = [text(x0, y0 + 14, kind === "cost" ? L.costPanel : L.latPanel, { "font-size": TYPE.label, class: "fig-t-strong" })];
  const top = y0 + 44, left = x0 + 34, right = x0 + pw - 6;
  const plotH = narrow ? 190 : 210;
  const bottom = top + plotH;
  const x = log(A.domain, [left, right]);
  const y = linear(Q_DOMAIN, [bottom, top]);
  const clip = `${uid}-${kind}-clip`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: right - left, height: plotH }))));
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: A.ticks, grid: [top, bottom], title: kind === "cost" ? L.xCost : L.xLat, size: fs, format: (v) => String(v) }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [60, 70, 80, 90], grid: [left, right], title: L.yQ, size: fs, format: (v) => String(v) }));
  const obstacles: Box[] = [];

  // Hard limits: the quality floor in both panels, the latency budget in the latency panel.
  const fy = y(Math.max(Q_DOMAIN[0], p.floor));
  parts.push(el("rect", { x: left, y: fy, width: right - left, height: bottom - fy, fill: `url(#${uid}-hatch)` }));
  parts.push(el("line", { x1: left, x2: right, y1: fy, y2: fy, stroke: C.ink2, "stroke-width": 1.2 }));
  obstacles.push(...lineObstacles([[left, fy], [right, fy]], 6, 1.5));
  // Limit labels at fixed spots clear of the points, padded so point names
  // keep clear of them.
  const pointBoxes: Box[] = OPTIONS.map((o) => {
    const px = x(A.get(o)), py = y(o.q);
    return { x0: px - 8, y0: py - 8, x1: px + 8, y1: py + 8 };
  });
  const bx = x(Math.min(A.domain[1], Math.max(A.domain[0], p.budget)));
  if (kind === "lat") pointBoxes.push({ x0: bx - 3, y0: top, x1: bx + 3, y1: bottom });
  const limitLabel = (lx: number, ly: number, s: string, anchor: "start" | "end") => {
    const b = textBox(lx, ly, s, fs, anchor);
    obstacles.push({ x0: b.x0 - 5, y0: b.y0 - 3, x1: b.x1 + 5, y1: b.y1 + 3 });
    parts.push(text(lx, ly, s, { "font-size": fs, "text-anchor": anchor, class: "fig-t-halo fig-t-soft" }));
  };
  const floorText = tpl(L.floor, { v: p.floor });
  const spots: Array<[number, number, "start" | "end"]> = [
    [right - 4, fy - 6, "end"], [right - 4, fy + 16, "end"], [left + 6, fy - 6, "start"], [left + 6, fy + 16, "start"],
  ];
  const free = spots.find(([lx, ly, an]) => {
    const b = textBox(lx, ly, floorText, fs, an);
    return b.y0 >= top && b.y1 <= bottom && !pointBoxes.some((pb) => overlaps(pb, b));
  }) ?? spots[0];
  limitLabel(free[0], free[1], floorText, free[2]);
  if (kind === "lat") {
    parts.push(el("rect", { x: bx, y: top, width: right - bx, height: plotH, fill: `url(#${uid}-hatch)` }));
    parts.push(el("line", { x1: bx, x2: bx, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1.2 }));
    obstacles.push(...lineObstacles([[bx, top], [bx, bottom]], 6, 1.5));
    const bt = tpl(L.budget, { v: trim(p.budget) });
    const bspots: Array<[number, number, "start" | "end"]> = [
      [bx - 6, top + 14, "end"], [bx + 6, top + 14, "start"], [bx - 6, bottom - 6, "end"], [bx + 6, bottom - 6, "start"],
    ];
    const bfree = bspots.find(([lx, ly, an]) => {
      const bb = textBox(lx, ly, bt, fs, an);
      return bb.x0 >= left + 2 && bb.x1 <= right && !pointBoxes.some((pb) => overlaps(pb, bb));
    });
    if (bfree) limitLabel(bfree[0], bfree[1], bt, bfree[2]);
  }

  const pos = (o: Option): [number, number] => [x(A.get(o)), y(o.q)];
  let isoLabel: { x: number; y: number; text: string; size: number; sides: string[]; gap: number; priority: number; attrs: Record<string, string> } | null = null;
  const clipped: string[] = [];
  // Dominated options joined to their dominator, which sits above and to the left in both panels.
  for (const r of e.rows) {
    if (r.status !== "dominated") continue;
    const [ax, ay] = pos(r.o), [bx, by] = pos(r.dom!);
    parts.push(el("line", { x1: ax, y1: ay, x2: bx, y2: by, stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "3 3" }));
    obstacles.push(...lineObstacles([[ax, ay], [bx, by]], 6, 1.5));
  }
  // The utility, in the cost panel: each eligible option drops by λ_l L to
  // its effective quality, and the equal-utility curve through the chosen
  // option's dropped point bounds all the others from above.
  if (kind === "cost" && e.chosen) {
    for (const r of e.eligible) {
      const [px, py] = pos(r.o);
      const ey = y(r.o.q - p.ll * r.o.l);
      const col = r.status === "chosen" ? C.c1 : C.ink2;
      clipped.push(el("line", { x1: px, x2: px, y1: py, y2: ey, stroke: col, "stroke-width": 1.5 }));
      clipped.push(el("line", { x1: px - 4, x2: px + 4, y1: ey, y2: ey, stroke: col, "stroke-width": 2 }));
      obstacles.push(...lineObstacles([[px, py], [px, ey]], 5, 2));
    }
    const u = e.chosen.u;
    const lo = Math.log10(A.domain[0]), hi = Math.log10(A.domain[1]);
    const curve: Array<[number, number]> = Array.from({ length: 81 }, (_, i) => {
      const cv = 10 ** (lo + ((hi - lo) * i) / 80);
      return [x(cv), y(u + p.lc * cv)];
    });
    clipped.push(el("path", { d: linePath(curve), fill: "none", stroke: C.c1, "stroke-width": 1.6, "stroke-dasharray": "6 4" }));
    const inView = curve.filter(([, cy]) => cy >= top && cy <= bottom);
    obstacles.push(...lineObstacles(inView, 6, 1.5));
    // Name the curve near its left end, where it is flattest.
    if (inView.length) isoLabel = { x: inView[2]?.[0] ?? inView[0][0], y: inView[2]?.[1] ?? inView[0][1], text: tpl(L.iso, { u: n1(u) }), size: fs, sides: ["above-right", "below-right", "above", "below"], gap: 6, priority: 4.5, attrs: { class: "fig-t-halo" } };
  }
  parts.push(g({ "clip-path": `url(#${clip})` }, ...clipped));

  // Points, then their names placed clear of everything drawn.
  const reqs = [];
  for (const r of e.rows) {
    const [px, py] = pos(r.o);
    const s = STYLE[r.status];
    parts.push(el("circle", { cx: px, cy: py, r: s.r, fill: s.fill, stroke: s.stroke, "stroke-width": r.status === "dominated" ? 1.5 : 1.5 }));
    if (r.status === "chosen") parts.push(el("circle", { cx: px, cy: py, r: s.r + 3, fill: "none", stroke: C.c1, "stroke-width": 1.5 }));
    obstacles.push({ x0: px - s.r - 2, y0: py - s.r - 2, x1: px + s.r + 2, y1: py + s.r + 2 });
    reqs.push({
      x: px, y: py, text: r.o.name[lang], size: fs, gap: r.status === "chosen" ? 11 : 8, priority: r.status === "chosen" ? 4 : r.status === "eligible" ? 3 : 2,
      sides: ["right", "left", "above", "below", "above-right", "below-right", "above-left", "below-left"] as const,
      attrs: { class: r.status === "chosen" ? "fig-t-halo" : r.status === "eligible" ? "fig-t-halo" : "fig-t-halo fig-t-soft" },
    });
  }
  const placed = placeLabels([...(isoLabel ? [isoLabel] : []), ...reqs].map((r) => ({ ...r, sides: [...r.sides] as Side[] })),
    { x0: left + 2, y0: top + 1, x1: right, y1: bottom - 1 }, obstacles);
  parts.push(drawLabels(placed.placed));
  return { svg: g({ class: `fig-panel-${kind}` }, ...parts), h: bottom + axisHeight(true, fs) - y0 };
}

// Legend with the point styles as drawn.
function key(w: number, y0: number, L: L, uid: string): { svg: string; h: number } {
  const fs = TYPE.body;
  const items: Array<[string, (x: number, y: number) => string]> = [
    [L.lgChosen, (x, y) => el("circle", { cx: x + 7, cy: y, r: 5, fill: C.c1 }) + el("circle", { cx: x + 7, cy: y, r: 7.5, fill: "none", stroke: C.c1, "stroke-width": 1.2 })],
    [L.lgEligible, (x, y) => el("circle", { cx: x + 7, cy: y, r: 4.5, fill: C.ink })],
    [L.lgDominated, (x, y) => el("circle", { cx: x + 7, cy: y, r: 4.5, fill: C.paper, stroke: C.ink2, "stroke-width": 1.5 })],
    [L.lgExcluded, (x, y) => el("rect", { x: x, y: y - 6, width: 14, height: 12, rx: 2, fill: `url(#${uid}-hatch)`, stroke: C.ink3 }) + el("circle", { cx: x + 7, cy: y, r: 4, fill: C.ink3 })],
    [L.lgDrop, (x, y) => el("line", { x1: x + 7, x2: x + 7, y1: y - 7, y2: y + 5, stroke: C.ink2, "stroke-width": 1.5 }) + el("line", { x1: x + 3, x2: x + 11, y1: y + 5, y2: y + 5, stroke: C.ink2, "stroke-width": 2 })],
  ];
  const parts: string[] = [];
  let cx = 0, row = 0;
  for (const [label, sw] of items) {
    const iw = 20 + textWidth(label, fs);
    if (cx > 0 && cx + iw > w) { row++; cx = 0; }
    const yy = y0 + 10 + row * 22;
    parts.push(sw(cx, yy), text(cx + 20, yy + 4, label, { "font-size": fs, fill: C.ink2 }));
    cx += iw + 18;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: (row + 1) * 22 };
}

function readout(p: P, w: number, y0: number, L: L, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const narrow = w < 480;
  const e = evaluate(p);
  const parts: string[] = [];
  let y = y0;
  const line = (s: string, cls: string, size: number = fs) => { for (const ln of wrapL(lang, s, size, w)) { y += size + 5; parts.push(text(0, y, ln, { "font-size": size, class: cls })); } };
  if (e.chosen) {
    const o = e.chosen.o;
    line(tpl(L.formula, { m: o.name[lang], q: o.q, lc: trim(p.lc), c: n1(o.c), ll: trim(p.ll), l: n1(o.l), u: n1(e.chosen.u) }), "fig-t-strong fig-t-num", TYPE.label);
  } else line(L.none, "fig-t-strong", TYPE.label);
  const bestRow = e.rows.find((r) => r.o === e.best)!;
  line(tpl(L.best, { m: e.best.name[lang], q: e.best.q, s: bestRow.status === "chosen" ? L.bestChosen : reason(bestRow, p, L, lang) }), "fig-t-muted");
  y += 10;

  // Ranked: eligible options by U, then the options that are out and why.
  const order: Status[] = ["chosen", "eligible", "dominated", "floor", "budget"];
  const rows = [...e.rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.u - a.u);
  const numW = 44;
  const xQ = narrow ? 0 : 150, xC = xQ + numW, xL = xC + numW, xU = xL + 26;
  if (!narrow) {
    y += 12;
    parts.push(text(0, y, L.colName, { "font-size": fs, class: "fig-t-muted" }));
    parts.push(text(xQ + numW - 10, y, L.colQ, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(xC + numW - 10, y, L.colC, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(xL + numW - 10, y, L.colL, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(xU + 18, y, L.colU, { "font-size": fs, class: "fig-t-muted" }));
    y += 6;
  }
  for (const r of rows) {
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const s = STYLE[r.status];
    const on = r.status === "chosen";
    const cls = on ? "fig-t-strong" : r.status === "eligible" ? "" : "fig-t-muted";
    const why = reason(r, p, L, lang);
    if (narrow) {
      y += 17;
      parts.push(el("circle", { cx: 5, cy: y - 4, r: 4, fill: s.fill, stroke: r.status === "dominated" ? C.ink2 : "none", "stroke-width": 1.5 }));
      parts.push(text(16, y, r.o.name[lang], { "font-size": fs, class: cls || undefined }));
      parts.push(text(w, y, why, { "font-size": fs, "text-anchor": "end", class: `fig-t-num ${cls}` }));
      y += 16;
      parts.push(text(16, y, tpl(L.nums, { q: r.o.q, c: n1(r.o.c), l: n1(r.o.l) }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
      y += 7;
    } else {
      y += 18;
      parts.push(el("circle", { cx: 5, cy: y - 4, r: 4, fill: s.fill, stroke: r.status === "dominated" ? C.ink2 : "none", "stroke-width": 1.5 }));
      parts.push(text(16, y, r.o.name[lang], { "font-size": fs, class: cls || undefined }));
      parts.push(text(xQ + numW - 10, y, String(r.o.q), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
      parts.push(text(xC + numW - 10, y, n1(r.o.c), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
      parts.push(text(xL + numW - 10, y, n1(r.o.l), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
      parts.push(text(xU + 18, y, why, { "font-size": fs, class: `fig-t-num ${cls}` }));
      y += 7;
    }
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-hatch`, C.ink3, 6, 1))];
  let y = 0;
  if (narrow) {
    const a = panel("cost", p, 0, y, w, L, lang, st.uid);
    parts.push(a.svg);
    y += a.h + 14;
    const b = panel("lat", p, 0, y, w, L, lang, st.uid);
    parts.push(b.svg);
    y += b.h + 8;
  } else {
    const pw = Math.floor((w - 24) / 2);
    const a = panel("cost", p, 0, y, pw, L, lang, st.uid);
    const b = panel("lat", p, pw + 24, y, w - pw - 24, L, lang, st.uid);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 8;
  }
  const k = key(w, y, L, st.uid);
  parts.push(k.svg);
  y += k.h + 8;
  const ro = readout(p, w, y, L, lang);
  parts.push(ro.svg);
  y += ro.h;
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "release-frontier",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    lc: { kind: "range", label: { en: "Cost weight (points per ¢)", zh: "成本权重（分/美分）" }, min: 0, max: 8, step: 0.1, default: 1 },
    ll: { kind: "range", label: { en: "Latency weight (points per s)", zh: "延迟权重（分/秒）" }, min: 0, max: 4, step: 0.1, default: 1 },
    budget: { kind: "range", label: { en: "p95 latency budget", zh: "p95 延迟预算" }, unit: { en: "s", zh: "秒" }, min: 2, max: 30, step: 1, default: 12 },
    floor: { kind: "range", label: { en: "Quality floor", zh: "质量下限" }, unit: { en: "%", zh: "%" }, min: 55, max: 90, step: 1, default: 70 },
  },
  render,
  describe,
});
