import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/evaluation/06-evaluating-agents.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/evaluation/06-evaluating-agents.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
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

function tableRows(source: string): string[] {
  return [...source.matchAll(/^\|.+\|$/gm)].map((match) => match[0]);
}

test("Chapter 52 preserves the complete English agent-evaluation contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "评测智能体与能力 {#sec-evaluating-agents}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "从回合回报到工具型智能体",
    "定义受测系统",
    "分开评测状态与约束",
    "让每项任务有效且可重置",
    "区分智能体失败与评测失败",
    "一次尝试不代表可靠性",
    "用轨迹诊断，而不是事后编故事",
    "运行契约",
    "争议所在",
    "下层约束",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(tableRows(chapter).length).toBe(tableRows(english).length);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```text$/gm)?.length).toBe(1);
  expect(chapter.match(/^```python$/gm)?.length).toBe(1);
  expect(chapter.match(/\.runnable/g)?.length).toBe(1);
  expect(chapter.match(/^!\[/gm)?.length).toBe(1);
});

test("the opening separates claims from completed work", () => {
  for (const phrase of [
    "智能体不只会生成回答",
    "观察环境、选择动作、调用工具并改变状态",
    "检查实际发生了什么",
    "最终消息只能证明智能体声称自己做了什么",
    "环境状态和保留下来的动作日志",
    "评测有版本的系统，核验最终状态",
    "真正的流程约束",
  ]) expect(flat).toContain(phrase);
});

test("the historical background connects episodes to executable environments", () => {
  for (const phrase of [
    "这个测量问题早于语言模型",
    "策略在一个回合内与环境交互",
    "规定什么现实状态才算成功",
    "AgentBench",
    "WebArena",
    "SWE-bench",
    "OSWorld",
    "GAIA",
    "测量的不是一种可以互换的量",
  ]) expect(chapter).toContain(phrase);
});

test("the system boundary pins every execution layer", () => {
  for (const phrase of [
    "模型版本、服务路由、解码设置和推理预算",
    "系统提示、工具说明、编排循环和上下文政策",
    "工具实现、凭据、权限和网络政策",
    "沙箱镜像、依赖版本、初始数据和重置流程",
    "模拟用户、时间或轮数预算，以及评分器版本",
    "系统结果",
    "其余配置保持不变",
    "配置才是站得住的报告单位",
  ]) expect(flat).toContain(phrase);
});

test("task definitions and stochastic runs remain separate records", () => {
  for (const field of [
    "initial_state_fixture",
    "reset_check",
    "hard_process_constraints",
    "outcome_assertions",
    "partial_credit_rubric",
    "system_spec_hash",
    "initial_state_hash",
    "observation_action_log",
    "final_state_hash",
    "terminal_reason",
    "infrastructure_status",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "把任务定义与一次随机尝试分开",
    "模拟用户也是测量工具的一部分",
    "模型、提示、人设、可用信息和停止行为",
    "与具有代表性的人类用户比较",
  ]) expect(flat).toContain(phrase);
});

test("the formal trajectory defines every symbol", () => {
  for (const phrase of [
    "$i$ 表示任务",
    "$r$ 表示一次重复尝试",
    "$s_0$ 和 $s_T$ 是环境的初始状态和最终状态",
    "$o_t$ 是第 $t$ 步可用的观测",
    "$a_t$ 是看到该观测后选择的动作",
    "$T$ 是运行终止时的步数",
    "评测器声称核验某项状态时",
  ]) expect(flat).toContain(phrase);
});

test("required success combines outcomes with only hard constraints", () => {
  for (const phrase of [
    "任务的结果检查",
    "检查第 $j$ 项硬性流程约束",
    "结果和所有硬性约束都通过",
    "空乘积为 1",
    "不要求智能体遵循作者偏好的路线",
    "真正属于任务要求的中间事实",
  ]) expect(flat).toContain(phrase);
});

test("signals retain their appropriate roles", () => {
  for (const phrase of [
    "最终环境状态",
    "硬性轨迹约束",
    "授权、安全、顺序和禁止动作",
    "部分得分准则",
    "成本、延迟和步数",
    "把廉价的失败称为高效",
    "对话记录与工具轨迹",
    "独立于智能体的输出通道",
    "不能因此成为独立的状态检查",
  ]) expect(flat).toContain(phrase);
});

test("the localized evaluation diagram preserves state and trace roles", () => {
  for (const phrase of [
    'I [label="已验证的初始状态"]',
    'R [label="有版本的智能体运行"]',
    'S [label="最终状态断言"]',
    'C [label="已声明的轨迹约束"]',
    'O [label="结果与审计记录"]',
    'R -> S [label="状态"]',
    'S -> C [label="轨迹"]',
  ]) expect(chapter).toContain(phrase);
});

