// One generated answer scored claim by claim: the factuality chapter's claim
// records drawn as a claim × evidence-span matrix, with the chapter's three
// metrics computed from the cells.
//
//   F_K(y)   = (1/m) Σ_i 1[S(c_i, K) = 1]              over the m checkable claims
//   C_cite   = Σ_i w_i Q(A_i, c_i) / Σ_i w_i           over the claims I that need support
//   P_link   = Σ_(i,j)∈L q_ij / |L|                     over the attached citation links
//
// The example is illustrative: a fictional trial (ORCA-2), a fictional
// manufacturer, one answer, and six evidence spans in three documents. Every
// relation between a claim and a span is an adjudicated label written below;
// every verdict and metric is derived from those labels by the rules in
// `verdict`, `citeQ` and `metrics`, so the three extraction policies and the
// two evidence boundaries are scored by the same code.
//
// Verdict rule (the chapter's four statuses). A claim that is not
// check-worthy is "not checkable" and leaves both m and I. Otherwise, within
// the evidence boundary: any contradicting span makes it contradicted (the
// only contradicting span is in the trial report, the authority, so it
// outranks the press release); else any supporting span makes it supported;
// else the evidence is insufficient.
//
// Citation rule. Q(A_i, c_i) = 1 when the cited spans jointly support every
// part of the claim and none contradicts it. q_ij = 1 when cited span j
// supports claim i or one of its parts. Splitting a claim divides its declared
// weight among the parts, so the weighted C_cite does not depend on the
// extraction policy while the unweighted F_K and the per-link P_link do.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { legend } from "./lib/legend.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- example

type Doc = "D1" | "D2" | "D3";
interface Span { id: string; doc: Doc; text: { en: string; zh: string } }

export const SPANS: Span[] = [
  { id: "D1·1", doc: "D1", text: { en: "ORCA-2 randomized 400 adults with heart failure to the drug or placebo.", zh: "ORCA-2 将 400 名心力衰竭成人患者随机分入用药组或安慰剂组。" } },
  { id: "D1·2", doc: "D1", text: { en: "Mortality at 90 days was 11.2% with the drug and 13.7% with placebo, a relative reduction of 18%.", zh: "90 天死亡率用药组为 11.2%，安慰剂组为 13.7%，相对降低 18%。" } },
  { id: "D1·3", doc: "D1", text: { en: "The steering committee designed the trial and analyzed the data.", zh: "试验由指导委员会设计，数据也由其分析。" } },
  { id: "D1·4", doc: "D1", text: { en: "Funding: Nordal Pharma, the manufacturer of the drug.", zh: "资助方：该药的生产商 Nordal Pharma。" } },
  { id: "D2·1", doc: "D2", text: { en: "The drug cut deaths by nearly a third.", zh: "该药让死亡人数减少近三分之一。" } },
  { id: "D3·1", doc: "D3", text: { en: "Results first posted: March 2021.", zh: "结果首次公布：2021 年 3 月。" } },
];
const SPAN = new Map(SPANS.map((s) => [s.id, s]));
const DOCS: Doc[] = ["D1", "D2", "D3"];

export type Topic = "enroll" | "mortality" | "year" | "funding" | "remark";
export const TOPICS: Topic[] = ["enroll", "mortality", "year", "funding", "remark"];

// The answer under test, one segment per topic, in reading order.
const ANSWER: Record<Lang, Array<[Topic, string]>> = {
  en: [
    ["enroll", "ORCA-2 enrolled 400 adults [D1·1]"],
    ["mortality", "and reduced 90-day mortality by 30% [D2·1]."],
    ["year", "Results were published in 2021."],
    ["funding", "The trial was funded by the manufacturer [D1·3]."],
    ["remark", "It is a promising option for patients."],
  ],
  zh: [
    ["enroll", "ORCA-2 招募了 400 名成人患者 [D1·1]，"],
    ["mortality", "并使 90 天死亡率降低 30% [D2·1]。"],
    ["year", "结果于 2021 年发表。"],
    ["funding", "该试验由生产商资助 [D1·3]。"],
    ["remark", "对患者而言，这是一种有前景的选择。"],
  ],
};

