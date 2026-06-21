# Interactive Visualization Roadmap

Where to add explorable / animated figures (like the attention-weight heatmap and
the 5-step "one forward pass" carousel in the design mockup) across the book.
Produced from a full-book survey (every chapter, p0→p12).

## How figures work today

Interactive figures are authored in `.qmd` as:

```html
<figure>
<div class="viz" data-viz="NAME" data-...></div>
<figcaption>...</figcaption>
</figure>
```

`viz-runtime.html` registers the component `NAME` as `R['NAME'] = function(host){...}`,
using shared `canvas()`, `slider()`, `el()`, and `theme()` helpers (theme-aware,
lazy-booted after hydration).

**Today only four components exist:** `curve` (generic single-knob plotter, used 9×),
`kv-cache`, `softmax-temperature`, `embeddings-3d`. **The attention-heatmap and the
stepper from the design are not built yet** — they are net-new (but reuse the
canvas/slider/theme scaffolding). Every proposal below is flagged *reuse* (cheap,
author a block) or *new component* (build once, then reused N×).

> Note: every figure needs its `zh/` twin (same path, same `{#sec}`/`@fig` labels).

## Build order (maximize reuse)

The survey converged hard on this: build **5 reusable primitives**, and ~35 of the
placements fall out of them.

| # | Component | Unlocks (count) | Effort |
|---|-----------|-----------------|--------|
| 1 | **Stepper / carousel** (the design's 5-step pattern) | BPE merge, DPO derivation, RLHF loop, R1 pipeline, spec-decode, continuous-batching, ReAct loop, control protocol, jailbreak swiss-cheese, privacy lifecycle, prefill/decode (~11) | medium once, then low |
| 2 | **Attention-heatmap** (matrix + click-row bars) | ch06 attention (the canonical one), LoRA low-rank, attention-sink, judge κ confusion-matrix (~4) | medium |
| 3 | **2D mechanism canvas** (nodes/grid/vectors animating) | MoE routing, PagedAttention allocator, superposition geometry, InfoNCE field, outlier-quant grid, task arithmetic, MinHash buckets, tree-of-thoughts, bandwidth tiers, blast radius (~10) | medium each |
| 4 | **Cost-calculator** (two crossing cost lines + sliders) | build-vs-buy, long-context-vs-retrieval, fine-tune break-even, serverless-vs-reserved (~4, same component relabeled) | medium once, then trivial |
| 5 | **Comparison-explorer** (filter/sort table) | agent frameworks (ch41). ch35/ch36 dropped: neither has a sortable table in the source (ch35 is a 5×5 disclosure matrix, ch36 is prose around four primitives); a filter table there would mean inventing content | medium once |
| + | **`curve` extensions** (2-knob, `p^n`, logistic-sequence) | ~9 near-free curve placements | low |

Recommended sequence: **Stepper → Attention-heatmap → Cost-calculator → 2D-canvas
→ Comparison-explorer**, authoring the cheap `curve` reuses opportunistically.

## Status (26 components live; all Tier-1, every named item, most of the catalog done)

`viz-runtime.html` now registers **26 distinct interactive components**, all authored in
both languages and live on `aaai.latere.ai`:

- Primitives: `curve` (10 families incl. `u-shape`, `pow-base`, `elo`, `power-grow`),
  `stepper`, `attention-heatmap`, `cost-crossover`, `comparison-explorer`, `embeddings-3d`,
  `softmax-temperature`, `kv-cache`.
- 2D-canvas: `superposition`, `paged-attention`, `moe-routing`, `tree-of-thoughts`,
  `infonce-field`, `nested-loops`, `bandwidth-tiers`, `judge-kappa`, `outlier-quant`,
  `minhash-buckets`, `blast-radius`, `lora-lowrank`, `task-arithmetic`, `grpo-advantage`,
  `ssm-vs-attention`, `rl-timeline`, `rrf-fusion`, `pipeline-bubble`, `float-bits`.
- DOM: `decision-tree`, `float-bits`.

All 10 Tier-1 signature spots, all 6 process steppers (BPE, spec-decode, R1, ReAct,
control-protocol, privacy, DPO-derivation, RLHF-loop, prefill/decode, swiss-cheese,
GRPO), and the bulk of the full catalog are done.

**Genuinely remaining (low-value or double-covered; the chapter already carries a
related interactive):** swap-the-judge (ch12), spec-decode-payoff curve (ch18),
continuous-batching stepper (ch17, has paged-attention), RAG-interaction explorer
(ch25, has rrf-fusion), SAE dictionary (ch32, has superposition), time-to-power (ch47),
cross-datacenter latency (ch48). Pick up opportunistically. `verbosity-bias` (ch28) is
deliberately skipped: a static figure already covers it.

---

## Tier 1 — signature spots (build these first, highest delight × payoff)

1. **Attention-weight heatmap** — `p1-foundations/06-transformer-architecture.qmd`, *attention*.
   The canonical figure (it's already the design mockup's 图 6.1). Click a query row → normalized attention bars. *Component 2.*
2. **MoE routing & collapse** — `p1-foundations/07-moe-ssm-hybrids.qmd`, *The router and its pathologies*.
   Tokens → gate scores → top-k light up → weighted sum; capacity-factor slider drops overflow tokens; toggle balanced vs collapsed routing. *Component 3.* The single richest mechanism in Part 1.
3. **PagedAttention block allocator** — `p4-inference/17-memory-scheduling.qmd`, *The cache as virtual memory*.
   Requests grow token-by-token, block table arrows to scattered physical blocks, freeing reclaims them; toggle contiguous-reserve vs paged → live utilization %. *Component 3.* Marquee idea of Part 4 (ch17/18 have zero interactives today).
4. **Superposition geometry** — `p8-safety/32-mechanistic-interpretability.qmd`, *Two ideas that climb the wall*.
   Feature vectors on a disk; a sparsity slider packs n>d features and they snap into the Toy-Models polygons with an interference readout. *Component 3.* The iconic image of the field.
5. **Speculative-decoding stepper** — `p4-inference/18-faster-decoding.qmd`, *Inside the verification step*.
   Draft proposes γ tokens → one target pass → walk accept(green)/reject(red) → resample. *Component 1.*
6. **Tree-of-thoughts search** — `p3-reasoning/13-eliciting-reasoning.qmd`, *Shape the chain, then search the space*.
   Pick chain / BFS-tree / value-guided; nodes expand, self-score, dead ends gray out and backtrack; a reliability knob makes a bad evaluator prune good branches. *Component 3* (most bespoke).
7. **Three nested loops** — `p0-orientation/01-whole-stack.qmd`, *Three nested loops*.
   Training (runs once) ⊂ inference (per request) ⊂ agentic (model↔tool), cycling at different rates. The book's central mental model. *Component 3.*
8. **Build-vs-buy break-even** — `p9-ecosystem/37-economics.qmd`, *Running the two numbers*.
   `V > F/(p−c)`: two cost lines, sliders for F/c/p + annual price decline, live crossover + "re-check next year" ghost line. *Component 4*, the template for 3 more.
9. **BPE merge stepper** — `p1-foundations/05-tokenization.qmd`, *The subword bargain*.
   Step the worked corpus; each step highlights and merges the most frequent pair. *Component 1*, lowest-effort stepper.
10. **Three bandwidth tiers** — `p7-infrastructure/30-accelerators-networking.qmd`, *Three tiers of bandwidth*.
    A byte traverses HBM→NVLink→inter-node at proportional speeds; compute/comm slider makes a collective vanish or stay exposed; toggle fat-tree vs TPU torus. *Component 3.*

---

## Full catalog by part

### Part 0–1 (foundations)
- **MoE routing & collapse** (ch07) — *Tier 1 #2*.
- **BPE merge stepper** (ch05) — *Tier 1 #9*.
- **Attention heatmap** (ch06) — *Tier 1 #1*.
- **Scaling-allocation explorer** (ch03, *Kaplan, then Chinchilla*) — drag budget C and N:D split, loss curve + optimal-point marker move; Kaplan/Chinchilla/inference-aware as reference points. *curve 2-knob extension.*
- **Pipeline-bubble timeline** (ch08, *Turning the dials*) — sliders for stages p and micro-batches m; grid animates fill/drain, live bubble fraction `(p-1)/(m+p-1)`. *Timeline/Gantt.*
- **Float-bit inspector** (ch08, *Paying in bits*) — pick fp32/bf16/fp8(E4M3/E5M2), toggle bits, watch decoded value + representable range. *new widget.*
- **SSM vs attention recall** (ch07, *A fixed state instead of an addressable past*) — dual panel: SSM state overwriting vs attention's growing addressable cache; recall query lights reachable tokens. *Component 3.*
- **MinHash/LSH bucketing** (ch04, *deduplication*) — docs drop into band-buckets, `num_perm` slider sharpens Jaccard, only same-bucket pairs compared. *Component 3.*

### Part 2–3 (adaptation, reasoning)
- **Tree-of-thoughts search** (ch13) — *Tier 1 #6*.
- **DPO "secretly a reward model" derivation** (ch11) — stepper revealing each algebraic transform as the RLHF machinery fades out. *Component 1.*
- **LoRA low-rank reconstruction** (ch09) — heatmap of ΔW vs rank-r BA, drag r, watch detail return then saturate. *Component 2.*
- **"Swap the judge"** (ch12, *The one line that decides everything*) — toggle judge (teacher/scorer/critic/verifier); the loop relabels, a coverage-vs-trust marker slides. *Component 3 / animated diagram.*
- **GRPO group-relative advantage** (ch14, *Dropping the critic*) — edit per-completion rewards, advantage bars recompute, all-pass→zero-signal collapse. *bars (Component 3).*
- **RLHF four-model PPO loop** (ch10, *The leash*) — step one PPO iteration; β slider tightens the KL leash. *Component 1.*
- **Colocated vs async RL timeline** (ch16, *generation and learning*) — Gantt; toggle colocated/disaggregated and on-policy/async, watch GPU lanes + staleness counter. *Timeline.*
- **R1 four-stage pipeline** (ch14, *o1 and R1*) — stepper contrasting R1-Zero vs shipped R1's 4 stages. *Component 1.*
- **Task arithmetic** (ch09, *two fine-tunes added together*) — drag task vectors, show sum/negation/sign-conflict. *Component 3.*

### Part 4–5 (inference, orchestration)
- **PagedAttention allocator** (ch17) — *Tier 1 #3*.
- **Speculative-decoding stepper** (ch18) — *Tier 1 #5*.
- **Spec-decode payoff** (ch18) — drag α and γ, expected-tokens `(1−α^(γ+1))/(1−α)` updates. *curve 2-knob.*
- **Block-size U-curve** (ch17, *What each move costs*) — fragmentation vs indirection, L slider moves the optimum. *curve.*
- **Attention-sink heatmap** (ch20, *dropped-prefix failure*) — token×token matrix; drop the sinks → destabilizes; cache strip pins sinks, rolls window. *Component 2.*
- **Outlier-channel quantization grid** (ch19, *Why per-tensor INT8 breaks*) — drag the outlier, watch the grid stretch and bulk error explode; per-tensor vs per-channel toggle. *Component 3 / bars.*
- **Continuous-batching scheduler** (ch17, *Iteration, not request*) — stepper; static-cohort vs sliding-window lanes diverge on throughput. *Component 1.*
- **InfoNCE pull/push field** (ch27-embeddings, *Negatives are the design variable*) — query + positive + negative cloud; hardness slider pulls negatives in, loss climbs. *Component 3.*
- **RAG interaction explorer** (ch25, *Down the funnel*) — bi-encoder/ColBERT/cross-encoder: where query+chunk fuse, with cost/accuracy table. *animated diagram.*
- **Lost-in-the-middle placement** (ch26, *Why a bigger window does not help*) — drag a fact's position, trace the U-curve; grow the window, watch the dead middle expand. *curve.*
- **ReAct loop stepper** (ch21, *why it interleaves*) — reason→act→observe over turns with the growing context window. *Component 1.*
- **RRF rank fusion** (ch25, hybrid search) — reorder dense/sparse lists, fused ranking + per-doc score recompute. *interactive table.*

### Part 6–8 (evaluation, infrastructure, safety)
- **Superposition geometry** (ch32) — *Tier 1 #4*.
- **Three bandwidth tiers** (ch30) — *Tier 1 #10*.
- **Control protocol stepper** (ch33, *A control protocol up close*) — one output → monitor → accept/defer/escalate under a red team; auto-advance spends the budget. *Component 1.*
- **Ambient-authority blast radius** (ch34, *The breach that names the problem*) — drag scope breadth + TTL, watch reachable resources fan out; capability token collapses it. *Component 3.*
- **Jailbreak swiss-cheese** (ch36, *Defenses, and why each is partial*) — fire an attack family through stacked layers, see which leaks. *Component 1.*
- **SAE dictionary expansion** (ch32, *circuits*) — sweep dictionary size m and top-k, watch polysemantic neurons resolve then over-split. *extends Component 3.*
- **Privacy-fact lifecycle** (ch37, *What the weights remember*) — pick an intervention point (upstream/artifact/downstream), watch the fact survive or the late filter leak. *Component 1.*
- **Verbosity-bias win-rate** (ch28) · **Bradley-Terry/Elo win-prob** (ch28) · **many-shot jailbreak power-law** (ch36) · **held-out-size CI** (ch27) — *curve reuses (low).*

### Part 9–12 (ecosystem, practical, frontiers, operations)
- **Build-vs-buy break-even** (ch37) — *Tier 1 #8*.
- **Per-step→task reliability `p^n`** (ch53, *a reliable step is not a reliable task*) — drag p, plot p^n, 0.5 line + threshold n move. The author explicitly asks for this as a curve. *curve `p^n`.*
- **Model decision tree** (ch38, *A decision framework*) — answer each branch (residency/rent-own/cloud/task), light the path to a recommendation. *interactive flowchart.*
- **Cost calculators** — long-context-vs-retrieval (ch38), fine-tune break-even (ch40), serverless-vs-reserved (ch44). *Component 4 relabeled ×3.*
- **Judge raw-agreement vs κ** (ch43) — 2×2 confusion matrix with a base-rate slider; agreement stays high while κ collapses. *Component 2.*
- **Benchmark saturation race** (ch51, *The instruments saturate*) — stacked logistic climbs, each saturating and triggering the next. *curve logistic-sequence.*
- **Time-to-power queues** (ch47, *chips in months, megawatts in years*) — drag lead-time bars, energized date snaps to the slowest. *Gantt.*
- **Prefill/decode disaggregation** (ch48, *The decode wall*) — stepper prompt→prefill→KV-stream→decode with a roofline mini-panel per stage. *Component 1 + roofline.*
- **Cross-datacenter latency hierarchy** (ch48) — place a parallelism axis into rack/zone/building tiers, latency cost lights up. *Component 3.*
- **Agent framework explorer** (ch41, *A comparison of the players*) — filter/sort by loop archetype/license/cloud. *Component 5*, reused for ch35/ch39 tables.

---

## Deliberately excluded
Single-knob curves that already have a `curve` block + a runnable (double-covered):
reward over-optimization knee (ch10), IPO-vs-DPO gap (ch11), pass@n (ch12),
self-consistency vote (ch13), coverage-vs-selector (ch15). Process chapters whose
figures are control-flow diagrams with little manipulable state: memory-systems (ch22),
harness (ch23), runtime-safety (ch35), law/policy (ch38-safety). Add at most one or
two of these only if a slot remains.
