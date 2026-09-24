// Where three vision-language connectors enter the language model, how many
// positions they add, and which parts train, for the multimodal chapter:
//
// - Flamingo resamples the visual sequence to 64 latents and reads them
//   through newly trained gated cross-attention layers inserted between frozen
//   language-model blocks; the language model's own sequence stays text.
// - BLIP-2's Q-Former turns the frozen encoder's output into 32 query outputs
//   that join the frozen language model's input.
// - LLaVA-1.5 projects all 576 patch features of a 336-pixel, 14-pixel-patch
//   CLIP encoder into the input with a two-layer MLP; the language model is
//   frozen while the projection aligns and trains during instruction tuning.
//
// Each language model is drawn as a tower whose width is proportional to the
// positions it processes at every layer, on one scale for all three, so the
// input-side connectors widen the tower and Flamingo's does not. The 64-token
// text prompt, the six drawn blocks, and the spacing of Flamingo's
// cross-attention layers are illustrative; the visual counts are the papers'.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrapCJK } from "./lib/notation.ts";
import { textWidth } from "./lib/labels.ts";
import { tpl } from "./lib/format.ts";

const TEXT_TOKENS = 64;
const BLOCKS = 6;
const XATTN_AFTER = [1, 3, 5]; // Flamingo: a gated cross-attention layer after these blocks (illustrative)

type SysKey = "flamingo" | "blip2" | "llava";
interface Sys { visualIn: number; memory: number }
const SYS: Record<SysKey, Sys> = {
  flamingo: { visualIn: 0, memory: 64 },
  blip2: { visualIn: 32, memory: 0 },
  llava: { visualIn: 576, memory: 0 },
};
const MAX_SEQ = TEXT_TOKENS + SYS.llava.visualIn;

type Stage = "align" | "instruct";
type P = { stage: Stage };

// Which parts receive gradient, per the chapter.
function trains(sys: SysKey, part: "encoder" | "connector" | "lm" | "xattn", stage: Stage): boolean {
  if (part === "encoder") return false;
  if (part === "connector" || part === "xattn") return true;
  return sys === "llava" && stage === "instruct";
}

const labels = {
  en: {
    title: "Three connectors between a vision encoder and a language model",
    flamingo: "Flamingo",
    blip2: "BLIP-2",
    llava: "LLaVA-1.5",
    encoder: "vision encoder",
    cFlamingo: "Perceiver Resampler",
    cBlip2: "Q-Former",
    cLlava: "two-layer MLP",
    outF: "64 latents",
    outB: "32 queries",
    outL: "576 patches",
    sFlamingo: "{t} text positions in the LM; 64 visual latents read by {x} inserted cross-attention layers",
    sInput: "{v} visual + {t} text = {n} positions at every LM layer",
    lm: "language model",
    lmState: "{lm}, {s}",
    xattn: "gated cross-attention",
    trained: "trained",
    frozen: "frozen",
    vis: "visual positions",
    txt: "text positions",
    scale: "tower width = positions per layer; text prompt {t} (illustrative)",
    describe: "Flamingo keeps a {t}-position text sequence and reads 64 visual latents through cross-attention inside the language model; BLIP-2 adds 32 visual positions at the input ({b} in all); LLaVA-1.5 adds 576 ({l} in all). In the {stage} stage LLaVA's language model is {lm}.",
    dAlign: "connector alignment",
    dInstruct: "instruction tuning",
  },
  zh: {
    title: "视觉编码器与语言模型之间的三种连接器",
    flamingo: "Flamingo",
    blip2: "BLIP-2",
    llava: "LLaVA-1.5",
    encoder: "视觉编码器",
    cFlamingo: "Perceiver 重采样器",
    cBlip2: "Q-Former",
    cLlava: "两层 MLP",
    outF: "64 个潜变量",
    outB: "32 个查询",
    outL: "576 个图块",
    sFlamingo: "语言模型中只有 {t} 个文本位置；64 个视觉潜变量由插入的 {x} 个交叉注意力层读取",
    sInput: "{v} 个视觉位置 + {t} 个文本位置 = 每层 {n} 个位置",
    lm: "语言模型",
    lmState: "{lm}，{s}",
    xattn: "门控交叉注意力",
    trained: "参与训练",
    frozen: "冻结",
    vis: "视觉位置",
    txt: "文本位置",
    scale: "塔宽 = 每层处理的位置数；文本提示 {t} 个（示意）",
    describe: "Flamingo 的文本序列保持 {t} 个位置，在语言模型内部通过交叉注意力读取 64 个视觉潜变量；BLIP-2 在输入端增加 32 个视觉位置（共 {b} 个）；LLaVA-1.5 增加 576 个（共 {l} 个）。{stage}阶段，LLaVA 的语言模型{lm}。",
    dAlign: "连接器对齐",
    dInstruct: "指令微调",
  },
};

