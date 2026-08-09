import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/practice/01-choosing-a-model.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/practice/01-choosing-a-model.qmd", import.meta.url),
  "utf8",
);
const runtime = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const flat = chinese.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 81 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 选择模型 \{#sec-choosing-model\}/);
  expect(headings(chinese)).toEqual([
    ["##", "选择系统，而不是名称"],
    ["##", "排序之前先审查准入资格"],
    ["###", "只有“开放”二字，信息仍然不足"],
    ["###", "托管、代管和自托管是不同的部署选择"],
    ["##", "下层约束：生产负载决定候选范围"],
    ["##", "用公开证据发现候选模型"],
    ["##", "争议所在：统一排名，还是与决策相关的估计？"],
    ["##", "围绕实际工作负载设计评测"],
    ["##", "比较每项合格任务的总成本"],
    ["###", "托管与自托管的成本交叉点"],
    ["##", "选择帕累托前沿，而不是单项冠军"],
    ["##", "通过系统接线维持选择的有效性"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis chooses a served system under one workload contract", () => {
  for (const phrase of [
    "模型选型是生产决策，不是查排行榜",
    "带版本的线上服务系统",
    "特定模型修订版",
    "供应商或服务构建",
    "提示词、工具、配置、安全控制和回退行为",
    "即使权重不变",
    "工作负载契约",
    "哪些任务重要",
    "什么结果才算合格",
    "硬约束",
    "质量、成本、延迟、可用性和运营风险",
    "没有适用于所有场景的赢家",
    "已经声明的工作负载和时间范围",
    "从闭源到开放权重只是一个输入条件，不是决策流程",
  ]) expect(flat).toContain(phrase);
});

test("candidate identity records every behavior-changing layer", () => {
  for (const phrase of [
    "供应商和模型 ID",
    "下载权重的制品摘要",
    "端点和区域",
    "提示词模板和消息格式",
    "工具模式和工具循环实现",
    "解码与推理设置",
    "预算和停止规则",
    "安全策略和内容过滤器",
    "缓存、批处理、路由器和回退策略",
    "测试采用的速率与容量上限",
    "任何会改变行为的字段",
    "新的候选系统",
    "线上服务实现、配额和条款都可能在代码仓库之外发生变化",
    "实际调用的线上配置",
  ]) expect(flat).toContain(phrase);
});

test("eligibility is a Boolean gate and unknown evidence cannot pass", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "E(m)",
    "H_{\\mathrm{license}}(m)",
    "H_{\\mathrm{data}}(m)",
    "H_{\\mathrm{region}}(m)",
    "H_{\\mathrm{interface}}(m)",
    "H_{\\mathrm{capacity}}(m)",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "法律审查允许预定用途",
    "服务处理与保留方式符合策略",
    "部署和处理位置得到允许",
    "所需模态、工具和输出形式能够工作",
    "满足所需负载和可用性",
    "每个条件都是布尔值",
    "未知不能视为通过",
    "明确的例外流程",
    "准入资格不是加权评分",
    "无障碍要求、安全控制、出口限制、审计证据、赔偿、数据删除或退出路径",
  ]) expect(flat).toContain(phrase);
});

test("artifact access permission and deployment terms stay separate", () => {
  for (const phrase of [
    "制品与权限分列记录",
    "只提供权重",
    "训练数据、训练代码或有用的模型卡",
    "代码许可证",
    "权重或数据的适用条款",
    "服务条款",
    "数据保留、使用客户数据训练、区域、可接受使用、速率限制、弃用和支持",
    "使用、研究、修改和分享",
    "所需的数据信息、代码和参数",
    "不能看到“开放”就推断拥有相应权利",
    "不构成法律意见",
    "可下载权重可以运行在自有机器、租用的加速器或代管端点上",
    "制品许可证与服务条款彼此独立",
    "容量、人员、安全和退出成本",
  ]) expect(flat).toContain(phrase);
});

