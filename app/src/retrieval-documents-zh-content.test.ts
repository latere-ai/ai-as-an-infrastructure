import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/practice/06-retrieval-and-documents.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/practice/06-retrieval-and-documents.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string): string[] {
  return [...source.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(
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

test("Chinese Chapter 86 preserves the complete English structure", () => {
  expect(headings(chinese)).toEqual([
    "# 检索与文档智能 {#sec-retrieval-practice}",
    "## 保留证据谱系",
    "### 以发布流程管理数据摄取",
    "## 测量文档理解质量",
    "### 结构化抽取有两类有效性",
    "### 视觉检索是一种需要评估的替代方案",
    "## 按检索和引用需求切分文档",
    "## 对在线查询先授权",
    "## 根据实测效果选择表示方式",
    "### 固定嵌入兼容性契约",
    "### 融合排名，但不要假装分数可比",
    "## 发布新一代索引",
    "### 新鲜度与删除必须覆盖每一份副本",
    "## 返回证据，而不是没有来源的文本",
    "### 检索到的文档不受信任",
    "## 按层级和故障模式评估",
    "## 运营发布生命周期",
    "## 约束如何传导",
    "## 争议所在",
    "## 延伸阅读",
  ]);
  expect(headings(chinese).length).toBe(headings(english).length);
  expect(references(chinese)).toEqual(references(english));
});

test("the opening defines a retrieval release and its operating contract", () => {
  for (const phrase of [
    "检索不是附加在模型上的数据库功能",
    "证据服务",
    "检索发布",
    "带版本的语料库",
    "经过测试的查询路径",
    "语料边界",
    "查询类型",
    "成功证据",
    "新鲜度与删除服务等级",
    "回滚窗口",
  ]) expect(flat).toContain(phrase);
});

test("every derived representation remains linked to immutable source evidence", () => {
  for (const phrase of [
    "源对象",
    "内容摘要",
    "源修订版本",
    "渲染版本",
    "文档元素",
    "分块 ID",
    "精确的源位置",
    "嵌入模型",
    "索引快照",
    "来源链",
    "原始证据与规范化检索文本分开保存",
  ]) expect(flat).toContain(phrase);
});

test("ingestion is an authorized and atomic publication process", () => {
  for (const phrase of [
    "获取并授权",
    "恶意软件",
    "拒绝或隔离",
    "规范化并渲染",
    "版面分析",
    "表格和公式识别",
    "抽取并验证",
    "切分并生成嵌入",
    "暂存、核对并发布",
    "以原子方式发布完整世代",
    "重试必须具备幂等性",
  ]) expect(flat).toContain(phrase);
});

test("OCR VLM and document operations are defined locally", () => {
  for (const phrase of [
    "@gls-ocr，也就是光学字符识别，从像素中识别文字",
    "@gls-vlm，也就是视觉语言模型，同时读取页面图像和文本",
    "数字文本层",
    "恢复阅读顺序",
    "重建表格",
    "识别公式",
    "映射坐标",
    "原生数字文档的文本抽取",
  ]) expect(flat).toContain(phrase);
});

test("document evaluation keeps transcription structure and strata separate", () => {
  for (const marker of ["\\mathrm{CER}", "S_c+D_c+I_c", "N_c"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "文档分层",
    "字符错误率",
    "元素检测的精确率与召回率",
    "阅读顺序错误",
    "表格结构相似度",
    "公式识别",
    "字段级精确率与召回率",
    "人工复核",
  ]) expect(flat).toContain(phrase);
});

test("schema validity stays separate from semantic correctness", () => {
  for (const phrase of [
    "JSON Schema",
    "结构和类型符合 Schema",
    "在语义上正确",
    "总金额仍可能是错的",
    "证据定位信息",
    "明确的 `unknown` 状态",
    "选择不作答",
    "领域后置条件",
  ]) expect(flat).toContain(phrase);
});

test("visual retrieval remains a measured alternative", () => {
  for (const phrase of [
    "视觉检索",
    "页面图像",
    "后期交互",
    "文本检索",
    "多模态组合",
    "可访问性",
    "同一组带标注查询",
    "稳定的页面标识",
  ]) expect(flat).toContain(phrase);
});

test("segmentation preserves retrieval citation and authorization boundaries", () => {
  for (const phrase of [
    "检索单元",
    "引用单元",
    "父元素",
    "源修订版本与源位置",
    "标题路径",
    "分块大小不存在通用常量",
    "边界与重叠策略",
    "重复结果",
    "不能跨越授权或保留边界",
  ]) expect(flat).toContain(phrase);
});

test("the online path authorizes before candidate generation", () => {
  for (const phrase of [
    "查询契约",
    "经过验证的主体和租户",
    "授权必须发生在候选生成之前",
    "当前资源状态",
    "授权集合",
    "策略元数据缺失或无效时必须关闭访问",
    "错误租户",
  ]) expect(flat).toContain(phrase);
  for (const marker of ["U(q,s,t,g)", "\\begin{gathered}", "\\neg c.\\mathrm{tombstone}"])
    expect(chinese).toContain(marker);
});

test("retrieval families retain their distinct representations and costs", () => {
  for (const phrase of [
    "稀疏检索",
    "BM25",
    "词法基线",
    "稠密检索",
    "双编码器",
    "离线预计算",
    "后期交互",
    "ColBERT",
    "交叉编码器",
    "查询与文档对",
    "受限的候选并集",
  ]) expect(flat).toContain(phrase);
});

test("embedding compatibility is explicit and versioned", () => {
  for (const phrase of [
    "模型和分词器摘要",
    "嵌入维度",
    "归一化",
    "距离度量",
    "查询前缀",
    "文档前缀",
    "余弦相似度、内积和欧氏距离",
    "同一个嵌入空间修订版本",
    "重新生成嵌入",
    "以原子方式切换查询编码器和索引",
  ]) expect(flat).toContain(phrase);
});

test("RRF is self-contained and does not pretend unlike scores agree", () => {
  for (const marker of ["s_{\\mathrm{rrf}}", "r_j(d)", "\\mathcal{L}", "k_0"])
    expect(chinese).toContain(marker);
  for (const phrase of [
    "排名列表",
    "从 1 开始计算的名次",
    "没有返回某个候选项",
    "融合常数",
    "不会校准相关性分数",
    "确定性的并列处理规则",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/```python/g)?.length).toBe(1);
});

test("reranking and context selection remain separate", () => {
  for (const phrase of [
    "候选深度",
    "重排深度",
    "最终 top-k",
    "上下文预算",
    "延迟预算",
    "最大边际相关性",
    "相关性与多样性之间做权衡",
    "不能保证去重",
  ]) expect(flat).toContain(phrase);
});

test("an index generation is measurable migratable and reversible", () => {
  for (const phrase of [
    "索引契约",
    "语料水位",
    "元数据 Schema",
    "过滤选择率",
    "精确检索基线",
    "ANN 召回率",
    "HNSW",
    "DiskANN",
    "影子索引",
    "双读",
    "原子路由切换",
    "上一已知正常世代",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
});

test("freshness and deletion propagate to every serving copy", () => {
  for (const phrase of [
    "新鲜度 SLA",
    "删除 SLA",
    "墓碑标记",
    "向量索引",
    "词法索引",
    "重排器和答案缓存",
    "已发布快照",
    "迁移中的每个世代",
    "陈旧结果",
    "已删除文档不能从缓存、旧快照或影子索引重新出现",
  ]) expect(flat).toContain(phrase);
});

test("answers bind claims to authorized evidence", () => {
  for (const phrase of [
    "证据包",
    "不可变的证据 ID",
    "阶段排名",
    "把不同类型的分数保留为不同类型",
    "每项重要结论",
    "引用精确率",
    "引用召回率",
    "蕴含或矛盾",
    "生成的引用",
    "重新授权",
  ]) expect(flat).toContain(phrase);
});

test("retrieved documents stay untrusted and cannot widen authority", () => {
  for (const phrase of [
    "不受信任的数据",
    "间接提示注入",
    "不能授予权限",
    "变成工具指令",
    "更改租户",
    "关闭引用",
    "要求数据外泄",
    "受污染的语料库",
    "干净的回滚世代",
    "检索文本本身没有任何权限",
  ]) expect(flat).toContain(phrase);
});

test("evaluation localizes each layer and its failures", () => {
  for (const phrase of [
    "每一层都保留一个理想基准",
    "解析质量",
    "Recall@k",
    "nDCG@k",
    "MRR",
    "答案正确性",
    "忠实度",
    "拒答校准",
    "p95 延迟",
    "每个合格答案的成本",
    "文档族划分",
  ]) expect(flat).toContain(phrase);
});

test("the acceptance suite covers negative cases and safe degradation", () => {
  for (const phrase of [
    "错误租户",
    "已删除文档",
    "陈旧修订版本",
    "受污染分块",
    "格式错误的表格",
    "空检索结果",
    "重复分块",
    "索引故障",
    "无答案行为",
    "降级策略",
    "不得削弱授权或捏造证据",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle produces a requalifiable release record", () => {
  for (const phrase of [
    "固定契约",
    "构建带标注语料库",
    "建立词法基线",
    "评估候选方案",
    "构建并核对",
    "影子运行",
    "金丝雀发布",
    "晋升或回滚",
    "监控漂移",
    "重新验证",
    "重新验证触发条件",
    "检索发布记录",
  ]) expect(flat).toContain(phrase);
});

test("constraints and contested choices remain conditional", () => {
  for (const phrase of [
    "缺失的证据无法由重排器找回",
    "未经授权的证据无法靠提示词变得安全",
    "智能体会放大检索调用次数",
    "先争论产品",
    "代表性语料库",
    "精确检索基线",
    "不存在站得住脚的通用分块大小",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the obsolete catalog and universal defaults", () => {
  for (const phrase of [
    "截至 2026 年中",
    "选择解析器",
    "向量库、嵌入、重排、混合检索",
    "2026 年的共识",
    "一个合理的默认",
    "一手来源",
    "最高 ROI",
    "Qdrant",
    "Pinecone",
    "Weaviate",
    "Milvus",
    "Chroma",
  ]) expect(chinese).not.toContain(phrase);
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$$/gm)?.length).toBe(6);
  expect(chinese.match(/^\|---/gm)?.length).toBe(2);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-note\}/g)?.length).toBe(1);
  expect(chinese).not.toContain(":::: {.runnable}");
  expect(chinese).not.toContain("<figure");
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
      "practice/retrieval-and-documents.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["稀疏", "稠密", "视觉"])
    expect(svgs[2], `query diagram should show ${label}`).toContain(`>${label}<`);
});

test("the complete Chinese chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/retrieval-and-documents.html",
    chapterTitle: "检索与文档智能",
    chapterNum: "86",
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
  expect(html).toContain("最终产物是一份检索发布记录");
  expect(renderedHeadings.some(({ text }) => text.includes("s_{"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
