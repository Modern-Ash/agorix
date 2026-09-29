# Measurement Criteria - issue #75

- MC1: Unit tests prove proposal creation does not mutate accepted program.
- MC2: Unit tests prove reject preserves exact canonical state/hash.
- MC3: Unit tests prove accepted proposal output passes canonical validator.
- MC4: Tests prove preview/diff derives from structured accepted/candidate programs.
- MC5: Tests prove affected code ranges can be produced for mapped affected nodes.
- MC6: Tests prove malformed provider response, unknown operation and invalid candidate fail closed.
- MC7: Tests cover accept, reject, modify, invalid and stale proposal paths.
- MC8: Tests prove stale proposal against changed base state cannot apply silently.
- MC9: Same fixture is consumed by Web/Tablet and Studio view helpers.
- MC10: Tests prove accept/reject results produce identical canonical semantics across surfaces.
- MC11: Proposal card actions expose touch-sized/action labels in the Web/Tablet view model.
- MC12: Studio view model/diff uses shared proposal semantics and does not own independent mutation logic.
