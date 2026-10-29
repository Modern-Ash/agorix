import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriAtomicAdminService } from "./oriAtomicAdminService.js";

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
const session = { educatorId: "reviewer" };
const authorize = async (value: unknown) =>
  value === session ? { id: "verified-reviewer", canReviewOri: true } : null;
describe("Ori MIG-03 atomic administrative facade", () => {
  it("restricts snapshots, decisions and audit to verified educators", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    const admin = createOriAtomicAdminService(store, authorize);
    expect(await admin.publishEvidence("pilot", matrix)).toBe("published");
    expect(await admin.snapshot({}, "pilot")).toBeNull();
    const current = await admin.snapshot(session, "pilot");
    expect(current?.missions).toEqual(["movement"]);
    expect(current?.rolloutAuthorized).toBe(false);
    expect(
      await admin.decide({}, "pilot", current!.evidenceDigest, current!.revision, {
        missionId: "movement",
        decision: "approve",
        rationale: "Validación pedagógica suficiente",
      }),
    ).toBe("unauthorized");
    expect(
      await admin.decide(session, "pilot", current!.evidenceDigest, current!.revision, {
        missionId: "movement",
        decision: "approve",
        rationale: "Validación pedagógica suficiente",
      }),
    ).toBe("recorded");
    expect((await admin.snapshot(session, "pilot"))?.signoff?.status).toBe("approved");
    expect(await admin.audit({}, "pilot")).toBeNull();
    expect(await admin.audit(session, "pilot")).toHaveLength(2);
    store.close();
  });
});
