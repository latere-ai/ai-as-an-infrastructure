// The three uses of oversight evidence as parallel paths into one deployment
// decision. Each path names the question its evidence answers, the quantity
// the chapter measures it by (the recovered gap R, judge accuracy against an
// unassisted baseline, and 1 − ASR with U under a declared threat model), and
// what the chapter says it cannot establish. The paths meet only at the
// decision, which also needs scope, risk, and authorization, so no path feeds
// another and none makes the decision.
//
// Desktop: three columns side by side with arrows converging on the decision.
// Phone: the three cards stacked, each branching into a shared bus on the left
// that runs down into the decision, so stacking does not read as a sequence.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { wrap } from "./lib/labels.ts";
import { tpl } from "./lib/format.ts";

type Job = "training" | "evaluation" | "control";
const JOBS: Job[] = ["training", "evaluation", "control"];

const labels = {
  en: {
    title: "Three uses of oversight evidence",
    measured: "measured by",
    limit: "does not establish",
    trainingT: "Training signal",
    trainingQ: "Can weak labels train a stronger student?",
    trainingM: "recovered gap R on the tested tasks",
    trainingL: "alignment beyond the tested tasks",
    evaluationT: "Evaluation evidence",
    evaluationQ: "Does assistance improve a weaker judge?",
    evaluationM: "judge accuracy against an unassisted baseline",
    evaluationL: "that it holds across domains and gaps",
    controlT: "Control evidence",
    controlQ: "Does the protocol prevent the outcome under attack?",
    controlM: "1 − ASR and U under a declared threat model",
    controlL: "that the model is aligned",
    decisionT: "Deployment decision",
    decisionB: "made separately; also needs scope, risk, and authorization",
    informs: "informs",
    describe: "Training signal, evaluation evidence, and control evidence are parallel paths that each inform a separate deployment decision, which also needs scope, risk, and authorization. Highlighted: {t}, measured by {m}; it does not establish {l}.",
  },
  zh: {
    title: "监督证据的三种用途",
    measured: "衡量指标",
    limit: "不能证明",
    trainingT: "训练信号",
    trainingQ: "弱标注能否训练出更强的学生模型？",
    trainingM: "受测任务上恢复的差距比例 R",
    trainingL: "受测任务之外的对齐",
    evaluationT: "评估证据",
    evaluationQ: "辅助能否改善较弱评判者的判断？",
    evaluationM: "评判准确率与无辅助基线的对比",
    evaluationL: "结论适用于任意领域和能力差距",
    controlT: "控制证据",
    controlQ: "协议能否在攻击下阻止不可接受的结果？",
    controlM: "声明威胁模型下的 1 − ASR 与 U",
    controlL: "模型已经对齐",
    decisionT: "部署决定",
    decisionB: "单独作出，还需要适用范围、风险评估与授权",
    informs: "提供信息",
    describe: "训练信号、评估证据与控制证据是三条平行路径，各自为单独作出的部署决定提供信息；部署决定还需要适用范围、风险评估与授权。当前突出显示：{t}，衡量指标为{m}，不能证明{l}。",
  },
};
type L = typeof labels.en;
type P = { focus: Job };

const field = (L: L, j: Job, k: "T" | "Q" | "M" | "L") => L[`${j}${k}` as keyof L];

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const j = st.p.focus;
  return tpl(L.describe, { t: field(L, j, "T"), m: field(L, j, "M"), l: field(L, j, "L") });
}

// One evidence card: title, question, and the two labeled rows. Returns the
// lines so every card can be sized before any is drawn.
function cardLines(L: L, j: Job, w: number, size: number) {
  const pad = 10;
  const inner = w - 2 * pad;
  return {
    title: wrap(field(L, j, "T"), TYPE.label, inner),
    q: wrap(field(L, j, "Q"), size, inner),
    m: wrap(field(L, j, "M"), size, inner),
    l: wrap(field(L, j, "L"), size, inner),
  };
}

function cardHeight(c: ReturnType<typeof cardLines>, size: number): number {
  const lh = size + 5;
  return 10 + c.title.length * (TYPE.label + 5) + 4 + c.q.length * lh + 8 + (size + 4) + c.m.length * lh + 6 + (size + 4) + c.l.length * lh + 6;
}

