import { describe, expect, it } from "vitest";
import { assessOriMig03TechnicalExit } from "./oriMig03TechnicalExitReport.js";

const delivery = { manifestJson: "{}", auditJson: "{}", checklistJson: "{}" };
describe("MIG-03 technical exit readiness", () => {
  it("blocks unverified production and human-review prerequisites", () => {
    const result = assessOriMig03TechnicalExit({
      delivery,
      productionSessionVerified: false,
      productionProjectVerified: false,
      actualOriProcessVerified: false,
      durableStorageVerified: false,
      educatorReviewCompleted: false,
    });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContain("production-session-unverified");
    expect(result.blockers).toContain("educator-review-pending");
    expect(result.rolloutAuthorized).toBe(false);
    expect(result.efficacyClaimEligible).toBe(false);
  });
  it("never approves rollout even when production flags are claimed", () => {
    const result = assessOriMig03TechnicalExit({
      delivery,
      productionSessionVerified: true,
      productionProjectVerified: true,
      actualOriProcessVerified: true,
      durableStorageVerified: true,
      educatorReviewCompleted: true,
    });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContain("audit-delivery-invalid");
    expect(result.rolloutAuthorized).toBe(false);
  });
});
