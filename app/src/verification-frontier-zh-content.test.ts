import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/frontiers/03-verification-frontier.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/frontiers/03-verification-frontier.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const references = (source: string) =>
  [...source.matchAll(/(?<![A-Za-z0-9])@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);

test("Chinese Chapter 72 preserves the complete English structure", () => {
  expect(chinese).toMatch(
    /^# 验证前沿：能力之后的证明、监督与信任 \{#sec-verification-frontier\}/,
  );
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
    "一个主张需要证据契约",
    "约束如何向上传导",
    "验证能力受制于待审队列",
    "不同检查提供不同保证",
    "作为基础设施的形式证明",
    "发现循环需要评估器",
    "当验证者更弱时",
    "独立性与来源记录",
    "失效模式",
    "运营台账",
    "这如何改变前沿",
    "争议所在",
    "延伸阅读",
  ]);
  expect(references(chinese)).toEqual(references(english));
  expect(chinese.match(/^```\{dot\}/gm)?.length).toBe(4);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(4);
  expect(chinese.match(/^:::: \{\.runnable\}/gm)?.length).toBe(1);
  expect(chinese.match(/^::: \{\.callout-tip\}/gm)?.length).toBe(1);
  expect(chinese.match(/^::: \{\.callout-important\}/gm)?.length).toBe(1);
  expect(chinese.match(/^<figure id=/gm)?.length).toBe(1);
});

test("the Chinese thesis defines a bounded verification frontier", () => {
  for (const phrase of [
    "生成主张与有充分理由接受主张之间的差距",
    "生产不等于接受",
    "工作假设",
    "不是经过测量的普适定律",
    "范围小于整个安全问题",
    "不同于算力前沿",
    "证据与审查流程",
    "审查能力会在何处成为约束",
    "带证据的主张",
    "接受纪律",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese acceptance policy is a versioned evidence contract", () => {
  for (const marker of [
    "A_j(c,e)",
    "p_j(c,e)",
    "h_{jk}(c,e)",
    "s_{j\\ell}(c,e)",
    "\\tau_{j\\ell}",
    "\\mathbf{1}",
    "\\bigwedge",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "证据包",
    "主张类别",
    "来源判定条件",
    "硬性检查",
    "诊断分数",
    "分数阈值",
    "接受决定的责任主体",
    "版本化策略",
    "不是对真理的普适定义",
    "缺少证据时如何处理",
    "不会把判断变成真理",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("\\begin{aligned}");
});

test("the Chinese review-capacity model uses comparable queue units", () => {
  expect(chinese).toContain("B_{t+1}");
  expect(chinese).toContain("\\max\\{0, B_t + G_t - R_t\\}");
  for (const phrase of [
    "同一主张类别",
    "同一风险等级",
    "待审项目数",
    "新进入的主张",
    "已经完成的审查决定",
    "计数恒等式",
    "不是排队论定理",
    "优先级、服务时间差异、返工和审查人员可用性",
    "使用可比单位",
  ]) expect(flat).toContain(phrase);
  const englishCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const chineseCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(chineseCell?.[1]).toBe(englishCell?.[1]);
});

test("the Chinese checks section states guarantees and boundaries", () => {
  for (const phrase of [
    "证明内核",
    "精确的形式化陈述",
    "可信计算基",
    "类型检查器、编译器证明或静态分析",
    "已经执行的测试用例",
    "模拟器模型与假设之内",
    "相同的数据、代码和方法",
    "新的数据",
    "模型或人工审查",
    "相关的审查意见并非独立证据",
    "计算可重复性",
    "实验可复制性",
    "不会自动把主张变成事实",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese formal-proof evidence stays scoped to its trust chain", () => {
  for (const phrase of [
    "Cminor 到 PowerPC 汇编",
    "语义保持定理",
    "HOL Light 和 Isabelle",
    "形式化缺口",
    "库缺口",
    "内核信任",
    "翻译缺口",
    "错误的形式化陈述",
    "陈述、证明、内核、库和工具链",
  ]) expect(flat).toContain(phrase);
  for (const system of [
    "GPT-f",
    "MiniF2F",
    "FrontierMath",
    "LeanDojo",
    "DeepSeek-Prover-V2",
    "AlphaGeometry2",
  ]) expect(chinese).toContain(system);
  for (const phrase of [
    "2026 年 6 月 12 日",
    "42% 的题目",
    "剩余 338 题",
    "题面与参考答案",
    "答案检查器不等于形式证明",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese discovery section separates fitness from acceptance", () => {
  for (const phrase of [
    "由人类提供评估代码",
    "定义了何为改进",
    "需要人工实验的任务",
    "不在该系统报告的适用范围内",
    "搜索证据，不是接受决定",
    "留出测试",
    "专家检查",
    "硬件验证",
    "部署后测量",
    "历史快照",
    "未见过的工作负载",
    "机群测量",
    "不能只是生成时使用的适应度信号",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese learned-oversight evidence preserves experiment scope", () => {
  for (const phrase of [
    "约 80 万个人工标签",
    "Best-of-N 选择",
    "没有通过强化学习训练生成器",
    "验证理由",
    "不是证书",
    "五项合成组合任务",
    "硬编码分解器",
    "MNIST",
    "稀疏分类器",
    "自然语言处理、国际象棋和奖励建模",
    "低于完整的强模型监督",
    "5,000 项 APPS 编程任务",
    "不构成对真正失调系统的部署保证",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese ELK theorem retains every limiting assumption", () => {
  for (const phrase of [
    "因果影响图",
    "可能情形的真子集",
    "训练分布上完全正确",
    "分布外的某处出错",
    "无法确定地保证得到诚实智能体",
    "特定类别的纯行为反馈",
    "并没有证明每一种实际监督方法都会失败",
    "模拟评估要求的解",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese independence and provenance section binds review to released artifacts", () => {
  for (const phrase of [
    "相关一致",
    "不同的模型名称",
    "独立性是一项必须记录的属性",
    "实际发布的产物",
    "内容哈希",
    "候选结果、配置、数据版本、工具输出和证据包",
    "检查器版本",
    "谁有权修改",
    "后续发生了哪些转换",
    "未经检查的相邻版本",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese failure inventory and operating ledger remain complete", () => {
  for (const phrase of [
    "以复杂性压人",
    "形式化错误",
    "覆盖错误",
    "代理劫持",
    "共享盲点",
    "不可重复的经验结果",
    "接受漂白",
    "主张 ID 与类别",
    "证据契约版本",
    "生成器与资源预算",
    "证据哈希",
    "检查器版本与独立性",
    "结果与局限",
    "接受决定的责任主体",
    "决定与日期",
    "失效条件",
    "重复或复制状态",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/^\d+\. \*\*/gm)?.length).toBe(10);
});

test("the Chinese frontier handoff keeps evidence engineering and book structure explicit", () => {
  for (const phrase of [
    "线索，不是已接受的定理",
    "假设，不是疗法",
    "草案，不是一次操作",
    "证据工程问题",
    "主张流",
    "检查的覆盖范围与局限",
    "待审积压",
    "决定耗时",
    "被接受主张后来失败的比例",
    "第十一部分会问",
    "第十二部分会问",
    "运营契约",
    "从主张走向有充分依据的行动",
  ]) expect(flat).toContain(phrase);
});

test("all Chapter 72 figures are preserved and localized", () => {
  expect([...chinese.matchAll(/\/\/\| label: (fig-[^\n]+)/g)].map((match) => match[1])).toEqual([
    "fig-evidence-contract",
    "fig-verification-queue",
    "fig-check-guarantees",
    "fig-formal-trust-chain",
  ]);
  expect(chinese).toContain('data-viz="verification-frontier" data-lang="zh"');
  for (const phrase of [
    "主张 c + 证据 e",
    "待审项目 Bₜ",
    "记录保证与局限",
    "可信内核检查推导",
  ]) expect(chinese).toContain(phrase);
});

test("the Chinese rewrite removes stale models and unsupported absolutes", () => {
  for (const phrase of [
    "/figures/verification-frontier-1.svg",
    "A(x, y, e)",
    "C_{\\mathrm{verify}}",
    "C_{\\mathrm{generate}}",
    "三种验证制度",
    "生成便宜了一千倍",
    "编译器证明程序保持语义",
    "如果模型已经超过人类数学家怎么办",
    "是一台修辞机器",
    "这是一个基础设施事实",
    "能让答案变得便宜可查",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese.match(/^```python$/gm)?.length).toBe(1);
});

test("every Chinese Chapter 72 Graphviz figure parses and fits mobile", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese Chapter 72 renders through its handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/verification-frontier.html",
    chapterTitle: "验证前沿：能力之后的证明、监督与信任",
    chapterNum: "72",
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
  expect(html).toContain("前沿是一个证据工程问题");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(4);
  expect(html).toContain('<figure id="fig-verification-frontier-gap" class="rdr-figure">');
  expect(headings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
