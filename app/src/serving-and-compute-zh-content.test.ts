import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/practice/02-serving-and-compute.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/practice/02-serving-and-compute.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 82 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 服务、网关与算力 \{#sec-serving-stack\}/);
  expect(headings(chinese)).toEqual([
    ["##", "固定服务契约"],
    ["##", "测量用户实际等待的时间"],
    ["###", "引擎机制是有条件的调节手段"],
    ["###", "对完整系统指纹做基准测试"],
    ["##", "只有边界有价值时才引入中介层"],
    ["##", "根据测量结果采购容量"],
    ["###", "先估算规划下界，再做负载测试"],
    ["##", "按工作负载语义选择编排方式"],
    ["##", "下层约束"],
    ["##", "把决策落实为运营流程"],
    ["##", "争议所在"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the opening defines serving through an accepted workload envelope", () => {
  for (const phrase of [
    "只有端点返回文本，不等于模型已经得到可靠服务",
    "已声明的一类请求",
    "质量、延迟、可用性、成本和策略边界",
    "版本化的服务契约",
    "模型制品、运行时、适配器、请求语义、路由策略和算力放置",
    "共同产生结果",
    "完整路径",
    "代表性负载",
    "手段，不是架构起点",
  ]) expect(flat).toContain(phrase);
});

test("the request contract fixes behavior rather than only HTTP shape", () => {
  for (const phrase of [
    "HTTP 请求格式只是连接组件的手段，不是行为标准",
    "消息角色",
    "工具和 JSON Schema 方言",
    "分词方式",
    "流式事件",
    "停止条件",
    "安全行为",
    "共同支持的传输子集",
    "仍要允许应用调用原生接口",
    "租户、调用方、请求类别、追踪 ID",
    "截止时间与取消",
    "背压和过载响应",
    "数据分类与区域",
    "副作用类别",
    "授权主体",
    "所选部署",
  ]) expect(flat).toContain(phrase);
});

test("adapter conformance rejects silent translation loss", () => {
  for (const phrase of [
    "适配器一致性测试集",
    "普通消息",
    "部分流和已取消的流",
    "上下文长度错误",
    "用量核算",
    "超时、速率限制、拒绝和格式错误的响应",
    "转换、模拟或丢弃",
    "不能静默忽略",
    "翻译损失报告",
    "每条候选路由",
    "每次适配器升级",
  ]) expect(flat).toContain(phrase);
});

test("the deployment fingerprint versions every behavior-changing layer", () => {
  const compact = chinese.replace(/\s+/g, "");
  expect(compact).toContain("c=(a,e,m,z,p,k,d,h,r)");
  for (const phrase of [
    "供应商适配器及其版本",
    "引擎镜像与配置",
    "模型、分词器和制品摘要",
    "提示词模板、工具解析器和结构化输出设置",
    "数值精度和并行放置",
    "注意力与 KV 缓存策略",
    "解码、批处理和准入策略",
    "加速器与网络拓扑",
    "路由、重试和回退策略",
    "每个符号都代表一份版本化记录，而不是产品名称",
    "新的候选系统",
  ]) expect(flat).toContain(phrase);
});

test("latency accounting follows the complete critical path", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "T_{\\mathrm{e2e}}",
    "T_{\\mathrm{queue}}",
    "T_{\\mathrm{prefill}}",
    "T_{\\mathrm{decode},k}",
    "T_{\\mathrm{tools}}",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "预填充",
    "自回归解码",
    "常见情形，不是定律",
    "关键路径",
    "并行分支",
    "取最长分支的耗时，而不是相加",
    "首词元时间",
    "每输出词元时间",
    "端到端延迟",
    "p50、p95 和 p99",
    "拒绝和超时的比例",
    "拒绝最难处理的流量",
  ]) expect(flat).toContain(phrase);
});

test("engine mechanisms retain prerequisites costs and safety limits", () => {
  for (const phrase of [
    "迭代级调度",
    "分页式 KV 分配",
    "精确前缀复用",
    "精确相同的分词前缀",
    "量化对象",
    "投机解码",
    "语法约束输出",
    "只能保证语法，不能保证语义正确",
    "分块预填充",
    "预填充与解码分离",
    "KV 传输",
    "前缀复用不是语义缓存",
    "缺少高效内核",
    "准确的制品",
    "准确的硬件",
    "调用方授权",
    "转账请求在语法上有效，仍然需要授权",
  ]) expect(flat).toContain(phrase);
});

