// Multi-document question answering accuracy against the position of the
// document that contains the answer, as measured by Liu et al., "Lost in the
// Middle: How Language Models Use Long Contexts" (TACL 12, 2024; arXiv
// 2307.03172v3). Each prompt holds k retrieved documents (k = 10, 20, 30), one
// of which contains the answer; the paper moves that document to every fifth
// position and reports accuracy per model. Closed-book accuracy (the question
// alone) and oracle accuracy (the answer document alone) are the paper's
// reference points for the same questions.
//
// ACCURACY and BASELINES are transcribed from the paper's LaTeX source by
// tools/figure-data/lost-in-the-middle-tables.py (appendix tables
// tables/qa/{10,20,30}_total_documents.tex and tab:closedbook_and_oracle).
// Nothing here is fitted or interpolated: points are the reported positions,
// joined by straight segments.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, overlaps, textBox, textWidth, wrap, type Box } from "./lib/labels.ts";
import { fixed, tpl } from "./lib/format.ts";

type Docs = 10 | 20 | 30;
type ModelKey = "gpt35" | "gpt35_16k" | "claude" | "claude100k" | "mpt" | "longchat";

const POSITIONS: Record<Docs, number[]> = {
  10: [1, 5, 10],
  20: [1, 5, 10, 15, 20],
  30: [1, 5, 10, 15, 20, 25, 30],
};

// Accuracy in percent at POSITIONS[k]. GPT-3.5-Turbo with its 4K window was
// not run on 30 documents, which exceed it.
const ACCURACY: Record<Docs, Partial<Record<ModelKey, number[]>>> = {
  10: {
    claude: [62.9, 58.3, 59.7],
    claude100k: [63.1, 58.3, 59.7],
    gpt35: [76.8, 61.2, 62.4],
    gpt35_16k: [76.9, 61, 62.5],
    mpt: [60.2, 56.2, 59.7],
    longchat: [72.1, 58.9, 58.5],
  },
  20: {
    claude: [59.9, 55.9, 56.8, 57.2, 60.1],
    claude100k: [59.8, 55.9, 57, 57.4, 60],
    gpt35: [75.8, 57.2, 53.8, 55.4, 63.2],
    gpt35_16k: [75.7, 57.3, 54.1, 55.4, 63.1],
    mpt: [53.7, 51.8, 52.2, 52.7, 56.3],
    longchat: [68.6, 57.4, 55.3, 52.5, 55],
  },
  30: {
    claude: [59.1, 55.1, 54.8, 55.7, 56.4, 56.2, 59.9],
    claude100k: [59.1, 55.1, 54.9, 55.7, 56.6, 56.1, 60],
    gpt35_16k: [73.4, 55.1, 50.5, 50.9, 51.8, 54.9, 63.7],
    mpt: [51.6, 51.3, 51.2, 49, 49.6, 51.3, 54.1],
    longchat: [66.9, 54.8, 52.5, 52.9, 52.2, 51.3, 55.1],
  },
};

const BASELINES: Record<ModelKey, { closed: number; oracle: number }> = {
  longchat: { closed: 35, oracle: 83.4 },
  mpt: { closed: 31.5, oracle: 81.9 },
  gpt35: { closed: 56.1, oracle: 88.3 },
  gpt35_16k: { closed: 56, oracle: 88.6 },
  claude: { closed: 48.3, oracle: 76.1 },
  claude100k: { closed: 48.2, oracle: 76.4 },
};

const NAMES: Record<ModelKey, string> = {
  gpt35: "GPT-3.5-Turbo",
  gpt35_16k: "GPT-3.5-Turbo (16K)",
  claude: "Claude-1.3",
  claude100k: "Claude-1.3 (100K)",
  mpt: "MPT-30B-Instruct",
  longchat: "LongChat-13B (16K)",
};
const MODELS = Object.keys(NAMES) as ModelKey[];

