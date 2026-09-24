// Hybrid retrieval from two ranked lists to a reranked candidate set, for one
// query over a fixed illustrative corpus of 14 chunks.
//
//   1. BM25 and dense retrieval each rank the searchable chunks and keep their
//      top k (the Candidate contract's raw_rank). BM25 returns only chunks
//      that share a query term; every chunk has a vector, so dense retrieval
//      ranks them all.
//   2. Reciprocal rank fusion scores the union of the two truncated lists,
//        s_RRF(d) = Σ_r 1 / (k0 + rank_r(d)),
//      where a list that does not contain d contributes nothing. For contrast
//      the reader can sum the raw scores instead. Equal scores keep the fixed
//      corpus order (the stable tie break the chapter asks for). The fused top
//      k become the reranker's candidates.
//   3. A cross-encoder reorders the candidates. It is idealized: every
//      relevant chunk scores above every other, so the figure shows the best a
//      reranker can do. Recall@k after reranking equals the candidates'
//      recall in every state; only the order, and so nDCG@k, changes.
//   4. Access: a full-access reader, or a reader who may not see the three
//      internal chunks, with the authorization filter applied before search
//      (prefilter) or to the fused top k before reranking (postfilter). Gold
//      evidence is entitlement-scoped: the relevant chunks this reader may see.
//
// Scores and relevance judgments are illustrative, written for this figure so
// that each chunk behaves as its kind does in practice (an identifier match,
// a paraphrase with no shared term, a lexical false positive, and so on).
// They are not measured.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { legend } from "./lib/legend.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- corpus

interface Chunk {
  key: string;
  rel: boolean; // supports the answer (gold)
  internal: boolean; // readable only with full access
  bm25: number; // BM25 score for the query; 0 means no query term occurs
  cos: number; // dense cosine similarity to the query
  ce: number; // idealized cross-encoder score
}

const CORPUS: Chunk[] = [
  { key: "codes", rel: true, internal: false, bm25: 12.4, cos: 0.58, ce: 0.93 },
  { key: "para", rel: true, internal: false, bm25: 0, cos: 0.87, ce: 0.91 },
  { key: "guide", rel: true, internal: false, bm25: 9.6, cos: 0.84, ce: 0.96 },
  { key: "thread", rel: true, internal: false, bm25: 6.8, cos: 0.77, ce: 0.88 },
  { key: "resume", rel: false, internal: false, bm25: 11.1, cos: 0.73, ce: 0.12 },
  { key: "download", rel: false, internal: false, bm25: 1.8, cos: 0.79, ce: 0.22 },
  { key: "quota", rel: false, internal: false, bm25: 6.1, cos: 0.69, ce: 0.18 },
  { key: "login", rel: false, internal: false, bm25: 1.2, cos: 0.75, ce: 0.07 },
  { key: "incident", rel: false, internal: true, bm25: 8.9, cos: 0.8, ce: 0.41 },
  { key: "rotation", rel: false, internal: true, bm25: 2.9, cos: 0.82, ce: 0.3 },
  { key: "scopes", rel: false, internal: true, bm25: 7.7, cos: 0.67, ce: 0.15 },
  { key: "limits", rel: false, internal: false, bm25: 4.3, cos: 0.63, ce: 0.09 },
  { key: "pricing", rel: false, internal: false, bm25: 0, cos: 0.41, ce: 0.02 },
  { key: "webhook", rel: false, internal: false, bm25: 0.7, cos: 0.49, ce: 0.04 },
];
const N = CORPUS.length;
const MAX_DEPTH = 8;
const SUM_MAX = 13.5; // bar scale for summed raw scores: the largest BM25 score plus a cosine of 1, rounded up

type Access = "full" | "pre" | "post";
type Fusion = "rrf" | "sum";
type P = { depth: number; k0: number; fusion: Fusion; access: Access; doc: number };

interface Ranked { i: number; rank: number }

function order(ids: number[], score: (i: number) => number): number[] {
  return [...ids].sort((a, b) => score(b) - score(a) || a - b);
}

