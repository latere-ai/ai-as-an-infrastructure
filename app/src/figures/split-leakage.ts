// Test-set leakage under three split rules, from the training-practice
// chapter's "Split by the unit that can leak": one seeded corpus of records,
// some of which fall into near-duplicate families (several records that say
// nearly the same thing), with exact copies inside a family. The same test
// share is drawn three ways:
//
//   random rows             each record is assigned on its own
//   exact-duplicate groups  records with the same hash move together, so
//                           exact deduplication holds but near-duplicates can
//                           still straddle the split
//   near-duplicate families the whole family moves as one group
//
// A test record leaks when its family has a member in train. A model that has
// memorized its training set answers a leaked test record correctly with
// probability a_mem and any other record with probability g, its accuracy on
// genuinely unseen groups, so the expected measured test accuracy is
//
//   E[acc] = f_leak · a_mem + (1 − f_leak) · g,
//
// with f_leak the leaked share of the test set. The inflation over unseen data
// is f_leak · (a_mem − g). The corpus, the family sizes, a_mem, and g are
// illustrative; the direction of the effect is the one Lee et al. (2022)
// measured for near-duplicates in language-model data.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { rng, intBetween } from "./lib/random.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- corpus

const N = 300; // records
const TEST_SHARE = 0.2;
type Mode = "rows" | "exact" | "family";
const MODES: Mode[] = ["rows", "exact", "family"];

interface Rec { id: number; family: number; exact: number } // exact: id of the exact-copy group
interface Corpus { recs: Rec[]; families: number[][] } // families in layout order, as record ids

function corpus(dup: number, seed: number): Corpus {
  const u = rng(seed);
  const target = Math.round((dup / 100) * N); // records that belong to a family of two or more
  const sizes: number[] = [];
  let inFam = 0;
  while (inFam < target) {
    const s = Math.min(intBetween(u(), 2, 6), Math.max(2, target - inFam));
    sizes.push(s);
    inFam += s;
  }
  while (inFam + sizes.filter((s) => s === 1).length < N) sizes.push(1);
  // Shuffle family order so singletons and families mix in the layout.
  for (let i = sizes.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [sizes[i], sizes[j]] = [sizes[j], sizes[i]]; }
  const recs: Rec[] = [];
  const families: number[][] = [];
  let exactId = 0;
  sizes.forEach((s, f) => {
    const members: number[] = [];
    for (let k = 0; k < s; k++) {
      // The first member opens an exact group; later members copy the previous
      // record exactly (40%) or are a near-duplicate with a new hash.
      if (k === 0 || u() >= 0.4) exactId++;
      const id = recs.length;
      recs.push({ id, family: f, exact: exactId });
      members.push(id);
    }
    families.push(members);
  });
  return { recs: recs.slice(0, N), families: families.map((m) => m.filter((id) => id < N)).filter((m) => m.length) };
}

