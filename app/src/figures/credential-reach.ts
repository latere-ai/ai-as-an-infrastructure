// What one credential lets an attacker reach, and for how long, in the
// chapter's GitHub MCP scenario. Rows are action-resource tuples: read and
// write on three repositories, the public one that carries the malicious issue
// and two private ones. Time runs on a log axis from the moment the token is
// issued, at the start of an agent session.
//
// Two holders use the token:
//   - The hijacked session. The agent reads the issue at 4 s; the injected
//     instruction then asks for private reads at 9 s and 14 s and a public
//     pull request at 20 s, the proof of concept's path. A call is accepted
//     when its tuple is in the token's scope. With a per-call capability each
//     call is authorized separately against the task's policy (read site
//     issues), so the injected calls are denied. These calls finish in seconds,
//     inside any lifetime offered here: expiry does not bound this path.
//   - A leaked copy. At 60 s a copy of the token reaches someone else (a log
//     line, a sandbox environment variable). The copy works on every tuple in
//     scope until the earlier of expiry and effective revocation:
//         end = min(T_exp, t_detect + Δ_stale)
//     where t_detect is when revocation is requested and Δ_stale is how long
//     resource servers keep accepting a revoked token: unbounded when tokens
//     are self-contained and nothing is checked before expiry, the push
//     interval of a status list, or the cache lifetime of introspection. A
//     sender-constrained token is useless to the copy (it cannot prove
//     possession of the agent's key), and a single-use capability was already
//     spent by the call it was minted for.
//
// Every time and scope is an illustrative configuration, not a measurement.
// The timeline advances in steps of 1/20 of a decade of time.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { overlaps, textWidth, wrap, type Box } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Repo = "site" | "api" | "infra";
type Act = "read" | "write";
interface Tuple { repo: Repo; act: Act; priv: boolean }
const ROWS: Tuple[] = [
  { repo: "site", act: "read", priv: false },
  { repo: "site", act: "write", priv: false },
  { repo: "api", act: "read", priv: true },
  { repo: "api", act: "write", priv: true },
  { repo: "infra", act: "read", priv: true },
  { repo: "infra", act: "write", priv: true },
];
const rowOf = (repo: Repo, act: Act) => ROWS.findIndex((r) => r.repo === repo && r.act === act);

type Scope = "all" | "repo" | "task" | "call";
function inScope(scope: Scope, r: Tuple): boolean {
  if (scope === "all") return true;
  if (scope === "repo") return r.repo === "site";
  return r.repo === "site" && r.act === "read"; // task and call: read the site issues
}

// The session's calls: the task call, then the injected ones.
interface Call { t: number; row: number; injected: boolean }
const CALLS: Call[] = [
  { t: 4, row: rowOf("site", "read"), injected: false },
  { t: 9, row: rowOf("api", "read"), injected: true },
  { t: 14, row: rowOf("infra", "read"), injected: true },
  { t: 20, row: rowOf("site", "write"), injected: true },
];

const LEAK = 60; // s
const CALL_TTL = 60; // s, lifetime of a per-call capability
const T_MAX = 1e7; // s, right edge of the axis (about 116 days)
const SPD = 20; // timeline positions per decade of time
const DURATION = Math.round(Math.log10(T_MAX) * SPD);
const at = (pos: number) => 10 ** (pos / SPD); // seconds at a timeline position
const posOf = (s: number) => Math.min(DURATION, Math.ceil(Math.log10(Math.max(1, s)) * SPD - 1e-9));

type Revoke = "expiry" | "status" | "introspect";
const STALE: Record<Revoke, number> = { expiry: Infinity, status: 15 * 60, introspect: 60 };

type P = { scope: Scope; ttl: number; revoke: Revoke; detect: number; bound: boolean };

