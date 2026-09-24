// A durable step that creates a support ticket, the chapter's example, with
// the worker crashing at a point the reader chooses and one of four recovery
// policies from the chapter's guarantee table and idempotency-key protocol.
//
// The first attempt is the planned sequence
//
//   1  worker -> journal   Scheduled(i, k, H(x), v)
//   2  worker -> service   create_ticket(x)            (with key k when keyed)
//   3  service             commits ticket 8421
//   4  service -> worker   ticket 8421
//   5  worker -> journal   Completed(i, 8421)
//
// and the crash points sit between these rows: 1 before Scheduled, 2 after
// Scheduled, 3 with the request in flight (the service never receives it),
// 4 after the service commits and before Completed is persisted (the reply is
// lost), 5 after Completed. Recovery replays the journal. With no record of
// step i it runs the step; with Completed(i, r) it substitutes r and makes no
// call. At crash points 2, 3 and 4 the journal holds the same thing,
// Scheduled without Completed, so recovery acts on the policy alone:
//
// - at most once: never retry an ambiguous attempt; the outcome stays unknown
//   to the workflow and goes to an operator (the ticket may or may not exist).
// - at least once: retry without a key; the service creates a second ticket
//   when the first attempt had committed.
// - same key: the chapter's run_effect, lookup(k) then apply with k on the
//   receiver's shared deduplication record; the retry returns the first
//   ticket.
// - reconcile: the service has no keyed interface, so recovery searches its
//   records for a ticket matching the input fingerprint before creating one.
//
// A transactionally coupled mutation needs a shared transactional boundary,
// which a journal and an external ticket service do not have, so it is not a
// policy here. The model is exact for this sequence; ticket numbers are
// illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

export type Crash = "none" | "before" | "scheduled" | "inflight" | "committed" | "completed";
export type Policy = "atmost" | "atleast" | "keyed" | "reconcile";
export const CRASHES: Crash[] = ["none", "before", "scheduled", "inflight", "committed", "completed"];
export const POLICIES: Policy[] = ["atmost", "atleast", "keyed", "reconcile"];

type Lane = 0 | 1 | 2; // journal, worker, ticket service
type Look = "done" | "lost" | "skipped";
type Tone = "plain" | "commit" | "warn";
export type Row =
  | { k: "msg"; from: Lane; to: Lane; label: string; look: Look }
  | { k: "note"; at: Lane; label: string; look: Look; tone: Tone }
  | { k: "sep"; label: string };

export type Verdict = "once" | "duplicate" | "lost" | "unknown";
export interface Outcome {
  first: Row[]; // the planned first attempt, rows after the crash marked skipped or lost
  gapAfter: number; // crash marker after this many first-attempt rows (−1: none)
  recovery: Row[];
  journal: string[]; // entries for step i after recovery
  unresolved: boolean; // Scheduled without Completed after recovery
  tickets: number[]; // tickets the service holds
  verdict: Verdict;
  view: "none" | "scheduled" | "completed" | "clean"; // what recovery reads from the journal
}

type T = Record<string, string>;
const FIRST_ID = 8421;

// Rows of one create sequence that commits ticket `id`.
function create(L: T, keyed: boolean, id: number): Row[] {
  return [
    { k: "msg", from: 1, to: 2, label: keyed ? L.createKeyed : L.create, look: "done" },
    { k: "note", at: 2, label: tpl(L.commit, { id }), look: "done", tone: "commit" },
    { k: "msg", from: 2, to: 1, label: tpl(L.reply, { id }), look: "done" },
    { k: "msg", from: 1, to: 0, label: tpl(L.completed, { id }), look: "done" },
  ];
}

