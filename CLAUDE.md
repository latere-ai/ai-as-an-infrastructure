# AI as an Infrastructure

A Quarto book covering AI as an infrastructure across three stack layers,
each written design-first: history, design decisions, trade-offs, and the
foundations underneath.

- Part I, Systems (`systems/`): inference, training, evaluation.
- Part II, Applications (`applications/`): chat completion, assistants,
  agentic agents.
- Part III, Frontiers (`frontiers/`): autonomous agents, self-improvement.

Released under latere.ai, licensed CC BY-NC-ND 4.0.

## Authoring philosophy

Read [`CONVENTIONS.md`](CONVENTIONS.md) before writing. In short: every
section follows Problem, Design, Evolution, Trade-offs, Implementation, and
leaves the reader able to answer "why is it built this way?". Trace history
through primary sources. Keep code minimal and cite it as `symbol, path`.
Close each chapter with Further reading.

## Build and verify

- `make preview` for a live local preview.
- `make render-html` is the smoke test. CI runs the same on push and PR.
- The render check is the test here: before committing structural or
  config changes, run `make render-html` (or at least `quarto check`) and
  confirm the book builds. A broken render is a broken commit.

## Writing conventions

- No em dashes. Use commas, periods, or colons. No filler, no intensifiers.
- Each chapter opens with what the reader will be able to explain by the
  end, and closes with Further reading.
- Math is LaTeX, diagrams are Mermaid, cross-references use Quarto labels
  (for example `@sec-sys-inference`).
- Cite by adding entries to `references.bib` and using `[@key]`.

## Commits

- Commit message style: `scope: lowercase description`.
- Commit often, one intended diff at a time.
- Work on `main` directly.

## Related

Other latere projects and shared infrastructure are in `../`. The reference
for this book's style is `../../golang.design/under-the-hood`.
