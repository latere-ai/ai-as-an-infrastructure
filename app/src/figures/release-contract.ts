// Two release records from one lab, written as the chapter's release contract
// R_r(v, t) = (A_r, X_r, P_r, O_r, E_r). Each pair is two releases the chapter
// names from the same organization, and every value is a fact the chapter
// states with a citation (its dated examples and dated notes, as of 7 August
// and September 2026). Where the chapter records nothing for a field, the
// value is null and the figure draws it as not recorded, the unknown outcome
// of the release gate, never a guess.
//
// Each value carries a kind (download, hosted, Apache 2.0, model card, ...).
// Two releases differ on a field when the kinds differ; a field is unresolved
// when either value is null. The summary grid is computed from those kinds for
// every pair, so it shows which subset of fields changes inside one lab.

import { defineFigure, type Lang, type State, type Text } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapCJK } from "./lib/notation.ts";
import { tpl } from "./lib/format.ts";

type FieldKey = "A" | "X" | "P" | "O" | "E";
const FIELDS: FieldKey[] = ["A", "X", "P", "O", "E"];

interface Value { kind: string; en: string; zh: string }
interface Release {
  name: string; // release name as the chapter writes it (same in both languages)
  v: Text; // revision line
  t: Text; // snapshot date of the chapter block the facts come from
  source: Text; // the cited document, readable
  f: Record<FieldKey, Value | null>;
}
interface Pair { key: PairKey; lab: Text; a: Release; b: Release }

const AUG = { en: "as of 7 August 2026", zh: "截至 2026 年 8 月 7 日" };
const SEP = { en: "as of September 2026", zh: "截至 2026 年 9 月" };

// Values shared by several releases.
const DOWNLOAD: Value = { kind: "download", en: "Downloadable weights", zh: "可下载权重" };
const SELF: Value = { kind: "self", en: "The operator runs it and owns capacity, patching, monitoring, incidents", zh: "运营者自担容量、修补、监控和事故响应" };
const APACHE: Value = { kind: "apache", en: "Apache 2.0", zh: "Apache 2.0" };
const CARD: Value = { kind: "card", en: "Model card", zh: "模型卡" };
const WEIGHTS: Value = { kind: "weights", en: "Weights", zh: "权重" };

type PairKey = "anthropic" | "openai" | "deepseek" | "qwen" | "zai" | "meta" | "google";

