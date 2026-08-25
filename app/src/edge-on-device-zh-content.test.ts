import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/practice/03-edge-on-device.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/practice/03-edge-on-device.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 83 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 边缘与端侧部署 \{#sec-edge\}/);
  expect(headings(chinese)).toEqual([
    ["##", "固定设备支持范围"],
    ["##", "算清需要装入内存的全部内容"],
    ["##", "测量完整路径和设备状态"],
    ["##", "压缩是一项系统决策"],
    ["##", "构建可部署的制品"],
    ["##", "明确规定混合路由"],
    ["##", "本地执行不等于自动获得隐私保障"],
    ["##", "安全交付模型版本"],
    ["##", "运营设备群"],
    ["##", "争议所在"],
    ["##", "下层约束"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the opening defines one versioned device deployment", () => {
  for (const phrase of [
    "端侧模型不是塞进手机里的一台小服务器",
    "带版本的设备部署",
    "模型、分词器、提示词模板、编译图、量化方案、运行时、路由策略和支持的设备类别",
    "离线路径",
    "更短且可预测的响应链路",
    "更窄的数据边界",
    "质量、内存、能耗、散热和运维支持要求",
    "异构设备群",
  ]) expect(flat).toContain(phrase);
});

test("the support envelope makes device eligibility testable", () => {
  for (const phrase of [
    "设备支持范围",
    "从功能出发，而不是从参数量或运行时出发",
    "任务类别",
    "质量门槛",
    "最低操作系统和运行时版本",
    "冷启动和热启动延迟",
    "峰值常驻内存",
    "离线行为",
    "回退策略",
    "重新验证触发条件",
    "验收矩阵",
    "通过、失败或不支持",
  ]) expect(flat).toContain(phrase);
});

test("memory feasibility accounts for the complete process", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "M_{\\mathrm{peak}}",
    "M_{\\mathrm{weights}}",
    "M_{\\mathrm{KV}}",
    "M_{\\mathrm{workspace}}",
    "M_{\\mathrm{runtime}}",
    "M_{\\mathrm{app}}",
    "M_{\\mathrm{budget}}",
    "N_{\\mathrm{params}}",
    "b_w",
    "n_{\\mathrm{kv}}",
    "d_h",
    "b_{\\mathrm{kv}}",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "量化元数据",
    "张量对齐",
    "峰值常驻内存",
    "内存压力",
    "在真实进程中测量导出的制品",
    "下界，而不是安装体积或常驻内存的保证",
  ]) expect(flat).toContain(phrase);
});

test("performance is qualified under sustained device conditions", () => {
  for (const phrase of [
    "冷启动",
    "热启动",
    "首词元时间",
    "每输出词元时间",
    "端到端延迟",
    "p50 和 p95",
    "每项合格任务的能耗",
    "热稳态",
    "电池状态",
    "后台负载",
    "持续运行",
    "降频",
    "带宽上限，不是预测值",
    "测量方法，而不是低精度一定能提速的承诺",
  ]) expect(flat).toContain(phrase);
});

test("compression remains artifact- and backend-specific", () => {
  for (const phrase of [
    "权重格式、激活格式和 KV 缓存格式",
    "为小规模预算专门设计的架构",
    "蒸馏",
    "结构化剪枝",
    "训练后量化",
    "校准集",
    "量化感知训练",
    "低比特预训练",
    "算子覆盖",
    "反量化开销",
    "确切制品与后端组合",
    "越小不一定越快",
    "零值权重不会自动形成结构化稀疏",
  ]) expect(flat).toContain(phrase);
});

test("the deployment fingerprint crosses export packaging and runtime", () => {
  for (const phrase of [
    "源检查点不是移动端制品",
    "格式不等于兼容性",
    "部署指纹",
    "不可变修订版本",
    "分词器、特殊词元和提示词模板",
    "导出图和导出器版本",
    "量化配置和校准集修订版本",
    "编译制品格式和密码学摘要",
    "运行时版本和链接的算子集",
    "后端委托器、回退分区和计算策略",
    "操作系统构建版本、ABI 和设备类别",
    "能力探测必须报告实际后端委托器和每一处 CPU 回退",
  ]) expect(flat).toContain(phrase);
});

