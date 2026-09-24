// BPE training and encoding, one merge per timeline step, on the corpus of the
// chapter's runnable cell: "low low low lo lower newest widest", every word a
// pretoken ending in the end-of-word marker </w>. The trainer is the cell's:
// count adjacent symbol pairs weighted by pretoken frequency, select the
// highest count with a deterministic tie-break, replace every non-overlapping
// occurrence, append the pair to the merge table, eight times. The cell breaks
// ties in lexical order; the figure also offers reverse lexical order and
// first occurrence in corpus order, which learn different tables from the same
// counts.
//
// Encoding is the cell's encode_word: map characters outside the training
// alphabet to <unk>, then apply the learned merges in rank order. The state at
// step t is a pure function of t: t merges learned, the counts for merge t + 1.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";
import { tile, tileWidth } from "./lib/token-tiles.ts";

const EOW = "</w>";
const UNK = "<unk>";
const CORPUS = "low low low lo lower newest widest".split(" ");
const MERGES = 8;
type Rule = "lexical" | "reverse" | "first";
type Pair = [string, string];

// ---------------------------------------------------------------- training

const cmp = (a: Pair, b: Pair) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const key = (p: Pair) => `${p[0]}\u0000${p[1]}`;

function mergePair(symbols: string[], pair: Pair): string[] {
  const out: string[] = [];
  for (let i = 0; i < symbols.length;) {
    if (i + 1 < symbols.length && symbols[i] === pair[0] && symbols[i + 1] === pair[1]) {
      out.push(pair[0] + pair[1]);
      i += 2;
    } else out.push(symbols[i++]);
  }
  return out;
}

interface PairCount { pair: Pair; count: number; first: number }
interface Step {
  words: string[][]; // one entry per distinct pretoken, in corpus order
  counts: PairCount[]; // sorted: count descending, then the tie-break order
  pick: PairCount | null; // the pair merge t + 1 selects
  tied: number; // pairs sharing the top count
}
interface Training { types: Array<{ word: string; weight: number }>; steps: Step[]; merges: Array<{ pair: Pair; count: number; tied: number }>; alphabet: Set<string> }

const memo = new Map<Rule, Training>();
function train(rule: Rule): Training {
  const hit = memo.get(rule);
  if (hit) return hit;
  const types: Array<{ word: string; weight: number }> = [];
  for (const w of CORPUS) {
    const t = types.find((x) => x.word === w);
    if (t) t.weight++; else types.push({ word: w, weight: 1 });
  }
  let words = types.map((t) => [...t.word, EOW]);
  const steps: Step[] = [];
  const merges: Training["merges"] = [];
  for (let s = 0; s <= MERGES; s++) {
    const m = new Map<string, PairCount>();
    let seen = 0;
    words.forEach((sym, wi) => {
      for (let i = 0; i + 1 < sym.length; i++) {
        const p: Pair = [sym[i], sym[i + 1]];
        const k = key(p);
        const e = m.get(k);
        if (e) e.count += types[wi].weight; else m.set(k, { pair: p, count: types[wi].weight, first: seen++ });
      }
    });
    const order = (a: PairCount, b: PairCount) => rule === "lexical" ? cmp(a.pair, b.pair) : rule === "reverse" ? cmp(b.pair, a.pair) : a.first - b.first;
    const counts = [...m.values()].sort((a, b) => b.count - a.count || order(a, b));
    const pick = s < MERGES && counts.length ? counts[0] : null;
    const tied = counts.filter((c) => counts.length && c.count === counts[0].count).length;
    steps.push({ words, counts, pick, tied });
    if (pick) {
      merges.push({ pair: pick.pair, count: pick.count, tied });
      words = words.map((sym) => mergePair(sym, pick.pair));
    }
  }
  const out = { types, steps, merges, alphabet: new Set(CORPUS.join("")) };
  memo.set(rule, out);
  return out;
}

