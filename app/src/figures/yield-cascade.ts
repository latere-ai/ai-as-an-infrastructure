// From candidate dies to accepted shipments, measured at the test boundaries
// the making-the-silicon chapter names: wafer probe (die yield), HBM stack
// yield, interposer or substrate yield, assembly yield, and final test.
//
// Logic supply follows the chapter's G_L = W_L · D_L · Y_L, where Y_L is the
// share of candidate dies that wafer probe accepts. Probe is modeled with
// imperfect coverage: of the dies that are defect-free (share f) all pass, and
// of the defective ones a share c is caught, so
//
//   Y_L = f + (1 − f)(1 − c),   q_L = f / Y_L
//
// where q_L is the share of accepted dies that actually work. Every package
// takes d logic dies, h HBM stacks, one interposer and one substrate, and is
// accepted at final test only if all of them work and assembly succeeds:
//
//   final-test yield = q_L^d · q_H^h · q_S · y_A
//
// Losses at final test are attributed to the first failing part in the order
// logic, HBM, interposer or substrate, assembly, so the four causes add up to
// the rejected packages. Good dies and stacks inside rejected packages are
// counted as scrapped. All settings are illustrative; none is a measured
// yield.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { legend } from "./lib/legend.ts";
import { int, pct, fixed, tpl } from "./lib/format.ts";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).split("").map((ch) => SUP[Number(ch)]).join("");

const labels = {
  en: {
    title: "Yield at each test boundary",
    unit: "package-equivalents (d = {d} logic dies per package)",
    sCand: "Candidate dies",
    sProbe: "Accepted at wafer probe",
    sAsm: "Assembled packages",
    sFinal: "Pass final test",
    dCand: "W_L · D_L = {w} × {n} = {v} dies",
    dProbe: "G_L = W_L · D_L · Y_L = {v} dies",
    dAsm: "⌊G_L / d⌋, each with {h} HBM {hs}",
    dFinal: "accepted shipments",
    stack: "stack", stacks: "stacks",
    lgPass: "passes",
    lgEscape: "defective die accepted at probe",
    lgProbe: "rejected at probe",
    lgLogic: "rejected: logic die",
    lgHbm: "rejected: HBM stack",
    lgSub: "rejected: interposer or substrate",
    lgAsm: "rejected: assembly",
    yl: "Y_L = f + (1 − f)(1 − c) = {f} + {nf} × {nc} = {yl}",
    ft: "final-test yield = q_L{d} · q_H{h} · q_S · y_A = {ql}{d} × {qh}{h} × {qs} × {ya} = {y}",
    e2e: "End to end, {s} of {c} candidate package-equivalents ship ({p}); the highest single-boundary yield is {best}.",
    scrap: "The {r} rejected packages carry {gl} working logic dies and {gh} working HBM stacks.",
    full: "With probe catching every defective die, Y_L would read {yl}, {a} packages would be assembled, and {s} would ship.",
    illustrative: "Illustrative settings, not measured yields.",
    describe: "Wafer probe accepts {yl} of candidate dies, of which {ql} work; final-test yield is {y}, so {s} of {c} candidate package-equivalents ship ({p}). Rejected packages scrap {gh} working HBM stacks.",
  },
  zh: {
    title: "各测试边界上的良率",
    unit: "封装等价量（每个封装 d = {d} 块逻辑裸片）",
    sCand: "候选裸片",
    sProbe: "通过晶圆测试",
    sAsm: "装配完成的封装",
    sFinal: "通过最终测试",
    dCand: "W_L · D_L = {w} × {n} = {v} 块裸片",
    dProbe: "G_L = W_L · D_L · Y_L = {v} 块裸片",
    dAsm: "⌊G_L / d⌋，每个含 {h} 个 HBM 堆栈",
    dFinal: "验收出货",
    stack: "堆栈", stacks: "堆栈",
    lgPass: "通过",
    lgEscape: "晶圆测试漏检的坏裸片",
    lgProbe: "晶圆测试剔除",
    lgLogic: "剔除原因：逻辑裸片",
    lgHbm: "剔除原因：HBM 堆栈",
    lgSub: "剔除原因：中介层或基板",
    lgAsm: "剔除原因：装配",
    yl: "Y_L = f + (1 − f)(1 − c) = {f} + {nf} × {nc} = {yl}",
    ft: "最终测试良率 = q_L{d} · q_H{h} · q_S · y_A = {ql}{d} × {qh}{h} × {qs} × {ya} = {y}",
    e2e: "从头到尾，{c} 个候选封装等价量中有 {s} 个出货（{p}）；单个边界上的最高良率是 {best}。",
    scrap: "被剔除的 {r} 个封装里，还有 {gl} 块能工作的逻辑裸片和 {gh} 个能工作的 HBM 堆栈。",
    full: "如果晶圆测试能查出所有坏裸片，Y_L 会显示为 {yl}，装配 {a} 个封装，出货 {s} 个。",
    illustrative: "数值均为示例设置，不是实测良率。",
    describe: "晶圆测试接收 {yl} 的候选裸片，其中 {ql} 能工作；最终测试良率为 {y}，{c} 个候选封装等价量中有 {s} 个出货（{p}）。被剔除的封装报废了 {gh} 个能工作的 HBM 堆栈。",
  },
};

