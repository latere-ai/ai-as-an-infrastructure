// The time-to-power schedule of the powering-it chapter as a Gantt chart:
//
//   T_ready = max over paths p of Σ_{a ∈ p} D_a
//
// over the chapter's dependency graph (the runnable block beside the figure):
// the substation waits for the interconnection study; on-site generation and
// the cooling plant run in parallel from the start; commissioning waits for
// all three. Every task starts as early as its predecessors allow. The
// backward pass gives each task its latest finish, and the gap between the
// two is its float: how long it can slip before it joins the critical path
// and moves T_ready. Durations are the chapter's illustrative ones.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

type Task = "ic" | "sub" | "gen" | "cool" | "comm";
const TASKS: Task[] = ["ic", "sub", "gen", "cool", "comm"];
const AFTER: Record<Task, Task[]> = { ic: [], sub: ["ic"], gen: [], cool: [], comm: ["sub", "gen", "cool"] };
const PATHS: Task[][] = [["ic", "sub", "comm"], ["gen", "comm"], ["cool", "comm"]];

const labels = {
  en: {
    title: "Critical path to usable power",
    ic: "Interconnection",
    sub: "Substation",
    gen: "On-site generation",
    cool: "Cooling plant",
    comm: "Commissioning",
    months: "{d} months",
    x: "months from project start",
    ready: "T_ready = {t} months",
    lgCrit: "on the critical path",
    lgOther: "off the critical path",
    lgFloat: "float",
    float: "float {f}",
    path: "{names} = {terms} = {sum}",
    max: "T_ready = max({sums}) = {t} months",
    floats: "Float: {list}. A task can slip by its float without moving T_ready; slip it further and it joins the critical path.",
    noFloat: "Every path has the same length, so every task is critical.",
    fItem: "{name} {f} months",
    illustrative: "Durations are the chapter's illustrative values, not a forecast.",
    describe: "T_ready is {t} months, set by {path}. {floats}",
    via: "the path {names}",
  },
  zh: {
    title: "通往可用电力的关键路径",
    ic: "并网",
    sub: "变电站",
    gen: "现场发电",
    cool: "冷却系统",
    comm: "调试验收",
    months: "{d} 个月",
    x: "距项目起点的月数",
    ready: "T_ready = {t} 个月",
    lgCrit: "关键路径上",
    lgOther: "不在关键路径上",
    lgFloat: "浮动时间",
    float: "浮动 {f}",
    path: "{names} = {terms} = {sum}",
    max: "T_ready = max({sums}) = {t} 个月",
    floats: "浮动时间：{list}。任务延误不超过浮动时间时，T_ready 不变；再多延误，它就会进入关键路径。",
    noFloat: "所有路径长度相同，每项任务都在关键路径上。",
    fItem: "{name} {f} 个月",
    illustrative: "工期取自本章示例，不是预测。",
    describe: "T_ready 为 {t} 个月，由{path}决定。{floats}",
    via: "路径 {names} ",
  },
};

type P = Record<Task, number>;

function schedule(p: P) {
  const es = {} as Record<Task, number>, ef = {} as Record<Task, number>;
  for (const t of TASKS) { es[t] = Math.max(0, ...AFTER[t].map((a) => ef[a])); ef[t] = es[t] + p[t]; }
  const T = Math.max(...TASKS.map((t) => ef[t]));
  const lf = {} as Record<Task, number>, ls = {} as Record<Task, number>;
  for (const t of [...TASKS].reverse()) {
    const succ = TASKS.filter((s) => AFTER[s].includes(t));
    lf[t] = succ.length ? Math.min(...succ.map((s) => ls[s])) : T;
    ls[t] = lf[t] - p[t];
  }
  const float = {} as Record<Task, number>;
  for (const t of TASKS) float[t] = ls[t] - es[t];
  const sums = PATHS.map((path) => path.reduce((a, t) => a + p[t], 0));
  const crit = sums.indexOf(Math.max(...sums));
  return { es, ef, lf, ls, float, T, sums, crit };
}

const joiner = (lang: Lang) => (lang === "zh" ? " + " : " + ");

