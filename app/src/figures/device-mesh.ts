// A device mesh on 64 accelerators: which communication groups stay inside a
// node and which cross the network between nodes.
//
// The cluster is 8 nodes of 8 accelerators, the shape of an 8-GPU server whose
// devices share a fast scale-up fabric while nodes meet over a slower
// scale-out network. It is illustrative, not a measured topology.
//
// The reader sets the tensor-parallel degree T, pipeline stages p, and
// context-parallel degree C; the data-parallel degree is D = N / (T·p·C), the
// chapter's N = D·T·p·C. A rank order says which axis varies fastest across
// consecutive ranks, and ranks fill nodes in order (ranks 0..7 on node 1).
// Megatron-LM's default order puts TP innermost (tp, cp, dp, pp), which keeps
// a TP group of up to 8 inside one node. Each axis's groups are the ranks that
// agree on every other coordinate; the figure reports how many nodes each
// group spans.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { legend } from "./lib/legend.ts";
import { tpl } from "./lib/format.ts";

const N = 64;
const PER_NODE = 8;
const NODES = N / PER_NODE;

type Axis = "tp" | "cp" | "dp" | "pp";
type OrderKey = "tcdp" | "dtcp" | "pdtc";
const ORDERS: Record<OrderKey, Axis[]> = {
  tcdp: ["tp", "cp", "dp", "pp"], // Megatron-LM default: TP varies fastest
  dtcp: ["dp", "tp", "cp", "pp"],
  pdtc: ["pp", "dp", "tp", "cp"],
};
const AXES: Axis[] = ["tp", "cp", "pp", "dp"];

type P = { T: number; pp: number; C: number; order: OrderKey; show: Axis; gpu: number };

function degrees(p: P): Record<Axis, number> {
  return { tp: p.T, cp: p.C, pp: p.pp, dp: N / (p.T * p.pp * p.C) };
}

// Coordinates of every rank under the chosen order.
function coords(p: P): Array<Record<Axis, number>> {
  const deg = degrees(p);
  const order = ORDERS[p.order];
  return Array.from({ length: N }, (_, r) => {
    const c = {} as Record<Axis, number>;
    let rest = r;
    for (const a of order) { c[a] = rest % deg[a]; rest = Math.floor(rest / deg[a]); }
    return c;
  });
}

