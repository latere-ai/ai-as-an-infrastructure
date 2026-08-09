import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/inference/03-faster-decoding.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/inference/03-faster-decoding.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map((match) => match[0]);
}

function runnable(source: string): string | undefined {
  return source.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/)?.[1];
}

test("Chapter 33 preserves the complete English faster-decoding contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "生成虽有顺序依赖，验证可以并行",
    "修正拒绝采样保持目标分布不变",
    "候选来源、候选结构与接受策略是三项独立选择",
    "加速必须用实际耗时衡量",
    "调度器必须规划推测工作",
    "根据工作负载证据做选择",
    "争议所在",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "线性链与候选树消耗工作的方式不同",
    "正确性与故障测试",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(runnable(chapter)).toEqual(runnable(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBeGreaterThanOrEqual(8);
  expect(chapter).toContain("fig-faster-decoding-tree");
  expect(chapter).toContain('data-viz="stepper" data-lang="zh"');
});

test("the opening carries the token-plan rule into proposal and verification", () => {
  for (const phrase of [
    "前两章分别讨论了请求时序与内存分配",
    "执行词元计划之前，必须先预留所需状态",
    "更快的解码改变的是这个计划",
    "候选生成器先给出多个候选",
    "目标模型再一次为它们打分",
    "必须放到实测的服务运行区间中判断",
    "这些是设计选择，并不是一条必须依次经过的技术谱系",
  ]) expect(flat).toContain(phrase);
});

test("yield is explained through prefix survival rather than one aggregate rate", () => {
  for (const phrase of [
    "总体接受词元比例不能决定前缀存活率",
    "较早的位置可能更容易通过",
    "接受事件之间也可能相关",
    "只有额外假设每个位置的条件接受概率都恒为 $\\alpha$",
    "每轮验证的期望产出词元数，不是延迟加速比",
    "还没有计入这一轮花费的时间与内存",
  ]) expect(flat).toContain(phrase);
});

test("modified rejection sampling states and proves the exact output contract", () => {
  for (const phrase of [
    "共同的词元空间",
    "拒绝概率就是 $Z$",
    "若 $Z=0$，拒绝概率为零",
    "从左到右应用",
    "奖励词元",
    "输出分布相同，并不等于在同一随机种子下得到完全相同的词元序列",
    "温度、截断、约束与词元映射",
    "贪心验证是另一套确定性契约",
    "必须把这些契约分开标明",
  ]) expect(flat).toContain(phrase);
});

test("proposal source, topology, and authorization remain independent", () => {
  for (const phrase of [
    "实现需要分别回答三个问题",
    "候选由谁提出",
    "候选如何组织",
    "哪条规则允许提交输出",
    "独立自回归模型",
    "附加草稿头",
    "特征或词元草稿器",
    "提示词查找",
    "前瞻解码",
    "多词元预测模块",
    "这张表不是排名",
    "树注意力掩码只是让联合打分成为可能，并不会自动让验证器保持精确",
  ]) expect(flat).toContain(phrase);
});

test("speedup is tied to measured cycle time and the serving regime", () => {
  for (const phrase of [
    "加速是实际耗时的测量结果",
    "平均每个输出词元耗时",
    "候选位置、树节点、上下文长度、KV 流量、批次组成、内核和通信",
    "低批量、受权重带宽限制",
    "被拒绝的候选工作会与其他请求争用资源",
    "论文结果只能证明相应实验配置下可行，不能提供可迁移的固定倍数",
    "复现实验配置后再比较",
  ]) expect(flat).toContain(phrase);
});

test("scheduler planning reserves, commits, releases, and falls back safely", () => {
  for (const phrase of [
    "按计划中的最大值接纳",
    "只能提交已接受草稿前缀对应的目标 KV",
    "释放所有被拒绝的尾部或分支",
    "草稿缓存与目标缓存属于不同命名空间",
    "修正词元或奖励词元会成为下一轮目标执行的输入",
    "取消或失败时回滚预留",
    "位置、掩码、停止状态与缓存所有权",
    "缩短 $\\gamma$、收窄候选树、改用成本更低的候选生成器",
    "没有一个通用的批量阈值",
  ]) expect(flat).toContain(phrase);
});

test("deployment guidance starts with a contract and ends with load evidence", () => {
  for (const phrase of [
    "部署决策从契约开始，以负载测试结束",
    "固定输出契约",
    "分析候选预算",
    "测量完整周期",
    "按服务系统评估",
    "保留回退路径",
    "相同的接纳负载",
    "被接受前缀长度的分布",
    "临时 KV 与工作区的峰值占用",
    "同一个接受率或论文加速数字都不能回答部署是否受益",
  ]) expect(flat).toContain(phrase);
});

test("correctness tests cover distribution, batching, memory, and failure paths", () => {
  for (const phrase of [
    "不相交支持集",
    "EOS、停止序列与最大长度",
    "词元器、适配器或约束不匹配",
    "混合不同的已接受前缀长度",
    "跨越缓存块边界",
    "在验证期间取消请求",
    "注入目标模型故障",
    "不得要求随机采样逐位完全相同",
    "确认排队时间有界，并能干净地退回普通解码",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion states both the payoff and the full-cycle price", () => {
  for (const phrase of [
    "候选生成与验证并没有消除自回归",
    "只提交明确接受契约授权的输出",
    "收益是每个输出词元所需的昂贵目标周期更少",
    "代价是候选生成、更宽的验证、临时内存和更复杂的状态对账",
    "量化会减少表示模型状态所需的字节数",
    "融合内核会减少单个周期内的数据搬运与启动开销",
    "一起测量，不能把各自的加速倍数直接相乘",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete lineage claims, synthetic figures, and DOT diagrams", () => {
  for (const phrase of [
    "## 基本动作",
    "## 让检验保持精确",
    "## 寻找猜测的来源",
    "## 加速何时成立",
    "## 验证这一步的内部",
    "这条谱系为何这样一路演进",
    "几乎不额外增加成本",
    "前沿模型，大部分时间都在等待",
    "生产默认",
    "```{dot}",
    "/figures/faster-decoding-1.svg",
    "/figures/faster-decoding-2.svg",
    "import numpy",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
