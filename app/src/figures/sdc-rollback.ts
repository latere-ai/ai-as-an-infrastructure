// Silent corruption on a training timeline: when it is detected, what the
// operator can know about when it began, and which checkpoint is safe to
// restore.
//
// A run of 1,000 illustrative steps. The state is corrupted from step s on
// (s itself included) and nothing raises an error. A correctness check runs
// every `cadence` steps on the state at that step; before s it always passes,
// from s on it fires with probability `coverage` (one seeded draw per check).
// "Loss curve only" is a detector with zero coverage for this kind of
// corruption: in the Ma et al. study weights drifted while the pretraining
// loss stayed nearly unchanged, so the drawn loss trace (illustrative) does
// not respond to it.
//
// A checkpoint is written every `every` steps and only the newest `retain`
// are kept. The run halts at the first check that fires. The operator sees
// the checks, not s: steps up to the last passing check are taken as trusted,
// steps between it and the firing check are unknown, and the policy restores
// the newest retained checkpoint at or before the last passing check. A pass
// from a check with coverage below 1 can come after s, and then that restore
// brings back corrupted weights.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g, hatch, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCjk as wrap } from "./lib/kinsoku.ts";
import { int, tpl } from "./lib/format.ts";
import { rng } from "./lib/random.ts";

const STEPS = 1000;

type Cadence = "20" | "50" | "100" | "loss";
type P = { s: number; cadence: Cadence; coverage: number; every: number; retain: number; seed: number };

interface Check { step: number; fired: boolean }
interface Outcome {
  checks: Check[];
  halt: number; // step at which the run stops (detection, or the end of the window)
  detected: boolean;
  lastPass: number; // last passing check before the halt, 0 if none (the initial state)
  written: number[]; // checkpoint steps written up to the halt
  retained: number[];
  target: number | null; // rollback target under the operator's policy
}

function outcome(p: P): Outcome {
  const u = rng(p.seed);
  const checks: Check[] = [];
  let halt = STEPS, detected = false;
  if (p.cadence !== "loss") {
    const k = Number(p.cadence);
    for (let step = k; step <= STEPS; step += k) {
      const fired = step >= p.s && u() < p.coverage;
      checks.push({ step, fired });
      if (fired) { halt = step; detected = true; break; }
    }
  }
  const passes = checks.filter((c) => !c.fired);
  const lastPass = passes.length ? passes[passes.length - 1].step : 0;
  const written: number[] = [];
  for (let step = p.every; step <= halt; step += p.every) written.push(step);
  const retained = written.slice(-p.retain);
  const ok = retained.filter((c) => c <= lastPass);
  return { checks, halt, detected, lastPass, written, retained, target: detected && ok.length ? ok[ok.length - 1] : null };
}

