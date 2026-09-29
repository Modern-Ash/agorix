<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Non-Functional Requirements — issue-96

- No compatible provider must yield a clear, non-fabricated unavailable state — never a fake claim that AI responded.
- Offline/degraded behavior must never call the network (selection is pure/synchronous over a precomputed health map).
- Selection must be capability-aware, not just by provider name.
- Child-facing unavailable-copy must avoid technical provider jargon by default.
- Developer diagnostics must expose the selected/attempted runtime and model without leaking credentials.
