// One training run walked through the control plane's state machine, with the
// durable run record the controller reconciles against. The states and edges
// are the chapter's: an immutable run specification creates the record; the
// controller reconciles it into Pending, admits capacity into Starting
// (admission, preflight, rendezvous), reaches Running when the group is
// healthy, and loops through Checkpointing (save, then commit) or Recovering
// (fence, replace, restore) until a terminal state. Every live state can be
// canceled, which the diagram draws as one exit from the region of live
// states.
//
// The generation in the record is the fencing token. Admission and every
// recovery advance it, cancellation revokes it, and a write is accepted only
// when its token equals the record's generation, so a paused worker of an old
// generation can compute but cannot publish. The three scenarios are
// illustrative sequences of the chapter's transitions (four workers,
// checkpoints every 1,000 steps), not measurements.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- run

type StateKey = "none" | "pending" | "starting" | "running" | "checkpointing" | "recovering" | "succeeded" | "failed" | "canceled";
type EdgeKey = "create" | "reconcile" | "capacity" | "healthy" | "save" | "commit" | "fault" | "newgen" | "exhausted" | "stop" | "cancel" | "none";
type Scenario = "fault" | "exhausted" | "cancel";
type P = { scenario: Scenario };

// One timeline position: the transition just taken (or an event inside a
// state) and the durable record after it.
interface Frame {
  ev: string; // label key of the event
  edge: EdgeKey;
  state: StateKey;
  gen: number; // record generation, the fencing token
  revoked: boolean; // cancellation revoked the generation
  workers: string; // label key of membership
  step: number; // last progress heartbeat
  ckpt: number; // latest committed checkpoint step (0 = none)
  ckptGen: number;
  failures: number;
  attempts: number; // failed preflight attempts in the current recovery
  rejected?: { token: number; step: number }; // a stale write this frame
  result: string; // label key of the terminal result, "" while live
}

const RETRIES = 3;

function frames(s: Scenario): Frame[] {
  const out: Frame[] = [];
  let f: Frame = { ev: "evCreate", edge: "create", state: "none", gen: 0, revoked: false, workers: "wNone", step: 0, ckpt: 0, ckptGen: 0, failures: 0, attempts: 0, result: "" };
  const push = (d: Partial<Frame>) => { f = { ...f, rejected: undefined, ...d }; out.push(f); };
  out.push(f);
  push({ ev: "evReconcile", edge: "reconcile", state: "pending" });
  push({ ev: "evAdmit", edge: "capacity", state: "starting", gen: 1, workers: "wJoin" });
  push({ ev: "evHealthy", edge: "healthy", state: "running", workers: "wAll" });
  push({ ev: "evSave", edge: "save", state: "checkpointing", step: 1000 });
  push({ ev: "evCommit", edge: "commit", state: "running", ckpt: 1000, ckptGen: 1 });
  if (s === "cancel") {
    push({ ev: "evCancel", edge: "cancel", state: "canceled", step: 1400, revoked: true, workers: "wStop", result: "rCanceled" });
    push({ ev: "evStaleCancel", edge: "none", rejected: { token: 1, step: 1420 } });
    push({ ev: "evCleanup", edge: "none", workers: "wNone" });
    return out;
  }
  push({ ev: "evFault", edge: "fault", state: "recovering", step: 1400, gen: 2, failures: 1, workers: "wLost" });
  push({ ev: "evNewGen", edge: "newgen", state: "starting", workers: "wJoin" });
  if (s === "fault") {
    push({ ev: "evStale", edge: "none", rejected: { token: 1, step: 1400 } });
    push({ ev: "evResume", edge: "healthy", state: "running", workers: "wAll", step: 1000 });
    push({ ev: "evSave", edge: "save", state: "checkpointing", step: 2000 });
    push({ ev: "evCommit", edge: "commit", state: "running", ckpt: 2000, ckptGen: 2 });
    push({ ev: "evStop", edge: "stop", state: "succeeded", step: 2500, workers: "wNone", result: "rSucceeded" });
    return out;
  }
  for (let a = 1; a <= RETRIES; a++) push({ ev: "evPreflight", edge: "none", attempts: a, failures: 1 + a });
  push({ ev: "evExhausted", edge: "exhausted", state: "failed", workers: "wNone", result: "rFailed" });
  return out;
}

