# Issue 95 Inception Handoff

## Summary

Issue #95 should convert the legacy real-LLM tutor adapter work into optional commercial provider adapters for the current provider-neutral Learning Companion runtime. The implementation should preserve the security and reliability properties of #27 while aligning with the provider-runtime contract built in #85, #92, #93, and #94.

## #27 Mapping To Carry Into Construction

| Legacy #27 Capability | Disposition |
| --- | --- |
| Server-side only provider calls and secrets | Preserved |
| Environment-based secret/config injection | Preserved and generalized |
| Timeout/cancellation around remote calls | Preserved |
| Contract validation before use | Migrated to common provider-runtime validation |
| Sanitized/minimal context | Preserved |
| Safe fallback to unavailable/fake mode | Migrated to provider fallback behavior |
| Tutor-only request/response framing | Superseded by Learning Companion provider-runtime contract |
| Default vendor-specific endpoint assumptions | Superseded by configurable commercial adapter settings |

## Construction Guidance

- Prefer extending packages/provider-runtime because that is now the shared provider boundary.
- Treat apps/tutor-api as legacy evidence and migration input, not the primary new contract.
- Use mocked transports in tests; do not require real network calls or credentials.
- Keep config names neutral where possible and avoid provider brands in exported domain type names.
- Preserve default fake/local operation when commercial configuration is absent.

## Gate Expectations

The inception gate should remain blocked until Product Owner and developer approval are both recorded. Construction should not start until the user explicitly authorizes transition to construction.
