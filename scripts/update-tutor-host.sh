#!/usr/bin/env bash
# Update an existing Ori service from a published, merged main with a versioned bundle.
set -euo pipefail

mode="${1:---preflight-only}"
case "$mode" in
  --preflight-only|--activate|--verify-only) ;;
  *) echo "usage: $0 [--preflight-only|--activate|--verify-only]" >&2; exit 2 ;;
esac
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"
if [ "$mode" = "--verify-only" ]; then exec node scripts/check-ori-live.mjs; fi
[ "$(git branch --show-current)" = "main" ] || { echo "Ori update requires main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Ori update requires a clean tree" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || {
  echo "Ori update requires the merged origin/main commit" >&2; exit 1;
}
command -v codex >/dev/null || { echo "Codex CLI is missing" >&2; exit 1; }
codex login status >/dev/null || { echo "Codex CLI is not logged in" >&2; exit 1; }
command -v corepack >/dev/null || { echo "Corepack is missing" >&2; exit 1; }
systemctl --user is-active --quiet agorix-tutor.service || { echo "Ori service is not active" >&2; exit 1; }
short_sha="$(git rev-parse --short=12 HEAD)"
live_sha="$(curl -fsS --max-time 10 https://agorix.modern-ash.com/version.json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).sha')"
[ "$live_sha" = "$short_sha" ] || {
  echo "Web production is $live_sha; publish merged main $short_sha first" >&2; exit 1;
}
if [ "$mode" = "--preflight-only" ]; then
  echo "Ori update preflight passed; production was not changed"
  exit 0
fi

release_root="$HOME/.local/share/agorix/tutor-releases"
release="$release_root/$short_sha"
dropin_dir="$HOME/.config/systemd/user/agorix-tutor.service.d"
dropin="$dropin_dir/30-versioned-bundle.conf"
mkdir -p -m 700 "$release_root" "$dropin_dir"
backup_dir="$(mktemp -d "$release_root/.rollback-XXXXXX")"
chmod 700 "$backup_dir"
had_dropin=0
if [ -f "$dropin" ]; then cp -p "$dropin" "$backup_dir/dropin"; had_dropin=1; fi
had_checkout_bundle=0
if [ -f apps/tutor-api/dist/main.mjs ]; then
  cp -p apps/tutor-api/dist/main.mjs "$backup_dir/checkout-main.mjs"
  had_checkout_bundle=1
fi
database="${AGORIX_AI_CONFIG_DB_PATH:-$HOME/.local/share/agorix/ai-config.sqlite}"
if [ -f "$database" ]; then
  node --input-type=module -e 'import {DatabaseSync, backup} from "node:sqlite"; const db=new DatabaseSync(process.argv[1]); await backup(db, process.argv[2]); db.close()' "$database" "$backup_dir/ai-config.sqlite" 2>/dev/null
fi
corepack pnpm --filter @agorix/tutor-api build
mkdir -p -m 700 "$release"
install -m 0644 apps/tutor-api/dist/main.mjs "$release/main.mjs"
install -m 0755 scripts/start-tutor-host.sh "$release/start-tutor-host.sh"
cat > "$backup_dir/new-dropin" <<EOF
[Service]
WorkingDirectory=$repo
ExecStart=
ExecStart=$release/start-tutor-host.sh
Environment=AGORIX_TUTOR_BUNDLE=$release/main.mjs
EOF
rollback() {
  if [ "$?" -ne 0 ]; then
    if [ "$had_dropin" -eq 1 ]; then
      cp -p "$backup_dir/dropin" "$dropin"
    else
      rm -f "$dropin"
    fi
    if [ "$had_checkout_bundle" -eq 1 ]; then
      cp -p "$backup_dir/checkout-main.mjs" apps/tutor-api/dist/main.mjs
    fi
    systemctl --user daemon-reload
    systemctl --user restart agorix-tutor.service || true
    echo "Ori update failed; previous unit restored. SQLite backup: $backup_dir/ai-config.sqlite" >&2
  fi
}
trap rollback EXIT
install -m 0644 "$backup_dir/new-dropin" "$dropin"
systemctl --user daemon-reload
systemctl --user restart agorix-tutor.service
socket="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/agorix-tutor/tutor.sock"
ready=0
for _ in {1..20}; do
  if curl -fsS --max-time 1 --unix-socket "$socket" http://localhost/api/tutor/health \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const h=JSON.parse(s);process.exit(h.configured&&h.available?0:1)})' >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 0.5
done
[ "$ready" -eq 1 ] || { echo "Ori service did not become ready" >&2; exit 1; }
node scripts/check-ori-live.mjs
trap - EXIT
echo "Ori service updated to $short_sha; rollback snapshot: $backup_dir"
