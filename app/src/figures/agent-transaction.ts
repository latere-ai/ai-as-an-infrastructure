// One purchase by a paying agent, stepped through as separate decisions. The
// agent-economy chapter keeps access, money, and delivery apart ("some belong
// to access, some to money, and some to delivery; their timestamps and
// authorities differ"), names the useful states (denied, payment required,
// authorized, settled, fulfilled, failed, unknown, refunded, disputed), and
// gives the control rule for the agent's budget: reserve before an
// irreversible action, commit when the defined effect occurs, release on a
// known failure, and send an unknown outcome to reconciliation rather than an
// automatic retry.
//
// Each scenario is a fixed script of events, one per timeline step, drawn from
// the chapter's test list: a quote change after approval, revocation during
// checkout, a lost response after success, settlement followed by delivery
// failure, and partial fulfillment, plus the path without failure, a denial,
// and a blind retry under a new idempotency key. Every event is made by one
// party and appends one evidence record. The state of each track, the budget,
// and the ledger at step t are folds of events 0..t, so scrubbing backward
// works. Amounts and identifiers are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { tpl } from "./lib/format.ts";

type T = { en: string; zh: string };
type Role = "principal" | "agent" | "merchant" | "provider";
type Track = "access" | "payment" | "delivery" | "receipt";

const STATES: Record<Track, string[]> = {
  access: ["requested", "required", "accepted", "denied"],
  payment: ["authorized", "settled", "declined", "refunded", "disputed"],
  delivery: ["fulfilled", "partial", "failed"],
  receipt: ["pending", "unknown", "succeeded", "failed", "escalated"],
};
type Status = "neutral" | "good" | "warn" | "bad";
const STATUS: Record<string, Status> = {
  requested: "neutral", required: "neutral", accepted: "good", denied: "bad",
  authorized: "neutral", settled: "good", declined: "bad", refunded: "warn", disputed: "warn",
  fulfilled: "good", partial: "warn", failed: "bad",
  pending: "neutral", unknown: "warn", succeeded: "good", escalated: "warn",
};
const LIMIT = 100; // mandate maximum, USD

interface Ev {
  by: Role;
  say: T; // what happens, for the scrubber's event label and describe()
  rec: T; // the evidence record the party appends
  set?: Partial<Record<Track, string>>;
  reserve?: number;
  commit?: number;
  release?: number;
  charge?: boolean; // a settled charge
  refund?: number; // money returned to the principal, USD
}

// ---------------------------------------------------------------- scripts

