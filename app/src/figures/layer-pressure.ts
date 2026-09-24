// Five layers of the stack against the three pressures the book judges a
// design by, with the resource or property that binds in each cell. The
// outlined cell in each column is where the chapter argues that pressure binds
// hardest: capability in pre-training, efficiency in serving, trust in the
// agent runtime. That emphasis is the chapter's reading, not a measurement,
// and the caption says so. Choosing a layer shows, for the chapter's
// bug-fixing task, why each of its three constraints binds and which chapter
// develops it.
//
// Desktop: layer names in a column left of the grid. Phone: each layer's name
// runs above its row, so the three cells take the full column width. The
// chosen layer's details follow the grid in both.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { tpl } from "./lib/format.ts";

type Layer = "data" | "pretrain" | "posttrain" | "serve" | "agent";
type Pressure = "cap" | "eff" | "trust";
const LAYERS: Layer[] = ["data", "pretrain", "posttrain", "serve", "agent"];
const PRESSURES: Pressure[] = ["cap", "eff", "trust"];
// The layer where each pressure binds hardest, per the chapter.
const DOMINANT: Record<Pressure, Layer> = { cap: "pretrain", eff: "serve", trust: "agent" };
const COLOR: Record<Pressure, string> = { cap: C.c1, eff: C.c2, trust: C.c3 };

interface Cell { short: string; detail: string; chapter: string }
type Grid = Record<Layer, Record<Pressure, Cell>>;