const memo = new Map<Scenario, Frame[]>();
function run(s: Scenario): Frame[] {
  let r = memo.get(s);
  if (!r) { r = frames(s); memo.set(s, r); }
  return r;
}

// The most informative position: the rejected stale write, or the terminal
// failure when retries run out.
function poster(s: Scenario): number {
  const r = run(s);
  const stale = r.findIndex((f) => f.rejected);
  return stale >= 0 ? stale : r.length - 1;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "A run reconciled through the control plane's state machine",
    spec: "run spec",
    record: "run record",
    pending: "Pending",
    starting: "Starting",
    running: "Running",
    checkpointing: "Checkpointing",
    recovering: "Recovering",
    succeeded: "Succeeded",
    failed: "Failed",
    canceled: "Canceled",
    live: "live states, generation {g}",
    liveRevoked: "live states, generation {g} revoked",
    eCreate: "create",
    eReconcile: "reconcile",
    eCapacity: "capacity",
    eHealthy: "healthy",
    eSave: "save",
    eCommit: "commit",
    eFault: "retryable|fault",
    eNewgen: "new|generation",
    eExhausted: "retries exhausted",
    eStop: "stop rule met",
    eCancel: "cancel",
    panel: "Durable run record",
    kState: "state",
    kGen: "generation (fencing token)",
    kWorkers: "membership",
    kStep: "last progress",
    kCkpt: "latest committed checkpoint",
    kCursor: "data cursor",
    kFail: "failure history",
    kResult: "terminal result",
    none: "none",
    stepN: "step {n}",
    ckptN: "step {n}, generation {g}",
    cursorN: "after step {n}",
    genN: "{g}",
    genRevoked: "{g}, revoked",
    failN: "{n:failure/failures}",
    wNone: "no workers",
    wJoin: "4 workers joining generation {g}",
    wAll: "4 of 4 healthy, generation {g}",
    wLost: "3 of 4, one node lost",
    wStop: "stopping",
    rSucceeded: "succeeded at step 2,500",
    rFailed: "failed after {n} preflight attempts",
    rCanceled: "canceled at step 1,400",
    evCreate: "The immutable run spec creates the durable run record, generation 0.",
    evReconcile: "The controller compares desired and observed state and records Pending.",
    evAdmit: "Capacity is admitted as a gang; generation 1 begins preflight and rendezvous.",
    evHealthy: "Membership, health, and progress hold for generation 1: Running.",
    evSave: "At the step {s} boundary the run stages state and writes shards.",
    evCommit: "The manifest for step {s} publishes under token {g}; the record points to it.",
    evFault: "A node is lost at step 1,400. The fault is retryable: generation 1 is fenced and generation 2 allocated.",
    evNewGen: "Replacement capacity rendezvouses as generation 2 and restores the step 1,000 checkpoint and cursor.",
    evStale: "A paused worker of generation 1 resumes and tries to publish step 1,400: token 1 ≠ 2, rejected.",
    evResume: "Generation 2 is healthy and resumes from step 1,000.",
    evStop: "The stop rule is met; the final artifact is written under generation 2.",
    evPreflight: "Preflight fails on the replacement node, attempt {a} of {n}.",
    evExhausted: "The same signature recurs {n} times; retries are exhausted and the run fails for repair.",
    evCancel: "Cancellation: the controller records Canceled and revokes generation 1 before asking workers to stop.",
    evStaleCancel: "A worker still running writes a final artifact at step 1,420 with token 1: rejected, the generation is revoked.",
    evCleanup: "Workers stop; generation-scoped outputs are collected, and the committed step 1,000 checkpoint is kept.",
    rejected: "write rejected: token {t} ≠ {g}",
    edgeTo: "{e}: {s}",
    rejectedRevoked: "write rejected: token {t} revoked",
    describe: "Step {t} of {d}: {ev} State {st}, generation {g}.",
  },
  zh: {
    title: "一次运行在控制平面状态机中的调谐过程",
    spec: "运行规格",
    record: "运行记录",
    pending: "等待中",
    starting: "启动中",
    running: "运行中",
    checkpointing: "保存检查点",
    recovering: "恢复中",
    succeeded: "成功",
    failed: "失败",
    canceled: "已取消",
    live: "活动状态，第 {g} 代",
    liveRevoked: "活动状态，第 {g} 代已撤销",
    eCreate: "创建",
    eReconcile: "调谐",
    eCapacity: "获得容量",
    eHealthy: "健康",
    eSave: "保存",
    eCommit: "提交",
    eFault: "可重试|故障",
    eNewgen: "新|代次",
    eExhausted: "重试耗尽",
    eStop: "满足停止规则",
    eCancel: "取消",
    panel: "持久运行记录",
    kState: "状态",
    kGen: "代次（隔离令牌）",
    kWorkers: "成员",
    kStep: "最近进度",
    kCkpt: "最新已提交检查点",
    kCursor: "数据游标",
    kFail: "故障历史",
    kResult: "终止结果",
    none: "无",
    stepN: "第 {n} 步",
    ckptN: "第 {n} 步，第 {g} 代",
    cursorN: "第 {n} 步之后",
    genN: "{g}",
    genRevoked: "{g}，已撤销",
    failN: "{n} 次故障",
    wNone: "无工作进程",
    wJoin: "4 个工作进程加入第 {g} 代",
    wAll: "4/4 健康，第 {g} 代",
    wLost: "3/4，一个节点丢失",
    wStop: "正在停止",
    rSucceeded: "在第 2,500 步成功",
    rFailed: "预检 {n} 次失败后终止",
    rCanceled: "在第 1,400 步取消",
    evCreate: "不可变的运行规格创建持久运行记录，代次为 0。",
    evReconcile: "控制器比较期望状态与观测状态，记录为等待中。",
    evAdmit: "资源以成组方式获准；第 1 代开始预检与会合。",
    evHealthy: "第 1 代的成员、健康与进度不变量都成立：运行中。",
    evSave: "在第 {s} 步边界，运行暂存状态并写入分片。",
    evCommit: "第 {s} 步的清单以令牌 {g} 发布；记录指向它。",
    evFault: "第 1,400 步时丢失一个节点。该故障可重试：隔离第 1 代，分配第 2 代。",
    evNewGen: "替换资源以第 2 代会合，并恢复第 1,000 步的检查点与游标。",
    evStale: "第 1 代一个暂停的工作进程恢复运行，试图发布第 1,400 步：令牌 1 ≠ 2，被拒绝。",
    evResume: "第 2 代健康，从第 1,000 步继续。",
    evStop: "满足停止规则；最终产物以第 2 代写入。",
    evPreflight: "替换节点预检失败，第 {a} 次，共 {n} 次。",
    evExhausted: "同一故障特征重复出现 {n} 次；重试耗尽，运行失败，等待修复。",
    evCancel: "取消：控制器先记录已取消并撤销第 1 代，再要求工作进程停止。",
    evStaleCancel: "一个仍在运行的工作进程在第 1,420 步以令牌 1 写最终产物：代次已撤销，写入被拒绝。",
    evCleanup: "工作进程停止；按代次划分的输出被回收，第 1,000 步已提交的检查点保留。",
    rejected: "写入被拒：令牌 {t} ≠ {g}",
    edgeTo: "{e}：{s}",
    rejectedRevoked: "写入被拒：令牌 {t} 已撤销",
    describe: "第 {t} 步（共 {d} 步）：{ev}状态为{st}，第 {g} 代。",
  },
};
type L = typeof labels.en;