const labels = {
  en: {
    title: "Accuracy by the position of the answer document",
    x: "position of the document that contains the answer",
    y: "accuracy",
    closed: "closed-book {v}",
    oracle: "oracle {v}",
    readout: "{m}, {k} documents",
    first: "answer document first",
    worst: "worst position",
    last: "answer document last",
    drop: "drop from the best position",
    vsClosed: "worst position against closed-book",
    oracleRow: "oracle, answer document alone",
    at: "{v} at position {i}",
    points: "{v} points",
    below: "{v} points below",
    above: "{v} points above",
    notRun: "{m} has a 4K window and was not run on {k} documents.",
    others: "the other models",
    keyClosed: "closed-book, no documents",
    keyOracle: "oracle, answer document alone",
    source: "Liu et al. (2024), multi-document QA",
    describe: "{m} with {k} documents: {f} with the answer document first, {w} at position {i}, {l} last. Closed-book accuracy is {c} and oracle accuracy {o}, so the worst position is {d}.",
    describeNone: "{m} was not run with {k} documents; the chart shows the other models.",
    dBelow: "{v} points below closed-book",
    dAbove: "{v} points above closed-book",
  },
  zh: {
    title: "答案文档位置与准确率",
    x: "包含答案的文档所在位置",
    y: "准确率",
    closed: "闭卷 {v}",
    oracle: "只给答案文档 {v}",
    readout: "{m}，{k} 篇文档",
    first: "答案文档在最前",
    worst: "最差位置",
    last: "答案文档在最后",
    drop: "比最佳位置下降",
    vsClosed: "最差位置与闭卷相比",
    oracleRow: "只给答案文档（oracle）",
    at: "位置 {i}：{v}",
    points: "{v} 个百分点",
    below: "低 {v} 个百分点",
    above: "高 {v} 个百分点",
    notRun: "{m} 的窗口只有 4K，没有在 {k} 篇文档的设置下测试。",
    others: "其他模型",
    keyClosed: "闭卷，不提供文档",
    keyOracle: "只给答案文档",
    source: "Liu 等人（2024），多文档问答",
    describe: "{m}，{k} 篇文档：答案文档在最前时准确率 {f}，在位置 {i} 时最低，为 {w}，在最后时 {l}。闭卷准确率 {c}，只给答案文档时 {o}，因此最差位置{d}。",
    describeNone: "{m} 没有在 {k} 篇文档的设置下测试，图中只显示其他模型。",
    dBelow: "比闭卷低 {v} 个百分点",
    dAbove: "比闭卷高 {v} 个百分点",
  },
};

type P = { docs: Docs; model: ModelKey };

const pc = (v: number) => `${fixed(v, 1)}%`;

