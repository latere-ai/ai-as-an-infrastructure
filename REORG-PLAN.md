# Reorg Plan: structure + number-free URLs

Generated mapping. The book is reorganized into 11 parts (from 14) with four
targeted moves, and every chapter URL becomes number-free and durable.

- **Displayed chapter numbers** come from manifest position (`app/src/pipeline/book.ts`),
  so they stay correct automatically. No number is hand-edited.
- **URLs** drop both the `pN-` part prefix and the `NN-` chapter prefix:
  `/{lang}/p3-reasoning/16-training-agents-to-act` -> `/{lang}/orchestration/training-agents-to-act`.
- **Files** keep a per-part `NN-` prefix for authoring order (renumbered, de-duplicated);
  `qmdToHref` strips it.
- Both `en` and `zh` share the same paths, so each row below applies to both languages.

## Four targeted moves

1. Generative & Multimodal pulled up to Part II (was Part XII).
2. "Training Agents to Act" unified into Orchestration (was end of Reasoning).
3. Infrastructure (old VII) + Frontiers (old XI) consolidated into Part IX.
4. Practical (old X) + Operations (old XIII) merged into the Part XI capstone.

## Full old -> new mapping (67 chapters)

| # | Part | Old URL (`/{lang}/...`) | New URL (`/{lang}/...`) | Moved part? |
|---|------|--------------------------|--------------------------|:-----------:|
| 1 | orientation | `p0-orientation/01-whole-stack` | `orientation/whole-stack` |  |
| 2 | orientation | `p0-orientation/02-field-map` | `orientation/field-map` |  |
| 3 | orientation | `p0-orientation/03-borrowed-ideas` | `orientation/borrowed-ideas` |  |
| 4 | foundations | `p1-foundations/03-scaling-laws` | `foundations/scaling-laws` |  |
| 5 | foundations | `p1-foundations/04-data-curation` | `foundations/data-curation` |  |
| 6 | foundations | `p1-foundations/05-tokenization` | `foundations/tokenization` |  |
| 7 | foundations | `p1-foundations/06-transformer-architecture` | `foundations/transformer-architecture` |  |
| 8 | foundations | `p1-foundations/07-moe-ssm-hybrids` | `foundations/moe-ssm-hybrids` |  |
| 9 | foundations | `p1-foundations/08-training-at-scale` | `foundations/training-at-scale` |  |
| 10 | generative | `p12-generative/52-diffusion-flow-matching` | `generative/diffusion-flow-matching` |  |
| 11 | generative | `p12-generative/57-nar-diffusion-lms` | `generative/nar-diffusion-lms` |  |
| 12 | generative | `p12-generative/55-speech-and-voice` | `generative/speech-and-voice` |  |
| 13 | generative | `p12-generative/58-multimodal-models` | `generative/multimodal-models` |  |
| 14 | generative | `p12-generative/50-beyond-text` | `generative/beyond-text` |  |
| 15 | adaptation | `p2-adaptation/09-sft-peft` | `adaptation/sft-peft` |  |
| 16 | adaptation | `p2-adaptation/10-rlhf-reward-modeling` | `adaptation/rlhf-reward-modeling` |  |
| 17 | adaptation | `p2-adaptation/11-dpo-variants` | `adaptation/dpo-variants` |  |
| 18 | adaptation | `p2-adaptation/12-synthetic-data-self-improvement` | `adaptation/synthetic-data-self-improvement` |  |
| 19 | reasoning | `p3-reasoning/13-eliciting-reasoning` | `reasoning/eliciting-reasoning` |  |
| 20 | reasoning | `p3-reasoning/14-training-to-reason` | `reasoning/training-to-reason` |  |
| 21 | reasoning | `p3-reasoning/15-inference-time-scaling` | `reasoning/inference-time-scaling` |  |
| 22 | inference | `p4-inference/16-serving-problem` | `inference/serving-problem` |  |
| 23 | inference | `p4-inference/17-memory-scheduling` | `inference/memory-scheduling` |  |
| 24 | inference | `p4-inference/18-faster-decoding` | `inference/faster-decoding` |  |
| 25 | inference | `p4-inference/19-quantization-kernels` | `inference/quantization-kernels` |  |
| 26 | inference | `p4-inference/20-structured-long-context` | `inference/structured-long-context` |  |
| 27 | inference | `p4-inference/21-serving-multimodal` | `inference/serving-multimodal` |  |
| 28 | orchestration | `p3-reasoning/16-training-agents-to-act` | `orchestration/training-agents-to-act` | **yes** |
| 29 | orchestration | `p5-orchestration/21-agent-architectures` | `orchestration/agent-architectures` |  |
| 30 | orchestration | `p5-orchestration/22-memory-systems` | `orchestration/memory-systems` |  |
| 31 | orchestration | `p5-orchestration/23-the-harness` | `orchestration/the-harness` |  |
| 32 | orchestration | `p5-orchestration/24-multi-agent-systems` | `orchestration/multi-agent-systems` |  |
| 33 | orchestration | `p5-orchestration/25-rag-retrieval` | `orchestration/rag-retrieval` |  |
| 34 | orchestration | `p5-orchestration/27-embeddings-representation` | `orchestration/embeddings-representation` |  |
| 35 | orchestration | `p5-orchestration/26-context-engineering` | `orchestration/context-engineering` |  |
| 36 | evaluation | `p6-evaluation/27-benchmarks` | `evaluation/benchmarks` |  |
| 37 | evaluation | `p6-evaluation/28-judging-holistic` | `evaluation/judging-holistic` |  |
| 38 | evaluation | `p6-evaluation/29-evaluating-agents` | `evaluation/evaluating-agents` |  |
| 39 | safety | `p8-safety/32-mechanistic-interpretability` | `safety/mechanistic-interpretability` |  |
| 40 | safety | `p8-safety/33-scalable-oversight-control` | `safety/scalable-oversight-control` |  |
| 41 | safety | `p8-safety/34-security-authorization` | `safety/security-authorization` |  |
| 42 | safety | `p8-safety/35-runtime-safety` | `safety/runtime-safety` |  |
| 43 | safety | `p8-safety/36-adversarial-robustness` | `safety/adversarial-robustness` |  |
| 44 | safety | `p8-safety/37-privacy-provenance-unlearning` | `safety/privacy-provenance-unlearning` |  |
| 45 | safety | `p8-safety/38-law-regulation-policy` | `safety/law-regulation-policy` |  |
| 46 | infrastructure | `p7-infrastructure/30-accelerators-networking` | `infrastructure/accelerators-networking` |  |
| 47 | infrastructure | `p7-infrastructure/31-orchestration-data-infra` | `infrastructure/orchestration-data-infra` |  |
| 48 | infrastructure | `p11-frontiers/45-the-compute-frontier` | `infrastructure/the-compute-frontier` | **yes** |
| 49 | infrastructure | `p11-frontiers/46-making-the-silicon` | `infrastructure/making-the-silicon` | **yes** |
| 50 | infrastructure | `p11-frontiers/47-powering-it` | `infrastructure/powering-it` | **yes** |
| 51 | infrastructure | `p11-frontiers/48-the-machine-that-breaks` | `infrastructure/the-machine-that-breaks` | **yes** |
| 52 | infrastructure | `p11-frontiers/49-where-learning-hits-limits` | `infrastructure/where-learning-hits-limits` | **yes** |
| 53 | infrastructure | `p11-frontiers/51-the-capability-horizon` | `infrastructure/the-capability-horizon` | **yes** |
| 54 | ecosystem | `p9-ecosystem/35-model-landscape` | `ecosystem/model-landscape` |  |
| 55 | ecosystem | `p9-ecosystem/36-tooling-ecosystem` | `ecosystem/tooling-ecosystem` |  |
| 56 | ecosystem | `p9-ecosystem/37-economics` | `ecosystem/economics` |  |
| 57 | practice | `p10-practical/38-choosing-a-model` | `practice/choosing-a-model` | **yes** |
| 58 | practice | `p10-practical/39-serving-and-compute` | `practice/serving-and-compute` | **yes** |
| 59 | practice | `p10-practical/56-edge-on-device` | `practice/edge-on-device` | **yes** |
| 60 | practice | `p10-practical/40-training-finetuning-practice` | `practice/training-finetuning-practice` | **yes** |
| 61 | practice | `p10-practical/41-agents-and-sandboxes` | `practice/agents-and-sandboxes` | **yes** |
| 62 | practice | `p10-practical/42-retrieval-and-documents` | `practice/retrieval-and-documents` | **yes** |
| 63 | practice | `p10-practical/43-evaluation-and-observability` | `practice/evaluation-and-observability` | **yes** |
| 64 | practice | `p10-practical/44-wiring-a-2026-stack` | `practice/wiring-a-2026-stack` | **yes** |
| 65 | practice | `p13-operations/52-deployment-lifecycle` | `practice/deployment-lifecycle` | **yes** |
| 66 | practice | `p13-operations/53-reliability-nondeterministic` | `practice/reliability-nondeterministic` | **yes** |
| 67 | practice | `p13-operations/54-production-data-engine` | `practice/production-data-engine` | **yes** |