const MANDATE: Ev = {
  by: "principal",
  say: { en: "The principal signs mandate m-3: up to $100, approval needed above $50, expires in 24 h", zh: "委托人签署授权书 m-3：最多 $100，单笔超过 $50 需要审批，24 小时后到期" },
  rec: { en: "mandate m-3 v1: max $100, approval above $50, expiry 24 h", zh: "授权书 m-3 v1：上限 $100，超过 $50 需审批，24 小时到期" },
};
const REQUEST: Ev = {
  by: "agent", set: { access: "requested", receipt: "pending" },
  say: { en: "The agent sends a signed request for three items", zh: "智能体发出签名请求，要购买三件商品" },
  rec: { en: "signed request, key agent-7", zh: "签名请求，密钥 agent-7" },
};
const QUOTE: Ev = {
  by: "merchant", set: { access: "required" },
  say: { en: "The merchant answers 402 Payment Required with quote q-7 for $42", zh: "商户返回 402 Payment Required，附报价 q-7，共 $42" },
  rec: { en: "quote q-7: 3 × $14 = $42.00, valid 10 min", zh: "报价 q-7：3 × $14 = $42.00，有效 10 分钟" },
};
const RESERVE: Ev = {
  by: "agent", reserve: 42,
  say: { en: "The quote fits the mandate, so the agent reserves $42 under idempotency key p-19", zh: "报价在授权范围内，智能体用幂等键 p-19 预留 $42" },
  rec: { en: "budget reservation $42.00, key p-19", zh: "预算预留 $42.00，幂等键 p-19" },
};
const AUTH: Ev = {
  by: "provider", set: { payment: "authorized" },
  say: { en: "The payment provider checks mandate m-3 and authorizes $42", zh: "支付服务商核对授权书 m-3，授权 $42" },
  rec: { en: "payment response: authorized $42.00, key p-19", zh: "支付响应：已授权 $42.00，幂等键 p-19" },
};
const ACCEPT: Ev = {
  by: "merchant", set: { access: "accepted" },
  say: { en: "The merchant accepts order o-19 under its own policy", zh: "商户按自身策略接受订单 o-19" },
  rec: { en: "merchant decision: order o-19 accepted", zh: "商户决定：接受订单 o-19" },
};
const SETTLE: Ev = {
  by: "provider", set: { payment: "settled" }, charge: true,
  say: { en: "The payment settles", zh: "付款完成清算" },
  rec: { en: "payment response: settled $42.00, key p-19", zh: "支付响应：已清算 $42.00，幂等键 p-19" },
};
const FULFILL: Ev = {
  by: "merchant", set: { delivery: "fulfilled" },
  say: { en: "The merchant delivers the three items", zh: "商户交付三件商品" },
  rec: { en: "fulfillment result: o-19 delivered", zh: "履约结果：o-19 已交付" },
};
const DONE: Ev = {
  by: "agent", set: { receipt: "succeeded" }, commit: 42,
  say: { en: "The response arrives: the agent commits the $42 and appends the effect receipt", zh: "响应到达：智能体提交这 $42，并追加效果回执" },
  rec: { en: "effect receipt: succeeded", zh: "效果回执：成功" },
};
const TIMEOUT: Ev = {
  by: "agent", set: { receipt: "unknown" },
  say: { en: "The response is lost and the agent times out: whether it was charged is unknown, so the $42 stays reserved", zh: "响应丢失，智能体超时：是否已扣款并不清楚，所以这 $42 继续预留" },
  rec: { en: "timeout: no response for key p-19", zh: "超时：幂等键 p-19 没有响应" },
};

