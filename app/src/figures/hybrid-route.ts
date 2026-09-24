// A policy-first hybrid route, r(x, d, s, p) ∈ {local, cloud, decline}, from
// the edge chapter: the router settles the route before any model runs.
//
//   local qualifies  artifact installed ∧ memory headroom ∧ thermal state
//                    admits local work ∧ measured local quality meets the task's
//                    threshold ∧ T_local ≤ remaining deadline
//   cloud qualifies  data class allows upload ∧ explicit permission ∧ network
//                    ∧ T_cloud ≤ remaining deadline
//   policy p         local when it qualifies (the narrower data boundary), else
//                    cloud when it qualifies, else decline with a typed reason
//
//   T_local = T_load + T_prefill + Σ_k T_decode,k + T_post     (the chapter's sum)
//   T_cloud = network round trip + provider queue + remote prefill + remote decode
//
// The task classes, token counts, rates, and times are illustrative, not
// measurements of a device or provider: prefill 600 tokens/s and decode 25
// tokens/s locally, halved under thermal throttling; a 1.8 s cold load; a
// 0.3 s round trip, 0.5 s queue, 3,000 tokens/s remote prefill and 60 tokens/s
// remote decode.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear, niceStep } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

const TASKS = {
  reply: { input: 400, output: 60, localOk: true },
  summary: { input: 3000, output: 200, localOk: true },
  analysis: { input: 3000, output: 400, localOk: false },
} as const;
type TaskKey = keyof typeof TASKS;

const LOCAL = { load: 1.8, prefill: 600, decode: 25, post: 0.1, throttle: 0.5 };
const CLOUD = { rtt: 0.3, queue: 0.5, prefill: 3000, decode: 60 };

type P = {
  task: TaskKey;
  data: "local" | "cloud";
  consent: boolean;
  installed: boolean;
  memory: boolean;
  thermal: "normal" | "throttled" | "critical";
  online: boolean;
  warm: boolean;
  deadline: number;
};

type LocalCheck = "installed" | "memory" | "thermal" | "quality" | "deadline";
type CloudCheck = "data" | "consent" | "online" | "deadline";
const LOCAL_CHECKS: LocalCheck[] = ["installed", "memory", "thermal", "quality", "deadline"];
const CLOUD_CHECKS: CloudCheck[] = ["data", "consent", "online", "deadline"];

function model(p: P) {
  const t = TASKS[p.task];
  const slow = p.thermal === "throttled" ? LOCAL.throttle : 1;
  const lt = {
    load: p.warm ? 0 : LOCAL.load,
    prefill: t.input / (LOCAL.prefill * slow),
    decode: t.output / (LOCAL.decode * slow),
    post: LOCAL.post,
  };
  const tLocal = lt.load + lt.prefill + lt.decode + lt.post;
  const ct = { net: CLOUD.rtt + CLOUD.queue, prefill: t.input / CLOUD.prefill, decode: t.output / CLOUD.decode };
  const tCloud = ct.net + ct.prefill + ct.decode;
  const local: Record<LocalCheck, boolean> = {
    installed: p.installed, memory: p.memory, thermal: p.thermal !== "critical", quality: t.localOk, deadline: tLocal <= p.deadline,
  };
  const cloud: Record<CloudCheck, boolean> = {
    data: p.data === "cloud", consent: p.consent, online: p.online, deadline: tCloud <= p.deadline,
  };
  const localFail = LOCAL_CHECKS.find((k) => !local[k]);
  const cloudFail = CLOUD_CHECKS.find((k) => !cloud[k]);
  const route: "local" | "cloud" | "decline" = !localFail ? "local" : !cloudFail ? "cloud" : "decline";
  return { lt, tLocal, ct, tCloud, local, cloud, localFail, cloudFail, route };
}

