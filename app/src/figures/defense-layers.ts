// Defense in depth by failure stage, and why stacking learned layers helps
// less than their individual miss rates suggest. A batch of seeded attempts
// passes through four learned layers and then a deterministic effect gate.
//
// Each learned layer misses a fixed share of attempts (illustrative rates). An
// attempt's miss at each layer is drawn from a latent normal with a shared
// component, so the correlation control moves every learned layer's holes into
// or out of alignment: at correlation 0 the layers are independent and the
// share reaching the end is the product of the miss rates; at correlation 1 an
// attempt that passes the strongest learned layer passes them all, so the
// share reaching the end is the strongest layer's own miss rate and the stack
// is only as strong as its single strongest layer. This is the chapter's claim
// that a separate
// guard is not automatically statistically independent of the target model.
//
// The effect gate is deterministic, not learned. It enforces a narrow property
// that trusted code checks (authorization, recipient and destination rules), so
// it stops an unauthorized external effect even when every learned layer
// missed. It does not make model output safe: for an attack whose objective is
// prohibited text, the gate has nothing to enforce, and the text is delivered.
// So a jailbreak that clears the learned layers still reaches the reader, while
// an injection that clears them is stopped at the effect it would have caused.
//
// Miss rates are illustrative and labeled so in the caption. The attempt
// outcomes are a seeded function of the correlation and the batch seed.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { rng } from "./lib/random.ts";
import { normalQuantile } from "./lib/stats.ts";
import { pct, tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

// The four learned layers, with an illustrative per-attempt miss rate each.
type Layer = { key: string; miss: number };
const LEARNED: Layer[] = [
  { key: "tuning", miss: 0.45 },      // safety tuning and adversarial training
  { key: "hierarchy", miss: 0.5 },    // instruction hierarchy
  { key: "classifier", miss: 0.4 },   // input and output classifiers
  { key: "circuit", miss: 0.45 },     // representation rerouting (circuit breakers)
];
const N = 60; // attempts in the batch

type Family = "optimized" | "manyshot" | "injection";
// Whether a family's objective is an external effect (the gate can stop it) or
// prohibited text (the gate has nothing to enforce).
const isEffect = (f: Family) => f === "injection";

type P = { family: Family; correlation: number; seed: number };

// Box-Muller normal from two seeded uniforms.
function normal(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

interface Attempt { caught: number; reached: boolean } // caught: learned-layer index, or -1 if it reached the gate

// Each attempt: a shared latent plus a per-layer idiosyncratic latent, mixed by
// the correlation. It passes a learned layer when its latent exceeds that
// layer's miss threshold. It reaches the gate only if it passes all of them.
function attempts(p: P): Attempt[] {
  const r = rng(p.seed * 2654435761);
  const rho = p.correlation;
  const a = Math.sqrt(rho), b = Math.sqrt(1 - rho);
  const thr = LEARNED.map((l) => normalQuantile(1 - l.miss)); // pass (miss) when latent > thr
  const out: Attempt[] = [];
  for (let i = 0; i < N; i++) {
    const zc = normal(r(), r());
    let caught = -1;
    for (let l = 0; l < LEARNED.length; l++) {
      const zl = normal(r(), r());
      const x = a * zc + b * zl;
      if (x <= thr[l]) { caught = l; break; } // caught by this layer
    }
    out.push({ caught, reached: caught === -1 });
  }
  return out;
}

function summary(p: P) {
  const at = attempts(p);
  const perLayer = LEARNED.map((_, l) => at.filter((x) => x.caught === l).length);
  const reached = at.filter((x) => x.reached).length;
  // The effect gate stops external effects; prohibited text passes it.
  const effect = isEffect(p.family);
  const blocked = effect ? reached : 0;      // stopped at the gate
  const delivered = effect ? 0 : reached;    // prohibited text delivered
  return { at, perLayer, reached, blocked, delivered, effect };
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Learned layers with correlated holes, and a deterministic effect gate",
    tuning: "Safety tuning",
    hierarchy: "Instruction hierarchy",
    classifier: "Classifiers",
    circuit: "Circuit breakers",
    gate: "Effect gate",
    learned: "learned defenses",
    deterministic: "deterministic",
    caughtHere: "caught {n}",
    missRate: "misses {p}",
    blocked: "external effect stopped",
    delivered: "prohibited text delivered",
    gateEffect: "The gate enforces authorization, so it stops the unauthorized effect these {n} attempts would have caused.",
    gateText: "The gate has no external effect to stop: the objective is prohibited text, so these {n} attempts reach the reader.",
    indepNote: "Independent layers would let {p} through; at this correlation {q} reach the gate.",
    optimized: "Optimized suffix",
    manyshot: "Many-shot",
    injection: "Indirect injection",
    describe: "{fam}, correlation {c}: of {n} attempts, {r} pass all four learned layers ({p}). {tail}",
    tailEffect: "The deterministic effect gate stops all {b} at the effect they would cause; none becomes an external compromise.",
    tailText: "The objective is prohibited text, which the effect gate does not check, so all {d} reach the reader.", andText: "prohibited text",
  },
  zh: {
    title: "学习层的漏洞相关，确定性效果闸门另算",
    tuning: "安全调优",
    hierarchy: "指令层级",
    classifier: "分类器",
    circuit: "断路器",
    gate: "效果闸门",
    learned: "学习得到的防御",
    deterministic: "确定性",
    caughtHere: "拦下 {n}",
    missRate: "漏过 {p}",
    blocked: "外部效果被拦下",
    delivered: "被禁止文本已送达",
    gateEffect: "闸门执行授权，因此拦下这 {n} 次尝试本会造成的未授权效果。",
    gateText: "闸门没有可拦下的外部效果：目标是被禁止的文本，因此这 {n} 次尝试送到读者面前。",
    indepNote: "各层独立时会漏过 {p}；在当前相关度下有 {q} 到达闸门。",
    optimized: "优化后缀",
    manyshot: "多示例",
    injection: "间接注入",
    describe: "{fam}，相关度 {c}：{n} 次尝试中有 {r} 次穿过全部四个学习层（{p}）。{tail}",
    tailEffect: "确定性效果闸门在它们本会造成的效果处全部拦下这 {b} 次；没有一次变成外部系统失陷。",
    tailText: "目标是被禁止的文本，效果闸门并不检查文本，因此这 {d} 次全部送到读者面前。", andText: "被禁止文本",
  },
};
type L = typeof labels.en;
const layerName = (L: L, key: string) => L[key as keyof L] as string;
const familyName = (L: L, f: Family) => L[f];

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const s = summary(p);
  const tail = s.effect ? tpl(L.tailEffect, { b: s.blocked }) : tpl(L.tailText, { d: s.delivered });
  return tpl(L.describe, { fam: familyName(L, p.family), c: p.correlation.toFixed(2), n: N, r: s.reached, p: pct(s.reached / N), tail });
}

