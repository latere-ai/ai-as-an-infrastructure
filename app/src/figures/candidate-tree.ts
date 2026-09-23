// A linear candidate chain against a candidate tree under greedy verification,
// with the packed attention masks that let one target pass score every node.
//
// Both proposals extend the same context. The chain carries the draft's top
// continuation, four nodes deep. The tree carries six nodes: two alternatives
// at depth 1, three at depth 2, one at depth 3. The reader picks the target's
// greedy continuation; verification walks from the context, accepts the child
// whose token equals the target's token at that depth, and stops at the first
// depth where no child matches, emitting the target's token there as a
// correction. Reaching a leaf emits the target's next token as a bonus. The
// tokens are illustrative. Greedy matching is used because it is
// deterministic; distribution-preserving tree sampling is a different
// algorithm with the same masks.
//
// The mask row of a node allows the context and the node's own ancestry, so
// branches packed into one operation never attend to each other. Nodes at the
// same depth share a position id.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { tpl } from "./lib/format.ts";

type Target = "deep" | "branch" | "second" | "miss";

interface Scene {
  context: string;
  chain: string[]; // depth 1..4
  tree: Array<{ tok: string; parent: number; row: number }>; // parent 0 = context, else 1-based node index
  targets: Record<Target, string[]>; // the target's greedy tokens at depth 1, 2, ...
}

const SCENES: Record<Lang, Scene> = {
  en: {
    context: "The cat sat on the",
    chain: ["mat", ".", "It", "was"],
    tree: [
      { tok: "mat", parent: 0, row: 0 },
      { tok: "sofa", parent: 0, row: 2 },
      { tok: ".", parent: 1, row: 0 },
      { tok: "and", parent: 1, row: 1 },
      { tok: ".", parent: 2, row: 2 },
      { tok: "It", parent: 3, row: 0 },
    ],
    targets: {
      deep: ["mat", ".", "It", "was", "tired"],
      branch: ["mat", "and", "slept", ".", "It"],
      second: ["sofa", ".", "It", "was", "tired"],
      miss: ["rug", ".", "It", "was", "tired"],
    },
  },
  zh: {
    context: "小猫坐在",
    chain: ["垫子", "上", "。", "它"],
    tree: [
      { tok: "垫子", parent: 0, row: 0 },
      { tok: "沙发", parent: 0, row: 2 },
      { tok: "上", parent: 1, row: 0 },
      { tok: "旁边", parent: 1, row: 1 },
      { tok: "上", parent: 2, row: 2 },
      { tok: "。", parent: 3, row: 0 },
    ],
    targets: {
      deep: ["垫子", "上", "。", "它", "很"],
      branch: ["垫子", "旁边", "睡着", "了", "。"],
      second: ["沙发", "上", "。", "它", "很"],
      miss: ["窗台", "上", "。", "它", "很"],
    },
  },
};

interface Node { tok: string; parent: number; depth: number; row: number }
type NodeState = "accepted" | "rejected" | "unreachable";

// Nodes of a proposal, 1-based, with depths.
function nodes(s: Scene, kind: "chain" | "tree"): Node[] {
  if (kind === "chain") return s.chain.map((tok, i) => ({ tok, parent: i, depth: i + 1, row: 0 }));
  const out: Node[] = [];
  for (const n of s.tree) out.push({ tok: n.tok, parent: n.parent, depth: n.parent ? out[n.parent - 1].depth + 1 : 1, row: n.row });
  return out;
}

