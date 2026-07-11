#!/bin/sh
# Smoke test for the deployed book. Asserts the apex redirect is relative
# (regression test: it must not point at the internal :8080 port), both
# language books serve, and the health endpoint is up.
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
check "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/healthz")" "200" "/healthz up"

status="PASS"; [ "$fail" = "0" ] || status="FAILED"

if [ -n "${OUTPUT_MD:-}" ]; then
  {
    echo "### Smoke — ${TAG:-live} ($status)"
    echo "Target: $BASE"
    printf '%s\n' "$results"
  } > "$OUTPUT_MD"
fi

[ "$fail" = "0" ] && echo "PASS" || { echo "FAILED"; exit 1; }
