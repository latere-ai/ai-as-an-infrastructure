import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/12-production-data-engine.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/12-production-data-engine.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string): string[] {
  const prose = source.replace(/```[\s\S]*?```/g, "");
  return [...prose.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(
    ([, level, text]) => `${level} ${text}`,
  );
}

function references(source: string): string[] {
  return [
    ...source.matchAll(
      /(?<![A-Za-z0-9])@((?:sec|fig|gls)-[A-Za-z0-9-]+|[A-Za-z][A-Za-z0-9]*)/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
}

test("Chinese Chapter 92 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 生产数据引擎 {#sec-data-engine}",
    "## 从数据接入契约开始",
    "## 区分不同类型的证据",
    "## 按问题选择抽样方法",
    "## 把主动学习用于采集，而不是测量",
    "## 把标注作为生产服务运行",
    "### 机器判断也需要同样的规范",
    "## 下层约束",
    "## 查看内容之前先分配数据分区",
    "## 把一次故障转化为合格测试",
    "## 让数据权利传递到每个衍生物",
    "## 衡量反馈回路，而不只是数据集",
    "## 发布数据产品，而不是可变表",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines a governed evidence pipeline", () => {
  for (const phrase of [
    "受治理的证据流水线",
    "合格的产品事件",
    "带版本的数据产品",
    "明确用途",
    "敏感责任",
    "不会自动成为标签",
    "不可变发布版本",
    "数据沿袭关系",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("真实用户提出真实问题");
  expect(flat).not.toContain("下一代模型最需要的东西");
});

test("the intake contract carries identity context authority and lifecycle", () => {
  for (const phrase of [
    "数据接入契约",
    "事件身份",
    "主体与租户",
    "系统上下文",
    "证据与结果",
    "用途与权限依据",
    "生命周期",
    "选择机制",
    "任务版本",
    "模型发布版本",
    "提示词版本",
    "检索版本",
    "工具版本",
    "策略版本",
    "界面版本",
    "结果延迟",
    "纳入概率",
  ]) expect(flat).toContain(phrase);
});

test("intake rejects unauthorized data and minimizes before storage", () => {
  for (const phrase of [
    "拒绝或隔离",
    "身份缺失",
    "租户未知",
    "缺少使用授权",
    "版本无效",
    "用途不允许",
    "写入存储之前",
    "数据最小化",
    "删除或遮蔽敏感内容",
    "加密一份不必要的数据副本",
  ]) expect(flat).toContain(phrase);
});

test("system context preserves correction meaning without inventing grades", () => {
  for (const phrase of [
    "行为取决于上下文",
    "修正事件",
    "决策边界",
    "保留这些事件及其上下文",
    "不会擅自把它们解释成评分",
  ]) expect(flat).toContain(phrase);
});

test("evidence objects remain semantically distinct", () => {
  for (const phrase of [
    "行为事件",
    "观测记录",
    "标注",
    "裁定标签",
    "数据产品",
    "一致不等于真值",
    "合格判断",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("他就在没有被问到的情况下给输出打了分");
});

test("the pipeline has no automatic train-and-deploy cycle", () => {
  expect(chinese).toContain("fig-data-engine-loop");
  for (const phrase of [
    "按明确用途抽样",
    "记录纳入概率",
    "稳定分区",
    "带版本的数据产品",
    "明确的消费方",
    "只有模型发生变化时",
    "不存在自动训练并部署的闭环",
  ]) expect(flat).toContain(phrase);
});

test("sampling streams are separated by purpose", () => {
  for (const phrase of [
    "代表性监控",
    "诊断发现",
    "训练数据采集",
    "事件接入",
    "概率样本",
    "不能混在一起报告",
    "不能描述服务总体",
    "这是测量，不是浪费",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("随机采样会把预算浪费");
});

test("unequal-probability monitoring defines its estimator and limits", () => {
  for (const marker of ["\\widehat{\\mu}_{HT}", "\\pi_i", "y_i", "i \\in s"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "合格总体",
    "Horvitz-Thompson",
    "逆概率权重",
    "已知且为正的入样概率",
    "无法修复错误的合格规则",
    "结果延迟",
    "无响应",
  ]) expect(flat).toContain(phrase);
});

test("active learning remains acquisition rather than measurement", () => {
  for (const phrase of [
    "采集，而不是测量",
    "模型不确定性可能没有校准",
    "过度选择离群样本",
    "漏掉置信度很高的错误",
    "不是经过校准的错误概率",
    "共识也可能出错",
    "独立的代表性审计样本",
    "采集策略不能给自己的发现打分",
  ]) expect(flat).toContain(phrase);
});

test("weak supervision retains dependency and audit limits", () => {
  for (const phrase of [
    "弱监督",
    "标注函数",
    "标注函数之间的依赖关系",
    "相关规则",
    "版本化",
    "覆盖率与冲突",
    "留出的人类审计样本",
    "不会自动成为去噪后的真值",
  ]) expect(flat).toContain(phrase);
});

test("annotation is operated as a quality and capacity service", () => {
  for (const phrase of [
    "带版本的任务规格",
    "反例",
    "弃权或升级",
    "标注者资格",
    "校准集",
    "盲法重复标注",
    "裁定流程",
    "一致性指标",
    "队列中最久等待时间",
    "服务水平目标",
    "审查者疲劳",
    "有界升级路径",
  ]) expect(flat).toContain(phrase);
});

test("machine judgments are versioned instruments rather than truth", () => {
  for (const phrase of [
    "裁判模型",
    "裁判提示词",
    "解码设置",
    "专家校准",
    "按切片检查分歧",
    "机器标注不是真值",
    "新的测量工具",
    "衔接研究",
  ]) expect(flat).toContain(phrase);
});

test("consumer contracts constrain collection", () => {
  for (const phrase of [
    "代表性服务指标需要概率抽样",
    "回归测试套件需要冻结且独立核验的个案",
    "偏好数据",
    "验证规则",
    "用途与数据权利",
    "训练需求本身不能授权数据采集",
  ]) expect(flat).toContain(phrase);
});

test("stable partitions prevent training and evaluation contamination", () => {
  for (const phrase of [
    "查看内容或结果之前",
    "不可变的分区盐值",
    "监控与审计",
    "回归评测",
    "训练与弱监督",
    "隔离区",
    "实体级分组",
    "精确重复和语义重复",
    "分区冲突",
    "自适应泄漏",
  ]) expect(flat).toContain(phrase);
});

test("the deterministic partition runnable matches English and executes", () => {
  const chineseCode = chinese.match(/```python\n([\s\S]*?)\n```/)?.[1];
  const englishCode = english.match(/```python\n([\s\S]*?)\n```/)?.[1];
  expect(chineseCode).toBeDefined();
  expect(chineseCode).toBe(englishCode);
  expect(chineseCode).not.toMatch(/numpy/i);
  const run = Bun.spawnSync(["python3", "-c", chineseCode!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
});

test("production failures become qualified tests rather than automatic fixtures", () => {
  for (const phrase of [
    "线索，而不是现成的评测个案",
    "最小化并清理",
    "复现",
    "裁定",
    "冻结预期行为",
    "保留来源与独立性",
    "防止该个案及其近似变体进入训练",
    "过期测试",
    "退役条件",
  ]) expect(flat).toContain(phrase);
});

test("rights propagate through derivatives and promotion boundaries", () => {
  for (const phrase of [
    "删除沿袭关系",
    "原始事件",
    "衍生特征",
    "评测个案",
    "数据集分片",
    "训练工件",
    "删除请求",
    "合法例外",
    "用途限制",
    "每个提升边界",
    "允许的消费方",
  ]) expect(flat).toContain(phrase);
});

test("the security boundary treats reports as evidence not trusted input", () => {
  for (const phrase of [
    "去重重试事件",
    "验证事件来源",
    "限制公开反馈的速率",
    "租户密钥",
    "扫描注入的秘密信息",
    "疑似投毒反馈",
    "不是可信代码，也不是可信标签",
  ]) expect(flat).toContain(phrase);
});

test("feedback effects require exposure context and causal discipline", () => {
  for (const phrase of [
    "施为性反馈效应",
    "曝光记录",
    "处理分配",
    "服务策略版本",
    "倾向概率",
    "前后对比不能确立因果关系",
    "随机留出组",
    "反事实设计",
    "混杂因素",
  ]) expect(flat).toContain(phrase);
});

test("operating metrics cover the complete pipeline", () => {
  for (const phrase of [
    "合格事件覆盖率",
    "Schema 拒绝率",
    "逆概率加权质量",
    "切片覆盖率",
    "采集产出率",
    "与受保护评测分区的重叠",
    "盲法重复标注错误率",
    "删除完成延迟",
    "未解决的沿袭关系",
    "发布保护条件",
    "没有任何单项指标能够认证这台引擎",
  ]) expect(flat).toContain(phrase);
});

test("scenario tests exercise the data lifecycle", () => {
  for (const phrase of [
    "载荷冲突",
    "缺少使用授权",
    "未经授权的消费方",
    "结果过期",
    "抽样器中断",
    "纳入概率错误",
    "Schema 漂移",
    "标注者漂移",
    "裁判版本变更",
    "分区冲突",
    "近似重复泄漏",
    "跨租户记录",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle produces a complete production data release record", () => {
  for (const phrase of [
    "生产数据发布记录",
    "发布身份、负责人、用途、时间窗口和不可变清单",
    "合格规则",
    "来源计数",
    "分区规则",
    "分区盐值标识符",
    "裁定策略",
    "数据权利",
    "隐私审查",
    "泄漏检查",
    "撤回流程",
    "精确发布版本",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion rejects harvesting users for training", () => {
  for (const phrase of [
    "管理进入这些流程的线上证据",
    "成本、服务水平、所有权和租户边界",
    "不是产品收割用户数据",
    "用途、不确定性、数据权利和发布决定",
    "可以接受审查",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite preserves interfaces and removes obsolete claims", () => {
  for (const marker of [
    "#sec-data-engine",
    "fig-data-engine-loop",
    "@sec-human-interface-oversight",
    "@sec-data-curation",
    "@sec-synthetic-data",
    "@sec-deployment-lifecycle",
    "@sec-privacy-provenance",
    "::: {#further-reading}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "fig-production-data-engine-1",
    "标注员就是模型",
    "生产流量成为训练信号",
    "一个变成评测样本的失败，则永远无法悄无声息地回退",
    "同分布数据最便宜的来源就是模型自己的生产流量",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese artifact contract matches the current English chapter", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(2);
  expect(chinese.match(/^\|\s*---/gm)?.length).toBe(2);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
});

test("the localized evidence-pipeline figure parses and fits mobile", async () => {
  const block = chinese.match(/```\{dot\}\n([\s\S]*?)\n```/);
  expect(block).toBeDefined();
  expect(block![1]).toContain("rankdir=TB");
  const graphviz = await loadGraphviz();
  const svg = renderDot(
    graphviz,
    block![1],
    new Map(),
    "practice/production-data-engine.html",
    "",
  );
  expect(svg).not.toContain("graphviz error");
  const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/production-data-engine.html",
    chapterTitle: "生产数据引擎",
    chapterNum: "92",
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
  expect(html).not.toContain("**");
  expect(html).toContain("生产数据发布记录");
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
