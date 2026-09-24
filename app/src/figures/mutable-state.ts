// The four kinds of mutable state in a deployed model, drawn as parallel lanes
// on one illustrative timeline of six requests, so their lifetimes, their
// writers, and what rollback restores can be read off the lengths of the bars:
//
//   context c_t          one bar per session; ends with it          (written by V)
//   fast weights         one bar per request, written by gradient
//                        steps on that request's context; ends with it
//   external memory m_t  one continuous bar in versions; a write by V at the
//                        end of a request starts the next version
//   serving checkpoint   θ with its fast-weight update procedure, as a pair;
//                        changes only when a candidate passes the promotion gate
//   candidates           U(θ, e) trained offline on reviewed experience e;
//                        one passes the gate, one is rejected
//
// Only the parameter lane crosses the gate. Choosing a request shows the
// record needed to reproduce its response: the checkpoint and update
// procedure it was served by, the memory version it read, and its full
// context, since its fast weights existed only while it ran (the chapter's
// test-time-training paragraphs). The timeline is illustrative; its only
// quantities are the orderings the chapter states.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- scenario

interface Req { id: number; start: number; end: number }
const REQS: Req[] = [
  { id: 1, start: 3, end: 15 }, { id: 2, start: 19, end: 31 }, { id: 3, start: 40, end: 52 },
  { id: 4, start: 56, end: 68 }, { id: 5, start: 72, end: 84 }, { id: 6, start: 87, end: 98 },
];
// Memory writes by V at the end of these requests start a new version.
const WRITES = [2, 4];
// Checkpoint promotions: candidate trained on [from, to], judged by the gate on
// [to, to + GATE], and promoted (serving from to + GATE) or rejected.
const GATE = 4;
const CANDIDATES = [
  { version: 2, from: 5, to: 32, e: 1, pass: true },
  { version: 3, from: 48, to: 76, e: 2, pass: false },
];
const END = 100;

function memoryVersion(t: number): number {
  let v = 1;
  for (const id of WRITES) if (REQS[id - 1].end <= t) v++;
  return v;
}
function servingVersion(t: number): number {
  let v = 1;
  for (const c of CANDIDATES) if (c.pass && c.to + GATE <= t) v = c.version;
  return v;
}
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const sub = (n: number) => String(n).split("").map((c) => SUB[c] ?? c).join("");

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Four kinds of mutable state in a deployed model",
    ctx: "Context c_t",
    ctxLife: "ends with the session",
    fast: "Fast weights",
    fastLife: "trained on the request's own context, end with it",
    mem: "External memory m_t",
    memLife: "versioned writes by V, persists across requests",
    params: "Parameters θ",
    paramsLife: "candidates trained offline by U(θ, e); the serving checkpoint and its fast-weight procedure change only as a pair, through the gate",
    proc: "procedure {v}",
    written: "m{m}, written by r{i}",
    gateNote: "gate: {o}",
    pass: "promoted",
    fail: "rejected",
    trainedOn: "on e{e}",
    time: "time (illustrative)",
    recordTitle: "To reproduce r{i}'s response",
    recCkpt: "checkpoint θ{v} with fast-weight procedure {n}",
    recMem: "memory version m{m}, which r{i} read",
    recCtx: "the full context of r{i}",
    recFast: "its fast weights are not stored: they existed only while r{i} ran",
    rollTitle: "What rollback restores",
    rollCkpt: "the checkpoint and its procedure together, as the previous pair",
    rollMem: "an earlier memory version",
    rollNone: "context and fast weights: nothing, they end with the request",
    describe: "Four state lanes on one timeline: context and fast weights last one request, external memory persists in versions written by V, and the serving checkpoint and its update procedure change only when a candidate passes the promotion gate; candidate θ₃ is rejected. Reproducing r{i} needs checkpoint θ{v} with fast-weight procedure {n}, memory version m{m}, and the full context of r{i}.",
  },
  zh: {
    title: "已部署模型的四类可变状态",
    ctx: "上下文 c_t",
    ctxLife: "随会话结束而消失",
    fast: "快权重",
    fastLife: "用请求自己的上下文训练，随请求结束",
    mem: "外部记忆 m_t",
    memLife: "由 V 按版本写入，跨请求保留",
    params: "参数 θ",
    paramsLife: "候选检查点由 U(θ, e) 离线训练；服务检查点与其快权重更新过程成对改变，且必须经过门禁",
    proc: "更新过程 {v}",
    written: "m{m}，由 r{i} 写入",
    gateNote: "门禁：{o}",
    pass: "发布",
    fail: "否决",
    trainedOn: "基于 e{e}",
    time: "时间（示意）",
    recordTitle: "复现 r{i} 的回答需要",
    recCkpt: "检查点 θ{v} 与快权重更新过程 {n}",
    recMem: "r{i} 读取的记忆版本 m{m}",
    recCtx: "r{i} 的完整上下文",
    recFast: "它的快权重没有保存，只在 r{i} 运行期间存在",
    rollTitle: "回滚能恢复什么",
    rollCkpt: "检查点与更新过程作为一对，一起恢复到上一对",
    rollMem: "较早的记忆版本",
    rollNone: "上下文与快权重：无需恢复，它们随请求结束",
    describe: "同一时间轴上的四条状态通道：上下文与快权重只存在于一次请求，外部记忆按 V 写入的版本跨请求保留，服务检查点及其更新过程只在候选检查点通过发布门禁时改变；候选 θ₃ 被否决。复现 r{i} 需要检查点 θ{v} 与快权重更新过程 {n}、记忆版本 m{m}，以及 r{i} 的完整上下文。",
  },
};
type L = typeof labels.en;
type P = { request: number };

