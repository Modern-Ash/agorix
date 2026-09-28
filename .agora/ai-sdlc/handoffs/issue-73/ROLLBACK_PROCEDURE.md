# Rollback Procedure - Issue #73

## Rollback trigger

Rollback if the repository owner or Product Owner rejects the Apache-2.0 license/governance decision or its README wording after merge.

## Procedure

1. Revert the PR that closes #73.
2. Re-run repository verification.
3. Re-open #73 or create a follow-up governance issue with the rejected decision recorded.

## Stateful rollback

No database, runtime service, provider credential or user-data rollback is required.
