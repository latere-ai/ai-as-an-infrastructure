// Loss masking over one templated conversation. A tool-using exchange (system,
// user, assistant tool call, tool result, assistant answer) is serialized with
// the chat template and tokenizer of Qwen/Qwen2.5-0.5B (revision 060db64), and
// every token carries its real per-token loss under that base model before
// any fine-tuning, from one float32 forward pass:
//
//   l_t = −log p_θ(u_t | u_<t)        (nats; the first token has no prefix)
//
// tools/figure-data/sft-mask-losses.py regenerates CONVERSATIONS. The figure
// applies the chapter's assistant-only objective with the mask the reader picks,
//
//   L_SFT = −(1/M) Σ_t m_t log p_θ(u_t | u_<t),   M = Σ_t m_t,
//
// and draws which tokens are targets, the sum Σ m_t l_t token by token, and
// the resulting average. Truncation keeps at most `keep` tokens: cut from the
// end, the kept prefix and its losses are unchanged (the model is causal); cut
// from the start, every kept token loses context, so the script scored each
// kept suffix again and those losses are used here.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { legend } from "./lib/legend.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

type Role = "system" | "user" | "call" | "tool" | "assistant";
type Part = "header" | "content" | "eot" | "sep";
type Tok = [text: string, turn: number, role: Role, part: Part, loss: number | null];
interface Conversation { tokens: Tok[]; left: Record<number, Array<number | null>> }

type Policy = "all" | "assistant" | "final" | "split";
type Cut = "end" | "start";
type P = { policy: Policy; eot: boolean; keep: number; cut: Cut };

// Turn identity, in the categorical order: the two assistant turns first, since
// they are the default targets.
const ROLE_COLOR: Record<Role, string> = { assistant: C.c1, call: C.c2, user: C.c3, tool: C.c4, system: C.c5 };
const ASSISTANT: ReadonlySet<Role> = new Set(["assistant", "call"]);
const KEEP_MAX = 104;

const labels = {
  en: {
    title: "Loss masking over a templated conversation",
    system: "system", user: "user", call: "assistant (tool call)", tool: "tool result (user role)", assistant: "assistant (answer)",
    target: "target, m_t = 1, in its turn color",
    context: "context, m_t = 0",
    cut: "cut by truncation",
    sumTitle: "Σ m_t ℓ_t, one segment per target token",
    sumSplit: "{name}: Σ m_t ℓ_t",
    maskText: "answer mask",
    maskCall: "tool-call mask",
    eq: "L_SFT = Σ m_t ℓ_t / M = {s} / {m} = {l} nats",
    eqSplit: "{name}: Σ m_t ℓ_t / M = {s} / {m} = {l} nats",
    eqNone: "M = 0: no position is a target, so the loss is undefined",
    count: "M = {m} of T = {t} kept tokens are targets",
    share: "share of M by turn: {list}",
    top: "largest terms: {list}",
    cutEnd: "cut from the end: {k} tokens dropped, {lost} of {m0} targets lost",
    stopLost: "; the final end-of-turn token is gone, so this record never teaches stopping",
    cutStart: "cut from the start: {k} tokens dropped, {lost} of {m0} targets lost; the kept targets average {a} nats here and {b} with the full context",
    firstNote: "ℓ_t = −log p_θ(u_t | u_<t) under Qwen2.5-0.5B base before any update; the first kept token has no prefix and is never a target",
    describe: "{policy}, {eot}: {m} of {t} tokens are targets and L_SFT = {l} nats. Largest terms: {top}.",
    describeSplit: "Tool calls under a separate mask, {eot}: the answer mask has {m} targets averaging {l} nats, the tool-call mask {m2} targets averaging {l2} nats.",
    pAll: "Whole sequence", pAssistant: "Assistant turns", pFinal: "Final turn only", pSplit: "Tool calls under a separate mask",
    eotOn: "end-of-turn token scored", eotOff: "end-of-turn token not scored",
    sep: ", ",
  },
  zh: {
    title: "对话模板上的损失掩码",
    system: "系统", user: "用户", call: "助手：工具调用", tool: "工具结果（用户角色）", assistant: "助手：回答",
    target: "目标，m_t = 1，颜色表示轮次",
    context: "上下文，m_t = 0",
    cut: "被截断",
    sumTitle: "Σ m_t ℓ_t，每个目标词元一段",
    sumSplit: "{name}：Σ m_t ℓ_t",
    maskText: "回答掩码",
    maskCall: "工具调用掩码",
    eq: "L_SFT = Σ m_t ℓ_t / M = {s} / {m} = {l} nats",
    eqSplit: "{name}：Σ m_t ℓ_t / M = {s} / {m} = {l} nats",
    eqNone: "M = 0：没有任何位置是目标，损失无定义",
    count: "保留的 T = {t} 个词元中，M = {m} 个是目标",
    share: "各轮占 M 的比例：{list}",
    top: "最大的几项：{list}",
    cutEnd: "截掉末尾：丢弃 {k} 个词元，{m0} 个目标中丢失 {lost} 个",
    stopLost: "；最后的轮次结束词元被截掉，这条样本不再教模型停下",
    cutStart: "截掉开头：丢弃 {k} 个词元，{m0} 个目标中丢失 {lost} 个；保留下来的目标平均损失为 {a} nats，完整上下文下为 {b} nats",
    firstNote: "ℓ_t = −log p_θ(u_t | u_<t) 取自尚未更新的 Qwen2.5-0.5B 基座模型；保留部分的第一个词元没有前缀，永远不是目标",
    describe: "{policy}，{eot}：{t} 个词元中有 {m} 个是目标，L_SFT = {l} nats。最大的几项：{top}。",
    describeSplit: "工具调用另设掩码，{eot}：回答掩码有 {m} 个目标，平均 {l} nats；工具调用掩码有 {m2} 个目标，平均 {l2} nats。",
    pAll: "整条序列", pAssistant: "所有助手轮次", pFinal: "只有最后一轮", pSplit: "工具调用另设掩码",
    eotOn: "对轮次结束词元计分", eotOff: "不对轮次结束词元计分",
    sep: "，",
  },
};

type L = typeof labels.en;

// ---------------------------------------------------------------- the objective

interface Cell {
  i: number;
  tok: Tok;
  kept: boolean;
  loss: number | null; // under the kept context
  mask: 0 | 1 | 2; // 0 context, 1 target (answer mask or the only mask), 2 target under the tool-call mask
}

function isTarget(t: Tok, p: P, lastTurn: number): 0 | 1 | 2 {
  const [, turn, role, part] = t;
  const asst = ASSISTANT.has(role);
  if (asst && part === "eot" && !p.eot) return 0;
  if (p.policy === "all") return 1;
  if (!asst || (part !== "content" && part !== "eot")) return 0;
  if (p.policy === "final") return turn === lastTurn ? 1 : 0;
  if (p.policy === "split") return role === "call" ? 2 : 1;
  return 1;
}

