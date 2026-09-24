// Which outbound routes a sandboxed run still has, and which surfaces two runs
// share, under the containment design the runtime-safety chapter states:
// independent network controls at the sandbox and at the cluster, default-deny
// egress over transitive paths, and supporting services isolated per run
// (OpenAI's technical report of 26 August 2026, openai2026hfreport).
//
// The model is a reachability check over a fixed topology, not a simulation:
//
//   run → any host directly        open iff the sandbox layer fails AND the
//                                  cluster policy is absent (each layer is an
//                                  independent default deny on the run)
//   run → package mirror → any host open iff the mirror fetches any host a
//                                  request names AND the cluster policy does not
//                                  cover the mirror's own egress
//   run → mirror → approved upstream  always permitted (the approved list)
//
// A surface two runs can both write and read is a channel between them: the
// mirror's cache and the scratch store while they are shared by all runs, and
// any public internet service once a run has an open route to arbitrary hosts.
// The topology and the service names are generic; nothing here describes a
// particular system or how a route was found.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

type Sandbox = "holds" | "fails";
type Cluster = "none" | "workloads" | "transitive";
type Mirror = "any" | "approved";
type Services = "shared" | "perRun";
type P = { sandbox: Sandbox; cluster: Cluster; mirror: Mirror; services: Services };

interface Model {
  direct: { open: boolean; bySandbox: boolean; byCluster: boolean };
  viaMirror: { open: boolean; byMirror: boolean; byCluster: boolean };
  routes: number;
  surfaces: Array<"mirror" | "store" | "internet">;
}

