// Constrained decoding of one JSON object, step by step, on a real model.
//
// Qwen2.5-0.5B decodes one extraction prompt greedily three ways (data from
// tools/figure-data/constrained-decoding.py, in data/constrained-decoding.ts):
//
// - free: no grammar. The parser only watches, and the output leaves the
//   schema where the model writes "born" as a string.
// - mask: the chapter's grammar-constrained sampling. At every step the parser
//   configuration s_t (state and stack) and the tokenizer's byte table give
//   the admissible set A(s_t), and the sampler takes the argmax of
//     p_G(v) = p(v) 1[v ∈ A(s_t)] / Z,   Z = Σ_{u ∈ A(s_t)} p(u).
// - jump: the same grammar with jump-forward. Where the parser admits a single
//   continuation, the runtime appends those bytes, retokenizes the generated
//   text, and commits the changed tokens in one extend pass, recomputing any
//   cached token the retokenization replaced.
//
// The timeline is the step index of the chosen run: a decode step (one model
// pass, one sampled token) or an extend step (one model pass, several forced
// tokens). Every probability is the model's own; nothing is illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { int, sig, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";
import { RUNS, VOCAB, PROMPT, type DecodeStep, type ExtendStep, type ParserState, type Run } from "./data/constrained-decoding.ts";

type Mode = "free" | "mask" | "jump";
type P = { mode: Mode };

