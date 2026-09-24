// Model selection as gates, then a Pareto frontier, from the choosing-a-model
// chapter's own rules:
//
//   hard gate      E(m) = H_license ∧ H_data ∧ H_region ∧ H_interface ∧ H_capacity,
//                  every factor Boolean, and an unknown does not pass
//   quality gate   d_i = y_i^(m) − y_i^(b); a challenger passes when the lower
//                  bound of the interval for the mean paired difference d̄ is
//                  greater than −δ (non-inferiority margin δ > 0)
//   declared limit p95 latency at or under the limit in the evaluation contract
//   cost           C_m = Σ_s w_s Σ_r K_msr / Σ_s w_s Σ_r A_msr, which for a
//                  weighted run is the mean cost per attempt divided by the
//                  accepted fraction
//   frontier       among the survivors, m is dominated when another survivor
//                  accepts at least as often at no higher C_m, and is strictly
//                  better on one of the two
//
// The nine candidates are illustrative and name no product: the acceptance
// rates, interval half-widths, costs per attempt, and p95 latencies are chosen
// so that each gate removes at least one candidate and the incumbent can be
// dominated. The workload switches say whether the workload declares a region,
// retention, or interface requirement; a requirement the workload does not
// declare holds for every candidate. License and capacity always apply.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- candidates

type Gate = 1 | 0 | -1; // holds, fails, unknown
const GATES = ["license", "data", "region", "iface", "capacity"] as const;
type GateKey = typeof GATES[number];

interface Cand {
  id: CandId;
  gates: Record<GateKey, Gate>;
  acc: number; // accepted fraction on the confirmation set
  hw: number; // half-width of the interval for d̄, percentage points
  attempt: number; // mean end-to-end cost per attempt, USD
  p95: number; // p95 end-to-end latency, seconds
}

const IDS = ["I", "A", "B", "C", "D", "E", "F", "G", "H"] as const;
type CandId = typeof IDS[number];
const BASE: CandId = "I";

