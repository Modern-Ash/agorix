import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { exportOriMig03EducatorAuditJson } from "./oriMig03EducatorAuditExport.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
function fixture(): Bundle {
  const payload = {
    schema: "agorix/ori-mig03-educator-audit/v1" as const,
    reviewId: "pilot", missionId: "move", ticketId: "ticket",
    reviewDigest: "a".repeat(64), reviewRevision: 1,
    proposalEvidenceHash: "b".repeat(64), presentationHash: "c".repeat(64),
    technicalReadiness: "blocked" as const,
    blockers: ["human-review-required"], humanApproval: false as const,
    rolloutAuthorized: false as const,
  };
  return { ...payload,
    auditHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
describe("MIG-03 adult audit export", () => {
  it("exports verified JSON without implying efficacy or rollout", () => {
    const json = exportOriMig03EducatorAuditJson(fixture());
    expect(json).not.toBeNull();
    expect(JSON.parse(json!)).toMatchObject({
      humanApproval: false, rolloutAuthorized: false,
      efficacyClaimEligible: false, humanDecisionRequired: true,
    });
  });
  it("rejects tampered audit content and hash", () => {
    expect(exportOriMig03EducatorAuditJson({
      ...fixture(), reviewId: "tampered",
    })).toBeNull();
    expect(exportOriMig03EducatorAuditJson({
      ...fixture(), auditHash: "0".repeat(64),
    })).toBeNull();
  });
});
