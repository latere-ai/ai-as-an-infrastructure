// Preference losses against the margin they see. Every objective in the DPO
// chapter scores one example by a single number u, the margin inside the
// loss, and the gradient reaches the policy as −dℓ/du times the gradient of
// u. Plotting ℓ(u) and −dℓ/du puts DPO and its variants on one axis:
//
//   DPO    u = βA                        ℓ = −log σ(u)          −dℓ/du = σ(−u)
//   IPO    u = βh                        β²ℓ = (u − ½)²         −d(β²ℓ)/du = 1 − 2u
//   KTO    u = β(r_θ − z₀), desirable    ℓ = λ_D(1 − σ(u))      λ_D σ(u)σ(−u)
//   ORPO   u = log(odds_w / odds_l)      ℓ_OR = −log σ(u)       σ(−u)
//   SimPO  u = r_SimPO(y_w) − r_SimPO(y_l)  ℓ = −log σ(u − γ)   σ(γ − u)
//
// A is the chapter's policy/reference log-ratio gap and h = A is IPO's name
// for it. For DPO, −dℓ/du is exactly the weight σ(−βA) in the chapter's
// gradient equation. IPO's loss (h − 1/(2β))² becomes (u − ½)²/β² in u; it
// is drawn multiplied by β², which leaves its minimizer and the direction of
// every gradient unchanged and only rescales the step. For an undesirable KTO
// example u = β(z₀ − r_θ) and λ_U replaces λ_D, which gives the same curve.
// ORPO's full objective adds L_SFT(x, y_w), a function of the chosen
// response's likelihood alone, so it has no place on this axis; only L_OR is
// drawn.
//
// The three example pairs are illustrative. For DPO, IPO and KTO they are
// fixed log-ratio gaps A = −4, 3, 12 nats, so β moves them along u. SimPO's
// score contains its own β and ORPO has none, so their pairs are fixed score
// gaps u = −0.8, 0.6, 2.4 (where the DPO pairs sit at β = 0.2). γ = 1 and
// λ_D = 1 are illustrative settings.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, esc, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { sigmoid } from "./lib/stats.ts";
import { fixed, pct, sig, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Variant = "dpo" | "ipo" | "kto" | "orpo" | "simpo";
const VARIANTS: Variant[] = ["dpo", "ipo", "kto", "orpo", "simpo"];
const COLOR: Record<Variant, string> = { dpo: C.c1, ipo: C.c2, kto: C.c3, orpo: C.c4, simpo: C.c5 };
const NAME: Record<Variant, string> = { dpo: "DPO", ipo: "IPO", kto: "KTO", orpo: "ORPO", simpo: "SimPO" };

const GAMMA = 1; // SimPO target margin (illustrative)
const LAMBDA_D = 1; // KTO desirable-class weight (illustrative)
const RAW = [-4, 3, 12]; // nats: log-ratio gap A (DPO, IPO) or r_θ − z₀ (KTO)
const BETA_REF = 0.2; // the chapter's runnable example
const U_FIXED = RAW.map((a) => a * BETA_REF); // SimPO and ORPO pairs: −0.8, 0.6, 2.4
const U_DOMAIN: [number, number] = [-4, 8];
const LOSS_MAX = 4.2;
const W_DOMAIN: [number, number] = [-1, 1.1];

// −log σ(v) without overflow.
const softplusNeg = (v: number) => Math.max(-v, 0) + Math.log1p(Math.exp(-Math.abs(v)));

function loss(v: Variant, u: number): number {
  switch (v) {
    case "dpo": case "orpo": return softplusNeg(u);
    case "ipo": return (u - 0.5) ** 2;
    case "kto": return LAMBDA_D * (1 - sigmoid(u));
    case "simpo": return softplusNeg(u - GAMMA);
  }
}

// −dℓ/du: how strongly one example's gradient raises its margin.
function weight(v: Variant, u: number): number {
  switch (v) {
    case "dpo": case "orpo": return sigmoid(-u);
    case "ipo": return 1 - 2 * u;
    case "kto": return LAMBDA_D * sigmoid(u) * sigmoid(-u);
    case "simpo": return sigmoid(GAMMA - u);
  }
}

const usesBeta = (v: Variant) => v === "dpo" || v === "ipo" || v === "kto";
function pairU(v: Variant, beta: number): number[] {
  return usesBeta(v) ? RAW.map((a) => beta * a) : U_FIXED;
}

function pairs(v: Variant, beta: number) {
  const us = pairU(v, beta);
  const ws = us.map((u) => weight(v, u));
  const total = ws.reduce((a, b) => a + Math.abs(b), 0) || 1;
  return us.map((u, i) => ({ i, raw: RAW[i], u, loss: loss(v, u), w: ws[i], share: Math.abs(ws[i]) / total }));
}

// ---------------------------------------------------------------- math text

// A formula as SVG text: "_x" or "_{...}" is a subscript, set as a tspan
// shifted off the baseline and never smaller than the 12 px floor.
interface MRun { s: string; sub: boolean }
function parseMath(src: string): MRun[] {
  const out: MRun[] = [];
  const ch = [...src];
  let buf = "";
  const flush = () => { if (buf) { out.push({ s: buf, sub: false }); buf = ""; } };
  for (let i = 0; i < ch.length;) {
    if (ch[i] === "_" && i + 1 < ch.length) {
      flush();
      if (ch[i + 1] === "{") {
        const j = ch.indexOf("}", i + 2);
        out.push({ s: ch.slice(i + 2, j).join(""), sub: true });
        i = j + 1;
      } else { out.push({ s: ch[i + 1], sub: true }); i += 2; }
    } else { buf += ch[i]; i++; }
  }
  flush();
  return out;
}
const subSize = (size: number) => Math.max(TYPE.body, Math.round(size * 0.8));
function mathWidth(src: string, size: number): number {
  return parseMath(src).reduce((a, r) => a + textWidth(r.s, r.sub ? subSize(size) : size), 0);
}
function mtext(x: number, y: number, src: string, size: number, attrs: Record<string, string | number | undefined> = {}): string {
  let cur = 0, inner = "";
  for (const r of parseMath(src)) {
    const off = r.sub ? size * 0.3 : 0;
    const dy = off - cur;
    cur = off;
    inner += `<tspan${dy ? ` dy="${Math.round(dy * 10) / 10}"` : ""}${r.sub ? ` font-size="${subSize(size)}"` : ""}>${esc(r.s)}</tspan>`;
  }
  return el("text", { x, y, "font-size": size, ...attrs }, inner);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Preference losses against the margin they see",
    headDpo: "DPO: log-sigmoid of the margin relative to the reference. Same-prompt pairs, frozen reference.",
    headIpo: "IPO changes the loss shape: a squared distance to a finite target. Same-prompt pairs, frozen reference.",
    headKto: "KTO changes the label format: one response labeled desirable or undesirable, scored against the KL baseline z₀. Frozen reference.",
    headOrpo: "ORPO adds an SFT term on the chosen response and scores responses by the odds of their geometric-mean token probability. Pairs, no reference.",
    headSimpo: "SimPO changes the response score: average token log-probability with a target margin γ. Pairs, no reference.",
    lossTitle: "loss ℓ(u)",
    lossTitleIpo: "loss ℓ(u); IPO drawn as β²ℓ",
    weightTitle: "gradient weight −dℓ/du",
    x: "margin inside the loss, u",
    wrong: "u < 0: mispredicted",
    wrongKto: "u < 0: r_θ < z_0",
    target: "target u = ½",
    gamma: "u = γ",
    base: "r_θ = z_0",
    legendPairs: "example pairs",
    legendKto: "example responses",
    colKto: "response",
    eqDpo: "u = βA,  ℓ = −log σ(u),  −dℓ/du = σ(−u)",
    eqIpo: "u = βh,  β²ℓ = (u − ½)²,  −d(β²ℓ)/du = 1 − 2u",
    eqKto: "u = β(r_θ − z_0),  ℓ = λ_D(1 − σ(u)),  −dℓ/du = λ_D σ(u)σ(−u)",
    eqOrpo: "u = log(odds_w / odds_l),  ℓ_{OR} = −log σ(u),  −dℓ/du = σ(−u)",
    eqSimpo: "u = r_{SimPO}(y_w) − r_{SimPO}(y_l),  ℓ = −log σ(u − γ),  −dℓ/du = σ(γ − u)",
    noteDpo: "The weight is the σ(−βA) of the gradient equation. At β\u00a0=\u00a0{b}, pair 1 carries {s} of the total weight.",
    noteIpo: "The target u = ½ is h = 1/(2β) = {t} nats. A negative weight pulls the margin back; share counts |weight|.",
    noteKto: "λ_D = 1. For an undesirable response u = β(z_0 − r_θ) with λ_U. The weight is largest at u = 0.",
    noteOrpo: "ORPO has no β, so the slider does not move these pairs, and in u its ℓ_{OR} is DPO's curve. L_{SFT}(x, y_w) is added with λ weighting ℓ_{OR}; it depends on y_w alone.",
    noteSimpo: "γ = 1. SimPO's β is inside its score, so the slider does not move these pairs.",
    colPair: "pair",
    colLoss: "ℓ",
    colLossIpo: "β²ℓ",
    colWeight: "weight",
    colShare: "share",
    rawA: "A",
    rawH: "h",
    rawKto: "r_θ − z_0",
    describe: "{name}{at}: the three example {what} sit at u = {u1}, {u2} and {u3} with gradient weights {w1}, {w2} and {w3}; the first carries {s} of the total. {extra}",
    whatPairs: "pairs",
    atBeta: " at β = {b}",
    whatKto: "responses",
    exDpo: "Past a margin of a few units the weight is near zero.",
    exIpo: "Past the target u = ½ (h = {t} nats) the weight turns negative and pulls the margin back.",
    exKto: "The weight peaks at u = 0 and falls on both sides, so badly mispredicted examples also get little.",
    exOrpo: "ORPO's odds-ratio term has DPO's shape on a different score; its SFT term is not drawn.",
    exSimpo: "The weight stays high until u passes γ = 1.",
  },
  zh: {
    title: "偏好损失与其所见的间隔",
    headDpo: "DPO：对相对参考模型的间隔取 log-sigmoid。需要同一提示下的样本对和冻结的参考模型。",
    headIpo: "IPO 改变损失形状：改为到有限目标的平方距离。需要样本对和冻结的参考模型。",
    headKto: "KTO 改变标签格式：单个回答标为合意或不合意，相对 KL 基线 z₀ 计分。需要冻结的参考模型。",
    headOrpo: "ORPO 加入选中回答的 SFT 项，并用词元概率几何平均的优势给回答计分。需要样本对，不用参考模型。",
    headSimpo: "SimPO 改变回答分数：使用平均词元对数概率，并设目标间隔 γ。需要样本对，不用参考模型。",
    lossTitle: "损失 ℓ(u)",
    lossTitleIpo: "损失 ℓ(u)；IPO 画的是 β²ℓ",
    weightTitle: "梯度权重 −dℓ/du",
    x: "损失内部的间隔 u",
    wrong: "u < 0：排序判反",
    wrongKto: "u < 0：r_θ 低于 z_0",
    target: "目标 u = ½",
    gamma: "u = γ",
    base: "r_θ = z_0",
    legendPairs: "示例样本对",
    legendKto: "示例回答",
    colKto: "回答",
    eqDpo: "u = βA，ℓ = −log σ(u)，−dℓ/du = σ(−u)",
    eqIpo: "u = βh，β²ℓ = (u − ½)²，−d(β²ℓ)/du = 1 − 2u",
    eqKto: "u = β(r_θ − z_0)，ℓ = λ_D(1 − σ(u))，−dℓ/du = λ_D σ(u)σ(−u)",
    eqOrpo: "u = log(odds_w / odds_l)，ℓ_{OR} = −log σ(u)，−dℓ/du = σ(−u)",
    eqSimpo: "u = r_{SimPO}(y_w) − r_{SimPO}(y_l)，ℓ = −log σ(u − γ)，−dℓ/du = σ(γ − u)",
    noteDpo: "这个权重就是梯度公式中的 σ(−βA)。β\u00a0=\u00a0{b} 时，样本对 1 占总权重的 {s}。",
    noteIpo: "目标 u = ½ 对应 h = 1/(2β) = {t} nats。权重为负时会把间隔拉回；占比按 |权重| 计算。",
    noteKto: "λ_D = 1。不合意回答取 u = β(z_0 − r_θ)，权重系数换成 λ_U。权重在 u = 0 处最大。",
    noteOrpo: "ORPO 没有 β，滑块不会移动这些样本对；以 u 为横轴时，ℓ_{OR} 与 DPO 的曲线重合。完整目标还要加上 L_{SFT}(x, y_w)，由 λ 调节 ℓ_{OR} 的比重；这一项只取决于 y_w。",
    noteSimpo: "γ = 1。SimPO 的 β 已包含在分数里，滑块不会移动这些样本对。",
    colPair: "样本对",
    colLoss: "ℓ",
    colLossIpo: "β²ℓ",
    colWeight: "权重",
    colShare: "占比",
    rawA: "A",
    rawH: "h",
    rawKto: "r_θ − z_0",
    describe: "{name}{at}：三个示例{what}位于 u = {u1}、{u2}、{u3}，梯度权重分别为 {w1}、{w2}、{w3}；第一个占总权重的 {s}。{extra}",
    whatPairs: "样本对",
    atBeta: "，β = {b}",
    whatKto: "回答",
    exDpo: "间隔超过几个单位后，权重接近零。",
    exIpo: "越过目标 u = ½（h = {t} nats）后，权重变为负值，把间隔拉回。",
    exKto: "权重在 u = 0 处最大，向两侧下降，因此严重判反的样本得到的权重也很小。",
    exOrpo: "ORPO 的优势比项与 DPO 形状相同，只是作用在另一种分数上；图中不画它的 SFT 项。",
    exSimpo: "u 超过 γ = 1 之前，权重一直较高。",
  },
};
type L = typeof labels.en;