const labels = {
  en: {
    title: "Constrained decoding of one JSON object",
    input: "Input: {text}",
    schema: "Schema: {\"name\": string, \"born\": {\"year\": integer, \"city\": string}}",
    output: "Output after step {t}",
    sampled: "sampled at a branch",
    fixed: "inside a fixed span",
    extended: "one extend pass",
    broken: "breaks the schema",
    loose: "written after the break",
    parser: "Parser configuration",
    stStart: "Before the root value: an optional space, then {",
    stLit: "Fixed span: the only admissible bytes are {rest}",
    stStr: "Inside the string value of “{f}”: any character, or \" to close it",
    stIntStart: "Start of the integer value of “{f}”: a digit or -",
    stIntDigits: "Inside the integer value of “{f}”: a digit, or , to end it",
    stIntZero: "After a leading 0 in “{f}”: only , can follow",
    stEnd: "Document complete: only end of sequence is admissible",
    stDead: "No parser state: the output left the schema at step {s}",
    stack: "Stack, top first",
    stackEmpty: "empty",
    frRoot: "object (root)",
    frBorn: "object “born”",
    frStr: "string “{f}”",
    frInt: "integer “{f}”",
    admissible: "{n} of {v} tokens admissible",
    consumes: "⟨{tok}⟩ consumes {b:byte/bytes}, one parser transition each",
    dist: "Next-token distribution at step {t}",
    colTok: "token v",
    colP: "p(v)",
    colMask: "1[v∈A]",
    colPG: "p_G(v)",
    colSchema: "schema",
    otherA: "other admissible",
    otherM: "other masked",
    otherAll: "all other tokens",
    zLine: "Z = Σ p(u) over A(s_t) = {z}",
    pgLine: "p_G(⟨{tok}⟩) = {p} / {z} = {pg}",
    freeLine: "No grammar: the sampler takes the most probable token, ⟨{tok}⟩",
    violation: "⟨{tok}⟩ breaks the schema: the parser admits only {rest} here",
    ext: "Extend pass at step {t}",
    extForced: "Forced bytes: {f}",
    extTokens: "Retokenized and committed in one model pass:",
    extRecomp: "Retokenizing replaced the cached ⟨{old}⟩: {r:token/tokens} recomputed",
    extNone: "No cached token changes; the pass only appends",
    passesMask: "Model passes so far: {n}, one decode step per token",
    passesJump: "Model passes so far: {n} ({d} decode, {e} extend)",
    passesFree: "Model passes so far: {n}",
    valid: "The output parses against the schema.",
    invalid: "Valid JSON, but “born” holds a string and “year” and “city” sit at the top level: the schema rejects it.",
    kfBytes: "⟨{tok}⟩ crosses {b} parser transitions in one token",
    kfMasked: "The model's top token ⟨{tok}⟩ (p = {p}) is masked; Z = {z}",
    kfViolation: "Without a grammar the model starts a string with ⟨{tok}⟩; the schema requires {rest}",
    kfEos: "End of sequence, admissible only once the document is complete",
    kfEosFree: "End of sequence: the output breaks the schema",
    kfExtend: "Jump forward: {k:token/tokens} of forced bytes in one pass",
    kfRetok: "Jump forward: retokenizing replaces a cached token",
    modeFree: "no grammar",
    modeMask: "grammar mask",
    modeJump: "grammar mask with jump-forward",
    dDecode: "Step {t} of {d}, {mode}: {state}. {n} of {v} tokens are admissible and hold Z = {z} of the model's probability; the sampler commits ⟨{tok}⟩ with p = {p} and p_G = {pg}.",
    dFree: "Step {t} of {d}, {mode}: the model commits ⟨{tok}⟩ with p = {p}.{bad}",
    dBad: " This token breaks the schema.",
    dExtend: "Step {t} of {d}, {mode}: the forced bytes {f} enter in one extend pass as {k:token/tokens}; {r:cached token is/cached tokens are} recomputed.",
  },
  zh: {
    title: "逐步约束解码一个 JSON 对象",
    input: "输入：{text}",
    schema: "Schema：{\"name\": string, \"born\": {\"year\": integer, \"city\": string}}",
    output: "第 {t} 步之后的输出",
    sampled: "在分支处采样",
    fixed: "位于确定跨度内",
    extended: "一次扩展计算",
    broken: "违反 schema",
    loose: "违反之后写出",
    parser: "解析器配置",
    stStart: "根值之前：可有一个空格，然后是 {",
    stLit: "确定跨度：只允许字节 {rest}",
    stStr: "“{f}”的字符串值内部：任意字符，或用 \" 结束",
    stIntStart: "“{f}”的整数值开头：一位数字或 -",
    stIntDigits: "“{f}”的整数值内部：再一位数字，或用 , 结束",
    stIntZero: "“{f}”以 0 开头：后面只能是 ,",
    stEnd: "文档已完整：只允许结束序列词元",
    stDead: "解析器已无状态：输出在第 {s} 步离开了 schema",
    stack: "栈（栈顶在上）",
    stackEmpty: "空",
    frRoot: "对象（根）",
    frBorn: "对象“born”",
    frStr: "字符串“{f}”",
    frInt: "整数“{f}”",
    admissible: "{v} 个词元中允许 {n} 个",
    consumes: "⟨{tok}⟩包含 {b} 个字节，每个字节是解析器的一次转移",
    dist: "第 {t} 步的下一词元分布",
    colTok: "词元 v",
    colP: "p(v)",
    colMask: "1[v∈A]",
    colPG: "p_G(v)",
    colSchema: "schema",
    otherA: "其余允许词元",
    otherM: "其余被屏蔽词元",
    otherAll: "其余全部词元",
    zLine: "Z = A(s_t) 上的 Σ p(u) = {z}",
    pgLine: "p_G(⟨{tok}⟩) = {p} / {z} = {pg}",
    freeLine: "不加语法：采样器直接取概率最高的词元⟨{tok}⟩",
    violation: "⟨{tok}⟩违反 schema：此处解析器只允许 {rest}",
    ext: "第 {t} 步的扩展计算",
    extForced: "强制字节：{f}",
    extTokens: "重新分词后，一次模型计算提交：",
    extRecomp: "重新分词替换了已缓存的⟨{old}⟩：重算 {r} 个词元",
    extNone: "已缓存的词元没有变化，这次计算只做追加",
    passesMask: "目前的模型计算次数：{n}，每个词元一次解码",
    passesJump: "目前的模型计算次数：{n}（解码 {d} 次，扩展 {e} 次）",
    passesFree: "目前的模型计算次数：{n}",
    valid: "输出符合 schema。",
    invalid: "输出是合法 JSON，但“born”是字符串，“year”和“city”落在顶层，schema 不接受。",
    kfBytes: "一个词元⟨{tok}⟩跨过 {b} 次解析器转移",
    kfMasked: "模型的首选词元⟨{tok}⟩（p = {p}）被屏蔽，Z = {z}",
    kfViolation: "不加语法时模型用⟨{tok}⟩开始写字符串，schema 要求 {rest}",
    kfEos: "结束序列词元，只有文档完整后才允许",
    kfEosFree: "结束序列：输出不符合 schema",
    kfExtend: "跳跃式处理：{k} 个强制词元一次计算完成",
    kfRetok: "跳跃式处理：重新分词替换了一个已缓存的词元",
    modeFree: "不加语法",
    modeMask: "语法掩码",
    modeJump: "语法掩码加跳跃式处理",
    dDecode: "第 {t} 步（共 {d} 步），{mode}：{state}。允许 {v} 个词元中的 {n} 个，它们占模型概率 Z = {z}；采样器提交⟨{tok}⟩，p = {p}，p_G = {pg}。",
    dFree: "第 {t} 步（共 {d} 步），{mode}：模型提交⟨{tok}⟩，p = {p}。{bad}",
    dBad: "这个词元违反 schema。",
    dExtend: "第 {t} 步（共 {d} 步），{mode}：强制字节 {f} 以 {k} 个词元一次扩展计算写入；重算 {r} 个已缓存词元。",
  },
};
type Labels = typeof labels.en;

