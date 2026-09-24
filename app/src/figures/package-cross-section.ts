// A schematic cross-section of one accelerator package: compute dies and
// memory stacks on micro-bumps, a silicon interposer, the package substrate,
// and the board, with the three boundaries of the compute-frontier bound
// marked where bytes cross them (memory, scale-up, scale-out). The drawing is
// not to scale and shows one slice, so it asserts no die or stack count.
//
// The memory choice moves the stacks. HBM4 sits on the interposer because a
// stack has 2,048 data signals; SPHBM4 (JEDEC JESD330-4) keeps the HBM4 DRAM
// dies, uses 512 signals with 4:1 serialization, and mounts on the organic
// substrate with a longer channel to the processor. Per-stack bandwidth is
// signals × rate per signal, the chapter's equation, and the readout draws it:
//
//   HBM4    2,048 × 11 Gb/s / 8 = 2.816 TB/s
//   SPHBM4    512 × 44 Gb/s / 8 = 2.816 TB/s
//
// Sources, as cited in the chapter:
// - HBM4 rate and per-stack bandwidth: Micron HBM4 product page
//   (micron.com/products/memory/hbm/hbm4, read 24 September 2026):
//   "2048-pin bus interface", "speeds greater than 11.0 Gbps", "greater than
//   2.8 TB/s of bandwidth per stack", 36 GB per 12-high stack.
// - SPHBM4: JEDEC press release of 13 July 2026 for JESD330-4: 512 data
//   signals, 4:1 serialization, HBM4-class bandwidth on organic substrates.
//   The 44 Gb/s per wire is derived: four HBM4 signals' bits in turn on one
//   wire at the Micron rate.
// - Bandwidth at each boundary: NVIDIA Vera Rubin NVL72 product page
//   (nvidia.com/en-us/data-center/vera-rubin-nvl72, read 24 September 2026),
//   per Rubin GPU: 288 GB HBM4 at 19.2 TB/s, NVLink 3 TB/s; scale-out 0.9 TB/s
//   bi-directional per superchip of two GPUs, so 0.45 TB/s per GPU. These are
//   vendor-stated figures for one HBM4 system, not sustained rates, and no
//   product has published SPHBM4 figures, so the bars do not change with the
//   memory choice.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, esc } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { log } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { si, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- data

const HBM4_RATE = 11e9; // bit/s per signal, Micron HBM4
const SERIAL = 4; // JESD330-4 serialization
const IFACE = {
  hbm4: { signals: 2048, rate: HBM4_RATE },
  sphbm4: { signals: 512, rate: HBM4_RATE * SERIAL },
} as const;
type Memory = keyof typeof IFACE;
const perStack = (m: Memory) => (IFACE[m].signals * IFACE[m].rate) / 8; // byte/s

