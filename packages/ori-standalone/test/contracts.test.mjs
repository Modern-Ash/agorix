import test from "node:test";
import assert from "node:assert/strict";
import { validateSnapshot, validateTrace, validateProposal, ContractError } from "../src/contracts.mjs";
import { createToolRegistry, ToolAccessError } from "../src/tools.mjs";
test("snapshot validates block allowlist", () => {
  assert.deepEqual(validateSnapshot({ allowedBlocks: ["move"] }).allowedBlocks, ["move"]);
  assert.throws(() => validateSnapshot({ allowedBlocks: ["move", 123] }), ContractError);
});
test("trace rejects malformed and oversized input", () => {
  assert.equal(validateTrace({ steps: [{ index: 2, description: "Stopped" }] }).steps[0].index, 2);
  assert.throws(() => validateTrace({ steps: [{ index: -1, description: "x" }] }), ContractError);
  assert.throws(() => validateTrace({ steps: Array(101).fill({ index: 0, description: "x" }) }), ContractError);
});
test("proposal must be allowed, bounded and reviewed", () => {
  const snapshot = validateSnapshot({ allowedBlocks: ["move"] });
  const p = { schemaVersion: "ori/proposal/v0", operation: "append", blocks: [{ kind: "move", steps: 1 }], requiresLearnerApproval: true };
  assert.equal(validateProposal(p, snapshot).blocks.length, 1);
  assert.throws(() => validateProposal({ ...p, requiresLearnerApproval: false }, snapshot), ContractError);
  assert.throws(() => validateProposal({ ...p, blocks: [{ kind: "turn", direction: "right" }] }, snapshot), ContractError);
  assert.throws(() => validateProposal({ ...p, blocks: [{ kind: "move", steps: 100 }] }, snapshot), ContractError);
});
test("tool registry enforces host grants and call budget", async () => {
  const tools = createToolRegistry({ inspectProgram: () => ({ ok: true }) }, ["inspectProgram"], 1);
  assert.deepEqual(await tools.call("inspectProgram"), { ok: true });
  await assert.rejects(tools.call("inspectProgram"), ToolAccessError);
  await assert.rejects(tools.call("inspectTrace"), ToolAccessError);
  await assert.rejects(tools.call("applyDiff"), ToolAccessError);
  assert.throws(() => createToolRegistry({}, ["shell"]), ToolAccessError);
});
