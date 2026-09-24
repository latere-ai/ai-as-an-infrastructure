// One consequential tool call on its way from an agent's proposal to an
// external effect, and what an approval binds. The chapter's path:
//
//   authenticate claims -> canonicalize -> PDP decision -> exact approval
//   -> PEP recomputes the digest, checks the nonce, executes once -> receipt
//
// The request is canonicalized before policy evaluation (case, whitespace, and
// defaults made explicit), and the digest is SHA-256 over the canonical record
// with sorted keys, computed here in the page. The approval either binds that
// digest with a one-time nonce, or binds only the agent's natural-language
// summary. Between approval and execution the reader can change the request
// (add a field, change the target repository, let the server redirect it to
// another host) or replay the approval for a second call. At time of use the
// enforcement point recomputes the digest over the request it is about to
// send: a digest-bound approval rejects any difference and a spent nonce; a
// summary-bound approval has nothing to compare, so the changed request runs.
//
// The request is an illustrative GitHub pull request; the digests are real
// SHA-256 values of the records shown.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- SHA-256

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// SHA-256 of a UTF-8 string, as lowercase hex (FIPS 180-4).
export function sha256(s: string): string {
  const msg = new TextEncoder().encode(s);
  const len = msg.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  dv.setUint32(padded.length - 4, bits >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, gg, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & gg)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = gg; gg = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += gg; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
}

// ---------------------------------------------------------------- the request

type Binding = "digest" | "summary";
type Change = "none" | "field" | "target" | "redirect" | "replay";
type Field = "action" | "resource" | "request" | "params" | "data" | "redirects";
const FIELDS: Field[] = ["action", "resource", "request", "params", "data", "redirects"];
type Rec = Record<Field, string>;

// The canonical record the policy decision point evaluates. The agent's raw
// arguments name the repository as "ACME/Site " and omit the base branch; the
// canonical form lowercases and trims the name and writes the default out.
const APPROVED: Rec = {
  action: "pulls.create",
  resource: "github.com/acme/site",
  request: "POST api.github.com/repos/acme/site/pulls",
  params: "base=main, head=fix-typo, title=\"Fix typo in README\"",
  data: "public",
  redirects: "not followed",
};

// The request the executor is about to send after each change.
function executed(change: Change): Rec {
  const r = { ...APPROVED };
  if (change === "field") {
    r.params = `${APPROVED.params}, body=<acme/api/docs/internal.md>`;
    r.data = "confidential";
  } else if (change === "target") {
    r.resource = "github.com/other-org/site";
    r.request = "POST api.github.com/repos/other-org/site/pulls";
  } else if (change === "redirect") {
    r.request = "POST uploads.example.net/pulls (307 from api.github.com)";
    r.redirects = "followed";
  }
  return r;
}

