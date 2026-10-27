import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createOriPlanConsumer } from "./oriPlanConsumer.js";
import { captureOriMissionParity } from "./oriMissionParityCapture.js";

const root = process.env["ORI_REPO_PATH"];
const runnable = !!root && existsSync(resolve(root, "examples/shadow-api/serve.mjs"));
if (root && !runnable) throw Error("Invalid ORI_REPO_PATH for MIG-03");
const children: ChildProcess[] = [];
afterEach(() => { for (const child of children.splice(0)) child.kill("SIGTERM"); });

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No loopback port");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}
async function startOri() {
  const port = await availablePort();
  const child = spawn(process.execPath, [resolve(root!, "examples/shadow-api/serve.mjs")], {
    cwd: root!,
    env: { ...process.env, ORI_SHADOW_PORT: String(port) },
    stdio: "ignore",
  });
  children.push(child);
  const endpoint = `http://127.0.0.1:${port}/v1/plan`;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw Error("Ori shadow process exited");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ missionIndex: 0, hintLevel: 2, scriptCount: 1 }),
        signal: AbortSignal.timeout(250),
      });
      if (response.ok) return endpoint;
    } catch { /* wait for child readiness */ }
    await new Promise<void>((done) => setTimeout(done, 50));
  }
  throw Error("Ori shadow process did not become ready");
}

describe.skipIf(!runnable)("MIG-03 real Ori shadow mission capture", () => {
  it("compares actual Ori loopback plans against the real Kids baseline without writes", async () => {
    const endpoint = await startOri();
    const report = await captureOriMissionParity(createOriPlanConsumer(endpoint));
    expect(report.missions).toBeGreaterThan(0);
    expect(report.available + report.missing).toBe(report.missions);
    expect(report.available).toBeGreaterThan(0);
    expect(report.findings.some((entry) => entry.candidateAvailable && entry.comparison !== null))
      .toBe(true);
    expect(report.findings.every((entry) =>
      entry.comparison === null || entry.comparison.fields.some((field) =>
        field.field === "actionFamily" && field.status === "not-comparable"
      ))).toBe(true);
  }, 20000);
});
