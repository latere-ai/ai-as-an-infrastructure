// Selected relationships among the twelve substantive parts of the book, for
// the field-map chapter. Solid arrows are technical dependencies (the upper
// part needs an artifact or property the lower part supplies); dashed arrows
// are representative feedback or cross-cutting constraints. Arrows point from
// the part that supplies or constrains to the part that depends on it. The
// layout is layered by dependency, not by reading order: Part IX sits under
// Part I because hardware constrains training.
//
// Selecting a part (the control, or a click on its box) highlights the edges
// that touch it and lists them by direction, so a reader entering mid-book can
// see what a part needs and what it feeds.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapLines } from "./lib/wrap-lines.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- the map

type PartId = "I" | "II" | "III" | "IV" | "V" | "VI" | "VII" | "VIII" | "IX" | "X" | "XI" | "XII";

interface Part { id: PartId; n: number; row: number; col: number; en: string; zh: string }

// Rows count up from the base of the map; columns are left, center, right.
// A "|" in a zh name marks where it may break inside a narrow box.
const PARTS: readonly Part[] = [
  { id: "I", n: 1, row: 1, col: 1, en: "Base Model Formation", zh: "基座模型|的形成" },
  { id: "II", n: 2, row: 2, col: 0, en: "Generative and Multimodal", zh: "生成式|与多模态" },
  { id: "III", n: 3, row: 2, col: 1, en: "Post-Training", zh: "后训练" },
  { id: "IV", n: 4, row: 3, col: 1, en: "Reasoning and Test-Time Compute", zh: "推理与|测试时算力" },
  { id: "V", n: 5, row: 2, col: 2, en: "Inference and Serving", zh: "推断|与服务" },
  { id: "VI", n: 6, row: 4, col: 1, en: "Orchestration", zh: "编排" },
  { id: "VII", n: 7, row: 5, col: 0, en: "Evaluation", zh: "评测" },
  { id: "VIII", n: 8, row: 5, col: 2, en: "Safety, Interpretability, Governance", zh: "安全、|可解释性|与治理" },
  { id: "IX", n: 9, row: 0, col: 1, en: "Infrastructure and Compute", zh: "基础设施|与算力" },
  { id: "X", n: 10, row: 0, col: 0, en: "Frontiers and Limits", zh: "前沿|与极限" },
  { id: "XI", n: 11, row: 0, col: 2, en: "Ecosystem and Economics", zh: "生态|与经济" },
  { id: "XII", n: 12, row: 6, col: 1, en: "Practice and Operations", zh: "实践|与运营" },
];
const ROWS = 7;
const byId = new Map(PARTS.map((p) => [p.id, p]));
const nameOf = (p: Part, lang: Lang) => (lang === "zh" ? p.zh.replace(/\|/g, "") : p.en);

type Kind = "dep" | "feedback";
// `route` names the two edges that are not a straight segment between
// neighboring boxes.
interface Edge { from: PartId; to: PartId; kind: Kind; route?: "left-gutter" | "right-side" }
const EDGES: readonly Edge[] = [
  { from: "IX", to: "I", kind: "dep" },
  { from: "I", to: "II", kind: "dep" },
  { from: "I", to: "III", kind: "dep" },
  { from: "I", to: "V", kind: "dep" },
  { from: "III", to: "IV", kind: "dep" },
  { from: "IV", to: "VI", kind: "dep" },
  { from: "V", to: "VI", kind: "dep", route: "right-side" },
  { from: "VI", to: "VII", kind: "dep" },
  { from: "VI", to: "XII", kind: "dep" },
  { from: "VII", to: "XII", kind: "dep" },
  { from: "VII", to: "III", kind: "feedback", route: "left-gutter" },
  { from: "VIII", to: "VI", kind: "feedback" },
  { from: "XI", to: "V", kind: "feedback" },
  { from: "X", to: "I", kind: "feedback" },
];

