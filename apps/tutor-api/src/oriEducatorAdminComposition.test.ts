import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";

const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "movement", missionIndex: 0, status: "partial-match" as const,
    matches: 2, divergences: 0, notComparable: 2 }],
};
const auth = { read: () => ({ author: "educator", csrf: "valid" }) } as unknown as AdminAuth;
const request = {
  method: "POST",
  headers: { host: "agorix.example", origin: "https://agorix.example",
    "content-type": "application/json", "x-agorix-admin-csrf": "valid" },
} as unknown as IncomingMessage;
describe("Ori MIG-03 authenticated administrative composition", () => {
  it("denies access by default and allows trusted educator decisions only when enabled", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const config = {
      auth, trustedHosts: ["agorix.example"], resolveRole: async () => true, store,
    };
    const disabled = createOriEducatorAdminComposition(config);
    expect(await disabled.snapshot(request, "pilot")).toBeNull();
    const enabled = createOriEducatorAdminComposition({ ...config, enabled: true });
    const snapshot = await enabled.snapshot(request, "pilot");
    expect(snapshot?.missions).toEqual(["movement"]);
    expect(await enabled.decide(request, "pilot", snapshot!.evidenceDigest, snapshot!.revision, {
      missionId: "movement", decision: "approve", rationale: "Evaluación pedagógica documentada",
    })).toBe("recorded");
    expect((await enabled.snapshot(request, "pilot"))?.signoff?.status).toBe("approved");
    expect((await enabled.audit(request, "pilot"))?.length).toBe(2);
    store.close();
  });
  it("denies a missing educator role", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const admin = createOriEducatorAdminComposition({
      auth, trustedHosts: ["agorix.example"], resolveRole: async () => false, store, enabled: true,
    });
    expect(await admin.snapshot(request, "pilot")).toBeNull();
    store.close();
  });
});