// Visible whitespace for tokens: a space is ␣, a newline ↵.
const vis = (s: string) => (s === "<eos>" ? "EOS" : s.replace(/ /g, "␣").replace(/\n/g, "↵"));

function fmtP(v: number): string {
  if (v >= 0.995) return sig(v, 3);
  if (v >= 0.001) return sig(v, 2);
  if (v === 0) return "0";
  return sci(v, 2);
}

const ACCEPT_REST = (st: ParserState | null) => (st && st.kind === "lit" ? st.rest : "");

function stateText(st: ParserState | null, L: Labels, violationAt: number): string {
  if (!st) return tpl(L.stDead, { s: violationAt });
  switch (st.kind) {
    case "start": return L.stStart;
    case "lit": return tpl(L.stLit, { rest: vis(st.rest) });
    case "str": return tpl(L.stStr, { f: st.field });
    case "int": return tpl(st.detail === "digits" ? L.stIntDigits : st.detail === "zero" ? L.stIntZero : L.stIntStart, { f: st.field });
    case "end": return L.stEnd;
  }
}

function frameText(f: string, L: Labels): string {
  if (f === "root") return L.frRoot;
  if (f === "born") return L.frBorn;
  const [kind, field] = f.split(":");
  return tpl(kind === "str" ? L.frStr : L.frInt, { f: field });
}

interface Chip { text: string; kind: "branch" | "fixed" | "extend" | "eos" | "bad" | "loose"; step: number; replaced: boolean }

// Tokens committed through step t, with the tokens an extend step replaced.
function chipsAt(run: Run, t: number): { chips: Chip[]; gone: string[] } {
  const chips: Chip[] = [];
  let gone: string[] = [];
  let dead = false;
  for (let i = 0; i <= t; i++) {
    const s = run.steps[i];
    if (s.kind === "decode") {
      if (s.violation) dead = true;
      const kind: Chip["kind"] = s.choice === "<eos>" ? "eos" : s.violation ? "bad" : dead || !s.state ? "loose" : s.state.kind === "lit" ? "fixed" : "branch";
      chips.push({ text: s.choice, kind, step: i, replaced: false });
    } else {
      const removed = s.recomputed > 0 ? chips.splice(chips.length - s.recomputed) : [];
      if (i === t) gone = removed.map((c) => c.text);
      s.tokens.forEach((tk, k) => chips.push({ text: tk, kind: "extend", step: i, replaced: s.recomputed > 0 && k === 0 }));
    }
  }
  return { chips, gone };
}