function model(p: P, lang: Lang) {
  const conv = CONVERSATIONS[lang];
  const T0 = conv.tokens.length;
  const keep = Math.min(p.keep, T0);
  const truncated = keep < T0;
  const lo = truncated && p.cut === "start" ? T0 - keep : 0;
  const hi = truncated && p.cut === "end" ? keep : T0;
  const leftLoss = truncated && p.cut === "start" ? conv.left[keep] : null;
  const lastTurn = conv.tokens[T0 - 1][1];
  const cells: Cell[] = conv.tokens.map((tok, i) => {
    const kept = i >= lo && i < hi;
    const loss = !kept ? null : leftLoss ? leftLoss[i - lo] : tok[4];
    const want = isTarget(tok, p, lastTurn);
    return { i, tok, kept, loss, mask: kept && loss != null ? want : 0 };
  });
  // Targets the same policy selects on the untruncated record.
  const full = conv.tokens.map((tok, i) => (i > 0 ? isTarget(tok, p, lastTurn) : 0));
  const m0 = full.filter((m) => m > 0).length;
  const sums = (k: 1 | 2) => {
    const on = cells.filter((c) => c.mask === k);
    const s = on.reduce((a, c) => a + (c.loss as number), 0);
    return { cells: on, m: on.length, s, l: on.length ? s / on.length : NaN };
  };
  const all = cells.filter((c) => c.mask > 0);
  const lost = m0 - all.length;
  // The same kept targets scored with the full context, to show what a cut
  // from the start costs them.
  const fullAvg = all.length ? all.reduce((a, c) => a + (c.tok[4] as number), 0) / all.length : NaN;
  const finalEot = conv.tokens.findIndex((t) => t[1] === lastTurn && t[3] === "eot");
  const stopLost = p.eot && p.policy !== "all" && truncated && p.cut === "end" && finalEot >= hi;
  // Fixed scale for the loss bars: the largest sum any setting can reach.
  const scale = Math.max(
    conv.tokens.reduce((a, t) => a + (t[4] ?? 0), 0),
    ...Object.values(conv.left).map((ls) => ls.reduce((a: number, v) => a + (v ?? 0), 0)),
  );
  return { conv, T0, keep: hi - lo, dropped: T0 - (hi - lo), truncated, cells, a: sums(1), b: sums(2), all, m0, lost, fullAvg, stopLost, scale };
}

const shown = (s: string) => s.replace(/\n/g, "↵");

function topTerms(all: Cell[], k: number, lang: Lang): string {
  return [...all].sort((x, y) => (y.loss as number) - (x.loss as number)).slice(0, k)
    .map((c) => `${lang === "zh" ? "“" : "“"}${shown(c.tok[0]).trim() || "·"}” ${fixed(c.loss as number, 1)}`)
    .join(labels[lang].sep);
}

function policyName(p: P, L: L): string {
  return { all: L.pAll, assistant: L.pAssistant, final: L.pFinal, split: L.pSplit }[p.policy];
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = model(st.p, lang);
  const eot = st.p.eot ? L.eotOn : L.eotOff;
  if (st.p.policy === "split") {
    return tpl(L.describeSplit, { eot, m: m.a.m, l: fixed(m.a.l, 2), m2: m.b.m, l2: fixed(m.b.l, 2) });
  }
  return tpl(L.describe, { policy: policyName(st.p, L), eot, m: m.a.m, t: m.keep, l: m.a.m ? fixed(m.a.l, 2) : "–", top: topTerms(m.all, 3, lang) });
}

// ---------------------------------------------------------------- drawing

const CHIP_H = 20;
const CHIP_GAP = 3;
const LINE = CHIP_H + 5;

