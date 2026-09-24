// Hosting and commercial-use clauses of the 2026 releases in the model
// landscape chapter's September 2026 dated note, placed on one axis of the
// licensee's revenue over twelve months. Every threshold and every exemption
// is the one the chapter states with a citation:
//
//   Qwen3.8 flagship     model-as-a-service or AI work-assistant business above
//                        US$50M: separate license; internal use exempt
//   Qwen3.8-Flash-Next   the same clause with no revenue floor
//   Kimi K3              model-as-a-service operators above US$20M: separate
//                        agreement; internal use exempt
//   GLM-5.3              operators above US$10B: Z.ai security review
//   MiniMax-M3           non-commercial grant; commercial use, including a
//                        hosted API, needs a notice, and above US$20M prior
//                        written authorization
//   DeepSeek-V4-Pro MIT, Qwen3.8-27B Apache 2.0, GLM-5.3-Flash MIT
//
// Where a clause does not say whether it reaches the chosen business (does an
// AI work-assistant product count as model as a service; is internal use at a
// company commercial use), the cell is "not settled by the record", the
// unknown outcome of the chapter's release gate, never a guess. This is a
// reading of the recorded clauses, not of the license texts.

import { defineFigure, type Lang, type State, type Text } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { sig, tpl } from "./lib/format.ts";

type Biz = "internal" | "hosted" | "assistant";
// grant: the license adds nothing to its grant for this business;
// exempt: a clause exists and exempts this use; the rest add an obligation.
type St = "grant" | "exempt" | "notice" | "agreement" | "review" | "unknown";

interface Rule { base: St; above?: { usd: number; st: St } }
interface Row {
  name: string;
  grant: Text; // the license in a few words
  agreement?: Text; // what the agreement state is called in this license
  rules: Record<Biz, Rule>;
}

const ALL_GRANT: Record<Biz, Rule> = { internal: { base: "grant" }, hosted: { base: "grant" }, assistant: { base: "grant" } };

const ROWS: Row[] = [
  { name: "DeepSeek-V4-Pro", grant: { en: "MIT", zh: "MIT" }, rules: ALL_GRANT },
  {
    name: "Qwen3.8", grant: { en: "permissive, hosting clause", zh: "宽松授权，附托管条款" },
    agreement: { en: "separate license", zh: "须另行取得许可" },
    rules: {
      internal: { base: "exempt" },
      hosted: { base: "grant", above: { usd: 50e6, st: "agreement" } },
      assistant: { base: "grant", above: { usd: 50e6, st: "agreement" } },
    },
  },
  {
    name: "Qwen3.8-Flash-Next", grant: { en: "same clause, no floor", zh: "同一条款，不设门槛" },
    agreement: { en: "separate license", zh: "须另行取得许可" },
    rules: { internal: { base: "exempt" }, hosted: { base: "agreement" }, assistant: { base: "agreement" } },
  },
  { name: "Qwen3.8-27B", grant: { en: "Apache 2.0", zh: "Apache 2.0" }, rules: ALL_GRANT },
  {
    name: "Kimi K3", grant: { en: "permissive, MaaS clause", zh: "宽松授权，附托管条款" },
    agreement: { en: "separate agreement", zh: "须另签协议" },
    rules: {
      internal: { base: "exempt" },
      hosted: { base: "grant", above: { usd: 20e6, st: "agreement" } },
      assistant: { base: "grant", above: { usd: 20e6, st: "unknown" } },
    },
  },
  {
    name: "GLM-5.3", grant: { en: "permissive, security review", zh: "宽松授权，附安全审查" },
    rules: {
      internal: { base: "grant", above: { usd: 10e9, st: "unknown" } },
      hosted: { base: "grant", above: { usd: 10e9, st: "review" } },
      assistant: { base: "grant", above: { usd: 10e9, st: "unknown" } },
    },
  },
  { name: "GLM-5.3-Flash", grant: { en: "MIT", zh: "MIT" }, rules: ALL_GRANT },
  {
    name: "MiniMax-M3", grant: { en: "non-commercial grant", zh: "仅授予非商业使用权" },
    agreement: { en: "authorization and notice", zh: "须书面授权并标注" },
    rules: {
      internal: { base: "unknown" },
      hosted: { base: "notice", above: { usd: 20e6, st: "agreement" } },
      assistant: { base: "notice", above: { usd: 20e6, st: "agreement" } },
    },
  },
];

