// Fixed-window chunking with overlap, and what the overlap buys and costs for
// evidence that spans a chunk boundary. One illustrative document of L = 1,024
// tokens is cut into windows of c tokens with overlap o, so the stride is
// s = c − o and window k covers tokens [k·s, min(k·s + c, L)).
//
// An evidence span of e tokens starting at token a is kept whole when some
// window contains all of it: k·s ≤ a and a + e ≤ k·s + c. Over start
// positions, that holds for the residues a mod s ≤ c − e, so away from the
// document ends the share of spans kept whole is
//
//   whole(e) = min(1, (c − e + 1) / s)   for e ≤ c,   and 0 for e > c.
//
// Every span of e tokens is whole once o ≥ e − 1. The cost is storage and
// duplicate hits: away from the ends each token sits in c / s windows, so the
// index stores about c / s tokens per document token, and a query that matches
// one passage can return that many overlapping chunks.
//
// The document, the default sizes, and the span are illustrative; the two
// curves are the formulas above, and the strip draws the windows exactly.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap, placeLabels, drawLabels, lineObstacles } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const L_DOC = 1024; // document length in tokens

type P = { chunk: number; overlap: number; span: number; start: number };

interface Window { k: number; a: number; b: number } // tokens [a, b)

function model(p: P) {
  const c = p.chunk;
  const o = Math.round((c * p.overlap) / 100);
  const s = c - o;
  const e = Math.min(p.span, L_DOC);
  const a = Math.max(0, Math.min(p.start, L_DOC - e));
  const wins: Window[] = [];
  for (let k = 0, x = 0; ; k++, x += s) {
    const b = Math.min(L_DOC, x + c);
    wins.push({ k, a: x, b });
    if (b >= L_DOC) break;
  }
  const holds = wins.filter((wd) => wd.a <= a && a + e <= wd.b);
  const parts = wins.filter((wd) => wd.a < a + e && a < wd.b && !holds.includes(wd));
  // Window ends that fall strictly inside the span: the cuts a reader would see.
  const cuts = wins.map((wd) => wd.b).filter((b) => b > a && b < a + e);
  return { c, o, s, e, a, wins, holds, parts, cuts, whole: wholeShare(c, s, e), copies: c / s };
}
type M = ReturnType<typeof model>;

function wholeShare(c: number, s: number, e: number): number {
  if (e > c) return 0;
  return Math.min(1, (c - e + 1) / s);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Chunk overlap and evidence at a boundary",
    strip: "A {l}-token document in windows of {c} tokens, overlap {o}",
    whole: "holds the span whole",
    part: "holds part of the span",
    other: "other chunk",
    spanKey: "evidence span",
    tokens: "token position in the document",
    chartWhole: "Spans of {e} tokens kept whole",
    chartCopies: "Tokens stored per document token",
    overlapAxis: "overlap, share of the chunk (%)",
    need: "o = e − 1",
    stride: "stride s = c − o = {c} − {o} = {s} tokens, {n} chunks",
    wholeLine: "kept whole: (c − e + 1) / s = {num} / {s} = {v} of start positions",
    wholeAll: "kept whole: c − e + 1 = {num} ≥ s = {s}, so every start position",
    wholeNone: "kept whole: none, the span is longer than the chunk (e = {e} > c = {c})",
    copies: "stored: c / s = {c} / {s} = ×{v} tokens per document token; the extra copies come back as duplicate hits",
    spanWhole: "This span, tokens {a} to {b}: whole in chunk {k}",
    spanWholeAlso: "This span, tokens {a} to {b}: whole in chunk {k}, and part of it in chunk {j}",
    spanCut: "This span, tokens {a} to {b}: cut at token {x}, split across chunks {ks}",
    spanNone: "This span, tokens {a} to {b}: longer than any chunk, split across chunks {ks}",
    and: " and ",
    describe: "Windows of {c} tokens with {o} tokens of overlap, stride {s}: {v} of {e}-token spans fall whole inside one chunk, and the index stores ×{x} tokens per document token. {span}",
  },
  zh: {
    title: "分块重叠与跨边界证据",
    strip: "一份 {l} 个词元的文档，窗口 {c} 个词元，重叠 {o} 个",
    whole: "完整包含这段证据",
    part: "只包含其中一部分",
    other: "其他分块",
    spanKey: "证据片段",
    tokens: "文档中的词元位置",
    chartWhole: "{e} 个词元的片段保持完整",
    chartCopies: "每个文档词元存储的次数",
    overlapAxis: "重叠占分块的比例（%）",
    need: "o = e − 1",
    stride: "步长 s = c − o = {c} − {o} = {s} 个词元，共 {n} 个分块",
    wholeLine: "保持完整：(c − e + 1) / s = {num} / {s} = {v} 的起始位置",
    wholeAll: "保持完整：c − e + 1 = {num} ≥ s = {s}，所有起始位置都完整",
    wholeNone: "保持完整：不可能，片段比分块长（e = {e} > c = {c}）",
    copies: "存储量：c / s = {c} / {s} = ×{v}，即每个文档词元存 {v} 次，多出的副本会以重复结果返回",
    spanWhole: "当前片段（词元 {a} 到 {b}）：完整落在分块 {k} 中",
    spanWholeAlso: "当前片段（词元 {a} 到 {b}）：完整落在分块 {k} 中，分块 {j} 也含有其中一部分",
    spanCut: "当前片段（词元 {a} 到 {b}）：在词元 {x} 处被切开，分散在分块 {ks}",
    spanNone: "当前片段（词元 {a} 到 {b}）：比任何分块都长，分散在分块 {ks}",
    and: " 和 ",
    describe: "窗口 {c} 个词元，重叠 {o} 个，步长 {s}：{e} 个词元的片段中有 {v} 完整落在某一个分块里，索引为每个文档词元存储 ×{x} 次。{span}",
  },
};
type L = typeof labels.en;

