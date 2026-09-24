// The adoption chapter's net-benefit ledger over one accounting horizon H,
//
//   NB_H = (R₁ − R₀) + (C₀ − C₁) − C_fixed − E[L₁ − L₀],
//
// computed from the assumptions a pilot has to state rather than set term by
// term. Over N_H accepted units:
//
//   R₁ − R₀      = N_H · Δr                      revenue change per unit Δr
//   C₀ − C₁      = labor − model − repair
//     labor      = N_H · w · Δh · κ   if Δh ≥ 0  hours saved become cash only
//                = N_H · w · Δh       if Δh < 0  at the conversion share κ;
//                                                added hours are paid in full
//     model      = N_H · c_model
//     repair     = N_H · d · (1 − e^(−W/τ)) · c_d  delayed defects d per unit
//                                                arrive after acceptance with
//                                                mean delay τ; only those
//                                                inside the defect window W
//                                                are counted
//   E[L₁ − L₀]   = N_H · Δp · ℓ                  change in incident
//                                                probability Δp, loss ℓ
//
// Δh is the pilot's intent-to-treat estimate of paid minutes saved per
// accepted unit, reported with a 95% interval Δh ± h. NB_H is increasing in
// Δh, so the interval of NB_H at the stated assumptions is NB_H at the two
// ends of the effect's interval. The chapter's decision rule reads that
// interval: go only when its lower end clears the hurdle and the incident
// guardrail passes; roll back past a predeclared harm boundary.
//
// The sensitivity panel moves one assumption at a time by ±spread (relative,
// the conversion share clamped to 0 to 100 percent) with the others at their
// base values, and ranks the assumptions by how far they move the point
// estimate; a range that crosses the hurdle marks an assumption that can
// reverse the result on its own. Every default is illustrative, for a
// hypothetical high-volume workflow; none is a measured productivity effect.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { subText, subTextWidth } from "./lib/sub-text.ts";
import { compact, sig, tpl } from "./lib/format.ts";

type P = {
  saved: number; // Δh, paid minutes saved per accepted unit (pilot estimate)
  ci: number; // half-width of the 95% interval on Δh, minutes
  wage: number; // w, loaded labor cost, USD per hour
  convert: number; // κ, percent of saved hours converted to cash
  volume: number; // N_H, accepted units over the horizon
  incidents: number; // Δp, extra incidents per 100,000 units
  window: number; // W, defect window, days
  hurdle: number; // required NB_H, USD
  model: number; // c_model, USD per unit
  fixed: number; // C_fixed, USD
  loss: number; // ℓ, USD per incident
  defects: number; // d, extra delayed defects per 1,000 units
  repair: number; // c_d, USD per defect
  delay: number; // τ, mean days from acceptance to a delayed defect
  revenue: number; // Δr, USD per unit
  harm: number; // guardrail: largest predeclared Δp, per 100,000 units
  spread: number; // sensitivity range, percent
};

// ---------------------------------------------------------------- ledger

interface Ledger {
  rev: number;
  labor: number; // cash from saved (or cost of added) hours
  idle: number; // freed capacity not converted to cash, not counted
  model: number;
  repair: number;
  fixed: number;
  loss: number;
  costDelta: number; // C₀ − C₁
  nb: number;
}

function ledger(p: P): Ledger {
  const N = p.volume;
  const dh = p.saved / 60;
  const k = p.convert / 100;
  const labor = N * p.wage * dh * (dh >= 0 ? k : 1);
  const idle = dh > 0 ? N * p.wage * dh * (1 - k) : 0;
  const model = N * p.model;
  const repair = N * (p.defects / 1000) * (1 - Math.exp(-p.window / p.delay)) * p.repair;
  const rev = N * p.revenue;
  const loss = N * (p.incidents / 100000) * p.loss;
  const costDelta = labor - model - repair;
  return { rev, labor, idle, model, repair, fixed: p.fixed, loss, costDelta, nb: rev + costDelta - p.fixed - loss };
}