function model(p: P) {
  const ttl = p.scope === "call" ? CALL_TTL : p.ttl;
  const accepted = CALLS.map((c) => inScope(p.scope, ROWS[c.row]) && c.t < ttl);
  const published = accepted[3] && (accepted[1] || accepted[2]);
  const tDetect = LEAK + p.detect;
  const tEffective = tDetect + STALE[p.revoke];
  const byExpiry = ttl <= tEffective;
  const end = Math.min(ttl, tEffective);
  // Why the copy gets nothing, if it does not.
  const copyBlock: "bound" | "spent" | "expired" | null = p.scope === "call" ? "spent" : p.bound ? "bound" : end <= LEAK ? "expired" : null;
  const reach = ROWS.map((r) => inScope(p.scope, r));
  const k = reach.filter(Boolean).length;
  const kPriv = ROWS.filter((r, i) => reach[i] && r.priv).length;
  const kWrite = ROWS.filter((r, i) => reach[i] && r.act === "write").length;
  return { ttl, accepted, published, tDetect, tEffective, byExpiry, end, copyBlock, reach, k, kPriv, kWrite };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "What a leaked or hijacked token reaches, and for how long",
    authorized: "the token authorizes",
    accepted: "injected call accepted",
    denied: "call denied",
    task: "task call",
    copy: "leaked copy usable",
    read: "read", write: "write",
    pub: "public", priv: "private",
    time: "time since the token was issued (log scale)",
    mLeak: "copy leaks",
    mDetect: "revocation requested",
    mEffect: "revocation in effect",
    mExpiry: "token expires",
    mLeakS: "leak", mDetectS: "revoke", mEffectS: "revoked", mExpiryS: "expires",
    now: "now {t}",
    sess: "Hijacked session: {a} of 3 injected calls accepted. Private data published: {pub}.",
    yes: "yes", no: "no",
    copyUse: "Leaked copy: usable on {k} of 6 tuples ({kp} private, {kw} writes) until {end}, when {why}.",
    whyExp: "the token expires",
    whyRev: "revocation takes effect",
    copyBound: "Leaked copy: rejected; it cannot prove possession of the agent's key.",
    copySpent: "Leaked copy: rejected; the single-use capability was spent at 4 s.",
    copyExpired: "Leaked copy: rejected; the token expired before the leak.",
    window: "end = min(T_exp, t_detect + Δ_stale) = min({ttl}, {det} + {stale}) = {end}",
    windowCall: "per-call capability: T_exp = 1 min, single use",
    nowCopy: "At {t}: the copy can use {k} of 6 tuples.",
    nowCopyNone: "At {t}: the copy can use none.",
    unbounded: "∞",
    describe: "Scope {scope}, lifetime {ttl}, revocation {rev}. The hijacked session had {a} of 3 injected calls accepted, and private data {pubd} published. {copy}",
    pubYes: "was", pubNo: "was not",
    scAll: "all repositories", scRepo: "site repository", scTask: "task only", scCall: "per-call capability",
    rvExpiry: "by expiry only", rvStatus: "through a status list pushed every 15 min", rvIntro: "through introspection with a 1 min cache",
    s: "{n} s", min: "{n} min", h: "{n} h", d: "{n} d",
    kTask: "4 s: the agent reads the issue; the injected text arrives",
    kCall: "{t}: injected call, {what}: {res}",
    kLeak: "1 min: a copy of the token leaks",
    kDetect: "{t}: revocation requested",
    kEffect: "{t}: revocation takes effect",
    kExpiry: "{t}: the token expires",
    rAcc: "accepted", rDen: "denied",
  },
  zh: {
    title: "泄露或被劫持的令牌能触达什么，能持续多久",
    authorized: "令牌授权范围",
    accepted: "注入调用被接受",
    denied: "调用被拒绝",
    task: "任务调用",
    copy: "泄露副本可用",
    read: "读", write: "写",
    pub: "公开", priv: "私有",
    time: "令牌签发后的时间（对数刻度）",
    mLeak: "副本泄露",
    mDetect: "请求撤销",
    mEffect: "撤销生效",
    mExpiry: "令牌过期",
    mLeakS: "泄露", mDetectS: "请求撤销", mEffectS: "撤销生效", mExpiryS: "过期",
    now: "当前 {t}",
    sess: "被劫持的会话：3 次注入调用中有 {a} 次被接受。私有数据被公开：{pub}。",
    yes: "是", no: "否",
    copyUse: "泄露副本：可用于 6 个元组中的 {k} 个（私有 {kp} 个，写操作 {kw} 个），持续到 {end}，届时{why}。",
    whyExp: "令牌过期",
    whyRev: "撤销生效",
    copyBound: "泄露副本：被拒绝，它无法证明持有智能体的密钥。",
    copySpent: "泄露副本：被拒绝，单次能力令牌已在 4 s 时用掉。",
    copyExpired: "泄露副本：被拒绝，令牌在泄露前已过期。",
    window: "end = min(T_exp, t_detect + Δ_stale) = min({ttl}, {det} + {stale}) = {end}",
    windowCall: "逐次调用能力令牌：T_exp = 1 min，只能使用一次",
    nowCopy: "{t} 时：副本可以使用 6 个元组中的 {k} 个。",
    nowCopyNone: "{t} 时：副本已无法使用任何元组。",
    unbounded: "∞",
    describe: "范围：{scope}；有效期 {ttl}；撤销方式：{rev}。被劫持的会话中，3 次注入调用有 {a} 次被接受，私有数据{pubd}公开。{copy}",
    pubYes: "被", pubNo: "没有被",
    scAll: "所有仓库", scRepo: "site 仓库", scTask: "仅限任务", scCall: "逐次调用能力令牌",
    rvExpiry: "只靠过期", rvStatus: "每 15 分钟推送的状态列表", rvIntro: "缓存 1 分钟的令牌内省",
    s: "{n} s", min: "{n} min", h: "{n} h", d: "{n} d",
    kTask: "4 s：智能体读取议题，注入文本随之进入",
    kCall: "{t}：注入调用，{what}：{res}",
    kLeak: "1 min：令牌副本泄露",
    kDetect: "{t}：请求撤销",
    kEffect: "{t}：撤销生效",
    kExpiry: "{t}：令牌过期",
    rAcc: "被接受", rDen: "被拒绝",
  },
};
type L = typeof labels.en;

