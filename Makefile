.PHONY: dev serve build og lint test clean publish deploy

# Live dev server for the reader (renders a sample chapter with hot client rebuild).
dev:
	cd app && bun run dev

# Build _book (if needed) then run the production Go server that embeds it.
# This is what the container runs; serves on :8080 (override with PORT=).
serve: build
	go run .

# Routing-contract tests for the Go server (redirects, canonicalization, cache
# headers). Needs _book present to embed, so build it first.
test: build
	go test ./...

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

publish:
	sh deploy/publish.sh

deploy: publish

clean:
	rm -rf _book
