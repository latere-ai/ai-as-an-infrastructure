# AI as an Infrastructure

From Systems to Agents: history, design decisions, and foundations.

A book that treats AI as an infrastructure and explains it design-first: it
traces how each piece got the shape it has, what trade-offs that shape
encodes, and the theory underneath. Released under
[latere.ai](https://latere.ai).

The book is organized as a stack, bottom to top. Each chapter establishes
the practice and then the foundations that explain it, following the arc in
[`CONVENTIONS.md`](CONVENTIONS.md).

## Structure

- Part I, Systems (`systems/`): inference, training, evaluation.
- Part II, Applications (`applications/`): chat completion, assistants,
  agentic agents.
- Part III, Frontiers (`frontiers/`): autonomous agents, self-improvement.
- `index.qmd`, `summary.qmd`, `references.qmd`, `references.bib`: preface,
  closing, and bibliography.
- `_quarto.yml`: book configuration. `CONVENTIONS.md`: how chapters are
  written.

## Philosophy

Design-first, after [golang.design/under-the-hood](https://golang.design/under-the-hood):
every section moves through Problem, Design, Evolution, Trade-offs, and
Implementation, so a reader finishes able to answer "why is it built this
way?". History is traced through primary sources, code is kept minimal, and
each chapter ends with Further reading. See [`CONVENTIONS.md`](CONVENTIONS.md).

## Build

Built with [Quarto](https://quarto.org).

```sh
# Install Quarto: https://quarto.org/docs/get-started/
quarto --version

make preview      # live local preview
make render-html  # HTML only (what CI builds)
make render       # HTML + PDF + ePub (PDF needs: quarto install tinytex)
```

CI renders the HTML build on every push and pull request as a smoke test
(`.github/workflows/render.yml`).

## License

Prose, figures, and other content are licensed under
[Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)
(CC BY-NC-ND 4.0). See [`LICENSE`](LICENSE).

Copyright © 2026 latere.ai. The license variant is a deliberate, swappable
choice: BY-NC-ND keeps monetization and derivatives reserved. Switch to
BY-SA or BY if wider reuse and translation become the goal.
