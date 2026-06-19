# Integration Map

This book is the canonical home for its content. Two bodies of existing
work feed it: the research notes in `../specs/research/llm-training/` and
the `agent-harness` essay series in `../latere-ai/content/blog/`. Both are
already bilingual (en + zh). The blog stays published as posts; the research
notes become feeder material; the book holds the adapted, cross-referenced,
debate-boxed version.

Integration mode per source:

- **migrate**: adapt the source into a chapter, restructured into the
  Problem / Design / Evolution / Trade-offs / Implementation arc, with a
  "what's contested" box and constraint arrows added. The book becomes the
  source of truth.
- **adapt**: the source is partial or differently shaped; use it as the
  backbone and write around it.
- **new**: white space, no existing source. These are the chapters with no
  book competition and where the book plants its flag.

## Source to chapter

| Chapter | Source | Mode |
|---|---|---|
| 03 Scaling Laws | research `05-pretraining-and-scaling` | migrate (done, exemplar) |
| 04 Data Curation | research `01-data-pipeline` | migrate |
| 05 Tokenization | research `01-data-pipeline` (tokenizer) | adapt |
| 06 Transformer Architecture | research `02-architecture` + `03-attention` | migrate |
| 07 MoE, SSMs, Hybrids | research `04-mixture-of-experts` (+ SSM new) | adapt |
| 08 Training at Scale | research `06-infrastructure-and-systems` | migrate |
| 09 SFT and PEFT | research `08-post-training` (SFT) | adapt |
| 10 RLHF and Reward Modeling | research `08-post-training` (RLHF) | migrate |
| 11 DPO and Variants | research `08-post-training` (DPO) | migrate |
| 12 Synthetic Data, Self-Improvement | research `08` + `09` | adapt |
| 14 Training to Reason | research `09-rl-and-verifiable-rewards` | migrate |
| 21 Agent Architectures | blog `agent-harness` + `agent-harness-runtime` | migrate |
| 22 Memory Systems | blog `agent-harness-persistence` | migrate |
| 23 The Harness | blog `agent-harness-runtime` + `agent-harness-contracts` | migrate |
| 24 Multi-Agent Systems | blog `adversarial-verification` | migrate |
| 27 Benchmarks | research `10-evaluation` | migrate |
| 28 Judging, Holistic Eval | research `10-evaluation` | adapt |
| 29 Evaluating Agents | research `10-evaluation` + blog `adversarial-verification` | adapt |
| 30 Accelerators, Networking | research `06-infrastructure-and-systems` | adapt |
| 31 Orchestration, Data Infra | research `06` + new | adapt |
| 34 Security and Authorization | blog `agent-harness-{identity,governance,model-access}` | migrate |
| 35 Model Landscape | research `11-frontier-landscape` | migrate (GATED, see below) |
| 36 Tooling Ecosystem | new + blog `introducing-{lux,cella,topos,wallfacer}` as case studies | adapt |

## White space (new chapters, no existing source)

These are the differentiators, where the comprehensive titles on the market
are thinnest: distributed-training depth (08, partly sourced), the entire
**inference and serving** layer (16 to 20), **mechanistic
interpretability** and oversight (32, 33), and the economics (37). Also new:
01, 02, 13, 15, 25, 26.

## Publish gate

The repo is private now and will go public later. Before flipping it
public, review anything that names competitors candidly:

- **Chapter 35 (Model Landscape)** draws on research `11-frontier-landscape`,
  a dated snapshot that names labs with confidence tiers. Curate it for a
  public, non-attributive framing before publishing. The chapter stub
  carries a `PUBLISH-GATED` marker in its status note.

The translation glossary at `../specs/research/llm-training/TRANSLATION-GLOSSARY.md`
governs the zh side: keep code, symbols, math, URLs, and author names
byte-verbatim, and use Chinese punctuation, no em dashes.
