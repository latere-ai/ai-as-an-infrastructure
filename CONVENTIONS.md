# Authoring Conventions

This book follows a design-first philosophy, adapted from
[golang.design/under-the-hood](https://golang.design/under-the-hood). The
goal of every chapter is that a reader finishes able to answer "why is it
built this way?", not merely "what does the code do?".

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
- Diagrams are Mermaid in fenced ```` ```mermaid ```` blocks. Verify they
  render, not just that the syntax parses. Use a static image only when
  Mermaid cannot express the figure.

## Tone

- Warm and scholarly, walking alongside the reader. Preempt confusion:
  "a reader may wonder why...".
- No em dashes. Use commas, periods, or colons.
- No filler openings ("it should be emphasized that"), no intensifiers
  ("truly", "precisely"), no false agency ("the system decides to").
- Complete, declarative sentences.

## Cross-references and links

Use Quarto labels for cross-references (`@sec-sys-inference`) and relative
links within the book tree. Keep section anchors stable across edits.
