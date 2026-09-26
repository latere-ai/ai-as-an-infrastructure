#!/bin/sh
# Smoke test for the deployed book. Asserts the apex redirect is relative
# (regression test: it must not point at the internal :8080 port), both
# language books serve, an unknown path answers 404 rather than redirecting,
# the health endpoint is up, robots.txt states the usage preferences, llms.txt
# serves, and a page answers an agent asking for Markdown with Markdown and a
# browser with HTML.
#
# Usage:
#   deploy/smoke.sh                 # hits https://aaai.latere.ai
#   deploy/smoke.sh http://localhost:8080   # local container
#
# Shared-pipeline contract (service-release.yml smoke job): honors the BASE_URL
# env as the target, and when OUTPUT_MD is set writes a markdown evidence block
# the release job appends to the GitHub release notes.
set -eu

BASE="${BASE_URL:-${1:-https://aaai.latere.ai}}"
BASE="${BASE%/}"
fail=0
results=""
record() { results="${results}
- $1"; }
check() {
  if [ "$1" = "$2" ]; then echo "ok: $3"; record "ok — $3"
  else echo "FAIL: $3 (got '$1', want '$2')"; record "FAIL — $3 (got '$1', want '$2')"; fail=1; fi
}

# Apex must 302 to /en/ via a relative Location, never to host:8080.
loc=$(curl -sS -o /dev/null -w '%{redirect_url}' "$BASE/")
case "$loc" in
  *:8080*) echo "FAIL: apex redirect points at internal port: $loc"; record "FAIL — apex redirect points at internal port: $loc"; fail=1 ;;
  */en/)   echo "ok: apex redirects to en ($loc)"; record "ok — apex redirects to en ($loc)" ;;
  *)       echo "FAIL: unexpected apex redirect: $loc"; record "FAIL — unexpected apex redirect: $loc"; fail=1 ;;
esac

check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/en/")" "200" "/en/ serves"
check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/zh/")" "200" "/zh/ serves"
# The shape a crawler composes from relative links: a redirect here would
# hand it the home page and its links again.
check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/safety/safety/no-such-page")" "404" "unknown path answers 404"
check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/healthz")" "200" "/healthz up"

# Search and AI answers are allowed, training is refused.
signals=no
case "$(curl -sS "$BASE/robots.txt")" in
  *"Content-Signal: ai-train=no, search=yes, ai-input=yes"*) signals=yes ;;
esac
check "$signals" "yes" "robots.txt states the content signals"
check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/llms.txt")" "200" "/llms.txt serves"
# One address, two representations, chosen by the Accept header.
check "$(curl -sS -o /dev/null -w '%{content_type}' -H 'Accept: text/markdown' "$BASE/en/")" \
  "text/markdown; charset=utf-8" "/en/ answers Accept: text/markdown with Markdown"
check "$(curl -sS -o /dev/null -w '%{content_type}' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' "$BASE/en/")" \
  "text/html; charset=utf-8" "/en/ answers a browser with HTML"

status="PASS"; [ "$fail" = "0" ] || status="FAILED"

if [ -n "${OUTPUT_MD:-}" ]; then
  {
    echo "### Smoke — ${TAG:-live} ($status)"
    echo "Target: $BASE"
    printf '%s\n' "$results"
  } > "$OUTPUT_MD"
fi

[ "$fail" = "0" ] && echo "PASS" || { echo "FAILED"; exit 1; }
