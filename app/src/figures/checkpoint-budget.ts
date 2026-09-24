// Checkpoint interval and the failure budget of a synchronous training job.
//
// The job-stopping interval comes from the chapter's independent-hazard model
// with N identical GPUs: Λ_job = N·λ, M = 1/Λ_job = M_GPU / N, where M_GPU is
// the per-GPU mean time between job-stopping interruptions. The default M_GPU
// is not reported anywhere: it is the Llama 3 job average (54 days, 419
// unexpected interruptions, about 185.6 min) multiplied by 16,384 GPUs, which
// is the chapter's conditional linear-scaling projection run in reverse.
//
// Three curves over the checkpoint interval τ:
//
//   first-order (the chapter): W(τ) ≈ C/τ + τ/(2M) + (D+R)/M,  τ* = √(2CM)
//   Daly's complete restart model (Daly 2006, cited by the chapter):
//     E(τ) = τ / (M · e^{(D+R)/M} · (e^{(τ+C)/M} − 1)),  W = 1 − E
//   one seeded run under Daly's assumptions: Poisson interruptions at rate 1/M
//     at any time (during checkpoint writes and recovery too), blocking
//     checkpoints of length C after every τ of computation, and D+R of
//     detection and recovery after each interruption, restarted if another
//     interruption arrives during it. An interruption discards everything
//     since the last completed checkpoint.
//
// The seeded run is simulated over 400 mean intervals for the shares in the
// readout; the strip draws its first 6 M.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend, type LegendItem } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, textWidth, type Box, type LabelRequest } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { int, sig, tpl } from "./lib/format.ts";
import { rng, exponential } from "./lib/random.ts";

// ---------------------------------------------------------------- model

const MIN_PER_YEAR = 365.25 * 24 * 60;
const LLAMA_N = 16384;
const LLAMA_M = (54 * 24 * 60) / 419; // minutes between unexpected interruptions, Llama 3 405B pretraining snapshot
const LLAMA_GPU_YEARS = Number(((LLAMA_M * LLAMA_N) / MIN_PER_YEAR).toPrecision(3)); // 5.78, derived, not reported

const HORIZON_M = 400; // seeded run length for the readout shares, in mean intervals
const WINDOW_M = 6; // part of the run drawn as a strip

type P = { gpus: number; gpuYears: number; ckpt: number; recover: number; tau: number; track: boolean; seed: number };

function jobInterval(p: Pick<P, "gpus" | "gpuYears">): number {
  return (p.gpuYears * MIN_PER_YEAR) / p.gpus;
}
function young(p: Pick<P, "gpus" | "gpuYears" | "ckpt">): number {
  return Math.sqrt(2 * p.ckpt * jobInterval(p));
}

interface Terms { ck: number; lost: number; dr: number; w: number }
function firstOrder(tau: number, M: number, Cc: number, DR: number): Terms {
  const ck = Cc / tau, lost = tau / (2 * M), dr = DR / M;
  return { ck, lost, dr, w: ck + lost + dr };
}
function dalyWaste(tau: number, M: number, Cc: number, DR: number): number {
  const denom = M * Math.exp(DR / M) * Math.expm1((tau + Cc) / M);
  return Number.isFinite(denom) && denom > 0 ? 1 - tau / denom : 1;
}

// Seeded run. `stretches` covers the drawn window: a run of completed compute
// and checkpoint cycles, the discarded partial cycle before an interruption,
// and detection plus recovery.
const K = { cycles: 0, lost: 1, recover: 2 } as const;
interface Stretch { t0: number; t1: number; kind: 0 | 1 | 2 }
interface Run {
  useful: number; ckpt: number; lost: number; recover: number; total: number; failures: number;
  stretches: Stretch[]; fails: number[]; window: number;
}

