# Proposed Content: Gaps and Expansions

A coverage audit of the 51 chapters against the book's own thesis (compute to a
*deployed and governed* behavior) and its title (*AI as an **Infrastructure***).
Findings cluster in three buckets. Each item is tagged on one axis the author
has to decide:

- **Spine gap**: the book *promised* this and did not deliver it. Cheap to
  justify, fills the existing arc.
- **Scope expansion**: this broadens *what the book is about*. A different-book
  decision, not a hole.

The existing book is genuinely comprehensive; this is not a list of oversights
so much as a ranked menu. The **minimal high-value set** at the bottom is the
recommended subset.

---

## Bucket 1 (lead): Deployed governance and runtime safety  — SPINE GAP

The thesis is "compute to a deployed and *governed* behavior," and Part VIII is
named "Safety, Interpretability, and **Governance**." But Part VIII delivers
*technical control* (interpretability, scalable oversight, authorization) and
leaves the governance half thin or absent. This is the cleanest "you said you
would cover this" gap.

Evidence from the audit:

- **Runtime guardrails / content-safety infrastructure** — passing mentions
  only (gateway feature tables in ch 39/44; red-team tools in ch 43). No
  treatment of moderation models, safety classifiers, or input/output filtering
  as a deployed pipeline. ch 33/34 are training-time oversight and
  authorization, *not* the inference-time safety layer.
- **Adversarial robustness as a discipline** — scattered across ch 33 (control
  threat model), ch 34 (prompt injection as an authorization problem), ch 43
  (red-team tooling), with no dedicated home. Jailbreak taxonomy, prompt-
  injection *defenses*, and red-teaming methodology have no chapter.
- **Privacy** — passing only. Data residency appears as a *deployment* choice
  (ch 38-42), not a privacy control. Differential privacy, membership
  inference, and the right to erasure are absent.
- **Machine unlearning / knowledge editing** — absent entirely (only
  "catastrophic forgetting" as a problem in ch 14/49).
- **Provenance, watermarking, content authenticity (C2PA)** — absent;
  "provenance" appears only in the data-sourcing/retrieval sense.
- **Legal / regulatory / policy governance** — absent. No EU AI Act, copyright
  and training-data licensing, liability, or model cards / transparency
  reporting as a governance instrument.

**Proposed (new chapters appended to Part VIII, or a split into VIII-Safety and
a new IX-Governance):**

1. **Runtime safety: guardrails, moderation, and the inference-time policy
   layer** — safety classifiers, I/O filtering, refusal/over-refusal as a
   served behavior, where the guardrail sits relative to the gateway.
2. **Adversarial robustness and red-teaming** — jailbreak and prompt-injection
   taxonomy, defenses, red-teaming as a measured discipline (pairs with the
   existing "adversarial verification" motif).
3. **Privacy, provenance, and unlearning** — DP, membership inference,
   data residency as a privacy control, machine unlearning / knowledge editing,
   watermarking and C2PA.
4. **Law, regulation, and policy** — EU AI Act and the regulatory map,
   copyright and data licensing, liability, transparency reporting and model
   cards. (Pairs naturally with the existing PUBLISH-GATED model-landscape
   chapter.)

---

## Bucket 2 (lead): Operating AI in production (SRE for AI)  — SPINE GAP

The *title* is "AI as an **Infrastructure**," and operations is the run-time
half of infrastructure. The book has build-time infra in depth (clusters,
serving internals, training-time fault tolerance in ch 48) but not the
operational discipline of *running* deployed model systems. This is distinct
from Huyen's application layer: it is the frontier-scale SRE/platform layer,
squarely on-title.

Evidence from the audit:

- **Deployment lifecycle / LLMOps** — scattered. A/B routing is covered (ch 43),
  but model versioning/registry, canary/blue-green, drift *detection
  mechanisms*, incident response, and on-call are absent.
- **Reliability engineering for nondeterministic systems** — partial. Training-
  time reliability is strong (ch 48); deployment-time SLO/SLI frameworks,
  graceful model-down degradation, and fallback-chain design are absent.
