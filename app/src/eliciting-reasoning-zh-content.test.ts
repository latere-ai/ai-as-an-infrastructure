import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/reasoning/01-eliciting-reasoning.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/reasoning/01-eliciting-reasoning.qmd", import.meta.url),
  "utf8",
);

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function normalizedMath(source: string): string[] {
  return matches(source, /\$\$\s*([\s\S]*?)\s*\$\$/g).map((block) =>
    block.replace(/\s+/g, " ").trim(),
  );
}

function pythonBlocks(source: string): string[] {
  return matches(source, /```python\n([\s\S]*?)\n```/g).map((block) => block.trim());
}

function definedFigures(source: string): string[] {
  return [
    ...matches(source, /^\/\/\| label: (fig-[\w-]+)$/gm),
    ...matches(source, /^<figure id="(fig-[\w-]+)">$/gm),
  ].sort();
}

test("Chapter 24 preserves the complete English artifact contract", () => {
  expect(matches(zh, /^## (.+)$/gm)).toEqual([
    "权重固定，推断过程可变",
    "一条轨迹：思维链与问题分解",
    "多条轨迹：自一致性估计的是众数",
    "从轨迹走向搜索",
    "选择：既要有合格候选，也要认得出来",
    "争议：可见推理是工作产物，不是证明",
    "下层约束",
    "将预算与失败策略纳入设计",
    "延伸阅读",
  ]);
  expect(definedFigures(zh)).toEqual(definedFigures(en));
  expect(zh.match(/^\|---\|---\|---\|$/gm) ?? []).toHaveLength(3);
  expect(zh.match(/^```\{dot\}$/gm) ?? []).toHaveLength(3);
  expect(zh.match(/^:::: \{\.runnable\}$/gm) ?? []).toHaveLength(1);
  expect(normalizedMath(zh)).toEqual(normalizedMath(en));
  expect(pythonBlocks(zh)).toEqual(pythonBlocks(en));
});

test("the three-controller diagram uses a compact mobile layout", () => {
  const diagram = zh.match(
    /\/\/\| label: fig-eliciting-reasoning-structure[\s\S]*?```/,
  )?.[0];

  expect(diagram).toContain("nodesep=0.08");
  expect(diagram).toContain("margin=4");
  expect(diagram?.match(/fontsize=9/g) ?? []).toHaveLength(3);
});

test("citations, cross-references, and glossary terms stay aligned with English", () => {
  const referencePattern = /(@(?:sec|fig|gls)-[A-Za-z0-9_-]+|@[a-z]+[0-9][A-Za-z0-9_-]*)/g;
  expect(matches(zh, referencePattern)).toEqual(matches(en, referencePattern));
});

test("the opening keeps weight changes separate from inference procedures", () => {
  for (const phrase of [
    "改变模型回答，不一定要改权重",
    "要求模型写出中间过程、生成多个候选、提取答案并相互比较，或在部分解之间搜索",
    "都在请求到达后增加计算",
    "属于推断过程，而不是训练写入的新能力",
    "增加采样可以提高候选集中出现好答案的概率，却不会告诉系统哪个答案好",
    "搜索能从错误分支退回，前提是评估器认得出更好的分支",
    "真正应该评价的是完整推断流水线，而不是一句「一步一步思考」",
  ]) expect(zh).toContain(phrase);
});

test("the fixed-weight pipeline defines all five independent choices", () => {
  for (const component of [
    "提示或任务表示",
    "候选生成器",
    "答案提取器",
    "选择器或验证器",
    "预算与停止规则",
  ]) expect(zh).toContain(component);
  expect(zh).toContain("自一致性会采样多条链，再选择答案众数");
  expect(zh).toContain("树搜索会反复生成部分状态并为其评分");
  expect(zh).toContain("额外工作和新的失效模式究竟从哪里进入");
  expect(zh).toContain("中间文本为何能影响答案");
  expect(zh).toContain("如实反映了促成答案的全部计算");
});

test("one-trace methods retain the evidence and limits of the English account", () => {
  for (const phrase of [
    "用中间文本承担计算，早于「思维链」这个名称",
    "结果并非在较小模型上一致出现",
    "基准上的改善，而不是适用于所有多步任务的一般规律",
    "两阶段提示",
    "「零样本」只表示提示中没有针对该任务的示例",
    "不能证明这种能力原本潜伏在模型里，只是被提示解锁",
    "只有填充作用的词元并不能复现思维链带来的收益",
    "先要求模型分解问题，再按依赖顺序求解各个子问题",
    "也可能在求解第一个子问题之前就失败",
    "问题分解是一项设计选择，而不是普遍有效的升级",
  ]) expect(zh).toContain(phrase);
});

test("self-consistency remains empirical mode estimation under explicit assumptions", () => {
  for (const phrase of [
    "返回出现频率最高的规范化答案",
    "这是对答案经验众数的估计，通常称为相对多数投票，不一定获得严格多数",
    "答案提取、等价关系、规范化、弃答和平票处理",
    "可以表示同一个答案，字符串却各不相同",
    "有条件独立，并且各自以概率",
    "真实轨迹可能产生许多不同的错误答案，错误之间也存在相关性",
    "所有链共享同一个结果的概率",
    "答案提取器可靠，而且系统性错误不会形成最大的答案簇",
  ]) expect(zh).toContain(phrase);
});

test("the self-consistency runnable executes deterministically without external packages", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = result.stdout.toString().trim().split("\n");

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(output).toHaveLength(3);
  expect(output[0]).toStartWith("rho=0.00: 0.550, ");
  expect(output[1]).toStartWith("rho=0.25: 0.550, ");
  expect(output[2]).toStartWith("rho=0.75: 0.550, ");
});