type Rel = "S" | "X"; // the span supports / contradicts the claim (or the given part)
interface Link { span: string; rel: Rel; part?: number }
export interface Claim {
  id: string;
  topic: Topic;
  short: { en: string; zh: string };
  full: { en: string; zh: string };
  checkable: boolean;
  parts: number; // independently checkable parts (a conjunction has two)
  weight: number; // declared importance w_i
  cites: string[]; // spans the answer attached to this claim
  rel: Link[]; // adjudicated relations to spans
}

const t2 = (en: string, zh: string) => ({ en, zh });

const ENROLL: Claim = { id: "c1", topic: "enroll", short: t2("enrolled 400 adults", "招募 400 名成人"), full: t2("ORCA-2 enrolled 400 adults.", "ORCA-2 招募了 400 名成人患者。"), checkable: true, parts: 1, weight: 1, cites: ["D1·1"], rel: [{ span: "D1·1", rel: "S" }] };
const MORTALITY: Claim = { id: "c2", topic: "mortality", short: t2("cut 90-day mortality 30%", "90 天死亡率降 30%"), full: t2("ORCA-2 reduced 90-day mortality by 30%.", "ORCA-2 使 90 天死亡率降低 30%。"), checkable: true, parts: 1, weight: 3, cites: ["D2·1"], rel: [{ span: "D1·2", rel: "X" }, { span: "D2·1", rel: "S" }] };
const YEAR: Claim = { id: "c3", topic: "year", short: t2("published in 2021", "2021 年发表"), full: t2("The results were published in 2021.", "结果于 2021 年发表。"), checkable: true, parts: 1, weight: 1, cites: [], rel: [{ span: "D3·1", rel: "S" }] };
const FUNDING: Claim = { id: "c4", topic: "funding", short: t2("funded by manufacturer", "由生产商资助"), full: t2("The trial was funded by the drug's manufacturer.", "该试验由药物生产商资助。"), checkable: true, parts: 1, weight: 2, cites: ["D1·3"], rel: [{ span: "D1·4", rel: "S" }] };
const REMARK: Claim = { id: "c5", topic: "remark", short: t2("promising option", "有前景的选择"), full: t2("It is a promising option for patients.", "对患者而言，这是一种有前景的选择。"), checkable: false, parts: 1, weight: 0, cites: [], rel: [] };

export type Split = "sentence" | "atomic" | "fine";

// The claims each extraction policy produces from the same answer.
export const CLAIMS: Record<Split, Claim[]> = {
  sentence: [
    {
      id: "c1", topic: "enroll", short: t2("enrolled 400, cut mortality 30%", "招募 400 人，死亡率降 30%"),
      full: t2("ORCA-2 enrolled 400 adults and reduced 90-day mortality by 30%.", "ORCA-2 招募了 400 名成人患者，并使 90 天死亡率降低 30%。"),
      checkable: true, parts: 2, weight: 4, cites: ["D1·1", "D2·1"],
      rel: [{ span: "D1·1", rel: "S", part: 0 }, { span: "D1·2", rel: "X", part: 1 }, { span: "D2·1", rel: "S", part: 1 }],
    },
    { ...YEAR, id: "c2" },
    { ...FUNDING, id: "c3" },
    { ...REMARK, id: "c4" },
  ],
  atomic: [ENROLL, MORTALITY, YEAR, FUNDING, REMARK],
  fine: [
    { ...ENROLL, id: "c1", short: t2("a randomized trial", "是随机试验"), full: t2("ORCA-2 was a randomized trial.", "ORCA-2 是一项随机试验。"), weight: 1 / 3 },
    { ...ENROLL, id: "c2", short: t2("enrolled adults", "招募成人"), full: t2("ORCA-2 enrolled adults.", "ORCA-2 招募的是成人患者。"), weight: 1 / 3 },
    { ...ENROLL, id: "c3", short: t2("enrollment was 400", "入组 400 人"), full: t2("Enrollment was 400.", "入组人数为 400。"), weight: 1 / 3 },
    { ...MORTALITY, id: "c4", short: t2("cut 90-day mortality", "降低 90 天死亡率"), full: t2("ORCA-2 reduced 90-day mortality.", "ORCA-2 降低了 90 天死亡率。"), weight: 1.5, rel: [{ span: "D1·2", rel: "S" }, { span: "D2·1", rel: "S" }] },
    { ...MORTALITY, id: "c5", short: t2("the cut was 30%", "降幅为 30%"), full: t2("The reduction in 90-day mortality was 30%.", "90 天死亡率的降幅为 30%。"), weight: 1.5 },
    { ...YEAR, id: "c6" },
    { ...FUNDING, id: "c7" },
    { ...REMARK, id: "c8" },
  ],
};

