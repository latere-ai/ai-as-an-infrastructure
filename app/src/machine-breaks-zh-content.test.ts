import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/08-the-machine-that-breaks.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/infrastructure/08-the-machine-that-breaks.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const citations = (source: string) =>
  [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);

test("Chinese chapter 69 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 规模越大，越会失效的机器 \{#sec-machine-breaks\}/);
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
    "先统计故障，再预测故障",
    "故障预算把事件换算成有效时间",
    "约束如何向上传导",
    "恢复是一条经过验证的控制闭环",
    "静默损坏需要一条正确性验证路径",
    "局部性决定同步边界",
    "服务：拆分会增加一次交接",
    "智能体也需要事务",
    "争议所在",
    "让证据可以重放",
    "在边界内失效的机器",
    "延伸阅读",
  ]);
  expect(citations(chinese)).toEqual(citations(english));
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
});

test("Chinese chapter 69 defines failure at the workload boundary", () => {
  for (const phrase of [
    "故障契约",
    "工作负载边界",
    "观测窗口",
    "恢复验收",
    "不能混为一谈",
    "有效进展",
    "正确结果",
    "纳入明确的故障预算",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 counts distinct failure classes before modeling them", () => {
  for (const phrase of [
    "计划内中断",
    "停机故障",
    "性能退化故障",
    "静默数据损坏",
    "相关故障",
    "受影响的进程编号",
    "检测延迟",
    "故障波及范围",
    "466 次中断",
    "47 次属于计划内中断",
    "419 次属于意外中断",
    "58.7%",
    "超过 90%",
    "条件性外推",
    "并非普遍适用的扩展定律",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 keeps both reliability models and their limits", () => {
  for (const marker of [
    "\\Lambda_{\\mathrm{job}}",
    "\\sum_{j=1}^{m}\\lambda_j",
    "R_{\\mathrm{job}}(t)",
    "e^{-\\Lambda_{\\mathrm{job}}t}",
    "M_{\\mathrm{job}}",
    "W(\\tau)",
    "\\frac{C}{\\tau}",
    "\\frac{\\tau}{2M}",
    "\\frac{D+R}{M}",
    "E_{\\mathrm{approx}}",
    "\\tau^*=\\sqrt{2CM}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "平稳、相互独立的泊松事件",
    "小损耗近似",
    "阻塞式周期检查点",
    "异步快照",
    "直接测量 ETTR",
    "仅用于说明",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 preserves the executable failure-budget example", () => {
  const englishCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const chineseCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(chineseCell?.[1]).toBe(englishCell?.[1]);
});

test("Chinese chapter 69 scopes recovery and corruption evidence", () => {
  for (const phrase of [
    "检测、隔离、恢复和验证",
    "每一步检查点",
    "低于 0.9%",
    "平台上的生产结果",
    "不能据此泛化",
    "十五个异常节点",
    "十五个健康节点",
    "单节点张量并行",
    "双 SM 缩减模型",
    "63 个 CUDA 微基准",
    "1.01%",
    "不到 40%",
    "并不是机群中的发生率",
    "黄金输出",
    "首次出现偏差的步骤",
    "误报率",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 keeps locality and serving claims conditional", () => {
  for (const phrase of [
    "取决于消息大小、集合通信算法、放置方式、拥塞和拓扑",
    "该 RoCE 网络拓扑所特有",
    "120 万块芯片",
    "88% 的有效吞吐",
    "58%",
    "另一项实验",
    "120 亿参数模型",
    "不等同于前沿规模的生产部署",
    "首词元时间",
    "每输出词元时间",
    "SLO 有效吞吐",
    "7.4 倍",
    "12.6 倍",
    "数千个节点",
    "队首阻塞",
    "分块预填充",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 distinguishes agent trajectory and repeated-trial reliability", () => {
  for (const marker of [
    "\\Pr(S_{1:n})",
    "\\prod_{i=1}^{n}",
    "\\Pr(S_i \\mid S_{1:i-1})",
    "p^n",
    "\\operatorname{pass}^{k}",
    "\\Pr(Y_1=1,\\ldots,Y_k=1)",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "零模型",
    "自我修正",
    "自我条件化",
    "人类专家完成任务所需的时间",
    "重复试验",
    "事务边界",
    "幂等或可补偿",
    "置信区间",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 makes reliability evidence replayable", () => {
  for (const phrase of [
    "来源时间戳",
    "软件和固件版本",
    "检查点年龄",
    "损失的加速器时间",
    "SLO 未达标次数",
    "外部状态差异",
    "重放测试",
    "故障注入",
    "验收标准",
    "责任人",
    "可以证伪",
  ]) expect(flat).toContain(phrase);
});

test("Chinese chapter 69 preserves all figures and localizes their visible copy", () => {
  expect([...chinese.matchAll(/\/\/\| label: (fig-[^\n]+)/g)].map((match) => match[1])).toEqual([
    "fig-machine-failure-contract",
    "fig-machine-budget",
    "fig-machine-recovery",
    "fig-machine-sdc",
    "fig-machine-disagg",
  ]);
  expect(chinese.match(/<div data-chip=/g)?.length).toBe(5);
  for (const phrase of [
    "接收请求",
    "构建提示状态",
    "传输或保留状态",
    "生成词元",
    "检查服务目标",
    "请求边界",
    "状态交接",
  ]) expect(flat).toContain(phrase);
  expect(chinese).not.toMatch(/data-title="[^"]*[A-Za-z]{4}/);
});

test("every Chinese Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(5);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("Chinese chapter 69 removes stale absolutes and machine-like rhetoric", () => {
  for (const phrase of [
    "这些倍数是物理",
    "接近确定",
    "前沿已经越过临界点",
    "正统的答案",
    "挑战者则是",
    "一次重启只花几秒",
    "谁也没有一个公认",
    "本章接手的问题",
    "那就是摊销故障",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});
