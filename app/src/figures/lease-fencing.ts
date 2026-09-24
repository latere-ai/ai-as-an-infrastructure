// A lease bounds ownership only while it is valid; a fencing token makes the
// receiver refuse a stale owner. One resource, two workers, one lease service,
// one receiver, on a time axis in seconds.
//
// Worker A takes the lease at t = 0 with token 33 and renews it every HB
// seconds while it runs. At t = PAUSE_AT, right after a renewal and just
// before its write, A stops for `pause` seconds (a process pause, a stalled
// host): no renewals, no work. The lease expires `ttl` seconds after the last
// renewal. If it expires before A resumes, standby worker B takes the lease
// with token 34, writes, and releases it. A then resumes, still believing it
// holds the lease, and writes. What happens to that write depends only on the
// receiver:
//
// - no token, or a token the receiver does not check: the write is accepted
//   and replaces B's result;
// - a receiver that checks tokens rejects any token below the highest it has
//   accepted, so A's write with 33 fails once B's write with 34 has landed.
//
// If A's write arrives before B's first write, the receiver has seen no newer
// token and accepts it in every mode; B's write then replaces it. If A resumes
// before the lease expires, it renews and writes as the valid holder.
//
// The timings are illustrative. State is a pure function of the parameters
// and the position t (seconds).

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

const HB = 2; // renewal interval while the holder runs, s
const PAUSE_AT = 4; // A's last renewal before the pause, and the start of the pause
const CLAIM_DELAY = 1; // B takes a free lease this long after it frees
const B_WORK = 1.5; // B writes this long after it takes the lease
const B_HOLD = 3; // B releases the lease this long after it takes it
const A_TAIL = 1; // A releases this long after its write
const T_MAX = 26; // latest end of any run the controls allow
const TOKEN_A = 33;
const TOKEN_B = 34;

type Receiver = "none" | "unchecked" | "checked";
type P = { receiver: Receiver; pause: number; ttl: number };
type Outcome = "valid" | "early" | "overwrite" | "rejected";

interface Model {
  expiry: number | null; // when A's lease lapses, if it does before A resumes
  resume: number; // A resumes and writes at this time
  renewals: number[]; // A's renewal times
  bClaim: number | null;
  bWrite: number | null;
  bRelease: number | null;
  aRelease: number;
  outcome: Outcome;
  end: number;
}

function model(p: P): Model {
  const resume = PAUSE_AT + p.pause;
  const lapse = PAUSE_AT + p.ttl; // the lease is valid on [renewal, renewal + ttl)
  const stale = resume >= lapse;
  const renewals: number[] = [];
  for (let t = 0; t <= PAUSE_AT; t += HB) renewals.push(t);
  const aRelease = resume + A_TAIL;
  if (!stale) {
    // A resumes in time, renews at once, writes, and releases.
    for (let t = resume; t < aRelease; t += HB) renewals.push(t);
    return { expiry: null, resume, renewals, bClaim: null, bWrite: null, bRelease: null, aRelease, outcome: "valid", end: Math.min(T_MAX, aRelease + 1) };
  }
  const bClaim = lapse + CLAIM_DELAY;
  const bWrite = bClaim + B_WORK;
  const bRelease = bClaim + B_HOLD;
  const outcome: Outcome = resume < bWrite ? "early" : p.receiver === "checked" ? "rejected" : "overwrite";
  return { expiry: lapse, resume, renewals, bClaim, bWrite, bRelease, aRelease, outcome, end: Math.min(T_MAX, Math.max(aRelease, bRelease) + 1) };
}

