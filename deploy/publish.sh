#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/latere-ai/ai-as-an-infrastructure}"
NAMESPACE="${NAMESPACE:-latere}"
DEPLOYMENT="${DEPLOYMENT:-aaai-web}"
MANIFEST_DIR="${MANIFEST_DIR:-deploy/prod}"
BASE_URL="${BASE_URL:-https://aaai.latere.ai}"
PUBLISH_TIMEOUT="${PUBLISH_TIMEOUT:-1200}"
PUBLISH_POLL_INTERVAL="${PUBLISH_POLL_INTERVAL:-10}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

need git
need gh
need kubectl
need curl

[ -d "$MANIFEST_DIR" ] || die "manifest directory not found: $MANIFEST_DIR"

current_branch=$(git branch --show-current)
[ "$current_branch" = "$BRANCH" ] || die "publish from $BRANCH, currently on ${current_branch:-detached HEAD}"

[ -z "$(git status --porcelain)" ] || die "working tree is dirty; commit or stash changes before publishing"

git fetch "$REMOTE" "$BRANCH" --tags
counts=$(git rev-list --left-right --count "$REMOTE/$BRANCH...HEAD")
set -- $counts
behind="$1"
ahead="$2"
[ "$behind" = "0" ] || die "local $BRANCH is behind $REMOTE/$BRANCH; rebase or pull first"

sha=$(git rev-parse HEAD)
short_sha=$(git rev-parse --short HEAD)
main_image="$IMAGE_REPO:main"
commit_image="$IMAGE_REPO:$sha"

if [ "$ahead" = "0" ]; then
  log "No local commits to push; deploying $REMOTE/$BRANCH at $short_sha"
else
  log "Pushing $short_sha to $REMOTE/$BRANCH"
fi
git push "$REMOTE" "$BRANCH"

wait_for_workflow() {
  workflow="$1"
  started_at=$(date +%s)
  log "Waiting for GitHub Actions workflow: $workflow"

  while :; do
    line=$(gh run list \
      --workflow "$workflow" \
      --branch "$BRANCH" \
      --commit "$sha" \
      --event push \
      --limit 1 \
      --json databaseId,status,conclusion,url \
      --jq '.[] | [.databaseId, .status, (.conclusion // "none"), .url] | @tsv' 2>/dev/null || true)

    if [ -n "$line" ]; then
      set -- $line
      run_id="$1"
      status="$2"
      conclusion="$3"
      url="$4"

      if [ "$status" = "completed" ]; then
        if [ "$conclusion" = "success" ]; then
          log "Workflow $workflow succeeded: $url"
          return 0
        fi
        die "workflow $workflow completed with conclusion '$conclusion': $url"
      fi

      log "Workflow $workflow run $run_id is $status"
    else
      log "Workflow $workflow has not appeared for $short_sha yet"
    fi

    now=$(date +%s)
    elapsed=$((now - started_at))
    [ "$elapsed" -lt "$PUBLISH_TIMEOUT" ] || die "timed out waiting for workflow $workflow"
    sleep "$PUBLISH_POLL_INTERVAL"
  done
}

validate_image() {
  image="$1"
  log "Validating image manifest: $image"

  if command -v docker >/dev/null 2>&1 && docker buildx imagetools inspect "$image" >/dev/null 2>&1; then
    log "Image exists: $image"
    return 0
  fi

  if command -v podman >/dev/null 2>&1 && podman manifest inspect "docker://$image" >/dev/null 2>&1; then
    log "Image exists: $image"
    return 0
  fi

  die "could not inspect $image; check GHCR auth and local docker/podman availability"
}

wait_for_workflow render
wait_for_workflow docker

git fetch "$REMOTE" "$BRANCH" --tags
remote_sha=$(git rev-parse "$REMOTE/$BRANCH")
[ "$remote_sha" = "$sha" ] || die "$REMOTE/$BRANCH advanced while publishing; refusing to deploy stale $short_sha"

validate_image "$commit_image"
validate_image "$main_image"

log "Applying Kubernetes manifests from $MANIFEST_DIR"
kubectl -n "$NAMESPACE" apply -f "$MANIFEST_DIR"

log "Restarting deployment/$DEPLOYMENT so Kubernetes pulls $main_image"
kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"

log "Running smoke test against $BASE_URL"
sh deploy/smoke.sh "$BASE_URL"

log "Published $short_sha to $BASE_URL"