function model(p: P) {
  const k = p.depth;
  const narrowReader = p.access !== "full";
  const searchable = CORPUS.map((_, i) => i).filter((i) => p.access !== "pre" || !CORPUS[i].internal);
  const bmAll = order(searchable.filter((i) => CORPUS[i].bm25 > 0), (i) => CORPUS[i].bm25);
  const deAll = order(searchable, (i) => CORPUS[i].cos);
  const bm: Ranked[] = bmAll.map((i, r) => ({ i, rank: r + 1 }));
  const de: Ranked[] = deAll.map((i, r) => ({ i, rank: r + 1 }));
  const rB = new Map(bm.slice(0, k).map((x) => [x.i, x.rank]));
  const rD = new Map(de.slice(0, k).map((x) => [x.i, x.rank]));
  const union = CORPUS.map((_, i) => i).filter((i) => rB.has(i) || rD.has(i));
  const part = (i: number): [number, number] => p.fusion === "rrf"
    ? [rB.has(i) ? 1 / (p.k0 + rB.get(i)!) : 0, rD.has(i) ? 1 / (p.k0 + rD.get(i)!) : 0]
    : [rB.has(i) ? CORPUS[i].bm25 : 0, rD.has(i) ? CORPUS[i].cos : 0];
  const score = (i: number) => { const [a, b] = part(i); return a + b; };
  const fused = order(union, score);
  const fusedTop = fused.slice(0, k);
  const removed = p.access === "post" ? fusedTop.filter((i) => CORPUS[i].internal) : [];
  const cands = fusedTop.filter((i) => !removed.includes(i));
  const reranked = order(cands, (i) => CORPUS[i].ce);
  const gold = CORPUS.map((_, i) => i).filter((i) => CORPUS[i].rel && (!narrowReader || !CORPUS[i].internal));
  const hits = (ids: number[]) => ids.filter((i) => gold.includes(i)).length;
  const idcg = (() => { let s = 0; for (let r = 1; r <= Math.min(k, gold.length); r++) s += 1 / Math.log2(r + 1); return s; })();
  const ndcg = (ids: number[]) => ids.reduce((s, i, r) => s + (gold.includes(i) ? 1 / Math.log2(r + 2) : 0), 0) / idcg;
  const tied = new Set<number>();
  for (let r = 1; r < fused.length; r++) if (Math.abs(score(fused[r]) - score(fused[r - 1])) < 1e-12) { tied.add(fused[r]); tied.add(fused[r - 1]); }
  return {
    k, bm, de, rB, rD, union, part, score, fused, fusedTop, removed, cands, reranked, gold, tied,
    lost: gold.filter((i) => !cands.includes(i)),
    excluded: p.access === "pre" ? CORPUS.map((_, i) => i).filter((i) => CORPUS[i].internal) : [],
    internalInFusion: p.access === "post" ? union.filter((i) => CORPUS[i].internal).length : 0,
    recall: { bm: hits(bm.slice(0, k).map((x) => x.i)), de: hits(de.slice(0, k).map((x) => x.i)), fused: hits(fusedTop), rr: hits(reranked) },
    ndcg: { bm: ndcg(bm.slice(0, k).map((x) => x.i)), de: ndcg(de.slice(0, k).map((x) => x.i)), fused: ndcg(cands), rr: ndcg(reranked) },
    maxScore: p.fusion === "rrf" ? 2 / (p.k0 + 1) : SUM_MAX,
  };
}
type M = ReturnType<typeof model>;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Hybrid retrieval and the reranking ceiling",
    query: "Query: “{q}”",
    queryText: "E4012 during upload: how do I resume after the token expires?",
    bm25: "BM25 (sparse)",
    dense: "Dense (cosine)",
    fusedRrf: "RRF, k₀ = {k0}",
    fusedSum: "Sum of raw scores",
    cut: "top k = {k}",
    cutFused: "top {k} to reranker",
    noMatch: "no query term",
    excludedRow: "excluded before search",
    tieNote: "equal scores keep the corpus order",
    stage2: "Cross-encoder over the candidates",
    candidates: "Candidates, fused order",
    reranked: "Reranked",
    removedTag: "filtered",
    lostTitle: "Relevant, never a candidate",
    lostNone: "Every relevant chunk is a candidate",
    relevant: "relevant",
    internal: "internal, not visible to this reader",
    fromBm25: "BM25 term",
    fromDense: "dense term",
    recallHead: "Recall@k = |R_q ∩ T_k(q)| / |R_q|",
    colStage: "top k of",
    colRecall: "Recall@k",
    colNdcg: "nDCG@k",
    rowBm25: "BM25",
    rowDense: "dense",
    rowFused: "fused",
    rowRerank: "reranked",
    gold: "R_q: {n:relevant chunk/relevant chunks} this reader may see",
    accessFull: "Full access: all 14 chunks are searchable.",
    accessPre: "Prefilter: 3 internal chunks never enter either index search, so all {k:slot holds/slots hold} visible chunks.",
    accessPost: "Postfilter: {n:internal chunk reaches/internal chunks reach} fusion; {m:fused slot is/fused slots are} then dropped, leaving {c:candidate/candidates}.",
    docRel: "relevant",
    docNot: "not relevant",
    docInternal: "internal",
    ranks: "BM25 raw_rank {rb}, score {sb}; dense raw_rank {rd}, cosine {sd}",
    unranked: "none",
    past: "{r}, past k",
    rrfEq: "s_RRF = {terms} = {s}",
    sumEq: "s = {terms} = {s}",
    notFused: "In neither top-k list, so fusion never sees it.",
    excludedDoc: "Excluded by the prefilter before search.",
    ceLine: "rerank_score {s}, position {r} of {n}",
    ceRemoved: "Dropped by the postfilter before reranking.",
    cePast: "Fused rank {r}, past k: never scored.",
    ceLost: "Never reaches the cross-encoder.",
    describe: "Candidate depth k = {k}, {fusion}, {access}: BM25 finds {rb} of {g} relevant chunks and dense retrieval {rd}; the fused top {k} holds {rf}, and reranking keeps {rr} while nDCG@k goes from {nf} to {nr}.{lost}",
    describeLost: " {t} is not a candidate, so the reranker never scores it.",
    fusionRrf: "reciprocal rank fusion with k₀ = {k0}",
    fusionSum: "raw score sum",
    readerFull: "full access",
    readerPre: "restricted reader with a prefilter",
    readerPost: "restricted reader with a postfilter",
  },
  zh: {
    title: "混合检索与重排上限",
    query: "查询：“{q}”",
    queryText: "上传时报 E4012：令牌过期后如何续传？",
    bm25: "BM25（稀疏）",
    dense: "稠密（余弦）",
    fusedRrf: "RRF，k₀ = {k0}",
    fusedSum: "原始分数相加",
    cut: "前 k = {k} 名",
    cutFused: "前 {k} 名交给重排",
    noMatch: "不含查询词",
    excludedRow: "搜索前已排除",
    tieNote: "分数相同时保持语料顺序",
    stage2: "交叉编码器重排候选",
    candidates: "候选（融合顺序）",
    reranked: "重排后",
    removedTag: "已过滤",
    lostTitle: "相关但未进入候选",
    lostNone: "所有相关分块都已进入候选",
    relevant: "相关",
    internal: "内部文档，当前读者不可见",
    fromBm25: "BM25 项",
    fromDense: "稠密项",
    recallHead: "Recall@k = |R_q ∩ T_k(q)| / |R_q|",
    colStage: "取前 k 名",
    colRecall: "Recall@k",
    colNdcg: "nDCG@k",
    rowBm25: "BM25",
    rowDense: "稠密",
    rowFused: "融合",
    rowRerank: "重排",
    gold: "R_q：当前读者可见的 {n} 个相关分块",
    accessFull: "全部可见：14 个分块都可搜索。",
    accessPre: "前置过滤：3 个内部分块不进入任何一路搜索，{k} 个名额全部留给可见分块。",
    accessPost: "后置过滤：{n} 个内部分块进入融合，随后删掉 {m} 个融合名额，只剩 {c} 个候选。",
    docRel: "相关",
    docNot: "不相关",
    docInternal: "内部",
    ranks: "BM25 raw_rank {rb}，分数 {sb}；稠密 raw_rank {rd}，余弦 {sd}",
    unranked: "无",
    past: "{r}，在 k 之后",
    rrfEq: "s_RRF = {terms} = {s}",
    sumEq: "s = {terms} = {s}",
    notFused: "不在任何一路的前 k 名里，融合看不到它。",
    excludedDoc: "前置过滤在搜索前已将其排除。",
    ceLine: "rerank_score {s}，{n} 个候选中排第 {r}",
    ceRemoved: "重排前被后置过滤删掉。",
    cePast: "融合排名第 {r}，在 k 之后，不会被评分。",
    ceLost: "到不了交叉编码器。",
    describe: "候选深度 k = {k}，{fusion}，{access}：{g} 个相关分块中，BM25 找到 {rb} 个，稠密检索找到 {rd} 个；融合后的前 {k} 名含 {rf} 个，重排后仍是 {rr} 个，nDCG@k 从 {nf} 变为 {nr}。{lost}",
    describeLost: "{t}不在候选中，重排器根本不会给它评分。",
    fusionRrf: "倒数排名融合，k₀ = {k0}",
    fusionSum: "原始分数相加",
    readerFull: "读者可见全部分块",
    readerPre: "受限读者，前置过滤",
    readerPost: "受限读者，后置过滤",
  },
};
type Labels = typeof labels.en;

