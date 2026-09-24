// Remote attestation for a confidential GPU deployment, stepped from the
// challenge to the key-release decision. Three attesters, the CPU
// confidential VM, the GPU, and the NVSwitch, produce parallel evidence for
// one challenge, each in the chapter's abstract form
//
//   E = Sign_skA(n ‖ m ‖ c ‖ pk_E),
//
// and a verifier appraises them in the order the chapter lists: signatures
// and endorsements, freshness, reference values, TCB floor and revocation,
// debug and mode attributes, then the composite binding (one session, one
// endpoint key, the declared topology) and the release policy. The relying
// party releases a key only when the chapter's predicate
// Fresh ∧ Verify ∧ Bind ∧ Policy holds, and fails closed otherwise.
//
// The CPU measurement is a measured-boot register: each event extends it,
// r_i = H(r_{i−1} ‖ H(component_i)), and the verifier replays the event log
// against reference values. Digests are illustrative 32-bit FNV-1a values of
// component names, not a real measurement algorithm.
//
// Each injected fault is one of the chapter's regression scenarios or residual
// risks. One of them, an approved image with an unsafe parser, passes every
// check: a measurement says which code runs, not that the code is safe.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Fault = "none" | "replay" | "relay" | "mixed" | "measurement" | "unmeasured" | "stale" | "revoked" | "debug" | "unsafe";
type Who = "cpu" | "gpu" | "sw";
const WHO: Who[] = ["cpu", "gpu", "sw"];
type P = { fault: Fault };

// FNV-1a, 32-bit, as 8 hex digits.
function h(s: string): string {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(16).padStart(8, "0");
}

const NONCE = h("challenge 2026-09-24T10:00Z");
const OLD_NONCE = h("challenge 2026-09-17T08:12Z");
const PK = h("ephemeral key of this endpoint");
const PK_OTHER = h("ephemeral key of another machine");
const FLOOR = 5; // minimum security version

interface Event { name: "firmware" | "kernel" | "image" | "model"; digest: string }
interface Evidence { n: string; m: string; svn: number; revoked: boolean; debug: boolean; cc: boolean; pk: string }

function bootLog(f: Fault): Event[] {
  const ev: Event[] = [
    { name: "firmware", digest: h("guest firmware 2.4") },
    { name: "kernel", digest: h("guest kernel 6.8") },
    { name: "image", digest: h(f === "measurement" ? "serving image 3.1, modified" : "serving image 3.1") },
  ];
  if (f !== "unmeasured") ev.push({ name: "model", digest: h("model weights r12") });
  return ev;
}
const REF: Record<Event["name"], string> = {
  firmware: h("guest firmware 2.4"), kernel: h("guest kernel 6.8"), image: h("serving image 3.1"), model: h("model weights r12"),
};
function registers(ev: Event[]): string[] {
  const out: string[] = [];
  let r = "00000000";
  for (const e of ev) { r = h(r + e.digest); out.push(r); }
  return out;
}
const REF_GPU = h("GPU VBIOS 96.00 + firmware 550");
const REF_SW = h("NVSwitch firmware 35.2");

function evidence(f: Fault): Record<Who, Evidence> {
  const log = bootLog(f);
  const reg = registers(log);
  const cpu: Evidence = { n: f === "replay" ? OLD_NONCE : NONCE, m: reg[reg.length - 1], svn: 6, revoked: false, debug: f === "debug", cc: true, pk: f === "relay" ? PK_OTHER : PK };
  const gpu: Evidence = { n: NONCE, m: REF_GPU, svn: f === "stale" ? 4 : 5, revoked: false, debug: false, cc: true, pk: f === "relay" || f === "mixed" ? PK_OTHER : PK };
  const sw: Evidence = { n: NONCE, m: REF_SW, svn: 5, revoked: f === "revoked", debug: false, cc: true, pk: f === "relay" ? PK_OTHER : PK };
  return { cpu, gpu, sw };
}

