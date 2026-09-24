// Transfer time across four data-movement boundaries of one H100 SXM server,
// against the arithmetic that could hide it. Each boundary follows the
// chapter's latency-bandwidth model
//
//   T_msg(n) = α + n β,   β = 1 / B
//
// for a payload of n bytes. The arithmetic that consumes the payload does
// F = I·n FLOP, where I is the work per payload byte (the arithmetic intensity
// of the roofline section, with Q = n counted at that boundary), and takes
// F / P at the dense BF16 peak P. With perfect overlap the transfer is hidden
// when α + n / B ≤ I·n / P, that is when
//
//   I ≥ P / B + α P / n,
//
// so every boundary has its own ridge P / B for large payloads, and a small
// payload is bound by α whatever the bandwidth.
//
// Rates are per GPU and per direction, from NVIDIA datasheets: HBM3 at
// 3.35 TB/s (H100 SXM; the value roofline.ts and serving-lifecycle.ts use,
// read or write, with no direction), NVLink 4 at 900 GB/s total, 450 GB/s each
// way; PCIe Gen5 x16 at 128 GB/s total, 64 GB/s each way; one ConnectX-7 NDR
// port at 400 Gb/s, 50 GB/s each way. The startup latencies α are illustrative
// orders of magnitude that include software startup, not measurements; the
// figure and the caption say so.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { si, sig, tpl } from "./lib/format.ts";
import { H100 } from "./serving-lifecycle.ts";

type TierKey = "hbm" | "up" | "host" | "out";
interface Tier { key: TierKey; bw: number; alpha: number; color: string }
const TIERS: Tier[] = [
  { key: "hbm", bw: H100.bw, alpha: 0.5e-6, color: C.c1 },
  { key: "up", bw: 450e9, alpha: 2e-6, color: C.c2 },
  { key: "host", bw: 64e9, alpha: 5e-6, color: C.c3 },
  { key: "out", bw: 50e9, alpha: 10e-6, color: C.c4 },
];
const PEAK = H100.peak;
const MB = 1e6;
const N_DOM: [number, number] = [4e3, 1.6e10];
const T_DOM: [number, number] = [1e-7, 10];

const labels = {
  en: {
    title: "Transfer time at four boundaries against the arithmetic that could hide it",
    hbm: "HBM3, device memory",
    up: "Scale-up, NVLink 4",
    host: "Host, PCIe Gen5 x16",
    out: "Scale-out, 400G NIC",
    compute: "arithmetic F / P = I·n / P",
    computeShort: "F / P",
    hides: "below the dashed line: the transfer hides",
    x: "payload n (bytes)",
    y: "time",
    cursor: "n = {n}",
    head: "At n = {n}, T_msg = α + n / B against F / P = {tc}",
    colB: "B each way",
    colA: "α",
    colN: "n / B",
    colT: "T_msg",
    colI: "hides for I ≥",
    hidden: "hidden",
    exposed: "exposed {t}",
    terms: "{a} + {nb} = {t}",
    rate: "B = {b} each way; hides for I ≥ {i}",
    source: "B per GPU from NVIDIA datasheets (H100 SXM, ConnectX-7); α illustrative; P = {p} dense BF16.",
    describe: "A {n} payload with {i} FLOP of work per byte: the arithmetic takes {tc}. {rows}.",
    row: "{name} {t}, {s}",
  },
  zh: {
    title: "四道边界上的传输时间，与可能掩盖它的算术时间",
    hbm: "HBM3 设备内存",
    up: "scale-up：NVLink 4",
    host: "主机：PCIe Gen5 x16",
    out: "scale-out：400G NIC",
    compute: "算术时间 F / P = I·n / P",
    computeShort: "F / P",
    hides: "虚线下方：传输可被掩盖",
    x: "负载 n（字节）",
    y: "时间",
    cursor: "n = {n}",
    head: "n = {n} 时，T_msg = α + n / B，对照 F / P = {tc}",
    colB: "单向 B",
    colA: "α",
    colN: "n / B",
    colT: "T_msg",
    colI: "掩盖需 I ≥",
    hidden: "可掩盖",
    exposed: "暴露 {t}",
    terms: "{a} + {nb} = {t}",
    rate: "单向 B = {b}；I ≥ {i} 时可掩盖",
    source: "B 为 NVIDIA 数据手册中的单 GPU 数值（H100 SXM、ConnectX-7）；α 仅作示意；P = {p}，稠密 BF16。",
    describe: "负载 {n}，每字节对应 {i} FLOP 的算术：算术耗时 {tc}。{rows}。",
    row: "{name} {t}，{s}",
  },
};
type L = typeof labels.en;

type P = { payload: number; intensity: number };

function model(p: P) {
  const n = p.payload * MB;
  const tc = (p.intensity * n) / PEAK;
  const rows = TIERS.map((t) => {
    const nb = n / t.bw;
    const T = t.alpha + nb;
    return { ...t, nb, T, hidden: T <= tc, exposed: Math.max(0, T - tc), iHide: PEAK / t.bw + (t.alpha * PEAK) / n };
  });
  return { n, tc, rows };
}

