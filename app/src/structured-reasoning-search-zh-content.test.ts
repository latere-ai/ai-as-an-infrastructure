import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/reasoning/02-structured-reasoning-search.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/reasoning/02-structured-reasoning-search.qmd", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function normalizedMath(source: string): string[] {
  return matches(source, /\$\$\s*([\s\S]*?)\s*\$\$/g).map((block) =>
    block.replace(/\s+/g, " ").trim(),
  );
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

function definedFigures(source: string): string[] {
  return [
    ...matches(source, /\{#(fig-[\w-]+)\}$/gm),
    ...matches(source, /^<figure id="(fig-[\w-]+)">$/gm),
  ].sort();
}

test("Chapter 25 preserves the complete English artifact contract", () => {
  expect(matches(zh, /^## (.+)$/gm)).toEqual([
    "搜索问题需要明确接口",
    "分支会迅速耗尽预算",
    "不同前沿策略舍弃的东西不同",
    "被剪掉的分支无法挽回",
    "这里的「图」有两种含义",
    "价值引导押注于局部证据",
    "已发表的系统不能混为一谈",
    "如何运行搜索控制器",
    "争议：结构化搜索何时胜过增加采样",
    "下层约束",
    "延伸阅读",
  ]);
  expect(definedFigures(zh)).toEqual(definedFigures(en));
  expect(zh.match(/^\|---/gm) ?? []).toHaveLength(3);
  expect(zh.match(/^:::: \{\.runnable\}$/gm) ?? []).toHaveLength(1);
  expect(normalizedMath(zh)).toEqual(normalizedMath(en));
  expect(pythonBlocks(zh)).toEqual(pythonBlocks(en));
});

test("citations and cross-references stay aligned with English", () => {
  const referencePattern = /(@(?:sec|fig|gls)-[A-Za-z0-9_-]+|@[a-z]+[0-9][A-Za-z0-9_-]*)/g;
  expect(matches(zh, referencePattern)).toEqual(matches(en, referencePattern));
});

test("the opening defines search as an outer controller and preserves the training boundary", () => {
  for (const phrase of [
    "搜索会在模型外加一层控制器",
    "决定下一次调用模型做什么、保留哪个局部结果，以及何时停止",
    "模型在每一种结构中仍然逐词元生成",
    "搜索过程只是在这些生成操作之间分配模型调用",
    "本章只讨论推断时控制",
    "局部状态评分器、价值模型或结果模型可能经过单独训练",
    "提示驱动的树搜索和经过训练的 AlphaZero 式系统",
  ]) expect(zh).toContain(phrase);
});

test("the search interface separates states, nodes, proposals, and executable evidence", () => {
  for (const component of [
    "状态表示",
    "扩展函数",
    "前沿策略",
    "局部状态评估器",
    "终止测试",
    "最终选择器",
    "停止规则",
  ]) expect(zh).toContain(component);
  for (const phrase of [
    "搜索节点则是记账结构",
    "不同节点可能表示同一个状态",
    "提议分布",
    "并不决定扩展哪个搜索节点",
    "未知的任务质量",
    "写出这个目标，并不会让理想目标变得可执行",
    "可观测的终止状态检查器",
    "习得估计或提示估计",
    "只是质量的较弱观测，并不能取代",
    "答案投票是候选集合的属性",
  ]) expect(zh).toContain(phrase);
});

test("branching, beam pruning, and total work retain their explicit cost bounds", () => {
  expect(zh).toContain("N_{\\text{full}}");
  expect(zh).toContain("\\sum_{d=0}^{D} b^d");
  expect(zh).toContain("N_{\\text{beam}} \\le 1+b+(D-1)wb");
  for (const phrase of [
    "有效分支因子",
    "最大深度",
    "87,381 个节点",
    "不是模型词表的大小",
    "束宽限制的是保留状态数，不一定限制提议数",
    "并不能保证有效路径仍留在束中",
    "生成状态与动作扩展的集合",
    "并行调用可以缩短墙钟时间",
    "并不会减少",
  ]) expect(zh).toContain(phrase);
});

test("frontier policies remain distinct and classical guarantees stay conditional", () => {
  for (const policy of [
    "一条链",
    "广度优先",
    "深度优先",
    "束搜索",
    "最佳优先",
    "蒙特卡洛树搜索",
  ]) expect(zh).toContain(policy);
  for (const phrase of [
    "探索奖励",
    "还必须强制尝试或以其他方式处理尚未访问的动作",
    "PUCT 会加入提议策略的先验",
    "不是换了名字的最佳优先搜索",
    "经典保证依赖一些语言模型控制器经常违背的假设",
    "算法名称本身无法恢复这些保证",
  ]) expect(zh).toContain(phrase);
});

test("the pruning runnable executes and demonstrates irreversible loss", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "width=1: no verified solution",
    "width=2: start -> patient -> bridge -> solution",
  ]);
  expect(zh).toContain("一旦剪掉，就无法回到那个备选分支");
});