- **The data flywheel as ongoing operations** — concept is strong (ch 12), but
  the annotation/labeling supply chain, production-feedback pipelines, and
  active learning as a running system are absent.
- **Operational FinOps** — macroeconomics is strong (ch 37), but cost
  attribution / showback, per-feature unit economics in production, and
  capacity forecasting as a discipline are absent.
- **On-device / edge** — light. Localhost dev (Ollama, MLX, llama.cpp/GGUF) is
  covered; mobile NPUs, privacy-local deployment, and edge optimization are
  absent.

**Proposed (a new Part, e.g. "Operating AI in Production," after Part VII or
folded into the Practical Part X):**

5. **The deployment lifecycle** — versioning, rollout (canary/blue-green),
   drift detection, incident response and on-call for model systems.
6. **Reliability for nondeterministic systems** — SLOs/SLIs when output is
   stochastic, fallback chains, graceful degradation, multi-step reliability
   decay (ties to ch 48 and ch 51).
7. **The production data engine** — labeling operations, feedback collection,
   active learning, closing the loop from a production failure to a training
   example.
8. *(optional)* **Edge and on-device deployment** — NPUs, privacy-local,
   edge-constrained quantization.

---

## Bucket 3: The generative and multimodal stack  — SCOPE EXPANSION (mostly)

The book is deliberately the *autoregressive-text* stack. ch 50 gestures at
multimodality and world models as a frontier *critique*, but the generative-
media stack is not *taught*. Expanding it is a different-book decision, with one
exception that is a true spine gap.

Evidence from the audit:

- **Diffusion / flow matching / VAE / latent diffusion** — not taught; flow
  matching is named once in ch 50. Image generation absent; video appears only
  as a world-model critique.
- **Speech / voice (ASR, TTS, realtime duplex agents)** — entirely absent.
- **Embeddings / representation learning / contrastive training** — incidental
  in RAG (ch 25/42); no first-class treatment of how embedding models are
  trained.
- **Non-autoregressive / diffusion language models** — absent (only speculative
  decoding, which is autoregressive acceleration).

**The in-spine quick win (promote this one):**

9. **Serving multimodal models** — insert into the ordered Part IV. Part IV is
   text-only, yet vision tokens blow up the KV cache and reshape batching and
   prefill. That is a genuine constraint-arrow gap sitting inside the existing
   spine, independent of whether the book broadens modality scope.

**The expansion option (a new Part if the author wants to broaden scope):** a
Part on the generative/multimodal stack — diffusion/flow/VAE foundations,
multimodal training and fusion (lift ch 50's native-multimodality section into a
real chapter), image/video/audio generation, speech and realtime voice,
embeddings and representation learning. This is what would make the title's
"AI" mean more than "LLMs."

---

## Deliberately ceded (noted for completeness, not proposed)

- **Product / UX / human-interface layer** — UX of AI products, streaming-UI
  patterns, perceived latency, trust calibration, designing for model failure.
  Absent, but the field-map chapter consciously offloads the application layer
  to Huyen's *AI Engineering*. This is a boundary the author already drew; flag,
  do not fill.

---

## Recommended minimal high-value set

If only a handful of additions are made, these fill the clearest promised-but-
missing holes for the least scope creep:

1. Runtime safety / guardrails (Bucket 1, ch 1)
2. Privacy, provenance, and unlearning (Bucket 1, ch 3)
3. Law, regulation, and policy (Bucket 1, ch 4)
4. The deployment lifecycle + reliability for nondeterministic systems
   (Bucket 2, ch 5-6, possibly merged into one)
5. Serving multimodal models (Bucket 3, ch 9 — inserted into Part IV)

Five chapters, all spine gaps, no scope expansion. Adversarial robustness
(Bucket 1, ch 2) and the production data engine (Bucket 2, ch 7) are the next
two if appetite allows. The full generative/multimodal Part is the separate,
larger "broaden the book" decision.