const SCRIPTS: Record<string, Ev[]> = {
  happy: [MANDATE, REQUEST, QUOTE, RESERVE, AUTH, ACCEPT, SETTLE, FULFILL, DONE],
  denied: [MANDATE, REQUEST,
    { by: "merchant", set: { access: "denied" },
      say: { en: "The merchant's policy does not accept this agent: the request is denied before any quote", zh: "商户策略不接受这个智能体：请求在报价之前就被拒绝" },
      rec: { en: "merchant decision: denied, agent not accepted", zh: "商户决定：拒绝，不接受该智能体" } },
    { by: "agent", set: { receipt: "failed" },
      say: { en: "Nothing was reserved: the agent records a known failure and reports to the principal", zh: "尚未预留任何预算：智能体记录一次已确认的失败，并报告委托人" },
      rec: { en: "effect receipt: failed, access denied", zh: "效果回执：失败，访问被拒绝" } }],
  quote: [MANDATE, REQUEST, QUOTE, RESERVE,
    { by: "merchant",
      say: { en: "Before payment, the merchant replaces q-7 with quote q-8 for $58", zh: "付款之前，商户用报价 q-8（$58）替换了 q-7" },
      rec: { en: "quote q-8: $58.00, replaces q-7", zh: "报价 q-8：$58.00，替换 q-7" } },
    { by: "agent", set: { receipt: "escalated" }, release: 42,
      say: { en: "$58 is above the $50 approval rule: the agent releases the $42 and asks the principal", zh: "$58 超过 $50 的审批线：智能体释放 $42，转请委托人决定" },
      rec: { en: "effect receipt: escalated, quote above approval rule", zh: "效果回执：升级处理，报价超过审批线" } }],
  revoked: [MANDATE, REQUEST, QUOTE, RESERVE,
    { by: "principal",
      say: { en: "During checkout the principal revokes mandate m-3", zh: "结账过程中，委托人撤销了授权书 m-3" },
      rec: { en: "revocation of mandate m-3", zh: "撤销授权书 m-3" } },
    { by: "provider", set: { payment: "declined" },
      say: { en: "The payment provider checks the revocation reference and declines the payment", zh: "支付服务商查询撤销引用，拒绝这笔付款" },
      rec: { en: "payment response: declined, mandate revoked", zh: "支付响应：拒绝，授权书已撤销" } },
    { by: "agent", set: { receipt: "failed" }, release: 42,
      say: { en: "A known failure: the agent releases the $42 and records the outcome", zh: "失败已经确认：智能体释放 $42，并记录结果" },
      rec: { en: "effect receipt: failed, payment declined", zh: "效果回执：失败，付款被拒绝" } }],
  lost: [MANDATE, REQUEST, QUOTE, RESERVE, AUTH, ACCEPT, SETTLE, FULFILL, TIMEOUT,
    { by: "agent",
      say: { en: "Unknown goes to reconciliation, not a retry: the agent looks up key p-19 at the provider and order o-19 at the merchant", zh: "未知结果进入对账，而不是重试：智能体向支付服务商查询 p-19，向商户查询 o-19" },
      rec: { en: "reconciliation: p-19 settled, o-19 delivered", zh: "对账：p-19 已清算，o-19 已交付" } },
    { by: "agent", set: { receipt: "succeeded" }, commit: 42,
      say: { en: "Both records agree: the agent commits the $42 and appends the effect receipt", zh: "两份记录一致：智能体提交这 $42，并追加效果回执" },
      rec: { en: "effect receipt: succeeded, by reconciliation", zh: "效果回执：成功，经对账确认" } }],
  retry: [MANDATE, REQUEST, QUOTE, RESERVE, AUTH, ACCEPT, SETTLE, FULFILL, TIMEOUT,
    { by: "agent", set: { receipt: "pending" }, reserve: 42,
      say: { en: "Without reconciling, the agent retries under a new key p-20 and reserves another $42", zh: "智能体没有对账，直接换用新幂等键 p-20 重试，又预留 $42" },
      rec: { en: "budget reservation $42.00, key p-20", zh: "预算预留 $42.00，幂等键 p-20" } },
    { by: "provider", set: { payment: "settled" }, charge: true,
      say: { en: "The provider sees a new payment and settles a second $42", zh: "支付服务商把它当成一笔新付款，又清算了 $42" },
      rec: { en: "payment response: settled $42.00, key p-20", zh: "支付响应：已清算 $42.00，幂等键 p-20" } },
    { by: "agent", set: { receipt: "succeeded" }, commit: 42,
      say: { en: "Reconciliation finds two settled charges for one order: the agent commits $42 for p-19", zh: "对账发现一张订单有两笔已清算付款：智能体为 p-19 提交 $42" },
      rec: { en: "reconciliation: p-19 and p-20 settled, one order", zh: "对账：p-19 和 p-20 均已清算，只有一张订单" } },
    { by: "merchant", release: 42, refund: 42,
      say: { en: "The merchant refunds the duplicate and the agent releases the second $42", zh: "商户退还重复扣款，智能体释放第二笔 $42" },
      rec: { en: "refund of p-20: $42.00, duplicate charge", zh: "退款 p-20：$42.00，重复扣款" } }],
  delivery: [MANDATE, REQUEST, QUOTE, RESERVE, AUTH, ACCEPT, SETTLE,
    { by: "merchant", set: { delivery: "failed" },
      say: { en: "The payment has settled, but fulfillment fails: the items are out of stock", zh: "付款已经清算，履约却失败了：商品缺货" },
      rec: { en: "fulfillment result: failed, out of stock", zh: "履约结果：失败，缺货" } },
    { by: "merchant", set: { payment: "refunded" }, refund: 42,
      say: { en: "The contract's refund route returns the $42", zh: "按合同中的退款路径退回 $42" },
      rec: { en: "refund of p-19: $42.00, references o-19", zh: "退款 p-19：$42.00，引用 o-19" } },
    { by: "agent", set: { receipt: "failed" }, release: 42,
      say: { en: "The agent releases the reservation and records the failure with both references", zh: "智能体释放预留，并连同两项引用记录这次失败" },
      rec: { en: "effect receipt: failed, refunded", zh: "效果回执：失败，已退款" } }],
  dispute: [MANDATE, REQUEST, QUOTE, RESERVE, AUTH, ACCEPT, SETTLE,
    { by: "merchant", set: { delivery: "partial" },
      say: { en: "The merchant delivers two of the three items", zh: "商户只交付了三件中的两件" },
      rec: { en: "fulfillment result: 2 of 3 items delivered", zh: "履约结果：交付 3 件中的 2 件" } },
    { by: "agent", set: { receipt: "escalated" },
      say: { en: "The contract cannot classify a partial order, so the agent stops and escalates", zh: "合同无法归类部分履约，智能体停止并升级处理" },
      rec: { en: "effect receipt: escalated, partial fulfillment", zh: "效果回执：升级处理，部分履约" } },
    { by: "principal", set: { payment: "disputed" },
      say: { en: "The principal disputes $14 with the provider, citing quote q-7 and the fulfillment result", zh: "委托人向支付服务商就 $14 提出争议，引用报价 q-7 和履约结果" },
      rec: { en: "dispute d-4 on p-19: $14.00", zh: "争议 d-4，针对 p-19：$14.00" } },
    { by: "provider", set: { payment: "refunded" }, commit: 28, release: 14, refund: 14,
      say: { en: "The dispute is resolved: $14 is refunded, $28 committed, and $14 released", zh: "争议解决：退款 $14，提交 $28，释放 $14" },
      rec: { en: "refund of $14.00 on p-19, dispute d-4 closed", zh: "p-19 退款 $14.00，争议 d-4 结案" } }],
};
type Scenario = keyof typeof SCRIPTS;

