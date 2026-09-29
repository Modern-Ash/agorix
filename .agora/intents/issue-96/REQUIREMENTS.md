<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Select providers by required pedagogical capability while keeping Agorix usable when no LLM is available.

## Requirements

- Configuration may define:
- preferred provider/runtime
- model
- ordered fallbacks
- allowed remote/local providers
- offline mode.
- Selection must consider required capability, not just provider name.

## Acceptance criteria

- capability-aware selection tested
- preferred provider unavailable -> documented fallback
- no compatible provider -> clear unavailable state
- offline mode does not call network
- canonical/runtime behavior unchanged
- child-facing copy avoids technical provider jargon by default
- developer diagnostics expose selected runtime/model safely.

## Constraints

- no compatible provider -> clear unavailable state

## Dependencies

- No explicit dependencies.
