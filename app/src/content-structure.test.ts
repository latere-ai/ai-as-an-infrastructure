import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

function flat(p: string) {
  return src(p).replace(/\s+/g, " ");
}

// README's outline is wrapped prose whose part titles are links to the site.
// Assertions below track content, not layout, so they match against text with
// the line wrapping collapsed and the link syntax unwrapped: reflowing a
// paragraph or linking a title must not turn a doc edit into a red build.
function outline(p: string) {
  return flat(p).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function qmdPaths(dir: string): string[] {
  const base = new URL("../../" + dir + "/", import.meta.url);
  const out: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...qmdPaths(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
}

test("human-interface oversight is wired into both book manifests before the data engine", () => {
  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    const oversight = yml.indexOf("practice/11-human-interface-oversight.qmd");
    const data = yml.indexOf("practice/12-production-data-engine.qmd");
    expect(oversight).toBeGreaterThan(0);
    expect(data).toBeGreaterThan(oversight);
    expect(yml).not.toContain("practice/11-production-data-engine.qmd");
  }
});

test("the human-interface chapter closes the recorded content gap", () => {
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Product / UX / human-interface layer**");
  for (const lang of ["en", "zh"]) {
    expect(src(`${lang}/practice/index.qmd`)).toContain("@sec-human-interface-oversight");
    expect(src(`${lang}/orientation/02-field-map.qmd`)).toContain("@sec-human-interface-oversight");
    expect(src(`${lang}/practice/11-human-interface-oversight.qmd`)).toContain("{#sec-human-interface-oversight}");
  }
  expect(outline("README.md")).toContain("human oversight surfaces");
});

test("practice and operations closes with operating contracts in both languages", () => {
  const expected = [
    "practice/01-choosing-a-model.qmd",
    "practice/02-serving-and-compute.qmd",
    "practice/03-edge-on-device.qmd",
    "practice/04-training-finetuning-practice.qmd",
    "practice/05-agents-and-sandboxes.qmd",
    "practice/06-retrieval-and-documents.qmd",
    "practice/07-evaluation-and-observability.qmd",
    "practice/08-wiring-a-2026-stack.qmd",
    "practice/09-deployment-lifecycle.qmd",
    "practice/10-reliability-nondeterministic.qmd",
    "practice/11-human-interface-oversight.qmd",
    "practice/12-production-data-engine.qmd",
    "practice/13-operating-contracts.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    expect(src(`${lang}/practice/index.qmd`)).toContain("@sec-operating-contracts");
    expect(src(`${lang}/orientation/02-field-map.qmd`)).toContain("@sec-operating-contracts");
    expect(src(`${lang}/practice/13-operating-contracts.qmd`)).toContain("{#sec-operating-contracts}");
  }
});

test("operating contracts are tracked in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("operating contracts for SLOs, cost governance, incidents, and multi-tenancy");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Operating contracts and infrastructure operations**");
  expect(src("en/index.qmd")).toContain("SLOs, cost governance, incidents");
  expect(src("zh/index.qmd")).toContain("SLO、成本治理、事故");
  expect(src("en/summary.qmd")).toContain("operating contracts turn SLOs");
  expect(src("zh/summary.qmd")).toContain("运营契约把 SLO");
});

