import type { Server } from "node:http";
import { describe, expect, it, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((done) => s.close(() => done()))),
  );
});
async function start({
  enabled = true,
  authenticated = true,
}: {
  enabled?: boolean;
  authenticated?: boolean;
} = {}) {
  const calls: { owner: string; project: string; ticket: string; decision: string }[] = [];
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriReviewEnabled: enabled,
    oriReviewIdentity: async () =>
      authenticated ? { ownerId: "student", projectId: "project-a" } : null,
    oriReviewDecision: async (owner, project, ticket, decision) => {
      calls.push({ owner, project, ticket, decision });
      if (ticket !== ticketId) return null;
      return {
        id: ticket,
        status: decision === "accept" ? "accepted" : decision === "edit" ? "edited" : "rejected",
        proposal: null,
        appliedChanges: false,
      } satisfies OriReviewTicket;
    },
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}
async function post(base: string, body: unknown, origin = base) {
  return fetch(base + "/api/tutor/ori/review/decision", {
    method: "POST",
    headers: { "content-type": "application/json", "x-agorix-request": "1", origin },
    body: JSON.stringify(body),
  });
}
describe("Ori review decision HTTP security integration", () => {
  it("uses server-authenticated identity and only records review", async () => {
    const { base, calls } = await start();
    const response = await post(base, { ticketId, decision: "reject" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "rejected", appliedChanges: false });
    expect(calls).toEqual([
      { owner: "student", project: "project-a", ticket: ticketId, decision: "reject" },
    ]);
  });
  it("fails closed when disabled or unauthenticated", async () => {
    const disabled = await start({ enabled: false });
    expect((await post(disabled.base, { ticketId, decision: "accept" })).status).toBe(404);
    const guest = await start({ authenticated: false });
    expect((await post(guest.base, { ticketId, decision: "accept" })).status).toBe(401);
    expect(guest.calls).toHaveLength(0);
  });
  it("rejects forged project identity and arbitrary execution grants", async () => {
    const { base, calls } = await start();
    expect((await post(base, { ticketId, decision: "accept", ownerId: "admin" })).status).toBe(400);
    expect((await post(base, { ticketId, decision: "accept", grants: ["write"] })).status).toBe(
      400,
    );
    expect(calls).toHaveLength(0);
  });
  it("rejects review decisions without the anti-CSRF request header", async () => {
    const { base, calls } = await start();
    const response = await fetch(base + "/api/tutor/ori/review/decision", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ ticketId, decision: "reject" }),
    });
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("rejects cross-origin review decisions", async () => {
    const { base, calls } = await start();
    expect(
      (await post(base, { ticketId, decision: "accept" }, "https://untrusted.example")).status,
    ).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
