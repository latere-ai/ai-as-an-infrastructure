// Reward source against reward use, on one group of sampled responses.
//
// The chapter separates what produces the number (an executable checker C
// that runs an implemented contract, or a learned scorer s that estimates a
// judgment) from what the number is used for (select one response, filter
// data for supervised fine-tuning, or update the current policy). The same
// eight responses to one task go through each of the six combinations:
//
// - select: best-of-n returns the argmax of the signal; a tie among checker
//   passes is broken uniformly, so the returned response is correct under q
//   with probability (correct passes) / (passes);
// - filter: rejection-sampling fine-tuning keeps C = 1, or s ≥ τ for the
//   learned scorer (τ = 0.6 here);
// - update: the group-relative advantage of @sec-training-to-reason,
//   A_i = (r_i − r̄) / s_r with the group mean r̄ and population standard
//   deviation s_r, raises responses with A_i > 0 and lowers the rest.
//
// Correctness under the intended standard q is part of the illustrative data,
// chosen so each source errs where the chapter says it can: the checker's
// answer normalizer rejects a correct answer written in cents (incomplete) and
// accepts a right number reached through an invalid step (unsound); the
// learned scorer ranks a fluent, confident wrong answer first and a terse
// correct one below the cut. All values are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Source = "checker" | "learned";
type Use = "select" | "filter" | "update";
const SOURCES: Source[] = ["learned", "checker"];
const USES: Use[] = ["select", "filter", "update"];
const TAU = 0.6; // acceptance cut for the learned scorer when it filters

interface Resp { q: 0 | 1; c: 0 | 1; s: number } // final answers and notes are in the label tables
// Task: pencils cost $0.75 for 3; what do 10 cost? The intended answer is $2.50.
const RESPONSES: Resp[] = [
  { q: 1, c: 1, s: 0.82 },
  { q: 1, c: 1, s: 0.74 },
  { q: 1, c: 0, s: 0.61 },
  { q: 0, c: 1, s: 0.55 },
  { q: 0, c: 0, s: 0.88 },
  { q: 0, c: 0, s: 0.2 },
  { q: 0, c: 0, s: 0.35 },
  { q: 1, c: 1, s: 0.47 },
];
const N = RESPONSES.length;

const signal = (src: Source, r: Resp) => (src === "checker" ? r.c : r.s);
const passes = (src: Source, r: Resp) => (src === "checker" ? r.c === 1 : r.s >= TAU);

