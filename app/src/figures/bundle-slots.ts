// Delivering a new on-device model bundle through two storage slots, from the
// edge chapter's "Deliver model versions safely": the new bundle is
// downloaded beside the active one, verified (size, digest, signature,
// compatibility manifest) and smoke-tested there, activated by one atomic
// pointer change, and the last-known-good bundle is kept until the cohort is
// healthy. Garbage collection never touches the active slot or the rollback
// target.
//
// Four scripted outcomes run on the same device: a healthy rollout, a corrupt
// download caught by the digest, a cohort regression that rolls back by
// flipping the pointer again, and a device whose free space cannot hold a
// second bundle, so the download never starts. Each step is one keyframe and
// the state at step t is replayed from the script, so scrubbing works in both
// directions. Sizes, free space, and cohort metrics are illustrative.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { fixed, pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- script

const BUNDLE = 1.8; // GB per bundle (weights, tokenizer, template, manifest)
const APP = 0.6; // GB the app itself occupies
const FREE = { normal: 3.0, low: 1.2 }; // GB free before the update, on top of APP + one bundle

type Scenario = "healthy" | "corrupt" | "regression" | "lowspace";
const STAGES = ["publish", "space", "download", "verify", "smoke", "activate", "observe", "finish"] as const;
type Stage = typeof STAGES[number];

type SlotStatus = "active" | "retained" | "empty" | "downloading" | "downloaded" | "verified" | "tested" | "rejected" | "collected";
interface Slot { ver: 1 | 2 | 0; status: SlotStatus; progress: number }

// Cohort metrics as fractions of their declared thresholds (1 = at the threshold).
interface Cohort { crash: number; p95: number; mem: number }

type Ev =
  | { k: "publish" }
  | { k: "space"; ok: boolean }
  | { k: "download"; to: number }
  | { k: "verify"; ok: boolean }
  | { k: "smoke" }
  | { k: "activate" }
  | { k: "observe"; cohort: Cohort }
  | { k: "collect" }
  | { k: "rollback" }
  | { k: "discard" }
  | { k: "hold" };

const common: Ev[] = [
  { k: "publish" }, { k: "space", ok: true },
  { k: "download", to: 0.35 }, { k: "download", to: 0.7 }, { k: "download", to: 1 },
];
const passToActive: Ev[] = [{ k: "verify", ok: true }, { k: "smoke" }, { k: "activate" }];

const SCRIPTS: Record<Scenario, Ev[]> = {
  healthy: [
    ...common, ...passToActive,
    { k: "observe", cohort: { crash: 0.42, p95: 0.71, mem: 0.78 } },
    { k: "observe", cohort: { crash: 0.45, p95: 0.73, mem: 0.8 } },
    { k: "collect" },
  ],
  corrupt: [...common, { k: "verify", ok: false }, { k: "discard" }],
  regression: [
    ...common, ...passToActive,
    { k: "observe", cohort: { crash: 0.64, p95: 0.74, mem: 0.8 } },
    { k: "observe", cohort: { crash: 1.38, p95: 0.77, mem: 0.81 } },
    { k: "rollback" },
    { k: "discard" },
  ],
  lowspace: [{ k: "publish" }, { k: "space", ok: false }, { k: "hold" }],
};

interface Snap {
  ev: Ev;
  stage: Stage;
  failed: Stage | null; // a stage that stopped the rollout
  slots: [Slot, Slot];
  pointer: 0 | 1;
  ghost: 0 | 1 | null; // where the pointer pointed before this step
  cohort: Cohort | null;
  free: number; // GB
}

function stageOf(e: Ev, rolledBack: boolean): Stage {
  switch (e.k) {
    case "publish": return "publish";
    case "space": return "space";
    case "download": return "download";
    case "verify": return "verify";
    case "smoke": return "smoke";
    case "activate": return "activate";
    case "observe": return "observe";
    case "collect": case "rollback": return "finish";
    case "discard": return rolledBack ? "finish" : "verify";
    case "hold": return "space";
  }
}