const canon = (r: Rec) => JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f, r[f]]).sort(([a], [b]) => (a < b ? -1 : 1))));
const memo = new Map<string, string>();
function digest(r: Rec): string {
  const k = canon(r);
  let d = memo.get(k);
  if (!d) { d = sha256(k); memo.set(k, d); }
  return d;
}
const short = (d: string) => `${d.slice(0, 12)}…`;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "An approval bound to the exact request",
    s0: "Proposal", s1: "Claims", s2: "Canonical request", s3: "Decision", s4: "Approval", s5: "Change", s5none: "No change", s5replay: "Second use", s6: "Enforcement", s7: "Record",
    k0: "The agent proposes a pull request",
    k1: "Claims are bound to evidence",
    k2: "The request is canonicalized and hashed",
    k3: "The PDP returns a challenge bound to the digest",
    k4dig: "The approval binds the digest and a one-time nonce",
    k4sum: "The approval covers only the agent's summary",
    k5none: "Nothing changes before execution",
    k5field: "A field is added after approval",
    k5target: "The target repository changes after approval",
    k5redirect: "The server redirects the request to another host",
    k5replay: "The same approval is presented for a second call",
    k6: "The enforcement point checks the request it will send",
    k7ok: "One effect, and a receipt linked to the digest",
    k7deny: "No effect: the change needs a new decision",
    k7denyReplay: "No second effect: the nonce is spent",
    k7bad: "An effect the human did not approve",
    proposal: "Agent proposal",
    summary: "Summary: “Open a pull request that fixes a typo in the site README”",
    raw: "Raw arguments: repo=\"ACME/Site \", head=\"fix-typo\", title=\"Fix typo in README\"",
    claims: "Claims: user u-1842, agent triage@r12, workload spiffe://acme.dev/runner, tenant acme",
    record: "Canonical request",
    colField: "field",
    colApproved: "at decision",
    colExec: "at execution",
    colExec2: "second call",
    pending: "not yet sent",
    fAction: "action", fResource: "resource", fRequest: "request", fParams: "parameters", fData: "data class", fRedirects: "redirects",
    digest: "SHA-256",
    decision: "Decision and approval",
    pdp: "PDP, policy rev 14: challenge. Exact approval required; decision expires in 5 min.",
    apDigest: "Approved by u-1842 on the trusted screen: digest {d}, nonce 5c1e, expires in 5 min.",
    apSummary: "Approved by u-1842 in the chat: the summary above. No digest, no nonce.",
    pep: "Enforcement point",
    chkDigest: "digest at execution equals the approved digest",
    chkNonce: "nonce unused",
    chkExpiry: "decision and approval unexpired",
    chkNothing: "the approval names no digest to compare",
    yes: "yes", no: "no",
    outOk: "Executes once with a narrow credential. Receipt: request id, digest {d}, provider result.",
    outDenyDigest: "Rejected before any effect: digest {d2} does not match the approved {d1}. The changed request needs a new decision and approval.",
    outDenyNonce: "Rejected: nonce 5c1e was spent by the first call.",
    outSame: "Executes; the request happens to be the one the human read about.",
    outBad: "Executes the changed request: the summary still reads true, so nothing stops it.",
    outBadReplay: "Executes a second time: a summary approval has no nonce to spend.",
    waiting: "waits for the request",
    describe: "Step {t}, {stage}. The approval binds {binding}; {change}. {outcome}",
    bDigest: "the canonical request digest and a nonce",
    bSummary: "only the agent's summary",
    cNone: "the request does not change",
    cField: "a field is added after approval",
    cTarget: "the target repository changes after approval",
    cRedirect: "the server redirects the request to another host",
    cReplay: "the approval is presented for a second call",
    dOk: "The enforcement point executes it once.",
    dDeny: "The enforcement point rejects it before any effect.",
    dBad: "The executor runs a request the human did not approve.",
    dPending: "Enforcement has not happened yet.",
  },
  zh: {
    title: "绑定到确切请求的审批",
    s0: "提议", s1: "声明", s2: "规范请求", s3: "决定", s4: "审批", s5: "变更", s5none: "无变更", s5replay: "再次使用", s6: "强制执行", s7: "记录",
    k0: "智能体提议创建拉取请求",
    k1: "声明绑定到证据",
    k2: "请求经过规范化并计算哈希",
    k3: "策略决策点返回绑定摘要的质询",
    k4dig: "审批绑定摘要和一次性随机数",
    k4sum: "审批只覆盖智能体写的摘要",
    k5none: "执行前请求没有变化",
    k5field: "审批后请求多了一个字段",
    k5target: "审批后目标仓库被换掉",
    k5redirect: "服务器把请求重定向到另一台主机",
    k5replay: "同一份审批被用于第二次调用",
    k6: "执行点检查即将发出的请求",
    k7ok: "产生一次效果，回执关联摘要",
    k7deny: "没有效果：变更需要重新决定",
    k7denyReplay: "没有第二次效果：随机数已用掉",
    k7bad: "产生了人没有批准的效果",
    proposal: "智能体提议",
    summary: "摘要：“创建拉取请求，修正 site 仓库 README 中的错字”",
    raw: "原始参数：repo=\"ACME/Site \"，head=\"fix-typo\"，title=\"Fix typo in README\"",
    claims: "声明：用户 u-1842，智能体 triage@r12，工作负载 spiffe://acme.dev/runner，租户 acme",
    record: "规范请求",
    colField: "字段",
    colApproved: "决定时",
    colExec: "执行时",
    colExec2: "第二次调用",
    pending: "尚未发出",
    fAction: "动作", fResource: "资源", fRequest: "请求", fParams: "参数", fData: "数据分类", fRedirects: "重定向",
    digest: "SHA-256",
    decision: "决定与审批",
    pdp: "策略决策点，策略版本 14：质询。需要精确审批；决定 5 分钟后过期。",
    apDigest: "u-1842 在可信界面批准：摘要 {d}，随机数 5c1e，5 分钟后过期。",
    apSummary: "u-1842 在对话中批准了上面的摘要。没有摘要值，也没有随机数。",
    pep: "策略执行点",
    chkDigest: "执行时的摘要等于批准时的摘要",
    chkNonce: "随机数未使用",
    chkExpiry: "决定和审批都未过期",
    chkNothing: "审批里没有可比较的摘要",
    yes: "是", no: "否",
    outOk: "附加窄权限凭证，只执行一次。回执：请求 ID、摘要 {d}、提供商结果。",
    outDenyDigest: "在产生任何效果前拒绝：摘要 {d2} 与批准的 {d1} 不一致。变更后的请求需要重新决定和审批。",
    outDenyNonce: "拒绝：随机数 5c1e 已被第一次调用用掉。",
    outSame: "执行；这次请求恰好就是人看到的那一个。",
    outBad: "执行了变更后的请求：摘要读起来仍然成立，没有任何检查拦住它。",
    outBadReplay: "第二次执行：摘要式审批没有可消耗的随机数。",
    waiting: "等待请求",
    describe: "第 {t} 步，{stage}。审批绑定{binding}；{change}。{outcome}",
    bDigest: "规范请求摘要和随机数",
    bSummary: "智能体写的摘要",
    cNone: "请求没有变化",
    cField: "审批后请求多了一个字段",
    cTarget: "审批后目标仓库被换掉",
    cRedirect: "服务器把请求重定向到另一台主机",
    cReplay: "审批被用于第二次调用",
    dOk: "执行点只执行一次。",
    dDeny: "执行点在产生效果前拒绝。",
    dBad: "执行器发出了人没有批准的请求。",
    dPending: "尚未进入强制执行。",
  },
};
type L = typeof labels.en;
type P = { binding: Binding; change: Change };

