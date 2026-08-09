import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/infrastructure/04-orchestration-data-infra.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/04-orchestration-data-infra.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
}

function canonicalMath(source: string): string {
  return source
    .replace(/\\(?:begin|end)\{(?:aligned|gathered)\}/g, "")
    .replace(/\\\\/g, "")
    .replace(/\\quad|\\qquad|&|\{\}/g, "")
    .replace(/\s+/g, "");
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function dotLabels(source: string): string[] {
  return [...source.matchAll(/^\/\/\| label: (.+)$/gm)].map((match) => match[1]);
}

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

function runnablePython(source: string): string[] {
  return [...source.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)].map(
    (match) => match[1],
  );
}

test("Chapter 65 preserves the complete English orchestration contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "编排与数据基础设施 {#sec-orchestration-data-infra}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "运行是由控制器持续调谐的状态机",
    "调度与工作进程成员关系是两份独立契约",
    "检查点是一笔分布式提交",
    "保存频率是一套带假设的模型",
    "存储层级落实恢复目标",
    "恢复始于故障分类",
    "数据平面始于不可变身份",
    "打乱与混合都是有版本的算法",
    "必须明确恢复语义",
    "可观测性验证每一份契约",
    "运行全生命周期",
    "下层约束",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "只有租约，没有隔离令牌还不够",
    "最后发布清单",
    "吞吐量是一份有界队列契约",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-orchestration-control-loop",
    "fig-orchestration-checkpoint-commit",
    "fig-orchestration-data-resume",
  ]);
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-important\}$/gm)?.length).toBe(1);
});

test("the opening joins control data and checkpoint contracts", () => {
  for (const phrase of [
    "能启动它、识别它的状态、恢复它，并证明它消费过什么",
    "控制平面保存期望运行状态，并让它与观测到的运行状态保持一致",
    "数据平面按照明确的顺序与混合契约供给身份确定的训练样本",
    "在同一个逻辑边界提交模型状态与数据进度",
    "各自声明语义与故障预算",
    "明确身份、状态转换、提交规则与恢复目标",
  ]) expect(flat).toContain(phrase);
});

test("a durable run specification and record drive reconciliation", () => {
  for (const phrase of [
    "不可变运行规格",
    "源码修订版本、容器摘要、入口点、依赖与编译器版本",
    "数据集清单、分词器版本、混合策略、变换、打包策略与访问策略",
    "检查点模式、保存频率、保留策略、重试类别、恢复点目标与恢复时间目标",
    "持久运行记录",
    "当前运行代次、状态、准入决定、工作进程成员关系",
    "反复比较期望运行与观测到的运行",
    "幂等，或由唯一操作标识符保护",
    "成员关系、健康状态与进度不变量",
  ]) expect(flat).toContain(phrase);
});

test("fencing rejects stale writers after lease loss or cancellation", () => {
  for (const phrase of [
    "停止心跳并不会终止进程",
    "单调递增的隔离令牌",
    "等于持久运行记录中的代次",
    "过期工作进程仍可计算，但写入会被拒绝",
    "先记录已取消的终止状态",
    "输出按代次划分",
  ]) expect(flat).toContain(phrase);
});

