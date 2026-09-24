// Three processes at their own timescales: the training loop that produced a
// model version, one agent task run on that version after release, and the
// model calls and decode steps inside the task.
//
// The timeline is the task's wall-clock time in seconds. Six model calls
// alternate with five tool actions, following the chapter's running trace
// (read a file, run the tests, inspect the failure, edit the code, run the
// tests again, explain). Call k reads the request plus every earlier output
// and observation, prefills that input, then decodes one token per step, and
// each token joins the input of the next step. The token counts, tool
// durations, and prefill rate of the trace are illustrative.
//
// Measured values, with their sources:
//   Training: DeepSeek-V3 Technical Report (arXiv 2412.19437v2), Table 1 and
//   sections 3.1 and 4.2. 2,664K H800 GPU-hours of pre-training on 14.8T
//   tokens, 119K for context extension, 5K for post-training, 2,788K in total,
//   on a cluster of 2,048 H800 GPUs; 180K GPU-hours per trillion tokens;
//   4K-token sequences with the batch ramped from 3,072 to 15,360 sequences
//   over the first 469B tokens. Wall-clock days, optimizer steps, and the
//   seconds per step are derived from those numbers by
//   tools/figure-data/process-timescales.py.
//   Serving: DeepSeek, "DeepSeek-V3/R1 Inference System Overview"
//   (github.com/deepseek-ai/open-infra-index, 202502OpenSourceWeek, day 6),
//   the 24 hours from 2025-02-27 12:00 UTC+8: average output speed 20 to 22
//   tokens per second per request; each 8-GPU H800 node delivers about 73.7k
//   input tokens per second (cache hits included) in prefill or 14.8k output
//   tokens per second in decode; average occupancy 226.75 nodes. GPU time per
//   token is the reciprocal of those per-GPU throughputs, a fleet average
//   that does not change with the decode speed the reader sets.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, textWidth, wrap, type Box } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- measured

// tools/figure-data/process-timescales.py prints these values.
export const TRAIN = {
  gpus: 2048,
  gpuHours: { pre: 2_664_000, ext: 119_000, post: 5_000, total: 2_788_000 },
  days: { pre: 54.199, ext: 2.421, post: 0.102, total: 56.722 },
  steps: 242_800, // optimizer steps of pre-training, estimated from the batch schedule
  stepSeconds: 19.9, // one optimizer step at the full 15,360 x 4,096-token batch
};
export const SERVE = {
  tokensPerSecond: 21, // midpoint of the reported 20 to 22 tokens per second per request
  gpuSecondsPerInput: 8 / 73_700, // one H800 node in prefill: 8 GPUs, 73.7k input tokens/s
  gpuSecondsPerOutput: 8 / 14_800, // one H800 node in decode: 8 GPUs, 14.8k output tokens/s
  fleetGpuHoursPerDay: 226.75 * 8 * 24,
};

// ---------------------------------------------------------------- trace (illustrative)

const PROMPT = 2400; // instructions, tool definitions, and the bug report
const PREFILL_RATE = 10_000; // input tokens per second of prefill, illustrative
const OUT = [60, 45, 220, 320, 40, 280]; // output tokens of each model call
const OBS = [1500, 700, 900, 40, 120]; // observation tokens each tool action returns
const TOOL_SECONDS = [0.2, -1, 0.3, 0.2, -1]; // -1: the test-suite duration the reader sets
type ToolKey = "read" | "test" | "inspect" | "edit" | "retest";
const TOOLS: ToolKey[] = ["read", "test", "inspect", "edit", "retest"];
type CallKey = "askRead" | "askTest" | "askInspect" | "writeEdit" | "askRetest" | "explain";
const CALLS: CallKey[] = ["askRead", "askTest", "askInspect", "writeEdit", "askRetest", "explain"];

interface Call { k: number; t0: number; tDec: number; t1: number; nIn: number; nOut: number }
interface Tool { k: number; t0: number; t1: number; nObs: number }
interface Plan { calls: Call[]; tools: Tool[]; end: number; inTotal: number; outTotal: number; final: number }

type P = { speed: number; test: number };

export function plan(p: P): Plan {
  const calls: Call[] = [];
  const tools: Tool[] = [];
  let t = 0, context = PROMPT;
  for (let k = 0; k < OUT.length; k++) {
    const nIn = context;
    const tDec = t + nIn / PREFILL_RATE;
    const t1 = tDec + OUT[k] / p.speed;
    calls.push({ k, t0: t, tDec, t1, nIn, nOut: OUT[k] });
    context += OUT[k];
    t = t1;
    if (k < OBS.length) {
      const dur = TOOL_SECONDS[k] < 0 ? p.test : TOOL_SECONDS[k];
      tools.push({ k, t0: t, t1: t + dur, nObs: OBS[k] });
      context += OBS[k];
      t += dur;
    }
  }
  return {
    calls, tools, end: t, final: context,
    inTotal: calls.reduce((a, c) => a + c.nIn, 0),
    outTotal: calls.reduce((a, c) => a + c.nOut, 0),
  };
}