const memo = new Map<string, Snap[]>();
function replay(sc: Scenario): Snap[] {
  const key = sc;
  const hit = memo.get(key);
  if (hit) return hit;
  const free0 = sc === "lowspace" ? FREE.low : FREE.normal;
  let slots: [Slot, Slot] = [{ ver: 1, status: "active", progress: 1 }, { ver: 0, status: "empty", progress: 0 }];
  let pointer: 0 | 1 = 0;
  let cohort: Cohort | null = null;
  let failed: Stage | null = null;
  let rolledBack = false;
  const out: Snap[] = [];
  for (const e of SCRIPTS[sc]) {
    const before = pointer;
    const s: [Slot, Slot] = [{ ...slots[0] }, { ...slots[1] }];
    switch (e.k) {
      case "space": if (!e.ok) failed = "space"; break;
      case "download": s[1] = { ver: 2, status: e.to >= 1 ? "downloaded" : "downloading", progress: e.to }; break;
      case "verify":
        if (e.ok) s[1].status = "verified";
        else { s[1].status = "rejected"; failed = "verify"; }
        break;
      case "smoke": s[1].status = "tested"; break;
      case "activate": pointer = 1; s[1].status = "active"; s[0].status = "retained"; break;
      case "observe": cohort = e.cohort; if (e.cohort.crash > 1 || e.cohort.p95 > 1 || e.cohort.mem > 1) failed = "observe"; break;
      case "collect": s[0] = { ver: 0, status: "collected", progress: 0 }; break;
      case "rollback": pointer = 0; s[0].status = "active"; s[1].status = "rejected"; rolledBack = true; break;
      case "discard": s[1] = { ver: 0, status: "collected", progress: 0 }; break;
      default: break;
    }
    slots = s;
    const used = [0, 1].reduce((a, i) => a + (slots[i].ver ? BUNDLE * slots[i].progress : 0), 0);
    out.push({ ev: e, stage: stageOf(e, rolledBack), failed, slots, pointer, ghost: before !== pointer ? before : null, cohort, free: free0 + BUNDLE - used });
  }
  if (memo.size > 16) memo.clear();
  memo.set(key, out);
  return out;
}

