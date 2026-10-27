import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import type { ProjectRepository } from "@agorix/project-repository";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

const revision = "a".repeat(64);
const program = {
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" },
    statements: [{ type: "move", steps: 1 }] }],
};
const servers: Server[] = [];
const stores: ReturnType<typeof openOriTicketPresentationSqliteStore>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
  stores.splice(0).forEach((store) => store.close());
});
describe("MIG-03 issued ticket presentation HTTP to SQLite", () => {
  it("issues a canonical ticket and persists only its authentic presentation", async () => {
    const store = openOriTicketPresentationSqliteStore(":memory:");
    stores.push(store);
    const repository = { get: async () => ({
      ownerId: "student", projectId: "project-a", revision: 1, semanticHash: revision,
      storedProject: { program },
    }) } as unknown as ProjectRepository;
    const options = createOriAuthorizedReviewOptions({
      repository, oriRoot: "/unused-with-test-override",
      world: { goal: { x: 10, y: 0 } },
      learningContext: async () => ({
        attempts: 1, hintsUsed: 1, learningStage: "connect",
      }),
      resolveSession: async () => ({ accountId: "student", sessionId: "session-a" }),
      activeProject: async () => "project-a",
      presentationStore: store,
      runOriOverride: async () => ({
        status: "ready", proposal: {
          schemaVersion: "ori/proposal/v0", operation: "append",
          requiresLearnerApproval: true, blocks: [{ kind: "move", steps: 1 }],
        },
        evidenceReceipt: { programRevision: revision, digest: "b".repeat(64), complete: true },
        requiresLearnerApproval: true, appliedChanges: false,
      }),
    });
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }), ...options,
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const headers = {
      origin: base, "content-type": "application/json", "x-agorix-request": "1",
    };
    const issued = await fetch(base + "/api/tutor/ori/review/propose", {
      method: "POST", headers, body: "{}",
    });
    expect(issued.status).toBe(200);
    const ticket = await issued.json() as { ticketId: string };
    const acknowledged = await fetch(base + "/api/tutor/ori/review/presented", {
      method: "POST", headers,
      body: JSON.stringify({
        ticketId: ticket.ticketId, description: "Agregar movimiento de 1 paso(s)",
      }),
    });
    expect(acknowledged.status).toBe(200);
    expect(store.read("student", "project-a", ticket.ticketId))
      .toMatch(/^[a-f0-9]{64}$/);
    const forged = await fetch(base + "/api/tutor/ori/review/presented", {
      method: "POST", headers,
      body: JSON.stringify({
        ticketId: ticket.ticketId, description: "Agregar movimiento de 5 paso(s)",
      }),
    });
    expect(forged.status).toBe(400);
  });
});