// Where the task is at time t.
interface Now {
  phase: "prefill" | "decode" | "tool" | "done";
  call: Call; // the current call, or the call whose request the tool serves
  tool?: Tool;
  emitted: number; // output tokens of the current call so far
  calls: number; // calls started
  toolsDone: number;
  toolsStarted: number;
  input: number; // input tokens read so far, across calls
  output: number; // output tokens generated so far
  context: number; // tokens the next decode step reads
  segs: Array<{ kind: "prompt" | "out" | "obs" | "now"; n: number }>;
}

function now(pl: Plan, t: number): Now {
  const { calls, tools } = pl;
  let k = calls.findIndex((c) => t < c.t1);
  let phase: Now["phase"];
  let tool: Tool | undefined;
  if (k < 0) {
    k = calls.length - 1;
    phase = "done";
  } else {
    const ti = tools.findIndex((x) => t >= x.t0 && t < x.t1);
    if (ti >= 0) { tool = tools[ti]; k = ti; phase = "tool"; } else phase = t < calls[k].tDec ? "prefill" : "decode";
  }
  const call = calls[k];
  const emitted = phase === "prefill" ? 0 : phase === "decode" ? Math.min(call.nOut, Math.floor((t - call.tDec) * (call.nOut / (call.t1 - call.tDec)) + 1e-9)) : call.nOut;
  const prefillFrac = phase === "prefill" ? (t - call.t0) / (call.tDec - call.t0) : 1;
  let input = 0, output = 0;
  for (let i = 0; i < k; i++) { input += calls[i].nIn; output += calls[i].nOut; }
  input += Math.round(call.nIn * prefillFrac);
  output += emitted;
  const segs: Now["segs"] = [{ kind: "prompt", n: PROMPT }];
  for (let i = 0; i < k; i++) segs.push({ kind: "out", n: calls[i].nOut }, { kind: "obs", n: tools[i].nObs });
  segs.push({ kind: "now", n: emitted });
  const toolsDone = tools.filter((x) => x.t1 <= t).length;
  const toolsStarted = tools.filter((x) => x.t0 <= t).length;
  return { phase, call, tool, emitted, calls: k + 1, toolsDone, toolsStarted, input, output, context: call.nIn + emitted, segs };
}

