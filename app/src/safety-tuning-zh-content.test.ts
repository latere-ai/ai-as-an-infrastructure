import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/06-safety-tuning-instruction-hierarchy.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/06-safety-tuning-instruction-hierarchy.qmd", import.meta.url),
  "utf8",
);

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function citations(source: string): string[] {
  return [...new Set([...source.matchAll(/@([a-z]+\d[\w-]*)/g)].map(([, key]) => key))].sort();
}

function crossRefs(source: string): string[] {
  return [...source.matchAll(/@(?:sec|fig|gls)-[\w-]+/g)].map(([ref]) => ref).sort();
}

test("Chapter 22 separates output policy, instruction authority, and runtime authorization", () => {
  expect(zh).toContain("安全调优必须先作出两个不同的判断");
  expect(zh).toContain("后训练改变的是模型行为，不是模型权限");
  expect(zh).toContain("## 两项判断，三类错误");
  for (const row of ["| 输出策略 |", "| 指令权限 |", "| 运行时授权 |"]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("越狱与提示注入彼此相关，却不是同一件事");
  expect(zh).toContain("前两行属于习得行为，第三行必须由模型之外的机制强制执行");
});

test("refusal calibration measures both unsafe compliance and benign refusal", () => {
  expect(zh).toContain("## 拒绝校准不是二元分类");
  expect(zh).toContain("拒绝只是其中一种动作，并不等同于安全本身");
  expect(zh).toContain(String.raw`\operatorname{UCR}`);
  expect(zh).toContain(String.raw`\operatorname{BRR}`);
  expect(zh).toContain("不安全服从率");
  expect(zh).toContain("无害拒绝率");
  expect(zh).toContain("平均值可能掩盖真正要紧的失败");
});

test("safe-completion training retains the proxy and generalization limits", () => {
  expect(zh).toContain("安全补全训练把目标从硬性的服从或拒绝标签");
  expect(zh).toContain(String.raw`r_i=h_i s_i`);
  expect(zh).toContain("同时压低不安全细节和空洞却安全的回答");
  expect(zh).toContain("它仍是习得的代理信号，不是硬约束");
  expect(zh).toContain("不能证明所有策略、模型或自适应攻击都有相同的取舍");
});

test("instruction hierarchy resolves applicable instructions rather than discarding lower ones", () => {
  expect(zh).toContain("## 指令层级负责解析适用的指令");
  expect(zh).toContain("指令层级是一条冲突处理规则");
  expect(zh).toContain("不要把角色与可信度混为一谈");
  expect(zh).toContain("Root > System > Developer > User > Guideline");
  expect(zh).toContain("默认无权限");
  expect(zh).toContain("显式委派");
});

test("the resolver procedure preserves provenance, delegation, and runtime enforcement", () => {
  expect(zh).toContain("输入：上下文 c，候选指令 I(c)，权限级别 a(i)");
  for (const step of [
    "找出来自有权承载指令之来源的候选指令",
    "默认把引用或检索得到的文本、工具输出和先前的助手文本标为数据",
    "只有适用指令明确委派权限时",
    "遵循所有余下且彼此相容的指令",
    "要求澄清或升级处理",
    "再执行输出策略和运行时授权",
  ]) {
    expect(zh).toContain(step);
  }
  expect(zh).toContain("并不是确定性的解析器");
});

test("hierarchy training and evaluation include aligned and conflicting cases", () => {
  expect(zh).toContain("## 同时训练一致与冲突样本");
  expect(zh).toContain("如果数据集里只有攻击样本，最省事的策略就是忽略用户与工具");
  expect(zh).toContain("上下文合成");
  expect(zh).toContain("上下文忽略");
  for (const row of [
    "| 低层级指令一致且相关 |",
    "| 低层级指令是不相关的数据 |",
    "| 低层级指令与更高权限冲突 |",
    "| 委派含糊且动作后果重大 |",
  ]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("3,538 个样本");
  expect(zh).toContain("从 84.1% 提升到 94.1%");
  expect(zh).toContain("并不是普适的安全保证");
});

test("written-policy supervision distinguishes Constitutional AI and Deliberative Alignment", () => {
  expect(zh).toContain("## 成文策略改变监督方式");
  for (const row of ["| 监督数据 |", "| 强化信号 |", "| 有证据支持的结论 |", "| 证据不支持的推论 |"]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("基于 AI 反馈的强化学习");
  expect(zh).toContain("策略回忆、策略应用与最终输出");
  expect(zh).toContain("流畅的理由无法挽救错误的判断");
  expect(zh).toContain("不必公开私有思维链");
  expect(zh).toContain("成文策略是监督目标，不是真值");
});

test("red teaming scores harmful capability rather than refusal wording", () => {
  expect(zh).toContain("## 评测失败本身，而不是拒绝措辞");
  for (const step of [
    "定义策略分类与威胁模型",
    "用人类、模型、变换与工具中介场景生成攻击",
    "评估目标输出的实际危害效用",
    "聚类失败样本",
    "保留完整的攻击家族",
    "采用能观察先前防御的自适应攻击",
  ]) {
    expect(zh).toContain(step);
  }
  expect(zh).toContain("判断回答是否真正交付了被禁止的能力");
  expect(zh).toContain("不要在发布集上调参");
});

test("the release gate covers both safety and usefulness slices", () => {
  for (const item of [
    "按策略类别报告不安全服从率与严重程度",
    "无害拒绝率",
    "安全补全的有用性与普通任务质量",
    "直接与间接提示注入的成功率",
    "语言、编码、多轮长度与检索数据来源",
    "留出的攻击家族",
    "自动评判者与经过策略培训的人类评审者之间的一致性",
  ]) {
    expect(zh).toContain(item);
  }
});

test("runtime safety remains a separate enforcement boundary", () => {
  expect(zh).toContain("## 与运行时安全的边界");
  expect(zh).toContain("只有系统在明确威胁模型下采用确定性强制机制时，边界才是硬的");
  for (const row of [
    "| 安全与层级调优 |",
    "| 运行时分类器与闸门 |",
    "| 授权与能力控制 |",
    "| 隔离与数据流控制 |",
  ]) {
    expect(zh).toContain(row);
  }
  expect(zh).toContain("即使模型误读了指令，这些控制仍然有效");
});

test("the contested claim and lower-layer constraint remain bounded", () => {
  expect(zh).toContain("新模型家族、长上下文、未见语言与工具中介的自适应攻击");
  expect(zh).toContain("都不会在模型内部形成形式化的安全边界");
  expect(zh).toContain("训练决定模型通常怎样行动");
  expect(zh).toContain("基础设施决定模型获准做什么");
  expect(zh).toContain("一次模型失误不会悄然变成外部副作用");
});

test("Chinese Chapter 22 preserves the complete English artifact contract", () => {
  expect(count(zh, /^## /gm)).toBe(count(en, /^## /gm));
  expect(count(zh, /^### /gm)).toBe(count(en, /^### /gm));
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^```\{=html\}$/gm)).toBe(count(en, /^```\{=html\}$/gm));
  expect(count(zh, /^```text$/gm)).toBe(count(en, /^```text$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("the Chapter 22 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the rewrite removes stale shortcuts and unsupported additions", () => {
  for (const rejected of [
    "一个简单的约束目标能写出其中的张力",
    "其中包含两条相互冲突的指令",
    "这种差异很要紧，因为它把安全从一串禁区主题",
    "收益是泛化",
    "安全样本本身覆盖不了整条边界",
    "真正困难的不是让模型拒绝",
    "后训练这一层是模型行为的第一道防线",
    "—",
  ]) {
    expect(zh).not.toContain(rejected);
  }
});
