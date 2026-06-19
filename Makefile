.PHONY: preview preview-zh render render-en render-zh render-html check clean

# Live preview, one language at a time (Quarto previews a single project).
preview:
	quarto preview en

preview-zh:
	quarto preview zh

# Render both language books (HTML, PDF, ePub) into _book/en and _book/zh.
render: render-en render-zh

render-en:
	quarto render en

render-zh:
	quarto render zh

# HTML-only smoke test for both, matching CI.
render-html:
	quarto render en --to html
	quarto render zh --to html

check:
	quarto check

clean:
	rm -rf _book en/.quarto zh/.quarto