export type Boundary = "context" | "search";
// Documents inside each evidence boundary: the supplied context holds the
// trial report and the press release; bounded search also reaches the registry.
const INSIDE: Record<Boundary, Set<Doc>> = { context: new Set(["D1", "D2"]), search: new Set(["D1", "D2", "D3"]) };

export type Verdict = "supported" | "contradicted" | "insufficient" | "unchecked";

export function verdict(c: Claim, b: Boundary): Verdict {
  if (!c.checkable) return "unchecked";
  const inside = c.rel.filter((r) => INSIDE[b].has(SPAN.get(r.span)!.doc));
  if (inside.some((r) => r.rel === "X")) return "contradicted";
  if (inside.some((r) => r.rel === "S")) return "supported";
  return "insufficient";
}

const relOf = (c: Claim, span: string) => c.rel.filter((r) => r.span === span);

// q_ij for one attached link.
export function linkQ(c: Claim, span: string): number {
  return relOf(c, span).some((r) => r.rel === "S") ? 1 : 0;
}

// Q(A_i, c_i): the cited spans support every part and none contradicts.
export function citeQ(c: Claim): number {
  if (!c.cites.length) return 0;
  const cited = c.rel.filter((r) => c.cites.includes(r.span));
  if (cited.some((r) => r.rel === "X")) return 0;
  for (let k = 0; k < c.parts; k++) {
    if (!cited.some((r) => r.rel === "S" && (r.part == null || r.part === k))) return 0;
  }
  return 1;
}

