# Issue 93 Measurement Criteria

## Required Verification

- Unit tests cover successful structured response through injected fetch.
- Unit tests cover unavailable daemon/provider failure.
- Unit tests cover unsupported capability negotiation.
- Unit tests cover malformed JSON or malformed Learning Companion response.
- Unit tests cover timeout or cancellation behavior.
- Typecheck, lint, test and build pass.

## Optional Local Evidence

- A gated integration test or documented command may be run when Ollama is installed locally.
- Absence of Ollama must skip or avoid the integration path cleanly.

## Acceptance Measurement

- The documented local capability subset is visible in configuration and tests.
- Setup documentation includes model/hardware caveats.
- No test or build path requires a network credential.