const fmtB = (bytes: number) => si(bytes, "B");
const fmtT = (s: number) => si(s, "s");
const fmtI = (v: number) => sig(v, v < 100 ? 2 : 3);

function status(r: ReturnType<typeof model>["rows"][number], L: L): string {
  return r.hidden ? L.hidden : tpl(L.exposed, { t: fmtT(r.exposed) });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p);
  const rows = m.rows.map((r) => tpl(L.row, { name: L[r.key], t: fmtT(r.T), s: status(r, L) })).join(lang === "zh" ? "；" : "; ");
  return tpl(L.describe, { n: fmtB(m.n), i: fmtI(st.p.intensity), tc: fmtT(m.tc), rows });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const tick = narrow ? TYPE.body : TYPE.small;
  const m = model(p);
  const parts: string[] = [];

  // ---- legend
  const lg = legend([
    ...TIERS.map((t) => ({ label: L[t.key], swatch: { kind: "line" as const, stroke: t.color } })),
    { label: L.compute, swatch: { kind: "line" as const, stroke: C.ink, dash: "5 3" } },
    { label: L.hides, swatch: { kind: "rect" as const, fill: C.good, opacity: 0.25 } },
  ], 0, 0, w, TYPE.body);
  parts.push(lg.svg);

  // ---- plot: time against payload, log-log
  const left = narrow ? 50 : 58, right = w - 8;
  const top = lg.height + 30;
  const plotH = narrow ? 230 : 260;
  const x = log(N_DOM, [left, right]);
  const y = log(T_DOM, [top + plotH, top]);
  const yc = (v: number) => y(Math.min(Math.max(v, T_DOM[0]), T_DOM[1]));

  // Region under the arithmetic line: transfers drawn there are hidden.
  const nLo = Math.max(N_DOM[0], (T_DOM[0] * PEAK) / p.intensity);
  const nHi = Math.min(N_DOM[1], (T_DOM[1] * PEAK) / p.intensity);
  const computePts: Array<[number, number]> = nLo < nHi ? [[x(nLo), y((p.intensity * nLo) / PEAK)], [x(nHi), y((p.intensity * nHi) / PEAK)]] : [];
  if (computePts.length) {
    const shade: Array<[number, number]> = [[x(nLo), top + plotH], ...computePts];
    if (nHi < N_DOM[1]) shade.push([right, top], [right, top + plotH]);
    else shade.push([right, top + plotH]);
    parts.push(el("path", { d: linePath(shade) + "Z", fill: C.good, "fill-opacity": 0.08 }));
  }
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], minor: true, title: L.x, size: tick, format: (v) => fmtB(v), ticks: narrow ? [1e4, 1e6, 1e8, 1e10] : undefined }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], minor: true, title: L.y, size: tick, format: (v) => fmtT(v) }));

  const obstacles: Box[] = [];
  const ns: number[] = [];
  for (let k = 0; k <= 90; k++) ns.push(N_DOM[0] * (N_DOM[1] / N_DOM[0]) ** (k / 90));
  for (const t of TIERS) {
    const pts = ns.map((n): [number, number] => [x(n), yc(t.alpha + n / t.bw)]);
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: t.color, "stroke-width": 2.2, "stroke-linejoin": "round" }));
    obstacles.push(...lineObstacles(pts));
  }
  if (computePts.length) {
    parts.push(el("path", { d: linePath(computePts), fill: "none", stroke: C.ink, "stroke-width": 1.6, "stroke-dasharray": "5 3" }));
    obstacles.push(...lineObstacles(computePts));
  }

  // Cursor at the chosen payload, with the value of every curve on it.
  const cx = x(m.n);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  obstacles.push(...lineObstacles([[cx, top], [cx, top + plotH]]));
  const curLabel = tpl(L.cursor, { n: fmtB(m.n) });
  const clw = textWidth(curLabel, TYPE.body);
  const clx = Math.min(Math.max(cx, left + clw / 2), right - clw / 2);
  parts.push(text(clx, top - 8, curLabel, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));

  // Labels inside the plot: the arithmetic line and the hidden region.
  const reqs = [];
  if (computePts.length) {
    const [a, b] = computePts;
    const f = 0.62;
    const ax = a[0] + (b[0] - a[0]) * f, ay = a[1] + (b[1] - a[1]) * f;
    reqs.push({ x: ax, y: ay, text: L.computeShort, size: TYPE.body, sides: ["above-left", "left", "below-right", "right"] as const, gap: 8, priority: 3, attrs: { class: "fig-t-halo" } });
  }
  const dots: string[] = [];
  for (const r of m.rows) {
    const py = yc(r.T);
    dots.push(el("circle", { cx, cy: py, r: 4.5, fill: r.color, stroke: C.paper, "stroke-width": 1.5 }));
    obstacles.push({ x0: cx - 6, y0: py - 6, x1: cx + 6, y1: py + 6 });
  }
  if (m.tc >= T_DOM[0] && m.tc <= T_DOM[1]) {
    const py = y(m.tc);
    dots.push(el("circle", { cx, cy: py, r: 4.5, fill: C.paper, stroke: C.ink, "stroke-width": 2 }));
    obstacles.push({ x0: cx - 6, y0: py - 6, x1: cx + 6, y1: py + 6 });
  }
  const placed = placeLabels(reqs.map((r) => ({ ...r, sides: [...r.sides] })), { x0: left + 2, y0: top + 2, x1: right - 2, y1: top + plotH - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  parts.push(...dots);

  // ---- readout: the equation's terms at the chosen payload
  let yy = top + plotH + axisHeight(true, tick) + 22;
  const rp: string[] = [];
  const head = tpl(L.head, { n: fmtB(m.n), tc: fmtT(m.tc) });
  for (const ln of wrapCjk(head, TYPE.label, w)) { rp.push(text(0, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" })); yy += 18; }
  yy += 4;
  if (w >= 600) {
    // One table row per boundary; the status column is reserved at the right.
    const i = w - 118, t = i - 84, nb = t - 70, a = nb - 62;
    const cols = { b: a - 52, a, nb, t, i };
    const hdr = (xx: number, s: string, anchor = "end") => text(xx, yy, s, { "font-size": TYPE.small, "text-anchor": anchor, class: "fig-t-muted" });
    rp.push(hdr(cols.b, L.colB), hdr(cols.a, L.colA), hdr(cols.nb, L.colN), hdr(cols.t, L.colT), hdr(cols.i, L.colI));
    yy += 6;
    for (const r of m.rows) {
      rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
      const by = yy + 15;
      rp.push(el("rect", { x: 0, y: by - 9, width: 12, height: 3, rx: 1, fill: r.color }));
      rp.push(text(18, by, L[r.key], { "font-size": TYPE.body }));
      const num = (xx: number, s: string, cls = "fig-t-num") => text(xx, by, s, { "font-size": TYPE.body, "text-anchor": "end", class: cls });
      rp.push(num(cols.b, si(r.bw, "B/s")), num(cols.a, fmtT(r.alpha), "fig-t-num fig-t-muted"), num(cols.nb, fmtT(r.nb)), num(cols.t, fmtT(r.T), "fig-t-num fig-t-strong"), num(cols.i, fmtI(r.iHide)));
      rp.push(text(w, by, status(r, L), { "font-size": TYPE.body, "text-anchor": "end", class: r.hidden ? "fig-t-muted" : "fig-t-strong" }));
      rp.push(el("circle", { cx: w - textWidth(status(r, L), TYPE.body) * (r.hidden ? 1 : 1.06) - 10, cy: by - 4, r: 3.5, fill: r.hidden ? C.good : C.warn }));
      yy += 21;
    }
    rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    yy += 18;
  } else {
    // Phone: one block per boundary, the terms on a second line.
    for (const r of m.rows) {
      rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
      const by = yy + 16;
      rp.push(el("rect", { x: 0, y: by - 9, width: 12, height: 3, rx: 1, fill: r.color }));
      rp.push(text(18, by, L[r.key], { "font-size": TYPE.body, class: "fig-t-strong" }));
      const s = status(r, L);
      rp.push(text(w, by, s, { "font-size": TYPE.body, "text-anchor": "end", class: r.hidden ? "fig-t-muted" : "fig-t-strong" }));
      rp.push(el("circle", { cx: w - textWidth(s, TYPE.body) * (r.hidden ? 1 : 1.06) - 10, cy: by - 4, r: 3.5, fill: r.hidden ? C.good : C.warn }));
      rp.push(text(18, by + 18, tpl(L.terms, { a: fmtT(r.alpha), nb: fmtT(r.nb), t: fmtT(r.T) }), { "font-size": TYPE.body, class: "fig-t-num" }));
      rp.push(text(18, by + 35, tpl(L.rate, { b: si(r.bw, "B/s"), i: fmtI(r.iHide) }), { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
      yy += 58;
    }
    rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    yy += 18;
  }
  for (const ln of wrapCjk(tpl(L.source, { p: si(PEAK, "FLOP/s") }), tick, w)) { rp.push(text(0, yy, ln, { "font-size": tick, class: "fig-t-muted" })); yy += tick + 5; }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "boundary-transfer",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    payload: {
      kind: "range", scale: "log", label: { en: "Payload n", zh: "负载 n" }, unit: { en: "MB", zh: "MB" },
      min: 0.004, max: 16000, default: 256,
    },
    intensity: {
      kind: "range", scale: "log", label: { en: "Work per payload byte I", zh: "每字节负载的算术量 I" }, unit: { en: "FLOP/B", zh: "FLOP/B" },
      min: 0.25, max: 100000, default: 4000,
      marks: [{ value: Number(sig(PEAK / H100.bw, 3)), label: { en: "HBM ridge P / B", zh: "HBM 拐点 P / B" } }],
    },
  },
  render,
  describe,
});