function simulate(M: number, tau: number, Cc: number, DR: number, seed: number): Run {
  const u = rng(seed);
  const H = HORIZON_M * M;
  const Wn = WINDOW_M * M;
  const s = tau + Cc;
  let t = 0, next = exponential(u(), 1 / M);
  let useful = 0, ckpt = 0, lost = 0, recover = 0, failures = 0;
  const stretches: Stretch[] = [];
  const fails: number[] = [];
  const keep = (t0: number, t1: number, kind: 0 | 1 | 2) => { if (t0 < Wn && t1 > t0) stretches.push({ t0, t1: Math.min(t1, Wn), kind }); };
  while (t < H) {
    // Complete cycles until the next interruption or the end of the run.
    const end = Math.min(next, H);
    const k = Math.floor((end - t) / s);
    useful += k * tau; ckpt += k * Cc;
    keep(t, t + k * s, K.cycles);
    t += k * s;
    if (next >= H) { useful += H - t; keep(t, H, K.cycles); t = H; break; } // work in progress at the end
    // The partial cycle is discarded.
    lost += next - t;
    keep(t, next, K.lost);
    t = next; failures++;
    if (t < Wn) fails.push(t);
    // Detection and recovery; an interruption during it restarts it.
    for (;;) {
      next = t + exponential(u(), 1 / M);
      if (next >= t + DR) { recover += DR; keep(t, t + DR, K.recover); t += DR; break; }
      recover += next - t; keep(t, next, K.recover);
      t = next; failures++;
      if (t < Wn) fails.push(t);
    }
  }
  return { useful, ckpt, lost, recover, total: t, failures, stretches, fails, window: Wn };
}

const memo = new Map<string, Run>();
function run(p: P, tau: number): Run {
  const M = jobInterval(p);
  const key = `${M}|${tau}|${p.ckpt}|${p.recover}|${p.seed}`;
  let r = memo.get(key);
  if (!r) {
    r = simulate(M, tau, p.ckpt, p.recover, p.seed);
    if (memo.size > 64) memo.clear();
    memo.set(key, r);
  }
  return r;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Checkpoint interval and the failure budget",
    plot: "Share of wall time lost, W",
    x: "checkpoint interval τ (log scale)",
    lgW: "W(τ), first-order",
    lgCk: "C/τ, checkpoint writes",
    lgLost: "τ/(2M), lost work",
    lgDR: "(D+R)/M, detect + recover",
    lgDaly: "Daly's model",
    lgSim: "seeded run",
    tauStar: "τ* = {v}",
    tauMark: "τ = {v}",
    mMark: "M",
    cMark: "2C",
    overW: ", W = {v}",
    eqM: "job interval M = {g} ÷ {n} GPUs = {m}",
    eqTau: "Young interval τ* = √(2CM) = {v}",
    head: "at τ = {v}",
    colModel: "first-order",
    colRun: "seeded run",
    rCk: "checkpoint writes",
    rLost: "lost work",
    rDR: "detect + recover",
    rW: "wall time lost",
    rE: "useful time",
    below0: "< 0",
    foot: "Seeded run: {len} of wall time, {n} interruptions. Daly's model gives E = {e}.",
    gap: "The first-order model and Daly's model differ by {d} points here: the waste is not small, so the first-order terms no longer hold.",
    strip: "The seeded run at τ = {v}, first {len}",
    sUseful: "useful compute",
    sCk: "checkpoint write",
    sLost: "lost work",
    sDR: "detect + recover",
    sFail: "interruption",
    dense: "checkpoints every {v}, shaded as their share",
    s: "s", min: "min", h: "h", d: "d", y: "y",
    tk10s: "10 s", tk1m: "1 min", tk10m: "10 min", tk1h: "1 h", tk10h: "10 h", tk1d: "1 d", tk1w: "1 wk",
    describe: "{n} GPUs at one job-stopping interruption per GPU every {g} give a job interval M of {m}, so the first-order optimum is τ* = {ts}. At τ = {tau} the first-order model loses {w} of wall time: {ck} to checkpoint writes, {lost} to lost work, {dr} to detection and recovery. The seeded run loses {ws}.",
    describeOut: "{n} GPUs at one job-stopping interruption per GPU every {g} give a job interval M of {m}. At τ = {tau} the first-order terms add up to {w}, outside the small-waste range where they hold; Daly's model loses {wd} of wall time and the seeded run {ws}.",
  },
  zh: {
    title: "检查点间隔与故障预算",
    plot: "损失的挂钟时间占比 W",
    x: "检查点间隔 τ（对数刻度）",
    lgW: "W(τ)，一阶近似",
    lgCk: "C/τ，写检查点",
    lgLost: "τ/(2M)，丢失的计算",
    lgDR: "(D+R)/M，检测与恢复",
    lgDaly: "Daly 模型",
    lgSim: "模拟运行",
    tauStar: "τ* = {v}",
    tauMark: "τ = {v}",
    mMark: "M",
    cMark: "2C",
    overW: "，W = {v}",
    eqM: "作业中断间隔 M = {g} ÷ {n} 块 GPU = {m}",
    eqTau: "Young 间隔 τ* = √(2CM) = {v}",
    head: "τ = {v} 时",
    colModel: "一阶近似",
    colRun: "模拟运行",
    rCk: "写检查点",
    rLost: "丢失的计算",
    rDR: "检测与恢复",
    rW: "损失合计",
    rE: "有效时间",
    below0: "< 0",
    foot: "模拟运行：挂钟时间 {len}，共 {n} 次中断。Daly 模型给出 E = {e}。",
    gap: "此处一阶近似与 Daly 模型相差 {d} 个百分点：损耗已不算小，一阶各项不再成立。",
    strip: "τ = {v} 时的一次模拟运行，前 {len}",
    sUseful: "有效计算",
    sCk: "写检查点",
    sLost: "丢失的计算",
    sDR: "检测与恢复",
    sFail: "中断",
    dense: "每 {v} 写一次检查点，按占比着色",
    s: "秒", min: "分钟", h: "小时", d: "天", y: "年",
    tk10s: "10 秒", tk1m: "1 分钟", tk10m: "10 分钟", tk1h: "1 小时", tk10h: "10 小时", tk1d: "1 天", tk1w: "1 周",
    describe: "{n} 块 GPU，每块 GPU 平均每 {g} 导致一次作业中断，作业中断间隔 M 为 {m}，一阶最优间隔 τ* = {ts}。τ = {tau} 时，一阶模型损失 {w} 的挂钟时间：写检查点 {ck}，丢失的计算 {lost}，检测与恢复 {dr}。模拟运行损失 {ws}。",
    describeOut: "{n} 块 GPU，每块 GPU 平均每 {g} 导致一次作业中断，作业中断间隔 M 为 {m}。τ = {tau} 时，一阶各项之和为 {w}，已超出它们成立的小损耗范围；Daly 模型损失 {wd} 的挂钟时间，模拟运行损失 {ws}。",
  },
};
type L = typeof labels.en;

