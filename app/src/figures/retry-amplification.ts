// Retry amplification across nested layers, against one retry owner. L layers
// sit between the caller and the model provider (client, gateway, adapter,
// provider); each may retry a failed call r times. The chapter's bound on the
// physical attempts one logical operation can generate is
//
//   A_max = Π_ℓ (1 + r_ℓ)  = (1 + r)^L when every layer retries,
//   A_max = 1 + r          when only one layer, the retry owner, retries.
//
// With each physical attempt failing independently with probability p, the
// nested layers try attempts in sequence until one succeeds or all A_max are
// spent, so the expected physical attempts per logical operation are
//
//   E = 1 + p + p² + … + p^(A_max − 1) = (1 − p^A_max) / (1 − p),
//
// and the operation fails with probability p^A_max. At p = 1 every possible
// attempt is made. Independence is the model's simplification: under real
// overload the extra attempts themselves raise p, which is the retry storm.
//
// The tree draws every call each layer can issue in the worst case (outlined)
// and one seeded run at the chosen p (filled): each call to the layer below
// fails when its attempt draw is below p. Backoff, deadlines, and Retry-After
// are outside the model.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, wrap, type Box } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { rng } from "./lib/random.ts";
import { fixed, int, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Owner = "nested" | "single";
type P = { layers: number; retries: number; fail: number; owner: Owner; seed: number };

const LAYER_NAMES = {
  en: ["client", "gateway", "adapter", "provider"],
  zh: ["客户端", "网关", "适配器", "提供商"],
};

const amax = (L: number, r: number, owner: Owner) => (owner === "nested" ? (1 + r) ** L : 1 + r);
const expectedAttempts = (A: number, p: number) => (p >= 1 ? A : (1 - p ** A) / (1 - p));

// One seeded run. Row ℓ holds the calls issued by layer ℓ + 1; the last row
// is the physical attempts. Returns the executed cells per row, and the
// physical attempt that succeeded (or -1).
function simulate(p: P) {
  const L = p.layers, r = p.retries;
  const fan = (row: number) => (p.owner === "nested" || row === 0 ? 1 + r : 1);
  const width: number[] = [];
  for (let row = 0, wd = 1; row < L; row++) { wd *= fan(row); width.push(wd); }
  const done = width.map((n) => new Uint8Array(n));
  const u = rng(p.seed);
  let attempts = 0, success = -1;
  const run = (row: number, parent: number): boolean => {
    const k = fan(row);
    for (let i = 0; i < k; i++) {
      const idx = parent * k + i;
      done[row][idx] = 1;
      let ok: boolean;
      if (row === L - 1) {
        attempts++;
        ok = u() >= p.fail;
        if (ok) success = idx;
      } else ok = run(row + 1, idx);
      if (ok) return true;
    }
    return false;
  };
  const ok = run(0, 0);
  return { width, done, attempts, ok, success };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Retry amplification across nested layers",
    tree: "Calls each layer can issue for one logical operation",
    possible: "possible call",
    made: "made in this run",
    succeeded: "attempt that succeeded",
    calls: "{n:call/calls}",
    physical: "the last row reaches the model: physical attempts",
    chart: "Expected physical attempts per logical operation",
    xTitle: "probability p that one attempt fails",
    nested: "every layer retries",
    single: "one retry owner",
    fMax: "A_max = {terms} = {v}",
    fMaxOther: "the other design: A_max = {terms} = {v}",
    fE: "expected at p = {p}: (1 − p^A_max) / (1 − p) = {v} attempts",
    fFail: "the operation still fails with probability p^A_max = {v}",
    fRun: "this run: {a:attempt/attempts} reached the model; {out}",
    runOk: "attempt {k} succeeded",
    runFail: "all failed",
    describe: "{L:layer retries/layers retry} up to {r:time/times} each, {mode}: at most {amax} physical attempts per logical operation. With each attempt failing with probability {p}, a logical operation sends {e} attempts on average ({e2} with the other design) and still fails with probability {f}.",
    modeNested: "every layer retrying",
    modeSingle: "with one retry owner",
  },
  zh: {
    title: "嵌套重试层造成的重试放大",
    tree: "一项逻辑操作中，每一层可能发出的调用",
    possible: "可能的调用",
    made: "本次运行实际发出",
    succeeded: "成功的那次尝试",
    calls: "{n} 次调用",
    physical: "最后一行到达模型，即实际尝试",
    chart: "每项逻辑操作的实际尝试次数期望",
    xTitle: "单次尝试失败的概率 p",
    nested: "每一层都重试",
    single: "只有一个重试负责人",
    fMax: "A_max = {terms} = {v}",
    fMaxOther: "另一种设计：A_max = {terms} = {v}",
    fE: "p = {p} 时的期望：(1 − p^A_max) / (1 − p) = {v} 次尝试",
    fFail: "逻辑操作最终仍失败的概率 p^A_max = {v}",
    fRun: "本次运行：{a} 次尝试到达模型，{out}",
    runOk: "第 {k} 次成功",
    runFail: "全部失败",
    describe: "{L} 层各自最多重试 {r} 次，{mode}：每项逻辑操作最多产生 {amax} 次实际尝试。单次尝试失败概率为 {p} 时，一项逻辑操作平均发出 {e} 次尝试（另一种设计为 {e2} 次），最终失败的概率为 {f}。",
    modeNested: "每一层都重试",
    modeSingle: "只有一个重试负责人",
  },
};
type L = typeof labels.en;

