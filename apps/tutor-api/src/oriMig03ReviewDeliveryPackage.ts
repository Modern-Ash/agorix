import { createHash } from "node:crypto";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";
import { exportOriMig03EducatorAuditJson } from "./oriMig03EducatorAuditExport.js";
import { buildOriMig03HumanAcceptanceChecklist } from "./oriMig03HumanAcceptanceChecklist.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;

/** Offline adult review delivery; no automatic signoff or child-facing route. */
export function createOriMig03ReviewDeliveryPackage(bundle: Bundle) {
  const auditJson = exportOriMig03EducatorAuditJson(bundle);
  const checklist = buildOriMig03HumanAcceptanceChecklist(bundle);
  if (!auditJson || !checklist) return null;
  const checklistJson = JSON.stringify(checklist, null, 2) + "\n";
  const manifest = {
    schema: "agorix/ori-mig03-review-delivery/v1" as const,
    reviewId: bundle.reviewId,
    missionId: bundle.missionId,
    auditSha256: createHash("sha256").update(auditJson).digest("hex"),
    checklistSha256: createHash("sha256").update(checklistJson).digest("hex"),
    technicalReady: checklist.technicalReady,
    humanDecisionRequired: true as const,
    rolloutAuthorized: false as const,
  };
  return Object.freeze({
    manifestJson: JSON.stringify(manifest, null, 2) + "\n",
    auditJson,
    checklistJson,
  });
}
