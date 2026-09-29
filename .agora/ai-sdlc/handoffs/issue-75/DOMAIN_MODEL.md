# Domain model - issue #75

## Entities

- ProgramProposal: provisional structured proposed program change. It is never canonical state.
- ProposalOperation: bounded operation that can produce a candidate `ProjectProgram`.
- ProposalReview: deterministic preview/diff between accepted program and candidate program.
- ProposalDecision: explicit learner decision: accept, reject or modify.
- ProposalAuditEvent: serializable, provider-neutral event with no child PII.
- Surface view model: Web/Tablet card or Studio diff projection of the same review.

## Invariants

- Proposal parsing/validation does not mutate accepted program.
- Accept applies only against matching base semantic hash.
- Reject returns exact accepted program.
- Modify validates the learner-reviewed candidate before commit.
- Diff/preview derives from canonical accepted/candidate programs, not model prose.
