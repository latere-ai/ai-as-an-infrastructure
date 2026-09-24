// A sink-plus-window KV policy over one passage, measured on a real model.
//
// The cache keeps the first s tokens (the sinks) and the most recent w tokens
// and evicts everything between them, so after warm-up it holds K = s + w
// entries and resident memory is bounded by K·κ, against T·κ for full
// attention (the chapter's M_window and M_full). The timeline is the query
// position t in a 430-token passage: at step t the model has read tokens 0 to
// t and predicts token t + 1, and key j is resident when j < s or t − j < w.
//
// Every loss, probability, and attention share comes from
// tools/figure-data/sink-window-eviction.py (data/sink-window.ts): one float32
// forward pass of Qwen2.5-0.5B per policy, with the policy applied as an
// attention mask at every layer and retained keys at their original
// positions. The passage mentions a four-digit code near the start and asks
// for it again at the end; the recall is scored teacher-forced.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { fixed, pct, tpl } from "./lib/format.ts";
import { sci } from "./lib/notation.ts";
import { BLOCK, CODE, CODE_AT, KAPPA, RECALL, RUNS, TOKENS, type Measured } from "./data/sink-window.ts";

const N = TOKENS.length; // tokens in the passage
const LAST = N - 2; // last query position (it predicts the last token)
const CODE_END = CODE_AT + CODE.length - 1;

const labels = {
  en: {
    title: "Attention sinks and a recent window over one passage",
    cache: "KV cache at step {t}",
    resident: "{k} of {n} tokens resident: {m}",
    residentFull: "{n} tokens resident: {m}",
    sink: "sinks",
    window: "recent window",
    inCache: "in the cache",
    evicted: "evicted",
    unread: "not yet read",
    query: "query",
    code: "code {c}",
    recallMark: "recall",
    pos: "position in the passage (tokens)",
    loss: "loss per token (nats), mean of {b} positions",
    full: "full attention",
    windowOnly: "window only",
    sinksWindow: "{s:sink/sinks} + window",
    atStep: "Loss at step {t}: {items}",
    firstEv: "first eviction, step {t}",
    lossItem: "{name} {v}",
    recallTitle: "The recall at step {t}: attention of the query, and p(“{c}”)",
    attFirst: "first 4 tokens",
    attCode: "the code",
    attMiddle: "other tokens",
    attWindow: "last {w} tokens",
    pAns: "p = {p}",
    chance: "four digits by chance: 10⁻⁴",
    evictedAt: "the code left the cache at step {t}",
    kept: "the code is still in the cache",
    describe: "Step {t} of {d}, {policy}: {k} of {n} tokens are resident ({m}). {codeState}. At the recall, p(“{c}”) is {pf} with full attention and {pp} with this policy, which puts {a} of the recall query's attention on the first 4 tokens.",
    describeFull: "Step {t} of {d}, full attention: all {n} tokens read so far are resident ({m}). At the recall, p(“{c}”) is {pf} and the recall query puts {a} of its attention on the first token.",
    kfCode: "The code {c} is read into the cache",
    kfFill: "The cache holds {k} tokens and starts evicting",
    kfLeave: "The code leaves the window and is evicted",
    kfRecall: "The recall: the model must reproduce {c}",
    policyFull: "full attention",
    policyWindow: "{w}-token window only",
    policySinks: "{s:sink/sinks} and a {w}-token window",
    ellipsis: "…",
  },
  zh: {
    title: "一段文本上的注意力汇与近期窗口",
    cache: "第 {t} 步的 KV 缓存",
    resident: "常驻 {k} / {n} 个词元：{m}",
    residentFull: "常驻 {n} 个词元：{m}",
    sink: "注意力汇",
    window: "近期窗口",
    inCache: "在缓存中",
    evicted: "已驱逐",
    unread: "尚未读入",
    query: "查询",
    code: "密码 {c}",
    recallMark: "回忆",
    pos: "段落中的位置（词元）",
    loss: "每词元损失（nats），每 {b} 个位置取均值",
    full: "完整注意力",
    windowOnly: "仅窗口",
    sinksWindow: "{s} 个注意力汇 + 窗口",
    atStep: "第 {t} 步的损失：{items}",
    firstEv: "首次驱逐，第 {t} 步",
    lossItem: "{name} {v}",
    recallTitle: "第 {t} 步回忆密码：查询的注意力分布与 p(“{c}”)",
    attFirst: "前 4 个词元",
    attCode: "密码",
    attMiddle: "其余词元",
    attWindow: "最近 {w} 个词元",
    pAns: "p = {p}",
    chance: "随机猜中四位数字：10⁻⁴",
    evictedAt: "密码在第 {t} 步被驱逐",
    kept: "密码仍在缓存中",
    describe: "第 {t} 步（共 {d} 步），{policy}：常驻 {k} / {n} 个词元（{m}）。{codeState}。回忆时，完整注意力下 p(“{c}”) 为 {pf}，此策略下为 {pp}；回忆查询把 {a} 的注意力放在前 4 个词元上。",
    describeFull: "第 {t} 步（共 {d} 步），完整注意力：已读入的 {n} 个词元全部常驻（{m}）。回忆时 p(“{c}”) 为 {pf}，回忆查询把 {a} 的注意力放在第一个词元上。",
    kfCode: "密码 {c} 读入缓存",
    kfFill: "缓存达到 {k} 个词元，开始驱逐",
    kfLeave: "密码移出窗口，被驱逐",
    kfRecall: "回忆：模型需要写出 {c}",
    policyFull: "完整注意力",
    policyWindow: "仅保留 {w} 个词元的窗口",
    policySinks: "{s} 个注意力汇加 {w} 个词元的窗口",
    ellipsis: "…",
  },
};
type Labels = typeof labels.en;

