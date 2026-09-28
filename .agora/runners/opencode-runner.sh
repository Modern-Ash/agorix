#!/usr/bin/env bash
set -euo pipefail

MODEL="${AGORA_OPENCODE_MODEL:-opencode/big-pickle}"

if [ -z "${AGORA_CONTEXT:-}" ] || [ ! -f "${AGORA_CONTEXT}" ]; then
  echo "AGORA_CONTEXT is not set or file does not exist" >&2
  exit 1
fi

PROMPT="Read the Agora session context from the path in AGORA_CONTEXT (${AGORA_CONTEXT}). Follow its operational Markdown, perform only the next action permitted for the assigned role, persist artifacts and evidence through Agora, and stop at human approval or unavailable authority. Prefer compact inspection and targeted file ranges; do not load full activity, event, prior-result, diff, or build-log histories. Keep tool and final output concise and refer to durable artifacts for detail."

if [ -n "${AGORA_EXTRA_INSTRUCTION:-}" ]; then
  PROMPT="${PROMPT}

Human note for this session: ${AGORA_EXTRA_INSTRUCTION}"
fi

exec opencode run --model "$MODEL" --auto "$PROMPT"
