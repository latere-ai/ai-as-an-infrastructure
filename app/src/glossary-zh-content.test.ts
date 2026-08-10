import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "../..");
const source = readFileSync(join(repoRoot, "zh/glossary.qmd"), "utf8");
const glossary = parse(readFileSync(join(repoRoot, "glossary.yml"), "utf8")) as Record<
  string,
  {
    en?: string;
    zh?: string;
    def?: { en?: string; zh?: string };
  }
>;
const definitions = Object.entries(glossary).map(([key, entry]) => ({
  key,
  en: entry.def?.en ?? "",
  zh: entry.def?.zh ?? "",
}));

test("the Chinese glossary explains every generated field and navigation path", () => {
  const prose = source.replace(/\s+/g, " ");
  for (const phrase of [
    "中文术语",
    "英文原文",
    "简明定义",
    "首次出现",
    "每章第一次使用",
  ]) expect(prose).toContain(phrase);
  expect(source).toContain("::: {#glossary}\n:::");
});

test("every English glossary entry has a complete Chinese counterpart", () => {
  expect(definitions.length).toBeGreaterThan(150);
  expect(
    Object.entries(glossary)
      .filter(([, entry]) => !entry.en || !entry.zh || !entry.def?.en || !entry.def?.zh)
      .map(([key]) => key),
  ).toEqual([]);
});

test("Chinese definitions are direct sentences rather than compressed notes", () => {
  expect(definitions.filter(({ zh }) => !zh.endsWith("。"))).toEqual([]);
  expect(definitions.filter(({ zh }) => zh.includes("；") || zh.includes(";"))).toEqual([]);
  expect(definitions.filter(({ zh }) => zh.includes("—"))).toEqual([]);

  const noteOpening = /^(?:即|作为|用于|把|对|只|一种失效：)/;
  expect(definitions.filter(({ zh }) => noteOpening.test(zh))).toEqual([]);
});

test("Chinese definitions do not add editorial or time-sensitive claims", () => {
  const editorialClaim = /(?:默认(?:选择|优化器)|如今是|主力优化器|主导(?:范式|加速器|延迟)|奠基性|强力的|最难检测|军备竞赛|已解决的属性|最初的对齐配方|本书所围绕|背后的优化器|供应瓶颈|日益严重的隐患|机器所产|单张 GPU|自 LLaMA 起|LLaMA 与 Qwen)/;
  expect(definitions.filter(({ zh }) => editorialClaim.test(zh))).toEqual([]);
});

test("Chinese term labels avoid literal translations where a natural term exists", () => {
  expect(glossary["least-to-most"]?.zh).toBe("由简入繁");
  expect(glossary.fertility?.zh).toBe("分词膨胀率");
  expect(glossary.hbm?.zh).toBe("高带宽内存");
  expect(glossary.rlaif?.zh).toBe("基于 AI 反馈的强化学习");
  expect(glossary["llm-as-judge"]?.zh).toBe("模型评判");

  const allLabels = Object.values(glossary).map((entry) => entry.zh).join(" ");
  for (const phrase of [
    "由最少到最多",
    "繁殖度",
    "高带宽显存",
    "从 AI 反馈中做强化学习",
    "模型作为评判者",
  ]) expect(allLabels).not.toContain(phrase);
});

test("known Chinese definitions preserve the English scope without extra conclusions", () => {
  const byKey = new Map(definitions.map((entry) => [entry.key, entry.zh]));

  expect(byKey.get("mha")).toBe(
    "一种注意力机制，将查询、键和值分配到多个并行注意力头，使不同注意力头能够学习词元之间的不同关系。",
  );
  expect(byKey.get("compute-optimal")).toBe(
    "在固定算力预算下，能够取得最低预期损失的模型规模与训练数据之间的平衡。",
  );
  expect(byKey.get("adamw")).toBe(
    "Adam 优化器的一种变体，将权重衰减与基于梯度的参数更新分开处理。",
  );
  expect(byKey.get("differential-privacy")).toBe(
    "一种形式化保证，使计算结果在加入或移除任意一条记录时只发生有限变化，从而限制由结果推断个人信息的能力。",
  );
  expect(byKey.get("safety")).toBe(
    "一种形式系统性质，要求被禁止的状态或事件永远不会发生。",
  );
});
