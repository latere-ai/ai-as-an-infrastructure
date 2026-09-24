// The adversarial methods of this chapter placed on the application, by where
// the attacker's text enters, what the attack is trying to do, and what access
// it needs. The point the prose makes and a box chain cannot: a jailbreak and
// a prompt injection enter at different places and pursue different objectives,
// so a defense at one entry point does not cover the other.
//
// Entry points are the stages of one application turn: the user's own message,
// the system or developer prompt, a retrieved document, a tool result, and an
// image. Each method lights the entry points it uses. Objective is one of two:
// bypass the model's learned policy (a jailbreak), or take over the
// application's control flow with text the application treats as data (an
// injection). Access is what the attacker must be able to do: send one prompt,
// hold a conversation, plant content the application will read, or compute on a
// white-box copy of the model.
//
// Every attribute is from this chapter's prose and its cited sources
// (Perez et al. 2022, Zou et al. 2023 GCG, Greshake et al. 2023, Anil et al.
// 2024, Russinovich et al. 2024). No attack content is shown, only where an
// attack enters and what it needs.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Entry = "user" | "system" | "retrieved" | "tool" | "image";
const ENTRIES: Entry[] = ["user", "system", "retrieved", "tool", "image"];
type Method = "manual" | "optimized" | "manyshot" | "multiturn" | "injection";
const METHODS: Method[] = ["manual", "optimized", "manyshot", "multiturn", "injection"];
type Objective = "policy" | "control";
type Access = "one" | "conversation" | "plant" | "whitebox";

interface Spec {
  entries: Entry[]; // entry points the method uses
  objective: Objective;
  access: Access[]; // access the method requires
}
const SPEC: Record<Method, Spec> = {
  manual: { entries: ["user"], objective: "policy", access: ["one"] },
  optimized: { entries: ["user"], objective: "policy", access: ["one", "whitebox"] },
  manyshot: { entries: ["user"], objective: "policy", access: ["one"] },
  multiturn: { entries: ["user"], objective: "policy", access: ["conversation"] },
  injection: { entries: ["retrieved", "tool", "image"], objective: "control", access: ["plant"] },
};

const labels = {
  en: {
    title: "Where each attack enters and what it needs",
    entryLegend: "Entry points, in order",
    objectiveH: "Objective",
    accessH: "needs",
    method: "Method",
    user: "user message",
    system: "system or developer prompt",
    retrieved: "retrieved document",
    tool: "tool result",
    image: "image",
    userS: "user", systemS: "system", retrievedS: "document", toolS: "tool", imageS: "image",
    manual: "Manual and semantic",
    optimized: "Optimized suffix",
    manyshot: "Many-shot",
    multiturn: "Multi-turn",
    injection: "Indirect injection",
    policy: "bypass the model's policy",
    control: "take over the application's control flow",
    jailbreak: "jailbreak",
    inject: "prompt injection",
    one: "one prompt",
    conversation: "a conversation",
    plant: "plant content the app reads",
    whitebox: "a white-box model copy",
    objPolicy: "Objective: bypass the model's learned policy. This is a jailbreak.",
    objControl: "Objective: make text the application treats as data control its actions. This is a prompt injection.",
    describe: "{name} enters through {entries}. Its objective is to {obj}. It requires {access}.",
    andSep: ", ",
  },
  zh: {
    title: "每种攻击从哪里进入，需要什么",
    entryLegend: "进入点（按顺序）",
    objectiveH: "目标",
    accessH: "需要",
    method: "方法",
    user: "用户消息",
    system: "系统或开发者提示",
    retrieved: "检索文档",
    tool: "工具结果",
    image: "图像",
    userS: "用户", systemS: "系统", retrievedS: "文档", toolS: "工具", imageS: "图像",
    manual: "人工与语义",
    optimized: "优化后缀",
    manyshot: "多示例",
    multiturn: "多轮",
    injection: "间接注入",
    policy: "绕过模型的策略",
    control: "接管应用的控制流",
    jailbreak: "越狱",
    inject: "提示注入",
    one: "一次提示",
    conversation: "一次对话",
    plant: "植入应用会读取的内容",
    whitebox: "白盒模型副本",
    objPolicy: "目标：绕过模型学习得到的策略。这属于越狱。",
    objControl: "目标：让应用当作数据的文字控制其动作。这属于提示注入。",
    describe: "{name}从{entries}进入，目标是{obj}，需要{access}。",
    andSep: "、",
  },
};
type L = typeof labels.en;
type P = { method: Method };