const TITLES: Record<string, { en: string; zh: string }> = {
  codes: { en: "E4012 codes", zh: "E4012 错误码表" },
  para: { en: "Halted transfer", zh: "传输中断后继续" },
  guide: { en: "Resume upload", zh: "断点续传指南" },
  thread: { en: "Forum post #9", zh: "论坛第 9 楼" },
  resume: { en: "Résumé upload", zh: "上传简历" },
  download: { en: "Download link", zh: "下载链接时效" },
  quota: { en: "E4021 quota", zh: "E4021 配额错误" },
  login: { en: "Login timeout", zh: "登录超时" },
  incident: { en: "Incident 2291", zh: "事故 2291" },
  rotation: { en: "Key rotation", zh: "密钥轮换" },
  scopes: { en: "Token scopes", zh: "令牌权限范围" },
  limits: { en: "Size limits", zh: "大小限制" },
  pricing: { en: "Pricing", zh: "存储价格" },
  webhook: { en: "Webhooks", zh: "Webhook 重试" },
};

// What each chunk is, which is why it ranks where it does.
const KINDS: Record<string, { en: string; zh: string }> = {
  codes: { en: "Lists E4012 and its fix; almost no other text, so its vector matches weakly.", zh: "列出 E4012 及处理方法，几乎没有别的文字，向量匹配偏弱。" },
  para: { en: "Answers the question in other words and shares no query term.", zh: "换一种说法回答了问题，不含任何查询词。" },
  guide: { en: "Explains how to resume once the upload token expires.", zh: "说明上传令牌过期后如何续传。" },
  thread: { en: "The answer sits deep in a long thread, which dilutes both scores.", zh: "答案埋在一长串讨论深处，两种分数都被稀释。" },
  resume: { en: "Shares upload, token and expires with the query but is about job applications.", zh: "和查询一样含有上传、令牌、过期，讲的却是投递简历。" },
  download: { en: "Close in topic, but about download links, not uploads.", zh: "主题相近，但讲的是下载链接，不是上传。" },
  quota: { en: "A neighboring error code with a different cause.", zh: "相邻的错误码，原因不同。" },
  login: { en: "Close in topic, but about sign-in sessions.", zh: "主题相近，讲的是登录会话。" },
  incident: { en: "Internal incident notes that mention E4012 often but give no fix.", zh: "内部事故记录，频繁提到 E4012，但没有处理方法。" },
  rotation: { en: "Internal runbook on signing-key rotation.", zh: "关于签名密钥轮换的内部运维手册。" },
  scopes: { en: "Internal reference on token permissions.", zh: "关于令牌权限的内部参考资料。" },
  limits: { en: "Upload size limits; says nothing about expiry.", zh: "上传大小限制，与过期无关。" },
  pricing: { en: "Unrelated.", zh: "无关。" },
  webhook: { en: "Unrelated.", zh: "无关。" },
};