// The step the page opens on: the moment that makes each scenario's point.
const POSTER: Record<string, number> = { happy: 8, denied: 2, quote: 5, revoked: 5, lost: 9, retry: 10, delivery: 8, dispute: 9 };

// ---------------------------------------------------------------- state at t

interface Snap {
  state: Record<Track, string | null>;
  seen: Record<Track, Set<string>>;
  changed: Set<Track>; // tracks this step moved
  reserved: number;
  committed: number;
  released: number;
  charges: number;
  refunded: number;
}

function snap(evs: Ev[], t: number): Snap {
  const state: Record<Track, string | null> = { access: null, payment: null, delivery: null, receipt: null };
  const seen: Record<Track, Set<string>> = { access: new Set(), payment: new Set(), delivery: new Set(), receipt: new Set() };
  let changed = new Set<Track>();
  let reserved = 0, committed = 0, released = 0, charges = 0, refunded = 0;
  for (let i = 0; i <= t && i < evs.length; i++) {
    const e = evs[i];
    changed = new Set();
    for (const [k, v] of Object.entries(e.set ?? {}) as Array<[Track, string]>) { state[k] = v; seen[k].add(v); changed.add(k); }
    reserved += (e.reserve ?? 0) - (e.commit ?? 0) - (e.release ?? 0);
    committed += e.commit ?? 0;
    released += e.release ?? 0;
    if (e.charge) charges++;
    refunded += e.refund ?? 0;
  }
  return { state, seen, changed, reserved, committed, released, charges, refunded };
}

type P = { scenario: Scenario };