test("production load constrains self-managed candidates before ranking", () => {
  for (const phrase of [
    "总参数量、数值精度、内存布局和运行时支持",
    "制品能否装入目标硬件",
    "符合生产形态的负载测试",
    "尾延迟和冗余要求",
    "空闲服务器上的平均每秒词元数不是容量规划",
  ]) expect(flat).toContain(phrase);
});

test("public evidence discovers candidates without deciding production", () => {
  for (const phrase of [
    "公开基准适合发现候选模型",
    "不能直接支撑生产决策",
    "构念是否匹配",
    "测试框架是否匹配",
    "不确定性",
    "数据来源",
    "被测系统",
    "模型、执行框架、工具、重试和预算",
    "真实代码仓库中的问题解决能力",
    "较新的竞赛题目",
    "汇总偏好",
    "不能直接证明事实正确性、策略合规性或工具可靠性",
    "不能仅凭差距证明数据污染",
    "运行受控测试",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary requires a target population and uncertainty", () => {
  for (const phrase of [
    "固定题集上的表现",
    "更大规模同类任务总体的估计",
    "需要明确的假设",
    "不确定性也可能不同",
    "目标总体",
    "不确定性区间",
    "还不能作为采购事实",
  ]) expect(flat).toContain(phrase);
});

test("internal evaluation freezes strata pairing repetition and precision", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "d_i=y_i^{(m)}-y_i^{(b)}",
    "\\delta>0",
    "-\\delta",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "工作负载分层",
    "生产权重",
    "验收规则和主要质量指标",
    "现有基线",
    "最小实际重要差异",
    "调优样本与锁定的确认集分开",
    "精度目标和样本量方案",
    "对所有候选系统使用同一批案例",
    "随机安排执行时间",
    "生产设置下重复试验",
    "聚类观测",
    "非劣效界值",
    "置信区间下界",
    "样本量",
    "没有站得住脚的万能样本数",
    "盲化候选身份",
    "裁判分歧",
    "位置偏差",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("50 到 200 条就够");
});

test("the evaluation contract is reviewable rather than a universal threshold", () => {
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
  for (const marker of [
    "eval-contract.yaml",
    "support-confirmation-v8.jsonl",
    "accepted_result",
    "design: paired",
    "repeats_per_case: 3",
    "noninferiority_margin: declared-before-run",
    "confidence_method: chosen-for-independent-unit",
    "cost_per_accepted_task",
    "p95_latency",
    "release: [shadow, canary, rollback]",
  ]) expect(chinese).toContain(marker);
});

test("cost is measured per accepted task over one accounting horizon", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of ["C_m=", "K_{msr}", "A_{msr}", "\\sum_s", "\\sum_r"])
    expect(compact).toContain(marker);
  for (const phrase of [
    "词元价格只是输入，不是经济结果",
    "每项合格任务的总成本",
    "同一个核算期和工作负载",
    "工作负载层 $s$",
    "重复试验 $r$",
    "加权合格数量为零时",
    "输入词元、输出词元、缓存写入与读取、工具调用、重试、网络费用、人工复核和预期事故成本",
    "加速器、CPU 与内存、存储、闲置容量、运维人力、值班工作和软件",
    "每次尝试成本",
    "客户端延迟",
    "首词元和端到端的 p50、p95 与 p99",
    "排队、预填充、解码、工具和重试",
  ]) expect(flat).toContain(phrase);
});

test("hosted versus self-hosted crossover states every assumption", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "C_h(N)=F_h+Nv_h",
    "C_s(N)=F_s+Nv_s",
    "N^*=\\frac{F_s-F_h}{v_h-v_s}",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "质量等价",
    "相同的服务目标",
    "固定成本",
    "每项合格任务的可变成本",
    "相同货币和相同核算期",
    "只有分子和分母使 $N^*>0$ 时",
    "不存在正的交叉点",
    "容量台阶、需求突增、承诺用量、利用率、迁移成本和价格变化",
    "不满足质量等价",
  ]) expect(flat).toContain(phrase);
  for (const marker of [
    'data-viz="cost-crossover"',
    'data-x-label="每个核算期内的合格任务数"',
    'data-a-label="托管"',
    'data-b-label="自托管"',
  ]) expect(chinese).toContain(marker);
});

