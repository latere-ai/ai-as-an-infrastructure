// Why uplift measured on old tasks, on new tasks, and in value differ, after
// Cunningham and Whitfill, "Task Substitution and Uplift" (METR, 2026-05-08).
// A worker with an 8-hour day splits time between documents and pull requests
// to maximize value, before and after a tool changes the hours each takes:
//
//   uplift on old tasks  = hours for the pre-tool bundle x⁰ without the tool
//                          ÷ hours for x⁰ with it          Σ τ⁰ᵢ x⁰ᵢ / Σ τ¹ᵢ x⁰ᵢ
//   uplift on new tasks  = the same ratio for the bundle x¹ chosen with the tool
//   uplift in value      = V(with the tool) ÷ V(without), at the same 8 hours
//
// Value is CES in the task counts, V = (Σ aᵢ xᵢ^ρ)^(1/ρ) with ρ = (σ − 1)/σ
// and equal weights aᵢ, so the time share of task i is
// aᵢ^σ τᵢ^(1−σ) / Σⱼ aⱼ^σ τⱼ^(1−σ) and the value of a day is T / e(τ) with the
// unit cost e(τ) = (Σ aᵢ^σ τᵢ^(1−σ))^(1/(1−σ)); σ = 1 is the Cobb-Douglas
// limit with fixed time shares. For a maximizer with correct beliefs the
// ordering old ≤ value ≤ new follows from the Konüs price-index bounds. The
// two presets are the source's worked examples: pull requests from 1 h to
// 0.5 h (+33%, +50%, value between) and from 5 h to 1 h (+67%, +124%, +200%),
// which σ = 1 reproduces.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { sig, tpl } from "./lib/format.ts";

const DAY = 8; // hours
const DOC_BEFORE = 1; // hours per document without the tool

type P = { example: "small" | "large" | "custom"; prBefore: number; prAfter: number; docAfter: number; sigma: number };

const PRESETS = {
  small: { prBefore: 1, prAfter: 0.5, docAfter: 1, sigma: 1 },
  large: { prBefore: 5, prAfter: 1, docAfter: 1, sigma: 1 },
} as const;

// Time shares and the unit cost of value under CES with equal weights.
function shares(tau: number[], sigma: number): number[] {
  const s = Math.abs(sigma - 1) < 1e-9 ? tau.map(() => 1) : tau.map((t) => t ** (1 - sigma));
  const z = s.reduce((a, b) => a + b, 0);
  return s.map((v) => v / z);
}
function unitCost(tau: number[], sigma: number): number {
  const a = 1 / tau.length;
  if (Math.abs(sigma - 1) < 1e-9) return tau.reduce((acc, t) => acc * (t / a) ** a, 1);
  return tau.reduce((acc, t) => acc + a ** sigma * t ** (1 - sigma), 0) ** (1 / (1 - sigma));
}

function model(p: P) {
  const t0 = [DOC_BEFORE, p.prBefore], t1 = [p.docAfter, p.prAfter];
  const w0 = shares(t0, p.sigma), w1 = shares(t1, p.sigma);
  const x0 = w0.map((w, i) => (w * DAY) / t0[i]), x1 = w1.map((w, i) => (w * DAY) / t1[i]);
  const hours = (x: number[], t: number[]) => x.reduce((a, v, i) => a + v * t[i], 0);
  const oldBefore = hours(x0, t0), oldAfter = hours(x0, t1);
  const newBefore = hours(x1, t0), newAfter = hours(x1, t1);
  return {
    t0, t1, w0, w1, x0, x1, oldBefore, oldAfter, newBefore, newAfter,
    upOld: oldBefore / oldAfter, upNew: newBefore / newAfter, upValue: unitCost(t0, p.sigma) / unitCost(t1, p.sigma),
  };
}

