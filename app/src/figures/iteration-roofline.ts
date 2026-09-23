// Prefill and decode regimes read as iteration time and token throughput
// against the tokens one iteration processes, from the chapter's bound
//
//   tau >= max(F / P_max, D / B_max),   I = F / D
//
// for the 8B model of this chapter's figures (serving-lifecycle.ts holds the
// shape, the datasheet figures, and iterationCost, which counts F and D).
// A decode iteration of n sequences reads every weight once plus each
// sequence's cached keys and values; a prefill of n prompt tokens reads the
// weights once and writes n tokens of cache. The same weights serve more work
// as n grows, so the weight term amortizes; the KV term of decode grows with n
// and with the context each sequence holds, and the KV budget (device memory
// minus weights and a 10 percent workspace and reserve, as in kv-admission.ts)
// caps how many sequences fit at all.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { placeLabels, drawLabels, lineObstacles, wrap, type Box, type LabelRequest } from "./lib/labels.ts";
import { legend } from "./lib/legend.ts";
import { si, sig, tpl } from "./lib/format.ts";
import { HW, KV_PER_TOKEN, WEIGHT_BYTES, iterationCost, type Hardware } from "./serving-lifecycle.ts";

type HwKey = keyof typeof HW;
type P = { phase: "decode" | "prefill"; n: number; context: number; hw: HwKey };

const N_MIN = 1, N_MAX = 16384;

function budget(hw: Hardware) { return hw.memory * 0.9 - WEIGHT_BYTES; }
function cost(phase: "decode" | "prefill", n: number, context: number, hw: Hardware) {
  return phase === "decode" ? iterationCost([], new Array(Math.round(n)).fill(context), hw) : iterationCost([Math.round(n)], [], hw);
}
// Decode cost without building an array per point: n sequences of one context.
function decodeCost(n: number, context: number, hw: Hardware) {
  const one = iterationCost([], [context], hw);
  const w = iterationCost([], [], hw);
  const F = one.F * n, D = w.D + (one.D - w.D) * n;
  const tF = (F / hw.peak) * 1000, tD = (D / hw.bw) * 1000;
  return { F, D, tF, tD, tau: Math.max(tF, tD) };
}
function curve(phase: "decode" | "prefill", n: number, context: number, hw: Hardware) {
  return phase === "decode" ? decodeCost(n, context, hw) : cost("prefill", n, context, hw);
}

