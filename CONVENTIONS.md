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

## Bilingual

The book has two parallel language trees, `en/` and `zh/`. A chapter exists as
the same path under both trees with the same `{#sec-...}` label, and each tree
is ordered by its `book.yml` manifest. The zh side follows
`../specs/research/llm-training/TRANSLATION-GLOSSARY.md`: keep code, symbols,
math, URLs, and author names byte-verbatim, use Chinese punctuation, and
never carry over an em dash.

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