// Greedy verification: follow the child that matches the target at each depth.
function verify(ns: Node[], target: string[]) {
  const state: NodeState[] = ns.map(() => "unreachable");
  let at = 0; // current node, 0 = context
  let depth = 0;
  for (;;) {
    const kids = ns.map((n, i) => ({ n, i })).filter((e) => e.n.parent === at);
    if (!kids.length) break; // leaf reached: bonus
    for (const k of kids) state[k.i] = "rejected";
    const hit = kids.find((k) => k.n.tok === target[depth]);
    if (!hit) break; // mismatch: correction
    state[hit.i] = "accepted";
    at = hit.i + 1;
    depth++;
  }
  // Children of rejected nodes were never compared: mark their subtrees unreachable.
  for (let i = 0; i < ns.length; i++) {
    let p = ns[i].parent;
    while (p) {
      if (state[p - 1] === "rejected") { state[i] = "unreachable"; break; }
      p = ns[p - 1].parent;
    }
  }
  const leaf = !ns.some((n) => n.parent === at);
  const accepted = state.filter((x) => x === "accepted").length;
  return { state, at, accepted, emitted: accepted + 1, bonus: leaf, token: target[depth] };
}

const labels = {
  en: {
    title: "A candidate chain and a candidate tree",
    context: "context",
    contextIs: "Context: “{c}”",
    targetIs: "Target's greedy tokens: {t}",
    chain: "Linear chain, {m} nodes",
    tree: "Candidate tree, {m} nodes",
    accepted: "accepted",
    rejected: "rejected",
    unreachable: "not reachable",
    correction: "target token, correction",
    bonus: "target token, bonus",
    maskTree: "Tree mask",
    maskChain: "Chain mask",
    allowed: "attends",
    masked: "masked",
    pos: "pos",
    ctx: "ctx",
    mRows: "rows: query node, columns: key",
    colChain: "chain",
    colTree: "tree",
    rScored: "nodes scored in one pass",
    rAccepted: "accepted",
    rEmitted: "tokens emitted this cycle",
    rWasted: "scored, then discarded",
    describe: "The target continues with “{t}”. The chain scores {mc} nodes, accepts {ac}, and emits {yc}; the tree scores {mt} nodes, accepts {at}, and emits {yt}.",
  },
  zh: {
    title: "候选链与候选树",
    context: "上下文",
    contextIs: "上下文：“{c}”",
    targetIs: "目标模型的贪心词元：{t}",
    chain: "线性候选链，{m} 个节点",
    tree: "候选树，{m} 个节点",
    accepted: "接受",
    rejected: "拒绝",
    unreachable: "无法到达",
    correction: "目标词元：修正",
    bonus: "目标词元：奖励",
    maskTree: "候选树的掩码",
    maskChain: "候选链的掩码",
    allowed: "可关注",
    masked: "被掩码",
    pos: "位置",
    ctx: "上文",
    mRows: "行：查询节点；列：键",
    colChain: "链",
    colTree: "树",
    rScored: "一次传播打分的节点",
    rAccepted: "接受的节点",
    rEmitted: "本轮输出的词元",
    rWasted: "打分后丢弃的节点",
    describe: "目标模型的续写是“{t}”。候选链打分 {mc} 个节点，接受 {ac} 个，输出 {yc} 个词元；候选树打分 {mt} 个节点，接受 {at} 个，输出 {yt} 个词元。",
  },
};
type L = typeof labels.en;
type P = { target: Target };

// Tokens shown one by one, so a punctuation token reads as its own token.
const showTokens = (toks: string[]) => toks.map((t) => `“${t}”`).join(" ");
const joinTokens = (lang: Lang, toks: string[]) => toks.join(lang === "zh" ? "" : " ").replace(/ ([.,])/g, "$1");