// The step each outcome opens on: the moment that makes its point.
function posterOf(sc: Scenario): number {
  const s = SCRIPTS[sc];
  if (sc === "healthy") return s.findIndex((e) => e.k === "observe");
  if (sc === "regression") return s.findIndex((e) => e.k === "rollback");
  if (sc === "corrupt") return s.findIndex((e) => e.k === "verify");
  return s.findIndex((e) => e.k === "space");
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Two-slot delivery of an on-device model bundle",
    sPublish: "publish", sSpace: "free space", sDownload: "download", sVerify: "verify", sSmoke: "smoke test", sActivate: "activate", sObserve: "observe", sCollect: "collect", sRollback: "roll back",
    slotA: "Slot A", slotB: "Slot B",
    pointer: "active pointer",
    loads: "the app loads {v}",
    stActive: "active", stRetained: "last-known-good", stEmpty: "empty", stDownloading: "downloading {p}", stDownloaded: "downloaded, unverified",
    stVerified: "verified", stTested: "verified, smoke-tested", stRejected: "rejected", stCollected: "free",
    fWeights: "weights", fTokenizer: "tokenizer", fTemplate: "template", fManifest: "manifest",
    disk: "Device storage",
    app: "app", free: "free {f} GB",
    need: "a second bundle needs {b} GB",
    cohort: "Rollout cohort on v2, as a share of each declared threshold",
    cohortNone: "No device runs v2 yet; the cohort starts at activation.",
    cohortOff: "The cohort is back on v1.",
    mCrash: "crash rate", mP95: "p95 latency", mMem: "peak memory",
    threshold: "threshold",
    ePublish: "v2 is published with a signed manifest: size {b} GB, digest, signature, supported runtime and device tiers.",
    eSpaceOk: "Free-space check: {b} GB is needed beside the active bundle and {f} GB is free.",
    eSpaceFail: "Free-space check fails: {b} GB is needed and {f} GB is free, so the download does not start.",
    eDownload: "Downloading v2 into the inactive slot B, {p} done; slot A keeps serving v1.",
    eDownloaded: "v2 is in slot B but not yet trusted; slot A keeps serving v1.",
    eVerifyOk: "Size, digest, signature, and compatibility manifest match.",
    eVerifyFail: "Digest mismatch: the bundle in slot B is rejected, and the pointer never moved.",
    eSmoke: "Smoke test from slot B: a minimal load and the golden outputs pass.",
    eActivate: "Atomic activation: the pointer flips to slot B, so a process sees all of v1 or all of v2.",
    eObserveOk: "The v2 cohort stays inside every threshold; v1 is kept as last-known-good.",
    eObserveFail: "The crash rate of the v2 cohort crosses its threshold.",
    eCollect: "The cohort is healthy: v1 is garbage-collected and slot A is free for the next release.",
    eRollback: "Rollback: the pointer flips back to slot A, where v1 was kept, so nothing is downloaded.",
    eDiscardRollback: "v2 is removed from slot B; the device stays on v1.",
    eDiscardCorrupt: "The rejected bundle is removed; v1 keeps serving and the download is retried later.",
    eHold: "v1 stays active; the device reports low storage and is not eligible for v2.",
    describe: "Step {t} of {n}: {event} Slot A: {a}. Slot B: {b}. The pointer is on slot {ptr}.",
  },
  zh: {
    title: "端侧模型制品包的双槽位交付",
    sPublish: "发布", sSpace: "空间检查", sDownload: "下载", sVerify: "验证", sSmoke: "冒烟测试", sActivate: "激活", sObserve: "观察", sCollect: "回收", sRollback: "回滚",
    slotA: "槽位 A", slotB: "槽位 B",
    pointer: "活动指针",
    loads: "应用加载 {v}",
    stActive: "活动", stRetained: "上一已知正常版本", stEmpty: "空", stDownloading: "下载中 {p}", stDownloaded: "已下载，未验证",
    stVerified: "已验证", stTested: "已验证，冒烟测试通过", stRejected: "已拒绝", stCollected: "空闲",
    fWeights: "权重", fTokenizer: "分词器", fTemplate: "模板", fManifest: "清单",
    disk: "设备存储",
    app: "应用", free: "空闲 {f} GB",
    need: "第二个制品包需要 {b} GB",
    cohort: "运行 v2 的发布群组，按各项声明阈值的占比显示",
    cohortNone: "尚无设备运行 v2，群组从激活时开始。",
    cohortOff: "群组已回到 v1。",
    mCrash: "崩溃率", mP95: "p95 延迟", mMem: "峰值内存",
    threshold: "阈值",
    ePublish: "发布 v2，附带签名清单：大小 {b} GB、摘要、签名、支持的运行时和设备档位。",
    eSpaceOk: "空间检查：在活动制品包旁边需要 {b} GB，当前空闲 {f} GB。",
    eSpaceFail: "空间检查未通过：需要 {b} GB，只有 {f} GB 空闲，因此不开始下载。",
    eDownload: "把 v2 下载到非活动的槽位 B，已完成 {p}；槽位 A 继续提供 v1。",
    eDownloaded: "v2 已在槽位 B，但尚未受信；槽位 A 继续提供 v1。",
    eVerifyOk: "大小、摘要、签名和兼容性清单全部一致。",
    eVerifyFail: "摘要不一致：槽位 B 中的制品包被拒绝，指针从未移动。",
    eSmoke: "在槽位 B 上做冒烟测试：最小加载和黄金输出都通过。",
    eActivate: "原子激活：指针切到槽位 B，进程看到的要么是完整的 v1，要么是完整的 v2。",
    eObserveOk: "v2 群组的各项指标都在阈值以内；v1 作为上一已知正常版本保留。",
    eObserveFail: "v2 群组的崩溃率越过阈值。",
    eCollect: "群组健康：回收 v1，槽位 A 留给下一次发布。",
    eRollback: "回滚：指针切回保留着 v1 的槽位 A，无需任何下载。",
    eDiscardRollback: "从槽位 B 删除 v2，设备继续使用 v1。",
    eDiscardCorrupt: "删除被拒绝的制品包；v1 继续提供服务，稍后重试下载。",
    eHold: "v1 保持活动；设备报告存储空间不足，不具备接收 v2 的资格。",
    describe: "第 {t} 步，共 {n} 步：{event}槽位 A：{a}。槽位 B：{b}。指针指向槽位 {ptr}。",
  },
};
type L = typeof labels.en;