// encode_word with the first t ranks: the symbols before, and after every rank
// that changes them.
function encode(word: string, tr: Training, t: number) {
  let sym = [...word].map((ch) => (tr.alphabet.has(ch) ? ch : UNK)).concat(EOW);
  const rows: Array<{ rank: number; symbols: string[]; made: string }> = [{ rank: 0, symbols: sym, made: "" }];
  for (let r = 1; r <= t; r++) {
    const pair = tr.merges[r - 1].pair;
    const next = mergePair(sym, pair);
    if (next.length !== sym.length) rows.push({ rank: r, symbols: next, made: pair[0] + pair[1] });
    sym = next;
  }
  return rows;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "BPE merges learned one at a time",
    corpus: "Corpus after {t:merge/merges}",
    weight: "×{n}",
    counts: "Pair counts for merge {k}",
    countsDone: "Pair counts after {n} merges; the trainer stops here",
    tie: "{n} pairs tie at {c}; {rule} picks {pair}",
    unique: "{pair} is the only pair at {c}",
    more: "+ {n} more at {c}",
    table: "Merge table, in rank order",
    encode: "Encoding “{w}” with ranks 1 to {t}",
    encode0: "Encoding “{w}”: no ranks learned yet",
    start: "start",
    pieces: "{n:piece/pieces}",
    unkNote: "“{ch}” is not in the training alphabet, so it becomes <unk>",
    lexical: "lexical order",
    reverse: "reverse lexical order",
    first: "first occurrence",
    legendNext: "pair the next merge joins",
    legendNew: "symbol the last merge made",
    kfStart: "Count pairs over the base symbols",
    kfMerge: "{pair} → {made}, the only pair at {c}",
    kfTie: "{pair} → {made}, picked from {n} pairs tied at {c}",
    describe: "After {t:merge/merges} the merge table holds {table}. {next} “{w}” encodes as {pieces}.",
    describeNext: "The next merge joins {pair} at count {c}{tie}.",
    describeTie: ", chosen by {rule} among {n} tied pairs",
    describeDone: "Training stops after eight merges.",
    none: "no merges",
  },
  zh: {
    title: "逐次学习的 BPE 合并",
    corpus: "{t} 次合并后的语料",
    weight: "×{n}",
    counts: "第 {k} 次合并前的符号对计数",
    countsDone: "{n} 次合并后的计数，训练到此结束",
    tie: "{n} 个符号对并列 {c} 次，按{rule}选 {pair}",
    unique: "只有 {pair} 出现 {c} 次",
    more: "另有 {n} 对各 {c} 次",
    table: "合并表（按排名）",
    encode: "用第 1 至 {t} 名编码“{w}”",
    encode0: "编码“{w}”：尚未学到合并",
    start: "起点",
    pieces: "{n} 个片段",
    unkNote: "“{ch}”不在训练字母表中，变成 <unk>",
    lexical: "字典序",
    reverse: "逆字典序",
    first: "首次出现顺序",
    legendNext: "下一次合并的符号对",
    legendNew: "上一次合并产生的符号",
    kfStart: "在基础符号上统计符号对",
    kfMerge: "{pair} → {made}，唯一计数为 {c} 的符号对",
    kfTie: "{pair} → {made}，从 {n} 个并列 {c} 次的符号对中选出",
    describe: "{t} 次合并后，合并表为 {table}。{next}“{w}”编码为 {pieces}。",
    describeNext: "下一次合并 {pair}，计数 {c}{tie}。",
    describeTie: "，在 {n} 个并列符号对中按{rule}选出",
    describeDone: "训练在八次合并后结束。",
    none: "空",
  },
};

type P = { rule: Rule; word: string };