const STAGES = 8; // 0..7
const stageName = (L: L, i: number, p: P) => (i === 5 && p.change === "none" ? L.s5none : i === 5 && p.change === "replay" ? L.s5replay : (L as Record<string, string>)[`s${i}`]);
const fieldName = (L: L, f: Field) => ({ action: L.fAction, resource: L.fResource, request: L.fRequest, params: L.fParams, data: L.fData, redirects: L.fRedirects })[f];

// The enforcement result: "ok" executes the approved request, "deny" rejects,
// "same" executes an unchanged request without a check, "bad" executes a
// request that differs from what was approved.
function outcome(p: P): "ok" | "deny" | "same" | "bad" {
  if (p.binding === "digest") return p.change === "none" ? "ok" : "deny";
  return p.change === "none" ? "same" : "bad";
}

function keyLabel(L: L, i: number, p: P): string {
  if (i === 4) return p.binding === "digest" ? L.k4dig : L.k4sum;
  if (i === 5) return ({ none: L.k5none, field: L.k5field, target: L.k5target, redirect: L.k5redirect, replay: L.k5replay })[p.change];
  if (i === 7) { const o = outcome(p); return o === "deny" ? (p.change === "replay" ? L.k7denyReplay : L.k7deny) : o === "bad" ? L.k7bad : L.k7ok; }
  return (L as Record<string, string>)[`k${i}`];
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const t = Math.round(st.t);
  const o = outcome(p);
  const change = ({ none: L.cNone, field: L.cField, target: L.cTarget, redirect: L.cRedirect, replay: L.cReplay })[p.change];
  const out = t < 6 ? L.dPending : o === "deny" ? L.dDeny : o === "bad" ? L.dBad : L.dOk;
  return tpl(L.describe, { t, stage: stageName(L, t, p), binding: p.binding === "digest" ? L.bDigest : L.bSummary, change, outcome: out });
}

// ---------------------------------------------------------------- drawing

// Wrap for record values: besides spaces and CJK glyphs, a line may break
// after "/", "," or "=" so a path or a parameter list fits a narrow column.
// CJK closing punctuation is kept off line starts, as in lib/kinsoku.ts.
const NO_START = /^[，。、；：？！）」』》〉’”%]/u;
function wrapRec(s: string, size: number, maxW: number): string[] {
  const units: string[] = [];
  let cur = "";
  for (const ch of s) {
    const cjk = ch.codePointAt(0)! >= 0x2e80;
    if (cjk && cur) { units.push(cur); cur = ""; }
    cur += ch;
    if (cjk || ch === " " || ch === "/" || ch === "," || ch === "=") { units.push(cur); cur = ""; }
  }
  if (cur) units.push(cur);
  const lines: string[] = [];
  let line = "";
  for (const u of units) {
    if (line && textWidth((line + u).trimEnd(), size) > maxW) { lines.push(line.trimEnd()); line = u.trimStart(); }
    else line += u;
  }
  if (line.trim()) lines.push(line.trimEnd());
  for (let i = 1; i < lines.length; i++) {
    while (lines[i] && NO_START.test(lines[i])) {
      const ch = [...lines[i]][0];
      lines[i - 1] += ch;
      lines[i] = lines[i].slice(ch.length).trimStart();
    }
  }
  return lines.filter((l) => l.length > 0);
}

