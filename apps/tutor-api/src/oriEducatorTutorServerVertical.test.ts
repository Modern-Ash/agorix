import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { AdminAuth } from "./adminAuth.js";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";
import { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";
import { createOriEducatorRouteDispatcher } from "./oriEducatorRouteDispatcher.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "movement",
      missionIndex: 0,
      status: "partial-match" as const,
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
async function start(enabled: boolean, role: boolean) {
  const store = openOriAtomicEducatorReviewStore(":memory:");
  store.publish("pilot", matrix);
  const auth = {
    configured: true,
    read: () => ({ author: "educator", csrf: "synthetic" }),
  } as unknown as AdminAuth;
  // The test binds a known loopback host, never derives trusted hosts from
  // untrusted Host headers in production.
  const trustedHosts: string[] = [];
  const admin = createOriEducatorAdminComposition({
    auth,
    trustedHosts,
    resolveRole: async () => role,
    store,
    enabled,
  });
  const dispatcher = createOriEducatorRouteDispatcher({
    handler: createOriEducatorAdminHttpAdapter(admin),
    enabled,
  });
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriEducatorAdminEnabled: enabled,
    oriEducatorAdminDispatch: dispatcher,
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address() as AddressInfo;
  trustedHosts.push(`127.0.0.1:${address.port}`);
  const base = `http://127.0.0.1:${address.port}`;
  const post = (operation: string, body: unknown = {}, csrf = "synthetic") =>
    fetch(`${base}/api/tutor/admin/ori-educator/pilot/${operation}`, {
      method: "POST",
      headers: {
        origin: `https://127.0.0.1:${address.port}`,
        "content-type": "application/json",
        "x-agorix-admin-csrf": csrf,
      },
      body: JSON.stringify(body),
    });
  return { post, store };
}
describe("MIG-03 TutorServer adult review auth and SQLite vertical", () => {
  it("denies disabled, missing role and forged CSRF requests", async () => {
    const disabled = await start(false, true);
    expect((await disabled.post("snapshot")).status).toBe(404);
    const denied = await start(true, false);
    expect((await denied.post("snapshot")).status).toBe(403);
    const allowed = await start(true, true);
    expect((await allowed.post("snapshot", {}, "forged")).status).toBe(403);
    disabled.store.close();
    denied.store.close();
    allowed.store.close();
  });
  it("performs snapshot, CAS decision and audit through TutorServer", async () => {
    const { post, store } = await start(true, true);
    const initial = await post("snapshot");
    expect(initial.status).toBe(200);
    const snapshot = (await initial.json()) as { evidenceDigest: string; revision: number };
    const decision = {
      evidenceDigest: snapshot.evidenceDigest,
      revision: snapshot.revision,
      missionId: "movement",
      decision: "approve",
      rationale: "Evaluación pedagógica documentada",
    };
    expect((await post("decide", decision)).status).toBe(200);
    expect((await post("decide", decision)).status).toBe(409);
    const updated = (await (await post("snapshot")).json()) as {
      signoff: { status: string; rolloutAuthorized: boolean };
    };
    expect(updated.signoff.status).toBe("approved");
    expect(updated.signoff.rolloutAuthorized).toBe(false);
    expect(((await (await post("audit")).json()) as unknown[]).length).toBe(2);
    store.close();
  });
});