export function outcome(crash: Crash, policy: Policy, L: T): Outcome {
  const keyed = policy === "keyed";
  // Crash position as a count of first-attempt rows that ran.
  const ran = { none: 5, before: 0, scheduled: 1, inflight: 2, committed: 3, completed: 5 }[crash];
  const committed = ran >= 3;
  const planned: Row[] = [
    { k: "msg", from: 1, to: 0, label: L.scheduled, look: "done" },
    ...create(L, keyed, FIRST_ID),
  ];
  const first = planned.map((r, i): Row => {
    if (r.k === "sep") return r;
    let look: Look = i < ran ? "done" : "skipped";
    if (crash === "inflight" && i === 1) look = "lost";
    if (crash === "committed" && i === 3) look = "lost";
    return { ...r, look };
  });
  const gapAfter = crash === "none" ? -1 : crash === "inflight" ? 2 : crash === "committed" ? 3 : ran;
  if (crash === "none") {
    return { first, gapAfter, recovery: [], journal: [L.scheduled, tpl(L.completed, { id: FIRST_ID })], unresolved: false, tickets: [FIRST_ID], verdict: "once", view: "clean" };
  }
  const rec: Row[] = [{ k: "sep", label: L.recovery }, { k: "msg", from: 1, to: 0, label: L.read, look: "done" }];
  const tickets = committed ? [FIRST_ID] : [];
  const next = () => (tickets.length ? tickets[tickets.length - 1] + 1 : FIRST_ID);
  if (crash === "before") {
    rec.push({ k: "msg", from: 0, to: 1, label: L.viewNone, look: "done" });
    rec.push({ k: "msg", from: 1, to: 0, label: L.scheduled, look: "done" }, ...create(L, keyed, next()));
    tickets.push(next());
    return { first, gapAfter, recovery: rec, journal: [L.scheduled, tpl(L.completed, { id: FIRST_ID })], unresolved: false, tickets, verdict: "once", view: "none" };
  }
  if (crash === "completed") {
    rec.push({ k: "msg", from: 0, to: 1, label: tpl(L.completed, { id: FIRST_ID }), look: "done" });
    rec.push({ k: "note", at: 1, label: L.substitute, look: "done", tone: "plain" });
    return { first, gapAfter, recovery: rec, journal: [L.scheduled, tpl(L.completed, { id: FIRST_ID })], unresolved: false, tickets, verdict: "once", view: "completed" };
  }
  // Crash points 2, 3, 4: the journal shows Scheduled without Completed.
  rec.push({ k: "msg", from: 0, to: 1, label: L.viewScheduled, look: "done" });
  let found: number | null = null;
  if (policy === "atmost") {
    rec.push({ k: "note", at: 1, label: L.escalate, look: "done", tone: "warn" });
    return { first, gapAfter, recovery: rec, journal: [L.scheduled], unresolved: true, tickets, verdict: tickets.length ? "unknown" : "lost", view: "scheduled" };
  }
  if (policy === "keyed" || policy === "reconcile") {
    rec.push({ k: "msg", from: 1, to: 2, label: policy === "keyed" ? L.lookup : L.search, look: "done" });
    found = committed ? FIRST_ID : null;
    rec.push({ k: "msg", from: 2, to: 1, label: found ? tpl(L.found, { id: found }) : L.notFound, look: "done" });
  }
  if (found) {
    rec.push({ k: "msg", from: 1, to: 0, label: tpl(L.completed, { id: found }), look: "done" });
  } else {
    const id = next();
    rec.push(...create(L, keyed, id));
    tickets.push(id);
  }
  const last = tickets[tickets.length - 1];
  return {
    first, gapAfter, recovery: rec, journal: [L.scheduled, tpl(L.completed, { id: found ?? last })], unresolved: false,
    tickets, verdict: tickets.length > 1 ? "duplicate" : "once", view: "scheduled",
  };
}

// ---------------------------------------------------------------- figure

