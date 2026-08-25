# Authoring Conventions

This book follows a design-first philosophy. The goal of every chapter is that
a reader finishes able to answer "why is it built this way?", not merely "what
does the code do?".

## The section arc

Each substantial section moves through the same arc:

1. **Problem.** What essential problem does this component solve? What are
   the real constraints: latency, cost, memory, scale, safety, correctness?
2. **Design.** What core idea answers the problem? What is the principle or
   theoretical foundation behind it?
3. **Evolution.** How did the design get here? What earlier approaches came
   first, and why were they superseded? Trace the lineage through papers,
   proposals, and released systems.
4. **Trade-offs.** What is sacrificed for what benefit? Where are the
   boundaries and the known gaps?
5. **Implementation.** Only when it clarifies the design: minimal
   pseudocode, a config sketch, or operational reality.

In this book the arc carries the engineering-to-theory motion inside each
chapter: the practice is established first, then the foundations that
explain it.

## The reader and the on-ramp

The book assumes one reader and holds that level steady: a strong software
engineer who is new to machine learning. They know systems, complexity, and
distributed computing, but not ML-specific vocabulary. This assumption is what
keeps the difficulty even. A chapter that quietly assumes the reader already
knows what loss, a policy, or an embedding matrix is reads as steep; a chapter
that re-explains systems basics reads as slow. Write for this reader in every
chapter, including the late ones.

Four rules follow from that, and they are the most common readability defects
the book has had:

1. **Introduce before use. A glossary link is not an introduction.** The first
   time a chapter leans on a term a SWE-new-to-ML would not know, give it a
   one-clause plain-language gloss in the prose itself. A linear reader does not
   click `@gls-...` away mid-sentence, so a glossary entry does not discharge the
   debt. The test: read the chapter top to bottom assuming zero outside
   knowledge and no clicking; every term must be defined at or before its first
   substantive use. This bites hardest on the *protagonist* term, the one the
   chapter's payoff depends on (loss in scaling, the policy in RLHF, the
   embedding matrix in tokenization): define that one first and plainly.

2. **Openers orient, they do not roll-call.** The lead paragraph names the
   problem and the through-line, not every mechanism the chapter will cover. A
   reader cannot hold ten undefined nouns at once. Signpost the order (the
   memory-scheduling chapter's "the mechanisms form a dependency chain ..." is
   the model), then let each section introduce its own terms when it needs them.

3. **Keep the gradient even. On-ramp before every cliff.** Roughly one new idea
   per paragraph. Put an intuition or a concrete picture *before* a dense formula
   or a compressed derivation, never after. Where a passage is optional depth
   (an alternative derivation, a frontier aside), mark it as skippable so the
   floor does not drop out without warning. The failure pattern is a gentle
   paragraph followed immediately by a wall of stacked unknowns.

4. **No paragraph out of nowhere.** Every paragraph connects to the one before
   it. When the subject shifts, a forward-pointer or a scope-fence says why
   ("this chapter handles learned rewards; checkable rewards are in @sec-..."),
   so a switch reads as structure rather than a digression. If a chapter's
   paragraphs could be reordered without a reader noticing, its joints are
   under-specified.

One more, against the opposite failure: **do not over-repeat.** An example or a
figure earns one representation, not three. Restating the same thesis four times
or walking the same toy example as stepper, diagram, and code makes the gradient
flat and the chapter feel padded. Say it once, well.

These apply to both language trees. The ZH twin mirrors the EN concept order, so
an on-ramp added in EN is ported to ZH, not re-invented.

## Code and citation

- Prefer pseudocode and minimal sketches. Show ten lines that convey the
  idea, not a hundred that reproduce a file.
- Cite real source as `symbol, path` (for example `vllm.LLMEngine.step,
  vllm/engine/llm_engine.py`) so a reader can check it directly.
- Never paste full source functions or exhaustive struct definitions.
- Anchor version-specific claims to a concrete version or commit.
- Close each chapter with **Further reading**: first-hand sources first
  (papers, proposals, design docs, commit messages, author posts) over
  secondhand retellings, each with full metadata.

## Math and diagrams

- Math is LaTeX: inline `$...$` and display `$$...$$`.
- Diagrams are Mermaid in `` ```{mermaid} `` blocks (the reader-recognized
  diagram fence, with braces). A plain `` ```mermaid `` block renders as a
  code listing, not a diagram. Verify they render, not just that the syntax
  parses. Use a static image only when Mermaid cannot express the figure.

## Tone

- Warm and scholarly, walking alongside the reader. Preempt confusion:
  "a reader may wonder why...".
- No em dashes. Use commas, periods, or colons.
- No filler openings ("it should be emphasized that"), no intensifiers
  ("truly", "precisely"), no false agency ("the system decides to").
- Complete, declarative sentences.

## Cross-references and links

Use Pandoc-style labels for cross-references (`@sec-scaling-laws`) and relative
links within the book tree. Keep section anchors stable across edits.

## Debate boxes and constraint arrows

Two callouts carry the book's intellectual signature and belong in chapters
that warrant them.

- **What's contested** (`::: {.callout-important}`). Where the field is
  genuinely unsettled, state the live debate with named positions rather
  than papering over it. Scaling ratios, DPO-variant efficacy, whether RLVR
  teaches new reasoning, whether sparse autoencoders are the right
  interpretability primitive, and benchmark-versus-harness measurement are
  the recurring ones.
- **Constraint arrow** (`::: {.callout-tip}`). Where a lower layer dictates
  an upper layer's choice, name it. The serving cost of a token justifies
  over-training a smaller model; the key-value cache size motivates an
  attention variant; the harness moves an evaluation score. These arrows are
  the payoff of reading the stack in order.

Two motifs run through the prose without needing a callout: the **three
loops** (training, inference, agentic) as one recurring control structure,
and the **capability, efficiency, trust** lens that closes a chapter.

## Language trees

The book has two parallel language trees, `en/` and `zh/`. A chapter exists as
the same path under both trees with the same `{#sec-...}` label, and each tree
is ordered by its `book.yml` manifest. The zh side follows the project
translation glossary: keep code, symbols, math, URLs, and author names
byte-verbatim, use Chinese punctuation, and never carry over an em dash.

Chinese prose should read native, not translated: professional, direct, and
not over-explained. Preserve structure, code, formulas, diagrams, citations,
runnable blocks, visualizations, `{#sec-...}` / `{#fig-...}` labels, and
`@sec` / `@fig` / `[@cite]` references.

- Avoid formulaic openings such as "this chapter explains..." and start each
  chapter in its own way.
- Use the established agent phrasing: a model is wrapped in an execution loop.
- Break English-style stacked modifiers into shorter sentences.
- Translate idiomatically rather than literally. For example, "didn't buy
  anything" should become the Chinese equivalent of "gained nothing".
- Vary sentence length. Do not make every sentence fully padded and complete.
- Use parallel structures and "not X but Y" sparingly.
- Do not over-explain. Make the point and move on.
- Use plain accurate words, not coined clever terms.
- Translate abstract headings by meaning. For example, "live tensions" should
  become "open trade-offs", not a literal "living tension".
- Use full-width Chinese punctuation in Chinese prose: ，。：；？！「」（）。
  Keep punctuation inside code, formulas, URLs, and English titles unchanged.
- Make cross-reference prose read naturally. Prefer "留到 @sec-X 再谈" or
  "@sec-X 会进一步展开" over stiff constructions such as "归 @sec-X 去管".
