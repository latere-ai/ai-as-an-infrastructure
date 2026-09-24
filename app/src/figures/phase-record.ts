// The chapter's phase tuple P_i = (O_i, D_i, η_i, B_i, L_i), filled in from
// four published runs, one column per phase. A cell is marked where its field
// differs from the phase before, so the boundary between phases is read off
// as the set of fields that changed. The budget B differs at every boundary
// and is not marked. Fields a report does not give are drawn as not reported,
// never estimated.
//
// Sources (numbers transcribed from the papers):
// - OLMo 2 7B: OLMo Team, "2 OLMo 2 Furious", arXiv 2501.00656v3. Table 3
//   (sequence length 4,096; peak LR 3 × 10⁻⁴, 2,000 warmup steps, cosine
//   calibrated to 10% of peak at 5T tokens, truncated after 4T), §2.3 (stage 2
//   decays the LR linearly to zero; three 50B runs averaged; 3.90T tokens in
//   stage 1), Table 4 (OLMo 2 Mix 1124 by source), Table 13 (the 50B Dolmino
//   mix), §4 and the post-training section (Tülu 3: SFT, DPO, RLVR). The
//   stage 1 curve is the cosine up to 4T of 5T: η/η_max = 0.1 + 0.9·½(1 + cos πt/5T).
// - Qwen2.5-Coder 7B: Hui et al., arXiv 2409.12186v3, §3.1.2 (70% code, 20%
//   text, 10% math; 5.2T tokens), §3.2 (file level at 8,192 with next-token
//   prediction and FIM; repository level at 32,768 with RoPE base 10,000 →
//   1,000,000, YaRN to 131,072, about 300B tokens; then SFT and offline DPO).
//   No learning-rate schedule is reported.
// - DeepSeekMath 7B: Shao et al., arXiv 2402.03300v3, §2.2.1 and §2.3
//   (initialized from DeepSeek-Coder-Base-v1.5 7B before its LR decay; 500B
//   tokens: 56% DeepSeekMath Corpus, 4% AlgebraicStack, 10% arXiv, 20% GitHub
//   code, 10% Common Crawl text; multi-step LR: 2,000 warmup steps to 4.2 ×
//   10⁻⁴, 31.6% after 80% of training, 10% after 90%; 10M-token batches, 4K
//   context), §3 (SFT: 776K examples, 500 steps of 256, constant 5 × 10⁻⁵),
//   §4 (GRPO on about 144K questions, policy LR 1 × 10⁻⁶, KL 0.04, 64 samples).
//   2,000 steps of 10M tokens are 20B, 4% of the 500B phase.
// - Qwen2.5-1M: Yang et al., arXiv 2501.15383v1, §2 (five stages: 4,096 and
//   32,768 as for other Qwen2.5 models with RoPE base 10,000 → 1,000,000;
//   then 65,536, 131,072 and 262,144 with bases 1M, 5M and 10M, each 75% at
//   the stage's maximum length and 25% shorter; two-stage SFT; offline RL on
//   pairs up to 8,192). No per-stage budgets or LR schedules are reported.

import { defineFigure, type Lang, type State, type Text } from "./types.ts";
import { svg, el, text, g, linePath } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- data

type Cat = "web" | "code" | "math" | "ref" | "instr";
type Role = "pre" | "mid" | "post";
type Field = "O" | "D" | "eta" | "B" | "L";

interface Cell {
  text: Text;
  key?: string; // equal keys mean the same setting; no key means not reported
}
interface Phase {
  name: Text;
  role: Role;
  O: Cell;
  D: Cell & { mix?: Array<[Cat, number]> };
  eta: Cell & { shape?: Array<[number, number]> }; // (progress in phase, η / run peak)
  B: Cell & { tokens?: number };
  L: Cell;
}
interface Run { name: Text; source: Text; note?: Text; peak?: Text; phases: Phase[] }

const T = (en: string, zh: string): Text => ({ en, zh });
const NR = (): Cell => ({ text: T("not reported", "未报告") });
const DASH = (): Cell => ({ text: T("—", "—") });

// OLMo 2 stage 1: the cosine toward 10% at 5T, drawn to its 4T truncation.
const olmoCos = (t: number) => 0.1 + 0.9 * 0.5 * (1 + Math.cos((Math.PI * t) / 5));
const olmoStage1 = Array.from({ length: 41 }, (_, k) => [k / 40, olmoCos((4 * k) / 40)] as [number, number]);
const olmoEnd = olmoCos(4);