const labels = {
  en: {
    title: "A crash around an external side effect",
    journalLane: "journal J",
    workerLane: "worker",
    serviceLane: "ticket service",
    scheduled: "Scheduled(i, k, H(x), v)",
    create: "create_ticket(x)",
    createKeyed: "create_ticket(x, key k)",
    commit: "commits ticket {id}",
    reply: "ticket {id}",
    completed: "Completed(i, {id})",
    lost: "lost",
    crash: "crash",
    recovery: "Recovery replays J",
    read: "read the history of step i",
    viewNone: "nothing for step i",
    viewScheduled: "Scheduled, no Completed",
    substitute: "use the recorded result, no call",
    escalate: "outcome unknown: no retry, an operator decides",
    lookup: "lookup(key k)",
    search: "search tickets matching H(x)",
    found: "found ticket {id}",
    notFound: "no such ticket",
    handle: "Crash points: click a number",
    after: "Final state",
    jTitle: "Journal J, step i",
    unresolved: "unresolved: Scheduled without Completed",
    sTitle: "Ticket service",
    noTicket: "no ticket",
    ticket: "#{id}",
    dup: "#{id}, duplicate",
    vOnce: "one ticket, and J records which",
    vDup: "duplicate effect: two tickets for one step",
    vLost: "no ticket, and J cannot tell whether one exists",
    vUnknown: "one ticket exists, but J cannot say so",
    mTitle: "Tickets after recovery, every crash point and policy",
    mCrash: "crash point",
    same: "J shows Scheduled only",
    none: "none",
    atmost: "at most once", atleast: "at least once", keyed: "same key", reconcile: "reconcile",
    lgOnce: "one, recorded",
    lgBad: "duplicate or lost",
    lgUnknown: "one, not recorded",
    describe: "Crash {c}, recovery policy {p}: {view}. The ticket service holds {n}; {v}.",
    dNone: "no crash, so no recovery",
    dRead: "recovery reads “{r}” from the journal",
    tickets: "{n:ticket/tickets}",
  },
  zh: {
    title: "外部副作用前后的崩溃",
    journalLane: "日志 J",
    workerLane: "工作进程",
    serviceLane: "工单服务",
    scheduled: "Scheduled(i, k, H(x), v)",
    create: "create_ticket(x)",
    createKeyed: "create_ticket(x, key k)",
    commit: "提交工单 {id}",
    reply: "工单 {id}",
    completed: "Completed(i, {id})",
    lost: "丢失",
    crash: "崩溃",
    recovery: "恢复时重放 J",
    read: "读取步骤 i 的历史",
    viewNone: "步骤 i 没有记录",
    viewScheduled: "有 Scheduled，没有 Completed",
    substitute: "代入已记录的结果，不再调用",
    escalate: "结果未知：不重试，交给操作人员",
    lookup: "lookup(key k)",
    search: "查找与 H(x) 匹配的工单",
    found: "找到工单 {id}",
    notFound: "没有这张工单",
    handle: "崩溃点：点击编号",
    after: "最终状态",
    jTitle: "日志 J，步骤 i",
    unresolved: "未解决：有 Scheduled，没有 Completed",
    sTitle: "工单服务",
    noTicket: "没有工单",
    ticket: "#{id}",
    dup: "#{id}，重复",
    vOnce: "一张工单，J 记录了是哪一张",
    vDup: "副作用重复：一个步骤产生两张工单",
    vLost: "没有工单，而 J 无法判断工单是否存在",
    vUnknown: "工单已经存在，但 J 无从证明",
    mTitle: "恢复后的工单数：所有崩溃点与恢复策略",
    mCrash: "崩溃点",
    same: "J 中只有 Scheduled",
    none: "无",
    atmost: "最多一次", atleast: "至少一次", keyed: "同一键", reconcile: "对账",
    lgOnce: "一张，已记录",
    lgBad: "重复或丢失",
    lgUnknown: "一张，未记录",
    describe: "崩溃点 {c}，恢复策略{p}：{view}。工单服务中有 {n}；{v}。",
    dNone: "没有崩溃，无需恢复",
    dRead: "恢复时从日志读到“{r}”",
    tickets: "{n} 张工单",
  },
};
type L = typeof labels.en;

type P = { crash: Crash; policy: Policy };

const CRASH_NUM: Record<Crash, string> = { none: "–", before: "1", scheduled: "2", inflight: "3", committed: "4", completed: "5" };
const GAP: Record<Exclude<Crash, "none">, number> = { before: 0, scheduled: 1, inflight: 2, committed: 3, completed: 5 };
const tone = (v: Verdict) => (v === "once" ? C.good : v === "unknown" ? C.warn : C.bad);

function verdictText(v: Verdict, L: L): string {
  return v === "once" ? L.vOnce : v === "duplicate" ? L.vDup : v === "lost" ? L.vLost : L.vUnknown;
}

