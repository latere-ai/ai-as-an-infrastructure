import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(
  new URL("../../en/reasoning/07-inference-time-scaling.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/reasoning/07-inference-time-scaling.qmd", import.meta.url),
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
  return [...source.matchAll(/(?<![A-Za-z0-9])@(?:sec-)?[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

test("Chapter 30 preserves the complete English inference-policy contract", () => {
  expect(headings(chapter)).toEqual([
    "扩展的究竟是什么",
    "重复采样换来的是覆盖率",
    "选择规则决定最终准确率",
    "串行工作需要反馈来源",
    "分配预算，而不是把预算拉满",
    "在成本实际发生处记账",
    "如何运行推断策略",
    "仍有争议的问题",
    "下层约束",
    "收益与边界",
    "延伸阅读",
  ]);
  expect(displayMath(chapter)).toEqual(displayMath(english));
  expect(chapter.match(/```\{mermaid\}/g)?.length).toBe(1);
  expect(chapter.match(/:::: \{\.runnable\}/g)?.length).toBe(1);
  expect(chapter.match(/```python/g)?.length).toBe(1);
  expect(chapter).toContain("fig-inference-time-controller");
  expect(chapter).toContain('data-viz="ttc-budget" data-lang="zh"');
});

test("citations and cross-references stay aligned with English", () => {
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
});

test("the opening keeps the model, controller, evaluator, and stop rule separate", () => {
  for (const phrase of [
    "生成更多候选",
    "延长或修订尚未完成的答案",
    "搜索分支状态空间",
    "消耗的资源不同，改善答案的原因也不同",
    "模型只是这个过程中的一个组件",
    "控制器决定要请求哪些工作",
    "评估器为结果提供证据",
    "停止规则决定继续投入是否值得",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the resource taxonomy describes dependencies and a complete policy", () => {
  for (const phrase of [
    "宽度",
    "候选回答的数量和多样性",
    "深度",
    "评估工作",
    "外部工作",
    "服务资源",
    "并行与串行描述的是工作之间的依赖关系",
    "并非两个互斥的方法类别",
    "生成候选的方法、评估规则、控制器和预算",
    "不能只报告“推理词元”",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("推断控制器");
  expect(chapter).toContain("成本、延迟与并发限制");
});

test("the controller objective defines utility, cost, latency, and observability", () => {
  for (const phrase of [
    "真正的任务效用",
    "包括对放弃回答或升级处理赋予的价值",
    "成本与延迟之间的权衡",
    "路由器在回答之前看不到真正的效用",
    "从留出数据和运行时可用信号中估计",
    "推断算力并不天然比训练或模型容量便宜",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("\\arg\\max_{a\\in\\mathcal A}");
  expect(chapter).toContain("\\mathbb E[U_x(Y_a)]");
});

test("coverage retains its proposal and independence assumptions", () => {
  for (const phrase of [
    "在提示和提议分布不变的前提下",
    "条件独立",
    "收益递减",
    "即使每次独立采样，仍可能反复得到同一个答案",
    "多样性是另一个问题",
    "并不意味着每项任务都有类似的扩展曲线",
    "单次采样解决了 15.9% 的问题",
    "采样 250 次时解决率达到 56%",
  ]) {
    expect(flat).toContain(phrase);
  }
  for (const expression of ["p_x", "C_k(x)=1-(1-p_x)^k", "Y\\sim\\pi(\\cdot\\mid x)"]) {
    expect(chapter).toContain(expression);
  }
});

test("realized accuracy states the selector bound and its exact conditions", () => {
  for (const phrase of [
    "假设选择器 $S$ 只能从采样集合中返回一个候选",
    "只有当选择过程在集合中存在正确候选时总能准确选中它",
    "输出可以离开原来的候选集合",
    "精确核查器",
    "答案投票",
    "学习得到的评分器或裁判模型",
    "通过测试的程序在测试范围之外仍可能出错",
    "核查本身也消耗算力",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("A_k(x)\\le C_k(x)");
});

test("the runnable demonstrates selector failure without claiming an empirical fit", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("selector_bias");
  expect(flat).toContain("人为构造的失败模型，不是对实测数据的拟合");
  expect(cell![1]).toContain('label="覆盖率"');
  expect(cell![1]).toContain('label="不完美的选择器"');

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const nonInteractiveCell = cell![1]
    .split("\n")
    .filter((line) => !line.startsWith("import matplotlib") && !line.startsWith("plt."))
    .join("\n");
  const run = Bun.spawnSync([python!, "-c", nonInteractiveCell], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, MPLBACKEND: "Agg" },
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toMatch(/选择器的最佳 k: \d+/);
});

test("sequential scaling identifies feedback sources and their limits", () => {
  for (const phrase of [
    "模型自己的批评意见",
    "可执行核查",
    "工具结果",
    "检索材料",
    "人工反馈",
    "不能把这些来源当作等价信号",
    "没有外部反馈",
    "不是因为文字记录变得更长",
  ]) {
    expect(flat).toContain(phrase);
  }
  for (const expression of ["Y_0\\sim\\pi", "F_t=\\phi", "Y_{t+1}\\sim R"]) {
    expect(chapter).toContain(expression);
  }
});

test("budget evidence retains benchmark, estimation, and stopping conditions", () => {
  for (const phrase of [
    "从 50% 提升到 57%",
    "AIME 2024 只有 30 道题",
    "每道题约占 3.3 个百分点",
    "每道题采样 2,048 次",
    "估计难度的成本没有计入",
    "推断需求与预训练需求的比例",
    "不能证明真正的成功概率为零",
    "强制预算从 500 到 16,000 个词元",
    "经过验证的停止策略",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(flat).toContain("这些数值不是测量结果，也不是普适扩展律");
});

test("request accounting includes retries and critical-path latency", () => {
  for (const phrase of [
    "第 $r$ 次尝试可能是首次调用，也可能是重试",
    "路由和编排开销",
    "端到端延迟取决于工作流的关键路径",
    "只有尚有空余并发容量时，并行样本才能在实际时间上重叠",
    "输出词元数相同，并不代表浮点运算量相同",
    "延迟相同，也不代表整个集群的成本相同",
    "生成和评估的词元数",
    "延迟分位数",
  ]) {
    expect(flat).toContain(phrase);
  }
  for (const expression of [
    "\\sum_{r=1}^{R}",
    "C_{\\mathrm{gen},r}+C_{\\mathrm{eval},r}+C_{\\mathrm{tools},r}",
    "C_{\\mathrm{controller}}",
    "\\max_{p\\in\\mathcal P}\\sum_{s\\in p}L_s",
  ]) {
    expect(chapter).toContain(expression);
  }
});

test("the operating policy is measurable, bounded, and adversarially tested", () => {
  for (const phrase of [
    "路由前先定义效用",
    "测量完整曲线",
    "比较资源匹配的策略",
    "在搜索压力下审计选择器",
    "使用明确的停止原因",
    "计量每个组件",
    "保护预算边界",
    "只监控输出会漏掉这种故障",
    "在 FreshQA 上最多减速 18 倍",
    "在 SQuAD 上最多减速 46 倍",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the contested boundary and lower-layer handoff stay conditional", () => {
  for (const phrase of [
    "增加推断工作后结果变好，并不能确定唯一的因果机制",
    "有限样本中没有找到正确答案，也不能证明模型赋予它的概率为零",
    "更准确的做法是报告提议分布、控制器、评估器、预算和返回答案的质量",
    "是否能延伸到测量范围之外，仍是每种组件组合都要重新回答的实验问题",
    "并行候选能否同时装入内存",
    "额外并发究竟降低延迟，还是只在别处制造队列",
    "更多搜索会放大系统实际采用的验收规则",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the payoff states what extra candidates and revisions can actually buy", () => {
  for (const phrase of [
    "完整的策略",
    "创造备选方案、收集证据、选择或修订答案",
    "边际收益低于资源成本之前停止",
    "只有额外候选而没有选择，只能换来覆盖率",
    "没有经过验证的改进信号",
    "质量、生成工作、评估工作、工具、延迟和测量范围的边界",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes obsolete figures and unsupported shortcuts", () => {
  for (const phrase of [
    "训练之后只剩一个预算选择",
    "测试时算力的两种形态",
    "选择是免费的",
    "推断算力替代参数",
    "更少数据，更多推断",
    "到 2026 年年中",
    "/figures/inference-time-scaling-1.svg",
    "```{dot}",
    "—",
  ]) {
    expect(chapter).not.toContain(phrase);
  }
});
