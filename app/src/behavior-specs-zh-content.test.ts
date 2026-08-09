import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/02-behavior-specs-preference-data.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/02-behavior-specs-preference-data.qmd", import.meta.url),
  "utf8",
);

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function citations(source: string): string[] {
  return [...new Set([...source.matchAll(/\[@([\w-]+)/g)].map(([, key]) => key))].sort();
}

function crossRefs(source: string): string[] {
  return [...source.matchAll(/@sec-[\w-]+/g)].map(([ref]) => ref).sort();
}

test("Chapter 18 treats preference labels as designed measurements", () => {
  expect(zh).toContain("偏好训练的起点不同：它使用的是对一个回答优于另一个回答的判断");
  expect(zh).toContain("偏好标签是一项测量结果，不是事实");
  expect(zh).toContain("人类标注者和 AI 评判者都只是在执行这套经过设计的流程");
  expect(zh).toContain("两者都接触不到独立于这套流程的真值");
});

test("the behavioral contract separates hard rules from softer goals", () => {
  expect(zh).toContain("## 先写行为契约，再写评分准则");
  expect(zh).toContain("硬性禁止事项、指令层级、处理歧义请求时的默认规则");
  expect(zh).toContain("硬性安全边界不只是另一项风格偏好");
  expect(zh).toContain("更高权限的指令也不会因为回答足够有用就失效");
});

test("public specifications remain versioned requirements rather than proof", () => {
  expect(zh).toContain("人仍然选择原则并评测结果");
  expect(zh).toContain("从 Root、System、Developer、User 到 Guideline");
  expect(zh).toContain("广义安全、广义伦理、Anthropic 的准则和有用性");
  expect(zh).toContain("公开的是预期行为，不是模型一定会如此行动的证明");
  expect(zh).toContain("规格是一项带版本的要求");
});

test("governance remains visible after participation", () => {
  expect(zh).toContain("约一千名美国成年人");
  expect(zh).toContain("参与扩大了价值来源，却没有消除编辑判断");
  expect(zh).toContain("却不能单凭透明度回答「应该由谁的策略来治理」");
});

test("policy language becomes an explicit five-step decision procedure", () => {
  expect(zh).toContain("## 把策略语言变成判断流程");
  expect(zh).toContain("即使最终核验尚未运行，也要告诉客户交付已经完成");
  for (const phrase of [
    "检查硬性约束与指令权限",
    "检查任务与事实是否正确",
    "比较有用性、相关性、校准程度与完整性",
    "只有实质标准都满足后，才比较清晰度与简洁度等风格属性",
    "证据不足以区分候选回答时，允许平局或弃权",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("这套顺序只是示例，不是普适宪章");
});

test("the local utility rule defines its symbols and limits", () => {
  expect(zh).toContain(String.raw`a(x,y)\in\mathbb{R}^k`);
  expect(zh).toContain(String.raw`u(x,y)=w^\top a(x,y)`);
  expect(zh).toContain("属性分数向量");
  expect(zh).toContain("属性权重向量");
  expect(zh).toContain("工程近似");
  expect(zh).toContain("硬性约束与权限规则位于这项求和之外");
});

test("the figures preserve the localized measurement lineage", () => {
  expect(zh).toContain('id="fig-behavior-specs-preference-signal"');
  expect(zh).toContain('data-viz="preference-signal-mixer" data-lang="zh"');
  expect(zh).toContain("硬性约束与权限规则无法只用这项加权和表示");
  expect(zh).toContain("label: fig-behavior-specs-supply-chain");
  for (const phrase of [
    "行为规格\\n硬性规则\\n优先级与默认规则",
    "标注流程\\n标准与示例\\n平局规则",
    "原始判断\\n投票、平局\\n属性与理由",
    "带版本的\\n偏好记录\\n来源与仲裁",
    "留出审计\\n偏差与漂移\\n覆盖缺口",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("rankdir=TB;");
  expect(zh).toContain("constraint=false");
});

test("the localized lineage diagram fits a mobile reading column", async () => {
  const dot = zh.match(/^```\{dot\}\n(?:\/\/\|.*\n)*([\s\S]*?)^```$/m)?.[1];
  expect(dot).toBeDefined();

  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(dot!, "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);

  expect(widthPt).toBeLessThanOrEqual(234);
});

test("prompt and candidate sampling expose deployment boundaries", () => {
  expect(zh).toContain("## 采集能暴露边界的比较样本");
  for (const source of [
    "经过脱敏的生产提示",
    "由标注者编写的提示",
    "红队提示",
    "合成提示",
  ]) expect(zh).toContain(source);
  expect(zh).toContain("按来源和近重复簇划分数据");
  expect(zh).toContain("静态数据集会随着策略学会生成评判者从未见过的回答而过时");
  expect(zh).toContain("尽可能隐藏候选回答的来源，并随机安排两个回答的展示顺序");
});

test("the collection loop preserves immutable lineage", () => {
  expect(zh).toContain("带版本的行为规格 S");
  expect(zh).toContain("目标提示混合 Q");
  for (const phrase of [
    "采样提示 x，并记录其来源与覆盖切片",
    "隐藏候选回答的来源，并随机安排展示顺序",
    "先保留原始判断，再进行任何过滤或仲裁",
    "把歧义、高风险或需要专业知识的案例交给复核",
    "写入一条与 S、R、Q、G 关联的不可变记录",
    "按切片审计；下一轮开始前修订 S、R、Q 或 G",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("这套循环建立的是数据血缘，并不声称每个最终判断都正确");
});

test("a pairwise label preserves only one bit of judgment", () => {
  expect(zh).toContain("## 成对标签只保留判断中的一个比特");
  expect(zh).toContain("它没有说明原因、偏好有多强、其他评判者是否同意，也没有说明两个回答是否都很差");
  expect(zh).toContain(String.raw`p(y_i \succ y_j \mid x)`);
  expect(zh).toContain(String.raw`r_\phi(x,y_i)-r_\phi(x,y_j)`);
  expect(zh).toContain("分数差被建模为对数优势，而不是经过校准的人类价值量");
  expect(zh).toContain("循环偏好、随上下文变化的优先级");
});

test("richer feedback formats retain distinct information", () => {
  for (const format of [
    "| 强制二选一 |",
    "| 允许平局并记录强度的成对比较 |",
    "| 对 $K$ 个候选回答排序 |",
    "| 属性评分 |",
    "| 批注与修订 |",
  ]) expect(zh).toContain(format);
  expect(zh).toContain("四到九个回答");
  expect(zh).toContain("对话树与消息评分");
  expect(zh).toContain("正确性、连贯性、复杂度与冗长度");
});

test("mistakes ambiguity and legitimate disagreement stay separate", () => {
  expect(zh).toContain("## 区分错误、歧义与合理分歧");
  expect(zh).toContain("标注者群体是数据集定义的一部分");
  for (const phrase of [
    "**错误。**",
    "**歧义。**",
    "**合理分歧。**",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("增加投票可以减少偶发错误，却不能决定谁的稳定价值判断应当占主导");
  expect(zh).toContain("原始的逐人判断、平局、弃权、信心与理由");
});

test("population evidence and preference shortcuts remain bounded", () => {
  expect(zh).toContain("1,500 名参与者、75 个国家、8,011 段对话和 21 个模型");
  expect(zh).toContain("不是为了再提供一个普适平均值");
  expect(zh).toContain("有说服力的迎合回答，而不是正确答案");
  expect(zh).toContain("把正确性、标注一致性和回答长度分开测量");
});

test("annotation operations are part of quality and governance", () => {
  expect(zh).toContain("按切片报告标注一致性，而不是只给出一个全局数字");
  expect(zh).toContain("领域专家的资格任务");
  expect(zh).toContain("保留原始投票与最终决定理由的仲裁记录");
  expect(zh).toContain("标注说明、报酬安排、接触有害材料的风险与升级支持");
});

test("AI feedback changes the measurement instrument", () => {
  expect(zh).toContain("## AI 反馈改变的是谁来执行评分准则");
  expect(zh).toContain("评判模型、评判提示、策略文本、候选顺序与解码设置");
  expect(zh).toContain("这些结果只证明了对应设置，不保证 AI 评判者在每个领域都与人一致");
  expect(zh).toContain("位置偏差、冗长度偏差与自我偏好");
  expect(zh).toContain("针对大语言模型评判者与 RLAIF 流水线的实验已经演示过此类提示注入攻击");
});

test("AI judge controls match the observed failure modes", () => {
  for (const control of [
    "冻结并记录评判模型快照、提示、策略版本、模板与解码配置",
    "交换候选回答顺序，并在一部分样本上重复判断",
    "把 AI 评判者与分层留出的人类小组比较",
    "将选定的歧义、高风险或专家案例交给人处理",
    "部署后继续进行随机人工审计",
    "归档评判者的原始输入与输出",
  ]) expect(zh).toContain(control);
  expect(zh).toContain("AI 反馈扩展的是评分准则的执行规模");
});

test("the released dataset includes its measurement context", () => {
  expect(zh).toContain("## 发布数据集时附上测量背景");
  expect(zh).toContain("只含 `chosen` 和 `rejected` 回答的文件");
  for (const record of [
    "| 策略 |",
    "| 提示 |",
    "| 候选回答 |",
    "| 判断 |",
    "| 仲裁 |",
    "| 数据集 |",
  ]) expect(zh).toContain(record);
  expect(zh).toContain("无法保证逐比特复现");
  expect(zh).toContain("Data Cards");
});

test("pre-training gates cover distribution shortcuts and lineage", () => {
  for (const gate of [
    "提示覆盖是否与目标用户、语言、任务和策略边界相符",
    "候选回答是否覆盖当前策略及其可能的失败方式",
    "平局、弃权、标注一致性与仲裁如何随切片变化",
    "交换回答顺序是否会改变标签",
    "即使不看回答内容，回答长度、格式、模型身份或其他捷径能否预测胜者",
    "训练集、验证集与审计集是否按来源和近重复内容隔离",
    "每个最终样本对是否都能追溯到产生它的策略、候选回答、原始判断与转换步骤",
  ]) expect(zh).toContain(gate);
});

test("contested and lower-layer boundaries remain explicit", () => {
  expect(zh).toContain("明确并不等于正当、完整或人人认同");
  expect(zh).toContain("有限度的个性化或多套策略");
  expect(zh).toContain("标明产品策略在哪些地方有意不采纳平均投票结果");
  expect(zh).toContain("更好的优化可以放大混合信号，却无法分离标签已经丢弃的信息");
  expect(zh).toContain("行为变化必须能追溯到策略、提示来源、候选模型、评判者或过滤决定");
});

test("Chinese Chapter 18 preserves the English structural contract", () => {
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^```\{=html\}$/gm)).toBe(count(en, /^```\{=html\}$/gm));
  expect(count(zh, /^```text$/gm)).toBe(count(en, /^```text$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("the rewrite removes stale claims and machine-like framing", () => {
  for (const rejected of [
    "对齐文献常从损失函数讲起",
    "分歧率就是噪声底",
    "便宜、一致、多语言",
    "实践上的答案通常是混合监督",
    "奖励模型是这件仪器的一份冻结拷贝",
    "@anthropic2023constitution",
    "@jagadeesh2026beneficial",
    "@cui2023ultrafeedback",
    "@sec-synthetic-data",
    "rankdir=LR;",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
