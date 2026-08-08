import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const en = readFileSync(join(repoRoot, "en/foundations/03-tokenization.qmd"), "utf8");
const zh = readFileSync(join(repoRoot, "zh/foundations/03-tokenization.qmd"), "utf8");

test("Chapter 7 defines the tokenizer as a versioned interface, not a vocabulary", () => {
  expect(en).toContain("The artifact is more than a vocabulary");
  expect(zh).toContain("## 这件产物不只是一张词表");
  expect(zh).toContain("规范化、边界规则、字节处理、特殊词元、自动添加的前后缀和解码方式");
  expect(zh).toContain("完整契约，而不只是切分模型");
  expect(zh).toContain("E\\in\\mathbb{R}^{V\\times d}");
  expect(zh).toContain("W_{\\mathrm{out}}\\in\\mathbb{R}^{V\\times d}");
  expect(zh).toContain("改变已有 ID 的含义，就等于改变检查点中已有一行参数的含义");
});

test("BPE separates training from encoding and preserves deterministic ranks", () => {
  expect(zh).toContain("## BPE 学到的是合并优先级");
  expect(zh).toContain("@gls-bpe是这套构造的主力：它反复合并语料中最常见的相邻符号");
  for (const step of [
    "冻结的规范化和边界规则",
    "确定性的平局处理规则",
    "把这对符号追加到有序合并表",
  ]) expect(zh).toContain(step);
  expect(zh).toContain("训练和编码是两种不同的算法");
  expect(zh).toContain("编码时不会重新统计输入频率");
  expect(zh).toContain("`(l, o)` 出现四次");
  expect(zh).toContain("没有隐藏的平局");
  expect(zh).toContain("def encode_word(word):");
  expect(zh).toContain("(-counts[candidate], candidate)");
});

test("byte coverage, fallback, decoding, and normalization have explicit limits", () => {
  expect(zh).toContain("## 字节覆盖不等于高效覆盖");
  expect(zh).toContain("全部 256 个字节值");
  expect(zh).toContain("覆盖保证并不意味着编码一定很短");
  expect(zh).toContain("字节回退与字节级 BPE 有关，但两者并不相同");
  expect(zh).toContain("替换、严格失败和保留字节显示，是三种不同的契约");
  expect(zh).toContain("### 规范化会改变往返转换能保留什么");
  expect(zh).toContain("\\operatorname{Decode}(\\operatorname{Encode}(x))=N(x)");
  expect(zh).toContain("只有在 $N$ 保留相关差异时，结果才会等于原始的 $x$");
});

test("Unigram scores complete ordered segmentations", () => {
  expect(zh).toContain("## Unigram 为完整切分打分");
  expect(zh).toContain("P(z) &= \\prod_{j=1}^{m}p(z_j)");
  expect(zh).toContain("z^* &= \\arg\\max_{z\\in\\mathcal{S}(X)}P(z)");
  expect(zh).toContain("\\mathcal{L} &= \\sum_{X\\in D}\\log\\!\\sum_{z\\in\\mathcal{S}(X)}P(z)");
  expect(zh).toContain("$z=(z_1,\\ldots,z_m)$ 是 $X$ 的一种有序切分");
  expect(zh).toContain("动态规划可以求出 $z^*$");
  expect(zh).toContain("子词正则化");
  expect(zh).toContain("都不具有普适优势");
});

test("display equations use mobile-readable line breaks", () => {
  expect(zh).toContain("\\begin{aligned}");
  expect(zh).toContain("\\substack{\\text{输入与输出}");
});

