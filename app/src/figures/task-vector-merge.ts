// Merging two task vectors coordinate by coordinate. τ_A = θ_A − θ_0 and
// τ_B = θ_B − θ_0 are seeded, illustrative displacements over N coordinates:
// some large only in one task, some large in both with the same sign, some
// large in both with opposite signs, the rest small. The chapter's merge is
//
//   θ_merge = θ_0 + Σ_i λ_i τ_i,
//
// and the figure draws θ_merge − θ_0 under three rules:
//
// - sum (task arithmetic [@ilharco2023task]): exactly the chapter's equation.
// - TIES [@yadav2023ties]: trim each λ_i τ_i to its k% largest-magnitude
//   entries, elect each coordinate's sign as the sign of the trimmed sum, and
//   average the trimmed values that agree with it (a disjoint mean). λ_i
//   scales each vector before trimming; with λ_A = λ_B = λ this equals the
//   paper's θ_0 + λ τ_m.
// - DARE [@yu2024dare]: drop each entry of each τ_i with probability p, scale
//   the survivors by 1/(1 − p) so the expected vector is unchanged, then sum
//   with the λ_i. The drop mask is seeded and nested: raising p drops a
//   superset of the entries dropped at a lower p.
//
// The readout reports how far the merged displacement moves along each parent,
// ⟨Δ, τ_i⟩ / ‖τ_i‖² with Δ = θ_merge − θ_0 (1 means as far as τ_i itself),
// and the sign conflicts, coordinates where both scaled vectors are nonzero
// with opposite signs.

import { defineFigure, type Lang, type State } from "./types.ts";
import { rng } from "./lib/random.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { legend } from "./lib/legend.ts";
import { fixed, sig, tpl } from "./lib/format.ts";

const N = 36;
type Method = "sum" | "ties" | "dare";
type P = { method: Method; lambdaA: number; lambdaB: number; keep: number; drop: number; seed: number };

// ---------------------------------------------------------------- vectors

type Kind = "a" | "b" | "agree" | "conflict" | "small";
const MIX: Array<[Kind, number]> = [["a", 7], ["b", 7], ["agree", 5], ["conflict", 5], ["small", 12]];

function vectors(seed: number): { a: number[]; b: number[]; kind: Kind[] } {
  const u = rng(seed);
  const kind: Kind[] = MIX.flatMap(([k, n]) => new Array<Kind>(n).fill(k));
  for (let i = kind.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [kind[i], kind[j]] = [kind[j], kind[i]]; }
  const big = () => 0.45 + 0.55 * u();
  const small = () => 0.03 + 0.12 * u();
  const sign = () => (u() < 0.5 ? -1 : 1);
  const a: number[] = [], b: number[] = [];
  for (const k of kind) {
    const s = sign();
    const [ma, mb] = k === "a" ? [big(), small()] : k === "b" ? [small(), big()] : k === "small" ? [small(), small()] : [big(), big()];
    a.push(s * ma);
    b.push((k === "agree" ? s : k === "conflict" ? -s : sign()) * mb);
  }
  return { a, b, kind };
}

// Uniforms for the DARE masks, one stream per vector, drawn once so the mask
// at drop rate p is { j : u_j < p } and grows with p.
function dropDraws(seed: number): { a: number[]; b: number[] } {
  const ua = rng(seed * 7 + 101), ub = rng(seed * 7 + 202);
  return { a: Array.from({ length: N }, () => ua()), b: Array.from({ length: N }, () => ub()) };
}

// Keep the ceil(k · N) largest-magnitude entries (ties by index).
function trim(v: number[], keep: number): boolean[] {
  const n = Math.ceil((keep / 100) * v.length - 1e-9);
  const order = v.map((x, j) => j).sort((i, j) => Math.abs(v[j]) - Math.abs(v[i]) || i - j);
  const on = new Array<boolean>(v.length).fill(false);
  for (const j of order.slice(0, n)) on[j] = true;
  return on;
}

interface Row { scaled: number[]; kept: number[]; removed: boolean[]; outvoted: boolean[] }