## File renames (git mv, en + zh) and refs/*.bib

Each chapter: `git mv {lang}/<old> {lang}/<new>` and `git mv refs/<oldslug>.bib refs/<bareslug>.bib`.

| Old file | New file | Old bib | New bib |
|---|---|---|---|
| `p0-orientation/01-whole-stack.qmd` | `orientation/01-whole-stack.qmd` | `refs/01-whole-stack.bib` | `refs/whole-stack.bib` |
| `p0-orientation/02-field-map.qmd` | `orientation/02-field-map.qmd` | `refs/02-field-map.bib` | `refs/field-map.bib` |
| `p0-orientation/03-borrowed-ideas.qmd` | `orientation/03-borrowed-ideas.qmd` | `refs/03-borrowed-ideas.bib` | `refs/borrowed-ideas.bib` |
| `p1-foundations/03-scaling-laws.qmd` | `foundations/01-scaling-laws.qmd` | `refs/03-scaling-laws.bib` | `refs/scaling-laws.bib` |
| `p1-foundations/04-data-curation.qmd` | `foundations/02-data-curation.qmd` | `refs/04-data-curation.bib` | `refs/data-curation.bib` |
| `p1-foundations/05-tokenization.qmd` | `foundations/03-tokenization.qmd` | `refs/05-tokenization.bib` | `refs/tokenization.bib` |
| `p1-foundations/06-transformer-architecture.qmd` | `foundations/04-transformer-architecture.qmd` | `refs/06-transformer-architecture.bib` | `refs/transformer-architecture.bib` |
| `p1-foundations/07-moe-ssm-hybrids.qmd` | `foundations/05-moe-ssm-hybrids.qmd` | `refs/07-moe-ssm-hybrids.bib` | `refs/moe-ssm-hybrids.bib` |
| `p1-foundations/08-training-at-scale.qmd` | `foundations/06-training-at-scale.qmd` | `refs/08-training-at-scale.bib` | `refs/training-at-scale.bib` |
| `p12-generative/52-diffusion-flow-matching.qmd` | `generative/01-diffusion-flow-matching.qmd` | `refs/52-diffusion-flow-matching.bib` | `refs/diffusion-flow-matching.bib` |
| `p12-generative/57-nar-diffusion-lms.qmd` | `generative/02-nar-diffusion-lms.qmd` | `refs/57-nar-diffusion-lms.bib` | `refs/nar-diffusion-lms.bib` |
| `p12-generative/55-speech-and-voice.qmd` | `generative/03-speech-and-voice.qmd` | `refs/55-speech-and-voice.bib` | `refs/speech-and-voice.bib` |
| `p12-generative/58-multimodal-models.qmd` | `generative/04-multimodal-models.qmd` | `refs/58-multimodal-models.bib` | `refs/multimodal-models.bib` |
| `p12-generative/50-beyond-text.qmd` | `generative/05-beyond-text.qmd` | `refs/50-beyond-text.bib` | `refs/beyond-text.bib` |
| `p2-adaptation/09-sft-peft.qmd` | `adaptation/01-sft-peft.qmd` | `refs/09-sft-peft.bib` | `refs/sft-peft.bib` |
| `p2-adaptation/10-rlhf-reward-modeling.qmd` | `adaptation/02-rlhf-reward-modeling.qmd` | `refs/10-rlhf-reward-modeling.bib` | `refs/rlhf-reward-modeling.bib` |
| `p2-adaptation/11-dpo-variants.qmd` | `adaptation/03-dpo-variants.qmd` | `refs/11-dpo-variants.bib` | `refs/dpo-variants.bib` |
| `p2-adaptation/12-synthetic-data-self-improvement.qmd` | `adaptation/04-synthetic-data-self-improvement.qmd` | `refs/12-synthetic-data-self-improvement.bib` | `refs/synthetic-data-self-improvement.bib` |
| `p3-reasoning/13-eliciting-reasoning.qmd` | `reasoning/01-eliciting-reasoning.qmd` | `refs/13-eliciting-reasoning.bib` | `refs/eliciting-reasoning.bib` |
| `p3-reasoning/14-training-to-reason.qmd` | `reasoning/02-training-to-reason.qmd` | `refs/14-training-to-reason.bib` | `refs/training-to-reason.bib` |
| `p3-reasoning/15-inference-time-scaling.qmd` | `reasoning/03-inference-time-scaling.qmd` | `refs/15-inference-time-scaling.bib` | `refs/inference-time-scaling.bib` |
| `p4-inference/16-serving-problem.qmd` | `inference/01-serving-problem.qmd` | `refs/16-serving-problem.bib` | `refs/serving-problem.bib` |
| `p4-inference/17-memory-scheduling.qmd` | `inference/02-memory-scheduling.qmd` | `refs/17-memory-scheduling.bib` | `refs/memory-scheduling.bib` |
| `p4-inference/18-faster-decoding.qmd` | `inference/03-faster-decoding.qmd` | `refs/18-faster-decoding.bib` | `refs/faster-decoding.bib` |
| `p4-inference/19-quantization-kernels.qmd` | `inference/04-quantization-kernels.qmd` | `refs/19-quantization-kernels.bib` | `refs/quantization-kernels.bib` |
| `p4-inference/20-structured-long-context.qmd` | `inference/05-structured-long-context.qmd` | `refs/20-structured-long-context.bib` | `refs/structured-long-context.bib` |
| `p4-inference/21-serving-multimodal.qmd` | `inference/06-serving-multimodal.qmd` | `refs/21-serving-multimodal.bib` | `refs/serving-multimodal.bib` |
| `p3-reasoning/16-training-agents-to-act.qmd` | `orchestration/01-training-agents-to-act.qmd` | `refs/16-training-agents-to-act.bib` | `refs/training-agents-to-act.bib` |
| `p5-orchestration/21-agent-architectures.qmd` | `orchestration/02-agent-architectures.qmd` | `refs/21-agent-architectures.bib` | `refs/agent-architectures.bib` |
| `p5-orchestration/22-memory-systems.qmd` | `orchestration/03-memory-systems.qmd` | `refs/22-memory-systems.bib` | `refs/memory-systems.bib` |
| `p5-orchestration/23-the-harness.qmd` | `orchestration/04-the-harness.qmd` | `refs/23-the-harness.bib` | `refs/the-harness.bib` |
| `p5-orchestration/24-multi-agent-systems.qmd` | `orchestration/05-multi-agent-systems.qmd` | `refs/24-multi-agent-systems.bib` | `refs/multi-agent-systems.bib` |
| `p5-orchestration/25-rag-retrieval.qmd` | `orchestration/06-rag-retrieval.qmd` | `refs/25-rag-retrieval.bib` | `refs/rag-retrieval.bib` |
| `p5-orchestration/27-embeddings-representation.qmd` | `orchestration/07-embeddings-representation.qmd` | `refs/27-embeddings-representation.bib` | `refs/embeddings-representation.bib` |
| `p5-orchestration/26-context-engineering.qmd` | `orchestration/08-context-engineering.qmd` | `refs/26-context-engineering.bib` | `refs/context-engineering.bib` |
| `p6-evaluation/27-benchmarks.qmd` | `evaluation/01-benchmarks.qmd` | `refs/27-benchmarks.bib` | `refs/benchmarks.bib` |
| `p6-evaluation/28-judging-holistic.qmd` | `evaluation/02-judging-holistic.qmd` | `refs/28-judging-holistic.bib` | `refs/judging-holistic.bib` |
| `p6-evaluation/29-evaluating-agents.qmd` | `evaluation/03-evaluating-agents.qmd` | `refs/29-evaluating-agents.bib` | `refs/evaluating-agents.bib` |
| `p8-safety/32-mechanistic-interpretability.qmd` | `safety/01-mechanistic-interpretability.qmd` | `refs/32-mechanistic-interpretability.bib` | `refs/mechanistic-interpretability.bib` |
| `p8-safety/33-scalable-oversight-control.qmd` | `safety/02-scalable-oversight-control.qmd` | `refs/33-scalable-oversight-control.bib` | `refs/scalable-oversight-control.bib` |
| `p8-safety/34-security-authorization.qmd` | `safety/03-security-authorization.qmd` | `refs/34-security-authorization.bib` | `refs/security-authorization.bib` |
| `p8-safety/35-runtime-safety.qmd` | `safety/04-runtime-safety.qmd` | `refs/35-runtime-safety.bib` | `refs/runtime-safety.bib` |
| `p8-safety/36-adversarial-robustness.qmd` | `safety/05-adversarial-robustness.qmd` | `refs/36-adversarial-robustness.bib` | `refs/adversarial-robustness.bib` |
| `p8-safety/37-privacy-provenance-unlearning.qmd` | `safety/06-privacy-provenance-unlearning.qmd` | `refs/37-privacy-provenance-unlearning.bib` | `refs/privacy-provenance-unlearning.bib` |
| `p8-safety/38-law-regulation-policy.qmd` | `safety/07-law-regulation-policy.qmd` | `refs/38-law-regulation-policy.bib` | `refs/law-regulation-policy.bib` |
| `p7-infrastructure/30-accelerators-networking.qmd` | `infrastructure/01-accelerators-networking.qmd` | `refs/30-accelerators-networking.bib` | `refs/accelerators-networking.bib` |
| `p7-infrastructure/31-orchestration-data-infra.qmd` | `infrastructure/02-orchestration-data-infra.qmd` | `refs/31-orchestration-data-infra.bib` | `refs/orchestration-data-infra.bib` |
| `p11-frontiers/45-the-compute-frontier.qmd` | `infrastructure/03-the-compute-frontier.qmd` | `refs/45-the-compute-frontier.bib` | `refs/the-compute-frontier.bib` |
| `p11-frontiers/46-making-the-silicon.qmd` | `infrastructure/04-making-the-silicon.qmd` | `refs/46-making-the-silicon.bib` | `refs/making-the-silicon.bib` |
| `p11-frontiers/47-powering-it.qmd` | `infrastructure/05-powering-it.qmd` | `refs/47-powering-it.bib` | `refs/powering-it.bib` |
| `p11-frontiers/48-the-machine-that-breaks.qmd` | `infrastructure/06-the-machine-that-breaks.qmd` | `refs/48-the-machine-that-breaks.bib` | `refs/the-machine-that-breaks.bib` |
| `p11-frontiers/49-where-learning-hits-limits.qmd` | `infrastructure/07-where-learning-hits-limits.qmd` | `refs/49-where-learning-hits-limits.bib` | `refs/where-learning-hits-limits.bib` |
| `p11-frontiers/51-the-capability-horizon.qmd` | `infrastructure/08-the-capability-horizon.qmd` | `refs/51-the-capability-horizon.bib` | `refs/the-capability-horizon.bib` |
| `p9-ecosystem/35-model-landscape.qmd` | `ecosystem/01-model-landscape.qmd` | `refs/35-model-landscape.bib` | `refs/model-landscape.bib` |
| `p9-ecosystem/36-tooling-ecosystem.qmd` | `ecosystem/02-tooling-ecosystem.qmd` | `refs/36-tooling-ecosystem.bib` | `refs/tooling-ecosystem.bib` |
| `p9-ecosystem/37-economics.qmd` | `ecosystem/03-economics.qmd` | `refs/37-economics.bib` | `refs/economics.bib` |
| `p10-practical/38-choosing-a-model.qmd` | `practice/01-choosing-a-model.qmd` | `refs/38-choosing-a-model.bib` | `refs/choosing-a-model.bib` |
| `p10-practical/39-serving-and-compute.qmd` | `practice/02-serving-and-compute.qmd` | `refs/39-serving-and-compute.bib` | `refs/serving-and-compute.bib` |
| `p10-practical/56-edge-on-device.qmd` | `practice/03-edge-on-device.qmd` | `refs/56-edge-on-device.bib` | `refs/edge-on-device.bib` |
| `p10-practical/40-training-finetuning-practice.qmd` | `practice/04-training-finetuning-practice.qmd` | `refs/40-training-finetuning-practice.bib` | `refs/training-finetuning-practice.bib` |
| `p10-practical/41-agents-and-sandboxes.qmd` | `practice/05-agents-and-sandboxes.qmd` | `refs/41-agents-and-sandboxes.bib` | `refs/agents-and-sandboxes.bib` |
| `p10-practical/42-retrieval-and-documents.qmd` | `practice/06-retrieval-and-documents.qmd` | `refs/42-retrieval-and-documents.bib` | `refs/retrieval-and-documents.bib` |
| `p10-practical/43-evaluation-and-observability.qmd` | `practice/07-evaluation-and-observability.qmd` | `refs/43-evaluation-and-observability.bib` | `refs/evaluation-and-observability.bib` |
| `p10-practical/44-wiring-a-2026-stack.qmd` | `practice/08-wiring-a-2026-stack.qmd` | `refs/44-wiring-a-2026-stack.bib` | `refs/wiring-a-2026-stack.bib` |
| `p13-operations/52-deployment-lifecycle.qmd` | `practice/09-deployment-lifecycle.qmd` | `refs/52-deployment-lifecycle.bib` | `refs/deployment-lifecycle.bib` |
| `p13-operations/53-reliability-nondeterministic.qmd` | `practice/10-reliability-nondeterministic.qmd` | `refs/53-reliability-nondeterministic.bib` | `refs/reliability-nondeterministic.bib` |
| `p13-operations/54-production-data-engine.qmd` | `practice/11-production-data-engine.qmd` | `refs/54-production-data-engine.bib` | `refs/production-data-engine.bib` |

