import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { buildOriMig03AcceptanceManifest } from "./oriMig03AcceptanceManifest.js";

const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "move",
      missionIndex: 0,
      status: "matched-observables" as const,
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
describe("MIG-03 human acceptance evidence manifest", () => {
  it("exports deterministic evidence and keeps rollout blocked", () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    store.submit(
      "pilot",
      state.digest,
      state.revision,
      { id: "educator", canReviewOri: true },
      {
        missionId: "move",
        decision: "approve",
        rationale: "Evaluación pedagógica documentada",
      },
    );
    const provenance = { evidenceDigest: state.digest, verified: true };
    const a = buildOriMig03AcceptanceManifest(store, "pilot", provenance);
    const b = buildOriMig03AcceptanceManifest(store, "pilot", provenance);
    expect(a).toEqual(b);
    expect(a).toMatchObject({
      readiness: "ready-for-human-acceptance",
      educatorDecisionCount: 1,
      rolloutAuthorized: false,
    });
    expect(a?.auditDigest).toMatch(/^[a-f0-9]{64}$/);
    store.close();
  });
  it("reports unverified provenance as a blocker", () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const manifest = buildOriMig03AcceptanceManifest(store, "pilot", {
      evidenceDigest: "a".repeat(64),
      verified: false,
    });
    expect(manifest?.readiness).toBe("blocked");
    expect(manifest?.blockers).toContain("unverified-evidence-provenance");
    store.close();
  });
});
