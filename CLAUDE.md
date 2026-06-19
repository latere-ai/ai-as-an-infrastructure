# AI as an Infrastructure

A Quarto book. Inference, training, and evaluation, covered first as
engineering practice (Part I, `engineering/`) and then as theoretical
foundation (Part II, `theory/`). Released under latere.ai, licensed
CC BY-NC-ND 4.0.

## Build and verify

- `make preview` for a live local preview.
- `make render-html` is the smoke test. CI runs the same on push and PR.
- The render check is the test here: before committing structural or
  config changes, run `make render-html` (or at least `quarto check`) and
  confirm the book builds. A broken render is a broken commit.

## Writing conventions

- Do not use em dashes. Use commas, periods, or colons.
- Each chapter opens with what the reader will be able to do or explain by
  the end.
- Math is LaTeX, diagrams are Mermaid, cross-references use Quarto labels
  (for example `@sec-eng-inference`).
- Cite by adding entries to `references.bib` and using `[@key]`. Cited
  entries flow into `references.qmd` automatically.

## Commits

- Commit message style: `scope: lowercase description`.
- Commit often, one intended diff at a time.
- Work on `main` directly.

## Related

Other latere projects and shared infrastructure are in `../`.