const labels = {
  en: {
    title: "Selected dependencies among the twelve parts",
    part: "Part {r}",
    partName: "Part {r}, {t}",
    partItem: "Part {r}, {t}",
    lgDep: "technical dependency",
    lgFeedback: "feedback or cross-cutting constraint",
    lgDir: "arrows point from the part that supplies or constrains to the part that depends on it",
    needs: "Needs: {list}",
    supplies: "Supplies: {list}",
    constrainedBy: "Constrained by: {list}",
    constrains: "Constrains or feeds back into: {list}",
    none: "Select a part to trace what it needs, what it supplies, and what constrains it.",
    describeAll: "Twelve parts of the book joined by {d} technical dependencies and {f} feedback or constraint relations; Part IX sits at the base under Part I and Part XII at the top.",
    describePart: "Part {r}, {t}. {rest}",
    nothing: "No drawn relation.",
  },
  zh: {
    title: "全书十二个部分之间的主要依赖关系",
    part: "第{r}部分",
    partName: "第{r}部分：{t}",
    partItem: "第{r}部分（{t}）",
    lgDep: "技术依赖",
    lgFeedback: "反馈或贯穿性约束",
    lgDir: "箭头从提供或施加约束的部分指向依赖它的部分",
    needs: "依赖：{list}",
    supplies: "支撑：{list}",
    constrainedBy: "受约束于：{list}",
    constrains: "约束或反馈到：{list}",
    none: "选中某一部分，可以查看它依赖什么、支撑什么，以及受哪些约束。",
    describeAll: "全书十二个部分之间画出 {d} 条技术依赖和 {f} 条反馈或约束关系；第九部分位于底部、第一部分之下，第十二部分位于顶部。",
    describePart: "第{r}部分：{t}。{rest}",
    nothing: "图中没有画出与它相关的关系。",
  },
};

const ROMAN: Record<PartId, string> = { I: "I", II: "II", III: "III", IV: "IV", V: "V", VI: "VI", VII: "VII", VIII: "VIII", IX: "IX", X: "X", XI: "XI", XII: "XII" };
const ZH_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const numeral = (p: Part, lang: Lang) => (lang === "zh" ? ZH_NUM[p.n] : ROMAN[p.id]);

type Sel = "none" | PartId;
type P = { part: Sel };

// The relations of one part, grouped the way the readout lists them.
function relations(id: PartId) {
  const pick = (k: Kind, dir: "in" | "out") => EDGES
    .filter((e) => e.kind === k && (dir === "in" ? e.to === id : e.from === id))
    .map((e) => byId.get(dir === "in" ? e.from : e.to)!)
    .sort((a, b) => a.n - b.n);
  return { needs: pick("dep", "in"), supplies: pick("dep", "out"), constrainedBy: pick("feedback", "in"), constrains: pick("feedback", "out") };
}

function listLine(key: "needs" | "supplies" | "constrainedBy" | "constrains", ps: Part[], lang: Lang): string {
  const L = labels[lang];
  const item = (p: Part) => tpl(L.partItem, { r: numeral(p, lang), t: nameOf(p, lang) });
  return tpl(L[key], { list: ps.map(item).join(lang === "zh" ? "、" : "; ") });
}

function relationLines(id: PartId, lang: Lang): string[] {
  const L = labels[lang];
  const r = relations(id);
  const out: string[] = [];
  for (const key of ["needs", "supplies", "constrainedBy", "constrains"] as const) {
    if (r[key].length) out.push(listLine(key, r[key], lang));
  }
  return out;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const sel = st.p.part;
  if (sel === "none") {
    return tpl(L.describeAll, { d: EDGES.filter((e) => e.kind === "dep").length, f: EDGES.filter((e) => e.kind === "feedback").length });
  }
  const p = byId.get(sel)!;
  const lines = relationLines(sel, lang);
  const sep = lang === "zh" ? "。" : ". ";
  return tpl(L.describePart, { r: numeral(p, lang), t: nameOf(p, lang), rest: lines.length ? lines.join(sep) + (lang === "zh" ? "。" : ".") : L.nothing });
}

