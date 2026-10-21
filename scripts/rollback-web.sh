#!/usr/bin/env bash
# Put a previously built image back in production (issue #342).
#   scripts/rollback-web.sh            list available tags
#   scripts/rollback-web.sh <sha>      run agorix-web:<sha>
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/web-deploy-lib.sh"

target="${1:-}"
if [ -z "$target" ]; then
  echo "running: $(running_tag)"
  echo "available:"
  docker images agorix-web --format '  {{.Tag}}  ({{.CreatedSince}})'
  exit 0
fi
docker image inspect "agorix-web:$target" >/dev/null 2>&1 || die "no image agorix-web:$target (see list without arguments)"

exec 9>"${TMPDIR:-/tmp}/agorix-web-deploy.lock"
flock -n 9 || die "another deploy is running"

log "rolling back to agorix-web:$target"
AGORIX_WEB_TAG="$target" compose up -d web
expected=""
[ "$target" = "local" ] || expected="$target"
if wait_healthy "$expected"; then log "rollback ok: serving $target"; else die "rollback target $target is unhealthy"; fi
