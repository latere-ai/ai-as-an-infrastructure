// Time to first audio for a cascade (ASR, text model, TTS) and a
// speech-to-speech model, drawn as a latency budget on one time axis that
// starts when the user stops speaking. The speech chapter decomposes the
// serial case as
//
//   D_first = D_endpoint + D_in + D_ASR + D_model + D_TTS + D_out,
//
// and notes that overlapping stages make the observed delay follow the
// critical path rather than this sum. Here each stage has two costs: the time
// until it can hand its first usable piece to the next stage, and the time to
// finish its whole output. Without streaming a stage waits for the previous
// stage to finish, so the delay is the sum of whole-stage times; with
// streaming it starts on the first piece, so the delay is the sum of
// first-piece times and the rest of the work runs off the critical path.
//
// Stage costs are illustrative, for a 2 s utterance and a 50-token reply of
// about 4 s of audio; the reader sets the endpoint silence timeout and the
// network delay. The audio model's 160 ms is the theoretical latency Moshi
// reports (Défossez et al. 2024). Reference numbers quoted in the readout are
// the chapter's: Moshi about 200 ms in practice, GPT-4o 320 ms on average
// (OpenAI 2024), and median human response offsets of 0 to 300 ms across ten
// languages (Stivers et al. 2009).

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrapCJK } from "./lib/notation.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { int, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

// Illustrative stage costs in ms: [first usable piece, whole output].
export const COST = {
  asr: { first: 80, whole: 300 }, // streaming finalizes the last chunk; batch reads the whole utterance
  model: { first: 450, whole: 1250 }, // first 10 tokens after a 250 ms first token; all 50 at 50 tokens/s
  tts: { first: 150, whole: 800 }, // first audio chunk; the whole reply at real-time factor 0.2
  s2s: { first: 160, whole: 160 }, // Moshi's reported theoretical latency
};
const UTTERANCE = 2000; // user speech before t = 0, in ms
const ASR_CHUNK = 320; // streaming ASR partials during speech

export type StageKey = "endpoint" | "in" | "asr" | "model" | "tts" | "out";
export interface Bar {
  stage: StageKey | "s2s" | "speech" | "reply" | "partial";
  t0: number;
  t1: number;
  critical: boolean;
}
export interface Plan {
  bars: Bar[];
  first: number; // time to first audio
  terms: Array<[StageKey | "s2s", number]>; // the critical-path terms, in the equation's order
  serial: number; // the sum of whole-stage times
  serialTerms: Array<[StageKey | "s2s", number]>;
}

type P = { streaming: boolean; duplex: boolean; endpoint: number; network: number };

export function cascade(p: P): Plan {
  const bars: Bar[] = [];
  const E = p.endpoint, N = p.network;
  let t = 0;
  const step = (stage: StageKey, d: number, critical = true) => { bars.push({ stage, t0: t, t1: t + d, critical }); t += d; return t; };
  step("endpoint", E);
  step("in", N);
  if (p.streaming) {
    // Partial hypotheses while the user is still speaking, off the critical path.
    for (let s = -UTTERANCE + N; s < 0; s += ASR_CHUNK) bars.push({ stage: "partial", t0: s, t1: Math.min(s + ASR_CHUNK * 0.35, 0), critical: false });
  }
  const asr = p.streaming ? COST.asr.first : COST.asr.whole;
  step("asr", asr);
  const m0 = t;
  if (p.streaming) {
    step("model", COST.model.first);
    bars.push({ stage: "model", t0: t, t1: m0 + COST.model.whole, critical: false });
    const s0 = t;
    step("tts", COST.tts.first);
    bars.push({ stage: "tts", t0: t, t1: Math.max(s0 + COST.tts.whole, m0 + COST.model.whole + COST.tts.first), critical: false });
  } else {
    step("model", COST.model.whole);
    step("tts", COST.tts.whole);
  }
  step("out", N);
  const first = t;
  bars.push({ stage: "reply", t0: first, t1: first + 4000, critical: false });
  const terms: Plan["terms"] = [["endpoint", E], ["in", N], ["asr", asr], ["model", p.streaming ? COST.model.first : COST.model.whole], ["tts", p.streaming ? COST.tts.first : COST.tts.whole], ["out", N]];
  const serialTerms: Plan["terms"] = [["endpoint", E], ["in", N], ["asr", COST.asr.whole], ["model", COST.model.whole], ["tts", COST.tts.whole], ["out", N]];
  return { bars, first, terms, serial: serialTerms.reduce((a, [, d]) => a + d, 0), serialTerms };
}

