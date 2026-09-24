// One scripted coding task driven through the chapter's turn loop
//
//   x_t = C(g, u, s_t, A_t, b_t),  y_t ~ π_θ(· | x_t),  d_t = D(y_t),
//   s_{t+1} = U(s_t, d_t, o_{t+1}),  d_t ∈ {act, ask, final, stop},
//
// one phase at a time: assemble the context, decide, guard, execute, update
// the durable state, and check the stop rules (the chapter's skeleton). The
// task is to make tests/test_totals.py pass with write access limited to
// checkout/. The script visits every branch the skeleton names: allowed
// actions, an action the guard denies (no side effect), a question whose
// reply becomes an observation, output that fails to decode, a final response
// the completion check rejects, and the final response that passes.
//
// The durable state s_t is an append-only event log; the context x_t is
// assembled from it under the chapter's budget
//
//   B_fixed + B_task + B_state,t + B_tools,t + B_out,t <= W,  B_tools,t = Σ_{a∈A_t} s(a).
//
// The assembler keeps the newest turns verbatim and replaces older ones with a
// one-line summary each when B_state,t would exceed what the other terms leave.
// The session record (sandbox handle, credential, permissions) and the guard's
// approval records never enter the context. The action catalog is either flat
// (all eight tools mounted every turn) or phase-based (only the tools of the
// runtime's current phase); under phase-based mounting the turn after the
// rejected final asks for edit_file while only the verify tools are mounted,
// and the guard rejects it, which is the recall failure the chapter names.
//
// The action budget counts executed actions; when it is used up, the stop
// check ends the run before the completion check can pass. Every token count
// is illustrative. Compaction policies themselves are the context-engineering
// chapter's figure.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- task

export const W = 16000; // context window, tokens
const B_FIXED = 1800; // system and policy instructions
const B_TASK = 450; // goal and user constraints
const B_OUT = 2000; // reserved for the controller's output
const SUMMARY = 60; // tokens per summarized turn
const SESSION_RAW = 300; // session record: sandbox handle, credential, permissions

const TOOLS: Record<string, number> = {
  run_tests: 620, read_file: 480, edit_file: 910, search_code: 540,
  list_dir: 320, git_diff: 380, open_pull_request: 760, web_search: 690,
};
type Phase = "investigate" | "edit" | "verify";
const PHASE_TOOLS: Record<Phase, string[]> = {
  investigate: ["run_tests", "read_file", "search_code", "list_dir"],
  edit: ["read_file", "edit_file", "run_tests"],
  verify: ["run_tests", "git_diff"],
};

export type Kind = "act" | "ask" | "final" | "invalid";
type Verdict = "allowed" | "denied" | "unmounted" | "valid" | "parse";
type Bi = { en: string; zh: string };

interface Turn {
  phase: Phase; // the runtime's tool phase (phase-based mounting)
  kind: Kind;
  tool?: string;
  verdict: Verdict;
  executes: boolean; // an allowed action that runs and counts against the budget
  y: number; // controller output tokens
  obs: number; // observation tokens as it enters the context verbatim
  raw: number; // tokens the turn adds to the event log (raw output and records)
  pass?: boolean; // final: the completion check passes
  decide: Bi; guard: Bi; exec: Bi; update: Bi; log: Bi;
}

const t = (x: Omit<Turn, "executes">): Turn => ({ ...x, executes: x.verdict === "allowed" && x.kind === "act" });

const RUN1 = t({ phase: "investigate", kind: "act", tool: "run_tests", verdict: "allowed", y: 140, obs: 2900, raw: 9600,
  decide: { en: "run_tests(tests/test_totals.py)", zh: "run_tests(tests/test_totals.py)" },
  guard: { en: "allowed: read-only command in the sandbox", zh: "允许：沙箱内的只读命令" },
  exec: { en: "3 of 15 tests fail; the raw log is 9.4k tokens", zh: "15 个测试中 3 个失败；原始日志 9.4k 词元" },
  update: { en: "o: failure summary, 2.9k tokens", zh: "o：失败摘要，2.9k 词元" },
  log: { en: "act run_tests: 3 failing", zh: "act run_tests：3 个失败" } });
const READ = t({ phase: "investigate", kind: "act", tool: "read_file", verdict: "allowed", y: 120, obs: 3600, raw: 3780,
  decide: { en: "read_file(checkout/totals.py)", zh: "read_file(checkout/totals.py)" },
  guard: { en: "allowed: read inside the repository", zh: "允许：读取仓库内文件" },
  exec: { en: "returns 410 lines", zh: "返回 410 行" },
  update: { en: "o: file contents, 3.6k tokens", zh: "o：文件内容，3.6k 词元" },
  log: { en: "act read checkout/totals.py", zh: "act 读取 checkout/totals.py" } });
