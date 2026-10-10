# Multi-actor AI proposals, diffs and runtime evidence (design)

Issue #319, last AI-native item of epic #311. Date: 2026-10-10.

## Goal

A proposal can target one actor and provably cannot touch another. App and Studio show the same affected ids and the same suggested / accepted / proved evidence for a proposal. Accept, reject and modify stay explicit.

## Context

`packages/proposals` already carries `affected{Actor,Script,Asset,Variable,Node}Ids`, `expectedRuntimeEvidence`, `bindProposalRuntimeEvidence` and `createProposalComparisonView`. Script, asset, variable and node scope is enforced in `assertProposalScope`. Gaps:

1. `affectedActorIds` is declarative only. `ProjectProgram` does not know actors (they live in `ProjectCreativeState`, `actor.scripts` lists owned script ids), so a proposal can declare actor A and edit a script of actor B.
2. No UI consumes the comparison view or evidence binding.
3. Studio has no suggested / accepted / proved inspector.
4. No tests pin the canonical hash boundary when actors or assets change.

## Success criteria

- A proposal declaring actors is rejected when an operation touches a script not owned by a declared actor.
- Every actor owning a touched script must be declared, and every declared actor must be a known actor. A declared actor may go untouched, so a learner can accept a subset of operations.
- Proposals without actor context or without `affectedActorIds` behave as today (compatible with `agorix/program-proposal/v1`).
- App card and Studio panel render identical affected ids.
- Studio shows AI suggested / learner accepted / runtime proved per proposal.
- No program mutation without an explicit learner decision.

## Design

1. **Contract.** `createProposalReview(program, proposal, context?)` with `context: { actors?: readonly ProjectActor[] }`. New error code `ACTOR_SCOPE_VIOLATION`. When `context.actors` and `proposal.affectedActorIds` are both present: derive the actors owning every script touched by the operations (`scriptForOperation` + `actor.scripts`); reject if a touched script has no owner among the declared actors, if an owner of a touched script is undeclared, or if a declared actor is unknown. Operations and schema are unchanged. An actor with no script list owns every script (as in the runtime).
2. **Canonical hash.** The proposal base binding includes the actor→scripts map when actor context is supplied, so a proposal goes stale when script ownership changes. `programSemanticHash` is unchanged; a separate `creativeContextHash` is added and recorded in the audit event.
3. **App.** The proposal card (`WebProposalCardView`) keeps the affected ids and adds the comparison entries (accepted, proposed, learner-modified, runtime) from `createProposalComparisonView`. Review state only changes through accept / modify / reject.
4. **Studio.** `AgentPanel` keeps the same id rows and adds an evidence inspector with three rows: AI suggested (proposal + expected evidence), learner accepted (decision + result hash), runtime proved (`bindProposalRuntimeEvidence` over the multi-actor trace; matched vs missing ids). Text goes through the existing i18n copy and the plain-text provider policy (ADR 0008).
5. **Protocol.** `studio-protocol` proposal message gains the comparison and evidence views; ids stay the single source shared with the App.
6. **Errors.** Scope violations surface as a refusal notice; the proposal is never partially applied.

## Testing

- Actor A proposal editing a script of actor B is rejected; declared/derived mismatch is rejected; no-context proposal passes unchanged.
- Hash changes when script ownership, actors or assets change; unchanged otherwise.
- App card and Studio panel render identical ids for the same proposal.
- Evidence inspector reflects matched and missing ids from a multi-actor trace.
- Accept / reject / modify audit events record the context hash.

## Out of scope

Per-operation `actorId` (breaks `program-proposal/v1`), provider prompt changes, sound and rich media assets (#320).
