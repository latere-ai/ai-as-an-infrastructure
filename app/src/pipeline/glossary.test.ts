// Glossary rendering: first use in a chapter expands (term + English in parens),
// later uses show the short form; both link to the glossary page. zh always
// glosses with the English original; en only when an abbreviation differs.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGlossary, renderGloss, renderGlossaryPage, type GlossEntry, type GlossFirstUseMap } from "./glossary.ts";
import { renderMarkdown } from "./markdown.ts";

const moe: GlossEntry = { key: "moe", en: "mixture-of-experts", zh: "混合专家", abbr: "MoE" };
const rh: GlossEntry = { key: "reward-hacking", en: "reward hacking", zh: "奖励欺骗" };

test("zh first use expands to 中文（English）, later use is the abbr", () => {
  expect(renderGloss(moe, "zh", true, "../")).toContain("混合专家（MoE）");
  expect(renderGloss(moe, "zh", true, "../")).toContain('href="../glossary#gls-moe"');
  expect(renderGloss(moe, "zh", false, "../")).toContain(">MoE<");
  expect(renderGloss(moe, "zh", false, "../")).not.toContain("（");
});

test("en first use expands to term (ABBR), later use is the abbr", () => {
  expect(renderGloss(moe, "en", true, "")).toContain("mixture-of-experts (MoE)");
  expect(renderGloss(moe, "en", false, "")).toContain(">MoE<");
});

test("a term with no abbr: zh glosses with full English, en shows the term only", () => {
  expect(renderGloss(rh, "zh", true, "../")).toContain("奖励欺骗（reward hacking）");
  expect(renderGloss(rh, "zh", false, "../")).toContain(">奖励欺骗<"); // no abbr → full term
  expect(renderGloss(rh, "en", true, "")).toContain(">reward hacking<");
  expect(renderGloss(rh, "en", true, "")).not.toContain("("); // no parenthetical in en
});

test("glossary page lists only used terms, anchored by key", () => {
  const g = new Map([["moe", moe], ["reward-hacking", rh]]);
  const firstUses: GlossFirstUseMap = new Map([["moe", {
    key: "moe",
    href: "foundations/transformer-architecture",
    title: "Transformer 架构及其变体",
    chapterNum: "7",
    sentence: "混合专家（MoE） routes each token to a small subset of experts.",
  }]]);
  const html = renderGlossaryPage(g, new Set(["moe"]), firstUses, "zh");
  expect(html).toContain('<ul class="rdr-gls-list">');
  expect(html).toContain('<li class="rdr-gls-entry" id="gls-moe">');
  expect(html).toContain('id="gls-moe"');
  expect(html).toContain("混合专家");
  expect(html).toContain("首次出现：");
  expect(html).toContain('href="foundations/transformer-architecture"');
  expect(html).toContain("第 7 章 · Transformer 架构及其变体");
  expect(html).toContain('<p class="rdr-gls-explain">混合专家（MoE） routes each token to a small subset of experts.</p>');
  expect(html).not.toContain("奖励欺骗"); // not in the used set
});

test("a curated def wins over the first-use sentence, per language", () => {
  const e: GlossEntry = { key: "prefill", en: "prefill", zh: "预填充", defEn: "Reads the whole prompt in one compute-bound pass.", defZh: "一次读完整个提示词的算力受限阶段。" };
  const g = new Map([["prefill", e]]);
  const firstUses: GlossFirstUseMap = new Map([["prefill", {
    key: "prefill", href: "foundations/transformer-architecture", title: "T", chapterNum: "7", sentence: "This is prefill.",
  }]]);
  const en = renderGlossaryPage(g, new Set(["prefill"]), firstUses, "en");
  expect(en).toContain('<p class="rdr-gls-explain">Reads the whole prompt in one compute-bound pass.</p>');
  expect(en).not.toContain("This is prefill."); // def replaces the degenerate sentence
  const zh = renderGlossaryPage(g, new Set(["prefill"]), firstUses, "zh");
  expect(zh).toContain('<p class="rdr-gls-explain">一次读完整个提示词的算力受限阶段。</p>');
});