const DENIED = t({ phase: "edit", kind: "act", tool: "edit_file", verdict: "denied", y: 180, obs: 90, raw: 390,
  decide: { en: "edit_file(payments/rounding.py)", zh: "edit_file(payments/rounding.py)" },
  guard: { en: "denied: the write scope is checkout/", zh: "拒绝：写入范围仅限 checkout/" },
  exec: { en: "not run, no side effect", zh: "未执行，没有副作用" },
  update: { en: "o: policy denial, 90 tokens; the approval record stays out of the prompt", zh: "o：策略拒绝，90 词元；审批记录不进入提示词" },
  log: { en: "act edit payments/…: denied", zh: "act 编辑 payments/…：被拒绝" } });
const ASK = t({ phase: "edit", kind: "ask", verdict: "valid", y: 160, obs: 60, raw: 220,
  decide: { en: "May the fix go in checkout/totals.py instead?", zh: "能否改在 checkout/totals.py？" },
  guard: { en: "a question, no action to authorize", zh: "提问，没有需要授权的动作" },
  exec: { en: "waits for the user's reply", zh: "等待用户回复" },
  update: { en: "o: reply, keep the change in checkout/", zh: "o：回复，改动留在 checkout/" },
  log: { en: "ask: user keeps it in checkout/", zh: "用户要求改在 checkout/" } });
const EDIT1 = t({ phase: "edit", kind: "act", tool: "edit_file", verdict: "allowed", y: 420, obs: 700, raw: 1180,
  decide: { en: "edit_file(checkout/totals.py)", zh: "edit_file(checkout/totals.py)" },
  guard: { en: "allowed: inside the write scope", zh: "允许：在写入范围内" },
  exec: { en: "patch applied, 14 lines, idempotency key t5", zh: "补丁已应用，14 行，幂等键 t5" },
  update: { en: "o: diff, 700 tokens", zh: "o：diff，700 词元" },
  log: { en: "act edit checkout/totals.py", zh: "act 编辑 checkout/totals.py" } });
const INVALID = t({ phase: "edit", kind: "invalid", verdict: "parse", y: 300, obs: 80, raw: 380,
  decide: { en: "invalid: arguments fail the edit_file schema", zh: "无效：参数不符合 edit_file 的模式" },
  guard: { en: "rejected by the decoder, before any execution", zh: "解码器拒绝，未进入执行" },
  exec: { en: "not run", zh: "未执行" },
  update: { en: "o: parse error; 1 of 2 parse retries used", zh: "o：解析错误；已用 2 次解析重试中的 1 次" },
  log: { en: "invalid output: parse error", zh: "无效输出：解析错误" } });
const RUN2 = t({ phase: "edit", kind: "act", tool: "run_tests", verdict: "allowed", y: 110, obs: 2300, raw: 8370,
  decide: { en: "run_tests(tests/test_totals.py)", zh: "run_tests(tests/test_totals.py)" },
  guard: { en: "allowed: read-only command in the sandbox", zh: "允许：沙箱内的只读命令" },
  exec: { en: "1 of 15 tests fails; the raw log is 8.2k tokens", zh: "15 个测试中 1 个失败；原始日志 8.2k 词元" },
  update: { en: "o: failure summary, 2.3k tokens", zh: "o：失败摘要，2.3k 词元" },
  log: { en: "act run_tests: 1 failing", zh: "act run_tests：1 个失败" } });
const FINAL1 = t({ phase: "verify", kind: "final", verdict: "valid", y: 90, obs: 400, raw: 1390, pass: false,
  decide: { en: "“All tests pass.”", zh: "“所有测试都已通过。”" },
  guard: { en: "a final response, still to be verified", zh: "最终回答，尚待验证" },
  exec: { en: "the completion check runs the tests: 1 fails", zh: "完成检查运行测试：1 个失败" },
  update: { en: "o: failed completion evidence, 400 tokens", zh: "o：完成检查失败的证据，400 词元" },
  log: { en: "final: check fails, continue", zh: "检查未通过，继续" } });
const UNMOUNTED = t({ phase: "verify", kind: "act", tool: "edit_file", verdict: "unmounted", y: 250, obs: 120, raw: 490,
  decide: { en: "edit_file(checkout/totals.py)", zh: "edit_file(checkout/totals.py)" },
  guard: { en: "rejected: edit_file is not in A_{t} in the verify phase", zh: "拒绝：验证阶段的 A_{t} 中没有 edit_file" },
  exec: { en: "not run; the runtime returns to the edit phase", zh: "未执行；运行时回到编辑阶段" },
  update: { en: "o: action unavailable, 120 tokens", zh: "o：动作不可用，120 词元" },
  log: { en: "act edit: not mounted", zh: "act 编辑：未挂载" } });
const EDIT2 = (phase: Phase) => t({ phase, kind: "act", tool: "edit_file", verdict: "allowed", y: 260, obs: 500, raw: 820,
  decide: { en: "edit_file(checkout/totals.py)", zh: "edit_file(checkout/totals.py)" },
  guard: { en: "allowed: inside the write scope", zh: "允许：在写入范围内" },
  exec: { en: "patch applied, 6 lines", zh: "补丁已应用，6 行" },
  update: { en: "o: diff, 500 tokens", zh: "o：diff，500 词元" },
  log: { en: "act edit checkout/totals.py", zh: "act 编辑 checkout/totals.py" } });
