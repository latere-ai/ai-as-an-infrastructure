import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/02-model-artifacts.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/02-model-artifacts.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("the Chinese model-artifacts chapter preserves the complete English structure", () => {
  expect(chinese).toMatch(
    /^# 模型作为一件制品：格式、分发与供应链 \{#sec-model-artifacts\}/,
  );
  expect(headings(chinese)).toEqual([
    "模型以制品包的形式到达",
    "加载是一道安全边界",
    "固定发布版本，再验证每个数据块",
    "每次转换都会产生派生制品",
    "完整性、来源、清单与行为是不同主张",
    "学得的行为也是供应链风险",
    "隔离、验证、准入",
    "约束如何向上传导",
    "争议所在",
    "从制品到服务",
    "延伸阅读",
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis treats deployment as a versioned bundle with two controls", () => {
  for (const phrase of [
    "可部署模型是一组带版本的制品，不是一个文件名",
    "发布修订版",
    "清单",
    "权重分片",
    "架构配置",
    "分词器",
    "对话模板",
    "生成默认值",
    "适配器",
    "自定义代码",
    "软件供应链控制",
    "模型评测",
    "部署记录两者都需要",
  ]) expect(flat).toContain(phrase);
});

test("the bundle manifest binds every path and role to exact bytes", () => {
  for (const marker of [
    "B =",
    "d_i",
    "p_i",
    "r_i",
    "m_i",
    "s_i",
    "h_i",
    "SHA256",
    "b_i",
    "\\operatorname{accept}(B)",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "正在审查的制品包",
    "准确的发布修订版",
    "规范清单",
    "规范化相对路径",
    "制品角色",
    "媒体类型或序列化格式",
    "预期字节数",
    "预期加密摘要",
    "已下载字节",
    "准确路径集合检查",
    "只能证明所选文件与规范清单一致",
  ]) expect(flat).toContain(phrase);
});

test("the loading boundary states safe defaults and their limits precisely", () => {
  for (const phrase of [
    "pickle 不是一种只保存数据的格式",
    "torch.save",
    "未压缩的 ZIP64 归档",
    "data.pkl",
    "weights_only=False",
    "从 PyTorch 2.6 开始",
    "weights_only=True",
    "缩小了代码执行面",
    "拒绝服务",
    "内存破坏",
    "safetensors",
    "八字节的头部长度",
    "张量元数据与原始张量字节",
    "不是可执行的对象重建指令",
    "trust_remote_code=True",
    "完整提交哈希",
  ]) expect(flat).toContain(phrase);
});

test("format and incident evidence keeps each parser boundary and scope", () => {
  for (const phrase of [
    "GGUF",
    "每个张量的类型",
    "ONNX",
    "带版本的计算图",
    "外部数据文件",
    "解析器或原生算子运行时",
    "约一百个 PyTorch 或 Keras 制品",
    "反向 shell",
    "报告没有说明这些制品中有多少被下载或执行",
    "两个采用 7z 包装的畸形 pickle 制品",
    "说明特定扫描器存在覆盖缺口",
  ]) expect(flat).toContain(phrase);
});

test("distribution pins repository state and verifies every required blob", () => {
  for (const phrase of [
    "仓库名称只是发现入口",
    "分支或标签可以变化",
    "完整仓库提交",
    "提交固定与文件摘要回答不同问题",
    "OCI Distribution Specification",
    "媒体类型、大小和摘要",
    "根清单摘要",
    "独立缓存或镜像",
    "分片索引",
    "部分下载或续传文件",
    "原子地移入共享缓存",
  ]) expect(flat).toContain(phrase);
});

test("the runnable rejects tampered, missing, and unmanifested files", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chinese.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(enCell).not.toBeNull();
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);
  for (const line of [
    "release-a: verified (3 files)",
    "release-a-tampered: rejected (digest mismatch: tokenizer.json)",
    "release-a-extra: rejected (unexpected file: modeling_custom.py)",
  ]) expect(chinese).toContain(line);
});

test("every transformation creates a separately identified child artifact", () => {
  for (const phrase of [
    "转换张量名称",
    "转换数值类型",
    "改变分片方式",
    "量化权重",
    "合并适配器",
    "添加投影附属文件",
    "编译计算图",
    "新的清单与新的摘要",
    "GGUF 是一种容器，不是量化算法",
    "源仓库修订版与每个源摘要",
    "转换工具版本",
    "转换参数",
    "输出张量模式",
    "与父制品比较的评测结果",
    "新的评测必不可少",
  ]) expect(flat).toContain(phrase);
});