type Check = "sig" | "fresh" | "ref" | "tcb" | "attr" | "bind" | "policy";
const CHECKS: Check[] = ["sig", "fresh", "ref", "tcb", "attr", "bind", "policy"];
const SPANNING = new Set<Check>(["bind", "policy"]);
// Timeline: 0 challenge, 1 measured boot, 2 evidence, 3..9 the checks, 10 release.
const STEP_OF: Record<Check, number> = { sig: 3, fresh: 4, ref: 5, tcb: 6, attr: 7, bind: 8, policy: 9 };
const LAST = 10;

function appraise(f: Fault): Record<Check, Record<Who, boolean> | boolean> {
  const e = evidence(f);
  const refCpu = (() => {
    const log = bootLog(f);
    const reg = registers(log);
    // Replay: every event must match its reference value and the log must
    // reproduce the quoted register.
    return log.every((x) => x.digest === REF[x.name]) && reg[reg.length - 1] === e.cpu.m;
  })();
  const per = (fn: (w: Who) => boolean) => ({ cpu: fn("cpu"), gpu: fn("gpu"), sw: fn("sw") });
  return {
    sig: per(() => true),
    fresh: per((w) => e[w].n === NONCE),
    ref: { cpu: refCpu, gpu: e.gpu.m === REF_GPU, sw: e.sw.m === REF_SW },
    tcb: per((w) => e[w].svn >= FLOOR && !e[w].revoked),
    attr: per((w) => !e[w].debug && e[w].cc),
    bind: WHO.every((w) => e[w].pk === PK),
    // The policy requires the model revision to be covered by a measurement.
    policy: bootLog(f).some((x) => x.name === "model"),
  };
}

function passed(v: Record<Who, boolean> | boolean): boolean {
  return typeof v === "boolean" ? v : WHO.every((w) => v[w]);
}