const RUN3 = (phase: Phase) => t({ phase, kind: "act", tool: "run_tests", verdict: "allowed", y: 110, obs: 1400, raw: 7070,
  decide: { en: "run_tests(tests/test_totals.py)", zh: "run_tests(tests/test_totals.py)" },
  guard: { en: "allowed: read-only command in the sandbox", zh: "允许：沙箱内的只读命令" },
  exec: { en: "15 of 15 tests pass", zh: "15 个测试全部通过" },
  update: { en: "o: test summary, 1.4k tokens", zh: "o：测试摘要，1.4k 词元" },
  log: { en: "act run_tests: all pass", zh: "act run_tests：全部通过" } });
const FINAL2 = t({ phase: "verify", kind: "final", verdict: "valid", y: 120, obs: 0, raw: 1320, pass: true,
  decide: { en: "“Rounding fixed in checkout/; 15 tests pass.”", zh: "“已在 checkout/ 修复舍入，15 个测试通过。”" },
  guard: { en: "a final response, still to be verified", zh: "最终回答，尚待验证" },
  exec: { en: "the completion check passes", zh: "完成检查通过" },
  update: { en: "outcome recorded: success", zh: "记录结果：成功" },
  log: { en: "final: verified", zh: "验证通过" } });

export type Catalog = "flat" | "phases";
function script(catalog: Catalog): Turn[] {
  const head = [RUN1, READ, DENIED, ASK, EDIT1, INVALID, RUN2, FINAL1];
  return catalog === "flat"
    ? [...head, EDIT2("verify"), RUN3("verify"), FINAL2]
    : [...head, UNMOUNTED, EDIT2("edit"), RUN3("edit"), FINAL2];
}

// ---------------------------------------------------------------- run

export const PHASES = ["assemble", "decide", "guard", "execute", "update", "check"] as const;
export type Stage = (typeof PHASES)[number];

export type Rep = "verbatim" | "summary";
export interface Ctx { tools: number; state: number; verbatim: number; summary: number; reps: Rep[]; total: number; toolNames: string[] }
interface Step { turn: number; stage: number }
export interface Run {
  turns: Turn[]; // turns actually taken (the run may stop early)
  ctx: Ctx[]; // context assembled at the start of each turn
  used: number[]; // executed actions after each turn
  exit: "success" | "budget";
  steps: Step[]; // every (turn, stage) position of the timeline
}

function toolsFor(catalog: Catalog, phase: Phase): string[] {
  return catalog === "flat" ? Object.keys(TOOLS) : PHASE_TOOLS[phase];
}

// The assembler: newest earlier turns verbatim while they fit, the rest one
// summary line each, all within what the other terms of the budget leave.
function assemble(turns: Turn[], upto: number, toolNames: string[]): Ctx {
  const tools = toolNames.reduce((a, k) => a + TOOLS[k], 0);
  const room = W - B_FIXED - B_TASK - tools - B_OUT;
  const reps: Rep[] = Array.from({ length: upto }, () => "summary");
  let verbatim = 0;
  for (let i = upto - 1; i >= 0; i--) {
    const cost = turns[i].y + turns[i].obs;
    if (verbatim + cost + SUMMARY * i > room) break;
    verbatim += cost;
    reps[i] = "verbatim";
  }
  const summary = SUMMARY * reps.filter((r) => r === "summary").length;
  const state = verbatim + summary;
  return { tools, state, verbatim, summary, reps, total: B_FIXED + B_TASK + state + tools + B_OUT, toolNames };
}

const memo = new Map<string, Run>();
export function run(p: { catalog: Catalog; budget: number }): Run {
  const key = `${p.catalog}|${p.budget}`;
  let hit = memo.get(key);
  if (hit) return hit;
  const all = script(p.catalog);
  const turns: Turn[] = [], ctx: Ctx[] = [], used: number[] = [];
  let n = 0;
  let exit: Run["exit"] = "success";
  for (let i = 0; i < all.length; i++) {
    const tr = all[i];
    turns.push(tr);
    ctx.push(assemble(all, i, toolsFor(p.catalog, tr.phase)));
    if (tr.executes) n++;
    used.push(n);
    if (tr.kind === "final" && tr.pass) break;
    if (n >= p.budget) { exit = "budget"; break; }
  }
  const steps: Step[] = [];
  turns.forEach((_, i) => PHASES.forEach((_, s) => steps.push({ turn: i, stage: s })));
  hit = { turns, ctx, used, exit, steps };
  memo.set(key, hit);
  return hit;
}

// The event log through position (turn, stage): the session record, then one
// record per finished turn; the current turn's record is appended at update.
export function logAt(r: Run, turn: number, stage: number) {
  const n = stage >= PHASES.indexOf("update") ? turn + 1 : turn;
  const tokens = SESSION_RAW + r.turns.slice(0, n).reduce((a, x) => a + x.raw, 0);
  return { n, records: n + 1, tokens };
}

