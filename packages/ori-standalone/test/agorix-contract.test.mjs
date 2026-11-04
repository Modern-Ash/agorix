import test from "node:test";
import assert from "node:assert/strict";
import { createAgorixFixture } from "../src/agorix-fixture.mjs";
import { createAgorixAdapter } from "../src/agorix-adapter.mjs";
import { ToolAccessError } from "../src/tools.mjs";

test("reference host supplies a trace-grounded debugging hint", async () => {
  const host = createAgorixFixture({ traceSteps: [{ index: 2, description: "Se detuvo" }] });
  const adapter = createAgorixAdapter(host);
  const result = await adapter.ask("no funciona", { attempts: 1 });
  assert.equal(result.intent, "debug");
  assert.equal(result.evidence.index, 2);
  assert.equal(result.policy.appliedChanges, false);
});
test("host can deny trace access", async () => {
  const host = createAgorixFixture({ traceSteps: [{ index: 2, description: "Se detuvo" }] });
  const adapter = createAgorixAdapter(host, { grants: ["inspectProgram"] });
  await assert.rejects(adapter.ask("no funciona", { attempts: 1 }), ToolAccessError);
});
test("no auto-apply even when a proposal is authorized", async () => {
  let writes = 0;
  const fixture = createAgorixFixture();
  const host = { readProgram: fixture.readProgram, readTrace: fixture.readTrace, writeProgram: () => { writes++; } };
  const adapter = createAgorixAdapter(host);
  const result = await adapter.ask("quiero llegar", { attempts: 2, hintsUsed: 2, allowProposal: true });
  assert.equal(result.proposal?.requiresLearnerApproval, true);
  assert.equal(writes, 0);
});
test("host rejects malformed trace before Ori uses it", async () => {
  const host = { readProgram: () => ({ allowedBlocks: ["move"] }), readTrace: () => ({ steps: [{ index: "wrong", description: "x" }] }) };
  const adapter = createAgorixAdapter(host);
  await assert.rejects(adapter.ask("error", { attempts: 1 }));
});
