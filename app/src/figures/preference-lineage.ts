// Preference-data lineage over collection rounds: which versioned input an
// audit revises, which upstream artifacts that forces to be regenerated, and
// which version links every stored record carries.
//
// The chapter's collection loop takes four versioned inputs, the behavior
// specification S, the annotation rubric R, the prompt mixture Q and the
// candidate generators G, and writes each preference record linked to all
// four. Every round runs the lower half of the pipeline (judgments, records,
// post-training, audit); what differs between rounds is the upper half. A
// revision of one input invalidates only what depends on it:
//
//   S → R → judgments          Q → prompts → candidates → judgments
//                              G → candidates
//
// so a new rubric re-judges archived prompts and candidates, a new prompt
// mixture needs new prompts and candidates for its slice, a new generator
// needs new candidates for existing prompts, and a new specification forces a
// new rubric. Records from earlier rounds keep their links, so a training set
// that mixes rounds can filter or re-judge by version. The five rounds and
// their audit findings are illustrative; each finding is one the chapter names.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Input = "S" | "R" | "Q" | "G";
type Node = Input | "J" | "D" | "T" | "A";
type Status = "setup" | "first" | "revised" | "new" | "reused" | "every";

interface Round {
  v: Record<Input, number>; // versions in force for this round's records
  revised: Input[]; // inputs the previous audit changed
  finding: "setup" | "none" | "order" | "coverage" | "stale" | "split";
}

// Position 0 is the setup before round 1; position r is round r.
const ROUNDS: Round[] = [
  { v: { S: 1, R: 1, Q: 1, G: 1 }, revised: [], finding: "setup" },
  { v: { S: 1, R: 1, Q: 1, G: 1 }, revised: [], finding: "none" },
  { v: { S: 1, R: 2, Q: 1, G: 1 }, revised: ["R"], finding: "order" },
  { v: { S: 1, R: 2, Q: 2, G: 1 }, revised: ["Q"], finding: "coverage" },
  { v: { S: 1, R: 2, Q: 2, G: 2 }, revised: ["G"], finding: "stale" },
  { v: { S: 2, R: 3, Q: 2, G: 2 }, revised: ["S"], finding: "split" },
];

// Upstream artifacts that depend on each input (the judgments and everything
// below them run every round).
const DOWNSTREAM: Record<Input, Input[]> = { S: ["R"], R: [], Q: ["G"], G: [] };

