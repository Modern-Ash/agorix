import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

const servers: Server[] = [];
const stores: ReturnType<typeof openOriTicketPresentationSqliteStore>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
  stores.splice(0).forEach((store) => store.close());
});
async function start(authenticated: boolean, activeProject: string | null) {
  const store = openOriTicketPresentationSqliteStore(":memory:");
  stores.push(store);
  const options = createOriAuthorizedReviewOptions({
    repository: {
      get: async () => ({ ownerId: "student", projectId: "project-a" }),
    } as unknown as ProjectRepository,
    oriRoot: "/test-only", world: {},
    learningContext: async () => null,
    resolveSession: async () => authenticated
      ? { accountId: "student", sessionId: "session-a" } : null,
    activeProject: async () => activeProject,
    presentationStore: store,
    runOriOverride: async () => ({
      status: "unavailable", appliedChanges: false, requiresLearnerApproval: true,
    }),
  });
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    ...options,
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, store };
}
async function post(base: string, ticketId: string) {
  return fetch(base + "/api/tutor/ori/review/presented", {
    method: "POST",
    headers: {
      origin: base, "x-agorix-request": "1", "content-type": "application/json",
    },
    body: JSON.stringify({ ticketId, description: "Agregar movimiento de 2 paso(s)" }),
  });
}
describe("Ori canonical auth presentation HTTP integration", () => {
  it("rejects guest, missing active project and unknown tickets without writes", async () => {
    const guest = await start(false, "project-a");
    expect((await post(guest.base, "123e4567-e89b-42d3-a456-426614174000")).status)
      .toBe(401);
    const missing = await start(true, null);
    expect((await post(missing.base, "123e4567-e89b-42d3-a456-426614174000")).status)
      .toBe(401);
    const unknown = await start(true, "project-a");
    expect((await post(unknown.base, "123e4567-e89b-42d3-a456-426614174000")).status)
      .toBe(400);
    expect(unknown.store.read("student", "project-a",
      "123e4567-e89b-42d3-a456-426614174000")).toBeNull();
  });
});
