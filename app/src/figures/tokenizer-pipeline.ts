// The tokenizer contract applied to a real string: input, normalization,
// boundary rules, segmentation, ids with special tokens, and decoding, for
// three published tokenizer artifacts. Every value is measured: the records
// in data/tokenizer-pipeline.ts come from the Hugging Face `tokenizers`
// library run on each tokenizer.json (tools/figure-data/tokenization-data.py).
// The two toggles change one clause of the contract each: removing the
// declared normalizer, and whether literal control-token text in the input is
// parsed as control ids (the library default) or encoded as ordinary text.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";
import { tile, tileWidth, flow, showChar, showText, type TileStyle } from "./lib/token-tiles.ts";
import { RECORDS, SAMPLES, type PipeRecord } from "./data/tokenizer-pipeline.ts";

type TokKey = "xlmr" | "llama2" | "qwen25";
type SampleKey = (typeof SAMPLES)[number]["key"];
const K = { ordinary: 0, control: 1, inserted: 2, bytes: 3, unknown: 4 } as const;

const TOKENIZERS: Record<TokKey, { name: string; norm: { en: string; zh: string }; bound: { en: string; zh: string }; seg: { en: string; zh: string } }> = {
  xlmr: {
    name: "XLM-R",
    norm: { en: "SentencePiece NFKC-based map", zh: "SentencePiece 的 NFKC 映射" },
    bound: { en: "split at whitespace, ▁ marks a word start", zh: "按空白切分，▁ 标记词首" },
    seg: { en: "Unigram scores, 250,002 ids, no byte fallback", zh: "Unigram 分数，250,002 个 ID，无字节回退" },
  },
  llama2: {
    name: "Llama 2",
    norm: { en: "prepend ▁, spaces become ▁", zh: "开头加 ▁，空格替换为 ▁" },
    bound: { en: "none: one span between control tokens", zh: "无：控制词元之间整段处理" },
    seg: { en: "BPE ranks with byte fallback, 32,000 ids", zh: "BPE 排名加字节回退，32,000 个 ID" },
  },
  qwen25: {
    name: "Qwen2.5",
    norm: { en: "NFC", zh: "NFC" },
    bound: { en: "regex: letters, single digits, punctuation, spaces", zh: "正则：字母、单个数字、标点、空白" },
    seg: { en: "byte-level BPE ranks, 151,665 ids", zh: "字节级 BPE 排名，151,665 个 ID" },
  },
};

const labels = {
  en: {
    title: "One string through the tokenizer contract",
    sInput: "Input x",
    sNorm: "Normalization N",
    sBound: "Boundary rules",
    sSeg: "Segmentation and ids",
    sDec: "Decode",
    inputSub: "{n} code points, {b} UTF-8 bytes",
    normOff: "declared normalizer removed",
    same: "N(x) = x",
    changed: "{n:code point/code points} changed",
    pretokens: "{n:pretoken/pretokens}",
    idsSub: "{n:id/ids}, {i} inserted",
    eqX: "= x",
    eqN: "= N(x)",
    legendChanged: "changed by N",
    legendControl: "control id from input text",
    legendInserted: "inserted by the post-processor",
    legendBytes: "part of a character (bytes)",
    legendUnknown: "unknown <unk>",
    legendDiff: "differs from x",
    rowNote: "each tile: piece, id, offsets [start, end) in x",
    describe: "{tok}, input “{x}”: {norm}, {pre}, {ids}{extra}. Decode(Encode(x)) {eq}.",
    dNormSame: "normalization leaves it unchanged",
    dNormChanged: "normalization changes {n:code point/code points}",
    dNormOff: "no normalizer",
    dExtra: " ({parts})",
    dControl: "{n:control id/control ids} from text",
    dBytes: "{n:byte piece/byte pieces}",
    dUnknown: "{n:unknown/unknowns}",
    dEqBoth: "equals x",
    dEqN: "equals N(x) but not x",
    dEqNone: "equals neither x nor N(x)",
  },
  zh: {
    title: "一个字符串走过分词器契约",
    sInput: "输入 x",
    sNorm: "规范化 N",
    sBound: "边界规则",
    sSeg: "切分与 ID",
    sDec: "解码",
    inputSub: "{n} 个码位，{b} 个 UTF-8 字节",
    normOff: "已去掉声明的规范化器",
    same: "N(x) = x",
    changed: "{n} 个码位被改动",
    pretokens: "{n} 个预词元",
    idsSub: "{n} 个 ID，其中 {i} 个自动插入",
    eqX: "= x",
    eqN: "= N(x)",
    legendChanged: "被 N 改动",
    legendControl: "由输入文本得到的控制 ID",
    legendInserted: "后处理器插入",
    legendBytes: "字符的一部分（字节）",
    legendUnknown: "未知词元 <unk>",
    legendDiff: "与 x 不同",
    rowNote: "每格：片段、ID、在 x 中的偏移 [起, 止)",
    describe: "{tok}，输入“{x}”：{norm}，{pre}，{ids}{extra}。Decode(Encode(x)) {eq}。",
    dNormSame: "规范化没有改动",
    dNormChanged: "规范化改动 {n} 个码位",
    dNormOff: "没有规范化器",
    dExtra: "（{parts}）",
    dControl: "{n} 个来自文本的控制 ID",
    dBytes: "{n} 个字节片段",
    dUnknown: "{n} 个未知词元",
    dEqBoth: "等于 x",
    dEqN: "等于 N(x)，但不等于 x",
    dEqNone: "既不等于 x，也不等于 N(x)",
  },
};

