import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/infrastructure/06-making-the-silicon.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/infrastructure/06-making-the-silicon.qmd", import.meta.url),
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

test("Chapter 67 preserves the complete English silicon-supply contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "造出这块硅：封装、HBM 与算力的地缘政治 {#sec-making-silicon}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "封装是一份物料清单，不是一个瓶颈",
    "从晶圆投片到已知良品裸片",
    "HBM 与先进封装彼此耦合，但不能互相替代",
    "约束如何向上传导",
    "产能主张需要证据契约",
    "外溢效应通过机会成本传导",
    "地理分布应按制造阶段来画",
    "出口管制应写成可执行的判定条件",
    "如何核验供给",
    "争议所在",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(dotLabels(chapter)).toEqual([
    "fig-making-silicon-ledger",
    "fig-making-silicon-flow",
    "fig-making-silicon-stage-map",
    "fig-making-silicon-evidence",
  ]);
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(runnablePython(chapter)).toEqual(runnablePython(english));
  expect(chapter.match(/^:::: \{\.runnable\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-tip\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^::: \{\.callout-important\}$/gm)).toBeNull();
});

test("the opening scopes supply to one product and time window", () => {
  for (const phrase of [
    "在指定产品与时间窗口内，究竟能有多少套通过认证的系统实际出货",
    "特定产品、季度与配额",
    "并非普遍规律",
    "共享设备、产品组合、库存与合同",
    "物料清单",
    "通过认证的出货",
  ]) expect(flat).toContain(phrase);
});

test("the bill-of-materials ledger keeps every unit compatible", () => {
  for (const phrase of [
    "多块逻辑裸片",
    "多组 HBM 堆栈",
    "中介层或重布线结构",
    "封装基板",
    "最稀缺的兼容输入或下游工序",
    "必须按同一个时间区间计量",
    "$N_{\\text{ship}}$ 是在指定时间窗口内通过最终验收的加速器数量",
    "已知良品逻辑裸片",
    "合格 HBM 堆栈",
    "装配与键合产能",
    "最终测试与认证产能",
  ]) expect(flat).toContain(phrase);
});

test("logic supply and the optimistic bound expose their assumptions", () => {
  for (const phrase of [
    "为该产品完成加工的逻辑晶圆数量",
    "扣除边缘与测试结构损失后的候选裸片数",
    "晶圆测试与分档边界",
    "刻意采用乐观假设",
    "兼容分档、安全库存、报废、返工、运输、配额优先级与法律冻结",
    "换算成能够组成一个成品封装的单位",
  ]) expect(flat).toContain(phrase);
});

test("the worked ledger is preserved and moves the binding stage", () => {
  for (const phrase of [
    "不采用任何供应商预测",
    "只演示单位换算",
    "改变库存量或物料清单用量",
    "观察约束工序如何变化",
  ]) expect(flat).toContain(phrase);
});

test("wafer manufacturing and test boundaries remain distinct", () => {
  for (const phrase of [
    "晶圆投片量不等于出货量",
    "已完成加工的晶圆",
    "候选裸片",
    "已知良品裸片",
    "晶圆测试",
    "切割与高成本封装装配",
    "测试覆盖率、工作条件、分档",
    "装配或老化测试后",
    "逻辑裸片良率、HBM 堆栈良率、中介层或封装基板良率、装配良率与最终测试良率",
  ]) expect(flat).toContain(phrase);
});

test("reticle choices and roadmap evidence keep their scope", () => {
  for (const phrase of [
    "掩模版视场限制常规单次曝光裸片的图形化面积",
    "单片裸片、多块小芯片、2.5D 或 3D 集成、拼接或晶圆级设计",
    "都会在裸片良率、互连、封装装配、散热与测试之间重新分配成本和风险",
    "超过两个掩模版视场",
    "5.5 个掩模版视场",
    "计划在 2028 年推出",
    "“量产中”与“规划中”属于不同的证据状态",
  ]) expect(flat).toContain(phrase);
});

test("HBM and packaging are coupled without becoming one capacity unit", () => {
  for (const phrase of [
    "垂直连接的 DRAM 裸片",
    "逻辑基底裸片",
    "2,048 个 I/O 连接",
    "供应商与产品方的主张",
    "并不能证明每一种加速器都已完成这些部件的认证",
    "并不意味着整个 HBM 堆栈都使用与计算裸片相同的先进制程",
    "N12 与 N3",
    "一块良品中介层无法替代缺少的 HBM 堆栈",
    "生产能力、客户认证、合同配额与验收出货是四个不同的里程碑",
  ]) expect(flat).toContain(phrase);
});

test("the constraint arrow runs backward through compatible inputs", () => {
  for (const phrase of [
    "下层约束是兼容性",
    "物料清单版本、电气与热设计限制、测试契约、配额周期和合法目的地",
    "从通过认证的系统向后追溯",
    "不能从一个庞大的工厂产能数字向前推演",
  ]) expect(flat).toContain(phrase);
});

test("capacity evidence states cannot be substituted for one another", () => {
  for (const phrase of [
    "已安装产能",
    "可用产能",
    "已承诺配额",
    "已公布扩产",
    "分析师估算",
    "供应商主张",
    "数据截止日期、产品与厂址范围，以及计量边界",
    "已安装产能不等于可用产能，可用产能也不等于已承诺配额",
    "路线图适合用于架构规划",
    "不能作为当前季度的库存写进供给台账",
  ]) expect(flat).toContain(phrase);
});

test("spillovers require an explicit opportunity-cost bridge", () => {
  for (const phrase of [
    "更多 HBM 就意味着更少的笔记本内存",
    "共享的洁净室空间或设备、工程资源、资本预算、供应商投入与产品组合决策",
    "库存、长期合同与专用产线",
    "如果 HBM 订单消失",
    "相关性，而不是完整的因果解释",
  ]) expect(flat).toContain(phrase);
});

test("geographic resilience is evaluated stage by stage", () => {
  for (const phrase of [
    "国家标签会掩盖它本应解释的供应链",
    "设计与 EDA、光刻设备、晶圆与化学品、逻辑制造、DRAM 制造、中介层加工、基板、装配、测试和客户认证",
    "不代表所有厂址可以互换",
    "制程、产品、产量与认证状态",
    "备选厂址只有在产出通过认证",
    "已公布的建厂计划只是未来韧性的一项选择权",
  ]) expect(flat).toContain(phrase);
});

test("export controls remain dated transaction predicates", () => {
  for (const phrase of [
    "物项参数、目的地、最终用途、最终用户及其所有权",
    "许可证政策、许可证条件",
    "出口、再出口或境内转移",
    "附着在具体交易上的法律判定条件",
    "总处理性能低于 21,000",
    "总 DRAM 带宽低于 6,500 GB/s",
    "逐案审查不等于批准",
    "现行《出口管理条例》与当期交易方筛查结果为准",
    "法律阈值定义的是管制边界",
  ]) expect(flat).toContain(phrase);
});

test("supply verification produces a reproducible decision ledger", () => {
  for (const phrase of [
    "产品、物料清单版本、获批供应商与厂址，以及认证版本",
    "产能单位、计量边界、配额周期与数据截止日期",
    "把承诺量与预测量分开记录",
    "良率边界、测试覆盖率、抽样规则与验收负责人",
    "交付周期的分位数",
    "备选方案的认证状态与切换时间",
    "故障触发条件、恢复计划与证据负责人",
    "损失一个厂址、HBM 良率下降、基板延迟交付、最终测试饱和或法律冻结",
    "哪些通过验收的出货还能维持、能维持多久",
  ]) expect(flat).toContain(phrase);
});

test("the contested questions and conclusion preserve uncertainty", () => {
  for (const phrase of [
    "哪一道工序构成当前约束",
    "HBM 会在多大程度上挤占普通 DRAM",
    "复制地理位置是否真的能提高韧性",
    "出口管制究竟改变了什么",
    "产品、客户、厂址、周次与认证状态",
    "规模与滞后时间都是实证问题",
    "需要反事实证据",
    "在同一个计量边界上核对证据",
    "从通过认证的出货开始",
    "采购、工程、财务与政策团队",
  ]) expect(flat).toContain(phrase);
});

test("obsolete bottleneck rhetoric and unsupported forecasts are absent", () => {
  for (const phrase of [
    "AI 算力如今不再受限于这里",
    "晶体管不是瓶颈",
    "整个 2026 年这条产线满载运转",
    "三家全部售罄",
    "AI 在赢",
    "地理就是政策",
    "供应链也决定架构",
    "主要约束是中介层还是内存",
    "是耐久的超级周期，还是人为造出来的短缺",
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
