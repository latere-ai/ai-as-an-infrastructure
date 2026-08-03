# Contributing

This repository holds the source of [AI as an
Infrastructure](https://aaai.latere.ai/en). See [`README.md`](README.md) for
what the book is and its outline.

## What is welcome

The content is licensed [CC BY-NC-ND
4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/), so derivative
rewrites of the prose cannot be merged. What helps:

- factual corrections, with a primary source;
- typos, broken links, broken math, broken diagrams;
- fixes to the reader, the build, or the tooling;
- issues that report something wrong or unclear, in either language.

Prose in `en/` and `zh/` follows [`CONVENTIONS.md`](CONVENTIONS.md). A change
to one language tree needs the same change in its twin.

## Layout

- `en/` and `zh/` are parallel language trees. `book.yml` in each is the reader
  manifest; the same chapter paths and `{#sec-...}` labels exist under both.
- `app/` is the reader: a custom React + Bun static site generator that
  compiles the `.qmd` sources (markdown, KaTeX math, citations from
  `references.bib`, cross-refs, graphviz/mermaid, callouts, runnable cells and
  viz) into `_book/{en,zh}`. The compiler lives in `app/src/pipeline/`.
- `main.go` is the production server. It embeds `_book` with `//go:embed` and
  serves it as a single binary. `_book` is generated output and is not
  committed.
- `figures-src/` generates the static SVG plots; `refs/` holds the
  bibliography; `deploy/` holds the Kubernetes manifests.

## Build

Requires [Bun](https://bun.sh) and [Go](https://go.dev).

```sh
make dev     # live reader dev server (hot client rebuild)
make build   # build both languages into _book/{en,zh}
make serve   # build _book, then run the production Go server (:8080)
make test    # routing-contract tests for the Go server
make og      # regenerate the social-share cards in app/static/og (on demand)
make lint    # style/diagram lint on the .qmd sources
```

The build is the test: `make build` must compile both languages. CI runs the
lint, the Bun build for `en` and `zh`, and `go test` on every push and pull
request, so a broken build is a broken commit.

`make og` is slow (headless Chrome) and only needed after adding or retitling a
chapter. Its output in `app/static/og/` is committed, so to redraw one card
rather than all of them, name its href: `cd app && bun run og contribute`.

## Deploy

Pushing to `main` builds the container image; the rollout to `aaai.latere.ai`
is a separate manual step. See `deploy/`.
