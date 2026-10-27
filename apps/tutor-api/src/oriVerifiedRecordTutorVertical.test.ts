import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { AdminAuth } from "./adminAuth.js";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminAuthorizer } from "./oriEducatorAdminAuthorizer.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";
import { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";
import { createOriEducatorRouteDispatcher } from "./oriEducatorRouteDispatcher.js";
import { createOriAuthorizedReviewRecordingService } from "./oriAuthorizedReviewRecordingService.js";
import { createOriVerifiedRecordHttpHandler } from "./oriVerifiedRecordHttpHandler.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const servers: Server[] = [];
const stores: ReturnType<typeof openOriAtomicEducatorReviewStore>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done()))));
  stores.splice(0).forEach((store) => store.close());
});
const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1, selectedForReview: 1,
  pendingEvidence: [{ missionId: "move", status: "awaiting-human-review",
    requiredEvidence: ["ori-proposal", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
async function fixture(enabled: boolean, role: boolean, evidenceValid: boolean) {
  const store = openOriAtomicEducatorReviewStore(":memory:");
  stores.push(store);
  expect(store.publish("pilot", matrix)).toBe("published");
  const state = store.get("pilot")!;
  const auth = {
    configured: true, read: () => ({ author: "educator", csrf: "synthetic" }),
  } as unknown as AdminAuth;
  const trustedHosts: string[] = [];
  const resolveRole = async () => role;
  const authorize = createOriEducatorAdminAuthorizer({ auth, trustedHosts, resolveRole });
  const admin = createOriEducatorAdminComposition({
    auth, trustedHosts, resolveRole, store, enabled,
  });
  const service = createOriAuthorizedReviewRecordingService(
    store, async (session) => enabled ? authorize(session as import("node:http").IncomingMessage) : null,
    async () => ({ evidenceDigest: state.digest, handoff }),
    { verify: async () => evidenceValid },
  );
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriEducatorAdminEnabled: enabled,
    oriEducatorAdminDispatch: createOriEducatorRouteDispatcher({
      enabled, handler: createOriEducatorAdminHttpAdapter(admin),
      recordHandler: createOriVerifiedRecordHttpHandler(service,
        async (request) => enabled && (await authorize(request)) !== null),
    }),
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address() as AddressInfo;
  trustedHosts.push(`127.0.0.1:${address.port}`);
  const post = (payload: unknown, csrf = "synthetic") =>
    fetch(`http://127.0.0.1:${address.port}/api/tutor/admin/ori-educator/pilot/record`, {
      method: "POST",
      headers: {
        origin: `https://127.0.0.1:${address.port}`,
        "content-type": "application/json", "x-agorix-admin-csrf": csrf,
      },
      body: JSON.stringify(payload),
    });
  const submission = {
    evidenceDigest: state.digest, revision: state.revision,
    missionId: "move", reviewerId: "educator", disposition: "approve",
    rationale: "La evaluación educativa está documentada.",
    evidenceRefs: { "ori-proposal": "artifact:ori", "educator-rationale": "artifact:review" },
  };
  return { store, post, submission };
}
describe("MIG-03 verified educator record over TutorServer HTTP and SQLite", () => {
  it("persists an authorized verified decision and rejects stale CAS", async () => {
    const { store, post, submission } = await fixture(true, true, true);
    expect((await post(submission)).status).toBe(200);
    expect((await post(submission)).status).toBe(409);
    expect(store.decisions("pilot")).toHaveLength(1);
    expect(store.signoff("pilot")?.rolloutAuthorized).toBe(false);
  });
  it("rejects disabled, revoked role, forged CSRF and invalid evidence", async () => {
    const disabled = await fixture(false, true, true);
    expect((await disabled.post(disabled.submission)).status).toBe(404);
    const denied = await fixture(true, false, true);
    expect((await denied.post(denied.submission)).status).toBe(403);
    const csrf = await fixture(true, true, true);
    expect((await csrf.post(csrf.submission, "forged")).status).toBe(403);
    const invalid = await fixture(true, true, false);
    expect((await invalid.post(invalid.submission)).status).toBe(400);
    expect(invalid.store.decisions("pilot")).toHaveLength(0);
  });
});
