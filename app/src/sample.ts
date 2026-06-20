// Placeholder chapter + nav model for P0 (shell development before the content
// pipeline lands). Replaced by real pipeline output in later phases.

import type { ChapterData } from "./types.ts";

export const sampleChapter: ChapterData = {
  lang: "en",
  partLabel: "Part I: Foundations and Pretraining",
  chapterNum: "6",
  eyebrow: "Part 1 · Chapter 6",
  crumbChapter: "Chapter 6",
  title: "Transformer Architecture and Its Variants",
  author: "Changkun Ou",
  updated: "June 20, 2026",
  readtime: "~14 min",
  langHref: "../zh/p1-foundations/06-transformer-architecture.html",
  prefix: "../",
  headings: [
    { id: "one-block-two-jobs", text: "One block, two jobs", level: 2 },
    { id: "three-questions", text: "Three questions the field has closed", level: 2 },
    { id: "the-one-cost", text: "The one cost that won't settle", level: 2 },
    { id: "reading-the-dials", text: "Reading the dials", level: 2 },
    { id: "building-the-block", text: "Building the block, and how it breaks", level: 2 },
    { id: "further-reading", text: "Further reading", level: 2 },
  ],
  prev: { label: "5 · Tokenization", href: "05-tokenization.html" },
  next: { label: "7 · Beyond Dense Transformers", href: "07-moe-ssm-hybrids.html" },
  contentHtml: [
    `<section id="one-block-two-jobs"><h2>One block, two jobs</h2>`,
    `<p>A frontier dense model is a stack of nearly identical transformer blocks, and that block has barely changed since 2023. Almost everything inside it is a question that has been answered and closed: how to normalize, how to activate, how to encode position. One question stays open, and it is not in the math of the forward pass.</p>`,
    `<p>A transformer block has to do two distinct jobs as it goes: mix information across positions, then transform each token in place. The first job is attention; the second is the feed-forward network.</p></section>`,
    `<section id="three-questions"><h2>Three questions the field has closed</h2>`,
    `<p>Normalization moved to the front of each sublayer. Activations became gated. Positions became relative. Each of these was contested, then settled, and the settled answer is now the default in every serious implementation.</p>`,
    `<pre><code>def attention(Q, K, V):\n    d_k = Q.size(-1)\n    scores = Q @ K.transpose(-2, -1) / d_k**0.5\n    return softmax(scores, dim=-1) @ V</code></pre></section>`,
    `<section id="the-one-cost"><h2>The one cost that won't settle</h2>`,
    `<p>The key-value cache is the one cost that refuses to settle. It grows linearly with context length and batch size, and it is the single open cost that drives the attention variants from MHA through MQA to GQA.</p></section>`,
    `<section id="reading-the-dials"><h2>Reading the dials</h2>`,
    `<p>Heads, head dimension, layers, and sequence length are the dials. Read them together and the memory and compute of a block fall out almost mechanically.</p></section>`,
    `<section id="building-the-block"><h2>Building the block, and how it breaks</h2>`,
    `<p>Build the block from its parts and watch where it breaks under long context: the cache dominates, and every modern variant is a different bargain struck against that one pressure.</p></section>`,
    `<section id="further-reading"><h2>Further reading</h2>`,
    `<p>Placeholder body. The real content pipeline replaces this with compiled chapter HTML.</p></section>`,
  ].join("\n"),
  toc: [
    { id: "front", label: "", single: true, chapters: [{ n: "", label: "Preface", href: "index.html" }] },
    { id: "p0", label: "Part 0: Orientation", chapters: [
      { n: "1", label: "The Whole Stack in One Pass", href: "p0-orientation/01-whole-stack.html" },
      { n: "2", label: "A Field Map and How to Read This Book", href: "p0-orientation/02-field-map.html" },
    ]},
    { id: "p1", label: "Part I: Foundations and Pretraining", chapters: [
      { n: "3", label: "Scaling Laws and Compute Allocation", href: "p1-foundations/03-scaling-laws.html" },
      { n: "4", label: "Data Curation", href: "p1-foundations/04-data-curation.html" },
      { n: "5", label: "Tokenization", href: "p1-foundations/05-tokenization.html" },
      { n: "6", label: "Transformer Architecture and Its Variants", href: "p1-foundations/06-transformer-architecture.html", active: true },
      { n: "7", label: "Beyond Dense Transformers: MoE, SSMs, Hybrids", href: "p1-foundations/07-moe-ssm-hybrids.html" },
      { n: "8", label: "Training at Scale", href: "p1-foundations/08-training-at-scale.html" },
    ]},
    { id: "p2", label: "Part II: Adaptation and Alignment", chapters: [
      { n: "9", label: "Supervised Fine-Tuning and PEFT", href: "p2-adaptation/09-sft-peft.html" },
      { n: "10", label: "RLHF and Reward Modeling", href: "p2-adaptation/10-rlhf-reward-modeling.html" },
    ]},
  ],
};
