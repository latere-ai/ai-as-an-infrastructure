import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 76 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 算力市场与单位经济性 \{#sec-economics\}/);
  expect(headings(chinese)).toEqual([
    ["##", "拆开三个不同的决策"],
    ["##", "建立完整的成本账本"],
    ["##", "按实际完成的工作衡量服务成本"],
    ["##", "不同算力产品承诺的东西不同"],
    ["##", "看清历史成本数据的边界"],
    ["##", "争议所在"],
    ["##", "约束如何传导"],
    ["##", "按场景比较购买与自托管"],
    ["##", "用分布而非平均值描述需求"],
    ["##", "区分现金流、会计费用与经济成本"],
    ["##", "持续校准经济模型"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis compares cost per accepted result under one operating contract", () => {
  for (const phrase of [
    "发票还不是经济模型",
    "算力从哪里购买",
    "训练和推理为何是两类不同的成本",
    "何时应该自建模型",
    "何时应该通过 API 购买能力",
    "推理是否主导全生命周期成本",
    "工作负载",
    "服务目标",
    "时间范围",
    "核算边界",
    "每个合格结果的成本",
    "同一份运行契约",
  ]) expect(flat).toContain(phrase);
});

test("build or buy remains three separate decisions with feasibility gates", () => {
  for (const phrase of [
    "创建还是获取能力",
    "自行运行还是外包服务",
    "采购哪种容量",
    "从头训练",
    "继续训练或微调",
    "开放权重",
    "托管端点",
    "可中断的竞价容量",
    "先判断可行性，再比较价格",
    "质量门槛",
    "尾延迟目标",
    "隐私边界",
    "许可条款",
    "人工复核",
    "非价格约束并不必然意味着从头训练",
  ]) expect(flat).toContain(phrase);
});

test("the complete ledger defines every cost and denominator", () => {
  for (const marker of [
    "C_{\\mathrm{total}}",
    "C_{\\mathrm{build}}",
    "C_{\\mathrm{run},t}",
    "C_{\\mathrm{people},t}",
    "C_{\\mathrm{data},t}",
    "C_{\\mathrm{network},t}",
    "C_{\\mathrm{failure},t}",
    "N_{\\mathrm{accept}}",
    "u_{\\mathrm{accept}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "评估周期",
    "常规运行之前",
    "数据获取、标注、保留与删除",
    "失败与重试工作",
    "共享成本分摊规则",
    "加速器小时数",
    "有争议的分摊项",
    "原始请求数",
    "原始输出词元数",
    "每个已解决案例",
    "每单位用户价值的成本",
  ]) expect(flat).toContain(phrase);
});

test("serving unit cost uses realized work without counting utilization twice", () => {
  for (const marker of [
    "C_{\\mathrm{accel}}",
    "r_{\\mathrm{eff}}",
    "H_{\\mathrm{billed}}",
    "u_{\\mathrm{accel}}",
    "N_{\\mathrm{accept}}/H_{\\mathrm{billed}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "实际吞吐量",
    "不要再除以一次利用率",
    "输入词元、缓存词元和输出词元",
    "预填充和解码",
    "内部推理",
    "缓存命中率",
    "p50、p95 和 p99 延迟",
    "合格结果吞吐量",
    "工程投入、更大的副本或更低的缓存命中率",
  ]) expect(flat).toContain(phrase);
});

test("the procurement table preserves five products and their distinct risks", () => {
  for (const phrase of [
    "| 自有容量 |",
    "| 预留或承诺容量 |",
    "| 按需容量 |",
    "| 竞价或可抢占容量 |",
    "| 托管端点或 API |",
    "容量保障",
    "主要经济风险",
    "合适的证据",
    "资本闲置或设备过时",
    "需求低于承诺量",
    "检查点新旧程度",
    "模型修订版本",
    "提前两分钟通知",
    "未使用的承诺量",
    "电力无法按期交付",
  ]) expect(flat).toContain(phrase);
});

test("historical claims stay inside the boundary of each source", () => {
  for (const phrase of [
    "固定训练算力预算",
    "固定质量目标",
    "不代表某一种模型形状能让所有部署的全生命周期成本最低",
    "约 45 个前沿模型",
    "每年约增长 2.4 倍",
    "不是经过审计的现金支出",
    "278.8 万个 H800 GPU 小时",
    "自行报告",
    "不是经过审计的开发总成本",
    "六项基准",
    "与任务有关",
    "标价并不等于提供商的生产成本",
    "不要把短期历史降幅外推成必然的预测",
  ]) expect(flat).toContain(phrase);
});

test("the contested section and constraint arrow keep the claim conditional", () => {
  for (const phrase of [
    "推理是否主导全生命周期成本，并没有放之四海而皆准的答案",
    "一个翻译系统",
    "几个推荐系统",
    "开发和服务必须采用相同的时间范围",
    "场景分析的结果",
    "不是人工智能的固有属性",
    "成本预测会反过来影响模型设计",
    "训练算力最优点",
    "预期部署需求",
    "共享同一份工作负载和验收契约",
  ]) expect(flat).toContain(phrase);
});

test("buy versus self-host compares discounted scenarios before the shortcut", () => {
  for (const marker of [
    "C_{\\mathrm{buy}}",
    "C_{\\mathrm{self}}",
    "d_t = (1+r)^{-t}",
    "\\mathbb{E}[C_a]",
    "\\pi_s",
    "V^* = \\frac{F}{p-c}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "折现后的全成本",
    "低、中、高三种需求",
    "一次容量短缺",
    "一次模型迁移",
    "一次严重事故",
    "未折现的年度现金流",
    "尾部风险",
    "只是诊断工具，不是决策本身",
    "按离散台阶增加",
    "最低承诺量",
    "切换成本或退出成本",
  ]) expect(flat).toContain(phrase);
});

test("the localized interactive figure preserves the current English parameters", () => {
  for (const phrase of [
    'id="fig-economics-cost-crossover"',
    'data-x-label="可比用量（百万单位）"',
    'data-y-label="总成本（美元）"',
    'data-a-label="购买（API）"',
    'data-b-label="自托管"',
    'data-b-fixed="2650000"',
    'data-b-rate="0.25"',
    'data-b-fixed-label="自托管固定成本（美元）"',
    "质量差异、需求不确定性、容量台阶、故障或退出成本",
  ]) expect(chinese).toContain(phrase);
});

test("the runnable is identical to English and exposes four reversals", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(enCell).not.toBeNull();
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", zhCell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "base: buy=$3.20M self=$3.05M -> self-host\n" +
      "api-price-down: buy=$2.08M self=$3.05M -> API\n" +
      "demand-down: buy=$1.60M self=$2.85M -> API\n" +
      "peak-capacity-up: buy=$3.20M self=$3.65M -> API\n",
  );
});