// Durations in the largest whole units, at most two: "6 h 15 min", "30 d".
function dur(s: number, L: L): string {
  if (!Number.isFinite(s)) return L.unbounded;
  const units: Array<[number, string]> = [[86400, L.d], [3600, L.h], [60, L.min], [1, L.s]];
  const out: string[] = [];
  let rest = Math.round(s);
  for (const [u, f] of units) {
    if (rest >= u && out.length < 2) { const n = Math.floor(rest / u); out.push(tpl(f, { n })); rest -= n * u; }
    else if (out.length) break;
  }
  return out.join(" ") || tpl(L.s, { n: 0 });
}
const tupleName = (r: Tuple, L: L) => `${r.repo} ${r.act === "read" ? L.read : L.write}`;

// ---------------------------------------------------------------- timeline

interface Mark { t: number; kind: "task" | "call" | "leak" | "detect" | "effect" | "expiry"; call?: number }
function marks(p: P): Mark[] {
  const m = model(p);
  const out: Mark[] = [{ t: 4, kind: "task" }, ...[1, 2, 3].map((i) => ({ t: CALLS[i].t, kind: "call" as const, call: i })), { t: LEAK, kind: "leak" }];
  if (p.scope !== "call") {
    out.push({ t: m.tDetect, kind: "detect" });
    if (Number.isFinite(m.tEffective) && m.tEffective < m.ttl) out.push({ t: m.tEffective, kind: "effect" });
  }
  out.push({ t: m.ttl, kind: "expiry" });
  return out.filter((k) => k.t <= T_MAX).sort((a, b) => a.t - b.t);
}

function keyframes(p: P, lang: Lang) {
  const L = labels[lang];
  const m = model(p);
  const byPos = new Map<number, string[]>();
  for (const k of marks(p)) {
    let s: string;
    if (k.kind === "task") s = L.kTask;
    else if (k.kind === "call") s = tpl(L.kCall, { t: dur(k.t, L), what: tupleName(ROWS[CALLS[k.call!].row], L), res: m.accepted[k.call!] ? L.rAcc : L.rDen });
    else if (k.kind === "leak") s = L.kLeak;
    else s = tpl(k.kind === "detect" ? L.kDetect : k.kind === "effect" ? L.kEffect : L.kExpiry, { t: dur(k.t, L) });
    const pos = posOf(k.t);
    byPos.set(pos, [...(byPos.get(pos) ?? []), s]);
  }
  return [...byPos].map(([t, ss]) => ({ t, label: ss.join(lang === "zh" ? "；" : "; ") }));
}

// ---------------------------------------------------------------- figure