const PAIRS: Pair[] = [
  {
    key: "anthropic", lab: { en: "Anthropic", zh: "Anthropic" },
    a: {
      name: "Claude Fable 5.1", v: { en: "Claude Fable 5.1", zh: "Claude Fable 5.1" }, t: SEP,
      source: { en: "Introducing Claude Fable 5.1 and Claude Mythos 5.1 (Anthropic, 2026)", zh: "Introducing Claude Fable 5.1 and Claude Mythos 5.1（Anthropic，2026）" },
      f: {
        A: { kind: "hosted-ga", en: "Hosted, generally available, stricter safeguard level", zh: "托管服务，全面开放，保护措施较严" },
        X: { kind: "same-model", en: "No weight release; the same model as Mythos 5.1", zh: "不发布权重；与 Mythos 5.1 是同一个模型" },
        P: null,
        O: { kind: "provider", en: "Anthropic operates it", zh: "由 Anthropic 运营" },
        E: { kind: "announce", en: "Launch announcement", zh: "发布公告" },
      },
    },
    b: {
      name: "Claude Mythos 5.1", v: { en: "Claude Mythos 5.1", zh: "Claude Mythos 5.1" }, t: SEP,
      source: { en: "Introducing Claude Fable 5.1 and Claude Mythos 5.1 (Anthropic, 2026)", zh: "Introducing Claude Fable 5.1 and Claude Mythos 5.1（Anthropic，2026）" },
      f: {
        A: { kind: "hosted-trusted", en: "Hosted, only via trusted-access programs for cyber defense and life sciences; less restricted safeguards", zh: "托管服务，只通过面向网络安全防御和生命科学工作的可信访问计划提供，保护措施限制较少" },
        X: { kind: "same-model", en: "No weight release; the same model as Fable 5.1", zh: "不发布权重；与 Fable 5.1 是同一个模型" },
        P: null,
        O: { kind: "provider", en: "Anthropic operates it", zh: "由 Anthropic 运营" },
        E: { kind: "announce", en: "Launch announcement", zh: "发布公告" },
      },
    },
  },
  {
    key: "openai", lab: { en: "OpenAI", zh: "OpenAI" },
    a: {
      name: "gpt-oss-120b", v: { en: "gpt-oss-120b, released 5 August 2025", zh: "gpt-oss-120b，2025 年 8 月 5 日发布" }, t: AUG,
      source: { en: "Introducing gpt-oss (OpenAI, 2025)", zh: "Introducing gpt-oss（OpenAI，2025）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "Weights, tokenizer material, reference inference code", zh: "权重、分词器材料、参考推理实现" },
        P: APACHE,
        O: SELF,
        E: { kind: "card", en: "Model card; a high-level description of the mostly English, text-only data", zh: "模型卡；对以英文为主、仅含文本的训练数据只作高层说明" },
      },
    },
    b: {
      name: "GPT-5.6 Sol", v: { en: "GPT-5.6 Sol", zh: "GPT-5.6 Sol" }, t: SEP,
      source: { en: "OpenAI API changelog (2026)", zh: "OpenAI API 更新日志（2026）" },
      f: {
        A: { kind: "hosted-tier", en: "Hosted; Daybreak Blue is a separately approved tier for defensive security work", zh: "托管服务；Daybreak Blue 是面向防御性安全工作、需单独审批的层级" },
        X: { kind: "none", en: "No weights; hosted products only", zh: "不提供权重，只能通过托管产品使用" },
        P: null,
        O: { kind: "provider", en: "OpenAI operates it", zh: "由 OpenAI 运营" },
        E: { kind: "announce", en: "API changelog entry, 7 August 2026", zh: "API 更新日志条目，2026 年 8 月 7 日" },
      },
    },
  },
  {
    key: "deepseek", lab: { en: "DeepSeek", zh: "DeepSeek" },
    a: {
      name: "DeepSeek-V3", v: { en: "DeepSeek-V3", zh: "DeepSeek-V3" }, t: AUG,
      source: { en: "DeepSeek-V3 Technical Report (DeepSeek-AI, 2024)", zh: "DeepSeek-V3 Technical Report（DeepSeek-AI，2024）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "Weights and reference code; pretraining corpus not published", zh: "权重和参考代码；预训练语料未公开" },
        P: { kind: "split", en: "Reference code and original weights under different licenses", zh: "参考代码与原始权重采用不同许可证" },
        O: SELF,
        E: { kind: "report", en: "Technical report: architecture, training choices, evaluations", zh: "技术报告：架构、训练选择、评测" },
      },
    },
    b: {
      name: "DeepSeek-V4-Pro", v: { en: "DeepSeek-V4-Pro", zh: "DeepSeek-V4-Pro" }, t: SEP,
      source: { en: "DeepSeek-V4-Pro model card (DeepSeek-AI, 2026)", zh: "DeepSeek-V4-Pro 模型卡（DeepSeek-AI，2026）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "Repository and weights", zh: "代码仓库和权重" },
        P: { kind: "mit", en: "MIT License for repository and weights", zh: "代码仓库和权重都采用 MIT 许可证" },
        O: SELF,
        E: CARD,
      },
    },
  },
  {
    key: "qwen", lab: { en: "Qwen", zh: "Qwen" },
    a: {
      name: "Qwen3.8", v: { en: "Qwen3.8 flagship, Qwen3.8-2.4T-A95B", zh: "Qwen3.8 旗舰模型，Qwen3.8-2.4T-A95B" }, t: SEP,
      source: { en: "Qwen3.8-Max License (Qwen Team, 2026)", zh: "Qwen3.8-Max License（Qwen Team，2026）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "Weights: 2.4T parameters, 95B active per token", zh: "权重：总参数 2.4 万亿，每个词元激活 950 亿" },
        P: { kind: "clause", en: "Permissive grant; hosting or AI work-assistant businesses above US$50M in 12 months need a separate license; internal use exempt", zh: "宽松授权；连续十二个月收入超过 5,000 万美元的模型即服务或 AI 办公助手业务须另行取得许可；内部使用豁免" },
        O: SELF,
        E: null,
      },
    },
    b: {
      name: "Qwen3.8-27B", v: { en: "Qwen3.8-27B", zh: "Qwen3.8-27B" }, t: SEP,
      source: { en: "Qwen3.8-27B model card (Qwen Team, 2026)", zh: "Qwen3.8-27B 模型卡（Qwen Team，2026）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "Weights: 27B parameters", zh: "权重：270 亿参数" },
        P: APACHE,
        O: SELF,
        E: CARD,
      },
    },
  },
  {
    key: "zai", lab: { en: "Z.ai", zh: "Z.ai" },
    a: {
      name: "GLM-5.3", v: { en: "GLM-5.3", zh: "GLM-5.3" }, t: SEP,
      source: { en: "GLM-5.3 License (Z.ai, 2026)", zh: "GLM-5.3 License（Z.ai，2026）" },
      f: {
        A: DOWNLOAD,
        X: WEIGHTS,
        P: { kind: "clause", en: "Permissive grant; operators above US$10B must pass a Z.ai security review", zh: "宽松授权；收入超过 100 亿美元的运营方须先通过 Z.ai 的安全审查" },
        O: SELF,
        E: null,
      },
    },
    b: {
      name: "GLM-5.3-Flash", v: { en: "GLM-5.3-Flash", zh: "GLM-5.3-Flash" }, t: SEP,
      source: { en: "GLM-5.3-Flash model card (Z.ai, 2026)", zh: "GLM-5.3-Flash 模型卡（Z.ai，2026）" },
      f: {
        A: DOWNLOAD,
        X: WEIGHTS,
        P: { kind: "mit", en: "MIT License", zh: "MIT 许可证" },
        O: SELF,
        E: CARD,
      },
    },
  },
  {
    key: "meta", lab: { en: "Meta", zh: "Meta" },
    a: {
      name: "Muse Spark", v: { en: "Muse Spark, announced 8 April 2026", zh: "Muse Spark，2026 年 4 月 8 日发布" }, t: SEP,
      source: { en: "Introducing Muse Spark (Meta, 2026)", zh: "Introducing Muse Spark（Meta，2026）" },
      f: {
        A: { kind: "app", en: "Meta AI app and meta.ai; private API preview for selected users", zh: "Meta AI 应用和 meta.ai；面向部分用户的私有 API 预览" },
        X: { kind: "none", en: "No weights offered", zh: "不提供权重" },
        P: null,
        O: { kind: "provider", en: "Meta operates it", zh: "由 Meta 运营" },
        E: { kind: "announce", en: "Launch announcement", zh: "发布文章" },
      },
    },
    b: {
      name: "Muse Glimmer", v: { en: "Muse Glimmer 30B, August 2026", zh: "Muse Glimmer 30B，2026 年 8 月" }, t: SEP,
      source: { en: "Muse Glimmer 30B model card (Meta, 2026)", zh: "Muse Glimmer 30B 模型卡（Meta，2026）" },
      f: {
        A: DOWNLOAD,
        X: { kind: "weights", en: "30B weights distilled from Muse Spark", zh: "从 Muse Spark 蒸馏得到的 300 亿参数权重" },
        P: { kind: "apache-policy", en: "Apache 2.0 plus a linked usage policy; not intended for users under 18", zh: "Apache 2.0，另附一份使用政策；不面向 18 岁以下用户" },
        O: SELF,
        E: CARD,
      },
    },
  },
  {
    key: "google", lab: { en: "Google", zh: "Google" },
    a: {
      name: "Gemma 1 to 3", v: { en: "Gemma 1, 2, and 3", zh: "Gemma 1、2、3" }, t: AUG,
      source: { en: "Gemma Terms of Use (Google, 2026)", zh: "Gemma Terms of Use（Google，2026）" },
      f: {
        A: DOWNLOAD,
        X: WEIGHTS,
        P: { kind: "custom", en: "Gemma Terms of Use: use restrictions, conditions on distribution and derivative models", zh: "Gemma 使用条款：包含使用限制，并对分发和衍生模型设定条件" },
        O: SELF,
        E: null,
      },
    },
    b: {
      name: "Gemma 4", v: { en: "Gemma 4", zh: "Gemma 4" }, t: AUG,
      source: { en: "Gemma 4 model card (Google, 2026)", zh: "Gemma 4 模型卡（Google，2026）" },
      f: {
        A: DOWNLOAD,
        X: WEIGHTS,
        P: APACHE,
        O: SELF,
        E: CARD,
      },
    },
  },
];