// What a decline offers the user, from the check that blocked it.
function action(m: ReturnType<typeof model>): "consent" | "download" | "memory" | "cool" | "wait" | "elsewhere" {
  if (m.cloudFail === "consent") return "consent";
  switch (m.localFail) {
    case "installed": return "download";
    case "memory": return "memory";
    case "thermal": return "cool";
    case "deadline": return "wait";
    default: return "elsewhere";
  }
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Hybrid routing decided before execution",
    localHead: "Local route",
    cloudHead: "Cloud route",
    lInstalled: "model artifact installed",
    lMemory: "memory headroom for the model",
    lThermal: "thermal state admits local work",
    lQuality: "local quality meets the task threshold",
    lDeadline: "T_local ≤ deadline",
    cData: "data class allows upload",
    cConsent: "explicit permission to upload",
    cOnline: "network available",
    cDeadline: "T_cloud ≤ deadline",
    chosen: "chosen",
    notChosen: "not chosen",
    blocked: "blocked",
    never: "never uploaded",
    times: "Latency against the remaining deadline",
    x: "seconds",
    sec: "s",
    deadline: "deadline {d} s",
    rowLocal: "local",
    rowCloud: "cloud",
    load: "load", prefill: "prefill", decode: "decode", post: "post-process",
    net: "round trip and queue", rprefill: "remote prefill", rdecode: "remote decode",
    tLocal: "T_local = {a} + {b} + {c} + {d} = {t} s",
    tCloud: "T_cloud = {a} + {b} + {c} = {t} s",
    outLocal: "Route: local. Every local check holds, and policy p prefers the narrower data boundary. Provenance: local.",
    outCloud: "Route: cloud. Local fails on “{why}”, and every cloud check holds. Provenance: cloud.",
    outDecline: "Route: decline. Local fails on “{why}”; cloud fails on “{cwhy}”. Offer: {act}. Provenance: declined.",
    aConsent: "ask the user to allow upload",
    aDownload: "ask the user to download the model",
    aMemory: "wait for memory to free up",
    aCool: "wait for the device to cool",
    aWait: "wait longer or retry later",
    aElsewhere: "perform the task elsewhere",
    describe: "{task}, data {data}: {route}. T_local {tl} s and T_cloud {tc} s against a {d} s deadline.",
    dLocal: "local-only", dCloud: "cloud-eligible",
    rLocal: "routed local", rCloud: "routed to the cloud", rDecline: "declined",
    tReply: "reply suggestion", tSummary: "thread summary", tAnalysis: "long analysis",
  },
  zh: {
    title: "执行前确定的混合路由",
    localHead: "本地路径",
    cloudHead: "云端路径",
    lInstalled: "模型制品已安装",
    lMemory: "内存余量足够加载模型",
    lThermal: "热状态允许本地运行",
    lQuality: "本地实测质量达到任务门槛",
    lDeadline: "T_local ≤ 截止时间",
    cData: "数据类别允许上传",
    cConsent: "用户明确许可上传",
    cOnline: "网络可用",
    cDeadline: "T_cloud ≤ 截止时间",
    chosen: "选中",
    notChosen: "未选",
    blocked: "不可用",
    never: "绝不上传",
    times: "延迟与剩余截止时间",
    x: "秒",
    sec: "秒",
    deadline: "截止 {d} 秒",
    rowLocal: "本地",
    rowCloud: "云端",
    load: "加载", prefill: "预填充", decode: "解码", post: "后处理",
    net: "往返与排队", rprefill: "远程预填充", rdecode: "远程解码",
    tLocal: "T_local = {a} + {b} + {c} + {d} = {t} 秒",
    tCloud: "T_cloud = {a} + {b} + {c} = {t} 秒",
    outLocal: "路由：本地。本地各项检查都成立，策略 p 优先选择数据边界更窄的路径。执行来源：本地。",
    outCloud: "路由：云端。本地在“{why}”上不成立，云端各项检查都成立。执行来源：云端。",
    outDecline: "路由：拒绝。本地在“{why}”上不成立，云端在“{cwhy}”上不成立。建议：{act}。执行来源：已拒绝。",
    aConsent: "请用户允许上传",
    aDownload: "请用户下载模型",
    aMemory: "等待内存释放",
    aCool: "等待设备降温",
    aWait: "放宽等待时间或稍后重试",
    aElsewhere: "换用其他方式完成任务",
    describe: "{task}，数据{data}：{route}。T_local 为 {tl} 秒，T_cloud 为 {tc} 秒，截止时间 {d} 秒。",
    dLocal: "仅限本地", dCloud: "允许上云",
    rLocal: "走本地", rCloud: "走云端", rDecline: "拒绝执行",
    tReply: "回复建议", tSummary: "会话摘要", tAnalysis: "长篇分析",
  },
};
type L = typeof labels.en;