const ok = { license: 1, data: 1, region: 1, iface: 1, capacity: 1 } as const;
const CANDS: Cand[] = [
  { id: "I", gates: { ...ok }, acc: 0.82, hw: 0, attempt: 0.030, p95: 6 },
  { id: "A", gates: { ...ok }, acc: 0.88, hw: 2.0, attempt: 0.090, p95: 14 },
  { id: "B", gates: { ...ok, region: 0 }, acc: 0.85, hw: 2.2, attempt: 0.028, p95: 5 },
  { id: "C", gates: { ...ok }, acc: 0.74, hw: 2.5, attempt: 0.006, p95: 2.5 },
  { id: "D", gates: { ...ok, license: -1 }, acc: 0.80, hw: 2.8, attempt: 0.012, p95: 4 },
  { id: "E", gates: { ...ok, capacity: 0 }, acc: 0.795, hw: 2.0, attempt: 0.015, p95: 4.5 },
  { id: "F", gates: { ...ok }, acc: 0.84, hw: 2.4, attempt: 0.025, p95: 16 },
  { id: "G", gates: { ...ok, iface: 0 }, acc: 0.86, hw: 2.3, attempt: 0.040, p95: 7 },
  { id: "H", gates: { ...ok, data: 0 }, acc: 0.83, hw: 2.1, attempt: 0.020, p95: 5 },
];
const byId = new Map(CANDS.map((c) => [c.id, c]));

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Model selection: hard gates, a quality gate, then the Pareto frontier",
    x: "cost per accepted task C_m (USD, log scale)",
    y: "accepted on the confirmation set (%)",
    floor: "quality floor {b}% − δ = {f}%",
    floorShort: "floor {f}%",
    lgFront: "shortlist (frontier)",
    lgDom: "dominated",
    lgFail: "fails quality gate or p95 limit",
    lgBand: "interval for d̄",
    colCand: "candidate",
    license: "license", data: "data", region: "region", iface: "tools", capacity: "capacity",
    hLicense: "lic", hData: "data", hRegion: "reg", hIface: "tools", hCapacity: "cap",
    keyShort: "lic license, reg region, cap capacity. ✓ holds, ✕ fails, ? unknown, – not declared by this workload",
    colLow: "d̄ low",
    colP95: "p95",
    colStatus: "status",
    notRequired: "–",
    key: "✓ holds, ✕ fails, ? unknown, – not declared by this workload",
    nI: "incumbent, hosted",
    nA: "hosted, larger model",
    nB: "hosted, other region",
    nC: "hosted, small model",
    nD: "self-hosted open weights",
    nE: "managed endpoint",
    nF: "cascade: C, then A",
    nG: "hosted, loose schema",
    nH: "hosted, keeps prompts",
    stFront: "shortlist",
    stDom: "dominated by {by}",
    stQual: "below floor",
    stSlow: "over p95 limit",
    stGate: "fails {gate}",
    stUnknown: "{gate} unknown",
    stGateShort: "ineligible",
    stUnknownShort: "unknown",
    head: "{id}: {name}",
    rBase: "Baseline of the paired comparison: d̄ = 0 by definition.",
    rQual: "d̄ = {d} points, interval [{lo}, {hi}]; lower bound {lo} {cmp} −δ = −{delta}: {verdict}",
    pass: "passes", fail: "fails",
    rCost: "C_m = {k} per attempt ÷ {a} accepted = {c} per accepted task",
    rP95: "p95 latency {p} s against the {lim} s limit",
    rFront: "On the frontier: no surviving candidate accepts at least as often for no more cost.",
    rDom: "Dominated by {by}: {bacc} accepted at {bc}, against {acc} at {c}.",
    rGate: "Ineligible: E(m) fails on {gate}, so the candidate is not measured or ranked.",
    rUnknown: "Ineligible: the {gate} review is unresolved. An unknown does not pass, so the candidate goes to the exception process.",
    rQualOut: "Fails the quality gate, so it never enters the cost comparison.",
    rSlow: "Over the declared p95 limit, so it never enters the cost comparison.",
    gLicense: "license", gData: "data handling", gRegion: "region", gIface: "interface", gCapacity: "capacity",
    describe: "{e} of 9 candidates pass the hard gates and {q} also clear the quality gate at δ = {delta} points and the {lim} s p95 limit. The shortlist on the frontier is {list}. Selected {id}, {name}: {status}.",
    none: "empty",
  },
  zh: {
    title: "模型选型：硬约束门、质量门与帕累托前沿",
    x: "每项合格任务成本 C_m（美元，对数刻度）",
    y: "确认集上的合格率（%）",
    floor: "质量下限 {b}% − δ = {f}%",
    floorShort: "下限 {f}%",
    lgFront: "候选名单（前沿）",
    lgDom: "被支配",
    lgFail: "未过质量门或 p95 上限",
    lgBand: "d̄ 的区间",
    colCand: "候选系统",
    license: "许可", data: "数据", region: "区域", iface: "工具", capacity: "容量",
    hLicense: "许可", hData: "数据", hRegion: "区域", hIface: "工具", hCapacity: "容量",
    keyShort: "✓ 满足，✕ 不满足，? 未知，– 本工作负载未声明",
    colLow: "d̄ 下界",
    colP95: "p95",
    colStatus: "状态",
    notRequired: "–",
    key: "✓ 满足，✕ 不满足，? 未知，– 本工作负载未声明",
    nI: "现有系统，托管",
    nA: "托管，更大的模型",
    nB: "托管，处理区域不符",
    nC: "托管，小模型",
    nD: "自托管开放权重",
    nE: "代管端点",
    nF: "级联：先 C 后 A",
    nG: "托管，结构化输出不严格",
    nH: "托管，保留提示词",
    stFront: "入选名单",
    stDom: "被 {by} 支配",
    stQual: "低于下限",
    stSlow: "超出 p95 上限",
    stGate: "{gate}不满足",
    stUnknown: "{gate}未知",
    stGateShort: "不具备资格",
    stUnknownShort: "结论未知",
    head: "{id}：{name}",
    rBase: "配对比较的基线：按定义 d̄ = 0。",
    rQual: "d̄ = {d} 个百分点，区间 [{lo}, {hi}]；下界 {lo} {cmp} −δ = −{delta}：{verdict}",
    pass: "通过", fail: "未通过",
    rCost: "C_m = 每次尝试 {k} ÷ 合格率 {a} = 每项合格任务 {c}",
    rP95: "p95 延迟 {p} 秒，上限 {lim} 秒",
    rFront: "位于前沿：没有其他留下的候选能以不更高的成本达到不更低的合格率。",
    rDom: "被 {by} 支配：{by} 以 {bc} 达到 {bacc}，本候选以 {c} 只有 {acc}。",
    rGate: "不具备准入资格：E(m) 在{gate}一项上不成立，因此不参加测量和排序。",
    rUnknown: "不具备准入资格：{gate}审查尚无结论。未知不能视为通过，该候选进入例外流程。",
    rQualOut: "未通过质量门，因此不进入成本比较。",
    rSlow: "超出声明的 p95 上限，因此不进入成本比较。",
    gLicense: "许可", gData: "数据处理", gRegion: "区域", gIface: "接口", gCapacity: "容量",
    describe: "9 个候选中有 {e} 个通过硬约束门，其中 {q} 个在 δ = {delta} 个百分点和 p95 上限 {lim} 秒下也通过质量门。前沿上的候选名单为 {list}。当前选中 {id}（{name}）：{status}。",
    none: "空",
  },
};
type L = typeof labels.en;

