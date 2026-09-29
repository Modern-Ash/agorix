# Rollback procedure - Issue #70

## Trigger

Rollback is appropriate if the progression rubric conflicts with the accepted product source of truth, blocks issue #71 or #72 planning, or introduces guidance that makes AI the author of learner work.

## Procedure

1. Revert the pull request commit that added `docs/product/LEARNING_PROGRESSION.md`.
2. Re-open issue #70 with the conflicting section cited.
3. Re-run Inception clarification for the disputed assumption.
4. Rebuild the document from the accepted #69 product language before resuming #71 or #72.

## Verification after rollback

- `docs/product/LEARNING_PROGRESSION.md` is absent or restored to the previously accepted version.
- Product docs from issue #69 remain unchanged.
- No runtime code or persisted data is affected.