// ---------------------------------------------------------------- render

const wrapAt = (lang: Lang) => (s: string, size: number, w: number) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const s = summary(p);
  const parts: string[] = [];
  const W = wrapAt(lang);

  // Column x-positions: four learned layers, then the effect gate.
  const left = 8;
  const right = w - 8;
  const cols = LEARNED.length + 1; // +gate
  const span = right - left;
  const step = span / cols;
  const colX = LEARNED.map((_, l) => left + (l + 0.7) * step);
  const gateX = left + (LEARNED.length + 0.6) * step;

  // Header. Wide: each layer named over its column with its miss rate. Narrow:
  // a numbered legend above the plot, and the columns marked 1..4 and G.
  const hy = 12;
  let top: number;
  if (!narrow) {
    parts.push(text(left, hy, L.learned, { "font-size": TYPE.small, class: "fig-t-faint" }));
    parts.push(text(gateX, hy, L.deterministic, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-faint" }));
    let maxLines = 1;
    LEARNED.forEach((l, i) => {
      const x = colX[i];
      const nm = W(layerName(L, l.key), TYPE.small, step - 6);
      maxLines = Math.max(maxLines, nm.length);
      nm.forEach((ln, k) => parts.push(text(x, hy + 16 + k * 12, ln, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" })));
      parts.push(text(x, hy + 16 + nm.length * 12 + 2, tpl(L.missRate, { p: pct(l.miss) }), { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-faint fig-t-num" }));
    });
    const gnm = W(L.gate, TYPE.small, step - 6);
    gnm.forEach((ln, k) => parts.push(text(gateX, hy + 16 + k * 12, ln, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-strong" })));
    top = hy + 16 + (maxLines + 1) * 12 + 12;
  } else {
    parts.push(text(left, hy, L.learned, { "font-size": TYPE.small, class: "fig-t-faint" }));
    let ly = hy + 15;
    LEARNED.forEach((l, i) => {
      parts.push(text(left, ly, `${i + 1}`, { "font-size": TYPE.small, class: "fig-t-strong fig-t-num" }));
      parts.push(text(left + 14, ly, `${layerName(L, l.key)} ${tpl(L.missRate, { p: pct(l.miss) })}`, { "font-size": TYPE.small, class: "fig-t-muted" }));
      ly += 15;
    });
    parts.push(text(left, ly, "G", { "font-size": TYPE.small, class: "fig-t-strong" }));
    parts.push(text(left + 14, ly, `${L.gate} (${L.deterministic})`, { "font-size": TYPE.small, class: "fig-t-strong" }));
    top = ly + 16;
  }
  const rowH = Math.max(3, Math.min(6, Math.floor((narrow ? 220 : 200) / N)));
  const plotH = N * rowH;
  const bottom = top + plotH;

  // Layer guide lines, numbered on the narrow layout.
  LEARNED.forEach((_, i) => {
    parts.push(el("line", { x1: colX[i], x2: colX[i], y1: top - 4, y2: bottom + 4, stroke: C.grid, "stroke-width": 1 }));
    if (narrow) parts.push(text(colX[i], top - 6, `${i + 1}`, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-faint fig-t-num" }));
  });
  if (narrow) parts.push(text(gateX, top - 6, "G", { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-faint" }));
  // The effect gate as a solid wall.
  parts.push(el("rect", { x: gateX - 3, y: top - 4, width: 6, height: plotH + 8, rx: 2, fill: C.ink2 }));

  // Attempt tracks.
  s.at.forEach((x, i) => {
    const y = top + i * rowH + rowH / 2;
    if (x.reached) {
      // Alive through every learned layer to the gate.
      parts.push(el("line", { x1: left, x2: gateX - 3, y1: y, y2: y, stroke: C.ink, "stroke-width": Math.max(1, rowH - 2), opacity: 0.9 }));
      if (s.effect) {
        // Stopped at the gate: a mark on the wall, good.
        parts.push(el("circle", { cx: gateX, cy: y, r: Math.max(2, rowH / 2), fill: C.good }));
      } else {
        // Prohibited text passes the gate to the reader, bad.
        parts.push(el("line", { x1: gateX + 3, x2: right, y1: y, y2: y, stroke: C.bad, "stroke-width": Math.max(1, rowH - 2) }));
      }
    } else {
      // Caught at layer x.caught: solid up to it, a stop, faint after.
      const xc = colX[x.caught];
      parts.push(el("line", { x1: left, x2: xc, y1: y, y2: y, stroke: C.ink3, "stroke-width": Math.max(1, rowH - 2), opacity: 0.5 }));
      parts.push(el("circle", { cx: xc, cy: y, r: Math.max(1.5, rowH / 2 - 0.5), fill: C.c1 }));
    }
  });

  // Per-layer catch counts and the outcome label. Wide: under each column and
  // at the right edge. Narrow: one caught line, then the outcome on its own.
  const outLabel = s.effect ? L.blocked : L.delivered;
  const outCol = s.effect ? C.good : C.bad;
  let y: number;
  if (!narrow) {
    LEARNED.forEach((_, i) => parts.push(text(colX[i], bottom + 16, tpl(L.caughtHere, { n: s.perLayer[i] }), { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted fig-t-num" })));
    parts.push(text(right, bottom + 16, outLabel, { "font-size": TYPE.small, "text-anchor": "end", fill: outCol }));
    y = bottom + 34;
  } else {
    const caughtLine = LEARNED.map((_, i) => `${i + 1}: ${tpl(L.caughtHere, { n: s.perLayer[i] })}`).join("   ");
    parts.push(text(left, bottom + 16, caughtLine, { "font-size": TYPE.small, class: "fig-t-muted fig-t-num" }));
    parts.push(el("circle", { cx: left + 4, cy: bottom + 30, r: 4, fill: outCol }));
    parts.push(text(left + 14, bottom + 34, outLabel, { "font-size": TYPE.small, fill: outCol }));
    y = bottom + 50;
  }
  // Independent-vs-correlated readout.
  const indep = LEARNED.reduce((a, l) => a * l.miss, 1);
  const note = tpl(L.indepNote, { p: pct(indep), q: pct(s.reached / N) });
  for (const ln of W(note, TYPE.body, right - left)) { parts.push(text(left, y, ln, { "font-size": TYPE.body, class: "fig-t-muted fig-t-num" })); y += TYPE.body + 5; }
  y += 4;
  const gateNote = s.effect ? tpl(L.gateEffect, { n: s.blocked }) : tpl(L.gateText, { n: s.delivered });
  for (const ln of W(gateNote, TYPE.body, right - left)) { parts.push(text(left, y, ln, { "font-size": TYPE.body, class: s.effect ? undefined : "fig-t-strong" })); y += TYPE.body + 5; }

  return svg(w, y + 4, describe(st, lang), g({ class: "fig-defense-layers" }, ...parts));
}

export default defineFigure({
  name: "defense-layers",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    family: {
      kind: "choice", label: { en: "Attack family", zh: "攻击家族" }, default: "injection", control: "buttons",
      options: [
        { value: "optimized", label: { en: labels.en.optimized, zh: labels.zh.optimized } },
        { value: "manyshot", label: { en: labels.en.manyshot, zh: labels.zh.manyshot } },
        { value: "injection", label: { en: labels.en.injection, zh: labels.zh.injection } },
      ],
    },
    correlation: {
      kind: "range", label: { en: "Correlation of learned-layer holes", zh: "学习层漏洞的相关度" },
      min: 0, max: 1, step: 0.05, default: 0.6,
      marks: [{ value: 0, label: { en: "independent", zh: "独立" } }, { value: 1, label: { en: "aligned", zh: "对齐" } }],
    },
    seed: { kind: "range", label: { en: "Batch seed", zh: "批次种子" }, min: 1, max: 999, step: 1, default: 7, control: false },
  },
  render,
  describe,
});