const violationStep = (run: Run) => run.steps.findIndex((s) => s.kind === "decode" && s.violation);

// Rows of the distribution table: the listed tokens worth reading, and the
// rest folded into "other admissible" and "other masked" so the p column sums to 1.
function tableRows(s: DecodeStep) {
  const Z = s.Z ?? 1;
  const rows: Array<{ tok: string; p: number; a: number; chosen: boolean }> = [];
  let oa = s.otherAllowed ?? 0, om = s.otherMasked;
  s.top.forEach(([tok, p, a], k) => {
    const chosen = tok === s.choice;
    const keep = chosen || p >= 0.002 || (k >= 8 && a === 1 && p / Z >= 0.01);
    if (keep) rows.push({ tok, p, a, chosen });
    else if (a === 1) oa += p;
    else om += p;
  });
  return { rows, oa, om };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const run = RUNS[st.p.mode];
  const t = Math.min(Math.round(st.t), run.steps.length - 1);
  const s = run.steps[t];
  const mode = st.p.mode === "free" ? L.modeFree : st.p.mode === "mask" ? L.modeMask : L.modeJump;
  const d = run.steps.length - 1;
  if (s.kind === "extend") return tpl(L.dExtend, { t, d, mode, f: vis(s.forced), k: s.tokens.length, r: s.recomputed });
  if (st.p.mode === "free" || !s.state) return tpl(L.dFree, { t, d, mode, tok: vis(s.choice), p: fmtP(s.p), bad: s.violation ? L.dBad : "" });
  return tpl(L.dDecode, {
    t, d, mode, state: stateText(s.state, L, violationStep(run)), n: int(s.nAllowed ?? 0), v: int(VOCAB),
    z: fmtP(s.Z ?? 0), tok: vis(s.choice), p: fmtP(s.p), pg: fmtP(s.pg ?? 0),
  });
}

// ---------------------------------------------------------------- panels

const CHIP = {
  branch: { fill: C.c1, op: 0.22 },
  fixed: { fill: C.c2, op: 0.14 },
  extend: { fill: C.c2, op: 0.34 },
  eos: { fill: C.panel, op: 1 },
  bad: { fill: C.bad, op: 0.3 },
  loose: { fill: C.panel, op: 1 },
} as const;

function renderOutput(run: Run, t: number, w: number, y0: number, L: Labels, mode: Mode): { svg: string; h: number } {
  const fs = TYPE.body;
  const parts: string[] = [];
  parts.push(text(0, y0 + 14, tpl(L.output, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  let y = y0 + 24;
  const { chips } = chipsAt(run, t);
  const h = 22, gap = 3, lineH = h + 5;
  let x = 0;
  // Extend groups get one outline around all tokens of the same pass.
  const groups = new Map<number, { x0: number; x1: number; y: number }[]>();
  for (const c of chips) {
    const label = vis(c.text);
    const cw = textWidth(label, fs) + 10;
    if (x > 0 && x + cw > w) { x = 0; y += lineH; }
    const style = CHIP[c.kind];
    const cur = c.step === t;
    const outlined = c.kind === "eos" || c.kind === "loose";
    parts.push(el("rect", { x, y, width: cw, height: h, rx: 4, fill: style.fill, "fill-opacity": style.op, stroke: outlined ? C.ink3 : undefined, "stroke-dasharray": outlined ? "3 2" : undefined }));
    parts.push(text(x + cw / 2, y + 15, label, { "font-size": fs, "text-anchor": "middle", class: cur ? "fig-t-strong" : c.kind === "loose" ? "fig-t-muted" : undefined }));
    if (c.kind === "extend") {
      const list = groups.get(c.step) ?? [];
      const last = list[list.length - 1];
      if (last && last.y === y) last.x1 = x + cw; else list.push({ x0: x, x1: x + cw, y });
      groups.set(c.step, list);
    } else if (cur) {
      parts.push(el("rect", { x: x - 1.5, y: y - 1.5, width: cw + 3, height: h + 3, rx: 5, fill: "none", stroke: C.ink, "stroke-width": 1.6 }));
    }
    x += cw + gap;
  }
  for (const [step, segs] of groups) {
    for (const sgm of segs) {
      parts.push(el("rect", { x: sgm.x0 - 1.5, y: sgm.y - 1.5, width: sgm.x1 - sgm.x0 + 3, height: h + 3, rx: 5, fill: "none", stroke: step === t ? C.ink : C.c2, "stroke-width": step === t ? 1.6 : 1 }));
    }
  }
  y += h + 10;
  const items = mode === "free"
    ? [{ label: L.sampled, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.22 } }, { label: L.fixed, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.14 } }, { label: L.broken, swatch: { kind: "rect" as const, fill: C.bad, opacity: 0.3 } }, { label: L.loose, swatch: { kind: "rect" as const, fill: C.panel, stroke: C.ink3, dash: "3 2" } }]
    : mode === "mask"
      ? [{ label: L.sampled, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.22 } }, { label: L.fixed, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.14 } }]
      : [{ label: L.sampled, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.22 } }, { label: L.extended, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.34, stroke: C.c2 } }];
  const lg = legend(items, 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height;
  return { svg: g({ class: "fig-output" }, ...parts), h: y - y0 };
}

