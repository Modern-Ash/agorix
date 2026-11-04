import { ContractError, validateProposal, validateSnapshot } from "./contracts.mjs";

/**
 * Translate Ori v0 preview proposals to Agorix canonical statements.
 * This function NEVER mutates or applies a program. The host must independently
 * validate the full resulting program with @agorix/program-model and obtain
 * learner approval before applying the edit.
 */
export function oriProposalToAgorixStatements(proposal, { allowedBlocks = ["move", "turn"] } = {}) {
  const snapshot = validateSnapshot({ allowedBlocks });
  const valid = validateProposal(proposal, snapshot);
  const statements = valid.blocks.map(block => {
    if (block.kind === "move") return Object.freeze({ type: "move", steps: block.steps });
    if (block.kind === "turn") return Object.freeze({ type: "turn", degrees: block.direction === "right" ? 90 : -90 });
    throw new ContractError("Unsupported canonical statement");
  });
  return Object.freeze({
    schemaVersion: "ori/agorix-preview/v0",
    sourceProposalVersion: valid.schemaVersion,
    requiresLearnerApproval: true,
    statements: Object.freeze(statements)
  });
}