const gpuSeconds = (input: number, output: number) => input * SERVE.gpuSecondsPerInput + output * SERVE.gpuSecondsPerOutput;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Training, one agent task, and its model calls on their own timescales",
    trainT: "Training loop, before release: DeepSeek-V3",
    trainNote: "{d} days on {g} H800 GPUs, {h} GPU-hours; about {s} optimizer steps, {ss} s each at the full batch",
    pre: "pre-training {d} d",
    ext: "context extension {d} d",
    post: "post-training {d} d",
    release: "release",
    serving: "serving on fixed weights, gap not to scale",
    thisTask: "this task",
    taskT: "One agent task after release (illustrative trace)",
    elapsed: "{e} of {d} s elapsed",
    prefill: "prefill",
    decode: "decode, one token per step",
    tool: "tool action",
    read: "read file", test: "run tests", inspect: "inspect failure", edit: "edit code", retest: "run tests",
    callT: "Call {k} of {n}: prefill {i} input tokens, then decode",
    callDone: "Call {k} of {n} is finished; the runtime is running “{a}” for {s} s",
    callEnd: "Call {k} of {n}, the last, wrote the explanation; the task is done",
    tokens: "{e} of {o} output tokens, {tt} s",
    tickEvery: "one tick per {n} tokens",
    ctxT: "Context the next decode step reads: {c} tokens",
    ctxTool: "Context so far, before the observation returns: {c} tokens",
    ctxEnd: "Context when the task ends: {c} tokens",
    ctxPrompt: "request and instructions",
    ctxOut: "model output",
    ctxObs: "tool observation",
    ctxNow: "this call so far",
    rulerT: "Durations on one logarithmic time axis",
    rStep: "decode step {v}",
    rCall: "call {k} {v}",
    rTask: "this task {v}",
    rTrainStep: "training step {v}",
    rTrainRun: "training run {v}",
    uToken: "Per token",
    uCall: "Per model call",
    uTask: "Per task",
    uVersion: "Per model version",
    vToken: "{ms} ms per decode step at {sp} tokens/s; {g} GPU-ms at the reported decode throughput",
    vCall: "call {k}: {i} input tokens, {e} of {o} output tokens, {s} of {d} s",
    vTask: "{c} of {n} calls, {tl} of {m} tool actions; {i} input and {o} output tokens so far, {g} GPU-s",
    vVersion: "{h} GPU-hours: the GPU time of about {n} tasks like this one, or {f} days of the reported serving fleet",
    aAskRead: "asks to read the file", aAskTest: "asks to run the tests", aAskInspect: "asks to inspect the failure",
    aWriteEdit: "writes the edit", aAskRetest: "asks to run the tests again", aExplain: "writes the explanation",
    kCall: "Call {k} prefills {i} tokens, then {a}",
    kTool: "The runtime runs “{a}”, {s} s; {o} observation tokens come back",
    kDone: "Task done: {n} calls, {m} tool actions, {i} input and {o} output tokens",
    describe: "At {e} s of a {d} s agent task, {state} The task has used {c} of {n} model calls and {tl} of {m} tool actions, reading {i} input tokens and generating {o} output tokens; the weights it runs on were fixed at release, after a {tr}-day training run.",
    sPrefill: "call {k} is prefilling {i} input tokens.",
    sDecode: "call {k} has decoded {e} of {o} tokens at {sp} tokens per second, and the next step reads {c} tokens.",
    sTool: "the runtime is running “{a}” while the model waits.",
    sDone: "the last call has written the explanation.",
    s: "s", d: "days", ms: "ms",
  },
  zh: {
    title: "训练、一项智能体任务及其模型调用各自的时间尺度",
    trainT: "训练循环，发布之前：DeepSeek-V3",
    trainNote: "{g} 块 H800 运行 {d} 天，共 {h} GPU 小时；约 {s} 个优化步，满批量时每步 {ss} 秒",
    pre: "预训练 {d} 天",
    ext: "上下文扩展 {d} 天",
    post: "后训练 {d} 天",
    release: "发布",
    serving: "服务期，权重固定，间隔未按比例",
    thisTask: "这项任务",
    taskT: "发布后的一项智能体任务（示意轨迹）",
    elapsed: "已进行 {e} / {d} 秒",
    prefill: "预填充",
    decode: "解码，每步一个词元",
    tool: "工具动作",
    read: "读取文件", test: "运行测试", inspect: "查看失败", edit: "修改代码", retest: "运行测试",
    callT: "第 {k} 次调用（共 {n} 次）：预填充 {i} 个输入词元，再逐步解码",
    callDone: "第 {k} 次调用（共 {n} 次）已结束；运行时正在执行「{a}」，耗时 {s} 秒",
    callEnd: "第 {k} 次调用是最后一次，写出了说明；任务完成",
    tokens: "输出 {e} / {o} 个词元，{tt} 秒",
    tickEvery: "每 {n} 个词元一道刻线",
    ctxT: "下一个解码步读取的上下文：{c} 个词元",
    ctxTool: "观测结果返回之前的上下文：{c} 个词元",
    ctxEnd: "任务结束时的上下文：{c} 个词元",
    ctxPrompt: "请求与指令",
    ctxOut: "模型输出",
    ctxObs: "工具观测",
    ctxNow: "本次调用已生成",
    rulerT: "同一对数时间轴上的时长",
    rStep: "解码一步 {v}",
    rCall: "第 {k} 次调用 {v}",
    rTask: "这项任务 {v}",
    rTrainStep: "训练一步 {v}",
    rTrainRun: "整个训练 {v}",
    uToken: "每个词元",
    uCall: "每次调用",
    uTask: "每项任务",
    uVersion: "每个模型版本",
    vToken: "每个解码步 {ms} 毫秒（{sp} 词元/秒）；按报告的解码吞吐量折合 {g} GPU 毫秒",
    vCall: "第 {k} 次调用：输入 {i} 个词元，输出 {e} / {o} 个词元，{s} / {d} 秒",
    vTask: "调用 {c} / {n} 次，工具动作 {tl} / {m} 次；目前读取 {i} 个输入词元、生成 {o} 个输出词元，折合 {g} GPU 秒",
    vVersion: "{h} GPU 小时：相当于约 {n} 项同类任务的 GPU 时间，或报告中服务集群 {f} 天的用量",
    aAskRead: "请求读取文件", aAskTest: "请求运行测试", aAskInspect: "请求查看失败原因",
    aWriteEdit: "写出修改", aAskRetest: "请求再次运行测试", aExplain: "写出说明",
    kCall: "第 {k} 次调用预填充 {i} 个词元，然后{a}",
    kTool: "运行时执行「{a}」，耗时 {s} 秒，返回 {o} 个观测词元",
    kDone: "任务完成：{n} 次调用、{m} 次工具动作，输入 {i} 个词元，输出 {o} 个词元",
    describe: "在一项 {d} 秒的智能体任务进行到 {e} 秒时，{state}任务已用去 {c} / {n} 次模型调用和 {tl} / {m} 次工具动作，读取 {i} 个输入词元，生成 {o} 个输出词元；它所用的权重在发布时就已固定，此前的训练持续了 {tr} 天。",
    sPrefill: "第 {k} 次调用正在预填充 {i} 个输入词元。",
    sDecode: "第 {k} 次调用以每秒 {sp} 个词元解码，已生成 {e} / {o} 个词元，下一步读取 {c} 个词元。",
    sTool: "运行时正在执行「{a}」，模型处于等待状态。",
    sDone: "最后一次调用已经写出说明。",
    s: "秒", d: "天", ms: "毫秒",
  },
};
type L = typeof labels.en;