const stageLabel = (L: L, s: Stage, sc: Scenario) => ({ publish: L.sPublish, space: L.sSpace, download: L.sDownload, verify: L.sVerify, smoke: L.sSmoke, activate: L.sActivate, observe: L.sObserve, finish: sc === "regression" ? L.sRollback : L.sCollect })[s];

function slotText(L: L, s: Slot): string {
  switch (s.status) {
    case "active": return L.stActive;
    case "retained": return L.stRetained;
    case "empty": return L.stEmpty;
    case "downloading": return tpl(L.stDownloading, { p: pct(s.progress) });
    case "downloaded": return L.stDownloaded;
    case "verified": return L.stVerified;
    case "tested": return L.stTested;
    case "rejected": return L.stRejected;
    case "collected": return L.stCollected;
  }
}

function eventText(L: L, snaps: Snap[], t: number): string {
  const s = snaps[t];
  const e = s.ev;
  switch (e.k) {
    case "publish": return tpl(L.ePublish, { b: fixed(BUNDLE, 1) });
    case "space": return tpl(e.ok ? L.eSpaceOk : L.eSpaceFail, { b: fixed(BUNDLE, 1), f: fixed(s.free, 1) });
    case "download": return e.to >= 1 ? L.eDownloaded : tpl(L.eDownload, { p: pct(e.to) });
    case "verify": return e.ok ? L.eVerifyOk : L.eVerifyFail;
    case "smoke": return L.eSmoke;
    case "activate": return L.eActivate;
    case "observe": return s.failed === "observe" ? L.eObserveFail : L.eObserveOk;
    case "collect": return L.eCollect;
    case "rollback": return L.eRollback;
    case "discard": return snaps.some((x) => x.ev.k === "rollback") ? L.eDiscardRollback : L.eDiscardCorrupt;
    case "hold": return L.eHold;
  }
}

type P = { outcome: Scenario };

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const snaps = replay(st.p.outcome);
  const t = Math.max(0, Math.min(snaps.length - 1, Math.round(st.t)));
  const s = snaps[t];
  const ver = (x: Slot) => (x.ver ? `v${x.ver}, ` : "") + slotText(L, x);
  return tpl(L.describe, { t: t + 1, n: snaps.length, event: eventText(L, snaps, t) + (lang === "zh" ? "" : " "), a: ver(s.slots[0]), b: ver(s.slots[1]), ptr: s.pointer ? "B" : "A" });
}

// ---------------------------------------------------------------- render

const VER_COLOR = { 1: C.c1, 2: C.c2 } as const;

function renderTrack(sc: Scenario, snaps: Snap[], t: number, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const perRow = narrow ? 4 : 8;
  const gap = 4, pillH = 24;
  const pw = (w - gap * (perRow - 1)) / perRow;
  const cur = snaps[t];
  const curI = STAGES.indexOf(cur.stage);
  const reached = new Set(snaps.slice(0, t + 1).map((s) => s.stage));
  const parts: string[] = [];
  STAGES.forEach((st, i) => {
    const x = (i % perRow) * (pw + gap);
    const y = y0 + Math.floor(i / perRow) * (pillH + gap);
    const isCur = i === curI;
    const failed = cur.failed === st;
    const done = reached.has(st) && !isCur;
    const fill = failed ? C.bad : isCur ? C.panel : done ? C.panel : "none";
    parts.push(el("rect", {
      x, y, width: pw, height: pillH, rx: 12, fill, "fill-opacity": failed ? 0.22 : 1,
      stroke: isCur ? C.ink : C.grid, "stroke-width": isCur ? 1.5 : 1,
    }));
    const mark = failed ? "✕ " : done ? "✓ " : "";
    parts.push(text(x + pw / 2, y + 16, mark + stageLabel(L, st, sc), { "font-size": fs, "text-anchor": "middle", class: isCur || failed ? "fig-t-strong" : done ? "fig-t-muted" : "fig-t-faint" }));
  });
  // The step's own sentence is the transport's keyframe label and the describe() text.
  const rows = Math.ceil(STAGES.length / perRow);
  return { svg: g({ class: "fig-track" }, ...parts), h: rows * (pillH + gap) };
}

const FILES = ["fWeights", "fTokenizer", "fTemplate", "fManifest"] as const;

