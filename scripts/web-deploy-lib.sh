#!/usr/bin/env bash
# Shared helpers for deploy-web.sh and rollback-web.sh (issue #342).

AGORIX_WEB_URL="${AGORIX_WEB_URL:-http://127.0.0.1:8470}"
AGORIX_HEALTH_TIMEOUT="${AGORIX_HEALTH_TIMEOUT:-30}"
AGORIX_KEEP_IMAGES="${AGORIX_KEEP_IMAGES:-5}"
AGORIX_CONTAINER="${AGORIX_CONTAINER:-agorix-web}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

repo_root() {
  if [ -n "${AGORIX_REPO_ROOT:-}" ]; then printf '%s\n' "$AGORIX_REPO_ROOT"; else git rev-parse --show-toplevel; fi
}

compose() {
  docker compose -f "$(repo_root)/deploy/web/docker-compose.yml" "$@"
}

# Tag of the image the production container runs now (empty when it does not exist).
running_tag() {
  local image
  image="$(docker inspect "$AGORIX_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true)"
  printf '%s\n' "${image##*:}"
}

# Succeeds when the site is healthy: /healthz answers, the security headers are present and,
# when a commit is expected, /version.json reports it. Retries until AGORIX_HEALTH_TIMEOUT.
wait_healthy() {
  local expected_sha="${1:-}" waited=0 body
  while [ "$waited" -lt "$AGORIX_HEALTH_TIMEOUT" ]; do
    if curl -fsS -m 3 "$AGORIX_WEB_URL/healthz" >/dev/null 2>&1 \
      && curl -fsSI -m 3 "$AGORIX_WEB_URL/" 2>/dev/null | grep -qi '^content-security-policy:'; then
      if [ -z "$expected_sha" ]; then return 0; fi
      body="$(curl -fsS -m 3 "$AGORIX_WEB_URL/version.json" 2>/dev/null || true)"
      case "$body" in *"\"sha\":\"$expected_sha"*) return 0 ;; esac
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# Keep the newest AGORIX_KEEP_IMAGES agorix-web images plus the running one.
prune_images() {
  local running tag kept=0
  running="$(running_tag)"
  while read -r tag; do
    [ -n "$tag" ] || continue
    [ "$tag" = "<none>" ] && continue
    if [ "$tag" = "$running" ] || [ "$tag" = "local" ]; then continue; fi
    kept=$((kept + 1))
    if [ "$kept" -gt "$AGORIX_KEEP_IMAGES" ]; then
      docker rmi "agorix-web:$tag" >/dev/null 2>&1 || true
    fi
  done < <(docker images agorix-web --format '{{.Tag}}')
}
