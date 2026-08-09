import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/reasoning/03-programs-solvers-symbolic.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/reasoning/03-programs-solvers-symbolic.qmd", import.meta.url),
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
    ...matches(source, /\{#(fig-[\w-]+)\}$/gm),
    ...matches(source, /^<figure id="(fig-[\w-]+)">$/gm),
  ].sort();
}

test("Chapter 26 preserves the complete English artifact contract", () => {
  expect(matches(zh, /^## (.+)$/gm)).toEqual([
    "可执行产物需要明确约定",
    "执行成功不等于答案正确",
    "各类运行时究竟能证明什么",
    "程序辅助方法证明了什么",
    "忠实性有三层含义",
    "修复是一轮受控搜索",
    "形式化之后，形式证明才有强保证",
    "执行器是一道安全边界",
    "争议：形式化的成本何时值得",
    "下层约束",
    "延伸阅读",
  ]);
  expect(definedFigures(zh)).toEqual(definedFigures(en));
  expect(zh.match(/^\|---/gm) ?? []).toHaveLength(1);
  expect(zh.match(/^:::: \{\.runnable\}$/gm) ?? []).toHaveLength(1);
  expect(normalizedMath(zh)).toEqual(normalizedMath(en));
  expect(pythonBlocks(zh)).toEqual(pythonBlocks(en));
});

test("citations and cross-references stay aligned with English", () => {
  const referencePattern = /(@(?:sec|fig|gls)-[A-Za-z0-9_-]+|@[a-z]+[0-9][A-Za-z0-9_-]*)/g;
  expect(matches(zh, referencePattern)).toEqual(matches(en, referencePattern));
});

test("the opening separates translation, execution, and task agreement", () => {
  for (const phrase of [
    "语言模型可以识别问题的结构，却仍可能在算术、格式错误的查询或一个无效证明步骤上丢掉答案",
    "可执行推理把这些工作分开",
    "模型提出程序、查询、约束系统或证明",
    "运行时按照明确规则解释这项产物",
    "任务级检查再判断结果是否回答了原始请求",
    "精确执行了错误形式化的解答，仍然是错的",
    "自然语言和形式系统的失效方式不同",
    "用户原意和产物表达之间的语义缺口",
  ]) expect(zh).toContain(phrase);
});

test("the artifact contract specifies a typed model-executor boundary", () => {
  for (const phrase of [
    "概率翻译器与受控执行器之间的一道类型化边界",
    "语法、类型、允许的操作、输入结构和输出结构",
    "固定的执行环境",
    "状态、取值、轨迹和资源用量",
    "解析错误",
    "类型错误",
    "策略违规",
    "运行时错误",
    "超时",
    "确定性程序也只有相对于该环境才是确定的",
    "可复现性要求记录",
    "较小的语言可以同时减少歧义和权限",
  ]) expect(zh).toContain(phrase);
});

test("acceptance keeps well-formedness, execution success, and task agreement separate", () => {
  for (const phrase of [
    "良构性",
    "执行成功",
    "任务一致性",
    "三个条件全部成立时",
    "前两项检查往往可以机械完成",
    "第三项才是难点",
    "精确执行只会把错误形式化封装起来，并不会修好它",
    "人工审查、独立测试、以来源为依据的约束或弃答",
  ]) expect(zh).toContain(phrase);
});

test("the task-agreement runnable executes both artifacts and rejects the wrong translation", () => {
  const [program] = pythonBlocks(zh);
  const result = Bun.spawnSync(["python3", "-c", program], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "wrong but runnable: executes to 8; contract rejects: fraction mismatch",
    "correct artifact: executes to 12; contract accepts",
  ]);
  expect(zh).toContain("$A$ 表示任务一致性检查");
});

test("each runtime states both its guarantee and its boundary", () => {
  for (const runtime of [
    "解释器或数据库",
    "计算机代数系统",
    "SMT 求解器",
    "证明助手",
    "检索或动作工具",
  ]) expect(zh).toContain(runtime);
  for (const phrase of [
    "成功时能证明什么",
    "成功时不能证明什么",
    "不理解编码之外的用户意图",
    "小型内核",
    "保证仍然以定理陈述、定义、导入项和公理为条件",
    "不可信的证明包",
    "观察结果是新信息，不是证书",
    "来源核验和授权",
  ]) expect(zh).toContain(phrase);
});

