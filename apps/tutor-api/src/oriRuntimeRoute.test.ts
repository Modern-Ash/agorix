import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server =>
    new Promise<void>(resolve => server.close(() => resolve()))));
});
async function start(enabled: boolean) {
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriRuntimePreviewEnabled: enabled,
    oriRuntimePreview: async () => ({
      status: "ready", hint: "¿Qué podrías probar?",
      nextStep: "Observá", requiresLearnerApproval: true, appliedChanges: false,
    }),
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function post(base: string, body: unknown, origin = base) {
  return fetch(base + "/api/tutor/ori/runtime-preview", {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}
describe("experimental Ori Tutor API route", () => {
  it("is disabled by default", async () => {
    const base = await start(false);
    expect((await post(base, { intent: "help" })).status).toBe(404);
  });
  it("returns a review-only result when explicitly enabled", async () => {
    const base = await start(true);
    const response = await post(base, { intent: "help" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ready", requiresLearnerApproval: true, appliedChanges: false,
    });
  });
  it("rejects unsupported intents and extra data", async () => {
    const base = await start(true);
    expect((await post(base, { intent: "shell" })).status).toBe(400);
    expect((await post(base, { intent: "help", message: "child text" })).status).toBe(400);
  });
  it("rejects cross-origin calls", async () => {
    const base = await start(true);
    expect((await post(base, { intent: "help" }, "https://untrusted.example")).status).toBe(403);
  });
});
