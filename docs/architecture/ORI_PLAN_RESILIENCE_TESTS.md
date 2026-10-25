# Ori plan consumer resilience tests

This test increment is isolated to the Ori integration workstream. It adds failure-oriented coverage for the read-only `createOriPlanConsumer` without exposing any plan to Agorix Kids.

## Cases covered

- Valid and invalid timeout configuration.
- Missing response body, malformed UTF-8 and oversized payloads.
- Mission-stage and hint-level mismatches.
- Immutable, detached validated plan objects.
- Provider errors are converted to `null`, without returning raw messages or sensitive content.

The tests use synthetic plans and injected HTTP transports. They do not require external model calls or child data.

## Run

```bash
pnpm exec vitest run apps/tutor-api/src/oriPlanConsumer.test.ts apps/tutor-api/src/oriPlanConsumerResilience.test.ts
pnpm test
pnpm format:check
pnpm lint
pnpm exec tsc --noEmit
```

CI must remain green, including the real Ori process interoperability job, before merging into `integration/ori`. No promotion to stable Agorix branches is implied.
