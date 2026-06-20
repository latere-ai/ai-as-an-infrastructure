#!/bin/sh
# Lint book sources for two recurring mistakes:
#   1. em dashes (house style bans them)
#   2. plain ```mermaid fences (Quarto needs ```{mermaid} to render a diagram)
set -eu
cd "$(dirname "$0")/.."
fail=0

if grep -rln '—' en zh --include='*.qmd' 2>/dev/null; then
  echo "FAIL: em dash found in the files above"
  fail=1
fi

if grep -rln '^```mermaid[ ]*$' en zh --include='*.qmd' 2>/dev/null; then
  echo 'FAIL: plain ```mermaid fence in the files above (use ```{mermaid})'
  fail=1
fi

if [ "$fail" = 0 ]; then echo "lint ok"; else exit 1; fi
