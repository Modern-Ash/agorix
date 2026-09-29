# Issue 100 Requirements

## Functional Requirements

- Add an enforceable validation boundary for Learning Companion and provider-runtime outputs before learner UI or proposal workflows consume them.
- Validate at least these layers: transport/parsing, schema/version, requested capability, scaffolding/assistance policy, ProgramProposal safety, content/safety policy, and context/provenance integrity.
- Reject malformed JSON or malformed structured outputs.
- Prevent AI output from bypassing ProgramProposal protocol.
- Prevent AI output from self-escalating assistance beyond the scaffolding policy.
- Reject or filter responses that ask for a child name, address, school, contact details, location, or other PII.
- Reject unsafe or disallowed program operations.
- Keep raw hidden provider tool actions out of accepted program state.
- Log only non-PII diagnostic metadata by default.
- Return safe/plain child-facing failure messages while preserving actionable developer diagnostics.
- Keep behavior consistent across fake/local/open/remote/commercial adapters.
- Ensure editor/runtime continue safely after rejection.

## Acceptance Criteria

- Malformed JSON/schema output is rejected.
- Disallowed full-solution response is handled according to policy.
- Unsafe/disallowed program operation is rejected.
- PII-seeking response is not shown unfiltered.
- Validation behavior is consistent across local and remote adapters.
- Tests include adversarial provider fixtures.
- Editor/runtime continue safely after rejection.

## AI-SDLC Economics Requirements

- Use deterministic unit tests, schema checks, and mocked provider fixtures before any paid or model-backed review.
- Follow `routing.profile: cheap-first` from `ai-sdlc/project.yaml`.
- Do not use frontier calls automatically because the configured frontier budget is `0`.
- Treat `paid-efficient: 4` and `paid-standard: 2` as budget ceilings for planned model-assisted review, not implementation defaults.
- Record real usage with `agora usage add` only when authoritative telemetry exists; do not infer token/cost numbers.