const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));

function joinList(ks: number[], Lx: L, lang: Lang): string {
  if (ks.length <= 1) return ks.join("");
  const sep = lang === "zh" ? "、" : ", ";
  return ks.slice(0, -1).join(sep) + Lx.and + ks[ks.length - 1];
}

function spanSentence(m: M, Lx: L, lang: Lang): string {
  const a = m.a, b = m.a + m.e - 1;
  const touched = [...m.holds, ...m.parts].sort((x, y) => x.k - y.k).map((wd) => wd.k + 1);
  if (m.holds.length) {
    const k = m.holds[0].k + 1;
    const others = touched.filter((j) => j !== k);
    return others.length ? tpl(Lx.spanWholeAlso, { a, b, k, j: joinList(others, Lx, lang) }) : tpl(Lx.spanWhole, { a, b, k });
  }
  if (m.e > m.c) return tpl(Lx.spanNone, { a, b, ks: joinList(touched, Lx, lang) });
  return tpl(Lx.spanCut, { a, b, x: m.cuts[0] ?? m.a, ks: joinList(touched, Lx, lang) });
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  return tpl(Lx.describe, { c: m.c, o: m.o, s: m.s, v: pct(m.whole), e: m.e, x: fixed(m.copies, 2), span: spanSentence(m, Lx, lang) });
}

// ---------------------------------------------------------------- render