const RUBIN = { capacity: 288e9, memory: 19.2e12, scaleup: 3e12, scaleout: 0.9e12 / 2 };
type Boundary = "memory" | "scaleup" | "scaleout";
const BOUNDARIES: Boundary[] = ["memory", "scaleup", "scaleout"];
const BADGE: Record<Boundary, string> = { memory: "1", scaleup: "2", scaleout: "3" };
const TERM: Record<Boundary, string> = { memory: "HBM", scaleup: "up", scaleout: "out" };

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Package cross-section and the bandwidth at each boundary",
    schematic: "Cross-section, not to scale",
    stackHbm4: "HBM4 stack",
    stackSp: "SPHBM4 stack",
    dies: "compute dies",
    interposer: "silicon interposer",
    substrate: "package substrate",
    board: "board",
    nvlink: "NVLink",
    nic: "NIC",
    toSwitch: "switch trays",
    toNet: "network",
    wiresHbm4: "2,048 signals",
    wiresSp: "512 signals, 4× rate",
    wiresSpShort: "512 signals",
    ladder: "Bandwidth at each boundary, one Vera Rubin GPU (vendor figures)",
    memory: "memory: dies to HBM4",
    scaleup: "scale-up: NVLink",
    scaleout: "scale-out: network",
    memoryHead: "Memory boundary",
    scaleupHead: "Scale-up boundary",
    scaleoutHead: "Scale-out boundary",
    axisX: "bandwidth",
    both: "{v}, both directions",
    memoryWhat: "Weights, activations, and KV cache that the kernels read and write. The bytes cross micro-bumps and interposer wiring, or with SPHBM4 the substrate.",
    scaleupWhat: "Collectives among the GPUs of one NVLink domain. The bytes leave the package through the substrate and solder balls and run over the board to the switch trays.",
    scaleoutWhat: "Traffic between NVLink domains, such as data-parallel gradient exchange. The bytes leave the board through the NIC.",
    move: "Moving all {c} of the GPU's HBM4 once: Q / B ≥ {c} / {b} = {t}",
    drop: "{r}× less than the memory boundary",
    iface: "One stack: bandwidth = signals × rate per signal",
    ifaceHbm4: "HBM4 on the interposer",
    ifaceSp: "SPHBM4 on the substrate",
    ifaceRow: "{n} × {r} Gb/s = {b}",
    ifaceNote: "Same DRAM dies and capacity; 4:1 serialization sends four signals' bits in turn over one wire.",
    describe: "{mode}: each stack carries {n} signals at {r} Gb/s, {bs} per stack. Boundary {k}, {name}: {b} for one Vera Rubin GPU, so moving its {c} of HBM4 across it takes at least {t}.",
    modeHbm4: "HBM4 stacks on the silicon interposer",
    modeSp: "SPHBM4 stacks on the organic substrate",
  },
  zh: {
    title: "封装剖面与各道边界的带宽",
    schematic: "剖面示意，未按比例",
    stackHbm4: "HBM4 堆栈",
    stackSp: "SPHBM4 堆栈",
    dies: "计算裸片",
    interposer: "硅中介层",
    substrate: "封装基板",
    board: "电路板",
    nvlink: "NVLink",
    nic: "网卡",
    toSwitch: "交换托盘",
    toNet: "网络",
    wiresHbm4: "2,048 路信号",
    wiresSp: "512 路信号，4 倍速率",
    wiresSpShort: "512 路信号",
    ladder: "各道边界的带宽：一块 Vera Rubin GPU（厂商数据）",
    memory: "内存：裸片到 HBM4",
    scaleup: "纵向扩展：NVLink",
    scaleout: "横向扩展：网络",
    memoryHead: "内存边界",
    scaleupHead: "纵向扩展边界",
    scaleoutHead: "横向扩展边界",
    axisX: "带宽",
    both: "{v}，双向合计",
    memoryWhat: "内核读写的权重、激活值与 KV 缓存。字节经过微凸点和中介层布线；换成 SPHBM4 后，经过的是封装基板。",
    scaleupWhat: "同一个 NVLink 域内各 GPU 之间的集合通信。字节经封装基板和焊球离开封装，再沿电路板到达交换托盘。",
    scaleoutWhat: "NVLink 域之间的流量，例如数据并行的梯度交换。字节经网卡离开电路板。",
    move: "把这块 GPU 的 {c} HBM4 全部搬运一次：Q / B ≥ {c} / {b} = {t}",
    drop: "只有内存边界的 1/{r}",
    iface: "单个堆栈：带宽 = 信号数 × 每路信号速率",
    ifaceHbm4: "HBM4，装在中介层上",
    ifaceSp: "SPHBM4，装在封装基板上",
    ifaceRow: "{n} × {r} Gb/s = {b}",
    ifaceNote: "DRAM 裸片与容量不变；4:1 串行化让四路信号的比特轮流经同一根导线发送。",
    describe: "{mode}：每个堆栈 {n} 路信号，每路 {r} Gb/s，单堆栈 {bs}。边界 {k}（{name}）：一块 Vera Rubin GPU 为 {b}，把它的 {c} HBM4 搬过这道边界至少需要 {t}。",
    modeHbm4: "HBM4 堆栈装在硅中介层上",
    modeSp: "SPHBM4 堆栈装在有机封装基板上",
  },
};
type L = typeof labels.en;

type P = { memory: Memory; boundary: Boundary };

