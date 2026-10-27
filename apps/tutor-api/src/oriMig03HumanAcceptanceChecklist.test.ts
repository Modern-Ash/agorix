import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildOriMig03HumanAcceptanceChecklist } from "./oriMig03HumanAcceptanceChecklist.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
function audit(): Bundle {
  const payload = {
    schema: "agorix/ori-mig03-educator-audit/v1" as const,
    reviewId: "pilot", missionId: "move", ticketId: "ticket",
    reviewDigest: "a".repeat(64), reviewRevision: 1,
    proposalEvidenceHash: "b".repeat(64), presentationHash: "c".repeat(64),
    technicalReadiness: "ready-for-human-review" as const, blockers: [],
    humanApproval: false as const, rolloutAuthorized: false as const,
  };
  return { ...payload,
    auditHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
describe("MIG-03 human pedagogical acceptance checklist", () => {
  it("creates five pending human criteria from verified technical evidence", () => {
    const checklist = buildOriMig03HumanAcceptanceChecklist(audit());
    expect(checklist?.technicalReady).toBe(true);
    expect(checklist?.criteria).toHaveLength(5);
    expect(checklist?.criteria.every((item) =>
      item.status === "requires-human-assessment")).toBe(true);
    expect(checklist?.rolloutAuthorized).toBe(false);
  });
  it("rejects modified audit packages", () => {
    expect(buildOriMig03HumanAcceptanceChecklist({
      ...audit(), missionId: "forged",
    })).toBeNull();
  });
});
