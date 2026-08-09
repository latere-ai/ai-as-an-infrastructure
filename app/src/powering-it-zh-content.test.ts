import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/07-powering-it.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/07-powering-it.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function prose(source: string): string {
  return source.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "");
}

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [
    ...prose(source).matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm")),
  ].map((match) => match[1]);
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

test("Chapter 68 preserves the complete English time-to-power contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "给它供电：当通电时间成为瓶颈 {#sec-powering-ai}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "电力是一份有日期的交付契约",
    "从电源到可用的 IT 电力",
    "并网队列不是交付预测",
    "表后供电改变了边界",
    "冷却方式取决于产品与设施契约",
    "约束如何向上传导",
    "电网需要负载行为模型",
    "每项成果的能耗必须声明边界",
    "如何核验通电时间",
    "争议所在",
    "约束如何向上传导",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-powering-critical-path",
    "fig-powering-ledger",
    "fig-powering-control",
    "fig-powering-evidence",
  ]);
  expect(tableCount(chapter)).toBe(0);
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-tip\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-important\}$/gm)?.length).toBe(1);
});

test("the opening scopes time-to-power to one site product and date", () => {
  for (const phrase of [
    "何时能在某个具体厂址让这些设备投入运行",
    "稀缺的不是发电容量，而是通电时间",
    "在指定地点、可靠性水平和日期下可交付的兆瓦数",
    "并非普遍规律",
    "厂址、产品与日期",
    "现场供电项目跨过商业、监管与调试验收关口",
    "把液冷作为默认方案",
    "明确的模型、遥测、保护方案与运行协议",
    "把每句口号还原成可核验的量",
  ]) expect(flat).toContain(phrase);
});

test("the delivery contract distinguishes power boundaries and dependencies", () => {
  for (const phrase of [
    "一吉瓦",
    "公用事业接入申请、发电机铭牌、购电协议、并网点上限、设施设计容量或实测 IT 负载",
    "不能互相替代",
    "有多少净额、稳定的兆瓦",
    "在明确的事故情景下",
    "关键路径",
    "从声明的项目起点到可用 IT 产能通过验收所经历的时间",
    "等待与执行时间",
  ]) expect(flat).toContain(phrase);
});

test("readiness percentiles preserve the dependency model", () => {
  for (const phrase of [
    "方程本身是确定性的",
    "P50 与 P90 通电日期",
    "不能机械地相加",
    "各项活动的 P90 通常不等于整个项目的 P90",
    "工期彼此相关",
    "示例数字不是预测",
    "改变工期或依赖关系",
  ]) expect(flat).toContain(phrase);
});

test("the power ledger converts source distribution and cooling to one boundary", () => {
  for (const phrase of [
    "最大可支持的 IT 有功功率",
    "不能重复计算",
    "变电站与下游配电系统",
    "@gls-pue，也就是数据中心总耗电除以 IT 设备耗电的比值",
    "冷却能力换算成它所能支持的 IT 功率负载",
    "可支持的整机架数量",
    "每机架设计功率",
    "净额稳定有功功率",
    "同一种事故假设与同一个平均区间",
  ]) expect(flat).toContain(phrase);
});

test("rack and PUE claims remain planning bounds rather than compute metrics", () => {
  for (const phrase of [
    "规划上界，而不是耗电预测",
    "机架铭牌功率、实测同时用电、负载多样性余量与设计冗余",
    "PUE 衡量设施辅助系统的开销，并不衡量有效计算",
    "1.54",
    "不能证明效率提升已经枯竭",
    "公司全体设施的平均值",
    "单个厂址",
  ]) expect(flat).toContain(phrase);
});

test("interconnection queues separate proposed supply from large-load delivery", () => {
  for (const phrase of [
    "发电项目并网队列中的拟建发电与储能项目",
    "不是等待负荷接入的数据中心队列",
    "无法单独证明某个大型负荷要等待多久",
    "同一开发商可能在选定厂址前提交多个接入申请",
    "投机性申请与重复申请",
    "可观察的就绪里程碑",
    "队列总量必须同时给出各成熟度关口的数量",
  ]) expect(flat).toContain(phrase);
});

test("the load and equipment ladders end in observed delivery", () => {
  for (const phrase of [
    "大型负荷申请",
    "厂址与商业准备状态已核验",
    "研究完成",
    "协议已签署",
    "所需升级工程在建",
    "获准通电",
    "实测已通电负荷",
    "每一级都记录兆瓦数与日期",
    "大型电力变压器",
    "36 个月",
    "60 个月",
    "不能据此给所有电压等级和设计指定一个统一交付周期",
  ]) expect(flat).toContain(phrase);
});

test("behind-the-meter supply changes rather than erases the boundary", () => {
  for (const phrase of [
    "燃料供应、排放许可、用水、噪声、设备交付周期、保护研究",
    "现场机组跳闸时由谁供电",
    "电气单线图与电价条款才定义边界",
    "公告、合同、许可或执照、融资、施工、调试验收与运行",
    "购电协议已经签署不等于产能已经投运",
    "贷款已经交割不等于监管已经批准",
  ]) expect(flat).toContain(phrase);
});

test("the Crane example and self-generation claim retain evidence status", () => {
  for (const phrase of [
    "10 亿美元贷款",
    "835 MW",
    "取决于 NRC 的许可批准",
    "截至 2026 年 8 月 7 日",
    "SAFSTOR",
    "项目真实且进展显著，但还不是一项正在运行的电源",
    "@gls-smr 协议与现场燃气方案",
    "已经跨过的关口，而不是最大的公告吉瓦数",
    "“自发电”也不等于脱离电力系统",
  ]) expect(flat).toContain(phrase);
});