// NB_H at the two ends of the 95% interval on minutes saved.
function interval(p: P): [number, number] {
  return [ledger({ ...p, saved: p.saved - p.ci }).nb, ledger({ ...p, saved: p.saved + p.ci }).nb];
}

type Verdict = "go" | "iterate" | "nogo" | "rollback";
function verdict(p: P): { v: Verdict; lo: number; hi: number } {
  const [lo, hi] = interval(p);
  if (p.incidents > p.harm) return { v: "rollback", lo, hi };
  if (lo >= p.hurdle) return { v: "go", lo, hi };
  if (hi < p.hurdle) return { v: "nogo", lo, hi };
  return { v: "iterate", lo, hi };
}

// The assumptions the sensitivity panel moves, one at a time.
const SENS = ["wage", "convert", "volume", "model", "fixed", "incidents", "loss", "window"] as const;
type SensKey = (typeof SENS)[number];

function moved(p: P, key: SensKey, dir: -1 | 1): number {
  const f = 1 + (dir * p.spread) / 100;
  if (key === "convert") return Math.min(100, Math.max(0, p.convert * f));
  return p[key] * f;
}

interface SensRow { key: SensKey; lo: number; hi: number; atLo: number; atHi: number; crosses: boolean }
function sensitivity(p: P): SensRow[] {
  const rows = SENS.map((key) => {
    const a = moved(p, key, -1), b = moved(p, key, 1);
    const na = ledger({ ...p, [key]: a }).nb, nb = ledger({ ...p, [key]: b }).nb;
    const lo = Math.min(na, nb), hi = Math.max(na, nb);
    return { key, lo, hi, atLo: a, atHi: b, crosses: lo < p.hurdle && hi >= p.hurdle };
  });
  return rows.sort((x, y) => (y.hi - y.lo) - (x.hi - x.lo));
}

// ---------------------------------------------------------------- labels

const money = (v: number) => (v < 0 ? "−" : "") + "$" + compact(Math.abs(v)).replace(/^−/, "");
const signed = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + compact(Math.abs(v));