test("the control-loop diagram keeps the primary state progression visible first", () => {
  const diagram = chapter.match(
    /\/\/\| label: fig-orchestration-control-loop[\s\S]*?```/,
  );
  expect(diagram).not.toBeNull();
  for (const edge of [
    'spec -> record [label="创建", weight=10];',
    'record -> pending [label="调谐", weight=10];',
    'pending -> starting [label="获得容量", weight=10];',
    'starting -> running [label="健康", weight=10];',
    'running -> checkpointing [label="保存", weight=10];',
  ]) expect(diagram![0]).toContain(edge);
});

test("scheduling separates admission membership and logical identity", () => {
  for (const phrase of [
    "成组调度是一项准入策略，不是集合通信的属性",
    "固定全局规模",
    "弹性范围",
    "模型切分、优化器状态、全局批次语义、数据分配与调度计划",
    "重启整个工作进程组",
    "重新会合并恢复已提交的状态",
    "rank 在重新会合前后并不是稳定身份",
    "使用逻辑标识符，而不能只用 rank 编号",
  ]) expect(flat).toContain(phrase);
});

test("a training checkpoint captures every future-changing state family", () => {
  for (const phrase of [
    "参数文件适合推理，却未必是训练检查点",
    "数值状态",
    "调度状态",
    "精度状态",
    "随机状态",
    "数据状态",
    "分布状态",
    "来源信息",
    "全局优化器步骤完成提交之后、下一步消费数据之前",
    "累积梯度、微批次游标、流水线状态",
    "切分改变的是字节所在的位置，不是一致性规则",
  ]) expect(flat).toContain(phrase);
});

test("checkpoint publication is a fenced distributed commit", () => {
  for (const phrase of [
    "读者只会看到上一个完整代次或新的完整代次，绝不会看到二者的混合",
    "暂存一份不可变的本地状态副本",
    "逻辑键、字节数与校验和",
    "验证所有预期分片与全局键覆盖",
    "最后发布一份不可变清单和提交记录",
    "只恢复已经提交的清单",
    "清单才是事务边界",
    "目录列表、某个 rank 的文件或时间戳",
  ]) expect(flat).toContain(phrase);
});

test("cadence keeps Young's assumptions and asynchronous costs explicit", () => {
  for (const phrase of [
    "检查点暴露时间、重放、检测与恢复",
    "$C$ 是一次阻塞式检查点实测的暴露成本",
    "$M$ 是同步作业两次中断之间的平均时间",
    "中断时间服从指数分布",
    "故障在每个间隔内均匀分布",
    "$C\\ll T\\ll M$",
    "耐久性滞后",
    "有界的写入积压",
    "延迟或跳过新快照",
    "总耐久字节数仍等于完整逻辑状态",
  ]) expect(flat).toContain(phrase);
});

test("storage tiers are selected against named recovery objectives", () => {
  for (const phrase of [
    "只有相对于它要防护的故障域，存储层级才有意义",
    "设备内存或本地内存",
    "主机本地存储",
    "对等复制的内存或存储",
    "远程持久存储",
    "恢复点目标（RPO）",
    "恢复时间目标（RTO）",
    "在预期故障域下进行恢复演练",
  ]) expect(flat).toContain(phrase);
});

test("recovery classifies failures before choosing a response", () => {
  for (const phrase of [
    "失效即停的进程、节点或抢占",
    "挂起或遗漏",
    "掉队进程",
    "确定性的代码、配置、OOM 或坏数据",
    "存储或传输损坏",
    "静默数据损坏",
    "相关的机架、存储或控制平面事故",
    "回滚窗口",
    "校验和只能保证字节完整性",
    "端到端完整性检查",
    "备用容量是一项可选的成本策略，不是调度器不变量",
  ]) expect(flat).toContain(phrase);
});

test("the data plane separates immutable logical identity from delivery", () => {
  for (const phrase of [
    "`corpus/latest` 这样的路径是位置，不是数据集身份",
    "不可变数据集清单",
    "稳定的样本标识符或推导规则",
    "数据集 ID 可以取规范化清单的摘要",
    "缓存键应使用内容身份，而不是可变 URI",
    "逻辑样本分配与物理交付是两件事",
    "缓存命中与工作进程完成顺序可以改变延迟",
    "不应暗中改变声明的逻辑序列",
    "映射式与流式是访问接口，不是内存大小标签",
  ]) expect(flat).toContain(phrase);
});

test("input throughput is an average plus bounded-tail contract", () => {
  for (const phrase of [
    "$R_{\\text{req}}$ 是每秒交付的、参与损失计算的词元吞吐量",
    "$N_{\\text{tok}}$ 是一个全局优化器步骤消费的参与损失计算的词元数",
    "$T_{\\text{step}}$ 是目标优化器步骤时长",
    "平均值达标并不足以应对长尾服务时间",
    "取批延迟分位数、输入等待、读取与解码吞吐量",
    "每个队列都需要内存上限与背压策略",
    "无界预取只会把输入停顿变成内存压力和更大的重放窗口",
  ]) expect(flat).toContain(phrase);
});

test("shuffle and mixture policies are fully versioned algorithms", () => {
  for (const phrase of [
    "完整均匀排列、带种子的分片排列与有界打乱缓冲区",
    "从数据集 ID、轮次与运行种子推导",
    "固定的逻辑排列区间",
    "有界重排缓冲区",
    "不能把它称为全局均匀排列",
    "权重给出的是期望比例，不是精确计数",
    "携带舍入债务",
    "文档、样本、打包序列、原始词元或参与损失计算的词元",
    "采样权重与损失权重是两种不同的控制量",
  ]) expect(flat).toContain(phrase);
});

test("resume semantics name four different continuity promises", () => {
  for (const phrase of [
    "精确重放",
    "轨迹精确重放",
    "覆盖等价恢复",
    "分布一致恢复",
    "物理工作进程数量无关",
    "持久游标只在消费这些样本的优化器步骤提交后推进",
    "预取的样本尚未提交",
    "回滚模型却不回滚游标会造成跳过",
    "游标比模型回滚得更远会造成重复贡献",
    "残余文档会影响下一个批次",
  ]) expect(flat).toContain(phrase);
});

test("the resume diagram avoids a needless narrow-screen overflow", () => {
  const diagram = chapter.match(
    /\/\/\| label: fig-orchestration-data-resume[\s\S]*?```/,
  );
  expect(diagram).not.toBeNull();
  expect(diagram![0]).toContain("nodesep=0.30; ranksep=0.42;");
});

