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
  constraints that shape the AI stack.

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

  Eleven chapters against a four-to-eight norm, spanning hardware, the software
  layer, cluster and data plane, physical and economic constraints, and
  epistemic frontier. The part's own summary opens "The infrastructure part
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

## Open goals: a structure that can be refreshed monthly

Found on 2026-09-23 while running a wording pass over every chapter and a
coverage check of the English tree. None has been decided or started.

- [x] **Separate durable explanation from dated evidence** (convention adopted 2026-09-23: `callout-note .dated` blocks titled "As of September 2026"; applied to every refreshed chapter)

  Named models, benchmark scores, prices, hardware products, and regulatory
  dates sit inside the explanatory prose of about ninety chapters. A monthly
  refresh therefore touches nearly every file, and readers cannot see what
  changed. Each chapter keeps its Problem, Design, Evolution, and Trade-offs
  text free of snapshot figures and holds them in one marked "Evidence as of
  <date>" block. The "Dated release examples" section of `ecosystem/01` is the
  working model.

- [x] **Tests check structure, not wording**

  About two hundred content-lock tests pinned prose phrases and heading text,
  so nearly every wording edit broke a test. They were removed on 2026-09-23.
  Tests now check English and Chinese parity (headings, anchors, citations,
  cross-references, display math, interactive figures), that every page
  renders without leaking markup or dropping content, runnable cells,
  citations, and links. Remaining known divergences are listed as allow-lists
  in the tests and as open items below.

- [x] **A dated state-of-the-field edition** (done 2026-09-23: `field/2026-09`)

  The book has no page for the current frontier. Choosing a Model became
  vendor-neutral, and its named-model tree survives only as unused code (the
  `LEGACY` tree in `app/src/runtime/viz.ts`, which still names Claude Opus 4.8,
  GPT-5.6 Sol, Gemini 3.1 Pro, DeepSeek-V4-Pro, Kimi K2.6, and GLM-5.1). A
  monthly edition would cover frontier and open-weight models with access
  terms and prices, compute supply and geopolitics, capability measurements,
  mathematics and formal-proof results, policy events, and open problems. Each
  item links to the chapter that explains its mechanism, and past editions stay
  at stable URLs so readers can compare months. The unused tree was deleted on
  2026-09-23.

- [x] **Technique index** (done 2026-09-23: Techniques section on the glossary page)

  `glossary.yml` gains technique entries with a status (emerging, adopted,
  established, faded), the month the entry was added, and the section that
  covers it, or "not yet in a chapter". A rendered index lets a new technique
  enter as a short note and move into a chapter once it settles.

- [ ] **Per-chapter review date and monthly digest** (review dates done 2026-09-23 in `app/src/data/review-dates.json`; the monthly digest is open)

  Each chapter shows its last review date under the title, read from front
  matter, and the changelog gains a monthly digest that links every change to
  its chapter.

- [ ] **A year in a chapter path**

  The H1 of `practice/08` is "Wiring the Stack"; the year appears only in the
  file path `practice/08-wiring-a-2026-stack`, the figure id
  `fig-wiring-a-2026-stack-cost-crossover`, and the bib filename. Renaming the
  path changes the published URL and needs a redirect.

  `practice/08-wiring-a-2026-stack` names a year in its H1. Either it becomes
  the one chapter that is explicitly a dated snapshot, or it is retitled, which
  regenerates its share card.

- [x] **Lint misses `---` inside sentences**

  The reader renders `---` in prose as an em dash. `tools/lint.sh` now fails on
  `---` inside a prose line.

## Open goal: visuals that explain

Recorded 2026-09-23 at the author's request. The book has 39 interactive
components (58 placements, mostly canvas sketches with a slider or a stepper),
151 Graphviz diagrams, and static SVG charts. The author judges them well short
of what current interactive and animated explanation can do, and allows
removing any existing figure. The work starts from what each chapter needs a
reader to understand, not from the existing component list: a screenshot audit
graded against a fixed rubric (does the figure answer the question its
paragraph asks, does interaction change understanding, is it legible on a
phone, does it look current), then a first tranche of about ten figures across
the parts for the author to judge, then the rest. Constraints: a zh twin with
matching inputs for every figure, theme tokens, the mobile column width,
reduced motion, and a static fallback when scripts do not run.