const NTP = { text: T("next-token prediction", "下一词元预测"), key: "ntp" };

const RUNS: Record<"olmo2" | "coder" | "dsmath" | "qwen1m", Run> = {
  olmo2: {
    name: T("OLMo 2 7B", "OLMo 2 7B"),
    source: T("Starts from random initialization.", "从随机初始化开始。"),
    peak: T("η peak 3 × 10⁻⁴", "η 峰值 3 × 10⁻⁴"),
    phases: [
      {
        name: T("Pretraining", "预训练"), role: "pre", O: NTP,
        D: { text: T("OLMo 2 Mix 1124", "OLMo 2 Mix 1124"), key: "olmo-mix", mix: [["web", 95.13], ["code", 2.13], ["ref", 2.13], ["math", 0.62]] },
        eta: { text: T("cosine toward 10% at 5T, cut at 4T", "余弦衰减，5T 时降到 10%，在 4T 截断"), key: "cosine", shape: olmoStage1 },
        B: { text: T("3.90T", "3.90T"), tokens: 3.9e12 },
        L: { text: T("4,096", "4,096"), key: "4096" },
      },
      {
        name: T("Mid-training", "中段训练"), role: "mid", O: NTP,
        D: { text: T("Dolmino Mix 1124, 50B sample", "Dolmino Mix 1124，50B 样本"), key: "dolmino", mix: [["web", 47.2], ["instr", 19.05], ["ref", 12.96], ["math", 20.8]] },
        eta: { text: T("linear decay to 0", "线性衰减到 0"), key: "linear-0", shape: [[0, olmoEnd], [1, 0]] },
        B: { text: T("50B, 3 runs averaged", "50B，3 次运行取平均"), tokens: 50e9 },
        L: { text: T("4,096", "4,096"), key: "4096" },
      },
      {
        name: T("Post-training", "后训练"), role: "post",
        O: { text: T("SFT, then DPO, then RLVR (Tülu 3)", "SFT、DPO，再到 RLVR（Tülu 3）"), key: "sft-dpo-rlvr" },
        D: { text: T("demonstrations, preference pairs, verifiable prompts", "示范、偏好对、可核验提示"), key: "tulu3" },
        eta: DASH(), B: DASH(), L: DASH(),
      },
    ],
  },
  coder: {
    name: T("Qwen2.5-Coder 7B", "Qwen2.5-Coder 7B"),
    source: T("Starts from a Qwen2.5 base checkpoint.", "从 Qwen2.5 基座检查点开始。"),
    phases: [
      {
        name: T("File-level", "文件级"), role: "mid",
        O: { text: T("next-token prediction and fill-in-the-middle", "下一词元预测与中间填充（FIM）"), key: "ntp-fim" },
        D: { text: T("code 70%, text 20%, math 10%", "代码 70%，文本 20%，数学 10%"), key: "coder-mix", mix: [["code", 70], ["web", 20], ["math", 10]] },
        eta: NR(),
        B: { text: T("5.2T", "5.2T"), tokens: 5.2e12 },
        L: { text: T("8,192, RoPE base 10,000", "8,192，RoPE 基频 10,000"), key: "8192" },
      },
      {
        name: T("Repo-level", "仓库级"), role: "mid",
        O: { text: T("next-token prediction and repository-level FIM", "下一词元预测与仓库级 FIM"), key: "ntp-repo-fim" },
        D: { text: T("long-context repository code", "长上下文仓库代码"), key: "repo" },
        eta: NR(),
        B: { text: T("about 300B", "约 300B"), tokens: 300e9 },
        L: { text: T("32,768, RoPE base 1,000,000; YaRN to 131,072 at inference", "32,768，RoPE 基频 1,000,000；推理时用 YaRN 扩到 131,072"), key: "32768" },
      },
      {
        name: T("Post-training", "后训练"), role: "post",
        O: { text: T("SFT, then offline DPO", "SFT，再做离线 DPO"), key: "sft-dpo" },
        D: { text: T("instructions, then code and general preference pairs", "指令数据，再加代码与通用偏好对"), key: "coder-post" },
        eta: DASH(), B: DASH(), L: DASH(),
      },
    ],
  },
  dsmath: {
    name: T("DeepSeekMath 7B", "DeepSeekMath 7B"),
    source: T("Starts from DeepSeek-Coder-Base-v1.5 7B, the checkpoint before its learning-rate decay.", "从 DeepSeek-Coder-Base-v1.5 7B 学习率衰减之前的检查点开始。"),
    peak: T("η peak 4.2 × 10⁻⁴", "η 峰值 4.2 × 10⁻⁴"),
    phases: [
      {
        name: T("Math pretraining", "数学继续预训练"), role: "mid", O: NTP,
        D: { text: T("DeepSeekMath Corpus 56%, AlgebraicStack 4%, arXiv 10%, GitHub 20%, web text 10%", "DeepSeekMath Corpus 56%，AlgebraicStack 4%，arXiv 10%，GitHub 20%，网页文本 10%"), key: "dsmath-mix", mix: [["math", 60], ["code", 20], ["ref", 10], ["web", 10]] },
        eta: { text: T("multi-step: 31.6% after 80%, 10% after 90%", "分段：80% 处降到 31.6%，90% 处降到 10%"), key: "multistep", shape: [[0, 0], [0.04, 1], [0.8, 1], [0.8, 0.316], [0.9, 0.316], [0.9, 0.1], [1, 0.1]] },
        B: { text: T("500B", "500B"), tokens: 500e9 },
        L: { text: T("4,096", "4,096"), key: "4096" },
      },
      {
        name: T("SFT", "SFT"), role: "post",
        O: { text: T("SFT on CoT, program and tool-use solutions", "在 CoT、程序与工具调用解答上做 SFT"), key: "sft" },
        D: { text: T("776K math problems", "77.6 万道数学题"), key: "sft-data" },
        eta: { text: T("constant 5 × 10⁻⁵", "恒定 5 × 10⁻⁵"), key: "const-5e-5", shape: [[0, 5e-5 / 4.2e-4], [1, 5e-5 / 4.2e-4]] },
        B: { text: T("500 steps of 256 sequences", "500 步，每步 256 条序列"), },
        L: { text: T("4,096", "4,096"), key: "4096" },
      },
      {
        name: T("RL", "强化学习"), role: "post",
        O: { text: T("GRPO, 64 samples per question", "GRPO，每题采样 64 个"), key: "grpo" },
        D: { text: T("about 144K GSM8K- and MATH-style questions", "约 14.4 万道 GSM8K 与 MATH 类问题"), key: "rl-data" },
        eta: { text: T("policy 1 × 10⁻⁶", "策略模型 1 × 10⁻⁶"), key: "1e-6" },
        B: DASH(), L: DASH(),
      },
    ],
  },
  qwen1m: {
    name: T("Qwen2.5-1M", "Qwen2.5-1M"),
    source: T("Starts from an intermediate Qwen2.5 base checkpoint.", "从一个中间版本的 Qwen2.5 基座检查点开始。"),
    note: T("Long-context data adds synthetic fill-in-the-middle, retrieval and paragraph-reordering tasks.", "长上下文数据中加入了合成的中间填充、检索与段落重排任务。"),
    phases: [
      {
        name: T("Stages 1–2", "第 1–2 阶段"), role: "pre",
        O: { text: T("pretraining objective", "预训练目标"), key: "pt" },
        D: { text: T("as for other Qwen2.5 base models", "与其他 Qwen2.5 基座模型相同"), key: "qwen-base" },
        eta: NR(), B: NR(),
        L: { text: T("4,096, then 32,768; RoPE base 10,000 → 1,000,000", "先 4,096，再 32,768；RoPE 基频 10,000 → 1,000,000"), key: "32768" },
      },
      ...([[65536, "1,000,000"], [131072, "5,000,000"], [262144, "10,000,000"]] as const).map(([len, base], i) => ({
        name: T(`Stage ${i + 3}`, `第 ${i + 3} 阶段`), role: "mid" as Role,
        O: { text: T("pretraining objective", "预训练目标"), key: "pt" },
        D: { text: T(`75% at ${len.toLocaleString("en-US")} tokens, 25% shorter`, `75% 为 ${len.toLocaleString("en-US")} 词元，25% 更短`), key: `75-${len}` },
        eta: NR(), B: NR(),
        L: { text: T(`${len.toLocaleString("en-US")}, RoPE base ${base}`, `${len.toLocaleString("en-US")}，RoPE 基频 ${base}`), key: String(len) },
      })),
      {
        name: T("Post-training", "后训练"), role: "post",
        O: { text: T("two-stage SFT, then offline RL", "两阶段 SFT，再做离线 RL"), key: "sft-rl" },
        D: { text: T("short instructions, then short and long up to 262,144; RL pairs up to 8,192", "先是短指令，再混合长短数据至 262,144；RL 数据对不超过 8,192"), key: "qwen-post" },
        eta: DASH(), B: DASH(), L: DASH(),
      },
    ],
  },
};
type RunKey = keyof typeof RUNS;

