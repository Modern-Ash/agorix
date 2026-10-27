import type { OriMig03ReviewDeliveryFiles } from "./oriMig03ReviewDeliveryVerifier.js";
import { verifyOriMig03ReviewDeliveryPackage } from "./oriMig03ReviewDeliveryVerifier.js";

/**
 * Technical exit report for adult handoff. Does not assert production
 * readiness, efficacy or a human pedagogical decision.
 */
export function assessOriMig03TechnicalExit({
  delivery,
  productionSessionVerified,
  productionProjectVerified,
  actualOriProcessVerified,
  durableStorageVerified,
  educatorReviewCompleted,
}: {
  readonly delivery: OriMig03ReviewDeliveryFiles;
  readonly productionSessionVerified: boolean;
  readonly productionProjectVerified: boolean;
  readonly actualOriProcessVerified: boolean;
  readonly durableStorageVerified: boolean;
  readonly educatorReviewCompleted: boolean;
}) {
  const verified = verifyOriMig03ReviewDeliveryPackage(delivery);
  const blockers = [...verified.blockers];
  if (!verified.valid) blockers.push("audit-delivery-invalid");
  if (!productionSessionVerified) blockers.push("production-session-unverified");
  if (!productionProjectVerified) blockers.push("production-project-unverified");
  if (!actualOriProcessVerified) blockers.push("real-ori-process-unverified");
  if (!durableStorageVerified) blockers.push("durable-storage-unverified");
  if (!educatorReviewCompleted) blockers.push("educator-review-pending");
  return Object.freeze({
    schema: "agorix/ori-mig03-technical-exit/v1" as const,
    status: blockers.length ? ("blocked" as const) : ("ready-for-human-rollout-decision" as const),
    blockers: Object.freeze([...new Set(blockers)].sort()),
    rolloutAuthorized: false as const,
    efficacyClaimEligible: false as const,
  });
}