type P = { sinks: number; window: number };

const key = (s: number, w: number) => (w === 0 ? "full" : `s${s}w${w}`);
const run = (s: number, w: number): Measured => RUNS[key(s, w)];

// Resident keys of query t under (s, w); w = 0 is full attention.
function resident(t: number, s: number, w: number): number {
  if (w === 0) return t + 1;
  return Math.min(t + 1, s + w);
}

// First step at which the policy evicts, and the step at which the last code
// token leaves the window (key j is evicted at query t = j + w when j >= s).
const firstEviction = (s: number, w: number) => s + w;
const codeLeaves = (w: number) => CODE_END + w;

// Binary units, since κ is exactly 12 KiB.
function bytesLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${fixed(bytes / 1024 / 1024, 2)} MiB`;
  return `${fixed(bytes / 1024, 0)} KiB`;
}

function prob(p: number): string {
  if (p >= 0.01) return fixed(p, 2);
  return sci(p, 2);
}
const pAnswer = (m: Measured) => m.digits.reduce((a, b) => a * b, 1);

function policyName(p: P, L: Labels): string {
  if (p.window === 0) return L.policyFull;
  return p.sinks === 0 ? tpl(L.policyWindow, { w: p.window }) : tpl(L.policySinks, { s: p.sinks, w: p.window });
}

// Block-mean loss at query t.
const lossAt = (m: Measured, t: number) => m.nll[Math.min(m.nll.length - 1, Math.floor(t / BLOCK))];

// Text of the passage up to token t, cut from the left to fit maxW.
function tail(t: number, maxW: number, size: number, ell: string): string {
  let s = "";
  for (let j = t; j >= 0; j--) {
    const next = TOKENS[j].replace(/\s+/g, " ") + s;
    if (textWidth(ell + next, size) > maxW) return ell + s.replace(/^[\s,.;:]+/, "");
    s = next;
  }
  return s.trimStart();
}

// Attention of the recall query in four regions, for one policy.
function regions(m: Measured, w: number) {
  const first = m.attn.first + m.attn.next3;
  const code = m.attn.code;
  const win = w === 0 ? 0 : (m.attn as unknown as Record<string, number>)[`tail${w}`];
  return { first, code, win, middle: Math.max(0, 1 - first - code - win) };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const t = Math.round(st.t);
  const full = run(0, 0);
  const k = resident(t, p.sinks, p.window);
  if (p.window === 0) {
    return tpl(L.describeFull, { t, d: LAST, n: k, m: bytesLabel(k * KAPPA), c: CODE, pf: prob(pAnswer(full)), a: pct(full.attn.first) });
  }
  const m = run(p.sinks, p.window);
  const leave = codeLeaves(p.window);
  const codeState = t >= leave ? tpl(L.evictedAt, { t: leave }) : L.kept;
  return tpl(L.describe, {
    t, d: LAST, policy: policyName(p, L), k, n: t + 1, m: bytesLabel(k * KAPPA), codeState: codeState.replace(/^./, (c) => c.toUpperCase()),
    c: CODE, pf: prob(pAnswer(full)), pp: prob(pAnswer(m)), a: pct(m.attn.first + m.attn.next3),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = Math.round(st.t);
  const fs = TYPE.body;
  const s = p.window === 0 ? 0 : p.sinks;
  const win = p.window;
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-ev`, C.ink3, 4, 1))];
  const gut = 22; // left gutter for the loss values; the strip shares the x scale
  const x = linear([0, N], [gut, w - 2]);
  let y = 0;

  // ---- title and resident memory
  const k = resident(t, s, win);
  const title = tpl(L.cache, { t });
  const res = win === 0 ? tpl(L.residentFull, { n: k, m: bytesLabel(k * KAPPA) }) : tpl(L.resident, { k, n: t + 1, m: bytesLabel(k * KAPPA) });
  parts.push(text(0, y + 14, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
  if (narrow || textWidth(title, TYPE.label) + textWidth(res, fs) + 24 > w) {
    y += 20;
    parts.push(text(0, y + 13, res, { "font-size": fs, class: "fig-t-num" }));
  } else {
    parts.push(text(w, y + 14, res, { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
  }
  y += 24;
  const lg = legend(win === 0 ? [
    { label: L.inCache, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.unread, swatch: { kind: "rect", fill: C.panel } },
  ] : [
    ...(s > 0 ? [{ label: L.sink, swatch: { kind: "rect" as const, fill: C.c2 } }] : []),
    { label: L.window, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.evicted, swatch: { kind: "rect", fill: C.panel, pattern: `${st.uid}-ev` } },
    { label: L.unread, swatch: { kind: "rect", fill: C.panel } },
  ], 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height + 22;

  // ---- the cache strip over the passage, with the code and the recall marked
  const stripY = y, stripH = 22;
  const seg = (a: number, b: number, fill: string, extra: Record<string, string | number> = {}) =>
    el("rect", { x: x(a), y: stripY, width: Math.max(0, x(b + 1) - x(a)), height: stripH, fill, ...extra });
  parts.push(el("rect", { x: gut, y: stripY, width: w - 2 - gut, height: stripH, fill: C.panel }));
  if (t + 1 < N) parts.push(seg(t + 1, N - 1, C.panel));
  if (win === 0) {
    parts.push(seg(0, t, C.c1));
  } else {
    const sinkEnd = Math.min(s, t + 1) - 1; // last resident sink
    const winStart = Math.max(s, t - win + 1); // first key in the window
    if (winStart > s) parts.push(seg(s, winStart - 1, `url(#${st.uid}-ev)`));
    parts.push(seg(winStart, t, C.c1));
    // A sink can be narrower than a pixel; draw it at least 3 px wide.
    if (sinkEnd >= 0) parts.push(el("rect", { x: gut, y: stripY, width: Math.max(3, x(sinkEnd + 1) - gut), height: stripH, fill: C.c2 }));
  }
  // Code bracket above the strip, recall bracket, and the query cursor.
  const bracket = (a: number, b: number, label: string, cls: string) => {
    const x0 = x(a) - 1, x1 = Math.max(x(b + 1) + 1, x0 + 4);
    const by = stripY - 6;
    const lw = textWidth(label, fs);
    const lx = Math.min(Math.max((x0 + x1) / 2, lw / 2), w - lw / 2);
    return el("path", { d: `M${x0},${by + 4}V${by}H${x1}V${by + 4}`, fill: "none", stroke: C.ink, "stroke-width": 1.2 })
      + text(lx, by - 4, label, { "font-size": fs, "text-anchor": "middle", class: cls });
  };
  parts.push(bracket(CODE_AT, CODE_END, tpl(L.code, { c: CODE }), "fig-t-strong fig-t-num"));
  parts.push(bracket(RECALL + 1, N - 1, L.recallMark, "fig-t-muted"));
  const cx = x(t + 0.5);
  parts.push(el("path", { d: `M${cx},${stripY + stripH + 1}l-5,8h10z`, fill: C.ink }));
  parts.push(el("line", { x1: cx, x2: cx, y1: stripY - 2, y2: stripY + stripH, stroke: C.ink, "stroke-width": 1.5 }));
  y = stripY + stripH + 10;
  parts.push(axis({ scale: x, orient: "bottom", at: y, ticks: x.ticks(narrow ? 4 : 8).filter((v) => v < N), format: (v) => String(v), title: L.pos, size: fs }));
  y += axisHeight(true, fs) + 8;

  // Passage text up to the query.
  const ctx = tail(t, w, fs, L.ellipsis);
  parts.push(text(0, y + 12, ctx, { "font-size": fs, class: "fig-t-muted", "font-style": "italic" }));
  y += 28;

  // ---- loss per token over the passage
  const full = run(0, 0);
  const curves: Array<{ name: string; m: Measured; color: string; dash?: string; on: boolean }> = [
    { name: L.full, m: full, color: C.ink2, dash: win === 0 ? undefined : "4 3", on: win === 0 },
  ];
  if (win > 0) {
    const sOther = s > 0 ? s : 4;
    curves.push({ name: L.windowOnly, m: run(0, win), color: C.c1, on: s === 0 });
    curves.push({ name: tpl(L.sinksWindow, { s: sOther }), m: run(sOther, win), color: C.c2, on: s > 0 });
  }
  const lossTitle = tpl(L.loss, { b: BLOCK });
  const lossLines = wrap(lossTitle, fs, w);
  lossLines.forEach((ln, i) => parts.push(text(0, y + 12 + i * 16, ln, { "font-size": fs, class: "fig-t-muted" })));
  y += lossLines.length * 16 + 6;
  const plotTop = y, plotH = narrow ? 130 : 150;
  const ymax = win === 0 ? 8 : 16;
  const yy = linear([0, ymax], [plotTop + plotH, plotTop]);
  // The plot spans the full width so its x axis lines up with the strip; the
  // loss gridlines carry their values inside the plot, on the left.
  const gridVals = yy.ticks(4).filter((v) => v > 0);
  for (const v of gridVals) parts.push(el("line", { x1: gut, x2: w - 2, y1: yy(v), y2: yy(v), stroke: C.grid, "stroke-width": 1 }));
  for (const c of curves) {
    const pts: Array<[number, number]> = c.m.nll.map((v, b) => {
      const mid = Math.min(b * BLOCK + BLOCK / 2, N - 1.5);
      return [x(mid), yy(Math.min(v, ymax))];
    });
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: c.color, "stroke-width": c.on ? 2.4 : 1.3, "stroke-dasharray": c.dash, "stroke-linejoin": "round" }));
  }
  // Warm-up shading: before the first eviction every policy equals full attention.
  if (win > 0) {
    const fe = firstEviction(s, win);
    parts.push(el("line", { x1: x(fe), x2: x(fe), y1: plotTop, y2: plotTop + plotH, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  }
  parts.push(el("line", { x1: cx, x2: cx, y1: plotTop - 4, y2: plotTop + plotH, stroke: C.ink, "stroke-width": 1.2 }));
  parts.push(el("line", { x1: gut, x2: w - 2, y1: plotTop + plotH, y2: plotTop + plotH, stroke: C.rule, "stroke-width": 1 }));
  for (const v of [0, ...gridVals]) parts.push(text(gut - 5, yy(v) + 4, String(v), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" }));
  y = plotTop + plotH + 10;
  const items2 = curves.map((c) => ({ label: c.name, swatch: { kind: "line" as const, stroke: c.color, dash: c.dash } }));
  if (win > 0) items2.push({ label: tpl(L.firstEv, { t: firstEviction(s, win) }), swatch: { kind: "line" as const, stroke: C.ink3, dash: "2 3" } });
  const lg2 = legend(items2, 0, y, w, fs);
  parts.push(lg2.svg);
  y += lg2.height + 4;
  const items = curves.map((c) => tpl(L.lossItem, { name: c.name, v: fixed(lossAt(c.m, t), 1) })).join(lang === "zh" ? "，" : ", ");
  for (const ln of wrap(tpl(L.atStep, { t, items }), fs, w)) {
    parts.push(text(0, y + 12, ln, { "font-size": fs, class: "fig-t-num" }));
    y += 17;
  }
  y += 14;

  // ---- the recall: where the query attends, and the probability of the code
  const rt = wrap(tpl(L.recallTitle, { t: RECALL, c: CODE }), TYPE.label, w);
  rt.forEach((ln, i) => parts.push(text(0, y + 14 + i * 18, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  y += rt.length * 18 + 10;
  const rows = curves.map((c) => ({ c, r: regions(c.m, win) }));
  const nameW = narrow ? 0 : Math.max(...rows.map((r) => textWidth(r.c.name, fs))) + 12;
  const pW = narrow ? 0 : Math.max(...rows.map((r) => textWidth(tpl(L.pAns, { p: prob(pAnswer(r.c.m)) }), fs))) + 12;
  const barX = nameW, barW = w - nameW - pW;
  const cols = [
    { k: "first" as const, fill: C.c2, name: L.attFirst },
    { k: "code" as const, fill: C.c3, name: L.attCode },
    { k: "middle" as const, fill: C.ink3, name: L.attMiddle },
    { k: "win" as const, fill: C.c1, name: tpl(L.attWindow, { w: win }) },
  ].filter((c) => win > 0 || c.k !== "win");
  for (const { c, r } of rows) {
    if (narrow) {
      parts.push(text(0, y + 12, c.name, { "font-size": fs, class: c.on ? "fig-t-strong" : undefined }));
      parts.push(text(w, y + 12, tpl(L.pAns, { p: prob(pAnswer(c.m)) }), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" + (c.on ? " fig-t-strong" : "") }));
      y += 17;
    } else {
      parts.push(text(0, y + 14, c.name, { "font-size": fs, class: c.on ? "fig-t-strong" : undefined }));
      parts.push(text(w, y + 14, tpl(L.pAns, { p: prob(pAnswer(c.m)) }), { "font-size": fs, "text-anchor": "end", class: "fig-t-num" + (c.on ? " fig-t-strong" : "") }));
    }
    let bx = barX;
    const bh = 18;
    for (const col of cols) {
      const v = r[col.k];
      const bw = v * barW;
      if (bw < 0.5) continue;
      parts.push(el("rect", { x: bx, y, width: bw, height: bh, fill: col.fill, "fill-opacity": col.k === "middle" ? 0.45 : 1 }));
      const lbl = pct(v);
      if (bw > textWidth(lbl, fs) + 8) parts.push(text(bx + bw / 2, y + 13, lbl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
      bx += bw;
    }
    if (c.on) parts.push(el("rect", { x: barX - 1, y: y - 1, width: barW + 2, height: bh + 2, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
    y += bh + (narrow ? 12 : 10);
  }
  const lg3 = legend(cols.map((c) => ({ label: c.name, swatch: { kind: "rect" as const, fill: c.fill, opacity: c.k === "middle" ? 0.45 : 1 } })), barX, y, w - barX, fs);
  parts.push(lg3.svg);
  y += lg3.height + 2;
  parts.push(text(barX, y + 12, L.chance, { "font-size": fs, class: "fig-t-muted" }));
  y += 18;

  return svg(w, y + 4, describe(st, lang), g({ class: "fig-sink-window" }, ...parts));
}

export default defineFigure({
  name: "sink-window-eviction",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    sinks: {
      kind: "choice", label: { en: "Sinks kept s", zh: "保留的注意力汇 s" }, default: 4,
      options: [
        { value: 0, label: { en: "none", zh: "不保留" } },
        { value: 1, label: { en: "1 token", zh: "1 个词元" } },
        { value: 4, label: { en: "4 tokens", zh: "4 个词元" } },
      ],
    },
    window: {
      kind: "choice", label: { en: "Recent window w", zh: "近期窗口 w" }, default: 64,
      options: [
        { value: 32, label: { en: "32", zh: "32" } },
        { value: 64, label: { en: "64", zh: "64" } },
        { value: 128, label: { en: "128", zh: "128" } },
        { value: 256, label: { en: "256", zh: "256" } },
        { value: 0, label: { en: "no eviction", zh: "不驱逐" } },
      ],
      control: "buttons",
    },
  },
  timeline: {
    rate: 24,
    discrete: true,
    duration: () => LAST,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const out = [{ t: CODE_END, label: tpl(L.kfCode, { t: CODE_END, c: CODE }) }];
      if (p.window > 0) {
        const s = p.sinks;
        out.push({ t: firstEviction(s, p.window), label: tpl(L.kfFill, { t: firstEviction(s, p.window), k: s + p.window }) });
        out.push({ t: codeLeaves(p.window), label: tpl(L.kfLeave, { t: codeLeaves(p.window) }) });
      }
      out.push({ t: RECALL, label: tpl(L.kfRecall, { t: RECALL, c: CODE }) });
      return out.sort((a, b) => a.t - b.t);
    },
    poster: () => RECALL,
  },
  render,
  describe,
});
