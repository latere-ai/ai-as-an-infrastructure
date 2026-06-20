.PHONY: dev build export lint clean

# Live dev server for the reader (renders a sample chapter with hot client rebuild).
dev:
	cd app && bun run dev

# Build the static site into _book/{en,zh} (what the pre-commit hook runs).
build:
	cd app && bun install --frozen-lockfile && bun run build

# Generate the vendored PDF + EPUB into _book/<lang>/ (on demand; slow).
export:
	cd app && bun run export

# Style/diagram lint on the .qmd sources (no em dashes, no plain ```mermaid).
lint:
	sh tools/lint.sh

clean:
	rm -rf _book