const HEAD: Record<Variant, keyof L> = { dpo: "headDpo", ipo: "headIpo", kto: "headKto", orpo: "headOrpo", simpo: "headSimpo" };
const EQ: Record<Variant, keyof L> = { dpo: "eqDpo", ipo: "eqIpo", kto: "eqKto", orpo: "eqOrpo", simpo: "eqSimpo" };
const NOTE: Record<Variant, keyof L> = { dpo: "noteDpo", ipo: "noteIpo", kto: "noteKto", orpo: "noteOrpo", simpo: "noteSimpo" };
const EXTRA: Record<Variant, keyof L> = { dpo: "exDpo", ipo: "exIpo", kto: "exKto", orpo: "exOrpo", simpo: "exSimpo" };

type P = { variant: Variant; beta: number };

const num = (v: number) => fixed(v, Math.abs(v) >= 10 ? 1 : 2);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const { variant: v, beta } = st.p;
  const ps = pairs(v, beta);
  const t = sig(1 / (2 * beta), 3);
  return tpl(L.describe, {
    name: NAME[v], at: usesBeta(v) ? tpl(L.atBeta, { b: sig(beta, 3) }) : "",
    u1: num(ps[0].u), u2: num(ps[1].u), u3: num(ps[2].u),
    w1: num(ps[0].w), w2: num(ps[1].w), w3: num(ps[2].w),
    s: pct(ps[0].share), extra: tpl(L[EXTRA[v]], { t }), what: v === "kto" ? L.whatKto : L.whatPairs,
  });
}

