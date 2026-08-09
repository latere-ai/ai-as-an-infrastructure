import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 79 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 数据权利与合规经济 \{#sec-data-rights-economics\}/);
  expect(headings(chinese)).toEqual([
    ["##", "先明确用途，再审查数据"],
    ["##", "把证据与决策分开"],
    ["##", "不同信号不能混为一谈"],
    ["##", "评估权利完备的数据选项，而不是词元堆"],
    ["##", "法院判决不会给出全球统一价格"],
    ["##", "合规可以打开市场"],
    ["##", "开源回答的是另一个问题"],
    ["##", "按发布版本持续维护权利账"],
    ["##", "争议所在"],
    ["##", "约束如何传导"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("rights readiness is a dated release decision rather than a property of bytes", () => {
  for (const phrase of [
    "技术上能够获取的数据，不代表在权利上已经可以使用",
    "缺少许可证也不自动等于某项法律结论",
    "数据快照",
    "拟议用途",
    "处理主体",
    "司法辖区",
    "模型或产品版本",
    "复核日期",
    "不是字节本身的属性",
    "不构成法律意见",
    "合格法律顾问",
  ]) expect(flat).toContain(phrase);
});

test("the use statement and admission gate bind every relevant dimension", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "\\operatorname{Admit}(a,u,j,r,t)",
    "P(a)",
    "B(a,u,j,t)",
    "O(a,u,j,t)",
    "C(a,u,j,r,t)",
    "E(a,u,j,r,t)",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "预训练、微调、评测、检索、输出展示、再分发、日志与反馈",
    "合成资产和衍生资产",
    "具体用途声明",
    "来源和血缘信息",
    "法律依据、许可或例外",
    "相关义务、权利保留和合同条款",
    "所需技术控制",
    "当前发布证据",
    "组织内部的发布准入规则，不是通用法律测试",
    "拒绝、隔离或转交复核",
  ]) expect(flat).toContain(phrase);
});

test("the ledger keeps facts law policy controls and evidence separate", () => {
  for (const phrase of [
    "来源事实",
    "法律判断",
    "组织政策",
    "技术控制",
    "发布证据",
    "来源只能说明资产来自哪里，不能证明已经获得许可",
    "政策可以比法律更严格，但不会因此变成法律",
    "风险接受人",
    "语料清单",
    "到期日期",
    "许可证标签可能有误",
    "法律判断只有经过测试的控制落实到语料、索引、模型工作流和发布流程中，才真正可执行",
  ]) expect(flat).toContain(phrase);
});

test("web signals and legal instruments remain distinct", () => {
  for (const phrase of [
    "许可证、服务条款、版权权利保留、隐私同意和访问控制回答的是不同问题",
    "Robots 排除协议",
    "不是访问授权，也不能替代安全措施",
    "观察到的信号",
    "所有权证明、隐私同意或完整的法律判断",
    "欧盟《数字单一市场版权指令》第 4 条",
    "机器可读权利保留",
    "世界范围内的禁止",
    "不能互相替代",
  ]) expect(flat).toContain(phrase);
});

test("the two evidence audits preserve their measured scope", () => {
  for (const phrase of [
    "实际为 1,858 个",
    "44 个常用的对齐微调数据集合",
    "超过 70% 的许可证字段没有填写",
    "人工复核的一致率只有 35% 至 54%",
    "错误率超过 50%",
    "选定数据集元数据",
    "14,000 个网站域名",
    "约 45% 的 C4 词元",
    "如果这些限制得到遵守或执行",
    "没有限制并不代表已经同意",
    "观察到的信号不是法律结论",
  ]) expect(flat).toContain(phrase);
});

test("rights economics prices an option against one feasible baseline", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "NB_H(D)",
    "\\DeltaV_H(D)",
    "C_{\\mathrm{license}}(D)",
    "C_{\\mathrm{clear}}(D)",
    "C_{\\mathrm{control}}(D)",
    "C_{\\mathrm{evidence}}(D)",
    "C_{\\mathrm{monitor}}(D)",
    "\\mathbb{E}[\\DeltaL_H(D)]",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "最佳可行基线",
    "同一种货币和同一个核算期",
    "摊销共享成本",
    "市场准入收益既算作收入，又算作避免损失",
    "不能让步的隐私、安全和法律限制",
    "许可证费用不是数据集的内在价值，也不是每词元价格",
    "内容、访问方式、许可用途、服务、排他性、期限、保证和议价能力",
  ]) expect(flat).toContain(phrase);
});

test("the net-benefit equation stays mobile safe and every term is explained", () => {
  const equation = chinese.match(/NB_H\(D\)[\s\S]*?\\end\{aligned\}/)?.[0] ?? "";
  const rows = equation.split(/\\\\\s*\n/);
  expect(rows.length).toBeGreaterThanOrEqual(7);
  for (const row of rows) expect(row.replace(/\s+/g, " ").length).toBeLessThanOrEqual(52);
  for (const phrase of [
    "产品价值、模型表现、交付速度",
    "采购与版税成本",
    "法律与运营审查成本",
    "生成可供复核的记录",
    "续约与变化监测",
    "法律、合同、隐私、补救和声誉损失",
  ]) expect(flat).toContain(phrase);
});

