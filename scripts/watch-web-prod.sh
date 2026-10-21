#!/usr/bin/env bash
# Scheduled check of the live site (issue #345). Runs the read-only production smoke and, on
# failure, sends an alert through AGORIX_NOTIFY_CMD (a command that takes the message).
# Example crontab entry (not installed automatically):
#   */15 * * * * AGORIX_NOTIFY_CMD="/path/to/notify.sh" /path/to/agorix/scripts/watch-web-prod.sh
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/web-deploy-lib.sh"

if run_smoke "" >"${TMPDIR:-/tmp}/agorix-web-watch.log" 2>&1; then
  log "production smoke ok"
else
  log "production smoke FAILED (see ${TMPDIR:-/tmp}/agorix-web-watch.log)"
  notify "Agorix production smoke failed at $AGORIX_SMOKE_URL"
  exit 1
fi
