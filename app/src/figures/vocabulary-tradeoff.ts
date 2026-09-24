// Vocabulary size against sequence length and token-indexed parameters.
//
// Sequence length is measured (data/vocabulary-sweep.ts): tokens per 1,000
// UTF-8 bytes of FLORES-200 devtest English and Chinese for five published
// byte-level BPE merge tables cut at their first V ranks, with each table's own
// pretokenizer. The page interpolates between points measured every eighth of
// an octave, linearly in log V.
//
// Parameters follow the chapter's equation, P_token = V d when the input and
// output weights are tied and 2 V d when they are not, at two bytes per
// parameter, for published checkpoints. The rest of each checkpoint is held at
// its published size, so the share at V is P_token(V) / (N_rest + P_token(V)).
// The output projection's work per position is V d multiply-adds either way.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, CATEGORICAL, TYPE } from "./lib/theme.ts";
import { log, linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { int, pct, si, tpl } from "./lib/format.ts";
import { count } from "./lib/notation.ts";
import { FAMILIES, SWEEP, MODELS } from "./data/vocabulary-sweep.ts";

type FamKey = (typeof FAMILIES)[number]["key"];
type ModelKey = (typeof MODELS)[number]["key"];
type Text = "en" | "zh";
const V_MIN = 256, V_MAX = 262144;
const LLAMA3_BASE = 100256; // Llama 3 keeps cl100k's first 100,256 ranks

const labels = {
  en: {
    title: "Vocabulary size, sequence length, and token-indexed parameters",
    en: "English",
    zh: "Chinese",
    panel: "{lang}, tokens per 1,000 UTF-8 bytes",
    xShort: "vocabulary size V",
    share: "Token-indexed share of {m}'s parameters",
    tiedLine: "tied, V·d",
    untiedLine: "untied, 2V·d",
    shipped: "{m} ships V = {v}",
    atV: "V = {v}",
    eqTied: "P_token = V·d = {v} × {d} = {p} parameters, {b} at 2 bytes",
    eqUntied: "P_token = 2V·d = 2 × {v} × {d} = {p} parameters, {b} at 2 bytes",
    shareLine: "{s} of {m}, whose other {r} parameters stay fixed",
    logits: "Output projection: V·d = {f} multiply-adds per position",
    colTable: "merge table",
    colHead: "Tokens per 1,000 UTF-8 bytes at V, and the change from V/2",
    ends: "{t} at its full {v}",
    same: "= GPT-4 below {v}",
    describe: "At V = {v}, English takes {en} tokens per 1,000 bytes and Chinese {zh} across the tables that reach V. P_token = {p} parameters, {s} of {m}.",
    range: "{lo} to {hi}",
  },
  zh: {
    title: "词表规模、序列长度与按词元索引的参数",
    en: "英文",
    zh: "中文",
    panel: "{lang}：每 1,000 个 UTF-8 字节的词元数",
    xShort: "词表规模 V",
    share: "{m} 中按词元索引的参数占比",
    tiedLine: "绑定，V·d",
    untiedLine: "不绑定，2V·d",
    shipped: "{m} 的实际 V = {v}",
    atV: "V = {v}",
    eqTied: "P_token = V·d = {v} × {d} = {p} 个参数，按 2 字节计 {b}",
    eqUntied: "P_token = 2V·d = 2 × {v} × {d} = {p} 个参数，按 2 字节计 {b}",
    shareLine: "占 {m} 的 {s}，其余 {r} 个参数保持不变",
    logits: "输出投影：每个位置 V·d = {f} 次乘加",
    colTable: "合并表",
    colHead: "V 处每 1,000 个 UTF-8 字节的词元数，括号内为相对 V/2 的变化",
    ends: "{t}，满规模 {v}",
    same: "{v} 以下同 GPT-4",
    describe: "V = {v} 时，在能达到该规模的合并表中，英文每 1,000 字节需要 {en} 个词元，中文需要 {zh} 个。P_token = {p} 个参数，占 {m} 的 {s}。",
    range: "{lo} 至 {hi}",
  },
};

type P = { V: number; model: ModelKey; tied: boolean };

const model = (k: ModelKey) => MODELS.find((m) => m.key === k)!;
const pToken = (V: number, d: number, tied: boolean) => (tied ? 1 : 2) * V * d;
function shareAt(V: number, m: (typeof MODELS)[number], tied: boolean) {
  const rest = m.total - pToken(m.rows, m.d, m.tied);
  const pt = pToken(V, m.d, tied);
  return { rest, pt, share: pt / (rest + pt) };
}

// Tokens per kB of a table at V, interpolated in log V; null past its size.
function tokensAt(f: FamKey, lang: Text, V: number): number | null {
  if (f === "llama3" && V < LLAMA3_BASE) return tokensAt("cl100k", lang, V);
  const s = SWEEP[f];
  const v = s.v, y = s[lang];
  // Past the mergeable ranks come only special tokens, which ordinary text
  // never produces: the full table's count holds up to the published size.
  if (V > FAMILIES.find((x) => x.key === f)!.size || V < v[0] - 0.5) return null;
  if (V >= v[v.length - 1]) return y[y.length - 1];
  for (let i = 0; i + 1 < v.length; i++) {
    if (V <= v[i + 1]) {
      const u = (Math.log(V) - Math.log(v[i])) / (Math.log(v[i + 1]) - Math.log(v[i]));
      return Math.exp(Math.log(y[i]) + Math.max(0, Math.min(1, u)) * (Math.log(y[i + 1]) - Math.log(y[i])));
    }
  }
  return y[y.length - 1];
}

// V as the control prints it (three significant figures), so the readout and
// the slider agree.
const shownV = (v: number) => Number(v.toPrecision(3));

const pow2 = (v: number) => `2${String(Math.round(Math.log2(v))).split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]).join("")}`;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const V = shownV(st.p.V);
  const m = model(st.p.model);
  const span = (t: Text) => {
    const vals = FAMILIES.map((f) => tokensAt(f.key, t, V)).filter((v): v is number => v !== null);
    return tpl(L.range, { lo: int(Math.min(...vals)), hi: int(Math.max(...vals)) });
  };
  const s = shareAt(V, m, st.p.tied);
  return tpl(L.describe, { v: int(V), en: span("en"), zh: span("zh"), p: count(s.pt), s: pct(s.share, 1), m: m.name });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const V = shownV(p.V);
  const m = model(p.model);
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const famColor = (i: number) => CATEGORICAL[i];
  const wrapLine = (s: string, size: number, max: number) => (lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max));

  // ---- legend of merge tables
  const lg = legend(FAMILIES.map((f, i) => ({ label: f.name, swatch: { kind: "line" as const, stroke: famColor(i) } })), 0, 12, w, fs);
  parts.push(lg.svg);
  let y = lg.height + 16;

  // ---- two token panels, side by side or stacked
  const gap = 28;
  const left = narrow ? 40 : 40;
  const panelW = narrow ? w : (w - gap) / 2;
  const plotH = narrow ? 150 : 170;
  const xTicks = [256, 1024, 4096, 16384, 65536, 262144];
  const panel = (t: Text, x0: number, y0: number) => {
    const x = log([V_MIN, V_MAX], [x0 + left, x0 + panelW - 8]);
    const yS = log([150, 1000], [y0 + 20 + plotH, y0 + 20]);
    const out: string[] = [];
    out.push(text(x0, y0 + 10, tpl(L.panel, { lang: L[t] }), { "font-size": TYPE.label, class: "fig-t-strong" }));
    out.push(axis({ scale: x, orient: "bottom", at: y0 + 20 + plotH, ticks: xTicks, format: pow2, grid: [y0 + 20, y0 + 20 + plotH], size: fs, title: L.xShort }));
    out.push(axis({ scale: yS, orient: "left", at: x0 + left, ticks: [200, 300, 500, 1000], format: (v) => int(v), grid: [x0 + left, x0 + panelW - 8], size: fs }));
    // Qwen2.5's early ranks track cl100k's closely, so its line is drawn
    // first and wider, as a casing that stays visible under cl100k's.
    const order = FAMILIES.map((f, i) => i).sort((a, b) => Number(FAMILIES[b].key === "qwen25") - Number(FAMILIES[a].key === "qwen25"));
    order.forEach((i) => {
      const f = FAMILIES[i];
      const s = SWEEP[f.key];
      const pts = s.v.map((v, k) => [x(v), yS(s[t][k])] as [number, number]);
      const casing = f.key === "qwen25";
      out.push(el("path", { d: linePath(pts), fill: "none", stroke: famColor(i), "stroke-width": casing ? 4.5 : 2, "stroke-opacity": casing ? 0.5 : undefined, "stroke-linejoin": "round" }));
      const [ex, ey] = pts[pts.length - 1];
      out.push(el("circle", { cx: ex, cy: ey, r: 3, fill: C.paper, stroke: famColor(i), "stroke-width": 1.5 }));
    });
    // Cursor at V and the value of each table there.
    const cx = x(V);
    out.push(el("line", { x1: cx, x2: cx, y1: y0 + 20, y2: y0 + 20 + plotH, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    FAMILIES.forEach((f, i) => {
      const v = tokensAt(f.key, t, V);
      if (v !== null && !(f.key === "llama3" && V < LLAMA3_BASE)) out.push(el("circle", { cx, cy: yS(v), r: 4, fill: famColor(i), stroke: C.paper, "stroke-width": 1.5 }));
    });
    return out;
  };
  const ph = 20 + plotH + axisHeight(true, fs);
  parts.push(...panel("en", 0, y));
  if (narrow) {
    y += ph + 18;
    parts.push(...panel("zh", 0, y));
  } else parts.push(...panel("zh", panelW + gap, y));
  y += ph + 22;

  // ---- parameter share of the chosen checkpoint
  const shareH = narrow ? 120 : 130;
  const sx = log([V_MIN, V_MAX], [left, w - 8]);
  const maxShare = 0.6;
  for (const [i, line] of wrapLine(tpl(L.share, { m: m.name }), TYPE.label, w).entries()) {
    if (i) y += 17;
    parts.push(text(0, y + 10, line, { "font-size": TYPE.label, class: "fig-t-strong" }));
  }
  // Key: the chosen tying solid, the other dashed, the shipped size a diamond.
  const shipLabel = tpl(L.shipped, { m: m.name, v: int(m.rows) });
  const keys: Array<[string, string]> = [["solid", p.tied ? L.tiedLine : L.untiedLine], ["dash", p.tied ? L.untiedLine : L.tiedLine], ["ship", shipLabel]];
  const kw = keys.map(([, l]) => 26 + textWidth(l, fs));
  let kx = 0, ky = y + 30;
  for (const [i, [kind, l]] of keys.entries()) {
    if (kx > 0 && kx + kw[i] > w) { kx = 0; ky += 18; }
    if (kind === "ship") parts.push(el("path", { d: `M${kx + 9},${ky - 11}L${kx + 15},${ky - 4}L${kx + 9},${ky + 3}L${kx + 3},${ky - 4}Z`, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
    else parts.push(el("line", { x1: kx, x2: kx + 18, y1: ky - 4, y2: ky - 4, stroke: kind === "solid" ? C.ink : C.ink3, "stroke-width": kind === "solid" ? 2 : 1.5, "stroke-dasharray": kind === "solid" ? undefined : "4 3" }));
    parts.push(text(kx + 24, ky, l, { "font-size": fs, class: "fig-t-muted" }));
    kx += kw[i] + 16;
  }
  y = ky - 6;
  const sy = linear([0, maxShare], [y + 20 + shareH, y + 20]);
  parts.push(axis({ scale: sx, orient: "bottom", at: y + 20 + shareH, ticks: xTicks, format: pow2, grid: [y + 20, y + 20 + shareH], size: fs, title: L.xShort }));
  parts.push(axis({ scale: sy, orient: "left", at: left, ticks: [0, 0.2, 0.4, 0.6], format: (v) => pct(v), grid: [left, w - 8], size: fs }));
  const curve = (tied: boolean) => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 60; k++) {
      const v = V_MIN * (V_MAX / V_MIN) ** (k / 60);
      const sh = shareAt(v, m, tied).share;
      if (sh > maxShare) {
        // Stop the line where it leaves the plot.
        let lo = V_MIN * (V_MAX / V_MIN) ** ((k - 1) / 60), hi = v;
        for (let it = 0; it < 30; it++) { const mid = Math.sqrt(lo * hi); if (shareAt(mid, m, tied).share > maxShare) hi = mid; else lo = mid; }
        pts.push([sx(lo), sy(maxShare)]);
        break;
      }
      pts.push([sx(v), sy(sh)]);
    }
    return linePath(pts);
  };
  parts.push(el("path", { d: curve(!p.tied), fill: "none", stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  parts.push(el("path", { d: curve(p.tied), fill: "none", stroke: C.ink, "stroke-width": 2 }));
  // The checkpoint's shipped vocabulary.
  const shipped = shareAt(m.rows, m, m.tied);
  const shx = sx(m.rows), shy = sy(Math.min(maxShare, shipped.share));
  parts.push(el("path", { d: `M${shx},${shy - 7}L${shx + 6},${shy}L${shx},${shy + 7}L${shx - 6},${shy}Z`, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }));
  // Cursor.
  const cur = shareAt(V, m, p.tied);
  const ccx = sx(V);
  parts.push(el("line", { x1: ccx, x2: ccx, y1: y + 20, y2: y + 20 + shareH, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  if (cur.share <= maxShare) parts.push(el("circle", { cx: ccx, cy: sy(cur.share), r: 5, fill: C.ink, stroke: C.paper, "stroke-width": 1.5 }));
  y += 20 + shareH + axisHeight(true, fs) + 20;

  // ---- readout: the equation's terms, then the tables at V
  const R: string[] = [];
  R.push(text(0, y, tpl(L.atV, { v: int(V) }), { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  y += 20;
  const eq = tpl(p.tied ? L.eqTied : L.eqUntied, { v: int(V), d: int(m.d), p: count(cur.pt), b: si(cur.pt * 2, "B") });
  const lines = [
    [eq, "fig-t-num"],
    [tpl(L.shareLine, { s: pct(cur.share, 1), m: m.name, r: count(cur.rest) }), ""],
    [tpl(L.logits, { f: count(V * m.d) }), "fig-t-muted"],
  ];
  for (const [s, cls] of lines) {
    for (const part of wrapLine(s, TYPE.body, w)) {
      R.push(text(0, y, part, { "font-size": TYPE.body, class: cls || undefined }));
      y += 17;
    }
  }
  y += 10;
  // Table: merge table, English, Chinese, each with the change from V/2.
  const c1 = narrow ? 0.42 * w : 0.36 * w, c2 = narrow ? 0.71 * w : 0.62 * w;
  for (const line of wrapLine(L.colHead, fs, w)) {
    R.push(text(0, y, line, { "font-size": fs, class: "fig-t-muted" }));
    y += 17;
  }
  y += 1;
  R.push(text(0, y, L.colTable, { "font-size": fs, class: "fig-t-muted" }));
  R.push(text(c1, y, L.en, { "font-size": fs, class: "fig-t-muted" }));
  R.push(text(c2, y, L.zh, { "font-size": fs, class: "fig-t-muted" }));
  y += 6;
  FAMILIES.forEach((f, i) => {
    y += 19;
    R.push(el("line", { x1: 0, x2: 14, y1: y - 4, y2: y - 4, stroke: famColor(i), "stroke-width": 2.5, "stroke-linecap": "round" }));
    R.push(text(20, y, f.name, { "font-size": TYPE.body }));
    if (f.key === "llama3" && V < LLAMA3_BASE) {
      R.push(text(c1, y, tpl(L.same, { v: int(LLAMA3_BASE) }), { "font-size": TYPE.body, class: "fig-t-faint" }));
      return;
    }
    const cell = (t: Text, x0: number) => {
      const v = tokensAt(f.key, t, V);
      if (v === null) return text(x0, y, tpl(L.ends, { t: int(SWEEP[f.key][t][SWEEP[f.key][t].length - 1]), v: int(f.size) }), { "font-size": TYPE.body, class: "fig-t-faint fig-t-num" });
      const half = V / 2 >= V_MIN ? tokensAt(f.key, t, V / 2) : null;
      const ch = half ? `${v / half - 1 < 0 ? "−" : "+"}${Math.abs((v / half - 1) * 100).toFixed(0)}%` : "";
      return text(x0, y, `${int(v)}${ch ? ` (${ch})` : ""}`, { "font-size": TYPE.body, class: "fig-t-num" });
    };
    R.push(cell("en", c1), cell("zh", c2));
  });
  y += 8;
  parts.push(g({ class: "fig-readout" }, ...R));
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "vocabulary-tradeoff",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    V: {
      kind: "range", scale: "log", label: { en: "Vocabulary size V", zh: "词表规模 V" }, min: V_MIN, max: V_MAX, default: 32000,
    },
    model: {
      kind: "choice", control: "select", label: { en: "Checkpoint", zh: "检查点" }, default: "qwen25_05b",
      options: MODELS.map((mm) => ({
        value: mm.key,
        label: {
          en: `${mm.name}: d = ${int(mm.d)}, ${mm.tied ? "tied" : "untied"}, V = ${int(mm.rows)}`,
          zh: `${mm.name}：d = ${int(mm.d)}，${mm.tied ? "绑定" : "不绑定"}，V = ${int(mm.rows)}`,
        },
      })),
    },
    tied: { kind: "toggle", label: { en: "Tie input and output weights", zh: "绑定输入与输出权重" }, default: true },
  },
  // Choosing a checkpoint restores its own tying.
  update(p, key) {
    if (key === "model") return { ...p, tied: model(p.model as ModelKey).tied };
    return p;
  },
  render,
  describe,
});