const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const secs = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, ""));
const actionOf = (L: L, k: number) => L[`a${CALLS[k][0].toUpperCase()}${CALLS[k].slice(1)}` as keyof L];

// A readable duration for the ruler labels.
function dur(v: number, L: L): string {
  if (v < 1) return `${sig(v * 1000, 2)} ${L.ms}`;
  if (v < 3600) return `${sig(v, v < 10 ? 2 : 3)} ${L.s}`;
  return `${sig(v / 86400, 2)} ${L.d}`;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const pl = plan(st.p);
  const t = Math.min(Math.max(st.t, 0), pl.end);
  const s = now(pl, t);
  const k = s.call.k + 1;
  const state = s.phase === "prefill" ? tpl(L.sPrefill, { k, i: n0(s.call.nIn) })
    : s.phase === "decode" ? tpl(L.sDecode, { k, e: s.emitted, o: s.call.nOut, sp: sig(st.p.speed, 3), c: n0(s.context) })
      : s.phase === "tool" ? tpl(L.sTool, { a: L[TOOLS[s.tool!.k]] })
        : L.sDone;
  return tpl(L.describe, {
    e: secs(t), d: secs(pl.end), state: lang === "en" ? `${state} ` : state,
    c: s.calls, n: pl.calls.length, tl: s.toolsDone, m: pl.tools.length,
    i: n0(s.input), o: n0(s.output), tr: sig(TRAIN.days.total, 3),
  });
}

// Draw the elapsed part of a span solid and the rest faint, so the bar shows
// the whole trace and how far it has run.
function span(x: (v: number) => number, t0: number, t1: number, t: number, y: number, h: number, fill: string, opacity: number): string {
  const out: string[] = [];
  const w = Math.max(1, x(t1) - x(t0));
  out.push(el("rect", { x: x(t0), y, width: w, height: h, fill, "fill-opacity": opacity * 0.22 }));
  if (t > t0) out.push(el("rect", { x: x(t0), y, width: Math.max(1, x(Math.min(t, t1)) - x(t0)), height: h, fill, "fill-opacity": opacity }));
  return out.join("");
}