type P = { tokenizer: TokKey; sample: SampleKey; normalize: boolean; control: boolean };

const sampleText = (k: SampleKey) => SAMPLES.find((s) => s.key === k)!.text;
function record(p: P): PipeRecord {
  return RECORDS[p.tokenizer][p.sample][`${p.normalize ? 1 : 0}${p.control ? 1 : 0}`];
}
const utf8 = (s: string) => new TextEncoder().encode(s).length;
const countOf = (r: PipeRecord, k: number) => r.t.filter((t) => t[5] === k).length;
const changedCount = (flags: string) => [...flags].filter((f) => f === "1").length;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = record(p);
  const x = sampleText(p.sample);
  const nChanged = changedCount(r.nf);
  const norm = !p.normalize ? L.dNormOff : nChanged ? tpl(L.dNormChanged, { n: nChanged }) : L.dNormSame;
  const parts: string[] = [];
  const c = countOf(r, K.control), b = countOf(r, K.bytes), u = countOf(r, K.unknown);
  if (c) parts.push(tpl(L.dControl, { n: c }));
  if (b) parts.push(tpl(L.dBytes, { n: b }));
  if (u) parts.push(tpl(L.dUnknown, { n: u }));
  return tpl(L.describe, {
    tok: TOKENIZERS[p.tokenizer].name, x: showText(x), norm,
    pre: tpl(L.pretokens, { n: r.p.length }),
    ids: tpl(L.idsSub, { n: r.t.length, i: countOf(r, K.inserted) }),
    extra: parts.length ? tpl(L.dExtra, { parts: parts.join(lang === "zh" ? "，" : ", ") }) : "",
    eq: r.eqX ? L.dEqBoth : r.eqN ? L.dEqN : L.dEqNone,
  });
}

