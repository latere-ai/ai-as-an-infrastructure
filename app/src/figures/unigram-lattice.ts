// A Unigram segmentation lattice with XLM-R's published piece probabilities
// (data/unigram-lattice.ts). Every vocabulary piece that spells a substring of
// the word is an edge; a segmentation z is a path of edges from the first
// position to the last. The figure uses the chapter's model:
//
//   P(z) = Π_j p(z_j),   z* = argmax_{z ∈ S(X)} P(z),
//
// enumerates S(X) (at most a few thousand paths for these words), and ranks
// the paths. Sampling for subword regularization draws z with probability
// q_α(z) = P(z)^α / Σ_{z'} P(z')^α (Kudo, 2018): α = 1 samples the model's own
// posterior P(z) / Σ P(z'), smaller α flattens it toward alternatives.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, pct, tpl } from "./lib/format.ts";
import { tile, labelWidth } from "./lib/token-tiles.ts";
import { WORDS } from "./data/unigram-lattice.ts";

type Edge = readonly [number, number, string, number];
interface Path { edges: number[]; logp: number }
const TOP = 4; // every word has at least four segmentations

// ---------------------------------------------------------------- model

const memo = new Map<string, { edges: readonly Edge[]; paths: Path[]; n: number }>();
function lattice(word: string) {
  const hit = memo.get(word);
  if (hit) return hit;
  const w = WORDS.find((x) => x.word === word)!;
  const n = [...w.text].length;
  const from = new Map<number, number[]>();
  w.edges.forEach((e, i) => from.set(e[0], [...(from.get(e[0]) ?? []), i]));
  const paths: Path[] = [];
  const walk = (at: number, acc: number[], lp: number) => {
    if (at === n) { paths.push({ edges: acc, logp: lp }); return; }
    for (const i of from.get(at) ?? []) walk(w.edges[i][1], [...acc, i], lp + w.edges[i][3]);
  };
  walk(0, [], 0);
  paths.sort((a, b) => b.logp - a.logp);
  const out = { edges: w.edges, paths, n };
  memo.set(word, out);
  return out;
}

// log Σ exp(α · log P(z)) over all paths.
function logZ(paths: Path[], alpha: number): number {
  const m = Math.max(...paths.map((p) => alpha * p.logp));
  return m + Math.log(paths.reduce((s, p) => s + Math.exp(alpha * p.logp - m), 0));
}
const prob = (paths: Path[], p: Path, alpha: number) => Math.exp(alpha * p.logp - logZ(paths, alpha));

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "A Unigram segmentation lattice",
    lattice: "Lattice: every XLM-R piece that spells part of “{w}”",
    latticeSub: "{e} pieces, {s:path/paths} from start to end: |S(X)| = {s}",
    keyBest: "z*, the highest-probability path",
    keyPick: "the selected path",
    keyDp: "Numbers above the boundaries: the best log P of any path up to that point, the dynamic program that finds z*",
    table: "Segmentations ranked by P(z)",
    colSeg: "z",
    colLog: "log P(z)",
    colPost: "P(z) / ΣP",
    colSample: "sampled, α = {a}",
    eq: "log P(z) = {terms} = {sum}",
    share: "{rank} holds {p} of the probability over all {s} segmentations.",
    sample: "With α = {a}, q = P(z)^α / Σ P(z')^α samples it {q} of the time, and z* {qb}.",
    sampleBest: "With α = {a}, q = P(z)^α / Σ P(z')^α samples z* {q} of the time and another path {r}.",
    rest: "the other {n} paths",
    rank1: "z*",
    rankN: "rank {k}",
    describe: "“{w}” has {s} segmentations over {e} XLM-R pieces. z* = {best} with probability {pb}. {rank}: {seg}, log P(z) = {lp}, sampled {q} of the time at α = {a}.",
  },
  zh: {
    title: "Unigram 切分格",
    lattice: "切分格：XLM-R 中能拼出“{w}”一部分的所有片段",
    latticeSub: "{e} 个片段，从头到尾共 {s} 条路径：|S(X)| = {s}",
    keyBest: "z*，概率最高的路径",
    keyPick: "当前选中的路径",
    keyDp: "边界上方的数字：到该位置为止所有路径中最大的 log P，也就是求 z* 的动态规划",
    table: "按 P(z) 排序的切分",
    colSeg: "z",
    colLog: "log P(z)",
    colPost: "P(z) / ΣP",
    colSample: "采样，α = {a}",
    eq: "log P(z) = {terms} = {sum}",
    share: "{rank}占全部 {s} 种切分概率的 {p}。",
    sample: "α = {a} 时，按 q = P(z)^α / Σ P(z')^α 采样，它被抽中的比例为 {q}，z* 为 {qb}。",
    sampleBest: "α = {a} 时，按 q = P(z)^α / Σ P(z')^α 采样，z* 被抽中的比例为 {q}，其他路径合计 {r}。",
    rest: "其余 {n} 条路径",
    rank1: "z*",
    rankN: "第 {k} 名",
    describe: "“{w}”在 {e} 个 XLM-R 片段上共有 {s} 种切分。z* = {best}，概率 {pb}。{rank}：{seg}，log P(z) = {lp}，α = {a} 时被抽中的比例为 {q}。",
  },
};