function status(round: Round, n: Node, i: number): Status {
  if (n === "J" || n === "D" || n === "T" || n === "A") return "every";
  if (i === 0) return "setup";
  if (i === 1) return "first";
  if (round.revised.includes(n)) return "revised";
  if (round.revised.some((r) => DOWNSTREAM[r].includes(n))) return "new";
  return "reused";
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Preference-data lineage over collection rounds",
    S: "behavior specification",
    R: "annotation rubric",
    Q: "prompt sample",
    G: "candidate responses",
    J: "raw judgments",
    D: "preference records",
    T: "post-training",
    A: "held-out audit by slice",
    subD: "each linked to S, R, Q, G",
    ver: "{k}{v}",
    first: "first collection",
    revised: "revised by the audit",
    new: "new this round",
    reused: "reused from the archive",
    every: "runs every round",
    stSetup: "before collection",
    stFirst: "first run",
    stRevised: "revised",
    stNew: "follows the revision",
    stReused: "reused",
    round: "Round {r} of {n}",
    roundSetup: "Before round 1",
    fSetup: "The four inputs are written and versioned as S1, R1, Q1 and G1. Nothing has been collected yet.",
    nRows: "No records are stored yet.",
    kfSetup: "the inputs at version 1",
    fNone: "First collection under S1, R1, Q1 and G1.",
    fOrder: "The audit of round 1 found labels that change when the two responses swap places. R2 randomizes the order and records it, and the archived prompts and candidates are judged again.",
    fCoverage: "The audit of round 2 found no prompts at the refusal boundary in Japanese. Q2 adds that slice, so new prompts need new candidates.",
    fStale: "The audit of round 3 found the trained model writing responses its judges never saw. G2 adds the current checkpoint, which generates new candidates for existing prompts.",
    fSplit: "The audit of round 4 found judges split on a case the specification leaves open. S2 decides the case, R3 follows from it, and the archived pairs are judged again.",
    table: "Stored records and their version links",
    colRound: "round",
    colNew: "new in the round",
    nNone: "first collection",
    nOrder: "re-judged pairs",
    nCoverage: "new prompt slice",
    nStale: "candidates from the current checkpoint",
    nSplit: "re-judged pairs",
    outlined: "Outlined: a link that differs from the current round. Mixing rounds in one training set means filtering or re-judging on these links.",
    none: "Every record so far shares the current versions.",
    kf: "{what}",
    kf0: "Before round 1: {what}",
    kfNone: "First collection",
    kfOrder: "R2 after labels that depend on response order",
    kfCoverage: "Q2 after a missing prompt slice",
    kfStale: "G2 after stale candidates",
    kfSplit: "S2 and R3 after a split on an open case",
    describe: "{round}. {finding} Records so far: {rows}.",
  },
  zh: {
    title: "偏好数据在各轮采集中的血缘",
    S: "行为规格",
    R: "评分准则",
    Q: "提示样本",
    G: "候选回答",
    J: "原始判断",
    D: "偏好记录",
    T: "后训练",
    A: "按切片的留出审计",
    subD: "每条都关联 S、R、Q、G",
    ver: "{k}{v}",
    first: "首次采集",
    revised: "被审计修订",
    new: "本轮新生成",
    reused: "沿用归档",
    every: "每轮都运行",
    stSetup: "尚未采集",
    stFirst: "首次运行",
    stRevised: "已修订",
    stNew: "随修订重做",
    stReused: "沿用",
    round: "第 {r} 轮，共 {n} 轮",
    roundSetup: "第 1 轮之前",
    fSetup: "四项输入已经写定并编为 S1、R1、Q1、G1，尚未采集任何数据。",
    nRows: "目前还没有已存记录。",
    kfSetup: "输入以版本 1 写定",
    fNone: "首次采集，版本为 S1、R1、Q1、G1。",
    fOrder: "第 1 轮的审计发现，交换两个回答的位置后标签会变。R2 随机安排顺序并记录下来，归档的提示与候选回答重新评判。",
    fCoverage: "第 2 轮的审计发现，没有覆盖日语拒绝边界的提示。Q2 补上这个切片，新提示需要新的候选回答。",
    fStale: "第 3 轮的审计发现，被训练的模型写出了评判者从未见过的回答。G2 加入当前检查点，为已有提示生成新的候选回答。",
    fSplit: "第 4 轮的审计发现，评判者在规格没有规定的案例上意见分裂。S2 对此作出规定，R3 随之修订，归档的样本对重新评判。",
    table: "已存记录及其版本关联",
    colRound: "轮次",
    colNew: "本轮新增",
    nNone: "首次采集",
    nOrder: "重新评判",
    nCoverage: "新的提示切片",
    nStale: "当前检查点的候选",
    nSplit: "重新评判",
    outlined: "带框：与当前轮次不同的版本关联。在同一个训练集里混用多轮数据，就要按这些关联过滤或重新评判。",
    none: "目前所有记录都与当前版本一致。",
    kf: "{what}",
    kf0: "第 1 轮之前：{what}",
    kfNone: "首次采集",
    kfOrder: "发现标签依赖顺序，改用 R2",
    kfCoverage: "发现缺少提示切片，改用 Q2",
    kfStale: "发现候选回答过时，改用 G2",
    kfSplit: "评判者在未规定的案例上分裂，改用 S2 与 R3",
    describe: "{round}。{finding}已存记录：{rows}。",
  },
};

type L = typeof labels.en;
type P = Record<string, never>;

const FINDING: Record<Round["finding"], { f: keyof L; n: keyof L; kf: keyof L }> = {
  setup: { f: "fSetup", n: "nRows", kf: "kfSetup" },
  none: { f: "fNone", n: "nNone", kf: "kfNone" },
  order: { f: "fOrder", n: "nOrder", kf: "kfOrder" },
  coverage: { f: "fCoverage", n: "nCoverage", kf: "kfCoverage" },
  stale: { f: "fStale", n: "nStale", kf: "kfStale" },
  split: { f: "fSplit", n: "nSplit", kf: "kfSplit" },
};