// ---------------------------------------------------------------- text with subscripts

// "_{...}" sets a subscript as a tspan below the baseline, never smaller than
// the 12 px floor. Only the braced form is read, so tool names such as
// run_tests stay plain.
interface MRun { s: string; sub: boolean }
function runsOf(src: string): MRun[] {
  const out: MRun[] = [];
  let i = 0;
  while (i < src.length) {
    const j = src.indexOf("_{", i);
    if (j < 0) { out.push({ s: src.slice(i), sub: false }); break; }
    if (j > i) out.push({ s: src.slice(i, j), sub: false });
    const k = src.indexOf("}", j + 2);
    out.push({ s: src.slice(j + 2, k), sub: true });
    i = k + 1;
  }
  return out;
}
const subSize = (size: number) => Math.max(TYPE.body, Math.round(size * 0.8));
function richWidth(src: string, size: number): number {
  return runsOf(src).reduce((a, r) => a + textWidth(r.s, r.sub ? subSize(size) : size), 0);
}
function rich(x: number, y: number, src: string, size: number, attrs: Record<string, string | number | undefined> = {}): string {
  if (!src.includes("_{")) return text(x, y, src, { "font-size": size, ...attrs });
  let cur = 0, inner = "";
  for (const r of runsOf(src)) {
    const off = r.sub ? size * 0.3 : 0;
    const dy = off - cur;
    cur = off;
    inner += `<tspan${dy ? ` dy="${Math.round(dy * 10) / 10}"` : ""}${r.sub ? ` font-size="${subSize(size)}"` : ""}>${esc(r.s)}</tspan>`;
  }
  return el("text", { x, y, "font-size": size, ...attrs }, inner);
}
// Wrap a string with subscripts: widths are measured on the braced source,
// which overestimates slightly and so never overflows.
const wrapRich = (s: string, size: number, w: number) => wrap(s, size, w);

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "One task through the agent turn loop",
    turn: "Turn {n} of {N}",
    phaseNote: "tool phase: {p}",
    investigate: "investigate", edit: "edit", verify: "verify",
    assemble: "assemble x_{t}", decide: "decide d_{t}", guard: "guard", execute: "execute", update: "update s_{t+1}", check: "check stop",
    ctxFirst: "x_{t}: goal, instructions and {k} tools; {c} of 16k tokens",
    ctxLater: "x_{t}: {v} earlier turns verbatim, {m} summarized, {k} tools; {c} of 16k tokens",
    cont: "continue: {n} of {b} actions used",
    success: "exit: completion verified, outcome recorded",
    budget: "stop: action budget used up ({n} of {b}); the task is unfinished",
    logTitle: "Session state s_{t}: {r} records, {k} tokens",
    session: "session: sandbox handle, credential, permissions",
    lgVerb: "in x_{t} verbatim",
    lgSum: "in x_{t} as a summary",
    lgNever: "never sent",
    lgNew: "added this turn",
    ctxTitle: "Context x_{t} of turn {n} against the event log s_{t}",
    xRow: "x_{t}",
    sRow: "s_{t}",
    wMark: "W = 16k",
    fixed: "B_{fixed}", task: "B_{task}", stateV: "B_{state}, verbatim", stateS: "B_{state}, summaries", tools: "B_{tools}", out: "B_{out}",
    sum: "B_{fixed} {f} + B_{task} {a} + B_{state,t} {s} + B_{tools,t} {o} + B_{out,t} {r} = {c} ≤ W = 16k",
    toolsFlat: "A_{t}: all 8 tools mounted every turn",
    toolsPhase: "A_{t}: {list} ({p} phase)",
    xAxis: "tokens",
    kf: "Turn {n}. {d}; {g}",
    kfExit: "Turn {n}. {c}",
    describe: "Turn {n} of {N}, {stage}: {detail}. The event log s_t holds {r} records, {k} tokens; the context x_t uses {c} of 16k tokens with {v} earlier turns verbatim and {m} summarized; {a} of {b} actions executed.",
  },
  zh: {
    title: "一个任务走过智能体的轮次循环",
    turn: "第 {n} 轮（共 {N} 轮）",
    phaseNote: "工具阶段：{p}",
    investigate: "排查", edit: "编辑", verify: "验证",
    assemble: "整理 x_{t}", decide: "决定 d_{t}", guard: "防护", execute: "执行", update: "更新 s_{t+1}", check: "检查终止",
    ctxFirst: "x_{t}：目标、指令和 {k} 个工具；16k 中用了 {c} 词元",
    ctxLater: "x_{t}：此前 {v} 轮原文保留，{m} 轮摘要，{k} 个工具；16k 中用了 {c} 词元",
    cont: "继续：已用 {n}/{b} 次动作",
    success: "退出：完成已验证，结果已记录",
    budget: "终止：动作预算用尽（{n}/{b}），任务未完成",
    logTitle: "会话状态 s_{t}：{r} 条记录，{k} 词元",
    session: "会话：沙箱句柄、凭据、权限",
    lgVerb: "原文进入 x_{t}",
    lgSum: "以摘要进入 x_{t}",
    lgNever: "从不发送",
    lgNew: "本轮新增",
    ctxTitle: "第 {n} 轮的上下文 x_{t} 与事件日志 s_{t}",
    xRow: "x_{t}",
    sRow: "s_{t}",
    wMark: "W = 16k",
    fixed: "B_{fixed}", task: "B_{task}", stateV: "B_{state}，原文", stateS: "B_{state}，摘要", tools: "B_{tools}", out: "B_{out}",
    sum: "B_{fixed} {f} + B_{task} {a} + B_{state,t} {s} + B_{tools,t} {o} + B_{out,t} {r} = {c} ≤ W = 16k",
    toolsFlat: "A_{t}：每轮挂载全部 8 个工具",
    toolsPhase: "A_{t}：{list}（{p}阶段）",
    xAxis: "词元",
    kf: "第 {n} 轮。{d}；{g}",
    kfExit: "第 {n} 轮。{c}",
    describe: "第 {n} 轮（共 {N} 轮），{stage}：{detail}。事件日志 s_t 有 {r} 条记录、{k} 词元；上下文 x_t 用了 16k 中的 {c} 词元，此前 {v} 轮原文保留、{m} 轮摘要；已执行 {a}/{b} 次动作。",
  },
};
type L = typeof labels.en;

