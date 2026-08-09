import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/practice/04-training-finetuning-practice.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/practice/04-training-finetuning-practice.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 84 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 训练与微调实践 \{#sec-training-practice\}/);
  expect(headings(chinese)).toEqual([
    ["##", "固定适配契约"],
    ["##", "判断行为是否应该写入权重"],
    ["##", "构建经得起审查的数据"],
    ["###", "按可能泄漏的单位划分数据集"],
    ["###", "把格式视为制品的一部分"],
    ["###", "测量记忆，而不是假定隐私"],
    ["##", "选择满足契约的最小权重改动"],
    ["##", "启动前估算训练规模"],
    ["###", "核算整个项目，而不只是 GPU 时间"],
    ["##", "按能力选择工具"],
    ["##", "让训练过程可复现"],
    ["##", "评估行为变化，而不是损失曲线"],
    ["##", "打包并部署完整制品"],
    ["###", "强化学习会在训练内部引入一套服务系统"],
    ["##", "运营适配生命周期"],
    ["##", "下层约束"],
    ["##", "争议所在"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the opening defines an adaptation release rather than a training job", () => {
  for (const phrase of [
    "改变权重不是定制模型的第一步",
    "训练任务完成也不等于工作结束",
    "可测量的行为变化必须写入权重",
    "复现、评估、服务、监控和回滚",
    "适配发布",
    "适配契约、固定基线、受治理的数据集、训练运行、评估报告和带版本的模型制品",
    "产品团队可以执行的运营流程",
  ]) expect(flat).toContain(phrase);
});

test("the adaptation contract makes success and non-regression reviewable", () => {
  for (const phrase of [
    "先写清楚必须改变什么、绝不能改变什么",
    "适配契约",
    "任务边界",
    "目标行为",
    "固定基线",
    "不得退化的要求",
    "数据边界",
    "部署目标",
    "预算上限",
    "晋升门",
    "回滚",
    "下降的损失曲线",
    "用户看到的完整路径",
  ]) expect(flat).toContain(phrase);
});

test("the train-or-not gate compares cheaper controls on the same evidence", () => {
  for (const phrase of [
    "同一套评估集",
    "这是决定是否训练的关口",
    "变化的事实和需要来源支撑的回答放进检索系统",
    "工具 Schema、语法约束、验证器或结构化解码器",
    "提示词或应用代码",
    "当前状态或外部副作用",
    "高频且长期稳定的行为",
    "必须写入权重",
    "不能因为手里有示例就直接训练",
    "数据库、授权检查或确定性解析器",
  ]) expect(flat).toContain(phrase);
});

test("training objectives follow the supervision that actually exists", () => {
  for (const phrase of [
    "正确的示范数据",
    "监督微调",
    "优选和落选答案",
    "直接偏好优化",
    "奖励可能被钻空子",
    "继续预训练",
    "领域分布、词汇或模态",
    "蒸馏",
    "教师模型",
    "学生模型",
    "上下文、检索或工具已经满足契约",
    "不改权重",
  ]) expect(flat).toContain(phrase);
});

test("the data pipeline preserves rights lineage and split integrity", () => {
  for (const phrase of [
    "训练样本不只是一段文本",
    "数据来源记录",
    "稳定的来源 ID",
    "许可证或其他法律依据",
    "同意限制",
    "敏感等级",
    "删除机制",
    "个人身份信息、凭据、客户机密和受版权保护的材料",
    "数据集清单",
    "来源被撤回",
    "派生样本、数据集版本、训练运行和制品",
  ]) expect(flat).toContain(phrase);
});

test("split quarantine follows the unit that can leak", () => {
  for (const phrase of [
    "随机拆分数据行通常并不正确",
    "分组单位",
    "客户、对话、文档、代码仓库、事故、作者或时间窗口",
    "训练集、开发集或测试集",
    "跨数据划分去重",
    "污染报告",
    "测试集隔离",
    "训练代码不得读取",
    "只能在运行清单中保存测试集摘要和访问策略",
  ]) expect(flat).toContain(phrase);
});

test("formatting and masked SFT are part of the artifact", () => {
  for (const marker of [
    "\\mathcal{L}_{\\mathrm{SFT}}",
    "$N$",
    "$\\theta$",
    "m_{i,t}",
    "p_{\\theta}",
    "x_i",
    "y_{i,<t}",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "训练和服务必须采用完全相同的分词器和对话模板",
    "角色顺序",
    "工具调用序列化",
    "损失掩码",
    "只对助手输出计算损失",
    "参与计算的词元数",
    "固定样本为格式化器编写单元测试",
    "模板变化既是数据变化，也是服务接口变化",
  ]) expect(flat).toContain(phrase);
});

test("memorization is measured instead of turning local data into a privacy claim", () => {
  for (const phrase of [
    "少量、重复或敏感的数据",
    "暴露罕见字符串",
    "扫描密钥和完全重复项",
    "留出的金丝雀样本",
    "敏感片段是否能够复现",
    "普通损失和准确率无法揭示意外记忆",
    "不能证明隐私",
    "发布门",
  ]) expect(flat).toContain(phrase);
});

test("parameter scope is an empirical choice without invented thresholds", () => {
  for (const marker of [
    "\\Delta W = BA",
    "r(d_{\\mathrm{in}} + d_{\\mathrm{out}})",
  ]) expect(chinese).toContain(marker);
  for (const phrase of [
    "目标函数决定模型从什么信号中学习",
    "参数范围决定模型有多少部分可以变化",
    "适配器秩",
    "目标模块",
    "冻结的量化基座",
    "全量微调",
    "实证比较",
    "最小可行试验",
    "没有给出适用于所有任务的样本数量门槛",
  ]) expect(flat).toContain(phrase);
});

test("run sizing covers memory recovery and the complete program cost", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "M_{\\mathrm{peak}}",
    "M_{\\mathrm{params}}",
    "M_{\\mathrm{grads}}",
    "M_{\\mathrm{opt}}",
    "M_{\\mathrm{acts}}",
    "M_{\\mathrm{workspace}}",
    "M_{\\mathrm{local}}",
    "n_{\\mathrm{shard}}",
    "C_{\\mathrm{adapt}}",
    "V^*",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "检查点大小不等于训练所需内存",
    "激活检查点",
    "规划下界，不是保证",
    "保存检查点、中断并恢复的测试",
    "数据准备和审查、训练算力、评估、工程时间和部署工作",
    "等价的质量和运营要求",
    "每百万合格词元",
    "没有有意义的盈亏平衡点",
  ]) expect(flat).toContain(phrase);
});