function chip(c: Cell, x: number, y: number, w: number): string {
  const [s, , role, part] = c.tok;
  const special = /^<\|.*\|>$|^<\/?tool_call>$/.test(s);
  const label = shown(s);
  const parts: string[] = [];
  if (!c.kept) {
    parts.push(el("rect", { x: x + 0.5, y: y + 0.5, width: w - 1, height: CHIP_H - 1, rx: 3, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 2" }));
  } else if (c.mask > 0) {
    const col = ROLE_COLOR[role];
    parts.push(el("rect", { x, y, width: w, height: CHIP_H, rx: 3, fill: col, "fill-opacity": 0.24 }));
    parts.push(el("rect", { x: x + 0.5, y: y + 0.5, width: w - 1, height: CHIP_H - 1, rx: 3, fill: "none", stroke: col, "stroke-width": 1 }));
  } else {
    parts.push(el("rect", { x, y, width: w, height: CHIP_H, rx: 3, fill: C.panel }));
  }
  // A leading space is part of the token; show it as a faint dot.
  const lead = label.startsWith(" ");
  const body = lead ? label.slice(1) : label;
  const cls = !c.kept ? "fig-t-faint" : c.mask > 0 ? (special || part === "eot" ? "fig-t-strong" : "") : "fig-t-muted";
  const tx = x + 4;
  const inner = (lead ? el("tspan", { class: "fig-t-faint" }, "·") : "") + el("tspan", {}, esc(body));
  parts.push(el("text", { x: tx, y: y + 14, "font-size": TYPE.body, class: cls || undefined }, inner));
  return parts.join("");
}

const chipWidth = (s: string) => Math.max(14, textWidth(shown(s).replace(/^ /, "·"), TYPE.body) + 8);

function renderStrip(m: ReturnType<typeof model>, w: number, narrow: boolean, L: L, y0: number): { svg: string; h: number } {
  const parts: string[] = [];
  const roleW = narrow ? 0 : Math.max(...(["system", "user", "call", "tool", "assistant"] as Role[]).map((r) => textWidth(L[r], TYPE.small))) + 14;
  let y = y0;
  let turn = -1;
  let x = roleW;
  for (const c of m.cells) {
    const [s, t, role] = c.tok;
    const cw = chipWidth(s);
    if (t !== turn) {
      if (turn >= 0) y += LINE + 6;
      turn = t;
      if (narrow) {
        parts.push(el("rect", { x: 0, y: y + 1, width: 8, height: 8, rx: 2, fill: ROLE_COLOR[role] }));
        parts.push(text(13, y + 10, L[role], { "font-size": TYPE.small, class: "fig-t-muted" }));
        y += 16;
      } else {
        parts.push(el("rect", { x: 0, y: y + 6, width: 8, height: 8, rx: 2, fill: ROLE_COLOR[role] }));
        for (const [k, line] of wrap(L[role], TYPE.small, roleW - 14).entries()) {
          parts.push(text(13, y + 14 + k * 13, line, { "font-size": TYPE.small, class: "fig-t-muted" }));
        }
      }
      x = roleW;
    } else if (x + cw > w) {
      x = roleW;
      y += LINE;
    }
    parts.push(chip(c, x, y, cw));
    x += cw + CHIP_GAP;
  }
  return { svg: g({ class: "fig-strip" }, ...parts), h: y + CHIP_H - y0 };
}

// One horizontal bar of Σ m_t l_t on the fixed scale: a segment per target,
// colored by its turn, the largest few named below when they fit.
function renderSum(cells: Cell[], scale: number, w: number, y: number, title: string): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(0, y + 12, title, { "font-size": TYPE.small, class: "fig-t-muted" }));
  const by = y + 18;
  const bw = w;
  parts.push(el("rect", { x: 0, y: by, width: bw, height: 14, rx: 2, fill: C.panel }));
  let x = 0;
  const k = bw / scale;
  const names: Array<{ x: number; w: number; s: string }> = [];
  for (const c of cells) {
    const sw = (c.loss as number) * k;
    if (sw <= 0) continue;
    parts.push(el("rect", { x, y: by, width: Math.max(0.5, sw), height: 14, fill: ROLE_COLOR[c.tok[2]] }));
    if (sw > 1.5) parts.push(el("line", { x1: x + sw, x2: x + sw, y1: by, y2: by + 14, stroke: C.paper, "stroke-width": 1 }));
    names.push({ x, w: sw, s: shown(c.tok[0]).trim() || "·" });
    x += sw;
  }
  // Name segments wide enough to hold their token, left to right without overlap.
  let edge = -Infinity;
  let named = false;
  for (const n of names) {
    const tw = textWidth(n.s, TYPE.small);
    const cx = n.x + n.w / 2;
    if (n.w < 10 || cx - tw / 2 < edge + 6 || cx + tw / 2 > w || cx - tw / 2 < 0) continue;
    parts.push(el("line", { x1: cx, x2: cx, y1: by + 14, y2: by + 18, stroke: C.ink3, "stroke-width": 1 }));
    parts.push(text(cx, by + 29, n.s, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
    edge = cx + tw / 2;
    named = true;
  }
  return { svg: g({}, ...parts), h: 18 + 14 + (named ? 20 : 4) };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p, lang);
  const parts: string[] = [];
  const wrapT = (s: string, size: number, width: number) => (lang === "zh" ? wrapCjk(s, size, width) : wrap(s, size, width));

  // Legend: fill means target, gray means context, dashed means cut.
  const lg = legend([
    { label: L.target, swatch: { kind: "rect", fill: C.c1, opacity: 0.5, stroke: C.c1 } },
    { label: L.context, swatch: { kind: "rect", fill: C.panel } },
    { label: L.cut, swatch: { kind: "rect", fill: "none", stroke: C.ink3, dash: "3 2" } },
  ], 0, 0, w);
  parts.push(lg.svg);
  let y = lg.height + 10;

  const strip = renderStrip(m, w, narrow, L, y);
  parts.push(strip.svg);
  y += strip.h + 22;

  // The sum Σ m_t l_t, one bar per mask.
  const bars: Array<[Cell[], string]> = p.policy === "split"
    ? [[m.a.cells, tpl(L.sumSplit, { name: L.maskText })], [m.b.cells, tpl(L.sumSplit, { name: L.maskCall })]]
    : [[m.a.cells, L.sumTitle]];
  for (const [cells, title] of bars) {
    const b = renderSum(cells, m.scale, w, y, title);
    parts.push(b.svg);
    y += b.h + 8;
  }

  // Readout: the equation's terms, then what the policy weights and drops.
  const lines: Array<[string, string, number]> = [];
  if (p.policy === "split") {
    for (const [name, s] of [[L.maskText, m.a], [L.maskCall, m.b]] as const) {
      lines.push([s.m ? tpl(L.eqSplit, { name, s: fixed(s.s, 1), m: s.m, l: fixed(s.l, 2) }) : L.eqNone, "fig-t-strong fig-t-num", TYPE.body]);
    }
  } else {
    lines.push([m.a.m ? tpl(L.eq, { s: fixed(m.a.s, 1), m: m.a.m, l: fixed(m.a.l, 2) }) : L.eqNone, "fig-t-strong fig-t-num", TYPE.body]);
  }
  lines.push([tpl(L.count, { m: m.all.length, t: m.keep }), "fig-t-num", TYPE.body]);
  const byTurn = new Map<number, { role: Role; n: number }>();
  for (const c of m.all) byTurn.set(c.tok[1], { role: c.tok[2], n: (byTurn.get(c.tok[1])?.n ?? 0) + 1 });
  if (byTurn.size > 1) {
    const list = [...byTurn.values()].map((v) => `${L[v.role]} ${pct(v.n / m.all.length)}`).join(L.sep);
    lines.push([tpl(L.share, { list }), "fig-t-num", TYPE.body]);
  }
  if (m.all.length) lines.push([tpl(L.top, { list: topTerms(m.all, 3, lang) }), "fig-t-num", TYPE.body]);
  if (m.truncated) {
    const note = p.cut === "end"
      ? tpl(L.cutEnd, { k: m.dropped, lost: m.lost, m0: m.m0 }) + (m.stopLost ? L.stopLost : "")
      : tpl(L.cutStart, { k: m.dropped, lost: m.lost, m0: m.m0, a: m.all.length ? fixed(m.all.reduce((a, c) => a + (c.loss as number), 0) / m.all.length, 2) : "–", b: fixed(m.fullAvg, 2) });
    lines.push([note, "fig-t-num", TYPE.body]);
  }
  lines.push([L.firstNote, "fig-t-muted", TYPE.small]);
  const rp: string[] = [];
  y += 4;
  for (const [s, cls, size] of lines) {
    for (const part of wrapT(s, size, w)) {
      y += size + 5;
      rp.push(text(0, y, part, { "font-size": size, class: cls }));
    }
    y += 3;
  }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y + 6, describe(st, lang), ...parts);
}

// ---------------------------------------------------------------- data

// Token text, turn index, role (call = the assistant's tool-call turn, tool =
// the tool result, which the template serializes under the user role), part of
// the turn, and l_t = −log p_θ(u_t | u_<t) in nats under the full context.
// `left[k]` holds the losses of the last k tokens scored alone (first = null).
const CONVERSATIONS: Record<Lang, Conversation> = {
  en: {
    tokens: [
      ["<|im_start|>", 0, "system", "header", null],
      ["system", 0, "system", "header", 14.69],
      ["\n", 0, "system", "header", 3.17],
      ["You", 0, "system", "content", 7.06],
      [" are", 0, "system", "content", 0.88],
      [" a", 0, "system", "content", 1.87],
      [" weather", 0, "system", "content", 12.48],
      [" assistant", 0, "system", "content", 8.74],
      [".", 0, "system", "content", 1.24],
      [" Answer", 0, "system", "content", 4.33],
      [" in", 0, "system", "content", 4.65],
      [" one", 0, "system", "content", 4.71],
      [" sentence", 0, "system", "content", 0.65],
      [".", 0, "system", "content", 3.19],
      ["<|im_end|>", 0, "system", "eot", 21.55],
      ["\n", 0, "system", "sep", 3.58],
      ["<|im_start|>", 1, "user", "header", 18.67],
      ["user", 1, "user", "header", 11.63],
      ["\n", 1, "user", "header", 3.83],
      ["Do", 1, "user", "content", 8.69],
      [" I", 1, "user", "content", 3.94],
      [" need", 1, "user", "content", 1.35],
      [" an", 1, "user", "content", 3.91],
      [" umbrella", 1, "user", "content", 2.10],
      [" in", 1, "user", "content", 3.08],
      [" Paris", 1, "user", "content", 5.52],
      [" today", 1, "user", "content", 3.66],
      ["?", 1, "user", "content", 0.96],
      ["<|im_end|>", 1, "user", "eot", 20.52],
      ["\n", 1, "user", "sep", 1.26],
      ["<|im_start|>", 2, "call", "header", 11.17],
      ["assistant", 2, "call", "header", 10.13],
      ["\n", 2, "call", "header", 0.15],
      ["<tool_call>", 2, "call", "content", 17.33],
      ["\n", 2, "call", "content", 3.39],
      ["{\"", 2, "call", "content", 12.76],
      ["name", 2, "call", "content", 4.03],
      ["\":", 2, "call", "content", 0.54],
      [" \"", 2, "call", "content", 0.08],
      ["get", 2, "call", "content", 11.01],
      ["_weather", 2, "call", "content", 0.93],
      ["\",", 2, "call", "content", 0.53],
      [" \"", 2, "call", "content", 0.00],
      ["arguments", 2, "call", "content", 2.78],
      ["\":", 2, "call", "content", 0.01],
      [" {\"", 2, "call", "content", 1.66],
      ["city", 2, "call", "content", 1.53],
      ["\":", 2, "call", "content", 0.08],
      [" \"", 2, "call", "content", 0.06],
      ["Paris", 2, "call", "content", 0.11],
      ["\"}}\n", 2, "call", "content", 2.21],
      ["</tool_call>", 2, "call", "content", 12.87],
      ["<|im_end|>", 2, "call", "eot", 20.97],
      ["\n", 2, "call", "sep", 2.90],
      ["<|im_start|>", 3, "tool", "header", 13.31],
      ["user", 3, "tool", "header", 3.90],
      ["\n", 3, "tool", "header", 0.06],
      ["<", 3, "tool", "content", 10.97],
      ["tool", 3, "tool", "content", 12.58],
      ["_response", 3, "tool", "content", 9.25],
      [">\n", 3, "tool", "content", 1.65],
      ["{\"", 3, "tool", "content", 5.19],
      ["city", 3, "tool", "content", 3.78],
      ["\":", 3, "tool", "content", 0.22],
      [" \"", 3, "tool", "content", 0.03],
      ["Paris", 3, "tool", "content", 0.06],
      ["\",", 3, "tool", "content", 0.82],
      [" \"", 3, "tool", "content", 0.01],
      ["rain", 3, "tool", "content", 5.75],
      ["\":", 3, "tool", "content", 1.08],
      [" ", 3, "tool", "content", 1.47],
      ["0", 3, "tool", "content", 0.94],
      [".", 3, "tool", "content", 0.67],
      ["8", 3, "tool", "content", 3.07],
      ["}\n", 3, "tool", "content", 1.97],
      ["</", 3, "tool", "content", 11.31],
      ["tool", 3, "tool", "content", 0.00],
      ["_response", 3, "tool", "content", 0.00],
      [">", 3, "tool", "content", 4.26],
      ["<|im_end|>", 3, "tool", "eot", 12.10],
      ["\n", 3, "tool", "sep", 3.75],
      ["<|im_start|>", 4, "assistant", "header", 9.81],
      ["assistant", 4, "assistant", "header", 0.17],
      ["\n", 4, "assistant", "header", 0.03],
      ["Yes", 4, "assistant", "content", 11.48],
      [".", 4, "assistant", "content", 2.82],
      [" Rain", 4, "assistant", "content", 4.02],
      [" is", 4, "assistant", "content", 1.38],
      [" likely", 4, "assistant", "content", 3.06],
      [" in", 4, "assistant", "content", 1.87],
      [" Paris", 4, "assistant", "content", 1.28],
      [" today", 4, "assistant", "content", 0.63],
      [",", 4, "assistant", "content", 2.48],
      [" with", 4, "assistant", "content", 1.74],
      [" an", 4, "assistant", "content", 1.29],
      [" ", 4, "assistant", "content", 4.68],
      ["8", 4, "assistant", "content", 0.04],
      ["0", 4, "assistant", "content", 0.34],
      ["%", 4, "assistant", "content", 0.02],
      [" chance", 4, "assistant", "content", 0.11],
      [".", 4, "assistant", "content", 1.22],
      ["<|im_end|>", 4, "assistant", "eot", 22.67],
      ["\n", 4, "assistant", "sep", 2.25],
    ],
    left: {
      24: [null, 4.60, 20.39, 16.86, 1.01, 10.04, 4.24, 12.72, 2.28, 6.43, 3.66, 7.73, 2.64, 2.26, 3.34, 3.70, 2.32, 0.21, 0.66, 0.12, 0.16, 1.12, 22.13, 2.06],
      28: [null, 10.26, 11.87, 2.37, 19.41, 1.73, 19.75, 16.40, 2.64, 12.13, 3.75, 11.80, 2.37, 6.60, 3.50, 8.04, 3.18, 2.47, 3.96, 3.58, 2.47, 0.23, 0.70, 0.15, 0.22, 1.03, 21.54, 1.20],
      32: [null, 3.02, 2.93, 9.69, 9.76, 13.16, 11.28, 2.24, 20.10, 1.12, 19.52, 17.35, 2.06, 10.31, 3.27, 12.29, 2.40, 5.62, 3.23, 8.19, 3.08, 2.52, 3.38, 3.21, 2.13, 0.18, 0.52, 0.18, 0.29, 1.14, 21.05, 0.98],
      36: [null, 10.63, 5.12, 0.93, 1.87, 1.44, 3.13, 3.55, 9.59, 12.79, 9.66, 2.73, 20.92, 1.25, 20.22, 15.69, 2.32, 10.06, 3.61, 5.26, 1.50, 5.79, 3.25, 8.26, 3.58, 2.66, 3.21, 2.47, 3.07, 0.08, 0.79, 0.09, 0.36, 1.30, 21.49, 1.06],
      40: [null, 1.27, 9.77, 1.76, 0.09, 8.23, 0.87, 1.07, 2.26, 0.59, 2.53, 2.05, 9.14, 14.85, 9.28, 2.69, 21.55, 1.51, 20.63, 15.71, 2.68, 8.74, 3.62, 7.37, 1.45, 5.64, 2.47, 1.94, 4.20, 2.45, 2.05, 1.97, 4.08, 0.06, 0.55, 0.08, 0.23, 1.42, 22.40, 1.00],
      44: [null, 6.81, 9.11, 8.14, 0.71, 0.29, 3.25, 0.35, 0.02, 7.60, 1.60, 0.79, 2.37, 0.88, 2.51, 1.32, 3.35, 12.34, 3.37, 2.57, 21.59, 1.88, 20.68, 16.52, 2.12, 8.02, 3.72, 6.61, 1.53, 5.66, 2.87, 1.16, 4.09, 2.37, 1.72, 1.91, 4.85, 0.04, 0.39, 0.06, 0.15, 1.46, 21.52, 0.97],
      48: [null, 8.34, 7.98, 10.56, 12.12, 1.48, 6.65, 9.12, 1.10, 0.18, 4.08, 0.39, 0.03, 7.61, 1.04, 0.82, 1.86, 0.79, 2.67, 1.94, 0.31, 0.01, 0.01, 2.44, 21.09, 1.70, 20.64, 14.82, 1.20, 8.13, 3.80, 7.95, 1.42, 5.39, 2.92, 0.91, 3.78, 2.52, 1.86, 2.03, 4.78, 0.03, 0.30, 0.04, 0.12, 1.25, 22.43, 0.92],
      52: [null, 19.04, 4.60, 20.21, 18.01, 2.09, 12.89, 11.13, 11.87, 1.25, 7.69, 7.96, 1.30, 0.19, 5.36, 0.57, 0.06, 7.15, 0.74, 1.03, 2.12, 0.61, 2.53, 1.67, 0.95, 0.01, 0.02, 2.04, 20.64, 2.80, 11.97, 10.61, 0.22, 7.79, 4.04, 7.82, 1.33, 5.52, 3.08, 1.48, 3.08, 2.90, 2.15, 2.32, 4.13, 0.08, 0.38, 0.05, 0.11, 1.45, 22.95, 0.64],
      56: [null, 1.27, 9.77, 12.02, 21.26, 16.77, 11.29, 16.74, 20.70, 3.89, 18.07, 12.15, 10.67, 1.12, 6.65, 6.04, 0.52, 0.09, 0.61, 0.97, 0.03, 7.40, 0.70, 1.04, 2.00, 1.07, 2.63, 0.91, 4.48, 0.00, 0.00, 2.64, 20.03, 10.41, 10.47, 14.27, 0.18, 10.16, 3.94, 5.74, 1.27, 5.21, 2.77, 0.54, 3.44, 3.07, 1.58, 2.14, 3.04, 0.05, 0.27, 0.07, 0.19, 1.34, 21.73, 1.93],
      60: [null, 6.72, 2.76, 7.75, 0.39, 0.85, 3.57, 2.66, 22.59, 17.11, 9.15, 19.53, 20.98, 5.12, 17.46, 12.24, 9.66, 0.68, 6.64, 1.38, 0.19, 0.05, 0.51, 1.76, 0.05, 7.24, 0.73, 0.89, 1.82, 0.94, 2.63, 0.94, 4.39, 0.00, 0.00, 2.70, 19.31, 9.16, 10.36, 14.57, 0.17, 9.00, 4.11, 5.10, 1.33, 5.11, 2.80, 0.99, 3.08, 2.98, 1.70, 1.94, 3.36, 0.05, 0.31, 0.06, 0.17, 1.26, 21.41, 1.97],
      64: [null, 9.97, 9.71, 1.57, 9.21, 0.65, 1.50, 1.84, 0.33, 0.46, 3.50, 2.21, 22.65, 17.35, 10.31, 20.00, 20.59, 4.49, 17.49, 11.11, 8.61, 0.70, 5.83, 2.30, 0.32, 0.05, 0.16, 0.84, 0.02, 6.74, 0.73, 0.80, 1.23, 0.62, 2.81, 1.80, 5.38, 0.00, 0.00, 2.56, 19.41, 10.36, 10.22, 15.09, 0.11, 9.56, 4.12, 5.31, 1.45, 4.33, 2.44, 0.74, 2.56, 3.00, 1.56, 1.80, 3.37, 0.04, 0.39, 0.05, 0.12, 1.31, 21.84, 2.20],
      68: [null, 5.11, 0.56, 0.04, 7.18, 6.77, 0.86, 0.04, 3.99, 0.04, 1.22, 2.50, 0.27, 0.76, 4.07, 3.88, 20.89, 17.15, 13.69, 20.15, 20.93, 3.91, 16.91, 11.06, 9.01, 0.81, 4.10, 2.24, 0.26, 0.05, 0.11, 0.77, 0.03, 6.53, 0.57, 0.89, 1.01, 0.65, 2.91, 1.70, 7.16, 0.00, 0.00, 2.15, 18.95, 10.57, 10.30, 15.01, 0.13, 8.81, 3.83, 5.88, 1.48, 4.14, 2.16, 0.80, 2.36, 2.95, 1.91, 1.95, 2.88, 0.06, 0.46, 0.05, 0.12, 1.18, 22.81, 2.03],
      72: [null, 4.72, 20.89, 1.96, 8.95, 2.87, 0.66, 0.07, 7.80, 6.13, 0.79, 0.03, 4.50, 0.03, 1.09, 2.71, 0.14, 0.59, 4.21, 2.70, 19.59, 20.70, 4.99, 19.25, 20.93, 1.64, 17.41, 12.71, 9.49, 0.82, 2.15, 2.50, 0.16, 0.04, 0.11, 0.94, 0.03, 6.44, 0.65, 0.82, 1.08, 0.66, 2.94, 1.62, 10.81, 0.00, 0.00, 3.09, 16.93, 6.38, 10.57, 11.06, 0.04, 15.79, 4.15, 5.76, 1.34, 4.43, 2.35, 1.16, 2.80, 3.06, 2.53, 2.17, 2.77, 0.06, 0.40, 0.06, 0.12, 1.28, 20.37, 1.06],
      76: [null, 19.97, 7.04, 19.39, 16.94, 1.62, 11.87, 4.36, 13.12, 3.09, 0.73, 0.08, 8.00, 5.14, 0.60, 0.03, 3.78, 0.02, 1.38, 2.64, 0.12, 0.19, 5.26, 2.11, 13.41, 20.39, 5.04, 11.24, 16.88, 0.75, 19.86, 13.27, 8.61, 0.72, 5.68, 3.06, 0.12, 0.03, 0.09, 1.14, 0.02, 6.94, 0.75, 0.99, 1.12, 0.56, 2.94, 1.51, 12.08, 0.00, 0.00, 3.64, 16.03, 7.02, 10.15, 0.69, 0.03, 15.61, 3.79, 5.42, 1.38, 4.14, 2.27, 1.39, 2.79, 3.04, 2.56, 2.20, 2.92, 0.06, 0.36, 0.05, 0.12, 1.17, 18.65, 1.15],
      80: [null, 3.71, 8.00, 6.49, 3.76, 23.48, 2.20, 21.43, 16.07, 1.95, 18.59, 3.62, 11.49, 3.43, 0.43, 0.06, 11.28, 1.13, 0.87, 0.02, 2.94, 0.01, 1.47, 1.35, 0.08, 0.07, 0.15, 1.89, 13.52, 20.88, 4.45, 13.85, 15.74, 0.79, 19.39, 12.11, 7.51, 0.76, 4.94, 3.40, 0.12, 0.02, 0.05, 1.17, 0.02, 6.89, 1.05, 1.21, 1.06, 0.54, 3.01, 1.76, 13.52, 0.00, 0.00, 3.59, 16.09, 5.19, 10.01, 2.57, 0.02, 14.99, 3.10, 5.26, 1.49, 3.73, 1.91, 0.97, 1.19, 2.71, 1.83, 1.67, 3.89, 0.06, 0.32, 0.03, 0.10, 0.99, 19.04, 0.57],
      84: [null, 4.24, 0.74, 3.68, 6.80, 1.68, 4.91, 5.90, 1.47, 24.66, 2.33, 22.46, 17.32, 1.91, 15.14, 3.69, 12.75, 4.36, 0.44, 0.08, 10.10, 1.41, 0.72, 0.01, 2.84, 0.01, 2.05, 1.37, 0.11, 0.10, 0.17, 2.91, 15.92, 20.37, 6.90, 12.25, 14.12, 1.83, 21.33, 12.09, 8.16, 0.61, 4.05, 2.46, 0.18, 0.02, 0.03, 0.69, 0.02, 6.06, 1.07, 1.36, 0.66, 0.71, 3.26, 2.33, 10.97, 0.00, 0.00, 2.10, 17.19, 6.49, 9.89, 3.01, 0.03, 11.68, 3.58, 4.49, 1.13, 2.79, 1.96, 1.47, 0.51, 2.35, 2.43, 1.73, 3.89, 0.05, 0.56, 0.02, 0.10, 0.91, 23.09, 1.56],
      88: [null, 22.09, 14.70, 2.75, 9.74, 3.62, 1.18, 3.98, 7.60, 2.92, 5.98, 5.19, 1.39, 22.65, 1.95, 18.20, 12.16, 0.46, 19.83, 3.56, 13.45, 4.40, 0.58, 0.15, 11.11, 2.26, 0.67, 0.01, 2.84, 0.01, 1.48, 1.17, 0.09, 0.10, 0.16, 1.91, 12.99, 20.60, 2.42, 11.90, 3.67, 0.02, 11.11, 11.97, 8.13, 1.06, 5.62, 3.25, 0.18, 0.03, 0.07, 1.25, 0.03, 5.84, 1.02, 1.27, 0.97, 0.59, 3.01, 1.74, 11.88, 0.00, 0.00, 5.21, 13.45, 3.58, 10.07, 1.38, 0.02, 12.75, 2.43, 4.44, 1.46, 3.61, 1.99, 1.18, 0.92, 2.59, 2.49, 1.92, 3.61, 0.04, 0.37, 0.03, 0.12, 1.11, 21.67, 0.52],
      92: [null, 7.09, 2.53, 21.69, 2.00, 20.93, 11.84, 4.65, 17.50, 3.76, 1.84, 3.79, 6.85, 2.97, 6.03, 4.47, 1.00, 20.92, 0.58, 10.21, 11.99, 0.23, 19.39, 3.94, 13.70, 4.30, 0.60, 0.12, 10.86, 2.30, 0.62, 0.01, 3.01, 0.02, 1.88, 1.58, 0.09, 0.08, 0.19, 1.68, 12.39, 20.27, 2.89, 12.28, 1.98, 0.03, 11.67, 11.59, 8.18, 1.26, 5.28, 4.59, 0.16, 0.03, 0.13, 1.44, 0.03, 5.73, 0.95, 1.42, 1.06, 0.73, 2.98, 1.47, 12.21, 0.00, 0.00, 5.14, 12.36, 1.94, 9.92, 1.05, 0.02, 12.69, 2.42, 4.05, 1.38, 3.77, 2.15, 1.18, 1.07, 2.71, 2.37, 1.82, 3.43, 0.04, 0.32, 0.03, 0.12, 1.22, 15.80, 0.27],
      96: [null, 2.64, 7.40, 4.70, 5.60, 0.61, 1.75, 21.27, 2.62, 21.70, 11.62, 3.79, 17.52, 3.37, 1.48, 3.81, 6.97, 2.66, 5.68, 4.82, 0.76, 23.16, 1.10, 10.29, 11.77, 0.34, 13.09, 3.83, 12.59, 3.70, 0.54, 0.10, 11.17, 1.52, 0.54, 0.00, 2.91, 0.01, 1.81, 1.02, 0.08, 0.05, 0.18, 1.93, 12.92, 21.59, 1.92, 11.38, 2.96, 0.04, 13.41, 11.60, 7.94, 1.31, 4.06, 3.78, 0.18, 0.02, 0.06, 1.12, 0.02, 5.69, 1.08, 1.59, 0.94, 0.66, 3.04, 1.78, 11.21, 0.00, 0.00, 4.56, 13.01, 1.85, 9.92, 0.21, 0.06, 12.01, 2.64, 4.55, 1.43, 3.61, 1.89, 0.97, 0.95, 2.79, 1.87, 1.66, 3.91, 0.04, 0.32, 0.02, 0.10, 1.27, 20.10, 0.38],
      100: [null, 0.08, 2.39, 11.16, 11.08, 0.87, 5.61, 6.46, 4.19, 0.48, 3.26, 22.52, 3.15, 22.44, 13.07, 5.70, 10.45, 4.48, 1.56, 3.72, 1.41, 2.77, 5.68, 4.05, 0.67, 22.69, 1.43, 10.49, 13.15, 0.33, 19.24, 3.31, 11.51, 4.58, 0.30, 0.09, 11.86, 0.90, 0.53, 0.01, 3.00, 0.01, 1.82, 1.59, 0.07, 0.04, 0.10, 3.00, 12.72, 20.95, 2.15, 12.06, 2.86, 0.10, 16.04, 11.91, 9.01, 1.16, 4.86, 3.57, 0.19, 0.02, 0.03, 0.69, 0.01, 5.82, 1.18, 1.42, 0.80, 0.66, 3.08, 2.33, 10.59, 0.00, 0.00, 2.57, 14.19, 3.45, 9.81, 0.41, 0.03, 11.69, 2.99, 4.19, 1.39, 3.11, 1.54, 0.98, 0.61, 2.28, 1.70, 1.44, 5.03, 0.04, 0.43, 0.02, 0.10, 0.98, 24.29, 1.96],
    },
  },
  zh: {
    tokens: [
      ["<|im_start|>", 0, "system", "header", null],
      ["system", 0, "system", "header", 14.69],
      ["\n", 0, "system", "header", 3.17],
      ["你是", 0, "system", "content", 10.72],
      ["天气", 0, "system", "content", 9.92],
      ["助手", 0, "system", "content", 8.28],
      ["，请", 0, "system", "content", 4.57],
      ["用", 0, "system", "content", 5.13],
      ["一句话", 0, "system", "content", 3.65],
      ["回答", 0, "system", "content", 1.88],
      ["。", 0, "system", "content", 6.55],
      ["<|im_end|>", 0, "system", "eot", 20.13],
      ["\n", 0, "system", "sep", 7.45],
      ["<|im_start|>", 1, "user", "header", 19.00],
      ["user", 1, "user", "header", 12.28],
      ["\n", 1, "user", "header", 3.82],
      ["今天", 1, "user", "content", 6.88],
      ["在", 1, "user", "content", 4.83],
      ["巴黎", 1, "user", "content", 5.17],
      ["需要", 1, "user", "content", 8.81],
      ["带", 1, "user", "content", 2.28],
      ["伞", 1, "user", "content", 2.27],
      ["吗", 1, "user", "content", 2.05],
      ["？", 1, "user", "content", 0.99],
      ["<|im_end|>", 1, "user", "eot", 20.93],
      ["\n", 1, "user", "sep", 1.24],
      ["<|im_start|>", 2, "call", "header", 9.89],
      ["assistant", 2, "call", "header", 11.60],
      ["\n", 2, "call", "header", 0.39],
      ["<tool_call>", 2, "call", "content", 18.67],
      ["\n", 2, "call", "content", 2.33],
      ["{\"", 2, "call", "content", 12.98],
      ["name", 2, "call", "content", 3.42],
      ["\":", 2, "call", "content", 0.71],
      [" \"", 2, "call", "content", 0.20],
      ["get", 2, "call", "content", 11.71],
      ["_weather", 2, "call", "content", 1.21],
      ["\",", 2, "call", "content", 0.44],
      [" \"", 2, "call", "content", 0.00],
      ["arguments", 2, "call", "content", 3.36],
      ["\":", 2, "call", "content", 0.01],
      [" {\"", 2, "call", "content", 2.31],
      ["city", 2, "call", "content", 2.32],
      ["\":", 2, "call", "content", 0.09],
      [" \"", 2, "call", "content", 0.09],
      ["巴黎", 2, "call", "content", 0.46],
      ["\"}}\n", 2, "call", "content", 2.12],
      ["</tool_call>", 2, "call", "content", 15.48],
      ["<|im_end|>", 2, "call", "eot", 21.09],
      ["\n", 2, "call", "sep", 3.19],
      ["<|im_start|>", 3, "tool", "header", 12.96],
      ["user", 3, "tool", "header", 8.68],
      ["\n", 3, "tool", "header", 0.09],
      ["<", 3, "tool", "content", 9.69],
      ["tool", 3, "tool", "content", 12.45],
      ["_response", 3, "tool", "content", 8.12],
      [">\n", 3, "tool", "content", 1.56],
      ["{\"", 3, "tool", "content", 5.15],
      ["city", 3, "tool", "content", 4.89],
      ["\":", 3, "tool", "content", 0.15],
      [" \"", 3, "tool", "content", 0.03],
      ["巴黎", 3, "tool", "content", 0.10],
      ["\",", 3, "tool", "content", 1.05],
      [" \"", 3, "tool", "content", 0.02],
      ["rain", 3, "tool", "content", 6.41],
      ["\":", 3, "tool", "content", 0.68],
      [" ", 3, "tool", "content", 1.76],
      ["0", 3, "tool", "content", 0.80],
      [".", 3, "tool", "content", 0.78],
      ["8", 3, "tool", "content", 3.06],
      ["}\n", 3, "tool", "content", 2.25],
      ["</", 3, "tool", "content", 10.62],
      ["tool", 3, "tool", "content", 0.00],
      ["_response", 3, "tool", "content", 0.00],
      [">", 3, "tool", "content", 3.10],
      ["<|im_end|>", 3, "tool", "eot", 15.38],
      ["\n", 3, "tool", "sep", 3.32],
      ["<|im_start|>", 4, "assistant", "header", 9.78],
      ["assistant", 4, "assistant", "header", 1.08],
      ["\n", 4, "assistant", "header", 0.04],
      ["需要", 4, "assistant", "content", 18.44],
      ["。", 4, "assistant", "content", 5.41],
      ["巴黎", 4, "assistant", "content", 2.74],
      ["今天", 4, "assistant", "content", 2.15],
      ["下雨", 4, "assistant", "content", 3.61],
      ["的概率", 4, "assistant", "content", 0.86],
      ["是", 4, "assistant", "content", 1.01],
      [" ", 4, "assistant", "content", 2.33],
      ["8", 4, "assistant", "content", 0.85],
      ["0", 4, "assistant", "content", 0.51],
      ["%", 4, "assistant", "content", 0.28],
      ["。", 4, "assistant", "content", 0.73],
      ["<|im_end|>", 4, "assistant", "eot", 16.25],
      ["\n", 4, "assistant", "sep", 2.20],
    ],
    left: {
      24: [null, 6.17, 11.35, 13.19, 2.29, 21.12, 1.45, 19.47, 17.48, 2.29, 14.81, 8.71, 12.76, 7.45, 3.66, 5.97, 1.00, 2.50, 3.07, 0.33, 0.34, 0.86, 20.43, 1.93],
      28: [null, 3.20, 1.61, 2.78, 6.07, 8.91, 13.07, 11.58, 2.46, 20.27, 1.09, 19.55, 17.38, 2.08, 14.40, 8.62, 12.40, 7.64, 3.97, 5.49, 1.01, 1.73, 3.94, 0.29, 0.34, 1.08, 20.36, 1.92],
      32: [null, 1.51, 9.51, 4.54, 1.02, 1.94, 0.88, 2.99, 2.43, 9.60, 13.41, 9.71, 2.85, 21.22, 1.34, 20.33, 16.01, 2.35, 14.34, 8.72, 12.71, 5.54, 3.10, 3.30, 0.93, 2.02, 2.57, 0.23, 0.39, 1.05, 20.18, 1.78],
      36: [null, 8.96, 0.56, 9.84, 1.97, 0.58, 7.57, 0.92, 1.24, 2.42, 0.87, 2.46, 2.55, 9.75, 13.42, 9.49, 2.57, 21.43, 1.55, 20.67, 14.76, 3.03, 13.35, 8.83, 9.55, 6.43, 2.13, 2.22, 0.98, 2.00, 2.44, 0.15, 0.41, 0.88, 20.65, 1.86],
      40: [null, 7.12, 8.03, 8.85, 9.45, 2.68, 0.36, 8.93, 0.45, 0.04, 7.54, 0.83, 1.31, 1.77, 0.96, 2.69, 1.48, 1.49, 0.21, 0.07, 2.64, 21.47, 2.17, 20.67, 16.40, 2.01, 11.64, 8.95, 9.08, 6.36, 2.31, 1.64, 1.00, 1.80, 2.52, 0.13, 0.32, 0.84, 20.61, 2.33],
      44: [null, 14.43, 3.39, 6.16, 9.90, 11.39, 1.38, 6.45, 8.46, 1.22, 0.17, 7.58, 0.48, 0.05, 7.08, 0.75, 1.15, 1.91, 0.73, 2.60, 2.14, 0.25, 0.00, 0.00, 1.59, 21.23, 3.44, 20.21, 12.81, 0.92, 9.76, 8.35, 7.46, 5.60, 2.41, 1.06, 0.85, 1.88, 2.28, 0.15, 0.27, 0.68, 21.09, 1.93],
      48: [null, 20.59, 15.52, 10.66, 13.90, 20.73, 2.78, 18.32, 12.62, 11.75, 1.26, 8.94, 8.42, 1.21, 0.22, 8.86, 0.65, 0.04, 6.84, 0.56, 1.14, 2.10, 0.99, 2.55, 1.35, 0.94, 0.00, 0.00, 2.12, 20.55, 4.63, 10.19, 11.36, 0.19, 13.08, 8.52, 7.19, 4.87, 2.23, 1.23, 0.69, 1.80, 2.42, 0.07, 0.19, 1.00, 18.06, 1.22],
      52: [null, 8.96, 0.56, 9.84, 10.78, 21.72, 17.21, 11.18, 18.12, 21.19, 4.22, 18.75, 12.19, 11.16, 0.88, 7.61, 3.61, 0.35, 0.04, 1.15, 1.53, 0.05, 8.57, 0.39, 1.22, 1.94, 1.10, 2.66, 0.82, 5.96, 0.00, 0.00, 2.39, 20.42, 8.96, 10.39, 14.10, 0.21, 13.88, 8.84, 8.60, 5.49, 1.79, 0.84, 0.69, 1.79, 2.05, 0.08, 0.23, 0.79, 16.95, 3.94],
      56: [null, 10.39, 3.50, 2.92, 7.60, 0.34, 0.36, 9.71, 4.64, 22.08, 17.19, 9.45, 19.00, 21.00, 4.68, 17.83, 11.69, 10.05, 0.70, 6.46, 1.94, 0.18, 0.05, 0.50, 1.70, 0.04, 7.79, 0.54, 1.15, 1.72, 0.88, 2.62, 1.14, 5.81, 0.00, 0.00, 2.88, 19.61, 9.52, 10.37, 14.81, 0.14, 12.15, 8.91, 7.66, 5.08, 2.05, 1.24, 0.75, 1.83, 1.78, 0.09, 0.18, 1.14, 14.27, 4.61],
      60: [null, 6.61, 8.22, 1.91, 1.19, 8.74, 0.28, 1.66, 1.50, 0.29, 0.38, 9.31, 1.81, 22.17, 17.53, 10.50, 19.84, 20.60, 4.40, 17.55, 10.70, 8.35, 0.67, 6.14, 2.34, 0.32, 0.05, 0.44, 1.07, 0.02, 6.44, 0.48, 0.98, 1.16, 0.62, 2.78, 2.13, 5.70, 0.00, 0.00, 2.86, 19.63, 10.42, 10.27, 14.99, 0.12, 12.79, 9.11, 7.42, 3.16, 2.66, 1.00, 0.81, 1.79, 1.32, 0.15, 0.16, 1.18, 15.04, 5.21],
      64: [null, 10.85, 2.70, 0.80, 0.04, 7.14, 7.04, 0.87, 0.04, 4.46, 0.03, 1.47, 1.63, 0.22, 0.11, 9.40, 2.17, 21.18, 18.03, 13.21, 19.94, 21.63, 3.49, 15.76, 11.19, 8.41, 0.83, 1.02, 2.92, 0.17, 0.04, 0.34, 0.89, 0.02, 6.20, 0.54, 0.94, 1.19, 0.60, 2.81, 1.85, 9.39, 0.00, 0.00, 2.81, 19.04, 10.77, 10.46, 15.71, 0.12, 12.22, 9.20, 8.34, 3.26, 2.49, 1.09, 0.91, 1.91, 1.50, 0.16, 0.18, 1.02, 16.69, 4.69],
      68: [null, 15.65, 2.55, 20.50, 4.31, 10.11, 3.25, 1.17, 0.06, 8.17, 6.14, 0.80, 0.03, 4.19, 0.03, 1.55, 2.56, 0.15, 0.67, 9.60, 2.14, 19.42, 18.95, 6.50, 19.54, 20.57, 2.57, 18.63, 12.24, 8.92, 0.79, 1.16, 2.38, 0.23, 0.04, 0.51, 1.02, 0.03, 6.51, 0.54, 1.07, 1.18, 0.62, 2.79, 1.94, 8.49, 0.00, 0.00, 2.68, 17.34, 6.16, 10.37, 7.34, 0.09, 21.29, 8.99, 7.09, 3.73, 2.65, 1.17, 0.88, 1.93, 1.48, 0.18, 0.19, 0.97, 16.02, 3.59],
      72: [null, 3.87, 21.10, 3.53, 20.21, 15.86, 2.38, 15.32, 3.46, 11.84, 3.37, 0.78, 0.07, 9.99, 4.52, 0.66, 0.03, 3.50, 0.01, 1.50, 3.41, 0.11, 0.18, 7.36, 1.60, 14.31, 20.64, 4.89, 11.10, 16.17, 0.84, 20.34, 12.08, 8.48, 0.68, 4.30, 3.09, 0.13, 0.02, 0.27, 1.26, 0.02, 7.02, 0.75, 1.17, 1.12, 0.52, 2.87, 1.68, 12.76, 0.00, 0.00, 3.32, 16.62, 6.13, 10.00, 1.53, 0.03, 20.73, 8.39, 6.17, 3.13, 2.79, 1.03, 0.89, 2.12, 1.25, 0.16, 0.17, 0.73, 12.19, 3.35],
      76: [null, 9.60, 8.81, 6.01, 1.18, 0.92, 22.51, 3.27, 22.43, 17.57, 2.11, 19.21, 3.02, 11.13, 3.85, 0.62, 0.09, 12.44, 1.83, 0.62, 0.01, 3.22, 0.01, 1.98, 3.13, 0.07, 0.15, 1.17, 1.91, 16.46, 20.86, 5.13, 12.57, 14.30, 1.66, 21.22, 12.49, 7.76, 0.58, 3.47, 2.95, 0.14, 0.02, 0.17, 1.01, 0.02, 6.08, 0.96, 1.60, 0.67, 0.84, 3.07, 1.97, 11.15, 0.00, 0.00, 2.33, 18.53, 5.25, 9.96, 2.32, 0.05, 19.19, 4.84, 1.69, 5.54, 3.74, 1.11, 1.09, 2.19, 1.15, 0.31, 0.27, 0.65, 20.02, 2.22],
      80: [null, 8.34, 11.52, 4.33, 9.33, 10.45, 4.53, 5.44, 2.90, 1.59, 22.32, 2.18, 24.03, 16.34, 4.86, 22.64, 3.50, 10.91, 4.03, 0.52, 0.07, 12.02, 1.83, 0.76, 0.01, 2.79, 0.01, 1.92, 2.39, 0.07, 0.04, 1.96, 1.83, 15.46, 21.03, 3.26, 14.51, 12.65, 0.50, 12.46, 11.65, 7.74, 0.78, 2.44, 3.76, 0.15, 0.02, 0.28, 1.19, 0.02, 5.37, 1.00, 1.50, 0.62, 0.75, 3.19, 2.13, 10.55, 0.00, 0.00, 3.76, 16.91, 5.62, 9.89, 3.06, 0.03, 19.16, 6.14, 3.22, 2.22, 3.76, 0.98, 1.01, 2.08, 1.28, 0.32, 0.19, 0.71, 17.35, 3.19],
      84: [null, 20.16, 3.04, 20.27, 16.21, 3.23, 15.38, 4.49, 7.65, 9.79, 4.49, 5.46, 1.70, 1.25, 20.52, 1.31, 11.16, 10.66, 0.51, 20.75, 3.72, 13.22, 3.98, 0.98, 0.30, 10.46, 2.45, 0.64, 0.01, 3.06, 0.01, 2.05, 3.10, 0.09, 0.11, 2.53, 1.43, 13.13, 19.38, 3.23, 12.02, 3.98, 0.03, 10.58, 12.49, 7.40, 1.14, 5.51, 4.48, 0.17, 0.03, 0.19, 1.22, 0.03, 5.33, 0.76, 1.52, 0.81, 0.72, 3.04, 1.97, 12.06, 0.00, 0.00, 4.16, 15.12, 3.10, 9.97, 0.63, 0.03, 18.32, 6.89, 4.05, 2.26, 2.95, 1.48, 0.84, 2.15, 0.95, 0.32, 0.19, 0.94, 14.83, 2.10],
      88: [null, 5.43, 3.13, 4.24, 7.11, 21.00, 5.96, 19.96, 13.73, 3.89, 14.54, 4.59, 7.58, 10.10, 3.96, 4.27, 2.20, 0.95, 21.61, 1.45, 11.79, 12.31, 0.55, 21.27, 2.09, 12.15, 3.86, 0.84, 0.29, 12.18, 2.52, 0.58, 0.01, 3.21, 0.01, 2.22, 3.41, 0.09, 0.11, 1.70, 1.70, 14.12, 20.91, 2.81, 12.58, 5.41, 0.06, 10.94, 12.53, 7.98, 1.46, 5.82, 4.75, 0.16, 0.03, 0.20, 1.14, 0.03, 5.66, 0.73, 1.69, 0.79, 0.80, 3.06, 2.12, 12.88, 0.00, 0.00, 3.12, 15.46, 2.34, 9.88, 0.74, 0.03, 18.17, 6.00, 3.28, 2.36, 3.20, 1.16, 0.88, 2.27, 0.90, 0.36, 0.26, 0.87, 16.57, 1.40],
      92: [null, 11.15, 16.62, 10.47, 3.00, 4.40, 3.45, 2.70, 6.16, 22.86, 4.21, 20.76, 14.41, 4.43, 10.47, 5.09, 6.31, 9.19, 1.93, 2.14, 2.25, 0.87, 21.69, 1.64, 10.35, 11.83, 0.51, 19.58, 2.43, 13.25, 3.79, 0.59, 0.26, 13.67, 1.16, 0.56, 0.01, 3.32, 0.01, 2.50, 1.88, 0.08, 0.05, 0.83, 2.19, 14.08, 20.94, 2.88, 10.65, 6.54, 0.07, 9.63, 12.04, 7.34, 1.33, 5.27, 3.63, 0.16, 0.03, 0.12, 0.87, 0.02, 5.94, 0.79, 1.73, 0.75, 0.70, 3.05, 2.41, 10.84, 0.00, 0.00, 2.48, 15.58, 3.80, 9.81, 1.16, 0.06, 17.46, 4.22, 2.00, 2.09, 4.03, 0.85, 1.18, 2.46, 0.74, 0.45, 0.25, 0.72, 15.44, 2.53],
    },
  },
};

export default defineFigure({
  name: "sft-loss-mask",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    policy: {
      kind: "choice", label: { en: "Target mask", zh: "目标掩码" }, default: "assistant",
      options: [
        { value: "all", label: { en: labels.en.pAll, zh: labels.zh.pAll } },
        { value: "assistant", label: { en: labels.en.pAssistant, zh: labels.zh.pAssistant } },
        { value: "final", label: { en: labels.en.pFinal, zh: labels.zh.pFinal } },
        { value: "split", label: { en: "Tool calls separate", zh: "工具调用另设掩码" } },
      ],
    },
    eot: { kind: "toggle", label: { en: "Score the assistant end-of-turn token", zh: "对助手的轮次结束词元计分" }, default: true },
    keep: {
      kind: "range", label: { en: "Keep at most", zh: "最多保留" }, unit: { en: "tokens", zh: "个词元" },
      min: 24, max: KEEP_MAX, step: 4, default: KEEP_MAX,
    },
    cut: {
      kind: "choice", label: { en: "Truncate from", zh: "截断位置" }, default: "end",
      options: [
        { value: "end", label: { en: "End", zh: "末尾" } },
        { value: "start", label: { en: "Start", zh: "开头" } },
      ],
    },
  },
  render,
  describe,
});
