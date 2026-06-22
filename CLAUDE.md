# AI as an Infrastructure

A bilingual technical book, written design-first. The spine is the lifecycle of
a capability, from compute to a deployed and governed behavior. See `README.md`
for the part list and `CONVENTIONS.md` for how chapters are written.

Released under latere.ai, licensed CC BY-NC-ND 4.0.

## Layout

- Content is bilingual markdown: `en/<part>/NN-slug.qmd` and the `zh/` twin,
  with the same chapter paths and `{#sec-...}` labels under each. `en/book.yml`
  and `zh/book.yml` are the chapter/part manifests read by the custom reader.
- The site is a **custom React + Bun reader** in `app/`. It
  compiles the `.qmd` content (markdown, KaTeX math, citations from
  `references.bib`, `@sec`/`@fig` cross-refs, graphviz/mermaid, callouts,
  runnable/viz) to static HTML in `_book/{en,zh}`. See `app/src/pipeline/`.

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
- `make build` builds both languages into `_book/{en,zh}` (Bun SSG). `_book` is
  generated output, NOT committed (gitignored): it is compiled inside the Docker
  build and embedded into the Go server binary, so there is no vendored HTML.
- `make serve` builds `_book` then runs the production Go server (`main.go`),
  which embeds `_book` (`//go:embed`) and serves it on :8080. `make test` runs
  the server's routing-contract tests (redirects, canonicalization, caching).
- `make og` regenerates the English social-share cards into `app/static/og/`
  (Open Graph / Twitter cards, one 1200x630 PNG per chapter; on demand; slow —
  headless Chrome). These ARE committed (source assets); `make build` copies
  them into `_book/og/` and warns (does not fail) if a referenced card is
  missing. Re-run and commit after adding or retitling a chapter.
- The build is the test: `make build` must compile both books. CI (`render.yml`)
  lints the `.qmd` sources, runs the Bun build, and runs `go test`; a broken
  build is a broken commit.

## Writing conventions

- No em dashes. Use commas, periods, or colons. No filler, no intensifiers.
- The zh side follows `../specs/research/llm-training/TRANSLATION-GLOSSARY.md`:
  code, symbols, math, URLs, and author names byte-verbatim.

## Deploy

The book deploys to `aaai.latere.ai` as a single self-contained Go binary
(scratch image, the whole book embedded) behind the shared K8s ingress. The
multi-stage `Dockerfile` compiles `_book` from source and embeds it into the
binary (`docker.yml` builds it; no vendored HTML). Deploy = push `main` → image →
`kubectl rollout restart deployment/aaai-web -n latere`. See `deploy/prod/` and
`.github/workflows/`. DNS is one A record in `../terraform/dns.tf`; the header
link lives in `../latere-ai`.

## Commits

- Commit message style: `scope: lowercase description`.
- Commit often, one intended diff at a time. Work on `main` directly.

## Related

Other latere projects are in `../`.
