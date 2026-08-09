import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/orchestration/08-rag-retrieval.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/orchestration/08-rag-retrieval.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 2 | 3): string[] {
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

function fenceCount(source: string, opening: string): number {
  return [...source.matchAll(new RegExp(`^${opening}$`, "gm"))].length;
}

test("Chapter 44 preserves the complete English retrieval contract", () => {
  expect(headings(chapter, 2)).toEqual([
    "从证据契约开始",
    "摄取必须保留语义并支持删除",
    "候选生成使用互补信号",
    "重排无法补回缺失的候选",
    "授权约束每一条候选路径",
    "单次检索只是一种策略",
    "检索文本是不可信数据",
    "长上下文改变边界，不改变契约",
    "争议所在",
    "下层约束",
    "评估必须定位故障发生在哪一层",
    "一份生产检索流程",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "稀疏检索保留词法证据",
    "稠密检索学习相似度函数",
    "近似搜索是一种实证取舍",
    "混合检索需要稳定融合",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(fenceCount(chapter, "```text")).toBe(2);
  expect(fenceCount(chapter, "```python")).toBe(2);
  expect(fenceCount(chapter, "```\\{dot\\}")).toBe(1);
  expect(fenceCount(chapter, "```\\{=html\\}")).toBe(1);
  expect(chapter.match(/\.runnable/g)?.length).toBe(1);
});

test("the opening defines RAG as an evidence supply chain with abstention", () => {
  for (const phrase of [
    "实时、可查询的语料库",
    "证据供应链",
    "当前、私有或专业领域的证据",
    "说明证据来自哪里",
    "检索不能保证答案为真",
    "从未进入索引的来源",
    "从未进入上下文的证据",
    "明确选择不作答",
  ]) expect(flat).toContain(phrase);
});

test("the evidence contract binds identity versions permissions and budgets", () => {
  for (const phrase of [
    "经得起解析、重新嵌入、权限变更、引用和删除",
    "稳定关联到支持它的确切材料",
    "稳定的文档身份",
    "确切证据",
    "把授权与同一份材料绑定",
    "使检索结果可以复现",
    "离线路径",
    "在线路径",
    "带版本的索引快照",
  ]) expect(flat).toContain(phrase);
  for (const field of [
    "IndexedChunk",
    "RetrievalRequest",
    "Candidate",
    "ClaimSource",
    "authenticated_principal",
    "freshness_bound",
    "candidate_budget",
    "retrieval_request_id",
  ]) expect(chapter).toContain(field);
});

test("ingestion preserves source meaning updates and deletion", () => {
  for (const phrase of [
    "解析是第一次检索决策",
    "原始来源、解析器输出、解析器版本和来源偏移",
    "不存在通用的分块长度",
    "语义边界",
    "完整支持片段",
    "派生数据",
    "幂等写入",
    "删除标记",
    "文档删除或访问权撤销后",
    "必须立即阻止读取",
    "嵌入模型变更属于模式迁移",
    "不兼容模型产生的查询向量和文档向量绝不能比较",
  ]) expect(flat).toContain(phrase);
});

test("candidate generation keeps sparse and dense signals complementary", () => {
  for (const phrase of [
    "足够宽且足够便宜",
    "稀疏检索和稠密检索提供不同信号",
    "BM25 是很强的零样本基线",
    "领域迁移、查询类型、语言和语料结构",
    "词法检索并不等于精确字符串匹配",
    "标识符、产品代码、错误消息、名称和引用短语",
    "改写类查询和概念类查询",
  ]) expect(flat).toContain(phrase);
});

test("dense retrieval and approximate search keep their empirical limits", () => {
  for (const phrase of [
    "查询和每个分块映射到同一个向量空间",
    "只有两个向量都归一化为单位长度时",
    "并不证明稠密检索优于稀疏检索",
    "精确向量搜索",
    "近似最近邻搜索",
    "分层可导航小世界图",
    "不提供通用的逐查询召回下界",
    "先测量 ANN 相对精确向量搜索的邻居召回率",
    "持久化、复制、元数据过滤、删除、压缩和一致性",
  ]) expect(flat).toContain(phrase);
});

test("fusion reranking packing and citations preserve evidence", () => {
  for (const phrase of [
    "倒数排名融合",
    "不假定两套系统的分数使用同一尺度",
    "稳定的文档身份",
    "每一条参与融合的排名",
    "所有截断输入列表都漏掉",
    "候选召回上限",
    "候选深度是一项需要测量的预算",
    "相关不等于充分",
    "引用精确率",
    "引用召回率",
    "相互矛盾的权威片段",
  ]) expect(flat).toContain(phrase);
});

test("authorization constrains every search path and fails closed", () => {
  for (const phrase of [
    "授权不是排序特征，也不是清理阶段",
    "检索子查询都继承",
    "文本、分数或标识符离开候选生成阶段之前",
    "服务器构造的前置过滤条件",
    "物理隔离的索引",
    "不是安全边界",
    "权限判断必须默认拒绝",
    "检索质量应以授权范围内的标准证据评估",
    "一条短的同步路径",
    "完整的异步清理路径",
    "派生数据继承的授权策略",
    "缓存键",
  ]) expect(flat).toContain(phrase);
});

test("adaptive and graph retrieval remain bounded policies", () => {
  for (const phrase of [
    "单次检索适用于",
    "查询分解",
    "停止条件、最大轮数、扇出上限",
    "证据不足这一终止状态",
    "查询改写是否偏离用户请求",
    "图式检索处理的是另一类工作负载",
    "每个节点、边和摘要",
    "与单次检索基线比较",
    "算力匹配的预算",
    "分别属于不同的干预",
  ]) expect(flat).toContain(phrase);
});

test("retrieved text stays outside authority and carries provenance", () => {
  for (const phrase of [
    "检索材料是不可信数据，不是指令",
    "不能授予工具权限",
    "扩大语料范围",
    "语料投毒",
    "间接提示注入",
    "只做相关性过滤",
    "发布者、作者、来源类型、签名或采集路径",
    "但不能扩大授权",
    "把引用数据与控制指令分开",
  ]) expect(flat).toContain(phrase);
});

test("long context changes the frontier without erasing the contract", () => {
  for (const phrase of [
    "最佳的质量、时效、延迟和单次查询成本",
    "相关证据位于长输入中间时",
    "警示，不是对架构的普遍排序",
    "长上下文基线",
    "直接上下文",
    "语料超过窗口、频繁变化",
    "检索花费服务资源，是为了节省更多服务资源",
    "完整的质量、成本与延迟边界",
  ]) expect(flat).toContain(phrase);
});

test("evaluation localizes failure at every pipeline boundary", () => {
  for (const phrase of [
    "无法说明是来源缺失、解析破坏了内容、检索漏掉了证据",
    "固定一份测试契约",
    "可回答和不可回答的查询",
    "完整的相关性判断",
    "只有一个已知片段时，应报告命中率",
    "应在流水线边界分别测量",
    "无检索基线",
    "理想上下文基线",
    "自助法置信区间",
    "注入运行故障",
    "预期响应也是测试契约的一部分",
  ]) expect(flat).toContain(phrase);
});

test("the production loop preserves provenance retention and memory boundaries", () => {
  for (const phrase of [
    "authenticate(request)",
    "pin_index(request.freshness_bound)",
    "verify_versions_and_acl",
    "evidence_is_sufficient",
    "generate_from_untrusted_evidence",
    "verify_claim_sources_or_abstain",
    "保留期限契约",
    "跟踪记录、对话、供应商日志、提示缓存、评估或响应缓存",
    "不会自动成为持久记忆",
    "单独且经过授权的写入",
    "表示空间如何训练、评估、压缩和迁移",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("@sec-embeddings");
});

test("the rewrite removes obsolete certainty and vendor-specific narrative", () => {
  for (const phrase of [
    "知识在权重之内，还是在权重之外",
    "难点全在检索",
    "搜索必须是亚线性的",
    "近似最近邻索引用一个很小、有界的召回损失",
    "给出对数级的查询时间",
    "精确最近邻是对的，但太慢",
    "这份成本通常是值得的",
    "头十几个被重排的候选承载了大部分增益",
    "Microsoft 已经替使用者选好了一边",
    "大部分生产流量并不需要",
    "需要它的那一小部分，则获益巨大",
    "漏斗仍是唯一的入口",
    "自信幻觉的主要防线",
    "—",
  ]) expect(chapter).not.toContain(phrase);
});

test("the runtime diagram and RRF visualization are localized", () => {
  for (const phrase of [
    'source [label="来源 + ACL"]',
    'ingest [label="解析、分块、\\n记录版本"]',
    'request [label="经过身份认证的\\n请求"]',
    'scope [label="已授权范围"]',
    'answer [label="回答、引用或不作答"]',
    'data-viz="rrf-fusion" data-lang="zh"',
    "对稠密排名和稀疏排名进行倒数排名融合的示意图",
    "两个列表都没有的文档仍不会出现",
  ]) expect(chapter).toContain(phrase);
});
