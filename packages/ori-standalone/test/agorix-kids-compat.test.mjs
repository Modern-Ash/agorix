import test from "node:test";
import assert from "node:assert/strict";
import { createAgorixKidsCompatibility } from "../src/agorix-kids-compat.mjs";
const program = { schema: "agorix/program/v1", scripts: [{ id: "s1", trigger: { type: "onStart" }, statements: [] }] };
const run = { outcome: "completed", trace: [{ step: 1, statementType: "move" }] };
function create(gridCellSize = 32, missionIndex = 1) {
  return createAgorixKidsCompatibility({ readCanonicalProgram: () => program, readRunResult: () => run, gridCellSize, missionIndex });
}
test("converts one Ori cell to canonical Kids pixel movement", async () => {
  const r = await create().propose({ message: "quiero llegar", attempts: 2, hintsUsed: 2, allowProposal: true });
  assert.equal(r.operationsPreview.operations[0].statement.steps, 32);
  assert.equal(r.needsHostValidation, true);
  assert.equal(r.appliedChanges, false);
});
test("no proposal before learner attempt or without consent", async () => {
  assert.equal((await create().propose({ message: "quiero llegar", attempts: 0, hintsUsed: 2, allowProposal: true })).operationsPreview, null);
  assert.equal((await create().propose({ message: "quiero llegar", attempts: 2, hintsUsed: 2 })).operationsPreview, null);
});
test("rejects unsafe grid parameters", () => {
  assert.throws(() => create(0));
  assert.throws(() => create(32, -1));
});
test("does not claim full Agorix proposal compatibility", async () => {
  const r = await create().propose({ message: "no entiendo" });
  assert.equal(r.operationsPreview, null);
  assert.equal(r.appliedChanges, false);
  assert.equal("proposal" in r, false);
});