type P = { f: number; c: number; h: number; qh: number; ya: number; d: number; wafers: number; perWafer: number; qs: number };

function model(p: P) {
  const f = p.f / 100, c = p.c / 100, qh = p.qh / 100, ya = p.ya / 100, qs = p.qs / 100;
  const cand = p.wafers * p.perWafer;
  const yl = f + (1 - f) * (1 - c);
  const ql = f / yl;
  const accepted = Math.round(cand * yl);
  const escapes = Math.round(cand * (1 - f) * (1 - c));
  const asm = Math.floor(accepted / p.d);
  const qld = ql ** p.d, qhh = qh ** p.h;
  const ft = qld * qhh * qs * ya;
  const ship = Math.round(asm * ft);
  // Sequential attribution of final-test rejects to the first failing part.
  const lossLogic = asm * (1 - qld);
  const lossHbm = asm * qld * (1 - qhh);
  const lossSub = asm * qld * qhh * (1 - qs);
  const lossAsm = asm * qld * qhh * qs * (1 - ya);
  const rejected = asm - ship;
  const goodLogicScrap = Math.max(0, Math.round(asm * p.d * ql - ship * p.d));
  const goodHbmScrap = Math.max(0, Math.round(asm * p.h * qh - ship * p.h));
  // The same line with a probe that catches every defective die.
  const accFull = Math.round(cand * f);
  const asmFull = Math.floor(accFull / p.d);
  const shipFull = Math.round(asmFull * qhh * qs * ya);
  const candPe = cand / p.d;
  const best = Math.max(yl, qh, qs, ya);
  return { f, c, qh, ya, qs, cand, yl, ql, accepted, escapes, asm, ft, ship, lossLogic, lossHbm, lossSub, lossAsm, rejected,
    goodLogicScrap, goodHbmScrap, accFull, asmFull, shipFull, candPe, best };
}