const labels = {
  en: {
    title: "One agent purchase as separate decisions",
    tracks: "State by track, each owned by one authority",
    access: "Access", payment: "Payment", delivery: "Delivery", receipt: "Effect receipt", budget: "Budget",
    ownAccess: "merchant", ownPayment: "payment provider", ownDelivery: "merchant", ownReceipt: "agent", ownBudget: "agent, mandate m-3",
    requested: "requested", required: "payment required", accepted: "accepted", denied: "denied",
    authorized: "authorized", settled: "settled", declined: "declined", refunded: "refunded", disputed: "disputed",
    fulfilled: "fulfilled", partial: "partial", failed: "failed",
    pending: "pending", unknown: "unknown", succeeded: "succeeded", escalated: "escalated",
    bCommitted: "committed {v}", bReserved: "reserved {v}", bAvail: "available {v} of $100", bReleased: "released so far {v}", bCharges: "settled charges {n}", bRefunded: "refunded {v}",
    ledger: "Evidence ledger: one record per event, appended by the party that made it",
    principal: "principal", agent: "agent", merchant: "merchant", provider: "provider",
    none: "no state yet",
    describe: "{scenario}, step {i} of {n}: {say}. Access {a}, payment {p}, delivery {d}, effect receipt {r}. Budget: {c} committed, {res} reserved, {av} available of $100; {ch} settled, {rf} refunded.",
    dash: "none",
    sc_happy: "No failure", sc_denied: "Access denied", sc_quote: "Quote change after approval", sc_revoked: "Revocation during checkout",
    sc_lost: "Lost response after success", sc_retry: "Blind retry under a new key", sc_delivery: "Delivery failure after settlement", sc_dispute: "Partial fulfillment and dispute",
    charges: "{n:charge/charges}",
  },
  zh: {
    title: "把一次智能体购买拆成各自独立的决定",
    tracks: "各条轨道的状态，分别由一方负责",
    access: "访问", payment: "付款", delivery: "交付", receipt: "效果回执", budget: "预算",
    ownAccess: "商户", ownPayment: "支付服务商", ownDelivery: "商户", ownReceipt: "智能体", ownBudget: "智能体，授权书 m-3",
    requested: "已请求", required: "需要付款", accepted: "已接受", denied: "拒绝",
    authorized: "已授权", settled: "已清算", declined: "被拒付", refunded: "已退款", disputed: "有争议",
    fulfilled: "已履约", partial: "部分履约", failed: "失败",
    pending: "待定", unknown: "未知", succeeded: "成功", escalated: "升级处理",
    bCommitted: "已提交 {v}", bReserved: "已预留 {v}", bAvail: "可用 {v}，上限 $100", bReleased: "累计释放 {v}", bCharges: "已清算扣款 {n} 笔", bRefunded: "已退款 {v}",
    ledger: "证据账本：每个事件一条记录，由作出决定的一方追加",
    principal: "委托人", agent: "智能体", merchant: "商户", provider: "支付服务商",
    none: "尚无状态",
    describe: "{scenario}，第 {i} 步，共 {n} 步：{say}。访问{a}，付款{p}，交付{d}，效果回执{r}。预算：已提交 {c}，已预留 {res}，可用 {av}（上限 $100）；已清算扣款 {ch}，已退款 {rf}。",
    dash: "尚无状态",
    sc_happy: "没有失败", sc_denied: "访问被拒绝", sc_quote: "批准后报价变化", sc_revoked: "结账时撤销授权", sc_lost: "成功后响应丢失",
    sc_retry: "换新幂等键盲目重试", sc_delivery: "清算后交付失败", sc_dispute: "部分履约与争议",
    charges: "{n} 笔",
  },
};
type L = typeof labels.en;

const usd = (v: number) => `$${Math.round(v)}`;
const TRACKS: Track[] = ["access", "payment", "delivery", "receipt"];
const OWNER: Record<Track, keyof L> = { access: "ownAccess", payment: "ownPayment", delivery: "ownDelivery", receipt: "ownReceipt" };
const ROLE_COLOR: Record<Role, string> = { principal: C.c1, agent: C.c2, merchant: C.c3, provider: C.c4 };
const TRACK_ROLE: Record<Track, Role> = { access: "merchant", payment: "provider", delivery: "merchant", receipt: "agent" };

function stepAt(p: P, t: number): number {
  return Math.max(0, Math.min(SCRIPTS[p.scenario].length - 1, Math.round(t)));
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const evs = SCRIPTS[st.p.scenario];
  const i = stepAt(st.p, st.t);
  const s = snap(evs, i);
  const name = (k: Track) => (s.state[k] ? L[s.state[k] as keyof L] : L.dash);
  return tpl(L.describe, {
    scenario: L[`sc_${st.p.scenario}` as keyof L], i, n: evs.length - 1, say: evs[i].say[lang],
    a: name("access"), p: name("payment"), d: name("delivery"), r: name("receipt"),
    c: usd(s.committed), res: usd(s.reserved), av: usd(LIMIT - s.committed - s.reserved), ch: tpl(L.charges, { n: s.charges }), rf: usd(s.refunded),
  });
}

// ---------------------------------------------------------------- render

const STATUS_COLOR: Record<Status, string> = { neutral: C.ink2, good: C.good, warn: C.warn, bad: C.bad };