const labels = {
  en: {
    title: "Iteration time and throughput against batch size",
    top: "Time per iteration",
    bottom: "Tokens per second",
    x: "tokens in one iteration: decode sequences or prompt tokens",
    xShort: "tokens in one iteration",
    yTop: "τ (ms)",
    yBottom: "tokens/s",
    decode: "decode, {c}-token contexts",
    prefill: "prefill of one prompt",
    cap: "KV memory full at {n} sequences",
    capOut: "decode past the KV budget",
    bound: "τ ≥ max(F / P_max, D / B_max)",
    termF: "F / P_max",
    termD: "D / B_max",
    bindsMem: "bytes bind: D / B_max is {r}× F / P_max",
    bindsCmp: "arithmetic binds: F / P_max is {r}× D / B_max",
    work: "F = {f}, D = {d}, I = F / D = {i} FLOP/B, ridge P_max / B_max = {r}",
    rateDecode: "{n:sequence/sequences} each get a token every {t}: {k} tokens/s",
    ratePrefill: "{n} prompt tokens in {t}: {k} tokens/s",
    kv: "KV state {u} of the {b} budget, which holds {c} sequences of this context",
    kvOver: "KV state {u} exceeds the {b} budget, which holds {c} sequences: this batch does not fit",
    describe: "{hw}, {phase} of {n} tokens: τ is at least {t}, bound by {what} (F / P_max = {tf}, D / B_max = {td}), for {k} tokens per second.",
    phDecode: "decode", phPrefill: "prefill", mem: "memory bandwidth", cmp: "arithmetic",
  },
  zh: {
    title: "迭代时间和吞吐量随批大小的变化",
    top: "每轮迭代的时间",
    bottom: "每秒词元数",
    x: "一轮迭代处理的词元：解码序列数或提示词词元数",
    xShort: "一轮迭代处理的词元",
    yTop: "τ（ms）",
    yBottom: "词元/秒",
    decode: "解码，每条上下文 {c} 个词元",
    prefill: "单个提示词的预填充",
    cap: "{n} 条序列时 KV 内存已满",
    capOut: "超出 KV 预算的解码",
    bound: "τ ≥ max(F / P_max, D / B_max)",
    termF: "F / P_max",
    termD: "D / B_max",
    bindsMem: "字节数主导：D / B_max 是 F / P_max 的 {r} 倍",
    bindsCmp: "算术主导：F / P_max 是 D / B_max 的 {r} 倍",
    work: "F = {f}，D = {d}，I = F / D = {i} FLOP/B，拐点 P_max / B_max = {r}",
    rateDecode: "{n} 条序列每 {t} 各得到一个词元，合计每秒 {k} 个词元",
    ratePrefill: "{n} 个提示词词元用时 {t}，合计每秒 {k} 个词元",
    kv: "KV 状态 {u}，预算 {b}，最多容纳 {c} 条这种长度的序列",
    kvOver: "KV 状态 {u} 超出 {b} 的预算（最多 {c} 条序列），这个批放不下",
    describe: "{hw}，{phase} {n} 个词元：τ 至少为 {t}，受{what}限制（F / P_max = {tf}，D / B_max = {td}），每秒 {k} 个词元。",
    phDecode: "解码", phPrefill: "预填充", mem: "内存带宽", cmp: "算力",
  },
};