const localLabel = (L: L, k: LocalCheck) => ({ installed: L.lInstalled, memory: L.lMemory, thermal: L.lThermal, quality: L.lQuality, deadline: L.lDeadline })[k];
const cloudLabel = (L: L, k: CloudCheck) => ({ data: L.cData, consent: L.cConsent, online: L.cOnline, deadline: L.cDeadline })[k];
const taskLabel = (L: L, k: TaskKey) => ({ reply: L.tReply, summary: L.tSummary, analysis: L.tAnalysis })[k];
const actLabel = (L: L, a: ReturnType<typeof action>) => ({ consent: L.aConsent, download: L.aDownload, memory: L.aMemory, cool: L.aCool, wait: L.aWait, elsewhere: L.aElsewhere })[a];
const secs = (v: number) => fixed(v, 2);

function outcome(L: L, m: ReturnType<typeof model>): string {
  if (m.route === "local") return L.outLocal;
  const why = localLabel(L, m.localFail!);
  if (m.route === "cloud") return tpl(L.outCloud, { why });
  return tpl(L.outDecline, { why, cwhy: cloudLabel(L, m.cloudFail!), act: actLabel(L, action(m)) });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    task: taskLabel(L, p.task), data: p.data === "local" ? L.dLocal : L.dCloud,
    route: m.route === "local" ? L.rLocal : m.route === "cloud" ? L.rCloud : L.rDecline,
    tl: secs(m.tLocal), tc: secs(m.tCloud), d: fixed(p.deadline, 1),
  }).replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------- render

interface Row { label: string; ok: boolean; value?: string }

