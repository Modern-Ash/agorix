# Fixed Ori agent, version 1

`@agorix/ori-agent` defines the versioned Kids 09 builder contract. `getOriAgentInstructions(locale)` supplies the fixed Spanish or English system instructions. `createOriAgentInput(context)` sends only authored mission facts, the grid, a numeric/type summary of the canonical program, deterministic last-run outcome, hint level and permitted block types. It sends no child free text.

The host supplies a text-only `OriTextModel` to `runOriAgent` in Kids 10. This package has no network or tool access. The model may return one JSON object: a `program-suggestion` with one to three allowed move, turn or repeat blocks and a fixed reason, or `refusal`. Unknown keys, invalid counts, unsupported block types and malformed JSON fail closed to the shared Kids 08 deterministic provider. An explicit refusal returns a fixed localized message without a proposal.

Every accepted model result becomes a `ProgramProposal`, passes `createProposalReview` and `validateLearningCompanionSafety`, and remains uncommitted until the child reviews it. The fake-model eval fixtures exercise valid, invalid, adversarial, off-topic and unsafe outputs in CI without credentials.
