# AI as an Infrastructure

A book on treating AI as an infrastructure: inference, training, and
evaluation, covered first as engineering practice and then as theoretical
foundation. Released under [latere.ai](https://latere.ai).

The book looks at each of the three activities twice. Part I builds and
operates them as dependable production systems. Part II explains the
behavior Part I asks you to operate.

## Structure

- `index.qmd`: preface.
- `engineering/`: Part I, Engineering Practices (`inference`, `training`, `eval`).
- `theory/`: Part II, Theoretical Foundations (`inference`, `training`, `eval`).
- `summary.qmd`, `references.qmd`, `references.bib`: closing and bibliography.
- `_quarto.yml`: book configuration.

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
