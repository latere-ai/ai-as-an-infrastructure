import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/06-computer-use.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/06-computer-use.qmd", import.meta.url),
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

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function textFences(source: string): string[] {
  return [...source.matchAll(/```text\n([\s\S]*?)\n```/g)].map(
    (match) => match[1],
  );
}

test("Chapter 42 preserves the complete English computer-use contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "从脚本界面到学习控制",
    "部分可观测的控制循环",
    "像素、结构、标记与工具",
    "定位、执行与验证",
    "下层约束",
    "可靠性意味着抵达经过验证的状态",
    "环境也是系统的一部分",
    "界面同时是注入面和隐私面",
    "一条轨迹的成本",
    "评估实际运行的整个系统",
    "部署核对表",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(textFences(chapter)).toEqual(textFences(english));
  expect(chapter.match(/```\{dot\}/g)).toBeNull();
  expect(chapter.match(/^\|.+\|$/gm)).toBeNull();
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("```python");
});

test("the opening frames computer use as a bounded fallback", () => {
  for (const phrase of [
    "缺少适合当前工作的机器接口",
    "屏幕是一项观察",
    "指针和键盘事件是动作",
    "优先使用带类型的工具",
    "面向渲染软件的通用后备方案",
    "不是机器接口的通用替代品",
    "同一份运行与外部影响账本",
    "把定位分数与工作成功混为一谈",
  ]) expect(flat).toContain(phrase);
});

test("the history distinguishes scripted automation from learned control", () => {
  for (const phrase of [
    "屏幕驱动的自动化早于如今的多模态模型",
    "像素和 DOM",
    "选择器、无障碍属性或录制坐标",
    "截图进入模型",
    "开发者提供的工具执行",
    "界面变化不会因为学习式定位而消失",
    "哪一种观察和动作通道",
    "稳定身份",
  ]) expect(flat).toContain(phrase);
});

test("the control loop defines hidden state observations actions and verification", () => {
  for (const phrase of [
    "隐藏的应用状态",
    "观察过程",
    "截取元数据",
    "关于 $s_t$ 的证据，不是状态本身",
    "策略给出下一项动作的概率分布",
    "独立验证器",
    "每个符号都对应实现必须记录或限制的组件",
    "模型声称任务完成，也只是一项提议，不是证明",
  ]) expect(flat).toContain(phrase);
});

test("the action boundary binds fresh observations authority and effects", () => {
  for (const phrase of [
    "观察身份、时间戳、坐标系、窗口、焦点和所选模态",
    "语义意图、目标来源、账户、资源、载荷和预期影响",
    "授权、审批、新鲜度、焦点、坐标边界和可操作性",
    "等待可观察条件，而不是任意休眠",
    "`executed`、`rejected`、`timed_out` 和 `outcome_unknown`",
    "拒绝陈旧帧",
    "坐标映射",
    "每一道副作用边界",
  ]) expect(flat).toContain(phrase);
});

test("representation choices separate coverage from target identity", () => {
  for (const phrase of [
    "截图像素",
    "DOM 或无障碍树",
    "检测元素或标记集",
    "API 或带类型的工具",
    "覆盖范围和身份是两回事",
    "结构化观察同样是不可信内容",
    "最能准确表达这项操作的通道",
    "像素方案和纯结构方案",
  ]) expect(flat).toContain(phrase);
});

test("grounding execution and reliability remain separate", () => {
  for (const phrase of [
    "意图与规划",
    "目标识别",
    "定位",
    "执行",
    "结果验证",
    "定位难度很高",
    "不能证明定位主导",
    "降采样会抹掉细节",
    "显式坐标系",
    "放大会改变观察",
  ]) expect(flat).toContain(phrase);
});

test("reliability uses conditional probabilities and reconciles ambiguous effects", () => {
  for (const phrase of [
    "齐次且独立的特殊情况",
    "图形界面错误彼此相关",
    "经过验证的目标状态",
    "任务成功率本身会掩盖运营质量",
    "盲目重放可能造成重复操作",
    "权威当前状态",
    "查询并核对",
    "`needs_reconciliation`",
    "广义目标的审批不等于每次点击都获准",
  ]) expect(flat).toContain(phrase);
});

test("the environment separates application session and model state", () => {
  for (const phrase of [
    "浏览器环境",
    "完整桌面",
    "应用状态",
    "会话状态",
    "模型上下文",
    "恢复模型上下文不会恢复应用状态",
    "宿主浏览器画像",
    "下载内容进入隔离区",
    "普通容器并不拥有独立的操作系统内核",
  ]) expect(flat).toContain(phrase);
});

test("security and privacy keep interface content outside authority", () => {
  for (const phrase of [
    "不可信数据，不是权限",
    "只有用户的直接指令和外部策略",
    "困惑代理",
    "允许访问的域名并不代表其中内容可信",
    "分类器不是授权机制",
    "隐私保护始于模型推理之前",
    "输入敏感数据也属于传输",
    "暂停截图采集和模型动作",
    "在风险发生点设置审批",
    "屏幕上的文字永远不能自行批准操作",
  ]) expect(flat).toContain(phrase);
});

test("trajectory accounting measures each term and freshness tradeoff", () => {
  for (const phrase of [
    "计算机使用消耗的是一条轨迹，不是一次模型调用",
    "包括恢复步骤在内的尝试次数",
    "推理成本",
    "图像处理或图像词元成本",
    "浏览器、容器或虚拟机运行时间",
    "非重叠挂钟时间",
    "批处理可以减少模型调用，却会消耗新鲜度",
    "全部尝试的成本",
    "成功条件下的成本",
  ]) expect(flat).toContain(phrase);
});

test("evaluation covers the deployed system faults and uncertainty", () => {
  for (const phrase of [
    "定位基准",
    "端到端任务基准",
    "不是同一条不随时间变化的曲线",
    "基准版本和运行框架都是每个分数的一部分",
    "基于状态的验证器",
    "自助法置信区间",
    "能力、效率、恢复和安全",
    "焦点被夺走",
    "陈旧无障碍树",
    "结果不明的重复动作",
    "只通过干净路径",
  ]) expect(flat).toContain(phrase);
});

test("deployment contested boundary and multi-agent handoff remain explicit", () => {
  for (const phrase of [
    "首先考虑带类型或语义的替代方案",
    "每项变更都声明前置条件、后置条件、风险类别和重试策略",
    "独立验证器检查当前状态",
    "长期存在的兼容层",
    "最安全且能够表达该操作的接口",
    "多项策略共享浏览器或桌面",
    "争抢焦点",
    "使彼此的帧失效",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete certainty score theater and synthetic code", () => {
  for (const phrase of [
    "世界上大多数软件没有这样的接口",
    "永远不会提供别的",
    "永远都在的那个接口",
    "混合表示获胜",
    "瓶颈在视觉定位",
    "卡住智能体的是感知，不是推理",
    "端到端成功率 ~=",
    "accs  =",
    "两年爬完的基准",
    "高出两到三个数量级",
    "屏幕是唯一一个集成成本已经付清的接口",
    "爆发式增长",
    "实验室们自己拒绝站队",
    "越过了开篇那条人类基线",
    "hackernews2025promptfix",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