export function metrics(split: Split, b: Boundary) {
  const claims = CLAIMS[split];
  const checked = claims.filter((c) => c.checkable);
  const v = checked.map((c) => verdict(c, b));
  const m = checked.length;
  const count = (k: Verdict) => v.filter((x) => x === k).length;
  const wSum = checked.reduce((a, c) => a + c.weight, 0);
  const wq = checked.reduce((a, c) => a + c.weight * citeQ(c), 0);
  const links = checked.flatMap((c) => c.cites.map((s) => linkQ(c, s)));
  return {
    m, excluded: claims.length - m,
    supported: count("supported"), contradicted: count("contradicted"), insufficient: count("insufficient"),
    F: m ? count("supported") / m : NaN,
    wSum, wq, cite: wSum ? wq / wSum : NaN,
    links, link: links.length ? links.reduce((a, x) => a + x, 0) / links.length : NaN,
  };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Claims checked against evidence spans",
    answer: "Answer under test",
    matrix: "Claim records",
    colVerdict: "verdict",
    colW: "w",
    colQ: "Q",
    docKey1: "D1 trial report, the authority",
    docKey2: "D2 press release",
    docKey3: "D3 trial registry",
    lgS: "span supports",
    lgP: "supports one part",
    lgX: "span contradicts",
    lgCited: "cited in the answer",
    lgOut: "outside the boundary",
    supported: "supported",
    contradicted: "contradicted",
    insufficient: "insufficient evidence",
    unchecked: "not checkable",
    metrics: "Metrics from these records",
    fTerms: "supported / m = {a} / {b}",
    citeTerms: "Σ w·Q / Σ w = {a} / {b}",
    linkTerms: "Σ q / |L| = {a} / {b}",
    counts: "contradicted {x}, insufficient evidence {i}",
    excluded: "not checkable {u}, left out of m and I",
    detail: "Selected: {topic}",
    whyS: "supported by {spans}",
    whyX: "contradicted by {spans}",
    whyOut: "insufficient evidence: {spans} lies outside the boundary",
    whyNone: "insufficient evidence: nothing in the boundary bears on it",
    whyU: "not checkable: an evaluative remark, outside m and I",
    citeYes: "cites {spans}, Q = {q}",
    citeNone: "no citation, Q = 0",
    badLink: "q = 0: {span} does not support it",
    relS: "supports",
    relP: "supports part",
    relX: "contradicts",
    relCited: "cited, does not support",
    relOut: "outside the boundary",
    D1: "trial report",
    D2: "press release",
    D3: "trial registry",
    enroll: "enrollment",
    mortality: "mortality result",
    year: "publication year",
    funding: "funding",
    remark: "evaluative remark",
    sentence: "one claim per sentence",
    atomic: "atomic claims",
    fine: "over-split claims",
    context: "supplied context",
    search: "bounded search",
    describe: "{policy}, {boundary}: {m} checkable claims, F_K = {f}, C_cite = {c}, P_link = {l}. {topic}: {why}.",
  },
  zh: {
    title: "逐条对照证据片段核查主张",
    answer: "受测回答",
    matrix: "主张记录",
    colVerdict: "裁定",
    colW: "w",
    colQ: "Q",
    docKey1: "D1 试验报告（权威来源）",
    docKey2: "D2 新闻稿",
    docKey3: "D3 试验登记库",
    lgS: "片段支持",
    lgP: "只支持一部分",
    lgX: "片段反驳",
    lgCited: "回答引用了该片段",
    lgOut: "在证据边界之外",
    supported: "支持",
    contradicted: "被反驳",
    insufficient: "证据不足",
    unchecked: "不可核查",
    metrics: "由这些记录算出的指标",
    fTerms: "支持数 / m = {a} / {b}",
    citeTerms: "Σ w·Q / Σ w = {a} / {b}",
    linkTerms: "Σ q / |L| = {a} / {b}",
    counts: "被反驳 {x} 条，证据不足 {i} 条",
    excluded: "不可核查 {u} 条，不计入 m 和 I",
    detail: "当前选中：{topic}",
    whyS: "{spans} 支持",
    whyX: "被 {spans} 反驳",
    whyOut: "证据不足：{spans} 在证据边界之外",
    whyNone: "证据不足：边界内没有相关片段",
    whyU: "不可核查：属于评价性说法，不计入 m 和 I",
    citeYes: "引用 {spans}，Q = {q}",
    citeNone: "没有引用，Q = 0",
    badLink: "q = 0：{span} 并不支持这条主张",
    relS: "支持",
    relP: "支持一部分",
    relX: "反驳",
    relCited: "被引用，但不支持",
    relOut: "在边界之外",
    D1: "试验报告",
    D2: "新闻稿",
    D3: "试验登记库",
    enroll: "入组人数",
    mortality: "死亡率结果",
    year: "发表年份",
    funding: "资助方",
    remark: "评价性说法",
    sentence: "每句一条主张",
    atomic: "原子主张",
    fine: "过度拆分",
    context: "给定上下文",
    search: "有界搜索",
    describe: "{policy}，{boundary}：可核查主张 {m} 条，F_K = {f}，C_cite = {c}，P_link = {l}。{topic}：{why}。",
  },
};
type L = typeof labels.en;

type P = { split: Split; boundary: Boundary; focus: Topic };

const STATUS: Record<Verdict, string> = { supported: C.good, contradicted: C.bad, insufficient: C.warn, unchecked: C.ink3 };
const SEP: Record<Lang, string> = { en: ", ", zh: "、" };

const fmt = (v: number) => (Number.isFinite(v) ? fixed(v, 2) : "–");
// Weights and weighted sums as the readout prints them: 1/3 → 0.33, 4 → 4.
const num = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : fixed(v, 2));

function why(c: Claim, b: Boundary, L: L, lang: Lang): string {
  const v = verdict(c, b);
  const inside = (r: Link) => INSIDE[b].has(SPAN.get(r.span)!.doc);
  const ids = (rs: Link[]) => [...new Set(rs.map((r) => r.span))].join(SEP[lang]);
  if (v === "unchecked") return L.whyU;
  if (v === "contradicted") return tpl(L.whyX, { spans: ids(c.rel.filter((r) => r.rel === "X" && inside(r))) });
  if (v === "supported") return tpl(L.whyS, { spans: ids(c.rel.filter((r) => r.rel === "S" && inside(r))) });
  const out = c.rel.filter((r) => !inside(r));
  return out.length ? tpl(L.whyOut, { spans: ids(out) }) : L.whyNone;
}