function floatList(p: P, s: ReturnType<typeof schedule>, L: typeof labels.en, lang: Lang) {
  const items = TASKS.filter((t) => s.float[t] > 0).map((t) => tpl(L.fItem, { name: lang === "en" ? L[t].toLowerCase() : L[t], f: s.float[t] }));
  return items.length ? tpl(L.floats, { list: items.join(lang === "zh" ? "，" : ", ") }) : L.noFloat;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = schedule(st.p);
  const names = PATHS[s.crit].map((t) => L[t]).join(lang === "zh" ? "、" : ", ");
  return tpl(L.describe, { t: s.T, path: tpl(L.via, { names }), floats: floatList(st.p, s, L, lang) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const s = schedule(p);
  const parts: string[] = [];

  const lg = legend([
    { label: L.lgCrit, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lgOther, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lgFloat, swatch: { kind: "rect", fill: "none", stroke: C.ink2, dash: "3 2" } },
  ], 0, 0, w, fs);
  parts.push(lg.svg);

  const critical = (t: Task) => s.float[t] === 0;
  const labelW = narrow ? 0 : Math.max(...TASKS.map((t) => Math.max(textWidth(L[t], fs), textWidth(tpl(L.months, { d: 60 }), fs)))) + 16;
  const x0 = labelW, x1 = w - 6;
  const span = Math.max(36, Math.ceil((s.T + 2) / 6) * 6);
  const x = linear([0, span], [x0, x1]);
  const barH = 18;
  const rowH = narrow ? 50 : 38;
  const top = lg.height + 34; // room for the T_ready label
  const barY = (i: number) => top + i * rowH + (narrow ? 26 : (rowH - barH) / 2);

  // Gridlines and the axis first, so bars sit over them.
  const plotBottom = top + TASKS.length * rowH + 4;
  parts.push(axis({ scale: x, orient: "bottom", at: plotBottom, grid: [top - 6, plotBottom], ticks: x.ticks(narrow ? 4 : 7), title: L.x, size: fs, format: (v) => String(v) }));

  const labelsNarrow: string[] = [];
  TASKS.forEach((t, i) => {
    const by = barY(i);
    const cls = critical(t) ? "fig-t-strong" : undefined;
    if (narrow) {
      // Drawn after the dependency arrows with a halo, so an arrow passing
      // through the label row stops short of the text.
      labelsNarrow.push(text(0, by - 8, `${L[t]} · ${tpl(L.months, { d: p[t] })}`, { "font-size": fs, class: critical(t) ? "fig-t-halo" : "fig-t-halo fig-t-soft" }));
    } else {
      parts.push(text(0, by + 6, L[t], { "font-size": fs, class: cls }));
      parts.push(text(0, by + 21, tpl(L.months, { d: p[t] }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    }
    const xa = x(s.es[t]), xb = x(s.ef[t]);
    parts.push(el("rect", { x: xa, y: by, width: Math.max(1, xb - xa), height: barH, rx: 3, fill: critical(t) ? C.c2 : C.c1 }));
    if (s.float[t] > 0) {
      const xf = x(s.lf[t]);
      parts.push(el("rect", { x: xb + 1, y: by + 0.75, width: Math.max(1, xf - xb - 1), height: barH - 1.5, rx: 3, fill: "none", stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
      const fl = tpl(L.float, { f: s.float[t] });
      if (xf - xb - 8 > textWidth(fl, fs)) parts.push(text((xb + xf) / 2, by + barH / 2 + fs * 0.35, fl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
    }
  });

  // Dependencies: from the latest finish of each predecessor down to the
  // start of its successor.
  TASKS.forEach((t, i) => {
    for (const a of AFTER[t]) {
      const ia = TASKS.indexOf(a);
      const xc = x(s.es[t]);
      const ya = barY(ia) + barH, yb = barY(i);
      parts.push(el("line", { x1: xc, x2: xc, y1: ya, y2: yb - 4, stroke: critical(a) && critical(t) ? C.ink : C.ink3, "stroke-width": critical(a) && critical(t) ? 1.5 : 1 }));
      parts.push(el("path", { d: `M${xc - 3.5},${yb - 7}L${xc},${yb - 1}L${xc + 3.5},${yb - 7}Z`, fill: critical(a) && critical(t) ? C.ink : C.ink3 }));
    }
  });

  parts.push(...labelsNarrow);

  // T_ready.
  const xt = x(s.T);
  parts.push(el("line", { x1: xt, x2: xt, y1: top - 10, y2: plotBottom, stroke: C.ink, "stroke-width": 1.5 }));
  const rl = tpl(L.ready, { t: s.T });
  const rw = textWidth(rl, fs) * 1.08;
  const anchor = xt + rw / 2 > w ? "end" : "middle";
  parts.push(text(anchor === "end" ? w : xt, top - 16, rl, { "font-size": fs, "text-anchor": anchor, class: "fig-t-strong fig-t-num" }));

  // Readout: every path's sum, the maximum, and the float of each task.
  let y = plotBottom + axisHeight(true, fs) + 18;
  const wrapL = (str: string, mw: number) => (lang === "zh" ? wrapCjk(str, fs, mw) : wrap(str, fs, mw));
  const pathLines: Array<[string, string]> = PATHS.map((path, k) => [
    tpl(L.path, { names: path.map((t) => L[t]).join(joiner(lang)), terms: path.map((t) => p[t]).join(" + "), sum: s.sums[k] }),
    s.sums[k] === s.T ? "fig-t-strong" : "",
  ]);
  const lines: Array<[string, string]> = [
    ...pathLines,
    [tpl(L.max, { sums: s.sums.join(", "), t: s.T }), "fig-t-strong fig-t-num"],
    [floatList(p, s, L, lang), ""],
    [L.illustrative, "fig-t-muted"],
  ];
  const ro: string[] = [];
  lines.forEach(([str, cls], k) => {
    for (const ln of wrapL(str, cls.includes("strong") ? w / 1.1 : w)) { ro.push(text(0, y, ln, { "font-size": fs, class: cls || undefined })); y += fs + 6; }
    y += k === PATHS.length - 1 ? 2 : 4;
  });
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y, describe(st, lang), ...parts);
}

const months = { en: "months", zh: "个月" };
export default defineFigure({
  name: "delivery-critical-path",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    ic: { kind: "range", label: { en: "Interconnection", zh: "并网" }, unit: months, min: 1, max: 60, step: 1, default: 18 },
    sub: { kind: "range", label: { en: "Substation", zh: "变电站" }, unit: months, min: 1, max: 48, step: 1, default: 14 },
    gen: { kind: "range", label: { en: "On-site generation", zh: "现场发电" }, unit: months, min: 1, max: 48, step: 1, default: 12 },
    cool: { kind: "range", label: { en: "Cooling plant", zh: "冷却系统" }, unit: months, min: 1, max: 36, step: 1, default: 10 },
    comm: { kind: "range", label: { en: "Commissioning", zh: "调试验收" }, unit: months, min: 1, max: 12, step: 1, default: 3 },
  },
  render,
  describe,
});
