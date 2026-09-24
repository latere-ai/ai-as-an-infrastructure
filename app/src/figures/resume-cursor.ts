// Restoring the model and the data cursor to different points, on one run's
// logical batch sequence. Global batch k is a fixed range of the logical
// permutation (b = 4 samples each), and the run stops after S = 12 optimizer
// steps. Checkpoints commit after steps 4 and 8, each with the cursor that
// points past the batches its model consumed. The failure arrives during
// step 10: steps 1 to 9 are applied, batch 10 is in flight, and the reader
// has prefetched batches 11 and 12. Those three are provisional; nothing
// commits them.
//
// The reader restores the model from checkpoint m and the cursor to batch c.
// Training then runs the remaining S − m steps on batches c + 1 onward. A
// batch's contributions to the final model are
//
//   count(k) = [k ≤ m] + [c < k ≤ c + S − m],
//
// so c = m gives every batch exactly once, c > m skips batches m + 1 to c,
// and c < m trains batches c + 1 to m twice. The numbers are the chapter's
// rule applied to an illustrative run, computed exactly.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

const B = 4; // samples per global batch
const S = 12; // optimizer steps in the run
const CKPTS = [4, 8]; // steps whose checkpoints committed
const APPLIED = 9; // steps applied before the failure
const INFLIGHT = 10; // batch being processed when the failure arrives
const PREFETCH = 2; // batches read ahead of the in-flight one
const READER = INFLIGHT + PREFETCH; // last batch the reader had fetched
const N = READER + S - Math.min(...CKPTS); // longest strip any setting reaches

type P = { model: number; cursor: number };

function counts(p: P): number[] {
  const out: number[] = [];
  for (let k = 1; k <= N; k++) out.push((k <= p.model ? 1 : 0) + (k > p.cursor && k <= p.cursor + S - p.model ? 1 : 0));
  return out;
}

function summary(p: P) {
  const c = counts(p);
  const skipped = c.flatMap((v, i) => (v === 0 && i + 1 <= Math.max(p.cursor, p.model) ? [i + 1] : []));
  const doubled = c.flatMap((v, i) => (v === 2 ? [i + 1] : []));
  const last = p.cursor + S - p.model;
  return { c, skipped, doubled, last, ok: !skipped.length && !doubled.length };
}

const labels = {
  en: {
    title: "Model state and data cursor restored to different points",
    before: "Before the failure, generation 1",
    after: "After the restore, generation 2",
    result: "Contributions to the final model",
    batch: "global batch k ({b} samples each)",
    applied: "applied",
    inflight: "in flight",
    prefetched: "prefetched",
    restored: "in the restored model",
    trained: "trained after the restore",
    once: "once",
    twice: "twice",
    never: "skipped",
    ckpt: "ckpt {k}",
    failure: "failure",
    modelAt: "model {m}",
    cursorAt: "cursor {c}",
    setting: "Restore the model from checkpoint {m} and the cursor to batch {c}",
    rule: "The checkpoint of step {m} saved cursor {m}; the run finishes {s} steps on batches {a} to {z}.",
    ok: "Consistent: every batch up to {z} contributes once, so exact replay holds.",
    skip: "Skip: {list} never train ({n} samples); the model rolled back and the cursor did not.",
    dup: "Duplicate: {list} train twice ({n} samples); the cursor rolled back past the model.",
    prov: "Batches {a} to {z} were in flight or prefetched when the run failed; they were never committed and are read again only if the restored cursor reaches them.",
    list1: "batch {a}",
    listN: "batches {a} to {z}",
    describe: "Model restored from checkpoint {m}, cursor at batch {c}. {verdict}",
  },
  zh: {
    title: "模型状态与数据游标恢复到不同位置",
    before: "故障之前，第 1 代",
    after: "恢复之后，第 2 代",
    result: "对最终模型的贡献",
    batch: "全局批次 k（每批 {b} 个样本）",
    applied: "已应用",
    inflight: "处理中",
    prefetched: "已预取",
    restored: "已含在恢复的模型中",
    trained: "恢复后训练",
    once: "一次",
    twice: "两次",
    never: "被跳过",
    ckpt: "检查点 {k}",
    failure: "故障",
    modelAt: "模型 {m}",
    cursorAt: "游标 {c}",
    setting: "模型从检查点 {m} 恢复，游标恢复到第 {c} 批",
    rule: "第 {m} 步的检查点保存的游标是 {m}；运行在第 {a} 到第 {z} 批上完成剩余的 {s} 步。",
    ok: "一致：第 {z} 批及之前的每一批都只贡献一次，精确重放成立。",
    skip: "跳过：{list}从未参与训练（{n} 个样本）；模型回滚了，游标却没有回滚。",
    dup: "重复：{list}训练了两次（{n} 个样本）；游标回滚得比模型更远。",
    prov: "故障发生时，第 {a} 到第 {z} 批正在处理或已预取；它们从未提交，只有恢复后的游标走到这里时才会重新读取。",
    list1: "第 {a} 批",
    listN: "第 {a} 到第 {z} 批",
    describe: "模型从检查点 {m} 恢复，游标位于第 {c} 批。{verdict}",
  },
};
type L = typeof labels.en;