function citeLine(c: Claim, L: L, lang: Lang): string[] {
  if (!c.checkable) return [];
  if (!c.cites.length) return [L.citeNone];
  const out = [tpl(L.citeYes, { spans: c.cites.join(SEP[lang]), q: citeQ(c) })];
  for (const s of c.cites) if (!linkQ(c, s)) out.push(tpl(L.badLink, { span: s }));
  return out;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = metrics(p.split, p.boundary);
  const focus = CLAIMS[p.split].filter((c) => c.topic === p.focus);
  return tpl(L.describe, {
    policy: L[p.split], boundary: L[p.boundary], m: m.m, f: fmt(m.F), c: fmt(m.cite), l: fmt(m.link),
    topic: L[p.focus], why: focus.map((c) => why(c, p.boundary, L, lang)).join(lang === "zh" ? "；" : "; "),
  }).replace(/^./, (ch) => ch.toUpperCase());
}

// ---------------------------------------------------------------- render

// Text that keeps a class per segment across line breaks (the answer with the
// selected claim in bold). Breaks at spaces and between CJK glyphs, and never
// starts a line with closing punctuation.
interface Seg { s: string; cls: string }
const NO_START = /^[，。、；：？！）」』》%,.;:)]/u;
function richWrap(segs: Seg[], size: number, maxW: number): Seg[][] {
  const units: Seg[] = [];
  for (const sg of segs) {
    let word = "";
    for (const ch of sg.s) {
      if (ch.codePointAt(0)! >= 0x2e80 || ch === " ") {
        if (word) units.push({ s: word, cls: sg.cls });
        word = "";
        units.push({ s: ch, cls: sg.cls });
      } else word += ch;
    }
    if (word) units.push({ s: word, cls: sg.cls });
  }
  const lines: Seg[][] = [];
  let line: Seg[] = [], lw = 0;
  for (const u of units) {
    const uw = textWidth(u.s, size);
    if (line.length && lw + uw > maxW && u.s !== " " && !NO_START.test(u.s)) {
      while (line.length && line[line.length - 1].s === " ") line.pop();
      lines.push(line);
      line = [];
      lw = 0;
    }
    if (!line.length && u.s === " ") continue;
    line.push(u);
    lw += uw;
  }
  if (line.length) lines.push(line);
  return lines.map((ln) => ln.reduce<Seg[]>((acc, u) => {
    const last = acc[acc.length - 1];
    if (last && last.cls === u.cls) last.s += u.s; else acc.push({ ...u });
    return acc;
  }, []));
}
const richLine = (x: number, y: number, segs: Seg[], size: number) =>
  el("text", { x, y, "font-size": size }, ...segs.map((sg) => el("tspan", { class: sg.cls || undefined }, esc(sg.s))));

const wrapL = (lang: Lang, s: string, size: number, w: number) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const quote = (lang: Lang, s: string) => (lang === "zh" ? `「${s}」` : `“${s}”`);

// A metric name with a subscript: F_K(y), C_cite, P_link.
function mathName(x: number, y: number, base: string, sub: string, rest = ""): string {
  return el("text", { x, y, "font-size": TYPE.title, class: "fig-t-strong" },
    esc(base), el("tspan", { dy: 4, "font-size": TYPE.body }, esc(sub)), rest ? el("tspan", { dy: -4 }, esc(rest)) : "");
}

