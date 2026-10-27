import { createHash } from "node:crypto";
import { assessOriMig03TechnicalExit } from "./oriMig03TechnicalExitReport.js";
import { createOriMig03ReviewDeliveryPackage } from "./oriMig03ReviewDeliveryPackage.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
export interface OriMig03VerifiedHostProbes {
  readonly session: () => Promise<boolean>;
  readonly project: () => Promise<boolean>;
  readonly oriProcess: () => Promise<boolean>;
  readonly durableStorage: () => Promise<boolean>;
  readonly educatorReview: () => Promise<boolean>;
}
async function safe(probe: () => Promise<boolean>): Promise<boolean> {
  try { return (await probe()) === true; }
  catch { return false; }
}
/**
 * Executable host-only readiness runner. Probe implementations must perform
 * real checks; neither browser values nor configuration flags are evidence.
 */
export async function runOriMig03TechnicalExitChecks(
  bundle: Bundle, probes: OriMig03VerifiedHostProbes,
) {
  const delivery = createOriMig03ReviewDeliveryPackage(bundle);
  if (!delivery) return null;
  const [session, project, oriProcess, durableStorage, educatorReview] =
    await Promise.all([
      safe(probes.session), safe(probes.project), safe(probes.oriProcess),
      safe(probes.durableStorage), safe(probes.educatorReview),
    ]);
  const report = assessOriMig03TechnicalExit({
    delivery,
    productionSessionVerified: session,
    productionProjectVerified: project,
    actualOriProcessVerified: oriProcess,
    durableStorageVerified: durableStorage,
    educatorReviewCompleted: educatorReview,
  });
  return Object.freeze({
    ...report,
    auditHash: bundle.auditHash,
    verificationDigest: createHash("sha256").update(JSON.stringify(report)).digest("hex"),
  });
}
