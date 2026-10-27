# MIG-03 — Technical construction closure and handoff

**Status: technical construction complete for the experimental `integration/ori` path; production readiness NOT established.**

Date: 2026-10-27. Scope: Agorix integration of the independent Ori process in shadow/review mode. This document is an evidence-based technical handoff, **not** educator approval, cutover authorization, or an efficacy claim.

## Verified technical baseline

- [x] Canonical Agorix project/runtime remains the source of truth. Ori runs independently; review proposals are non-applying and require learner approval.
- [x] Cross-repository real Ori interoperability runs in CI; the process-to-authenticated-HTTP-to-SQLite E2E is **required** (not silently skipped) by the Ori interoperability job.
- [x] Synthetic parity/evidence matrix is produced as a CI artifact.
- [x] Ticket identity, project ownership, immutable review lineage, digest/revision, proposal artifact hashes and presentation acknowledgement have fail-closed checks.
- [x] File-backed SQLite reopen and stale-review rejection have regression coverage.
- [x] Deterministic audit export, human-review checklist and independently verifiable delivery manifest exist.
- [x] Formatting, Lint, TypeScript, Build, unit/regression tests, Playwright and real Ori interoperability were all green on PR #973 head workflow run [40596253332](https://github.com/Modern-Ash/agorix/actions/runs/40596253332).

**Source evidence**

- [PR #971](https://github.com/Modern-Ash/agorix/pull/971) — real Ori process → authenticated HTTP → SQLite E2E (synthetic session/project).
- [PR #972](https://github.com/Modern-Ash/agorix/pull/972) — mandatory real-process E2E CI gate.
- [PR #973](https://github.com/Modern-Ash/agorix/pull/973) — formatting normalization; seven checks green.
- [Parity artifact from run 40596253332](https://github.com/Modern-Ash/agorix/actions/runs/40596253332/artifacts/12777405360) — synthetic mission evidence; artifact subject to GitHub retention.
- [Ori MIG-03 acceptance issue](https://github.com/Modern-Ash/ori/issues/29).

## Explicit limits of the evidence

1. The CI E2E uses the real independent Ori process but **synthetic** project/session inputs; it does not establish deployed authentication, production learner state, or actual learner attention.
2. Shadow comparisons use non-equivalent inputs to Ori and Kids. Preserve `equalInputContextProven: false` and `eligibleForEfficacyClaim: false`. Golden parity does not imply pedagogical equivalence.
3. SQLite restart tests establish single-host file-backed persistence in tests, **not** multi-instance or deployed storage guarantees.
4. Hashes establish content integrity, not signature/authenticity or human approval.
5. The technical exit report must remain blocked until trusted host probes supply real deployment evidence and the educator assessment is completed.

## Handoff / outstanding gates (not part of technical construction signoff)

- [ ] Deployment-specific verification of real session, active project, independent Ori process, and durable storage; retain run IDs, environment, timestamp and evidence.
- [ ] Produce an authentic review delivery package tied to the exact mission/ticket/revision and obtain explicit educator decisions against autonomy, conceptual clarity, age appropriateness, runtime grounding and safety.
- [ ] Decide MIG-04 separately: rollout flag, monitoring, kill switch, rollback and human authorization. Keep Ori disabled for learners until that decision.
- [ ] Do not close the upstream MIG-03 acceptance issue or claim efficacy until the required human and deployment gates have evidence.

## Decision

**Technical implementation and CI validation: complete within the experimental branch.**

**Operational/pedagogical acceptance: pending.** No automatic learner rollout, no legacy removal and no efficacy claim.