const labels = {
  en: {
    title: "Silent corruption, detection, and the rollback point",
    rowState: "Model state (not visible to the operator)",
    clean: "clean",
    corrupt: "corrupted",
    halted: "halted",
    notRun: "not run",
    rowChecks: "Correctness checks every {k} steps, coverage {c}",
    rowLoss: "Loss curve only: it does not move when the weights drift",
    rowView: "What the checks let the operator conclude",
    trusted: "taken as clean",
    unknown: "unknown",
    known: "known corrupted",
    noSignal: "no signal: taken as clean",
    rowCkpt: "Checkpoints every {k} steps, newest {r} kept",
    lgPass: "check passes",
    lgMiss: "passes on corrupted state",
    lgFire: "check fires",
    lgKept: "kept",
    lgKeptBad: "kept, holds corrupted state",
    lgGone: "deleted",
    sMark: "s = {s}",
    fire: "fires at {t}",
    target: "restore {t}",
    replay: "discard {n} steps",
    x: "training step",
    rStart: "Corruption begins at step {s}; no error is raised.",
    rDetect: "The check at step {t} fires, {lag} steps later. The last passing check was at step {lp}, so the first corrupted state lies somewhere in steps {a} to {t}.",
    rDetectPart: "The check at step {t} fires, {lag} steps later. The last pass was at step {lp}, but a check with coverage below 1 can pass on corrupted state, so the checks only show that the corruption began before step {t}.",
    rNoDetect: "Nothing fires by step {t}.",
    rClean: "Restoring checkpoint {c} brings back a clean state and discards {n} steps of work.",
    rDirty: "Checkpoint {c} is the newest kept one at or before the last pass, but it was written after step {s}: a check with coverage below 1 passed on corrupted state, so this restore brings the corruption back.",
    rNone: "No kept checkpoint is at or before the last passing check (kept: {list}). A clean restore needs an older archive or a restart.",
    rAll: "All {r} kept checkpoints ({list}) were written after step {s}: by the time anything notices, no clean checkpoint is left.",
    rSome: "Kept checkpoints: {list}; {n} of them hold corrupted state, and nothing tells the operator which.",
    describe: "Corruption begins at step {s}. {det} {rb}",
    dYes: "A check fires at step {t}, {lag} steps later.",
    dNo: "No check fires within {t} steps.",
    bClean: "The rollback restores clean checkpoint {c}.",
    bDirty: "The rollback restores checkpoint {c}, which is already corrupted.",
    bNone: "No kept checkpoint can be trusted.",
  },
  zh: {
    title: "静默损坏、检测与回滚点",
    rowState: "模型状态（运维方看不到这一行）",
    clean: "正常",
    corrupt: "已损坏",
    halted: "已停止",
    notRun: "未运行",
    rowChecks: "每 {k} 步做一次正确性检查，覆盖率 {c}",
    rowLoss: "只看损失曲线：权重漂移时它不变",
    rowView: "运维方能从检查结果推断出什么",
    trusted: "视为正常",
    unknown: "无法判断",
    known: "确认损坏",
    noSignal: "没有信号，视为正常",
    rowCkpt: "每 {k} 步写一次检查点，只保留最新 {r} 个",
    lgPass: "检查通过",
    lgMiss: "状态已损坏但检查通过",
    lgFire: "检查报警",
    lgKept: "保留",
    lgKeptBad: "保留，但内容已损坏",
    lgGone: "已删除",
    sMark: "s = {s}",
    fire: "第 {t} 步报警",
    target: "恢复 {t}",
    replay: "丢弃 {n} 步",
    x: "训练步",
    rStart: "第 {s} 步起状态已损坏，但没有任何报错。",
    rDetect: "第 {t} 步的检查报警，比损坏晚 {lag} 步。上一次通过的检查在第 {lp} 步，因此第一个损坏的状态落在第 {a} 到第 {t} 步之间。",
    rDetectPart: "第 {t} 步的检查报警，比损坏晚 {lag} 步。上一次通过是在第 {lp} 步，但覆盖率不足 1 的检查在状态损坏后仍可能通过，所以检查结果只能说明损坏始于第 {t} 步之前。",
    rNoDetect: "到第 {t} 步为止，没有任何检查报警。",
    rClean: "恢复检查点 {c} 可以回到正常状态，丢弃 {n} 步的计算。",
    rDirty: "检查点 {c} 是上次通过的检查之前最新的保留检查点，但它写于第 {s} 步之后：覆盖率不足 1 的检查在状态已损坏时仍然通过，按这条规则恢复会把损坏带回来。",
    rNone: "保留的检查点都晚于上一次通过的检查（保留：{list}）。要恢复到正常状态，只能找更早的存档或从头重启。",
    rAll: "保留的 {r} 个检查点（{list}）都写于第 {s} 步之后：等到有人察觉时，已经没有正常的检查点。",
    rSome: "保留的检查点：{list}；其中 {n} 个已经损坏，而运维方无从分辨是哪几个。",
    describe: "第 {s} 步起状态损坏。{det}{rb}",
    dYes: "第 {t} 步的检查报警，晚了 {lag} 步。",
    dNo: "{t} 步内没有检查报警。",
    bClean: "回滚恢复到正常的检查点 {c}。",
    bDirty: "回滚恢复的检查点 {c} 已经损坏。",
    bNone: "没有可以信任的保留检查点。",
  },
};
type L = typeof labels.en;

const list = (xs: number[], lang: Lang) => xs.map(int).join(lang === "zh" ? "、" : ", ");

function readout(p: P, o: Outcome, L: L, lang: Lang): Array<{ s: string; flag?: "good" | "bad" }> {
  const out: Array<{ s: string; flag?: "good" | "bad" }> = [{ s: tpl(L.rStart, { s: p.s }) }];
  if (o.detected) {
    out.push({ s: tpl(p.coverage < 1 ? L.rDetectPart : L.rDetect, { t: o.halt, lag: o.halt - p.s, lp: o.lastPass, a: o.lastPass + 1 }) });
    if (o.target == null) out.push({ s: tpl(L.rNone, { list: list(o.retained, lang) }), flag: "bad" });
    else if (o.target >= p.s) out.push({ s: tpl(L.rDirty, { c: o.target, s: p.s }), flag: "bad" });
    else out.push({ s: tpl(L.rClean, { c: o.target, n: o.halt - o.target }), flag: "good" });
  } else {
    out.push({ s: tpl(L.rNoDetect, { t: int(STEPS) }) });
    const bad = o.retained.filter((c) => c >= p.s).length;
    if (bad === o.retained.length) out.push({ s: tpl(L.rAll, { r: o.retained.length, list: list(o.retained, lang), s: p.s }), flag: "bad" });
    else out.push({ s: tpl(L.rSome, { list: list(o.retained, lang), n: bad }), flag: bad ? "bad" : undefined });
  }
  return out;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const o = outcome(p);
  const det = o.detected ? tpl(L.dYes, { t: o.halt, lag: o.halt - p.s }) : tpl(L.dNo, { t: int(STEPS) });
  const rb = !o.detected || o.target == null ? L.bNone : o.target >= p.s ? tpl(L.bDirty, { c: o.target }) : tpl(L.bClean, { c: o.target });
  return tpl(L.describe, { s: p.s, det, rb });
}