export function speechToSpeech(p: P): Plan {
  const bars: Bar[] = [];
  const E = p.duplex ? 0 : p.endpoint, N = p.network;
  let t = 0;
  const step = (stage: StageKey | "s2s", d: number) => { bars.push({ stage: stage as Bar["stage"], t0: t, t1: t + d, critical: true }); t += d; };
  if (E > 0) step("endpoint", E);
  step("in", N);
  step("s2s", COST.s2s.first);
  step("out", N);
  const first = t;
  bars.push({ stage: "reply", t0: first, t1: first + 4000, critical: false });
  const terms: Plan["terms"] = [...(E > 0 ? [["endpoint", E] as ["endpoint", number]] : []), ["in", N], ["s2s", COST.s2s.first], ["out", N]];
  return { bars, first, terms, serial: first, serialTerms: terms };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "Time to first audio, cascade and speech-to-speech",
    cascade: "Cascade: ASR, text model, TTS",
    s2s: "Speech-to-speech model",
    speech: "user speaks",
    endpoint: "endpoint wait",
    in: "uplink",
    asr: "ASR",
    model: "text model",
    tts: "TTS",
    out: "downlink",
    s2sStage: "audio model",
    reply: "reply audio",
    axis: "time since the user stopped speaking (ms)",
    first: "first audio {t} ms",
    human: "human median response offsets, 0 to 300 ms",
    critical: "on the critical path",
    off: "work off the critical path",
    wait: "waiting for silence",
    eqCascade: "Cascade: D_first = {terms} = {t} ms",
    eqSerial: "Without streaming the same stages would sum to {terms} = {t} ms.",
    eqS2s: "Speech-to-speech: D_first = {terms} = {t} ms",
    duplexNote: "The audio model predicts the end of the turn itself, so no silence timeout is added, and it keeps listening while it speaks.",
    refs: "Reported: Moshi about 200 ms in practice, GPT-4o 320 ms on average.",
    describe: "With a {e} ms silence timeout and {n} ms network delay each way, the cascade {mode} reaches first audio at {c} ms and the speech-to-speech model {dup} at {s} ms.",
    modeStream: "streaming between stages",
    modeSerial: "waiting for each stage to finish",
    dupOn: "in full duplex",
    dupOff: "with the same timeout",
  },
  zh: {
    title: "首段音频时间：级联与语音到语音",
    cascade: "级联：ASR、文本模型、TTS",
    s2s: "语音到语音模型",
    speech: "用户说话",
    endpoint: "终点等待",
    in: "上行传输",
    asr: "ASR",
    model: "文本模型",
    tts: "TTS",
    out: "下行传输",
    s2sStage: "音频模型",
    reply: "回应音频",
    axis: "自用户停止说话起的时间（毫秒）",
    first: "首段音频 {t} 毫秒",
    human: "人类回应偏移的中位数，0 到 300 毫秒",
    critical: "位于关键路径",
    off: "不在关键路径上的工作",
    wait: "等待静音",
    eqCascade: "级联：D_first = {terms} = {t} 毫秒",
    eqSerial: "不做流式处理时，同样的阶段相加为 {terms} = {t} 毫秒。",
    eqS2s: "语音到语音：D_first = {terms} = {t} 毫秒",
    duplexNote: "音频模型自己预测轮次何时结束，因此不加静音超时，并在说话时继续收听。",
    refs: "报告值：Moshi 实际约 200 毫秒，GPT-4o 平均 320 毫秒。",
    describe: "静音超时 {e} 毫秒、单向网络延迟 {n} 毫秒时，{mode}的级联在 {c} 毫秒发出首段音频，{dup}的语音到语音模型在 {s} 毫秒发出。",
    modeStream: "阶段间流式处理",
    modeSerial: "逐级等待前一阶段完成",
    dupOn: "全双工",
    dupOff: "使用同一超时",
  },
};

type Lb = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const c = cascade(p), s = speechToSpeech(p);
  return tpl(Lx.describe, {
    e: p.endpoint, n: p.network, mode: p.streaming ? Lx.modeStream : Lx.modeSerial,
    c: int(c.first), dup: p.duplex ? Lx.dupOn : Lx.dupOff, s: int(s.first),
  });
}

