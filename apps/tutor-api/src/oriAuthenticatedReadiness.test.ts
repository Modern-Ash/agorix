import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";

const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "movement",
      missionIndex: 0,
      status: "matched-observables" as const,
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
const request = {
  method: "POST",
  headers: {
    host: "agorix.example",
    origin: "https://agorix.example",
    "content-type": "application/json",
    "x-agorix-admin-csrf": "valid",
  },
} as unknown as IncomingMessage;
const auth = { read: () => ({ author: "educator", csrf: "valid" }) } as unknown as AdminAuth;

describe("MIG-03 authenticated persisted readiness", () => {
  it("requires enabled feature, trusted role and verified provenance", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    expect(store.publish("pilot", matrix)).toBe("published");
    const state = store.get("pilot")!;
    const options = {
      auth,
      trustedHosts: ["agorix.example"],
      store,
      resolveRole: async () => true,
    };
    const disabled = createOriEducatorAdminComposition(options);
    expect(
      await disabled.readiness(request, "pilot", {
        evidenceDigest: state.digest,
        verified: true,
      }),
    ).toBeNull();
    const denied = createOriEducatorAdminComposition({
      ...options,
      resolveRole: async () => false,
      enabled: true,
    });
    expect(
      await denied.readiness(request, "pilot", {
        evidenceDigest: state.digest,
        verified: true,
      }),
    ).toBeNull();
    const enabled = createOriEducatorAdminComposition({ ...options, enabled: true });
    expect(
      (
        await enabled.readiness(request, "pilot", {
          evidenceDigest: "a".repeat(64),
          verified: true,
        })
      )?.reasons,
    ).toContain("unverified-evidence-provenance");
    expect(
      (
        await enabled.readiness(request, "pilot", {
          evidenceDigest: state.digest,
          verified: true,
        })
      )?.status,
    ).toBe("blocked");
    store.close();
  });
  it("never turns human readiness into rollout authorization", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const initial = store.get("pilot")!;
    expect(
      store.submit(
        "pilot",
        initial.digest,
        initial.revision,
        { id: "educator", canReviewOri: true },
        {
          missionId: "movement",
          decision: "approve",
          rationale: "Evaluación pedagógica suficientemente documentada",
        },
      ),
    ).toBe("recorded");
    const admin = createOriEducatorAdminComposition({
      auth,
      trustedHosts: ["agorix.example"],
      store,
      resolveRole: async () => true,
      enabled: true,
    });
    expect(
      await admin.readiness(request, "pilot", {
        evidenceDigest: initial.digest,
        verified: true,
      }),
    ).toMatchObject({
      status: "ready-for-human-acceptance",
      rolloutAuthorized: false,
    });
    store.close();
  });
});