test("ecosystem and economics is a full six-chapter part in both languages", () => {
  expect(src("CONTENT-GAPS.md")).toContain("# Content Gap Ledger");
  expect(src("CONTENT-GAPS.md")).not.toContain("# Content TODOs");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Ecosystem and economics depth**");

  const expansionRecord = src("zh/ecosystem/EXPANSION-RECORD.md");
  expect(expansionRecord).toContain("第十部分现在由六章组成");
  expect(expansionRecord).toContain("不再作为待办计划使用");
  expect(expansionRecord).not.toContain("第十部分现在有三章");
  expect(expansionRecord).not.toContain("更新 `zh/book.yml`");

  const expected = [
    "ecosystem/01-model-landscape.qmd",
    "ecosystem/03-tooling-ecosystem.qmd",
    "ecosystem/04-economics.qmd",
    "ecosystem/05-market-structure.qmd",
    "ecosystem/06-adoption-productivity.qmd",
    "ecosystem/07-data-rights-economics.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/ecosystem/index.qmd`);
    for (const section of [
      "@sec-model-landscape",
      "@sec-tooling-ecosystem",
      "@sec-economics",
      "@sec-market-structure",
      "@sec-adoption-productivity",
      "@sec-data-rights-economics",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("evaluation is a full seven-chapter measurement part in both languages", () => {
  const expected = [
    "evaluation/01-benchmarks.qmd",
    "evaluation/02-statistical-reliability.qmd",
    "evaluation/03-human-evaluation-rubrics.qmd",
    "evaluation/04-judging-holistic.qmd",
    "evaluation/05-factuality-grounding.qmd",
    "evaluation/06-evaluating-agents.qmd",
    "evaluation/07-operational-evaluation.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/evaluation/index.qmd`);
    for (const section of [
      "@sec-benchmarks",
      "@sec-statistical-reliability",
      "@sec-human-evaluation-rubrics",
      "@sec-judging-holistic",
      "@sec-factuality-grounding",
      "@sec-evaluating-agents",
      "@sec-operational-evaluation",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded ecosystem part is reflected in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("market structure");
  expect(outline("README.md")).toContain("adoption and productivity");
  expect(outline("README.md")).toContain("data rights");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Ecosystem and economics depth**");
});

test("the expanded evaluation part is tracked in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("statistical reliability");
  expect(outline("README.md")).toContain("operational governance");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Evaluation depth and governance**");
});

test("post-training adaptation is a full seven-chapter part in both languages", () => {
  const expected = [
    "adaptation/01-sft-peft.qmd",
    "adaptation/02-behavior-specs-preference-data.qmd",
    "adaptation/03-rlhf-reward-modeling.qmd",
    "adaptation/04-dpo-variants.qmd",
    "adaptation/05-verifiable-rewards-reasoning.qmd",
    "adaptation/06-safety-tuning-instruction-hierarchy.qmd",
    "adaptation/07-synthetic-data-self-improvement.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/adaptation/index.qmd`);
    for (const section of [
      "@sec-sft-peft",
      "@sec-behavior-specs",
      "@sec-rlhf",
      "@sec-dpo-variants",
      "@sec-verifiable-rewards",
      "@sec-safety-tuning",
      "@sec-synthetic-data",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded adaptation part is tracked in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("behavior specifications");
  expect(outline("README.md")).toContain("verifiable rewards");
  expect(outline("README.md")).toContain("instruction hierarchy");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Post-training adaptation and alignment depth**");
});

test("base model formation ends with a mid-training bridge chapter", () => {
  const expected = [
    "foundations/01-scaling-laws.qmd",
    "foundations/02-data-curation.qmd",
    "foundations/03-tokenization.qmd",
    "foundations/04-transformer-architecture.qmd",
    "foundations/05-moe-ssm-hybrids.qmd",
    "foundations/06-training-at-scale.qmd",
    "foundations/07-mid-training.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/foundations/index.qmd`);
    for (const section of [
      "@sec-scaling-laws",
      "@sec-data-curation",
      "@sec-tokenization",
      "@sec-transformer-architecture",
      "@sec-moe-ssm-hybrids",
      "@sec-training-at-scale",
      "@sec-mid-training",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("mid-training defines operational boundaries and measurable transfer", () => {
  const chapter = flat("en/foundations/07-mid-training.qmd");

  for (const contract of [
    "A training run is an ordered sequence of phases, not an unordered set",
    "A mid-training phase can be continued pretraining",
    "\\bar\\alpha=\\frac{1}{T}\\sum_{t=1}^{T}\\alpha_t",
    "Annealing” is used for two different choices",
    "progressed from 4K through 32K, 65,536, 131,072, and 262,144 tokens",
    "Trained length",
    "Accepted length",
    "Effective length",
    "Deployable length",
    "loss on a frozen held-out sample from broad distribution $P$",
  ]) {
    expect(chapter).toContain(contract);
  }

  expect(chapter).not.toContain("timing more important than the exact mixture weight");
  expect(chapter).not.toContain("reach 1M-token contexts without giving up short-context performance");
});

test("scaling laws explain training tokens inline at first use", () => {
  expect(flat("en/foundations/01-scaling-laws.qmd")).toContain(
    "@gls-training-tokens are not vocabulary entries",
  );
  expect(flat("en/foundations/01-scaling-laws.qmd")).toContain("repeated passes over the same text count again");
  expect(flat("zh/foundations/01-scaling-laws.qmd")).toContain("训练词元不是词表项");
  expect(flat("zh/foundations/01-scaling-laws.qmd")).toContain("同一段文本如果重复训练两轮，就计两次");
});

test("high-friction glossary terms explain themselves in the reading flow", () => {
  const required = [
    ["en/foundations/04-transformer-architecture.qmd", "The first pass is **@gls-prefill**: it reads the entire prompt"],
    ["zh/foundations/04-transformer-architecture.qmd", "第一遍就是 **@gls-prefill** 阶段：它一次读完整个提示词"],
    ["zh/foundations/06-training-at-scale.qmd", "*@gls-tp*先切开单层内部的矩阵乘法"],
    ["en/ecosystem/04-economics.qmd", "Training is a @gls-capex: a capital-style, one-time spend"],
    ["zh/ecosystem/04-economics.qmd", "训练是一笔@gls-capex：像资本开支一样一次性付出"],
    ["en/safety/01-mechanistic-interpretability.qmd", "The hypothesis is @gls-superposition: a model represents more features than it has dimensions"],
    ["zh/safety/01-mechanistic-interpretability.qmd", "这个假说叫@gls-superposition：模型之所以能表示多于自身维度的特征"],
    ["en/safety/02-scalable-oversight-control.qmd", "The answer is @gls-deceptive-alignment: the possibility that a model can appear aligned under training"],
    ["zh/safety/02-scalable-oversight-control.qmd", "答案是@gls-deceptive-alignment：模型可能在训练与评测下表现得像是对齐"],
    ["en/practice/11-human-interface-oversight.qmd", "It may have created @gls-automation-bias: people over-accepting automated advice"],
    ["zh/practice/11-human-interface-oversight.qmd", "它也可能制造 @gls-automation-bias：人会过度接受自动化建议"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should keep an inline explanation for ${snippet}`).toContain(snippet);
  }
});

test("specialized practice terms get local definitions before use", () => {
  const required = [
    ["en/foundations/01-scaling-laws.qmd", "the @gls-compute-optimal $N$ and $D$: the pair with the lowest predicted loss"],
    ["zh/foundations/01-scaling-laws.qmd", "@gls-compute-optimal的 $N$ 与 $D$，也就是预测损失最低的那组参数量与词元数"],
    ["zh/foundations/07-mid-training.qmd", "**相对 @gls-continued-pretraining。** 继续预训练是把已有模型继续拿下一词元目标训练"],
    ["en/practice/06-retrieval-and-documents.qmd", "**Classic CV and @gls-ocr pipelines.** Here OCR means recognizing text from pixels"],
    ["zh/practice/06-retrieval-and-documents.qmd", "**经典 CV 与 @gls-ocr 流水线。** 这里的 OCR 是从像素里识别文字"],
    ["en/safety/02-scalable-oversight-control.qmd", "@gls-weak-to-strong generalization asks whether weak labels can elicit stronger latent capability"],
    ["zh/safety/02-scalable-oversight-control.qmd", "@gls-weak-to-strong泛化问的是：弱标注能否引出强模型里已经潜伏的能力"],
    ["en/practice/05-agents-and-sandboxes.qmd", "a @gls-virtual-key issued by a @gls-gateway"],
    ["zh/practice/05-agents-and-sandboxes.qmd", "模型走由@gls-gateway签发的@gls-virtual-key"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} locally`).toContain(snippet);
  }
});

test("abbreviations and decoding methods are defined at first use", () => {
  const required = [
    ["en/infrastructure/01-accelerators-networking.qmd", "the @gls-hbm sitting beside the accelerator die"],
    ["zh/infrastructure/01-accelerators-networking.qmd", "紧贴加速器裸片的@gls-hbm供给单块芯片"],
    ["en/inference/03-faster-decoding.qmd", "@gls-speculative-decoding is the exact version of that pattern"],
    ["zh/inference/03-faster-decoding.qmd", "@gls-speculative-decoding就是这个模式的精确版本"],
    ["en/generative/03-speech-and-voice.qmd", "@gls-tts, the task of synthesizing speech from text"],
    ["zh/generative/03-speech-and-voice.qmd", "@gls-tts，也就是把文字合成为语音的任务"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} at first use`).toContain(snippet);
  }
});

test("early-book glossary first uses are readable without leaving the page", () => {
  const required = [
    ["en/orientation/01-whole-stack.qmd", "a @gls-moe model that activates only a few expert sub-networks"],
    ["zh/orientation/01-whole-stack.qmd", "DeepSeek-V3 是@gls-moe模型，也就是每个词元只激活少数专家子网络的模型"],
    ["en/orientation/01-whole-stack.qmd", "with @gls-mla, an attention design that shrinks the inference-time cache"],
    ["zh/orientation/01-whole-stack.qmd", "配上@gls-mla这种压缩推断时缓存的注意力设计"],
    ["en/orientation/02-field-map.qmd", "@gls-scaling-law, an empirical formula that predicts loss from model size, data, and compute"],
    ["zh/orientation/02-field-map.qmd", "@gls-scaling-law 给训练定规模，也就是用一条把损失同模型规模、数据量与算力联系起来的经验公式"],
    ["en/orientation/03-borrowed-ideas.qmd", "@gls-arithmetic-coding, which turns sequence probabilities into one near-optimal bit stream"],
    ["zh/orientation/03-borrowed-ideas.qmd", "@gls-arithmetic-coding把带小数概率的符号写成一条近似最优的比特码流"],
    ["en/orientation/03-borrowed-ideas.qmd", "@gls-two-part-code, an accounting that charges for the model description"],
    ["zh/orientation/03-borrowed-ideas.qmd", "用@gls-two-part-code来算，也就是先付模型描述长度"],
    ["en/foundations/01-scaling-laws.qmd", "@gls-cross-entropy: it measures the model's surprise on a fixed held-out distribution"],
    ["en/foundations/06-training-at-scale.qmd", "PyTorch @gls-fsdp applies this full sharding idea to wrapped modules"],
    ["zh/foundations/06-training-at-scale.qmd", "PyTorch @gls-fsdp 则是同一全分片思路的原生版本"],
    ["en/foundations/07-mid-training.qmd", "@gls-sft on demonstrations, @gls-dpo from chosen-versus-rejected preferences"],
    ["zh/foundations/07-mid-training.qmd", "在示范数据上做@gls-sft，从胜出与被拒回复的偏好里做@gls-dpo"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should keep early first-use explanation: ${snippet}`).toContain(snippet);
  }
});

test("training at scale states its accounting and recovery contracts", () => {
  const chapter = flat("en/foundations/06-training-at-scale.qmd");

  for (const contract of [
    "B_{\\mathrm{global}} = DmB_\\mu",
    "Persistent bytes per device",
    "The table is a *persistent-state* estimate, not a peak-memory estimate",
    "f_{\\mathrm{bubble}}=\\frac{p-1}{m+p-1}",
    "The formula is useful for sizing, not prediction",
    "N = D T p C",
    "Steady-state MFU commonly excludes restart time",
    "*Deterministic replay*",
    "*Coverage-equivalent resume*",
    "M_{\\mathrm{score}} = BHL^2b",
  ]) {
    expect(chapter, `missing training contract: ${contract}`).toContain(contract);
  }

  expect(chapter).not.toContain("a handful of micro-batches is usually enough");
  expect(chapter).not.toContain("fp32 master weights are non-negotiable");
  expect(chapter).not.toContain("letting the context grow nearly without bound");
});

test("borrowed-ideas chapter distinguishes evidence from analogy", () => {
  const chapter = src("en/orientation/03-borrowed-ideas.qmd");

  for (const relationship of [
    "Formal identity",
    "Computational correspondence",
    "Mathematical import",
    "Heuristic analogy",
  ]) {
    expect(chapter).toContain(relationship);
  }

  for (const test of ["Mapping:", "Preservation:", "Transfer:", "Boundary:"]) {
    expect(chapter).toContain(test);
  }

  expect(chapter).toContain("\\delta_t=r_{t+1}+\\gamma V_w(s_{t+1})-V_w(s_t)");
  expect(chapter).not.toContain("/figures/borrowed-ideas-1.svg");
  expect(chapter).not.toContain("fire in proportion to exactly that quantity");
  expect(chapter).not.toContain("training minimizes description length");
});

test("infrastructure-before separates inherited practice from workload differences", () => {
  const chapter = src("en/orientation/04-infrastructure-before.qmd");

  for (const heading of [
    "## One request through the older stack",
    "## What transferred",
    "## Offline improvement is not product improvement",
    "## Why serving changed",
    "## What remains outside this book's scope",
    "## Where the stacks are beginning to combine",
    "## The boundary for the rest of the book",
  ]) {
    expect(chapter).toContain(heading);
  }

  for (const stage of ["Candidate generation", "Ranking", "Logging and experimentation"]) {
    expect(chapter).toContain(stage);
  }

  expect(chapter).toContain("M_{\\mathrm{KV}}\\approx 2L H_{\\mathrm{KV}}d_h S b");
  expect(chapter).toContain("fig-infrastructure-before-funnels");
  expect(chapter).not.toContain("np.argsort");
  expect(chapter).not.toContain("computationally, an inversion of a transformer");
  expect(chapter).not.toContain("at civilizational sample size");
  expect(chapter).not.toContain("far ahead in measured trust");
});

test("data curation separates acquisition, retention, sampling, and evaluation contracts", () => {
  const chapter = src("en/foundations/02-data-curation.qmd");

  for (const heading of [
    "## The run consumes a distribution, not a folder",
    "## Build lineage into every stage",
    "## Decide whether a source may enter",
    "## Deduplicate at the unit that matters",
    "## Quality is a measured property",
    "## Turn retained sources into sampled tokens",
    "## Treat synthetic data as a derived source",
    "## Decontamination protects an evaluation claim",
    "## Make every accepted record traceable",
    "## Validate the corpus before the full run",
  ]) {
    expect(chapter).toContain(heading);
  }

  expect(chapter).toContain("P_{\\mathrm{train}}(x)");
  expect(chapter).toContain("P_{\\mathrm{candidate}}(s)");
  expect(chapter).toContain("C_n(e,d)");
  expect(chapter).toContain("registry_digest:");
  expect(chapter).toContain("@longpre2023provenance");
  expect(chapter).toContain("@li2024dclm");

  for (const rejected of [
    "single biggest lever",
    "bias-light",
    "classifier filters are learned",
    "Scale camp",
    "Quality camp",
    "byte-identical shards",
    "a * s % universe",
    "if not seen.query(sig)",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  expect(src("figures-src/data-curation-1.py")).not.toContain("MinHash + LSH ≈ O(n)");
});

test("tokenization defines a reproducible interface rather than only a vocabulary", () => {
  const chapter = src("en/foundations/03-tokenization.qmd");

  for (const heading of [
    "## The artifact is more than a vocabulary",
    "## BPE learns merge priorities",
    "## Byte coverage is not efficient coverage",
    "## Unigram scores complete segmentations",
    "## Vocabulary size changes both sequence and model cost",
    "## Measure languages and domains, not only compression",
    "## Freeze the compatibility contract",
    "## Tokenizer-free models move the boundary",
    "## Validate before model training",
  ]) {
    expect(chapter).toContain(heading);
  }

  for (const contract of [
    "\\operatorname{Decode}(\\operatorname{Encode}(x))=N(x)",
    "P(z)=\\prod",
    "P_{\\mathrm{token}}",
    "p_{\\ell,i}=",
    "artifact_sha256:",
    "golden_vectors_sha256:",
    "@radford2019language",
    "@petrov2023language",
    "@xue2022byt5",
  ]) {
    expect(chapter).toContain(contract);
  }

  for (const rejected of [
    "cannot change without retraining",
    "single component you cannot change",
    "bag of subword pieces",
    "most current frontier tokenizers",
    "exact and reversible",
    "set entirely here",
    "Corpus is low low low",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  expect(src("figures-src/tokenization-1.py")).not.toContain("arbitrary units");
  expect(src("figures-src/tokenization-2.py")).not.toContain("illustrative, not measured");
});

test("transformer architecture separates equations, cache state, and kernels", () => {
  const chapter = src("en/foundations/04-transformer-architecture.qmd");

  for (const heading of [
    "## Scope: a causal decoder",
    "## A block updates one residual stream twice",
    "## Normalization controls scale",
    "## The feed-forward network supplies per-position capacity",
    "## Causal self-attention with explicit shapes",
    "## Position enters through queries and keys",
    "## Prefill creates the cache; decode reuses it",
    "## MHA, GQA, and MQA change KV-head sharing",
    "## MLA changes the cached representation",
    "## Separate arithmetic, temporary memory, and persistent state",
    "## Record the architecture as a contract",
    "## Validate before the full training run",
  ]) {
    expect(chapter).toContain(heading);
  }

  for (const contract of [
    "p(t_{i+1}=v\\mid t_{\\le i})",
    "\\operatorname{RMSNorm}(x)",
    "\\operatorname{SwiGLU}(x)",
    "M_{ij}=-\\infty",
    "M_{\\mathrm{KV}}",
    "M_{\\mathrm{MLA}}",
    "cached equivalence",
    "@ainslie2023gqa",
    "@dao2022flashattention",
    "@deepseek2025v32",
  ]) {
    expect(chapter).toContain(contract);
  }

  for (const rejected of [
    "Three questions the field has closed",
    "The one cost that stays open",
    "answered and closed",
    "Knowledge lives mostly in the MLP",
    "zeros the upper triangle",
    "at long context it overtakes",
    "MQA can destabilize training",
    "its successor, DeepSeek sparse attention",
    "most open models use GQA",
    "nearly every open dense model",
    "None of these change what attention computes",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  expect(src("figures-src/transformer-architecture-1.py")).toContain(
    "7_000_000_000 * 2 / 2**30",
  );
  expect(src("figures-src/transformer-architecture-1.py")).not.toContain(
    "relative units",
  );
});

test("MoE and recurrent architectures separate parameters, routing, and state", () => {
  const chapter = src("en/foundations/05-moe-ssm-hybrids.qmd");

  for (const heading of [
    "## Two independent architecture axes",
    "## MoE routes tokens through conditional FFNs",
    "## State-space layers replace a growing history with a recurrence",
    "## Hybrids choose a layer schedule",
    "## Record sparse and recurrent architecture as a contract",
    "## Validate each axis before scaling",
  ]) {
    expect(chapter).toContain(heading);
  }

  for (const contract of [
    "P_{\\mathrm{stored}}",
    "C_e=\\left\\lceil c\\frac{kT}{E}\\right\\rceil",
    "\\mathcal{L}_{\\mathrm{bal}}",
    "\\mathcal{L}_{z}",
    "(\\Delta_t,B_t,C_t)=s_\\theta(x_t)",
    "M_{\\mathrm{rec}}",
    "@gale2023megablocks",
    "@minimax2025m2attention",
  ]) {
    expect(chapter).toContain(contract);
  }

  for (const rejected of [
    "capacity and knowledge",
    "total parameters scale capacity and knowledge",
    "the only way to know more is to compute more",
    "This tiny map is the only genuinely new component",
    "drops the auxiliary loss entirely",
    "common default for large open MoE models",
    "k=2 is the common sweet spot",
    "MoE loss curves are spikier",
    "every strong long-context system",
    "attention keeps every past token exactly",
    "SSM's recall of far-back tokens decays",
    "hybrid systems below are what retired the objection",
    "the frontier does not choose",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  const figure = src("figures-src/moe-ssm-hybrids-2.py");
  expect(figure).toContain("3 * model_width * expert_width");
  expect(figure).not.toContain("arbitrary unit");
  expect(figure).not.toContain("capacity grows");
});

test("scaling-laws separates forecasting, allocation, deployment, and execution", () => {
  const chapter = src("en/foundations/01-scaling-laws.qmd");

  for (const heading of [
    "## What the forecast measures",
    "## From small runs to a loss surface",
    "## Turning a compute budget into model and data sizes",
    "## Kaplan and Chinchilla estimated different frontiers",
    "## Deployment changes the objective",
    "## Finite data changes the choice again",
    "## How to run a scaling study",
    "## What the scaling fit does not tune",
    "## Keeping a long run stable",
    "## Before committing the run",
  ]) {
    expect(chapter).toContain(heading);
  }

  expect(chapter).toContain("L_{\\mathrm{eval}}(\\theta)");
  expect(chapter).toContain("N_\\star=");
  expect(chapter).toContain("C_{\\mathrm{life}}(N,D,Q)");
  expect(chapter).toContain("@sardana2024lifetime");
  expect(chapter).toContain('data-viz="curve" data-family="u-shape"');

  for (const rejected of [
    "supervises the model for free",
    "The disagreement was never nature being ambiguous",
    "frontier-proven option",
    "following DeepSeek-V3 practice",
    "rollback -> lower",
    "fig-scaling-allocation",
    "fig-loss-spike-recovery",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  expect(src("figures-src/scaling-laws-2.py")).not.toContain("compute wasted");
});

test("generative adaptation and reasoning first uses define the method locally", () => {
  const required = [
    ["en/generative/01-diffusion-flow-matching.qmd", "@gls-diffusion, the train-by-adding-noise and generate-by-denoising recipe"],
    ["zh/generative/01-diffusion-flow-matching.qmd", "@gls-diffusion，也就是训练时加噪、生成时去噪的配方"],
    ["en/generative/01-diffusion-flow-matching.qmd", "@gls-ddpm, Ho et al.'s 2020 denoising-diffusion formulation"],
    ["zh/generative/01-diffusion-flow-matching.qmd", "@gls-ddpm这个早期去噪扩散目标"],
    ["en/generative/04-multimodal-models.qmd", "@gls-clip is the paired image-text training recipe"],
    ["zh/generative/04-multimodal-models.qmd", "@gls-clip是一种成对图文训练配方"],
    ["en/generative/04-multimodal-models.qmd", "a single-crop @gls-vit emits approximately"],
    ["zh/generative/04-multimodal-models.qmd", "由 @gls-vit 输出的图块序列长度决定"],
    ["en/adaptation/01-sft-peft.qmd", "@gls-qlora then attacked the remaining bottleneck by keeping the base model in 4-bit form"],
    ["zh/adaptation/01-sft-peft.qmd", "@gls-qlora接着处理剩下的那个瓶颈：把冻结基座压到 4-bit"],
    ["en/adaptation/03-rlhf-reward-modeling.qmd", "@gls-kl: how different the new token distribution is from the reference distribution"],
    ["zh/adaptation/03-rlhf-reward-modeling.qmd", "@gls-kl来度量，也就是新词元分布与参考分布相差多少"],
    ["en/adaptation/04-dpo-variants.qmd", "@gls-kto drops the paired-data requirement by learning from good/bad labels"],
    ["zh/adaptation/04-dpo-variants.qmd", "@gls-kto改从好/坏标签学习，去掉成对数据要求"],
    ["en/reasoning/01-eliciting-reasoning.qmd", "@gls-cot, a written chain of intermediate reasoning steps"],
    ["zh/reasoning/01-eliciting-reasoning.qmd", "@gls-cot，也就是写出来的一串中间推理步骤"],
    // The lock spans the nested gloss of "baseline" the readability pass added.
    ["en/reasoning/05-training-to-reason.qmd", "@gls-rloo are policy-gradient variants that compute a baseline (the reference value an outcome is compared against to decide if it was better than typical) from sampled groups"],
    ["zh/reasoning/05-training-to-reason.qmd", "@gls-rloo是两种策略梯度变体，它们从一组采样里计算基线（用来判断某个结果是否好于寻常的参照值）"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} locally`).toContain(snippet);
  }
});

test("the diffusion and flow chapter keeps model path sampler and cost distinct", () => {
  const chapter = flat("en/generative/01-diffusion-flow-matching.qmd");

  for (const required of [
    "An autoregressive model waits for the previous output position",
    "q(x_t\\mid x_{t-1})",
    "p_\\theta(x_{t-1}\\mid x_t)",
    "\\bar\\alpha_t=\\frac{f(t)}{f(0)}",
    "becomes ill-conditioned at high noise",
    "becomes ill-conditioned at low noise",
    "It is not, without a time conversion, the flow-matching velocity",
    "\\epsilon^*(x_t,t)=\\mathbb E[\\epsilon\\mid x_t]",
    "they do not share individual stochastic paths or transition laws",
    "normally requires both network predictions per sampling step",
    "Sampler step count and network-function evaluations (NFE) are not synonyms",
    "have the same gradient with respect to $\\theta$",
    "v^*(x,t)=\\mathbb E[x_1-x_0\\mid x_t=x]",
    "One Euler step is exact only for an exactly constant learned trajectory",
    "Text changes the state space",
  ]) {
    expect(chapter, `missing diffusion/flow contract: ${required}`).toContain(required);
  }

  for (const rejected of [
    "almost all non-text media",
    "images have no meaningful left-to-right order",
    "the loss collapses to",
    "the score network is therefore",
    "one Euler step can follow it exactly",
    "flow matching generalizes diffusion",
  ]) {
    expect(chapter).not.toContain(rejected);
  }

  // Regression: the previous left-to-right relation graph exceeded the reading
  // column and clipped its solver, consistency, and flow-matching branches.
  expect(chapter).toContain("rankdir=TB;");
  expect(chapter).not.toContain("rankdir=LR;");
});

test("the non-autoregressive chapter separates factorization diffusion and serving cost", () => {
  const chapter = flat("en/generative/02-nar-diffusion-lms.qmd");

  for (const required of [
    "The two ideas overlap, but they are not synonyms",
    "p_\\theta(y\\mid c,L,z)",
    "dependency depth, total model work, output-length handling",
    "not a mathematical requirement for all parallel generation",
    "does not inherit a diffusion likelihood bound merely because it uses masks",
    "q(x_t\\mid x_{t-1})",
    "a weighted family of masked-language-model losses",
    "An existing masked language model does not become a complete generator",
    "one full-sequence diffusion evaluation is not cost equivalent to one cached autoregressive token step",
    "It is different from a causal KV cache",
    "the standard causal prefix KV cache cannot simply be carried between rounds",
    "They did not create one controlled comparison in which only the factorization changed",
    "Perplexity is not directly comparable when tokenizers differ",
    "rankdir=TB;",
  ]) {
    expect(chapter, `missing NAR/diffusion contract: ${required}`).toContain(required);
  }

  for (const rejected of [
    "almost never trained on real data",
    "the reason this is essential",
    "Mask-Predict is a discrete diffusion sampler",
    "The deepest result in this area",
    "the commercial edge is already shipping",
    "The scale objection then fell",
    "every frontier model is still autoregressive",
    "through the whole 2025 wave",
    "rankdir=LR;",
  ]) {
    expect(chapter).not.toContain(rejected);
  }
});

test("serving retrieval and evaluation first uses explain operational terms locally", () => {
  const required = [
    ["zh/inference/01-serving-problem.qmd", "@gls-mqa（多查询注意力，让多个查询头共享同一套键/值头）"],
    // @gls-fsm already renders as "finite-state machine (FSM)", so the gloss names
    // the machine's job instead of repeating the expansion.
    ["en/inference/05-structured-long-context.qmd", "@gls-fsm, a machine that tracks which grammar state the partial output is in"],
    ["zh/inference/05-structured-long-context.qmd", "@gls-fsm给 logits 做掩码，也就是让一台记录语法走到了哪个状态的机器来决定下一个词元能是什么"],
    ["en/inference/05-structured-long-context.qmd", "@gls-attention-sink behavior where early tokens keep attracting attention"],
    ["zh/inference/05-structured-long-context.qmd", "@gls-attention-sink 这种开头词元持续吸引注意力的现象"],
    ["en/inference/05-structured-long-context.qmd", "@gls-constrained-decoding, the grammar-checked decode loop"],
    ["zh/inference/05-structured-long-context.qmd", "@gls-constrained-decoding，也就是带语法检查的解码循环"],
    ["en/orchestration/08-rag-retrieval.qmd", "@gls-bm25 lexical baseline, a sparse keyword-scoring method"],
    ["zh/orchestration/08-rag-retrieval.qmd", "@gls-bm25 词法基线，也就是一种稀疏关键词打分方法"],
    // @gls-held-out already renders as "held-out set"; the gloss follows the term.
    ["en/evaluation/01-benchmarks.qmd", "@gls-held-out is data deliberately kept out of every training stage"],
    ["zh/evaluation/01-benchmarks.qmd", "@gls-held-out 指从每个训练阶段都排除在外的数据集"],
    ["en/evaluation/01-benchmarks.qmd", "@gls-membership-inference, tests that ask whether a specific example was in the training data"],
    ["zh/evaluation/01-benchmarks.qmd", "@gls-membership-inference，也就是判断某个具体样本是否出现在训练数据里的测试"],
    ["en/evaluation/04-judging-holistic.qmd", "@gls-llm-as-judge, a model used as the grader"],
    ["zh/evaluation/04-judging-holistic.qmd", "@gls-llm-as-judge，也就是用模型当评分器"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} locally`).toContain(snippet);
  }
});

test("safety infrastructure and practice first uses explain operational terms locally", () => {
  const required = [
    ["en/safety/03-security-authorization.qmd", "@gls-prompt-injection, an instruction hidden in untrusted content"],
    ["zh/safety/03-security-authorization.qmd", "@gls-prompt-injection，也就是藏在不可信内容里的指令"],
    ["en/safety/05-adversarial-robustness.qmd", "@gls-jailbreak attacks, prompts designed to bypass refusal"],
    ["zh/safety/04-runtime-safety.qmd", "用@gls-jailbreak，也就是绕过拒绝边界的提示"],
    ["zh/safety/05-adversarial-robustness.qmd", "@gls-jailbreak攻击，也就是绕过拒绝边界的提示"],
    ["en/safety/06-privacy-provenance-unlearning.qmd", "@gls-machine-unlearning, approximate removal of a learned fact from trained weights"],
    ["zh/safety/06-privacy-provenance-unlearning.qmd", "@gls-machine-unlearning，也就是近似地从已训练权重里移除某个已学事实"],
    ["en/infrastructure/01-accelerators-networking.qmd", "@gls-rdma, which lets one machine move bytes into another's memory"],
    ["zh/infrastructure/01-accelerators-networking.qmd", "@gls-rdma，也就是绕过 CPU 直接读写远端内存"],
    ["en/infrastructure/05-the-compute-frontier.qmd", "@gls-cowos package: an advanced package that places compute chiplets and HBM"],
    // The zh twin introduces before use: the interposer is described, then named.
    ["zh/infrastructure/05-the-compute-frontier.qmd", "并排铺在一块硅中介层上，这正是 @gls-cowos 这类先进封装"],
    ["en/infrastructure/07-powering-it.qmd", "@gls-pue, the ratio of total facility power to IT equipment power"],
    ["zh/infrastructure/07-powering-it.qmd", "@gls-pue，也就是数据中心总耗电除以 IT 设备耗电的比值"],
    ["en/infrastructure/08-the-machine-that-breaks.qmd", "@gls-mtbf, the expected interval between failures for the whole job"],
    ["zh/infrastructure/08-the-machine-that-breaks.qmd", "@gls-mtbf，也就是平均故障间隔"],
    ["en/orchestration/08-rag-retrieval.qmd", "@gls-rag puts a live, queryable corpus next to the model"],
    ["zh/orchestration/08-rag-retrieval.qmd", "@gls-rag的做法，就是在模型旁边放一份实时、可查询的语料"],
    ["en/ecosystem/03-tooling-ecosystem.qmd", "@gls-mcp [@anthropic2024model], a common protocol for connecting models to tool servers"],
    ["zh/ecosystem/03-tooling-ecosystem.qmd", "@gls-mcp [@anthropic2024model] 这种连接模型与工具服务器的公共协议"],
    ["en/practice/01-choosing-a-model.qmd", "@gls-gateway, a routing and policy layer for model calls"],
    ["zh/practice/01-choosing-a-model.qmd", "@gls-gateway，也就是模型调用的路由与策略层"],
    ["en/practice/06-retrieval-and-documents.qmd", "@gls-vlm, a model that reads page images and text together"],
    ["zh/practice/06-retrieval-and-documents.qmd", "@gls-vlm（用图像和文本一起解析页面的模型）"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} locally`).toContain(snippet);
  }
});

test("audited leftover first uses define the role of the term in place", () => {
  const required = [
    ["en/foundations/02-data-curation.qmd", "**@gls-decontamination report** that states which benchmark-overlap checks were run"],
    ["zh/foundations/02-data-curation.qmd", "**@gls-decontamination报告**，也就是说明哪些基准重叠已从训练语料中移除"],
    ["zh/foundations/03-tokenization.qmd", "@gls-bpe是这套构造的主力：它反复合并语料中最常见的相邻符号"],
    ["en/infrastructure/01-accelerators-networking.qmd", "@gls-tpu pod is Google's accelerator cluster counterpart"],
    ["en/infrastructure/01-accelerators-networking.qmd", "@gls-ici, the pod's internal inter-chip interconnect"],
    ["en/infrastructure/01-accelerators-networking.qmd", "@gls-gpu cluster, a cluster of graphics processors used as accelerators"],
    ["zh/infrastructure/01-accelerators-networking.qmd", "@gls-tpu pod 是 Google 加速器集群一侧的对应物"],
    ["zh/infrastructure/01-accelerators-networking.qmd", "@gls-ici，也就是 pod 内部的芯片间互连"],
    ["zh/infrastructure/01-accelerators-networking.qmd", "@gls-gpu 集群，也就是用图形处理器作加速器的集群"],
    ["en/infrastructure/04-orchestration-data-infra.qmd", "@gls-sdc lets the run continue while producing subtly wrong numbers without an explicit crash"],
    ["zh/infrastructure/04-orchestration-data-infra.qmd", "@gls-sdc，也就是不崩溃却悄悄写出错误数字的静默数据损坏"],
    ["en/practice/05-agents-and-sandboxes.qmd", "@gls-virtual-key issued by a @gls-gateway for model access, a short-lived scoped substitute for a provider key"],
    ["zh/practice/05-agents-and-sandboxes.qmd", "@gls-virtual-key，也就是短时效、限范围的模型密钥替身"],
    ["en/practice/10-reliability-nondeterministic.qmd", "@gls-sli, the metric that decides whether served events count as valid"],
    ["zh/practice/10-reliability-nondeterministic.qmd", "@gls-sli，也就是判断服务事件是否有效的指标"],
  ];

  for (const [path, snippet] of required) {
    expect(flat(path), `${path} should define ${snippet} locally`).toContain(snippet);
  }
});

test("the mid-training bridge is tracked in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("mid-training bridges");
  expect(src("en/index.qmd")).toContain("mid-training bridges");
  expect(src("zh/index.qmd")).toContain("中段训练桥接");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Mid-training bridge**");
  expect(src("en/orientation/01-whole-stack.qmd")).toContain("@sec-mid-training");
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain("@sec-mid-training");
  expect(src("en/foundations/02-data-curation.qmd")).toContain("covered in @sec-mid-training");
  expect(src("zh/foundations/02-data-curation.qmd")).toContain("放在 @sec-mid-training 讨论");
});

test("part I is framed as base model formation, not only pretraining", () => {
  expect(src("en/book.yml")).toContain('part: "Part I: Base Model Formation"');
  expect(src("zh/book.yml")).toContain('part: "第一部分 · 基座模型的形成"');
  expect(src("en/foundations/index.qmd")).toContain("# Part I: Base Model Formation");
  expect(src("zh/foundations/index.qmd")).toContain("# 第一部分 · 基座模型的形成");
  expect(outline("README.md")).toContain("Part I, Base Model Formation");
  expect(src("en/index.qmd")).toContain("Part I, Base Model Formation");
  expect(src("zh/index.qmd")).toContain("第一部分，基座模型的形成");
  expect(src("en/orientation/02-field-map.qmd")).toContain('id="fm-PI"');
  expect(src("en/orientation/02-field-map.qmd")).toContain(">Base Model Formation</tspan>");
  expect(src("zh/orientation/02-field-map.qmd")).toContain('id="fm-PI"');
  expect(src("zh/orientation/02-field-map.qmd")).toContain(">基座模型的形成</tspan>");
  expect(src("en/orientation/index.qmd")).toContain("base-model formation (training the raw model), adaptation");
  expect(src("zh/orientation/index.qmd")).toContain("经过基座模型形成（训练出原始模型）与适配");
  expect(src("en/orientation/01-whole-stack.qmd")).toContain("Part I calls this full sequence *base-model formation*");
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain("环节二：基座模型形成");
  expect(src("en/foundations/summary.qmd")).toContain("Base-model formation is infrastructure, not background");
  expect(src("zh/foundations/summary.qmd")).toContain("基座模型形成不是背景知识");
  expect(flat("en/summary.qmd")).toContain("We began with base-model formation");
  expect(src("zh/summary.qmd")).toContain("我们从基座模型的形成开始");
});

test("the English field map separates process, dependency, evidence, and reading order", () => {
  const chapter = src("en/orientation/02-field-map.qmd");
  expect(chapter).toContain("The **model-development process**");
  expect(chapter).toContain("The **request-execution process**");
  expect(chapter).toContain("Neither one specifies the order");
  expect(chapter).toContain("Specified mechanism");
  expect(chapter).toContain("Empirical regularity");
  expect(chapter).toContain("Open interpretation or design question");
  expect(chapter).toContain('data-xlabel="Normalized training compute"');
  expect(chapter).not.toContain("Solid ground and swamp");
  expect(chapter).not.toContain("training is paid once and inference is paid forever");
  expect(chapter).not.toContain("the same control structure at three timescales");
});

test("serving cost references are anchored to the inference and serving part", () => {
  expect(src("en/inference/06-serving-multimodal.qmd")).not.toContain("Part IV built a serving stack");

  const enEconomics = src("en/ecosystem/04-economics.qmd");
  expect(enEconomics).not.toContain("Part VI levers");
  expect(enEconomics).not.toContain("Every chapter in Part VI");
  expect(enEconomics).not.toContain("every Part VI optimization");
  expect(enEconomics).not.toContain("optimizations of Part VI");
  expect(enEconomics).toContain("The serving chapters in Part V");
  expect(enEconomics).toContain("Part V serving levers");
  expect(enEconomics).toContain("serving optimizations in Part V");

  const zhEconomics = src("zh/ecosystem/04-economics.qmd");
  expect(zhEconomics).not.toContain("第六部分的每一章");
  expect(zhEconomics).not.toContain("第六部分每一项优化");
  expect(zhEconomics).not.toContain("第六部分的手段");
  expect(zhEconomics).not.toContain("第六部分的优化为什么能直接回本");
  expect(zhEconomics).toContain("第五部分的服务章节");
  expect(zhEconomics).toContain("第五部分的服务手段");
  expect(zhEconomics).toContain("第五部分的服务优化为什么能直接回本");
});

test("reasoning and test-time compute is a full seven-chapter part in both languages", () => {
  const expected = [
    "reasoning/01-eliciting-reasoning.qmd",
    "reasoning/02-structured-reasoning-search.qmd",
    "reasoning/03-programs-solvers-symbolic.qmd",
    "reasoning/04-verifiers-process-supervision.qmd",
    "reasoning/05-training-to-reason.qmd",
    "reasoning/06-reasoning-data-distillation.qmd",
    "reasoning/07-inference-time-scaling.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    for (const chapter of expected) {
      const chapterSrc = src(`${lang}/${chapter}`);
      if (lang === "en") {
        expect(chapterSrc, `${lang}/${chapter} should name contested claims`).toMatch(/^## .*contested/im);
        expect(chapterSrc, `${lang}/${chapter} should name constraint arrows`).toMatch(/^## .*constraint arrow/im);
      } else {
        expect(chapterSrc, `${lang}/${chapter} should name contested claims`).toMatch(/^## .*争议/m);
        expect(chapterSrc, `${lang}/${chapter} should name lower-layer constraints`).toMatch(/^## 下层约束/m);
      }
    }

    const intro = src(`${lang}/reasoning/index.qmd`);
    for (const section of [
      "@sec-eliciting-reasoning",
      "@sec-structured-reasoning-search",
      "@sec-programs-solvers-symbolic",
      "@sec-verifiers-process-supervision",
      "@sec-training-to-reason",
      "@sec-reasoning-data-distillation",
      "@sec-inference-time-scaling",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded reasoning part is tracked in top-level book surfaces", () => {
  expect(outline("README.md")).toContain("structured search");
  expect(outline("README.md")).toContain("verifiers");
  expect(outline("README.md")).toContain("reasoning data");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Reasoning and test-time compute depth**");
});

test("substantive chapters expose uncertainty and lower-layer constraints", () => {
  const contestedExceptions = new Set([
    "en/orientation/01-whole-stack.qmd",
    "zh/orientation/01-whole-stack.qmd",
  ]);
  const constraintExceptions = new Set([
    "en/orientation/03-borrowed-ideas.qmd",
    "zh/orientation/03-borrowed-ideas.qmd",
  ]);

  for (const lang of ["en", "zh"]) {
    for (const path of qmdPaths(lang)) {
      if (path.endsWith("/index.qmd") || path.endsWith("/summary.qmd")) continue;
      // Back matter carries no argument, so it owes no contested box or
      // constraint arrow.
      if (path.endsWith("references.qmd") || path.endsWith("glossary.qmd")) continue;
      if (path.endsWith("changelog.qmd") || path.endsWith("contribute.qmd")) continue;

      const text = src(path);
      if (!contestedExceptions.has(path)) {
        const contested = lang === "en" ? /^## .*contested/im : /^## .*争议/m;
        expect(text, `${path} should include a contested/open-question section`).toMatch(contested);
      }
      if (!constraintExceptions.has(path)) {
        const constraint = lang === "en" ? /^## .*(constraint arrow|lower-layer constraint)/im : /^## 下层约束/m;
        expect(text, `${path} should include a lower-layer constraint section`).toMatch(constraint);
      }
    }
  }
});

test("the compute substrate ends before the frontier part begins", () => {
  const expected = [
    "infrastructure/01-accelerators-networking.qmd",
    "infrastructure/04-orchestration-data-infra.qmd",
    "infrastructure/05-the-compute-frontier.qmd",
    "infrastructure/06-making-the-silicon.qmd",
    "infrastructure/07-powering-it.qmd",
    "infrastructure/08-the-machine-that-breaks.qmd",
    "infrastructure/summary.qmd",
    "frontiers/01-where-learning-hits-limits.qmd",
    "frontiers/02-the-capability-horizon.qmd",
    "frontiers/03-verification-frontier.qmd",
    "frontiers/summary.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    // The limits chapters left the substrate part; nothing may claim them back.
    expect(
      yml,
      `${lang}/book.yml still lists a limits chapter under infrastructure/`,
    ).not.toMatch(/infrastructure\/\d+-(where-learning-hits-limits|the-capability-horizon|verification-frontier)/);

    expect(src(`${lang}/frontiers/index.qmd`)).toContain("@sec-verification-frontier");
    expect(src(`${lang}/frontiers/03-verification-frontier.qmd`)).toContain("{#sec-verification-frontier}");
  }

  expect(src("en/book.yml")).toContain('part: "Part X: Frontiers and Limits"');
  expect(src("zh/book.yml")).toContain('part: "第十部分 · 前沿与极限"');
  expect(outline("README.md")).toContain("**Part X, Frontiers and Limits.**");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Verification frontier**");
});

test("mid-book handoffs do not signal that the whole book has ended", () => {
  const forbidden: Record<string, string[]> = {
    en: ["The book closes there", "This brings the book to its last open question"],
    zh: ["全书在这里收束", "全书最后留下", "全书最后落在"],
  };

  for (const lang of ["en", "zh"]) {
    for (const path of qmdPaths(lang)) {
      if (path.endsWith("/summary.qmd")) continue;
      const text = src(path);
      for (const phrase of forbidden[lang]) {
        expect(text.includes(phrase), `${path} uses premature finality phrase: ${phrase}`).toBe(false);
      }
    }
  }
});

test("the frontier arc explicitly hands off to ecosystem and practice", () => {
  const enHorizon = src("en/frontiers/02-the-capability-horizon.qmd");
  expect(enHorizon).toContain("@sec-verification-frontier takes the next step");

  const zhHorizon = src("zh/frontiers/02-the-capability-horizon.qmd");
  expect(zhHorizon).toContain("@sec-verification-frontier 会往前再走一步");

  // Ecosystem is Part XI and practice Part XII since the frontier part split off.
  const enVerification = flat("en/frontiers/03-verification-frontier.qmd");
  expect(enVerification).toContain("Part XI asks how these constraints");
  expect(enVerification).toContain("Part XII asks how to operate systems");
  expect(enVerification).toContain("operating contracts");

  const zhVerification = src("zh/frontiers/03-verification-frontier.qmd");
  expect(zhVerification).toContain("第十一部分会问");
  expect(zhVerification).toContain("第十二部分会问");
  expect(zhVerification).toContain("运营契约");

  // The practice intro situates itself after the substrate part (IX), the
  // frontier part (X), and ecosystem (XI). Only the numbering is pinned: the
  // sentence that carries it is prose and may be rephrased.
  const enPractice = flat("en/practice/index.qmd");
  expect(enPractice).toMatch(/\bPart IX\b/);
  expect(enPractice).toMatch(/\bPart X\b/);
  expect(enPractice).toMatch(/\bPart XI\b/);
  expect(enPractice).toContain("This part asks");

  const zhPractice = src("zh/practice/index.qmd");
  expect(zhPractice).toContain("第九部分");
  expect(zhPractice).toContain("第十部分");
  expect(zhPractice).toContain("第十一部分");
  expect(zhPractice).toContain("到了这一部分，要问的是另一类问题");
});
