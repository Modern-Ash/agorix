# Logical Design - issue #78

- Add a deterministic proposal action to the companion panel so the browser journey has no LLM or network dependency.
- Show proposal purpose, rationale, base hash, and before/after code diff while leaving the code panel on the accepted canonical program.
- Wire reject to clear proposal state and preserve the canonical hash.
- Wire accept through `acceptProposal`, rebuild the editor model from the accepted candidate program, and keep blocks/code synchronized.
- Reuse canonical node ids for proposal affected ranges and Step highlighting so block and code highlights stay correlated.
