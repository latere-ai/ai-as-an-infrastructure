# AI as an Infrastructure

[![build](https://img.shields.io/github/actions/workflow/status/latere-ai/ai-as-an-infrastructure/render.yml?branch=main&label=build)](https://github.com/latere-ai/ai-as-an-infrastructure/actions/workflows/render.yml)
[![release](https://img.shields.io/github/v/release/latere-ai/ai-as-an-infrastructure?label=release)](https://github.com/latere-ai/ai-as-an-infrastructure/releases)
[![updated](https://img.shields.io/github/last-commit/latere-ai/ai-as-an-infrastructure/main?label=updated)](https://aaai.latere.ai/en/changelog)
[![license](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-blue)](LICENSE)

From Systems to Agents: history, design decisions, and foundations.

**Read it: [aaai.latere.ai/en](https://aaai.latere.ai/en/) (English) ·
[aaai.latere.ai/zh](https://aaai.latere.ai/zh/) (中文)**

A book that treats AI as an infrastructure and explains it design-first.
It follows one continuous arc, the lifecycle of a capability,
from raw compute to a deployed and governed behavior, asking at every step
how each piece got its shape, what trade-offs that shape encodes, and the
theory underneath. It is not a replacement for dedicated scaling, distributed
training, or serving playbooks; those layers are covered because they set the
constraints that shape adaptation, reasoning, evaluation, agents, safety, and
economics.

The book is web-only: its runnable cells, viz components, and interactive
diagrams do not survive a static PDF or EPUB.

## Outline

The spine is the lifecycle of a capability, read as a stack. Each part below
links to its opening page on the site.

- **[Part 0, Orientation](https://aaai.latere.ai/en/orientation).** The whole
  stack in one pass, how to read, and the boundary with the AI infrastructure
  that came before (ranking, recommendation, classical ML).
- **[Part I, Base Model Formation](https://aaai.latere.ai/en/foundations).**
  Scaling, data, tokenization, architecture, training at scale, and
  mid-training bridges.
- **[Part II, Generative and Multimodal
  Architectures](https://aaai.latere.ai/en/generative).** Diffusion and flow
  matching, diffusion language models, speech, multimodal fusion.
- **[Part III, Post-Training: Adaptation, Preference, and
  Alignment](https://aaai.latere.ai/en/adaptation).** Fine-tuning, behavior
  specifications, preference data, RLHF, direct preference optimization,
  verifiable rewards, instruction hierarchy, and self-improvement.
- **[Part IV, Reasoning and Test-Time
  Compute](https://aaai.latere.ai/en/reasoning).** Elicitation, structured
  search, programs and solvers, verifiers, RLVR training, reasoning data and
  distillation, and production test-time compute.
- **[Part V, Inference and Serving](https://aaai.latere.ai/en/inference).**
  The serving problem, memory and scheduling for the key-value cache, faster
  decoding, quantization and kernels, structured and long-context output, and
  multimodal serving.
- **[Part VI, Orchestration: Agents, Retrieval,
  Context](https://aaai.latere.ai/en/orchestration).** Training agents to act,
  memory, personalization and user memory, the harness, computer use,
  multi-agent, retrieval, context.
- **[Part VII, Evaluation](https://aaai.latere.ai/en/evaluation).**
  Benchmarks, statistical reliability, human rubrics, model judges, factuality
  and grounding, agents, and operational governance.
- **[Part VIII, Safety, Interpretability, and
  Governance](https://aaai.latere.ai/en/safety).** Including confidential
  inference: attested hardware in place of contractual privacy.
- **[Part IX, Infrastructure and
  Compute](https://aaai.latere.ai/en/infrastructure).** Accelerators,
  networking, the software layer (frameworks, autodiff, compilers,
  kernels, the CUDA moat), cluster orchestration and data infrastructure, and
  the compute frontier: silicon, power, geography, and failure at scale.
- **[Part X, Frontiers and Limits](https://aaai.latere.ai/en/frontiers).**
  What compute cannot buy: data and learning signal running out, the
  capability horizon and how far a claim can be measured, and the price of
  verifying a result before anyone accepts it.
- **[Part XI, Ecosystem and Economics](https://aaai.latere.ai/en/ecosystem).**
  Model openness, the model as a supply-chain artifact (formats, distribution,
  poisoning), tooling standards, compute markets and their capital layer,
  market structure, adoption and productivity, data rights, and the agent
  economy (identity, delegation, machine payments).
- **[Part XII, Practice and Operations](https://aaai.latere.ai/en/practice).**
  The hands-on 2026 stack, plus deployment, reliability, human oversight
  surfaces, the production data engine, and operating contracts for SLOs, cost
  governance, incidents, and multi-tenancy.

Also on the site: a [glossary](https://aaai.latere.ai/en/glossary) of the terms
the book introduces, and a [changelog](https://aaai.latere.ai/en/changelog) of
what changed week to week.

## How to read it

Two motifs recur: the **three loops** (training, inference, agentic) and the
**capability, efficiency, trust** lens. Watch the **constraint arrows**,
where a lower layer dictates an upper layer's choice. The book's distinctive
ground is those cross-layer arrows, especially where silicon, electricity,
geography, price, and operational contracts constrain what the model stack can
become.

Every section moves through Problem, Design, Evolution, Trade-offs, and
Implementation, so a reader finishes able to answer "why is it built this
way?". Live debates get a "what's contested" box rather than being papered
over. The writing rules are in [`CONVENTIONS.md`](CONVENTIONS.md).

## Contributing

Corrections, typos, and build fixes are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the repository layout and how to
build the book locally. Readers arriving from the site land on
[Contribute](https://aaai.latere.ai/en/contribute), which every chapter links
to alongside an edit link to its own source file.

## License

Content is licensed
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). See
[`LICENSE`](LICENSE). Copyright © 2026 latere.ai. You may read, share, and
quote the book with attribution for non-commercial purposes; redistributing a
modified version is not permitted. Corrections and fixes contributed here are
merged into the book itself, so they are not derivative works.