const GRID: Record<Lang, Grid> = {
  en: {
    data: {
      cap: { short: "corpus coverage of code", detail: "Which repositories and languages survive filtering and near-duplicate removal decides what code the model can learn to read.", chapter: "Data Curation and the Training Distribution" },
      eff: { short: "tokens per byte", detail: "The tokenizer sets how many tokens an identifier such as readUserConfig costs, and every later stage pays per token.", chapter: "Tokenization" },
      trust: { short: "benchmark contamination", detail: "If evaluation problems or close copies enter the corpus, a later score measures recall rather than generalization.", chapter: "Data Curation and the Training Distribution" },
    },
    pretrain: {
      cap: { short: "loss at a compute budget", detail: "For a fixed training budget, the split between parameters and tokens sets the loss the base model reaches.", chapter: "Scaling Laws and Compute Allocation" },
      eff: { short: "accelerator-hours", detail: "DeepSeek-V3 reports 2.788M H800 GPU-hours; utilization, number format, and overlap of communication with compute set how many a run needs.", chapter: "Training at Scale" },
      trust: { short: "numerical stability", detail: "Narrow number formats can underflow, saturate, or diverge, so the run needs evidence that each step computed what was intended.", chapter: "Training at Scale" },
    },
    posttrain: {
      cap: { short: "preference data coverage", detail: "The assistant learns to plan, call tools, and explain a patch only as far as demonstrations and preference pairs show those behaviors.", chapter: "Behavior Specifications and Preference Data" },
      eff: { short: "labels and rollouts", detail: "Each policy update consumes human labels, grader calls, and sampled responses.", chapter: "RLHF and Reward Modeling" },
      trust: { short: "reward over-optimization", detail: "A policy optimized against a learned reward can raise its score without learning the intended behavior.", chapter: "RLHF and Reward Modeling" },
    },
    serve: {
      cap: { short: "usable context length", detail: "How many tokens of repository, instructions, and tool output one call can accept and still use.", chapter: "Structured and Long-Context Inference" },
      eff: { short: "KV-cache bytes per active token", detail: "Cache memory per resident token caps the batch, and every decode step reads the weights and the cache again, so memory bandwidth sets tokens per second.", chapter: "Memory and Scheduling" },
      trust: { short: "parity with the evaluated model", detail: "Quantized weights, new kernels, and batching must keep the behavior that was evaluated before release.", chapter: "Quantization and Kernels" },
    },
    agent: {
      cap: { short: "reliability across steps", detail: "The task succeeds only if reading, testing, editing, and retesting all succeed, so errors compound over the trajectory.", chapter: "Evaluating Agents and Capabilities" },
      eff: { short: "context reread per call", detail: "Every model call reads the whole growing context again, so the input tokens of a task grow faster than its final context.", chapter: "Context Engineering" },
      trust: { short: "tool authority", detail: "Which files the agent may change and which commands it may run, checked before each action is executed.", chapter: "Security and Authorization" },
    },
  },
  zh: {
    data: {
      cap: { short: "语料对代码的覆盖", detail: "经过过滤和近似去重后留下哪些代码仓库和语言，决定了模型能学会读懂哪些代码。", chapter: "数据筛选与训练分布" },
      eff: { short: "每字节词元数", detail: "分词器决定 readUserConfig 这样的标识符要占多少词元，之后每个阶段的成本都按词元计算。", chapter: "分词" },
      trust: { short: "基准污染", detail: "评测题目或其近似副本一旦进入语料，之后的分数测到的就是记忆，而不是泛化。", chapter: "数据筛选与训练分布" },
    },
    pretrain: {
      cap: { short: "给定算力下的损失", detail: "训练预算固定时，参数量与词元数的分配决定基座模型能达到的损失。", chapter: "扩展律与算力分配" },
      eff: { short: "加速器时数", detail: "DeepSeek-V3 报告了 278.8 万 H800 GPU 小时；利用率、数值格式以及通信与计算的重叠程度，决定一次训练需要多少。", chapter: "大规模训练" },
      trust: { short: "数值稳定性", detail: "窄数值格式可能下溢、饱和或发散，训练需要证据表明每一步都按预期完成了计算。", chapter: "大规模训练" },
    },
    posttrain: {
      cap: { short: "偏好数据的覆盖面", detail: "示范和偏好对覆盖了规划、调用工具和解释补丁这些行为，助手才学得会。", chapter: "行为规格与偏好数据" },
      eff: { short: "标注与采样量", detail: "每次策略更新都要消耗人工标注、评分器调用和采样得到的回答。", chapter: "RLHF 与奖励建模" },
      trust: { short: "奖励过优化", detail: "针对学得的奖励做优化，策略可能抬高了分数，却没有学到预期的行为。", chapter: "RLHF 与奖励建模" },
    },
    serve: {
      cap: { short: "可用的上下文长度", detail: "一次调用能接收多少代码仓库内容、指令和工具输出，并且真正用得上。", chapter: "结构化与长上下文推断" },
      eff: { short: "活跃词元的 KV 缓存字节", detail: "每个驻留词元占用的缓存内存限制了批大小；每个解码步都要重新读取权重和缓存，所以内存带宽决定每秒词元数。", chapter: "显存与调度" },
      trust: { short: "行为与评测时一致", detail: "量化后的权重、新算子和批处理，都必须保持发布前评测过的行为。", chapter: "量化与算子" },
    },
    agent: {
      cap: { short: "多步累积的可靠性", detail: "读取、测试、修改、再测试每一步都成功，任务才算成功，所以错误会沿着轨迹累积。", chapter: "评测智能体与能力" },
      eff: { short: "每次调用重读的上下文", detail: "每次模型调用都要把不断变长的上下文整个重读一遍，所以一项任务的输入词元总数比最终上下文增长得更快。", chapter: "上下文工程" },
      trust: { short: "工具权限", detail: "智能体可以修改哪些文件、运行哪些命令，要在每个动作执行前检查。", chapter: "安全与授权" },
    },
  },
};

const labels = {
  en: {
    title: "What binds at each layer of the stack",
    data: "Data and tokens", pretrain: "Pre-training", posttrain: "Post-training", serve: "Serving", agent: "Agent runtime",
    cap: "Capability", eff: "Efficiency", trust: "Trust",
    capQ: "which tasks, how reliably", effQ: "compute, memory, time, money", trustQ: "evidence that properties hold",
    key: "outlined: where the chapter argues the pressure binds hardest",
    detailT: "{layer}, in the bug-fixing task",
    dominant: "binds hardest here",
    chapter: "Chapter: {c}",
    describe: "{layer}: the binding constraints are {cap} for capability, {eff} for efficiency, and {trust} for trust.{dom}",
    domOne: " Here {p} binds harder than at any other layer.",
    domMany: " Here {p} bind harder than at any other layer.",
    and: " and ",
  },
  zh: {
    title: "技术栈每一层受什么约束",
    data: "数据与词元", pretrain: "预训练", posttrain: "后训练", serve: "服务", agent: "智能体运行时",
    cap: "能力", eff: "效率", trust: "信任",
    capQ: "能完成哪些任务，多可靠", effQ: "算力、内存、时间与资金", trustQ: "必要属性成立的证据",
    key: "带外框：本章认为该压力在这一层最紧",
    detailT: "{layer}：在修复缺陷的任务中",
    dominant: "此处约束最紧",
    chapter: "相关章节：{c}",
    describe: "{layer}：能力方面的约束是{cap}，效率方面是{eff}，信任方面是{trust}。{dom}",
    domOne: "{p}在这一层比在其他任何一层都更紧。",
    domMany: "{p}在这一层比在其他任何一层都更紧。",
    and: "和",
  },
};
type L = typeof labels.en;
type P = { focus: Layer };

