// A TopK sparse autoencoder read back from the activations of the toy model
// of superposition (superposition-toy.ts at 1 − S = 0.1, r = 0.9, where five
// features share two dimensions). The chapter's TopK form, with ReLU after
// TopK as in Gao et al. (2024):
//
//   z = W_enc (h − b_dec) + b_enc,   f = ReLU(TopK_k(z)),   ĥ = W_dec f + b_dec,
//
// with unit-norm decoder columns. SAES holds W_enc, b_enc, W_dec, and b_dec for
// dictionary widths m ∈ {3, 5, 8}, k ∈ {1, 2}, and seeds 1 to 3, each trained
// with Adam for 3000 steps on 100,000 toy activations from inputs with at least
// one active feature (tools/figure-data/superposition-toy.py, numpy 2.3.2). The
// page draws its own seeded held-out sample from the toy model and evaluates
// every check on it: reconstruction error, active latents, latent frequency,
// and, because the true directions v_i are known, the best cosine of each v_i
// with a decoder column and that latent's recall on inputs where a_i > 0.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, CATEGORICAL, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, wrap, type Box, type LabelRequest, type Side } from "./lib/labels.ts";
import { fixed as fixedRaw, int, pct, tpl } from "./lib/format.ts";

// Fixed decimals without a negative zero.
const fixed = (v: number, d: number) => fixedRaw(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v, d);
import { rng } from "./lib/random.ts";

const M = 5; // true features in the toy model
const SAMPLES = 3000; // held-out inputs with at least one active feature
const MATCH = 0.95; // a decoder column matches v_i when their cosine is at least this

interface Sae { encX: number[]; encY: number[]; benc: number[]; decX: number[]; decY: number[]; bdec: number[] }

// The toy model's directions v_i (superposition-toy.ts GRID at r = 0.9, 1 − S = 0.1).
const TOY = { dens: 0.1, vx: [1.107, -0.884, -0.887, 0.328, 0.341], vy: [0, 0.662, -0.65, -1.039, 1.027] };

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => String(n).split("").map((c) => SUB[Number(c)]).join("");
const vName = (i: number) => `v${sub(i + 1)}`;

// ---------------------------------------------------------------- model

interface Sample { a: number[]; x: number; y: number }
let sampleCache: Sample[] | undefined;
function samples(): Sample[] {
  if (sampleCache) return sampleCache;
  const r = rng(20260924);
  const out: Sample[] = [];
  while (out.length < SAMPLES) {
    const a = Array.from({ length: M }, () => { const on = r() < TOY.dens; const v = r(); return on ? v : 0; });
    if (!a.some((v) => v > 0)) continue;
    let x = 0, y = 0;
    for (let i = 0; i < M; i++) { x += a[i] * TOY.vx[i]; y += a[i] * TOY.vy[i]; }
    out.push({ a, x, y });
  }
  sampleCache = out;
  return out;
}

interface Eval {
  sae: Sae;
  m: number;
  fvu: number;
  l0: number;
  freq: number[];
  match: number[]; // for each latent: matched feature index, or -1
  best: Array<{ latent: number; cos: number; recall: number }>; // for each true feature
}

const VN = { x: [] as number[], y: [] as number[] };
for (let i = 0; i < M; i++) { const n = Math.hypot(TOY.vx[i], TOY.vy[i]); VN.x.push(TOY.vx[i] / n); VN.y.push(TOY.vy[i] / n); }

