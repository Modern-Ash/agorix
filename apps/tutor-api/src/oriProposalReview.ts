import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";

/**
 * Host-owned proposal review. The trusted host must provide a fresh canonical
 * revision at decision time; Ori's receipt is never an authority to write.
 */
export type OriReviewDecision="accept"|"edit"|"reject";
export interface OriReviewResult {
  readonly status:"reviewed"|"stale"|"invalid";
  readonly decision?:OriReviewDecision;
  readonly appliedChanges:false;
}
export function validateOriRevisionAtReview(
  result:OriHostEvidenceResult,
  currentRevision:string,
  decision:OriReviewDecision
):OriReviewResult {
  if(!["accept","edit","reject"].includes(decision) ||
     result.status!=="ready" || !result.evidenceReceipt ||
     !/^[a-f0-9]{64}$/.test(currentRevision))
    return {status:"invalid",appliedChanges:false};
  if(result.evidenceReceipt.programRevision!==currentRevision)
    return {status:"stale",appliedChanges:false};
  return {status:"reviewed",decision,appliedChanges:false};
}
