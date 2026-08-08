import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/orientation/01-whole-stack.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/orientation/01-whole-stack.qmd"), "utf8");
const enFlat = en.replace(/\s+/g, " ");

test("Chapter 1 keeps model development and request execution as two histories", () => {
  expect(enFlat).toContain("AI systems have two histories");
  expect(zh).toContain("AI 系统有两段历史");
  expect(zh).toContain("两段历史在部署处相接，却不是同一个过程");
  expect(zh).toContain("预期的运行时负载会反过来改变前期设计");
  expect(zh).toContain("这两个模型并不是能力相当的受控对照");
  expect(zh).not.toContain("两条谱系后来都归到了稀疏一侧");
});

test("capability formation preserves the English data and training argument", () => {
  for (const phrase of [
    "用户的请求不会经过训练语料库",
    "基准测到的可能是记忆，而不是泛化能力",
    "if err != nil {",
    "第一部分把这套完整流程称为「基座模型形成」",
    "数据准备、预训练和中段训练",
    "从基座模型转向助手的第一步",
  ]) expect(zh).toContain(phrase);
});

test("serving and runtime keep prefill, decode, authority, and evidence distinct", () => {
  for (const phrase of [
    "处理输入提示的阶段称为「预填充」",
    "生成后续词元的阶段称为「解码」",
    "模型提出动作，运行时负责执行权限检查",
    "代码仓库和测试运行器提供判断结果的证据",
    "训练产出供服务加载的工件",
    "请求本身只经过运行时路径",
  ]) expect(zh).toContain(phrase);
  expect(zh).toContain("rankdir=TB");
  expect(zh).toContain("W -> S [style=dashed");
  expect(zh).toContain('G -> S [dir=both, label="模型调用 / 文本或工具请求"]');
  expect(zh).toContain('E -> G [dir=both, label="许可的动作 / 观测结果"]');
});

test("the three processes preserve their actual nesting and accounting units", () => {
  expect(zh).toContain("三个过程贯穿全书，但只有两个存在嵌套关系");
  expect(zh).toContain("训练位于上游，是另外两个过程的依赖，并不包含在其中");
  expect(zh).toContain("每个模型版本、每个词元和模型调用、每项任务");
  expect(zh).not.toContain("三个嵌套的循环");
  expect(zh).not.toContain("训练循环只运行一次");
});

test("the constraint arrow uses the English conditional lifecycle-cost model", () => {
  expect(zh).toContain("并不意味着小模型总是更好");
  expect(zh).toContain("C_j(V) = T_j + V I_j");
  expect(zh).toContain("V^* = \\frac{T_B-T_A}{I_A-I_B}");
  expect(zh).toContain("达到同一目标质量的两种假想设计");
  expect(zh).not.toContain("两种能力相当的设计");
  expect(zh).not.toContain("无论服务量多大，稀疏设计在两个循环里都更便宜");
});

test("capability, efficiency, and trust are evaluated for the complete system", () => {
  expect(zh).toContain("| 维度 | 问题 | 修复缺陷任务中的证据 |");
  expect(zh).toContain("这三者不是固定预算中的三项配额");
  expect(zh).toContain("信任针对的是整个系统");
  expect(zh).toContain("模型开发与请求执行是两条相互连接的时间线");
  expect(zh).not.toContain("fig-whole-stack-lens");
});
