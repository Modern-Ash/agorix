import { createHash } from "node:crypto";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
const HEX = /^[a-f0-9]{64}$/;

/** Strict deterministic export for offline adult pedagogical review. */
export function exportOriMig03EducatorAuditJson(bundle: Bundle): string | null {
  if (
    !bundle ||
    bundle.schema !== "agorix/ori-mig03-educator-audit/v1" ||
    bundle.humanApproval !== false ||
    bundle.rolloutAuthorized !== false ||
    !HEX.test(bundle.auditHash) ||
    !Array.isArray(bundle.blockers) ||
    bundle.blockers.some((s) => typeof s !== "string")
  )
    return null;
  const { auditHash, ...payload } = bundle;
  const expected = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  if (expected !== auditHash) return null;
  return (
    JSON.stringify(
      {
        ...bundle,
        exportedFor: "adult-pedagogical-review",
        efficacyClaimEligible: false,
        humanDecisionRequired: true,
      },
      null,
      2,
    ) + "\n"
  );
}
