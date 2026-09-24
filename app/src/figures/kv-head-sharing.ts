// KV-head sharing and the bytes it caches, in the transformer chapter's stated
// 7B-class configuration: L = 32 layers, H_q = 32 query heads of width
// d_h = 128, b = 2 bytes per cached element, batch size one, and 7e9 weights
// at two bytes each. Every number follows from the chapter's two cache
// equations:
//
//   dense (MHA, GQA, MQA)   M_KV  = 2 · L · B · S · H_kv · d_h · b
//   MLA                     M_MLA = L · B · S · (d_c + d_h^R) · b
//
// Grouped heads are only defined when H_kv divides H_q, so H_kv is a choice
// over the divisors of 32, not a free slider. Query head a reads KV head
// g(a) = floor(a / (H_q / H_kv)). MLA uses the widths the chapter gives for
// DeepSeek-V2, d_c = 4 d_h = 512 and d_h^R = d_h / 2 = 64, applied to this
// 32-layer shape; it is not DeepSeek-V2's own layer count.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { lineObstacles, overlaps, textBox, textWidth, wrap, type Box } from "./lib/labels.ts";
import { compact, int, sig, tpl } from "./lib/format.ts";

const LAYERS = 32;
const HQ = 32;
const DH = 128;
const BYTES = 2;
const DC = 4 * DH; // MLA joint KV latent width
const DR = DH / 2; // MLA decoupled RoPE-key width
const WEIGHTS = 7e9 * 2; // bytes
const GIB = 2 ** 30;
const KIB = 2 ** 10;
const S_MIN = 1000;
const S_MAX = 1_000_000;

// Layout values: H_kv for the dense variants, 0 for MLA.
type Layout = 32 | 16 | 8 | 4 | 2 | 1 | 0;
type P = { kv: Layout; context: number };

const perToken = (k: Layout) => (k === 0 ? LAYERS * (DC + DR) * BYTES : 2 * LAYERS * k * DH * BYTES);
const MHA_PER_TOKEN = perToken(32);
const MQA_PER_TOKEN = perToken(1);

