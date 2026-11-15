import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ProjectStore, semanticProjectHash, type BrowserStorageAdapter } from "@agorix/persistence";
import { programSemanticHash } from "@agorix/proposals";
import {
  createOriCliService,
  oriCliConfigFromEnv,
  type OriCliProcess,
} from "../../../apps/tutor-api/src/oriCli.js";
import { configFromEnv } from "../../../apps/tutor-api/src/index.js";
import { createTutorServer } from "../../../apps/tutor-api/src/server.js";
import {
  applyProposalSession,
  createCompanionRequest,
  createExecutionEvidence,
  createProposalSession,
  createStoredProjectWithProgram,
  openStoredProject,
  rejectProposalSession,
} from "./studioCore.js";
import { createStudioProviderClient, normalizeStudioProviderSettings } from "./studioProvider.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

class MemoryStorage implements BrowserStorageAdapter {
  private readonly values = new Map<string, string>();
  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.values.set(key, value);
  }
  remove(key: string): void {
    this.values.delete(key);
  }
  has(key: string): boolean {
    return this.values.has(key);
  }
}

describe("Web → Studio → Ori → Web", () => {
  it("preserves the canonical project through visible review, rejection and acceptance", async () => {
    const store = new ProjectStore({ storage: new MemoryStorage() });
    const webProgram = {
      schema: "agorix/program/v1" as const,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" as const },
          statements: [{ type: "move" as const, steps: 10 }],
        },
      ],
    };
    const metadata = {
      createdAt: "2026-11-15T00:00:00.000Z",
      updatedAt: "2026-11-15T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 1,
      locale: "es",
    };
    store.save("web", webProgram, metadata);
    const studio = openStoredProject(store.load("web"));
    const originalHash = semanticProjectHash(studio.stored);
    let modelCalls = 0;
    const run: OriCliProcess = async (_bin, args) => {
      if (args.includes("--version")) return "version";
      modelCalls += 1;
      return modelCalls === 1
        ? '{"message":"¿Qué cambió en la posición después de mover el personaje?"}'
        : '{"type":"turn","degrees":90}';
    };
    const server = createTutorServer({
      config: configFromEnv({}),
      ori: createOriCliService(oriCliConfigFromEnv({}), { run }),
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = createStudioProviderClient({
      settings: normalizeStudioProviderSettings({ endpoint: `${base}/api/tutor/studio-companion` }),
      fetch: (url, init) => fetch(url, init),
    });
    const evidence = createExecutionEvidence(studio.stored);
    const explain = await client.request(createCompanionRequest(studio, "explain", { evidence }));
    expect(explain.status).toBe("response");
    if (explain.status !== "response") return;
    expect(explain.response.message).toContain("posición");
    const build = await client.request(createCompanionRequest(studio, "build", { evidence }));
    expect(build.status).toBe("response");
    if (build.status !== "response" || build.response.capability !== "builder") return;
    const proposal = createProposalSession(studio, build.response.payload.proposal);
    expect(proposal.diff.changes.length).toBeGreaterThan(0);
    rejectProposalSession(studio.stored.program, proposal);
    expect(semanticProjectHash(store.load("web"))).toBe(originalHash);
    const accepted = applyProposalSession(studio.stored.program, proposal);
    const updated = createStoredProjectWithProgram(studio.stored, accepted.program);
    store.save("web", updated.program, updated.metadata);
    const reopened = store.load("web");
    expect(semanticProjectHash(reopened)).toBe(semanticProjectHash(updated));
    expect(reopened.program.scripts[0]?.statements).toHaveLength(2);
    expect(createExecutionEvidence(reopened).result.outcome).toBeDefined();
    expect(() =>
      applyProposalSession(
        {
          ...studio.stored.program,
          scripts: [{ ...studio.stored.program.scripts[0]!, statements: [] }],
        },
        proposal,
      ),
    ).toThrow();
    expect(programSemanticHash(studio.stored.program)).not.toBe(
      programSemanticHash(reopened.program),
    );
    expect(modelCalls).toBe(2);
  });
});