const CAT_COLOR: Record<Cat, string> = { web: C.c1, code: C.c2, math: C.c3, ref: C.c4, instr: C.c5 };
const CAT_ORDER: Cat[] = ["web", "code", "math", "ref", "instr"];
const MARKED: Field[] = ["O", "D", "eta", "L"];

// Fields that differ from the phase before, where both are reported.
function changes(run: Run, i: number): Field[] {
  if (i === 0) return [];
  const a = run.phases[i - 1], b = run.phases[i];
  return MARKED.filter((f) => a[f].key != null && b[f].key != null && a[f].key !== b[f].key);
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "The phase tuple of four published runs",
    O: "objective O",
    D: "data D",
    eta: "learning rate η",
    B: "budget B",
    L: "trained length L",
    pre: "pre-training",
    mid: "mid-training",
    post: "post-training",
    web: "web and general text",
    code: "code",
    math: "math",
    ref: "academic and reference",
    instr: "instructions and Q&A",
    changed: "changed from the phase before",
    changes: "changes: {f}",
    first: "first phase",
    none: "no marked change",
    notReported: "not reported",
    describe: "{run}, {n} phases. {b}",
    boundary: "{a} to {b}: {f}",
    fO: "O", fD: "D", feta: "η", fL: "L",
  },
  zh: {
    title: "四次公开训练运行的阶段元组",
    O: "目标 O",
    D: "数据 D",
    eta: "学习率 η",
    B: "预算 B",
    L: "训练长度 L",
    pre: "预训练",
    mid: "中段训练",
    post: "后训练",
    web: "网页与通用文本",
    code: "代码",
    math: "数学",
    ref: "学术与参考资料",
    instr: "指令与问答",
    changed: "相对前一阶段有变化",
    changes: "变化：{f}",
    first: "第一个阶段",
    none: "无标记的变化",
    notReported: "未报告",
    describe: "{run}，共 {n} 个阶段。{b}",
    boundary: "{a} 到 {b}：{f}",
    fO: "O", fD: "D", feta: "η", fL: "L",
  },
};