// ---------------------------------------------------------------- layout

interface Box { x0: number; x1: number; y0: number; y1: number; cx: number; cy: number; head: string; lines: string[] }
type Pt = [number, number];

const PAD = 7; // inner padding of a box

// Column widths: each column is at least as wide as its longest unbreakable
// word plus padding, so no word runs past a border; the rest is shared.
function columns(w: number, lang: Lang, size: number, gap: number): Array<[number, number]> {
  const L = labels[lang];
  const need = [0, 1, 2].map((col) => Math.max(...PARTS.filter((p) => p.col === col).map((p) => {
    const units = lang === "zh" ? p.zh.split("|") : p.en.split(" ");
    return Math.max(textWidth(tpl(L.part, { r: numeral(p, lang) }), size), ...units.map((u) => textWidth(u, size))) + 2 * PAD;
  })));
  const slack = Math.max(0, w - 2 * gap - need.reduce((a, b) => a + b, 0));
  const out: Array<[number, number]> = [];
  let x = 0;
  for (const n of need) { out.push([x, x + n + slack / 3]); x += n + slack / 3 + gap; }
  return out;
}

function joinFit(segs: string[], size: number, avail: number): string[] {
  const out: string[] = [];
  for (const sgm of segs) {
    if (out.length && textWidth(out[out.length - 1] + sgm, size) <= avail) out[out.length - 1] += sgm;
    else out.push(sgm);
  }
  return out;
}

function layout(w: number, lang: Lang) {
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.label;
  const pitch = size + 4;
  const gap = narrow ? 8 : 34; // between columns
  const rowGap = narrow ? 30 : 30; // between rows, where elbows turn
  const cols = columns(w, lang, size, gap);
  const L = labels[lang];
  const text0 = new Map<PartId, { head: string; lines: string[] }>();
  for (const p of PARTS) {
    const [x0, x1] = cols[p.col];
    const avail = x1 - x0 - 2 * PAD;
    // zh names break only at their marked points, joining segments while they fit.
    const lines = lang === "zh" ? joinFit(p.zh.split("|"), size, avail) : wrap(p.en, size, avail);
    text0.set(p.id, { head: tpl(L.part, { r: numeral(p, lang) }), lines });
  }
  // Each row is as tall as its tallest box; rows stack from the top row down.
  const rowH = Array.from({ length: ROWS }, (_, r) => Math.max(...PARTS.filter((p) => p.row === r).map((p) => (1 + text0.get(p.id)!.lines.length) * pitch + 2 * PAD - 2)));
  const rowTop: number[] = new Array(ROWS);
  let y = 0;
  for (let r = ROWS - 1; r >= 0; r--) { rowTop[r] = y; y += rowH[r] + rowGap; }
  const boxes = new Map<PartId, Box>();
  for (const p of PARTS) {
    const [x0, x1] = cols[p.col];
    const y0 = rowTop[p.row], y1 = y0 + rowH[p.row];
    boxes.set(p.id, { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ...text0.get(p.id)! });
  }
  return { boxes, height: y - rowGap, size, pitch, rowGap, narrow };
}

