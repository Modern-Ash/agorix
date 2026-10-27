import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { AdminAuth } from "./adminAuth.js";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";
import { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";
import { createOriAcceptanceManifestHttpHandler } from "./oriAcceptanceManifestHttpHandler.js";
import { createOriEducatorRouteDispatcher } from "./oriEducatorRouteDispatcher.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
});
const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "movement", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
async function fixture(enabled: boolean, role: boolean) {
  const store = openOriAtomicEducatorReviewStore(":memory:");
  store.publish("pilot", matrix);
  const state = store.get("pilot")!;
  const auth = {
    configured: true, read: () => ({ author: "educator", csrf: "synthetic" }),
  } as unknown as AdminAuth;
  const trustedHosts: string[] = [];
  const admin = createOriEducatorAdminComposition({
    auth, trustedHosts, resolveRole: async () => role, store, enabled,
  });
  const manifestHandler = createOriAcceptanceManifestHttpHandler(admin,
    async () => ({ evidenceDigest: state.digest, verified: true }));
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriEducatorAdminEnabled: enabled,
    oriEducatorAdminDispatch: createOriEducatorRouteDispatcher({
      enabled, handler: createOriEducatorAdminHttpAdapter(admin), manifestHandler,
    }),
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address() as AddressInfo;
  trustedHosts.push(`127.0.0.1:${address.port}`);
  const post = (csrf = "synthetic") => fetch(
    `http://127.0.0.1:${address.port}/api/tutor/admin/ori-educator/pilot/manifest`, {
      method: "POST",
      headers: {
        origin: `https://127.0.0.1:${address.port}`,
        "content-type": "application/json", "x-agorix-admin-csrf": csrf,
      },
      body: "{}",
    });
  return { store, post };
}
describe("MIG-03 acceptance manifest TutorServer HTTP vertical", () => {
  it("exports persisted evidence only through authorized adult route", async () => {
    const { store, post } = await fixture(true, true);
    const response = await post();
    expect(response.status).toBe(200);
    const manifest = await response.json() as {
      schemaVersion: string; readiness: string; rolloutAuthorized: boolean;
    };
    expect(manifest.schemaVersion).toBe("agorix/ori-mig03-acceptance/v1");
    expect(manifest.readiness).toBe("blocked");
    expect(manifest.rolloutAuthorized).toBe(false);
    store.close();
  });
  it("denies disabled routes, unauthorized role and invalid CSRF", async () => {
    const disabled = await fixture(false, true);
    expect((await disabled.post()).status).toBe(404);
    const denied = await fixture(true, false);
    expect((await denied.post()).status).toBe(403);
    const csrf = await fixture(true, true);
    expect((await csrf.post("forged")).status).toBe(403);
    disabled.store.close(); denied.store.close(); csrf.store.close();
  });
});