test("cooling remains a product and facility acceptance contract", () => {
  for (const phrase of [
    "GB300 NVL72",
    "最高 142 kW",
    "针对具体产品的最大设计要求",
    "不是实测平均功率、年用电量或设施总负载",
    "部件热流密度、机架功率密度、冷却液与空气供回温度、液冷捕获热量的比例、当地气候、可维护性与既有建筑",
    "液冷带走高热流部件的热量，空气处理剩余热量",
    "冷板、后门换热器与浸没式冷却",
    "并非一条普遍适用的成熟度阶梯",
  ]) expect(flat).toContain(phrase);
});

test("cooling acceptance and the first constraint arrow reach the building", () => {
  for (const phrase of [
    "冷却液分配单元、供回液温度、流量与压力、水质与化学控制、材料兼容性、过滤、泄漏检测、剩余空气负载、控制逻辑",
    "泵或电源故障后的行为",
    "实测热量",
    "设备限制与冗余目标",
    "母线、开关设备、冷却液回路、排热系统、楼板承重与调试验收",
    "无论已经交付多少硬件",
  ]) expect(flat).toContain(phrase);
});

test("grid integration depends on a validated operating contract", () => {
  for (const phrase of [
    "2026 年 5 月 4 日",
    "三级重大行动警报",
    "客户主动触发的大型负荷骤降",
    "数秒内出现的显著振荡",
    "不代表每起事件都是 AI 训练作业",
    "稳态、暂态响应、谐波、保护、故障穿越、最大负荷投入与切除、爬坡速率，以及限电后的反弹",
    "时间同步遥测、事件记录、通信路径与明确的运行边界",
  ]) expect(flat).toContain(phrase);
});

test("compute flexibility is a contracted and tested service", () => {
  for (const phrase of [
    "转移工作、降低功率，或调用储能与现场电源",
    "限电量、通知时间、持续时长、恢复方式与可用性",
    "工作负载截止时间、检查点成本、安全爬坡限制与反弹峰值",
    "既发现了真实机会，也指出高成本、监管碎片化",
    "稳定合同需求",
    "非稳定合同需求",
    "不是全国统一并网方案已经生效的证据",
  ]) expect(flat).toContain(phrase);
});

test("energy totals and energy per result use declared units", () => {
  for (const phrase of [
    "总量能耗估算只能说明规模，不能证明某个厂址已经就绪",
    "415 TWh",
    "1.5%",
    "945 TWh",
    "176 TWh",
    "325 至 580 TWh",
    "条件情景范围，而不是置信区间",
    "每年 TWh、平均 GW、已接入 MW 与发电机铭牌功率回答的是不同问题",
    "每项合格成果的设施能耗",
    "质量门槛与服务等级目标",
  ]) expect(flat).toContain(phrase);
});

test("per-result reporting makes allocation and exclusions reproducible", () => {
  for (const phrase of [
    "“每次查询”不是充分的方法说明",
    "模型与运行时、硬件、请求组合、输入输出大小、缓存状态、批处理、重试、吞吐量、延迟分布与质量门槛",
    "加速器、服务器、集群 IT 或整座设施",
    "闲置容量与共享服务",
    "训练摊销、隐含能耗、外部网络与用户设备",
    "总能耗与分布，而不只给出中位数",
    "0.24 Wh",
    "不是“AI”的常数",
  ]) expect(flat).toContain(phrase);
});

test("time-to-power verification produces an auditable delivery claim", () => {
  for (const phrase of [
    "冻结电气单线图与物料清单版本",
    "并网点 MW、设施 MW 与 IT MW",
    "区分稳定产能与条件产能",
    "计划日期与实际日期、当前状态、证据负责人、来源文件、验收标准，以及 P50 与 P90 预测",
    "许可、研究、协议、采购订单、出厂测试、现场测试与运行遥测",
    "失去电网或现场电源、变压器或冷却液回路故障、负荷阶跃、限电与反弹",
    "恢复情景、决策日期与责任人",
    "可审计的交付主张",
  ]) expect(flat).toContain(phrase);
});

test("the contested section keeps five boundary-dependent questions", () => {
  for (const phrase of [
    "什么会最先成为约束",
    "申请负荷中有多少会真正落地",
    "现场发电会不会降低社会成本",
    "算力究竟有多灵活",
    "哪种能耗边界才公平",
    "带日期的物料清单与依赖图",
    "灵活性是一种经过测量的运营产品",
    "相同的边界、工作负载、质量与服务等级目标",
  ]) expect(flat).toContain(phrase);
});

test("the final constraint arrow intersects schedules and capacities", () => {
  for (const phrase of [
    "电力不会取代它上方的约束，而是加入这些约束",
    "机架可能先于变电站交付",
    "发电机可能先签合同、后拿许可",
    "园区可能已经通电，但负载行为尚未获准",
    "所有进度与产能的交集",
    "电源到变电站、变电站到机架、机架到冷却系统、模型到运行记录",
  ]) expect(flat).toContain(phrase);
});

test("obsolete absolutes and unsupported queue rhetoric are absent", () => {
  for (const phrase of [
    "2026 年，AI 能力的瓶颈约束从芯片下沉到了电力这一物理层",
    "芯片以月计到货，兆瓦以年计到货",
    "三道前置时间的排队串在一起",
    "选择自发电，而不再等电网",
    "风冷贯穿了数据中心此前的全部历史，可它根本带不走这些热",
    "兆瓦决定模型",
    "约 128 周",
    "售罄到 2030 年",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});

test("every translated Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
