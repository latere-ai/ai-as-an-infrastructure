// Token premium by language, measured on parallel text: the chapter's
// p_{l,i} = |T(s_{l,i})| / |T(s_{r,i})| with English as the reference r, over
// the 1,012 items of FLORES-200 devtest, for nine published tokenizers
// (data/token-premium.ts, from tools/figure-data/tokenization-data.py). Each
// row is one language's distribution under the chosen tokenizer: the 5th to
// 95th percentile, the interquartile range, and the median. Gray ticks are
// the medians under the other tokenizers. Below, one item as token strips,
// each piece a segment as wide as its UTF-8 bytes, and the fraction 1/p of
// the reference content a fixed context window holds.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, tpl } from "./lib/format.ts";
import { TOKENIZERS, LANGS, QUANTILES, ITEM, ITEM_COUNTS, ITEM_BYTES, STRIPS, UNKNOWN } from "./data/token-premium.ts";

type TokKey = (typeof TOKENIZERS)[number]["key"];
type LangCode = (typeof LANGS)[number]["code"];
const REF = "eng_Latn";

const labels = {
  en: {
    title: "Token premium by language on parallel text",
    x: "token premium p = tokens in language l / tokens in English (log scale)",
    xShort: "token premium p (log scale)",
    parity: "p = 1",
    cols: "p50 · p95",
    keyRange: "p5 to p95",
    keyIqr: "p25 to p75",
    keyMedian: "median",
    keyOthers: "median, other tokenizers",
    item: "FLORES-200 devtest sentence {i}, {tok}",
    strip: "{lang}: {n:token/tokens}, {b} UTF-8 bytes",
    stripKey: "each segment is one piece, as wide as its bytes; yellow pieces hold part of a character",
    ratio: "This sentence: p = {a} / {b} = {p}. Median over 1,012 sentences {m}, p95 {q}.",
    window: "A context window of C tokens holds about 1/p = {f} as much of this content as of English, at the median.",
    unknown: "{tok} emitted <unk> {n:time/times} in {lang} across the devtest.",
    describe: "{tok}: median token premium from {lo} ({loLang}) to {hi} ({hiLang}) against English. {lang}: median {m}, p95 {q}; a fixed window holds about {f} as much {lang} content as English.",
  },
  zh: {
    title: "平行文本上各语言的词元溢价",
    x: "词元溢价 p = 语言 l 的词元数 / 英文词元数（对数刻度）",
    xShort: "词元溢价 p（对数刻度）",
    parity: "p = 1",
    cols: "p50 · p95",
    keyRange: "p5 至 p95",
    keyIqr: "p25 至 p75",
    keyMedian: "中位数",
    keyOthers: "其他分词器的中位数",
    item: "FLORES-200 devtest 第 {i} 句，{tok}",
    strip: "{lang}：{n} 个词元，{b} 个 UTF-8 字节",
    stripKey: "每段是一个片段，宽度等于其字节数；黄色片段只含字符的一部分",
    ratio: "这一句：p = {a} / {b} = {p}。1,012 句的中位数为 {m}，p95 为 {q}。",
    window: "按中位数计，同样 C 个词元的上下文窗口，装下的该语言内容约为英文的 1/p = {f}。",
    unknown: "{tok} 在整个 devtest 的{lang}文本中输出了 {n} 次 <unk>。",
    describe: "{tok}：相对英文的词元溢价中位数从 {lo}（{loLang}）到 {hi}（{hiLang}）。{lang}：中位数 {m}，p95 {q}；固定窗口能容纳的{lang}内容约为英文的 {f}。",
  },
};

type P = { tokenizer: TokKey; lang: LangCode };

