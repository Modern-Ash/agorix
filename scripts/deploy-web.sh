#!/usr/bin/env bash
# Ship origin/main to production on this machine (issue #342).
#
#   scripts/deploy-web.sh                  full deploy
#   scripts/deploy-web.sh --preflight-only checks only (branch, clean tree, in sync with origin)
#   scripts/deploy-web.sh --skip-verify    skip `pnpm verify` (emergency; already-verified commit)
#
# Builds an image tagged with the commit, swaps the container, waits for /healthz, the security
# headers and /version.json to report the new commit, and puts the previous image back when
# any of that fails. See docs/deployment/MODERN_ASH_HOST.md.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/web-deploy-lib.sh"

preflight_only=0
skip_verify=0
for arg in "$@"; do
  case "$arg" in
    --preflight-only) preflight_only=1 ;;
    --skip-verify) skip_verify=1 ;;
    *) die "unknown option: $arg" ;;
  esac
done

root="$(repo_root)"
cd "$root"

branch="$(git branch --show-current)"
[ "$branch" = "main" ] || die "refusing to deploy: on '${branch:-detached HEAD}', deploys ship main"
[ -z "$(git status --porcelain)" ] || die "refusing to deploy: the working tree is dirty"
if [ -z "${AGORIX_SKIP_FETCH:-}" ]; then
  git fetch -q origin main
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
    || die "refusing to deploy: local main differs from origin/main"
fi
sha="$(git rev-parse --short=12 HEAD)"
log "preflight ok: main at $sha"
[ "$preflight_only" -eq 0 ] || exit 0

exec 9>"${TMPDIR:-/tmp}/agorix-web-deploy.lock"
flock -n 9 || die "another deploy is running"

if [ "$skip_verify" -eq 1 ]; then
  log "WARNING: --skip-verify, pnpm verify not run"
else
  log "pnpm verify"
  pnpm verify
fi

previous="$(running_tag)"
log "building agorix-web:$sha (previous: ${previous:-none})"
GIT_SHA="$sha" AGORIX_WEB_TAG="$sha" compose build web
log "starting agorix-web:$sha"
AGORIX_WEB_TAG="$sha" compose up -d web

if wait_healthy "$sha"; then
  log "healthy: $AGORIX_WEB_URL serves $sha"
  prune_images
  exit 0
fi

log "FAILED health check for $sha"
if [ -n "$previous" ] && [ "$previous" != "$sha" ]; then
  log "rolling back to agorix-web:$previous"
  AGORIX_WEB_TAG="$previous" compose up -d web
  if wait_healthy ""; then log "rollback ok: serving $previous"; else log "ROLLBACK ALSO UNHEALTHY"; fi
else
  log "no previous image to roll back to"
fi
exit 1