test("the page is ordered by first occurrence, not alphabetically", () => {
  const zee: GlossEntry = { key: "zee", en: "zebra", zh: "斑马" };
  const ay: GlossEntry = { key: "ay", en: "apple", zh: "苹果" };
  const g = new Map([["zee", zee], ["ay", ay]]);
  // zebra is met first (Chapter 1), apple later (Chapter 9); alphabetical would
  // flip them, occurrence order must keep zebra first.
  const firstUses: GlossFirstUseMap = new Map([
    ["zee", { key: "zee", href: "a", title: "T", chapterNum: "1", sentence: "" }],
    ["ay", { key: "ay", href: "b", title: "T", chapterNum: "9", sentence: "" }],
  ]);
  const html = renderGlossaryPage(g, new Set(["zee", "ay"]), firstUses, "en");
  expect(html.indexOf("gls-zee")).toBeLessThan(html.indexOf("gls-ay"));
});

test("a degenerate first-use sentence is suppressed when there is no def", () => {
  const e: GlossEntry = { key: "prefill", en: "prefill", zh: "预填充" };
  const g = new Map([["prefill", e]]);
  const firstUses: GlossFirstUseMap = new Map([["prefill", {
    key: "prefill", href: "x", title: "T", chapterNum: "7", sentence: "This is prefill.",
  }]]);
  expect(renderGlossaryPage(g, new Set(["prefill"]), firstUses, "en")).not.toContain("rdr-gls-explain");
});

test("rendering records the first book occurrence sentence and does not overwrite it", () => {
  const glossary = new Map([["moe", moe]]);
  const used = new Set<string>();
  const firstUses: GlossFirstUseMap = new Map();
  const common = {
    bib: { entries: new Map(), cited: new Set<string>() },
    xref: new Map([["sec-next", { kind: "sec" as const, label: "Chapter 2", href: "foundations/two#sec-next" }]]),
    prefix: "",
    graphviz: {} as any,
    lang: "en" as const,
    glossary,
    glossaryUsed: used,
    glossaryFirstUses: firstUses,
  };

  renderMarkdown("# One\n\nSetup sentence. Hubinger et al. trained **@gls-moe**: models route best-of-N near @sec-next. This later sentence should stay out.", {
    ...common,
    currentHref: "foundations/one",
    chapterTitle: "One",
    chapterNum: "1",
    glossarySeen: new Set(),
  });
  renderMarkdown("# Two\n\n@gls-moe appears again in a later chapter.", {
    ...common,
    currentHref: "foundations/two",
    chapterTitle: "Two",
    chapterNum: "2",
    glossarySeen: new Set(),
  });

  expect(used.has("moe")).toBe(true);
  expect(firstUses.get("moe")).toEqual({
    key: "moe",
    href: "foundations/one",
    title: "One",
    chapterNum: "1",
    sentence: "Hubinger et al. trained mixture-of-experts (MoE): models route best-of-N near Chapter 2.",
  });
});

test("zh first occurrence sentence starts after full-width punctuation without whitespace", () => {
  const glossary = new Map([["moe", moe]]);
  const firstUses: GlossFirstUseMap = new Map();
  renderMarkdown("# 一\n\n前一句。这里是**@gls-moe**。后一句。", {
    bib: { entries: new Map(), cited: new Set<string>() },
    xref: new Map(),
    currentHref: "foundations/one",
    chapterTitle: "一",
    chapterNum: "1",
    prefix: "",
    graphviz: {} as any,
    lang: "zh",
    glossary,
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: firstUses,
  });

  expect(firstUses.get("moe")?.sentence).toBe("这里是混合专家（MoE）。");
});

const both = (en: string, zh: string) => [en, zh];

