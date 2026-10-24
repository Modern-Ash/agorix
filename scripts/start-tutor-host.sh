#!/usr/bin/env bash
# Host-only service launcher. Authentication stays in the host user's CLI profiles.
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.opencode/bin:/usr/local/bin:/usr/bin:$PATH"
export AGORIX_TUTOR_SOCKET="${AGORIX_TUTOR_SOCKET:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/agorix-tutor/tutor.sock}"
export AGORIX_ORI_PROVIDER="${AGORIX_ORI_PROVIDER:-auto}"
exec node "${AGORIX_TUTOR_BUNDLE:-apps/tutor-api/dist/main.mjs}"