const X_MIN = 1e6, X_MAX = 1e11;

// The state at a revenue: a clause applies strictly above its threshold.
function stateAt(rule: Rule, usd: number): St {
  return rule.above && usd > rule.above.usd ? rule.above.st : rule.base;
}

// Segments of one row over the axis domain.
function segments(rule: Rule): Array<{ x0: number; x1: number; st: St }> {
  if (!rule.above) return [{ x0: X_MIN, x1: X_MAX, st: rule.base }];
  return [{ x0: X_MIN, x1: rule.above.usd, st: rule.base }, { x0: rule.above.usd, x1: X_MAX, st: rule.above.st }];
}

const FILL: Partial<Record<St, string>> = { agreement: C.c1, review: C.c2, notice: C.c3 };

const labels = {
  en: {
    title: "Recorded hosting clauses by licensee revenue",
    x: "licensee revenue over the last 12 months (US$, log scale)",
    lAgreement: "separate license, agreement, or authorization",
    lReview: "security review",
    lNotice: "notice only",
    lUnknown: "not settled by the record",
    lGrant: "nothing added to the grant",
    grant: "nothing added",
    exempt: "exempt: internal use",
    notice: "notice required",
    review: "Z.ai security review",
    unknown: "not settled by the record",
    at: "at {v}",
    readout: "{biz} at {v}: {a} of 8 licenses require a separate license, agreement, or authorization{names}; {r} a security review; {n} only a notice; {u} not settled by the record.",
    describe: "{biz} at {v}: {a} of the 8 recorded licenses require a separate license, agreement, or authorization{names}, {r} a security review, {n} only a notice, and {u} are not settled by the record.",
    internal: "Internal use", hosted: "A hosted API", assistant: "An AI work-assistant product",
    source: "Source: each release's license or model card, as cited in the chapter's September 2026 note.",
  },
  zh: {
    title: "按被许可方收入排列的托管条款",
    x: "被许可方近十二个月收入（美元，对数刻度）",
    lAgreement: "须另行取得许可、另签协议或书面授权",
    lReview: "须通过安全审查",
    lNotice: "只须标注声明",
    lUnknown: "记录未说明",
    lGrant: "授权之外无附加要求",
    grant: "无附加要求",
    exempt: "豁免：内部使用",
    notice: "须标注声明",
    review: "须通过 Z.ai 安全审查",
    unknown: "记录未说明",
    at: "{v}",
    readout: "{biz}，收入 {v}：8 份许可证中有 {a} 份要求另行取得许可、另签协议或书面授权{names}；{r} 份要求安全审查；{n} 份只须标注声明；{u} 份记录未说明。",
    describe: "{biz}，收入 {v}：在已记录的 8 份许可证中，{a} 份要求另行取得许可、另签协议或书面授权{names}，{r} 份要求安全审查，{n} 份只须标注声明，{u} 份记录未说明。",
    internal: "内部使用", hosted: "提供托管 API", assistant: "提供 AI 办公助手产品",
    source: "来源：各发布的许可证或模型卡，见本章截至 2026 年 9 月的注释所引文献。",
  },
};
type L = typeof labels.en;
type P = { business: Biz; revenue: number }; // revenue in millions of US$

function usd(v: number, lang: Lang): string {
  if (lang === "zh") return v >= 1e8 ? `${sig(v / 1e8, 3)} 亿美元` : `${sig(v / 1e4, 3)} 万美元`;
  return v >= 1e9 ? `US$${sig(v / 1e9, 3)}B` : `US$${sig(v / 1e6, 3)}M`;
}

function tick(v: number, lang: Lang): string {
  if (lang === "zh") return v >= 1e8 ? `${sig(v / 1e8, 3)} 亿` : `${sig(v / 1e4, 3)} 万`;
  return v >= 1e9 ? `$${sig(v / 1e9, 3)}B` : `$${sig(v / 1e6, 3)}M`;
}

function stateText(row: Row, st: St, L: L, lang: Lang): string {
  if (st === "agreement") return row.agreement![lang];
  return L[st];
}