const labels = {
  en: {
    title: "KV-head sharing and cache bytes",
    heads: "One layer: {q} query heads read {k:KV head/KV heads}",
    headsMla: "One layer: 32 query heads read one cached latent",
    rowQ: "Q",
    rowK: "K",
    rowV: "V",
    latent: "c^KV",
    rope: "k^R",
    perDense: "cached per token and layer: H_kv × (d_k + d_v) = {k} × 256 = {e} elements",
    perMla: "cached per token and layer: d_c + d_h^R = 512 + 64 = 576 elements",
    tile: "one tile is one head's k or v for one token, d_h = 128 elements; tiles are to scale",
    tileMla: "to scale: c^KV is d_c = 512 elements, k^R is d_h^R = 64; per-head K and V are derived from c^KV, not cached",
    halves: "query heads 1 to 16 on top, 17 to 32 below",
    chart: "KV cache against context length, batch size one",
    x: "context length S (tokens)",
    y: "KV cache (GiB)",
    weights: "weights {v} GiB",
    cross: "{s} tokens",
    mha: "MHA",
    mqa: "MQA",
    mla: "MLA",
    gqa: "GQA {k}",
    eqDense: "M_KV = 2 · L · B · S · H_kv · d_h · b",
    eqMla: "M_MLA = L · B · S · (d_c + d_h^R) · b",
    tokDense: "per token (B = 1): 2 · 32 · {k} · 128 · 2 B = {v}",
    tokMla: "per token (B = 1): 32 · (512 + 64) · 2 B = {v}",
    atS: "at S = {s}: {v} × {s} = {m}, {r}× the weights",
    atSPct: "at S = {s}: {v} × {s} = {m}, {r} of the weights",
    cross2: "cache = weights ({w} GiB) at S = {x} tokens",
    vsBase: "MHA is the baseline: every query head has its own K and V",
    vs: "1/{f} of MHA's bytes per token, since H_q / H_kv = 32 / {k}",
    vsMla: "1/{f} of MHA's bytes per token and {m}× MQA's",
    nameMha: "MHA",
    nameGqa: "GQA with {k} KV heads",
    nameMqa: "MQA",
    nameMla: "MLA",
    shareOwn: "each of the 32 query heads has its own KV head.",
    shareGroup: "{g} query heads share each of the {k} KV heads.",
    shareOne: "all 32 query heads share one KV head.",
    shareMla: "all 32 query heads read one cached latent of 576 elements per layer.",
    describe: "{mode}: {share} One token costs {t} of cache across 32 layers, so {s} tokens hold {m}, {r} the {w} GiB of weights; the cache equals the weights at {x} tokens.",
    times: "{r} times",
    pctOf: "{r} of",
  },
  zh: {
    title: "KV 头共享与缓存字节数",
    heads: "单层：{q} 个查询头读取 {k} 个 KV 头",
    headsMla: "单层：32 个查询头读取同一个缓存的潜在向量",
    rowQ: "Q",
    rowK: "K",
    rowV: "V",
    latent: "c^KV",
    rope: "k^R",
    perDense: "每词元每层缓存：H_kv × (d_k + d_v) = {k} × 256 = {e} 个元素",
    perMla: "每词元每层缓存：d_c + d_h^R = 512 + 64 = 576 个元素",
    tile: "一格是一个头在一个词元上的 k 或 v，d_h = 128 个元素，各格按同一比例绘制",
    tileMla: "按比例绘制：c^KV 有 d_c = 512 个元素，k^R 有 d_h^R = 64 个；逐头的 K 和 V 由 c^KV 导出，不进缓存",
    halves: "上排是查询头 1 到 16，下排是 17 到 32",
    chart: "KV 缓存随上下文长度增长，批大小为一",
    x: "上下文长度 S（词元）",
    y: "KV 缓存（GiB）",
    weights: "权重 {v} GiB",
    cross: "{s} 个词元",
    mha: "MHA",
    mqa: "MQA",
    mla: "MLA",
    gqa: "GQA {k}",
    eqDense: "M_KV = 2 · L · B · S · H_kv · d_h · b",
    eqMla: "M_MLA = L · B · S · (d_c + d_h^R) · b",
    tokDense: "每词元（B = 1）：2 · 32 · {k} · 128 · 2 B = {v}",
    tokMla: "每词元（B = 1）：32 · (512 + 64) · 2 B = {v}",
    atS: "S = {s} 时：{v} × {s} = {m}，是权重的 {r} 倍",
    atSPct: "S = {s} 时：{v} × {s} = {m}，相当于权重的 {r}",
    cross2: "S = {x} 个词元时，缓存 = 权重（{w} GiB）",
    vsBase: "MHA 是基线：每个查询头各有一组 K 和 V",
    vs: "每词元字节数是 MHA 的 1/{f}，因为 H_q / H_kv = 32 / {k}",
    vsMla: "每词元字节数是 MHA 的 1/{f}，是 MQA 的 {m} 倍",
    nameMha: "MHA",
    nameGqa: "GQA（{k} 个 KV 头）",
    nameMqa: "MQA",
    nameMla: "MLA",
    shareOwn: "32 个查询头各有一个 KV 头。",
    shareGroup: "每 {g} 个查询头共享一个 KV 头，共 {k} 个 KV 头。",
    shareOne: "32 个查询头共享一个 KV 头。",
    shareMla: "32 个查询头读取同一个缓存的潜在向量，每层 576 个元素。",
    describe: "{mode}：{share}每个词元在 32 层上占用 {t} 缓存，{s} 个词元共占 {m}，是 {w} GiB 权重的 {r}；缓存在 {x} 个词元时与权重相等。",
    times: "{r} 倍",
    pctOf: "{r}",
  },
};
type Labels = typeof labels.en;

const gib = (bytes: number) => `${sig(bytes / GIB, bytes / GIB < 0.1 ? 2 : 3)} GiB`;
const kib = (bytes: number) => `${sig(bytes / KIB, 3)} KiB`;
const WEIGHTS_GIB = sig(WEIGHTS / GIB, 3);

