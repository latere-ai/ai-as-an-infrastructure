// Every copy of one request's data along a confidential serving path, and
// which of them hold plaintext outside the attested boundary. The stages and
// the design decisions are the ones the confidential-inference chapter lists
// under "Follow every plaintext copy"; the deployment is generic.
//
// The workload runs in a CPU confidential VM, the attested boundary. Each
// stage's copy is classified as
//   inside    plaintext inside the boundary
//   cipher    encrypted in transit or on shared pages
//   outside   plaintext outside the boundary: the stronger claim ends here
//   link      plaintext on a physical link the configuration leaves
//             unencrypted, so the claim must name the physical assumption
//   release   a declared projection released on purpose
//   none      no copy
// The GPU settings follow NVIDIA's stated configurations (nvidia2025secureai):
// in confidential mode, CPU-to-GPU PCIe traffic is encrypted through bounce
// buffers on shared host pages, and HBM holds plaintext under the vendor's
// physical threat assumptions; Hopper's multi-GPU mode (eight GPUs, four
// NVSwitches, one VM) leaves NVLink traffic unencrypted; Blackwell protects
// NVLink in supported configurations.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

type Tls = "edge" | "workload";
type Gpu = "plain" | "cc1" | "hopper8" | "blackwell";
type Filter = "service" | "image" | "projection";
type Sched = "tokens" | "metadata";
type Debug = "traces" | "counters";
type Tools = "plain" | "e2e";
type P = { tls: Tls; gpu: Gpu; filter: Filter; sched: Sched; debug: Debug; tools: Tools };

type Status = "inside" | "cipher" | "outside" | "link" | "release" | "none";
type StageKey =
  | "client" | "network" | "edge" | "tokenizer" | "scheduler" | "cpu" | "pcie" | "hbm" | "nvlink"
  | "post" | "filter" | "respEnc" | "tools" | "traces" | "dumps";

interface Stage { key: StageKey; status: Status; inBoundary: boolean; secondary: boolean }