test("the claims table keeps integrity authenticity provenance inventory and behavior separate", () => {
  for (const phrase of [
    "| 完整性 |",
    "| 信任策略下的真实性 |",
    "| 来源 |",
    "| 清单 |",
    "| 行为 |",
    "OpenSSF Model Signing",
    "分离式清单",
    "透明日志",
    "in-toto 声明",
    "SLSA 1.2 构建来源",
    "训练专用的构建类型",
    "CycloneDX",
    "ML-BOM",
    "模型卡",
    "任何一份文档都不是证书",
  ]) expect(flat).toContain(phrase);
});

test("behavioral supply-chain evidence retains its experimental scope", () => {
  for (const phrase of [
    "概念验证模型",
    "年份触发条件",
    "监督微调、强化学习和对抗训练",
    "没有估计这种威胁在真实发布中出现的概率",
    "约六十美元",
    "0.01%",
    "没有用该实验训练投毒模型",
    "6 亿至 130 亿参数",
    "250 份投毒文档",
    "实验专用的拒绝服务后门",
    "不能据此得出适用于其他触发条件",
    "EleuterAI",
    "没有报告受害者或下游传播",
    "无法证明不存在未知触发条件",
  ]) expect(flat).toContain(phrase);
});

test("the promotion procedure fails closed and remains revocable", () => {
  for (const phrase of [
    "无执行权限的隔离区",
    "路径允许列表",
    "意外文件",
    "只读",
    "一次性沙箱",
    "资源限制",
    "张量名称、形状、数值类型",
    "离线冒烟测试",
    "行为评测",
    "不可变的内部注册处",
    "原子方式准入",
    "准入并非永久有效",
    "签名者与构建者的撤销状态",
    "已撤销制品",
  ]) expect(flat).toContain(phrase);
  const steps = chinese.match(/^\d+\. /gm) ?? [];
  expect(steps.length).toBe(8);
});

test("the serving handoff and contested claims remain scoped", () => {
  for (const phrase of [
    "内部清单摘要，而不是公共仓库名称",
    "模型、分词器、模板、运行时和适配器",
    "没有一套普遍接受的流程",
    "静态检测器与基于表示的检测器",
    "未知触发条件",
    "可恢复性问题",
    "镜像可以提高可用性，却不能提高可审计性",
    "已准入制品是部署输入，不是安全证书",
  ]) expect(flat).toContain(phrase);
  for (const ref of [
    "@sec-model-landscape",
    "@sec-confidential-inference",
    "@sec-serving-problem",
    "@sec-deployment-lifecycle",
  ]) expect(chinese).toContain(ref);
});

test("the Chinese chapter uses the current figures and removes categorical legacy claims", () => {
  for (const figure of [
    "fig-artifact-bundle",
    "fig-artifact-lineage",
    "fig-artifact-promotion",
  ]) expect(chinese).toContain(figure);
  expect((chinese.match(/```\{dot\}/g) ?? []).length).toBe(3);
  expect((chinese.match(/\$\$/g) ?? []).length).toBe(4);
  expect((chinese.match(/:::: \{\.runnable\}/g) ?? []).length).toBe(1);
  expect((chinese.match(/::: \{\.callout-tip\}/g) ?? []).length).toBe(1);
  expect((chinese.match(/::: \{\.callout-important\}/g) ?? []).length).toBe(1);
  for (const stale of [
    "沿两个坐标轴之一交付",
    "这一章把它当作一个文件",
    "任何扫描器都永远抓不到",
    "每一次模型加载都是一次不可信代码的执行",
    "权重唯一的扫描器",
    "模型库就是注册处",
    "本领域大体达成的共识",
    "模型越大，投毒相对越容易",
    "fig-model-artifacts-loadpaths",
    "fig-model-artifacts-attacksurface",
  ]) expect(chinese).not.toContain(stale);
  expect(chinese).not.toContain("—");
});

test("every localized Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("the complete Chinese chapter renders through the final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/model-artifacts.html",
    chapterTitle: "模型作为一件制品：格式、分发与供应链",
    chapterNum: "74",
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
  expect(html).toContain("已准入制品是部署输入，不是安全证书");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