// A zoom: two edges from a span on the upper bar to the full width below.
function zoom(x0: number, x1: number, yTop: number, yBot: number, w: number): string {
  return el("path", { d: `M${x0},${yTop}L0,${yBot}H${w}L${x1},${yTop}Z`, fill: C.ink3, "fill-opacity": 0.08, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 2" });
}

// Labels for marks on one baseline, stacked in tiers above it. Marks are
// taken from right to left and each label, preferably extending to the right
// of its mark, takes the lowest tier where it overlaps no other label, covers
// no mark still to be labeled, its leader crosses no label in a lower tier,
// and no higher label's leader crosses it. Returns markup relative to the baseline at y = 0 and the height
// the tiers use.
function tierLabels(items: Array<{ x: number; text: string }>, w: number, size: number, sep: string): { svg: string; height: number } {
  const step = size + 7;
  // Marks closer than 10 px share one label, with the leader at their middle.
  const merged: Array<{ x: number; text: string }> = [];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const last = merged[merged.length - 1];
    if (last && it.x - last.x < 10) { last.text += sep + it.text; last.x = (last.x + it.x) / 2; } else merged.push({ ...it });
  }
  type Placed = { x: number; tier: number; box: Box; tx: number; anchor: "start" | "middle" | "end"; text: string };
  const placed: Placed[] = [];
  const order = [...merged].reverse();
  for (const [idx, it] of order.entries()) {
    const tw = textWidth(it.text, size);
    // Marks still to be labeled lie to the left; a box over one of them
    // would leave its leader nowhere to go.
    const pending = order.slice(idx + 1).map((o) => o.x);
    let done: Placed | null = null;
    for (let tier = 0; tier < 8 && !done; tier++) {
      const base = -12 - tier * step;
      for (const anchor of ["start", "middle", "end"] as const) {
        let x0 = anchor === "middle" ? it.x - tw / 2 : anchor === "start" ? it.x - 6 : it.x + 6 - tw;
        x0 = Math.min(Math.max(x0, 0), w - tw);
        if (it.x < x0 - 1 || it.x > x0 + tw + 1) continue;
        const box: Box = { x0, y0: base - size * 0.8, x1: x0 + tw, y1: base + size * 0.25 };
        const clash = pending.some((px) => px >= box.x0 - 3 && px <= box.x1 + 3) || placed.some((q) =>
          (q.tier === tier && q.box.x0 < box.x1 + 8 && box.x0 < q.box.x1 + 8)
          || (q.tier < tier && it.x >= q.box.x0 - 3 && it.x <= q.box.x1 + 3)
          || (q.tier > tier && q.x >= box.x0 - 3 && q.x <= box.x1 + 3));
        if (!clash) { done = { x: it.x, tier, box, tx: x0, anchor: "start", text: it.text }; break; }
      }
    }
    if (done) placed.push(done);
  }
  const out: string[] = [];
  let top = 0;
  for (const q of placed) {
    out.push(el("line", { x1: q.x, x2: q.x, y1: -6, y2: q.box.y1 + 1, stroke: C.ink3, "stroke-width": 1 }));
    out.push(text(q.tx, q.box.y1 - size * 0.25, q.text, { "font-size": size }));
    top = Math.min(top, q.box.y0);
  }
  return { svg: out.join(""), height: -top };
}

function lines(s: string, size: number, maxW: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCJK(s, size, maxW) : wrap(s, size, maxW);
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const pl = plan(p);
  const t = Math.min(Math.max(st.t, 0), pl.end);
  const s = now(pl, t);
  const parts: string[] = [];
  let y = 0;
  const title = (str: string, yy: number, size: number = TYPE.label) => {
    const ls = lines(str, size, w, lang);
    ls.forEach((ln, i) => parts.push(text(0, yy + size + i * (size + 5), ln, { "font-size": size, class: "fig-t-strong" })));
    return ls.length * (size + 5);
  };
  const note = (str: string, yy: number, x0 = 0, maxW = w, cls = "fig-t-muted") => {
    const ls = lines(str, fs, maxW, lang);
    ls.forEach((ln, i) => parts.push(text(x0, yy + fs + i * (fs + 5), ln, { "font-size": fs, class: cls })));
    return ls.length * (fs + 5);
  };

  // ---- the training run and the release it ends in
  y += title(L.trainT, y) + 2;
  y += note(tpl(L.trainNote, { d: sig(TRAIN.days.total, 3), g: n0(TRAIN.gpus), h: `${sig(TRAIN.gpuHours.total / 1e6, 4)}M`, s: sig(TRAIN.steps, 3), ss: sig(TRAIN.stepSeconds, 2) }), y) + 4;
  const lgT = legend([
    { label: tpl(L.pre, { d: sig(TRAIN.days.pre, 3) }), swatch: { kind: "rect", fill: C.c3 } },
    { label: tpl(L.ext, { d: sig(TRAIN.days.ext, 2) }), swatch: { kind: "rect", fill: C.c3, opacity: 0.55 } },
    { label: tpl(L.post, { d: sig(TRAIN.days.post, 1) }), swatch: { kind: "rect", fill: C.c3, opacity: 0.25 } },
    { label: L.serving, swatch: { kind: "line", stroke: C.ink3, dash: "4 3" } },
  ], 0, y, w, fs);
  parts.push(lgT.svg);
  y += lgT.height + 6;
  const xr = Math.round(w * (narrow ? 0.6 : 0.66)); // the release, where training ends
  const trainX = (d: number) => (d / TRAIN.days.total) * xr;
  const xt = xr + (w - xr) * 0.5; // one task, some time into serving
  // Labels over the bar: the release at its tick, and the task being zoomed.
  const clampMid = (x: number, s: string) => Math.min(Math.max(x, textWidth(s, fs) / 2), w - textWidth(s, fs) / 2);
  parts.push(text(clampMid(xr, L.release), y + fs, L.release, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
  parts.push(text(clampMid(xt, L.thisTask), y + fs, L.thisTask, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  y += fs + 8;
  const barA = y, hA = 16;
  let d0 = 0;
  for (const [d, op] of [[TRAIN.days.pre, 1], [TRAIN.days.ext, 0.55], [TRAIN.days.post, 0.25]] as const) {
    parts.push(el("rect", { x: trainX(d0), y: barA, width: Math.max(1.5, trainX(d0 + d) - trainX(d0)), height: hA, fill: C.c3, "fill-opacity": op }));
    d0 += d;
  }
  parts.push(el("line", { x1: xr, x2: xr, y1: barA - 5, y2: barA + hA + 3, stroke: C.ink, "stroke-width": 1.5 }));
  parts.push(el("line", { x1: xr + 3, x2: w, y1: barA + hA / 2, y2: barA + hA / 2, stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  parts.push(el("line", { x1: xt, x2: xt, y1: barA + 2, y2: barA + hA - 2, stroke: C.ink, "stroke-width": 2 }));
  y = barA + hA;

  // ---- the task, zoomed out of one instant of serving
  const fanA = y + 26;
  parts.push(zoom(xt - 1, xt + 1, y, fanA, w));
  y = fanA + 8;
  {
    const el0 = tpl(L.elapsed, { e: secs(t), d: secs(pl.end) });
    const tw = textWidth(L.taskT, TYPE.label);
    if (tw + textWidth(el0, TYPE.body) + 16 <= w) {
      parts.push(text(w, y + TYPE.label, el0, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-num" }));
      y += title(L.taskT, y) + 2;
    } else {
      y += title(L.taskT, y);
      y += note(el0, y, 0, w, "fig-t-num") + 2;
    }
  }
  const lgB = legend([
    { label: L.prefill, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.decode, swatch: { kind: "rect", fill: C.c1, opacity: 0.45 } },
    { label: L.tool, swatch: { kind: "rect", fill: C.c2 } },
  ], 0, y, w, fs);
  parts.push(lgB.svg);
  y += lgB.height + 4;
  const bx = (v: number) => (v / pl.end) * w;
  // Tool names above the bar, placed so they never collide; each call's
  // number sits inside its segment when the segment is wide enough.
  // Placed against a bar at y = 0, then moved down by the height they use.
  const reqs = pl.tools.map((tl) => ({
    x: (bx(tl.t0) + bx(tl.t1)) / 2, y: -2, text: L[TOOLS[tl.k]], size: fs,
    sides: ["above" as const, "above-left" as const, "above-right" as const], gap: 6, priority: tl.t1 - tl.t0,
    attrs: { class: s.tool?.k === tl.k ? "fig-t-strong" : "fig-t-muted" },
  }));
  const placed = placeLabels(reqs, { x0: 0, y0: -((fs + 10) * 2 + 6), x1: w, y1: -1 }, []);
  const used = placed.placed.length ? 2 - Math.min(...placed.placed.map((pp) => pp.box.y0)) : 0;
  const barB = y + Math.max(used, fs + 8) + 2, hB = 20;
  parts.push(g({ transform: `translate(0 ${barB})` }, drawLabels(placed.placed)));
  for (const c of pl.calls) {
    parts.push(span(bx, c.t0, c.tDec, t, barB, hB, C.c1, 1));
    parts.push(span(bx, c.tDec, c.t1, t, barB, hB, C.c1, 0.45));
    // The call number at the segment's start, or at its end when the cursor
    // is on the start; dropped when the segment has room for neither.
    const x0 = bx(c.t0), x1 = bx(c.t1), xc = bx(t);
    if (x1 - x0 >= 14) {
      const atStart = !(xc >= x0 && xc <= x0 + 16);
      if (atStart || x1 - x0 >= 32) parts.push(text(atStart ? x0 + 4 : x1 - 4, barB + hB / 2 + 4, c.k + 1, { "font-size": fs, "text-anchor": atStart ? "start" : "end", class: "fig-t-halo fig-t-num" }));
    }
  }
  for (const tl of pl.tools) parts.push(span(bx, tl.t0, tl.t1, t, barB, hB, C.c2, 1));
  const cur = s.call;
  parts.push(el("rect", { x: bx(cur.t0) - 0.5, y: barB - 0.5, width: Math.max(2, bx(cur.t1) - bx(cur.t0)) + 1, height: hB + 1, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));
  parts.push(el("line", { x1: bx(t), x2: bx(t), y1: barB - 5, y2: barB + hB + 5, stroke: C.ink, "stroke-width": 2 }));
  y = barB + hB;

  // ---- the current call, zoomed out of the task
  const fanB = y + 22;
  parts.push(zoom(bx(cur.t0), bx(cur.t1), y + 5, fanB, w));
  y = fanB + 8;
  const n = pl.calls.length;
  const head = s.phase === "tool" ? tpl(L.callDone, { k: cur.k + 1, n, a: L[TOOLS[s.tool!.k]], s: secs(s.tool!.t1 - s.tool!.t0) })
    : s.phase === "done" ? tpl(L.callEnd, { k: cur.k + 1, n })
      : tpl(L.callT, { k: cur.k + 1, n, i: n0(cur.nIn) });
  y += title(head, y) + 2;
  const callDur = cur.t1 - cur.t0;
  const tc = Math.min(Math.max(t, cur.t0), cur.t1);
  y += note(tpl(L.tokens, { e: s.emitted, o: cur.nOut, tt: `${secs(tc - cur.t0)} / ${secs(callDur)}` }), y, 0, w, "fig-t-num") + 4;
  const cx = (v: number) => ((v - cur.t0) / callDur) * w;
  const barC = y, hC = 20;
  parts.push(span(cx, cur.t0, cur.tDec, tc, barC, hC, C.c1, 1));
  parts.push(span(cx, cur.tDec, cur.t1, tc, barC, hC, C.c1, 0.45));
  // One tick per emitted token, thinned to every tenth token when ticks would
  // be closer than 2.5 px.
  const pitch = (cx(cur.t1) - cx(cur.tDec)) / cur.nOut;
  const every = pitch >= 2.5 ? 1 : pitch * 5 >= 2.5 ? 5 : 10;
  const ticks: string[] = [];
  for (let j = every; j <= s.emitted; j += every) {
    const xx = cx(cur.tDec + j / p.speed);
    ticks.push(`M${xx.toFixed(1)},${barC + 3}V${barC + hC - 3}`);
  }
  if (ticks.length) parts.push(el("path", { d: ticks.join(""), stroke: C.paper, "stroke-width": 1 }));
  parts.push(el("line", { x1: cx(tc), x2: cx(tc), y1: barC - 5, y2: barC + hC + 5, stroke: C.ink, "stroke-width": 2 }));
  y = barC + hC + 6;
  if (every > 1) y += note(tpl(L.tickEvery, { n: every }), y, 0, w, "fig-t-faint");

  // The context the next step reads: the request, every earlier output and
  // observation, and what this call has generated so far.
  y += 10;
  y += title(tpl(s.phase === "tool" ? L.ctxTool : s.phase === "done" ? L.ctxEnd : L.ctxT, { c: n0(s.context) }), y, TYPE.body) + 2;
  const kx = (v: number) => (v / pl.final) * w;
  let acc = 0;
  const hD = 14;
  parts.push(el("rect", { x: 0, y, width: w, height: hD, fill: C.panel }));
  for (const sg of s.segs) {
    if (sg.n <= 0) continue;
    const fill = sg.kind === "prompt" ? C.ink3 : sg.kind === "obs" ? C.c2 : C.c1;
    const op = sg.kind === "prompt" ? 0.45 : sg.kind === "now" ? 1 : 0.55;
    parts.push(el("rect", { x: kx(acc), y, width: Math.max(0.8, kx(acc + sg.n) - kx(acc) - 0.6), height: hD, fill, "fill-opacity": op }));
    acc += sg.n;
  }
  y += hD + 6;
  const lgD = legend([
    { label: L.ctxPrompt, swatch: { kind: "rect", fill: C.ink3, opacity: 0.45 } },
    { label: L.ctxOut, swatch: { kind: "rect", fill: C.c1, opacity: 0.55 } },
    { label: L.ctxObs, swatch: { kind: "rect", fill: C.c2, opacity: 0.55 } },
    { label: L.ctxNow, swatch: { kind: "rect", fill: C.c1 } },
  ], 0, y, w, fs);
  parts.push(lgD.svg);
  y += lgD.height + 16;

  // ---- every unit on one log time axis
  y += title(L.rulerT, y) + 4;
  const rx = log([0.01, 1.2e7], [textWidth(lang === "zh" ? "10 毫秒" : "10 ms", fs) / 2 + 2, w - (narrow ? 8 : 12)]);
  const marks = [
    { v: 1 / p.speed, label: tpl(L.rStep, { v: dur(1 / p.speed, L) }), fill: C.c1, hollow: false },
    { v: callDur, label: tpl(L.rCall, { k: cur.k + 1, v: dur(callDur, L) }), fill: C.c1, hollow: true },
    { v: pl.end, label: tpl(L.rTask, { v: dur(pl.end, L) }), fill: C.ink, hollow: false },
    { v: TRAIN.stepSeconds, label: tpl(L.rTrainStep, { v: dur(TRAIN.stepSeconds, L) }), fill: C.c3, hollow: true },
    { v: TRAIN.days.total * 86400, label: tpl(L.rTrainRun, { v: dur(TRAIN.days.total * 86400, L) }), fill: C.c3, hollow: false },
  ];
  const rl = tierLabels(marks.map((m) => ({ x: rx(m.v), text: m.label })), w, fs, lang === "zh" ? "；" : "; ");
  const baseY = y + rl.height + 6;
  parts.push(axis({
    scale: rx, orient: "bottom", at: baseY + 8, size: fs,
    ticks: [0.01, 1, 60, 3600, 86400, 30 * 86400],
    format: (v) => (lang === "zh"
      ? ({ 0.01: "10 毫秒", 1: "1 秒", 60: "1 分钟", 3600: "1 小时", 86400: "1 天", 2592000: "30 天" } as Record<number, string>)[v]
      : ({ 0.01: "10 ms", 1: "1 s", 60: "1 min", 3600: "1 h", 86400: "1 day", 2592000: "30 days" } as Record<number, string>)[v]) ?? "",
  }));
  parts.push(g({ transform: `translate(0 ${baseY})` }, rl.svg));
  for (const m of marks) {
    parts.push(el("circle", { cx: rx(m.v), cy: baseY, r: 4.5, fill: m.hollow ? C.paper : m.fill, stroke: m.fill, "stroke-width": 2 }));
  }
  y = baseY + 8 + axisHeight(false, fs) + 12;

  // ---- the accounting units
  const gpuNow = gpuSeconds(s.input, s.output);
  const perTask = gpuSeconds(pl.inTotal, pl.outTotal);
  const rows: Array<[string, string]> = [
    [L.uToken, tpl(L.vToken, { ms: sig(1000 / p.speed, 2), sp: sig(p.speed, 3), g: sig(SERVE.gpuSecondsPerOutput * 1000, 2) })],
    [L.uCall, tpl(L.vCall, { k: cur.k + 1, i: n0(cur.nIn), e: s.emitted, o: cur.nOut, s: secs(tc - cur.t0), d: secs(callDur) })],
    [L.uTask, tpl(L.vTask, { c: s.calls, n, tl: s.toolsDone, m: pl.tools.length, i: n0(s.input), o: n0(s.output), g: sig(gpuNow, 2) })],
    [L.uVersion, tpl(L.vVersion, { h: `${sig(TRAIN.gpuHours.total / 1e6, 4)}M`, n: lang === "zh" ? `${sig(TRAIN.gpuHours.total * 3600 / perTask / 1e8, 2)} 亿` : `${sig(TRAIN.gpuHours.total * 3600 / perTask / 1e9, 2)} billion`, f: sig(TRAIN.gpuHours.total / SERVE.fleetGpuHoursPerDay, 2) })],
  ];
  const nameW = narrow ? 0 : Math.max(...rows.map(([nm]) => textWidth(nm, TYPE.body))) + 14;
  const ro: string[] = [];
  for (const [nm, val] of rows) {
    ro.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    let yy = y + 5;
    if (narrow) { ro.push(text(0, yy + TYPE.body, nm, { "font-size": TYPE.body, class: "fig-t-strong" })); yy += TYPE.body + 5; } else ro.push(text(0, yy + TYPE.body, nm, { "font-size": TYPE.body, class: "fig-t-strong" }));
    const vl = lines(val, TYPE.body, (w - nameW) * 0.96, lang);
    vl.forEach((ln, i) => ro.push(text(nameW, yy + TYPE.body + i * (TYPE.body + 5), ln, { "font-size": TYPE.body, class: "fig-t-num" })));
    y = yy + vl.length * (TYPE.body + 5) + 4;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 2, describe(st, lang), ...parts);
}

// Keyframe positions rounded up to a tenth of a second, so the transport shows
// a short number and the state at the position is already the named event.
const at = (v: number) => Math.ceil(v * 10 - 1e-9) / 10;

function keyframes(p: P, lang: Lang) {
  const L = labels[lang];
  const pl = plan(p);
  const out: Array<{ t: number; label: string }> = [];
  for (const c of pl.calls) {
    out.push({ t: at(c.t0), label: tpl(L.kCall, { k: c.k + 1, i: n0(c.nIn), a: actionOf(L, c.k) }) });
    const tl = pl.tools[c.k];
    if (tl) out.push({ t: at(tl.t0), label: tpl(L.kTool, { a: L[TOOLS[tl.k]], s: secs(tl.t1 - tl.t0), o: n0(tl.nObs) }) });
  }
  out.push({ t: at(pl.end), label: tpl(L.kDone, { n: pl.calls.length, m: pl.tools.length, i: n0(pl.inTotal), o: n0(pl.outTotal) }) });
  return out;
}

export default defineFigure({
  name: "process-timescales",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    speed: {
      kind: "range", label: { en: "Decode speed per request", zh: "单个请求的解码速度" }, unit: { en: "tokens/s", zh: "词元/秒" },
      min: 5, max: 100, step: 1, default: SERVE.tokensPerSecond,
      marks: [{ value: SERVE.tokensPerSecond, label: { en: "DeepSeek average", zh: "DeepSeek 平均值" } }],
    },
    test: { kind: "range", label: { en: "Test-suite run time", zh: "测试运行时间" }, unit: { en: "s", zh: "秒" }, min: 2, max: 60, step: 1, default: 12 },
  },
  timeline: {
    rate: 6,
    discrete: false,
    duration: (p) => at(plan(p).end),
    keyframes,
    // Halfway through the edit: three observations are in the context, and
    // the call row shows prefill, emitted tokens, and the tokens still to come.
    poster: (p) => {
      const c = plan(p).calls[3];
      return at(c.tDec + (c.t1 - c.tDec) / 2);
    },
  },
  render,
  describe,
});
