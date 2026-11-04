import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("standalone Ori shadow process serves a valid plan on loopback", async () => {
  const port = 12000 + Math.floor(Math.random() * 30000);
  const child = spawn(process.execPath, ["examples/shadow-api/serve.mjs"], {
    cwd: process.cwd(), env: { ...process.env, ORI_SHADOW_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk.toString(); });
  try {
    let response;
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw new Error("Ori server exited");
      try {
        response = await fetch(`http://127.0.0.1:${port}/v1/plan`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ missionIndex: 0, hintLevel: 1, scriptCount: 1 })
        });
        break;
      } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(response, output || "Ori server not ready");
    assert.equal(response.status, 200);
    const plan = await response.json();
    assert.equal(plan.schema, "ori/shadow-plan/v1");
    assert.equal(plan.appliedChanges, false);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1000))]);
  }
});