test("task and grader validation exercise positive and negative cases", () => {
  for (const phrase of [
    "任务必须能够用给定信息和权限完成",
    "结果检查必须接受参考路径之外的有效做法",
    "已知错误方案必须失败",
    "重置必须恢复下一次运行能够观察到的所有状态",
    "500 个案例的 Verified 子集",
    "评分器也是软件，需要测试、版本管理和持续审查",
    "保留端到端二元完成率",
    "不能用更容易计算的里程碑平均分取代",
  ]) expect(flat).toContain(phrase);
});

test("terminal reasons distinguish behavior from broken measurement", () => {
  for (const phrase of [
    "智能体失败",
    "运行框架兼容性失败",
    "环境失败",
    "评分器失败",
    "兼容性失败属于系统配置",
    "预先声明处理政策",
    "服务日志和健康探针",
    "重置检查或金丝雀断言失败时终止整批评测",
  ]) expect(flat).toContain(phrase);
});

test("repeated-attempt metrics answer different questions", () => {
  for (const phrase of [
    "任务 $i$ 在声明的运行分布 $R$ 下达到要求的成功概率",
    "至少一次成功",
    "所有 $k$ 次尝试都成功",
    "允许重试时系统能否成功",
    "衡量重复可靠性",
    "都不会凭空增加新任务",
    "最终数据库状态与标注目标",
  ]) expect(flat).toContain(phrase);
});

test("the reliability runnable is localized without changing the computation", () => {
  for (const phrase of [
    'label="pass@k：至少一次成功"',
    'label="pass^k：每次都成功"',
    'plt.xlabel("尝试次数 k")',
    'plt.ylabel("概率")',
    "at_least_one = 1 - (1 - p) ** k",
    "every_attempt = p ** k",
  ]) expect(chapter).toContain(phrase);
});

test("finite-sample reliability is estimated per task", () => {
  for (const phrase of [
    "$n$ 次有效尝试",
    "观测到 $c_i$ 次成功",
    "从 $a$ 次尝试中选出 $k$ 次的子集数量",
    "按测试套件声明的任务权重",
    "重复尝试嵌套在任务内",
    "不能把整个测试套件的汇总准确率直接取 $k$ 次方",
  ]) expect(flat).toContain(phrase);
});

test("reliability remains sliced by task horizon", () => {
  for (const phrase of [
    "任务长度也会改变可靠性",
    "工具、规划、上下文和恢复",
    "按有意义的长度或难度切片报告成功率",
    "许多短任务掩盖长任务上的崩溃",
    "长度本身并不是因果解释",
  ]) expect(flat).toContain(phrase);
});

test("traces support diagnosis without post-hoc score repair", () => {
  for (const phrase of [
    "轨迹可以帮助定位系统在哪一步失败",
    "改变状态的事件",
    "感知、规划、工具选择、无效参数",
    "不能只凭最终结果指定根因",
    "允许标注多个共同原因",
    "把确认过的评测器缺陷变成回归测试",
    "不是用有说服力的事后解释挽救偏好的分数",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract preserves reconstruction and confirmation", () => {
  for (const phrase of [
    "把模型、运行框架、工具、权限、环境、预算、用户模拟器和评分器",
    "从环境状态核验完成情况",
    "用已知成功、已知失败和对抗性近似案例测试评分器",
    "每个汇总结果都能重建",
    "锁定的确认测试套件",
    "验证过的生产故障带回回归案例",
  ]) expect(flat).toContain(phrase);
});

test("contested scope and lower-layer observability remain explicit", () => {
  for (const phrase of [
    "只看结果的评分",
    "密集的流程评分",
    "既不是只看结果，也不是全程规定路径",
    "把硬性流程约束限制在必要范围",
    "执行层没有暴露的状态，评测层就看不到",
    "无法证明哪些文件、凭据、网络调用或数据库记录发生了变化",
    "评测设计从评分器的下一层开始",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes obsolete product-specific detours and extra artifacts", () => {
  for (const phrase of [
    "那笔从未发生的退款",
    "评判工作：看状态，不看故事",
    "谁来验证验证者",
    "分布式系统留下了什么",
    "把分歧当作信号",
    "选择在哪里变得关键",
    "对抗式评审：已发布",
    "能力与安全",
    "Latere",
    "verbatim",
    "根会话",
    "—",
  ]) expect(chapter).not.toContain(phrase);
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
});