const auditedGlossaryTerms = [
  {
    key: "scaling-law",
    en: "scaling law",
    zh: "扩展律",
    files: [
      "en/orientation/02-field-map.qmd",
      "zh/orientation/02-field-map.qmd",
      "en/foundations/01-scaling-laws.qmd",
      "zh/foundations/01-scaling-laws.qmd",
    ],
  },
  { key: "next-token-prediction", en: "next-token prediction", zh: "下一词元预测", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "cross-entropy", en: "cross-entropy", zh: "交叉熵", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "perplexity", en: "perplexity", zh: "困惑度", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "compute-optimal", en: "compute-optimal", zh: "计算最优", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "adamw", en: "AdamW", zh: "AdamW 优化器", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "warmup-stable-decay", en: "warmup-stable-decay", zh: "预热-稳定-衰减调度", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "z-loss", en: "z-loss", zh: "z-loss 正则", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "qk-norm", en: "query-key normalization", zh: "查询-键归一化", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "gradient-clipping", en: "gradient clipping", zh: "梯度裁剪", files: both("en/foundations/01-scaling-laws.qmd", "zh/foundations/01-scaling-laws.qmd") },
  { key: "minhash", en: "MinHash", zh: "最小哈希", files: both("en/foundations/02-data-curation.qmd", "zh/foundations/02-data-curation.qmd") },
  { key: "decontamination", en: "decontamination", zh: "去污染", files: both("en/foundations/02-data-curation.qmd", "zh/foundations/02-data-curation.qmd") },
  { key: "tokenizer", en: "tokenizer", zh: "分词器", files: both("en/foundations/03-tokenization.qmd", "zh/foundations/03-tokenization.qmd") },
  { key: "sentencepiece", en: "SentencePiece", zh: "SentencePiece 分词器", files: both("en/foundations/03-tokenization.qmd", "zh/foundations/03-tokenization.qmd") },
  { key: "tokenizer-free", en: "tokenizer-free", zh: "无分词器方案", files: both("en/foundations/03-tokenization.qmd", "zh/foundations/03-tokenization.qmd") },
  { key: "residual-stream", en: "residual stream", zh: "残差流", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "rmsnorm", en: "root mean square layer normalization", zh: "均方根层归一化", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "rope", en: "rotary position embedding", zh: "旋转位置嵌入", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "swiglu", en: "Swish-gated linear unit", zh: "Swish 门控线性单元", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "flashattention", en: "FlashAttention", zh: "FlashAttention 注意力内核", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "zero", en: "Zero Redundancy Optimizer", zh: "零冗余优化器", files: both("en/foundations/06-training-at-scale.qmd", "zh/foundations/06-training-at-scale.qmd") },
  { key: "fsdp", en: "fully sharded data parallel", zh: "全分片数据并行", files: both("en/foundations/06-training-at-scale.qmd", "zh/foundations/06-training-at-scale.qmd") },
  { key: "prefill", en: "prefill", zh: "预填充", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "decode", en: "decode", zh: "解码", files: both("en/foundations/04-transformer-architecture.qmd", "zh/foundations/04-transformer-architecture.qmd") },
  { key: "goodput", en: "goodput", zh: "有效吞吐量", files: both("en/inference/01-serving-problem.qmd", "zh/inference/01-serving-problem.qmd") },
  { key: "continuous-batching", en: "continuous batching", zh: "连续批处理", files: both("en/inference/01-serving-problem.qmd", "zh/inference/01-serving-problem.qmd") },
  { key: "pagedattention", en: "PagedAttention", zh: "PagedAttention 分页注意力", files: both("en/inference/01-serving-problem.qmd", "zh/inference/01-serving-problem.qmd") },
  { key: "prefix-caching", en: "prefix caching", zh: "前缀缓存", files: both("en/inference/02-memory-scheduling.qmd", "zh/inference/02-memory-scheduling.qmd") },
  { key: "dram", en: "dynamic random-access memory", zh: "动态随机存取存储器", files: both("en/inference/02-memory-scheduling.qmd", "zh/inference/02-memory-scheduling.qmd") },
  { key: "speculative-decoding", en: "speculative decoding", zh: "推测解码", files: both("en/inference/03-faster-decoding.qmd", "zh/inference/03-faster-decoding.qmd") },
  { key: "sram", en: "static random-access memory", zh: "静态随机存取存储器", files: both("en/inference/04-quantization-kernels.qmd", "zh/inference/04-quantization-kernels.qmd") },
  { key: "constrained-decoding", en: "constrained decoding", zh: "约束解码", files: both("en/inference/05-structured-long-context.qmd", "zh/inference/05-structured-long-context.qmd") },
  { key: "fsm", en: "finite-state machine", zh: "有限状态机", files: both("en/inference/05-structured-long-context.qmd", "zh/inference/05-structured-long-context.qmd") },
  { key: "attention-sink", en: "attention sink", zh: "注意力汇", files: both("en/inference/05-structured-long-context.qmd", "zh/inference/05-structured-long-context.qmd") },
  { key: "sde", en: "stochastic differential equation", zh: "随机微分方程", files: both("en/generative/01-diffusion-flow-matching.qmd", "zh/generative/01-diffusion-flow-matching.qmd") },
  { key: "ode", en: "ordinary differential equation", zh: "常微分方程", files: both("en/generative/01-diffusion-flow-matching.qmd", "zh/generative/01-diffusion-flow-matching.qmd") },
  { key: "autoregression", en: "autoregression", zh: "自回归", files: both("en/generative/02-nar-diffusion-lms.qmd", "zh/generative/02-nar-diffusion-lms.qmd") },
  { key: "non-autoregressive", en: "non-autoregressive generation", zh: "非自回归生成", files: both("en/generative/02-nar-diffusion-lms.qmd", "zh/generative/02-nar-diffusion-lms.qmd") },
  { key: "dual-encoder", en: "dual-encoder", zh: "双编码器", files: both("en/orchestration/06-rag-retrieval.qmd", "zh/orchestration/06-rag-retrieval.qmd") },
  { key: "bm25", en: "BM25", zh: "BM25 稀疏检索", files: both("en/orchestration/06-rag-retrieval.qmd", "zh/orchestration/06-rag-retrieval.qmd") },
  { key: "hnsw", en: "hierarchical navigable small-world", zh: "分层可导航小世界图", files: both("en/orchestration/06-rag-retrieval.qmd", "zh/orchestration/06-rag-retrieval.qmd") },
  { key: "hybrid-search", en: "hybrid search", zh: "混合搜索", files: both("en/orchestration/06-rag-retrieval.qmd", "zh/orchestration/06-rag-retrieval.qmd") },
  { key: "cross-encoder", en: "cross-encoder", zh: "交叉编码器", files: both("en/orchestration/06-rag-retrieval.qmd", "zh/orchestration/06-rag-retrieval.qmd") },
  { key: "private-test-set", en: "private test set", zh: "私有测试集", files: both("en/evaluation/04-judging-holistic.qmd", "zh/evaluation/04-judging-holistic.qmd") },
  { key: "pairwise-comparison", en: "pairwise comparison", zh: "成对比较", files: both("en/evaluation/04-judging-holistic.qmd", "zh/evaluation/04-judging-holistic.qmd") },
  { key: "pass-at-k", en: "pass@k", zh: "至少一次成功率", files: both("en/evaluation/06-evaluating-agents.qmd", "zh/evaluation/06-evaluating-agents.qmd") },
  { key: "over-refusal", en: "over-refusal", zh: "过度拒绝", files: both("en/adaptation/01-sft-peft.qmd", "zh/adaptation/01-sft-peft.qmd") },
  { key: "adversarial-robustness", en: "adversarial robustness", zh: "对抗鲁棒性", files: both("en/safety/05-adversarial-robustness.qmd", "zh/safety/05-adversarial-robustness.qmd") },
  { key: "human-in-the-loop", en: "human-in-the-loop", zh: "人在回路中", files: both("en/practice/11-human-interface-oversight.qmd", "zh/practice/11-human-interface-oversight.qmd") },
  { key: "calibrated-reliance", en: "calibrated reliance", zh: "校准后的依赖", files: both("en/practice/11-human-interface-oversight.qmd", "zh/practice/11-human-interface-oversight.qmd") },
  { key: "automation-bias", en: "automation bias", zh: "自动化偏差", files: both("en/practice/11-human-interface-oversight.qmd", "zh/practice/11-human-interface-oversight.qmd") },
  { key: "gpu", en: "graphics processing unit", zh: "图形处理器", files: both("en/infrastructure/01-accelerators-networking.qmd", "zh/infrastructure/01-accelerators-networking.qmd") },
  { key: "tpu", en: "tensor processing unit", zh: "张量处理器", files: both("en/infrastructure/01-accelerators-networking.qmd", "zh/infrastructure/01-accelerators-networking.qmd") },
  { key: "rdma", en: "remote direct memory access", zh: "远程直接内存访问", files: both("en/infrastructure/01-accelerators-networking.qmd", "zh/infrastructure/01-accelerators-networking.qmd") },
  { key: "ocr", en: "optical character recognition", zh: "光学字符识别", files: both("en/practice/06-retrieval-and-documents.qmd", "zh/practice/06-retrieval-and-documents.qmd") },
  { key: "virtual-key", en: "virtual key", zh: "虚拟密钥", files: both("en/practice/05-agents-and-sandboxes.qmd", "zh/practice/05-agents-and-sandboxes.qmd") },
];

test("book-level glossary audit terms are defined and introduced", () => {
  const repoRoot = new URL("../../../", import.meta.url).pathname;
  const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

  for (const term of auditedGlossaryTerms) {
    expect(glossary.get(term.key)).toMatchObject({ en: term.en, zh: term.zh });
    for (const rel of term.files) {
      expect(readFileSync(join(repoRoot, rel), "utf8")).toContain(`@gls-${term.key}`);
    }
  }
});
