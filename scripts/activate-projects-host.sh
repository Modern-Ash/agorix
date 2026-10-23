#!/usr/bin/env bash
# Guarded first activation of the SQLite account/project service (issue #433).
# This command must only be run after its PR is merged and the matching Web commit deployed.
set -euo pipefail

mode="${1:---preflight-only}"
case "$mode" in
  --preflight-only|--activate|--verify-only) ;;
  *) echo "usage: $0 [--preflight-only|--activate|--verify-only]" >&2; exit 2 ;;
esac

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"
# shellcheck source=scripts/web-deploy-lib.sh
source scripts/web-deploy-lib.sh

socket_dir="${AGORIX_PROJECT_SOCKET_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/agorix-projects/run}"
socket="$socket_dir/projects.sock"
config_dir="$HOME/.config/agorix"
env_file="$config_dir/projects.env"
unit_dir="$HOME/.config/systemd/user"
service_unit="$unit_dir/agorix-project-backup.service"
timer_unit="$unit_dir/agorix-project-backup.timer"
origin="${AGORIX_PROJECT_ORIGIN:-}"
if [ "$mode" = "--verify-only" ] && [ -z "$origin" ] && [ -f "$env_file" ]; then
  origin="$(sed -n 's/^AGORIX_PROJECT_ORIGIN=//p' "$env_file")"
fi
if [[ ! "$origin" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || [ "$origin" != "$AGORIX_SMOKE_URL" ]; then
  die "AGORIX_PROJECT_ORIGIN must equal the public HTTPS Agorix origin ($AGORIX_SMOKE_URL)"
fi
export AGORIX_PROJECT_ORIGIN="$origin"

verify_service() {
  local status
  curl -fsS --max-time 3 --unix-socket "$socket" http://localhost/healthz \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{process.exit(JSON.parse(s).status==="ok"?0:1)}catch{process.exit(1)}})' \
    || die "project Unix socket health failed"
  status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$origin/v1/session")"
  [ "$status" = "401" ] || die "public /v1/session returned $status, expected 401"
  log "project service reachable on socket and public HTTPS (unauthenticated 401)"
}

if [ "$mode" = "--verify-only" ]; then
  verify_service
  exit 0
fi

[ "$repo" = "$HOME/dev-agora/agorix" ] || die "activation requires the main host checkout at ~/dev-agora/agorix"
[ "$(git branch --show-current)" = "main" ] && [ -z "$(git status --porcelain)" ] \
  || die "activation requires a clean main"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
  || die "activation requires merged origin/main"
command -v docker >/dev/null || die "Docker is missing"
docker info >/dev/null 2>&1 || die "Docker is unavailable"
command -v node >/dev/null || die "Node is missing"
command -v curl >/dev/null || die "curl is missing"
command -v systemctl >/dev/null || die "systemctl is missing"
systemctl --user show-environment >/dev/null || die "user systemd is unavailable"
[ ! -e "$env_file" ] && [ ! -e "$service_unit" ] && [ ! -e "$timer_unit" ] \
  || die "project activation configuration already exists; inspect it manually"
if docker inspect agorix-projects >/dev/null 2>&1; then
  die "project container already exists; use --verify-only or inspect it manually"
fi

short_sha="$(git rev-parse --short=12 HEAD)"
live_sha="$(curl -fsS --max-time 10 "$origin/version.json" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).sha')"
[ "$live_sha" = "$short_sha" ] \
  || die "Web production is $live_sha; deploy merged main $short_sha before activation"

if [ "$mode" = "--preflight-only" ]; then
  log "project activation preflight passed; production was not changed"
  exit 0
fi

started=0
rollback() {
  if [ "$?" -eq 0 ]; then return; fi
  if [ "$started" -eq 1 ]; then
    compose --profile accounts stop projects >/dev/null 2>&1 || true
    compose --profile accounts rm -f -s projects >/dev/null 2>&1 || true
  fi
  systemctl --user disable --now agorix-project-backup.timer >/dev/null 2>&1 || true
  rm -f "$service_unit" "$timer_unit" "$env_file"
  systemctl --user daemon-reload >/dev/null 2>&1 || true
  echo "project activation failed; service stopped, timer removed, Web and data volumes kept" >&2
}
trap rollback EXIT

# The first snapshot is made before the recurring timer can be enabled.
compose --profile accounts build projects
started=1
compose --profile accounts up -d projects
ready=0
for _ in {1..20}; do
  if curl -fsS --max-time 1 --unix-socket "$socket" http://localhost/healthz \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{process.exit(JSON.parse(s).status==="ok"?0:1)}catch{process.exit(1)}})' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
[ "$ready" -eq 1 ] || die "project service did not become ready"
verify_service
scripts/backup-projects.sh

mkdir -p "$config_dir" "$unit_dir"
chmod 700 "$config_dir"
printf 'AGORIX_PROJECT_ORIGIN=%s\n' "$origin" > "$env_file"
chmod 600 "$env_file"
install -m 0644 deploy/web/agorix-project-backup.service "$service_unit"
install -m 0644 deploy/web/agorix-project-backup.timer "$timer_unit"
systemctl --user daemon-reload
systemctl --user enable --now agorix-project-backup.timer
trap - EXIT
log "SQLite accounts active with initial backup and daily backup timer"