function dur(min: number, L: L): string {
  if (min < 1) return `${sig(min * 60, 2)} ${L.s}`;
  if (min < 60) return `${sig(min, 3)} ${L.min}`;
  if (min < 48 * 60) return `${sig(min / 60, 3)} ${L.h}`;
  if (min < MIN_PER_YEAR) return `${sig(min / 1440, 3)} ${L.d}`;
  return `${sig(min / MIN_PER_YEAR, 3)} ${L.y}`;
}
const pc = (f: number) => (Math.abs(f) >= 0.1 ? `${(f * 100).toFixed(1)}%` : `${sig(f * 100, 2)}%`);

// ---------------------------------------------------------------- render

const X_DOMAIN: [number, number] = [0.1, 20000];
const Y_STEPS = [0.1, 0.2, 0.4, 0.6, 1];
const TICKS: Array<[number, keyof L]> = [[1 / 6, "tk10s"], [1, "tk1m"], [10, "tk10m"], [60, "tk1h"], [600, "tk10h"], [1440, "tk1d"], [10080, "tk1w"]];
const COL = { ck: C.c1, lost: C.c2, dr: C.c3 };

function derive(p: P) {
  const M = jobInterval(p);
  const ts = young(p);
  const tauOn = p.track ? ts : p.tau;
  const f = firstOrder(tauOn, M, p.ckpt, p.recover);
  const fs = firstOrder(ts, M, p.ckpt, p.recover);
  const dw = dalyWaste(tauOn, M, p.ckpt, p.recover);
  const r = run(p, tauOn);
  const ws = 1 - r.useful / r.total;
  return { M, ts, tauOn, f, fs, dw, r, ws };
}

