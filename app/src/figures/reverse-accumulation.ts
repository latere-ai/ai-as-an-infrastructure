// Reverse accumulation on a small recorded graph, computed exactly in the
// page. The forward pass evaluates each node from its parents; the reverse
// sweep seeds the output adjoint with one and adds each node's contribution
//
//   v̄_i += v̄_j · ∂v_j / ∂v_i
//
// to every parent, one edge (one use) at a time, so a node consumed twice
// collects two terms that are summed, as in the chapter's
// v̄_i = Σ_{j ∈ succ(i)} v̄_j ∂v_j/∂v_i.
//
// Two graphs from the chapter: z = x·y + sin(x) (x has two consumers) and the
// runnable's z = a + a with a = x·x (a non-leaf node used twice). Two
// schedules: reverse topological order, which visits each node once after all
// of its downstream contributions have arrived, and the recursive routine the
// chapter warns about, which propagates a node's already accumulated adjoint
// once per path. On the second graph the recursive routine returns 12 at
// x = 2 instead of 4x = 8; on the first graph, where no non-leaf node has two
// uses, both schedules agree. The last step compares the sweep with a centered
// finite difference, the chapter's gradient check.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- graph

type GraphKey = "mulsin" | "square";
type Sched = "topo" | "recursive";
type P = { graph: GraphKey; schedule: Sched; x: number; y: number };

interface Use { parent: string; local: string; d: (v: Record<string, number>) => number; edge: number }
interface Node { id: string; sym: string; expr: string; row: number; col: number; uses: Use[]; f?: (v: Record<string, number>) => number }
interface Graph { nodes: Node[]; out: string; fn: (x: number, y: number) => number; edges: Array<{ from: string; to: string; k: number; of: number }> }

function graphOf(key: GraphKey): Graph {
  if (key === "mulsin") {
    const nodes: Node[] = [
      { id: "x", sym: "x", expr: "x", row: 0, col: 0.64, uses: [] },
      { id: "y", sym: "y", expr: "y", row: 0, col: 0.2, uses: [] },
      { id: "v1", sym: "v₁", expr: "v₁ = x·y", row: 1, col: 0.26, f: (v) => v.x * v.y,
        uses: [{ parent: "x", local: "y", d: (v) => v.y, edge: 0 }, { parent: "y", local: "x", d: (v) => v.x, edge: 1 }] },
      { id: "v2", sym: "v₂", expr: "v₂ = sin x", row: 1, col: 0.74, f: (v) => Math.sin(v.x),
        uses: [{ parent: "x", local: "cos x", d: (v) => Math.cos(v.x), edge: 2 }] },
      { id: "z", sym: "z", expr: "z = v₁ + v₂", row: 2, col: 0.5, f: (v) => v.v1 + v.v2,
        uses: [{ parent: "v1", local: "1", d: () => 1, edge: 3 }, { parent: "v2", local: "1", d: () => 1, edge: 4 }] },
    ];
    return {
      nodes, out: "z", fn: (x, y) => x * y + Math.sin(x),
      edges: [{ from: "x", to: "v1", k: 0, of: 1 }, { from: "y", to: "v1", k: 0, of: 1 }, { from: "x", to: "v2", k: 0, of: 1 }, { from: "v1", to: "z", k: 0, of: 1 }, { from: "v2", to: "z", k: 0, of: 1 }],
    };
  }
  const nodes: Node[] = [
    { id: "x", sym: "x", expr: "x", row: 0, col: 0.5, uses: [] },
    { id: "a", sym: "a", expr: "a = x·x", row: 1, col: 0.5, f: (v) => v.x * v.x,
      uses: [{ parent: "x", local: "x", d: (v) => v.x, edge: 0 }, { parent: "x", local: "x", d: (v) => v.x, edge: 1 }] },
    { id: "z", sym: "z", expr: "z = a + a", row: 2, col: 0.5, f: (v) => v.a + v.a,
      uses: [{ parent: "a", local: "1", d: () => 1, edge: 2 }, { parent: "a", local: "1", d: () => 1, edge: 3 }] },
  ];
  return {
    nodes, out: "z", fn: (x) => 2 * x * x,
    edges: [{ from: "x", to: "a", k: 0, of: 2 }, { from: "x", to: "a", k: 1, of: 2 }, { from: "a", to: "z", k: 0, of: 2 }, { from: "a", to: "z", k: 1, of: 2 }],
  };
}