function stages(p: P): Stage[] {
  const gpuCC = p.gpu !== "plain";
  const multi = p.gpu === "hopper8" || p.gpu === "blackwell";
  const s: Stage[] = [
    { key: "client", status: "none", inBoundary: false, secondary: false },
    { key: "network", status: "cipher", inBoundary: false, secondary: false },
    { key: "edge", status: p.tls === "edge" ? "outside" : "cipher", inBoundary: false, secondary: false },
    { key: "tokenizer", status: "inside", inBoundary: true, secondary: false },
    { key: "scheduler", status: p.sched === "tokens" ? "outside" : "none", inBoundary: false, secondary: false },
    { key: "cpu", status: "inside", inBoundary: true, secondary: false },
    { key: "pcie", status: gpuCC ? "cipher" : "outside", inBoundary: false, secondary: false },
    { key: "hbm", status: gpuCC ? "inside" : "outside", inBoundary: gpuCC, secondary: false },
    { key: "nvlink", status: !multi ? "none" : p.gpu === "hopper8" ? "link" : "inside", inBoundary: p.gpu === "blackwell", secondary: false },
    { key: "post", status: "inside", inBoundary: true, secondary: false },
    { key: "filter", status: p.filter === "service" ? "outside" : p.filter === "image" ? "inside" : "release", inBoundary: p.filter === "image", secondary: false },
    { key: "respEnc", status: "inside", inBoundary: true, secondary: false },
    { key: "tools", status: p.tools === "plain" ? "outside" : "cipher", inBoundary: false, secondary: true },
    { key: "traces", status: p.debug === "traces" ? "outside" : "none", inBoundary: false, secondary: true },
    { key: "dumps", status: p.debug === "traces" ? "outside" : "none", inBoundary: false, secondary: true },
  ];
  return s;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Following every plaintext copy of a request",
    pathHead: "Request path",
    secHead: "Secondary copies",
    boundary: "attested boundary, the shaded lane",
    client: "client endpoint",
    network: "network",
    edge: "load balancer or relay",
    tokenizer: "tokenizer, preprocessing",
    scheduler: "scheduler",
    cpu: "CPU buffers",
    pcie: "CPU-to-GPU transfer",
    hbm: "GPU memory: activations, KV cache",
    nvlink: "GPU-to-GPU links",
    post: "post-processing",
    filter: "safety filter",
    respEnc: "response encryption",
    tools: "tool calls",
    traces: "telemetry and traces",
    dumps: "logs and crash dumps",
    sClientNone: "the user's own plaintext, outside any claim",
    sInside: "plaintext inside",
    sCipher: "encrypted",
    sOutside: "plaintext outside",
    sLink: "plaintext on an unencrypted link",
    sRelease: "declared projection only",
    sNone: "no copy",
    nEdgeOut: "TLS terminates here",
    nEdgeIn: "TLS passes through to the workload",
    nSchedTok: "reads tokens",
    nSchedMeta: "length and resource metadata only",
    nPcieCC: "bounce buffers carry encrypted payloads",
    nPciePlain: "GPU not in confidential mode",
    nHbmCC: "plaintext in HBM, under the vendor's physical assumptions",
    nLinkHopper: "Hopper eight-GPU mode: NVLink unencrypted",
    nLinkBlackwell: "protected NVLink, supported configuration",
    nLinkNone: "single GPU",
    nFilterSvc: "separate service",
    nFilterImg: "inside the measured image",
    nFilterProj: "receives an explicitly released projection",
    nToolsPlain: "sent to the tool service in plaintext",
    nToolsE2e: "end-to-end encrypted and authorized",
    nTraces: "prompt-bearing traces",
    nCounters: "bounded counters only",
    nDumps: "dumps and logs carry prompts",
    nDumpsOff: "dumps disabled, logs without content",
    count: "Plaintext copies outside the boundary: {n}",
    ends: "The stronger claim ends at: {s}",
    endsNone: "No plaintext copy outside the boundary in this design",
    linkNote: "Unprotected physical link: {s}",
    describe: "{n} stages hold plaintext outside the attested boundary{list}. {first}",
    firstAt: "The stronger claim ends at the {s}.",
    firstNone: "The request path keeps plaintext inside the boundary.",
  },
  zh: {
    title: "追踪一个请求的每一份明文副本",
    pathHead: "请求路径",
    secHead: "次级副本",
    boundary: "经过证明的边界（阴影一侧）",
    client: "客户端终端",
    network: "网络",
    edge: "负载均衡器或中继",
    tokenizer: "分词器、预处理",
    scheduler: "调度器",
    cpu: "CPU 缓冲区",
    pcie: "CPU 到 GPU 的传输",
    hbm: "GPU 内存：激活值、KV 缓存",
    nvlink: "GPU 之间的链路",
    post: "后处理",
    filter: "安全过滤器",
    respEnc: "响应加密",
    tools: "工具调用",
    traces: "遥测与追踪",
    dumps: "日志与崩溃转储",
    sClientNone: "用户自己的明文，不在任何主张之内",
    sInside: "边界内明文",
    sCipher: "已加密",
    sOutside: "边界外明文",
    sLink: "未加密链路上的明文",
    sRelease: "只有声明的投影",
    sNone: "无副本",
    nEdgeOut: "TLS 在这里终止",
    nEdgeIn: "TLS 直通到工作负载",
    nSchedTok: "读取词元",
    nSchedMeta: "只用长度和资源元数据",
    nPcieCC: "中转缓冲区承载加密载荷",
    nPciePlain: "GPU 未开启机密模式",
    nHbmCC: "HBM 中是明文，依赖厂商的物理假设",
    nLinkHopper: "Hopper 八卡模式：NVLink 不加密",
    nLinkBlackwell: "受保护的 NVLink，受支持配置",
    nLinkNone: "单 GPU",
    nFilterSvc: "独立服务",
    nFilterImg: "在被度量的镜像内",
    nFilterProj: "只接收明确发布的投影",
    nToolsPlain: "以明文发给工具服务",
    nToolsE2e: "端到端加密并经过授权",
    nTraces: "带提示内容的追踪",
    nCounters: "只有有界计数器",
    nDumps: "转储和日志带有提示",
    nDumpsOff: "关闭转储，日志不含内容",
    count: "边界外的明文副本：{n} 份",
    ends: "更强的主张止步于：{s}",
    endsNone: "在这套设计里，边界外没有明文副本",
    linkNote: "未受保护的物理链路：{s}",
    describe: "{n} 个阶段在经过证明的边界外持有明文{list}。{first}",
    firstAt: "更强的主张止步于{s}。",
    firstNone: "请求路径上的明文都留在边界内。",
  },
};
type L = typeof labels.en;

