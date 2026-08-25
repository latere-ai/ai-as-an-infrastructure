import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/03-memory-systems.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/03-memory-systems.qmd", import.meta.url),
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

test("Chapter 39 preserves the complete English memory-systems contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "“记忆”一词，四个所有者",
    "持久执行保存进度，却无法保证外部副作用只发生一次",
    "检查点必须绑定相互关联的状态",
    "工作区持久性来自一组叠加的保证",
    "下层约束",
    "长期记忆是一条受治理的写入、管理与读取闭环",
    "分阶段评估，不能只看最终答案",
    "争议所在",
    "运行契约",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "确定性重放需要记录什么",
    "幂等键是一项协议，不是随机字符串",
    "快照频率只能给出 RPO 上界，不能代替备份",
    "记忆记录需要来源与时间",
    "检索也必须受授权约束",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(4);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(52);
  expect(chapter.match(/```python/g)?.length).toBe(1);
  expect(chapter.match(/```text/g)?.length).toBe(1);
  expect(chapter).not.toContain(".runnable");
  for (const label of [
    "fig-memory-state-boundaries",
    "fig-memory-unknown-effect",
    "fig-memory-fork-bundle",
    "fig-memory-governed-loop",
  ]) expect(chapter).toContain(label);
});

test("the opening separates four state owners and their authority", () => {
  for (const phrase of [
    "不同状态有不同的所有者、恢复规则和权限边界",
    "执行历史、可变工作区、长期记忆和外部系统",
    "无法保证外部副作用恰好发生一次",
    "是否适合写入",
    "是否仍然有效",
    "首先要把这些边界说清楚",
    "外部系统的记录视图",
    "仍由各自的外部系统保存权威状态",
  ]) expect(flat).toContain(phrase);
});

test("durable execution preserves unknown outcomes without promising exactly once", () => {
  for (const phrase of [
    "结果未知",
    "请求根本没有到达服务方",
    "请求已经提交，但回复在途中丢失",
    "至少一次执行语义",
    "幂等的业务逻辑",
    "稳定的步骤标识",
    "已经记录的非确定性结果",
    "固定或显式迁移工作流版本",
    "最多尝试一次",
    "至少尝试一次",
    "带键、等效单次生效的变更",
    "事务耦合的变更",
    "幂等、对账、补偿",
  ]) expect(flat).toContain(phrase);
});