test("graph reuse requires state identity while thought graphs express dataflow", () => {
  for (const phrase of [
    "状态空间图和思维工作流解决的是不同问题",
    "转置",
    "规范状态键",
    "同一段文本可能对应不同的隐藏状态",
    "仅按表面文本合并并不安全",
    "循环检测、关闭集或明确的重新开放规则",
    "生成、聚合、精炼或反馈",
    "并不声称它们是等价状态",
    "不能证明它能自动做语义合并",
  ]) expect(zh).toContain(phrase);
});

test("value guidance explains selection pressure, distribution shift, and false pruning", () => {
  expect(zh).toContain("\\widehat v(s)=v^*(s)+\\varepsilon(s)");
  for (const phrase of [
    "最高的观测分数",
    "异常偏大的正误差",
    "选择偏差",
    "分布外",
    "错误剪枝则是相反的问题",
    "不是模型能准确核查自身工作的证据",
  ]) expect(zh).toContain(phrase);
});

test("published systems keep their distinct controllers, training assumptions, and evidence", () => {
  for (const phrase of [
    "24 点、创意写作和迷你填字游戏",
    "排序基准",
    "经过训练的策略、价值和结果奖励组件",
    "ReAct 本身并不是搜索算法",
    "不能证明树搜索在任意任务上都优于重复采样",
    "对 $4\\times4$ 复矩阵做乘法的秩 48 程序",
    "平均释放了相当于全机群 0.7% 的算力",
    "不能证明语言树搜索普遍更优",
  ]) expect(zh).toContain(phrase);
});

test("production guidance requires matched budgets, hard limits, fallbacks, and telemetry", () => {
  for (const phrase of [
    "拒绝让无法解析的状态进入前沿",
    "在将要使用评估器的控制器所生成的状态上校准",
    "预算匹配的评估",
    "可用并发容量",
    "节点数、深度、生成词元、工具调用、费用、内存和墙钟截止时间",
    "空前沿、解析失败、评估器超时、没有终止状态通过验收，以及检查器相互冲突",
    "弃答或升级处理",
    "不可逆的外部副作用",
    "去重率",
    "评估器版本",
    "错误剪枝",
    "选择遗憾",
  ]) expect(zh).toContain(phrase);
});

test("the contested boundary and lower-layer constraint preserve operational conclusions", () => {
  for (const phrase of [
    "不存在与任务无关的赢家",
    "选择而不是生成成了瓶颈",
    "预算匹配可能改变排行榜",
    "借用经典算法的名称并不够",
    "搜索会消耗生成词元、评分器调用、检查器调用、内存和墙钟延迟",
    "更宽的搜索只会制造更多让评估器犯错的机会",
    "搜索是一层算力分配机制",
    "下一章会改变状态表示本身",
  ]) expect(zh).toContain(phrase);
});

test("the rewrite removes the incomplete chapter's misleading formulations", () => {
  for (const rejected of [
    "把推理从「生成下一个词元」改写成",
    "它仍然是在冻结模型上的推断时工作",
    "V 往往是多数投票",
    "如果没有 `verify`，搜索会退回到学出来的奖励模型",
    "最有力的证据也指向同一处",
    "真正有用的预算，是花在通过选择后仍留下的状态上的那部分",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