function renderParser(s: DecodeStep | ExtendStep, run: Run, x0: number, y0: number, w: number, L: Labels, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const wr = (str: string, width: number) => (lang === "zh" ? wrapCjk(str, fs, width) : wrap(str, fs, width));
  const parts: string[] = [];
  parts.push(text(x0, y0 + 14, L.parser, { "font-size": TYPE.label, class: "fig-t-strong" }));
  let y = y0 + 22;
  const st = s.state;
  for (const ln of wr(stateText(st, L, violationStep(run)), w)) {
    y += 16;
    parts.push(text(x0, y, ln, { "font-size": fs }));
  }
  y += 12;
  parts.push(text(x0, y + 12, L.stack, { "font-size": fs, class: "fig-t-muted" }));
  y += 18;
  const frames = st ? [...st.stack].reverse() : [];
  if (!frames.length) {
    parts.push(el("rect", { x: x0, y, width: w, height: 22, rx: 3, fill: "none", stroke: C.rule, "stroke-dasharray": "3 2" }));
    parts.push(text(x0 + 8, y + 15, L.stackEmpty, { "font-size": fs, class: "fig-t-muted" }));
    y += 26;
  }
  frames.forEach((f, k) => {
    parts.push(el("rect", { x: x0, y, width: w, height: 22, rx: 3, fill: k === 0 ? C.c1 : C.panel, "fill-opacity": k === 0 ? 0.18 : 1, stroke: C.rule }));
    parts.push(text(x0 + 8, y + 15, frameText(f, L), { "font-size": fs, class: k === 0 ? "fig-t-strong" : undefined }));
    y += 25;
  });
  if (s.kind === "decode" && s.nAllowed != null) {
    y += 10;
    parts.push(text(x0, y + 12, tpl(L.admissible, { n: int(s.nAllowed), v: int(VOCAB) }), { "font-size": fs, class: "fig-t-num" }));
    y += 16;
  }
  if (s.kind === "decode" && s.bytes > 1 && s.state) {
    y += 6;
    for (const ln of wr(tpl(L.consumes, { tok: vis(s.choice), b: s.bytes }), w)) {
      y += 16;
      parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" }));
    }
  }
  return { svg: g({ class: "fig-parser" }, ...parts), h: y - y0 };
}