const labels = {
  en: {
    title: "A lease, a paused holder, and a fencing token",
    lease: "Lease service",
    a: "Worker A",
    b: "Worker B",
    recv: "Receiver",
    axis: "time (s)",
    paused: "paused",
    standby: "standby",
    expires: "lease expires",
    tokA: "A · 33",
    tokB: "B · 34",
    holdA: "A",
    holdB: "B",
    write: "write",
    reject: "33 < 34",
    now: "t = {t} s",
    lHeld: "Lease: held by {w}{tok}",
    lFree: "Lease: free",
    tok: ", token {n}",
    aRun: "Worker A: running, holds the lease",
    aPaused: "Worker A: paused; its lease renewals have stopped",
    aPausedLapsed: "Worker A: paused; its lease expired at {e} s",
    aResumed: "Worker A: resumed, and still believes it holds the lease",
    aDone: "Worker A: done",
    aRejected: "Worker A: its write was refused; it learns it lost the lease",
    rNone: "Receiver: no write yet",
    rLast: "Receiver: last write by {w}",
    rHigh: "; highest token accepted {n}",
    rIgnored: "; tokens are not checked",
    oValid: "A resumed before the lease expired, so its write is the valid holder's write.",
    oEarly: "A's stale write landed before B's first write, so the receiver had seen no newer token and accepted it; B's write then replaced it.",
    oEarlyPlain: "A's stale write landed before B's first write and was accepted; B's write then replaced it.",
    oOverwrite: "A's stale write was accepted and replaced B's result: {why}",
    whyNone: "without a token the receiver cannot tell a stale owner from the current one.",
    whyUnchecked: "the token rode along as metadata that nothing checked.",
    oRejected: "The receiver refused A's write: its token 33 is below 34, the highest it has accepted.",
    kClaimA: "A takes the lease{tok}",
    kPause: "A pauses; its renewals stop",
    kExpire: "The lease expires while A is paused",
    kClaimB: "B takes the lease{tok}",
    kWriteB: "B writes{tok}",
    kWriteValid: "A resumes, renews its lease, and writes",
    kWriteEarly: "A writes before B does, and the receiver accepts it",
    kWriteOver: "A resumes and writes; the receiver accepts it over B's result",
    kWriteRej: "A resumes and writes with token 33; the receiver refuses it",
    kTok: " with token {n}",
    kEnd: "Both workers have stopped",
    describe: "t = {t} s. {lease}. {a}. {r}.{o}",
  },
  zh: {
    title: "租约、暂停的持有者与栅栏令牌",
    lease: "租约服务",
    a: "工作进程 A",
    b: "工作进程 B",
    recv: "接收端",
    axis: "时间（秒）",
    paused: "暂停",
    standby: "待命",
    expires: "租约到期",
    tokA: "A · 33",
    tokB: "B · 34",
    holdA: "A",
    holdB: "B",
    write: "写入",
    reject: "33 < 34",
    now: "t = {t} 秒",
    lHeld: "租约：由 {w} 持有{tok}",
    lFree: "租约：空闲",
    tok: "，令牌 {n}",
    aRun: "工作进程 A：运行中，持有租约",
    aPaused: "工作进程 A：暂停中，租约续期已经停止",
    aPausedLapsed: "工作进程 A：暂停中，租约已在 {e} 秒到期",
    aResumed: "工作进程 A：已恢复，仍以为自己持有租约",
    aDone: "工作进程 A：已结束",
    aRejected: "工作进程 A：写入被拒，由此得知租约已经失去",
    rNone: "接收端：尚无写入",
    rLast: "接收端：最后一次写入来自 {w}",
    rHigh: "；已接受的最高令牌为 {n}",
    rIgnored: "；不校验令牌",
    oValid: "A 在租约到期前恢复，它的写入就是有效持有者的写入。",
    oEarly: "A 的过期写入早于 B 的第一次写入到达，接收端还没见过更新的令牌，于是接受了它；随后 B 的写入覆盖了它。",
    oEarlyPlain: "A 的过期写入早于 B 的第一次写入到达，被接收端接受；随后 B 的写入覆盖了它。",
    oOverwrite: "A 的过期写入被接受，覆盖了 B 的结果：{why}",
    whyNone: "没有令牌，接收端无法区分过期持有者和当前持有者。",
    whyUnchecked: "令牌只是随请求携带的元数据，没有任何一方校验。",
    oRejected: "接收端拒绝了 A 的写入：它的令牌 33 低于已接受的最高令牌 34。",
    kClaimA: "A 取得租约{tok}",
    kPause: "A 暂停，续期随之停止",
    kExpire: "A 仍在暂停，租约到期",
    kClaimB: "B 取得租约{tok}",
    kWriteB: "B 写入{tok}",
    kWriteValid: "A 恢复，续期后写入",
    kWriteEarly: "A 抢在 B 之前写入，接收端接受了它",
    kWriteOver: "A 恢复后写入，接收端接受它并覆盖 B 的结果",
    kWriteRej: "A 恢复后以令牌 33 写入，接收端拒绝",
    kTok: "（令牌 {n}）",
    kEnd: "两个工作进程都已停止",
    describe: "t = {t} 秒。{lease}。{a}。{r}。{o}",
  },
};
type L = typeof labels.en;