type P = { run: RunKey };

const fieldNames = (fs: Field[], L: typeof labels.en, lang: Lang) => fs.map((f) => L[`f${f}` as "fO"]).join(lang === "zh" ? "、" : ", ");

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const run = RUNS[st.p.run];
  const parts = run.phases.slice(1).map((ph, k) => {
    const ch = changes(run, k + 1);
    return tpl(L.boundary, { a: run.phases[k].name[lang], b: ph.name[lang], f: ch.length ? fieldNames(ch, L, lang) : L.none });
  });
  return tpl(L.describe, { run: run.name[lang], n: run.phases.length, b: parts.join(lang === "zh" ? "；" : "; ") + (lang === "zh" ? "。" : ".") });
}

// A phase named after its role ("Mid-training") needs no separate role line.
const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, "");
const sameAsRole = (ph: Phase, L: typeof labels.en, lang: Lang) => norm(ph.name[lang]) === norm(L[ph.role]);

interface Ctx { L: typeof labels.en; lang: Lang; fs: number; wr: (s: string, size: number, max: number) => string[] }

function lines(c: Ctx, s: string, x: number, y: number, w: number, size: number, cls: string, out: string[]): number {
  let yy = y;
  for (const ln of c.wr(s, size, w)) { yy += size + 3; out.push(text(x, yy, ln, { "font-size": size, class: cls })); }
  return yy - y;
}