function note(st: Stage, p: P, L: L): string {
  switch (st.key) {
    case "client": return L.sClientNone;
    case "network": return L.sCipher;
    case "edge": return p.tls === "edge" ? L.nEdgeOut : L.nEdgeIn;
    case "scheduler": return p.sched === "tokens" ? L.nSchedTok : L.nSchedMeta;
    case "pcie": return p.gpu === "plain" ? L.nPciePlain : L.nPcieCC;
    case "hbm": return p.gpu === "plain" ? L.nPciePlain : L.nHbmCC;
    case "nvlink": return p.gpu === "hopper8" ? L.nLinkHopper : p.gpu === "blackwell" ? L.nLinkBlackwell : L.nLinkNone;
    case "filter": return p.filter === "service" ? L.nFilterSvc : p.filter === "image" ? L.nFilterImg : L.nFilterProj;
    case "tools": return p.tools === "plain" ? L.nToolsPlain : L.nToolsE2e;
    case "traces": return p.debug === "traces" ? L.nTraces : L.nCounters;
    case "dumps": return p.debug === "traces" ? L.nDumps : L.nDumpsOff;
    default: return statusLabel(st.status, L);
  }
}

function statusLabel(s: Status, L: L): string {
  return s === "inside" ? L.sInside : s === "cipher" ? L.sCipher : s === "outside" ? L.sOutside : s === "link" ? L.sLink : s === "release" ? L.sRelease : L.sNone;
}

function summary(p: P, L: L) {
  const all = stages(p);
  const out = all.filter((s) => s.status === "outside");
  const first = all.find((s) => !s.secondary && s.status === "outside");
  const link = all.find((s) => s.status === "link");
  return { all, out, first, link, names: out.map((s) => L[s.key]) };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const sm = summary(st.p, L);
  const sep = lang === "zh" ? "、" : ", ";
  const list = sm.out.length ? (lang === "zh" ? `：${sm.names.join(sep)}` : `: ${sm.names.join(sep)}`) : "";
  return tpl(L.describe, { n: sm.out.length, list, first: sm.first ? tpl(L.firstAt, { s: L[sm.first.key] }) : L.firstNone });
}

// ---------------------------------------------------------------- drawing

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

const FILL: Record<Status, string> = { inside: C.c1, cipher: C.panel, outside: C.bad, link: C.warn, release: C.panel, none: C.paper };

