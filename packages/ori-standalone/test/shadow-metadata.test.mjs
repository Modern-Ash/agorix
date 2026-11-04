import test from "node:test";
import assert from "node:assert/strict";
import { evaluateShadowMetadata, validateShadowMetadata } from "../src/shadow-metadata.mjs";
import { createShadowServer } from "../examples/shadow-api/server.mjs";
test("accepts only three bounded metadata fields", () => {
  assert.deepEqual(validateShadowMetadata({ missionIndex: 0, hintLevel: 1, scriptCount: 1 }), { missionIndex: 0, hintLevel: 1, scriptCount: 1 });
  assert.throws(() => validateShadowMetadata({ missionIndex: 0, hintLevel: 1, scriptCount: 1, message: "child text" }));
  assert.throws(() => validateShadowMetadata({ missionIndex: -1, hintLevel: 1, scriptCount: 1 }));
});
test("returns only metadata-validation, never program suggestions", () => {
  const result = evaluateShadowMetadata({ missionIndex: 1, hintLevel: 2, scriptCount: 0 });
  assert.equal(result.capability, "metadata-validation");
  assert.equal("proposal" in result, false);
  assert.equal("message" in result, false);
});
test("loopback server rejects unknown fields", async () => {
  const server = createShadowServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/v0/shadow`;
    const ok = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }) });
    assert.equal(ok.status, 200);
    const bad = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1, program: {} }) });
    assert.equal(bad.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
