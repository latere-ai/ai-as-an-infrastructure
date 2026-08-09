import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/10-context-engineering.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/10-context-engineering.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map(
    (match) => match[1],
  );
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

function fenceCount(source: string, opening: string): number {
  return [...source.matchAll(new RegExp(`^${opening}$`, "gm"))].length;
}

test("Chapter 46 preserves the complete English context-engineering contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "定义组装契约",
    "计算实际会执行的请求",
    "选择与摆放策略要靠实测",
    "保留权限边界与来源信息",
    "压缩是一种有损状态转换",
    "工具扩大候选集合，不扩大权限",
    "组装一次模型调用",
    "评估组装器，而不只是最终回答",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(fenceCount(chapter, "```text")).toBe(2);
  expect(fenceCount(chapter, "```\\{dot\\}")).toBe(1);
  expect(fenceCount(chapter, "```python")).toBe(0);
  expect(chapter.match(/<figure id=/g)?.length).toBe(1);
  expect(chapter.match(/\.runnable/g)?.length ?? 0).toBe(0);
});

test("the opening defines context engineering as a bounded per-call projection", () => {
  for (const phrase of [
    "一次推断中能看到什么",
    "并不取代模型权重中的知识",
    "有界且带版本的视图",
    "临时投影",
    "哪些经过授权的词元",
    "提示工程仍是其中一部分",
    "不意味着提示工程在某一天被重新命名了",
  ]) expect(flat).toContain(phrase);
});

test("the assembly contract separates role authority provenance and rendering", () => {
  for (const phrase of [
    "应用保存的状态，远多于一次模型调用应当容纳的内容",
    "这里有意把角色与权限分开",
    "并不会因此获得覆盖应用指令的权限",
    "实际渲染出的请求也是契约的一部分",
    "即使可见字符串完全相同",
  ]) expect(flat).toContain(phrase);
  for (const field of [
    "ContextSpec",
    "ContextItem",
    "tokenizer_revision",
    "chat_template_revision",
    "output_reserve",
    "authority",
    "source_version",
    "acl_version",
    "derived_from",
    "mandatory",
  ]) expect(chapter).toContain(field);
});

test("budgeting counts the exact serialized request and fails explicitly", () => {
  for (const phrase of [
    "序列化之后才开始",
    "模型专用的对话与工具模板",
    "输出预留",
    "准入检查，而不是要尽量逼近的目标",
    "为助手发出的工具请求以及工具结果留出空间",
    "不要把溢出行为交给没有文档说明的后端默认值",
    "明确失败",
    "静默裁剪会破坏可复现性",
    "与供应商返回的用量核对",
  ]) expect(flat).toContain(phrase);
});

test("selection placement and distractor claims preserve their empirical limits", () => {
  for (const phrase of [
    "相同四个示范的顺序",
    "不能当作无关紧要的装饰",
    "无关信息也并非中性",
    "并不能证明每一段额外文本都会降低质量",
    "不是每个模型、任务或上下文长度都遵循的定律",
    "置换测试",
    "检查实际载荷",
  ]) expect(flat).toContain(phrase);
});

test("authority provenance and injection controls remain application boundaries", () => {
  for (const phrase of [
    "先授权，再选择",
    "让数据保持为数据",
    "呈现冲突，不要抹平分歧",
    "格式本身并不是安全边界",
    "专门训练模型忽略数据通道中的指令",
    "最小权限工具",
    "后果重大的操作需要确认",
  ]) expect(flat).toContain(phrase);
});

test("compaction keeps durable truth separate from lossy working state", () => {
  for (const phrase of [
    "有明确损失策略的状态转换",
    "持久事实",
    "工作状态",
    "临时细节",
    "不能取代它们",
    "尚未消除的不确定性",
    "不可逆操作",
    "外部系统核对",
  ]) expect(flat).toContain(phrase);
});

test("tool protocols standardize exchange without granting authority", () => {
  for (const phrase of [
    "不会决定模型应该看到哪些能力",
    "协调客户端、权限、同意流程和上下文聚合",
    "不会把所有信任域合并成一个安全枢纽",
    "模式校验通过，不等于获得了调用权限",
    "远程服务器提供的注解应先只当作提示",
    "工具目录本身也会消耗词元",
    "确定性的发现机制",
    "原始结果与转换轨迹保留在窗口之外",
  ]) expect(flat).toContain(phrase);
});

test("the assembly algorithm and manifest make omissions diagnosable", () => {
  for (const phrase of [
    "经过身份验证的调用者",
    "记录每一项为何被保留、转换或省略",
    "绝不静默截断必选内容",
    "执行时重新授权",
    "ContextManifest",
    "检索失败",
    "授权过滤",
    "预算排除",
    "压缩损失",
    "序列化错误",
    "模型没有使用",
  ]) expect(flat).toContain(phrase);
});

test("evaluation covers policy quality robustness continuity security and operations", () => {
  for (const phrase of [
    "当前生产策略",
    "不添加上下文的基线",
    "完整上下文基线",
    "只包含必要且经过授权项目的理想基线（oracle）",
    "选择与使用",
    "稳健性",
    "连续性与安全性",
    "运行指标",
    "最差的相关项位置",
    "撤销访问权限",
    "已经完成的操作不会再次执行",
    "清单覆盖率",
  ]) expect(flat).toContain(phrase);
});

test("contested claims lower-layer costs and the evaluation handoff stay bounded", () => {
  for (const phrase of [
    "不存在公认且普适的上下文选择、压缩或排序策略",
    "需要在已部署系统上检验的竞争性假设",
    "键和值可以复用而无需重新计算",
    "仍需关注当前缓存中的整个序列",
    "精确且稳定的前缀",
    "缓存复用是一种优化，不是持久记忆",
    "有界且经过授权的输入",
    "可重放的清单",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("@sec-benchmarks");
});

test("the rewrite removes obsolete certainty chronology and examples", () => {
  for (const phrase of [
    "窗口是唯一的通道",
    "为何更大的窗口帮不上忙",
    "中间是一片死区",
    "更大的窗口只会把它拉得更长",
    "通常十到一百个",
    "2025 年改名为上下文工程",
    "N 乘 M 的问题",
    "减少了 98.7%",
    "上下文溢出会静默地截断",
    "rng = np.random.default_rng",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the curve and assembly diagram are localized", () => {
  for (const phrase of [
    'data-viz="curve" data-lang="zh"',
    'data-xlabel="相关项的位置"',
    'data-ylabel="任务得分"',
    'state [label="持久状态\\n+ 调用者策略"',
    'candidates [label="带来源信息的\\n已授权候选项"]',
    'input [label="有界的模型输入"]',
    'manifest [label="上下文清单"]',
  ]) expect(chapter).toContain(phrase);
});