function outcome(src: Source, use: Use) {
  const sig = RESPONSES.map((r) => signal(src, r));
  const mean = sig.reduce((a, b) => a + b, 0) / N;
  const sd = Math.sqrt(sig.reduce((a, b) => a + (b - mean) ** 2, 0) / N);
  const adv = sig.map((v) => (sd > 0 ? (v - mean) / sd : 0));
  const top = Math.max(...sig);
  const chosen = sig.map((v) => v === top); // select: the argmax set (ties for the checker)
  const kept = RESPONSES.map((r) => passes(src, r)); // filter
  const nChosen = chosen.filter(Boolean).length;
  const pCorrect = RESPONSES.reduce((a, r, i) => a + (chosen[i] ? r.q : 0), 0) / nChosen;
  const idx = (f: (r: Resp, i: number) => boolean) => RESPONSES.flatMap((r, i) => (f(r, i) ? [i] : []));
  const keptBad = idx((r, i) => kept[i] && r.q === 0);
  const lostGood = idx((r, i) => !kept[i] && r.q === 1);
  const upBad = idx((r, i) => adv[i] > 0 && r.q === 0);
  const downGood = idx((r, i) => adv[i] < 0 && r.q === 1);
  return { src, use, sig, mean, sd, adv, chosen, kept, nChosen, pCorrect, keptBad, lostGood, upBad, downGood, nKept: kept.filter(Boolean).length };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Reward source and reward use on one group of responses",
    colSelect: "select one response",
    colFilter: "filter data for SFT",
    colUpdate: "update the policy",
    rowLearned: "learned scorer",
    rowLearnedSub: "estimates a judgment",
    rowChecker: "executable checker",
    rowCheckerSub: "runs the implemented contract",
    learned_select: "verifier reranking (Cobbe et al.)",
    learned_filter: "reward-model rejection sampling (Llama 2)",
    learned_update: "RLHF; GRPO with a reward model (DeepSeekMath)",
    checker_select: "best-of-n with the checker",
    checker_filter: "rejection-sampling fine-tuning",
    checker_update: "RLVR (Tülu 3, DeepSeek-R1-Zero)",
    strict: "verifiable reward in the strict sense",
    task: "Task: pencils cost $0.75 for 3. What do 10 cost? The intended answer is $2.50. Eight sampled responses:",
    a0: "$2.50",
    a1: "2.5 dollars",
    a2: "250 cents",
    a3: "$2.50",
    a4: "$2.25",
    a5: "$7.50",
    a6: "$3.00",
    a7: "$2.50",
    note0: "worked solution",
    note1: "worked solution",
    note2: "worked solution, answer in cents",
    note3: "an invalid step lands on the right number",
    note4: "fluent and confident, one arithmetic slip",
    note5: "multiplies instead of dividing",
    note6: "rounds the unit price up",
    note7: "terse, every step valid",
    hResp: "response",
    hQ: "correct under q",
    hQShort: "q",
    hC: "C(x, y)",
    hS: "score s",
    hSelect: "best-of-8",
    hFilter: "SFT set",
    hUpdate: "advantage A",
    yes: "yes",
    no: "no",
    fp: "passes, but wrong under q",
    fn: "fails, but correct under q",
    fpS: "scores ≥ 0.6, but wrong under q",
    fnS: "scores < 0.6, but correct under q",
    returned: "returned",
    tie: "tie, 1 in {n}",
    kept: "kept",
    dropped: "dropped",
    outSelectTie: "{n} responses pass, and a tie is broken at random, so the returned response is correct under q with probability {p}.",
    outSelectOne: "The highest score, {s}, belongs to response {i}, which is {ok} under q.",
    right: "correct",
    wrong: "wrong",
    outFilter: "{k} of 8 responses are kept for fine-tuning. Kept but wrong under q: {bad}. Dropped but correct under q: {lost}.",
    outUpdate: "A_i = (r_i − r̄) / s_r with r̄ = {m} and s_r = {sd}. Raised but wrong under q: {up}. Lowered but correct under q: {down}.",
    none: "none",
    and: " and ",
    chSelect: "Nothing in the model changes; every request pays for 8 samples and the check.",
    chFilter: "A later model imitates the kept set, which is off-policy for every checkpoint after the one that sampled it.",
    chUpdate: "The current policy moves now, and the next group is sampled from it.",
    filterCut: "The learned scorer keeps s ≥ 0.6.",
    raised: "raised, A > 0",
    lowered: "lowered, A < 0",
    describe: "{cell}: {src} used to {use}. {out}",
    srcLearned: "a learned scorer", srcChecker: "an executable checker",
    useSelect: "select one response", useFilter: "filter fine-tuning data", useUpdate: "update the policy",
  },
  zh: {
    title: "同一组回答上的奖励来源与奖励用途",
    colSelect: "挑选回答",
    colFilter: "筛选 SFT 数据",
    colUpdate: "更新策略",
    rowLearned: "学习型评分器",
    rowLearnedSub: "估计一项判断",
    rowChecker: "可执行检查器",
    rowCheckerSub: "运行已实现的契约",
    learned_select: "Cobbe 等人的验证器重排序",
    learned_filter: "Llama 2 的奖励模型拒绝采样",
    learned_update: "RLHF；DeepSeekMath 中带奖励模型的 GRPO",
    checker_select: "用检查器做 best-of-n",
    checker_filter: "拒绝采样微调",
    checker_update: "RLVR：Tülu 3、DeepSeek-R1-Zero",
    strict: "严格意义上的可验证奖励",
    task: "任务：铅笔 3 支 0.75 美元，10 支多少钱？预期答案是 2.50 美元。八个采样回答：",
    a0: "2.50 美元",
    a1: "2.5 美元",
    a2: "250 美分",
    a3: "2.50 美元",
    a4: "2.25 美元",
    a5: "7.50 美元",
    a6: "3.00 美元",
    a7: "2.50 美元",
    note0: "完整解题",
    note1: "完整解题",
    note2: "完整解题，答案以美分表示",
    note3: "一步无效推导恰好得到正确数字",
    note4: "流畅而自信，有一处算错",
    note5: "该除的地方做了乘法",
    note6: "把单价向上取整",
    note7: "简短，每一步都成立",
    hResp: "回答",
    hQ: "按 q 是否正确",
    hQShort: "q",
    hC: "C(x, y)",
    hS: "分数 s",
    hSelect: "best-of-8",
    hFilter: "SFT 数据",
    hUpdate: "优势 A",
    yes: "是",
    no: "否",
    fp: "通过检查，但按 q 是错的",
    fn: "未通过，但按 q 是对的",
    fpS: "分数 ≥ 0.6，但按 q 是错的",
    fnS: "分数 < 0.6，但按 q 是对的",
    returned: "返回",
    tie: "并列，{n} 选 1",
    kept: "保留",
    dropped: "丢弃",
    outSelectTie: "有 {n} 个回答通过检查，并列时随机选一个，所以返回的回答按 q 正确的概率是 {p}。",
    outSelectOne: "最高分 {s} 属于回答 {i}，它按 q 是{ok}的。",
    right: "对",
    wrong: "错",
    outFilter: "8 个回答中有 {k} 个留作微调数据。保留但按 q 错误：{bad}。丢弃但按 q 正确：{lost}。",
    outUpdate: "A_i = (r_i − r̄) / s_r，其中 r̄ = {m}，s_r = {sd}。被抬高但按 q 错误：{up}。被压低但按 q 正确：{down}。",
    none: "无",
    and: "、",
    chSelect: "模型本身不变；每个请求都要付出 8 次采样和检查的成本。",
    chFilter: "之后的模型模仿保留下来的数据；对采样检查点之后的每个检查点而言，这些数据都是离策略的。",
    chUpdate: "当前策略立刻改变，下一组回答就从它采样。",
    filterCut: "学习型评分器保留 s ≥ 0.6 的回答。",
    raised: "抬高，A > 0",
    lowered: "压低，A < 0",
    describe: "{cell}：用{src}来{use}。{out}",
    srcLearned: "学习型评分器", srcChecker: "可执行检查器",
    useSelect: "挑选一个回答", useFilter: "筛选微调数据", useUpdate: "更新策略",
  },
};