// ---------------------------------------------------------------- render

function wrapFor(lang: Lang, s: string, size: number, width: number): string[] {
  return lang === "zh" ? wrapCjk(s, size, width) : wrap(s, size, width);
}

// A formula split at its double-space (en) or full-width comma (zh)
// separators into as few lines as fit the width.
function formulaLines(src: string, lang: Lang, size: number, width: number): string[] {
  const sep = lang === "zh" ? "，" : ",  ";
  const parts = src.split(sep);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < parts.length; i++) {
    const piece = parts[i] + (i < parts.length - 1 ? sep.trimEnd() : "");
    const next = cur ? `${cur}${lang === "zh" ? "" : "  "}${piece}` : piece;
    if (cur && mathWidth(next, size) > width) { lines.push(cur); cur = piece; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// A numbered dot for one example pair. `dx`/`dy` mark a pair whose value lies
// outside the panel: the dot sits at the edge with an arrow pointing out.
function pairDot(x: number, y: number, i: number, color: string, dx: -1 | 0 | 1 = 0, dy: -1 | 0 | 1 = 0): string {
  const parts: string[] = [];
  if (dx !== 0) parts.push(el("path", { d: `M${x + dx * 9},${y - 5}L${x + dx * 15},${y}L${x + dx * 9},${y + 5}Z`, fill: color }));
  if (dy !== 0) parts.push(el("path", { d: `M${x - 5},${y + dy * 9}L${x},${y + dy * 15}L${x + 5},${y + dy * 9}Z`, fill: color }));
  parts.push(el("circle", { cx: x, cy: y, r: 8, fill: C.paper, stroke: color, "stroke-width": 2 }));
  parts.push(text(x, y + 4, i + 1, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  return g({}, ...parts);
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const { variant: v, beta } = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = TYPE.body;
  const parts: string[] = [];
  const col = COLOR[v];

  // ---- header: what this objective changes relative to DPO, and what it needs
  let y = 0;
  const head = wrapFor(lang, L[HEAD[v]], size, w);
  for (const line of head) {
    y += size + 5;
    parts.push(text(0, y, line, { "font-size": size }));
  }

  // ---- legend
  y += 10;
  const legendY = y + size;
  let lx = 0;
  const legendItem = (stroke: string, width: number, opacity: number, label: string) => {
    const out = el("line", { x1: lx, x2: lx + 22, y1: legendY - 4, y2: legendY - 4, stroke, "stroke-width": width, "stroke-opacity": opacity, "stroke-linecap": "round" })
      + text(lx + 28, legendY, label, { "font-size": size, class: "fig-t-muted" });
    lx += 28 + textWidth(label, size) + 18;
    return out;
  };
  if (v !== "dpo") parts.push(legendItem(C.c1, 1.5, 0.45, "DPO"));
  parts.push(legendItem(col, 2.5, 1, NAME[v]));
  parts.push(el("circle", { cx: lx + 7, cy: legendY - 4, r: 6, fill: C.paper, stroke: col, "stroke-width": 1.5 }));
  parts.push(text(lx + 18, legendY, v === "kto" ? L.legendKto : L.legendPairs, { "font-size": size, class: "fig-t-muted" }));
  y = legendY + 10;

  // ---- panels
  const left = 40, right = narrow ? 6 : 12;
  const plotH = narrow ? 128 : 150;
  // The phone column trims the flat right tail so the curved part keeps its width.
  const uDom: [number, number] = narrow ? [U_DOMAIN[0], 6] : U_DOMAIN;
  const x = linear(uDom, [left, w - right]);
  const us: number[] = [];
  for (let px = left; px <= w - right; px += 1.5) us.push(x.invert(px));
  us.push(uDom[1]);
  const ps = pairs(v, beta);

  const panel = (key: "loss" | "weight", top: number) => {
    const isLoss = key === "loss";
    const yDom: [number, number] = isLoss ? [0, LOSS_MAX] : W_DOMAIN;
    const ys = linear(yDom, [top + plotH, top]);
    const f = isLoss ? loss : weight;
    const out: string[] = [];
    const clip = `${st.uid}-clip-${key}`;
    out.push(el("defs", {}, el("clipPath", { id: clip }, el("rect", { x: left, y: top, width: w - right - left, height: plotH }))));
    // Mispredicted region.
    out.push(el("rect", { x: left, y: top, width: x(0) - left, height: plotH, fill: C.panel, "fill-opacity": 0.6 }));
    out.push(axis({ scale: x, orient: "bottom", at: top + plotH, grid: [top, top + plotH], title: isLoss ? undefined : L.x, size }));
    out.push(axis({
      scale: ys, orient: "left", at: left, grid: [left, w - right], size,
      ticks: isLoss ? [0, 1, 2, 3, 4] : [-1, -0.5, 0, 0.5, 1],
      title: isLoss ? (v === "ipo" ? L.lossTitleIpo : L.lossTitle) : L.weightTitle,
    }));
    if (!isLoss) out.push(el("line", { x1: left, x2: w - right, y1: ys(0), y2: ys(0), stroke: C.ink3, "stroke-width": 1 }));
    // Variant markers.
    const marker = (u: number, label: string) => {
      const px = x(u);
      out.push(el("line", { x1: px, x2: px, y1: top, y2: top + plotH, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
      // The top strip of the weight panel right of the marker is empty for
      // every objective: weights above 0.85 occur only at u < 0.
      if (!isLoss) {
        const tw = mathWidth(label, size);
        const tx = px + 5 + tw > w - right - 2 ? px - 5 - tw : px + 5;
        out.push(mtext(tx, top + size + 2, label, size, { class: "fig-t-halo fig-t-soft" }));
      }
    };
    if (v === "ipo") marker(0.5, L.target);
    if (v === "simpo") marker(GAMMA, L.gamma);
    if (v === "kto") marker(0, L.base);
    // No objective has a negative weight at u < 0, so this corner stays clear.
    if (!isLoss) out.push(mtext(left + 5, top + plotH - 6, v === "kto" ? L.wrongKto : L.wrong, size, { class: "fig-t-halo fig-t-soft" }));
    // Curves: DPO faint underneath, then the chosen objective.
    const curve = (vv: Variant, stroke: string, width: number, opacity: number) =>
      el("path", { d: linePath(us.map((u) => [x(u), ys(Math.max(Math.min(f(vv, u), yDom[1] + 1), yDom[0] - 1))])), fill: "none", stroke, "stroke-width": width, "stroke-opacity": opacity, "stroke-linejoin": "round" });
    const curves: string[] = [];
    if (v !== "dpo") curves.push(curve("dpo", C.c1, 1.5, 0.45));
    curves.push(curve(v, col, 2.5, 1));
    out.push(g({ "clip-path": `url(#${clip})` }, ...curves));
    // Example pairs. A pair whose dot would cross the left or right edge sits
    // at that edge with an arrow pointing out, stacked inward in order of u so
    // the order of the pairs is kept; one beyond the value range sits at the
    // top or bottom edge the same way.
    const edgeR = w - right - 12, edgeL = left + 12;
    const outR = ps.filter((p) => x(p.u) > edgeR).sort((a, b) => b.u - a.u);
    const outL = ps.filter((p) => x(p.u) < edgeL).sort((a, b) => a.u - b.u);
    for (const p of ps) {
      const val = isLoss ? p.loss : p.w;
      const kR = outR.indexOf(p), kL = outL.indexOf(p);
      const dx: -1 | 0 | 1 = kR >= 0 ? 1 : kL >= 0 ? -1 : 0;
      const dy: -1 | 0 | 1 = val > yDom[1] ? -1 : val < yDom[0] ? 1 : 0;
      const cx = kR >= 0 ? edgeR - 18 * kR : kL >= 0 ? edgeL + 18 * kL : x(p.u);
      const cy = dy < 0 ? top + 17 : dy > 0 ? top + plotH - 17 : ys(val);
      out.push(pairDot(cx, cy, p.i, col, dx, dy));
    }
    return out.join("");
  };

  const lossTop = y + 22;
  parts.push(panel("loss", lossTop));
  const weightTop = lossTop + plotH + 12 + size + 30;
  parts.push(panel("weight", weightTop));
  y = weightTop + plotH + axisHeight(true, size) + 16;

  // ---- readout: the equation, the pairs' terms, the variant's note
  const rp: string[] = [];
  for (const line of formulaLines(L[EQ[v]], lang, TYPE.label, w)) {
    y += TYPE.label + 6;
    rp.push(mtext(0, y, line, TYPE.label, { class: "fig-t-strong" }));
  }
  y += 10;
  const rawHead = v === "dpo" ? L.rawA : v === "ipo" ? L.rawH : v === "kto" ? L.rawKto : null;
  const cols: Array<{ head: string; cell: (p: (typeof ps)[number]) => string }> = [];
  if (rawHead) cols.push({ head: rawHead, cell: (p) => sig(p.raw, 3) });
  cols.push({ head: "u", cell: (p) => num(p.u) });
  cols.push({ head: v === "ipo" ? L.colLossIpo : L.colLoss, cell: (p) => num(p.loss) });
  cols.push({ head: L.colWeight, cell: (p) => num(p.w) });
  cols.push({ head: L.colShare, cell: (p) => pct(p.share) });
  const pairColW = narrow ? 44 : 64;
  const colW = Math.min(96, (w - pairColW) / cols.length);
  const rowH = size + 10;
  y += size;
  rp.push(text(0, y, v === "kto" ? L.colKto : L.colPair, { "font-size": size, class: "fig-t-muted" }));
  cols.forEach((c, j) => rp.push(mtext(pairColW + colW * (j + 1) - 6, y, c.head, size, { "text-anchor": "end", class: "fig-t-muted" })));
  y += 6;
  rp.push(el("line", { x1: 0, x2: pairColW + colW * cols.length, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  for (const p of ps) {
    y += rowH;
    rp.push(pairDot(10, y - 4, p.i, col));
    cols.forEach((c, j) => rp.push(text(pairColW + colW * (j + 1) - 6, y, c.cell(p), { "font-size": size, "text-anchor": "end", class: "fig-t-num" })));
  }
  y += 8;
  const note = tpl(L[NOTE[v]], { b: sig(beta, 3), s: pct(ps[0].share), t: sig(1 / (2 * beta), 3) });
  for (const line of wrapFor(lang, note, size, w)) {
    y += size + 5;
    rp.push(mtext(0, y, line, size, { class: "fig-t-muted" }));
  }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y + 6, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "preference-losses",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    variant: {
      kind: "choice", label: { en: "Objective", zh: "目标函数" }, default: "ipo", control: "buttons",
      options: VARIANTS.map((v) => ({ value: v, label: { en: NAME[v], zh: NAME[v] } })),
    },
    beta: {
      kind: "range", scale: "log", label: { en: "β", zh: "β" }, min: 0.05, max: 2, default: BETA_REF,
      marks: [{ value: BETA_REF, label: { en: "runnable example", zh: "可运行示例" } }],
    },
  },
  render,
  describe,
});
