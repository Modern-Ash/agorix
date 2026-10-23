#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/web-deploy-lib.sh

# The accounts profile is explicit; this one-shot container shares the live data
# volume and writes a verified SQLite snapshot to the separate backup volume.
compose --profile accounts run --rm --no-deps projects node dist/backup.mjs