type P = { word: string; alpha: number; pick: number };

const segText = (edges: readonly Edge[], p: Path) => p.edges.map((i) => edges[i][2]).join(" · ");
const rankName = (k: number, L: typeof labels.en) => (k === 0 ? L.rank1 : tpl(L.rankN, { k: k + 1 }));
const fmtLog = (v: number) => fixed(v, 2);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const { edges, paths } = lattice(st.p.word);
  const k = Math.min(st.p.pick, paths.length - 1);
  const pk = paths[k];
  return tpl(L.describe, {
    w: st.p.word, s: int(paths.length), e: edges.length, best: segText(edges, paths[0]), pb: pct(prob(paths, paths[0], 1), 1),
    rank: rankName(k, L), seg: segText(edges, pk), lp: fmtLog(pk.logp), q: pct(prob(paths, pk, st.p.alpha), 1), a: fixed(st.p.alpha, 2),
  });
}

// ---------------------------------------------------------------- render

// Rows for the lattice's bars: shorter pieces first, each in the first row
// where it overlaps nothing.
function pack(edges: readonly Edge[]): number[] {
  const order = edges.map((e, i) => i).sort((a, b) => (edges[a][1] - edges[a][0]) - (edges[b][1] - edges[b][0]) || edges[a][0] - edges[b][0]);
  const rowEnd: number[] = [];
  const row = new Array<number>(edges.length);
  for (const i of order) {
    let r = rowEnd.findIndex((end) => end <= edges[i][0]);
    if (r < 0) { r = rowEnd.length; rowEnd.push(0); }
    row[i] = r;
    rowEnd[r] = edges[i][1];
  }
  return row;
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const wrapT = (s: string, max: number, size: number = fs) => (lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max));
  const { edges, paths, n } = lattice(p.word);
  const k = Math.min(p.pick, TOP - 1);
  const best = new Set(paths[0].edges);
  const pick = new Set(paths[k].edges);
  const z1 = logZ(paths, 1), za = logZ(paths, p.alpha);
  const post = (q: Path) => Math.exp(q.logp - z1);
  const samp = (q: Path) => Math.exp(p.alpha * q.logp - za);
  const parts: string[] = [];
  let y = 0;

  // ---- title
  for (const line of wrapT(tpl(L.lattice, { w: p.word }), w, TYPE.label)) {
    parts.push(text(0, y + 14, line, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 18;
  }
  parts.push(text(0, y + 12, tpl(L.latticeSub, { e: edges.length, s: int(paths.length) }), { "font-size": fs, class: "fig-t-muted fig-t-num" }));
  y += 26;

  // ---- the dynamic program for z*: the best log P of any path to each
  // boundary, then one bar per piece between boundaries
  const cell = Math.min(56, Math.floor(w / n));
  const bestTo = [0];
  for (let b = 1; b <= n; b++) bestTo.push(Math.max(...edges.filter((e) => e[1] === b).map((e) => bestTo[e[0]] + e[3])));
  const vals = bestTo.map((v) => (v === 0 ? "0" : fixed(v, 1)));
  const bx0 = (b: number) => Math.min(w - 1, Math.max(1, b * cell - 1));
  // Each value goes in the first of up to three rows where it clears the
  // previous value placed in that row.
  const rowRight: number[] = [];
  const placed = vals.map((v, b) => {
    const tw = textWidth(v, fs);
    const anchor = b === 0 ? "start" : b === n ? "end" : "middle";
    const x0 = anchor === "start" ? bx0(b) : anchor === "end" ? bx0(b) - tw : bx0(b) - tw / 2;
    let r = rowRight.findIndex((right) => x0 > right + 5);
    if (r < 0) { r = rowRight.length; rowRight.push(-Infinity); }
    rowRight[r] = x0 + tw;
    return { v, b, r, anchor };
  });
  const valRows = rowRight.length;
  for (const pl of placed) {
    parts.push(text(bx0(pl.b), y + 12 + (valRows - 1 - pl.r) * 16, pl.v, { "font-size": fs, "text-anchor": pl.anchor, class: `fig-t-num ${pl.b === n ? "fig-t-strong" : "fig-t-muted"}` }));
  }
  y += 20 + (valRows - 1) * 16;
  for (let b = 0; b <= n; b++) parts.push(el("line", { x1: bx0(b), x2: bx0(b), y1: y - 4, y2: y + 2, stroke: C.ink3, "stroke-width": 1 }));
  y += 6;
  const row = pack(edges);
  const rows = Math.max(...row) + 1;
  const bh = 20, pitch = 24;
  edges.forEach((e, i) => {
    const bx = e[0] * cell, bw = (e[1] - e[0]) * cell - 2, by = y + row[i] * pitch;
    const inBest = best.has(i), inPick = k > 0 && pick.has(i);
    const style = inPick
      ? { fill: C.c2, opacity: 0.22, stroke: C.c2, strokeWidth: 2.5 }
      : inBest ? { fill: C.c1, opacity: 0.25, stroke: C.c1, strokeWidth: 2 } : {};
    const label = labelWidth(e[2], fs) + 6 <= bw ? e[2] : "";
    parts.push(tile(bx, by, bw, bh, label, fs, style));
  });
  y += rows * pitch + 6;

  // Key.
  const keys: Array<[string, { fill: string; stroke: string }]> = [[L.keyBest, { fill: C.c1, stroke: C.c1 }]];
  if (k > 0) keys.push([L.keyPick, { fill: C.c2, stroke: C.c2 }]);
  let kx = 0;
  for (const [lab, c] of keys) {
    const need = 24 + textWidth(lab, fs);
    if (kx > 0 && kx + need > w) { kx = 0; y += 18; }
    parts.push(tile(kx, y, 16, 13, "", fs, { fill: c.fill, opacity: 0.25, stroke: c.stroke, strokeWidth: 2 }));
    parts.push(text(kx + 22, y + 11, lab, { "font-size": fs, class: "fig-t-muted" }));
    kx += need + 16;
  }
  y += 22;
  for (const line of wrapT(L.keyDp, w)) {
    parts.push(text(0, y + 11, line, { "font-size": fs, class: "fig-t-muted" }));
    y += 16;
  }
  y += 22;

  // ---- ranked segmentations
  parts.push(text(0, y, L.table, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 20;
  const rankW = 54;
  const logX = narrow ? rankW : Math.floor(w * 0.5);
  const postX = logX + 80;
  const barX = postX + 76;
  const barW = Math.max(40, w - barX - 48);
  const head = (yy: number) => {
    parts.push(text(logX + 62, yy, L.colLog, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(postX + 58, yy, L.colPost, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
    parts.push(text(barX, yy, tpl(L.colSample, { a: fixed(p.alpha, 2) }), { "font-size": fs, class: "fig-t-muted" }));
  };
  if (!narrow) { parts.push(text(0, y, L.colSeg, { "font-size": fs, class: "fig-t-muted" })); head(y); y += 8; }
  else { head(y); y += 8; }
  const numbers = (yy: number, logp: number | null, a: number, b: number, strong: boolean) => {
    const cls = `fig-t-num${strong ? " fig-t-strong" : ""}`;
    if (logp !== null) parts.push(text(logX + 62, yy, fmtLog(logp), { "font-size": fs, "text-anchor": "end", class: cls }));
    parts.push(text(postX + 58, yy, pct(a, 1), { "font-size": fs, "text-anchor": "end", class: cls }));
    parts.push(el("rect", { x: barX, y: yy - 10, width: barW, height: 12, rx: 3, fill: C.panel }));
    parts.push(el("rect", { x: barX, y: yy - 10, width: Math.max(1.5, b * barW), height: 12, rx: 3, fill: strong ? C.c2 : C.ink3, "fill-opacity": strong ? 0.9 : 0.5 }));
    parts.push(text(w, yy, pct(b, 1), { "font-size": fs, "text-anchor": "end", class: cls }));
  };
  for (let r = 0; r < TOP; r++) {
    const q = paths[r];
    const sel = r === k;
    const rowTop = y + 6;
    y += 22;
    parts.push(text(0, y, rankName(r, L), { "font-size": fs, class: sel ? "fig-t-strong" : "fig-t-muted" }));
    parts.push(text(narrow ? rankW : rankW, y, segText(edges, q), { "font-size": fs, class: sel ? "fig-t-strong" : undefined }));
    if (narrow) y += 19;
    numbers(y, q.logp, post(q), samp(q), sel);
    parts.push(el("rect", { x: 0, y: rowTop, width: w, height: y - rowTop + 6, fill: "transparent", class: "fig-hit", "data-fig-set": `pick=${r}` }));
  }
  const restPost = 1 - paths.slice(0, TOP).reduce((s2, q) => s2 + post(q), 0);
  const restSamp = 1 - paths.slice(0, TOP).reduce((s2, q) => s2 + samp(q), 0);
  if (paths.length > TOP) {
    y += 22;
    parts.push(text(0, y, tpl(L.rest, { n: int(paths.length - TOP) }), { "font-size": fs, class: "fig-t-muted" }));
    if (narrow) y += 19;
    numbers(y, null, Math.max(0, restPost), Math.max(0, restSamp), false);
  }
  y += 28;

  // ---- the chosen path, term by term
  const q = paths[k];
  const terms = q.edges.map((i, j) => (j === 0 ? fmtLog(edges[i][3]) : `− ${fmtLog(-edges[i][3])}`)).join(" ");
  const lines = [
    tpl(L.eq, { terms: q.edges.length > 1 ? terms : fmtLog(q.logp), sum: fmtLog(q.logp) }),
    tpl(L.share, { rank: rankName(k, L), p: pct(post(q), 1), s: int(paths.length) }),
    k > 0
      ? tpl(L.sample, { a: fixed(p.alpha, 2), q: pct(samp(q), 1), qb: pct(samp(paths[0]), 1) })
      : tpl(L.sampleBest, { a: fixed(p.alpha, 2), q: pct(samp(q), 1), r: pct(1 - samp(q), 1) }),
  ];
  for (const [i, line] of lines.entries()) {
    for (const part of wrapT(line, w)) {
      parts.push(text(0, y, part, { "font-size": fs, class: i === 0 ? "fig-t-num fig-t-strong" : "fig-t-muted" }));
      y += 17;
    }
  }
  return svg(w, y + 2, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "unigram-lattice",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    word: {
      kind: "choice", label: { en: "Word", zh: "单词" }, default: "lowest",
      options: WORDS.map((x) => ({ value: x.word, label: { en: x.word, zh: x.word } })),
    },
    alpha: {
      kind: "range", label: { en: "Sampling α", zh: "采样 α" }, min: 0.05, max: 1, step: 0.05, default: 1,
      marks: [{ value: 1, label: { en: "model posterior", zh: "模型后验" } }],
    },
    pick: {
      kind: "choice", label: { en: "Path", zh: "路径" }, default: 0,
      options: Array.from({ length: TOP }, (_, i) => ({ value: i, label: i === 0 ? { en: "z*", zh: "z*" } : { en: `rank ${i + 1}`, zh: `第 ${i + 1} 名` } })),
    },
  },
  render,
  describe,
});