function model(p: P): Model {
  const bySandbox = p.sandbox === "holds";
  const byClusterRun = p.cluster !== "none";
  const byMirror = p.mirror === "approved";
  const byClusterSvc = p.cluster === "transitive";
  const direct = { open: !bySandbox && !byClusterRun, bySandbox, byCluster: byClusterRun };
  const viaMirror = { open: !byMirror && !byClusterSvc, byMirror, byCluster: byClusterSvc };
  const routes = (direct.open ? 1 : 0) + (viaMirror.open ? 1 : 0);
  const surfaces: Model["surfaces"] = [];
  if (p.services === "shared") surfaces.push("mirror", "store");
  if (routes > 0) surfaces.push("internet");
  return { direct, viaMirror, routes, surfaces };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Egress routes and shared surfaces under layered containment",
    anyHost: "any internet host",
    approved: "approved upstreams",
    cluster: "cluster egress policy: {v}",
    clNone: "none",
    clWork: "default deny for runs",
    clTrans: "default deny for runs and the services they reach",
    mirror: "package mirror",
    store: "scratch store",
    shared: "shared by all runs",
    perRun: "one per run, reset",
    runA: "run A",
    runB: "run B",
    runBsub: "a later run",
    sandbox: "sandbox",
    sandboxFails: "sandbox failed",
    lgRoute: "open route to an arbitrary host",
    lgShared: "surface two runs both write and read",
    lgBlocked: "blocked at this layer",
    routesHead: "Routes from a run to arbitrary hosts: {n}",
    directOpen: "directly: open, neither the sandbox nor the cluster policy denies it",
    directBlocked: "directly: blocked by {by}",
    bySandbox: "the sandbox",
    byCluster: "the cluster policy",
    and: " and ",
    mirrorOpen: "through the package mirror: open, the mirror fetches any host and the cluster policy does not cover its egress",
    mirrorByMirror: "through the package mirror: closed, the mirror fetches approved upstreams only",
    mirrorByCluster: "through the package mirror: blocked by the cluster policy on the mirror's own egress",
    mirrorBoth: "through the package mirror: closed twice, by the mirror's upstream list and by the cluster policy",
    surfacesHead: "Surfaces runs A and B can both write and read: {n}",
    sfMirror: "the package mirror's cache",
    sfStore: "the scratch store",
    sfInternet: "any public service reached over an open route",
    sfNone: "none: each run gets its own services, reset after it",
    describe: "Sandbox {s}, cluster policy {c}, package mirror fetching {m}, services {v}: {n} open routes to arbitrary hosts and {k} surfaces shared between runs.",
    dSHolds: "holding", dSFails: "failed",
    dMAny: "any host", dMApproved: "approved upstreams only",
  },
  zh: {
    title: "分层遏制下的出站路径与共享表面",
    anyHost: "任意互联网主机",
    approved: "批准的上游",
    cluster: "集群出站策略：{v}",
    clNone: "未设置",
    clWork: "对运行默认拒绝",
    clTrans: "对运行及其触及的服务都默认拒绝",
    mirror: "软件包镜像",
    store: "临时存储",
    shared: "所有运行共享",
    perRun: "每次运行一个，用后重置",
    runA: "运行 A",
    runB: "运行 B",
    runBsub: "后续运行",
    sandbox: "沙箱",
    sandboxFails: "沙箱失效",
    lgRoute: "通向任意主机的开放路径",
    lgShared: "两次运行都能读写的表面",
    lgBlocked: "在这一层被拦下",
    routesHead: "运行通向任意主机的路径：{n} 条",
    directOpen: "直接出站：开放，沙箱和集群策略都没有拦下",
    directBlocked: "直接出站：被{by}拦下",
    bySandbox: "沙箱",
    byCluster: "集群策略",
    and: "和",
    mirrorOpen: "经软件包镜像：开放，镜像会抓取任意主机，集群策略也不管镜像自己的出站",
    mirrorByMirror: "经软件包镜像：不通，镜像只抓取批准的上游",
    mirrorByCluster: "经软件包镜像：被集群策略在镜像自身的出站上拦下",
    mirrorBoth: "经软件包镜像：两道都不通，镜像的上游列表和集群策略各拦一次",
    surfacesHead: "运行 A 和 B 都能读写的表面：{n} 个",
    sfMirror: "软件包镜像的缓存",
    sfStore: "临时存储",
    sfInternet: "经开放路径触及的任何公共服务",
    sfNone: "没有：每次运行使用自己的服务，用后重置",
    describe: "沙箱{s}，集群策略{c}，软件包镜像抓取{m}，支撑服务{v}：通向任意主机的开放路径 {n} 条，两次运行共享的表面 {k} 个。",
    dSHolds: "有效", dSFails: "失效",
    dMAny: "任意主机", dMApproved: "仅限批准的上游",
  },
};
type L = typeof labels.en;

const clusterLabel = (c: Cluster, L: L) => (c === "none" ? L.clNone : c === "workloads" ? L.clWork : L.clTrans);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const m = model(p);
  return tpl(L.describe, {
    s: p.sandbox === "holds" ? L.dSHolds : L.dSFails, c: clusterLabel(p.cluster, L),
    m: p.mirror === "any" ? L.dMAny : L.dMApproved, v: p.services === "shared" ? L.shared : L.perRun,
    n: m.routes, k: m.surfaces.length,
  });
}

// ---------------------------------------------------------------- drawing

interface Box { x: number; y: number; w: number; h: number }
const cx = (b: Box) => b.x + b.w / 2;

function lines(s: string, size: number, w: number, lang: Lang): string[] {
  return lang === "zh" ? wrapCjk(s, size, w * 0.95) : wrap(s, size, w * 0.95);
}

// A blocked-here mark: a status disc with a cross.
function cross(x: number, y: number): string {
  const r = 7, k = 3.2;
  return g({},
    el("circle", { cx: x, cy: y, r, fill: C.good, stroke: C.paper, "stroke-width": 1.5 }),
    el("line", { x1: x - k, y1: y - k, x2: x + k, y2: y + k, stroke: C.paper, "stroke-width": 1.8, "stroke-linecap": "round" }),
    el("line", { x1: x - k, y1: y + k, x2: x + k, y2: y - k, stroke: C.paper, "stroke-width": 1.8, "stroke-linecap": "round" }));
}