function stats(p: P) {
  const acc = ACCURACY[p.docs][p.model];
  const base = BASELINES[p.model];
  if (!acc) return null;
  const pos = POSITIONS[p.docs];
  let wi = 0, bi = 0;
  acc.forEach((v, i) => { if (v < acc[wi]) wi = i; if (v > acc[bi]) bi = i; });
  return { acc, pos, base, worst: acc[wi], worstAt: pos[wi], best: acc[bi], bestAt: pos[bi], first: acc[0], last: acc[acc.length - 1], gap: acc[wi] - base.closed };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const s = stats(st.p);
  if (!s) return tpl(L.describeNone, { m: NAMES[st.p.model], k: st.p.docs });
  return tpl(L.describe, {
    m: NAMES[st.p.model], k: st.p.docs, f: pc(s.first), w: pc(s.worst), i: s.worstAt, l: pc(s.last),
    c: pc(s.base.closed), o: pc(s.base.oracle),
    d: tpl(s.gap < 0 ? L.dBelow : L.dAbove, { v: fixed(Math.abs(s.gap), 1) }),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const s = stats(p);
  const pos = POSITIONS[p.docs];
  const parts: string[] = [];

  // ---- plot
  const left = 40, right = narrow ? 8 : 14, top = 26;
  const plotH = narrow ? 230 : 280;
  const bottom = top + plotH;
  const x = linear([1, p.docs], [left + 8, w - right - 8]);
  const y = linear([30, 90], [bottom, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: pos, grid: [top, bottom], title: L.x, format: (v) => String(v), size: TYPE.body }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [30, 40, 50, 60, 70, 80, 90], grid: [left, w - right], title: L.y, format: (v) => `${v}%`, size: TYPE.body }));

  const obstacles: Box[] = [];
  const pts = (acc: number[]): Array<[number, number]> => acc.map((v, i) => [x(pos[i]), y(v)]);

  // The other models: thin gray lines, each a hit target that selects it.
  for (const m of MODELS) {
    const acc = ACCURACY[p.docs][m];
    if (!acc || m === p.model) continue;
    const d = linePath(pts(acc));
    parts.push(el("path", { d, fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-linejoin": "round" }));
    parts.push(el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 10, "data-fig-set": `model=${m}`, class: "fig-hit" }));
    obstacles.push(...lineObstacles(pts(acc)));
  }

  const labelReqs = [] as Parameters<typeof placeLabels>[0];
  const bounds = { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: bottom - 2 };
  if (s) {
    // Reference lines of the chosen model: closed-book (dashed) and oracle (dotted).
    const refs = [[s.base.closed, "6 4", "closed"], [s.base.oracle, "2 3", "oracle"]] as const;
    for (const [v, dash] of refs) {
      const yy = y(v);
      parts.push(el("line", { x1: left, x2: w - right, y1: yy, y2: yy, stroke: C.ink, "stroke-width": 1.3, "stroke-dasharray": dash }));
      obstacles.push(...lineObstacles([[left, yy], [w - right, yy]]));
    }
    const sp = pts(s.acc);
    parts.push(el("path", { d: linePath(sp), fill: "none", stroke: C.c1, "stroke-width": 2.6, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(sp));
    sp.forEach(([px, py], i) => {
      parts.push(el("circle", { cx: px, cy: py, r: 4.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
      obstacles.push({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
      // Value labels on the first, the worst, and the last position.
      const isWorst = pos[i] === s.worstAt;
      if (i === 0 || i === sp.length - 1 || isWorst) {
        labelReqs.push({
          x: px, y: py, text: pc(s.acc[i]), size: TYPE.body, gap: 9, priority: isWorst ? 3 : 2,
          sides: isWorst ? ["below", "below-right", "below-left", "above"] : i === 0 ? ["above-right", "right", "above", "below-right"] : ["above-left", "left", "above", "below-left"],
          attrs: { class: "fig-t-halo fig-t-num" },
        });
      }
    });
    const placed = placeLabels(labelReqs, bounds, obstacles);
    parts.push(drawLabels(placed.placed));
    obstacles.push(...placed.placed.map((q) => q.box));
    // Reference labels: the first spot along the line, above or below it, that
    // clears every model line and value label.
    for (const [v, , key] of refs) {
      const yy = y(v);
      const t = tpl(L[key], { v: pc(v) });
      const spots: Array<[number, "start" | "middle" | "end"]> = [[w - right - 4, "end"], [left + 8, "start"], [(left + w - right) / 2, "middle"], [left + (w - right - left) * 0.3, "middle"], [left + (w - right - left) * 0.7, "middle"]];
      // Close to the line first; farther offsets get a leader back to it.
      let hit: { x: number; y: number; a: "start" | "middle" | "end"; lead: boolean } | null = null;
      for (const [dy, lead] of [[-6, false], [16, false], [-22, true], [32, true], [-36, true], [46, true]] as const) {
        const ty = yy + dy;
        for (const [sx, a] of spots) {
          const b = textBox(sx, ty, t, TYPE.body, a);
          if (b.x0 < bounds.x0 || b.x1 > bounds.x1 || b.y0 < bounds.y0 || b.y1 > bounds.y1) continue;
          if (obstacles.some((o) => overlaps(o, b))) continue;
          hit = { x: sx, y: ty, a, lead };
          break;
        }
        if (hit) break;
      }
      hit ??= { x: w - right - 4, y: yy - 6, a: "end", lead: false };
      if (hit.lead) {
        const b = textBox(hit.x, hit.y, t, TYPE.body, hit.a);
        const lx = hit.a === "start" ? b.x0 + 6 : hit.a === "end" ? b.x1 - 6 : (b.x0 + b.x1) / 2;
        parts.push(el("line", { x1: lx, x2: lx, y1: yy, y2: hit.y < yy ? b.y1 + 1 : b.y0 - 1, stroke: C.ink3, "stroke-width": 1 }));
      }
      parts.push(text(hit.x, hit.y, t, { "font-size": TYPE.body, "text-anchor": hit.a, class: "fig-t-halo" }));
      obstacles.push(textBox(hit.x, hit.y, t, TYPE.body, hit.a));
    }
  }

  // Key under the plot: which line is which.
  let yy = bottom + axisHeight(true, TYPE.body) + 16;
  const key: string[] = [];
  let kx = 0;
  const keyItem = (stroke: string, width: number, dash: string | undefined, label: string) => {
    const lw = textWidth(label, TYPE.body);
    if (kx > 0 && kx + 30 + lw > w) { kx = 0; yy += 18; }
    key.push(el("line", { x1: kx, x2: kx + 22, y1: yy - 4, y2: yy - 4, stroke, "stroke-width": width, "stroke-dasharray": dash }));
    key.push(text(kx + 28, yy, label, { "font-size": TYPE.body, class: "fig-t-muted" }));
    kx += 28 + lw + 16;
  };
  if (s) keyItem(C.c1, 2.6, undefined, NAMES[p.model]);
  keyItem(C.ink3, 1.2, undefined, L.others);
  if (s) {
    keyItem(C.ink, 1.3, "6 4", L.keyClosed);
    keyItem(C.ink, 1.3, "2 3", L.keyOracle);
  }
  parts.push(g({ class: "fig-key" }, ...key));
  yy += 30;

  // ---- readout
  const rp: string[] = [];
  rp.push(text(0, yy, tpl(L.readout, { m: NAMES[p.model], k: p.docs }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  yy += 10;
  if (!s) {
    for (const line of wrap(tpl(L.notRun, { m: NAMES[p.model], k: p.docs }), TYPE.body, w)) {
      yy += 18;
      rp.push(text(0, yy, line, { "font-size": TYPE.body }));
    }
    yy += 6;
  } else {
    const rows: Array<[string, string, boolean]> = [
      [L.first, pc(s.first), false],
      [L.worst, tpl(L.at, { v: pc(s.worst), i: s.worstAt }), true],
      [L.last, pc(s.last), false],
      [L.drop, tpl(L.points, { v: fixed(s.best - s.worst, 1) }), true],
      [L.vsClosed, tpl(s.gap < 0 ? L.below : L.above, { v: fixed(Math.abs(s.gap), 1) }), true],
      [L.oracleRow, pc(s.base.oracle), false],
    ];
    for (const [name, v, strong] of rows) {
      rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
      rp.push(text(0, yy + 14, name, { "font-size": TYPE.body }));
      rp.push(text(w, yy + 14, v, { "font-size": TYPE.body, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
      yy += 20;
    }
    rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
  }
  yy += 16;
  rp.push(text(0, yy, L.source, { "font-size": TYPE.body, class: "fig-t-muted" }));
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "lost-in-the-middle",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    docs: {
      kind: "choice", label: { en: "Documents in the prompt", zh: "提示中的文档数" }, default: 20,
      options: [
        { value: 10, label: { en: "10", zh: "10" } },
        { value: 20, label: { en: "20", zh: "20" } },
        { value: 30, label: { en: "30", zh: "30" } },
      ],
    },
    model: {
      kind: "choice", control: "select", label: { en: "Model", zh: "模型" }, default: "gpt35",
      options: MODELS.map((m) => ({ value: m, label: { en: NAMES[m], zh: NAMES[m] } })),
    },
  },
  // GPT-3.5-Turbo was not run on 30 documents: moving to 30 with it selected
  // switches to its 16K twin, which was.
  update(p, key) {
    if (key === "docs" && p.docs === 30 && p.model === "gpt35") return { ...p, model: "gpt35_16k" };
    return p;
  },
  render,
  describe,
});
