import test from "node:test";
import assert from "node:assert/strict";
import { oriProposalToAgorixStatements } from "../src/agorix-proposals.mjs";
import { ContractError } from "../src/contracts.mjs";

function proposal(block) {
  return { schemaVersion: "ori/proposal/v0", operation: "append", blocks: [block], requiresLearnerApproval: true };
}
test("canonical move statement has Agorix type and steps", () => {
  const preview = oriProposalToAgorixStatements(proposal({ kind: "move", steps: 1 }));
  assert.deepEqual(preview.statements, [{ type: "move", steps: 1 }]);
  assert.equal(preview.requiresLearnerApproval, true);
});
test("right and left turns use canonical signed degrees", () => {
  assert.deepEqual(oriProposalToAgorixStatements(proposal({ kind: "turn", direction: "right" })).statements, [{ type: "turn", degrees: 90 }]);
  assert.deepEqual(oriProposalToAgorixStatements(proposal({ kind: "turn", direction: "left" })).statements, [{ type: "turn", degrees: -90 }]);
});
test("fail closed for unapproved, invalid and unsupported proposals", () => {
  assert.throws(() => oriProposalToAgorixStatements({ ...proposal({ kind: "move", steps: 1 }), requiresLearnerApproval: false }), ContractError);
  assert.throws(() => oriProposalToAgorixStatements(proposal({ kind: "move", steps: 99 })), ContractError);
  assert.throws(() => oriProposalToAgorixStatements(proposal({ kind: "turn", direction: "right" }), { allowedBlocks: ["move"] }), ContractError);
  assert.throws(() => oriProposalToAgorixStatements(proposal({ kind: "say", text: "hi" })), ContractError);
});
test("does not mutate proposal or program", () => {
  const input = proposal({ kind: "turn", direction: "right" });
  const before = JSON.stringify(input);
  const preview = oriProposalToAgorixStatements(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(preview.statements[0]), true);
});
