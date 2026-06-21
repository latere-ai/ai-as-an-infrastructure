# Proposed Content: Gaps and Expansions (roadmap)

Status note (kept current): the original audit ran against an earlier ~51-chapter
draft. Every **spine gap** it identified has since shipped as a real chapter, and
one **scope-expansion** item (embeddings) has now been built too. What remains is
the rest of the scope-expansion menu, tracked below.

## Spine gaps: all implemented

The doc's entire "recommended minimal high-value set" (and the next two) now exist
and deliver the content, verified by spot-check:

- Runtime safety / guardrails → `p8-safety/35-runtime-safety`
- Adversarial robustness & red-teaming → `p8-safety/36-adversarial-robustness`
- Privacy, provenance, unlearning (DP, membership inference, C2PA, watermark) →
  `p8-safety/37-privacy-provenance-unlearning`
- Law, regulation, policy (EU AI Act, copyright, model cards, liability) →
  `p8-safety/38-law-regulation-policy`
- Deployment lifecycle → `p12-operations/52-deployment-lifecycle`
- Reliability for nondeterministic systems → `p12-operations/53-reliability-nondeterministic`
- Production data engine → `p12-operations/54-production-data-engine`
- Serving multimodal models → `p4-inference/21-serving-multimodal`

No spine gaps remain.

## Scope expansion: progress

This broadens *what the book is about* (beyond the autoregressive-text spine). A
different-book decision, taken one chapter at a time.

- [x] **Embeddings & representation learning** → `p5-orchestration/27-embeddings-representation`
  (contrastive training, in-batch/hard negatives, SimCSE, Matryoshka,
  instruction-tuned and LLM-bootstrapped embedders, MTEB). Built; the RAG chapter
  used embeddings, this teaches how they are trained.
- [x] **Diffusion & flow matching** → `p11-frontiers/52-diffusion-flow-matching`
  (DDPM/noise-prediction, score/SDE + probability-flow ODE, DDIM, latent
  diffusion, classifier-free guidance, DiT, flow matching / rectified flow,
  consistency models, and the loop back to text via LLaDA). Built; placed before
  `50-beyond-text`, which references flow matching but did not teach it.
- [x] **Speech & realtime voice** → `p11-frontiers/55-speech-and-voice`
  (ASR: Conformer/wav2vec 2.0/Whisper; neural codecs and audio-as-tokens;
  audio LMs and codec-LM TTS with zero-shot voice cloning; full-duplex
  speech-to-speech and the latency budget). Built; placed after the diffusion
  chapter in the generative-media cluster.
- [ ] **Non-autoregressive / diffusion language models** — distinct from
  speculative decoding (which is AR acceleration).
- [ ] **Edge & on-device** — mobile NPUs, privacy-local inference,
  edge-constrained quantization.

A full **generative/multimodal Part** would fold the first four together (lift
`50-beyond-text`'s native-multimodality section into a real chapter, add
image/video/audio generation). That remains the larger "broaden the book"
decision.

## Deliberately ceded (unchanged)

- **Product / UX / human-interface layer** — the field-map chapter consciously
  offloads the application layer to Huyen's *AI Engineering*. A boundary the
  author drew on purpose; flag, do not fill.
