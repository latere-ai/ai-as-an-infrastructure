// Per-stage retention in three published web-curation pipelines, drawn as a
// vertical flow: the trunk is what survives, and each stage peels off a
// branch for what it removed, colored by the kind of decision it made. Every
// number is transcribed from the paper; the figure only draws and divides.
//
// - DCLM-Baseline from DCLM-Pool: Li et al., "DataComp-LM", arXiv 2406.11794v4,
//   Figure 4 (percentages "based on the total number of original documents",
//   stage order as drawn there) and §3.1 (the pool: 200B documents, 240T
//   GPT-NeoX tokens after resiliparse extraction). DCLM-Baseline is 3.8T
//   tokens (§1, Table 19). Removed documents are share × 200B.
// - RefinedWeb: Penedo et al., "The RefinedWeb Dataset for Falcon LLM", arXiv
//   2306.01116v1, Figure 2. The figure reports each stage's removal rate
//   relative to the previous stage and the kept rate overall, "measured in %
//   of documents in the document preparation phase, then in tokens", so the
//   kept rates after language identification multiply a document fraction by
//   token fractions. Values are the published ones; the last stage's pair does
//   not multiply exactly (14.50% × (1 − 18.47%) = 11.82%, reported 11.67%).
//   Stage rules from §3.1 to §3.3; about 5T tokens (§3, Table 1).
// - FineWeb: Penedo et al., "The FineWeb Datasets", arXiv 2406.17557v2,
//   §3.3 to §3.7: about 36T GPT-2 tokens after base filtering of 96
//   snapshots, 20T after per-snapshot MinHash (global MinHash left 4T), and
//   the 15T release after the C4 and custom filters. The input to base
//   filtering is not reported, so this flow starts at 36T.