test("selection preserves the Pareto tradeoff and controlled rollout", () => {
  for (const phrase of [
    "帕累托前沿",
    "至少不差，并且至少有一项更好",
    "支配",
    "删除被支配的候选系统",
    "关键故障率上界",
    "数据驻留",
    "不要把判断藏进任意设置的归一化权重",
    "取舍、负责人、证据和到期日期",
    "路由器本身也是一个带版本的系统",
    "错误路由、验证器错误、重复工作、回退延迟和外部影响",
    'data-mode="selection-contract"',
    'data-lang="zh"',
  ]) expect(flat).toContain(phrase);
});

test("the product-neutral decision tree is localized", () => {
  for (const phrase of [
    "满足所有硬约束？",
    "支持所需接口和容量？",
    "通过已经声明的质量门？",
    "在成本、延迟、可用性和风险上处于帕累托前沿？",
    "进入影子流量和金丝雀发布候选名单",
    "重新开始",
  ]) expect(runtime).toContain(phrase);
});

test("the gateway boundary preserves provider semantics and fallback policy", () => {
  for (const phrase of [
    "供应商适配器",
    "需要可移植性或集中控制",
    "网关是一种设计选择",
    "共享密钥、预算、可观测性和路由",
    "无法让不同供应商在语义上完全一致",
    "通常只覆盖公共子集",
    "工具语义、结构化输出、词元化、缓存、流式传输、多模态输入、推理控制和错误行为",
    "符合策略的回退系统",
    "数据与区域规则",
    "同一份评测契约验证",
    "含糊的超时和操作幂等性",
  ]) expect(flat).toContain(phrase);
});

test("the final rollout pins revisions records drift and remains replaceable", () => {
  for (const phrase of [
    "固定稳定修订版",
    "端点、区域、配置和观测日期",
    "哨兵评测",
    "每条追踪记录",
    "影子流量",
    "小规模金丝雀发布",
    "自动回滚",
    "合格率、关键故障、尾延迟、支出、容量和供应商错误",
    "模型或提示词变化",
    "价格或条款变化",
    "新的工具模式",
    "工作负载漂移",
    "质量漂移",
    "反复发生的容量故障",
    "决策记录到期",
    "工作负载契约、候选系统身份、准入证据、带不确定性的评测结果、成本账、帕累托取舍、发布负责人、回滚规则和重新评测触发条件",
    "今天可以解释，明天也可以替换",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(2);
  expect(chinese.match(/```\{=html\}/g)?.length).toBe(2);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(12);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/<figure /g)?.length).toBe(2);
  expect(chinese).not.toMatch(/^\| /m);
  expect(chinese).not.toContain(":::: {.runnable}");
  expect(chinese).not.toContain("choosing-a-model-1.svg");
  expect(chinese).not.toContain("—");
});

test("the rewrite removes volatile endorsements and unsupported shortcuts", () => {
  for (const phrase of [
    "GPT-5.6",
    "Opus 4.8",
    "Sonnet 5",
    "Fable 5",
    "Mythos 5",
    "Gemini 3.1",
    "DeepSeek-V4",
    "Qwen3.6",
    "Gemma 4",
    "GLM-5.2",
    "一个合理的默认",
    "三个榜一致是强信号",
    "应用永远不该直接对接厂商的原始 SDK",
    "智能体代码在两者之间无需改动",
  ]) expect(chinese).not.toContain(phrase);
});

test("both localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["工作负载契约", "硬约束门", "配对评测", "影子流量"]) {
    expect(blocks[0][1]).toContain(label);
  }
  for (const label of ["应用", "固定的系统配置", "供应商适配器或网关", "评测与发布门"]) {
    expect(blocks[1][1]).toContain(label);
  }
});

test("the complete Chinese chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/choosing-a-model.html",
    chapterTitle: "选择模型",
    chapterNum: "81",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings: renderedHeadings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("模型选型是生产决策，不是查排行榜");
  expect(html).toContain("今天可以解释，明天也可以替换");
  expect(html.match(/<figure[^>]*class="rdr-figure/g)?.length).toBe(4);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