function renderDist(s: DecodeStep, t: number, mode: Mode, x0: number, y0: number, w: number, L: Labels, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const wr = (str: string, width: number) => (lang === "zh" ? wrapCjk(str, fs, width) : wrap(str, fs, width));
  const parts: string[] = [];
  parts.push(text(x0, y0 + 14, tpl(L.dist, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  let y = y0 + 34;
  const free = mode === "free" || !s.state;
  const { rows, oa, om } = tableRows(s);
  const Z = s.Z ?? 1;
  const aggLabels = free ? [L.otherAll] : [L.otherA, L.otherM];
  const tokW = Math.min(Math.floor(w * 0.36), Math.max(textWidth(L.colTok, fs), ...rows.map((r) => textWidth(vis(r.tok), fs)), ...aggLabels.map((a) => textWidth(a, fs))) + 8);
  // Value columns as wide as this step's widest number.
  const pVals = [...rows.map((r) => r.p), oa, om, oa + om];
  const valP = Math.max(...pVals.map((v) => textWidth(fmtP(v), fs))) + 6;
  const valG = free ? 0 : Math.max(...[...rows.map((r) => (r.a === 1 ? r.p / Z : 0)), oa / Z].map((v) => textWidth(fmtP(Math.min(1, v)), fs))) + 6;
  const maskW = Math.max(textWidth(free ? L.colSchema : L.colMask, fs), 26) + 10;
  const cols = free ? 1 : 2;
  const spare = w - tokW - maskW - valP - valG - 8;
  // Too narrow for two bars: keep the p_G bars and print p as a number only.
  const pBars = free || spare / cols >= 20;
  const barP = pBars ? spare / cols : 0;
  const barG = free ? 0 : pBars ? spare / cols : spare;
  const xP = x0 + tokW; // p column: bar, then the value
  const xM = xP + barP + valP + 4; // mask column
  const xG = xM + maskW; // p_G column
  parts.push(text(x0, y, L.colTok, { "font-size": fs, class: "fig-t-muted" }));
  parts.push(text(xP, y, L.colP, { "font-size": fs, class: "fig-t-muted" }));
  parts.push(text(xM + maskW / 2, y, free ? L.colSchema : L.colMask, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  if (!free) parts.push(text(xG + 4, y, L.colPG, { "font-size": fs, class: "fig-t-muted" }));
  y += 6;
  const rowH = 20;
  const all = [
    ...rows.map((r) => ({ label: vis(r.tok), p: r.p, a: r.a, chosen: r.chosen, agg: false })),
    ...(free ? [{ label: L.otherAll, p: oa + om, a: -2, chosen: false, agg: true }] : [
      { label: L.otherA, p: oa, a: 1, chosen: false, agg: true },
      { label: L.otherM, p: om, a: 0, chosen: false, agg: true },
    ]),
  ];
  for (const r of all) {
    if (r.chosen) parts.push(el("rect", { x: x0 - 4, y, width: w + 4, height: rowH, rx: 3, fill: C.panel }));
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const tcls = r.chosen ? "fig-t-strong" : r.agg ? "fig-t-muted" : undefined;
    const shown = textWidth(r.label, fs) > tokW - 4 ? r.label.slice(0, 7) + "…" : r.label;
    parts.push(text(x0, y + 14, shown, { "font-size": fs, class: tcls }));
    const masked = !free && r.a === 0;
    if (pBars) {
      parts.push(el("rect", { x: xP, y: y + 5, width: barP, height: rowH - 10, rx: 2, fill: C.panel }));
      if (r.p * barP >= 0.6) parts.push(el("rect", { x: xP, y: y + 5, width: r.p * barP, height: rowH - 10, rx: 2, fill: masked ? C.ink3 : C.c1, "fill-opacity": masked ? 0.7 : 1 }));
    }
    parts.push(text(xP + barP + valP, y + 14, fmtP(r.p), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" + (masked ? " fig-t-muted" : "") }));
    const mk = r.a === -1 || r.a === -2 ? "–" : String(r.a);
    parts.push(text(xM + maskW / 2, y + 14, mk, { "font-size": fs, "text-anchor": "middle", class: "fig-t-num " + (r.a === 0 ? "fig-t-strong" : "fig-t-muted") }));
    if (!free) {
      const pg = r.a === 1 ? r.p / Z : 0;
      parts.push(el("rect", { x: xG + 4, y: y + 5, width: barG, height: rowH - 10, rx: 2, fill: C.panel }));
      if (pg * barG >= 0.6) parts.push(el("rect", { x: xG + 4, y: y + 5, width: Math.min(1, pg) * barG, height: rowH - 10, rx: 2, fill: C.c1 }));
      parts.push(text(x0 + w, y + 14, fmtP(Math.min(1, pg)), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" + (r.chosen ? " fig-t-strong" : "") }));
    }
    y += rowH;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 6;
  const notes: Array<[string, string]> = free
    ? [[tpl(L.freeLine, { tok: vis(s.choice) }), "fig-t-muted"]]
    : [[tpl(L.zLine, { z: fmtP(Z) }), "fig-t-num"], [tpl(L.pgLine, { tok: vis(s.choice), p: fmtP(s.p), z: fmtP(Z), pg: fmtP(s.pg ?? 0) }), "fig-t-num fig-t-strong"]];
  if (s.violation) notes.push([tpl(L.violation, { tok: vis(s.choice), rest: vis(ACCEPT_REST(s.state)) }), "fig-t-strong"]);
  for (const [line, cls] of notes) {
    for (const ln of wr(line, w)) {
      y += 16;
      parts.push(text(x0, y, ln, { "font-size": fs, class: cls }));
    }
    y += 2;
  }
  return { svg: g({ class: "fig-dist" }, ...parts), h: y - y0 };
}

function renderExtend(s: ExtendStep, gone: string[], t: number, x0: number, y0: number, w: number, L: Labels, lang: Lang): { svg: string; h: number } {
  const fs = TYPE.body;
  const wr = (str: string, width: number) => (lang === "zh" ? wrapCjk(str, fs, width) : wrap(str, fs, width));
  const parts: string[] = [];
  parts.push(text(x0, y0 + 14, tpl(L.ext, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  let y = y0 + 22;
  for (const ln of wr(tpl(L.extForced, { f: vis(s.forced) }), w)) { y += 16; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-num" })); }
  y += 10;
  for (const ln of wr(L.extTokens, w)) { y += 16; parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  y += 8;
  let x = x0;
  for (const tk of s.tokens) {
    const label = vis(tk);
    const cw = textWidth(label, fs) + 10;
    if (x > x0 && x + cw > x0 + w) { x = x0; y += 27; }
    parts.push(el("rect", { x, y, width: cw, height: 22, rx: 4, fill: C.c2, "fill-opacity": 0.34 }));
    parts.push(text(x + cw / 2, y + 15, label, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
    x += cw + 3;
  }
  y += 22 + 6;
  const note = s.recomputed > 0 ? tpl(L.extRecomp, { old: gone.map(vis).join(""), r: s.recomputed }) : L.extNone;
  for (const ln of wr(note, w)) { y += 16; parts.push(text(x0, y, ln, { "font-size": fs, class: s.recomputed > 0 ? "fig-t-strong" : "fig-t-muted" })); }
  return { svg: g({ class: "fig-extend" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const mode = st.p.mode;
  const run = RUNS[mode];
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const t = Math.min(Math.round(st.t), run.steps.length - 1);
  const s = run.steps[t];
  const parts: string[] = [];
  const wr = (str: string, width: number) => (lang === "zh" ? wrapCjk(str, fs, width) : wrap(str, fs, width));
  let y = 0;
  const inputText = PROMPT.split("\n")[1].replace(/^Text: /, "");
  for (const line of [tpl(L.input, { text: inputText }), L.schema]) {
    for (const ln of wr(line, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  }
  y += 14;
  const out = renderOutput(run, t, w, y, L, mode);
  parts.push(out.svg);
  y += out.h + 18;

  const { gone } = chipsAt(run, t);
  const leftW = narrow ? w : Math.min(230, Math.floor(w * 0.37));
  const rightX = narrow ? 0 : leftW + 26;
  const rightW = narrow ? w : w - rightX;
  const parser = renderParser(s, run, 0, y, leftW, L, lang);
  const right = s.kind === "extend" ? renderExtend(s, gone, t, rightX, narrow ? y + parser.h + 20 : y, rightW, L, lang) : renderDist(s, t, mode, rightX, narrow ? y + parser.h + 20 : y, rightW, L, lang);
  parts.push(parser.svg, right.svg);
  y += narrow ? parser.h + 20 + right.h : Math.max(parser.h, right.h);
  y += 16;

  // Model passes so far, and the verdict on the finished output.
  const decodes = run.steps.slice(0, t + 1).filter((x) => x.kind === "decode").length;
  const extends_ = t + 1 - decodes;
  const passes = mode === "jump" ? tpl(L.passesJump, { n: s.passes, d: decodes, e: extends_ }) : mode === "mask" ? tpl(L.passesMask, { n: s.passes }) : tpl(L.passesFree, { n: s.passes });
  parts.push(el("line", { x1: 0, x2: w, y1: y - 6, y2: y - 6, stroke: C.grid, "stroke-width": 1 }));
  for (const ln of wr(passes, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-num" })); }
  if (t === run.steps.length - 1) {
    for (const ln of wr(run.valid ? L.valid : L.invalid, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-strong" })); }
  }
  return svg(w, y + 8, describe(st, lang), g({ class: "fig-constrained" }, ...parts));
}

function keyframes(p: P, lang: Lang) {
  const L = labels[lang];
  const run = RUNS[p.mode];
  const out: Array<{ t: number; label: string }> = [];
  run.steps.forEach((s, i) => {
    if (s.kind === "extend") {
      out.push({ t: i, label: s.recomputed > 0 ? L.kfRetok : tpl(L.kfExtend, { k: s.tokens.length }) });
      return;
    }
    if (s.violation) out.push({ t: i, label: tpl(L.kfViolation, { tok: vis(s.choice), rest: vis(ACCEPT_REST(s.state)) }) });
    else if (s.choice === "<eos>") out.push({ t: i, label: p.mode === "free" ? L.kfEosFree : L.kfEos });
    else if (p.mode !== "free" && s.state && s.top[0][2] === 0) out.push({ t: i, label: tpl(L.kfMasked, { tok: vis(s.top[0][0]), p: fmtP(s.top[0][1]), z: fmtP(s.Z ?? 0) }) });
    else if (i === 0 && s.bytes > 1) out.push({ t: i, label: tpl(L.kfBytes, { tok: vis(s.choice), b: s.bytes }) });
  });
  return out;
}

// The page opens where the mechanism is most visible: the step with the least
// legal mass under the mask, the first schema violation without a grammar, or
// the extend pass that replaces a cached token.
function poster(p: P): number {
  const run = RUNS[p.mode];
  if (p.mode === "free") return Math.max(0, violationStep(run));
  if (p.mode === "jump") {
    const r = run.steps.findIndex((s) => s.kind === "extend" && s.recomputed > 0);
    return r >= 0 ? r : run.steps.findIndex((s) => s.kind === "extend");
  }
  let best = 0, z = Infinity;
  run.steps.forEach((s, i) => { if (s.kind === "decode" && s.Z != null && s.Z < z) { z = s.Z; best = i; } });
  return best;
}

export default defineFigure({
  name: "constrained-decoding",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    mode: {
      kind: "choice", label: { en: "Decoding", zh: "解码方式" }, default: "mask",
      options: [
        { value: "free", label: { en: "No grammar", zh: "不加语法" } },
        { value: "mask", label: { en: "Grammar mask", zh: "语法掩码" } },
        { value: "jump", label: { en: "Mask + jump-forward", zh: "掩码加跳跃" } },
      ],
    },
  },
  timeline: {
    rate: 1.5,
    discrete: true,
    duration: (p) => RUNS[p.mode].steps.length - 1,
    keyframes,
    poster,
  },
  render,
  describe,
});
