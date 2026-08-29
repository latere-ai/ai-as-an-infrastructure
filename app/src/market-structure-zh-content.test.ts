import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 77 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# AI 价值链 \{#sec-market-structure\}/);
  expect(headings(chinese)).toEqual([
    ["##", "先画依赖关系，再定义市场"],
    ["##", "先定义市场，再计算份额"],
    ["##", "区分规模经济、集中度与市场力量"],
    ["###", "不要从价格图推断利润"],
    ["##", "争议所在"],
    ["##", "把切换当作有方向的路径来测量"],
    ["##", "从权利与激励分析垂直整合"],
    ["##", "开放、透明与可竞争性不是一回事"],
    ["##", "每项结论都要对应证据"],
    ["##", "约束如何传导"],
    ["##", "持续维护市场记录"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis treats one accepted outcome as a dependency graph rather than one market", () => {
  for (const phrase of [
    "模型调用看起来像软件服务",
    "产业链露在外面的末端",
    "合格结果",
    "芯片制造",
    "内存与封装",
    "可交付电力",
    "加速器容量",
    "模型制品或托管服务",
    "数据权利",
    "组织流程",
    "依赖关系图，而不是一个市场",
    "可信替代方案消失时，议价能力才会上升",
    "并不是因为某家公司同时出现在多个环节",
  ]) expect(flat).toContain(phrase);
});

test("dependency mapping distinguishes boxes edges bottlenecks and control points", () => {
  for (const phrase of [
    "技术依赖和合同依赖",
    "图中的每个方框并不都代表一个市场",
    "每条边也不都代表一笔采购",
    "多层供应链",
    "集中度较高的环节",
    "进入壁垒",
    "垂直关系",
    "切换壁垒",
    "不等于完成了一次全球市场定义",
    "算力、数据、技术专长、资金和进入市场的渠道",
    "瓶颈",
    "控制点",
    "既有能力也有动机",
    "交付周期很长可以暴露瓶颈",
    "不能仅凭这一点证明市场力量",
  ]) expect(flat).toContain(phrase);
});

test("the dependency table preserves four candidate units and evidence boundaries", () => {
  for (const phrase of [
    "| 先进算力 |",
    "| 模型服务 |",
    "| 应用渠道 |",
    "| 数据权利 |",
    "待审查层级",
    "候选计量单位",
    "可能的约束",
    "应保留的证据",
    "指定区域和时段内可交付的加速器小时",
    "满足目标客户群的完整工作流",
    "允许用途和未决权利主张",
  ]) expect(flat).toContain(phrase);
});

test("market definition fixes product geography time customers and threshold before shares", () => {
  expect(chinese.replace(/\s+/g, "")).toContain("\\mathcal{M}=(P,G,T,U,Q)");
  for (const phrase of [
    "产品或服务",
    "地理范围",
    "时间窗口",
    "客户群体",
    "最低质量与服务门槛",
    "一份分析记录",
    "并不表示只有一种市场定义有效",
    "合理替代品",
    "可下载模型",
    "托管的前沿模型 API",
    "医院",
    "先定义决策，不要让供应商类别来定义市场",
    "收入",
    "已交付容量",
    "使用量",
    "新客户数量",
    "至少报告两个站得住脚的替代指标",
  ]) expect(flat).toContain(phrase);
});

test("HHI stays a bounded screening statistic with sensitivity", () => {
  for (const marker of [
    "\\operatorname{HHI}(\\mathcal{M})",
    "10{,}000",
    "\\sum_{i=1}^{n} s_i^2",
    "\\sum_{i=1}^{n} s_i = 1",
    "N_{\\mathrm{eff}}=10{,}000/\\operatorname{HHI}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "供应商数量",
    "供应商 $i$ 的份额",
    "份额之和为一",
    "筛查指标，不是市场力量的认定",
    "合并后 HHI 高于 1,800",
    "增加超过 100 点",
    "不是适用于所有技术市场的通用评分尺",
    "市场边界、份额指标、缺失供应商或时间窗口",
    "以下份额完全是假设数据",
  ]) expect(flat).toContain(phrase);
});

test("the HHI runnable is identical to English and produces the expected sensitivity", () => {
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
    "narrow: suppliers=4 hhi=3250 effective-firms=3.08\n" +
      "broader: suppliers=5 hhi=2250 effective-firms=4.44\n" +
      "equal-five: suppliers=5 hhi=2000 effective-firms=5.00\n",
  );
});

test("scale economies concentration power and profit remain separate claims", () => {
  for (const marker of [
    "C(q)=F+cq",
    "AC(q)=\\frac{F}{q}+c",
    "MC(q)=c",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "大额固定成本可以降低平均成本，而不降低边际成本",
    "规模经济、集中度与市场力量是三件不同的事",
    "排他行为",
    "下一份合同",
    "客户无法避开的价格或条款变化",
    "2024 年英国基础设施即服务收入份额",
    "加速计算收入无法按一致口径拆分",
    "不能直接估算全球 AI 算力市场或模型市场",
    "标价不等于生产成本",
    "收入不等于毛利润",
    "毛利润不等于经济租金",
    "资本支出也不等于某一层获得的客户价值份额",
    "经审计的业务分部",
    "能够复现的共享硬件、人员、研究、能源与管理费用分摊规则",
    "利润如何分配仍然未知",
  ]) expect(flat).toContain(phrase);
});

