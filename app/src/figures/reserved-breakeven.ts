// Pay per use against a flat reserved bill, over the GPU-hours of one
// 720-hour month (the chapter's runnable uses 720). Serverless bills each used
// GPU-hour at a rate r; the reserved bill F is the same at any use.
//
//   serverless  S(h) = r·h           reserved  R = F
//   break-even  h* = F / r,   u* = h* / 720   (the runnable's crossover_utilization)
//
// Below h* serverless is cheaper; above it, reserved. When F / r > 720 the
// reserved bill costs more at every use the month allows. At a chosen use h,
// the reserved bill splits into the share carried by used hours, F·h / 720,
// and the share carried by idle hours, F·(720 − h) / 720; its cost per used
// GPU-hour is F / h.
//
// The default prices are the chapter's placeholders (USD 4 per GPU-hour and
// USD 1,440 a month); they are illustrative, not quotes.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, textBox, overlaps, textWidth, wrap, type Box } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const HOURS = 720;

type P = { rate: number; flat: number; used: number };

function model(p: P) {
  const hStar = p.flat / p.rate;
  const h = Math.min(HOURS, Math.max(0, p.used));
  const S = p.rate * h, R = p.flat;
  return {
    r: p.rate, F: p.flat, h, u: h / HOURS, S, R, hStar, uStar: hStar / HOURS, reachable: hStar <= HOURS,
    usedPart: (p.flat * h) / HOURS, idlePart: (p.flat * (HOURS - h)) / HOURS, perUsed: h > 0 ? p.flat / h : Infinity,
  };
}
type M = ReturnType<typeof model>;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Pay per use against a flat reserved bill",
    chart: "Monthly cost (USD) against GPU-hours used",
    x: "GPU-hours used in a 720-hour month",
    top: "share of the month",
    serverless: "serverless r·h",
    reserved: "reserved F",
    cheaperS: "serverless cheaper",
    cheaperR: "reserved cheaper",
    breakeven: "break-even at {h} hours",
    beyond: "break-even at {u} of the month, off the axis",
    ledger: "The bills at {h} GPU-hours ({u} of the month)",
    barS: "serverless",
    barR: "reserved",
    usedHours: "used hours {v}",
    idleHours: "idle hours {v}",
    fStar: "break-even: h* = F / r = {f} / {r} = {h} GPU-hours = {u} of 720",
    fNever: "break-even: h* = F / r = {f} / {r} = {h} GPU-hours, more than the month's 720, so reserved costs more at any use",
    fAt: "at h = {h}: serverless r·h = {r} × {h} = {s}; reserved F = {f}",
    fPer: "reserved per used GPU-hour F / h = {p} against r = {r}; {i} idle hours carry {c} of the flat bill",
    fNone: "no hours used: the whole flat bill of {f} pays for idle hours",
    cheaper: "cheaper at this use: {who}, by {d} a month",
    even: "at this use the two bills are equal",
    whoS: "serverless",
    whoR: "reserved",
    usd: "USD {v}",
    describe: "Serverless at {r} per GPU-hour against a reserved bill of {f} a month: {be} At {h} GPU-hours, serverless costs {s} and reserved {f}, so {verdict}.",
    beYes: "they break even at {h} GPU-hours, {u} of the 720-hour month.",
    beNo: "they would break even at {h} GPU-hours, beyond the 720-hour month.",
    vS: "serverless is cheaper by {d}",
    vR: "reserved is cheaper by {d}",
    vE: "the bills are equal",
  },
  zh: {
    title: "按量付费与固定预留账单",
    chart: "月成本（美元）随使用的 GPU 小时变化",
    x: "720 小时的一个月中使用的 GPU 小时",
    top: "占全月的比例",
    serverless: "按量付费 r·h",
    reserved: "固定预留 F",
    cheaperS: "按量付费更便宜",
    cheaperR: "固定预留更便宜",
    breakeven: "交叉点 {h} GPU 小时",
    beyond: "交叉点在全月的 {u}，超出坐标范围",
    ledger: "使用 {h} GPU 小时（全月的 {u}）时的两张账单",
    barS: "按量付费",
    barR: "固定预留",
    usedHours: "使用时段 {v}",
    idleHours: "闲置时段 {v}",
    fStar: "交叉点：h* = F / r = {f} / {r} = {h} GPU 小时，占 720 小时的 {u}",
    fNever: "交叉点：h* = F / r = {f} / {r} = {h} GPU 小时，超过一个月的 720 小时，因此无论用多少，固定预留都更贵",
    fAt: "h = {h} 时：按量付费 r·h = {r} × {h} = {s}；固定预留 F = {f}",
    fPer: "固定预留折合每个使用的 GPU 小时 F / h = {p}，按量价格 r = {r}；{i} 个闲置小时分摊了固定账单中的 {c}",
    fNone: "一小时也没用：{f} 的固定账单全部花在闲置时段",
    cheaper: "在这个用量下更便宜的是{who}，每月少 {d}",
    even: "在这个用量下两张账单相等",
    whoS: "按量付费",
    whoR: "固定预留",
    usd: "{v} 美元",
    describe: "按量价格每 GPU 小时 {r}，固定预留每月 {f}：{be}使用 {h} GPU 小时时，按量付费 {s}，固定预留 {f}，因此{verdict}。",
    beYes: "两者在 {h} GPU 小时处持平，占 720 小时的 {u}。",
    beNo: "两者要到 {h} GPU 小时才持平，超出了 720 小时的一个月。",
    vS: "按量付费便宜 {d}",
    vR: "固定预留便宜 {d}",
    vE: "两张账单相等",
  },
};
type L = typeof labels.en;

