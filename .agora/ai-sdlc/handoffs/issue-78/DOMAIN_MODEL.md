# Domain Model - issue #78

The transparency journey uses the existing canonical `ProjectProgram` as the only mutable source of truth. A deterministic `ProgramProposal` captures a base semantic hash, affected canonical node ids, and a replace-statement operation. `ProposalReview` holds the accepted projection, candidate projection, affected ranges, and learner-visible diff without mutating the accepted program.

The web shell exposes the current canonical hash as test-only metadata, renders code from the canonical projection, and updates blocks/code only after `acceptProposal` validates the proposal base hash. Reject discards the review and returns the same accepted program.
