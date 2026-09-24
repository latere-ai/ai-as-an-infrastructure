// The package supply ledger of the making-the-silicon chapter:
//
//   N_ship <= min(⌊G_L/d⌋, ⌊G_H/h⌋, ⌊G_I/i⌋, ⌊G_S/s⌋, C_A, C_T)
//
// every input converted into package-equivalents before the minimum is taken.
// The inventories and capacities are the chapter's illustrative ledger: 7,200
// known-good logic dies at d = 2, 12,500 qualified HBM stacks at h = 4, 4,100
// interposers, 3,800 substrates, assembly for 3,500 packages and final test for
// 3,400. No vendor figure is used. The reader changes the bill of materials (d, h) and scales one input,
// as in the chapter's scenarios (lower HBM yield, delayed substrates,
// final-test saturation), and sees which input binds, how far the bound can
// rise before the next input binds, and how much of every other input is left
// unmatched at the bound.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, text, g } from "./lib/svg.ts";
import { TYPE } from "./lib/theme.ts";
import { wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { int, tpl } from "./lib/format.ts";
import { bottleneckBars, binding } from "./lib/bottleneck.ts";

// The chapter's illustrative ledger.
const LEDGER = { GL: 7200, GH: 12500, GI: 4100, GS: 3800, CA: 3500, CT: 3400, i: 1, s: 1 } as const;

type Input = "logic" | "hbm" | "interposer" | "substrate" | "assembly" | "test";
const INPUTS: Input[] = ["logic", "hbm", "interposer", "substrate", "assembly", "test"];

const labels = {
  en: {
    title: "Supply ledger in package-equivalents",
    logic: "Known-good logic dies",
    hbm: "Qualified HBM stacks",
    interposer: "Good interposers",
    substrate: "Qualified substrates",
    assembly: "Assembly capacity",
    test: "Final-test capacity",
    dLogic: "⌊G_L / d⌋ = ⌊{g} / {d}⌋",
    dHbm: "⌊G_H / h⌋ = ⌊{g} / {h}⌋",
    dInterposer: "⌊G_I / i⌋ = ⌊{g} / 1⌋",
    dSubstrate: "⌊G_S / s⌋ = ⌊{g} / 1⌋",
    dAssembly: "C_A = {g} packages",
    dTest: "C_T = {g} packages",
    bound: "N_ship ≤ {v} packages",
    lgBinding: "binding input",
    lgUsed: "used at the bound",
    lgUnused: "unmatched",
    lgRef: "chapter ledger",
    eq: "N_ship ≤ min({terms}) = {v}",
    gain: "Binding input: {bindLower}. Adding more of it raises the bound by at most {gain} packages, to {next}, where {nextName} binds.",
    tie: "{bind} and {nextName} bind at the same value, so neither alone can raise the bound.",
    unmatched: "Unmatched at the bound: {list}.",
    uLogic: "{n} logic dies",
    uHbm: "{n} HBM stacks",
    uInterposer: "{n} interposers",
    uSubstrate: "{n} substrates",
    uAssembly: "assembly for {n} packages",
    uTest: "test for {n} packages",
    none: "nothing",
    illustrative: "Illustrative ledger from the chapter; no vendor forecast.",
    describe: "Binding input: {bindLower}, so N_ship ≤ {v} packages. The next input to bind is {nextLower}, at {next}, so relieving {bindLower} alone adds at most {gain} packages.",
  },
  zh: {
    title: "按封装等价量计的供给台账",
    logic: "已知良品逻辑裸片",
    hbm: "合格 HBM 堆栈",
    interposer: "良品中介层",
    substrate: "合格封装基板",
    assembly: "装配产能",
    test: "最终测试产能",
    dLogic: "⌊G_L / d⌋ = ⌊{g} / {d}⌋",
    dHbm: "⌊G_H / h⌋ = ⌊{g} / {h}⌋",
    dInterposer: "⌊G_I / i⌋ = ⌊{g} / 1⌋",
    dSubstrate: "⌊G_S / s⌋ = ⌊{g} / 1⌋",
    dAssembly: "C_A = {g} 个封装",
    dTest: "C_T = {g} 个封装",
    bound: "N_ship ≤ {v} 个封装",
    lgBinding: "约束输入",
    lgUsed: "上界内用得上",
    lgUnused: "无法配套",
    lgRef: "本章台账",
    eq: "N_ship ≤ min({terms}) = {v}",
    gain: "{bind}构成约束。只增加这一项，上界最多提高 {gain} 个封装，到 {next} 时改由{nextName}构成约束。",
    tie: "{bind}与{nextName}在同一数值上构成约束，只放宽其中一项无法提高上界。",
    unmatched: "上界处无法配套的部分：{list}。",
    uLogic: "{n} 块逻辑裸片",
    uHbm: "{n} 个 HBM 堆栈",
    uInterposer: "{n} 块中介层",
    uSubstrate: "{n} 块基板",
    uAssembly: "{n} 个封装的装配产能",
    uTest: "{n} 个封装的测试产能",
    none: "无",
    illustrative: "示例台账取自本章，不含任何供应商预测。",
    describe: "{bind}构成约束：N_ship ≤ {v} 个封装。下一个约束是{nextName}，位于 {next}，因此只放宽{bindLower}最多增加 {gain} 个封装。",
  },
};

type P = { d: number; h: number; stress: Input; share: number };

function model(p: P) {
  const k = (x: Input) => (p.stress === x ? p.share / 100 : 1);
  const inv = {
    logic: Math.round(LEDGER.GL * k("logic")),
    hbm: Math.round(LEDGER.GH * k("hbm")),
    interposer: Math.round(LEDGER.GI * k("interposer")),
    substrate: Math.round(LEDGER.GS * k("substrate")),
    assembly: Math.round(LEDGER.CA * k("assembly")),
    test: Math.round(LEDGER.CT * k("test")),
  };
  const pe = (v: typeof inv) => [
    Math.floor(v.logic / p.d), Math.floor(v.hbm / p.h), Math.floor(v.interposer / LEDGER.i),
    Math.floor(v.substrate / LEDGER.s), v.assembly, v.test,
  ];
  const values = pe(inv);
  const refs = pe({ logic: LEDGER.GL, hbm: LEDGER.GH, interposer: LEDGER.GI, substrate: LEDGER.GS, assembly: LEDGER.CA, test: LEDGER.CT });
  const { bind, next } = binding(values);
  const bound = values[bind];
  // What each input holds beyond the bound, in its own unit.
  const per = [p.d, p.h, LEDGER.i, LEDGER.s, 1, 1];
  const natural = [inv.logic, inv.hbm, inv.interposer, inv.substrate, inv.assembly, inv.test];
  const unmatched = natural.map((n, i) => n - bound * per[i]);
  return { inv, values, refs, bind, next, bound, gain: values[next] - bound, unmatched };
}

const nameKey = (i: Input) => i;
const lower = (s: string, lang: Lang) => (lang === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const bi = INPUTS[m.bind], ni = INPUTS[m.next];
  return tpl(L.describe, {
    bind: L[nameKey(bi)], bindLower: lower(L[nameKey(bi)], lang), v: int(m.bound),
    nextName: L[nameKey(ni)], nextLower: lower(L[nameKey(ni)], lang), next: int(m.values[m.next]), gain: int(m.gain),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const fs = TYPE.body;
  const m = model(p);
  const details = [
    tpl(L.dLogic, { g: int(m.inv.logic), d: p.d }),
    tpl(L.dHbm, { g: int(m.inv.hbm), h: p.h }),
    tpl(L.dInterposer, { g: int(m.inv.interposer) }),
    tpl(L.dSubstrate, { g: int(m.inv.substrate) }),
    tpl(L.dAssembly, { g: int(m.inv.assembly) }),
    tpl(L.dTest, { g: int(m.inv.test) }),
  ];
  const bars = bottleneckBars(INPUTS.map((k, i) => ({
    label: L[k], detail: details[i], value: m.values[i],
    ref: p.stress === k ? m.refs[i] : undefined, hit: `stress=${k}`,
  })), {
    x: 0, y: 0, w, fmt: (v) => int(v),
    boundLabel: tpl(L.bound, { v: int(m.bound) }),
    legend: { binding: L.lgBinding, used: L.lgUsed, unused: L.lgUnused, ref: L.lgRef },
    max: Math.max(6000, ...m.values, ...m.refs),
  });

  // Readout: the equation's terms, the headroom to the next binding input,
  // and what is left unmatched in each input's own unit.
  const wrapL = (s: string, size: number, mw: number) => (lang === "zh" ? wrapCjk(s, size, mw) : wrap(s, size, mw));
  const bi = INPUTS[m.bind], ni = INPUTS[m.next];
  const uKeys = ["uLogic", "uHbm", "uInterposer", "uSubstrate", "uAssembly", "uTest"] as const;
  const list = m.unmatched.map((n, i) => ({ n, i })).filter((u) => u.i !== m.bind && u.n > 0)
    .map((u) => tpl(L[uKeys[u.i]], { n: int(u.n) })).join(lang === "zh" ? "、" : ", ");
  const lines: Array<[string, string]> = [
    [tpl(L.eq, { terms: m.values.map(int).join(", "), v: int(m.bound) }), "fig-t-strong fig-t-num"],
    [m.gain > 0
      ? tpl(L.gain, { bind: L[bi], bindLower: lower(L[bi], lang), gain: int(m.gain), next: int(m.values[m.next]), nextName: lower(L[ni], lang) })
      : tpl(L.tie, { bind: L[bi], nextName: lower(L[ni], lang) }), ""],
    [tpl(L.unmatched, { list: list || L.none }), "fig-t-muted"],
    [L.illustrative, "fig-t-muted"],
  ];
  let y = bars.h + 22;
  const ro: string[] = [];
  for (const [s, cls] of lines) {
    for (const ln of wrapL(s, fs, cls.includes("strong") ? w / 1.1 : w)) { ro.push(text(0, y, ln, { "font-size": fs, class: cls || undefined })); y += fs + 6; }
    y += 4;
  }
  return svg(w, y, describe(st, lang), bars.svg, g({ class: "fig-readout" }, ...ro));
}

export default defineFigure({
  name: "supply-ledger",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    d: { kind: "range", label: { en: "Logic dies per package d", zh: "每个封装的逻辑裸片数 d" }, min: 1, max: 4, step: 1, default: 2 },
    h: { kind: "range", label: { en: "HBM stacks per package h", zh: "每个封装的 HBM 堆栈数 h" }, min: 1, max: 12, step: 1, default: 4 },
    stress: {
      kind: "choice", control: "buttons", label: { en: "Input that changes", zh: "变动的输入" }, default: "hbm",
      options: [
        { value: "logic", label: { en: "logic dies", zh: "逻辑裸片" } },
        { value: "hbm", label: { en: "HBM stacks", zh: "HBM 堆栈" } },
        { value: "interposer", label: { en: "interposers", zh: "中介层" } },
        { value: "substrate", label: { en: "substrates", zh: "基板" } },
        { value: "assembly", label: { en: "assembly", zh: "装配" } },
        { value: "test", label: { en: "final test", zh: "最终测试" } },
      ],
    },
    share: {
      kind: "range", label: { en: "Its supply", zh: "该输入的供给" }, unit: { en: "% of the ledger", zh: "%（相对台账）" },
      min: 50, max: 150, step: 5, default: 100,
      marks: [{ value: 100, label: { en: "ledger", zh: "台账" } }],
    },
  },
  render,
  describe,
});
