# Contributing

This repository holds the source of [AI as an
Infrastructure](https://aaai.latere.ai/en): the English and Chinese text, the
bibliography, the figure sources, and the reader that builds and serves the
site. See [`README.md`](README.md) for what the book is and its outline.

## What can be merged

The content is licensed [CC BY-NC-ND
4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/), so derivative
rewrites of the prose cannot be merged. What helps:

- factual corrections, with a primary source and its date;
- stale numbers, names, or product behavior, with the date and scope in which
  the replacement is valid;
- typos, broken links, broken math, clipped or broken figures;
- a disagreement between the English and Chinese editions;
- fixes to the reader, the build, or the tooling;
- issues that report something wrong or unclear, in either language.

The [Contribute](https://aaai.latere.ai/en/contribute) page on the site says
what makes a report useful. For a small correction, the **Edit this page**
link under a chapter opens its source file in GitHub's editor.

## Writing and translating

Prose in `en/` and `zh/` follows [`CONVENTIONS.md`](CONVENTIONS.md): the
section arc, the reader the book is written for, citations, diagrams, and the
Chinese style rules.

The two language trees are twins. A chapter exists at the same path under both
with the same `{#sec-...}` label, and a change to one tree needs the matching
change in the other: the same claim, sources, equations, figure inputs, and
cross-references. The two are not sentence-for-sentence copies; each reads
naturally in its own language.

Keep headings, section labels, cross-references, citation keys, figure
labels, and runnable interfaces stable unless the change is a deliberate
migration, because other chapters and outside links point at them.

## Layout

| Path | What it holds |
|---|---|
| `en/`, `zh/` | the chapters as `.qmd` files, one tree per language. `book.yml` in each is the manifest: parts, chapter order, and front and back matter |
| `refs/` | BibTeX files, cited from the chapters as `[@key]` |
| `glossary.yml` | the glossary entries, with their `status`, `added`, and `section` fields that drive the Techniques index |
| `app/src/figures/` | the figure modules: one TypeScript module per figure, rendered to SVG at build time and made interactive in the browser. `README.md` there is the authoring guide |
| `tools/figure-data/` | scripts that regenerate the measured data some figure modules draw |
| `figures-src/` | Python scripts for the remaining static charts. Each writes an English and a Chinese SVG to `en/figures/` and `zh/figures/`; `common.py` holds the shared style and the localization |
| `app/` | the reader: a React and Bun static site generator that compiles the `.qmd` sources into `_book/{en,zh}`. The compiler is `app/src/pipeline/`, the browser runtime for runnable cells and figures is `app/src/runtime/` and `app/src/figures/runtime/`, and chapter review dates live in `app/src/data/review-dates.json` |
| `main.go`, `internal/`, `migrations/` | the production server. It embeds `_book/` and serves it as one binary, with optional reader comments backed by Postgres |
| `deploy/` | the Kubernetes manifests, the release smoke test, and a manual publish script |
| `tools/lint.sh` | the style lint over the `.qmd` sources |

`_book/` is generated and not committed, apart from a `.gitkeep` that lets the
server's embed directive resolve before a build.

### What a chapter can contain

The reader understands Markdown with KaTeX math, citations, `@sec-` and
`@fig-` cross-references, and callout blocks, plus these kinds of figure:

- **Figure modules** in `` ```{figure} `` blocks: `//| figure:` names the
  module, `//| label:` and `//| fig-cap:` make it a numbered figure, and
  `key: value` lines set its parameters. Most figures in the book are these.
  The build renders each to inline SVG, so it reads without script.
- **Graphviz diagrams** in `` ```{dot} `` blocks, rendered to inline SVG at
  build time, for structural diagrams with nothing to vary.
- **Static charts**: an SVG from `figures-src/`, included as an image,
  `![caption](/figures/<name>.svg){#fig-<name>}`.
- **Runnable cells**: `.runnable` blocks that run Python in the browser. A few
  older `<div class="viz" data-viz="...">` elements remain, registered in
  `app/src/runtime/viz.ts`.

The reader does not render Mermaid, and the lint refuses a mermaid fence. A
Graphviz diagram takes `label` and `fig-cap` directives on its first `//|`
lines to become a numbered figure that `@fig-` can reference; a chart takes
its label in the image attributes.

## Build

Requires [Bun](https://bun.sh) and [Go](https://go.dev). The runnable-cell
tests and the chart scripts also need Python 3 with the packages in
`app/requirements-test.txt` (matplotlib and numpy).

```sh
make dev          # the reader's dev server, with hot client rebuild
make build        # build both languages into _book/{en,zh}
make serve        # build _book, then run the production server on :8080
sh tools/lint.sh  # the .qmd lint: em dashes, any mermaid fence, --- in prose
make og           # redraw the social-share cards in app/static/og (slow)
```

The build is the test: `make build` must compile both languages.

To redraw a chart, run its script: `python3 figures-src/<name>.py` writes both
SVGs. Commit the script and the two SVGs together.

`make og` drives headless Chrome and is needed only after adding or retitling
a chapter. Its output in `app/static/og/` is committed, so to redraw one card
rather than all of them, name its path: `cd app && bun run og contribute`.

## Tests

Two suites cover different layers, and neither runs the other:

- `cd app && bun test` checks the reader and the content structure: en and zh
  parity (headings, anchors, citations, cross-references, math, interactive
  figures), the rendering of every page, runnable cells, citations, and link
  resolution. Most of it reads the built site, so run `make build` first, and
  install `app/requirements-test.txt` for the runnable-cell tests. The tests
  do not pin prose, so a wording edit needs no test edit; do not add tests
  that assert phrases or heading text.
- `make test` runs the Go server's suite: routing, redirects,
  canonicalization, and cache headers. It does not build the book. The tests
  that serve real pages skip when `_book/` holds no site, so run
  `make build && make test` to include them.

Two more Go tests skip rather than fail when their environment is missing, so
a green `go test` does not mean they ran:

- The comment store's Postgres test runs only when `AAAI_TEST_DATABASE_URL`
  points at a throwaway database. Set it when changing `internal/store/` or
  `migrations/`.
- The publish-script test skips when `git` is not on `PATH`.

`make check` runs the whole Go quality gate (`go tool lateregate`): formatting,
the linters, vulnerabilities, the suite with and without the race detector,
and the hermetic run. `go tool lateregate list` names each gate.

On every push and pull request, CI runs that gate, then the `.qmd` lint, the
Bun build of both languages, `bun test` against the build, and `go test`
against the build, so a broken build is a broken commit.

Install the git hooks once with `make hooks`. Before a commit they reject
unformatted Go and code a standard library call already covers; before a push
they run the linter over the packages the push changes.

## Running the server

`make serve` runs the server with no configuration: it serves the embedded
book and nothing else. Everything below is optional.

| Variable | What it does |
|---|---|
| `LISTEN_ADDR` | the listen address. Unset, the server reads `PORT`, and then defaults to `:8080` |
| `DATABASE_URL` | a Postgres connection string. Set, it turns reader comments on and applies the migrations at start-up. Unset, there are no comments and `/readyz` checks nothing |
| `DATABASE_POOL_URL` | a pooled connection string for serving traffic. Migrations keep `DATABASE_URL` |
| `AUTH_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_REDIRECT_URL`, `AUTH_COOKIE_KEY` | OpenID Connect sign-in, which lets readers post comments. Without `AUTH_CLIENT_ID`, comments are read-only. `AUTH_URL` defaults to `https://auth.latere.ai` |
| `AUTH_INSECURE_COOKIES` | `true` drops the `Secure` cookie flag for local development over plain HTTP. Never in production |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | the OpenTelemetry collector that logs, traces, and metrics are exported to. Unset, the server writes structured logs to stderr and exports nothing |

## Changelog and releases

[`CHANGELOG.md`](CHANGELOG.md) says what changed for readers, one section per
release. Add a line under `Unreleased` when a change is visible on the site.
The reader-facing weekly changelog is the `changelog.qmd` page in each
language tree.

Releases are cut by the maintainers. A push to `main` builds the `:main`
container image. A version tag, made with `go tool lateregate release vX.Y.Z`,
moves the `Unreleased` notes under the version, and the release workflow
builds the image, deploys `deploy/prod/`, runs `deploy/smoke.sh` against the
live site, and publishes the GitHub release. `deploy/publish.sh` applies the
same overlay by hand.