const title = (i: number, lang: Lang) => TITLES[CORPUS[i].key][lang];

// ---------------------------------------------------------------- drawing

const ROW = 21; // row pitch
const CHIP = 17; // chip height
const CUT = 16; // extra space after row k, where the cut line and its label sit
const FADE = 0.42; // rows past k and chunks that never advance

interface Ctx { p: P; m: M; lang: Lang; L: Labels; uid: string; sel: number; narrow: boolean }

// y of row n in a column whose rows past k sit below the cut gap.
const rowTop = (top: number, n: number, k: number) => top + n * ROW + (n >= k ? CUT : 0);

function fitTitle(s: string, maxW: number, size: number): string {
  if (textWidth(s, size) <= maxW) return s;
  let out = s;
  while (out.length > 1 && textWidth(out + "…", size) > maxW) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

// One chunk: panel, relevance dot, title, optional right-aligned value, a
// hatch when the reader may not see it, an outline when it is selected.
function chip(c: Ctx, i: number, x: number, y: number, w: number, value: string | null, o: { faded?: boolean; dashed?: boolean } = {}): string {
  const d = CORPUS[i];
  const hidden = c.p.access !== "full" && d.internal;
  const size = TYPE.body;
  const valW = value ? textWidth(value, size) + 5 : 0;
  const t = fitTitle(title(i, c.lang), w - 13 - valW - 3, size);
  return g({ opacity: o.faded ? FADE : undefined, "data-fig-set": `doc=${i + 1}`, class: "fig-hit" },
    el("rect", { x, y, width: w, height: CHIP, rx: 3, fill: C.panel, stroke: o.dashed ? C.ink3 : undefined, "stroke-dasharray": o.dashed ? "3 2" : undefined }),
    hidden && el("rect", { x, y, width: w, height: CHIP, rx: 3, fill: `url(#${c.uid}-hatch)` }),
    d.rel && el("circle", { cx: x + 6.5, cy: y + CHIP / 2, r: 3.5, fill: C.good }),
    // Over the hatch, text wears the paper-colored halo so the lines stay behind it.
    text(x + 13, y + 12.5, t, { "font-size": size, class: hidden ? (i === c.sel ? "fig-t-halo" : "fig-t-halo fig-t-soft") : i === c.sel ? "fig-t-strong" : undefined }),
    value && text(x + w - 3, y + 12.5, value, { "font-size": size, "text-anchor": "end", class: hidden ? "fig-t-num fig-t-halo fig-t-soft" : "fig-t-num fig-t-muted" }),
    i === c.sel && el("rect", { x: x - 1.5, y: y - 1.5, width: w + 3, height: CHIP + 3, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.5 }),
  );
}

// The dashed cut between row k and row k + 1, labeled at one end.
function cutLine(x: number, top: number, k: number, w: number, label: string, anchor: "start" | "end"): string {
  const y = top + k * ROW + CUT / 2 - 2;
  const lw = textWidth(label, TYPE.body) + 6;
  const [a0, a1] = anchor === "start" ? [x + lw, x + w] : [x, x + w - lw];
  return el("line", { x1: a0, x2: a1, y1: y, y2: y, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "4 3" })
    + text(anchor === "start" ? x : x + w, y + 4, label, { "font-size": TYPE.body, "text-anchor": anchor, class: "fig-t-muted" });
}

// A retriever's column: its ranking (faded past k), then the chunks it cannot
// return, with a dash in place of a rank. `mirror` puts ranks on the right so
// the dense column faces the fused column.
function channel(c: Ctx, which: "bm" | "de", x: number, y0: number, w: number, mirror: boolean) {
  const { m, L } = c;
  const list = which === "bm" ? m.bm : m.de;
  const parts: string[] = [];
  const head = which === "bm" ? L.bm25 : L.dense;
  parts.push(el("rect", { x: mirror ? x + w - 10 : x, y: y0 + 3, width: 10, height: 10, rx: 2, fill: which === "bm" ? C.c1 : C.c2 }));
  parts.push(text(mirror ? x + w - 16 : x + 16, y0 + 12, head, { "font-size": TYPE.label, "text-anchor": mirror ? "end" : "start", class: "fig-t-strong" }));
  const top = y0 + 24;
  const numW = 15;
  const cx = mirror ? x : x + numW;
  const cw = w - numW;
  const rowY = new Map<number, number>();
  const ranked = new Set(list.map((r) => r.i));
  // No-term chunks first, then the ones the prefilter excluded, so each reason is one run of rows.
  const rest = CORPUS.map((_, i) => i).filter((i) => !ranked.has(i)).sort((a, b) => Number(m.excluded.includes(a)) - Number(m.excluded.includes(b)) || a - b);
  [...list.map((r) => ({ i: r.i, rank: r.rank as number | null })), ...rest.map((i) => ({ i, rank: null }))].forEach((r, n) => {
    const yy = rowTop(top, n, m.k);
    const past = r.rank == null || r.rank > m.k;
    const v = r.rank == null ? null : which === "bm" ? fixed(CORPUS[r.i].bm25, 1) : fixed(CORPUS[r.i].cos, 2);
    parts.push(text(mirror ? x + w : x + numW - 4, yy + 12.5, r.rank ?? "–", { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    parts.push(chip(c, r.i, cx, yy, cw - (mirror ? 3 : 0), v, { faded: past, dashed: r.rank == null }));
    if (!past) rowY.set(r.i, yy + CHIP / 2);
  });
  if (list.length > m.k) parts.push(cutLine(cx, top, m.k, cw - (mirror ? 3 : 0), tpl(L.cut, { k: m.k }), mirror ? "start" : "end"));
  // Why the dashed rows have no rank.
  const excluded = rest.filter((i) => m.excluded.includes(i)).length;
  const noTerm = rest.length - excluded;
  const why = [noTerm ? `– ${L.noMatch}` : "", excluded ? `– ${L.excludedRow}` : ""].filter(Boolean);
  return { svg: g({}, ...parts), rowY, h: 24 + N * ROW + CUT, why };
}

function fusedColumn(c: Ctx, x: number, y0: number, w: number) {
  const { m, p, L } = c;
  const parts: string[] = [];
  parts.push(text(x + w / 2, y0 + 12, p.fusion === "rrf" ? tpl(L.fusedRrf, { k0: p.k0 }) : L.fusedSum, { "font-size": TYPE.label, "text-anchor": "middle", class: "fig-t-strong" }));
  const top = y0 + 24;
  const valW = textWidth(p.fusion === "rrf" ? "0.0000" : "00.0", TYPE.body) + 4;
  const chipW = c.narrow ? Math.min(150, Math.round(w * 0.48)) : 112;
  const barX = x + chipW + 5;
  const barW = w - chipW - 5 - valW - 3;
  const rowY = new Map<number, number>();
  m.fused.forEach((i, n) => {
    const yy = rowTop(top, n, m.k);
    const [a, b] = m.part(i);
    const sa = (a / m.maxScore) * barW, sb = (b / m.maxScore) * barW;
    parts.push(g({ opacity: n >= m.k ? FADE : undefined },
      chip(c, i, x, yy, chipW, null),
      el("rect", { x: barX, y: yy + 3, width: barW, height: CHIP - 6, rx: 2, fill: C.panel }),
      sa > 0 && el("rect", { x: barX, y: yy + 3, width: Math.max(1, sa), height: CHIP - 6, fill: C.c1 }),
      sb > 0 && el("rect", { x: barX + sa, y: yy + 3, width: Math.max(1, sb), height: CHIP - 6, fill: C.c2 }),
      text(x + w, yy + 12.5, p.fusion === "rrf" ? (a + b).toFixed(4) : fixed(a + b, 1), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num fig-t-muted" }),
    ));
    rowY.set(i, yy + CHIP / 2);
  });
  if (m.fused.length > m.k) parts.push(cutLine(x, top, m.k, w, tpl(L.cutFused, { k: m.k }), "end"));
  let yEnd = rowTop(top, m.fused.length, m.k) + (m.fused.length > m.k ? 0 : CUT);
  // A tie is ordered by the fixed corpus order; say so when one is on screen.
  if (m.tied.size) for (const line of wrap(L.tieNote, TYPE.body, w)) { yEnd += 13; parts.push(text(x, yEnd, line, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  return { svg: g({}, ...parts), rowY, h: yEnd - y0, chipW };
}

// Curves from a retriever's top-k rows to the same chunks in the fused column.
function links(c: Ctx, from: Map<number, number>, to: Map<number, number>, x0: number, x1: number, color: string): string {
  const out: string[] = [];
  for (const [i, ya] of from) {
    const yb = to.get(i);
    if (yb == null) continue;
    const strong = c.m.gold.includes(i) || i === c.sel;
    const mx = (x0 + x1) / 2;
    out.push(el("path", { d: `M${x0},${ya} C${mx},${ya} ${mx},${yb} ${x1},${yb}`, fill: "none", stroke: color, "stroke-width": strong ? 2 : 1.2, "stroke-opacity": strong ? 0.95 : 0.55 }));
  }
  return out.join("");
}

// Candidates in fused order (the postfilter's drops dashed), their
// cross-encoder order with rerank_score, and curves between them.
function rerankColumns(c: Ctx, xc: number, xr: number, y0: number, wc: number, wr: number): { svg: string; h: number } {
  const { m, L } = c;
  const parts: string[] = [];
  parts.push(text(xc, y0 + 12, L.candidates, { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(text(xr + wr, y0 + 12, L.reranked, { "font-size": TYPE.label, "text-anchor": "end", class: "fig-t-strong" }));
  const top = y0 + 24;
  const cy = new Map<number, number>();
  m.fusedTop.forEach((i, n) => {
    const yy = top + n * ROW;
    const gone = m.removed.includes(i);
    parts.push(chip(c, i, xc, yy, wc, gone ? L.removedTag : null, { faded: gone, dashed: gone }));
    if (!gone) cy.set(i, yy + CHIP / 2);
  });
  m.reranked.forEach((i, n) => {
    const yy = top + n * ROW;
    parts.push(chip(c, i, xr, yy, wr, fixed(CORPUS[i].ce, 2)));
    const ya = cy.get(i)!, yb = yy + CHIP / 2;
    const x0 = xc + wc + 2, x1 = xr - 2, mx = (x0 + x1) / 2;
    const rel = m.gold.includes(i);
    parts.push(el("path", { d: `M${x0},${ya} C${mx},${ya} ${mx},${yb} ${x1},${yb}`, fill: "none", stroke: rel ? C.ink2 : C.ink3, "stroke-width": rel ? 1.6 : 1 }));
  });
  return { svg: g({}, ...parts), h: 24 + Math.max(1, m.k) * ROW };
}

// The relevant chunks the reranker never sees.
function lostList(c: Ctx, x: number, y0: number, w: number): { svg: string; h: number } {
  const { m, L } = c;
  const parts: string[] = [];
  let y = y0;
  for (const line of wrap(m.lost.length ? L.lostTitle : L.lostNone, TYPE.label, w)) { y += 13; parts.push(text(x, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 7;
  for (const i of m.lost) { parts.push(chip(c, i, x, y, Math.min(w, 170), null, { dashed: true })); y += ROW; }
  return { svg: g({}, ...parts), h: y - y0 };
}

function recallTable(c: Ctx, x: number, y0: number, w: number): { svg: string; h: number } {
  const { m, L } = c;
  const parts: string[] = [];
  let y = y0 + 12;
  parts.push(text(x, y, L.recallHead, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  y += 8;
  const G = m.gold.length;
  const xN = x + w, xR = xN - Math.max(textWidth(L.colNdcg, TYPE.body), 30) - 18;
  parts.push(text(x, y + 13, L.colStage, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(text(xR, y + 13, L.colRecall, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(xN, y + 13, L.colNdcg, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  y += 18;
  const rows: Array<[string, number, number, boolean]> = [
    [L.rowBm25, m.recall.bm, m.ndcg.bm, false],
    [L.rowDense, m.recall.de, m.ndcg.de, false],
    [L.rowFused, m.recall.fused, m.ndcg.fused, true],
    [L.rowRerank, m.recall.rr, m.ndcg.rr, true],
  ];
  for (const [name, r, n, strong] of rows) {
    parts.push(el("line", { x1: x, x2: xN, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x, y + 14, name, { "font-size": TYPE.body, class: strong ? "fig-t-strong" : undefined }));
    parts.push(text(xR, y + 14, `${r} / ${G} = ${fixed(r / G, 2)}`, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" + (strong ? " fig-t-strong" : "") }));
    parts.push(text(xN, y + 14, fixed(n, 2), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
    y += 19;
  }
  parts.push(el("line", { x1: x, x2: xN, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 3;
  const access = c.p.access === "full" ? L.accessFull
    : c.p.access === "pre" ? tpl(L.accessPre, { k: m.k })
      : tpl(L.accessPost, { n: m.internalInFusion, m: m.removed.length, c: m.cands.length });
  for (const note of [tpl(L.gold, { n: G }), access]) {
    for (const line of wrap(note, TYPE.body, w)) { y += 15; parts.push(text(x, y, line, { "font-size": TYPE.body, class: "fig-t-muted" })); }
    y += 3;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

// The selected chunk: what it is, its raw ranks and scores, its fused score as
// the chapter's sum of terms, and what the cross-encoder does with it.
function docPanel(c: Ctx, x: number, y0: number, w: number): { svg: string; h: number } {
  const { m, L, lang, p } = c;
  const i = c.sel;
  const d = CORPUS[i];
  const parts: string[] = [];
  let y = y0;
  const flags = [d.rel ? L.docRel : L.docNot, ...(p.access !== "full" && d.internal ? [L.docInternal] : [])].join(lang === "zh" ? "，" : ", ");
  const head = lang === "zh" ? `${title(i, lang)}（${flags}）` : `${title(i, lang)} (${flags})`;
  for (const line of wrap(head, TYPE.label, w)) { y += 13; parts.push(text(x, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 4;
  const lines: Array<[string, string]> = [[KINDS[d.key][lang], "fig-t-muted"]];
  const find = (list: Ranked[]) => list.find((r) => r.i === i);
  const b = find(m.bm), dn = find(m.de);
  const rank = (r: Ranked | undefined) => (r ? (r.rank > m.k ? tpl(L.past, { r: r.rank }) : String(r.rank)) : L.unranked);
  lines.push([tpl(L.ranks, { rb: rank(b), sb: fixed(d.bm25, 1), rd: rank(dn), sd: fixed(d.cos, 2) }), "fig-t-num"]);
  if (m.excluded.includes(i)) lines.push([L.excludedDoc, ""]);
  else if (!m.union.includes(i)) lines.push([L.notFused, ""]);
  else {
    const [a, bb] = m.part(i);
    if (p.fusion === "rrf") {
      // Both lists appear; a list that did not return the chunk in its top k adds 0.
      const term = (r: number | undefined, v: number) => (r == null ? ["0", "0"] : [`1/(${p.k0} + ${r})`, v.toFixed(4)]);
      const [tb, vb] = term(m.rB.get(i), a), [td, vd] = term(m.rD.get(i), bb);
      lines.push([tpl(L.rrfEq, { terms: `${tb} + ${td} = ${vb} + ${vd}`, s: (a + bb).toFixed(4) }), "fig-t-num"]);
    } else {
      const terms = `${m.rB.has(i) ? fixed(d.bm25, 1) : "0"} + ${m.rD.has(i) ? fixed(d.cos, 2) : "0"}`;
      lines.push([tpl(L.sumEq, { terms, s: fixed(a + bb, 2) }), "fig-t-num"]);
    }
  }
  const fr = m.fused.indexOf(i);
  if (m.removed.includes(i)) lines.push([L.ceRemoved, ""]);
  else if (m.cands.includes(i)) lines.push([tpl(L.ceLine, { s: fixed(d.ce, 2), r: m.reranked.indexOf(i) + 1, n: m.cands.length }), "fig-t-num"]);
  else if (fr >= 0) lines.push([tpl(L.cePast, { r: fr + 1 }), ""]);
  else if (!m.excluded.includes(i)) lines.push([L.ceLost, ""]);
  for (const [s, cls] of lines) {
    for (const line of wrap(s, TYPE.body, w)) { y += 15; parts.push(text(x, y, line, { "font-size": TYPE.body, class: cls || undefined })); }
    y += 3;
  }
  return { svg: g({ class: "fig-doc" }, ...parts), h: y - y0 };
}

function selected(p: P, m: M): number {
  return p.doc > 0 ? p.doc - 1 : m.fused[0] ?? 0;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const lost = m.lost.length ? tpl(L.describeLost, { t: m.lost.map((i) => title(i, lang)).join(lang === "zh" ? "、" : ", ") }) : "";
  return tpl(L.describe, {
    k: m.k, g: m.gold.length, rb: m.recall.bm, rd: m.recall.de, rf: m.recall.fused, rr: m.recall.rr,
    nf: fixed(m.ndcg.fused, 2), nr: fixed(m.ndcg.rr, 2), lost,
    fusion: p.fusion === "rrf" ? tpl(L.fusionRrf, { k0: p.k0 }) : L.fusionSum,
    access: p.access === "full" ? L.readerFull : p.access === "pre" ? L.readerPre : L.readerPost,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const c: Ctx = { p, m, lang, L, uid: st.uid, sel: selected(p, m), narrow };
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-hatch`, C.ink3, 5, 1))];

  // Query and legend.
  let y = 0;
  for (const line of wrap(tpl(L.query, { q: L.queryText }), TYPE.label, w)) { y += 17; parts.push(text(0, y, line, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 8;
  const lg = legend([
    { label: L.relevant, swatch: { kind: "dot", fill: C.good } },
    { label: L.fromBm25, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.fromDense, swatch: { kind: "rect", fill: C.c2 } },
    ...(p.access !== "full" ? [{ label: L.internal, swatch: { kind: "rect" as const, fill: C.panel, pattern: `${st.uid}-hatch` } }] : []),
  ], 0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height + 12;

  // Stage 1: two retrievers and their fusion. Desktop: BM25 | fused | dense,
  // with curves into the middle. Phone: the two lists side by side, the fused
  // list below them.
  const gap = 26;
  const colW = narrow ? Math.floor((w - 8) / 2) : 170;
  const xD = w - colW;
  if (!narrow) {
    const xF = colW + gap, fw = w - 2 * colW - 2 * gap;
    const bm = channel(c, "bm", 0, y, colW, false);
    const de = channel(c, "de", xD, y, colW, true);
    const fu = fusedColumn(c, xF, y, fw);
    parts.push(links(c, bm.rowY, fu.rowY, colW + 3, xF - 3, C.c1), links(c, de.rowY, fu.rowY, xD - 3, xF + fw + 4, C.c2), bm.svg, de.svg, fu.svg);
    const h1 = Math.max(bm.h, de.h, fu.h);
    let yb = y + h1, yd = y + h1;
    for (const s of bm.why) { yb += 14; parts.push(text(15, yb, s, { "font-size": TYPE.body, class: "fig-t-muted" })); }
    for (const s of de.why) { yd += 14; parts.push(text(w, yd, s, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" })); }
    y = Math.max(yb, yd) + 22;
  } else {
    const bm = channel(c, "bm", 0, y, colW, false);
    const de = channel(c, "de", xD, y, colW, true);
    parts.push(bm.svg, de.svg);
    y += Math.max(bm.h, de.h);
    for (const [label, why] of [[L.bm25, bm.why], [L.dense, de.why]] as const) {
      for (const s of why) for (const line of wrap(`${label} ${s}`, TYPE.body, w)) { y += 14; parts.push(text(0, y, line, { "font-size": TYPE.body, class: "fig-t-muted" })); }
    }
    y += 16;
    const fu = fusedColumn(c, 0, y, w);
    parts.push(fu.svg);
    y += fu.h + 20;
  }

  // Stage 2: the cross-encoder over the fused top k.
  parts.push(text(0, y + 13, L.stage2, { "font-size": TYPE.title, class: "fig-t-strong" }));
  y += 26;
  if (!narrow) {
    const xF = colW + gap;
    const rc = rerankColumns(c, xF, xD, y, 150, colW);
    const lost = lostList(c, 0, y, colW);
    parts.push(rc.svg, lost.svg);
    y += Math.max(rc.h, lost.h) + 14;
  } else {
    const rw = Math.floor((w - 22) / 2);
    const rc = rerankColumns(c, 0, w - rw, y, rw, rw);
    parts.push(rc.svg);
    y += rc.h + 8;
    const lost = lostList(c, 0, y, w);
    parts.push(lost.svg);
    y += lost.h + 14;
  }

  // Readout: recall and nDCG by stage, and the selected chunk.
  if (!narrow) {
    const half = Math.floor((w - 28) / 2);
    const rt = recallTable(c, 0, y, half);
    const dp = docPanel(c, half + 28, y, w - half - 28);
    parts.push(rt.svg, dp.svg);
    y += Math.max(rt.h, dp.h);
  } else {
    const rt = recallTable(c, 0, y, w);
    parts.push(rt.svg);
    y += rt.h + 14;
    const dp = docPanel(c, 0, y, w);
    parts.push(dp.svg);
    y += dp.h;
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "hybrid-retrieval",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    depth: {
      kind: "range", label: { en: "Candidate depth k", zh: "候选深度 k" }, min: 1, max: MAX_DEPTH, step: 1, default: 4,
      unit: { en: "per list", zh: "每路" },
    },
    k0: {
      kind: "range", label: { en: "RRF constant k₀", zh: "RRF 常数 k₀" }, min: 1, max: 100, step: 1, default: 60,
      marks: [{ value: 60, label: { en: "60, Cormack et al.", zh: "60，Cormack 等人" } }],
    },
    fusion: {
      kind: "choice", label: { en: "Fusion", zh: "融合方式" }, default: "rrf",
      options: [
        { value: "rrf", label: { en: "Reciprocal rank", zh: "倒数排名" } },
        { value: "sum", label: { en: "Sum of raw scores", zh: "原始分数相加" } },
      ],
    },
    access: {
      kind: "choice", label: { en: "Reader", zh: "读者" }, default: "full",
      options: [
        { value: "full", label: { en: "Full access", zh: "全部可见" } },
        { value: "pre", label: { en: "Restricted, prefilter", zh: "受限，前置过滤" } },
        { value: "post", label: { en: "Restricted, postfilter", zh: "受限，后置过滤" } },
      ],
    },
    doc: {
      kind: "choice", control: "select", label: { en: "Explain chunk", zh: "查看分块" }, default: 0,
      options: [
        { value: 0, label: { en: "Top fused chunk", zh: "融合第一名" } },
        ...CORPUS.map((d, i) => ({ value: i + 1, label: { en: TITLES[d.key].en, zh: TITLES[d.key].zh } })),
      ],
    },
  },
  render,
  describe,
});
