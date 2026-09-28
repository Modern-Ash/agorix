# Issue 100 Non-Functional Requirements

- Safety: fail closed for malformed, unsafe, over-assisting, PII-seeking, or provenance-invalid output.
- Privacy: default diagnostics must exclude raw child free text, PII, secrets, and raw provider transcripts.
- Consistency: local and remote providers must share validation semantics.
- Resilience: rejection must not crash editor/runtime or corrupt canonical program state.
- Observability: developer diagnostics must be actionable without exposing child-sensitive material.
- Economy: construction should maximize deterministic verification and mocked fixtures before spending model/reviewer budget.
