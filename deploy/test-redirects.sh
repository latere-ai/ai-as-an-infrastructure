#!/bin/sh
# Regression test for nginx routing. Runs the real nginx image with deploy/
# nginx.conf over the vendored _book and asserts the redirect/serve contract.
# Catches the index.html<->/ redirect loop that broke /en/ and /zh/ (and all of
# Incognito, where there is no lang cookie). Requires docker. Run: sh deploy/test-redirects.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME=aaai-nginx-test
PORT=8899
B="http://localhost:$PORT"
# Container runtime: docker or podman (override with DOCKER=...).
OCI="${DOCKER:-$(command -v docker || command -v podman)}"
[ -n "$OCI" ] || { echo "need docker or podman"; exit 1; }

"$OCI" rm -f "$NAME" >/dev/null 2>&1 || true
"$OCI" run -d --name "$NAME" -p "$PORT:8080" \
  -v "$ROOT/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$ROOT/_book:/usr/share/nginx/html:ro" \
  nginxinc/nginx-unprivileged:1.27-alpine >/dev/null
trap '"$OCI" rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
sleep 2

fail=0
# code <url> <expected-status> [cookie]
code() { c=$(curl -s -o /dev/null -w '%{http_code}' ${3:+--cookie "$3"} "$B$1"); [ "$c" = "$2" ] || { echo "FAIL $1 => $c (want $2)"; fail=1; }; }
# loc <url> <expected-location>
loc()  { l=$(curl -sI "$B$1" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}'); [ "$l" = "$2" ] || { echo "FAIL $1 location => '$l' (want '$2')"; fail=1; }; }
# noloop <url>: must terminate at a 200 within a few hops (not ERR_TOO_MANY_REDIRECTS)
noloop() { c=$(curl -s -o /dev/null -w '%{http_code}' -L --max-redirs 5 "$B$1"); [ "$c" = "200" ] || { echo "FAIL $1 redirect chain => $c (loop?)"; fail=1; }; }

noloop /                                              # apex must resolve, not loop
noloop /en/                                           # lang home (was the loop)
noloop /zh/
code   /en/ 200
code   /zh/ 200
code   /zh/reasoning/inference-time-scaling 200       # number-free final URL serves
code   /zh/nope 404
loc    /en/index.html /en/                            # index.html canonicalizes
loc    /zh/reasoning/inference-time-scaling.html /zh/reasoning/inference-time-scaling
# Reorg 2026-06: old numbered AND the brief de-numbered path both 301 to the final part.
loc    /zh/p3-reasoning/15-inference-time-scaling      /zh/reasoning/inference-time-scaling
loc    /zh/p3-reasoning/inference-time-scaling         /zh/reasoning/inference-time-scaling
loc    /en/p4-inference/16-serving-problem.html        /en/inference/serving-problem
noloop /zh/p3-reasoning/15-inference-time-scaling      # old path chains to a 200 at the final location
# Cross-part moves: agents -> orchestration, generative out of frontiers, frontiers -> infrastructure, ops -> practice.
loc    /en/p3-reasoning/16-training-agents-to-act      /en/orchestration/training-agents-to-act
loc    /en/p3-reasoning/training-agents-to-act         /en/orchestration/training-agents-to-act
loc    /en/p11-frontiers/52-diffusion-flow-matching    /en/generative/diffusion-flow-matching
loc    /zh/p11-frontiers/58-multimodal-models          /zh/generative/multimodal-models
loc    /en/p11-frontiers/45-the-compute-frontier       /en/infrastructure/the-compute-frontier
loc    /zh/p13-operations/deployment-lifecycle         /zh/practice/deployment-lifecycle
loc    /en/p10-practical/38-choosing-a-model           /en/practice/choosing-a-model
noloop /en/p3-reasoning/16-training-agents-to-act      # cross-part old path chains to a 200

[ "$fail" = 0 ] && echo "nginx routing: all checks passed" || { echo "nginx routing: FAILURES"; exit 1; }
