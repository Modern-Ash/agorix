#!/usr/bin/env bash
# Shared helpers for deploy-web.sh and rollback-web.sh (issue #342).

AGORIX_WEB_URL="${AGORIX_WEB_URL:-http://127.0.0.1:8470}"
AGORIX_HEALTH_TIMEOUT="${AGORIX_HEALTH_TIMEOUT:-30}"
AGORIX_KEEP_IMAGES="${AGORIX_KEEP_IMAGES:-5}"
AGORIX_CONTAINER="${AGORIX_CONTAINER:-agorix-web}"
# Public address the post-deploy smoke test drives (through Cloudflare, like a real visitor).
AGORIX_SMOKE_URL="${AGORIX_SMOKE_URL:-https://agorix.modern-ash.com}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

repo_root() {
  if [ -n "${AGORIX_REPO_ROOT:-}" ]; then printf '%s\n' "$AGORIX_REPO_ROOT"; else git rev-parse --show-toplevel; fi
}

compose() {
  local socket_dir="${AGORIX_TUTOR_SOCKET_DIR:-${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/agorix-tutor}"
  mkdir -p -m 755 "$socket_dir"
  AGORIX_TUTOR_SOCKET_DIR="$socket_dir" docker compose -f "$(repo_root)/deploy/web/docker-compose.yml" "$@"
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

# Runs the read-only production smoke (e2e/prod) against AGORIX_SMOKE_URL. $1 = expected commit.
run_smoke() {
  local expected_sha="${1:-}"
  (
    cd "$(repo_root)/apps/web" || return 1
    AGORIX_E2E_BASE_URL="$AGORIX_SMOKE_URL" AGORIX_EXPECT_SHA="$expected_sha" pnpm test:prod
  )
}

# Optional alert hook: AGORIX_NOTIFY_CMD is a command (word-split, no shell) that receives the message.
notify() {
  [ -n "${AGORIX_NOTIFY_CMD:-}" ] || return 0
  # shellcheck disable=SC2086
  $AGORIX_NOTIFY_CMD "$*" >/dev/null 2>&1 || true
}