test("search defines its controller and bounds every empirical claim", () => {
  for (const choice of ["思考单元", "扩展规则", "状态评估器", "前沿策略", "停止规则"]) {
    expect(zh).toContain(choice);
  }
  expect(zh).toContain("搜索会先检查部分工作，再决定下一份计算投向哪里");
  expect(zh).toContain("并不能证明树搜索在任意工作负载上都优于采样");
  expect(zh).toContain("评估器是方法的一部分，并不是全知的判定器");
  expect(zh).toContain("更宽的搜索可能放大评估器误差");
  expect(zh).toContain("引导信号并不是在没有训练的情况下凭空出现的");
});

test("selection separates candidate coverage from recognizing a good answer", () => {
  for (const phrase of [
    "候选集必须先覆盖至少一个可接受的答案，选择器还必须认出它",
    "存在可接受的候选，但选择器错过了它",
    "覆盖失败，此时即使系统同样失败，选择遗憾仍为零",
    "增加样本改善的是候选覆盖，改进检查器或评分器改善的才是选择",
    "答案众数衡量的是答案提取后的共识",
    "确定性检查器执行的是编码好的判定条件",
    "习得评分器根据训练数据估计结果或过程质量",
    "人工审查可以处理开放式标准",
    "属于结果监督，而不是过程监督",
    "更大的候选集暴露出高分错误后，性能最终反而下降",
    "重复采样仍可提高理想选择器下的候选覆盖率，多数投票和习得评分器的选择效果却趋于平坦",
  ]) expect(zh).toContain(phrase);
});

test("faithfulness and the lower-layer constraint retain their operational boundaries", () => {
  expect(zh).toContain("表现、因果依赖和忠实性是三个容易混淆的问题");
  expect(zh).toContain("看起来合理或正确的步骤并不能证明忠实性");
  expect(zh).toContain("只能提供程度不同的证据，不能给出保证");
  expect(zh).toContain("准确性、因果作用和忠实性必须分别评估");
  expect(zh).toContain("任务所能提供的最廉价可靠证据");
  expect(zh).toContain("开放式任务通常只能退回到习得判断或人工判断");
  expect(zh).toContain("扩大搜索之前，要先在扩大搜索所产生的候选上测试评估器");
});

test("the production design makes budget, telemetry, stopping, and handoffs explicit", () => {
  for (const route of ["直接回答", "一条结构化轨迹", "采样并取答案众数", "Best-of-$n$", "结构化搜索"]) {
    expect(zh).toContain(route);
  }
  expect(zh).toContain("延迟预算，也要有词元预算和评分器预算");
  expect(zh).toContain("超时、解析失败、平票、没有候选通过，以及评估器意见不一致");
  expect(zh).toContain("模型与提示版本、采样设置、生成词元数、候选数");
  for (const metric of [
    "单候选准确率",
    "理想选择器下的候选覆盖率",
    "所选答案准确率",
    "有标签时的选择遗憾",
    "答案多样性与两两一致率",
    "按评估器版本统计的误接受率和误拒绝率",
    "每个正确答案的成本，以及延迟中位数和尾部延迟",
  ]) expect(zh).toContain(metric);
  expect(zh).toContain("只有当边际收益在与选择器无关的留出集上仍然成立时，才增加预算");
  expect(zh).toContain("这是工作负载层面的计算，而不是提示与训练之间的普遍竞赛");
  expect(zh).toContain("一条轨迹改变模型后续生成所依赖的序列");
  expect(zh).toContain("多条轨迹改变候选覆盖");
  expect(zh).toContain("选择器改变最终返回哪个候选");
  expect(zh).toContain("搜索改变下一份计算投向哪里");
});

test("the rewrite removes unsupported absolutes and obsolete artifacts", () => {
  for (const rejected of [
    "远超贪心解码所能展现",
    "能力本就潜伏在那里",
    "这是这一族方法中性价比最高的一种",
    "至今仍是最强的简单基线",
    "上限也高",
    "更简单的方法往往才是正确的默认选择",
    "到了规模上，内化才取胜",
    "引出无法超出固定模型所能产出之物",
    "numpy",
    "/figures/eliciting-reasoning-1.svg",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