// Groups of one axis: ranks that share every other coordinate, each group
// listed in order of its coordinate on the axis.
function groups(p: P, axis: Axis): number[][] {
  const cs = coords(p);
  const key = (c: Record<Axis, number>) => AXES.filter((a) => a !== axis).map((a) => c[a]).join(",");
  const m = new Map<string, number[]>();
  cs.forEach((c, r) => { const k = key(c); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
  return [...m.values()].map((gr) => gr.sort((a, b) => cs[a][axis] - cs[b][axis]));
}

const nodeOf = (r: number) => Math.floor(r / PER_NODE);
const span = (gr: number[]) => new Set(gr.map(nodeOf)).size;

const labels = {
  en: {
    title: "A device mesh on 64 accelerators",
    mesh: "N = D · T · p · C = {d} · {t} · {p} · {c} = 64",
    cluster: "8 nodes of 8 accelerators; ranks fill nodes in order",
    showing: "{axis} groups: {g:group/groups} of {k}; highlighted: the group of rank {r}",
    node: "node {i}",
    inLink: "link inside a node",
    outLink: "link between nodes",
    focus: "highlighted group",
    tp: "TP", cp: "CP", pp: "PP", dp: "DP",
    colAxis: "axis",
    colDeg: "degree",
    colGroups: "groups",
    colSpan: "nodes per group",
    trafficTp: "all-reduce inside every layer",
    trafficCp: "key/value exchange in every attention layer",
    trafficPp: "point-to-point at stage boundaries, every micro-batch",
    trafficDp: "gradient reduction once per step, overlappable",
    inside: "1: inside a node",
    across: "{k}: crosses nodes",
    one: "degree 1: no group traffic",
    tpIn: "Every TP group sits inside one node, so the per-layer all-reduces stay on the fast links.",
    tpOut: "TP groups span {k} nodes: every layer's all-reduce crosses the network between nodes.",
    describe: "{mesh}. Rank order {order}. {rows}.",
    row: "{axis} {deg}: {g:group/groups}, each spanning {k:node/nodes}",
  },
  zh: {
    title: "64 台加速器上的设备网格",
    mesh: "N = D · T · p · C = {d} · {t} · {p} · {c} = 64",
    cluster: "8 个节点，每个节点 8 台加速器；rank 按顺序填满节点",
    showing: "{axis} 通信组：{g} 个组，每组 {k} 台；高亮 rank {r} 所在的组",
    node: "节点 {i}",
    inLink: "节点内链路",
    outLink: "跨节点链路",
    focus: "高亮的组",
    tp: "TP", cp: "CP", pp: "PP", dp: "DP",
    colAxis: "并行轴",
    colDeg: "并行度",
    colGroups: "组数",
    colSpan: "每组跨越的节点",
    trafficTp: "每一层都有 all-reduce",
    trafficCp: "每个注意力层都要交换键值块",
    trafficPp: "阶段边界上的点对点传输，每个微批一次",
    trafficDp: "每步一次梯度归约，可与计算重叠",
    inside: "1：在节点内",
    across: "{k}：跨节点",
    one: "并行度为 1：没有组内通信",
    tpIn: "每个 TP 组都在同一节点内，逐层的 all-reduce 只走快速链路。",
    tpOut: "每个 TP 组跨越 {k} 个节点：每一层的 all-reduce 都要经过节点间网络。",
    describe: "{mesh}。rank 顺序 {order}。{rows}。",
    row: "{axis} 并行度 {deg}：{g} 个组，每组跨 {k} 个节点",
  },
};

const ORDER_TEXT: Record<OrderKey, string> = { tcdp: "TP, CP, DP, PP", dtcp: "DP, TP, CP, PP", pdtc: "PP, DP, TP, CP" };

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const deg = degrees(p);
  const rows = AXES.map((a) => {
    const gs = groups(p, a);
    return tpl(L.row, { axis: L[a], deg: deg[a], g: gs.length, k: Math.max(...gs.map(span)) });
  }).join(lang === "zh" ? "；" : "; ");
  return tpl(L.describe, { mesh: tpl(L.mesh, { d: deg.dp, t: p.T, p: p.pp, c: p.C }), order: ORDER_TEXT[p.order], rows });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const deg = degrees(p);
  const parts: string[] = [];

  // ---- heading
  let y = 0;
  y += 17; parts.push(text(0, y, tpl(L.mesh, { d: deg.dp, t: p.T, p: p.pp, c: p.C }), { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  for (const ln of wrap(L.cluster, fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: "fig-t-muted" })); }
  const gs = groups(p, p.show);
  const focusGroup = gs.find((gr) => gr.includes(p.gpu)) ?? gs[0];
  for (const ln of wrap(tpl(L.showing, { axis: L[p.show], g: gs.length, k: deg[p.show], r: p.gpu }), fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs })); }
  const lg = legend([
    { label: L.focus, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.inLink, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.outLink, swatch: { kind: "line", stroke: C.c2, dash: "4 3" } },
  ], 0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 8;

  // ---- nodes and accelerators
  const nodeCols = narrow ? 2 : 4;
  const gapN = narrow ? 10 : 12;
  const nodeW = (w - gapN * (nodeCols - 1)) / nodeCols;
  const pad = 6, gapC = 4;
  const cell = (nodeW - 2 * pad - 3 * gapC) / 4;
  const nodeH = 18 + pad + 2 * cell + gapC + pad;
  const center: Array<[number, number]> = [];
  const top = y;
  const inFocus = new Set(focusGroup);
  const nodeNames: string[] = []; // drawn last, with a halo, over any link
  for (let n = 0; n < NODES; n++) {
    const nx = (n % nodeCols) * (nodeW + gapN);
    const ny = top + Math.floor(n / nodeCols) * (nodeH + gapN);
    parts.push(el("rect", { x: nx, y: ny, width: nodeW, height: nodeH, rx: 6, fill: "none", stroke: C.rule, "stroke-width": 1 }));
    nodeNames.push(text(nx + pad, ny + 14, tpl(L.node, { i: n + 1 }), { "font-size": fs, class: "fig-t-halo fig-t-soft" }));
    for (let s = 0; s < PER_NODE; s++) {
      const r = n * PER_NODE + s;
      const cx = nx + pad + (s % 4) * (cell + gapC);
      const cy = ny + 18 + pad + Math.floor(s / 4) * (cell + gapC);
      center[r] = [cx + cell / 2, cy + cell / 2];
    }
  }
  // Links of every group of the shown axis (faint), then the highlighted group.
  const links: string[] = [];
  // TP, CP, and DP groups are drawn as rings (ring collectives, ring
  // attention); a PP group is a chain of stages, so its last stage does not
  // link back to its first.
  const ring = (gr: number[]) => {
    const segs: Array<[number, number]> = [];
    for (let i = 0; i + 1 < gr.length; i++) segs.push([gr[i], gr[i + 1]]);
    if (gr.length > 2 && p.show !== "pp") segs.push([gr[gr.length - 1], gr[0]]);
    return segs;
  };
  for (const gr of gs) {
    if (gr === focusGroup || gr.length < 2) continue;
    for (const [a, b] of ring(gr)) {
      const cross = nodeOf(a) !== nodeOf(b);
      links.push(el("line", { x1: center[a][0], y1: center[a][1], x2: center[b][0], y2: center[b][1], stroke: cross ? C.c2 : C.c1, "stroke-width": 1, "stroke-opacity": 0.35, "stroke-dasharray": cross ? "4 3" : undefined }));
    }
  }
  const focusLinks: string[] = [];
  if (focusGroup.length > 1) {
    for (const [a, b] of ring(focusGroup)) {
      const cross = nodeOf(a) !== nodeOf(b);
      focusLinks.push(el("line", { x1: center[a][0], y1: center[a][1], x2: center[b][0], y2: center[b][1], stroke: cross ? C.c2 : C.c1, "stroke-width": 2.5, "stroke-dasharray": cross ? "5 3" : undefined, "stroke-linecap": "round" }));
    }
  }
  // Links run under the accelerators, so they show in the gaps between cells
  // and nodes and never cross a rank number.
  parts.push(g({ class: "fig-links" }, ...links), g({ class: "fig-links" }, ...focusLinks));
  for (let r = 0; r < N; r++) {
    const [cx, cy] = center[r];
    const on = inFocus.has(r);
    parts.push(el("rect", { x: cx - cell / 2, y: cy - cell / 2, width: cell, height: cell, rx: 4, fill: on ? C.c1 : C.panel, stroke: on ? C.c1 : C.rule, "stroke-width": 1, "data-fig-set": `gpu=${r}`, class: "fig-hit" }));
  }
  for (let r = 0; r < N; r++) {
    const [cx, cy] = center[r];
    const on = inFocus.has(r);
    parts.push(text(cx, cy + fs * 0.36, r, on
      ? { "font-size": fs, "text-anchor": "middle", "pointer-events": "none", "font-weight": 600, fill: C.paper, class: "fig-t-num" }
      : { "font-size": fs, "text-anchor": "middle", "pointer-events": "none", class: "fig-t-muted fig-t-num" }));
  }
  parts.push(...nodeNames);
  y = top + Math.ceil(NODES / nodeCols) * (nodeH + gapN) - gapN;

  // ---- per-axis readout
  y += 26;
  const cols = [L.colAxis, L.colDeg, L.colGroups, L.colSpan];
  const cx = narrow ? [0, 70, 130, w] : [0, 110, 200, w];
  cols.forEach((c, i) => parts.push(text(cx[i], y, c, { "font-size": fs, "text-anchor": i === 3 ? "end" : "start", class: "fig-t-muted" })));
  y += 8;
  for (const a of AXES) {
    const ags = groups(p, a);
    const k = Math.max(...ags.map(span));
    const on = a === p.show;
    const rowTop = y;
    if (on) parts.push(el("rect", { x: -2, y: rowTop + 1, width: w + 4, height: 40, rx: 4, fill: C.panel }));
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    y += 17;
    const spanTxt = deg[a] === 1 ? L.one : k === 1 ? L.inside : tpl(L.across, { k });
    parts.push(text(cx[0], y, L[a], { "font-size": fs, class: on ? "fig-t-strong" : undefined }));
    parts.push(text(cx[1], y, deg[a], { "font-size": fs, class: "fig-t-num" }));
    parts.push(text(cx[2], y, ags.length, { "font-size": fs, class: "fig-t-num" }));
    parts.push(text(cx[3], y, spanTxt, { "font-size": fs, "text-anchor": "end", class: k > 1 && deg[a] > 1 ? "fig-t-strong" : undefined }));
    const traffic = { tp: L.trafficTp, cp: L.trafficCp, pp: L.trafficPp, dp: L.trafficDp }[a];
    y += 17;
    parts.push(text(cx[0], y, traffic, { "font-size": fs, class: "fig-t-muted" }));
    y += 8;
    parts.push(el("rect", { x: 0, y: rowTop, width: w, height: y - rowTop, fill: "transparent", "data-fig-set": `show=${a}`, class: "fig-hit" }));
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  // The chapter's placement rule, applied to TP.
  const tpSpan = Math.max(...groups(p, "tp").map(span));
  if (p.T > 1) {
    y += 8;
    const note = tpSpan === 1 ? L.tpIn : tpl(L.tpOut, { k: tpSpan });
    for (const ln of wrap(note, fs, w)) { y += 16; parts.push(text(0, y, ln, { "font-size": fs, class: tpSpan > 1 ? "fig-t-strong" : undefined })); }
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

const pow2Options = (vals: number[]) => vals.map((v) => ({ value: v, label: { en: String(v), zh: String(v) } }));

export default defineFigure({
  name: "device-mesh",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    T: { kind: "choice", control: "buttons", label: { en: "Tensor parallel T", zh: "张量并行度 T" }, default: 8, options: pow2Options([1, 2, 4, 8, 16]) },
    pp: { kind: "choice", label: { en: "Pipeline stages p", zh: "流水线阶段数 p" }, default: 2, options: pow2Options([1, 2, 4, 8]) },
    C: { kind: "choice", label: { en: "Context parallel C", zh: "上下文并行度 C" }, default: 1, options: pow2Options([1, 2, 4]) },
    order: {
      kind: "choice", control: "select", label: { en: "Rank order, fastest first", zh: "rank 顺序（变化最快的在前）" }, default: "tcdp",
      options: [
        { value: "tcdp", label: { en: "TP, CP, DP, PP (Megatron-LM default)", zh: "TP、CP、DP、PP（Megatron-LM 默认）" } },
        { value: "dtcp", label: { en: "DP, TP, CP, PP", zh: "DP、TP、CP、PP" } },
        { value: "pdtc", label: { en: "PP, DP, TP, CP", zh: "PP、DP、TP、CP" } },
      ],
    },
    show: {
      kind: "choice", label: { en: "Show groups of", zh: "显示通信组" }, default: "tp",
      options: [
        { value: "tp", label: { en: "TP", zh: "TP" } },
        { value: "cp", label: { en: "CP", zh: "CP" } },
        { value: "pp", label: { en: "PP", zh: "PP" } },
        { value: "dp", label: { en: "DP", zh: "DP" } },
      ],
    },
    gpu: { kind: "range", label: { en: "Highlighted rank", zh: "高亮的 rank" }, min: 0, max: 63, step: 1, default: 0, control: false },
  },
  // Keep T·p·C ≤ 64 so D stays a whole number of replicas: halve the other
  // two degrees, pipeline first, never the one the reader just set.
  update(p, key) {
    const q = { ...p };
    for (const k of (["pp", "C", "T"] as const).filter((k) => k !== key)) {
      while (q.T * q.pp * q.C > N && q[k] > 1) q[k] = q[k] / 2;
    }
    return q;
  },
  render,
  describe,
});