test("the benchmark fixes one production-shaped open-loop trace", () => {
  for (const phrase of [
    "符合生产形态的开环到达轨迹",
    "请求类别比例",
    "输入和输出长度分布",
    "前缀复用分布",
    "取消和突发流量",
    "到达时间遵循已经记录的计划",
    "慢系统会降低自己的输入负载",
    "冷缓存",
    "代表性的热缓存",
    "从空闲一直扫描到饱和",
    "一次只改变一种机制",
    "单因素消融",
    "工作进程丢失、网络延迟、取消和恢复",
    "完整线上服务系统的候选方案",
  ]) expect(flat).toContain(phrase);
});

test("joint eligibility publishes admission beside conditional latency", () => {
  const compact = chinese.replace(/\s+|&/g, "");
  for (const marker of [
    "H_j(c)=1",
    "Q_s(c)\\geq_s",
    "\\mathrm{TTFT}\\leF_s",
    "\\mathrm{TPOT}\\leD_s",
    "T_{\\mathrm{e2e}}\\leL_s",
    "\\ge\\alpha_s",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "所有硬约束",
    "联合达标率",
    "未知的硬约束证据不能通过",
    "可行集合",
    "准入率",
    "条件延迟",
  ]) expect(flat).toContain(phrase);
});

test("mediation is optional and earns an enforceable boundary", () => {
  for (const phrase of [
    "网关或中介服务是一种设计选择，不是必选层",
    "一个应用和一个供应商",
    "集中管理是否形成了团队真正能够执行和运营的边界",
    "先验证调用方和租户身份",
    "持有代理密钥还不够",
    "允许的候选集合",
    "原子地检查并预留预算",
    "原请求剩余的截止时间",
    "幂等键或只读保证",
    "结果不明",
    "一律拒绝请求",
    "管理控制平面",
    "请求数据平面",
    "短期、受众受限的凭据",
    "凭据引用",
  ]) expect(flat).toContain(phrase);
});

test("retry fallback and traces preserve action safety", () => {
  for (const phrase of [
    "传输重试安全不能单独证明应用副作用安全",
    "副作用账本",
    "不能盲目把同一动作交给另一个模型",
    "唯一的重试负责人",
    "嵌套重试会相乘，而不是相加",
    "同一部署上的传输重试",
    "供应商故障切换",
    "模型回退",
    "第一个字节",
    "可见的部分流失败",
    "身份验证、授权、无效输入",
    "低基数的运营事实",
    "普通遥测",
    "未采样的逻辑请求账本",
    "发票核对",
    "不能证明硬性预算上限",
  ]) expect(flat).toContain(phrase);
});

test("the route contract is illustrative and policy complete", () => {
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
  for (const marker of [
    "route_contract: support-summary-v3",
    "request_class: read_only_summary",
    "credential_ref: workload-identity://inference/support",
    "deadline_ms: 2500",
    "budget_reservation: required",
    "requires_same_contract: true",
    "record_content: false",
    "propagate_trace_context: true",
  ]) expect(chinese).toContain(marker);
  expect(flat).toContain("内部设计记录");
  expect(flat).toContain("同一个别名背后的不同模型不会自动成为合格回退");
});

test("capacity procurement compares three deployment modes", () => {
  for (const phrase of [
    "部署与采购是两个不同的决定",
    "第一方 API",
    "由供应商运营并承载指定制品的托管端点",
    "自主管理的引擎",
    "相同的硬约束、质量门、工作负载和核算期",
    "计费粒度和最低承诺",
    "容量保证",
    "冷启动和扩容延迟",
    "可中断容量",
    "区域、数据路径、存储层和出口费用",
    "补丁、发布、监控、事故响应和容量预测",
    "退出路径",
    "不存在通用的利用率百分比",
    "低、中、高需求情景",
    "每项合格任务的端到端成本",
  ]) expect(flat).toContain(phrase);
});