test("vocabulary size accounts for sequence, parameters, logits, and mixture", () => {
  expect(zh).toContain("## 词表规模同时改变序列成本和模型成本");
  expect(zh).toContain("P_{\\mathrm{token}}=");
  expect(zh).toContain("Vd, & \\substack{\\text{输入与输出}\\\\\\text{权重绑定时}}");
  expect(zh).toContain("2Vd, & \\substack{\\text{输入与输出}\\\\\\text{权重不绑定时}}");
  expect(zh).toContain("不包含优化器状态、量化、分片开销和输出投影计算");
  expect(zh).toContain("不是一个可以迁移到所有训练任务的词表规模");
  expect(zh).toContain("分词器专用的训练混合分布");
  expect(zh).toContain("词元级困惑度不能直接比较两个分词器");
});

test("language and domain audits use a common source unit", () => {
  expect(zh).toContain("## 不只测压缩率，还要测语言和领域");
  expect(zh).toContain("p_{\\ell,i}=\\frac{|T(s_{\\ell,i})|}{|T(s_{r,i})|}");
  expect(zh).toContain("应报告整个分布，包括中位数和高分位数");
  expect(zh).toContain("固定的 $C$ 词元窗口大约只能容纳参考语言的 $1/p$");
  expect(zh).toContain("词元溢价只是一项指标，不是质量分数");
  for (const audit of [
    "每个 Unicode 标量值、字素簇和 UTF-8 字节对应的词元数",
    "未知词元率和字节回退率",
    "规范化碰撞和来源到词元的偏移准确率",
  ]) expect(zh).toContain(audit);
  expect(zh).toContain("没有证明存在一种普适最佳方案");
});

test("the compatibility manifest freezes control tokens and golden vectors", () => {
  expect(zh).toContain("## 冻结兼容性契约");
  expect(zh).toContain("特殊词元是模型的控制面输入");
  expect(zh).toContain("literal_text_policy: <作为普通文本、转义、允许或拒绝>");
  expect(zh).toContain("golden_vectors_sha256: <原始输入、规范化结果、ID、偏移和解码输出>");
  expect(zh).toContain("stable_id_prefix: <含义永远不得改变的 ID>");
  expect(zh).toContain("组合附加符号、兼容字符、重复空白、从右到左的文本");
  expect(zh).toContain("语料分片、模型配置、训练检查点、服务镜像和评估报告");
});

test("changing a tokenizer is treated as a checkpoint migration", () => {
  expect(zh).toContain("### 更换分词器是一项迁移");
  expect(zh).toContain("只追加的扩展可以保留所有旧 ID");
  expect(zh).toContain("仍需要初始化新增行并继续训练");
  expect(zh).toContain("必须精确重排相应的嵌入行和输出行");
  expect(zh).toContain("迁移需要证据，不能当作普通配置修改");
  expect(zh).toContain("仅有词元 ID 分片，无法恢复规范化、未知词元或解码清理已经抹掉的差异");
});

test("tokenizer-free systems move rather than erase segmentation work", () => {
  expect(zh).toContain("## 无分词器模型只是移动了边界");
  for (const system of ["| ByT5 |", "| CANINE |", "| MEGABYTE |", "| BLT |", "| H-Net |"]) {
    expect(zh).toContain(system);
  }
  expect(zh).toContain("并不意味着模型完全不做表示或压缩");
  expect(zh).toContain("截至其实验中的 80 亿参数设置");
  expect(zh).toContain("都不能证明它普遍优于固定分词");
  expect(zh).toContain("问题在于切分和压缩应该放在哪里");
});

test("eight validation gates close the tokenizer release", () => {
  expect(zh).toContain("## 在模型训练前完成验证");
  for (const item of [
    "**重放产物。**",
    "**运行黄金向量。**",
    "**审计覆盖率。**",
    "**审计长度。**",
    "**基准测试系统。**",
    "**消融模型质量。**",
    "**测试控制词元。**",
    "**核验交接。**",
  ]) expect(zh).toContain(item);
  expect(zh).toContain("显式的检查点迁移，而不是无声的预处理更新");
  expect(zh).not.toContain("fig-tokenization-bpe-merge");
  expect(zh).not.toContain("fig-tokenization-evolution");
});
