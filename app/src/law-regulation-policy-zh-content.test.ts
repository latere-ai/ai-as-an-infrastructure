import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/safety/08-law-regulation-policy.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/08-law-regulation-policy.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function htmlFigureIds(source: string): string[] {
  return [...source.matchAll(/^<figure id="([^"]+)">$/gm)].map(
    (match) => match[1],
  );
}

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

test("Chapter 61 preserves the complete English law and policy contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "法律、监管与政策 {#sec-law-policy}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "先确认来源与效力状态",
    "先分类，再映射控制措施",
    "欧盟《人工智能法案》：多套分类并行，不是一座金字塔",
    "角色会沿价值链转移",
    "美国：多重权限交叠，并非监管真空",
    "国际文书与标准",
    "既有法律仍然适用于系统",
    "前沿模型自愿政策：有用、可修订，也有边界",
    "把要求转化为证据",
    "争议所在",
    "下层约束",
    "合规必须经得起系统变更",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "适用范围与基于用途的义务",
    "通用模型与系统性风险",
    "当前过渡时间表",
    "版权没有全球统一答案",
    "法律登记表",
    "回归场景",
  ]);
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(htmlFigureIds(chapter)).toEqual(htmlFigureIds(english));
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("/figures/law-regulation-policy-1.svg");
});

test("the opening treats compliance as a dated claim about a specific system", () => {
  for (const phrase of [
    "法律合规不是模型本身的一项属性",
    "特定系统",
    "预期用途",
    "实施该用途的主体",
    "司法辖区",
    "生效日期",
    "分析所依据的来源版本",
    "法律是工程输入",
    "本章不构成法律意见",
    "工程团队则必须维护这种解释所依赖的事实与证据",
  ]) expect(flat).toContain(phrase);
});

test("source types and legal status remain distinct", () => {
  for (const phrase of [
    "已制定的法律",
    "具有约束力的行政机关规则或命令",
    "官方指引",
    "条约",
    "共识标准",
    "自愿框架或公司政策",
    "合同",
    "已制定不一定意味着已经生效",
    "签署不等于批准",
    "批准也不一定意味着已经对该缔约方生效",
    "保留每项来源、发布日期、版本和获取日期",
  ]) expect(flat).toContain(phrase);
});

test("classification is a six-step versioned workflow", () => {
  for (const phrase of [
    'data-chip="盘点" data-title="1 · 盘点服务"',
    'data-chip="主体" data-title="2 · 识别所有主体"',
    'data-chip="分类" data-title="3 · 对系统和用途分类"',
    'data-chip="日期" data-title="4 · 确认法律效力状态"',
    'data-chip="证据" data-title="5 · 把义务映射到证据"',
    'data-chip="变更" data-title="6 · 监测变化"',
    "法律分类是一条带版本的流水线",
    "任何一步都可能使后续环节已经得出的结论失效",
  ]) expect(chapter).toContain(phrase);
});

test("the EU AI Act is described as parallel classifications rather than four tiers", () => {
  for (const phrase of [
    "并不会把所有系统塞进四个互斥层级",
    "被禁止的实践",
    "高风险系统",
    "透明度",
    "通用人工智能",
    "第 2 条",
    "第 6 条第 1 款",
    "附件 I",
    "第 6 条第 2 款与附件 III",
    "第 50 条",
    "@gls-brussels-effect",
    "不能替代法定适用范围分析",
  ]) expect(flat).toContain(phrase);
});

test("provider and deployer duties are not conflated", () => {
  for (const phrase of [
    "高风险系统提供者",
    "风险管理、数据治理、技术文档、日志、人类监督",
    "合格评定、登记、上市后监测和事件处置",
    "部署者承担不同义务",
    "遵循说明、安排具备能力的监督人员、监测使用情况",
    "基本权利影响评估",
    "不是每一项高风险部署都需要",
  ]) expect(flat).toContain(phrase);
});