const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const money = (v: number, Lx: L) => tpl(Lx.usd, { v: v >= 100 ? int(v) : fixed(v, 2) });
const hours = (v: number) => (Number.isInteger(v) ? int(v) : fixed(v, 1));

// ---------------------------------------------------------------- render

function renderChart(m: M, w: number, y0: number, narrow: boolean, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.chart, TYPE.label, w - 12, lang)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  // The share-of-month axis sits above the plot: its title, then its ticks.
  const topTitleY = y + 14 + fs;
  const left = narrow ? 46 : 52, right = w - (narrow ? 16 : 14);
  const top = topTitleY + 6 + fs + 8, ph = narrow ? 200 : 220, bottom = top + ph;
  const xs = linear([0, HOURS], [left, right]);
  const hiCost = Math.max(m.F, m.r * HOURS) * 1.08;
  const step = niceStep(hiCost, 4);
  const yMax = Math.ceil(hiCost / step) * step;
  const ys = linear([0, yMax], [bottom, top]);
  const yt: number[] = [];
  for (let v = 0; v <= yMax + step / 2; v += step) yt.push(v);

  // Regions either side of the break-even.
  const xb = m.reachable ? xs(m.hStar) : right;
  parts.push(el("rect", { x: left, y: top, width: xb - left, height: ph, fill: C.c1, "fill-opacity": 0.05 }));
  if (m.reachable) parts.push(el("rect", { x: xb, y: top, width: right - xb, height: ph, fill: C.c2, "fill-opacity": 0.06 }));
  parts.push(axis({ scale: ys, orient: "left", at: left, ticks: yt, grid: [left, right], size: fs, format: (v) => int(v) }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0, 180, 360, 540, 720], grid: [top, bottom], title: Lx.x, size: fs, format: (v) => int(v) }));
  // Share of the month on top: the same positions read as 0% to 100%.
  parts.push(el("line", { x1: left, x2: right, y1: top, y2: top, stroke: C.rule, "stroke-width": 1 }));
  for (const share of [0, 0.25, 0.5, 0.75, 1]) {
    const px = xs(share * HOURS);
    parts.push(el("line", { x1: px, x2: px, y1: top - 5, y2: top, stroke: C.rule, "stroke-width": 1 }));
    parts.push(text(px, top - 8, pct(share), { "font-size": fs, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(text((left + right) / 2, topTitleY, Lx.top, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));

  const sPts: Array<[number, number]> = [[xs(0), ys(0)], [xs(HOURS), ys(m.r * HOURS)]];
  const rPts: Array<[number, number]> = [[xs(0), ys(m.F)], [xs(HOURS), ys(m.F)]];
  parts.push(el("path", { d: linePath(rPts), fill: "none", stroke: C.c2, "stroke-width": 2.2 }));
  parts.push(el("path", { d: linePath(sPts), fill: "none", stroke: C.c1, "stroke-width": 2.2 }));

  const obstacles: Box[] = [...lineObstacles(sPts), ...lineObstacles(rPts)];
  const bounds = { x0: left + 2, y0: top + 2, x1: right - 2, y1: bottom - 2 };
  // Place one label, trying each anchor in turn; placed boxes become obstacles.
  type Req = Parameters<typeof placeLabels>[0][number];
  const place = (anchors: Array<[number, number]>, req: Omit<Req, "x" | "y">): boolean => {
    for (const [ax, ay] of anchors) {
      const got = placeLabels([{ ...req, x: ax, y: ay }], bounds, obstacles).placed;
      if (got.length) { parts.push(drawLabels(got)); obstacles.push(got[0].box); return true; }
    }
    return false;
  };

  // Current use on both lines.
  const cx = xs(m.h);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  for (const [v, color] of [[m.S, C.c1], [m.R, C.c2]] as const) {
    const cy = ys(v);
    parts.push(el("circle", { cx, cy, r: 4.5, fill: color, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 });
  }

  // Break-even marker, labeled beside the point or, when there is no room,
  // at the top of its guide line.
  if (m.reachable) {
    const by = ys(m.F);
    const beText = tpl(Lx.breakeven, { h: hours(Math.round(m.hStar * 10) / 10) });
    parts.push(el("circle", { cx: xb, cy: by, r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: xb - 6, y0: by - 6, x1: xb + 6, y1: by + 6 });
    const near = place([[xb, by]], { text: beText, size: TYPE.body, gap: 9, priority: 3, sides: ["above-left", "above-right", "above", "below-right", "below-left"], attrs: { class: "fig-t-halo fig-t-strong" } });
    const guideTop = near ? by : top;
    parts.push(el("line", { x1: xb, x2: xb, y1: guideTop, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    obstacles.push(...lineObstacles([[xb, guideTop], [xb, bottom]]));
    if (!near) {
      const anchor = xb + 6 + textWidth(beText, TYPE.body) <= right ? "start" : "end";
      parts.push(text(anchor === "start" ? xb + 6 : xb - 6, top + TYPE.body + 4, beText, { "font-size": TYPE.body, "text-anchor": anchor, class: "fig-t-halo fig-t-strong" }));
    }
  } else {
    const t = tpl(Lx.beyond, { u: pct(m.uStar) });
    const tl = lines(t, TYPE.body, Math.min(280, right - left - 12), lang);
    tl.forEach((ln, i) => parts.push(text(right - 6, top + TYPE.body + 4 + i * (TYPE.body + 4), ln, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-halo fig-t-strong" })));
  }

  // Region names in a corner of each region, top first, clear of both lines.
  const region = (name: string, x: number, anchor: "start" | "end", x0: number, x1: number) => {
    if (x1 - x0 < textWidth(name, fs) + 12) return;
    for (const yy of [top + fs + 6, bottom - 8]) {
      const box = textBox(x, yy, name, fs, anchor);
      if (obstacles.some((b) => overlaps(b, box, 2))) continue;
      parts.push(text(x, yy, name, { "font-size": fs, "text-anchor": anchor, class: "fig-t-muted" }));
      obstacles.push(box);
      return;
    }
  };

  // Line names, trying several points along each line.
  place([0.9, 0.7, 0.5, 0.3].map((f) => [xs(HOURS * f), ys(m.r * HOURS * f)] as [number, number]), { text: Lx.serverless, size: TYPE.body, gap: 8, priority: 2, sides: ["above-left", "below-right", "left", "right"], attrs: { class: "fig-t-halo" } });
  place([0.12, 0.5, 0.85].map((f) => [xs(HOURS * f), ys(m.F)] as [number, number]), { text: Lx.reserved, size: TYPE.body, gap: 7, priority: 1, sides: ["above-right", "below-right", "above", "below"], attrs: { class: "fig-t-halo" } });
  region(Lx.cheaperS, left + 6, "start", left, xb);
  if (m.reachable) region(Lx.cheaperR, right - 6, "end", xb, right);
  return { svg: g({ class: "fig-chart" }, ...parts), h: bottom + axisHeight(true, fs) - y0 };
}

// Two bills on one dollar scale; the reserved bill split by used and idle hours.
function renderLedger(m: M, w: number, y0: number, uid: string, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(tpl(Lx.ledger, { h: hours(m.h), u: pct(m.u) }), TYPE.label, w - 12, lang)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 10;
  const nameW = Math.max(textWidth(Lx.barS, TYPE.body), textWidth(Lx.barR, TYPE.body)) + 12;
  const valW = textWidth(money(Math.max(m.S, m.R, 9999), Lx), TYPE.body) + 10;
  const x0 = nameW, bw = Math.max(60, w - nameW - valW);
  const scale = bw / Math.max(m.S, m.R, 1);
  const barH = 18;
  // Serverless bill.
  parts.push(text(0, y + 13, Lx.barS, { "font-size": TYPE.body }));
  parts.push(el("rect", { x: x0, y, width: Math.max(1, m.S * scale), height: barH, rx: 3, fill: C.c1 }));
  parts.push(text(w, y + 13, money(m.S, Lx), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" + (m.S <= m.R ? " fig-t-strong" : "") }));
  y += barH + 8;
  // Reserved bill: used share solid, idle share hatched.
  parts.push(text(0, y + 13, Lx.barR, { "font-size": TYPE.body }));
  const uw = m.usedPart * scale, iw = m.idlePart * scale;
  if (uw > 0.5) parts.push(el("rect", { x: x0, y, width: uw, height: barH, rx: 3, fill: C.c2 }));
  if (iw > 0.5) {
    parts.push(el("rect", { x: x0 + uw, y, width: iw, height: barH, rx: 3, fill: `url(#${uid}-idle)` }));
    parts.push(el("rect", { x: x0 + uw + 0.5, y: y + 0.5, width: Math.max(0, iw - 1), height: barH - 1, rx: 3, fill: "none", stroke: C.c2, "stroke-width": 1 }));
  }
  parts.push(text(w, y + 13, money(m.R, Lx), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" + (m.R < m.S ? " fig-t-strong" : "") }));
  y += barH + 4;
  // Split labels under the reserved bar, each under its part when it fits.
  const lu = tpl(Lx.usedHours, { v: money(m.usedPart, Lx) }), li = tpl(Lx.idleHours, { v: money(m.idlePart, Lx) });
  const ly = y + fs + 2;
  const luw = textWidth(lu, fs), liw = textWidth(li, fs);
  if (luw + liw + 16 <= bw + valW - 4) {
    parts.push(text(x0, ly, lu, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    const ix = Math.max(x0 + luw + 16, Math.min(x0 + uw, w - liw));
    parts.push(text(ix, ly, li, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    y = ly + 6;
  } else {
    parts.push(text(x0, ly, lu, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    parts.push(text(x0, ly + fs + 5, li, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    y = ly + fs + 11;
  }
  return { svg: g({ class: "fig-ledger" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  const d = Math.abs(m.S - m.R);
  const be = m.reachable ? tpl(Lx.beYes, { h: hours(Math.round(m.hStar * 10) / 10), u: pct(m.uStar) }) : tpl(Lx.beNo, { h: hours(Math.round(m.hStar * 10) / 10) });
  const verdict = d < 0.005 ? Lx.vE : m.S < m.R ? tpl(Lx.vS, { d: money(d, Lx) }) : tpl(Lx.vR, { d: money(d, Lx) });
  return tpl(Lx.describe, { r: money(m.r, Lx), f: money(m.F, Lx), be: lang === "en" ? `${be} ` : be, h: hours(m.h), s: money(m.S, Lx), verdict });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const m = model(st.p);
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-idle`, C.c2, 5, 1.2))];
  const ch = renderChart(m, w, 0, narrow, Lx, lang, fs);
  parts.push(ch.svg);
  let y = ch.h + 16;
  const lg = renderLedger(m, w, y, st.uid, Lx, lang, fs);
  parts.push(lg.svg);
  y += lg.h + 10;

  const rows: Array<[string, string]> = [];
  const hs = hours(Math.round(m.hStar * 10) / 10);
  rows.push([m.reachable ? tpl(Lx.fStar, { f: int(m.F), r: fixed(m.r, 2), h: hs, u: pct(m.uStar) }) : tpl(Lx.fNever, { f: int(m.F), r: fixed(m.r, 2), h: hs }), "fig-t-strong"]);
  rows.push([tpl(Lx.fAt, { h: hours(m.h), r: fixed(m.r, 2), s: money(m.S, Lx), f: money(m.F, Lx) }), "fig-t-num"]);
  rows.push([m.h > 0 ? tpl(Lx.fPer, { p: money(m.perUsed, Lx), r: money(m.r, Lx), i: hours(HOURS - m.h), c: money(m.idlePart, Lx) }) : tpl(Lx.fNone, { f: money(m.F, Lx) }), ""]);
  const d = Math.abs(m.S - m.R);
  rows.push([d < 0.005 ? Lx.even : tpl(Lx.cheaper, { who: m.S < m.R ? Lx.whoS : Lx.whoR, d: money(d, Lx) }), "fig-t-strong"]);
  const ro: string[] = [];
  for (const [line, cls] of rows) {
    for (const part of lines(line, TYPE.body, w, lang)) { y += 17; ro.push(text(0, y, part, { "font-size": TYPE.body, class: cls })); }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "reserved-breakeven",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    rate: { kind: "range", label: { en: "Serverless price per GPU-hour, r", zh: "每 GPU 小时的按量价格 r" }, unit: { en: "USD", zh: "美元" }, min: 1, max: 10, step: 0.25, default: 4 },
    flat: { kind: "range", label: { en: "Reserved flat bill per month, F", zh: "每月的固定预留账单 F" }, unit: { en: "USD", zh: "美元" }, min: 360, max: 2880, step: 60, default: 1440 },
    used: {
      kind: "range", label: { en: "GPU-hours used this month, h", zh: "本月使用的 GPU 小时 h" }, unit: { en: "hours", zh: "小时" }, min: 0, max: HOURS, step: 8, default: 240,
      marks: [
        { value: 176, label: { en: "8 h × 22 workdays", zh: "8 小时 × 22 个工作日" } },
        { value: 720, label: { en: "24/7", zh: "全天候" } },
      ],
    },
  },
  render,
  describe,
});