test("hybrid routing fails safely and exposes execution provenance", () => {
  expect(chinese).toContain(
    "r(x,d,s,p) \\in \\{\\mathrm{local},\\ \\mathrm{cloud},\\ \\mathrm{decline}\\}",
  );
  for (const phrase of [
    "在执行前确定路由",
    "只能本地执行",
    "允许使用云端",
    "绝不能上传",
    "不得静默回退",
    "剩余截止时间",
    "模型不可用",
    "执行来源",
    "部分输出",
    "绝不能在用户无感知的情况下拼接云端续写",
  ]) expect(flat).toContain(phrase);
});

test("local execution does not overclaim privacy", () => {
  for (const phrase of [
    "本身并不能保证隐私",
    "临时文件",
    "崩溃报告",
    "遥测",
    "云端回退",
    "为完整功能绘制数据流图",
    "应用沙箱边界",
    "默认只收集不含内容的指标",
    "默认不收集提示词或模型输出内容",
    "单独授权、少量抽样、脱敏、限制访问、限定期限且可删除",
  ]) expect(flat).toContain(phrase);
  expect(chinese).not.toContain("数据从不离开手机");
  expect(chinese).not.toContain("隐私的缺口由架构补上");
});

test("model delivery is versioned verifiable and reversible", () => {
  for (const phrase of [
    "签名的兼容性清单",
    "密码学摘要",
    "签名信息",
    "分阶段下载",
    "原子激活",
    "上一已知正常版本",
    "回滚",
    "磁盘配额",
    "垃圾回收",
    "不能删除当前版本或回滚目标",
    "按代表性设备档位分阶段发布",
    "离线行为仍必须有明确定义",
  ]) expect(flat).toContain(phrase);
});

test("the operating procedure includes failures and requalification", () => {
  for (const phrase of [
    "固定支持范围",
    "建立指纹",
    "验证完整制品",
    "测量持续运行表现",
    "注入设备故障",
    "分阶段交付",
    "观察并回滚",
    "登记每项重新验证触发条件",
    "存储空间不足",
    "下载损坏",
    "后端拒绝",
    "温控降频",
    "部署决策记录",
    "记录为何不应在端侧发布",
  ]) expect(flat).toContain(phrase);
});

test("contested claims remain measured alternatives", () => {
  for (const phrase of [
    "三条边界仍需用实测回答",
    "本地还是云端，是功能层面的选择",
    "加速器的可移植性仍受算子覆盖、编译器行为和厂商运行时限制",
    "共用同一个源模型并不意味着可以共用同一份可执行文件",
    "极低比特训练",
    "不能保证目标设备能获得系统层面的延迟或能耗收益",
    "作为验收矩阵中的待测方案",
    "设备预算会反向约束整个技术栈",
    "模型的训练、表示、交付、观测和安全更新方式",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes stale catalogs and universal claims", () => {
  for (const phrase of [
    "到 2026 年年中",
    "Nano v3",
    "Nano 4",
    "Gemma 4",
    "Qwen3.5",
    "四股拉力",
    "隐私：数据从不离开手机",
    "最激进的方向是 1 比特",
    "一个可移植的、跑在 CPU 上的 GGUF 模型，往往是处处都能依赖的底线",
    "三元权重把能耗预算转成以加法为主的算术",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
});

test("the Chinese chapter preserves the English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(10);
  expect(chinese.match(/^\|---/gm)?.length).toBe(2);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toContain("/figures/edge-on-device-1.svg");
});

test("all localized Graphviz figures parse and fit the mobile column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const phrase of ["用户任务与数据类别", "设备支持范围", "设备验收矩阵", "本地、云端或拒绝"])
    expect(blocks[0][1]).toContain(phrase);
  for (const phrase of ["请求分类", "应用路由策略", "探测设备状态", "执行来源"])
    expect(blocks[1][1]).toContain(phrase);
  for (const phrase of ["发布不可变制品包", "下载到非活动位置", "原子激活", "上一已知正常版本"])
    expect(blocks[2][1]).toContain(phrase);
});

test("the complete Chinese chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/edge-on-device.html",
    chapterTitle: "边缘与端侧部署",
    chapterNum: "83",
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
  expect(html).toContain("端侧模型不是塞进手机里的一台小服务器");
  expect(html).toContain("记录为何不应在端侧发布");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