function nodeBox(cx: number, cy: number, bw: number, bh: number, tok: string, st: NodeState | "correction" | "bonus" | "context"): string {
  const base = { x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh, rx: 4 };
  let box: string;
  let cls = "fig-t-strong";
  switch (st) {
    case "accepted": box = el("rect", { ...base, fill: C.paper, stroke: C.c1, "stroke-width": 2 }) + el("rect", { ...base, fill: C.c1, "fill-opacity": 0.28 }); break;
    case "correction": box = el("rect", { ...base, fill: C.paper, stroke: C.c2, "stroke-width": 2 }) + el("rect", { ...base, fill: C.c2, "fill-opacity": 0.28 }); break;
    case "bonus": box = el("rect", { ...base, fill: C.paper, stroke: C.c3, "stroke-width": 2 }) + el("rect", { ...base, fill: C.c3, "fill-opacity": 0.28 }); break;
    case "rejected": box = el("rect", { ...base, fill: C.paper, stroke: C.bad, "stroke-width": 2 }); break;
    case "unreachable": box = el("rect", { ...base, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 2" }); cls = "fig-t-faint"; break;
    default: box = el("rect", { ...base, fill: C.panel, stroke: C.rule, "stroke-width": 1 }); cls = "fig-t-muted";
  }
  return box + text(cx, cy + TYPE.body * 0.36, tok, { "font-size": TYPE.body, "text-anchor": "middle", class: cls });
}

// One proposal drawn left to right by depth, with the verification outcome.
function diagram(ns: Node[], res: ReturnType<typeof verify>, title: string, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const maxDepth = Math.max(...ns.map((n) => n.depth)) + 1; // one more column for the target's token
  const rows = Math.max(...ns.map((n) => n.row)) + 1;
  const ctxW = textWidth(L.context, TYPE.body) + 14;
  const colW = (w - ctxW - 8) / maxDepth;
  const bw = Math.min(56, colW - 10);
  const bh = 24;
  const rowH = 34;
  const top = y0 + 26;
  const X = (d: number) => (d === 0 ? x0 + ctxW / 2 : x0 + ctxW + 8 + colW * (d - 0.5));
  const Y = (r: number) => top + rowH * r + rowH / 2;
  const ctxY = Y((rows - 1) / 2);
  const pos = (i: number) => (i === 0 ? { x: X(0), y: ctxY } : { x: X(ns[i - 1].depth), y: Y(ns[i - 1].row) });
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, wa: number, strong: boolean) => {
    const x1 = a.x + wa / 2, x2 = b.x - bw / 2;
    const mx = (x1 + x2) / 2;
    return el("path", { d: `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`, fill: "none", stroke: strong ? C.ink : C.ink3, "stroke-width": strong ? 1.8 : 1 });
  };
  ns.forEach((n, i) => parts.push(edge(pos(n.parent), pos(i + 1), n.parent ? bw : ctxW, res.state[i] === "accepted")));
  // The target's token after the last accepted node.
  const end = pos(res.at);
  const endDepth = res.at ? ns[res.at - 1].depth + 1 : 1;
  const tx = X(endDepth);
  const ty = res.bonus ? end.y : res.at ? end.y : ctxY;
  // A correction sits beside the rejected siblings; place it one row below them when it would overlap.
  let cy = ty;
  if (!res.bonus) {
    const occupied = ns.filter((n) => n.depth === endDepth).map((n) => Y(n.row));
    const free = [...Array(rows + 1).keys()].map(Y).find((y) => !occupied.some((o) => Math.abs(o - y) < 1));
    cy = occupied.some((o) => Math.abs(o - ty) < 1) ? (free ?? Y(rows)) : ty;
  }
  parts.push(el("path", { d: `M${end.x + (res.at ? bw : ctxW) / 2},${end.y} C${(end.x + tx) / 2},${end.y} ${(end.x + tx) / 2},${cy} ${tx - bw / 2},${cy}`, fill: "none", stroke: C.ink, "stroke-width": 1.8, "stroke-dasharray": "4 3" }));
  parts.push(nodeBox(X(0), ctxY, ctxW, bh, L.context, "context"));
  ns.forEach((n, i) => { const p = pos(i + 1); parts.push(nodeBox(p.x, p.y, bw, bh, n.tok, res.state[i])); });
  parts.push(nodeBox(tx, cy, bw, bh, res.token, res.bonus ? "bonus" : "correction"));
  const usedRows = Math.max(rows, Math.round((cy - top - rowH / 2) / rowH) + 1);
  return { svg: g({}, ...parts), h: 26 + usedRows * rowH };
}

// The attention mask of a proposal packed into one pass: a row per node, a
// column for the context and one per node.
function mask(ns: Node[], res: ReturnType<typeof verify>, title: string, x0: number, y0: number, w: number, L: L, hatchId: string): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(x0, y0 + 13, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const labW = Math.max(...ns.map((n, i) => textWidth(`${i + 1} ${n.tok}`, TYPE.body))) + 10;
  const cell = Math.min(24, Math.floor((w - labW) / (ns.length + 1)) - 2);
  const pitch = cell + 2;
  const top = y0 + 24;
  const cx0 = x0 + labW;
  // Column heads: context, node index, and the position id each node uses.
  parts.push(text(cx0 + cell / 2, top + 12, L.ctx, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
  ns.forEach((n, j) => {
    const x = cx0 + (j + 1) * pitch + cell / 2;
    parts.push(text(x, top + 12, j + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
    parts.push(text(x, top + 28, n.depth, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-faint fig-t-num" }));
  });
  parts.push(text(cx0 - 8, top + 28, L.pos, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-faint" }));
  const gy = top + 36;
  const anc = (i: number, j: number) => { let p = i + 1; while (p) { if (p === j + 1) return true; p = ns[p - 1].parent; } return false; };
  ns.forEach((n, i) => {
    const y = gy + i * pitch;
    const onPath = res.state[i] === "accepted";
    parts.push(text(cx0 - 8, y + cell / 2 + 4, `${i + 1} ${n.tok}`, { "font-size": TYPE.body, "text-anchor": "end", class: onPath ? "fig-t-strong" : res.state[i] === "unreachable" ? "fig-t-faint" : "fig-t-muted" }));
    for (let j = -1; j < ns.length; j++) {
      const x = cx0 + (j + 1) * pitch;
      const ok = j < 0 || anc(i, j);
      parts.push(ok
        ? el("rect", { x, y, width: cell, height: cell, rx: 3, fill: C.c1, "fill-opacity": onPath ? 0.75 : 0.35 })
        : el("rect", { x, y, width: cell, height: cell, rx: 3, fill: `url(#${hatchId})` }));
    }
    if (onPath) parts.push(el("rect", { x: cx0 - 2, y: y - 2, width: (ns.length + 1) * pitch + 2, height: cell + 4, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
  });
  return { svg: g({}, ...parts), h: gy - y0 + ns.length * pitch + 4 };
}

function readout(rc: ReturnType<typeof verify>, rt: ReturnType<typeof verify>, mc: number, mt: number, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const colW = Math.max(textWidth(L.colChain, TYPE.body), textWidth(L.colTree, TYPE.body), 24) + 18;
  const xT = x0 + w, xC = xT - colW;
  parts.push(text(xC, y0 + 13, L.colChain, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  parts.push(text(xT, y0 + 13, L.colTree, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  const rows: Array<[string, number, number]> = [
    [L.rScored, mc, mt],
    [L.rAccepted, rc.accepted, rt.accepted],
    [L.rEmitted, rc.emitted, rt.emitted],
    [L.rWasted, mc - rc.accepted, mt - rt.accepted],
  ];
  let y = y0 + 20;
  for (const [name, a, b] of rows) {
    parts.push(el("line", { x1: x0, x2: xT, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const lines = wrap(name, TYPE.body, xC - colW - x0);
    lines.forEach((ln, i) => parts.push(text(x0, y + 14 + i * 15, ln, { "font-size": TYPE.body })));
    parts.push(text(xC, y + 14, a, { "font-size": TYPE.body, "text-anchor": "end", class: `fig-t-num ${a > b && name === L.rEmitted ? "fig-t-strong" : ""}` }));
    parts.push(text(xT, y + 14, b, { "font-size": TYPE.body, "text-anchor": "end", class: `fig-t-num ${b > a && name === L.rEmitted ? "fig-t-strong" : ""}` }));
    y += 6 + lines.length * 15;
  }
  parts.push(el("line", { x1: x0, x2: xT, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function model(p: P, lang: Lang) {
  const s = SCENES[lang];
  const chain = nodes(s, "chain");
  const tree = nodes(s, "tree");
  const target = s.targets[p.target];
  return { s, chain, tree, target, rc: verify(chain, target), rt: verify(tree, target) };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p, lang);
  return tpl(L.describe, {
    t: joinTokens(lang, m.target), mc: m.chain.length, ac: m.rc.accepted, yc: m.rc.emitted,
    mt: m.tree.length, at: m.rt.accepted, yt: m.rt.emitted,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const m = model(st.p, lang);
  const hatchId = `${st.uid}-mask`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 5, 1))];
  let y = 0;
  for (const ln of [tpl(L.contextIs, { c: m.s.context }), tpl(L.targetIs, { t: showTokens(m.target) })]) {
    for (const part of wrap(ln, TYPE.body, w)) { y += 17; parts.push(text(0, y - 3, part, { "font-size": TYPE.body, class: "fig-t-muted" })); }
  }
  const lg = legend([
    { label: L.accepted, swatch: { kind: "rect", fill: C.c1, opacity: 0.6 } },
    { label: L.rejected, swatch: { kind: "rect", fill: "none", stroke: C.bad } },
    { label: L.unreachable, swatch: { kind: "rect", fill: "none", stroke: C.ink3, dash: "3 2" } },
    { label: L.correction, swatch: { kind: "rect", fill: C.c2, opacity: 0.6 } },
    { label: L.bonus, swatch: { kind: "rect", fill: C.c3, opacity: 0.6 } },
  ], 0, y + 8, w, TYPE.body);
  parts.push(lg.svg);
  y += 8 + lg.height + 12;
  const leftW = narrow ? w : Math.floor(w * 0.54);
  const dc = diagram(m.chain, m.rc, tpl(L.chain, { m: m.chain.length }), 0, y, leftW, L);
  const dt = diagram(m.tree, m.rt, tpl(L.tree, { m: m.tree.length }), 0, y + dc.h + 14, leftW, L);
  parts.push(dc.svg, dt.svg);
  const diagH = dc.h + 14 + dt.h;
  const mx = narrow ? 0 : leftW + 24;
  const mw = narrow ? w : w - leftW - 24;
  let my = narrow ? y + diagH + 20 : y;
  const mt = mask(m.tree, m.rt, L.maskTree, mx, my, mw, L, hatchId);
  parts.push(mt.svg); my += mt.h + 12;
  const mc = mask(m.chain, m.rc, L.maskChain, mx, my, mw, L, hatchId);
  parts.push(mc.svg); my += mc.h + 6;
  const ml = legend([
    { label: L.allowed, swatch: { kind: "rect", fill: C.c1, opacity: 0.5 } },
    { label: L.masked, swatch: { kind: "rect", fill: C.ink3, pattern: hatchId } },
  ], mx, my, mw, TYPE.body);
  parts.push(ml.svg); my += ml.height;
  parts.push(text(mx, my + 14, L.mRows, { "font-size": TYPE.body, class: "fig-t-faint" }));
  my += 22;
  // The comparison sits under the diagrams: below the masks on a phone, in
  // the left column beside them on a desktop.
  const ry = narrow ? my + 12 : y + diagH + 22;
  const ro = readout(m.rc, m.rt, m.chain.length, m.tree.length, 0, ry, leftW, L);
  parts.push(ro.svg);
  y = narrow ? ry + ro.h : Math.max(ry + ro.h, my);
  return svg(w, y + 6, describe(st, lang), ...parts);
}

// Each option names where the target's greedy path runs through the tree.
const TARGET_OPTIONS = [
  { value: "deep", label: { en: "chain's path", zh: "候选链路径" } },
  { value: "branch", label: { en: "“and” branch", zh: "“旁边”分支" } },
  { value: "second", label: { en: "“sofa” branch", zh: "“沙发”分支" } },
  { value: "miss", label: { en: "no match", zh: "都不匹配" } },
] as const;

export default defineFigure({
  name: "candidate-tree",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    target: { kind: "choice", label: { en: "Target continues with", zh: "目标模型的续写" }, default: "branch", options: TARGET_OPTIONS },
  },
  render,
  describe,
});
