# Rollback Procedure - Issue #72

## Rollback trigger

Rollback if Product Owner or architecture review rejects the #72 terminology, invariants, proposal path, runtime evidence boundaries or provider-boundary framing after merge.

## Procedure

1. Revert the GitHub PR that closes #72.
2. Re-run repository verification.
3. Re-open #72 or create a follow-up architecture issue with the rejected decision recorded.

## Stateful rollback

No database, migration, runtime service, provider credential or user-data rollback is required.