import { defineFigure, type Lang, type State, type Text } from "./types.ts";
import { svg, el, text, r as rd } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { fixed, int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- data

type Kind = "policy" | "extract" | "heuristic" | "model" | "dedup";
type Unit = "documents" | "tokens";

interface Stage {
  name: Text;
  rule?: Text; // the rule as the paper states it; omitted where the paper only names the filter
  kind: Kind;
  kept: number; // share of the starting pool after this stage, percent, as published
  rate: number; // removal as a percent of this stage's input (published or kept_{i-1} − kept_i over kept_{i-1})
  unit: Unit; // unit the published rate is measured in
  abs?: Text; // absolute amount removed, where the paper gives the pool size
  checkpoint?: Text; // the paper's name for the data after this stage
}

interface Pipeline {
  name: Text;
  pool: Text; // the 100% the flow starts from
  poolNote: Text;
  out: Text; // the release, with its size
  mixed?: number; // index of the first stage measured in tokens after document stages
  stages: Stage[];
}

const T = (en: string, zh: string): Text => ({ en, zh });
const rel = (prev: number, kept: number) => (100 * (prev - kept)) / prev;

// DCLM Figure 4 gives removals as percentages of all original documents.
const dclmRemoved = [0.8, 50.8, 9.0, 7.9, 9.6, 2.0, 6.2, 12.3];
const dclmKept = dclmRemoved.reduce<number[]>((acc, r) => [...acc, Math.round(((acc.at(-1) ?? 100) - r) * 10) / 10], []);
const dclmDocs = (i: number) => {
  const n = (dclmRemoved[i] / 100) * 200;
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
};

const PIPELINES: Record<"dclm" | "refinedweb" | "fineweb", Pipeline> = {
  dclm: {
    name: T("DCLM-Baseline", "DCLM-Baseline"),
    pool: T("DCLM-Pool: 200B documents, 240T tokens", "DCLM-Pool：2,000 亿篇文档，240T 词元"),
    poolNote: T("Every share is of the pool's documents.", "所有比例都以数据池的文档数为基准。"),
    out: T("DCLM-Baseline: 1.4% of the documents, 3.8T tokens (1.6% of the pool's tokens)", "DCLM-Baseline：保留 1.4% 的文档，3.8T 词元（数据池词元的 1.6%）"),
    stages: [
      { name: T("URL filter", "URL 过滤"), kind: "policy" },
      { name: T("English filter", "英语过滤"), kind: "heuristic" },
      { name: T("Other filters", "其他过滤器"), rule: T("word length, ellipsis count, stop words", "词长、省略号数量、停用词"), kind: "heuristic" },
      { name: T("Page length filter", "页面长度过滤"), kind: "heuristic" },
      { name: T("Repetition filter", "重复过滤"), kind: "heuristic" },
      { name: T("Word removal ratio filter", "删词比例过滤"), kind: "heuristic", checkpoint: T("RefinedWeb reproduction", "RefinedWeb 复现") },
      { name: T("Bloom filter dedup", "Bloom 过滤器去重"), rule: T("repeated paragraphs and documents", "重复的段落和文档"), kind: "dedup" },
      { name: T("fastText quality filter", "fastText 质量过滤"), rule: T("keeps the top 10% of documents by a classifier trained with OpenHermes 2.5 and ELI5 as positives", "按以 OpenHermes 2.5 和 ELI5 为正例训练的分类器打分，保留前 10% 的文档"), kind: "model" },
    ].map((s, i) => ({
      ...s, kind: s.kind as Kind, unit: "documents" as Unit,
      kept: dclmKept[i], rate: rel(i ? dclmKept[i - 1] : 100, dclmKept[i]),
      abs: T(`≈${dclmDocs(i)}B documents`, `约 ${int((dclmRemoved[i] / 100) * 2000)} 亿篇文档`),
    })),
  },
  refinedweb: {
    name: T("RefinedWeb", "RefinedWeb"),
    pool: T("Common Crawl", "Common Crawl"),
    poolNote: T("Rates are in documents for the first three stages, then in tokens.", "前三个阶段按文档计，之后按词元计。"),
    out: T("RefinedWeb: 11.67% as published, about 5T tokens", "RefinedWeb：按论文数字保留 11.67%，约 5T 词元"),
    mixed: 3,
    stages: [
      { name: T("URL filtering", "URL 过滤"), rule: T("4.6M-domain blocklist and URL score", "460 万个域名的屏蔽列表与 URL 评分"), kind: "policy", kept: 97.76, rate: 2.24, unit: "documents" },
      { name: T("Text extraction", "正文提取"), rule: T("trafilatura on raw WARC", "对原始 WARC 运行 trafilatura"), kind: "extract", kept: 96.31, rate: 1.49, unit: "documents" },
      { name: T("Language identification", "语言识别"), rule: T("fastText top-language score below 0.65", "fastText 最高语言得分低于 0.65"), kind: "heuristic", kept: 47.51, rate: 50.66, unit: "documents", checkpoint: T("RW-Raw", "RW-Raw") },
      { name: T("Repetition removal", "重复内容移除"), rule: T("excessive line, paragraph or n-gram repetition", "行、段落或 n-gram 重复过多"), kind: "heuristic", kept: 35.97, rate: 24.28, unit: "tokens" },
      { name: T("Document-wise filtering", "文档级过滤"), rule: T("length, symbol-to-word ratio and other outliers", "长度、符号词比等离群值"), kind: "heuristic", kept: 30.15, rate: 16.19, unit: "tokens" },
      { name: T("Line-wise corrections", "行级修正"), rule: T("drop a document if corrections remove more than 5%", "修正删掉 5% 以上时丢弃整篇"), kind: "heuristic", kept: 23.34, rate: 22.59, unit: "tokens", checkpoint: T("RW-Filtered", "RW-Filtered") },
      // 450 bands of 20 rows: RefinedWeb's §3.3 prose inverts the two counts; see lsh-banding.ts.
      { name: T("Fuzzy deduplication", "模糊去重"), rule: T("MinHash, 450 bands of 20 rows", "MinHash，450 个分带，每带 20 行"), kind: "dedup", kept: 14.5, rate: 37.88, unit: "tokens" },
      { name: T("Exact deduplication", "精确去重"), rule: T("suffix array, matches of 50 or more tokens", "后缀数组，50 个及以上词元的匹配"), kind: "dedup", kept: 11.67, rate: 18.47, unit: "tokens" },
    ].map((s) => ({ ...s, kind: s.kind as Kind, unit: s.unit as Unit })),
  },
  fineweb: {
    name: T("FineWeb", "FineWeb"),
    pool: T("Base-filtered text of 96 snapshots: 36T tokens", "96 个快照经基础过滤后的文本：36T 词元"),
    poolNote: T("Base filtering (URL blocklist, fastText English ≥ 0.65, MassiveText quality and repetition rules) comes first; its input is not reported.", "此前先做基础过滤（URL 屏蔽列表、fastText 英语得分 ≥ 0.65、MassiveText 的质量与重复规则），其输入量未报告。"),
    out: T("FineWeb: 15T tokens, 41.7% of the base-filtered tokens", "FineWeb：15T 词元，为基础过滤后词元的 41.7%"),
    stages: [
      { name: T("Per-snapshot MinHash", "逐快照 MinHash"), rule: T("each snapshot deduplicated alone; global MinHash kept 4T and trained worse", "每个快照单独去重；全局 MinHash 只留下 4T，训练效果更差"), kind: "dedup", kept: (20 / 36) * 100, rate: (16 / 36) * 100, unit: "tokens", abs: T("16T tokens", "16T 词元") },
      { name: T("C4 and custom filters", "C4 与自定义过滤器"), rule: T("C4 rules except terminal punctuation, then three custom heuristics", "除句末标点外的 C4 规则，再加三条自定义启发式规则"), kind: "heuristic", kept: (15 / 36) * 100, rate: 25, unit: "tokens", abs: T("5T tokens", "5T 词元") },
    ].map((s) => ({ ...s, kind: s.kind as Kind, unit: s.unit as Unit })),
  },
};
type PipeKey = keyof typeof PIPELINES;

const KIND_COLOR: Record<Kind, string> = { policy: C.c2, extract: C.c3, heuristic: C.c4, model: C.c5, dedup: C.c6 };
const KIND_ORDER: Kind[] = ["policy", "extract", "heuristic", "model", "dedup"];

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Per-stage retention in published web-curation pipelines",
    policy: "URL policy",
    extract: "text extraction",
    heuristic: "language and heuristic filters",
    model: "model-based filter",
    dedup: "deduplication",
    kept: "kept",
    removedPool: "−{p} of the pool, {r} of its input",
    removedRate: "removes {r} of its input, in {u}",
    removedAbs: "removes {r} of its input",
    documents: "documents",
    tokens: "tokens",
    switch: "document rates above, token rates below",
    chained: "‡ after the switch the kept share multiplies a document fraction by token fractions",
    describe: "{name}: {n} stages keep {k} of the starting pool. The largest removal is {stage}, {r} of its input.",
  },
  zh: {
    title: "公开的网页数据筛选流水线各阶段保留量",
    policy: "URL 策略",
    extract: "正文提取",
    heuristic: "语言与启发式过滤",
    model: "基于模型的过滤",
    dedup: "去重",
    kept: "保留",
    removedPool: "占数据池 −{p}，占本阶段输入 {r}",
    removedRate: "去掉本阶段输入的 {r}，按{u}计",
    removedAbs: "去掉本阶段输入的 {r}",
    documents: "文档",
    tokens: "词元",
    switch: "上方按文档计，下方按词元计",
    chained: "‡ 切换之后的保留比例是文档比例与后续词元比例的乘积",
    describe: "{name}：{n} 个阶段后保留起始数据的 {k}。去掉最多的是{stage}，占其输入的 {r}。",
  },
};

