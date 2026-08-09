import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 78 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 采用与生产率 \{#sec-adoption-productivity\}/);
  expect(headings(chinese)).toEqual([
    ["##", "先固定工作单位，再衡量工具"],
    ["##", "衡量获得工具使用权的效果"],
    ["##", "把价值和成本记在同一本账上"],
    ["##", "为什么有用的工具起初可能显得低效"],
    ["##", "阅读实证结果时，不要丢掉适用边界"],
    ["##", "分清采用、使用、能力与实际价值"],
    ["##", "争议所在"],
    ["##", "把采用试点当作决策流程"],
    ["##", "约束如何传导"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the opening defines productivity as a counterfactual change in accepted work", () => {
  for (const phrase of [
    "能力代表潜力",
    "生产率衡量的则是通过验收的工作发生了多少变化",
    "让起草者更快，却让审核者更慢",
    "堵塞共享队列",
    "反事实基线",
    "同一批符合条件的工作",
    "通过验收的工作单位",
    "任务范围",
    "工作者群体",
    "工作流",
    "工具版本",
    "审核规则",
    "时间窗口",
  ]) expect(flat).toContain(phrase);
});

test("the evaluation contract freezes the complete workflow denominator", () => {
  for (const phrase of [
    "完成的工作流单位",
    "职位名称或一次模型调用",
    "放弃、升级处理或被拒绝的尝试仍留在分母中",
    "职业暴露研究",
    "不衡量采用、实际生产率、岗位替代或投资回报",
    "先测量工作流单位，再做汇总",
    "符合条件的单位",
    "群体",
    "处理方案",
    "审核规则",
    "基线",
    "观察期",
    "新鲜感造成的短期效应",
  ]) expect(flat).toContain(phrase);
});

test("productivity remains a decision vector with defined units", () => {
  for (const marker of [
    "P_z = \\frac{A_z}{H_z}",
    "F_z = \\frac{A_z^{(1)}}{N_z}",
    "D_z = \\frac{\\sum_{s=1}^{S} w_s n_{zs}}{N_z}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "通过验收的产出率",
    "主动劳动时间",
    "端到端周期时间",
    "首次通过率",
    "审核时间",
    "返工",
    "升级处理",
    "按严重程度加权的缺陷",
    "事故",
    "客户结果",
    "工作者体验",
    "生成的词元数",
    "都不是生产率",
    "报告原始缺陷数量",
  ]) expect(flat).toContain(phrase);
});

test("the pilot estimand separates assignment access and voluntary use", () => {
  for (const marker of ["\\widehat{\\tau}_{\\mathrm{ITT}}", "Z_i=1", "Z_i=0", "Y_i"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "在预先确定的分层内随机分配工具使用权",
    "意向处理效应",
    "实际使用是分配之后的选择",
    "自愿使用者与未使用者",
    "选择偏差",
    "不依从",
    "工具使用者的平均效应",
  ]) expect(flat).toContain(phrase);
});

test("randomization follows the interference and coordination boundary", () => {
  for (const phrase of [
    "随机化单位必须与干扰边界一致",
    "共享队列、模板、审核者或会议负担",
    "溢出到对照组",
    "按团队或工作流做整群随机化",
    "网络设计或饱和度设计",
    "效应量、不确定性区间和子组样本量",
    "这里显著、那里不显著",
    "不能证明两个子组效应不同",
  ]) expect(flat).toContain(phrase);
});

test("the net-benefit ledger uses one currency horizon and counterfactual", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "NB_H=(R_1-R_0)+(C_0-C_1)-C_{\\mathrm{fixed}}-\\mathbb{E}[L_1-L_0]",
    "C_{\\mathrm{fixed}}/N_H",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "增量净收益",
    "同一种货币和同一个核算期",
    "基线组",
    "辅助组",
    "节省一小时只是释放容量，并不自动等于现金",
    "质量改善既算作收入，又算作避免返工",
    "仍应作为单独的护栏和压力情景",
    "每个通过验收单位的固定成本摊销额",
    "把试点中观察到的成本与预测产量分开",
    "不确定性区间",
  ]) expect(flat).toContain(phrase);
});

test("the ROI explorer and J-curve retain their actual scope", () => {
  expect(chinese).toContain('data-viz="roi-balance" data-lang="zh"');
  for (const phrase of [
    "归一化价值单位",
    "不是百分比、价格、证据或预测",
    "哪些假设会让决策反转",
    "生产率 J 曲线",
    "互补投资",
    "无形资本",
    "新流程、数据、培训、管理惯例和软件",
    "业务流程重设计",
    "测量滞后",
    "不能据此假定收益以后必然出现",
  ]) expect(flat).toContain(phrase);
});

test("task experiments preserve the exact population outcome and boundary", () => {
  for (const phrase of [
    "453 名受过大学教育的专业人士",
    "完成时间缩短 40%",
    "输出质量提高 18%",
    "758 名顾问",
    "两套任务",
    "多完成 12.2% 的任务",
    "速度快 25.1%",
    "正确率低 19 个百分点",
    "不能为其他模型、工作者或工作流定义永久边界",
    "旧版合成曲线已经删除",
  ]) expect(flat).toContain(phrase);
});