const entryName = (L: L, e: Entry) => L[e];
const accessName = (L: L, a: Access) => L[a];

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const m = st.p.method;
  const sp = SPEC[m];
  const sep = L.andSep;
  return tpl(L.describe, {
    name: L[m],
    entries: sp.entries.map((e) => entryName(L, e)).join(sep),
    obj: sp.objective === "policy" ? L.policy : L.control,
    access: sp.access.map((a) => accessName(L, a)).join(sep),
  });
}

// ---------------------------------------------------------------- render

const Wr = (lang: Lang) => (s: string, size: number, w: number) => (lang === "zh" ? wrapCjk(s, size, w) : wrap(s, size, w));
const entryShort = (L: L, e: Entry) => L[`${e}S` as keyof L] as string;
const objCol = (o: Objective) => (o === "policy" ? C.c1 : C.c2);
const objTag = (L: L, o: Objective) => (o === "policy" ? L.jailbreak : L.inject);

// Desktop: methods as rows, entry points as five dot columns, an objective
// pill, and the access chips for the selected row below. Every method is on
// screen, so the objective split (four methods enter the user message to
// bypass policy, one enters the data channels to take over control flow) is
// visible at once. Phone: the same rows as stacked cards, entry points read
// against a legend of the five points in order.
function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const wrapAt = Wr(lang);
  const parts: string[] = [];
  let y = 4;

  if (!narrow) {
    // Column geometry.
    const nameW = Math.max(...METHODS.map((m) => textWidth(L[m], TYPE.body))) + 16;
    const objW = Math.max(...([L.jailbreak, L.inject].map((t) => textWidth(t, TYPE.small)))) + 22;
    const gridX = nameW;
    const gridW = w - nameW - objW - 12;
    const colW = gridW / ENTRIES.length;
    const headY = y + 10;
    // Entry-point headers.
    ENTRIES.forEach((e, i) => {
      const cx = gridX + (i + 0.5) * colW;
      parts.push(text(cx, headY, entryShort(L, e), { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-faint" }));
    });
    parts.push(text(w, headY, L.objectiveH, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-faint" }));
    y = headY + 8;
    const rowH = 30;
    METHODS.forEach((m, r) => {
      const sp = SPEC[m];
      const on = m === p.method;
      const ry = y + r * rowH;
      const col = objCol(sp.objective);
      if (on) parts.push(el("rect", { x: 0, y: ry, width: w, height: rowH, rx: 5, fill: col, "fill-opacity": 0.1 }));
      parts.push(el("rect", { x: 0, y: ry, width: w, height: rowH, fill: "transparent", "data-fig-set": `method=${m}`, class: "fig-hit" }));
      parts.push(text(4, ry + rowH / 2 + 4, L[m], { "font-size": TYPE.body, class: on ? "fig-t-strong" : undefined }));
      ENTRIES.forEach((e, i) => {
        const cx = gridX + (i + 0.5) * colW, cy = ry + rowH / 2;
        if (sp.entries.includes(e)) parts.push(el("circle", { cx, cy, r: 6, fill: col, stroke: C.paper, "stroke-width": 1.5 }));
        else parts.push(el("circle", { cx, cy, r: 3, fill: C.panel, stroke: C.grid, "stroke-width": 1 }));
      });
      // Objective pill on the right.
      const t = objTag(L, sp.objective);
      const pw = textWidth(t, TYPE.small) + 18, px = w - pw;
      parts.push(el("rect", { x: px, y: ry + rowH / 2 - 9, width: pw, height: 18, rx: 9, fill: col, "fill-opacity": on ? 0.22 : 0.12, stroke: on ? col : "none", "stroke-width": 1 }));
      parts.push(text(px + pw / 2, ry + rowH / 2 + 4, t, { "font-size": TYPE.small, "text-anchor": "middle", class: on ? "fig-t-strong" : "fig-t-muted" }));
      parts.push(el("line", { x1: 0, x2: w, y1: ry + rowH, y2: ry + rowH, stroke: C.grid, "stroke-width": 1 }));
    });
    y += METHODS.length * rowH + 14;
    y = detail(parts, L, p.method, 0, y, w, wrapAt);
  } else {
    // Legend of the five entry points, then a card per method.
    parts.push(text(0, y + 10, L.entryLegend, { "font-size": TYPE.small, class: "fig-t-faint" }));
    y += 16;
    let lx = 0, ly = y;
    ENTRIES.forEach((e, i) => {
      const t = `${i + 1} ${entryShort(L, e)}`;
      const cw = textWidth(t, TYPE.small) + 16;
      if (lx > 0 && lx + cw > w) { lx = 0; ly += 18; }
      parts.push(el("circle", { cx: lx + 5, cy: ly + 6, r: 3, fill: C.ink3 }));
      parts.push(text(lx + 12, ly + 10, t, { "font-size": TYPE.small, class: "fig-t-muted" }));
      lx += cw + 8;
    });
    y = ly + 24;
    const cardH = 54;
    METHODS.forEach((m) => {
      const sp = SPEC[m];
      const on = m === p.method;
      const col = objCol(sp.objective);
      parts.push(el("rect", { x: 0, y, width: w, height: cardH, rx: 6, fill: on ? col : C.panel, "fill-opacity": on ? 0.12 : 1, stroke: on ? col : C.rule, "stroke-width": on ? 2 : 1, "data-fig-set": `method=${m}`, class: "fig-hit" }));
      parts.push(text(10, y + 20, L[m], { "font-size": TYPE.body, class: on ? "fig-t-strong" : undefined }));
      const t = objTag(L, sp.objective), pw = textWidth(t, TYPE.small) + 18;
      parts.push(el("rect", { x: w - pw - 8, y: y + 9, width: pw, height: 18, rx: 9, fill: col, "fill-opacity": 0.2 }));
      parts.push(text(w - pw / 2 - 8, y + 22, t, { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
      ENTRIES.forEach((e, i) => {
        const cx = 12 + i * 22, cy = y + 40;
        const lit = sp.entries.includes(e);
        parts.push(el("circle", { cx, cy, r: lit ? 6 : 3, fill: lit ? col : C.panel, stroke: lit ? C.paper : C.grid, "stroke-width": lit ? 1.5 : 1 }));
        if (lit) parts.push(text(cx, cy + 3.5, String(i + 1), { "font-size": 8, "text-anchor": "middle", class: "fig-t-halo" }));
      });
      y += cardH + 8;
    });
    y = detail(parts, L, p.method, 0, y + 4, w, wrapAt);
  }
  return svg(w, y + 4, describe(st, lang), g({ class: "fig-attack-surfaces" }, ...parts));
}

// The selected method's objective sentence and access chips.
function detail(parts: string[], L: L, m: Method, x: number, y: number, w: number, wrapAt: (s: string, size: number, w: number) => string[]): number {
  const sp = SPEC[m];
  const col = objCol(sp.objective);
  const objText = sp.objective === "policy" ? L.objPolicy : L.objControl;
  const lines = wrapAt(objText, TYPE.body, w - 16);
  const h = 12 + lines.length * (TYPE.body + 5) + 6;
  parts.push(el("rect", { x, y, width: w, height: h, rx: 6, fill: col, "fill-opacity": 0.12, stroke: col, "stroke-width": 1.5 }));
  let oy = y + 12 + TYPE.body * 0.7;
  for (const ln of lines) { parts.push(text(x + 10, oy, ln, { "font-size": TYPE.body })); oy += TYPE.body + 5; }
  y += h + 12;
  parts.push(text(x, y + 10, L.accessH, { "font-size": TYPE.small, class: "fig-t-faint" }));
  let ax = x + textWidth(L.accessH, TYPE.small) + 12, ay = y;
  for (const a of sp.access) {
    const t = accessName(L, a), cw = textWidth(t, TYPE.body) + 22;
    if (ax > x && ax + cw > x + w) { ax = x; ay += 30; }
    parts.push(el("rect", { x: ax, y: ay, width: cw, height: 24, rx: 12, fill: C.panel, stroke: C.rule, "stroke-width": 1 }));
    parts.push(el("circle", { cx: ax + 11, cy: ay + 12, r: 3, fill: C.ink2 }));
    parts.push(text(ax + 18, ay + 16, t, { "font-size": TYPE.body }));
    ax += cw + 8;
  }
  return ay + 24;
}

export default defineFigure({
  name: "attack-surfaces",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    method: {
      kind: "choice", label: { en: "Method", zh: "方法" }, default: "injection", control: "buttons",
      options: METHODS.map((m) => ({ value: m, label: { en: labels.en[m], zh: labels.zh[m] } })),
    },
  },
  render,
  describe,
});
