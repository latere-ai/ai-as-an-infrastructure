#!/bin/sh
# Lint book sources for three recurring mistakes:
#   1. em dashes (house style bans them)
#   2. mermaid fences, ```mermaid or ```{mermaid} (the reader does not render
#      mermaid; the fence would ship as a code listing)
#   3. `---` inside a prose line (the reader renders it as an em dash)
set -eu
cd "$(dirname "$0")/.."
fail=0

if grep -rln '—' en zh --include='*.qmd' 2>/dev/null; then
  echo "FAIL: em dash found in the files above"
  fail=1
fi

if grep -rnE '^[[:space:]]*(```|~~~)[[:space:]]*\{?\.?mermaid' en zh --include='*.qmd' 2>/dev/null; then
  echo 'FAIL: mermaid fence in the files above (mermaid is not rendered; use a ```{figure} module or a ```{dot} block)'
  fail=1
fi

# Front matter, horizontal rules on their own line, table separator rows,
# fenced code blocks, and inline code spans are exempt.
triple=$(find en zh -name '*.qmd' -exec awk '
  FNR == 1 { code = 0; front = ($0 ~ /^---[ \t]*$/); if (front) next }
  front { if ($0 ~ /^---[ \t]*$/) front = 0; next }
  /^[ \t]*(```|~~~)/ { code = !code; next }
  code { next }
  /^[ \t]*---+[ \t]*$/ { next }
  /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/ { next }
  { line = $0; gsub(/`[^`]*`/, "", line) }
  line ~ /---/ { print FILENAME ":" FNR ": " $0 }
' {} +)
if [ -n "$triple" ]; then
  echo "$triple"
  echo "FAIL: --- inside a prose line above (the reader renders it as an em dash)"
  fail=1
fi

if [ "$fail" = 0 ]; then echo "lint ok"; else exit 1; fi