// Wrapped text lines drawn from a first baseline at y.
function para(lines: string[], x: number, y: number, size: number, cls?: string): string {
  return lines.map((ln, i) => text(x, y + i * (size + 5), ln, { "font-size": size, class: cls })).join("");
}
const paraH = (n: number, size: number) => n * (size + 5);

// A card: content drawn from y by `body` (which returns its bottom edge), then
// the frame sized to it and placed underneath.
function card(x: number, y: number, w: number, on: boolean, future: boolean, body: (top: number) => { svg: string; bottom: number }): { svg: string; h: number } {
  const b = body(y);
  const h = b.bottom - y + 10;
  const frame = el("rect", { x, y, width: w, height: h, rx: 6, fill: future ? "none" : C.panel, stroke: on ? C.ink : C.rule, "stroke-width": on ? 1.8 : 1, "stroke-dasharray": future ? "4 3" : undefined });
  return { svg: frame + b.svg, h };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const t = Math.round(st.t);
  const fs = TYPE.body;
  const parts: string[] = [];
  const o = outcome(p);
  const ex = executed(p.change);
  const d1 = digest(APPROVED);
  const d2 = digest(ex);
  const lh = fs + 5;

  // ---- stage track: a vertical list on desktop, a row of dots on a phone
  let rx = 0, rw = w, y = 0;
  const dot = (cx: number, cy: number, i: number) => {
    const now = i === t, past = i < t;
    const warn = i === 5 && p.change !== "none" && i <= t;
    return el("circle", { cx, cy, r: now ? 7 : 5, fill: now || past ? (warn ? C.warn : C.ink) : C.paper, stroke: warn ? C.warn : now || past ? C.ink : C.ink3, "stroke-width": 1.5 });
  };
  const trackH = 14 + (STAGES - 1) * 30 + 14;
  if (!narrow) {
    parts.push(el("line", { x1: 8, x2: 8, y1: 14, y2: 14 + (STAGES - 1) * 30, stroke: C.rule, "stroke-width": 2 }));
    for (let i = 0; i < STAGES; i++) {
      const cy = 14 + i * 30;
      parts.push(dot(8, cy, i));
      parts.push(text(22, cy + 4, stageName(L, i, p), { "font-size": fs, class: i === t ? "fig-t-strong" : i < t ? undefined : "fig-t-faint" }));
    }
    rx = 142;
    rw = w - rx;
  } else {
    const gap = (w - 16) / (STAGES - 1);
    parts.push(el("line", { x1: 8, x2: w - 8, y1: 10, y2: 10, stroke: C.rule, "stroke-width": 2 }));
    for (let i = 0; i < STAGES; i++) parts.push(dot(8 + i * gap, 10, i));
    parts.push(text(0, 38, stageName(L, t, p), { "font-size": TYPE.label, class: "fig-t-strong" }));
    y = 52;
  }
  const pad = 10;
  const iw = rw - 2 * pad - 8; // wrap width, with room for tabular digits
  const title = (s: string, x: number, yy: number, on: boolean) => text(x, yy, s, { "font-size": TYPE.label, class: on ? "fig-t-strong" : "fig-t-faint" });

  // ---- A. proposal and claims
  const A = card(rx, y, rw, t <= 1, false, (top) => {
    const out: string[] = [];
    let yy = top + 12 + TYPE.label * 0.8;
    out.push(title(L.proposal, rx + pad, yy, true));
    yy += 8 + fs;
    const ls = wrapRec(L.summary, fs, iw), lr = wrapRec(L.raw, fs, iw), lc = wrapRec(L.claims, fs, iw);
    out.push(para(ls, rx + pad, yy, fs)); yy += paraH(ls.length, fs);
    out.push(para(lr, rx + pad, yy, fs, "fig-t-muted fig-t-num")); yy += paraH(lr.length, fs) + 6;
    out.push(para(lc, rx + pad, yy, fs, t >= 1 ? "fig-t-muted" : "fig-t-faint")); yy += paraH(lc.length, fs);
    return { svg: out.join(""), bottom: yy - lh + 4 };
  });
  parts.push(A.svg); y += A.h + 10;

  // ---- B. the canonical request at decision and at execution, with digests.
  // Desktop: field | at decision | at execution. Phone: the field name above
  // two value columns.
  const shown = t >= 2, execShown = t >= 5;
  const B = card(rx, y, rw, t === 2 || t === 5, !shown, (top) => {
    const out: string[] = [];
    let yy = top + 12 + TYPE.label * 0.8;
    out.push(title(L.record, rx + pad, yy, shown));
    yy += 10 + fs;
    const keyW = narrow ? 0 : Math.max(...FIELDS.map((f) => textWidth(fieldName(L, f), fs)), textWidth(L.digest, fs)) + 12;
    const colW = (iw - keyW - 8) / 2;
    const c1 = rx + pad + keyW, c2 = c1 + colW + 8;
    if (!narrow) out.push(text(rx + pad, yy, L.colField, { "font-size": fs, class: "fig-t-faint" }));
    out.push(text(c1, yy, L.colApproved, { "font-size": fs, class: "fig-t-faint" }));
    out.push(text(c2, yy, p.change === "replay" ? L.colExec2 : L.colExec, { "font-size": fs, class: "fig-t-faint" }));
    yy += 7;
    const row = (name: string, a: string[], b: string[], diff: boolean, strong: boolean) => {
      out.push(el("line", { x1: rx + pad, x2: rx + rw - pad, y1: yy, y2: yy, stroke: strong ? C.rule : C.grid, "stroke-width": 1 }));
      let base = yy + fs + 5;
      if (narrow) { out.push(text(rx + pad, base, name, { "font-size": fs, class: strong ? "fig-t-strong" : "fig-t-muted" })); base += lh; }
      else out.push(text(rx + pad, base, name, { "font-size": fs, class: strong ? "fig-t-strong" : "fig-t-muted" }));
      const n = Math.max(a.length, b.length); // fixed per change, so stepping never moves the cards
      if (execShown && diff) out.push(el("rect", { x: c2 - 4, y: base - fs - 1, width: colW + 6, height: paraH(n, fs), rx: 3, fill: C.bad, "fill-opacity": 0.14 }));
      if (shown) out.push(para(a, c1, base, fs, strong ? "fig-t-strong fig-t-num" : "fig-t-num"));
      if (execShown) out.push(para(b, c2, base, fs, diff || strong ? "fig-t-strong fig-t-num" : "fig-t-num fig-t-muted"));
      else if (strong) out.push(text(c2, base, L.pending, { "font-size": fs, class: "fig-t-faint" }));
      yy = base + paraH(n, fs) - lh + 8;
    };
    for (const f of FIELDS) row(fieldName(L, f), wrapRec(APPROVED[f], fs, colW - 2), wrapRec(ex[f], fs, colW - 2), APPROVED[f] !== ex[f], false);
    row(L.digest, [short(d1)], [short(d2)], d1 !== d2, true);
    return { svg: out.join(""), bottom: yy - 4 };
  });
  parts.push(B.svg); y += B.h + 10;

  // ---- C. decision and approval
  const C3 = card(rx, y, rw, t === 3 || t === 4, t < 3, (top) => {
    const out: string[] = [];
    let yy = top + 12 + TYPE.label * 0.8;
    out.push(title(L.decision, rx + pad, yy, t >= 3));
    yy += 8 + fs;
    const lp = wrapRec(L.pdp, fs, iw);
    const la = wrapRec(p.binding === "digest" ? tpl(L.apDigest, { d: short(d1) }) : L.apSummary, fs, iw);
    if (t >= 3) out.push(para(lp, rx + pad, yy, fs));
    yy += paraH(lp.length, fs) + 6;
    if (t >= 4) {
      if (p.binding === "summary") out.push(el("rect", { x: rx + pad - 4, y: yy - fs - 2, width: iw + 8, height: paraH(la.length, fs) + 2, rx: 3, fill: C.warn, "fill-opacity": 0.18 }));
      out.push(para(la, rx + pad, yy, fs, p.binding === "digest" ? "fig-t-num" : undefined));
    }
    yy += paraH(la.length, fs);
    return { svg: out.join(""), bottom: yy - lh + 4 };
  });
  parts.push(C3.svg); y += C3.h + 10;

  // ---- D. enforcement point: the checks and the outcome
  const D = card(rx, y, rw, t >= 6, t < 6, (top) => {
    const out: string[] = [];
    let yy = top + 12 + TYPE.label * 0.8;
    out.push(title(L.pep, rx + pad, yy, t >= 6));
    if (t < 6) out.push(text(rx + rw - pad, yy, L.waiting, { "font-size": fs, "text-anchor": "end", class: "fig-t-faint" }));
    yy += 8 + fs;
    const checks: Array<[string, boolean | null]> = p.binding === "digest"
      ? [[L.chkDigest, d1 === d2], [L.chkNonce, p.change !== "replay"], [L.chkExpiry, true]]
      : [[L.chkNothing, null], [L.chkExpiry, true]];
    const markW = Math.max(textWidth(L.yes, fs), textWidth(L.no, fs), textWidth("–", fs)) + 12;
    for (const [s, ok] of checks) {
      const lines = wrapRec(s, fs, iw - markW - 8);
      if (t >= 6) {
        const col = ok === null ? C.warn : ok ? C.good : C.bad;
        out.push(el("rect", { x: rx + pad, y: yy - fs, width: markW, height: fs + 5, rx: 3, fill: col, "fill-opacity": 0.22 }));
        out.push(text(rx + pad + markW / 2, yy, ok === null ? "–" : ok ? L.yes : L.no, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
      }
      out.push(para(lines, rx + pad + markW + 8, yy, fs, t >= 6 ? undefined : "fig-t-faint"));
      yy += paraH(lines.length, fs) + 2;
    }
    const outText = o === "ok" ? tpl(L.outOk, { d: short(d1) })
      : o === "deny" ? (p.change === "replay" ? L.outDenyNonce : tpl(L.outDenyDigest, { d1: short(d1), d2: short(d2) }))
        : o === "same" ? L.outSame : p.change === "replay" ? L.outBadReplay : L.outBad;
    const lo = wrapRec(outText, fs, iw - 4);
    yy += 8;
    if (t >= 7) {
      const col = o === "bad" ? C.bad : o === "same" ? C.warn : C.good;
      out.push(el("rect", { x: rx + pad - 4, y: yy - fs - 2, width: iw + 8, height: paraH(lo.length, fs) + 2, rx: 3, fill: col, "fill-opacity": 0.18 }));
      out.push(para(lo, rx + pad, yy, fs, "fig-t-strong"));
    } else if (t === 6) out.push(para(lo, rx + pad, yy, fs, "fig-t-muted"));
    yy += paraH(lo.length, fs);
    return { svg: out.join(""), bottom: yy - lh + 4 };
  });
  parts.push(D.svg); y += D.h;

  const total = narrow ? y : Math.max(y, trackH);
  return svg(w, total + 2, describe(st, lang), g({ class: "fig-request-binding" }, ...parts));
}

export default defineFigure({
  name: "request-binding",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    binding: {
      kind: "choice", label: { en: "Approval binds", zh: "审批绑定" }, default: "digest",
      options: [
        { value: "digest", label: { en: "Request digest and nonce", zh: "请求摘要和随机数" } },
        { value: "summary", label: { en: "Agent's summary", zh: "智能体的摘要" } },
      ],
    },
    change: {
      kind: "choice", label: { en: "After approval", zh: "审批之后" }, default: "field", control: "buttons",
      options: [
        { value: "none", label: { en: "No change", zh: "不变" } },
        { value: "field", label: { en: "Add a field", zh: "增加字段" } },
        { value: "target", label: { en: "Change the repository", zh: "换目标仓库" } },
        { value: "redirect", label: { en: "Server redirect", zh: "服务器重定向" } },
        { value: "replay", label: { en: "Reuse the approval", zh: "重用审批" } },
      ],
    },
  },
  timeline: {
    rate: 0.8,
    discrete: true,
    duration: () => STAGES - 1,
    keyframes: (p, lang) => Array.from({ length: STAGES }, (_, i) => ({ t: i, label: keyLabel(labels[lang], i, p) })),
    // Open on the enforcement check, where the binding decides the outcome.
    poster: () => 6,
  },
  render,
  describe,
});
