# Issue 94 Measurement Criteria

## Required Verification

- Unit tests cover custom base URL and configured model id.
- Unit tests cover optional auth absent and present.
- Unit tests cover capability negotiation and structured-output mismatch.
- Unit tests cover malformed response as `invalid-response`.
- Unit tests cover timeout/cancellation and provider unavailable.
- Typecheck, lint, test and build pass.

## Documentation Evidence

Docs describe at least two compatible deployment classes without coupling Agorix domain code to either.
