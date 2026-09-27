# Requirements - issue #75

## Functional requirements

- R1: Proposal construction validates schema/version and rejects malformed provider output.
- R2: Proposal records base program semantic hash/version and cannot apply against changed base state.
- R3: Proposal operations are structured and bounded; unsupported operations fail closed.
- R4: Candidate program is validated with `validateProgram` before acceptance can produce canonical mutation.
- R5: Reject preserves exact canonical program/hash.
- R6: Accept mutates only after explicit decision and only to the validated candidate program.
- R7: Modify path validates a learner-reviewed candidate before commit.
- R8: Diff/preview is derived from accepted/candidate structured state, not from provider prose.
- R9: Affected canonical node ids map to code/block regions where projection mapping exists.
- R10: Audit/event record is serializable and contains no child PII or provider SDK types.
- R11: Same proposal fixture can feed Web/Tablet proposal card view model and Studio diff/review view model.
- R12: Studio diff remains a projection/review surface, not an independent source of truth.

## Out of scope

- Full #87 protocol breadth for all future operations.
- Real provider adapter changes.
- Full production visual design of proposal cards beyond testable view-model/actions.
- Runtime Step/highlighting implementation owned by #76.
