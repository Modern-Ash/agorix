import test from "node:test";
import assert from "node:assert/strict";
import { createOriHarness, OriInputError, AGORIX_PROFILE } from "../src/harness.mjs";

test("default profile is Agorix and exposes no write tools", () => {
  const ori = createOriHarness();
  assert.equal(ori.profile.id, "agorix-kids-v1");
  assert.deepEqual(ori.profile.allowedTools, ["inspectProgram", "inspectTrace"]);
});
test("does not spoil empty mission or propose edits", async () => {
  const r = await createOriHarness().respond({ message: "como gano", context: { attempts: 0 } });
  assert.equal(r.kind, "hint");
  assert.equal(r.proposal, null);
  assert.equal(r.policy.fullSolutionAllowed, false);
  assert.match(r.message, /pasos|pensás/i);
});
test("understands common learner requests", async () => {
  const ori = createOriHarness();
  for (const [message, intent] of [["para que sirve repetir", "repeat"], ["quiero girar", "turn"], ["no entiendo", "help"], ["quiero llegar al planeta", "move"]]) {
    assert.equal((await ori.respond({ message })).intent, intent);
  }
});
test("only reads trace after attempt and grounds explanation", async () => {
  const calls = [];
  const ori = createOriHarness({
    inspectProgram: () => { calls.push("program"); return { allowedBlocks: [] }; },
    inspectTrace: () => { calls.push("trace"); return { steps: [{ index: 3, description: "Se detuvo" }] }; }
  });
  await ori.respond({ message: "error", context: { attempts: 0 } });
  assert.deepEqual(calls, ["program"]);
  const r = await ori.respond({ message: "error", context: { attempts: 1 } });
  assert.deepEqual(r.toolsUsed, ["inspectProgram", "inspectTrace"]);
  assert.equal(r.evidence.index, 3);
  assert.match(r.message, /paso 3/);
});
test("rejects unsafe/personal input without calling tools", async () => {
  let called = false;
  const ori = createOriHarness({ inspectProgram: () => { called = true; return { allowedBlocks: [] }; } });
  const r = await ori.respond({ message: "mi email es nina@example.com" });
  assert.equal(r.kind, "safety");
  assert.equal(called, false);
});
test("invalid input and unsupported profile fail closed", async () => {
  assert.throws(() => createOriHarness({}, { profile: { id: "unrestricted" } }), OriInputError);
  await assert.rejects(createOriHarness().respond({ message: "a".repeat(301) }), OriInputError);
  await assert.rejects(createOriHarness().respond({ message: "hola", context: { attempts: -1 } }), OriInputError);
});
test("never invokes unapproved tool", async () => {
  let writes = 0;
  const ori = createOriHarness({ applyDiff: () => { writes++; } });
  await ori.respond({ message: "quiero mover" });
  assert.equal(writes, 0);
});

test("returns an educational plan even without LLM", async () => {
  const r = await createOriHarness().respond({ message: "quiero llegar" });
  assert.equal(r.plan.kind, "learning-plan");
  assert.equal(r.plan.steps.length, 3);
});
test("only offers one reviewed Agorix block after attempts, hints and opt-in", async () => {
  const ori = createOriHarness({ inspectProgram: () => ({ allowedBlocks: ["move"] }) });
  const early = await ori.respond({ message: "llegar", allowProposal: true, context: { attempts: 0, hintsUsed: 2 } });
  assert.equal(early.proposal, null);
  const noConsent = await ori.respond({ message: "llegar", context: { attempts: 2, hintsUsed: 2 } });
  assert.equal(noConsent.proposal, null);
  const ready = await ori.respond({ message: "llegar", allowProposal: true, context: { attempts: 2, hintsUsed: 2 } });
  assert.equal(ready.proposal.blocks.length, 1);
  assert.equal(ready.proposal.requiresLearnerApproval, true);
  assert.equal(ready.policy.appliedChanges, false);
});