type Verdict = "differs" | "same" | "unknown";

function verdict(pair: Pair, k: FieldKey): Verdict {
  const a = pair.a.f[k], b = pair.b.f[k];
  if (!a || !b) return "unknown";
  return a.kind === b.kind ? "same" : "differs";
}

const byKey = (k: PairKey) => PAIRS.find((p) => p.key === k)!;

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Two release records from one lab",
    grid: "Fields that differ between two releases of one lab",
    A: "Access channel", X: "Artifacts", P: "Terms", O: "Operations", E: "Evidence",
    differs: "differs", same: "same", unresolved: "unresolved", unknown: "not recorded for one or both",
    notRecorded: "not recorded in this chapter",
    source: "Source: {s}",
    readout: "{lab}: {k} of 5 fields differ{list}, {u} unresolved. The lab name identifies neither record.",
    describe: "{lab}: {a} and {b} differ in {k} of the five contract fields{list}; {u} unresolved because the chapter records nothing for one or both. The subset of fields that differ is not the same for every lab.",
    and: " and ",
    sep: ", ",
  },
  zh: {
    title: "同一实验室的两份发布记录",
    grid: "同一实验室两次发布之间有差异的字段",
    A: "访问渠道", X: "制品", P: "许可与条款", O: "运营", E: "证据",
    differs: "不同", same: "相同", unresolved: "待定", unknown: "至少一方未记录",
    notRecorded: "本章未记录",
    source: "来源：{s}",
    readout: "{lab}：5 个字段中 {k} 个不同{list}，{u} 个待定。仅凭实验室名称，确定不了其中任何一份记录。",
    describe: "{lab}：{a} 与 {b} 在五个契约字段中有 {k} 个不同{list}；{u} 个字段因本章对其中一方或双方没有记录而待定。并非每家实验室都是同一组字段不同。",
    and: "和",
    sep: "、",
  },
};