type L = typeof labels.en;
const fmtT = (ms: number) => si(ms / 1000, "s");
const fmtK = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString("en-US") : sig(v, 3));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const hw = HW[p.hw];
  const c = curve(p.phase, p.n, p.context, hw);
  return tpl(L.describe, {
    hw: hw.name, phase: p.phase === "decode" ? L.phDecode : L.phPrefill, n: sig(p.n, 4), t: fmtT(c.tau),
    what: c.tD >= c.tF ? L.mem : L.cmp, tf: fmtT(c.tF), td: fmtT(c.tD), k: fmtK((p.n / c.tau) * 1000),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const hw = HW[p.hw];
  const tick = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const left = narrow ? 50 : 58, right = w - 8;
  const x = log([N_MIN, N_MAX], [left, right]);
  const ns: number[] = [];
  for (let k = 0; k <= 80; k++) ns.push(N_MIN * (N_MAX / N_MIN) ** (k / 80));
  const cap = Math.floor(budget(hw) / (p.context * KV_PER_TOKEN));
  const cur = curve(p.phase, p.n, p.context, hw);
  const plotH = narrow ? 150 : 170;

  // One panel: a quantity of both curves against n, the decode curve dashed
  // past the KV cap, the chosen point, and labels kept off the lines.
  const panel = (y0: number, title: string, yTitle: string, dom: [number, number], val: (c: { tau: number }, n: number) => number, withX: boolean, first: boolean) => {
    const top = y0 + 36;
    const yy = log(dom, [top + plotH, top]);
    const clampY = (v: number) => yy(Math.min(Math.max(v, dom[0]), dom[1]));
    const out: string[] = [text(0, y0 + 14, title, { "font-size": TYPE.label, class: "fig-t-strong" })];
    out.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], minor: true, title: withX ? (narrow ? L.xShort : L.x) : undefined, size: tick }));
    out.push(axis({ scale: yy, orient: "left", at: left, grid: [left, right], minor: true, title: yTitle, size: tick, format: (v) => si(v, "").replace(/\s+/g, "") }));
    // The KV cap for decode.
    const obstacles: Box[] = [];
    const reqs: LabelRequest[] = [];
    if (cap >= N_MIN && cap <= N_MAX) {
      out.push(el("line", { x1: x(cap), x2: x(cap), y1: top, y2: top + plotH, stroke: C.bad, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
      obstacles.push(...lineObstacles([[x(cap), top], [x(cap), top + plotH]]));
      if (first) reqs.push({ x: x(cap), y: top + 10, text: tpl(L.cap, { n: cap.toLocaleString("en-US") }), size: TYPE.body, sides: ["left", "right"], gap: 5, priority: 5, attrs: { class: "fig-t-halo fig-t-soft" } });
    }
    for (const phase of ["prefill", "decode"] as const) {
      const col = phase === "decode" ? C.c1 : C.c2;
      const fit: Array<[number, number]> = [], over: Array<[number, number]> = [];
      for (const n of ns) {
        const pt: [number, number] = [x(n), clampY(val(curve(phase, n, p.context, hw), n))];
        if (phase === "decode" && n > cap) { if (!over.length && fit.length) over.push(fit[fit.length - 1]); over.push(pt); } else fit.push(pt);
      }
      const on = phase === p.phase;
      if (fit.length) out.push(el("path", { d: linePath(fit), fill: "none", stroke: col, "stroke-width": on ? 2.5 : 1.6, "stroke-linejoin": "round" }));
      if (over.length) out.push(el("path", { d: linePath(over), fill: "none", stroke: col, "stroke-width": 1.4, "stroke-dasharray": "2 3", "stroke-opacity": 0.8 }));
      obstacles.push(...lineObstacles([...fit, ...over]));
    }
    // Operating point.
    const ox = x(p.n), oy = clampY(val(cur, p.n));
    out.push(el("line", { x1: ox, x2: ox, y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
    obstacles.push({ x0: ox - 7, y0: oy - 7, x1: ox + 7, y1: oy + 7 }, ...lineObstacles([[ox, top], [ox, top + plotH]]));
    const placed = placeLabels(reqs, { x0: left + 2, y0: top + 2, x1: right - 2, y1: top + plotH - 2 }, obstacles);
    out.push(drawLabels(placed.placed));
    out.push(el("circle", { cx: ox, cy: oy, r: 6, fill: p.phase === "decode" ? C.c1 : C.c2, stroke: C.paper, "stroke-width": 2 }));
    return { svg: g({}, ...out), h: top - y0 + plotH + (withX ? axisHeight(true, tick) : axisHeight(false, tick)) };
  };

  const lg = legend([
    { label: tpl(L.decode, { c: p.context.toLocaleString("en-US") }), swatch: { kind: "line", stroke: C.c1 } },
    { label: L.prefill, swatch: { kind: "line", stroke: C.c2 } },
    { label: L.capOut, swatch: { kind: "line", stroke: C.c1, dash: "2 3" } },
  ], 0, 0, w, TYPE.body);
  parts.push(lg.svg);
  let y = lg.height + 10;
  const a = panel(y, L.top, L.yTop, [1, 20000], (c) => c.tau, false, true);
  parts.push(a.svg);
  y += a.h + 10;
  const b = panel(y, L.bottom, L.yBottom, [100, 1e6], (c, n) => (n / c.tau) * 1000, true, false);
  parts.push(b.svg);
  y += b.h + 16;

  // ---- readout: the bound's two terms for the chosen point
  const rp: string[] = [];
  rp.push(text(0, y, L.bound, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const memBound = cur.tD >= cur.tF;
  const binds = memBound ? tpl(L.bindsMem, { r: sig(cur.tD / cur.tF, 3) }) : tpl(L.bindsCmp, { r: sig(cur.tF / cur.tD, 3) });
  if (!narrow) rp.push(text(w, y, binds, { "font-size": TYPE.body, "text-anchor": "end" }));
  y += narrow ? 18 : 10;
  if (narrow) { rp.push(text(0, y, binds, { "font-size": TYPE.body })); y += 8; }
  const nameW = 72, valW = narrow ? 64 : 76;
  const barX = nameW, barW = w - nameW - valW - 8;
  const tmax = Math.max(cur.tF, cur.tD);
  for (const [name, t, c] of [[L.termF, cur.tF, C.c2], [L.termD, cur.tD, C.c1]] as const) {
    y += 8;
    rp.push(text(0, y + 12, name, { "font-size": TYPE.body, class: "fig-t-num" }));
    rp.push(el("rect", { x: barX, y, width: barW, height: 16, rx: 3, fill: C.panel }));
    rp.push(el("rect", { x: barX, y, width: Math.max(2, (t / tmax) * barW), height: 16, rx: 3, fill: c }));
    rp.push(text(w, y + 12, fmtT(t), { "font-size": TYPE.body, "text-anchor": "end", class: (t === tmax ? "fig-t-strong " : "") + "fig-t-num" }));
    y += 16;
  }
  y += 22;
  const k = fmtK((p.n / cur.tau) * 1000);
  const rate = p.phase === "decode" ? tpl(L.rateDecode, { n: Math.round(p.n), t: fmtT(cur.tau), k }) : tpl(L.ratePrefill, { n: Math.round(p.n).toLocaleString("en-US"), t: fmtT(cur.tau), k });
  const put = (line: string, attrs: Record<string, string | number | undefined>) => {
    for (const ln of wrap(line, TYPE.body, w)) { rp.push(text(0, y, ln, { "font-size": TYPE.body, ...attrs })); y += 17; }
    y += 2;
  };
  put(rate, {});
  if (p.phase === "decode") {
    const used = p.n * p.context * KV_PER_TOKEN;
    put(tpl(used > budget(hw) ? L.kvOver : L.kv, { u: si(used, "B"), b: si(budget(hw), "B"), c: cap.toLocaleString("en-US") }), { class: used > budget(hw) ? "fig-t-strong" : undefined });
  }
  put(tpl(L.work, { f: si(cur.F, "FLOP"), d: si(cur.D, "B"), i: sig(cur.F / cur.D, 3), r: sig(hw.peak / hw.bw, 3) }), { class: "fig-t-muted fig-t-num" });
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y - 8, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "iteration-roofline",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    phase: {
      kind: "choice", label: { en: "Phase", zh: "阶段" }, default: "decode",
      options: [
        { value: "decode", label: { en: "Decode batch", zh: "解码批" } },
        { value: "prefill", label: { en: "Prefill prompt", zh: "预填充提示词" } },
      ],
    },
    n: {
      kind: "choice", control: "buttons", label: { en: "Tokens per iteration n", zh: "每轮词元数 n" }, default: 32,
      options: Array.from({ length: 15 }, (_, k) => 2 ** k).map((v) => ({ value: v, label: { en: v >= 1024 ? `${v / 1024}K` : String(v), zh: v >= 1024 ? `${v / 1024}K` : String(v) } })),
    },
    context: {
      kind: "choice", label: { en: "Context per decode sequence", zh: "每条解码序列的上下文" }, default: 2048,
      options: [
        { value: 256, label: { en: "256", zh: "256" } },
        { value: 2048, label: { en: "2,048", zh: "2,048" } },
        { value: 16384, label: { en: "16,384", zh: "16,384" } },
      ],
    },
    hw: {
      kind: "choice", label: { en: "Accelerator", zh: "加速器" }, default: "h100",
      options: [
        { value: "a100", label: { en: "A100 SXM", zh: "A100 SXM" } },
        { value: "h100", label: { en: "H100 SXM", zh: "H100 SXM" } },
        { value: "mi300x", label: { en: "MI300X", zh: "MI300X" } },
      ],
    },
  },
  render,
  describe,
});
