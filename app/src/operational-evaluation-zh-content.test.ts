import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/07-operational-evaluation.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/07-operational-evaluation.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
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

function tableRows(source: string): string[] {
  return [...source.matchAll(/^\|.+\|$/gm)].map((match) => match[0]);
}

test("Chapter 53 preserves the complete English operational-evaluation contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "运营评测与治理 {#sec-operational-evaluation}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "运行前先写好发布政策",
    "分阶段收集不同证据",
    "让私有套件持续有用",
    "调整门禁前先诊断漂移",
    "选择运营点前先比较前沿",
    "让决策经得起会后检验",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(tableRows(chapter).length).toBe(tableRows(english).length);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(3);
  expect(chapter.match(/^```\{=html\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^!\[/gm)?.length).toBe(1);
});

test("the opening turns evaluation results into an operating decision loop", () => {
  for (const phrase of [
    "离线评测止于一个结果",
    "运营评测止于一项运营决策",
    "完整系统版本是继续推广、暂缓上线、缩小适用范围、回滚，还是升级处置",
    "什么新证据可以改变决定",
    "不只是一个模型名称",
    "测量、部署、监控和学习",
    "汇成一个发布循环",
  ]) expect(flat).toContain(phrase);
});

test("the release policy versions the full decision surface", () => {
  for (const field of [
    "decision_id",
    "candidate_system_hash",
    "baseline_system_hash",
    "target_population",
    "evaluation_manifest_hash",
    "metric_and_scorer_versions",
    "primary_decision_rule",
    "guardrail_margins",
    "invalid_outcome_policy",
    "stage_plan",
    "rollback_target",
    "decision_authority",
    "override_policy",
    "evidence_expiry",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "生成式系统扩大了受测范围",
    "每个会影响行为的组件",
    "超时、评分器故障、标签缺失和基础设施失败",
    "在确认运行开始前写好",
    "仪表盘是证据，不是政策",
  ]) expect(flat).toContain(phrase);
});

test("the formal gate defines comparison margins and evidence validity", () => {
  for (const phrase of [
    "$v$ 表示候选系统版本",
    "$b$ 表示基线版本",
    "预先声明的切片 $s$",
    "候选版本与基线版本之差",
    "$G(v)$ 是最终门禁结论",
    "非劣效界值",
    "绝对质量下限",
    "硬性运营谓词",
    "证据有效性谓词",
    "四个条件必须全部成立",
    "越低越好的指标",
  ]) expect(flat).toContain(phrase);
});

test("the wide gate equation wraps on a narrow reading surface", () => {
  expect(chapter).toMatch(
    /\\begin\{aligned\}[\s\S]*G\(v\)[\s\S]*\\\\[\s\S]*\\land H\(v\)[\s\S]*\\end\{aligned\}/,
  );
});

test("pass fail and unresolved remain distinct under paired analysis", () => {
  for (const phrase of [
    "通过、失败和未决",
    "未决不等于通过",
    "同一批独立单位",
    "分析配对差值",
    "McNemar 精确检验",
    "配对随机化或自助法",
    "保留效应估计及其区间",
    "运行结束后寻找有利切片",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("Fisher 精确检验");
});

test("each rollout stage contributes evidence unavailable to the previous stage", () => {
  for (const phrase of [
    "离线确认",
    "影子流量",
    "金丝雀放量",
    "持续生产监控",
    "不得执行用户可见的写入",
    "金丝雀版本与对照版本同时运行",
    "自动停止或回滚路径",
    "任何阶段都不能替代另一个阶段",
  ]) expect(flat).toContain(phrase);
  expect(tableRows(chapter).length).toBe(6);
});

test("the localized release diagram preserves the evidence progression", () => {
  for (const phrase of [
    'OFF [label="离线确认"]',
    'SH [label="影子流量"]',
    'CAN [label="金丝雀放量"]',
    'MON [label="生产监控"]',
    'IN [label="经验证的回归候选项"]',
    'OFF -> SH [label="通过"]',
    'MON -> IN [label="已确认故障"]',
  ]) expect(chapter).toContain(phrase);
});

test("private suites separate development confirmation and diagnosis", () => {
  for (const phrase of [
    "开发套件",
    "锁定的确认套件",
    "诊断套件",
    "暴露台账",
    "事故只是候选案例的证据",
    "不能直接成为阻断性测试",
    "去标识化、范围审查、复现检查",
    "评分器的正例和反例",
    "退役或重新标注",
    "抽查通过的案例",
  ]) expect(flat).toContain(phrase);
});

test("the suite lifecycle preserves source ownership exposure and retirement", () => {
  for (const phrase of [
    "observe -> triage -> de-identify -> reproduce -> label and test grader",
    "assign suite role -> version -> monitor exposure -> retire or relabel",
    "评测数据维护",
    "隐藏依赖和未声明的使用方",
    "接收和整理生产数据",
  ]) expect(flat).toContain(phrase);
});

test("drift diagnosis separates system population and measurement changes", () => {
  for (const phrase of [
    "系统变化",
    "群体变化",
    "测量变化",
    "把新旧测量工具应用于同一份留存证据",
    "固定哨兵案例",
    "抽样线上流量",
    "延迟结果标签",
    "分布告警不能证明质量回退",
    "把信号送去调查",
    "欠定性",
  ]) expect(flat).toContain(phrase);
});

test("every release decision retains reconstructable provenance", () => {
  for (const field of [
    "system_component_hashes",
    "evaluation_result_ids",
    "rollout_stage",
    "traffic_assignment",
    "stage_results",
    "monitoring_window",
    "override_actor_and_reason",
    "override_expiry",
    "decision_and_timestamp",
    "rollback_target_and_trigger",
    "incident_followup_ids",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "生成式 AI 语义约定目前仍处于开发状态",
    "哈希或受控的工件引用",
    "语义约定不能标识整个实验",
    "不可变统计记录",
    "只追加的证据",
    "重新评分会生成一条新结果",
  ]) expect(flat).toContain(phrase);
});

test("the operating frontier precedes any scalar utility choice", () => {
  for (const phrase of [
    "先报告 Pareto 前沿",
    "$m$ 是一个完整系统选项",
    "每项任务的计量成本",
    "延迟统计量",
    "预期复核或事故负担",
    "权重是政策选择",
    "中位数和尾部延迟",
    "质量护栏仍应作为约束",
    "标量不能授权安全权衡",
  ]) expect(flat).toContain(phrase);
});

test("governance records authority overrides incidents and follow-up", () => {
  for (const phrase of [
    "模型卡",
    "Datasheets for Datasets",
    "治理、映射、测量和管理",
    "指定负责人",
    "覆盖决定必须有期限",
    "补偿控制",
    "用户或系统受到的影响",
    "纠正措施及负责人",
    "回归候选项或明确接受的风险",
    "不能成为测试",
  ]) expect(flat).toContain(phrase);
});

test("the operating review closes the release loop", () => {
  for (const phrase of [
    "这项决策覆盖哪个完整系统和目标群体",
    "哪些锁定证据支持主要结论和每项护栏",
    "离线、影子和金丝雀阶段分别增加了什么证据",
    "哪些生产信号可以停止发布或触发回滚",
    "如何在不污染确认数据的前提下闭合循环",
    "只存在于某个人的记忆中",
  ]) expect(flat).toContain(phrase);
});

test("contested automation and lower-layer enforcement remain explicit", () => {
  for (const phrase of [
    "多少决策权限可以交给自动化",
    "人工复核不等于可以临场发挥",
    "自动化也不是中立的",
    "稳定的系统哈希和轨迹标识符",
    "隔离的影子执行、流量分配、分阶段路由",
    "已知可用的回滚目标",
    "智能体结果又会退回自报成功",
    "下层先把控制做实",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes superseded headings and obsolete detours", () => {
  for (const phrase of [
    "发布门禁是一条策略",
    "私有套件是一项资产",
    "漂移不止一种",
    "质量不是唯一轴",
    "治理把证据变成记忆",
    "模型漂移还是唯一按日程到来的漂移",
    "盯住模型目录和运行框架注册表",
    "来源清单比直觉里的更长",
    "五次运行全部锁定同一话题",
    "机器写的解读",
    "每一次严肃生产失败，都应变成一个回归测试",
    "shadow",
    "schema",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});