function copySentence(p: P, L: L): string {
  const m = model(p);
  if (m.copyBlock === "bound") return L.copyBound;
  if (m.copyBlock === "spent") return L.copySpent;
  if (m.copyBlock === "expired") return L.copyExpired;
  return tpl(L.copyUse, { k: m.k, kp: m.kPriv, kw: m.kWrite, end: dur(m.end, L), why: m.byExpiry ? L.whyExp : L.whyRev });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  const scope = { all: L.scAll, repo: L.scRepo, task: L.scTask, call: L.scCall }[p.scope];
  const rev = { expiry: L.rvExpiry, status: L.rvStatus, introspect: L.rvIntro }[p.revoke];
  return tpl(L.describe, {
    scope, ttl: dur(m.ttl, L), rev, a: m.accepted.slice(1).filter(Boolean).length,
    pubd: m.published ? L.pubYes : L.pubNo, copy: copySentence(p, L),
  });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const m = model(p);
  const pos = Math.round(st.t);
  const now = at(pos);
  const Wr = (s: string, size: number, mw: number) => (lang === "zh" ? wrapCjk(s, size, mw) : wrap(s, size, mw));
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-out`, C.grid, 5, 1))];

  // Legend.
  const lg = legend([
    { label: L.authorized, swatch: { kind: "rect", fill: C.c1, opacity: 0.22 } },
    { label: L.task, swatch: { kind: "dot", fill: C.ink2 } },
    { label: L.accepted, swatch: { kind: "dot", fill: C.c2 } },
    { label: L.denied, swatch: { kind: "rect", fill: "none", stroke: C.ink3 } },
    { label: L.copy, swatch: { kind: "rect", fill: C.c3 } },
  ], 0, 0, w, TYPE.body);
  parts.push(lg.svg);

  // Plot geometry.
  const resW = Math.max(...ROWS.map((r) => textWidth(r.repo, TYPE.body)), textWidth(L.priv, fs), textWidth(L.pub, fs)) + 8;
  const actW = Math.max(textWidth(L.read, TYPE.body), textWidth(L.write, TYPE.body)) + 10;
  const x0 = resW + actW + 6;
  const x1 = w - (narrow ? 6 : 10);
  const x = log([1, T_MAX], [x0, x1]);
  const markTop = lg.height + 10;
  const laneH = fs + 5;
  const lanes = narrow ? 4 : 3;
  const nowLane = markTop + 4 + lanes * laneH + fs; // baseline of the cursor's time label
  const top = nowLane + 8;
  const rowH = narrow ? 26 : 24;
  const plotH = ROWS.length * rowH;
  const bottom = top + plotH;

  // Row labels, with the repository and its visibility over its two rows.
  for (let i = 0; i < ROWS.length; i += 2) {
    const r = ROWS[i];
    const yy = top + i * rowH;
    parts.push(text(0, yy + rowH * 0.62, r.repo, { "font-size": TYPE.body, class: "fig-t-strong" }));
    parts.push(text(0, yy + rowH * 1.62, r.priv ? L.priv : L.pub, { "font-size": fs, class: r.priv ? "fig-t-muted" : "fig-t-faint" }));
    if (i > 0) parts.push(el("line", { x1: 0, x2: x1, y1: yy, y2: yy, stroke: C.rule, "stroke-width": 1 }));
  }
  ROWS.forEach((r, i) => parts.push(text(resW, top + i * rowH + rowH * 0.62, r.act === "read" ? L.read : L.write, { "font-size": TYPE.body, class: "fig-t-muted" })));

  // Time gridlines and axis.
  const ticks = [1, 60, 3600, 86400, 30 * 86400];
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, ticks, grid: [top, bottom], size: fs, format: (v) => dur(v, L) }));
  parts.push(text(x1, bottom + axisHeight(false, fs) + fs + 4, L.time, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted" }));

  // Rows: authorized period (issue to expiry) for tuples in scope; hatched otherwise.
  const band = (row: number, a: number, b: number, attrs: Record<string, string | number>) => {
    const xa = x(Math.max(1, a)), xb = x(Math.min(T_MAX, b));
    if (xb <= xa) return "";
    return el("rect", { x: xa, y: top + row * rowH + 3, width: xb - xa, height: rowH - 6, ...attrs });
  };
  ROWS.forEach((r, i) => {
    if (m.reach[i]) parts.push(band(i, 1, m.ttl, { fill: C.c1, "fill-opacity": 0.22 }));
    else parts.push(el("rect", { x: x0, y: top + i * rowH + 3, width: x1 - x0, height: rowH - 6, fill: `url(#${st.uid}-out)` }));
  });

  // The leaked copy: usable on in-scope rows from the leak to the end of the window.
  if (!m.copyBlock) {
    ROWS.forEach((r, i) => {
      if (!m.reach[i]) return;
      const solidEnd = Math.min(m.end, now);
      const thin = { y: top + i * rowH + 7, height: rowH - 14 };
      if (solidEnd > LEAK) parts.push(band(i, LEAK, solidEnd, { fill: C.c3, ...thin }));
      if (m.end > now) parts.push(band(i, Math.max(LEAK, now), m.end, { fill: C.c3, "fill-opacity": 0.3, ...thin }));
    });
  }

  // Event markers: a vertical line from its label down through the plot. Each
  // label takes the highest lane where it overlaps no other label, crosses no
  // line that starts above it, and whose own line crosses no label below it.
  const mk = marks(p).filter((k) => k.kind !== "task" && k.kind !== "call");
  const laneBase = (lane: number) => markTop + 4 + fs * 0.8 + lane * laneH;
  const placed: Array<{ box: Box; lane: number; x: number }> = [];
  const hits = (xx: number, b: Box) => xx >= b.x0 - 2 && xx <= b.x1 + 2;
  for (const k of mk) {
    const xx = x(k.t);
    const past = k.t <= now;
    const name = (narrow
      ? { leak: L.mLeakS, detect: L.mDetectS, effect: L.mEffectS, expiry: L.mExpiryS }
      : { leak: L.mLeak, detect: L.mDetect, effect: L.mEffect, expiry: L.mExpiry })[k.kind as "leak" | "detect" | "effect" | "expiry"];
    const tw = textWidth(name, fs);
    let spot: { lane: number; box: Box; tx: number; anchor: "start" | "end" } | null = null;
    for (let lane = 0; lane < lanes && !spot; lane++) {
      const by = laneBase(lane);
      for (const side of ["right", "left"] as const) {
        const tx = side === "right" ? xx + 3 : xx - 3;
        const box: Box = side === "right" ? { x0: tx, y0: by - fs * 0.8, x1: tx + tw, y1: by + fs * 0.25 } : { x0: tx - tw, y0: by - fs * 0.8, x1: tx, y1: by + fs * 0.25 };
        if (box.x0 < 0 || box.x1 > w) continue;
        const clash = placed.some((q) => overlaps(q.box, box, 2) || (q.lane < lane && hits(q.x, box)) || (q.lane > lane && hits(xx, q.box)));
        if (!clash) { spot = { lane, box, tx, anchor: side === "right" ? "start" : "end" }; break; }
      }
    }
    const col = k.kind === "leak" ? C.c3 : k.kind === "expiry" ? C.ink : C.ink2;
    const y1 = spot ? spot.box.y0 : top - 4;
    parts.push(el("line", { x1: xx, x2: xx, y1, y2: bottom, stroke: col, "stroke-width": 1.4, "stroke-dasharray": k.kind === "detect" ? "4 3" : undefined, opacity: past ? 1 : 0.35 }));
    if (spot) {
      placed.push({ box: spot.box, lane: spot.lane, x: xx });
      parts.push(text(spot.tx, laneBase(spot.lane), name, { "font-size": fs, "text-anchor": spot.anchor, class: past ? "fig-t-strong" : "fig-t-faint" }));
    }
  }

  // Session calls.
  CALLS.forEach((c, i) => {
    const cx = x(c.t), cy = top + c.row * rowH + rowH / 2;
    const past = c.t <= now;
    const ok = m.accepted[i];
    const op = past ? 1 : 0.3;
    if (ok) parts.push(el("circle", { cx, cy, r: 5.5, fill: c.injected ? C.c2 : C.ink2, stroke: C.paper, "stroke-width": 1.5, opacity: op }));
    else {
      parts.push(el("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, rx: 2, fill: C.paper, stroke: C.ink3, "stroke-width": 1.4, opacity: op }));
      parts.push(el("path", { d: `M${cx - 3},${cy - 3}L${cx + 3},${cy + 3}M${cx + 3},${cy - 3}L${cx - 3},${cy + 3}`, stroke: C.ink2, "stroke-width": 1.4, opacity: op }));
    }
  });
  // A copy that cannot be used: a denied mark on each in-scope row at the leak.
  if (m.copyBlock) {
    ROWS.forEach((r, i) => {
      if (!m.reach[i]) return;
      const cx = x(LEAK) + 8, cy = top + i * rowH + rowH / 2;
      parts.push(el("path", { d: `M${cx - 3.5},${cy - 3.5}L${cx + 3.5},${cy + 3.5}M${cx + 3.5},${cy - 3.5}L${cx - 3.5},${cy + 3.5}`, stroke: C.c3, "stroke-width": 2, opacity: now >= LEAK ? 1 : 0.35 }));
    });
  }

  // Cursor.
  const cx = x(now);
  parts.push(el("line", { x1: cx, x2: cx, y1: top - 2, y2: bottom + 2, stroke: C.ink, "stroke-width": 2 }));
  const nowLabel = tpl(L.now, { t: dur(now, L) });
  const nw = textWidth(nowLabel, fs);
  const nx = Math.min(Math.max(cx, x0 + nw / 2), x1 - nw / 2);
  parts.push(text(nx, nowLane, nowLabel, { "font-size": fs, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));

  // Readout.
  let yy = bottom + axisHeight(true, fs) + 22;
  const lines: Array<[string, string | undefined]> = [];
  lines.push([tpl(L.sess, { a: m.accepted.slice(1).filter(Boolean).length, pub: m.published ? L.yes : L.no }), m.published ? "fig-t-strong" : undefined]);
  lines.push([copySentence(p, L), m.copyBlock ? undefined : "fig-t-strong"]);
  if (p.scope === "call") lines.push([L.windowCall, "fig-t-muted fig-t-num"]);
  else if (!p.bound) lines.push([tpl(L.window, { ttl: dur(m.ttl, L), det: dur(m.tDetect, L), stale: dur(STALE[p.revoke], L), end: dur(m.end, L) }), "fig-t-muted fig-t-num"]);
  const usable = !m.copyBlock && now >= LEAK && now < m.end;
  if (now >= LEAK) lines.push([usable ? tpl(L.nowCopy, { t: dur(now, L), k: m.k }) : tpl(L.nowCopyNone, { t: dur(now, L) }), "fig-t-muted"]);
  for (const [s, cls] of lines) {
    for (const ln of Wr(s, TYPE.body, w)) { parts.push(text(0, yy, ln, { "font-size": TYPE.body, class: cls })); yy += TYPE.body + 5; }
    yy += 4;
  }
  return svg(w, yy, describe(st, lang), ...parts);
}

const DAY = 86400;
export default defineFigure({
  name: "credential-reach",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    scope: {
      kind: "choice", label: { en: "Token scope", zh: "令牌范围" }, default: "all",
      options: [
        { value: "all", label: { en: "All repositories", zh: "所有仓库" } },
        { value: "repo", label: { en: "site repository", zh: "site 仓库" } },
        { value: "task", label: { en: "Read site only", zh: "只读 site" } },
        { value: "call", label: { en: "One call", zh: "单次调用" } },
      ],
    },
    ttl: {
      kind: "choice", label: { en: "Lifetime", zh: "有效期" }, default: 30 * DAY, control: "buttons",
      options: [
        { value: 300, label: { en: "5 min", zh: "5 min" } },
        { value: 3600, label: { en: "1 h", zh: "1 h" } },
        { value: 8 * 3600, label: { en: "8 h", zh: "8 h" } },
        { value: DAY, label: { en: "1 d", zh: "1 d" } },
        { value: 7 * DAY, label: { en: "7 d", zh: "7 d" } },
        { value: 30 * DAY, label: { en: "30 d", zh: "30 d" } },
        { value: 90 * DAY, label: { en: "90 d", zh: "90 d" } },
      ],
    },
    revoke: {
      kind: "choice", label: { en: "Revocation check", zh: "撤销检查" }, default: "expiry", control: "buttons",
      options: [
        { value: "expiry", label: { en: "Expiry only", zh: "只靠过期" } },
        { value: "status", label: { en: "Status list, 15 min push", zh: "状态列表，15 分钟推送" } },
        { value: "introspect", label: { en: "Introspection, 1 min cache", zh: "内省，缓存 1 分钟" } },
      ],
    },
    detect: {
      kind: "choice", label: { en: "Leak detected after", zh: "发现泄露用时" }, default: 6 * 3600, control: "buttons",
      options: [
        { value: 600, label: { en: "10 min", zh: "10 min" } },
        { value: 3600, label: { en: "1 h", zh: "1 h" } },
        { value: 6 * 3600, label: { en: "6 h", zh: "6 h" } },
        { value: DAY, label: { en: "1 d", zh: "1 d" } },
        { value: 7 * DAY, label: { en: "7 d", zh: "7 d" } },
      ],
    },
    bound: { kind: "toggle", label: { en: "Bound to the agent's key (sender-constrained)", zh: "绑定智能体密钥（发送方约束）" }, default: false },
  },
  timeline: {
    rate: 10,
    discrete: true,
    duration: () => DURATION,
    keyframes,
    // Open just after revocation is requested: whether the copy still works
    // there is what the lifetime and the revocation path decide.
    poster: (p) => {
      if (p.scope === "call") return posOf(LEAK) + 4;
      return Math.min(DURATION, posOf(LEAK + p.detect) + 2);
    },
  },
  render,
  describe,
});