const fmtT = (t: number) => (Number.isInteger(t) ? String(t) : fixed(t, 1));

function writeKey(m: Model): keyof L {
  return m.outcome === "valid" ? "kWriteValid" : m.outcome === "early" ? "kWriteEarly" : m.outcome === "overwrite" ? "kWriteOver" : "kWriteRej";
}

function keyframes(p: P, lang: Lang) {
  const Lx = labels[lang];
  const m = model(p);
  const tok = (n: number) => ({ tok: p.receiver === "none" ? "" : tpl(Lx.kTok, { n }) });
  const bWrite = tpl(Lx.kWriteB, tok(TOKEN_B));
  const ks: Array<{ t: number; label: string }> = [{ t: 0, label: tpl(Lx.kClaimA, tok(TOKEN_A)) }, { t: PAUSE_AT, label: Lx.kPause }];
  if (m.expiry != null) {
    ks.push({ t: m.expiry, label: Lx.kExpire }, { t: m.bClaim!, label: tpl(Lx.kClaimB, tok(TOKEN_B)) });
    if (m.outcome === "early") ks.push({ t: m.resume, label: Lx[writeKey(m)] }, { t: m.bWrite!, label: bWrite });
    else ks.push({ t: m.bWrite!, label: bWrite }, { t: m.resume, label: Lx[writeKey(m)] });
  } else ks.push({ t: m.resume, label: Lx[writeKey(m)] });
  ks.push({ t: m.end, label: Lx.kEnd });
  return ks.sort((x, y) => x.t - y.t).filter((k, i, a) => i === 0 || k.t > a[i - 1].t);
}

// What the receiver holds at time t: the last accepted writer, and the highest token.
function receiverAt(m: Model, t: number): { last: "A" | "B" | null; high: number } {
  const writes: Array<{ t: number; who: "A" | "B"; tok: number }> = [];
  if (m.bWrite != null) writes.push({ t: m.bWrite, who: "B", tok: TOKEN_B });
  writes.push({ t: m.resume, who: "A", tok: TOKEN_A });
  writes.sort((x, y) => x.t - y.t);
  let last: "A" | "B" | null = null, high = 0;
  for (const w of writes) {
    if (w.t > t) break;
    if (w.who === "A" && m.outcome === "rejected") continue;
    last = w.who;
    high = Math.max(high, w.tok);
  }
  return { last, high };
}

