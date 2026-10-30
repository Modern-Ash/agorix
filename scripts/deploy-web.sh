#!/usr/bin/env bash
# Ship origin/main to production on this machine (issue #342).
#
#   scripts/deploy-web.sh                  full deploy
#   scripts/deploy-web.sh --preflight-only checks only (branch, clean tree, in sync with origin)
#   scripts/deploy-web.sh --skip-verify    skip `pnpm verify` (emergency; already-verified commit)
#   scripts/deploy-web.sh --skip-smoke     skip the post-deploy smoke test against the public URL
#
# Builds an image tagged with the commit, swaps the container, waits for /healthz, the security
# headers and /version.json to report the new commit, runs the production smoke test through
# the public URL, and puts the previous image back when any of that fails. See docs/deployment/MODERN_ASH_HOST.md.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/web-deploy-lib.sh"

# A clean release checkout still needs the host's reviewed Kids account flag.
web_config="${AGORIX_WEB_CONFIG_FILE:-$HOME/.config/agorix/web.env}"
if [ -z "${AGORIX_KIDS_ADULT_LINK_DEFAULT+x}" ] && [ -f "$web_config" ]; then
  configured_flag="$(sed -n 's/^AGORIX_KIDS_ADULT_LINK_DEFAULT=//p' "$web_config" | tail -n 1)"
  export AGORIX_KIDS_ADULT_LINK_DEFAULT="$configured_flag"
fi
case "${AGORIX_KIDS_ADULT_LINK_DEFAULT:-0}" in
  0|1) ;;
  *) die "AGORIX_KIDS_ADULT_LINK_DEFAULT must be 0 or 1" ;;
esac

preflight_only=0
skip_verify=0
skip_smoke=0
for arg in "$@"; do
  case "$arg" in
    --preflight-only) preflight_only=1 ;;
    --skip-verify) skip_verify=1 ;;
    --skip-smoke) skip_smoke=1 ;;
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

rollback() {
  log "FAILED: $1"
  notify "Agorix deploy of $sha failed ($1); rolling back"
  if [ -n "$previous" ] && [ "$previous" != "$sha" ]; then
    log "rolling back to agorix-web:$previous"
    AGORIX_WEB_TAG="$previous" compose up -d web
    if wait_healthy ""; then log "rollback ok: serving $previous"; else log "ROLLBACK ALSO UNHEALTHY"; notify "Agorix rollback to $previous is unhealthy"; fi
  else
    log "no previous image to roll back to"
  fi
  exit 1
}

wait_healthy "$sha" || rollback "health check"
log "healthy: $AGORIX_WEB_URL serves $sha"

if [ "$skip_smoke" -eq 1 ]; then
  log "WARNING: --skip-smoke, production smoke test not run"
else
  log "smoke test against $AGORIX_SMOKE_URL"
  run_smoke "$sha" || rollback "production smoke test"
  log "smoke ok"
fi
prune_images
log "deployed $sha"
