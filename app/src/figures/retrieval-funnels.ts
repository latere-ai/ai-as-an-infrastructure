// Recommendation and retrieval-augmented generation as two funnels, for the
// infrastructure-before chapter. Each stage is a band whose width is the
// number of candidates it handles on a log scale, so the narrowing is drawn,
// not named. The first two stages match (retrieve by embedding similarity,
// then rescore with a richer model); the last stage and the feedback signal
// differ.
//
// Recommendation counts are YouTube's as Covington et al. (2016) describe them:
// millions of videos, hundreds of candidates, a few dozen shown (drawn as
// 10^6, 10^2, and 30). The retrieval-augmented generation counts are
// illustrative (10^6 chunks, 100 retrieved, 8 packed into context, one
// answer); the caption says so.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapLines } from "./lib/wrap-lines.ts";

interface Stage { n: number; count: string; name: string; op: string }
type Side = "rec" | "rag";

const labels = {
  en: {
    title: "Recommendation and retrieval-augmented generation as funnels",
    rec: "Recommendation (YouTube, 2016)",
    rag: "Retrieval-augmented generation (illustrative)",
    s0rec: "video catalog", s0rag: "document chunks",
    s1rec: "candidate retrieval", s1rag: "retrieval",
    s2rec: "ranking", s2rag: "reranking and context packing",
    s3rec: "ordered list shown", s3rag: "generated answer",
    op1: "a_i = e_uᵀe_i, TopK", op2: "Sort r_ψ(u, i, z_i)", op2rag: "rerank, pack under a token budget", op3rec: "items in rank order", op3rag: "one generator call over the context",
    c0rec: "millions", c1rec: "hundreds", c2rec: "dozens", c0rag: "10⁶", c1rag: "100", c2rag: "8", c3rag: "1",
    fbRec: "feedback: clicks and watch time label items and retrain retrieval and ranking",
    fbRag: "feedback: answer evaluations and citation checks tune retrieval, packing, and prompts",
    scale: "band width: candidates on a log scale",
    describe: "Two funnels. Recommendation narrows millions of videos to hundreds of candidates and a few dozen ranked items shown, with clicks and watch time as feedback. Retrieval-augmented generation narrows a million chunks to 100 retrieved and 8 packed into context, then one generator call writes an answer, with answer evaluations as feedback.",
  },
  zh: {
    title: "推荐系统与检索增强生成：两个漏斗",
    rec: "推荐系统（YouTube，2016）",
    rag: "检索增强生成（示意）",
    s0rec: "视频目录", s0rag: "文档切块",
    s1rec: "候选检索", s1rag: "检索",
    s2rec: "排序", s2rag: "重排与上下文打包",
    s3rec: "展示的有序列表", s3rag: "生成的回答",
    op1: "a_i = e_uᵀe_i, TopK", op2: "Sort r_ψ(u, i, z_i)", op2rag: "重排，在词元预算内打包", op3rec: "按排序展示条目", op3rag: "基于上下文调用一次生成模型",
    c0rec: "数百万", c1rec: "数百", c2rec: "数十", c0rag: "10⁶", c1rag: "100", c2rag: "8", c3rag: "1",
    fbRec: "反馈：点击和观看时长为条目打标，并用于重新训练检索与排序",
    fbRag: "反馈：回答评测与引用核验用于调整检索、打包和提示词",
    scale: "条带宽度：候选数量（对数刻度）",
    describe: "两个漏斗。推荐系统把数百万个视频缩小到数百个候选，再排序出数十个用于展示，以点击和观看时长作为反馈。检索增强生成把一百万个切块缩小到 100 个检索结果，再把 8 个打包进上下文，由一次生成调用写出回答，以回答评测作为反馈。",
  },
};
type L = typeof labels.en;