function firstFailure(f: Fault): Check | null {
  const a = appraise(f);
  return CHECKS.find((c) => !passed(a[c])) ?? null;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Attestation from a fresh challenge to key release",
    rp: "Relying party (key broker)",
    rpLine: "challenge n = {n}, channel key pk_E = {pk}",
    cpu: "CPU confidential VM",
    gpu: "GPU",
    sw: "NVSwitch",
    colCpu: "CPU",
    colGpu: "GPU",
    colSw: "switch",
    fN: "n",
    fM: "m",
    fC: "c",
    fPk: "pk_E",
    claims: "svn {s}{rev}, {dbg}",
    rev: ", revoked",
    dbgOff: "debug off",
    dbgOn: "debug on",
    ccOn: "CC mode on",
    signed: "signed by the vendor-endorsed key",
    pending: "not produced yet",
    bootHead: "CPU measured boot: r_i = H(r_{i−1} ‖ H(component))",
    firmware: "firmware",
    kernel: "guest kernel",
    image: "serving image",
    model: "model weights",
    noModel: "model loaded later, not measured",
    reg: "r = {r}",
    matHead: "Verifier appraisal",
    sig: "signatures and endorsements",
    fresh: "freshness: n matches",
    ref: "measurements vs reference values",
    tcb: "TCB floor {f} and revocation",
    attr: "debug, migration, CC mode",
    bind: "bind: one session, one pk_E, topology",
    policy: "policy: tenant, purpose, model revision",
    released: "Key released through the channel bound to pk_E",
    refused: "Key release refused at the {c} check: fail closed",
    sSig: "signature", sFresh: "freshness", sRef: "reference-value", sTcb: "TCB floor", sAttr: "attribute", sBind: "binding", sPolicy: "policy",
    undecided: "Release decision pending",
    est: "Establishes: {s}",
    not: "Does not establish: {s}",
    k0: "The relying party sends a fresh nonce",
    k1: "Measured boot extends each component into a register",
    k2: "Each attester signs n ‖ m ‖ c ‖ pk_E",
    k3: "Signatures and endorsement chains",
    k4: "Freshness: every nonce matches",
    k5: "Measurements against reference values",
    k6: "TCB version floor and revocation",
    k7: "Debug, migration and confidential-mode attributes",
    k8: "Bind: one session, one endpoint key, the declared topology",
    k9: "Policy: tenant, purpose, workload and model revision",
    k10ok: "Key released through the bound channel",
    k10no: "Key release refused, fail closed",
    e0: "evidence produced after this challenge can be told apart from older evidence",
    n0: "anything about the platform yet",
    e1: "the register commits to the ordered list of measured components",
    n1: "that those components are safe, or anything loaded after the last measured event",
    e2: "the attester's key vouches for n, m, c and pk_E together",
    n2: "that the attester's state is acceptable; the verifier decides that",
    e3: "each piece of evidence comes from genuine hardware endorsed by its vendor",
    n3: "that the hardware runs approved code",
    e4: "the evidence was produced for this challenge, so a replayed quote fails",
    n4: "that the evidence came from this endpoint",
    e5: "each measured component is an approved one",
    n5: "semantic behavior, absence of vulnerabilities, or coverage of unmeasured code",
    e6: "firmware and microcode are at or above the floor and not revoked",
    n6: "freedom from side channels outside the vendor's threat model",
    e7: "debug is off, migration is as policy says, and the GPU is in confidential mode",
    n7: "that the application does not log or export plaintext",
    e8: "CPU, GPU and switch evidence describe one session and one endpoint key, so mixed or relayed evidence fails",
    n8: "that the links between devices are encrypted; that is a property of the configuration",
    e9: "the result is for this tenant, purpose, workload, model revision and expiry",
    n9: "that the approved code is safe",
    e10ok: "only the endpoint holding the private key for pk_E receives the secret",
    n10ok: "protection after release against malicious approved code, output disclosure or tool exfiltration",
    e10no: "no secret leaves the broker while required evidence is missing, stale or inconsistent",
    n10no: "why the evidence failed; the record of the rejected evidence has to say that",
    faultNote: "Injected: {f}",
    fnone: "no fault",
    freplay: "quote replay: CPU evidence carries an old nonce",
    frelay: "relay: valid evidence from another machine, bound to its own key",
    fmixed: "mixed sessions: GPU evidence bound to another session's key",
    fmeasurement: "mismatched measurement: modified serving image",
    funmeasured: "model loaded at runtime without a measurement",
    fstale: "stale TCB: GPU firmware below the version floor",
    frevoked: "revoked switch firmware",
    fdebug: "CPU confidential VM launched with debug on",
    funsafe: "approved image with an unsafe parser: passes, measurement is not code review",
    describe: "Step {t} of {d}: {k}. Fault: {f}. {out}",
    outOk: "All checks pass and the key is released.",
    outNo: "The {c} check rejects the evidence and key release fails closed.",
    outPending: "The decision is not reached yet.",
  },
  zh: {
    title: "从新鲜质询到密钥发布的远程证明",
    rp: "依赖方（密钥代理）",
    rpLine: "质询 n = {n}，通道密钥 pk_E = {pk}",
    cpu: "CPU 机密虚拟机",
    gpu: "GPU",
    sw: "NVSwitch",
    colCpu: "CPU",
    colGpu: "GPU",
    colSw: "交换机",
    fN: "n",
    fM: "m",
    fC: "c",
    fPk: "pk_E",
    claims: "svn {s}{rev}，{dbg}",
    rev: "，已撤销",
    dbgOff: "调试关闭",
    dbgOn: "调试开启",
    ccOn: "机密模式开启",
    signed: "由厂商背书的密钥签名",
    pending: "尚未生成",
    bootHead: "CPU 度量启动：r_i = H(r_{i−1} ‖ H(组件))",
    firmware: "固件",
    kernel: "来宾内核",
    image: "服务镜像",
    model: "模型权重",
    noModel: "模型稍后加载，未被度量",
    reg: "r = {r}",
    matHead: "验证方的评估",
    sig: "签名与背书链",
    fresh: "新鲜度：n 一致",
    ref: "度量值与参考值比对",
    tcb: "TCB 下限 {f} 与撤销状态",
    attr: "调试、迁移、机密模式",
    bind: "绑定：同一会话、同一 pk_E、拓扑",
    policy: "策略：租户、用途、模型版本",
    released: "通过与 pk_E 绑定的通道发布密钥",
    refused: "在“{c}”检查处拒绝发布密钥：默认关闭",
    sSig: "签名", sFresh: "新鲜度", sRef: "参考值", sTcb: "TCB 下限", sAttr: "属性", sBind: "绑定", sPolicy: "策略",
    undecided: "发布决定尚未作出",
    est: "能证明：{s}",
    not: "不能证明：{s}",
    k0: "依赖方发出新鲜随机数",
    k1: "度量启动把每个组件扩展进寄存器",
    k2: "每个证明方对 n ‖ m ‖ c ‖ pk_E 签名",
    k3: "签名与背书链",
    k4: "新鲜度：每个随机数都一致",
    k5: "度量值与参考值比对",
    k6: "TCB 版本下限与撤销状态",
    k7: "调试、迁移与机密模式属性",
    k8: "绑定：同一会话、同一端点密钥、声明的拓扑",
    k9: "策略：租户、用途、工作负载与模型版本",
    k10ok: "通过绑定的通道发布密钥",
    k10no: "拒绝发布密钥，默认关闭",
    e0: "在这次质询之后生成的证据，可以与更早的证据区分开",
    n0: "平台的任何情况",
    e1: "寄存器对度量过的组件及其顺序作出承诺",
    n1: "这些组件是否安全，以及最后一次度量之后加载的任何内容",
    e2: "证明方的密钥同时为 n、m、c 和 pk_E 作保",
    n2: "证明方的状态是否可接受，这由验证方判断",
    e3: "每份证据都来自有厂商背书的真实硬件",
    n3: "硬件运行的是获准代码",
    e4: "证据是为这次质询生成的，重放的报文会失败",
    n4: "证据来自这个端点",
    e5: "每个被度量的组件都是获准的组件",
    n5: "语义行为、没有漏洞，或未被度量的代码",
    e6: "固件和微码不低于版本下限，也没有被撤销",
    n6: "厂商威胁模型之外的侧信道",
    e7: "调试关闭，迁移符合策略，GPU 处于机密模式",
    n7: "应用不会记录或导出明文",
    e8: "CPU、GPU 与交换机的证据属于同一会话、同一端点密钥，混搭或中继的证据会失败",
    n8: "设备之间的链路已加密，这取决于具体配置",
    e9: "结果对应这个租户、用途、工作负载、模型版本和有效期",
    n9: "获准的代码是安全的",
    e10ok: "只有持有 pk_E 对应私钥的端点才能拿到秘密",
    n10ok: "发布之后对恶意获准代码、输出泄露或工具外泄的防护",
    e10no: "必要证据缺失、过期或不一致时，没有任何秘密离开密钥代理",
    n10no: "证据为什么失败，这要由被拒证据的记录说明",
    faultNote: "注入：{f}",
    fnone: "无故障",
    freplay: "证明报文重放：CPU 证据带着旧的随机数",
    frelay: "中继：另一台机器的有效证据，绑定的是它自己的密钥",
    fmixed: "混搭会话：GPU 证据绑定了另一会话的密钥",
    fmeasurement: "度量值不匹配：服务镜像被修改",
    funmeasured: "模型在运行时加载，没有度量",
    fstale: "TCB 过期：GPU 固件低于版本下限",
    frevoked: "交换机固件已被撤销",
    fdebug: "CPU 机密虚拟机以调试模式启动",
    funsafe: "获准镜像中有不安全的解析器：全部通过，度量不等于代码审查",
    describe: "第 {t} 步（共 {d} 步）：{k}。故障：{f}。{out}",
    outOk: "所有检查通过，密钥被发布。",
    outNo: "“{c}”检查拒绝了证据，密钥发布默认关闭。",
    outPending: "尚未作出决定。",
  },
};
type L = typeof labels.en;