const INPUTS: Input[] = ["S", "R", "Q", "G"];
const roundName = (i: number, Lb: L) => (i === 0 ? Lb.roundSetup : tpl(Lb.round, { r: i, n: ROUNDS.length - 1 }));
const roundAt = (t: number) => Math.max(0, Math.min(ROUNDS.length - 1, Math.round(t)));
const tuple = (r: Round) => INPUTS.map((k) => `${k}${r.v[k]}`).join(" ");
const lines = (s: string, size: number, width: number, lang: Lang) => (lang === "zh" ? wrapCjk(s, size, width - size) : wrap(s, size, width));

function describe(st: State<P>, lang: Lang): string {
  const Lb = labels[lang];
  const i = roundAt(st.t);
  const rows = i === 0 ? "–" : ROUNDS.slice(1, i + 1).map(tuple).join(lang === "zh" ? "；" : "; ");
  return tpl(Lb.describe, { round: roundName(i, Lb), finding: Lb[FINDING[ROUNDS[i].finding].f], rows });
}

// ---------------------------------------------------------------- render

const STYLE: Record<Status, { fill: string; op: number; stroke: string; dash?: string }> = {
  setup: { fill: C.panel, op: 1, stroke: C.ink3 },
  first: { fill: C.c1, op: 0.16, stroke: C.c1 },
  new: { fill: C.c1, op: 0.16, stroke: C.c1 },
  revised: { fill: C.c2, op: 0.3, stroke: C.c2 },
  reused: { fill: C.panel, op: 1, stroke: C.ink3, dash: "4 3" },
  every: { fill: C.panel, op: 1, stroke: C.rule },
};
const STATUS_TEXT: Record<Status, keyof L> = { setup: "stSetup", first: "stFirst", new: "stNew", revised: "stRevised", reused: "stReused", every: "every" };

interface Box { x: number; y: number; w: number; h: number; body: (y: number) => string }