test("tools are selected by capability instead of volatile rankings", () => {
  for (const phrase of [
    "框架名称不是架构",
    "能力矩阵",
    "官方支持矩阵",
    "检查点可移植性",
    "可导出性",
    "数据驻留",
    "抢占",
    "恢复测试",
    "不能根据 GitHub 星标、供应商价格快照或某个工具永远最快的说法来选型",
    "目标运行时",
    "供应商退出方案",
  ]) expect(flat).toContain(phrase);
});

test("the run manifest binds data code model and environment", () => {
  for (const phrase of [
    "运行清单",
    "代码修订版本",
    "容器摘要",
    "基座检查点摘要",
    "分词器修订版本",
    "数据集清单",
    "划分规则",
    "随机种子",
    "优化器",
    "学习率调度器",
    "检查点间隔",
    "解析所有占位符",
    "记录应用默认值并叠加环境变量后真正生效的配置",
    "以原子方式保存最后一个完整检查点",
    "声明的统计容差",
  ]) expect(flat).toContain(phrase);
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
});

test("promotion evaluates behavior change rather than trusting training loss", () => {
  for (const phrase of [
    "训练损失不是发布指标",
    "目标任务质量",
    "能力保留",
    "安全与策略",
    "隐私与记忆",
    "运营表现",
    "配对提示词",
    "配对差异、置信区间、样本数量和失败案例",
    "训练方差",
    "评估抽样不确定性",
    "失败预算",
    "向评审人员隐藏模型身份",
  ]) expect(flat).toContain(phrase);
});

