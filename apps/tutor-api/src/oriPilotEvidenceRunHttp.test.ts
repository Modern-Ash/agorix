import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});

async function start(visible: boolean, authenticated = true) {
  const calls: string[][] = [];
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriReviewEnabled: true,
    oriReviewIdentity: async () =>
      authenticated ? { ownerId: "owner", projectId: "project", sessionId: "session" } : null,
    oriMig04Visibility: async () => visible,
    oriPilotVerifiedRun: async (owner, projectId, sessionId) => {
      calls.push([owner, projectId, sessionId]);
      return true;
    },
    oriPilotHintIssuer: async (owner, projectId, sessionId, expectedLevel) => {
      calls.push([owner, projectId, sessionId]);
      return { level: expectedLevel ?? 1, text: "Pista" };
    },
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}

async function run(base: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(base + "/api/tutor/ori/evidence/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agorix-request": "1",
      origin: base,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("private Ori server-verified run route", () => {
  it("reveals only the authenticated, visible pilot project", async () => {
    const active = await start(true);
    const post = (base: string) =>
      fetch(base + "/api/tutor/ori/pilot/project", {
        method: "POST",
        headers: { "content-type": "application/json", "x-agorix-request": "1", origin: base },
        body: "{}",
      });
    const response = await post(active.base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: "project" });
    expect((await post((await start(false)).base)).status).toBe(404);
    expect((await post((await start(true, false)).base)).status).toBe(401);
  });
  it("issues a hint only through the authenticated server route", async () => {
    const { base, calls } = await start(true);
    const response = await fetch(base + "/api/tutor/ori/evidence/hint", {
      method: "POST",
      headers: { "content-type": "application/json", "x-agorix-request": "1", origin: base },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ level: 1, text: "Pista" });
    expect(calls).toEqual([["owner", "project", "session"]]);
    const aligned = await fetch(base + "/api/tutor/ori/evidence/hint", {
      method: "POST",
      headers: { "content-type": "application/json", "x-agorix-request": "1", origin: base },
      body: JSON.stringify({ expectedLevel: 2 }),
    });
    expect(aligned.status).toBe(200);
    expect(await aligned.json()).toEqual({ level: 2, text: "Pista" });
    const invalid = await fetch(base + "/api/tutor/ori/evidence/hint", {
      method: "POST",
      headers: { "content-type": "application/json", "x-agorix-request": "1", origin: base },
      body: JSON.stringify({ expectedLevel: 6 }),
    });
    expect(invalid.status).toBe(400);
    expect(calls).toHaveLength(2);
  });
  it("uses only the authenticated session and an empty browser body", async () => {
    const { base, calls } = await start(true);
    const response = await run(base, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true });
    expect(calls).toEqual([["owner", "project", "session"]]);
    expect((await run(base, { projectId: "forged", attempts: 99 })).status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it("fails closed for guests, disabled policy and CSRF failure", async () => {
    const guest = await start(true, false);
    expect((await run(guest.base, {})).status).toBe(401);
    expect(guest.calls).toHaveLength(0);
    const disabled = await start(false);
    expect((await run(disabled.base, {})).status).toBe(404);
    expect(disabled.calls).toHaveLength(0);
    expect((await run(disabled.base, {}, { "x-agorix-request": "0" })).status).toBe(403);
    expect(disabled.calls).toHaveLength(0);
  });
});