## nginx 301 map

One `location ~` per old path -> new path. Old URLs are the currently-published numbered paths; targets are the final number-free paths.

```nginx
location ~ ^/(en|zh)/p0\-orientation/01\-whole\-stack(?:\.html)?/?$ { return 301 /$1/orientation/whole-stack; }
location ~ ^/(en|zh)/p0\-orientation/02\-field\-map(?:\.html)?/?$ { return 301 /$1/orientation/field-map; }
location ~ ^/(en|zh)/p0\-orientation/03\-borrowed\-ideas(?:\.html)?/?$ { return 301 /$1/orientation/borrowed-ideas; }
location ~ ^/(en|zh)/p1\-foundations/03\-scaling\-laws(?:\.html)?/?$ { return 301 /$1/foundations/scaling-laws; }
location ~ ^/(en|zh)/p1\-foundations/04\-data\-curation(?:\.html)?/?$ { return 301 /$1/foundations/data-curation; }
location ~ ^/(en|zh)/p1\-foundations/05\-tokenization(?:\.html)?/?$ { return 301 /$1/foundations/tokenization; }
location ~ ^/(en|zh)/p1\-foundations/06\-transformer\-architecture(?:\.html)?/?$ { return 301 /$1/foundations/transformer-architecture; }
location ~ ^/(en|zh)/p1\-foundations/07\-moe\-ssm\-hybrids(?:\.html)?/?$ { return 301 /$1/foundations/moe-ssm-hybrids; }
location ~ ^/(en|zh)/p1\-foundations/08\-training\-at\-scale(?:\.html)?/?$ { return 301 /$1/foundations/training-at-scale; }
location ~ ^/(en|zh)/p12\-generative/52\-diffusion\-flow\-matching(?:\.html)?/?$ { return 301 /$1/generative/diffusion-flow-matching; }
location ~ ^/(en|zh)/p12\-generative/57\-nar\-diffusion\-lms(?:\.html)?/?$ { return 301 /$1/generative/nar-diffusion-lms; }
location ~ ^/(en|zh)/p12\-generative/55\-speech\-and\-voice(?:\.html)?/?$ { return 301 /$1/generative/speech-and-voice; }
location ~ ^/(en|zh)/p12\-generative/58\-multimodal\-models(?:\.html)?/?$ { return 301 /$1/generative/multimodal-models; }
location ~ ^/(en|zh)/p12\-generative/50\-beyond\-text(?:\.html)?/?$ { return 301 /$1/generative/beyond-text; }
location ~ ^/(en|zh)/p2\-adaptation/09\-sft\-peft(?:\.html)?/?$ { return 301 /$1/adaptation/sft-peft; }
location ~ ^/(en|zh)/p2\-adaptation/10\-rlhf\-reward\-modeling(?:\.html)?/?$ { return 301 /$1/adaptation/rlhf-reward-modeling; }
location ~ ^/(en|zh)/p2\-adaptation/11\-dpo\-variants(?:\.html)?/?$ { return 301 /$1/adaptation/dpo-variants; }
location ~ ^/(en|zh)/p2\-adaptation/12\-synthetic\-data\-self\-improvement(?:\.html)?/?$ { return 301 /$1/adaptation/synthetic-data-self-improvement; }
location ~ ^/(en|zh)/p3\-reasoning/13\-eliciting\-reasoning(?:\.html)?/?$ { return 301 /$1/reasoning/eliciting-reasoning; }
location ~ ^/(en|zh)/p3\-reasoning/14\-training\-to\-reason(?:\.html)?/?$ { return 301 /$1/reasoning/training-to-reason; }
location ~ ^/(en|zh)/p3\-reasoning/15\-inference\-time\-scaling(?:\.html)?/?$ { return 301 /$1/reasoning/inference-time-scaling; }
location ~ ^/(en|zh)/p4\-inference/16\-serving\-problem(?:\.html)?/?$ { return 301 /$1/inference/serving-problem; }
location ~ ^/(en|zh)/p4\-inference/17\-memory\-scheduling(?:\.html)?/?$ { return 301 /$1/inference/memory-scheduling; }
location ~ ^/(en|zh)/p4\-inference/18\-faster\-decoding(?:\.html)?/?$ { return 301 /$1/inference/faster-decoding; }
location ~ ^/(en|zh)/p4\-inference/19\-quantization\-kernels(?:\.html)?/?$ { return 301 /$1/inference/quantization-kernels; }
location ~ ^/(en|zh)/p4\-inference/20\-structured\-long\-context(?:\.html)?/?$ { return 301 /$1/inference/structured-long-context; }
location ~ ^/(en|zh)/p4\-inference/21\-serving\-multimodal(?:\.html)?/?$ { return 301 /$1/inference/serving-multimodal; }
location ~ ^/(en|zh)/p3\-reasoning/16\-training\-agents\-to\-act(?:\.html)?/?$ { return 301 /$1/orchestration/training-agents-to-act; }
location ~ ^/(en|zh)/p5\-orchestration/21\-agent\-architectures(?:\.html)?/?$ { return 301 /$1/orchestration/agent-architectures; }
location ~ ^/(en|zh)/p5\-orchestration/22\-memory\-systems(?:\.html)?/?$ { return 301 /$1/orchestration/memory-systems; }
location ~ ^/(en|zh)/p5\-orchestration/23\-the\-harness(?:\.html)?/?$ { return 301 /$1/orchestration/the-harness; }
location ~ ^/(en|zh)/p5\-orchestration/24\-multi\-agent\-systems(?:\.html)?/?$ { return 301 /$1/orchestration/multi-agent-systems; }
location ~ ^/(en|zh)/p5\-orchestration/25\-rag\-retrieval(?:\.html)?/?$ { return 301 /$1/orchestration/rag-retrieval; }
location ~ ^/(en|zh)/p5\-orchestration/27\-embeddings\-representation(?:\.html)?/?$ { return 301 /$1/orchestration/embeddings-representation; }
location ~ ^/(en|zh)/p5\-orchestration/26\-context\-engineering(?:\.html)?/?$ { return 301 /$1/orchestration/context-engineering; }
location ~ ^/(en|zh)/p6\-evaluation/27\-benchmarks(?:\.html)?/?$ { return 301 /$1/evaluation/benchmarks; }
location ~ ^/(en|zh)/p6\-evaluation/28\-judging\-holistic(?:\.html)?/?$ { return 301 /$1/evaluation/judging-holistic; }
location ~ ^/(en|zh)/p6\-evaluation/29\-evaluating\-agents(?:\.html)?/?$ { return 301 /$1/evaluation/evaluating-agents; }
location ~ ^/(en|zh)/p8\-safety/32\-mechanistic\-interpretability(?:\.html)?/?$ { return 301 /$1/safety/mechanistic-interpretability; }
location ~ ^/(en|zh)/p8\-safety/33\-scalable\-oversight\-control(?:\.html)?/?$ { return 301 /$1/safety/scalable-oversight-control; }
location ~ ^/(en|zh)/p8\-safety/34\-security\-authorization(?:\.html)?/?$ { return 301 /$1/safety/security-authorization; }
location ~ ^/(en|zh)/p8\-safety/35\-runtime\-safety(?:\.html)?/?$ { return 301 /$1/safety/runtime-safety; }
location ~ ^/(en|zh)/p8\-safety/36\-adversarial\-robustness(?:\.html)?/?$ { return 301 /$1/safety/adversarial-robustness; }
location ~ ^/(en|zh)/p8\-safety/37\-privacy\-provenance\-unlearning(?:\.html)?/?$ { return 301 /$1/safety/privacy-provenance-unlearning; }
location ~ ^/(en|zh)/p8\-safety/38\-law\-regulation\-policy(?:\.html)?/?$ { return 301 /$1/safety/law-regulation-policy; }
location ~ ^/(en|zh)/p7\-infrastructure/30\-accelerators\-networking(?:\.html)?/?$ { return 301 /$1/infrastructure/accelerators-networking; }
location ~ ^/(en|zh)/p7\-infrastructure/31\-orchestration\-data\-infra(?:\.html)?/?$ { return 301 /$1/infrastructure/orchestration-data-infra; }
location ~ ^/(en|zh)/p11\-frontiers/45\-the\-compute\-frontier(?:\.html)?/?$ { return 301 /$1/infrastructure/the-compute-frontier; }
location ~ ^/(en|zh)/p11\-frontiers/46\-making\-the\-silicon(?:\.html)?/?$ { return 301 /$1/infrastructure/making-the-silicon; }
location ~ ^/(en|zh)/p11\-frontiers/47\-powering\-it(?:\.html)?/?$ { return 301 /$1/infrastructure/powering-it; }
location ~ ^/(en|zh)/p11\-frontiers/48\-the\-machine\-that\-breaks(?:\.html)?/?$ { return 301 /$1/infrastructure/the-machine-that-breaks; }
location ~ ^/(en|zh)/p11\-frontiers/49\-where\-learning\-hits\-limits(?:\.html)?/?$ { return 301 /$1/infrastructure/where-learning-hits-limits; }
location ~ ^/(en|zh)/p11\-frontiers/51\-the\-capability\-horizon(?:\.html)?/?$ { return 301 /$1/infrastructure/the-capability-horizon; }
location ~ ^/(en|zh)/p9\-ecosystem/35\-model\-landscape(?:\.html)?/?$ { return 301 /$1/ecosystem/model-landscape; }
location ~ ^/(en|zh)/p9\-ecosystem/36\-tooling\-ecosystem(?:\.html)?/?$ { return 301 /$1/ecosystem/tooling-ecosystem; }
location ~ ^/(en|zh)/p9\-ecosystem/37\-economics(?:\.html)?/?$ { return 301 /$1/ecosystem/economics; }
location ~ ^/(en|zh)/p10\-practical/38\-choosing\-a\-model(?:\.html)?/?$ { return 301 /$1/practice/choosing-a-model; }
location ~ ^/(en|zh)/p10\-practical/39\-serving\-and\-compute(?:\.html)?/?$ { return 301 /$1/practice/serving-and-compute; }
location ~ ^/(en|zh)/p10\-practical/56\-edge\-on\-device(?:\.html)?/?$ { return 301 /$1/practice/edge-on-device; }
location ~ ^/(en|zh)/p10\-practical/40\-training\-finetuning\-practice(?:\.html)?/?$ { return 301 /$1/practice/training-finetuning-practice; }
location ~ ^/(en|zh)/p10\-practical/41\-agents\-and\-sandboxes(?:\.html)?/?$ { return 301 /$1/practice/agents-and-sandboxes; }
location ~ ^/(en|zh)/p10\-practical/42\-retrieval\-and\-documents(?:\.html)?/?$ { return 301 /$1/practice/retrieval-and-documents; }
location ~ ^/(en|zh)/p10\-practical/43\-evaluation\-and\-observability(?:\.html)?/?$ { return 301 /$1/practice/evaluation-and-observability; }
location ~ ^/(en|zh)/p10\-practical/44\-wiring\-a\-2026\-stack(?:\.html)?/?$ { return 301 /$1/practice/wiring-a-2026-stack; }
location ~ ^/(en|zh)/p13\-operations/52\-deployment\-lifecycle(?:\.html)?/?$ { return 301 /$1/practice/deployment-lifecycle; }
location ~ ^/(en|zh)/p13\-operations/53\-reliability\-nondeterministic(?:\.html)?/?$ { return 301 /$1/practice/reliability-nondeterministic; }
location ~ ^/(en|zh)/p13\-operations/54\-production\-data\-engine(?:\.html)?/?$ { return 301 /$1/practice/production-data-engine; }
```
