import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const references = (source: string) =>
  [...source.matchAll(/(?<![A-Za-z0-9])@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);

test("Chinese Chapter 70 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 学习在哪里遇到极限 \{#sec-learning-limits\}/);
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
    "语料存量预测不是耗尽倒计时",
    "约束如何向上传导",
    "合成数据改变的是生成协议",
    "可验证经验改变监督瓶颈",
    "测试时算力必须解决选择问题",
    "部署系统有三类可变状态",
    "幻觉问题需要证据边界",
    "让每条突破路径都可以证伪",
    "争议所在",
    "极限是一道接口",
    "延伸阅读",
  ]);
  expect(references(chinese)).toEqual(references(english));
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(16);
});

test("the Chinese opening separates four learning boundaries", () => {
  for (const phrase of [
    "资源极限",
    "目标函数极限",
    "适应边界",
    "证据极限",
    "不能混为一谈",
    "公开的人类文本",
    "合成样本",
    "经过验证的经验",
    "检索到的证据",
    "参数更新",
    "任务分布、信息来源、更新规则、计算预算和验收测试",
    "故障契约",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese public-text forecast remains conditional", () => {
  for (const phrase of [
    "原始存量",
    "510 万亿词元",
    "130 万亿至 2,100 万亿",
    "有效存量",
    "400 万亿词元",
    "每年增长 2.4 倍",
    "2026 至 2032 年",
    "中位数为 2028 年",
    "提前一到两年",
    "预测，不是观测结果",
    "不是文本在物理上被消耗掉",
    "去重后保留的唯一词元",
    "数据集规模",
    "训练词元暴露量",
  ]) expect(flat).toContain(phrase);
  expect(chinese).not.toContain("300T");
  expect(chinese).not.toContain("80% 的概率");
});

test("the Chinese crossing model exposes assumptions and stays executable", () => {
  for (const marker of [
    "D(t)=D_0 g^{t-t_0}",
    "t^*",
    "\\frac{\\ln(S/D_0)}{\\ln g}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "预计数据集需求",
    "可用存量",
    "年增长因子",
    "固定的指数增长率",
    "敏感性计算",
  ]) expect(flat).toContain(phrase);
  const englishCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const chineseCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(chineseCell?.[1]).toBe(englishCell?.[1]);
});

test("the Chinese synthetic-data section distinguishes protocols and evidence scope", () => {
  for (const phrase of [
    "替换协议",
    "累积协议",
    "保留的人类数据基底",
    "混合权重与去重策略",
    "低概率的尾部事件",
    "OPT-125M",
    "WikiText-2",
    "束搜索",
    "10% 的原始数据",
    "有限上界",
    "线性模型定理",
    "并不能证明",
    "1,800 亿词元",
    "14 项基准",
    "最高提升 5.1 个百分点",
    "最高达到开放网络基线的 7.7 倍",
    "2 亿词元",
    "5.17 倍",
    "扩展律外推",
    "并不意味着固定语料可以带来无限改进",
    "教师检查点",
    "生成策略",
    "留出的人类评测集",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese RLVR section separates coverage from deployed selection", () => {
  for (const marker of [
    "\\operatorname{pass}@k(x)",
    "1-(1-p)^k",
    "\\widehat{\\operatorname{pass}@k}(x)",
    "\\frac{\\binom{n-c_x}{k}}{\\binom{n}{k}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "可验证奖励强化学习",
    "自动检查器",
    "奖励覆盖率",
    "奖励投机",
    "至少有一个",
    "覆盖率指标",
    "选择规则",
    "无法判断应该返回哪个候选结果",
    "数学、编程和视觉推理",
    "NeurIPS 2025",
    "不同的训练协议",
    "15 亿参数",
    "不能据此确定绝对的能力边界",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese test-time-compute section has an explicit selection path", () => {
  for (const phrase of [
    "生成器、验证器或评判器，以及选择器",
    "题目难度",
    "四倍以上",
    "best-of-N",
    "FLOPs 相同",
    "大 14 倍",
    "并非普遍适用的扩展律",
  ]) expect(flat).toContain(phrase);
  for (const chip of ["TASK", "GENERATE", "VERIFY", "SELECT", "ACCEPT"]) {
    expect(chinese).toContain(`data-chip="${chip}"`);
  }
  for (const phrase of ["冻结任务契约", "分配候选预算", "独立验证", "选出一个结果", "检查单位成本价值"]) {
    expect(flat).toContain(phrase);
  }
});

test("the Chinese deployment section separates three mutable state paths", () => {
  for (const marker of [
    "p_{\\theta_t}",
    "c_t",
    "m_t",
    "\\theta_{t+1}",
    "U(\\theta_t,e_t)",
    "A_{\\mathrm{new}}",
    "\\Delta_{\\mathrm{old}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "发布策略，并非理论上无法更新",
    "稳定性与可塑性",
    "灾难性干扰",
    "两个问答任务",
    "稀疏记忆层模型",
    "NaturalQuestions F1",
    "89%",
    "71%",
    "11%",
    "新知识获取水平相同",
    "不能证明前沿规模的开放式持续学习",
    "重放或复习数据",
    "发布门禁",
    "回滚",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese hallucination section uses an evidence and acceptance boundary", () => {
  for (const marker of [
    "q(x)",
    "u_{\\mathrm{correct}}",
    "u_{\\mathrm{wrong}}",
    "u_{\\mathrm{abstain}}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "看似合理但实际错误",
    "闭卷回答",
    "检索证据",
    "选择弃答",
    "奖励猜测",
    "并非每个完整系统都不可避免",
    "覆盖率",
    "自信地给出错误答案",
    "验收阈值",
    "不存在统一的幻觉下限",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese operating ledger makes every route falsifiable", () => {
  for (const phrase of [
    "更多或重复使用人类数据",
    "合成数据",
    "RLVR 或经验",
    "测试时算力",
    "参数更新",
    "检索或弃答",
    "来源溯源",
    "污染",
    "留出分布",
    "计算预算",
    "选择策略",
    "保留能力测试集",
    "弃答率",
    "已验收答案的准确率",
    "责任人",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/^\|/gm)?.length).toBe(8);
});

test("all Chapter 70 figures are preserved and localized", () => {
  expect([...chinese.matchAll(/\/\/\| label: (fig-[^\n]+)/g)].map((match) => match[1])).toEqual([
    "fig-learning-boundaries",
    "fig-data-crossing",
    "fig-synthetic-protocols",
    "fig-learning-state",
    "fig-answer-boundary",
  ]);
  expect(chinese.match(/<figure id=/g)?.length).toBe(1);
  expect(chinese.match(/<div data-chip=/g)?.length).toBe(5);
  expect(chinese).not.toMatch(/data-title="[^"]*[A-Za-z]{4}/);
});

test("the Chinese rewrite removes stale absolutes and translated rhetoric", () => {
  for (const phrase of [
    "数据墙",
    "80% 的概率",
    "完全消耗掉",
    "2025 年的共识",
    "分布收窄成噪声",
    "从信号而非语料里学习",
    "幻觉作为一种属性",
    "想得更多并不是单调地更好",
    "凑不出一个",
    "厚重的工程层",
    "这一层终于有了理论",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("every Chinese Chapter 70 Graphviz figure parses and fits mobile", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(5);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese Chapter 70 renders through its handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/where-learning-hits-limits.html",
    chapterTitle: "学习在哪里遇到极限",
    chapterNum: "70",
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
  expect(html).toContain("只有明确边界，极限才有意义");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(5);
  expect(html).toContain('<figure id="fig-learning-test-time-stepper" class="rdr-figure">');
  expect(headings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
