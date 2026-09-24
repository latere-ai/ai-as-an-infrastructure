// An agent session under a bounded context window, with compaction.
//
// One scripted coding task runs for N model calls. Call t reads the pinned
// items (system prompt, tool definitions, the user's request), then either the
// raw turns so far or a compacted form of them, then the recent turns. Each
// turn appends the assistant's message, the tool result it asked for, and
// sometimes a user message. Before a call is sent, the assembler applies the
// chapter's admission check with a policy threshold:
//
//   compact when  T(X) + R > θ · W,   and never send  T(X) + R > W
//
// where T(X) is the serialized input, R the output reserve, W the window, and
// θ the threshold the reader sets. Every policy keeps the pinned items and the
// last TAIL turns verbatim (fewer if they do not fit) and replaces the older
// turns:
//
// - truncate:   older turns are dropped. Nothing in the window refers to them.
// - summary:    a prose summary replaces them. It keeps completed actions and
//               open requests, and loses exact values and negated
//               constraints (the qualifiers an abstractive summary can erase).
// - checkpoint: a structured checkpoint replaces them. It keeps constraints,
//               completed actions, and open requests, and holds a pointer to
//               the event-log entry for every turn it covers; an exact value is
//               re-fetched through that pointer when a later call needs it.
//
// The retention rule and every token count are illustrative, not measured.
//
// The prefix cache model: a provider cache holds the previous call's input,
// and a call reuses the longest item-for-item prefix it shares with that input.
// Appending turns keeps the whole previous input as a prefix; compaction
// rewrites everything after the pinned items, so that call prefills the
// retained turns again.
//
// State is a pure function of the parameters and the call index t: the whole
// session is simulated once per parameter set (memoized) and render reads
// snapshot t.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { placeLabels, drawLabels, lineObstacles, overlaps, textBox, textWidth, wrap, type Box } from "./lib/labels.ts";
import { sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- session

type Policy = "truncate" | "summary" | "checkpoint";
type Kind = "system" | "tools" | "summary" | "message" | "result";

const PINNED: Array<{ kind: Kind; tokens: number }> = [
  { kind: "system", tokens: 2400 },
  { kind: "tools", tokens: 8600 },
  { kind: "message", tokens: 350 }, // the user's request
];
const TAIL = 3; // recent turns every policy keeps verbatim
const SUMMARY_TOKENS: Record<Policy, number> = { truncate: 0, summary: 2400, checkpoint: 3200 };
const FETCH_TOKENS = 900; // the excerpt a checkpoint pointer re-reads from the log

// One turn: the assistant's message, the tool result it asked for, and an
// optional user message that arrived before it. `fact` marks the item that
// states a fact a later call needs.
interface Turn { user?: number; asst: number; result: number; fact?: { id: number; on: "user" | "result" } }
const TURNS: Turn[] = [
  { asst: 900, result: 9400, fact: { id: 0, on: "result" } }, //  1 run the test suite: the log states the expected total
  { asst: 700, result: 11500 }, //                                2 read checkout/totals.py
  { asst: 600, result: 6200 }, //                                 3 search for rounding helpers
  { asst: 800, result: 10100 }, //                                4 read payments/rounding.py
  { user: 260, asst: 500, result: 4700, fact: { id: 1, on: "user" } }, // 5 the user: do not edit payments/
  { asst: 700, result: 8200 }, //                                 6 read the test fixtures
  { asst: 600, result: 500, fact: { id: 2, on: "result" } }, //   7 create release ticket REL-88
  { asst: 900, result: 8600 }, //                                 8 read test_totals.py
  { user: 220, asst: 500, result: 6700, fact: { id: 3, on: "user" } }, // 9 the user: report on the changelog at the end
  { asst: 1200, result: 1100 }, //                               10 edit checkout/totals.py
  { asst: 700, result: 9700 }, //                                11 run the tests
  { asst: 1100, result: 700 }, //                                12 write the regression test (needs F1)
  { asst: 600, result: 9500 }, //                                13 run the tests
  { asst: 800, result: 11000 }, //                               14 read currency.py
  { asst: 700, result: 7300 }, //                                15 search the callers of round_half_even
  { asst: 1300, result: 800 }, //                                16 change the rounding code (needs F2)
  { asst: 700, result: 14200 }, //                               17 run the full suite
  { asst: 600, result: 5200 }, //                                18 read the lint output
  { asst: 800, result: 900 }, //                                 19 fix the lint findings
  { asst: 600, result: 9200 }, //                                20 run the tests
  { asst: 700, result: 10100 }, //                               21 read the diff
  { asst: 900, result: 800 }, //                                 22 commit and push the branch
  { asst: 800, result: 1100 }, //                                23 open the pull request, link the ticket (needs F3)
  { asst: 600, result: 7000 }, //                                24 read the CI status
  { asst: 1400, result: 0 }, //                                  25 write the final report (needs F4)
];
export const N = TURNS.length;

// The facts, in the chapter's categories of state a compaction can lose.
type FactKind = "value" | "negation" | "action" | "request";
interface Fact { kind: FactKind; at: number; need: number }
const FACTS: Fact[] = [
  { kind: "value", at: 1, need: 12 }, // F1 exact value from a tool result
  { kind: "negation", at: 5, need: 16 }, // F2 a constraint stated as a negation
  { kind: "action", at: 7, need: 23 }, // F3 an action already performed
  { kind: "request", at: 9, need: 25 }, // F4 an open request for later
];
const KEEPS: Record<Policy, Set<FactKind>> = {
  truncate: new Set(),
  summary: new Set(["action", "request"]),
  checkpoint: new Set(["negation", "action", "request"]),
};

interface Item { id: number; kind: Kind; tokens: number; turn: number; fact?: number }

// Fact state at a call. Before its need: where the fact is. At and after it:
// what the call that needed it found.
export type FactState = "future" | "window" | "held" | "pointer" | "log" | "used" | "fetched" | "lost";

interface Snap {
  items: Item[]; // the input of this call, in order
  T: number; // T(X)
  cached: number; // tokens reused from the prefix cache
  facts: FactState[];
  holds: number[]; // facts the summary or checkpoint carries at this call
  pointers: number[]; // facts reachable through a checkpoint pointer
  prefill: number; // cumulative tokens prefilled, with the prefix cache
  prefillNoCache: number; // cumulative tokens prefilled, without it
  log: number; // tokens in the durable event log
  compactions: number;
}

type Ev =
  | { t: number; kind: "intro"; fact: number }
  | { t: number; kind: "compact"; from: number; to: number; before: number; after: number }
  | { t: number; kind: "need"; fact: number; outcome: "used" | "fetched" | "lost"; where: "window" | "held" | "log" | "pointer" };

interface Run { snaps: Snap[]; events: Ev[] }

type P = { policy: Policy; threshold: number; window: number; reserve: number };

function simulate(p: P): Run {
  let nextId = 0;
  const pinned: Item[] = PINNED.map((x) => ({ id: nextId++, kind: x.kind, tokens: x.tokens, turn: 0 }));
  let summary: Item | null = null;
  let history: Item[] = [];
  const holds = new Set<number>();
  const pointers = new Set<number>();
  const outcome: Array<FactState | null> = FACTS.map(() => null);
  const where = new Map<number, number>(); // fact -> item id that states it
  const snaps: Snap[] = [];
  const events: Ev[] = [];
  let prev: Item[] = [];
  let prefill = 0, prefillNoCache = 0, log = 0, compactions = 0;
  const limit = (p.threshold / 100) * p.window;
  const size = (xs: Item[]) => xs.reduce((a, b) => a + b.tokens, 0);
  const input = () => [...pinned, ...(summary ? [summary] : []), ...history];

  const compact = (t: number) => {
    const turns = [...new Set(history.map((x) => x.turn))];
    let k = Math.min(TAIL, turns.length);
    const sTokens = SUMMARY_TOKENS[p.policy];
    const tailOf = (n: number) => history.filter((x) => turns.indexOf(x.turn) >= turns.length - n);
    while (k > 1 && size(pinned) + sTokens + size(tailOf(k)) + p.reserve > limit) k--;
    const tail = tailOf(k);
    const dropped = history.filter((x) => !tail.includes(x));
    if (!dropped.length) return;
    const before = size(input());
    const from = p.policy === "truncate" ? dropped[0].turn : 1;
    const to = dropped[dropped.length - 1].turn;
    for (const x of dropped) {
      if (x.fact == null) continue;
      if (KEEPS[p.policy].has(FACTS[x.fact].kind)) holds.add(x.fact);
      else if (p.policy === "checkpoint") pointers.add(x.fact);
    }
    history = tail;
    if (p.policy !== "truncate") summary = { id: nextId++, kind: "summary", tokens: sTokens, turn: 0 };
    compactions++;
    events.push({ t, kind: "compact", from, to, before, after: size(input()) });
  };

  const stateOf = (f: number): FactState => {
    if (outcome[f]) return outcome[f]!;
    const id = where.get(f);
    if (id == null) return "future";
    if (history.some((x) => x.id === id)) return "window";
    if (holds.has(f)) return "held";
    if (pointers.has(f)) return "pointer";
    return "log";
  };

  for (let t = 0; t <= N; t++) {
    if (t > 0) {
      const turn = TURNS[t - 1];
      const add = (kind: Kind, tokens: number, fact?: number) => {
        const it: Item = { id: nextId++, kind, tokens, turn: t, fact };
        if (fact != null) where.set(fact, it.id);
        history.push(it);
        log += tokens;
      };
      if (turn.user) add("message", turn.user, turn.fact?.on === "user" ? turn.fact.id : undefined);
      add("message", turn.asst);
      if (turn.result) add("result", turn.result, turn.fact?.on === "result" ? turn.fact.id : undefined);
      if (turn.fact) events.push({ t, kind: "intro", fact: turn.fact.id });
    }
    if (size(input()) + p.reserve > limit) compact(t);
    // Facts this call needs, looked up in the assembled input.
    FACTS.forEach((f, i) => {
      if (f.need !== t) return;
      const s = stateOf(i);
      if (s === "window" || s === "held") {
        outcome[i] = "used";
        events.push({ t, kind: "need", fact: i, outcome: "used", where: s });
      } else if (s === "pointer") {
        const it: Item = { id: nextId++, kind: "result", tokens: FETCH_TOKENS, turn: t, fact: i };
        history.push(it);
        log += FETCH_TOKENS;
        outcome[i] = "fetched";
        events.push({ t, kind: "need", fact: i, outcome: "fetched", where: "pointer" });
      } else {
        outcome[i] = "lost";
        events.push({ t, kind: "need", fact: i, outcome: "lost", where: "log" });
      }
    });
    // A re-fetched excerpt may not push the call past the window itself.
    if (size(input()) + p.reserve > p.window) compact(t);
    const items = input();
    const T = size(items);
    let cached = 0;
    for (let i = 0; i < Math.min(prev.length, items.length) && prev[i].id === items[i].id; i++) cached += items[i].tokens;
    prefill += T - cached;
    prefillNoCache += T;
    snaps.push({
      items, T, cached, facts: FACTS.map((_, i) => stateOf(i)), holds: [...holds], pointers: [...pointers],
      prefill, prefillNoCache, log, compactions,
    });
    prev = items;
  }
  return { snaps, events };
}

const memo = new Map<string, Run>();
export function run(p: P): Run {
  const key = `${p.policy}|${p.threshold}|${p.window}|${p.reserve}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = simulate(p);
    if (memo.size > 48) memo.clear();
    memo.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "An agent session under a bounded context window",
    chart: "Input of each model call",
    call: "model call",
    tokens: "tokens",
    system: "system prompt",
    tools: "tool definitions",
    summary: "summary",
    checkpoint: "checkpoint",
    message: "messages",
    result: "tool results",
    cacheHit: "faded: reused from the prefix cache",
    reserve: "output reserve R",
    compaction: "compaction",
    wLine: "W {v}",
    thLine: "θ·W {v}",
    logLine: "event log {v}",
    logName: "event log",
    facts: "Four facts later calls need",
    f0: "F1 exact value: expected total 104.50",
    f1: "F2 constraint: do not edit payments/",
    f2: "F3 action taken: ticket REL-88 exists",
    f3: "F4 open request: report on the changelog",
    sFuture: "stated at call {a}, needed at call {n}",
    sWindow: "in the window, needed at call {n}",
    sHeld: "in the {s}, needed at call {n}",
    sPointer: "pointer in the checkpoint, needed at call {n}",
    sLog: "only in the event log, needed at call {n}",
    sUsed: "used at call {n}",
    sFetched: "re-fetched from the log at call {n}",
    sLost: "lost at call {n}: {c}",
    lWindow: "in the window",
    lHeld: "in the {s}",
    lPointer: "pointer in the checkpoint",
    lLog: "only in the event log",
    c0: "the test asserts a guessed total",
    c1: "the agent edits the frozen module",
    c2: "the agent opens a second ticket",
    c3: "the report skips the question",
    input: "What the model reads at call {t}",
    hit: "cache {v}",
    fresh: "prefilled {v}",
    rT: "T(X) + R",
    rTv: "{a} + {b} = {c} of {w}",
    rLimit: "compaction fires above θ·W",
    rCached: "reused from the prefix cache",
    rFresh: "prefilled at this call",
    rSum: "prefill so far, with cache",
    rSumNo: "prefill so far, without cache",
    rLog: "durable event log",
    rCompactions: "compactions so far",
    kIntro0: "the test log states the expected total, 104.50 (F1)",
    kIntro1: "the user says not to edit payments/ (F2)",
    kIntro2: "the agent creates release ticket REL-88 (F3)",
    kIntro3: "the user asks for a changelog verdict at the end (F4)",
    kTruncate: "turns {a} to {b} dropped, {x} to {y} tokens",
    kSummary: "a summary replaces turns {a} to {b}, {x} to {y} tokens",
    kCheckpoint: "a checkpoint replaces turns {a} to {b}, {x} to {y} tokens",
    kNeed0: "writing the regression test needs F1",
    kNeed1: "changing the rounding code needs F2",
    kNeed2: "linking the pull request to its ticket needs F3",
    kNeed3: "the final report needs F4",
    kUsedWindow: "{n}: found in the window",
    kUsedHeld: "{n}: found in the {s}",
    kFetched: "{n}: re-fetched from the event log, +{v} tokens",
    kLost: "{n}: lost, {c}",
    describe: "Call {t} of {d}, {policy}: the input is {T} tokens with an output reserve of {R} in a {W} window, and {c} of the input is reused from the prefix cache; {k:compaction/compactions} so far. {facts}.",
    dTruncate: "dropping old turns",
    dSummary: "prose summary",
    dCheckpoint: "checkpoint with pointers",
    dFact: "F{i} {s}",
    dFuture: "not yet stated",
    dUsed: "used",
    dFetched: "re-fetched",
    dLost: "lost",
  },
  zh: {
    title: "有界上下文窗口中的一次智能体会话",
    chart: "每次模型调用的输入",
    call: "模型调用",
    tokens: "词元",
    system: "系统提示",
    tools: "工具定义",
    summary: "摘要",
    checkpoint: "检查点",
    message: "消息",
    result: "工具结果",
    cacheHit: "半透明：前缀缓存复用的部分",
    reserve: "输出预留 R",
    compaction: "压缩",
    wLine: "W {v}",
    thLine: "θ·W {v}",
    logLine: "事件日志 {v}",
    logName: "事件日志",
    facts: "后续调用要用到的四项事实",
    f0: "F1 精确值：预期总额 104.50",
    f1: "F2 约束：不要修改 payments/",
    f2: "F3 已执行的操作：已创建工单 REL-88",
    f3: "F4 待办请求：最后说明变更日志",
    sFuture: "第 {a} 次调用出现，第 {n} 次调用需要",
    sWindow: "在窗口中，第 {n} 次调用需要",
    sHeld: "在{s}中，第 {n} 次调用需要",
    sPointer: "检查点中留有指针，第 {n} 次调用需要",
    sLog: "只在事件日志中，第 {n} 次调用需要",
    sUsed: "第 {n} 次调用已使用",
    sFetched: "第 {n} 次调用从日志重新取回",
    sLost: "第 {n} 次调用时丢失：{c}",
    lWindow: "在窗口中",
    lHeld: "在{s}中",
    lPointer: "检查点中的指针",
    lLog: "只在事件日志中",
    c0: "测试断言了猜测的总额",
    c1: "智能体修改了冻结的模块",
    c2: "智能体又开了一张工单",
    c3: "报告漏掉了这个问题",
    input: "第 {t} 次调用时模型读到的内容",
    hit: "缓存 {v}",
    fresh: "预填充 {v}",
    rT: "T(X) + R",
    rTv: "{a} + {b} = {c}，窗口 {w}",
    rLimit: "超过 θ·W 时压缩",
    rCached: "前缀缓存复用",
    rFresh: "本次调用预填充",
    rSum: "累计预填充（有缓存）",
    rSumNo: "累计预填充（无缓存）",
    rLog: "持久事件日志",
    rCompactions: "已压缩次数",
    kIntro0: "测试日志给出预期总额 104.50（F1）",
    kIntro1: "用户要求不要修改 payments/（F2）",
    kIntro2: "智能体创建发布工单 REL-88（F3）",
    kIntro3: "用户要求最后说明是否需要更新变更日志（F4）",
    kTruncate: "丢弃第 {a} 到第 {b} 回合，{x} 降到 {y} 个词元",
    kSummary: "摘要替换第 {a} 到第 {b} 回合，{x} 降到 {y} 个词元",
    kCheckpoint: "检查点替换第 {a} 到第 {b} 回合，{x} 降到 {y} 个词元",
    kNeed0: "编写回归测试需要 F1",
    kNeed1: "修改舍入代码需要 F2",
    kNeed2: "把拉取请求关联到工单需要 F3",
    kNeed3: "最终报告需要 F4",
    kUsedWindow: "{n}：在窗口中找到",
    kUsedHeld: "{n}：在{s}中找到",
    kFetched: "{n}：从事件日志重新取回，增加 {v} 个词元",
    kLost: "{n}：已丢失，{c}",
    describe: "第 {t} 次调用（共 {d} 次），{policy}：输入 {T} 个词元，另有 {R} 输出预留，窗口 {W}，其中 {c} 来自前缀缓存；已压缩 {k} 次。{facts}。",
    dTruncate: "丢弃旧回合",
    dSummary: "文字摘要",
    dCheckpoint: "带指针的检查点",
    dFact: "F{i} {s}",
    dFuture: "尚未出现",
    dUsed: "已使用",
    dFetched: "已重新取回",
    dLost: "已丢失",
  },
};

type L = typeof labels.en;

// Color by what an item is; the cached part of a bar is drawn faded.
const KIND_COLOR: Record<Kind, string> = { result: C.c1, message: C.c2, system: C.c3, tools: C.c4, summary: C.c5 };
const CACHED_OPACITY = 0.36;

export function fmtTok(v: number): string {
  if (v >= 1e6) return `${sig(v / 1e6, 3)}M`;
  if (v >= 1000) return `${sig(v / 1000, 3)}K`;
  return String(Math.round(v));
}

// Runs of one input in reading order: consecutive items of one kind are
// merged, and a run is split where the cached prefix ends.
function segments(items: Item[], cached: number): Array<{ kind: Kind; a: number; b: number; hit: boolean }> {
  const out: Array<{ kind: Kind; a: number; b: number; hit: boolean }> = [];
  let pos = 0;
  for (const it of items) {
    const a = pos, b = pos + it.tokens;
    pos = b;
    const pieces: Array<[number, number, boolean]> = cached > a && cached < b ? [[a, cached, true], [cached, b, false]] : [[a, b, b <= cached]];
    for (const [x0, x1, hit] of pieces) {
      const last = out[out.length - 1];
      if (last && last.kind === it.kind && last.hit === hit && last.b === x0) last.b = x1;
      else out.push({ kind: it.kind, a: x0, b: x1, hit });
    }
  }
  return out;
}

const holdName = (p: P, L: L) => (p.policy === "checkpoint" ? L.checkpoint : L.summary);

function status(p: P, r: Run, t: number, i: number, L: L): string {
  const f = FACTS[i];
  const n = f.need;
  switch (r.snaps[t].facts[i]) {
    case "future": return tpl(L.sFuture, { a: f.at, n });
    case "window": return tpl(L.sWindow, { n });
    case "held": return tpl(L.sHeld, { s: holdName(p, L), n });
    case "pointer": return tpl(L.sPointer, { n });
    case "log": return tpl(L.sLog, { n });
    case "used": return tpl(L.sUsed, { n });
    case "fetched": return tpl(L.sFetched, { n });
    case "lost": return tpl(L.sLost, { n, c: L[`c${i}` as "c0"] });
  }
}

function evLabel(e: Ev, p: P, L: L): string {
  if (e.kind === "intro") return L[`kIntro${e.fact}` as "kIntro0"];
  if (e.kind === "compact") {
    const k = p.policy === "truncate" ? L.kTruncate : p.policy === "summary" ? L.kSummary : L.kCheckpoint;
    return tpl(k, { a: e.from, b: e.to, x: fmtTok(e.before), y: fmtTok(e.after) });
  }
  const n = L[`kNeed${e.fact}` as "kNeed0"];
  if (e.outcome === "lost") return tpl(L.kLost, { n, c: L[`c${e.fact}` as "c0"] });
  if (e.outcome === "fetched") return tpl(L.kFetched, { n, v: FETCH_TOKENS });
  return e.where === "window" ? tpl(L.kUsedWindow, { n }) : tpl(L.kUsedHeld, { n, s: holdName(p, L) });
}

function renderChart(p: P, t: number, w: number, r: Run, L: L, uid: string, y0: number) {
  const narrow = w < 480;
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, L.chart, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.system, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.tools, swatch: { kind: "rect", fill: C.c4 } },
    ...(p.policy !== "truncate" ? [{ label: holdName(p, L), swatch: { kind: "rect" as const, fill: C.c5 } }] : []),
    { label: L.message, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.result, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.cacheHit, swatch: { kind: "rect", fill: C.c1, opacity: CACHED_OPACITY } },
    { label: L.reserve, swatch: { kind: "rect", fill: C.ink3, pattern: `${uid}-hatch` } },
    { label: L.compaction, swatch: { kind: "line", stroke: C.ink3, dash: "3 3" } },
  ], 0, y0 + 22, w, TYPE.body);
  parts.push(lg.svg);
  const top = y0 + 22 + lg.height + 26;
  const plotH = narrow ? 170 : 210;
  const bottom = top + plotH;
  const left = 40, right = 6;
  const x = linear([-0.7, N + 0.7], [left, w - right]);
  const bw = Math.max(3, Math.min(16, (x(1) - x(0)) * 0.7));
  const yMax = Math.max(p.window, r.snaps[N].log) * 1.06;
  const y = linear([0, yMax], [bottom, top]);
  parts.push(axis({ scale: y, orient: "left", at: left, ticks: y.ticks(narrow ? 4 : 5).filter((v) => v <= yMax), grid: [left, w - right], title: L.tokens, format: fmtTok, size: TYPE.body }));
  const obstacles: Box[] = [];

  // Bars: each call's input in reading order, cached prefix faded.
  for (let c = 0; c <= t; c++) {
    const s = r.snaps[c];
    for (const seg of segments(s.items, s.cached)) {
      parts.push(el("rect", { x: x(c) - bw / 2, y: y(seg.b), width: bw, height: Math.max(0.6, y(seg.a) - y(seg.b)), fill: KIND_COLOR[seg.kind], "fill-opacity": seg.hit ? CACHED_OPACITY : undefined }));
    }
    obstacles.push({ x0: x(c) - bw / 2 - 1, y0: y(s.T + (c === t ? p.reserve : 0)) - 1, x1: x(c) + bw / 2 + 1, y1: bottom });
  }
  // The current call: its reserve on top and an outline around both.
  const cur = r.snaps[t];
  parts.push(el("rect", { x: x(t) - bw / 2, y: y(cur.T + p.reserve), width: bw, height: y(cur.T) - y(cur.T + p.reserve), fill: `url(#${uid}-hatch)` }));
  parts.push(el("rect", { x: x(t) - bw / 2 - 1.5, y: y(cur.T + p.reserve) - 1.5, width: bw + 3, height: y(0) - y(cur.T + p.reserve) + 1.5, fill: "none", stroke: C.ink, "stroke-width": 1.2 }));

  // The durable event log keeps every turn, so it grows past the window.
  const logPts: Array<[number, number]> = [];
  for (let c = 0; c <= t; c++) logPts.push([x(c), y(r.snaps[c].log)]);
  const logObs = lineObstacles(logPts);

  // Window and threshold lines. Their labels, then the log's, go to the first
  // spot that clears the bars, the log line, and each other.
  const bounds = { x0: left + 2, y0: top - 16, x1: w - right, y1: bottom - 2 };
  const taken: Box[] = [...obstacles, ...logObs];
  const lineLabel = (label: string, yy: number, prefer: "end" | "start") => {
    const xs: Array<[number, "start" | "middle" | "end"]> = prefer === "end"
      ? [[w - right, "end"], [left + 5, "start"], [(left + w) / 2, "middle"]]
      : [[left + 5, "start"], [w - right, "end"], [(left + w) / 2, "middle"]];
    for (const dy of [-7, 15]) {
      for (const [lx, a] of xs) {
        const b = textBox(lx, yy + dy, label, TYPE.body, a);
        if (b.x0 < bounds.x0 - 2 || b.x1 > bounds.x1 || b.y0 < bounds.y0 || b.y1 > bounds.y1) continue;
        if (taken.some((o) => overlaps(o, b))) continue;
        taken.push(b);
        return text(lx, yy + dy, label, { "font-size": TYPE.body, "text-anchor": a, class: "fig-t-halo fig-t-num" });
      }
    }
    const b = textBox(prefer === "end" ? w - right : left + 5, yy - 7, label, TYPE.body, prefer);
    taken.push(b);
    return text(prefer === "end" ? w - right : left + 5, yy - 7, label, { "font-size": TYPE.body, "text-anchor": prefer, class: "fig-t-halo fig-t-num" });
  };
  const yW = y(p.window);
  parts.push(el("line", { x1: left, x2: w - right, y1: yW, y2: yW, stroke: C.ink2, "stroke-width": 1.4 }));
  taken.push(...lineObstacles([[left, yW], [w - right, yW]]));
  let yT = yW;
  if (p.threshold < 100) {
    yT = y((p.threshold / 100) * p.window);
    parts.push(el("line", { x1: left, x2: w - right, y1: yT, y2: yT, stroke: C.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 4" }));
    taken.push(...lineObstacles([[left, yT], [w - right, yT]]));
  }
  const lineLabels = [lineLabel(tpl(L.wLine, { v: fmtTok(p.window) }), yW, "end")];
  if (p.threshold < 100) lineLabels.push(lineLabel(tpl(L.thLine, { v: fmtTok((p.threshold / 100) * p.window) }), yT, "start"));

  parts.push(el("path", { d: linePath(logPts), fill: "none", stroke: C.paper, "stroke-width": 4.5, "stroke-linejoin": "round" }));
  parts.push(el("path", { d: linePath(logPts), fill: "none", stroke: C.ink, "stroke-width": 1.6, "stroke-linejoin": "round" }));
  const [lx, ly] = logPts[logPts.length - 1];
  parts.push(el("circle", { cx: lx, cy: ly, r: 3, fill: C.ink }));
  parts.push(...lineLabels);
  // The log's size at its end point; if that spot is taken, its name at the
  // latest point along the line that has room.
  const sides = ["above-left", "left", "above", "above-right", "right", "below-right"] as const;
  let placed = placeLabels([{ x: lx, y: ly, text: tpl(L.logLine, { v: fmtTok(cur.log) }), size: TYPE.body, gap: 7, sides: [...sides], attrs: { class: "fig-t-halo fig-t-num" } }], bounds, taken);
  for (let c = logPts.length - 2; c >= 0 && !placed.placed.length; c--) {
    placed = placeLabels([{ x: logPts[c][0], y: logPts[c][1], text: L.logName, size: TYPE.body, gap: 7, sides: ["above-left", "above", "left"], attrs: { class: "fig-t-halo" } }], bounds, taken);
  }
  parts.push(drawLabels(placed.placed));

  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks: [0, 5, 10, 15, 20, 25].filter((v) => v <= N), title: L.call, format: (v) => String(v), size: TYPE.body }));
  const compactX = r.events.filter((e) => e.kind === "compact" && e.t <= t).map((e) => x(e.t - 0.5));
  return { svg: g({ class: "fig-chart" }, ...parts), h: bottom - y0 + axisHeight(true, TYPE.body), x, top, bottom, compactX };
}

const STYLE: Record<"window" | "held" | "pointer" | "log", { stroke: string; width: number; dash?: string }> = {
  window: { stroke: C.ink, width: 3 },
  held: { stroke: C.c5, width: 3 },
  pointer: { stroke: C.c5, width: 2.2, dash: "4 3" },
  log: { stroke: C.ink3, width: 2, dash: "1.5 3" },
};

function renderFacts(p: P, t: number, w: number, r: Run, L: L, x: (v: number) => number, compactX: number[], y0: number) {
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, L.facts, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const lg = legend([
    { label: L.lWindow, swatch: { kind: "line", stroke: STYLE.window.stroke } },
    ...(p.policy !== "truncate" ? [{ label: tpl(L.lHeld, { s: holdName(p, L) }), swatch: { kind: "line" as const, stroke: STYLE.held.stroke } }] : []),
    ...(p.policy === "checkpoint" ? [{ label: L.lPointer, swatch: { kind: "line" as const, stroke: STYLE.pointer.stroke, dash: STYLE.pointer.dash } }] : []),
    { label: L.lLog, swatch: { kind: "line", stroke: STYLE.log.stroke, dash: STYLE.log.dash } },
  ], 0, y0 + 22, w, TYPE.body);
  parts.push(lg.svg);
  let yy = y0 + 22 + lg.height + 6;
  FACTS.forEach((f, i) => {
    const name = L[`f${i}` as "f0"];
    const st = status(p, r, t, i, L);
    const done = f.need <= t;
    const stCls = r.snaps[t].facts[i] === "lost" ? "fig-t-strong" : "fig-t-muted";
    if (textWidth(name, TYPE.body) + 14 + textWidth(st, TYPE.body) <= w) {
      parts.push(text(0, yy + 13, name, { "font-size": TYPE.body }));
      parts.push(text(w, yy + 13, st, { "font-size": TYPE.body, "text-anchor": "end", class: stCls }));
      yy += 18;
    } else {
      parts.push(text(0, yy + 13, name, { "font-size": TYPE.body }));
      yy += 17;
      for (const line of wrap(st, TYPE.body, w)) { parts.push(text(0, yy + 13, line, { "font-size": TYPE.body, class: stCls })); yy += 16; }
      yy += 1;
    }
    const ly = yy + 8;
    // Where the fact will be needed, drawn faint until the call gets there.
    const from = Math.max(f.at, Math.min(t, f.need));
    if (from < f.need) parts.push(el("line", { x1: x(from), x2: x(f.need), y1: ly, y2: ly, stroke: C.grid, "stroke-width": 3, "stroke-linecap": "round" }));
    // Compactions so far, marked across the line.
    for (const cx of compactX) parts.push(el("line", { x1: cx, x2: cx, y1: ly - 8, y2: ly + 8, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    // The path so far, one run per state. A state holds from the compaction
    // boundary before a call (c - 0.5) to the next one.
    const need = r.events.find((e) => e.kind === "need" && e.fact === i) as Extract<Ev, { kind: "need" }> | undefined;
    const end = Math.min(t, f.need);
    let runStart = f.at, runKey: keyof typeof STYLE | null = null;
    const flush = (to: number) => {
      if (runKey == null || to <= runStart) return;
      const sty = STYLE[runKey];
      parts.push(el("line", { x1: x(runStart), x2: x(to), y1: ly, y2: ly, stroke: sty.stroke, "stroke-width": sty.width, "stroke-dasharray": sty.dash }));
    };
    for (let c = f.at + 1; c <= end; c++) {
      const sk = c === f.need && need ? need.where : (r.snaps[c].facts[i] as keyof typeof STYLE);
      if (runKey == null) runKey = sk;
      else if (sk !== runKey) { flush(c - 0.5); runStart = c - 0.5; runKey = sk; }
    }
    flush(end);
    // Start and need markers.
    if (t >= f.at) parts.push(el("circle", { cx: x(f.at), cy: ly, r: 3.5, fill: C.ink }));
    else parts.push(el("circle", { cx: x(f.at), cy: ly, r: 3.5, fill: C.paper, stroke: C.ink3, "stroke-width": 1.2 }));
    const nx = x(f.need);
    if (!done || !need) {
      parts.push(el("circle", { cx: nx, cy: ly, r: 5, fill: C.paper, stroke: C.ink3, "stroke-width": 1.4 }));
    } else if (need.outcome === "lost") {
      parts.push(el("path", { d: `M${nx - 5},${ly - 5}L${nx + 5},${ly + 5}M${nx - 5},${ly + 5}L${nx + 5},${ly - 5}`, fill: "none", stroke: C.bad, "stroke-width": 2.6, "stroke-linecap": "round" }));
    } else {
      parts.push(el("circle", { cx: nx, cy: ly, r: 5.5, fill: need.outcome === "used" ? C.good : C.warn, stroke: C.paper, "stroke-width": 1.2 }));
    }
    yy = ly + 12;
  });
  return { svg: g({ class: "fig-facts" }, ...parts), h: yy - y0 };
}

function renderWindow(p: P, t: number, w: number, r: Run, L: L, uid: string, y0: number) {
  const s = r.snaps[t];
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, tpl(L.input, { t }), { "font-size": TYPE.label, class: "fig-t-strong" }));
  const xs = linear([0, p.window], [0, w]);
  const labelY = y0 + 38;
  const by = labelY + 12;
  const bh = 22;
  // Brackets over the cached prefix and the part prefilled at this call.
  const brackets: Array<[number, number, string]> = [];
  if (s.cached > 0) brackets.push([0, s.cached, tpl(L.hit, { v: fmtTok(s.cached) })]);
  if (s.T > s.cached) brackets.push([s.cached, s.T, tpl(L.fresh, { v: fmtTok(s.T - s.cached) })]);
  let lastEnd = -Infinity;
  for (const [a, b, label] of brackets) {
    const x0 = xs(a) + 1, x1 = xs(b) - 1;
    parts.push(el("path", { d: `M${x0},${by - 2}V${by - 6}H${x1}V${by - 2}`, fill: "none", stroke: C.ink2, "stroke-width": 1 }));
    const lw = textWidth(label, TYPE.body);
    let lx = Math.max((x0 + x1) / 2 - lw / 2, lastEnd + 10, 0);
    lx = Math.min(lx, w - lw);
    parts.push(text(lx, labelY, label, { "font-size": TYPE.body, class: "fig-t-num" }));
    lastEnd = lx + lw;
  }
  parts.push(el("rect", { x: 0, y: by, width: w, height: bh, rx: 2, fill: C.panel }));
  for (const seg of segments(s.items, s.cached)) {
    parts.push(el("rect", { x: xs(seg.a), y: by, width: Math.max(0.6, xs(seg.b) - xs(seg.a)), height: bh, fill: KIND_COLOR[seg.kind], "fill-opacity": seg.hit ? CACHED_OPACITY : undefined }));
  }
  parts.push(el("rect", { x: xs(s.T), y: by, width: xs(s.T + p.reserve) - xs(s.T), height: bh, fill: `url(#${uid}-hatch)` }));
  if (p.threshold < 100) {
    const tx = xs((p.threshold / 100) * p.window);
    parts.push(el("line", { x1: tx, x2: tx, y1: by - 3, y2: by + bh + 3, stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "3 2" }));
    const tw = textWidth("θ·W", TYPE.body);
    const tlx = Math.min(tx - tw / 2, w - tw);
    if (tlx > lastEnd + 8) parts.push(text(tlx, labelY, "θ·W", { "font-size": TYPE.body, class: "fig-t-muted" }));
  }
  // Where each fact sits in what the model reads.
  const marks: Array<{ x: number; label: string; pointer: boolean }> = [];
  let pos = 0;
  for (const it of s.items) {
    const mid = pos + it.tokens / 2;
    if (it.fact != null && s.facts[it.fact] !== "future") marks.push({ x: xs(mid), label: `F${it.fact + 1}`, pointer: false });
    if (it.kind === "summary") {
      for (const f of s.holds) marks.push({ x: xs(mid), label: `F${f + 1}`, pointer: false });
      for (const f of s.pointers) if (s.facts[f] === "pointer") marks.push({ x: xs(mid), label: `F${f + 1}`, pointer: true });
    }
    pos += it.tokens;
  }
  marks.sort((a, b) => a.x - b.x);
  let edge = -Infinity;
  const my = by + bh + 16;
  for (const m of marks) {
    const lw = textWidth(m.label, TYPE.body);
    const lx = Math.min(Math.max(m.x - lw / 2, edge + 5, 0), w - lw);
    parts.push(el("line", { x1: m.x, x2: Math.min(Math.max(m.x, lx + 2), lx + lw - 2), y1: by + bh, y2: my - 11, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": m.pointer ? "2 2" : undefined }));
    parts.push(text(lx, my, m.label, { "font-size": TYPE.body, class: m.pointer ? "fig-t-muted" : "fig-t-strong" }));
    edge = lx + lw;
  }
  return { svg: g({ class: "fig-window" }, ...parts), h: (marks.length ? my + 4 : by + bh + 4) - y0 };
}

function renderReadout(p: P, t: number, w: number, r: Run, L: L, y0: number) {
  const s = r.snaps[t];
  const narrow = w < 480;
  const rows: Array<[string, string, boolean]> = [
    [L.rT, tpl(L.rTv, { a: fmtTok(s.T), b: fmtTok(p.reserve), c: fmtTok(s.T + p.reserve), w: fmtTok(p.window) }), true],
    [L.rLimit, fmtTok((p.threshold / 100) * p.window), false],
    [L.rCached, fmtTok(s.cached), false],
    [L.rFresh, fmtTok(s.T - s.cached), true],
    [L.rSum, fmtTok(s.prefill), true],
    [L.rSumNo, fmtTok(s.prefillNoCache), false],
    [L.rLog, fmtTok(s.log), false],
    [L.rCompactions, String(s.compactions), false],
  ];
  const parts: string[] = [];
  const cols = narrow ? 1 : 2;
  const gap = 24;
  const colW = (w - gap * (cols - 1)) / cols;
  const rowH = 20;
  rows.forEach(([name, v, strong], i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x0 = col * (colW + gap), yy = y0 + row * rowH;
    parts.push(el("line", { x1: x0, x2: x0 + colW, y1: yy, y2: yy, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, yy + 14, name, { "font-size": TYPE.body }));
    parts.push(text(x0 + colW, yy + 14, v, { "font-size": TYPE.body, "text-anchor": "end", class: strong ? "fig-t-strong fig-t-num" : "fig-t-num" }));
  });
  const n = Math.ceil(rows.length / cols);
  for (let c = 0; c < cols; c++) parts.push(el("line", { x1: c * (colW + gap), x2: c * (colW + gap) + colW, y1: y0 + n * rowH, y2: y0 + n * rowH, stroke: C.grid, "stroke-width": 1 }));
  return { svg: g({ class: "fig-readout" }, ...parts), h: n * rowH + 2 };
}

function factWord(p: P, s: FactState, L: L): string {
  switch (s) {
    case "future": return L.dFuture;
    case "window": return L.lWindow;
    case "held": return tpl(L.lHeld, { s: holdName(p, L) });
    case "pointer": return L.lPointer;
    case "log": return L.lLog;
    case "used": return L.dUsed;
    case "fetched": return L.dFetched;
    case "lost": return L.dLost;
  }
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const t = Math.round(st.t);
  const r = run(p);
  const s = r.snaps[t];
  const policy = p.policy === "truncate" ? L.dTruncate : p.policy === "summary" ? L.dSummary : L.dCheckpoint;
  const facts = s.facts.map((f, i) => tpl(L.dFact, { i: i + 1, s: factWord(p, f, L) })).join(lang === "zh" ? "，" : ", ");
  return tpl(L.describe, { t, d: N, policy, T: fmtTok(s.T), R: fmtTok(p.reserve), W: fmtTok(p.window), c: fmtTok(s.cached), k: s.compactions, facts })
    .replace(/^./, (c) => c.toUpperCase());
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const t = Math.max(0, Math.min(N, Math.round(st.t)));
  const r = run(p);
  const chart = renderChart(p, t, w, r, L, st.uid, 0);
  let y = chart.h + 18;
  const facts = renderFacts(p, t, w, r, L, chart.x, chart.compactX, y);
  // Compaction boundaries in the chart; the fact lines mark them again, so
  // the reader can see which facts a compaction moved.
  const bounds = chart.compactX.map((cx) => el("line", { x1: cx, x2: cx, y1: chart.top, y2: chart.bottom, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" })).join("");
  y += facts.h + 18;
  const win = renderWindow(p, t, w, r, L, st.uid, y);
  y += win.h + 16;
  const ro = renderReadout(p, t, w, r, L, y);
  y += ro.h;
  return svg(w, y + 4, describe({ ...st, t }, lang), el("defs", {}, hatch(`${st.uid}-hatch`, C.ink3, 4, 1.1)), bounds, chart.svg, facts.svg, win.svg, ro.svg);
}

export default defineFigure({
  name: "context-compaction",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    policy: {
      kind: "choice", label: { en: "Compaction policy", zh: "压缩策略" }, default: "summary",
      options: [
        { value: "truncate", label: { en: "Drop old turns", zh: "丢弃旧回合" } },
        { value: "summary", label: { en: "Prose summary", zh: "文字摘要" } },
        { value: "checkpoint", label: { en: "Checkpoint", zh: "检查点" } },
      ],
    },
    threshold: {
      kind: "range", label: { en: "Compact at θ", zh: "压缩阈值 θ" }, unit: { en: "% of W", zh: "%（占 W）" },
      min: 50, max: 100, step: 5, default: 80,
    },
    window: { kind: "range", label: { en: "Window W", zh: "窗口 W" }, unit: { en: "tokens", zh: "个词元" }, min: 48000, max: 200000, step: 8000, default: 128000 },
    reserve: { kind: "range", label: { en: "Output reserve R", zh: "输出预留 R" }, unit: { en: "tokens", zh: "个词元" }, min: 2000, max: 16000, step: 1000, default: 8000, control: false },
  },
  timeline: {
    rate: 2,
    discrete: true,
    duration: () => N,
    keyframes: (p, lang) => {
      const L = labels[lang];
      return run(p).events.map((e) => ({ t: e.t, label: evLabel(e, p, L) }));
    },
    // Open on the first call that needs a fact the policy lost; otherwise on
    // the first re-fetch, the first compaction, or the end of the session.
    poster: (p) => {
      const ev = run(p).events;
      const pick = ev.find((e) => e.kind === "need" && e.outcome === "lost")
        ?? ev.find((e) => e.kind === "need" && e.outcome === "fetched")
        ?? ev.find((e) => e.kind === "compact");
      return pick ? pick.t : N;
    },
  },
  render,
  describe,
});