type P = { catalog: Catalog; budget: number };

const kt = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1)).toString()}k` : String(v));
const plain = (s: string) => s.replace(/_\{([^}]*)\}/g, "_$1");

function position(r: Run, t: number) {
  const i = Math.max(0, Math.min(r.steps.length - 1, Math.round(t)));
  return r.steps[i];
}

// The decision with its type, for keyframes and the live region.
function decision(tr: Turn, lang: Lang): string {
  return tr.kind === "invalid" ? tr.decide[lang] : `${tr.kind}${lang === "zh" ? "：" : ": "}${tr.decide[lang]}`;
}

function stageDetail(r: Run, p: P, turn: number, stage: number, L: L, lang: Lang): string {
  const tr = r.turns[turn];
  const c = r.ctx[turn];
  switch (PHASES[stage]) {
    case "assemble": {
      const v = c.reps.filter((x) => x === "verbatim").length;
      return turn === 0
        ? tpl(L.ctxFirst, { k: c.toolNames.length, c: kt(c.total) })
        : tpl(L.ctxLater, { v, m: turn - v, k: c.toolNames.length, c: kt(c.total) });
    }
    case "decide": return tr.decide[lang];
    case "guard": return tr.guard[lang];
    case "execute": return tr.exec[lang];
    case "update": return tr.update[lang];
    default: {
      const last = turn === r.turns.length - 1;
      if (last && r.exit === "success") return L.success;
      if (last) return tpl(L.budget, { n: r.used[turn], b: p.budget });
      return tpl(L.cont, { n: r.used[turn], b: p.budget });
    }
  }
}

// Status of a stage's outcome, for a colored marker (always beside its text).
function status(r: Run, turn: number, stage: number): string | null {
  const tr = r.turns[turn];
  if (PHASES[stage] === "guard") return tr.verdict === "allowed" ? C.good : tr.verdict === "valid" ? null : C.bad;
  if (PHASES[stage] === "execute" && tr.kind === "final") return tr.pass ? C.good : C.bad;
  if (PHASES[stage] === "check" && turn === r.turns.length - 1) return r.exit === "success" ? C.good : C.warn;
  return null;
}

function track(r: Run, p: P, turn: number, stage: number, x0: number, y0: number, w: number, L: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const gutter = 16;
  const nodeW = Math.max(...PHASES.map((s) => richWidth(L[s], size))) + 16;
  const nodeH = 24;
  const dx = x0 + gutter + nodeW + 10;
  const dw = x0 + w - dx;
  const tr = r.turns[turn];
  let y = y0;
  parts.push(text(x0, y + 14, tpl(L.turn, { n: turn + 1, N: r.turns.length }), { "font-size": TYPE.label, class: "fig-t-strong fig-t-num" }));
  if (p.catalog === "phases") {
    const note = tpl(L.phaseNote, { p: L[tr.phase] });
    const tw = textWidth(tpl(L.turn, { n: turn + 1, N: r.turns.length }), TYPE.label);
    if (tw + 16 + textWidth(note, size) <= w) parts.push(text(x0 + w, y + 14, note, { "font-size": size, "text-anchor": "end", class: "fig-t-muted" }));
  }
  y += 26;
  const centers: number[] = [];
  for (let s = 0; s < PHASES.length; s++) {
    const cur = s === stage, past = s < stage;
    // Detail: the decide row carries the decision-type chips above its text.
    const lines: string[] = [];
    let chipsH = 0;
    if (s <= stage) lines.push(...wrapRich(stageDetail(r, p, turn, s, L, lang), size, dw - 14).slice(0, 3));
    if (PHASES[s] === "decide") chipsH = 22;
    const rowH = Math.max(nodeH, chipsH + lines.length * 16 + 4) + 10;
    const ny = y + (PHASES[s] === "decide" ? 0 : 0);
    centers.push(ny + nodeH / 2);
    parts.push(el("rect", { x: x0 + gutter, y: ny, width: nodeW, height: nodeH, rx: 5, fill: past || cur ? C.panel : "none", stroke: cur ? C.ink : past ? C.ink3 : C.grid, "stroke-width": cur ? 2 : 1 }));
    parts.push(rich(x0 + gutter + nodeW / 2, ny + 16, L[PHASES[s]], size, { "text-anchor": "middle", class: cur ? "fig-t-strong" : past ? "" : "fig-t-muted" }));
    if (PHASES[s] === "decide") {
      let cx = dx;
      for (const k of ["act", "ask", "final", "stop"]) {
        const on = s <= stage && tr.kind === k;
        const cw = textWidth(k, size) + 12;
        parts.push(el("rect", { x: cx, y: ny + 2, width: cw, height: 18, rx: 9, fill: on ? C.c1 : "none", "fill-opacity": on ? 0.22 : undefined, stroke: on ? C.ink : C.grid, "stroke-width": on ? 1.5 : 1 }));
        parts.push(text(cx + cw / 2, ny + 15, k, { "font-size": size, "text-anchor": "middle", class: on ? "fig-t-strong" : "fig-t-muted" }));
        cx += cw + 6;
      }
    }
    const mark = s <= stage ? status(r, turn, s) : null;
    lines.forEach((ln, i) => {
      const ty = ny + chipsH + 16 + i * 16;
      parts.push(rich(dx + (mark ? 14 : 0), ty, ln, size, { class: cur ? "fig-t-strong" : undefined }));
    });
    if (mark && lines.length) parts.push(el("circle", { cx: dx + 5, cy: ny + chipsH + 11.5, r: 4.5, fill: mark }));
    // Flow arrow to the next stage.
    if (s < PHASES.length - 1) {
      const ax = x0 + gutter + nodeW / 2;
      const on = s < stage;
      parts.push(el("line", { x1: ax, x2: ax, y1: ny + nodeH, y2: y + rowH - 3, stroke: on ? C.ink2 : C.grid, "stroke-width": 1.25 }));
      parts.push(el("path", { d: `M${ax - 3.5},${y + rowH - 7} L${ax},${y + rowH - 1} L${ax + 3.5},${y + rowH - 7}`, fill: "none", stroke: on ? C.ink2 : C.grid, "stroke-width": 1.25 }));
    }
    y += rowH;
  }
  // The loop back to assemble for turn t + 1.
  const lx = x0 + 6;
  const loopOn = stage === PHASES.length - 1 && !(turn === r.turns.length - 1);
  const col = loopOn ? C.ink2 : C.grid;
  const top = centers[0], bot = centers[centers.length - 1];
  parts.push(el("path", { d: `M${x0 + gutter},${bot} H${lx} V${top} H${x0 + gutter - 1}`, fill: "none", stroke: col, "stroke-width": 1.25 }));
  parts.push(el("path", { d: `M${x0 + gutter - 7},${top - 3.5} L${x0 + gutter - 1},${top} L${x0 + gutter - 7},${top + 3.5}`, fill: "none", stroke: col, "stroke-width": 1.25 }));
  return { svg: g({ class: "fig-track" }, ...parts), h: y - y0 };
}

function eventLog(r: Run, turn: number, stage: number, x0: number, y0: number, w: number, L: L, lang: Lang, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const lg = logAt(r, turn, stage);
  let y = y0;
  for (const ln of wrapRich(tpl(L.logTitle, { r: lg.records, k: kt(lg.tokens) }), TYPE.label, w)) {
    parts.push(rich(x0, y + 14, ln, TYPE.label, { class: "fig-t-strong fig-t-num" })); y += 19;
  }
  // Legend for the tags.
  const tag = (x: number, yy: number, kind: "verbatim" | "summary" | "never" | "new") => {
    if (kind === "never") return el("rect", { x, y: yy, width: 11, height: 11, rx: 2, fill: `url(#${uid}-never)`, stroke: C.ink3, "stroke-width": 0.8 });
    if (kind === "new") return el("rect", { x: x + 0.75, y: yy + 0.75, width: 9.5, height: 9.5, rx: 2, fill: "none", stroke: C.ink, "stroke-width": 1.5 });
    return el("rect", { x, y: yy, width: 11, height: 11, rx: 2, fill: C.c1, "fill-opacity": kind === "summary" ? 0.3 : 1 });
  };
  let lx = x0; y += 4;
  for (const [k, name] of [["verbatim", L.lgVerb], ["summary", L.lgSum], ["never", L.lgNever], ["new", L.lgNew]] as const) {
    const iw = 17 + richWidth(name, size);
    if (lx > x0 && lx + iw > x0 + w) { lx = x0; y += 18; }
    parts.push(tag(lx, y + 2, k), rich(lx + 17, y + 12, name, size));
    lx += iw + 14;
  }
  y += 22;
  const rowH = 18;
  const tokW = textWidth("99.9k", size) + 6;
  const textW = w - 28 - tokW - 18;
  const fit = (s: string) => {
    if (textWidth(s, size) <= textW) return s;
    const ch = [...s];
    while (ch.length > 1 && textWidth(ch.join("") + "…", size) > textW) ch.pop();
    return ch.join("") + "…";
  };
  const row = (label: string, s: string, tokens: number, kind: "verbatim" | "summary" | "never" | "new", on: boolean) => {
    if (on) parts.push(el("rect", { x: x0 - 3, y: y + 1, width: w + 3, height: rowH - 1, rx: 3, fill: C.panel }));
    parts.push(text(x0, y + 14, label, { "font-size": size, class: "fig-t-muted fig-t-num" }));
    parts.push(text(x0 + 28, y + 14, fit(s), { "font-size": size, class: on ? "fig-t-strong" : undefined }));
    parts.push(text(x0 + w - 18, y + 14, kt(tokens), { "font-size": size, "text-anchor": "end", class: "fig-t-num fig-t-muted" }));
    parts.push(tag(x0 + w - 12, y + 4, kind));
    y += rowH;
  };
  row("t0", L.session, SESSION_RAW, "never", false);
  const c = r.ctx[turn];
  for (let i = 0; i < lg.n; i++) {
    const kind = i < turn ? c.reps[i] : "new";
    row(`t${i + 1}`, r.turns[i].log[lang], r.turns[i].raw, kind, i === turn);
  }
  return { svg: g({ class: "fig-log" }, ...parts), h: y - y0 };
}