function renderColumn(head: string, rows: Row[], state: "chosen" | "not" | "blocked", note: string | null, firstFail: number, x0: number, y0: number, w: number, L: L, fs: number): { svg: string; h: number } {
  const parts: string[] = [];
  const rowH = 22;
  const h = 30 + rows.length * rowH + 6;
  parts.push(el("rect", {
    x: x0, y: y0, width: w, height: h, rx: 6,
    fill: state === "chosen" ? C.panel : "none",
    stroke: state === "chosen" ? C.c1 : C.grid, "stroke-width": state === "chosen" ? 2 : 1,
  }));
  parts.push(text(x0 + 10, y0 + 19, head, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const chip = state === "chosen" ? L.chosen : note ?? (state === "blocked" ? L.blocked : L.notChosen);
  parts.push(text(x0 + w - 10, y0 + 19, chip, { "font-size": fs, "text-anchor": "end", class: state === "chosen" ? "fig-t-strong" : "fig-t-muted" }));
  rows.forEach((r, i) => {
    const y = y0 + 30 + i * rowH;
    const decisive = i === firstFail;
    const dim = note !== null;
    parts.push(el("rect", { x: x0 + 8, y: y + 2, width: 20, height: rowH - 5, rx: 3, fill: r.ok ? C.good : C.bad, "fill-opacity": dim ? 0.1 : r.ok ? 0.18 : 0.24 }));
    parts.push(text(x0 + 18, y + 15, r.ok ? "✓" : "✕", { "font-size": TYPE.body, "text-anchor": "middle", class: r.ok ? "fig-t-muted" : "fig-t-strong" }));
    const cls = decisive ? "fig-t-strong" : dim ? "fig-t-faint" : undefined;
    let label = r.label;
    const room = w - 44 - (r.value ? textWidth(r.value, fs) + 8 : 0);
    if (textWidth(label, fs) > room) label = wrap(label, fs, room)[0] + "…";
    parts.push(text(x0 + 36, y + 15, label, { "font-size": fs, class: cls }));
    if (r.value) parts.push(text(x0 + w - 10, y + 15, r.value, { "font-size": fs, "text-anchor": "end", class: decisive ? "fig-t-strong fig-t-num" : "fig-t-num fig-t-muted" }));
  });
  return { svg: g({}, ...parts), h };
}

function renderChecks(p: P, m: ReturnType<typeof model>, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const cmp = (t: number) => `${secs(t)} ${t <= p.deadline ? "≤" : ">"} ${fixed(p.deadline, 1)} ${L.sec}`;
  const localRows: Row[] = LOCAL_CHECKS.map((k) => ({ label: localLabel(L, k), ok: m.local[k], value: k === "deadline" ? cmp(m.tLocal) : undefined }));
  const cloudRows: Row[] = CLOUD_CHECKS.map((k) => ({ label: cloudLabel(L, k), ok: m.cloud[k], value: k === "deadline" ? cmp(m.tCloud) : undefined }));
  const localState = m.route === "local" ? "chosen" : "blocked";
  const cloudState = m.route === "cloud" ? "chosen" : m.route === "local" && !m.cloudFail ? "not" : "blocked";
  const lf = m.localFail ? LOCAL_CHECKS.indexOf(m.localFail) : -1;
  const cf = m.cloudFail ? CLOUD_CHECKS.indexOf(m.cloudFail) : -1;
  const never = p.data === "local" ? L.never : null;
  if (narrow) {
    const a = renderColumn(L.localHead, localRows, localState, null, lf, 0, y0, w, L, fs);
    const b = renderColumn(L.cloudHead, cloudRows, cloudState, never, cf, 0, y0 + a.h + 10, w, L, fs);
    return { svg: a.svg + b.svg, h: a.h + 10 + b.h };
  }
  const colW = (w - 12) / 2;
  const a = renderColumn(L.localHead, localRows, localState, null, lf, 0, y0, colW, L, fs);
  const b = renderColumn(L.cloudHead, cloudRows, cloudState, never, cf, colW + 12, y0, colW, L, fs);
  return { svg: a.svg + b.svg, h: Math.max(a.h, b.h) };
}

function renderTimes(p: P, m: ReturnType<typeof model>, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  parts.push(text(0, y0 + 14, L.times, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const labelW = Math.max(textWidth(L.rowLocal, fs), textWidth(L.rowCloud, fs)) + 10;
  const top = y0 + 44;
  const barH = 18, gap = 12;
  const span = Math.max(p.deadline, m.tLocal, m.tCloud) * 1.08;
  const step = niceStep(span, narrow ? 4 : 6);
  const x = linear([0, Math.ceil(span / step) * step], [labelW, w - 8]);
  const bottom = top + 2 * barH + gap + 4;
  parts.push(axis({ scale: x, orient: "bottom", at: bottom, grid: [top - 6, bottom], title: L.x, size: fs, ticks: x.ticks(narrow ? 4 : 6), format: (v) => String(v) }));
  const bars: Array<{ label: string; segs: Array<[number, string]>; faint: boolean }> = [
    { label: L.rowLocal, segs: [[m.lt.load, C.c1], [m.lt.prefill, C.c2], [m.lt.decode, C.c3], [m.lt.post, C.c4]], faint: m.route !== "local" },
    { label: L.rowCloud, segs: [[m.ct.net, C.c5], [m.ct.prefill, C.c6], [m.ct.decode, C.c7]], faint: m.route !== "cloud" },
  ];
  bars.forEach((b, i) => {
    const y = top + i * (barH + gap);
    parts.push(text(0, y + 13, b.label, { "font-size": fs, class: b.faint ? "fig-t-muted" : "fig-t-strong" }));
    let t = 0;
    for (const [dt, col] of b.segs) {
      if (dt <= 0) continue;
      parts.push(el("rect", { x: x(t), y, width: Math.max(1, x(t + dt) - x(t) - 1), height: barH, fill: col, "fill-opacity": b.faint ? 0.35 : 0.9 }));
      t += dt;
    }
  });
  // Deadline.
  const dx = x(p.deadline);
  parts.push(el("line", { x1: dx, x2: dx, y1: top - 10, y2: bottom, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "5 3" }));
  const dl = tpl(L.deadline, { d: fixed(p.deadline, 1) });
  const dlw = textWidth(dl, fs);
  const lx = Math.min(Math.max(dx, labelW + dlw / 2), w - dlw / 2 - 2);
  parts.push(text(lx, top - 14, dl, { "font-size": fs, "text-anchor": "middle", class: "fig-t-strong" }));
  let yy = bottom + axisHeight(true, fs) + 2;
  const lg = legend([
    { label: L.load, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.prefill, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.decode, swatch: { kind: "rect", fill: C.c3 } },
    { label: L.post, swatch: { kind: "rect", fill: C.c4 } },
    { label: L.net, swatch: { kind: "rect", fill: C.c5 } },
    { label: L.rprefill, swatch: { kind: "rect", fill: C.c6 } },
    { label: L.rdecode, swatch: { kind: "rect", fill: C.c7 } },
  ], 0, yy, w, fs);
  parts.push(lg.svg);
  yy += lg.height;
  return { svg: g({ class: "fig-times" }, ...parts), h: yy - y0 };
}

function renderReadout(p: P, m: ReturnType<typeof model>, w: number, L: L, y0: number): { svg: string; h: number } {
  const fs = TYPE.body;
  const lines: Array<[string, string | undefined]> = [
    [tpl(L.tLocal, { a: secs(m.lt.load), b: secs(m.lt.prefill), c: secs(m.lt.decode), d: secs(m.lt.post), t: secs(m.tLocal) }), "fig-t-num"],
    [tpl(L.tCloud, { a: secs(m.ct.net), b: secs(m.ct.prefill), c: secs(m.ct.decode), t: secs(m.tCloud) }), "fig-t-num"],
    [outcome(L, m), "fig-t-strong"],
  ];
  const parts: string[] = [];
  let y = y0;
  for (const [s, cls] of lines) {
    for (const piece of wrap(s, fs, w - fs)) {
      y += fs + 5;
      parts.push(text(0, y, piece, { "font-size": fs, class: cls }));
    }
    y += 3;
  }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const m = model(p);
  const checks = renderChecks(p, m, w, L, 0);
  let y = checks.h + 14;
  const times = renderTimes(p, m, w, L, y);
  y += times.h + 4;
  const ro = renderReadout(p, m, w, L, y);
  y += ro.h;
  return svg(w, y, describe(st, lang), checks.svg, times.svg, ro.svg);
}

const yes = (en: string, zh: string) => ({ en, zh });

export default defineFigure({
  name: "hybrid-route",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    task: {
      kind: "choice", label: yes("Task class x", "任务类别 x"), default: "reply",
      options: [
        { value: "reply", label: yes("Reply suggestion", "回复建议") },
        { value: "summary", label: yes("Thread summary", "会话摘要") },
        { value: "analysis", label: yes("Long analysis", "长篇分析") },
      ],
    },
    data: {
      kind: "choice", label: yes("Data class d", "数据类别 d"), default: "cloud",
      options: [
        { value: "local", label: yes("Local-only", "仅限本地") },
        { value: "cloud", label: yes("Cloud-eligible", "允许上云") },
      ],
    },
    consent: { kind: "toggle", label: yes("User permitted upload", "用户已许可上传"), default: true },
    installed: { kind: "toggle", label: yes("Model downloaded", "模型已下载"), default: true },
    warm: { kind: "toggle", label: yes("Model already loaded (warm)", "模型已加载（热启动）"), default: false },
    memory: { kind: "toggle", label: yes("Memory headroom", "内存余量充足"), default: true },
    thermal: {
      kind: "choice", label: yes("Thermal state", "热状态"), default: "normal",
      options: [
        { value: "normal", label: yes("Normal", "正常") },
        { value: "throttled", label: yes("Throttled", "降频") },
        { value: "critical", label: yes("Critical", "严重过热") },
      ],
    },
    online: { kind: "toggle", label: yes("Network available", "网络可用"), default: true },
    deadline: { kind: "range", label: yes("Remaining deadline", "剩余截止时间"), unit: yes("s", "秒"), min: 1, max: 20, step: 0.5, default: 4 },
  },
  render,
  describe,
});