test("field evidence preserves treatment outcomes and limits", () => {
  for (const phrase of [
    "5,172 名客服坐席",
    "三百万次对话",
    "每小时解决的问题数提高 15%",
    "不是跨职业的大规模随机估计",
    "7,137 名工作者",
    "66 家自愿参加的企业",
    "每周邮件会话时间减少 1.4 小时",
    "依从者给出的估计为每周减少 2.0 小时",
    "没有发现会议时间、Word 使用时间、完成文档数量",
    "16 名开发者",
    "246 项任务",
    "完成时间增加 19%",
    "慢 2% 至 39%",
    "有代表性的无 AI 对照组",
  ]) expect(flat).toContain(phrase);
});

test("broader outcomes remain distinct from local task savings", () => {
  for (const phrase of [
    "丹麦",
    "行政记录",
    "任务也发生重组",
    "新增监督和集成工作",
    "收入或记录工时的平均影响",
    "工作者和工作场所层面超过 2% 的效应",
    "ChatGPT 发布两年后",
    "没有否认局部节省时间",
    "任务时间、工作变化、工时、收入和总体生产率是不同的结果",
  ]) expect(flat).toContain(phrase);
});

test("usage capability adoption and realized value remain separate evidence layers", () => {
  for (const phrase of [
    "使用日志只能定位请求",
    "超过四百万次 Claude 对话",
    "自我选择的 Free 和 Pro 对话",
    "排除了企业和 API 流量",
    "没有观察用户职位、最终产出或生产率",
    "GDPval",
    "44 个知识工作职业",
    "一次性任务",
    "都不能证明因果生产率或组织回报",
    "18% 的美国企业",
    "不超过三个职能",
    "相关关系，而不是因果关系",
  ]) expect(flat).toContain(phrase);
});

test("the evidence matrix states what each design cannot establish", () => {
  for (const phrase of [
    "| 能力基准 |",
    "| 产品使用日志 |",
    "| 采用调查 |",
    "| 受控任务实验 |",
    "| 现场实验或分阶段推广 |",
    "| 行政结果研究 |",
    "可以证明什么",
    "仍未测量什么",
    "采用、工作流成本、溢出效应和利润",
    "未测试的工作流与均衡效应",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary keeps every result attached to its design", () => {
  for (const phrase of [
    "不存在一个稳定不变的「AI 辅助工作」类别",
    "工具能力会变化",
    "工作者会学习",
    "任务组合会改变",
    "正向平均效应可能掩盖高严重度任务中的伤害",
    "早期变慢既可能是投资，也可能是真正的失败",
    "群体、处理方案版本、结果、审核边界和日期",
    "异质性本身是需要估计的结果",
  ]) expect(flat).toContain(phrase);
});

test("the seven-step adoption pilot ends in a bounded documented decision", () => {
  for (const phrase of [
    "固定工作单位",
    "登记实验设计",
    "同时记录两组",
    "执行验收规则",
    "估计效应",
    "核算价值与成本",
    "作出有边界的决策",
    "最低值得采用的效应",
    "缺失数据规则",
    "盲于实验条件的审核",
    "意向处理效应",
    "把容量转为现金的假设",
    "停止并回滚",
  ]) expect(flat).toContain(phrase);
  const section = chinese.match(/## 把采用试点当作决策流程\n([\s\S]*?)\n```\{dot\}/);
  expect(section).not.toBeNull();
  expect(section![1].match(/^\d+\. /gm)?.length).toBe(7);
  for (const phrase of [
    "方案及其修订记录",
    "分配表",
    "原始分组总量",
    "缺失情况",
    "护栏结果",
    "最终决策",
    "上线或不上线决策",
    "部署后监测",
  ]) expect(flat).toContain(phrase);
});

test("the constraint handoff preserves the accepted accountable work unit", () => {
  for (const phrase of [
    "可信替代方案",
    "模型与基础设施成本",
    "推断契约",
    "权利与合规条件",
    "一个通过验收且可问责的工作结果",
    "不是一个词元或一次模型调用",
    "能力代表潜力，生产率衡量的则是通过验收的工作发生了多少变化",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  expect(chinese).toContain("fig-adoption-roi-balance");
  expect(chinese).toContain("fig-adoption-pilot");
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(6);
  expect(chinese.match(/data-viz="roi-balance"/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/^\|.*\|$/gm)?.length).toBe(16);
  expect(chinese).not.toContain("adoption-productivity-1.svg");
  expect(chinese).not.toContain("锯齿生产率边界的示意图");
  expect(chinese).not.toContain("—");
});

test("the localized pilot graph parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
  for (const label of [
    "固定工作单位",
    "登记实验设计",
    "记录两组",
    "执行验收规则",
    "估计效应",
    "核算价值与成本",
    "采用 | 迭代 | 回滚",
  ]) expect(blocks[0][1]).toContain(label);
});

test("the complete Chinese chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/adoption-productivity.html",
    chapterTitle: "采用与生产率",
    chapterNum: "78",
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
  expect(html).toContain("能力代表潜力，生产率衡量的则是通过验收的工作发生了多少变化");
  expect(html.match(/<figure/g)?.length).toBe(2);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
