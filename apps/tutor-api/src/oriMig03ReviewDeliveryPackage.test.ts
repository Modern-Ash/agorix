import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOriMig03ReviewDeliveryPackage } from "./oriMig03ReviewDeliveryPackage.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
function audit(): Bundle {
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
describe("MIG-03 offline educator review delivery", () => {
  it("produces deterministic audit, checklist and integrity manifest", () => {
    const first = createOriMig03ReviewDeliveryPackage(audit());
    const second = createOriMig03ReviewDeliveryPackage(audit());
    expect(first).toEqual(second);
    const manifest = JSON.parse(first!.manifestJson);
    expect(manifest.auditSha256).toBe(createHash("sha256").update(first!.auditJson).digest("hex"));
    expect(manifest.checklistSha256).toBe(
      createHash("sha256").update(first!.checklistJson).digest("hex"),
    );
    expect(manifest.rolloutAuthorized).toBe(false);
  });
  it("rejects tampered audit bundles", () => {
    expect(
      createOriMig03ReviewDeliveryPackage({
        ...audit(),
        reviewId: "forged",
      }),
    ).toBeNull();
  });
});