// Assign test by shuffling the units of the mode and filling the test share.
function split(c: Corpus, mode: Mode, seed: number): Uint8Array {
  const u = rng(seed * 7919 + (mode === "rows" ? 1 : mode === "exact" ? 2 : 3));
  const key = (r: Rec) => (mode === "rows" ? r.id : mode === "exact" ? r.exact : r.family);
  const units = new Map<number, number[]>();
  for (const r of c.recs) { const k = key(r); units.set(k, [...(units.get(k) ?? []), r.id]); }
  const order = [...units.keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const test = new Uint8Array(c.recs.length);
  const want = Math.round(TEST_SHARE * c.recs.length);
  let n = 0;
  for (const k of order) {
    if (n >= want) break;
    for (const id of units.get(k)!) { test[id] = 1; n++; }
  }
  return test;
}

function stats(c: Corpus, test: Uint8Array) {
  const leaked = new Uint8Array(c.recs.length);
  let nTest = 0, nLeak = 0, pairs = 0, straddle = 0;
  for (const fam of c.families) {
    const tr = fam.filter((id) => !test[id]).length;
    const te = fam.length - tr;
    if (tr && te) { straddle++; pairs += tr * te; }
    for (const id of fam) if (test[id]) { nTest++; if (tr) { leaked[id] = 1; nLeak++; } }
  }
  return { leaked, nTest, nLeak, f: nTest ? nLeak / nTest : 0, pairs, straddle };
}

const memo = new Map<string, { c: Corpus; runs: Record<Mode, { test: Uint8Array } & ReturnType<typeof stats>> }>();
function runs(dup: number, seed: number) {
  const key = `${dup}|${seed}`;
  let hit = memo.get(key);
  if (!hit) {
    const c = corpus(dup, seed);
    const r = {} as Record<Mode, { test: Uint8Array } & ReturnType<typeof stats>>;
    for (const m of MODES) { const test = split(c, m, seed); r[m] = { test, ...stats(c, test) }; }
    hit = { c, runs: r };
    if (memo.size > 32) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

const expected = (f: number, amem: number, gen: number) => f * amem + (1 - f) * gen;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Test-set leakage under row and group splits",
    lgTrain: "train", lgTest: "test", lgLeak: "test record with a near-duplicate in train",
    lgFamily: "near-duplicate family; touching dots are exact copies",
    lgStraddle: "family split across train and test",
    field: "{n} records, {t} drawn into test by {mode}",
    rows: "random rows", exact: "exact-duplicate groups", family: "near-duplicate families",
    score: "Expected measured test accuracy of a model that memorized its training set",
    x: "accuracy",
    gLine: "unseen groups g = {g}",
    r1: "{mode}: {t} test records, {k} with a near-duplicate in train, f_leak = {f}",
    r2: "E[acc] = f_leak · a_mem + (1 − f_leak) · g = {f} × {am} + {f1} × {g} = {e}",
    r3: "The test score overstates accuracy on unseen data by {d} points.",
    r3none: "No test record has a relative in train, so the test score estimates g.",
    r4: "Contamination report: {p} cross-split near-duplicate pairs in {s} families.",
    describe: "{mode}: {k} of {t} test records have a near-duplicate in train, so a memorizing model is expected to score {e} against {g} on unseen groups. Random rows: {er}; exact-duplicate groups: {ee}; near-duplicate families: {ef}.",
  },
  zh: {
    title: "按行划分与按组划分下的测试集泄漏",
    lgTrain: "训练集", lgTest: "测试集", lgLeak: "在训练集中有近似重复项的测试记录",
    lgFamily: "近似重复簇；相互接触的点是完全相同的副本",
    lgStraddle: "同一簇被拆到训练集和测试集",
    field: "{n} 条记录，按{mode}抽出 {t} 条作为测试集",
    rows: "随机行", exact: "完全重复组", family: "近似重复簇",
    score: "记住了训练集的模型，其测试集准确率的期望值",
    x: "准确率",
    gLine: "未见过的组 g = {g}",
    r1: "{mode}：{t} 条测试记录中有 {k} 条在训练集中有近似重复项，f_leak = {f}",
    r2: "E[acc] = f_leak · a_mem + (1 − f_leak) · g = {f} × {am} + {f1} × {g} = {e}",
    r3: "测试分数比模型在未见数据上的准确率高出 {d} 个百分点。",
    r3none: "没有测试记录在训练集中有近似项，测试分数就是对 g 的估计。",
    r4: "污染报告：{s} 个簇中共有 {p} 对跨划分的近似重复记录。",
    describe: "{mode}：{t} 条测试记录中有 {k} 条在训练集中有近似重复项，记住训练集的模型期望得分为 {e}，而在未见过的组上为 {g}。随机行：{er}；完全重复组：{ee}；近似重复簇：{ef}。",
  },
};
type L = typeof labels.en;

type P = { split: Mode; dup: number; gen: number; amem: number; seed: number };

const modeLabel = (L: L, m: Mode) => L[m];
const acc = (v: number) => pct(v, 1);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const { runs: r } = runs(p.dup, p.seed);
  const s = r[p.split];
  const e = (m: Mode) => acc(expected(r[m].f, p.amem, p.gen));
  return tpl(L.describe, {
    mode: modeLabel(L, p.split), k: s.nLeak, t: s.nTest, e: e(p.split), g: acc(p.gen),
    er: e("rows"), ee: e("exact"), ef: e("family"),
  }).replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------- render

function renderField(p: P, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const { c, runs: r } = runs(p.dup, p.seed);
  const s = r[p.split];
  const parts: string[] = [];
  const lg = legend([
    { label: L.lgTrain, swatch: { kind: "dot", fill: C.c1 } },
    { label: L.lgTest, swatch: { kind: "dot", fill: C.c2 } },
    { label: L.lgLeak, swatch: { kind: "rect", fill: C.c2, stroke: C.ink } },
    { label: L.lgStraddle, swatch: { kind: "rect", fill: "none", stroke: C.bad } },
    { label: L.lgFamily, swatch: { kind: "rect", fill: "none", stroke: C.ink3 } },
  ], 0, y0, w, fs);
  parts.push(lg.svg);
  let y = y0 + lg.height + 6;
  for (const ln of wrap(tpl(L.field, { n: int(c.recs.length), t: s.nTest, mode: modeLabel(L, p.split) }), TYPE.label, w - TYPE.label)) {
    parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 18;
  }
  y += 4;

  const d = narrow ? 7 : 8;
  const rad = d / 2;
  const pad = 3;
  const rowH = d + 2 * pad + 5;
  const unitGap = narrow ? 4 : 5;
  let x = 0, row = 0;
  for (const fam of c.families) {
    // Exact copies touch; a near-duplicate starts a little apart.
    const steps: number[] = [];
    for (let k = 1; k < fam.length; k++) steps.push(c.recs[fam[k]].exact === c.recs[fam[k - 1]].exact ? d - 1.5 : d + 2);
    const inner = d + steps.reduce((a, b) => a + b, 0);
    const width = fam.length > 1 ? inner + 2 * pad : d;
    if (x > 0 && x + width > w) { x = 0; row++; }
    const cy = y + row * rowH + rowH / 2;
    const multi = fam.length > 1;
    if (multi) {
      const straddles = fam.some((id) => s.test[id]) && fam.some((id) => !s.test[id]);
      parts.push(el("rect", { x, y: cy - rad - pad, width, height: d + 2 * pad, rx: rad + pad, fill: "none", stroke: straddles ? C.bad : C.ink3, "stroke-width": straddles ? 1.6 : 1 }));
    }
    let cx = x + (multi ? pad : 0) + rad;
    fam.forEach((id, k) => {
      if (k > 0) cx += steps[k - 1];
      const isTest = s.test[id] === 1;
      parts.push(el("circle", { cx, cy, r: rad, fill: isTest ? C.c2 : C.c1, stroke: s.leaked[id] ? C.ink : C.paper, "stroke-width": s.leaked[id] ? 1.8 : 0.8 }));
    });
    x += width + unitGap;
  }
  y += (row + 1) * rowH;
  return { svg: g({ class: "fig-field" }, ...parts), h: y - y0 };
}

function renderScores(p: P, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const { runs: r } = runs(p.dup, p.seed);
  const parts: string[] = [];
  const title = wrap(L.score, TYPE.label, w - 4);
  title.forEach((ln, i) => parts.push(text(0, y0 + 14 + i * 18, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  const labelW = Math.max(...MODES.map((m) => textWidth(modeLabel(L, m), fs))) + 12;
  const top = y0 + 14 + (title.length - 1) * 18 + 36;
  const rowH = 24;
  const x = linear([0.4, 1], [labelW + 6, w - 44]);
  const bottom = top + MODES.length * rowH;
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top - 12, bottom], title: L.x, size: fs, ticks: narrow ? [0.4, 0.6, 0.8, 1] : [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], format: (v) => pct(v) }));
  const gx = x(p.gen);
  parts.push(el("line", { x1: gx, x2: gx, y1: top - 12, y2: bottom, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  const gl = tpl(L.gLine, { g: acc(p.gen) });
  const glw = textWidth(gl, fs);
  parts.push(text(Math.min(Math.max(gx, labelW + glw / 2), w - glw / 2), top - 17, gl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  MODES.forEach((m, i) => {
    const cy = top + i * rowH + rowH / 2;
    const e = expected(r[m].f, p.amem, p.gen);
    const on = m === p.split;
    if (on) parts.push(el("rect", { x: 0, y: cy - rowH / 2 + 1, width: w, height: rowH - 2, rx: 3, fill: C.panel }));
    parts.push(text(0, cy + fs * 0.35, modeLabel(L, m), { "font-size": fs, class: on ? "fig-t-strong" : undefined }));
    parts.push(el("line", { x1: gx, x2: x(e), y1: cy, y2: cy, stroke: C.c2, "stroke-width": 4, "stroke-linecap": "round" }));
    parts.push(el("circle", { cx: x(e), cy, r: 5.5, fill: C.c2, stroke: C.paper, "stroke-width": 1.5 }));
    parts.push(text(w, cy + fs * 0.35, acc(e), { "font-size": fs, "text-anchor": "end", class: on ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    parts.push(el("rect", { x: 0, y: cy - rowH / 2, width: w, height: rowH, fill: "transparent", "data-fig-set": `split=${m}`, class: "fig-hit" }));
  });
  return { svg: g({ class: "fig-scores" }, ...parts), h: bottom + axisHeight(true, fs) - y0 };
}

function renderReadout(p: P, w: number, L: L, y0: number): { svg: string; h: number } {
  const fs = TYPE.body;
  const { runs: r } = runs(p.dup, p.seed);
  const s = r[p.split];
  const e = expected(s.f, p.amem, p.gen);
  const lines: Array<[string, string | undefined]> = [
    [tpl(L.r1, { mode: modeLabel(L, p.split), t: s.nTest, k: s.nLeak, f: fixed(s.f, 2) }).replace(/^./, (ch) => ch.toUpperCase()), "fig-t-num"],
    [tpl(L.r2, { f: fixed(s.f, 2), am: fixed(p.amem, 2), f1: fixed(1 - s.f, 2), g: fixed(p.gen, 2), e: fixed(e, 3) }), "fig-t-num"],
    [s.nLeak ? tpl(L.r3, { d: fixed((e - p.gen) * 100, 1) }) : L.r3none, "fig-t-strong"],
    [tpl(L.r4, { p: s.pairs, s: s.straddle }), undefined],
  ];
  const parts: string[] = [];
  let y = y0;
  for (const [str, cls] of lines) {
    for (const piece of wrap(str, fs, w - fs)) {
      y += fs + 5;
      parts.push(text(0, y, piece, { "font-size": fs, class: cls }));
    }
    y += 3;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const field = renderField(p, w, L, 0);
  let y = field.h + 14;
  const scores = renderScores(p, w, L, y);
  y += scores.h + 4;
  const ro = renderReadout(p, w, L, y);
  y += ro.h;
  return svg(w, y, describe(st, lang), field.svg, scores.svg, ro.svg);
}

export default defineFigure({
  name: "split-leakage",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    split: {
      kind: "choice", label: { en: "Split by", zh: "划分单位" }, default: "rows",
      options: [
        { value: "rows", label: { en: "Random rows", zh: "随机行" } },
        { value: "exact", label: { en: "Exact-duplicate groups", zh: "完全重复组" } },
        { value: "family", label: { en: "Near-duplicate families", zh: "近似重复簇" } },
      ],
    },
    dup: {
      kind: "range", label: { en: "Records inside a near-duplicate family", zh: "属于近似重复簇的记录占比" }, unit: { en: "%", zh: "%" },
      min: 10, max: 70, step: 5, default: 40,
    },
    gen: {
      kind: "range", label: { en: "Accuracy on unseen groups g", zh: "未见过的组上的准确率 g" },
      min: 0.4, max: 0.9, step: 0.01, default: 0.7,
    },
    amem: { kind: "range", label: { en: "Accuracy with a trained near-duplicate a_mem", zh: "训练过近似重复项时的准确率 a_mem" }, min: 0.5, max: 1, step: 0.01, default: 0.95, control: false },
    seed: { kind: "range", label: { en: "Corpus seed", zh: "语料种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
