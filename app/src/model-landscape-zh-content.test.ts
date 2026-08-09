import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/01-model-landscape.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/01-model-landscape.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3) {
  const prefix = "#".repeat(level);
  return [...source.matchAll(new RegExp(`^${prefix} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("the Chinese model-landscape chapter preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 模型版图 \{#sec-model-landscape\}/);
  expect(headings(chinese, 2)).toEqual([
    "先用准确的名词",
    "发布契约包含五个字段",
    "发布实例，而不是永久分级",
    "公开报告能够说明什么，不能说明什么",
    "把要求转化为准入闸门",
    "约束如何向上传导",
    "争议所在",
    "从版图走向选择",
    "延伸阅读",
  ]);
  expect(headings(chinese, 3)).toEqual([
    "制品访问：实际能获得什么？",
    "法律许可：可以用它做什么？",
    "运营访问：由他人运行时会发生什么？",
    "证据质量：能够核实什么？",
    "保存发布台账",
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis replaces a laboratory ranking with a versioned release contract", () => {
  for (const phrase of [
    "模型名称并不等于部署选项",
    "发布契约",
    "制品访问",
    "法律许可",
    "运营访问",
    "证据质量",
    "彼此独立的问题",
    "不是一个从开放到封闭的单一分数",
    "准确版本",
    "快照日期",
  ]) expect(flat).toContain(phrase);
});

test("the vocabulary distinguishes systems, models, weights, services, and source claims", () => {
  for (const phrase of [
    "AI 系统",
    "模型架构、学习得到的参数，以及运行模型所需的推断代码",
    "托管服务",
    "开放权重",
    "开放权重 AI",
    "权重可用 AI",
    "开源 AI",
    "数据信息",
    "功能大体相当的系统",
    "不要求公开每一条训练样本",
    "自行申报",
    "并不证明模型准确、安全、无偏、低成本",
  ]) expect(flat).toContain(phrase);
});

test("the release profile is formal, versioned, and keeps unknown requirements unresolved", () => {
  for (const marker of [
    "R_r(v,t)",
    "A_r",
    "X_r",
    "P_r",
    "O_r",
    "E_r",
    "\\operatorname{eligible}(r,Q)",
    "\\bigwedge_{q\\in Q}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "候选发布",
    "准确版本标识",
    "观察日期",
    "硬性部署要求",
    "已确认、已否定或未知",
    "未知不能通过发布闸门",
    "不是开放度指标",
  ]) expect(flat).toContain(phrase);
});

test("artifact access is separated from reproduction, replication, and safety", () => {
  for (const phrase of [
    "最终权重、架构文件、分词器文件和推断代码",
    "训练代码与配置",
    "训练数据信息、数据配比或训练数据本身",
    "中间检查点、优化器状态、数据顺序和运行遥测",
    "评测代码、提示词、原始输出、模型卡和安全文档",
    "计算复现",
    "重复已发布的训练运行",
    "独立复制",
    "都不能单独证明部署安全",
  ]) expect(flat).toContain(phrase);
});

test("legal, service, and evidence reviews retain their distinct checks", () => {
  for (const phrase of [
    "版权授权",
    "专利授权",
    "再分发条件",
    "使用限制",
    "衍生模型",
    "署名与通知义务",
    "商标规则",
    "终止条款",
    "可接受使用政策",
    "输入与输出数据的保留期限",
    "是否用客户数据训练",
    "可用地区",
    "速率限制",
    "版本固定",
    "弃用通知",
    "服务级别协议",
    "这是一份工程检查清单，不是法律意见",
    "证据质量并不等于模型质量",
  ]) expect(flat).toContain(phrase);
});

test("dated examples classify releases rather than organizations", () => {
  for (const phrase of [
    "2026 年 8 月 7 日",
    "Pythia",
    "每个模型发布 154 个检查点",
    "相同的数据顺序",
    "OLMo 2",
    "Llama 3、Qwen3 和 DeepSeek-V3",
    "gpt-oss-120b 和 gpt-oss-20b",
    "Gemma 1 至 3",
    "Gemma 4",
    "GPT-4 技术报告",
    "决策必须针对具体发布",
  ]) expect(flat).toContain(phrase);
});

test("the public record avoids unsupported priority and openness claims", () => {
  for (const phrase of [
    "谁率先提出方法",
    "谁在明确说明的规模上验证了方法",
    "谁发布了足以重复实验的制品",
    "无法证明某个未公开项目内部是谁最先使用某种方法",
    "公开记录",
    "多头潜在注意力",
    "多词元预测",
    "分组查询注意力",
    "计算最优训练",
    "面向推断成本的扩展研究",
    "零样本超参数迁移",
    "warmup-stable-decay",
    "三维并行",
    "频繁检查点",
  ]) expect(flat).toContain(phrase);
});

test("the hard-requirement runnable preserves eligible, unresolved, and ineligible", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(enCell).not.toBeNull();
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);
  for (const line of [
    "local-private: eligible",
    "regulated-audit: unresolved (training_data_provenance)",
    "redistributable-product: ineligible (redistribution)",
  ]) expect(chinese).toContain(line);
});

test("the release ledger remains a reviewable operational record", () => {
  for (const phrase of [
    "准确的模型与修订版、制品哈希、访问渠道和快照日期",
    "许可证版本、条款版本",
    "所需权限",
    "来源证据",
    "评测范围、原始结果和部署专用验收阈值",
    "托管依赖、数据路径、容量负责人和事故联系人",
    "退出测试",
    "合格、不合格或待解决",
    "失效触发条件",
    "归档副本或哈希副本",
  ]) expect(flat).toContain(phrase);
});

test("the supply-chain handoff and contested release question remain bounded", () => {
  for (const phrase of [
    "不受信任的软件供应链输入",
    "固定准确字节",
    "边际收益与边际风险",
    "现实可行的替代方案",
    "证据不足",
    "既不足以普遍支持现行限制，也不足以断定限制永远不合适",
    "模型版图由不断变化的发布契约组成，不是一场只有一个赢家的竞赛",
  ]) expect(flat).toContain(phrase);
  for (const ref of [
    "@sec-model-artifacts",
    "@sec-data-rights-economics",
    "@sec-economics",
    "@sec-choosing-model",
    "@sec-deployment-lifecycle",
  ]) expect(chinese).toContain(ref);
});

test("the Chinese chapter uses the four current localized figures and no stale ranking", () => {
  for (const figure of [
    "fig-release-contract",
    "fig-artifact-evidence",
    "fig-permission-service",
    "fig-release-gate",
  ]) expect(chinese).toContain(figure);
  expect((chinese.match(/```\{dot\}/g) ?? []).length).toBe(4);
  expect((chinese.match(/\$\$/g) ?? []).length).toBe(4);
  expect((chinese.match(/:::: \{\.runnable\}/g) ?? []).length).toBe(1);
  expect((chinese.match(/::: \{\.callout-tip\}/g) ?? []).length).toBe(1);
  expect((chinese.match(/::: \{\.callout-important\}/g) ?? []).length).toBe(1);
  for (const stale of [
    "/figures/model-landscape-1.svg",
    "/figures/model-landscape-2.svg",
    "从开放到封闭的连续区间",
    "开放程度是唯一能预测其余几乎一切的维度",
    "几乎每一项已公开的训练实践",
    "开放权重前沿的，主要是中国的实验室",
    "Meta 重组了它的 AI 团队",
    "几乎每一个降低词元成本的配方",
  ]) expect(chinese).not.toContain(stale);
  expect(chinese).not.toContain("—");
});

test("every localized Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese chapter renders through the final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/model-landscape.html",
    chapterTitle: "模型版图",
    chapterNum: "73",
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
  expect(html).toContain("决策必须针对具体发布");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(4);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