test("planning bounds are verified by load tests rather than treated as autoscaling", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "\\lambda_{\\mathrm{peak}}",
    "\\mathbb{E}[S]",
    "\\rho_{\\max}<1",
    "g_{\\min}",
    "\\lambda<\\mu_g",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "规划近似，不是自动伸缩公式",
    "动态批处理会让服务需求呈非线性",
    "不可拆分的整体",
    "必要条件不能保证 p95 或 p99 延迟",
    "显式增加余量和冗余",
    "供应商的分配单位",
    "合格任务、拒绝任务、质量通过率、SLO 达标率、计费空闲时间和总成本",
    "不能除以原始请求数或生成词元数",
  ]) expect(flat).toContain(phrase);
});

test("orchestration follows workload lifecycle and scheduling semantics", () => {
  for (const phrase of [
    "长期运行的服务",
    "健康与就绪检查",
    "滚动发布",
    "流量排空",
    "有限的分布式作业",
    "成组调度",
    "拓扑感知放置",
    "检查点与重启",
    "抢占、优先级和跨团队公平配额",
    "全有或全无的准入",
    "应用执行框架",
    "不能替代集群准入、设备分配或服务生命周期控制",
    "所需的生命周期和调度语义",
    "不能挽救当前的请求突发",
    "保持热容量或减少准入流量",
    "完整扩容路径",
  ]) expect(flat).toContain(phrase);
});

test("the operating workflow is complete and reversible", () => {
  for (const phrase of [
    "固定契约与工作负载",
    "固定一套基线",
    "验证行为",
    "负载测试与定容",
    "故障注入",
    "可逆发布",
    "保留证据记录",
    "`429` 和 `5xx`",
    "慢速流",
    "工作进程丢失",
    "预算耗尽",
    "结果不明的工具动作",
    "影子流量",
    "按请求类别和租户进行金丝雀发布",
    "重新评测触发条件",
    "作为假设进入这套流程",
    "更简单的基线",
  ]) expect(flat).toContain(phrase);
});

test("the lower-layer and contested boundaries stay conditional", () => {
  for (const phrase of [
    "服务经济性可以影响训练选择，但必须测量这条因果链",
    "合格结果的质量、预期规模、硬件和核算期",
    "不能只从参数量小推导出来",
    "直接连接供应商的适配器可以减少需要运营的组件",
    "中介层可以为许多调用方集中策略和证据",
    "第一方 API",
    "托管端点",
    "自主管理引擎",
    "不存在持久有效的产品默认选项",
    "版本化契约",
    "同一工作负载",
    "本章的方法就是它的验收测试",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete catalog and universal defaults", () => {
  for (const phrase of [
    "截至 2026 年年中",
    "玩家",
    "如何选引擎",
    "如何选网关",
    "稳妥默认",
    "选 vLLM",
    "选 SGLang",
    "选 OpenRouter",
    "agentgateway / Lux",
    "40 到 50%",
    "一个 base URL",
    "变得可互换",
    "改配置就能迁移流量",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toContain(":::: {.runnable}");
  expect(chinese).not.toContain("```python");
  expect(chinese).not.toContain("```bash");
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(10);
  expect(chinese.match(/^\| ---/gm)?.length).toBe(3);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
  expect(chinese).not.toContain("/figures/serving-and-compute-1.svg");
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
  for (const phrase of ["输入负载", "版本化线上系统", "观测边界", "准入、扩容或淘汰"])
    expect(blocks[0][1]).toContain(phrase);
  for (const phrase of ["应用内部契约", "可选中介边界", "版本化供应商适配器", "合格部署"])
    expect(blocks[1][1]).toContain(phrase);
  for (const phrase of ["固定契约与负载", "一致性与质量门", "故障注入", "生产证据与漂移触发条件"])
    expect(blocks[2][1]).toContain(phrase);
});

test("the complete Chinese chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/serving-and-compute.html",
    chapterTitle: "服务、网关与算力",
    chapterNum: "82",
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
  expect(html).toContain("只有端点返回文本，不等于模型已经得到可靠服务");
  expect(html).toContain("本章的方法就是它的验收测试");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