function record(i: number) {
  const r = REQS[i - 1];
  return { r, v: servingVersion(r.start), m: memoryVersion(r.start) };
}

function describe(st: State<P>, lang: Lang): string {
  const { v, m } = record(st.p.request);
  return tpl(labels[lang].describe, { i: st.p.request, v: sub(v), n: v, m: sub(m) });
}

// ---------------------------------------------------------------- drawing

const LANE_COLORS = { ctx: C.c1, fast: C.c2, mem: C.c3, serve: C.c4 } as const;

function laneHeader(name: string, life: string, x0: number, y: number, w: number, fs: number): { svg: string; h: number } {
  const nameW = textWidth(name, TYPE.body);
  const parts: string[] = [text(x0, y + 12, name, { "font-size": TYPE.body, class: "fig-t-strong" })];
  const inline = nameW + 10 + textWidth(life, fs) <= w;
  if (inline) {
    parts.push(text(x0 + nameW + 10, y + 12, life, { "font-size": fs, class: "fig-t-muted" }));
    return { svg: parts.join(""), h: 18 };
  }
  const lines = wrapCJK(life, fs, w);
  lines.forEach((ln, k) => parts.push(text(x0, y + 12 + (k + 1) * (fs + 4), ln, { "font-size": fs, class: "fig-t-muted" })));
  return { svg: parts.join(""), h: 18 + lines.length * (fs + 4) };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const sel = st.p.request;
  const { r: sr, v: sv, m: sm } = record(sel);
  const x = linear([0, END], [2, w - 2]);
  const bandH = narrow ? 20 : 18;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-cand`, C.c4, 5, 1.4),
    el("marker", { id: `${st.uid}-arr`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, el("path", { d: "M0,0L10,5L0,10Z", fill: C.ink })))];
  const lanes: Record<string, { y: number }> = {};
  let y = 0;
  const bands: string[] = [];
  const header = (name: string, life: string) => {
    const hd = laneHeader(name, life, 0, y, w, fs);
    bands.push(hd.svg);
    y += hd.h + 4;
  };
  const band = (key: string, gapAfter: number) => {
    lanes[key] = { y };
    bands.push(el("rect", { x: x(0), y, width: x(END) - x(0), height: bandH, fill: C.panel, rx: 2 }));
    y += bandH + gapAfter;
  };
  header(L.ctx, L.ctxLife); band("ctx", 14);
  header(L.fast, L.fastLife); band("fast", 14);
  header(L.mem, L.memLife); band("mem", 14);
  // The parameter lane has two bands under one header, candidates above the
  // serving checkpoint, so the gate sits in the gap between them and crosses
  // no text.
  header(L.params, L.paramsLife);
  const gateGap = fs + 12;
  band("cand", gateGap);
  band("serve", 10);
  const axisY = y - 6;

  // Selected request: a column through every lane.
  parts.push(el("rect", { x: x(sr.start) - 2, y: lanes.ctx.y - 4, width: x(sr.end) - x(sr.start) + 4, height: lanes.serve.y + bandH + 4 - lanes.ctx.y + 4, fill: C.ink3, "fill-opacity": 0.12, rx: 3 }));
  parts.push(...bands);

  // Context and fast weights: one bar per request, clickable.
  for (const r of REQS) {
    const on = r.id === sel;
    const x0 = x(r.start), x1 = x(r.end);
    const cy = lanes.ctx.y, fy = lanes.fast.y;
    parts.push(el("rect", { x: x0, y: cy, width: x1 - x0, height: bandH, rx: 3, fill: LANE_COLORS.ctx, "fill-opacity": on ? 1 : 0.55, stroke: on ? C.ink : undefined, "stroke-width": on ? 1.5 : undefined }));
    parts.push(text((x0 + x1) / 2, cy + bandH / 2 + 4, `r${r.id}`, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
    const f0 = x0 + (x1 - x0) * 0.2;
    parts.push(el("rect", { x: f0, y: fy, width: x1 - f0, height: bandH, rx: 3, fill: LANE_COLORS.fast, "fill-opacity": on ? 1 : 0.55, stroke: on ? C.ink : undefined, "stroke-width": on ? 1.5 : undefined }));
    for (let k = 1; k <= 3; k++) {
      const tx = f0 + ((x1 - f0) * k) / 4;
      parts.push(el("line", { x1: tx, x2: tx, y1: fy + 4, y2: fy + bandH - 4, stroke: C.paper, "stroke-width": 1.5 }));
    }
    parts.push(el("rect", { x: x0, y: cy - 2, width: x1 - x0, height: fy + bandH - cy + 4, fill: "transparent", "data-fig-set": `request=${r.id}`, class: "fig-hit" }));
  }

  // External memory: versions; each later version names the request whose
  // write through V started it, aligned with that request's end above.
  const my = lanes.mem.y;
  const cuts = [0, ...WRITES.map((id) => REQS[id - 1].end), END];
  for (let k = 0; k < cuts.length - 1; k++) {
    const v = k + 1;
    const x0 = x(cuts[k]) + (k ? 1.5 : 0), x1 = x(cuts[k + 1]) - 1.5;
    const on = v === sm;
    parts.push(el("rect", { x: x0, y: my, width: x1 - x0, height: bandH, rx: 3, fill: LANE_COLORS.mem, "fill-opacity": on ? 1 : 0.5, stroke: on ? C.ink : undefined, "stroke-width": on ? 1.5 : undefined }));
    const lab = k === 0 ? `m${sub(v)}` : tpl(L.written, { m: sub(v), i: WRITES[k - 1] });
    parts.push(text(x0 + 6, my + bandH / 2 + 4, lab, { "font-size": fs, class: "fig-t-halo fig-t-num" }));
  }

  // Candidates, the gate in the gap below them, and the serving checkpoint.
  const sy = lanes.serve.y, ky = lanes.cand.y;
  const promos = [0, ...CANDIDATES.filter((c) => c.pass).map((c) => c.to + GATE), END];
  for (let k = 0; k < promos.length - 1; k++) {
    const v = k === 0 ? 1 : CANDIDATES.filter((c) => c.pass)[k - 1].version;
    const x0 = x(promos[k]) + (k ? 1.5 : 0), x1 = x(promos[k + 1]) - 1.5;
    const on = v === sv;
    parts.push(el("rect", { x: x0, y: sy, width: x1 - x0, height: bandH, rx: 3, fill: LANE_COLORS.serve, "fill-opacity": on ? 1 : 0.5, stroke: on ? C.ink : undefined, "stroke-width": on ? 1.5 : undefined }));
    parts.push(text(x0 + 6, sy + bandH / 2 + 4, `θ${sub(v)} + ${tpl(L.proc, { v })}`, { "font-size": fs, class: "fig-t-halo fig-t-num" }));
  }
  for (const c of CANDIDATES) {
    const x0 = x(c.from), x1 = x(c.to);
    parts.push(el("rect", { x: x0, y: ky, width: x1 - x0, height: bandH, rx: 3, fill: `url(#${st.uid}-cand)` }));
    parts.push(el("rect", { x: x0, y: ky, width: x1 - x0, height: bandH, rx: 3, fill: "none", stroke: C.c4, "stroke-width": 1.2 }));
    const lab = `θ${sub(c.version)} ${tpl(L.trainedOn, { e: sub(c.e) })}`;
    parts.push(text(x0 + 5, ky + bandH / 2 + 4, lab, { "font-size": fs, class: "fig-t-halo fig-t-num" }));
    const gx = x(c.to) + (x(c.to + GATE) - x(c.to)) / 2;
    const g0 = ky + bandH + 2, g1 = sy - 2;
    parts.push(el("rect", { x: gx - 3, y: g0, width: 6, height: g1 - g0, rx: 1.5, fill: C.ink }));
    // On a phone the outcome word alone; the black bar is the gate.
    const note = narrow ? (c.pass ? L.pass : L.fail) : tpl(L.gateNote, { o: c.pass ? L.pass : L.fail });
    const baseline = (g0 + g1) / 2 + fs * 0.35;
    if (c.pass) {
      parts.push(el("line", { x1: gx + 4, x2: x(c.to + GATE) + 10, y1: g0 + 1, y2: g1, stroke: C.ink, "stroke-width": 1.4, "marker-end": `url(#${st.uid}-arr)` }));
    } else {
      const cx = gx + 11, cy = (g0 + g1) / 2;
      parts.push(el("path", { d: `M${cx - 4},${cy - 4}L${cx + 4},${cy + 4}M${cx - 4},${cy + 4}L${cx + 4},${cy - 4}`, stroke: C.bad, "stroke-width": 2 }));
    }
    // Outcome to the right of the gate, or to its left if it would overflow.
    const ox = gx + (c.pass ? 24 : 20);
    const fits = ox + textWidth(note, fs) <= w - 2;
    parts.push(text(fits ? ox : gx - 8, baseline, note, { "font-size": fs, "text-anchor": fits ? "start" : "end", class: c.pass ? "fig-t-muted" : "fig-t-strong" }));
  }
  // Time arrow.
  parts.push(el("line", { x1: x(0), x2: x(END) - 2, y1: axisY + fs + 10, y2: axisY + fs + 10, stroke: C.rule, "stroke-width": 1, "marker-end": `url(#${st.uid}-arr)` }));
  parts.push(text(x(0), axisY + fs + 6, L.time, { "font-size": fs, class: "fig-t-muted" }));
  y = axisY + fs + 26;

  // ---- the record for the selected request, and what rollback restores
  const rec = [tpl(L.recCkpt, { v: sub(sv), n: sv }), tpl(L.recMem, { m: sub(sm), i: sel }), tpl(L.recCtx, { i: sel }), tpl(L.recFast, { i: sel })];
  const roll = [L.rollCkpt, L.rollMem, L.rollNone];
  const block = (title: string, items: string[], x0: number, y0: number, bw: number) => {
    const out: string[] = [text(x0, y0 + 13, title, { "font-size": TYPE.label, class: "fig-t-strong" })];
    let yy = y0 + 18;
    items.forEach((it, k) => {
      const lines = wrapCJK(it, fs, bw - 14);
      yy += 6;
      out.push(el("circle", { cx: x0 + 4, cy: yy + fs + 4 - fs * 0.35, r: 2.2, fill: k === items.length - 1 && items === rec ? C.ink3 : C.ink }));
      lines.forEach((ln) => { yy += fs + 4; out.push(text(x0 + 14, yy, ln, { "font-size": fs, class: k === items.length - 1 && items === rec ? "fig-t-muted" : undefined })); });
    });
    return { svg: out.join(""), h: yy - y0 };
  };
  if (narrow) {
    const a = block(tpl(L.recordTitle, { i: sel }), rec, 0, y, w);
    const b = block(L.rollTitle, roll, 0, y + a.h + 16, w);
    parts.push(a.svg, b.svg);
    y += a.h + 16 + b.h;
  } else {
    const cw = (w - 28) / 2;
    const a = block(tpl(L.recordTitle, { i: sel }), rec, 0, y, cw);
    const b = block(L.rollTitle, roll, cw + 28, y, cw);
    parts.push(a.svg, b.svg);
    y += Math.max(a.h, b.h);
  }
  return svg(w, y + 6, describe(st, lang), g({ class: "fig-state" }, ...parts));
}

export default defineFigure({
  name: "mutable-state",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    request: {
      kind: "choice", label: { en: "Request", zh: "请求" }, default: 5, control: "buttons",
      options: REQS.map((r) => ({ value: r.id, label: { en: `r${r.id}`, zh: `r${r.id}` } })),
    },
  },
  render,
  describe,
});