const lines = (s: string, size: number, w: number, lang: Lang) => (lang === "zh" ? wrapCJK(s, size, w) : wrap(s, size, w));
const f2 = (v: number) => fixed(v, 2);
const small = (v: number) => (v === 0 ? "0" : v >= 0.001 ? fixed(v, 3) : sig(v, 2));

function terms(L: number, r: number, owner: Owner): string {
  return owner === "nested" ? Array.from({ length: L }, () => `(1 + ${r})`).join("") : `1 + ${r}`;
}

// ---------------------------------------------------------------- render

function renderTree(p: P, sim: ReturnType<typeof simulate>, w: number, y0: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.tree, TYPE.label, w - 12, lang)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  const lg = legend([
    { label: Lx.possible, swatch: { kind: "rect", fill: C.panel, stroke: C.rule } },
    { label: Lx.made, swatch: { kind: "rect", fill: C.c2 } },
    { label: Lx.succeeded, swatch: { kind: "rect", fill: C.c1 } },
  ], 0, y + 8, w, fs);
  parts.push(lg.svg);
  y += 8 + lg.height + 10;
  const names = LAYER_NAMES[lang];
  const nameW = Math.max(...names.slice(0, p.layers).map((s) => textWidth(s, TYPE.body))) + 12;
  const countW = textWidth(tpl(Lx.calls, { n: 256 }), fs) + 10;
  const x0 = nameW, rowW = Math.max(40, w - nameW - countW);
  const rowH = 16, gap = 8;
  for (let row = 0; row < p.layers; row++) {
    const n = sim.width[row];
    const yy = y + row * (rowH + gap);
    parts.push(text(0, yy + rowH - 4, names[row], { "font-size": TYPE.body, class: row === p.layers - 1 ? "fig-t-strong" : undefined }));
    const pitch = rowW / n;
    const cellGap = pitch >= 6 ? 1.5 : pitch >= 3 ? 0.8 : 0;
    // Every possible call as one path, the calls made and the success on top.
    const cells = (pick: (i: number) => boolean) => {
      const d: string[] = [];
      for (let i = 0; i < n; i++) if (pick(i)) d.push(`M${(x0 + i * pitch).toFixed(2)},${yy}h${Math.max(0.6, pitch - cellGap).toFixed(2)}v${rowH}h-${Math.max(0.6, pitch - cellGap).toFixed(2)}z`);
      return d.join("");
    };
    parts.push(el("path", { d: cells(() => true), fill: C.panel, stroke: pitch >= 5 ? C.rule : undefined, "stroke-width": pitch >= 5 ? 0.6 : undefined }));
    const made = cells((i) => sim.done[row][i] === 1 && !(row === p.layers - 1 && i === sim.success));
    if (made) parts.push(el("path", { d: made, fill: C.c2 }));
    if (row === p.layers - 1 && sim.success >= 0) parts.push(el("path", { d: cells((i) => i === sim.success), fill: C.c1 }));
    parts.push(text(w, yy + rowH - 4, tpl(Lx.calls, { n }), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" + (row === p.layers - 1 ? " fig-t-strong" : " fig-t-muted") }));
  }
  y += p.layers * (rowH + gap) + fs;
  for (const ln of lines(Lx.physical, fs, w - x0, lang)) { parts.push(text(x0, y, ln, { "font-size": fs, class: "fig-t-muted" })); y += fs + 4; }
  return { svg: g({ class: "fig-tree" }, ...parts), h: y - y0 };
}

function renderChart(p: P, w: number, y0: number, Lx: L, lang: Lang, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  let y = y0;
  for (const ln of lines(Lx.chart, TYPE.label, w - 12, lang)) { y += 17; parts.push(text(0, y, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); }
  y += 14;
  const left = 42, right = w - 12;
  const top = y, ph = 190, bottom = top + ph;
  const aN = amax(p.layers, p.retries, "nested"), aS = amax(p.layers, p.retries, "single");
  const yHi = Math.max(10, 10 ** Math.ceil(Math.log10(Math.max(aN, aS) * 1.05)));
  const xs = linear([0, 1], [left, right]);
  const ys = log([1, yHi], [bottom, top]);
  parts.push(axis({ scale: ys, orient: "left", at: left, grid: [left, right], minor: true, size: fs }));
  parts.push(axis({ scale: xs, orient: "bottom", at: bottom, ticks: [0, 0.25, 0.5, 0.75, 1], title: Lx.xTitle, size: fs, format: (v) => (v === 0 || v === 1 ? String(v) : f2(v)) }));
  const curve = (A: number): Array<[number, number]> => Array.from({ length: 201 }, (_, k) => { const q = k / 200; return [xs(q), ys(expectedAttempts(A, q))] as [number, number]; });
  const cN = curve(aN), cS = curve(aS);
  const obstacles: Box[] = [...lineObstacles(cN), ...lineObstacles(cS)];
  // The worst case A_max of each design, reached at p = 1.
  for (const [A, color] of [[aN, C.c2], [aS, C.c1]] as const) {
    parts.push(el("line", { x1: left, x2: right, y1: ys(A), y2: ys(A), stroke: color, "stroke-width": 1, "stroke-dasharray": "4 3", "stroke-opacity": 0.8 }));
  }
  parts.push(el("path", { d: linePath(cS), fill: "none", stroke: C.c1, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-opacity": p.owner === "single" ? 1 : 0.75 }));
  parts.push(el("path", { d: linePath(cN), fill: "none", stroke: C.c2, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-opacity": p.owner === "nested" ? 1 : 0.75 }));
  const cx = xs(p.fail);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  const reqs: Parameters<typeof placeLabels>[0] = [];
  for (const [A, color, own] of [[aN, C.c2, "nested"], [aS, C.c1, "single"]] as const) {
    const v = expectedAttempts(A, p.fail), cy = ys(v);
    parts.push(el("circle", { cx, cy, r: own === p.owner ? 5.5 : 4, fill: color, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 });
    // When the two designs coincide (L = 1 or r = 0), label the point once.
    if (aN === aS && own !== p.owner) continue;
    reqs.push({ x: cx, y: cy, text: sig(v, 3), size: TYPE.body, gap: 8, priority: own === p.owner ? 3 : 2, sides: ["left", "above-left", "below-left", "right", "above-right", "below-right"], attrs: { class: "fig-t-halo fig-t-strong fig-t-num" } });
  }
  const placed = placeLabels(reqs, { x0: left + 2, y0: top - 2, x1: right, y1: bottom - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  y = bottom + axisHeight(true, fs) + 6;
  const lg = legend([
    { label: `${Lx.nested}, A_max = ${aN}`, swatch: { kind: "line", stroke: C.c2 } },
    { label: `${Lx.single}, A_max = ${aS}`, swatch: { kind: "line", stroke: C.c1 } },
  ], 0, y, w, TYPE.body);
  parts.push(lg.svg);
  y += lg.height;
  return { svg: g({ class: "fig-chart" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const A = amax(p.layers, p.retries, p.owner), A2 = amax(p.layers, p.retries, p.owner === "nested" ? "single" : "nested");
  return tpl(Lx.describe, {
    L: p.layers, r: p.retries, mode: p.owner === "nested" ? Lx.modeNested : Lx.modeSingle, amax: A, p: f2(p.fail),
    e: sig(expectedAttempts(A, p.fail), 3), e2: sig(expectedAttempts(A2, p.fail), 3), f: small(p.fail ** A),
  });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const sim = simulate(p);
  const parts: string[] = [];
  const tree = renderTree(p, sim, w, 0, Lx, lang, fs);
  parts.push(tree.svg);
  let y = tree.h + 16;
  const ch = renderChart(p, w, y, Lx, lang, fs);
  parts.push(ch.svg);
  y += ch.h + 12;
  const other: Owner = p.owner === "nested" ? "single" : "nested";
  const A = amax(p.layers, p.retries, p.owner), A2 = amax(p.layers, p.retries, other);
  const rows: Array<[string, string]> = [
    [tpl(Lx.fMax, { terms: terms(p.layers, p.retries, p.owner), v: A }), "fig-t-num fig-t-strong"],
    [tpl(Lx.fMaxOther, { terms: terms(p.layers, p.retries, other), v: A2 }), "fig-t-num fig-t-muted"],
    [tpl(Lx.fE, { p: f2(p.fail), v: sig(expectedAttempts(A, p.fail), 3) }), "fig-t-num"],
    [tpl(Lx.fFail, { v: small(p.fail ** A) }), "fig-t-num"],
    [tpl(Lx.fRun, { a: sim.attempts, out: sim.ok ? tpl(Lx.runOk, { k: sim.attempts }) : Lx.runFail }), "fig-t-num"],
  ];
  const ro: string[] = [];
  for (const [line, cls] of rows) {
    for (const part of lines(line, TYPE.body, w, lang)) { y += 17; ro.push(text(0, y, part, { "font-size": TYPE.body, class: cls })); }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "retry-amplification",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    owner: {
      kind: "choice", label: { en: "Who retries", zh: "由谁重试" }, default: "nested",
      options: [
        { value: "nested", label: { en: "Every layer", zh: "每一层" } },
        { value: "single", label: { en: "One retry owner", zh: "一个重试负责人" } },
      ],
    },
    layers: {
      kind: "choice", label: { en: "Retrying layers L", zh: "重试层数 L" }, default: 3,
      options: [1, 2, 3, 4].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    retries: {
      kind: "choice", label: { en: "Retries per layer r", zh: "每层重试次数 r" }, default: 2,
      options: [0, 1, 2, 3].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    fail: {
      kind: "range", label: { en: "Probability an attempt fails, p", zh: "单次尝试失败的概率 p" }, min: 0, max: 1, step: 0.01, default: 0.9,
      marks: [{ value: 0.5, label: { en: "0.5", zh: "0.5" } }],
    },
    seed: { kind: "range", label: { en: "Run seed", zh: "运行种子" }, min: 1, max: 999, step: 1, default: 5, control: false },
  },
  render,
  describe,
});
