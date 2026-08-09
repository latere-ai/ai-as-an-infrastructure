import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/frontiers/02-the-capability-horizon.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/frontiers/02-the-capability-horizon.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const references = (source: string) =>
  [...source.matchAll(/(?<![A-Za-z0-9])@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);

test("Chinese Chapter 71 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 能力地平线及其测量 \{#sec-capability-horizon\}/);
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
    "地平线是拟合得到的阈值",
    "阈值会改变答案",
    "约束如何向上传导",
    "趋势估计取决于条件",
    "经济任务衡量的是偏好，不是岗位",
    "能力不等于生产力",
    "基准会以不同方式老化",
    "预测是情景，不是测量",
    "争议所在",
    "建立测量台账",
    "延伸阅读",
  ]);
  expect(references(chinese)).toEqual(references(english));
  expect(chinese.match(/^```\{dot\}/gm)?.length).toBe(4);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(6);
  expect(chinese.match(/^:::: \{\.runnable\}/gm)?.length).toBe(1);
  expect(chinese.match(/^::: \{\.callout-tip\}/gm)?.length).toBe(1);
  expect(chinese.match(/^::: \{\.callout-important\}/gm)?.length).toBe(1);
});

test("the Chinese opening defines a moving measurement contract", () => {
  for (const phrase of [
    "不再是排行榜上的一个数字",
    "移动的地平线",
    "不是一个标量",
    "测量契约",
    "受测系统",
    "任务样本",
    "资源预算",
    "成功阈值",
    "快照日期",
    "经得起复测的进步",
    "算力堆出来的表象",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese task horizon is a fitted threshold with a complete protocol", () => {
  for (const marker of [
    "\\Pr(Y=1\\mid d)",
    "\\sigma(\\alpha-\\beta\\ln d)",
    "\\sigma(z)",
    "h_q",
    "\\operatorname{logit}(q)",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "人类完成时间",
    "二元结果",
    "拟合截距",
    "拟合斜率",
    "成功阈值",
    "固定的系统与协议",
    "估计值",
    "不是观测到的任务边界",
    "模型检查点",
    "智能体运行框架",
    "工具权限",
    "任务分布",
    "人类时间基线",
    "重复尝试",
    "词元预算",
    "时间预算",
    "评分规则",
    "测量日期",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese reliability section keeps threshold dependence and runnable evidence", () => {
  expect(chinese).toContain("\\frac{h_{0.5}}{h_{0.8}}");
  for (const phrase of [
    "取决于拟合斜率",
    "不是普适常数",
    "约四到六倍",
    "示例中点",
    "不会重新拟合",
    "相互独立且性质相同",
    "玩具模型",
    "不是因果解释",
  ]) expect(flat).toContain(phrase);
  const englishCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const chineseCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(chineseCell?.[1]).toBe(englishCell?.[1]);
});

test("wide Chinese horizon equations use mobile-safe aligned rows", () => {
  expect(chinese.match(/\\begin\{aligned\}/g)?.length).toBe(2);
  expect(chinese).toContain("\\Pr(Y=1\\mid d)&=\\sigma(\\alpha-\\beta\\ln d)");
  expect(chinese).toContain("\\operatorname{logit}(q)&=\\ln\\!\\left(\\frac{q}{1-q}\\right)");
});

test("the Chinese trend evidence retains version uncertainty and protocol drift", () => {
  for (const phrase of [
    "170 项扩展到 228 项",
    "31 项",
    "只有其中五项",
    "320 分钟",
    "170 至 729 分钟",
    "196.5 天",
    "130.8 天",
    "88.6 天",
    "不同的拟合窗口",
    "无法可靠测量超过 16 小时的地平线",
    "16 至 20 小时",
    "三至四小时",
    "内部共享模型",
    "1,600 万至 6,400 万词元",
    "不能视为一月公开模型序列的直接延续",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese economic evidence measures deliverable preference rather than jobs", () => {
  for (const phrase of [
    "1,320 项任务",
    "44 种职业",
    "九个行业",
    "220 项",
    "平均有 14 年经验",
    "47.6%",
    "胜出与持平之和",
    "84.9%",
    "2026 年 4 月 23 日",
    "xhigh 推理",
    "研究环境",
    "一次性交付",
    "隐性背景",
    "人工监督",
    "不是职业自动化率",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese RE-Bench evidence stays scoped to budgets and scoring", () => {
  for (const phrase of [
    "七个独立的机器学习研究工程环境",
    "61 名不同的人类专家",
    "71 次八小时尝试",
    "两小时总计算机时间预算",
    "约为人类平均标准化分数的四倍",
    "八小时",
    "32 小时",
    "约为最佳智能体的两倍",
    "best-of-k",
    "不是端到端研究自动化",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese productivity section separates causal and selected evidence", () => {
  for (const phrase of [
    "16 名拥有丰富开源经验的开发者",
    "246 项任务",
    "多花了 19% 的时间",
    "预计会快 24%",
    "认为自己快了 20%",
    "2025 年 2 月至 6 月",
    "回访开发者",
    "18% 的提速",
    "新加入的开发者",
    "4% 的提速",
    "选择偏差",
    "没有推翻随机对照结果",
    "四个不同的量",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese benchmark section separates aging mechanisms and protocols", () => {
  for (const phrase of [
    "上限效应、污染、协议漂移或可利用性",
    "超过 90%",
    "2,500 道",
    "100 多个学科",
    "46.44%",
    "不使用工具",
    "启用工具",
    "低于 5%",
    "84.6%",
    "不同的评测集",
    "尚未被解决",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese validity and exploit evidence retains its scope", () => {
  for (const phrase of [
    "29 名专家",
    "445 篇基准论文",
    "八项建议",
    "18 份需求量规",
    "15 个语言模型",
    "63 项任务",
    "十个智能体基准",
    "219 个缺陷",
    "十个中的九个",
    "对抗性审计",
    "不代表普通模型运行总是在作弊",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese forecast section distinguishes scenarios from measurements", () => {
  for (const phrase of [
    "八参数模型",
    "2032 年前后",
    "约 15 小时",
    "没有回测",
    "并不看重这个精确日期",
    "情景推演",
    "不是测量结果",
    "冻结任务",
    "系统预算",
    "可靠性阈值",
    "具名资源",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese measurement ledger makes frontier claims auditable", () => {
  for (const phrase of [
    "构念",
    "任务样本",
    "系统定义",
    "资源预算",
    "重复次数",
    "评分者",
    "完整性",
    "不确定性",
    "快照",
    "部署关联",
    "责任人",
    "何时已经过期",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/^\|/gm)?.length).toBe(13);
});

test("all Chapter 71 figures are preserved and localized", () => {
  expect([...chinese.matchAll(/\/\/\| label: (fig-[^\n]+)/g)].map((match) => match[1])).toEqual([
    "fig-horizon-contract",
    "fig-horizon-thresholds",
    "fig-economic-transfer",
    "fig-horizon-saturation",
  ]);
  expect(chinese.match(/^<figure id=/gm)?.length).toBe(1);
  for (const phrase of [
    'data-xlabel="发布后月数"',
    'data-ylabel="最高分（比例）"',
    'data-plabel="攀升陡峭度"',
  ]) expect(chinese).toContain(phrase);
});

test("the Chinese rewrite removes stale absolutes and translated rhetoric", () => {
  for (const phrase of [
    "/figures/the-capability-horizon-1.svg",
    "约 5h → 15h",
    "大约要短五倍",
    "复合衰减才是根因",
    "最好的模型在大约七成",
    "持平线已经越过",
    "从基本为零越过人类平均分",
    "测量仪器饱和得比新仪器造出来还快",
    "近来的提速，大半来自",
    "靠规模取得进步的时代正在终结",
    "这份迁移是真实的",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("every Chinese Chapter 71 Graphviz figure parses and fits mobile", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese Chapter 71 renders through its handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/the-capability-horizon.html",
    chapterTitle: "能力地平线及其测量",
    chapterNum: "71",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("前沿主张只有连同测量契约一起交付，才有使用价值");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(4);
  expect(html).toContain('<figure id="fig-the-capability-horizon-curve" class="rdr-figure">');
  expect(headings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
