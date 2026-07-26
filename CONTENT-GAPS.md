# Content Gap Ledger

## Completed goals

- [x] **Mid-training bridge**

  Added a dedicated Part I chapter between pre-training and post-training:
  mid-training as quality annealing, mixed-domain bridging, specialist
  continuation, and long-context extension. The book now distinguishes broad
  pre-training, continued pretraining, mid-training, and post-training with
  source-backed references, a static boundary diagram, an interactive bridge
  visualization, updated top-level surfaces, and cross-links into adaptation,
  reasoning, serving, and practice.

- [x] **Post-training adaptation and alignment depth**

  Expanded Part III from a four-chapter sketch of fine-tuning, RLHF, DPO, and
  self-improvement into a full post-training layer: SFT and PEFT, behavior
  specifications and preference data, reward modeling, direct preference
  methods, verifiable rewards, safety tuning and instruction hierarchy, and
  synthetic-data flywheels. The part now includes source-backed references,
  static figures, interactive visualizations, updated cross-links to reasoning,
  evaluation, safety, operations, and top-level book surfaces.

- [x] **Reasoning and test-time compute depth**

  Expanded Part IV from a three-chapter bridge into a seven-chapter reasoning
  layer: elicitation, structured search, program and solver delegation,
  verifiers and process supervision, RLVR training, reasoning data and
  distillation, and production test-time compute. The part now includes
  source-backed references, static figures, interactive visualizations, updated
  social cards, and cross-links to adaptation, serving, orchestration,
  evaluation, safety, infrastructure, and operations.

- [x] **Evaluation depth and governance**

  Expanded Part VII from a three-chapter treatment of benchmarks, judges, and
  agents into the book's full measurement layer: statistical reliability,
  human evaluation and rubrics, model judges, factuality and grounding, agent
  and multimodal evaluation, and operational governance. The part now includes
  source-backed references, static figures, interactive visualizations, updated
  social cards, and cross-links to adaptation, reasoning, orchestration, safety,
  infrastructure, economics, and operations.

- [x] **Ecosystem and economics depth**

  Expanded Part X from a three-chapter sketch into a full ecosystem treatment:
  model openness, tooling standards, compute markets, market structure, adoption
  and productivity, and data rights. The part now includes source-backed
  references, static figures, an interactive ROI visualization, and updated
  top-level book structure.

- [x] **Product / UX / human-interface layer**

  Add the missing human-in-the-loop perspective: how AI infrastructure reaches
  users through product surfaces, review flows, approvals, correction loops,
  escalation paths, trust cues, and interface constraints. The current book
  covers systems, agents, serving, evaluation, safety, and operations well, but
  mostly treats humans as operators or labelers rather than as users embedded in
  the runtime loop.

  This should not become a generic product-management chapter. The useful angle
  is the infrastructure-facing one: where human judgment enters the loop, how UI
  design changes reliability and safety, when approval gates are required, how
  feedback becomes training/evaluation data, and how product experience exposes
  or hides model uncertainty.

- [x] **Operating contracts and infrastructure operations**

  Added the missing production-operations layer that makes the title "AI as an
  Infrastructure" operational rather than only architectural. The book now closes
  Part XI with SLOs for semantic systems, runtime cost governance, incident
  classes, tenant isolation, evidence records, and governance compiled into
  routing, evaluation, data, and sandbox controls. This also strengthens the
  book's distinctive thesis: its center is not deeper training/serving craft, but
  cross-layer constraint arrows and the physical, economic, and operational
  substrate that shapes the AI stack.

- [x] **Verification frontier**

  Added a dedicated Part IX chapter after the capability horizon to separate
  "can the model produce an answer?" from "what evidence lets an institution
  accept it?". The chapter now ties formal proof, executable checking, assisted
  oversight, empirical validation, weak-to-strong supervision, AI control, and
  ELK-style limits into the book's infrastructure thesis. It adds a static
  figure, a DOT regime diagram, an interactive verification-gap visualization,
  source-backed references, and cross-links into post-training, reasoning,
  evaluation, safety, ecosystem, and operations.