const keyLabel = (t: number, f: Fault, L: L) => {
  if (t >= LAST) return firstFailure(f) ? L.k10no : L.k10ok;
  return L[`k${t}` as "k0"];
};
const stepText = (t: number, f: Fault, L: L): [string, string] => {
  if (t >= LAST) return firstFailure(f) ? [L.e10no, L.n10no] : [L.e10ok, L.n10ok];
  return [L[`e${t}` as "e0"], L[`n${t}` as "n0"]];
};
const checkName = (c: Check, L: L) => (c === "tcb" ? tpl(L.tcb, { f: FLOOR }) : L[c]);
const faultName = (f: Fault, L: L) => L[`f${f}` as "fnone"];
const SHORT: Record<Check, "sSig" | "sFresh" | "sRef" | "sTcb" | "sAttr" | "sBind" | "sPolicy"> = { sig: "sSig", fresh: "sFresh", ref: "sRef", tcb: "sTcb", attr: "sAttr", bind: "sBind", policy: "sPolicy" };
const shortName = (c: Check, L: L) => L[SHORT[c]];

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const t = Math.round(st.t);
  const f = st.p.fault;
  const fail = firstFailure(f);
  const out = t < LAST ? L.outPending : fail ? tpl(L.outNo, { c: shortName(fail, L) }) : L.outOk;
  return tpl(L.describe, { t, d: LAST, k: keyLabel(t, f, L), f: faultName(f, L), out });
}