function model(p: P) {
  const { a, b, kind } = vectors(p.seed);
  const sa = a.map((x) => p.lambdaA * x), sb = b.map((x) => p.lambdaB * x);
  const plain = sa.map((x, j) => x + sb[j]);
  const rowOf = (s: number[], kept: number[], removed: boolean[]): Row => ({ scaled: s, kept, removed, outvoted: new Array(N).fill(false) });
  let A: Row, B: Row, merged: number[];
  if (p.method === "sum") {
    A = rowOf(sa, sa, new Array(N).fill(false));
    B = rowOf(sb, sb, new Array(N).fill(false));
    merged = plain;
  } else if (p.method === "ties") {
    const ta = trim(a, p.keep), tb = trim(b, p.keep);
    A = rowOf(sa, sa.map((x, j) => (ta[j] ? x : 0)), ta.map((t) => !t));
    B = rowOf(sb, sb.map((x, j) => (tb[j] ? x : 0)), tb.map((t) => !t));
    merged = A.kept.map((x, j) => {
      const y = B.kept[j];
      const gamma = Math.sign(x + y);
      const agree = [x, y].filter((v) => v !== 0 && Math.sign(v) === gamma);
      if (x !== 0 && Math.sign(x) !== gamma) A.outvoted[j] = true;
      if (y !== 0 && Math.sign(y) !== gamma) B.outvoted[j] = true;
      return agree.length ? agree.reduce((s, v) => s + v, 0) / agree.length : 0;
    });
  } else {
    const d = dropDraws(p.seed);
    const scale = 1 / (1 - p.drop);
    A = rowOf(sa, sa.map((x, j) => (d.a[j] < p.drop ? 0 : x * scale)), d.a.map((v) => v < p.drop));
    B = rowOf(sb, sb.map((x, j) => (d.b[j] < p.drop ? 0 : x * scale)), d.b.map((v) => v < p.drop));
    merged = A.kept.map((x, j) => x + B.kept[j]);
  }
  const dot = (x: number[], y: number[]) => x.reduce((s, v, j) => s + v * y[j], 0);
  const along = (t: number[]) => dot(merged, t) / dot(t, t);
  const conflicts = A.kept.map((x, j) => x !== 0 && B.kept[j] !== 0 && Math.sign(x) !== Math.sign(B.kept[j]));
  const vmax = Math.max(1, ...A.kept.map(Math.abs), ...B.kept.map(Math.abs), ...sa.map(Math.abs), ...sb.map(Math.abs), ...merged.map(Math.abs), ...plain.map(Math.abs));
  return { a, b, kind, A, B, merged, plain, conflicts, nConflict: conflicts.filter(Boolean).length, alongA: along(a), alongB: along(b), vmax,
    outvoted: A.outvoted.filter(Boolean).length + B.outvoted.filter(Boolean).length };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Merging two task vectors coordinate by coordinate",
    rowA: "λ_A τ_A", rowB: "λ_B τ_B", rowM: "θ_merge − θ_0",
    subTrim: "top {k}", subDrop: "p = {p}, × {x}",
    coord: "parameter coordinate j (illustrative, {n} of them)",
    kept: "enters the merge",
    removed: "trimmed or dropped",
    outvoted: "against the elected sign",
    conflict: "sign conflict",
    plain: "plain sum",
    scale: "row height ±{v}",
    eqSum: "θ_merge − θ_0 = λ_A τ_A + λ_B τ_B = {la} τ_A + {lb} τ_B",
    eqTies: "TIES: keep the top {k} of each λ_i τ_i, elect each sign from their sum, average the values that agree",
    eqDare: "DARE: drop each entry with probability p = {p}, scale the rest by 1/(1 − p) = {x}, then add them",
    conflicts: "sign conflicts: {n} of {N} coordinates",
    outvotedN: "; {n} values against the elected sign left out",
    along: "along τ_A: ⟨Δ, τ_A⟩ / ‖τ_A‖² = {a}; along τ_B: {b}",
    describe: "{method}, λ_A = {la}, λ_B = {lb}: {n} sign conflicts; the merged displacement moves {a} of the way along τ_A and {b} along τ_B.",
    mSum: "Plain sum", mTies: "TIES", mDare: "DARE",
  },
  zh: {
    title: "逐坐标合并两个任务向量",
    rowA: "λ_A τ_A", rowB: "λ_B τ_B", rowM: "θ_merge − θ_0",
    subTrim: "前 {k}", subDrop: "p = {p}，× {x}",
    coord: "参数坐标 j（示意，共 {n} 个）",
    kept: "参与合并",
    removed: "被修剪或丢弃",
    outvoted: "与选定符号相反",
    conflict: "符号冲突",
    plain: "直接相加",
    scale: "每行高度 ±{v}",
    eqSum: "θ_merge − θ_0 = λ_A τ_A + λ_B τ_B = {la} τ_A + {lb} τ_B",
    eqTies: "TIES：每个 λ_i τ_i 只保留绝对值最大的 {k}，按两者之和确定每个坐标的符号，再对符号一致的值取平均",
    eqDare: "DARE：每个元素以概率 p = {p} 丢弃，其余元素乘以 1/(1 − p) = {x}，再相加",
    conflicts: "符号冲突：{N} 个坐标中有 {n} 个",
    outvotedN: "；{n} 个与选定符号相反的值未计入",
    along: "沿 τ_A：⟨Δ, τ_A⟩ / ‖τ_A‖² = {a}；沿 τ_B：{b}",
    describe: "{method}，λ_A = {la}，λ_B = {lb}：有 {n} 个符号冲突；合并后的位移沿 τ_A 走了 {a}，沿 τ_B 走了 {b}。",
    mSum: "直接相加", mTies: "TIES", mDare: "DARE",
  },
};
type L = typeof labels.en;