const memo = new Map<string, Eval>();
function evaluate(p: P): Eval {
  const key = `m${p.width}k${p.k}s${p.seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const sae = SAES[key];
  const m = sae.decX.length;
  const ss = samples();
  const fires = new Array(m).fill(0);
  let err = 0, tot = 0, active = 0, mx = 0, my = 0;
  for (const s of ss) { mx += s.x; my += s.y; }
  mx /= ss.length; my /= ss.length;
  const fired: boolean[][] = [];
  for (const s of ss) {
    const cx = s.x - sae.bdec[0], cy = s.y - sae.bdec[1];
    const z = sae.encX.map((ex, j) => ex * cx + sae.encY[j] * cy + sae.benc[j]);
    const top = z.map((v, j) => ({ v, j })).sort((a, b) => b.v - a.v).slice(0, p.k);
    let hx = sae.bdec[0], hy = sae.bdec[1];
    const on = new Array(m).fill(false);
    for (const t of top) {
      if (t.v <= 0) continue;
      hx += t.v * sae.decX[t.j];
      hy += t.v * sae.decY[t.j];
      on[t.j] = true;
      fires[t.j]++;
      active++;
    }
    fired.push(on);
    err += (s.x - hx) ** 2 + (s.y - hy) ** 2;
    tot += (s.x - mx) ** 2 + (s.y - my) ** 2;
  }
  const cos = (j: number, i: number) => sae.decX[j] * VN.x[i] + sae.decY[j] * VN.y[i];
  const freq = fires.map((c) => c / ss.length);
  const match = Array.from({ length: m }, (_, j) => {
    let bi = -1, bc = MATCH;
    for (let i = 0; i < M; i++) if (cos(j, i) >= bc) { bc = cos(j, i); bi = i; }
    return freq[j] > 0 ? bi : -1;
  });
  const best = Array.from({ length: M }, (_, i) => {
    let bj = 0;
    for (let j = 1; j < m; j++) if (cos(j, i) > cos(bj, i)) bj = j;
    let n = 0, hitN = 0;
    ss.forEach((s, t) => { if (s.a[i] > 0) { n++; if (fired[t][bj]) hitN++; } });
    return { latent: bj, cos: cos(bj, i), recall: n ? hitN / n : 0 };
  });
  const out = { sae, m, fvu: err / tot, l0: active / ss.length, freq, match, best };
  memo.set(key, out);
  return out;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Reading the toy activations back with a sparse autoencoder",
    plane: "Toy activations h and the dictionary",
    trueDir: "true direction vᵢ",
    matched: "decoder column matching vᵢ",
    unmatched: "matches no vᵢ",
    dead: "never fires",
    checks: "Checks on {n} held-out inputs",
    recon: "normalized reconstruction error {e}",
    l0: "active latents per input {l} (k = {k})",
    use: "{d:dead latent/dead latents}; {u:active latent matches/active latents match} no vᵢ",
    most: "most frequent latent fires on {p} of inputs",
    bdec: "b_dec = ({x}, {y})",
    truth: "Against the true features (toy only)",
    colFeature: "feature",
    colCos: "best cos",
    colRecall: "recall",
    recovered: "{n} of 5 recovered with cos ≥ 0.95",
    recallNote: "recall: share of inputs with aᵢ > 0 on which the best-matching latent fires",
    describe: "TopK autoencoder with {m} latents, k = {k}, seed {s}, on the toy activations: normalized reconstruction error {e}, {d} dead, {n} of 5 true features recovered with cosine at least 0.95.",
  },
  zh: {
    title: "用稀疏自编码器读回玩具模型的激活",
    plane: "玩具模型的激活 h 与字典",
    trueDir: "真实方向 vᵢ",
    matched: "与 vᵢ 对齐的解码列",
    unmatched: "不对应任何 vᵢ",
    dead: "从不激活",
    checks: "在 {n} 个留出输入上的检查",
    recon: "归一化重构误差 {e}",
    l0: "每个输入的活跃潜变量 {l}（k = {k}）",
    use: "死潜变量 {d} 个，另有 {u} 个活跃潜变量不对应任何 vᵢ",
    most: "最频繁的潜变量在 {p} 的输入上激活",
    bdec: "b_dec = ({x}, {y})",
    truth: "与真实特征对照（仅玩具模型可做）",
    colFeature: "特征",
    colCos: "最大余弦",
    colRecall: "召回率",
    recovered: "5 个特征中有 {n} 个以余弦 ≥ 0.95 恢复",
    recallNote: "召回率：在 aᵢ > 0 的输入中，与 vᵢ 最对齐的潜变量激活的比例",
    describe: "TopK 自编码器，{m} 个潜变量，k = {k}，随机种子 {s}，读回玩具模型的激活：归一化重构误差 {e}，死潜变量 {d} 个，5 个真实特征中有 {n} 个以不低于 0.95 的余弦恢复。",
  },
};

type P = { width: number; k: number; seed: number };

function recoveredCount(e: Eval) { return e.best.filter((b) => b.cos >= MATCH).length; }

function describe(st: State<P>, lang: Lang): string {
  const e = evaluate(st.p);
  return tpl(labels[lang].describe, {
    m: st.p.width, k: st.p.k, s: st.p.seed, e: fixed(e.fvu, 3), d: e.freq.filter((f) => f === 0).length, n: recoveredCount(e),
  });
}

// ---------------------------------------------------------------- render

function arrowHead(x: number, y: number, ux: number, uy: number, size: number, fill: string): string {
  const px = -uy, py = ux;
  const bx = x - ux * size, by = y - uy * size;
  return el("path", { d: `M${x},${y}L${bx + px * size * 0.5},${by + py * size * 0.5}L${bx - px * size * 0.5},${by - py * size * 0.5}Z`, fill });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = TYPE.body;
  const e = evaluate(p);
  const sae = e.sae;
  const parts: string[] = [];

  // ---- the plane: held-out activations, true directions, decoder columns
  const PW = narrow ? Math.min(w, 300) : Math.min(300, Math.floor(w * 0.48));
  const px0 = narrow ? (w - PW) / 2 : 0;
  parts.push(text(narrow ? 0 : px0, 14, L.plane, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const cx = px0 + PW / 2, cy = 26 + PW / 2;
  const RANGE = 1.9;
  const unit = (PW / 2 - 4) / RANGE;
  const X = (v: number) => cx + v * unit, Y = (v: number) => cy - v * unit;
  parts.push(el("rect", { x: px0, y: cy - PW / 2, width: PW, height: PW, rx: 4, fill: "none", stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("line", { x1: px0, x2: px0 + PW, y1: cy, y2: cy, stroke: C.grid, "stroke-width": 1 }));
  parts.push(el("line", { x1: cx, x2: cx, y1: cy - PW / 2, y2: cy + PW / 2, stroke: C.grid, "stroke-width": 1 }));
  const obstacles: Box[] = [];
  const reqs: LabelRequest[] = [];
  // True directions, drawn to the edge of the plane.
  for (let i = 0; i < M; i++) {
    const ux = VN.x[i], uy = VN.y[i];
    const t = (RANGE - 0.02) / Math.max(Math.abs(ux), Math.abs(uy));
    const ex = X(ux * t), ey = Y(uy * t);
    parts.push(el("line", { x1: cx, y1: cy, x2: ex, y2: ey, stroke: CATEGORICAL[i], "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    obstacles.push(...lineObstacles([[cx, cy], [ex, ey]], 8, 1.5));
    const lx = X(ux * t * 0.88), ly = Y(uy * t * 0.88);
    const sides: Side[] = Math.abs(ux) > Math.abs(uy) ? (uy > 0 ? ["above", "below"] : ["below", "above"]) : (ux > 0 ? ["left", "right"] : ["right", "left"]);
    reqs.push({ x: lx, y: ly, text: vName(i), size: fs, sides, gap: 7, priority: 1, attrs: { class: "fig-t-halo" } });
  }
  // Held-out activations over the true directions: an input with one active
  // feature lies on its ray, one with several lies between rays.
  const dots: string[] = [];
  samples().slice(0, 600).forEach((s) => {
    if (Math.abs(s.x) > RANGE - 0.03 || Math.abs(s.y) > RANGE - 0.03) return;
    dots.push(`M${(X(s.x) - 1.3).toFixed(1)},${(Y(s.y) - 1.3).toFixed(1)}h2.6v2.6h-2.6z`);
  });
  parts.push(el("path", { d: dots.join(""), fill: C.ink2, "fill-opacity": 0.5 }));
  // Decoder columns: unit arrows from the origin.
  const cols: string[] = [];
  for (let j = 0; j < e.m; j++) {
    const ux = sae.decX[j], uy = sae.decY[j];
    const tx = X(ux), ty = Y(uy);
    const dead = e.freq[j] === 0;
    const col = dead ? C.ink3 : e.match[j] >= 0 ? CATEGORICAL[e.match[j]] : C.ink;
    const sx = ux * unit, sy = -uy * unit, len = Math.hypot(sx, sy);
    cols.push(el("line", { x1: cx, y1: cy, x2: tx - (sx / len) * 7, y2: ty - (sy / len) * 7, stroke: col, "stroke-width": dead ? 1.75 : 3, "stroke-dasharray": dead ? "4 3" : undefined, "stroke-linecap": "round" }));
    cols.push(arrowHead(tx, ty, sx / len, sy / len, 9, col));
    obstacles.push(...lineObstacles([[cx, cy], [tx, ty]], 6, 2));
  }
  parts.push(g({}, ...cols));
  // b_dec, when it falls inside the plane.
  const bx = sae.bdec[0], by = sae.bdec[1];
  if (Math.abs(bx) < RANGE - 0.1 && Math.abs(by) < RANGE - 0.1 && Math.hypot(bx, by) > 0.08) {
    const qx = X(bx), qy = Y(by);
    parts.push(el("path", { d: `M${qx - 5},${qy}h10M${qx},${qy - 5}v10`, stroke: C.ink, "stroke-width": 2 }));
    reqs.push({ x: qx, y: qy, text: "b_dec", size: fs, sides: ["right", "left", "above", "below"], gap: 8, priority: 2, attrs: { class: "fig-t-halo fig-t-soft" } });
  }
  const placed = placeLabels(reqs, { x0: px0 + 2, y0: cy - PW / 2 + 2, x1: px0 + PW - 2, y1: cy + PW / 2 - 2 }, obstacles);
  parts.push(drawLabels(placed.placed));
  let ly = cy + PW / 2 + 12;
  const lg = legend([
    { label: L.trueDir, swatch: { kind: "line", stroke: C.c1, dash: "5 4" } },
    { label: L.matched, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.unmatched, swatch: { kind: "rect", fill: C.ink } },
    { label: L.dead, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
  ], narrow ? 0 : px0, ly, narrow ? w : PW, fs);
  parts.push(lg.svg);
  const planeBottom = ly + lg.height;

  // ---- readout: the chapter's checks, then the comparison with the truth
  const rx = narrow ? 0 : PW + 28;
  const rw = w - rx;
  let yy = narrow ? planeBottom + 26 : 14;
  const rp: string[] = [];
  const line = (s: string, cls: string, size: number = fs) => {
    for (const part of wrap(s, size, rw)) { rp.push(text(rx, yy, part, { "font-size": size, class: cls })); yy += size + 6; }
  };
  line(tpl(L.checks, { n: int(SAMPLES) }), "fig-t-strong", TYPE.label);
  yy += 4;
  const dead = e.freq.filter((f) => f === 0).length;
  const unmatched = e.match.filter((mm, j) => mm < 0 && e.freq[j] > 0).length;
  line(tpl(L.recon, { e: fixed(e.fvu, 3) }), "fig-t-num");
  line(tpl(L.l0, { l: fixed(e.l0, 2), k: p.k }), "fig-t-num");
  line(tpl(L.use, { d: dead, u: unmatched }), "fig-t-num");
  line(tpl(L.most, { p: pct(Math.max(...e.freq)) }), "fig-t-num");
  line(tpl(L.bdec, { x: fixed(bx, 2), y: fixed(by, 2) }), "fig-t-num fig-t-muted");
  yy += 16;
  line(L.truth, "fig-t-strong", TYPE.label);
  yy += 2;
  const cName = rx, cCos = rx + 104, cBar = cCos + 14, cRecall = rx + rw;
  const barW = Math.max(40, cRecall - 52 - cBar);
  rp.push(text(cName, yy, L.colFeature, { "font-size": fs, class: "fig-t-muted" }));
  rp.push(text(cCos, yy, L.colCos, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));
  rp.push(text(cBar, yy, L.colRecall, { "font-size": fs, class: "fig-t-muted" }));
  yy += 8;
  const rowH = 22;
  for (let i = 0; i < M; i++) {
    const b = e.best[i];
    const y0 = yy + i * rowH;
    const ok = b.cos >= MATCH;
    rp.push(el("line", { x1: rx, x2: rx + rw, y1: y0, y2: y0, stroke: C.grid, "stroke-width": 1 }));
    rp.push(el("rect", { x: cName, y: y0 + 6, width: 10, height: 10, rx: 2, fill: CATEGORICAL[i] }));
    rp.push(text(cName + 16, y0 + 15, vName(i), { "font-size": fs }));
    rp.push(text(cCos, y0 + 15, fixed(b.cos, 2), { "font-size": fs, "text-anchor": "end", class: `fig-t-num${ok ? "" : " fig-t-muted"}` }));
    rp.push(el("rect", { x: cBar, y: y0 + 6, width: barW, height: 10, rx: 2, fill: C.panel }));
    if (b.recall * barW >= 0.75) rp.push(el("rect", { x: cBar, y: y0 + 6, width: b.recall * barW, height: 10, rx: 2, fill: CATEGORICAL[i] }));
    rp.push(text(cRecall, y0 + 15, pct(b.recall), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
  }
  yy += M * rowH;
  rp.push(el("line", { x1: rx, x2: rx + rw, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
  yy += 18;
  line(tpl(L.recovered, { n: recoveredCount(e) }), "fig-t-strong");
  yy += 2;
  line(L.recallNote, "fig-t-muted");
  parts.push(g({ class: "fig-readout" }, ...rp));
  const h = Math.max(planeBottom, yy) + 4;
  return svg(w, h, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "sae-readback",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    width: {
      kind: "choice", label: { en: "Dictionary width m", zh: "字典宽度 m" }, default: 8,
      options: [3, 5, 8].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    k: {
      kind: "choice", label: { en: "Active latents k", zh: "活跃潜变量数 k" }, default: 1,
      options: [1, 2].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
    seed: {
      kind: "choice", label: { en: "Training seed", zh: "训练随机种子" }, default: 1,
      options: [1, 2, 3].map((v) => ({ value: v, label: { en: String(v), zh: String(v) } })),
    },
  },
  render,
  describe,
});

// ---------------------------------------------------------------- data

const SAES: Record<string, Sae> = {
  m3k1s1: { encX: [0.96, 1, 0.967], encY: [-0.279, -0.008, 0.257], benc: [0, 0, 0], decX: [0.96, 1, 0.966], decY: [-0.279, -0.008, 0.258], bdec: [-2.265, 0.022] }, // FVU 0.0697, freq [0.264, 0.469, 0.266], best cos [1, -0.618, -0.61, 0.555, 0.549]
  m3k1s2: { encX: [-0.932, -0.624, -0.807], encY: [0.361, 0.782, 0.591], benc: [0, 0, 0], decX: [-0.932, -0.624, -0.805], decY: [0.362, 0.781, 0.593], bdec: [1.892, -1.379] }, // FVU 0.0694, freq [0.268, 0.266, 0.465], best cos [-0.624, 1, 0.539, -0.625, 0.544]
  m3k1s3: { encX: [0.56, 0.044, 0.313], encY: [-0.828, -0.999, -0.95], benc: [0, 0, 0], decX: [0.557, 0.047, 0.311], decY: [-0.831, -0.999, -0.95], bdec: [-0.722, 2.159] }, // FVU 0.07, freq [0.27, 0.257, 0.473], best cos [0.557, -0.637, 0.552, 1, -0.613]
  m3k2s1: { encX: [0.02, 1.003, -0.018], encY: [-1.015, -0.152, 1.016], benc: [0, 0, -0.004], decX: [-0.15, 1, 0.147], decY: [-0.989, 0.02, 0.989], bdec: [-1.393, 0.666] }, // FVU 0, freq [0.926, 0.999, 0.074], best cos [1, 0.476, 0.705, 0.898, 0.985]
  m3k2s2: { encX: [-0.448, 0.448, -0.996], encY: [-0.921, 0.92, 0.239], benc: [0.001, 0, 0], decX: [-0.233, 0.235, -0.899], decY: [-0.972, 0.972, 0.438], bdec: [1.382, -0.225] }, // FVU 0, freq [0.824, 0.176, 0.999], best cos [0.235, 0.982, 0.763, 0.857, 0.996]
  m3k2s3: { encX: [0.94, -0.94, 0.237], encY: [0.368, -0.368, -0.981], benc: [0, 0, 0], decX: [0.972, -0.972, 0.365], decY: [0.235, -0.234, -0.931], bdec: [-0.146, 1.425] }, // FVU 0.0001, freq [0.223, 0.777, 0.998], best cos [0.972, 0.637, 0.923, 0.998, 0.53]
  m5k1s1: { encX: [0.771, 0.985, 0.411, -0.295, 0.957], encY: [0.637, -0.172, 0.912, 0.957, 0.291], benc: [0, 0, 0, -0.001, 0], decX: [0.77, 0.985, 0.413, -0.295, 0.957], decY: [0.637, -0.174, 0.911, 0.956, 0.289], bdec: [-1.125, -0.503] }, // FVU 0.0507, freq [0.273, 0.18, 0.098, 0.006, 0.442], best cos [0.985, 0.809, -0.327, 0.462, 0.994]
  m5k1s2: { encX: [-0.466, -0.947, -0.805, -0.983, 0.04], encY: [0.885, -0.322, 0.593, 0.182, 0.999], benc: [0, 0, 0, 0, 0], decX: [-0.468, -0.948, -0.805, -0.983, 0.041], decY: [0.884, -0.32, 0.594, 0.182, 0.999], bdec: [0.906, -0.664] }, // FVU 0.0434, freq [0.225, 0.069, 0.406, 0.226, 0.071], best cos [0.041, 1, 0.953, 0.019, 0.961]
  m5k1s3: { encX: [0.956, -0.403, 0.761, 0.397, 0.986], encY: [-0.294, -0.915, -0.649, -0.918, 0.17], benc: [0, 0, 0, 0, 0], decX: [0.956, -0.404, 0.761, 0.395, 0.986], decY: [-0.294, -0.915, -0.649, -0.919, 0.167], bdec: [-1.105, 0.499] }, // FVU 0.0512, freq [0.444, 0.006, 0.265, 0.098, 0.187], best cos [0.986, -0.225, 0.867, 0.995, 0.469]
  m5k2s1: { encX: [0.264, 0.149, -0.149, -0.977, 0.977], encY: [0.258, -0.992, 0.992, -0.225, 0.225], benc: [-0.389, 0, 0, 0, 0], decX: [0.469, 0.224, -0.224, -0.989, 0.989], decY: [0.883, -0.975, 0.975, -0.149, 0.149], bdec: [-0.122, -0.637] }, // FVU 0, freq [0, 0.098, 0.902, 0.285, 0.714], best cos [0.989, 0.764, 0.886, 0.997, 0.986]
  m5k2s2: { encX: [0.507, -0.507, -0.172, -0.813, 0.814], encY: [0.867, -0.868, 0.565, 0.588, -0.589], benc: [0, 0, -0.288, 0, 0], decX: [0.586, -0.586, -0.406, -0.865, 0.863], decY: [0.81, -0.81, 0.914, 0.502, -0.505], bdec: [-0.432, 0.471] }, // FVU 0, freq [0.313, 0.687, 0, 0.097, 0.903], best cos [0.863, 0.993, 0.952, 0.741, 0.954]
  m5k2s3: { encX: [0.943, -0.943, 0.426, -0.205, -0.426], encY: [0.345, -0.344, -0.909, -0.426, 0.909], benc: [0, 0, 0, -0.322, 0], decX: [0.905, -0.905, 0.343, -0.184, -0.343], decY: [0.425, -0.425, -0.939, -0.983, 0.939], bdec: [-0.134, -0.268] }, // FVU 0, freq [0.7, 0.3, 0.323, 0, 0.677], best cos [0.905, 0.838, 0.981, 0.999, 0.783]
  m8k1s1: { encX: [0.233, 0.799, 1, -0.823, 0.22, 0.796, -0.822, 0.658], encY: [0.972, 0.602, -0.005, 0.568, -0.975, -0.606, -0.569, 0.679], benc: [0, 0, 0, 0, 0, 0, 0, -0.039], decX: [0.235, 0.796, 1, -0.824, 0.221, 0.794, -0.822, 0.79], decY: [0.972, 0.605, -0.006, 0.566, -0.975, -0.607, -0.57, 0.613], bdec: [0.025, 0.002] }, // FVU 0.0298, freq [0.185, 0.021, 0.174, 0.208, 0.183, 0.022, 0.208, 0], best cos [1, 0.999, 1, 0.997, 0.996]
  m8k1s2: { encX: [0.378, -0.765, -0.276, -1, 0.819, 0.284, -0.798, 0.999], encY: [0.926, -0.643, 0.961, -0.001, -0.573, -0.958, 0.603, 0.044], benc: [0, 0, 0, 0, 0, 0, 0, 0], decX: [0.378, -0.765, -0.273, -1, 0.821, 0.284, -0.799, 0.999], decY: [0.926, -0.644, 0.962, 0.002, -0.571, -0.959, 0.601, 0.044], bdec: [-0.011, 0.008] }, // FVU 0.0216, freq [0.186, 0.184, 0.021, 0.022, 0.029, 0.189, 0.18, 0.189], best cos [0.999, 1, 0.998, 1, 0.998]
  m8k1s3: { encX: [1, -0.745, 0.37, -0.804, -0.804, 0.379, -0.998, -0.285], encY: [0.018, 0.667, 0.929, -0.594, -0.483, -0.925, 0.055, -0.958], benc: [0, 0, 0, 0, -0.045, 0, 0, 0], decX: [1, -0.744, 0.373, -0.803, -0.753, 0.376, -0.998, -0.286], decY: [0.017, 0.668, 0.928, -0.596, -0.658, -0.926, 0.057, -0.958], bdec: [-0.024, -0.013] }, // FVU 0.0289, freq [0.211, 0.187, 0.204, 0.172, 0, 0.181, 0.022, 0.023], best cos [1, 0.996, 1, 0.997, 0.998]
  m8k2s1: { encX: [0.662, 0.614, 0.649, -0.738, 0.738, 0.588, -0.668, 0.237], encY: [0.738, 0.016, 0.018, 0.675, -0.675, 0.018, -0.744, 0.406], benc: [0.001, -0.303, -0.332, 0, 0, -0.285, 0, -0.321], decX: [0.674, 0.958, 0.993, -0.744, 0.744, 0.89, -0.675, 0.461], decY: [0.738, 0.285, 0.114, 0.668, -0.668, -0.456, -0.738, 0.887], bdec: [0.59, 0.394] }, // FVU 0, freq [0.083, 0, 0, 0.663, 0.337, 0, 0.917, 0], best cos [0.993, 0.996, 0.98, 0.861, 0.987]
  m8k2s2: { encX: [0.511, -0.513, -0.017, -0.887, 0.563, 0.887, -0.164, 0.585], encY: [0.856, -0.86, 0.589, 0.464, 0.406, -0.464, 0.464, 0.42], benc: [0.001, 0, -0.266, 0, -0.325, 0, -0.32, -0.343], decX: [0.463, -0.464, -0.174, -0.859, 0.867, 0.859, -0.728, 0.989], decY: [0.886, -0.886, 0.985, 0.512, 0.498, -0.512, 0.686, 0.147], bdec: [0.16, 0.614] }, // FVU 0, freq [0.095, 0.904, 0, 0.359, 0, 0.641, 0, 0], best cos [0.989, 0.994, 0.898, 0.747, 0.987]
  m8k2s3: { encX: [0.704, -0.703, 0.721, -0.618, -0.612, -0.283, -0.566, -0.711], encY: [-0.711, 0.711, 0.693, -0.273, -0.279, -0.607, -0.223, -0.686], benc: [0, 0, 0, -0.258, -0.258, -0.284, -0.211, 0.002], decX: [0.693, -0.693, 0.711, -0.847, -0.766, -0.153, -0.774, -0.709], decY: [-0.721, 0.721, 0.703, -0.531, -0.642, -0.988, -0.634, -0.705], bdec: [-0.637, -0.403] }, // FVU 0, freq [0.677, 0.323, 0.93, 0, 0, 0, 0, 0.07], best cos [0.711, 0.987, 0.999, 0.896, 0.892]
};