// ---------------------------------------------------------------- drawing

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

function mark(x: number, y: number, ok: boolean | null): string {
  if (ok === null) return el("circle", { cx: x, cy: y, r: 3, fill: C.grid });
  const r = 8;
  const glyph = ok
    ? el("path", { d: `M${x - 3.6},${y + 0.2}L${x - 1},${y + 2.9}L${x + 3.8},${y - 2.6}`, fill: "none", stroke: C.paper, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" })
    : el("path", { d: `M${x - 3},${y - 3}L${x + 3},${y + 3}M${x - 3},${y + 3}L${x + 3},${y - 3}`, fill: "none", stroke: C.paper, "stroke-width": 2, "stroke-linecap": "round" });
  return el("circle", { cx: x, cy: y, r, fill: ok ? C.good : C.bad }) + glyph;
}

// Which evidence field a check examines, so a bad field is flagged once the
// verifier has looked at it.
const FIELD_OF: Partial<Record<Check, "n" | "m" | "c" | "pk">> = { fresh: "n", ref: "m", tcb: "c", attr: "c", bind: "pk" };

function card(who: Who, e: Evidence, a: ReturnType<typeof appraise>, t: number, L: L, lang: Lang, x: number, y: number, w: number, narrow: boolean): { svg: string; h: number } {
  const size = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const title = L[who];
  const produced = t >= 2;
  const bad = (field: "n" | "m" | "c" | "pk") => CHECKS.some((c) => FIELD_OF[c] === field && t >= STEP_OF[c]
    && (typeof a[c] === "boolean" ? !(a[c] as boolean) && (field !== "pk" || e.pk !== PK) : !(a[c] as Record<Who, boolean>)[who]));
  const claims = tpl(L.claims, { s: e.svn, rev: e.revoked ? L.rev : "", dbg: who === "gpu" ? L.ccOn : e.debug ? L.dbgOn : L.dbgOff });
  const rows: Array<[string, string, "n" | "m" | "c" | "pk"]> = [[L.fN, e.n, "n"], [L.fM, e.m, "m"], [L.fC, claims, "c"], [L.fPk, e.pk, "pk"]];
  const rowH = size + 6;
  const hdr = TYPE.body + 12;
  const h = hdr + (produced ? rows.length * rowH + size + 10 : size + 12);
  parts.push(el("rect", { x, y, width: w, height: h, rx: 6, fill: C.panel, stroke: C.rule, "stroke-width": 1 }));
  parts.push(text(x + 10, y + 6 + TYPE.body, title, { "font-size": TYPE.body, class: "fig-t-strong" }));
  let yy = y + hdr;
  if (!produced) {
    parts.push(text(x + 10, yy + size, L.pending, { "font-size": size, class: "fig-t-muted" }));
  } else {
    const keyW = 36;
    for (const [k, v, field] of rows) {
      const isBad = bad(field);
      if (isBad) parts.push(el("rect", { x: x + 4, y: yy - 2, width: w - 8, height: rowH, rx: 3, fill: C.bad, "fill-opacity": 0.16, stroke: C.bad, "stroke-width": 1 }));
      parts.push(text(x + 10, yy + size, k, { "font-size": size, class: "fig-t-muted fig-t-num" }));
      const vv = lines(v, size, w - keyW - 16, lang)[0];
      parts.push(text(x + 10 + keyW, yy + size, vv, { "font-size": size, class: isBad ? "fig-t-strong fig-t-num" : "fig-t-num" }));
      yy += rowH;
    }
    parts.push(text(x + 10, yy + size + 2, L.signed, { "font-size": size, class: "fig-t-muted" }));
  }
  return { svg: g({}, ...parts), h };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const t = Math.round(st.t);
  const f = st.p.fault;
  const e = evidence(f);
  const a = appraise(f);
  const fail = firstFailure(f);
  const parts: string[] = [];
  let y = 0;

  // ---- relying party and the challenge
  const rpl = lines(tpl(L.rpLine, { n: NONCE, pk: PK }), size, w - 20, lang);
  const rpH = 20 + TYPE.body + rpl.length * (size + 4);
  parts.push(el("rect", { x: 0, y, width: w, height: rpH, rx: 6, fill: C.c1, "fill-opacity": 0.1, stroke: C.c1, "stroke-width": 1.2 }));
  parts.push(text(10, y + 6 + TYPE.body, L.rp, { "font-size": TYPE.body, class: "fig-t-strong" }));
  rpl.forEach((ln, i) => parts.push(text(10, y + 12 + TYPE.body + (i + 1) * (size + 4), ln, { "font-size": size, class: "fig-t-num" })));
  y += rpH + 12;

  // ---- three parallel attesters, each answering the same challenge
  const gap = 10;
  const inset = narrow ? 12 : 0; // room for the challenge line on a phone
  const cw = narrow ? w - inset : (w - 2 * gap) / 3;
  const fanTop = y;
  y += 14;
  const cards = WHO.map((who, i) => card(who, e[who], a, t, L, lang, narrow ? inset : i * (cw + gap), narrow ? 0 : y, cw, narrow));
  if (narrow) {
    for (const c of cards) {
      parts.push(g({ transform: `translate(0 ${y})` }, c.svg));
      y += c.h + 8;
    }
    // The challenge reaches all three cards: one line down their left edge.
    parts.push(el("line", { x1: 5, x2: 5, y1: fanTop - 12, y2: y - 8 - cards[cards.length - 1].h + 18, stroke: C.c1, "stroke-width": 1.5 }));
    let cy = fanTop + 14;
    for (const c of cards) { parts.push(el("line", { x1: 5, x2: inset, y1: cy + 18, y2: cy + 18, stroke: C.c1, "stroke-width": 1.5 })); cy += c.h + 8; }
  } else {
    const ch = Math.max(...cards.map((c) => c.h));
    cards.forEach((c, i) => {
      parts.push(c.svg);
      const mx = i * (cw + gap) + cw / 2;
      parts.push(el("path", { d: `M${w / 2},${fanTop - 12}C${w / 2},${fanTop + 4} ${mx},${fanTop} ${mx},${y}`, fill: "none", stroke: C.c1, "stroke-width": 1.5 }));
    });
    y += ch + 12;
  }

  // ---- CPU measured boot
  if (t >= 1) {
    const log = bootLog(f);
    const reg = registers(log);
    for (const ln of lines(L.bootHead, TYPE.body, w, lang, true)) {
      parts.push(text(0, y + TYPE.body, ln, { "font-size": TYPE.body, class: "fig-t-strong fig-t-num" }));
      y += TYPE.body + 5;
    }
    y += 5;
    const names = log.map((x) => x.name);
    const items: Array<{ name: string; digest: string; reg: string; bad: boolean; missing?: boolean }> = log.map((x, i) => ({ name: L[x.name], digest: x.digest, reg: reg[i], bad: t >= STEP_OF.ref && x.digest !== REF[x.name] }));
    if (!names.includes("model")) items.push({ name: L.noModel, digest: "", reg: "", bad: t >= STEP_OF.policy, missing: true });
    const per = narrow ? 1 : items.length;
    const bw = narrow ? w : (w - (per - 1) * 16) / per;
    const bh = size * 3 + 20;
    items.forEach((it, i) => {
      const bx = narrow ? 0 : i * (bw + 16), by = narrow ? y + i * (bh + 6) : y;
      parts.push(el("rect", { x: bx, y: by, width: bw, height: bh, rx: 5, fill: it.bad ? C.bad : C.paper, "fill-opacity": it.bad ? 0.14 : undefined, stroke: it.bad ? C.bad : C.rule, "stroke-width": 1, "stroke-dasharray": it.missing ? "4 3" : undefined }));
      // A measured component's name fits one line; the unmeasured note may wrap.
      lines(it.name, size, bw - 12, lang).slice(0, it.missing ? 3 : 1).forEach((ln, k) =>
        parts.push(text(bx + 8, by + 6 + size + k * (size + 4), ln, { "font-size": size, class: it.missing ? "fig-t-muted" : "fig-t-strong" })));
      if (!it.missing) {
        parts.push(text(bx + 8, by + 11 + 2 * size, `H = ${it.digest}`, { "font-size": size, class: "fig-t-num fig-t-muted" }));
        parts.push(text(bx + 8, by + 15 + 3 * size, `r = ${it.reg}`, { "font-size": size, class: "fig-t-num" }));
      }
      if (!narrow && i < items.length - 1) parts.push(el("path", { d: `M${bx + bw + 3},${by + bh / 2}h9l-3,-3m3,3l-3,3`, fill: "none", stroke: C.ink3, "stroke-width": 1.2 }));
    });
    y += narrow ? items.length * (bh + 6) + 8 : bh + 16;
  }

  // ---- verifier appraisal matrix
  parts.push(text(0, y + TYPE.label, L.matHead, { "font-size": TYPE.label, class: "fig-t-strong" }));
  y += TYPE.label + 10;
  const colW = narrow ? 46 : 70;
  const labelW = w - 3 * colW;
  const cols = [L.colCpu, L.colGpu, L.colSw];
  cols.forEach((c, i) => parts.push(text(labelW + i * colW + colW / 2, y + size, c, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" })));
  y += size + 8;
  for (const c of CHECKS) {
    const reached = t >= STEP_OF[c];
    const current = t === STEP_OF[c];
    const nm = lines(checkName(c, L), size, labelW - 12, lang);
    const rh = Math.max(24, nm.length * (size + 4) + 8);
    if (current) parts.push(el("rect", { x: 0, y: y - 2, width: w, height: rh, rx: 4, fill: C.ink3, "fill-opacity": 0.12 }));
    nm.forEach((ln, i) => parts.push(text(6, y + 4 + size + i * (size + 4), ln, { "font-size": size, class: reached ? (c === fail ? "fig-t-strong" : "") : "fig-t-faint" })));
    const v = a[c];
    const cy = y + rh / 2 - 1;
    if (SPANNING.has(c)) {
      parts.push(el("line", { x1: labelW + colW / 2, x2: labelW + 2.5 * colW, y1: cy, y2: cy, stroke: reached ? C.rule : C.grid, "stroke-width": 1.5 }));
      parts.push(mark(labelW + 1.5 * colW, cy, reached ? (v as boolean) : null));
    } else {
      WHO.forEach((who, i) => parts.push(mark(labelW + i * colW + colW / 2, cy, reached ? (v as Record<Who, boolean>)[who] : null)));
    }
    parts.push(el("line", { x1: 0, x2: w, y1: y + rh - 1, y2: y + rh - 1, stroke: C.grid, "stroke-width": 1 }));
    y += rh;
  }
  y += 8;

  // ---- release decision
  const decided = t >= LAST;
  const ok = !fail;
  const resH = 34;
  parts.push(el("rect", { x: 0, y, width: w, height: resH, rx: 6, fill: decided ? (ok ? C.good : C.bad) : C.panel, "fill-opacity": decided ? 0.16 : undefined, stroke: decided ? (ok ? C.good : C.bad) : C.rule, "stroke-width": decided ? 1.6 : 1 }));
  const resText = !decided ? L.undecided : ok ? L.released : tpl(L.refused, { c: shortName(fail!, L) });
  lines(resText, TYPE.body, w - 20, lang, true).slice(0, 2).forEach((ln, i) => parts.push(text(10, y + 7 + TYPE.body + i * (TYPE.body + 3), ln, { "font-size": TYPE.body, class: decided ? "fig-t-strong" : "fig-t-muted" })));
  y += resH + 14;

  // ---- this step: what it establishes and what it does not
  const [es, ns] = stepText(t, f, L);
  const put = (s: string, cls: string, sz: number) => {
    for (const ln of lines(s, sz, w, lang, cls.includes("strong"))) { parts.push(text(0, y + sz, ln, { "font-size": sz, class: cls })); y += sz + 5; }
    y += 3;
  };
  put(keyLabel(t, f, L), "fig-t-strong", TYPE.label);
  put(tpl(L.est, { s: es }), "", size);
  put(tpl(L.not, { s: ns }), "fig-t-muted", size);
  put(tpl(L.faultNote, { f: faultName(f, L) }), "fig-t-muted", size);
  return svg(w, y + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "attestation-chain",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    fault: {
      kind: "choice", control: "select", label: { en: "Inject a failure", zh: "注入故障" }, default: "none",
      options: [
        { value: "none", label: { en: "None", zh: "无" } },
        { value: "replay", label: { en: "Quote replay", zh: "证明报文重放" } },
        { value: "relay", label: { en: "Relay from another machine", zh: "来自另一台机器的中继" } },
        { value: "mixed", label: { en: "GPU evidence from another session", zh: "来自另一会话的 GPU 证据" } },
        { value: "measurement", label: { en: "Mismatched measurement", zh: "度量值不匹配" } },
        { value: "unmeasured", label: { en: "Model loaded without measurement", zh: "模型加载时未度量" } },
        { value: "stale", label: { en: "Stale TCB on the GPU", zh: "GPU 的 TCB 过期" } },
        { value: "revoked", label: { en: "Revoked switch firmware", zh: "交换机固件已撤销" } },
        { value: "debug", label: { en: "Debug mode on the CPU VM", zh: "CPU 虚拟机开启调试" } },
        { value: "unsafe", label: { en: "Approved image, unsafe parser", zh: "获准镜像，解析器不安全" } },
      ],
    },
  },
  timeline: {
    rate: 1,
    discrete: true,
    duration: () => LAST,
    keyframes: (p, lang) => {
      const L = labels[lang];
      return Array.from({ length: LAST + 1 }, (_, t) => ({ t, label: keyLabel(t, p.fault as Fault, L) }));
    },
    // Open on the binding check: all three attesters and the verifier's
    // appraisal are on screen, one step before the release decision.
    poster: () => STEP_OF.bind,
  },
  render,
  describe,
});