const FILL: Record<Bar["stage"], string> = {
  endpoint: C.ink3, in: C.c3, out: C.c3, asr: C.c1, partial: C.c1, model: C.c7, tts: C.c5, s2s: C.c2,
  speech: C.ink3, reply: C.ink3,
};

type Row = { key: Bar["stage"]; label: string };

function rowsFor(kind: "cascade" | "s2s", Lx: Lb): Row[] {
  const tail: Row[] = [{ key: "out", label: Lx.out }, { key: "reply", label: Lx.reply }];
  return kind === "cascade"
    ? [{ key: "endpoint", label: Lx.endpoint }, { key: "in", label: Lx.in }, { key: "asr", label: Lx.asr }, { key: "model", label: Lx.model }, { key: "tts", label: Lx.tts }, ...tail]
    : [{ key: "endpoint", label: Lx.endpoint }, { key: "in", label: Lx.in }, { key: "s2s", label: Lx.s2sStage }, ...tail];
}

function drawBar(b: Bar, x: (t: number) => number, y: number, h: number, hatchId: string, xmin: number, xmax: number): string {
  const x0 = Math.max(xmin, x(b.t0)), x1 = Math.min(xmax, x(b.t1));
  if (x1 - x0 < 0.5) return "";
  const a = { x: x0, y, width: x1 - x0, height: h, rx: 2 };
  if (b.stage === "endpoint") {
    return el("rect", { ...a, fill: `url(#${hatchId})` }) + el("rect", { ...a, fill: "none", stroke: C.ink3, "stroke-width": 1 });
  }
  if (b.stage === "reply" || b.stage === "speech") return el("rect", { ...a, fill: FILL[b.stage], "fill-opacity": 0.3 });
  return el("rect", { ...a, fill: FILL[b.stage], "fill-opacity": b.critical ? 1 : 0.3 });
}

function renderGroup(plan: Plan, kind: "cascade" | "s2s", title: string, x: (t: number) => number, x0: number, x1: number, y0: number, labelW: number, Lx: Lb, hatchId: string, size: number): { svg: string; h: number; top: number; bottom: number } {
  const parts: string[] = [];
  parts.push(text(0, y0 + size, title, { "font-size": size, class: "fig-t-strong" }));
  const top = y0 + size + 10;
  const rowH = 17, barH = 11;
  const rows = rowsFor(kind, Lx);
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    parts.push(text(labelW - 8, y + barH - 1, r.label, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
    for (const b of plan.bars) {
      const inRow = b.stage === r.key || (r.key === "asr" && b.stage === "partial");
      if (inRow) parts.push(drawBar(b, x, y, barH, hatchId, x0, x1));
    }
  });
  const bottom = top + rows.length * rowH - (rowH - barH);
  // First audio: a rule through the group and its value.
  const fx = x(plan.first);
  parts.push(el("line", { x1: fx, x2: fx, y1: top - 4, y2: bottom + 3, stroke: C.ink, "stroke-width": 1.5 }));
  const label = tpl(Lx.first, { t: int(plan.first) });
  const lw = textWidth(label, size);
  const right = fx + 6 + lw <= x1;
  parts.push(text(right ? fx + 6 : fx - 6, top + (rows.length - 1) * rowH + barH - 1, label, { "font-size": size, "text-anchor": right ? "start" : "end", class: "fig-t-halo fig-t-num" }));
  return { svg: g({ class: "fig-group" }, ...parts), h: bottom - y0, top, bottom };
}