const langName = (c: string, lang: Lang) => (c === REF ? (lang === "zh" ? "英文" : "English") : LANGS.find((l) => l.code === c)![lang]);
const tokName = (k: TokKey) => TOKENIZERS.find((t) => t.key === k)!.name;
const q = (k: TokKey, c: LangCode) => QUANTILES[k][c];
const fmtP = (v: number) => (v < 10 ? fixed(v, 2) : fixed(v, 1));
const order = (k: TokKey) => [...LANGS].sort((a, b) => q(k, b.code)[2] - q(k, a.code)[2]);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const k = st.p.tokenizer;
  const rows = order(k);
  const hi = rows[0], lo = rows[rows.length - 1];
  const s = q(k, st.p.lang);
  return tpl(L.describe, {
    tok: tokName(k), lo: fmtP(q(k, lo.code)[2]), loLang: lo[lang], hi: fmtP(q(k, hi.code)[2]), hiLang: hi[lang],
    lang: langName(st.p.lang, lang), m: fmtP(s[2]), q: fmtP(s[4]), f: fixed(1 / s[2], 2),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const wrapT = (s: string, max: number, size: number = fs) => (lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max));
  const k = p.tokenizer;
  const rows = order(k);
  const parts: string[] = [];

  // ---- key
  let y = 0;
  const keys: Array<[string, string]> = [["range", L.keyRange], ["iqr", L.keyIqr], ["median", L.keyMedian], ["others", L.keyOthers]];
  let kx = 0, ky = 12;
  for (const [kind, lab] of keys) {
    const need = 24 + textWidth(lab, fs);
    if (kx > 0 && kx + need > w) { kx = 0; ky += 18; }
    const cy = ky - 4;
    if (kind === "range") parts.push(el("line", { x1: kx, x2: kx + 18, y1: cy, y2: cy, stroke: C.c1, "stroke-width": 1.5 }));
    if (kind === "iqr") parts.push(el("rect", { x: kx, y: cy - 5, width: 18, height: 10, rx: 2, fill: C.c1, "fill-opacity": 0.35 }));
    if (kind === "median") parts.push(el("circle", { cx: kx + 9, cy, r: 4.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
    if (kind === "others") parts.push(el("line", { x1: kx + 9, x2: kx + 9, y1: cy - 6, y2: cy + 6, stroke: C.ink3, "stroke-width": 1.5 }));
    parts.push(text(kx + 24, ky, lab, { "font-size": fs, class: "fig-t-muted" }));
    kx += need + 16;
  }
  y = ky + 16;

  // ---- one row per language, sorted by the chosen tokenizer's median
  const nameW = Math.max(...LANGS.map((l) => textWidth(l[lang], fs))) + 10;
  const numW = narrow ? 70 : 80;
  const x = log([0.5, 32], [nameW, w - numW - 6]);
  const rowH = 20;
  const top = y + 6;
  const plotBottom = top + rows.length * rowH;
  parts.push(text(w, y, L.cols, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(axis({ scale: x, orient: "bottom", at: plotBottom + 2, ticks: [0.5, 1, 2, 5, 10, 20], format: (v) => String(v), grid: [top, plotBottom], size: fs, title: narrow ? L.xShort : L.x }));
  parts.push(el("line", { x1: x(1), x2: x(1), y1: top - 4, y2: plotBottom, stroke: C.ink2, "stroke-width": 1 }));
  rows.forEach((row, i) => {
    const yy = top + i * rowH;
    const cy = yy + rowH / 2;
    const sel = row.code === p.lang;
    if (sel) parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH, rx: 3, fill: C.panel }));
    parts.push(text(0, cy + fs * 0.36, row[lang], { "font-size": fs, class: sel ? "fig-t-strong" : undefined }));
    for (const t of TOKENIZERS) {
      if (t.key === k) continue;
      const m = x(q(t.key, row.code)[2]);
      parts.push(el("line", { x1: m, x2: m, y1: cy - 5, y2: cy + 5, stroke: C.ink3, "stroke-width": 1.2, "stroke-opacity": 0.7 }));
    }
    const [p5, p25, p50, p75, p95] = q(k, row.code);
    parts.push(el("line", { x1: x(p5), x2: x(p95), y1: cy, y2: cy, stroke: C.c1, "stroke-width": 1.5 }));
    parts.push(el("rect", { x: x(p25), y: cy - 5, width: Math.max(2, x(p75) - x(p25)), height: 10, rx: 2, fill: C.c1, "fill-opacity": 0.35 }));
    parts.push(el("circle", { cx: x(p50), cy, r: 4.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
    parts.push(text(w, cy + fs * 0.36, `${fmtP(p50)} · ${fmtP(p95)}`, { "font-size": fs, "text-anchor": "end", class: `fig-t-num${sel ? " fig-t-strong" : ""}` }));
    parts.push(el("rect", { x: 0, y: yy, width: w, height: rowH, fill: "transparent", "data-fig-set": `lang=${row.code}`, class: "fig-hit" }));
  });
  parts.push(text(x(1) + 4, top - 6, L.parity, { "font-size": fs, class: "fig-t-muted" }));
  y = plotBottom + 2 + axisHeight(true, fs) + 18;

  // ---- one sentence as token strips, English and the chosen language
  const D: string[] = [];
  for (const line of wrapT(tpl(L.item, { i: ITEM + 1, tok: tokName(k) }), w, TYPE.label)) {
    D.push(text(0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 18;
  }
  y += 2;
  const strip = (code: string) => {
    const s = STRIPS[k][code];
    const widths = [...s].map((ch) => (ch >= "A" && ch <= "Z" ? { b: ch.charCodeAt(0) - 64, whole: false } : { b: parseInt(ch, 36), whole: true }));
    const total = widths.reduce((a, b) => a + b.b, 0);
    D.push(text(0, y + 12, tpl(L.strip, { lang: langName(code, lang), n: ITEM_COUNTS[k][code], b: ITEM_BYTES[code] }), { "font-size": fs }));
    y += 18;
    let xx = 0;
    const H = 16;
    widths.forEach((seg, j) => {
      const sw = (seg.b / total) * w;
      const gapPx = sw > 3 ? 1 : 0;
      D.push(el("rect", { x: xx, y, width: Math.max(0.6, sw - gapPx), height: H, fill: seg.whole ? C.c1 : C.c4, "fill-opacity": j % 2 ? 0.45 : 0.85 }));
      xx += sw;
    });
    y += H + 12;
  };
  strip(REF);
  strip(p.lang);
  for (const line of wrapT(L.stripKey, w)) {
    D.push(text(0, y + 2, line, { "font-size": fs, class: "fig-t-muted" }));
    y += 16;
  }
  y += 10;
  const s = q(k, p.lang);
  const a = ITEM_COUNTS[k][p.lang], b = ITEM_COUNTS[k][REF];
  const notes = [
    tpl(L.ratio, { a, b, p: fmtP(a / b), m: fmtP(s[2]), q: fmtP(s[4]) }),
    tpl(L.window, { f: fixed(1 / s[2], 2) }),
  ];
  const unk = UNKNOWN[k]?.[p.lang];
  if (unk) notes.push(tpl(L.unknown, { tok: tokName(k), n: unk, lang: langName(p.lang, lang) }));
  for (const [i, n] of notes.entries()) {
    for (const line of wrapT(n, w, TYPE.body)) {
      D.push(text(0, y + 2, line, { "font-size": TYPE.body, class: i === 0 ? "fig-t-num" : "fig-t-muted" }));
      y += 17;
    }
  }
  parts.push(g({ class: "fig-detail" }, ...D));
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "token-premium",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    tokenizer: {
      kind: "choice", control: "select", label: { en: "Tokenizer", zh: "分词器" }, default: "cl100k",
      options: TOKENIZERS.map((t) => ({ value: t.key, label: { en: `${t.name}, V = ${int(t.size)}`, zh: `${t.name}，V = ${int(t.size)}` } })),
    },
    lang: {
      kind: "choice", control: "select", label: { en: "Language", zh: "语言" }, default: "hin_Deva",
      options: LANGS.map((l) => ({ value: l.code, label: { en: l.en, zh: l.zh } })),
    },
  },
  render,
  describe,
});
