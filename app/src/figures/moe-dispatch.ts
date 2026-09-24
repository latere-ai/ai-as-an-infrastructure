// Top-k MoE dispatch into fixed-capacity expert buffers, one assignment at a
// time, for one routing group of T = 24 tokens.
//
// Router: z_t = W_r h_t is drawn as seeded illustrative logits (a standard
// normal per token and expert plus a per-expert popularity bias that the
// "router load" control scales), so the figure makes no claim about a trained
// router. From z the figure applies the chapter's equations exactly:
//
//   S_t = TopK(z_t, k),   g_{t,e} = softmax over S_t,   p_t = softmax(z_t)
//   C_e = ceil(c · k · T / E)                      slots per expert
//   L_bal / α = E · Σ_e f_e q_e,  f_e = share of tokens whose argmax is e,
//                                  q_e = mean p_{t,e}  (Switch's definition)
//
// Assignments claim slots in token order, every token's first choice before
// any second choice (the order GShard dispatches top-2). An assignment whose
// expert is full is either dropped, so it contributes nothing and a token that
// loses every assignment leaves the layer on the residual path only, or
// rerouted to the token's best-scoring unselected expert that still has a free
// slot, keeping its gate weight. The timeline position t is the number of
// assignments processed, so every state is a pure function of the parameters
// and t; the group is simulated once per parameter set and read at t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { pct, sig, fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- router

export const T = 24; // tokens in the routing group

type Router = "balanced" | "uneven" | "collapsed";
type Policy = "drop" | "reroute";
type P = { experts: number; k: number; capacity: number; router: Router; policy: Policy; seed: number; focus: number };

// Per-expert popularity bias added to the logits, by popularity rank: none
// when balanced; falling linearly to zero over half the experts when uneven;
// concentrated on two experts when collapsed.
function biasProfile(router: Router, rank: number, E: number): number {
  if (router === "balanced") return 0;
  if (router === "uneven") return 1.4 * Math.max(0, 1 - rank / (E / 2));
  return rank === 0 ? 4.5 : rank === 1 ? 4 : 0;
}