function drawCard(L: L, c: ReturnType<typeof cardLines>, x: number, y: number, w: number, h: number, on: boolean, j: Job, size: number): string {
  const pad = 10;
  const parts: string[] = [];
  parts.push(el("rect", { x, y, width: w, height: h, rx: 6, fill: C.panel, stroke: on ? C.ink : C.rule, "stroke-width": on ? 2 : 1, "data-fig-set": `focus=${j}`, class: "fig-hit" }));
  let yy = y + 10 + TYPE.label * 0.8;
  for (const ln of c.title) { parts.push(text(x + pad, yy, ln, { "font-size": TYPE.label, class: "fig-t-strong" })); yy += TYPE.label + 5; }
  yy += 4 - 5 + size;
  for (const ln of c.q) { parts.push(text(x + pad, yy, ln, { "font-size": size })); yy += size + 5; }
  yy += 8;
  parts.push(text(x + pad, yy, L.measured, { "font-size": size, class: "fig-t-faint" }));
  yy += size + 4;
  for (const ln of c.m) { parts.push(text(x + pad, yy, ln, { "font-size": size, class: on ? "fig-t-strong" : "fig-t-muted" })); yy += size + 5; }
  yy += 6;
  parts.push(text(x + pad, yy, L.limit, { "font-size": size, class: "fig-t-faint" }));
  yy += size + 4;
  for (const ln of c.l) { parts.push(text(x + pad, yy, ln, { "font-size": size, class: on ? "fig-t-strong" : "fig-t-muted" })); yy += size + 5; }
  return g({}, ...parts);
}

function arrow(uid: string, x1: number, y1: number, x2: number, y2: number, on: boolean): string {
  return el("line", { x1, y1, x2, y2, stroke: on ? C.ink : C.ink3, "stroke-width": on ? 2 : 1.3, "marker-end": `url(#${uid}-${on ? "on" : "off"})` });
}

function decision(L: L, x: number, y: number, w: number, size: number) {
  const pad = 12;
  const body = wrap(L.decisionB, size, w - 2 * pad);
  const h = 12 + TYPE.label + 6 + body.length * (size + 5) + 6;
  const parts = [el("rect", { x, y, width: w, height: h, rx: 6, fill: C.paper, stroke: C.ink2, "stroke-width": 1.5 })];
  let yy = y + 12 + TYPE.label * 0.8;
  parts.push(text(x + w / 2, yy, L.decisionT, { "font-size": TYPE.label, "text-anchor": "middle", class: "fig-t-strong" }));
  yy += TYPE.label + 6;
  for (const ln of body) { parts.push(text(x + w / 2, yy, ln, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" })); yy += size + 5; }
  return { svg: g({}, ...parts), h };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const focus = st.p.focus;
  const marker = (id: string, color: string) => el("marker", { id: `${st.uid}-${id}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
    el("path", { d: "M0,0L10,5L0,10Z", fill: color }));
  const parts: string[] = [el("defs", {}, marker("on", C.ink), marker("off", C.ink3))];
  let y = 0;
  if (!narrow) {
    const gap = 12;
    const colW = (w - 2 * gap) / 3;
    const cards = JOBS.map((j) => cardLines(L, j, colW, size));
    const h = Math.max(...cards.map((c) => cardHeight(c, size)));
    JOBS.forEach((j, i) => parts.push(drawCard(L, cards[i], i * (colW + gap), 0, colW, h, j === focus, j, size)));
    const dw = w * 0.62, dx = (w - dw) / 2, dy = h + 44;
    JOBS.forEach((j, i) => {
      const x1 = i * (colW + gap) + colW / 2;
      const x2 = dx + dw * (0.22 + 0.28 * i);
      parts.push(arrow(st.uid, x1, h + 2, x2, dy - 3, j === focus));
    });
    parts.push(text(w / 2 + 7, h + 27, L.informs, { "font-size": size, class: "fig-t-muted" }));
    const d = decision(L, dx, dy, dw, size);
    parts.push(d.svg);
    y = dy + d.h;
  } else {
    // Stacked cards branching into a bus on the left.
    const bus = 8, cx = 22, cw = w - cx;
    const tops: number[] = [];
    for (const j of JOBS) {
      const c = cardLines(L, j, cw, size);
      const h = cardHeight(c, size);
      tops.push(y + Math.min(28, h / 2));
      parts.push(drawCard(L, c, cx, y, cw, h, j === focus, j, size));
      y += h + 12;
    }
    const dy = y + 16;
    JOBS.forEach((j, i) => parts.push(el("line", { x1: cx, y1: tops[i], x2: bus, y2: tops[i], stroke: j === focus ? C.ink : C.ink3, "stroke-width": j === focus ? 2 : 1.3 })));
    parts.push(arrow(st.uid, bus, tops[0], bus, dy - 2, false));
    parts.push(text(cx, dy - 5, L.informs, { "font-size": size, class: "fig-t-halo fig-t-soft" }));
    const d = decision(L, 0, dy, w, size);
    parts.push(d.svg);
    y = dy + d.h;
  }
  return svg(w, y + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "oversight-evidence",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    focus: {
      kind: "choice", label: { en: "Highlight", zh: "突出显示" }, default: "control",
      options: [
        { value: "training", label: { en: "Training signal", zh: "训练信号" } },
        { value: "evaluation", label: { en: "Evaluation evidence", zh: "评估证据" } },
        { value: "control", label: { en: "Control evidence", zh: "控制证据" } },
      ],
    },
  },
  render,
  describe,
});