type P = { pipeline: PipeKey };

const pct = (v: number, d = 1) => `${fixed(v, d)}%`;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const pl = PIPELINES[st.p.pipeline];
  const big = pl.stages.reduce((a, s) => (s.rate > a.rate ? s : a));
  return tpl(L.describe, { name: pl.name[lang], n: pl.stages.length, k: pct(pl.stages.at(-1)!.kept, st.p.pipeline === "refinedweb" ? 2 : 1), stage: big.name[lang], r: pct(big.rate, st.p.pipeline === "refinedweb" ? 2 : 0) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const key = st.p.pipeline;
  const pl = PIPELINES[key];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const fn = narrow ? TYPE.body : TYPE.body; // stage names
  const wr = (s: string, size: number, max: number) => (lang === "zh" ? wrapCjk : wrap)(s, size, max);
  const dp = key === "refinedweb" ? 2 : 1;
  const parts: string[] = [];

  // Legend: the kinds of decision this pipeline makes, then the trunk.
  const kinds = KIND_ORDER.filter((k) => pl.stages.some((s) => s.kind === k));
  const lg = legend([
    { label: L.kept, swatch: { kind: "rect", fill: C.c1, opacity: 0.45 } },
    ...kinds.map((k) => ({ label: L[k], swatch: { kind: "rect" as const, fill: KIND_COLOR[k], opacity: 0.75 } })),
  ], 0, 0, w, fs);
  parts.push(lg.svg);
  let y = lg.height + 12;

  // Pool header.
  for (const ln of wr(pl.pool[lang], TYPE.label, w)) { y += TYPE.label + 3; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  for (const ln of wr(pl.poolNote[lang], fs, w)) { y += fs + 4; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  y += 14;

  // Geometry: kept labels | trunk | bends | sinks | stage labels.
  const keptW = textWidth("100.00%‡", fs) + 8;
  const xT = keptW;
  const W = narrow ? 74 : 168;
  const rho = narrow ? 8 : 10;
  const xs = xT + W + rho + (narrow ? 8 : 24);
  const labX = xs + (narrow ? 8 : 10);
  // Wrap a little short of the edge: digits and % run wider than the estimate.
  const labW = w - labX - (narrow ? 10 : 6);
  const top = y;

  // Stage label blocks, measured first so rows can be spaced to fit them.
  const blocks = pl.stages.map((s, i) => {
    const lines: Array<[string, string, number]> = [];
    for (const ln of wr(s.name[lang] + (s.checkpoint ? ` → ${s.checkpoint[lang]}` : ""), fn, labW)) lines.push([ln, "fig-t-strong", fn]);
    const prev = i ? pl.stages[i - 1].kept : 100;
    const r = pct(s.rate, dp);
    const detail = key === "dclm" ? tpl(L.removedPool, { p: pct(prev - s.kept), r: pct(s.rate, 0) }) + (s.abs ? ` · ${s.abs[lang]}` : "")
      : key === "refinedweb" ? tpl(L.removedRate, { r, u: L[s.unit] })
      : tpl(L.removedAbs, { r: pct(s.rate, 0) }) + (s.abs ? ` · ${s.abs[lang]}` : "");
    for (const ln of wr(detail, fs, labW)) lines.push([ln, "fig-t-num", fs]);
    if (s.rule) for (const ln of wr(s.rule[lang], fs, labW)) lines.push([ln, "fig-t-muted", fs]);
    const h = lines.reduce((a, [, , sz]) => a + sz + 4, 0);
    return { lines, h };
  });

  const ribbons: string[] = [];
  const labelsOut: string[] = [];
  const keptOut: string[] = [];
  const trunkEdge: Array<[number, number]> = [[xT + W, top]]; // right edge of the trunk, top to bottom
  keptOut.push(text(xT - 6, top + fs, "100%", { "font-size": fs, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
  let yi = top + (narrow ? 22 : 24);
  let labelBottom = top;
  let prevKept = 100;
  let keptY = top + fs;
  const gap = 8;
  for (let i = 0; i < pl.stages.length; i++) {
    const s = pl.stages[i];
    const blk = blocks[i];
    const t = Math.max(1.2, (W * (prevKept - s.kept)) / 100);
    // Space the row so its label, centered on the ribbon, clears the one above.
    yi = Math.max(yi, labelBottom + 6 + blk.h / 2 - rho - t / 2);
    // Unit switch (RefinedWeb): a rule across the figure before the first token stage.
    if (pl.mixed === i) {
      // The note sits in the label column, above the rule, clear of the trunk.
      const note = wr(L.switch, fs, labW);
      const ly = Math.max(yi - 4, labelBottom + note.length * (fs + 3) + 8);
      parts.push(el("line", { x1: 0, x2: w, y1: ly, y2: ly, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "5 3" }));
      note.forEach((ln, k) => parts.push(text(labX, ly - 5 - (note.length - 1 - k) * (fs + 3), ln, { "font-size": fs, class: "fig-t-halo fig-t-soft" })));
      yi = Math.max(yi, ly + 4) + 10;
      labelBottom = ly + 2;
      yi = Math.max(yi, labelBottom + 6 + blk.h / 2 - rho - t / 2);
    }
    const a = xT + (W * s.kept) / 100, b = xT + (W * prevKept) / 100;
    trunkEdge.push([b, yi], [a, yi]);
    const R1 = rho + (b - a);
    ribbons.push(el("path", {
      d: `M${rd(a)},${rd(yi)} A${rd(R1)},${rd(R1)} 0 0 0 ${rd(b + rho)},${rd(yi + rho + (b - a))} L${rd(xs)},${rd(yi + rho + (b - a))} L${rd(xs)},${rd(yi + rho)} L${rd(b + rho)},${rd(yi + rho)} A${rho},${rho} 0 0 1 ${rd(b)},${rd(yi)} Z`,
      fill: KIND_COLOR[s.kind], "fill-opacity": 0.75,
    }));
    ribbons.push(el("rect", { x: xs, y: yi + rho - 0.5, width: 4, height: Math.max(2, b - a) + 1, fill: KIND_COLOR[s.kind] }));
    // Label block centered on the ribbon's horizontal run.
    const cy = yi + rho + (b - a) / 2;
    let ly = Math.max(labelBottom + 6, cy - blk.h / 2);
    for (const [ln, cls, sz] of blk.lines) { ly += sz; labelsOut.push(text(labX, ly - 1, ln, { "font-size": sz, class: cls })); ly += 4; }
    labelBottom = ly;
    // Kept share after this stage, beside the narrowed trunk.
    const mark = pl.mixed != null && i >= pl.mixed ? "‡" : "";
    keptY = Math.max(yi + rho + fs + 2, keptY + fs + 4);
    keptOut.push(text(xT - 6, keptY, pct(s.kept, dp) + mark, { "font-size": fs, "text-anchor": "end", class: i === pl.stages.length - 1 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    yi += Math.max(t, 2) + gap;
    prevKept = s.kept;
  }
  // The trunk: left edge straight down, right edge stepping in at each stage.
  const end = Math.max(yi + 10, labelBottom + 4);
  const last = xT + (W * prevKept) / 100;
  trunkEdge.push([last, end]);
  const d = `M${rd(xT)},${rd(top)} ` + trunkEdge.map(([px, py]) => `L${rd(px)},${rd(py)}`).join(" ") + ` L${rd(xT)},${rd(end)} Z`;
  parts.push(el("path", { d, fill: C.c1, "fill-opacity": 0.45 }));
  parts.push(...ribbons, ...keptOut, ...labelsOut);

  // The release, at the foot of the trunk.
  let yo = end + 4;
  parts.push(el("line", { x1: xT, x2: xT + Math.max(W * 0.5, 40), y1: end, y2: end, stroke: C.ink2, "stroke-width": 1 }));
  for (const ln of wr(pl.out[lang], TYPE.label, w - xT)) { yo += TYPE.label + 4; parts.push(text(xT, yo, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  if (pl.mixed != null) for (const ln of wr(L.chained, fs, w)) { yo += fs + 6; parts.push(text(0, yo, ln, { "font-size": fs, class: "fig-t-muted" })); }
  return svg(w, yo + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "curation-retention",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    pipeline: {
      kind: "choice", label: { en: "Pipeline", zh: "流水线" }, default: "dclm",
      options: [
        { value: "dclm", label: { en: "DCLM-Baseline", zh: "DCLM-Baseline" } },
        { value: "refinedweb", label: { en: "RefinedWeb", zh: "RefinedWeb" } },
        { value: "fineweb", label: { en: "FineWeb", zh: "FineWeb" } },
      ],
    },
  },
  render,
  describe,
});