function renderPlot(p: P, d: ReturnType<typeof derive>, w: number, y0: number, L: L, uid: string): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  parts.push(text(0, y0 + 14, L.plot, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const items: LegendItem[] = [
    { label: L.lgW, swatch: { kind: "line", stroke: C.ink } },
    { label: L.lgCk, swatch: { kind: "line", stroke: COL.ck } },
    { label: L.lgLost, swatch: { kind: "line", stroke: COL.lost } },
    { label: L.lgDR, swatch: { kind: "rect", fill: COL.dr, opacity: 0.35 } },
    { label: L.lgDaly, swatch: { kind: "line", stroke: C.ink2, dash: "5 3" } },
    { label: L.lgSim, swatch: { kind: "dot", fill: C.ink } },
  ];
  const lg = legend(items, 0, y0 + 24, w, TYPE.body);
  parts.push(lg.svg);
  const left = 42, right = narrow ? 6 : 10;
  const top = y0 + 24 + lg.height + 36;
  const plotH = narrow ? 190 : 230;
  const bottom = top + plotH;
  const x = log(X_DOMAIN, [left, w - right]);
  // The y range holds the valley at τ* with headroom, and the chosen τ and
  // the seeded run when the reader moves τ away from it.
  const need = Math.max(d.fs.w * 1.7, Math.min(d.f.w, 1) * 1.15, d.ws * 1.15);
  const ymax = Y_STEPS.find((v) => v >= need) ?? 1;
  const y = linear([0, ymax], [bottom, top]);
  const yt = y.ticks(narrow ? 4 : 5);
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], ticks: yt, format: (v) => `${sig(v * 100, 3)}%`, size: TYPE.body }));
  const tickVals = TICKS.map(([v]) => v);
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: tickVals, format: (v) => L[TICKS.find(([t]) => t === v)![1]], title: L.x, size: TYPE.body }));

  const clip = `${uid}-cb-clip`;
  parts.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top - 1, width: w - right - left, height: plotH + 1 }))));
  const plot: string[] = [];
  const { M } = d;
  const Cc = p.ckpt, DR = p.recover;
  // The detection and recovery floor: the same at every τ.
  const drY = y(Math.min(DR / M, ymax));
  plot.push(el("rect", { x: left, y: drY, width: w - right - left, height: bottom - drY, fill: COL.dr, "fill-opacity": 0.22 }));
  plot.push(el("line", { x1: left, x2: w - right, y1: drY, y2: drY, stroke: COL.dr, "stroke-width": 1.5 }));
  const n = 220;
  const pts = (fn: (tau: number) => number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    const [a, b] = X_DOMAIN.map(Math.log10);
    for (let i = 0; i <= n; i++) {
      const tau = 10 ** (a + ((b - a) * i) / n);
      const v = fn(tau);
      out.push([x(tau), y(Math.min(Math.max(v, -0.05), ymax * 1.5))]);
    }
    return out;
  };
  const ckPts = pts((tau) => Cc / tau);
  const lostPts = pts((tau) => tau / (2 * M));
  const wPts = pts((tau) => firstOrder(tau, M, Cc, DR).w);
  const dalyPts = pts((tau) => dalyWaste(tau, M, Cc, DR));
  plot.push(el("path", { d: linePath(ckPts), fill: "none", stroke: COL.ck, "stroke-width": 1.75 }));
  plot.push(el("path", { d: linePath(lostPts), fill: "none", stroke: COL.lost, "stroke-width": 1.75 }));
  plot.push(el("path", { d: linePath(dalyPts), fill: "none", stroke: C.ink2, "stroke-width": 1.5, "stroke-dasharray": "5 3" }));
  plot.push(el("path", { d: linePath(wPts), fill: "none", stroke: C.ink, "stroke-width": 2.5, "stroke-linejoin": "round" }));
  parts.push(g({ "clip-path": `url(#${clip})` }, ...plot));

  // Markers: 2C and M on the axis (τ* is their midpoint on this log axis),
  // τ* where the two frequency-dependent terms cross, the chosen τ, the run.
  const obstacles: Box[] = [
    ...lineObstacles(wPts.filter(([, py]) => py >= top && py <= bottom), 6, 3),
    ...lineObstacles(ckPts.filter(([, py]) => py >= top && py <= bottom)),
    ...lineObstacles(lostPts.filter(([, py]) => py >= top && py <= bottom)),
  ];
  const reqs: LabelRequest[] = [];
  const inX = (v: number) => v >= X_DOMAIN[0] && v <= X_DOMAIN[1];
  for (const [v, name] of [[2 * Cc, L.cMark], [M, L.mMark]] as const) {
    if (!inX(v)) continue;
    const px = x(v);
    parts.push(el("path", { d: `M${px - 5},${bottom} L${px + 5},${bottom} L${px},${bottom - 7} Z`, fill: C.ink2 }));
    obstacles.push({ x0: px - 5, y0: bottom - 7, x1: px + 5, y1: bottom });
    reqs.push({ x: px, y: bottom - 7, text: name, size: TYPE.body, sides: ["above", "above-right", "above-left"], gap: 4, priority: 2, attrs: { class: "fig-t-halo" } });
  }
  const tsX = x(d.ts);
  const tsW = d.fs.w;
  parts.push(el("line", { x1: tsX, x2: tsX, y1: top, y2: bottom, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  obstacles.push(...lineObstacles([[tsX, top], [tsX, bottom]]));
  if (tsW <= ymax) {
    parts.push(el("circle", { cx: tsX, cy: y(tsW), r: 4.5, fill: C.paper, stroke: C.ink, "stroke-width": 2 }));
    obstacles.push({ x0: tsX - 6, y0: y(tsW) - 6, x1: tsX + 6, y1: y(tsW) + 6 });
  }
  // Labels above the plot, where no curve runs: τ*, and the chosen τ when its
  // first-order value is off the top. A value off the top is marked by an
  // arrow and named in its label; two header labels that would touch stack.
  const header: Array<{ x: number; s: string; strong: boolean }> = [];
  const upArrow = (px: number) => el("path", { d: `M${px - 5},${top + 9} L${px + 5},${top + 9} L${px},${top + 1} Z`, fill: C.ink });
  header.push({ x: tsX, s: tpl(L.tauStar, { v: dur(d.ts, L) }) + (tsW > ymax ? tpl(L.overW, { v: pc(tsW) }) : ""), strong: true });
  if (tsW > ymax) parts.push(upArrow(tsX));
  const chosenApart = Math.abs(Math.log(d.tauOn / d.ts)) > 0.01;
  if (chosenApart && inX(d.tauOn)) {
    const cx = x(d.tauOn);
    const over = d.f.w > ymax;
    const cy = over ? top + 8 : y(d.f.w);
    parts.push(el("line", { x1: cx, x2: cx, y1: cy, y2: bottom, stroke: C.ink, "stroke-width": 1 }));
    parts.push(over ? upArrow(cx) : el("circle", { cx, cy, r: 5, fill: C.ink }));
    obstacles.push({ x0: cx - 6, y0: cy - 7, x1: cx + 6, y1: cy + 6 });
    const name = tpl(L.tauMark, { v: dur(d.tauOn, L) });
    if (over) header.push({ x: cx, s: name + tpl(L.overW, { v: pc(d.f.w) }), strong: false });
    else reqs.push({ x: cx, y: cy, text: name, size: TYPE.body, sides: ["right", "left", "below-right", "below-left", "above-right", "above-left"], gap: 8, priority: 4, attrs: { class: "fig-t-halo fig-t-num" } });
  }
  let lastRight = -Infinity;
  header.sort((a, b) => a.x - b.x).forEach((hd, i) => {
    const hw = textWidth(hd.s, TYPE.body);
    const hx = Math.min(Math.max(hd.x - hw / 2, left), w - right - hw);
    let hy = top - 8;
    if (i > 0 && hx < lastRight + 8) hy -= 16; // stack over the neighbor
    parts.push(text(hx, hy, hd.s, { "font-size": TYPE.body, class: hd.strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    lastRight = hx + hw;
  });
  // The seeded run's realized waste at the chosen τ.
  if (inX(d.tauOn) && d.ws <= ymax) {
    const sx = x(d.tauOn), sy = y(d.ws);
    parts.push(el("circle", { cx: sx, cy: sy, r: 3.5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  }
  obstacles.push(...lineObstacles(dalyPts.filter(([, py]) => py >= top && py <= bottom)));
  const placed = placeLabels(reqs, { x0: left + 2, y0: top + 1, x1: w - right, y1: bottom - 1 }, obstacles);
  parts.push(drawLabels(placed.placed));
  return { svg: g({ class: "fig-plot" }, ...parts), h: bottom - y0 + axisHeight(true, TYPE.body) };
}

function renderReadout(p: P, d: ReturnType<typeof derive>, w: number, y0: number, L: L, lang: Lang): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  let yy = y0 + 14;
  const eqM = tpl(L.eqM, { g: dur(p.gpuYears * MIN_PER_YEAR, L), n: int(p.gpus), m: dur(d.M, L) });
  const eqT = tpl(L.eqTau, { v: dur(d.ts, L) });
  for (const line of [eqM, eqT]) {
    for (const ln of wrap(line, TYPE.body, w)) {
      parts.push(text(0, yy, ln, { "font-size": TYPE.body, class: "fig-t-num" }));
      yy += 18;
    }
  }
  yy += 8;
  const colW = Math.max(textWidth(L.colModel, TYPE.body), textWidth(L.colRun, TYPE.body), textWidth("100%", TYPE.body)) + 14;
  const xB = w, xA = w - colW;
  const formW = narrow ? 0 : 76;
  parts.push(text(0, yy, tpl(L.head, { v: dur(d.tauOn, L) }), { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  parts.push(text(xA, yy, L.colModel, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(text(xB, yy, L.colRun, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted" }));
  yy += 7;
  const r = d.r;
  const e1 = 1 - d.f.w;
  const rows: Array<{ name: string; form: string; a: string; b: string; sw?: string; strong?: boolean }> = [
    { name: L.rCk, form: "C/τ", a: pc(d.f.ck), b: pc(r.ckpt / r.total), sw: COL.ck },
    { name: L.rLost, form: "τ/(2M)", a: pc(d.f.lost), b: pc(r.lost / r.total), sw: COL.lost },
    { name: L.rDR, form: "(D+R)/M", a: pc(d.f.dr), b: pc(r.recover / r.total), sw: COL.dr },
    { name: L.rW, form: "W", a: pc(d.f.w), b: pc(d.ws), strong: true },
    { name: L.rE, form: "E = 1 − W", a: e1 < 0 ? L.below0 : pc(e1), b: pc(1 - d.ws), strong: true },
  ];
  const rowH = 20;
  for (const row of rows) {
    parts.push(el("line", { x1: 0, x2: xB, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    const by = yy + 14;
    let nx = 0;
    if (row.sw) parts.push(el("rect", { x: 0, y: yy + 5, width: 10, height: 10, rx: 2, fill: row.sw }));
    nx = 16;
    if (!narrow) parts.push(text(nx, by, row.form, { "font-size": TYPE.body, class: "fig-t-num" }));
    parts.push(text(nx + formW, by, narrow ? `${row.form}  ${row.name}` : row.name, { "font-size": TYPE.body, class: row.strong ? "fig-t-strong" : undefined }));
    parts.push(text(xA, by, row.a, { "font-size": TYPE.body, "text-anchor": "end", class: row.strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    parts.push(text(xB, by, row.b, { "font-size": TYPE.body, "text-anchor": "end", class: row.strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    yy += rowH;
  }
  parts.push(el("line", { x1: 0, x2: xB, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
  yy += 18;
  const foot = tpl(L.foot, { len: dur(r.total, L), n: int(r.failures), e: pc(1 - d.dw) });
  for (const ln of wrap(foot, TYPE.body, w)) { parts.push(text(0, yy, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); yy += 17; }
  const gapPts = Math.abs(d.f.w - d.dw) * 100;
  if (gapPts >= 5) {
    yy += 2;
    const lines = wrap(tpl(L.gap, { d: sig(gapPts, 2) }), TYPE.body, w - 16);
    parts.push(el("rect", { x: 0, y: yy - 10, width: 8, height: 8, rx: 1, fill: C.bad }));
    lines.forEach((ln, i) => parts.push(text(16, yy + i * 17, ln, { "font-size": TYPE.body })));
    yy += lines.length * 17;
  }
  void lang;
  return { svg: g({ class: "fig-readout" }, ...parts), h: yy - y0 - 6 };
}

function renderStrip(p: P, d: ReturnType<typeof derive>, w: number, y0: number, L: L): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  const r = d.r;
  const titleLines = wrap(tpl(L.strip, { v: dur(d.tauOn, L), len: dur(r.window, L) }), TYPE.label, w);
  titleLines.forEach((ln, i) => parts.push(text(0, y0 + 14 + i * 18, ln, { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" })));
  let yy = y0 + 14 + (titleLines.length - 1) * 18 + 10;
  const lg = legend([
    { label: L.sUseful, swatch: { kind: "rect", fill: C.ink3, opacity: 0.35 } },
    { label: L.sCk, swatch: { kind: "rect", fill: COL.ck } },
    { label: L.sLost, swatch: { kind: "rect", fill: COL.lost } },
    { label: L.sDR, swatch: { kind: "rect", fill: COL.dr } },
    { label: L.sFail, swatch: { kind: "line", stroke: C.ink } },
  ], 0, yy, w, TYPE.body);
  parts.push(lg.svg);
  yy += lg.height + 8;
  const rows = narrow ? 6 : 3;
  const rowLen = r.window / rows;
  const labelW = 50;
  const x0 = labelW, x1 = w;
  const barH = 16, rowGap = 26;
  const s = d.tauOn + p.ckpt;
  const spacingPx = (s / rowLen) * (x1 - x0);
  const dense = spacingPx < 3;
  for (let i = 0; i < rows; i++) {
    const a = i * rowLen, b = a + rowLen;
    const x = linear([a, b], [x0, x1]);
    const top = yy + i * rowGap + 4;
    parts.push(text(labelW - 8, top + barH - 3, dur(a, L).replace(/^0 .*/, "0"), { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
    parts.push(el("rect", { x: x0, y: top, width: x1 - x0, height: barH, fill: C.panel }));
    for (const st of r.stretches) {
      if (st.t1 <= a || st.t0 >= b) continue;
      const s0 = Math.max(st.t0, a), s1 = Math.min(st.t1, b);
      if (st.kind === K.lost) { parts.push(el("rect", { x: x(s0), y: top, width: Math.max(1, x(s1) - x(s0)), height: barH, fill: COL.lost })); continue; }
      if (st.kind === K.recover) { parts.push(el("rect", { x: x(s0), y: top, width: Math.max(1, x(s1) - x(s0)), height: barH, fill: COL.dr })); continue; }
      parts.push(el("rect", { x: x(s0), y: top, width: x(s1) - x(s0), height: barH, fill: C.ink3, "fill-opacity": 0.35 }));
      if (dense) {
        parts.push(el("rect", { x: x(s0), y: top, width: x(s1) - x(s0), height: barH, fill: COL.ck, "fill-opacity": Math.min(1, p.ckpt / s) }));
        continue;
      }
      // Checkpoint writes at the end of each cycle, drawn at least 1 px wide.
      const j0 = Math.max(0, Math.floor((s0 - st.t0) / s));
      for (let j = j0; st.t0 + j * s < s1; j++) {
        const c0 = st.t0 + j * s + d.tauOn, c1 = c0 + p.ckpt;
        if (c1 <= s0 || c0 >= s1) continue;
        const px0 = x(Math.max(c0, a)), px1 = x(Math.min(c1, b));
        parts.push(el("rect", { x: px0, y: top, width: Math.max(1, px1 - px0), height: barH, fill: COL.ck }));
      }
    }
    for (const f of r.fails) {
      if (f < a || f >= b) continue;
      const fx = x(f);
      parts.push(el("line", { x1: fx, x2: fx, y1: top - 4, y2: top + barH + 2, stroke: C.ink, "stroke-width": 1.5 }));
      parts.push(el("path", { d: `M${fx - 4},${top - 8} L${fx + 4},${top - 8} L${fx},${top - 2} Z`, fill: C.ink }));
    }
  }
  yy += rows * rowGap + 4;
  if (dense) {
    parts.push(text(0, yy + 10, tpl(L.dense, { v: dur(s, L) }), { "font-size": TYPE.body, class: "fig-t-muted" }));
    yy += 18;
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: yy - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const d = derive(st.p);
  const out = Math.abs(d.f.w - d.dw) >= 0.05;
  return tpl(out ? L.describeOut : L.describe, {
    n: int(st.p.gpus), g: dur(st.p.gpuYears * MIN_PER_YEAR, L), m: dur(d.M, L), ts: dur(d.ts, L), tau: dur(d.tauOn, L),
    w: pc(d.f.w), ck: pc(d.f.ck), lost: pc(d.f.lost), dr: pc(d.f.dr), ws: pc(d.ws), wd: pc(d.dw),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const d = derive(p);
  const plot = renderPlot(p, d, w, 0, L, st.uid);
  let y = plot.h + 14;
  const parts = [plot.svg];
  if (narrow) {
    const ro = renderReadout(p, d, w, y, L, lang);
    parts.push(ro.svg); y += ro.h + 20;
    const sp = renderStrip(p, d, w, y, L);
    parts.push(sp.svg); y += sp.h;
  } else {
    const sp = renderStrip(p, d, w, y, L);
    parts.push(sp.svg); y += sp.h + 16;
    const ro = renderReadout(p, d, w, y, L, lang);
    parts.push(ro.svg); y += ro.h;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

const GPU_OPTIONS = [1024, 4096, LLAMA_N, 65536, 100000, 262144, 1048576].map((n) => ({
  value: n,
  label: n === LLAMA_N
    ? { en: `${int(n)} (Llama 3)`, zh: `${int(n)}（Llama 3）` }
    : { en: int(n), zh: int(n) },
}));

export default defineFigure({
  name: "checkpoint-budget",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    gpus: { kind: "choice", control: "buttons", label: { en: "GPUs in the job N", zh: "作业 GPU 数 N" }, default: LLAMA_N, options: GPU_OPTIONS },
    gpuYears: {
      kind: "range", scale: "log", label: { en: "Per-GPU interval between job stops", zh: "单块 GPU 的致停间隔" }, unit: { en: "years", zh: "年" },
      min: 1, max: 30, default: LLAMA_GPU_YEARS,
      marks: [{ value: LLAMA_GPU_YEARS, label: { en: "Llama 3 average × 16,384", zh: "Llama 3 平均值 × 16,384" } }],
    },
    ckpt: { kind: "range", scale: "log", label: { en: "Checkpoint write C", zh: "检查点写入 C" }, unit: { en: "min", zh: "分钟" }, min: 0.05, max: 30, default: 1 },
    recover: { kind: "range", scale: "log", label: { en: "Detect + recover D + R", zh: "检测与恢复 D + R" }, unit: { en: "min", zh: "分钟" }, min: 0.1, max: 60, default: 2 },
    tau: { kind: "range", scale: "log", label: { en: "Checkpoint interval τ", zh: "检查点间隔 τ" }, unit: { en: "min", zh: "分钟" }, min: 0.1, max: 3000, default: 19.3 },
    track: { kind: "toggle", label: { en: "Keep τ at τ*", zh: "τ 跟随 τ*" }, default: true },
    seed: { kind: "range", label: { en: "Run seed", zh: "模拟种子" }, min: 1, max: 999, step: 1, default: 3, control: false },
  },
  // With "Keep τ at τ*" on, τ follows the optimum as the cluster or the
  // checkpoint cost changes; moving τ by hand turns it off.
  update(p, key) {
    if (key === "tau") return { ...p, track: false };
    if (p.track && (key === "gpus" || key === "gpuYears" || key === "ckpt" || key === "track")) {
      return { ...p, tau: Math.min(3000, Math.max(0.1, Number(young(p).toPrecision(3)))) };
    }
    return p;
  },
  render,
  describe,
});
