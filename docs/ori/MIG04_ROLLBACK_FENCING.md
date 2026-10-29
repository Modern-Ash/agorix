# MIG-04 — Rollback and commit fencing

The host-owned rollout policy defaults to disabled. No browser request may update
policy or authorize a learner pilot. Human approval and an explicit allowlist
remain mandatory.

## Single-host fenced commit integration

1. Construct one `createOriMig04CommitFence()` for the process.
2. The trusted host installs an approved policy using `replaceFromHost`.
3. Capture `generation = fence.snapshot(projectId).generation` at the
   beginning of an authorized operation.
4. Supply `oriMig04RolloutDecide: fence.decide` and
   `oriMig04CommitFence: async (projectId, write) =>
(await fence.commit(projectId, generation, write)).applied`
   to `createOriAuthorizedReviewOptions`.
5. For rollback, await `fence.emergencyDisable()` and verify that all
   subsequent requests and commits are rejected.

**Semantics:** The disable promise resolves only after already-started
fenced writes complete. It cannot undo a completed write. Do not claim
instantaneous cancellation of in-flight database operations.

**Multi-instance deployments:** This in-memory fence is not a distributed
transaction or shared lease. Production with multiple instances requires
a shared database transaction/fencing token checked atomically with the
project CAS update. Keep rollout disabled until that mechanism is deployed
and tested. Never infer distributed safety from these single-process tests.

## Required operational evidence before pilot

- Authenticated project allowlist and explicit educator authorization.
- Real-process parity, privacy checks, and baseline Kids latency.
- Real traffic instrumentation and calibrated error/latency thresholds.
- Rollback drill with proof that Kids remains usable without Ori.
- No unilateral code modification and no efficacy claim.