// Check and cross marks drawn in the paper color on a filled cell, so the
// relation reads by shape as well as by color.
function glyph(x: number, y: number, s: number, kind: Rel): string {
  const d = kind === "S"
    ? `M${x + s * 0.27},${y + s * 0.53}L${x + s * 0.44},${y + s * 0.7}L${x + s * 0.74},${y + s * 0.33}`
    : `M${x + s * 0.3},${y + s * 0.3}L${x + s * 0.7},${y + s * 0.7}M${x + s * 0.7},${y + s * 0.3}L${x + s * 0.3},${y + s * 0.7}`;
  return el("path", { d, fill: "none", stroke: C.paper, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
}

function marker(x: number, y: number, v: Verdict): string {
  return el("rect", { x, y: y - 9, width: 10, height: 10, rx: 2, fill: STATUS[v] });
}

function renderMatrix(p: P, w: number, y0: number, L: L, lang: Lang, uid: string): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = TYPE.body;
  const claims = CLAIMS[p.split];
  const inside = INSIDE[p.boundary];
  const parts: string[] = [];
  const cell = narrow ? 24 : 28;
  const gap = 3, docGap = 9;
  const cols: Array<{ span: Span; x: number }> = [];
  let cx = 0;
  SPANS.forEach((s, j) => {
    if (j && s.doc !== SPANS[j - 1].doc) cx += docGap - gap;
    cols.push({ span: s, x: cx });
    cx += cell + gap;
  });
  const cellsW = cx - gap;
  const vW = Math.max(...(["supported", "contradicted", "insufficient", "unchecked"] as const).map((k) => textWidth(L[k], fs))) + 16;
  const numW = 30;
  const rightW = narrow ? 0 : 14 + vW + 2 * numW;
  const pad = narrow ? 8 : 14;
  const inset = 7; // labels clear the outline of the selected row
  const labelW = w - cellsW - rightW - pad - inset - 5;
  const x0 = inset + labelW + pad;
  const xv = x0 + cellsW + 14;

  // Headers: document groups, then span numbers.
  let y = y0 + 14;
  parts.push(text(0, y, L.matrix, { "font-size": TYPE.label, class: "fig-t-strong" }));
  for (const d of DOCS) {
    const cs = cols.filter((c) => c.span.doc === d);
    const mid = x0 + (cs[0].x + cs[cs.length - 1].x + cell) / 2;
    parts.push(text(mid, y, d, { "font-size": fs, "text-anchor": "middle", class: inside.has(d) ? "fig-t-strong" : "fig-t-faint" }));
  }
  y += 18;
  for (const c of cols) {
    parts.push(text(x0 + c.x + cell / 2, y, c.span.id.split("·")[1], { "font-size": fs, "text-anchor": "middle", class: `fig-t-num ${inside.has(c.span.doc) ? "fig-t-muted" : "fig-t-faint"}` }));
  }
  if (!narrow) {
    parts.push(text(xv, y, L.colVerdict, { "font-size": fs, class: "fig-t-muted" }));
    parts.push(text(xv + vW + numW - 4, y, L.colW, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(xv + vW + 2 * numW - 4, y, L.colQ, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  }
  y += 8;

  // Rows.
  const top = y;
  const focusBox: number[] = [];
  for (const c of claims) {
    const v = verdict(c, p.boundary);
    const lab = wrapL(lang, `${c.id}  ${c.short[lang]}`, fs, labelW);
    const lines = lab.length + (narrow ? 1 : 0);
    const rh = Math.max(cell + 8, lines * 16 + 8);
    const cy = y + (rh - cell) / 2;
    const cls = c.checkable ? "" : "fig-t-muted";
    const ly = y + (rh - lines * 16) / 2 + 12;
    lab.forEach((ln, k) => parts.push(text(inset, ly + k * 16, ln, { "font-size": fs, class: cls || undefined })));
    if (narrow) {
      const vy = ly + lab.length * 16;
      parts.push(marker(inset, vy, v), text(inset + 15, vy, L[v], { "font-size": fs, class: "fig-t-muted" }));
    }
    for (const col of cols) {
      const xx = x0 + col.x;
      const out = !inside.has(col.span.doc);
      const rs = relOf(c, col.span.id);
      const X = rs.some((r) => r.rel === "X");
      const S = rs.some((r) => r.rel === "S");
      const partial = !X && S && c.parts > 1;
      parts.push(el("rect", { x: xx, y: cy, width: cell, height: cell, rx: 3, fill: C.panel }));
      if (X || S) {
        const op = out ? 0.35 : 1;
        if (partial) parts.push(el("rect", { x: xx, y: cy, width: cell, height: cell, rx: 3, fill: `url(#${uid}-part)`, opacity: op }));
        else {
          parts.push(el("rect", { x: xx, y: cy, width: cell, height: cell, rx: 3, fill: X ? C.bad : C.good, opacity: op }));
          parts.push(glyph(xx, cy, cell, X ? "X" : "S"));
        }
      }
      if (out) parts.push(el("rect", { x: xx, y: cy, width: cell, height: cell, rx: 3, fill: `url(#${uid}-out)` }));
      if (c.cites.includes(col.span.id)) parts.push(el("rect", { x: xx - 2.5, y: cy - 2.5, width: cell + 5, height: cell + 5, rx: 5, fill: "none", stroke: C.ink, "stroke-width": 2 }));
    }
    if (!narrow) {
      const by = y + rh / 2 + 4;
      parts.push(marker(xv, by, v), text(xv + 15, by, L[v], { "font-size": fs }));
      parts.push(text(xv + vW + numW - 4, by, c.checkable ? num(c.weight) : "–", { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
      parts.push(text(xv + vW + 2 * numW - 4, by, c.checkable ? String(citeQ(c)) : "–", { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
    }
    if (c.topic === p.focus) focusBox.push(y, y + rh);
    parts.push(el("rect", { x: 0, y, width: w, height: rh, fill: "transparent", "data-fig-set": `focus=${c.topic}`, class: "fig-hit" }));
    y += rh;
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  }
  if (focusBox.length) {
    const fy0 = Math.min(...focusBox), fy1 = Math.max(...focusBox);
    parts.push(el("rect", { x: 0.75, y: fy0 + 0.75, width: w - 1.5, height: fy1 - fy0 - 1.5, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.5, "pointer-events": "none" }));
  }
  parts.unshift(el("line", { x1: 0, x2: w, y1: top, y2: top, stroke: C.grid, "stroke-width": 1 }));

  // Legend and the document key.
  y += 10;
  const items = [
    { label: L.lgS, swatch: { kind: "rect" as const, fill: C.good } },
    ...(p.split === "sentence" ? [{ label: L.lgP, swatch: { kind: "rect" as const, fill: C.good, pattern: `${uid}-part` } }] : []),
    { label: L.lgX, swatch: { kind: "rect" as const, fill: C.bad } },
    { label: L.lgCited, swatch: { kind: "rect" as const, fill: "none", stroke: C.ink } },
    ...(p.boundary === "context" ? [{ label: L.lgOut, swatch: { kind: "rect" as const, fill: C.panel, pattern: `${uid}-out` } }] : []),
  ];
  const lg = legend(items, 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height + 4;
  // The document key breaks only between documents.
  const sep = "  ·  ";
  let line = "";
  const keyLines: string[] = [];
  for (const item of [L.docKey1, L.docKey2, L.docKey3]) {
    if (line && textWidth(line + sep + item, fs) > w) { keyLines.push(line); line = item; } else line = line ? line + sep + item : item;
  }
  keyLines.push(line);
  for (const ln of keyLines) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  return { svg: g({ class: "fig-matrix" }, ...parts), h: y - y0 };
}

function renderMetrics(p: P, x0: number, y0: number, bw: number, L: L, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const m = metrics(p.split, p.boundary);
  const parts: string[] = [text(x0, y0 + 14, L.metrics, { "font-size": TYPE.label, class: "fig-t-strong" })];
  let y = y0 + 22;
  const rows: Array<[string, string, string, number, string]> = [
    ["F", "K", "(y)", m.F, tpl(L.fTerms, { a: m.supported, b: m.m })],
    ["C", "cite", "", m.cite, tpl(L.citeTerms, { a: num(m.wq), b: num(m.wSum) })],
    ["P", "link", "", m.link, tpl(L.linkTerms, { a: m.links.reduce((a, b) => a + b, 0), b: m.links.length })],
  ];
  const nameW = 58, valW = 34;
  const barX = x0 + nameW, barW = bw - nameW - valW - 6;
  for (const [base, sub, rest, v, terms] of rows) {
    y += 16;
    parts.push(mathName(x0, y, base, sub, rest));
    parts.push(el("rect", { x: barX, y: y - 11, width: barW, height: 12, rx: 3, fill: C.panel }));
    if (v > 0) parts.push(el("rect", { x: barX, y: y - 11, width: Math.max(2, v * barW), height: 12, rx: 3, fill: C.c1 }));
    parts.push(text(x0 + bw, y, fmt(v), { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
    y += 17;
    parts.push(text(barX, y, terms, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    y += 6;
  }
  y += 8;
  for (const s of [tpl(L.counts, { x: m.contradicted, i: m.insufficient }), tpl(L.excluded, { u: m.excluded })]) {
    for (const ln of wrapL(lang, s, fs, bw)) {
      y += 16;
      parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" }));
    }
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function renderDetail(p: P, x0: number, y0: number, bw: number, L: L, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const claims = CLAIMS[p.split].filter((c) => c.topic === p.focus);
  const inside = INSIDE[p.boundary];
  const parts: string[] = [text(x0, y0 + 14, tpl(L.detail, { topic: L[p.focus] }), { "font-size": TYPE.label, class: "fig-t-strong" })];
  let y = y0 + 16;
  const put = (s: string, cls: string, indent = 0) => {
    for (const ln of wrapL(lang, s, fs, bw - indent)) { y += 16; parts.push(text(x0 + indent, y, ln, { "font-size": fs, class: cls || undefined })); }
  };
  for (const c of claims) {
    y += 4;
    put(`${c.id}  ${quote(lang, c.full[lang])}`, "");
    const v = verdict(c, p.boundary);
    const first = y + 16;
    put(why(c, p.boundary, L, lang), "", 15);
    parts.push(marker(x0, first, v));
    for (const ln of citeLine(c, L, lang)) put(ln, "fig-t-muted fig-t-num", 15);
  }
  // The spans these claims touch or cite, with their text.
  const spans = SPANS.filter((s) => claims.some((c) => c.cites.includes(s.id) || relOf(c, s.id).length));
  for (const s of spans) {
    // Relation to each selected claim, grouped: "supports c1, c2, c3".
    const byTag = new Map<string, string[]>();
    for (const c of claims) {
      const rs = relOf(c, s.id);
      let tag = "";
      if (rs.some((r) => r.rel === "X")) tag = L.relX;
      else if (rs.some((r) => r.rel === "S")) tag = c.parts > 1 ? L.relP : L.relS;
      else if (c.cites.includes(s.id)) tag = L.relCited;
      if (tag) byTag.set(tag, [...(byTag.get(tag) ?? []), c.id]);
    }
    const tags = [...byTag].map(([tag, ids]) => (claims.length > 1 ? `${tag} ${ids.join(SEP[lang])}` : tag));
    if (!inside.has(s.doc)) tags.push(L.relOut);
    y += 8;
    put(`${s.id} ${L[s.doc]}${lang === "zh" ? "：" : ": "}${tags.join(lang === "zh" ? "；" : "; ")}`, "fig-t-strong");
    put(quote(lang, s.text[lang]), "fig-t-muted");
  }
  return { svg: g({ class: "fig-detail" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-out`, C.ink3, 5, 1), hatch(`${st.uid}-part`, C.good, 4, 1.8))];

  // The answer, with the selected claim's text in bold.
  let y = 14;
  parts.push(text(0, y, L.answer, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const segs: Seg[] = [];
  ANSWER[lang].forEach(([topic, s], i) => {
    if (i && lang === "en") segs.push({ s: " ", cls: "" });
    segs.push({ s, cls: topic === p.focus ? "fig-t-strong" : "" });
  });
  y += 4;
  for (const ln of richWrap(segs, fs, w)) { y += 17; parts.push(richLine(0, y, ln, fs)); }
  y += 18;

  const mx = renderMatrix(p, w, y, L, lang, st.uid);
  parts.push(mx.svg);
  y += mx.h + 22;

  if (narrow) {
    const me = renderMetrics(p, 0, y, w, L, lang);
    parts.push(me.svg);
    y += me.h + 22;
    const de = renderDetail(p, 0, y, w, L, lang);
    parts.push(de.svg);
    y += de.h;
  } else {
    const colW = Math.floor((w - 28) / 2);
    const me = renderMetrics(p, 0, y, colW, L, lang);
    const de = renderDetail(p, colW + 28, y, w - colW - 28, L, lang);
    parts.push(me.svg, de.svg);
    y += Math.max(me.h, de.h);
  }
  return svg(w, y + 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "claim-evidence",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    split: {
      kind: "choice", label: { en: "Claim extraction", zh: "主张抽取" }, default: "atomic",
      options: [
        { value: "sentence", label: { en: "One per sentence", zh: "每句一条" } },
        { value: "atomic", label: { en: "Atomic", zh: "原子主张" } },
        { value: "fine", label: { en: "Over-split", zh: "过度拆分" } },
      ],
    },
    boundary: {
      kind: "choice", label: { en: "Evidence boundary", zh: "证据边界" }, default: "context",
      options: [
        { value: "context", label: { en: "Supplied context (D1, D2)", zh: "给定上下文（D1、D2）" } },
        { value: "search", label: { en: "Bounded search (adds D3)", zh: "有界搜索（加入 D3）" } },
      ],
    },
    focus: {
      kind: "choice", label: { en: "Claim shown", zh: "查看主张" }, default: "mortality",
      options: TOPICS.map((t) => ({ value: t, label: { en: labels.en[t], zh: labels.zh[t] } })),
    },
  },
  render,
  describe,
});
