import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/summary.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/summary.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function bodyParagraphs(source: string): string[] {
  return source
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Chinese Practice Summary preserves the complete English shape", () => {
  expect(chinese).toStartWith("# 小结 {#part-practice-summary .unnumbered}\n");
  expect(chinese).not.toMatch(/^## /m);
  expect(bodyParagraphs(chinese)).toHaveLength(6);
  expect(bodyParagraphs(chinese).length).toBe(bodyParagraphs(english).length);
});

test("the summary follows one operating sequence", () => {
  const markers = [
    "用户承诺",
    "带版本的在线服务系统",
    "系统指纹",
    "边界契约",
    "受控状态转换",
    "用户可见结果",
    "运营契约",
  ];
  for (const marker of markers) expect(flat).toContain(marker);
  const positions = markers.map((marker) => flat.indexOf(marker));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test("practice begins from a workload contract rather than a model", () => {
  for (const phrase of [
    "实践从用户承诺开始，而不是从模型名称开始",
    "工作负载契约",
    "范围内的任务和总体",
    "可接受结果",
    "硬性约束",
    "质量、延迟、可用性、成本和风险",
  ]) expect(flat).toContain(phrase);
});

test("the candidate is the complete served system", () => {
  for (const phrase of [
    "模型权重或托管模型版本",
    "提示词、工具、检索、策略、运行时、路由和设置",
    "云端服务、端侧路径、修改权重",
    "同一工作负载",
    "排行榜、参数量或更低的单位价格",
  ]) expect(flat).toContain(phrase);
});

test("selection becomes real through complete release units", () => {
  for (const phrase of [
    "完整的发布单元",
    "带版本的服务契约",
    "端侧部署",
    "适配发布版本",
    "智能体发布版本",
    "检索发布版本",
    "核心组件能够运行",
  ]) expect(flat).toContain(phrase);
});

test("each release unit preserves its full operational contract", () => {
  for (const phrase of [
    "请求语义",
    "导出、量化、支持的硬件、运行状态和交付方式",
    "受治理的数据、可复现的训练过程、评测和可逆工件",
    "可信控制器",
    "模型提案、工具、持久状态、权限和外部影响",
    "经过授权的查询路径",
    "沿袭关系、新鲜度、删除和引用证据",
  ]) expect(flat).toContain(phrase);
});

test("composition fingerprints every behavior-changing surface", () => {
  for (const phrase of [
    "每项可能改变系统行为的配置与接口",
    "不可变身份",
    "含义、授权、数据类别、截止时间、重试归属、幂等性、取消、背压、证据和恢复",
  ]) expect(flat).toContain(phrase);
});

test("deployment is a controlled transition with distinct states", () => {
  for (const phrase of [
    "不是复制文件",
    "证明新旧版本可以共存",
    "影子运行",
    "有界的金丝雀流量",
    "目标状态、观测状态、分配状态和迁移状态",
    "最近一次已知正常的完整系统",
    "只改模型路由",
  ]) expect(flat).toContain(phrase);
});

test("live reliability follows user-visible outcomes", () => {
  for (const phrase of [
    "不是逐字节重复，也不是 HTTP 成功状态码",
    "直接观测的事件",
    "可用性、延迟、策略、新鲜度或外部影响正确性",
    "SLI 和 SLO",
  ]) expect(flat).toContain(phrase);
});

test("semantic quality oversight and evidence remain distinct", () => {
  for (const phrase of [
    "单独的概率样本",
    "带版本的评分规则",
    "经过校准的裁判或人工审查",
    "标签截止时间",
    "覆盖率报告",
    "审批针对将要发生的确切外部影响",
    "提交时重新核验",
    "产品事件不会自动成为标签",
  ]) expect(flat).toContain(phrase);
});

test("production collection produces governed data products", () => {
  for (const phrase of [
    "明确用途",
    "最少必要内容",
    "使用权限",
    "抽样记录",
    "数据分区",
    "删除沿袭关系",
    "带版本的数据产品",
  ]) expect(flat).toContain(phrase);
});

test("cost is controlled per accepted task before billing arrives", () => {
  for (const phrase of [
    "每个已接受任务的成本",
    "原始尝试、重试、回退、检索、工具、裁判和审查",
    "估算、预留、准入、计量和对账",
    "滞后的账单报告到达之前",
    "合格回退",
    "信息安全、质量、延迟和租户要求",
  ]) expect(flat).toContain(phrase);
});

test("tenancy unknown states and incidents stay explicit", () => {
  for (const phrase of [
    "容量、缓存、索引、凭据、工具、出站访问、证据、审查和计费",
    "身份、策略、外部影响、用量或提交状态未知",
    "具名状态",
    "负责人、时钟、遏制权限、保全证据、恢复条件和纠正措施",
    "已接受风险",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract connects every promise to enforcement", () => {
  for (const phrase of [
    "带版本且可以执行的工件",
    "每项承诺连接到对应的测量",
    "每项预算连接到准入控制",
    "每项权限连接到执行点",
    "每个租户边界连接到失败路径测试",
    "每项事故决定连接到证据",
  ]) expect(flat).toContain(phrase);
});

test("the release record and conclusion preserve maintained responsibility", () => {
  for (const phrase of [
    "运营契约发布记录",
    "当前系统、适用范围、负责人、目标、例外、校验、发布、回滚、剩余风险和下次审查日期",
    "可靠基础设施",
    "承诺始终清晰可见、边界明确、可以测试且责任到人",
    "系统已经发生变化或经历故障",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete catalog framing", () => {
  for (const phrase of [
    "第十二部分把全书的姿态从解释转向运营",
    "反复出现的失效点",
    "最后的判断是",
    "一堆工具",
    "仍然没有定论的是",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toMatch(/\S-\n\S/);
});

test("the complete Chinese summary is substantial and renders", async () => {
  const body = bodyParagraphs(chinese).join("");
  expect(body.length).toBeGreaterThanOrEqual(1400);
  expect(body.length).toBeLessThanOrEqual(2600);

  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/summary.html",
    chapterTitle: "小结",
    chapterNum: "",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("katex-error");
  expect(html).not.toContain("**");
  expect(html).toContain("实践从用户承诺开始");
  expect(html).toContain("运营契约发布记录");
  expect(headings).toHaveLength(0);
});
