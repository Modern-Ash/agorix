# Ori MIG-03 — Educator review workflow

This is a server-only, in-memory integration seam. It is **not** a production approval service.

## Contract

- The host authenticates an educator and supplies `{ id, canReviewOri }` from trusted middleware. No request body may choose this identity or privilege.
- Every submission includes the current evidence SHA-256 digest and CAS revision. Stale submissions are rejected.
- Each mission can be reviewed once per evidence version. Decisions include a rationale; a rejection blocks signoff.
- Replacing the evidence invalidates previous decisions and starts a fresh review. The in-memory audit is reset with the review; **it is not a durable audit trail**.
- Technical completeness and educator signoff never authorize rollout: `rolloutAuthorized` remains `false`.

## Required before production use

1. Persist evidence snapshots, decisions and append-only audit events in a durable repository, atomically and with conflict detection.
2. Bind identity and `canReviewOri` to a real authenticated administrative authorization policy.
3. Add authenticated HTTP integration, role revocation tests, concurrency tests and immutable audit retention.
4. Record educator evaluation criteria, evidence provenance and explicit review of semantic gaps.
5. Keep MIG-04 rollout authorization as a separate, explicit governance gate.

This feature does not change Kids routes or enable Ori for learners.