// ---------------------------------------------------------------- model

type P = { region: boolean; retention: boolean; tools: boolean; delta: number; p95: number; pick: CandId };

type Status =
  | { kind: "gate"; gate: GateKey }
  | { kind: "unknown"; gate: GateKey }
  | { kind: "quality" }
  | { kind: "slow" }
  | { kind: "dominated"; by: CandId }
  | { kind: "frontier" };

// The workload switches decide which predicates are declared; an undeclared
// requirement holds for every candidate.
function declared(p: P, k: GateKey): boolean {
  if (k === "region") return p.region;
  if (k === "data") return p.retention;
  if (k === "iface") return p.tools;
  return true;
}

export const costPerAccepted = (c: Cand) => c.attempt / c.acc;
const diff = (c: Cand) => (c.acc - byId.get(BASE)!.acc) * 100; // d̄, points
const lower = (c: Cand) => diff(c) - c.hw;

function model(p: P) {
  const status = new Map<CandId, Status>();
  const survivors: Cand[] = [];
  for (const c of CANDS) {
    // E(m): the first predicate that does not hold decides; unknown fails.
    const bad = GATES.find((k) => declared(p, k) && c.gates[k] !== 1);
    if (bad) { status.set(c.id, c.gates[bad] === -1 ? { kind: "unknown", gate: bad } : { kind: "gate", gate: bad }); continue; }
    if (c.id !== BASE && !(lower(c) > -p.delta)) { status.set(c.id, { kind: "quality" }); continue; }
    if (c.p95 > p.p95) { status.set(c.id, { kind: "slow" }); continue; }
    survivors.push(c);
  }
  for (const c of survivors) {
    const doms = survivors.filter((o) => o !== c
      && o.acc >= c.acc && costPerAccepted(o) <= costPerAccepted(c)
      && (o.acc > c.acc || costPerAccepted(o) < costPerAccepted(c)));
    // Name the cheapest dominating candidate.
    doms.sort((a, b) => costPerAccepted(a) - costPerAccepted(b));
    status.set(c.id, doms.length ? { kind: "dominated", by: doms[0].id } : { kind: "frontier" });
  }
  const eligible = CANDS.filter((c) => { const s = status.get(c.id)!; return s.kind !== "gate" && s.kind !== "unknown"; }).length;
  const frontier = CANDS.filter((c) => status.get(c.id)!.kind === "frontier").sort((a, b) => costPerAccepted(a) - costPerAccepted(b));
  return { status, survivors, eligible, frontier };
}

const gateName = (L: L, k: GateKey) => ({ license: L.gLicense, data: L.gData, region: L.gRegion, iface: L.gIface, capacity: L.gCapacity })[k];
const nameOf = (L: L, id: CandId) => L[`n${id}` as keyof L];
const money = (v: number) => (v < 0.01 ? sig(v, 2) : v < 0.1 ? fixed(v, 3) : fixed(v, 2));
const usd = (v: number, lang: Lang) => (lang === "zh" ? `${money(v)} 美元` : `$${money(v)}`);
const signed = (v: number) => (v > 0 ? "+" : "") + fixed(v, 1);