const labels = {
  en: {
    title: "Adoption ledger with an interval and a sensitivity ranking",
    headLedger: "Ledger over the horizon H, at the stated assumptions",
    rev: "R₁ − R₀ revenue change",
    labor: "C₀ − C₁ labor, as cash",
    model: "C₀ − C₁ model and tools",
    repair: "C₀ − C₁ defect repair",
    fixed: "C_{fixed} adoption cost",
    loss: "E[L₁ − L₀] incidents",
    nb: "NB_H",
    idle: "freed capacity not converted to cash (not counted)",
    hurdle: "hurdle {h}",
    interval: "95% interval from the time-saved estimate",
    eq: "NB_H = (R₁ − R₀) + (C₀ − C₁) − C_{fixed} − E[L₁ − L₀]",
    go: "Go: the interval's lower end, {lo}, clears the hurdle of {h}",
    iterate: "Iterate: the interval, {lo} to {hi}, straddles the hurdle of {h}",
    nogo: "No go: the whole interval, {lo} to {hi}, is below the hurdle of {h}",
    rollback: "Roll back: incidents rise past the predeclared harm boundary",
    guard: "Guardrail: {x} incidents per 100k units, boundary +{b}",
    pass: "passes",
    fail: "fails",
    headSens: "One assumption at a time, ±{s}%, others at base: NB_H point estimate",
    crosses: "Bold rows: the range crosses the hurdle, so that assumption alone can reverse the result",
    base: "base {v}",
    lower: "value −{s}%", higher: "value +{s}%",
    wage: "labor value w", convert: "cash conversion κ", volume: "accepted volume N_H", modelS: "model cost per unit",
    fixedS: "fixed cost C_{fixed}", incidents: "incidents per 100k units", lossS: "loss per incident", window: "defect window W",
    uPerH: "/h", uDays: " days", uUnits: " units", to: "to",
    axis: "USD over the horizon H",
    describe: "At the stated assumptions NB_H is {nb}: revenue {r}, C₀ − C₁ {c} (labor as cash {lab}, with {idle} of freed capacity not converted; model {m}; defect repair {rep}), fixed cost {f}, expected incident loss {l}. The 95% interval from the time-saved estimate runs from {lo} to {hi}, so the rule says {v}. {sens}",
    sensSome: "Moved by ±{s}% one at a time, {keys} can each carry the estimate across the hurdle.",
    sensNone: "No single assumption moved by ±{s}% carries the estimate across the hurdle.",
    vgo: "go", viterate: "iterate", vnogo: "no go", vrollback: "roll back",
    d_wage: "labor value", d_convert: "cash conversion", d_volume: "volume", d_model: "model cost",
    d_fixed: "fixed cost", d_incidents: "incident rate", d_loss: "loss per incident", d_window: "defect window",
  },
  zh: {
    title: "带区间和敏感性排序的采用账目",
    headLedger: "核算期 H 内的账目，按所填假设计算",
    rev: "R₁ − R₀ 收入变化",
    labor: "C₀ − C₁ 折成现金的劳动",
    model: "C₀ − C₁ 模型与工具",
    repair: "C₀ − C₁ 缺陷修复",
    fixed: "C_{fixed} 采用成本",
    loss: "E[L₁ − L₀] 事故损失",
    nb: "NB_H",
    idle: "释放出来却没有折成现金的容量（不计入）",
    hurdle: "门槛 {h}",
    interval: "由节省时间估计得到的 95% 区间",
    eq: "NB_H = (R₁ − R₀) + (C₀ − C₁) − C_{fixed} − E[L₁ − L₀]",
    go: "采用：区间下限 {lo} 高于门槛 {h}",
    iterate: "迭代：区间 {lo} 到 {hi} 跨过了门槛 {h}",
    nogo: "不采用：整个区间 {lo} 到 {hi} 都低于门槛 {h}",
    rollback: "回滚：事故增幅超过了预先声明的损害边界",
    guard: "护栏：每 10 万单位事故变化 {x}，边界 +{b}",
    pass: "通过",
    fail: "未通过",
    headSens: "逐项改动 ±{s}%，其余取基准值：NB_H 点估计",
    crosses: "粗体行：区间跨过门槛，这一项假设单独就能让结论反转",
    base: "基准 {v}",
    lower: "取值 −{s}%", higher: "取值 +{s}%",
    wage: "劳动价值 w", convert: "现金换算比例 κ", volume: "验收产量 N_H", modelS: "单位模型成本",
    fixedS: "固定成本 C_{fixed}", incidents: "每 10 万单位事故数", lossS: "单次事故损失", window: "缺陷观察期 W",
    uPerH: "/小时", uDays: " 天", uUnits: " 个单位", to: "至",
    axis: "核算期 H 内的美元",
    describe: "按所填假设，NB_H 为 {nb}：收入变化 {r}，C₀ − C₁ 为 {c}（折成现金的劳动 {lab}，另有 {idle} 的释放容量没有折成现金；模型 {m}；缺陷修复 {rep}），固定成本 {f}，预期事故损失 {l}。由节省时间估计得到的 95% 区间是 {lo} 到 {hi}，按决策规则应当{v}。{sens}",
    sensSome: "每次把一个假设改动 ±{s}%，{keys}都能单独让估计值跨过门槛。",
    sensNone: "每次把一个假设改动 ±{s}%，没有哪一项能单独让估计值跨过门槛。",
    vgo: "采用", viterate: "迭代", vnogo: "不采用", vrollback: "回滚",
    d_wage: "劳动价值", d_convert: "现金换算比例", d_volume: "产量", d_model: "模型成本",
    d_fixed: "固定成本", d_incidents: "事故率", d_loss: "单次事故损失", d_window: "缺陷观察期",
  },
};
type L = typeof labels.en;