function stages(side: Side, L: L): Stage[] {
  if (side === "rec") return [
    { n: 1e6, count: L.c0rec, name: L.s0rec, op: "" },
    { n: 1e2, count: L.c1rec, name: L.s1rec, op: L.op1 },
    { n: 30, count: L.c2rec, name: L.s2rec, op: L.op2 },
    { n: 30, count: L.c2rec, name: L.s3rec, op: L.op3rec },
  ];
  return [
    { n: 1e6, count: L.c0rag, name: L.s0rag, op: "" },
    { n: 100, count: L.c1rag, name: L.s1rag, op: L.op1 },
    { n: 8, count: L.c2rag, name: L.s2rag, op: L.op2rag },
    { n: 1, count: L.c3rag, name: L.s3rag, op: L.op3rag },
  ];
}

type P = Record<string, never>;

function describe(_st: State<P>, lang: Lang): string {
  return labels[lang].describe;
}

// One funnel: a band per stage, centered, width from log10 of the count.
function funnel(side: Side, x0: number, w: number, y0: number, L: L, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const color = side === "rec" ? C.c1 : C.c3;
  const title = side === "rec" ? L.rec : L.rag;
  let y = y0;
  for (const ln of wrapLines(title, TYPE.label, w)) { parts.push(text(x0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  y += 6;
  const bandH = 22, textH = fs + 5;
  const minW = 24;
  const widthOf = (n: number) => minW + (w - minW) * (Math.log10(Math.max(1, n)) / 6);
  const st = stages(side, L);
  const cx = x0 + w / 2;
  st.forEach((s, i) => {
    const bw = widthOf(s.n);
    const last = i === st.length - 1;
    parts.push(el("rect", { x: cx - bw / 2, y, width: bw, height: bandH, rx: 4, fill: color, "fill-opacity": last ? 0.2 : 0.55, stroke: last ? color : undefined, "stroke-width": last ? 1.5 : undefined }));
    parts.push(text(cx, y + 15, s.count, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
    y += bandH + 4;
    for (const ln of wrapLines(s.name, fs, w)) { parts.push(text(cx, y + fs, ln, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" })); y += textH; }
    if (s.op) for (const ln of wrapLines(s.op, fs, w)) { parts.push(text(cx, y + fs, ln, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted fig-t-num" })); y += textH; }
    y += 10;
    if (!last) {
      parts.push(el("path", { d: `M${cx},${y - 8}L${cx},${y}`, stroke: C.ink3, "stroke-width": 1.2, fill: "none" }));
      parts.push(el("path", { d: `M${cx - 4},${y - 3}L${cx},${y + 2}L${cx + 4},${y - 3}Z`, fill: C.ink3 }));
      y += 6;
    }
  });
  // Feedback: a dashed return note under the funnel.
  y += 4;
  const fb = side === "rec" ? L.fbRec : L.fbRag;
  parts.push(el("line", { x1: x0, x2: x0 + 18, y1: y + fs * 0.6, y2: y + fs * 0.6, stroke: color, "stroke-width": 2, "stroke-dasharray": "4 3" }));
  for (const ln of wrapLines(fb, fs, w - 26)) { parts.push(text(x0 + 26, y + fs, ln, { "font-size": fs })); y += textH; }
  return { svg: g({}, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  let h: number;
  if (narrow) {
    const a = funnel("rec", 0, w, 0, L, fs);
    const b = funnel("rag", 0, w, a.h + 28, L, fs);
    parts.push(a.svg, b.svg);
    h = a.h + 28 + b.h;
  } else {
    const gap = 36;
    const fw = (w - gap) / 2;
    const a = funnel("rec", 0, fw, 0, L, fs);
    const b = funnel("rag", fw + gap, fw, 0, L, fs);
    parts.push(a.svg, b.svg);
    h = Math.max(a.h, b.h);
  }
  h += 18;
  parts.push(text(0, h, L.scale, { "font-size": fs, class: "fig-t-muted" }));
  if (textWidth(L.scale, fs) > w) h += 4;
  return svg(w, h + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "retrieval-funnels",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {},
  render,
  describe,
});
