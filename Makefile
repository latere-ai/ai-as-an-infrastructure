.PHONY: preview render render-html render-pdf render-epub check clean

# Live-reloading local preview.
preview:
	quarto preview

# Render every configured format (HTML, PDF, ePub).
render:
	quarto render

# HTML only. Matches what CI builds as a smoke test.
render-html:
	quarto render --to html

# PDF requires a LaTeX toolchain (quarto install tinytex).
render-pdf:
	quarto render --to pdf

render-epub:
	quarto render --to epub

# Verify the local Quarto installation and dependencies.
check:
	quarto check

clean:
	rm -rf _book .quarto _freeze
