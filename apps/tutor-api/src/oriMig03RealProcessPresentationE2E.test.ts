import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

const oriRoot = process.env["ORI_REPO_PATH"];
const runnable = !!oriRoot && isAbsolute(oriRoot) &&
  existsSync(resolve(oriRoot, "examples/host-evidence-cli.mjs"));
if (oriRoot && !runnable) throw Error("ORI_REPO_PATH lacks host-evidence-cli.mjs");
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
});
const record = {
  ownerId: "student", projectId: "project-a", revision: 1,
  semanticHash: "a".repeat(64),
  storedProject: { program: {
    schema: "agorix/program/v1",
    scripts: [{ id: "main", trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 1 }] }],
  } },
};
describe.skipIf(!runnable)("MIG-03 real Ori process → authenticated HTTP → durable SQLite", () => {
  it("issues and acknowledges a real Ori proposal, rejects guest and survives reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agorix-ori-real-e2e-"));
    const dbPath = join(directory, "presentation.sqlite");
    let store = openOriTicketPresentationSqliteStore(dbPath);
    let writes = 0;
    let authenticated = true;
    try {
      const repository = {
        get: async (owner: string, project: string) => {
          if (owner !== record.ownerId || project !== record.projectId)
            throw Error("unauthorized");
          return record;
        },
        update: async () => { writes++; throw Error("unexpected mutation"); },
      } as unknown as ProjectRepository;
      const options = createOriAuthorizedReviewOptions({
        repository, oriRoot: oriRoot!, world: { goal: { x: 10, y: 0 } },
        learningContext: async () => ({
          attempts: 1, hintsUsed: 1, learningStage: "connect",
        }),
        resolveSession: async () => authenticated
          ? { accountId: "student", sessionId: "test-session" } : null,
        activeProject: async () => "project-a",
        presentationStore: store,
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
      const propose = () => fetch(base + "/api/tutor/ori/review/propose", {
        method: "POST", headers, body: "{}",
      });
      authenticated = false;
      expect((await propose()).status).toBe(401);
      authenticated = true;
      const issued = await propose();
      expect(issued.status).toBe(200);
      const ticket = await issued.json() as { ticketId: string; proposal: {
        blocks: readonly [{ kind: string; steps?: number; direction?: string }];
      } };
      expect(ticket.ticketId).toMatch(/^[0-9a-f-]{36}$/i);
      const block = ticket.proposal.blocks[0];
      const description = block.kind === "move"
        ? `Agregar movimiento de ${block.steps} paso(s)`
        : `Agregar giro hacia ${block.direction === "left" ? "la izquierda" : "la derecha"}`;
      const presented = await fetch(base + "/api/tutor/ori/review/presented", {
        method: "POST", headers,
        body: JSON.stringify({ ticketId: ticket.ticketId, description }),
      });
      expect(presented.status).toBe(200);
      const hash = store.read("student", "project-a", ticket.ticketId);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(store.read("intruder", "project-a", ticket.ticketId)).toBeNull();
      store.close();
      store = openOriTicketPresentationSqliteStore(dbPath);
      expect(store.read("student", "project-a", ticket.ticketId)).toBe(hash);
      expect(writes).toBe(0);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);
});