test("the released artifact is complete comparable and reversible", () => {
  for (const phrase of [
    "发布包不只有 `adapter.safetensors`",
    "基座模型摘要",
    "适配器摘要",
    "分词器文件和修订版本",
    "提示词模板、工具 Schema 和生成默认值",
    "运行清单、数据集清单、代码与容器摘要和训练日志",
    "兼容的服务运行时、精度、硬件类别和回滚说明",
    "合并一致性",
    "固定提示词",
    "金丝雀群组",
    "上一已知正常版本",
    "每次推理的完整溯源信息",
    "分阶段发布不能放宽离线晋升门",
  ]) expect(flat).toContain(phrase);
});

test("RL wiring accounts for rollout generation and policy freshness", () => {
  for (const phrase of [
    "轨迹生成器",
    "训练工作进程",
    "权重版本",
    "策略陈旧度",
    "共置拓扑",
    "分离拓扑",
    "内存争用",
    "增加数据传输和调度开销，也更难保证轨迹足够新",
    "策略、奖励、分词器、环境和采样版本",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle closes every handoff", () => {
  for (const phrase of [
    "固定契约",
    "测试不训练的替代方案",
    "盘点并治理数据",
    "一次性划分数据集",
    "选择最小可行试验",
    "估算并演练",
    "根据封存的清单运行",
    "编写晋升报告",
    "打包并进行金丝雀发布",
    "监控并重新验证",
    "不得直接写入隔离的测试集",
    "重新验证触发条件",
    "基座模型变化",
    "模板变化",
    "服务运行时变化",
    "适配决策记录",
  ]) expect(flat).toContain(phrase);
});

test("lower-layer and contested claims stay conditional", () => {
  for (const phrase of [
    "微调无法弥补服务栈不能加载的制品",
    "分词器或模板不匹配",
    "无法恢复的检查点",
    "组织无权使用的数据",
    "已经评估的候选方案和实际部署的系统就不是同一个系统",
    "序列长度和批处理策略决定激活内存",
    "参数范围决定优化器与检查点状态",
    "权重更新是否适合长期承载产品行为",
    "过时的策略",
    "记住隐私样本",
    "选择经过测量的最小干预",
    "完整发布路径",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes the stale catalog and unsupported defaults", () => {
  for (const phrase of [
    "截至 2026 年年中",
    "GitHub star 数",
    "营收数字",
    "现实的默认",
    "具体怎么选",
    "默认：在 TRL + PEFT 之上用 Axolotl",
    "起步配方是 `r=16`",
    "结构性的领域变化加 500K 以上样本",
    "OpenAI 在 2026 年 5 月",
    "Together 按训练词元",
    "一份最小的 Axolotl QLoRA 配置",
  ]) expect(chinese).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toContain("```bash");
  expect(chinese).not.toContain("/figures/training-finetuning-practice-1.svg");
});

test("the Chinese chapter preserves the current English artifact contract", () => {
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(3);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(16);
  expect(chinese.match(/^\|---/gm)?.length).toBe(4);
  expect(chinese.match(/<figure id="fig-training-finetuning-practice-cost-crossover">/g)?.length).toBe(1);
  expect(chinese.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chinese.match(/```python/g)?.length).toBe(1);
  expect(chinese.match(/```yaml/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese).not.toContain("::: {.callout-note}");
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
  for (const phrase of ["适配契约", "受治理的数据", "可复现的运行", "晋升门", "带版本的制品"])
    expect(blocks[0][1]).toContain(phrase);
  for (const phrase of ["来源清单", "合并相关记录和重复项", "封存测试集", "生成训练数据"])
    expect(blocks[1][1]).toContain(phrase);
  for (const phrase of ["运行清单与检查点", "打包完整制品", "离线晋升门", "金丝雀", "晋升或回滚"])
    expect(blocks[2][1]).toContain(phrase);
});

test("the complete Chinese chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/training-finetuning-practice.html",
    chapterTitle: "训练与微调实践",
    chapterNum: "84",
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
  expect(html.match(/class="katex-display"/g)?.length).toBe(8);
  expect(html).toContain("改变权重不是定制模型的第一步");
  expect(html).toContain("把训练实验变成基础设施中可以运营的一部分");
  expect(renderedHeadings.some(({ text }) => text.includes("\\mathcal"))).toBeFalse();
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
