import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/01-training-agents-to-act.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/01-training-agents-to-act.qmd", import.meta.url),
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

function displayMathSkeleton(source: string): string[] {
  return displayMath(source).map((math) => math.replace(/\\text\{[^}]*\}/g, "\\text{…}"));
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map((match) => match[0]);
}

test("Chapter 37 preserves the complete English agent-training contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "一条轨迹包含两种时间尺度",
    "把交互整理成有效的训练记录",
    "先确定数据范式，再选择优化器",
    "把奖励设计成契约",
    "轨迹奖励不等于动作级信用分配",
    "争议所在",
    "环境从哪里来",
    "把环境当作版本化的数据基础设施",
    "下层约束：rollout 耗时决定优化节奏",
    "资源布局与策略新鲜度彼此独立",
    "同时验证学习效果、环境质量与系统表现",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "生成出来的任务未必是有用的任务",
    "合成解决不了的问题",
  ]);
  expect(displayMathSkeleton(chapter)).toEqual(displayMathSkeleton(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(32);
  expect(chapter).toContain("fig-agent-rl-loop");
  expect(chapter).toContain("fig-training-agents-to-act-rl-timeline");
  expect(chapter).toContain('TASK [label="任务与重置状态"]');
  expect(chapter).toContain('UPDATE [label="带掩码的策略更新\\n只更新动作词元"]');
  expect(chapter).toContain("是策略生成且纳入更新的词元");
  expect(chapter).toContain("来自提示、系统或环境");
});

test("the opening distinguishes answer training from interaction training", () => {
  for (const phrase of [
    "答案可以在一次补全后评分",
    "智能体选择动作、接收观测，再继续选择",
    "工具结果、环境状态、终止规则",
    "生成这次运行的策略版本",
    "并不存在一项名为“智能体训练”的单一发明",
    "行为克隆",
    "拒绝采样",
    "离线目标",
    "在线强化学习",
    "学习单位变成交互轨迹",
  ]) expect(flat).toContain(phrase);
});

test("the trajectory model states both time scales and every operational symbol", () => {
  for (const phrase of [
    "词元仍然由语言模型逐个生成",
    "外部系统向前推进并返回观测",
    "一次环境交互",
    "反复进行动作与观测交互",
    "$x$ 是任务",
    "$s_t$ 是执行动作 $t$ 之前的隐藏环境状态",
    "$h_t$ 是策略可见的观测历史",
    "环境版本 $E$",
    "终止条件决定最后一轮 $T$",
    "每个符号都对应一项必须记录的策略、环境或评分决定",
    "把两者序列化成一份词元记录只是常见实现，并非轨迹的定义",
  ]) expect(flat).toContain(phrase);
});

test("the training record preserves provenance, replay, and failure semantics", () => {
  for (const phrase of [
    "来源掩码",
    "环境观测可以影响后续动作，但不是策略采样出的动作",
    "掩码是一条所有权规则",
    "分母统计纳入更新的动作词元，不能为零",
    "是否保留私有推理词元，以及是否用它们训练",
    "解析后的动作与原始动作文本",
    "观测来源与截断情况",
    "超时、重试、取消和终止原因",
    "成本、权限与安全事件",
    "丢弃无效调用会改变训练分布",
    "耗尽预算与完成任务不是同一种结果",
  ]) expect(flat).toContain(phrase);
});

test("data regimes remain distinct before optimization begins", () => {
  for (const phrase of [
    "智能体训练并不等于在线强化学习",
    "行为克隆",
    "选择或离线学习",
    "在线强化学习",
    "混合课程",
    "示范者经历的状态分布",
    "无法探索日志中不存在的状态",
    "先学会接口，再优化任务结果",
    "早期 rollout 预算",
  ]) expect(flat).toContain(phrase);
});

test("reward, verifier, and environment expose separate contracts", () => {
  for (const phrase of [
    "环境与奖励不是同一个对象",
    "状态转移契约",
    "观测契约",
    "验证器契约",
    "奖励契约",
    "语法与有效性",
    "中间进展",
    "最终任务结果",
    "成本与约束",
    "保留一套不参与训练的验证器",
    "代理奖励与目标任务指标之间的差距",
    "评分过程自动完成",
    "仍然包含人工监督",
  ]) expect(flat).toContain(phrase);
});

test("trajectory-level advantages do not claim action-level causality", () => {
  for (const phrase of [
    "同一条轨迹的优势应用到所有纳入更新的动作词元",
    "无法指出究竟哪个动作造成了结果",
    "并没有提供因果层面的分辨率",
    "逐步奖励",
    "价值函数",
    "局部反事实比较",
    "能够被识别为等价的状态",
    "奖励设计、信用估计与探索是三项独立选择",
    "诊断信号，不是智能体强化学习的普遍定律",
    "保持环境、基础策略、rollout 预算和评测验证器不变",
  ]) expect(flat).toContain(phrase);
});

test("the environment is reproducible, isolated, and versioned infrastructure", () => {
  for (const phrase of [
    "可执行环境是能够复用的训练基础设施",
    "不应改写成在线强化学习的结果",
    "重置与回放",
    "文件系统、进程、网络、凭据和租户范围",
    "控制观测",
    "失败语义",
    "验证器完整性",
    "数据集隔离",
    "训练任务、调参任务和最终评测任务",
    "API 发生变化，即使任务文本不变，也会改变状态转移分布",
  ]) expect(flat).toContain(phrase);
});

test("rollout accounting exposes stragglers and heterogeneous stages", () => {
  for (const phrase of [
    "墙钟时间分解",
    "同步批次",
    "近似关键路径",
    "最大值把拖慢整批的长尾任务显式写了出来",
    "一次很慢的工具调用就可能卡住整个同步批次",
    "实测各阶段的追踪数据",
    "解码可能占主导，也可能是环境与验证器延迟占主导",
    "vLLM 只是一种可选的推断后端",
    "调度单位变成了会在轮次之间暂停的轨迹",
  ]) expect(flat).toContain(phrase);
});

test("resource placement and policy freshness stay orthogonal", () => {
  for (const phrase of [
    "两条轴彼此独立",
    "同机部署 rollout 与学习角色",
    "独立的 GPU 池",
    "同步收集与更新",
    "异步收集与更新",
    "部署方式本身不能决定数据是否来自当前策略",
    "每条异步轨迹都必须携带生成它的行为策略版本",
    "重要性比率",
    "无法弥补支持集缺失或任意陈旧的轨迹",
    "记录策略延迟、比率分布和裁剪比例",
  ]) expect(flat).toContain(phrase);
});

test("release verification joins policy, environment, and systems evidence", () => {
  for (const phrase of [
    "策略行为",
    "环境质量",
    "训练系统",
    "匹配的硬件和匹配的工作负载分布",
    "环境交互次数、生成的动作词元、加速器时间和墙钟时间",
    "生产环境使用的解析器和工具权限",
    "扰动工具延迟与故障",
    "手工检查高奖励的失败轨迹",
    "独立的评测契约",
    "下一章讨论另一个问题",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete claims, digressions, and synthetic framing", () => {
  for (const phrase of [
    "/figures/training-agents-to-act-1.svg",
    "退化的单步决策问题",
    "下游的一切都假设这道屏蔽在位",
    "这些工作里，奖励都是可验证的",
    "标准阶段，而不再只是学术范例",
    "一个好的最终答案，会把一次浪费掉的早期工具调用",
    "环境就是那个奖励函数",
    "一个 2025 年的智能体训练场市场",
    "几乎总是 vLLM",
    "所以没有什么显存被重复占用",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
