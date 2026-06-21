# AI as an Infrastructure

A bilingual technical book, written design-first. The spine is the lifecycle of
a capability, from compute to a deployed and governed behavior. See `README.md`
for the part list and `CONVENTIONS.md` for how chapters are written.

Released under latere.ai, licensed CC BY-NC-ND 4.0.

## Layout

- Content is bilingual markdown: `en/pN-*/NN-slug.qmd` and the `zh/` twin, with
  the same chapter paths and `{#sec-...}` labels under each. `en/_quarto.yml`
  and `zh/_quarto.yml` are kept ONLY as the chapter/part manifest (the reader
  reads `book.chapters` from them); Quarto itself is no longer used to render.
- The site is a **custom React + Bun reader** in `app/` (replaced Quarto). It
  compiles the `.qmd` content (markdown, KaTeX math, citations from
  `references.bib`, `@sec`/`@fig` cross-refs, graphviz/mermaid, callouts,
  runnable/viz) to static HTML in `_book/{en,zh}`. See `app/src/pipeline/`.
- `INTEGRATION.md` maps source material to chapters. The book is canonical.

## Authoring philosophy

Read [`CONVENTIONS.md`](CONVENTIONS.md) before writing. Every section runs
Problem, Design, Evolution, Trade-offs, Implementation, and leaves the
reader able to answer "why is it built this way?". Add a "what's contested"
box where the field is unsettled and a "constraint arrow" where a lower
layer dictates an upper one. Trace history through primary sources, keep
code minimal and cite it as `symbol, path`, close each chapter with Further
reading.

## Build and verify

- `make dev` runs the reader dev server (`app/`, hot client rebuild).
- `make build` builds both languages into `_book/{en,zh}` (Bun SSG). This is
  also what `.githooks/pre-commit` runs on every commit, so `_book` is vendored
  (committed); enable the hook once per clone with
  `git config core.hooksPath .githooks`.
- `make og` regenerates the vendored English social-share cards into `_book/og/`
  (Open Graph / Twitter cards, one 1200x630 PNG per chapter; on demand; slow —
  headless Chrome). Re-run after adding or retitling a chapter. `make build`
  warns (does not fail) if a page references a card PNG that is missing.
- The build is the test: `make build` must compile both books. CI (`render.yml`)
  lints the `.qmd` sources and runs the Bun build; a broken build is a broken
  commit.

## Writing conventions

- No em dashes. Use commas, periods, or colons. No filler, no intensifiers.
- The zh side follows `../specs/research/llm-training/TRANSLATION-GLOSSARY.md`:
  code, symbols, math, URLs, and author names byte-verbatim.

## Deploy

The book deploys to `aaai.latere.ai` as a static-serving nginx container behind
the shared K8s ingress. `_book` is vendored, so `docker.yml` just packs the
committed HTML into the image (no render in CI). Deploy = push `main` → image →
`kubectl rollout restart deployment/aaai-web -n latere`. See `deploy/prod/` and
`.github/workflows/`. DNS is one A record in `../terraform/dns.tf`; the header
link lives in `../latere-ai`.

## Commits

- Commit message style: `scope: lowercase description`.
- Commit often, one intended diff at a time. Work on `main` directly.

## Related

Other latere projects are in `../`. The style reference is
`../../golang.design/under-the-hood`.
