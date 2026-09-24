// Finite-difference error against the step size h, computed in the page in
// IEEE arithmetic for the chapter runnable's function f(t) = t² + sin t at
// x = 2, whose derivative f'(x) = 2x + cos x is known exactly:
//
//   forward   g_f(h) = (f(x + h) − f(x)) / h           error O(h) + O(ε / h)
//   central   g_c(h) = (f(x + h) − f(x − h)) / (2h)    error O(h²) + O(ε / h)
//
// Every value is evaluated in float64, or in float32 with Math.fround after
// every operation, so the round-off term is the machine's own. The dashed
// guides are the leading terms with this f's constants: truncation
// |f''| h / 2 and |f'''| h² / 6, and round-off ε |f| / h with ε the unit
// round-off of the format. Math.sin is the engine's; different engines agree
// to the last bit or nearly, which moves only the jagged round-off region.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { sig, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";

type Prec = "f64" | "f32";
type P = { logh: number; precision: Prec };

const X = 2;
const H_DOM: [number, number] = [1e-15, 1];
const E_DOM: [number, number] = [1e-12, 10];
const EPS: Record<Prec, number> = { f64: 2 ** -53, f32: 2 ** -24 };

const exact = 2 * X + Math.cos(X);
const f2 = Math.abs(2 - Math.sin(X)); // |f''(x)|
const f3 = Math.abs(Math.cos(X)); // |f'''(x)|
const fx = Math.abs(X * X + Math.sin(X));

// f and the two differences in the chosen format.
function estimates(h: number, prec: Prec) {
  const r = prec === "f32" ? Math.fround : (v: number) => v;
  const f = (t: number) => r(r(t * t) + r(Math.sin(t)));
  const x = r(X), hh = r(h);
  const fwd = r(r(f(r(x + hh)) - f(x)) / hh);
  const cen = r(r(f(r(x + hh)) - f(r(x - hh))) / r(2 * hh));
  return { fwd, cen, errF: Math.abs(fwd - exact), errC: Math.abs(cen - exact) };
}

// Sampled curves, memoized per format.
const curves = new Map<Prec, Array<{ h: number; errF: number; errC: number }>>();
function curve(prec: Prec) {
  let c = curves.get(prec);
  if (!c) {
    c = [];
    for (let k = 0; k <= 300; k++) {
      const h = H_DOM[0] * (H_DOM[1] / H_DOM[0]) ** (k / 300);
      const e = estimates(h, prec);
      c.push({ h, errF: e.errF, errC: e.errC });
    }
    curves.set(prec, c);
  }
  return c;
}

// Where the two leading terms sum to their minimum, for each method:
// forward  f2 h / 2 + ε|f| / h    at h* = √(2 ε|f| / f2)
// central  f3 h² / 6 + ε|f| / h   at h* = (3 ε|f| / f3)^(1/3)
// The measured error scatters around this sum in the round-off region, so
// the model, not the luckiest sample, names the best step.
function best(prec: Prec, method: "fwd" | "cen") {
  const eps = EPS[prec];
  const h = method === "fwd" ? Math.sqrt((2 * eps * fx) / f2) : Math.cbrt((3 * eps * fx) / f3);
  const e = method === "fwd" ? (f2 * h) / 2 + (eps * fx) / h : (f3 * h * h) / 6 + (eps * fx) / h;
  return { h, e };
}

const labels = {
  en: {
    title: "Finite-difference error against the step size",
    fwd: "forward difference",
    cen: "central difference",
    truncF: "truncation |f''| h / 2",
    truncC: "truncation |f'''| h² / 6",
    round: "round-off ε |f| / h",
    x: "step h",
    y: "|estimate − f'(x)|",
    cursor: "h = {h}",
    head: "f(t) = t² + sin t at x = 2, f'(x) = 2x + cos x = {d}, in {p}",
    colEst: "estimate",
    colErr: "error",
    colT: "truncation",
    colR: "round-off",
    best: "the two terms are smallest together at h ≈ {h}, about {e}",
    f64: "float64", f32: "float32",
    describe: "In {p} at h = {h}: the forward difference is off by {ef} and the central difference by {ec}. The leading terms put the best steps near h = {hf} (about {bf}) and h = {hc} (about {bc}).",
  },
  zh: {
    title: "有限差分误差随步长的变化",
    fwd: "前向差分",
    cen: "中心差分",
    truncF: "截断误差 |f''| h / 2",
    truncC: "截断误差 |f'''| h² / 6",
    round: "舍入误差 ε |f| / h",
    x: "步长 h",
    y: "|估计值 − f'(x)|",
    cursor: "h = {h}",
    head: "f(t) = t² + sin t，x = 2，f'(x) = 2x + cos x = {d}，{p} 运算",
    colEst: "估计值",
    colErr: "误差",
    colT: "截断项",
    colR: "舍入项",
    best: "两项之和在 h ≈ {h} 处最小，约为 {e}",
    f64: "float64", f32: "float32",
    describe: "{p} 运算、h = {h} 时：前向差分偏差 {ef}，中心差分偏差 {ec}。按主导误差项，最佳步长分别约为 h = {hf}（误差约 {bf}）和 h = {hc}（误差约 {bc}）。",
  },
};
type L = typeof labels.en;

