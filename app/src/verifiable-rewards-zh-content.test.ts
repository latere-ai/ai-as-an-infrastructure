import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/adaptation/05-verifiable-rewards-reasoning.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/05-verifiable-rewards-reasoning.qmd", import.meta.url),
  "utf8",
);

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function citations(source: string): string[] {
  return [...new Set([...source.matchAll(/@([a-z]+\d[\w-]*)/g)].map(([, key]) => key))].sort();
}

function crossRefs(source: string): string[] {
  return [...source.matchAll(/@(?:sec|fig|gls)-[\w-]+/g)].map(([ref]) => ref).sort();
}

test("Chapter 21 starts from reward provenance rather than a generic verifier promise", () => {
  expect(zh).toContain("偏好模型可以预测人们倾向于哪个回答");
  expect(zh).toContain("程序是否真的通过测试，或两个代数式是否等价");
  expect(zh).toContain("去掉了一个学习型评判者，却没有消除规格错误");
  expect(zh).toContain("决定性边界在于奖励来自哪里");
  expect(zh).toContain("选择与训练是信号的两种不同用途");
});

test("the executable checker and learned reward model have different contracts", () => {
  expect(zh).toContain("## 检查器是已经实现的任务规格");
  expect(zh).toContain(String.raw`r_{\mathrm{ver}}(x,y)=C(x,y)\in\{0,1\}`);
  expect(zh).toContain("二元接纳是最清楚的情形，却不是整个方法的定义");
  expect(zh).toContain(String.raw`r_\phi(x,y)\approx \mathbb{E}[J(x,y)\mid x,y]`);
  expect(zh).toContain("可执行检查器不会犯这些特定的评判错误");
  expect(zh).toContain("仍然可能把错误的任务规格执行得一丝不差");
});

test("soundness and completeness are defined against intended correctness", () => {
  expect(zh).toContain("可靠性与完备性");
  expect(zh).toContain(String.raw`C(x,y)=1\Rightarrow q(x,y)=1`);
  expect(zh).toContain(String.raw`q(x,y)=1\Rightarrow C(x,y)=1`);
  expect(zh).toContain("没有假阳性");
  expect(zh).toContain("没有假阴性");
  expect(zh).toContain("单元测试可以执行，却不是行为的完整规格");
});

test("checker hardening does not turn partial coverage into ground truth", () => {
  expect(zh).toContain("检查器就是优化器实际看到的任务规格");
  for (const risk of [
    "读取隐藏答案",
    "修改测试框架",
    "利用未定义行为",
    "把可见测试用例写死",
    "沙箱",
    "隐藏测试",
    "模糊测试",
    "蜕变测试",
  ]) expect(zh).toContain(risk);
  expect(zh).toContain("都不能把不完整的规格变成真值");
});

