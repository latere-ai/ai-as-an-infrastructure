import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/09-deployment-lifecycle.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/09-deployment-lifecycle.qmd", import.meta.url),
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

test("Chinese Chapter 89 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 部署生命周期 {#sec-deployment-lifecycle}",
    "## 明确发布状态",
    "## 区分生命周期动作",
    "## 暴露前验证共存",
    "## 随证据和暴露范围逐步提升",
    "## 让闸门回答发布问题",
    "## 约束如何传导",
    "## 提升后检测变化",
    "## 恢复系统，而不只是切回流量",
    "## 演练失败，而不只验证成功",
    "## 完整生命周期",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines a controlled deployment release", () => {
  for (const phrase of [
    "受控状态转换",
    "部署发布契约",
    "已知基线",
    "候选版本",
    "兼容条件",
    "扩大暴露范围",
    "恢复动作",
    "部署发布记录",
  ]) expect(flat).toContain(phrase);
});

test("the release manifest fingerprints every behavior-bearing surface", () => {
  for (const phrase of [
    "发布清单",
    "模型修订版本",
    "服务运行时",
    "提示词修订版本",
    "检索快照",
    "工具 Schema",
    "策略修订版本",
    "路由配置",
    "数据 Schema",
    "遥测 Schema",
    "分配策略",
  ]) expect(flat).toContain(phrase);
});

test("mutable dependencies are bounded rather than presented as immutable", () => {
  for (const phrase of [
    "有界的可变依赖",
    "证据有效期",
    "变更检测探针",
    "重新验证规则",
    "回退方案",
    "终止开关",
    "无法证明字节级可复现",
  ]) expect(flat).toContain(phrase);
});

test("artifact identity includes trust and update metadata", () => {
  for (const phrase of [
    "制品摘要",
    "签名清单",
    "证明对象",
    "软件物料清单",
    "来源证明",
    "回滚攻击",
    "冻结攻击",
    "混搭",
  ]) expect(flat).toContain(phrase);
});

test("release vocabulary separates availability exposure and recovery", () => {
  for (const term of ["部署", "发布", "提升", "中止", "回滚", "向前修复"])
    expect(flat).toContain(`**${term}**`);
  expect(flat).toContain("并非同义词");
});

test("the compatibility envelope covers mixed-version state", () => {
  for (const phrase of [
    "兼容性边界",
    "旧读取方",
    "新读取方",
    "旧写入方",
    "新写入方",
    "请求与响应契约",
    "事件 Schema",
    "检索索引代际",
    "缓存命名空间",
    "会话状态",
    "检查点状态",
  ]) expect(flat).toContain(phrase);
});

test("schema migration preserves a declared recovery window", () => {
  for (const phrase of [
    "扩展、迁移、收缩",
    "双读",
    "双写",
    "可恢复的检查点",
    "引用完整性",
    "语义等价",
    "回滚窗口",
    "恢复边界",
  ]) expect(flat).toContain(phrase);
});