const XMAX = 36000;
function budget(r: Run, turn: number, stage: number, x0: number, y0: number, w: number, L: L, lang: Lang, uid: string): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const c = r.ctx[turn];
  let y = y0;
  for (const ln of wrapRich(tpl(L.ctxTitle, { n: turn + 1 }), TYPE.label, w)) {
    parts.push(rich(x0, y + 14, ln, TYPE.label, { class: "fig-t-strong" })); y += 19;
  }
  y += 16;
  const labW = 30;
  const x = linear([0, XMAX], [x0 + labW, x0 + w - 4]);
  const barH = 18;
  // x_t: the budget terms, in the order the equation writes them.
  const segs: Array<[number, string, number | undefined]> = [
    [B_FIXED, C.c3, undefined], [B_TASK, C.c4, undefined],
    [c.verbatim, C.c1, undefined], [c.summary, C.c1, 0.3],
    [c.tools, C.c2, undefined], [B_OUT, C.c5, undefined],
  ];
  const wx = x(W);
  const barTop = y;
  parts.push(rich(x0, y + 13, L.xRow, size, { class: "fig-t-strong" }));
  let a = 0;
  for (const [v, fill, op] of segs) {
    if (v > 0) parts.push(el("rect", { x: x(a), y, width: Math.max(0.8, x(a + v) - x(a) - 0.6), height: barH, fill, "fill-opacity": op }));
    a += v;
  }
  y += barH + 8;
  // s_t: every record of the log, by how it enters x_t.
  parts.push(rich(x0, y + 13, L.sRow, size, { class: "fig-t-strong" }));
  const lg = logAt(r, turn, stage);
  a = 0;
  const rec = (v: number, fill: string, op?: number, stroke?: string) => {
    parts.push(el("rect", { x: x(a), y, width: Math.max(0.8, x(a + v) - x(a) - 0.8), height: barH, fill, "fill-opacity": op, stroke, "stroke-width": stroke ? 1.2 : undefined }));
    a += v;
  };
  rec(SESSION_RAW, `url(#${uid}-never)`);
  for (let i = 0; i < lg.n; i++) {
    if (i >= turn) rec(r.turns[i].raw, "none", undefined, C.ink);
    else rec(r.turns[i].raw, C.c1, c.reps[i] === "summary" ? 0.3 : 1);
  }
  y += barH;
  // The window W across both bars.
  parts.push(el("line", { x1: wx, x2: wx, y1: barTop - 6, y2: y + 4, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  parts.push(text(wx + 5, barTop - 1, L.wMark, { "font-size": size, class: "fig-t-strong fig-t-num" }));
  y += 6;
  // Axis.
  parts.push(el("line", { x1: x(0), x2: x(XMAX), y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  for (const v of [0, 10000, 20000, 30000]) {
    parts.push(el("line", { x1: x(v), x2: x(v), y1: y, y2: y + 4, stroke: C.rule, "stroke-width": 1 }));
    parts.push(text(x(v), y + 17, v ? kt(v) : "0", { "font-size": size, "text-anchor": "middle", class: "fig-t-num fig-t-muted" }));
  }
  parts.push(text((x(0) + x(XMAX)) / 2, y + 36, L.xAxis, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
  y += 48;
  // Legend for the budget terms.
  let lx = x0;
  const items: Array<[string, string, number | undefined]> = [
    [L.fixed, C.c3, undefined], [L.task, C.c4, undefined], [L.stateV, C.c1, undefined], [L.stateS, C.c1, 0.3], [L.tools, C.c2, undefined], [L.out, C.c5, undefined],
  ];
  for (const [name, fill, op] of items) {
    const iw = 17 + richWidth(name, size);
    if (lx > x0 && lx + iw > x0 + w) { lx = x0; y += 19; }
    parts.push(el("rect", { x: lx, y: y + 1, width: 11, height: 11, rx: 2, fill, "fill-opacity": op }), rich(lx + 17, y + 11, name, size));
    lx += iw + 14;
  }
  y += 26;
  // The equation with this turn's numbers, and what A_t holds.
  const eq = tpl(L.sum, { f: kt(B_FIXED), a: kt(B_TASK), s: kt(c.state), o: kt(c.tools), r: kt(B_OUT), c: kt(c.total) });
  for (const ln of wrapRich(eq, size, w)) { parts.push(rich(x0, y + 12, ln, size, { class: "fig-t-num" })); y += 18; }
  const tr = r.turns[turn];
  const toolsLine = c.toolNames.length === Object.keys(TOOLS).length ? L.toolsFlat : tpl(L.toolsPhase, { list: c.toolNames.join(lang === "zh" ? "、" : ", "), p: L[tr.phase] });
  for (const ln of wrapRich(toolsLine, size, w)) { parts.push(rich(x0, y + 12, ln, size, { class: "fig-t-muted" })); y += 18; }
  return { svg: g({ class: "fig-budget" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const r = run(p);
  const { turn, stage } = position(r, st.t);
  const c = r.ctx[turn];
  const lg = logAt(r, turn, stage);
  const v = c.reps.filter((x) => x === "verbatim").length;
  return tpl(L.describe, {
    n: turn + 1, N: r.turns.length, stage: plain(L[PHASES[stage]]),
    detail: plain(PHASES[stage] === "decide" ? decision(r.turns[turn], lang) : stageDetail(r, p, turn, stage, L, lang)),
    r: lg.records, k: kt(lg.tokens), c: kt(c.total), v, m: turn - v, a: r.used[turn], b: p.budget,
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const r = run(p);
  const { turn, stage } = position(r, st.t);
  const defs = el("defs", {}, hatch(`${st.uid}-never`, C.ink3, 4, 1));
  const parts: string[] = [defs];
  let y = 0;
  if (narrow) {
    const tk = track(r, p, turn, stage, 0, y, w, L, lang);
    parts.push(tk.svg); y += tk.h + 14;
    const lg = eventLog(r, turn, stage, 0, y, w, L, lang, st.uid);
    parts.push(lg.svg); y += lg.h + 18;
  } else {
    const tw = Math.floor(w * 0.5) - 6;
    const tk = track(r, p, turn, stage, 0, y, tw, L, lang);
    const lg = eventLog(r, turn, stage, tw + 18, y, w - tw - 18, L, lang, st.uid);
    parts.push(tk.svg, lg.svg);
    y += Math.max(tk.h, lg.h) + 18;
  }
  const bd = budget(r, turn, stage, 0, y, w, L, lang, st.uid);
  parts.push(bd.svg);
  y += bd.h + 4;
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "agent-turn-loop",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    catalog: {
      kind: "choice", label: { en: "Action catalog", zh: "动作目录" }, default: "flat",
      options: [
        { value: "flat", label: { en: "Flat, all tools", zh: "扁平，全部工具" } },
        { value: "phases", label: { en: "Mounted by phase", zh: "按阶段挂载" } },
      ],
    },
    budget: { kind: "range", label: { en: "Action budget", zh: "动作预算" }, unit: { en: "actions", zh: "次动作" }, min: 3, max: 10, step: 1, default: 8 },
  },
  timeline: {
    rate: 1.5,
    discrete: true,
    duration: (p) => run(p).steps.length - 1,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const r = run(p);
      const out = r.turns.map((tr, i) => ({ t: i * PHASES.length, label: plain(tpl(L.kf, { n: i + 1, d: decision(tr, lang), g: tr.guard[lang] })) }));
      const last = r.turns.length - 1;
      out.push({ t: r.steps.length - 1, label: plain(tpl(L.kfExit, { n: last + 1, c: stageDetail(r, p, last, PHASES.length - 1, L, lang) })) });
      return out;
    },
    // The denied write: the guard's verdict becomes an observation and no
    // side effect happens.
    poster: () => 2 * PHASES.length + PHASES.indexOf("guard"),
  },
  render,
  describe,
});