## Open goals

Found by a structural audit on 2026-07-26, ranked by value. Each is evidence
backed; none has been decided or started. Sizing is the audit's estimate.

- [x] **Frontier safety frameworks** (one section, ~1,200-1,800 words, in
  `safety/08-law-regulation-policy`)

  The book names the frontier safety framework twice as an object other people
  handle: SB 53's duty on large developers to publish one, and third-party
  evaluators reporting on autonomy, deception, and dangerous capability. No
  chapter opens one. Book-wide greps return zero hits for "capability
  threshold", "frontier safety", "preparedness", "responsible scaling",
  "dangerous capabilit", "safety case", "CBRN", and "system card". The lifecycle
  spine ends at a deployed and governed behavior, and the gate that decides
  whether a frontier model may be deployed at all is the one gate never
  described. `evaluation/07`'s release gate is product-side; `safety/02`'s
  control protocols are runtime containment; `frontiers/03` is about
  accepting a model's claims, not accepting the model. The shape to write: a
  capability threshold, the evaluation suite that tests whether a model crossed
  it, and the safeguard tier that attaches when it does, read off the published
  frameworks, with Anthropic's ASL-3 activation as the case where a threshold
  actually tripped.

- [x] **Retrieval authorization** (one section, ~500-700 words, in
  `orchestration/08-rag-retrieval`)

  The retrieval funnel has no permission stage. The chapter's only security
  treatment runs the other way, retrieved text as untrusted input carrying
  injected instructions. Whether the requesting user may read what the
  retriever returned is answered only in `safety/03`, and only from the
  authorization side (on-behalf-of token exchange, partition-at-write versus
  filter-at-read). Missing is the retrieval-engineering version: document ACLs
  carried into the index, a permission filter before or after the reranker and
  what it costs recall, and the stale-entitlement window between a permission
  change and a re-embed. For an enterprise deployment this is the stage that
  decides whether the system ships.

- [x] **Part IX has grown into two parts under one name** (restructuring, no
  new prose)

  Eleven chapters against a four-to-eight norm, spanning hardware substrate,
  software substrate, cluster and data plane, physical and economic substrate,
  and epistemic frontier. The part's own summary opens "The infrastructure part
  went below the model and then above it." Chapters 09-11 (where learning hits
  limits, the capability horizon, the verification frontier) are limits on what
  compute converts into, and the last two sit closer to Part VII. Splitting
  them into their own part costs renumbering Parts X and XI, two part intros
  and two summaries in both trees (the existing ones already contain both
  halves and can be cut apart), and redirects for three chapters that change
  part directory. A cheaper variant keeps the manifest and adds an explicit
  hinge inside the part.

- [x] **Quality SLI is defined twice** (paragraph-level consolidation, four
  files)

  `practice/10-reliability-nondeterministic` introduces the sampled, judged
  pass rate and the confidence-bound rule, citing `beyer2016sre`.
  `practice/13-operating-contracts` introduces it again, cites the same source,
  restates the rule, and then cross-references the chapter it duplicated. Keep
  the definition where it is introduced and cut 13 down to what only the
  contracts chapter can say.

- [x] **The epilogue skips Part II** (one clause, both trees)

  `summary.qmd` retraces the parts in order and gives no clause to Generative
  and Multimodal Architectures, the one part the book insists is not an
  appendix.

- [x] **The preface roadmap's Part II bullet** (one clause, both trees)

  The Part VI, VIII, IX and X bullets were resynced to `book.yml` on
  2026-07-26. Part II's bullet still omits `beyond-text`, the chapter that
  carries the argument to objects that do not arrive as strings.

- [x] **CoWoS capacity sourcing** (citation, `infrastructure/06`)

  The wafers-per-month capacity figures are attached to a TrendForce piece that
  carries the reticle roadmap and the eleven-fold AI wafer demand figure but no
  capacity number. The numbers check out against other reporting; the citation
  does not support them.