type L = typeof labels.en;
type P = { pair: PairKey };

function fieldList(keys: FieldKey[], L: L): string {
  if (!keys.length) return "";
  return keys.map((k) => L[k].toLowerCase()).join(L.sep);
}

function counts(pair: Pair) {
  const differs = FIELDS.filter((k) => verdict(pair, k) === "differs");
  const unknown = FIELDS.filter((k) => verdict(pair, k) === "unknown");
  return { differs, unknown };
}

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const pair = byKey(st.p.pair);
  const { differs, unknown } = counts(pair);
  const list = differs.length ? (lang === "zh" ? `（${fieldList(differs, L)}）` : ` (${fieldList(differs, L)})`) : "";
  return tpl(L.describe, { lab: pair.lab[lang], a: pair.a.name, b: pair.b.name, k: differs.length, list, u: unknown.length });
}

// ---------------------------------------------------------------- render

const LINE = 15; // line height of 12 px body text

// wrapCJK, plus the other half of the line-break rule: an opening bracket
// never ends a line. wrapCJK keeps closing punctuation off a line start by
// moving the glyph before it down, which can widen the next line past the
// width; when that happens the text is wrapped again one glyph narrower.
function lines(s: string, size: number, width: number): string[] {
  let out = wrapCJK(s, size, width);
  if (out.some((ln) => textWidth(ln, size) > width)) out = wrapCJK(s, size, width - size * 1.02);
  for (let i = 0; i < out.length - 1; i++) {
    while (/[（「]$/u.test(out[i])) {
      out[i + 1] = out[i].slice(-1) + out[i + 1];
      out[i] = out[i].slice(0, -1);
    }
  }
  return out;
}

function textBlock(x: number, y: number, ls: string[], a: Record<string, string | number>): string {
  return ls.map((ln, i) => text(x, y + i * LINE, ln, a)).join("");
}

