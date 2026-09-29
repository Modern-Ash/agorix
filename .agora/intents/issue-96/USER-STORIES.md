<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# User Stories — issue-96

- US-001: As a product owner, capability-aware provider selection is tested table-by-table (each ordered-fallback/health/capability combination).
- US-002: As a learner, if the preferred provider is unavailable, a documented fallback is used automatically.
- US-003: As a learner, if no configured provider is compatible with the requested capability, the app clearly says AI help isn't available rather than guessing.
- US-004: As a learner/parent, offline mode never calls the network.
- US-005: As a learner, the deterministic canonical program/runtime behavior is unaffected by provider selection or its absence.
- US-006: As a child, unavailable-AI copy has no provider/runtime/model jargon.
- US-007: As a developer, diagnostics expose which runtime/model was selected (or considered) without leaking secrets.