const labels = {
  en: {
    title: "Uplift on old tasks, in value, and on new tasks",
    before: "Before the tool", after: "With the tool",
    docs: "documents", prs: "pull requests",
    seg: "{n} {what}, {h} h",
    segShort: "{n}, {h} h",
    hours: "hours of an 8-hour day",
    bundles: "The same bundles timed both ways",
    colBefore: "without", colAfter: "with", colUp: "uplift", h: " h",
    oldRow: "old tasks: {d} docs, {p} PRs",
    newRow: "new tasks: {d} docs, {p} PRs",
    valueRow: "value: V with ÷ V without",
    axis: "uplift, × (1 = no change)",
    old: "old tasks", value: "value", new: "new tasks",
    order: "old tasks ≤ value ≤ new tasks",
    describe: "Pull requests take {pa} h with the tool and {pb} h without; documents take {da} h with it and 1 h without; substitutability σ = {s}. With the tool the day holds {d1} documents and {p1} pull requests instead of {d0} and {p0}. Uplift on old tasks is {uo}, in value {uv}, and on new tasks {un}.",
  },
  zh: {
    title: "旧任务、价值与新任务上的提升倍数",
    before: "使用工具前", after: "使用工具后",
    docs: "份文档", prs: "个 PR",
    seg: "{n} {what}，{h} 小时",
    segShort: "{n}，{h} 小时",
    hours: "8 小时工作日中的小时数",
    bundles: "同一组任务分别按两种条件计时",
    colBefore: "不用工具", colAfter: "用工具", colUp: "提升", h: " 小时",
    oldRow: "旧任务：{d} 份文档，{p} 个 PR",
    newRow: "新任务：{d} 份文档，{p} 个 PR",
    valueRow: "价值：用工具的 V ÷ 不用的 V",
    axis: "提升倍数（1 = 不变）",
    old: "旧任务", value: "价值", new: "新任务",
    order: "旧任务 ≤ 价值 ≤ 新任务",
    describe: "每个 PR 用工具需 {pa} 小时，不用需 {pb} 小时；每份文档用工具需 {da} 小时，不用需 1 小时；可替代程度 σ = {s}。用工具后，一天完成 {d1} 份文档和 {p1} 个 PR，原来是 {d0} 份和 {p0} 个。旧任务上的提升为 {uo}，价值提升为 {uv}，新任务上的提升为 {un}。",
  },
};
type L = typeof labels.en;

const cnt = (v: number) => sig(v, 2);
const hrs = (v: number) => sig(v, 3);
const times = (v: number) => `${sig(v, 3)}×`;
const pctUp = (v: number) => `${v >= 1 ? "+" : "−"}${Math.round(Math.abs(v - 1) * 100)}%`;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    pb: hrs(p.prBefore), pa: hrs(p.prAfter), da: hrs(p.docAfter), s: sig(p.sigma, 2),
    d0: cnt(m.x0[0]), p0: cnt(m.x0[1]), d1: cnt(m.x1[0]), p1: cnt(m.x1[1]),
    uo: `${times(m.upOld)} (${pctUp(m.upOld)})`, uv: `${times(m.upValue)} (${pctUp(m.upValue)})`, un: `${times(m.upNew)} (${pctUp(m.upNew)})`,
  });
}