type L = typeof labels.en;
type Cell = `${Source}-${Use}`;
type P = { source: Source; use: Use; cell: Cell };

const f2 = (v: number) => fixed(v, 2);
// zh wraps to the full width unless kinsoku pulls a closing mark onto a full
// line, which would overrun; then it wraps one glyph narrower.
function lines(s: string, size: number, width: number, lang: Lang): string[] {
  if (lang !== "zh") return wrap(s, size, width);
  const ls = wrapCjk(s, size, width);
  return ls.some((l) => textWidth(l, size) > width) ? wrapCjk(s, size, width - size) : ls;
}
const cellName = (L: L, src: Source, use: Use) => L[`${src}_${use}` as keyof L];
const colName = (L: L, use: Use) => (use === "select" ? L.colSelect : use === "filter" ? L.colFilter : L.colUpdate);
// Response numbers as a list: "#5", "#3 and #4", or "none".
const list = (L: L, idx: number[]) => (idx.length ? idx.map((i) => `#${i + 1}`).join(L.and) : L.none);

function outcomeText(L: L, o: ReturnType<typeof outcome>): string {
  if (o.use === "select") {
    if (o.nChosen > 1) return tpl(L.outSelectTie, { n: o.nChosen, p: pct(o.pCorrect) });
    const i = o.chosen.indexOf(true);
    return tpl(L.outSelectOne, { s: f2(o.sig[i]), i: i + 1, ok: RESPONSES[i].q ? L.right : L.wrong });
  }
  if (o.use === "filter") {
    return tpl(L.outFilter, { k: o.nKept, bad: list(L, o.keptBad), lost: list(L, o.lostGood) });
  }
  return tpl(L.outUpdate, { m: f2(o.mean), sd: f2(o.sd), up: list(L, o.upBad), down: list(L, o.downGood) });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const { source, use } = st.p;
  const o = outcome(source, use);
  return tpl(L.describe, {
    cell: cellName(L, source, use).replace(/^./, (c) => c.toUpperCase()),
    src: source === "checker" ? L.srcChecker : L.srcLearned,
    use: use === "select" ? L.useSelect : use === "filter" ? L.useFilter : L.useUpdate,
    out: outcomeText(L, o),
  });
}

