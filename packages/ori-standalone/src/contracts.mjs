/**
 * Ori v0 local contracts. Host-independent; no third-party dependencies.
 * This is an interim executable contract, not yet the finalized public API v1.
 */
export const SESSION_SCHEMA = "ori/session/v0";
export const PROPOSAL_SCHEMA = "ori/proposal/v0";
export const MAX_STEPS = 100;
export const MAX_BLOCKS = 100;
export class ContractError extends Error { constructor(message) { super(message); this.name = "ContractError"; } }
export function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ContractError(`${label}: expected object`);
}
export function validateSnapshot(snapshot) {
  assertObject(snapshot, "snapshot");
  if (!Array.isArray(snapshot.allowedBlocks) || snapshot.allowedBlocks.length > MAX_BLOCKS || !snapshot.allowedBlocks.every(x => typeof x === "string" && /^[a-z][A-Za-z0-9]{0,39}$/.test(x))) throw new ContractError("Invalid allowedBlocks");
  if (snapshot.blocks !== undefined && (!Array.isArray(snapshot.blocks) || snapshot.blocks.length > MAX_BLOCKS)) throw new ContractError("Invalid blocks");
  return Object.freeze({ allowedBlocks: Object.freeze([...snapshot.allowedBlocks]) });
}
export function validateTrace(trace) {
  assertObject(trace, "trace");
  if (!Array.isArray(trace.steps) || trace.steps.length > MAX_STEPS) throw new ContractError("Invalid trace steps");
  return Object.freeze({ steps: Object.freeze(trace.steps.map(s => {
    assertObject(s, "step");
    if (!Number.isSafeInteger(s.index) || s.index < 0 || typeof s.description !== "string" || s.description.length > 200) throw new ContractError("Invalid trace step");
    return Object.freeze({ index: s.index, description: s.description });
  })) });
}
export function validateProposal(proposal, snapshot) {
  assertObject(proposal, "proposal");
  if (proposal.schemaVersion !== PROPOSAL_SCHEMA || proposal.operation !== "append" || proposal.requiresLearnerApproval !== true) throw new ContractError("Invalid proposal envelope");
  if (!Array.isArray(proposal.blocks) || proposal.blocks.length !== 1) throw new ContractError("Only one-block proposals are supported");
  const b = proposal.blocks[0]; assertObject(b, "block");
  if (!snapshot.allowedBlocks.includes(b.kind)) throw new ContractError("Block not authorized");
  if (b.kind === "move" && (!Number.isSafeInteger(b.steps) || b.steps < 1 || b.steps > 5)) throw new ContractError("Invalid move");
  if (b.kind === "turn" && !["left","right"].includes(b.direction)) throw new ContractError("Invalid turn");
  if (!["move","turn"].includes(b.kind)) throw new ContractError("Block has no implemented semantics");
  return Object.freeze({ ...proposal, blocks: Object.freeze([Object.freeze({ ...b })]) });
}