function nodeBox(n: Node, st: Status, round: Round, x: number, w: number, lang: Lang): Box {
  const Lb = labels[lang];
  const fs = TYPE.body;
  const title = lines(Lb[n], fs, w - 16, lang);
  const sub = n === "D" ? Lb.subD : (INPUTS as Node[]).includes(n) ? `${n}${round.v[n as Input]} · ${Lb[STATUS_TEXT[st]]}` : Lb[STATUS_TEXT[st]];
  const subLines = lines(sub, fs, w - 16, lang);
  const h = 10 + title.length * 15 + subLines.length * 15 + 4;
  const s = STYLE[st];
  return {
    x, y: 0, w, h,
    body: (y: number) => {
      const out = [el("rect", { x, y, width: w, height: h, rx: 6, fill: s.fill, "fill-opacity": s.op, stroke: s.stroke, "stroke-width": st === "revised" ? 2 : 1.2, "stroke-dasharray": s.dash })];
      let yy = y + 20;
      for (const ln of title) { out.push(text(x + 8, yy, ln, { "font-size": fs, class: "fig-t-strong" })); yy += 15; }
      for (const ln of subLines) { out.push(text(x + 8, yy, ln, { "font-size": fs, class: st === "revised" ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" })); yy += 15; }
      return out.join("");
    },
  };
}

function arrow(x1: number, y1: number, x2: number, y2: number, id: string, attrs: Record<string, string | number | undefined> = {}): string {
  return el("line", { x1, y1, x2, y2, stroke: C.ink2, "stroke-width": 1.3, "marker-end": `url(#${id})`, ...attrs });
}

function renderDiagram(round: Round, i: number, x0: number, y0: number, w: number, lang: Lang, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  const rail = 22; // gutter on each side for the audit's return paths
  const gap = 14;
  const colW = Math.min(190, Math.floor((w - 2 * rail - gap) / 2));
  const lx = x0 + rail + Math.max(0, Math.floor((w - 2 * rail - gap - 2 * colW) / 2));
  const rx = lx + colW + gap;
  const mk = (n: Node, x: number, bw: number) => nodeBox(n, status(round, n, i), round, x, bw, lang);
  const S = mk("S", lx, colW), Q = mk("Q", rx, colW), R = mk("R", lx, colW), G = mk("G", rx, colW);
  const cw = Math.min(250, w - 2 * rail - 24);
  const cx = x0 + (w - cw) / 2;
  const J = mk("J", cx, cw), D = mk("D", cx, cw), T = mk("T", cx, cw), A = mk("A", cx, cw);
  const vgap = 22;
  let y = y0;
  const h0 = Math.max(S.h, Q.h);
  S.y = Q.y = y; S.h = Q.h = h0; y += h0 + vgap;
  const h1 = Math.max(R.h, G.h);
  R.y = G.y = y; R.h = G.h = h1; y += h1 + vgap + 6;
  for (const b of [J, D, T, A]) { b.y = y; y += b.h + vgap; }
  y -= vgap;
  const arrowId = `${uid}-arr`, hotId = `${uid}-hot`;
  parts.push(el("defs", {},
    el("marker", { id: arrowId, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, el("path", { d: "M0,0L10,5L0,10Z", fill: C.ink2 })),
    el("marker", { id: hotId, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, el("path", { d: "M0,0L10,5L0,10Z", fill: C.c2 }))));

  // Forward edges.
  const mid = (b: Box) => b.x + b.w / 2;
  parts.push(arrow(mid(S), S.y + S.h, mid(R), R.y - 2, arrowId));
  parts.push(arrow(mid(Q), Q.y + Q.h, mid(G), G.y - 2, arrowId));
  parts.push(arrow(mid(R), R.y + R.h, J.x + J.w * 0.28, J.y - 2, arrowId));
  parts.push(arrow(mid(G), G.y + G.h, J.x + J.w * 0.72, J.y - 2, arrowId));
  for (const [a, b] of [[J, D], [D, T], [T, A]] as const) parts.push(arrow(mid(a), a.y + a.h, mid(b), b.y - 2, arrowId));

  // The audit's return paths: all four faint, the ones used this round solid.
  const ay = A.y + A.h / 2;
  const back = (target: Box, side: "left" | "right", hot: boolean, k: number) => {
    const xr = side === "left" ? x0 + 6 + k * 6 : x0 + w - 6 - k * 6;
    const xa = side === "left" ? A.x : A.x + A.w;
    const xt = side === "left" ? target.x - 2 : target.x + target.w + 2;
    const ty = target.y + target.h / 2;
    const d = `M${xa},${ay}H${xr}V${ty}H${xt}`;
    return el("path", { d, fill: "none", stroke: hot ? C.c2 : C.ink3, "stroke-width": hot ? 2 : 1, "stroke-dasharray": hot ? undefined : "3 4", "marker-end": `url(#${hot ? hotId : arrowId})`, opacity: hot ? 1 : 0.7 });
  };
  const hot = new Set(round.revised);
  // The upper target's rail runs outside, so no rail crosses another's stub.
  const paths = [back(S, "left", hot.has("S"), 0), back(R, "left", hot.has("R"), 1), back(Q, "right", hot.has("Q"), 0), back(G, "right", hot.has("G"), 1)];
  // Faint paths first so the solid ones draw on top.
  parts.push(...paths.filter((_, i) => !hot.has((["S", "R", "Q", "G"] as Input[])[i])), ...paths.filter((_, i) => hot.has((["S", "R", "Q", "G"] as Input[])[i])));

  for (const b of [S, Q, R, G, J, D, T, A]) parts.push(b.body(b.y));
  return { svg: g({ class: "fig-lineage" }, ...parts), h: y - y0 };
}

function renderReadout(i: number, x0: number, y0: number, w: number, lang: Lang): { svg: string; h: number } {
  const Lb = labels[lang];
  const fs = TYPE.body;
  const round = ROUNDS[i];
  const parts: string[] = [];
  let y = y0 + 14;
  parts.push(text(x0, y, roundName(i, Lb), { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 19;
  for (const ln of lines(Lb[FINDING[round.finding].f], fs, w, lang)) { parts.push(text(x0, y, ln, { "font-size": fs })); y += 16; }
  y += 16;
  parts.push(text(x0, y, Lb.table, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 20;
  if (i === 0) {
    parts.push(text(x0, y, Lb.nRows, { "font-size": fs, class: "fig-t-muted" }));
    return { svg: g({ class: "fig-readout" }, ...parts), h: y + 6 - y0 };
  }
  const roundW = Math.max(textWidth(Lb.colRound, fs), 20) + 12;
  const verW = 30;
  const xNew = x0 + roundW + 4 * verW + 8;
  const newW = x0 + w - xNew;
  // Header, bottom-aligned when the last column wraps.
  const head = lines(Lb.colNew, fs, newW, lang);
  y += (head.length - 1) * 15;
  parts.push(text(x0, y, Lb.colRound, { "font-size": fs, class: "fig-t-muted" }));
  INPUTS.forEach((k, j) => parts.push(text(x0 + roundW + j * verW + verW / 2, y, k, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" })));
  head.forEach((ln, k) => parts.push(text(xNew, y - (head.length - 1 - k) * 15, ln, { "font-size": fs, class: "fig-t-muted" })));
  y += 6;
  let differs = false;
  for (let r = 1; r <= i; r++) {
    const row = ROUNDS[r];
    const cur = r === i;
    const newLines = lines(Lb[FINDING[row.finding].n], fs, newW, lang);
    const rowH = Math.max(1, newLines.length) * 15 + 7;
    parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    const base = y + 15;
    parts.push(text(x0 + roundW - 12, base, r, { "font-size": fs, "text-anchor": "end", class: cur ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    INPUTS.forEach((k, j) => {
      const cx = x0 + roundW + j * verW + verW / 2;
      const diff = row.v[k] !== round.v[k];
      if (diff) {
        differs = true;
        parts.push(el("rect", { x: cx - 13, y: base - 12, width: 26, height: 16, rx: 3, fill: "none", stroke: C.ink2, "stroke-width": 1.2 }));
      }
      parts.push(text(cx, base, `${k}${row.v[k]}`, { "font-size": fs, "text-anchor": "middle", class: cur ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    });
    newLines.forEach((ln, k) => parts.push(text(xNew, base + k * 15, ln, { "font-size": fs, class: cur ? "fig-t-strong" : "fig-t-muted" })));
    y += rowH;
  }
  parts.push(el("line", { x1: x0, x2: x0 + w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
  y += 18;
  for (const ln of lines(differs ? Lb.outlined : Lb.none, fs, w, lang)) { parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); y += 16; }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const Lb = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const i = roundAt(st.t);
  const round = ROUNDS[i];
  const parts: string[] = [];
  const lg = legend([
    { label: Lb.revised, swatch: { kind: "rect", fill: C.c2, opacity: 0.3, stroke: C.c2 } },
    { label: Lb.new, swatch: { kind: "rect", fill: C.c1, opacity: 0.16, stroke: C.c1 } },
    { label: Lb.reused, swatch: { kind: "rect", fill: C.panel, stroke: C.ink3, dash: "3 2" } },
    { label: Lb.every, swatch: { kind: "rect", fill: C.panel, stroke: C.rule } },
  ], 0, 0, w, TYPE.body);
  parts.push(lg.svg);
  let y = lg.height + 14;
  if (narrow) {
    const d = renderDiagram(round, i, 0, y, w, lang, st.uid);
    parts.push(d.svg);
    y += d.h + 18;
    const ro = renderReadout(i, 0, y, w, lang);
    parts.push(ro.svg);
    y += ro.h;
  } else {
    const dw = Math.min(320, Math.floor(w * 0.52));
    const d = renderDiagram(round, i, 0, y, dw, lang, st.uid);
    const ro = renderReadout(i, dw + 24, y - 4, w - dw - 24, lang);
    parts.push(d.svg, ro.svg);
    y += Math.max(d.h, ro.h - 4);
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "preference-lineage",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {},
  timeline: {
    rate: 0.5,
    discrete: true,
    duration: () => ROUNDS.length - 1,
    keyframes: (_p, lang) => ROUNDS.map((r, i) => ({ t: i, label: tpl(i === 0 ? labels[lang].kf0 : labels[lang].kf, { r: i, what: labels[lang][FINDING[r.finding].kf] }) })),
    // The last round: a revision of S forces a new R, and every earlier record
    // carries links that differ from the current versions.
    poster: () => ROUNDS.length - 1,
  },
  render,
  describe,
});
