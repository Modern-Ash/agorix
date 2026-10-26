import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))));
});
const ticketId = "123e4567-e89b-42d3-a456-426614174000";
async function start(enabled = false) {
  const calls: string[] = [];
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriReviewEnabled: true,
    oriReviewApplyEnabled: enabled,
    oriReviewIdentity: async () => ({ ownerId: "student", projectId: "p1" }),
    oriReviewApply: async (owner, project, ticket, script) => {
      calls.push([owner, project, ticket, script].join("/"));
      return "applied";
    },
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}
function post(base: string, body: unknown, origin = base) {
  return fetch(base + "/api/tutor/ori/review/apply", {
    method: "POST",
    headers: { "content-type": "application/json", "x-agorix-request": "1", origin },
    body: JSON.stringify(body),
  });
}
describe("Ori experimental apply HTTP route", () => {
  it("remains unavailable by default", async () => {
    const { base, calls } = await start();
    expect((await post(base, { ticketId, scriptId: "main" })).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  it("delegates only server-derived identity", async () => {
    const { base, calls } = await start(true);
    const response = await post(base, { ticketId, scriptId: "main" });
    expect(response.status).toBe(200);
    expect(calls).toEqual([`student/p1/${ticketId}/main`]);
  });
  it("rejects forged authority and cross-origin requests", async () => {
    const { base, calls } = await start(true);
    expect((await post(base, { ticketId, scriptId: "main", ownerId: "other" })).status).toBe(400);
    expect((await post(base, { ticketId, scriptId: "main" }, "https://attacker.example")).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