const methodName = (m: Method, L: L) => ({ sum: L.mSum, ties: L.mTies, dare: L.mDare }[m]);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  return tpl(L.describe, { method: methodName(st.p.method, L), la: fixed(st.p.lambdaA, 1), lb: fixed(st.p.lambdaB, 1), n: m.nConflict, a: fixed(m.alongA, 2), b: fixed(m.alongB, 2) });
}

// ---------------------------------------------------------------- drawing

const H = 34; // half height of a row

function bars(x0: number, colW: number, mid: number, vmax: number, values: number[], opts: { fill: string; ghost?: number[]; removed?: boolean[]; outvoted?: boolean[]; ticks?: number[] }): string {
  const parts: string[] = [];
  const y = (v: number) => mid - (v / vmax) * H;
  const bw = Math.max(2, colW - 3);
  for (let j = 0; j < values.length; j++) {
    const x = x0 + j * colW + (colW - bw) / 2;
    const ghost = opts.ghost?.[j];
    if (opts.removed?.[j] && ghost) {
      const top = Math.min(y(ghost), mid), hh = Math.abs(y(ghost) - mid);
      parts.push(el("rect", { x: x + 0.5, y: top + 0.5, width: bw - 1, height: Math.max(0.5, hh - 1), fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 2" }));
      continue;
    }
    const v = values[j];
    if (v === 0) continue;
    const top = Math.min(y(v), mid), hh = Math.abs(y(v) - mid);
    parts.push(el("rect", { x, y: top, width: bw, height: Math.max(0.8, hh), fill: opts.fill, "fill-opacity": opts.outvoted?.[j] ? 0.3 : 1 }));
    if (opts.outvoted?.[j]) parts.push(el("rect", { x: x + 0.5, y: top + 0.5, width: bw - 1, height: Math.max(0.5, hh - 1), fill: "none", stroke: opts.fill, "stroke-width": 1 }));
  }
  if (opts.ticks) {
    for (let j = 0; j < opts.ticks.length; j++) {
      const x = x0 + j * colW;
      const ty = y(opts.ticks[j]);
      parts.push(el("line", { x1: x + 1, x2: x + colW - 1, y1: ty, y2: ty, stroke: C.ink, "stroke-width": 1.5 }));
    }
  }
  parts.push(el("line", { x1: x0, x2: x0 + values.length * colW, y1: mid, y2: mid, stroke: C.rule, "stroke-width": 1 }));
  return parts.join("");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const parts: string[] = [];
  const wrapT = (s: string, size: number, width: number) => (lang === "zh" ? wrapCjk : wrap)(s, size, width);

  const items = [
    { label: L.kept, swatch: { kind: "rect" as const, fill: C.c1 } },
    { label: L.removed, swatch: { kind: "rect" as const, fill: "none", stroke: C.ink3, dash: "2 2" } },
    ...(p.method === "ties" ? [{ label: L.outvoted, swatch: { kind: "rect" as const, fill: C.c1, opacity: 0.3, stroke: C.c1 } }] : []),
    { label: L.conflict, swatch: { kind: "rect" as const, fill: C.warn, opacity: 0.35 } },
    ...(p.method !== "sum" ? [{ label: L.plain, swatch: { kind: "line" as const, stroke: C.ink } }] : []),
  ];
  const lg = legend(items, 0, 0, w);
  parts.push(lg.svg);
  let y = lg.height + 8;

  const labelW = narrow ? 0 : Math.max(...[L.rowA, L.rowB, L.rowM].map((s) => textWidth(s, TYPE.body))) + 22;
  const x0 = labelW;
  const colW = (w - x0) / N;
  const rowGap = narrow ? 22 : 10;
  const stripTop = y + (narrow ? 16 : 0);
  const rowH = 2 * H + rowGap;
  const nRows = 3;
  const stripH = nRows * rowH - rowGap + (narrow ? 16 * (nRows - 1) : 0);

  // Conflict columns, behind every row.
  for (let j = 0; j < N; j++) {
    if (!m.conflicts[j]) continue;
    parts.push(el("rect", { x: x0 + j * colW, y: stripTop - 2, width: colW, height: stripH + 4, fill: C.warn, "fill-opacity": 0.16 }));
  }

  const sub = p.method === "ties" ? tpl(L.subTrim, { k: `${p.keep}%` }) : p.method === "dare" ? tpl(L.subDrop, { p: fixed(p.drop, 2), x: sig(1 / (1 - p.drop), 3) }) : "";
  const rows: Array<[string, string, () => string]> = [
    [L.rowA, sub, () => bars(x0, colW, 0, m.vmax, m.A.kept, { fill: C.c1, ghost: m.A.scaled, removed: m.A.removed, outvoted: m.A.outvoted })],
    [L.rowB, sub, () => bars(x0, colW, 0, m.vmax, m.B.kept, { fill: C.c2, ghost: m.B.scaled, removed: m.B.removed, outvoted: m.B.outvoted })],
    [L.rowM, "", () => bars(x0, colW, 0, m.vmax, m.merged, { fill: C.c3, ticks: p.method === "sum" ? undefined : m.plain })],
  ];
  y = stripTop;
  for (const [name, subLabel, draw] of rows) {
    if (narrow) {
      parts.push(text(0, y - 4, subLabel ? `${name}  ${subLabel}` : name, { "font-size": TYPE.body, class: "fig-t-strong" }));
    } else {
      parts.push(text(0, y + H + 4, name, { "font-size": TYPE.body, class: "fig-t-strong" }));
      if (subLabel) parts.push(text(0, y + H + 20, subLabel, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
    }
    parts.push(g({ transform: `translate(0 ${y + H})` }, draw()));
    y += rowH + (narrow ? 16 : 0);
  }
  y -= rowGap + (narrow ? 16 : 0);
  // Coordinate axis note and the shared row scale.
  y += 18;
  parts.push(text(x0, y, tpl(L.coord, { n: N }), { "font-size": TYPE.small, class: "fig-t-muted" }));
  if (narrow) y += 16;
  parts.push(text(narrow ? 0 : w, y, tpl(L.scale, { v: sig(m.vmax, 2) }), { "font-size": TYPE.small, "text-anchor": narrow ? "start" : "end", class: "fig-t-muted fig-t-num" }));
  y += 10;

  const eq = p.method === "sum"
    ? tpl(L.eqSum, { la: fixed(p.lambdaA, 1), lb: fixed(p.lambdaB, 1) })
    : p.method === "ties" ? tpl(L.eqTies, { k: `${p.keep}%` })
      : tpl(L.eqDare, { p: fixed(p.drop, 2), x: sig(1 / (1 - p.drop), 3) });
  const lines: Array<[string, string]> = [
    [eq, "fig-t-strong fig-t-num"],
    [tpl(L.conflicts, { n: m.nConflict, N }) + (p.method === "ties" ? tpl(L.outvotedN, { n: m.outvoted }) : ""), "fig-t-num"],
    [tpl(L.along, { a: fixed(m.alongA, 2), b: fixed(m.alongB, 2) }), "fig-t-num"],
  ];
  for (const [s, cls] of lines) {
    for (const part of wrapT(s, TYPE.body, w - 4)) {
      y += 18;
      parts.push(text(0, y, part, { "font-size": TYPE.body, class: cls }));
    }
    y += 3;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "task-vector-merge",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    method: {
      kind: "choice", label: { en: "Merge rule", zh: "合并规则" }, default: "ties",
      options: [
        { value: "sum", label: { en: labels.en.mSum, zh: labels.zh.mSum } },
        { value: "ties", label: { en: labels.en.mTies, zh: labels.zh.mTies } },
        { value: "dare", label: { en: labels.en.mDare, zh: labels.zh.mDare } },
      ],
    },
    lambdaA: { kind: "range", label: { en: "λ_A for τ_A", zh: "τ_A 的系数 λ_A" }, min: -1, max: 1.5, step: 0.1, default: 1 },
    lambdaB: {
      kind: "range", label: { en: "λ_B for τ_B", zh: "τ_B 的系数 λ_B" }, min: -1, max: 1.5, step: 0.1, default: 1,
      marks: [{ value: -1, label: { en: "negate", zh: "取反" } }],
    },
    keep: {
      kind: "range", label: { en: "TIES: keep top k", zh: "TIES：保留前 k" }, unit: { en: "%", zh: "%" }, min: 10, max: 100, step: 5, default: 40,
      marks: [{ value: 20, label: { en: "paper default", zh: "论文默认值" } }],
    },
    drop: {
      kind: "range", label: { en: "DARE: drop rate p", zh: "DARE：丢弃率 p" }, min: 0, max: 0.9, step: 0.05, default: 0.5,
    },
    seed: { kind: "range", label: { en: "Vector seed", zh: "向量种子" }, min: 1, max: 999, step: 1, default: 11, control: false },
  },
  render,
  describe,
});
