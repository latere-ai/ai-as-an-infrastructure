import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/reasoning/05-training-to-reason.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/reasoning/05-training-to-reason.qmd", import.meta.url),
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

test("Chapter 28 preserves the complete English training contract", () => {
  expect(headings(chapter)).toEqual([
    "奖励约定",
    "下层约束",
    "组内相对学习如何获得信号",
    "第一批推理模型证明了什么",
    "仍有争议的问题",
    "强化学习教会了新的推理能力，还是让已有能力更容易被采样？",
    "足以改变结果的优化细节",
    "如何构建经得起检验的训练运行",
    "收益与边界",
    "延伸阅读",
  ]);

  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter).not.toContain("```{dot}");
  expect(chapter.match(/:::: \{\.runnable\}/g)?.length).toBe(1);

  for (const id of [
    "fig-training-to-reason-loop",
    "fig-training-to-reason-grpo-advantage",
    "fig-training-to-reason-stepper",
    "fig-rlvr-boundary",
  ]) {
    expect(chapter).toContain(id);
  }
});

test("citations and cross-references stay aligned with English", () => {
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
});

test("the opening defines RLVR and its three prerequisites", () => {
  for (const phrase of [
    "不需要为每道训练题准备一份完整解答",
    "用一套可独立计算的规则评分",
    "核查器必须反映用户真正关心的任务",
    "基座模型必须已经能解出足够多的训练题",
    "策略更新既要保留探索能力",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the RLVR glossary expansion is not repeated manually", () => {
  expect(chapter).not.toContain("即可验证奖励强化学习（reinforcement learning with verifiable rewards）");
});

test("the reward contract separates executable acceptance from user value", () => {
  for (const phrase of [
    "一个提示及其对应的可执行验收规则",
    "规格缺口",
    "实现缺口",
    "覆盖缺口",
    "并不等于用户价值",
    "只消除了它实际实现的那项标准上的误差",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the lower-layer constraint is the sound checker rather than the optimizer", () => {
  expect(flat).toContain("可靠核查器是否存在，才是第一项约束");
  expect(flat).toContain("而不是选择 GRPO 还是 PPO");
});

test("group-relative learning defines signal, update, and sparse groups", () => {
  for (const phrase of [
    "结果监督下，同一条回答里的所有词元共享这个优势值",
    "裁剪项限制的是相对旧策略的一次更新",
    "KL 项限制的是相对参考策略的累积偏移",
    "整组回答得到相同奖励时",
    "位于当前策略能力边界附近",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the runnable reproduces advantages and mixed-group probability", () => {
  const enCell = english.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  const zhCell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(zhCell).not.toBeNull();
  expect(zhCell![1]).toBe(enCell![1]);

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", zhCell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toBe(
    "GRPO: [1.0, -1.0, 1.0, -1.0]\n" +
      "RLOO: [0.67, -0.67, 0.67, -0.67]\n" +
      "all equal: [0.0, 0.0, 0.0, 0.0]\n" +
      "p=0.01, mixed group=0.077\n" +
      "p=0.10, mixed group=0.570\n" +
      "p=0.50, mixed group=0.992\n",
  );
});

test("reward source remains distinct from the policy optimizer", () => {
  for (const phrase of [
    "RLVR 说明奖励从哪里来",
    "PPO、GRPO 和 RLOO 则说明如何估计并约束策略更新",
    "把每条完整回答视为一次采样动作",
    "不使用 PPO 的词元级裁剪比率",
    "验证器给出的奖励仍是绝对值，更新所用的优势却是相对值",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("R1-Zero evidence stays separate from the released R1 pipeline", () => {
  for (const phrase of [
    "并不足以证明每个展示出来的推理步骤都正确或具有因果必要性",
    "冷启动并不只是修饰输出",
    "最终模型也不是单靠纯 RLVR 得到的",
    "R1-Zero 更干净地证明",
    "完整发布的 R1 则提供了更完整、更实用的产品方案",
    "不能把最终行为归因于其中某一个阶段",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the capability debate states what finite measurements can establish", () => {
  for (const phrase of [
    "新能力有两种有用的含义",
    "有限采样和基准测试都无法确定模型的数学支撑集",
    "提示模板、温度、词元预算、答案提取器和基座检查点",
    "模型系列、训练配方、基准、采样策略和成功定义",
    "不能证明模型对某条路径赋予的概率恰好为零",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("optimizer refinements retain distinct mechanisms and evidence bounds", () => {
  for (const phrase of [
    "批次共享的固定归一化项",
    "单独提高裁剪上界",
    "重新采样，直到批次中包含能够产生不同结果的提示",
    "减轻接近最大回答长度时的惩罚",
    "按长度归一化的序列比率",
    "不是通向某个通用优化器的既定演进路线",
    "是否使用参考策略惩罚，应由测量结果决定",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("a defensible run records provenance, separates datasets, and measures tails", () => {
  for (const phrase of [
    "可靠的训练运行应先定义评估约定，而不是先选优化器",
    "训练提示池",
    "留出任务集",
    "对抗性验证器集",
    "验证器的假接受率和假拒绝率",
    "每加速器小时产生的有效更新数",
    "训练奖励不能单独充当停止信号",
    "总生成词元数、验证成本和推理预算",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the payoff remains conditional on the verifier boundary", () => {
  for (const phrase of [
    "把核查器变成持续产生新训练数据的来源",
    "可信方面的收益也有前提",
    "开放式任务不会因为有了一份详细评分量表就突然变得可机械验证",
    "能可靠地机械核查时，就使用精确规则",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).toContain("推理数据蒸馏");
  expect(flat).toContain("推理时扩展");
  expect(flat).toContain("训练智能体");
});

test("the rewrite removes stale claims, surplus diagrams, and translated phrasing", () => {
  for (const phrase of [
    "一个没有习得代理缺口的奖励",
    "把代理换成核查器",
    "三类验证器",
    "丢掉评论者",
    "它从何而来",
    "信用给多少，多久给一次",
    "精炼组基线",
    "验证器阶梯",
    "@sec-rlhf",
    "fig-training-to-reason-verifiers",
    "fig-training-to-reason-baselines",
    "fig-training-to-reason-r1",
    "fig-training-to-reason-1",
    "fig-training-to-reason-2",
    "—",
  ]) {
    expect(chapter).not.toContain(phrase);
  }
});