function statusShort(L: L, s: Status): string {
  switch (s.kind) {
    case "frontier": return L.stFront;
    case "dominated": return tpl(L.stDom, { by: s.by });
    case "quality": return L.stQual;
    case "slow": return L.stSlow;
    case "gate": return tpl(L.stGate, { gate: gateName(L, s.gate) });
    case "unknown": return tpl(L.stUnknown, { gate: gateName(L, s.gate) });
  }
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const sep = lang === "zh" ? "、" : ", ";
  return tpl(L.describe, {
    e: m.eligible, q: m.survivors.length, delta: fixed(p.delta, 1), lim: sig(p.p95, 3),
    list: m.frontier.length ? m.frontier.map((c) => c.id).join(sep) : L.none,
    id: p.pick, name: nameOf(L, p.pick), status: statusShort(L, m.status.get(p.pick)!),
  });
}

// ---------------------------------------------------------------- render

const Y_DOMAIN: [number, number] = [66, 92]; // accepted, percent
const X_DOMAIN: [number, number] = [0.005, 0.2]; // USD per accepted task

function glyph(v: Gate | null): string {
  return v === null ? "–" : v === 1 ? "✓" : v === 0 ? "✕" : "?";
}
function cellFill(v: Gate | null): { fill: string; op: number } {
  if (v === null) return { fill: C.panel, op: 1 };
  return v === 1 ? { fill: C.good, op: 0.18 } : v === 0 ? { fill: C.bad, op: 0.22 } : { fill: C.warn, op: 0.3 };
}