// x where the segment (x1, y1)–(x2, y2) crosses the horizontal line y.
const atY = (x1: number, y1: number, x2: number, y2: number, y: number) => x1 + ((x2 - x1) * (y - y1)) / (y2 - y1);

function boxLabel(b: Box, main: string, sub: string | null, size: number, lang: Lang, strong = true): string {
  const parts: string[] = [];
  const mainLines = lines(main, size, b.w - 8, lang);
  const subLines = sub ? lines(sub, size - 1, b.w - 8, lang) : [];
  const total = mainLines.length * (size + 3) + subLines.length * (size + 2);
  let y = b.y + b.h / 2 - total / 2 + size - 1;
  for (const ln of mainLines) { parts.push(text(cx(b), y, ln, { "font-size": size, "text-anchor": "middle", class: strong ? "fig-t-strong" : undefined })); y += size + 3; }
  for (const ln of subLines) { parts.push(text(cx(b), y, ln, { "font-size": size - 1, "text-anchor": "middle", class: "fig-t-muted" })); y += size + 2; }
  return parts.join("");
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const m = model(p);
  const size = TYPE.body;
  const small = narrow ? TYPE.body : TYPE.small;
  const parts: string[] = [];
  const sharedOn = p.services === "shared";

  // ---- outside the cluster
  const outH = 40;
  const anyHost: Box = { x: 0, y: 0, w: Math.floor(w * 0.46), h: outH };
  const approved: Box = { x: Math.ceil(w * 0.54), y: 0, w: w - Math.ceil(w * 0.54), h: outH };
  const internetShared = m.surfaces.includes("internet");
  parts.push(el("rect", { x: anyHost.x + 0.5, y: 0.5, width: anyHost.w - 1, height: outH - 1, rx: 8, fill: internetShared ? C.warn : C.panel, "fill-opacity": internetShared ? 0.22 : undefined, stroke: m.routes ? C.bad : C.rule, "stroke-width": m.routes ? 1.8 : 1 }));
  parts.push(boxLabel(anyHost, L.anyHost, null, size, lang));
  parts.push(el("rect", { x: approved.x + 0.5, y: 0.5, width: approved.w - 1, height: outH - 1, rx: 8, fill: C.panel, stroke: C.rule, "stroke-width": 1 }));
  parts.push(boxLabel(approved, L.approved, null, size, lang));

  // ---- cluster boundary
  // The policy's name sits above its line, clear of the direct route at the
  // left edge and haloed where the mirror's links cross it (drawn last).
  const clX = 24;
  const clLines = lines(tpl(L.cluster, { v: clusterLabel(p.cluster, L) }), small, w - clX, lang);
  let yy = outH + 14 + small;
  const clText: string[] = [];
  for (const ln of clLines) { clText.push(text(clX, yy, ln, { "font-size": small, class: "fig-t-halo fig-t-soft" })); yy += small + 3; }
  const clusterY = yy + 2;
  parts.push(el("line", { x1: 0, x2: w, y1: clusterY, y2: clusterY, stroke: p.cluster === "none" ? C.rule : C.ink2, "stroke-width": p.cluster === "none" ? 1 : 1.8, "stroke-dasharray": p.cluster === "none" ? "2 4" : "7 4" }));

  // ---- runs and services
  const colW = narrow ? 76 : 150;
  const gap = narrow ? 12 : 56;
  const top = clusterY + 26;
  const svcH = narrow ? 52 : 46;
  const svcGap = narrow ? 26 : 30;
  const runH = svcH * 2 + svcGap + 16;
  const runA: Box = { x: 0, y: top, w: colW, h: runH };
  const runB: Box = { x: w - colW, y: top, w: colW, h: runH };
  const sx = colW + gap, sw = w - 2 * (colW + gap);
  const mirror: Box = { x: sx, y: top + 8, w: sw, h: svcH };
  const store: Box = { x: sx, y: top + 8 + svcH + svcGap, w: sw, h: svcH };

  // Edges first, boxes over them.
  const edge = (x1: number, y1: number, x2: number, y2: number, open: boolean, blocked: boolean) =>
    el("line", { x1, y1, x2, y2, stroke: open ? C.bad : blocked ? C.ink3 : C.ink2, "stroke-width": open ? 2.6 : 1.4, "stroke-dasharray": blocked && !open ? "4 3" : undefined, "stroke-linecap": "round" });
  const marks: string[] = [];

  // Run A directly to any host, up the left side of its box.
  const dx = runA.x + 12;
  parts.push(edge(dx, runA.y + 22, dx, anyHost.h, m.direct.open, !m.direct.open));
  if (m.direct.bySandbox) marks.push(cross(dx, runA.y));
  if (m.direct.byCluster) marks.push(cross(dx, clusterY));

  // Runs to the services they call.
  const mirrorOpen = m.viaMirror.open;
  parts.push(edge(runA.x + runA.w, mirror.y + mirror.h / 2, mirror.x, mirror.y + mirror.h / 2, mirrorOpen, false));
  parts.push(edge(runB.x, mirror.y + mirror.h / 2, mirror.x + mirror.w, mirror.y + mirror.h / 2, false, false));
  parts.push(edge(runA.x + runA.w, store.y + store.h / 2, store.x, store.y + store.h / 2, false, false));
  parts.push(edge(runB.x, store.y + store.h / 2, store.x + store.w, store.y + store.h / 2, false, false));

  // The mirror's own egress: approved upstreams always, any host when it
  // fetches whatever a request names.
  const mTop = mirror.y;
  const mxA = mirror.x + mirror.w * 0.3, mxB = mirror.x + mirror.w * 0.7;
  const hx = Math.min(anyHost.x + anyHost.w - 18, Math.max(anyHost.x + 40, mxA - 30));
  parts.push(edge(mxA, mTop, hx, anyHost.h, mirrorOpen, !mirrorOpen));
  if (m.viaMirror.byMirror) marks.push(cross(mxA, mTop));
  if (m.viaMirror.byCluster) marks.push(cross(atY(mxA, mTop, hx, anyHost.h, clusterY), clusterY));
  const ax = Math.max(approved.x + 18, Math.min(approved.x + approved.w - 18, mxB + 30));
  parts.push(edge(mxB, mTop, ax, approved.h, false, false));

  // Run boxes: the sandbox border, solid when it holds, broken when not.
  for (const [b, name, sub] of [[runA, L.runA, null], [runB, L.runB, L.runBsub]] as const) {
    const holds = p.sandbox === "holds";
    parts.push(el("rect", { x: b.x + 1, y: b.y + 1, width: b.w - 2, height: b.h - 2, rx: 10, fill: C.paper, stroke: holds ? C.ink2 : C.bad, "stroke-width": holds ? 2 : 1.6, "stroke-dasharray": holds ? undefined : "5 5" }));
    // Run A's label keeps clear of the direct route along its left edge.
    const inner: Box = b === runA ? { x: b.x + 22, y: b.y + 8, w: b.w - 28, h: b.h - 34 } : { x: b.x + 5, y: b.y + 8, w: b.w - 10, h: b.h - 34 };
    parts.push(boxLabel(inner, name, sub, size, lang));
    const sl = lines(holds ? L.sandbox : L.sandboxFails, small, b.w - 12, lang);
    let ly = b.y + b.h - 8 - (sl.length - 1) * (small + 2);
    for (const ln of sl) { parts.push(text(cx(b), ly, ln, { "font-size": small, "text-anchor": "middle", class: "fig-t-muted" })); ly += small + 2; }
  }

  // Service boxes: one instance, or one per run shown as two halves.
  for (const [b, name, key] of [[mirror, L.mirror, "mirror"], [store, L.store, "store"]] as const) {
    const on = m.surfaces.includes(key);
    // One instance per run reads as a stack of cards: a second outline behind.
    if (!sharedOn) parts.push(el("rect", { x: b.x + 4.5, y: b.y - 3.5, width: b.w - 1, height: b.h - 1, rx: 6, fill: C.paper, stroke: C.rule, "stroke-width": 1 }));
    parts.push(el("rect", { x: b.x + 0.5, y: b.y + 0.5, width: b.w - 1, height: b.h - 1, rx: 6, fill: on ? C.warn : C.panel, "fill-opacity": on ? 0.22 : undefined, stroke: C.rule, "stroke-width": 1 }));
    parts.push(boxLabel(b, name, sharedOn ? L.shared : L.perRun, size, lang));
  }
  parts.push(...clText, ...marks);

  // ---- legend and readout
  let y = top + runH + 16;
  const lg = legend([
    { label: L.lgRoute, swatch: { kind: "line", stroke: C.bad } },
    { label: L.lgShared, swatch: { kind: "rect", fill: C.warn, opacity: 0.35 } },
    { label: L.lgBlocked, swatch: { kind: "dot", fill: C.good } },
  ], 0, y, w, small);
  parts.push(lg.svg);
  y += lg.height + 10;

  const ro: string[] = [];
  const put = (s: string, cls: string, sz: number, gapAfter = 2) => {
    for (const ln of lines(s, sz, cls.includes("strong") ? w * 0.92 : w, lang)) {
      ro.push(text(0, y, ln, { "font-size": sz, class: cls || undefined }));
      y += sz + 5;
    }
    y += gapAfter;
  };
  y += TYPE.label;
  put(tpl(L.routesHead, { n: m.routes }), "fig-t-strong", TYPE.label, 2);
  const by = [m.direct.bySandbox ? L.bySandbox : "", m.direct.byCluster ? L.byCluster : ""].filter(Boolean).join(L.and);
  put(m.direct.open ? L.directOpen : tpl(L.directBlocked, { by }), "", small);
  const v = m.viaMirror;
  put(v.open ? L.mirrorOpen : v.byMirror && v.byCluster ? L.mirrorBoth : v.byMirror ? L.mirrorByMirror : L.mirrorByCluster, "", small, 10);
  y += TYPE.label - 4;
  put(tpl(L.surfacesHead, { n: m.surfaces.length }), "fig-t-strong", TYPE.label, 2);
  if (!m.surfaces.length) put(L.sfNone, "", small);
  for (const s of m.surfaces) put(s === "mirror" ? L.sfMirror : s === "store" ? L.sfStore : L.sfInternet, "", small, 0);
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "egress-reachability",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    sandbox: {
      kind: "choice", label: { en: "Sandbox network isolation", zh: "沙箱网络隔离" }, default: "holds",
      options: [
        { value: "holds", label: { en: "Holds", zh: "有效" } },
        { value: "fails", label: { en: "Fails", zh: "失效" } },
      ],
    },
    cluster: {
      kind: "choice", control: "select", label: { en: "Cluster default-deny egress covers", zh: "集群默认拒绝出站的范围" }, default: "workloads",
      options: [
        { value: "none", label: { en: "Nothing, no cluster policy", zh: "无，未设集群策略" } },
        { value: "workloads", label: { en: "Runs only", zh: "只管运行" } },
        { value: "transitive", label: { en: "Runs and the services they reach", zh: "运行及其触及的服务" } },
      ],
    },
    mirror: {
      kind: "choice", control: "select", label: { en: "Package mirror fetches", zh: "软件包镜像抓取" }, default: "any",
      options: [
        { value: "any", label: { en: "Any host a request names", zh: "请求指定的任意主机" } },
        { value: "approved", label: { en: "Approved upstreams only", zh: "仅限批准的上游" } },
      ],
    },
    services: {
      kind: "choice", label: { en: "Supporting services", zh: "支撑服务" }, default: "shared",
      options: [
        { value: "shared", label: { en: "Shared by all runs", zh: "所有运行共享" } },
        { value: "perRun", label: { en: "One per run, reset", zh: "每次运行一个，用后重置" } },
      ],
    },
  },
  render,
  describe,
});
