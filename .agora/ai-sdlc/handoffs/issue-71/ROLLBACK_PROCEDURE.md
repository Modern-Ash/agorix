# Rollback Procedure - Issue #71

## Trigger

Rollback is appropriate if the revised order contradicts accepted #69/#70 source of truth, blocks #72 alignment, or accidentally prioritizes platform proofs over the AI-native learner loop.

## Procedure

1. Revert the PR commit for #71.
2. Re-open #71 with the conflicting section cited.
3. Restore #106 as the temporary operational map until a corrected durable order is merged.
4. Re-run Inception clarification for any disputed product/order decision.

## Verification after rollback

- `docs/product/MVP.md`, `docs/product/COMPETITIVE_PRINCIPLES.md`, `docs/delivery/IMPLEMENTATION_ORDER.md` and `docs/delivery/POC_PLAN.md` return to the prior accepted state.
- No runtime code or persisted data is affected.
