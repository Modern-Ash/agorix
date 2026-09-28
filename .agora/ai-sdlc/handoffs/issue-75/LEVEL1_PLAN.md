# Level 1 Plan - issue #75

1. Define a shared `ProgramProposal` protocol v1 with proposal id/version, base semantic hash, source metadata, rationale, affected node ids and bounded operations.
2. Implement deterministic validation for malformed provider responses, unknown operations, stale base hash, unsupported paths and invalid resulting programs.
3. Implement candidate program computation from structured operations; no provider prose or generated JS can mutate state.
4. Implement deterministic preview/diff data from accepted and candidate canonical programs, including affected node ranges where projection mapping exists.
5. Implement explicit decision helpers: reject returns exact accepted program, accept applies only validated proposal, modify accepts a learner-reviewed candidate through the same validator.
6. Add shared fixture usable by Web/Tablet and Studio.
7. Adapt Studio core to consume the shared proposal review boundary instead of owning independent semantics.
8. Add Web-facing/touch-facing view model helpers for proposal card labels/actions, without requiring a full UI redesign.
9. Add tests covering accept/reject/modify/invalid/stale, same fixture across Web/Studio, malformed response failure, and no silent mutation.
10. Run full repository verification and record Agora evidence.