test("program-aided evidence remains scoped to the tasks actually studied", () => {
  for (const phrase of [
    "十三项数学、符号和算法任务",
    "五个数学应用题数据集和三个金融问答数据集",
    "只有执行的语句才具备解释器语义",
    "Python、Datalog 或 PDDL 规划器",
    "数学应用题、规划、多跳问答和关系推理",
    "不能证明任意开放式推理都能以同样方式翻译或检查",
    "共同贡献在于提供一套接口，而不是新的真相来源",
  ]) expect(zh).toContain(phrase);
});

test("faithfulness distinguishes execution, semantics, and narration", () => {
  for (const phrase of [
    "执行忠实性",
    "最终答案必须由这份产物的执行结果产生",
    "语义忠实性",
    "叙述忠实性",
    "处于答案的因果上游",
    "执行本身不能证明这一点",
    "模型写出的解释仍可能是事后编造",
    "并不会暴露模型的隐藏计算",
    "答案与执行结果之间的绑定不能松动",
  ]) expect(zh).toContain(phrase);
});

test("repair stays bounded, versioned, and grounded in the immutable request", () => {
  for (const phrase of [
    "解析、结构或类型错误",
    "策略错误",
    "运行时、超时和资源错误",
    "任务检查失败",
    "呈现错误",
    "不可变的原始请求",
    "带版本的产物",
    "尝试次数上限",
    "完整约定重新检查",
    "弃答或回退",
    "不要把原始秘密、任意工具输出或未经限制的编译器日志送回模型",
  ]) expect(zh).toContain(phrase);
});

test("formal proof guarantees begin only after formalization", () => {
  expect(zh).toContain("K(\\Delta,\\pi,\\varphi)=\\operatorname{accept}");
  for (const phrase of [
    "形式对象的强保证",
    "定理陈述和允许使用的环境必须来自可信来源",
    "五道非几何题中的三道",
    "28 分，等同于银牌成绩",
    "耗时数日的计算",
    "专家预先完成了非几何题的形式化",
    "244 道题组成的 miniF2F 测试集",
    "Pass@8192 不是单样本准确率",
    "不衡量从非形式化语言到形式语言的翻译",
  ]) expect(zh).toContain(phrase);
});

test("the executor is treated as an untrusted-code security boundary", () => {
  for (const phrase of [
    "生成产物属于不可信代码",
    "超时机制本身不是沙箱",
    "无特权身份",
    "默认禁止网络和文件系统访问",
    "CPU、内存、输出量和墙钟时间",
    "只读数据库凭据",
    "消息、付款、部署和写入操作的授权",
    "记录来源信息",
    "按输出结构和任务检查验证结果",
    "最小权限也能限制翻译错误造成的损害",
  ]) expect(zh).toContain(phrase);
});

test("the contested boundary and closing preserve the system-level conclusion", () => {
  for (const phrase of [
    "争议不在于执行能否改善算术或证明检查",
    "形式化、任务检查和沙箱的成本",
    "不应外推到需求仍然含糊",
    "狭窄的产物语言和独立验收条件",
    "流畅的错误换成精确执行的错误",
    "翻译器、产物约定、隔离执行器、任务检查和答案绑定",
    "最薄弱的接口决定结果值得多少信任",
    "把一部分推理变成可观测的计算",
    "下一章会直接讨论这个缺失环节",
  ]) expect(zh).toContain(phrase);
});

test("the rewrite removes the incomplete chapter's misleading abstractions", () => {
  for (const rejected of [
    "翻译才是学习到的部分",
    "p = T_\\theta(x)",
    "解释器就是一个工具",
    "由构造得到的忠实性",
    "运行时成为推理器的一部分",
    "失败移动到了接口处",
    "@sec-serving-problem",
    "@sec-verifiers-process-supervision",
    "—",
  ]) expect(zh).not.toContain(rejected);
});
