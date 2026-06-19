# AI as an Infrastructure

A bilingual Quarto book, written design-first. The spine is the lifecycle of
a capability, from compute to a deployed and governed behavior, across nine
parts (Part 0 to Part IX). See `README.md` for the part list and
`CONVENTIONS.md` for how chapters are written.

Released under latere.ai, licensed CC BY-NC-ND 4.0.

## Layout

- Two standalone Quarto projects: `en/` and `zh/`, same chapter paths and
  `{#sec-...}` labels under each. Built into `_book/en` and `_book/zh`.
- Chapters live under `en/pN-*/NN-slug.qmd` (and the zh twin). Global
  chapter numbers 01 to 37.
- `INTEGRATION.md` maps source material (`../specs/research/llm-training/`
  and `../latere-ai/content/blog/`) to chapters. The book is canonical.
- Regenerate the scaffold from the TOC table if the structure changes;
  hand-written chapters (for example `03-scaling-laws`) are not regenerated.

## Authoring philosophy

Read [`CONVENTIONS.md`](CONVENTIONS.md) before writing. Every section runs
Problem, Design, Evolution, Trade-offs, Implementation, and leaves the
reader able to answer "why is it built this way?". Add a "what's contested"
box where the field is unsettled and a "constraint arrow" where a lower
layer dictates an upper one. Trace history through primary sources, keep
code minimal and cite it as `symbol, path`, close each chapter with Further
reading.

## Build and verify

- `make preview` (English) or `make preview-zh` for a live preview.
- `make render-html` builds both languages, matching CI. CI renders `en`
  and `zh` on push and PR.
- The render check is the test: before committing structural or config
  changes, run `make render-html` (or `quarto check`) and confirm both
  books build. A broken render is a broken commit.

## Writing conventions

- No em dashes. Use commas, periods, or colons. No filler, no intensifiers.
- The zh side follows `../specs/research/llm-training/TRANSLATION-GLOSSARY.md`:
  code, symbols, math, URLs, and author names byte-verbatim.

## Deploy

The book deploys to `aaai.latere.ai` as a static-serving container behind the
shared K8s ingress. See `deploy/prod/` and `.github/workflows/`. DNS is one
A record in `../terraform/dns.tf`; the header link lives in `../latere-ai`.

## Commits

- Commit message style: `scope: lowercase description`.
- Commit often, one intended diff at a time. Work on `main` directly.

## Related

Other latere projects are in `../`. The style reference is
`../../golang.design/under-the-hood`.
