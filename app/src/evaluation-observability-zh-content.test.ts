import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/07-evaluation-and-observability.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/07-evaluation-and-observability.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string): string[] {
  const prose = source.replace(/```[\s\S]*?```/g, "");
  return [...prose.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(
    ([, level, text]) => `${level} ${text}`,
  );
}

function references(source: string): string[] {
  return [
    ...source.matchAll(
      /(?<![A-Za-z0-9])@((?:sec|fig|gls)-[A-Za-z0-9-]+|[A-Za-z][A-Za-z0-9]*)/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
}

test("Chinese Chapter 87 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 评测与可观测性 {#sec-eval-practice}",
    "## 固定发布契约",
    "### 三项不同的工作",
    "## 构建评测数据集",
    "### 用例不是试验",
    "## 评分时不要掩盖失败",
    "### 比较完整的系统修订版本",
    "### 预先声明发布门槛",
    "## 把模型裁判当作测量工具",
    "## 谨慎地把生产证据纳入评测",
    "## 定义追踪契约",
    "### 导出前先做数据最小化",
    "### 采样会改变估计",
    "### 重放分为不同层级",
    "## 监控已通过验证的发布版本",
    "## 在发布前测试故障",
    "## 运营发布生命周期",
    "## 约束如何传导",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines one evaluation release and its decision", () => {
  for (const phrase of [
    "评测不是从排行榜或工具开始",
    "评测发布",
    "完整系统某个版本",
    "系统指纹",
    "决策主张",
    "目标总体",
    "关键分层",
    "发布门槛",
    "回滚目标",
    "合并、金丝雀发布、扩大流量、停止还是继续运行",
  ]) expect(flat).toContain(phrase);
});

test("the release contract versions the whole evaluated system", () => {
  for (const phrase of [
    "模型修订版本",
    "提示词修订版本",
    "检索快照",
    "工具 Schema",
    "策略修订版本",
    "解析器",
    "网关配置",
    "不可变的组件摘要",
    "上一已知正常版本",
    "重新验证触发条件",
  ]) expect(flat).toContain(phrase);
});

test("evaluation observability and monitoring remain different jobs", () => {
  for (const phrase of [
    "评测要回答",
    "@gls-observability，也就是可观测性",
    "监控会持续比较",
    "运行中的系统做了什么",
    "部分证据",
    "不是标签",
    "不是真值",
    "遥测数据导出失败",
  ]) expect(flat).toContain(phrase);
});

test("the dataset contract prevents leakage and contamination", () => {
  for (const phrase of [
    "评测用例",
    "版本化的输入",
    "标签来源",
    "隐私状态",
    "使用授权",
    "脱敏",
    "初步分类",
    "裁定预期行为",
    "去重",
    "开发集",
    "诊断集",
    "锁定留出集",
    "污染",
  ]) expect(flat).toContain(phrase);
});

test("cases trials and independent units stay distinct", () => {
  for (const phrase of [
    "随机性试验",
    "记录随机种子",
    "环境快照",
    "重复试验",
    "不会创造出另一个独立用户",
    "保留每一次超时、拒答、解析失败、工具错误和空结果",
    "独立单元",
    "用例权重",
    "行数不等于样本量",
  ]) expect(flat).toContain(phrase);
});

test("scoring keeps direct evidence slices and outcome states visible", () => {
  for (const phrase of [
    "确定性检查",
    "任务或参考评分",
    "人工判断",
    "合格的模型裁判",
    "运营指标",
    "安全性准则",
    "`pass`",
    "`fail`",
    "`invalid`",
    "`error`",
    "`abstain`",
    "`fallback`",
    "对小样本分层，应当得出“尚未确定”的结论",
  ]) expect(flat).toContain(phrase);
});

test("the paired estimand and uncertainty are self-contained", () => {
  for (const marker of [
    "\\widehat{\\Delta}",
    "s_{ir}^{B}",
    "s_{ir}^{A}",
    "R_i",
    "w_i",
    "\\sum_i w_i",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "候选系统 $B$",
    "基线系统 $A$",
    "部署权重加权后的配对变化",
    "置信区间",
    "对用例重采样",
    "分层 bootstrap",
    "按行 bootstrap 会凭空增加信息",
  ]) expect(flat).toContain(phrase);
});

test("release gates combine hard constraints and non-inferiority", () => {
  for (const marker of ["L_j", "\\delta_j", "-\\delta_j"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "置信下界",
    "非劣效界值",
    "每个必需的分层和准则",
    "硬性约束",
    "不存在通用的界值或置信水平",
    "没有观测到失败",
    "不等于风险为零",
    "风险上界",
  ]) expect(flat).toContain(phrase);
});

test("the release-gate display keeps Chinese prose outside mobile math", () => {
  expect(flat).toContain("发布可以要求每个必需的分层和准则都满足");
  expect(chinese).toContain("$$\nL_j \\ge -\\delta_j.\n$$");
  expect(chinese).not.toContain("\\text{对每个必需的分层和准则 }");
});

test("a model judge is qualified as a measurement instrument", () => {
  for (const phrase of [
    "受版本管理的测量工具",
    "裁判修订版本",
    "评分准则修订版本",
    "锁定的人工标注集",
    "混淆矩阵",
    "假通过率",
    "假不通过率",
    "位置偏差",
    "冗长偏差",
    "自偏好",
    "候选内容中的提示注入",
    "不是通用有效性的证明",
  ]) expect(flat).toContain(phrase);
});

test("judge agreement is formal runnable and bounded", () => {
  for (const marker of ["p_o", "p_e", "\\kappa", "n_{aa}", "n_{a\\cdot}"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "Cohen's kappa",
    "边际标签频率",
    "衡量一致性，不衡量正确性或安全性",
    "不能作为通用的信任门槛",
  ]) expect(flat).toContain(phrase);
  const code = [...chinese.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("cohen_kappa"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|sklearn/i);
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(new TextDecoder().decode(run.stdout)).toContain("agreement=0.89, kappa=0.53");
});

test("production evidence is triaged before it becomes regression evidence", () => {
  for (const phrase of [
    "诊断队列",
    "核实使用授权",
    "删除敏感数据",
    "重建系统指纹",
    "回归用例",
    "概率采样或分层采样",
    "风险队列",
    "不是总体发生率",
    "纳入概率",
    "随机且粘性的分流",
  ]) expect(flat).toContain(phrase);
});

test("the trace contract defines distributed work precisely", () => {
  for (const phrase of [
    "追踪 ID",
    "跨度 ID",
    "父跨度",
    "操作名称",
    "开始和结束时间",
    "跨度事件",
    "跨度链接",
    "输入摘要",
    "输出摘要",
    "证据 ID",
    "本地 Schema 及其版本",
  ]) expect(flat).toContain(phrase);
});

test("distributed context correlates work without carrying authority", () => {
  for (const phrase of [
    "W3C Trace Context",
    "`traceparent`",
    "Baggage",
    "不是存放秘密的地方",
    "凭据",
    "个人可识别信息",
    "租户内容",
    "授权决定",
    "外部调用方可以伪造",
  ]) expect(flat).toContain(phrase);
});

test("privacy and evaluator authority are minimized before export", () => {
  for (const phrase of [
    "在埋点时就应用数据分类",
    "默认不记录原始载荷",
    "导出前完成脱敏",
    "租户隔离",
    "访问日志",
    "保留期限",
    "经过测试的删除",
    "不受信任的数据",
    "不得拥有生产写入权限",
    "无上限的预算",
  ]) expect(flat).toContain(phrase);
});

test("sampling keeps inclusion probabilities and missing telemetry visible", () => {
  for (const phrase of [
    "头部采样",
    "尾部采样",
    "过度采样",
    "纳入概率",
    "设计加权估计",
    "稳定的概率样本",
    "有偏样本",
    "缺失遥测数据",
    "丢弃的跨度",
    "导出失败",
    "不能默认当作成功",
  ]) expect(flat).toContain(phrase);
});

test("replay fidelity and side effects stay bounded", () => {
  for (const phrase of [
    "精确重放",
    "结构重放",
    "语义重放",
    "标明实际达到的保真度",
    "外部状态",
    "可变模型别名",
    "不得仅为重现追踪而重放写入",
    "幂等沙箱",
    "明确只读的试运行适配器",
  ]) expect(flat).toContain(phrase);
});

test("monitoring alerts are contracts rather than causal claims", () => {
  for (const phrase of [
    "告警定义是一份运营契约",
    "分子",
    "分母",
    "聚合窗口",
    "缺失数据规则",
    "负责人",
    "处置手册",
    "系统指纹完整性",
    "裁判与人工判断的分歧",
    "漂移检测器只能说明某个受监控的分布发生了变化",
    "无法识别原因",
  ]) expect(flat).toContain(phrase);
});

test("latency and cost cover the complete accepted task", () => {
  for (const phrase of [
    "端到端延迟",
    "排队",
    "每次重试",
    "缓存查找",
    "模型调用",
    "工具调用",
    "每个合格任务的成本",
    "失败尝试",
    "裁判成本",
    "分摊的人工复核成本",
  ]) expect(flat).toContain(phrase);
});

test("the failure matrix preserves every failure and recovery action", () => {
  for (const phrase of [
    "留出集泄漏",
    "过期指纹",
    "裁判分歧",
    "缺失跨度",
    "采样偏差",
    "隐私泄漏",
    "Baggage 中的秘密",
    "工具副作用",
    "停止扩大流量",
    "恢复到上一已知正常版本",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle ends in a requalifiable release record", () => {
  for (const phrase of [
    "固定决策、系统指纹、目标总体",
    "数据集清单",
    "独立单元",
    "重复试验",
    "验证每套人工评审流程和模型裁判",
    "保留每次尝试",
    "置信区间门槛",
    "影子执行",
    "粘性金丝雀",
    "以原子方式回滚",
    "评测发布记录",
    "让恢复操作可以直接执行",
  ]) expect(flat).toContain(phrase);
});

test("constraints and contested automation remain explicit", () => {
  for (const phrase of [
    "服务架构决定了哪些内容可以评测和重放",
    "稳定的组件标识",
    "受限的评测器凭据",
    "追踪不会因此变得完整",
    "多少判断应该交给自动化",
    "模型裁判可以扩大规模",
    "人类带来专业能力",
    "保留弃权和不确定性",
    "哪项证据真正支撑了发布决策",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete product catalog and defaults", () => {
  for (const phrase of [
    "截至 2026 年年中",
    "2026 年的洗牌",
    "主要玩家",
    "选它的理由",
    "一个合理的默认选择",
    "LangSmith",
    "Langfuse",
    "Arize Phoenix",
    "Braintrust",
    "Promptfoo",
    "TruLens",
    "Helicone",
  ]) expect(chinese).not.toContain(phrase);
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(6);
  expect(chinese.match(/^\|---/gm)?.length).toBe(2);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/<figure id=/g)?.length).toBe(1);
  expect(chinese.match(/data-viz="judge-kappa"/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toContain("—");
});

test("all localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/evaluation-and-observability.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["脱敏", "采样", "导出"])
    expect(svgs[2], `observability diagram should show ${label}`).toContain(`>${label}<`);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/evaluation-and-observability.html",
    chapterTitle: "评测与可观测性",
    chapterNum: "87",
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
  expect(html).toContain("最终产物是一份评测发布记录");
  expect(renderedHeadings.some(({ text }) => text.includes("s_{"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