// Wrap at spaces, and inside a hyphenated word that is wider than the line
// ("over-" / "optimization"), so no word runs past a narrow cell.
function lines(s: string, size: number, maxW: number, lang: Lang): string[] {
  if (lang === "zh") return wrapCJK(s, size, maxW);
  const out: string[] = [];
  for (const ln of wrap(s, size, maxW)) {
    if (textWidth(ln, size) <= maxW || !ln.includes("-")) { out.push(ln); continue; }
    let cur = "";
    for (const piece of ln.split(/(?<=-)|(?= )/)) {
      if (cur && textWidth((cur + piece).trimEnd(), size) > maxW) { out.push(cur.trimEnd()); cur = piece.trimStart(); } else cur += piece;
    }
    if (cur) out.push(cur.trimEnd());
  }
  return out;
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const f = st.p.focus;
  const cells = GRID[lang][f];
  const dom = PRESSURES.filter((pr) => DOMINANT[pr] === f).map((pr) => (lang === "en" ? L[pr].toLowerCase() : L[pr]));
  const domText = dom.length ? tpl(dom.length > 1 ? L.domMany : L.domOne, { p: dom.join(L.and) }) : "";
  return tpl(L.describe, { layer: L[f], cap: cells.cap.short, eff: cells.eff.short, trust: cells.trust.short, dom: domText });
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const grid = GRID[lang];
  const focus = st.p.focus;
  const parts: string[] = [];

  // ---- the grid
  const rowLabelW = narrow ? 0 : 118;
  const gap = narrow ? 4 : 6;
  const colW = (w - rowLabelW - gap * 2) / 3;
  const colX = (i: number) => rowLabelW + i * (colW + gap);
  const pad = narrow ? 5 : 8;
  const cellSize = narrow ? TYPE.body : TYPE.body;
  // Column headers: the pressure and the question it asks.
  let y = 0;
  const headLines = PRESSURES.map((pr) => lines(L[`${pr}Q` as keyof L], fs, colW - 2, lang));
  const headH = TYPE.label + 6 + Math.max(...headLines.map((h) => h.length)) * (fs + 4);
  PRESSURES.forEach((pr, i) => {
    const x = colX(i);
    parts.push(el("rect", { x, y: 2, width: colW, height: 4, rx: 2, fill: COLOR[pr] }));
    parts.push(text(x, 22, L[pr], { "font-size": TYPE.label, class: "fig-t-strong" }));
    headLines[i].forEach((ln, k) => parts.push(text(x, 22 + 6 + (k + 1) * (fs + 4) - 4, ln, { "font-size": fs, class: "fig-t-muted" })));
  });
  y = 10 + headH + 8;

  // Rows. Every cell's text is wrapped first so each row is as tall as its
  // tallest cell.
  for (const layer of LAYERS) {
    const on = layer === focus;
    // Bold text runs wider than the width estimate, so leave it room.
    const cellLines = PRESSURES.map((pr) => lines(grid[layer][pr].short, cellSize, (colW - 2 * pad) * 0.92, lang));
    const nameLines = narrow ? [L[layer]] : lines(L[layer], TYPE.body, rowLabelW - 8, lang);
    const nameH = narrow ? TYPE.body + 8 : 0; // phone: the name runs above the row
    const rowH = Math.max(Math.max(...cellLines.map((c) => c.length)) * (cellSize + 4) + 2 * pad, narrow ? 0 : nameLines.length * (TYPE.body + 4) + 2 * pad, 36);
    const y0 = y;
    if (on) parts.push(el("rect", { x: narrow ? -2 : 0, y: y0 - 3, width: narrow ? w + 4 : w, height: nameH + rowH + 6, rx: 6, fill: C.panel }));
    nameLines.forEach((ln, k) => parts.push(text(0, narrow ? y0 + TYPE.body : y0 + pad + TYPE.body * 0.85 + k * (TYPE.body + 4), ln, { "font-size": TYPE.body, class: on ? "fig-t-strong" : "fig-t-muted" })));
    y += nameH;
    PRESSURES.forEach((pr, i) => {
      const x = colX(i);
      const dom = DOMINANT[pr] === layer;
      parts.push(el("rect", {
        x, y, width: colW, height: rowH, rx: 5,
        fill: dom ? COLOR[pr] : C.paper, "fill-opacity": dom ? 0.16 : undefined,
        stroke: dom ? C.ink : C.rule, "stroke-width": dom ? 2 : 1,
      }));
      cellLines[i].forEach((ln, k) => parts.push(text(x + pad, y + pad + cellSize * 0.85 + k * (cellSize + 4), ln, { "font-size": cellSize, class: on || dom ? "fig-t-strong" : undefined })));
    });
    // The whole row selects the layer.
    parts.push(el("rect", { x: 0, y: y0 - 3, width: w, height: nameH + rowH + 6, fill: "transparent", "data-fig-set": `focus=${layer}`, class: "fig-hit" }));
    y += rowH + (narrow ? 8 : 10);
  }
  // Key for the outline.
  parts.push(el("rect", { x: 0, y: y + 1, width: 14, height: 11, rx: 3, fill: C.ink3, "fill-opacity": 0.16, stroke: C.ink, "stroke-width": 2 }));
  const keyLines = lines(L.key, fs, w - 22, lang);
  keyLines.forEach((ln, k) => parts.push(text(22, y + 10 + k * (fs + 4), ln, { "font-size": fs, class: "fig-t-muted" })));
  y += keyLines.length * (fs + 4) + 18;

  // ---- the chosen layer, cell by cell
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.rule, "stroke-width": 1 }));
  y += 8;
  const head = lines(tpl(L.detailT, { layer: L[focus] }), TYPE.label, w, lang);
  head.forEach((ln, k) => parts.push(text(0, y + TYPE.label + k * (TYPE.label + 5), ln, { "font-size": TYPE.label, class: "fig-t-strong" })));
  y += head.length * (TYPE.label + 5) + 8;
  const nameW = narrow ? 0 : Math.max(...PRESSURES.map((pr) => textWidth(L[pr], TYPE.body))) + 30;
  const ro: string[] = [];
  for (const pr of PRESSURES) {
    const cell = grid[focus][pr];
    const dom = DOMINANT[pr] === focus;
    ro.push(el("rect", { x: 0, y: y + 2, width: 4, height: TYPE.body + 2, rx: 2, fill: COLOR[pr] }));
    let yy = y;
    const textX = narrow ? 10 : nameW;
    ro.push(text(10, yy + TYPE.body + 1, L[pr], { "font-size": TYPE.body, class: "fig-t-muted" }));
    if (narrow) yy += TYPE.body + 6;
    const headLine = cell.short + (dom ? (lang === "zh" ? `（${L.dominant}）` : ` (${L.dominant})`) : "");
    const avail = (w - textX) * 0.97;
    const hl = lines(headLine, TYPE.body, avail, lang);
    hl.forEach((ln, k) => { ro.push(text(textX, yy + TYPE.body + 1 + k * (TYPE.body + 5), ln, { "font-size": TYPE.body, class: "fig-t-strong" })); });
    yy += hl.length * (TYPE.body + 5);
    const dl = lines(cell.detail, TYPE.body, avail, lang);
    dl.forEach((ln, k) => ro.push(text(textX, yy + TYPE.body + 1 + k * (TYPE.body + 5), ln, { "font-size": TYPE.body })));
    yy += dl.length * (TYPE.body + 5);
    const cl = lines(tpl(L.chapter, { c: cell.chapter }), fs, avail, lang);
    cl.forEach((ln, k) => ro.push(text(textX, yy + fs + 1 + k * (fs + 4), ln, { "font-size": fs, class: "fig-t-muted" })));
    yy += cl.length * (fs + 4);
    y = yy + 12;
  }
  parts.push(g({ class: "fig-readout" }, ...ro));
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "layer-pressure",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    focus: {
      kind: "choice", label: { en: "Layer", zh: "层" }, default: "serve", control: "buttons",
      options: LAYERS.map((l) => ({ value: l, label: { en: labels.en[l], zh: labels.zh[l] } })),
    },
  },
  render,
  describe,
});
