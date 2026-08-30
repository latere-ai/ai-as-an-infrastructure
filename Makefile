.PHONY: dev serve build og lint lint-modernize fmt fmt-check hooks test clean publish deploy

# Live dev server for the reader (renders a sample chapter with hot client rebuild).
dev:
	cd app && bun run dev

# Build _book (if needed) then run the production Go server that embeds it.
# This is what the container runs; serves on :8080 (override with PORT=).
serve: build
	go run .

# Routing-contract tests for the Go server (redirects, canonicalization, cache
# headers). Needs _book present to embed, so build it first.
# The Go suite, without the book build: _book/ carries a committed .gitkeep so
# the embed resolves, and the tests that serve real pages skip when it holds no
# site. `make build && make test` covers those too.
test:
	go vet ./...
	go test ./...

test-hermetic:
	@go tool lateregate hermetic

lint-config:
	@go tool lateregate golangci

GOLANGCI_VERSION ?= v2.13.1

lint-go: lint-config
	@go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_VERSION) run ./...

# Build the static site into _book/{en,zh}. Generated output, not committed;
# the Go server embeds it (see `make serve`) and the Docker build compiles it.
build:
	cd app && bun install --frozen-lockfile && bun run build

# Generate the English social-share cards into app/static/og (on demand; slow,
# needs headless Chrome). These are committed source; `make build` copies them
# into _book/og. Re-run and commit after adding or retitling chapters.
og:
	cd app && bun run og

# Style/diagram lint on the .qmd sources (no em dashes, no plain ```mermaid).
lint:
	sh tools/lint.sh

# lint-modernize fails on code that a standard library call already covers.
# It runs the toolchain modernizers, which overlap golangci-lint's modernize
# linter but add three it does not carry: buildtag, hostport, and the
# go:fix inline directives. newexpr and errorsastype are off for the reasons
# recorded in .golangci.yml.
# Only a non-empty patch fails the target. go fix also exits non-zero when a
# package does not type-check, which is a build error rather than a finding,
# so stderr is dropped and the decision rests on the patch alone.
# It is separate from `lint`, which is a .qmd style check on the prose sources.
lint-modernize:
	@go tool lateregate modernize

# fmt rewrites every Go source in place with gofmt.
fmt:
	gofmt -w .

# fmt-check fails if any Go source is not gofmt-formatted.
fmt-check:
	@go tool lateregate fmt-check

# hooks installs the repository git hooks. The pre-commit hook rejects
# unformatted Go files and code that a standard library call already covers.
hooks:
	git config core.hooksPath .githooks
	@[ -e CLAUDE.md ] || [ -L CLAUDE.md ] || ln -s AGENTS.md CLAUDE.md
	@echo "installed git hooks (core.hooksPath=.githooks)"

publish:
	sh deploy/publish.sh

deploy: publish

clean:
	rm -rf _book