// One cell of the grid: the field's picture (mixture bar, schedule, budget
// bar) where the report gives one, then its text.
function cell(c: Ctx, ph: Phase, f: Field, x: number, y: number, w: number): { svg: string; h: number } {
  const out: string[] = [];
  let h = 0;
  const cl = ph[f];
  const reported = cl.text.en !== "not reported" && cl.text.en !== "—";
  if (f === "D" && ph.D.mix) {
    let cx = x;
    for (const [cat, share] of ph.D.mix) {
      const sw = (w * share) / 100;
      out.push(el("rect", { x: cx, y: y + 2, width: Math.max(0.8, sw - 0.6), height: 12, fill: CAT_COLOR[cat] }));
      const lab = `${share < 1 ? share.toFixed(1) : Math.round(share)}%`;
      if (sw > textWidth(lab, c.fs) * 1.25 + 10) out.push(text(cx + 3, y + 12, lab, { "font-size": c.fs - 1 > 10 ? c.fs - 1 : c.fs, class: "fig-t-halo fig-t-num" }));
      cx += sw;
    }
    h += 18;
  }
  if (f === "eta" && ph.eta.shape) {
    const ch = 30;
    const pts = ph.eta.shape.map(([u, v]) => [x + u * w, y + 2 + ch * (1 - v)] as [number, number]);
    out.push(el("path", { d: linePath([[x, y + 2 + ch], ...pts, [x + w, y + 2 + ch]]) + "Z", fill: C.c1, "fill-opacity": 0.16 }));
    out.push(el("line", { x1: x, x2: x + w, y1: y + 2 + ch, y2: y + 2 + ch, stroke: C.rule, "stroke-width": 1 }));
    out.push(el("path", { d: linePath(pts), fill: "none", stroke: C.ink, "stroke-width": 1.6, "stroke-linejoin": "round" }));
    h += ch + 6;
  }
  if (f === "B" && ph.B.tokens) {
    // Log scale shared by every run: 10B at the left edge, 10T at the right.
    const bw = Math.max(2, (w * (Math.log10(ph.B.tokens) - 10)) / 3);
    out.push(el("rect", { x, y: y + 4, width: w, height: 6, rx: 2, fill: C.panel }));
    out.push(el("rect", { x, y: y + 4, width: Math.min(w, bw), height: 6, rx: 2, fill: C.ink3 }));
    h += 12;
  }
  h += lines(c, cl.text[c.lang], x, y + h, w, c.fs, reported ? (f === "O" || f === "L" ? "" : "fig-t-muted") : "fig-t-faint", out);
  return { svg: out.join(""), h };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const run = RUNS[st.p.run];
  const w = st.w;
  const narrow = w < 480;
  const fs = narrow ? TYPE.body : TYPE.small;
  const c: Ctx = { L, lang, fs, wr: (s, size, max) => (lang === "zh" ? wrapCjk : wrap)(s, size, max) };
  const parts: string[] = [];
  let y = 0;

  // On a phone the η peak joins this line; on a desktop it sits under the lane label.
  const intro = [run.source[lang], run.note?.[lang], narrow && run.peak ? run.peak[lang] + (lang === "zh" ? "。" : ".") : undefined].filter(Boolean).join(lang === "zh" ? "" : " ");
  y += lines(c, intro, 0, y, w, fs, "fig-t-muted", parts) + 10;
  const cats = CAT_ORDER.filter((k) => run.phases.some((ph) => ph.D.mix?.some(([cc]) => cc === k)));
  const lg = legend([
    { label: L.changed, swatch: { kind: "rect", fill: C.c1, opacity: 0.3 } },
    ...cats.map((k) => ({ label: L[k], swatch: { kind: "rect" as const, fill: CAT_COLOR[k] } })),
  ], 0, y, w, fs);
  parts.push(lg.svg);
  y += lg.height + 12;

  const fields: Field[] = ["O", "D", "eta", "B", "L"];
  const laneLabel = (f: Field) => L[f];
  const mark = (x: number, yy: number, cw: number, h: number) =>
    el("rect", { x: x - 6, y: yy - 4, width: cw + 10, height: h + 8, rx: 3, fill: C.c1, "fill-opacity": 0.12 })
    + el("rect", { x: x - 6, y: yy - 4, width: 3, height: h + 8, fill: C.c1 });

  if (!narrow) {
    const labelW = Math.max(...fields.map((f) => textWidth(laneLabel(f), fs)), run.peak ? textWidth(run.peak[lang], fs) : 0) + 14;
    const n = run.phases.length;
    const gap = 14;
    const cw = (w - labelW - gap * (n - 1)) / n;
    const colX = (i: number) => labelW + i * (cw + gap);
    // Header: phase name, role, and the fields that changed at its boundary.
    const heads = run.phases.map((ph, i) => {
      const out: string[] = [];
      let h = lines(c, ph.name[lang], colX(i), y, cw, TYPE.body, "fig-t-strong", out);
      if (!sameAsRole(ph, L, lang)) h += lines(c, L[ph.role], colX(i), y + h, cw, fs, "fig-t-muted", out);
      const ch = changes(run, i);
      h += lines(c, i === 0 ? L.first : ch.length ? tpl(L.changes, { f: fieldNames(ch, L, lang) }) : L.none, colX(i), y + h, cw, fs, ch.length ? "fig-t-strong" : "fig-t-faint", out);
      return { out, h, role: ph.role };
    });
    const headH = Math.max(...heads.map((hh) => hh.h)) + 8;
    run.phases.forEach((ph, i) => {
      if (ph.role === "mid") parts.push(el("rect", { x: colX(i) - 6, y: y - 2, width: cw + 10, height: headH, rx: 3, fill: C.panel }));
    });
    for (const hh of heads) parts.push(...hh.out);
    y += headH + 8;
    for (const f of fields) {
      const cells = run.phases.map((ph, i) => cell(c, ph, f, colX(i), y + 4, cw));
      const rowH = Math.max(...cells.map((cc) => cc.h)) + 8;
      parts.push(el("line", { x1: 0, x2: w, y1: y - 4, y2: y - 4, stroke: C.grid, "stroke-width": 1 }));
      parts.push(text(0, y + 4 + fs + 3, laneLabel(f), { "font-size": fs, class: "fig-t-strong" }));
      if (f === "eta" && run.peak) parts.push(text(0, y + 4 + 2 * (fs + 3) + 2, run.peak[lang], { "font-size": fs, class: "fig-t-muted" }));
      run.phases.forEach((_, i) => { if (changes(run, i).includes(f)) parts.push(mark(colX(i), y + 4, cw, cells[i].h)); });
      for (const cc of cells) parts.push(cc.svg);
      y += rowH + 10;
    }
  } else {
    // Phone: one card per phase, the tuple as labeled rows.
    const labelW = Math.max(...fields.map((f) => textWidth(laneLabel(f), fs))) + 12;
    const cw = w - labelW - 6;
    run.phases.forEach((ph, i) => {
      if (i) { parts.push(el("line", { x1: 0, x2: w, y1: y - 6, y2: y - 6, stroke: C.rule, "stroke-width": 1 })); }
      const top = y;
      const out: string[] = [];
      let h = lines(c, sameAsRole(ph, L, lang) ? ph.name[lang] : `${ph.name[lang]} · ${L[ph.role]}`, 6, y, w - 12, TYPE.label, "fig-t-strong", out);
      const ch = changes(run, i);
      h += lines(c, i === 0 ? L.first : ch.length ? tpl(L.changes, { f: fieldNames(ch, L, lang) }) : L.none, 6, y + h, w - 12, fs, ch.length ? "fig-t-strong" : "fig-t-faint", out);
      if (ph.role === "mid") parts.push(el("rect", { x: 0, y: top - 2, width: w, height: h + 8, rx: 3, fill: C.panel }));
      parts.push(...out);
      y += h + 14;
      for (const f of fields) {
        const cc = cell(c, ph, f, labelW + 6, y, cw);
        const hh = Math.max(cc.h, fs + 3);
        if (ch.includes(f)) parts.push(mark(labelW + 6, y, cw, hh));
        parts.push(text(0, y + fs + 3, laneLabel(f), { "font-size": fs, class: "fig-t-muted" }));
        parts.push(cc.svg);
        y += hh + 12;
      }
      y += 10;
    });
  }
  return svg(w, y + 2, describe(st, lang), g({}, ...parts));
}

export default defineFigure({
  name: "phase-record",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    run: {
      kind: "choice", label: { en: "Run", zh: "训练运行" }, default: "olmo2",
      options: [
        { value: "olmo2", label: { en: "OLMo 2 7B", zh: "OLMo 2 7B" } },
        { value: "coder", label: { en: "Qwen2.5-Coder", zh: "Qwen2.5-Coder" } },
        { value: "dsmath", label: { en: "DeepSeekMath", zh: "DeepSeekMath" } },
        { value: "qwen1m", label: { en: "Qwen2.5-1M", zh: "Qwen2.5-1M" } },
      ],
    },
  },
  render,
  describe,
});
