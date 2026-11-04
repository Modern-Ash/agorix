import test from "node:test";
import assert from "node:assert/strict";
import { planShadowMetadata } from "../src/shadow-plan.mjs";
test("returns bounded generic pedagogical plan without learner content", () => {
  const result = planShadowMetadata({ missionIndex: 0, hintLevel: 2, scriptCount: 1 });
  assert.equal(result.schema, "ori/shadow-plan/v1");
  assert.equal(result.steps.length, 3);
  assert.equal(result.appliedChanges, false);
  assert.equal("proposal" in result, false);
  assert.equal("program" in result, false);
  assert.equal("childMessage" in result, false);
});
test("empty program receives exploratory hint", () => {
  const result = planShadowMetadata({ missionIndex: 1, hintLevel: 1, scriptCount: 0 });
  assert.match(result.hint, /acción pequeña/);
});
test("rejects arbitrary child text and malformed metadata", () => {
  assert.throws(() => planShadowMetadata({ missionIndex: 0, hintLevel: 1, scriptCount: 0, message: "hola" }));
  assert.throws(() => planShadowMetadata({ missionIndex: 0, hintLevel: 7, scriptCount: 0 }));
});

test("reference API serves v1 plan without exposing proposals", async () => {
  const { createShadowServer } = await import("../examples/shadow-api/server.mjs");
  const server = createShadowServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ missionIndex: 0, hintLevel: 1, scriptCount: 1 })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.kind, "pedagogical-plan");
    assert.equal(body.appliedChanges, false);
    assert.equal("proposal" in body, false);
  } finally {
    await new Promise(resolve => server.close(() => resolve()));
  }
});