test("GPAI duties exceptions and systemic-risk designation remain bounded", () => {
  for (const phrase of [
    "维护技术文档",
    "向下游提供者提供集成所需信息",
    "制定版权合规政策",
    "发布足够详细的训练内容摘要",
    "开源模型",
    "系统性风险模型不适用这项豁免",
    "`10^25 FLOP`",
    "高影响能力的可反驳推定",
    "委员会也可以依据法定标准指定模型",
    "模型评估、形成文档的对抗性测试",
    "不得无故拖延地报告严重事件",
  ]) expect(flat).toContain(phrase);
});

test("the EU transition calendar is explicit and versioned", () => {
  for (const phrase of [
    "2026 年 7 月 27 日",
    "2025 年 2 月 2 日",
    "2025 年 8 月 2 日",
    "2026 年 8 月 2 日",
    "2026 年 12 月 2 日",
    "2027 年 8 月 2 日",
    "2027 年 12 月 2 日",
    "2028 年 8 月 2 日",
    "这张表只是一个时间点的快照",
    "不能把某个日期硬编码进上线清单后便停止监测",
  ]) expect(flat).toContain(phrase);
});

test("value-chain roles and role-changing actions are explicit", () => {
  for (const phrase of [
    "提供者",
    "通用人工智能模型提供者",
    "下游提供者",
    "部署者",
    "进口商",
    "分销商",
    "产品制造商",
    "授权代表",
    "重新贴牌、实质性修改",
    "改变预期用途",
    "采购合同可以分配证据与协作责任",
    "不能消除法定角色",
  ]) expect(flat).toContain(phrase);
});

test("US governance is described authority by authority and date by date", () => {
  for (const phrase of [
    "不存在一部适用于私营系统的综合性横向联邦 AI 法律",
    "并不意味着法律真空",
    "消费者保护、反歧视、就业、信贷、隐私、医疗、产品安全",
    "M-25-21",
    "M-25-22",
    "治理、映射、度量和管理",
    "不是法律，也不是 NIST 认证",
    "科罗拉多州",
    "加利福尼亚州",
    "纽约州",
    "不能拼成一套全美通用的层级制度",
  ]) expect(flat).toContain(phrase);
});

test("the state-law table keeps jurisdiction labels legible on narrow screens", () => {
  for (const label of [
    "辖区",
    "约束性示例",
    "科罗拉多州",
    "加利福尼亚州",
    "纽约州",
  ]) {
    expect(chapter).toContain(
      `<span style="white-space: nowrap">${label}</span>`,
    );
  }
  expect(chapter).toContain(
    '<span style="display: inline-block; min-width: 24em">适用范围与施行日期</span>',
  );
});

test("international instruments separate legal force from assurance object", () => {
  for (const phrase of [
    "欧洲委员会《人工智能与人权、民主和法治框架公约》",
    "仍未达到生效门槛",
    "不能写成普遍可执行的现行法律",
    "OECD 人工智能原则",
    "不具有法律约束力",
    "ISO/IEC 42001:2023",
    "组织的人工智能管理体系",
    "ISO 本身并不认证组织",
    "并不证明某个具体模型安全、正确或符合法律",
    "法律效力",
    "保证对象",
    "只能说明对应关系，不能证明等价",
  ]) expect(flat).toContain(phrase);
});

test("existing law and copyright analysis remain jurisdiction-specific", () => {
  for (const phrase of [
    "AI 专门法是在既有义务之上叠加要求",
    "数据保护与隐私",
    "消费者保护",
    "就业与信贷",
    "产品安全与责任",
    "知识产权与合同",
    "必须按司法辖区、来源、许可、用途和诉讼程序阶段分别分析",
    "Bartz v. Anthropic",
    "Kadrey v. Meta",
    "Thomson Reuters v. Ross",
    "不能据此断言所有训练都属于合理使用",
    "和解不会创设判例",
    "公开可访问不等于获得许可",
  ]) expect(flat).toContain(phrase);
});

