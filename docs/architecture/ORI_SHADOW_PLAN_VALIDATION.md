# Ori shadow plan validation

This is an experimental, non-authoritative boundary in the isolated `integration/ori` workstream.

## Contract

Agorix validates `ori/shadow-plan/v1` as a strictly bounded object with three pedagogical steps, one short hint, a stage and an explicit `appliedChanges: false`. Extra fields, proposals, unexpected child data and malformed structures are rejected.

The loopback `/v1/plan` response is read with a 4096-byte limit and the existing 750 ms timeout. Its content is **discarded regardless of validity**. No UI, project, runtime or tutor decision is affected.

## Why validate before using it?

The producer and consumer can evolve independently. Validating the contract now gives us tests for schema drift and a clear boundary before considering any child-facing feature.

## Next gates

1. Contract parity with Ori using shared synthetic fixtures.
2. Safety evaluation of generated hints beyond structural validation.
3. Full authorization and host-owned mission checks.
4. Explicit opt-in rollout within `integration/ori`, with rollback.
5. Educator review and child-safety assessment before any live use.

No merge to `main` or `development` is authorized by this document.
