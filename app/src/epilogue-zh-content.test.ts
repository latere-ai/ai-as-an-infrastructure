import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/summary.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/summary.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function bodyParagraphs(source: string): string[] {
  return source
    .replace(/^# .+\n+/, "")
    .replace(/^## .+$/gm, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Chinese Epilogue preserves the complete English shape", () => {
  expect(chinese).toStartWith("# 尾声 {.unnumbered}\n");
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
    "下一步",
  ]);
  expect(bodyParagraphs(chinese)).toHaveLength(11);
  expect(bodyParagraphs(chinese).length).toBe(bodyParagraphs(english).length);
});

test("dependency rather than novelty defines AI infrastructure", () => {
  for (const phrase of [
    "产品、工作流程或机构开始依赖人工智能",
    "判定标准是依赖关系",
    "完整的生产系统",
    "模型只是其中一个组件",
    "维护",
    "恢复",
  ]) expect(flat).toContain(phrase);
});

test("the training inference and agent loops stay distinct and connected", () => {
  const markers = ["训练循环", "推理循环", "智能体循环"];
  for (const marker of markers) expect(flat).toContain(marker);
  const positions = markers.map((marker) => flat.indexOf(marker));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(flat).toContain("各自保存不同的状态，也需要不同的控制措施");
});

test("local mechanisms pass constraints through the complete stack", () => {
  for (const phrase of [
    "约束传导图",
    "局部选择",
    "分词器",
    "上下文窗口",
    "基准测试",
    "沙箱",
    "下游责任",
  ]) expect(flat).toContain(phrase);
});

test("capability efficiency and trust form one system-level vector", () => {
  for (const phrase of [
    "能力、效率与可信度",
    "系统层面的向量",
    "不是一份排名",
    "用户可见的任务",
    "可接受结果",
    "授权范围",
    "证据",
  ]) expect(flat).toContain(phrase);
});

test("production observations are not silently promoted into truth", () => {
  for (const phrase of [
    "生产事件首先是一条观测记录",
    "不会自动成为标签",
    "明确采集目的",
    "抽样",
    "评测集与训练集",
    "删除控制",
    "发布门禁",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("生产流量会变成下一代模型的数据");
});

test("technical progress is framed as conditional bottleneck movement", () => {
  for (const phrase of [
    "技术改进可能只是转移瓶颈",
    "推理成本下降",
    "上下文变长",
    "模型裁判变强",
    "合成数据",
    "验证、授权与审查",
    "条件性压力",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("未来不会由一条曲线决定");
  expect(flat).not.toContain("会迫使我们");
});

test("the infrastructure decision names distribution and failure", () => {
  for (const phrase of [
    "谁获益、谁付费、谁被排除",
    "谁拥有权限",
    "失败后如何处理",
    "并不会因为政策写进代码或指标就变得中立",
  ]) expect(flat).toContain(phrase);
});

test("the next step is a versioned operating record", () => {
  for (const phrase of [
    "带版本的运营记录",
    "系统身份",
    "用户承诺",
    "不确定性和失效条件",
    "容量与审查预算",
    "租户隔离",
    "回滚条件",
    "事故等级",
    "决策负责人",
    "发布记录",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion keeps responsibility with people", () => {
  expect(flat).toContain("系统采取行动后，人的责任并没有结束");
  expect(flat).toContain("谁仍要为系统行动的条件负责");
});

test("the rewrite removes the obsolete catalog-style conclusion", () => {
  for (const phrase of [
    "本书开头提出一个判断",
    "本书沿着一项能力走过了这套栈",
    "全书收束到一个习惯",
    "这也是基础设施视角的意义",
    "这张地图需要继续更新",
    "人的位置不能从图上消失",
    "只是在调用 API，并希望边界不要失守",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toMatch(/\S-\n\S/);
});

test("the complete Chinese Epilogue is substantial and renders", async () => {
  const body = bodyParagraphs(chinese).join("");
  expect(body.length).toBeGreaterThanOrEqual(2500);
  expect(body.length).toBeLessThanOrEqual(6000);

  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "summary.html",
    chapterTitle: "尾声",
    chapterNum: "",
    prefix: "",
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
  expect(html).toContain("产品、工作流程或机构开始依赖人工智能");
  expect(html).toContain("带版本的运营记录");
  expect(headings.map((heading) => heading.text)).toEqual(["下一步"]);
});
