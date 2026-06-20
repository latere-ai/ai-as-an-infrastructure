#!/usr/bin/env bash
# Test for cjk-softbreak.lua: a source line wrap between two CJK characters
# must not render as a visible space, while spacing around Latin words and
# code spans is left untouched. Fails without the filter, passes with it.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pandoc >/dev/null 2>&1; then
  echo "SKIP: pandoc not installed"; exit 0
fi

fixture=$(printf '一个被\n部署。写在 `CONVENTIONS.md`\n中。English word\nwrap here.\n')
# --wrap=none stops pandoc re-flowing the output at 72 cols, which would
# otherwise insert cosmetic newlines that confuse the whitespace assertions.
render() { printf '%s\n' "$fixture" | pandoc "$@" --wrap=none -t html | sed 's/<[^>]*>//g'; }

base=$(render)
filtered=$(render --lua-filter=cjk-softbreak.lua)

fail=0
# The test is only meaningful if the unfiltered baseline reproduces the gap.
printf '%s' "$base" | grep -q '一个被 部署' \
  && echo "ok: baseline reproduces the CJK gap" \
  || { echo "FAIL: baseline did not reproduce the gap (test is moot)"; fail=1; }
# After filtering, the gap is gone.
printf '%s' "$filtered" | grep -q '一个被部署' \
  && echo "ok: filter collapses the CJK break" \
  || { echo "FAIL: CJK break not collapsed -> $filtered"; fail=1; }
# Latin word spacing and the code-span boundary are preserved.
printf '%s' "$filtered" | grep -q 'English word wrap here.' \
  && echo "ok: Latin spacing preserved" \
  || { echo "FAIL: Latin spacing broken -> $filtered"; fail=1; }

[ "$fail" -eq 0 ] && echo "PASS" || echo "FAILED"
exit "$fail"