function gauss(u: () => number): number {
  const a = Math.max(u(), 1e-12), b = u();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

interface Group {
  z: number[][]; // [token][expert] logits
  p: number[][]; // softmax over all experts
  sel: number[][]; // [token] selected experts, best first
  gate: number[][]; // [token] gate of each selected expert, same order
  argmax: number[];
}

function makeGroup(E: number, k: number, router: Router, seed: number): Group {
  const u = rng(seed * 7919 + E);
  // Popularity: a seeded order of the experts.
  const order = Array.from({ length: E }, (_, e) => e);
  for (let i = E - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const bias = new Array<number>(E).fill(0);
  order.forEach((e, rank) => { bias[e] = biasProfile(router, rank, E); });
  const z: number[][] = [], p: number[][] = [], sel: number[][] = [], gate: number[][] = [], argmax: number[] = [];
  for (let t = 0; t < T; t++) {
    const row = Array.from({ length: E }, (_, e) => gauss(u) + bias[e]);
    const mx = Math.max(...row);
    const ex = row.map((v) => Math.exp(v - mx));
    const s = ex.reduce((a, b) => a + b, 0);
    const ranked = row.map((v, e) => ({ v, e })).sort((a, b) => b.v - a.v).map((r) => r.e);
    const top = ranked.slice(0, k);
    const gs = top.map((e) => ex[e]);
    const gz = gs.reduce((a, b) => a + b, 0);
    z.push(row); p.push(ex.map((v) => v / s)); sel.push(top); gate.push(gs.map((v) => v / gz)); argmax.push(ranked[0]);
  }
  return { z, p, sel, gate, argmax };
}

// ---------------------------------------------------------------- dispatch

export const Kind = { Kept: 0, Rerouted: 1, Dropped: 2 } as const;

interface Claim {
  tok: number; // 0-based token
  rank: number; // 0 = first choice
  want: number; // expert the router selected
  at: number; // expert that runs it (-1 when dropped)
  slot: number; // slot index in that expert's buffer
  kind: number;
}

function dispatch(gr: Group, E: number, k: number, cap: number, policy: Policy): Claim[] {
  const filled = new Array<number>(E).fill(0);
  const extra: number[][] = Array.from({ length: T }, () => []); // experts a token gained by rerouting
  const out: Claim[] = [];
  for (let r = 0; r < k; r++) {
    for (let t = 0; t < T; t++) {
      const want = gr.sel[t][r];
      if (filled[want] < cap) {
        out.push({ tok: t, rank: r, want, at: want, slot: filled[want]++, kind: Kind.Kept });
        continue;
      }
      let at = -1;
      if (policy === "reroute") {
        const taken = new Set([...gr.sel[t], ...extra[t]]);
        const cand = gr.z[t].map((v, e) => ({ v, e })).filter((c) => !taken.has(c.e) && filled[c.e] < cap).sort((a, b) => b.v - a.v);
        if (cand.length) at = cand[0].e;
      }
      if (at >= 0) {
        extra[t].push(at);
        out.push({ tok: t, rank: r, want, at, slot: filled[at]++, kind: Kind.Rerouted });
      } else out.push({ tok: t, rank: r, want, at: -1, slot: -1, kind: Kind.Dropped });
    }
  }
  return out;
}

const capacityOf = (c: number, k: number, E: number) => Math.max(1, Math.ceil(c * k * T / E - 1e-9));

interface Sweep { c: number[]; drop: number[]; pad: number[]; noDropC: number }

// Everything one parameter set needs, memoized: render runs every frame while
// the timeline plays, the simulation only when a parameter changes.
const memo = new Map<string, { gr: Group; cap: number; claims: Claim[]; sweep: Sweep; demand: number[]; balance: number }>();
function model(p: P) {
  const key = `${p.experts}|${p.k}|${p.capacity}|${p.router}|${p.policy}|${p.seed}`;
  let hit = memo.get(key);
  if (hit) return hit;
  const E = p.experts, k = Math.min(p.k, E);
  const gr = makeGroup(E, k, p.router, p.seed);
  const cap = capacityOf(p.capacity, k, E);
  const claims = dispatch(gr, E, k, cap, p.policy);
  // The trade-off at the end of the group, as c moves over the control range.
  const cs: number[] = [], drop: number[] = [], pad: number[] = [];
  for (let i = 0; i <= 50; i++) {
    const c = Number((0.5 + i * 0.05).toFixed(2));
    const cc = capacityOf(c, k, E);
    const cl = dispatch(gr, E, k, cc, p.policy);
    const d = cl.filter((x) => x.kind === Kind.Dropped).length;
    cs.push(c); drop.push(d / (k * T)); pad.push((E * cc - (k * T - d)) / (E * cc));
  }
  // Smallest capacity that drops nothing under this policy, as a factor c.
  let cmin = 1;
  while (dispatch(gr, E, k, cmin, p.policy).some((x) => x.kind === Kind.Dropped)) cmin++;
  const demand = new Array<number>(E).fill(0);
  for (const s of gr.sel) for (const e of s) demand[e]++;
  // Switch balance term E Σ f_e q_e (f from the argmax, q the mean probability).
  let balance = 0;
  for (let e = 0; e < E; e++) {
    const f = gr.argmax.filter((a) => a === e).length / T;
    const q = gr.p.reduce((a, row) => a + row[e], 0) / T;
    balance += f * q;
  }
  balance *= E;
  hit = { gr, cap, claims, sweep: { c: cs, drop, pad, noDropC: (cmin * E) / (k * T) }, demand, balance };
  if (memo.size > 48) memo.clear();
  memo.set(key, hit);
  return hit;
}

// State after the first t assignments.
function snapshot(p: P, t: number) {
  const m = model(p);
  const E = p.experts, k = Math.min(p.k, E);
  const n = Math.max(0, Math.min(t, k * T));
  const done = m.claims.slice(0, n);
  const slots: Claim[][] = Array.from({ length: E }, () => []);
  const over: Claim[][] = Array.from({ length: E }, () => []);
  const asked = new Array<number>(E).fill(0);
  const tokKept = new Array<number>(T).fill(0), tokLost = new Array<number>(T).fill(0), tokSeen = new Array<number>(T).fill(0), tokMoved = new Array<number>(T).fill(0);
  let dropped = 0, rerouted = 0;
  for (const c of done) {
    asked[c.want]++;
    tokSeen[c.tok]++;
    if (c.kind === Kind.Dropped) { over[c.want].push(c); tokLost[c.tok]++; dropped++; } else { slots[c.at].push(c); tokKept[c.tok]++; }
    if (c.kind === Kind.Rerouted) { rerouted++; tokMoved[c.tok]++; }
  }
  const kept = n - dropped;
  const orphans = tokLost.filter((l, i) => l > 0 && l === k && tokSeen[i] === k).length;
  // The token the side panel explains: the chosen one, else the token of the
  // latest overflow so far, else the token of the latest assignment.
  let focus = p.focus - 1;
  if (focus < 0) {
    const last = [...done].reverse().find((c) => c.kind !== Kind.Kept) ?? done[done.length - 1];
    focus = last ? last.tok : 0;
  }
  return { m, E, k, n, done, slots, over, asked, tokKept, tokLost, tokSeen, tokMoved, dropped, rerouted, kept, orphans, focus, empty: E * m.cap - kept };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Top-k dispatch into fixed expert capacity",
    tokens: "Routing group: {n} tokens",
    stKept: "every assignment runs",
    stMoved: "runs, one assignment rerouted",
    stPart: "lost an assignment",
    stNone: "no expert: residual path only",
    stWait: "not routed yet",
    experts: "Expert buffers, C = {c} slots each",
    expertsFree: "Expert buffers",
    capLine: "capacity C = {c}",
    first: "first choice",
    second: "later choice",
    rerouted: "rerouted",
    dropped: "dropped",
    empty: "empty slot",
    expert: "E{e}",
    filled: "{a}/{c}",
    tok: "Token {i}",
    probs: "p = softmax(z), top-{k} selected",
    sel: "S = {s}, gates g = {g}",
    fateKept: "{e}, choice {r}: slot {s} of {c}",
    fateRerouted: "{e}, choice {r}: full, rerouted to {to}",
    fateDropped: "{e}, choice {r}: full, dropped",
    fateWait: "{e}, choice {r}: not dispatched yet",
    out: "m = {terms}",
    outNone: "m = 0: the token keeps only its residual stream",
    readout: "After {n} of {total} assignments",
    rCap: "C = ⌈c·k·T / E⌉ = ⌈{c}·{k}·{t} / {e}⌉",
    rKept: "run by the chosen expert",
    rRerouted: "run by another expert (rerouted)",
    rDropped: "dropped",
    rOrphan: "tokens with no expert",
    rEmpty: "empty slots (padding)",
    rEmptyNow: "slots still empty",
    rGroup: "Router over the whole group",
    rBusy: "assignments to the busiest expert",
    rBusyV: "{m} ({r}× kT/E)",
    rBal: "balance term E·Σ f_e q_e",
    rBalV: "{b} (1 if uniform)",
    chart: "End of the group, as the capacity factor changes",
    cx: "capacity factor c",
    cy: "share",
    lDrop: "assignments dropped",
    lPad: "slots left empty",
    noDrop: "nothing dropped from c = {c}",
    dropless: "A dropless kernel runs all {n} assignments; the layer then waits on the busiest expert, {m} assignments, {r}× the even share kT/E = {even}.",
    evFull: "{e} is full: token {i}'s choice {r} is dropped",
    evFullR: "{e} is full: token {i}'s choice {r} goes to {to}",
    evOrphan: "Token {i} has lost every expert",
    evRank: "Choice {r} begins for all {n} tokens",
    evEnd: "All {n} assignments dispatched: {d} dropped",
    policyDrop: "overflow dropped",
    policyReroute: "overflow rerouted",
    describe: "{n} of {total} assignments dispatched: top-{k} over {e} experts with {c} slots each, {policy}. {d} dropped, {o} with no expert, {p} of {slots} slots empty. Token {i}: {fates}.",
    fateShortKept: "{e} runs it",
    fateShortRerouted: "{e} full, runs on {to}",
    fateShortDropped: "{e} full, dropped",
    fateShortWait: "{e} pending",
  },
  zh: {
    title: "top-k 分发与固定专家容量",
    tokens: "路由组：{n} 个词元",
    stKept: "所有指派都已执行",
    stMoved: "已执行，其中有改路由",
    stPart: "部分指派被丢弃",
    stNone: "没有专家：只走残差路径",
    stWait: "尚未路由",
    experts: "专家缓冲区，每个 C = {c} 个槽位",
    expertsFree: "专家缓冲区",
    capLine: "容量 C = {c}",
    first: "第一顺位",
    second: "后续顺位",
    rerouted: "改路由",
    dropped: "丢弃",
    empty: "空槽位",
    expert: "E{e}",
    filled: "{a}/{c}",
    tok: "词元 {i}",
    probs: "p = softmax(z)，选出 top-{k}",
    sel: "S = {s}，门控 g = {g}",
    fateKept: "{e}（第 {r} 顺位）：第 {s} 个槽位，共 {c} 个",
    fateRerouted: "{e}（第 {r} 顺位）：已满，改送 {to}",
    fateDropped: "{e}（第 {r} 顺位）：已满，丢弃",
    fateWait: "{e}（第 {r} 顺位）：尚未分发",
    out: "m = {terms}",
    outNone: "m = 0：该词元只保留残差流",
    readout: "已处理 {n} 次指派，共 {total} 次",
    rCap: "C = ⌈c·k·T / E⌉ = ⌈{c}·{k}·{t} / {e}⌉",
    rKept: "由所选专家执行",
    rRerouted: "改由其他专家执行",
    rDropped: "丢弃",
    rOrphan: "没有专家的词元",
    rEmpty: "空槽位（填充）",
    rEmptyNow: "尚空的槽位",
    rGroup: "整个路由组的路由结果",
    rBusy: "负载最重的专家收到的指派",
    rBusyV: "{m}（kT/E 的 {r} 倍）",
    rBal: "均衡项 E·Σ f_e q_e",
    rBalV: "{b}（均匀时为 1）",
    chart: "路由组结束时，随容量系数变化",
    cx: "容量系数 c",
    cy: "比例",
    lDrop: "被丢弃的指派",
    lPad: "空置的槽位",
    noDrop: "c = {c} 起不再丢弃",
    dropless: "无丢弃内核会执行全部 {n} 次指派，但这一层要等负载最重的专家处理完 {m} 次指派，是均匀份额 kT/E = {even} 的 {r} 倍。",
    evFull: "{e} 已满：词元 {i} 的第 {r} 顺位指派被丢弃",
    evFullR: "{e} 已满：词元 {i} 的第 {r} 顺位指派改送 {to}",
    evOrphan: "词元 {i} 失去了所有专家",
    evRank: "{n} 个词元开始分发第 {r} 顺位",
    evEnd: "{n} 次指派全部分发完毕：丢弃 {d} 次",
    policyDrop: "溢出即丢弃",
    policyReroute: "溢出改路由",
    describe: "已分发 {n} 次指派，共 {total} 次：{e} 个专家中选 top-{k}，每个专家 {c} 个槽位，{policy}。丢弃 {d} 次，{o} 个词元没有专家，{slots} 个槽位中 {p} 个空置。词元 {i}：{fates}。",
    fateShortKept: "{e} 执行",
    fateShortRerouted: "{e} 已满，改由 {to} 执行",
    fateShortDropped: "{e} 已满，丢弃",
    fateShortWait: "{e} 待分发",
  },
};
type L = typeof labels.en;

const eName = (e: number) => `E${e + 1}`;

// ---------------------------------------------------------------- drawing

function tokenStatus(s: ReturnType<typeof snapshot>, i: number): "wait" | "kept" | "moved" | "part" | "none" {
  if (s.tokSeen[i] === 0) return "wait";
  if (s.tokLost[i] === 0) return s.tokMoved[i] ? "moved" : "kept";
  return s.tokKept[i] === 0 && s.tokSeen[i] === s.k ? "none" : "part";
}

function renderTokens(p: P, s: ReturnType<typeof snapshot>, w: number, y0: number, L: L, uid: string, sm: number) {
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, tpl(L.tokens, { n: T }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.stKept, swatch: { kind: "rect", fill: C.panel, stroke: C.ink3 } },
    ...(p.policy === "reroute" ? [{ label: L.stMoved, swatch: { kind: "rect" as const, fill: C.c2, opacity: 0.4 } }] : []),
    ...(s.k > 1 ? [{ label: L.stPart, swatch: { kind: "rect" as const, fill: C.warn, opacity: 0.55 } }] : []),
    { label: L.stNone, swatch: { kind: "rect", fill: C.bad, pattern: `${uid}-bad` } },
    { label: L.stWait, swatch: { kind: "rect", fill: "none", stroke: C.ink3, dash: "2 2" } },
  ], 0, y0 + 20, w, sm);
  parts.push(lg.svg);
  const top = y0 + 28 + lg.height;
  const perRow = w < 480 ? 12 : 24;
  const gap = 3;
  const cw = Math.min(34, (w - gap * (perRow - 1)) / perRow);
  const ch = 22;
  for (let i = 0; i < T; i++) {
    const x = (i % perRow) * (cw + gap);
    const y = top + Math.floor(i / perRow) * (ch + gap);
    const st = tokenStatus(s, i);
    const cell: string[] = [];
    if (st === "wait") cell.push(el("rect", { x: x + 0.5, y: y + 0.5, width: cw - 1, height: ch - 1, rx: 3, fill: "none", stroke: C.ink3, "stroke-dasharray": "2 2" }));
    else if (st === "kept") cell.push(el("rect", { x, y, width: cw, height: ch, rx: 3, fill: C.panel, stroke: C.ink3, "stroke-width": 0.8 }));
    else if (st === "moved") cell.push(el("rect", { x, y, width: cw, height: ch, rx: 3, fill: C.c2, "fill-opacity": 0.4 }));
    else if (st === "part") cell.push(el("rect", { x, y, width: cw, height: ch, rx: 3, fill: C.warn, "fill-opacity": 0.55 }));
    else cell.push(el("rect", { x, y, width: cw, height: ch, rx: 3, fill: `url(#${uid}-bad)` }), el("rect", { x: x + 0.5, y: y + 0.5, width: cw - 1, height: ch - 1, rx: 3, fill: "none", stroke: C.bad }));
    if (i === s.focus) cell.push(el("rect", { x: x - 1.5, y: y - 1.5, width: cw + 3, height: ch + 3, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
    cell.push(text(x + cw / 2, y + 15, i + 1, { "font-size": sm, "text-anchor": "middle", class: st === "wait" ? "fig-t-faint fig-t-num" : st === "none" ? "fig-t-halo fig-t-num" : "fig-t-strong fig-t-num" }));
    parts.push(g({ "data-fig-set": `focus=${i + 1}`, class: "fig-hit" }, ...cell));
  }
  const rows = Math.ceil(T / perRow);
  return { svg: g({ class: "fig-tokens" }, ...parts), h: top - y0 + rows * (ch + gap) - gap };
}

// Slot geometry shared by the buffers and their height: rows of slots inside
// each expert column, filled bottom up; overflow stacks above capacity.
function slotGeom(E: number, cap: number, w: number, s: ReturnType<typeof snapshot>) {
  const colGap = E >= 16 ? 3 : 6;
  const colW = (w - colGap * (E - 1)) / E;
  const size = Math.max(14, Math.min(20, Math.floor(colW)));
  const perRow = Math.max(1, Math.floor((colW + 2) / (size + 2)));
  const capRows = Math.ceil(cap / perRow);
  // Overflow stacks in a denser grid of its own. Its height is fixed over the
  // timeline (the most overflow any expert reaches by the end) and capped;
  // beyond the cap the last cell counts the rest.
  const oSize = 17, oPitch = 19;
  const oPerRow = Math.max(1, Math.floor((colW + 1) / oPitch));
  const end = snapshotEnd(s);
  const overMax = Math.max(0, ...end.over.map((o) => o.length));
  const overRows = Math.min(Math.max(6, capRows), Math.ceil(overMax / oPerRow));
  return { colGap, colW, size, perRow, capRows, oSize, oPitch, oPerRow, overRows, overCells: overRows * oPerRow };
}
function snapshotEnd(s: ReturnType<typeof snapshot>) {
  const E = s.E;
  const over: Claim[][] = Array.from({ length: E }, () => []);
  for (const c of s.m.claims) if (c.kind === Kind.Dropped) over[c.want].push(c);
  return { over };
}

function renderBuffers(p: P, s: ReturnType<typeof snapshot>, x0: number, y0: number, w: number, L: L, uid: string, sm: number) {
  const parts: string[] = [];
  const cap = s.m.cap;
  parts.push(text(x0, y0 + 13, tpl(L.experts, { c: cap }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const items = [
    { label: L.first, swatch: { kind: "rect" as const, fill: C.c1 } },
    ...(s.k > 1 ? [{ label: L.second, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.45 } }] : []),
    ...(p.policy === "reroute" ? [{ label: L.rerouted, swatch: { kind: "rect" as const, fill: C.c2 } }] : []),
    { label: L.dropped, swatch: { kind: "rect" as const, fill: C.bad, pattern: `${uid}-bad` } },
    { label: L.empty, swatch: { kind: "rect" as const, fill: C.panel, stroke: C.rule } },
  ];
  const lg = legend(items, x0, y0 + 20, w, sm);
  parts.push(lg.svg);
  const G = slotGeom(s.E, cap, w, s);
  const pitch = G.size + 2;
  const top = y0 + 30 + lg.height + (G.overRows ? 0 : 12); // with no overflow, room for the capacity label
  const base = top + (G.overRows ? G.overRows * G.oPitch + 4 : 0) + G.capRows * pitch; // bottom of the slot area
  const capY = base - G.capRows * pitch;
  for (let e = 0; e < s.E; e++) {
    const cx = x0 + e * (G.colW + G.colGap);
    const inner = G.perRow * pitch - 2;
    const ox = cx + (G.colW - inner) / 2;
    const at = (i: number, fromRow: number) => ({ x: ox + (i % G.perRow) * pitch, y: base - (fromRow + Math.floor(i / G.perRow) + 1) * pitch + 2 });
    // Buffer outline.
    const pad = G.colGap >= 6 ? 3 : 1.5;
    parts.push(el("rect", { x: ox - pad, y: capY - 1, width: inner + 2 * pad, height: G.capRows * pitch + 3, rx: 4, fill: "none", stroke: C.rule, "stroke-width": 1 }));
    for (let i = 0; i < cap; i++) {
      const { x, y } = at(i, 0);
      const c = s.slots[e][i];
      const cell: string[] = [];
      if (!c) cell.push(el("rect", { x: x + 0.3, y: y + 0.3, width: G.size - 0.6, height: G.size - 0.6, rx: 2, fill: C.panel, stroke: C.rule, "stroke-width": 0.6 }));
      else {
        const fill = c.kind === Kind.Rerouted ? C.c2 : C.c1;
        cell.push(el("rect", { x, y, width: G.size, height: G.size, rx: 2, fill, "fill-opacity": c.kind === Kind.Kept && c.rank > 0 ? 0.45 : 1 }));
        if (c.tok === s.focus) cell.push(el("rect", { x: x - 1, y: y - 1, width: G.size + 2, height: G.size + 2, rx: 3, fill: "none", stroke: C.ink, "stroke-width": 1.5 }));
        cell.push(text(x + G.size / 2, y + G.size / 2 + 4, c.tok + 1, { "font-size": sm, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
      }
      parts.push(c ? g({ "data-fig-set": `focus=${c.tok + 1}`, class: "fig-hit" }, ...cell) : cell.join(""));
    }
    const oInner = G.oPerRow * G.oPitch - 1;
    const oox = cx + (G.colW - oInner) / 2;
    const over = s.over[e];
    const shown = over.length > G.overCells ? G.overCells - 1 : over.length;
    for (let i = 0; i < shown; i++) {
      const c = over[i];
      const x = oox + (i % G.oPerRow) * G.oPitch, y = capY - 5 - (Math.floor(i / G.oPerRow) + 1) * G.oPitch + 1;
      const cell = [
        el("rect", { x, y, width: G.oSize, height: G.oSize, rx: 2, fill: `url(#${uid}-bad)` }),
        el("rect", { x: x + 0.5, y: y + 0.5, width: G.oSize - 1, height: G.oSize - 1, rx: 2, fill: "none", stroke: c.tok === s.focus ? C.ink : C.bad, "stroke-width": c.tok === s.focus ? 1.5 : 1 }),
        text(x + G.oSize / 2, y + G.oSize / 2 + 4, c.tok + 1, { "font-size": sm, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }),
      ];
      parts.push(g({ "data-fig-set": `focus=${c.tok + 1}`, class: "fig-hit" }, ...cell));
    }
    if (shown < over.length) {
      const i = shown;
      const x = oox + (i % G.oPerRow) * G.oPitch, y = capY - 5 - (Math.floor(i / G.oPerRow) + 1) * G.oPitch + 1;
      parts.push(text(x + G.oSize / 2, y + G.oSize / 2 + 4, `+${over.length - shown}`, { "font-size": sm, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    }
    // Column labels: expert and slots used.
    const mid = cx + G.colW / 2;
    const narrowCol = G.colW < 26;
    parts.push(text(mid, base + 15, G.colW < 22 ? String(e + 1) : eName(e), { "font-size": sm, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    if (!narrowCol || s.E <= 8) parts.push(text(mid, base + 29, tpl(L.filled, { a: s.slots[e].length, c: cap }), { "font-size": sm, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  }
  // Capacity line across all columns, labeled above the buffers.
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: capY - 2, y2: capY - 2, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "4 3" }));
  // Label the line over the widest run of columns that has no overflow.
  const capLabel = tpl(L.capLine, { c: cap });
  const lw = textWidth(capLabel, sm) + 6;
  let best = { from: -1, len: 0 }, runFrom = 0;
  for (let e = 0; e <= s.E; e++) {
    if (e === s.E || s.over[e].length > 0 || snapshotEnd(s).over[e].length > 0) {
      const len = e - runFrom;
      if (len > best.len) best = { from: runFrom, len };
      runFrom = e + 1;
    }
  }
  const runW = best.len * (G.colW + G.colGap) - G.colGap;
  if (best.from >= 0 && runW >= lw) {
    const rx = x0 + (best.from + best.len) * (G.colW + G.colGap) - G.colGap;
    parts.push(text(rx, capY - 7, capLabel, { "font-size": sm, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
  }
  const narrowCol = G.colW < 26 && s.E > 8;
  return { svg: g({ class: "fig-buffers" }, ...parts), h: base - y0 + (narrowCol ? 18 : 32) };
}

function renderFocus(p: P, s: ReturnType<typeof snapshot>, x0: number, y0: number, w: number, L: L, lang: Lang, sm: number) {
  const parts: string[] = [];
  const gr = s.m.gr;
  const i = s.focus;
  const pr = gr.p[i];
  parts.push(text(x0, y0 + 13, tpl(L.tok, { i: i + 1 }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  parts.push(text(x0, y0 + 30, tpl(L.probs, { k: s.k }), { "font-size": sm, class: "fig-t-muted" }));
  // Probability bars over the experts.
  const top = y0 + 44, bh = 64, head = 16; // head: room for the value above the tallest bar
  const gap = s.E >= 16 ? 2 : 4;
  const bw = (w - gap * (s.E - 1)) / s.E;
  const pmax = Math.max(...pr);
  const rankOf = (e: number) => gr.sel[i].indexOf(e);
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: top + bh, y2: top + bh, stroke: C.rule, "stroke-width": 1 }));
  for (let e = 0; e < s.E; e++) {
    const x = x0 + e * (bw + gap);
    const hgt = Math.max(1, (pr[e] / pmax) * (bh - head));
    const r = rankOf(e);
    parts.push(el("rect", { x, y: top + bh - hgt, width: bw, height: hgt, rx: 2, fill: r >= 0 ? C.c1 : C.ink3, "fill-opacity": r < 0 ? 0.35 : r === 0 ? 1 : 0.45 }));
    if (r >= 0 && bw >= 22) parts.push(text(x + bw / 2, top + bh - hgt - 4, pct(pr[e]), { "font-size": sm, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    if (s.E <= 8 || e % 2 === 0 || r >= 0) parts.push(text(x + bw / 2, top + bh + 13, eName(e), { "font-size": sm, "text-anchor": "middle", class: r >= 0 ? "fig-t-strong" : "fig-t-faint" }));
  }
  let y = top + bh + 32;
  const selTxt = tpl(L.sel, { s: `{${gr.sel[i].map(eName).join(", ")}}`, g: gr.gate[i].map((v) => fixed(v, 2)).join(", ") });
  for (const ln of wrap(selTxt, TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-num" })); y += 17; }
  y += 2;
  // Fate of each selected assignment at this step.
  const mine = s.done.filter((c) => c.tok === i);
  const terms: string[] = [];
  for (let r = 0; r < s.k; r++) {
    const e = gr.sel[i][r];
    const c = mine.find((x) => x.rank === r);
    let line: string, cls = "";
    if (!c) { line = tpl(L.fateWait, { e: eName(e), r: r + 1 }); cls = "fig-t-faint"; }
    else if (c.kind === Kind.Kept) { line = tpl(L.fateKept, { e: eName(e), r: r + 1, s: c.slot + 1, c: s.m.cap }); terms.push(`${fixed(gr.gate[i][r], 2)}·F${c.at + 1}(h)`); }
    else if (c.kind === Kind.Rerouted) { line = tpl(L.fateRerouted, { e: eName(e), r: r + 1, to: eName(c.at) }); terms.push(`${fixed(gr.gate[i][r], 2)}·F${c.at + 1}(h)`); }
    else { line = tpl(L.fateDropped, { e: eName(e), r: r + 1 }); cls = "fig-t-strong"; }
    for (const ln of wrap(line, TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: cls || undefined })); y += 17; }
  }
  const allSeen = mine.length === s.k;
  const outLine = terms.length ? tpl(L.out, { terms: terms.join(" + ") }) : allSeen ? L.outNone : "";
  if (outLine) {
    y += 2;
    for (const ln of wrap(outLine, TYPE.body, w)) { parts.push(text(x0, y, ln, { "font-size": TYPE.body, class: "fig-t-num fig-t-strong" })); y += 17; }
  }
  return { svg: g({ class: "fig-focus" }, ...parts), h: y - y0 - 4 };
}

function renderReadout(p: P, s: ReturnType<typeof snapshot>, x0: number, y0: number, w: number, L: L, sm: number) {
  const parts: string[] = [];
  const total = s.k * T;
  const busy = Math.max(...s.m.demand);
  const even = (s.k * T) / s.E;
  let y = y0;
  const block = (title: string, rows: Array<[string, string]>) => {
    parts.push(text(x0, y + 13, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 22;
    for (const [name, v] of rows) {
      parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
      const vw = textWidth(v, TYPE.body);
      const nameLines = wrap(name, TYPE.body, w - vw - 12);
      nameLines.forEach((ln, j) => parts.push(text(x0, y + 14 + j * 15, ln, { "font-size": TYPE.body, class: "fig-t-num" })));
      parts.push(text(x0 + w, y + 14, v, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
      y += 4 + nameLines.length * 15;
    }
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  };
  block(tpl(L.readout, { n: s.n, total }), [
    [tpl(L.rCap, { c: sig(p.capacity, 3), k: s.k, t: T, e: s.E }), String(s.m.cap)],
    [L.rKept, String(s.kept - s.rerouted)],
    ...(p.policy === "reroute" ? [[L.rRerouted, String(s.rerouted)] as [string, string]] : []),
    [L.rDropped, s.n ? `${s.dropped} (${pct(s.dropped / s.n)})` : "0"],
    [L.rOrphan, String(s.orphans)],
    [s.n === total ? L.rEmpty : L.rEmptyNow, `${s.empty} / ${s.E * s.m.cap}`],
  ]);
  y += 14;
  block(L.rGroup, [
    [L.rBusy, tpl(L.rBusyV, { m: busy, r: sig(busy / even, 2) })],
    [L.rBal, tpl(L.rBalV, { b: fixed(s.m.balance, 2) })],
  ]);
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function renderChart(p: P, s: ReturnType<typeof snapshot>, x0: number, y0: number, w: number, L: L, sm: number) {
  const parts: string[] = [];
  const sw = s.m.sweep;
  const title = wrap(L.chart, TYPE.label, w);
  title.forEach((ln, j) => parts.push(text(x0, y0 + 13 + j * 17, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  const ly = y0 + 20 + (title.length - 1) * 17;
  const lg = legend([
    { label: L.lDrop, swatch: { kind: "line", stroke: C.bad } },
    { label: L.lPad, swatch: { kind: "line", stroke: C.ink2, dash: "4 3" } },
  ], x0, ly, w, sm);
  parts.push(lg.svg);
  const top = ly + 14 + lg.height;
  const ph = 120;
  const left = x0 + 38;
  const x = linear([0.5, 3], [left, x0 + w - 6]);
  const y = linear([0, 1], [top + ph, top]);
  parts.push(axis({ scale: x, orient: "bottom", at: top + ph, ticks: [0.5, 1, 1.5, 2, 2.5, 3], title: L.cx, format: (v) => sig(v, 2), size: sm }));
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: [0, 0.25, 0.5, 0.75, 1], grid: [left, x0 + w - 6], format: (v) => pct(v), size: sm }));
  // Step curves: capacity is an integer, so both shares move in steps.
  const step = (vals: number[]) => {
    const pts: Array<[number, number]> = [];
    vals.forEach((v, i) => {
      if (i > 0) pts.push([x(sw.c[i]), y(vals[i - 1])]);
      pts.push([x(sw.c[i]), y(v)]);
    });
    return linePath(pts);
  };
  const nd = sw.noDropC;
  if (nd >= 0.5 && nd <= 3) {
    parts.push(el("line", { x1: x(nd), x2: x(nd), y1: top, y2: top + ph, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  }
  parts.push(el("path", { d: step(sw.pad), fill: "none", stroke: C.ink2, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: step(sw.drop), fill: "none", stroke: C.bad, "stroke-width": 2 }));
  // Cursor at the chosen c, with the two values at the end of the group.
  const ci = Math.round((Math.min(3, Math.max(0.5, p.capacity)) - 0.5) / 0.05);
  const cx = x(p.capacity);
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 2, y2: top + ph, stroke: C.ink, "stroke-width": 1.2 }));
  const dv = sw.drop[ci], pv = sw.pad[ci];
  parts.push(el("circle", { cx, cy: y(dv), r: 4, fill: C.bad, stroke: C.paper, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx, cy: y(pv), r: 4, fill: C.ink2, stroke: C.paper, "stroke-width": 1.5 }));
  const right = cx < x0 + w * 0.62;
  const lab = (v: number, yy: number, other: number) => {
    const dy = Math.abs(y(v) - y(other)) < 14 ? (v >= other ? -7 : 7) : 0;
    return text(right ? cx + 8 : cx - 8, y(v) + 4 + dy, pct(v), { "font-size": sm, "text-anchor": right ? "start" : "end", class: "fig-t-halo fig-t-num" });
  };
  parts.push(lab(dv, 0, pv), lab(pv, 0, dv));
  let yy = top + ph + axisHeight(true, sm) + 10;
  const notes: string[] = [];
  if (nd >= 0.5 && nd <= 3) notes.push(tpl(L.noDrop, { c: sig(nd, 3) }));
  const busy = Math.max(...s.m.demand);
  const even = (s.k * T) / s.E;
  notes.push(tpl(L.dropless, { n: s.k * T, m: busy, r: sig(busy / even, 2), even: sig(even, 3) }));
  for (const note of notes) {
    for (const ln of wrap(note, sm, w)) { parts.push(text(x0, yy, ln, { "font-size": sm, class: "fig-t-muted" })); yy += 15; }
    yy += 2;
  }
  return { svg: g({ class: "fig-chart" }, ...parts), h: yy - y0 - 6 };
}

// ---------------------------------------------------------------- figure

function events(p: P, lang: Lang) {
  const L = labels[lang];
  const m = model(p);
  const k = Math.min(p.k, p.experts);
  const out: Array<{ t: number; label: string }> = [];
  const fullSeen = new Set<number>();
  const lost = new Array<number>(T).fill(0);
  let orphanSeen = false;
  m.claims.forEach((c, j) => {
    const t = j + 1;
    if (j > 0 && j % T === 0) out.push({ t: j, label: tpl(L.evRank, { r: c.rank + 1, n: T }) });
    if (c.kind !== Kind.Kept && !fullSeen.has(c.want)) {
      fullSeen.add(c.want);
      out.push({ t, label: c.kind === Kind.Dropped ? tpl(L.evFull, { e: eName(c.want), i: c.tok + 1, r: c.rank + 1 }) : tpl(L.evFullR, { e: eName(c.want), i: c.tok + 1, r: c.rank + 1, to: eName(c.at) }) });
    }
    if (c.kind === Kind.Dropped) {
      lost[c.tok]++;
      if (!orphanSeen && lost[c.tok] === k) { orphanSeen = true; out.push({ t, label: tpl(L.evOrphan, { i: c.tok + 1 }) }); }
    }
  });
  const d = m.claims.filter((c) => c.kind === Kind.Dropped).length;
  out.push({ t: k * T, label: tpl(L.evEnd, { n: k * T, d }) });
  // One label per position: keep the last event at each t.
  const byT = new Map<number, string>();
  for (const e of out) byT.set(e.t, e.label);
  return [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, label]) => ({ t, label }));
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const s = snapshot(p, Math.round(st.t));
  const gr = s.m.gr;
  const mine = s.done.filter((c) => c.tok === s.focus);
  const fates = gr.sel[s.focus].map((e, r) => {
    const c = mine.find((x) => x.rank === r);
    if (!c) return tpl(L.fateShortWait, { e: eName(e) });
    if (c.kind === Kind.Kept) return tpl(L.fateShortKept, { e: eName(e) });
    if (c.kind === Kind.Rerouted) return tpl(L.fateShortRerouted, { e: eName(e), to: eName(c.at) });
    return tpl(L.fateShortDropped, { e: eName(e) });
  }).join(lang === "zh" ? "，" : ", ");
  return tpl(L.describe, {
    n: s.n, total: s.k * T, k: s.k, e: s.E, c: s.m.cap, policy: p.policy === "drop" ? L.policyDrop : L.policyReroute,
    d: s.dropped, o: s.orphans, p: s.empty, slots: s.E * s.m.cap, i: s.focus + 1, fates,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const s = snapshot(p, Math.round(st.t));
  const sm = narrow ? TYPE.body : TYPE.small; // small text, 12 px on a phone column
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-bad`, C.bad, 4, 1.4))];
  const tok = renderTokens(p, s, w, 0, L, st.uid, sm);
  parts.push(tok.svg);
  let y = tok.h + 20;
  if (narrow) {
    const buf = renderBuffers(p, s, 0, y, w, L, st.uid, sm);
    parts.push(buf.svg); y += buf.h + 14;
    const fo = renderFocus(p, s, 0, y, w, L, lang, sm);
    parts.push(fo.svg); y += fo.h + 18;
    const ro = renderReadout(p, s, 0, y, w, L, sm);
    parts.push(ro.svg); y += ro.h + 18;
    const ch = renderChart(p, s, 0, y, w, L, sm);
    parts.push(ch.svg); y += ch.h;
  } else {
    const leftW = Math.floor(w * 0.56);
    const rx = leftW + 26, rw = w - rx;
    const buf = renderBuffers(p, s, 0, y, leftW, L, st.uid, sm);
    const fo = renderFocus(p, s, rx, y, rw, L, lang, sm);
    parts.push(buf.svg, fo.svg);
    y += Math.max(buf.h, fo.h) + 20;
    const ro = renderReadout(p, s, 0, y, leftW, L, sm);
    const ch = renderChart(p, s, rx, y, rw, L, sm);
    parts.push(ro.svg, ch.svg);
    y += Math.max(ro.h, ch.h);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "moe-dispatch",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    capacity: {
      kind: "range", label: { en: "Capacity factor c", zh: "容量系数 c" }, min: 0.5, max: 3, step: 0.05, default: 1.25,
      marks: [{ value: 1, label: { en: "even share", zh: "均匀份额" } }],
    },
    k: {
      kind: "choice", label: { en: "Experts per token k", zh: "每个词元的专家数 k" }, default: 2,
      options: [
        { value: 1, label: { en: "top-1", zh: "top-1" } },
        { value: 2, label: { en: "top-2", zh: "top-2" } },
        { value: 4, label: { en: "top-4", zh: "top-4" } },
      ],
    },
    experts: {
      kind: "choice", label: { en: "Experts E", zh: "专家数 E" }, default: 8,
      options: [
        { value: 4, label: { en: "4", zh: "4" } },
        { value: 8, label: { en: "8", zh: "8" } },
        { value: 16, label: { en: "16", zh: "16" } },
      ],
    },
    router: {
      kind: "choice", label: { en: "Router load", zh: "路由负载" }, default: "uneven",
      options: [
        { value: "balanced", label: { en: "Balanced", zh: "均衡" } },
        { value: "uneven", label: { en: "Uneven", zh: "不均" } },
        { value: "collapsed", label: { en: "Collapsed", zh: "塌缩" } },
      ],
    },
    policy: {
      kind: "choice", label: { en: "Overflow", zh: "溢出处理" }, default: "drop",
      options: [
        { value: "drop", label: { en: "Drop", zh: "丢弃" } },
        { value: "reroute", label: { en: "Reroute", zh: "改路由" } },
      ],
    },
    seed: { kind: "range", label: { en: "Router seed", zh: "路由种子" }, min: 1, max: 999, step: 1, default: 30, control: false },
    focus: {
      kind: "choice", control: "select", label: { en: "Explain token", zh: "查看词元" }, default: 0,
      options: [
        { value: 0, label: { en: "latest overflow, else latest token", zh: "最近一次溢出，没有则取最近的词元" } },
        ...Array.from({ length: T }, (_, i) => ({ value: i + 1, label: { en: `Token ${i + 1}`, zh: `词元 ${i + 1}` } })),
      ],
    },
  },
  timeline: {
    rate: 6,
    discrete: true,
    duration: (p) => Math.min(p.k, p.experts) * T,
    keyframes: (p, lang) => events(p, lang),
    poster: (p) => Math.min(p.k, p.experts) * T,
  },
  render,
  describe,
});