// The sequence: lifelines, the planned first attempt with the crash marker and
// its clickable crash points, then the recovery rows.
function sequence(o: Outcome, p: P, w: number, y0: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  const left = 30; // crash-point handles
  const lanes = [left + (w - left) * 0.14, left + (w - left) * 0.5, left + (w - left) * 0.86];
  const names = [L.journalLane, L.workerLane, L.serviceLane];
  let y = y0;
  for (let i = 0; i < 3; i++) {
    const tw = textWidth(names[i], size) + 14;
    const cx = Math.min(Math.max(lanes[i], left + tw / 2), w - tw / 2);
    parts.push(el("rect", { x: cx - tw / 2, y, width: tw, height: 22, rx: 4, fill: C.panel, stroke: C.ink3, "stroke-width": 1 }));
    parts.push(text(cx, y + 15, names[i], { "font-size": size, "text-anchor": "middle", class: "fig-t-strong" }));
  }
  y += 30;
  const lifeTop = y - 8;
  const body: string[] = [];
  const clampText = (cx: number, s: string, yy: number, attrs: Record<string, string | number | undefined>) => {
    const tw = textWidth(s, size);
    const x = Math.min(Math.max(cx, left + tw / 2 + 2), w - tw / 2 - 2);
    return text(x, yy, s, { "font-size": size, "text-anchor": "middle", ...attrs });
  };
  const draw = (r: Row) => {
    if (r.k === "sep") {
      y += 6;
      body.push(el("line", { x1: left, x2: w, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
      body.push(text(left, y + 16, r.label, { "font-size": size, class: "fig-t-strong" }));
      y += 24;
      return;
    }
    const skipped = r.look === "skipped";
    const ink = skipped ? C.ink3 : C.ink;
    const tAttrs = skipped ? {} : { fill: C.ink };
    if (r.k === "note") {
      const tw = textWidth(r.label, size) + 14;
      const cx = Math.min(Math.max(lanes[r.at], left + tw / 2), w - tw / 2);
      const fill = r.tone === "commit" ? C.c1 : r.tone === "warn" ? C.warn : C.panel;
      body.push(el("rect", { x: cx - tw / 2, y: y + 2, width: tw, height: 20, rx: 4, fill: skipped ? "none" : fill, "fill-opacity": skipped ? undefined : r.tone === "plain" ? undefined : 0.2, stroke: ink, "stroke-width": 1, "stroke-dasharray": skipped ? "3 3" : undefined }));
      body.push(text(cx, y + 16, r.label, { "font-size": size, "text-anchor": "middle", ...tAttrs }));
      y += 26;
      return;
    }
    const x1 = lanes[r.from], x2 = lanes[r.to];
    const ay = y + 19;
    const dir = Math.sign(x2 - x1);
    const lost = r.look === "lost";
    const xe = lost ? (x1 + x2) / 2 : x2 - dir * 2;
    body.push(el("line", { x1, x2: xe, y1: ay, y2: ay, stroke: ink, "stroke-width": 1.25, "stroke-dasharray": skipped ? "4 3" : undefined }));
    if (lost) {
      body.push(el("path", { d: `M${xe - 4},${ay - 4} L${xe + 4},${ay + 4} M${xe - 4},${ay + 4} L${xe + 4},${ay - 4}`, stroke: C.bad, "stroke-width": 1.75, fill: "none" }));
      body.push(text(xe + dir * 8, ay + 4, L.lost, { "font-size": size, "text-anchor": dir > 0 ? "start" : "end", class: "fig-t-strong" }));
    } else {
      body.push(el("path", { d: `M${xe - dir * 6},${ay - 3.5} L${xe},${ay} L${xe - dir * 6},${ay + 3.5}`, fill: "none", stroke: ink, "stroke-width": 1.25 }));
    }
    // A lost message is labeled over the part that was sent, clear of the cross.
    if (lost) {
      const tw = textWidth(r.label, size);
      const lx = dir > 0 ? Math.max(left + 2, xe - 8 - tw) : Math.min(w - 2 - tw, xe + 8);
      body.push(text(lx, y + 12, r.label, { "font-size": size, ...tAttrs }));
    } else body.push(clampText((x1 + x2) / 2, r.label, y + 12, tAttrs));
    y += 26;
  };
  // First attempt, with a crash-point handle in every gap.
  const gapY: number[] = [];
  const GAPH = 10;
  for (let i = 0; i <= o.first.length; i++) {
    gapY.push(y + GAPH / 2);
    y += GAPH;
    if (i < o.first.length) draw(o.first[i]);
  }
  for (const c of ["before", "scheduled", "inflight", "committed", "completed"] as const) {
    const gy = gapY[GAP[c]];
    const on = p.crash === c;
    if (on) {
      body.push(el("line", { x1: left - 4, x2: w, y1: gy, y2: gy, stroke: C.bad, "stroke-width": 1.5, "stroke-dasharray": "5 3" }));
      const cw = textWidth(L.crash, size) + 10;
      body.push(el("rect", { x: lanes[1] - cw / 2, y: gy - 8, width: cw, height: 16, rx: 3, fill: C.paper }));
      body.push(text(lanes[1], gy + 4, L.crash, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong" }));
    }
    body.push(el("circle", { cx: 11, cy: gy, r: 9, fill: on ? C.bad : C.paper, stroke: on ? C.bad : C.ink3, "stroke-width": 1.25 }));
    body.push(text(11, gy + 4, CRASH_NUM[c], { "font-size": size, "text-anchor": "middle", class: "fig-t-num fig-t-strong", fill: on ? C.paper : undefined }));
    body.push(el("rect", { x: 0, y: gy - GAPH / 2 - 3, width: w, height: GAPH + 6, fill: "transparent", "data-fig-set": `crash=${c}`, class: "fig-hit" }));
  }
  for (const r of o.recovery) draw(r);
  y += 4;
  for (const x of lanes) parts.push(el("line", { x1: x, x2: x, y1: lifeTop, y2: y, stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }));
  parts.push(...body);
  return { svg: g({ class: "fig-sequence" }, ...parts), h: y - y0 };
}

function state(o: Outcome, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  let y = y0;
  parts.push(text(x0, y + 14, L.after, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += 24;
  parts.push(text(x0, y + 12, L.jTitle, { "font-size": size, class: "fig-t-muted" }));
  y += 18;
  for (const e of o.journal) { parts.push(text(x0 + 10, y + 12, e, { "font-size": size, fill: C.ink, class: "fig-t-num" })); y += 17; }
  if (o.unresolved) {
    for (const ln of wrap(L.unresolved, size, w - 10)) { parts.push(text(x0 + 10, y + 12, ln, { "font-size": size, class: "fig-t-strong" })); y += 17; }
  }
  y += 8;
  parts.push(text(x0, y + 12, L.sTitle, { "font-size": size, class: "fig-t-muted" }));
  y += 18;
  if (!o.tickets.length) { parts.push(text(x0 + 10, y + 12, L.noTicket, { "font-size": size, fill: C.ink })); y += 22; }
  let cx = x0 + 10;
  o.tickets.forEach((id, i) => {
    const s = i === 0 ? tpl(L.ticket, { id }) : tpl(L.dup, { id });
    const tw = textWidth(s, size) + 20;
    if (cx > x0 + 10 && cx + tw > x0 + w) { cx = x0 + 10; y += 24; }
    parts.push(el("rect", { x: cx, y, width: tw, height: 20, rx: 4, fill: C.c1, "fill-opacity": 0.18, stroke: i === 0 ? C.ink3 : C.bad, "stroke-width": i === 0 ? 1 : 1.75 }));
    parts.push(text(cx + 10, y + 14, s, { "font-size": size, fill: C.ink, class: "fig-t-num" }));
    cx += tw + 8;
  });
  if (o.tickets.length) y += 24;
  y += 6;
  const lines = wrap(verdictText(o.verdict, L), size, w - 16);
  parts.push(el("circle", { cx: x0 + 5, cy: y + 8, r: 5, fill: tone(o.verdict) }));
  lines.forEach((ln, i) => parts.push(text(x0 + 16, y + 12 + i * 17, ln, { "font-size": size, class: "fig-t-strong" })));
  y += lines.length * 17 + 4;
  return { svg: g({ class: "fig-state" }, ...parts), h: y - y0 };
}

function matrix(p: P, x0: number, y0: number, w: number, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = TYPE.body;
  let y = y0;
  for (const ln of wrap(L.mTitle, TYPE.label, w)) { parts.push(text(x0, y + 14, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 19; }
  y += 4;
  const headW = Math.max(...POLICIES.map((k) => textWidth(L[k], size))) + 10;
  const cw = Math.min(40, (w - headW) / CRASHES.length);
  const xs = CRASHES.map((_, i) => x0 + headW + i * cw);
  // Bracket over the three crash points the journal cannot tell apart.
  const b0 = xs[2] + 2, b1 = xs[4] + cw - 2;
  const sameLines = wrap(L.same, size, Math.max(b1 - b0, 60));
  sameLines.forEach((ln, i) => parts.push(text((b0 + b1) / 2, y + 12 + i * 15, ln, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" })));
  y += sameLines.length * 15 + 2;
  parts.push(el("path", { d: `M${b0},${y + 6} V${y} H${b1} V${y + 6}`, fill: "none", stroke: C.ink3, "stroke-width": 1 }));
  y += 10;
  parts.push(text(x0, y + 14, L.mCrash, { "font-size": size, class: "fig-t-muted" }));
  CRASHES.forEach((c, i) => {
    const on = c === p.crash;
    parts.push(text(xs[i] + cw / 2, y + 14, c === "none" ? L.none : CRASH_NUM[c], { "font-size": size, "text-anchor": "middle", class: on ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
    parts.push(el("rect", { x: xs[i], y, width: cw, height: 20, fill: "transparent", "data-fig-set": `crash=${c}`, class: "fig-hit" }));
  });
  y += 22;
  const rowH = 26;
  for (const pol of POLICIES) {
    const onRow = pol === p.policy;
    parts.push(text(x0, y + 17, L[pol], { "font-size": size, class: onRow ? "fig-t-strong" : undefined }));
    parts.push(el("rect", { x: x0, y, width: headW - 4, height: rowH - 2, fill: "transparent", "data-fig-set": `policy=${pol}`, class: "fig-hit" }));
    CRASHES.forEach((c, i) => {
      const o = outcome(c, pol, labels.en);
      const sel = onRow && c === p.crash;
      parts.push(el("rect", { x: xs[i] + 1, y: y + 1, width: cw - 2, height: rowH - 4, rx: 3, fill: tone(o.verdict), "fill-opacity": 0.22, stroke: sel ? C.ink : undefined, "stroke-width": sel ? 2 : undefined }));
      parts.push(text(xs[i] + cw / 2, y + 17, o.tickets.length, { "font-size": size, "text-anchor": "middle", class: `fig-t-num${sel ? " fig-t-strong" : ""}`, fill: C.ink }));
    });
    y += rowH;
  }
  y += 8;
  let lx = x0;
  for (const [name, col] of [[L.lgOnce, C.good], [L.lgBad, C.bad], [L.lgUnknown, C.warn]] as const) {
    const iw = 18 + textWidth(name, size);
    if (lx > x0 && lx + iw > x0 + w) { lx = x0; y += 19; }
    parts.push(el("rect", { x: lx, y: y + 1, width: 12, height: 12, rx: 2, fill: col, "fill-opacity": 0.22, stroke: col, "stroke-width": 1 }), text(lx + 18, y + 12, name, { "font-size": size }));
    lx += iw + 14;
  }
  y += 20;
  return { svg: g({ class: "fig-matrix" }, ...parts), h: y - y0 };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const o = outcome(p.crash, p.policy, L);
  const read = o.recovery.find((r, i) => i > 0 && r.k === "msg" && r.from === 0);
  const view = p.crash === "none" ? L.dNone : tpl(L.dRead, { r: read && read.k === "msg" ? read.label : "" });
  return tpl(L.describe, { c: CRASH_NUM[p.crash], p: L[p.policy], view, n: tpl(L.tickets, { n: o.tickets.length }), v: verdictText(o.verdict, L) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const o = outcome(p.crash, p.policy, L);
  const parts: string[] = [];
  const sq = sequence(o, p, w, 0, L);
  parts.push(sq.svg);
  let y = sq.h + 18;
  if (narrow) {
    const s = state(o, 0, y, w, L);
    parts.push(s.svg); y += s.h + 18;
    const m = matrix(p, 0, y, w, L);
    parts.push(m.svg); y += m.h;
  } else {
    const lw = Math.floor(w * 0.44);
    const s = state(o, 0, y, lw, L);
    const m = matrix(p, lw + 24, y, w - lw - 24, L);
    parts.push(s.svg, m.svg);
    y += Math.max(s.h, m.h);
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "effect-crash-recovery",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    crash: {
      kind: "choice", control: "buttons", label: { en: "Worker crashes", zh: "工作进程崩溃" }, default: "committed",
      options: [
        { value: "none", label: { en: "never", zh: "不崩溃" } },
        { value: "before", label: { en: "1 before Scheduled", zh: "1 Scheduled 之前" } },
        { value: "scheduled", label: { en: "2 after Scheduled", zh: "2 Scheduled 之后" } },
        { value: "inflight", label: { en: "3 request in flight", zh: "3 请求在途" } },
        { value: "committed", label: { en: "4 after the commit", zh: "4 服务提交之后" } },
        { value: "completed", label: { en: "5 after Completed", zh: "5 Completed 之后" } },
      ],
    },
    policy: {
      kind: "choice", label: { en: "Recovery", zh: "恢复策略" }, default: "atleast",
      options: [
        { value: "atmost", label: { en: "At most once", zh: "最多一次" } },
        { value: "atleast", label: { en: "At least once", zh: "至少一次" } },
        { value: "keyed", label: { en: "Retry with the same key", zh: "同一键重试" } },
        { value: "reconcile", label: { en: "Reconcile first", zh: "先对账" } },
      ],
    },
  },
  render,
  describe,
});