Decision (author, 2026-09-23): image-based golden figure tests come after the
visuals ship to production and the author confirms them; animations are not
tested beyond "the figure builds, its fallback renders, and en and zh inputs
match". Test effort goes to content quality, not to per-figure assertions.

## Open goals: rendering and parity defects found by the new tests

- [x] **Bold renders as literal `**` on 12 zh pages.** Fixed 2026-09-23 in the pipeline. `**标签：**正文` does not
  close under CommonMark when full-width punctuation meets a CJK letter
  (visible in `zh/foundations/scaling-laws`). Fix in the pipeline, not page by
  page; the pages are listed as `knownBoldLeaks` in
  `app/src/chapter-render.test.ts`.
- [ ] **39 Graphviz figures are wider than the mobile column** (34 en, 5 zh) and
  scroll sideways; listed as `knownWideFigures`.
- [x] **Display math differs between en and zh on 9 pages** (fixed 2026-09-23; the allow-list is empty); listed as
  `knownMathDivergence` in `app/src/book-zh-parity.test.ts`. Most are
  punctuation or layout. `practice/05` and `practice/08` were fixed on
  2026-09-23.
- [x] **Two hard-wrapped hyphenated compounds** in `adaptation/04`
  ("instruction-tuned", "log-probabilities"). Fixed 2026-09-23; the
  allow-list is empty.
- [x] **Long display equations are clipped, not scrolled.** In
  `foundations/04` the equation ending in a softmax is cut off mid-word at
  desktop width. Display math wider than the column needs horizontal scroll or
  a line break, and the render test should catch it. Fixed 2026-09-23: the
  display did scroll, but behind an overlay scrollbar. Display math now wraps
  at the break points KaTeX emits (after a top-level relation or operator),
  and a run that cannot break still scrolls.
- [x] **`app/src/reader-mermaid.test.ts` always skips**: it points at a stale page
  path and the figure it checked is now Graphviz. Removed 2026-09-23: a
  browser test that depends on a CDN in CI costs more than it catches.

## Open goals: coverage (2026-09-23 audit)

Counts are greps over `en/`. Each item needs a sourced research pass before it
is written.

- [x] **Latent-space reasoning.** Done 2026-09-23 in `reasoning/07` (mechanism, dated evidence) with a pointer from `reasoning/01`.
- [x] **Recursive self-improvement and automated AI research.** Done 2026-09-23: definition in `adaptation/07`, measurement in `frontiers/02`, AI R&D thresholds in `safety/08`, research systems as claim sources in `frontiers/03`.
- [x] **RLCD.** Done 2026-09-23: TypeSafe AI's "Reinforcement Learning for Calibrated Decisions" is a dated vendor claim in `adaptation/05`, beside calibration as a reward (RLCR).
- [x] **Test-time training.** Done 2026-09-23 in `reasoning/07` (serving cost) and `frontiers/01` (request-scoped state).
- [x] **Recent mathematics results.** Done 2026-09-23 in `reasoning/03` (olympiad grading and statement authorship) and `frontiers/03` (formalization, Erdős review, research benchmarks).
- [x] **Compute geopolitics beyond U.S. export rules.** Done 2026-09-23 in `infrastructure/05` and `06` (Huawei Ascend as vendor claims, TPU7x and TPU 8, Trainium3, tariffs and destination groups). Other Chinese vendors remain unverified.
- [x] **Open-weight labs as market actors.** Done 2026-09-23 in `ecosystem/01` (hosting carve-outs, release tiers) and `ecosystem/05` (measured open-closed gap).
- [x] **Current model lineup.** Partly done 2026-09-23: OpenAI and Anthropic lineups in a dated block in `practice/01`; the full lineup belongs in the state-of-the-field edition.
- [x] **Coding agents as a deployed system.** Done 2026-09-23 in `practice/05` (what coding agents run, sandbox and credential decisions, how usage is measured, dated usage figures).
- [ ] **Large agent populations and 2026 alignment findings.** `orchestration/07` assumes an orchestrator designs the topology and has no treatment of many agents that were meant to be isolated forming a channel through shared infrastructure, coordinating without an orchestrator, and not escalating to humans. `safety/02` carries the evaluation incidents but not the alignment audits beneath them (evaluation awareness, agent-to-agent evaluations, sandbagging under monitor awareness, the incident assessments, control arenas, the lab control roadmap, misalignment disclosure). `safety/04` lacks the containment lessons: a shared service with internet reach is both an egress path and a message bus, state left in shared caches re-enters later runs, and the record a monitor reads must be produced outside the workload. Dated items belong on the State of the Field page.

