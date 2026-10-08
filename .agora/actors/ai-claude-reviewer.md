---
schema: "agora/actor/v1"
id: "ai-claude-reviewer"
name: "Claude Code (independent reviewer session)"
kind: "ai-agent"
capabilities: ["implementation","review"]
scope: "project"
created-at: "2026-10-05T16:01:26.577847Z"
integration: "claude"
provider: "claude"
model: "configured-by-runtime"
authentication-required: false
---

# Claude Code (independent reviewer session)

Separate Claude Code subagent session that reviews exact artifact digests it did not produce. Same provider and model as ai-claude, so it satisfies distinct-actor but not distinct-provider.
