import { oriProposalToAgorixStatements } from "./agorix-proposals.mjs";

/**
 * Preview-only operation adapter for Agorix @agorix/proposals.
 * It intentionally does NOT construct a ProgramProposal envelope:
 * Agorix must supply current program hash, stable IDs, source metadata,
 * affected node IDs and run createProposalReview on its own side.
 */
export function oriProposalToAgorixOperations(proposal, { scriptIndex = 0, allowedBlocks = ["move"] } = {}) {
  if (!Number.isSafeInteger(scriptIndex) || scriptIndex < 0 || scriptIndex > 100) {
    throw new RangeError("Invalid target script index");
  }
  const preview = oriProposalToAgorixStatements(proposal, { allowedBlocks });
  return Object.freeze({
    kind: "agorix-operations-preview/v0",
    requiresLearnerApproval: true,
    operations: Object.freeze(preview.statements.map(statement =>
      Object.freeze({ type: "appendStatement", scriptIndex, statement })
    ))
  });
}
