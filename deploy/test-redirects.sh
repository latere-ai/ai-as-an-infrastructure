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
code   /zh/p3-reasoning/inference-time-scaling 200    # number-free clean URL serves
code   /zh/nope 404
loc    /en/index.html /en/                            # index.html canonicalizes
loc    /zh/p3-reasoning/inference-time-scaling.html /zh/p3-reasoning/inference-time-scaling
# Number-free URLs: the old "NN-" numbered path 301s to its de-numbered form.
loc    /zh/p3-reasoning/15-inference-time-scaling      /zh/p3-reasoning/inference-time-scaling
loc    /en/p4-inference/16-serving-problem.html        /en/p4-inference/serving-problem
noloop /zh/p3-reasoning/15-inference-time-scaling      # old numbered path resolves (200) de-numbered
# Relocated chapters (Part XII/XIII split): old numbered + de-numbered paths 301 to the new dirs.
loc    /en/p11-frontiers/52-diffusion-flow-matching      /en/p12-generative/diffusion-flow-matching
loc    /zh/p11-frontiers/58-multimodal-models            /zh/p12-generative/multimodal-models
loc    /en/p11-frontiers/diffusion-flow-matching.html    /en/p12-generative/diffusion-flow-matching
loc    /en/p12-operations/54-production-data-engine       /en/p13-operations/production-data-engine
loc    /zh/p12-operations/deployment-lifecycle            /zh/p13-operations/deployment-lifecycle
noloop /en/p11-frontiers/58-multimodal-models            # old path resolves (200) at new location

[ "$fail" = 0 ] && echo "nginx routing: all checks passed" || { echo "nginx routing: FAILURES"; exit 1; }