const bw = (b: Boundary) => RUBIN[b];
const NB = (s: string) => s.replace(/ /g, "\u00a0"); // keep a number with its unit when wrapping
const fmtB = (v: number) => NB(si(v, "B/s"));
const lines = (s: string, size: number, w: number) => wrapCjk(s, size, w);
const circled = (n: string) => ({ "1": "①", "2": "②", "3": "③" })[n] ?? n;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const f = IFACE[p.memory];
  return tpl(L.describe, {
    mode: p.memory === "hbm4" ? L.modeHbm4 : L.modeSp,
    n: f.signals.toLocaleString("en-US"), r: String(f.rate / 1e9), bs: si(perStack(p.memory), "B/s", 2),
    k: BADGE[p.boundary], name: L[p.boundary], b: fmtB(bw(p.boundary)),
    c: si(RUBIN.capacity, "B"), t: si(RUBIN.capacity / bw(p.boundary), "s", 2),
  });
}

// ---------------------------------------------------------------- drawing

interface Geo {
  u: number; // one hundredth of the substrate width
  x0: number; // substrate left edge
  yMb: number; iTop: number; iBot: number; sTop: number; sBot: number; bTop: number; bBot: number;
  dieTop: number; dieBot: number;
  boardX0: number; conn: [number, number]; nic: [number, number];
}

function badge(x: number, y: number, n: string, on: boolean, target: Boundary): string {
  return g({ "data-fig-set": `boundary=${target}`, class: "fig-hit" },
    el("circle", { cx: x, cy: y, r: 9, fill: on ? C.ink : C.paper, stroke: on ? C.ink : C.ink2, "stroke-width": 1.5 }),
    text(x, y + 4.2, n, { "font-size": TYPE.body, "text-anchor": "middle", fill: on ? C.paper : C.ink, "font-weight": 600, class: "fig-t-num" }));
}

// A row of bumps between two layers.
function bumps(x0: number, x1: number, y: number, r: number, pitch: number): string {
  const n = Math.max(1, Math.floor((x1 - x0) / pitch));
  const off = x0 + (x1 - x0 - (n - 1) * pitch) / 2;
  let out = "";
  for (let i = 0; i < n; i++) out += el("circle", { cx: off + i * pitch, cy: y, r, fill: C.ink3 });
  return out;
}

function stack(x0: number, x1: number, bottom: number, short: boolean): string {
  const base = 12, dram = 4, n = 12;
  const parts: string[] = [];
  parts.push(el("rect", { x: x0, y: bottom - base, width: x1 - x0, height: base, rx: 1.5, fill: C.c2 }));
  for (let i = 0; i < n; i++) {
    const y = bottom - base - (i + 1) * dram;
    parts.push(el("rect", { x: x0 + 1, y: y + 0.4, width: x1 - x0 - 2, height: dram - 0.8, fill: C.c2, "fill-opacity": 0.55 }));
  }
  // Through-silicon vias, the vertical links inside the stack.
  const top = bottom - base - n * dram;
  for (const f of short ? [0.5] : [0.33, 0.67]) {
    const x = x0 + (x1 - x0) * f;
    parts.push(el("line", { x1: x, x2: x, y1: top + 1, y2: bottom - base, stroke: C.paper, "stroke-width": 1 }));
  }
  return parts.join("");
}

