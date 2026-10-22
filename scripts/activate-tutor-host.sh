#!/usr/bin/env bash
# First-time host activation. Run only after the matching Web commit is deployed.
set -euo pipefail

mode="${1:---preflight-only}"
case "$mode" in
  --preflight-only|--activate|--verify-only) ;;
  *) printf 'usage: %s [--preflight-only|--activate|--verify-only]\n' "$0" >&2; exit 2 ;;
esac

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"

if [ "$mode" = "--verify-only" ]; then
  exec node scripts/check-ori-live.mjs
fi

[ "$repo" = "$HOME/dev-agora/agorix" ] || {
  echo "Ori unit expects the main checkout at ~/dev-agora/agorix" >&2; exit 1;
}
[ "$(git branch --show-current)" = "main" ] || { echo "Ori activation requires main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Ori activation requires a clean tree" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || {
  echo "Ori activation requires the merged origin/main commit" >&2; exit 1;
}
command -v codex >/dev/null || { echo "Codex CLI is missing" >&2; exit 1; }
codex login status >/dev/null || { echo "Codex CLI is not logged in" >&2; exit 1; }
command -v corepack >/dev/null || { echo "Corepack is missing" >&2; exit 1; }
systemctl --user show-environment >/dev/null

if [ "$mode" = "--preflight-only" ]; then
  echo "Ori host preflight passed; production was not changed"
  exit 0
fi

unit="$HOME/.config/systemd/user/agorix-tutor.service"
[ ! -e "$unit" ] || { echo "Ori unit already exists; use --verify-only or inspect it manually" >&2; exit 1; }
short_sha="$(git rev-parse --short=12 HEAD)"
live_sha="$(curl -fsS --max-time 10 https://agorix.modern-ash.com/version.json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).sha')"
[ "$live_sha" = "$short_sha" ] || {
  echo "Web production is $live_sha; deploy merged main $short_sha before Ori activation" >&2; exit 1;
}

corepack pnpm --filter @agorix/tutor-api build
mkdir -p "$HOME/.config/systemd/user"
install -m 0644 deploy/web/agorix-tutor.service "$unit"
rollback() {
  if [ "$?" -ne 0 ]; then
    systemctl --user disable --now agorix-tutor.service >/dev/null 2>&1 || true
    rm -f "$unit"
    systemctl --user daemon-reload >/dev/null 2>&1 || true
    echo "Ori activation failed; host service was rolled back" >&2
  fi
}
trap rollback EXIT
systemctl --user daemon-reload
systemctl --user enable --now agorix-tutor.service
node scripts/check-ori-live.mjs
trap - EXIT
echo "Ori host service active with a verified real model proposal"
