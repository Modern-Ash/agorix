import test from "node:test";
import assert from "node:assert/strict";
import { createCanonicalAgorixHost, programToOriSnapshot, runResultToOriTrace } from "../src/agorix-runtime-bridge.mjs";
import { createAgorixAdapter } from "../src/agorix-adapter.mjs";

const program = { schema: "agorix/program/v1", scripts: [{ id: "s1", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] }] };
const run = { outcome: "completed", trace: [{ step: 1, statementType: "move", path: "private/path", nodeId: "x", worldAfter: { secret: "never send" } }] };

test("real Agorix schema is recognized and proposals restricted to move", () => {
  assert.deepEqual(programToOriSnapshot(program).allowedBlocks, ["move"]);
  assert.throws(() => programToOriSnapshot({ schema: "unknown", scripts: [] }));
});
test("Agorix runtime trace is minimized before Ori receives it", () => {
  const trace = runResultToOriTrace(run);
  assert.deepEqual(trace.steps, [{ index: 1, description: "Bloque move" }]);
  assert.equal(JSON.stringify(trace).includes("secret"), false);
  assert.equal(JSON.stringify(trace).includes("private/path"), false);
});
test("canonical host integrates with Ori without edits", async () => {
  const host = createCanonicalAgorixHost({ readCanonicalProgram: () => program, readRunResult: () => run });
  const ori = createAgorixAdapter(host);
  const r = await ori.ask("no funciona", { attempts: 1 });
  assert.equal(r.evidence.index, 1);
  assert.equal(r.policy.appliedChanges, false);
});
test("canonical turn semantics are not falsely advertised", () => {
  const p = { ...program, scripts: [{ ...program.scripts[0], statements: [{ type: "turn", degrees: 90 }] }] };
  assert.deepEqual(programToOriSnapshot(p).allowedBlocks, ["move"]);
});