test("the Reddit filing is a bounded contract bundle rather than a unit price", () => {
  for (const phrase of [
    "2.03 亿美元",
    "两年至三年",
    "6,640 万美元",
    "几乎全部合同价值来自同一家合作方",
    "文件没有披露其名称",
    "不是单位价格、Google 专属价格",
    "不能证明每个语料库都有相近价值",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("每年 6000 万美元");
  expect(flat).not.toContain("五年约 2.5 亿美元");
});

test("US court outcomes stay scoped to record posture and jurisdiction", () => {
  for (const phrase of [
    "加利福尼亚北区联邦地区法院",
    "针对具体案卷事实的地区法院裁定，而不是全国性规则",
    "永久通用图书馆",
    "留待审判",
    "没有提出有意义的市场损害证据",
    "诉讼程序阶段",
    "不能为其他模型、媒介、输出或案卷建立通用规则",
    "只要合法取得材料，训练就一定构成合理使用",
    "2026 年 7 月 20 日",
    "15 亿美元",
    "482,460 部列明作品",
    "不许可未来行为，也不免除输出相关主张",
    "和解不是判例",
    "不是经过裁判确定的训练价格",
  ]) expect(flat).toContain(phrase);
});

test("current EU obligations roles and dates remain precise", () => {
  for (const phrase of [
    "通用人工智能模型",
    "《人工智能法》第 53 条",
    "技术文档",
    "下游提供商",
    "版权政策与合规流程",
    "公开训练内容摘要",
    "2025 年 8 月 2 日",
    "2026 年 8 月 2 日",
    "2027 年 8 月 2 日",
    "自愿性合规工具，不是法律本身",
    "系统性风险",
    "欧盟条例 2026/1744",
    "没有推迟 GPAI 相关日期",
    "文档本身不能保证合规",
  ]) expect(flat).toContain(phrase);
});

test("open source answers modification freedom not rights compliance", () => {
  for (const phrase of [
    "使用、研究、修改和分享",
    "数据信息",
    "构建实质等效的系统",
    "不一定要求公开训练数据集本身",
    "仅有权重不符合这一定义",
    "不能据此判断数据获取与处理是否符合版权、合同、隐私或行业义务",
    "开放性、可复现性和权利完备性彼此重叠，却不能互相证明",
  ]) expect(flat).toContain(phrase);
});

test("the release ledger covers identity decision scope obligations and enforcement", () => {
  for (const phrase of [
    "不要保存一个全局的 `usable = true`",
    "允许、拒绝或复核",
    "资产、用途、产品、地区、客户类别和时间",
    "身份",
    "决定",
    "范围",
    "义务",
    "执行",
    "预训练、微调、评测、检索、展示、再分发、日志、反馈",
    "地域、期限、署名、付款、相同方式共享、再分发、保证、赔偿、审计、保留、删除和终止",
    "删除传播",
    "来源条款变化",
    "合同到期",
    "新的用途、模型、发布版本或市场",
    "供应商变化改变处理链",
  ]) expect(flat).toContain(phrase);
});

test("deletion and review triggers remain scoped operations", () => {
  for (const phrase of [
    "重新执行准入判断",
    "权利保留信号出现",
    "收到删除或撤回请求",
    "删除源记录",
    "从未来语料和检索索引中移除",
    "修复已经训练的模型",
    "是三种不同的操作",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary states both access tradeoffs", () => {
  for (const phrase of [
    "更严格的访问限制可以改善付费、来源记录和创作者控制",
    "提高进入壁垒",
    "有能力支付大额交易的企业",
    "更宽泛的例外可以支持研究、竞争和新产品",
    "创作者和下游购买方承担更多不确定性",
    "哪些权利适用",
    "谁有权授予这些权利",
    "谁承担审查与执行成本",
    "如何分配市场力量",
  ]) expect(flat).toContain(phrase);
});

test("the constraint handoff treats rights evidence as deployable capability", () => {
  for (const phrase of [
    "采集与质量控制",
    "来源、隐私、保留和删除机制",
    "法律判断",
    "决定哪些产品和地区可以进入",
    "权利证据是可部署能力的一部分",
    "不是模型建成后才附加的元数据",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  expect(chinese).toContain("fig-data-rights-ledger");
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(4);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese).not.toContain("data-rights-economics-1.svg");
  expect(chinese).not.toContain("从原始网页数据到生产可用数据的漏斗示意");
  expect(chinese).not.toContain("—");
});

test("the localized rights ledger parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
  for (const label of [
    "来源事实",
    "具体用途",
    "法律与政策判断",
    "技术控制",
    "发布证据",
  ]) expect(blocks[0][1]).toContain(label);
});

test("the complete Chinese chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/data-rights-economics.html",
    chapterTitle: "数据权利与合规经济",
    chapterNum: "79",
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
  expect(html).toContain("技术上能够获取的数据，不代表在权利上已经可以使用");
  expect(html.match(/<figure/g)?.length).toBe(1);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