// Orthogonal route of one edge. Edges leave the top of the supplying box and
// enter the bottom of the dependent one, turning in the gap just above the
// source; the two exceptions are routed around the boxes between them.
function route(e: Edge, B: Map<PartId, Box>, rowGap: number): Pt[] {
  const a = B.get(e.from)!, b = B.get(e.to)!;
  const off = Math.min(22, (a.x1 - a.x0) * 0.2);
  const up = byId.get(e.to)!.row > byId.get(e.from)!.row;
  if (e.route === "right-side") {
    // Up the empty right column, then into the side of the target.
    return [[a.cx, a.y0], [a.cx, b.cy], [b.x1, b.cy]];
  }
  if (e.route === "left-gutter") {
    // Down the empty left column to the gap above the target row.
    const x = a.x0 + off;
    const ym = b.y0 - rowGap / 2;
    const ex = b.x0 + off;
    return [[x, a.y1], [x, ym], [ex, ym], [ex, b.y0]];
  }
  // Anchor x on each box: toward the other box when their columns differ.
  const pa = byId.get(e.from)!, pb = byId.get(e.to)!;
  const anchor = (box: Box, self: Part, other: Part) =>
    other.col === self.col ? box.cx : (other.col < self.col ? box.x0 + off : box.x1 - off);
  let sx = anchor(a, pa, pb), ex = anchor(b, pb, pa);
  // A side box meets a center box at the side box's center line.
  if (pa.col !== 1 && pb.col === 1) sx = a.cx;
  if (pb.col !== 1 && pa.col === 1) ex = b.cx;
  // Two edges enter Part V from below: keep them apart.
  if (e.to === "V" && e.from === "I") ex = b.cx - off;
  if (up) {
    if (Math.abs(sx - ex) < 0.5) return [[sx, a.y0], [ex, b.y1]];
    const ym = a.y0 - rowGap / 2;
    return [[sx, a.y0], [sx, ym], [ex, ym], [ex, b.y1]];
  }
  const ym = a.y1 + rowGap / 2;
  return [[sx, a.y1], [sx, ym], [ex, ym], [ex, b.y0]];
}

function arrowHead(pts: Pt[], color: string): string {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const s = 8, hw = 4.5;
  const bx = x1 - ux * s, by = y1 - uy * s;
  return el("path", { d: `M${x1},${y1}L${bx - uy * hw},${by + ux * hw}L${bx + uy * hw},${by - ux * hw}Z`, fill: color });
}

// The route shortened at its end so the stroke stops at the arrowhead's base.
function trimmed(pts: Pt[], by = 7): Pt[] {
  const out = pts.map((p) => [...p] as Pt);
  const n = out.length;
  const [x1, y1] = out[n - 1], [x0, y0] = out[n - 2];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  out[n - 1] = [x1 - ((x1 - x0) / len) * by, y1 - ((y1 - y0) / len) * by];
  return out;
}

const pathOf = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join("");

// ---------------------------------------------------------------- render

