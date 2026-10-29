# MIG-04 — Distributed transactional fencing (implementation contract)

Status (2026-10-29): **implemented and exercised for a one-account, one-project PostgreSQL pilot**. Broader rollout remains disabled. The in-memory `createOriMig04CommitFence` is only a single-process safeguard; the active pilot uses the database-backed policy lock, project CAS and audit transaction described below. Two-connection PostgreSQL tests cover races and revocation, and the public Kids flow completed one accepted commit plus a kill-switch drill.

## Atomic invariant

A learner proposal may mutate a canonical project only when, **in the same durable database transaction**, the project revision matches the reviewed revision **and** the rollout-policy epoch is current, the kill switch is off, human authorization is recorded, mode is pilot, and the project is allowlisted. An HTTP check, synchronous callback, process mutex, or read-then-write sequence is insufficient.

The transaction must lock or conditionally compare the policy row and project revision so a concurrent revocation and commit have a database-defined serial order. The update must return whether it committed. A failed authorization or stale epoch must perform **zero** project writes. Do not allow fallback to the unfenced `repository.update` path when distributed rollout is configured.

## Required durable records

- One policy row scoped to the rollout deployment, with monotonically increasing epoch, mode, kill switch, human approval, and allowlist or normalized membership table.
- A project revision used for compare-and-swap; project ownership must be verified in the same transaction.
- Optional aggregate telemetry only. Never persist prompts, child identifiers in metrics, or raw programs as rollout telemetry.

## Revocation semantics

Emergency disable must commit a policy epoch increment and set disabled/kill-switch before reporting success. A transaction serialized before revocation may complete; one serialized after it must reject. Never claim cancellation of already-committed writes. Across processes, stale snapshots and cached allowlists cannot authorize a commit.

## Acceptance tests (two independent database connections)

1. Valid approved project and expected revision commits exactly once.
2. Stale project revision rejects with no mutation.
3. Stale policy epoch rejects with no mutation even if project revision matches.
4. Revocation commits first: later proposal commit is denied.
5. Proposal commit serializes first: revocation waits; no later commit succeeds.
6. Unapproved project, disabled mode, kill switch, or absent human approval all reject.
7. Database errors roll back policy/project changes; fail closed.
8. Multiple hosts share the same policy epoch; restarting a host cannot re-enable rollout.
9. Duplicate ticket or retry cannot append twice; CAS conflict is preserved.
10. Existing Kids flows and legacy opt-in behavior remain unchanged when rollout is disabled.

## Delivery gate

Implementation must include the actual production repository adapter and schema migration, host wiring, cross-connection integration tests, operational rollback drill, formatting/lint/typecheck/test/build and green CI. Do **not** mark this contract implemented or enable pilot merely because unit tests for the in-memory fence pass.
