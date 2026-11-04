import test from "node:test";
import assert from "node:assert/strict";
import { createTutorClient, TutorClientError } from "../src/tutor-client.mjs";
import { createReferenceTutorServer } from "../examples/tutor-api/server.mjs";
const program = { schema: "agorix/program/v1", scripts: [{ id: "s1", trigger: { type: "onStart" }, statements: [] }] };
const runResult = { outcome: "completed", trace: [{ step: 1, statementType: "move" }] };
async function runWithServer(fn) {
  const server = createReferenceTutorServer({ program, runResult });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { return await fn(`http://127.0.0.1:${server.address().port}/api/example/ori`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test("client roundtrip gets review-only proposal", () => runWithServer(async endpoint => {
  const client = createTutorClient({ endpoint });
  const result = await client.ask({ message: "quiero llegar", attempts: 2, hintsUsed: 2, allowProposal: true });
  assert.equal(result.appliedChanges, false);
  assert.equal(result.requiresLearnerApproval, true);
  assert.equal(result.operationsPreview.operations[0].type, "appendStatement");
}));
test("client refuses non-local or credentialed endpoints", () => {
  for (const endpoint of ["https://example.org/api/example/ori", "http://10.0.0.3/api/example/ori", "http://user:pass@localhost/api/example/ori"]) {
    assert.throws(() => createTutorClient({ endpoint }), TutorClientError);
  }
});
test("client rejects forged auto-apply response", async () => {
  const client = createTutorClient({ endpoint: "http://127.0.0.1:1234/api/example/ori", fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ kind: "hint", message: "ok", appliedChanges: true, requiresLearnerApproval: false, operationsPreview: null }) }) });
  await assert.rejects(client.ask({ message: "hola" }), TutorClientError);
});
test("client rejects oversized response", async () => {
  const client = createTutorClient({ endpoint: "http://127.0.0.1:1234/api/example/ori", fetchImpl: async () => ({ ok: true, text: async () => "x".repeat(9000) }) });
  await assert.rejects(client.ask({ message: "hola" }), TutorClientError);
});