test("demand is modeled as a distribution with stepwise capacity", () => {
  for (const phrase of [
    "平均需求不能充当容量规划",
    "到达分布",
    "请求与响应大小",
    "并发量",
    "地理分布",
    "突发流量",
    "维护、故障",
    "尾延迟目标",
    "成本就会按台阶上升",
    "代表性的稳定时段",
    "p50 日",
    "p95 峰值",
    "p99 压力时段",
    "移除一个故障域",
    "检查点频率",
    "配额",
    "锁定报价与模型修订版本的日期",
  ]) expect(flat).toContain(phrase);
});

test("cash accounting economic cost and financing remain separate views", () => {
  for (const phrase of [
    "现金流",
    "会计费用",
    "经济成本",
    "机会成本",
    "预期残值",
    "改变折旧估计只会改变会计费用确认的时间",
    "不会改变已经支付的现金",
    "使用寿命和残值的敏感性",
    "债务、租赁或特殊目的载体",
    "不会让底层容量变成免费资源",
    "折现率、固定承诺和下行情景",
    "明确的分摊规则",
  ]) expect(flat).toContain(phrase);
});

test("the eight-step operating loop reconciles forecasts with evidence", () => {
  for (const phrase of [
    "冻结工作负载",
    "筛选可行方案",
    "测量候选方案",
    "统一成本账本",
    "建立场景模型",
    "演练退出",
    "批准承诺",
    "核对实际结果",
    "报价与发票版本",
    "模型和运行时摘要",
    "已计费容量与有效容量",
    "人员成本分摊",
    "无法区分价格漂移、需求预测错误、质量不合格或运行退化",
    "便宜的词元不一定带来便宜的结果",
  ]) expect(flat).toContain(phrase);
  const section = chinese.match(/## 持续校准经济模型\n([\s\S]*?)\n```\{dot\}/);
  expect(section).not.toBeNull();
  expect(section![1].match(/^\d+\. /gm)?.length).toBe(8);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  for (const figure of [
    "fig-economics-ledger",
    "fig-economics-cost-crossover",
    "fig-economics-decision",
  ]) expect(chinese).toContain(figure);
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chinese.match(/```\{=html\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(10);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  for (const stale of [
    "fig-economics-1",
    "fig-economics-2",
    "fig-economics-cost-structures",
    "fig-economics-curve",
    "fig-economics-build-buy",
    "剪刀：训练上升，推断下降",
    "资本这一层",
    "钱在打圈流动",
    "铁路狂潮",
    "调用方变成智能体后",
  ]) expect(chinese).not.toContain(stale);
  expect(chinese).not.toContain("—");
});

test("every localized Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese chapter renders through the market-structure handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/economics.html",
    chapterTitle: "算力市场与单位经济性",
    chapterNum: "76",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings: renderedHeadings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("便宜的词元不一定带来便宜的结果");
  expect(html.match(/<figure/g)?.length).toBe(3);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