// Markers used both in the rows and in the legend.
// Checkpoint squares take a half-size `h`, smaller on a phone column so
// markers every 20 steps stay apart.
const mark = {
  pass: (x: number, y: number, r = 4.5) => el("circle", { cx: x, cy: y, r, fill: C.paper, stroke: C.ink2, "stroke-width": 1.5 }),
  miss: (x: number, y: number, r = 4.5) => el("circle", { cx: x, cy: y, r, fill: C.paper, stroke: C.bad, "stroke-width": 2 }),
  fire: (x: number, y: number, r = 4.5) => el("circle", { cx: x, cy: y, r: r + 1, fill: C.bad, stroke: C.paper, "stroke-width": 1.5 }),
  kept: (x: number, y: number, h = 5) => el("rect", { x: x - h, y: y - h, width: 2 * h, height: 2 * h, rx: 1.5, fill: C.ink2 }),
  keptBad: (x: number, y: number, pat: string, h = 5) => el("rect", { x: x - h, y: y - h, width: 2 * h, height: 2 * h, rx: 1.5, fill: `url(#${pat})`, stroke: C.ink, "stroke-width": 1.5 }),
  gone: (x: number, y: number, h = 4.5) => el("rect", { x: x - h, y: y - h, width: 2 * h, height: 2 * h, rx: 1.5, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "2 1.5" }),
};

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const o = outcome(p);
  const pat = `${st.uid}-sdc-bad`;
  const parts: string[] = [el("defs", {}, hatch(pat, C.bad, 5, 1.6))];
  const x0 = 6, x1 = w - 6;
  const x = linear([0, STEPS], [x0, x1]);
  const rowH = 20;
  let y = 0;

  // Legend, drawn here because it needs hollow and hatched markers.
  const items: Array<[string, (x: number, y: number) => string]> = [
    [L.lgPass, mark.pass], [L.lgMiss, mark.miss], [L.lgFire, mark.fire],
    [L.lgKept, mark.kept], [L.lgKeptBad, (a, b) => mark.keptBad(a, b, pat)], [L.lgGone, mark.gone],
  ];
  let lx = 0, ly = y + 12;
  for (const [name, m] of items) {
    const iw = 16 + textWidth(name, TYPE.body);
    if (lx > 0 && lx + iw > w) { lx = 0; ly += 20; }
    parts.push(m(lx + 6, ly - 4), text(lx + 16, ly, name, { "font-size": TYPE.body }));
    lx += iw + 16;
  }
  y = ly + 16;

  const sx = x(p.s), hx = x(o.halt);
  const rows: Array<{ top: number; h: number }> = [];
  const title = (s: string) => { parts.push(text(0, y + 13, s, { "font-size": TYPE.body, class: "fig-t-strong" })); y += 20; };
  const inBand = (a: number, b: number, s: string, yy: number, cls = "fig-t-halo"): boolean => {
    if (x(b) - x(a) <= textWidth(s, TYPE.body) + 10) return false;
    parts.push(text((x(a) + x(b)) / 2, yy, s, { "font-size": TYPE.body, "text-anchor": "middle", class: cls }));
    return true;
  };

  // Row 1: the truth, with the first corrupted step named above it.
  title(L.rowState);
  const sl = tpl(L.sMark, { s: p.s });
  const slw = textWidth(sl, TYPE.body);
  parts.push(text(Math.min(Math.max(sx, x0 + slw / 2), x1 - slw / 2), y + 10, sl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
  y += 18;
  const r1 = y;
  parts.push(el("rect", { x: x0, y: r1, width: x1 - x0, height: rowH, fill: C.panel }));
  parts.push(el("rect", { x: x0, y: r1, width: sx - x0, height: rowH, fill: C.ink3, "fill-opacity": 0.3 }));
  if (o.halt > p.s || (o.halt === p.s && o.detected)) parts.push(el("rect", { x: sx, y: r1, width: Math.max(1, hx - sx), height: rowH, fill: `url(#${pat})` }));
  inBand(0, p.s, L.clean, r1 + 14);
  inBand(p.s, o.halt, L.corrupt, r1 + 14);
  if (o.halt < STEPS) inBand(o.halt, STEPS, L.notRun, r1 + 14, "fig-t-muted");
  rows.push({ top: r1, h: rowH });
  y += rowH + 12;

  // Row 2: the checks or the loss curve.
  if (p.cadence === "loss") {
    title(L.rowLoss);
    const r2 = y, h2 = 34;
    const ly2 = linear([1.8, 3.6], [r2 + h2, r2]);
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= STEPS; s += 10) pts.push([x(s), ly2(2 + 1.5 * Math.exp(-s / 260))]);
    parts.push(el("rect", { x: x0, y: r2, width: x1 - x0, height: h2, fill: C.panel }));
    parts.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink2, "stroke-width": 1.75 }));
    rows.push({ top: r2, h: h2 });
    y += h2 + 12;
  } else {
    title(tpl(L.rowChecks, { k: p.cadence, c: `${Math.round(p.coverage * 100)}%` }));
    const r2 = y, cy = r2 + rowH / 2;
    parts.push(el("line", { x1: x0, x2: x1, y1: cy, y2: cy, stroke: C.rule, "stroke-width": 1 }));
    for (const c of o.checks) {
      const cx = x(c.step);
      const cr = !narrow ? 4.5 : p.cadence === "20" ? 2.5 : 3.5; // markers 6 px apart at every 20 steps on a phone
      parts.push(c.fired ? mark.fire(cx, cy, cr) : c.step >= p.s ? mark.miss(cx, cy, cr) : mark.pass(cx, cy, cr));
    }
    if (o.detected) {
      const s = tpl(L.fire, { t: o.halt });
      const tw = textWidth(s, TYPE.body);
      const right = hx + 10 + tw <= x1;
      parts.push(text(right ? hx + 10 : hx - 10, cy + 4, s, { "font-size": TYPE.body, "text-anchor": right ? "start" : "end", class: "fig-t-halo fig-t-num" }));
    }
    rows.push({ top: r2, h: rowH });
    y += rowH + 12;
  }

  // Row 3: the operator's inference.
  title(L.rowView);
  const r3 = y;
  const lp = x(o.lastPass);
  parts.push(el("rect", { x: x0, y: r3, width: x1 - x0, height: rowH, fill: C.panel }));
  if (o.detected) {
    parts.push(el("rect", { x: x0, y: r3, width: lp - x0, height: rowH, fill: C.good, "fill-opacity": 0.3 }));
    parts.push(el("rect", { x: lp, y: r3, width: hx - lp, height: rowH, fill: C.warn, "fill-opacity": 0.45 }));
    parts.push(el("rect", { x: hx, y: r3, width: Math.max(2, 3), height: rowH, fill: C.bad }));
    let fit = inBand(0, o.lastPass, L.trusted, r3 + 14);
    fit = inBand(o.lastPass, o.halt, L.unknown, r3 + 14) && fit;
    if (o.halt < STEPS && x1 - hx > textWidth(L.known, TYPE.body) + 14) parts.push(text(hx + 8, r3 + 14, L.known, { "font-size": TYPE.body, class: "fig-t-halo" }));
    else fit = false;
    if (!fit) {
      // A key under the row names the bands that were too narrow to label.
      let kx = x0;
      const ky3 = r3 + rowH + 16;
      for (const [name, fill, op] of [[L.trusted, C.good, 0.3], [L.unknown, C.warn, 0.45], [L.known, C.bad, 1]] as const) {
        parts.push(el("rect", { x: kx, y: ky3 - 10, width: 12, height: 10, rx: 1.5, fill, "fill-opacity": op }));
        parts.push(text(kx + 17, ky3, name, { "font-size": TYPE.body }));
        kx += 17 + textWidth(name, TYPE.body) + 14;
      }
      y += 20;
    }
  } else {
    parts.push(el("rect", { x: x0, y: r3, width: x1 - x0, height: rowH, fill: C.good, "fill-opacity": 0.3 }));
    inBand(0, STEPS, L.noSignal, r3 + 14);
  }
  rows.push({ top: r3, h: rowH });
  y += rowH + 12;

  // Row 4: checkpoints.
  title(tpl(L.rowCkpt, { k: p.every, r: p.retain }));
  const r4 = y, ky = r4 + rowH / 2;
  parts.push(el("line", { x1: x0, x2: x1, y1: ky, y2: ky, stroke: C.rule, "stroke-width": 1 }));
  const kept = new Set(o.retained);
  for (const c of o.written) {
    const cx = x(c);
    const h = !narrow ? 5 : p.every === 20 ? 2.75 : 3.5;
    parts.push(!kept.has(c) ? mark.gone(cx, ky, h - 0.5) : c >= p.s ? mark.keptBad(cx, ky, pat, h) : mark.kept(cx, ky, h));
  }
  let extra = 0;
  if (o.target != null) {
    const tx = x(o.target);
    parts.push(el("circle", { cx: tx, cy: ky, r: 9, fill: "none", stroke: C.ink, "stroke-width": 2 }));
    // The work the restore discards, bracketed under the row.
    const by = r4 + rowH + 8;
    parts.push(el("path", { d: `M${tx},${by - 4} L${tx},${by} L${hx},${by} L${hx},${by - 4}`, fill: "none", stroke: C.ink, "stroke-width": 1.25 }));
    const lbl = `${tpl(L.target, { t: o.target })}, ${tpl(L.replay, { n: o.halt - o.target })}`.replace(", ", lang === "zh" ? "，" : ", ");
    const tw = textWidth(lbl, TYPE.body);
    const mid = Math.min(Math.max((tx + hx) / 2, x0 + tw / 2), x1 - tw / 2);
    parts.push(text(mid, by + 16, lbl, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong fig-t-num" }));
    extra = 24;
  }
  rows.push({ top: r4, h: rowH });
  y += rowH + 8 + extra;

  // The first corrupted step, drawn through every row for the reader only
  // (not through the row titles).
  for (const r of rows) parts.push(el("line", { x1: sx, x2: sx, y1: r.top - 4, y2: r.top + r.h + 4, stroke: C.bad, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));

  // Axis.
  parts.push(axis({ scale: x, orient: "bottom", at: y + 4, ticks: x.ticks(narrow ? 4 : 10), title: L.x, size: TYPE.body, format: (v) => int(v) }));
  y += 4 + axisHeight(true, TYPE.body) + 16;

  // Readout.
  for (const line of readout(p, o, L, lang)) {
    const ind = line.flag ? 16 : 0;
    const lines = wrap(line.s, TYPE.body, w - ind);
    if (line.flag) parts.push(el("rect", { x: 0, y: y - 9, width: 9, height: 9, rx: 1.5, fill: line.flag === "good" ? C.good : C.bad }));
    lines.forEach((ln, i) => parts.push(text(ind, y + i * 17, ln, { "font-size": TYPE.body, class: line.flag ? "fig-t-num fig-t-strong" : "fig-t-num" })));
    y += lines.length * 17 + 6;
  }
  return svg(w, y, describe(st, lang), g({ class: "fig-sdc" }, ...parts));
}

export default defineFigure({
  name: "sdc-rollback",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    s: { kind: "range", label: { en: "First corrupted step s", zh: "首个损坏步 s" }, min: 20, max: 980, step: 1, default: 430 },
    cadence: {
      kind: "choice", control: "buttons", label: { en: "Correctness check", zh: "正确性检查" }, default: "50",
      options: [
        { value: "20", label: { en: "every 20 steps", zh: "每 20 步" } },
        { value: "50", label: { en: "every 50", zh: "每 50 步" } },
        { value: "100", label: { en: "every 100", zh: "每 100 步" } },
        { value: "loss", label: { en: "loss curve only", zh: "只看损失曲线" } },
      ],
    },
    coverage: { kind: "range", label: { en: "Coverage per check", zh: "单次检查覆盖率" }, min: 0.1, max: 1, step: 0.05, default: 1 },
    every: {
      kind: "choice", label: { en: "Checkpoint every", zh: "检查点间隔" }, default: 40,
      options: [
        { value: 20, label: { en: "20 steps", zh: "20 步" } },
        { value: 40, label: { en: "40 steps", zh: "40 步" } },
        { value: 100, label: { en: "100 steps", zh: "100 步" } },
      ],
    },
    retain: {
      kind: "choice", label: { en: "Checkpoints kept", zh: "保留检查点数" }, default: 3,
      options: [
        { value: 2, label: { en: "2", zh: "2" } },
        { value: 3, label: { en: "3", zh: "3" } },
        { value: 5, label: { en: "5", zh: "5" } },
        { value: 10, label: { en: "10", zh: "10" } },
      ],
    },
    seed: { kind: "range", label: { en: "Check seed", zh: "检查种子" }, min: 1, max: 999, step: 1, default: 1, control: false },
  },
  render,
  describe,
});