test("observability verifies progress hardware input checkpoint numeric and data contracts", () => {
  for (const phrase of [
    "平滑的损失曲线也不能证明数据连续或硬件正确",
    "运行 ID、代次、全局步骤、数据身份、拓扑与软件版本",
    "每个 rank 的心跳与步骤",
    "集合通信等待、链路与重传计数器",
    "检查点队列与写入积压",
    "重复和跳过的 ID",
    "每个 rank 的分布比集群平均值更重要",
    "“没有告警”只说明没有已配置的检测器被触发",
    "$T_{\\text{productive}}$ 是用于已接受优化器步骤的时间",
    "每个已接受词元的成本",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle verifies recovery before granting the full allocation", () => {
  for (const phrase of [
    "冻结规格",
    "预检路径",
    "运行小规模试验",
    "注入故障",
    "执行恢复演练",
    "为持续执行设置门禁",
    "演练取消与完成",
    "发布运行后清单",
    "陈旧工作进程、缺失的数据对象与受支持的拓扑变化",
    "拒绝不完整或已损坏的清单",
    "避免制造重试风暴",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion preserves lower-layer limits and contested choices", () => {
  for (const phrase of [
    "运维平面无法凭空创造训练程序没有暴露的状态",
    "并行方案不能重新切分",
    "异步工作仍会降低训练有效吞吐量",
    "固定成员关系让恢复语义更简单",
    "覆盖等价或分布一致的恢复",
    "完整工作进程组重启已得到广泛支持",
    "角色局部修复与热替换",
    "数据连续性承诺、数值检查、有效吞吐量与成本",
  ]) expect(flat).toContain(phrase);
});

test("obsolete checkpoint-camp narrative and synthetic shortcuts are absent", () => {
  for (const phrase of [
    "从故障中恢复：检查点与重启",
    "频率是一个经济决策",
    "恢复，以及那些不会显式崩溃的故障",
    "检查点放在哪里，以及哪些仍有争议",
    "供给加速器：数据层",
    "可复现性把数据层系回检查点",
    "调度器如何连接三者",
    "两派检查点",
    "无法从任何检查点恢复",
    "必须续上运行在没出故障时本会走的那条数据顺序，分毫不差",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});