const f2 = (v: number) => fixed(v, 2);
const f3 = (v: number) => fixed(v, 3);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, {
    yl: pct(m.yl, 1), ql: pct(m.ql, 1), y: pct(m.ft, 1), s: int(m.ship), c: int(m.candPe), p: pct(m.ship / m.candPe, 1), gh: int(m.goodHbmScrap),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const m = model(p);
  const hatchId = `${st.uid}-escape`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.c2, 4, 1.6))];

  const lg = legend([
    { label: L.lgPass, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lgProbe, swatch: { kind: "rect", fill: C.panel, stroke: C.ink3 } },
    { label: L.lgEscape, swatch: { kind: "rect", fill: C.c2, pattern: hatchId } },
    { label: L.lgLogic, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lgHbm, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.lgSub, swatch: { kind: "rect", fill: C.c4 } },
    { label: L.lgAsm, swatch: { kind: "rect", fill: C.c5 } },
  ], 0, 0, w, fs);
  parts.push(lg.svg);
  let y = lg.height + 12;
  parts.push(text(0, y + fs, tpl(L.unit, { d: p.d }), { "font-size": fs, class: "fig-t-muted" }));
  y += fs + 14;

  const stages = [
    { name: L.sCand, detail: tpl(L.dCand, { w: p.wafers, n: p.perWafer, v: int(m.cand) }), value: m.candPe },
    { name: L.sProbe, detail: tpl(L.dProbe, { v: int(m.accepted) }), value: m.accepted / p.d },
    { name: L.sAsm, detail: tpl(L.dAsm, { h: p.h, hs: p.h === 1 ? L.stack : L.stacks }), value: m.asm },
    { name: L.sFinal, detail: L.dFinal, value: m.ship },
  ];
  const labelW = narrow ? 0 : Math.min(w * 0.42, Math.max(...stages.map((s) => Math.max(textWidth(s.name, fs), textWidth(s.detail, fs)))) + 14);
  const valW = textWidth(int(m.candPe), fs) + 10;
  const bx0 = labelW, bx1 = w - valW;
  const xs = linear([0, m.candPe], [bx0, bx1]);
  const barH = 20;
  const rowH = narrow ? 76 : 58; // bars leave room for the band between them
  const barTop = (i: number) => y + i * rowH + (narrow ? 34 : 8);

  // The band: from the part of one bar that goes on to the next bar. On a
  // phone the stage labels sit between the bars, so the band is left out.
  const carried = [m.accepted / p.d, m.asm, m.ship];
  for (let i = 0; i < (narrow ? 0 : 3); i++) {
    const y0 = barTop(i) + barH, y1 = barTop(i + 1);
    const a = xs(carried[i]), b = xs(stages[i + 1].value);
    parts.push(el("path", { d: `M${bx0},${y0}L${a},${y0}L${b},${y1}L${bx0},${y1}Z`, fill: C.c1, "fill-opacity": 0.1 }));
  }

  stages.forEach((s, i) => {
    const by = barTop(i);
    if (narrow) {
      parts.push(text(0, by - 20, s.name, { "font-size": fs, class: i === 3 ? "fig-t-strong" : undefined }));
      parts.push(text(0, by - 6, s.detail, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    } else {
      parts.push(text(0, by + 7, s.name, { "font-size": fs, class: i === 3 ? "fig-t-strong" : undefined }));
      parts.push(text(0, by + 23, s.detail, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    }
    const xv = xs(s.value);
    parts.push(el("rect", { x: bx0, y: by, width: Math.max(1, xv - bx0), height: barH, rx: 3, fill: C.c1 }));
    parts.push(text(w, by + barH / 2 + fs * 0.35, int(s.value), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${i === 3 ? " fig-t-strong" : ""}` }));
    if (i === 1) {
      // Rejected at probe: the rest of the candidate bar, and the accepted
      // dies that are defective, at the end of the accepted bar.
      const xc = xs(m.candPe);
      parts.push(el("rect", { x: xv, y: by + 0.5, width: Math.max(0, xc - xv), height: barH - 1, rx: 3, fill: C.panel, stroke: C.ink3, "stroke-width": 1 }));
      const xe = xs((m.accepted - m.escapes) / p.d);
      if (xv - xe > 0.3) parts.push(el("rect", { x: xe, y: by, width: xv - xe, height: barH, fill: `url(#${hatchId})` }));
    }
    if (i === 3) {
      // Final-test rejects, by the first failing part.
      let x0 = xv;
      for (const [v, col] of [[m.lossLogic, C.c2], [m.lossHbm, C.c3], [m.lossSub, C.c4], [m.lossAsm, C.c5]] as const) {
        const x1 = x0 + (xs(v) - bx0);
        if (x1 - x0 > 0.3) parts.push(el("rect", { x: x0, y: by, width: x1 - x0, height: barH, fill: col }));
        x0 = x1;
      }
    }
  });
  y = barTop(3) + barH + (narrow ? 28 : 40);

  // Readout: the two yield equations with their terms, then the totals.
  const wrapL = (s: string, mw: number) => (lang === "zh" ? wrapCjk(s, fs, mw) : wrap(s, fs, mw));
  const lines: Array<[string, string]> = [
    [tpl(L.yl, { f: f2(m.f), nf: f2(1 - m.f), nc: f2(1 - m.c), yl: f3(m.yl) }), ""],
    [tpl(L.ft, { d: sup(p.d), h: sup(p.h), ql: f3(m.ql), qh: f3(m.qh), qs: f3(m.qs), ya: f3(m.ya), y: f3(m.ft) }), ""],
    [tpl(L.e2e, { s: int(m.ship), c: int(m.candPe), p: pct(m.ship / m.candPe, 1), best: pct(m.best, 1) }), "fig-t-strong"],
    [tpl(L.scrap, { r: int(m.rejected), gl: int(m.goodLogicScrap), gh: int(m.goodHbmScrap) }), ""],
    // The counterfactual line only while probe misses some defective dies.
    ...(m.c < 1 ? [[tpl(L.full, { yl: pct(m.f, 1), a: int(m.asmFull), s: int(m.shipFull) }), ""] as [string, string]] : []),
    [L.illustrative, "fig-t-muted"],
  ];
  const ro: string[] = [];
  for (const [s, cls] of lines) {
    for (const ln of wrapL(s, cls.includes("strong") ? w / 1.1 : w)) { ro.push(text(0, y, ln, { "font-size": fs, class: cls || undefined })); y += fs + 6; }
    y += 4;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "yield-cascade",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    c: {
      kind: "range", label: { en: "Probe coverage c (share of defective dies caught)", zh: "晶圆测试覆盖率 c（坏裸片被查出的比例）" },
      unit: { en: "%", zh: "%" }, min: 0, max: 100, step: 5, default: 90,
    },
    f: {
      kind: "range", label: { en: "Defect-free dies f", zh: "无缺陷裸片比例 f" }, unit: { en: "%", zh: "%" },
      min: 40, max: 99, step: 1, default: 80,
    },
    h: { kind: "range", label: { en: "HBM stacks per package h", zh: "每个封装的 HBM 堆栈数 h" }, min: 1, max: 12, step: 1, default: 4 },
    qh: {
      kind: "range", label: { en: "HBM stack yield q_H", zh: "HBM 堆栈良率 q_H" }, unit: { en: "%", zh: "%" },
      min: 90, max: 100, step: 0.5, default: 99,
    },
    ya: {
      kind: "range", label: { en: "Assembly yield y_A", zh: "装配良率 y_A" }, unit: { en: "%", zh: "%" },
      min: 85, max: 100, step: 0.5, default: 98,
    },
    d: { kind: "range", label: { en: "Logic dies per package d", zh: "每个封装的逻辑裸片数 d" }, min: 1, max: 4, step: 1, default: 2, control: false },
    wafers: { kind: "range", label: { en: "Completed logic wafers W_L", zh: "完工逻辑晶圆 W_L" }, min: 10, max: 1000, step: 10, default: 100, control: false },
    perWafer: { kind: "range", label: { en: "Candidate dies per wafer D_L", zh: "每片晶圆的候选裸片 D_L" }, min: 10, max: 200, step: 1, default: 60, control: false },
    qs: {
      kind: "range", label: { en: "Interposer and substrate yield q_S", zh: "中介层与基板良率 q_S" }, unit: { en: "%", zh: "%" },
      min: 90, max: 100, step: 0.5, default: 99, control: false,
    },
  },
  render,
  describe,
});