function renderSlot(i: 0 | 1, s: Snap, x0: number, y0: number, w: number, L: L, uid: string, fs: number, narrowSlot: boolean): { svg: string; h: number } {
  const slot = s.slots[i];
  const parts: string[] = [];
  const tagH = 24;
  const active = s.pointer === i;
  const ghost = s.ghost === i;
  // The pointer tag sits above the slot it points to; at a flip, a dashed tag marks where it was.
  if (active || ghost) {
    const tw = textWidth(L.pointer, fs) + 18;
    const tx = x0 + 12;
    parts.push(el("rect", { x: tx, y: y0, width: tw, height: tagH - 6, rx: 9, fill: active ? C.ink : "none", stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": active ? undefined : "3 2" }));
    parts.push(text(tx + tw / 2, y0 + 13, L.pointer, { "font-size": fs, "text-anchor": "middle", fill: active ? C.paper : undefined, class: active ? "fig-t-strong" : "fig-t-faint" }));
    parts.push(el("line", { x1: tx + 20, x2: tx + 20, y1: y0 + tagH - 6, y2: y0 + tagH + 2, stroke: active ? C.ink : C.ink3, "stroke-width": 1.5, "stroke-dasharray": active ? undefined : "2 2" }));
  }
  const by = y0 + tagH;
  const checks: string[] = [];
  const st = slot.status;
  if (slot.ver === 2 && (st === "verified" || st === "tested" || st === "active")) checks.push("size ✓", "digest ✓", "signature ✓", "manifest ✓");
  if (slot.ver === 2 && st === "rejected" && s.failed === "verify") checks.push("size ✓", "digest ✕");
  if (slot.ver === 2 && (st === "tested" || st === "active")) checks.push(L.sSmoke + " ✓");
  if (slot.ver === 2 && st === "rejected" && s.failed === "observe") checks.push(L.mCrash + " ✕");
  const boxH = checks.length || !narrowSlot ? 92 : 70;
  parts.push(el("rect", { x: x0, y: by, width: w, height: boxH, rx: 6, fill: active ? C.panel : "none", stroke: active ? C.ink : C.grid, "stroke-width": active ? 1.5 : 1 }));
  parts.push(text(x0 + 10, by + 19, i === 0 ? L.slotA : L.slotB, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const hx = x0 + 10 + textWidth(i === 0 ? L.slotA : L.slotB, TYPE.label) + 10;
  if (slot.ver) {
    parts.push(el("rect", { x: hx, y: by + 7, width: 26, height: 16, rx: 3, fill: VER_COLOR[slot.ver], "fill-opacity": 0.9 }));
    parts.push(text(hx + 13, by + 19, `v${slot.ver}`, { "font-size": fs, "text-anchor": "middle", fill: C.paper, class: "fig-t-strong" }));
  }
  parts.push(text(x0 + w - 10, by + 19, slotText(L, slot), { "font-size": fs, "text-anchor": "end", class: slot.status === "rejected" ? "fig-t-strong" : "fig-t-muted" }));
  // The bundle's files, filled as the download proceeds; the set activates only complete.
  const tg = 4, tx0 = x0 + 10, tw = (w - 20 - tg * 3) / 4, ty = by + 32, th = 26;
  FILES.forEach((f, k) => {
    const x = tx0 + k * (tw + tg);
    const fill = slot.ver ? Math.max(0, Math.min(1, slot.progress * 4 - k)) : 0;
    parts.push(el("rect", { x, y: ty, width: tw, height: th, rx: 3, fill: "none", stroke: slot.ver ? C.ink3 : C.grid, "stroke-width": 1, "stroke-dasharray": slot.ver ? undefined : "3 3" }));
    if (fill > 0) parts.push(el("rect", { x, y: ty, width: tw * fill, height: th, rx: 3, fill: slot.status === "rejected" ? `url(#${uid}-bad)` : VER_COLOR[slot.ver as 1 | 2], "fill-opacity": slot.status === "rejected" ? 1 : 0.28 }));
    parts.push(text(x + tw / 2, ty + 17, L[f], { "font-size": fs, "text-anchor": "middle", class: slot.ver ? undefined : "fig-t-faint" }));
  });
  // What has been checked on this slot's bundle.
  if (checks.length) {
    const line = checks.join("  ");
    parts.push(text(x0 + 10, by + boxH - 12, wrap(line, fs, w - 20)[0], { "font-size": fs, class: "fig-t-muted fig-t-num" }));
  }
  return { svg: g({}, ...parts), h: tagH + boxH };
}

function renderSlots(s: Snap, w: number, L: L, uid: string, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  let h: number;
  if (narrow) {
    const a = renderSlot(0, s, 0, y0, w, L, uid, fs, true);
    const b = renderSlot(1, s, 0, y0 + a.h + 8, w, L, uid, fs, true);
    parts.push(a.svg, b.svg);
    h = a.h + 8 + b.h;
  } else {
    const cw = (w - 14) / 2;
    const a = renderSlot(0, s, 0, y0, cw, L, uid, fs, false);
    const b = renderSlot(1, s, cw + 14, y0, cw, L, uid, fs, false);
    parts.push(a.svg, b.svg);
    h = Math.max(a.h, b.h);
  }
  const ver = s.slots[s.pointer].ver;
  parts.push(text(0, y0 + h + 18, tpl(L.loads, { v: `v${ver}` }), { "font-size": TYPE.body, class: "fig-t-strong" }));
  return { svg: g({ class: "fig-slots" }, ...parts), h: h + 24 };
}

function renderDisk(s: Snap, w: number, L: L, uid: string, y0: number, sc: Scenario): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  parts.push(text(0, y0 + 14, L.disk, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const total = APP + BUNDLE + (sc === "lowspace" ? FREE.low : FREE.normal);
  const barY = y0 + 24, barH = 20;
  const x = linear([0, total], [0, w]);
  const segs: Array<[number, string, number, string | null]> = [[APP, C.ink3, 0.35, L.app]];
  for (const i of [0, 1] as const) {
    const sl = s.slots[i];
    if (sl.ver) segs.push([BUNDLE * sl.progress, VER_COLOR[sl.ver], sl.status === "rejected" ? 0.4 : 0.85, `v${sl.ver}`]);
  }
  let at = 0;
  for (const [gbs, col, op, lab] of segs) {
    if (gbs <= 0) continue;
    parts.push(el("rect", { x: x(at), y: barY, width: Math.max(1, x(at + gbs) - x(at) - 1), height: barH, fill: col, "fill-opacity": op }));
    if (lab && x(at + gbs) - x(at) > textWidth(lab, fs) + 8) parts.push(text(x(at) + 5, barY + 14, lab, { "font-size": fs, fill: lab === L.app ? C.ink : C.paper, class: "fig-t-strong" }));
    at += gbs;
  }
  parts.push(el("rect", { x: x(at), y: barY, width: Math.max(0, w - x(at)), height: barH, fill: C.panel }));
  const freeText = tpl(L.free, { f: fixed(s.free, 1) });
  parts.push(text(w - 4, barY + 14, freeText, { "font-size": fs, "text-anchor": "end", class: "fig-t-muted fig-t-num" }));
  let y = barY + barH + 6;
  // At the space check, the room a second bundle needs, starting where the free space begins.
  if (s.stage === "space") {
    const x0 = x(at), x1 = x(at + BUNDLE);
    const over = x1 > w;
    parts.push(el("line", { x1: x0, x2: Math.min(x1, w), y1: y + 4, y2: y + 4, stroke: over ? C.bad : C.good, "stroke-width": 3 }));
    parts.push(el("line", { x1: x0, x2: x0, y1: y, y2: y + 8, stroke: C.ink2, "stroke-width": 1 }));
    if (!over) parts.push(el("line", { x1: x1, x2: x1, y1: y, y2: y + 8, stroke: C.ink2, "stroke-width": 1 }));
    const nt = tpl(L.need, { b: fixed(BUNDLE, 1) }) + (over ? " ✕" : " ✓");
    parts.push(text(Math.min(x0, w - textWidth(nt, fs)), y + 22, nt, { "font-size": fs, class: over ? "fig-t-strong" : "fig-t-muted" }));
    y += 28;
  }
  return { svg: g({ class: "fig-disk" }, ...parts), h: y - y0 };
}

function renderCohort(s: Snap, w: number, L: L, y0: number): { svg: string; h: number } {
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const title = wrap(L.cohort, TYPE.label, w - 4);
  title.forEach((ln, i) => parts.push(text(0, y0 + 14 + i * 17, ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  let y = y0 + 14 + (title.length - 1) * 17 + 10;
  const onV2 = s.slots[s.pointer].ver === 2 || s.ev.k === "rollback";
  if (!s.cohort || !onV2) {
    const msg = s.cohort ? L.cohortOff : L.cohortNone;
    y += 16;
    parts.push(text(0, y, msg, { "font-size": fs, class: "fig-t-muted" }));
    return { svg: g({}, ...parts), h: y - y0 + 6 };
  }
  const nameW = Math.max(textWidth(L.mCrash, fs), textWidth(L.mP95, fs), textWidth(L.mMem, fs)) + 10;
  const valW = textWidth("138%", fs) + 8;
  const x = linear([0, 1.5], [nameW, w - valW]);
  const rows: Array<[string, number]> = [[L.mCrash, s.cohort.crash], [L.mP95, s.cohort.p95], [L.mMem, s.cohort.mem]];
  const top = y;
  rows.forEach(([name, v], i) => {
    const ry = top + i * 22;
    parts.push(text(0, ry + 13, name, { "font-size": fs }));
    parts.push(el("rect", { x: x(0), y: ry + 2, width: x(1.5) - x(0), height: 14, rx: 2, fill: C.panel }));
    parts.push(el("rect", { x: x(0), y: ry + 2, width: x(Math.min(v, 1.5)) - x(0), height: 14, rx: 2, fill: v > 1 ? C.bad : C.good, "fill-opacity": 0.75 }));
    parts.push(text(w, ry + 13, pct(v), { "font-size": fs, "text-anchor": "end", class: v > 1 ? "fig-t-strong fig-t-num" : "fig-t-num" }));
  });
  const tx = x(1);
  parts.push(el("line", { x1: tx, x2: tx, y1: top - 2, y2: top + rows.length * 22, stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
  y = top + rows.length * 22 + 14;
  parts.push(text(tx, y, L.threshold, { "font-size": fs, "text-anchor": "middle", class: "fig-t-muted" }));
  return { svg: g({ class: "fig-cohort" }, ...parts), h: y - y0 + 4 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const sc = st.p.outcome;
  const snaps = replay(sc);
  const t = Math.max(0, Math.min(snaps.length - 1, Math.round(st.t)));
  const s = snaps[t];
  const w = st.w;
  const defs = el("defs", {}, el("pattern", { id: `${st.uid}-bad`, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
    el("rect", { width: 6, height: 6, fill: C.bad, "fill-opacity": 0.12 }), el("line", { x1: 0, x2: 0, y1: 0, y2: 6, stroke: C.bad, "stroke-width": 2 })));
  const track = renderTrack(sc, snaps, t, w, L, 0);
  let y = track.h + 10;
  const slots = renderSlots(s, w, L, st.uid, y);
  y += slots.h + 10;
  const disk = renderDisk(s, w, L, st.uid, y, sc);
  y += disk.h + 12;
  const cohort = renderCohort(s, w, L, y);
  y += cohort.h;
  return svg(w, y, describe(st, lang), defs, track.svg, slots.svg, disk.svg, cohort.svg);
}

export default defineFigure({
  name: "bundle-slots",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    outcome: {
      kind: "choice", label: { en: "Outcome", zh: "结果" }, default: "healthy",
      options: [
        { value: "healthy", label: { en: "Healthy rollout", zh: "正常发布" } },
        { value: "corrupt", label: { en: "Corrupt download", zh: "下载损坏" } },
        { value: "regression", label: { en: "Cohort regression", zh: "群组指标退化" } },
        { value: "lowspace", label: { en: "Low storage", zh: "存储不足" } },
      ],
    },
  },
  timeline: {
    rate: 1,
    discrete: true,
    duration: (p) => replay(p.outcome).length - 1,
    keyframes: (p, lang) => {
      const L = labels[lang];
      const snaps = replay(p.outcome);
      return snaps.map((_, i) => ({ t: i, label: eventText(L, snaps, i) }));
    },
    poster: (p) => posterOf(p.outcome),
  },
  render,
  describe,
});