// Wrap at phrase boundaries first (after a colon, comma, or semicolon, in
// either language), so an expression such as "8 × 256 = 2,048" stays on one
// line; a phrase wider than the column falls back to word wrapping.
function phraseLines(s: string, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let cur = "";
  const chars = [...s];
  chars.forEach((ch, i) => {
    cur += ch;
    if (/[：；，]/.test(ch) || (ch === " " && /[:;,]/.test(chars[i - 1] ?? ""))) { chunks.push(cur); cur = ""; }
  });
  if (cur) chunks.push(cur);
  const out: string[] = [];
  let line = "";
  for (const c of chunks) {
    if (textWidth((line + c).trimEnd(), size) <= maxWidth) { line += c; continue; }
    if (line) out.push(line.trimEnd());
    if (textWidth(c.trimEnd(), size) <= maxWidth) { line = c; continue; }
    const parts = wrap(c, size, maxWidth);
    out.push(...parts.slice(0, -1));
    line = parts[parts.length - 1] + (c.endsWith(" ") ? " " : "");
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}

function model(p: P) {
  const t = perToken(p.kv);
  const m = t * p.context;
  return { t, m, ratio: m / WEIGHTS, cross: WEIGHTS / t };
}

function modeName(k: Layout, L: Labels): string {
  if (k === 0) return L.nameMla;
  if (k === HQ) return L.nameMha;
  if (k === 1) return L.nameMqa;
  return tpl(L.nameGqa, { k });
}

function lineName(k: Layout, L: Labels): string {
  if (k === 0) return L.mla;
  if (k === HQ) return L.mha;
  if (k === 1) return L.mqa;
  return tpl(L.gqa, { k });
}

const colorOf = (k: Layout) => (k === 0 ? C.c3 : C.c1);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const share = p.kv === 0 ? L.shareMla : p.kv === HQ ? L.shareOwn : p.kv === 1 ? L.shareOne : tpl(L.shareGroup, { g: HQ / p.kv, k: p.kv });
  return tpl(L.describe, {
    mode: modeName(p.kv, L), share, t: kib(m.t), s: int(p.context), m: gib(m.m), w: WEIGHTS_GIB, x: int(m.cross),
    r: m.ratio < 0.1 ? tpl(L.pctOf, { r: `${sig(m.ratio * 100, 2)}%` }) : tpl(L.times, { r: sig(m.ratio, 3) }),
  });
}

// ---------------------------------------------------------------- heads panel

interface Tile { x: number; y: number }