function evText(f: Frame, L: L): string {
  return tpl(L[f.ev as keyof L], { s: f.step, g: f.gen, a: f.attempts, n: RETRIES }).replace(/\b(\d{4})\b/g, (m) => Number(m).toLocaleString("en-US"));
}

function stateName(k: StateKey, L: L): string {
  return k === "none" ? L.none : L[k];
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const r = run(st.p.scenario);
  const t = Math.min(Math.max(0, Math.round(st.t)), r.length - 1);
  const f = r[t];
  return tpl(L.describe, { t, d: r.length - 1, ev: evText(f, L) + (lang === "zh" ? "" : " "), st: stateName(f.state, L), g: f.gen });
}


// ---------------------------------------------------------------- diagram

interface Box { cx: number; top: number; w: number; h: number }

// The state diagram, laid out top to bottom for a column of width D: the
// happy path down the left-center column, the checkpoint and recovery loops
// in a right column, and the terminal states in a row under the live region.
function diagram(f: Frame, D: number, L: L, uid: string, size: number): { svg: string; h: number } {
  const parts: string[] = [];
  const bh = 30, gap = 46;
  const bw = Math.min(124, Math.floor(D * 0.31));
  const xC = 28 + bw / 2, xR = D - 12 - bw / 2;
  // Row 0 (spec and record) sits above the live region with extra room for
  // the region's border between it and Pending.
  const rowTop = (i: number) => i * (bh + gap) + (i >= 1 ? 14 : 0);
  const liveTop = rowTop(1) - 28, liveBottom = rowTop(3) + bh + 16;
  const termTop = liveBottom + 34;
  const bwT = Math.min(bw, Math.floor((D - 20) / 3));
  const B: Record<string, Box> = {
    spec: { cx: xR, top: rowTop(0), w: bw, h: bh },
    record: { cx: xC, top: rowTop(0), w: bw, h: bh },
    pending: { cx: xC, top: rowTop(1), w: bw, h: bh },
    starting: { cx: xC, top: rowTop(2), w: bw, h: bh },
    recovering: { cx: xR, top: rowTop(2), w: bw, h: bh },
    running: { cx: xC, top: rowTop(3), w: bw, h: bh },
    checkpointing: { cx: xR, top: rowTop(3), w: bw, h: bh },
    failed: { cx: 2 + bwT / 2, top: termTop, w: bwT, h: bh },
    succeeded: { cx: D / 2, top: termTop, w: bwT, h: bh },
    canceled: { cx: D - 2 - bwT / 2, top: termTop, w: bwT, h: bh },
  };
  const l = (b: Box) => b.cx - b.w / 2, r = (b: Box) => b.cx + b.w / 2, mid = (b: Box) => b.top + b.h / 2, bot = (b: Box) => b.top + b.h;
  const marker = (id: string, color: string) => el("marker", { id: `${uid}-${id}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
    el("path", { d: "M0,0L10,5L0,10Z", fill: color }));
  parts.push(el("defs", {}, marker("idle", C.ink3), marker("on", C.c1)));

  // Live region: every state inside it can be canceled.
  const revoked = f.revoked;
  parts.push(el("rect", { x: 18, y: liveTop, width: D - 20, height: liveBottom - liveTop, rx: 10, fill: "none", stroke: C.rule, "stroke-width": 1.2, "stroke-dasharray": "5 4" }));
  parts.push(text(D - 10, liveTop + 16, tpl(revoked ? L.liveRevoked : L.live, { g: f.gen }), { "font-size": size, "text-anchor": "end", class: revoked ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));

  // Edges: route points, label lines, and where the label sits.
  type Edge = { key: EdgeKey; pts: Array<[number, number]>; label: string; lx: number; ly: number; anchor: "start" | "middle" | "end" };
  const S = B.spec, Rc = B.record, Pe = B.pending, St = B.starting, Rv = B.recovering, Ru = B.running, Ck = B.checkpointing, Fa = B.failed, Su = B.succeeded, Ca = B.canceled;
  const gx = (r(St) + l(Rv)) / 2; // middle of the column gap
  const stopTo: [number, number] = [Su.cx - 10, Su.top];
  const stopFrom: [number, number] = [Ru.cx + 18, bot(Ru)];
  const edges: Edge[] = [
    { key: "create", pts: [[l(S), mid(S)], [r(Rc), mid(Rc)]], label: L.eCreate, lx: gx, ly: mid(S) - 8, anchor: "middle" },
    { key: "reconcile", pts: [[Rc.cx, bot(Rc)], [Pe.cx, Pe.top]], label: L.eReconcile, lx: Rc.cx + 7, ly: (bot(Rc) + liveTop) / 2 + 5, anchor: "start" },
    { key: "capacity", pts: [[Pe.cx, bot(Pe)], [St.cx, St.top]], label: L.eCapacity, lx: Pe.cx + 7, ly: (bot(Pe) + St.top) / 2 + 4, anchor: "start" },
    { key: "healthy", pts: [[St.cx, bot(St)], [Ru.cx, Ru.top]], label: L.eHealthy, lx: St.cx - 7, ly: (bot(St) + Ru.top) / 2 + 4, anchor: "end" },
    { key: "save", pts: [[r(Ru), mid(Ru) - 6], [l(Ck), mid(Ck) - 6]], label: L.eSave, lx: gx, ly: mid(Ru) - 11, anchor: "middle" },
    { key: "commit", pts: [[l(Ck), mid(Ck) + 6], [r(Ru), mid(Ru) + 6]], label: L.eCommit, lx: gx, ly: mid(Ru) + 6 + size + 3, anchor: "middle" },
    { key: "fault", pts: [[r(Ru) - 12, Ru.top], [l(Rv) + 12, bot(Rv)]], label: L.eFault, lx: l(Rv) + 14, ly: Ru.top - 20, anchor: "start" },
    { key: "newgen", pts: [[l(Rv), mid(Rv)], [r(St), mid(St)]], label: L.eNewgen, lx: gx, ly: mid(St) - 8 - size - 2, anchor: "middle" },
    { key: "exhausted", pts: [[l(St), mid(St)], [10, mid(St)], [10, Fa.top]], label: L.eExhausted, lx: 16, ly: Fa.top - 9, anchor: "start" },
    { key: "stop", pts: [stopFrom, stopTo], label: L.eStop, lx: stopTo[0] + 4, ly: Fa.top - 9, anchor: "start" },
    { key: "cancel", pts: [[Ca.cx, liveBottom], [Ca.cx, Ca.top]], label: L.eCancel, lx: Ca.cx + 9, ly: Fa.top - 9, anchor: "start" },
  ];
  for (const e of edges) {
    const on = e.key === f.edge;
    const d = e.pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("");
    parts.push(el("path", { d, fill: "none", stroke: on ? C.c1 : C.ink3, "stroke-width": on ? 2.6 : 1.3, "stroke-linejoin": "round", "marker-end": `url(#${uid}-${on ? "on" : "idle"})` }));
  }
  // Labels after all lines, so a halo sits over any line it crosses. A "|"
  // splits a label onto two lines, the second under the first.
  for (const e of edges) {
    const on = e.key === f.edge;
    const lines = e.label.split("|");
    lines.forEach((ln, i) => parts.push(text(e.lx, e.ly + (i - (lines.length - 1) / 2) * (size + 2) + (lines.length > 1 ? size / 2 - 2 : 0), ln, { "font-size": size, "text-anchor": e.anchor, class: on ? "fig-t-halo" : "fig-t-halo fig-t-soft" })));
  }

  // Boxes.
  for (const [key, b] of Object.entries(B)) {
    const isState = key !== "spec" && key !== "record";
    const current = isState ? f.state === key : (key === "record" && (f.edge === "create" || !!f.rejected));
    const bad = key === "record" && !!f.rejected;
    const stroke = bad ? C.bad : current ? C.c1 : C.rule;
    parts.push(el("rect", { x: l(b), y: b.top, width: b.w, height: b.h, rx: 7, fill: C.panel, stroke, "stroke-width": current ? 2.2 : 1 }));
    if (current && !bad) parts.push(el("rect", { x: l(b), y: b.top, width: b.w, height: b.h, rx: 7, fill: C.c1, "fill-opacity": 0.14 }));
    const name = L[key as keyof L];
    parts.push(text(b.cx, b.top + b.h / 2 + 4.5, name, { "font-size": D < 400 ? TYPE.body : TYPE.label, "text-anchor": "middle", class: current ? "fig-t-strong" : undefined }));
  }
  return { svg: g({ class: "fig-diagram" }, ...parts), h: termTop + bh + 2 };
}

// ---------------------------------------------------------------- record panel

function fields(f: Frame, L: L): Array<[string, string]> {
  return [
    [L.kState, stateName(f.state, L)],
    [L.kGen, tpl(f.revoked ? L.genRevoked : L.genN, { g: f.gen })],
    [L.kWorkers, tpl(L[f.workers as keyof L], { g: f.gen })],
    [L.kStep, f.state === "none" || f.state === "pending" ? L.none : tpl(L.stepN, { n: f.step.toLocaleString("en-US") })],
    [L.kCkpt, f.ckpt ? tpl(L.ckptN, { n: f.ckpt.toLocaleString("en-US"), g: f.ckptGen }) : L.none],
    [L.kCursor, f.ckpt ? tpl(L.cursorN, { n: f.ckpt.toLocaleString("en-US") }) : L.none],
    [L.kFail, f.failures ? tpl(L.failN, { n: f.failures }) : L.none],
    [L.kResult, f.result ? tpl(L[f.result as keyof L], { n: RETRIES }) : L.none],
  ];
}

function panel(frs: Frame[], t: number, x0: number, pw: number, L: L, size: number): { svg: string; h: number } {
  const f = frs[t];
  const prev = t > 0 ? frs[t - 1] : undefined;
  const parts: string[] = [];
  let y = 14;
  parts.push(text(x0, y, L.panel, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 20;
  // The event, with the most lines any step needs reserved so the figure
  // keeps its height while it plays.
  const most = Math.max(...frs.map((q) => wrapCjk(evText(q, L), TYPE.body, pw).length));
  wrapCjk(evText(f, L), TYPE.body, pw).forEach((ln, i) => parts.push(text(x0, y + i * 17, ln, { "font-size": TYPE.body })));
  y += most * 17 + 4;
  // A rejected write, where one happens.
  const rej = f.rejected ? tpl(f.revoked ? L.rejectedRevoked : L.rejected, { t: f.rejected.token, g: f.gen }) : "";
  if (rej) {
    parts.push(el("circle", { cx: x0 + 5, cy: y - 4, r: 4, fill: C.bad }));
    parts.push(text(x0 + 14, y, rej, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
  }
  y += frs.some((q) => q.rejected) ? 22 : 4;
  const before = prev ? fields(prev, L) : undefined;
  fields(f, L).forEach(([k, v], i) => {
    parts.push(el("line", { x1: x0, x2: x0 + pw, y1: y - 13, y2: y - 13, stroke: C.grid, "stroke-width": 1 }));
    parts.push(text(x0, y + 1, k, { "font-size": size, class: "fig-t-muted" }));
    const changed = !!before && before[i][1] !== v;
    const lines = wrapCjk(v, TYPE.body, pw);
    lines.forEach((ln, j) => parts.push(text(x0, y + 18 + j * 16, ln, { "font-size": TYPE.body, class: changed ? "fig-t-strong fig-t-num" : "fig-t-num" })));
    y += 20 + lines.length * 16 + 4;
  });
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - 10 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const frs = run(st.p.scenario);
  const t = Math.min(Math.max(0, Math.round(st.t)), frs.length - 1);
  const f = frs[t];
  const parts: string[] = [];
  let h: number;
  if (narrow) {
    const d = diagram(f, w, L, st.uid, size);
    parts.push(d.svg);
    const pn = panel(frs, t, 0, w, L, size);
    parts.push(g({ transform: `translate(0 ${d.h + 18})` }, pn.svg));
    h = d.h + 18 + pn.h;
  } else {
    const D = Math.min(400, Math.floor(w * 0.58));
    const d = diagram(f, D, L, st.uid, size);
    parts.push(d.svg);
    const pn = panel(frs, t, D + 22, w - D - 22, L, size);
    parts.push(pn.svg);
    h = Math.max(d.h, pn.h);
  }
  return svg(w, h + 4, describe(st, lang), ...parts);
}

function keyLabel(f: Frame, lang: Lang): string {
  const L = labels[lang];
  if (f.rejected) return f.revoked ? L.rejectedRevoked.replace("{t}", String(f.rejected.token)) : tpl(L.rejected, { t: f.rejected.token, g: f.gen });
  if (f.edge !== "none") {
    const e = L[({ create: "eCreate", reconcile: "eReconcile", capacity: "eCapacity", healthy: "eHealthy", save: "eSave", commit: "eCommit", fault: "eFault", newgen: "eNewgen", exhausted: "eExhausted", stop: "eStop", cancel: "eCancel" } as const)[f.edge]];
    return tpl(L.edgeTo, { e: e.replace("|", lang === "zh" ? "" : " "), s: f.state === "none" ? L.record : stateName(f.state, L) });
  }
  return evText(f, L);
}

export default defineFigure({
  name: "run-lifecycle",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    scenario: {
      kind: "choice", label: { en: "What happens", zh: "运行经历" }, default: "fault",
      options: [
        { value: "fault", label: { en: "Retryable fault", zh: "可重试故障" } },
        { value: "exhausted", label: { en: "Retries exhausted", zh: "重试耗尽" } },
        { value: "cancel", label: { en: "Canceled", zh: "被取消" } },
      ],
    },
  },
  timeline: {
    rate: 0.8,
    discrete: true,
    duration: (p) => run(p.scenario).length - 1,
    keyframes: (p, lang) => run(p.scenario).map((f, t) => ({ t, label: keyLabel(f, lang) })),
    poster: (p) => poster(p.scenario),
  },
  render,
  describe,
});