// Styles by job. Tints stay light so labels in ink remain readable.
const STYLE: Record<string, TileStyle> = {
  changed: { fill: C.c2, opacity: 0.22, stroke: C.c2 },
  control: { fill: C.c5, opacity: 0.28, stroke: C.c5, strokeWidth: 1.5 },
  inserted: { fill: C.c3, opacity: 0.16, stroke: C.c3, dash: "3 2", strokeWidth: 1.5 },
  bytes: { fill: C.c4, opacity: 0.3, stroke: C.c4 },
  unknown: { fill: C.bad, opacity: 0.16, stroke: C.bad, strokeWidth: 1.5 },
  diff: { fill: C.bad, opacity: 0.16, stroke: C.bad },
};
const kindStyle = (k: number): TileStyle => (k === K.control ? STYLE.control : k === K.inserted ? STYLE.inserted : k === K.bytes ? STYLE.bytes : k === K.unknown ? STYLE.unknown : {});

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = record(p);
  const x = sampleText(p.sample);
  const info = TOKENIZERS[p.tokenizer];
  const fs = TYPE.body;
  const wrapT = (s: string, max: number, size: number = fs) => (lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max));
  const labelW = narrow ? 0 : 132;
  const cx = narrow ? 0 : labelW + 14;
  const cw = w - cx;
  const parts: string[] = [];
  const used = new Set<string>();
  let y = 0;

  // A stage: its name and a detail line in the left column (above the content
  // on a phone), then the content, then a rule.
  const stage = (name: string, sub: string, content: (y0: number) => number) => {
    const head: string[] = [];
    let hy = y + 14;
    head.push(text(0, hy, name, { "font-size": TYPE.label, class: "fig-t-strong" }));
    hy += 4;
    for (const line of wrapT(sub, narrow ? w : labelW)) {
      hy += 16;
      head.push(text(0, hy, line, { "font-size": fs, class: "fig-t-muted" }));
    }
    parts.push(...head);
    const top = narrow ? hy + 10 : y;
    const bottom = content(top);
    y = Math.max(narrow ? bottom : Math.max(bottom, hy + 4), top) + 12;
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    y += 12;
  };

  // A string as one tile per code point, flagged cells styled. A code point
  // outside ASCII carries its hex value under the glyph, so look-alikes such
  // as a full-width G and a plain G stay distinguishable.
  const cells = (s: string, flags: string, style: TileStyle) => (y0: number) => {
    const chars = [...s];
    const labs = chars.map(showChar);
    const hex = chars.map((ch) => (ch.codePointAt(0)! > 0x7f ? ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0") : ""));
    const tall = hex.some(Boolean);
    const ws = labs.map((l, i) => Math.max(tileWidth(l, fs, 18), hex[i] ? tileWidth(hex[i], fs) : 0));
    const lay = flow(ws, cw, 2);
    const th = tall ? 36 : 22;
    chars.forEach((_, i) => {
      const on = flags[i] === "1";
      const x0 = cx + lay.at[i].x, y1 = y0 + lay.at[i].row * (th + 4);
      if (!tall) {
        parts.push(tile(x0, y1, ws[i], th, labs[i], fs, on ? style : {}));
        return;
      }
      parts.push(tile(x0, y1, ws[i], th, "", fs, on ? style : {}));
      parts.push(text(x0 + ws[i] / 2, y1 + 15, labs[i], { "font-size": fs, "text-anchor": "middle" }));
      if (hex[i]) parts.push(text(x0 + ws[i] / 2, y1 + 30, hex[i], { "font-size": fs, "text-anchor": "middle", class: "fig-t-num fig-t-faint" }));
    });
    return y0 + lay.rows * (th + 4) - 4;
  };

  // ---- input
  const xChanged = changedCount(r.xf);
  if (p.normalize && xChanged) used.add("changed");
  stage(L.sInput, tpl(L.inputSub, { n: [...x].length, b: utf8(x) }), cells(x, p.normalize ? r.xf : "", STYLE.changed));

  // ---- normalization
  const nChanged = changedCount(r.nf);
  const normSub = !p.normalize ? L.normOff : `${info.norm[lang]}; ${nChanged ? tpl(L.changed, { n: nChanged }) : L.same}`;
  stage(L.sNorm, normSub, cells(r.n, p.normalize ? r.nf : "", STYLE.changed));

  // ---- boundary rules: the pretokens, control spans marked
  const controlWords = new Set(r.t.filter((t) => t[5] === K.control).map((t) => t[4]));
  stage(L.sBound, `${info.bound[lang]}; ${tpl(L.pretokens, { n: r.p.length })}`, (y0) => {
    const labs = r.p.map(showText);
    const ws = labs.map((l) => tileWidth(l, fs, 18));
    const lay = flow(ws, cw, 6);
    const th = 22;
    labs.forEach((l, i) => {
      const s = controlWords.has(i) ? STYLE.control : {};
      if (controlWords.has(i)) used.add("control");
      parts.push(tile(cx + lay.at[i].x, y0 + lay.at[i].row * (th + 6), ws[i], th, l, fs, s));
    });
    return y0 + lay.rows * (th + 6) - 6;
  });

  // ---- segmentation and ids: piece, id, offsets per tile, grouped by pretoken
  const inserted = countOf(r, K.inserted);
  stage(L.sSeg, `${info.seg[lang]}; ${tpl(L.idsSub, { n: r.t.length, i: inserted })}`, (y0) => {
    const th = 50;
    const lines = r.t.map((t) => ({ piece: showText(t[0]), id: String(t[1]), off: `${t[2]}–${t[3]}` }));
    const ws = lines.map((l) => Math.max(tileWidth(l.piece, fs), tileWidth(l.id, fs), tileWidth(l.off, fs), 26));
    const brk = r.t.map((t, i) => i > 0 && t[4] !== r.t[i - 1][4]);
    const lay = flow(ws, cw, 2, brk, 6);
    r.t.forEach((t, i) => {
      const x0 = cx + lay.at[i].x, y1 = y0 + lay.at[i].row * (th + 6);
      const s = kindStyle(t[5]);
      if (t[5] === K.inserted) used.add("inserted");
      if (t[5] === K.control) used.add("control");
      if (t[5] === K.bytes) used.add("bytes");
      if (t[5] === K.unknown) used.add("unknown");
      parts.push(tile(x0, y1, ws[i], th, "", fs, s));
      parts.push(text(x0 + ws[i] / 2, y1 + 15, lines[i].piece, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
      parts.push(text(x0 + ws[i] / 2, y1 + 30, lines[i].id, { "font-size": fs, "text-anchor": "middle", class: "fig-t-num" }));
      parts.push(text(x0 + ws[i] / 2, y1 + 44, lines[i].off, { "font-size": fs, "text-anchor": "middle", class: "fig-t-num fig-t-faint" }));
    });
    let yy = y0 + lay.rows * (th + 6) + 8;
    for (const line of wrapT(L.rowNote, cw)) {
      parts.push(text(cx, yy, line, { "font-size": fs, class: "fig-t-muted" }));
      yy += 16;
    }
    return yy - 12;
  });

  // ---- decode, with the round-trip check against x and N(x)
  const dDiff = changedCount(r.df);
  if (dDiff) used.add("diff");
  const check = (y0: number) => {
    const end = cells(r.d, r.df, STYLE.diff)(y0);
    let xx = cx;
    const yy = end + 22;
    for (const [lab, ok] of [[`Decode(Encode(x)) ${L.eqX}`, r.eqX], [L.eqN, r.eqN]] as const) {
      parts.push(el("circle", { cx: xx + 7, cy: yy - 4, r: 7.5, fill: ok ? C.good : C.bad }));
      parts.push(text(xx + 7, yy, ok ? "✓" : "×", { "font-size": 12, "text-anchor": "middle", fill: C.paper, class: "fig-t-strong" }));
      parts.push(text(xx + 20, yy, lab, { "font-size": fs, class: "fig-t-strong" }));
      xx += 20 + textWidth(lab, fs) + 18;
    }
    return yy + 2;
  };
  stage(L.sDec, "", check);

  // ---- legend: only the styles this state uses
  const items: Array<[string, TileStyle]> = [];
  if (used.has("changed")) items.push([L.legendChanged, STYLE.changed]);
  if (used.has("control")) items.push([L.legendControl, STYLE.control]);
  if (used.has("inserted")) items.push([L.legendInserted, STYLE.inserted]);
  if (used.has("bytes")) items.push([L.legendBytes, STYLE.bytes]);
  if (used.has("unknown")) items.push([L.legendUnknown, STYLE.unknown]);
  if (used.has("diff")) items.push([L.legendDiff, STYLE.diff]);
  const ws = items.map(([l]) => 22 + textWidth(l, fs));
  const lay = flow(ws, w, 16);
  items.forEach(([l, s], i) => {
    const lx = lay.at[i].x, ly = y + lay.at[i].row * 20;
    parts.push(tile(lx, ly, 16, 13, "", fs, s));
    parts.push(text(lx + 22, ly + 11, l, { "font-size": fs, class: "fig-t-muted" }));
  });
  const h = y + (items.length ? lay.rows * 20 : 0);
  return svg(w, h, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "tokenizer-pipeline",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    tokenizer: {
      kind: "choice", label: { en: "Tokenizer", zh: "分词器" }, default: "xlmr",
      options: [
        { value: "xlmr", label: { en: "XLM-R (Unigram)", zh: "XLM-R（Unigram）" } },
        { value: "llama2", label: { en: "Llama 2 (BPE, byte fallback)", zh: "Llama 2（BPE，字节回退）" } },
        { value: "qwen25", label: { en: "Qwen2.5 (byte-level BPE)", zh: "Qwen2.5（字节级 BPE）" } },
      ],
    },
    sample: {
      kind: "choice", control: "select", label: { en: "Input", zh: "输入" }, default: "compat",
      options: [
        { value: "compat", label: { en: "Compatibility forms: ﬁle ＧＰＵ ２４ＧＢ", zh: "兼容字符：ﬁle ＧＰＵ ２４ＧＢ" } },
        { value: "combining", label: { en: "Combining accent: Cafe + ◌́, naïve", zh: "组合附加符号：Cafe + ◌́，naïve" } },
        { value: "chinese", label: { en: "Chinese: 小猫坐在垫子上，它很累。", zh: "中文：小猫坐在垫子上，它很累。" } },
        { value: "emoji", label: { en: "Emoji with a joiner: 👩‍💻 ok 🐍", zh: "带连接符的 emoji：👩‍💻 ok 🐍" } },
        { value: "code", label: { en: "Code: indentation, newline, tab", zh: "代码：缩进、换行、制表符" } },
        { value: "digits", label: { en: "Digits: Pay 12345.67 in 2024", zh: "数字：Pay 12345.67 in 2024" } },
        { value: "control", label: { en: "Literal control text: </s>, <|endoftext|>", zh: "控制词元的字面文本：</s>、<|endoftext|>" } },
      ],
    },
    normalize: { kind: "toggle", label: { en: "Apply the declared normalizer", zh: "应用声明的规范化器" }, default: true },
    control: { kind: "toggle", label: { en: "Parse control-token text as control ids", zh: "把控制词元文本解析为控制 ID" }, default: true },
  },
  render,
  describe,
});
