import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOriMig03ReviewDeliveryPackage } from "./oriMig03ReviewDeliveryPackage.js";
import { verifyOriMig03ReviewDeliveryPackage } from "./oriMig03ReviewDeliveryVerifier.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
function fixture(): Bundle {
  const payload = {
    schema: "agorix/ori-mig03-educator-audit/v1" as const,
    reviewId: "pilot",
    missionId: "move",
    ticketId: "ticket",
    reviewDigest: "a".repeat(64),
    reviewRevision: 1,
    proposalEvidenceHash: "b".repeat(64),
    presentationHash: "c".repeat(64),
    technicalReadiness: "blocked" as const,
    blockers: ["human-review-required"],
    humanApproval: false as const,
    rolloutAuthorized: false as const,
  };
  return {
    ...payload,
    auditHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
describe("MIG-03 independent offline delivery verification", () => {
  it("accepts a generated intact package without authorizing rollout", () => {
    const files = createOriMig03ReviewDeliveryPackage(fixture())!;
    expect(verifyOriMig03ReviewDeliveryPackage(files)).toEqual({
      valid: true,
      blockers: [],
      rolloutAuthorized: false,
    });
  });
  it("rejects tampered checklist and mismatched identity", () => {
    const files = createOriMig03ReviewDeliveryPackage(fixture())!;
    expect(
      verifyOriMig03ReviewDeliveryPackage({
        ...files,
        checklistJson: files.checklistJson.replace("pilot", "other"),
      }).valid,
    ).toBe(false);
    expect(
      verifyOriMig03ReviewDeliveryPackage({
        ...files,
        manifestJson: "{broken",
      }).valid,
    ).toBe(false);
  });
});