function renderPlot(p: P, m: ReturnType<typeof model>, w: number, L: L, lang: Lang): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const left = narrow ? 34 : 40, right = 10, top = 24;
  const plotH = narrow ? 220 : 260;
  const bottom = top + plotH;
  const x = log(X_DOMAIN, [left, w - right]);
  const y = linear(Y_DOMAIN, [bottom, top]);
  const parts: string[] = [];
  const obstacles: Box[] = [];

  // The region the shortlist dominates: below and to the right of the staircase.
  const front = m.frontier;
  if (front.length) {
    const pts: Array<[number, number]> = [[x(costPerAccepted(front[0])), bottom]];
    front.forEach((c, i) => {
      const px = x(costPerAccepted(c)), py = y(c.acc * 100);
      if (i > 0) pts.push([px, pts[pts.length - 1][1]]);
      pts.push([px, py]);
    });
    pts.push([w - right, pts[pts.length - 1][1]]);
    parts.push(el("path", { d: linePath([...pts, [w - right, bottom]]) + "Z", fill: C.c1, "fill-opacity": 0.07 }));
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.c1, "stroke-width": 1.5, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(pts));
  }

  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top, bottom], minor: true, title: L.x, size: fs, format: (v) => sig(v, 2) }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], title: L.y, size: fs, ticks: [70, 75, 80, 85, 90], format: (v) => String(v) }));

  // Quality floor: incumbent acceptance minus δ.
  const base = byId.get(BASE)!.acc * 100;
  const fy = y(base - p.delta);
  parts.push(el("line", { x1: left, x2: w - right, y1: fy, y2: fy, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 4" }));
  obstacles.push(...lineObstacles([[left, fy], [w - right, fy]], 8, 2));
  const floorText = tpl(narrow ? L.floorShort : L.floor, { b: sig(base, 3), f: sig(base - p.delta, 3) });

  // Candidates that passed the hard gate; the ones that did not are never measured.
  const reqs = [];
  for (const c of CANDS) {
    const s = m.status.get(c.id)!;
    if (s.kind === "gate" || s.kind === "unknown") continue;
    const px = x(costPerAccepted(c)), py = y(c.acc * 100);
    const col = s.kind === "frontier" ? C.c1 : s.kind === "dominated" ? C.ink3 : C.ink2;
    if (c.hw > 0) {
      const y0 = y(c.acc * 100 - c.hw), y1 = y(c.acc * 100 + c.hw);
      parts.push(el("line", { x1: px, x2: px, y1: y0, y2: y1, stroke: col, "stroke-width": 1.5 }));
      parts.push(el("line", { x1: px - 4, x2: px + 4, y1: y0, y2: y0, stroke: col, "stroke-width": 1.5 }));
      parts.push(el("line", { x1: px - 4, x2: px + 4, y1: y1, y2: y1, stroke: col, "stroke-width": 1.5 }));
      obstacles.push({ x0: px - 5, y0: y1 - 1, x1: px + 5, y1: y0 + 1 });
    }
    const hollow = s.kind === "quality" || s.kind === "slow";
    const r = s.kind === "frontier" ? 6 : 5;
    if (c.id === p.pick) parts.push(el("circle", { cx: px, cy: py, r: r + 4, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    parts.push(el("circle", {
      cx: px, cy: py, r, fill: hollow ? C.paper : col, stroke: hollow ? col : C.paper, "stroke-width": hollow ? 1.8 : 1.5,
      "stroke-dasharray": s.kind === "slow" ? "2.5 2" : undefined,
    }));
    parts.push(el("circle", { cx: px, cy: py, r: 11, fill: "transparent", "data-fig-set": `pick=${c.id}`, class: "fig-hit" }));
    const rr = c.id === p.pick ? r + 6 : r + 2;
    obstacles.push({ x0: px - rr, y0: py - rr, x1: px + rr, y1: py + rr });
    reqs.push({
      x: px, y: py, text: c.id, size: TYPE.body, gap: c.id === p.pick ? 14 : 9, priority: c.id === p.pick ? 3 : 2,
      sides: ["left", "right", "above-left", "above-right", "below-left", "below-right"] as ("left" | "right" | "above-left" | "above-right" | "below-left" | "below-right")[],
      attrs: { class: s.kind === "dominated" || hollow ? "fig-t-halo fig-t-soft" : "fig-t-halo" },
    });
  }
  const placed = placeLabels([
    ...reqs,
    { x: w - right - 4, y: fy, text: floorText, size: fs, gap: 4, priority: 1, sides: ["above-left", "below-left"], attrs: { class: "fig-t-halo fig-t-soft" } },
  ], { x0: left + 2, y0: top + 2, x1: w - right, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));

  let yy = bottom + axisHeight(true, fs) + 4;
  const lg = legend([
    { label: L.lgFront, swatch: { kind: "dot", fill: C.c1 } },
    { label: L.lgDom, swatch: { kind: "dot", fill: C.ink3 } },
    { label: L.lgFail, swatch: { kind: "rect", fill: "none", stroke: C.ink2 } },
    { label: L.lgBand, swatch: { kind: "line", stroke: C.ink2 } },
  ], 0, yy, w, fs);
  parts.push(lg.svg);
  yy += lg.height;
  void lang;
  return { svg: g({ class: "fig-plot" }, ...parts), h: yy };
}

function renderTable(p: P, m: ReturnType<typeof model>, y0: number, w: number, L: L): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const rowH = narrow ? 24 : 22;
  const parts: string[] = [];
  const idW = 22;
  const nameW = narrow ? 0 : Math.max(...IDS.map((id) => textWidth(nameOf(L, id), fs))) + 12;
  const head = (k: GateKey) => (narrow ? L[({ license: "hLicense", data: "hData", region: "hRegion", iface: "hIface", capacity: "hCapacity" } as const)[k]] : L[k]);
  const gateW = Math.max(narrow ? 30 : 34, ...GATES.map((k) => textWidth(head(k), fs) + 6));
  const numW = narrow ? 0 : Math.max(textWidth(L.colLow, fs), textWidth("−10.5", fs)) + 12;
  const p95W = narrow ? 0 : Math.max(textWidth(L.colP95, fs), textWidth("2.5 s", fs)) + 12;
  const xGate = idW + nameW;
  const xNum = xGate + GATES.length * gateW + 6;
  const xP95 = xNum + numW;
  const xStatus = xP95 + p95W + 4;
  const statusW = w - xStatus;

  // Header.
  let y = y0;
  if (!narrow) parts.push(text(idW, y + 13, L.colCand, { "font-size": fs, class: "fig-t-muted" }));
  GATES.forEach((k, i) => parts.push(text(xGate + i * gateW + gateW / 2, y + 13, head(k), { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" })));
  if (!narrow) {
    parts.push(text(xNum + numW - 6, y + 13, L.colLow, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(xP95 + p95W - 6, y + 13, L.colP95, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  }
  parts.push(text(xStatus, y + 13, L.colStatus, { "font-size": fs, class: "fig-t-muted" }));
  y += 20;

  for (const c of CANDS) {
    const s = m.status.get(c.id)!;
    const picked = c.id === p.pick;
    const row: string[] = [];
    if (picked) row.push(el("rect", { x: 0, y, width: w, height: rowH, rx: 3, fill: C.panel }));
    row.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const base = y + rowH / 2 + fs * 0.35;
    row.push(text(6, base, c.id, { "font-size": TYPE.body, class: "fig-t-strong" }));
    if (!narrow) row.push(text(idW, base, nameOf(L, c.id), { "font-size": fs, class: picked ? "fig-t-strong" : undefined }));
    const measured = s.kind !== "gate" && s.kind !== "unknown";
    GATES.forEach((k, i) => {
      const v: Gate | null = declared(p, k) ? c.gates[k] : null;
      const f = cellFill(v);
      const cx = xGate + i * gateW;
      row.push(el("rect", { x: cx + 2, y: y + 3, width: gateW - 4, height: rowH - 6, rx: 3, fill: f.fill, "fill-opacity": f.op }));
      row.push(text(cx + gateW / 2, base, glyph(v), { "font-size": TYPE.body, "text-anchor": "middle", class: v === 1 ? "fig-t-muted" : v === null ? "fig-t-faint" : "fig-t-strong" }));
    });
    if (!narrow) {
      // Measurements exist only for candidates that passed the hard gate.
      const low = c.id === BASE ? "0" : fixed(lower(c), 1);
      const qOk = c.id === BASE || lower(c) > -p.delta;
      const tOk = c.p95 <= p.p95;
      if (measured) {
        row.push(el("rect", { x: xNum + 2, y: y + 3, width: numW - 4, height: rowH - 6, rx: 3, fill: qOk ? C.good : C.bad, "fill-opacity": qOk ? 0.18 : 0.22 }));
        row.push(el("rect", { x: xP95 + 2, y: y + 3, width: p95W - 4, height: rowH - 6, rx: 3, fill: tOk ? C.good : C.bad, "fill-opacity": tOk ? 0.18 : 0.22 }));
      }
      row.push(text(xNum + numW - 6, base, measured ? low : "–", { "font-size": fs, "text-anchor": "end", class: measured ? (qOk ? "fig-t-num" : "fig-t-num fig-t-strong") : "fig-t-faint" }));
      row.push(text(xP95 + p95W - 6, base, measured ? `${sig(c.p95, 2)} s` : "–", { "font-size": fs, "text-anchor": "end", class: measured ? (tOk ? "fig-t-num" : "fig-t-num fig-t-strong") : "fig-t-faint" }));
    }
    let st = statusShort(L, s);
    const room = statusW - (s.kind === "frontier" ? 14 : 0);
    if (textWidth(st, fs) > room) st = s.kind === "gate" ? L.stGateShort : s.kind === "unknown" ? L.stUnknownShort : st;
    const stClass = s.kind === "frontier" ? "fig-t-strong" : s.kind === "dominated" ? "fig-t-muted" : "fig-t-muted";
    if (s.kind === "frontier") row.push(el("circle", { cx: xStatus + 5, cy: y + rowH / 2, r: 4, fill: C.c1 }));
    row.push(text(xStatus + (s.kind === "frontier" ? 14 : 0), base, st, { "font-size": fs, class: stClass }));
    row.push(el("rect", { x: 0, y, width: w, height: rowH, fill: "transparent", "data-fig-set": `pick=${c.id}`, class: "fig-hit" }));
    parts.push(g({}, ...row));
    y += rowH;
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  const keyLines = wrap(narrow ? L.keyShort : L.key, fs, w - fs);
  keyLines.forEach((ln, i) => parts.push(text(0, y + 16 + i * (fs + 4), ln, { "font-size": fs, class: "fig-t-muted" })));
  y += 8 + keyLines.length * (fs + 4);
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 };
}

function renderReadout(p: P, m: ReturnType<typeof model>, y0: number, w: number, L: L, lang: Lang): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = TYPE.body;
  const c = byId.get(p.pick)!;
  const s = m.status.get(c.id)!;
  const lines: Array<{ s: string; cls?: string }> = [];
  lines.push({ s: tpl(L.head, { id: c.id, name: nameOf(L, c.id) }), cls: "fig-t-strong" });
  const measured = s.kind !== "gate" && s.kind !== "unknown";
  if (!measured) {
    lines.push({ s: tpl(s.kind === "unknown" ? L.rUnknown : L.rGate, { gate: gateName(L, s.gate) }) });
  } else {
    if (c.id === BASE) lines.push({ s: L.rBase });
    else {
      const lo = lower(c), passes = lo > -p.delta;
      lines.push({ s: tpl(L.rQual, { d: signed(diff(c)), lo: signed(lo), hi: signed(diff(c) + c.hw), cmp: passes ? ">" : "≤", delta: fixed(p.delta, 1), verdict: passes ? L.pass : L.fail }), cls: "fig-t-num" });
    }
    lines.push({ s: tpl(L.rCost, { k: usd(c.attempt, lang), a: fixed(c.acc, 3).replace(/0+$/, "").replace(/\.$/, ""), c: usd(costPerAccepted(c), lang) }), cls: "fig-t-num" });
    lines.push({ s: tpl(L.rP95, { p: sig(c.p95, 2), lim: sig(p.p95, 3) }), cls: "fig-t-num" });
    if (s.kind === "quality") lines.push({ s: L.rQualOut });
    else if (s.kind === "slow") lines.push({ s: L.rSlow });
    else if (s.kind === "frontier") lines.push({ s: L.rFront });
    else if (s.kind === "dominated") {
      const b = byId.get(s.by)!;
      lines.push({ s: tpl(L.rDom, { by: b.id, bacc: `${fixed(b.acc * 100, 1)}%`, bc: usd(costPerAccepted(b), lang), acc: `${fixed(c.acc * 100, 1)}%`, c: usd(costPerAccepted(c), lang) }) });
    }
  }
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines) {
    for (const piece of wrap(ln.s, fs, w - fs)) {
      y += fs + 5;
      parts.push(text(0, y, piece, { "font-size": fs, class: ln.cls }));
    }
    y += narrow ? 3 : 2;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const m = model(p);
  const plot = renderPlot(p, m, w, L, lang);
  let y = plot.h + 10;
  const tb = renderTable(p, m, y, w, L);
  y += tb.h + 6;
  const ro = renderReadout(p, m, y, w, L, lang);
  y += ro.h;
  return svg(w, y, describe(st, lang), plot.svg, tb.svg, ro.svg);
}

export default defineFigure({
  name: "selection-frontier",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    region: { kind: "toggle", label: { en: "Workload requires in-region processing", zh: "工作负载要求区域内处理" }, default: true },
    retention: { kind: "toggle", label: { en: "Workload forbids prompt retention", zh: "工作负载禁止保留提示词" }, default: true },
    tools: { kind: "toggle", label: { en: "Workload requires tool calls and strict schemas", zh: "工作负载要求工具调用和严格结构化输出" }, default: true },
    delta: {
      kind: "range", label: { en: "Non-inferiority margin δ", zh: "非劣效界值 δ" }, unit: { en: "points", zh: "个百分点" },
      min: 0.5, max: 12, step: 0.5, default: 3,
    },
    p95: {
      kind: "range", label: { en: "Declared p95 latency limit", zh: "声明的 p95 延迟上限" }, unit: { en: "s", zh: "秒" },
      min: 2, max: 20, step: 1, default: 20,
    },
    pick: {
      kind: "choice", label: { en: "Candidate", zh: "候选系统" }, default: "F", control: "select",
      options: IDS.map((id) => ({ value: id, label: { en: `${id}: ${labels.en[`n${id}` as keyof L]}`, zh: `${id}：${labels.zh[`n${id}` as keyof L]}` } })),
    },
  },
  render,
  describe,
});