function range(xs: number[], L: L): string {
  return xs.length === 1 ? tpl(L.list1, { a: xs[0] }) : tpl(L.listN, { a: xs[0], z: xs[xs.length - 1] });
}

function verdict(p: P, L: L): string {
  const s = summary(p);
  if (s.ok) return tpl(L.ok, { z: s.last });
  if (s.skipped.length) return tpl(L.skip, { list: range(s.skipped, L), n: s.skipped.length * B });
  return tpl(L.dup, { list: range(s.doubled, L), n: s.doubled.length * B });
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  return tpl(L.describe, { m: st.p.model, c: st.p.cursor, verdict: verdict(st.p, L) });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const small = narrow ? TYPE.body : TYPE.small;
  const s = summary(p);
  const hatchId = `${st.uid}-prov`;
  const parts: string[] = [el("defs", {}, hatch(hatchId, C.ink3, 4, 1.2))];
  const gap = 2;
  const cell = (w - gap * (N - 1)) / N;
  const cx = (k: number) => (k - 1) * (cell + gap); // left edge of batch k
  const edge = (k: number) => k * (cell + gap) - gap / 2; // boundary after batch k
  const stripH = narrow ? 20 : 22;
  let y = 0;

  const lane = (title: string, items: Array<{ label: string; swatch: Parameters<typeof legend>[0][number]["swatch"] }>) => {
    parts.push(text(0, y + 14, title, { "font-size": TYPE.label, class: "fig-t-strong" }));
    const lg = legend(items, 0, y + 22, w, small);
    parts.push(lg.svg);
    y += 22 + lg.height + 4;
  };
  const marker = (k: number, label: string, above: boolean, top: number, h: number, strong = false) => {
    const x = edge(k);
    parts.push(el("line", { x1: x, x2: x, y1: top - (above ? 5 : 0), y2: top + h + (above ? 0 : 5), stroke: strong ? C.ink : C.ink2, "stroke-width": strong ? 2 : 1.4 }));
    const tw = textWidth(label, small);
    const lx = Math.min(Math.max(x, tw / 2), w - tw / 2);
    parts.push(text(lx, above ? top - 9 : top + h + 5 + small, label, { "font-size": small, "text-anchor": "middle", class: strong ? "fig-t-strong fig-t-num" : "fig-t-muted fig-t-num" }));
  };
  const box = (k: number, top: number, h: number, a: Record<string, string | number>) => parts.push(el("rect", { x: cx(k), y: top, width: cell, height: h, rx: 2, ...a }));

  // ---- lane 1: the run as it stood when it failed
  lane(L.before, [
    { label: L.applied, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.inflight, swatch: { kind: "rect", fill: C.c1, opacity: 0.25, stroke: C.c1 } },
    { label: L.prefetched, swatch: { kind: "rect", fill: C.ink3, pattern: hatchId } },
  ]);
  y += small + 8;
  let top = y;
  for (let k = 1; k <= N; k++) {
    if (k <= APPLIED) box(k, top, stripH, { fill: C.c1 });
    else if (k === INFLIGHT) box(k, top, stripH, { fill: C.c1, "fill-opacity": 0.25, stroke: C.c1, "stroke-width": 1.2 });
    else if (k <= READER) box(k, top, stripH, { fill: `url(#${hatchId})`, stroke: C.ink3, "stroke-width": 0.8 });
    else box(k, top, stripH, { fill: C.panel });
  }
  for (const k of CKPTS) marker(k, tpl(L.ckpt, { k }), true, top, stripH);
  const fx = cx(INFLIGHT) + cell / 2;
  parts.push(text(Math.min(fx, w - textWidth(L.failure, small) / 2), top + stripH + 5 + small, L.failure, { "font-size": small, "text-anchor": "middle", class: "fig-t-strong" }));
  parts.push(el("line", { x1: fx, x2: fx, y1: top + stripH, y2: top + stripH + 5, stroke: C.bad, "stroke-width": 2 }));
  y = top + stripH + small + 18;

  // ---- lane 2: what the restored run holds and trains, one sub-row each
  lane(L.after, [
    { label: L.restored, swatch: { kind: "rect", fill: C.c1, opacity: 0.35 } },
    { label: L.trained, swatch: { kind: "rect", fill: C.c1 } },
  ]);
  y += small + 8;
  top = y;
  const sub = (stripH - 2) / 2;
  for (let k = 1; k <= N; k++) {
    box(k, top, sub, k <= p.model ? { fill: C.c1, "fill-opacity": 0.35 } : { fill: C.panel });
    box(k, top + sub + 2, sub, k > p.cursor && k <= s.last ? { fill: C.c1 } : { fill: C.panel });
  }
  marker(p.model, tpl(L.modelAt, { m: p.model }), true, top, stripH, true);
  marker(p.cursor, tpl(L.cursorAt, { c: p.cursor }), false, top, stripH, true);
  y = top + stripH + small + 18;

  // ---- lane 3: contributions per batch
  lane(L.result, [
    { label: L.once, swatch: { kind: "rect", fill: C.c1 } },
    { label: L.twice, swatch: { kind: "rect", fill: C.warn } },
    { label: L.never, swatch: { kind: "rect", fill: C.bad } },
  ]);
  y += 4;
  top = y;
  for (let k = 1; k <= N; k++) {
    const v = s.c[k - 1];
    const skipped = s.skipped.includes(k);
    box(k, top, stripH, { fill: v === 2 ? C.warn : v === 1 ? C.c1 : skipped ? C.bad : C.panel });
    if (!narrow && (v > 0 || skipped)) parts.push(text(cx(k) + cell / 2, top + stripH / 2 + 4, v, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-halo fig-t-num" }));
  }
  // Batch axis.
  y = top + stripH + 4 + small;
  for (let k = 1; k <= N; k++) {
    if (narrow && k !== 1 && k % 4 !== 0) continue;
    parts.push(text(cx(k) + cell / 2, y, k, { "font-size": small, "text-anchor": "middle", class: "fig-t-muted fig-t-num" }));
  }
  y += small + 4;
  parts.push(text(w / 2, y, tpl(L.batch, { b: B }), { "font-size": small, "text-anchor": "middle", class: "fig-t-muted" }));
  y += 24;

  // ---- readout
  const rp: string[] = [];
  const put = (line: string, cls: string, size: number = TYPE.body, indent = 0) => {
    for (const ln of wrapCjk(line, size, w - indent)) { rp.push(text(indent, y, ln, { "font-size": size, class: cls })); y += size + 5; }
    y += 3;
  };
  put(tpl(L.setting, { m: p.model, c: p.cursor }), "fig-t-strong", TYPE.label);
  put(tpl(L.rule, { m: p.model, s: S - p.model, a: p.cursor + 1, z: s.last }), "fig-t-num");
  rp.push(el("circle", { cx: 5, cy: y - 4, r: 4, fill: s.ok ? C.good : s.skipped.length ? C.bad : C.warn }));
  put(verdict(p, L), "fig-t-strong", TYPE.body, 14);
  put(tpl(L.prov, { a: INFLIGHT, z: READER }), "fig-t-muted", small);
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "resume-cursor",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    model: {
      kind: "choice", label: { en: "Restore the model from", zh: "模型恢复自" }, default: 8,
      options: CKPTS.map((k) => ({ value: k, label: { en: `checkpoint ${k}`, zh: `检查点 ${k}` } })),
    },
    cursor: {
      kind: "range", label: { en: "Restore the data cursor to batch", zh: "数据游标恢复到第几批" }, min: 0, max: READER, step: 1, default: READER,
      marks: [
        ...CKPTS.map((k) => ({ value: k, label: { en: `checkpoint ${k}`, zh: `检查点 ${k}` } })),
        { value: APPLIED, label: { en: "last applied step", zh: "最后应用的一步" } },
        { value: READER, label: { en: "reader position", zh: "读取器位置" } },
      ],
    },
  },
  render,
  describe,
});