// ---------------------------------------------------------------- render

function renderMatrix(p: P, lang: Lang, y0: number, w: number): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.body;
  const narrow = w < 480;
  // Wide: sources are rows, uses are columns. Phone: transposed, so each of
  // the two columns is wide enough to name its systems.
  const rowKeys: Array<Source | Use> = narrow ? USES : SOURCES;
  const colKeys: Array<Source | Use> = narrow ? SOURCES : USES;
  const rhW = narrow ? 64 : 128;
  const gap = narrow ? 4 : 6;
  const cw = (w - rhW - gap * colKeys.length) / colKeys.length;
  const isSource = (k: Source | Use): k is Source => k === "checker" || k === "learned";
  const head = (k: Source | Use): Array<[string, string]> => isSource(k)
    ? [[k === "checker" ? L.rowChecker : L.rowLearned, "fig-t-strong"], [k === "checker" ? L.rowCheckerSub : L.rowLearnedSub, "fig-t-muted"]]
    : [[colName(L, k), "fig-t-strong"]];
  const parts: string[] = [];
  // Column headers, bottom-aligned.
  const colHead = colKeys.map((k) => head(k).flatMap(([s, cls]) => lines(s, fs, cw - 4, lang).map((ln) => [ln, cls] as [string, string])));
  const hh = Math.max(...colHead.map((ls) => ls.length)) * 15;
  colKeys.forEach((_, j) => {
    const x = rhW + gap + j * (cw + gap);
    const ls = colHead[j];
    ls.forEach(([ln, cls], k) => parts.push(text(x + 4, y0 + hh - (ls.length - 1 - k) * 15 - 3, ln, { "font-size": fs, class: cls })));
  });
  let y = y0 + hh + 6;
  for (const rk of rowKeys) {
    const rowHead = head(rk).flatMap(([s, cls]) => lines(s, fs, rhW - 6, lang).map((ln) => [ln, cls] as [string, string]));
    const cells = colKeys.map((ck) => {
      const src = (isSource(rk) ? rk : ck) as Source, use = (isSource(rk) ? ck : rk) as Use;
      const name = lines(cellName(L, src, use), fs, cw - 12, lang);
      const strict = src === "checker" && use === "update" ? lines(L.strict, fs, cw - 12, lang) : [];
      return { src, use, name, strict };
    });
    const rh = Math.max(rowHead.length * 15 + 8, ...cells.map((c) => (c.name.length + c.strict.length) * 15 + 14));
    rowHead.forEach(([ln, cls], k) => parts.push(text(0, y + 17 + k * 15, ln, { "font-size": fs, class: cls })));
    cells.forEach((c, j) => {
      const x = rhW + gap + j * (cw + gap);
      const on = c.src === p.source && c.use === p.use;
      parts.push(el("rect", { x, y, width: cw, height: rh, rx: 6, fill: on ? C.c1 : C.panel, "fill-opacity": on ? 0.16 : 1, stroke: on ? C.ink : "none", "stroke-width": on ? 2 : 0 }));
      let yy = y + 18;
      // Selection shows as fill and outline; the name keeps its regular weight
      // so a long system name fits the phone column.
      for (const ln of c.name) { parts.push(text(x + 6, yy, ln, { "font-size": fs, class: on ? undefined : "fig-t-muted" })); yy += 15; }
      for (const ln of c.strict) { parts.push(text(x + 6, yy, ln, { "font-size": fs, class: "fig-t-muted" })); yy += 15; }
      parts.push(el("rect", { x, y, width: cw, height: rh, rx: 6, fill: "transparent", "data-fig-set": `cell=${c.src}-${c.use}`, class: "fig-hit" }));
    });
    y += rh + gap;
  }
  return { svg: g({ class: "fig-matrix" }, ...parts), h: y - y0 };
}