test("voluntary frontier policies remain useful but bounded evidence", () => {
  for (const phrase of [
    "能力阈值、评估、防护等级",
    "安全论证",
    "仍属于自愿的自我治理",
    "政策作者可以修订公司政策",
    "Anthropic 的负责任扩展政策",
    "OpenAI 的准备度框架",
    "Google DeepMind 的前沿安全框架",
    "政策是治理证据",
    "并不能证明阈值完整",
  ]) expect(flat).toContain(phrase);
});

test("requirements map to a many-to-many evidence chain", () => {
  for (const phrase of [
    "模型卡和数据说明书",
    "不能自动替代",
    "技术文档、合格评定、影响评估、上市后监测计划或事件报告",
    "来源条款及其版本",
    "适用性与分类理由",
    "要求与责任主体",
    "技术或组织控制措施",
    "制品与系统修订版本",
    "监测触发条件与报告时限",
    "多对多关系",
    "负面证据",
  ]) expect(flat).toContain(phrase);
});

test("incident routing keeps four distinct clocks", () => {
  for (const phrase of [
    "个人数据泄露",
    "通常不得晚于知悉后的 72 小时",
    "高风险系统严重事件",
    "通用人工智能系统性风险严重事件",
    "不得无故拖延",
    "加利福尼亚州前沿模型关键安全事件",
    "发现后 15 天",
    "24 小时",
    "一个事件可能同时触发多行",
    "保留知悉和发现时间戳",
  ]) expect(flat).toContain(phrase);
});

test("the legal register and regression suite preserve operational change", () => {
  for (const field of [
    "system_and_model_revisions",
    "intended_purpose_and_prohibited_uses",
    "markets_jurisdictions_and_effective_dates",
    "actors_roles_and_contractual_allocation",
    "legal_sources_status_and_versions",
    "classification_and_risk_category",
    "required_controls_and_evidence",
    "monitoring_incident_and_reporting_clocks",
    "change_triggers_and_reclassification",
    "exceptions_conflicts_and_legal_owner",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "市场扩张",
    "角色变化",
    "模型替换",
    "新增预期用途",
    "通用人工智能模型指定",
    "开源条件",
    "过期指引",
    "期限转换",
    "标准撤回",
    "事件时限",
    "主管机关要求",
    "留存冲突",
    "透明度标识",
    "绕过人类监督",
    "供应商证据",
    "司法辖区冲突",
    "没有发布阻断效果的警告，不算回归测试",
  ]) expect(flat).toContain(phrase);
});

test("contested questions retain uncertainty instead of categorical answers", () => {
  for (const phrase of [
    "哪些系统应承担固定合规成本",
    "算力能否代表能力",
    "透明度应当开放到什么程度",
    "独立保证究竟应当意味着什么",
    "谁能控制开放权重系统",
    "版权规则何时才会稳定",
    "不应把不确定性改写成绝对结论",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion makes compliance change-sensitive and claim-specific", () => {
  for (const phrase of [
    "法律会通过具体设计要求触及每一层",
    "成本并不能决定是否可以忽略一项适用义务",
    "合规备忘录只描述一个时点",
    "不存在抽象意义上“合规”的系统",
    "具名组织",
    "具名修订版本",
    "具名用途",
    "具名司法辖区",
    "具名日期",
    "任何一个名称或日期发生变化，合规结论都要重新打开",
  ]) expect(flat).toContain(phrase);
});

test("legacy categorical claims and invented examples are absent", () => {
  for (const phrase of [
    "多数软件所在之处，不承担任何新义务",
    "法案的触及范围与其说是法律上的域外效力",
    "一个跨两个市场部署的模型，继承的是它们两套要求的并集",
    "开发者为自己写的那份框架",
    "15 亿美元的集体和解",
    "最高一级是保险",
    "均值相同；相关的尾部需要多一个数量级的资本",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("random.seed(0)");
});

test("the Chapter 61 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