test("the checker comparison table states what each signal cannot prove", () => {
  for (const row of [
    "| 规范化答案匹配 |",
    "| 单元测试或性质测试 |",
    "| 形式化证明内核 |",
    "| 环境状态检查 |",
    "| 学习型验证器 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("校准、分布偏移与代理博弈");
});

test("learned verifiers remain distinct from executable reward sources", () => {
  expect(zh).toContain("论文常把学习得到的正确性模型称为验证器");
  expect(zh).toContain("并不等同于直接运行答案等价检查程序所得的奖励");
  expect(zh).toContain("@cobbe2021verifiers");
});

test("the reward map separates provenance from use", () => {
  expect(zh).toContain("label: fig-verifiable-rewards-map");
  for (const label of [
    "任务 x + 候选回答 y",
    "奖励来源",
    "学习型评分器",
    "可执行检查器",
    "怎样使用\\n这个信号",
    "选择一个回答",
    "筛选 SFT 数据",
    "更新同策略模型",
  ]) expect(zh).toContain(label);
});

test("coverage is established before selection", () => {
  expect(zh).toContain("## 先有覆盖率，选择才有意义");
  expect(zh).toContain("P(\\text{至少一个正确})=1-(1-p)^n");
  expect(zh).toContain("在同一解码分布下抽取");
  expect(zh).toContain("假设每次采样彼此独立");
  expect(zh).toContain("选择器可以把覆盖率变成返回答案的正确率，却不能凭空创造覆盖率");
});

test("best-of-n with a learned proxy is not monotonically improving", () => {
  expect(zh).toContain(String.raw`y^*=\underset{1\le i\le n}{\operatorname{argmax}}\;s(x,y_i)`);
  expect(zh).toContain("更多样本会带来更多正确候选，却也会暴露更多可能被学习型分数高估的异常错误");
  expect(zh).toContain("候选数增加到 400 时持续改善，超过后反而下降");
  expect(zh).toContain("不能保证单调改善");
});

test("the threshold visualization remains qualitative and distinguishes oracle from proxy", () => {
  expect(zh).toContain('id="fig-verifiable-rewards-threshold"');
  expect(zh).toContain('data-viz="verifier-threshold" data-lang="zh"');
  expect(zh).toContain("理想核查器会持续受益");
  expect(zh).toContain("代理选择器最终会找到得分高于真实解答的假阳性");
  expect(zh).toContain("只是定性示意，并不是对验证器准确率的校准估计");
});

test("pass at k is an oracle coverage metric with a reproducible protocol", () => {
  expect(zh).toContain(String.raw`\widehat{\operatorname{pass@}k}`);
  expect(zh).toContain(String.raw`1-\frac{\binom{n-c}{k}}{\binom{n}{k}}`);
  expect(zh).toContain("并不说明部署时的选择器能够找到那条通过的回答");
  for (const field of ["采样温度", "核采样阈值", "最大回答长度", "生成样本数", "检查器"]) {
    expect(zh).toContain(field);
  }
});

test("checked samples have three distinct reuse paths", () => {
  expect(zh).toContain("## 通过核查的样本有三种用法");
  for (const row of [
    "| Best-of-$n$ 选择 |",
    "| 拒绝采样微调 |",
    "| RLVR |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("选择不是训练");
  expect(zh).toContain("相对于后续检查点，它们已经成为离策略数据");
  expect(zh).toContain("正在训练的模型产生的同策略回答");
});

test("RLVR and GRPO are not treated as synonyms or new inventions", () => {
  expect(zh).toContain("Tülu 3 为这种规则奖励阶段使用了 RLVR 这个名称");
  expect(zh).toContain("自动核查样本后再筛选或优化的做法早于这个名称");
  expect(zh).toContain("GRPO 是优化器，不是 RLVR 的同义词");
  expect(zh).toContain("完整的 DeepSeek-R1 流水线远不止这一步");
});

test("the group-relative loop defines every quantity and its informative regime", () => {
  expect(zh).toContain("从当前策略采样 g 个回答 y_1, ..., y_g");
  expect(zh).toContain(String.raw`$C_{\mathrm{train}}$` + " 是训练检查器");
  expect(zh).toContain("P(\\text{组内结果混合})=1-p^g-(1-p)^g");
  expect(zh).toContain("有信息量的组必须包含奖励差异");
  expect(zh).toContain("$p=0.05$ 且 $g=8$ 时，只有约 34% 的组同时包含通过与失败");
  expect(zh).toContain("冷启动数据并不是普遍必要条件");
});

test("feedback timing and reward provenance are independent axes", () => {
  expect(zh).toContain("## 结果与过程是另一条轴线");
  expect(zh).toContain("结果与过程是一条轴线，可执行与学习得到则是另一条轴线");
  for (const row of ["| 结果 |", "| 过程 |"]) expect(zh).toContain(row);
  expect(zh).toContain("形式化证明步骤检查器");
  expect(zh).toContain("过程奖励模型（PRM）");
});

test("outcome reward states its credit-assignment limit", () => {
  expect(zh).toContain(String.raw`R_{\mathrm{out}}(x,\tau)=C(x,y)`);
  expect(zh).toContain("成功轨迹中的每个词元可能一起得到强化，其中也包括绕路与错误");
  expect(zh).toContain("失败轨迹中有用的前缀则可能得不到任何正向信用");
});

test("process reward is learned and has no universal aggregation rule", () => {
  expect(zh).toContain(String.raw`s_t=\widehat{P}_\phi(S_t=1\mid x,z_{\le t})`);
  expect(zh).toContain(String.raw`R_{\mathrm{proc}}=A(s_1,\ldots,s_T)`);
  expect(zh).toContain("不存在一种普适的折扣求和定义");
  expect(zh).toContain("是一个困难数学场景中的证据，并不是过程监督总能胜出的定理");
  expect(zh).toContain("PRM 也重新带回了代理风险");
});

test("endpoint and process signals can be combined without hiding endpoint failure", () => {
  expect(zh).toContain("精确的终点检查器可以锚定任务是否成功");
  expect(zh).toContain("过程分数不能补偿失败的终点");
  expect(zh).toContain("除非这种取舍已经明确写入任务规格");
});

test("reward gains do not by themselves establish reasoning expansion", () => {
  expect(zh).toContain("## 奖励带来的提升究竟证明了什么");
  for (const question of [
    "基座模型原本无法生成的路径",
    "推理本身得到改善",
    "奖励结构不同的提示",
  ]) expect(zh).toContain(question);
  expect(zh).toContain("随机奖励甚至错误奖励");
  expect(zh).toContain("结论会依赖基座模型");
});

test("path verification and transfer claims retain their measurement limits", () => {
  expect(zh).toContain("CoT-Pass@$k$");
  expect(zh).toContain("路径验证器是学习得到的，也会出错");
  expect(zh).toContain("同一训练任务族中的留出实例");
  expect(zh).toContain("相关任务族");
  expect(zh).toContain("真正不同的领域");
  expect(zh).toContain("第一层的证据不能证明第三层");
});

test("the reward contract has six operational audit gates", () => {
  expect(zh).toContain("## 建立并审计奖励契约");
  for (const gate of [
    "写明预期契约",
    "加固训练检查器",
    "分开训练检查器与评测检查器",
    "检查初始奖励分布",
    "监控策略，而不只监控奖励",
    "在奖励之外评测",
  ]) expect(zh).toContain(gate);
  expect(zh).toContain("记录假阳性与假阴性");
  expect(zh).toContain("按提示统计奖励率");
  expect(zh).toContain("组内奖励方差");
  expect(zh).toContain("留出通过率");
  expect(zh).toContain("域外质量");
});

test("rubric rewards remain structured learned feedback rather than strict verifiable reward", () => {
  expect(zh).toContain("评分准则奖励可以把同策略强化学习扩展到没有可执行真值谓词的任务");
  expect(zh).toContain("这是结构化的学习型反馈，严格来说并不是可验证奖励");
  expect(zh).toContain("评分准则让代理信号更便于审查，却不能消除评判模型的误判与博弈");
});

test("the contested claim and lower-layer constraint stay bounded", () => {
  expect(zh).toContain("RLVR 可以提高通过检查的成功概率");
  expect(zh).toContain("不能只根据 pass@1 就断言能力范围已经扩大");
  expect(zh).toContain("验证器质量本身就是基础设施约束");
  for (const constraint of ["稳健的等价检查", "隔离执行与隐藏测试", "可信内核", "环境状态断言"]) {
    expect(zh).toContain(constraint);
  }
});

test("Chinese Chapter 21 preserves the complete English artifact contract", () => {
  expect(count(zh, /^## /gm)).toBe(count(en, /^## /gm));
  expect(count(zh, /^### /gm)).toBe(count(en, /^### /gm));
  expect(count(zh, /^\$\$$/gm)).toBe(count(en, /^\$\$$/gm));
  expect(count(zh, /^```\{dot\}$/gm)).toBe(count(en, /^```\{dot\}$/gm));
  expect(count(zh, /^```\{=html\}$/gm)).toBe(count(en, /^```\{=html\}$/gm));
  expect(count(zh, /^```text$/gm)).toBe(count(en, /^```text$/gm));
  expect(count(zh, /^\|---/gm)).toBe(count(en, /^\|---/gm));
  expect(citations(zh)).toEqual(citations(en));
  expect(crossRefs(zh)).toEqual(crossRefs(en));
});

test("the Chapter 21 Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});

test("the rewrite removes stale shortcuts and unsupported additions", () => {
  for (const rejected of [
    "只要它本身可靠，就不在乎答案听起来有多自信",
    "验证器买来四件事",
    "Tülu 3 提出了 RLVR 这个名字",
    "DeepSeek-R1 随后让这套配方在前沿规模上变得可见",
    "如果模型从来碰不到正确答案，就没有梯度告诉它往哪里走",
    "过程监督可以超过结果监督",
    "如今多了第三种选择",
    "OpenAI 的 HealthBench",
    "真实的后训练栈是混合的",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