function renderTable(p: P, lang: Lang, y0: number, w: number): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.body;
  const narrow = w < 480;
  const o = outcome(p.source, p.use);
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(L.task, fs, w, lang)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs })); }
  y += 12;
  const idxW = 18;
  const qW = narrow ? 34 : 70;
  const sigW = narrow ? 44 : 64;
  const effW = narrow ? 96 : 176;
  const respW = w - idxW - qW - sigW - effW - 18;
  const xResp = idxW, xQ = xResp + respW + 6, xSig = xQ + qW + 6, xEff = xSig + sigW + 6;
  const effHead = p.use === "select" ? L.hSelect : p.use === "filter" ? L.hFilter : L.hUpdate;
  const heads: Array<[number, string, "start" | "end"]> = [
    [0, "#", "start"], [xResp, L.hResp, "start"], [xQ, narrow ? L.hQShort : L.hQ, "start"],
    [xSig + sigW - 4, p.source === "checker" ? L.hC : L.hS, "end"], [xEff, effHead, "start"],
  ];
  y += 14;
  for (const [x, s, anchor] of heads) parts.push(text(x, y, s, { "font-size": fs, "text-anchor": anchor, class: "fig-t-muted" }));
  y += 6;
  const aMax = 2.2; // advantage axis half-range
  RESPONSES.forEach((r, i) => {
    // On a phone the note runs under the whole row; on a wide column it
    // stays in the response column.
    const noteW = narrow ? w - xResp : respW;
    const note = lines(L[`note${i}` as keyof L], fs, noteW, lang);
    const pass = passes(p.source, r);
    const err = pass && !r.q ? (p.source === "checker" ? L.fp : L.fpS) : !pass && r.q ? (p.source === "checker" ? L.fn : L.fnS) : "";
    const errLines = err ? lines(err, fs, noteW - 14, lang) : [];
    const rh = (1 + note.length + errLines.length) * 15 + 8;
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const base = y + 16;
    parts.push(text(0, base, i + 1, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    parts.push(text(xResp, base, L[`a${i}` as keyof L], { "font-size": fs, class: "fig-t-strong fig-t-num" }));
    note.forEach((ln, k) => parts.push(text(xResp, base + 15 * (k + 1), ln, { "font-size": fs, class: "fig-t-muted" })));
    errLines.forEach((ln, k) => {
      const yy = base + 15 * (note.length + 1 + k);
      if (k === 0) parts.push(el("rect", { x: xResp, y: yy - 9, width: 9, height: 9, rx: 1.5, fill: C.warn }));
      parts.push(text(xResp + 14, yy, ln, { "font-size": fs }));
    });
    // Correct under the intended standard q.
    parts.push(el("circle", { cx: xQ + 5, cy: base - 4, r: 4.5, fill: r.q ? C.good : C.bad }));
    parts.push(text(xQ + 14, base, r.q ? L.yes : L.no, { "font-size": fs }));
    // The signal.
    const v = signal(p.source, r);
    parts.push(text(xSig + sigW - 4, base, p.source === "checker" ? String(v) : f2(v), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
    // What the use does with it.
    if (p.use === "select") {
      if (o.chosen[i]) {
        const s = o.nChosen > 1 ? tpl(L.tie, { n: o.nChosen }) : L.returned;
        parts.push(el("rect", { x: xEff, y: base - 10, width: 11, height: 11, rx: 2, fill: C.ink }));
        parts.push(text(xEff + 17, base, s, { "font-size": fs, class: "fig-t-strong" }));
      } else parts.push(text(xEff, base, "–", { "font-size": fs, class: "fig-t-faint" }));
    } else if (p.use === "filter") {
      const k = o.kept[i];
      parts.push(el("rect", { x: xEff, y: base - 10, width: 11, height: 11, rx: 2, fill: k ? C.c1 : "none", stroke: k ? "none" : C.ink3, "stroke-width": 1.2 }));
      parts.push(text(xEff + 17, base, k ? L.kept : L.dropped, { "font-size": fs, class: k ? "fig-t-strong" : "fig-t-muted" }));
    } else {
      const a = o.adv[i];
      const valW = 40;
      const bw = effW - valW - 4;
      const cx = xEff + bw / 2;
      const len = (Math.min(Math.abs(a), aMax) / aMax) * (bw / 2);
      parts.push(el("line", { x1: cx, x2: cx, y1: base - 12, y2: base + 3, stroke: C.rule, "stroke-width": 1 }));
      if (len > 0.5) parts.push(el("rect", { x: a > 0 ? cx : cx - len, y: base - 9, width: len, height: 9, rx: 1.5, fill: a > 0 ? C.c1 : C.c2 }));
      parts.push(text(xEff + effW, base, fixed(a, 2), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
    }
    y += rh;
  });
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  if (p.use === "update") {
    y += 8;
    const items: Array<[string, string]> = [[L.raised, C.c1], [L.lowered, C.c2]];
    let x = 0;
    for (const [s, col] of items) {
      parts.push(el("rect", { x, y: y + 3, width: 11, height: 9, rx: 1.5, fill: col }));
      parts.push(text(x + 17, y + 12, s, { "font-size": fs, class: "fig-t-muted" }));
      x += 17 + textWidth(s, fs) + 18;
    }
    y += 16;
  }
  return { svg: g({ class: "fig-group" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const fs = TYPE.body;
  const parts: string[] = [];
  const m = renderMatrix(p, lang, 0, w);
  parts.push(m.svg);
  let y = m.h + 10;
  const t = renderTable(p, lang, y, w);
  parts.push(t.svg);
  y += t.h + 20;
  const o = outcome(p.source, p.use);
  const notes: Array<[string, string]> = [[outcomeText(L, o), "fig-t-strong"]];
  if (p.use === "filter" && p.source === "learned") notes.push([L.filterCut, "fig-t-muted"]);
  notes.push([p.use === "select" ? L.chSelect : p.use === "filter" ? L.chFilter : L.chUpdate, "fig-t-muted"]);
  for (const [n, cls] of notes) {
    for (const ln of lines(n, fs, w, lang)) { parts.push(text(0, y, ln, { "font-size": fs, class: `${cls} fig-t-num` })); y += 16; }
    y += 4;
  }
  return svg(w, y, describe(st, lang), ...parts);
}

const CELLS = SOURCES.flatMap((s) => USES.map((u) => `${s}-${u}` as Cell));

export default defineFigure({
  name: "reward-source-use",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    source: {
      kind: "choice", label: { en: "Reward source", zh: "奖励来源" }, default: "checker",
      options: [
        { value: "checker", label: { en: "Executable checker", zh: "可执行检查器" } },
        { value: "learned", label: { en: "Learned scorer", zh: "学习型评分器" } },
      ],
    },
    use: {
      kind: "choice", label: { en: "Use of the signal", zh: "信号用途" }, default: "update",
      options: [
        { value: "select", label: { en: "Select", zh: "挑选" } },
        { value: "filter", label: { en: "Filter", zh: "筛选" } },
        { value: "update", label: { en: "Update", zh: "更新" } },
      ],
    },
    // A click on a matrix cell sets both choices through this key.
    cell: {
      kind: "choice", control: false, label: { en: "Matrix cell", zh: "矩阵单元" }, default: "checker-update",
      options: CELLS.map((c) => ({ value: c, label: { en: c, zh: c } })),
    },
  },
  update(p, key) {
    if (key === "cell") {
      const [source, use] = p.cell.split("-") as [Source, Use];
      return { ...p, source, use };
    }
    return p;
  },
  render,
  describe,
});