// One layer's head mapping. Desktop: one row of 32 query heads over the cached
// K and V rows. Phone: two rows of 16 with the cached heads between them, so
// the fans from the upper half run down and the fans from the lower half run up.
function renderHeads(p: P, w: number, y0: number, L: Labels): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  const title = p.kv === 0 ? L.headsMla : tpl(L.heads, { q: HQ, k: p.kv });
  parts.push(text(0, y0 + 14, title, { "font-size": TYPE.label, class: "fig-t-strong" }));

  const perRow = narrow ? 16 : 32;
  const gutter = narrow ? 18 : 22;
  const pitch = (w - gutter) / perRow;
  const tile = pitch - Math.max(2, pitch * 0.14);
  const fan = narrow ? 26 : 32;
  const top = y0 + 28;
  const G = p.kv === 0 ? HQ : HQ / p.kv; // query heads per cached unit
  const col = (i: number) => gutter + i * pitch;
  const center = (first: number, n: number) => col(first) + ((n - 1) / 2) * pitch + tile / 2;

  // Row geometry.
  const qA = top;
  let bandTop: number, bandBottom: number, qB = 0;
  if (narrow) {
    bandTop = qA + tile + fan;
    bandBottom = bandTop + 4 * tile + 2 + 8 + 2;
    qB = bandBottom + fan;
  } else {
    bandTop = qA + tile + fan;
    bandBottom = bandTop + 2 * tile + 2;
  }
  const bottom = narrow ? qB + tile : bandBottom;

  // Query tiles.
  const q: Array<Tile & { half: number }> = [];
  for (let a = 0; a < HQ; a++) {
    const half = narrow && a >= 16 ? 1 : 0;
    q.push({ x: col(a % perRow), y: half ? qB : qA, half });
  }

  // Cached units: for each, where it sits and which rows it occupies.
  const lines: string[] = [];
  const cached: string[] = [];
  const rowLabels: Array<[number, string]> = [[qA, L.rowQ]];
  if (narrow) rowLabels.push([qB, L.rowQ]);
  const connect = (a: number, cx: number, yTop: number, yBottom: number) => {
    const t = q[a];
    const x1 = t.x + tile / 2;
    lines.push(t.half
      ? linePath([[x1, t.y], [cx, yBottom]])
      : linePath([[x1, t.y + tile], [cx, yTop]]));
  };
  if (p.kv === 0) {
    // MLA: one latent row, c^KV (4 head widths) then k^R (half a head width).
    const wc = 4 * tile, wr = tile / 2, gap = 2;
    const total = wc + gap + wr;
    const cx = narrow ? center(0, 16) : center(0, 32);
    const x0 = cx - total / 2;
    const ly = narrow ? (bandTop + bandBottom) / 2 - tile / 2 : bandTop;
    cached.push(el("rect", { x: x0, y: ly, width: wc, height: tile, rx: 2, fill: C.c3 }));
    cached.push(el("rect", { x: x0 + wc + gap, y: ly, width: wr, height: tile, rx: 1.5, fill: C.c3, "fill-opacity": 0.6 }));
    for (let a = 0; a < HQ; a++) connect(a, cx, ly, ly + tile);
    if (!narrow) {
      cached.push(text(x0 + wc / 2, ly + tile + 15, L.latent, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
      cached.push(text(x0 + wc + gap + wr / 2 + 4, ly + tile + 15, L.rope, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
    }
  } else {
    const units = p.kv;
    // Phone: MQA's one unit is shared by both halves and sits in the middle of the band.
    const sharedBand = narrow && G > 16;
    for (let j = 0; j < units; j++) {
      const first = j * G;
      const half = narrow && !sharedBand && first >= 16 ? 1 : 0;
      const n = Math.min(G, perRow);
      const cx = sharedBand ? center(0, 16) : center(first % perRow, n);
      let yK: number;
      if (!narrow) yK = bandTop;
      else if (sharedBand) yK = (bandTop + bandBottom) / 2 - tile - 1;
      else yK = half ? bandTop + 2 * tile + 2 + 8 : bandTop;
      const yV = yK + tile + 2;
      cached.push(el("rect", { x: cx - tile / 2, y: yK, width: tile, height: tile, rx: 2, fill: C.c1 }));
      cached.push(el("rect", { x: cx - tile / 2, y: yV, width: tile, height: tile, rx: 2, fill: C.c1, "fill-opacity": 0.6 }));
      for (let a = first; a < first + G; a++) connect(a, cx, yK, yV + tile);
    }
    if (!narrow || sharedBand) {
      const yK = !narrow ? bandTop : (bandTop + bandBottom) / 2 - tile - 1;
      rowLabels.push([yK, L.rowK], [yK + tile + 2, L.rowV]);
    } else {
      const lower = bandTop + 2 * tile + 2 + 8;
      rowLabels.push([bandTop, L.rowK], [bandTop + tile + 2, L.rowV], [lower, L.rowK], [lower + tile + 2, L.rowV]);
    }
  }
  parts.push(el("path", { d: lines.join(""), fill: "none", stroke: C.ink3, "stroke-width": 1 }));
  for (const t of q) parts.push(el("rect", { x: t.x, y: t.y, width: tile, height: tile, rx: 2, fill: C.panel, stroke: C.ink3, "stroke-width": 1 }));
  parts.push(...cached);
  for (const [y, s] of rowLabels) parts.push(text(0, y + tile / 2 + 4.5, s, { "font-size": TYPE.body, class: "fig-t-muted" }));

  // Notes: elements per token and layer, and the tile scale.
  let y = bottom + (p.kv === 0 && !narrow ? 34 : 22);
  const notes: Array<[string, string]> = [
    [p.kv === 0 ? L.perMla : tpl(L.perDense, { k: p.kv, e: int(p.kv * 2 * DH) }), "fig-t-num"],
    [p.kv === 0 ? L.tileMla : L.tile, "fig-t-muted"],
  ];
  if (narrow) notes.push([L.halves, "fig-t-muted"]);
  for (const [s, cls] of notes) {
    for (const line of phraseLines(s, TYPE.body, w - 2)) {
      parts.push(text(0, y, line, { "font-size": TYPE.body, class: cls }));
      y += 16;
    }
    y += 2;
  }
  return { svg: g({ class: "fig-heads" }, ...parts), h: y - y0 };
}

// ---------------------------------------------------------------- chart

interface Cand { x: number; y: number; anchor: "start" | "end"; leader?: boolean; bounds?: Box }

// First candidate whose text box stays inside the bounds and clear of every
// obstacle; the chosen box becomes an obstacle for later labels.
function pick(s: string, cands: Cand[], bounds: Box, obstacles: Box[]): Cand {
  for (const c of cands) {
    const b = textBox(c.x, c.y, s, TYPE.body, c.anchor);
    const k = c.bounds ?? bounds;
    const inside = b.x0 >= k.x0 && b.x1 <= k.x1 && b.y0 >= k.y0 && b.y1 <= k.y1;
    if (inside && !obstacles.some((o) => overlaps(o, b))) { obstacles.push(b); return c; }
  }
  const c = cands[0];
  const b = textBox(c.x, c.y, s, TYPE.body, c.anchor);
  const dx = b.x0 < bounds.x0 ? bounds.x0 - b.x0 : b.x1 > bounds.x1 ? bounds.x1 - b.x1 : 0;
  const fallback = { ...c, x: c.x + dx };
  obstacles.push(textBox(fallback.x, fallback.y, s, TYPE.body, fallback.anchor));
  return fallback;
}

function renderChart(p: P, w: number, y0: number, L: Labels): { svg: string; h: number } {
  const narrow = w < 480;
  const parts: string[] = [];
  parts.push(text(0, y0 + 14, L.chart, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const left = narrow ? 44 : 50;
  const right = narrow ? 46 : 58; // room for the line names at the right end
  const top = y0 + 44;
  const plotH = narrow ? 210 : 230;
  const x = log([S_MIN, S_MAX], [left, w - right]);
  const y = log([0.01, 1000], [top + plotH, top]);
  const yB = (bytes: number) => y(bytes / GIB);
  parts.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], minor: true, title: L.x, size: TYPE.body }));
  parts.push(axis({ scale: y, orient: "left", at: left, grid: [left, w - right], title: L.y, size: TYPE.body, format: (v) => (v >= 1000 ? int(v) : sig(v, 3)) }));

  const obstacles: Box[] = [];
  // Weights as a horizontal line.
  const yw = yB(WEIGHTS);
  parts.push(el("line", { x1: left, x2: w - right, y1: yw, y2: yw, stroke: C.c2, "stroke-width": 2 }));
  obstacles.push(...lineObstacles([[left, yw], [w - right, yw]]));

  // Reference lines for the chapter's cases, and the chosen layout on top.
  const refs: Layout[] = [32, 8, 1, 0];
  const shown = refs.includes(p.kv) ? refs : [...refs, p.kv];
  const ends: Array<{ k: Layout; y: number }> = [];
  for (const k of shown) {
    const t = perToken(k);
    const pts: Array<[number, number]> = [[x(S_MIN), yB(t * S_MIN)], [x(S_MAX), yB(t * S_MAX)]];
    const on = k === p.kv;
    if (!on) parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
    obstacles.push(...lineObstacles(pts));
    ends.push({ k, y: pts[1][1] });
  }
  const m = model(p);
  const tOn = perToken(p.kv);
  const col = colorOf(p.kv);
  parts.push(el("path", { d: linePath([[x(S_MIN), yB(tOn * S_MIN)], [x(S_MAX), yB(tOn * S_MAX)]]), fill: "none", stroke: col, "stroke-width": 2.5 }));

  // Line names at the right end, pushed apart so they never overlap.
  ends.sort((a, b) => a.y - b.y);
  const minGap = 14;
  const ys = ends.map((e) => e.y + 4);
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + minGap);
  const maxY = top + plotH;
  if (ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY;
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - minGap);
  }
  ends.forEach((e, i) => {
    const on = e.k === p.kv;
    parts.push(text(w - right + 10, ys[i], lineName(e.k, L), { "font-size": TYPE.body, class: on ? "fig-t-strong" : "fig-t-muted" }));
    obstacles.push(textBox(w - right + 10, ys[i], lineName(e.k, L), TYPE.body));
  });

  // Weights label, at the left edge above the line.
  const wl = tpl(L.weights, { v: WEIGHTS_GIB });
  parts.push(text(left + 6, yw - 6, wl, { "font-size": TYPE.body, class: "fig-t-halo" }));
  obstacles.push(textBox(left + 6, yw - 6, wl, TYPE.body));

  // Where the chosen cache equals the weights, and the operating point.
  const xc = x(m.cross);
  const ox = x(p.context), oy = yB(m.m);
  parts.push(el("line", { x1: ox, x2: ox, y1: oy, y2: top + plotH, stroke: col, "stroke-width": 1, "stroke-dasharray": "2 2" }));
  obstacles.push({ x0: xc - 5, y0: yw - 5, x1: xc + 5, y1: yw + 5 }, { x0: ox - 6, y0: oy - 6, x1: ox + 6, y1: oy + 6 });
  obstacles.push(...lineObstacles([[ox, oy + 7], [ox, top + plotH]]), ...lineObstacles([[xc, yw + 5], [xc, top + plotH]]));
  // The crossover drops to the context axis and is named along its drop line,
  // as low as it fits, where the lines are sparse; the operating point is named
  // beside itself. Both labels are always drawn: each takes the first free
  // candidate position, or the first candidate if none is free.
  parts.push(el("line", { x1: xc, x2: xc, y1: yw + 5, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  const bounds: Box = { x0: left + 2, y0: top + 2, x1: w - right - 2, y1: top + plotH - 2 };
  const crossText = tpl(L.cross, { s: compact(m.cross) });
  const crossCands: Cand[] = [];
  const foot = top + plotH - 8;
  // At the foot of the drop line the label may run into the right margin,
  // which is empty that low (the line names sit at the lines' right ends).
  const wide: Box = { ...bounds, x1: w - 2 };
  crossCands.push({ x: xc - 5, y: foot, anchor: "end" }, { x: xc + 5, y: foot, anchor: "start", bounds: wide });
  for (let yy = foot - 16; yy > yw + 18; yy -= 16) crossCands.push({ x: xc - 5, y: yy, anchor: "end" }, { x: xc + 5, y: yy, anchor: "start" });
  // If the drop line is crowded (the operating point's own guide can run
  // beside it), name the crossover just above the open circle instead.
  for (const yy of [yw - 9, yw - 23]) crossCands.push({ x: xc - 4, y: yy, anchor: "end" }, { x: xc + 4, y: yy, anchor: "start" });
  const crossAt = pick(crossText, crossCands, bounds, obstacles);
  parts.push(text(crossAt.x, crossAt.y, crossText, { "font-size": TYPE.body, "text-anchor": crossAt.anchor, class: "fig-t-halo fig-t-soft fig-t-num" }));
  const opText = gib(m.m);
  const opCands: Cand[] = [
    { x: ox - 10, y: oy - 10, anchor: "end" }, { x: ox + 10, y: oy + 20, anchor: "start" },
    { x: ox + 12, y: oy + 4, anchor: "start" }, { x: ox - 12, y: oy + 4, anchor: "end" },
  ];
  for (const dy of [-24, 30, -38, 44, -52, 58]) opCands.push({ x: ox - 8, y: oy + dy, anchor: "end", leader: true }, { x: ox + 8, y: oy + dy, anchor: "start", leader: true });
  const opAt = pick(opText, opCands, bounds, obstacles);
  if (opAt.leader) parts.push(el("line", { x1: ox, y1: oy, x2: opAt.x, y2: opAt.y < oy ? opAt.y + 3 : opAt.y - TYPE.body + 1, stroke: C.ink3, "stroke-width": 1 }));
  parts.push(text(opAt.x, opAt.y, opText, { "font-size": TYPE.body, "text-anchor": opAt.anchor, class: "fig-t-halo fig-t-num" }));
  parts.push(el("circle", { cx: xc, cy: yw, r: 4, fill: C.paper, stroke: col, "stroke-width": 2 }));
  parts.push(el("circle", { cx: ox, cy: oy, r: 6.5, fill: col, stroke: C.paper, "stroke-width": 2 }));
  return { svg: g({ class: "fig-chart" }, ...parts), h: top - y0 + plotH + axisHeight(true, TYPE.body) };
}

// ---------------------------------------------------------------- readout

function renderReadout(p: P, w: number, y0: number, L: Labels): { svg: string; h: number } {
  const m = model(p);
  const parts: string[] = [];
  const lines: Array<[string, string]> = [
    [p.kv === 0 ? L.eqMla : L.eqDense, "fig-t-strong"],
    [p.kv === 0 ? tpl(L.tokMla, { v: kib(m.t) }) : tpl(L.tokDense, { k: p.kv, v: kib(m.t) }), "fig-t-num"],
    [m.ratio < 0.1
      ? tpl(L.atSPct, { s: int(p.context), v: kib(m.t), m: gib(m.m), r: `${sig(m.ratio * 100, 2)}%` })
      : tpl(L.atS, { s: int(p.context), v: kib(m.t), m: gib(m.m), r: sig(m.ratio, 3) }), "fig-t-num"],
    [tpl(L.cross2, { w: WEIGHTS_GIB, x: int(m.cross) }), "fig-t-num"],
    [p.kv === 0
      ? tpl(L.vsMla, { f: sig(MHA_PER_TOKEN / m.t, 3), m: sig(m.t / MQA_PER_TOKEN, 3) })
      : p.kv === HQ ? L.vsBase : tpl(L.vs, { f: HQ / p.kv, k: p.kv }), "fig-t-muted fig-t-num"],
  ];
  let y = y0 + 14;
  for (const [s, cls] of lines) {
    for (const line of phraseLines(s, cls === "fig-t-strong" ? TYPE.label : TYPE.body, w - 2)) {
      parts.push(text(0, y, line, { "font-size": cls === "fig-t-strong" ? TYPE.label : TYPE.body, class: cls }));
      y += 17;
    }
    y += 1;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const heads = renderHeads(st.p, w, 0, L);
  let y = heads.h + 14;
  const chart = renderChart(st.p, w, y, L);
  y += chart.h + 12;
  const ro = renderReadout(st.p, w, y, L);
  y += ro.h;
  return svg(w, y + 4, describe(st, lang), heads.svg, chart.svg, ro.svg);
}

export default defineFigure({
  name: "kv-head-sharing",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    kv: {
      kind: "choice", control: "buttons", label: { en: "KV heads H_kv", zh: "KV 头数 H_kv" }, default: 8,
      options: [
        { value: 32, label: { en: "32, MHA", zh: "32，MHA" } },
        { value: 16, label: { en: "16", zh: "16" } },
        { value: 8, label: { en: "8, GQA", zh: "8，GQA" } },
        { value: 4, label: { en: "4", zh: "4" } },
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 1, label: { en: "1, MQA", zh: "1，MQA" } },
        { value: 0, label: { en: "MLA latent", zh: "MLA 潜在向量" } },
      ],
    },
    context: {
      kind: "range", scale: "log", label: { en: "Context length S", zh: "上下文长度 S" }, unit: { en: "tokens", zh: "个词元" },
      min: S_MIN, max: S_MAX, default: 128_000,
      marks: [{ value: 128_000, label: { en: "128k", zh: "128k" } }],
    },
  },
  render,
  describe,
});
