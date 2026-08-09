import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/04-personalization-memory.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/04-personalization-memory.qmd", import.meta.url),
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

function textFences(source: string): string[] {
  return [...source.matchAll(/```text\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

test("Chapter 40 preserves the complete English personalization contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "记忆是证据，不是权限",
    "状态保存在哪里，不等于它如何进入模型",
    "一条用户记忆，就是一项有范围的主张",
    "完整生命周期需要写入门和适用性门",
    "解决冲突，不能凭空改写用户经历",
    "用户控制是状态转移，不是界面标签",
    "隐私义务决定系统架构",
    "个性化带来独有的安全与完整性风险",
    "评估完整生命周期",
    "下层约束",
    "争议所在",
    "运行契约",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(textFences(chapter)).toEqual(textFences(english));
  expect(chapter.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chapter.match(/^\|.+\|$/gm)?.length).toBe(50);
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("```python");
  expect(chapter).toContain("fig-personalization-memory-loop");
});

test("the opening starts from user benefit and bounds every remembered detail", () => {
  for (const phrase of [
    "把这套基础设施用于关于某个人的主张",
    "不用反复说明长期有效的约束和偏好",
    "记错内容、用错场景",
    "只保留服务于已声明用途的信息",
    "当前请求始终是判断用户此刻意图的最强证据",
    "并非每一条记住的细节都有用",
    "在一个工作区收集的事实",
  ]) expect(flat).toContain(phrase);
});

test("memory remains untrusted evidence under current policy and authority", () => {
  for (const phrase of [
    "检索到的记忆是不可信的证据，不是权限",
    "不能验证行为者身份",
    "不能扩大权限",
    "不能覆盖安全策略",
    "不能推翻清晰的当前指令",
    "主体、范围、用途、有效期、敏感性和来源",
    "经过身份验证的行为者",
    "获准用途",
    "仍然有效、已经授权且适用于当前请求的记录",
  ]) expect(flat).toContain(phrase);
});

test("persistence location and application path remain independent axes", () => {
  for (const phrase of [
    "持久化位置",
    "应用路径",
    "完整模型权重",
    "参数适配器或软提示词",
    "服务端存储",
    "客户端存储",
    "源历史或连接器",
    "参数路由",
    "提示词上下文",
    "查询时检索或工具调用",
    "确定性处理",
    "异构批处理并非不可能",
    "只有获准的应用路径读取并提供记录",
  ]) expect(flat).toContain(phrase);
});

test("a user-memory record distinguishes statements observations and inference", () => {
  for (const phrase of [
    "用户明确说过的内容",
    "系统观察到或推断出的内容",
    "弱推测拥有直接指令的效力",
    "`subject` 标识主张涉及的人",
    "`origin` 区分明确指令、用户提供的事实、观察行为、推断画像",
    "保留来源",
    "范围和用途",
    "有效期",
    "置信度",
    "敏感性",
    "确认状态",
    "更正历史",
  ]) expect(flat).toContain(phrase);
});

test("the default write policy is conservative and purpose-bound", () => {
  for (const phrase of [
    "当前轮指令",
    "明确的长期偏好",
    "稳定事实或约束",
    "临时计划",
    "观察到的模式",
    "推断出的偏好或画像",
    "密钥和凭据",
    "不要写入",
    "第三方或未成年人的数据",
    "推断出的主张",
    "数据最小化",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle has separate admission and applicability gates", () => {
  for (const phrase of [
    "不是“抽取、嵌入、检索”",
    "写入门",
    "拒绝、缩短、脱敏、请求确认",
    "适用性门",
    "行为者、主体、范围、用途、状态、有效期和策略",
    "带来源的证据",
    "哪些记录影响了回答",
    "更正、删除、导出、到期和反馈",
    "相关性排序必须放在适用性过滤之后",
  ]) expect(flat).toContain(phrase);
});

test("conflict resolution respects current exceptions without inventing events", () => {
  for (const phrase of [
    "当前请求会覆盖当前行动中的记忆偏好",
    "不一定会抹掉长期偏好",
    "这次订一张机票",
    "保留更正血缘",
    "到期不代表事情已经发生",
    "明确指令",
    "请求澄清或放弃个性化",
    "不能个性化客观事实",
    "一次例外当作永久变化",
    "尚未观察到的计划变成已经完成的人生事件",
  ]) expect(flat).toContain(phrase);
});

test("user controls define exact state transitions and data flows", () => {
  for (const phrase of [
    "关闭读取记忆",
    "暂停写入",
    "临时模式",
    "删除一条记忆",
    "删除源聊天或文件",
    "重置",
    "导出",
    "退出训练",
    "可理解、机器可读",
    "删除源数据并不自动删除派生数据",
    "推理时个性化和存储分开治理",
    "产品契约的示例，不是通用定义",
  ]) expect(flat).toContain(phrase);
});

test("privacy architecture covers purpose lineage correction portability and deletion", () => {
  for (const phrase of [
    "目的限制、数据最小化、准确性和存储期限限制",
    "不是事后清理工作",
    "同意并不是唯一可能的法律依据",
    "可携带权比“导出模型推断的一切”更窄",
    "JSON、XML 或 CSV",
    "删除是一项图操作",
    "从每个派生物追溯到来源",
    "先阻止继续使用",
    "验证物理删除",
    "防止后续重建让已删除主张复活",
    "法律保留和强制记录",
  ]) expect(flat).toContain(phrase);
});

test("security treats personalization as a persistent attack and integrity surface", () => {
  for (const phrase of [
    "敏感推断",
    "提示词注入与投毒",
    "跨账户或跨项目泄漏",
    "谄媚",
    "个性化虚假陈述",
    "不可信证据",
    "账户切换、共享设备会话、过期授权",
    "删除后重建索引",
    "不能决定一条记录是否应该存在",
    "不能个性化客观真相",
  ]) expect(flat).toContain(phrase);
});

test("evaluation measures benefit harm controls isolation and operating cost", () => {
  for (const phrase of [
    "无记忆基线",
    "只使用显式画像",
    "从历史中检索",
    "综合画像",
    "相同的模型、任务集、安全策略和延迟口径",
    "写入",
    "更新",
    "检索",
    "使用",
    "控制与安全",
    "运营",
    "个性化增益",
    "错误个性化率",
    "陈旧、范围错误、置信过高或扭曲事实",
    "真实用户",
    "按记录来源、敏感性、年龄和范围分层",
  ]) expect(flat).toContain(phrase);
});

test("lower layers contested choices and the operational contract stay explicit", () => {
  for (const phrase of [
    "身份和授权",
    "存储与索引隔离",
    "持久事件历史",
    "备份策略",
    "最弱的身份、血缘、隔离和保留保证",
    "反复出现的行为并不能证明稳定偏好",
    "错误推断的代价",
    "暂停、临时和删除",
    "暴露底层状态变化",
    "主体是谁",
    "哪位经过身份验证的行为者",
    "为何为这次请求选中",
    "检查、更正、暂停、删除和导出",
    "积累了用户数据，而不是可靠的个性化记忆",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete market narratives and synthetic artifacts", () => {
  for (const phrase of [
    "用户状态的三个住处",
    "所有已上线的系统都选了第三个住处",
    "两种已上线的哲学",
    "记忆这条护城河",
    "真正的转换成本",
    "画像即攻击面",
    "rng = np.random.default_rng",
    "无界的流，有界的库",
    "超过 90%",
    "四家",
    "千万词元",
    "一句 `DELETE`",
    "—",
  ]) {
    expect(chapter).not.toContain(phrase);
  }
});