type Lb = typeof labels.en;

function describe(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const instruct = st.p.stage === "instruct";
  return tpl(Lx.describe, {
    t: TEXT_TOKENS, b: TEXT_TOKENS + SYS.blip2.visualIn, l: TEXT_TOKENS + SYS.llava.visualIn,
    stage: instruct ? Lx.dInstruct : Lx.dAlign, lm: instruct ? Lx.trained : Lx.frozen,
  });
}

const H_BLOCK = 9, H_XATTN = 6, H_INPUT = 11, GAP = 3;
const ENC_W = 92, CONN_W = 140; // desktop box widths

function arrow(x0: number, y0: number, x1: number, y1: number): string {
  const a = Math.atan2(y1 - y0, x1 - x0), s = 6;
  const p = (d: number) => `${x1 - s * Math.cos(a + d)},${y1 - s * Math.sin(a + d)}`;
  return el("line", { x1: x0, y1: y0, x2: x1 - 4 * Math.cos(a), y2: y1 - 4 * Math.sin(a), stroke: C.ink2, "stroke-width": 1.3 })
    + el("path", { d: `M${x1},${y1}L${p(0.45)}L${p(-0.45)}Z`, fill: C.ink2 });
}

function part(x: number, y: number, w: number, h: number, trained: boolean, hatchId: string, rx = 2): string {
  return trained
    ? el("rect", { x, y, width: w, height: h, rx, fill: C.c1, "fill-opacity": 0.85 })
    : el("rect", { x, y, width: w, height: h, rx, fill: `url(#${hatchId})` }) + el("rect", { x, y, width: w, height: h, rx, fill: "none", stroke: C.ink3, "stroke-width": 0.8 });
}

// A labeled box (vision encoder or connector) with its label inside.
function box(x: number, y: number, w: number, h: number, label: string, trained: boolean, hatchId: string, size: number): string {
  const lines = wrapCJK(label, size, w - 10);
  // A tint behind the label, so the text stays readable; the hue says trained.
  const body = trained
    ? el("rect", { x, y, width: w, height: h, rx: 4, fill: C.c1, "fill-opacity": 0.2, stroke: C.c1, "stroke-width": 1.5 })
    : part(x, y, w, h, false, hatchId, 4);
  const t = lines.map((ln, i) => text(x + w / 2, y + h / 2 + size * 0.35 + (i - (lines.length - 1) / 2) * (size + 2), ln, { "font-size": size, "text-anchor": "middle", class: trained ? "fig-t-strong" : "fig-t-halo" })).join("");
  return body + t;
}

interface Tower { svg: string; h: number; xattnY: number[]; inputY: number }

// The language model as a stack of strips, input at the bottom, drawn from
// the bottom edge y1 upward; width is positions per layer.
function tower(sys: SysKey, x0: number, y1: number, s: number, stage: Stage, hatchId: string): Tower {
  const seq = TEXT_TOKENS + SYS[sys].visualIn;
  const W = s * seq;
  const parts: string[] = [];
  let y = y1 - H_INPUT;
  const vis = s * SYS[sys].visualIn;
  if (vis > 0) parts.push(el("rect", { x: x0, y, width: vis, height: H_INPUT, rx: 1.5, fill: C.c2 }));
  parts.push(el("rect", { x: x0 + vis + (vis > 0 ? 1 : 0), y, width: W - vis - (vis > 0 ? 1 : 0), height: H_INPUT, rx: 1.5, fill: C.ink3, "fill-opacity": 0.55 }));
  const inputY = y + H_INPUT / 2;
  const xattnY: number[] = [];
  for (let b = 0; b < BLOCKS; b++) {
    y -= GAP + H_BLOCK;
    parts.push(part(x0, y, W, H_BLOCK, trains(sys, "lm", stage), hatchId));
    if (sys === "flamingo" && XATTN_AFTER.includes(b)) {
      y -= GAP + H_XATTN;
      parts.push(part(x0, y, W, H_XATTN, true, hatchId, 1.5));
      xattnY.push(y + H_XATTN / 2);
    }
  }
  return { svg: g({}, ...parts), h: y1 - y, xattnY, inputY };
}