function renderStrip(m: M, w: number, y0: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  // Bold text runs wider than the measured regular advances, so wrap early.
  for (const ln of lines(tpl(Lx.strip, { l: int(L_DOC), c: m.c, o: m.o }), TYPE.label, w - 12, lang)) {
    y += 16;
    parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
  }
  const lg = legend([
    { label: Lx.whole, swatch: { kind: "rect", fill: C.c1 } },
    { label: Lx.part, swatch: { kind: "rect", fill: C.c2 } },
    { label: Lx.other, swatch: { kind: "rect", fill: C.panel, stroke: C.rule } },
    { label: Lx.spanKey, swatch: { kind: "rect", fill: C.ink } },
  ], 0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 14;

  const x = linear([0, L_DOC], [8, w - 18]);
  const docY = y, docH = 10;
  const rowH = 20, gap = 4;
  const rowsTop = docY + docH + 8;
  const bottom = rowsTop + 2 * rowH + gap;

  // The span's extent through the chunk rows, so the reader sees which
  // windows cover it.
  const sx0 = x(m.a), sx1 = x(m.a + m.e);
  parts.push(el("rect", { x: sx0, y: docY - 4, width: Math.max(1.5, sx1 - sx0), height: bottom - docY + 8, fill: C.ink, "fill-opacity": 0.07 }));
  for (const xx of [sx0, sx1]) parts.push(el("line", { x1: xx, x2: xx, y1: docY - 4, y2: bottom + 4, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 2" }));

  // Document bar with the span on it.
  parts.push(el("rect", { x: x(0), y: docY, width: x(L_DOC) - x(0), height: docH, rx: 2, fill: C.panel }));
  parts.push(el("rect", { x: sx0, y: docY, width: Math.max(1.5, sx1 - sx0), height: docH, rx: 1, fill: C.ink }));

  // Windows in two alternating rows: with at most 50% overlap, windows k and
  // k + 2 never overlap, so every window stays visible.
  for (const wd of m.wins) {
    const yy = rowsTop + (wd.k % 2) * (rowH + gap);
    const x0 = x(wd.a) + 0.5, x1 = x(wd.b) - 0.5;
    const whole = m.holds.includes(wd), part = m.parts.includes(wd);
    parts.push(el("rect", {
      x: x0, y: yy, width: Math.max(1, x1 - x0), height: rowH, rx: 3,
      fill: whole ? C.c1 : part ? C.c2 : C.panel, stroke: whole || part ? undefined : C.rule, "stroke-width": whole || part ? undefined : 1,
    }));
    const lab = String(wd.k + 1);
    if (x1 - x0 >= textWidth(lab, fs) + 8) parts.push(text((x0 + x1) / 2, yy + rowH / 2 + fs * 0.36, lab, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
  }

  // Click targets along the strip move the span; the slider is the keyboard path.
  const step = 16;
  for (let t = 0; t < L_DOC; t += step) {
    const start = Math.max(0, Math.min(L_DOC - m.e, Math.round(t + step / 2 - m.e / 2)));
    parts.push(el("rect", { x: x(t), y: docY - 4, width: x(t + step) - x(t), height: bottom - docY + 8, fill: "transparent", "data-fig-set": `start=${start}`, class: "fig-hit" }));
  }

  const axY = bottom + 6;
  parts.push(axis({ scale: x, orient: "bottom", at: axY, ticks: [0, 256, 512, 768, 1024], title: Lx.tokens, size: fs, format: (v) => int(v) }));
  return { svg: g({ class: "fig-strip" }, ...parts), h: axY + axisHeight(true, fs) - y0 };
}

function renderChart(kind: "whole" | "copies", m: M, x0: number, y0: number, w: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const title = kind === "whole" ? tpl(Lx.chartWhole, { e: m.e }) : Lx.chartCopies;
  let y = y0;
  for (const ln of lines(title, TYPE.label, w - 12, lang)) { y += 16; parts.push(text(x0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  const left = x0 + (kind === "whole" ? 40 : 40);
  const right = x0 + w - 10;
  const top = y + 12, plotH = 118;
  const xs = linear([0, 50], [left, right]);
  const ys = kind === "whole" ? linear([0, 1], [top + plotH, top]) : linear([1, 2], [top + plotH, top]);
  parts.push(axis({ scale: xs, orient: "bottom", at: top + plotH, ticks: [0, 10, 20, 30, 40, 50], title: Lx.overlapAxis, size: fs, grid: [top, top + plotH], format: (v) => String(v) }));
  parts.push(axis({
    scale: ys, orient: "left", at: left, grid: [left, right], size: fs,
    ticks: kind === "whole" ? [0, 0.25, 0.5, 0.75, 1] : [1, 1.25, 1.5, 1.75, 2],
    format: (v) => (kind === "whole" ? pct(v) : `×${fixed(v, 2)}`),
  }));
  // The curves treat o as continuous; the marker sits at the whole-token o.
  const f = (share: number) => {
    const s = m.c - (m.c * share) / 100;
    return kind === "whole" ? wholeShare(m.c, s, m.e) : m.c / s;
  };
  const pts: Array<[number, number]> = [];
  for (let sh = 0; sh <= 50; sh += 0.5) pts.push([xs(sh), ys(f(sh))]);
  // The threshold o = e − 1, where every span of e tokens becomes whole.
  const needShare = ((m.e - 1) / m.c) * 100;
  if (kind === "whole" && m.e <= m.c && needShare <= 50) {
    const nx = xs(needShare);
    parts.push(el("line", { x1: nx, x2: nx, y1: top, y2: top + plotH, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    const lw = textWidth(Lx.need, fs);
    const lx = nx + 5 + lw <= right ? nx + 5 : nx - 5;
    parts.push(text(lx, top + plotH - 8, Lx.need, { "font-size": fs, "text-anchor": lx > nx ? "start" : "end", class: "fig-t-halo fig-t-muted" }));
  }
  parts.push(el("path", { d: linePath(pts), fill: "none", stroke: kind === "whole" ? C.c1 : C.c3, "stroke-width": 2, "stroke-linejoin": "round" }));
  const cx = xs((m.o / m.c) * 100), cy = ys(kind === "whole" ? m.whole : m.copies);
  const val = kind === "whole" ? pct(m.whole) : `×${fixed(m.copies, 2)}`;
  parts.push(el("circle", { cx, cy, r: 5, fill: kind === "whole" ? C.c1 : C.c3, stroke: C.paper, "stroke-width": 2 }));
  const placed = placeLabels(
    [{ x: cx, y: cy, text: val, size: TYPE.body, sides: ["below-right", "above-left", "below", "above", "right", "left", "above-right", "below-left"], gap: 8, priority: 1, attrs: { class: "fig-t-halo fig-t-strong fig-t-num" } }],
    { x0: left + 2, y0: top - 4, x1: right, y1: top + plotH - 2 }, [...lineObstacles(pts), { x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 }]);
  parts.push(drawLabels(placed.placed));
  return { svg: g({ class: "fig-chart" }, ...parts), h: top + plotH + axisHeight(true, fs) - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const m = model(st.p);
  const parts: string[] = [];
  const strip = renderStrip(m, w, 0, Lx, lang, fs);
  parts.push(strip.svg);
  let y = strip.h + 18;
  if (narrow) {
    const a = renderChart("whole", m, 0, y, w, Lx, lang, fs);
    parts.push(a.svg); y += a.h + 16;
    const b = renderChart("copies", m, 0, y, w, Lx, lang, fs);
    parts.push(b.svg); y += b.h + 14;
  } else {
    const cw = Math.floor((w - 28) / 2);
    const a = renderChart("whole", m, 0, y, cw, Lx, lang, fs);
    const b = renderChart("copies", m, cw + 28, y, cw, Lx, lang, fs);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h) + 14;
  }

  // Readout: the formulas with this state's terms.
  const rows: Array<[string, string]> = [];
  rows.push([tpl(Lx.stride, { c: m.c, o: m.o, s: m.s, n: m.wins.length }), "fig-t-num"]);
  const num = m.c - m.e + 1;
  rows.push([m.e > m.c ? tpl(Lx.wholeNone, { e: m.e, c: m.c }) : num >= m.s ? tpl(Lx.wholeAll, { num, s: m.s }) : tpl(Lx.wholeLine, { num, s: m.s, v: pct(m.whole) }), "fig-t-num"]);
  rows.push([tpl(Lx.copies, { c: m.c, s: m.s, v: fixed(m.copies, 2) }), "fig-t-num"]);
  rows.push([spanSentence(m, Lx, lang), "fig-t-strong"]);
  const ro: string[] = [];
  for (const [line, cls] of rows) {
    for (const part of lines(line, TYPE.body, w, lang)) { y += 17; ro.push(text(0, y, part, { "font-size": TYPE.body, class: cls })); }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "chunk-overlap",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    chunk: {
      kind: "choice", label: { en: "Chunk size c", zh: "分块大小 c" }, default: 256,
      options: [
        { value: 128, label: { en: "128 tokens", zh: "128 个词元" } },
        { value: 256, label: { en: "256 tokens", zh: "256 个词元" } },
        { value: 512, label: { en: "512 tokens", zh: "512 个词元" } },
      ],
    },
    overlap: {
      kind: "range", label: { en: "Overlap o, share of the chunk", zh: "重叠 o 占分块的比例" }, unit: { en: "%", zh: "%" },
      min: 0, max: 50, step: 1, default: 0,
      marks: [{ value: 10, label: { en: "10%", zh: "10%" } }, { value: 25, label: { en: "25%", zh: "25%" } }],
    },
    span: { kind: "range", label: { en: "Evidence span e", zh: "证据片段长度 e" }, unit: { en: "tokens", zh: "个词元" }, min: 8, max: 192, step: 1, default: 48 },
    start: { kind: "range", label: { en: "Span starts at token", zh: "片段起始词元" }, min: 0, max: L_DOC - 8, step: 1, default: 232 },
  },
  // The span cannot run past the document end: a longer span or a later start
  // moves the start back so the control shows the position drawn.
  update(p, key) {
    if (key === "span" || key === "start") return { ...p, start: Math.min(p.start, L_DOC - p.span) };
    return p;
  },
  render,
  describe,
});
