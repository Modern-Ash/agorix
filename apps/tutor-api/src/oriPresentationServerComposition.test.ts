import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriPresentationServerComposition } from "./oriPresentationServerComposition.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const ticket: OriReviewTicket = {
  id: ticketId,
  status: "pending",
  appliedChanges: false,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 2 }],
  },
};
const servers: Server[] = [];
const stores: ReturnType<typeof openOriTicketPresentationSqliteStore>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
  stores.splice(0).forEach((store) => store.close());
});
async function fixture(authenticated: boolean) {
  const store = openOriTicketPresentationSqliteStore(":memory:");
  stores.push(store);
  const composition = createOriPresentationServerComposition({
    identity: async () => (authenticated ? { ownerId: "student", projectId: "project" } : null),
    resolveTicket: async (_owner, _project, id) => (id === ticketId ? ticket : null),
    store,
  });
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriReviewEnabled: true,
    ...composition,
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { store, base };
}
async function post(base: string, description: string) {
  return fetch(base + "/api/tutor/ori/review/presented", {
    method: "POST",
    headers: {
      origin: base,
      "x-agorix-request": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ticketId, description }),
  });
}
describe("Ori authenticated presentation HTTP to SQLite vertical", () => {
  it("records canonical ticket presentation once", async () => {
    const { store, base } = await fixture(true);
    expect((await post(base, "Agregar movimiento de 2 paso(s)")).status).toBe(200);
    expect(store.read("student", "project", ticketId)).toMatch(/^[a-f0-9]{64}$/);
    expect((await post(base, "Agregar movimiento de 2 paso(s)")).status).toBe(503);
  });
  it("blocks unauthenticated and forged descriptions", async () => {
    const guest = await fixture(false);
    expect((await post(guest.base, "Agregar movimiento de 2 paso(s)")).status).toBe(401);
    const valid = await fixture(true);
    expect((await post(valid.base, "Agregar movimiento de 5 paso(s)")).status).toBe(400);
    expect(valid.store.read("student", "project", ticketId)).toBeNull();
  });
});