function chip(st: Stage, p: P, L: L, lang: Lang, uid: string, x: number, y: number, w: number, narrow: boolean, first: boolean): { svg: string; h: number } {
  const size = narrow ? TYPE.body : TYPE.small;
  const nameW = narrow ? w - 16 : Math.min(190, w * 0.42);
  const noteX = narrow ? x + 12 : x + 12 + nameW + 10;
  const noteW = narrow ? w - 16 : w - (noteX - x) - 8;
  const nameLines = lines(L[st.key], TYPE.body, nameW, lang);
  const noteLines = lines(note(st, p, L), size, noteW, lang);
  const h = narrow
    ? 10 + nameLines.length * (TYPE.body + 4) + noteLines.length * (size + 4) + 4
    : 10 + Math.max(nameLines.length * (TYPE.body + 4), noteLines.length * (size + 4));
  const parts: string[] = [];
  const s = st.status;
  const fill = FILL[s];
  const op = s === "inside" ? 0.18 : s === "outside" ? 0.2 : s === "link" ? 0.3 : undefined;
  parts.push(el("rect", { x, y, width: w, height: h, rx: 5, fill, "fill-opacity": op, stroke: s === "outside" ? C.bad : s === "none" ? C.grid : C.rule, "stroke-width": s === "outside" ? 1.6 : 1, "stroke-dasharray": s === "none" ? "3 3" : undefined }));
  if (s === "cipher" || s === "release") parts.push(el("rect", { x, y, width: w, height: h, rx: 5, fill: `url(#${uid}-ct)`, "fill-opacity": 0.6 }));
  let ty = y + 6 + TYPE.body;
  for (const ln of nameLines) { parts.push(text(x + 12, ty, ln, { "font-size": TYPE.body, class: s === "none" ? "fig-t-muted" : "fig-t-strong" })); ty += TYPE.body + 4; }
  let ny = narrow ? ty - 1 : y + 6 + TYPE.body;
  for (const ln of noteLines) { parts.push(text(noteX, ny, ln, { "font-size": size, class: "fig-t-muted" })); ny += size + 4; }
  if (first) {
    const tag = "✕";
    parts.push(text(x + w - 8, y + 6 + TYPE.body, tag, { "font-size": TYPE.body, "text-anchor": "end", class: "fig-t-strong" }));
  }
  return { svg: g({}, ...parts), h };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const sm = summary(p, L);
  const parts: string[] = [el("defs", {}, hatch(`${st.uid}-ct`, C.ink3, 6, 0.8))];
  let y = 0;
  // The path runs down a two-lane rail: the shaded right lane is the attested
  // boundary, the left lane everything outside it. Each stage is a node on its
  // lane, so the path visibly leaves and re-enters the boundary.
  const laneOut = 9, laneIn = 31, railW = 42;
  const cx = railW + 6, cw = w - cx;
  const railParts: string[] = [];
  const nodeParts: string[] = [];
  const drawList = (list: Stage[], headText: string, connect: boolean) => {
    parts.push(text(cx, y + TYPE.label, headText, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += TYPE.label + 10;
    const top = y - 4;
    let prev: { x: number; y: number; s: Status } | null = null;
    for (const s0 of list) {
      const c = chip(s0, p, L, lang, st.uid, cx, y, cw, narrow, s0 === sm.first);
      const nx = s0.inBoundary ? laneIn : laneOut, ny = y + 6 + TYPE.body * 0.65;
      if (connect && prev) {
        // The segment into a stage takes the stage's status color.
        const col = s0.status === "outside" ? C.bad : s0.status === "inside" ? C.c1 : s0.status === "link" ? C.warn : C.ink3;
        railParts.push(el("path", { d: `M${prev.x},${prev.y}C${prev.x},${(prev.y + ny) / 2} ${nx},${(prev.y + ny) / 2} ${nx},${ny}`, fill: "none", stroke: col, "stroke-width": 2, "stroke-dasharray": s0.status === "cipher" || s0.status === "none" || s0.status === "release" ? "3 3" : undefined }));
      }
      const s = s0.status;
      const fill = s === "inside" ? C.c1 : s === "outside" ? C.bad : s === "link" ? C.warn : C.paper;
      nodeParts.push(el("circle", { cx: nx, cy: ny, r: s === "none" ? 3 : 5, fill, stroke: s === "inside" || s === "outside" || s === "link" ? C.paper : C.ink3, "stroke-width": 1.5 }));
      if (s0 === sm.first) nodeParts.push(el("circle", { cx: nx, cy: ny, r: 8.5, fill: "none", stroke: C.bad, "stroke-width": 1.5 }));
      parts.push(c.svg);
      prev = { x: nx, y: ny, s };
      y += c.h + 6;
    }
    parts.push(el("rect", { x: laneIn - 9, y: top, width: 18, height: y - top - 2, rx: 9, fill: C.c1, "fill-opacity": 0.14 }));
  };
  drawList(sm.all.filter((s) => !s.secondary), L.pathHead, true);
  y += 10;
  drawList(sm.all.filter((s) => s.secondary), L.secHead, false);
  parts.push(...railParts, ...nodeParts);
  y += 6;
  const lg = legend([
    { label: L.sInside, swatch: { kind: "rect", fill: C.c1, opacity: 0.35 } },
    { label: L.sCipher, swatch: { kind: "rect", fill: C.panel, pattern: `${st.uid}-ct` } },
    { label: L.sOutside, swatch: { kind: "rect", fill: C.bad, opacity: 0.35, stroke: C.bad } },
    { label: L.sLink, swatch: { kind: "rect", fill: C.warn, opacity: 0.45 } },
    { label: L.boundary, swatch: { kind: "rect", fill: C.c1, opacity: 0.14 } },
  ], 0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 8;
  const put = (s: string, cls: string, sz: number) => {
    for (const ln of lines(s, sz, w, lang, cls.includes("strong"))) { parts.push(text(0, y + sz, ln, { "font-size": sz, class: cls })); y += sz + 5; }
    y += 2;
  };
  const sep = lang === "zh" ? "、" : ", ";
  put(tpl(L.count, { n: sm.out.length }) + (sm.out.length ? (lang === "zh" ? `：${sm.names.join(sep)}` : `: ${sm.names.join(sep)}`) : ""), "fig-t-strong", TYPE.label);
  put(sm.first ? tpl(L.ends, { s: L[sm.first.key] }) : L.endsNone, "", size);
  if (sm.link) put(tpl(L.linkNote, { s: L[sm.link.key] }), "fig-t-muted", size);
  void textWidth;
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "plaintext-path",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    tls: {
      kind: "choice", label: { en: "TLS terminates", zh: "TLS 终止于" }, default: "edge",
      options: [
        { value: "edge", label: { en: "At the load balancer", zh: "负载均衡器" } },
        { value: "workload", label: { en: "Inside the workload", zh: "工作负载内部" } },
      ],
    },
    sched: {
      kind: "choice", label: { en: "Scheduler sees", zh: "调度器看到" }, default: "tokens",
      options: [
        { value: "tokens", label: { en: "Tokens", zh: "词元" } },
        { value: "metadata", label: { en: "Metadata only", zh: "只有元数据" } },
      ],
    },
    gpu: {
      kind: "choice", control: "select", label: { en: "Accelerator", zh: "加速器" }, default: "cc1",
      options: [
        { value: "plain", label: { en: "GPU not in confidential mode", zh: "GPU 未开启机密模式" } },
        { value: "cc1", label: { en: "One GPU in confidential mode", zh: "单 GPU，机密模式" } },
        { value: "hopper8", label: { en: "Hopper HGX, eight GPUs in one VM", zh: "Hopper HGX，八卡同一虚拟机" } },
        { value: "blackwell", label: { en: "Blackwell, protected NVLink", zh: "Blackwell，受保护的 NVLink" } },
      ],
    },
    filter: {
      kind: "choice", control: "select", label: { en: "Safety filter", zh: "安全过滤器" }, default: "service",
      options: [
        { value: "service", label: { en: "Separate service", zh: "独立服务" } },
        { value: "image", label: { en: "Inside the measured image", zh: "并入被度量的镜像" } },
        { value: "projection", label: { en: "Gets a released projection", zh: "只接收发布的投影" } },
      ],
    },
    debug: {
      kind: "choice", label: { en: "Debugging", zh: "调试" }, default: "traces",
      options: [
        { value: "traces", label: { en: "Prompt-bearing traces", zh: "带提示的追踪" } },
        { value: "counters", label: { en: "Bounded counters", zh: "有界计数器" } },
      ],
    },
    tools: {
      kind: "choice", label: { en: "Tool calls", zh: "工具调用" }, default: "plain",
      options: [
        { value: "plain", label: { en: "Plaintext", zh: "明文" } },
        { value: "e2e", label: { en: "End-to-end encrypted", zh: "端到端加密" } },
      ],
    },
  },
  render,
  describe,
});