test("the effect protocol binds a stable key to tenant and input", () => {
  for (const phrase of [
    "第一次尝试之前生成并持久化",
    "重试期间保持不变",
    "限定到租户和操作",
    "绑定输入指纹",
    "最长重放和重试周期",
    "检查后执行竞态",
    "从对方的权威系统中取得证据",
    "补偿本身也是一次新的副作用",
    "最小可说明并测试其重试语义的单元",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("idempotency_key=key");
});

test("checkpoints bind state and distinguish replay rewind and fork", () => {
  for (const phrase of [
    "不是简单的“第 27 轮”",
    "执行历史头、工作区版本、记忆版本、工作流版本",
    "重放、回退和分叉是三种不同操作",
    "共享祖先",
    "隔离的可写状态",
    "外部系统默认仍然共享",
    "语义合并",
    "产品策略，有时还需要人工决定",
    "不会修改原始历史",
  ]) expect(flat).toContain(phrase);
});

test("workspace durability states each storage guarantee separately", () => {
  for (const phrase of [
    "容器文件系统、持久卷、快照和备份回答的是不同问题",
    "卷的生命周期",
    "访问模式",
    "拓扑",
    "回收策略",
    "快照一致性",
    "备份独立性",
    "恢复目标",
    "`ReadWriteOnce` 是访问模式",
    "实际的 CSI 驱动、StorageClass、拓扑约束、保留策略和恢复路径",
    "应用一致的快照",
    "快照创建成功",
    "写时复制本身也不是完整的性能模型",
    "一份快照是否完整，只取决于它明确纳入了哪些状态",
  ]) expect(flat).toContain(phrase);
});

test("snapshot math is scoped to RPO and storage limits", () => {
  for (const phrase of [
    "崩溃在两次快照之间各个时点等可能发生",
    "恢复点目标（RPO）的简单上界",
    "不能说明写入字节数、快照耗时、去重、保留期限",
    "恢复时间目标（RTO）",
    "元数据操作还是完整复制",
    "隔离性、延迟、变更字节成本和恢复限制",
  ]) expect(flat).toContain(phrase);
});

test("long-term memory is a governed lifecycle rather than a vector store", () => {
  for (const phrase of [
    "运行时接受了什么",
    "哪些经过选择的信息应影响后续决定",
    "保留每一条事件只是日志记录，不是记忆策略",
    "并不规定唯一的存储方式",
    "并不是互斥的数据库类别",
    "内容",
    "范围",
    "表示方式",
    "生命周期",
    "来源",
    "检索控制",
    "检索增强生成（RAG）是一种检索模式",
  ]) expect(flat).toContain(phrase);
});

test("memory records preserve provenance time and lifecycle", () => {
  for (const phrase of [
    "scope 表示获准读取这条记录的范围",
    "subject 表示记录所涉及的人或实体",
    "系统时间",
    "事实在哪段时间内成立",
    "有效、已被取代、隔离和已设墓碑",
    "提出写入",
    "授权并分类",
    "管理",
    "检索",
    "作为证据使用",
    "修订或删除",
    "记忆本身绝不授予权限",
    "每一种派生表示",
  ]) expect(flat).toContain(phrase);
});

test("authorization constrains candidates before relevance ranking", () => {
  for (const phrase of [
    "授权候选集",
    "经过身份验证的主体",
    "获准的用途",
    "词元或字节预算",
    "用户自行提供的租户标签不等于经过身份验证的主体",
    "零条未授权候选",
    "而不是很高的相关性分数",
    "让投毒内容存活得更久",
    "绝不能把检索到的记录当作高权限指令",
    "删除必须沿着数据血缘传播",
    "防止恢复备份时复活已设墓碑的记录",
  ]) expect(flat).toContain(phrase);
});

test("evaluation localizes quality isolation governance and cost", () => {
  for (const phrase of [
    "知识更新和弃答",
    "选择性遗忘",
    "无法证明租户隔离、抗投毒能力或删除完整性",
    "写入与维护",
    "检索",
    "使用",
    "治理",
    "运营",
    "相同的模型检查点",
    "跨租户负向测试",
    "延迟",
    "词元成本",
    "没有记忆、完整历史、词法、向量和混合基线",
  ]) expect(flat).toContain(phrase);
});

test("contested choices and the operational contract remain explicit", () => {
  for (const phrase of [
    "不存在普遍最优的记忆表示方式或基准",
    "不能比较不同供应商公布的分数",
    "把记忆质量当作一项需要实测的系统属性",
    "重放",
    "副作用",
    "检查点",
    "工作区",
    "分叉",
    "记忆写入",
    "记忆读取",
    "生命周期",
    "评估",
    "下一章把问题收窄到一个特定所有者",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete evidence taxonomies and vendor prescriptions", () => {
  for (const phrase of [
    "/figures/memory-systems-1.svg",
    "状态有三种形态",
    "fig-memory-crash-replay",
    "fig-memory-durability-models",
    "fig-memory-branching",
    "fig-memory-taxonomy",
    "已有报告称智能体的重试率在 15% 到 30% 之间",
    "缝隙闭合",
    "到 2025 年，这套做法已进入主流",
    "会话不再是一个列表",
    "最主要的故障是可用区作用域",
    "PVC 没有原生的廉价克隆原语",
    "数十到数百毫秒内复原",
    "最底层是向量存储加嵌入检索",
    "跨厂商的记忆基准还不可信",
    "pgvector 是运维开销最低的默认",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