test("shadow execution has explicit authorization and isolation", () => {
  for (const phrase of [
    "当前授权",
    "抑制副作用",
    "沙箱化工具",
    "限制出站访问",
    "隔离缓存",
    "隔离状态",
    "丢弃候选输出",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("零用户风险");
});

test("canary assignment is sticky observable and controlled", () => {
  for (const phrase of [
    "分配单元",
    "租户",
    "用户",
    "会话",
    "对话",
    "任务",
    "粘性金丝雀",
    "同期对照组",
    "实际暴露",
    "样本比例失配",
  ]) expect(flat).toContain(phrase);
});

test("regional waves bound correlated failure", () => {
  for (const phrase of [
    "区域波次",
    "相关故障",
    "烘焙期",
    "故障转移容量",
    "容量余量",
    "一个活跃变更",
    "原子方式发布",
    "上一已知正常记录",
    "全局停止条件",
  ]) expect(flat).toContain(phrase);
});

test("the gate combines deterministic and statistical evidence", () => {
  for (const phrase of [
    "确定性不变量",
    "Schema 验证",
    "授权",
    "幂等性",
    "统计比较不能替代",
    "非劣效界值",
    "主要指标",
    "绝对 SLO",
    "伤害边界",
    "证据完整性",
    "默认阻止提升",
  ]) expect(flat).toContain(phrase);
  for (const marker of ["\\Delta_j", "L_j", "-\\delta_j"])
    expect(chinese).toContain(marker);
});

test("online comparison covers validity and delayed outcomes", () => {
  for (const phrase of [
    "共同故障",
    "群组间干扰",
    "残留效应",
    "新奇效应",
    "延迟结果",
    "固定时域",
    "始终有效",
    "可选停止",
    "检验功效不足",
  ]) expect(flat).toContain(phrase);
});

test("constraints keep exact contracts beside population estimates", () => {
  for (const phrase of [
    "逐字节完全一致",
    "总体估计",
    "Schema、权限、副作用与状态契约仍然必须精确",
    "评测证据",
    "边界契约",
    "授权规则",
  ]) expect(flat).toContain(phrase);
});

test("post-promotion drift triggers detection and requalification", () => {
  for (const phrase of [
    "配置漂移",
    "策略漂移",
    "检索语料或索引漂移",
    "工具漂移",
    "评测器漂移",
    "遥测漂移",
    "提供商修订版本",
    "不可变修订版本",
    "变更检测探针",
    "弃用通知",
    "重新验证",
  ]) expect(flat).toContain(phrase);
});

test("recovery distinguishes traffic state effects and repair", () => {
  for (const phrase of [
    "流量回滚",
    "状态恢复",
    "禁用功能",
    "撤销凭据",
    "补偿",
    "向前修复",
    "不可逆影响",
    "可逆",
    "可恢复",
    "只能向前修复",
  ]) expect(flat).toContain(phrase);
});

test("rollback has explicit prerequisites and objectives", () => {
  for (const phrase of [
    "上一版本制品",
    "向后兼容",
    "容量余量",
    "凭据和依赖仍然有效",
    "恢复窗口",
    "恢复时间目标",
    "恢复点目标",
    "备份恢复",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("回滚是一次路由改动");
});

test("recovery handles in-flight work and verifies the system", () => {
  for (const phrase of [
    "排空还是取消进行中的请求",
    "队列和积压",
    "混合版本写入方",
    "工具影响账本",
    "恢复验证",
    "黑盒任务",
    "终止条件",
  ]) expect(flat).toContain(phrase);
});

test("incident response has ownership and a working record", () => {
  for (const phrase of [
    "事件指挥官",
    "运维负责人",
    "沟通负责人",
    "发布负责人",
    "记录员",
    "冻结无关发布",
    "时间线",
    "根因分析",
  ]) expect(flat).toContain(phrase);
});

test("the release procedure has a failure matrix and drills", () => {
  for (const phrase of [
    "一致性测试",
    "故障矩阵",
    "统计功效不足",
    "影子副作用",
    "遥测缺失或过期",
    "区域发布不完整",
    "回滚或恢复失败",
    "区域疏散",
    "控制平面故障",
    "影响补偿",
  ]) expect(flat).toContain(phrase);
});

test("the complete lifecycle ends in a deployment release record", () => {
  for (const phrase of [
    "冻结签名发布清单",
    "构建并验证",
    "离线闸门",
    "暗启动",
    "粘性金丝雀",
    "区域波次",
    "部署发布记录",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain("最终产物是一份部署发布记录");
});

test("the rewrite preserves stable interfaces and artifact counts", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(4);
  expect(chinese.match(/^\|\s*---/gm)?.length).toBe(3);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toContain("```python");
  expect(chinese).not.toContain("fig-deployment-lifecycle-1");
  for (const marker of [
    "fig-deploy-bundle",
    "fig-deploy-pipeline",
    "fig-recovery-path",
    "@sec-serving-problem",
    "@sec-wiring-stack",
    "@sec-eval-practice",
    "@sec-security-authorization",
    "::: {#further-reading}",
  ]) expect(chinese).toContain(marker);
  expect(chinese).not.toContain("—");
});

test("localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/deployment-lifecycle.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["中止", "恢复", "向前修复"])
    expect(svgs[2], `recovery path should show ${label}`).toContain(`>${label}<`);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/deployment-lifecycle.html",
    chapterTitle: "部署生命周期",
    chapterNum: "89",
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
  expect(html).toContain("最终产物是一份部署发布记录");
  expect(renderedHeadings.some(({ text }) => text.includes("\\Delta"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
