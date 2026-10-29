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

describe("MIG-03 authenticated acceptance manifest", () => {
  it("requires educator role and never authorizes rollout", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    const provenance = { evidenceDigest: state.digest, verified: true };
    const base = { auth, trustedHosts: ["agorix.example"], store };
    expect(
      await createOriEducatorAdminComposition({
        ...base,
        enabled: true,
        resolveRole: async () => false,
      }).acceptanceManifest(request, "pilot", provenance),
    ).toBeNull();
    const enabled = createOriEducatorAdminComposition({
      ...base,
      enabled: true,
      resolveRole: async () => true,
    });
    expect(await enabled.acceptanceManifest(request, "pilot", provenance)).toMatchObject({
      readiness: "blocked",
      rolloutAuthorized: false,
    });
    expect(
      (
        await enabled.acceptanceManifest(request, "pilot", {
          evidenceDigest: "a".repeat(64),
          verified: true,
        })
      )?.blockers,
    ).toContain("unverified-evidence-provenance");
    store.close();
  });
});