const SENS_LABEL: Record<SensKey, keyof L> = {
  wage: "wage", convert: "convert", volume: "volume", model: "modelS", fixed: "fixedS", incidents: "incidents", loss: "lossS", window: "window",
};

function sensRange(key: SensKey, a: number, b: number, L: L): string {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const t = ` ${L.to} `;
  switch (key) {
    case "wage": return `$${sig(lo, 3)}${t}$${sig(hi, 3)}${L.uPerH}`;
    case "convert": return `${sig(lo, 3)}%${t}${sig(hi, 3)}%`;
    case "volume": return `${compact(lo)}${t}${compact(hi)}${L.uUnits}`;
    case "model": return `$${sig(lo, 2)}${t}$${sig(hi, 2)}`;
    case "fixed": case "loss": return `${money(lo)}${t}${money(hi)}`;
    case "incidents": return `${sig(lo, 2)}${t}${sig(hi, 2)}`;
    case "window": return `${sig(lo, 2)}${t}${sig(hi, 2)}${L.uDays}`;
  }
}

// ---------------------------------------------------------------- render

interface Frame {
  narrow: boolean;
  w: number;
  x: ReturnType<typeof linear>;
  labelW: number; // desktop label column
  uid: string;
  hurdle: number;
}

// One ledger or sensitivity row. Desktop: label column, bar, value column.
// Phone: label and value on one line, the bar under them at full width.
function row(f: Frame, y: number, label: string, sub: string | null, value: string, bars: string[], strong: boolean): { svg: string; h: number; barY: number } {
  const parts: string[] = [];
  const barH = 14;
  const h = f.narrow ? (sub ? 50 : 36) : (sub ? 32 : 24);
  const barY = f.narrow ? y + (sub ? 34 : 20) : y + (h - barH) / 2;
  const cls = strong ? "fig-t-strong" : undefined;
  if (f.narrow) {
    parts.push(subText(0, y + 13, label, TYPE.body, { class: cls }));
    if (sub) parts.push(text(0, y + 28, sub, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
    parts.push(text(f.w, y + 13, value, { "font-size": TYPE.body, "text-anchor": "end", class: (strong ? "fig-t-strong " : "") + "fig-t-num" }));
  } else {
    const ly = sub ? y + 13 : y + h / 2 + 4;
    parts.push(subText(0, ly, label, TYPE.body, { class: cls }));
    if (sub) parts.push(text(0, y + 27, sub, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
    parts.push(text(f.w, y + h / 2 + 4, value, { "font-size": sub ? TYPE.small : TYPE.body, "text-anchor": "end", class: (strong ? "fig-t-strong " : "") + "fig-t-num" }));
  }
  // Zero and hurdle across the bar zone of this row, so they read as one line
  // down the rows without crossing any label.
  const z0 = f.narrow ? barY - 3 : y, z1 = f.narrow ? barY + barH + 3 : y + h;
  parts.push(el("line", { x1: f.x(0), x2: f.x(0), y1: z0, y2: z1, stroke: C.rule, "stroke-width": 1 }));
  parts.push(...bars.map((b) => b.replace(/__Y__/g, String(barY)).replace(/__H__/g, String(barH))));
  if (f.hurdle !== 0) parts.push(el("line", { x1: f.x(f.hurdle), x2: f.x(f.hurdle), y1: z0, y2: z1, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
  else parts.push(el("line", { x1: f.x(0), x2: f.x(0), y1: z0, y2: z1, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
  return { svg: g({}, ...parts), h, barY };
}

// A horizontal bar between two data values; placeholders are filled by row().
function bar(f: Frame, a: number, b: number, attrs: Record<string, string | number>): string {
  const x0 = f.x(Math.min(a, b)), x1 = f.x(Math.max(a, b));
  return el("rect", { x: x0, y: "__Y__", width: Math.max(1, x1 - x0), height: "__H__", ...attrs });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = ledger(p);
  const v = verdict(p);
  const sens = sensitivity(p).filter((r) => r.crosses).map((r) => L[`d_${r.key}` as keyof L]);
  const list = (xs: string[]) => (lang === "zh" || xs.length < 2 ? xs.join("、") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  return tpl(L.describe, {
    nb: money(m.nb), r: money(m.rev), c: money(m.costDelta), lab: money(m.labor), idle: money(m.idle), m: money(m.model), rep: money(m.repair),
    f: money(m.fixed), l: money(m.loss), lo: money(v.lo), hi: money(v.hi), v: L[`v${v.v}` as keyof L],
    sens: sens.length ? tpl(L.sensSome, { s: p.spread, keys: list(sens) }) : tpl(L.sensNone, { s: p.spread }),
  });
}


function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = ledger(p);
  const v = verdict(p);
  const sens = sensitivity(p);

  // One dollar scale for the ledger and the sensitivity panel.
  const steps = [0, m.rev, m.rev + m.labor, m.rev + m.labor + m.idle, m.rev + m.labor - m.model,
    m.rev + m.costDelta, m.rev + m.costDelta - m.fixed, m.nb, v.lo, v.hi, p.hurdle, ...sens.flatMap((r) => [r.lo, r.hi])];
  let d0 = Math.min(...steps), d1 = Math.max(...steps);
  const pad = (d1 - d0) * 0.04 || 1;
  d0 -= pad; d1 += pad;
  const labelW = narrow ? 0 : 184;
  const valW = narrow ? 0 : 100;
  const x = linear([d0, d1], narrow ? [4, w - 4] : [labelW + 8, w - valW - 8]);
  const f: Frame = { narrow, w, x, labelW, uid: st.uid, hurdle: p.hurdle };
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-idle`, C.c1, 4, 1.3))];

  let y = 0;
  for (const ln of wrapCJK(L.headLedger, TYPE.label, w)) { parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  y += 4;
  // The hurdle's value above the rows, at its line.
  const hl = tpl(L.hurdle, { h: money(p.hurdle) });
  const hw = textWidth(hl, TYPE.small);
  const hx = Math.min(Math.max(x(p.hurdle), hw / 2 + (narrow ? 0 : labelW)), w - (narrow ? 0 : valW) - hw / 2);
  parts.push(text(hx, y + 10, hl, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
  y += 16;

  // Waterfall: each step starts where the previous one ended.
  const benefit = { fill: C.c1, "fill-opacity": 0.8 };
  const cost = { fill: C.c2, "fill-opacity": 0.8 };
  const style = (d: number) => (d >= 0 ? benefit : cost);
  let cum = 0;
  const stepsDef: Array<{ label: string; d: number; extra?: string[] }> = [
    { label: L.rev, d: m.rev },
    { label: L.labor, d: m.labor, extra: m.idle > 0 ? [bar(f, m.rev + m.labor, m.rev + m.labor + m.idle, { fill: `url(#${st.uid}-idle)`, stroke: C.c1, "stroke-width": 0.8, "stroke-dasharray": "2 2" })] : [] },
    { label: L.model, d: -m.model },
    { label: L.repair, d: -m.repair },
    { label: L.fixed, d: -m.fixed },
    { label: L.loss, d: -m.loss },
  ];
  let prevEnd: { x: number; y: number } | null = null;
  for (const s of stepsDef) {
    const a = cum, b = cum + s.d;
    const r = row(f, y, s.label, null, signed(s.d), [bar(f, a, b, style(s.d)), ...(s.extra ?? [])], false);
    parts.push(r.svg);
    if (prevEnd && !narrow) parts.push(el("line", { x1: prevEnd.x, x2: prevEnd.x, y1: prevEnd.y, y2: r.barY, stroke: C.ink3, "stroke-width": 1 }));
    prevEnd = { x: x(b), y: r.barY + 14 };
    cum = b;
    y += r.h;
  }
  // NB_H: a total bar from zero, with the interval from the effect estimate.
  const whisker = (yy: number) => {
    const cy = yy + 7;
    return el("line", { x1: x(v.lo), x2: x(v.hi), y1: cy, y2: cy, stroke: C.ink, "stroke-width": 1.6 })
      + el("line", { x1: x(v.lo), x2: x(v.lo), y1: cy - 6, y2: cy + 6, stroke: C.ink, "stroke-width": 1.6 })
      + el("line", { x1: x(v.hi), x2: x(v.hi), y1: cy - 6, y2: cy + 6, stroke: C.ink, "stroke-width": 1.6 })
      + el("circle", { cx: x(m.nb), cy, r: 3.5, fill: C.ink });
  };
  const nbRow = row(f, y + 4, L.nb, null, money(m.nb), [bar(f, 0, m.nb, { fill: C.ink3, "fill-opacity": 0.45 })], true);
  parts.push(el("line", { x1: 0, x2: w, y1: y + 2, y2: y + 2, stroke: C.rule, "stroke-width": 1 }));
  parts.push(nbRow.svg, whisker(nbRow.barY));
  y += nbRow.h + 12;

  // Legend for the hatched capacity and the whisker.
  const items: Array<[string, string]> = [];
  if (m.idle > 0) items.push(["idle", L.idle]);
  items.push(["ci", L.interval]);
  for (const [kind, lbl] of items) {
    const lines = wrapCJK(lbl, TYPE.small, w - 26);
    if (kind === "idle") parts.push(el("rect", { x: 0, y: y, width: 18, height: 11, fill: `url(#${st.uid}-idle)`, stroke: C.c1, "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
    else parts.push(el("line", { x1: 0, x2: 18, y1: y + 5.5, y2: y + 5.5, stroke: C.ink, "stroke-width": 1.6 }), el("line", { x1: 0.8, x2: 0.8, y1: y, y2: y + 11, stroke: C.ink, "stroke-width": 1.6 }), el("line", { x1: 17.2, x2: 17.2, y1: y, y2: y + 11, stroke: C.ink, "stroke-width": 1.6 }));
    lines.forEach((ln, k) => parts.push(text(26, y + 10 + k * 15, ln, { "font-size": TYPE.small, class: "fig-t-muted" })));
    y += lines.length * 15 + 4;
  }
  y += 10;

  // The equation and its terms at these assumptions.
  // Terms joined with their own signs: "= $0 − $396k − $150k − $40k".
  const terms = [m.rev, m.costDelta, -m.fixed, -m.loss];
  const eqVals = "= " + terms.map((t, i) => (i === 0 ? money(t) : `${t < 0 ? "−" : "+"} ${money(Math.abs(t))}`)).join(" ") + ` = ${money(m.nb)}`;
  if (subTextWidth(L.eq, TYPE.body) + textWidth(eqVals, TYPE.body) + 8 <= w) {
    parts.push(subText(0, y + 12, L.eq, TYPE.body, { class: "fig-t-strong" }));
    parts.push(text(subTextWidth(L.eq, TYPE.body) + 8, y + 12, eqVals, { "font-size": TYPE.body, class: "fig-t-num" }));
    y += 22;
  } else {
    parts.push(subText(0, y + 12, L.eq, TYPE.body, { class: "fig-t-strong" }));
    parts.push(text(0, y + 30, eqVals, { "font-size": TYPE.body, class: "fig-t-num" }));
    y += 40;
  }

  // The decision rule and the guardrail.
  const vt = tpl(L[v.v], { lo: money(v.lo), hi: money(v.hi), h: money(p.hurdle) });
  const vcol = v.v === "go" ? C.good : v.v === "iterate" ? C.warn : C.bad;
  const vlines = wrapCJK(vt, TYPE.body, w - 16);
  parts.push(el("circle", { cx: 5, cy: y + 8, r: 5, fill: vcol }));
  vlines.forEach((ln, k) => parts.push(text(16, y + 12 + k * 16, ln, { "font-size": TYPE.body, class: k === 0 ? "fig-t-strong fig-t-num" : "fig-t-num" })));
  y += vlines.length * 16 + 6;
  const ok = p.incidents <= p.harm;
  const gt = tpl(L.guard, { x: (p.incidents > 0 ? "+" : "") + sig(p.incidents, 2).replace(/^−/, "−"), b: sig(p.harm, 2) }) + (lang === "zh" ? "，" : ": ") + (ok ? L.pass : L.fail);
  const glines = wrapCJK(gt, TYPE.body, w - 16);
  parts.push(el("circle", { cx: 5, cy: y + 8, r: 5, fill: ok ? C.good : C.bad }));
  glines.forEach((ln, k) => parts.push(text(16, y + 12 + k * 16, ln, { "font-size": TYPE.body, class: "fig-t-num" })));
  y += glines.length * 16 + 22;

  // Sensitivity: one assumption at a time, ranked by the swing it causes.
  const hs = wrapCJK(tpl(L.headSens, { s: p.spread }), TYPE.label, w);
  hs.forEach((ln, k) => parts.push(subText(0, y + 13 + k * 18, ln, TYPE.label, { class: "fig-t-strong" })));
  y += hs.length * 18 + 4;
  const lg = [
    { c: C.c3, t: tpl(L.lower, { s: p.spread }) },
    { c: C.c4, t: tpl(L.higher, { s: p.spread }) },
  ];
  let lx = 0;
  for (const it of lg) {
    parts.push(el("rect", { x: lx, y: y + 2, width: 12, height: 11, rx: 2, fill: it.c, "fill-opacity": 0.85 }));
    parts.push(text(lx + 17, y + 12, it.t, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
    lx += 17 + textWidth(it.t, TYPE.small) + 16;
  }
  const bl = tpl(L.base, { v: money(m.nb) });
  parts.push(el("line", { x1: lx, x2: lx + 16, y1: y + 7, y2: y + 7, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "2 2" }));
  parts.push(text(lx + 21, y + 12, bl, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
  y += 20;
  for (const ln of wrapCJK(L.crosses, TYPE.small, w)) { parts.push(text(0, y + 10, ln, { "font-size": TYPE.small, class: "fig-t-muted" })); y += 15; }
  y += 6;
  for (const r of sens) {
    const name = L[SENS_LABEL[r.key]];
    const range = sensRange(r.key, r.atLo, r.atHi, L);
    const nLo = ledger({ ...p, [r.key]: r.atLo }).nb, nHi = ledger({ ...p, [r.key]: r.atHi }).nb;
    const val = `${money(r.lo)} ${L.to} ${money(r.hi)}`;
    const rr = row(f, y, name, range, val, [
      bar(f, m.nb, nLo, { fill: C.c3, "fill-opacity": 0.85 }),
      bar(f, m.nb, nHi, { fill: C.c4, "fill-opacity": 0.85 }),
    ], r.crosses);
    parts.push(rr.svg);
    // The base estimate as a dashed line down the rows, across bars only on
    // a phone so it never runs through a label.
    const b0 = narrow ? rr.barY - 3 : y, b1 = narrow ? rr.barY + 17 : y + rr.h;
    parts.push(el("line", { x1: x(m.nb), x2: x(m.nb), y1: b0, y2: b1, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "2 2" }));
    y += rr.h;
  }

  // Dollar axis under the sensitivity rows.
  const ticks = x.ticks(narrow ? 4 : 6);
  y += 4;
  parts.push(el("line", { x1: x(d0), x2: x(d1), y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  let last = -Infinity;
  for (const t of ticks) {
    const px = x(t);
    parts.push(el("line", { x1: px, x2: px, y1: y, y2: y + 4, stroke: C.rule, "stroke-width": 1 }));
    const tl = money(t);
    const tw = textWidth(tl, TYPE.small);
    if (px - tw / 2 < last + 6 || px - tw / 2 < 0 || px + tw / 2 > w) continue;
    last = px + tw / 2;
    parts.push(text(px, y + 17, tl, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-num" }));
  }
  parts.push(text(narrow ? w / 2 : (x(d0) + x(d1)) / 2, y + 34, L.axis, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  y += 40;
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "adoption-ledger",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    saved: {
      kind: "range", label: { en: "Paid time saved per accepted unit (pilot estimate)", zh: "每个验收单位节省的有偿时间（试点估计）" }, unit: { en: "min", zh: "分钟" },
      min: -10, max: 30, step: 0.5, default: 6,
    },
    ci: { kind: "range", label: { en: "95% interval on the estimate, ±", zh: "估计值的 95% 区间，±" }, unit: { en: "min", zh: "分钟" }, min: 0, max: 15, step: 0.5, default: 4 },
    wage: { kind: "range", label: { en: "Labor value w", zh: "劳动价值 w" }, unit: { en: "USD per hour", zh: "美元/小时" }, min: 15, max: 150, step: 1, default: 50 },
    convert: { kind: "range", label: { en: "Saved hours converted to cash κ", zh: "折成现金的节省工时 κ" }, unit: { en: "%", zh: "%" }, min: 0, max: 100, step: 5, default: 60 },
    volume: { kind: "range", scale: "log", label: { en: "Accepted units over H", zh: "核算期内验收单位数" }, min: 1000, max: 1000000, default: 100000 },
    incidents: { kind: "range", label: { en: "Change in incidents per 100k units", zh: "每 10 万单位的事故变化" }, min: -5, max: 10, step: 0.5, default: 2 },
    window: { kind: "range", label: { en: "Defect window W", zh: "缺陷观察期 W" }, unit: { en: "days", zh: "天" }, min: 1, max: 90, step: 1, default: 14 },
    hurdle: { kind: "range", label: { en: "Hurdle for net benefit", zh: "净收益门槛" }, unit: { en: "USD", zh: "美元" }, min: 0, max: 500000, step: 10000, default: 0 },
    model: { kind: "range", label: { en: "Model and tool cost per unit", zh: "单位模型与工具成本" }, min: 0, max: 5, step: 0.01, default: 0.4, control: false },
    fixed: { kind: "range", label: { en: "Fixed adoption cost", zh: "固定采用成本" }, min: 0, max: 5000000, step: 1000, default: 150000, control: false },
    loss: { kind: "range", label: { en: "Loss per incident", zh: "单次事故损失" }, min: 0, max: 10000000, step: 100, default: 20000, control: false },
    defects: { kind: "range", label: { en: "Extra delayed defects per 1,000 units", zh: "每千单位新增延迟缺陷" }, min: 0, max: 100, step: 0.5, default: 5, control: false },
    repair: { kind: "range", label: { en: "Repair cost per defect", zh: "单个缺陷修复成本" }, min: 0, max: 10000, step: 1, default: 120, control: false },
    delay: { kind: "range", label: { en: "Mean delay to a delayed defect", zh: "延迟缺陷平均出现时间" }, min: 1, max: 365, step: 1, default: 30, control: false },
    revenue: { kind: "range", label: { en: "Revenue change per unit", zh: "单位收入变化" }, min: -10, max: 10, step: 0.01, default: 0, control: false },
    harm: { kind: "range", label: { en: "Harm boundary, incidents per 100k units", zh: "损害边界，每 10 万单位事故数" }, min: 0, max: 20, step: 0.5, default: 5, control: false },
    spread: { kind: "range", label: { en: "Sensitivity range", zh: "敏感性区间" }, min: 5, max: 80, step: 5, default: 30, control: false },
  },
  render,
  describe,
});