// One 8-hour day split between the two tasks.
function dayBar(label: string, x: number[], w: number[], y0: number, w0: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const labelW = narrow ? 0 : 118;
  const by = narrow ? y0 + 20 : y0;
  parts.push(text(0, narrow ? y0 + 13 : y0 + 17, label, { "font-size": TYPE.body, class: "fig-t-strong" }));
  const X = linear([0, DAY], [labelW, w0]);
  let at = 0;
  const cols = [C.c1, C.c2];
  const what = [L.docs, L.prs];
  for (let i = 0; i < 2; i++) {
    const h = w[i] * DAY;
    const x0 = X(at), x1 = X(at + h);
    parts.push(el("rect", { x: x0, y: by, width: Math.max(0.5, x1 - x0 - 1), height: 24, rx: 3, fill: cols[i], "fill-opacity": 0.35, stroke: cols[i], "stroke-width": 1.2 }));
    const full = tpl(L.seg, { n: cnt(x[i]), what: what[i], h: hrs(h) });
    const short = tpl(L.segShort, { n: cnt(x[i]), h: hrs(h) });
    const lbl = textWidth(full, TYPE.body) <= x1 - x0 - 8 ? full : textWidth(short, TYPE.body) <= x1 - x0 - 8 ? short : "";
    if (lbl) parts.push(text((x0 + x1) / 2, by + 16, lbl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-num" }));
    at += h;
  }
  for (let hr = 0; hr <= DAY; hr++) parts.push(el("line", { x1: X(hr), x2: X(hr), y1: by + 24, y2: by + 28, stroke: C.rule, "stroke-width": 1 }));
  return { svg: g({}, ...parts), h: (narrow ? 20 : 0) + 32 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  let y = 0;

  // Legend for the two tasks.
  let lx = 0;
  for (const [c, t] of [[C.c1, L.docs], [C.c2, L.prs]] as const) {
    const name = lang === "zh" ? t.replace(/^[份个]\s*/, "") : t;
    parts.push(el("rect", { x: lx, y: y + 2, width: 12, height: 11, rx: 2, fill: c, "fill-opacity": 0.35, stroke: c, "stroke-width": 1.2 }));
    parts.push(text(lx + 17, y + 12, name, { "font-size": TYPE.small, class: "fig-t-muted" }));
    lx += 17 + textWidth(name, TYPE.small) + 18;
  }
  y += 24;
  const b0 = dayBar(L.before, m.x0, m.w0, y, w, narrow, L);
  parts.push(b0.svg); y += b0.h + 8;
  const b1 = dayBar(L.after, m.x1, m.w1, y, w, narrow, L);
  parts.push(b1.svg); y += b1.h;
  // Hour labels under the second bar.
  const X = linear([0, DAY], [narrow ? 0 : 118, w]);
  for (let hr = 0; hr <= DAY; hr += narrow ? 2 : 1) parts.push(text(X(hr), y + 8, hr, { "font-size": TYPE.small, "text-anchor": hr === 0 ? "start" : hr === DAY ? "end" : "middle", class: "fig-t-num fig-t-muted" }));
  parts.push(text(narrow ? w / 2 : (X(0) + X(DAY)) / 2, y + 24, L.hours, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  y += 44;

  // The bundles timed both ways.
  parts.push(text(0, y + 13, L.bundles, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 24;
  // Columns sized to their widest entry so numbers never touch at 320 px.
  const upText = (v: number) => `${times(v)} ${pctUp(v)}`;
  // The uplift column is set in bold, about a tenth wider than the estimate.
  const upW = Math.max(...[m.upOld, m.upValue, m.upNew].map((v) => textWidth(upText(v), TYPE.body) * 1.12), textWidth(L.colUp, TYPE.small));
  const hW = Math.max(...[m.oldBefore, m.oldAfter, m.newBefore, m.newAfter].map((v) => textWidth(`${hrs(v)}${L.h}`, TYPE.body)), textWidth(L.colBefore, TYPE.small), textWidth(L.colAfter, TYPE.small));
  const gap = narrow ? 12 : 28;
  const cU = w, cA = cU - upW - gap, cB = cA - hW - gap;
  parts.push(text(cB, y + 10, L.colBefore, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(cA, y + 10, L.colAfter, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(cU, y + 10, L.colUp, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
  y += 16;
  const rows: Array<[string, string, string, number]> = [
    [tpl(L.oldRow, { d: cnt(m.x0[0]), p: cnt(m.x0[1]) }), `${hrs(m.oldBefore)}${L.h}`, `${hrs(m.oldAfter)}${L.h}`, m.upOld],
    [L.valueRow, "", "", m.upValue],
    [tpl(L.newRow, { d: cnt(m.x1[0]), p: cnt(m.x1[1]) }), `${hrs(m.newBefore)}${L.h}`, `${hrs(m.newAfter)}${L.h}`, m.upNew],
  ];
  for (const [name, a, b, up] of rows) {
    const nameW = cB - hW - gap;
    const lines = wrapCJK(name, TYPE.body, Math.max(80, nameW));
    const h = lines.length * 16 + 8;
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    lines.forEach((ln, k) => parts.push(text(0, y + 15 + k * 16, ln, { "font-size": TYPE.body })));
    parts.push(text(cB, y + 15, a, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(cA, y + 15, b, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    parts.push(text(cU, y + 15, upText(up), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    y += h;
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  y += 22;

  // The three uplifts on one axis.
  const hi = Math.max(2, m.upNew * 1.12);
  const lo = Math.min(1, m.upOld * 0.9);
  const U = linear([lo, hi], [12, w - 12]);
  const ay = y + 40;
  parts.push(el("line", { x1: U(lo), x2: U(hi), y1: ay, y2: ay, stroke: C.rule, "stroke-width": 1 }));
  for (const t of U.ticks(narrow ? 4 : 6)) {
    parts.push(el("line", { x1: U(t), x2: U(t), y1: ay, y2: ay + 4, stroke: C.rule, "stroke-width": 1 }));
    parts.push(text(U(t), ay + 17, `${sig(t, 3)}×`, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(el("line", { x1: U(m.upOld), x2: U(m.upNew), y1: ay - 10, y2: ay - 10, stroke: C.ink3, "stroke-width": 6, "stroke-linecap": "round", "stroke-opacity": 0.35 }));
  // Names above the three points, pushed apart and kept inside the figure.
  const marks = [
    { v: m.upOld, name: L.old, strong: false }, { v: m.upValue, name: L.value, strong: true }, { v: m.upNew, name: L.new, strong: false },
  ].map((k) => ({ ...k, px: U(k.v), tw: textWidth(k.name, TYPE.small) }));
  const cx = marks.map((k) => k.px);
  for (let k = 1; k < 3; k++) cx[k] = Math.max(cx[k], cx[k - 1] + (marks[k - 1].tw + marks[k].tw) / 2 + 8);
  cx[2] = Math.min(cx[2], w - marks[2].tw / 2);
  for (let k = 1; k >= 0; k--) cx[k] = Math.min(cx[k], cx[k + 1] - (marks[k].tw + marks[k + 1].tw) / 2 - 8);
  cx[0] = Math.max(cx[0], marks[0].tw / 2);
  marks.forEach((k, j) => {
    parts.push(el("circle", { cx: k.px, cy: ay - 10, r: 5, fill: k.strong ? C.ink : C.paper, stroke: C.ink, "stroke-width": 1.6 }));
    parts.push(text(cx[j], ay - 22, k.name, { "font-size": TYPE.small, "text-anchor": "middle", class: k.strong ? "fig-t-strong" : "fig-t-muted" }));
  });
  parts.push(text(w / 2, ay + 34, L.axis, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  y = ay + 44;
  return svg(w, y, describe(st, lang), ...parts);
}

function matchPreset(p: P): P["example"] {
  for (const [k, v] of Object.entries(PRESETS) as Array<["small" | "large", (typeof PRESETS)["small" | "large"]]>) {
    if (p.prBefore === v.prBefore && p.prAfter === v.prAfter && p.docAfter === v.docAfter && p.sigma === v.sigma) return k;
  }
  return "custom";
}

export default defineFigure({
  name: "task-substitution",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    example: {
      kind: "choice", label: { en: "Worked example", zh: "算例" }, default: "small",
      options: [
        { value: "small", label: { en: "PRs 1 h → 0.5 h", zh: "PR 1 小时 → 0.5 小时" } },
        { value: "large", label: { en: "PRs 5 h → 1 h", zh: "PR 5 小时 → 1 小时" } },
        { value: "custom", label: { en: "Own values", zh: "自定义" } },
      ],
    },
    prBefore: { kind: "range", scale: "log", label: { en: "Hours per PR without the tool", zh: "不用工具时每个 PR 的小时数" }, unit: { en: "h", zh: "小时" }, min: 0.25, max: 8, default: 1 },
    prAfter: { kind: "range", scale: "log", label: { en: "Hours per PR with the tool", zh: "用工具时每个 PR 的小时数" }, unit: { en: "h", zh: "小时" }, min: 0.1, max: 8, default: 0.5 },
    docAfter: { kind: "range", scale: "log", label: { en: "Hours per document with the tool (1 h without)", zh: "用工具时每份文档的小时数（不用时 1 小时）" }, unit: { en: "h", zh: "小时" }, min: 0.1, max: 4, default: 1 },
    sigma: {
      kind: "range", scale: "log", label: { en: "Substitutability σ", zh: "可替代程度 σ" }, min: 0.25, max: 4, default: 1,
      marks: [{ value: 1, label: { en: "fixed time shares", zh: "时间占比不变" } }],
    },
  },
  update(p, key) {
    if (key === "example") {
      if (p.example === "custom") return p;
      return { ...p, ...PRESETS[p.example as "small" | "large"] };
    }
    return { ...p, example: matchPreset(p as P) };
  },
  render,
  describe,
});