function status(p: P, m: Model, t: number, Lx: L) {
  const tokOn = p.receiver !== "none";
  const tok = (n: number) => (tokOn ? tpl(Lx.tok, { n }) : "");
  let lease: string;
  if (t < (m.expiry ?? m.aRelease)) lease = tpl(Lx.lHeld, { w: "A", tok: tok(TOKEN_A) });
  else if (m.bClaim != null && t >= m.bClaim && t < m.bRelease!) lease = tpl(Lx.lHeld, { w: "B", tok: tok(TOKEN_B) });
  else lease = Lx.lFree;
  let a: string;
  if (t < PAUSE_AT) a = Lx.aRun;
  else if (t < m.resume) a = m.expiry != null && t >= m.expiry ? tpl(Lx.aPausedLapsed, { e: fmtT(m.expiry) }) : Lx.aPaused;
  else if (m.outcome === "rejected") a = Lx.aRejected;
  else if (t < m.aRelease) a = m.outcome === "valid" ? Lx.aRun : Lx.aResumed;
  else a = Lx.aDone;
  const rc = receiverAt(m, t);
  const r = rc.last == null ? Lx.rNone
    : tpl(Lx.rLast, { w: rc.last }) + (p.receiver === "checked" ? tpl(Lx.rHigh, { n: rc.high }) : p.receiver === "unchecked" ? Lx.rIgnored : "");
  let o = "";
  if (t >= m.resume) {
    if (m.outcome === "valid") o = Lx.oValid;
    else if (m.outcome === "early") o = t >= m.bWrite! ? (p.receiver === "checked" ? Lx.oEarly : Lx.oEarlyPlain) : "";
    else if (m.outcome === "overwrite") o = tpl(Lx.oOverwrite, { why: p.receiver === "none" ? Lx.whyNone : Lx.whyUnchecked });
    else o = Lx.oRejected;
  }
  return { lease, a, r, o };
}

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const m = model(st.p);
  const t = Math.min(st.t, m.end);
  const s = status(st.p, m, t, Lx);
  return tpl(Lx.describe, { t: fmtT(Math.round(t * 10) / 10), lease: s.lease, a: s.a, r: s.r, o: s.o ? (lang === "zh" ? s.o : " " + s.o) : "" });
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const t = Math.min(st.t, m.end);
  const tokOn = p.receiver !== "none";
  const hatchId = `${st.uid}-pause`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 5, 1))];
  const over: string[] = []; // drawn after the cursor

  const lanes = [Lx.lease, Lx.a, Lx.b, Lx.recv];
  const labelW = narrow ? 0 : Math.max(...lanes.map((s) => textWidth(s, TYPE.body))) + 14;
  const barH = 20;
  const laneGap = narrow ? 34 : 16; // on a phone the lane name sits above its bar
  const tEnd = Math.ceil(m.end / 2) * 2;
  const x = linear([0, tEnd], [labelW, w - 6]);
  const cl = tpl(Lx.now, { t: fmtT(Math.round(t * 10) / 10) });
  const clw = textWidth(cl, TYPE.body);
  const clx = Math.min(Math.max(x(t), labelW + clw / 2), w - clw / 2 - 2);
  // The expiry label shares the top row with the cursor label unless they would touch.
  let ex = 0, exRow = 0;
  const ew = textWidth(Lx.expires, TYPE.body);
  if (m.expiry != null) {
    const xe = x(m.expiry);
    ex = xe + 4 + ew > w ? xe - 4 - ew : xe + 4;
    const clash = ex < clx + clw / 2 + 8 && ex + ew > clx - clw / 2 - 8;
    exRow = clash && t >= m.expiry ? 1 : 0;
  }
  const top = 22 + exRow * 17;
  const laneY = (i: number) => top + (narrow ? 20 : 0) + i * (barH + laneGap);
  const plotBottom = laneY(3) + barH;
  const span = (a: number, b: number) => ({ x0: x(a), x1: x(Math.max(a, Math.min(b, t))) });

  // Lane names and tracks.
  lanes.forEach((name, i) => {
    const y = laneY(i);
    parts.push(narrow
      ? text(0, y - 6, name, { "font-size": TYPE.body, class: "fig-t-strong" })
      : text(0, y + barH / 2 + 4, name, { "font-size": TYPE.body, class: "fig-t-strong" }));
    parts.push(el("rect", { x: x(0), y, width: x(tEnd) - x(0), height: barH, rx: 3, fill: C.panel }));
  });

  // A bar up to t, labeled with the first candidate label that fits inside it.
  const bar = (i: number, a: number, b: number, fill: string, names: string[] = [], attrs: Record<string, string | number> = {}) => {
    if (t < a) return;
    const { x0, x1 } = span(a, b);
    if (x1 - x0 < 0.5) return;
    const y = laneY(i);
    parts.push(el("rect", { x: x0, y, width: x1 - x0, height: barH, rx: 3, fill, ...attrs }));
    const fit = names.find((n) => textWidth(n, TYPE.body) + 10 <= x1 - x0);
    if (fit) parts.push(text(x0 + 5, y + barH / 2 + 4, fit, { "font-size": TYPE.body, class: "fig-t-halo" }));
  };
  const tokNames = (who: "A" | "B") => tokOn
    ? (who === "A" ? [Lx.tokA, String(TOKEN_A)] : [Lx.tokB, String(TOKEN_B)])
    : [who === "A" ? Lx.holdA : Lx.holdB];

  // Lease lane: A's lease to its lapse or release, then B's; renewals as ticks under the bar.
  bar(0, 0, m.expiry ?? m.aRelease, C.c1, tokNames("A"), { "fill-opacity": 0.55 });
  if (m.bClaim != null) bar(0, m.bClaim, m.bRelease!, C.c2, tokNames("B"), { "fill-opacity": 0.55 });
  for (const r of m.renewals) {
    if (r > t) continue;
    parts.push(el("line", { x1: x(r) + 1, x2: x(r) + 1, y1: laneY(0) + barH - 3, y2: laneY(0) + barH + 5, stroke: C.c1, "stroke-width": 2 }));
  }

  // Worker A: runs, pauses, resumes, writes, releases.
  bar(1, 0, PAUSE_AT, C.c1);
  if (t >= PAUSE_AT) {
    const { x0, x1 } = span(PAUSE_AT, m.resume);
    parts.push(el("rect", { x: x0, y: laneY(1), width: Math.max(0, x1 - x0), height: barH, rx: 3, fill: `url(#${hatchId})` }));
    if (x1 - x0 > textWidth(Lx.paused, TYPE.body) + 10) parts.push(text(x0 + 5, laneY(1) + barH / 2 + 4, Lx.paused, { "font-size": TYPE.body, class: "fig-t-halo" }));
  }
  bar(1, m.resume, m.outcome === "rejected" ? m.resume + 0.4 : m.aRelease, C.c1);

  // Worker B: standby until it takes the lease.
  if (t > 0) {
    const { x0, x1 } = span(0, Math.min(m.bClaim ?? tEnd, tEnd));
    parts.push(el("line", { x1: x0, x2: x1, y1: laneY(2) + barH - 4, y2: laneY(2) + barH - 4, stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "3 3" }));
    if (x1 - x0 > textWidth(Lx.standby, TYPE.body) + 12) parts.push(text(x0 + 5, laneY(2) + 12, Lx.standby, { "font-size": TYPE.body, class: "fig-t-muted" }));
  }
  if (m.bClaim != null) bar(2, m.bClaim, m.bRelease!, C.c2);

  // Receiver: which write is current, as colored runs.
  const accepted: Array<{ t: number; who: "A" | "B" }> = [];
  if (m.bWrite != null) accepted.push({ t: m.bWrite, who: "B" });
  if (m.outcome !== "rejected") accepted.push({ t: m.resume, who: "A" });
  accepted.sort((u, v) => u.t - v.t);
  accepted.forEach((wr, i) => bar(3, wr.t, accepted[i + 1]?.t ?? tEnd, wr.who === "A" ? C.c1 : C.c2, tokNames(wr.who), { "fill-opacity": 0.55 }));

  // Write arrows from the writer's lane down to the receiver, drawn over the cursor.
  const arrow = (at: number, from: number, color: string, refused: boolean) => {
    if (t < at) return;
    const xx = x(at);
    const y0 = laneY(from) + barH;
    const y1 = laneY(3) - 2;
    over.push(el("line", { x1: xx, x2: xx, y1: y0, y2: y1 - 5, stroke: color, "stroke-width": 2.5 }));
    if (refused) {
      over.push(el("line", { x1: xx - 7, x2: xx + 7, y1: y1 - 3, y2: y1 - 3, stroke: C.bad, "stroke-width": 3 }));
      // Right of the marker inside the receiver lane when it fits; otherwise on
      // the row above the lane, left of the arrow (the phone lane-name row).
      const lw = textWidth(Lx.reject, TYPE.body);
      if (xx + 10 + lw <= w) over.push(text(xx + 10, laneY(3) + barH / 2 + 4, Lx.reject, { "font-size": TYPE.body, class: "fig-t-halo fig-t-num" }));
      else over.push(text(xx - 6, laneY(3) - 7, Lx.reject, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-halo fig-t-num" }));
    } else {
      over.push(el("path", { d: `M${xx - 4.5},${y1 - 7}L${xx + 4.5},${y1 - 7}L${xx},${y1}Z`, fill: color }));
    }
  };
  if (m.bWrite != null) arrow(m.bWrite, 2, C.c2, false);
  arrow(m.resume, 1, C.c1, m.outcome === "rejected");

  // Lease expiry: a dashed line across every lane.
  if (m.expiry != null && t >= m.expiry) {
    const xe = x(m.expiry);
    parts.push(el("line", { x1: xe, x2: xe, y1: 20 + exRow * 17, y2: plotBottom + 4, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "4 3" }));
    parts.push(text(ex, 12 + exRow * 17, Lx.expires, { "font-size": TYPE.body, class: "fig-t-muted" }));
  }

  // Cursor, behind the write arrows.
  parts.push(el("line", { x1: x(t), x2: x(t), y1: top - 4, y2: plotBottom + 4, stroke: C.ink3, "stroke-width": 1 }));
  parts.push(text(clx, 12, cl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  parts.push(...over);

  // Time axis.
  parts.push(axis({ scale: x, orient: "bottom", at: plotBottom + 6, ticks: x.ticks(narrow ? 5 : 8).filter((v) => v <= tEnd), title: Lx.axis, size: TYPE.body }));
  let y = plotBottom + 6 + axisHeight(true, TYPE.body) + 16;

  // Readout: the state of each party at t, then the outcome.
  const s = status(p, m, t, Lx);
  for (const line of [s.lease, s.a, s.r]) {
    for (const part of wrap(line, TYPE.body, w)) { parts.push(text(0, y, part, { "font-size": TYPE.body })); y += 17; }
  }
  if (s.o) {
    y += 4;
    const col = m.outcome === "rejected" || m.outcome === "valid" ? C.good : m.outcome === "overwrite" ? C.bad : C.warn;
    const lines = wrap(s.o, TYPE.body, w - 14);
    parts.push(el("rect", { x: 0, y: y - 12, width: 4, height: lines.length * 17 - 2, rx: 2, fill: col }));
    for (const part of lines) { parts.push(text(12, y, part, { "font-size": TYPE.body, class: "fig-t-strong" })); y += 17; }
  }
  return svg(w, y, describe(st, lang), g({ class: "fig-lease" }, ...parts));
}

export default defineFigure({
  name: "lease-fencing",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    receiver: {
      kind: "choice", label: { en: "Receiver", zh: "接收端" }, default: "checked",
      options: [
        { value: "none", label: { en: "No token", zh: "不带令牌" } },
        { value: "unchecked", label: { en: "Token not checked", zh: "带令牌但不校验" } },
        { value: "checked", label: { en: "Token checked", zh: "校验令牌" } },
      ],
    },
    pause: { kind: "range", label: { en: "Worker A pauses for", zh: "工作进程 A 暂停" }, unit: { en: "s", zh: "秒" }, min: 0, max: 20, step: 1, default: 14 },
    ttl: { kind: "range", label: { en: "Lease TTL", zh: "租约有效期" }, unit: { en: "s", zh: "秒" }, min: 3, max: 14, step: 1, default: 8 },
  },
  timeline: {
    rate: 3,
    discrete: false, // continuous time in seconds
    unit: { symbol: { en: "s", zh: "秒" }, value: (t) => fmtT(Math.round(t * 10) / 10) },
    duration: (p) => model(p).end,
    keyframes,
    // The decisive moment: A's write after its pause.
    poster: (p) => model(p).resume,
  },
  render,
  describe,
});