const fmtH = (h: number) => sci(h, 2);
const fmtE = (e: number) => (e === 0 ? "0" : e < 1e-3 || e >= 1e4 ? sci(e, 2) : sig(e, 3));

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const h = 10 ** p.logh;
  const e = estimates(h, p.precision);
  const bf = best(p.precision, "fwd"), bc = best(p.precision, "cen");
  return tpl(L.describe, {
    p: L[p.precision], h: fmtH(h), ef: fmtE(e.errF), ec: fmtE(e.errC),
    bf: fmtE(bf.e), hf: fmtH(bf.h), bc: fmtE(bc.e), hc: fmtH(bc.h),
  });
}

const digits = (v: number) => v.toPrecision(10).replace(/^-/, "−");

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const tick = narrow ? TYPE.body : TYPE.small;
  const h = 10 ** p.logh;
  const eps = EPS[p.precision];
  const e = estimates(h, p.precision);
  const parts: string[] = [];

  // ---- legend
  const lg = legend([
    { label: L.fwd, swatch: { kind: "line", stroke: C.c1 } },
    { label: L.cen, swatch: { kind: "line", stroke: C.c2 } },
    { label: L.truncF, swatch: { kind: "line", stroke: C.c1, dash: "4 3" } },
    { label: L.truncC, swatch: { kind: "line", stroke: C.c2, dash: "4 3" } },
    { label: L.round, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
  ], 0, 0, w, TYPE.body);
  parts.push(lg.svg);

  // ---- plot: error against h, log-log
  const left = narrow ? 50 : 58, right = w - 8;
  const top = lg.height + 30;
  const plotH = narrow ? 240 : 270;
  const x = log(H_DOM, [left, right]);
  const y = log(E_DOM, [top + plotH, top]);
  const yc = (v: number) => y(Math.min(Math.max(v, E_DOM[0]), E_DOM[1]));
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], title: L.x, size: tick,
    ticks: narrow ? [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1] : [1e-15, 1e-13, 1e-11, 1e-9, 1e-7, 1e-5, 1e-3, 1e-1], format: (v) => sci(v, 2) }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, right], title: L.y, size: tick,
    ticks: [1e-12, 1e-9, 1e-6, 1e-3, 1], format: (v) => sci(v, 2) }));

  // Guides: the leading error terms, drawn only inside the plot.
  const guide = (fn: (hh: number) => number, stroke: string) => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 60; k++) {
      const hh = H_DOM[0] * (H_DOM[1] / H_DOM[0]) ** (k / 60);
      const v = fn(hh);
      if (v >= E_DOM[0] && v <= E_DOM[1]) pts.push([x(hh), y(v)]);
    }
    return pts.length > 1 ? el("path", { d: linePath(pts), fill: "none", stroke, "stroke-width": 1.3, "stroke-dasharray": "4 3" }) : "";
  };
  parts.push(guide((hh) => (f2 * hh) / 2, C.c1), guide((hh) => (f3 * hh * hh) / 6, C.c2), guide((hh) => (eps * fx) / hh, C.ink3));

  // Measured errors.
  const c = curve(p.precision);
  parts.push(el("path", { d: linePath(c.map((q) => [x(q.h), yc(q.errF)])), fill: "none", stroke: C.c1, "stroke-width": 1.8, "stroke-linejoin": "round" }));
  parts.push(el("path", { d: linePath(c.map((q) => [x(q.h), yc(q.errC)])), fill: "none", stroke: C.c2, "stroke-width": 1.8, "stroke-linejoin": "round" }));

  // Cursor and the two errors at h.
  const cx = x(h);
  parts.push(el("line", { x1: cx, x2: cx, y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  const cl = tpl(L.cursor, { h: fmtH(h) });
  const clw = textWidth(cl, TYPE.body);
  // Inside the plot beside the cursor, clear of the axis title above it.
  const flip = cx + 6 + clw > right - 2;
  parts.push(text(flip ? cx - 6 : cx + 6, top + 14, cl, { "font-size": TYPE.body, "text-anchor": flip ? "end" : "start", class: "fig-t-halo fig-t-num" }));
  parts.push(el("circle", { cx, cy: yc(e.errF), r: 4.5, fill: C.c1, stroke: C.paper, "stroke-width": 1.5 }));
  parts.push(el("circle", { cx, cy: yc(e.errC), r: 4.5, fill: C.c2, stroke: C.paper, "stroke-width": 1.5 }));

  // ---- readout
  let yy = top + plotH + axisHeight(true, tick) + 22;
  const rp: string[] = [];
  for (const ln of wrapCjk(tpl(L.head, { d: digits(exact), p: L[p.precision] }), TYPE.body, w)) { rp.push(text(0, yy, ln, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" })); yy += 17; }
  yy += 4;
  const rows = [
    { name: L.fwd, color: C.c1, est: e.fwd, err: e.errF, tr: (f2 * h) / 2, b: best(p.precision, "fwd") },
    { name: L.cen, color: C.c2, est: e.cen, err: e.errC, tr: (f3 * h * h) / 6, b: best(p.precision, "cen") },
  ];
  const ro = (eps * fx) / h;
  if (!narrow) {
    const cols = { est: 290, err: 380, tr: 470, ro: w };
    const hdr = (xx: number, s: string) => text(xx, yy, s, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" });
    rp.push(hdr(cols.est, L.colEst), hdr(cols.err, L.colErr), hdr(cols.tr, L.colT), hdr(cols.ro, L.colR));
    yy += 6;
    for (const r of rows) {
      rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
      const by = yy + 15;
      rp.push(el("rect", { x: 0, y: by - 9, width: 12, height: 3, rx: 1, fill: r.color }));
      rp.push(text(18, by, r.name, { "font-size": TYPE.body }));
      const num = (xx: number, v: string, cls = "fig-t-num") => text(xx, by, v, { "font-size": TYPE.body, "text-anchor": "end", class: cls });
      rp.push(num(cols.est, digits(r.est)), num(cols.err, fmtE(r.err), "fig-t-num fig-t-strong"), num(cols.tr, fmtE(r.tr), "fig-t-num fig-t-muted"), num(cols.ro, fmtE(ro), "fig-t-num fig-t-muted"));
      rp.push(text(18, by + 17, tpl(L.best, { e: fmtE(r.b.e), h: fmtH(r.b.h) }), { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
      yy += 40;
    }
  } else {
    for (const r of rows) {
      rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
      const by = yy + 16;
      rp.push(el("rect", { x: 0, y: by - 9, width: 12, height: 3, rx: 1, fill: r.color }));
      rp.push(text(18, by, r.name, { "font-size": TYPE.body, class: "fig-t-strong" }));
      rp.push(text(w, by, fmtE(r.err), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong fig-t-num" }));
      rp.push(text(18, by + 18, `${L.colEst} ${digits(r.est)}`, { "font-size": TYPE.body, class: "fig-t-num" }));
      rp.push(text(18, by + 35, `${L.colT} ${fmtE(r.tr)}, ${L.colR} ${fmtE(ro)}`, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" }));
      const bl = wrapCjk(tpl(L.best, { e: fmtE(r.b.e), h: fmtH(r.b.h) }), TYPE.body, w - 18);
      bl.forEach((ln, i) => rp.push(text(18, by + 52 + i * 17, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })));
      yy += 57 + bl.length * 17;
    }
  }
  rp.push(el("line", { x1: 0, x2: w, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "finite-difference-step",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    logh: {
      kind: "range", label: { en: "Step h, as log₁₀ h", zh: "步长 h（log₁₀ h）" }, min: -15, max: 0, step: 0.1, default: -6,
      marks: [{ value: -6, label: { en: "the runnable's h", zh: "可运行示例中的 h" } }],
    },
    precision: {
      kind: "choice", label: { en: "Arithmetic", zh: "运算精度" }, default: "f64",
      options: [
        { value: "f64", label: { en: "float64", zh: "float64" } },
        { value: "f32", label: { en: "float32", zh: "float32" } },
      ],
    },
  },
  render,
  describe,
});
