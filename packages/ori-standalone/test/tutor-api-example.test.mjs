import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceTutorServer } from "../examples/tutor-api/server.mjs";

const program = { schema: "agorix/program/v1", scripts: [{ id: "s1", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] }] };
const runResult = { outcome: "completed", trace: [{ step: 1, statementType: "move" }] };
async function withServer(run) {
  const server = createReferenceTutorServer({ program, runResult });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/example/ori`;
    return await run(url);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test("reference API returns hint and plan without applying changes", () => withServer(async url => {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "no entiendo" }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.appliedChanges, false);
  assert.equal(data.operationsPreview, null);
  assert.equal(data.plan.kind, "learning-plan");
}));
test("returns preview-only Agorix appendStatement after scaffold", () => withServer(async url => {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "quiero llegar", attempts: 2, hintsUsed: 2, allowProposal: true }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.operationsPreview.operations[0].type, "appendStatement");
  assert.equal(data.requiresLearnerApproval, true);
  assert.equal(data.appliedChanges, false);
}));
test("rejects malformed and non-json input", () => withServer(async url => {
  const a = await fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body: "hello" });
  assert.equal(a.status, 415);
  const b = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "hola", shell: true }) });
  assert.equal(b.status, 400);
}));
test("rejects non-loopback origin", () => withServer(async url => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ message: "hola" }) });
  assert.equal(r.status, 403);
}));