function renderSystem(sys: SysKey, y0: number, w: number, s: number, narrow: boolean, stage: Stage, Lx: Lb, hatchId: string): { svg: string; h: number } {
  const size = TYPE.body;
  const parts: string[] = [];
  const name = { flamingo: Lx.flamingo, blip2: Lx.blip2, llava: Lx.llava }[sys];
  const conn = { flamingo: Lx.cFlamingo, blip2: Lx.cBlip2, llava: Lx.cLlava }[sys];
  const out = { flamingo: Lx.outF, blip2: Lx.outB, llava: Lx.outL }[sys];
  const seq = TEXT_TOKENS + SYS[sys].visualIn;
  const summary = sys === "flamingo"
    ? tpl(Lx.sFlamingo, { t: TEXT_TOKENS, x: XATTN_AFTER.length })
    : tpl(Lx.sInput, { v: SYS[sys].visualIn, t: TEXT_TOKENS, n: seq });
  parts.push(text(0, y0 + size + 1, name, { "font-size": TYPE.label, class: "fig-t-strong" }));
  let y = y0 + size + 3;
  for (const ln of wrapCJK(summary, size, w * 0.92)) {
    y += size + 4;
    parts.push(text(0, y, ln, { "font-size": size, class: "fig-t-muted fig-t-num" }));
  }
  y += 12;
  const lmLabel = tpl(Lx.lmState, { lm: Lx.lm, s: trains(sys, "lm", stage) ? Lx.trained : Lx.frozen });
  const boxH = 36;
  if (!narrow) {
    const encW = ENC_W, connW = CONN_W, gap = 22;
    const x0 = encW + connW + 2 * gap + 12;
    // Tower first, to know its height; boxes sit level with its input strip.
    const probe = tower(sys, x0, 0, s, stage, hatchId);
    const y1 = y + 16 + probe.h;
    const t = tower(sys, x0, y1, s, stage, hatchId);
    parts.push(text(x0, y + 11, lmLabel, { "font-size": size, class: "fig-t-muted" }));
    parts.push(t.svg);
    const by = Math.min(t.inputY - boxH / 2, y1 - boxH);
    parts.push(box(0, by, encW, boxH, Lx.encoder, false, hatchId, size));
    parts.push(arrow(encW + 2, by + boxH / 2, encW + gap - 2, by + boxH / 2));
    const cx = encW + gap;
    parts.push(box(cx, by, connW, boxH, conn, true, hatchId, size));
    parts.push(text(cx + connW / 2, by + boxH + 15, out, { "font-size": size, "text-anchor": "middle", class: "fig-t-num" }));
    if (sys === "flamingo") {
      const bx = x0 - 10;
      const top = Math.min(...t.xattnY), bot = Math.max(...t.xattnY);
      parts.push(el("line", { x1: bx, x2: bx, y1: top, y2: Math.max(bot, by + boxH / 2), stroke: C.ink2, "stroke-width": 1.3 }));
      parts.push(el("line", { x1: cx + connW + 2, x2: bx, y1: by + boxH / 2, y2: by + boxH / 2, stroke: C.ink2, "stroke-width": 1.3 }));
      for (const ay of t.xattnY) parts.push(arrow(bx, ay, x0 - 1, ay));
    } else {
      parts.push(arrow(cx + connW + 2, t.inputY, x0 - 1, t.inputY));
    }
    return { svg: g({ class: "fig-system" }, ...parts), h: Math.max(y1, by + boxH + 18) - y0 };
  }
  // Phone: tower, then the encoder and connector beneath it, feeding up.
  const x0 = 0;
  const probe = tower(sys, x0, 0, s, stage, hatchId);
  const busX = sys === "flamingo" ? s * seq + 14 : 0;
  const y1 = y + 16 + probe.h;
  parts.push(text(0, y + 11, lmLabel, { "font-size": size, class: "fig-t-muted" }));
  const t = tower(sys, x0, y1, s, stage, hatchId);
  parts.push(t.svg);
  const by = y1 + 26;
  const gap = 20;
  const encW = (w - gap) * 0.45, connW = w - gap - encW;
  parts.push(box(0, by, encW, boxH, Lx.encoder, false, hatchId, size));
  parts.push(arrow(encW + 2, by + boxH / 2, encW + gap - 2, by + boxH / 2));
  const cx = encW + gap;
  parts.push(box(cx, by, connW, boxH, conn, true, hatchId, size));
  parts.push(text(cx + connW / 2, by + boxH + 16, out, { "font-size": size, "text-anchor": "middle", class: "fig-t-num" }));
  if (sys === "flamingo") {
    const top = Math.min(...t.xattnY);
    const ex = Math.max(busX, cx + 16);
    parts.push(el("line", { x1: ex, x2: ex, y1: by - 2, y2: top, stroke: C.ink2, "stroke-width": 1.3 }));
    for (const ay of t.xattnY) parts.push(arrow(ex, ay, s * seq + 1, ay));
  } else {
    // Up into the visual part of the input strip, then across to it.
    const vx = Math.min(s * SYS[sys].visualIn, w) / 2;
    const ex = cx + 16;
    parts.push(el("path", { d: `M${ex},${by - 2}V${y1 + 12}H${Math.max(vx, 4)}`, fill: "none", stroke: C.ink2, "stroke-width": 1.3 }));
    parts.push(arrow(Math.max(vx, 4), y1 + 12, Math.max(vx, 4), y1 + 1));
  }
  return { svg: g({ class: "fig-system" }, ...parts), h: by + boxH + 20 - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const Lx = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const hatchId = `${st.uid}-frozen`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 4, 1))];
  // Legend.
  const items: Array<[string, (x: number, y: number) => string]> = [
    [Lx.trained, (x, y) => part(x, y, 12, 11, true, hatchId)],
    [Lx.frozen, (x, y) => part(x, y, 12, 11, false, hatchId)],
    [Lx.vis, (x, y) => el("rect", { x, y, width: 12, height: 11, rx: 1.5, fill: C.c2 })],
    [Lx.txt, (x, y) => el("rect", { x, y, width: 12, height: 11, rx: 1.5, fill: C.ink3, "fill-opacity": 0.55 })],
    [Lx.xattn, (x, y) => part(x, y + 2.5, 12, 6, true, hatchId, 1.5)],
  ];
  let lx = 0, ly = 0;
  for (const [label, sw] of items) {
    const iw = 18 + textWidth(label, size);
    if (lx > 0 && lx + iw > w) { lx = 0; ly += size + 9; }
    parts.push(sw(lx, ly + 1), text(lx + 18, ly + 11, label, { "font-size": size, class: "fig-t-muted" }));
    lx += iw + 16;
  }
  let y = ly + size + 10;
  for (const ln of wrapCJK(tpl(Lx.scale, { t: TEXT_TOKENS }), size, w * 0.92)) {
    y += 2;
    parts.push(text(0, y + size - 2, ln, { "font-size": size, class: "fig-t-faint" }));
    y += size + 3;
  }
  y += 10;
  const s = narrow ? (w - 2) / MAX_SEQ : (w - (ENC_W + CONN_W + 44 + 12)) / MAX_SEQ;
  for (const sys of ["flamingo", "blip2", "llava"] as SysKey[]) {
    const r = renderSystem(sys, y, w, s, narrow, st.p.stage, Lx, hatchId);
    parts.push(r.svg);
    y += r.h + 20;
  }
  return svg(w, y - 10, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "vision-connectors",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    stage: {
      kind: "choice", label: { en: "LLaVA training stage", zh: "LLaVA 训练阶段" }, default: "align",
      options: [
        { value: "align", label: { en: "Connector alignment", zh: "连接器对齐" } },
        { value: "instruct", label: { en: "Instruction tuning", zh: "指令微调" } },
      ],
    },
  },
  render,
  describe,
});