function tally(p: P) {
  const v = p.revenue * 1e6;
  const by = ROWS.map((r) => ({ r, st: stateAt(r.rules[p.business], v) }));
  const of = (s: St) => by.filter((b) => b.st === s);
  return { v, by, a: of("agreement"), r: of("review"), n: of("notice"), u: of("unknown") };
}

function names(list: Array<{ r: Row }>, lang: Lang): string {
  if (!list.length) return "";
  const s = list.map((b) => b.r.name).join(lang === "zh" ? "、" : ", ");
  return lang === "zh" ? `（${s}）` : ` (${s})`;
}

// wrapCJK, plus the other half of the line-break rule: an opening bracket
// never ends a line. wrapCJK keeps closing punctuation off a line start by
// moving the glyph before it down, which can widen the next line past the
// width; when that happens the text is wrapped again one glyph narrower.
function wrapLines(s: string, size: number, width: number): string[] {
  let out = wrapCJK(s, size, width);
  if (out.some((ln) => textWidth(ln, size) > width)) out = wrapCJK(s, size, width - size * 1.02);
  for (let i = 0; i < out.length - 1; i++) {
    while (/[（「]$/u.test(out[i])) {
      out[i + 1] = out[i].slice(-1) + out[i + 1];
      out[i] = out[i].slice(0, -1);
    }
  }
  return out;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const t = tally(st.p);
  return tpl(L.describe, { biz: L[st.p.business], v: usd(t.v, lang), a: t.a.length, names: names(t.a, lang), r: t.r.length, n: t.n.length, u: t.u.length });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = tally(p);
  const hid = `${st.uid}-unk`;
  const parts: string[] = [el("defs", {}, hatch(hid, C.ink3, 5, 1))];

  parts.push(text(0, 14, L.title, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.lAgreement, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.lReview, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lNotice, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.lUnknown, swatch: { kind: "rect", fill: C.ink3, pattern: hid } },
    { label: L.lGrant, swatch: { kind: "rect", fill: C.panel } },
  ], 0, 24, w);
  parts.push(lg.svg);

  // Plot geometry. Desktop: names left, states right. Phone: name and state
  // on one line, the track below at full width, the threshold under it.
  const allStates = ROWS.flatMap((r) => (["grant", "exempt", "notice", "agreement", "review", "unknown"] as St[])
    .filter((s) => s !== "agreement" || r.agreement).map((s) => stateText(r, s, L, lang)));
  const nameW = narrow ? 0 : Math.max(...ROWS.flatMap((r) => [textWidth(r.name, TYPE.body) * 1.06, textWidth(r.grant[lang], TYPE.small)])) + 14;
  const stateW = narrow ? 0 : Math.max(...allStates.map((s) => textWidth(s, TYPE.small) * 1.06)) + 14;
  const x0 = narrow ? 14 : nameW, x1 = narrow ? w - 18 : w - stateW;
  const x = log([X_MIN, X_MAX], [x0, x1]);
  const top = 24 + lg.height + 30;
  const rowH = narrow ? 52 : 40;
  const trackY = narrow ? 26 : 18; // center of the track inside a row
  const trackH = 12;
  const plotH = ROWS.length * rowH;
  const cx = x(t.v);

  // Gridlines at decades and the revenue line, under everything else.
  for (const v of x.ticks()) parts.push(el("line", { x1: x(v), x2: x(v), y1: top - 4, y2: top + plotH, stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 10, y2: top + plotH, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  const over: string[] = []; // threshold labels, drawn above the revenue marks

  ROWS.forEach((row, i) => {
    const y = top + i * rowH;
    const rule = row.rules[p.business];
    const s = stateAt(rule, t.v);
    const heavy = s !== "grant" && s !== "exempt";
    const ty = y + trackY - trackH / 2; // top of the track
    // Name and license.
    if (narrow) {
      parts.push(text(0, y + 12, row.name, { "font-size": TYPE.body, class: "fig-t-halo" }));
    } else {
      parts.push(text(0, y + trackY + 4, row.name, { "font-size": TYPE.body, class: "fig-t-strong" }));
      parts.push(text(0, y + trackY + 19, row.grant[lang], { "font-size": TYPE.small, class: "fig-t-muted" }));
    }
    // Track and clause segments.
    parts.push(el("rect", { x: x0, y: ty, width: x1 - x0, height: trackH, rx: 3, fill: C.panel }));
    for (const seg of segments(rule)) {
      const sx = x(seg.x0), sw = x(seg.x1) - sx;
      if (seg.st === "unknown") parts.push(el("rect", { x: sx, y: ty, width: sw, height: trackH, rx: 3, fill: `url(#${hid})` }));
      else if (FILL[seg.st]) parts.push(el("rect", { x: sx, y: ty, width: sw, height: trackH, rx: 3, fill: FILL[seg.st]! }));
    }
    // Threshold: a tick at the boundary and its value, above the track on
    // desktop and below it on a phone.
    if (rule.above) {
      const bx = x(rule.above.usd);
      parts.push(el("line", { x1: bx, x2: bx, y1: ty - (narrow ? 0 : 3), y2: ty + trackH + (narrow ? 3 : 0), stroke: C.ink2, "stroke-width": 1 }));
      const lab = usd(rule.above.usd, lang);
      const lw = textWidth(lab, TYPE.small);
      const lx = Math.min(Math.max(bx, x0 + lw / 2), x1 - lw / 2);
      over.push(text(lx, narrow ? ty + trackH + 14 : ty - 4, lab, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-halo fig-t-soft fig-t-num" }));
    }
    // The revenue mark on this track.
    parts.push(el("line", { x1: cx, x2: cx, y1: ty - 3, y2: ty + trackH + 3, stroke: C.ink, "stroke-width": 2 }));
    // State at the chosen revenue.
    const label = stateText(row, s, L, lang);
    parts.push(text(w, narrow ? y + 12 : y + trackY + 4, label, { "font-size": TYPE.small, "text-anchor": "end", class: heavy ? "fig-t-halo" : "fig-t-halo fig-t-soft" }));
    if (!narrow && i < ROWS.length - 1) parts.push(el("line", { x1: 0, x2: w, y1: y + rowH - 2, y2: y + rowH - 2, stroke: C.grid, "stroke-width": 1 }));
  });
  parts.push(...over);

  // Revenue label over the plot.
  const cl = tpl(L.at, { v: usd(t.v, lang) });
  const clw = textWidth(cl, TYPE.small);
  parts.push(text(Math.min(Math.max(cx, x0 + clw / 2), x1 - clw / 2), top - 14, cl, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));

  // Axis.
  const ay = top + plotH + (narrow ? -4 : 4);
  parts.push(axis({ scale: x, orient: "bottom", at: ay, title: L.x, format: (v) => tick(v, lang) }));

  // Readout.
  let y = ay + axisHeight(true) + 16;
  const ro = wrapLines(tpl(L.readout, { biz: L[p.business], v: usd(t.v, lang), a: t.a.length, names: names(t.a, lang), r: t.r.length, n: t.n.length, u: t.u.length }), TYPE.body, w);
  ro.forEach((ln, i) => parts.push(text(0, y + i * 15, ln, { "font-size": TYPE.body })));
  y += ro.length * 15 + 4;
  const src = wrapLines(L.source, TYPE.small, w);
  src.forEach((ln, i) => parts.push(text(0, y + i * 15, ln, { "font-size": TYPE.small, class: "fig-t-muted" })));
  y += (src.length - 1) * 15 + 6;
  return svg(w, y + 4, describe(st, lang), g({ class: "fig-clauses" }, ...parts));
}

export default defineFigure({
  name: "hosting-clauses",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    business: {
      kind: "choice", label: { en: "Use", zh: "用途" }, default: "hosted",
      options: [
        { value: "internal", label: { en: "Internal use", zh: "内部使用" } },
        { value: "hosted", label: { en: "Hosted API", zh: "托管 API" } },
        { value: "assistant", label: { en: "AI work assistant", zh: "AI 办公助手" } },
      ],
    },
    revenue: {
      kind: "range", scale: "log", label: { en: "Licensee revenue, 12 months", zh: "被许可方近十二个月收入" },
      unit: { en: "million US$", zh: "百万美元" }, min: 1, max: 100000, default: 30,
      marks: [
        { value: 20, label: { en: "Kimi K3, MiniMax-M3", zh: "Kimi K3、MiniMax-M3" } },
        { value: 50, label: { en: "Qwen3.8", zh: "Qwen3.8" } },
        { value: 10000, label: { en: "GLM-5.3", zh: "GLM-5.3" } },
      ],
    },
  },
  render,
  describe,
});
