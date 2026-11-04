import test from "node:test";
import assert from "node:assert/strict";
import { oriProposalToAgorixOperations } from "../src/agorix-operations.mjs";
function proposal(block) {
  return { schemaVersion: "ori/proposal/v0", operation: "append", blocks: [block], requiresLearnerApproval: true };
}
test("maps move into Agorix appendStatement without applying", () => {
  const r = oriProposalToAgorixOperations(proposal({ kind: "move", steps: 1 }));
  assert.deepEqual(r.operations, [{ type: "appendStatement", scriptIndex: 0, statement: { type: "move", steps: 1 } }]);
  assert.equal(r.requiresLearnerApproval, true);
});
test("maps turn to degrees only when explicitly allowed", () => {
  const r = oriProposalToAgorixOperations(proposal({ kind: "turn", direction: "left" }), { scriptIndex: 1, allowedBlocks: ["turn"] });
  assert.deepEqual(r.operations[0], { type: "appendStatement", scriptIndex: 1, statement: { type: "turn", degrees: -90 } });
  assert.throws(() => oriProposalToAgorixOperations(proposal({ kind: "turn", direction: "left" })));
});
test("rejects invalid script index and approval bypass", () => {
  assert.throws(() => oriProposalToAgorixOperations(proposal({ kind: "move", steps: 1 }), { scriptIndex: -1 }));
  assert.throws(() => oriProposalToAgorixOperations({ ...proposal({ kind: "move", steps: 1 }), requiresLearnerApproval: false }));
});
