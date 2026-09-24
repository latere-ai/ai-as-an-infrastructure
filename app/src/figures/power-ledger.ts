// The usable-IT-power bound of the powering-it chapter:
//
//   P_IT,max = min(P_source / PUE, P_sub / PUE, P_dist / PUE, Q_cool)
//   N_rack  <= ⌊P_IT,max / P_rack⌋
//
// The three electrical stages carry facility power, so each is divided by PUE
// to give the IT load it can support; cooling is already stated as the IT load
// it can reject. The site is illustrative: 320 MW of firm grid supply plus
// 80 MW on-site generation, three 150 MW substation transformers, 380 MW of
// distribution, and four coolant loops of 70 MW of IT heat each. A declared
// contingency removes one element (a transformer, the on-site supply, or a
// coolant loop), which is what makes a figure firm.
//
// Two values come from the chapter's sources: the PUE default of 1.54 is the
// respondent-weighted industry average in Uptime Institute's 2025 survey, and
// the rack default of 142 kW is NVIDIA's maximum input power for one GB300
// NVL72 rack. Both are marked on their controls and cited in the caption.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, text, g } from "./lib/svg.ts";
import { TYPE } from "./lib/theme.ts";
import { wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { int, fixed, tpl } from "./lib/format.ts";
import { bottleneckBars, binding } from "./lib/bottleneck.ts";

// Illustrative site, MW at each stage's own boundary.
const SITE = { grid: 320, onsite: 80, transformers: 3, transformerMW: 150, dist: 380, loops: 4, loopMW: 70 } as const;
export const UPTIME_PUE_2025 = 1.54; // Uptime Institute 2025 survey, respondent-weighted annual average
export const GB300_NVL72_KW = 142; // NVIDIA GB300 NVL72, maximum rack input power

type Contingency = "none" | "transformer" | "onsite" | "loop";

const labels = {
  en: {
    title: "Usable IT power and supported racks",
    source: "Net firm source",
    sub: "Accepted substation",
    dist: "Distribution",
    cool: "Cooling",
    dSource: "P_source / PUE = {v} / {pue}",
    dSub: "P_sub / PUE = {v} / {pue}",
    dDist: "P_dist / PUE = {v} / {pue}",
    dCool: "Q_cool = {n} × {m} MW of IT heat",
    bound: "P_IT,max = {v} MW",
    lgBinding: "binding stage",
    lgUsed: "used at the bound",
    lgUnused: "unused",
    lgRef: "all equipment in service",
    eq: "P_IT,max = min({terms}) = {v} MW",
    racks: "N_rack ≤ ⌊{p} MW / {r} kW⌋ = {n} racks",
    facility: "At that IT load the facility draws P_IT,max × PUE = {f} MW.",
    crossPue: "{bind} binds. Below PUE {x}, cooling binds instead, and a lower PUE adds no IT power.",
    crossCool: "Cooling binds. Above PUE {x}, {next} binds instead.",
    noCont: "No contingency declared, so these are not firm figures.",
    cont: "Declared contingency: {c}.",
    cTransformer: "one of 3 transformers out",
    cOnsite: "on-site generation offline",
    cLoop: "one of 4 coolant loops out",
    illustrative: "Illustrative site. PUE 1.54: Uptime Institute 2025 survey average. 142 kW: GB300 NVL72 maximum rack input.",
    describe: "{bind} binds at {v} MW of IT power with PUE {pue}, which supports {n} racks of {r} kW. {cont}",
  },
  zh: {
    title: "可用 IT 电力与可支持的机架数",
    source: "净额稳定电源",
    sub: "已验收变电站",
    dist: "配电",
    cool: "冷却",
    dSource: "P_source / PUE = {v} / {pue}",
    dSub: "P_sub / PUE = {v} / {pue}",
    dDist: "P_dist / PUE = {v} / {pue}",
    dCool: "Q_cool = {n} × {m} MW IT 热负荷",
    bound: "P_IT,max = {v} MW",
    lgBinding: "约束环节",
    lgUsed: "上界内用得上",
    lgUnused: "用不上",
    lgRef: "设备全部在役",
    eq: "P_IT,max = min({terms}) = {v} MW",
    racks: "N_rack ≤ ⌊{p} MW / {r} kW⌋ = {n} 个机架",
    facility: "在这一 IT 负载下，设施总耗电为 P_IT,max × PUE = {f} MW。",
    crossPue: "{bind}构成约束。PUE 低于 {x} 时改由冷却构成约束，再降低 PUE 也不会增加 IT 电力。",
    crossCool: "冷却构成约束。PUE 高于 {x} 时改由{next}构成约束。",
    noCont: "没有声明事故情景，因此这些数字都不是稳定容量。",
    cont: "声明的事故情景：{c}。",
    cTransformer: "3 台变压器中 1 台停运",
    cOnsite: "现场发电离线",
    cLoop: "4 条冷却液回路中 1 条停运",
    illustrative: "示例厂址。PUE 1.54 取自 Uptime Institute 2025 年调查均值；142 kW 为 GB300 NVL72 机架最大输入功率。",
    describe: "PUE 为 {pue} 时，{bind}在 {v} MW IT 电力处构成约束，可支持 {n} 个 {r} kW 的机架。{cont}",
  },
};

type P = { pue: number; rack: number; contingency: Contingency };
const STAGES = ["source", "sub", "dist", "cool"] as const;

// Stage capacities at their own boundary, with and without the contingency.
function capacities(c: Contingency) {
  return {
    source: SITE.grid + (c === "onsite" ? 0 : SITE.onsite),
    sub: SITE.transformerMW * (SITE.transformers - (c === "transformer" ? 1 : 0)),
    dist: SITE.dist,
    cool: SITE.loopMW * (SITE.loops - (c === "loop" ? 1 : 0)),
  };
}

function model(p: P) {
  const cap = capacities(p.contingency);
  const nominal = capacities("none");
  const it = (c: typeof cap) => [c.source / p.pue, c.sub / p.pue, c.dist / p.pue, c.cool];
  const values = it(cap);
  const refs = it(nominal);
  const { bind, next } = binding(values);
  const pit = values[bind];
  const racks = Math.floor((pit * 1000) / p.rack);
  // PUE at which the smallest electrical stage meets cooling.
  const elec = Math.min(cap.source, cap.sub, cap.dist);
  const elecIdx = [cap.source, cap.sub, cap.dist].indexOf(elec);
  const crossover = elec / cap.cool;
  return { cap, values, refs, bind, next, pit, racks, facility: pit * p.pue, crossover, elecIdx };
}

const mw = (v: number) => fixed(v, 1);

function contText(c: Contingency, L: typeof labels.en): string {
  if (c === "none") return L.noCont;
  return tpl(L.cont, { c: c === "transformer" ? L.cTransformer : c === "onsite" ? L.cOnsite : L.cLoop });
}

const lower = (s: string, lang: Lang) => (lang === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, {
    bind: L[STAGES[m.bind]], v: fixed(m.pit, 1), pue: fixed(st.p.pue, 2), n: int(m.racks), r: int(st.p.rack), cont: contText(st.p.contingency, L),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const fs = TYPE.body;
  const m = model(p);
  const pue = fixed(p.pue, 2);
  const details = [
    tpl(L.dSource, { v: int(m.cap.source), pue }),
    tpl(L.dSub, { v: int(m.cap.sub), pue }),
    tpl(L.dDist, { v: int(m.cap.dist), pue }),
    tpl(L.dCool, { n: m.cap.cool / SITE.loopMW, m: SITE.loopMW }),
  ];
  const bars = bottleneckBars(STAGES.map((k, i) => ({
    label: L[k], detail: details[i], value: m.values[i], ref: m.refs[i],
  })), {
    x: 0, y: 0, w, fmt: (v) => `${mw(v)} MW`,
    boundLabel: tpl(L.bound, { v: mw(m.pit) }),
    legend: { binding: L.lgBinding, used: L.lgUsed, unused: L.lgUnused, ref: L.lgRef },
    max: Math.max(400, ...m.values, ...m.refs),
  });

  // Readout: the equation's terms, the rack quotient, the facility draw, and
  // where the binding stage would move as PUE changes.
  const wrapL = (s: string, mw_: number) => (lang === "zh" ? wrapCjk(s, fs, mw_) : wrap(s, fs, mw_));
  const bindName = L[STAGES[m.bind]];
  let cross: string;
  if (m.bind === 3) cross = tpl(L.crossCool, { x: fixed(m.crossover, 2), next: lower(L[STAGES[m.elecIdx]], lang) });
  else cross = tpl(L.crossPue, { bind: bindName, x: fixed(m.crossover, 2) });
  const lines: Array<[string, string]> = [
    [tpl(L.eq, { terms: m.values.map((v) => fixed(v, 1)).join(", "), v: fixed(m.pit, 1) }), "fig-t-strong fig-t-num"],
    [tpl(L.racks, { p: fixed(m.pit, 1), r: int(p.rack), n: int(m.racks) }), "fig-t-strong fig-t-num"],
    [tpl(L.facility, { f: fixed(m.facility, 1) }), ""],
    [cross, ""],
    [contText(p.contingency, L), ""],
    [L.illustrative, "fig-t-muted"],
  ];
  let y = bars.h + 22;
  const ro: string[] = [];
  for (const [s, cls] of lines) {
    for (const ln of wrapL(s, cls.includes("strong") ? w / 1.1 : w)) { ro.push(text(0, y, ln, { "font-size": fs, class: cls || undefined })); y += fs + 6; }
    y += 4;
  }
  return svg(w, y, describe(st, lang), bars.svg, g({ class: "fig-readout" }, ...ro));
}

export default defineFigure({
  name: "power-ledger",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    pue: {
      kind: "range", label: { en: "PUE (facility power ÷ IT power)", zh: "PUE（设施总耗电 ÷ IT 耗电）" }, min: 1.05, max: 2, step: 0.01, default: UPTIME_PUE_2025,
      marks: [{ value: UPTIME_PUE_2025, label: { en: "Uptime 2025 average", zh: "Uptime 2025 均值" } }],
    },
    rack: {
      kind: "range", label: { en: "Design power per rack P_rack", zh: "每机架设计功率 P_rack" }, unit: { en: "kW", zh: "kW" },
      min: 10, max: 200, step: 1, default: GB300_NVL72_KW,
      marks: [{ value: GB300_NVL72_KW, label: { en: "GB300 NVL72", zh: "GB300 NVL72" } }],
    },
    contingency: {
      kind: "choice", label: { en: "Declared contingency", zh: "声明的事故情景" }, default: "none",
      options: [
        { value: "none", label: { en: "none", zh: "无" } },
        { value: "transformer", label: { en: "transformer out", zh: "变压器停运" } },
        { value: "onsite", label: { en: "on-site generation out", zh: "现场发电离线" } },
        { value: "loop", label: { en: "coolant loop out", zh: "冷却回路停运" } },
      ],
    },
  },
  render,
  describe,
});