// One track: its label and owner, then a chip per state. The current state is
// filled in its status color, earlier states are outlined, the rest are faint.
function trackRow(k: Track, s: Snap, y0: number, w: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const labelW = narrow ? 0 : 150;
  parts.push(el("circle", { cx: 5, cy: y0 + 9, r: 4, fill: ROLE_COLOR[TRACK_ROLE[k]] }));
  parts.push(text(14, y0 + 13, L[k], { "font-size": TYPE.body, class: "fig-t-strong" }));
  const owner = L[OWNER[k]];
  if (narrow) parts.push(text(14 + textWidth(L[k], TYPE.body) + 8, y0 + 13, owner, { "font-size": TYPE.small, class: "fig-t-muted" }));
  else parts.push(text(14, y0 + 28, owner, { "font-size": TYPE.small, class: "fig-t-muted" }));
  let cx = labelW, cy = narrow ? y0 + 20 : y0;
  const chipH = 22, gap = 6;
  for (const st of STATES[k]) {
    const lbl = L[st as keyof L];
    const cw = textWidth(lbl, TYPE.body) + 18;
    if (cx > labelW && cx + cw > w) { cx = labelW; cy += chipH + gap; }
    const current = s.state[k] === st;
    const seen = s.seen[k].has(st);
    const col = STATUS_COLOR[STATUS[st]];
    const moved = current && s.changed.has(k);
    parts.push(el("rect", {
      x: cx + 0.75, y: cy + 0.75, width: cw - 1.5, height: chipH - 1.5, rx: 10,
      fill: current ? col : seen ? "none" : C.panel, "fill-opacity": current ? 0.2 : undefined,
      stroke: current ? col : seen ? C.ink3 : "none", "stroke-width": moved ? 2.4 : current ? 1.5 : 1, "stroke-dasharray": !current && seen ? "3 2" : undefined,
    }));
    parts.push(text(cx + cw / 2, cy + 15, lbl, { "font-size": TYPE.body, "text-anchor": "middle", class: current ? "fig-t-strong" : seen ? "fig-t-muted" : "fig-t-faint" }));
    cx += cw + gap;
  }
  const h = Math.max(narrow ? 0 : 32, cy + chipH - y0) + 10;
  return { svg: g({}, ...parts), h };
}

function budgetRow(s: Snap, y0: number, w: number, narrow: boolean, uid: string, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const labelW = narrow ? 0 : 150;
  parts.push(el("circle", { cx: 5, cy: y0 + 9, r: 4, fill: ROLE_COLOR.agent }));
  parts.push(text(14, y0 + 13, L.budget, { "font-size": TYPE.body, class: "fig-t-strong" }));
  if (narrow) parts.push(text(14 + textWidth(L.budget, TYPE.body) + 8, y0 + 13, L.ownBudget, { "font-size": TYPE.small, class: "fig-t-muted" }));
  else parts.push(text(14, y0 + 28, L.ownBudget, { "font-size": TYPE.small, class: "fig-t-muted" }));
  const bx = labelW, by = narrow ? y0 + 22 : y0 + 2, bw = w - labelW;
  const X = (v: number) => bx + (v / LIMIT) * bw;
  parts.push(el("rect", { x: bx, y: by, width: bw, height: 16, rx: 3, fill: C.panel }));
  if (s.committed > 0) parts.push(el("rect", { x: bx, y: by, width: X(s.committed) - bx, height: 16, fill: C.ink2, "fill-opacity": 0.75 }));
  if (s.reserved > 0) {
    parts.push(el("rect", { x: X(s.committed), y: by, width: X(s.committed + s.reserved) - X(s.committed), height: 16, fill: `url(#${uid}-res)` }));
    parts.push(el("rect", { x: X(s.committed), y: by, width: X(s.committed + s.reserved) - X(s.committed), height: 16, fill: "none", stroke: C.ink2, "stroke-width": 1 }));
  }
  const line1 = [tpl(L.bCommitted, { v: usd(s.committed) }), tpl(L.bReserved, { v: usd(s.reserved) }), tpl(L.bAvail, { v: usd(LIMIT - s.committed - s.reserved) })];
  const line2 = [tpl(L.bReleased, { v: usd(s.released) }), tpl(L.bCharges, { n: s.charges }), tpl(L.bRefunded, { v: usd(s.refunded) })];
  const sep = "  ·  ";
  let ty = by + 32;
  for (const ln of [line1, line2]) {
    const joined = ln.join(sep);
    if (textWidth(joined, TYPE.body) <= bw) { parts.push(text(bx, ty, joined, { "font-size": TYPE.body, class: "fig-t-num" })); ty += 17; }
    else for (const piece of ln) { parts.push(text(bx, ty, piece, { "font-size": TYPE.body, class: "fig-t-num" })); ty += 17; }
  }
  return { svg: g({}, ...parts), h: ty - y0 };
}