// One timeline position: a forward evaluation, the seed, or one contribution
// along one edge; the final position is the gradient check.
type Step =
  | { kind: "start" }
  | { kind: "eval"; node: string }
  | { kind: "seed" }
  | { kind: "add"; child: string; use: Use; childAdj: number; amount: number; stale: boolean }
  | { kind: "check" };

interface Term { sym: string; v: number } // "v̄₁·y" and its value
interface Frame { step: Step; values: Record<string, number>; known: Set<string>; adj: Record<string, number>; terms: Record<string, Term[]>; backward: boolean }

interface Run { g: Graph; frames: Frame[]; values: Record<string, number>; grad: { x: number; y: number }; fd: number; secondX: number }

// The adjoint bar goes on the base letter, before any subscript digit.
function bar(sym: string): string {
  const ch = [...sym];
  return ch[0] + "\u0304" + ch.slice(1).join("");
}

const memo = new Map<string, Run>();
function run(p: P): Run {
  const key = `${p.graph}|${p.schedule}|${p.x}|${p.y}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const g = graphOf(p.graph);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const values: Record<string, number> = { x: p.x, y: p.y };
  const frames: Frame[] = [];
  const known = new Set<string>(["x", "y"]);
  const adj: Record<string, number> = {};
  const terms: Record<string, Term[]> = {};
  for (const n of g.nodes) { adj[n.id] = 0; terms[n.id] = []; }
  let backward = false;
  const snap = (step: Step) => frames.push({ step, values: { ...values }, known: new Set(known), adj: { ...adj }, terms: Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, [...v]])), backward });

  // Forward: nodes in the order they were recorded.
  snap({ kind: "start" });
  for (const n of g.nodes) {
    if (!n.f) continue;
    values[n.id] = n.f(values);
    known.add(n.id);
    snap({ kind: "eval", node: n.id });
  }

  // Reverse: seed, then contributions.
  backward = true;
  adj[g.out] = 1;
  terms[g.out].push({ sym: "", v: 1 });
  snap({ kind: "seed" });
  const add = (child: Node, use: Use, childAdj: number, stale: boolean) => {
    const amount = childAdj * use.d(values);
    adj[use.parent] += amount;
    terms[use.parent].push({ sym: bar(child.sym) + (use.local === "1" ? "" : `·${use.local}`), v: amount });
    snap({ kind: "add", child: child.id, use, childAdj, amount, stale });
  };
  if (p.schedule === "topo") {
    // The runnable's topo(): depth-first over parents, appended after them.
    const order: Node[] = [];
    const seen = new Set<string>();
    const visit = (n: Node) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      for (const u of n.uses) visit(byId.get(u.parent)!);
      order.push(n);
    };
    visit(byId.get(g.out)!);
    for (const n of [...order].reverse()) for (const u of n.uses) add(n, u, adj[n.id], false);
  } else {
    // backward(node, g): node.grad += g, then pass node.grad (everything it
    // has accumulated so far) to each parent, once per path.
    const rec = (n: Node) => {
      for (const u of n.uses) {
        const parent = byId.get(u.parent)!;
        const before = adj[u.parent];
        add(n, u, adj[n.id], false);
        // A parent that had already received a contribution and passes its
        // new total down again counts the earlier path twice.
        if (parent.uses.length) {
          const stale = before !== 0;
          for (const pu of parent.uses) add(parent, pu, adj[parent.id], stale);
        }
      }
    };
    // Only one level of recursion is needed for these two graphs' non-leaf
    // parents: their own parents are leaves.
    rec(byId.get(g.out)!);
  }
  snap({ kind: "check" });

  const h = 1e-5;
  const fd = (g.fn(p.x + h, p.y) - g.fn(p.x - h, p.y)) / (2 * h);
  let secondX = frames.length - 1;
  let seenX = 0;
  frames.forEach((f, t) => { if (f.step.kind === "add" && f.step.use.parent === "x") { seenX++; if (seenX === 2) secondX = t; } });
  const out: Run = { g, frames, values, grad: { x: adj.x, y: adj.y ?? 0 }, fd, secondX };
  if (memo.size > 64) memo.clear();
  memo.set(key, out);
  return out;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Reverse accumulation on a recorded graph",
    fwd: "forward value",
    bwd: "adjoint contribution",
    edgeLabel: "edge label: local derivative",
    value: "value {v}",
    adj: "adjoint {v}",
    adjNone: "adjoint –",
    pending: "not evaluated",
    phaseF: "Forward pass",
    phaseB: "Reverse sweep",
    phaseC: "Gradient check",
    start: "Leaves set: x = {x}, y = {y}",
    startSq: "Leaf set: x = {x}",
    eval: "Evaluate {e} = {v}",
    seed: "Seed the output adjoint: z̄ = 1",
    add: "{p} += {c}·{l} = {cv}·{lv} = {a}",
    addStale: "{p} += {c}·{l} = {cv}·{lv} = {a}, but {c} = {cv} includes a path already passed to {p}",
    check: "Sweep gives ∂z/∂x = {g}; centered difference gives {fd}",
    adjoints: "Adjoints received so far",
    sumOf: "{s} = {syms} = {terms} = {v}",
    one: "{s} = {syms} = {v}",
    seedTerm: "{s} = 1, the seed",
    noTerms: "{s} = 0, nothing received yet",
    kStart: "forward: leaves set",
    kEval: "forward: evaluate {n}",
    kSeed: "reverse: seed z̄ = 1",
    kAdd: "reverse: {p} receives a term from {c}",
    kAddStale: "reverse: {c} passes its total to {p} again",
    kCheck: "gradient check",
    match: "the sweep matches the finite difference",
    mismatch: "the sweep does not match the finite difference: an earlier path was counted again",
    fdNote: "centered difference [z(x + h) − z(x − h)] / 2h, h = 10⁻⁵",
    describe: "{graph}, {sched}, step {t} of {d}: {what}.",
    gMulsin: "z = x·y + sin x",
    gSquare: "z = a + a with a = x·x",
    sTopo: "reverse topological order",
    sRec: "recursive, once per path",
  },
  zh: {
    title: "在记录下来的计算图上做反向累积",
    fwd: "前向数值",
    bwd: "伴随量贡献",
    edgeLabel: "边上标注：局部导数",
    value: "值 {v}",
    adj: "伴随量 {v}",
    adjNone: "伴随量 –",
    pending: "尚未求值",
    phaseF: "前向计算",
    phaseB: "反向扫描",
    phaseC: "梯度检查",
    start: "叶子节点：x = {x}，y = {y}",
    startSq: "叶子节点：x = {x}",
    eval: "求值 {e} = {v}",
    seed: "输出伴随量设为种子：z̄ = 1",
    add: "{p} += {c}·{l} = {cv}·{lv} = {a}",
    addStale: "{p} += {c}·{l} = {cv}·{lv} = {a}，但 {c} = {cv} 里包含一条已经传给 {p} 的路径",
    check: "反向扫描得到 ∂z/∂x = {g}，中心差分得到 {fd}",
    adjoints: "目前收到的伴随量",
    sumOf: "{s} = {syms} = {terms} = {v}",
    one: "{s} = {syms} = {v}",
    seedTerm: "{s} = 1，即种子",
    noTerms: "{s} = 0，尚未收到贡献",
    kStart: "前向：设定叶子节点",
    kEval: "前向：求值 {n}",
    kSeed: "反向：种子 z̄ = 1",
    kAdd: "反向：{p} 收到来自 {c} 的一项",
    kAddStale: "反向：{c} 把累积总和再次传给 {p}",
    kCheck: "梯度检查",
    match: "反向扫描与有限差分一致",
    mismatch: "反向扫描与有限差分不一致：先前的路径被重复计入",
    fdNote: "中心差分 [z(x + h) − z(x − h)] / 2h，h = 10⁻⁵",
    describe: "{graph}，{sched}，第 {t} 步（共 {d} 步）：{what}。",
    gMulsin: "z = x·y + sin x",
    gSquare: "z = a + a，其中 a = x·x",
    sTopo: "反向拓扑顺序",
    sRec: "递归，每条路径一次",
  },
};
type L = typeof labels.en;

const num = (v: number) => sig(Math.abs(v) < 1e-12 ? 0 : v, 4);
const paren = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
const symOf = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)!.sym;

function stepText(r: Run, f: Frame, p: P, L: L): string {
  const s = f.step;
  switch (s.kind) {
    case "start": return p.graph === "mulsin" ? tpl(L.start, { x: num(p.x), y: num(p.y) }) : tpl(L.startSq, { x: num(p.x) });
    case "eval": return tpl(L.eval, { e: r.g.nodes.find((n) => n.id === s.node)!.expr, v: num(f.values[s.node]) });
    case "seed": return L.seed;
    case "add": {
      const vars = { p: bar(symOf(r.g, s.use.parent)), c: bar(symOf(r.g, s.child)), l: s.use.local, cv: num(s.childAdj), lv: paren(s.use.d(r.values)), a: num(s.amount) };
      return s.stale ? tpl(L.addStale, vars) : tpl(L.add, vars);
    }
    case "check": return tpl(L.check, { g: num(r.grad.x), fd: num(r.fd) });
  }
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const r = run(st.p);
  const t = Math.min(Math.max(0, Math.round(st.t)), r.frames.length - 1);
  return tpl(L.describe, {
    graph: st.p.graph === "mulsin" ? L.gMulsin : L.gSquare, sched: st.p.schedule === "topo" ? L.sTopo : L.sRec,
    t, d: r.frames.length - 1, what: stepText(r, r.frames[t], st.p, L),
  });
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = run(p);
  const t = Math.min(Math.max(0, Math.round(st.t)), r.frames.length - 1);
  const f = r.frames[t];
  const step = f.step;
  const g0 = r.g;
  const parts: string[] = [];
  const marker = (id: string, color: string) => el("marker", { id: `${st.uid}-${id}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
    el("path", { d: "M0,0L10,5L0,10Z", fill: color }));
  parts.push(el("defs", {}, marker("idle", C.ink3), marker("fwd", C.c1), marker("bwd", C.c2)));

  // ---- phase and step
  const phase = step.kind === "check" ? L.phaseC : f.backward ? L.phaseB : L.phaseF;
  let y = 16;
  parts.push(text(0, y, phase, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 20;
  // Reserve the most lines any step needs, so the figure keeps its height
  // while the timeline plays.
  const stepLines = Math.max(...r.frames.map((q) => wrapCjk(stepText(r, q, p, L), TYPE.body, w).length));
  wrapCjk(stepText(r, f, p, L), TYPE.body, w).forEach((ln, i) => parts.push(text(0, y + i * 17, ln, { "font-size": TYPE.body, class: "fig-t-num" })));
  y += stepLines * 17 + 2;
  const lg = legend([
    { label: L.fwd, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.bwd, swatch: { kind: "line", stroke: C.c2 } },
    { label: L.edgeLabel, swatch: { kind: "line", stroke: C.ink3 } },
  ], 0, y, w, narrow ? TYPE.body : TYPE.small);
  parts.push(lg.svg);
  y += lg.height + 10;

  // ---- graph, drawn bottom to top: leaves at the bottom, z on top
  const boxW = Math.min(150, Math.floor((w - 24) / 2.35));
  const boxH = 58;
  const rowGap = narrow ? 62 : 70;
  const gx0 = 0, gw = w;
  const rowY = (row: number) => y + (2 - row) * (boxH + rowGap);
  const pos = new Map(g0.nodes.map((n) => [n.id, { cx: gx0 + n.col * gw, top: rowY(n.row) }]));
  const graphBottom = rowY(0) + boxH;

  // Edges first, under the boxes.
  const activeEdge = step.kind === "add" ? step.use.edge : -1;
  const evalNode = step.kind === "eval" ? step.node : "";
  g0.edges.forEach((e, i) => {
    const a = pos.get(e.from)!, b = pos.get(e.to)!;
    const off = e.of > 1 ? (e.k === 0 ? -16 : 16) : 0;
    const x1 = a.cx + off, y1 = a.top - 2;
    const x2 = b.cx + off * 0.9 + (a.cx - b.cx) * 0.18 * (e.of > 1 ? 0 : 1), y2 = b.top + boxH + 2;
    const bend = e.of > 1 ? off * 1.2 : 0;
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
    const d = `M${x1},${y1}Q${mx},${my} ${x2},${y2}`;
    const back = i === activeEdge;
    const fwd = evalNode === e.to;
    const known = f.known.has(e.to);
    const stroke = back ? C.c2 : fwd ? C.c1 : known ? C.ink2 : C.ink3;
    // In the reverse sweep the active edge points down, toward the parent.
    parts.push(el("path", { d: back ? `M${x2},${y2}Q${mx},${my} ${x1},${y1}` : d, fill: "none", stroke, "stroke-width": back || fwd ? 2.4 : 1.3,
      "marker-end": `url(#${st.uid}-${back ? "bwd" : fwd ? "fwd" : "idle"})` }));
    // Local derivative at the middle of the edge.
    const use = g0.nodes.flatMap((n) => n.uses).find((u) => u.edge === i)!;
    const lx = (x1 + 2 * mx + x2) / 4, ly = (y1 + 2 * my + y2) / 4;
    const lab = back ? `×${paren(use.d(r.values))}` : use.local;
    parts.push(text(lx + (e.of > 1 ? (e.k === 0 ? -8 : 8) : 0), ly + 4, lab, { "font-size": TYPE.body, "text-anchor": e.of > 1 ? (e.k === 0 ? "end" : "start") : "middle", class: back ? "fig-t-halo fig-t-num" : "fig-t-halo fig-t-soft fig-t-num" }));
  });

  // Node boxes: expression, value, adjoint.
  for (const n of g0.nodes) {
    const q = pos.get(n.id)!;
    const x0 = q.cx - boxW / 2;
    const receiving = step.kind === "add" && step.use.parent === n.id;
    const sending = step.kind === "add" && step.child === n.id;
    const evaluating = evalNode === n.id || (step.kind === "seed" && n.id === g0.out);
    const stroke = receiving ? C.c2 : evaluating ? C.c1 : sending ? C.ink2 : C.rule;
    parts.push(el("rect", { x: x0, y: q.top, width: boxW, height: boxH, rx: 6, fill: C.panel, stroke, "stroke-width": receiving || evaluating ? 2.2 : 1 }));
    parts.push(text(q.cx, q.top + 17, n.expr, { "font-size": TYPE.label, "text-anchor": "middle", class: "fig-t-strong" }));
    const known = f.known.has(n.id);
    parts.push(text(q.cx, q.top + 34, known ? tpl(L.value, { v: num(f.values[n.id]) }) : L.pending, { "font-size": TYPE.body, "text-anchor": "middle", class: known ? "fig-t-num" : "fig-t-faint" }));
    const got = f.terms[n.id].length > 0;
    parts.push(text(q.cx, q.top + 50, got ? tpl(L.adj, { v: num(f.adj[n.id]) }) : L.adjNone, { "font-size": TYPE.body, "text-anchor": "middle", class: got ? (receiving ? "fig-t-strong fig-t-num" : "fig-t-num") : "fig-t-faint" }));
  }
  y = graphBottom + 22;

  // ---- readout: every adjoint as the sum of the terms it has received
  const rp: string[] = [];
  rp.push(text(0, y, L.adjoints, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 6;
  const order = [...g0.nodes].sort((a, b) => b.row - a.row || a.col - b.col);
  const rowLine = (q: Frame, n: Node) => {
    const ts = q.terms[n.id];
    const s = bar(n.sym);
    const syms = ts.map((u) => u.sym).join(" + ");
    return !ts.length ? tpl(L.noTerms, { s })
      : ts.length === 1 && !ts[0].sym ? tpl(L.seedTerm, { s })
      : ts.length === 1 ? tpl(L.one, { s, syms, v: num(q.adj[n.id]) })
      : tpl(L.sumOf, { s, syms, terms: ts.map((u, i) => (i ? paren(u.v) : num(u.v))).join(" + "), v: num(q.adj[n.id]) });
  };
  for (const n of order) {
    if (n.id === "y" && p.graph !== "mulsin") continue;
    const ts = f.terms[n.id];
    rp.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    y += 17;
    const receiving = step.kind === "add" && step.use.parent === n.id;
    const lines = wrapCjk(rowLine(f, n), TYPE.body, w);
    const most = Math.max(...r.frames.map((q) => wrapCjk(rowLine(q, n), TYPE.body, w).length));
    lines.forEach((ln, i) => rp.push(text(0, y + i * 17, ln, { "font-size": TYPE.body, class: receiving ? "fig-t-strong fig-t-num" : ts.length ? "fig-t-num" : "fig-t-muted" })));
    y += most * 17 - 11;
  }
  y += 11;
  rp.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 18;
  for (const ln of wrapCjk(L.fdNote, narrow ? TYPE.body : TYPE.small, w)) { rp.push(text(0, y, ln, { "font-size": narrow ? TYPE.body : TYPE.small, class: "fig-t-muted" })); y += 16; }
  y += 8;
  // The verdict appears at the check; its space is kept at every step.
  const ok = Math.abs(r.grad.x - r.fd) <= 1e-6 * Math.max(1, Math.abs(r.fd));
  const vl = wrapCjk(ok ? L.match : L.mismatch, TYPE.body, w - 16);
  if (step.kind === "check") {
    rp.push(el("circle", { cx: 5, cy: y - 4, r: 4, fill: ok ? C.good : C.bad }));
    vl.forEach((ln, i) => rp.push(text(14, y + i * 17, ln, { "font-size": TYPE.body, class: "fig-t-strong" })));
  }
  y += vl.length * 17 + 2;
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y, describe(st, lang), ...parts);
}

// Short names for the scrubber; the figure itself prints the full equation.
function keyLabel(r: Run, f: Frame, L: L): string {
  const s = f.step;
  switch (s.kind) {
    case "start": return L.kStart;
    case "eval": return tpl(L.kEval, { n: symOf(r.g, s.node) });
    case "seed": return L.kSeed;
    case "add": return tpl(s.stale ? L.kAddStale : L.kAdd, { p: bar(symOf(r.g, s.use.parent)), c: bar(symOf(r.g, s.child)) });
    case "check": return L.kCheck;
  }
}

export default defineFigure({
  name: "reverse-accumulation",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    graph: {
      kind: "choice", label: { en: "Graph", zh: "计算图" }, default: "mulsin",
      options: [
        { value: "mulsin", label: { en: "z = x·y + sin x", zh: "z = x·y + sin x" } },
        { value: "square", label: { en: "z = a + a, a = x·x", zh: "z = a + a，a = x·x" } },
      ],
    },
    schedule: {
      kind: "choice", label: { en: "Reverse schedule", zh: "反向调度" }, default: "topo",
      options: [
        { value: "topo", label: { en: "Reverse topological", zh: "反向拓扑顺序" } },
        { value: "recursive", label: { en: "Recursive per path", zh: "递归，每条路径一次" } },
      ],
    },
    x: { kind: "range", label: { en: "x", zh: "x" }, min: -3, max: 3, step: 0.1, default: 2 },
    y: { kind: "range", label: { en: "y", zh: "y" }, min: -3, max: 3, step: 0.1, default: 3 },
  },
  timeline: {
    rate: 1.2,
    discrete: true,
    duration: (p) => run(p).frames.length - 1,
    keyframes: (p, lang) => {
      const r = run(p);
      return r.frames.map((f, t) => ({ t, label: keyLabel(r, f, labels[lang]) }));
    },
    // Open where x has just received its second contribution: the sum the
    // chapter asks for. When the recursive schedule counts a path twice,
    // open on the check that exposes it.
    poster: (p) => {
      const r = run(p);
      const last = r.frames.length - 1;
      return Math.abs(r.grad.x - r.fd) > 1e-6 * Math.max(1, Math.abs(r.fd)) ? last : r.secondX;
    },
  },
  render,
  describe,
});