// The summary grid: one row per lab, one column per field, a mark for the
// verdict. Rows are hit targets that choose the pair.
function renderGrid(p: P, w: number, y0: number, L: L, lang: Lang, narrow: boolean): { svg: string; h: number } {
  const parts: string[] = [];
  parts.push(text(0, y0 + 13, L.grid, { "font-size": TYPE.label, class: "fig-t-strong" }));
  const labW = narrow ? 76 : 104;
  const colW = Math.min(narrow ? 48 : 96, (w - labW) / FIELDS.length);
  const cx = (i: number) => labW + colW * (i + 0.5);
  let y = y0 + 34;
  FIELDS.forEach((k, i) => {
    parts.push(text(cx(i), y, k, { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-strong" }));
    if (!narrow) parts.push(text(cx(i), y + 14, L[k], { "font-size": TYPE.small, "text-anchor": "middle", class: "fig-t-muted" }));
  });
  y += narrow ? 8 : 22;
  const rowH = 22;
  for (const pair of PAIRS) {
    const sel = pair.key === p.pair;
    if (sel) parts.push(el("rect", { x: 0, y, width: labW + colW * FIELDS.length, height: rowH, rx: 3, fill: C.panel }));
    parts.push(text(6, y + 15, pair.lab[lang], { "font-size": TYPE.body, class: sel ? "fig-t-strong" : undefined }));
    FIELDS.forEach((k, i) => {
      const v = verdict(pair, k);
      const cy = y + rowH / 2;
      if (v === "differs") parts.push(el("circle", { cx: cx(i), cy, r: 5.5, fill: C.c1 }));
      else if (v === "same") parts.push(el("circle", { cx: cx(i), cy, r: 4.5, fill: "none", stroke: C.ink3, "stroke-width": 1.3 }));
      else parts.push(text(cx(i), cy + 4.5, "?", { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
    });
    parts.push(el("rect", { x: 0, y, width: labW + colW * FIELDS.length, height: rowH, fill: "transparent", "data-fig-set": `pair=${pair.key}`, class: "fig-hit" }));
    y += rowH;
  }
  // Key for the three marks.
  y += 18;
  let x = 6;
  const items: Array<[string, string]> = [["d", L.differs], ["s", L.same], ["u", L.unknown]];
  for (const [kind, label] of items) {
    const need = 18 + textWidth(label, TYPE.small);
    if (x > 6 && x + need > w) { x = 6; y += 18; }
    if (kind === "d") parts.push(el("circle", { cx: x + 5, cy: y - 4, r: 5, fill: C.c1 }));
    else if (kind === "s") parts.push(el("circle", { cx: x + 5, cy: y - 4, r: 4.2, fill: "none", stroke: C.ink3, "stroke-width": 1.3 }));
    else parts.push(text(x + 5, y, "?", { "font-size": TYPE.body, "text-anchor": "middle", class: "fig-t-muted" }));
    parts.push(text(x + 15, y, label, { "font-size": TYPE.small, class: "fig-t-muted" }));
    x += need + 16;
  }
  return { svg: g({ class: "fig-grid" }, ...parts), h: y - y0 + 6 };
}

// The chosen pair as one table: a header per release, one row per field.
function renderTable(p: P, w: number, y0: number, L: L, lang: Lang, narrow: boolean): { svg: string; h: number } {
  const pair = byKey(p.pair);
  const parts: string[] = [];
  const labW = narrow ? 0 : 122;
  const gap = narrow ? 10 : 16;
  const colW = (w - labW - gap) / 2;
  const xs = [labW, labW + colW + gap];
  const rels = [pair.a, pair.b];
  const pad = 6;

  // Header: release name, revision if it adds anything, snapshot date.
  let y = y0;
  const head = rels.map((r) => {
    const out: Array<[string[], string]> = [[lines(r.name, TYPE.label, colW - pad), "fig-t-strong"]];
    if (r.v[lang] !== r.name) out.push([lines(`v: ${r.v[lang]}`, TYPE.small, colW - pad), "fig-t-muted"]);
    out.push([lines(`t: ${r.t[lang]}`, TYPE.small, colW - pad), "fig-t-muted"]);
    return out;
  });
  const headH = Math.max(...head.map((blocks) => blocks.reduce((s, [ls]) => s + ls.length * LINE, 0)));
  head.forEach((blocks, i) => {
    let yy = y + 13;
    for (const [ls, cls] of blocks) {
      parts.push(textBlock(xs[i] + pad, yy, ls, { "font-size": cls === "fig-t-strong" ? TYPE.label : TYPE.small, class: cls }));
      yy += ls.length * LINE;
    }
  });
  y += headH + 8;

  // Field rows.
  for (const k of FIELDS) {
    const v = verdict(pair, k);
    const vals = rels.map((r) => r.f[k]);
    const valLines = vals.map((val) => lines(val ? val[lang] : L.notRecorded, TYPE.body, colW - 2 * pad));
    const tag = v === "differs" ? L.differs : v === "same" ? L.same : L.unresolved;
    const tagLines = narrow ? [] : lines(tag, TYPE.small, labW - pad - 8);
    const labelTop = narrow ? 20 : 0;
    const bodyH = Math.max(...valLines.map((ls) => ls.length)) * LINE + 10;
    const rowH = labelTop + Math.max(bodyH, narrow ? 0 : 22 + (1 + tagLines.length) * LINE - 8);
    parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));
    if (v === "differs") parts.push(el("rect", { x: 0, y: y + 3, width: 3, height: rowH - 6, rx: 1.5, fill: C.c1 }));
    const name = `${k}  ${L[k]}`;
    if (narrow) {
      parts.push(text(pad + 2, y + 15, name, { "font-size": TYPE.body, class: v === "differs" ? "fig-t-strong" : undefined }));
      parts.push(text(w, y + 15, tag, { "font-size": TYPE.small, "text-anchor": "end", class: "fig-t-muted" }));
    } else {
      parts.push(text(pad + 4, y + 17, name, { "font-size": TYPE.body, class: v === "differs" ? "fig-t-strong" : undefined }));
      parts.push(textBlock(pad + 4, y + 17 + LINE, tagLines, { "font-size": TYPE.small, class: "fig-t-muted" }));
    }
    vals.forEach((val, i) => {
      const top = y + labelTop + 4;
      if (!val) parts.push(el("rect", { x: xs[i] + 1, y: top, width: colW - 2, height: bodyH - 6, rx: 3, fill: "none", stroke: C.ink3, "stroke-width": 1, "stroke-dasharray": "3 3" }));
      parts.push(textBlock(xs[i] + pad, top + 13, valLines[i], val ? { "font-size": TYPE.body } : { "font-size": TYPE.body, class: "fig-t-muted" }));
    });
    y += rowH;
  }
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid, "stroke-width": 1 }));

  // Sources under each column.
  y += 16;
  const src = rels.map((r) => lines(tpl(L.source, { s: r.source[lang] }), TYPE.small, colW - pad));
  src.forEach((ls, i) => parts.push(textBlock(xs[i] + pad, y, ls, { "font-size": TYPE.small, class: "fig-t-muted" })));
  y += Math.max(...src.map((ls) => ls.length)) * LINE + 8;

  // Readout.
  const { differs, unknown } = counts(pair);
  const list = differs.length ? (lang === "zh" ? `（${fieldList(differs, L)}）` : ` (${fieldList(differs, L)})`) : "";
  const ro = lines(tpl(L.readout, { lab: pair.lab[lang], k: differs.length, list, u: unknown.length }), TYPE.body, w);
  parts.push(textBlock(0, y + 6, ro, { "font-size": TYPE.body }));
  y += ro.length * LINE + 6;
  return { svg: g({ class: "fig-table" }, ...parts), h: y - y0 };
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const narrow = w < 480;
  const grid = renderGrid(st.p, w, 0, L, lang, narrow);
  const table = renderTable(st.p, w, grid.h + 24, L, lang, narrow);
  return svg(w, grid.h + 24 + table.h + 6, describe(st, lang), grid.svg, table.svg);
}

export default defineFigure({
  name: "release-contract",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    pair: {
      kind: "choice", control: "select", label: { en: "Lab", zh: "实验室" }, default: "meta",
      options: PAIRS.map((p) => ({ value: p.key, label: { en: `${p.lab.en}: ${p.a.name} and ${p.b.name}`, zh: `${p.lab.zh}：${p.a.name} 与 ${p.b.name}` } })),
    },
  },
  render,
  describe,
});