// Ledger rows for the whole script: the layout is fixed by the script so the
// figure keeps its height while the rows up to step i appear.
function ledgerRows(evs: Ev[], i: number, y0: number, w: number, narrow: boolean, L: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const numW = 24;
  const roleW = narrow ? 0 : Math.max(...(["principal", "agent", "merchant", "provider"] as Role[]).map((r) => textWidth(L[r], TYPE.body))) + 22;
  let y = y0;
  evs.forEach((e, k) => {
    const role = L[e.by];
    const body = narrow ? `${role}${lang === "zh" ? "：" : ": "}${e.rec[lang]}` : e.rec[lang];
    const tx = numW + (narrow ? 14 : roleW);
    const lines = wrapCJK(body, TYPE.body, w - tx);
    const h = Math.max(1, lines.length) * 16 + 6;
    if (k <= i) {
      if (k === i) parts.push(el("rect", { x: 0, y: y - 1, width: w, height: h, rx: 3, fill: C.panel }));
      parts.push(text(numW - 6, y + 13, k, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
      parts.push(el("circle", { cx: numW + 4, cy: y + 9, r: 4, fill: ROLE_COLOR[e.by] }));
      if (!narrow) parts.push(text(numW + 14, y + 13, role, { "font-size": TYPE.body, class: "fig-t-muted" }));
      lines.forEach((ln, j) => parts.push(text(tx, y + 13 + j * 16, ln, { "font-size": TYPE.body, class: k === i ? "fig-t-strong" : undefined })));
    }
    y += h;
  });
  return { svg: g({ class: "fig-ledger" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const evs = SCRIPTS[st.p.scenario];
  const i = stepAt(st.p, st.t);
  const s = snap(evs, i);
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-res`, C.ink2, 4, 1.2))];

  // What happens at each step is the transport's event label (every event is
  // a keyframe) and the highlighted ledger row, so the drawing holds state.
  let y = 0;
  parts.push(text(0, y + 12, L.tracks, { "font-size": TYPE.small, class: "fig-t-muted" }));
  y += 22;
  for (const k of TRACKS) {
    const r = trackRow(k, s, y, w, narrow, L);
    parts.push(r.svg);
    y += r.h;
  }
  const b = budgetRow(s, y, w, narrow, st.uid, L);
  parts.push(b.svg);
  y += b.h + 12;

  parts.push(el("line", { x1: 0, x2: w, y1: y - 6, y2: y - 6, stroke: C.rule, "stroke-width": 1 }));
  for (const ln of wrapCJK(L.ledger, TYPE.small, w)) { parts.push(text(0, y + 12, ln, { "font-size": TYPE.small, class: "fig-t-muted" })); y += 15; }
  y += 8;
  const lr = ledgerRows(evs, i, y, w, narrow, L, lang);
  parts.push(lr.svg);
  y += lr.h;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

const SCENARIOS: Array<{ value: Scenario; label: T }> = (Object.keys(SCRIPTS) as Scenario[]).map((k) => ({ value: k, label: { en: labels.en[`sc_${k}` as keyof L], zh: labels.zh[`sc_${k}` as keyof L] } }));

export default defineFigure({
  name: "agent-transaction",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    scenario: { kind: "choice", label: { en: "Scenario", zh: "情形" }, default: "lost", control: "select", options: SCENARIOS },
  },
  timeline: {
    rate: 0.8,
    discrete: true,
    duration: (p) => SCRIPTS[p.scenario].length - 1,
    keyframes: (p, lang) => SCRIPTS[p.scenario].map((e, k) => ({ t: k, label: e.say[lang] })),
    poster: (p) => POSTER[p.scenario] ?? SCRIPTS[p.scenario].length - 1,
  },
  render,
  describe,
});
