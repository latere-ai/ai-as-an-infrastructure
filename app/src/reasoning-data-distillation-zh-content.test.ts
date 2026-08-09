import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/reasoning/06-reasoning-data-distillation.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/reasoning/06-reasoning-data-distillation.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string): string[] {
  return [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map((match) => match[1]);
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/@(?:gls-|sec-)?[A-Za-z0-9_-]+/g)].map((match) => match[0]);
}

test("Chapter 29 preserves the complete English reasoning-data contract", () => {
  expect(headings(chapter)).toEqual([
    "推理记录必须保留什么",
    "从采样池到验收后的分布",
    "自举推理轨迹，但别把答案核查当成证明",
    "小规模精选数据的效果有前提",
    "蒸馏究竟在优化什么",
    "缩小模型与缩短输出是两个目标",
    "弱监督改变了谁能担任教师",
    "如何构建经得起检验的推理语料库",
    "仍有争议的问题",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter.match(/```yaml/g)?.length).toBe(1);
  expect(chapter.match(/```text/g)?.length).toBe(1);
  expect(chapter).toContain("fig-reasoning-data-distillation-1");
  expect(chapter).not.toContain("/figures/reasoning-data-distillation-1.svg");
});

test("citations and cross-references stay aligned with English", () => {
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
});

test("the opening keeps construction, selection, training, and distillation separate", () => {
  for (const phrase of [
    "采样建立候选池",
    "筛选会改变候选池的分布",
    "监督微调模仿筛选后的文本",
    "蒸馏把教师的输出分布或选中样本转移给学生",
    "都不能单独证明书面推理过程忠实反映了模型内部的计算",
    "缩短输出是另一项目标，不会因为学生模型更小就自动实现",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("trace training covers the full answer and makes weighting explicit", () => {
  for (const phrase of [
    "遮住提示，只预测推理轨迹和答案",
    "长回答会贡献更多词元损失",
    "每条样本获得相同的总权重",
    "两种选择都不是中性的",
    "先采样提示，再从该提示的轨迹中采一条",
  ]) {
    expect(flat).toContain(phrase);
  }
  for (const expression of ["y_{i,1:U_i}", "\\sum_{u=1}^{U_i}", "Z_i=T_i+U_i", "1/K_i"]) {
    expect(chapter).toContain(expression);
  }
});

test("the record schema gives metadata an operational purpose", () => {
  const schema = chapter.match(/```yaml\n([\s\S]*?)\n```/)?.[1];
  expect(schema).toBeDefined();
  expect(Math.max(...schema!.split("\n").map((line) => line.length))).toBeLessThanOrEqual(72);
  for (const field of [
    "split_group",
    "checker_versions",
    "prompt_template",
    "parent_hashes",
    "accepted_for_sft",
    "preference_role",
    "audit_only",
    "rejection_reason",
  ]) {
    expect(chapter).toContain(field);
  }
  expect(flat).toContain("防止失败轨迹悄悄混入正向监督数据");
  expect(flat).toContain("只是存储开销");
});

test("rejection sampling defines its accepted distribution and prompt bias", () => {
  for (const phrase of [
    "拒绝采样并不会还原某种抽象的正确推理分布",
    "教师与验收规则共同决定了数据集",
    "筛选也无法凭空创造",
    "容易的问题会产生更多被接受的行",
    "同时记录没有样本通过的组和有样本通过的组",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("q_A(s\\mid x)");
  expect(chapter).toContain("1-(1-p_x)^K");
});

test("outcome, process, and utility admission remain distinct", () => {
  for (const phrase of [
    "结果验收",
    "并不验证得到答案的路径",
    "过程验收",
    "数据效用验收",
    "只有训练目标实际使用被拒轨迹时，它们才有价值",
    "仅使用正样本的 SFT 不会从被拒数据行中学到任何东西",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("STaR keeps answer-conditioned rationalization and checkpoint reset", () => {
  for (const phrase of [
    "把已知答案作为提示公开给模型",
    "从训练输入中移除答案提示",
    "原始算法不是在上一轮模型上继续微调",
    "是在已知答案条件下生成的事后解释",
    "只按答案是否正确筛选，并没有逐步证明推理过程",
    "随机猜中率较高的任务可能放进质量很差的推理过程",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("checker_trace_or_answer");
});

test("RFT retains the reported GSM8K recipe and its evidence boundary", () => {
  for (const phrase of [
    "每道 GSM8K 题采样 100 个解答",
    "温度设为 0.7",
    "用 Python 排除计算错误",
    "提取有序方程列表",
    "从 35.9% 提升到 49.3%",
    "并不能证明每条通过筛选的轨迹都是有效推导",
    "STaR 和 RFT 都属于离线数据构建",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("small-data results include production cost and base-model conditions", () => {
  for (const phrase of [
    "只有 53.6% 的 s1K 生成结果被判为正确",
    "LIMO 使用了 800 道精选数学题",
    "数千万道题",
    "超过 1,000 次受控流水线实验",
    "包含 120 万条样本的语料库",
    "AIME 2025 上取得 53.3%",
    "教师、学生、数据和评测都不相同",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("817");
});

test("distillation distinguishes soft logits from hard sequences", () => {
  for (const phrase of [
    "软词元蒸馏",
    "教师与学生使用可比的词表，并且训练方能访问教师的 logits",
    "硬序列蒸馏",
    "学生模仿的是验收后的分布",
    "并不能证明它恢复了教师的内部算法",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("\\mathcal L_{\\mathrm{soft}}");
  expect(chapter).toContain("\\mathcal L_{\\mathrm{hard}}");
});

test("model size and output length remain separate optimization goals", () => {
  for (const phrase of [
    "模型规模压缩改变参数量",
    "输出长度压缩改变生成词元数",
    "并不能证明模型会输出更短的答案",
    "采样八条回答，选择其中最短的正确回答做 SFT",
    "同时约束正确性和长度",
    "任务质量、生成词元数或延迟，以及模型服务成本",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("weak supervision retains its measured conditions", () => {
  for (const phrase of [
    "教师不一定比学生大",
    "弱教师本身已经接受过强化学习",
    "恢复了直接强化学习收益的 94.34%",
    "并不是强化学习能力可以普遍转移的固定比例",
    "教师是否能生成结构清晰的推理轨迹，比参数量本身更重要",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("a defensible corpus records boundaries, lineage, and matched evaluation", () => {
  for (const phrase of [
    "生成前登记提示家族",
    "固定并版本化生成约定",
    "保存每一项决定，而不只是胜出的样本",
    "拆开记录各项验收标准",
    "拆分前去重，生成后再去重",
    "明确决定权重",
    "评估学生模型，而不是语料库的故事",
    "答案监督微调",
    "算力匹配的非蒸馏基线",
    "许可证和删除谱系",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the contested claim, lower constraint, and payoff stay bounded", () => {
  for (const phrase of [
    "为何会有这种效果，仍无定论",
    "转移推理",
    "教师、学生、筛选器、词元预算和评测",
    "验收过程造成的提示重加权",
    "只有系统记录了足以复现故障的上下文",
    "真正的资产不只是文本",
    "并不假装每条被接受的解释都是证明",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes stale shortcuts and machine-like phrasing", () => {
  for (const phrase of [
    "推理样本不只是答案",
    "小数据与大的潜在技能",
    "把长思考蒸馏成短行为",
    "推理数据因此是一项资本资产",
    "长轨迹教会审慎推理",
    "模型学的不只是哪个答案正确，也在学习一种搜索风格",
    "蒸馏改变的是成本的位置",
    "—",
  ]) {
    expect(chapter).not.toContain(phrase);
  }
});
