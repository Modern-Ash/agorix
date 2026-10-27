import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { AdminAuth } from "./adminAuth.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";
import { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
});
const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "movement", missionIndex: 0, status: "partial-match" as const,
    matches: 2, divergences: 0, notComparable: 2 }],
};
const auth = { read: () => ({ author: "educator", csrf: "valid" }) } as unknown as AdminAuth;
async function fixture(enabled: boolean, role: boolean) {
  const store = openOriAtomicEducatorReviewStore(":memory:");
  store.publish("pilot", matrix);
  const server = createServer((request, response) => {
    const admin = createOriEducatorAdminComposition({
      auth, trustedHosts: [request.headers.host ?? ""],
      resolveRole: async () => role, store, enabled,
    });
    const adapter = createOriEducatorAdminHttpAdapter(admin);
    const operation = request.url?.slice(1);
    if (operation !== "snapshot" && operation !== "decide" && operation !== "audit") {
      response.writeHead(404); response.end(); return;
    }
    void adapter(operation, "pilot", request, response);
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (operation: string, payload?: unknown, csrf = "valid") => fetch(base + "/" + operation, {
    method: "POST",
    headers: {
      origin: `https://127.0.0.1:${(server.address() as AddressInfo).port}`,
      "content-type": "application/json", "x-agorix-admin-csrf": csrf,
    },
    body: JSON.stringify(payload ?? {}),
  });
  return { post, store };
}
describe("MIG-03 educator review real HTTP + atomic SQLite vertical", () => {
  it("requires enabled role and CSRF before any review operation", async () => {
    const disabled = await fixture(false, true);
    expect((await disabled.post("snapshot")).status).toBe(403);
    const unauthorized = await fixture(true, false);
    expect((await unauthorized.post("snapshot")).status).toBe(403);
    const enabled = await fixture(true, true);
    expect((await enabled.post("snapshot", {}, "forged")).status).toBe(403);
    expect((await enabled.post("snapshot")).status).toBe(200);
    disabled.store.close(); unauthorized.store.close(); enabled.store.close();
  });
  it("records an authorized decision with CAS and returns audit over HTTP", async () => {
    const { post, store } = await fixture(true, true);
    const snapshotResponse = await post("snapshot");
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json() as { evidenceDigest: string; revision: number };
    const payload = { evidenceDigest: snapshot.evidenceDigest, revision: snapshot.revision,
      missionId: "movement", decision: "approve", rationale: "Revisión educativa documentada" };
    expect((await post("decide", payload)).status).toBe(200);
    expect((await post("decide", payload)).status).toBe(409);
    const after = await (await post("snapshot")).json() as { signoff: { status: string; rolloutAuthorized: boolean } };
    expect(after.signoff.status).toBe("approved");
    expect(after.signoff.rolloutAuthorized).toBe(false);
    const audit = await (await post("audit")).json() as unknown[];
    expect(audit).toHaveLength(2);
    store.close();
  });
});
