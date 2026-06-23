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