## Pending factual checks (September 2026 wording pass)

Left unchanged during the wording pass because resolving them needs a source.

- [x] `orientation/04` (en 20-22): Facebook-only workload measurements are
  generalized to all production AI of the period.
- [x] `foundations/01` (en 179, zh 98): "larger models trained with similar
  compute"; in Hoffmann et al. only Gopher shares Chinchilla's budget.
- [x] Preface (en 126, zh 47): says every chapter has a "What's contested" box;
  `orientation/01`, `orientation/03`, `orchestration/04`, `practice/06`,
  `safety/08`, and `infrastructure/06` have none.
- [x] `orientation/02` (en 146-152): the compute-only fit after the Kaplan
  citation carries an irreducible term that Kaplan's compute law does not have.
- [x] `orientation/index` (en 66-72, zh 29): the prerequisite sentence
  contradicts the next one, which says the transformer chapter builds it.
- [x] `generative/05` (en 234, zh 140): a literal "Chapter 15" instead of a
  cross-reference; its Further reading note still cites the "1/200,000"
  estimate that the body rejects.
- [x] `reasoning/01` (en 106-107, zh 62): "early wrong answer" is listed under
  failing before the first solution step.
- [x] `reasoning/06` (en 298, zh 168): "the one change from L_soft"
  understates the difference; MOPD is never expanded.
- [x] `inference/03` (en 255, zh 155) and `inference/05` (en 218, zh 127):
  literal "Chapter 32" and "Chapter 34's IO model" instead of
  cross-references.
- [x] `inference/06` (en 127, zh 84): "upper-level accounting model" is
  unclear; (en 353, zh 197) the definition of S conflicts with e_s.
- [x] `orchestration/06` (en/zh 145): OSWorld-Human "2.7-4.3 times as many
  steps" may be 1.4-2.7 in the current version of the paper.
- [x] `orchestration/07` (en 330-336, zh 189): the 90.2 percent figure is
  relative to single-agent Claude Opus 4; name that baseline.
- [x] `orchestration/08` (en 537, zh 283): "oracle-context gap" does not name
  the two conditions it compares.
- [x] `safety/01` (en 179-180, zh 96): "held-out feature labels" reads as
  circular; probably held-out activating examples.
- [x] `refs/scalable-oversight-control.bib`: the zh note for
  `greenblatt2024faking` mixes the compliance rate with the reasoning rate;
  the zh note for `hubinger2024sleeper` claims more than the chapter does.
- [x] `safety/05` (zh 135): names the NIST risk management framework where en
  names the Generative AI Profile (AI 600-1).
- [x] `safety/07` (en 224, zh 105): "trusted assignment" versus zh "trusted
  physical boundary"; (zh 145) "oblivious HTTP relay" loses its meaning in
  translation.
- [x] `safety/08`: dates after mid-2026 are unchecked (Regulation (EU)
  2026/1744, the Council of Europe convention ratification, the 2027 and 2028
  calendar, Colorado SB 26-189, the amended New York RAISE Act). Checked
  against the primary texts on 2026-09-23.
- [x] `infrastructure/02` (en 444): `zhao2023pytorch` is also cited for
  distributed tensors, which the paper does not cover.
- [x] `infrastructure/06` (en 282, zh 156): "TSMC's own 2025 capacity page"
  cites `tsmc2026fabcapacity`.
- [x] `frontiers/02`: "hybrid Time Horizon 1.1 series" (en 165) and "xhigh
  reasoning" (en 194) are unexplained; "the reported human average" for
  ARC-AGI-2 (en 279) refers to a figure the book never gives; date formats are
  mixed.
- [x] `ecosystem/01` (en 336, zh 192): the Chinchilla and GQA comparison is
  uneven because DeepMind is part of Google; the Sardana paper has two
  bibliography keys. Merged to `sardana2024beyond` on 2026-09-23.
- [x] `ecosystem/07` (en 166-167, zh 85): names Google although the cited
  filing does not name the partner.
- [x] zh terminology: inference is 推断 in `zh/ecosystem/01` and 推理 in the
  other ecosystem chapters.