const pairText = (p: Pair) => `${p[0]} + ${p[1]}`;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const tr = train(st.p.rule);
  const t = Math.round(st.t);
  const step = tr.steps[t];
  const table = t ? tr.merges.slice(0, t).map((m, i) => `${i + 1}. ${m.pair[0]}${m.pair[1]}`).join(lang === "zh" ? "、" : ", ") : L.none;
  const next = step.pick
    ? tpl(L.describeNext, { pair: pairText(step.pick.pair), c: step.pick.count, tie: step.tied > 1 ? tpl(L.describeTie, { rule: L[st.p.rule], n: step.tied }) : "" })
    : L.describeDone;
  const rows = encode(st.p.word, tr, t);
  const last = rows[rows.length - 1].symbols;
  return tpl(L.describe, { t, table, next, w: st.p.word, pieces: last.join(" ") });
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const tr = train(p.rule);
  const t = Math.max(0, Math.min(MERGES, Math.round(st.t)));
  const step = tr.steps[t];
  const made = t ? tr.merges[t - 1].pair.join("") : "";
  const fs = TYPE.body;
  const th = 22; // tile height
  const wrapT = (s: string, max: number) => (lang === "zh" ? wrapCjk(s, fs, max) : wrap(s, fs, max));
  const parts: string[] = [];

  const colGap = 28;
  const leftW = narrow ? w : Math.floor((w - colGap) * 0.54);
  const rightX = narrow ? 0 : leftW + colGap;
  const rightW = narrow ? w : w - rightX;

  // ---- corpus: each distinct pretoken as symbol tiles, with its weight
  let y = 0;
  const A: string[] = [];
  A.push(text(0, y + 14, tpl(L.corpus, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 26;
  const weightW = 28;
  for (let wi = 0; wi < tr.types.length; wi++) {
    const sym = step.words[wi];
    A.push(text(0, y + th / 2 + fs * 0.36, tpl(L.weight, { n: tr.types[wi].weight }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    let x = weightW;
    const xs: number[] = [];
    const ws = sym.map((s) => tileWidth(s, fs, 20));
    for (let i = 0; i < sym.length; i++) {
      xs.push(x);
      const isNew = t > 0 && sym[i] === made;
      A.push(tile(x, y, ws[i], th, sym[i], fs, isNew ? { fill: C.c2, opacity: 0.22, stroke: C.c2 } : {}));
      x += ws[i] + 3;
    }
    // Outline every non-overlapping occurrence of the pair the next merge joins.
    if (step.pick) {
      const [a, b] = step.pick.pair;
      for (let i = 0; i + 1 < sym.length; i++) {
        if (sym[i] === a && sym[i + 1] === b) {
          A.push(el("rect", { x: xs[i] - 2.5, y: y - 2.5, width: xs[i + 1] + ws[i + 1] - xs[i] + 5, height: th + 5, rx: 5, fill: "none", stroke: C.c1, "stroke-width": 2 }));
          i++;
        }
      }
    }
    y += th + 8;
  }
  // Legend for the two highlights.
  y += 6;
  const lg = [
    el("rect", { x: 0, y: y - 10, width: 16, height: 12, rx: 3, fill: "none", stroke: C.c1, "stroke-width": 2 }),
    text(22, y, L.legendNext, { "font-size": fs, class: "fig-t-muted" }),
  ];
  const l2x = narrow ? 0 : 22 + textWidth(L.legendNext, fs) + 16;
  const l2y = narrow ? y + 18 : y;
  if (!narrow && l2x + 22 + textWidth(L.legendNew, fs) > leftW) {
    // Too wide for one line: stack the second entry.
    lg.push(el("rect", { x: 0, y: y + 8, width: 16, height: 12, rx: 3, fill: C.c2, "fill-opacity": 0.22, stroke: C.c2 }), text(22, y + 18, L.legendNew, { "font-size": fs, class: "fig-t-muted" }));
    y += 18;
  } else {
    lg.push(el("rect", { x: l2x, y: l2y - 10, width: 16, height: 12, rx: 3, fill: C.c2, "fill-opacity": 0.22, stroke: C.c2 }), text(l2x + 22, l2y, L.legendNew, { "font-size": fs, class: "fig-t-muted" }));
    if (narrow) y += 18;
  }
  A.push(...lg);
  y += 26;

  // ---- pair counts for the next merge
  const shownPairs = narrow ? 5 : 6;
  A.push(text(0, y + 14, step.pick ? tpl(L.counts, { k: t + 1 }) : tpl(L.countsDone, { n: MERGES }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 26;
  const labelW = Math.max(...step.counts.slice(0, shownPairs).map((c) => textWidth(pairText(c.pair), fs))) + 10;
  const numW = 22;
  const barX = labelW;
  const barW = Math.max(40, leftW - labelW - numW - 6);
  const top = step.counts.length ? step.counts[0].count : 1;
  const maxCount = tr.steps[0].counts[0].count; // bars keep the first step's scale across steps
  const rowH = 20;
  for (const [i, c] of step.counts.slice(0, shownPairs).entries()) {
    const yy = y + i * rowH;
    const chosen = step.pick !== null && i === 0;
    const tiedWith = !chosen && step.pick !== null && c.count === top;
    A.push(text(0, yy + 13, pairText(c.pair), { "font-size": fs, class: chosen ? "fig-t-strong" : undefined }));
    A.push(el("rect", { x: barX, y: yy + 3, width: barW, height: rowH - 7, rx: 3, fill: C.panel }));
    A.push(el("rect", { x: barX, y: yy + 3, width: Math.max(2, (c.count / maxCount) * barW), height: rowH - 7, rx: 3, fill: chosen || tiedWith ? C.c1 : C.ink3, "fill-opacity": chosen ? 1 : tiedWith ? 0.4 : 0.35 }));
    A.push(text(leftW, yy + 13, c.count, { "font-size": fs, "text-anchor": "end", class: `fig-t-num${chosen ? " fig-t-strong" : ""}` }));
  }
  y += Math.min(shownPairs, step.counts.length) * rowH + 4;
  const rest = step.counts.slice(shownPairs);
  if (rest.length) {
    const c = rest[0].count;
    const n = rest.filter((r) => r.count === c).length;
    A.push(text(0, y + 12, tpl(L.more, { n, c }), { "font-size": fs, class: "fig-t-muted" }));
    y += 18;
  }
  if (step.pick) {
    const line = step.tied > 1
      ? tpl(L.tie, { n: step.tied, c: step.pick.count, rule: L[p.rule], pair: pairText(step.pick.pair) })
      : tpl(L.unique, { pair: pairText(step.pick.pair), c: step.pick.count });
    for (const part of wrapT(line, leftW)) {
      A.push(text(0, y + 14, part, { "font-size": fs, class: step.tied > 1 ? "fig-t-strong" : "fig-t-muted" }));
      y += 17;
    }
  }
  const leftH = y;
  parts.push(g({ class: "fig-train" }, ...A));

  // ---- merge table and the encoding of a word
  let ry = narrow ? leftH + 24 : 0;
  const B: string[] = [];
  B.push(text(rightX, ry + 14, L.table, { "font-size": TYPE.label, class: "fig-t-strong" }));
  ry += 24;
  const mrow = 19;
  for (let r = 1; r <= MERGES; r++) {
    const yy = ry + (r - 1) * mrow;
    const learned = r <= t;
    const latest = r === t;
    B.push(text(rightX + 14, yy + 13, r, { "font-size": fs, "text-anchor": "end", class: `fig-t-num ${learned ? (latest ? "fig-t-strong" : "fig-t-muted") : "fig-t-faint"}` }));
    if (learned) {
      const m = tr.merges[r - 1];
      B.push(text(rightX + 24, yy + 13, `${pairText(m.pair)} → ${m.pair.join("")}`, { "font-size": fs, class: latest ? "fig-t-strong" : undefined }));
      B.push(text(rightX + rightW, yy + 13, `×${m.count}`, { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    } else {
      B.push(el("line", { x1: rightX + 24, x2: rightX + rightW, y1: yy + 9, y2: yy + 9, stroke: C.grid, "stroke-width": 1 }));
    }
  }
  ry += MERGES * mrow + 18;

  // Height reserved for the encoding: its rows at the last step, so the layout
  // does not move while the timeline plays.
  const full = encode(p.word, tr, MERGES);
  const rows = encode(p.word, tr, t);
  const head = t ? tpl(L.encode, { w: p.word, t }) : tpl(L.encode0, { w: p.word });
  for (const part of wrapT(head, rightW)) {
    B.push(text(rightX, ry + 14, part, { "font-size": TYPE.label, class: "fig-t-strong" }));
    ry += 18;
  }
  ry += 8;
  const rankW = textWidth(L.start, fs) + 10;
  const erow = th + 6;
  for (const [i, r] of rows.entries()) {
    const yy = ry + i * erow;
    const last = i === rows.length - 1;
    B.push(text(rightX, yy + th / 2 + fs * 0.36, r.rank ? String(r.rank) : L.start, { "font-size": fs, class: `fig-t-num ${last ? "fig-t-strong" : "fig-t-muted"}` }));
    let x = rightX + rankW;
    for (const s of r.symbols) {
      const tw = tileWidth(s, fs, 20);
      const style = s === UNK ? { stroke: C.bad, strokeWidth: 1.5 } : r.made && s === r.made ? { fill: C.c2, opacity: 0.22, stroke: C.c2 } : {};
      B.push(tile(x, yy, tw, th, s, fs, style));
      x += tw + 3;
    }
    if (last) B.push(text(rightX + rightW, yy + th / 2 + fs * 0.36, tpl(L.pieces, { n: r.symbols.length }), { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-strong" }));
  }
  ry += full.length * erow + 4;
  const unseen = [...p.word].find((ch) => !tr.alphabet.has(ch));
  if (unseen) {
    for (const part of wrapT(tpl(L.unkNote, { ch: unseen }), rightW)) {
      B.push(text(rightX, ry + 12, part, { "font-size": fs, class: "fig-t-muted" }));
      ry += 17;
    }
  }
  parts.push(g({ class: "fig-table" }, ...B));
  const h = Math.max(leftH, ry) + 6;
  return svg(w, h, describe(st, lang), ...parts);
}

const WORDS = ["lower", "lowest", "newer", "lobster"] as const;

export default defineFigure({
  name: "bpe-merges",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    rule: {
      kind: "choice", label: { en: "Tie-break", zh: "平局规则" }, default: "lexical",
      options: [
        { value: "lexical", label: { en: "Lexical (the code)", zh: "字典序（代码）" } },
        { value: "reverse", label: { en: "Reverse lexical", zh: "逆字典序" } },
        { value: "first", label: { en: "First occurrence", zh: "首次出现" } },
      ],
    },
    word: {
      kind: "choice", control: "buttons", label: { en: "Encode", zh: "编码" }, default: "lowest",
      options: WORDS.map((v) => ({ value: v, label: { en: v, zh: v } })),
    },
  },
  timeline: {
    rate: 1,
    discrete: true,
    duration: () => MERGES,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const tr = train(p.rule);
      return [{ t: 0, label: L.kfStart }, ...tr.merges.map((m, i) => ({
        t: i + 1,
        label: tpl(m.tied > 1 ? L.kfTie : L.kfMerge, { pair: pairText(m.pair), made: m.pair.join(""), n: m.tied, c: m.count }),
      }))];
    },
    // After three merges: the next choice is a three-way tie at count 2, where
    // the tie-break rule decides the table.
    poster: () => 3,
  },
  render,
  describe,
});