function drawSection(p: P, w: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const blocksW = narrow ? 96 : 150;
  const x0 = narrow ? 2 : 4;
  const sw = w - blocksW - x0 - (narrow ? 4 : 14);
  const u = sw / 100;
  const X = (v: number) => x0 + v * u;
  const sp = p.memory === "sphbm4";
  const G: Geo = {
    u, x0, yMb: 104, iTop: 106, iBot: 122, sTop: 128, sBot: 160, bTop: 170, bBot: 196,
    dieTop: 66, dieBot: 102,
    boardX0: 0,
    conn: [0, 0], nic: [0, 0],
  };
  const bRight = w;
  const nicW = narrow ? 40 : 58, connW = narrow ? 46 : 70, bgap = narrow ? 5 : 10;
  G.nic = [bRight - nicW - 2, bRight - 2];
  G.conn = [G.nic[0] - bgap - connW, G.nic[0] - bgap];
  const size = narrow ? TYPE.body : TYPE.small;

  // Geometry in substrate units. HBM4: stacks beside the dies on a wide
  // interposer. SPHBM4: stacks at the substrate edge, the interposer only
  // under the dies.
  const dies: Array<[number, number]> = [[30, 49], [51, 70]];
  const stacks: Array<[number, number]> = sp ? [[4, 16], [84, 96]] : [[16, 28], [72, 84]];
  const inter: [number, number] = sp ? [27, 73] : [13, 87];
  const stackBottom = sp ? G.iBot : G.dieBot;

  // Board, solder balls, substrate, C4 bumps, interposer, micro-bumps.
  parts.push(el("rect", { x: G.boardX0, y: G.bTop, width: bRight - G.boardX0, height: G.bBot - G.bTop, rx: 2, fill: C.c6, "fill-opacity": 0.22, stroke: C.c6, "stroke-opacity": 0.7 }));
  parts.push(bumps(X(2), X(98), (G.sBot + G.bTop) / 2, 4, narrow ? 11 : 13));
  parts.push(el("rect", { x: X(0), y: G.sTop, width: 100 * u, height: G.sBot - G.sTop, rx: 2, fill: C.c4, "fill-opacity": 0.24, stroke: C.c4, "stroke-opacity": 0.8 }));
  parts.push(bumps(X(inter[0] + 1), X(inter[1] - 1), (G.iBot + G.sTop) / 2, 2.4, narrow ? 7 : 9));
  if (sp) for (const [a, b] of stacks) parts.push(bumps(X(a + 0.5), X(b - 0.5), (G.iBot + G.sTop) / 2, 2.4, narrow ? 7 : 9));
  parts.push(el("rect", { x: X(inter[0]), y: G.iTop, width: (inter[1] - inter[0]) * u, height: G.iBot - G.iTop, rx: 1.5, fill: C.c3, "fill-opacity": 0.3, stroke: C.c3 }));
  const mbPitch = narrow ? 3.2 : 4;
  for (const [a, b] of dies) parts.push(bumps(X(a + 0.4), X(b - 0.4), G.yMb, 1.2, mbPitch));
  if (!sp) for (const [a, b] of stacks) parts.push(bumps(X(a + 0.4), X(b - 0.4), G.yMb, 1.2, mbPitch));

  // Die-to-die wiring between the two compute dies, inside the interposer.
  for (let k = 0; k < 3; k++) {
    const y = G.iTop + 3 + k * 2.2;
    parts.push(el("line", { x1: X(44), x2: X(56), y1: y, y2: y, stroke: C.ink3, "stroke-width": 0.8 }));
  }

  // Data paths. Memory: stack base to die, as a bundle; the bundle is dense in
  // the interposer (HBM4) and sparse in the substrate (SPHBM4).
  const on = (b: Boundary) => p.boundary === b;
  const pathStyle = (b: Boundary, width = 1.4) => ({ fill: "none", stroke: on(b) ? C.ink : C.ink2, "stroke-width": on(b) ? width + 1 : width, "stroke-linejoin": "round", "stroke-linecap": "round" });
  const memParts: string[] = [];
  for (const side of [0, 1] as const) {
    const [sa, sb] = stacks[side];
    const [da, db] = dies[side];
    if (!sp) {
      // Eight lines stand for 2,048 signals: stack base down to the
      // interposer, across, and up into the die.
      for (let k = 0; k < 8; k++) {
        const y = G.iTop + 2.5 + k * 1.5;
        const xs = side === 0 ? X(sb - 1 - k * 0.55) : X(sa + 1 + k * 0.55);
        const xd = side === 0 ? X(da + 1 + k * 0.45) : X(db - 1 - k * 0.45);
        memParts.push(el("path", { d: `M${xs},${G.yMb}V${y}H${xd}V${G.yMb}`, fill: "none", stroke: on("memory") ? C.ink : C.ink2, "stroke-width": on("memory") ? 0.9 : 0.6 }));
      }
    } else {
      // Two lines stand for 512 signals: through the stack's bumps into the
      // substrate, across the longer channel, up through C4 and the interposer.
      for (let k = 0; k < 2; k++) {
        const y = G.sTop + 5 + k * 5;
        const xs = side === 0 ? X(sb - 3 - k * 3) : X(sa + 3 + k * 3);
        const xd = side === 0 ? X(da + 3 + k * 3) : X(db - 3 - k * 3);
        memParts.push(el("path", { d: `M${xs},${G.iBot}V${y}H${xd}V${G.dieBot}`, ...pathStyle("memory", 1.3) }));
      }
    }
  }
  parts.push(g({}, ...memParts));

  // Scale-up: right die down through the package into the board, to the
  // NVLink connector. Scale-out: left die down, along the board to the NIC.
  const upX = X(62), outX = X(38);
  const yUp = G.bTop + 8, yOut = G.bTop + 17;
  const cxConn = (G.conn[0] + G.conn[1]) / 2, cxNic = (G.nic[0] + G.nic[1]) / 2;
  const blockTop = G.bTop - 20;
  parts.push(el("path", { d: `M${upX},${G.dieBot}V${yUp}H${cxConn}V${blockTop + 20}`, ...pathStyle("scaleup") }));
  parts.push(el("path", { d: `M${outX},${G.dieBot}V${yOut}H${cxNic}V${blockTop + 20}`, ...pathStyle("scaleout") }));

  // Compute dies and memory stacks on top of the wiring.
  for (const [a, b] of dies) parts.push(el("rect", { x: X(a), y: G.dieTop, width: (b - a) * u, height: G.dieBot - G.dieTop, rx: 2, fill: C.c1, "fill-opacity": 0.8 }));
  for (const [a, b] of stacks) parts.push(stack(X(a), X(b), stackBottom, narrow));

  // Connector and NIC blocks on the board, with their cables out.
  const blocks: Array<[[number, number], string, string, number, Boundary]> = [
    [G.conn, L.nvlink, L.toSwitch, narrow ? 16 : 38, "scaleup"],
    [G.nic, L.nic, L.toNet, narrow ? 62 : 38, "scaleout"],
  ];
  for (const [[a, b], name, dest, cableTop, which] of blocks) {
    const cx = (a + b) / 2;
    parts.push(el("line", { x1: cx, x2: cx, y1: blockTop, y2: cableTop + 4, stroke: on(which) ? C.ink : C.ink2, "stroke-width": on(which) ? 2.4 : 1.4 }));
    parts.push(el("path", { d: `M${cx - 4},${cableTop + 9}L${cx},${cableTop + 3}L${cx + 4},${cableTop + 9}`, fill: "none", stroke: on(which) ? C.ink : C.ink2, "stroke-width": 1.4 }));
    parts.push(text(cx, cableTop - 3, dest, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
    parts.push(el("rect", { x: a, y: blockTop, width: b - a, height: 20, rx: 2, fill: C.panel, stroke: C.rule }));
    parts.push(text(cx, blockTop + 14, name, { "font-size": size, "text-anchor": "middle" }));
  }

  // Labels on the stacks and dies.
  // Each stack carries its signal count above it (and its name on desktop;
  // the phone legend names it). Labels stay left of the switch-tray label.
  const wires = sp ? (narrow ? L.wiresSpShort : L.wiresSp) : L.wiresHbm4;
  const rows: Array<[string, number, string | undefined]> = narrow
    ? [[wires, 6, undefined]]
    : [[sp ? L.stackSp : L.stackHbm4, 20, undefined], [wires, 6, "fig-t-muted"]];
  const limit = Math.min(G.conn[0], (G.conn[0] + G.conn[1]) / 2 - textWidth(L.toSwitch, size) / 2) - 4;
  const stackTop = stackBottom - 12 - 48;
  for (const [a, b] of stacks) {
    const cx = X((a + b) / 2);
    for (const [s, dy, cls] of rows) {
      const tw = textWidth(s, size);
      const x = Math.max(tw / 2 + 1, Math.min(limit - tw / 2, cx));
      parts.push(text(x, stackTop - dy, s, { "font-size": size, "text-anchor": "middle", class: cls }));
    }
  }
  if (!narrow) parts.push(text(X(50), G.dieTop - 6, L.dies, { "font-size": size, "text-anchor": "middle" }));

  // Boundary badges: 1 under the right memory channel, 2 where scale-up
  // crosses the solder balls, 3 at the NIC.
  const memX = sp ? X(78) : X(71);
  const memY = sp ? G.sTop + 7.5 : G.sTop + 12;
  if (!sp) parts.push(el("line", { x1: memX, x2: memX, y1: G.iBot - 3, y2: memY - 9, stroke: on("memory") ? C.ink : C.ink2, "stroke-width": 1.2 }));
  parts.push(badge(memX, memY, "1", on("memory"), "memory"));
  parts.push(badge(upX, (G.sBot + G.bTop) / 2, "2", on("scaleup"), "scaleup"));
  parts.push(badge(G.nic[0] - (narrow ? 0 : 2), G.bTop + 12, "3", on("scaleout"), "scaleout"));

  // Layer names in a legend under the drawing: direct labels would cross the
  // stacks, which move between the two memory choices.
  let h = G.bBot + 6;
  const lg = legend([
    { label: L.dies, swatch: { kind: "rect", fill: C.c1, opacity: 0.8 } },
    { label: sp ? L.stackSp : L.stackHbm4, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.interposer, swatch: { kind: "rect", fill: C.c3, opacity: 0.3, stroke: C.c3 } },
    { label: L.substrate, swatch: { kind: "rect", fill: C.c4, opacity: 0.24, stroke: C.c4 } },
    { label: L.board, swatch: { kind: "rect", fill: C.c6, opacity: 0.22, stroke: C.c6 } },
  ], 0, h + 4, w, size);
  parts.push(lg.svg);
  h += 4 + lg.height;
  parts.push(text(0, h + 12, L.schematic, { "font-size": size, class: "fig-t-muted" }));
  h += 18;
  return { svg: g({ class: "fig-section" }, ...parts), h };
}

// ---------------------------------------------------------------- ladder and readout

function drawLadder(p: P, y0: number, w: number, narrow: boolean, L: L): { svg: string; h: number } {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = y0;
  for (const ln of lines(L.ladder, TYPE.label, w)) {
    parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" }));
    y += 18;
  }
  y += 4;
  const nameW = narrow ? 0 : Math.max(...BOUNDARIES.map((b) => textWidth(`${circled(BADGE[b])} ${L[b]}`, size))) + 12;
  const valW = narrow ? 0 : Math.max(...BOUNDARIES.map((b) => textWidth(valueText(b, L), size))) + 10;
  const x = log([0.1e12, 40e12], [nameW + (narrow ? textWidth("100 GB/s", size) / 2 + 2 : 0), w - valW - 4]);
  const barH = 14;
  for (const b of BOUNDARIES) {
    const on = p.boundary === b;
    const rowTop = y;
    const nameTxt = `${circled(BADGE[b])} ${L[b]}`;
    const val = valueText(b, L);
    let barY: number;
    if (narrow) {
      parts.push(text(0, y + 13, nameTxt, { "font-size": size, class: on ? "fig-t-strong" : undefined }));
      parts.push(text(w, y + 13, val, { "font-size": size, "text-anchor": "end", class: on ? "fig-t-strong fig-t-num" : "fig-t-num" }));
      barY = y + 19;
      y += 19 + barH + 8;
    } else {
      parts.push(text(0, y + 11, nameTxt, { "font-size": size, class: on ? "fig-t-strong" : undefined }));
      barY = y;
      y += barH + 9;
    }
    const x1 = x(bw(b));
    parts.push(el("rect", { x: x(0.1e12), y: barY, width: x(40e12) - x(0.1e12), height: barH, rx: 3, fill: C.panel }));
    parts.push(el("rect", { x: x(0.1e12), y: barY, width: Math.max(2, x1 - x(0.1e12)), height: barH, rx: 3, fill: C.c1, "fill-opacity": on ? 1 : 0.4 }));
    if (!narrow) parts.push(text(x1 + 6, barY + 11, val, { "font-size": size, class: on ? "fig-t-strong fig-t-num" : "fig-t-num" }));
    parts.push(el("rect", { x: 0, y: rowTop - 3, width: w, height: y - rowTop, fill: "transparent", "data-fig-set": `boundary=${b}`, class: "fig-hit" }));
  }
  const ticks = [0.1e12, 1e12, 10e12];
  parts.push(axis({ scale: x, orient: "bottom", at: y, ticks, minor: true, title: L.axisX, format: (v) => si(v, "B/s", 2), size }));
  y += axisHeight(true, size);
  return { svg: g({ class: "fig-ladder" }, ...parts), h: y - y0 };
}

function valueText(b: Boundary, L: L): string {
  return b === "memory" ? fmtB(bw(b)) : tpl(L.both, { v: fmtB(bw(b)) });
}

function drawReadout(p: P, y0: number, w: number, narrow: boolean, L: L, lang: Lang): { svg: string; h: number } {
  const parts: string[] = [];
  const size = narrow ? TYPE.body : TYPE.small;
  let y = y0;
  const b = p.boundary;
  // Heading: the boundary and its term of the bound, B with a subscript.
  const sep = lang === "zh" ? "：" : ": ";
  parts.push(el("text", { x: 0, y: y + 13, "font-size": TYPE.label, class: "fig-t-strong" },
    esc(`${circled(BADGE[b])} ${L[`${b}Head` as const]}${sep}B`),
    el("tspan", { "baseline-shift": "sub", "font-size": TYPE.small }, TERM[b]),
    esc(` = ${fmtB(bw(b))}`)));
  y += 20;
  const what = L[`${b}What` as const];
  for (const ln of lines(what, size, w)) { parts.push(text(0, y + 12, ln, { "font-size": size })); y += size + 5; }
  y += 3;
  const move = tpl(L.move, { c: NB(si(RUBIN.capacity, "B")), b: fmtB(bw(b)), t: NB(si(RUBIN.capacity / bw(b), "s", 2)) });
  for (const ln of lines(move, size, w)) { parts.push(text(0, y + 12, ln, { "font-size": size, class: "fig-t-num" })); y += size + 5; }
  if (b !== "memory") {
    const r = RUBIN.memory / bw(b);
    parts.push(text(0, y + 12, tpl(L.drop, { r: r >= 10 ? Math.round(r) : r.toFixed(1) }), { "font-size": size, class: "fig-t-muted fig-t-num" }));
    y += size + 5;
  }
  y += 12;
  // The per-stack interface, the chapter's equation with its terms.
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid }));
  y += 6;
  for (const ln of lines(L.iface, TYPE.label, w)) { parts.push(text(0, y + 13, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); y += 18; }
  y += 2;
  for (const m of ["hbm4", "sphbm4"] as const) {
    const onM = p.memory === m;
    const f = IFACE[m];
    const eq = tpl(L.ifaceRow, { n: f.signals.toLocaleString("en-US"), r: String(f.rate / 1e9), b: si(perStack(m), "B/s", 2) });
    const name = m === "hbm4" ? L.ifaceHbm4 : L.ifaceSp;
    const cls = onM ? "fig-t-strong" : "fig-t-muted";
    if (narrow) {
      parts.push(text(0, y + 12, name, { "font-size": size, class: cls }));
      parts.push(text(0, y + 12 + size + 5, eq, { "font-size": size, class: `${cls} fig-t-num` }));
      y += 2 * (size + 5) + 4;
    } else {
      parts.push(text(0, y + 12, name, { "font-size": size, class: cls }));
      parts.push(text(w, y + 12, eq, { "font-size": size, "text-anchor": "end", class: `${cls} fig-t-num` }));
      y += size + 7;
    }
  }
  y += 2;
  for (const ln of lines(L.ifaceNote, size, w)) { parts.push(text(0, y + 12, ln, { "font-size": size, class: "fig-t-muted" })); y += size + 5; }
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const sec = drawSection(p, w, narrow, L);
  let y = sec.h + 16;
  const parts = [sec.svg];
  if (narrow) {
    const lad = drawLadder(p, y, w, narrow, L);
    parts.push(lad.svg); y += lad.h + 14;
    const ro = drawReadout(p, y, w, narrow, L, lang);
    parts.push(ro.svg); y += ro.h;
  } else {
    const lad = drawLadder(p, y, w, narrow, L);
    parts.push(lad.svg); y += lad.h + 16;
    const ro = drawReadout(p, y, w, narrow, L, lang);
    parts.push(ro.svg); y += ro.h;
  }
  return svg(w, y + 4, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "package-cross-section",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    memory: {
      kind: "choice", label: { en: "Memory stacks", zh: "内存堆栈" }, default: "hbm4",
      options: [
        { value: "hbm4", label: { en: "HBM4 on the interposer", zh: "HBM4，装在中介层上" } },
        { value: "sphbm4", label: { en: "SPHBM4 on the substrate", zh: "SPHBM4，装在基板上" } },
      ],
    },
    boundary: {
      kind: "choice", label: { en: "Boundary", zh: "边界" }, default: "memory",
      options: [
        { value: "memory", label: { en: "① memory", zh: "① 内存" } },
        { value: "scaleup", label: { en: "② scale-up", zh: "② 纵向扩展" } },
        { value: "scaleout", label: { en: "③ scale-out", zh: "③ 横向扩展" } },
      ],
    },
  },
  render,
  describe,
});
