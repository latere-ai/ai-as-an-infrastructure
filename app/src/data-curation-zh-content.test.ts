import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/foundations/02-data-curation.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/foundations/02-data-curation.qmd"), "utf8");

test("Chapter 6 distinguishes the four corpus quantities and their units", () => {
  expect(en).toContain("The run consumes a distribution, not a folder");
  expect(zh).toContain("## 训练过程消耗的是分布，不是文件夹");
  for (const quantity of ["**采集池**", "**保留语料**", "**混合分布**", "**训练流**"]) {
    expect(zh).toContain(quantity);
  }
  expect(zh).toContain("语料库存并不等于模型学到的分布");
  expect(zh).toContain("文档、字节和词元");
});

test("lineage, admission, and extraction retain the English chapter boundaries", () => {
  for (const heading of [
    "## 在每个阶段记录沿袭关系",
    "## 决定一种来源能否进入语料",
    "## 提取与规范化不能抹掉来源",
  ]) expect(zh).toContain(heading);
  expect(zh).toContain("稳定记录 ID");
  expect(zh).toContain("不可变快照");
  expect(zh).toContain("公开可访问、允许抓取、获得许可和得到同意，是四种不同的属性");
  expect(zh).toContain("超过 1,800 个文本数据集");
  expect(zh).toContain("任何检测器都不能证明语料中完全没有个人信息");
  expect(zh).toContain("原始内容和规范化内容的摘要都应保留在沿袭记录中");
  expect(zh).toContain("按语言报告保留率");
});

test("deduplication defines exact math, indexed cost, and deterministic clustering", () => {
  expect(zh).toContain("## 按真正有意义的单位去重");
  for (const kind of ["**精确文档去重**", "**精确片段去重**", "**模糊文档去重**", "**语义去重**"]) {
    expect(zh).toContain(kind);
  }
  expect(zh).toContain("J(a,b)=\\frac{|S(a)\\cap S(b)|}{|S(a)\\cup S(b)|}");
  expect(zh).toContain("\\operatorname{Var}(\\widehat J)=J(1-J)/m");
  expect(zh).toContain("P_{\\mathrm{candidate}}(s)=1-\\left(1-s^r\\right)^b");
  expect(zh).toContain('id="fig-data-curation-lsh-probability"');
  expect(zh).toContain('data-xlabel="Jaccard 相似度" data-ylabel="候选概率"');
  expect(zh).toContain('data-plabel="每个分带的行数"');
  expect(zh).toContain("LSH 只产生候选对，不能证明两篇文档重复");
  expect(zh).toContain("大致为 $O(nm+K)$");
  expect(zh).toContain("连通分量");
  expect(zh).not.toContain("@gls-lsh（LSH）");
  expect(zh).not.toContain("fig-data-curation-minhash");
});

test("quality claims remain measured, sliced, and compute matched", () => {
  expect(zh).toContain("## 质量是测量出来的属性");
  expect(zh).toContain("不存在脱离上下文的“高质量文本”标签");
  expect(zh).toContain("不是名为“流畅度”的客观属性");
  expect(zh).toContain("固定预算的训练消融实验");
  expect(zh).toContain("240 万亿词元");
  expect(zh).toContain("不是数据集的普适排名");
  expect(zh).toContain("曲线不是实测损失，也不是对语料的普适排序");
  expect(zh).toContain("FineWeb-Edu 是从抓取文本中经学习式过滤得到的子集，并非完全生成的语料");
  expect(zh).not.toContain("fig-data-curation-debate");
});

test("sampling distinguishes storage, mixture weights, effective epochs, and curricula", () => {
  expect(zh).toContain("## 把保留的数据源变成采样词元");
  expect(zh).toContain("P_{\\mathrm{train}}(x)=\\sum_{k=1}^{K}w_kP_k(x)");
  expect(zh).toContain("e_k=\\frac{D_k}{U_k}=\\frac{w_kD}{U_k}");
  expect(zh).toContain("意外的过度采样");
  expect(zh).toContain("从 2.8 亿参数的代理模型迁移到 80 亿参数模型");
  expect(zh).toContain("$w_k(t)$");
});

test("synthetic data remains a traceable derived source with scoped evidence", () => {
  expect(zh).toContain("## 把合成数据视为派生来源");
  expect(zh).toContain("不到一千万参数");
  expect(zh).toContain("13 亿参数模型");
  expect(zh).toContain("生成的词元并不会自动变得廉价、真实、新颖或有用");
  expect(zh).toContain("递归替换原始数据");
  expect(zh).toContain("保留原始数据的合成增强");
  expect(zh).toContain("父来源 ID");
});

test("decontamination protects a scoped evaluation claim", () => {
  expect(zh).toContain("## 去污染保护的是评估结论");
  expect(zh).toContain("去重问的是训练记录是否彼此重复");
  expect(zh).toContain("C_n(e,d)=\\frac{|G_n(e)\\cap G_n(d)|}{|G_n(e)|}");
  expect(zh).toContain("一份去污染报告只能证明检查过什么、移除了什么");
  expect(zh).toContain("不能在训练后从模型中追溯删除");
  expect(zh).toContain("使用不透明的记录 ID");
});

test("the manifest and eight validation checks make the corpus replayable", () => {
  expect(zh).toContain("## 让每条保留记录都可追溯");
  expect(zh).toContain("code_commit: <代码修订版本>");
  expect(zh).toContain("tombstones: <删除记录及受影响的派生项>");
  expect(zh).toContain("## 在完整训练前验证语料");
  for (const item of [
    "**阶段账目。**",
    "**人工审阅样本。**",
    "**分布比较。**",
    "**重复审计。**",
    "**污染审计。**",
    "**采样器测试。**",
    "**算力匹配的消融实验。**",
    "**回放与删除。**",
  ]) expect(zh).toContain(item);
  expect(zh).toContain("让模型学到的分布可以检查");
  expect(zh).not.toContain("# 模糊去重：按 LSH 分桶");
});