function termsText(terms: Plan["terms"]): string {
  return terms.map(([, d]) => int(d)).join(" + ");
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const c = cascade(p), s = speechToSpeech(p);
  const hatchId = `${st.uid}-wait`;
  const labelW = Math.max(...[...rowsFor("cascade", Lx), ...rowsFor("s2s", Lx)].map((r) => textWidth(r.label, size))) + 14;
  const xl = labelW, xr = w - 18;
  const tmin = narrow ? -400 : -600;
  const span = Math.max(c.first, s.first) * 1.18 + 150;
  const stepMs = niceStep(span - tmin, narrow ? 3 : 6);
  const tmax = Math.max(1000, Math.ceil(span / stepMs) * stepMs);
  const x = linear([tmin, tmax], [xl, xr]);
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 4, 1))];

  // Legend.
  const key: Array<[string, string]> = [[Lx.critical, "1"], [Lx.off, "0.3"]];
  let kx = 0, ky = 0;
  for (const [label, op] of key) {
    const iw = 16 + textWidth(label, size);
    if (kx > 0 && kx + iw > w) { kx = 0; ky += size + 8; }
    parts.push(el("rect", { x: kx, y: ky + 1, width: 11, height: 11, rx: 2, fill: C.ink2, "fill-opacity": op }), text(kx + 16, ky + 11, label, { "font-size": size, class: "fig-t-muted" }));
    kx += iw + 16;
  }
  {
    const iw = 16 + textWidth(Lx.wait, size);
    if (kx > 0 && kx + iw > w) { kx = 0; ky += size + 8; }
    parts.push(el("rect", { x: kx, y: ky + 1, width: 11, height: 11, rx: 2, fill: `url(#${hatchId})`, stroke: C.ink3, "stroke-width": 1 }), text(kx + 16, ky + 11, Lx.wait, { "font-size": size, class: "fig-t-muted" }));
  }
  let y = ky + size + 16;

  // Human reference band, behind both groups.
  const bandTop = y;
  const humanLines = wrapCJK(Lx.human, size, Math.max(120, xr - x(0)));
  humanLines.forEach((ln, i) => parts.push(text(x(0) + 2, y + size + i * 15, ln, { "font-size": size, class: "fig-t-muted" })));
  y += humanLines.length * 15 + 8;
  // User speech row.
  parts.push(text(labelW - 8, y + 10, Lx.speech, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  parts.push(drawBar({ stage: "speech", t0: -UTTERANCE, t1: 0, critical: false }, x, y, 11, hatchId, xl, xr));
  y += 24;
  const gc = renderGroup(c, "cascade", Lx.cascade, x, xl, xr, y, labelW, Lx, hatchId, size);
  y += gc.h + 18;
  const gs = renderGroup(s, "s2s", Lx.s2s, x, xl, xr, y, labelW, Lx, hatchId, size);
  y += gs.h + 6;
  parts.splice(1, 0, el("rect", { x: x(0), y: bandTop, width: x(300) - x(0), height: y - bandTop, fill: C.c6, "fill-opacity": 0.1 }));
  parts.push(el("line", { x1: x(0), x2: x(0), y1: bandTop, y2: y, stroke: C.rule, "stroke-width": 1 }));
  parts.push(gc.svg, gs.svg);
  parts.push(axis({ scale: x, orient: "bottom", at: y, ticks: x.ticks(narrow ? 4 : 7), title: Lx.axis, format: (v) => int(v).replace("-", "−") }));
  y += axisHeight(true) + 10;

  // The chapter's decomposition with the terms on the critical path.
  const lines: Array<[string, string]> = [[tpl(Lx.eqCascade, { terms: termsText(c.terms), t: int(c.first) }), "fig-t-num"]];
  if (p.streaming) lines.push([tpl(Lx.eqSerial, { terms: termsText(c.serialTerms), t: int(c.serial) }), "fig-t-muted fig-t-num"]);
  lines.push([tpl(Lx.eqS2s, { terms: termsText(s.terms), t: int(s.first) }), "fig-t-num"]);
  if (p.duplex) lines.push([Lx.duplexNote, "fig-t-muted"]);
  lines.push([Lx.refs, "fig-t-muted"]);
  for (const [line, cls] of lines) {
    for (const part of wrapCJK(line, size, w * 0.92)) {
      y += 17;
      parts.push(text(0, y, part, { "font-size": size, class: cls }));
    }
    y += 3;
  }
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "voice-first-audio",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    streaming: { kind: "toggle", label: { en: "Cascade streams between stages", zh: "级联在阶段间流式处理" }, default: true },
    duplex: { kind: "toggle", label: { en: "Speech-to-speech in full duplex", zh: "语音到语音采用全双工" }, default: false },
    endpoint: { kind: "range", label: { en: "Endpoint silence timeout", zh: "终点静音超时" }, unit: { en: "ms", zh: "毫秒" }, min: 0, max: 1000, step: 10, default: 500 },
    network: { kind: "range", label: { en: "Network delay each way", zh: "单向网络延迟" }, unit: { en: "ms", zh: "毫秒" }, min: 5, max: 200, step: 5, default: 40 },
  },
  render,
  describe,
});