test("natural monopoly remains a conditional subadditivity claim", () => {
  for (const marker of [
    "C(Q) \\leq \\sum_{j=1}^{m} C(q_j)",
    "\\sum_{j=1}^{m} q_j = Q",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "规模经济、范围经济、反馈、用户惯性和垂直整合",
    "当前竞争仍然激烈",
    "把未来是否会发生市场倾斜视为有条件的结果",
    "自然垄断有更严格的成本含义",
    "成本次可加性",
    "高训练成本、高 HHI 或高切换成本都不能证明这一条件",
    "作为待检验的场景",
  ]) expect(flat).toContain(phrase);
});

test("switching is a five-layer directed migration path", () => {
  for (const phrase of [
    "接口可移植性",
    "状态与数据可移植性",
    "行为可移植性",
    "制品与运行时可移植性",
    "运行与商业可移植性",
    "API 语法兼容只是可移植性的一部分",
    "切换成本具有方向性",
  ]) expect(flat).toContain(phrase);
  for (const marker of [
    "C_{\\mathrm{switch}}(a \\rightarrow b)",
    "C_{\\mathrm{export}}",
    "C_{\\mathrm{rewrite}}",
    "C_{\\mathrm{retest}}",
    "C_{\\mathrm{parallel}}",
    "C_{\\mathrm{exit}}",
    "\\mathbb{E}[C_{\\mathrm{failure}}]",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "数据出口费用",
    "同时运行两条路径",
    "终止合同与无法收回的承诺",
    "迁移演练",
    "测量质量和尾延迟",
    "恢复服务所需的时间",
    "从未通过这项演练的后备方案只是一种愿望",
  ]) expect(flat).toContain(phrase);
});

test("vertical integration is analyzed through rights incentives and bounded evidence", () => {
  for (const phrase of [
    "降低协调成本",
    "保障投资",
    "软硬件协同设计",
    "优先访问",
    "提高竞争对手的投入成本",
    "限制多云并用",
    "封锁进入市场的渠道",
    "也不会让所有垂直整合都构成反竞争行为",
    "2025 年 1 月",
    "Alphabet、Amazon 和 Microsoft",
    "Anthropic 和 OpenAI",
    "股权与收入权利",
    "云消费承诺",
    "敏感技术和商业信息",
    "没有对每个 AI 市场作出定义",
    "也没有认定任何安排违法",
    "容量优先级、预留和短缺分配",
    "终止和退出权利",
    "使用数据不会自动成为训练数据或竞争飞轮",
  ]) expect(flat).toContain(phrase);
});

test("openness transparency and contestability retain different meanings", () => {
  for (const phrase of [
    "可获取权重并不等于开源 AI",
    "使用、研究、修改和分享",
    "数据说明、代码和参数",
    "社区标准，不是普遍适用的法律定义",
    "许可证允许相应用途",
    "制品完整",
    "受支持的运行时",
    "通过评估契约",
    "足够的容量",
    "平均得分为 40.69 分",
    "2024 年的 58 分",
    "指标集合在 2025 年发生了大幅调整",
    "不能视为严格的同口径时间序列",
    "衡量的是公开披露",
    "并不直接创造替代品",
    "及时进入并扩大规模",
    "让客户切换或同时使用多个供应商",
  ]) expect(flat).toContain(phrase);
});

test("the evidence matrix prevents six common overclaims", () => {
  for (const phrase of [
    "| 市场高度集中 |",
    "| 某项投入是控制点 |",
    "| 客户受到锁定 |",
    "| 垂直整合改变了竞争 |",
    "| 某一层持续获得超额回报 |",
    "| 某一层具有可竞争性 |",
    "可以支持该结论的证据",
    "这些证据不能证明什么",
    "市场力量、损害或成因",
    "大规模模型目录就等于有效选择",
    "证据必须带日期",
  ]) expect(flat).toContain(phrase);
});

test("the constraint arrow and nine-step review produce a reproducible record", () => {
  for (const phrase of [
    "物理容量和供电时间证据",
    "权利与来源边界",
    "合格结果成本账本",
    "替代方案是否可获得、是否可信",
    "定义决策",
    "冻结市场边界",
    "列出供应商",
    "测量不止一种份额指标",
    "测试匹配的替代方案",
    "梳理依赖关系与权利",
    "演练迁移",
    "设定复核触发条件",
    "更新记录",
    "工作负载与验收规则摘要",
    "HHI 敏感性",
    "未决假设",
    "议价能力止于可信替代方案消失之处",
  ]) expect(flat).toContain(phrase);
  const section = chinese.match(/## 持续维护市场记录\n([\s\S]*?)\n```\{dot\}/);
  expect(section).not.toBeNull();
  expect(section![1].match(/^\d+\. /gm)?.length).toBe(9);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  for (const figure of [
    "fig-market-structure-chain",
    "fig-market-structure-audit",
  ]) expect(chinese).toContain(figure);
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(10);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/^\|.*\|$/gm)?.length).toBe(14);
  expect(chinese).not.toMatch(/!\[[^\]]*\]\([^)]*\)/);
  for (const stale of [
    "fig-market-structure-1",
    "集中压力",
    "2026 利润占比",
    "2026 毛利",
    "约五分之四落在半导体层",
    "每两年四个百分点",
    "十年开外",
    "谁会赢",
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

test("the complete Chinese chapter renders through the adoption handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/market-structure.html",
    chapterTitle: "AI 价值链",
    chapterNum: "77",
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
  expect(html).toContain("议价能力止于可信替代方案消失之处");
  expect(html.match(/<figure/g)?.length).toBe(2);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
