import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriPersistedReadinessService } from "./oriPersistedReadiness.js";

const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
describe("MIG-03 persisted readiness audit limitations", () => {
  it("never fabricates rationale from a minimal audit event", () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    store.submit("pilot", state.digest, state.revision, { id: "educator", canReviewOri: true }, {
      missionId: "move", decision: "approve", rationale: "La revisión educativa fue documentada",
    });
    const readiness = createOriPersistedReadinessService(store).assess("pilot", {
      evidenceDigest: state.digest, verified: true,
    });
    expect(readiness?.status).toBe("blocked");
    expect(readiness?.reasons).toContain("educator-signoff-incomplete");
    expect(readiness?.rolloutAuthorized).toBe(false);
    store.close();
  });
  it("rejects stale or unverified provenance", () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const readiness = createOriPersistedReadinessService(store).assess("pilot", {
      evidenceDigest: "a".repeat(64), verified: true,
    });
    expect(readiness?.reasons).toContain("unverified-evidence-provenance");
    store.close();
  });
});