const IN = C.c1, OUT = C.c2; // edges into and out of the selected part

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const sel = st.p.part;
  const lay = layout(w, lang);
  const { boxes, size, pitch, narrow } = lay;
  const y0 = 4;
  const parts: string[] = [];
  const related = new Set<PartId>();
  if (sel !== "none") for (const e of EDGES) if (e.from === sel || e.to === sel) { related.add(e.from); related.add(e.to); }

  // Edges under the boxes; the selected part's edges drawn last, on top.
  const drawn = [...EDGES].sort((a, b) => Number(a.from === sel || a.to === sel) - Number(b.from === sel || b.to === sel));
  const edgeParts: string[] = [];
  for (const e of drawn) {
    const pts = route(e, boxes, lay.rowGap).map(([x, y]) => [x, y + y0] as Pt);
    const on = sel !== "none" && (e.from === sel || e.to === sel);
    const color = on ? (e.to === sel ? IN : OUT) : C.ink2;
    const dim = sel !== "none" && !on;
    edgeParts.push(g({ opacity: dim ? 0.3 : undefined },
      el("path", { d: pathOf(trimmed(pts)), fill: "none", stroke: color, "stroke-width": on ? 2.2 : 1.4, "stroke-dasharray": e.kind === "feedback" ? "5 4" : undefined, "stroke-linejoin": "round" }),
      arrowHead(pts, color)));
  }
  parts.push(g({ class: "fig-edges" }, ...edgeParts));

  for (const p of PARTS) {
    const b = boxes.get(p.id)!;
    const isSel = sel === p.id;
    const dim = sel !== "none" && !related.has(p.id);
    const inner: string[] = [];
    inner.push(el("rect", { x: b.x0, y: b.y0 + y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: 8, fill: C.panel, stroke: isSel ? C.ink : C.rule, "stroke-width": isSel ? 2 : 1 }));
    const nLines = 1 + b.lines.length;
    let ty = b.cy + y0 - ((nLines - 1) * pitch) / 2 + size * 0.35;
    inner.push(text(b.cx, ty, b.head, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" }));
    for (const ln of b.lines) {
      ty += pitch;
      inner.push(text(b.cx, ty, ln, { "font-size": size, "text-anchor": "middle", class: "fig-t-strong" }));
    }
    parts.push(g({ opacity: dim ? 0.45 : undefined, "data-fig-set": `part=${p.id}`, class: "fig-hit" }, ...inner));
  }

  // ---- legend and readout
  let yy = y0 + lay.height + 24;
  const fs = narrow ? TYPE.body : TYPE.small;
  const sample = (x: number, y: number, color: string, dashed: boolean) =>
    el("line", { x1: x, x2: x + 22, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 2, "stroke-dasharray": dashed ? "5 4" : undefined });
  const rp: string[] = [];
  const legendItems: Array<[string, boolean]> = [[L.lgDep, false], [L.lgFeedback, true]];
  let lx = 0;
  for (const [label, dashed] of legendItems) {
    const iw = 30 + textWidth(label, fs);
    if (lx > 0 && lx + iw > w) { lx = 0; yy += fs + 8; }
    rp.push(sample(lx, yy, C.ink2, dashed), text(lx + 30, yy, label, { "font-size": fs, class: "fig-t-muted" }));
    lx += iw + 18;
  }
  yy += fs + 8;
  for (const ln of wrapLines(L.lgDir, fs, w)) { rp.push(text(0, yy, ln, { "font-size": fs, class: "fig-t-muted" })); yy += fs + 5; }
  yy += 14;
  if (sel === "none") {
    for (const ln of wrapLines(L.none, TYPE.body, w)) { rp.push(text(0, yy, ln, { "font-size": TYPE.body })); yy += TYPE.body + 6; }
  } else {
    const p = byId.get(sel)!;
    rp.push(text(0, yy, tpl(L.partName, { r: numeral(p, lang), t: nameOf(p, lang) }), { "font-size": TYPE.label, class: "fig-t-strong" }));
    yy += TYPE.label + 10;
    const r = relations(sel);
    const groups: Array<[keyof typeof r, string, boolean]> = [["needs", IN, false], ["constrainedBy", IN, true], ["supplies", OUT, false], ["constrains", OUT, true]];
    for (const [key, color, dashed] of groups) {
      if (!r[key].length) continue;
      rp.push(sample(0, yy, color, dashed));
      const lines = wrapLines(listLine(key, r[key], lang), TYPE.body, w - 32);
      for (const ln of lines) { rp.push(text(32, yy, ln, { "font-size": TYPE.body })); yy += TYPE.body + 6; }
      yy += 4;
    }
    if (!r.needs.length && !r.supplies.length && !r.constrainedBy.length && !r.constrains.length) {
      rp.push(text(0, yy, L.nothing, { "font-size": TYPE.body, class: "fig-t-muted" })); yy += TYPE.body + 6;
    }
  }
  parts.push(g({ class: "fig-readout" }, ...rp));
  return svg(w, yy, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "part-dependencies",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    part: {
      kind: "choice", control: "select", label: { en: "Trace the relations of", zh: "查看关系" }, default: "none",
      options: [
        { value: "none", label: { en: "no part selected", zh: "不选择" } },
        ...PARTS.slice().sort((a, b) => a.n - b.n).map((p) => ({
          value: p.id,
          label: { en: tpl(labels.en.partName, { r: numeral(p, "en"), t: nameOf(p, "en") }), zh: tpl(labels.zh.partName, { r: numeral(p, "zh"), t: nameOf(p, "zh") }) },
        })),
      ],
    },
  },
  render,
  describe,
});
